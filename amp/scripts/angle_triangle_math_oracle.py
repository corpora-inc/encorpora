"""Independent prompt-based checks for angles, triangles and cross-sections.

Answers come from the public prompt and the figure's public givens (labels,
mark positions, dimensions) only. The figure's drawn measures are never used to
solve; they are checked afterwards against the solved values, which verifies
that every figure is drawn at its true measures. Cross-sections are found by
intersecting the stated plane with the solid's edges in exact arithmetic, not
by the shape rules the lessons teach.
"""
import itertools
import math
import re
from fractions import Fraction as F

ANGLE_TRIANGLE = frozenset({
    'angle-pair-measure', 'angle-equation', 'triangle-angle-sum', 'triangle-exterior-angle',
    'parallel-lines-angle', 'triangle-side-test', 'triangle-third-side', 'triangle-conditions',
    'cross-section-shape', 'cross-section-area',
})
CHOICE_TYPES = frozenset({'triangle-side-test', 'triangle-conditions', 'cross-section-shape'})
UNITS = {'cm': ('centimeters', 'square centimeters'), 'mm': ('millimeters', 'square millimeters'),
         'm': ('meters', 'square meters'), 'ft': ('feet', 'square feet')}


def require(condition, message):
    if not condition:
        raise ValueError(message)


EXPR = re.compile(r'\((\d*)x ([+−]) (\d+)\)°|(\d*)x°|(\d+)°')


def expression(text):
    """'(3x − 5)°' → (3, −5); '4x°' → (4, 0); '57°' → (0, 57)."""
    m = EXPR.fullmatch(text)
    require(m is not None, f'Malformed angle expression {text!r}')
    if m[2]:
        a = int(m[1]) if m[1] else 1
        require(m[1] != '1', 'Coefficient 1 must be written x')
        return (a, int(m[3]) * (1 if m[2] == '+' else -1))
    if m[4] is not None and 'x' in text:
        require(m[4] != '1', 'Coefficient 1 must be written x')
        return (int(m[4]) if m[4] else 1, 0)
    return (0, int(m[5]))


def value(e, x):
    return e[0] * x + e[1]


def solve_linear(a, b):
    """Solve a·x = b, requiring a positive whole-number solution."""
    require(a != 0, 'Degenerate equation')
    x = F(b, a)
    require(x.denominator == 1 and x > 0, f'Non-integer or non-positive x: {x}')
    return x


ANG = r'(?:\(\d*x [+−] \d+\)°|\d*x°|\d+°)'


def angle_name(name, vertex):
    require(len(name) == 4 and name[0] == '∠' and name[2] == vertex, f'Bad angle name {name}')
    return frozenset((name[1], name[3]))


# ——— Figure checks (after solving) ———

def ray_measure(figure, pair):
    """The drawn (non-reflex) angle between two named rays."""
    points = figure['points']
    a, b = (figure['rays'][points.index(p)] for p in pair)
    s = (b - a) % 360
    return min(s, 360 - s)


def check_rays(public, measures):
    figure = public.get('figure')
    require(figure and figure['kind'] == 'angle-rays', 'Missing ray figure')
    for pair, v in measures.items():
        require(ray_measure(figure, pair) == v, f'Figure not drawn at true measure for {set(pair)}: {v}')
    for mark in figure['marks']:
        pair = frozenset((figure['points'][mark['from']], figure['points'][mark['to']]))
        if mark.get('right'):
            require(ray_measure(figure, pair) == 90, 'Right-angle mark on a non-right angle')
            continue
        if pair in measures and mark['label'] not in ('?', 'x°'):
            require(mark['label'] in public['prompt'], 'Figure label is not stated in the prompt')


