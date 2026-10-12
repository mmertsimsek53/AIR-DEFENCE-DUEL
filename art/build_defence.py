"""Air Defence Duel — air-defence systems as rigged, animated models (Blender, headless).

Run:  ~/Applications/Blender.app/Contents/MacOS/Blender -b -P art/build_defence.py -- [ids...] [--anim]
Writes web/models/sys_<id>.glb (rigged; animations included) and art/previews/sys_<id>.png;
with --anim also art/previews/anim/sys_<id>.mp4 (a 4-second demo: deploy, aim, fire, radar spinning).

Units: 1 Blender unit = 1 metre, vehicle front = +Y, ground at z = 0.
Rig (named empties the game drives):
  turret     rotates about Z (aim left/right)
  elevation  rotates about X (aim up/down; for Patriot the launcher raising)
  barrels    moves along -Y on each shot (gun recoil)        [guns]
  radar      spins about Z                                    [all]
  flash_*    muzzle flashes / rocket flames, scale 0 → 1 when firing
"""
import bpy, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_models as bm
from build_models import box, cyl, sphere, mat, PAL

ROOT = bm.ROOT
OUT_GLB = os.path.join(ROOT, "web", "models")
OUT_PNG = os.path.join(ROOT, "art", "previews")
OUT_ANIM = os.path.join(OUT_PNG, "anim")
FRAMES, FPS = 96, 24
PAL.update({"army": (0.30, 0.34, 0.20), "army_dk": (0.20, 0.23, 0.13), "canister": (0.52, 0.53, 0.45), "radar_face": (0.26, 0.29, 0.30)})

# ---------------------------------------------------------------- rig helpers
def pivot(name, x=0, y=0, z=0, parent=None):
    bpy.ops.object.empty_add(location=(x, y, z)); e = bpy.context.object; e.name = name; e.empty_display_size = 0.4
    if parent: e.parent = parent
    return e

def attach(parent, *objs):
    for o in objs: o.parent = parent
    return objs[0] if objs else None

def rot(o, frame, x=0.0, y=0.0, z=0.0, linear=False):
    o.rotation_euler = (math.radians(x), math.radians(y), math.radians(z)); o.keyframe_insert("rotation_euler", frame=frame)
    if linear: _linear(o)

def loc(o, frame, x, y, z):
    o.location = (x, y, z); o.keyframe_insert("location", frame=frame)

def scl(o, frame, s):
    o.scale = (s, s, s); o.keyframe_insert("scale", frame=frame)

def _linear(o):
    act = o.animation_data.action if o.animation_data else None
    if not act: return
    curves = getattr(act, "fcurves", None)
    if curves is None:  # Blender 5 layered actions
        curves = [fc for layer in act.layers for strip in layer.strips for bag in strip.channelbags for fc in bag.fcurves]
    for fc in curves:
        for kp in fc.keyframe_points: kp.interpolation = "LINEAR"

def spin(o, f0, f1, turns, axis="z"):
    rot(o, f0, **{axis: 0.0}); rot(o, f1, **{axis: 360.0 * turns}); _linear(o)

# ---------------------------------------------------------------- shape helpers (centred, any axis)
def _cyl(r, L, x, y, z, m, seg, rotation, r2=None, bevel=0.0):
    if r2 is None: bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=L, vertices=seg, location=(x, y, z), rotation=rotation)
    else: bpy.ops.mesh.primitive_cone_add(radius1=r, radius2=r2, depth=L, vertices=seg, location=(x, y, z), rotation=rotation)
    return bm._finish(bpy.context.object, mat(m) if isinstance(m, str) else m, bevel, smooth=True)
def cylY(r, L, x, y, z, m="steel", seg=16, r2=None, bevel=0.0): return _cyl(r, L, x, y, z, m, seg, (-math.pi / 2, 0, 0), r2, bevel)   # along +Y (cone tip +Y)
def cylX(r, L, x, y, z, m="steel", seg=16, bevel=0.0): return _cyl(r, L, x, y, z, m, seg, (0, math.pi / 2, 0), None, bevel)
def cylZ(r, L, x, y, z, m="steel", seg=16, r2=None, bevel=0.0): return _cyl(r, L, x, y, z, m, seg, (0, 0, 0), r2, bevel)
def cb(sx, sy, sz, x, y, z, m, bevel=0.05, rx=0.0, ry=0.0, rz=0.0):
    """Box centred at (x, y, z) with optional tilt (degrees)."""
    o = box(sx, sy, sz, x, y, z - sz / 2, m, bevel); o.rotation_euler = (math.radians(rx), math.radians(ry), math.radians(rz)); return o

