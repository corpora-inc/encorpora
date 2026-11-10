"""Recount the visible cells and cross-check the printable figure and its units.

The existing area oracle independently reads the scene geometry, prompt and
row explanations. Neither route uses the generator's stored answer to solve.
"""
import copy
import area_by_counting_math_oracle as area

SUPPORTED = frozenset({"mark-unit-squares", "mark-improvised-units"})
BASE = {"mark-unit-squares": "count-unit-squares", "mark-improvised-units": "improvised-unit-count"}
TILES = {"sticky": "sticky note", "tile": "square tile", "card": "square card",
         "napkin": "square napkin", "cracker": "square cracker"}


def checked_public(public):
    response = public["response"]
    area.require(public["templateId"] in SUPPORTED, "Known marking family")
    area.require(response["kind"] == "unit-square-marking", "Interactive counting surface")
    cols, rows = response["cols"], response["rows"]
    area.require(type(cols) is int and type(rows) is int and 2 <= cols <= 5 and 2 <= rows <= 6, "Phone-sized grid")
    cells = response["cells"]
    area.require(all(len(cell) == 2 and all(type(v) is int for v in cell) for cell in cells), "Whole cell coordinates")
    cells = [tuple(cell) for cell in cells]
    area.require(len(set(cells)) == len(cells) and 6 <= len(cells) <= 30, "Distinct square units")
    area.require(all(0 <= c < cols and 0 <= r < rows for c, r in cells), "Cells inside grid")
    area.require(area.connected(cells), "One connected shape")
    standard = public["templateId"] == "mark-unit-squares"
    area.require(response["showEmptyGrid"] is standard, "Only standard grids show surrounding cells")
    scene = public["figure"]["scene"]
    if standard:
        drawn, width, height = area.unit_cells(scene)
        area.require((cols, rows) == (width, height), "Interactive and print dimensions agree")
        area.require(response["tile"] == "square", "Standard unit square")
    else:
        surface, _, _ = area.covering(scene)
        height = max(y for _, y in surface) + 1
        drawn = [(int(x), int(height - 1 - y)) for x, y in surface]
        area.require(cols == max(x for x, _ in surface) + 1 and rows == height, "Surface dimensions agree")
        area.require(response["unit"] == f"1 {TILES[response['tile']]}", "Glyph and unit agree")
    area.require(set(cells) == set(drawn), "Interactive cells match the printable shape")
    area.require(area.legend_of(scene) == f"= {response['unit']}", "Interactive and printed units agree")
    base = copy.deepcopy(public)
    base["templateId"] = BASE[public["templateId"]]
    base["response"] = {"kind": "number", "label": response["label"]}
    return base, str(len(cells))


def solve(public):
    base, count = checked_public(public)
    area.require(area.solve(base) == count, "Independent figure recount agrees")
    return count


def review_problem(problem):
    base, count = checked_public(problem["public"])
    legacy = {**problem, "public": base}
    area.require(area.review_problem(legacy) == count, "Answer and explanation match the drawn units")
    return count


def self_test():
    cells = [(0, 0), (1, 0), (2, 0), (0, 1), (1, 1), (0, 2)]
    public = {"templateId": "mark-unit-squares",
              "prompt": "Each small square is 1 square foot. The shaded shape is the patio. What is the area of the patio?",
              "figure": {"kind": "scene", "scene": area.grid_scene(cells, 3, 3, "square foot", [3, 2, 1])},
              "response": {"kind": "unit-square-marking", "label": "square feet", "unit": "1 square foot",
                           "cols": 3, "rows": 3, "cells": cells, "tile": "square", "showEmptyGrid": True}}
    area.require(solve(public) == "6", "Hand-counted staircase")
    mutations = [
        {"cells": cells[:-1] + [(2, 2)]},
        {"cells": cells + [cells[0]]},
        {"unit": "1 square inch"},
        {"label": "feet"},
        {"cols": 7},
        {"tile": "sticky"},
        {"showEmptyGrid": False},
    ]
    for change in mutations:
        corrupt = copy.deepcopy(public)
        corrupt["response"].update(change)
        try:
            solve(corrupt)
        except (ValueError, KeyError):
            continue
        raise AssertionError(f"Accepted corrupt marking response: {change}")
    return {"fixtures": 1, "mutations": len(mutations)}
