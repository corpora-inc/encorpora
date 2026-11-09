"""Independent review of the area-by-counting family (3.MD.C.6) from public
payloads only.

The area is recounted from the drawn figure: the unit squares of the shaded
`cells` path, or the tiles of a covering checked cell by cell against the
surface outline (a cell belongs to the surface when its center lies inside
the outline). Units come from the prompt and legend. The private answer,
hint and explanation are only values under test.
"""

import copy
import json
import re
import sys
from fractions import Fraction as F
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

SUPPORTED = frozenset({
    "count-unit-squares",
    "unit-square-area-statement",
    "improvised-unit-count",
    "improvised-unit-covering",
    "improvised-unit-change",
})
SQUARE_UNITS = {
    "square centimeter": ("square centimeters", "centimeters"),
    "square inch": ("square inches", "inches"),
    "square foot": ("square feet", "feet"),
    "square meter": ("square meters", "meters"),
}
TILE_UNITS = {"sticky note", "square tile", "square card", "square napkin", "square cracker"}
INSET = F(6, 100)
PLACEHOLDER = re.compile(r"\$\{|\bundefined\b|\bNaN\b|\bnull\b|\[object")


def require(condition, message):
    if not condition:
        raise ValueError(message)


def exact(value):
    return F(value).limit_denominator(10**6)


def subpaths(element):
    """The closed subpaths of a path as lists of exact points."""
    require(element["type"] == "path", "A path")
    out, current = [], None
    for op in element["d"]:
        if op[0] == "M":
            require(current is None, "Each subpath closes before the next")
            current = [(exact(op[1]), exact(op[2]))]
        elif op[0] == "L":
            require(current is not None, "A line needs a start")
            current.append((exact(op[1]), exact(op[2])))
        elif op[0] == "Z":
            require(current is not None, "Close an open subpath")
            out.append(current)
            current = None
        else:
            raise ValueError(f"Unexpected path op {op[0]}")
    require(current is None, "Every subpath is closed")
    return out


def as_square(points):
    """(x, y, side) of an axis-parallel square subpath."""
    require(len(points) == 4, "A square has four corners")
    xs, ys = {p[0] for p in points}, {p[1] for p in points}
    require(len(xs) == 2 and len(ys) == 2, "Axis-parallel square")
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    require(x1 - x0 == y1 - y0 > 0, "Equal sides")
    return x0, y0, x1 - x0


def elements_by_id(scene):
    return {e["id"]: e for e in scene["elements"] if "id" in e}


def unit_cells(scene):
    """Shaded cells (column, row from the top) and the grid box."""
    by = elements_by_id(scene)
    grid = by["grid"]
    xs = [exact(op[1]) for op in grid["d"] if op[0] in "ML"]
    ys = [exact(op[2]) for op in grid["d"] if op[0] in "ML"]
    cols, rows = max(xs), max(ys)
    require(min(xs) == 0 and min(ys) == 0 and cols.denominator == rows.denominator == 1, "Unit grid from the origin")
    require(cols <= 7 and rows <= 6, "Grid at most 7 by 6")
    cells = []
    for sub in subpaths(by["cells"]):
        x, y, side = as_square(sub)
        require(side == 1 and x.denominator == 1 and y.denominator == 1, "Unit cells on the grid")
        require(0 <= x < cols and 0 <= y < rows, "Cell inside the grid")
        cells.append((int(x), int(rows - 1 - y)))
    require(len(set(cells)) == len(cells), "No cell drawn twice")
    return cells, int(cols), int(rows)


def connected(cells):
    cells = set(cells)
    start = next(iter(cells))
    seen, stack = {start}, [start]
    while stack:
        c, r = stack.pop()
        for n in ((c + 1, r), (c - 1, r), (c, r + 1), (c, r - 1)):
            if n in cells and n not in seen:
                seen.add(n)
                stack.append(n)
    return len(seen) == len(cells)


def row_counts(cells, rows):
    return [sum(1 for _, r in cells if r == row) for row in range(rows)]


def inside(point, loops):
    """Even-odd test of a point against polygon loops."""
    x, y = point
    hit = False
    for loop in loops:
        for i in range(len(loop)):
            (x1, y1), (x2, y2) = loop[i], loop[(i + 1) % len(loop)]
            if (y1 > y) != (y2 > y):
                cross = x1 + (y - y1) * (x2 - x1) / (y2 - y1)
                if cross > x:
                    hit = not hit
    return hit