_smoke = None
def smoke_mat():
    global _smoke
    try:
        if _smoke and _smoke.name: return _smoke
    except ReferenceError: pass   # cleared by bm.reset() between models
    m = bpy.data.materials.new("smoke"); m.use_nodes = True; b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (0.86, 0.86, 0.84, 1); b.inputs["Roughness"].default_value = 1.0; b.inputs["Alpha"].default_value = 0.42
    for attr, val in (("surface_render_method", "BLENDED"), ("blend_method", "BLEND")):
        try: setattr(m, attr, val)
        except Exception: pass
    _smoke = m; return m

# ---------------------------------------------------------------- shared parts
def tracked_hull(L=6.8, W=3.1):
    """ACV-30 style tracked carrier, with rounded armour, skirts, wheels, track links and the small fittings."""
    cb(W - 0.7, L - 0.2, 0.7, 0, 0, 0.8, "army", 0.12)                                                        # lower hull
    cb(W - 0.35, L - 1.6, 0.55, 0, -0.55, 1.42, "army", 0.16)                                                 # upper hull
    cb(W - 0.5, 1.6, 0.55, 0, L / 2 - 1.15, 1.25, "army", 0.14, rx=-22)                                       # sloped nose
    cb(W - 0.6, 0.9, 0.4, 0, -L / 2 + 0.35, 1.25, "army_dk", 0.1)                                             # rear plate
    for k in range(7): cb(W - 1.0, 0.05, 0.03, 0, -L / 2 + 0.85 + k * 0.12, 1.71, "black", 0)                 # engine grille
    for sx in (-1, 1):
        cb(0.5, L, 0.68, sx * (W / 2 - 0.25), 0, 0.42, "black", 0.3)                                          # track (rounded ends)
        for k in range(int(L / 0.24)): cb(0.52, 0.06, 0.03, sx * (W / 2 - 0.25), -L / 2 + 0.2 + k * 0.24, 0.78, "gunmetal", 0)  # links on top
        for k in range(6):
            y = -L / 2 + 1.05 + k * (L - 2.1) / 5
            cylX(0.31, 0.3, sx * (W / 2 - 0.25), y, 0.34, "gunmetal", 18, 0.02); cylX(0.12, 0.32, sx * (W / 2 - 0.25), y, 0.34, "steel", 10)
        cylX(0.36, 0.3, sx * (W / 2 - 0.25), L / 2 - 0.45, 0.6, "gunmetal", 12, 0.02)                         # drive sprocket
        cylX(0.3, 0.3, sx * (W / 2 - 0.25), -L / 2 + 0.4, 0.55, "gunmetal", 12, 0.02)                         # idler
        cb(0.07, L - 1.3, 0.5, sx * (W / 2 + 0.03), -0.1, 0.85, "army_dk", 0.03)                               # side skirt
        for k in range(1, 5): cb(0.075, 0.03, 0.48, sx * (W / 2 + 0.035), -L / 2 + 0.65 + k * (L - 1.3) / 5, 0.85, "black", 0)  # skirt seams
        cylY(0.09, 0.06, sx * 0.95, L / 2 - 0.42, 1.25, mat("glass_lit", 0.3, 0, 1.5), 12)                    # headlights
        cb(0.12, 0.05, 0.08, sx * 1.05, -L / 2 + 0.08, 1.15, mat("red_light", 0.4, 0, 2.0), 0.01)            # tail lights
        cb(0.18, 0.25, 0.12, sx * 0.9, L / 2 - 0.25, 0.75, "steel", 0.03)                                      # tow hooks
        cb(0.35, 1.0, 0.3, sx * (W / 2 - 0.45), -1.6, 1.85, "army_dk", 0.06)                                   # stowage boxes
    cylZ(0.32, 0.06, -0.75, L / 2 - 1.5, 1.72, "army_dk", 18, bevel=0.02)                                     # driver's hatch
    cb(0.45, 0.06, 0.12, -0.75, L / 2 - 1.15, 1.6, "glass", 0.01, rx=-22)                                      # periscopes
    for sx in (-1, 1): cylZ(0.012, 1.8, sx * 1.2, -L / 2 + 0.6, 2.6, "black", 6)                               # antenna whips