def solve_angle_pair(public):
    p = public['prompt']
    m = re.fullmatch(r'Points ([A-Z]), ([A-Z]) and ([A-Z]) lie on a straight line, and ray \2([A-Z]) is drawn from \2\. (∠[A-Z]{3}) measures (\d+)°\. What is the measure of (∠[A-Z]{3}), in degrees\?', p)
    if m is None:
        m2 = re.fullmatch(r'∠([A-Z])([A-Z])([A-Z]) is a right angle, and ray \2([A-Z]) lies inside it\. (∠[A-Z]{3}) measures (\d+)°\. What is the measure of (∠[A-Z]{3}), in degrees\?', p)
    else:
        m2 = None
    if m or m2:
        g = m or m2
        e1, o, e2, q = g[1], g[2], g[3], g[4]
        whole = 180 if m else 90
        known, asked = angle_name(g[5], o), angle_name(g[7], o)
        parts = {frozenset((e1, q)), frozenset((e2, q))}
        require(known in parts and asked in parts and known != asked, 'Named angles are not the two parts')
        k = int(g[6])
        require(0 < k < whole, 'Known part out of range')
        check_rays(public, {known: k, asked: whole - k, frozenset((e1, e2)): whole})
        return whole - k
    m = re.fullmatch(r'Lines ([A-Z])([A-Z]) and ([A-Z])([A-Z]) cross at ([A-Z])\. (∠[A-Z]{3}) measures (\d+)°\. What is the measure of (∠[A-Z]{3}), in degrees\?', p)
    if m:
        line1, line2, o = {m[1], m[2]}, {m[3], m[4]}, m[5]
        known, asked = angle_name(m[6], o), angle_name(m[8], o)
        for a in (known, asked):
            require(len(a & line1) == 1 and len(a & line2) == 1, 'Angle must join the two lines')
        k = int(m[7])
        require(0 < k < 180 and known != asked, 'Bad crossing angle')
        answer = k if not (known & asked) else 180 - k
        check_rays(public, {known: k, asked: answer})
        return answer
    m = re.fullmatch(r'Rays ([A-Z])([A-Z]), \1([A-Z]) and \1([A-Z]) divide the full turn around \1 into three angles\. (∠[A-Z]{3}) measures (\d+)° and (∠[A-Z]{3}) measures (\d+)°\. What is the measure of (∠[A-Z]{3}), in degrees\?', p)
    require(m is not None, f'Unrecognized angle prompt: {p}')
    o, rays = m[1], {m[2], m[3], m[4]}
    names = [angle_name(m[i], o) for i in (5, 7, 9)]
    require(set(names) == {frozenset(c) for c in itertools.combinations(rays, 2)}, 'Angles must be the three around the point')
    third = 360 - int(m[6]) - int(m[8])
    require(0 < third < 180, 'Third angle out of range')
    check_rays(public, {names[0]: int(m[6]), names[1]: int(m[8]), names[2]: third})
    return third


def solve_angle_equation(public):
    p = public['prompt']
    ask = r' What is (?:the value of x|the measure of (∠[A-Z]{3}), in degrees)\?'
    forms = [
        ('straight', rf'Points ([A-Z]), ([A-Z]) and ([A-Z]) lie on a straight line, and ray \2([A-Z]) is drawn from \2\.'),
        ('right', rf'∠([A-Z])([A-Z])([A-Z]) is a right angle, and ray \2([A-Z]) lies inside it\.'),
        ('given', rf'Ray ([A-Z])([A-Z]) lies inside ∠([A-Z])\1([A-Z]), which measures (\d+)°\.'),
        ('vertical', rf'Lines ([A-Z])([A-Z]) and ([A-Z])([A-Z]) cross at ([A-Z])\.'),
    ]
    for kind, setup in forms:
        m = re.fullmatch(setup + rf' (∠[A-Z]{{3}}) measures ({ANG}) and (∠[A-Z]{{3}}) measures ({ANG})\.' + ask, p)
        if m:
            break
    else:
        raise ValueError(f'Unrecognized equation prompt: {p}')
    g = list(m.groups())
    n1, t1, n2, t2, asked = g[-5:]
    e1, e2 = expression(t1), expression(t2)
    require(e1[0] > 0 and e2[0] > 0, 'Both angles must involve x')
    if kind == 'vertical':
        a, b, c, d, o = g[:5]
        l1, l2 = {a, b}, {c, d}
        A1, A2 = angle_name(n1, o), angle_name(n2, o)
        for ang in (A1, A2):
            require(len(ang & l1) == 1 and len(ang & l2) == 1, 'Angle must join the two lines')
        require(not (A1 & A2), 'Vertical angles share no ray')
        x = solve_linear(e1[0] - e2[0], e2[1] - e1[1])
    else:
        if kind == 'given':
            o, q, e_a, e_b, whole = g[0], g[1], g[2], g[3], int(g[4])
        else:
            e_a, o, e_b, q = g[0], g[1], g[2], g[3]
            whole = 180 if kind == 'straight' else 90
        A1, A2 = angle_name(n1, o), angle_name(n2, o)
        require({A1, A2} == {frozenset((e_a, q)), frozenset((e_b, q))}, 'Named angles are not the two parts')
        x = solve_linear(e1[0] + e2[0], whole - e1[1] - e2[1])
    v1, v2 = value(e1, x), value(e2, x)
    require(0 < v1 < 180 and 0 < v2 < 180, 'Angles out of range')
    check_rays(public, {A1: v1, A2: v2})
    if asked:
        require(asked == n1, 'Asked angle must be the first named')
        return v1
    return x


