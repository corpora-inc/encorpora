"""Independent review of the rigid-motion congruence-criterion family
(HSG.CO.B.8): rigid-motion-criterion-proof, rigid-motion-criterion-reason
and rigid-motion-criterion-flaw.

Only the public payload decides an answer: the prompt (givens, stated
orientations, letters and correspondence), the response (statement and
reason banks, rows, options) and the figure (vertex labels, tick and arc
marks, dashed comparison segments). The answer key and the private
`workGrading` rule are values under test; the hint and explanation are
never read.

* Figure. The six vertices are read from their labels and the proof's
  construction is applied to the coordinates: translate A to D, rotate about
  D until the image B' of B is on ray DE, and reflect the image C' of C over
  line DE (C''). The givens, the stated orientations, the marks, the integer
  side lengths, the angle range and the separation of the triangles are
  checked against the coordinates, and so is every proof statement.
* Proof lines. Each statement is read from its TeX into atoms: equal
  lengths, equal angle measures, a point on a ray, equal points, the side of
  line DE that holds a point, the motions themselves, the congruence. Each
  reason is read into the inference rules it states. A line is valid when,
  in order, every atom is true of the figure and is either stated above (or
  given, or follows from those by equality chains) or is produced by one of
  the reason's own rules from what is stated above or earlier in the line:
  distance or angle measure preserved along the motions made so far; one
  point of a ray at a distance from its endpoint; one ray from D or E on one
  side of line DE at a given angle; two different lines meet at most once;
  two circles meet at most twice, one on each side of the line of centers;
  orientation kept by translations and rotations and reversed by the
  reflection, which fixes line DE; and the definition of congruence. The
  evidence a conclusion uses must be written (on the line or above it): a
  reason never supplies an unwritten length or angle. CPCTC, a criterion, the
  triangles' congruence and every false general claim justify nothing.
* Grading claims. Every claim must be valid with whatever must stand above
  its premises, every minimal set of lines that makes a line valid must be
  credited by some claim, and the complete responses the claims credit in
  the shown mode (every order, or every fill of the blanks) must be exactly
  the responses this oracle accepts. The key must be one of them, and in a
  fill the only one.
* Reason and flaw choices. Every option is read into what it asserts. A
  justification is valid when everything it asserts is true and given, it is
  not circular, and it contains a property of rigid motions, the given that
  matches it and the uniqueness fact the step needs. A diagnosis is valid
  when it names the line that does not follow and a failure that line really
  has. The SSA figure must show two triangles (AB sin A < BC < AB, the circle
  about E really meets ray DF twice) and the AAA figure a scaled copy.
  Exactly one option may be valid.
"""

import itertools
import json
import math
import re

PROOF = "rigid-motion-criterion-proof"
REASON = "rigid-motion-criterion-reason"
FLAW = "rigid-motion-criterion-flaw"
SUPPORTED = frozenset({PROOF, REASON, FLAW})
REVIEW_RETURNS_ANSWER = True

STATS = {"cases": 0, "linesChecked": 0, "claimsChecked": 0, "responsesCompared": 0, "optionsChecked": 0}


def require(condition, message):
    # Not assert: python -O must not disable review gates.
    if not condition:
        raise ValueError(message)


# ======================================================================
# Plane geometry (figure coordinates are floats; tolerances are relative)

EPS = 1e-7


def sub(p, q):
    return (p[0] - q[0], p[1] - q[1])


def add(p, q):
    return (p[0] + q[0], p[1] + q[1])


def mul(p, k):
    return (p[0] * k, p[1] * k)


def cross(u, v):
    return u[0] * v[1] - u[1] * v[0]


def dot(u, v):
    return u[0] * v[0] + u[1] * v[1]


def norm(u):
    return math.hypot(u[0], u[1])


def dist(p, q):
    return norm(sub(p, q))


def near(p, q):
    return dist(p, q) < 1e-6


def close(a, b):
    return abs(a - b) < EPS * max(1.0, abs(a), abs(b))


def angle(v, p, q):
    a, b = sub(p, v), sub(q, v)
    return math.atan2(abs(cross(a, b)), dot(a, b))


def rotate(u, t):
    c, s = math.cos(t), math.sin(t)
    return (u[0] * c - u[1] * s, u[0] * s + u[1] * c)


def mirror(p, a, b):
    u = sub(b, a)
    foot = add(a, mul(u, dot(sub(p, a), u) / dot(u, u)))
    return sub(mul(foot, 2), p)


def side_of(p, a, b):
    """+1 left of a→b, −1 right, 0 on the line."""
    x = cross(sub(b, a), sub(p, a))
    if abs(x) < 1e-6 * max(1.0, norm(sub(b, a))):
        return 0
    return 1 if x > 0 else -1


def on_ray(p, o, through):
    u, w = sub(through, o), sub(p, o)
    if norm(w) < 1e-6:
        return False
    return abs(cross(u, w)) < 1e-6 * norm(u) * norm(w) and dot(u, w) > 0


def ray_circle(o, through, center, radius):
    """Distances t > 0 along ray o→through of the points at `radius` from center."""
    u = mul(sub(through, o), 1 / dist(through, o))
    w = sub(o, center)
    b = dot(u, w)
    disc = b * b - (dot(w, w) - radius * radius)
    if disc < -1e-9:
        return []
    root = math.sqrt(max(disc, 0.0))
    return sorted(t for t in {-b - root, -b + root} if t > 1e-6)


def construct(at):
    """The proof's motions applied to the figure: translate A to D, rotate
    about D until ray DB' is ray DE, then C'' = the mirror of C' over DE."""
    ab, de = sub(at["B"], at["A"]), sub(at["E"], at["D"])
    t = math.atan2(cross(ab, de), dot(ab, de))

    def image(q):
        return add(at["D"], rotate(sub(q, at["A"]), t))

    c1 = image(at["C"])
    return {"B1": image(at["B"]), "C1": c1, "C2": mirror(c1, at["D"], at["E"])}


# ======================================================================
# Names: roles A..F (△ABC → △DEF with A→D, B→E, C→F) and the images
# B1 = B', C1 = C', C2 = C''.

ROLES = "ABCDEF"
ORIGINAL = frozenset("ABC")
TARGET = frozenset("DEF")
MATCH = {"A": "D", "B": "E", "C": "F"}
SIDE_KEY = {frozenset("AB"): "AB", frozenset("BC"): "BC", frozenset("CA"): "CA"}
VERTEX_ANGLE = {v: (v, frozenset(t for t in tri if t != v)) for tri in ("ABC", "DEF") for v in tri}


class Names:
    def __init__(self, letters):
        require(set(letters) == set(ROLES), "Six roles")
        require(len(set(letters.values())) == 6, "Six distinct vertex letters")
        require(all(re.fullmatch(r"[A-Z]", v) and v not in "IO" for v in letters.values()),
                "Vertex letters are capitals other than I and O")
        self.text = dict(letters)
        self.text.update(B1=letters["B"] + "'", C1=letters["C"] + "'", C2=letters["C"] + "''")
        self.role = {v: k for k, v in self.text.items()}

    def point(self, name):
        require(name in self.role, f"Unknown point {name!r}")
        return self.role[name]

    def points(self, text):
        tokens = re.findall(r"[A-Z]'*", text)
        require("".join(tokens) == text, f"Unreadable point names {text!r}")
        return [self.point(t) for t in tokens]

    def subst(self, **extra):
        out = dict(self.text)
        out.update(extra)
        return out


def tpl(template, names):
    """A full-match regex for a TeX sentence: <X> is the point named X, the
    rest is literal."""
    parts = re.split(r"<(\w+)>", template)
    return re.compile("".join(re.escape(part) if i % 2 == 0 else re.escape(names[part])
                              for i, part in enumerate(parts)))


def matches(template, names, text):
    return tpl(template, names).fullmatch(text) is not None


def read_correspondence(text):
    m = re.fullmatch(r"\$(\w)\\to (\w)\$, \$(\w)\\to (\w)\$, \$(\w)\\to (\w)\$", text)
    require(m, f"Unreadable correspondence {text!r}")
    return {"A": m[1], "D": m[2], "B": m[3], "E": m[4], "C": m[5], "F": m[6]}


def read_given_span(span, names):
    """'\\overline{AB}\\cong\\overline{DE}', 'AB=DE' or '\\angle A\\cong\\angle D'
    → the given key (AB, BC, CA, A, B, C), the correspondence checked."""
    m = re.fullmatch(r"\\overline\{(.+?)\}\\cong\\overline\{(.+?)\}", span) or re.fullmatch(r"([A-Z]{2})=([A-Z]{2})", span)
    if m:
        x, y = names.points(m[1]), names.points(m[2])
        require(len(x) == 2 and len(y) == 2 and set(x) <= ORIGINAL and set(y) <= TARGET, f"Not a side pair: {span!r}")
        require([MATCH[x[0]], MATCH[x[1]]] == y, f"Sides do not correspond: {span!r}")
        return SIDE_KEY[frozenset(x)]
    m = re.fullmatch(r"\\angle (\w)\\cong\\angle (\w)", span)
    require(m, f"Unreadable given {span!r}")
    x, y = names.point(m[1]), names.point(m[2])
    require(x in ORIGINAL and MATCH[x] == y, f"Angles do not correspond: {span!r}")
    return x


def read_givens(text, names):
    spans = re.findall(r"\$([^$]+)\$", text)
    require(re.sub(r"\$[^$]+\$", "§", text) == "§, § and §", f"Three givens: {text!r}")
    keys = [read_given_span(s, names) for s in spans]
    require(len(set(keys)) == 3, "Three different givens")
    return frozenset(keys)


def classify(givens):
    """The criterion a set of three given pairs names."""
    sides = {k for k in givens if len(k) == 2}
    angles = {k for k in givens if len(k) == 1}
    if len(sides) == 3:
        return "SSS"
    if len(angles) == 3:
        return "AAA"
    if len(sides) == 2:
        (v,) = angles
        common = set.intersection(*(set(s) for s in sides))
        return "SAS" if common == {v} else "SSA"
    (s,) = sides
    return "ASA" if angles == set(s) else "AAS"


def given_atom(k):
    if len(k) == 2:
        x, y = k[0], k[1]
        return LEN(seg(x, y), seg(MATCH[x], MATCH[y]))
    return ANG(VERTEX_ANGLE[k], VERTEX_ANGLE[MATCH[k]])


ORIENT = re.compile(r"\$(\w)\\to (\w)\\to (\w)\$ runs (clockwise|counterclockwise) and \$(\w)\\to (\w)\\to (\w)\$ runs (clockwise|counterclockwise)")


def read_orientation(text, names, at):
    """Stated orientations, checked against the figure; returns opposite."""
    m = ORIENT.fullmatch(text)
    require(m, f"Unreadable orientation {text!r}")
    require([names.point(m[i]) for i in (1, 2, 3)] == ["A", "B", "C"] and [names.point(m[i]) for i in (5, 6, 7)] == ["D", "E", "F"],
            "Orientation names the triangles in order")
    abc = side_of(at["C"], at["A"], at["B"])
    de_f = side_of(at["F"], at["D"], at["E"])
    require(abc != 0 and de_f != 0, "Triangles are not flat")
    require((m[4] == "counterclockwise") == (abc > 0) and (m[8] == "counterclockwise") == (de_f > 0),
            "Stated orientation contradicts the figure")
    return abc != de_f


# ======================================================================
# The figure

SIDES = [("A", "B"), ("B", "C"), ("C", "A"), ("D", "E"), ("E", "F"), ("F", "D")]


def read_figure(public, names):
    fig = public.get("figure")
    require(isinstance(fig, dict) and fig.get("kind") == "scene", "A scene figure")
    els = fig["scene"]["elements"]
    labels = {}
    for e in els:
        if e.get("type") == "text":
            labels.setdefault(e["text"], []).append((float(e["at"][0]), float(e["at"][1])))
    require(set(labels) == {names.text[r] for r in ROLES}, f"The labels are the six vertices: {sorted(labels)}")
    require(all(len(v) == 1 for v in labels.values()), "Each vertex is labeled once")
    at = {r: labels[names.text[r]][0] for r in ROLES}
    solid = [(tuple(e["from"]), tuple(e["to"])) for e in els if e.get("type") == "segment" and not e.get("dash")]
    for p, q in SIDES:
        require(any((near(a, at[p]) and near(b, at[q])) or (near(a, at[q]) and near(b, at[p])) for a, b in solid),
                f"Side {names.text[p]}{names.text[q]} is drawn")
    require(len(solid) == 6, "Only the six sides are drawn solid")
    return at, els


def on_segment(p, a, b):
    if dist(a, b) < 1e-9:
        return False
    t = dot(sub(p, a), sub(b, a)) / dot(sub(b, a), sub(b, a))
    foot = add(a, mul(sub(b, a), t))
    return 0.05 < t < 0.95 and dist(p, foot) < 1e-6


def check_marks(at, els, givens, names):
    """Tick and arc marks: each mark count picks out exactly one given pair
    (a dashed comparison segment may share a count when its length agrees)."""
    dashed = [(tuple(e["from"]), tuple(e["to"])) for e in els if e.get("type") == "segment" and e.get("dash")]
    ticks, arcs = {}, {}
    for e in els:
        if e.get("type") == "tick":
            p = tuple(e["at"])
            hits = [frozenset(s) for s in SIDES if on_segment(p, at[s[0]], at[s[1]])]
            hits += [("dashed", i) for i, (a, b) in enumerate(dashed) if on_segment(p, a, b)]
            require(len(hits) == 1, "Every tick sits on one segment")
            ticks[hits[0]] = ticks.get(hits[0], 0) + 1
        elif e.get("type") == "arc":
            c = tuple(e["center"])
            hits = [r for r in ROLES if near(c, at[r])]
            require(len(hits) == 1, "Every arc is centered on a vertex")
            arcs[hits[0]] = arcs.get(hits[0], 0) + 1
    marked = set()
    for counts, kind in ((ticks, "side"), (arcs, "angle")):
        for n in set(counts.values()):
            group = [k for k, c in counts.items() if c == n]
            sides = [k for k in group if not isinstance(k, tuple)]
            extra = [k for k in group if isinstance(k, tuple)]
            if kind == "side":
                require(len(sides) == 2, f"{n} ticks mark one pair of sides")
                x, y = sorted(sides, key=lambda s: not s <= ORIGINAL)
                require(x <= ORIGINAL and frozenset(MATCH[v] for v in x) == y, "Tick marks pair corresponding sides")
                key = SIDE_KEY[x]
                length = dist(*[at[v] for v in x])
                for _, i in extra:
                    require(close(dist(*dashed[i]), length), "A marked dashed segment has the marked length")
                marked.add(key)
            else:
                require(len(group) == 2, f"{n} arcs mark one pair of angles")
                x, y = sorted(group, key=lambda v: v not in ORIGINAL)
                require(x in ORIGINAL and MATCH[x] == y, "Arc marks pair corresponding angles")
                marked.add(x)
    require(marked == set(givens), f"The marks show exactly the givens: {sorted(marked)} vs {sorted(givens)}")