def smoke_launchers(parent, x, y, z, side):
    for k in range(3): attach(parent, cylY(0.06, 0.32, x + side * k * 0.13, y, z + k * 0.05, "army_dk", 10))

def radar_mast(parent, x, y, z, h, w, d, name="radar"):
    """Telescopic mast with a framed phased-array antenna on top. Returns the spinning pivot."""
    for i, (r, f) in enumerate(((0.14, 0.45), (0.11, 0.35), (0.08, 0.2))):
        attach(parent, cylZ(r, h * f, x, y, z + h * (0.0 if i == 0 else 0.45 if i == 1 else 0.8) + h * f / 2, "steel", 12))
    r = pivot(name, x, y, z + h, parent)
    attach(r, cylZ(0.22, 0.12, 0, 0, 0.06, "gunmetal", 16),
           cb(w, 0.16, d, 0, 0, 0.22 + d / 2, "army_dk", 0.05), cb(w - 0.12, 0.05, d - 0.12, 0, 0.09, 0.22 + d / 2, "radar_face", 0.01),
           cb(w * 0.5, 0.08, 0.1, 0, 0, 0.32 + d, "gunmetal", 0.02))                                           # IFF bar on top
    for k in range(1, 4): attach(r, cb(w - 0.14, 0.06, 0.02, 0, 0.1, 0.22 + k * d / 4, "army_dk", 0))
    for k in range(1, 5): attach(r, cb(0.02, 0.06, d - 0.14, -w / 2 + k * w / 5, 0.1, 0.22 + d / 2, "army_dk", 0))
    return r

def flash(parent, name, x, y, z, length=1.0, width=0.35):
    """Muzzle flash / rocket flame: emissive cone pointing along +Y, hidden (scale 0) until fired."""
    f = pivot(name, x, y, z, parent)
    attach(f, cylY(width, length, 0, length / 2, 0, mat("flame", 0.5, 0, 8.0), 10, r2=0.02), sphere(width * 0.8, 0, 0, 0, mat("yellow_band", 0.5, 0, 9.0)))
    f.scale = (0, 0, 0)
    return f

def puff(parent, name, x, y, z, s=0.3):
    p = pivot(name, x, y, z, parent)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=s, location=(0, 0, 0)); o = bpy.context.object
    bm._finish(o, smoke_mat(), 0, smooth=True); o.parent = p
    p.scale = (0, 0, 0); return p

def canister(parent, cx, cy, cz, w, L, name_cap):
    """Square launch canister with reinforcing bands and a lid that pops off when it fires."""
    attach(parent, cb(w, L, w, cx, cy, cz, "canister", w * 0.12))
    for k in range(4): attach(parent, cb(w + 0.04, 0.08, w + 0.04, cx, cy - L / 2 + 0.3 + k * (L - 0.6) / 3, cz, "army_dk", 0.02))
    cap = pivot(name_cap, cx, cy + L / 2 + 0.02, cz, parent); attach(cap, cb(w - 0.04, 0.05, w - 0.04, 0, 0, 0, "gunmetal", 0.01))
    return cap