def check_triangle(public, angles, exterior=None):
    figure = public.get('figure')
    require(figure and figure['kind'] == 'triangle-angles', 'Missing triangle figure')
    require([F(a) for a in figure['angles']] == [F(a) for a in angles], f'Triangle not drawn at true measures: {figure["angles"]} vs {angles}')
    if exterior is not None:
        require(figure.get('exterior') and figure['exterior']['point'] == exterior, 'Exterior point mismatch')


def solve_triangle_sum(public):
    p = public['prompt']
    m = re.fullmatch(r'In triangle ([A-Z])([A-Z])([A-Z]), ∠([A-Z]) measures (\d+)° and ∠([A-Z]) measures (\d+)°\. What is the measure of ∠([A-Z]), in degrees\?', p)
    if m:
        names = [m[1], m[2], m[3]]
        require(sorted([m[4], m[6], m[8]]) == sorted(names), 'Angles must be the three vertices')
        third = 180 - int(m[5]) - int(m[7])
        require(third > 0, 'Impossible triangle')
        values = {m[4]: int(m[5]), m[6]: int(m[7]), m[8]: third}
        check_triangle(public, [values[n] for n in names])
        return third
    m = re.fullmatch(rf'In triangle ([A-Z])([A-Z])([A-Z]), ∠\1 measures ({ANG}), ∠\2 measures ({ANG}) and ∠\3 measures ({ANG})\. What is (?:the value of x|the measure of ∠([A-Z]), in degrees)\?', p)
    require(m is not None, f'Unrecognized triangle prompt: {p}')
    es = [expression(m[i]) for i in (4, 5, 6)]
    x = solve_linear(sum(e[0] for e in es), 180 - sum(e[1] for e in es))
    values = [value(e, x) for e in es]
    require(all(v > 0 for v in values), 'Non-positive angle')
    check_triangle(public, values)
    if m[7]:
        return values[[m[1], m[2], m[3]].index(m[7])]
    return x


