"""Independent oracle for rigid-motion-definition (HSG.CO.A.4).

Templates: rigid-motion-definition-select, rigid-motion-definition-check,
rigid-motion-definition-slots.

Only the public payload is read: the prompt, the options or blanks and the
figure's coordinates. The answer, explanation, hint, feedback and variant are
values under test.

* A definition is judged by what it pins down. Every wording an option, a
  blank, Dana's statement or a named-motion statement can use is translated
  here into a locus (circle, line, ray, point) or an open filter (a side of a
  line). The set of points a statement allows for P is computed exactly
  (intersections of the loci, then the filters), and the statement defines the
  motion only when, for the figure's P and for several other test points, that
  set is exactly the one true image. The true image comes from the motion's
  own parameters read from the figure and prompt (center and signed angle,
  mirror line, vector AB).
* check: the two conditions of the definition are recomputed from the
  coordinates in the prompt (perpendicularity and midpoint for a reflection;
  equal radius and a signed quarter, half or three-quarter turn for a rotation;
  a positive multiple and equal length for a translation), and the verdict
  follows from both.
* name: the motion named by the definition in the prompt is computed as a map
  on test points and compared with each option's motion; an option naming a
  family ("a rotation about a point of m") is tested at the one member that
  could match the figure's P.
"""

import itertools
import json
import math
import re

SUPPORTED = frozenset({
    "rigid-motion-definition-select",
    "rigid-motion-definition-check",
    "rigid-motion-definition-slots",
})
REVIEW_RETURNS_ANSWER = True
CHOICE_REVIEW = frozenset({"rigid-motion-definition-select"})
STATS = {"cases": 0, "statements": 0, "samples": 0}
EPS = 1e-6


def require(condition, message):
    # Not assert: python -O must not disable review gates.
    if not condition:
        raise ValueError(message)


# ---------------------------------------------------------------- vectors

def add(a, b):
    return (a[0] + b[0], a[1] + b[1])


def sub(a, b):
    return (a[0] - b[0], a[1] - b[1])


def mul(a, k):
    return (a[0] * k, a[1] * k)


def dot(a, b):
    return a[0] * b[0] + a[1] * b[1]


def cross(a, b):
    return a[0] * b[1] - a[1] * b[0]


def norm(a):
    return math.hypot(a[0], a[1])


def unit(a):
    n = norm(a)
    require(n > 1e-12, "zero vector")
    return (a[0] / n, a[1] / n)


def rot(v, deg):
    t = math.radians(deg)
    c, s = math.cos(t), math.sin(t)
    return (v[0] * c - v[1] * s, v[0] * s + v[1] * c)


def rotate_about(p, c, deg):
    return add(c, rot(sub(p, c), deg))


def close(a, b, tol=EPS):
    return norm(sub(a, b)) < tol * max(1.0, norm(a), norm(b))


def foot(p, a, u):
    w = unit(u)
    return add(a, mul(w, dot(sub(p, a), w)))


def reflect(p, a, u):
    f = foot(p, a, u)
    return sub(mul(f, 2), p)


def signed_turn(v, w):
    """Counterclockwise angle in degrees from v to w, in (-180, 180]."""
    return math.degrees(math.atan2(cross(v, w), dot(v, w)))


# ---------------------------------------------------------------- loci

class Circle:
    def __init__(self, c, r):
        self.c, self.r = c, r

    def has(self, x):
        return abs(norm(sub(x, self.c)) - self.r) < EPS * max(1.0, self.r)

    def samples(self):
        return [add(self.c, (self.r * math.cos(2 * math.pi * i / 360), self.r * math.sin(2 * math.pi * i / 360))) for i in range(360)]


class Line:
    def __init__(self, p, d):
        self.p, self.d = p, unit(d)

    def has(self, x):
        return abs(cross(self.d, sub(x, self.p))) < EPS * max(1.0, norm(sub(x, self.p)))

    def samples(self):
        return [add(self.p, mul(self.d, t / 4)) for t in range(-200, 201)]


class Ray(Line):
    """The open ray from p in direction d (p itself excluded)."""

    def has(self, x):
        return Line.has(self, x) and dot(sub(x, self.p), self.d) > EPS

    def samples(self):
        return [add(self.p, mul(self.d, t / 4)) for t in range(1, 201)]


class Point:
    def __init__(self, p):
        self.p = p

    def has(self, x):
        return close(x, self.p)


def meet(a, b):
    """Finite intersection of two curves, or None when they coincide."""
    if isinstance(a, Point):
        return [a.p] if b.has(a.p) else []
    if isinstance(b, Point):
        return [b.p] if a.has(b.p) else []
    if isinstance(a, Line) and isinstance(b, Line):
        den = cross(a.d, b.d)
        if abs(den) < 1e-12:
            return None if a.has(b.p) or b.has(a.p) else []
        t = cross(sub(b.p, a.p), b.d) / den
        x = add(a.p, mul(a.d, t))
        return [x] if a.has(x) and b.has(x) else []
    if isinstance(a, Circle) and isinstance(b, Circle):
        d = norm(sub(b.c, a.c))
        if d < 1e-12:
            return None if abs(a.r - b.r) < 1e-12 else []
        if d > a.r + b.r + 1e-12 or d < abs(a.r - b.r) - 1e-12:
            return []
        x = (d * d + a.r * a.r - b.r * b.r) / (2 * d)
        h = math.sqrt(max(0.0, a.r * a.r - x * x))
        u = unit(sub(b.c, a.c))
        base = add(a.c, mul(u, x))
        n = (-u[1], u[0])
        pts = [add(base, mul(n, h)), add(base, mul(n, -h))]
        return dedupe(pts)
    line, circle = (a, b) if isinstance(a, Line) else (b, a)
    f = add(line.p, mul(line.d, dot(sub(circle.c, line.p), line.d)))
    dist = norm(sub(circle.c, f))
    if dist > circle.r + 1e-12:
        return []
    h = math.sqrt(max(0.0, circle.r * circle.r - dist * dist))
    pts = [p for p in dedupe([add(f, mul(line.d, h)), add(f, mul(line.d, -h))]) if line.has(p)]
    return pts


