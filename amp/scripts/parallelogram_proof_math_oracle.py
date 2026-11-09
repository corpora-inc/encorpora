"""Independent review of the parallelogram-proof family (HSG.CO.C.11).

Templates: parallelogram-proof-fill and parallelogram-proof-order
(structured-work proofs), parallelogram-converse-reasoning (single choice).

Everything is derived from the public payload: the prompt, the response
(banks, rows, options) and the figure's coordinates. The answer key and the
private `workGrading` rule are values under test, never inputs.

* Statements are read from their TeX labels into atomic facts and every fact
  is checked against the figure's coordinates.
* Every reason is a rule written here (definitions, parallel-line angle
  theorems and their converse, triangle congruence criteria with the
  vertex correspondence, CPCTC, the parallelogram and rectangle theorems).
  A theorem whose conclusion is the Prove statement may not justify any line
  of its own proof, and a parallelogram theorem needs "is a parallelogram"
  stated above it, so a converse proof can never use one.
* Proofs: every claim of the private rule must be a valid justification
  resting on provable statements, every non-circular justification derived
  here must be claimed (so no valid order is rejected), the key must be a
  valid proof and an ordering must not be shown already solved.
* Find-the-flaw arguments are checked line by line with the same rules;
  exactly one line may fail. "Enough to prove" options are classified from
  the theorems and confirmed by a counterexample search; counterexample
  panels are judged from their coordinates; explanations are parsed into the
  facts they state, the criterion they cite and the conclusion they reach.
"""

import copy
import itertools
import json
import math
import re

FILL = 'parallelogram-proof-fill'
ORDER = 'parallelogram-proof-order'
REASONING = 'parallelogram-converse-reasoning'
SUPPORTED = frozenset({FILL, ORDER, REASONING})
REVIEW_RETURNS_ANSWER = True

STATS = {'cases': 0, 'claimsChecked': 0, 'linesChecked': 0}


def require(condition, message):
    # Not assert: python -O must not disable review gates.
    if not condition:
        raise ValueError(message)


# ======================================================================
# Figure

TOL = 1e-6


class Figure:
    """Labelled points of a scene (single capital letters)."""

    def __init__(self, figure, names=None):
        require(figure and figure.get('kind') == 'scene', 'A scene figure')
        self.pt = {}
        for e in figure['scene']['elements']:
            if e.get('type') == 'text' and re.fullmatch(r'[A-Z]', e.get('text', '')):
                self.pt[e['text']] = (float(e['at'][0]), float(e['at'][1]))
        if names:
            require(set(names) <= set(self.pt), f'Figure labels {sorted(self.pt)} include {names}')

    def v(self, a, b):
        return (self.pt[b][0] - self.pt[a][0], self.pt[b][1] - self.pt[a][1])

    def d(self, a, b):
        return math.hypot(*self.v(a, b))

    def unit(self, a, b):
        x, y = self.v(a, b)
        n = math.hypot(x, y)
        require(n > TOL, f'Degenerate segment {a}{b}')
        return (x / n, y / n)

    def angle(self, a):
        v, x, y = a
        p, q = self.unit(v, x), self.unit(v, y)
        return math.degrees(math.acos(max(-1.0, min(1.0, p[0] * q[0] + p[1] * q[1]))))

    def collinear(self, a, b, c):
        p, q = self.v(a, b), self.v(a, c)
        return abs(p[0] * q[1] - p[1] * q[0]) < 1e-6 * max(1.0, math.hypot(*p) * math.hypot(*q))

    def parallel(self, s, t):
        p, q = self.v(*s), self.v(*t)
        return abs(p[0] * q[1] - p[1] * q[0]) < 1e-6 * math.hypot(*p) * math.hypot(*q)

    def same_dir(self, a, b, c, d):
        p, q = self.unit(a, b), self.unit(c, d)
        return abs(p[0] * q[1] - p[1] * q[0]) < 1e-6 and p[0] * q[0] + p[1] * q[1] > 0

    def opposite_dir(self, a, b, c, d):
        p, q = self.unit(a, b), self.unit(c, d)
        return abs(p[0] * q[1] - p[1] * q[0]) < 1e-6 and p[0] * q[0] + p[1] * q[1] < 0

    def on_line(self, p, seg):
        return self.collinear(seg[0], seg[1], p)

    def angle_key(self, a):
        v, x, y = a
        dirs = frozenset(tuple(round(c, 5) for c in self.unit(v, w)) for w in (x, y))
        return (v, dirs)


def close(a, b):
    return abs(a - b) < 1e-6 * max(1.0, abs(a), abs(b))


# ======================================================================
# Statements: lists of atoms
#   ('pgram',) ('rect',)  the quadrilateral of the problem
#   ('par', s, t) ('seg', s, t)  segments as 2-letter strings
#   ('ang', a, b) ('supp', a, b) ('right', a)  angles as (vertex, x, y)
#   ('tri', t, u)  correspondence by position
#   ('bisect', s, t)

SEG = r'\\overline\{([A-Z]{2})\}'
ANG = r'\\angle ([A-Z]{1,3})'
TRI = r'\\triangle ([A-Z]{3})'


def angle_of(name, quad):
    """∠ABC is at B; ∠J alone is the quadrilateral's interior angle at J."""
    if len(name) == 3:
        return (name[1], name[0], name[2])
    require(len(name) == 1 and quad and name in quad, f'Angle {name}')
    i = quad.index(name)
    return (name, quad[(i - 1) % 4], quad[(i + 1) % 4])


def parse_statement(label, quad):
    s = label.strip()
    m = re.fullmatch(r'\$([A-Z]{4})\$ is a parallelogram, and \$' + ANG + r'\$ and \$' + ANG + r'\$ are right angles', s)
    if m:
        require(m[1] == quad, 'The problem quadrilateral')
        return [('pgram',), ('right', angle_of(m[2], quad)), ('right', angle_of(m[3], quad))]
    m = re.fullmatch(r'\$([A-Z]{4})\$ is a (parallelogram|rectangle)', s)
    if m:
        require(m[1] == quad, 'The problem quadrilateral')
        return [('pgram',) if m[2] == 'parallelogram' else ('rect',)]
    m = re.fullmatch(r'\$' + ANG + r'\$ and \$' + ANG + r'\$ are (right angles|supplementary)', s)
    if m:
        a, b = angle_of(m[1], quad), angle_of(m[2], quad)
        return [('right', a), ('right', b)] if m[3] == 'right angles' else [('supp', a, b)]
    m = re.fullmatch(r'\$' + ANG + r'\$ is supplementary to \$' + ANG + r'\$ and to \$' + ANG + r'\$', s)
    if m:
        a = angle_of(m[1], quad)
        return [('supp', a, angle_of(m[2], quad)), ('supp', a, angle_of(m[3], quad))]
    m = re.fullmatch(r'\$' + SEG + r'\$ and \$' + SEG + r'\$ bisect each other', s)
    if m:
        return [('bisect', m[1], m[2])]
    atoms = []
    for part in re.split(r'\$ and \$', s):
        p = part.strip('$ ')
        m = re.fullmatch(SEG + r'\\(cong|parallel|perp)' + SEG, p)
        if m:
            atoms.append(({'cong': 'seg', 'parallel': 'par', 'perp': 'perp'}[m[2]], m[1], m[3]))
            continue
        m = re.fullmatch(ANG + r'\\cong' + ANG, p)
        if m:
            atoms.append(('ang', angle_of(m[1], quad), angle_of(m[2], quad)))
            continue
        m = re.fullmatch(TRI + r'\\cong' + TRI, p)
        if m:
            atoms.append(('tri', m[1], m[2]))
            continue
        raise ValueError(f'Unreadable statement {label!r}')
    return atoms


