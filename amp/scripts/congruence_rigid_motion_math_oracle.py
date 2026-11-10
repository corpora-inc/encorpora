"""Independent oracle for the congruence-rigid-motion family (HSG.CO.B.7).

Templates: six-parts-imply-rigid-motion-proof, congruence-definition-reasoning
and rigid-motion-from-six-parts-coordinates.

Only the public payload enters `solve`: the prompt, the response (statement
and reason banks, rows, options, blanks) and the figure. `review_problem`
also treats the answer key, the private `workGrading` rule and the worked
explanation as values under test; nothing is derived from them.

* Proof. The vertex correspondence and the six givens are read from the
  prompt, the vertices from the figure's name labels (checked against its
  sides, tick marks and angle arcs). The construction is recomputed from the
  coordinates: translate by D - A, rotate about D onto ray DE, reflect over
  line DE exactly when the stated (and drawn) orientations differ. Every bank
  statement is read from its TeX label into facts and checked numerically
  against those images; decoys must be false or carry an unsound inference.
  Every bank reason is a rule written here: which kind of statement it
  justifies and which facts must already be stated. The oracle enumerates
  every set of lines that can be stated validly and requires the private
  claims to credit exactly the lines these rules credit (no valid order
  rejected, no premature or circular line accepted), each line to have
  exactly one valid reason, and the key to be the spec's canonical order
  (land A and B, orientation, angle, pin, conclusion). Orderings are also
  checked over every permutation.
* Reasoning. Every option is classified by a rule base written here: a
  landing plus the preserved quantity is complete; CPCTC and the criteria are
  circular; one motion or one invariant alone is incomplete; a statement with
  the triangles' roles swapped is equivalent to the unswapped one (rigid
  motions are invertible); a flaw accusation is true only when it names the
  first invalid step and that step's actual defect. Exactly one option must
  be valid.
* Coordinates. The translation, the quarter-turn rotation about D (exact
  integers), the side of line DE and the reflection (exact rationals) are
  recomputed; every option of every part is evaluated and exactly one per
  part must be valid.
"""

import itertools
import json
import math
import re
from collections import Counter
from fractions import Fraction

PROOF = 'six-parts-imply-rigid-motion-proof'
REASONING = 'congruence-definition-reasoning'
COORDINATES = 'rigid-motion-from-six-parts-coordinates'
SUPPORTED = frozenset({PROOF, REASONING, COORDINATES})
REVIEW_RETURNS_ANSWER = True

TOL = 1e-7
STATS = {'cases': 0, 'contexts': 0, 'orders': 0, 'options': 0}


def require(condition, message):
    # Not assert: python -O must not disable review gates.
    if not condition:
        raise ValueError(message)


def _full(pattern, text):
    return re.fullmatch(pattern, text)


def _dumps(value):
    return json.dumps(value, separators=(',', ':'))


# ======================================================================
# Plane geometry (floats with tolerance; the proof figures are drawn at
# multiples of 15 degrees, so their coordinates are irrational)

def _sub(p, q):
    return (p[0] - q[0], p[1] - q[1])


def _add(p, q):
    return (p[0] + q[0], p[1] + q[1])


def _cross(u, v):
    return u[0] * v[1] - u[1] * v[0]


def _dot(u, v):
    return u[0] * v[0] + u[1] * v[1]


def _length(u):
    return math.hypot(u[0], u[1])


def _dist(p, q):
    return _length(_sub(p, q))


def _rotate(u, radians):
    c, s = math.cos(radians), math.sin(radians)
    return (u[0] * c - u[1] * s, u[0] * s + u[1] * c)


def _near(p, q):
    return _dist(p, q) <= TOL * max(1.0, _length(p), _length(q))


def _close(a, b):
    return abs(a - b) <= TOL * max(1.0, abs(a), abs(b))


def _side(p, a, b):
    """+1 or -1 for the side of line ab that p is on, 0 on the line."""
    c = _cross(_sub(b, a), _sub(p, a))
    if abs(c) <= TOL * _length(_sub(b, a)) * max(1.0, _dist(p, a)):
        return 0
    return 1 if c > 0 else -1


def _on_ray(p, origin, through):
    u, w = _sub(through, origin), _sub(p, origin)
    return abs(_cross(u, w)) <= TOL * _length(u) * max(1.0, _length(w)) and _dot(u, w) > TOL


def _on_segment(p, a, b):
    u, w = _sub(b, a), _sub(p, a)
    if abs(_cross(u, w)) > 1e-6 * _length(u) * max(1.0, _length(w)):
        return False
    t = _dot(u, w) / _dot(u, u)
    return 1e-6 < t < 1 - 1e-6


def _angle(v, p, q):
    """Measure in degrees of the angle at v between rays vp and vq."""
    a, b = _sub(p, v), _sub(q, v)
    cos = _dot(a, b) / (_length(a) * _length(b))
    return math.degrees(math.acos(max(-1.0, min(1.0, cos))))


def _reflect(p, a, b):
    u = _sub(b, a)
    t = _dot(_sub(p, a), u) / _dot(u, u)
    foot = (a[0] + t * u[0], a[1] + t * u[1])
    return (2 * foot[0] - p[0], 2 * foot[1] - p[1])


def _orientation(a, b, c):
    s = _side(c, a, b)
    require(s != 0, 'A triangle is not degenerate')
    return s


def _direction(u):
    return math.degrees(math.atan2(u[1], u[0])) % 360


def _same_direction(a, b):
    return abs(((a - b + 180) % 360) - 180) <= 1e-6


# ======================================================================
# Names, correspondence and givens

MAPS = (r"maps \$\\triangle (\w)(\w)(\w)\$ onto \$\\triangle (\w)(\w)(\w)\$ with "
        r"\$(\w)\\to (\w)\$, \$(\w)\\to (\w)\$,? (?:and )?\$(\w)\\to (\w)\$")


def _roles(text):
    """Roles A..F -> letters, from the first stated correspondence."""
    m = re.search(MAPS, text)
    require(m, 'The prompt states the vertex correspondence')
    first, second = m.group(1, 2, 3), m.group(4, 5, 6)
    pairs = dict([m.group(7, 8), m.group(9, 10), m.group(11, 12)])
    require(len(pairs) == 3 and set(pairs) == set(first), 'The correspondence names each vertex once')
    require(tuple(pairs[x] for x in first) == second, 'The image triangle is named in corresponding order')
    letters = first + second
    require(len(set(letters)) == 6, 'Six distinct vertex letters')
    require(not set(letters) & set('IOQ'), 'No vertex is named I, O or Q')
    return dict(zip('ABCDEF', letters))


def _image(L):
    return {L['A']: L['D'], L['B']: L['E'], L['C']: L['F']}


def _tri(L, which):
    return ''.join(L[k] for k in which)


def _tex_list(text):
    """The TeX items of a list '$x$, $y$ and $z$'."""
    items = re.findall(r"\$([^$]+)\$", text)
    shape = re.sub(r"\$[^$]+\$", '#', text)
    require(_full(r"#(?:, #)* and #", shape), f'Unreadable list {text!r}')
    return items


def _congruences(items, L):
    """Given sides (as frozensets of the first triangle's letters) and angles
    (first-triangle letters); each item must pair corresponding parts."""
    image = _image(L)
    sides, angles = set(), set()
    for item in items:
        m = _full(r"\\overline\{(\w)(\w)\}\\cong\\overline\{(\w)(\w)\}", item)
        if m:
            p, q, r, s = m.groups()
            require(p in image and q in image and {image[p], image[q]} == {r, s}, f'{item} pairs corresponding sides')
            sides.add(frozenset((p, q)))
            continue
        m = _full(r"\\angle (\w)\\cong\\angle (\w)", item)
        require(m and image.get(m[1]) == m[2], f'{item} pairs corresponding angles')
        angles.add(m[1])
    require(len(sides) + len(angles) == len(items), 'No given repeats')
    return sides, angles


def _require_six(items, L):
    sides, angles = _congruences(items, L)
    require(len(sides) == 3 and angles == {L['A'], L['B'], L['C']}, 'All six pairs of corresponding parts are given')
    return sides, angles


# ======================================================================
# The two-triangle scene (proof and reasoning figures)

def _scene_points(figure, L):
    require(figure is not None and figure.get('kind') == 'scene', 'A scene figure')
    elements = figure['scene']['elements']
    points = {}
    for e in elements:
        if e.get('type') == 'text' and e.get('text') in L.values():
            require(e['text'] not in points, f"Vertex {e['text']} is named twice")
            points[e['text']] = (float(e['at'][0]), float(e['at'][1]))
    require(set(points) == set(L.values()), 'Every vertex is named in the figure')
    return points, elements


def _pair_figure(figure, L, sides_given, angles_given):
    """Vertex positions of a two-triangle figure, after checking that the
    drawn sides exist, the triangles are congruent and scalene under the
    stated correspondence, and the marks say exactly the givens."""
    pts, elements = _scene_points(figure, L)
    first, second = [L[k] for k in 'ABC'], [L[k] for k in 'DEF']
    sides = [(t[i], t[(i + 1) % 3]) for t in (first, second) for i in range(3)]
    segments = [((float(e['from'][0]), float(e['from'][1])), (float(e['to'][0]), float(e['to'][1])))
                for e in elements if e.get('type') == 'segment']
    for p, q in sides:
        require(any((_near(a, pts[p]) and _near(b, pts[q])) or (_near(a, pts[q]) and _near(b, pts[p])) for a, b in segments),
                f'Side {p}{q} is drawn')
    for (p, q), (r, s) in zip(sides[:3], sides[3:]):
        require(_close(_dist(pts[p], pts[q]), _dist(pts[r], pts[s])), f'{p}{q} = {r}{s} in the figure')
    lengths = [_dist(pts[p], pts[q]) for p, q in sides[:3]]
    require(all(abs(a - b) > 1e-3 for a, b in itertools.combinations(lengths, 2)), 'The triangles are scalene')
    for v, w in zip(first, second):
        others_v = [x for x in first if x != v]
        others_w = [x for x in second if x != w]
        require(_close(_angle(pts[v], *[pts[x] for x in others_v]), _angle(pts[w], *[pts[x] for x in others_w])),
                f'Angle {v} = angle {w} in the figure')
    _check_marks(elements, pts, L, sides_given, angles_given)
    return pts


def _check_marks(elements, pts, L, sides_given, angles_given):
    """The tick marks and angle arcs say exactly the givens: each given pair
    is marked alike, different pairs differently, nothing else is marked."""
    first, second = [L[k] for k in 'ABC'], [L[k] for k in 'DEF']
    sides = [(t[i], t[(i + 1) % 3]) for t in (first, second) for i in range(3)]
    ticks, arcs = Counter(), Counter()
    for e in elements:
        if e.get('type') == 'tick':
            at = (float(e['at'][0]), float(e['at'][1]))
            hits = [frozenset((p, q)) for p, q in sides if _on_segment(at, pts[p], pts[q])]
            require(len(hits) == 1, 'Each tick mark sits on one side')
            ticks[hits[0]] += 1
        elif e.get('type') == 'arc':
            center = (float(e['center'][0]), float(e['center'][1]))
            hits = [v for v in pts if _near(center, pts[v])]
            require(len(hits) == 1, 'Each angle arc is centered at a vertex')
            v = hits[0]
            tri = first if v in first else second
            p, q = [pts[x] for x in tri if x != v]
            span = float(e['to']) - float(e['from'])
            require(_close(span, _angle(pts[v], p, q)), f'The arc at {v} spans its angle')
            ends = sorted([float(e['from']) % 360, float(e['to']) % 360])
            rays = sorted([_direction(_sub(p, pts[v])), _direction(_sub(q, pts[v]))])
            require(any(all(_same_direction(a, b) for a, b in zip(ends, order)) for order in (rays, rays[::-1])),
                    f'The arc at {v} runs between its rays')
            arcs[v] += 1
    image = _image(L)
    counts = set()
    for side in sides_given:
        twin = frozenset(image[x] for x in side)
        require(ticks[side] == ticks[twin] > 0, f'Given side pair {"".join(sorted(side))} is marked alike')
        counts.add(ticks[side])
    require(len(counts) == len(sides_given), 'Different side pairs carry different tick counts')
    require(sum(ticks.values()) == sum(2 * ticks[s] for s in sides_given), 'Only given sides are ticked')
    counts = set()
    for v in angles_given:
        require(arcs[v] == arcs[image[v]] > 0, f'Given angle pair at {v} is marked alike')
        counts.add(arcs[v])
    require(len(counts) == len(angles_given), 'Different angle pairs carry different arc counts')
    require(sum(arcs.values()) == sum(2 * arcs[v] for v in angles_given), 'Only given angles are marked')


# ======================================================================
# Six-parts proof

ORIENTATION = (r"\$(\w)\\to (\w)\\to (\w)\$ runs (counterclockwise|clockwise) and "
               r"\$(\w)\\to (\w)\\to (\w)\$ runs (counterclockwise|clockwise)")
WAY = {'counterclockwise': 1, 'clockwise': -1}

# Reason texts and the rule each one is. None: it justifies no line of this
# proof (the comment says why).
REASON_RULES = [
    (r"A translation can carry \$(\w)\$ to \$(\w)\$; a rotation about \$(\w)\$ fixes \$(\w)\$ and can turn any ray from \$(\w)\$ onto any other\.",
     'tr', 'ADDDD'),
    (r"Rigid motions preserve distance, and a ray has exactly one point at a given distance from its endpoint\.", 'dist', ''),
    (r"Translations and rotations preserve orientation, and the two triangles have the same orientation\.", 'or_same', ''),
    (r"Translations and rotations preserve orientation, which differs here; a reflection fixes its line and swaps the line's two sides\.",
     'or_flip', ''),
    (r"Rigid motions preserve angle measure, and on one side of line \$(\w)(\w)\$ just one ray from \$(\w)\$ \(or from \$(\w)\$\) makes a given angle with \$\\overline\{(\w)(\w)\}\$\.",
     'ang', 'DEDEDE'),
    (r"Two different lines meet in at most one point\.", 'lines', ''),
    # Two distinct lines sharing two points would be one line, so this pins
    # a point on two rays as well as the statement above does.
    (r"Two points determine exactly one line\.", 'two_points', ''),
    (r"Definition of congruence: a sequence of rigid motions maps one figure onto the other\.", 'def', ''),
    # Circular: CPCTC and the criteria are proved from this definition, and
    # the prompt forbids them.
    (r"Corresponding parts of congruent triangles are congruent \(CPCTC\)\.", None, ''),
    (r"The (?:SAS|ASA|SSS) congruence criterion\.", None, ''),
    # True only for some center chosen per pair of points, so it says nothing
    # about the translation or about the rotation about D this proof uses.
    (r"A rotation can carry any point onto any other point\.", None, ''),
    # False for every fixed center X: a rotation about X keeps each point's
    # distance to X (X itself never moves), so it cannot carry P onto Q when
    # XP and XQ differ.
    (r"A rotation about \$\w\$ can carry any point onto any other point\.", None, ''),
    # False: a reflection reverses orientation.
    (r"Reflections preserve orientation\.", None, ''),
    # Not a rigid motion.
    (r"A dilation can make matching sides the same length\.", None, ''),
    # False: the third vertex may land on the mirror image across line DE.
    (r"Once two vertices land on their matches, the third vertex must land on its match\.", None, ''),
    # Appearance is not a reason.
    (r"The two triangles look the same size and shape in the figure\.", None, ''),
]