def dedupe(pts):
    out = []
    for p in pts:
        if not any(close(p, q) for q in out):
            out.append(p)
    return out


INFINITE = "infinite"


def solve_set(conditions):
    """conditions: list of ('locus', [alternatives]) / ('filter', fn) /
    ('empty',). Returns INFINITE or a list of points."""
    if any(c[0] == "empty" for c in conditions):
        return []
    loci = [c[1] for c in conditions if c[0] == "locus"]
    filters = [c[1] for c in conditions if c[0] == "filter"]
    results = []
    for branch in itertools.product(*loci) if loci else [()]:
        branch = list(branch)
        if not branch:
            return INFINITE
        points = [b for b in branch if isinstance(b, Point)]
        curves = [b for b in branch if not isinstance(b, Point)]
        candidates = None
        if points:
            candidates = [points[0].p]
        else:
            base = curves[0]
            for other in curves[1:]:
                found = meet(base, other)
                if found is not None:
                    candidates = found
                    break
        if candidates is None:
            # One curve (or several that coincide): infinitely many points
            # unless the filters leave at most one of its samples.
            keep = [x for x in curves[0].samples() if all(c.has(x) for c in branch) and all(f(x) for f in filters)]
            if len(keep) >= 2:
                return INFINITE
            candidates = []
        for x in candidates:
            if all(c.has(x) for c in branch) and all(f(x) for f in filters):
                results.append(x)
    return dedupe(results)


def side(a, u, x):
    return cross(unit(u), sub(x, a))


# ---------------------------------------------------------------- the motion

class Motion:
    """kind 'rotation' (C, signed degrees), 'reflection' (a, u),
    'translation' (A, B)."""

    def __init__(self, kind, **k):
        self.kind = kind
        self.__dict__.update(k)

    def image(self, p):
        if self.kind == "rotation":
            return rotate_about(p, self.C, self.theta)
        if self.kind == "reflection":
            return reflect(p, self.a, self.u)
        return add(p, sub(self.B, self.A))

    def tests(self, P):
        """The figure's P and further points off the center or line."""
        out = [P]
        for q in [(3.3, -1.7), (-2.6, 4.1), (5.2, 2.9), (-4.4, -3.8)]:
            if self.kind == "rotation" and norm(sub(q, self.C)) < 0.5:
                continue
            if self.kind == "reflection" and abs(side(self.a, self.u, q)) < 0.5:
                continue
            out.append(q)
        return out


# ---------------------------------------------------------------- reading

def strip(text):
    return text.replace("$", "").strip().rstrip(".")


NUM = r"-?\d+(?:\.\d+)?"


def deg_of(text):
    m = re.search(r"(\d+)\^\\circ", text)
    return int(m.group(1)) if m else None


def conditions_of(phrase, ctx):
    """One phrase of a definition, for the point P of ctx, as conditions.
    Raises on any wording not covered here."""
    s = strip(phrase)
    P = ctx["P"]
    C, a, u, A, B = ctx.get("C"), ctx.get("a"), ctx.get("u"), ctx.get("A"), ctx.get("B")
    out = []

    def locus(*alts):
        out.append(("locus", list(alts)))

    def flt(fn):
        out.append(("filter", fn))

    rules = [
        # rotation vocabulary
        (r"C is the midpoint of \\overline\{PP'\}", lambda m: locus(Point(sub(mul(C, 2), P)))),
        (r"CP'=CP", lambda m: locus(Circle(C, norm(sub(P, C))))),
        (r"on the circle with center C through P", lambda m: locus(Circle(C, norm(sub(P, C))))),
        (r"m\\angle PCP'=(\d+)\^\\circ,? counterclockwise from ray CP", lambda m: locus(Ray(C, rot(sub(P, C), int(m.group(1)))))),
        (r"m\\angle PCP'=(\d+)\^\\circ clockwise from ray CP", lambda m: locus(Ray(C, rot(sub(P, C), -int(m.group(1)))))),
        # The angle is measured from ray CP whether or not the ray is named.
        (r"m\\angle PCP' must be (\d+)\^\\circ, (?:measured )?counterclockwise(?: from ray CP)?", lambda m: locus(Ray(C, rot(sub(P, C), int(m.group(1)))))),
        (r"moves (\d+) units counterclockwise along the circle with center C through P", lambda m: locus(Point(rotate_about(P, C, math.degrees(int(m.group(1)) / norm(sub(P, C))))))),
        (r"P' must be on line CP, on the (?:other side of C|(?:opposite|far) side of C from P)", lambda m: locus(Ray(C, sub(C, P)))),
        # Segments CP and CP' always share the endpoint C, so "meeting it at
        # the center C" adds nothing.
        (r"\\overline\{CP'\} must be perpendicular to \\overline\{CP\}(?:, meeting it at the center C)?", lambda m: locus(Line(C, rot(sub(P, C), 90)))),
        (r"on ray CP with CP'=(\d+)\\,CP", lambda m: (locus(Ray(C, sub(P, C))), locus(Circle(C, int(m.group(1)) * norm(sub(P, C)))))),
        # A condition on the whole map, not on one point: judged in defines().
        (r"(?:\\overline\{PP'\}|PP') must be the same (?:length )?for every point P(?: of the plane)?", lambda m: out.append(("global", "uniform-length"))),
        # reflection vocabulary
        (r"m (?:is|as) the perpendicular bisector of \\overline\{PP'\}", lambda m: locus(Point(reflect(P, a, u)))),
        (r"as far from m as P is, on the other side of m", lambda m: locus(Line(reflect(P, a, u), u))),
        (r"the same distance from m as P, on the other side", lambda m: locus(Line(reflect(P, a, u), u))),
        (r"\\overline\{PP'\} (?:is|must be) perpendicular to (?:line )?m", lambda m: locus(Line(P, rot(u, 90)))),
        # "Crossing it": the segment meets m, so P' is not on P's side.
        (r", crossing it at a right angle", lambda m: flt(lambda x: side(a, u, x) * side(a, u, P) < EPS)),
        (r"with the midpoint of \\overline\{PP'\} on line m", lambda m: locus(Line(sub(mul(a, 2), P), u))),
        (r"P' must be on the other side of m(?: from P)?(?:, so that m runs between P and P')?", lambda m: flt(lambda x: side(a, u, x) * side(a, u, P) < -EPS)),
        (r"\\overline\{PP'\} must be parallel to m", lambda m: locus(Line(P, u))),
        # "Never crossing the line": P' stays strictly on P's side of m.
        (r", never crossing the line", lambda m: flt(lambda x: side(a, u, x) * side(a, u, P) > EPS)),
        (r"P' must be as far from the marked point X of m as P is|XP' must equal XP for the marked point X of m", lambda m: locus(Circle(ctx["X"], norm(sub(P, ctx["X"]))))),
        (r"goes to the point \(x,-y\), its mirror image across the x-axis", lambda m: locus(Point((P[0], -P[1])))),
        # translation vocabulary
        (r"\\overline\{PP'\} (?:is |must be )?parallel to \(or on\) line AB", lambda m: locus(Line(P, sub(B, A)))),
        (r"the same way as (?:from )?A to B|P' is the same way from P as B is from A", lambda m: flt(lambda x: dot(sub(x, P), sub(B, A)) > EPS)),
        # The "so ..." clauses restate the condition before them.
        (r"PP'=AB(?:, so every point moves exactly the same distance as from A to B)?", lambda m: locus(Circle(P, norm(sub(B, A))))),
        (r"the same distance from A as P is from B", lambda m: locus(Circle(A, norm(sub(P, B))))),
        (r"on ray AB with AP'=AB(?:, so every point lands where B is)?", lambda m: locus(Point(B))),
        (r"P' must be (?:the same distance from A as P is|as far from A as P is)", lambda m: locus(Circle(A, norm(sub(P, A))))),
        # "At a right angle to the direction from A to B" restates it.
        (r"\\overline\{PP'\} must be perpendicular to line AB(?:, at a right angle to the direction from A to B)?|\\overrightarrow\{PP'\} must be at a right angle to \\overrightarrow\{AB\}", lambda m: locus(Line(P, rot(sub(B, A), 90)))),
        # Pointing the same way as AB: P' on the open ray from P along AB.
        (r"\\overrightarrow\{PP'\} must point the same way as \\overrightarrow\{AB\}", lambda m: locus(Ray(P, sub(B, A)))),
        (r"P' must be on (?:line AB(?:, the line through A and B)?|the line through A and B)", lambda m: locus(Line(A, sub(B, A)))),
    ]
    matched = False
    covered = [False] * len(s)
    for pattern, action in rules:
        for m in re.finditer(pattern, s):
            matched = True
            action(m)
            covered[m.start():m.end()] = [True] * (m.end() - m.start())
    require(matched, f"Unread definition wording: {phrase!r}")
    # Every word must be read: an unread clause could change the meaning.
    rest = "".join(ch if not c else " " for ch, c in zip(s, covered))
    rest = re.sub(r"\b(?:with|and|for which|that is|such that)\b|[,;]", " ", rest).strip()
    require(rest == "", f"Unread definition wording {rest!r} in {phrase!r}")
    return out


