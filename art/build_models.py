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
    # Army palette (Mert, 10 Oct): olive drab, khaki, sand, dark green, gunmetal. Bright colours only for small lights/markings.
    "concrete": (0.62, 0.60, 0.54), "concrete_dk": (0.42, 0.41, 0.37), "asphalt": (0.16, 0.17, 0.17),
    "steel": (0.32, 0.34, 0.33), "gunmetal": (0.22, 0.24, 0.25), "glass": (0.18, 0.26, 0.28), "glass_lit": (0.95, 0.85, 0.55),
    "white": (0.80, 0.78, 0.70), "sand": (0.70, 0.62, 0.44), "grass": (0.20, 0.32, 0.14), "wood": (0.40, 0.28, 0.16),
    # buildings
    "hq_red": (0.36, 0.40, 0.22), "hq_red_dk": (0.24, 0.27, 0.15), "hq_wall": (0.62, 0.57, 0.42), "hq_roof": (0.26, 0.29, 0.18),
    "gold": (0.78, 0.62, 0.25), "gold_dk": (0.55, 0.42, 0.15), "stone": (0.66, 0.60, 0.45), "stone_dk": (0.48, 0.43, 0.32),
    # vehicles & weapons
    "olive": (0.29, 0.33, 0.18), "olive_dk": (0.18, 0.21, 0.11), "khaki": (0.58, 0.52, 0.34), "tan": (0.66, 0.56, 0.38),
    "camo1": (0.24, 0.29, 0.15), "camo2": (0.45, 0.40, 0.25), "camo3": (0.14, 0.15, 0.10),
    "grey_navy": (0.55, 0.58, 0.60), "uav_grey": (0.70, 0.72, 0.73), "missile_white": (0.85, 0.85, 0.82),
    "accent": (0.85, 0.65, 0.10), "sandbag": (0.56, 0.49, 0.33), "net": (0.22, 0.27, 0.13), "black": (0.05, 0.05, 0.05),
    "rust": (0.42, 0.22, 0.12), "red_light": (1.0, 0.12, 0.08), "green_light": (0.2, 1.0, 0.3), "red_band": (0.70, 0.12, 0.08), "yellow_band": (0.95, 0.75, 0.10),
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
    o = bpy.context.object; o.scale = (sx, sy, sz); bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
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
    o = bpy.context.object; o.scale = (sx, sy, h); bpy.ops.object.transform_apply(location=False, scale=True, rotation=True)
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
def jeep(x, y, rz=0, col="olive"):
    """Small military jeep (about 0.55 × 0.28 tiles)."""
    bpy.ops.object.empty_add(location=(x, y, 0)); j = bpy.context.object
    parts = [box(0.5, 0.26, 0.12, 0, 0, 0.07, col, 0.03), box(0.24, 0.24, 0.1, -0.05, 0, 0.19, col, 0.03),
             box(0.02, 0.22, 0.08, 0.075, 0, 0.2, "glass", 0.005), box(0.08, 0.2, 0.05, 0.22, 0, 0.12, "black", 0.01)]
    for sx in (-0.15, 0.15):
        for sy in (-0.13, 0.13): parts.append(cyl(0.055, 0.05, sx, sy, 0.03, "black", 12, 0, rx=math.pi / 2))
    for o in parts: o.parent = j
    j.rotation_euler = (0, 0, rz)
    return j

def tree(x, y, s=1.0):
    cyl(0.025 * s, 0.22 * s, x, y, 0, "wood", 8, 0)
    sphere(0.16 * s, x, y, 0.3 * s, "grass")
    sphere(0.11 * s, x + 0.06 * s, y - 0.04 * s, 0.4 * s, "grass")

def lamp(x, y, h=0.75):
    cyl(0.018, h, x, y, 0, "black", 8, 0)
    box(0.12, 0.05, 0.03, x + 0.05, y, h, "black", 0.005)
    sphere(0.03, x + 0.1, y, h - 0.02, mat("glass_lit", 0.3, 0, 3.0))

def window(x, y, z, w, h, lit=False, face="y"):
    """Window with frame, glass, mullion and sill, on a wall facing +y (face='y') or +x (face='x')."""
    if face == "y":
        box(w + 0.05, 0.03, h + 0.05, x, y + 0.012, z - 0.025, "white", 0.005)                   # frame
        box(w, 0.035, h, x, y + 0.02, z, "glass_lit" if lit else "glass", 0.002)
        box(0.018, 0.04, h, x, y + 0.03, z, "white", 0)                                            # mullion
        box(w + 0.09, 0.07, 0.025, x, y + 0.035, z - 0.04, "concrete_dk", 0.005)                   # sill
    else:
        box(0.03, w + 0.05, h + 0.05, x + 0.012, y, z - 0.025, "white", 0.005)
        box(0.035, w, h, x + 0.02, y, z, "glass_lit" if lit else "glass", 0.002)
        box(0.04, 0.018, h, x + 0.03, y, z, "white", 0)
        box(0.07, w + 0.09, 0.025, x + 0.035, y, z - 0.04, "concrete_dk", 0.005)

