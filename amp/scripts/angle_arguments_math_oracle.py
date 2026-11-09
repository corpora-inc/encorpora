"""Independent review of the informal angle-argument families (8.G.A.5) from
public payloads only.

Every reason is judged from the figure's geometry, never from the generator:
the oracle reads the drawn points, lines, parallel marks, angle arcs and
angle labels, resolves each named angle to a corner and two rays, and then
decides each reason with its own truth table:

- alternate interior: two corners on the transversal, each angle has one ray
  along it pointing at the other corner (interior), the other rays point in
  opposite directions (opposite sides) along lines marked parallel;
- corresponding: the same, with both pairs of rays pointing the same way;
- vertical: one corner, every ray reversed;
- straight angle / linear pair: one corner, angles side by side with no
  overlap, filling 180 degrees between two opposite rays along the named line;
- same-side interior: interior at two corners, other rays pointing the same
  way, adding to 180 degrees;
- the split of an exterior angle by a ray inside it;
- appearance, measuring, "all angles equal", the triangle sum used for other
  angles, and angles around a point are never reasons for these claims.

A find-the-flaw key is the first step the table rejects. Motions (slides and
half-turns) are applied to the drawn angles. Similarity is decided by
comparing the three angles of each triangle as sets. The private answer and
explanation are only values under test.
"""

import copy
import json
import math
import re

SUPPORTED = frozenset({
    "triangle-angle-argument", "triangle-angle-reasons", "parallel-angle-argument",
    "parallel-angle-reasons", "aa-similarity-argument", "aa-similarity-select",
})
REVIEW_RETURNS_ANSWER = True
TOL = 1e-3
PLACEHOLDER = re.compile(r"\$\{|\bundefined\b|\bNaN\b|\bnull\b|\[object")


def require(condition, message):
    if not condition:
        raise ValueError(message)


def compact(key):
    return json.dumps(key, separators=(",", ":"))


# ---------------------------------------------------------------- geometry

def norm(d):
    return d % 360.0


def same_dir(a, b):
    diff = abs(norm(a) - norm(b))
    return min(diff, 360 - diff) < TOL


def parallel_dir(a, b):
    return same_dir(a, b) or same_dir(a, b + 180)


def direction(p, q):
    return norm(math.degrees(math.atan2(q[1] - p[1], q[0] - p[0])))


def close(p, q, tol=1e-4):
    return abs(p[0] - q[0]) < tol and abs(p[1] - q[1]) < tol


class Angle:
    """A corner and two rays; the sweep between them is under 180 degrees."""

    def __init__(self, vertex, a, b):
        a, b = norm(a), norm(b)
        if norm(b - a) <= 180:
            self.start, self.sweep = a, norm(b - a)
        else:
            self.start, self.sweep = b, norm(a - b)
        require(self.sweep > TOL, "Degenerate angle")
        self.vertex = vertex

    @property
    def rays(self):
        return (self.start, self.start + self.sweep)

    @property
    def end(self):
        return self.start + self.sweep

    def contains(self, d):
        return TOL < norm(d - self.start) < self.sweep - TOL


class Figure:
    def __init__(self, public):
        figure = public.get("figure")
        require(figure and figure["kind"] == "scene", "A scene figure")
        self.elements = figure["scene"]["elements"]
        self.by_id = {e["id"]: e for e in self.elements if "id" in e}
        self.points = {}
        for e in self.elements:
            if e.get("type") == "text" and e.get("id", "").startswith("p-"):
                self.points[e["text"].replace("′", "'")] = tuple(e["at"])
        self.segments = {e["id"]: (tuple(e["from"]), tuple(e["to"]))
                         for e in self.elements if e.get("type") == "segment"}
        self.marks = [e for e in self.elements if e.get("type") == "polyline" and e.get("id", "").startswith("pm-")]

    # lines -----------------------------------------------------------
    def line(self, name):
        """A named line as (point, direction): two point names or a segment."""
        if f"l-{name}" in self.segments:
            a, b = self.segments[f"l-{name}"]
            return a, direction(a, b)
        require(len(name) == 2 and all(c in self.points for c in name), f"Unknown line {name}")
        a, b = self.points[name[0]], self.points[name[1]]
        return a, direction(a, b)

    def drawn(self, point, d):
        """True when a drawn segment lies on the line through point along d."""
        for a, b in self.segments.values():
            if parallel_dir(direction(a, b), d) and on_line(point, (a, direction(a, b))):
                return True
        for e in self.elements:
            if e.get("type") == "polygon":
                pts = [tuple(p) for p in e["points"]]
                for i in range(len(pts)):
                    a, b = pts[i], pts[(i + 1) % len(pts)]
                    if parallel_dir(direction(a, b), d) and on_line(point, (a, direction(a, b))):
                        return True
        return False

    def marked(self, point, d):
        """True when a parallel mark sits on the line through point along d."""
        for m in self.marks:
            tip = tuple(m["points"][1])
            if on_line(tip, (point, d), 1e-3):
                return True
        return False

    # angles ----------------------------------------------------------
    def arc_angle(self, key):
        arc = self.by_id.get(f"a-{key}-0")
        require(arc is not None and arc["type"] == "arc", f"No arc for angle {key}")
        v = tuple(arc["center"])
        angle = Angle(v, arc["from"], arc["to"])
        for ray in angle.rays:
            require(self.drawn(v, ray), f"Angle {key} is not bounded by drawn lines")
        label = self.by_id.get(f"n-{key}")
        if label is not None:
            require(angle.contains(direction(v, label["at"])), f"Label {key} is outside its angle")
        return angle

    def crossing_angle(self, n):
        """Numbered angle at a crossing of t with p or q, found by its label."""
        label = self.by_id.get(f"n-{n}")
        require(label is not None, f"No label {n}")
        at = tuple(label["at"])
        t = self.line("t")
        crossings = [intersect(t, self.line(k)) for k in ("p", "q")]
        x = min(crossings, key=lambda c: math.dist(c, at))
        other = self.line("p") if close(x, crossings[0]) else self.line("q")
        rays = sorted(norm(d) for d in (t[1], t[1] + 180, other[1], other[1] + 180))
        w = direction(x, at)
        for i in range(4):
            a, b = rays[i], rays[(i + 1) % 4] + (360 if i == 3 else 0)
            if a < w < b or a < w + 360 < b:
                return Angle(x, a, b)
        raise ValueError(f"Label {n} sits on a line")

    def angle(self, ref):
        """`\\angle 4`, `\\angle B` (a triangle's angle) or `\\angle ACD`."""
        if ref.isdigit():
            if f"a-{ref}-0" in self.by_id:
                return self.arc_angle(ref)
            return self.crossing_angle(int(ref))
        if len(ref) == 1:
            require(f"a-{ref}-0" in self.by_id or ref in self.points, f"Unknown angle {ref}")
            v = self.points[ref]
            others = [p for name, p in self.points.items() if name in "ABC" and name != ref]
            require(len(others) == 2, "A triangle angle")
            return Angle(v, direction(v, others[0]), direction(v, others[1]))
        require(len(ref) == 3, f"Angle name {ref}")
        v = self.points[ref[1]]
        return Angle(v, direction(v, self.points[ref[0]]), direction(v, self.points[ref[2]]))


