#!/usr/bin/env python3
"""
Convert Corpan logo SVG to a single hierarchical GLB.
Coordinate policy:
- Blender Z is vertical (up). Blender Y is depth (forward/back).
- We rotate meshes +90deg around X to neutralize glTF axis conversion.
- EarPivot is positioned above the pyramid in Blender Z, so it maps to Babylon Y.
"""

import math
from pathlib import Path

import bpy
from mathutils import Vector

SCRIPT_DIR = Path(__file__).resolve().parent
CORPAN_DIR = SCRIPT_DIR.parents[3]
SVG_PATH = CORPAN_DIR / "corpan" / "logo_mesh_hifi.svg"
OUTPUT_DIRS = [
    SCRIPT_DIR.parent / "src" / "assets" / "models",
]

# Final sizes
TARGET_PYRAMID_WIDTH = 1.35
PYRAMID_DEPTH = 0.18
EAR_EXTRUDE = 0.07
STEP_COUNT = 4
EAR_GAP = 0.06
SPIRAL_FRONT_OFFSET = 0.03

ROOT_NAME = "corpan_logo_root"
PYRAMID_ROOT_NAME = "corpan_pyramid_root"
EAR_PIVOT_NAME = "corpan_ear_pivot"
EXPORT_NAME = "corpan_logo.glb"


def clean_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def enable_svg_import():
    if "io_curve_svg" not in bpy.context.preferences.addons:
        bpy.ops.preferences.addon_enable(module="io_curve_svg")


def import_svg(filepath: Path):
    before = set(bpy.data.objects)
    bpy.ops.import_curve.svg(filepath=str(filepath))
    return [obj for obj in bpy.data.objects if obj not in before and obj.type == "CURVE"]


def find_curve(curves, key: str):
    key = key.lower()
    for obj in curves:
        if key in obj.name.lower() or key in obj.data.name.lower():
            return obj
    return None


def split_curve_splines(obj):
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
    bbox = obj.bound_box
    min_x = min(v[0] for v in bbox)
    max_x = max(v[0] for v in bbox)
    min_y = min(v[1] for v in bbox)
    max_y = max(v[1] for v in bbox)
    return (max_x - min_x) * (max_y - min_y)


def convert_curve_to_mesh(obj, depth):
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


def apply_transform(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    obj.select_set(False)


def bounds_for_objects(objects):
    corners = []
    for obj in objects:
        corners.extend([obj.matrix_world @ Vector(v) for v in obj.bound_box])
    min_v = Vector((
        min(v.x for v in corners),
        min(v.y for v in corners),
        min(v.z for v in corners),
    ))
    max_v = Vector((
        max(v.x for v in corners),
        max(v.y for v in corners),
        max(v.z for v in corners),
    ))
    center = (min_v + max_v) * 0.5
    return min_v, max_v, center


def create_empty(name, parent=None):
    empty = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(empty)
    if parent:
        empty.parent = parent
    return empty


def export_gltf(root, filename):
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for child in root.children_recursive:
        child.select_set(True)
    bpy.context.view_layer.objects.active = root

    for output_dir in OUTPUT_DIRS:
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = output_dir / filename
        bpy.ops.export_scene.gltf(
            filepath=str(output_path),
            use_selection=True,
            export_format="GLB",
            export_materials="EXPORT",
        )
    print(f"✓ Exported: {filename}")


def main():
    print("=" * 60)
    print("Corpan Logo -> 3D (Single GLB)")
    print("=" * 60)

    if not SVG_PATH.exists():
        print(f"ERROR: SVG not found: {SVG_PATH}")
        return

    clean_scene()
    enable_svg_import()

    curves = import_svg(SVG_PATH)
    base_curve = find_curve(curves, "base")
    ear_curve = find_curve(curves, "ear")
    spiral_curve = find_curve(curves, "spiral")

    if not base_curve or not ear_curve or not spiral_curve:
        print("ERROR: Missing curves")
        return

    root = create_empty(ROOT_NAME)
    pyramid_root = create_empty(PYRAMID_ROOT_NAME, root)
    ear_pivot = create_empty(EAR_PIVOT_NAME, root)

    print("\n1. Build pyramid steps")
    base_splines = split_curve_splines(base_curve)
    bpy.data.objects.remove(base_curve, do_unlink=True)
    base_splines.sort(key=curve_bbox_area, reverse=True)

    steps = []
    for index, curve in enumerate(base_splines[:STEP_COUNT], start=1):
        mesh = convert_curve_to_mesh(curve, PYRAMID_DEPTH)
        mesh.name = f"pyramid_step_{index}"
        mesh.rotation_euler.x = math.pi / 2
        apply_transform(mesh)
        mesh.parent = pyramid_root
        steps.append(mesh)

    for curve in base_splines[STEP_COUNT:]:
        bpy.data.objects.remove(curve, do_unlink=True)

    bpy.context.view_layer.update()

    print("2. Scale pyramid to target width")
    step_min, step_max, _ = bounds_for_objects(steps)
    current_width = step_max.x - step_min.x
    scale_factor = TARGET_PYRAMID_WIDTH / current_width if current_width > 0 else 1
    for step in steps:
        step.scale *= scale_factor
        apply_transform(step)

    bpy.context.view_layer.update()

    print("3. Center pyramid at X=0, Y=0, ground at Z=0")
    step_min, step_max, _ = bounds_for_objects(steps)
    pyramid_offset = Vector((
        -(step_min.x + step_max.x) / 2,
        -(step_min.y + step_max.y) / 2,
        -step_min.z,
    ))
    for step in steps:
        step.location += pyramid_offset
        apply_transform(step)

    bpy.context.view_layer.update()
    step_min, step_max, pyramid_center = bounds_for_objects(steps)
    pyramid_top_z = step_max.z
    print(f"   Pyramid top Z: {pyramid_top_z:.3f}")

    print("\n4. Build ear + spiral")
    ear = convert_curve_to_mesh(ear_curve, EAR_EXTRUDE)
    ear.name = "ear_outer"
    spiral = convert_curve_to_mesh(spiral_curve, EAR_EXTRUDE * 0.5)
    spiral.name = "ear_spiral"

    for obj in (ear, spiral):
        obj.rotation_euler.x = math.pi / 2
        obj.scale *= scale_factor
        apply_transform(obj)

    bpy.context.view_layer.update()

    print("5. Center ear on its own bounds")
    ear_min, ear_max, ear_center = bounds_for_objects([ear, spiral])
    for obj in (ear, spiral):
        obj.location -= ear_center
        apply_transform(obj)

    bpy.context.view_layer.update()

    print("6. Nudge spiral forward for depth")
    spiral.location.y += SPIRAL_FRONT_OFFSET
    apply_transform(spiral)

    bpy.context.view_layer.update()
    ear_min, ear_max, _ = bounds_for_objects([ear, spiral])
    ear_height = ear_max.z - ear_min.z

    print("7. Position ear pivot above pyramid")
    ear.parent = ear_pivot
    spiral.parent = ear_pivot
    ear_pivot.location = Vector((
        pyramid_center.x,
        pyramid_center.y,
        pyramid_top_z + EAR_GAP + ear_height * 0.5,
    ))

    print("\n8. Exporting GLB")
    export_gltf(root, EXPORT_NAME)

    print("\n" + "=" * 60)
    print("✓ Complete")
    print("=" * 60)


if __name__ == "__main__":
    main()