def hq_wing(px, py, s, ang, rnd, L=1.08, D=0.56, fh=0.34):
    """One office wing of the HQ: 3 floors of ribbon windows, flat roof, stair tower at the outer end.
    Built in local space (inner end at x = 0, running toward x = s·L, front face at +y) under a pivot."""
    z0 = 0.115
    bpy.ops.object.empty_add(location=(px, py, 0)); piv = bpy.context.object
    parts = []
    cx, H = s * L / 2, 0.06 + 3 * fh + 0.04
    parts.append(box(L, D, H, cx, 0, z0, "hq_wall", 0.02))
    parts.append(box(L + 0.03, D + 0.03, 0.06, cx, 0, z0, "concrete_dk", 0.01))                 # plinth
    n = 8; pw = (L - 0.06) / n
    for f in range(3):
        zf = z0 + 0.06 + f * fh + 0.1
        parts.append(box(L + 0.012, D + 0.012, 0.022, cx, 0, zf - 0.035, "white", 0.004))         # precast band under each ribbon
        for i in range(n):
            x = s * (0.03 + pw * (i + 0.5))
            for face in (1, -1):
                lit = face == 1 and rnd.random() < 0.22
                parts.append(box(pw - 0.022, 0.03, 0.15, x, face * (D / 2 + 0.004), zf, "glass_lit" if lit else "glass", 0.002))
    zr = z0 + H
    parts.append(box(L - 0.05, D - 0.05, 0.02, cx, 0, zr, "hq_roof", 0.004))
    for sy in (-1, 1): parts.append(box(L, 0.05, 0.07, cx, sy * (D / 2 - 0.025), zr, "hq_wall", 0.008))   # parapet
    parts.append(box(0.05, D, 0.07, s * (L - 0.025), 0, zr, "hq_wall", 0.008))
    # stair tower with a full-height glass strip
    tx = s * (L + 0.1)
    parts.append(box(0.22, D + 0.06, H + 0.14, tx, 0, z0, "hq_wall", 0.02))
    parts.append(box(0.24, D + 0.08, 0.04, tx, 0, z0 + H + 0.14, "hq_red", 0.01))
    parts.append(box(0.1, 0.03, H - 0.12, tx, (D + 0.06) / 2 + 0.004, z0 + 0.1, "glass", 0.003))
    parts.append(box(0.03, 0.1, H - 0.12, tx + s * 0.115, 0, z0 + 0.1, "glass", 0.003))
    # square skylight and roof hatch
    kx = s * L * 0.4
    parts.append(box(0.3, 0.24, 0.035, kx, 0, zr, "concrete", 0.008)); parts.append(box(0.24, 0.18, 0.04, kx, 0, zr + 0.01, "glass", 0.004))
    for o in parts: o.parent = piv
    piv.rotation_euler = (0, 0, -s * ang)
    return piv, zr

# ---------------------------------------------------------------- HQ levels 1–10 (same 4×4 plot)
Z0 = 0.115   # top of the plot slab

def prism(sx, sy, h, x=0, y=0, z=0, m="hq_roof", rz=0, bevel=0.01):
    """Gable roof / ridge tent: ridge along x, eaves at ±sy/2."""
    me = bpy.data.meshes.new("prism")
    me.from_pydata([(-sx / 2, -sy / 2, 0), (sx / 2, -sy / 2, 0), (sx / 2, sy / 2, 0), (-sx / 2, sy / 2, 0), (-sx / 2, 0, h), (sx / 2, 0, h)], [],
                   [(3, 2, 1, 0), (0, 1, 5, 4), (2, 3, 4, 5), (0, 4, 3), (1, 2, 5)])
    me.update()
    o = bpy.data.objects.new("prism", me); bpy.context.collection.objects.link(o)
    o.location = (x, y, z); o.rotation_euler = (0, 0, rz)
    return _finish(o, mat(m), bevel)

def hq_ground(cover):
    box(3.92, 3.92, 0.1, m="concrete_dk", bevel=0.04)
    box(3.7, 3.7, 0.015, 0, 0, 0.1, cover, 0.005)

