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
    "rust": (0.42, 0.22, 0.12), "flame": (1.0, 0.5, 0.08), "red_light": (1.0, 0.12, 0.08), "green_light": (0.2, 1.0, 0.3), "red_band": (0.70, 0.12, 0.08), "yellow_band": (0.95, 0.75, 0.10),
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
    n = max(6, round(2 * e / 0.31))
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

def gate(gx=1.62, gy=1.12, x0=0.7, edge=1.96):
    """Road from x0 to the +x edge with a guard booth, boom barrier and concrete blocks."""
    box(edge - x0, 0.24, 0.012, (x0 + edge) / 2, gy, Z0, "asphalt", 0.003)
    for i in range(int((edge - 0.06 - x0) / 0.25)): box(0.12, 0.025, 0.004, x0 + 0.2 + i * 0.25, gy, Z0 + 0.012, "yellow_band", 0)
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

# ---------------------------------------------------------------- shared helpers for the other buildings
def plot(n, cover):
    """n×n tile plot: slab plus a ground layer; its top is at Z0 like the HQ."""
    box(n - 0.08, n - 0.08, 0.1, m="concrete_dk", bevel=0.04)
    box(n - 0.3, n - 0.3, 0.015, 0, 0, 0.1, cover, 0.005)

def grouped(name, loc, fn, rz=0.0):
    """Run fn() (which builds in local space around the origin) and parent what it made to an empty
    called `name` at loc. Named empties are the moving parts the game will animate later."""
    bpy.ops.object.empty_add(location=loc); g = bpy.context.object; g.name = name
    before = set(bpy.context.scene.objects); fn()
    for o in set(bpy.context.scene.objects) - before:
        if o.parent is None and o is not g: o.parent = g
    g.rotation_euler = (0, 0, rz)
    return g

def wheel(x, y, r=0.07, w=0.05):
    cyl(r, w, x, y - w / 2, r, "black", 14, 0.005, rx=math.pi / 2)
    cyl(r * 0.5, w + 0.006, x, y - w / 2 - 0.003, r, "gunmetal", 10, 0, rx=math.pi / 2)

def htank(x, y, L, r, m="concrete", lift=0.06):
    """Horizontal cylindrical tank along x on two saddles."""
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=L, vertices=20, location=(x, y, Z0 + lift + r), rotation=(0, math.pi / 2, 0))
    _finish(bpy.context.object, mat(m), 0.015, smooth=True)
    for sx in (-1, 1): box(0.05, r * 1.5, lift + r * 0.6, x + sx * L * 0.32, y, Z0, "concrete_dk", 0.005)
    for sx in (-1, 1):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=20, ring_count=10, location=(x + sx * L / 2, y, Z0 + lift + r))
        o = bpy.context.object; o.scale = (0.35, 1, 1); _finish(o, mat(m), 0, smooth=True)

# ---------------------------------------------------------------- Radar Station (3×3, 4 levels)
def radar_1(rnd):
    """Field radar. Reference: P-18 'Spoon Rest' VHF radar: cabin on a two-axle trailer with a rotating
    frame of eight Yagi aerials on a mast above it; generator and sandbags beside it."""
    plot(3, "sand")
    for (x, y, sx, sy) in [(-1.0, 1.0, 0.5, 0.35), (1.05, -0.95, 0.4, 0.4)]: box(sx, sy, 0.008, x, y, Z0, "grass", 0.004)
    tx, ty = 0.1, -0.15                                                                                  # trailer
    box(1.05, 0.46, 0.05, tx, ty, Z0 + 0.11, "gunmetal", 0.008)
    for wx in (-0.3, -0.12): 
        for sy in (-1, 1): wheel(tx + wx, ty + sy * 0.26)
    for (jx, jy) in ((0.45, -0.2), (0.45, 0.2), (-0.45, -0.2), (-0.45, 0.2)): cyl(0.015, 0.12, tx + jx, ty + jy, Z0, "steel", 6, 0)   # levelling jacks
    box(0.3, 0.04, 0.03, tx + 0.65, ty, Z0 + 0.11, "gunmetal", 0.005)                                     # tow bar
    box(0.95, 0.46, 0.36, tx, ty, Z0 + 0.16, "olive", 0.02)                                                # equipment cabin
    box(0.97, 0.48, 0.03, tx, ty, Z0 + 0.52, "olive_dk", 0.006)
    box(0.16, 0.02, 0.28, tx + 0.3, ty + 0.235, Z0 + 0.17, "olive_dk", 0.004)                              # door
    for wx in (-0.25, 0.0): box(0.12, 0.02, 0.08, tx + wx, ty + 0.235, Z0 + 0.36, "glass_lit" if wx == 0 else "glass", 0.003)
    box(0.1, 0.06, 0.08, tx - 0.38, ty + 0.25, Z0 + 0.38, "white", 0.008)                                 # air conditioner
    for k in range(4): box(0.08, 0.03, 0.012, tx + 0.3, ty + 0.27, Z0 + 0.03 + k * 0.045, "steel", 0)     # step ladder
    cyl(0.035, 0.24, tx, ty, Z0 + 0.55, "steel", 10, 0.005)                                                # mast
    def yagis():
        box(0.05, 0.05, 0.05, 0, 0, 0, "gunmetal", 0.008)
        box(0.04, 0.96, 0.03, -0.05, 0, 0.08, "steel", 0.004)                                             # frame
        box(0.04, 0.96, 0.03, -0.05, 0, 0.32, "steel", 0.004)
        for sy in (-1, 1): box(0.03, 0.03, 0.27, -0.05, sy * 0.47, 0.07, "steel", 0.003)
        box(0.03, 0.03, 0.27, -0.05, 0, 0.07, "steel", 0.003)
        for row in range(2):
            for col in range(4):
                y, z = -0.36 + col * 0.24, 0.12 + row * 0.2
                box(0.55, 0.014, 0.014, 0.2, y, z, "steel", 0)                                            # boom
                for k in range(6): box(0.01, 0.17 - k * 0.012, 0.01, -0.02 + k * 0.09, y, z + 0.002, "white", 0)   # elements
    grouped("radar_rotor", (tx, ty, Z0 + 0.79), yagis, math.radians(25))
    generator(-0.9, -0.75); drums(-1.0, 0.35); crates(0.95, 0.7)
    sandbags(tx, ty, 1.08, 0.72, Z0, n=26, gap_at=0)                                                     # opening where the tow bar points

def planar_array(w=0.85, h=0.62, tilt=15):
    """Flat phased-array antenna face tilted back, on a short yoke (built facing +x)."""
    cyl(0.17, 0.08, 0, 0, 0, "gunmetal", 24, 0.01)                                                        # turntable
    box(0.22, 0.3, 0.12, 0, 0, 0.08, "olive_dk", 0.01)
    bpy.ops.object.empty_add(location=(0.02, 0, 0.2)); piv = bpy.context.object
    kids = [box(0.07, w, h, 0, 0, 0, "khaki", 0.01), box(0.02, w + 0.03, h + 0.03, -0.045, 0, -0.015, "olive_dk", 0.005)]
    for k in range(1, 6): kids.append(box(0.075, w - 0.04, 0.006, 0.002, 0, k * h / 6, "olive", 0))       # face grid
    for k in range(1, 8): kids.append(box(0.075, 0.006, h - 0.04, 0.002, -w / 2 + k * w / 8, 0.02, "olive", 0))
    for o in kids: o.parent = piv
    piv.rotation_euler = (0, math.radians(-tilt), 0)
    for sy in (-1, 1): box(0.03, 0.03, 0.4, -0.12, sy * 0.25, 0.14, "steel", 0.004).rotation_euler = (0, math.radians(-30), 0)  # back braces

