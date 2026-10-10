"""Air Defence Duel — building models made in Blender (headless).

Run:  ~/Applications/Blender.app/Contents/MacOS/Blender -b -P art/build_models.py -- [ids...]
Writes web/models/<id>.glb (for the game) and art/previews/<id>.png (to review).

Units: 1 Blender unit = 1 grid tile. Footprint centred on the origin, ground at z = 0.
Style: chunky, bevelled, saturated-but-coherent colours per category (like Clash of Clans).
"""
import bpy, bmesh, math, os, sys
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_GLB = os.path.join(ROOT, "web", "models")
OUT_PNG = os.path.join(ROOT, "art", "previews")
os.makedirs(OUT_GLB, exist_ok=True); os.makedirs(OUT_PNG, exist_ok=True)

# ---------------------------------------------------------------- palette
# One family of colours per building category, plus shared neutrals.
PAL = {
    "concrete": (0.80, 0.78, 0.73), "concrete_dk": (0.55, 0.54, 0.51), "asphalt": (0.18, 0.19, 0.21),
    "steel": (0.42, 0.46, 0.50), "glass": (0.16, 0.48, 0.85), "glass_lit": (0.75, 0.88, 1.0),
    "white": (0.93, 0.94, 0.95), "sand": (0.84, 0.74, 0.52), "grass": (0.36, 0.55, 0.24), "wood": (0.55, 0.36, 0.20),
    # HQ: command red & white
    "hq_red": (0.86, 0.10, 0.08), "hq_red_dk": (0.55, 0.05, 0.04), "hq_wall": (0.95, 0.92, 0.84), "hq_roof": (0.36, 0.38, 0.42),
    # Resources: gold & amber
    "gold": (1.0, 0.74, 0.12), "gold_dk": (0.78, 0.50, 0.06), "stone": (0.94, 0.90, 0.80), "stone_dk": (0.75, 0.70, 0.60),
    # Defence: grey-green military with a bright cyan accent
    "olive": (0.30, 0.42, 0.18), "olive_dk": (0.18, 0.26, 0.10), "khaki": (0.70, 0.62, 0.36), "accent": (0.0, 0.75, 1.0),
    "sandbag": (0.66, 0.58, 0.40), "net": (0.30, 0.36, 0.20), "black": (0.06, 0.06, 0.07), "red_light": (1.0, 0.15, 0.1),
}
_mats = {}
def mat(name, rough=0.6, metal=0.0, emit=0.0):
    key = (name, rough, metal, emit)
    if key in _mats: return _mats[key]
    m = bpy.data.materials.new(f"{name}")
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    c = PAL[name]
    b.inputs["Base Color"].default_value = (*c, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if emit:
        b.inputs["Emission Color"].default_value = (*c, 1)
        b.inputs["Emission Strength"].default_value = emit
    _mats[key] = m
    return m

# ---------------------------------------------------------------- primitives
def _finish(o, m, bevel, smooth=False):
    o.data.materials.append(m)
    if bevel:
        mod = o.modifiers.new("bevel", "BEVEL"); mod.width = bevel; mod.segments = 2; mod.limit_method = "ANGLE"
    if smooth:
        for p in o.data.polygons: p.use_smooth = True
    return o

def box(sx, sy, sz, x=0, y=0, z=0, m="concrete", bevel=0.03, rz=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, z + sz / 2), rotation=(0, 0, rz))
    o = bpy.context.object; o.scale = (sx, sy, sz); bpy.ops.object.transform_apply(scale=True)
    return _finish(o, mat(m) if isinstance(m, str) else m, bevel)

def cyl(r, h, x=0, y=0, z=0, m="steel", seg=24, bevel=0.02, r2=None, rx=0, ry=0):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, vertices=seg, location=(x, y, z + h / 2), rotation=(rx, ry, 0))
    else:
        bpy.ops.mesh.primitive_cone_add(radius1=r, radius2=r2, depth=h, vertices=seg, location=(x, y, z + h / 2), rotation=(rx, ry, 0))
    o = bpy.context.object
    return _finish(o, mat(m) if isinstance(m, str) else m, bevel, smooth=True)

