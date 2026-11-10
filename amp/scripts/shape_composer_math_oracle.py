"""Independent exact geometric review for AMP's flat shape composer.

Straight pieces are triangulated using integer vertices on a doubled lattice.
Quarter disks retain their exact center, radius and supporting cell. No SVG,
renderer, generator helper, private recipe or approximate raster is consulted.
The public target and tray determine every solution and its guessing chance.
"""

import copy
import json
import math
from collections import Counter
from functools import lru_cache
from fractions import Fraction

SUPPORTED = frozenset({"compose-flat-shape"})
CHOICE_REVIEW = SUPPORTED
REVIEW_RETURNS_ANSWER = True
CORNERS = {"NW": (0, 0), "NE": (2, 0), "SE": (2, 2), "SW": (0, 2)}


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def primitive_cells(cells):
    """Each primitive is ('t', three sorted vertices) or ('q', cell, center)."""
    result = []
    for cell in cells:
        x, y = 2 * cell["x"], 2 * cell["y"]
        corners = [(x, y), (x + 2, y), (x + 2, y + 2), (x, y + 2)]
        center = (x + 1, y + 1)
        fill = cell["fill"]
        if fill.startswith("q:"):
            dx, dy = CORNERS[fill[2:]]
            result.append(("q", (x, y), (x + dx, y + dy)))
        else:
            for a, b in zip(corners, corners[1:] + corners[:1]):
                if fill == "full" or (x + CORNERS[fill[2:]][0], y + CORNERS[fill[2:]][1]) in (a, b):
                    result.append(("t", *sorted((a, b, center))))
    return tuple(result)