def radar_2(rnd):
    """Mobile surveillance radar site. Reference: Lockheed Martin TPS-77 / AN/TPS-59 class: a flat phased-array
    face on a turntable, an operations shelter, generators, fenced compound."""
    plot(3, "sand")
    box(0.9, 0.24, 0.01, 0.95, 0.85, Z0, "khaki", 0.003)                                                   # gravel track in
    box(0.8, 0.7, 0.06, 0.35, -0.35, Z0, "concrete", 0.01)                                                 # antenna pad
    grouped("radar_rotor", (0.35, -0.35, Z0 + 0.06), planar_array, math.radians(20))
    container(-0.5, 0.45, 1.0, "khaki")                                                                    # operations shelter
    box(0.18, 0.03, 0.32, -0.15, 0.705, Z0 + 0.04, "gunmetal", 0.004)
    for x in (-0.75, -0.5): box(0.16, 0.03, 0.12, x, 0.705, Z0 + 0.26, "glass_lit" if x == -0.5 else "glass", 0.003)
    box(0.14, 0.08, 0.1, -0.88, 0.73, Z0 + 0.3, "white", 0.01)
    for k in range(2): box(0.24 - k * 0.05, 0.08, 0.03, -0.15, 0.75 + k * 0.07, Z0 + (1 - k) * 0.03, "steel", 0.004)
    for k in range(5): box(0.1, 0.06, 0.02, -0.05 + k * 0.1, 0.1 - k * 0.1, Z0, "black", 0.005)          # cable tray to the antenna
    generator(-0.9, -0.55); generator(-0.9, -0.9)
    htank(-0.35, -0.95, 0.5, 0.1, "olive_dk")                                                               # fuel tank
    lattice_mast(1.05, -1.0, Z0, 0.9)
    fence(gap=(0.72, 0.98), e=1.36)
    box(0.02, 0.26, 0.02, 1.36, 0.85, Z0 + 0.2, "yellow_band", 0.003)

def curved_reflector(w=1.0, h=0.55, depth=0.12, rows=13):
    """P-37 style reflector: horizontal slats on a vertical parabola, open toward +x."""
    for k in range(rows):
        t = k / (rows - 1) - 0.5
        box(0.02, w * (1 - 0.3 * abs(t)), 0.035, depth * (1 - 4 * t * t) * -1, 0, (t + 0.5) * h, "steel", 0.003)
    for sy in (-1, 0, 1): box(0.03, 0.03, h + 0.05, -0.16, sy * w * 0.35, 0, "gunmetal", 0.004)

def radar_3(rnd):
    """Fixed early-warning radar. Reference: P-37 'Bar Lock' / ARSR-type sites: a large curved reflector with its
    feed horn turning on an equipment cabin over a concrete plinth; operations block, generator house."""
    plot(3, "grass")
    box(1.0, 1.0, 0.03, 0.3, -0.3, Z0, "concrete", 0.006)
    box(1.0, 0.24, 0.012, 0.95, 0.85, Z0, "asphalt", 0.003)                               # access road
    box(0.24, 0.7, 0.012, 0.3, 0.45, Z0, "asphalt", 0.003)
    box(0.5, 0.5, 0.32, 0.3, -0.3, Z0 + 0.03, "concrete", 0.02)                                            # plinth
    box(0.12, 0.02, 0.2, 0.3, -0.04, Z0 + 0.03, "gunmetal", 0.004)
    def rotor():
        cyl(0.2, 0.05, 0, 0, 0, "gunmetal", 24, 0.01)
        box(0.42, 0.34, 0.24, 0.05, 0, 0.05, "olive", 0.02)                                                # equipment cabin
        box(0.02, 0.2, 0.08, 0.265, 0, 0.17, "glass", 0.002)
        bpy.ops.object.empty_add(location=(-0.12, 0, 0.29)); piv = bpy.context.object
        before = set(bpy.context.scene.objects); curved_reflector()
        for o in set(bpy.context.scene.objects) - before:
            if o.parent is None and o is not piv: o.parent = piv
        piv.rotation_euler = (0, math.radians(-12), 0)
        box(0.5, 0.025, 0.025, 0.2, 0, 0.42, "steel", 0.003).rotation_euler = (0, math.radians(-8), 0)    # feed arm
        box(0.07, 0.12, 0.08, 0.44, 0, 0.42, "gunmetal", 0.006)                                           # feed horn
    grouped("radar_rotor", (0.3, -0.3, Z0 + 0.35), rotor, math.radians(30))
    zr, front, side = hq_block(-0.55, 0.6, 1.1, 0.6, 1, rnd, door_x=-0.3)                                  # operations block
    dish(-0.85, 0.6, zr, 0.1, 0.5)
    hq_block(-0.85, -0.75, 0.6, 0.5, 1, rnd)                                                                # generator house
    for k in range(2): cyl(0.03, 0.2, -0.95 + k * 0.2, -0.82, Z0 + 0.5, "black", 8, 0)
    lattice_mast(1.0, -0.95, Z0, 1.1)
    fence(gap=(0.72, 0.98), e=1.36)
    lamps([(0.55, 0.3), (-1.0, 0.1)])
    trees([(1.05, 0.25, 0.75), (-1.15, 1.15, 0.7)])

def radar_4(rnd):
    """Long-range radar station. Reference: NATO air-defence sites with an AN/FPS-117 inside a white radome on a
    concrete tower, a two-storey operations building with a rotating IFF/secondary array on its roof, security wall."""
    plot(3, "grass")
    box(1.0, 0.24, 0.012, 0.95, 0.85, Z0, "asphalt", 0.003)
    box(0.24, 0.55, 0.012, 0.45, 0.55, Z0, "asphalt", 0.003)
    tx, ty = 0.4, -0.4                                                                                       # radome tower
    cyl(0.4, 0.06, tx, ty, Z0, "concrete_dk", 32, 0.01)
    cyl(0.34, 0.5, tx, ty, Z0 + 0.06, "concrete", 32, 0.01)
    for k in range(2): cyl(0.345, 0.025, tx, ty, Z0 + 0.22 + k * 0.2, "concrete_dk", 32, 0)
    box(0.14, 0.03, 0.22, tx + 0.22, ty + 0.235, Z0 + 0.06, "gunmetal", 0.004, rz=math.radians(45))      # door
    box(0.06, 0.03, 0.1, tx + 0.22, ty + 0.235, Z0 + 0.36, "glass", 0.002, rz=math.radians(45))
    cyl(0.4, 0.05, tx, ty, Z0 + 0.56, "concrete_dk", 32, 0.01)                                               # gallery
    for k in range(16):
        a = k / 16 * math.tau; cyl(0.006, 0.08, tx + math.cos(a) * 0.39, ty + math.sin(a) * 0.39, Z0 + 0.61, "steel", 4, 0)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.5, location=(tx, ty, Z0 + 0.96))         # geodesic radome (flat panels)
    _finish(bpy.context.object, mat("white", 0.5), 0)
    sphere(0.03, tx, ty, Z0 + 1.47, mat("red_light", 0.4, 0, 4.0))
    zr, front, side = hq_block(-0.55, 0.5, 1.15, 0.75, 2, rnd, door_x=-0.3)                                 # operations building
    grouped("radar_rotor_iff", (-0.75, 0.5, zr), lambda: planar_array(0.5, 0.3, 10), math.radians(-30))
    for i in range(2): box(0.18, 0.18, 0.08, -0.25 + i * 0.22, 0.4, zr, "steel", 0.01); cyl(0.06, 0.01, -0.25 + i * 0.22, 0.4, zr + 0.08, "black", 16, 0)
    hq_block(-0.85, -0.8, 0.6, 0.45, 1, rnd)                                                                  # generator house
    htank(-0.85, -1.15, 0.55, 0.1, "concrete")                                                               # fuel tank
    lattice_mast(-0.2, -1.05, Z0, 1.3)
    perimeter_wall(gap=(0.72, 0.98), e=1.38)
    lamps([(0.75, 0.25), (-1.1, 1.1)])
    trees([(1.0, 0.2, 0.7)])