def _reason_kind(label, L):
    for pattern, kind, roles in REASON_RULES:
        m = _full(pattern, label)
        if m:
            require(list(m.groups()) == [L[r] for r in roles], f'Reason letters {label!r}')
            return kind
    raise ValueError(f'Unknown reason {label!r}')


class _Proof:
    """The proof model of one six-parts problem, from its public payload."""

    def __init__(self, public):
        self.public = public
        prompt, response = public['prompt'], public['response']
        require(response['kind'] == 'structured-work' and response['layout'] == 'proof', 'A two-column proof')
        banks = {b['id']: b for b in response['banks']}
        require(set(banks) == {'statements', 'reasons'}, 'Statement and reason banks')
        for row in response['rows']:
            require([f['bank'] for f in row['fields']] == ['statements', 'reasons'], 'Rows are [statement, reason]')
        L = self.L = _roles(prompt)
        m = re.search(r"Use the figure\. Given: (.+?); (" + ORIENTATION + r")\. Prove that a sequence of rigid motions maps ", prompt)
        require(m, 'Given and orientation')
        self.sides_given, self.angles_given = _require_six(_tex_list(m[1]), L)
        o = re.search(ORIENTATION, m[2])
        require(o.group(1, 2, 3) == tuple(L[k] for k in 'ABC') and o.group(5, 6, 7) == tuple(L[k] for k in 'DEF'),
                'Orientation names both triangles in order')
        require(f"so $\\triangle {_tri(L, 'ABC')}\\cong\\triangle {_tri(L, 'DEF')}$." in prompt, 'The prompt states the goal')
        require('The proof may not cite CPCTC, SSS, SAS or ASA' in prompt, 'The prompt forbids CPCTC and the criteria')
        task = {'build': 'Build the proof: choose a statement and a reason for each line.',
                'fill': 'The statements are shown. Choose the reason for each blank line.',
                'order': 'The lines of the proof are shown out of order. Put them in order.'}[response['mode']]
        require(prompt.endswith(task), 'The task sentence matches the mode')
        P = self.P = _pair_figure(public['figure'], L, self.sides_given, self.angles_given)
        A, B, C, D, E, F = (P[L[k]] for k in 'ABCDEF')
        abc, def_ = _orientation(A, B, C), _orientation(D, E, F)
        require((WAY[o[4]], WAY[o[8]]) == (abc, def_), 'The stated orientations are the drawn ones')
        self.opposite = abc != def_
        # The construction: translate by D - A, rotate about D onto ray DE.
        v = _sub(D, A)
        B1, C1 = _add(B, v), _add(C, v)
        turn = math.atan2(_cross(_sub(B1, D), _sub(E, D)), _dot(_sub(B1, D), _sub(E, D)))
        Bp = _add(D, _rotate(_sub(B1, D), turn))
        Cp = _add(D, _rotate(_sub(C1, D), turn))
        self.Bp, self.Cp, self.Cpp = L['B'] + "'", L['C'] + "'", L['C'] + "''"
        self.points = {L[k]: P[L[k]] for k in 'ABCDEF'}
        self.points[self.Bp] = Bp
        self.points[self.Cp] = Cp
        if self.opposite:
            # The reflection exists in the sequence only when it is needed.
            self.points[self.Cpp] = _reflect(Cp, D, E)
        self.final = self.Cpp if self.opposite else self.Cp
        self.preimage = {self.Bp: L['B'], self.Cp: L['C'], self.Cpp: L['C']}
        require(_on_ray(Bp, D, E) and _near(Bp, E) and _near(self.points[self.final], F), 'The construction lands A, B, C on D, E, F')
        self.labels = {o['id']: o['label'] for o in banks['statements']['options']}
        require(len(set(self.labels.values())) == len(self.labels), 'Statements are distinct')
        self.stmt = {sid: self._statement(label) for sid, label in self.labels.items()}
        reasons = {o['id']: o['label'] for o in banks['reasons']['options']}
        require(len(set(reasons.values())) == len(reasons), 'Reasons are distinct')
        self.reason = {rid: _reason_kind(label, L) for rid, label in reasons.items()}
        self.reason_labels = reasons
        goals = [sid for sid, s in self.stmt.items() if s['kind'] == 'conclusion']
        require(len(goals) == 1, 'The bank states the conclusion once')
        self.goal = goals[0]
        require(response['goal'] == self.labels[self.goal], 'The goal shown is the conclusion')

    # --- reading statements
    def point(self, name):
        return self.points.get(name)

    def _given_side(self, p, q):
        return frozenset((p, q)) in self.sides_given

    def _statement(self, label):
        L, P = self.L, self.points
        A, B, C, D, E, F = (L[k] for k in 'ABCDEF')
        Bp, Cp, Cpp = self.Bp, self.Cp, self.Cpp
        abc, def_ = _tri(L, 'ABC'), _tri(L, 'DEF')
        out = {'label': label, 'sound': False, 'provides': frozenset(), 'needs': {}, 'rank': None, 'givens': frozenset()}

        def sound(kind, provides, needs, rank, givens=()):
            out.update(kind=kind, sound=True, provides=frozenset(provides), needs=needs, rank=rank, givens=frozenset(givens))
            return out

        def false(kind):
            out.update(kind=kind)
            return out

        m = _full(r"Translate \$\\triangle (\w)(\w)(\w)\$ by the vector from \$(\w)\$ to \$(\w)\$, then rotate about \$(\w)\$ until the image of \$(\w)\$ is on ray \$(\w)(\w)\$; call the image \$\\triangle (\w)(\w)'(\w)'\$\.", label)
        if m:
            require(m.groups() == (A, B, C, A, D, D, B, D, E, D, B, C), f'Construction letters {label!r}')
            return sound('construct', {('A->D',), ('def', Bp), ('def', Cp), ('onray', Bp, D, E)}, {'tr': [frozenset()]}, 1)
        m = _full(r"\$(\w)(\w'+)=(\w)(\w)=(\w)(\w)\$, so \$(\w'+)=(\w)\$\.", label)
        if m:
            center, X, p, q, center2, Y, X2, Y2 = m.groups()
            require(center == center2 == D and X == X2 and Y == Y2 and X in self.preimage, f'Distance statement {label!r}')
            pre = self.preimage[X]
            require((p, q) == (A, pre) and Y == _image(L)[pre], f'Distance statement letters {label!r}')
            x = self.point(X)
            true = (x is not None and self._given_side(A, pre)
                    and _close(_dist(P[D], x), _dist(P[A], P[pre])) and _close(_dist(P[A], P[pre]), _dist(P[D], P[Y])) and _near(x, P[Y]))
            if not true:
                return false('distpin')
            return sound('distpin', {('eq', X, Y)}, {'dist': [frozenset({('onray', X, D, Y), ('def', X)})]},
                         2 if pre == B else 5, {('side', A, pre)})
        m = _full(r"\$(\w'+)\$ and \$(\w)\$ are on the same side of line \$(\w)(\w)\$\.", label)
        if m:
            X = m[1]
            require(m.group(2, 3, 4) == (F, D, E) and X in (Cp, Cpp), f'Same-side statement {label!r}')
            x = self.point(X)
            if x is None or _side(x, P[D], P[E]) == 0 or _side(x, P[D], P[E]) != _side(P[F], P[D], P[E]):
                return false('same_side')
            # Orientation decides the side only for the orientation-preserving image C'.
            needs = {'or_same': [frozenset({('onray', Bp, D, E), ('def', X)})]} if not self.opposite and X == Cp else {}
            return sound('same_side', {('side', X)}, needs, 3)
        m = _full(r"\$(\w'+)\$ is across line \$(\w)(\w)\$ from \$(\w)\$; reflecting over line \$(\w)(\w)\$ gives \$\\triangle (\w)(\w'+)(\w'+)\$, with \$(\w'+)\$ on \$(\w)\$'s side\.", label)
        if m:
            require(m.groups() == (Cp, D, E, F, D, E, D, Bp, Cpp, Cpp, F), f'Reflection statement {label!r}')
            c1 = P[Cp]
            s = _side(c1, P[D], P[E])
            if s == 0 or s != -_side(P[F], P[D], P[E]):
                return false('flip')
            require(_side(_reflect(c1, P[D], P[E]), P[D], P[E]) == _side(P[F], P[D], P[E]), 'A reflection swaps the sides')
            needs = {'or_flip': [frozenset({('onray', Bp, D, E), ('def', Cp)})]} if self.opposite else {}
            return sound('flip', {('side', Cpp), ('def', Cpp)}, needs, 3)
        m = _full(r"\$m\\angle (\w)(\w)(\w'+)=m\\angle (\w)=m\\angle (\w)\$ and \$m\\angle (\w)(\w)(\w'+)=m\\angle (\w)=m\\angle (\w)\$, so \$(\w'+)\$ is on rays \$(\w)(\w)\$ and \$(\w)(\w)\$\.", label)
        if m:
            X = m[3]
            require(m.groups() == (E, D, X, A, D, D, E, X, B, E, X, D, F, E, F) and X in (Cp, Cpp), f'Two-angle statement {label!r}')
            x = self.point(X)
            true = (x is not None and self._angle_holds(D, E, x, A) and self._angle_holds(E, D, x, B)
                    and _on_ray(x, P[D], P[F]) and _on_ray(x, P[E], P[F]))
            if not true:
                return false('angle_rays')
            return sound('angle_rays', {('onray', X, D, F), ('onray', X, E, F)},
                         {'ang': [frozenset({('side', X), ('onray', Bp, D, E), ('eq', Bp, E)})]}, 4, {('angle', A), ('angle', B)})
        m = _full(r"\$m\\angle (\w)(\w)(\w'+)=m\\angle (\w)=m\\angle (\w)\$, so \$(\w'+)\$ is on ray \$(\w)(\w)\$\.", label)
        if m:
            arm, vertex, X, pre, target, X2, r0, r1 = m.groups()
            require(X == X2 and X in (Cp, Cpp), f'Angle statement {label!r}')
            if (arm, vertex, pre, target, r0, r1) == (E, D, A, D, D, F):
                extra = set()
            elif (arm, vertex, pre, target, r0, r1) == (D, E, B, E, E, F):
                # The angle at E is the image of the angle at B only once B' = E.
                extra = {('eq', Bp, E)}
            else:
                raise ValueError(f'Angle statement letters {label!r}')
            x = self.point(X)
            if x is None or not (self._angle_holds(vertex, arm, x, pre) and _on_ray(x, P[vertex], P[F])):
                return false('angle_ray')
            return sound('angle_ray', {('onray', X, vertex, F)},
                         {'ang': [frozenset({('side', X), ('onray', Bp, D, E)} | extra)]}, 4, {('angle', pre)})
        m = _full(r"Rays \$(\w)(\w)\$ and \$(\w)(\w)\$ meet only at \$(\w)\$, so \$(\w'+)=(\w)\$\.", label)
        if m:
            X = m[6]
            require(m.groups() == (D, F, E, F, F, X, F) and X in (Cp, Cpp), f'Two-ray statement {label!r}')
            x = self.point(X)
            if x is None or _side(P[F], P[D], P[E]) == 0 or not _near(x, P[F]):
                return false('rays_meet')
            need = frozenset({('onray', X, D, F), ('onray', X, E, F)})
            return sound('rays_meet', {('eq', X, F)}, {'lines': [need], 'two_points': [need]}, 5)
        m = _full(r"The motions take \$(\w)\$, \$(\w)\$, \$(\w)\$ to \$(\w)\$, \$(\w)\$, \$(\w)\$, so they map \$\\triangle (\w{3})\$ onto \$\\triangle (\w{3})\$: \$\\triangle (\w{3})\\cong\\triangle (\w{3})\$\.", label)
        if m:
            require(m.groups() == (A, B, C, D, E, F, abc, def_, abc, def_), f'Conclusion letters {label!r}')
            return sound('conclusion', {('goal',)},
                         {'def': [frozenset({('A->D',), ('eq', Bp, E), ('eq', self.final, F)})]}, 6)
        # Decoys. A construction the figure cannot carry out is false; a
        # possible one would be a statement outside this model, so refuse it.
        m = _full(r"Translate \$\\triangle (\w)(\w)(\w)\$ so that \$\\overline\{(\w)(\w)\}\$ lands on \$\\overline\{(\w)(\w)\}\$\.", label)
        if m:
            require(m.group(1, 2, 3) == (A, B, C) and {m[4], m[5]} <= {A, B, C}, f'Translation decoy {label!r}')
            u, w = _sub(P[m[5]], P[m[4]]), _sub(P[m[7]], P[m[6]])
            require(not _near(u, w) and not _near(u, (-w[0], -w[1])), f'Decoy is a possible translation: {label!r}')
            return false('translate_segment')
        m = _full(r"Rotate \$\\triangle (\w)(\w)(\w)\$ about \$(\w)\$ until \$(\w)\$ lands on \$(\w)\$\.", label)
        if m:
            require(m.group(1, 2, 3) == (A, B, C), f'Rotation decoy {label!r}')
            center, p, q = P[m[4]], P[m[5]], P[m[6]]
            require(not _close(_dist(center, p), _dist(center, q)), f'Decoy is a possible rotation: {label!r}')
            return false('rotate_onto')
        m = _full(r"\$(\w'+)=(\w)\$, because (.+)\.", label)
        if m:
            X, Y, why = m.groups()
            require(X in (Cp, Cpp) and Y == F, f'Inference decoy {label!r}')
            if why == f"${Bp}={E}$":
                # Two landed vertices leave the third on either side of DE.
                return false('because_leap')
            if why == f"$\\triangle {abc}\\cong\\triangle {def_}$":
                # Circular: the congruence is the goal, and it does not say
                # where this particular sequence takes C.
                return false('because_goal')
            raise ValueError(f'Unknown inference {label!r}')
        raise ValueError(f'Unreadable statement {label!r}')

    def _angle_holds(self, vertex, arm, x, pre):
        """m(angle arm-vertex-x) = m(angle pre) = m(angle at its match)."""
        L, P = self.L, self.points
        image = _image(L)
        first = [L[k] for k in 'ABC']
        others = [P[y] for y in first if y != pre]
        match = image[pre]
        second = [L[k] for k in 'DEF']
        others2 = [P[y] for y in second if y != match]
        a = _angle(P[vertex], P[arm], x)
        return _close(a, _angle(P[pre], *others)) and _close(a, _angle(P[match], *others2)) and match == vertex

    # --- the rules
    def facts(self, stated):
        out = set()
        for sid in stated:
            out |= self.stmt[sid]['provides']
        return out

    def valid(self, sid, rid, stated):
        s = self.stmt[sid]
        kind = self.reason[rid]
        if sid in stated or not s['sound'] or kind is None:
            return False
        known = self.facts(stated)
        return any(need <= known for need in s['needs'].get(kind, []))

    def contexts(self):
        """Every set of lines that can be stated in some valid order."""
        seen, frontier = {frozenset()}, [frozenset()]
        while frontier:
            S = frontier.pop()
            for sid in self.stmt:
                if sid not in S and any(self.valid(sid, rid, S) for rid in self.reason):
                    T = S | {sid}
                    if T not in seen:
                        seen.add(T)
                        frontier.append(T)
        return seen

    def proof_valid(self, lines):
        """lines: [(statement, reason)]; each valid from the lines above; the last is the goal."""
        stated = set()
        for sid, rid in lines:
            if not self.valid(sid, rid, stated):
                return False
            stated.add(sid)
        return bool(lines) and lines[-1][0] == self.goal

    def canonical(self):
        """The spec's canonical proof: the sound statements by rank, each
        with its one valid reason."""
        n = len(self.public['response']['rows'])
        chosen = sorted((s['rank'], sid) for sid, s in self.stmt.items() if s['sound'])
        require(len(chosen) == n and len({r for r, _ in chosen}) == n, f'{n} sound statements, one per proof line')
        lines, stated = [], set()
        for _, sid in chosen:
            ok = [rid for rid in self.reason if self.valid(sid, rid, stated)]
            require(len(ok) == 1, f'Line {self.labels[sid]!r} has {len(ok)} valid reasons in the canonical order')
            lines.append((sid, ok[0]))
            stated.add(sid)
        require(lines[-1][0] == self.goal, 'The canonical proof ends with the goal')
        return lines

    def orders(self, lines):
        """Every order of `lines` (as index tuples) that is a valid proof."""
        out = []

        def walk(done, stated):
            if len(done) == len(lines):
                if lines[done[-1]][0] == self.goal:
                    out.append(tuple(done))
                return
            for i, (sid, rid) in enumerate(lines):
                if i not in done and self.valid(sid, rid, stated):
                    walk(done + [i], stated | {sid})
        walk([], frozenset())
        return set(out)

    def used_givens(self):
        out = set()
        for s in self.stmt.values():
            if s['sound']:
                out |= s['givens']
        return out