def check_congruent_pair(at):
    """Spec figure rules: congruent, integer sides 5–14 drawn to scale,
    angles in [30°, 110°], and the triangles apart."""
    s1 = [dist(at[p], at[q]) for p, q in SIDES[:3]]
    s2 = [dist(at[p], at[q]) for p, q in SIDES[3:]]
    require(all(close(a, b) for a, b in zip(s1, s2)), "The triangles are congruent")
    big = max(s1)
    require(any(all(abs(x * m / big - round(x * m / big)) < 1e-6 and 5 <= round(x * m / big) <= 14 for x in s1)
                and len({round(x * m / big) for x in s1}) == 3 for m in range(5, 15)),
            "Sides are distinct whole numbers 5–14 drawn to scale")
    check_angles(at, 30, 110)
    check_apart(at)


def check_angles(at, low, high):
    for v, p, q in (("A", "B", "C"), ("B", "C", "A"), ("C", "A", "B")):
        deg = math.degrees(angle(at[v], at[p], at[q]))
        require(low - 1e-6 <= deg <= high + 1e-6, f"Angle {deg:.2f}° outside [{low}, {high}]")


def check_apart(at):
    require(max(at[r][0] for r in "ABC") < min(at[r][0] for r in "DEF"), "The triangles do not overlap")


# ======================================================================
# Atoms

def seg(p, q):
    return frozenset((p, q))


def LEN(s1, s2):
    return ("len", frozenset((s1, s2)))


def ANG(a1, a2):
    return ("ang", frozenset((a1, a2)))


def EQ(p, q):
    return ("eq", frozenset((p, q)))


def ONRAY(p, o, t):
    return ("onray", p, o, t)


def SIDE(p, rel):
    """p is on F's side of line DE ('same') or across it ('opp')."""
    return ("side", p, rel)


MOTION, MOTION_SEG, ROTATE_BE, REFLECT = ("motion",), ("motion-seg",), ("rotate-BE",), ("reflect",)
REFLECT_SWAPS, REFLECT_DE, CIRCLES_ONE = ("reflect-swaps",), ("reflect-DE",), ("circles-one",)
CONG, MAPS, RAYS_MEET = ("cong",), ("maps",), ("rays-meet-F",)
FALSE_ATOMS = {MOTION_SEG, ROTATE_BE, REFLECT_SWAPS, REFLECT_DE, CIRCLES_ONE}


class World:
    """One problem: letters, givens, orientation and the figure's points
    with the construction's images."""

    def __init__(self, names, givens, opposite, at):
        self.names = names
        self.givens = frozenset(givens)
        self.given_atoms = frozenset(given_atom(k) for k in givens)
        self.opposite = opposite
        self.at = dict(at)
        self.at.update(construct(at))
        self.noncollinear = side_of(at["F"], at["D"], at["E"]) != 0

    def seglen(self, s):
        p, q = tuple(s)
        return dist(self.at[p], self.at[q])

    def angval(self, a):
        v, rays = a
        p, q = tuple(rays)
        return angle(self.at[v], self.at[p], self.at[q])

    def true(self, atom):
        P = self.at
        k = atom[0]
        if k == "len":
            s = tuple(atom[1])
            return len(s) == 1 or close(self.seglen(s[0]), self.seglen(s[1]))
        if k == "ang":
            a = tuple(atom[1])
            return len(a) == 1 or close(self.angval(a[0]), self.angval(a[1]))
        if k == "onray":
            return near(P[atom[1]], P[atom[3]]) or on_ray(P[atom[1]], P[atom[2]], P[atom[3]])
        if k == "eq":
            pts = tuple(atom[1])
            return len(pts) == 1 or near(P[pts[0]], P[pts[1]])
        if k == "side":
            s, f = side_of(P[atom[1]], P["D"], P["E"]), side_of(P["F"], P["D"], P["E"])
            return s != 0 and (s == f) == (atom[2] == "same")
        if atom in (MOTION, REFLECT):
            return True
        if atom == MOTION_SEG:
            return near(add(P["B"], sub(P["D"], P["A"])), P["E"])
        if atom == ROTATE_BE:
            return close(dist(P["D"], P["B"]), dist(P["D"], P["E"]))
        if atom in (REFLECT_SWAPS, REFLECT_DE, CIRCLES_ONE):
            return False
        if atom == RAYS_MEET:
            return self.noncollinear
        if atom == CONG:
            return all(close(self.seglen(seg(p, q)), self.seglen(seg(MATCH[p], MATCH[q]))) for p, q in SIDES[:3])
        if atom == MAPS:
            return near(P["B1"], P["E"]) and near(P["C2" if self.opposite else "C1"], P["F"])
        raise ValueError(f"Unknown atom {atom!r}")


class Known:
    """Facts stated so far, with equality chains: equal points merge, a point
    on a ray from v stands for that ray, equal lengths and equal angle
    measures close under transitivity."""

    def __init__(self, atoms=()):
        self.atoms = set()
        self._built = False
        for a in atoms:
            self.add(a)

    def add(self, atom):
        self.atoms.add(atom)
        if atom in (MOTION, MOTION_SEG):
            # The motion (or a translation said to land AB on DE) puts B' on ray DE.
            self.atoms.add(ONRAY("B1", "D", "E"))
        if atom == REFLECT_SWAPS:
            # A reflection said to swap D and E is still a reflection: C'' exists.
            self.atoms.add(REFLECT)
        self._built = False

    def _build(self):
        parent = {}

        def find(x):
            parent.setdefault(x, x)
            while parent[x] != x:
                parent[x] = parent[parent[x]]
                x = parent[x]
            return x

        for a in self.atoms:
            if a[0] == "eq" and len(a[1]) == 2:
                p, q = tuple(a[1])
                rp, rq = find(p), find(q)
                if rp != rq:
                    parent[max(rp, rq)] = min(rp, rq)
        self.canon = find
        self.rays = {}
        for a in self.atoms:
            if a[0] == "onray":
                self.rays.setdefault((find(a[2]), find(a[3])), set()).update({find(a[1]), find(a[3])})
        self.rayrep = {}
        for (o, t), pts in self.rays.items():
            for p in pts:
                self.rayrep[(o, p)] = t
        self.sides = {(find(a[1]), a[2]) for a in self.atoms if a[0] == "side"}

        def classes(kind, key):
            par = {}

            def f(x):
                par.setdefault(x, x)
                while par[x] != x:
                    par[x] = par[par[x]]
                    x = par[x]
                return x

            for a in self.atoms:
                if a[0] == kind:
                    items = [key(x) for x in a[1]]
                    if len(items) == 2:
                        par[f(items[0])] = f(items[1])
            return f

        self.lenclass = classes("len", self.segkey)
        self.angclass = classes("ang", self.angkey)
        self._built = True

    def ready(self):
        if not self._built:
            self._build()

    def segkey(self, s):
        return frozenset(self.canon(p) for p in s)

    def angkey(self, a):
        v, rays = a
        cv = self.canon(v)
        return (cv, frozenset(self.rayrep.get((cv, self.canon(p)), self.canon(p)) for p in rays))

    @property
    def motion(self):
        return MOTION in self.atoms or MOTION_SEG in self.atoms

    def stages(self):
        """Images of A, B, C under the motions stated so far."""
        out = []
        if self.motion:
            out.append({"A": "D", "B": "B1", "C": "C1"})
            if REFLECT in self.atoms:
                out.append({"A": "D", "B": "B1", "C": "C2"})
        return out

    def has_len(self, s1, s2):
        self.ready()
        k1, k2 = self.segkey(s1), self.segkey(s2)
        return k1 == k2 or self.lenclass(k1) == self.lenclass(k2)

    def has_ang(self, a1, a2):
        self.ready()
        k1, k2 = self.angkey(a1), self.angkey(a2)
        return k1 == k2 or self.angclass(k1) == self.angclass(k2)

    def on(self, p, o, t):
        self.ready()
        cp, co, ct = self.canon(p), self.canon(o), self.canon(t)
        return cp == ct or cp in self.rays.get((co, ct), ())

    def has(self, atom):
        self.ready()
        k = atom[0]
        if k == "len":
            s = tuple(atom[1])
            return len(s) == 1 or self.has_len(*s)
        if k == "ang":
            a = tuple(atom[1])
            return len(a) == 1 or self.has_ang(*a)
        if k == "eq":
            pts = tuple(atom[1])
            return len(pts) == 1 or self.canon(pts[0]) == self.canon(pts[1])
        if k == "onray":
            return self.on(atom[1], atom[2], atom[3])
        if k == "side":
            cp = self.canon(atom[1])
            return (cp, atom[2]) in self.sides or (atom[2] == "same" and cp == self.canon("F"))
        return atom in self.atoms


def preserved_len(target, K):
    s = tuple(target[1])
    orig = [x for x in s if x <= ORIGINAL]
    if len(s) != 2 or len(orig) != 1:
        return False
    image = s[1] if orig[0] == s[0] else s[0]
    x, y = tuple(orig[0])
    want = K.segkey(image)
    return any(frozenset((K.canon(m[x]), K.canon(m[y]))) == want for m in K.stages())


def preserved_ang(target, K):
    a = tuple(target[1])
    orig = [x for x in a if ({x[0]} | x[1]) <= ORIGINAL]
    if len(a) != 2 or len(orig) != 1:
        return False
    image = a[1] if orig[0] == a[0] else a[0]
    v, rays = orig[0]
    want = K.angkey(image)
    return any(K.angkey((m[v], frozenset(m[r] for r in rays))) == want for m in K.stages())


def correspondence_key(atom):
    """The given key when the atom equates a part of △ABC with a part of
    △DEF directly (a given, or a phantom given)."""
    parts = tuple(atom[1])
    if len(parts) != 2:
        return None
    if atom[0] == "len":
        o = [s for s in parts if s <= ORIGINAL]
        t = [s for s in parts if s <= TARGET]
        if len(o) == 1 and len(t) == 1:
            return SIDE_KEY[o[0]]
    if atom[0] == "ang":
        o = [a for a in parts if a in VERTEX_ANGLE.values() and a[0] in ORIGINAL]
        t = [a for a in parts if a in VERTEX_ANGLE.values() and a[0] in TARGET]
        if len(o) == 1 and len(t) == 1:
            return o[0][0]
    return None


def eq_failure(p, q, K):
    """Why P = Q does not follow: the point is on a ray and a circle about
    another center (SSA), on a ray with no length, or simply unpinned."""
    K.ready()
    for (o, t), pts in K.rays.items():
        if K.canon(p) in pts and K.canon(q) in pts:
            for z in ("D", "E", "F", "A", "B", "C"):
                if K.canon(z) != o and K.has_len(seg(z, p), seg(z, q)):
                    return ("no-rule", "ray-circle")
            return ("no-rule", "ray-no-length")
    return ("no-rule", "unpinned")


def derive(atom, caps, K, W):
    """Whether the atom follows from K by logic or by one of the reason's
    rules; else the failure codes."""
    if K.has(atom):
        return True, []
    k = atom[0]
    if k in ("len", "ang"):
        key = correspondence_key(atom)
        if key is not None:
            return False, [("not-given", key)]
        if k == "len" and "preserve-dist" in caps and preserved_len(atom, K):
            return True, []
        if k == "ang" and "preserve-ang" in caps and preserved_ang(atom, K):
            return True, []
        return False, [("no-rule", k)]
    if k == "onray":
        p, o, t = atom[1:]
        if "unique-ray" in caps and o in ("D", "E") and t == "F":
            other = "E" if o == "D" else "D"
            if K.has_ang((o, frozenset((other, p))), (o, frozenset((other, "F")))) and K.has(SIDE(p, "same")):
                return True, []
        return False, [("no-rule", "onray")]
    if k == "eq":
        pts = tuple(atom[1])
        p, q = pts if len(pts) == 2 else (pts[0], pts[0])
        if "unique-dist" in caps:
            K.ready()
            for (o, t), on in K.rays.items():
                if K.canon(p) in on and K.canon(q) in on and K.has_len(seg(o, p), seg(o, q)):
                    return True, []
        if "lines" in caps and W.noncollinear:
            for x, y in ((p, q), (q, p)):
                if y == "F" and K.on(x, "D", "F") and K.on(x, "E", "F"):
                    return True, []
        if "circles" in caps:
            for x, y in ((p, q), (q, p)):
                if y == "F" and K.has_len(seg("D", x), seg("D", "F")) and K.has_len(seg("E", x), seg("E", "F")) and K.has(SIDE(x, "same")):
                    return True, []
        return False, [eq_failure(p, q, K)]
    if k == "side":
        p, rel = atom[1], atom[2]
        if p == "C1" and K.motion and (("orient-same" in caps and rel == "same") or ("orient-flip" in caps and rel == "opp")):
            return True, []
        if p == "C2" and rel == "same" and "reflect" in caps and REFLECT in K.atoms and K.has(SIDE("C1", "opp")):
            return True, []
        return False, [("no-rule", "side")]
    if atom == MOTION:
        return ("motion" in caps), ([] if "motion" in caps else [("no-rule", "motion")])
    if atom == REFLECT:
        ok = "reflect" in caps and K.motion
        return ok, ([] if ok else [("no-rule", "reflect")])
    if atom == RAYS_MEET:
        ok = "lines" in caps and W.noncollinear
        return ok, ([] if ok else [("no-rule", "rays")])
    if atom == MAPS:
        # Logic: one sequence of the stated motions takes A, B, C to D, E, F.
        ok = any(all(K.canon(m[x]) == K.canon(MATCH[x]) for x in "ABC") for m in K.stages())
        return ok, ([] if ok else [("no-rule", "maps")])
    if atom == CONG:
        ok = "def" in caps and K.has(MAPS)
        return ok, ([] if ok else [("no-rule", "cong")])
    if atom in FALSE_ATOMS:
        return False, [("false", atom[0])]
    raise ValueError(f"Unknown atom {atom!r}")