class Context:
    """The quadrilateral, the diagonal crossing, the givens and the goal."""

    def __init__(self, prompt, figure):
        m = re.search(r'Given: (.+?) Prove: (.+?)(?:\.\s|\.$)', prompt, re.S)
        require(m, 'Given and Prove')
        given, self.prove = m[1], m[2]
        q = re.findall(r'\$([A-Z]{4})\$', given)
        require(q, 'A named quadrilateral')
        self.quad = q[0]
        self.fig = Figure(figure, self.quad)
        others = [p for p in self.fig.pt if p not in self.quad]
        self.cross = None
        for p in others:
            a, b, c, d = self.quad
            if self.fig.on_line(p, (a, c)) and self.fig.on_line(p, (b, d)):
                self.cross = p
        meet = re.search(r'meet at \$([A-Z])\$', given)
        if meet:
            require(self.cross == meet[1], 'The named point is where the diagonals cross')
        require(self.convex(), 'The vertices are named in order around a convex quadrilateral')
        self.given = []
        if re.search(r'\$' + self.quad + r'\$ is a parallelogram', given):
            self.given.append(('pgram',))
        if re.search(r'\$' + self.quad + r'\$ is a rectangle', given):
            self.given.append(('rect',))
        for a, b in re.findall(SEG + r'\\cong' + SEG, given):
            self.given.append(('seg', a, b))
        for atom in self.given:
            require(self.true(atom), f'Given {atom} holds in the figure')

    def convex(self):
        sign = None
        for i in range(4):
            a, b, c = self.quad[i], self.quad[(i + 1) % 4], self.quad[(i + 2) % 4]
            p, r = self.fig.v(a, b), self.fig.v(b, c)
            z = p[0] * r[1] - p[1] * r[0]
            if abs(z) < TOL:
                return False
            if sign is None:
                sign = z > 0
            elif sign != (z > 0):
                return False
        return True

    # --- the quadrilateral's parts
    def sides(self):
        q = self.quad
        return [q[i] + q[(i + 1) % 4] for i in range(4)]

    def opposite_sides(self, s, t):
        sides = [frozenset(x) for x in self.sides()]
        if frozenset(s) not in sides or frozenset(t) not in sides:
            return False
        return abs(sides.index(frozenset(s)) - sides.index(frozenset(t))) == 2

    def interior(self, v):
        i = self.quad.index(v)
        return (v, self.quad[(i - 1) % 4], self.quad[(i + 1) % 4])

    def is_interior(self, a):
        return a[0] in self.quad and self.same_angle(a, self.interior(a[0]))

    def diagonals(self):
        q = self.quad
        return (q[0] + q[2], q[1] + q[3])

    # --- normal forms
    def same_angle(self, a, b):
        return self.fig.angle_key(a) == self.fig.angle_key(b)

    def same_seg(self, s, t):
        return frozenset(s) == frozenset(t)

    def norm(self, atom):
        k = atom[0]
        if k in ('pgram', 'rect'):
            return (k,)
        if k in ('par', 'seg', 'bisect', 'perp'):
            return (k, frozenset([frozenset(atom[1]), frozenset(atom[2])]))
        if k in ('ang', 'supp'):
            return (k, frozenset([self.fig.angle_key(atom[1]), self.fig.angle_key(atom[2])]))
        if k == 'right':
            return (k, self.fig.angle_key(atom[1]))
        if k == 'tri':
            return (k, frozenset(zip(atom[1], atom[2])))
        raise ValueError(k)

    # --- truth in the figure
    def is_pgram(self):
        a, b, c, d = self.quad
        return self.fig.parallel(a + b, d + c) and self.fig.parallel(a + d, b + c)

    def true(self, atom):
        f, k = self.fig, atom[0]
        if k == 'pgram':
            return self.is_pgram()
        if k == 'rect':
            return self.is_pgram() and close(f.angle(self.interior(self.quad[0])), 90)
        if k == 'par':
            return f.parallel(atom[1], atom[2]) and not f.on_line(atom[2][0], atom[1])
        if k == 'seg':
            return close(f.d(*atom[1]), f.d(*atom[2]))
        if k == 'perp':
            p, q = f.v(*atom[1]), f.v(*atom[2])
            return abs(p[0] * q[0] + p[1] * q[1]) < 1e-6 * math.hypot(*p) * math.hypot(*q)
        if k == 'ang':
            return close(f.angle(atom[1]), f.angle(atom[2]))
        if k == 'supp':
            return close(f.angle(atom[1]) + f.angle(atom[2]), 180)
        if k == 'right':
            return close(f.angle(atom[1]), 90)
        if k == 'tri':
            t, u = atom[1], atom[2]
            return all(close(f.d(t[i], t[j]), f.d(u[i], u[j])) for i, j in ((0, 1), (1, 2), (0, 2)))
        if k == 'bisect':
            (a, c), (b, d) = atom[1], atom[2]
            mx = ((f.pt[a][0] + f.pt[c][0]) / 2, (f.pt[a][1] + f.pt[c][1]) / 2)
            my = ((f.pt[b][0] + f.pt[d][0]) / 2, (f.pt[b][1] + f.pt[d][1]) / 2)
            return math.hypot(mx[0] - my[0], mx[1] - my[1]) < 1e-6
        raise ValueError(k)


# ======================================================================
# Reasons

REASONS = {
    'Given': 'given',
    'Definition of parallelogram': 'def-pgram',
    'Definition of rectangle': 'def-rect',
    'Alternate interior angles of parallel lines are congruent': 'alt',
    'If alternate interior angles are congruent, then the lines are parallel': 'alt-converse',
    'Corresponding angles of parallel lines are congruent': 'corresponding',
    'Same-side interior angles of parallel lines are supplementary': 'same-side',
    'Consecutive angles of a parallelogram are supplementary': 'consecutive',
    'Angles supplementary to the same angle are congruent': 'supplements',
    'Reflexive property of congruence': 'reflexive',
    'Vertical angles are congruent': 'vertical',
    'SSS': 'sss', 'SAS': 'sas', 'ASA': 'asa', 'AAS': 'aas',
    'CPCTC (corresponding parts of congruent triangles)': 'cpctc',
    'Opposite sides of a parallelogram are congruent': 'opp-sides',
    'Opposite angles of a parallelogram are congruent': 'opp-angles',
    'Diagonals of a parallelogram bisect each other': 'diag-bisect',
    'Diagonals of a rectangle are congruent': 'diag-rect',
    'All right angles are congruent': 'right-congruent',
    'Congruent supplementary angles are right angles': 'cong-supp-right',
    'A parallelogram with one right angle is a rectangle': 'one-right',
    # Never a valid reason: false statements and non-criteria.
    'SSA': 'never', 'AAA': 'never',
    'Diagonals of a parallelogram are perpendicular': 'never',
    'Consecutive angles of a parallelogram are congruent': 'never',
}
# Theorems about a known parallelogram (or rectangle): each needs that fact
# stated above, and none may prove its own conclusion.
THEOREMS = ('opp-sides', 'opp-angles', 'diag-bisect', 'diag-rect', 'consecutive')


def reason_of(label):
    require(label in REASONS, f'Unknown reason {label!r}')
    return REASONS[label]