def _credited(claims, sid, rid, stated):
    sets = claims.get(sid, {}).get(rid)
    return sid not in stated and bool(sets) and any(set(x) <= stated for x in sets)


def _proof_expected(public):
    proof = _Proof(public)
    response = public['response']
    rows = response['rows']
    canon = proof.canonical()
    if response['mode'] == 'build':
        for row in rows:
            require(all('given' not in f for f in row['fields']), 'Build rows are blank')
        return proof, _dumps([[s, r] for s, r in canon])
    if response['mode'] == 'fill':
        stated, out, blanks = set(), [], 0
        for row in rows:
            sf, rf = row['fields']
            require('given' in sf, 'Fill rows show their statements')
            sid = sf['given']
            if 'given' in rf:
                require(proof.valid(sid, rf['given'], stated), f'Given reason of {proof.labels[sid]!r} is valid')
                out.append(['', ''])
            else:
                ok = [rid for rid in proof.reason if proof.valid(sid, rid, stated)]
                require(len(ok) == 1, f'Blank line {proof.labels[sid]!r} has {len(ok)} valid reasons')
                out.append(['', ok[0]])
                blanks += 1
            stated.add(sid)
        require(blanks >= 1, 'A fill task leaves a reason blank')
        require(rows and rows[-1]['fields'][0]['given'] == proof.goal, 'The shown proof ends with the goal')
        return proof, _dumps(out)
    require(response['mode'] == 'order', 'Build, fill or order')
    shown = {}
    for row in rows:
        sf, rf = row['fields']
        require('given' in sf and 'given' in rf, 'Ordered lines are shown complete')
        shown[row['id']] = (sf['given'], rf['given'])
    by_line = {line: rid for rid, line in shown.items()}
    require(set(by_line) == set(canon), 'The shown lines are the proof lines')
    require(not proof.proof_valid([shown[r['id']] for r in rows]), 'The shown order is not already a valid proof')
    return proof, _dumps([by_line[line] for line in canon])


def _review_proof(problem):
    public = problem['public']
    proof, expected = _proof_expected(public)
    grading = problem['workGrading']
    require(grading['mode'] == 'proof' and grading['goal'] == proof.goal, 'The rule proves the goal')
    claims = grading['claims']
    ids = set(proof.stmt)
    for sid, by in claims.items():
        require(sid in ids, f'Claim of unknown statement {sid}')
        for rid, sets in by.items():
            require(rid in proof.reason, f'Claim with unknown reason {rid}')
            for prem in sets:
                require(set(prem) <= ids and sid not in prem, f'Claim {sid}/{rid} rests on {prem}')
    # Every reachable set of stated lines: the rule credits exactly what the
    # rules here credit, and no line has two valid reasons.
    contexts = proof.contexts()
    require(any(proof.goal in S for S in contexts), 'The goal is provable from the givens')
    for S in contexts:
        STATS['contexts'] += 1
        for sid in ids - S:
            ok = [rid for rid in proof.reason if proof.valid(sid, rid, S)]
            require(len(ok) <= 1, f'{proof.labels[sid]!r} has {len(ok)} valid reasons')
            for rid in proof.reason:
                mine, theirs = proof.valid(sid, rid, S), _credited(claims, sid, rid, S)
                if mine != theirs:
                    above = sorted(proof.labels[x] for x in S)
                    raise ValueError(f"Rule {'rejects' if mine else 'accepts'} {proof.labels[sid]!r} by "
                                     f"{proof.reason_labels[rid]!r} with {above} above")
    response = public['response']
    if response['mode'] == 'order':
        rows = response['rows']
        lines = {r['id']: (r['fields'][0]['given'], r['fields'][1]['given']) for r in rows}
        valid_orders = 0
        for order in itertools.permutations(lines):
            seq = [lines[i] for i in order]
            mine = proof.proof_valid(seq)
            stated, theirs = set(), True
            for sid, rid in seq:
                theirs = theirs and _credited(claims, sid, rid, stated)
                stated.add(sid)
            theirs = theirs and seq[-1][0] == grading['goal']
            require(mine == theirs, f'Order {order} is {"valid" if mine else "invalid"} but the rule disagrees')
            valid_orders += mine
            STATS['orders'] += 1
        require(valid_orders >= 1, 'Some order is valid')
    _review_proof_explanation(problem, proof)
    return expected


def _review_proof_explanation(problem, proof):
    """The numbered lines of the worked proof form a valid proof, and the
    givens it says were used are the ones the lines use."""
    lines, n = [], len(problem['public']['response']['rows'])
    statements = sorted(proof.labels.items(), key=lambda kv: -len(kv[1]))
    reasons = sorted(proof.reason_labels.items(), key=lambda kv: -len(kv[1]))
    for entry in problem['explanation']:
        m = re.match(r"(\d+)\. ", entry)
        if not m:
            continue
        require(int(m[1]) == len(lines) + 1, 'Worked lines are numbered in order')
        rest = entry[m.end():]
        sid = next((s for s, label in statements if rest.startswith(label + ' ')), None)
        require(sid is not None, f'Worked line {entry[:60]!r} states a bank statement')
        rest = rest[len(proof.labels[sid]) + 1:]
        rid = next((r for r, label in reasons if rest.startswith(label)), None)
        require(rid is not None, f'Worked line {int(m[1])} gives a bank reason')
        lines.append((sid, rid))
    require(len(lines) == n and proof.proof_valid(lines), 'The worked proof is a valid proof')
    L = proof.L
    # The note on other valid orders: exactly the orders the rules allow.
    valid = proof.orders(lines)
    for entry in problem['explanation']:
        m = _full(r"Line 2 may come anywhere after line 1 and before the last line: it needs \$(\w')\$ from line 1, and landing \$(\w')\$ on \$(\w)\$ is used only by the conclusion\. Each other line needs the one before it\.", entry)
        if m:
            require(m[1] == m[2] == proof.Bp and m[3] == L['E'], 'Order note letters')
            rest = [i for i in range(n) if i != 1]
            described = {tuple(rest[:k] + [1] + rest[k:]) for k in range(1, n - 1)}
        elif entry == 'Lines 2 and 3 may come in either order: each needs only line 1, and line 4 uses both.':
            described = {tuple(range(n)), (0, 2, 1) + tuple(range(3, n))}
        else:
            continue
        require(described == valid, f'The order note allows {sorted(described)}, the rules allow {sorted(valid)}')
    for entry in problem['explanation']:
        m = _full(r"Only three of the six given facts were needed: (.+)\. That is why (SAS|ASA|SSS) works as a shortcut\.", entry)
        if not m:
            continue
        sides, angles = _congruences(_tex_list(m[1]), L)
        listed = {('side',) + tuple(sorted(s)) for s in sides} | {('angle', a) for a in angles}
        used = {('side',) + tuple(sorted(g[1:])) if g[0] == 'side' else g for g in proof.used_givens()}
        require(listed == used, f'The givens used are {sorted(used)}')
        used_sides = [set(g[1:]) for g in used if g[0] == 'side']
        used_angles = {g[1] for g in used if g[0] == 'angle'}
        if len(used_sides) == 2 and len(used_angles) == 1:
            name = 'SAS' if used_angles == used_sides[0] & used_sides[1] else 'SSA'
        elif len(used_sides) == 1 and len(used_angles) == 2:
            name = 'ASA' if used_angles == used_sides[0] else 'AAS'
        else:
            name = 'SSS' if len(used_sides) == 3 else '?'
        require(m[2] == name, f'The shortcut is {name}, not {m[2]}')


# ======================================================================
# Definition reasoning (single choice)

def _motions(text, L):
    parts = text.split(', then ')
    require(parts[0] == 'a translation', 'The sequence starts with a translation')
    out = ['translation']
    for part in parts[1:]:
        m = _full(r"a rotation about \$(\w)\$", part)
        if m:
            require(m[1] == L['D'], 'The rotation is about the landed vertex')
            out.append('rotation')
            continue
        m = _full(r"a reflection over line \$(\w)(\w)\$", part)
        require(m and (m[1], m[2]) == (L['D'], L['E']), f'Unknown motion {part!r}')
        out.append('reflection')
    return out


def _forward_option(label, L, target, motions):
    """(valid, kind) of an explanation of the forward direction: it is
    correct and complete when it lands the part on its match and names the
    invariant."""
    image = _image(L)
    m = _full(r"\$(\w)\\to (\w)\$ and \$(\w)\\to (\w)\$, so \$\\overline\{(\w)(\w)\}\$ lands on \$\\overline\{(\w)(\w)\}\$, and rigid motions keep length: \$(\w)(\w)=(\w)(\w)\$\.", label)
    if m:
        p, p2, q, q2, s0, s1, t0, t1, c0, c1, c2, c3 = m.groups()
        return (target[0] == 'side' and image.get(p) == p2 and image.get(q) == q2 and {p, q} == target[1]
                and (s0, s1) == (p, q) and (t0, t1) == (p2, q2) and (c0, c1, c2, c3) == (p, q, p2, q2)), 'landing'
    m = _full(r"\$(\w)\\to (\w)\$, and rays \$(\w)(\w)\$, \$(\w)(\w)\$ land on rays \$(\w)(\w)\$, \$(\w)(\w)\$; rigid motions keep angle measure\.", label)
    if m:
        v, w, a0, x, a1, y, b0, x2, b1, y2 = m.groups()
        others = {L[k] for k in 'ABC'} - {v}
        return (target == ('angle', v) and image.get(v) == w and a0 == a1 == v and {x, y} == others
                and b0 == b1 == w and image[x] == x2 and image[y] == y2), 'landing'
    # A part of the whole sequence is the whole only when it is the whole.
    if _full(r"The translation moves \$(\w)\$ and \$(\w)\$ by one vector, so it keeps their distance: \$(\w)(\w)=(\w)(\w)\$\.", label):
        return motions == ['translation'], 'translation_only'
    invalid = [
        # Circular: CPCTC is what this reasoning proves.
        (r"\$\\triangle (\w{3})\\cong\\triangle (\w{3})\$, and corresponding parts of congruent triangles are congruent\.", 'cpctc'),
        # Distance to the center is not the distance between the points.
        (r"The rotation keeps \$(\w)\$ and \$(\w)\$ the same distance from its center \$(\w)\$, so \$(\w)(\w)=(\w)(\w)\$\.", 'rotation_center'),
        # Appearance is not a reason.
        (r"\$\\overline\{(\w)(\w)\}\$ and \$\\overline\{(\w)(\w)\}\$ look equally long in the figure, so \$(\w)(\w)=(\w)(\w)\$\.", 'figure'),
        # Equal sums do not make single angles equal.
        (r"The angles of each triangle add to \$180\^\\circ\$, so the angles at \$(\w)\$ and \$(\w)\$ are equal\.", 'angle_sum'),
        # Two sides do not fix the angle between them.
        (r"The two sides that form \$\\angle (\w)\$ match the two that form \$\\angle (\w)\$, so the angles are equal\.", 'two_sides'),
        # Never says the angle lands on its match (and skips any reflection).
        (r"The translation slides \$\\angle (\w)\$ and the rotation turns it, so neither motion changes its size\.", 'slide_turn'),
    ]
    for pattern, kind in invalid:
        if _full(pattern, label):
            return False, kind
    raise ValueError(f'Unknown explanation option {label!r}')