# ======================================================================
# Statements: TeX → ordered atoms

class Statement:
    def __init__(self, atoms, fails=()):
        self.atoms = list(atoms)
        self.fails = list(fails)


def skeleton(text):
    return re.sub(r"\$[^$]*\$", "§", text), re.findall(r"\$([^$]*)\$", text)


def math_atoms(span, n):
    """'DB'=AB=DE', 'm\\angle EDC'=m\\angle A=m\\angle D', 'B'=E',
    '\\triangle ABC\\cong\\triangle DEF' → atoms."""
    m = re.fullmatch(r"\\triangle (.+)\\cong\\triangle (.+)", span)
    if m:
        require(n.points(m[1]) == list("ABC") and n.points(m[2]) == list("DEF"), f"Congruence names the triangles in order: {span!r}")
        return [CONG]
    terms = []
    for t in span.split("="):
        if t.startswith("m\\angle "):
            pts = n.points(t[len("m\\angle "):])
            if len(pts) == 1:
                require(pts[0] in VERTEX_ANGLE, f"Angle at a vertex: {t!r}")
                terms.append(("a", VERTEX_ANGLE[pts[0]]))
            else:
                require(len(pts) == 3 and len(set(pts)) == 3, f"Unreadable angle {t!r}")
                terms.append(("a", (pts[1], frozenset((pts[0], pts[2])))))
        else:
            pts = n.points(t)
            require(len(pts) in (1, 2), f"Unreadable term {t!r}")
            terms.append(("p", pts[0]) if len(pts) == 1 else ("s", seg(*pts)))
    kinds = {k for k, _ in terms}
    require(len(kinds) == 1 and len(terms) >= 2, f"An equality of one kind: {span!r}")
    make = {"a": ANG, "s": LEN, "p": EQ}[kinds.pop()]
    return [make(terms[i][1], terms[i + 1][1]) for i in range(len(terms) - 1)]


def two(span, n):
    pts = n.points(span)
    require(len(pts) == 2, f"Two points: {span!r}")
    return pts


def one(span, n):
    pts = n.points(span)
    require(len(pts) == 1, f"One point: {span!r}")
    return pts[0]


def triangle(span, n):
    require(span.startswith("\\triangle "), f"A triangle: {span!r}")
    return n.points(span[len("\\triangle "):])


def overline(span, n):
    m = re.fullmatch(r"\\overline\{(.+)\}", span)
    require(m, f"A segment: {span!r}")
    return two(m[1], n)


def line_de(span, n):
    require(set(two(span, n)) == {"D", "E"}, f"Line DE: {span!r}")


def side_pair(a, b, n):
    p, q = one(a, n), one(b, n)
    require("F" in (p, q) and p != q, "A side of line DE relative to F")
    return q if p == "F" else p


def eqs(span, n):
    atoms = math_atoms(span, n)
    require(all(a[0] == "eq" for a in atoms), f"Equal points: {span!r}")
    return atoms


def read_statement(label, n):
    sk, sp = skeleton(label)
    if sk == "Translate § by the vector from § to §, then rotate about § until the image of § is on ray §; call the image §.":
        require(triangle(sp[0], n) == list("ABC") and [one(s, n) for s in sp[1:5]] == ["A", "D", "D", "B"]
                and two(sp[5], n) == ["D", "E"] and triangle(sp[6], n) == ["D", "B1", "C1"], "The translation and rotation")
        return Statement([MOTION])
    if sk in ("Translate § so that § lands on §; call the image §.", "Translate § so that § lands on §."):
        require(triangle(sp[0], n) == list("ABC") and overline(sp[1], n) == ["A", "B"] and overline(sp[2], n) == ["D", "E"], "Translation of a segment")
        if len(sp) == 4:
            require(triangle(sp[3], n) == ["D", "B1", "C1"], "Image names")
        return Statement([MOTION_SEG])
    if sk == "Rotate § about § until § lands on §.":
        require(triangle(sp[0], n) == list("ABC") and [one(s, n) for s in sp[1:]] == ["D", "B", "E"], "Rotation of B onto E")
        return Statement([ROTATE_BE])
    if sk == "§ and § are on the same side of line §.":
        line_de(sp[2], n)
        return Statement([SIDE(side_pair(sp[0], sp[1], n), "same")])
    if sk == "§ is across line § from §; reflecting over line § gives §, with § on §'s side.":
        line_de(sp[1], n)
        line_de(sp[3], n)
        require(one(sp[0], n) == "C1" and one(sp[2], n) == "F" and triangle(sp[4], n) == ["D", "B1", "C2"]
                and one(sp[5], n) == "C2" and one(sp[6], n) == "F", "Reflection line")
        return Statement([SIDE("C1", "opp"), REFLECT, SIDE("C2", "same")])
    if sk == "§ is across line § from §; reflect over line §, which swaps § and §, so § is on §'s side.":
        line_de(sp[1], n)
        line_de(sp[3], n)
        require(one(sp[0], n) == "C1" and one(sp[2], n) == "F" and {one(sp[4], n), one(sp[5], n)} == {"D", "E"}
                and one(sp[6], n) == "C2" and one(sp[7], n) == "F", "Reflection said to swap")
        return Statement([SIDE("C1", "opp"), REFLECT_SWAPS, SIDE("C2", "same")])
    if sk == "Reflect over line §, which carries § onto §.":
        line_de(sp[0], n)
        require({one(sp[1], n), one(sp[2], n)} == {"D", "E"}, "Reflection said to move D")
        return Statement([REFLECT_DE])
    if sk == "No reflection is needed, because the triangles are congruent.":
        return Statement([CONG, SIDE("C1", "same")], [("circular", "statement")])
    if sk == "§, so § is on ray §.":
        p, (o, t) = one(sp[1], n), two(sp[2], n)
        return Statement(math_atoms(sp[0], n) + [ONRAY(p, o, t)])
    if sk == "§, so § is also on ray §, and §.":
        p, (o, t) = one(sp[1], n), two(sp[2], n)
        return Statement(math_atoms(sp[0], n) + [ONRAY(p, o, t)] + eqs(sp[3], n))
    if sk == "§, so § is on ray §, and § makes §.":
        p, (o, t) = one(sp[1], n), two(sp[2], n)
        return Statement(math_atoms(sp[0], n) + [ONRAY(p, o, t)] + math_atoms(sp[3], n) + eqs(sp[4], n))
    if sk == "§ and §, so § is on rays § and §.":
        p = one(sp[2], n)
        (o1, t1), (o2, t2) = two(sp[3], n), two(sp[4], n)
        return Statement(math_atoms(sp[0], n) + math_atoms(sp[1], n) + [ONRAY(p, o1, t1), ONRAY(p, o2, t2)])
    if sk == "§ and §.":
        return Statement(math_atoms(sp[0], n) + math_atoms(sp[1], n))
    if sk == "§, so §.":
        return Statement(math_atoms(sp[0], n) + eqs(sp[1], n))
    if sk == "§, because §.":
        why = math_atoms(sp[1], n)
        return Statement(why + eqs(sp[0], n), [("circular", "statement")] if CONG in why else [])
    if sk == "§ is on ray §, so §.":
        p, (o, t) = one(sp[0], n), two(sp[1], n)
        return Statement([ONRAY(p, o, t)] + eqs(sp[2], n))
    if sk == "§.":
        return Statement(eqs(sp[0], n))
    if sk == "Rays § and § meet only at §, so §.":
        require(two(sp[0], n) == ["D", "F"] and two(sp[1], n) == ["E", "F"] and one(sp[2], n) == "F", "Rays DF and EF")
        return Statement([RAYS_MEET] + eqs(sp[3], n))
    if sk == "§ and § are on one side of line §, each § from § and § from §, so §.":
        p = side_pair(sp[0], sp[1], n)
        line_de(sp[2], n)
        (a1, b1), c1, (a2, b2), c2 = two(sp[3], n), one(sp[4], n), two(sp[5], n), one(sp[6], n)
        return Statement([SIDE(p, "same"), LEN(seg(c1, p), seg(a1, b1)), LEN(seg(c2, p), seg(a2, b2))] + eqs(sp[7], n))
    if sk == "The motions take §, §, § to §, §, §, so they map § onto §: §.":
        require([one(s, n) for s in sp[:6]] == list("ABCDEF") and triangle(sp[6], n) == list("ABC") and triangle(sp[7], n) == list("DEF"), "The motions take A, B, C to D, E, F")
        require(math_atoms(sp[8], n) == [CONG], "Concludes the congruence")
        return Statement([MAPS, CONG])
    if sk == "The circles about § and § meet in exactly one point, so §.":
        require({one(sp[0], n), one(sp[1], n)} == {"D", "E"}, "Circles about D and E")
        return Statement([CIRCLES_ONE] + eqs(sp[2], n))
    raise ValueError(f"Unreadable statement {label!r}")


# ======================================================================
# Reasons: text → the inference rules it states

class Reason:
    def __init__(self, caps=(), fails=(), code=""):
        self.caps = frozenset(caps)
        self.fails = list(fails)
        self.code = code


def read_reason(label, n, W):
    names = n.subst()
    exact = {
        "Rigid motions preserve distance, and a ray has exactly one point at a given distance from its endpoint.": Reason({"preserve-dist", "unique-dist"}, code="dist"),
        "Two different lines meet in at most one point.": Reason({"lines"}, code="lines"),
        # Equivalent to the line above (contrapositive), so it justifies the same steps.
        "Two points determine exactly one line.": Reason({"lines"}, code="two-points"),
        "Two circles with different centers meet in at most two points, mirror images across the line through the centers.": Reason({"circles"}, code="circles"),
        "Definition of congruence: a sequence of rigid motions maps one figure onto the other.": Reason({"def"}, code="def"),
        "Corresponding parts of congruent triangles are congruent (CPCTC).": Reason(fails=[("circular-reason", "cpctc")], code="cpctc"),
        "The triangles are congruent, so no reflection is needed.": Reason(fails=[("circular-reason", "assumes")], code="assumes"),
        "A rotation can carry any point onto any other point.": Reason(fails=[("false-reason", "rotation-any-point")], code="rotation-any-point"),
        "A rotation about a point can carry any point onto any other point.": Reason(fails=[("false-reason", "rotation-any-point")], code="rotation-any-point"),
        "Reflections preserve orientation.": Reason(fails=[("false-reason", "reflection-keeps-orientation")]),
        "A dilation can make matching sides the same length.": Reason(fails=[("false-reason", "dilation")]),
        "Once two vertices land on their matches, the third vertex must land on its match.": Reason(fails=[("false-reason", "leap")]),
        "The two triangles look the same size and shape in the figure.": Reason(fails=[("false-reason", "picture")]),
        "Two circles meet in exactly one point.": Reason(fails=[("false-reason", "one-meeting")]),
        "A translation can carry any segment onto any other segment of the same length.": Reason(fails=[("false-reason", "translation-any-segment")]),
        "A reflection swaps the two ends of any segment on its line.": Reason(fails=[("false-reason", "reflection-swaps")]),
        "Rigid motions preserve angle measure, and two different lines meet in at most one point.": Reason({"preserve-ang", "lines"}),
        "Rigid motions preserve angle measure and distance, and a ray has exactly one point at a given distance from its endpoint.": Reason({"preserve-ang", "preserve-dist", "unique-dist"}),
        "Rigid motions preserve angle measure.": Reason({"preserve-ang"}),
    }
    if label in exact:
        return exact[label]
    if matches("A translation can carry $<A>$ to $<D>$; a rotation about $<D>$ fixes $<D>$ and can turn any ray from $<D>$ onto any other.", names, label):
        return Reason({"motion"}, code="tr")
    if matches(r"Rigid motions preserve angle measure, and on one side of line $<D><E>$ just one ray from $<D>$ (or from $<E>$) makes a given angle with $\overline{<D><E>}$.", names, label):
        return Reason({"preserve-ang", "unique-ray"}, code="ang")
    if label == "Translations and rotations preserve orientation, and the two triangles have the same orientation.":
        return Reason({"orient-same"}, code="orSame") if not W.opposite else Reason(fails=[("false-reason", "orientation")])
    if label == "Translations and rotations preserve orientation, which differs here; a reflection fixes its line and swaps the line's two sides.":
        return Reason({"orient-flip", "reflect"}, code="orFlip") if W.opposite else Reason(fails=[("false-reason", "orientation")])
    if re.fullmatch(r"The (SAS|ASA|SSS) congruence criterion\.", label):
        return Reason(fails=[("circular-reason", "criterion")], code="criterion")
    if matches("A reflection over line $<D><E>$ swaps $<D>$ and $<E>$.", names, label):
        return Reason(fails=[("false-reason", "reflection-swaps")])
    if matches("A rotation about $<D>$ can carry any point onto any other point.", names, label):
        # It keeps every point's distance from D.
        return Reason(fails=[("false-reason", "rotation-any-point")], code="rotation-any-point")
    raise ValueError(f"Unreadable reason {label!r}")


def check_line(stmt, reason, avail, W, need_truth=True):
    """(valid, failure codes) of one proof line given the atoms stated above."""
    STATS["linesChecked"] += 1
    K = Known(W.given_atoms | set(avail))
    fails = list(reason.fails) + list(stmt.fails)
    work = False
    for atom in stmt.atoms:
        known = K.has(atom)
        ok, why = derive(atom, reason.caps, K, W)
        fails += why
        # The reason must establish something: a line that only repeats what
        # is stated above (or follows from it by equality chains) is not
        # justified by an unrelated reason.
        work = work or (ok and not known and atom != MAPS)
        if need_truth and not W.true(atom):
            fails.append(("untrue", atom))
        K.add(atom)
    if not work and not fails:
        fails.append(("no-rule", "restates"))
    return not fails, fails


# ======================================================================
# rigid-motion-criterion-proof