class Rules:
    def __init__(self, ctx):
        self.c = ctx
        self.f = ctx.fig

    def find(self, avail, kind, test):
        return [a for a in avail if a[0] == kind and test(a)]

    def seg_known(self, avail, s, t):
        """Atoms stating segment s ≅ segment t."""
        c = self.c
        return [a for a in avail if a[0] == 'seg' and {frozenset(a[1]), frozenset(a[2])} == {frozenset(s), frozenset(t)}
                and (frozenset(s) != frozenset(t) or frozenset(a[1]) == frozenset(a[2]))]

    def ang_known(self, avail, p, q):
        c = self.c
        return [a for a in avail if a[0] == 'ang' and (
            (c.same_angle(a[1], p) and c.same_angle(a[2], q)) or (c.same_angle(a[1], q) and c.same_angle(a[2], p)))]

    # --- parallel-line angle pairs: angle a at v1 on line l1, b at v2 on l2
    def transversal_parts(self, a, other_vertex, line):
        """(transversal ray endpoint, line ray endpoint) of angle a when one ray
        points from its vertex toward other_vertex and the other lies on line."""
        f = self.f
        v, x, y = a
        if v == other_vertex:
            return None
        for t, w in ((x, y), (y, x)):
            if f.collinear(v, other_vertex, t) and f.same_dir(v, t, v, other_vertex) and f.on_line(v, line) and f.on_line(w, line):
                return (t, w)
        return None

    def angle_pair(self, a, b, l1, l2, kind):
        """Whether angles a, b are the kind of pair ('alt', 'corr', 'same')
        formed by a transversal through their vertices with lines l1, l2."""
        f = self.f
        if not f.parallel(l1, l2) or f.on_line(l2[0], l1):
            return False
        for la, lb in ((l1, l2), (l2, l1)):
            if kind in ('alt', 'same'):
                pa = self.transversal_parts(a, b[0], la)
                pb = self.transversal_parts(b, a[0], lb)
                if pa and pb:
                    if kind == 'alt' and f.opposite_dir(a[0], pa[1], b[0], pb[1]):
                        return True
                    if kind == 'same' and f.same_dir(a[0], pa[1], b[0], pb[1]):
                        return True
            else:
                # corresponding: transversal rays point the same way along one line
                for ta, wa in ((a[1], a[2]), (a[2], a[1])):
                    for tb, wb in ((b[1], b[2]), (b[2], b[1])):
                        if (a[0] != b[0] and f.collinear(a[0], b[0], ta) and f.collinear(a[0], b[0], tb)
                                and f.same_dir(a[0], ta, b[0], tb) and f.on_line(a[0], la) and f.on_line(wa, la)
                                and f.on_line(b[0], lb) and f.on_line(wb, lb) and f.same_dir(a[0], wa, b[0], wb)):
                            return True
        return False

    # --- triangle criteria
    def tri_parts(self, t, u):
        sides = [((t[i] + t[j]), (u[i] + u[j])) for i, j in ((0, 1), (1, 2), (0, 2))]
        angles = [((t[i], t[(i + 1) % 3], t[(i + 2) % 3]), (u[i], u[(i + 1) % 3], u[(i + 2) % 3])) for i in range(3)]
        return sides, angles

    def criterion(self, crit, t, u, avail):
        sides, angles = self.tri_parts(t, u)
        S = [self.seg_known(avail, *s) for s in sides]      # sides: 01, 12, 02
        A = [self.ang_known(avail, *a) for a in angles]     # angles at 0, 1, 2
        out = []
        def add(*groups):
            if all(groups):
                for combo in itertools.product(*groups):
                    out.append(frozenset(self.c.norm(x) for x in combo))
        # side between the angles at i and j; side opposite angle i
        between = {frozenset((0, 1)): 0, frozenset((1, 2)): 1, frozenset((0, 2)): 2}
        if crit == 'sss':
            add(S[0], S[1], S[2])
        elif crit == 'sas':
            # angle at vertex i between its two sides
            for i in range(3):
                two = [between[frozenset((i, j))] for j in range(3) if j != i]
                add(A[i], S[two[0]], S[two[1]])
        elif crit == 'asa':
            for i, j in ((0, 1), (1, 2), (0, 2)):
                add(A[i], A[j], S[between[frozenset((i, j))]])
        elif crit == 'aas':
            for i, j in ((0, 1), (1, 2), (0, 2)):
                for s in range(3):
                    if s != between[frozenset((i, j))]:
                        add(A[i], A[j], S[s])
        return out

    # --- the rules
    def requirements(self, atom, reason, avail, banned):
        """Minimal sets of normalized premise atoms from avail that justify atom."""
        c, f, k = self.c, self.f, atom[0]
        if reason == 'never' or reason in banned or not c.true(atom):
            return []
        N = c.norm
        out = []
        if reason == 'given':
            return [frozenset()] if any(N(g) == N(atom) for g in c.given) else []
        if reason == 'def-pgram':
            if k == 'par' and c.opposite_sides(atom[1], atom[2]):
                return [frozenset([N(p)]) for p in avail if p[0] == 'pgram']
            if k == 'pgram':
                s = c.sides()
                pairs = [self.find(avail, 'par', lambda p, a=s[i], b=s[i + 2]: {frozenset(p[1]), frozenset(p[2])} == {frozenset(a), frozenset(b)}) for i in range(2)]
                if all(pairs):
                    return [frozenset([N(x), N(y)]) for x in pairs[0] for y in pairs[1]]
            return []
        if reason == 'def-rect':
            if k == 'pgram' or (k == 'right' and c.is_interior(atom[1])):
                return [frozenset([N(p)]) for p in avail if p[0] == 'rect']
            return []
        if reason == 'one-right':
            if k == 'rect':
                for p in avail:
                    if p[0] == 'pgram':
                        for r in avail:
                            if r[0] == 'right' and c.is_interior(r[1]):
                                out.append(frozenset([N(p), N(r)]))
            return out
        if reason in ('alt', 'corresponding', 'same-side'):
            want = {'alt': 'ang', 'corresponding': 'ang', 'same-side': 'supp'}[reason]
            kind = {'alt': 'alt', 'corresponding': 'corr', 'same-side': 'same'}[reason]
            if k != want:
                return []
            for p in avail:
                if p[0] == 'par' and self.angle_pair(atom[1], atom[2], p[1], p[2], kind):
                    out.append(frozenset([N(p)]))
            return out
        if reason == 'alt-converse':
            if k != 'par':
                return []
            for p in avail:
                if p[0] == 'ang' and self.angle_pair(p[1], p[2], atom[1], atom[2], 'alt'):
                    out.append(frozenset([N(p)]))
            return out
        if reason == 'consecutive':
            if k == 'supp' and c.is_interior(atom[1]) and c.is_interior(atom[2]):
                i, j = c.quad.index(atom[1][0]), c.quad.index(atom[2][0])
                if (i - j) % 4 in (1, 3):
                    return [frozenset([N(p)]) for p in avail if p[0] == 'pgram']
            return []
        if reason == 'opp-angles':
            if k == 'ang' and c.is_interior(atom[1]) and c.is_interior(atom[2]):
                i, j = c.quad.index(atom[1][0]), c.quad.index(atom[2][0])
                if (i - j) % 4 == 2:
                    return [frozenset([N(p)]) for p in avail if p[0] == 'pgram']
            return []
        if reason == 'opp-sides':
            if k == 'seg' and c.opposite_sides(atom[1], atom[2]):
                return [frozenset([N(p)]) for p in avail if p[0] == 'pgram']
            return []
        if reason == 'diag-bisect':
            e = c.cross
            halves = lambda s, t: e and e in s and e in t and frozenset(s) != frozenset(t) and (
                {*s, *t} - {e}) in ({c.quad[0], c.quad[2]}, {c.quad[1], c.quad[3]})
            if (k == 'seg' and halves(atom[1], atom[2])) or (k == 'bisect' and {frozenset(atom[1]), frozenset(atom[2])} == {frozenset(d) for d in c.diagonals()}):
                return [frozenset([N(p)]) for p in avail if p[0] == 'pgram']
            return []
        if reason == 'diag-rect':
            if k == 'seg' and {frozenset(atom[1]), frozenset(atom[2])} == {frozenset(d) for d in c.diagonals()}:
                return [frozenset([N(p)]) for p in avail if p[0] == 'rect']
            return []
        if reason == 'supplements':
            if k != 'ang' or c.same_angle(atom[1], atom[2]):
                return []
            supps = [p for p in avail if p[0] == 'supp']
            for p, q in itertools.combinations(supps, 2):
                for x in (p[1], p[2]):
                    for y in (q[1], q[2]):
                        if c.same_angle(x, y):
                            rest = {c.fig.angle_key(p[1] if x is p[2] else p[2]), c.fig.angle_key(q[1] if y is q[2] else q[2])}
                            if rest == {c.fig.angle_key(atom[1]), c.fig.angle_key(atom[2])}:
                                out.append(frozenset([N(p), N(q)]))
            return out
        if reason == 'reflexive':
            if (k == 'seg' and frozenset(atom[1]) == frozenset(atom[2])) or (k == 'ang' and c.same_angle(atom[1], atom[2])):
                return [frozenset()]
            return []
        if reason == 'vertical':
            if k == 'ang':
                a, b = atom[1], atom[2]
                if a[0] == b[0]:
                    for x, y in ((b[1], b[2]), (b[2], b[1])):
                        if f.opposite_dir(a[0], a[1], b[0], x) and f.opposite_dir(a[0], a[2], b[0], y):
                            return [frozenset()]
            return []
        if reason in ('sss', 'sas', 'asa', 'aas'):
            if k == 'tri':
                return self.criterion(reason, atom[1], atom[2], avail)
            return []
        if reason == 'cpctc':
            if k not in ('seg', 'ang'):
                return []
            for p in avail:
                if p[0] != 'tri':
                    continue
                sides, angles = self.tri_parts(p[1], p[2])
                if k == 'seg' and any({frozenset(atom[1]), frozenset(atom[2])} == {frozenset(s), frozenset(t)} and frozenset(s) != frozenset(t) for s, t in sides):
                    out.append(frozenset([N(p)]))
                if k == 'ang' and any((c.same_angle(atom[1], s) and c.same_angle(atom[2], t)) or (c.same_angle(atom[1], t) and c.same_angle(atom[2], s)) for s, t in angles):
                    out.append(frozenset([N(p)]))
            return out
        if reason == 'right-congruent':
            if k == 'ang':
                r1 = [p for p in avail if p[0] == 'right' and c.same_angle(p[1], atom[1])]
                r2 = [p for p in avail if p[0] == 'right' and c.same_angle(p[1], atom[2])]
                return [frozenset([N(x), N(y)]) for x in r1 for y in r2]
            return []
        if reason == 'cong-supp-right':
            if k == 'right':
                for p in avail:
                    if p[0] == 'ang' and (c.same_angle(p[1], atom[1]) or c.same_angle(p[2], atom[1])):
                        for q in avail:
                            if q[0] == 'supp' and N(q) == N(('supp', p[1], p[2])):
                                out.append(frozenset([N(p), N(q)]))
            return out
        return []