def on_line(point, line, tol=1e-4):
    (x0, y0), d = line
    dx, dy = math.cos(math.radians(d)), math.sin(math.radians(d))
    return abs((point[0] - x0) * dy - (point[1] - y0) * dx) < tol


def intersect(l1, l2):
    (x1, y1), d1 = l1
    (x2, y2), d2 = l2
    a1, b1 = math.cos(math.radians(d1)), math.sin(math.radians(d1))
    a2, b2 = math.cos(math.radians(d2)), math.sin(math.radians(d2))
    det = a1 * (-b2) + a2 * b1
    require(abs(det) > 1e-9, "Parallel lines do not cross")
    s = ((x2 - x1) * (-b2) + a2 * (y2 - y1)) / det
    return (x1 + s * a1, y1 + s * b1)


# ---------------------------------------------------------------- reasons

REASONS = [
    (re.compile(r"they are alternate interior angles along transversal \$(\w+)\$$"), "AI"),
    (re.compile(r"they are corresponding angles along transversal \$(\w+)\$$"), "CO"),
    (re.compile(r"together they fill a straight angle along line \$(\w+)\$$"), "LINE"),
    (re.compile(r"they form a linear pair, a straight angle along line \$(\w+)\$$"), "LP"),
    (re.compile(r"they are vertical angles, opposite each other at a crossing$"), "VERT"),
    (re.compile(r"same-side interior angles between parallel lines add to 180°$"), "SSI"),
    (re.compile(r"the three angles of any triangle add to 180°$"), "TRI"),
    (re.compile(r"they look the same size in the figure$"), "LOOK"),
    (re.compile(r"a protractor gives them the same measure$"), "MEAS"),
    (re.compile(r"the angles all the way around a point add to 360°$"), "AROUND"),
    (re.compile(r"ray \$CE\$ splits \$\\angle ACD\$ into exactly these two angles$"), "SPLIT"),
    (re.compile(r"\$\\angle ACD\$ and \$\\angle ACB\$ form a linear pair along \$BD\$$"), "LPACB"),
    (re.compile(r"all eight angles are equal because \$p \\parallel q\$$"), "ALLEQ"),
]


def reason_of(text):
    for pattern, kind in REASONS:
        m = pattern.match(text)
        if m:
            return kind, (m.group(1) if m.groups() else None)
    raise ValueError(f"Unknown reason {text!r}")


CLAIM_EQ = re.compile(r"\$\\angle (\w+) = \\angle (\w+)\$$")
CLAIM_SUM = re.compile(r"\$\\angle (\w+)((?: \+ \\angle \w+)+) = 180\^\\circ\$$")
CLAIM_SPLIT = re.compile(r"\$\\angle (\w{3}) = \\angle (\w+) \+ \\angle (\w+)\$$")


def claim_of(text):
    m = CLAIM_EQ.match(text)
    if m:
        return ("eq", [m.group(1), m.group(2)])
    m = CLAIM_SUM.match(text)
    if m:
        return ("sum", [m.group(1)] + re.findall(r"\\angle (\w+)", m.group(2)))
    m = CLAIM_SPLIT.match(text)
    if m:
        return ("split", [m.group(1), m.group(2), m.group(3)])
    raise ValueError(f"Unknown claim {text!r}")


def transversal_pair(fig, x, y, along, kind, need_marks=True):
    """Alternate interior ('AI'), corresponding ('CO') or same-side interior
    ('SSI') angles x and y at two corners of the line `along` (None: the line
    through both corners), with their other rays along parallel lines."""
    if close(x.vertex, y.vertex):
        return False
    dxy = direction(x.vertex, y.vertex)
    if along is not None:
        line = fig.line(along)
        if not (on_line(x.vertex, line) and on_line(y.vertex, line)):
            return False
    xl = [d for d in x.rays if parallel_dir(d, dxy)]
    yl = [d for d in y.rays if parallel_dir(d, dxy)]
    if len(xl) != 1 or len(yl) != 1:
        return False
    xo = next(d for d in x.rays if not parallel_dir(d, dxy))
    yo = next(d for d in y.rays if not parallel_dir(d, dxy))
    if not parallel_dir(xo, yo):
        return False
    if need_marks and not (fig.marked(x.vertex, xo) and fig.marked(y.vertex, yo)):
        return False
    interior = same_dir(xl[0], dxy) and same_dir(yl[0], dxy + 180)
    if kind == "AI":
        return interior and same_dir(xo, yo + 180)
    if kind == "SSI":
        return interior and same_dir(xo, yo)
    return same_dir(xl[0], yl[0]) and same_dir(xo, yo)


def vertical(x, y):
    return close(x.vertex, y.vertex) and all(
        any(same_dir(a, b + 180) for b in y.rays) for a in x.rays)


