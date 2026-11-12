"""Render the hat-box proof as registered passes: beauty (RGBA), depth, normal.

    blender -b --python hatbox.py -- --out DIR [--width 1344 --height 768 --frames 121 ...]
    python3 hatbox.py --out DIR ...          (with the `bpy` wheel installed)

Every pass comes from the same mesh, camera and frame, so a video model guided
by depth and the exact beauty render line up pixel for pixel. Depth and normal
are 1-sample emission renders through a material override in the Raw view
transform: deterministic, no compositor, no noise. Positions come only from
geometry.py. Normally run through `python3 -m cinema passes`.
"""
import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import geometry as g  # noqa: E402

# One colour per band, bottom to top (sRGB). Equal areas, visibly distinct.
PALETTE = ['#1b3a8c', '#1f5fbf', '#1c8fd6', '#16b8c9', '#18c79a', '#5fd068',
           '#b6d93c', '#f2d32b', '#f7a928', '#f47a2a', '#ea4a3c', '#c92a6b']
TAN_HALF = 18.0 / 50.0  # 50 mm lens on a 36 mm sensor, along the longer side
TILT = math.radians(18)


def linear(hexcode, gain=1.0):
    out = []
    for n in (1, 3, 5):
        c = int(hexcode[n:n + 2], 16) / 255
        out.append(gain * (c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4))
    return (*out, 1.0)


def emission_override(name, build):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    em = nt.nodes.new('ShaderNodeEmission')
    nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
    nt.links.new(build(nt), em.inputs['Color'])
    return m


def depth_nodes(nt):
    cam = nt.nodes.new('ShaderNodeCameraData')
    mr = nt.nodes.new('ShaderNodeMapRange')
    mr.clamp = True
    mr.inputs['To Min'].default_value, mr.inputs['To Max'].default_value = 1.0, 0.0  # near is white
    nt.links.new(cam.outputs['View Z Depth'], mr.inputs['Value'])
    return mr.outputs['Result']


def normal_nodes(nt):
    geo = nt.nodes.new('ShaderNodeNewGeometry')
    vt = nt.nodes.new('ShaderNodeVectorTransform')
    vt.vector_type, vt.convert_from, vt.convert_to = 'NORMAL', 'WORLD', 'CAMERA'
    mul = nt.nodes.new('ShaderNodeVectorMath')
    mul.operation = 'MULTIPLY_ADD'
    # Cycles camera space looks down +Z; flip it so a surface facing the lens is the usual normal-map blue.
    mul.inputs[1].default_value, mul.inputs[2].default_value = (0.5, 0.5, -0.5), (0.5, 0.5, 0.5)
    nt.links.new(geo.outputs['Normal'], vt.inputs['Vector'])
    nt.links.new(vt.outputs['Vector'], mul.inputs[0])
    return mul.outputs['Vector']


