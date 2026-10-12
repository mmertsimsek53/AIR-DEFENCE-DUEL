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

# ---------------------------------------------------------------- shared parts
def tracked_hull(L=6.6, W=3.0, H=1.15):
    """ACV-30 style tracked carrier: hull with sloped glacis, tracks with road wheels and side skirts."""
    box(W - 0.5, L - 1.4, H, 0, -0.55, 0.55, "army", 0.08)                                                    # hull
    f = box(W - 0.5, 1.5, H * 0.75, 0, L / 2 - 1.05, 0.55, "army", 0.08); f.rotation_euler = (math.radians(-14), 0, 0)  # sloped nose
    for sx in (-1, 1):
        box(0.55, L, 0.75, sx * (W / 2 - 0.27), 0, 0.05, "black", 0.12)                                       # track
        for k in range(6): cyl(0.33, 0.3, sx * (W / 2 - 0.27), -L / 2 + 0.75 + k * (L - 1.5) / 5, 0.23, "gunmetal", 14, 0.02, ry=math.pi / 2)
        box(0.08, L - 0.4, 0.45, sx * (W / 2 + 0.02), -0.1, 0.6, "army_dk", 0.02)                              # side skirt
    box(0.5, 0.06, 0.22, -0.7, L / 2 - 0.45, 1.25, "glass", 0.01)                                                  # driver's periscope block

def radar_mast(parent, x, y, z, h, w, d, rate_turns, name="radar"):
    """Mast with a spinning flat antenna on top. Returns the spinning pivot."""
    attach(parent, cyl(0.12, h, x, y, z, "steel", 10, 0.01))
    r = pivot(name, x, y, z + h, parent)
    attach(r, box(w, 0.14, d, 0, 0, 0.05, "radar_face", 0.02), box(w + 0.1, 0.06, 0.08, 0, -0.08, 0.05 + d, "army_dk", 0.01),
           box(0.25, 0.3, 0.2, 0, -0.1, -0.05, "gunmetal", 0.02))
    return r

def flash(parent, name, x, y, z, length=1.0, width=0.35):
    """Muzzle flash / rocket flame: emissive cone pointing along +Y, hidden (scale 0) until fired."""
    f = pivot(name, x, y, z, parent)
    c = cyl(width, length, 0, 0, -length / 2, mat("flame", 0.5, 0, 8.0), 10, 0, r2=0.02); c.rotation_euler = (math.radians(-90), 0, 0); c.location = (0, length / 2, 0)
    attach(f, c)
    f.scale = (0, 0, 0)
    return f

def puff(parent, name, x, y, z, s=0.6):
    p = pivot(name, x, y, z, parent); attach(p, sphere(s, 0, 0, 0, mat("concrete", 0.9))); p.scale = (0, 0, 0); return p

# ---------------------------------------------------------------- systems
def korkut():
    """Korkut: 35 mm twin-gun turret on a tracked carrier, search radar on the turret. Fires airburst bursts."""
    tracked_hull()
    tur = pivot("turret", 0, -0.4, 1.7)
    attach(tur, box(2.5, 2.7, 0.95, 0, 0, 0, "army", 0.08), box(2.2, 0.9, 0.5, 0, -1.4, 0.15, "army_dk", 0.05),
           box(0.5, 0.4, 0.35, 0.85, 0.9, 0.9, "gunmetal", 0.04), box(0.32, 0.05, 0.2, 0.85, 1.12, 1.0, "glass", 0.01))  # EO sight
    ele = pivot("elevation", 0, 1.0, 0.55, tur)
    attach(ele, box(1.3, 0.8, 0.6, 0, 0, -0.3, "army_dk", 0.06))
    bar = pivot("barrels", 0, 0, 0, ele)
    for sx in (-1, 1):
        attach(bar, cyl(0.09, 3.0, sx * 0.48, 1.6, -1.5, "gunmetal", 12, 0.0, rx=math.pi / 2), cyl(0.15, 0.4, sx * 0.48, 3.05, -0.2, "black", 12, 0.01, rx=math.pi / 2))
        flash(bar, f"flash_{'l' if sx < 0 else 'r'}", sx * 0.48, 3.3, 0, 1.1, 0.32)
    radar_mast(tur, 0, -1.25, 0.95, 0.9, 1.5, 0.6, 1)

def hisara():
    """Hisar-A+: tracked carrier with a turret holding 4 missile canisters on an elevating launcher; search radar mast."""
    tracked_hull()
    tur = pivot("turret", 0, -0.6, 1.7)
    attach(tur, box(2.2, 2.2, 0.55, 0, 0, 0, "army", 0.06), sphere(0.32, 1.25, 0.4, 0.75, "gunmetal"), box(0.35, 0.05, 0.25, 1.25, 0.7, 0.62, "glass", 0.01))
    ele = pivot("elevation", 0, -0.9, 0.75, tur)
    attach(ele, box(1.7, 3.4, 0.12, 0, 1.4, -0.12, "army_dk", 0.03))
    caps = []
    for i, (cx, cz) in enumerate([(-0.42, 0.25), (0.42, 0.25), (-0.42, 0.78), (0.42, 0.78)]):
        attach(ele, box(0.48, 3.3, 0.48, cx, 1.45, cz - 0.24, "canister", 0.03))
        cap = pivot(f"cap_{i}", cx, 3.12, cz, ele); attach(cap, box(0.44, 0.05, 0.44, 0, 0, -0.22, "army_dk", 0.01)); caps.append(cap)
    radar_mast(tur, 0.75, -1.0, 0.55, 1.6, 1.4, 0.9, 1)
    return caps

