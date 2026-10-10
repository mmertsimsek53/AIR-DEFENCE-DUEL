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

def hq():
    import random
    rnd = random.Random(7)
    # ---- grounds
    box(3.92, 3.92, 0.1, m="concrete_dk", bevel=0.04)
    box(3.7, 3.7, 0.015, 0, 0, 0.1, "concrete", 0.005)
    box(0.9, 2.0, 0.012, 0.95, 0.9, 0.115, "asphalt", 0.003)                                        # drive to the gate
    for i in range(6): box(0.04, 0.16, 0.004, 0.95, 0.15 + i * 0.32, 0.128, "gold", 0)            # yellow centre line
    # ---- main block: three floors
    W, D, H, cx, cy, z0 = 2.7, 1.9, 1.62, -0.25, -0.45, 0.115
    box(W, D, H, cx, cy, z0, "hq_wall", 0.04)
    box(W + 0.06, D + 0.06, 0.1, cx, cy, z0, "hq_red_dk", 0.02)                                     # plinth band
    for k in range(1, 3): box(W + 0.03, D + 0.03, 0.035, cx, cy, z0 + k * 0.54, "concrete_dk", 0.005)  # floor lines
    for sx in (-1, 1):                                                                               # red corner pillars
        for sy in (-1, 1): box(0.14, 0.14, H + 0.08, cx + sx * W / 2, cy + sy * D / 2, z0, "hq_red", 0.02)
    front, side = cy + D / 2, cx + W / 2
    for f in range(3):
        zf = z0 + 0.16 + f * 0.54
        for i in range(6):
            x = cx - W / 2 + 0.25 + i * (W - 0.5) / 5
            if f == 0 and abs(x - 0.6) < 0.35: continue                                             # leave room for the entrance
            window(x, front, zf, 0.24, 0.28, lit=rnd.random() < 0.25)
        for i in range(4):
            window(side, cy - D / 2 + 0.3 + i * (D - 0.6) / 3, zf, 0.22, 0.28, lit=rnd.random() < 0.25, face="x")
        if f > 0:                                                                                     # wall AC units
            box(0.13, 0.08, 0.09, cx - W / 2 + 0.55 + f * 0.6, front + 0.04, zf - 0.08, "white", 0.01)
    # ---- roof
    zr = z0 + H
    box(W - 0.1, D - 0.1, 0.03, cx, cy, zr, "hq_roof", 0.005)
    for sy in (-1, 1): box(W + 0.04, 0.07, 0.14, cx, cy + sy * (D / 2), zr, "hq_red", 0.01)        # parapet
    for sx in (-1, 1): box(0.07, D + 0.04, 0.14, cx + sx * (W / 2), cy, zr, "hq_red", 0.01)
    box(0.4, 0.34, 0.3, cx - 0.95, cy + 0.55, zr, "concrete", 0.02)                                 # stair hut
    box(0.14, 0.02, 0.22, cx - 0.95, cy + 0.73, zr, "black", 0.005)
    box(0.5, 0.5, 0.12, cx + 0.75, cy - 0.45, zr, "concrete_dk", 0.02)                              # radome plinth
    sphere(0.3, cx + 0.75, cy - 0.45, zr + 0.12, "white", half=True)
    cyl(0.16, 0.3, cx - 0.15, cy - 0.55, zr, "white", 20, 0.01); cyl(0.17, 0.03, cx - 0.15, cy - 0.55, zr + 0.3, "steel", 20, 0)  # water tank
    for i in range(3):                                                                               # cooling fans
        box(0.26, 0.26, 0.1, cx - 1.0 + i * 0.32, cy - 0.6, zr, "steel", 0.01)
        cyl(0.09, 0.012, cx - 1.0 + i * 0.32, cy - 0.6, zr + 0.1, "black", 16, 0)
    for i in range(4):                                                                               # solar panels on short legs
        px = cx - 0.45 + i * 0.3
        cyl(0.012, 0.1, px, cy + 0.2, zr, "steel", 6, 0)
        pnl = box(0.27, 0.2, 0.02, px, cy + 0.2, zr + 0.09, "glass", 0.004); pnl.rotation_euler = (math.radians(-25), 0, 0)
        box(0.27, 0.01, 0.022, px, cy + 0.11, zr + 0.13, "white", 0)
    for k, (dx, dy, rz) in enumerate([(0.45, 0.45, 0.6), (0.15, 0.55, -0.4)]):                       # satellite dishes
        cyl(0.025, 0.14, cx + dx, cy + dy, zr, "steel", 8, 0)
        d = cyl(0.13, 0.05, cx + dx, cy + dy, zr + 0.14, "white", 20, 0.01, r2=0.02); d.rotation_euler = (math.radians(55), 0, rz)
    # lattice comms mast with warning light
    mx, my = cx + 1.05, cy + 0.5
    for sx in (-1, 1):
        for sy in (-1, 1): cyl(0.012, 1.3, mx + sx * 0.06, my + sy * 0.06, zr, "steel", 6, 0)
    for k in range(7): box(0.14, 0.14, 0.012, mx, my, zr + 0.15 + k * 0.17, "steel", 0)
    sphere(0.04, mx, my, zr + 1.36, mat("red_light", 0.4, 0, 4.0))
    # ---- entrance block
    ex, ey = 0.6, front
    box(0.95, 0.55, 1.15, ex, ey + 0.2, z0, "hq_wall", 0.03)
    box(1.05, 0.62, 0.08, ex, ey + 0.22, z0 + 1.15, "hq_red", 0.02)
    for sx in (-1, 1): box(0.07, 0.07, 0.62, ex + sx * 0.4, ey + 0.62, z0, "white", 0.01)          # canopy columns
    box(1.0, 0.45, 0.05, ex, ey + 0.62, z0 + 0.62, "hq_red", 0.01)                                  # canopy
    box(0.5, 0.03, 0.12, ex, ey + 0.86, z0 + 0.66, "white", 0.005)                                  # sign plate
    box(0.42, 0.02, 0.05, ex, ey + 0.875, z0 + 0.695, "hq_red_dk", 0)                               # red stripe on the sign
    sphere(0.035, ex, ey + 0.88, z0 + 0.72, mat("gold", 0.3, 0.8))                                   # gold emblem
    box(0.42, 0.04, 0.5, ex, ey + 0.48, z0, "glass", 0.005)                                         # glass doors
    box(0.02, 0.05, 0.5, ex, ey + 0.49, z0, "white", 0)
    for k in range(3): box(0.6 + k * 0.08, 0.1, 0.035, ex, ey + 0.6 + k * 0.1, z0 - k * 0.035 + 0.07, "concrete", 0.005)  # steps
    for f in range(1, 2): window(ex, ey + 0.475, z0 + 0.8, 0.5, 0.25, lit=True)
    for sx in (-1, 1):
        for zz in (0.8,): sphere(0.025, ex + sx * 0.38, ey + 0.48, z0 + zz + 0.3, mat("red_light", 0.4, 0, 3.0))
    # ---- flags
    for i, y in enumerate((0.45, 0.72, 0.99)):                                                       # three flagpoles on the left lawn
        x = -1.75
        cyl(0.016, 1.15 if i == 1 else 0.95, x, y, 0.115, "white", 8, 0)
        box(0.012, 0.36, 0.22, x, y + 0.19, (1.0 if i == 1 else 0.8), "camo2" if i == 1 else "hq_red_dk", 0.003)
    # ---- gate: guard booth, boom barrier, road blocks
    gx, gy = 0.95, 1.7
    box(0.28, 0.28, 0.32, gx + 0.55, gy - 0.05, 0.115, "hq_wall", 0.02); box(0.32, 0.32, 0.04, gx + 0.55, gy - 0.05, 0.435, "hq_red", 0.01)
    box(0.2, 0.02, 0.12, gx + 0.55, gy + 0.09, 0.27, "glass_lit", 0)
    cyl(0.03, 0.2, gx + 0.4, gy + 0.15, 0.115, "black", 8, 0)
    for i in range(5): box(0.16, 0.035, 0.035, gx + 0.3 - i * 0.16, gy + 0.15, 0.3, "yellow_band" if i % 2 == 0 else "black", 0.004)
    for x in (-0.25, 0.1, 2.2):
        if x > 2: continue
        for k in range(2): box(0.22, 0.09, 0.1, gx + x + k * 0.24 - 0.9, gy + 0.05, 0.115, "concrete", 0.02)
    # ---- helipad with edge lights
    hx, hy = -1.15, 1.05
    cyl(0.62, 0.03, hx, hy, 0.115, "asphalt", 40, 0)
    cyl(0.54, 0.032, hx, hy, 0.115, "white", 40, 0); cyl(0.49, 0.034, hx, hy, 0.115, "asphalt", 40, 0)
    box(0.07, 0.34, 0.006, hx - 0.12, hy, 0.15, "white", 0); box(0.07, 0.34, 0.006, hx + 0.12, hy, 0.15, "white", 0); box(0.24, 0.07, 0.006, hx, hy, 0.15, "white", 0)
    for k in range(10):
        a = k / 10 * math.tau; sphere(0.025, hx + math.cos(a) * 0.6, hy + math.sin(a) * 0.6, 0.15, mat("gold", 0.4, 0, 2.5))
    # ---- vehicles, planters, lamps, sandbags
    jeep(1.55, -0.35, math.pi / 2); jeep(1.55, -0.85, math.pi / 2, "khaki")
    for (x, y) in [(-1.75, -1.6), (1.65, -1.65), (-1.75, -0.2), (0.15, 1.55)]:
        box(0.3, 0.3, 0.1, x, y, 0.115, "concrete", 0.02); tree(x, y + 0.0, 1.0)
    for (x, y) in [(-0.2, 1.75), (1.75, 0.6), (-1.8, -0.8)]: lamp(x, y)
    for i in range(5): box(0.3, 0.15, 0.13, -1.75 + 0.0, -1.2 + i * 0.27, 0.115, "sandbag", 0.04, rz=math.pi / 2)

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