def build(grid):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    mesh = bpy.data.meshes.new('sheet')
    mesh.from_pydata(grid.vertices(0, 0), [], grid.faces())
    for p in mesh.polygons:
        p.use_smooth = True
    col = mesh.color_attributes.new('band', 'FLOAT_COLOR', 'CORNER')
    for p in mesh.polygons:
        i, j = divmod(p.index, grid.segments)
        stripe = (j * 12 // grid.segments) % 2  # meridian stripes make the turn and the unrolling readable
        rgba = linear(PALETTE[grid.band(i) % len(PALETTE)], 1.0 if stripe else 0.72)
        for li in p.loop_indices:
            col.data[li].color = rgba
    obj = bpy.data.objects.new('sheet', mesh)
    scene.collection.objects.link(obj)

    mat = bpy.data.materials.new('bands')
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    attr = nt.nodes.new('ShaderNodeVertexColor')
    attr.layer_name = 'band'
    nt.links.new(attr.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.5
    mesh.materials.append(mat)

    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    cam.data.lens, cam.data.sensor_width, cam.data.sensor_fit = 50, 36, 'AUTO'
    scene.collection.objects.link(cam)
    scene.camera = cam

    for name, loc, energy, size in (('key', (-5, -7, 6), 2600, 7), ('fill', (7, -6, 0), 1000, 9),
                                    ('rim', (0, 6, 5), 1500, 6)):
        light = bpy.data.objects.new(name, bpy.data.lights.new(name, 'AREA'))
        light.data.energy, light.data.size = energy, size
        light.location = loc
        light.rotation_euler = (-Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        scene.collection.objects.link(light)
    world = bpy.data.worlds.new('world')
    world.use_nodes = True
    scene.world = world
    return scene, obj, cam, world


def camera_distance(aspect, pull):
    """Far enough to hold the sphere at pull 0 and the whole 2 pi R sheet at pull 1."""
    wide = aspect >= 1
    half_w = lambda d: d * TAN_HALF * (1 if wide else aspect)   # noqa: E731
    half_h = lambda d: d * TAN_HALF * (1 / aspect if wide else 1)  # noqa: E731
    def fit(need_w, need_h):
        lo, hi = 0.1, 500.0
        for _ in range(60):
            mid = (lo + hi) / 2
            lo, hi = (lo, mid) if half_w(mid) >= need_w and half_h(mid) >= need_h else (mid, hi)
        return hi
    d0 = fit(1.75 * g.R, 1.75 * g.R)
    d1 = fit(1.12 * math.pi * g.R, 1.55 * g.R) + g.R   # the sheet lies in the plane y = -R
    return d0 + (d1 - d0) * pull


def main(argv):
    p = argparse.ArgumentParser()
    p.add_argument('--out', required=True)
    p.add_argument('--width', type=int, default=1344)
    p.add_argument('--height', type=int, default=768)
    p.add_argument('--frames', type=int, default=121)
    p.add_argument('--first', type=int, default=0)
    p.add_argument('--last', type=int)
    p.add_argument('--samples', type=int, default=24)
    p.add_argument('--passes', default='beauty,depth,normal')
    a = p.parse_args(argv)
    out = Path(a.out)
    grid = g.Grid()
    scene, obj, cam, world = build(grid)
    depth = emission_override('depth', depth_nodes)
    normal = emission_override('normal', normal_nodes)
    depth_range = next(n for n in depth.node_tree.nodes if n.type == 'MAP_RANGE')
    background = world.node_tree.nodes['Background']

    r = scene.render
    r.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    r.resolution_x, r.resolution_y, r.resolution_percentage = a.width, a.height, 100
    r.image_settings.file_format = 'PNG'
    layer = scene.view_layers[0]
    flat = [0.0] * (len(obj.data.vertices) * 3)
    last = a.frames - 1 if a.last is None else a.last
    for f in range(a.first, last + 1):
        push, unroll, spin, pull = g.state(f / (a.frames - 1))
        verts = grid.vertices(push, unroll, spin)
        for n, v in enumerate(verts):
            flat[3 * n:3 * n + 3] = v
        obj.data.vertices.foreach_set('co', flat)
        obj.data.update()
        d = camera_distance(a.width / a.height, pull)
        tilt = TILT * (1 - pull)
        cam.location = (0, -d * math.cos(tilt), d * math.sin(tilt))
        cam.rotation_euler = (math.pi / 2 - tilt, 0, 0)
        depth_range.inputs['From Min'].default_value = d - 1.6 * g.R
        depth_range.inputs['From Max'].default_value = d + 1.6 * g.R
        for name in a.passes.split(','):
            data = name != 'beauty'
            layer.material_override = {'depth': depth, 'normal': normal}.get(name)
            r.film_transparent = not data
            r.image_settings.color_mode = 'RGB' if data else 'RGBA'
            scene.view_settings.view_transform = 'Raw' if data else 'Standard'
            scene.cycles.samples = 1 if data else a.samples
            scene.cycles.use_denoising = not data
            # Data passes: pure black world. Beauty: soft grey ambient light, transparent film.
            background.inputs['Color'].default_value = (0, 0, 0, 1) if data else (0.12, 0.13, 0.16, 1)
            r.filepath = str(out / name / f'{f:04d}.png')
            bpy.ops.render.render(write_still=True)
        print(f'frame {f}/{last}', flush=True)


if __name__ == '__main__':
    main(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:])