def sphere(r, x=0, y=0, z=0, m="white", half=False):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=28, ring_count=14, location=(x, y, z))
    o = bpy.context.object
    if half:
        bm = bmesh.new(); bm.from_mesh(o.data)
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -1e-4], context="VERTS"); bm.to_mesh(o.data); bm.free()
    return _finish(o, mat(m) if isinstance(m, str) else m, 0, smooth=True)

def roof(sx, sy, h, x=0, y=0, z=0, m="hq_red"):
    """Hipped roof (4-sided pyramid stretched to the footprint)."""
    bpy.ops.mesh.primitive_cone_add(radius1=0.7071, radius2=0.0, depth=1, vertices=4, location=(x, y, z + h / 2), rotation=(0, 0, math.pi / 4))
    o = bpy.context.object; o.scale = (sx, sy, h); bpy.ops.object.transform_apply(scale=True, rotation=True)
    return _finish(o, mat(m), 0.02)

def sandbags(cx, cy, rx, ry, z=0, n=14, gap_at=None):
    """A ring of sandbags around (cx, cy)."""
    for i in range(n):
        a = i / n * math.tau
        if gap_at is not None and abs(((a - gap_at + math.pi) % math.tau) - math.pi) < 0.45: continue
        for lvl in range(2):
            o = box(0.36, 0.18, 0.13, cx + math.cos(a) * rx, cy + math.sin(a) * ry, z + lvl * 0.12, "sandbag", 0.05, rz=a + math.pi / 2)

def windows_row(x0, x1, y, z, h, n, m="glass", depth=0.04, face=1):
    w = (x1 - x0) / n
    for i in range(n):
        box(w * 0.62, depth, h, x0 + w * (i + 0.5), y + face * depth / 2, z, m, 0.005)

# ---------------------------------------------------------------- buildings
def hq():
    # plinth & forecourt
    box(3.9, 3.9, 0.12, m="concrete_dk", bevel=0.04)
    box(1.3, 0.9, 0.02, 0, 1.45, 0.12, "asphalt", 0.01)
    # main block
    box(3.0, 2.2, 1.35, 0, -0.35, 0.12, "hq_wall", 0.05)
    box(3.06, 2.26, 0.14, 0, -0.35, 1.47, "hq_red", 0.04)            # red cornice band
    box(2.8, 2.0, 0.04, 0, -0.35, 1.58, "hq_roof", 0.01)               # dark roof inside the parapet
    box(3.04, 2.24, 0.12, 0, -0.35, 0.12, "hq_red_dk", 0.03)           # red skirting
    for zz in (0.42, 0.88):
        windows_row(-1.3, 1.3, 0.75, 0.12 + zz, 0.28, 7, "glass", 0.05)
    # entrance tower with canopy
    box(1.0, 0.7, 1.9, 0, 0.75, 0.12, "hq_wall", 0.05)
    box(1.25, 0.95, 0.10, 0, 0.82, 1.15, "hq_red", 0.03)
    box(0.5, 0.06, 0.62, 0, 1.11, 0.12, "black", 0.01)                # door
    windows_row(-0.35, 0.35, 1.11, 1.32, 0.38, 2, "glass_lit", 0.04)
    box(1.1, 0.8, 0.16, 0, 0.75, 2.02, "hq_red", 0.04)                # red crown
    box(0.9, 0.6, 0.3, 0, 0.75, 2.18, "hq_wall", 0.04)
    for sx in (-1, 1):
        for sy in (-1, 1): sphere(0.045, sx * 0.4, 0.75 + sy * 0.25, 2.5, mat("red_light", 0.4, 0, 3.0))
    # roof equipment
    box(1.2, 0.8, 0.35, -0.6, -0.6, 1.61, "concrete", 0.04)
    sphere(0.32, 0.85, -0.7, 1.61, "white", half=True)                 # radome
    cyl(0.03, 1.6, 1.15, 0.1, 1.61, "steel", 8, 0)                       # antenna mast
    sphere(0.05, 1.15, 0.1, 3.22, "red_light")
    # flag
    cyl(0.025, 1.9, -1.55, 1.55, 0.12, "white", 8, 0)
    box(0.55, 0.02, 0.34, -1.27, 1.55, 1.65, "hq_red", 0.005)
    # helipad on the side
    cyl(0.62, 0.04, 1.35, 1.2, 0.12, "asphalt", 32, 0)
    cyl(0.5, 0.045, 1.35, 1.2, 0.12, "white", 32, 0)
    cyl(0.44, 0.05, 1.35, 1.2, 0.12, "asphalt", 32, 0)
    box(0.08, 0.36, 0.01, 1.22, 1.2, 0.17, "white", 0); box(0.08, 0.36, 0.01, 1.48, 1.2, 0.17, "white", 0); box(0.26, 0.08, 0.01, 1.35, 1.2, 0.17, "white", 0)
    # sandbag line in front
    for i in range(6): box(0.34, 0.17, 0.14, -1.6 + i * 0.36, 1.82, 0.12, "sandbag", 0.05)

