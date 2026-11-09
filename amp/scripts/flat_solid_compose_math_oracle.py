"""Independent review of flat or solid (K.G.A.3) and composite shapes (1.G.A.2)
from public payloads only.

Shapes are read from the drawn primitives, never from ids or descriptions
that could carry the answer:
- a shape with a dashed (hidden) line is solid, one without is flat;
- a flat polygon is named from its vertices (side lengths and right angles),
  a lone circle is a circle;
- a solid with a circle is a sphere, with two many-point polygons (side and
  top) a cylinder, with one a cone; a faceted solid's edge lengths are
  recovered from the fixed view (25 degrees above, orthographic) to tell a
  cube from a longer block;
- for composite pieces, every piece set is rasterized on a fine sample grid
  and searched for an exact cover of the target, using every piece, with any
  quarter turn, flip and whole-unit slide.
"""

import json
import math
import re

SUPPORTED = frozenset({
    "flat-or-solid-name", "pick-flat-or-solid", "count-flat-or-solid",
    "composite-shape-name", "composite-which-pieces", "composite-which-solids",
})
ELEVATION = math.radians(25)
SIN, COS = math.sin(ELEVATION), math.cos(ELEVATION)
PLACEHOLDER = re.compile(r"\$\{|\bundefined\b|\bNaN\b|\bnull\b|\[object")


def require(condition, message):
    if not condition:
        raise ValueError(message)


def elements_of(scene):
    require(scene.get("v") == 1, "Scene version")
    return scene["elements"]


# ------------------------------------------------------------ geometry

def dist(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])


def shoelace(points):
    return abs(sum(points[i][0] * points[(i + 1) % len(points)][1] - points[(i + 1) % len(points)][0] * points[i][1]
                   for i in range(len(points)))) / 2


def flat_name(points):
    """Name a straight-sided outline from its vertices."""
    pts = [p for i, p in enumerate(points) if dist(p, points[i - 1]) > 1e-6]
    n = len(pts)
    sides = [dist(pts[i], pts[(i + 1) % n]) for i in range(n)]

    def right(i):
        a, b, c = pts[i - 1], pts[i], pts[(i + 1) % n]
        u, v = (a[0] - b[0], a[1] - b[1]), (c[0] - b[0], c[1] - b[1])
        return abs(u[0] * v[0] + u[1] * v[1]) < 1e-3 * (math.hypot(*u) * math.hypot(*v))
    if n == 3:
        return "triangle"
    if n == 5:
        return "pentagon"
    if n == 6:
        return "hexagon"
    require(n == 4, f"Unexpected outline with {n} corners")
    if all(right(i) for i in range(4)):
        return "square" if max(sides) - min(sides) < 1e-3 * max(sides) else "rectangle"

    def direction(i):
        a, b = pts[i], pts[(i + 1) % n]
        return (b[0] - a[0], b[1] - a[1])

    def parallel(i, j):
        u, v = direction(i), direction(j)
        return abs(u[0] * v[1] - u[1] * v[0]) < 1e-3 * math.hypot(*u) * math.hypot(*v)
    pairs = int(parallel(0, 2)) + int(parallel(1, 3))
    require(pairs == 1, "A four-sided outline that is neither a rectangle nor a trapezoid")
    return "trapezoid"


def curved_name(points):
    """A circle, or a half-circle with one straight side, from a sampled outline."""
    n = len(points)
    cx, cy = sum(p[0] for p in points) / n, sum(p[1] for p in points) / n
    radii = [dist(p, (cx, cy)) for p in points]
    if max(radii) - min(radii) < 1e-3:
        return "circle"
    longest = max(range(n), key=lambda i: dist(points[i], points[(i + 1) % n]))
    a, b = points[longest], points[(longest + 1) % n]
    center, r = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2), dist(a, b) / 2
    require(all(abs(dist(p, center) - r) < 2e-3 for p in points), "A curved outline that is not a half-circle")
    return "half-circle"


def outline_name(points):
    return curved_name(points) if len(points) > 8 else flat_name(points)