def straight(fig, angles, along):
    """Angles at one corner, side by side, filling the straight angle between
    two opposite rays along `along`."""
    v = angles[0].vertex
    if not all(close(a.vertex, v) for a in angles):
        return False
    if along is not None:
        line = fig.line(along)
        if not on_line(v, line):
            return False
        d = line[1]
    for order in _orders(angles):
        if all(same_dir(order[i].end, order[i + 1].start) for i in range(len(order) - 1)):
            total = sum(a.sweep for a in order)
            if abs(total - 180) < TOL and (along is None or parallel_dir(order[0].start, d)):
                return True
    return False


def _orders(items):
    if len(items) <= 1:
        yield list(items)
        return
    for i, first in enumerate(items):
        for rest in _orders(items[:i] + items[i + 1:]):
            yield [first] + rest


def valid_reason(fig, claim, reason, need_marks=True):
    kind, refs = claim
    rkind, line = reason
    angles = [fig.angle(ref) for ref in refs]
    if kind == "eq":
        x, y = angles
        if abs(x.sweep - y.sweep) > TOL:
            return False
        if rkind in ("AI", "CO"):
            return transversal_pair(fig, x, y, line, rkind, need_marks)
        if rkind == "VERT":
            return vertical(x, y)
        return False
    if kind == "sum":
        if rkind in ("LINE", "LP"):
            return (rkind == "LINE" or len(angles) == 2) and straight(fig, angles, line)
        if rkind == "SSI":
            return len(angles) == 2 and transversal_pair(fig, angles[0], angles[1], None, "SSI", need_marks) \
                and abs(angles[0].sweep + angles[1].sweep - 180) < TOL
        if rkind == "TRI":
            return sorted(refs) == ["A", "B", "C"]
        return False
    # split: the whole angle is the two parts, side by side, cut by ray CE
    whole, a, b = angles
    if rkind != "SPLIT":
        return False
    ce = direction(fig.points["C"], fig.points["E"])
    if not (close(a.vertex, whole.vertex) and close(b.vertex, whole.vertex)):
        return False
    for first, second in ((a, b), (b, a)):
        if same_dir(first.end, second.start) and same_dir(first.end, ce) \
                and same_dir(first.start, whole.start) and same_dir(second.end, whole.end):
            return True
    return False


# ------------------------------------------------------- multi-part reasons

def solve_reason_parts(public):
    fig = Figure(public)
    response = public["response"]
    require(response["kind"] == "multi-part-choice" and response["layout"] == "slots", "Slots")
    require(response["label"] == "Choose the reason for each step", "Response label")
    key, checked = {}, []
    for i, blank in enumerate(response["blanks"]):
        m = re.fullmatch(rf"Step {i + 1}: (.+) because", blank["label"])
        require(m is not None, f"Step label {blank['label']!r}")
        claim = claim_of(m.group(1))
        require(len(blank["options"]) == 4, "Four reasons per step")
        hits = [o["id"] for o in blank["options"] if valid_reason(fig, claim, reason_of(o["label"]))]
        require(len(hits) == 1, f"Step {i + 1} needs exactly one valid reason, found {len(hits)}")
        key[blank["id"]] = hits[0]
        checked.append(claim)
    template = public["templateId"]
    prompt = public["prompt"]
    if template == "triangle-angle-reasons":
        if prompt.startswith("Line $DE$"):
            require([c[1] for c in checked] == [["1", "B"], ["3", "C"], ["1", "2", "3"]], "Sum steps")
            require(fig.marked(fig.points["A"], 0) and fig.marked(fig.points["B"], 0), "DE and BC are marked parallel")
        else:
            require([c[1] for c in checked] == [["4", "A"], ["5", "B"], ["ACD", "4", "5"]], "Exterior steps")
    else:
        target = re.search(r"argument that (\$\\angle \d+ (?:=|\+) \\angle \d+(?: = 180\^\\circ)?\$)\.", prompt)
        require(target is not None, "Parallel target")
        tclaim = claim_of(target.group(1))
        (k1, (a, m1)), (k2, (m2, b)) = checked
        require(k1 == "eq" and m1 == m2 and tclaim == (k2, [a, b]), "Steps chain to the target")
        # The target is the fact proved: its own relation must hold in the figure.
        rel = "AI" if k2 == "eq" else "SSI"
        require(transversal_pair(fig, fig.angle(a), fig.angle(b), "t", rel)
                if rel == "AI" else valid_reason(fig, tclaim, ("SSI", None)), "Target relation")
    return compact(key)


# ------------------------------------------------------------- flaw items

STEPS = re.compile(r"Step 1: (.+) Step 2: (.+) Step 3: (.+) In which step does the argument first go wrong\?$")
FLAW_OPTIONS = ["Step 1", "Step 2", "Step 3", "No step is wrong"]


def steps_of(prompt):
    m = STEPS.search(prompt)
    require(m is not None, "Three steps")
    return [m.group(1), m.group(2), m.group(3)]


def claims_with_reasons(text):
    """'<claim> because <reason>, and <claim> because <reason>.'"""
    require(text.endswith("."), "Step ends with a period")
    out = []
    for part in text[:-1].split(", and "):
        claim, _, reason = part.partition(" because ")
        out.append((claim_of(claim), reason_of(reason)))
    return out


def first_wrong(valid):
    for i, ok in enumerate(valid):
        if not ok:
            return i + 1
    return 0


def choice_key(public, label):
    hits = [o["id"] for o in public["response"]["options"] if o["label"] == label]
    require(len(hits) == 1, f"Option {label!r}")
    return hits[0]


def flaw_key(public, flaw):
    options = [o["label"] for o in public["response"]["options"]]
    require(options == FLAW_OPTIONS, "Step options in order")
    return choice_key(public, FLAW_OPTIONS[3] if flaw == 0 else f"Step {flaw}")