def patriot():
    """Patriot: M903 launcher on a semi-trailer (4 PAC-3 MSE canisters, raises to fire) plus a separate radar trailer
    with a large phased-array face that turns (LTAMDS-style all-round radar)."""
    # tractor + trailer
    box(2.5, 2.8, 1.6, 0, 6.1, 0.9, "army", 0.08); box(2.3, 0.06, 0.6, 0, 7.52, 1.75, "glass", 0.01)            # cab
    box(2.6, 9.0, 0.5, 0, 0.2, 1.0, "army_dk", 0.05)                                                            # trailer bed
    for y in (6.6, 5.3, -2.8, -3.9):
        for sx in (-1, 1): cyl(0.55, 0.45, sx * 1.15, y, 0.33, "black", 16, 0.03, ry=math.pi / 2)
    for sx in (-1, 1): box(0.2, 0.3, 1.0, sx * 1.1, 3.0, 0.1, "steel", 0.02)                                    # outriggers
    tur = pivot("turret", 0, -1.6, 1.5)
    attach(tur, box(2.4, 1.6, 0.35, 0, 0, 0, "army", 0.04))
    ele = pivot("elevation", 0, -0.6, 0.4, tur)                                                                 # hinge at the rear
    caps = []
    for i, (cx, cz) in enumerate([(-0.55, 0.0), (0.55, 0.0), (-0.55, 1.05), (0.55, 1.05)]):
        attach(ele, box(1.0, 6.2, 1.0, cx, 3.1, cz, "canister", 0.04))
        cap = pivot(f"cap_{i}", cx, 6.22, cz + 0.5, ele); attach(cap, box(0.92, 0.05, 0.92, 0, 0, -0.46, "army_dk", 0.01)); caps.append(cap)
    attach(ele, box(2.3, 0.3, 2.3, 0, 0.1, -0.15, "army_dk", 0.03))
    # radar trailer to the side
    rt = pivot("radar_trailer", 7.5, -4.0, 0)
    attach(rt, box(2.4, 5.5, 0.5, 0, 0, 0.9, "army_dk", 0.05), box(2.2, 2.0, 1.3, 0, 1.6, 1.4, "army", 0.06))
    for y in (-1.6, -0.5):
        for sx in (-1, 1): attach(rt, cyl(0.5, 0.4, sx * 1.1, y, 0.3, "black", 16, 0.03, ry=math.pi / 2))
    r = pivot("radar", 0, -0.6, 1.45, rt)
    attach(r, cyl(0.7, 0.4, 0, 0, 0, "gunmetal", 20, 0.02))
    face = pivot("radar_face", 0, 0, 0.4, r); face.rotation_euler = (math.radians(-18), 0, 0)
    attach(face, box(3.6, 0.45, 3.4, 0, 0, 0, "army", 0.06), box(3.3, 0.06, 3.1, 0, 0.24, 0.15, "radar_face", 0.01))
    for k in range(1, 6): attach(face, box(3.3, 0.07, 0.03, 0, 0.26, 0.15 + k * 0.52, "army_dk", 0))
    return caps

# ---------------------------------------------------------------- demo animations
def missile(parent, name, x, y, z, L=2.6, r=0.18):
    """A missile hidden inside its canister (scale 0) that is launched along the launcher's +Y."""
    m = pivot(name, x, y, z, parent)
    attach(m, cyl(r, L, 0, 0, -L / 2, "missile_white", 12, 0.0, rx=math.pi / 2), cyl(r, 0.5, 0, L / 2 + 0.25, -0.25, "missile_white", 12, 0, r2=0.02, rx=-math.pi / 2))
    flash(m, name + "_flame", 0, -L / 2, 0, 1.6, r * 1.6).rotation_euler = (0, 0, math.pi)
    m.scale = (0, 0, 0)
    return m

def fire_missile(m, cap, f, dist, frames=14):
    """Cap pops, the missile leaves the canister with its flame on and smoke left behind."""
    o = cap.location.copy(); loc(cap, f - 1, o.x, o.y, o.z); loc(cap, f + 6, o.x + 0.3, o.y + 2.5, o.z - 1.8)
    scl(m, f - 1, 0); scl(m, f, 1)
    fl = bpy.data.objects[m.name + "_flame"]; scl(fl, f - 1, 0); scl(fl, f, 1)
    s = m.location.copy(); loc(m, f, s.x, s.y, s.z); loc(m, f + frames, s.x, s.y + dist, s.z)
    r = 0.22 * (m.scale.x or 1)
    for i in range(5):                                       # small smoke puffs left behind at the canister mouth, growing then gone
        p = puff(m.parent, f"{m.name}_smoke{i}", s.x + (i % 2 - 0.5) * 0.3, s.y + 1.6 + i * 0.9, s.z, 0.25 * (1 + 0.15 * i))
        scl(p, f + i - 1, 0); scl(p, f + i, 1); scl(p, f + 18, 1.8); scl(p, f + 30, 0)

def anim_korkut():
    tur, ele, bar = (bpy.data.objects[n] for n in ("turret", "elevation", "barrels"))
    spin(bpy.data.objects["radar"], 1, FRAMES + 1, 2)
    rot(tur, 1, z=0); rot(tur, 26, z=48)
    rot(ele, 6, x=0); rot(ele, 30, x=32)
    for f in (36, 40, 44, 48, 62, 66, 70, 74):
        loc(bar, f - 1, 0, 0, 0); loc(bar, f, 0, -0.35, 0); loc(bar, f + 2, 0, 0, 0)
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