def treasury():
    box(2.9, 2.9, 0.12, m="stone_dk", bevel=0.04)
    # stepped base
    for i, s in enumerate((2.6, 2.4, 2.2)):
        box(s, s * 0.82, 0.1, 0, -0.1, 0.12 + i * 0.1, "stone", 0.02)
    # hall
    box(1.9, 1.5, 1.0, 0, -0.25, 0.42, "stone", 0.04)
    # columns across the front
    for i in range(6):
        x = -0.9 + i * 0.36
        cyl(0.075, 0.95, x, 0.72, 0.42, "white", 16, 0.01)
        box(0.2, 0.2, 0.06, x, 0.72, 0.42, "stone_dk", 0.01); box(0.2, 0.2, 0.06, x, 0.72, 1.31, "stone_dk", 0.01)
    box(2.1, 0.5, 0.12, 0, 0.62, 1.37, "stone", 0.02)                   # architrave
    # gold pediment & dome
    bpy.ops.mesh.primitive_cone_add(radius1=1.0, radius2=0, depth=1, vertices=3, location=(0, 0.62, 1.49 + 0.22), rotation=(math.pi / 2, 0, 0))
    o = bpy.context.object; o.scale = (1.15, 0.45, 0.5); bpy.ops.object.transform_apply(scale=True, rotation=True); _finish(o, mat("gold", 0.3, 0.8), 0.02)
    cyl(0.62, 0.25, 0, -0.3, 1.42, "stone", 32, 0.02)
    sphere(0.56, 0, -0.3, 1.67, mat("gold", 0.25, 0.9), half=True)
    cyl(0.04, 0.35, 0, -0.3, 2.2, "gold_dk", 8, 0)
    # door
    box(0.4, 0.05, 0.6, 0, 0.5, 0.42, "wood", 0.01)
    # stacked gold bars by the steps
    for i, (x, y, z) in enumerate([(-1.05, 1.15, 0.12), (-0.85, 1.15, 0.12), (-0.95, 1.15, 0.2), (1.0, 1.1, 0.12)]):
        box(0.2, 0.1, 0.08, x, y, z, mat("gold", 0.3, 0.8), 0.015)
    # lamp posts
    for x in (-1.2, 1.2):
        cyl(0.025, 0.7, x, 1.25, 0.12, "black", 8, 0); sphere(0.06, x, 1.25, 0.86, mat("glass_lit", 0.3, 0, 2.0))