PROOF_PROMPT = re.compile(
    r"Use the figure\. Given: (?P<givens>.+?); (?P<orient>\$.+?\$ runs \w+ and \$.+?\$ runs \w+)\. "
    r"Prove (?P<crit>SAS|ASA|SSS) from the definition of congruence: show that a sequence of rigid motions maps "
    r"\$\\triangle (?P<t1>\w{3})\$ onto \$\\triangle (?P<t2>\w{3})\$ with (?P<corr>.+?)\. "
    r"The proof may not cite CPCTC or a congruence criterion\. (?P<task>.+)")
TASKS = {
    "The lines of the proof are shown out of order. Put them in order.": "order",
    "The reasons are shown. Choose the statement for each blank line.": "statements",
    "The statements are shown. Choose the reason for each blank line.": "reasons",
}


class ProofCase:
    def __init__(self, public):
        m = PROOF_PROMPT.fullmatch(public["prompt"])
        require(m, "Proof prompt")
        n = Names(read_correspondence(m["corr"]))
        require(n.points(m["t1"]) == list("ABC") and n.points(m["t2"]) == list("DEF"), "Triangles in correspondence order")
        givens = read_givens(m["givens"], n)
        require(classify(givens) == m["crit"], f"The givens are {classify(givens)}, not {m['crit']}")
        at, els = read_figure(public, n)
        opposite = read_orientation(m["orient"], n, at)
        check_congruent_pair(at)
        check_marks(at, els, givens, n)
        self.W = W = World(n, givens, opposite, at)
        require(near(W.at["B1"], at["E"]) and near(W.at["C2" if opposite else "C1"], at["F"]), "The motions land the triangle")
        r = public["response"]
        require(r["kind"] == "structured-work" and r["layout"] == "proof", "A two-column proof")
        self.task = TASKS.get(m["task"])
        require(self.task is not None, f"Unknown task {m['task']!r}")
        require(r["mode"] == ("order" if self.task == "order" else "fill"), "Mode matches the task")
        banks = {b["id"]: b for b in r["banks"]}
        require(set(banks) == {"statements", "reasons"}, "Statement and reason banks")
        self.stmts = {o["id"]: read_statement(o["label"], n) for o in banks["statements"]["options"]}
        labels = [o["label"] for o in banks["statements"]["options"]]
        require(len(set(labels)) == len(labels), "Statements are distinct")
        self.reasons = {o["id"]: read_reason(o["label"], n, W) for o in banks["reasons"]["options"]}
        rlabels = [o["label"] for o in banks["reasons"]["options"]]
        require(len(set(rlabels)) == len(rlabels), "Reasons are distinct")
        goals = [o["id"] for o in banks["statements"]["options"] if o["label"] == r.get("goal")]
        require(len(goals) == 1 and self.stmts[goals[0]].atoms[-1] == CONG, "The goal is the congruence statement")
        self.goal = goals[0]
        self.rows = r["rows"]
        require(len(self.rows) <= 6, "At most six lines")
        for row in self.rows:
            require([f["bank"] for f in row["fields"]] == ["statements", "reasons"] and all(f["kind"] == "choice" for f in row["fields"]),
                    "Rows are [statement, reason] choices")
            for f, bank in zip(row["fields"], ("statements", "reasons")):
                require("given" not in f or f["given"] in (self.stmts if bank == "statements" else self.reasons), "Given cells name bank options")
        self._cache = {}
        self._ideals = None
        self.provable = self.closure()
        require(self.goal in self.provable, "The goal is provable from the givens")

    def atoms_of(self, sids):
        out = set()
        for s in sids:
            out.update(self.stmts[s].atoms)
        return out

    def valid(self, sid, rid, above):
        key = (sid, rid, frozenset(above))
        if key not in self._cache:
            ok, _ = check_line(self.stmts[sid], self.reasons[rid], self.atoms_of(above), self.W)
            self._cache[key] = ok
        return self._cache[key]

    def closure(self, banned=None, within=None):
        pool = set(self.stmts if within is None else within) - {banned}
        known = set()
        changed = True
        while changed:
            changed = False
            for s in sorted(pool - known):
                if any(self.valid(s, r, known) for r in self.reasons):
                    known.add(s)
                    changed = True
        return known

    def ideals(self):
        """Every set of statements that can stand, in some valid order, above
        a line: grown from nothing one valid line at a time."""
        if self._ideals is None:
            family, frontier = {frozenset()}, [frozenset()]
            while frontier:
                X = frontier.pop()
                for t in sorted(self.stmts):
                    Y = X | {t}
                    if t not in X and Y not in family and any(self.valid(t, r, X) for r in self.reasons):
                        family.add(Y)
                        frontier.append(Y)
            self._ideals = family
        return self._ideals

    def proof_ok(self, lines):
        """lines: [(statement id, reason id)] in order; my own validity."""
        seen = []
        for s, r in lines:
            if s in seen or not self.valid(s, r, seen):
                return False
            seen.append(s)
        return bool(lines) and lines[-1][0] == self.goal


def grader_credits(lines, grading):
    """The engine's proof rule, restated: no repeats, every line's claim met
    by lines above, the last line the goal."""
    claims = grading["claims"]
    stated = set()
    for s, r in lines:
        if s in stated:
            return False
        need = claims.get(s, {}).get(r)
        if need is None or not any(all(x in stated for x in alt) for alt in need):
            return False
        stated.add(s)
    return bool(lines) and lines[-1][0] == grading["goal"]


def responses(case):
    """Every complete response for the shown mode: (answer JSON, lines)."""
    rows = case.rows
    if case.task == "order":
        line = {row["id"]: (row["fields"][0]["given"], row["fields"][1]["given"]) for row in rows}
        for order in itertools.permutations([row["id"] for row in rows]):
            yield json.dumps(list(order), separators=(",", ":")), [line[i] for i in order]
        return
    choices = []
    for row in rows:
        cells = []
        for f, bank in zip(row["fields"], (case.stmts, case.reasons)):
            cells.append([(f["given"], "")] if "given" in f else [(x, x) for x in sorted(bank)])
        choices.append(list(itertools.product(*cells)))
    for combo in itertools.product(*choices):
        lines = [(c[0][0], c[1][0]) for c in combo]
        key = [[c[0][1], c[1][1]] for c in combo]
        yield json.dumps(key, separators=(",", ":")), lines


def proof_solution(public):
    case = ProofCase(public)
    mine = sorted(key for key, lines in responses(case) if case.proof_ok(lines))
    require(mine, "Some response is a valid proof")
    if case.task != "order":
        require(len(mine) == 1, f"Exactly one way to fill the blanks, found {len(mine)}: {mine[:4]}")
    return case, mine


def check_claims(case, grading):
    require(grading["mode"] == "proof" and grading["goal"] == case.goal, "Grading names the goal")
    claims = grading["claims"]
    P = case.provable
    for s, by in claims.items():
        require(s in P, f"Claim for a statement the givens do not establish: {s}")
        for r, alts in by.items():
            require(r in case.reasons, f"Claim reason {r} is a bank reason")
            for alt in alts:
                prem = set(alt)
                STATS["claimsChecked"] += 1
                require(prem <= P - {s}, f"Claim {s}/{r} rests on {sorted(prem)}")
                # Whatever can stand above the premises without s.
                supers = [X for X in case.ideals() if prem <= X and s not in X]
                minimal = [X for X in supers if not any(Y < X for Y in supers)]
                require(minimal, f"Claim {s}/{r} needs {sorted(prem)}, which cannot stand above it without it (circular)")
                for X in minimal:
                    require(case.valid(s, r, X), f"Claim {s}/{r} from {sorted(prem)} is not valid (lines above: {sorted(X)})")
    # Completeness: when every statement is shown (order, reasons), every
    # minimal set of shown lines that makes a shown line valid is credited.
    # With blank statements the exhaustive comparison of responses below
    # decides it: a bank decoy can become a true but redundant line once the
    # proof is finished, and only placements the blanks allow matter.
    shown = {row["fields"][0]["given"] for row in case.rows if "given" in row["fields"][0]}
    if len(shown) < len(case.rows):
        return
    for s in sorted(P & shown):
        for r in case.reasons:
            sets = [X for X in case.ideals() if s not in X and X <= shown and case.valid(s, r, X)]
            minimal = [X for X in sets if not any(Y < X for Y in sets)]
            for X in minimal:
                require(any(set(alt) <= X for alt in claims.get(s, {}).get(r, [])),
                        f"{s} by {r} is valid with {sorted(X)} above it, but no claim credits it")


def review_proof(problem):
    public = problem["public"]
    case, mine = proof_solution(public)
    grading = problem["workGrading"]
    check_claims(case, grading)
    credited = sorted(key for key, lines in responses(case) if grader_credits(lines, grading))
    STATS["responsesCompared"] += len(credited)
    require(credited == mine, f"The grading rule credits {len(credited)} responses, the proof has {len(mine)} valid ones; "
                              f"credited only: {sorted(set(credited) - set(mine))[:3]}, missing: {sorted(set(mine) - set(credited))[:3]}")
    answer = problem["answer"]
    require(answer in mine, f"The key {answer} is not a valid proof")
    if case.task == "order":
        shown = [(row["fields"][0]["given"], row["fields"][1]["given"]) for row in case.rows]
        require(not case.proof_ok(shown), "The shown order is not already a valid proof")
    return answer


# ======================================================================
# rigid-motion-criterion-reason

SETUP = re.compile(
    r"\$\\triangle (?P<t1>\w{3})\$ and \$\\triangle (?P<t2>\w{3})\$ have (?P<givens>.+?)\. "
    r"A proof of (?P<crit>SAS|ASA|SSS) by rigid motions translates \$(?P<a>\w)\$ to \$(?P<d>\w)\$ and rotates about \$(?P<d2>\w)\$ "
    r"until the image \$(?P<b1>\w')\$ of \$(?P<b>\w)\$ is on ray \$(?P<de>\w\w)\$; \$(?P<c1>\w')\$ is the image of \$(?P<c>\w)\$\."
    r"(?P<where> After a reflection over line \$(?P<de2>\w\w)\$, the image of \$(?P<c3>\w)\$ is \$(?P<c2>\w'')\$\.)? (?P<question>.+)")
WHICH = re.compile(
    r"A proof translates \$(?P<a>\w)\$ to \$(?P<d>\w)\$ and rotates about \$(?P<d2>\w)\$ until \$(?P<b1>\w')\$ is on ray \$(?P<de>\w\w)\$; "
    r"since \$(?P<given>\w\w=\w\w)\$, \$(?P<b1b>\w')=(?P<e>\w)\$\. (?P<side>.+?) It finishes: (?P<finish>.+) Which criterion does this proof prove\?")

J_TEMPLATES = [
    ("$<D><B1>=<A><B>=<D><E>$ by preserved distance, and only one point of ray $<D><E>$ is that far from $<D>$.", {("pd", "D", "B1", "A", "B"), ("given", "AB"), ("upr", "D", "E")}),
    ("Rigid motions preserve distance, so $<D><B1>=<A><B>$, the length of the side it came from.", {("pd", "D", "B1", "A", "B")}),
    (r"Angle measure is preserved, so $m\angle <D><B1><C1>=m\angle <B>$, and that angle fixes where $<B1>$ is.", {("false", "angle-fixes-point")}),
    ("A rotation about $<D>$ can carry $<B1>$ to any point of ray $<D><E>$, so it can carry it to $<E>$.", {("false", "rotation-slides")}),
    ("The triangles are congruent, so the image of $<B>$ has to land on its match, the point $<E>$.", {("circular",)}),
    ("Translations and rotations keep orientation, and the two triangles run opposite ways round.", {("okept",), ("orient", "opp")}),
    ("Translations and rotations keep orientation, and the two triangles run the same way round.", {("okept",), ("orient", "same")}),
    ("Distance is preserved, so $<C1>$ is exactly as far from line $<D><E>$ as $<C>$ was from line $<A><B>$.", {("dist-to-line",)}),
    ("A rotation reverses orientation while a translation keeps it, so the rotation decided the side.", {("false", "rotation-reverses")}),
    ("The triangles are congruent, so $<C1>$ has to be across line $<D><E>$ from $<F>$.", {("circular",)}),
    ("The triangles are congruent, so $<C1>$ has to be on the same side of line $<D><E>$ as $<F>$.", {("circular",)}),
    (r"Angles are kept and $\angle <A>\cong\angle <D>$; on $<F>$'s side one ray from $<D>$ makes that angle with $\overline{<D><E>}$.", {("pa",), ("given", "A"), ("ur", "D")}),
    (r"Rigid motions preserve angle measure, so $m\angle <E><D><X>=m\angle <A>$ after all of the motions.", {("pa",)}),
    ("Distance is preserved, so $<D><X>=<A><C>$, and that length points the ray from $<D>$ toward $<F>$.", {("pd", "D", "X", "A", "C"), ("false", "length-gives-direction")}),
    ("The triangles are congruent, so ray $<D><X>$ has to lie along its match, which is ray $<D><F>$.", {("circular",)}),
    ("$<D><X>=<A><C>=<D><F>$ by preserved distance; just one point of ray $<D><F>$ is that far from $<D>$.", {("pd", "D", "X", "A", "C"), ("given", "CA"), ("upr", "D", "F")}),
    ("Rigid motions preserve distance, so $<D><X>=<A><C>$, the length of the side it came from.", {("pd", "D", "X", "A", "C")}),
    (r"Angle measure is preserved, so $m\angle <D><X><E>=m\angle <C>$, and that angle fixes where $<X>$ is.", {("false", "angle-fixes-point")}),
    (r"$<X>$ is on ray $<D><F>$, and $<F>$ is the vertex of $\triangle <D><E><F>$ that lies on that ray.", {("vertex-on-ray",)}),
    ("Lines $<D><F>$ and $<E><F>$ are different, so they share at most one point, and $<F>$ is on both.", {("lines",)}),
    ("Two rays from different points always meet, so these two rays meet, and they meet at $<F>$.", {("false", "rays-always-meet")}),
    ("Distance is preserved, so $<D><X>=<A><C>=<D><F>$, and that distance along ray $<D><F>$ ends at $<F>$.", {("pd", "D", "X", "A", "C"), ("given", "CA"), ("upr", "D", "F")}),
    ("Circles about $<D>$ and $<E>$ meet at most twice, in mirror images across $<D><E>$: one per side.", {("circles",)}),
    ("The circles about $<D>$ and $<E>$ meet in exactly one point, so $<X>$ is that point, which is $<F>$.", {("false", "circles-one-point")}),
    ("Rigid motions preserve distance, so $<D><X>=<A><C>$ and $<E><X>=<B><C>$ after all of the motions.", {("pd", "D", "X", "A", "C"), ("pd", "E", "X", "B", "C")}),
    ("The triangles are congruent, so $<X>$ has to land on its match, which is the point $<F>$.", {("circular",)}),
]