# ---------------------------------------------------------------- systems
def korkut():
    """Korkut: 35 mm twin-gun turret on a tracked carrier, search radar on the turret. Fires airburst bursts."""
    tracked_hull()
    tur = pivot("turret", 0, -0.4, 1.7)
    attach(tur, cylZ(1.25, 0.22, 0, 0, 0.11, "army_dk", 28, bevel=0.03),
           cb(2.3, 2.6, 0.85, 0, 0, 0.62, "army", 0.18), cb(0.25, 2.3, 0.75, 1.25, 0, 0.58, "army", 0.08, ry=-10), cb(0.25, 2.3, 0.75, -1.25, 0, 0.58, "army", 0.08, ry=10),
           cb(2.0, 0.8, 0.55, 0, -1.55, 0.55, "army_dk", 0.12),                                                    # bustle
           cylZ(0.3, 0.06, -0.6, -0.2, 1.08, "army_dk", 18, bevel=0.02), cylZ(0.3, 0.06, 0.55, -0.4, 1.08, "army_dk", 18, bevel=0.02))  # hatches
    attach(tur, cb(0.5, 0.45, 0.4, 0.9, 0.85, 1.25, "gunmetal", 0.06), cb(0.3, 0.05, 0.22, 0.9, 1.09, 1.25, "glass", 0.01))  # sight
    smoke_launchers(tur, 1.0, 1.2, 0.6, 1); smoke_launchers(tur, -1.0, 1.2, 0.6, -1)
    ele = pivot("elevation", 0, 1.05, 0.6, tur)
    attach(ele, cb(1.2, 0.7, 0.62, 0, 0, 0, "army_dk", 0.16))
    for sx in (-1, 1): attach(ele, cb(0.32, 0.9, 0.42, sx * 0.62, -0.05, 0.05, "army", 0.08))                  # ammo feed covers
    bar = pivot("barrels", 0, 0, 0, ele)
    for sx in (-1, 1):
        x = sx * 0.42
        attach(bar, cylY(0.13, 1.3, x, 0.95, 0, "gunmetal", 16), cylY(0.075, 2.0, x, 2.6, 0, "steel", 14),
               cylY(0.13, 0.32, x, 3.75, 0, "black", 14), cylY(0.15, 0.05, x, 3.65, 0, "gunmetal", 14), cylY(0.15, 0.05, x, 3.85, 0, "gunmetal", 14))
        flash(bar, f"flash_{'l' if sx < 0 else 'r'}", x, 3.95, 0, 1.0, 0.26)
    radar_mast(tur, 0, -1.55, 0.82, 0.9, 1.6, 0.65)

def hisara():
    """Hisar-A+: tracked carrier, turret with a 2×2 canister launcher on an elevating frame, EO sensor arm, radar mast."""
    tracked_hull()
    tur = pivot("turret", 0, -0.6, 1.7)
    attach(tur, cylZ(1.2, 0.2, 0, 0, 0.1, "army_dk", 28, bevel=0.03), cb(2.0, 2.0, 0.5, 0, 0, 0.45, "army", 0.15))
    attach(tur, cb(0.16, 0.16, 0.9, 1.25, 0.3, 0.9, "steel", 0.03), sphere(0.3, 1.25, 0.35, 1.45, "gunmetal"), cb(0.3, 0.05, 0.2, 1.25, 0.62, 1.45, "glass", 0.01))  # EO arm
    ele = pivot("elevation", 0, -0.9, 0.85, tur)
    for sx in (-1, 1): attach(ele, cb(0.1, 3.4, 0.25, sx * 0.95, 1.5, 0.45, "army_dk", 0.03))                  # launcher side rails
    for y in (0.2, 1.5, 2.8): attach(ele, cb(1.9, 0.12, 0.12, 0, y, -0.02, "army_dk", 0.02))                  # cross beams
    caps = [canister(ele, cx, 1.5, cz, 0.46, 3.3, f"cap_{i}") for i, (cx, cz) in enumerate([(-0.42, 0.28), (0.42, 0.28), (-0.42, 0.8), (0.42, 0.8)])]
    radar_mast(tur, -0.9, -0.7, 0.5, 1.7, 1.4, 0.95)
    return caps