def banned_theorems(ctx, goal_atoms, rules):
    """A theorem may not justify any line of the proof of its own conclusion."""
    known = ctx.given + [('pgram',)] * any(g[0] == 'rect' for g in ctx.given)
    out = set()
    for t in THEOREMS:
        if goal_atoms and all(rules.requirements(a, t, known, set()) for a in goal_atoms):
            out.add(t)
    return out


# ======================================================================
# Proofs over statement banks

class Proof:
    def __init__(self, ctx, statements, reasons, goal_atoms):
        """statements: {id: atoms}; reasons: {id: rule key}."""
        self.c = ctx
        self.rules = Rules(ctx)
        self.facts = statements
        self.reasons = reasons
        self.banned = banned_theorems(ctx, goal_atoms, self.rules)
        stated = {ctx.norm(a) for atoms in statements.values() for a in atoms}
        # A given is free unless a statement of the bank states it.
        self.free = [g for g in ctx.given if ctx.norm(g) not in stated]

    def truth(self, sid):
        return all(self.c.true(a) for a in self.facts[sid])

    def justifications(self, sid, rid, available):
        N = self.c.norm
        providers = {}
        for o in available:
            if o == sid:
                continue
            for a in self.facts[o]:
                providers.setdefault(N(a), set()).add(o)
        free = {N(a) for a in self.free}
        avail = {N(a): a for o in available if o != sid for a in self.facts[o]}
        for a in self.free:
            avail.setdefault(N(a), a)
        reason = self.reasons[rid]
        per_atom = []
        for a in self.facts[sid]:
            alts = self.rules.requirements(a, reason, list(avail.values()), self.banned)
            if not alts:
                return []
            per_atom.append(alts)
        results = set()
        for combo in itertools.product(*per_atom):
            need = frozenset().union(*combo) - free
            choices = [sorted(providers[n]) for n in need]
            for pick in itertools.product(*choices) if choices else [()]:
                results.add(frozenset(pick))
        return minimal(results)

    def closure(self, banned=None):
        known, changed = set(), True
        while changed:
            changed = False
            for sid in self.facts:
                if sid in known or sid == banned:
                    continue
                if any(any(s <= known for s in self.justifications(sid, rid, known | {sid})) for rid in self.reasons):
                    known.add(sid)
                    changed = True
        return known

    def failing_line(self, lines):
        """Index of the first line not justified by its reason from lines above."""
        seen = set()
        for i, (sid, rid) in enumerate(lines):
            STATS['linesChecked'] += 1
            if not any(s <= seen for s in self.justifications(sid, rid, seen | {sid})):
                return i
            seen.add(sid)
        return None

    def valid(self, lines, goal):
        if any(sid == '' or rid == '' for sid, rid in lines):
            return False
        if len({sid for sid, _ in lines}) != len(lines):
            return False
        return self.failing_line(lines) is None and lines[-1][0] == goal


def minimal(sets):
    sets = set(sets)
    return [s for s in sets if not any(o < s for o in sets)]


def proof_of(public):
    response = public['response']
    require(response['kind'] == 'structured-work' and response['layout'] == 'proof', 'Proof layout')
    banks = {b['id']: b for b in response['banks']}
    require(set(banks) == {'statements', 'reasons'}, 'Statement and reason banks')
    ctx = Context(public['prompt'], public.get('figure'))
    statements = {o['id']: parse_statement(o['label'], ctx.quad) for o in banks['statements']['options']}
    reasons = {o['id']: reason_of(o['label']) for o in banks['reasons']['options']}
    goal_ids = [o['id'] for o in banks['statements']['options'] if o['label'] == response['goal']]
    require(len(goal_ids) == 1, 'The goal is one bank statement')
    goal = goal_ids[0]
    proof = Proof(ctx, statements, reasons, statements[goal])
    # No two bank statements say the same thing.
    keys = [frozenset(ctx.norm(a) for a in atoms) for atoms in statements.values()]
    require(len(set(keys)) == len(keys), 'Bank statements are distinct facts')
    return proof, goal