def satisfies(conditions, x):
    """Does the point x meet every condition?"""
    for c in conditions:
        if c[0] == "empty":
            return False
        if c[0] == "locus" and not any(l.has(x) for l in c[1]):
            return False
        if c[0] == "filter" and not c[1](x):
            return False
    return True


def statement_set(phrases, ctx):
    conds = []
    for ph in phrases:
        conds.extend(conditions_of(ph, ctx))
    if any(c[0] == "global" for c in conds):
        return "global"
    return solve_set(conds)


def defines(phrases, motion, ctx_of, P):
    """True when, at every test point, the statement allows exactly the image."""
    for q in motion.tests(P):
        ctx = ctx_of(q)
        got = statement_set(phrases, ctx)
        STATS["samples"] += 1
        if got == "global":
            # "PP' is the same length for every P": the motion itself breaks
            # it when its PP' lengths differ, so the statement excludes the
            # true image. A motion that keeps PP' constant is not judged here.
            lengths = [norm(sub(motion.image(x), x)) for x in motion.tests(P)]
            require(max(lengths) - min(lengths) > 1e-3, "The motion keeps PP' constant; uniform-length unjudged")
            return False
        if got == INFINITE or len(got) != 1 or not close(got[0], motion.image(q)):
            return False
    return True


# ---------------------------------------------------------------- the figure

def scene_points(figure):
    els = figure["scene"]["elements"]
    pts, segs, labels = {}, [], {}
    by_id = {e.get("id"): e for e in els}
    for e in els:
        if e["type"] == "text" and e.get("id", "").endswith("n"):
            target = by_id.get(e["id"][:-1])
            if target and target["type"] == "point":
                labels[e["text"]] = tuple(target["at"])
    for e in els:
        if e["type"] == "segment":
            segs.append(e)
    return labels, segs, by_id


def plain_context(public):
    """C, line m (a, u), A, B, P, P' and Q, X from a select/slots figure."""
    labels, segs, by_id = scene_points(public["figure"])
    ctx = {"P": labels["P"], "Pimg": labels.get("P′")}
    if "C" in labels:
        ctx["C"] = labels["C"]
    if "Q" in labels:
        ctx["Q"] = labels["Q"]
    if "X" in labels:
        ctx["X"] = labels["X"]
    if "A" in labels and "B" in labels:
        ctx["A"], ctx["B"] = labels["A"], labels["B"]
    m = by_id.get("m")
    if m is not None:
        ctx["a"] = tuple(m["from"])
        ctx["u"] = sub(tuple(m["to"]), tuple(m["from"]))
    return ctx


def motion_from(ctx, prompt):
    if "a" in ctx:
        return Motion("reflection", a=ctx["a"], u=ctx["u"])
    if "A" in ctx:
        return Motion("translation", A=ctx["A"], B=ctx["B"])
    deg = deg_of(prompt)
    require(deg is not None, "A rotation names its angle")
    if "clockwise" in prompt and "counterclockwise" not in prompt:
        deg = -deg
    return Motion("rotation", C=ctx["C"], theta=deg)


# ---------------------------------------------------------------- select