def reason_context(public):
    m = SETUP.fullmatch(public["prompt"])
    require(m, "Reason setup")
    t1, t2 = m["t1"], m["t2"]
    letters = {"A": t1[0], "B": t1[1], "C": t1[2], "D": t2[0], "E": t2[1], "F": t2[2]}
    n = Names(letters)
    require([m["a"], m["d"], m["d2"], m["b"], m["c"]] == [letters[r] for r in "ADDBC"] and m["de"] == letters["D"] + letters["E"]
            and m["b1"] == n.text["B1"] and m["c1"] == n.text["C1"], "Setup names the construction's points")
    givens = read_givens(m["givens"], n)
    require(classify(givens) == m["crit"], f"The givens are {classify(givens)}, not {m['crit']}")
    at, els = read_figure(public, n)
    abc, def_ = side_of(at["C"], at["A"], at["B"]), side_of(at["F"], at["D"], at["E"])
    opposite = abc != def_
    check_congruent_pair(at)
    check_marks(at, els, givens, n)
    W = World(n, givens, opposite, at)
    introduced = {n.text["B1"], n.text["C1"]}
    if m["where"]:
        require(m["de2"] == m["de"] and m["c3"] == letters["C"] and m["c2"] == n.text["C2"], "Reflection sentence")
        require(opposite, "A reflection is described only when the triangles run opposite ways")
        introduced.add(n.text["C2"])
    return m, n, W, introduced


def check_names_defined(text, introduced, n):
    for name in re.findall(r"[A-Z]'+", text):
        require(name in introduced, f"{name} is used but never introduced in the prompt")


def justify_answer(public, n, W, question, introduced):
    letters = n.text
    X = letters["C2"] if W.opposite else letters["C1"]
    names = n.subst(X=X)
    q = None
    if matches("Why must $<B1>$ be the point $<E>$, rather than another point of ray $<D><E>$?", names, question):
        q, needs = "be", [{("pd", "D", "B1", "A", "B"), ("given", "AB"), ("upr", "D", "E")}]
    elif matches("Why is $<C1>$ across line $<D><E>$ from $<F>$?", names, question) or matches("Why is $<C1>$ on the same side of line $<D><E>$ as $<F>$?", names, question):
        rel = "opp" if "across" in question else "same"
        require(W.true(SIDE("C1", rel)), "The question's side of line DE is true of the figure")
        q, needs = "or", [{("okept",), ("orient", rel)}]
    elif matches("Why must $<X>$ be on ray $<D><F>$?", names, question):
        q, needs = "ray", [{("pa",), ("given", "A"), ("ur", "D")}]
    elif matches("$<X>$ is on ray $<D><F>$. Why must $<X>$ be $<F>$?", names, question):
        q, needs = "pin-ray", [{("pd", "D", "X", "A", "C"), ("given", "CA"), ("upr", "D", "F")}]
    elif matches("$<X>$ is on ray $<D><F>$ and on ray $<E><F>$. Why must $<X>$ be $<F>$?", names, question):
        q, needs = "pin-rays", [{("lines",)}, {("pd", "D", "X", "A", "C"), ("given", "CA"), ("upr", "D", "F")}]
    elif matches("$<D><X>=<D><F>$, $<E><X>=<E><F>$, and $<X>$ is on $<F>$'s side of line $<D><E>$. Why must $<X>$ be $<F>$?", names, question):
        q, needs = "pin-circles", [{("circles",)}]
    require(q is not None, f"Unreadable question {question!r}")
    check_names_defined(question, introduced, n)
    xrole = "C2" if W.opposite else "C1"
    role_of = {"D": "D", "E": "E", "B1": "B1", "X": xrole, "A": "A", "B": "B", "C": "C", "F": "F"}

    def true(tok):
        k = tok[0]
        if k == "pd":
            p, q2, r, s = (role_of[x] for x in tok[1:])
            return {r, s} <= ORIGINAL and close(W.seglen(seg(p, q2)), W.seglen(seg(r, s)))
        if k == "given":
            return tok[1] in W.givens
        if k == "orient":
            return (tok[1] == "opp") == W.opposite
        if k == "lines":
            return W.noncollinear
        if k in ("upr", "ur", "pa", "okept", "dist-to-line", "vertex-on-ray", "circles"):
            return True
        return False  # false claims and circular reasons

    valid = []
    for o in public["response"]["options"]:
        tokens = [toks for t, toks in J_TEMPLATES if matches(t, names, o["label"])]
        require(len(tokens) == 1, f"Unreadable option {o['label']!r}")
        toks = tokens[0]
        check_names_defined(o["label"], introduced, n)
        STATS["optionsChecked"] += 1
        if all(true(t) for t in toks) and any(need <= toks for need in needs):
            valid.append(o["id"])
    require(len(valid) == 1, f"Exactly one complete justification ({q}), found {valid}")
    return valid[0]


GIVEN_STEPS = [
    ("the line that translates $<A>$ to $<D>$ and rotates about $<D>$ until $<B1>$ is on ray $<D><E>$", lambda c: None),
    ("the line that shows $<B1>=<E>$", lambda c: "AB"),
    ("the line that reflects over line $<D><E>$ because $<C1>$ is across it from $<F>$", lambda c: None),
    ("the line that shows $<C1>$ is on $<F>$'s side of line $<D><E>$", lambda c: None),
    ("the line that puts $<X>$ on ray $<D><F>$", lambda c: "A"),
    ("the line that puts $<X>$ on ray $<E><F>$", lambda c: "B"),
    ("the line that shows $<D><X>=<D><F>$", lambda c: "CA"),
    ("the line that shows $<E><X>=<E><F>$", lambda c: "BC"),
    # The last landing: a length along ray DF (SAS); two rays (ASA) or two
    # circles and a side (SSS) use what earlier lines established.
    ("the line that shows $<X>=<F>$", lambda c: "CA" if c == "SAS" else None),
]


def given_answer(public, n, W, step, crit, introduced):
    X = n.text["C2"] if W.opposite else n.text["C1"]
    names = n.subst(X=X)
    hits = [f for t, f in GIVEN_STEPS if matches(t, names, step)]
    require(len(hits) == 1, f"Unreadable step {step!r}")
    check_names_defined(step, introduced, n)
    want = hits[0](crit)
    require(want is None or want in W.givens, "The step's given is one of the givens")
    valid, labels = [], []
    for o in public["response"]["options"]:
        STATS["optionsChecked"] += 1
        if o["label"] == "No given pair.":
            key = None
        else:
            m = re.fullmatch(r"\$(.+)\$", o["label"])
            require(m, f"Unreadable option {o['label']!r}")
            key = read_given_span(m[1], n)
            require(key in W.givens, "Options name the givens")
        labels.append(key)
        if key == want:
            valid.append(o["id"])
    require(sorted(labels, key=str) == sorted(list(W.givens) + [None], key=str), "Options: the three givens and no given")
    require(len(valid) == 1, "Exactly one option names the given")
    return valid[0]


def reflect_answer(public, n, W):
    names = n.subst()
    c1, f = W.at["C1"], W.at["F"]
    s, sf = side_of(c1, W.at["D"], W.at["E"]), side_of(f, W.at["D"], W.at["E"])
    valid = []
    for o in public["response"]["options"]:
        STATS["optionsChecked"] += 1
        lab = o["label"]
        if matches("On $<F>$'s side of line $<D><E>$, so no reflection over line $<D><E>$ is needed.", names, lab):
            ok = s == sf
        elif matches("Across line $<D><E>$ from $<F>$, so a reflection over line $<D><E>$ is needed.", names, lab):
            ok = s == -sf
        elif matches("On line $<D><E>$ itself, neither on one side nor the other.", names, lab):
            ok = s == 0
        elif lab == "It cannot be known until the figure is measured with a ruler and protractor.":
            ok = False  # orientation decides it
        else:
            raise ValueError(f"Unreadable option {lab!r}")
        if ok:
            valid.append(o["id"])
    require(len(valid) == 1, "Exactly one side of line DE")
    return valid[0]


def which_answer(public):
    m = WHICH.fullmatch(public["prompt"])
    require(m, "Which-criterion prompt")
    side = re.fullmatch(r"\$(?P<c1>\w')\$, the image of \$(?P<c>\w)\$, is on \$(?P<f>\w)\$'s side of line \$(?P<de>\w\w)\$\.", m["side"])
    flip = re.fullmatch(r"Then it reflects over line \$(?P<de>\w\w)\$, so \$(?P<c2>\w'')\$, the image of \$(?P<c>\w)\$, is on \$(?P<f>\w)\$'s side\.", m["side"])
    require(side or flip, "Side sentence")
    sm = side or flip
    letters = {"A": m["a"], "D": m["d"], "B": m["b1"][0], "E": m["e"], "C": sm["c"], "F": sm["f"]}
    n = Names(letters)
    require(m["d2"] == letters["D"] and m["de"] == letters["D"] + letters["E"] and sm["de"] == m["de"] and m["b1b"] == m["b1"], "Construction names")
    require(read_given_span(m["given"], n) == "AB", "B' lands on E by AB = DE")
    at, els = read_figure(public, n)
    check_congruent_pair(at)
    require(not any(e.get("type") in ("tick", "arc") for e in els), "The figure is unmarked")
    opposite = side_of(at["C"], at["A"], at["B"]) != side_of(at["F"], at["D"], at["E"])
    require(bool(flip) == opposite, "The proof reflects exactly when the triangles run opposite ways")
    X = n.text["C2"] if opposite else n.text["C1"]
    if flip:
        require(sm["c2"] == X, "Reflected image name")
    else:
        require(sm["c1"] == X, "Image name")
    names = n.subst(X=X)
    cited = {"AB"}
    facts = set()
    pinned = None
    for sentence in re.split(r"(?<=\.) ", m["finish"]):
        s1 = re.fullmatch(r"Since (?P<g>\$[^$]+\$(?: and \$[^$]+\$)?), \$(?P<x>[^$]+)\$ is on rays? (?P<r>\$\w\w\$(?: and \$\w\w\$)?)\.", sentence)
        s2 = re.fullmatch(r"Since (?P<g>\$[^$]+\$(?: and \$[^$]+\$)?), \$(?P<x>[^$]+)\$ is (?P<d>\$\w\w\$ from \$\w\$(?: and \$\w\w\$ from \$\w\$)?)\.", sentence)
        if s1 or s2:
            g = [read_given_span(x, n) for x in re.findall(r"\$([^$]+)\$", (s1 or s2)["g"])]
            require(n.point((s1 or s2)["x"]) == ("C2" if opposite else "C1"), "The finish pins the image of C")
            cited.update(g)
            if s1:
                rays = [tuple(n.points(x)) for x in re.findall(r"\$(\w\w)\$", s1["r"])]
                # An angle given at D (or E) puts the image on ray DF (or EF).
                require(sorted(rays) == sorted({"A": ("D", "F"), "B": ("E", "F")}[k] for k in g), "Each angle puts the image on its ray")
                facts.update(("ray", r[0]) for r in rays)
            else:
                pairs = re.findall(r"\$(\w\w)\$ from \$(\w)\$", s2["d"])
                got = [(tuple(n.points(a)), n.point(b)) for a, b in pairs]
                require(sorted(got) == sorted({"CA": (("D", "F"), "D"), "BC": (("E", "F"), "E")}[k] for k in g), "Each length puts the image on its circle")
                facts.update(("circle", c) for _, c in got)
            continue
        s3 = re.fullmatch(r"Since \$(?P<g>[^$]+)\$, it is the point of that ray at distance \$(?P<r>\w\w)\$ from \$(?P<o>\w)\$, so \$(?P<x>[^$]+)=(?P<f>\w)\$\.", sentence)
        if s3:
            # "That ray" is the ray the line before put the image on. The cited
            # length AC = DF makes the image DF from D (distance preserved); a
            # ray from D has one point at that distance, and F is it. Complete
            # only if the image is on ray DF and the distance is DF from D.
            g = read_given_span(s3["g"], n)
            o, (p, q) = n.point(s3["o"]), two(s3["r"], n)
            require(n.point(s3["x"]) == ("C2" if opposite else "C1") and n.point(s3["f"]) == "F", "The finish lands the image of C on F")
            cited.add(g)
            if g == "CA":
                facts.add(("circle", "D"))
            pinned = (("ray", "D") in facts and g == "CA" and o == "D" and {p, q} == {"D", "F"})
            continue
        s4 = re.fullmatch(r"Those rays meet only at \$(?P<f>\w)\$, so \$(?P<x>[^$]+)=(?P<f2>\w)\$\.", sentence)
        s5 = re.fullmatch(r"On \$(?P<f>\w)\$'s side only \$(?P<f2>\w)\$ is, so \$(?P<x>[^$]+)=(?P<f3>\w)\$\.", sentence)
        s6 = re.fullmatch(r"So \$(?P<x>[^$]+)=(?P<f>\w)\$\.", sentence)
        for s in (s4, s5, s6):
            if s:
                require(n.point(s["x"]) == ("C2" if opposite else "C1") and all(n.point(v) == "F" for k, v in s.groupdict().items() if k != "x"),
                        "The finish lands the image of C on F")
        if s4:
            pinned = {("ray", "D"), ("ray", "E")} <= facts
            continue
        if s5:
            pinned = {("circle", "D"), ("circle", "E")} <= facts
            continue
        if s6:
            # No uniqueness fact named: complete only if one applies anyway.
            pinned = ({("ray", "D"), ("circle", "D")} <= facts or {("ray", "D"), ("ray", "E")} <= facts
                      or {("circle", "D"), ("circle", "E")} <= facts)
            continue
        raise ValueError(f"Unreadable finish sentence {sentence!r}")
    require(pinned is not None, "The finish concludes")
    expected = classify(frozenset(cited)) if pinned else None
    valid = []
    for o in public["response"]["options"]:
        STATS["optionsChecked"] += 1
        lab = o["label"]
        if lab == "None: the finish has a gap.":
            ok = not pinned
        else:
            require(lab in ("SAS", "ASA", "SSS"), f"Unreadable option {lab!r}")
            ok = pinned and lab == expected
        if ok:
            valid.append(o["id"])
    require(len(valid) == 1, "Exactly one criterion or the gap")
    return valid[0]