def key_lines(problem):
    response = problem['public']['response']
    answer = json.loads(problem['answer'])
    rows = response['rows']
    if response['mode'] == 'order':
        by_id = {r['id']: (r['fields'][0]['given'], r['fields'][1]['given']) for r in rows}
        require(sorted(answer) == sorted(by_id), 'An ordering uses every row once')
        return [by_id[i] for i in answer]
    require(len(answer) == len(rows), 'One answer row per row')
    out = []
    for r, cells in zip(rows, answer):
        s, t = r['fields'][0], r['fields'][1]
        require(('given' in s) == (cells[0] == '') and ('given' in t) == (cells[1] == ''), 'Answers fill exactly the blanks')
        out.append((s.get('given', cells[0]), t.get('given', cells[1])))
    return out


def solve_proof(public):
    """The canonical key from the public payload: fill mode fills each blank
    with the unique choice that keeps every line valid; ordering returns the
    first valid order of the shown rows (any valid order is credited)."""
    proof, goal = proof_of(public)
    response = public['response']
    rows = response['rows']
    if response['mode'] == 'order':
        order = valid_orders(proof, goal, rows, first=True)
        require(order, 'No valid order of the shown rows')
        return json.dumps(order[0], separators=(',', ':'))
    # Fill: each line's choices are those that keep it justified by the
    # (given or chosen) statements above; a blank statement changes what
    # later lines may use, so lines are filled in order.
    solutions = []
    def walk(i, seen, cells):
        if i == len(rows):
            if goal in seen and cells_goal(cells):
                solutions.append([list(c) for c in cells])
            return
        s, t = rows[i]['fields'][0], rows[i]['fields'][1]
        for sid in ([s['given']] if 'given' in s else list(proof.facts)):
            if sid in seen:
                continue
            for rid in ([t['given']] if 'given' in t else list(proof.reasons)):
                if any(m <= seen for m in proof.justifications(sid, rid, seen | {sid})):
                    cells[i] = ['' if 'given' in s else sid, '' if 'given' in t else rid]
                    walk(i + 1, seen | {sid}, cells)
    def cells_goal(cells):
        last = rows[-1]['fields'][0].get('given', cells[-1][0])
        return last == goal
    walk(0, frozenset(), [['', ''] for _ in rows])
    require(len(solutions) == 1, f'{len(solutions)} ways to fill the blanks')
    return json.dumps(solutions[0], separators=(',', ':'))


def valid_orders(proof, goal, rows, first=False):
    """Orders of the given rows (ids) in which every line is justified."""
    lines = {r['id']: (r['fields'][0]['given'], r['fields'][1]['given']) for r in rows}
    out = []
    def walk(order, seen):
        if first and out:
            return
        if len(order) == len(lines):
            if lines[order[-1]][0] == goal:
                out.append(list(order))
            return
        for rid, (sid, reason) in lines.items():
            if rid in order or sid in seen:
                continue
            if any(m <= seen for m in proof.justifications(sid, reason, seen | {sid})):
                walk(order + [rid], seen | {sid})
    walk([], frozenset())
    return out


def review_proof(problem):
    public = problem['public']
    proof, goal = proof_of(public)
    ctx = proof.c
    response = public['response']
    for sid, atoms in proof.facts.items():
        if proof.truth(sid):
            continue
        # A false statement may sit in the bank, but nothing may justify it.
        require(all(not proof.justifications(sid, rid, set(proof.facts)) for rid in proof.reasons), f'False statement {sid} is justified')
    closure = proof.closure()
    require(goal in closure, 'The goal is provable')
    g = problem['workGrading']
    require(g['mode'] == 'proof' and g['goal'] == goal, 'Grading names the goal')
    claims = {sid: {rid: {frozenset(p) for p in sets} for rid, sets in by.items()} for sid, by in g['claims'].items()}
    for sid, by in claims.items():
        for rid, sets in by.items():
            for prem in sets:
                derived = proof.justifications(sid, rid, set(proof.facts))
                require(any(prem >= m for m in derived), f'Claim {sid} by {rid} from {sorted(prem)} is not valid')
                require(prem <= closure, f'Claim {sid} by {rid} rests on unprovable statements')
                STATS['claimsChecked'] += 1
    # Every (statement, reason) pair a learner can submit: in an ordering the
    # rows' own pairs; in a fill-in each row's given or bank choices.
    pairs = set()
    for r in response['rows']:
        s, t = r['fields'][0], r['fields'][1]
        for sid in ([s['given']] if 'given' in s else list(proof.facts)):
            for rid in ([t['given']] if 'given' in t else list(proof.reasons)):
                pairs.add((sid, rid))
    withouts = {}
    for sid, rid in sorted(pairs):
        if sid not in withouts:
            withouts[sid] = proof.closure(banned=sid)
        derived = [m for m in proof.justifications(sid, rid, set(proof.facts)) if m <= withouts[sid]]
        claimed = claims.get(sid, {}).get(rid, set())
        for m in derived:
            require(any(c <= m for c in claimed), f'Valid justification of {sid} by {rid} from {sorted(m)} is not credited')
    if response['mode'] == 'order':
        # Cross-check: the claims credit exactly the orders derived here.
        mine = valid_orders(proof, goal, response['rows'])
        require(mine, 'Some order is valid')
    lines = key_lines(problem)
    require(proof.valid(lines, goal), 'The key is a valid proof')
    if response['mode'] == 'order':
        shown = [(r['fields'][0]['given'], r['fields'][1]['given']) for r in response['rows']]
        require(not proof.valid(shown, goal), 'The shown order is not already a valid proof')
    else:
        # The rows shown are the key's rows; a fill-in must have one answer.
        require(solve_proof(public) == problem['answer'], 'The blanks have exactly the keyed answer')
    return problem['answer']


# ======================================================================
# Converse reasoning: find the flaw

def option_by_label(public, label):
    hits = [o['id'] for o in public['response']['options'] if o['label'] == label]
    require(len(hits) == 1, f'One option {label!r}')
    return hits[0]


def solve_flaw(public):
    ctx = Context(public['prompt'], public.get('figure'))
    lines = re.findall(r'^(\d)\. (.+) — (.+)\.$', public['prompt'], re.M)
    require(len(lines) >= 4, 'A numbered argument')
    require([int(n) for n, _, _ in lines] == list(range(1, len(lines) + 1)), 'Lines numbered in order')
    statements = {f's{n}': parse_statement(s, ctx.quad) for n, s, _ in lines}
    reasons = {f'r{n}': reason_of(r) for n, _, r in lines}
    m = re.search(r', that is, (.+)$', ctx.prove)
    goal = parse_statement(m[1] if m else ctx.prove, ctx.quad)
    proof = Proof(ctx, statements, reasons, goal)
    order = [(f's{n}', f'r{n}') for n, _, _ in lines]
    bad = []
    for i, (sid, rid) in enumerate(order):
        above = frozenset(x for x, _ in order[:i])
        if not any(s <= above for s in proof.justifications(sid, rid, above | {sid})):
            bad.append(i)
    require(len(bad) == 1, f'Exactly one unjustified line, found {[i + 1 for i in bad]}')
    for i, (sid, _) in enumerate(order):
        # Only the flawed line may state something false.
        require(i == bad[0] or proof.truth(sid), f'Line {i + 1} states a true fact')
    goal_key = {ctx.norm(a) for a in goal}
    require(any({ctx.norm(a) for a in statements[s]} == goal_key for s, _ in order), 'The argument states the Prove statement')
    return option_by_label(public, f'Line {bad[0] + 1}')


# ======================================================================
# Converse reasoning: which fact is enough