def solve_exterior(public):
    p = public['prompt']
    m = re.match(r'In triangle ([A-Z])([A-Z])([A-Z]), side \1\2 is extended past \2 to point ([A-Z])\. ', p)
    require(m is not None, f'Unrecognized exterior prompt: {p}')
    A, B, C, D = m[1], m[2], m[3], m[4]
    ext = f'∠{C}{B}{D}'
    rest = p[m.end():]
    k = re.fullmatch(rf'∠{A} measures (\d+)° and ∠{C} measures (\d+)°\. What is the measure of {ext}, in degrees\?', rest)
    if k:
        a, c = int(k[1]), int(k[2])
        check_triangle(public, [a, 180 - a - c, c], D)
        return a + c
    k = re.fullmatch(rf'{ext} measures (\d+)° and ∠([{A}{C}]) measures (\d+)°\. What is the measure of ∠([{A}{C}]), in degrees\?', rest)
    if k:
        require(k[2] != k[4], 'Known and asked angles must differ')
        e, known = int(k[1]), int(k[3])
        other = e - known
        require(other > 0 and e < 180, 'Impossible exterior angle')
        a, c = (known, other) if k[2] == A else (other, known)
        check_triangle(public, [a, 180 - e, c], D)
        return other
    k = re.fullmatch(rf'∠{A} measures ({ANG}), ∠{C} measures ({ANG}) and {ext} measures ({ANG})\. What is the value of x\?', rest)
    require(k is not None, f'Unrecognized exterior prompt: {p}')
    ea, ec, ee = (expression(k[i]) for i in (1, 2, 3))
    x = solve_linear(ea[0] + ec[0] - ee[0], ee[1] - ea[1] - ec[1])
    a, c, e = value(ea, x), value(ec, x), value(ee, x)
    require(a > 0 and c > 0 and e < 180, 'Impossible triangle')
    check_triangle(public, [a, 180 - e, c], D)
    return x


def solve_parallel(public):
    p = public['prompt']
    figure = public.get('figure')
    require(figure and figure['kind'] == 'parallel-transversal', 'Missing parallel figure')
    m, n, t = figure['lines']
    setup = f'Lines {m} and {n} are parallel, and line {t} crosses both. '
    require(p.startswith(setup), 'Prompt and figure name different lines')
    marks = figure['marks']
    require(len(marks) == 2, 'Two marked angles')
    # At a crossing, opposite angles are equal; parallel lines make both crossings alike.
    # So positions of equal parity hold equal angles, and other pairs are supplementary.
    equal = marks[0]['position'] % 2 == marks[1]['position'] % 2
    rest = p[len(setup):]
    k = re.fullmatch(r'One marked angle measures (\d+)°\. What is the value of x\?', rest)
    if k:
        labels = sorted(mk['label'] for mk in marks)
        require(labels == sorted([f'{k[1]}°', 'x°']), 'Figure labels must be the given angle and x°')
        g = int(k[1])
        x = g if equal else 180 - g
        values = {mk['label']: (g if mk['label'] != 'x°' else x) for mk in marks}
    else:
        k = re.fullmatch(rf'The marked angles measure ({ANG}) and ({ANG})\. What is the value of x\?', rest)
        require(k is not None, f'Unrecognized parallel prompt: {p}')
        require(sorted(mk['label'] for mk in marks) == sorted([k[1], k[2]]), 'Figure labels must match the prompt')
        e1, e2 = expression(k[1]), expression(k[2])
        x = solve_linear(e1[0] - e2[0], e2[1] - e1[1]) if equal else solve_linear(e1[0] + e2[0], 180 - e1[1] - e2[1])
        values = {k[1]: value(e1, x), k[2]: value(e2, x)}
    for mk in marks:
        drawn = figure['angle'] if mk['position'] % 2 == 0 else 180 - figure['angle']
        require(values[mk['label']] == drawn, 'Transversal not drawn at true measure')
    return x


def triangle_exists(sides):
    a, b, c = sorted(sides)
    return a + b > c


def solve_side_test(public):
    require(public['prompt'] == 'Which set of three lengths can be the side lengths of a triangle?', 'Prompt')
    winners = []
    for option in public['response']['options']:
        m = re.fullmatch(r'(\d+) (cm|mm|m|ft), (\d+) \2, (\d+) \2', option['label'])
        require(m is not None, f'Bad option {option["label"]}')
        sides = [int(m[1]), int(m[3]), int(m[4])]
        # Exhaustive check of all three inequalities, not only the longest side.
        if all(sides[i] < sides[(i + 1) % 3] + sides[(i + 2) % 3] for i in range(3)):
            winners.append(option['id'])
    require(len(winners) == 1, f'Expected exactly one valid set, got {winners}')
    return winners[0]