def truck_cab(y, W=2.6):
    cb(W, 2.4, 1.7, 0, y, 1.75, "army", 0.18)
    cb(W - 0.3, 0.06, 0.7, 0, y + 1.2, 2.15, "glass", 0.02, rx=-12)                                            # windscreen
    for sx in (-1, 1): cb(0.06, 1.0, 0.55, sx * W / 2, y + 0.3, 2.15, "glass", 0.01)
    for k in range(6): cb(1.6, 0.05, 0.05, 0, y + 1.22, 1.0 + k * 0.1, "black", 0)                             # grille
    cb(W + 0.1, 0.25, 0.3, 0, y + 1.3, 0.75, "gunmetal", 0.05)                                                 # bumper
    for sx in (-1, 1):
        cylY(0.12, 0.06, sx * 0.95, y + 1.22, 1.15, mat("glass_lit", 0.3, 0, 1.5), 12)
        cb(0.06, 0.25, 0.35, sx * (W / 2 + 0.25), y + 1.0, 2.2, "black", 0.02)                                 # mirrors
    cylX(0.3, 1.2, 1.2, y - 1.1, 1.0, "steel", 16)                                                              # fuel tank
    cylZ(0.08, 1.4, -1.15, y - 1.0, 2.6, "black", 10)                                                           # exhaust stack

def wheel_pair(x, y, r=0.55):
    for sx in (-1, 1): cylX(r, 0.42, sx * x, y, r, "black", 20, 0.04); cylX(r * 0.45, 0.44, sx * x, y, r, "steel", 12)

def patriot():
    """Patriot: launcher on a semi-trailer pulled by a heavy truck (4 PAC-3 MSE canisters on an erector that raises),
    plus a radar trailer with a large phased array that turns (LTAMDS-style all-round radar)."""
    truck_cab(6.2)
    cb(2.4, 2.6, 0.5, 0, 4.4, 0.95, "army_dk", 0.08)                                                           # tractor chassis
    for y in (6.3, 4.9): wheel_pair(1.15, y)
    cb(2.6, 9.0, 0.45, 0, 0.0, 1.25, "army_dk", 0.08)                                                          # trailer bed
    for sx in (-1, 1): cb(0.15, 9.0, 0.3, sx * 1.2, 0.0, 1.0, "gunmetal", 0.03)                                # frame rails
    for y in (-3.0, -4.1): wheel_pair(1.15, y)
    for sx in (-1, 1):
        for y in (2.8, -1.8):
            cb(0.9, 0.18, 0.18, sx * 1.6, y, 1.15, "steel", 0.03); cylZ(0.07, 0.9, sx * 2.0, y, 0.55, "steel", 10); cylZ(0.25, 0.06, sx * 2.0, y, 0.05, "gunmetal", 16)  # outrigger jacks
    tur = pivot("turret", 0, -1.6, 1.5)
    attach(tur, cylZ(1.1, 0.3, 0, 0, 0.15, "gunmetal", 28, bevel=0.03), cb(2.4, 1.6, 0.3, 0, 0, 0.45, "army", 0.08))
    ele = pivot("elevation", 0, -0.7, 0.75, tur)                                                               # hinge at the rear
    for sx in (-1, 1):
        attach(ele, cb(0.18, 6.4, 0.3, sx * 1.15, 3.2, -0.05, "army_dk", 0.04))                                # erector rails
        for k in range(5): attach(ele, cb(0.08, 1.4, 0.08, sx * 1.15, 0.7 + k * 1.25, -0.2, "steel", 0, rx=30))  # truss
    caps = [canister(ele, cx, 3.2, cz, 0.98, 6.2, f"cap_{i}") for i, (cx, cz) in enumerate([(-0.52, 0.6), (0.52, 0.6), (-0.52, 1.6), (0.52, 1.6)])]
    attach(ele, cb(2.3, 0.3, 2.3, 0, 0.05, 1.1, "army_dk", 0.06))
    # radar trailer
    rt = pivot("radar_trailer", 7.5, -4.0, 0)
    attach(rt, cb(2.4, 5.6, 0.45, 0, 0, 1.15, "army_dk", 0.08), cb(2.0, 1.6, 1.2, 0, 1.9, 1.95, "army", 0.12))  # bed + generator
    for k in range(5): attach(rt, cb(0.04, 1.2, 0.05, 1.02, 1.3 + k * 0.25, 2.0, "black", 0))                  # generator vents
    for y in (-1.6, -0.5):
        for sx in (-1, 1): attach(rt, cylX(0.5, 0.4, sx * 1.1, y, 0.5, "black", 20, 0.04), cylX(0.22, 0.42, sx * 1.1, y, 0.5, "steel", 12))
    r = pivot("radar", 0, -0.7, 1.4, rt)
    attach(r, cylZ(0.8, 0.35, 0, 0, 0.17, "gunmetal", 24, bevel=0.03), cb(1.2, 1.0, 0.6, 0, -0.6, 0.65, "army", 0.1))
    face = pivot("radar_face", 0, 0, 0.6, r); face.rotation_euler = (math.radians(-18), 0, 0)
    attach(face, cb(3.6, 0.45, 3.4, 0, 0, 1.7, "army", 0.25), cb(3.3, 0.06, 3.1, 0, 0.24, 1.7, "radar_face", 0.02))
    for k in range(1, 8): attach(face, cb(3.25, 0.07, 0.025, 0, 0.27, 0.15 + k * 0.39, "army_dk", 0))
    for k in range(1, 8): attach(face, cb(0.025, 0.07, 3.05, -1.62 + k * 0.405, 0.27, 1.7, "army_dk", 0))
    return caps