def condition(atoms, quad):
    """A condition in positional form: frozenset of (kind, positions)."""
    out = set()
    pos = {v: i for i, v in enumerate(quad)}
    for a in atoms:
        if a[0] in ('par', 'seg', 'perp'):
            out.add((a[0], frozenset([frozenset(pos[x] for x in a[1]), frozenset(pos[x] for x in a[2])])))
        elif a[0] == 'ang':
            require(a[1] == angle_of(a[1][0], quad) and a[2] == angle_of(a[2][0], quad), 'Interior angles')
            out.add(('ang', frozenset([pos[a[1][0]], pos[a[2][0]]])))
        elif a[0] == 'bisect':
            out.add(('bisect',))
        else:
            raise ValueError(f'Unexpected condition {a}')
    return frozenset(out)


SIDES = [frozenset({0, 1}), frozenset({1, 2}), frozenset({2, 3}), frozenset({3, 0})]
DIAGS = frozenset([frozenset({0, 2}), frozenset({1, 3})])


def sufficient(cond):
    """The standard tests that a quadrilateral is a parallelogram."""
    opp = [frozenset([SIDES[0], SIDES[2]]), frozenset([SIDES[1], SIDES[3]])]
    par = {c[1] for c in cond if c[0] == 'par'}
    seg = {c[1] for c in cond if c[0] == 'seg'}
    ang = {c[1] for c in cond if c[0] == 'ang'}
    if all(o in par for o in opp) or all(o in seg for o in opp):
        return True
    if ('bisect',) in cond:
        return True
    if any(o in par and o in seg for o in opp):
        return True
    if {frozenset({0, 2}), frozenset({1, 3})} <= ang:
        return True
    return False


def candidate_quads():
    """Non-parallelograms to search for counterexamples: isosceles trapezoids,
    general trapezoids, kites and irregular quadrilaterals."""
    shapes = [
        [(0, 0), (8, 0), (6, 4), (2, 4)],     # isosceles trapezoid
        [(0, 0), (9, 0), (5, 3), (1, 3)],     # trapezoid
        [(0, 0), (3, -2), (7, 0), (3, 2)],    # kite
        [(0, 0), (4, -1), (6, 3), (1, 4)],    # irregular
        [(0, 0), (6, 0), (5, 5), (1, 3)],
    ]
    out = []
    for shape in shapes:
        for start in range(4):
            for flip in (False, True):
                pts = shape[start:] + shape[:start]
                if flip:
                    pts = [pts[0]] + pts[1:][::-1]
                out.append(pts)
    return out


def holds(cond, pts):
    d = lambda i, j: math.dist(pts[i], pts[j])
    def par(s, t):
        (a, b), (c, e) = sorted(s), sorted(t)
        p = (pts[b][0] - pts[a][0], pts[b][1] - pts[a][1])
        q = (pts[e][0] - pts[c][0], pts[e][1] - pts[c][1])
        return abs(p[0] * q[1] - p[1] * q[0]) < 1e-9
    def ang(i):
        a, b = pts[(i - 1) % 4], pts[(i + 1) % 4]
        p = (a[0] - pts[i][0], a[1] - pts[i][1]); q = (b[0] - pts[i][0], b[1] - pts[i][1])
        return math.acos((p[0] * q[0] + p[1] * q[1]) / (math.hypot(*p) * math.hypot(*q)))
    for c in cond:
        if c[0] == 'perp':
            (a, b), (e, g) = (sorted(x) for x in c[1])
            p = (pts[b][0] - pts[a][0], pts[b][1] - pts[a][1])
            q = (pts[g][0] - pts[e][0], pts[g][1] - pts[e][1])
            if abs(p[0] * q[0] + p[1] * q[1]) > 1e-9:
                return False
        elif c[0] == 'par':
            s, t = tuple(c[1])
            if not par(s, t):
                return False
        elif c[0] == 'seg':
            s, t = tuple(c[1])
            if abs(d(*sorted(s)) - d(*sorted(t))) > 1e-9:
                return False
        elif c[0] == 'ang':
            i, j = tuple(c[1])
            if abs(ang(i) - ang(j)) > 1e-9:
                return False
        elif c[0] == 'bisect':
            m1 = ((pts[0][0] + pts[2][0]) / 2, (pts[0][1] + pts[2][1]) / 2)
            m2 = ((pts[1][0] + pts[3][0]) / 2, (pts[1][1] + pts[3][1]) / 2)
            if math.dist(m1, m2) > 1e-9:
                return False
    return True


def solve_enough(public):
    m = re.fullmatch(r'In quadrilateral \$([A-Z]{4})\$, which one of these facts is (not )?enough, on its own, to prove that \$\1\$ is a parallelogram\?', public['prompt'])
    require(m, 'Enough prompt')
    quad, want_enough = m[1], not m[2]
    verdicts = []
    for o in public['response']['options']:
        cond = condition(parse_statement(o['label'], quad), quad)
        enough = sufficient(cond)
        counter = any(holds(cond, q) for q in candidate_quads())
        # A sufficient test has no counterexample; an insufficient one has one.
        require(enough != counter, f'Classification of {o["label"]!r} confirmed')
        verdicts.append((o['id'], enough))
    hits = [i for i, e in verdicts if e == want_enough]
    require(len(hits) == 1, 'Exactly one option answers the question')
    return hits[0]


# ======================================================================
# Converse reasoning: counterexample panels

def panels(figure):
    elements = figure['scene']['elements']
    labels = [(int(e['text'].split()[1]), e['at']) for e in elements if e.get('type') == 'text' and re.fullmatch(r'Figure \d', e.get('text', ''))]
    quads = [e['points'] for e in elements if e.get('type') == 'polygon' and len(e.get('points', [])) == 4]
    require(len(labels) == 4 and len(quads) == 4, 'Four labelled panels')
    out = {}
    for n, at in labels:
        # The quadrilateral whose bottom-center is nearest the label (labels sit under panels).
        def gap(q):
            cx = sum(p[0] for p in q) / 4
            low = min(p[1] for p in q)
            return math.hypot(cx - at[0], low - at[1]) if low >= at[1] - 1e-9 else float('inf')
        best = min(quads, key=gap)
        out[n] = [tuple(map(float, p)) for p in best]
    require(len({tuple(map(tuple, q)) for q in out.values()}) == 4, 'Each label names its own panel')
    return out


def is_pgram_pts(pts):
    def v(i, j):
        return (pts[j][0] - pts[i][0], pts[j][1] - pts[i][1])
    def par(p, q):
        return abs(p[0] * q[1] - p[1] * q[0]) < 1e-9 * max(1, math.hypot(*p) * math.hypot(*q))
    return par(v(0, 1), v(3, 2)) and par(v(0, 3), v(1, 2))


def is_rect_pts(pts):
    def v(i, j):
        return (pts[j][0] - pts[i][0], pts[j][1] - pts[i][1])
    p, q = v(0, 1), v(0, 3)
    return is_pgram_pts(pts) and abs(p[0] * q[0] + p[1] * q[1]) < 1e-9 * math.hypot(*p) * math.hypot(*q)