def solve_third_side(public):
    m = re.fullmatch(r'Two sides of a triangle measure (\d+) (cm|mm|m|ft) and (\d+) \2\. The third side is a whole number of (\w+)\. (.+)', public['prompt'])
    require(m is not None and UNITS[m[2]][0] == m[4], 'Unrecognized third-side prompt')
    a, b = int(m[1]), int(m[3])
    possible = [s for s in range(1, a + b + 10) if triangle_exists([a, b, s])]
    question = m[5]
    if question == f'What is the greatest possible length of the third side, in {m[4]}?':
        return max(possible)
    if question == f'What is the least possible length of the third side, in {m[4]}?':
        return min(possible)
    require(question == 'How many different lengths are possible for the third side?', 'Unknown question')
    return len(possible)


CONDITION_LABELS = {'Exactly one triangle': 'one', 'More than one triangle': 'many', 'No triangle': 'none'}


def solve_conditions(public):
    m = re.fullmatch(r'A triangle must have (.+)\. How many different triangles meet these conditions\? Triangles with the same size and shape count as one\.', public['prompt'])
    require(m is not None, 'Unrecognized conditions prompt')
    c = m[1]
    U = r'(?:cm|mm|m|ft)'
    if k := re.fullmatch(r'angles of (\d+)°, (\d+)° and (\d+)°', c):
        verdict = 'many' if sum(int(k[i]) for i in (1, 2, 3)) == 180 else 'none'
    elif k := re.fullmatch(rf'sides of (\d+) ({U}), (\d+) \2 and (\d+) \2', c):
        verdict = 'one' if triangle_exists([int(k[1]), int(k[3]), int(k[4])]) else 'none'
    elif k := re.fullmatch(rf'sides of (\d+) ({U}) and (\d+) \2 with a (\d+)° angle between them', c):
        verdict = 'one' if 0 < int(k[4]) < 180 else 'none'
    elif k := re.fullmatch(rf'angles of (\d+)° and (\d+)° with a (\d+) {U} side between them', c):
        verdict = 'one' if int(k[1]) + int(k[2]) < 180 else 'none'
    elif k := re.fullmatch(rf'angles of (\d+)° and (\d+)° and a (\d+) {U} side', c):
        verdict = 'one' if int(k[1]) + int(k[2]) < 180 else 'none'
    elif k := re.fullmatch(r'two angles of (\d+)° and (\d+)°', c):
        verdict = 'many' if int(k[1]) + int(k[2]) < 180 else 'none'
    else:
        raise ValueError(f'Unrecognized condition {c}')
    options = public['response']['options']
    require([o['label'] for o in options] == list(CONDITION_LABELS), 'Condition options')
    return next(o['id'] for o in options if CONDITION_LABELS[o['label']] == verdict)


# ——— Cross-sections by exact plane–edge intersection ———

def solid_edges(solid, l, w, h):
    base = [(F(0), F(0), F(0)), (F(l), F(0), F(0)), (F(l), F(w), F(0)), (F(0), F(w), F(0))]
    if solid == 'prism':
        top = [(x, y, F(h)) for x, y, _ in base]
        return [(base[i], base[(i + 1) % 4]) for i in range(4)] + [(top[i], top[(i + 1) % 4]) for i in range(4)] + [(base[i], top[i]) for i in range(4)]
    apex = (F(l, 2), F(w, 2), F(h))
    return [(base[i], base[(i + 1) % 4]) for i in range(4)] + [(base[i], apex) for i in range(4)]


def sub(a, b):
    return tuple(x - y for x, y in zip(a, b))


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def section(solid, l, w, h, normal, offset):
    """Vertices where the plane normal·p = offset meets the solid's edges, in cyclic order."""
    points = set()
    for a, b in solid_edges(solid, l, w, h):
        da, db = dot(normal, a) - offset, dot(normal, b) - offset
        if da == 0:
            points.add(a)
        if db == 0:
            points.add(b)
        if da * db < 0:
            t = da / (da - db)
            points.add(tuple(a[i] + t * (b[i] - a[i]) for i in range(3)))
    pts = list(points)
    require(len(pts) >= 3, 'Plane misses the solid')
    centre = tuple(sum(p[i] for p in pts) / len(pts) for i in range(3))
    u = sub(pts[0], centre)
    v = cross(normal, u)
    pts.sort(key=lambda p: math.atan2(float(dot(sub(p, centre), v)), float(dot(sub(p, centre), u))))
    return pts