def reason_solution(public):
    if public["prompt"].startswith("A proof translates"):
        return which_answer(public)
    m, n, W, introduced = reason_context(public)
    question = m["question"]
    gm = re.fullmatch(r"Which given does (?P<step>.+) use\?", question)
    if gm:
        return given_answer(public, n, W, gm["step"], m["crit"], introduced)
    if question.startswith("Use the figure. After the translation and the rotation, "):
        require(matches("Use the figure. After the translation and the rotation, $<B1>=<E>$. Where is $<C1>$?", n.subst(), question), "Reflect question")
        return reflect_answer(public, n, W)
    return justify_answer(public, n, W, question, introduced)


# ======================================================================
# rigid-motion-criterion-flaw

FLAW_PROMPT = re.compile(
    r"Use the figure\. Given: (?P<givens>.+?); (?P<orient>\$.+?\$ runs \w+ and \$.+?\$ runs \w+)\. "
    r"(?:A student proves (?P<crit>SAS|ASA|SSS) by rigid motions, showing that a sequence of rigid motions maps "
    r"\$\\triangle (?P<t1>\w{3})\$ onto \$\\triangle (?P<t2>\w{3})\$ with (?P<corr>.+?)\. (?P<lines>Line 1: .+) "
    r"Exactly one line is wrong\. Which line, and why\?"
    r"|A student tries to prove \$\\triangle (?P<u1>\w{3})\\cong\\triangle (?P<u2>\w{3})\$ with (?P<corr2>.+?) by rigid motions\. "
    r"(?P<lines2>Line 1: .+) The argument is not valid\. Which line is the first that does not follow, and why\?)")

D_TEMPLATES = [
    (r"a translation cannot turn $\overline{<A><B>}$; it can land $<A>$ on $<D>$, not the whole segment.", ("translation-cannot-turn",)),
    ("a translation does not preserve length, so the image is a different size.", ("false",)),
    ("a rotation about $<D>$ keeps distances from $<D>$; only $<A><B>=<D><E>$ can put $<B1>$ at $<E>$.", ("rotation-keeps-distance",)),
    ("$<B1>$ only reaches ray $<D><E>$ after a reflection over line $<D><E>$.", ("false",)),
    ("rigid motions do not preserve angle measure, so that equation fails.", ("false",)),
    ("rigid motions do not preserve distance, so that equation fails.", ("false",)),
    (r"CPCTC assumes $\triangle <A><B><C>\cong\triangle <D><E><F>$, the very thing being proved.", ("circular-cpctc",)),
    ("a reflection over line $<D><E>$ keeps $<D>$ and $<E>$ in place; it does not swap them.", ("reflection-fixes-line",)),
    ("the triangles have the same orientation, so no reflection is needed.", ("claims-orientation", "same")),
    ("its reason assumes the congruence that the proof is meant to show.", ("circular-reason",)),
    ("a reflection over line $<D><E>$ is still needed before the angle step.", ("claims-orientation", "opp")),
    ("a rotation about $<D>$ moves $<D>$ too, so the image of $<A>$ leaves $<D>$.", ("false",)),
    ("rotations do not preserve distance, so $<D><B1>$ need not equal $<A><B>$.", ("false",)),
    ("a reflection over line $<D><E>$ moves $<D>$ and $<B1>$ off the line.", ("false",)),
    ("which side of line $<D><E>$ holds $<C1>$ cannot be known without measuring.", ("false",)),
    (r"on one side of line $<D><E>$, two rays from $<D>$ can make the same angle with $\overline{<D><E>}$.", ("false",)),
    ("rigid motions preserve angles but not distances, so these lengths can change.", ("false",)),
    ("a ray can hold two different points at the same distance from its endpoint.", ("false",)),
    ("two different lines can cross in two points, so $<X>$ need not be $<F>$.", ("false",)),
    ("two circles can meet in three or more points, so $<X>$ need not be $<F>$.", ("false",)),
    ("it should cite the criterion, not the definition of congruence.", ("false",)),
    ("$<X>$ is on ray $<D><F>$ and on the circle about $<E>$ of radius $<E><F>$, which can meet the ray twice.", ("ray-circle-twice",)),
    ("no given length says how far along ray $<D><E>$ the point $<B1>$ is, so it need not be $<E>$.", ("no-length",)),
    (r"the translation should carry $\overline{<A><B>}$ onto $\overline{<D><E>}$ instead of only $<A>$ onto $<D>$.", ("false",)),
    (r"on $<F>$'s side, more than one ray from $<D>$ makes the angle $m\angle <D>$ with $\overline{<D><E>}$.", ("false",)),
    ("rotations do not preserve distance, so $<B1>$ need not be $<E>$.", ("false",)),
    ("two different lines can meet in more than one point.", ("false",)),
    (r"the angle at $<E>$ cannot be used, because $\angle <C>\cong\angle <F>$ already gives the third angle.", ("false",)),
]

# Which failure of a line each true diagnosis names.
DIAGNOSES = {
    "translation-cannot-turn": lambda f: f in {("false-reason", "translation-any-segment"), ("false", "motion-seg")},
    "rotation-keeps-distance": lambda f: f == ("false-reason", "rotation-any-point"),
    "circular-cpctc": lambda f: f == ("circular-reason", "cpctc"),
    "circular-reason": lambda f: f[0] == "circular-reason",
    "reflection-fixes-line": lambda f: f in {("false-reason", "reflection-swaps"), ("false", "reflect-swaps")},
    "claims-orientation": lambda f: f == ("false-reason", "orientation"),
    "ray-circle-twice": lambda f: f == ("no-rule", "ray-circle"),
    "no-length": lambda f: f == ("no-rule", "ray-no-length"),
}


def split_lines(text):
    parts = re.split(r" (?=Line \d: )", text)
    out = []
    for i, part in enumerate(parts, 1):
        m = re.fullmatch(rf"Line {i}: (.+)", part)
        require(m and m[1].endswith(".)"), f"Line {i} has a statement and a reason")
        body, depth = m[1], 0
        for j in range(len(body) - 1, -1, -1):
            depth += {")": 1, "(": -1}.get(body[j], 0)
            if depth == 0:
                break
        require(j > 1 and body[j - 1] == " ", f"Line {i}: reason in parentheses")
        out.append((body[:j - 1], body[j + 1:-2] + "."))
    return out


def flaw_solution(public):
    m = FLAW_PROMPT.fullmatch(public["prompt"])
    require(m, "Flaw prompt")
    planted = m["lines"] is not None
    n = Names(read_correspondence(m["corr"] if planted else m["corr2"]))
    t1, t2 = (m["t1"], m["t2"]) if planted else (m["u1"], m["u2"])
    require(n.points(t1) == list("ABC") and n.points(t2) == list("DEF"), "Triangles in correspondence order")
    givens = read_givens(m["givens"], n)
    kind = classify(givens)
    if planted:
        require(kind == m["crit"] and kind in ("SAS", "ASA", "SSS"), f"The givens are {kind}, not {m['crit']}")
    else:
        require(kind in ("SSA", "AAA"), f"A non-criterion: {kind}")
    at, els = read_figure(public, n)
    opposite = read_orientation(m["orient"], n, at)
    check_marks(at, els, givens, n)
    W = World(n, givens, opposite, at)
    check_apart(at)
    cstar = "C2" if opposite else "C1"
    dashed = [(tuple(e["from"]), tuple(e["to"])) for e in els if e.get("type") == "segment" and e.get("dash")]
    if kind in ("SAS", "ASA", "SSS"):
        check_congruent_pair(at)
        require(not dashed, "No dashed comparison")
    elif kind == "SSA":
        # AB ≅ DE, BC ≅ EF, ∠A ≅ ∠D hold, AC ≠ DF, and the circle about E of
        # radius EF meets ray DF twice: at F and at the image of C.
        require(all(W.true(a) for a in W.given_atoms), "The SSA givens hold")
        require(not close(W.seglen(seg("A", "C")), W.seglen(seg("D", "F"))), "The SSA triangles differ")
        ab, bc, A = W.seglen(seg("A", "B")), W.seglen(seg("B", "C")), angle(at["A"], at["B"], at["C"])
        require(ab * math.sin(A) < bc < ab and A < math.pi / 2, "Two triangles: AB·sin A < BC < AB with A acute")
        # Spec figure rules that SSA can keep: the two given sides are whole
        # numbers 5–14 at one scale, and both triangles keep every angle in
        # [30°, 110°] (the third side of an SSA pair cannot also be whole).
        require(any(abs(ab / bc - c / a) < 1e-9 for c in range(5, 15) for a in range(5, c)), "AB and BC are whole numbers 5–14 drawn to scale")
        check_angles(at, 30, 110)
        check_angles({"A": at["D"], "B": at["E"], "C": at["F"]}, 30, 110)
        meets = ray_circle(at["D"], at["F"], at["E"], W.seglen(seg("E", "F")))
        require(len(meets) == 2 and meets[1] - meets[0] > 0.3, "The circle about E meets ray DF twice")
        P = W.at[cstar]
        require(on_ray(P, at["D"], at["F"]) and close(dist(at["E"], P), W.seglen(seg("E", "F"))) and dist(P, at["F"]) > 0.3,
                "The image of C is the second meet")
        ends = {p for s in dashed for p in s}
        require(len(dashed) == 2 and any(near(p, P) for p in ends) and all(any(near(p, q) for q in (at["D"], at["E"], P)) for p in ends),
                "The dashed segments run from D and E to the image of C")
    else:
        require(all(W.true(a) for a in W.given_atoms), "The AAA givens hold")
        k = W.seglen(seg("A", "B")) / W.seglen(seg("D", "E"))
        require(abs(k - 1) > 0.2 and all(close(W.seglen(seg(p, q)) / W.seglen(seg(MATCH[p], MATCH[q])), k) for p, q in SIDES[:3]),
                "A scaled copy")
        tri = [at["D"], W.at["B1"], W.at[cstar]]
        require(len(dashed) == 3 and all(any(near(p, q) for q in tri) for s in dashed for p in s), "The dashed triangle is where the motions carry ABC")
        require(dist(W.at["B1"], at["E"]) > 0.3 and on_ray(W.at["B1"], at["D"], at["E"]), "B' is on ray DE but not at E")
    lines = [(read_statement(s, n), read_reason(r, n, W)) for s, r in split_lines(m["lines"] or m["lines2"])]
    avail, failures = set(), []
    for stmt, reason in lines:
        ok, why = check_line(stmt, reason, avail, W, need_truth=False)
        failures.append(why)
        avail.update(stmt.atoms)
    failing = [i + 1 for i, why in enumerate(failures) if why]
    require(failing, "Some line does not follow")
    if planted:
        require(len(failing) == 1, f"Exactly one wrong line, found {failing}")
    target = failing[0]
    X = n.text[cstar]
    names = n.subst(X=X)
    valid = []
    for o in public["response"]["options"]:
        STATS["optionsChecked"] += 1
        lab = o["label"]
        if lab == "No line fails: the triangles only look different because they are drawn in different positions.":
            if not failing:
                valid.append(o["id"])
            continue
        lm = re.fullmatch(r"Line (\d) is wrong: (.+)", lab) or re.fullmatch(r"Line (\d): (.+)", lab)
        require(lm, f"Unreadable option {lab!r}")
        line_no, text = int(lm[1]), lm[2]
        require(1 <= line_no <= len(lines), "The option names a line")
        claims = [c for t, c in D_TEMPLATES if matches(t, names, text)]
        mp = re.fullmatch(r"it uses \$(.+)\$, which is not given\.", text)
        if mp:
            claims.append(("uses-not-given", read_given_span(mp[1], n)))
        mo = re.fullmatch(r"it has to come before line (\d), because line \d uses it\.", text)
        if mo:
            claims.append(("must-precede", int(mo[1])))
        require(len(claims) == 1, f"Unreadable diagnosis {text!r}")
        c = claims[0]
        if c[0] == "false" or line_no != target:
            continue
        why = failures[line_no - 1]
        if c[0] == "uses-not-given":
            ok = c[1] not in W.givens and ("not-given", c[1]) in why
        elif c[0] == "must-precede":
            later = c[1]
            stmt, reason = lines[later - 1]
            before = set().union(*[s.atoms for s, _ in lines[:later - 1]]) if later > 1 else set()
            ok = later < line_no and not check_line(stmt, reason, before - set(lines[line_no - 1][0].atoms), W, False)[0]
        elif c[0] == "translation-cannot-turn":
            ok = not W.true(MOTION_SEG) and any(DIAGNOSES[c[0]](f) for f in why)
        elif c[0] == "rotation-keeps-distance":
            ok = "AB" in W.givens and any(DIAGNOSES[c[0]](f) for f in why)
        elif c[0] == "claims-orientation":
            ok = (c[1] == "opp") == W.opposite and any(DIAGNOSES[c[0]](f) for f in why)
        elif c[0] == "ray-circle-twice":
            ok = len(ray_circle(at["D"], at["F"], at["E"], W.seglen(seg("E", "F")))) == 2 and any(DIAGNOSES[c[0]](f) for f in why)
        elif c[0] == "no-length":
            ok = not any(len(g) == 2 for g in W.givens) and any(DIAGNOSES[c[0]](f) for f in why)
        else:
            ok = any(DIAGNOSES[c[0]](f) for f in why)
        if ok:
            valid.append(o["id"])
    require(len(valid) == 1, f"Exactly one true diagnosis of line {target}, found {valid}")
    return valid[0]


# ======================================================================
# Entry points

def check_choice_options(public):
    r = public["response"]
    require(r["kind"] == "choice" and len(r["options"]) == 4, "Four options")
    labels = [o["label"] for o in r["options"]]
    require(len(set(labels)) == 4, "Options are distinct")
    require(len({o["id"] for o in r["options"]}) == 4, "Option ids are distinct")