def edges_of(group):
    """Projected straight edges of a faceted solid."""
    out = []
    for e in group:
        if e["type"] == "polygon" and len(e["points"]) == 4:
            pts = e["points"]
            out += [(pts[i], pts[(i + 1) % 4]) for i in range(4)]
        elif e["type"] == "segment" and e.get("dash") == "dash":
            out.append((e["from"], e["to"]))
    return out


def solid_kind(group):
    """cube, box, cylinder, cone or sphere, read from the drawing."""
    if any(e["type"] == "circle" for e in group):
        return "sphere"
    big = [e for e in group if e["type"] == "polygon" and len(e["points"]) > 8]
    if len(big) == 2:
        return "cylinder"
    if len(big) == 1:
        return "cone"
    heights, bases = [], []
    for a, b in edges_of(group):
        dx, dy = b[0] - a[0], b[1] - a[1]
        if abs(dx) < 1e-6:
            heights.append(abs(dy) / COS)
        else:
            bases.append(math.hypot(dx, dy / SIN))

    def clusters(values):
        found = []
        for v in sorted(values):
            if not found or v - found[-1] > 0.01:
                found.append(v)
        return found
    require(heights and len(clusters(heights)) == 1 and 1 <= len(clusters(bases)) <= 2,
            f"Unreadable block edges {heights} {bases}")
    lengths = heights + bases
    return "cube" if max(lengths) - min(lengths) < 0.02 else "box"


def groups(elements, pattern):
    found = {}
    for e in elements:
        m = re.match(pattern, e.get("id", ""))
        if m:
            found.setdefault(int(m.group(1)), []).append(e)
    return found


def cell_shapes(scene):
    """Each cell's (letter, solid?, kind) in cell order."""
    elements = elements_of(scene)
    letters = {int(re.match(r"c(\d+)tag$", e["id"]).group(1)): e["text"]
               for e in elements if re.match(r"c\d+tag$", e.get("id", ""))}
    cells = groups([e for e in elements if not re.search(r"(box|tag)$", e.get("id", ""))], r"c(\d+)")
    out = []
    for i in sorted(cells):
        group = cells[i]
        solid = any(e.get("dash") == "dash" for e in group)
        if solid:
            kind = solid_kind(group)
        else:
            require(len(group) == 1, "A flat shape is one outline")
            e = group[0]
            kind = "circle" if e["type"] == "circle" else flat_name(e["points"])
        out.append((letters.get(i), solid, kind))
    return out


NAMES = {"box": "rectangular prism"}


def option_id(options, label):
    found = [o["id"] for o in options if o["label"] == label]
    require(len(found) == 1, f"Exactly one option {label!r}")
    return found[0]


# ------------------------------------------------------------ K.G.A.3

def solve_flat_or_solid_name(public):
    require(public["prompt"] == "Look at this shape. Is it flat or solid? What is its name?", "Prompt")
    shapes = cell_shapes(public["figure"]["scene"])
    require(len(shapes) == 1, "One shape")
    _, solid, kind = shapes[0]
    response = public["response"]
    require(response["kind"] == "multi-part-choice", "Multi-part")
    blanks = {b["id"]: b for b in response["blanks"]}
    require(list(blanks) == ["kind", "name"], "Blanks")
    require({o["label"] for o in blanks["kind"]["options"]} == {"flat", "solid"}, "Flat or solid options")
    names = [o["label"] for o in blanks["name"]["options"]]
    require(len(names) == 4 and len(set(names)) == 4, "Four distinct names")
    key = {"kind": option_id(blanks["kind"]["options"], "solid" if solid else "flat"),
           "name": option_id(blanks["name"]["options"], NAMES.get(kind, kind))}
    return json.dumps(key, separators=(",", ":"))


def asked_solid(prompt):
    if prompt in ("Which shapes are solid?", "Which shapes could stand on a table and take up room?",
                  "How many of these shapes are solid?"):
        return True
    require(prompt in ("Which shapes are flat?", "Which shapes could lie flat on the page?",
                       "How many of these shapes are flat?"), f"Prompt {prompt!r}")
    return False