def sum_flaw(public):
    fig = Figure(public)
    require(public["prompt"].startswith("A student argues that the angles of triangle $ABC$ add to 180°."), "Prompt")
    s1, s2, s3 = steps_of(public["prompt"])
    A, B, C = (fig.points[k] for k in "ABC")
    de = fig.line("DE")
    built = on_line(A, de) and parallel_dir(de[1], direction(B, C))
    if s1 == "Draw line $DE$ through $A$ parallel to $BC$.":
        v1 = built and fig.marked(A, de[1]) and fig.marked(B, direction(B, C))
    else:
        require(s1 == "Draw a line $DE$ through $A$; it looks parallel to $BC$, so it is parallel.", "Step 1")
        v1 = False
    v2 = all(valid_reason(fig, c, r) for c, r in claims_with_reasons(s2))
    m = re.fullmatch(r"(.+) because (.+)\. Replacing \$\\angle 1\$ and \$\\angle 3\$ gives "
                     r"\$\\angle A \+ \\angle B \+ \\angle C = 180\^\\circ\$\.", s3)
    require(m is not None, "Step 3")
    claim = claim_of(m.group(1))
    require(claim == ("sum", ["1", "2", "3"]), "Step 3 claim")
    v3 = valid_reason(fig, claim, reason_of(m.group(2)))
    return flaw_key(public, first_wrong([v1, v2, v3]))


def exterior_flaw(public):
    fig = Figure(public)
    require(public["prompt"].startswith("A student argues that the exterior angle $\\angle ACD$ of triangle $ABC$ equals $\\angle A + \\angle B$."), "Prompt")
    s1, s2, s3 = steps_of(public["prompt"])
    A, B, C, D, E = (fig.points[k] for k in "ABCDE")
    require(s1 == "Draw ray $CE$ through $C$ parallel to $AB$, and extend side $BC$ past $C$ to $D$.", "Step 1")
    v1 = parallel_dir(direction(C, E), direction(A, B)) and on_line(D, (B, direction(B, C))) \
        and math.dist(B, D) > math.dist(B, C) and fig.marked(C, direction(C, E))
    v2 = all(valid_reason(fig, c, r) for c, r in claims_with_reasons(s2))
    whole = fig.angle("ACD").sweep
    a, b, c = fig.angle("A").sweep, fig.angle("B").sweep, fig.angle("C").sweep
    m = re.fullmatch(r"So \$\\angle ACD = \\angle 4 \+ \\angle 5 = \\angle A \+ \\angle (\w)\$, because ray \$CE\$ splits "
                     r"\$\\angle ACD\$ into \$\\angle 4\$ and \$\\angle 5\$\.", s3)
    if m:
        split = valid_reason(fig, ("split", ["ACD", "4", "5"]), ("SPLIT", None))
        other = {"B": b, "C": c}[m.group(1)]
        v3 = split and abs(whole - (a + other)) < TOL
    else:
        require(s3 == "So $\\angle ACD = 180^\\circ - \\angle A$, because $\\angle ACD$ and $\\angle A$ form a straight angle.", "Step 3")
        v3 = abs(whole - (180 - a)) < TOL and straight(fig, [fig.angle("ACD"), fig.angle("A")], None)
    return flaw_key(public, first_wrong([v1, v2, v3]))


def parallel_flaw(public):
    fig = Figure(public)
    m = re.match(r"Lines \$p\$ and \$q\$ are parallel, and line \$t\$ crosses both\. A student argues that (.+?)\. Step 1:",
                 public["prompt"])
    require(m is not None, "Prompt")
    target = claim_of(m.group(1))
    s1, s2, s3 = steps_of(public["prompt"])
    (c1, r1), = claims_with_reasons(s1)
    (c2, r2), = claims_with_reasons(s2)
    v1 = valid_reason(fig, c1, r1)
    v2 = valid_reason(fig, c2, r2)
    a, mid = c1[1]
    require(c1[0] == "eq" and c2[1][0] == mid, "Steps chain through one angle")
    follows = target == (c2[0], [a, c2[1][1]])
    measures = [fig.angle(x).sweep for x in target[1]]
    true = abs(measures[0] - measures[1]) < TOL if target[0] == "eq" else abs(sum(measures) - 180) < TOL
    plain = re.fullmatch(r"So (.+)\.", s3)
    cited = re.fullmatch(r"So (.+), because (.+)\.", s3)
    if cited:
        require(claim_of(cited.group(1)) == target, "Step 3 claim")
        # A reason that is the target's own relation proves nothing.
        circular = valid_reason(fig, target, reason_of(cited.group(2)))
        v3 = follows and true and not circular
    else:
        require(plain is not None and claim_of(plain.group(1)) == target, "Step 3 claim")
        v3 = follows and true
    return flaw_key(public, first_wrong([v1, v2, v3]))


# ----------------------------------------------------------- prose choices

def copies_choice(public):
    fig = Figure(public)
    A, B, C = (fig.points[k] for k in "ABC")
    Cp, Bp = fig.points["C'"], fig.points["B'"]
    require(close(Cp, (A[0] + B[0] - C[0], A[1] + B[1] - C[1])) and close(Bp, (A[0] + C[0] - B[0], A[1] + C[1] - B[1])),
            "Copies are half-turns about the midpoints of AB and AC")
    top = (Cp, direction(Cp, Bp))
    require(on_line(A, top) and parallel_dir(top[1], direction(B, C)), "C'AB' is straight and parallel to BC")
    one = fig.angle("1")
    require(close(one.vertex, A), "Angle 1 at A")
    if "Which argument shows that $\\angle 1$ must equal $\\angle B$" in public["prompt"]:
        alt = transversal_pair(fig, one, fig.angle("B"), "AB", "AI", need_marks=False)
        cor = transversal_pair(fig, one, fig.angle("B"), "AB", "CO", need_marks=False)
        require(alt and not cor and not vertical(one, fig.angle("B")), "Angle 1 and B are alternate interior")
        label = ("$C'B' \\parallel BC$ and $AB$ is a transversal, so $\\angle 1$ and $\\angle B$ are alternate interior angles.")
    else:
        require("Why is the top edge $C'AB'$ one straight line" in public["prompt"], "Prompt")
        label = ("Each half-turn sends $BC$ to a parallel line through $A$, and only one line through $A$ is parallel to $BC$.")
    known = {label, "$C'B' \\parallel BC$ and $AB$ is a transversal, so $\\angle 1$ and $\\angle B$ are corresponding angles.",
             "$\\angle 1$ and $\\angle B$ are vertical angles where two lines cross, so they are equal.",
             "The three angles at $A$ make a straight line, so they add to 180°, so $\\angle 1$ equals $\\angle B$.",
             "$\\angle 1$ and $\\angle B$ look the same size in the figure, so they must be equal.",
             "The three angles at $A$ add to 180°, so the top edge must be a straight line.",
             "The three copies are congruent to each other, so the top edge must be straight.",
             "Each copy turned exactly 180°, so its edges keep going in a straight line.",
             "The sides of every triangle are straight, so the top edge must be straight too."}
    require(all(o["label"] in known for o in public["response"]["options"]), "Known arguments only")
    return choice_key(public, label)