def surface_cells(scene):
    loops = subpaths(elements_by_id(scene)["surface"])
    xs = [p[0] for loop in loops for p in loop]
    ys = [p[1] for loop in loops for p in loop]
    require(min(xs) == 0 and min(ys) == 0, "Surface from the origin")
    out = set()
    for x in range(int(max(xs))):
        for y in range(int(max(ys))):
            if inside((F(2 * x + 1, 2), F(2 * y + 1, 2)), loops):
                out.add((x, y))
    return out


def tile_spots(scene, element_id):
    """Lower-left corners of the tiles of one path (math coordinates)."""
    by = elements_by_id(scene)
    if element_id not in by:
        return []
    spots = []
    for sub in subpaths(by[element_id]):
        x, y, side = as_square(sub)
        require(side == 1 - 2 * INSET, "A tile of side 1 with its inset")
        spots.append((x - INSET, y - INSET))
    return spots


def covering(scene):
    """(surface cells, tiles laid, exact) for one covered surface."""
    surface = surface_cells(scene)
    spots = tile_spots(scene, "tiles") + tile_spots(scene, "extra")
    on_cells = [(int(x), int(y)) for x, y in spots if x.denominator == 1 and y.denominator == 1]
    exact_cover = len(on_cells) == len(spots) and len(set(on_cells)) == len(on_cells) and set(on_cells) == surface
    for x, y in spots:
        # Every tile lies on the surface, even one laid across two cells.
        for cx in {x, x + 1 - F(1, 10**6)}:
            require((int(cx), int(y)) in surface, "A tile lies on the surface")
    return surface, spots, exact_cover


def review_rows(lines, counts, noun_pattern):
    """Running-total lines: Row k ... has N noun: [a + N = ]total so far."""
    total = 0
    require(len(lines) == len(counts), f"One line per row, got {len(lines)} for {len(counts)}")
    for k, (line, n) in enumerate(zip(lines, counts), start=1):
        m = re.fullmatch(rf"Row {k}(?: \(the top row\))? has (\d+) {noun_pattern}: (?:\$(\d+) \+ (\d+) = (\d+)\$|(\d+)) so far\.", line)
        require(m is not None, f"Row line {line!r}")
        require(int(m.group(1)) == n, f"Row {k} count {m.group(1)} is not {n}")
        if m.group(5) is not None:
            require(k == 1 and int(m.group(5)) == n, "First row total")
        else:
            require(int(m.group(2)) == total and int(m.group(3)) == n and int(m.group(4)) == total + n, f"Running total {line!r}")
        total += n
    return total


def square_prompt(public, question):
    m = re.fullmatch(r"Each small square is 1 (square \w+)\. The shaded shape is (?:the|\w+'s) ([a-z -]+)\. " + question, public["prompt"])
    require(m is not None, f"Prompt {public['prompt']!r}")
    one, noun = m.group(1), m.group(2)
    require(one in SQUARE_UNITS, f"Unit {one}")
    require(m.group(3) == noun, "The question names the shaded thing")
    return one, noun


def legend_of(scene):
    return elements_by_id(scene)["legendLabel"]["text"]


def solve_count(public):
    one, noun = square_prompt(public, r"What is the area of the ([a-z -]+)\?")
    scene = public["figure"]["scene"]
    cells, cols, rows = unit_cells(scene)
    require(legend_of(scene) == f"= 1 {one}", "Legend unit matches the prompt")
    require(public["response"] == {"kind": "number", "label": SQUARE_UNITS[one][0]}, "Answer label is the square unit")
    require(connected(cells), "The shape is one piece")
    require(6 <= len(cells) <= 30, "Area 6 to 30")
    return str(len(cells)), (cells, cols, rows, one, noun)