# ---------------------------------------------------------------- Power Plant (3×3, 6 levels)
def genset(x, y, L=0.42, W=0.26, H=0.26, col="tan", rz=0, base=0.0):
    """Generator set in an acoustic enclosure: louvres on the sides, exhaust stack with rain cap, optional base fuel tank."""
    bpy.ops.object.empty_add(location=(x, y, 0)); g = bpy.context.object
    p = []
    if base: p.append(box(L + 0.04, W + 0.04, base, 0, 0, Z0, "gunmetal", 0.008))
    z = Z0 + base
    p.append(box(L, W, H, 0, 0, z, col, 0.012))
    for sy in (-1, 1):
        for k in range(4): p.append(box(L * 0.3, 0.012, 0.012, -L * 0.25, sy * (W / 2 + 0.004), z + 0.06 + k * (H - 0.1) / 3, "black", 0))
        p.append(box(0.1, 0.012, H * 0.6, L * 0.22, sy * (W / 2 + 0.004), z + H * 0.2, "olive_dk", 0.002))      # access door
    p.append(box(0.012, W * 0.7, H * 0.7, L / 2 + 0.004, 0, z + H * 0.15, "black", 0.002))                       # radiator grille
    p.append(cyl(0.022, 0.16, -L * 0.3, 0, z + H, "black", 10, 0)); p.append(cyl(0.032, 0.02, -L * 0.3, 0, z + H + 0.16, "gunmetal", 10, 0))
    p.append(box(0.08, 0.06, 0.03, L * 0.3, W / 2 - 0.05, z + H, "gunmetal", 0.004))
    for o in p: o.parent = g
    g.rotation_euler = (0, 0, rz)
    return g

def bund(x, y, sx, sy, h=0.07):
    box(sx, sy, 0.012, x, y, Z0, "concrete", 0.003)
    for (bx, by, w, d) in ((x, y + sy / 2, sx, 0.04), (x, y - sy / 2, sx, 0.04), (x + sx / 2, y, 0.04, sy), (x - sx / 2, y, 0.04, sy)):
        box(w, d, h, bx, by, Z0, "concrete", 0.006)

def transformer(x, y, s=1.0):
    box(0.26 * s, 0.2 * s, 0.24 * s, x, y, Z0 + 0.03, "gunmetal", 0.01)
    box(0.3 * s, 0.24 * s, 0.03, x, y, Z0, "concrete", 0.005)
    for k in range(5):
        for sy in (-1, 1): box(0.012, 0.05 * s, 0.18 * s, x - 0.1 * s + k * 0.05 * s, y + sy * 0.12 * s, Z0 + 0.06, "steel", 0)   # cooling fins
    for k in range(3):
        bx = x - 0.08 * s + k * 0.08 * s
        for j in range(3): cyl(0.022 - j * 0.002, 0.03, bx, y, Z0 + 0.27 * s + j * 0.03, "white", 10, 0.004)          # bushings
    box(0.1 * s, 0.08 * s, 0.06, x + 0.1 * s, y, Z0 + 0.27 * s, "gunmetal", 0.004)

def gantry(x, y, w=0.6, h=0.6, along="y"):
    """Substation steel gantry: two lattice legs and a crossbeam with hanging insulators."""
    for t in (-w / 2, w / 2):
        px, py = (x, y + t) if along == "y" else (x + t, y)
        for a in (-0.025, 0.025):
            for b in (-0.025, 0.025): cyl(0.007, h, px + a, py + b, Z0, "steel", 4, 0)
        for k in range(int(h / 0.1)): box(0.06, 0.06, 0.006, px, py, Z0 + 0.05 + k * 0.1, "steel", 0)
    box(0.04 if along == "y" else w + 0.06, w + 0.06 if along == "y" else 0.04, 0.04, x, y, Z0 + h, "steel", 0.003)
    for k in range(3):
        t = -w * 0.3 + k * w * 0.3
        px, py = (x, y + t) if along == "y" else (x + t, y)
        for j in range(3): cyl(0.016, 0.022, px, py, Z0 + h - 0.08 + j * 0.024, "white", 8, 0.003)

def pole_line(points, h=0.65):
    """Wooden power poles with cross-arms and wires between them."""
    for (x, y) in points:
        cyl(0.016, h, x, y, Z0, "wood", 8, 0); box(0.03, 0.22, 0.02, x, y, Z0 + h - 0.06, "wood", 0)
        for t in (-0.09, 0, 0.09): cyl(0.008, 0.025, x, y + t, Z0 + h - 0.04, "white", 6, 0)
    for (a, b) in zip(points, points[1:]):
        dx, dy = b[0] - a[0], b[1] - a[1]; d = math.hypot(dx, dy)
        for t in (-0.09, 0, 0.09):
            w = box(d, 0.004, 0.004, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + t, Z0 + h - 0.02, "black", 0); w.rotation_euler = (0, 0, math.atan2(dy, dx))

def power_hall(x, y, L, W, H, stacks, rnd, col="steel"):
    """Engine hall: corrugated steel sides, low gable roof, roll-up doors, a row of exhaust stacks with silencers."""
    box(L, W, H, x, y, Z0, col, 0.02)
    for k in range(int(L / 0.06)):
        for sy in (-1, 1): box(0.012, 0.01, H - 0.04, x - L / 2 + 0.04 + k * 0.06, y + sy * (W / 2 + 0.004), Z0 + 0.02, "gunmetal", 0)   # ribs
    prism(L + 0.06, W + 0.08, 0.12, x, y, Z0 + H, "hq_roof", 0, 0.008)
    for i in range(stacks):                                                                                   # doors on the +y side, between stacks
        dx = x - L / 2 + (i + 0.5) * L / stacks
        box(0.16, 0.02, 0.2, dx, y + W / 2 + 0.01, Z0, "gunmetal", 0.003)
        for k in range(4): box(0.165, 0.024, 0.006, dx, y + W / 2 + 0.012, Z0 + 0.03 + k * 0.045, "steel", 0)
        bpy.ops.mesh.primitive_cylinder_add(radius=0.05, depth=0.22, vertices=14, location=(dx, y - 0.05, Z0 + H + 0.2), rotation=(0, math.pi / 2, 0))
        _finish(bpy.context.object, mat("gunmetal"), 0.01, smooth=True)                                     # silencer
        cyl(0.03, H * 0.6 + 0.35, dx + 0.08, y - 0.05, Z0 + H, "black", 12, 0)                                # exhaust stack
        cyl(0.04, 0.02, dx + 0.08, y - 0.05, Z0 + H * 1.6 + 0.35, "black", 12, 0)
        for sx in (-1, 1): box(0.02, 0.02, 0.2, dx + sx * 0.08, y - 0.05, Z0 + H, "steel", 0)
    for k in range(3): box(0.012, 0.14, 0.04, x + L / 2 + 0.006, y - 0.2 + k * 0.2, Z0 + H - 0.1, "black", 0)  # vents on the end wall
    box(0.012, 0.16, 0.22, x + L / 2 + 0.006, y + 0.1, Z0, "olive_dk", 0.002)                                # personnel door

def radiators(x, y, n=2):
    """Remote radiator bank: fan units on a steel frame."""
    for i in range(n):
        box(0.3, 0.3, 0.2, x, y + i * 0.32, Z0, "steel", 0.01)
        for j in range(2): cyl(0.065, 0.012, x - 0.07 + j * 0.14, y + i * 0.32, Z0 + 0.2, "black", 16, 0)
        for j in range(2): cyl(0.012, 0.016, x - 0.07 + j * 0.14, y + i * 0.32, Z0 + 0.205, "gunmetal", 8, 0)

def chimney(x, y, h=1.6):
    cyl(0.16, 0.06, x, y, Z0, "concrete_dk", 20, 0.01)
    cyl(0.12, h, x, y, Z0 + 0.06, "concrete", 20, 0.01, r2=0.085)
    for k in range(2): cyl(0.09 - k * 0.005, 0.05, x, y, Z0 + h - 0.14 + k * 0.08, "red_band" if k == 0 else "white", 20, 0)
    sphere(0.025, x + 0.09, y, Z0 + h + 0.02, mat("red_light", 0.4, 0, 4.0))

def solar_rows(x, y, rows, n, w=0.22):
    for r in range(rows):
        for i in range(n):
            px, py = x + i * (w + 0.02), y + r * 0.3
            cyl(0.01, 0.1, px, py - 0.04, Z0, "steel", 6, 0)
            p = box(w, 0.2, 0.015, px, py, Z0 + 0.1, "glass", 0.003); p.rotation_euler = (math.radians(-28), 0, 0)
            box(w, 0.006, 0.016, px, py + 0.09, Z0 + 0.145, "steel", 0)

def battery_container(x, y):
    container(x, y, 0.8, "uav_grey")
    for k in range(3): box(0.14, 0.02, 0.32, x - 0.25 + k * 0.25, y + 0.255, Z0 + 0.08, "gunmetal", 0.003)
    box(0.12, 0.08, 0.1, x + 0.3, y, Z0 + 0.52, "white", 0.008)