def image_of(angle, motion):
    """Apply a motion (a function of points) to an angle's corner and rays."""
    v = angle.vertex
    tips = [(v[0] + math.cos(math.radians(d)), v[1] + math.sin(math.radians(d))) for d in angle.rays]
    w = motion(v)
    return Angle(w, *(direction(w, motion(t)) for t in tips))


def lands_on(x, y):
    return close(x.vertex, y.vertex) and abs(x.sweep - y.sweep) < TOL and same_dir(x.start, y.start)


def crossings(fig):
    t = fig.line("t")
    return intersect(t, fig.line("p")), intersect(t, fig.line("q"))


def translation_choice(public):
    fig = Figure(public)
    m = re.search(r"Which argument shows that \$\\angle (\d) = \\angle (\d)\$\?$", public["prompt"])
    require(m is not None, "Prompt")
    a, b = m.group(1), m.group(2)
    x, y = fig.angle(a), fig.angle(b)
    P, Q = crossings(fig)
    start, end = (P, Q) if close(x.vertex, P) else (Q, P)
    slide = lambda p: (p[0] + end[0] - start[0], p[1] + end[1] - start[1])
    require(lands_on(image_of(x, slide), y), "The slide along t carries one angle onto the other")
    gap = end[1] - start[1]
    straight_down = lambda p: (p[0], p[1] + gap)
    require(not lands_on(image_of(x, straight_down), y), "A vertical slide misses")
    half = lambda p: (2 * start[0] - p[0], 2 * start[1] - p[1])
    require(not lands_on(image_of(x, half), y), "A half-turn about the crossing misses")
    require(not vertical(x, y), "Not vertical angles")
    f, to = ("p", "q") if close(start, P) else ("q", "p")
    label = f"Slide along $t$ to the other crossing: ${f}$ stays parallel, so it lands on ${to}$, and $\\angle {a}$ lands on $\\angle {b}$."
    known = {label,
             f"Any two lines crossed by transversal $t$ make the same angles with it, so $\\angle {a} = \\angle {b}$.",
             f"Slide ${f}$ straight {'down' if f == 'p' else 'up'} onto ${to}$; parallel lines match, so $\\angle {a}$ and $\\angle {b}$ match.",
             f"$\\angle {a}$ and $\\angle {b}$ are vertical angles, and vertical angles are always equal.",
             f"Turn the figure 180° about the crossing on ${f}$; that carries $\\angle {a}$ onto $\\angle {b}$."}
    require(all(o["label"] in known for o in public["response"]["options"]), "Known arguments only")
    return choice_key(public, label)


def half_turn_choice(public):
    fig = Figure(public)
    m = re.search(r"Which motion of the whole figure takes \$\\angle (\d)\$ onto \$\\angle (\d)\$", public["prompt"])
    require(m is not None, "Prompt")
    x, y = fig.angle(m.group(1)), fig.angle(m.group(2))
    P, Q = crossings(fig)
    M = ((P[0] + Q[0]) / 2, (P[1] + Q[1]) / 2)
    t = fig.line("t")
    def reflect_t(p):
        (x0, y0), d = t
        ux, uy = math.cos(math.radians(d)), math.sin(math.radians(d))
        s = (p[0] - x0) * ux + (p[1] - y0) * uy
        fx, fy = x0 + s * ux, y0 + s * uy
        return (2 * fx - p[0], 2 * fy - p[1])
    motions = {
        "A half-turn about the midpoint of $t$ between the crossings, so $t$ lands on itself and $p$ on $q$":
            lambda p: (2 * M[0] - p[0], 2 * M[1] - p[1]),
        "A slide along $t$ from one crossing to the other, so $t$ lands on itself":
            (lambda p: (p[0] + Q[0] - P[0], p[1] + Q[1] - P[1])) if close(x.vertex, P)
            else (lambda p: (p[0] + P[0] - Q[0], p[1] + P[1] - Q[1])),
        "A reflection across line $t$, so $t$ stays in place and each angle flips over": reflect_t,
        "A reflection across the line halfway between $p$ and $q$, so $p$ and $q$ swap": lambda p: (p[0], P[1] + Q[1] - p[1]),
    }
    hits = []
    for o in public["response"]["options"]:
        require(o["label"] in motions, f"Unknown motion {o['label']!r}")
        if lands_on(image_of(x, motions[o["label"]]), y):
            hits.append(o["id"])
    require(len(hits) == 1, "Exactly one motion lands the angle")
    return hits[0]