# ---------------------------------------------------------------- demo animations
def missile(parent, name, x, y, z, L=2.6, r=0.18):
    """A missile hidden inside its canister (scale 0) that is launched along the launcher's +Y."""
    m = pivot(name, x, y, z, parent)
    attach(m, cylY(r, L, 0, 0, 0, "missile_white", 16), cylY(r, 0.55, 0, L / 2 + 0.27, 0, "missile_white", 16, r2=0.02))
    for k in range(4): fin = cb(0.02, 0.35, r * 1.6, 0, -L / 2 + 0.2, 0, "gunmetal", 0); fin.rotation_euler = (0, math.radians(45 + k * 90), 0); attach(m, fin)
    fl = flash(m, name + "_flame", 0, -L / 2, 0, 1.6, r * 1.5); fl.rotation_euler = (0, 0, math.pi)
    m.scale = (0, 0, 0)
    return m

def fire_missile(m, cap, f, dist, frames=14):
    """Lid pops, the missile leaves along the launcher with its flame on, a smoke trail forms behind it and fades."""
    o = cap.location.copy(); loc(cap, f - 1, o.x, o.y, o.z); loc(cap, f + 6, o.x + 0.3, o.y + 2.0, o.z - 1.6)
    scl(m, f - 1, 0); scl(m, f, 1)
    fl = bpy.data.objects[m.name + "_flame"]; scl(fl, f - 1, 0); scl(fl, f, 1)
    s = m.location.copy(); loc(m, f, s.x, s.y, s.z); loc(m, f + frames, s.x, s.y + dist, s.z)
    n = 14
    for i in range(n):
        t = i / (n - 1); fa = f + round(t * frames)
        p = puff(m.parent, f"{m.name}_smoke{i}", s.x + (i % 3 - 1) * 0.12, s.y + t * dist, s.z + (i % 2) * 0.1, 0.22 + 0.05 * (i % 3))
        scl(p, fa - 1, 0); scl(p, fa, 0.6); scl(p, fa + 12, 1.6 + 0.4 * t); scl(p, fa + 30, 2.0 + 0.4 * t); scl(p, fa + 40, 0)

def anim_korkut():
    tur, ele, bar = (bpy.data.objects[n] for n in ("turret", "elevation", "barrels"))
    spin(bpy.data.objects["radar"], 1, FRAMES + 1, 2)
    rot(tur, 1, z=0); rot(tur, 26, z=48)
    rot(ele, 6, x=0); rot(ele, 30, x=32)
    for f in (36, 39, 42, 45, 62, 65, 68, 71):
        loc(bar, f - 1, 0, 0, 0); loc(bar, f, 0, -0.3, 0); loc(bar, f + 2, 0, 0, 0)
        for n in ("flash_l", "flash_r"): fl = bpy.data.objects[n]; scl(fl, f - 1, 0); scl(fl, f, 1); scl(fl, f + 2, 0)
    rot(tur, 54, z=48); rot(tur, 60, z=62); rot(ele, 54, x=32); rot(ele, 60, x=40)