def sam_site():
    """Hisar-A+ style low-altitude SAM site (2×2 tiles)."""
    box(1.95, 1.95, 0.08, m="concrete_dk", bevel=0.03)
    sandbags(0, 0, 0.88, 0.88, 0.08, n=22, gap_at=-math.pi / 2)
    # launcher vehicle
    box(0.5, 1.05, 0.22, 0, 0.05, 0.16, "olive", 0.04)                # hull
    for s in (-1, 1):
        box(0.08, 1.0, 0.14, s * 0.27, 0.05, 0.12, "black", 0.03)     # tracks
        for k in range(4): cyl(0.065, 0.06, s * 0.27, -0.3 + k * 0.23, 0.12, "black", 12, 0, ry=math.pi / 2)
    box(0.42, 0.3, 0.2, 0, 0.42, 0.38, "olive_dk", 0.03)               # cab
    box(0.36, 0.02, 0.1, 0, 0.575, 0.47, "glass", 0.005)
    # tilted 2×2 canister launcher
    # launcher frame tilted 40° up toward the front; four canisters with cyan caps
    bpy.ops.object.empty_add(location=(0, -0.2, 0.42)); pivot = bpy.context.object
    box(0.42, 0.08, 0.06, 0, -0.2, 0.36, "steel", 0.01)
    for i in range(2):
        for j in range(2):
            c = box(0.16, 0.66, 0.16, (i - 0.5) * 0.18, 0.1, (j - 0.5) * 0.18, "khaki", 0.02); c.parent = pivot
            cap = box(0.13, 0.02, 0.13, (i - 0.5) * 0.18, 0.43, (j - 0.5) * 0.18 + 0.015, "accent", 0.005); cap.parent = pivot
    pivot.rotation_euler = (math.radians(40), 0, 0)
    # radar mast
    cyl(0.035, 0.62, -0.62, -0.55, 0.08, "steel", 8, 0)
    r = box(0.34, 0.05, 0.22, -0.62, -0.55, 0.68, "accent", 0.01); r.rotation_euler = (math.radians(-12), 0, math.radians(30))
    box(0.1, 0.1, 0.06, -0.62, -0.55, 0.66, "steel", 0.01)
    # ammo crates
    box(0.18, 0.14, 0.1, 0.6, -0.6, 0.08, "olive_dk", 0.015); box(0.18, 0.14, 0.1, 0.6, -0.44, 0.08, "olive_dk", 0.015)
    box(0.18, 0.14, 0.1, 0.6, -0.52, 0.18, "olive", 0.015)

BUILDERS = {"hq": hq, "treasury": treasury, "def_hisara": sam_site}

# ---------------------------------------------------------------- scene, export, preview
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _mats.clear()

def preview(name, size):
    scn = bpy.context.scene
    for eng in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "CYCLES"):
        try: scn.render.engine = eng; break
        except Exception: pass
    if scn.render.engine == "CYCLES": scn.cycles.samples = 48
    scn.render.resolution_x, scn.render.resolution_y = 900, 700
    scn.render.film_transparent = False
    try: scn.view_settings.view_transform = "Standard"
    except Exception: pass
    w = bpy.data.worlds.new("w"); scn.world = w; w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (0.62, 0.74, 0.86, 1); w.node_tree.nodes["Background"].inputs[1].default_value = 0.55
    # ground
    bpy.ops.mesh.primitive_plane_add(size=size * 6, location=(0, 0, -0.001)); g = bpy.context.object
    gm = bpy.data.materials.new("ground"); gm.use_nodes = True; gm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.74, 0.68, 0.53, 1); g.data.materials.append(gm)
    # sun
    bpy.ops.object.light_add(type="SUN", rotation=(math.radians(50), math.radians(10), math.radians(35))); bpy.context.object.data.energy = 3.5
    # camera: 3/4 view from the front-right, like the game
    d = size * 2.1
    bpy.ops.object.camera_add(location=(d * 0.75, d * 1.05, d * 0.85))
    cam = bpy.context.object; scn.camera = cam
    direction = Vector((0, 0, size * 0.18)) - cam.location; cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    cam.data.lens = 50
    scn.render.filepath = os.path.join(OUT_PNG, name + ".png")
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(g); bpy.data.objects.remove(cam)

def export(name):
    for o in bpy.context.scene.objects: o.select_set(o.type in ("MESH", "EMPTY"))
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT_GLB, name + ".glb"), export_format="GLB", use_selection=True, export_apply=True, export_yup=True)

if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ids = argv or list(BUILDERS)
    sizes = {"hq": 4, "treasury": 3, "def_hisara": 2}
    for i in ids:
        reset(); BUILDERS[i](); export(i); preview(i, sizes.get(i, 3)); print("built", i)