def solve_pick(public):
    want = asked_solid(public["prompt"])
    shapes = cell_shapes(public["figure"]["scene"])
    require(4 <= len(shapes) <= 6, "Four to six shapes")
    require(len({k for _, _, k in shapes}) == len(shapes), "No two shapes of one kind")
    response = public["response"]
    require(response["kind"] == "multi-select", "Multi-select")
    chosen = sorted(option_id(response["options"], letter) for letter, solid, _ in shapes if solid == want)
    require(response["selectionCount"] == len(chosen), "The shown count matches the shapes to choose")
    return json.dumps(chosen, separators=(",", ":"))


def solve_count(public):
    want = asked_solid(public["prompt"])
    shapes = cell_shapes(public["figure"]["scene"])
    require(4 <= len(shapes) <= 6 and len({k for _, _, k in shapes}) == len(shapes), "Row of distinct shapes")
    total = sum(1 for _, solid, _ in shapes if solid == want)
    require(1 <= total <= len(shapes) - 1, "Both kinds appear")
    return str(total)


# ------------------------------------------------------------ 1.G.A.2

def solve_shape_name(public):
    response = public["response"]
    require(response["kind"] == "choice", "Choice")
    elements = elements_of(public["figure"]["scene"])
    if public["prompt"] == "These pieces are put together with their sides touching. What shape do they make?":
        outline = [e for e in elements if e.get("id") == "outline"]
        pieces = [e for e in elements if re.match(r"piece\d+$", e.get("id", ""))]
        require(len(outline) == 1 and len(pieces) >= 2, "An outline and its pieces")
        pts = outline[0]["points"]
        total = sum(shoelace(p["points"]) for p in pieces)
        require(abs(total - shoelace(pts)) < 2e-3, "The pieces cover the outline exactly")
        return option_id(response["options"], outline_name(pts))
    match = re.fullmatch(r"Two (cubes|cylinders|rectangular prisms) are put together like this\. What shape do they make\?",
                         public["prompt"])
    require(match is not None, f"Prompt {public['prompt']!r}")
    solids = groups(elements, r"p(\d+)")
    require(len(solids) == 1, "One drawn solid")
    kind = solid_kind(solids[0])
    require(kind in ("box", "cylinder"), "Two equal solids make a block or a cylinder")
    require(any(e.get("stroke") == "muted" for e in elements), "The seam is drawn")
    return option_id(response["options"], NAMES.get(kind, kind))


SAMPLE = 8
OX, OY = 0.37, 0.29


def inside(point, polygon):
    x, y = point
    hit = False
    for i in range(len(polygon)):
        (x1, y1), (x2, y2) = polygon[i], polygon[i - 1]
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
            hit = not hit
    return hit


def raster(polygon):
    """Sample cells (i, j), at (i + 0.37)/8 and (j + 0.29)/8, inside a polygon."""
    xs, ys = [p[0] for p in polygon], [p[1] for p in polygon]
    out = set()
    for i in range(math.floor(min(xs) * SAMPLE) - 1, math.ceil(max(xs) * SAMPLE) + 1):
        for j in range(math.floor(min(ys) * SAMPLE) - 1, math.ceil(max(ys) * SAMPLE) + 1):
            if inside(((i + OX) / SAMPLE, (j + OY) / SAMPLE), polygon):
                out.add((i, j))
    return frozenset(out)


def orientations(polygon):
    """Rasters of every quarter turn and flip, slid to whole units from 0."""
    forms = set()
    for flip in (False, True):
        pts = [(-x, y) if flip else (x, y) for x, y in polygon]
        for _ in range(4):
            pts = [(-y, x) for x, y in pts]
            mx, my = math.floor(min(p[0] for p in pts) + 1e-6), math.floor(min(p[1] for p in pts) + 1e-6)
            forms.add(raster([(x - mx, y - my) for x, y in pts]))
    return list(forms)