def anim_launcher(caps, h, angle, launch_frames, dist):
    tur, ele = bpy.data.objects["turret"], bpy.data.objects["elevation"]
    spin(bpy.data.objects["radar"], 1, FRAMES + 1, 0.5 if h > 1 else 2)
    rot(tur, 1, z=0); rot(tur, 24, z=40)
    rot(ele, 4, x=0); rot(ele, 34, x=angle)
    for f, i in launch_frames:
        c = caps[i]; m = missile(ele, f"missile_{i}", c.location.x, c.location.y - 1.8 * h, c.location.z, 2.6 * h, 0.17 * h)
        fire_missile(m, c, f, dist)

# ---------------------------------------------------------------- scene, export, preview, movie
def stage(size):
    scn = bpy.context.scene
    for eng in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "CYCLES"):
        try: scn.render.engine = eng; break
        except Exception: pass
    scn.render.resolution_x, scn.render.resolution_y = 960, 600
    try: scn.view_settings.view_transform = "Standard"
    except Exception: pass
    w = bpy.data.worlds.new("w"); scn.world = w; w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (0.55, 0.70, 0.88, 1); w.node_tree.nodes["Background"].inputs[1].default_value = 0.6
    bpy.ops.mesh.primitive_plane_add(size=size * 8, location=(0, 0, -0.01)); g = bpy.context.object; g.name = "_ground"
    gm = bpy.data.materials.new("ground"); gm.use_nodes = True; gm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.58, 0.55, 0.40, 1); g.data.materials.append(gm)
    bpy.ops.object.light_add(type="SUN", rotation=(math.radians(50), math.radians(10), math.radians(35))); bpy.context.object.data.energy = 3.5; bpy.context.object.name = "_sun"
    d = size * 1.12
    bpy.ops.object.camera_add(location=(d * 1.25, d * 0.55, d * 0.6)); cam = bpy.context.object; cam.name = "_cam"; scn.camera = cam
    from mathutils import Vector
    cam.rotation_euler = (Vector((0, 0, size * 0.18)) - cam.location).to_track_quat("-Z", "Y").to_euler(); cam.data.lens = 40
    scn.frame_start, scn.frame_end = 1, FRAMES; scn.render.fps = FPS

def export(name):
    hide = [o for o in bpy.context.scene.objects if o.name.startswith("_")]
    for o in bpy.context.scene.objects: o.select_set(o.type in ("MESH", "EMPTY") and o not in hide)
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT_GLB, name + ".glb"), export_format="GLB", use_selection=True, export_apply=True, export_yup=True, export_animations=True)

def render_still(name, frame):
    scn = bpy.context.scene; scn.frame_set(frame)
    try: scn.render.image_settings.media_type = "IMAGE"
    except Exception: pass
    scn.render.image_settings.file_format = "PNG"; scn.render.filepath = os.path.join(OUT_PNG, name + ".png")
    bpy.ops.render.render(write_still=True)

def render_movie(name):
    os.makedirs(OUT_ANIM, exist_ok=True)
    scn = bpy.context.scene
    try: scn.render.image_settings.media_type = "VIDEO"   # Blender 5
    except Exception: pass
    scn.render.image_settings.file_format = "FFMPEG"
    scn.render.ffmpeg.format = "MPEG4"; scn.render.ffmpeg.codec = "H264"; scn.render.ffmpeg.constant_rate_factor = "MEDIUM"
    scn.render.filepath = os.path.join(OUT_ANIM, name + ".mp4")
    bpy.ops.render.render(animation=True)

SYSTEMS = {
    "korkut": (korkut, lambda _: anim_korkut(), 9, 50),
    "hisara": (hisara, lambda caps: anim_launcher(caps, 1.0, 55, [(46, 0), (66, 3)], 40), 10, 56),
    "patriot": (patriot, lambda caps: anim_launcher(caps, 2.0, 38, [(52, 1), (74, 2)], 60), 16, 60),
}

if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    movie = "--anim" in argv
    ids = [a for a in argv if not a.startswith("--")] or list(SYSTEMS)
    for i in ids:
        build, anim, size, still = SYSTEMS[i]
        bm.reset(); caps = build(); anim(caps); stage(size)
        export("sys_" + i); render_still("sys_" + i, still)
        if movie: render_movie("sys_" + i)
        print("built", i)
