#!/usr/bin/env python3
"""
Convert Corpán logo SVG to 3D meshes for Hover Runner game.
Creates 6 meshes: 4 pyramid steps + 2 ear parts (outer ear + inner spiral).

Usage: blender --background --python svg_to_3d.py
"""

import math
from pathlib import Path

import bpy
from mathutils import Vector

# Configuration
SVG_PATH = Path(__file__).parent.parent.parent.parent / "logo_mesh_hifi.svg"
OUTPUT_DIRS = [
    Path(__file__).parent.parent / "public" / "models" / "corpan-logo",
    Path(__file__).parent.parent / "src" / "assets" / "models",
]
for output_dir in OUTPUT_DIRS:
    output_dir.mkdir(parents=True, exist_ok=True)

TARGET_BASE_WIDTH = 1.35
PYRAMID_EXTRUDE = 0.12
EAR_EXTRUDE = 0.07
SPIRAL_TUBE_RADIUS = 0.01
STEP_HEIGHT = 0.11
EAR_LIFT = 0.06
SPIRAL_FRONT_OFFSET = -0.05
STEP_ROTATION = math.pi / 2
EAR_ROTATION = math.pi / 2


def clean_scene():
    """Remove default objects."""
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def enable_svg_import():
    """Enable SVG import addon if needed."""
    if "io_curve_svg" not in bpy.context.preferences.addons:
        bpy.ops.preferences.addon_enable(module="io_curve_svg")


def import_svg(filepath: Path):
    """Import SVG and return new curve objects."""
    before = set(bpy.data.objects)
    bpy.ops.import_curve.svg(filepath=str(filepath))
    return [
        obj
        for obj in bpy.data.objects
        if obj not in before and obj.type == "CURVE"
    ]


def find_curve(curves, key: str):
    """Find curve object by name or data name."""
    key = key.lower()
    for obj in curves:
        if key in obj.name.lower() or key in obj.data.name.lower():
            return obj
    return None


def split_curve_splines(obj):
    """Split a curve object into one object per spline."""
    splits = []
    for index in range(len(obj.data.splines)):
        dup = obj.copy()
        dup.data = obj.data.copy()
        bpy.context.collection.objects.link(dup)
        for spline_index in reversed(range(len(dup.data.splines))):
            if spline_index != index:
                dup.data.splines.remove(dup.data.splines[spline_index])
        splits.append(dup)
    return splits


def curve_bbox_area(obj):
    """Compute rough area from curve bounds."""
    size = curve_bbox_size(obj)
    return size.x * size.y


def curve_bbox_size(obj):
    bbox = obj.bound_box
    min_x = min(v[0] for v in bbox)
    max_x = max(v[0] for v in bbox)
    min_y = min(v[1] for v in bbox)
    max_y = max(v[1] for v in bbox)
    return Vector((max_x - min_x, max_y - min_y, 0))


def convert_curve_to_mesh(obj, depth):
    """Convert curve to mesh and apply centered thickness."""
    obj.data.dimensions = "2D"
    obj.data.fill_mode = "BOTH"
    obj.data.resolution_u = 24

    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target="MESH")

    solidify = obj.modifiers.new(name="Solidify", type="SOLIDIFY")
    solidify.thickness = depth
    solidify.offset = 0
    bpy.ops.object.modifier_apply(modifier=solidify.name)
    obj.select_set(False)
    return obj


def convert_curve_to_tube(obj, radius):
    """Convert a curve to a beveled tube mesh."""
    obj.data.dimensions = "2D"
    obj.data.fill_mode = "NONE"
    obj.data.bevel_depth = radius
    obj.data.bevel_resolution = 6
    obj.data.resolution_u = 24

    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target="MESH")
    obj.select_set(False)
    return obj