def tiles(target, pieces):
    """Whether these piece polygons, every one used, cover the target raster exactly."""
    forms = [orientations(p) for p in pieces]
    # Sample counts shift a little with a turn, so this only prunes sets
    # whose area is clearly different; the search below is exact.
    low = sum(min(len(form) for form in f) for f in forms)
    high = sum(max(len(form) for form in f) for f in forms)
    if not low <= len(target) <= high:
        return False

    def search(left, rest):
        if not left:
            return not rest
        first = min(left)
        tried = set()
        for k in rest:
            for form in forms[k]:
                key = (form, len(rest))
                if key in tried:
                    continue
                tried.add(key)
                low = min(form)
                dx, dy = first[0] - low[0], first[1] - low[1]
                if dx % SAMPLE or dy % SAMPLE:
                    continue
                moved = frozenset((i + dx, j + dy) for i, j in form)
                if moved <= left and search(left - moved, [r for r in rest if r != k]):
                    return True
        return False
    return search(frozenset(target), list(range(len(pieces))))


def solve_which_pieces(public):
    require(public["prompt"] == "Which pieces can be put together to make this shape? Use every piece in the set.", "Prompt")
    response = public["response"]
    require(response["kind"] == "figure-choice" and response["noun"] == "Picture", "Figure choice of pictures")
    outline = [e for e in elements_of(public["figure"]["scene"]) if e.get("id") == "outline"]
    require(len(outline) == 1, "One target outline")
    target = raster(outline[0]["points"])
    good = []
    for option in response["options"]:
        pieces = [e["points"] for e in option["scene"]["elements"] if re.match(r"piece\d+$", e.get("id", ""))]
        require(pieces, "Each option shows pieces")
        if tiles(target, pieces):
            good.append(option["id"])
    require(len(good) == 1, f"Exactly one set makes the shape, found {good}")
    return good[0]


SOLID_LABEL = {"cube": "cube", "box": "rectangular prism", "cylinder": "cylinder", "cone": "cone"}


def solve_which_solids(public):
    require(public["prompt"] == "Which solids were used to build this shape?", "Prompt")
    response = public["response"]
    require(response["kind"] == "multi-select", "Multi-select")
    solids = groups(elements_of(public["figure"]["scene"]), r"p(\d+)")
    require(2 <= len(solids) <= 3, "Two or three solids")
    kinds = {SOLID_LABEL[solid_kind(g)] for g in solids.values()}
    labels = {o["label"] for o in response["options"]}
    if "cube" in kinds and "rectangular prism" not in kinds:
        require("rectangular prism" not in labels, "A cube is also a rectangular prism, so that name is not offered")
    chosen = sorted(option_id(response["options"], k) for k in kinds)
    require(response["selectionCount"] == len(chosen), "Shown count matches the solids used")
    return json.dumps(chosen, separators=(",", ":"))


SOLVERS = {
    "flat-or-solid-name": solve_flat_or_solid_name,
    "pick-flat-or-solid": solve_pick,
    "count-flat-or-solid": solve_count,
    "composite-shape-name": solve_shape_name,
    "composite-which-pieces": solve_which_pieces,
    "composite-which-solids": solve_which_solids,
}


def solve(public):
    template = public["templateId"]
    require(template in SUPPORTED, "Wrong family")
    return SOLVERS[template](public)


def review_problem(problem):
    public = problem["public"]
    expected = solve(public)
    require(problem["answer"] == expected, f"Answer {problem['answer']} disagrees with the figure; expected {expected}")
    for text in [public["prompt"], problem["hint"], *problem["explanation"]]:
        require(not PLACEHOLDER.search(text), f"Unrendered placeholder in {text!r}")
    feedback = problem.get("choiceFeedback") or {}
    require(expected not in feedback, "The answer carries no distractor feedback")
    return expected


# ---------------------------------------------------------------- self test

def opts(*labels, ids="abcd"):
    return [{"id": ids[i] if len(ids) > 4 else f"option-{ids[i]}", "label": l} for i, l in enumerate(labels)]