def power_1(rnd):
    """Field power point. Reference: US Army AMMPS tactical generator sets: two skid-mounted gensets,
    a fuel pillow tank (bladder) in a sandbag berm, cable reels and a power distribution box."""
    plot(3, "sand")
    for (x, y, sx, sy) in [(-1.0, 1.0, 0.45, 0.35), (1.05, -1.0, 0.4, 0.35)]: box(sx, sy, 0.008, x, y, Z0, "grass", 0.004)
    for (x, y) in ((0.35, -0.35), (0.35, 0.25)):
        box(0.5, 0.32, 0.04, x, y, Z0, "gunmetal", 0.006)                                                   # skid
        genset(x, y, 0.44, 0.28, 0.26, "tan", base=0.04)
    sandbags(0.35, -0.05, 0.48, 0.72, Z0, n=18, gap_at=0)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.4, segments=24, ring_count=12, location=(-0.78, 0.35, Z0 + 0.04))  # fuel bladder
    o = bpy.context.object; o.scale = (0.85, 0.65, 0.16); _finish(o, mat("olive_dk", 0.8), 0, smooth=True)
    sandbags(-0.78, 0.35, 0.5, 0.4, Z0, n=14)
    for k in range(4): box(0.1, 0.02, 0.02, -0.4 + k * 0.1, 0.3 - k * 0.04, Z0, "black", 0.004)          # fuel hose
    box(0.18, 0.1, 0.22, 0.95, 0.65, Z0, "olive", 0.01)                                                     # distribution box
    box(0.12, 0.012, 0.12, 0.95, 0.705, Z0 + 0.06, "yellow_band", 0.002)
    for (x, y) in ((-0.8, -0.8), (-0.55, -0.85)):                                                          # cable reels
        bpy.ops.mesh.primitive_cylinder_add(radius=0.09, depth=0.08, vertices=16, location=(x, y, Z0 + 0.09), rotation=(math.pi / 2, 0, 0))
        _finish(bpy.context.object, mat("wood"), 0.006, smooth=True)
        bpy.ops.mesh.primitive_cylinder_add(radius=0.065, depth=0.085, vertices=16, location=(x, y, Z0 + 0.09), rotation=(math.pi / 2, 0, 0))
        _finish(bpy.context.object, mat("black"), 0, smooth=True)
    for k in range(5): box(0.12, 0.02, 0.02, 0.65 + k * 0.0, 0.25 + k * 0.1, Z0, "black", 0.004)            # cable to the box
    drums(-1.05, -0.3, 3); crates(1.0, -0.85)

def power_2(rnd):
    """Prime power compound. Reference: containerised / enclosed diesel gensets on base fuel tanks (e.g. Caterpillar,
    Cummins prime power units on forward bases), a switchgear shelter and a bulk fuel tank in a concrete bund."""
    plot(3, "sand")
    box(0.9, 0.24, 0.01, 0.95, 0.85, Z0, "khaki", 0.003)
    box(1.6, 0.9, 0.03, 0.15, -0.35, Z0, "concrete", 0.006)
    for y in (-0.6, -0.1): genset(0.15, y, 1.0, 0.36, 0.36, "tan", base=0.07)
    container(-0.75, 0.55, 0.7, "olive")                                                                     # switchgear shelter
    box(0.16, 0.03, 0.3, -0.55, 0.805, Z0 + 0.04, "gunmetal", 0.004)
    box(0.1, 0.03, 0.1, -0.55, 0.81, Z0 + 0.36, "yellow_band", 0.003)
    bund(0.45, 0.55, 0.85, 0.45); htank(0.45, 0.55, 0.65, 0.13, "olive_dk")
    for k in range(6): box(0.1, 0.06, 0.02, -0.55 + k * 0.05, 0.3 - k * 0.08, Z0, "black", 0.004)           # cable tray
    fence(gap=(0.72, 0.98), e=1.36)
    box(0.02, 0.26, 0.02, 1.36, 0.85, Z0 + 0.2, "yellow_band", 0.003)
    sandbags(-1.0, -0.9, 0.25, 0.18, Z0, n=8)

def power_3(rnd):
    """Diesel power station. Reference: base power plants with an engine hall, a row of exhaust stacks and silencers
    on the roof, remote radiator fans, horizontal fuel tanks in a bund and a step-up transformer."""
    plot(3, "grass")
    box(1.0, 0.24, 0.012, 0.95, 0.85, Z0, "asphalt", 0.003)
    box(2.4, 0.5, 0.012, 0.0, 0.62, Z0, "concrete", 0.003)
    power_hall(-0.15, -0.3, 1.5, 0.75, 0.5, 3, rnd)
    radiators(0.95, -0.55, 2)
    bund(-0.65, 0.75, 1.0, 0.55); htank(-0.65, 0.68, 0.8, 0.14, "concrete")
    transformer(0.45, 0.55)
    fence(gap=(0.72, 0.98), e=1.36)
    lamps([(0.15, 0.95)])
    trees([(-1.15, -1.15, 0.7)])

def power_4(rnd):
    """Power station with switchyard. As level 3 with a longer hall, two fuel tanks and an outdoor substation
    (transformers, steel gantries, insulators) feeding a pole line."""
    plot(3, "grass")
    box(1.0, 0.24, 0.012, 0.95, 0.85, Z0, "asphalt", 0.003)
    power_hall(-0.3, -0.45, 1.9, 0.75, 0.55, 4, rnd)
    radiators(1.0, -0.75, 2)
    bund(-0.75, 0.65, 1.15, 0.75)
    for y in (0.48, 0.82): htank(-0.75, y, 0.9, 0.12, "concrete")
    box(0.75, 0.75, 0.012, 0.6, 0.3, Z0, "sand", 0.003)                                                       # gravel switchyard
    transformer(0.4, 0.15); transformer(0.78, 0.15)
    gantry(0.6, 0.55, 0.6, 0.55, along="x")
    pole_line([(0.6, 0.62), (0.15, 1.15), (-0.45, 1.25)])
    fence(gap=(0.72, 0.98), e=1.36)
    lamps([(1.15, 0.45)])

def power_5(rnd):
    """Gas-turbine / combined plant. Reference: larger base plants with a two-bay turbine hall, a tall concrete
    exhaust chimney with aviation markings, a vertical fuel storage tank in a bund and a switchyard."""
    plot(3, "grass")
    box(1.0, 0.24, 0.012, 0.95, 0.85, Z0, "asphalt", 0.003)
    power_hall(-0.25, -0.45, 1.6, 0.85, 0.7, 3, rnd, "concrete")
    chimney(0.9, -0.85, 1.65)
    for k in range(2): box(0.35, 0.08, 0.08, 0.68 - k * 0.0, -0.75, Z0 + 0.3 + k * 0.2, "gunmetal", 0.008)   # flue duct to the chimney
    radiators(0.95, -0.3, 1)
    bund(-0.8, 0.7, 0.75, 0.75)
    cyl(0.3, 0.45, -0.8, 0.7, Z0, "concrete", 28, 0.01)                                                      # vertical storage tank
    cyl(0.31, 0.06, -0.8, 0.7, Z0 + 0.45, "concrete_dk", 28, 0.01, r2=0.05)
    for k in range(6): box(0.04, 0.012, 0.012, -0.5 + 0.0, 0.7, Z0 + 0.07 * k, "steel", 0)                   # ladder
    box(0.7, 0.6, 0.012, 0.55, 0.35, Z0, "sand", 0.003)
    transformer(0.4, 0.25); transformer(0.75, 0.25)
    gantry(0.58, 0.58, 0.6, 0.55, along="x")
    pole_line([(0.58, 0.64), (0.1, 1.2)])
    fence(gap=(0.72, 0.98), e=1.36)
    lamps([(1.15, 0.5), (-0.2, 0.95)])