def solve(public):
    t = public["templateId"]
    require(t in SUPPORTED, f"Unsupported template {t}")
    if t == PROOF:
        case, mine = proof_solution(public)
        return mine[0] if case.task != "order" else "orders:" + json.dumps(mine, separators=(",", ":"))
    check_choice_options(public)
    return reason_solution(public) if t == REASON else flaw_solution(public)


def review_problem(problem):
    public = problem["public"]
    t = public["templateId"]
    require(t in SUPPORTED, f"Unsupported template {t}")
    STATS["cases"] += 1
    if t == PROOF:
        return review_proof(problem)
    expected = solve(public)
    require(problem.get("answer") in {o["id"] for o in public["response"]["options"]}, "The key is an option")
    return expected


# ======================================================================
# Self-test: hand-built fixtures, and mutations that must be rejected

def _rejects(fn, arg, why):
    try:
        fn(arg)
    except (ValueError, KeyError, TypeError, IndexError, AttributeError, StopIteration):
        return
    raise ValueError(f"Self-test mutation accepted: {why}")


def _pair(sides, turn_deg, shift, flip):
    """△ABC with sides a = BC, b = CA, c = AB (longest scaled to 5) and a
    copy turned, optionally mirrored, to the right."""
    a, b, c = sides
    k = 5 / max(sides)
    cos_a = (b * b + c * c - a * a) / (2 * b * c)
    tri = [(0.0, 0.0), (c * k, 0.0), (b * k * cos_a, b * k * math.sqrt(1 - cos_a * cos_a))]
    t = math.radians(turn_deg)
    copy = [rotate((p[0], -p[1] if flip else p[1]), t) for p in tri]
    dx = max(p[0] for p in tri) - min(p[0] for p in copy) + shift
    copy = [(p[0] + dx, p[1]) for p in copy]
    return dict(zip("ABCDEF", tri + copy))


def _scene(at, letters, marks=(), dashed=()):
    els = [{"id": f"s{p}{q}", "type": "segment", "from": list(at[p]), "to": list(at[q])} for p, q in SIDES]
    els += [{"id": f"x{i}", "type": "segment", "from": list(p), "to": list(q), "dash": True} for i, (p, q) in enumerate(dashed)]
    for kind, where, count in marks:
        for i in range(count):
            if kind == "tick":
                p, q = (at[where[0]], at[where[1]]) if isinstance(where, str) else where
                mid = add(p, mul(sub(q, p), 0.45 + 0.05 * i))
                els.append({"id": f"t{where}{i}", "type": "tick", "at": list(mid), "dir": [0, 1], "length": 9})
            else:
                els.append({"id": f"a{where}{i}", "type": "arc", "center": list(at[where]), "r": 0.5 + 0.1 * i, "from": 0, "to": 30})
    els += [{"id": f"n{r}", "type": "text", "at": list(at[r]), "text": letters[r]} for r in ROLES]
    return {"kind": "scene", "scene": {"v": 1, "title": "Two triangles", "elements": els}}


SAS_MARKS = [("tick", "AB", 1), ("tick", "DE", 1), ("tick", "CA", 2), ("tick", "FD", 2), ("arc", "A", 1), ("arc", "D", 1)]
ASA_MARKS = [("tick", "AB", 1), ("tick", "DE", 1), ("arc", "A", 1), ("arc", "D", 1), ("arc", "B", 2), ("arc", "E", 2)]
ABC = {r: r for r in ROLES}


def _way(at, tri):
    return "counterclockwise" if side_of(at[tri[2]], at[tri[0]], at[tri[1]]) > 0 else "clockwise"


def _proof_fixture():
    """SAS, same orientation, order mode, written out by hand."""
    at = _pair((7, 8, 9), 75, 1.6, False)
    st = {
        "sa": "Translate $\\triangle ABC$ by the vector from $A$ to $D$, then rotate about $D$ until the image of $B$ is on ray $DE$; call the image $\\triangle DB'C'$.",
        "sb": "$DB'=AB=DE$, so $B'=E$.",
        "sc": "$C'$ and $F$ are on the same side of line $DE$.",
        "sd": "$m\\angle EDC'=m\\angle A=m\\angle D$, so $C'$ is on ray $DF$.",
        "se": "$DC'=AC=DF$, so $C'=F$.",
        "sf": "The motions take $A$, $B$, $C$ to $D$, $E$, $F$, so they map $\\triangle ABC$ onto $\\triangle DEF$: $\\triangle ABC\\cong\\triangle DEF$.",
        "sg": "$C'=F$, because $\\triangle ABC\\cong\\triangle DEF$.",
        "sh": "$C'$ is on ray $DF$, so $C'=F$.",
    }
    rs = {
        "ra": "A translation can carry $A$ to $D$; a rotation about $D$ fixes $D$ and can turn any ray from $D$ onto any other.",
        "rb": "Rigid motions preserve distance, and a ray has exactly one point at a given distance from its endpoint.",
        "rc": "Translations and rotations preserve orientation, and the two triangles have the same orientation.",
        "rd": "Rigid motions preserve angle measure, and on one side of line $DE$ just one ray from $D$ (or from $E$) makes a given angle with $\\overline{DE}$.",
        "re": "Definition of congruence: a sequence of rigid motions maps one figure onto the other.",
        "rf": "Corresponding parts of congruent triangles are congruent (CPCTC).",
    }
    path = [("sa", "ra"), ("sb", "rb"), ("sc", "rc"), ("sd", "rd"), ("se", "rb"), ("sf", "re")]
    shown = [path[i] for i in (3, 0, 5, 2, 4, 1)]
    rows = [{"id": f"r{i + 1}", "fields": [{"kind": "choice", "label": "Statement", "bank": "statements", "given": s},
                                           {"kind": "choice", "label": "Reason", "bank": "reasons", "given": r}]} for i, (s, r) in enumerate(shown)]
    row_of = {s: f"r{i + 1}" for i, (s, _) in enumerate(shown)}
    prompt = ("Use the figure. Given: $\\overline{AB}\\cong\\overline{DE}$, $\\angle A\\cong\\angle D$ and $\\overline{CA}\\cong\\overline{FD}$; "
              f"$A\\to B\\to C$ runs {_way(at, 'ABC')} and $D\\to E\\to F$ runs {_way(at, 'DEF')}. Prove SAS from the definition of congruence: "
              "show that a sequence of rigid motions maps $\\triangle ABC$ onto $\\triangle DEF$ with $A\\to D$, $B\\to E$, $C\\to F$. "
              "The proof may not cite CPCTC or a congruence criterion. The lines of the proof are shown out of order. Put them in order.")
    response = {"kind": "structured-work", "label": "Order the proof", "layout": "proof", "mode": "order", "goal": st["sf"],
                "banks": [{"id": "statements", "label": "Statement", "options": [{"id": k, "label": v} for k, v in st.items()]},
                          {"id": "reasons", "label": "Reason", "options": [{"id": k, "label": v} for k, v in rs.items()]}],
                "rows": rows}
    claims = {"sa": {"ra": [[]]}, "sb": {"rb": [["sa"]]}, "sc": {"rc": [["sa"]]}, "sd": {"rd": [["sc"]]},
              "se": {"rb": [["sd"]]}, "sf": {"re": [["sb", "se"]]}}
    public = {"templateId": PROOF, "seed": "fixture", "prompt": prompt, "response": response, "figure": _scene(at, ABC, SAS_MARKS)}
    return {"public": public, "answer": json.dumps([row_of[s] for s, _ in path], separators=(",", ":")),
            "workGrading": {"mode": "proof", "goal": "sf", "claims": claims}}, row_of


def _asa_fill_fixture(ray_only):
    """ASA statements fill: the pin line blank with its reason 'two lines'.
    With the decoy "C' is on ray DF, so C'=F." in the bank, the decoy also
    completes a valid proof (the rays line above holds both rays)."""
    at = _pair((9, 11, 13), 120, 1.6, False)
    st = {
        "sa": "Translate $\\triangle ABC$ by the vector from $A$ to $D$, then rotate about $D$ until the image of $B$ is on ray $DE$; call the image $\\triangle DB'C'$.",
        "sb": "$DB'=AB=DE$, so $B'=E$.",
        "sc": "$C'$ and $F$ are on the same side of line $DE$.",
        "sd": "$m\\angle EDC'=m\\angle A=m\\angle D$ and $m\\angle DEC'=m\\angle B=m\\angle E$, so $C'$ is on rays $DF$ and $EF$.",
        "se": "Rays $DF$ and $EF$ meet only at $F$, so $C'=F$.",
        "sf": "The motions take $A$, $B$, $C$ to $D$, $E$, $F$, so they map $\\triangle ABC$ onto $\\triangle DEF$: $\\triangle ABC\\cong\\triangle DEF$.",
        "sg": "$DC'=AC=DF$, so $C'=F$.",
        "sh": "$C'=F$, because $\\triangle ABC\\cong\\triangle DEF$.",
    }
    if ray_only:
        st["si"] = "$C'$ is on ray $DF$, so $C'=F$."
    rs = {
        "ra": "A translation can carry $A$ to $D$; a rotation about $D$ fixes $D$ and can turn any ray from $D$ onto any other.",
        "rb": "Rigid motions preserve distance, and a ray has exactly one point at a given distance from its endpoint.",
        "rc": "Translations and rotations preserve orientation, and the two triangles have the same orientation.",
        "rd": "Rigid motions preserve angle measure, and on one side of line $DE$ just one ray from $D$ (or from $E$) makes a given angle with $\\overline{DE}$.",
        "re": "Two different lines meet in at most one point.",
        "rf": "Definition of congruence: a sequence of rigid motions maps one figure onto the other.",
    }
    path = [("sa", "ra"), ("sb", "rb"), ("sc", "rc"), ("sd", "rd"), ("se", "re"), ("sf", "rf")]
    blank = {1, 4}
    rows = [{"id": f"r{i + 1}", "fields": [dict({"kind": "choice", "label": "Statement", "bank": "statements"}, **({} if i in blank else {"given": s})),
                                           {"kind": "choice", "label": "Reason", "bank": "reasons", "given": r}]} for i, (s, r) in enumerate(path)]
    prompt = ("Use the figure. Given: $\\overline{AB}\\cong\\overline{DE}$, $\\angle A\\cong\\angle D$ and $\\angle B\\cong\\angle E$; "
              f"$A\\to B\\to C$ runs {_way(at, 'ABC')} and $D\\to E\\to F$ runs {_way(at, 'DEF')}. Prove ASA from the definition of congruence: "
              "show that a sequence of rigid motions maps $\\triangle ABC$ onto $\\triangle DEF$ with $A\\to D$, $B\\to E$, $C\\to F$. "
              "The proof may not cite CPCTC or a congruence criterion. The reasons are shown. Choose the statement for each blank line.")
    response = {"kind": "structured-work", "label": "Your proof", "layout": "proof", "mode": "fill", "goal": st["sf"],
                "banks": [{"id": "statements", "label": "Statement", "options": [{"id": k, "label": v} for k, v in st.items()]},
                          {"id": "reasons", "label": "Reason", "options": [{"id": k, "label": v} for k, v in rs.items()]}],
                "rows": rows}
    claims = {"sa": {"ra": [[]]}, "sb": {"rb": [["sa"]]}, "sc": {"rc": [["sa"]]}, "sd": {"rd": [["sc", "sb"]]},
              "se": {"re": [["sd"]]}, "sf": {"rf": [["sb", "se"]]}}
    answer = json.dumps([[s if i in blank else "", ""] for i, (s, _) in enumerate(path)], separators=(",", ":"))
    public = {"templateId": PROOF, "seed": "fixture", "prompt": prompt, "response": response, "figure": _scene(at, ABC, ASA_MARKS)}
    return {"public": public, "answer": answer, "workGrading": {"mode": "proof", "goal": "sf", "claims": claims}}


def _choice(template, prompt, options, key, figure):
    return {"public": {"templateId": template, "seed": "fixture", "prompt": prompt, "figure": figure,
                       "response": {"kind": "choice", "options": [{"id": f"option-{c}", "label": lab} for c, lab in zip("abcd", options)]}},
            "answer": f"option-{'abcd'[key]}"}