def flags(x, y, n=3, tall=1.0):
    for i in range(n):
        fx = x + (i - (n - 1) / 2) * 0.14
        h = tall * (1.25 if (i == (n - 1) / 2 and n > 1) else 1.0)
        cyl(0.014, h, fx, y, Z0, "white", 8, 0)
        sphere(0.022, fx, y, Z0 + h, mat("gold", 0.3, 0.8))
        box(0.012, 0.2, 0.13, fx, y + 0.105, Z0 + h - 0.16, "camo2" if i == (n - 1) // 2 else "hq_red_dk", 0.003)

def lattice_mast(x, y, z, h, w=0.055):
    for sx in (-1, 1):
        for sy in (-1, 1): cyl(0.011, h, x + sx * w, y + sy * w, z, "steel", 6, 0)
    for k in range(int(h / 0.17)): box(w * 2.4, w * 2.4, 0.012, x, y, z + 0.15 + k * 0.17, "steel", 0)
    sphere(0.035, x, y, z + h + 0.03, mat("red_light", 0.4, 0, 4.0))

def dish(x, y, z, r=0.11, rz=0.6):
    cyl(0.022, 0.12, x, y, z, "steel", 8, 0)
    d = cyl(r, 0.045, x, y, z + 0.12, "white", 20, 0.01, r2=0.02); d.rotation_euler = (math.radians(55), 0, rz)

def fence(gap=(0.95, 1.3), e=1.86):
    """Chain-link fence round the plot: posts and two wires; gap on the +x side for the gate."""
    n = 12
    for i in range(n + 1):
        t = -e + i * 2 * e / n
        for (x, y) in ((t, e), (t, -e), (-e, t), (e, t)):
            if x == e and gap[0] < y < gap[1]: continue
            cyl(0.012, 0.26, x, y, Z0, "steel", 6, 0)
    for z in (0.12, 0.24):
        box(2 * e, 0.008, 0.008, 0, e, Z0 + z, "steel", 0); box(2 * e, 0.008, 0.008, 0, -e, Z0 + z, "steel", 0)
        box(0.008, 2 * e, 0.008, -e, 0, Z0 + z, "steel", 0)
        box(0.008, e - gap[1], 0.008, e, (e + gap[1]) / 2, Z0 + z, "steel", 0)
        box(0.008, gap[0] + e, 0.008, e, (gap[0] - e) / 2, Z0 + z, "steel", 0)

def perimeter_wall(gap=(0.96, 1.28), e=1.88):
    """Concrete security wall with coping; gap on the +x side for the gate."""
    for (sx, sy, x, y) in ((2 * e + 0.07, 0.07, 0, e), (2 * e + 0.07, 0.07, 0, -e), (0.07, 2 * e, -e, 0),
                           (0.07, e - gap[1], e, (e + gap[1]) / 2), (0.07, gap[0] + e, e, (gap[0] - e) / 2)):
        box(sx, sy, 0.22, x, y, Z0, "concrete", 0.01)
        box(sx + 0.02, sy + 0.02, 0.025, x, y, Z0 + 0.22, "concrete_dk", 0.005)

def watchtower(x, y):
    for sx in (-1, 1):
        for sy in (-1, 1): cyl(0.014, 0.72, x + sx * 0.11, y + sy * 0.11, Z0, "steel", 6, 0)
    box(0.3, 0.3, 0.03, x, y, Z0 + 0.72, "concrete_dk", 0.005)
    box(0.28, 0.28, 0.08, x, y, Z0 + 0.75, "hq_wall", 0.01)
    for (dx, dy, f) in ((0, 0.14, "y"), (0.14, 0, "x")):
        box(0.2 if f == "y" else 0.02, 0.02 if f == "y" else 0.2, 0.08, x + dx, y + dy, Z0 + 0.84, "glass", 0.002)
    for sx in (-1, 1):
        for sy in (-1, 1): box(0.025, 0.025, 0.1, x + sx * 0.13, y + sy * 0.13, Z0 + 0.83, "hq_wall", 0)
    box(0.36, 0.36, 0.035, x, y, Z0 + 0.93, "hq_red", 0.008)
    sphere(0.025, x + 0.15, y + 0.15, Z0 + 0.9, mat("glass_lit", 0.3, 0, 3.0))

def gate(gx=1.62, gy=1.12, x0=0.7):
    """Road from x0 to the +x edge with a guard booth, boom barrier and concrete blocks."""
    box(1.96 - x0, 0.24, 0.012, (x0 + 1.96) / 2, gy, Z0, "asphalt", 0.003)
    for i in range(int((1.9 - x0) / 0.25)): box(0.12, 0.025, 0.004, x0 + 0.2 + i * 0.25, gy, Z0 + 0.012, "yellow_band", 0)
    box(0.26, 0.26, 0.3, gx, gy + 0.3, Z0, "hq_wall", 0.02); box(0.32, 0.32, 0.04, gx, gy + 0.3, Z0 + 0.3, "hq_red", 0.01)
    box(0.18, 0.02, 0.1, gx, gy + 0.175, Z0 + 0.15, "glass_lit", 0)
    cyl(0.025, 0.18, gx - 0.08, gy + 0.15, Z0, "black", 8, 0)
    for i in range(3): box(0.025, 0.1, 0.025, gx - 0.08, gy + 0.08 - i * 0.1, Z0 + 0.16, "yellow_band" if i % 2 == 0 else "black", 0.003)
    for y in (gy - 0.24, gy - 0.4): box(0.26, 0.08, 0.09, gx, y, Z0, "concrete", 0.015)

def entrance(x, front, w=0.6):
    """Door, canopy on two columns, name plate, steps."""
    box(0.3, 0.03, 0.3, x, front + 0.012, Z0, "black", 0.004)
    box(0.015, 0.035, 0.3, x, front + 0.02, Z0, "white", 0)
    box(w, 0.32, 0.04, x, front + 0.16, Z0 + 0.4, "hq_red", 0.01)
    for sx in (-1, 1): box(0.035, 0.035, 0.4, x + sx * (w / 2 - 0.05), front + 0.29, Z0, "white", 0.005)
    box(w * 0.7, 0.02, 0.065, x, front + 0.325, Z0 + 0.41, "white", 0.004)
    sphere(0.026, x, front + 0.34, Z0 + 0.445, mat("gold", 0.3, 0.8))
    for k in range(2): box(w * 0.75 - k * 0.06, 0.1, 0.03, x, front + 0.05 + k * 0.08, Z0 - k * 0.0 + (1 - k) * 0.025, "concrete", 0.004)

def hq_block(cx, cy, W, D, floors, rnd, roof="flat", door_x=None, fh=0.34):
    """Plain office block: windows on the two sides the camera sees, floor bands, flat roof with parapet or gable roof."""
    H = 0.06 + floors * fh + 0.04
    box(W, D, H, cx, cy, Z0, "hq_wall", 0.03)
    box(W + 0.04, D + 0.04, 0.07, cx, cy, Z0, "concrete_dk", 0.01)
    front, side = cy + D / 2, cx + W / 2
    nf, ns = max(2, int(W / 0.4)), max(1, int(D / 0.4))
    for f in range(floors):
        zf = Z0 + 0.06 + f * fh + 0.1
        for i in range(nf):
            x = cx - W / 2 + (i + 0.5) * W / nf
            if f == 0 and door_x is not None and abs(x - door_x) < 0.28: continue
            window(x, front, zf, 0.2, 0.2, lit=rnd.random() < 0.25)
        for i in range(ns): window(side, cy - D / 2 + (i + 0.5) * D / ns, zf, 0.2, 0.2, lit=rnd.random() < 0.25, face="x")
        if f > 0: box(W + 0.02, D + 0.02, 0.025, cx, cy, Z0 + 0.06 + f * fh - 0.02, "concrete_dk", 0.004)
    zr = Z0 + H
    if roof == "flat":
        box(W - 0.06, D - 0.06, 0.02, cx, cy, zr, "hq_roof", 0.004)
        for sy in (-1, 1): box(W + 0.03, 0.06, 0.08, cx, cy + sy * D / 2, zr, "hq_red", 0.008)
        for sx in (-1, 1): box(0.06, D + 0.03, 0.08, cx + sx * W / 2, cy, zr, "hq_red", 0.008)
    else:
        prism(W + 0.14, D + 0.16, 0.3, cx, cy, zr, "hq_roof")
    if door_x is not None: entrance(door_x, front)
    return zr, front, side

def trees(spots):
    for (x, y, sc) in spots: tree(x, y, sc)

def lamps(spots):
    for (x, y) in spots: lamp(x, y, 0.6)

def tent(x, y, L, W, rz=0, col="olive"):
    box(L, W, 0.2, x, y, Z0, col, 0.02, rz=rz)
    prism(L + 0.04, W + 0.08, 0.17, x, y, Z0 + 0.2, col, rz)
    dx, dy = math.cos(rz), math.sin(rz)
    box(0.02 if abs(dx) > 0.5 else 0.16, 0.16 if abs(dx) > 0.5 else 0.02, 0.17,
        x + dx * (L / 2 + 0.005), y + dy * (L / 2 + 0.005), Z0, "olive_dk", 0)                          # door flap

def camo_net(x, y, sx, sy, h, rnd):
    for px in (-1, 1):
        for py in (-1, 1): cyl(0.012, h, x + px * sx * 0.45, y + py * sy * 0.45, Z0, "wood", 6, 0)
    box(sx, sy, 0.012, x, y, Z0 + h, "net", 0.004)
    for k in range(18):
        box(0.12 + rnd.random() * 0.2, 0.1 + rnd.random() * 0.16, 0.016, x + (rnd.random() - 0.5) * sx * 0.85, y + (rnd.random() - 0.5) * sy * 0.85,
            Z0 + h + 0.004, rnd.choice(("camo1", "camo2", "camo3")), 0.004, rz=rnd.random() * 3)

def drums(x, y, n=3):
    for i in range(n): cyl(0.055, 0.15, x + (i % 2) * 0.12, y + (i // 2) * 0.12, Z0, "olive_dk", 14, 0.01)

def crates(x, y):
    box(0.18, 0.14, 0.1, x, y, Z0, "olive_dk", 0.015); box(0.18, 0.14, 0.1, x, y + 0.16, Z0, "olive_dk", 0.015)
    box(0.18, 0.14, 0.1, x, y + 0.08, Z0 + 0.1, "olive", 0.015)

def generator(x, y):
    box(0.32, 0.2, 0.18, x, y, Z0, "olive_dk", 0.02)
    box(0.08, 0.12, 0.04, x + 0.08, y, Z0 + 0.18, "black", 0.005)
    cyl(0.015, 0.12, x - 0.1, y + 0.05, Z0 + 0.18, "black", 8, 0)

def container(x, y, L, col="khaki", door=True):
    """Prefab office container along x: corrugated sides, door and windows on the +y face."""
    box(L, 0.5, 0.48, x, y, Z0 + 0.04, col, 0.015)
    for sx in (-1, 1): box(0.04, 0.52, 0.52, x + sx * (L / 2 - 0.02), y, Z0, "gunmetal", 0.006)              # corner frames
    for i in range(int(L / 0.08)):
        box(0.025, 0.52, 0.4, x - L / 2 + 0.08 + i * 0.08, y, Z0 + 0.08, col, 0.003)                        # ribs
    box(L + 0.03, 0.53, 0.03, x, y, Z0 + 0.52, "gunmetal", 0.005)

def soldier(x, y, rz=0):
    box(0.05, 0.035, 0.1, x, y, Z0, "olive", 0.01, rz=rz)
    sphere(0.02, x, y, Z0 + 0.12, "tan")
    sphere(0.024, x, y, Z0 + 0.13, "camo3", half=True)

def hq_1(rnd):
    """Field command post: command tents under a camouflage net inside a sandbag ring."""
    hq_ground("sand")
    for (x, y, sx, sy) in [(-1.3, 1.2, 0.6, 0.4), (1.3, -1.25, 0.5, 0.45), (-1.4, -1.3, 0.4, 0.3)]:
        box(sx, sy, 0.008, x, y, 0.1 + 0.015, "grass", 0.004)                                      # patches of scrub
    box(1.8, 0.3, 0.008, 1.0, 0.9, Z0, "khaki", 0.004, rz=math.pi / 4)                                   # dirt track in
    sandbags(0, 0, 1.5, 1.5, Z0, n=28, gap_at=math.pi / 4)
    tent(-0.25, -0.25, 1.3, 0.7, 0, "olive")
    tent(0.45, 0.6, 0.8, 0.55, math.pi / 2, "camo2")
    camo_net(-0.25, -0.25, 1.75, 1.15, 0.52, rnd)
    for (x, h) in ((0.85, 1.25), (0.95, 0.95)): cyl(0.008, h, x, 0.05, Z0, "black", 6, 0); sphere(0.015, x, 0.05, Z0 + h, "black")   # radio whips
    generator(0.95, -0.55); drums(-1.05, 0.55); crates(-0.95, -0.95)
    flags(0.0, 1.05, 1, 0.9)

def hq_2(rnd):
    """Prefab camp HQ: two office containers joined, short radio mast, generator, fence."""
    hq_ground("sand")
    box(1.2, 0.24, 0.01, 1.36, 1.12, Z0, "khaki", 0.003)                                                 # gravel drive
    box(0.24, 0.8, 0.01, 0.75, 0.7, Z0, "khaki", 0.003)
    container(-0.15, -0.35, 1.6, "khaki"); container(-0.15, 0.16, 1.6, "tan")
    front = 0.41
    box(0.2, 0.03, 0.34, 0.45, front + 0.005, Z0 + 0.04, "gunmetal", 0.004)                              # door
    for x in (-0.65, -0.25, 0.05): box(0.2, 0.03, 0.14, x, front + 0.005, Z0 + 0.24, "glass_lit" if x == -0.25 else "glass", 0.003)
    for k in range(2): box(0.3 - k * 0.06, 0.1, 0.03, 0.45, front + 0.06 + k * 0.08, Z0 + (1 - k) * 0.03, "steel", 0.004)  # steps
    box(0.14, 0.08, 0.1, -0.95, front + 0.04, Z0 + 0.3, "white", 0.01)                                   # air conditioner
    dish(-0.55, -0.35, Z0 + 0.55, 0.1)
    lattice_mast(1.2, -0.75, Z0, 1.0)
    generator(1.25, -0.2); drums(-1.35, 0.7); crates(-1.3, -1.25)
    cyl(0.16, 0.28, -1.3, -0.35, Z0, "olive_dk", 18, 0.01)                                                # water tank
    sandbags(0.45, 0.85, 0.32, 0.22, Z0, n=8, gap_at=-math.pi / 2)
    fence()
    box(0.02, 0.3, 0.02, 1.86, 1.12, Z0 + 0.2, "yellow_band", 0.003)                                     # pole barrier
    flags(-0.2, 0.95, 1, 1.0)

def hq_3(rnd):
    """Garrison HQ hut: single-storey block with a metal gable roof, guard booth, two flags."""
    hq_ground("grass")
    box(0.24, 1.0, 0.012, 0.5, 0.58, Z0, "asphalt", 0.003)                                               # path to the door
    gate(x0=0.38)
    zr, front, side = hq_block(-0.15, -0.35, 2.3, 1.1, 1, rnd, roof="gable", door_x=0.5)
    cyl(0.03, 0.2, -0.9, -0.35, zr + 0.1, "steel", 8, 0)                                                  # chimney
    lattice_mast(-1.45, -1.35, Z0, 1.0)
    flags(-0.55, 0.85, 2, 0.95)
    fence()
    trees([(-1.6, 1.55, 0.9), (1.55, 1.6, 0.8), (-1.55, 0.6, 0.8), (1.5, -1.4, 0.8)])

def hq_4(rnd):
    """Battalion HQ: two-storey concrete block, three flags, lattice radio mast."""
    hq_ground("grass")
    box(0.24, 1.0, 0.012, 0.45, 0.6, Z0, "asphalt", 0.003)
    gate(x0=0.33)
    zr, front, side = hq_block(-0.15, -0.4, 2.5, 1.3, 2, rnd, door_x=0.45)
    for i in range(2): box(0.24, 0.24, 0.1, -0.9 + i * 0.3, -0.6, zr, "steel", 0.01); cyl(0.08, 0.01, -0.9 + i * 0.3, -0.6, zr + 0.1, "black", 16, 0)
    lattice_mast(-1.5, -1.45, Z0, 1.25)
    flags(-0.55, 0.85, 3, 1.0)
    fence()
    lamps([(-0.05, 1.05), (1.15, 0.6)])
    trees([(-1.6, 1.55, 0.9), (1.55, 1.6, 0.8), (-1.6, 0.55, 0.8), (1.5, -1.45, 0.8), (-0.9, 1.55, 0.7)])

def hq_5(rnd):
    """Brigade HQ: two-storey L-shaped block, dishes on the roof, lawn and lamps."""
    hq_ground("grass")
    box(0.24, 1.0, 0.012, 0.45, 0.6, Z0, "asphalt", 0.003)
    gate(x0=0.33)
    zr, front, side = hq_block(0.1, -0.55, 2.6, 1.15, 2, rnd, door_x=0.45)
    hq_block(-0.85, 0.42, 0.9, 0.85, 2, rnd)                                                              # front wing of the L
    dish(0.9, -0.45, zr, 0.12, 0.8); dish(1.15, -0.8, zr, 0.1, 0.2)
    for i in range(3): box(0.22, 0.22, 0.09, -0.6 + i * 0.28, -0.75, zr, "steel", 0.01); cyl(0.07, 0.01, -0.6 + i * 0.28, -0.75, zr + 0.09, "black", 16, 0)
    lattice_mast(-0.25, -0.6, zr, 1.0)
    flags(0.0, 1.2, 3, 1.0)
    fence()
    lamps([(0.2, 0.75), (1.15, 0.65), (-0.35, 1.5)])
    trees([(-1.6, 1.6, 0.9), (1.55, 1.62, 0.8), (-0.75, 1.5, 0.75), (1.55, -1.5, 0.8), (-1.55, -1.45, 0.8)])

def hq_modern(level, rnd):
    """Levels 6–10. Reference: US Army III Corps HQ, Fort Hood (aerial photo, 1995, public domain):
    two 3-storey wings swept back in a shallow V, a glass atrium where they meet, ribbon windows,
    flat roofs with square skylights, a circular drive with a round flag plaza in front.
    6 = one wing · 7 = both wings · 8 = + wall, watchtowers, helipad, radar tower · 9 = + bunker, antenna farm · 10 = + rear wings, floodlights, guard of honour."""
    z0 = Z0
    hq_ground("grass")
    if level < 10:                                                                                    # car park behind the building
        w = 3.2 if level < 8 else 1.7
        box(w, 0.62, 0.012, -0.15 if level < 8 else 0, -1.55, z0, "asphalt", 0.003)
        for i in range(int(w / 0.3)): box(0.02, 0.2, 0.004, -w / 2 + 0.15 + i * 0.3 + (-0.15 if level < 8 else 0), -1.42, z0 + 0.012, "white", 0)
    gate()
    # ---- circular drive with the flag plaza
    px, py = 0.0, 1.12
    cyl(0.78, 0.012, px, py, z0, "asphalt", 48, 0)
    cyl(0.57, 0.016, px, py, z0, "concrete", 48, 0)                                                 # kerb
    cyl(0.55, 0.018, px, py, z0, "grass", 48, 0)
    cyl(0.3, 0.024, px, py, z0, "concrete", 40, 0)
    box(0.16, 0.95, 0.022, 0, 0.55, z0, "concrete", 0.004)                                          # walkway to the entrance
    flags(px, py - 0.05, 1 if level == 6 else 3, 1.0)
    # ---- wings
    ang = math.radians(15)
    rw, zr = hq_wing(0.38, -0.27, 1, ang, rnd)
    def on_roof(piv, fn):                                                                        # build in the wing's local space
        before = set(bpy.context.scene.objects); fn()
        for o in set(bpy.context.scene.objects) - before: o.parent = piv
    def right_roof():                                                                            # comms mast and two dishes
        lattice_mast(0.88, 0, zr, 1.15); dish(0.2, 0.14, zr, 0.11, 0.7); dish(0.62, -0.14, zr, 0.11, -0.3)
    on_roof(rw, right_roof)
    if level >= 7:
        lw, _ = hq_wing(-0.38, -0.27, -1, ang, rnd)
        def left_roof():                                                                         # radome and air-conditioning units
            box(0.36, 0.36, 0.08, -0.8, 0, zr, "concrete_dk", 0.015); sphere(0.2, -0.8, 0, zr + 0.08, "white", half=True)
            for i in range(3):
                box(0.17, 0.17, 0.08, -0.15 - i * 0.2, -0.12, zr, "steel", 0.01); cyl(0.06, 0.01, -0.15 - i * 0.2, -0.12, zr + 0.08, "black", 16, 0)
        on_roof(lw, left_roof)
    if level >= 10:
        hq_wing(0.38, -0.27, 1, math.radians(75), rnd); hq_wing(-0.38, -0.27, -1, math.radians(75), rnd)
    # ---- glass atrium where the wings meet
    ay, AD, AW, AH = -0.13, 0.66, 0.84, 1.22
    af = ay + AD / 2
    box(AW, AD, AH, 0, ay, z0, "glass", 0.01)
    for i in range(7): box(0.035, 0.035, AH, -AW / 2 + 0.02 + i * (AW - 0.04) / 6, af, z0, "hq_wall", 0.004)   # mullions
    for k in range(1, 3): box(AW + 0.01, 0.04, 0.025, 0, af, z0 + k * 0.34 + 0.06, "hq_wall", 0.004)      # floor lines
    for sx in (-1, 1): box(0.05, AD, AH, sx * AW / 2, ay, z0, "hq_wall", 0.008)
    box(AW + 0.1, AD + 0.08, 0.05, 0, ay, z0 + AH, "hq_red", 0.01)                                  # roof slab
    box(0.36, 0.28, 0.05, 0, ay, z0 + AH + 0.05, "glass", 0.005)                                    # atrium skylight
    for i in range(3): box(0.36, 0.03, 0.03, 0, ay - 0.1 + i * 0.1, z0 + AH + 0.08, "hq_wall", 0)
    box(0.6, 0.36, 0.045, 0, af + 0.16, z0 + 0.42, "hq_red", 0.01)                                  # entrance canopy
    for sx in (-1, 1): box(0.04, 0.04, 0.42, sx * 0.26, af + 0.31, z0, "white", 0.006)
    box(0.34, 0.03, 0.3, 0, af + 0.012, z0, "black", 0.004)
    box(0.015, 0.035, 0.3, 0, af + 0.02, z0, "white", 0)
    box(0.44, 0.02, 0.07, 0, af + 0.345, z0 + 0.43, "white", 0.004)                                  # name plate
    sphere(0.03, 0, af + 0.36, z0 + 0.465, mat("gold", 0.3, 0.8))
    for sx in (-1, 1): sphere(0.022, sx * 0.24, af + 0.33, z0 + 0.41, mat("glass_lit", 0.3, 0, 3.0))
    # ---- lamps
    for a in (0.35, 2.75, 3.6, 5.8):
        lamp(px + math.cos(a) * 0.86, py + math.sin(a) * 0.86, 0.6)
    if level < 8:
        fence()
        trees([(-1.7, 1.75, 1.0), (-1.75, 1.1, 0.9), (-1.6, 0.45, 0.8), (1.75, 1.75, 0.9), (1.72, 0.55, 0.85),
               (-1.75, -1.05, 0.8), (1.7, -1.0, 0.8), (-0.95, 0.5, 0.7), (0.95, 0.5, 0.7)])
        for i in range(6): box(0.28, 0.14, 0.12, -1.0 + i * 0.4, -1.75, z0, "sandbag", 0.04)
        return
    # ---- level 8+: wall, watchtowers, helipad, radar tower
    perimeter_wall()
    watchtower(-1.66, -1.66); watchtower(1.66, -1.66)
    hx, hy = -1.34, 1.3
    cyl(0.5, 0.03, hx, hy, z0, "asphalt", 40, 0)
    cyl(0.44, 0.032, hx, hy, z0, "white", 40, 0); cyl(0.4, 0.034, hx, hy, z0, "asphalt", 40, 0)
    box(0.06, 0.28, 0.006, hx - 0.1, hy, z0 + 0.034, "white", 0); box(0.06, 0.28, 0.006, hx + 0.1, hy, z0 + 0.034, "white", 0)
    box(0.2, 0.06, 0.006, hx, hy, z0 + 0.034, "white", 0)
    for k in range(10):
        a = k / 10 * math.tau; sphere(0.022, hx + math.cos(a) * 0.48, hy + math.sin(a) * 0.48, z0 + 0.035, mat("accent", 0.4, 0, 2.5))
    rx, ry = 1.42, 0.55
    for sx in (-1, 1):
        for sy in (-1, 1): cyl(0.013, 0.62, rx + sx * 0.1, ry + sy * 0.1, z0, "steel", 6, 0)
    for k in range(3): box(0.24, 0.24, 0.012, rx, ry, z0 + 0.15 + k * 0.17, "steel", 0)
    box(0.32, 0.32, 0.04, rx, ry, z0 + 0.62, "concrete_dk", 0.006)
    sphere(0.17, rx, ry, z0 + 0.66, "white")
    trees([(-1.6, 0.4, 0.8), (-0.95, 0.5, 0.7), (0.92, 0.45, 0.7), (1.5, 1.65, 0.75)] + ([] if level >= 9 else [(1.15, -1.2, 0.8)]))
    if level < 9: return
    # ---- level 9+: underground command bunker, antenna farm
    bx, by = 1.1, -1.2
    box(0.7, 0.7, 0.2, bx, by, z0, "grass", 0.08)                                                      # earth-covered mound
    for v in (-0.15, 0.15): cyl(0.035, 0.12, bx - 0.1, by + v, z0 + 0.2, "steel", 10, 0.005); box(0.09, 0.09, 0.02, bx - 0.1, by + v, z0 + 0.32, "steel", 0.003)
    box(0.08, 0.46, 0.26, bx + 0.36, by, z0, "concrete", 0.01)                                          # portal
    box(0.03, 0.3, 0.2, bx + 0.4, by, z0, "gunmetal", 0.004)                                            # blast door
    for i in range(5): box(0.02, 0.06, 0.03, bx + 0.41, by - 0.12 + i * 0.06, z0 + 0.22, "yellow_band" if i % 2 == 0 else "black", 0)
    for sy in (-1, 1): box(0.42, 0.05, 0.1, bx + 0.6, by + sy * 0.2, z0, "concrete", 0.008)          # ramp walls
    box(0.42, 0.34, 0.006, bx + 0.6, by, z0, "asphalt", 0.002)
    ax, ay2 = -1.2, -1.15
    for (dx, dy, h) in ((-0.2, -0.15, 1.75), (0.2, -0.2, 1.5), (0.15, 0.22, 1.9), (-0.22, 0.2, 1.6)):
        cyl(0.018, h, ax + dx, ay2 + dy, z0, "steel", 6, 0); sphere(0.02, ax + dx, ay2 + dy, z0 + h, mat("red_light", 0.4, 0, 3.0))
    cyl(0.02, 1.6, ax, ay2, z0, "steel", 6, 0)                                                          # log-periodic antenna
    for k in range(6): box(0.04, 0.5 - k * 0.07, 0.016, ax, ay2, z0 + 1.1 + k * 0.08, "steel", 0)
    box(0.24, 0.18, 0.16, ax + 0.3, ay2 - 0.45, z0, "hq_wall", 0.01)                                   # equipment hut
    if level < 10: return
    # ---- level 10: floodlights and a guard of honour
    for (x, y) in ((-1.7, 0.2), (1.72, 1.7), (0.9, -1.75), (-0.5, -1.75)):
        cyl(0.018, 1.25, x, y, z0, "steel", 8, 0)
        box(0.16, 0.06, 0.08, x, y, z0 + 1.25, "gunmetal", 0.008)
        box(0.14, 0.015, 0.06, x, y + 0.035, z0 + 1.26, mat("glass_lit", 0.3, 0, 4.0), 0)
    for i in range(5): soldier(-0.24 + i * 0.12, py + 0.4, 0)

HQ_LEVELS = {1: hq_1, 2: hq_2, 3: hq_3, 4: hq_4, 5: hq_5}

def hq_level(level):
    import random
    rnd = random.Random(7)
    (HQ_LEVELS.get(level) or (lambda r: hq_modern(level, r)))(rnd)

# ---------------------------------------------------------------- Builder Yard (2×2, 1 level)
def half_cyl(r, L, x, y, z, m, seg=24):
    """Half cylinder lying along x, flat side down (Quonset hut shell)."""
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=L, vertices=seg, location=(x, y, z), rotation=(0, math.pi / 2, 0))
    o = bpy.context.object; bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    bm = bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0, 0), plane_no=(0, 0, 1), clear_inner=True)
    bmesh.ops.holes_fill(bm, edges=[e for e in bm.edges if e.is_boundary], sides=0)
    bm.to_mesh(o.data); bm.free()
    return _finish(o, mat(m) if isinstance(m, str) else m, 0, smooth=True)

