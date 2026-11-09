"""Independent review of the rigid-motion property family (8.G.A.1) from public
payloads only.

The coordinates are read from the prompt; the stated motion is parsed from its
words and applied again here, so a wrong image is caught. Lengths, slopes,
angles, parallel pairs, orientation and area are recomputed with exact integer
and Fraction arithmetic. Each claim is judged by its own wording against those
measurements; the private answer, hint and explanation are values under test.
"""

import copy
import json
import math
import re
from fractions import Fraction as F

SUPPORTED = frozenset({
    "rigid-motion-measure-verify",
    "rigid-motion-property-claims",
    "rigid-motion-image-check",
    "rigid-motion-image-flaw",
})
REVIEW_RETURNS_ANSWER = True
PLACEHOLDER = re.compile(r"\$\{|\bundefined\b|\bNaN\b|\bnull\b|\[object")
POINT = re.compile(r"\$([A-Z])('?)\((-?\d+), (-?\d+)\)\$")


def require(condition, message):
    if not condition:
        raise ValueError(message)


# ---------------------------------------------------------------- geometry

def sub(a, b):
    return (a[0] - b[0], a[1] - b[1])


def cross(a, b):
    return a[0] * b[1] - a[1] * b[0]


def dot(a, b):
    return a[0] * b[0] + a[1] * b[1]


def d2(a, b):
    v = sub(a, b)
    return dot(v, v)