def option_phrases(label):
    """A definition option, split into its conditions."""
    s = strip(label)
    s = re.sub(r"^(?:Points on m stay put|C stays put); ", "", s)
    s = re.sub(r"^(?:any other|Each) (?:point )?P goes to (?:the |a |some )?(?:point )?P' ", "", s)
    s = re.sub(r"^Each point P goes to the point P' ", "", s)
    s = re.sub(r"^any other point P (?=moves )", "", s)
    # The coordinate rule names every point, on m or not; its condition is
    # applied at every test point either way.
    s = re.sub(r"^Every point \(x,y\), on line m or not, (?=goes to the point \(x,-y\))", "", s)
    return [s]


def name_map(statement, ctx_of, P):
    """The map the prompt's definition gives, as a function on test points."""
    def image(q):
        got = statement_set([statement], ctx_of(q))
        require(got not in ("global", INFINITE) and len(got) == 1, f"The definition does not pin down an image: {statement!r}")
        return got[0]
    return image


# A name option is a head (one motion, or a family of motions) plus at most
# one trailing description. Every description is a claim about the named
# map and is checked on that map; a false one is a defect, not a reading.
DESCRIPTIONS = [
    (r", a mirror line", ["mirror"]),
    (r", which keeps every point of that line in place", ["fixes-line"]),
    (r", keeping each point of m in place", ["fixes-line"]),
    (r", which keeps AB in place", ["fixes-line"]),
    (r", which keeps C in place", ["fixes-C"]),
    (r", a half turn that keeps C in place", ["half-turn", "fixes-C"]),
    (r", a half turn about C", ["half-turn", "center-C"]),
    (r", a half turn about A", ["half-turn", "center-A"]),
    (r", a quarter turn", ["quarter-turn"]),
    (r", doubling each distance from C", ["scale-2"]),
    (r", halving each distance from C", ["scale-1/2"]),
    (r", from B toward A", ["toward-A"]),
    (r", moving every point the same distance", ["uniform"]),
    (r", which is not a rigid motion", ["not-rigid"]),
]

# Names that put the description first, rewritten head-first.
LEADS = [
    (r"The half turn about C: the rotation about C by (\d+)\^\\circ", lambda m: f"The rotation about C by {m.group(1)}^\\circ", ["half-turn", "center-C"]),
    (r"The half turn about A, a rotation by (\d+)\^\\circ", lambda m: f"The rotation about A by {m.group(1)}^\\circ", ["half-turn", "center-A"]),
    (r"A half turn, a rotation by (\d+)\^\\circ about a point of m", lambda m: f"A rotation by {m.group(1)}^\\circ about a point of m", ["half-turn"]),
]


def head_map(s, ctx, target):
    """(map, info) for a named motion. For a named family, the map is the one
    member that sends the figure's P where the definition does, or None when
    no member can; info["rep"] is then another member, for descriptions."""
    C, a, u, A, B, P = ctx.get("C"), ctx.get("a"), ctx.get("u"), ctx.get("A"), ctx.get("B"), ctx["P"]
    Q = target(P)
    m = re.fullmatch(r"The rotation about (C|A) by (\d+)\^\\circ( clockwise| counterclockwise)?", s)
    if m:
        Z = C if m.group(1) == "C" else A
        d = int(m.group(2)) * (-1 if m.group(3) == " clockwise" else 1)
        f = lambda q: rotate_about(q, Z, d)  # noqa: E731
        return f, {"kind": "rotation", "center": Z, "rep": f}
    m = re.fullmatch(r"The dilation about C with scale factor (?:(\d+)|\\frac\{(\d+)\}\{(\d+)\})", s)
    if m:
        k = int(m.group(1)) if m.group(1) else int(m.group(2)) / int(m.group(3))
        f = lambda q: add(C, mul(sub(q, C), k))  # noqa: E731
        return f, {"kind": "dilation", "center": C, "rep": f}
    m = re.fullmatch(r"The reflection across line (m|AB)", s)
    if m:
        p, d = (a, u) if m.group(1) == "m" else (A, sub(B, A))
        f = lambda q: reflect(q, p, d)  # noqa: E731
        return f, {"kind": "reflection", "line": (p, d), "rep": f}
    m = re.fullmatch(r"The translation (?:along|by|that moves each point by) \\overrightarrow\{(AB|BA)\}", s)
    if m:
        v = sub(B, A) if m.group(1) == "AB" else sub(A, B)
        f = lambda q: add(q, v)  # noqa: E731
        return f, {"kind": "translation", "rep": f}
    if s == "A reflection across a line through C":
        member = None
        line = (C, (1.0, 0.3))
        if not close(P, Q):
            mid, d = mul(add(P, Q), 0.5), rot(sub(Q, P), 90)
            if abs(cross(unit(d), sub(C, mid))) < EPS:
                line = (mid, d)
                member = lambda q: reflect(q, mid, d)  # noqa: E731
        return member, {"kind": "reflection", "line": line, "rep": member or (lambda q: reflect(q, *line))}
    m = re.fullmatch(r"A rotation by (\d+)\^\\circ about a point of m", s)
    if m:
        deg = int(m.group(1))
        for sgn in (1, -1):
            # Center X on m with the rotation by sgn*deg sending P to Q:
            # Q - X = R(P - X), so (I - R) X = Q - R P.
            t = math.radians(sgn * deg)
            c, sn = math.cos(t), math.sin(t)
            m11, m12, m21, m22 = 1 - c, sn, -sn, 1 - c
            rhs = sub(Q, (P[0] * c - P[1] * sn, P[0] * sn + P[1] * c))
            det = m11 * m22 - m12 * m21
            X = ((rhs[0] * m22 - m12 * rhs[1]) / det, (m11 * rhs[1] - m21 * rhs[0]) / det)
            if abs(side(a, u, X)) < EPS:
                f = lambda q, X=X, d=sgn * deg: rotate_about(q, X, d)  # noqa: E731
                return f, {"kind": "rotation", "center": X, "rep": f}
        return None, {"kind": "rotation", "center": a, "rep": lambda q: rotate_about(q, a, deg)}
    m = re.fullmatch(r"A translation (perpendicular to|across line) m", s)
    if m:
        # Perpendicular: the vector is at a right angle to m. Across: the
        # vector is not along m, so the translation carries points over it.
        v = sub(Q, P)
        if m.group(1) == "perpendicular to":
            fits = abs(dot(unit(v), unit(u))) < EPS if norm(v) > EPS else False
        else:
            fits = abs(cross(unit(u), v)) > EPS
        member = (lambda q: add(q, v)) if fits else None
        return member, {"kind": "translation", "rep": member or (lambda q: add(q, rot(u, 90)))}
    if re.fullmatch(r"A translation, (?:because every point other than C moves|since every point but C moves)", s):
        v = sub(Q, P)
        f = lambda q: add(q, v)  # noqa: E731
        return f, {"kind": "translation", "rep": f}
    raise ValueError(f"Unread motion: {s!r}")