def builder_1(rnd):
    """Builder Yard. Reference: Seabee / army engineer construction yard: a Quonset hut workshop
    (half-round corrugated steel), a crawler crane with a lattice boom, stacked materials, cement mixer."""
    z0 = 0.08
    box(1.95, 1.95, 0.08, m="concrete_dk", bevel=0.03)
    box(1.82, 1.82, 0.01, 0, 0, 0.07, "sand", 0.004)                                                  # gravel yard
    # ---- Quonset hut workshop, door end facing +x
    hx, hy, L, r = -0.43, -0.45, 0.9, 0.36
    box(L + 0.06, 2 * r + 0.06, 0.03, hx, hy, z0, "concrete", 0.008)                                  # slab
    half_cyl(r, L, hx, hy, z0 + 0.03, "steel")
    for i in range(10): half_cyl(r + 0.008, 0.018, hx - L / 2 + 0.04 + i * (L - 0.08) / 9, hy, z0 + 0.03, "gunmetal", 20)   # corrugation ribs
    half_cyl(r - 0.01, 0.03, hx + L / 2, hy, z0 + 0.03, "hq_wall")                                    # end wall
    box(0.03, 0.3, 0.26, hx + L / 2 + 0.02, hy, z0 + 0.03, "gunmetal", 0.004)                          # roller door
    for k in range(5): box(0.034, 0.3, 0.008, hx + L / 2 + 0.022, hy, z0 + 0.07 + k * 0.05, "steel", 0)
    box(0.03, 0.09, 0.07, hx + L / 2 + 0.02, hy + 0.24, z0 + 0.16, "glass_lit", 0.003)
    box(0.036, 0.2, 0.05, hx + L / 2 + 0.025, hy, z0 + 0.3, "yellow_band", 0.003)                     # sign over the door
    for k in range(2):                                                                                   # roof vents
        cyl(0.03, 0.06, hx - 0.25 + k * 0.5, hy, z0 + 0.03 + r - 0.01, "gunmetal", 10, 0.005)
    # ---- crawler crane: tracks, slewing upper with cab and counterweight, lattice boom over the yard, load on the hook
    cz = z0
    bpy.ops.object.empty_add(location=(0.6, -0.5, 0)); crane = bpy.context.object
    parts = []
    for sy in (-1, 1):                                                                                   # crawler tracks
        parts.append(box(0.46, 0.1, 0.09, 0, sy * 0.15, cz + 0.005, "black", 0.02))
        for k in range(5): parts.append(box(0.012, 0.104, 0.092, -0.2 + k * 0.1, sy * 0.15, cz + 0.004, "gunmetal", 0))
        for ex in (-0.22, 0.22): parts.append(box(0.06, 0.09, 0.06, ex, sy * 0.15, cz + 0.02, "gunmetal", 0.02))
    parts.append(box(0.26, 0.22, 0.05, 0, 0, cz + 0.08, "gunmetal", 0.01))                              # carbody
    parts.append(box(0.4, 0.28, 0.17, -0.06, 0, cz + 0.13, "olive", 0.02))                              # upper works / engine house
    parts.append(box(0.36, 0.24, 0.02, -0.08, 0, cz + 0.3, "olive_dk", 0.005))
    for k in range(4): parts.append(box(0.012, 0.004, 0.08, -0.2 + k * 0.04, -0.142, cz + 0.17, "black", 0))   # engine louvres
    parts.append(box(0.1, 0.3, 0.15, -0.3, 0, cz + 0.13, "olive_dk", 0.02))                             # counterweight
    parts.append(box(0.13, 0.1, 0.15, 0.12, 0.15, cz + 0.13, "olive", 0.015))                            # cab
    parts.append(box(0.012, 0.08, 0.09, 0.185, 0.15, cz + 0.18, "glass", 0.002))
    parts.append(box(0.09, 0.012, 0.08, 0.12, 0.2, cz + 0.18, "glass", 0.002))
    for sy in (-1, 1): parts.append(box(0.025, 0.025, 0.28, -0.14, sy * 0.08, cz + 0.3, "gold", 0.004))   # gantry (A-frame)
    parts.append(box(0.04, 0.2, 0.03, -0.14, 0, cz + 0.58, "gold", 0.004))
    # boom: pivot at its foot, pitched 55° up, built along local +x
    foot, BL, el = (0.12, 0, cz + 0.27), 1.05, math.radians(55)
    bpy.ops.object.empty_add(location=foot); boom = bpy.context.object
    bparts = []
    for (dy, dz) in ((-0.045, 0), (0.045, 0), (-0.045, 0.07), (0.045, 0.07)):
        bparts.append(box(BL, 0.014, 0.014, BL / 2, dy, dz - 0.035, "gold", 0))
    n = 10
    for k in range(n + 1):
        x = 0.05 + k * (BL - 0.1) / n
        bparts.append(box(0.01, 0.09, 0.01, x, 0, -0.035, "gold", 0)); bparts.append(box(0.01, 0.09, 0.01, x, 0, 0.035, "gold", 0))
        for dy in (-0.045, 0.045): bparts.append(box(0.01, 0.01, 0.07, x, dy, -0.035, "gold", 0))
    bparts.append(cyl(0.035, 0.1, BL, -0.05, -0.035, "gunmetal", 12, 0, rx=math.pi / 2))                 # tip sheave
    for o in bparts: o.parent = boom
    boom.rotation_euler = (0, -el, 0); boom.parent = crane
    tip = (foot[0] + BL * math.cos(el), 0, foot[2] + BL * math.sin(el))
    gtop = (-0.14, 0, cz + 0.6)
    dx, dz = tip[0] - gtop[0], tip[2] - gtop[2]; d = math.hypot(dx, dz)
    for sy in (-0.03, 0.03):                                                                               # pendant lines gantry → boom tip
        ln = box(d, 0.005, 0.005, (gtop[0] + tip[0]) / 2, sy, (gtop[2] + tip[2]) / 2 - 0.0025, "black", 0)
        ln.rotation_euler = (0, -math.atan2(dz, dx), 0); parts.append(ln)
    loadz = cz + 0.42
    parts.append(box(0.005, 0.005, tip[2] - loadz - 0.06, tip[0], 0, loadz + 0.06, "black", 0))           # hoist line
    parts.append(box(0.05, 0.04, 0.05, tip[0], 0, loadz + 0.02, "yellow_band", 0.004))                    # hook block
    parts.append(box(0.22, 0.2, 0.012, tip[0], 0, loadz - 0.07, "wood", 0.002))                           # load: pallet of blocks
    for i in range(3): parts.append(box(0.065, 0.18, 0.055, tip[0] - 0.07 + i * 0.07, 0, loadz - 0.058, "concrete", 0.005))
    for o in parts: o.parent = crane
    crane.rotation_euler = (0, 0, math.radians(135))
    # ---- materials: concrete blocks, timber, rebar, steel beams, sand pile, cement mixer
    for i in range(2):                                                                                      # pallets of concrete blocks
        bx, by = 0.2 + i * 0.3, 0.55
        box(0.24, 0.24, 0.02, bx, by, z0, "wood", 0.003)
        for lx in range(2):
            for lz in range(3 - i): box(0.11, 0.22, 0.06, bx - 0.055 + lx * 0.115, by, z0 + 0.02 + lz * 0.062, "concrete", 0.006)
    for k in range(4): box(0.6, 0.06, 0.035, -0.55, 0.32 + (k % 2) * 0.07, z0 + (k // 2) * 0.037, "wood", 0.004)   # timber
    for k in range(3): box(0.6, 0.06, 0.035, -0.55, 0.36, z0 + 0.074 + k * 0.037, "wood", 0.004)
    for k in range(7): cyl(0.008, 0.7, -0.55, 0.6 + (k % 4) * 0.022, z0 + 0.008 + (k // 4) * 0.016, "rust", 6, 0, ry=math.pi / 2)  # rebar bundle
    for k in range(3):                                                                                       # steel I-beams
        y = 0.82 + k * 0.035
        box(0.7, 0.03, 0.006, -0.5, y, z0, "gunmetal", 0); box(0.7, 0.006, 0.03, -0.5, y, z0, "gunmetal", 0); box(0.7, 0.03, 0.006, -0.5, y, z0 + 0.03, "gunmetal", 0)
    cyl(0.2, 0.16, 0.65, 0.05, z0, "sand", 20, 0.02, r2=0.02)                                             # sand pile
    mx, my = 0.68, 0.48                                                                                       # cement mixer on its stand
    for sx in (-1, 1): box(0.02, 0.14, 0.12, mx + sx * 0.07, my, z0, "gunmetal", 0.003)
    drum = cyl(0.07, 0.16, mx, my, z0 + 0.06, "olive", 16, 0.01, r2=0.035); drum.rotation_euler = (math.radians(-55), 0, 0)
    # ---- tool chests, safety barrier
    box(0.16, 0.1, 0.09, 0.3, -0.05, z0, "olive", 0.01); box(0.16, 0.1, 0.012, 0.3, -0.05, z0 + 0.09, "black", 0.003)
    box(0.16, 0.1, 0.09, 0.3, 0.1, z0, "olive_dk", 0.01)
    for i in range(3): cyl(0.012, 0.11, 0.15 + i * 0.25, 0.88, z0, "black", 6, 0)                     # safety barrier posts
    for i in range(2):
        for k in range(4): box(0.0625, 0.012, 0.025, 0.15 + i * 0.25 + 0.031 + k * 0.0625, 0.88, z0 + 0.08, "yellow_band" if k % 2 == 0 else "black", 0)

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
    o = bpy.context.object; o.scale = (1.15, 0.45, 0.5); bpy.ops.object.transform_apply(location=False, scale=True, rotation=True); _finish(o, mat("gold", 0.3, 0.8), 0.02)
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

BUILDERS = {**{f"hq_{n}": (lambda n=n: hq_level(n)) for n in range(1, 11)}, "builder_1": lambda: builder_1(__import__("random").Random(7)), "treasury": treasury, "def_hisara": sam_site}

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
    sizes = {**{f"hq_{n}": 4 for n in range(1, 11)}, "builder_1": 2, "treasury": 3, "def_hisara": 2}
    for i in ids:
        reset(); BUILDERS[i](); export(i); preview(i, sizes.get(i, 3)); print("built", i)