def _forward_failure(clause, L, target):
    """The kind of wrong explanation a worked-answer clause correctly
    diagnoses, or None when the clause is not a true diagnosis here."""
    m = _full(r"distances from the center \$(\w)\$ say nothing about the length of \$\\overline\{(\w)(\w)\}\$", clause)
    if m:
        return 'rotation_center' if m[1] == L['D'] and target == ('side', {m[2], m[3]}) else None
    m = _full(r"keeping its size never shows that it lands on \$\\angle (\w)\$", clause)
    if m:
        return 'slide_turn' if target[0] == 'angle' and m[1] == _image(L)[target[1]] else None
    return {
        'citing CPCTC assumes what this argument proves': 'cpctc',
        'following only the translation leaves out the rest of the sequence': 'translation_only',
        'the look of the figure proves nothing': 'figure',
        'the angle sum does not make single angles equal': 'angle_sum',
        'two sides do not fix the angle between them': 'two_sides',
    }.get(clause)


def _forward(public):
    prompt, L = public['prompt'], _roles(public['prompt'])
    m = _full(r"A sequence of rigid motions \((.+?)\) maps \$\\triangle (\w{3})\$ onto \$\\triangle (\w{3})\$ with .+?\. Without citing CPCTC, which this reasoning proves, explain why (.+)\. Which explanation is correct and complete\?", prompt)
    require(m and m[2] == _tri(L, 'ABC') and m[3] == _tri(L, 'DEF'), 'Forward prompt')
    motions = _motions(m[1], L)
    image = _image(L)
    t = _full(r"\$\\overline\{(\w)(\w)\}\\cong\\overline\{(\w)(\w)\}\$", m[4])
    if t:
        require(image.get(t[1]) == t[3] and image.get(t[2]) == t[4], 'The target pairs corresponding sides')
        target = ('side', {t[1], t[2]})
    else:
        t = _full(r"\$\\angle (\w)\\cong\\angle (\w)\$", m[4])
        require(t and image.get(t[1]) == t[2], 'The target pairs corresponding angles')
        target = ('angle', t[1])
    # The figure: congruent triangles that the stated motions carry onto
    # each other (a translation to D, a turn about D, a flip over DE).
    P = _pair_figure(public['figure'], L, set(), set())
    A, B, C, D, E, F = (P[L[k]] for k in 'ABCDEF')
    v = _sub(D, A)
    B1, C1 = _add(B, v), _add(C, v)
    turn = math.atan2(_cross(_sub(B1, D), _sub(E, D)), _dot(_sub(B1, D), _sub(E, D)))
    Cp = _add(D, _rotate(_sub(C1, D), turn))
    if 'reflection' in motions:
        Cp = _reflect(Cp, D, E)
    require(_near(_add(D, _rotate(_sub(B1, D), turn)), E) and _near(Cp, F), 'The stated motions carry the figure onto its match')
    require('rotation' in motions, 'A rotation about D is part of the stated sequence')
    judged = {o['id']: _forward_option(o['label'], L, target, motions) for o in public['response']['options']}
    return [i for i, (ok, _) in judged.items() if ok], {i: kind for i, (ok, kind) in judged.items() if not ok}, L, target


# The two statements of the biconditional, as (assumed, reached).
P_TO_Q, Q_TO_P = ('P', 'Q'), ('Q', 'P')


def _argument(text, L):
    """Which implication a shown argument proves; it must be a sound one."""
    A, B, C, D, E, F = (L[k] for k in 'ABCDEF')
    abc, def_ = _tri(L, 'ABC'), _tri(L, 'DEF')
    forward = [
        rf"A sequence of rigid motions maps \$\\triangle {abc}\$ onto \$\\triangle {def_}\$ with \${A}\\to {D}\$, \${B}\\to {E}\$, \${C}\\to {F}\$\.",
        # Each part lands on its match ...
        rf"Then each side of \$\\triangle {abc}\$ lands on the matching side of \$\\triangle {def_}\$, and each angle on the matching angle\.",
        # ... and the invariants make the six pairs congruent.
        r"Rigid motions preserve distance and angle measure, so all six pairs of corresponding parts are congruent\.",
    ]
    converse = [
        r"The six pairs of corresponding parts are congruent\.",
        # Land A by a translation and B by a turn about D and the length AB = DE.
        rf"Translate \${A}\$ to \${D}\$ and rotate about \${D}\$ until the image of \${B}\$ is on ray \${D}{E}\$; since \${A}{B}={D}{E}\$, it is \${E}\$\.",
        # Put C on F's side.
        rf"Reflect over line \${D}{E}\$ if the image of \${C}\$ is across it from \${F}\$\.",
        # The angle at D gives the ray, the length AC = DF the point.
        rf"Since \$\\angle {A}\\cong\\angle {D}\$, the image of \${C}\$ is on ray \${D}{F}\$, and since \${A}{C}={D}{F}\$, it is \${F}\$\.",
        rf"So a sequence of rigid motions maps \$\\triangle {abc}\$ onto \$\\triangle {def_}\$\.",
    ]
    for steps, direction in ((forward, P_TO_Q), (converse, Q_TO_P)):
        if _full(' '.join(steps), text):
            return direction
    raise ValueError(f'Unknown or unsound argument {text!r}')


def _implication(label, L):
    """The implication an option states, or None when it states none."""
    abc, def_ = _tri(L, 'ABC'), _tri(L, 'DEF')
    table = [
        (r"If \$P\$, then \$Q\$\.", P_TO_Q),
        (r"If \$Q\$, then \$P\$\.", Q_TO_P),
        (r"If \$Q\$, then \$P\$: six congruent pairs give a sequence of rigid motions\.", Q_TO_P),
        (r"If \$P\$, then \$Q\$: rigid motions make all six pairs congruent\.", P_TO_Q),
    ]
    for pattern, direction in table:
        if _full(pattern, label):
            return direction
    # With the triangles' roles swapped: a sequence mapping one triangle onto
    # the other exists exactly when its inverse does, so these are the same
    # implications as the unswapped ones.
    m = _full(r"That if rigid motions map \$\\triangle (\w{3})\$ onto \$\\triangle (\w{3})\$, the six pairs are congruent\.", label)
    if m:
        require({m[1], m[2]} == {abc, def_}, 'The swapped statement names the two triangles')
        return P_TO_Q
    m = _full(r"That if the six pairs are congruent, rigid motions map \$\\triangle (\w{3})\$ onto \$\\triangle (\w{3})\$\.", label)
    if m:
        require({m[1], m[2]} == {abc, def_}, 'The swapped statement names the two triangles')
        return Q_TO_P
    invalid = [
        # One argument proves one direction.
        r"\$P\$ if and only if \$Q\$, since one argument proves both directions\.",
        # Congruence is defined by rigid motions; SSS is proved from it.
        r"Neither: only a criterion such as SSS can show two triangles are congruent\.",
        r"Nothing: one direction of an if-and-only-if statement is enough\.",
        # Orientation is in neither statement.
        r"That the two triangles have the same orientation, so no reflection is needed\.",
    ]
    if any(_full(p, label) for p in invalid):
        return None
    raise ValueError(f'Unknown direction option {label!r}')


def _direction_task(public):
    prompt = public['prompt']
    m = _full(r"Let \$P\$ be the statement: (.+?)\. Let \$Q\$ be the statement: (.+?)\. Argument: (.+) "
              r"(Which statement does this argument prove\?|This argument proves “if \$([PQ])\$, then \$([PQ])\$”\. What else must be proved to conclude “\$P\$ if and only if \$Q\$”\?)",
              prompt)
    require(m, 'Direction prompt')
    L = _roles(m[1])
    require(_full(r"a sequence of rigid motions " + MAPS, m[1]), 'P is the rigid-motion statement')
    _require_six(_tex_list(m[2]), L)
    proved = _argument(m[3], L)
    if m[5] is None:
        want = proved
    else:
        require((m[5], m[6]) == proved, 'The prompt names the direction the argument proves')
        want = (proved[1], proved[0])
    return [o['id'] for o in public['response']['options'] if _implication(o['label'], L) == want]


def _flaw_step(text, L):
    """(kind, tag): kind of a student step; tag is the defect, None if sound."""
    A, B, C, D, E, F = (L[k] for k in 'ABCDEF')
    abc, def_ = _tri(L, 'ABC'), _tri(L, 'DEF')
    if text == f"Translate by the vector from ${A}$ to ${D}$, so ${A}$ lands on ${D}$.":
        return 'translate', None
    m = _full(r"Rotate about (.+?) until the image of \$(\w)\$ is on ray \$(\w)(\w)\$\. (.+)", text)
    if m:
        require((m[2], m[3], m[4]) == (B, D, E), f'Rotation step {text!r}')
        if m[1] != f"${D}$":
            # Any other center moves the image of A off D.
            require(_full(r"the midpoint of \$\\overline\{(\w)(\w)\}\$|\$\w\$|the origin", m[1]), f'Center {m[1]!r}')
            return 'rotate', 'center'
        if m[5] == f"Distance is preserved, so the image is the point of ray ${D}{E}$ at distance ${A}{B}={D}{E}$ from ${D}$: it is ${E}$.":
            return 'rotate', None
        if m[5] == f"Since $\\angle {A}\\cong\\angle {D}$ and $\\angle {B}\\cong\\angle {E}$, the image is ${E}$.":
            # Angles do not say how far along the ray the image is.
            return 'rotate', 'angles'
        raise ValueError(f'Unknown rotation step {text!r}')
    if text == f"If the image of ${C}$ is across line ${D}{E}$ from ${F}$, reflect over line ${D}{E}$; this keeps ${D}$ and ${E}$ in place and moves the image of ${C}$ to ${F}$'s side.":
        return 'reflect', None
    if text == f"Two vertices now match, so the image of ${C}$ must be ${F}$.":
        # The third vertex may be the mirror image across DE.
        return 'pin', 'leap'
    if text == f"Angle measure is preserved and $\\angle {A}\\cong\\angle {D}$, so the image of ${C}$ is on ray ${D}{F}$; since ${A}{C}={D}{F}$, it is ${F}$.":
        return 'pin', None
    if text == f"Distance is preserved and ${A}{C}={D}{F}$, so the image of ${C}$ is ${F}$.":
        # A distance from D leaves a whole circle.
        return 'pin', 'distance'
    if text == f"The motions map $\\triangle {abc}$ onto $\\triangle {def_}$, so the triangles are congruent by the definition of congruence.":
        return 'conclude', None
    m = _full(rf"By (SAS|ASA|SSS), \$\\triangle {abc}\\cong\\triangle {def_}\$, so some sequence of rigid motions maps one onto the other\.", text)
    if m:
        # The argument promised only rigid motions and the definition; the
        # criteria are proved by this argument.
        return 'conclude', ('criterion', m[1])
    raise ValueError(f'Unknown student step {text!r}')


NEEDS = {'translate': set(), 'rotate': {'A'}, 'reflect': {'A', 'B'}, 'pin': {'A', 'B', 'side'}, 'conclude': {'A', 'B', 'C'}}
GIVES = {'translate': 'A', 'rotate': 'B', 'reflect': 'side', 'pin': 'C', 'conclude': 'done'}


def _accusation(text, L):
    """The defect an accusation alleges (None: a false general claim)."""
    A, B, C, D, E, F = (L[k] for k in 'ABCDEF')
    table = {
        f"rotating about a point other than ${D}$ moves the image of ${A}$ off ${D}$.": 'center',
        f"nothing pins the image of ${C}$ to ${F}$; it may be across line ${D}{E}$.": 'leap',
        f"equal angles do not fix how far along ray ${D}{E}$ the image of ${B}$ lands.": 'angles',
        f"distance ${D}{F}$ from ${D}$ allows a whole circle of points, not just ${F}$.": 'distance',
        # False claims: a translation carries any point to any point,
        # rotations keep distance, a reflection fixes its line, an angle and
        # a side on the right side of DE pin a point, area is not needed.
        f"a translation can move ${A}$ onto ${D}$ only if $\\overline{{{A}{B}}}\\parallel\\overline{{{D}{E}}}$.": None,
        f"rotations do not preserve distance, so the image of ${B}$ need not be ${E}$.": None,
        f"a reflection over line ${D}{E}$ moves ${D}$ and ${E}$ off their places.": None,
        "an angle and one side cannot fix a point; all three sides are needed.": None,
        "the argument must also show that the triangles have equal areas.": None,
    }
    if text in table:
        return table[text]
    m = _full(r"it cites (SAS|ASA|SSS), which is proved by this very argument\.", text)
    if m:
        return ('criterion', m[1])
    raise ValueError(f'Unknown accusation {text!r}')


def _flaw(public):
    prompt = public['prompt']
    m = _full(r"Given: (.+?)\. A student argues that a sequence of rigid motions maps (.+?), using only properties of rigid motions and the definition of congruence\. (Step 1: .+) Which is true of the argument\?", prompt)
    require(m, 'Flaw prompt')
    L = _roles(prompt)
    sides, angles = _require_six(_tex_list(m[1]), L)
    _pair_figure(public['figure'], L, sides, angles)
    parts = re.split(r"(?:^| )Step (\d+): ", m[3])
    require(parts[0] == '' and len(parts) % 2 == 1, 'Steps are numbered')
    steps = [_flaw_step(text.strip(), L) for text in parts[2::2]]
    require([int(n) for n in parts[1::2]] == list(range(1, len(steps) + 1)), 'Steps are numbered 1, 2, ...')
    # The first step that is unsound, or that uses a landing not yet made.
    state, first_bad = set(), None
    for i, (kind, tag) in enumerate(steps, 1):
        if tag is not None:
            first_bad = (i, tag)
            break
        if not NEEDS[kind] <= state:
            first_bad = (i, 'gap')
            break
        state.add(GIVES[kind])
    complete = first_bad is None and 'done' in state and steps[-1][0] == 'conclude'
    valid = []
    for o in public['response']['options']:
        label = o['label']
        if label == 'The argument is correct and complete.':
            ok = complete
        else:
            a = _full(r"Step (\d+) is wrong: (.+)", label)
            require(a, f'Unknown verdict {label!r}')
            k, alleged = int(a[1]), _accusation(a[2], L)
            require(1 <= k <= len(steps), 'The accusation names a shown step')
            if isinstance(alleged, tuple):
                # "proved by this very argument": only SAS is (it uses AB, angle A, AC).
                ok = first_bad == (k, alleged) and alleged[1] == 'SAS'
            else:
                ok = alleged is not None and first_bad == (k, alleged)
        if ok:
            valid.append(o['id'])
    return valid, steps, complete