def classify(pts):
    n = len(pts)
    if n == 3:
        return 'Triangle'
    require(n == 4, f'Unexpected {n}-sided section')
    sides = [sub(pts[(i + 1) % 4], pts[i]) for i in range(4)]
    parallel = [cross(sides[i], sides[i + 2]) == (0, 0, 0) for i in range(2)]
    right = all(dot(sides[i], sides[(i + 1) % 4]) == 0 for i in range(4))
    if right:
        return 'Square' if dot(sides[0], sides[0]) == dot(sides[1], sides[1]) else 'Rectangle'
    require(parallel.count(True) == 1, 'Section is neither a rectangle nor a trapezoid')
    return 'Trapezoid'


def area(pts, normal):
    total = (F(0), F(0), F(0))
    for i in range(len(pts)):
        total = tuple(t + c for t, c in zip(total, cross(pts[i], pts[(i + 1) % len(pts)])))
    # |Σ p_i × p_(i+1)| / 2 along the unit normal; normals here are axis-aligned.
    require(sum(1 for c in normal if c != 0) == 1, 'Area planes are parallel to a face')
    return abs(dot(total, normal) / sum(abs(c) for c in normal)) / 2


def parse_solid(prompt):
    m = re.match(r'A right rectangular (prism|pyramid) is ', prompt)
    require(m is not None, 'Unrecognized solid')
    solid = m[1]
    if solid == 'prism':
        d = re.match(r'A right rectangular prism is (\d+) (cm|mm|m|ft) long, (\d+) \2 wide and (\d+) \2 tall\. A plane slices it (.+?)\. ', prompt)
        require(d is not None, 'Unrecognized prism')
        l, u, w, h, plane = int(d[1]), d[2], int(d[3]), int(d[4]), d[5]
    else:
        d = re.match(r'A right rectangular pyramid is (\d+) (cm|mm|m|ft) tall, with a base (\d+) \2 long and (\d+) \2 wide\. A plane slices it (.+?)\. ', prompt)
        require(d is not None, 'Unrecognized pyramid')
        h, u, l, w, plane = int(d[1]), d[2], int(d[3]), int(d[4]), d[5]
    rest = prompt[d.end():]
    L, W, H = F(l), F(w), F(h)
    if plane in ('parallel to its base', 'parallel to its base, halfway between the base and the apex'):
        normal, offset, key = (0, 0, 1), H / 2, 'parallel-base'
    elif plane == f'perpendicular to its base and parallel to the {l} {u} edges of the base' and l != w:
        normal, offset, key = (0, 1, 0), W / 2, 'perpendicular-front'
    elif plane == f'perpendicular to its base and parallel to the {w} {u} edges of the base' and l != w:
        normal, offset, key = (1, 0, 0), L / 2, 'perpendicular-side'
    elif plane == 'perpendicular to its base, through two vertical edges that are not on the same face':
        normal, offset, key = (W, -L, 0), F(0), 'perpendicular-diagonal'
    elif plane == 'through the three vertices next to one corner, cutting off that corner':
        p0, p1, p2 = (F(0), F(0), H), (L, W, H), (L, F(0), F(0))
        normal = cross(sub(p1, p0), sub(p2, p0))
        offset, key = dot(normal, p0), 'corner'
    elif plane == f'perpendicular to its base, through the apex, and parallel to the {l} {u} edges of the base':
        normal, offset, key = (0, 1, 0), W / 2, 'through-apex'
    elif plane == f'perpendicular to its base and parallel to the {l} {u} edges of the base, but not through the apex':
        normal, offset, key = (0, 1, 0), W / 4, 'off-apex'
    else:
        raise ValueError(f'Unrecognized plane: {plane}')
    require(solid == 'pyramid' or key not in ('through-apex', 'off-apex'), 'Apex planes need a pyramid')
    halfway = 'halfway' in plane
    require(not halfway or solid == 'pyramid', 'Halfway slices are pyramid slices')
    return solid, l, w, h, u, key, normal, offset, rest