def hypothesis_choice(public):
    fig = Figure(public)
    m = re.search(r'A student says: "\$\\angle (\d) = \\angle (\d)\$ because corresponding angles are equal\." What is wrong\?$',
                  public["prompt"])
    require(m is not None, "Prompt")
    a, b = m.group(1), m.group(2)
    p, q = fig.line("p"), fig.line("q")
    require(not parallel_dir(p[1], q[1]), "p and q are not parallel")
    require(not fig.marks, "No parallel marks")
    x, y = fig.angle(a), fig.angle(b)
    shown = {k: fig.by_id[f"m-{k}"]["text"] for k in (a, b)}
    for k, ang in ((a, x), (b, y)):
        require(shown[k] == f"{round(ang.sweep)}°" and abs(ang.sweep - round(ang.sweep)) < TOL, f"Measure of angle {k}")
    require(shown[a] != shown[b], "The measures differ")
    # Same relative position: the slide from one crossing to the other keeps
    # the transversal ray; the other ray points the same way up to the tilt.
    P, Q = crossings(fig)
    tdir = fig.line("t")[1]
    tx = [d for d in x.rays if parallel_dir(d, tdir)]
    ty = [d for d in y.rays if parallel_dir(d, tdir)]
    require(len(tx) == 1 and len(ty) == 1 and same_dir(tx[0], ty[0]), "Corresponding position")
    label = "Corresponding angles are equal only for parallel lines. Nothing says $p \\parallel q$, and the measures differ."
    known = {label, "Nothing is wrong: corresponding angles are always equal, whatever the lines.",
             f"$\\angle {a}$ and $\\angle {b}$ are alternate interior angles, not corresponding angles.",
             "Line $t$ would have to be perpendicular to $p$ and $q$ for the angles to match.",
             "The angles are really equal, and the figure is just drawn a little badly."}
    require(all(o["label"] in known for o in public["response"]["options"]), "Known arguments only")
    return choice_key(public, label)


# ------------------------------------------------------------ similarity

GIVEN = re.compile(r"In \$\\triangle ABC\$, \$\\angle ([ABC]) = (\d+)\^\\circ\$ and \$\\angle ([ABC]) = (\d+)\^\\circ\$\. "
                   r"In \$\\triangle DEF\$, \$\\angle ([DEF]) = (\d+)\^\\circ\$ and \$\\angle ([DEF]) = (\d+)\^\\circ\$\. ")


def triangles_of(public):
    m = GIVEN.match(public["prompt"])
    require(m is not None, "Given angles")
    g = m.groups()
    abc = {g[0]: int(g[1]), g[2]: int(g[3])}
    def_ = {g[4]: int(g[5]), g[6]: int(g[7])}
    for given, names in ((abc, "ABC"), (def_, "DEF")):
        require(len(given) == 2, "Two different angles")
        missing = next(n for n in names if n not in given)
        given[missing] = 180 - sum(given.values())
        require(all(25 <= v <= 110 for v in given.values()), "Angles in range")
    fig = Figure(public)
    for given in (abc, def_):
        for name, value in given.items():
            arc = fig.arc_angle(name)
            require(abs(arc.sweep - value) < 0.5, f"Drawn angle {name} is {value}°")
    return abc, def_


def fmt_list(values):
    return ", ".join(f"{v}°" for v in values[:-1]) + f" and {values[-1]}°"


def aa_decide(public):
    abc, def_ = triangles_of(public)
    similar = sorted(abc.values()) == sorted(def_.values())
    shown_abc = re.findall(r"\\angle ([ABC]) = ", public["prompt"])
    shown_def = re.findall(r"\\angle ([DEF]) = ", public["prompt"])
    ti = next(n for n in "ABC" if n not in shown_abc)
    tj = next(n for n in "DEF" if n not in shown_def)
    good = []
    for o in public["response"]["options"]:
        label = o["label"]
        m = re.fullmatch(r"Yes\. The third angles are (\d+)° and (\d+)°, so all three angles match, "
                         r"which makes the triangles similar\.", label)
        if m:
            if similar and int(m.group(1)) == abc[ti] and int(m.group(2)) == def_[tj]:
                good.append(o["id"])
            continue
        m = re.fullmatch(r"No\. The angles are (\d+)°, (\d+)°, (\d+)° and (\d+)°, (\d+)°, (\d+)°, "
                         r"which do not all match, so they are not similar\.", label)
        if m:
            values = [int(v) for v in m.groups()]
            if not similar and values[:3] == [abc[k] for k in "ABC"] and values[3:] == [def_[k] for k in "DEF"]:
                good.append(o["id"])
            continue
        require(re.match(r"(Yes|No)\. |We cannot tell", label), f"Unknown argument {label!r}")
        require(re.search(r"one pair of equal angles is enough for similar|given angles .* do not match .*, so the shapes differ|"
                          r"different sizes, so they cannot be similar|Both triangles have an? \d+° angle, so they must be similar|"
                          r"the third angles always match too|because it is the bigger one|without knowing the side lengths",
                          label), f"Unknown argument {label!r}")
    require(len(good) == 1, "Exactly one complete argument")
    return good[0]