def description_holds(claim, info, ctx, tests):
    """Is the description true of the named map (or family member)?"""
    f = info["rep"]
    C, A, B = ctx.get("C"), ctx.get("A"), ctx.get("B")
    Z = info.get("center")
    if claim == "mirror":
        return info["kind"] == "reflection" and all(close(f(f(q)), q) for q in tests)
    if claim == "fixes-line":
        p, d = info["line"]
        on = [add(p, mul(unit(d), t)) for t in (-3.0, 0.0, 2.5)]
        return info["kind"] == "reflection" and all(close(f(x), x) for x in on)
    if claim == "fixes-C":
        return close(f(C), C)
    if claim == "half-turn":
        return info["kind"] == "rotation" and all(close(f(q), sub(mul(Z, 2), q)) for q in tests)
    if claim in ("center-C", "center-A"):
        return close(Z, C if claim == "center-C" else A)
    if claim == "quarter-turn":
        return info["kind"] == "rotation" and all(
            abs(abs(signed_turn(sub(q, Z), sub(f(q), Z))) - 90) < 1e-6 for q in tests if norm(sub(q, Z)) > 0.1)
    if claim in ("scale-2", "scale-1/2"):
        k = 2 if claim == "scale-2" else 0.5
        return all(abs(norm(sub(f(q), C)) - k * norm(sub(q, C))) < EPS for q in tests)
    if claim == "toward-A":
        v = sub(f(tests[0]), tests[0])
        return (all(close(sub(f(q), q), v) for q in tests) and abs(cross(v, sub(A, B))) < EPS
                and dot(v, sub(A, B)) > EPS)
    if claim == "uniform":
        lengths = [norm(sub(f(q), q)) for q in tests]
        return max(lengths) - min(lengths) < EPS
    if claim == "not-rigid":
        return any(abs(norm(sub(f(x), f(y))) - norm(sub(x, y))) > EPS for x in tests for y in tests)
    raise ValueError(f"Unknown description {claim}")


def named_option(label, ctx, target, tests):
    """The map a name option means (None for a family with no member that
    fits), after checking every description it adds."""
    s = strip(label)
    claims = []
    for pattern, head, lead in LEADS:
        m = re.fullmatch(pattern, s)
        if m:
            s, claims = head(m), claims + lead
    for pattern, more in DESCRIPTIONS:
        m = re.search(pattern + "$", s)
        if m:
            s, claims = s[:m.start()], claims + more
            break
    f, info = head_map(s, ctx, target)
    for claim in claims:
        require(description_holds(claim, info, ctx, tests), f"False description {claim!r} in {label!r}")
        STATS["descriptions"] = STATS.get("descriptions", 0) + 1
    return f


def same_map(f, g, tests):
    return all(close(f(q), g(q)) for q in tests)


def solve_select(public):
    prompt = public["prompt"]
    options = public["response"]["options"]
    ctx0 = plain_context(public)

    def ctx_of(q):
        c = dict(ctx0)
        c["P"] = q
        return c

    P = ctx0["P"]
    valid = []
    if prompt.startswith("A motion is defined this way:"):
        statement = re.match(r"A motion is defined this way: (.*)\. Which motion is it\?$", prompt).group(1)
        statement = re.sub(r"^(?:every point of line \$m\$ stays put, and |\$C\$ stays put, and )", "", statement)
        statement = re.sub(r"^(?:any|every) other point \$P\$ goes to the point \$P'\$ ", "", statement)
        defined = name_map(statement, ctx_of, P)
        require(close(defined(P), ctx0["Pimg"]), "The figure's P' is the defined image of P")
        tests = [P, (3.3, -1.7), (-2.6, 4.1), (5.2, 2.9), (-4.4, -3.8), (0.7, 0.9)]
        for o in options:
            f = named_option(o["label"], ctx0, defined, tests)
            if f is not None and same_map(f, defined, tests):
                valid.append(o["id"])
        STATS["statements"] += len(options)
    else:
        motion = motion_from(ctx0, prompt)
        require(close(motion.image(P), ctx0["Pimg"]), "The figure's P' is the image of P")
        base = []
        if prompt.startswith("Dana writes:"):
            dana = re.search(r'sends \$P\$ to the point \$P\'\$ (.*?)\."', prompt).group(1)
            dana = re.sub(r"^(?:with |that is )", "", dana)
            base = [dana]
            Q = ctx0["Q"]
            # Q fits Dana's statement and is not the image; the image fits too.
            dana_conds = conditions_of(dana, ctx0)
            require(satisfies(dana_conds, Q), "Q fits Dana's statement")
            require(satisfies(dana_conds, motion.image(P)), "The image fits Dana's statement")
            require(not close(Q, motion.image(P)), "Q is not the image")
            require(statement_set(base, ctx0) == INFINITE, "Dana's statement alone is not a definition")
        for o in options:
            phrases = base + ([strip(o["label"])] if base else option_phrases(o["label"]))
            if defines(phrases, motion, ctx_of, P):
                valid.append(o["id"])
            STATS["statements"] += 1
    require(len(valid) == 1, f"Expected exactly one valid option, found {valid}")
    return valid[0]


# ---------------------------------------------------------------- check

def pt(text):
    x, y = text.split(",")
    return (float(x), float(y))