def self_test():
    # --- a proof in order mode
    proof, row_of = _proof_fixture()
    require(review_problem(proof) == proof["answer"], "proof fixture")
    case, mine = proof_solution(proof["public"])
    # The landing of B' may come anywhere after line 1 and before the end.
    require(len(mine) == 4, f"SAS same-orientation orders: {len(mine)}")
    alt = json.loads(proof["answer"])
    alt = [alt[0], alt[2], alt[3], alt[4], alt[1], alt[5]]
    require(json.dumps(alt, separators=(",", ":")) in mine, "B' = E late is a valid order")
    bad = json.loads(json.dumps(proof))
    order = json.loads(bad["answer"])
    order[2], order[3] = order[3], order[2]  # the angle line above the side line
    bad["answer"] = json.dumps(order, separators=(",", ":"))
    _rejects(review_problem, bad, "an out-of-order proof line")
    loose = json.loads(json.dumps(proof))
    loose["workGrading"]["claims"]["sd"]["rd"] = [["sa"]]
    _rejects(review_problem, loose, "the angle line credited before the side of line DE")
    strict = json.loads(json.dumps(proof))
    strict["workGrading"]["claims"]["sb"]["rb"] = [["sa", "sc"]]
    _rejects(review_problem, strict, "B' = E required to follow the side line (a valid order rejected)")
    circular = json.loads(json.dumps(proof))
    circular["workGrading"]["claims"]["sg"] = {"rf": [["se"]]}
    _rejects(review_problem, circular, "a CPCTC line credited")
    false = json.loads(json.dumps(proof))
    for o in false["public"]["response"]["banks"][0]["options"]:
        if o["id"] == "sc":
            o["label"] = "$C'$ is across line $DE$ from $F$; reflecting over line $DE$ gives $\\triangle DB'C''$, with $C''$ on $F$'s side."
    _rejects(review_problem, false, "a false statement in a shown line")
    # "A rotation about D can carry any point onto any other point" is false
    # (a rotation keeps each point's distance from D): in the bank it
    # justifies nothing, and a claim that credits it is rejected.
    spin = json.loads(json.dumps(proof))
    spin["public"]["response"]["banks"][1]["options"].append({"id": "rg", "label": "A rotation about $D$ can carry any point onto any other point."})
    require(review_problem(spin) == spin["answer"], "a free-rotation distractor in the bank")
    spun = json.loads(json.dumps(spin))
    spun["workGrading"]["claims"]["sb"]["rg"] = [["sa"]]
    _rejects(review_problem, spun, "B' = E credited to a free rotation about D")
    moved = json.loads(json.dumps(proof))
    for e in moved["public"]["figure"]["scene"]["elements"]:
        if e.get("text") == "F":
            e["at"] = [e["at"][0] + 0.3, e["at"][1]]
    _rejects(review_problem, moved, "a figure whose givens are false")
    # --- statement fill: unique, and the ray-only decoy is a second valid fill in ASA
    fill = _asa_fill_fixture(False)
    require(review_problem(fill) == fill["answer"], "ASA fill fixture")
    wrong = json.loads(json.dumps(fill))
    wrong["answer"] = wrong["answer"].replace('"se"', '"sg"')
    _rejects(review_problem, wrong, "a phantom-given statement as the key")
    _rejects(review_problem, _asa_fill_fixture(True), "two valid statements for one blank")
    # --- reason: choose the justification
    at = _pair((7, 8, 9), 75, 1.6, False)
    setup = ("$\\triangle ABC$ and $\\triangle DEF$ have $\\overline{AB}\\cong\\overline{DE}$, $\\angle A\\cong\\angle D$ and $\\overline{CA}\\cong\\overline{FD}$. "
             "A proof of SAS by rigid motions translates $A$ to $D$ and rotates about $D$ until the image $B'$ of $B$ is on ray $DE$; $C'$ is the image of $C$. ")
    figure = _scene(at, ABC, SAS_MARKS)
    options = ["$DB'=AB=DE$ by preserved distance, and only one point of ray $DE$ is that far from $D$.",
               "Rigid motions preserve distance, so $DB'=AB$, the length of the side it came from.",
               "A rotation about $D$ can carry $B'$ to any point of ray $DE$, so it can carry it to $E$.",
               "The triangles are congruent, so the image of $B$ has to land on its match, the point $E$."]
    why = _choice(REASON, setup + "Why must $B'$ be the point $E$, rather than another point of ray $DE$?", options, 0, figure)
    require(review_problem(why) == "option-a", "justification fixture")
    require(solve(why["public"]) == "option-a", "justification solve")
    twice = json.loads(json.dumps(why))
    twice["public"]["response"]["options"][3]["label"] = "Distance is preserved, so $DC'=AC=DF$, and that distance along ray $DF$ ends at $F$."
    require(review_problem(twice) == "option-a", "a pin option is not a reason for B' = E")
    wrong = dict(why, answer="option-b")
    require(review_problem(wrong) != wrong["answer"], "an incomplete reason keyed")
    unknown = json.loads(json.dumps(why))
    unknown["public"]["response"]["options"][2]["label"] = "Distance is preserved, so $DB'=AB=DE$, and that distance along ray $DE$ ends at $E$."
    _rejects(review_problem, unknown, "an unknown wording is never guessed")
    # With AC = DF given, the two rays and the length along ray DF both pin C'.
    double = _choice(REASON, setup + "$C'$ is on ray $DF$ and on ray $EF$. Why must $C'$ be $F$?",
                     ["Lines $DF$ and $EF$ are different, so they share at most one point, and $F$ is on both.",
                      "Distance is preserved, so $DC'=AC=DF$, and that distance along ray $DF$ ends at $F$.",
                      "Two rays from different points always meet, so these two rays meet, and they meet at $F$.",
                      "The triangles are congruent, so $C'$ has to land on its match, which is the point $F$."], 0, figure)
    _rejects(review_problem, double, "two valid options")
    # --- reason: reflection, given, which criterion
    reflect = _choice(REASON, setup + "Use the figure. After the translation and the rotation, $B'=E$. Where is $C'$?",
                      ["Across line $DE$ from $F$, so a reflection over line $DE$ is needed.",
                       "On $F$'s side of line $DE$, so no reflection over line $DE$ is needed.",
                       "On line $DE$ itself, neither on one side nor the other.",
                       "It cannot be known until the figure is measured with a ruler and protractor."], 1, figure)
    require(review_problem(reflect) == "option-b", "reflection fixture")
    given = _choice(REASON, setup + "Which given does the line that shows $C'=F$ use?",
                    ["$\\overline{AB}\\cong\\overline{DE}$", "$\\angle A\\cong\\angle D$", "$\\overline{CA}\\cong\\overline{FD}$", "No given pair."], 2, figure)
    require(review_problem(given) == "option-c", "given fixture")
    undefined = json.loads(json.dumps(given))
    undefined["public"]["prompt"] = undefined["public"]["prompt"].replace("$C'=F$", "$C''=F$")
    _rejects(review_problem, undefined, "a point name the prompt never introduces")
    which = _choice(REASON, "A proof translates $A$ to $D$ and rotates about $D$ until $B'$ is on ray $DE$; since $AB=DE$, $B'=E$. "
                    "$C'$, the image of $C$, is on $F$'s side of line $DE$. It finishes: Since $\\angle A\\cong\\angle D$, $C'$ is on ray $DF$. "
                    "So $C'=F$. Which criterion does this proof prove?", ["SAS", "ASA", "SSS", "None: the finish has a gap."], 3, _scene(at, ABC))
    require(review_problem(which) == "option-d", "which fixture (gap)")
    full = json.loads(json.dumps(which))
    full["public"]["prompt"] = full["public"]["prompt"].replace("So $C'=F$.", "Since $AC=DF$, it is the point of that ray at distance $DF$ from $D$, so $C'=F$.")
    full["answer"] = "option-a"
    require(review_problem(full) == "option-a", "which fixture (SAS)")
    # The same words with the distance measured from E pin nothing.
    off = json.loads(json.dumps(full))
    off["public"]["prompt"] = off["public"]["prompt"].replace("at distance $DF$ from $D$", "at distance $DF$ from $E$")
    require(review_problem(off) == "option-d", "a length from the wrong vertex leaves a gap")
    # --- flaw: a planted circular line
    flaw_lines = ("Line 1: Translate $\\triangle ABC$ by the vector from $A$ to $D$, then rotate about $D$ until the image of $B$ is on ray $DE$; call the image $\\triangle DB'C'$. "
                  "(A translation can carry $A$ to $D$; a rotation about $D$ fixes $D$ and can turn any ray from $D$ onto any other.) "
                  "Line 2: $DB'=AB=DE$, so $B'=E$. (Rigid motions preserve distance, and a ray has exactly one point at a given distance from its endpoint.) "
                  "Line 3: $C'$ and $F$ are on the same side of line $DE$. (Translations and rotations preserve orientation, and the two triangles have the same orientation.) "
                  "Line 4: $m\\angle EDC'=m\\angle A=m\\angle D$, so $C'$ is on ray $DF$. (Rigid motions preserve angle measure, and on one side of line $DE$ just one ray from $D$ (or from $E$) makes a given angle with $\\overline{DE}$.) "
                  "Line 5: <LINE5> "
                  "Line 6: The motions take $A$, $B$, $C$ to $D$, $E$, $F$, so they map $\\triangle ABC$ onto $\\triangle DEF$: $\\triangle ABC\\cong\\triangle DEF$. (Definition of congruence: a sequence of rigid motions maps one figure onto the other.)")
    head = ("Use the figure. Given: $\\overline{AB}\\cong\\overline{DE}$, $\\angle A\\cong\\angle D$ and $\\overline{CA}\\cong\\overline{FD}$; "
            f"$A\\to B\\to C$ runs {_way(at, 'ABC')} and $D\\to E\\to F$ runs {_way(at, 'DEF')}. ")
    student = ("A student proves SAS by rigid motions, showing that a sequence of rigid motions maps $\\triangle ABC$ onto $\\triangle DEF$ with "
               "$A\\to D$, $B\\to E$, $C\\to F$. ")
    pin5 = "$DC'=AC=DF$, so $C'=F$. (Rigid motions preserve distance, and a ray has exactly one point at a given distance from its endpoint.)"
    flaw = _choice(FLAW, head + student + flaw_lines.replace("<LINE5>", "$C'=F$. (Corresponding parts of congruent triangles are congruent (CPCTC).)")
                   + " Exactly one line is wrong. Which line, and why?",
                   ["Line 5 is wrong: it has to come before line 4, because line 4 uses it.",
                    "Line 5 is wrong: CPCTC assumes $\\triangle ABC\\cong\\triangle DEF$, the very thing being proved.",
                    "Line 2 is wrong: rotations do not preserve distance, so $DB'$ need not equal $AB$.",
                    "Line 4 is wrong: on one side of line $DE$, two rays from $D$ can make the same angle with $\\overline{DE}$."], 1, figure)
    require(review_problem(flaw) == "option-b", "flaw fixture")
    require(review_problem(dict(flaw, answer="option-a")) != "option-a", "a false diagnosis keyed")
    # --- flaw: B' = E said to come from a rotation about D reaching any point
    free = flaw_lines.replace("<LINE5>", pin5).replace(
        "Line 2: $DB'=AB=DE$, so $B'=E$. (Rigid motions preserve distance, and a ray has exactly one point at a given distance from its endpoint.)",
        "Line 2: $B'=E$. (A rotation about $D$ can carry any point onto any other point.)")
    anyp = _choice(FLAW, head + student + free + " Exactly one line is wrong. Which line, and why?",
                   ["Line 2 is wrong: $B'$ only reaches ray $DE$ after a reflection over line $DE$.",
                    "Line 2 is wrong: a rotation about $D$ keeps distances from $D$; only $AB=DE$ can put $B'$ at $E$.",
                    "Line 6 is wrong: it should cite the criterion, not the definition of congruence.",
                    "Line 1 is wrong: a rotation about $D$ moves $D$ too, so the image of $A$ leaves $D$."], 1, figure)
    require(review_problem(anyp) == "option-b", "free-rotation flaw fixture")
    # With line 2 restored the proof has no wrong line, so no option is right.
    whole = json.loads(json.dumps(anyp))
    whole["public"]["prompt"] = head + student + flaw_lines.replace("<LINE5>", pin5) + " Exactly one line is wrong. Which line, and why?"
    _rejects(review_problem, whole, "a flaw item whose proof has no wrong line")
    # --- flaw: SSA must show two triangles
    c, A_deg = 12.0, 39.0
    h = c * math.sin(math.radians(A_deg))
    a = 8.0
    root = math.sqrt(a * a - h * h)
    near_b, far_b = c * math.cos(math.radians(A_deg)) - root, c * math.cos(math.radians(A_deg)) + root
    k = 5 / max(c, far_b)

    def tri(b):
        return [(0.0, 0.0), (c * k, 0.0), (b * k * math.cos(math.radians(A_deg)), b * k * math.sin(math.radians(A_deg)))]

    t1, t2 = tri(far_b), [rotate(p, math.radians(60)) for p in tri(near_b)]
    shift = max(p[0] for p in t1) - min(p[0] for p in t2) + 1.6
    ssa_at = dict(zip("ABCDEF", t1 + [(p[0] + shift, p[1]) for p in t2]))
    image = construct(ssa_at)["C1"]
    ssa_marks = [("tick", "AB", 1), ("tick", "DE", 1), ("tick", "BC", 2), ("tick", "EF", 2), ("arc", "A", 1), ("arc", "D", 1)]
    ssa_fig = _scene(ssa_at, ABC, ssa_marks, dashed=[(ssa_at["E"], image), (ssa_at["D"], image)])
    ssa_lines = ("Line 1: Translate $\\triangle ABC$ by the vector from $A$ to $D$, then rotate about $D$ until the image of $B$ is on ray $DE$; call the image $\\triangle DB'C'$. "
                 "(A translation can carry $A$ to $D$; a rotation about $D$ fixes $D$ and can turn any ray from $D$ onto any other.) "
                 "Line 2: $DB'=AB=DE$, so $B'=E$. (Rigid motions preserve distance, and a ray has exactly one point at a given distance from its endpoint.) "
                 "Line 3: $C'$ and $F$ are on the same side of line $DE$. (Translations and rotations preserve orientation, and the two triangles have the same orientation.) "
                 "Line 4: $m\\angle EDC'=m\\angle A=m\\angle D$, so $C'$ is on ray $DF$. (Rigid motions preserve angle measure, and on one side of line $DE$ just one ray from $D$ (or from $E$) makes a given angle with $\\overline{DE}$.) "
                 "Line 5: $EC'=BC=EF$, so $C'=F$. (Rigid motions preserve distance, and a ray has exactly one point at a given distance from its endpoint.) "
                 "Line 6: The motions take $A$, $B$, $C$ to $D$, $E$, $F$, so they map $\\triangle ABC$ onto $\\triangle DEF$: $\\triangle ABC\\cong\\triangle DEF$. (Definition of congruence: a sequence of rigid motions maps one figure onto the other.)")
    ssa = _choice(FLAW, "Use the figure. Given: $\\overline{AB}\\cong\\overline{DE}$, $\\overline{BC}\\cong\\overline{EF}$ and $\\angle A\\cong\\angle D$; "
                  f"$A\\to B\\to C$ runs {_way(ssa_at, 'ABC')} and $D\\to E\\to F$ runs {_way(ssa_at, 'DEF')}. A student tries to prove $\\triangle ABC\\cong\\triangle DEF$ with "
                  "$A\\to D$, $B\\to E$, $C\\to F$ by rigid motions. " + ssa_lines + " The argument is not valid. Which line is the first that does not follow, and why?",
                  ["Line 2: rotations do not preserve distance, so $B'$ need not be $E$.",
                   "Line 5: $C'$ is on ray $DF$ and on the circle about $E$ of radius $EF$, which can meet the ray twice.",
                   "Line 4: on $F$'s side, more than one ray from $D$ makes the angle $m\\angle D$ with $\\overline{DE}$.",
                   "No line fails: the triangles only look different because they are drawn in different positions."], 1, ssa_fig)
    require(review_problem(ssa) == "option-b", "SSA fixture")
    one_meet = json.loads(json.dumps(ssa))
    for e in one_meet["public"]["figure"]["scene"]["elements"]:
        if e.get("text") == "C":
            e["at"] = list(add(tuple(e["at"]), (0.0, 1.5)))
    _rejects(review_problem, one_meet, "an SSA figure whose givens fail")
    return {"fixtures": 13, "mutations": 16}