def _reasoning(public):
    prompt = public['prompt']
    require(public['response']['kind'] == 'choice' and len(public['response']['options']) == 4, 'Four options')
    labels = [o['label'] for o in public['response']['options']]
    require(len(set(labels)) == 4, 'Options are distinct')
    STATS['options'] += 4
    if prompt.startswith('A sequence of rigid motions ('):
        valid = _forward(public)[0]
    elif prompt.startswith('Let $P$ be the statement:'):
        require(public.get('figure') is None, 'The direction items have no figure')
        valid = _direction_task(public)
    elif prompt.startswith('Given:'):
        valid = _flaw(public)[0]
    else:
        raise ValueError('Unknown reasoning task')
    require(len(valid) == 1, f'{len(valid)} valid options')
    return valid[0]


def _review_reasoning(problem):
    public = problem['public']
    expected = _reasoning(public)
    options = {o['id']: o['label'] for o in public['response']['options']}
    text = ' '.join(problem['explanation'])
    if public['prompt'].startswith('A sequence of rigid motions ('):
        if 'one cites CPCTC' in text:
            require(any('corresponding parts of congruent triangles' in label for label in options.values()),
                    'The explanation describes a CPCTC choice that is not shown')
        _, wrong, L, target = _forward(public)
        for e in problem['explanation']:
            m = _full(r"The other choices fail: (.+); (.+); and (.+)\.", e)
            if m:
                said = [_forward_failure(clause, L, target) for clause in m.groups()]
                require(None not in said and sorted(said) == sorted(wrong.values()),
                        f'The explanation diagnoses {said}, but the choices shown are {sorted(wrong.values())}')
    elif public['prompt'].startswith('Given:'):
        verdicts = [e for e in problem['explanation'] if e in options.values() or e.startswith('Every step follows')]
        for e in verdicts:
            require(e == options[expected] or (e.startswith('Every step follows') and options[expected] == 'The argument is correct and complete.'),
                    f'The explanation\'s verdict {e!r} is not the valid option')
    else:
        m = re.search(r"So it proves “if \$([PQ])\$, then \$([PQ])\$”", text)
        if m:
            require(_implication(f"If ${m[1]}$, then ${m[2]}$.", _roles(public['prompt'])) is not None, 'Readable')
            require(options[expected].startswith(f"If ${m[1]}$, then ${m[2]}$"), 'The explanation names the proved direction')
        m = re.search(r"What remains is the other direction, “if \$([PQ])\$, then \$([PQ])\$”", text)
        if m:
            require(options[expected].startswith(f"If ${m[1]}$, then ${m[2]}$"), 'The explanation names the missing direction')
    return expected


# ======================================================================
# Coordinates (multi-part choice)

def _quarter(u, degrees):
    """Exact counterclockwise rotation of an integer vector by a multiple of 90."""
    require(degrees % 90 == 0, f'Only quarter turns are exact: {degrees}')
    x, y = u
    return {0: (x, y), 90: (-y, x), 180: (-x, -y), 270: (y, -x)}[degrees % 360]


def _side_exact(p, a, b):
    c = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])
    return (c > 0) - (c < 0)


def _reflect_exact(p, a, b):
    ux, uy = b[0] - a[0], b[1] - a[1]
    t = Fraction((p[0] - a[0]) * ux + (p[1] - a[1]) * uy, ux * ux + uy * uy)
    return (2 * (a[0] + t * ux) - p[0], 2 * (a[1] + t * uy) - p[1])