def cube_group(prefix, side, turn):
    """A cube drawn the way the generator draws one: visible faces and dashed hidden edges."""
    t = math.radians(turn)
    ring = [(-side / 2, -side / 2), (side / 2, -side / 2), (side / 2, side / 2), (-side / 2, side / 2)]
    ring = [(x * math.cos(t) - y * math.sin(t), x * math.sin(t) + y * math.cos(t)) for x, y in ring]

    def p(x, y, z):
        return [x, y * SIN + z * COS]
    top = [p(x, y, side) for x, y in ring]
    front = [p(*ring[0], 0), p(*ring[1], 0), p(*ring[1], side), p(*ring[0], side)]
    return [
        {"type": "polygon", "id": f"{prefix}f1", "points": top, "stroke": "ink"},
        {"type": "polygon", "id": f"{prefix}f2", "points": front, "stroke": "ink"},
        {"type": "segment", "id": f"{prefix}h0", "from": p(*ring[3], 0), "to": p(*ring[2], 0), "dash": "dash"},
    ]


def self_test():
    import copy
    square = [[0, 0], [1.5, 0], [1.5, 1.5], [0, 1.5]]
    triangle = [[0, 0], [2, 0], [0.5, 1.4]]
    row = {"v": 1, "elements": [
        {"type": "rect", "id": "c0box"}, {"type": "text", "id": "c0tag", "text": "A"},
        {"type": "polygon", "id": "c0p", "points": square},
        {"type": "rect", "id": "c1box"}, {"type": "text", "id": "c1tag", "text": "B"},
        *cube_group("c1", 1.3, 30),
        {"type": "rect", "id": "c2box"}, {"type": "text", "id": "c2tag", "text": "C"},
        {"type": "polygon", "id": "c2p", "points": triangle},
        {"type": "rect", "id": "c3box"}, {"type": "text", "id": "c3tag", "text": "D"},
        {"type": "circle", "id": "c3o", "center": [0, 0], "r": 1},
        {"type": "polyline", "id": "c3b", "points": [[0, 0], [1, 1]], "dash": "dash"},
    ]}
    pick = {"public": {"templateId": "pick-flat-or-solid", "seed": "f", "prompt": "Which shapes are flat?",
                       "figure": {"kind": "scene", "scene": row},
                       "response": {"kind": "multi-select", "label": "Choose 2 shapes", "selectionCount": 2,
                                    "options": opts("A", "B", "C", "D")}},
            "answer": '["option-a","option-c"]', "hint": "Start with shape A.", "explanation": ["The flat shapes are A and C."]}
    require(review_problem(pick) == pick["answer"], "Pick fixture")
    count = {"public": {"templateId": "count-flat-or-solid", "seed": "f", "prompt": "How many of these shapes are solid?",
                        "figure": {"kind": "scene", "scene": row}, "response": {"kind": "number", "label": "Solid shapes"}},
             "answer": "2", "hint": "Point to each of the 4 shapes.", "explanation": ["2 solid shapes."]}
    require(review_problem(count) == "2", "Count fixture")
    single = {"public": {"templateId": "flat-or-solid-name", "seed": "f",
                         "prompt": "Look at this shape. Is it flat or solid? What is its name?",
                         "figure": {"kind": "scene", "scene": {"v": 1, "elements": [{"type": "rect", "id": "c0box"}, *cube_group("c0", 1.3, 40)]}},
                         "response": {"kind": "multi-part-choice", "label": "x", "layout": "slots", "blanks": [
                             {"id": "kind", "label": "Is this shape flat or solid?", "options": opts("solid", "flat", ids="ab" + "cdef")},
                             {"id": "name", "label": "What is its name?", "options": opts("square", "cube", "cone", "circle", ids="abcdef")}]}},
              "answer": '{"kind":"a","name":"b"}', "hint": "Could it lie flat?", "explanation": ["It is a cube."]}
    require(review_problem(single) == single["answer"], "Name fixture")
    half = [[2, 0]] + [[1 + math.cos(math.pi * k / 32), math.sin(math.pi * k / 32)] for k in range(1, 33)]
    q1 = [[0, 0]] + [[math.cos(math.pi * k / 32), math.sin(math.pi * k / 32)] for k in range(0, 17)]
    pieces = {"v": 1, "elements": [
        {"type": "polygon", "id": "piece0", "points": [[1, 0]] + [[1 + x, y] for x, y in q1[1:]]},
        {"type": "polygon", "id": "piece1", "points": [[1, 0]] + [[1 - y, x] for x, y in q1[1:]]},
        {"type": "polygon", "id": "outline", "points": half},
    ]}
    name = {"public": {"templateId": "composite-shape-name", "seed": "f",
                       "prompt": "These pieces are put together with their sides touching. What shape do they make?",
                       "figure": {"kind": "scene", "scene": pieces},
                       "response": {"kind": "choice", "label": "Choose one answer",
                                    "options": opts("circle", "half-circle", "quarter-circle", "pentagon")}},
            "answer": "option-b", "hint": "Trace the outside edge.", "explanation": ["A half-circle."],
            "choiceFeedback": {"option-a": "x", "option-c": "x", "option-d": "x"}}
    require(review_problem(name) == "option-b", "Composite name fixture")

    def card(*polys):
        return {"v": 1, "elements": [{"type": "polygon", "id": f"piece{i}", "points": p} for i, p in enumerate(polys)]}
    t1 = [[0, 0], [1, 0], [0, 1]]
    t2 = [[0, 0], [2, 0], [0, 2]]
    choose = {"public": {"templateId": "composite-which-pieces", "seed": "f",
                         "prompt": "Which pieces can be put together to make this shape? Use every piece in the set.",
                         "figure": {"kind": "scene", "scene": {"v": 1, "elements": [
                             {"type": "polygon", "id": "outline", "points": [[0, 0], [2, 0], [2, 2], [0, 2]]}]}},
                         "response": {"kind": "figure-choice", "label": "Choose the pieces", "noun": "Picture", "options": [
                             {"id": "option-a", "label": "Two small triangles.", "scene": card(t1, t1)},
                             {"id": "option-b", "label": "Two big triangles.", "scene": card(t2, t2)},
                             {"id": "option-c", "label": "One big triangle.", "scene": card(t2)},
                             {"id": "option-d", "label": "Two trapezoids.", "scene": card([[0, 0], [2, 0], [1, 1], [0, 1]], [[0, 0], [2, 0], [1, 1], [0, 1]])}]}},
              "answer": "option-b", "hint": "Check sizes.", "explanation": ["Picture B."],
              "choiceFeedback": {"option-a": "x", "option-c": "x", "option-d": "x"}}
    require(review_problem(choose) == "option-b", "Which-pieces fixture")
    mutations = 0
    for base, change, what in (
            (pick, lambda p: p.update(answer='["option-a","option-b"]'), "a solid chosen as flat"),
            (pick, lambda p: p["public"].update(prompt="Which shapes are solid?"), "asked word flipped"),
            (count, lambda p: p.update(answer="3"), "miscount"),
            (single, lambda p: p.update(answer='{"kind":"b","name":"b"}'), "cube called flat"),
            (name, lambda p: p.update(answer="option-a"), "half-circle called a circle"),
            (name, lambda p: p["public"]["figure"]["scene"]["elements"].pop(1), "a piece missing from the outline"),
            (choose, lambda p: p.update(answer="option-a"), "small triangles accepted"),
            (choose, lambda p: p["public"]["response"]["options"][2]["scene"]["elements"].append(
                {"type": "polygon", "id": "piece1", "points": t2}), "two correct sets")):
        bad = copy.deepcopy(base)
        change(bad)
        try:
            review_problem(bad)
        except (ValueError, KeyError, TypeError, IndexError):
            mutations += 1
        else:
            raise AssertionError(f"Accepted corrupt flat-solid-compose case: {what}")
    return {"fixtures": 5, "mutations": mutations}


REVIEW_RETURNS_ANSWER = True

if __name__ == "__main__":
    print(self_test())