def named_point(name, prompt):
    """The coordinates the prompt gives a named point, as in $P(-4,7)$."""
    m = re.search(r"\$" + re.escape(name) + r"\((" + NUM + "," + NUM + r")\)\$", prompt)
    require(m is not None, f"The prompt gives coordinates for {name}")
    return pt(m.group(1))


def solve_check(public):
    prompt = public["prompt"]
    P = named_point("P", prompt)
    Q = named_point("P'", prompt)
    if prompt.startswith("The reflection"):
        eq = re.search(r"equation \$(.*?)\$", prompt).group(1)
        if eq.startswith("x="):
            a, u = (float(eq[2:]), 0.0), (0.0, 1.0)
        else:
            m = re.fullmatch(r"y=(-?)x([+-]\d+)?|y=(" + NUM + ")", eq)
            require(m is not None, f"Unread line {eq}")
            if m.group(3) is not None:
                a, u = (0.0, float(m.group(3))), (1.0, 0.0)
            else:
                slope = -1.0 if m.group(1) else 1.0
                a, u = (0.0, float(m.group(2) or 0)), (1.0, slope)
        first = abs(dot(sub(Q, P), u)) < EPS
        mid = mul(add(P, Q), 0.5)
        second = abs(side(a, u, mid)) < EPS
    elif prompt.startswith("The rotation"):
        C = named_point("C", prompt)
        deg = deg_of(prompt)
        require("counterclockwise" in prompt, "Turns are counterclockwise")
        v, w = sub(P, C), sub(Q, C)
        first = abs(dot(v, v) - dot(w, w)) < EPS
        r = rot(v, deg)
        second = abs(cross(r, w)) < EPS and dot(r, w) > 0
    else:
        A = named_point("A", prompt)
        B = named_point("B", prompt)
        v, w = sub(B, A), sub(Q, P)
        first = abs(cross(v, w)) < EPS and dot(v, w) > 0
        second = abs(dot(v, v) - dot(w, w)) < EPS
    # The figure shows the same points.
    pts = [(p["x"], p["y"]) for e in public["figure"]["scene"]["elements"] if e["type"] == "graph" for p in e.get("points", [])]
    require(any(close(P, (p[0], p[1])) for p in pts) and any(close(Q, (p[0], p[1])) for p in pts), "The figure plots P and P'")
    blanks = {b["id"]: b for b in public["response"]["blanks"]}
    pick = lambda blank, label: next(o["id"] for o in blanks[blank]["options"] if o["label"] == label)
    verdict = ("Yes: both conditions hold" if first and second else "No: only the first condition holds" if first
               else "No: only the second condition holds" if second else "No: neither condition holds")
    key = {"first": pick("first", "Yes" if first else "No"), "second": pick("second", "Yes" if second else "No"), "verdict": pick("verdict", verdict)}
    return json.dumps(key, separators=(",", ":"))


# ---------------------------------------------------------------- slots

def slot_phrase(blank, label, motion):
    """The condition a blank's option adds, written in the select wording."""
    s = strip(label)
    if motion.kind == "rotation":
        if blank == "path":
            return {"the circle with center C through P": "on the circle with center C through P",
                    "the circle with center P through C": "CIRCLE-P",
                    "the line through C and P": "LINE-CP",
                    "the line through C perpendicular to \\overline{CP}": "LINE-PERP"}[s]
        if blank == "angle":
            return {"m\\angle PCP'": "AT-C", "m\\angle CPP'": "AT-P", "PP'": "LENGTH"}[s]
        if blank == "dir":
            return {"counterclockwise from ray CP": "ccw", "clockwise from ray CP": "cw", "in either direction from ray CP": "either"}[s]
    if motion.kind == "reflection":
        if blank == "fixed":
            return s
        if blank == "angle":
            return {"perpendicular to": "perp", "parallel to": "par", "at a 45^\\circ angle to": "45"}[s]
        if blank == "where":
            return {"the midpoint": "mid", "an endpoint": "end", "a point": "point"}[s]
    if blank == "line":
        return {"parallel to (or on) line AB": "par", "on line AB": "on", "perpendicular to line AB": "perp"}[s]
    if blank == "length":
        return {"PP'=AB": "PP=AB", "PP'=AP": "PP=AP", "AP'=AB": "AP=AB"}[s]
    if blank == "dir":
        return {"in the same direction from P as B is from A": "same", "on the same side of line AB as P": "side", "the same distance from A as P is from B": "AP=BP"}[s]
    raise ValueError(f"Unread blank option {blank}: {label!r}")


def slot_conditions(choice, motion, P):
    out = []
    if motion.kind == "rotation":
        C = motion.C
        deg = abs(motion.theta)
        path, angle, direction = choice["path"], choice["angle"], choice["dir"]
        if path == "LINE-CP":
            out.append(("locus", [Line(C, sub(P, C))]))
        elif path == "LINE-PERP":
            out.append(("locus", [Line(C, rot(sub(P, C), 90))]))
        elif path == "CIRCLE-P":
            out.append(("locus", [Circle(P, norm(sub(C, P)))]))
        else:
            out.append(("locus", [Circle(C, norm(sub(P, C)))]))
        signs = {"ccw": [1], "cw": [-1], "either": [1, -1]}[direction]
        if angle == "AT-C":
            out.append(("locus", [Ray(C, rot(sub(P, C), s * deg)) for s in signs]))
        elif angle == "AT-P":
            out.append(("locus", [Ray(P, rot(sub(C, P), s * deg)) for s in signs]))
        else:
            out.append(("locus", [Circle(P, deg)]))
        return out
    if motion.kind == "reflection":
        a, u = motion.a, motion.u
        if choice["angle"] == "perp":
            out.append(("locus", [Line(P, rot(u, 90))]))
        elif choice["angle"] == "par":
            out.append(("locus", [Line(P, u)]))
        else:
            out.append(("locus", [Line(P, rot(u, 45)), Line(P, rot(u, -45))]))
        if choice["where"] == "mid":
            out.append(("locus", [Line(sub(mul(a, 2), P), u)]))
        elif choice["where"] == "end":
            out.append(("locus", [Line(a, u)]))
        else:
            out.append(("filter", lambda x: side(a, u, x) * side(a, u, P) <= EPS))
        return out
    A, B = motion.A, motion.B
    v = sub(B, A)
    if choice["line"] == "par":
        out.append(("locus", [Line(P, v)]))
    elif choice["line"] == "perp":
        out.append(("locus", [Line(P, rot(v, 90))]))
    else:
        out.append(("locus", [Line(A, v)]))
        out.append(("filter", lambda x: abs(cross(v, sub(x, P))) < EPS))  # PP' on line AB
    if choice["length"] == "PP=AB":
        out.append(("locus", [Circle(P, norm(v))]))
    elif choice["length"] == "PP=AP":
        out.append(("locus", [Circle(P, norm(sub(P, A)))]))
    else:
        out.append(("locus", [Circle(A, norm(v))]))
    if choice["dir"] == "same":
        out.append(("filter", lambda x: dot(sub(x, P), v) > EPS))
    elif choice["dir"] == "side":
        out.append(("filter", lambda x: cross(v, sub(x, A)) * cross(v, sub(P, A)) > EPS))
    else:
        out.append(("locus", [Circle(A, norm(sub(P, B)))]))
    return out