def power_6(rnd):
    """Hardened plant with microgrid. Reference: earth-covered (bermed) power plant with concrete portal and stack vents,
    plus US Army base microgrids: solar arrays and battery-storage containers, switchyard, security wall."""
    plot(3, "grass")
    box(1.0, 0.24, 0.012, 0.95, 0.85, Z0, "asphalt", 0.003)
    box(1.5, 0.95, 0.4, -0.45, -0.75, Z0, "grass", 0.15)                                                      # earth-covered hall
    box(1.55, 0.08, 0.42, -0.45, -0.26, Z0, "concrete", 0.01)                                                # concrete front wall
    for i in range(3):
        dx = -0.95 + i * 0.5
        box(0.24, 0.03, 0.26, dx, -0.21, Z0, "gunmetal", 0.004)                                               # blast doors
        for k in range(5): box(0.025, 0.035, 0.03, dx - 0.1 + k * 0.05, -0.21, Z0 + 0.28, "yellow_band" if k % 2 == 0 else "black", 0)
        cyl(0.04, 0.3, dx, -0.8, Z0 + 0.38, "black", 12, 0); cyl(0.055, 0.025, dx, -0.8, Z0 + 0.68, "gunmetal", 12, 0)   # stack vents
    chimney(0.95, -0.95, 1.55)
    solar_rows(-1.15, 0.35, 3, 4)
    battery_container(0.85, -0.2)
    box(0.7, 0.55, 0.012, 0.75, 0.75, Z0, "sand", 0.003)
    transformer(0.6, 0.6); transformer(0.95, 0.6, 0.8)
    gantry(0.8, 0.95, 0.55, 0.5, along="x")
    perimeter_wall(gap=(0.72, 0.98), e=1.38)
    lamps([(0.15, 0.5)])

# ---------------------------------------------------------------- Treasury (3×3, 10 levels): produces Gold
def tri_wall(x, y0, dy, th, z):
    """Triangular end wall in the yz-plane at x (closes a sawtooth roof)."""
    me = bpy.data.meshes.new("tri"); me.from_pydata([(0, 0, 0), (0, dy, 0), (0, dy, th)], [], [(0, 1, 2)]); me.update()
    o = bpy.data.objects.new("tri", me); bpy.context.collection.objects.link(o); o.location = (x, y0, z)
    return _finish(o, mat("hq_wall"), 0)

def sawtooth_hall(x, y, L, W, H, teeth, rnd, col="hq_wall"):
    """Factory hall with a north-light sawtooth roof (glazing faces +y) and high strip windows."""
    box(L, W, H, x, y, Z0, col, 0.02)
    box(L + 0.03, W + 0.03, 0.06, x, y, Z0, "concrete_dk", 0.008)
    for k in range(int(L / 0.2)): box(0.14, 0.02, 0.1, x - L / 2 + 0.12 + k * 0.2, y + W / 2 + 0.006, Z0 + H - 0.16, "glass_lit" if rnd.random() < 0.3 else "glass", 0.002)
    for k in range(int(W / 0.2)): box(0.02, 0.14, 0.1, x + L / 2 + 0.006, y - W / 2 + 0.12 + k * 0.2, Z0 + H - 0.16, "glass", 0.002)
    dy, th = W / teeth, 0.15
    for i in range(teeth):
        y0 = y - W / 2 + i * dy
        box(L - 0.02, 0.02, th, x, y0 + dy - 0.01, Z0 + H, "glass_lit" if i % 2 else "glass", 0.002)
        pl = box(L, math.hypot(dy, th), 0.02, x, y0 + dy / 2, Z0 + H + th / 2 - 0.01, "hq_roof", 0.003)
        pl.rotation_euler = (math.atan2(th, dy), 0, 0)
        for ex in (x - L / 2, x + L / 2): tri_wall(ex, y0, dy, th, Z0 + H)

def portico(x, front, w, n, h):
    """Classical entrance: steps, a row of columns, architrave and a triangular pediment with a gold emblem."""
    for k in range(3): box(w + 0.12 - k * 0.05, 0.36 - k * 0.08, 0.025, x, front + 0.18 - k * 0.04, Z0 + k * 0.025, "white", 0.004)
    zc = Z0 + 0.075
    for i in range(n):
        cx = x - w / 2 + 0.05 + i * (w - 0.1) / (n - 1)
        box(0.08, 0.08, 0.025, cx, front + 0.22, zc, "white", 0.004)
        cyl(0.03, h - 0.05, cx, front + 0.22, zc + 0.025, "white", 14, 0.004)
        box(0.08, 0.08, 0.025, cx, front + 0.22, zc + h - 0.025, "white", 0.004)
    box(w + 0.06, 0.32, 0.07, x, front + 0.13, zc + h, "white", 0.006)
    prism(0.32, w + 0.06, 0.17, x, front + 0.13, zc + h + 0.07, "white", math.pi / 2, 0.006)
    sphere(0.035, x, front + 0.3, zc + h + 0.14, mat("gold", 0.3, 0.8))
    box(0.2, 0.02, 0.26, x, front + 0.005, Z0, "wood", 0.004)                                           # doors

def dome(x, y, z, r=0.3):
    cyl(r + 0.02, 0.05, x, y, z, "white", 32, 0.006)
    cyl(r, 0.16, x, y, z + 0.05, "white", 32, 0.006)
    for k in range(12):
        a = k / 12 * math.tau; box(0.02, 0.012, 0.09, x + math.cos(a) * r, y + math.sin(a) * r, z + 0.08, "glass", 0, rz=a + math.pi / 2)
    sphere(r - 0.01, x, y, z + 0.21, mat("gold_dk", 0.35, 0.85), half=True)
    cyl(0.05, 0.12, x, y, z + 0.2 + r - 0.02, "white", 12, 0.004)
    sphere(0.035, x, y, z + 0.34 + r - 0.02, mat("gold", 0.3, 0.8))

def vault_door(x, y, cz, r=0.12, face="x"):
    """Round steel vault door with a spoked handle, on a wall facing +x (or +y)."""
    rot = dict(ry=math.pi / 2) if face == "x" else dict(rx=math.pi / 2)
    d = 0.04
    ox, oy = (x + d / 2, y) if face == "x" else (x, y + d / 2)
    bpy.ops.mesh.primitive_cylinder_add(radius=r + 0.025, depth=d * 0.6, vertices=28, location=(ox - (0.01 if face == "x" else 0), oy - (0.01 if face == "y" else 0), cz),
                                        rotation=(rot.get("rx", 0), rot.get("ry", 0), 0))
    _finish(bpy.context.object, mat("concrete_dk"), 0.005, smooth=True)
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=d, vertices=28, location=(ox, oy, cz), rotation=(rot.get("rx", 0), rot.get("ry", 0), 0))
    _finish(bpy.context.object, mat("steel", 0.35, 0.8), 0.008, smooth=True)
    for k in range(3):
        sp = box(0.01, r * 1.3, 0.012, ox + (d / 2 + 0.01 if face == "x" else 0), oy + (d / 2 + 0.01 if face == "y" else 0), cz - 0.006, "gunmetal", 0)
        sp.rotation_euler = (k * math.pi / 3, 0, 0) if face == "x" else (0, k * math.pi / 3, math.pi / 2)
    for k in range(8):
        a = k / 8 * math.tau
        px, pz = math.cos(a) * r * 0.82, math.sin(a) * r * 0.82
        sphere(0.008, ox + (d / 2 if face == "x" else px), oy + (px if face == "x" else d / 2), cz + pz, "gunmetal")

def vault_bunker(x, y, w=0.6, d=0.55, h=0.38):
    """Strong room: massive concrete block with a round vault door on its +x face."""
    box(w, d, h, x, y, Z0, "concrete", 0.03)
    box(w + 0.06, d + 0.06, 0.05, x, y, Z0 + h, "concrete_dk", 0.01)
    box(0.04, d * 0.7, h * 0.85, x + w / 2 + 0.02, y, Z0, "concrete_dk", 0.006)
    vault_door(x + w / 2 + 0.04, y, Z0 + h * 0.45, 0.12)
    for sy in (-1, 1): sphere(0.018, x + w / 2 + 0.05, y + sy * d * 0.38, Z0 + h * 0.85, mat("red_light", 0.4, 0, 3.0))

def gold_stack(x, y, layers=3):
    box(0.26, 0.2, 0.02, x, y, Z0, "wood", 0.003)
    for l in range(layers):
        for i in range(3 - l % 2):
            box(0.07, 0.17, 0.035, x - 0.08 + i * 0.08 + (l % 2) * 0.04, y, Z0 + 0.02 + l * 0.036, mat("gold", 0.3, 0.8), 0.006)