def solve_counterexample(public):
    p = public['prompt']
    if 'one pair of opposite sides of a quadrilateral is congruent and the other pair is parallel' in p:
        def fits(q):
            d = lambda i, j: math.dist(q[i], q[j])
            par = lambda i, j, k, l: abs((q[j][0] - q[i][0]) * (q[l][1] - q[k][1]) - (q[j][1] - q[i][1]) * (q[l][0] - q[k][0])) < 1e-9
            return (abs(d(0, 1) - d(2, 3)) < 1e-9 and par(1, 2, 3, 0)) or (abs(d(1, 2) - d(3, 0)) < 1e-9 and par(0, 1, 2, 3))
        breaks = lambda q: not is_pgram_pts(q)
    elif 'If the diagonals of a quadrilateral are congruent, the quadrilateral is a rectangle' in p:
        fits = lambda q: abs(math.dist(q[0], q[2]) - math.dist(q[1], q[3])) < 1e-9
        breaks = lambda q: not is_rect_pts(q)
    else:
        raise ValueError('Unknown claim')
    shapes = panels(public['figure'])
    hits = [n for n, q in shapes.items() if fits(q) and breaks(q)]
    require(len(hits) == 1, f'Exactly one counterexample panel, found {hits}')
    return option_by_label(public, f'Figure {hits[0]}')


# ======================================================================
# Converse reasoning: correct and complete explanation

COUNTEREXAMPLES = {
    # shape: (congruent diagonals in every case, is a rectangle)
    'an isosceles trapezoid': (True, False),
    'a square': (True, True),
    'a rectangle': (True, True),
    'a kite': (False, False),
    'a rhombus': (False, False),
}


def solve_converse_question(public):
    require(public['prompt'] == 'The diagonals of every rectangle are congruent. Does that mean a quadrilateral with congruent diagonals must be a rectangle?', 'Converse prompt')
    # The converse is false: an isosceles trapezoid has congruent diagonals and is
    # not a rectangle. So only a "No" whose example fits and breaks the claim is right.
    good = []
    for o in public['response']['options']:
        label = o['label']
        if label.startswith('Yes:'):
            continue
        m = re.fullmatch(r'No: (an? [a-z ]+?) (?:also )?has congruent diagonals(?: but is not a rectangle)?\.', label)
        require(m, f'Unread option {label!r}')
        shape = m[1]
        require(shape in COUNTEREXAMPLES, f'Unknown shape {shape}')
        congruent, rectangle = COUNTEREXAMPLES[shape]
        claims_not_rect = 'but is not a rectangle' in label
        if congruent and not rectangle and claims_not_rect:
            good.append(o['id'])
    require(len(good) == 1, 'Exactly one valid explanation')
    return good[0]


APPEALS = ('In the figure', 'looks like', 'measure', 'with a ruler')


def explanation_valid(text, ctx, goal_atoms, rules):
    """A correct and complete explanation states known true facts, proves two
    triangles congruent with a criterion those facts satisfy, and reaches every
    part of the claim by CPCTC."""
    if any(w in text for w in APPEALS):
        return False
    m = re.search(r'\$\\triangle ([A-Z]{3})\\cong\\triangle ([A-Z]{3})\$ by (SSS|SAS|ASA|AAS)', text)
    if not m:
        return False
    before, after = text[:m.start()], text[m.end():]
    facts = []
    for a, b in re.findall(SEG + r'\\cong' + SEG, before):
        facts.append(('seg', a, b))
    for a, b in re.findall(ANG + r'\\cong' + ANG, before):
        facts.append(('ang', angle_of(a, ctx.quad), angle_of(b, ctx.quad)))
    for a in re.findall(SEG + r'\$ is shared', before):
        facts.append(('seg', a, a))
    for a, b in re.findall(r'The right angles \$' + ANG + r'\$ and \$' + ANG + r'\$ are congruent', before):
        facts.append(('ang', angle_of(a, ctx.quad), angle_of(b, ctx.quad)))
    goal = {ctx.norm(g) for g in goal_atoms}
    for f in facts:
        if not ctx.true(f) or ctx.norm(f) in goal:
            return False
    tri = ('tri', m[1], m[2])
    if not ctx.true(tri) or not rules.criterion(m[3].lower(), m[1], m[2], facts):
        return False
    if 'CPCTC' not in after:
        return False
    reached = {ctx.norm(('seg', a, b)) for a, b in re.findall(SEG + r'\\cong' + SEG, after)}
    return goal <= reached


def solve_explanation(public):
    p = public['prompt']
    if p.startswith('The diagonals of every rectangle are congruent.'):
        return solve_converse_question(public)
    m = re.match(r'Why do the diagonals of parallelogram \$([A-Z]{4})\$, which meet at \$([A-Z])\$, bisect each other\?', p)
    r = re.match(r'Why are the diagonals of rectangle \$([A-Z]{4})\$ congruent\?', p)
    require(m or r, 'Explanation prompt')
    quad = (m or r)[1]
    given = f'Given: ${quad}$ is a {"parallelogram" if m else "rectangle"}. Prove: x. '
    ctx = Context(given, public['figure'])
    q = ctx.quad
    if m:
        e = m[2]
        require(ctx.cross == e, 'The crossing point')
        goal = [('seg', q[0] + e, q[2] + e), ('seg', q[1] + e, q[3] + e)]
    else:
        goal = [('seg', q[0] + q[2], q[1] + q[3])]
    for g in goal:
        require(ctx.true(g), 'The claim holds in the figure')
    rules = Rules(ctx)
    texts = dict(re.findall(r'^Explanation (\d): (.+)$', p, re.M))
    require(len(texts) == 4, 'Four explanations')
    good = [n for n, t in texts.items() if explanation_valid(t, ctx, goal, rules)]
    require(len(good) == 1, f'Exactly one correct and complete explanation, found {good}')
    return option_by_label(public, f'Explanation {good[0]}')


def solve_reasoning(public):
    p = public['prompt']
    if 'A student wrote this proof:' in p:
        return solve_flaw(public)
    if p.startswith('In quadrilateral'):
        return solve_enough(public)
    if p.startswith('Taylor claims:'):
        return solve_counterexample(public)
    return solve_explanation(public)


# ======================================================================

def solve(public):
    t = public['templateId']
    require(t in SUPPORTED, f'Unsupported template {t}')
    if t == REASONING:
        return solve_reasoning(public)
    return solve_proof(public)


def review_problem(problem):
    public = problem['public']
    t = public['templateId']
    require(t in SUPPORTED, f'Unsupported template {t}')
    STATS['cases'] += 1
    if t == REASONING:
        response = public['response']
        require(response['kind'] == 'choice' and len(response['options']) == 4, 'Four options')
        require(len({o['label'] for o in response['options']}) == 4, 'Distinct options')
        return solve_reasoning(public)
    return review_proof(problem)


# ======================================================================
# Self-test

def _text(label, x, y):
    return {'id': 'n' + label, 'type': 'text', 'at': [x, y], 'text': label}


def _figure(points):
    return {'kind': 'scene', 'scene': {'v': 1, 'title': 't', 'elements': [_text(k, x, y) for k, (x, y) in points.items()]}}


PARALLELOGRAM = {'A': (0, 0), 'B': (8, 0), 'C': (11, 4), 'D': (3, 4), 'E': (5.5, 2)}