def check_solid(public, solid, l, w, h, u, key):
    figure = public.get('figure')
    require(figure and figure['kind'] == 'solid-section', 'Missing solid figure')
    require((figure['solid'], figure['length'], figure['width'], figure['height'], figure['plane'], figure.get('unit')) == (solid, l, w, h, key, u), 'Figure does not match the prompt')


def solve_section_shape(public):
    solid, l, w, h, u, key, normal, offset, rest = parse_solid(public['prompt'])
    require(rest == 'What is the most specific name for the shape of the cross-section?', 'Question')
    check_solid(public, solid, l, w, h, u, key)
    shape = classify(section(solid, l, w, h, normal, offset))
    options = public['response']['options']
    require([o['label'] for o in options] == ['Rectangle', 'Square', 'Triangle', 'Trapezoid'], 'Shape options')
    return next(o['id'] for o in options if o['label'] == shape)


def solve_section_area(public):
    solid, l, w, h, u, key, normal, offset, rest = parse_solid(public['prompt'])
    require(rest == f'What is the area of the cross-section, in {UNITS[u][1]}?', 'Question')
    check_solid(public, solid, l, w, h, u, key)
    require(key in ('parallel-base', 'perpendicular-front', 'perpendicular-side', 'through-apex'), 'Area plane')
    return area(section(solid, l, w, h, normal, offset), normal)


SOLVERS = {
    'angle-pair-measure': solve_angle_pair,
    'angle-equation': solve_angle_equation,
    'triangle-angle-sum': solve_triangle_sum,
    'triangle-exterior-angle': solve_exterior,
    'parallel-lines-angle': solve_parallel,
    'triangle-side-test': solve_side_test,
    'triangle-third-side': solve_third_side,
    'triangle-conditions': solve_conditions,
    'cross-section-shape': solve_section_shape,
    'cross-section-area': solve_section_area,
}


def solve_angle_triangle(public):
    template = public['templateId']
    require(template in ANGLE_TRIANGLE, 'Unknown angle/triangle task')
    kind = public['response']['kind']
    require(kind == ('choice' if template in CHOICE_TYPES else 'number'), 'Response kind')
    answer = SOLVERS[template](public)
    return answer if template in CHOICE_TYPES else str(answer)