def strongbox(x, y):
    box(0.16, 0.11, 0.1, x, y, Z0 + 0.12, "gunmetal", 0.008)
    box(0.165, 0.115, 0.012, x, y, Z0 + 0.2, mat("gold", 0.3, 0.8), 0.002)

def small_gate(gy=0.85, x0=0.5):
    gate(1.15, gy, x0, 1.46)

def treasury_level(level, rnd):
    if level == 1:
        # Field paymaster post: tent, awning over the pay table with a strongbox, sandbag guard post.
        plot(3, "sand")
        for (x, y, sx, sy) in [(-1.0, 1.0, 0.45, 0.35), (1.05, -1.0, 0.4, 0.35)]: box(sx, sy, 0.008, x, y, Z0, "grass", 0.004)
        tent(-0.35, -0.4, 1.0, 0.65, 0, "olive")
        for (px, py) in ((-0.1, 0.0), (0.7, 0.0), (-0.1, 0.55), (0.7, 0.55)): cyl(0.012, 0.36, px, py, Z0, "wood", 6, 0)
        box(0.9, 0.65, 0.015, 0.3, 0.27, Z0 + 0.36, "khaki", 0.004)                                       # awning
        box(0.5, 0.22, 0.03, 0.3, 0.25, Z0 + 0.12, "wood", 0.004)                                          # pay table
        for (lx, ly) in ((0.08, 0.17), (0.52, 0.17), (0.08, 0.33), (0.52, 0.33)): box(0.02, 0.02, 0.12, lx, ly, Z0, "wood", 0)
        box(0.14, 0.1, 0.07, 0.42, 0.25, Z0 + 0.15, "gunmetal", 0.006); box(0.145, 0.105, 0.01, 0.42, 0.25, Z0 + 0.22, mat("gold", 0.3, 0.8), 0.002)
        for i in range(3): cyl(0.02, 0.012 * (i + 1), 0.2 + i * 0.05, 0.25, Z0 + 0.15, mat("gold", 0.3, 0.8), 12, 0)   # coin piles
        sandbags(0.95, 0.75, 0.28, 0.28, Z0, n=9, gap_at=math.pi)
        soldier(0.95, 0.75)
        flags(-0.95, 0.5, 1, 0.9); crates(-1.0, -1.0); drums(0.95, -0.85, 2)
        return
    if level == 2:
        # Finance container with a walk-in safe, fenced.
        plot(3, "sand")
        box(0.9, 0.24, 0.01, 0.95, 0.85, Z0, "khaki", 0.003)
        container(-0.35, -0.3, 1.3, "khaki")
        box(0.18, 0.03, 0.32, 0.0, -0.045, Z0 + 0.04, "gunmetal", 0.004)
        for x in (-0.8, -0.45): box(0.16, 0.03, 0.12, x, -0.045, Z0 + 0.26, "glass_lit" if x == -0.45 else "glass", 0.003)
        box(0.24, 0.1, 0.03, 0.0, 0.0, Z0, "steel", 0.004)
        box(0.12, 0.012, 0.1, -0.2, -0.04, Z0 + 0.4, mat("gold", 0.3, 0.8), 0.002)                          # sign
        box(0.4, 0.4, 0.36, 0.75, -0.45, Z0, "gunmetal", 0.02)                                             # walk-in safe
        vault_door(0.95, -0.45, Z0 + 0.18, 0.1)
        gold_stack(0.75, 0.15, 2)
        sandbags(-0.9, 0.7, 0.28, 0.22, Z0, n=8, gap_at=0)
        fence(gap=(0.72, 0.98), e=1.36); box(0.02, 0.26, 0.02, 1.36, 0.85, Z0 + 0.2, "yellow_band", 0.003)
        flags(-0.3, 0.55, 1, 1.0)
        return
    if level == 3:
        # Garrison finance office: single-storey with gable roof, strong-room annex.
        plot(3, "grass")
        small_gate()
        box(0.22, 0.6, 0.012, 0.3, 0.45, Z0, "asphalt", 0.003)
        zr, front, side = hq_block(-0.25, -0.35, 1.7, 0.85, 1, rnd, roof="gable", door_x=0.3)
        vault_bunker(0.95, -0.45, 0.45, 0.5, 0.32)
        flags(-0.7, 0.55, 2, 0.95)
        fence(gap=(0.72, 0.98), e=1.36)
        trees([(-1.05, 1.05, 0.75), (1.05, 0.3, 0.7)])
        return
    if level == 4:
        # Finance office, two storeys, with a secure cash bay (roller door, dock, bollards).
        plot(3, "grass")
        small_gate()
        box(0.22, 0.5, 0.012, 0.0, 0.55, Z0, "asphalt", 0.003)
        zr, front, side = hq_block(-0.35, -0.4, 1.6, 0.85, 2, rnd, door_x=0.0)
        box(0.7, 0.75, 0.42, 0.85, -0.45, Z0, "concrete", 0.02)                                            # cash bay
        box(0.02, 0.36, 0.28, 1.21, -0.45, Z0 + 0.06, "gunmetal", 0.003)
        for k in range(6): box(0.024, 0.37, 0.006, 1.215, -0.45, Z0 + 0.08 + k * 0.045, "steel", 0)
        box(0.14, 0.5, 0.06, 1.28, -0.45, Z0, "concrete_dk", 0.006)                                        # dock
        for sy in (-1, 1): cyl(0.025, 0.14, 1.32, -0.45 + sy * 0.32, Z0, "yellow_band", 10, 0.004)
        flags(-0.8, 0.6, 3, 1.0)
        fence(gap=(0.72, 0.98), e=1.36)
        lamps([(0.45, 0.45)])
        trees([(-1.1, 1.1, 0.75)])
        return
    if level == 5:
        # Finance centre with a banknote printing annex (sawtooth roof).
        plot(3, "grass")
        small_gate()
        zr, front, side = hq_block(-0.45, -0.55, 1.6, 0.75, 2, rnd, door_x=-0.45)
        sawtooth_hall(0.75, -0.25, 0.85, 1.0, 0.4, 3, rnd)
        box(0.22, 0.45, 0.012, -0.45, 0.4, Z0, "asphalt", 0.003)
        gold_stack(0.75, 0.5, 2)
        flags(-1.0, 0.55, 3, 1.0)
        fence(gap=(0.72, 0.98), e=1.36)
        lamps([(0.1, 0.55)])
        trees([(-1.1, 1.1, 0.75), (-0.2, 1.1, 0.65)])
        return
    # ---- levels 6–10: mint works. Reference: US Mint Philadelphia / Denver and the Turkish State Mint (Darphane):
    # a long sawtooth-roofed coining and printing hall, an office or classical front building, strong rooms, security.
    plot(3, "grass")
    small_gate()
    L = 2.2 if level >= 9 else 1.8
    sawtooth_hall(-0.15 if level >= 9 else -0.3, -0.78, L, 0.75, 0.42, 3, rnd)
    if level == 6 or level == 7:
        zr, front, side = hq_block(-0.55, 0.4, 1.25, 0.65, 2, rnd, door_x=-0.55)
        flags(0.35, 0.55, 3, 1.0)
    else:
        zr, front, side = hq_block(-0.55, 0.35, 1.3, 0.65, 2, rnd)                                        # classical front building
        portico(-0.55, front, 0.7, 5, 0.45)
        if level >= 10: dome(-0.55, 0.35, zr)
        flags(0.35, 1.05, 3, 1.0)
    if level >= 7:
        vault_bunker(0.85, -0.05, 0.6, 0.5, 0.36)
        perimeter_wall(gap=(0.72, 0.98), e=1.38)
        watchtower(1.2, -1.2)
    else:
        fence(gap=(0.72, 0.98), e=1.36)
    if level >= 9:
        watchtower(-1.2, 1.2)
        gold_stack(0.55, -0.05, 3); gold_stack(0.55, 0.22, 2)
    lamps([(0.15, 0.95)] + ([(1.2, -0.6)] if level >= 8 else []))
    trees([(0.9, 0.45, 0.6)] if level < 7 else [])
    if level >= 10:
        for (x, y) in ((-1.25, -0.2), (1.25, 0.42), (0.25, -1.3)):
            cyl(0.018, 1.2, x, y, Z0, "steel", 8, 0)
            box(0.16, 0.06, 0.08, x, y, Z0 + 1.2, "gunmetal", 0.008)
            box(0.14, 0.015, 0.06, x, y + 0.035, Z0 + 1.21, mat("glass_lit", 0.3, 0, 4.0), 0)
        for i in range(3): soldier(-0.8 + i * 0.25, 1.25)