def primitive_cell(primitive):
    if primitive[0] == "q":
        return primitive[1]
    return (min(p[0] for p in primitive[1:]) // 2 * 2,
            min(p[1] for p in primitive[1:]) // 2 * 2)


def disjoint(primitives):
    seen = set()
    bins = {}
    for p in primitives:
        if p in seen:
            return False
        seen.add(p)
        cell = primitive_cell(p)
        previous = bins.setdefault(cell, [])
        # Every radius-one corner disk intersects every diagonal quarter
        # triangle in this cell with positive area. Different corner disks
        # also intersect with positive area. Touching boundaries alone is fine.
        if previous and (p[0] == "q" or any(q[0] == "q" for q in previous)):
            return False
        previous.append(p)
    return True


def transform(primitives, rotation=0, flip=False, x=0, y=0):
    require(rotation in (0, 90, 180, 270), "Quarter turns only")

    def move(point):
        a, b = point
        if flip:
            a = -a
        for _ in range(rotation // 90):
            a, b = -b, a
        return a, b

    # Bounding boxes use complete supporting grid cells, not just occupied
    # vertices: a diagonal triangle's anchor is always the same cell corner.
    supports = [primitive_cell(p) for p in primitives]
    bounds = [move((a + dx, b + dy)) for a, b in supports
              for dx, dy in ((0, 0), (2, 0), (2, 2), (0, 2))]
    min_x, min_y = min(p[0] for p in bounds), min(p[1] for p in bounds)

    def offset(point):
        a, b = move(point)
        return a - min_x + 2 * x, b - min_y + 2 * y

    result = []
    for primitive in primitives:
        if primitive[0] == "t":
            result.append(("t", *sorted(offset(p) for p in primitive[1:])))
        else:
            a, b = primitive[1]
            box = [offset((a + dx, b + dy)) for dx, dy in ((0, 0), (2, 0), (2, 2), (0, 2))]
            result.append(("q", (min(p[0] for p in box), min(p[1] for p in box)), offset(primitive[2])))
    return tuple(result)


def placements_for(piece, lattice, target):
    source = primitive_cells(piece["cells"])
    turns = (0, 90, 180, 270) if piece["canRotate"] else (0,)
    flips = (False, True) if piece["canFlip"] else (False,)
    result = []
    for rotation in turns:
        for flip in flips:
            for x in range(lattice["w"]):
                for y in range(lattice["h"]):
                    placed = frozenset(transform(source, rotation, flip, x, y))
                    if placed <= target:
                        result.append((placed, {"pieceId": piece["id"], "copy": 0,
                                               "x": x, "y": y, "rot": rotation, "flip": flip}))
    return result


def solve_stage(stage, lattice):
    """Return an exact cover, total accepted labelled choices, and domain size."""
    raw_target = primitive_cells(stage["target"])
    require(disjoint(raw_target), "Target overlaps itself")
    target = frozenset(raw_target)
    required = {r["pieceId"]: r["count"] for r in stage.get("required", [])}
    kinds = list(required)
    copies = [(piece, copy) for piece in stage["tray"] for copy in range(piece["copies"])]
    options = [placements_for(piece, lattice, target) for piece, _ in copies]
    domain = math.prod(1 + lattice["w"] * lattice["h"] * (4 if p["canRotate"] else 1) * (2 if p["canFlip"] else 1)
                       for p, _ in copies)
    bit = {p: 1 << i for i, p in enumerate(sorted(target))}
    full = (1 << len(bit)) - 1
    masks = [[(sum(bit[p] for p in primitives), placement) for primitives, placement in opts] for opts in options]

    @lru_cache(None)
    def search(index, covered, counts):
        if index == len(copies):
            accepted = covered == full and all(counts[j] == required[k] for j, k in enumerate(kinds))
            return ((), 1) if accepted else (None, 0)
        answer, count = search(index + 1, covered, counts)
        piece, copy = copies[index]
        next_counts = tuple(n + int(k == piece["id"]) for k, n in zip(kinds, counts))
        for mask, candidate in masks[index]:
            if mask & covered:
                continue
            tail, ways = search(index + 1, covered | mask, next_counts)
            count += ways
            if answer is None and tail is not None:
                answer = ({**candidate, "copy": copy},) + tail
        return answer, count

    answer, count = search(0, 0, (0,) * len(kinds))
    return list(answer) if answer is not None else None, count, domain


def validate_placement(stage, lattice, placements):
    require(isinstance(placements, list) and len(placements) <= 6, "Bounded placement list")
    pieces = {p["id"]: p for p in stage["tray"]}
    used, geometry = set(), []
    for p in placements:
        require(set(p) == {"pieceId", "copy", "x", "y", "rot", "flip"}, "Exact placement fields")
        require(p["pieceId"] in pieces, "Unknown piece")
        piece = pieces[p["pieceId"]]
        require(type(p["copy"]) is int and 0 <= p["copy"] < piece["copies"], "Unknown copy")
        identity = p["pieceId"], p["copy"]
        require(identity not in used, "Reused copy")
        used.add(identity)
        require(type(p["x"]) is int and 0 <= p["x"] < lattice["w"] and
                type(p["y"]) is int and 0 <= p["y"] < lattice["h"], "Outside placement anchor")
        require(type(p["rot"]) is int and p["rot"] in (0, 90, 180, 270), "Invalid turn")
        require(piece["canRotate"] or p["rot"] == 0, "Forbidden turn")
        require(type(p["flip"]) is bool and (piece["canFlip"] or not p["flip"]), "Forbidden flip")
        geometry.extend(transform(primitive_cells(piece["cells"]), p["rot"], p["flip"], p["x"], p["y"]))
    require(disjoint(geometry), "Placed pieces overlap")
    require(frozenset(geometry) == frozenset(primitive_cells(stage["target"])), "Target has a gap or overhang")
    counts = Counter(p["pieceId"] for p in placements)
    require(all(counts[q["pieceId"]] == q["count"] for q in stage.get("required", [])), "Named piece requirement")


def polygon_vertices(cells):
    """Recover the outside polygon from triangle edges, removing seams."""
    primitives = primitive_cells(cells)
    if any(p[0] == "q" for p in primitives):
        return None
    edges = Counter()
    for p in primitives:
        a, b, c = p[1:]
        for u, v in ((a, b), (b, c), (c, a)):
            edges[tuple(sorted((u, v)))] += 1
    require(all(n <= 2 for n in edges.values()), "Nonmanifold target")
    adjacency = {}
    for (a, b), n in edges.items():
        if n == 1:
            adjacency.setdefault(a, []).append(b)
            adjacency.setdefault(b, []).append(a)
    require(adjacency and all(len(v) == 2 for v in adjacency.values()), "Target needs one closed outline")
    start = min(adjacency)
    vertices = [start]
    previous, current = start, adjacency[start][0]
    while current != start:
        require(current not in vertices, "Outline crosses itself")
        vertices.append(current)
        next_vertex = next(v for v in adjacency[current] if v != previous)
        previous, current = current, next_vertex
    require(len(vertices) == len(adjacency), "Disconnected outline or a hole")
    return [p for i, p in enumerate(vertices) if cross(sub(p, vertices[i - 1]), sub(vertices[(i + 1) % len(vertices)], p)) != 0]


def sub(a, b):
    return a[0] - b[0], a[1] - b[1]


def cross(a, b):
    return a[0] * b[1] - a[1] * b[0]


def shape_name(cells):
    primitives = primitive_cells(cells)
    quarters = [p for p in primitives if p[0] == "q"]
    if quarters:
        centers = {p[2] for p in quarters}
        require(len(centers) == 1, "Circular pieces must share a center")
        if len(quarters) == 2:
            cx, cy = next(iter(centers))
            directions = [(p[1][0] + 1 - cx, p[1][1] + 1 - cy) for p in quarters]
            require(any(directions[0][axis] == directions[1][axis] for axis in (0, 1)), "Half-circle quarters must be adjacent")
        if len(quarters) != len(primitives):
            require(len(quarters) == 2, "Arch needs one half-circle")
            cx, cy = next(iter(centers))
            directions = [(p[1][0] + 1 - cx, p[1][1] + 1 - cy) for p in quarters]
            sx, sy = {p[0] for p in directions}, {p[1] for p in directions}
            if len(sy) == 1:
                direction = next(iter(sy))
                expected = [{"x": (cx + dx) // 2, "y": (cy if direction < 0 else cy - 2) // 2, "fill": "full"}
                            for dx in (-2, 0)]
            else:
                require(len(sx) == 1, "Half-circle quarters must be adjacent")
                direction = next(iter(sx))
                expected = [{"x": (cx if direction < 0 else cx - 2) // 2, "y": (cy + dy) // 2, "fill": "full"}
                            for dy in (-2, 0)]
            require(set(p for p in primitives if p[0] == "t") == set(primitive_cells(expected)), "Arch base must meet the half-circle diameter")
            return "arch"
        return {1: "quarter-circle", 2: "half-circle", 4: "circle"}.get(len(quarters))
    vertices = polygon_vertices(cells)
    n = len(vertices)
    if n == 3:
        return "triangle"
    if n == 5:
        return "house"
    if n == 6:
        # A school hexagon may be irregular, but must be convex here.
        signs = [cross(sub(vertices[i], vertices[i-1]), sub(vertices[(i+1) % n], vertices[i])) for i in range(n)]
        require(all(v > 0 for v in signs) or all(v < 0 for v in signs), "Hexagon must be convex")
        return "hexagon"
    require(n == 4, f"Unexpected {n}-corner outline")
    sides = [sub(vertices[(i + 1) % n], vertices[i]) for i in range(n)]
    right = all(a[0] * b[0] + a[1] * b[1] == 0 for a, b in zip(sides, sides[1:] + sides[:1]))
    if right:
        lengths = {a*a + b*b for a, b in sides}
        return "square" if len(lengths) == 1 else "rectangle"
    require(sum(cross(sides[i], sides[i + 2]) == 0 for i in range(2)) == 1, "One pair of parallel sides")
    return "trapezoid"


def solve(public):
    response = public["response"]
    answers = []
    for stage in response["stages"]:
        answer, count, _ = solve_stage(stage, response["lattice"])
        require(answer is not None and count > 0, "Public tray cannot fill target")
        answers.append(sorted(answer, key=lambda p: (p["pieceId"], p["copy"])))
    return json.dumps(answers, separators=(",", ":"))


def review_problem(problem):
    public = problem["public"]
    response = public["response"]
    require(response["kind"] == "shape-composer", "Shape composer response")
    lattice, stages = response["lattice"], response["stages"]
    require(lattice == {"w": 5, "h": 4} and 1 <= len(stages) <= 2, "Phone lattice and stage bounds")
    answer = json.loads(problem["answer"])
    require(isinstance(answer, list) and len(answer) == len(stages), "One answer per stage")
    probability = Fraction(1)
    for i, stage in enumerate(stages):
        require(len(stage["prompt"].split()) <= 20, "Stage prompt length")
        require(sum(p["copies"] for p in stage["tray"]) <= 6, "At most six pieces")
        require(len({p["id"] for p in stage["tray"]}) == len(stage["tray"]), "Unique piece identifiers")
        for c in stage["target"]:
            require(0 <= c["x"] < lattice["w"] and 0 <= c["y"] < lattice["h"], "Target outside canvas")
        for piece in stage["tray"]:
            require(disjoint(primitive_cells(piece["cells"])), "Piece overlaps itself")
            require(min(c["x"] for c in piece["cells"]) == 0 and min(c["y"] for c in piece["cells"]) == 0, "Normalized piece origin")
            if piece["kind"] != "composite":
                require(shape_name(piece["cells"]) == piece["kind"], "Piece geometry contradicts its name")
        reference, count, domain = solve_stage(stage, lattice)
        require(reference is not None and count > 0, "Unsolvable public target")
        probability *= Fraction(count, domain)
        validate_placement(stage, lattice, answer[i])
        # Search with the distractor required, even if a named-piece prompt
        # would otherwise make that extra piece irrelevant by wording.
        extras = [p for p in stage["tray"] if p["id"] == "extra"]
        if extras:
            with_extra = {**stage, "required": [{"pieceId": "extra", "count": 1}]}
            require(solve_stage(with_extra, lattice)[1] == 0, "Distractor participates in an exact cover")
    require(math.isclose(response["guessChance"], float(probability), rel_tol=1e-12, abs_tol=0), "Declared guessing chance differs from exact enumeration")
    if len(stages) == 2:
        joined = [p for p in stages[1]["tray"] if p["kind"] == "composite"]
        require(len(joined) == 1 and joined[0]["copies"] == 2, "Stage two needs two composite copies")
        target = frozenset(transform(primitive_cells(stages[0]["target"])))
        source = primitive_cells(joined[0]["cells"])
        require(any(frozenset(transform(source, turn)) == target for turn in (0, 90, 180, 270)), "Composite does not match the first target")
        first_name = shape_name(stages[0]["target"])
        require(joined[0]["name"] == first_name, "Composite label contradicts shape")
        second_name = shape_name(stages[1]["target"])
        require(second_name == {"square": "rectangle", "rectangle": "square", "half-circle": "circle", "trapezoid": "hexagon", "triangle": "square"}[first_name], "Second construction has the wrong shape")
    first_name = shape_name(stages[0]["target"])
    require(any(f"make a {first_name}." in line for line in problem["explanation"]), "Explanation misnames the target")
    # Exact tilings are not unique. The independent search proves existence;
    # validate_placement checks the supplied key against the public geometry.
    # Return that accepted representative for the generic string comparator.
    return problem["answer"]


def self_test():
    cell = lambda fill: {"x": 0, "y": 0, "fill": fill}
    square = primitive_cells([cell("full")])
    nw = primitive_cells([cell("h:NW")])
    se = primitive_cells([cell("h:SE")])
    disk = primitive_cells([cell("q:SW")])
    require(disjoint(nw + se) and set(nw + se) == set(square), "Complementary triangles tile a square")
    require(not disjoint(nw + nw), "Coincident triangles overlap")
    require(not disjoint(disk + nw), "A quarter disk intersects a diagonal half")
    require(frozenset(transform(nw, 180)) == frozenset(se), "Exact clockwise half-turn")
    for fill in ("full", "h:NW", "h:NE", "h:SE", "h:SW", "q:NW", "q:NE", "q:SE", "q:SW"):
        original = primitive_cells([cell(fill)])
        require(set(transform(transform(original, 90), 270)) == set(original), "Rotation inverse")
        require(set(transform(transform(original, flip=True), flip=True)) == set(original), "Reflection inverse")
    piece = {"id": "t", "name": "triangle", "kind": "triangle", "cells": [cell("h:NW")], "canRotate": True, "canFlip": False, "copies": 2}
    stage = {"prompt": "Fill the outline.", "target": [cell("full")], "tray": [piece]}
    answer, count, domain = solve_stage(stage, {"w": 5, "h": 4})
    require(count == 4 and domain == 81**2, "Four ordered quarter-turn pairs fill the square")
    validate_placement(stage, {"w": 5, "h": 4}, answer)
    require(shape_name([cell("full")]) == "square", "Square name from boundary")
    return 24


if __name__ == "__main__":
    import sys
    self_test()
    cases = [json.loads(line) for line in sys.stdin if line.strip()]
    checked = 0
    for problem in cases:
        review_problem(problem)
        for change in ("gap", "overlap", "outside", "guess"):
            bad = copy.deepcopy(problem)
            if change == "guess":
                bad["public"]["response"]["guessChance"] *= 2
            else:
                placements = json.loads(bad["answer"])
                if change == "gap":
                    placements[0].pop()
                elif change == "overlap":
                    placements[0].append(dict(placements[0][0]))
                else:
                    placements[0][0]["x"] = 5
                bad["answer"] = json.dumps(placements, separators=(",", ":"))
            try:
                review_problem(bad)
            except (AssertionError, ValueError):
                checked += 1
            else:
                raise AssertionError(f"Accepted corrupted {change} case")
    print(f"Verified {len(cases)} compositions and rejected {checked} corrupted cases")