def review_angle_triangle_fixtures():
    def public(template, prompt, figure=None, options=None):
        p = {'templateId': template, 'prompt': prompt,
             'response': {'kind': 'choice', 'options': options} if options else {'kind': 'number'}}
        if figure:
            p['figure'] = figure
        return p
    rays = lambda r, pts, marks: {'kind': 'angle-rays', 'rays': r, 'vertex': 'O', 'points': pts, 'marks': marks}
    cases = [
        (public('angle-pair-measure', 'Points A, O and B lie on a straight line, and ray OC is drawn from O. ∠AOC measures 132°. What is the measure of ∠COB, in degrees?',
                rays([0, 48, 180], ['B', 'C', 'A'], [{'from': 1, 'to': 2, 'label': '132°'}, {'from': 0, 'to': 1, 'label': '?'}])), '48'),
        (public('angle-pair-measure', 'Lines AB and CD cross at O. ∠AOC measures 70°. What is the measure of ∠BOD, in degrees?',
                rays([0, 70, 180, 250], ['A', 'C', 'B', 'D'], [{'from': 0, 'to': 1, 'label': '70°'}, {'from': 2, 'to': 3, 'label': '?'}])), '70'),
        (public('angle-equation', 'Points A, O and B lie on a straight line, and ray OC is drawn from O. ∠AOC measures (3x + 12)° and ∠COB measures (2x − 7)°. What is the value of x?',
                rays([0, 63, 180], ['B', 'C', 'A'], [{'from': 1, 'to': 2, 'label': '(3x + 12)°'}, {'from': 0, 'to': 1, 'label': '(2x − 7)°'}])), '35'),
        (public('triangle-angle-sum', 'In triangle ABC, ∠A measures 48° and ∠B measures 67°. What is the measure of ∠C, in degrees?',
                {'kind': 'triangle-angles', 'angles': [48, 67, 65], 'vertices': ['A', 'B', 'C'], 'labels': ['48°', '67°', '?']}), '65'),
        (public('triangle-exterior-angle', 'In triangle ABC, side AB is extended past B to point D. ∠CBD measures 113° and ∠A measures 48°. What is the measure of ∠C, in degrees?',
                {'kind': 'triangle-angles', 'angles': [48, 67, 65], 'vertices': ['A', 'B', 'C'], 'labels': ['48°', None, '?'], 'exterior': {'point': 'D', 'label': '113°'}}), '65'),
        (public('triangle-third-side', 'Two sides of a triangle measure 6 cm and 10 cm. The third side is a whole number of centimeters. How many different lengths are possible for the third side?'), '11'),
        (public('cross-section-area', 'A right rectangular prism is 9 cm long, 4 cm wide and 6 cm tall. A plane slices it perpendicular to its base and parallel to the 9 cm edges of the base. What is the area of the cross-section, in square centimeters?',
                {'kind': 'solid-section', 'solid': 'prism', 'length': 9, 'width': 4, 'height': 6, 'plane': 'perpendicular-front', 'unit': 'cm'}), '54'),
        (public('cross-section-area', 'A right rectangular pyramid is 6 m tall, with a base 8 m long and 4 m wide. A plane slices it parallel to its base, halfway between the base and the apex. What is the area of the cross-section, in square meters?',
                {'kind': 'solid-section', 'solid': 'pyramid', 'length': 8, 'width': 4, 'height': 6, 'plane': 'parallel-base', 'unit': 'm'}), '8'),
    ]
    for p, expected in cases:
        require(solve_angle_triangle(p) == expected, f'Fixture failed: {p["prompt"]}')
    shape = lambda plane, solid: classify(section(solid, 8, 5, 6, *{
        'base': ((0, 0, 1), F(3)), 'front': ((0, 1, 0), F(5, 2)), 'off': ((0, 1, 0), F(5, 4)),
        'diag': ((5, -8, 0), F(0)), 'corner': (cross(sub((8, 5, 6), (0, 0, 6)), sub((8, 0, 0), (0, 0, 6))), dot(cross(sub((8, 5, 6), (0, 0, 6)), sub((8, 0, 0), (0, 0, 6))), (0, 0, 6)))}[plane]))
    require(shape('base', 'prism') == 'Rectangle' and shape('off', 'pyramid') == 'Trapezoid' and shape('front', 'pyramid') == 'Triangle'
            and shape('diag', 'prism') == 'Rectangle' and shape('corner', 'prism') == 'Triangle', 'Section classification fixtures')
    # Corrupted givens must be rejected or change the answer.
    bad = [
        public('triangle-angle-sum', 'In triangle ABC, ∠A measures 48° and ∠B measures 67°. What is the measure of ∠C, in degrees?',
               {'kind': 'triangle-angles', 'angles': [48, 66, 66], 'vertices': ['A', 'B', 'C'], 'labels': ['48°', '67°', '?']}),
        public('angle-pair-measure', 'Lines AB and CD cross at O. ∠AOC measures 70°. What is the measure of ∠AOB, in degrees?',
               rays([0, 70, 180, 250], ['A', 'C', 'B', 'D'], [{'from': 0, 'to': 1, 'label': '70°'}, {'from': 2, 'to': 3, 'label': '?'}])),
        public('angle-equation', 'Points A, O and B lie on a straight line, and ray OC is drawn from O. ∠AOC measures (3x + 12)° and ∠COB measures (2x − 8)°. What is the value of x?',
               rays([0, 63, 180], ['B', 'C', 'A'], [{'from': 1, 'to': 2, 'label': '(3x + 12)°'}, {'from': 0, 'to': 1, 'label': '(2x − 8)°'}])),
    ]
    for p in bad:
        try:
            solve_angle_triangle(p)
        except ValueError:
            continue
        raise ValueError(f'Corrupted case accepted: {p["prompt"]}')