# ---------------------------------------------------------------- Oil Well (2×2, 10 levels): produces Petrol
def pump_jack(x, y, s=1.0, rz=0.0):
    """Beam pump ('nodding donkey'), built facing +x. Moving parts: pumpjack_beam (walking beam, rocks about y)
    and pumpjack_crank (cranks and counterweights, turn about y)."""
    def base():
        box(0.78 * s, 0.18 * s, 0.04 * s, -0.04 * s, 0, Z0, "gunmetal", 0.006)                            # skid
        for sy in (-1, 1):                                                                                  # Samson post
            for sx in (-1, 1):
                lg = box(0.025 * s, 0.025 * s, 0.4 * s, sx * 0.06 * s, sy * 0.05 * s, Z0 + 0.03 * s, "olive_dk", 0.003)
                lg.rotation_euler = (sy * math.radians(6), -sx * math.radians(9), 0)
        def beam():
            box(0.66 * s, 0.05 * s, 0.06 * s, 0.0, 0, -0.03 * s, "olive", 0.006)
            box(0.06 * s, 0.07 * s, 0.2 * s, 0.34 * s, 0, -0.14 * s, "khaki", 0.008)                       # horsehead
            box(0.04 * s, 0.07 * s, 0.05 * s, 0.37 * s, 0, 0.0, "khaki", 0.006)
            box(0.06 * s, 0.16 * s, 0.03 * s, -0.31 * s, 0, -0.04 * s, "olive_dk", 0.004)                   # equaliser
        return beam
    # a root empty so the whole unit can be placed/turned; the moving groups inside are named for animation
    bpy.ops.object.empty_add(location=(x, y, 0)); root = bpy.context.object; root.name = "pumpjack"
    before = set(bpy.context.scene.objects)
    grouped("pumpjack_beam", (0, 0, Z0 + 0.43 * s), base())
    sphere(0.025 * s, 0, 0, Z0 + 0.43 * s, "gunmetal")                                                       # saddle bearing
    cyl(0.006 * s, 0.26 * s, 0.37 * s, 0, Z0 + 0.12 * s, "black", 4, 0)                                    # bridle / polished rod
    cyl(0.035 * s, 0.1 * s, 0.37 * s, 0, Z0, "steel", 10, 0.004)                                           # wellhead
    for k in range(2): box(0.1 * s, 0.02 * s, 0.02 * s, 0.37 * s, 0, Z0 + 0.04 * s + k * 0.04 * s, "steel", 0.002)
    box(0.12 * s, 0.12 * s, 0.1 * s, -0.24 * s, 0, Z0 + 0.04 * s, "gunmetal", 0.008)                       # gear reducer
    box(0.1 * s, 0.08 * s, 0.07 * s, -0.43 * s, 0, Z0 + 0.04 * s, "olive_dk", 0.008)                       # motor
    def crank():
        for sy in (-1, 1):
            box(0.16 * s, 0.02 * s, 0.035 * s, -0.04 * s, sy * 0.08 * s, -0.0175 * s, "gunmetal", 0.003)
            box(0.09 * s, 0.025 * s, 0.07 * s, -0.11 * s, sy * 0.08 * s, -0.035 * s, "khaki", 0.006)       # counterweights
    grouped("pumpjack_crank", (-0.24 * s, 0, Z0 + 0.12 * s), crank)
    for sy in (-1, 1): box(0.012 * s, 0.012 * s, 0.3 * s, -0.31 * s, sy * 0.08 * s, Z0 + 0.12 * s, "steel", 0)   # pitman arms
    for o in set(bpy.context.scene.objects) - before:
        if o.parent is None and o is not root: o.parent = root
    root.rotation_euler = (0, 0, rz)

def vtank(x, y, r, h, m="concrete"):
    cyl(r, h, x, y, Z0, m, 28, 0.01)
    cyl(r + 0.005, 0.05, x, y, Z0 + h, m, 28, 0.006, r2=r * 0.25)
    cyl(r + 0.004, 0.012, x, y, Z0 + h * 0.5, "concrete_dk", 28, 0)
    for k in range(int(h / 0.05)): box(0.04, 0.008, 0.008, x + r + 0.01, y, Z0 + 0.03 + k * 0.05, "steel", 0)   # ladder
    for sy in (-1, 1): box(0.008, 0.008, h, x + r + 0.01, y + sy * 0.02, Z0, "steel", 0)

def hpipe(x0, x1, y, z, r=0.018, m="steel"):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=abs(x1 - x0), vertices=10, location=((x0 + x1) / 2, y, z), rotation=(0, math.pi / 2, 0))
    _finish(bpy.context.object, mat(m), 0, smooth=True)

def ypipe(x, y0, y1, z, r=0.018, m="steel"):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=abs(y1 - y0), vertices=10, location=(x, (y0 + y1) / 2, z), rotation=(math.pi / 2, 0, 0))
    _finish(bpy.context.object, mat(m), 0, smooth=True)

def column(x, y, r, h):
    """Distillation column: tall vessel on a skirt, platforms every so often, ladder, top vent."""
    cyl(r + 0.02, 0.08, x, y, Z0, "concrete_dk", 20, 0.006)
    cyl(r, h, x, y, Z0 + 0.08, "uav_grey", 20, 0.006)
    sphere(r, x, y, Z0 + 0.08 + h, "uav_grey", half=True)
    for k in range(1, int(h / 0.25) + 1):
        z = Z0 + 0.08 + k * 0.25
        cyl(r + 0.04, 0.012, x, y, z, "gunmetal", 20, 0)
        for j in range(8):
            a = j / 8 * math.tau; cyl(0.004, 0.06, x + math.cos(a) * (r + 0.035), y + math.sin(a) * (r + 0.035), z, "yellow_band", 4, 0)
    for sy in (-1, 1): box(0.006, 0.006, h, x + r + 0.012, y + sy * 0.018, Z0 + 0.08, "steel", 0)
    for k in range(int(h / 0.05)): box(0.012, 0.04, 0.005, x + r + 0.012, y, Z0 + 0.1 + k * 0.05, "steel", 0)
    cyl(0.012, 0.1, x, y, Z0 + 0.08 + h + r - 0.01, "steel", 8, 0)

def flare(x, y, h, big=False):
    cyl(0.03 if big else 0.02, h, x, y, Z0, "gunmetal", 10, 0)
    if big:
        for k in range(3):
            for sx in (-1, 1): box(0.006, 0.006, h * 0.6, x + sx * 0.08, y, Z0, "steel", 0).rotation_euler = (0, sx * math.radians(6), 0)
    box(0.06, 0.06, 0.03, x, y, Z0 + h, "black", 0.004)
    cyl(0.035 if big else 0.025, 0.12 if big else 0.08, x, y, Z0 + h + 0.03, mat("flame", 0.5, 0, 6.0), 10, 0, r2=0.0)
    sphere(0.02 if big else 0.015, x, y, Z0 + h + 0.05, mat("yellow_band", 0.5, 0, 6.0))

def separator(x, y):
    for sx in (-1, 1):
        for sy in (-1, 1): box(0.012, 0.012, 0.1, x + sx * 0.05, y + sy * 0.05, Z0, "steel", 0)
    cyl(0.07, 0.3, x, y, Z0 + 0.1, "concrete", 18, 0.008)
    sphere(0.07, x, y, Z0 + 0.4, "concrete", half=True)
    sphere(0.07, x, y, Z0 + 0.1, "concrete")