def _sq(p, q):
    return (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2


class _Grid:
    def __init__(self, public):
        prompt = public['prompt']
        head, sep, _ = prompt.partition('. The six corresponding parts of ')
        require(sep, 'Coordinate prompt')
        found = re.findall(r"\$(\w)\((-?\d+),(-?\d+)\)\$", head)
        require(len(found) == 6, 'Six labelled vertices')
        L = self.L = _roles(prompt)
        self.P = {name: (int(x), int(y)) for name, x, y in found}
        require([name for name, _, _ in found] == [L[k] for k in 'ABCDEF'], 'Vertices are listed in role order')
        named = _full(r"Triangle \$(\w{3})\$ has vertices .+; triangle \$(\w{3})\$ has vertices .+", head)
        if named:
            require((named[1], named[2]) == (_tri(L, 'ABC'), _tri(L, 'DEF')), 'Each triangle lists its own vertices')
        m = re.search(r"\$ and \$\\triangle \w{3}\$ are congruent: (.+?)\. Build the sequence of rigid motions that maps ", prompt)
        require(m and prompt.endswith(', and justify each landing.'), 'Coordinate prompt shape')
        self.sides, self.angles = _require_six(_tex_list(m[1]), L)
        A, B, C, D, E, F = (self.P[L[k]] for k in 'ABCDEF')
        # Congruent under the correspondence (SSS on exact squared lengths
        # fixes every angle too), scalene, not degenerate, on the grid.
        require((_sq(A, B), _sq(B, C), _sq(C, A)) == (_sq(D, E), _sq(E, F), _sq(F, D)), 'Corresponding sides are equal')
        require(len({_sq(A, B), _sq(B, C), _sq(C, A)}) == 3, 'Scalene')
        require(_side_exact(C, A, B) != 0, 'Not degenerate')
        require(all(abs(c) <= 8 for p in self.P.values() for c in p), 'Vertices lie in [-8, 8]')
        boxes = [[min(p[i] for p in tri) for i in (0, 1)] + [max(p[i] for p in tri) for i in (0, 1)] for tri in ((A, B, C), (D, E, F))]
        (ax0, ay0, ax1, ay1), (dx0, dy0, dx1, dy1) = boxes
        require(ax1 < dx0 or dx1 < ax0 or ay1 < dy0 or dy1 < ay0, 'The triangles do not overlap')
        self.v = (D[0] - A[0], D[1] - A[1])
        require(self.v != (0, 0), 'A real translation')
        B1 = (B[0] + self.v[0], B[1] + self.v[1])
        self.B1 = B1
        turns = [t for t in (0, 90, 180, 270) if _add(D, _quarter(_sub(B1, D), t)) == E]
        require(len(turns) == 1, 'A quarter turn about D carries the image of B to E')
        self.theta = turns[0]
        self.C1 = _add(D, _quarter((C[0] - A[0], C[1] - A[1]), self.theta))
        s1, sF = _side_exact(self.C1, D, E), _side_exact(F, D, E)
        require(s1 != 0 and sF != 0, 'No vertex on line DE')
        self.reflect = s1 != sF
        landed = _reflect_exact(self.C1, D, E) if self.reflect else self.C1
        require(tuple(landed) == F, 'The construction lands C on F')
        require(self.reflect == (_side_exact(C, A, B) != _side_exact(F, D, E)), 'A reflection is needed exactly when the orientations differ')
        self._figure(public['figure'])

    def _figure(self, figure):
        require(figure is not None and figure.get('kind') == 'scene', 'A grid figure')
        graphs = [e for e in figure['scene']['elements'] if e.get('type') == 'graph']
        require(len(graphs) == 1, 'One coordinate grid')
        g = graphs[0]
        pts = {p['label']: (p['x'], p['y']) for p in g.get('points', [])}
        require(pts == self.P, 'The plotted vertices are the stated ones')
        drawn = {frozenset([tuple(s['from']), tuple(s['to'])]) for s in g.get('segments', [])}
        L = self.L
        for t in ('ABC', 'DEF'):
            for i in range(3):
                p, q = self.P[L[t[i]]], self.P[L[t[(i + 1) % 3]]]
                require(frozenset([p, q]) in drawn, f'Side {L[t[i]]}{L[t[(i + 1) % 3]]} is drawn')
        # Axis numbers sit on the axes; a vertex there would crowd its name.
        require(all(x != 0 and y != 0 for x, y in self.P.values()), 'No vertex lies on an axis')
        floats = {name: (float(x), float(y)) for name, (x, y) in self.P.items()}
        _check_marks(figure['scene']['elements'], floats, L, self.sides, self.angles)

    def point(self, name):
        if name == 'the origin':
            return (0, 0)
        m = _full(r"\$(\w)\$", name)
        require(m and m[1] in self.P, f'Unknown center {name!r}')
        return self.P[m[1]]

    def option_valid(self, part, label):
        L, P = self.L, self.P
        A, B, C, D, E, F = (L[k] for k in 'ABCDEF')
        if part == 'move':
            m = _full(r"\$\(x,y\)\\to\(x([+-]\d+)?,\\,y([+-]\d+)?\)\$", label)
            require(m, f'Unreadable translation {label!r}')
            return (int(m[1] or 0), int(m[2] or 0)) == self.v
        if part == 'turn':
            if label == 'No rotation is needed':
                return self.B1 == P[E]
            m = _full(r"\$(\d+)\^\\circ\$(?: (counterclockwise|clockwise))? about (.+)", label)
            require(m, f'Unreadable rotation {label!r}')
            t = int(m[1])
            require(m[2] is not None or t % 180 == 0, 'A turn other than a half turn names its direction')
            t = -t if m[2] == 'clockwise' else t
            center = self.point(m[3])

            def spin(p):
                return _add(center, _quarter(_sub(p, center), t % 360))
            # It continues the sequence: D stays landed and B's image reaches E.
            return spin(P[D]) == P[D] and spin(self.B1) == P[E]
        if part == 'land':
            m = _full(r"It is on ray \$(\w)(\w)\$ at distance \$(\w)(\w)=(\w)(\w)\$ from \$(\w)\$", label)
            if m:
                return (m.groups() == (D, E, A, B, D, E, D) and frozenset((A, B)) in self.sides
                        and _sq(P[A], P[B]) == _sq(P[D], P[E]))
            invalid = [
                r"A rotation can move any point onto any other point",  # not about the turn about D used here
                # False: a turn about a fixed center keeps every distance to that center.
                r"A rotation about \$\w\$ can move any point onto any other point",
                r"Its \$x\$-coordinate equals the \$x\$-coordinate of \$\w\$",  # one coordinate does not fix a point
                r"Rigid motions preserve angles, and \$\\angle \w\\cong\\angle \w\$",  # an angle does not fix a distance
            ]
            require(any(_full(p, label) for p in invalid), f'Unknown landing reason {label!r}')
            return False
        if part == 'flip':
            m = _full(r"Yes: the image of \$(\w)\$ is across line \$(\w)(\w)\$ from \$(\w)\$", label)
            if m:
                return m.groups() == (C, D, E, F) and self.reflect
            m = _full(r"No: the image of \$(\w)\$ is on \$(\w)\$'s side of line \$(\w)(\w)\$", label)
            if m:
                return m.groups() == (C, F, D, E) and not self.reflect
            # False generalizations: the orientation decides.
            require(label in ('Yes: congruent triangles always need a reflection', 'No: a reflection is never needed after a rotation'),
                    f'Unknown reflection option {label!r}')
            return False
        if part == 'pin':
            m = _full(r"\$\\angle (\w)\\cong\\angle (\w)\$ puts it on ray \$(\w)(\w)\$; \$(\w)(\w)=(\w)(\w)\$ puts it at \$(\w)\$", label)
            if m:
                return m.groups() == (A, D, D, F, A, C, D, F, F) and A in self.angles and frozenset((A, C)) in self.sides
            invalid = [
                r"Two vertices already match, so the third must too",  # mirror image
                r"Distance is preserved, so it is \$\w\w\$ from \$\w\$",  # a whole circle
                r"The two triangles look the same in the figure",  # appearance
            ]
            require(any(_full(p, label) for p in invalid), f'Unknown pinning reason {label!r}')
            return False
        raise ValueError(part)


BLANK_LABELS = [
    ('move', r"1\. The translation that carries \$(\w)\$ to \$(\w)\$", 'AD'),
    ('turn', r"2\. The rotation that then carries the image of \$(\w)\$ to \$(\w)\$", 'BE'),
    ('land', r"3\. Why the image of \$(\w)\$ is exactly \$(\w)\$", 'BE'),
    ('flip', r"4\. Is a reflection over line \$(\w)(\w)\$ needed next\?", 'DE'),
    ('pin', r"5\. Why the image of \$(\w)\$ then lands exactly on \$(\w)\$", 'CF'),
]


def _coordinates(public):
    grid = _Grid(public)
    L = grid.L
    response = public['response']
    require(response['kind'] == 'multi-part-choice', 'Multi-part choice')
    blanks = response['blanks']
    require(len(blanks) == len(BLANK_LABELS), 'Five parts')
    key = {}
    for blank, (part, pattern, roles) in zip(blanks, BLANK_LABELS):
        m = _full(pattern, blank['label'])
        require(m and list(m.groups()) == [L[r] for r in roles], f'Part label {blank["label"]!r}')
        labels = [o['label'] for o in blank['options']]
        require(len(labels) == 4 and len(set(labels)) == 4, 'Four distinct options per part')
        ok = [o['id'] for o in blank['options'] if grid.option_valid(part, o['label'])]
        STATS['options'] += 4
        require(len(ok) == 1, f'Part {blank["label"]!r} has {len(ok)} valid options')
        key[blank['id']] = ok[0]
    return grid, _dumps(key)


def _review_coordinates(problem):
    grid, expected = _coordinates(problem['public'])
    L, P = grid.L, grid.P
    text = ' '.join(problem['explanation'])
    m = re.search(r"so the translation is (\$\(x,y\)\\to\(.+?\)\$)", text)
    if m:
        require(grid.option_valid('move', m[1]), 'The explanation names the translation')
    A, B, C, D, E, F = (L[k] for k in 'ABCDEF')
    pD, pE = P[D], P[E]

    def at(x, y):
        return (int(x), int(y))
    # B after the translation, and the steps from D that decide the turn.
    for m in re.finditer(r"\$(\w)\$ is at \$(\w)_1\((-?\d+),(-?\d+)\)\$", text):
        require(m[1] == m[2] == B and at(m[3], m[4]) == grid.B1, 'The explanation places B after the translation')
    for m in re.finditer(r"the step to it is \$\((-?\d+),(-?\d+)\)\$ and the step to \$(\w)\$ is \$\((-?\d+),(-?\d+)\)\$", text):
        require(at(m[1], m[2]) == _sub(grid.B1, pD) and m[3] == E and at(m[4], m[5]) == _sub(pE, pD), 'The explanation\'s steps from D')
    for m in re.finditer(r"the step from \$(\w)\$ to it, \$\((-?\d+),(-?\d+)\)\$, is the step from \$(\w)\$ to \$(\w)\$", text):
        require(m[1] == m[4] == D and m[5] == E and at(m[2], m[3]) == _sub(grid.B1, pD) == _sub(pE, pD),
                'The explanation says the translation already lands B on E')
    for m in re.finditer(r"so a turn of (.+?) carries \$(\w)_1\$ to \$(\w)\((-?\d+),(-?\d+)\)\$", text):
        require(m[2] == B and m[3] == E and grid.option_valid('turn', m[1]), 'The explanation names the turn')
    for m in re.finditer(r"A \$(\d+)\^\\circ\$ turn about \$(\w)\$ goes only half as far, to \$\((-?\d+),(-?\d+)\)\$", text):
        t = int(m[1])
        require(m[2] == D and 2 * t == grid.theta, 'Half as far is half the turn')
        require(_add(pD, _quarter(_sub(grid.B1, pD), t)) == at(m[3], m[4]), 'The half turn lands where the explanation says')
    for m in re.finditer(r"Turning \$(\d+)\^\\circ\$ counterclockwise instead goes the other way round, to \$\((-?\d+),(-?\d+)\)\$", text):
        t = int(m[1])
        # The other way round: the same amount clockwise.
        require(grid.theta not in (0, 180) and (t + grid.theta) % 360 == 0, 'The other way round reverses the turn')
        require(_add(pD, _quarter(_sub(grid.B1, pD), t)) == at(m[2], m[3]), 'The reversed turn lands where the explanation says')
    if re.search(r"any turn about \$\w\$ would carry it off", text):
        require(grid.theta == 0, 'Only a point already on E is carried off by every turn')
    if 'The translation puts' in text:
        require(grid.theta == 0, 'The translation alone lands B only when no turn is needed')
    if 'The rotation keeps' in text:
        require(grid.theta != 0, 'The explanation speaks of a rotation only when one is used')
    for m in re.finditer(r"the image of \$(\w)\$ is \$(\w)_(\d)\((-?\d+),(-?\d+)\)\$", text):
        require(m[1] == m[2] == C and at(m[4], m[5]) == grid.C1, 'The explanation places C before any reflection')
        require(m[3] == ('1' if grid.theta == 0 else '2'), 'C_1 after the translation, C_2 after the rotation too')
    if re.search(r"It is across line \$\w\w\$ from", text):
        require(grid.reflect, 'The image of C is across line DE only when a reflection is needed')
    if re.search(r"It is on the same side of line \$\w\w\$ as", text):
        require(not grid.reflect, 'The image of C is on F\'s side only when no reflection is needed')
    m = re.search(r"\$\w\\to \w\\to \w\$ runs (counterclockwise|clockwise) and \$\w\\to \w\\to \w\$ runs (counterclockwise|clockwise), so (a|no) reflection will be needed", text)
    if m:
        A, B, C, D, E, F = (P[L[k]] for k in 'ABCDEF')
        require((WAY[m[1]], WAY[m[2]]) == (_side_exact(C, A, B), _side_exact(F, D, E)), 'The explanation reads the orientations')
        require((m[3] == 'a') == grid.reflect, 'The explanation says whether a reflection is needed')
    if 'no rotation is needed' in text:
        require(grid.theta == 0, 'The explanation says no rotation is needed only when none is')
    if 'the opposite direction misses' in text:
        # A half turn either way is the same turn, and with no turn there is
        # no direction to reverse.
        require(grid.theta in (90, 270), f'The opposite direction of a {grid.theta} degree turn does not miss')
    return expected


# ======================================================================
# Entry points

def _expected(public):
    t = public['templateId']
    require(t in SUPPORTED, f'Unsupported template {t}')
    if t == PROOF:
        return _proof_expected(public)[1]
    if t == REASONING:
        return _reasoning(public)
    return _coordinates(public)[1]


def solve(public):
    return _expected(public)


def review_problem(problem):
    t = problem['public']['templateId']
    require(t in SUPPORTED, f'Unsupported template {t}')
    STATS['cases'] += 1
    if t == PROOF:
        return _review_proof(problem)
    if t == REASONING:
        return _review_reasoning(problem)
    return _review_coordinates(problem)


# ======================================================================
# Self test: hand-written fixtures, and mutations that must be rejected

def _rejects(problem, why):
    try:
        got = review_problem(problem)
    except (ValueError, KeyError, TypeError, IndexError, AttributeError, StopIteration):
        return
    if got != problem['answer']:
        return
    raise ValueError(f'Self-test mutation accepted: {why}')


def _copy(value):
    return json.loads(json.dumps(value))


SIDE_TICKS = {'AB': 1, 'BC': 2, 'CA': 3, 'DE': 1, 'EF': 2, 'FD': 3}


def _fixture_marks(pts, L):
    """One, two and three ticks on corresponding sides; one, two and three
    arcs at corresponding angles."""
    els = []
    for side, n in SIDE_TICKS.items():
        p, q = pts[L[side[0]]], pts[L[side[1]]]
        u = _sub(q, p)
        unit = (u[0] / _length(u), u[1] / _length(u))
        mid = ((p[0] + q[0]) / 2, (p[1] + q[1]) / 2)
        for k in range(n):
            off = (k - (n - 1) / 2) * 0.2
            els.append({'type': 'tick', 'at': [mid[0] + unit[0] * off, mid[1] + unit[1] * off]})
    for tri in ('ABC', 'DEF'):
        for i, k in enumerate(tri):
            v = pts[L[k]]
            a, b = (_direction(_sub(pts[L[x]], v)) for x in tri if x != k)
            lo, hi = (a, b) if (b - a) % 360 <= 180 else (b, a)
            hi = lo + (hi - lo) % 360
            for j in range(i + 1):
                els.append({'type': 'arc', 'center': list(v), 'r': 0.5 + 0.1 * j, 'from': lo, 'to': hi})
    return els


def _fixture_scene(pts, L, marked):
    """A two-triangle scene: names, sides and (optionally) the six marks."""
    els = [{'type': 'text', 'at': list(pts[L[k]]), 'text': L[k]} for k in 'ABCDEF']
    for side in SIDE_TICKS:
        els.append({'type': 'segment', 'from': list(pts[L[side[0]]]), 'to': list(pts[L[side[1]]])})
    if marked:
        els += _fixture_marks(pts, L)
    return {'kind': 'scene', 'scene': {'v': 1, 'title': 'fixture', 'elements': els}}


ABC = {'A': 'A', 'B': 'B', 'C': 'C', 'D': 'D', 'E': 'E', 'F': 'F'}
SIX = ("$\\overline{AB}\\cong\\overline{DE}$, $\\overline{BC}\\cong\\overline{EF}$, $\\overline{CA}\\cong\\overline{FD}$, "
       "$\\angle A\\cong\\angle D$, $\\angle B\\cong\\angle E$ and $\\angle C\\cong\\angle F$")
SAME = {'A': (0, 0), 'B': (4, 0), 'C': (1, 3), 'D': (9, 1), 'E': (9, 5), 'F': (6, 2)}
FLIPPED = {'A': (0, 0), 'B': (4, 0), 'C': (1, 3), 'D': (9, 1), 'E': (9, 5), 'F': (12, 2)}
CONSTRUCT = "Translate $\\triangle ABC$ by the vector from $A$ to $D$, then rotate about $D$ until the image of $B$ is on ray $DE$; call the image $\\triangle DB'C'$."
CONCLUDE = "The motions take $A$, $B$, $C$ to $D$, $E$, $F$, so they map $\\triangle ABC$ onto $\\triangle DEF$: $\\triangle ABC\\cong\\triangle DEF$."
R_TR = "A translation can carry $A$ to $D$; a rotation about $D$ fixes $D$ and can turn any ray from $D$ onto any other."
R_DIST = "Rigid motions preserve distance, and a ray has exactly one point at a given distance from its endpoint."
R_ANG = "Rigid motions preserve angle measure, and on one side of line $DE$ just one ray from $D$ (or from $E$) makes a given angle with $\\overline{DE}$."
R_DEF = "Definition of congruence: a sequence of rigid motions maps one figure onto the other."


def _proof_fixture(mode, statements, reasons, claims, lines, ways, pts, shown=None, fill_blank=()):
    """lines: canonical [(sid, rid)]."""
    task = {'build': 'Build the proof: choose a statement and a reason for each line.',
            'fill': 'The statements are shown. Choose the reason for each blank line.',
            'order': 'The lines of the proof are shown out of order. Put them in order.'}[mode]
    prompt = (f"Use the figure. Given: {SIX}; $A\\to B\\to C$ runs {ways[0]} and $D\\to E\\to F$ runs {ways[1]}. "
              "Prove that a sequence of rigid motions maps $\\triangle ABC$ onto $\\triangle DEF$ with $A\\to D$, $B\\to E$, $C\\to F$, "
              "so $\\triangle ABC\\cong\\triangle DEF$. The proof may not cite CPCTC, SSS, SAS or ASA, because those are proved "
              f"from this definition of congruence. {task}")

    def field(bank, given=None):
        f = {'kind': 'choice', 'label': 'Statement' if bank == 'statements' else 'Reason', 'bank': bank}
        if given is not None:
            f['given'] = given
        return f
    if mode == 'build':
        rows = [{'id': f'r{i + 1}', 'fields': [field('statements'), field('reasons')]} for i in range(len(lines))]
        answer = [[s, r] for s, r in lines]
    elif mode == 'fill':
        rows = [{'id': f'r{i + 1}', 'fields': [field('statements', s), field('reasons', None if i in fill_blank else r)]}
                for i, (s, r) in enumerate(lines)]
        answer = [['', r if i in fill_blank else ''] for i, (s, r) in enumerate(lines)]
    else:
        rows = [{'id': f'r{j + 1}', 'fields': [field('statements', lines[i][0]), field('reasons', lines[i][1])]} for j, i in enumerate(shown)]
        answer = [f'r{shown.index(i) + 1}' for i in range(len(lines))]
    goal = next(s for s, label in statements if label == CONCLUDE)
    response = {'kind': 'structured-work', 'label': 'Your proof', 'layout': 'proof', 'mode': mode, 'goal': CONCLUDE, 'rows': rows,
                'banks': [{'id': 'statements', 'label': 'Statement', 'options': [{'id': i, 'label': t} for i, t in statements]},
                          {'id': 'reasons', 'label': 'Reason', 'options': [{'id': i, 'label': t} for i, t in reasons]}]}
    labels, rlabels = dict(statements), dict(reasons)
    explanation = ['Congruent means a sequence of rigid motions maps one figure onto the other.']
    explanation += [f"{k + 1}. {labels[s]} {rlabels[r]} Why it holds." for k, (s, r) in enumerate(lines)]
    return {'public': {'templateId': PROOF, 'seed': 'fixture', 'prompt': prompt, 'response': response, 'figure': _fixture_scene(pts, ABC, True)},
            'answer': _dumps(answer), 'workGrading': {'mode': 'proof', 'goal': goal, 'claims': claims}, 'explanation': explanation}


def _sas_fixture(mode='build', shown=None, fill_blank=()):
    statements = [
        ('sa', CONCLUDE),
        ('sb', "$C'=F$, because $B'=E$."),
        ('sc', CONSTRUCT),
        ('sd', "$m\\angle EDC'=m\\angle A=m\\angle D$, so $C'$ is on ray $DF$."),
        ('se', "$C'$ and $F$ are on the same side of line $DE$."),
        ('sf', "$DB'=AB=DE$, so $B'=E$."),
        ('sg', "$DC'=AC=DF$, so $C'=F$."),
        ('sh', "Rotate $\\triangle ABC$ about $D$ until $B$ lands on $E$."),
    ]
    reasons = [
        ('ra', R_DEF),
        ('rb', "Corresponding parts of congruent triangles are congruent (CPCTC)."),
        ('rc', R_TR),
        ('rd', R_DIST),
        ('re', "The two triangles look the same size and shape in the figure."),
        ('rf', R_ANG),
        ('rg', "Translations and rotations preserve orientation, and the two triangles have the same orientation."),
        ('rh', "Once two vertices land on their matches, the third vertex must land on its match."),
        ('ri', "The SAS congruence criterion."),
    ]
    claims = {'sc': {'rc': [[]]}, 'sf': {'rd': [['sc']]}, 'se': {'rg': [['sc']]}, 'sd': {'rf': [['se']]}, 'sg': {'rd': [['sd']]},
              'sa': {'ra': [['sf', 'sg']]}}
    lines = [('sc', 'rc'), ('sf', 'rd'), ('se', 'rg'), ('sd', 'rf'), ('sg', 'rd'), ('sa', 'ra')]
    p = _proof_fixture(mode, statements, reasons, claims, lines, ('counterclockwise', 'counterclockwise'), SAME, shown, fill_blank)
    p['explanation'].append(SAS_NOTE)
    p['explanation'].append("Only three of the six given facts were needed: $\\overline{AB}\\cong\\overline{DE}$, $\\angle A\\cong\\angle D$ "
                            "and $\\overline{CA}\\cong\\overline{FD}$. That is why SAS works as a shortcut.")
    return p


SAS_NOTE = ("Line 2 may come anywhere after line 1 and before the last line: it needs $B'$ from line 1, and landing $B'$ on $E$ "
            "is used only by the conclusion. Each other line needs the one before it.")
SWAP_NOTE = 'Lines 2 and 3 may come in either order: each needs only line 1, and line 4 uses both.'


def _asa_fixture(mode='order', shown=(4, 1, 5, 0, 3, 2)):
    statements = [
        ('s1', CONSTRUCT),
        ('s2', "$DB'=AB=DE$, so $B'=E$."),
        ('s3', "$C'$ is across line $DE$ from $F$; reflecting over line $DE$ gives $\\triangle DB'C''$, with $C''$ on $F$'s side."),
        ('s4', "$m\\angle EDC''=m\\angle A=m\\angle D$ and $m\\angle DEC''=m\\angle B=m\\angle E$, so $C''$ is on rays $DF$ and $EF$."),
        ('s5', "Rays $DF$ and $EF$ meet only at $F$, so $C''=F$."),
        ('s6', CONCLUDE),
        ('s7', "$C''=F$, because $\\triangle ABC\\cong\\triangle DEF$."),
        ('s8', "$C'$ and $F$ are on the same side of line $DE$."),
    ]
    reasons = [
        ('ra', R_TR), ('rb', R_DIST),
        ('rc', "Translations and rotations preserve orientation, which differs here; a reflection fixes its line and swaps the line's two sides."),
        ('rd', R_ANG), ('re', "Two different lines meet in at most one point."), ('rf', R_DEF),
        ('rg', "A dilation can make matching sides the same length."), ('rh', "Reflections preserve orientation."),
        ('ri', "A rotation about $D$ can carry any point onto any other point."), ('rj', "The ASA congruence criterion."),
    ]
    claims = {'s1': {'ra': [[]]}, 's2': {'rb': [['s1']]}, 's3': {'rc': [['s1']]}, 's4': {'rd': [['s3', 's2']]}, 's5': {'re': [['s4']]},
              's6': {'rf': [['s2', 's5']]}}
    lines = [('s1', 'ra'), ('s2', 'rb'), ('s3', 'rc'), ('s4', 'rd'), ('s5', 're'), ('s6', 'rf')]
    p = _proof_fixture(mode, statements, reasons, claims, lines, ('counterclockwise', 'clockwise'), FLIPPED, list(shown) if shown else None)
    p['explanation'].append(SWAP_NOTE)
    p['explanation'].append("Only three of the six given facts were needed: $\\overline{AB}\\cong\\overline{DE}$, $\\angle A\\cong\\angle D$ "
                            "and $\\angle B\\cong\\angle E$. That is why ASA works as a shortcut.")
    return p


def _choice_fixture(prompt, options, answer, figure=None, explanation=None):
    public = {'templateId': REASONING, 'seed': 'fixture', 'prompt': prompt,
              'response': {'kind': 'choice', 'label': 'Choose one answer', 'options': [{'id': f'option-{c}', 'label': t} for c, t in zip('abcd', options)]}}
    if figure is not None:
        public['figure'] = figure
    return {'public': public, 'answer': f'option-{answer}', 'explanation': explanation or ['x']}


def _flaw_prompt(step4):
    steps = [
        "Translate by the vector from $A$ to $D$, so $A$ lands on $D$.",
        "Rotate about $D$ until the image of $B$ is on ray $DE$. Distance is preserved, so the image is the point of ray $DE$ at distance $AB=DE$ from $D$: it is $E$.",
        "If the image of $C$ is across line $DE$ from $F$, reflect over line $DE$; this keeps $D$ and $E$ in place and moves the image of $C$ to $F$'s side.",
        step4,
        "The motions map $\\triangle ABC$ onto $\\triangle DEF$, so the triangles are congruent by the definition of congruence.",
    ]
    board = ' '.join(f'Step {i + 1}: {s}' for i, s in enumerate(steps))
    return (f"Given: {SIX}. A student argues that a sequence of rigid motions maps $\\triangle ABC$ onto $\\triangle DEF$ with "
            f"$A\\to D$, $B\\to E$, $C\\to F$, using only properties of rigid motions and the definition of congruence. {board} "
            "Which is true of the argument?")


P_TEXT = "a sequence of rigid motions maps $\\triangle ABC$ onto $\\triangle DEF$ with $A\\to D$, $B\\to E$, $C\\to F$"
FORWARD_ARGUMENT = ("A sequence of rigid motions maps $\\triangle ABC$ onto $\\triangle DEF$ with $A\\to D$, $B\\to E$, $C\\to F$. "
                    "Then each side of $\\triangle ABC$ lands on the matching side of $\\triangle DEF$, and each angle on the matching angle. "
                    "Rigid motions preserve distance and angle measure, so all six pairs of corresponding parts are congruent.")
CONVERSE_ARGUMENT = ("The six pairs of corresponding parts are congruent. Translate $A$ to $D$ and rotate about $D$ until the image of $B$ is on ray $DE$; "
                     "since $AB=DE$, it is $E$. Reflect over line $DE$ if the image of $C$ is across it from $F$. Since $\\angle A\\cong\\angle D$, "
                     "the image of $C$ is on ray $DF$, and since $AC=DF$, it is $F$. So a sequence of rigid motions maps $\\triangle ABC$ onto $\\triangle DEF$.")


def _grid_fixture(points, options, answer, explanation):
    names = 'ABCDEF'
    coords = [f"${n}({x},{y})$" for n, (x, y) in zip(names, points)]
    prompt = (f"Triangle $ABC$ has vertices {coords[0]}, {coords[1]} and {coords[2]}; triangle $DEF$ has vertices {coords[3]}, {coords[4]} "
              f"and {coords[5]}. The six corresponding parts of $\\triangle ABC$ and $\\triangle DEF$ are "
              f"congruent: {SIX}. Build the sequence of rigid motions that maps $\\triangle ABC$ onto $\\triangle DEF$ with $A\\to D$, "
              "$B\\to E$, $C\\to F$, and justify each landing.")
    labels = ['1. The translation that carries $A$ to $D$', '2. The rotation that then carries the image of $B$ to $E$',
              '3. Why the image of $B$ is exactly $E$', '4. Is a reflection over line $DE$ needed next?',
              '5. Why the image of $C$ then lands exactly on $F$']
    ids = ['move', 'turn', 'land', 'flip', 'pin']
    blanks = [{'id': i, 'label': lab, 'options': [{'id': c, 'label': t} for c, t in zip('abcd', opts)]} for i, lab, opts in zip(ids, labels, options)]
    segs = [{'from': list(points[i]), 'to': list(points[j])} for i, j in ((0, 1), (1, 2), (2, 0), (3, 4), (4, 5), (5, 3))]
    graph = {'type': 'graph', 'x': [-9, 9], 'y': [-9, 9], 'grid': 1, 'labels': 'ends',
             'points': [{'x': x, 'y': y, 'label': n} for n, (x, y) in zip(names, points)], 'segments': segs}
    marks = _fixture_marks({n: (float(x), float(y)) for n, (x, y) in zip(names, points)}, ABC)
    public = {'templateId': COORDINATES, 'seed': 'fixture', 'prompt': prompt,
              'response': {'kind': 'multi-part-choice', 'label': 'Choose an option for each step', 'layout': 'slots', 'blanks': blanks},
              'figure': {'kind': 'scene', 'scene': {'v': 1, 'title': 'fixture', 'elements': [graph] + marks}}}
    return {'public': public, 'answer': _dumps(dict(zip(ids, answer))), 'explanation': explanation}


GRID_COMMON = [
    ['It is on ray $DE$ at distance $AB=DE$ from $D$', 'A rotation about $D$ can move any point onto any other point',
     'Its $x$-coordinate equals the $x$-coordinate of $E$', 'Rigid motions preserve angles, and $\\angle B\\cong\\angle E$'],
    ["Yes: the image of $C$ is across line $DE$ from $F$", "No: the image of $C$ is on $F$'s side of line $DE$",
     'Yes: congruent triangles always need a reflection', 'No: a reflection is never needed after a rotation'],
    ['$\\angle A\\cong\\angle D$ puts it on ray $DF$; $AC=DF$ puts it at $F$', 'Two vertices already match, so the third must too',
     'Distance is preserved, so it is $AC$ from $D$', 'The two triangles look the same in the figure'],
]


def self_test():
    # --- proof: SAS, same orientation, build
    good = _sas_fixture()
    require(review_problem(good) == good['answer'], 'SAS build fixture')
    require(solve(good['public']) == good['answer'], 'SAS build solve')
    bad = _copy(good)
    key = json.loads(bad['answer'])
    key[5][1] = 'rb'
    bad['answer'] = _dumps(key)
    _rejects(bad, 'CPCTC as the last reason')
    bad = _copy(good)
    key = json.loads(bad['answer'])
    key[2], key[3] = key[3], key[2]
    bad['answer'] = _dumps(key)
    _rejects(bad, 'the angle line before the orientation line')
    bad = _copy(good)
    bad['workGrading']['claims']['sd'] = {'rf': [['sc']]}
    _rejects(bad, 'a rule that credits the angle line before the side of DE is known')
    bad = _copy(good)
    bad['workGrading']['claims']['sf'] = {'rd': [['sc', 'se']]}
    _rejects(bad, 'a rule that rejects B\'=E before the orientation line')
    bad = _copy(good)
    del bad['workGrading']['claims']['sg']
    _rejects(bad, 'a rule missing the pin')
    bad = _copy(good)
    bad['workGrading']['claims']['sb'] = {'rh': [['sf']]}
    _rejects(bad, 'a rule that credits the leap decoy')
    bad = _copy(good)
    bad['public']['prompt'] = bad['public']['prompt'].replace('$D\\to E\\to F$ runs counterclockwise', '$D\\to E\\to F$ runs clockwise')
    _rejects(bad, 'an orientation the figure does not have')
    moved = dict(SAME, F=(6.5, 2))
    bad = _copy(good)
    bad['public']['figure'] = {'kind': 'scene', 'scene': {'v': 1, 'title': 'fixture', 'elements': [
        e for e in _fixture_scene(moved, ABC, False)['scene']['elements']]}}
    _rejects(bad, 'a figure whose triangles are not congruent')
    bad = _copy(good)
    bad['public']['response']['banks'][1]['options'].append({'id': 'rj', 'label': R_TR})
    _rejects(bad, 'a reason offered twice')
    bad = _copy(good)
    bad['public']['response']['banks'][0]['options'][7]['label'] = "Rotate $\\triangle ABC$ about $C$ until $D$ lands on $E$."
    _rejects(bad, 'a decoy that is a possible motion')
    bad = _copy(good)
    bad['explanation'][-1] = bad['explanation'][-1].replace('SAS works', 'ASA works')
    _rejects(bad, 'the wrong shortcut named in the explanation')
    bad = _copy(good)
    bad['explanation'][3], bad['explanation'][4] = bad['explanation'][4].replace('4. ', '3. ', 1), bad['explanation'][3].replace('3. ', '4. ', 1)
    _rejects(bad, 'a worked proof out of order')
    # --- proof: fill
    fill = _sas_fixture('fill', fill_blank=(1, 3, 5))
    require(review_problem(fill) == fill['answer'], 'SAS fill fixture')
    bad = _copy(fill)
    bad['public']['response']['rows'][2]['fields'][1]['given'] = 'rh'
    _rejects(bad, 'a wrong given reason')
    # --- proof: ASA, opposite orientation, order (two valid orders)
    order = _asa_fixture()
    require(review_problem(order) == order['answer'], 'ASA order fixture')
    bad = _copy(order)
    bad['workGrading']['claims']['s4'] = {'rd': [['s3']]}
    _rejects(bad, 'the angle at E before B\'=E')
    bad = _copy(order)
    bad['public']['response']['banks'][1]['options'].append({'id': 'rk', 'label': 'Two points determine exactly one line.'})
    _rejects(bad, 'a second valid reason for the two-ray line')
    bad = _copy(order)
    bad['answer'] = _dumps(['r4', 'r6', 'r5', 'r2', 'r1', 'r3'])
    _rejects(bad, 'an invalid order as the key')
    _rejects(_asa_fixture(shown=(0, 1, 2, 3, 4, 5)), 'an order shown already solved')
    alt = _asa_fixture(shown=(4, 2, 5, 0, 3, 1))
    require(review_problem(alt) == alt['answer'], 'ASA order fixture, other shuffle')

    bad = _copy(good)
    bad['explanation'][bad['explanation'].index(SAS_NOTE)] = SWAP_NOTE
    _rejects(bad, 'an order note that allows the wrong orders')
    bad = _copy(order)
    bad['explanation'][bad['explanation'].index(SWAP_NOTE)] = SAS_NOTE
    _rejects(bad, 'an order note that allows the wrong orders (two-angle proof)')

    # --- reasoning
    same_figure = _fixture_scene(SAME, ABC, False)
    lead = ("A sequence of rigid motions (a translation, then a rotation about $D$) maps $\\triangle ABC$ onto $\\triangle DEF$ with "
            "$A\\to D$, $B\\to E$ and $C\\to F$. Without citing CPCTC, which this reasoning proves, explain why ")
    side = _choice_fixture(lead + "$\\overline{BC}\\cong\\overline{EF}$. Which explanation is correct and complete?", [
        "The translation moves $B$ and $C$ by one vector, so it keeps their distance: $BC=EF$.",
        "$B\\to E$ and $C\\to F$, so $\\overline{BC}$ lands on $\\overline{EF}$, and rigid motions keep length: $BC=EF$.",
        "$\\triangle ABC\\cong\\triangle DEF$, and corresponding parts of congruent triangles are congruent.",
        "The rotation keeps $B$ and $C$ the same distance from its center $D$, so $BC=EF$.",
    ], 'b', same_figure, ['The other choices fail: following only the translation leaves out the rest of the sequence; citing CPCTC '
                          'assumes what this argument proves; and distances from the center $D$ say nothing about the length of $\\overline{BC}$.'])
    require(review_problem(side) == side['answer'], 'forward side fixture')
    bad = _copy(side)
    bad['explanation'][0] = bad['explanation'][0].replace('center $D$', 'center $E$')
    _rejects(bad, 'a diagnosis naming the wrong center')
    bad = _copy(side)
    bad['explanation'][0] = bad['explanation'][0].replace('citing CPCTC assumes what this argument proves', 'the look of the figure proves nothing')
    _rejects(bad, 'a diagnosis of a choice that is not shown')
    bad = _copy(side)
    bad['answer'] = 'option-a'
    _rejects(bad, 'one motion as the whole sequence')
    bad = _copy(side)
    bad['public']['response']['options'][3]['label'] = "$C\\to F$ and $B\\to E$, so $\\overline{CB}$ lands on $\\overline{FE}$, and rigid motions keep length: $CB=FE$."
    _rejects(bad, 'two correct explanations')
    bad = _copy(side)
    bad['public']['prompt'] = bad['public']['prompt'].replace('(a translation, then a rotation about $D$)', '(a translation, then a rotation about $D$, then a reflection over line $DE$)')
    _rejects(bad, 'a reflection the figure does not need')
    bad = _copy(side)
    bad['public']['response']['options'][2]['label'] = "$\\overline{BC}$ and $\\overline{EF}$ look equally long in the figure, so $BC=EF$."
    _rejects(bad, 'an explanation describing a CPCTC choice that is not shown')
    angle = _choice_fixture(lead + "$\\angle B\\cong\\angle E$. Which explanation is correct and complete?", [
        "The angles of each triangle add to $180^\\circ$, so the angles at $B$ and $E$ are equal.",
        "The two sides that form $\\angle B$ match the two that form $\\angle E$, so the angles are equal.",
        "The translation slides $\\angle B$ and the rotation turns it, so neither motion changes its size.",
        "$B\\to E$, and rays $BA$, $BC$ land on rays $ED$, $EF$; rigid motions keep angle measure.",
    ], 'd', same_figure, ['The other choices fail: the angle sum does not make single angles equal; two sides do not fix the angle '
                          'between them; and keeping its size never shows that it lands on $\\angle E$.'])
    require(review_problem(angle) == angle['answer'], 'forward angle fixture')
    bad = _copy(angle)
    bad['explanation'][0] = bad['explanation'][0].replace('lands on $\\angle E$', 'lands on $\\angle D$')
    _rejects(bad, 'a diagnosis naming the wrong angle')
    bad = _copy(angle)
    bad['public']['response']['options'][3]['label'] = "$B\\to E$, and rays $BA$, $BC$ land on rays $EF$, $ED$; rigid motions keep angle measure."
    _rejects(bad, 'rays landing on the wrong rays')
    q = f"Let $P$ be the statement: {P_TEXT}. Let $Q$ be the statement: {SIX}. Argument: "
    direction = _choice_fixture(q + CONVERSE_ARGUMENT + " Which statement does this argument prove?", [
        "If $P$, then $Q$.", "$P$ if and only if $Q$, since one argument proves both directions.",
        "If $Q$, then $P$.", "Neither: only a criterion such as SSS can show two triangles are congruent.",
    ], 'c')
    require(review_problem(direction) == direction['answer'], 'direction fixture')
    bad = _copy(direction)
    bad['answer'] = 'option-a'
    _rejects(bad, 'the reverse direction')
    remains = _choice_fixture(q + FORWARD_ARGUMENT + " This argument proves “if $P$, then $Q$”. What else must be proved to conclude “$P$ if and only if $Q$”?", [
        "That if rigid motions map $\\triangle DEF$ onto $\\triangle ABC$, the six pairs are congruent.",
        "If $Q$, then $P$: six congruent pairs give a sequence of rigid motions.",
        "Nothing: one direction of an if-and-only-if statement is enough.",
        "That the two triangles have the same orientation, so no reflection is needed.",
    ], 'b')
    require(review_problem(remains) == remains['answer'], 'remains fixture')
    bad = _copy(remains)
    bad['public']['response']['options'][0]['label'] = "That if the six pairs are congruent, rigid motions map $\\triangle DEF$ onto $\\triangle ABC$."
    _rejects(bad, 'a swapped statement that is the missing direction')
    bad = _copy(remains)
    bad['public']['prompt'] = bad['public']['prompt'].replace('This argument proves “if $P$, then $Q$”', 'This argument proves “if $Q$, then $P$”')
    _rejects(bad, 'a prompt that misstates the direction proved')
    flipped_figure = _fixture_scene(FLIPPED, ABC, True)
    pin = "Angle measure is preserved and $\\angle A\\cong\\angle D$, so the image of $C$ is on ray $DF$; since $AC=DF$, it is $F$."
    distance_only = "Distance is preserved and $AC=DF$, so the image of $C$ is $F$."
    flaw_options = [
        "Step 1 is wrong: a translation can move $A$ onto $D$ only if $\\overline{AB}\\parallel\\overline{DE}$.",
        "Step 4 is wrong: distance $DF$ from $D$ allows a whole circle of points, not just $F$.",
        "The argument is correct and complete.",
        "Step 3 is wrong: a reflection over line $DE$ moves $D$ and $E$ off their places.",
    ]
    flaw = _choice_fixture(_flaw_prompt(distance_only), flaw_options, 'b', flipped_figure,
                           ['A correct argument lands one vertex at a time.', flaw_options[1]])
    require(review_problem(flaw) == flaw['answer'], 'flaw fixture')
    bad = _copy(flaw)
    bad['answer'] = 'option-c'
    _rejects(bad, 'a flawed argument called complete')
    bad = _copy(flaw)
    bad['public']['prompt'] = _flaw_prompt(pin)
    _rejects(bad, 'a sound argument with a flaw keyed')
    sound = _choice_fixture(_flaw_prompt(pin), flaw_options[:1] + ["Step 4 is wrong: an angle and one side cannot fix a point; all three sides are needed."] + flaw_options[2:],
                            'c', flipped_figure, ['A correct argument lands one vertex at a time.', 'Every step follows, so the argument is correct and complete.'])
    require(review_problem(sound) == sound['answer'], 'no-flaw fixture')
    bad = _copy(sound)
    bad['explanation'][1] = sound['public']['response']['options'][1]['label']
    _rejects(bad, 'an explanation that names a false accusation')
    # --- coordinates: a quarter turn, no reflection
    same = [(1, 1), (4, 1), (1, 3), (6, -4), (6, -1), (4, -4)]
    turn = ['$90^\\circ$ counterclockwise about $D$', '$90^\\circ$ counterclockwise about the origin',
            '$270^\\circ$ counterclockwise about $D$', '$90^\\circ$ counterclockwise about $E$']
    moves = ['$(x,y)\\to(x+5,\\,y-5)$', '$(x,y)\\to(x-5,\\,y+5)$', '$(x,y)\\to(x+5,\\,y-2)$', '$(x,y)\\to(x+2,\\,y-2)$']
    explain = ['Orientation first: $A\\to B\\to C$ runs counterclockwise and $D\\to E\\to F$ runs counterclockwise, so no reflection will be needed.',
               '1. From $A(1,1)$ to $D(6,-4)$, $x$ changes by $5$ and $y$ by $-5$, so the translation is $(x,y)\\to(x+5,\\,y-5)$.',
               '2. After the translation, $B$ is at $B_1(9,-4)$. From $D$ the step to it is $(3,0)$ and the step to $E$ is $(0,3)$, so a turn of '
               '$90^\\circ$ counterclockwise about $D$ carries $B_1$ to $E(6,-1)$. Turning $270^\\circ$ counterclockwise instead goes the other way round, to $(6,-7)$.',
               '3. The rotation keeps $D$ fixed and puts the image of $B$ on ray $DE$.',
               '4. After the translation and the rotation, the image of $C$ is $C_2(4,-4)$. It is on the same side of line $DE$ as $F(4,-4)$, so no reflection is needed.']
    grid = _grid_fixture(same, [moves, turn] + GRID_COMMON, 'aaaba', explain)
    require(review_problem(grid) == grid['answer'], 'grid fixture')
    require(solve(grid['public']) == grid['answer'], 'grid solve')
    bad = _copy(grid)
    bad['answer'] = _dumps({'move': 'a', 'turn': 'c', 'land': 'a', 'flip': 'b', 'pin': 'a'})
    _rejects(bad, 'the opposite turn')
    bad = _copy(grid)
    bad['public']['response']['blanks'][1]['options'][2]['label'] = '$270^\\circ$ clockwise about $D$'
    _rejects(bad, 'two valid rotations')
    bad = _copy(grid)
    bad['public']['response']['blanks'][1]['options'][0]['label'] = '$180^\\circ$ about $D$'
    _rejects(bad, 'no valid rotation')
    bad = _copy(grid)
    bad['public']['response']['blanks'][2]['options'][1]['label'] = 'A rotation about $D$ keeps every distance from $D$'
    _rejects(bad, 'an unclassified landing reason')
    bad = _copy(grid)
    bad['public']['prompt'] = bad['public']['prompt'].replace('$F(4,-4)$', '$F(3,-4)$')
    _rejects(bad, 'triangles that are not congruent')
    bad = _copy(grid)
    for e in bad['public']['figure']['scene']['elements']:
        if e.get('type') == 'tick':
            e['at'] = [e['at'][0] + 0.05, e['at'][1] + 0.05]
            break
    _rejects(bad, 'a tick mark off its side')
    bad = _copy(grid)
    bad['public']['figure']['scene']['elements'] = [e for e in bad['public']['figure']['scene']['elements'] if e.get('type') != 'arc']
    _rejects(bad, 'a figure without its angle marks')
    bad = _copy(grid)
    bad['explanation'][1] = bad['explanation'][1].replace('so the translation is $(x,y)\\to(x+5,\\,y-5)$', 'so the translation is $(x,y)\\to(x-5,\\,y+5)$')
    _rejects(bad, 'an explanation with the reversed vector')
    bad = _copy(grid)
    bad['explanation'][2] += ' Here no rotation is needed.'
    _rejects(bad, 'an explanation that drops a needed rotation')
    for old, new, why in (('$B_1(9,-4)$', '$B_1(9,-3)$', 'a wrong image of B'),
                          ('the step to $E$ is $(0,3)$', 'the step to $E$ is $(3,0)$', 'a wrong step to E'),
                          ('to $(6,-7)$', 'to $(6,-1)$', 'a wrong end of the reversed turn'),
                          ('$90^\\circ$ counterclockwise about $D$ carries', '$270^\\circ$ counterclockwise about $D$ carries', 'a wrong turn named'),
                          ('$C_2(4,-4)$', '$C_1(4,-4)$', 'C named as if only translated'),
                          ('It is on the same side of line $DE$ as', 'It is across line $DE$ from', 'a false side of DE')):
        bad = _copy(grid)
        bad['explanation'] = [e.replace(old, new) for e in bad['explanation']]
        _rejects(bad, why)
    # --- coordinates: a quarter turn, then a reflection
    flipped = [(-6, -6), (-2, -6), (-5, -3), (2, 1), (2, 5), (5, 2)]
    moves = ['$(x,y)\\to(x-8,\\,y-7)$', '$(x,y)\\to(x+8,\\,y+7)$', '$(x,y)\\to(x+8,\\,y+11)$', '$(x,y)\\to(x+4,\\,y+11)$']
    explain = ['Orientation first: $A\\to B\\to C$ runs counterclockwise and $D\\to E\\to F$ runs clockwise, so a reflection will be needed.',
               '4. After the translation and the rotation, the image of $C$ is $C_2(-1,2)$. It is across line $DE$ from $F(5,2)$, so reflect over line $DE$.']
    grid2 = _grid_fixture(flipped, [moves, turn] + GRID_COMMON, 'baaaa', explain)
    require(review_problem(grid2) == grid2['answer'], 'grid fixture with a reflection')
    bad = _copy(grid2)
    bad['answer'] = _dumps({'move': 'b', 'turn': 'a', 'land': 'a', 'flip': 'b', 'pin': 'a'})
    _rejects(bad, 'no reflection where one is needed')
    bad = _copy(grid2)
    bad['explanation'][0] = bad['explanation'][0].replace('so a reflection', 'so no reflection')
    _rejects(bad, 'an explanation that denies the reflection')
    # --- coordinates: a half turn
    half = [(1, 1), (4, 1), (1, 3), (7, -2), (4, -2), (7, -4)]
    moves = ['$(x,y)\\to(x+6,\\,y-3)$', '$(x,y)\\to(x-6,\\,y+3)$', '$(x,y)\\to(x+3,\\,y-3)$', '$(x,y)\\to(x,\\,y-3)$']
    turn = ['$180^\\circ$ about $D$', '$180^\\circ$ about the origin', '$90^\\circ$ counterclockwise about $D$', '$180^\\circ$ about $E$']
    explain = ['2. After the translation, $B$ is at $B_1(10,-2)$. From $D$ the step to it is $(3,0)$ and the step to $E$ is $(-3,0)$, so a turn of '
               '$180^\\circ$ about $D$ carries $B_1$ to $E(4,-2)$. A $90^\\circ$ turn about $D$ goes only half as far, to $(7,1)$.',
               '4. After the translation and the rotation, the image of $C$ is $C_2(7,-4)$. It is on the same side of line $DE$ as $F(7,-4)$.']
    grid3 = _grid_fixture(half, [moves, turn] + GRID_COMMON, 'aaaba', explain)
    require(review_problem(grid3) == grid3['answer'], 'grid fixture with a half turn')
    bad = _copy(grid3)
    bad['explanation'][0] = bad['explanation'][0].replace('to $(7,1)$', 'to $(7,-5)$')
    _rejects(bad, 'a wrong end of the quarter turn')
    bad = _copy(grid3)
    bad['explanation'][0] = bad['explanation'][0].replace('A $90^\\circ$ turn about $D$ goes only half as far, to $(7,1)$.',
                                                          'Turning $180^\\circ$ counterclockwise instead goes the other way round, to $(4,-2)$.')
    _rejects(bad, 'a half turn said to go the other way round')
    # --- coordinates: no turn at all
    slide = [(1, 1), (4, 1), (1, 3), (4, -5), (7, -5), (4, -3)]
    moves = ['$(x,y)\\to(x+3,\\,y-6)$', '$(x,y)\\to(x-3,\\,y+6)$', '$(x,y)\\to(x+6,\\,y-6)$', '$(x,y)\\to(x+3,\\,y-4)$']
    turn = ['No rotation is needed', '$90^\\circ$ counterclockwise about $D$', '$180^\\circ$ about $D$', '$270^\\circ$ counterclockwise about $D$']
    explain = ['2. After the translation, $B$ is at $B_1(7,-5)$, which is already $E(7,-5)$: the step from $D$ to it, $(3,0)$, is the step from '
               '$D$ to $E$. So no rotation is needed; any turn about $D$ would carry it off $E$.',
               '3. The translation puts $B_1$ on ray $DE$.',
               '4. After the translation, the image of $C$ is $C_1(4,-3)$. It is on the same side of line $DE$ as $F(4,-3)$, so no reflection is needed.']
    grid4 = _grid_fixture(slide, [moves, turn] + GRID_COMMON, 'aaaba', explain)
    require(review_problem(grid4) == grid4['answer'], 'grid fixture with no turn')
    for old, new, why in (('3. The translation puts $B_1$', '3. The rotation keeps $D$ fixed and puts $B_1$', 'a rotation where none is used'),
                          ('$C_1(4,-3)$', '$C_2(4,-3)$', 'C named as if rotated'),
                          ('the step from $D$ to it, $(3,0)$', 'the step from $D$ to it, $(0,3)$', 'a wrong step from D')):
        bad = _copy(grid4)
        bad['explanation'] = [e.replace(old, new) for e in bad['explanation']]
        _rejects(bad, why)
    # The same pair one unit to the left: A and C on the y-axis.
    on_axis = [(x - 1, y) for x, y in slide]
    _rejects(_grid_fixture(on_axis, [moves, turn] + GRID_COMMON, 'aaaba', explain), 'a vertex on an axis')
    return True


if __name__ == '__main__':
    self_test()
    print('ok', STATS)