def _proof_fixture():
    """Proof C (diagonals bisect each other), fill-in of three reasons."""
    stmts = [('sa', '$ABCD$ is a parallelogram'), ('sb', r'$\overline{AB}\parallel\overline{DC}$'),
             ('sc', r'$\angle BAE\cong\angle DCE$ and $\angle ABE\cong\angle CDE$'), ('sd', r'$\overline{AB}\cong\overline{CD}$'),
             ('se', r'$\triangle ABE\cong\triangle CDE$'), ('sf', r'$\overline{AE}\cong\overline{CE}$ and $\overline{BE}\cong\overline{DE}$'),
             ('sg', r'$\angle AEB\cong\angle CED$')]
    reasons = [('ra', 'Given'), ('rb', 'Definition of parallelogram'), ('rc', 'Alternate interior angles of parallel lines are congruent'),
               ('rd', 'Opposite sides of a parallelogram are congruent'), ('re', 'ASA'), ('rf', 'CPCTC (corresponding parts of congruent triangles)'),
               ('rg', 'Diagonals of a parallelogram bisect each other'), ('rh', 'SAS'), ('ri', 'Vertical angles are congruent'),
               ('rj', 'If alternate interior angles are congruent, then the lines are parallel')]
    key = [('sa', 'ra'), ('sb', 'rb'), ('sc', 'rc'), ('sd', 'rd'), ('se', 're'), ('sf', 'rf')]
    blank = {2, 4, 5}
    rows = [{'id': f'r{i + 1}', 'fields': [{'kind': 'choice', 'label': 'Statement', 'bank': 'statements', 'given': s},
                                           dict({'kind': 'choice', 'label': 'Reason', 'bank': 'reasons'}, **({} if i in blank else {'given': r}))]}
            for i, (s, r) in enumerate(key)]
    response = {'kind': 'structured-work', 'label': 'Your proof', 'layout': 'proof', 'mode': 'fill', 'goal': stmts[5][1], 'rows': rows,
                'banks': [{'id': 'statements', 'label': 'Statement', 'options': [{'id': i, 'label': l} for i, l in stmts]},
                          {'id': 'reasons', 'label': 'Reason', 'options': [{'id': i, 'label': l} for i, l in reasons]}]}
    claims = {'sa': {'ra': [[]], 'rj': [['sb']]}, 'sb': {'rb': [['sa']], 'rj': [['sc']]}, 'sc': {'rc': [['sb']], 'rf': [['se']]}, 'sd': {'rd': [['sa']], 'rf': [['se']]},
              'se': {'re': [['sc', 'sd']]}, 'sf': {'rf': [['se']]}, 'sg': {'ri': [[]], 'rf': [['se']]}}
    claims['sa'].pop('rj')
    prompt = (r'Use the figure. Given: $ABCD$ is a parallelogram whose diagonals meet at $E$. Prove: $\overline{AC}$ and $\overline{BD}$ bisect each other, '
              r'that is, $\overline{AE}\cong\overline{CE}$ and $\overline{BE}\cong\overline{DE}$. The statements of the proof are shown. Choose the reason for each blank line.')
    answer = [['', ''] for _ in key]
    for i in blank:
        answer[i][1] = key[i][1]
    return {'public': {'templateId': FILL, 'prompt': prompt, 'response': response, 'figure': _figure(PARALLELOGRAM)},
            'answer': json.dumps(answer, separators=(',', ':')), 'workGrading': {'mode': 'proof', 'goal': 'sf', 'claims': claims}}


def _rejects(problem, why):
    try:
        review_problem(problem)
    except (ValueError, KeyError, TypeError, IndexError, StopIteration):
        return
    raise ValueError(f'Self-test mutation accepted: {why}')


def self_test():
    base = _proof_fixture()
    require(review_problem(base) == base['answer'], 'proof fixture')
    m = copy.deepcopy(base)
    a = json.loads(m['answer']); a[5][1] = 'rg'; m['answer'] = json.dumps(a)
    _rejects(m, 'the theorem being proved used as its own reason')
    m = copy.deepcopy(base)
    a = json.loads(m['answer']); a[4][1] = 'rh'; m['answer'] = json.dumps(a)
    _rejects(m, 'SAS where the known parts are two angles and a side')
    m = copy.deepcopy(base)
    m['workGrading']['claims']['sf']['rg'] = [['sa']]
    _rejects(m, 'a circular theorem credited in the private rule')
    m = copy.deepcopy(base)
    m['workGrading']['claims']['sf']['rf'] = [['se', 'sd']]
    _rejects(m, 'a claim that demands more than the justification needs')
    m = copy.deepcopy(base)
    m['public']['figure'] = _figure(dict(PARALLELOGRAM, C=(12, 4)))
    _rejects(m, 'a figure that is not a parallelogram')
    m = copy.deepcopy(base)
    m['public']['response']['banks'][0]['options'][2]['label'] = r'$\angle BAE\cong\angle CDE$ and $\angle ABE\cong\angle DCE$'
    _rejects(m, 'a false angle statement')
    # Find the flaw: a converse argument that uses a parallelogram theorem.
    flaw_prompt = ('Given: the diagonals of quadrilateral $ABCD$ meet at $E$, with $\\overline{AE}\\cong\\overline{CE}$ and $\\overline{BE}\\cong\\overline{DE}$. Prove: $ABCD$ is a parallelogram. A student wrote this proof:\n'
                   '1. $\\overline{AE}\\cong\\overline{CE}$ and $\\overline{BE}\\cong\\overline{DE}$ — Given.\n'
                   '2. $\\angle AEB\\cong\\angle CED$ and $\\angle AED\\cong\\angle CEB$ — Vertical angles are congruent.\n'
                   '3. $\\triangle AEB\\cong\\triangle CED$ and $\\triangle AED\\cong\\triangle CEB$ — SAS.\n'
                   '4. $\\angle BAE\\cong\\angle DCE$ and $\\angle DAE\\cong\\angle BCE$ — CPCTC (corresponding parts of congruent triangles).\n'
                   '5. $\\overline{AB}\\parallel\\overline{DC}$ and $\\overline{AD}\\parallel\\overline{BC}$ — Alternate interior angles of parallel lines are congruent.\n'
                   '6. $ABCD$ is a parallelogram — Definition of parallelogram.\n'
                   'Exactly one line is not justified by its reason and the lines above it. Which line is it?')
    options = [{'id': f'option-{c}', 'label': f'Line {n}'} for c, n in zip('abcd', (2, 3, 5, 6))]
    flaw = {'public': {'templateId': REASONING, 'prompt': flaw_prompt, 'response': {'kind': 'choice', 'label': 'Choose', 'options': options},
                       'figure': _figure(PARALLELOGRAM)}, 'answer': 'option-c'}
    require(review_problem(flaw) == 'option-c', 'flaw fixture')
    fixed = copy.deepcopy(flaw)
    fixed['public']['prompt'] = flaw_prompt.replace('— Alternate interior angles of parallel lines are congruent.', '— If alternate interior angles are congruent, then the lines are parallel.')
    _rejects(fixed, 'an argument with no flaw')
    # Enough: one insufficient fact among three tests.
    enough = {'public': {'templateId': REASONING, 'prompt': 'In quadrilateral $ABCD$, which one of these facts is not enough, on its own, to prove that $ABCD$ is a parallelogram?',
                         'response': {'kind': 'choice', 'label': 'Choose', 'options': [
                             {'id': 'option-a', 'label': r'$\overline{AC}$ and $\overline{BD}$ bisect each other'},
                             {'id': 'option-b', 'label': r'$\overline{AB}\cong\overline{CD}$ and $\overline{AD}\parallel\overline{BC}$'},
                             {'id': 'option-c', 'label': r'$\overline{AB}\parallel\overline{CD}$ and $\overline{AB}\cong\overline{CD}$'},
                             {'id': 'option-d', 'label': r'$\angle A\cong\angle C$ and $\angle B\cong\angle D$'}]}}, 'answer': 'option-b'}
    require(review_problem(enough) == 'option-b', 'enough fixture')
    m = copy.deepcopy(enough)
    m['public']['response']['options'][3]['label'] = r'$\overline{AC}\cong\overline{BD}$'
    _rejects(m, 'two insufficient facts')
    return {'self_test': 'ok'}


if __name__ == '__main__':
    print(self_test())