def derrick(x, y, h=1.2, b=0.17, t=0.05):
    """Drilling derrick: tapered lattice tower on a drill floor, crown block, doghouse."""
    box(0.44, 0.44, 0.12, x, y, Z0, "gunmetal", 0.008)
    zf = Z0 + 0.12
    for sx in (-1, 1):
        for sy in (-1, 1):
            dx, dy = sx * (b - t), sy * (b - t)
            lg = box(0.018, 0.018, math.sqrt(h * h + dx * dx + dy * dy), x + sx * (b + t) / 2, y + sy * (b + t) / 2, zf, "gold", 0)
            lg.rotation_euler = (sy * math.atan2(b - t, h), -sx * math.atan2(b - t, h), 0)
    for k in range(1, 8):
        z = k * h / 8; w = 2 * (b - (b - t) * z / h)
        box(w, 0.01, 0.01, x, y + w / 2, zf + z, "gold", 0); box(w, 0.01, 0.01, x, y - w / 2, zf + z, "gold", 0)
        box(0.01, w, 0.01, x + w / 2, y, zf + z, "gold", 0); box(0.01, w, 0.01, x - w / 2, y, zf + z, "gold", 0)
    box(0.12, 0.12, 0.06, x, y, zf + h, "gunmetal", 0.006)                                                  # crown block
    cyl(0.004, h - 0.25, x, y, zf + 0.2, "black", 4, 0)
    box(0.06, 0.05, 0.06, x, y, zf + 0.18, "yellow_band", 0.004)                                            # travelling block
    box(0.22, 0.16, 0.16, x - 0.05, y + 0.3, Z0, "olive", 0.01)                                             # doghouse
    box(0.012, 0.08, 0.06, x + 0.06, y + 0.3, Z0 + 0.08, "glass_lit", 0.002)
    for k in range(4): box(0.3, 0.035, 0.035, x - 0.35, y - 0.12 + k * 0.04, Z0, "steel", 0.004)           # pipe rack of drill pipe

def furnace(x, y):
    box(0.3, 0.22, 0.24, x, y, Z0, "gunmetal", 0.01)
    box(0.32, 0.24, 0.03, x, y, Z0 + 0.24, "olive_dk", 0.005)
    for k in range(3): box(0.06, 0.012, 0.04, x - 0.09 + k * 0.09, y + 0.115, Z0 + 0.04, mat("flame", 0.5, 0, 2.5), 0.002)   # burner ports
    cyl(0.04, 0.6, x + 0.08, y, Z0 + 0.27, "black", 12, 0, r2=0.03)

def gas_sphere(x, y, r=0.16):
    for k in range(6):
        a = k / 6 * math.tau; cyl(0.01, r + 0.06, x + math.cos(a) * r * 0.85, y + math.sin(a) * r * 0.85, Z0, "steel", 6, 0)
    sphere(r, x, y, Z0 + r + 0.07, "white")
    cyl(r * 0.9, 0.01, x, y, Z0 + r + 0.07, "uav_grey", 24, 0)
    for k in range(5): box(0.008, 0.03, 0.008, x + r * 0.9, y, Z0 + 0.03 + k * 0.06, "steel", 0)

def air_coolers(x0, x1, y, z):
    box(x1 - x0, 0.2, 0.06, (x0 + x1) / 2, y, z, "steel", 0.006)
    n = int((x1 - x0) / 0.14)
    for i in range(n): cyl(0.05, 0.01, x0 + 0.07 + i * 0.14, y, z + 0.06, "black", 14, 0)

def oilwell_level(level, rnd):
    plot(2, "sand")
    if level <= 5:
        for (x, y, sx, sy) in [(-0.6, 0.65, 0.3, 0.22), (0.62, -0.62, 0.25, 0.25)]: box(sx, sy, 0.008, x, y, Z0, "grass", 0.004)
    if level == 1:
        box(0.9, 0.3, 0.02, 0.0, -0.1, Z0, "concrete", 0.004)
        pump_jack(0.0, -0.1, 1.0)
        drums(-0.6, 0.4, 3); drums(0.45, 0.45, 2)
        return
    if level == 2:
        box(0.9, 0.3, 0.02, -0.05, -0.35, Z0, "concrete", 0.004)
        pump_jack(-0.05, -0.35, 1.0)
        htank(0.0, 0.4, 0.75, 0.13, "olive_dk")
        ypipe(0.33, -0.32, 0.25, Z0 + 0.03, 0.012, "black")
        fence(gap=(-0.1, 0.15), e=0.86)
        return
    jx, js = (-0.1, 1.0) if level <= 4 else (-0.35, 0.8)
    jy = -0.45
    box(0.9 * js, 0.3 * js, 0.02, jx, jy, Z0, "concrete", 0.004)
    pump_jack(jx, jy, js)
    if level <= 5:
        bund(-0.12, 0.42, 1.05, 0.55)
        vtank(-0.38, 0.42, 0.17, 0.42, "concrete"); vtank(0.13, 0.42, 0.17, 0.42, "olive_dk")
        ypipe(jx + 0.37 * js, jy + 0.03, 0.16, Z0 + 0.03, 0.012, "black")
        if level >= 4:
            separator(0.62, 0.05)
            flare(0.65, -0.6, 0.6) if level == 4 else None
        if level == 5: derrick(0.45, -0.3)
        fence(gap=(-0.1, 0.15), e=0.86)
        return
    # ---- 6–10: field refinery
    bund(-0.3, 0.47, 0.85, 0.5)
    vtank(-0.5, 0.47, 0.16, 0.4, "concrete"); vtank(-0.1, 0.47, 0.16, 0.4, "olive_dk")
    for px in (-0.55, -0.2, 0.15):                                                                            # pipe rack
        for sy in (-1, 1): box(0.02, 0.02, 0.26, px, -0.12 + sy * 0.07, Z0, "steel", 0)
        box(0.02, 0.17, 0.02, px, -0.12, Z0 + 0.26, "steel", 0)
    for k, m in enumerate(("steel", "black", "olive_dk")): hpipe(-0.62, 0.42, -0.17 + k * 0.05, Z0 + 0.3, 0.016, m)
    if level >= 9: air_coolers(-0.6, 0.2, -0.12, Z0 + 0.33)
    column(0.45, 0.1, 0.075, 0.9 if level >= 7 else 0.7)
    ypipe(0.45, -0.12, 0.03, Z0 + 0.3, 0.016)
    if level >= 7: furnace(0.45, -0.52)
    if level >= 8:
        column(0.66, -0.15, 0.05, 0.6)
        gas_sphere(0.5, 0.58, 0.16)
    if level >= 10: flare(-0.78, -0.05, 1.15, big=True)
    if level >= 9:
        perimeter_wall(gap=(-0.05, 0.2), e=0.88)
    else:
        fence(gap=(-0.05, 0.2), e=0.86)
    if level >= 10:
        for (x, y) in ((0.8, 0.8), (-0.8, -0.8)):
            cyl(0.014, 0.9, x, y, Z0, "steel", 8, 0)
            box(0.12, 0.05, 0.06, x, y, Z0 + 0.9, "gunmetal", 0.006)
            box(0.1, 0.012, 0.045, x, y + 0.03, Z0 + 0.905, mat("glass_lit", 0.3, 0, 4.0), 0)

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

BUILDERS = {**{f"hq_{n}": (lambda n=n: hq_level(n)) for n in range(1, 11)}, "builder_1": lambda: builder_1(__import__("random").Random(7)),
            **{f"power_{n}": (lambda n=n: globals()[f"power_{n}"](__import__("random").Random(7))) for n in range(1, 7)},
            **{f"oilwell_{n}": (lambda n=n: oilwell_level(n, __import__("random").Random(7))) for n in range(1, 11)},
            **{f"radar_{n}": (lambda n=n: globals()[f"radar_{n}"](__import__("random").Random(7))) for n in range(1, 5)}, **{f"treasury_{n}": (lambda n=n: treasury_level(n, __import__("random").Random(7))) for n in range(1, 11)}, "def_hisara": sam_site}

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
    sizes = {**{f"hq_{n}": 4 for n in range(1, 11)}, "builder_1": 2, **{f"radar_{n}": 3 for n in range(1, 5)}, **{f"power_{n}": 3 for n in range(1, 7)}, **{f"oilwell_{n}": 2 for n in range(1, 11)}, **{f"treasury_{n}": 3 for n in range(1, 11)}, "def_hisara": 2}
    for i in ids:
        reset(); BUILDERS[i](); export(i); preview(i, sizes.get(i, 3)); print("built", i)