def solve_slots(public):
    els = public["figure"]["scene"]["elements"]
    by_id = {e.get("id"): e for e in els}
    P = tuple(by_id["p"]["at"])
    Pimg = tuple(by_id["q"]["at"])
    blanks = public["response"]["blanks"]
    if "m" in by_id:
        motion = Motion("reflection", a=tuple(by_id["m"]["from"]), u=sub(tuple(by_id["m"]["to"]), tuple(by_id["m"]["from"])))
    elif "ab" in by_id:
        motion = Motion("translation", A=tuple(by_id["ab"]["from"]), B=tuple(by_id["ab"]["to"]))
    else:
        C = tuple(by_id["c"]["at"])
        deg = deg_of(public["prompt"])
        arc = by_id["turn"]
        sign = 1 if arc["to"] > arc["from"] else -1
        require(abs(abs(arc["to"] - arc["from"]) - deg) < 1e-6, "The arc mark spans the stated angle")
        motion = Motion("rotation", C=C, theta=sign * deg)
    require(close(motion.image(P), Pimg), "The figure's P' is the image of P")
    # The figure's marks: equal ticks on CP and CP' (rotation), a right-angle
    # box (reflection) and parallel arrows with equal ticks (translation).
    ids = set(by_id)
    if motion.kind == "rotation":
        require({"t10", "t20", "turn"} <= ids, "Rotation marks drawn")
    elif motion.kind == "reflection":
        require({"box", "t10", "t20"} <= ids, "Reflection marks drawn")
    else:
        require({"par10", "par20", "t10", "t20"} <= ids, "Translation marks drawn")
    readings = {b["id"]: [(o["id"], slot_phrase(b["id"], o["label"], motion)) for o in b["options"]] for b in blanks}
    if motion.kind == "rotation" and any(ph == "CIRCLE-P" for _, ph in readings.get("path", [])):
        # The drawn P' must not lie on the circle with center P through C
        # (PP' = PC happens only for a 60 degree turn).
        gap = abs(norm(sub(Pimg, P)) - norm(sub(motion.C, P))) / norm(sub(motion.C, P))
        require(gap > EPS, "The drawn P' is on the circle with center P through C")
        STATS["circle_p_gap"] = min(gap, STATS.get("circle_p_gap", math.inf))
    if motion.kind == "reflection":
        fixed = [oid for oid, ph in readings.pop("fixed") if ph == "itself"]
        require(len(fixed) == 1, "Exactly one fixed-point option")
    found = []
    names = list(readings)
    for combo in itertools.product(*[readings[n] for n in names]):
        choice = {n: ph for n, (_, ph) in zip(names, combo)}
        ok = True
        for q in motion.tests(P):
            got = solve_set(slot_conditions(choice, motion, q))
            if got == INFINITE or len(got) != 1 or not close(got[0], motion.image(q)):
                ok = False
                break
        if ok:
            found.append({n: oid for n, (oid, _) in zip(names, combo)})
    require(len(found) == 1, f"Expected exactly one completion, found {found}")
    key = found[0]
    if motion.kind == "reflection":
        key = {"fixed": fixed[0], **key}
    ordered = {b["id"]: key[b["id"]] for b in blanks}
    return json.dumps(ordered, separators=(",", ":"))


# ---------------------------------------------------------------- entry points

def solve(public):
    t = public["templateId"]
    require(t in SUPPORTED, f"Unsupported template {t}")
    if t == "rigid-motion-definition-select":
        return solve_select(public)
    if t == "rigid-motion-definition-check":
        return solve_check(public)
    return solve_slots(public)


def review_problem(problem):
    public = problem["public"]
    STATS["cases"] += 1
    expected = solve(public)
    r = public["response"]
    if r["kind"] == "choice":
        ids = [o["id"] for o in r["options"]]
        require(len(set(o["label"] for o in r["options"])) == len(ids), "Distinct options")
    return expected


# ---------------------------------------------------------------- self test

def _rejects(fn, why):
    try:
        fn()
    except (ValueError, KeyError, StopIteration, TypeError, ZeroDivisionError):
        return
    raise ValueError(f"Self-test mutation accepted: {why}")