def aa_flaw(public):
    abc, def_ = triangles_of(public)
    similar = sorted(abc.values()) == sorted(def_.values())
    s1, s2, s3 = steps_of(public["prompt"])
    m = re.fullmatch(r"By the angle sum, \$\\angle ([ABC]) = 180\^\\circ - (\d+)\^\\circ - (\d+)\^\\circ = (\d+)\^\\circ\$ "
                     r"and \$\\angle ([DEF]) = 180\^\\circ - (\d+)\^\\circ - (\d+)\^\\circ = (\d+)\^\\circ\$\.", s1)
    require(m is not None, "Step 1")
    v1 = True
    for name, x, y, z, tri in ((m.group(1), m.group(2), m.group(3), m.group(4), abc),
                               (m.group(5), m.group(6), m.group(7), m.group(8), def_)):
        others = sorted(v for k, v in tri.items() if k != name)
        v1 = v1 and sorted([int(x), int(y)]) == others and 180 - int(x) - int(y) == int(z) == tri[name]
    m2 = re.fullmatch(r"So \$\\angle A = \\angle ([DEF])\$, \$\\angle B = \\angle ([DEF])\$ and \$\\angle C = \\angle ([DEF])\$: "
                      r"all three pairs of angles match\.", s2)
    if m2:
        pairing = dict(zip("ABC", m2.groups()))
        v2 = len(set(pairing.values())) == 3 and all(abc[k] == def_[v] for k, v in pairing.items())
    elif re.fullmatch(r"\$\\angle [ABC] = \\angle [DEF] = \d+\^\\circ\$, so one pair of angles matches, and that is enough\.", s2):
        v2, pairing = False, None
    elif re.search(r"is about the same as", s2):
        v2, pairing = False, None
    else:
        m3 = re.fullmatch(r"\$\\triangle ABC\$ has angles (\d+)°, (\d+)° and (\d+)°, but \$\\triangle DEF\$ has "
                          r"(\d+)°, (\d+)° and (\d+)°, so they do not all match\.", s2)
        require(m3 is not None, "Step 2")
        values = [int(v) for v in m3.groups()]
        v2 = values[:3] == [abc[k] for k in "ABC"] and values[3:] == [def_[k] for k in "DEF"] and not similar
        pairing = None
    sim = re.fullmatch(r"Three pairs of equal angles make the triangles similar: \$\\triangle ABC \\sim \\triangle ([DEF]{3})\$\.", s3)
    if sim:
        order = sim.group(1)
        v3 = len(set(order)) == 3 and all(abc[k] == def_[v] for k, v in zip("ABC", order))
    elif re.fullmatch(r"Three pairs of equal angles make the triangles congruent: \$\\triangle ABC \\cong \\triangle [DEF]{3}\$\.", s3):
        v3 = False  # equal angles fix the shape, never the size
    elif s3 == "But the sides are different lengths, so the triangles are not similar.":
        v3 = False
    elif s3 == "Three pairs of equal angles make the triangles similar.":
        v3 = similar
    else:
        require(s3 == "Dilations and rigid motions keep every angle, so no sequence of them maps one onto the other: "
                      "the triangles are not similar.", "Step 3")
        v3 = not similar
    return flaw_key(public, first_wrong([v1, v2, v3]))


def aa_select(public):
    m = re.match(r"\$\\triangle ABC\$ has \$\\angle A = (\d+)\^\\circ\$ and \$\\angle B = (\d+)\^\\circ\$\. ", public["prompt"])
    require(m is not None, "Prompt")
    a, b = int(m.group(1)), int(m.group(2))
    angles = sorted([a, b, 180 - a - b])
    response = public["response"]
    require(response["kind"] == "multi-select" and len(response["options"]) == 5, "Five triangles")
    good = []
    for o in response["options"]:
        mm = re.fullmatch(r"A triangle with angles of (\d+)° and (\d+)°", o["label"])
        require(mm is not None, f"Option {o['label']!r}")
        x, y = int(mm.group(1)), int(mm.group(2))
        require(x + y < 180, "A real triangle")
        if sorted([x, y, 180 - x - y]) == angles:
            good.append(o["id"])
    require(len(good) == response["selectionCount"] and 2 <= len(good) <= 3, "Selection count")
    return json.dumps(sorted(good), separators=(",", ":"))


# ---------------------------------------------------------------- dispatch

def solve(public):
    template = public["templateId"]
    require(template in SUPPORTED, "Wrong family")
    prompt = public["prompt"]
    if template in ("triangle-angle-reasons", "parallel-angle-reasons"):
        return solve_reason_parts(public)
    if template == "triangle-angle-argument":
        require(public["response"]["kind"] == "choice", "Choice")
        if prompt.startswith("A student argues that the angles of triangle"):
            return sum_flaw(public)
        if prompt.startswith("A student argues that the exterior angle"):
            return exterior_flaw(public)
        return copies_choice(public)
    if template == "parallel-angle-argument":
        require(public["response"]["kind"] == "choice", "Choice")
        if "A student argues that" in prompt:
            return parallel_flaw(public)
        if "Which argument shows that" in prompt:
            return translation_choice(public)
        if "Which motion of the whole figure" in prompt:
            return half_turn_choice(public)
        return hypothesis_choice(public)
    if template == "aa-similarity-argument":
        require(public["response"]["kind"] == "choice", "Choice")
        return aa_flaw(public) if "In which step" in prompt else aa_decide(public)
    return aa_select(public)


def review_problem(problem):
    public = problem["public"]
    require(public["templateId"] in SUPPORTED, "Wrong family")
    expected = solve(public)
    require(problem["answer"] == expected, f"Answer {problem['answer']} disagrees with the figure; expected {expected}")
    texts = [public["prompt"], problem["hint"], *problem["explanation"]]
    for text in texts:
        require(not PLACEHOLDER.search(text), f"Unrendered placeholder in {text!r}")
    response = public["response"]
    if response["kind"] == "choice":
        labels = [o["label"] for o in response["options"]]
        require(len(set(labels)) == len(labels) and all(len(l) <= 120 for l in labels), "Distinct short options")
        feedback = problem.get("choiceFeedback", {})
        require(set(feedback) == {o["id"] for o in response["options"]} - {expected}, "Feedback for every distractor")
        last = problem["explanation"][-1]
        if labels == FLAW_OPTIONS:
            chosen = next(o["label"] for o in response["options"] if o["id"] == expected)
            require(last == ("Every step is correct, so the answer is No step is wrong." if chosen == FLAW_OPTIONS[3]
                             else f"The first wrong step is step {chosen[-1]}."), "Explanation ends on the key")
    return expected


# ---------------------------------------------------------------- self test

