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
    "red_light": (1.0, 0.12, 0.08), "green_light": (0.2, 1.0, 0.3), "red_band": (0.70, 0.12, 0.08), "yellow_band": (0.95, 0.75, 0.10),
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

def hq():
    """Headquarters (4×4). Reference: US Army III Corps HQ, Fort Hood (aerial photo, 1995, public domain):
    two 3-storey wings swept back in a shallow V, a glass atrium where they meet, ribbon windows,
    flat roofs with square skylights, a circular drive with a round flag plaza in front."""
    import random
    rnd = random.Random(7)
    z0 = 0.115
    # ---- grounds: lawn, back car park, gate road
    box(3.92, 3.92, 0.1, m="concrete_dk", bevel=0.04)
    box(3.7, 3.7, 0.015, 0, 0, 0.1, "grass", 0.005)
    box(3.2, 0.62, 0.012, -0.15, -1.55, z0, "asphalt", 0.003)                                     # car park behind the building
    for i in range(10): box(0.02, 0.2, 0.004, -1.6 + i * 0.3, -1.42, z0 + 0.012, "white", 0)
    box(1.3, 0.24, 0.012, 1.3, 1.12, z0, "asphalt", 0.003)                                          # road from the drive to the gate
    for i in range(4): box(0.12, 0.025, 0.004, 0.95 + i * 0.25, 1.12, z0 + 0.012, "yellow_band", 0)
    # ---- circular drive with the flag plaza
    px, py = 0.0, 1.12
    cyl(0.78, 0.012, px, py, z0, "asphalt", 48, 0)
    cyl(0.57, 0.016, px, py, z0, "concrete", 48, 0)                                                 # kerb
    cyl(0.55, 0.018, px, py, z0, "grass", 48, 0)
    cyl(0.3, 0.024, px, py, z0, "concrete", 40, 0)
    box(0.16, 0.95, 0.022, 0, 0.55, z0, "concrete", 0.004)                                          # walkway to the entrance
    for i, x in enumerate((-0.14, 0.0, 0.14)):
        h = 1.25 if i == 1 else 1.0
        cyl(0.014, h, px + x, py - 0.05, z0, "white", 8, 0)
        sphere(0.022, px + x, py - 0.05, z0 + h, mat("gold", 0.3, 0.8))
        box(0.012, 0.2, 0.13, px + x, py - 0.05 + 0.105, z0 + h - 0.16, "camo2" if i == 1 else "hq_red_dk", 0.003)
    # ---- the two wings, swept back from the atrium
    ang = math.radians(15)
    rw, zr = hq_wing(0.38, -0.27, 1, ang, rnd)
    lw, _ = hq_wing(-0.38, -0.27, -1, ang, rnd)
    # right wing roof: lattice comms mast with warning light, two dishes
    kids = []
    mx = 0.88
    for sx in (-1, 1):
        for sy in (-1, 1): kids.append(cyl(0.011, 1.15, mx + sx * 0.055, sy * 0.055, zr, "steel", 6, 0))
    for k in range(6): kids.append(box(0.13, 0.13, 0.012, mx, 0, zr + 0.15 + k * 0.17, "steel", 0))
    kids.append(sphere(0.035, mx, 0, zr + 1.18, mat("red_light", 0.4, 0, 4.0)))
    for dx, dy, rz in [(0.2, 0.14, 0.7), (0.62, -0.14, -0.3)]:
        kids.append(cyl(0.022, 0.12, dx, dy, zr, "steel", 8, 0))
        d = cyl(0.11, 0.045, dx, dy, zr + 0.12, "white", 20, 0.01, r2=0.02); d.rotation_euler = (math.radians(55), 0, rz); kids.append(d)
    for o in kids: o.parent = rw
    # left wing roof: radome and air-conditioning units
    kids = [box(0.36, 0.36, 0.08, -0.8, 0, zr, "concrete_dk", 0.015), sphere(0.2, -0.8, 0, zr + 0.08, "white", half=True)]
    for i in range(3):
        kids.append(box(0.17, 0.17, 0.08, -0.15 - i * 0.2, -0.12, zr, "steel", 0.01))
        kids.append(cyl(0.06, 0.01, -0.15 - i * 0.2, -0.12, zr + 0.08, "black", 16, 0))
    for o in kids: o.parent = lw
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
    # entrance canopy, doors, sign
    box(0.6, 0.36, 0.045, 0, af + 0.16, z0 + 0.42, "hq_red", 0.01)
    for sx in (-1, 1): box(0.04, 0.04, 0.42, sx * 0.26, af + 0.31, z0, "white", 0.006)
    box(0.34, 0.03, 0.3, 0, af + 0.012, z0, "black", 0.004)
    box(0.015, 0.035, 0.3, 0, af + 0.02, z0, "white", 0)
    box(0.44, 0.02, 0.07, 0, af + 0.345, z0 + 0.43, "white", 0.004)                                  # name plate on the canopy edge
    sphere(0.03, 0, af + 0.36, z0 + 0.465, mat("gold", 0.3, 0.8))
    for sx in (-1, 1): sphere(0.022, sx * 0.24, af + 0.33, z0 + 0.41, mat("glass_lit", 0.3, 0, 3.0))
    # ---- gate on the road out: guard booth, boom barrier, concrete blocks
    gx, gy = 1.62, 1.12
    box(0.26, 0.26, 0.3, gx, gy + 0.3, z0, "hq_wall", 0.02); box(0.32, 0.32, 0.04, gx, gy + 0.3, z0 + 0.3, "hq_red", 0.01)
    box(0.18, 0.02, 0.1, gx, gy + 0.175, z0 + 0.15, "glass_lit", 0)
    cyl(0.025, 0.18, gx - 0.08, gy + 0.15, z0, "black", 8, 0)
    for i in range(3): box(0.025, 0.1, 0.025, gx - 0.08, gy + 0.08 - i * 0.1, z0 + 0.16, "yellow_band" if i % 2 == 0 else "black", 0.003)
    for y in (gy - 0.24, gy - 0.4): box(0.26, 0.08, 0.09, gx, y, z0, "concrete", 0.015)
    # ---- lamps, trees
    for a in (0.35, 2.75, 3.6, 5.8):
        lamp(px + math.cos(a) * 0.86, py + math.sin(a) * 0.86, 0.6)
    for (x, y, s) in [(-1.7, 1.75, 1.0), (-1.75, 1.1, 0.9), (-1.6, 0.45, 0.8), (1.75, 1.75, 0.9), (1.72, 0.55, 0.85),
                      (-1.75, -1.05, 0.8), (1.7, -1.0, 0.8), (-0.95, 0.5, 0.7), (0.95, 0.5, 0.7)]:
        tree(x, y, s)
    for i in range(6): box(0.28, 0.14, 0.12, -1.0 + i * 0.4, -1.95 + 0.04, z0, "sandbag", 0.04)   # sandbags along the back fence

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