def solve_statement(public):
    one, noun = square_prompt(public, r"Which statement about the area of the ([a-z -]+) is true\?")
    scene = public["figure"]["scene"]
    cells, cols, rows = unit_cells(scene)
    require(legend_of(scene) == f"= 1 {one}", "Legend unit matches the prompt")
    many, length = SQUARE_UNITS[one]
    response = public["response"]
    require(response["kind"] == "choice" and len(response["options"]) == 4, "Four statements")
    parsed = []
    for option in response["options"]:
        m = re.fullmatch(r"The area is (\d+) (.+)\.", option["label"])
        require(m is not None, f"Statement {option['label']!r}")
        require(m.group(2) in (many, length), "Statement unit")
        parsed.append((int(m.group(1)), m.group(2), option["id"]))
    require(len({(v, u) for v, u, _ in parsed}) == 4, "Four different statements")
    require(sum(1 for _, u, _ in parsed if u == many) == 3, "Three statements use the square unit")
    key = [i for v, u, i in parsed if v == len(cells) and u == many]
    require(len(key) == 1, "Exactly one true statement")
    require(any(v == len(cells) and u == length for v, u, _ in parsed), "The length-unit statement carries the count")
    return key[0], (cells, cols, rows, one, noun)


def improvised_prompt(public):
    m = re.fullmatch(r"\w+ covers the ([a-z ]+) with ([a-z ]+)s, with no gaps and no overlaps\. What is the area of the \1, in \2s\?", public["prompt"])
    require(m is not None, f"Prompt {public['prompt']!r}")
    require(m.group(2) in TILE_UNITS, f"Unit {m.group(2)}")
    return m.group(1), m.group(2)


def solve_improvised_count(public):
    surface_name, unit = improvised_prompt(public)
    scene = public["figure"]["scene"]
    surface, spots, exact_cover = covering(scene)
    require(exact_cover, "The drawn covering has no gaps and no overlaps")
    require(legend_of(scene) == f"= 1 {unit}", "Legend names the unit")
    require(public["response"] == {"kind": "number", "label": f"{unit}s"}, "Answer label names the unit")
    require(6 <= len(surface) <= 30, "Area 6 to 30")
    return str(len(spots)), (surface, unit, surface_name)


def solve_covering(public):
    m = re.fullmatch(r"\w+, \w+ and \w+ each covered the same ([a-z ]+) with ([a-z ]+)s\. Which picture shows a covering that can be counted to find the area of the \1\?", public["prompt"])
    require(m is not None, f"Prompt {public['prompt']!r}")
    unit = m.group(2)
    require(unit in TILE_UNITS, "Unit")
    response = public["response"]
    require(response["kind"] == "figure-choice" and response["noun"] == "Picture" and len(response["options"]) == 3, "Three pictures")
    surfaces, exact_ids, kinds = [], [], set()
    for option in response["options"]:
        surface, spots, exact_cover = covering(option["scene"])
        surfaces.append(frozenset(surface))
        counted = re.match(r"(\d+) ", option["label"])
        require(counted is not None and int(counted.group(1)) == len(spots), "Description counts the units drawn")
        if exact_cover:
            exact_ids.append(option["id"])
            kinds.add("exact")
        elif len(spots) < len(surface):
            kinds.add("gap")
        else:
            require(len(spots) > len(surface), "An overlapping covering lays more units than the surface holds")
            kinds.add("overlap")
    require(len(set(surfaces)) == 1, "The same surface in every picture")
    require(kinds == {"exact", "gap", "overlap"}, f"One exact, one gap and one overlap covering, got {kinds}")
    require(len(exact_ids) == 1, "Exactly one exact covering")
    require(8 <= len(surfaces[0]) <= 20, "Area 8 to 20")
    return exact_ids[0], len(surfaces[0])