def slope(a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    require(dx != 0, "A vertical segment has no slope")
    return F(dy, dx)


def area2(points):
    return sum(cross(p, points[(i + 1) % len(points)]) for i, p in enumerate(points))


def degrees(a, b, c):
    """The angle at b, rounded to a whole degree (exact multiples of 45 here)."""
    u, v = sub(a, b), sub(c, b)
    return round(math.degrees(math.atan2(abs(cross(u, v)), dot(u, v))))


def whole_root(n):
    r = math.isqrt(n)
    return r if r * r == n else None


def motion_of(prompt):
    """The motion named in the prompt, as a function on points."""
    m = re.search(r"translated (\d+) units? (right|left)(?: and (\d+) units? (up|down))?", prompt)
    if m:
        dx = int(m.group(1)) * (1 if m.group(2) == "right" else -1)
        dy = int(m.group(3)) * (1 if m.group(4) == "up" else -1) if m.group(3) else 0
        return "slide", lambda p: (p[0] + dx, p[1] + dy)
    m = re.search(r"translated (\d+) units? (up|down)", prompt)
    if m:
        dy = int(m.group(1)) * (1 if m.group(2) == "up" else -1)
        return "slide", lambda p: (p[0], p[1] + dy)
    if "reflected over the $x$-axis" in prompt:
        return "flip", lambda p: (p[0], -p[1])
    if "reflected over the $y$-axis" in prompt:
        return "flip", lambda p: (-p[0], p[1])
    if "reflected over the line $y = x$" in prompt:
        return "flip", lambda p: (p[1], p[0])
    if "reflected over the line $y = -x$" in prompt:
        return "flip", lambda p: (-p[1], -p[0])
    if "rotated $90^\\circ$ counterclockwise about the origin" in prompt:
        return "turn", lambda p: (-p[1], p[0])
    if "rotated $90^\\circ$ clockwise about the origin" in prompt:
        return "turn", lambda p: (p[1], -p[0])
    if "rotated $180^\\circ$ about the origin" in prompt:
        return "turn", lambda p: (-p[0], -p[1])
    raise ValueError(f"No motion named in {prompt!r}")


NOUN = {"slide": "translation", "flip": "reflection", "turn": "rotation"}


def points_of(prompt):
    found = {}
    for name, prime, x, y in POINT.findall(prompt):
        key = name + prime
        require(key not in found, f"Point {key} named twice")
        found[key] = (int(x), int(y))
    return found


def box(points):
    xs, ys = [p[0] for p in points], [p[1] for p in points]
    return min(xs), max(xs), min(ys), max(ys)


def apart(a, b):
    p, q = box(a), box(b)
    return q[0] >= p[1] + 1 or p[0] >= q[1] + 1 or q[2] >= p[3] + 1 or p[2] >= q[3] + 1


def within(points, lo, hi):
    return all(lo <= x <= hi and lo <= y <= hi for x, y in points)


def check_motion(prompt, names):
    """Originals in [-8, 8], images recomputed and in [-10, 10], boxes apart."""
    pts = points_of(prompt)
    kind, move = motion_of(prompt)
    orig = [pts[n] for n in names]
    image = [pts[n + "'"] for n in names]
    require(len(pts) == 2 * len(names), "Only the named corners and their images")
    require([move(p) for p in orig] == image, "The image is not the stated motion of the original")
    require(within(orig, -8, 8) and within(image, -10, 10), "Coordinates out of range")
    require(apart(orig, image), "Original and image overlap")
    return kind, orig, image


def graph_points(scene):
    graphs = [e for e in scene["elements"] if e["type"] == "graph"]
    require(len(graphs) == 1, "One coordinate plane")
    return {p["label"]: (p["x"], p["y"]) for p in graphs[0].get("points", []) if p.get("label")}


def frac_text(q):
    return str(q.numerator) if q.denominator == 1 else f"{q.numerator}/{q.denominator}"


def tex_frac(q):
    if q.denominator == 1:
        return str(q.numerator)
    sign = "-" if q < 0 else ""
    return f"{sign}\\frac{{{abs(q.numerator)}}}{{{q.denominator}}}"


# ---------------------------------------------------------------- measure and verify

def bank_of(response):
    require(response["kind"] == "structured-work" and response["mode"] == "build", "Structured work, build mode")
    require(response["layout"] == "steps" and len(response["banks"]) == 1, "One claim bank")
    rows = response["rows"]
    require(all(len(r["fields"]) == 1 for r in rows), "One field per row")
    kinds = [r["fields"][0]["kind"] for r in rows]
    require(kinds[-1] == "choice" and all(k == "number" for k in kinds[:-1]), "Numbers then one claim")
    options = response["banks"][0]["options"]
    require(len(options) == 4 and len({o["label"] for o in options}) == 4, "Four distinct claims")
    return rows, options


def only(options, test, what):
    found = [o["id"] for o in options if test(o["label"])]
    require(len(found) == 1, f"Exactly one {what} claim, found {len(found)}")
    return found[0]


def solve_measure(public):
    prompt = public["prompt"]
    rows, options = bank_of(public["response"])
    labels = [r.get("label", "") for r in rows]
    if prompt.startswith("Segment $AB$"):
        kind, (a, b), (a1, b1) = check_motion(prompt, ["A", "B"])
        length, length1 = whole_root(d2(a, b)), whole_root(d2(a1, b1))
        require(length is not None and length == length1, "Lengths are whole and kept")
        require(labels[:2] == ["Length of $AB$", "Length of $A'B'$"], "Length rows")
        correct = f"$A'B' = AB$. A {NOUN[kind]} keeps the length of every segment."
        values = [str(length), str(length1)]
        dx, dy = abs(b[0] - a[0]), abs(b[1] - a[1])
        for o in options:
            text = o["label"]
            m = re.fullmatch(r"They are equal only because the legs of \$AB\$ are (\d+) and (\d+); other segments would change length\.", text)
            if m:
                require((int(m.group(1)), int(m.group(2))) == (dx, dy) and dx and dy, "Legs named in a claim")
        key = only(options, lambda t: t == correct, "kept-length")
        check = "length"
    elif prompt.startswith("Points $P"):
        kind, (p, q, r), (p1, q1, r1) = check_motion(prompt, ["P", "Q", "R"])
        require(cross(sub(q, p), sub(r, p)) == 0, "P, Q and R are on one line")
        s1, s2 = slope(p1, q1), slope(q1, r1)
        require(s1 == s2, "Image points are on one line")
        require(labels[:2] == ["Slope of $P'Q'$", "Slope of $Q'R'$"], "Slope rows")
        values = [frac_text(s1), frac_text(s2)]
        before = slope(p, q)
        for o in options:
            m = re.fullmatch(r"The slope changed from \$(.+?)\$ to \$(.+?)\$, so the points no longer lie on one line\.", o["label"])
            if m:
                require(m.group(1) == tex_frac(before) and m.group(2) == tex_frac(s1) and before != s1, "Slope change claim")
            if o["label"].startswith("The points stay on one line only because the slope did not change"):
                require(before == s1, "Unchanged-slope claim only when the slope is unchanged")
        key = only(options, lambda t: t.startswith("The slopes are equal, so $P'$, $Q'$ and $R'$ lie on one line."), "on-one-line")
        check = "line"
    elif prompt.startswith("In quadrilateral $ABCD$"):
        kind, (a, b, c, d), (a1, b1, c1, d1) = check_motion(prompt, ["A", "B", "C", "D"])
        require(cross(sub(b, a), sub(c, d)) == 0, "AB is parallel to DC")
        require(area2([a, b, c, d]) > 0, "Corners go counterclockwise")
        s1, s2 = slope(a1, b1), slope(d1, c1)
        require(s1 == s2, "Image sides are parallel")
        require(labels[:2] == ["Slope of $A'B'$", "Slope of $D'C'$"], "Slope rows")
        values = [frac_text(s1), frac_text(s2)]
        changed = slope(a, b) != s1
        for o in options:
            if o["label"].startswith("$A'B'$ and $D'C'$ are not parallel to $AB$ and $DC$"):
                require(changed, "Not-parallel-to-original claim only when the slope changed")
            if o["label"].startswith("The sides stay parallel only because the slopes did not change"):
                require(not changed, "Unchanged-slope claim only when unchanged")
        key = only(options, lambda t: t.startswith("The slopes are equal, so $A'B' \\parallel D'C'$."), "parallel")
        check = "parallel"
    else:
        require(prompt.startswith("Triangle $ABC$ has a right angle at $B$"), f"Unknown prompt {prompt!r}")
        kind, (a, b, c), (a1, b1, c1) = check_motion(prompt, ["A", "B", "C"])
        require(dot(sub(a, b), sub(c, b)) == 0, "The original angle at B is right")
        ab, bc, ac = d2(a1, b1), d2(b1, c1), d2(a1, c1)
        require(ab + bc == ac and ac <= 200, "Squared lengths fit the converse")
        require(len(labels) == 4 and labels[0].startswith("$A'B'^2$") and labels[1].startswith("$B'C'^2$")
                and labels[2].startswith("$A'C'^2$"), "Squared-length rows")
        values = [str(ab), str(bc), str(ac)]
        on_grid = a1[0] == b1[0] or a1[1] == b1[1]
        for o in options:
            if o["label"] == "Yes, but only because the legs lie along grid lines.":
                require(not on_grid, "Grid-line claim only for slanted legs")
        key = only(options, lambda t: t.startswith("Yes. $A'B'^2 + B'C'^2 = A'C'^2$"), "converse")
        check = "right"
    require(len(values) == len(rows) - 1, "One number per number row")
    answer = json.dumps([[v] for v in values] + [[key]], separators=(",", ":"))
    return answer, (check, values)


# ---------------------------------------------------------------- property claims

def statement_truth(label, orig, image):
    a, b, c, d = orig
    a1, b1, c1, d1 = image
    names = {"A'": a1, "B'": b1, "C'": c1, "D'": d1, "A": a, "B": b, "C": c, "D": d}
    m = re.fullmatch(r"\$([A-D]')([A-D]') = (\d+)\$", label)
    if m:
        return d2(names[m.group(1)], names[m.group(2)]) == int(m.group(3)) ** 2
    m = re.fullmatch(r"\$m\\angle ([A-D]')([A-D]')([A-D]') = (\d+)\^\\circ\$", label)
    if m:
        return degrees(names[m.group(1)], names[m.group(2)], names[m.group(3)]) == int(m.group(4))
    m = re.fullmatch(r"\$([A-D]'?)([A-D]'?) \\parallel ([A-D]'?)([A-D]'?)\$", label)
    if m:
        p, q, r, s = (names[m.group(i)] for i in range(1, 5))
        return cross(sub(q, p), sub(s, r)) == 0
    if label == "Going $A' \\to B' \\to C' \\to D'$ turns the same way as going $A \\to B \\to C \\to D$":
        return (area2(image) > 0) == (area2(orig) > 0)
    if label == "$A'B'C'D'$ has the same area as $ABCD$":
        return abs(area2(image)) == abs(area2(orig))
    raise ValueError(f"Unknown statement {label!r}")


def solve_claims(public):
    prompt = public["prompt"]
    kind, orig, image = check_motion(prompt, ["A", "B", "C", "D"])
    a, b, c, d = orig
    m = re.search(r"\$m\\angle ABC = (\d+)\^\\circ\$", prompt)
    require(m is not None, "Stated angle")
    require(degrees(a, b, c) == int(m.group(1)) and int(m.group(1)) in (45, 90, 135), "Stated angle matches the drawing")
    require(cross(sub(b, a), sub(c, d)) == 0, "AB is parallel to DC")
    require(whole_root(d2(a, d)) is not None, "AD is a whole number")
    response = public["response"]
    require(response["kind"] == "multi-select" and len(response["options"]) == 6, "Six statements")
    truth = [statement_truth(o["label"], orig, image) for o in response["options"]]
    count = sum(truth)
    require(2 <= count <= 4 and response["selectionCount"] == count, "Two to four true, and the count shown")
    require(response["label"] == f"Choose {count} true statements", "Answer label")
    key = sorted(o["id"] for o, t in zip(response["options"], truth) if t)
    return json.dumps(key, separators=(",", ":")), (orig, image, truth)


# ---------------------------------------------------------------- image check and flaw

def congruent_in_order(p, q):
    """Equal six distances (four sides, two diagonals) with corners in order."""
    pairs = [(0, 1), (1, 2), (2, 3), (3, 0), (0, 2), (1, 3)]
    return all(d2(p[i], p[j]) == d2(q[i], q[j]) for i, j in pairs)


def parallelogram_of(prompt):
    pts = points_of(prompt)
    orig = [pts[n] for n in "ABCD"]
    a, b, c, d = orig
    require(within(orig, -8, 8), "Original in range")
    require(b[1] == a[1] and 4 <= b[0] - a[0] <= 8, "AB is horizontal, 4 to 8 long")
    require(sub(c, b) == sub(d, a) and d2(a, d) == 25, "A parallelogram with AD = 5")
    return orig, pts


def solve_image_check(public):
    prompt = public["prompt"]
    require(prompt.startswith("Parallelogram $ABCD$ has") and "Which graph is it?" in prompt, "Prompt")
    orig, _ = parallelogram_of(prompt)
    response = public["response"]
    require(response["kind"] == "figure-choice" and response["noun"] == "Graph", "Graph choice")
    require([o["id"] for o in response["options"]] == ["option-a", "option-b", "option-c", "option-d"], "Four lettered graphs")
    matches, signatures = [], set()
    for option in response["options"]:
        pts = graph_points(option["scene"])
        cand = [pts[n] for n in "PQRS"]
        require(within(cand, -10, 10), "Candidate in range")
        named = [f"{n}({x}, {y})".replace("-", "−") for n, (x, y) in zip("PQRS", cand)]
        require(option["label"] == f"Quadrilateral PQRS with corners {named[0]}, {named[1]}, {named[2]} and {named[3]}.",
                "Description lists the drawn corners")
        signatures.add(tuple(sorted(d2(cand[i], cand[(i + 1) % 4]) for i in range(4)))
                       + tuple(sorted((d2(cand[0], cand[2]), d2(cand[1], cand[3])))))
        if congruent_in_order(orig, cand):
            matches.append(option["id"])
    require(len(matches) == 1, f"Exactly one congruent candidate, found {len(matches)}")
    require(len(signatures) == 4, "Candidates are pairwise non-congruent")
    return matches[0], orig


FLAW_PATTERNS = [
    (re.compile(r"No\. \$PQ = (\d+)\$ but \$AB = (\d+)\$\."), "length"),
    (re.compile(r"No\. \$\\angle SPQ\$ is a right angle but \$\\angle DAB\$ is not\."), "right-new"),
    (re.compile(r"No\. \$\\angle SPQ\$ is not a right angle but \$\\angle DAB\$ is\."), "right-lost"),
    (re.compile(r"No\. \$PQ\$ and \$PS\$ match \$AB\$ and \$AD\$, but \$QS\^2 = (\d+)\$ while \$BD\^2 = (\d+)\$\."), "diagonal"),
    (re.compile(r"No\. \$SR\$ is not parallel to \$PQ\$\."), "parallel"),
    (re.compile(r"Yes\. Every side length, every angle and every parallel pair of \$ABCD\$ matches \$PQRS\$\."), "match"),
]


def flaw_truth(label, orig, cand):
    a, b, c, d = orig
    p, q, r, s = cand
    right = lambda x, y, z: dot(sub(y, x), sub(z, x)) == 0  # angle at x
    for pattern, kind in FLAW_PATTERNS:
        m = pattern.fullmatch(label)
        if not m:
            continue
        if kind == "length":
            x, y = int(m.group(1)), int(m.group(2))
            require(d2(a, b) == y * y, "The statement quotes AB correctly")
            return d2(p, q) == x * x and x != y
        if kind == "right-new":
            return right(p, s, q) and not right(a, d, b)
        if kind == "right-lost":
            return not right(p, s, q) and right(a, d, b)
        if kind == "diagonal":
            x, y = int(m.group(1)), int(m.group(2))
            require(d2(b, d) == y, "The statement quotes BD correctly")
            return d2(p, q) == d2(a, b) and d2(p, s) == d2(a, d) and d2(q, s) == x and x != y
        if kind == "parallel":
            return cross(sub(q, p), sub(r, s)) != 0
        return congruent_in_order(orig, cand)
    raise ValueError(f"Unknown statement {label!r}")


def solve_image_flaw(public):
    prompt = public["prompt"]
    require(prompt.endswith("Choose the statement that settles it."), "Prompt")
    orig, pts = parallelogram_of(prompt)
    cand = [pts[n] for n in "PQRS"]
    require(within(cand, -10, 10) and apart(orig, cand), "Candidate in range, beside the original")
    response = public["response"]
    require(response["kind"] == "choice" and len(response["options"]) == 4, "Four statements")
    truth = [flaw_truth(o["label"], orig, cand) for o in response["options"]]
    require(sum(truth) == 1, f"Exactly one true statement, found {sum(truth)}")
    figure = graph_points(public["figure"]["scene"])
    require(all(figure[n] == pts[n] for n in "ABCDPQRS"), "Figure matches the prompt")
    return response["options"][truth.index(True)]["id"], (orig, cand)


# ---------------------------------------------------------------- dispatch

def solve(public):
    template = public["templateId"]
    require(template in SUPPORTED, "Wrong family")
    if template == "rigid-motion-measure-verify":
        return solve_measure(public)[0]
    if template == "rigid-motion-property-claims":
        return solve_claims(public)[0]
    if template == "rigid-motion-image-check":
        return solve_image_check(public)[0]
    return solve_image_flaw(public)[0]


def review_problem(problem):
    public = problem["public"]
    template = public["templateId"]
    require(template in SUPPORTED, "Wrong family")
    explanation = problem["explanation"]
    text = " ".join(explanation)
    if template == "rigid-motion-measure-verify":
        expected, (check, values) = solve_measure(public)
        if check == "length":
            require(f"= {values[0]}$" in text, "The explanation computes the length")
        elif check in ("line", "parallel"):
            require(f"= {tex_frac(F(values[0]))}$" in text, "The explanation computes the slope")
        else:
            require(f"${values[0]} + {values[1]} = {values[2]}$" in text, "The explanation adds the squares")
        # The figure shows the same points as the prompt.
        pts = graph_points(public["figure"]["scene"])
        named = points_of(public["prompt"])
        for name, p in named.items():
            require(pts.get(name.replace("'", "′")) == p, f"Figure point {name}")
    elif template == "rigid-motion-property-claims":
        expected, (orig, image, truth) = solve_claims(public)
        for option, t in zip(public["response"]["options"], truth):
            require(any(line.startswith(f"{option['label']} is {'true' if t else 'false'}") for line in explanation),
                    f"The explanation judges {option['label']!r} correctly")
    elif template == "rigid-motion-image-check":
        expected, orig = solve_image_check(public)
        letter = "ABCD"["abcd".index(expected[-1])]
        line = next(l for l in explanation if l.startswith(f"Graph {letter}:"))
        require("every length, angle and parallel pair matches" in line, "The explanation accepts the right graph")
        require(set(problem.get("choiceFeedback", {})) == {"option-a", "option-b", "option-c", "option-d"} - {expected},
                "Feedback for each other graph")
    else:
        expected, _ = solve_image_flaw(public)
        require(set(problem.get("choiceFeedback", {})) == {"option-a", "option-b", "option-c", "option-d"} - {expected},
                "Feedback for each other statement")
    require(isinstance(problem["answer"], str) and problem["answer"] == expected,
            f"Answer {problem['answer']} disagrees with the measurements; expected {expected}")
    for t in [public["prompt"], problem["hint"], *explanation]:
        require(not PLACEHOLDER.search(t), f"Unrendered placeholder in {t!r}")
    return expected


# ---------------------------------------------------------------- self test

def plane(points):
    return {"kind": "scene", "scene": {"v": 1, "elements": [
        {"type": "graph", "x": [-10, 10], "y": [-10, 10],
         "points": [{"x": x, "y": y, "label": n} for n, (x, y) in points.items()]}]}}


def work(rows, options):
    return {"kind": "structured-work", "label": "Your measurements", "layout": "steps", "mode": "build",
            "banks": [{"id": "claims", "label": "What the measurements show",
                       "options": [{"id": "abcd"[i], "label": t} for i, t in enumerate(options)]}],
            "rows": [{"id": f"r{i + 1}", "label": label,
                      "fields": [{"kind": "number", "label": "Number"} if label else {"kind": "choice", "label": "Claim", "bank": "claims"}]}
                     for i, label in enumerate(rows)]}


def self_test():
    segment = {
        "public": {
            "templateId": "rigid-motion-measure-verify", "seed": "f",
            "prompt": "Segment $AB$ has endpoints $A(1, 2)$ and $B(4, 6)$. It is reflected over the $y$-axis. Its image is $A'B'$, with endpoints $A'(-1, 2)$ and $B'(-4, 6)$. Measure both segments, then choose what the measurements show.",
            "response": work(["Length of $AB$", "Length of $A'B'$", None], [
                "They are equal only because the legs of $AB$ are 3 and 4; other segments would change length.",
                "$A'B' = AB$. A reflection keeps the length of every segment.",
                "They are equal only because the mirror line passes through the origin.",
                "$A'B' = AB$, so $A'B'$ is the same segment as $AB$."]),
            "figure": plane({"A": (1, 2), "B": (4, 6), "A′": (-1, 2), "B′": (-4, 6)}),
        },
        "answer": '[["5"],["5"],["b"]]', "hint": "Start at $A(1, 2)$.",
        "explanation": ["$AB = \\sqrt{25} = 5$.", "$A'B' = \\sqrt{25} = 5$."],
    }
    require(review_problem(segment) == segment["answer"], "Segment fixture")
    triangle = {
        "public": {
            "templateId": "rigid-motion-measure-verify", "seed": "f",
            "prompt": "Triangle $ABC$ has a right angle at $B$, with $A(1, 3)$, $B(2, 1)$ and $C(6, 3)$. It is rotated $90^\\circ$ counterclockwise about the origin, to make triangle $A'B'C'$ with $A'(-3, 1)$, $B'(-1, 2)$ and $C'(-3, 6)$. Find the square of each side length of $A'B'C'$, then decide whether $\\angle A'B'C'$ is a right angle.",
            "response": work(["$A'B'^2$, the square of the length $A'B'$", "$B'C'^2$, the square of the length $B'C'$",
                              "$A'C'^2$, the square of the length $A'C'$", None], [
                "Yes. $A'B'^2 + B'C'^2 = A'C'^2$, so by the converse of the Pythagorean theorem, $\\angle A'B'C'$ is a right angle.",
                "No. The $90^\\circ$ turn added $90^\\circ$, so $\\angle A'B'C'$ now measures $180^\\circ$.",
                "Yes, but only because the legs lie along grid lines.",
                "No. $A'B' + B'C'$ is not equal to $A'C'$, so the angle is not a right angle."]),
            "figure": plane({"A": (1, 3), "B": (2, 1), "C": (6, 3), "A′": (-3, 1), "B′": (-1, 2), "C′": (-3, 6)}),
        },
        "answer": '[["5"],["20"],["25"],["a"]]', "hint": "Start at $A'(-3, 1)$.",
        "explanation": ["$5 + 20 = 25$."],
    }
    require(review_problem(triangle) == triangle["answer"], "Right-angle fixture")
    claims_options = ["$A'D' = 5$", "$A'D' = 7$", "$m\\angle A'B'C' = 135^\\circ$", "$m\\angle A'B'C' = 45^\\circ$",
                      "$A'B' \\parallel D'C'$", "$A'B' \\parallel AB$"]
    claims = {
        "public": {
            "templateId": "rigid-motion-property-claims", "seed": "f",
            "prompt": "Quadrilateral $ABCD$ has $AB \\parallel DC$, with $A(0, 0)$, $B(5, 0)$, $C(8, 3)$ and $D(3, 4)$, and $m\\angle ABC = 135^\\circ$. It is reflected over the $x$-axis, to make $A'B'C'D'$ with $A'(0, 0)$, $B'(5, 0)$, $C'(8, -3)$ and $D'(3, -4)$. Which statements are true?",
            "response": {"kind": "multi-select", "label": "Choose 4 true statements", "selectionCount": 4,
                         "options": [{"id": f"option-{'abcdef'[i]}", "label": t} for i, t in enumerate(claims_options)]},
        },
        "answer": "", "hint": "A reflection keeps lengths.", "explanation": [],
    }
    # That shape is not a trapezoid with AB ∥ DC and the boxes overlap: rejected.
    try:
        review_problem(claims)
    except ValueError:
        pass
    else:
        raise AssertionError("Accepted a claims case whose quadrilateral is not a trapezoid")
    claims["public"]["prompt"] = ("Quadrilateral $ABCD$ has $AB \\parallel DC$, with $A(-2, 1)$, $B(3, 1)$, $C(6, 4)$ and $D(2, 4)$, "
                                  "and $m\\angle ABC = 135^\\circ$. It is reflected over the $x$-axis, to make $A'B'C'D'$ with "
                                  "$A'(-2, -1)$, $B'(3, -1)$, $C'(6, -4)$ and $D'(2, -4)$. Which statements are true?")
    claims["answer"] = '["option-a","option-c","option-e","option-f"]'
    claims["public"]["response"]["options"][3]["label"] = "$m\\angle A'B'C' = 45^\\circ$"
    claims["explanation"] = [f"{o} is {v}: reason." for o, v in zip(claims_options, ["true", "false", "true", "false", "true", "true"])]
    require(review_problem(claims) == claims["answer"], "Claims fixture")

    def graph_option(i, pts):
        label = "Quadrilateral PQRS with corners " + ", ".join(f"{n}({x}, {y})".replace("-", "−") for n, (x, y) in zip("PQR", pts[:3])) \
            + " and " + f"S({pts[3][0]}, {pts[3][1]})".replace("-", "−") + "."
        return {"id": f"option-{'abcd'[i]}", "label": label,
                "scene": plane({n: p for n, p in zip("PQRS", pts)})["scene"]}
    image = [(-5, -2), (3, -2), (6, -6), (-2, -6)]
    candidates = [[(-5, -2), (3, -2), (6, -7), (-2, -6)], [(-5, -2), (4, -2), (7, -6), (-2, -6)],
                  [(-5, -2), (3, -2), (7, -5), (-1, -5)], image]
    check = {
        "public": {
            "templateId": "rigid-motion-image-check", "seed": "f",
            "prompt": "Parallelogram $ABCD$ has $A(-5, 2)$, $B(3, 2)$, $C(6, 6)$ and $D(-2, 6)$. Exactly one graph shows a quadrilateral $PQRS$ that could be the image of $ABCD$ after a slide, flip or turn, with $P$, $Q$, $R$ and $S$ the images of $A$, $B$, $C$ and $D$. Which graph is it?",
            "response": {"kind": "figure-choice", "label": "Choose the graph", "noun": "Graph",
                         "options": [graph_option(i, c) for i, c in enumerate(candidates)]},
        },
        "answer": "option-d", "hint": "Compare $AB$ from $A(-5, 2)$.",
        "explanation": ["Graph D: $PQ = 8$, every length, angle and parallel pair matches $ABCD$."],
        "choiceFeedback": {"option-a": "x", "option-b": "x", "option-c": "x"},
    }
    require(review_problem(check) == "option-d", "Image-check fixture")
    flaw = {
        "public": {
            "templateId": "rigid-motion-image-flaw", "seed": "f",
            "prompt": "Parallelogram $ABCD$ has $A(-3, 2)$, $B(5, 2)$, $C(1, 5)$ and $D(-7, 5)$. Quadrilateral $PQRS$ has $P(-6, -3)$, $Q(2, -3)$, $R(-2, 1)$ and $S(-10, 0)$. Could $PQRS$ be the image of $ABCD$ after a slide, flip or turn, with $P$, $Q$, $R$ and $S$ the images of $A$, $B$, $C$ and $D$? Choose the statement that settles it.",
            "response": {"kind": "choice", "label": "Choose one statement", "options": [
                {"id": "option-a", "label": "Yes. Every side length, every angle and every parallel pair of $ABCD$ matches $PQRS$."},
                {"id": "option-b", "label": "No. $SR$ is not parallel to $PQ$."},
                {"id": "option-c", "label": "No. $PQ = 7$ but $AB = 8$."},
                {"id": "option-d", "label": "No. $PQ$ and $PS$ match $AB$ and $AD$, but $QS^2 = 41$ while $BD^2 = 153$."}]},
            "figure": plane({"A": (-3, 2), "B": (5, 2), "C": (1, 5), "D": (-7, 5),
                             "P": (-6, -3), "Q": (2, -3), "R": (-2, 1), "S": (-10, 0)}),
        },
        "answer": "option-b", "hint": "Find $AB$ from $A(-3, 2)$.", "explanation": ["SR is not parallel."],
        "choiceFeedback": {"option-a": "x", "option-c": "x", "option-d": "x"},
    }
    require(review_problem(flaw) == "option-b", "Image-flaw fixture")

    mutations = 0
    for base, change, what in (
            (segment, lambda p: p.update(answer='[["5"],["6"],["b"]]'), "wrong length"),
            (segment, lambda p: p.update(answer='[["5"],["5"],["a"]]'), "wrong claim"),
            (segment, lambda p: p["public"].update(prompt=p["public"]["prompt"].replace("$B'(-4, 6)$", "$B'(-4, 7)$")), "image is not the motion"),
            (segment, lambda p: p["public"].update(prompt=p["public"]["prompt"].replace("$y$-axis", "$x$-axis")), "motion words changed"),
            (triangle, lambda p: p.update(answer='[["5"],["20"],["26"],["a"]]'), "wrong square"),
            (triangle, lambda p: p.update(explanation=["$5 + 20 = 26$."]), "false explanation sum"),
            (claims, lambda p: p.update(answer='["option-a","option-c","option-e"]'), "missing true statement"),
            (claims, lambda p: p["public"]["response"].update(selectionCount=3), "count shown wrong"),
            (claims, lambda p: p.update(explanation=[e.replace("$A'D' = 7$ is false", "$A'D' = 7$ is true") for e in p["explanation"]]), "explanation verdict"),
            (check, lambda p: p.update(answer="option-a"), "decoy keyed"),
            (check, lambda p: p["public"]["response"]["options"][0]["scene"]["elements"][0]["points"][2].update(y=-6), "two congruent candidates"),
            (flaw, lambda p: p.update(answer="option-c"), "false statement keyed"),
            (flaw, lambda p: p["public"]["response"]["options"][2].update(label="No. $PQ = 8$ but $AB = 9$."), "length statement misquotes AB"),
    ):
        bad = copy.deepcopy(base)
        change(bad)
        try:
            review_problem(bad)
        except (ValueError, KeyError, TypeError, IndexError, StopIteration, ZeroDivisionError):
            mutations += 1
        else:
            raise AssertionError(f"Accepted corrupt rigid-motion case: {what}")
    return {"fixtures": 5, "mutations": mutations}


if __name__ == "__main__":
    print(self_test())