def self_test():
    # Loci and their intersections.
    require(statement_set(["with CP'=CP, m\\angle PCP'=90^\\circ counterclockwise from ray CP"], {"P": (2, 0), "C": (0, 0)}) != INFINITE, "circle and ray")
    got = statement_set(["with CP'=CP, m\\angle PCP'=90^\\circ counterclockwise from ray CP"], {"P": (2, 0), "C": (0, 0)})
    require(len(got) == 1 and close(got[0], (0, 2)), "quarter turn of (2, 0)")
    require(statement_set(["with CP'=CP, on the circle with center C through P"], {"P": (2, 0), "C": (0, 0)}) == INFINITE, "circle alone is not a definition")
    got = statement_set(["with CP'=CP", "P' must be on line CP, on the opposite side of C from P"], {"P": (2, 0), "C": (0, 0)})
    require(len(got) == 1 and close(got[0], (-2, 0)), "the opposite ray gives the half turn")
    _rejects(lambda: conditions_of("with CP'=CP, so P' is the image", {"P": (2, 0), "C": (0, 0)}), "an unread clause")
    # Name options: heads with descriptions, each checked on the map.
    turn = {"P": (2, 0), "C": (0, 0)}
    quarter = lambda q: rotate_about(q, (0, 0), 90)  # noqa: E731
    pts = [(2, 0), (3.3, -1.7), (-2.6, 4.1)]
    require(same_map(named_option("The rotation about $C$ by $90^\\circ$ counterclockwise, a quarter turn", turn, quarter, pts), quarter, pts), "quarter turn named")
    require(same_map(named_option("The half turn about $C$: the rotation about $C$ by $180^\\circ$", turn, quarter, pts), lambda q: (-q[0], -q[1]), pts), "half turn named")
    _rejects(lambda: named_option("The rotation about $C$ by $90^\\circ$, a half turn about $C$", turn, quarter, pts), "a quarter turn called a half turn")
    _rejects(lambda: named_option("The dilation about $C$ with scale factor $2$, halving each distance from $C$", turn, quarter, pts), "scale 2 called halving")
    _rejects(lambda: named_option("The rotation about $C$ by $90^\\circ$, a quarter turn about $C$", turn, quarter, pts), "an unread description")
    require(named_option("A reflection across a line through $C$, which keeps every point of that line in place", turn, quarter, pts) is not None, "a reflection through C sends (2, 0) to (0, 2)")
    refl = {"P": (1, 3), "a": (0, 0), "u": (1, 0)}
    require(statement_set(["with m as the perpendicular bisector of \\overline{PP'}"], refl)[0] == (1, -3), "perpendicular bisector")
    require(statement_set(["as far from m as P is, on the other side of m"], refl) == INFINITE, "distance alone")
    require(statement_set(["the same distance from m as P, on the other side", "\\overline{PP'} must be parallel to m"], refl) == [], "parallel and other distance-line do not meet")
    # A complete select item.
    fig = {"kind": "scene", "scene": {"v": 1, "elements": [
        {"id": "c", "type": "point", "at": [0, 0]}, {"id": "cn", "type": "text", "at": [0, 0], "text": "C"},
        {"id": "p", "type": "point", "at": [3, 1]}, {"id": "pn", "type": "text", "at": [3, 1], "text": "P"},
        {"id": "q", "type": "point", "at": list(rotate_about((3, 1), (0, 0), 120))}, {"id": "qn", "type": "text", "at": [0, 0], "text": "P′"}]}}
    opts = [
        {"id": "option-a", "label": "$C$ stays put; any other point $P$ goes to some point $P'$ with $m\\angle PCP'=120^\\circ$ counterclockwise from ray $CP$"},
        {"id": "option-b", "label": "$C$ stays put; any other $P$ goes to $P'$ with $CP'=CP$, $m\\angle PCP'=120^\\circ$ counterclockwise from ray $CP$"},
        {"id": "option-c", "label": "$C$ stays put; any other point $P$ goes to the $P'$ with $CP'=CP$, $m\\angle PCP'=120^\\circ$ clockwise from ray $CP$"},
        {"id": "option-d", "label": "$C$ stays put; any other point $P$ goes to the point $P'$ for which $C$ is the midpoint of $\\overline{PP'}$"},
    ]
    public = {"templateId": "rigid-motion-definition-select", "prompt": "Point $C$ is drawn, with a point $P$ and its image $P'$. Which statement defines the rotation about $C$ by $120^\\circ$ counterclockwise? A definition must say exactly where the image $P'$ of every point $P$ is.",
              "response": {"kind": "choice", "label": "Choose one answer", "options": opts}, "figure": fig}
    require(solve(public) == "option-b", "rotation definition")
    for e in fig["scene"]["elements"]:
        if e["id"] == "qn":
            e["at"] = e["at"]
    require(review_problem({"public": public, "answer": "option-b"}) == "option-b", "review returns the key")
    two = json.loads(json.dumps(public))
    two["response"]["options"][2]["label"] = opts[1]["label"].replace("any other $P$", "every other $P$")
    _rejects(lambda: solve(two), "two valid definitions")
    wrong_image = json.loads(json.dumps(public))
    wrong_image["figure"]["scene"]["elements"][4]["at"] = [1, 1]
    _rejects(lambda: solve(wrong_image), "the figure's P' is not the image")
    # A check item.
    check = {"templateId": "rigid-motion-definition-check",
             "prompt": "The rotation about $C(1,1)$ by $180^\\circ$ counterclockwise is claimed to send $P(-1,4)$ to $P'(3,-2)$. Check it against the definition: answer each condition, then decide.",
             "response": {"kind": "multi-part-choice", "label": "x", "layout": "slots", "blanks": [
                 {"id": "first", "label": "1", "options": [{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]},
                 {"id": "second", "label": "2", "options": [{"id": "a", "label": "Yes"}, {"id": "b", "label": "No"}]},
                 {"id": "verdict", "label": "3", "options": [{"id": "a", "label": "Yes: both conditions hold"}, {"id": "b", "label": "No: only the first condition holds"},
                                                              {"id": "c", "label": "No: only the second condition holds"}, {"id": "d", "label": "No: neither condition holds"}]}]},
             "figure": {"kind": "scene", "scene": {"v": 1, "elements": [{"type": "graph", "points": [{"x": 1, "y": 1}, {"x": -1, "y": 4}, {"x": 3, "y": -2}]}]}}}
    require(solve(check) == '{"first":"a","second":"a","verdict":"a"}', "true half turn")
    off = json.loads(json.dumps(check))
    off["prompt"] = off["prompt"].replace("P'(3,-2)", "P'(3,-1)")
    off["figure"]["scene"]["elements"][0]["points"][2] = {"x": 3, "y": -1}
    require(solve(off) == '{"first":"b","second":"b","verdict":"d"}', "neither condition")
    moved = json.loads(json.dumps(check))
    moved["figure"]["scene"]["elements"][0]["points"][2] = {"x": 5, "y": 5}
    _rejects(lambda: solve(moved), "the figure plots another point than the prompt")
    return True