def solve_change(public):
    m = re.fullmatch(
        r"(\w+) covered the ([a-z ]+) with (large|small) ([a-z ]+)s and counted (\d+)\. Then \1 covered the same \2 with (small|large) \4s\. "
        r"Each side of a \6 \4 is (half as long|twice as long) as a side of a \3 \4\. Will it take more than \5, fewer than \5 or exactly \5 \6 \4s\?",
        public["prompt"])
    require(m is not None, f"Prompt {public['prompt']!r}")
    first, unit, n, second, relation = m.group(3), m.group(4), int(m.group(5)), m.group(6), m.group(7)
    require(first != second, "Two different sizes")
    require((relation == "half as long") == (second == "small"), "The relation matches the sizes")
    scene = public["figure"]["scene"]
    surface, spots, exact_cover = covering(scene)
    require(exact_cover and len(spots) == n, "The figure shows the stated count")
    by = elements_by_id(scene)
    side1 = as_square(subpaths(by["first"])[0])[2]
    side2 = as_square(subpaths(by["second"])[0])[2]
    require(side2 / side1 == (F(1, 2) if second == "small" else 2), "The second unit is drawn to scale")
    require(by["firstLabel"]["text"] == f"1 {first} {unit}" and by["secondLabel"]["text"] == f"1 {second} {unit}", "Unit labels")
    if second == "large":
        width = max(x for x, _ in surface) + 1
        height = max(y for _, y in surface) + 1
        require(width % 2 == 0 and height % 2 == 0, "Large units tile the surface exactly")
    labels = {o["label"]: o["id"] for o in public["response"]["options"]}
    require(set(labels) == {f"More than {n}", f"Fewer than {n}", f"Exactly {n}"}, "Three choices")
    # Each side half as long: 4 new units per old unit, so the count is 4n; twice as long: n/4.
    new_count = 4 * n if second == "small" else F(n, 4)
    word = "More" if new_count > n else "Fewer"
    return labels[f"{word} than {n}"], (n, new_count, second, unit)


def review_count_text(problem, cells, rows, one, noun):
    many = SQUARE_UNITS[one][0]
    lines = problem["explanation"]
    counts = row_counts(cells, rows)
    row_lines = [line for line in lines if line.startswith("Row ")]
    total = review_rows(row_lines, counts, r"shaded squares?")
    require(total == len(cells), "Rows add to the area")
    require(any(f"{total} {many}" in line for line in lines), "The explanation states the area with its unit")
    note = problem["public"]["figure"]["scene"]["note"]
    require(note.startswith(f"Shaded squares in each row, from the top: {', '.join(map(str, counts))}."), "Row counts in the description")


def solve(public):
    template = public["templateId"]
    require(template in SUPPORTED, "Wrong family")
    return {
        "count-unit-squares": solve_count,
        "unit-square-area-statement": solve_statement,
        "improvised-unit-count": solve_improvised_count,
        "improvised-unit-covering": solve_covering,
        "improvised-unit-change": solve_change,
    }[template](public)[0]


def review_problem(problem):
    public = problem["public"]
    template = public["templateId"]
    require(template in SUPPORTED, "Wrong family")
    if template == "count-unit-squares":
        expected, (cells, cols, rows, one, noun) = solve_count(public)
        review_count_text(problem, cells, rows, one, noun)
    elif template == "unit-square-area-statement":
        expected, (cells, cols, rows, one, noun) = solve_statement(public)
        review_count_text(problem, cells, rows, one, noun)
    elif template == "improvised-unit-count":
        expected, (surface, unit, name) = solve_improvised_count(public)
        height = max(y for _, y in surface) + 1
        counts = [sum(1 for _, y in surface if y == height - 1 - row) for row in range(height)]
        total = review_rows([l for l in problem["explanation"] if l.startswith("Row ")], counts, re.escape(unit) + "s?")
        require(total == len(surface), "Rows add to the area")
    elif template == "improvised-unit-covering":
        expected, area = solve_covering(public)
        require(problem["explanation"][-1].endswith(f" is {area} {public['prompt'].split(' with ')[1].split('. ')[0]}."), "The last line states the area")
    else:
        expected, (n, new_count, second, unit) = solve_change(public)
        require(any(f"= {new_count}$" in line for line in problem["explanation"]), "The explanation computes the new count")
    require(problem["answer"] == expected, f"Answer {problem['answer']} disagrees; expected {expected}")
    for text in [public["prompt"], problem["hint"], *problem["explanation"], *(problem.get("choiceFeedback") or {}).values()]:
        require(not PLACEHOLDER.search(text), f"Unrendered placeholder in {text!r}")
    return expected


# ---------------------------------------------------------------- self test

def square_ops(x, y, s):
    return [["M", x, y], ["L", x + s, y], ["L", x + s, y + s], ["L", x, y + s], ["Z"]]