def apply_transform(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    obj.select_set(False)


def bounds_for_objects(objs):
    min_v = Vector((math.inf, math.inf, math.inf))
    max_v = Vector((-math.inf, -math.inf, -math.inf))
    for obj in objs:
        for corner in obj.bound_box:
            world = obj.matrix_world @ Vector(corner)
            min_v = Vector(
                (min(min_v.x, world.x), min(min_v.y, world.y), min(min_v.z, world.z))
            )
            max_v = Vector(
                (max(max_v.x, world.x), max(max_v.y, world.y), max(max_v.z, world.z))
            )
    return min_v, max_v


def mesh_bbox_area(obj):
    size = curve_bbox_size(obj)
    return size.x * size.y


def export_gltf(obj, filename):
    """Export object as GLTF 2.0."""
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj

    for output_dir in OUTPUT_DIRS:
        output_path = output_dir / filename
        bpy.ops.export_scene.gltf(
            filepath=str(output_path),
            use_selection=True,
            export_format="GLB",
            export_materials="EXPORT",
        )
        print(f"✓ Exported: {output_path}")


def main():
    print("=" * 60)
    print("Corpán Logo → 3D Mesh Converter")
    print("=" * 60)

    clean_scene()
    enable_svg_import()

    print(f"\nImporting SVG: {SVG_PATH}")
    curves = import_svg(SVG_PATH)
    if not curves:
        print("No curves imported. Check SVG or Blender SVG importer.")
        return

    base_curve = find_curve(curves, "base")
    ear_curve = find_curve(curves, "ear")
    spiral_curve = find_curve(curves, "spiral")

    if not base_curve or not ear_curve or not spiral_curve:
        print("Missing required curves. Found:")
        for curve in curves:
            print(f"  - {curve.name}")
        return

    print("\n📐 Building pyramid steps...")
    base_splines = split_curve_splines(base_curve)
    bpy.data.objects.remove(base_curve, do_unlink=True)
    base_splines.sort(key=curve_bbox_area, reverse=True)

    step_curves = base_splines[1:5]
    for extra in base_splines[5:]:
        bpy.data.objects.remove(extra, do_unlink=True)

    steps = []
    for index, curve in enumerate(step_curves, start=1):
        mesh = convert_curve_to_mesh(curve, PYRAMID_EXTRUDE)
        steps.append(mesh)

    print("\n👂 Building ear + spiral...")
    ear = convert_curve_to_mesh(ear_curve, EAR_EXTRUDE)
    ear.name = "ear_outer"
    spiral = convert_curve_to_tube(spiral_curve, SPIRAL_TUBE_RADIUS)
    spiral.name = "ear_spiral"

    # Ensure steps are ordered largest (base) to smallest (top)
    steps.sort(key=mesh_bbox_area, reverse=True)
    for index, obj in enumerate(steps, start=1):
        obj.name = f"pyramid_step_{index}"

    # Lay pyramid steps flat to become 3D tiers
    for obj in steps:
        obj.rotation_euler.x = STEP_ROTATION

    # Stand the ear up so it faces the camera
    ear.rotation_euler.x = EAR_ROTATION
    spiral.rotation_euler.x = EAR_ROTATION

    all_objs = steps + [ear, spiral]

    # Scale to target size based on the largest step width
    base_size = curve_bbox_size(steps[0])
    scale_factor = TARGET_BASE_WIDTH / base_size.x if base_size.x else 1
    for obj in all_objs:
        obj.scale *= scale_factor

    # Stack pyramid tiers upward
    for index, obj in enumerate(steps):
        obj.location.y = index * STEP_HEIGHT

    bpy.context.view_layer.update()

    # Place the ear above the pyramid
    step_min, step_max = bounds_for_objects(steps)
    ear_min, ear_max = bounds_for_objects([ear])
    ear.location.y += step_max.y - ear_min.y + EAR_LIFT

    bpy.context.view_layer.update()

    # Center the spiral within the ear and pull it slightly toward the camera
    ear_min, ear_max = bounds_for_objects([ear])
    spiral_min, spiral_max = bounds_for_objects([spiral])
    ear_center = Vector(
        (
            (ear_min.x + ear_max.x) / 2,
            (ear_min.y + ear_max.y) / 2,
            (ear_min.z + ear_max.z) / 2,
        )
    )
    spiral_center = Vector(
        (
            (spiral_min.x + spiral_max.x) / 2,
            (spiral_min.y + spiral_max.y) / 2,
            (spiral_min.z + spiral_max.z) / 2,
        )
    )
    spiral.location += ear_center - spiral_center
    spiral.location.z += SPIRAL_FRONT_OFFSET

    bpy.context.view_layer.update()

    # Center and ground the logo
    min_v, max_v = bounds_for_objects(all_objs)
    center_x = (min_v.x + max_v.x) / 2
    center_z = (min_v.z + max_v.z) / 2
    offset = Vector((-center_x, -min_v.y, -center_z))
    for obj in all_objs:
        obj.location += offset

    # Bake transforms before export
    for obj in all_objs:
        apply_transform(obj)

    print("\n📦 Exporting GLBs...")
    for obj in steps:
        export_gltf(obj, f"{obj.name}.glb")
    export_gltf(ear, "ear_outer.glb")
    export_gltf(spiral, "ear_spiral.glb")

    print("\n" + "=" * 60)
    print("✓ Conversion complete!")
    print("✓ Output directories:")
    for output_dir in OUTPUT_DIRS:
        print(f"  - {output_dir}")
    print("=" * 60)


if __name__ == "__main__":
    main()