def _fixture_parallel(n_pair, flaw_text=None):
    """Parallel lines p (y=3) and q (y=0), t at 60 degrees through the origin."""
    P = (3 / math.tan(math.radians(60)), 3.0)
    Q = (0.0, 0.0)
    u = (math.cos(math.radians(60)), math.sin(math.radians(60)))
    elements = [
        {"type": "segment", "id": "l-p", "from": [-4, 3], "to": [6, 3]},
        {"type": "segment", "id": "l-q", "from": [-4, 0], "to": [6, 0]},
        {"type": "segment", "id": "l-t", "from": [-u[0] * 1.7, -u[1] * 1.7], "to": [P[0] + u[0] * 1.7, P[1] + u[1] * 1.7]},
        {"type": "polyline", "id": "pm-p", "points": [[-3, 3.2], [-2.8, 3], [-3, 2.8]]},
        {"type": "polyline", "id": "pm-q", "points": [[-3, 0.2], [-2.8, 0], [-3, -0.2]]},
    ]
    # Label inside each region, clockwise from upper left: 1-4 at p, 5-8 at q.
    for n in range(1, 9):
        c = P if n <= 4 else Q
        region = (n - 1) % 4
        bis = {0: 120, 1: 30, 2: 300, 3: 210}[region]
        elements.append({"type": "text", "id": f"n-{n}", "text": str(n),
                         "at": [c[0] + math.cos(math.radians(bis)), c[1] + math.sin(math.radians(bis))]})
    return {"kind": "scene", "scene": {"v": 1, "elements": elements}}


def self_test():
    # Reason truth table on a fixed figure.
    fig = Figure({"figure": _fixture_parallel(None)})
    co, ai, vert = ("CO", "t"), ("AI", "t"), ("VERT", None)
    assert valid_reason(fig, ("eq", ["1", "5"]), co)
    assert valid_reason(fig, ("eq", ["4", "8"]), co)
    assert not valid_reason(fig, ("eq", ["1", "5"]), ai)
    assert valid_reason(fig, ("eq", ["3", "5"]), ai) and valid_reason(fig, ("eq", ["4", "6"]), ai)
    assert not valid_reason(fig, ("eq", ["1", "7"]), ai)  # alternate exterior
    assert valid_reason(fig, ("eq", ["1", "3"]), vert) and not valid_reason(fig, ("eq", ["1", "2"]), vert)
    assert valid_reason(fig, ("sum", ["4", "5"]), ("SSI", None)) and valid_reason(fig, ("sum", ["3", "6"]), ("SSI", None))
    assert not valid_reason(fig, ("sum", ["3", "5"]), ("SSI", None))
    assert valid_reason(fig, ("sum", ["8", "5"]), ("LP", "t")) and valid_reason(fig, ("sum", ["5", "6"]), ("LP", "q"))
    assert not valid_reason(fig, ("sum", ["8", "5"]), ("LP", "q"))
    for bad in (("LOOK", None), ("MEAS", None), ("ALLEQ", None), ("TRI", None), ("AROUND", None)):
        assert not valid_reason(fig, ("eq", ["1", "5"]), bad)
    # A full parallel flaw item and its mutations.
    steps = ("Step 1: $\\angle 4 = \\angle 8$ because they are corresponding angles along transversal $t$. "
             "Step 2: $\\angle 8 = \\angle 6$ because they are vertical angles, opposite each other at a crossing. "
             "Step 3: So $\\angle 4 = \\angle 6$.")
    public = {"templateId": "parallel-angle-argument", "seed": "f", "figure": _fixture_parallel(None),
              "prompt": "Lines $p$ and $q$ are parallel, and line $t$ crosses both. A student argues that $\\angle 4 = \\angle 6$. "
                        + steps + " In which step does the argument first go wrong?",
              "response": {"kind": "choice", "label": "Choose one answer",
                           "options": [{"id": f"option-{c}", "label": l} for c, l in zip("abcd", FLAW_OPTIONS)]}}
    problem = {"public": public, "answer": "option-d", "hint": "Find angle 4.",
               "explanation": ["Check.", "Every step is correct, so the answer is No step is wrong."],
               "choiceFeedback": {"option-a": "x", "option-b": "x", "option-c": "x"}}
    assert review_problem(problem) == "option-d"
    mutations = 0
    for change, what in (
            (lambda p: p.update(answer="option-b"), "wrong key"),
            (lambda p: p["public"].update(prompt=p["public"]["prompt"].replace("they are vertical angles, opposite each other at a crossing",
                                                                                "they are corresponding angles along transversal $t$")), "wrong reason accepted"),
            (lambda p: p["public"].update(prompt=p["public"]["prompt"].replace("So $\\angle 4 = \\angle 6$.",
                                                                                "So $\\angle 4 = \\angle 6$, because they are alternate interior angles along transversal $t$.")), "circular step accepted"),
            (lambda p: p["public"]["figure"]["scene"]["elements"].__delitem__(3), "parallel mark removed"),
            (lambda p: p["explanation"].__setitem__(-1, "The first wrong step is step 2."), "explanation disagrees")):
        bad = copy.deepcopy(problem)
        change(bad)
        try:
            review_problem(bad)
        except (ValueError, KeyError, TypeError, IndexError, StopIteration):
            mutations += 1
        else:
            raise AssertionError(f"Accepted corrupt angle-argument case: {what}")
    # Similarity selection.
    sel = {"public": {"templateId": "aa-similarity-select", "seed": "f",
                      "prompt": "$\\triangle ABC$ has $\\angle A = 40^\\circ$ and $\\angle B = 75^\\circ$. Each choice gives two angles of another triangle. Select every triangle that must be similar to $\\triangle ABC$.",
                      "response": {"kind": "multi-select", "label": "Choose 2 triangles", "selectionCount": 2,
                                   "options": [{"id": f"option-{c}", "label": f"A triangle with angles of {x}° and {y}°"}
                                               for c, (x, y) in zip("abcde", [(65, 40), (40, 80), (75, 65), (52, 75), (40, 60)])]}},
           "answer": '["option-a","option-c"]', "hint": "Find the third angle.", "explanation": ["65."]}
    assert review_problem(sel) == sel["answer"]
    bad = copy.deepcopy(sel)
    bad["answer"] = '["option-a","option-b"]'
    try:
        review_problem(bad)
    except ValueError:
        mutations += 1
    else:
        raise AssertionError("Accepted a wrong similarity selection")
    return {"fixtures": 2, "mutations": mutations}


if __name__ == "__main__":
    print(self_test())