def grid_scene(cells, cols, rows, unit_one, counts):
    lines = []
    for c in range(cols + 1):
        lines += [["M", c, 0], ["L", c, rows]]
    for r in range(rows + 1):
        lines += [["M", 0, r], ["L", cols, r]]
    return {"v": 1, "title": "A shaded shape", "note": f"Shaded squares in each row, from the top: {', '.join(map(str, counts))}.",
            "elements": [
                {"type": "path", "id": "cells", "d": [op for c, r in cells for op in square_ops(c, rows - 1 - r, 1)]},
                {"type": "path", "id": "grid", "d": lines},
                {"type": "path", "id": "outline", "d": [["M", 0, 0], ["L", 1, 0], ["L", 1, 1], ["Z"]]},
                {"type": "text", "id": "legendLabel", "at": [1.3, -1.2], "text": f"= 1 {unit_one}"}]}


def tile_ops(spots):
    return [op for x, y in spots for op in square_ops(x + 0.06, y + 0.06, 0.88)]


def surface_scene(width, height, spots, extra=()):
    loop = [["M", 0, 0], ["L", width, 0], ["L", width, height], ["L", 0, height], ["Z"]]
    elements = [{"type": "path", "id": "surface", "d": loop}, {"type": "path", "id": "tiles", "d": tile_ops(spots)}]
    if extra:
        elements.append({"type": "path", "id": "extra", "d": tile_ops(extra)})
    return {"v": 1, "elements": elements}


def self_test():
    # An L of 10: rows 4, 4, 2 in a 4 by 3 box.
    cells = [(c, 0) for c in range(4)] + [(c, 1) for c in range(4)] + [(0, 2), (1, 2)]
    count_case = {"public": {"templateId": "count-unit-squares", "seed": "f",
                             "prompt": "Each small square is 1 square foot. The shaded shape is Nia's patio. What is the area of the patio?",
                             "response": {"kind": "number", "label": "square feet"},
                             "figure": {"kind": "scene", "scene": grid_scene(cells, 4, 3, "square foot", [4, 4, 2])}},
                  "answer": "10", "hint": "Count the top row of 4 squares.",
                  "explanation": ["Each small square is 1 square foot.",
                                  "Row 1 (the top row) has 4 shaded squares: 4 so far.",
                                  "Row 2 has 4 shaded squares: $4 + 4 = 8$ so far.",
                                  "Row 3 has 2 shaded squares: $8 + 2 = 10$ so far.",
                                  "10 squares cover the patio, so its area is 10 square feet."]}
    require(review_problem(count_case) == "10", "Count fixture")
    statement = copy.deepcopy(count_case)
    statement["public"].update(templateId="unit-square-area-statement",
                               prompt="Each small square is 1 square foot. The shaded shape is Nia's patio. Which statement about the area of the patio is true?",
                               response={"kind": "choice", "label": "Choose", "options": [
                                   {"id": "option-a", "label": "The area is 12 square feet."},
                                   {"id": "option-b", "label": "The area is 10 feet."},
                                   {"id": "option-c", "label": "The area is 10 square feet."},
                                   {"id": "option-d", "label": "The area is 8 square feet."}]})
    statement["answer"] = "option-c"
    require(review_problem(statement) == "option-c", "Statement fixture")
    tiles = [(x, y) for x in range(5) for y in range(3)]
    improvised = {"public": {"templateId": "improvised-unit-count", "seed": "f",
                             "prompt": "Omar covers the desk top with sticky notes, with no gaps and no overlaps. What is the area of the desk top, in sticky notes?",
                             "response": {"kind": "number", "label": "sticky notes"},
                             "figure": {"kind": "scene", "scene": {**surface_scene(5, 3, tiles), "elements": surface_scene(5, 3, tiles)["elements"] + [
                                 {"type": "text", "id": "legendLabel", "at": [1.3, -1.2], "text": "= 1 sticky note"}]}}},
                  "answer": "15", "hint": "Count the top row: 5.",
                  "explanation": ["Row 1 (the top row) has 5 sticky notes: 5 so far.",
                                  "Row 2 has 5 sticky notes: $5 + 5 = 10$ so far.",
                                  "Row 3 has 5 sticky notes: $10 + 5 = 15$ so far."]}
    require(review_problem(improvised) == "15", "Improvised fixture")
    cover = {"public": {"templateId": "improvised-unit-covering", "seed": "f",
                        "prompt": "Ava, Ben and Kai each covered the same mat with square tiles. Which picture shows a covering that can be counted to find the area of the mat?",
                        "response": {"kind": "figure-choice", "label": "Choose", "noun": "Picture", "options": [
                            {"id": "option-a", "label": "13 square tiles on the mat; 1 lies on top of others.", "scene": surface_scene(4, 3, tiles[:12], [(1.5, 2)])},
                            {"id": "option-b", "label": "12 square tiles laid edge to edge.", "scene": surface_scene(4, 3, [(x, y) for x in range(4) for y in range(3)])},
                            {"id": "option-c", "label": "10 square tiles with part of the mat bare.", "scene": surface_scene(4, 3, [(x, y) for x in range(4) for y in range(3)][:10])}]}},
             "answer": "option-b", "hint": "Look for gaps.", "explanation": ["The area of the mat is 12 square tiles."]}
    cover["public"]["response"]["options"][0]["scene"] = surface_scene(4, 3, [(x, y) for x in range(4) for y in range(3)], [(1.5, 2)])
    require(review_problem(cover) == "option-b", "Covering fixture")
    first = {"type": "path", "id": "first", "d": tile_ops([(0, -1.6)])}
    change_scene = surface_scene(4, 2, [(x, y) for x in range(4) for y in range(2)])
    change_scene["elements"] += [first, {"type": "text", "id": "firstLabel", "text": "1 large square tile"},
                                 {"type": "path", "id": "second", "d": square_ops(0.03, -2.47, 0.44)},
                                 {"type": "text", "id": "secondLabel", "text": "1 small square tile"}]
    change = {"public": {"templateId": "improvised-unit-change", "seed": "f",
                         "prompt": "Ravi covered the hallway with large square tiles and counted 8. Then Ravi covered the same hallway with small square tiles. "
                                   "Each side of a small square tile is half as long as a side of a large square tile. Will it take more than 8, fewer than 8 or exactly 8 small square tiles?",
                         "response": {"kind": "choice", "label": "Choose", "options": [
                             {"id": "option-a", "label": "Fewer than 8"}, {"id": "option-b", "label": "Exactly 8"}, {"id": "option-c", "label": "More than 8"}]},
                         "figure": {"kind": "scene", "scene": change_scene}},
              "answer": "option-c", "hint": "Picture the 8 large tiles.",
              "explanation": ["So $4 \\times 8 = 32$ small square tiles."]}
    require(review_problem(change) == "option-c", "Change fixture")
    mutations = 0
    for base, change_fn, what in (
            (count_case, lambda p: p.update(answer="11"), "miscount"),
            (count_case, lambda p: p["public"]["response"].update(label="feet"), "length unit as the label"),
            (count_case, lambda p: p["explanation"].__setitem__(2, "Row 2 has 4 shaded squares: $4 + 4 = 9$ so far."), "false running total"),
            (count_case, lambda p: p["public"]["figure"]["scene"]["elements"][3].update(text="= 1 square inch"), "legend unit"),
            (statement, lambda p: p.update(answer="option-b"), "length unit chosen"),
            (statement, lambda p: p["public"]["response"]["options"][3].update(label="The area is 10 square feet."), "repeated statement"),
            (improvised, lambda p: p["public"]["figure"]["scene"]["elements"][1]["d"].__delitem__(slice(0, 5)), "a gap in a covering called exact"),
            (cover, lambda p: p.update(answer="option-c"), "a covering with a gap"),
            (cover, lambda p: p["public"]["response"]["options"][1].update(label="11 square tiles laid edge to edge."), "description count"),
            (change, lambda p: p.update(answer="option-a"), "wrong direction"),
            (change, lambda p: p["public"]["figure"]["scene"]["elements"][4].update(d=square_ops(0.03, -2.47, 1.76)), "second unit not to scale")):
        bad = copy.deepcopy(base)
        change_fn(bad)
        try:
            review_problem(bad)
        except (ValueError, KeyError, TypeError, IndexError, ZeroDivisionError, StopIteration):
            mutations += 1
        else:
            raise AssertionError(f"Accepted corrupt area-by-counting case: {what}")
    return {"fixtures": 5, "mutations": mutations}


REVIEW_RETURNS_ANSWER = True

if __name__ == "__main__":
    print(self_test())
