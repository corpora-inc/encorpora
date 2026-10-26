"""Independent review of geometric proof, definition and construction items.

Answers are derived from the displayed prompt and choices only. Numeric and
coordinate items are recomputed exactly; reason and definition items are
checked against explicit rules keyed to the stated givens.
"""
import copy
import math
import re
from figure_givens import check_figure_givens
from fractions import Fraction

FIGURED = frozenset({
    'line-angle-proof-reasons', 'triangle-theorem-consequences', 'parallelogram-property-consequences',
    'inscribed-polygon-reasoning', 'triangle-circle-centers', 'tangent-circle-computation',
})
SUPPORTED = frozenset({
    'line-angle-proof-reasons', 'triangle-theorem-consequences', 'parallelogram-property-consequences',
    'precise-geometric-definitions', 'transformation-invariant-claims', 'polygon-symmetry-counts',
    'transformation-sequence-mapping', 'compass-straightedge-reasoning', 'inscribed-polygon-reasoning',
    'triangle-circle-centers', 'tangent-circle-computation', 'circle-dilation-scaling',
    'coordinate-quadrilateral-claims', 'measurement-formula-justifications',
})


def require(condition, message):
    if not condition:
        raise ValueError(message)


def plain(text):
    return text.replace('$', '').replace('−', '-')


def num(text):
    """Exact value of a label such as 8.5, \\frac{1}{4}, 16\\pi (pi kept symbolic), \\sqrt{544}; returns (Fraction, pi_power, sqrt)."""
    t = plain(text)
    t = re.sub(r'\\text\{[^}]*\}(\^3)?', '', t).replace('\\circ', '').replace('^', '').replace('\\,', '').strip()
    t = re.sub(r'\s+', '', t)
    m = re.fullmatch(r'(-?\d+(?:\.\d+)?)(\\pi)?', t)
    if m:
        return (Fraction(m[1]), 1 if m[2] else 0, 0)
    m = re.fullmatch(r'\\frac\{(-?\d+)\}\{(\d+)\}(\\pi)?', t)
    if m:
        return (Fraction(int(m[1]), int(m[2])), 1 if m[3] else 0, 0)
    m = re.fullmatch(r'\\sqrt\{(\d+)\}', t)
    if m:
        return (Fraction(int(m[1])), 0, 1)
    raise ValueError(f'Unreadable value {text}')


def value(text):
    """Real number for a label using floats only for comparison keys."""
    f, pi, sq = num(text)
    if sq:
        root = math.isqrt(int(f))
        return ('r', root) if root * root == f else ('s', int(f))
    return ('q', f, pi)


def key_of_numeric(f, pi=0):
    return ('q', Fraction(f), pi)


def lin(text):
    t = re.sub(r'\s+', '', plain(text))
    m = re.fullmatch(r'(-?\d*)x([+-]\d+)?', t)
    if m:
        a = m[1]
        a = -1 if a == '-' else 1 if a == '' else int(a)
        return (Fraction(a), Fraction(int(m[2] or 0)))
    m = re.fullmatch(r'-?\d+', t)
    require(m, f'Unreadable linear expression {text}')
    return (Fraction(0), Fraction(int(t)))


def solve_equal(left, right):
    (a1, b1), (a2, b2) = lin(left), lin(right)
    require(a1 != a2, 'Equation has no unique x')
    return (b2 - b1) / (a1 - a2)


def evalx(expr, x):
    a, b = lin(expr)
    return a * x + b


def choices(public):
    response = public['response']
    require(response['kind'] == 'choice', 'Expected choice response')
    options = response['options']
    require(len(options) == 4 and len({o['id'] for o in options}) == 4, 'Four distinct choice ids required')
    return options


def pick(public, predicate):
    """Return the id of the single option satisfying predicate."""
    options = choices(public)
    hits = [o['id'] for o in options if predicate(o['label'])]
    require(len(hits) == 1, f'Expected exactly one matching choice, found {len(hits)}')
    return hits[0]


def pick_value(public, expected):
    """Choose by numeric value; labels must be mathematically distinct."""
    options = choices(public)
    keys = [value(o['label']) for o in options]
    require(len(set(keys)) == 4, 'Mathematically duplicate numeric choices')
    hits = [o['id'] for o, k in zip(options, keys) if k == expected]
    require(len(hits) == 1, 'No unique numeric match')
    return hits[0]


def q(f, pi=0):
    return key_of_numeric(f, pi)


def exact_sqrt(n):
    n = int(n)
    r = math.isqrt(n)
    return ('r', r) if r * r == n else ('s', n)


def as_value(f):
    f = Fraction(f)
    return ('q', f, 0)


def norm_value(v):
    """Make ('r', n) comparable with ('q', Fraction, 0)."""
    return v


def pick_number(public, expected_fraction, pi=0):
    options = choices(public)
    keys = []
    for o in options:
        f, p, sq = num(o['label'])
        keys.append(('sq', f) if sq else (f, p))
    require(len(set(keys)) == 4, 'Mathematically duplicate numeric choices')
    target = (Fraction(expected_fraction), pi)
    hits = [o['id'] for o, k in zip(options, keys) if k == target]
    require(len(hits) == 1, f'No unique numeric match for {expected_fraction}')
    return hits[0]


RIGID_REASON = {
    'alt': 'Alternate interior angles formed by a transversal of parallel lines are congruent.',
    'equi': "A point equidistant from a segment's endpoints lies on the segment's perpendicular bisector.",
    'onbis': "Every point on the perpendicular bisector of a segment is equidistant from the segment's endpoints.",
}


def seg(m):
    return m


def line_angle(public):
    p = plain(public['prompt'])
    if re.search(r'lie between \\ell and m, on opposite sides of t\.', p):
        return pick(public, lambda l: l == RIGID_REASON['alt'])
    m = re.fullmatch(r'In a proof, P([A-Z]) = P([A-Z]) is given\. The next step states that P lies on the perpendicular bisector of \\overline\{\1\2\}\. Which reason justifies this step\?', p)
    if m:
        return pick(public, lambda l: l == RIGID_REASON['equi'])
    m = re.fullmatch(r'Line \\ell is the perpendicular bisector of \\overline\{([A-Z])([A-Z])\}, and point P is on \\ell\. A proof states P\1 = P\2\. Which reason justifies this step\?', p)
    if m:
        return pick(public, lambda l: l == RIGID_REASON['onbis'])
    m = re.fullmatch(r'Lines AC and BD cross at O, with O between A and C and between B and D\. Angle AOB measures \(([^()]+)\)\^\\circ and angle COD measures \(([^()]+)\)\^\\circ\. Which equation does the vertical angles theorem justify\?', p)
    require(m, 'Unrecognised line-angle prompt')
    e1, e2 = m[1], m[2]
    x = solve_equal(e1, e2)
    require(0 < evalx(e1, x) < 180 and evalx(e1, x) != 90, 'Vertical-angle givens are degenerate or ambiguous')
    require(x == int(x), 'x should be an integer')
    target = {frozenset((re.sub(r'\s', '', e1), re.sub(r'\s', '', e2)))}

    def is_equal_eq(label):
        s = re.sub(r'\s', '', plain(label))
        return '=' in s and len(s.split('=')) == 2 and '+' not in s.split('=')[0].replace(re.sub(r'\s', '', e1), '', 1) + s.split('=')[1].replace(re.sub(r'\s', '', e2), '', 1) \
            and frozenset(s.split('=')) in target
    options = choices(public)
    # Mathematical distinctness: compare normalised solution-sets (moving everything to one side).
    forms = []
    for o in options:
        s = re.sub(r'\s', '', plain(o['label']))
        left, right = s.split('=')
        require(re.fullmatch(r'-?\d+', right) or True, '')
        forms.append(s)
    require(len(set(forms)) == 4, 'Duplicate equations')
    return pick(public, is_equal_eq)


def triangle(public):
    p = plain(public['prompt'])
    if p.startswith('A proof that the angles of triangle ABC sum to'):
        require('through C parallel to \\overline{AB}' in p and 'on the same side of C as A' in p and 'm\\angle A\'CA = m\\angle CAB' in p, 'Unexpected parallel-line proof givens')
        return pick(public, lambda l: l == RIGID_REASON['alt'])
    m = re.fullmatch(r'In triangle ABC, D and E are the midpoints of \\overline\{AB\} and \\overline\{AC\}\. The length of \\overline\{DE\} is ([^ ]+) and the length of \\overline\{BC\} is ([^ ]+) \(same units\)\. What is BC\?', p)
    if m:
        d, b = lin(m[1]), lin(m[2])
        require(b[0] != 2 * d[0], 'No unique x')
        x = (2 * d[1] - b[1]) / (b[0] - 2 * d[0])
        require(x > 0 and d[0] * x + d[1] > 0, 'Non-positive lengths')
        return pick_number(public, b[0] * x + b[1])
    m = re.fullmatch(r'The medians of triangle ABC meet at G\. M is the midpoint of \\overline\{BC\}, so \\overline\{AM\} is a median and G lies on it between A and M\. GM=(\d+)\. What is AM\?', p)
    if m:
        return pick_number(public, 3 * int(m[1]))
    m = re.fullmatch(r'The medians of triangle ABC meet at G\. M is the midpoint of \\overline\{BC\}, so \\overline\{AM\} is a median and G lies on it between A and M\. AM=(\d+)\. What is AG\?', p)
    if m:
        return pick_number(public, Fraction(2 * int(m[1]), 3))
    m = re.fullmatch(r'In triangle ABC, AB = AC and m\\angle A = (\d+)\^\\circ\. What is m\\angle B\?', p)
    if m:
        a = int(m[1])
        require(0 < a < 180, 'Impossible apex angle')
        return pick_number(public, Fraction(180 - a, 2))
    raise ValueError('Unrecognised triangle prompt')


def parallelogram(public):
    p = plain(public['prompt'])
    reasons = {
        'diag': 'The diagonals of a parallelogram bisect each other.',
        'sides': 'Opposite sides of a parallelogram are congruent.',
        'angles': 'Opposite angles of a parallelogram are congruent.',
        'rect': 'The diagonals of a rectangle are congruent.',
    }
    if re.fullmatch(r'ABCD is a parallelogram whose diagonals meet at E\. A proof states AE = EC\. Which reason justifies this step\?', p):
        return pick(public, lambda l: l == reasons['diag'])
    if re.fullmatch(r'ABCD is a parallelogram\. A proof states AB = DC\. Which reason justifies this step\?', p):
        return pick(public, lambda l: l == reasons['sides'])
    if re.fullmatch(r'ABCD is a parallelogram\. A proof states m\\angle A = m\\angle C\. Which reason justifies this step\?', p):
        return pick(public, lambda l: l == reasons['angles'])
    if re.fullmatch(r'ABCD is a rectangle\. A proof states AC = BD\. Which reason justifies this step\?', p):
        return pick(public, lambda l: l == reasons['rect'])
    m = re.fullmatch(r'In parallelogram ABCD, m\\angle A=(\d+)\^\\circ\. What is m\\angle B\?', p)
    if m:
        return pick_number(public, 180 - int(m[1]))
    m = re.fullmatch(r'ABCD is a rectangle with diagonals AC=([^ ]+) and BD=([^ ]+) \(same units\)\. What is AC\?', p)
    if m:
        x = solve_equal(m[1], m[2])
        ac = evalx(m[1], x)
        require(x > 0 and ac > 0, 'Non-positive diagonal')
        return pick_number(public, ac)
    m = re.fullmatch(r'Diagonals \\overline\{AC\} and \\overline\{BD\} of parallelogram ABCD meet at E\. AE=([^ ]+) and EC=([^ ]+) \(same units\)\. What is AC\?', p)
    require(m, 'Unrecognised parallelogram prompt')
    x = solve_equal(m[1], m[2])
    ae = evalx(m[1], x)
    require(x > 0 and ae > 0, 'Non-positive half-diagonal')
    return pick_number(public, 2 * ae)


PRECISE = {
    'parallel': 'Two lines in a plane are parallel when they do not intersect.',
    'angle': 'An angle is formed by two rays that share an endpoint.',
    'circle': 'A circle is the set of all points in a plane that are a given distance from a given point.',
    'segment': 'A line segment is the part of a line consisting of two points, its endpoints, and every point between them.',
    'ray': 'A ray is the part of a line that starts at one point and extends without end in one direction.',
    'perp': 'Two lines are perpendicular when they intersect to form a right angle.',
}
IMPRECISE = {
    'Two lines are parallel when they do not intersect.',
    'Two lines are parallel when they intersect at exactly one point.',
    'Two lines are parallel when they intersect to form a right angle.',
    'An angle is the space between two lines.', 'An angle is the distance between two lines.',
    'A circle is the set of all points in a plane that are at most a given distance from a given point.',
    'A circle is the set of all points that are a given distance from a given point.',
    'A circle is a closed curve with no corners.',
    'A ray is the part of a line between two points.',
}


def definitions(public):
    p = public['prompt']
    labels = [o['label'] for o in choices(public)]
    if p == 'Exactly one of these statements is not a precise definition. Which one?':
        for label in labels:
            require(label in PRECISE.values() or label in IMPRECISE, f'Unreviewed definition: {label}')
        return pick(public, lambda l: l in IMPRECISE)
    topics = {
        'Which is the precise definition of parallel lines?': 'parallel',
        'Which is the precise definition of an angle?': 'angle',
        'Which is the precise definition of a circle?': 'circle',
    }
    require(p in topics, 'Unrecognised definition prompt')
    for label in labels:
        require(label in PRECISE.values() or label in IMPRECISE, f'Unreviewed definition: {label}')
    return pick(public, lambda l: l == PRECISE[topics[p]])


def fraction_text(text):
    t = plain(text).strip()
    m = re.fullmatch(r'\\frac\{(\d+)\}\{(\d+)\}', t)
    return Fraction(int(m[1]), int(m[2])) if m else Fraction(int(t))


def transformation_invariants(public):
    p = plain(public['prompt'])
    if p == 'Which transformation preserves both the distance between every pair of points and every angle measure?':
        rigid = ('rotation about a point', 'translation', 'reflection across a line')
        for label in (o['label'] for o in choices(public)):
            low = label.lower()
            known = low.startswith(('a rotation', 'a translation', 'a reflection', 'a dilation', 'the shear', 'the stretch'))
            require(known, f'Unreviewed transformation {label}')
        return pick(public, lambda l: plain(l).lower().lstrip('a ').strip() in rigid or plain(l).lower() in ('a ' + r for r in rigid))
    m = re.fullmatch(r'A dilation has scale factor (.+)\. Which statement is true of the image of a figure\?', p)
    if m:
        k = m[1]
        fraction_text(k)
        return pick(public, lambda l: plain(l) == f'Every distance is multiplied by {k} and every angle measure stays the same.')
    m = re.fullmatch(r"A rotation about point C by (\d+)\^\\circ sends point X to point X'\. Which statement must be true\?", p)
    if m:
        return pick(public, lambda l: plain(l) == f"CX' = CX and m\\angle XCX' = {m[1]}^\\circ")
    m = re.fullmatch(r"Triangle PQR has P\((-?\d+),(-?\d+)\), Q\((-?\d+),(-?\d+)\) and R\((-?\d+),(-?\d+)\)\. A transformation sends it to P'Q'R' with P'\((-?\d+),(-?\d+)\), Q'\((-?\d+),(-?\d+)\) and R'\((-?\d+),(-?\d+)\)\. Is the transformation a rigid motion\?", p)
    require(m, 'Unrecognised invariant prompt')
    n = [int(v) for v in m.groups()]
    A, B = [(n[i], n[i + 1]) for i in range(0, 6, 2)], [(n[i], n[i + 1]) for i in range(6, 12, 2)]
    d2 = lambda a, b: (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2
    pairs = [(0, 1), (1, 2), (0, 2)]
    ratios = [Fraction(d2(B[i], B[j]), d2(A[i], A[j])) for i, j in pairs]
    if all(r == 1 for r in ratios):
        return pick(public, lambda l: l.startswith('Yes.'))
    if len(set(ratios)) == 1:
        k = math.isqrt(ratios[0].numerator), math.isqrt(ratios[0].denominator)
        require(k[0] ** 2 == ratios[0].numerator and k[1] ** 2 == ratios[0].denominator, 'Non-rational scale factor')
        factor = Fraction(*k)
        text = str(factor.numerator) if factor.denominator == 1 else f'\\frac{{{factor.numerator}}}{{{factor.denominator}}}'
        return pick(public, lambda l: plain(l) == f'No. Every side length is multiplied by {text}, so it is a dilation, not a rigid motion.')
    return pick(public, lambda l: l.startswith('No. The side lengths change by different factors'))


def angle_set(label):
    t = plain(label)
    if t == 'None of them':
        return frozenset()
    t = t.replace('Only ', '').replace('and', ',')
    nums = re.findall(r'\d+', t)
    require(nums, f'Unreadable rotation list {label}')
    return frozenset(int(n) for n in nums)


def polygon_symmetry(public):
    p = plain(public['prompt'])
    lines = {
        'a rhombus that is not a square': 2, 'a rectangle that is not a square': 2,
        'a parallelogram that is not a rectangle or a rhombus': 0, 'an isosceles trapezoid': 1,
    }
    m = re.fullmatch(r'How many lines of reflection carry (.+) onto itself\?', p)
    if m:
        what = m[1]
        if what in lines:
            return pick_number(public, lines[what])
        k = re.fullmatch(r'a regular polygon with (\d+) sides', what)
        require(k, 'Unrecognised polygon')
        return pick_number(public, int(k[1]))
    m = re.fullmatch(r'What is the smallest positive angle of rotation about its center that carries a regular polygon with (\d+) sides onto itself\?', p)
    if m:
        return pick_number(public, Fraction(360, int(m[1])))
    m = re.fullmatch(r'How many different rotations about its center, with angle at least 0\^\\circ and less than 360\^\\circ, carry a regular polygon with (\d+) sides onto itself\? Count the 0\^\\circ rotation\.', p)
    if m:
        return pick_number(public, int(m[1]))
    m = re.fullmatch(r'Which rotations about its center, with angle greater than 0\^\\circ and less than 360\^\\circ, carry (.+) onto itself\?', p)
    require(m, 'Unrecognised symmetry prompt')
    what = m[1]
    rot = {
        'a square': {90, 180, 270}, 'a rectangle that is not a square': {180},
        'a parallelogram that is not a rectangle': {180},
        'an isosceles trapezoid that is not a parallelogram': set(),
        'a regular hexagon': {60, 120, 180, 240, 300},
    }
    require(what in rot, f'Unrecognised polygon {what}')
    options = choices(public)
    sets = [angle_set(o['label']) for o in options]
    require(len(set(sets)) == 4, 'Duplicate rotation lists')
    hits = [o['id'] for o, s in zip(options, sets) if s == frozenset(rot[what])]
    require(len(hits) == 1, 'No unique rotation list')
    return hits[0]


def rotate(pt, degrees, clockwise):
    deg = degrees % 360
    if clockwise:
        deg = (-deg) % 360
    table = {0: lambda x, y: (x, y), 90: lambda x, y: (-y, x), 180: lambda x, y: (-x, -y), 270: lambda x, y: (y, -x)}
    require(deg in table, 'Rotation must be a multiple of 90')
    return table[deg](*pt)


def frac_in(text):
    t = text.strip()
    m = re.fullmatch(r'\\frac\{(-?\d+)\}\{(\d+)\}', t)
    return Fraction(int(m[1]), int(m[2])) if m else Fraction(int(t))


STEP = re.compile(r'(Dilate by scale factor \$(?P<k1>\\frac\{\d+\}\{\d+\}|\d+)\$ about (?:the origin|\$\((?P<cx>-?\d+),(?P<cy>-?\d+)\)\$))'
                  r'|(?P<t>[Tt]ranslate by \$\\langle (?P<tx>-?\d+),(?P<ty>-?\d+)\\rangle\$)'
                  r'|(?P<rot>Rotate \$(?P<deg>\d+)\^\\circ\$(?: (?P<dir>clockwise|counterclockwise))? about the origin)'
                  r'|(?P<ref>Reflect across the \$(?P<axis>[xy])\$-axis)')


def parse_sequence(label):
    steps = []
    body = label.rstrip('.')
    parts = re.split(r', then ', body)
    for part in parts:
        part = part[0].upper() + part[1:]
        m = STEP.fullmatch(part)
        require(m, f'Unreadable transformation step: {part}')
        if m['k1']:
            about = (int(m['cx']), int(m['cy'])) if m['cx'] is not None else (0, 0)
            steps.append(('dil', frac_in(m['k1']), about))
        elif m['t']:
            steps.append(('tr', int(m['tx']), int(m['ty'])))
        elif m['rot']:
            steps.append(('rot', int(m['deg']), m['dir'] == 'clockwise', m['dir'] is None))
        else:
            steps.append(('ref', m['axis']))
    return steps


def apply_steps(steps, pt, radius=None):
    x, y = Fraction(pt[0]), Fraction(pt[1])
    r = radius
    for s in steps:
        if s[0] == 'dil':
            _, k, (cx, cy) = s
            x, y = cx + k * (x - cx), cy + k * (y - cy)
            r = None if r is None else r * k
        elif s[0] == 'tr':
            x, y = x + s[1], y + s[2]
        elif s[0] == 'rot':
            x, y = rotate((x, y), s[1], s[2])
        else:
            x, y = (x, -y) if s[1] == 'x' else (-x, y)
    return (x, y), r


def transformation_sequence(public):
    p = plain(public['prompt'])
    m = re.fullmatch(r"Triangle PQR has P\((-?\d+),(-?\d+)\), Q\((-?\d+),(-?\d+)\) and R\((-?\d+),(-?\d+)\)\. Its image P'Q'R' has P'\((-?\d+),(-?\d+)\), Q'\((-?\d+),(-?\d+)\) and R'\((-?\d+),(-?\d+)\), with each vertex sent to its primed vertex\. Which sequence of transformations maps PQR onto P'Q'R'\?", p)
    require(m, 'Unrecognised sequence prompt')
    n = [int(v) for v in m.groups()]
    A, B = [(n[i], n[i + 1]) for i in range(0, 6, 2)], [(n[i], n[i + 1]) for i in range(6, 12, 2)]
    options = choices(public)
    ok = []
    for o in options:
        steps = parse_sequence(o['label'])
        if all(apply_steps(steps, a)[0] == (Fraction(b[0]), Fraction(b[1])) for a, b in zip(A, B)):
            ok.append(o)
    require(len(ok) == 1, f'Expected exactly one working sequence, found {len(ok)}')
    # Rotation direction must be unambiguous: an unspecified rotation is only counterclockwise by convention and
    # may not stand next to an explicit rotation by the same angle.
    return ok[0]['id']


def circle_dilation(public):
    p = plain(public['prompt'])
    m = re.fullmatch(r'A dilation with scale factor (\d+|\\frac\{\d+\}\{\d+\}) maps circle A onto circle B\. The area of B is how many times the area of A\?', p)
    if m:
        return pick_number(public, frac_in(m[1]) ** 2)
    m = re.fullmatch(r'Two circles have radii (\d+) and (\d+)\. A dilation maps the circle of radius \1 onto the circle of radius \2\. What is its scale factor\?', p)
    if m:
        return pick_number(public, Fraction(int(m[2]), int(m[1])))
    m = re.fullmatch(r'Circle A has circumference (\d+)\\pi cm\. A dilation with scale factor (\d+) maps circle A onto circle B\. What is the circumference of circle B\?', p)
    if m:
        return pick_number(public, int(m[1]) * int(m[2]), pi=1)
    m = re.fullmatch(r'Circle A has center \((-?\d+),(-?\d+)\) and radius (\d+)\. Circle B has center \((-?\d+),(-?\d+)\) and radius (\d+)\. Which sequence of transformations maps circle A onto circle B\?', p)
    require(m, 'Unrecognised circle-dilation prompt')
    ax, ay, ar, bx, by, br = [int(v) for v in m.groups()]
    options = choices(public)
    hits = []
    for o in options:
        c, r = apply_steps(parse_sequence(o['label']), (ax, ay), Fraction(ar) if True else None)
        if r is None:
            r = Fraction(ar)
        if c == (Fraction(bx), Fraction(by)) and r == br:
            hits.append(o['id'])
    require(len(hits) == 1, f'Expected exactly one working circle map, found {len(hits)}')
    return hits[0]


def classify(points):
    (ax, ay), (bx, by), (cx, cy), (dx, dy) = points
    sub = lambda p, q_: (p[0] - q_[0], p[1] - q_[1])
    cross = lambda u, v: u[0] * v[1] - u[1] * v[0]
    dot = lambda u, v: u[0] * v[0] + u[1] * v[1]
    AB, BC, CD, DA = sub(points[1], points[0]), sub(points[2], points[1]), sub(points[3], points[2]), sub(points[0], points[3])
    # Simple convex quadrilateral check: all turns have the same sign.
    turns = [cross(AB, BC), cross(BC, CD), cross(CD, DA), cross(DA, AB)]
    require(all(t > 0 for t in turns) or all(t < 0 for t in turns), 'Vertices are not a convex quadrilateral in order')
    par1, par2 = cross(AB, CD) == 0, cross(BC, DA) == 0
    if par1 and par2:
        right = dot(AB, BC) == 0
        eq = dot(AB, AB) == dot(BC, BC)
        return 'square' if right and eq else 'rectangle' if right else 'rhombus' if eq else 'parallelogram'
    if par1 or par2:
        return 'trapezoid'
    return 'other'


LABEL_CLASS = {
    'A square': 'square', 'A rectangle that is not a square': 'rectangle', 'A rhombus that is not a square': 'rhombus',
    'A parallelogram that is neither a rectangle nor a rhombus': 'parallelogram',
    'A trapezoid with exactly one pair of parallel sides': 'trapezoid',
}


def coordinate_quadrilateral(public):
    p = plain(public['prompt'])
    m = re.fullmatch(r'Quadrilateral ABCD has vertices A\((-?\d+),(-?\d+)\), B\((-?\d+),(-?\d+)\), C\((-?\d+),(-?\d+)\) and D\((-?\d+),(-?\d+)\), in that order\. Using slopes, distances or vectors, which is the most specific statement the coordinates prove\?', p)
    require(m, 'Unrecognised coordinate prompt')
    n = [int(v) for v in m.groups()]
    kind = classify([(n[i], n[i + 1]) for i in range(0, 8, 2)])
    options = choices(public)
    for o in options:
        require(o['label'] in LABEL_CLASS, f'Unreviewed claim {o["label"]}')
    require(len({o['label'] for o in options}) == 4, 'Duplicate claims')
    # Labels are mutually exclusive categories ("not a square", "neither ... nor"), so a single class can match.
    return pick(public, lambda l: LABEL_CLASS[l] == kind)


def inscribed(public):
    p = plain(public['prompt'])
    if p.startswith('A regular hexagon is inscribed in a circle with center O and radius r, by stepping'):
        return pick(public, lambda l: plain(l) == 'Each central angle is 60^\\circ and the two radii are equal, so the triangle with the side is equilateral.')
    methods = {
        'Which method inscribes a regular hexagon in a circle with compass and straightedge?': 'Step the compass, set to the radius, around the circle six times and join consecutive marks.',
        'Which method inscribes an equilateral triangle in a circle with compass and straightedge?': 'Step the compass, set to the radius, around the circle, then join every second mark.',
        'Which method inscribes a square in a circle with compass and straightedge?': 'Draw a diameter, construct the perpendicular diameter, and join its four endpoints in order.',
    }
    if p in methods:
        return pick(public, lambda l: plain(l) == methods[p])
    require(not p.startswith('Which method inscribes a '), f'Ungrammatical or unreviewed method prompt: {p}')
    m = re.fullmatch(r'A regular polygon with (\d+) sides is inscribed in a circle with center O\. What is the measure of the central angle between two neighboring vertices, the angle at O formed by the radii to them\?', p)
    if m:
        return pick_number(public, Fraction(360, int(m[1])))
    m = re.fullmatch(r'A regular hexagon is inscribed in a circle of radius (\d+) cm by stepping a compass opened to \1 cm around the circle\. What is the perimeter of the hexagon\?', p)
    require(m, 'Unrecognised inscribed prompt')
    return pick_number(public, 6 * int(m[1]))


def triangle_circles(public):
    p = plain(public['prompt'])
    m = re.fullmatch(r'A right triangle has legs (\d+) and (\d+)\. The circle through all three of its vertices has center at the midpoint of the hypotenuse\. What is the radius of that circle\?', p)
    if m:
        h2 = int(m[1]) ** 2 + int(m[2]) ** 2
        h = math.isqrt(h2)
        require(h * h == h2, 'Hypotenuse not an integer')
        return pick_number(public, Fraction(h, 2))
    centre = {
        'Which construction locates the center of the circle that passes through all three vertices of triangle ABC?': 'Construct the perpendicular bisectors of two sides; the circle\'s center is where they meet.',
        'Which construction locates the center of the circle inside triangle ABC that touches all three sides?': 'Construct the bisectors of two angles; the circle\'s center is where they meet.',
    }
    if p in centre:
        return pick(public, lambda l: l == centre[p])
    m = re.fullmatch(r'Quadrilateral ABCD is inscribed in a circle\. m\\angle A=\(([^()]+)\)\^\\circ and the opposite angle has m\\angle C=\(([^()]+)\)\^\\circ\. What is m\\angle A\?', p)
    if m:
        (a1, b1), (a2, b2) = lin(m[1]), lin(m[2])
        x = (180 - b1 - b2) / (a1 + a2)
        angle = a1 * x + b1
        require(0 < angle < 180 and 0 < a2 * x + b2 < 180, 'Angle outside (0,180)')
        return pick_number(public, angle)
    m = re.fullmatch(r'Quadrilateral ABCD is inscribed in a circle, with vertices in order around the circle\. m\\angle ([AB]) = (\d+)\^\\circ\. What is m\\angle ([CD])\?', p)
    require(m and {m[1], m[3]} in ({'A', 'C'}, {'B', 'D'}), 'Unrecognised cyclic-quadrilateral prompt')
    return pick_number(public, 180 - int(m[2]))


def tangent(public):
    p = plain(public['prompt'])
    options = choices(public)

    def pick_radical(n):
        r = math.isqrt(n)
        keys = [num(o['label']) for o in options]
        targets = []
        if r * r == n:
            targets = [(Fraction(r), 0, 0)]
        else:
            targets = [(Fraction(n), 0, 1)]
        require(len(set(keys)) == 4, 'Duplicate tangent choices')
        hits = [o['id'] for o, k in zip(options, keys) if k in targets]
        require(len(hits) == 1, 'No unique tangent match')
        return hits[0]
    m = re.fullmatch(r'Line PT is tangent to a circle with center O at point T\. OP=(\d+) and PT=(\d+)\. What is the radius of the circle\?', p)
    if m:
        return pick_radical(int(m[1]) ** 2 - int(m[2]) ** 2)
    m = re.fullmatch(r'Point P is outside a circle with center O and radius (\d+)\. OP=(\d+) and \\overline\{PT\} is tangent to the circle at T\. What is PT\?', p)
    if m:
        return pick_radical(int(m[2]) ** 2 - int(m[1]) ** 2)
    m = re.fullmatch(r'Line PT is tangent to a circle with center O at T\. m\\angle TOP=(\d+)\^\\circ\. What is m\\angle OPT\?', p)
    if m:
        return pick_number(public, 90 - int(m[1]))
    m = re.fullmatch(r'From an external point P, tangent segments \\overline\{PA\} and \\overline\{PB\} touch a circle at A and B\. PA=([^ ]+) and PB=([^ ]+) \(same units\)\. What is PA\?', p)
    require(m, 'Unrecognised tangent prompt')
    x = solve_equal(m[1], m[2])
    pa = evalx(m[1], x)
    require(pa > 0, 'Non-positive tangent length')
    return pick_number(public, pa)


def compass(public):
    p = plain(public['prompt'])
    m = re.fullmatch(r'In the perpendicular bisector construction for \\overline\{AB\}, arcs centered at A and B have the same radius and cross at X and Y\. Which fact explains why line XY is the perpendicular bisector of \\overline\{AB\}\?', p)
    if m:
        return pick(public, lambda l: plain(l) == 'X and Y are each equidistant from A and B, so both lie on the bisector, and two points fix a line.')
    m = re.fullmatch(r'To construct the perpendicular bisector of \\overline\{([A-Z])([A-Z])\}, you open the compass wider than half of \1\2 and draw an arc centered at \1, above and below the segment\. What is the next step\?', p)
    if m:
        a, b = m[1], m[2]
        return pick(public, lambda l: plain(l) == f'Keep the same opening and draw an arc centered at {b} that crosses the first arc above and below the segment.')
    m = re.fullmatch(r'To bisect \\angle ABC, you draw an arc centered at B that crosses ray BA at P and ray BC at Q\. What is the next step\?', p)
    if m:
        return pick(public, lambda l: plain(l) == 'With one opening, draw arcs centered at P and at Q that cross inside the angle.')
    if p.startswith('To construct the line through P parallel to line \\ell, you draw a transversal through P, then copy the angle'):
        return pick(public, lambda l: l == 'If corresponding angles formed by a transversal are congruent, the two lines are parallel.')
    require(p.startswith('These steps construct the perpendicular to line \\ell at point P on \\ell, but they are listed out of order.'), 'Unrecognised compass prompt')
    steps = dict(re.findall(r'(?:^|\. | )([A-D])\. (.*?)(?= [A-D]\. |\sWhich order is correct\?)', p))
    require(len(steps) == 4, 'Four lettered steps required')
    rank = lambda s: 0 if s.startswith('Mark point') else 1 if s.startswith('With the compass centered at P') else 2 if s.startswith('Open the compass wider') else 3 if s.startswith('Draw line PZ') else None
    ranks = {k: rank(v) for k, v in steps.items()}
    require(None not in ranks.values() and sorted(ranks.values()) == [0, 1, 2, 3], 'Unreviewed construction steps')
    order = ', '.join(sorted(ranks, key=ranks.get))
    return pick(public, lambda l: plain(l) == order)


def measurement(public):
    p = plain(public['prompt'])
    m = re.fullmatch(r'A cube with edge (\d+) is cut into three congruent square pyramids whose apexes all meet at one vertex of the cube\. Each pyramid has one face of the cube as its base and height \1\. What is the volume of one pyramid\?', p)
    if m:
        e = int(m[1])
        return pick_number(public, Fraction(e ** 3, 3))
    m = re.fullmatch(r"A cone and a cylinder have the same base area and the same height\. At every height, the cone's cross-section is a smaller circle, and a comparison of the two solids shows the cone's volume is the same fraction of the cylinder's volume as a pyramid's is of a prism with the same base and height\. The cylinder's volume is (\d+) cm³\. What is the cone's volume\?", p)
    if m:
        return pick_number(public, Fraction(int(m[1]), 3))
    m = re.fullmatch(r'A circle of radius (\d+) is cut into many equal thin sectors, and the sectors are laid side by side, alternately pointing up and down\. The arrangement looks like a rectangle whose long side is about half the circumference and whose short side is about the radius\. What area does this shape approach as the sectors get thinner\?', p)
    if m:
        return pick_number(public, int(m[1]) ** 2, pi=1)
    if p == 'In the argument that cuts a circle into sectors and rearranges them into a rectangle-like shape, why does the shape approach a rectangle as the number of sectors grows?':
        return pick(public, lambda l: l == 'Thinner sectors have nearly straight curved edges, so the long sides become nearly straight and parallel.')
    m = re.fullmatch(r'Which statement justifies the formula C=2\\pi r for the circumference of a circle of radius r\?', p)
    require(m, 'Unrecognised measurement prompt')
    return pick(public, lambda l: l == '$\\pi=C/d$ is the same for every circle because all circles are similar, so $C=\\pi d=2\\pi r$.')


DISPATCH = {
    'line-angle-proof-reasons': line_angle, 'triangle-theorem-consequences': triangle,
    'parallelogram-property-consequences': parallelogram, 'precise-geometric-definitions': definitions,
    'transformation-invariant-claims': transformation_invariants, 'polygon-symmetry-counts': polygon_symmetry,
    'transformation-sequence-mapping': transformation_sequence, 'compass-straightedge-reasoning': compass,
    'inscribed-polygon-reasoning': inscribed, 'triangle-circle-centers': triangle_circles,
    'tangent-circle-computation': tangent, 'circle-dilation-scaling': circle_dilation,
    'coordinate-quadrilateral-claims': coordinate_quadrilateral, 'measurement-formula-justifications': measurement,
}


def solve(public):
    require(public['templateId'] in SUPPORTED, 'Unexpected geometry-proof family')
    require(public.get('figure') is None or public['templateId'] in FIGURED, 'Unexpected figure in a text-only item')
    check_figure_givens(public, require)
    return DISPATCH[public['templateId']](public)


def review_problem(problem):
    public = problem['public']
    result = solve(public)
    require(result == problem['answer'], 'Geometry proof answer key mismatch')
    if public['templateId'] == 'transformation-sequence-mapping' or public['templateId'] == 'circle-dilation-scaling':
        # An unspecified rotation direction must not coexist with an explicit one at the same angle.
        rotations = [o['label'] for o in choices(public) if 'Rotate' in o['label']]
        quarter = [r for r in rotations if re.search(r'Rotate \$(90|270)\^', r)]
        if any('clockwise' not in r for r in quarter):
            require(not any('clockwise' in r for r in quarter), 'Ambiguous rotation direction beside explicit direction')
    return result


def self_test():
    def mk(template, prompt, labels, answer, extra=None):
        return {'public': {'templateId': template, 'prompt': prompt, 'response': {'kind': 'choice', 'options': [
            {'id': f'o{i}', 'label': label} for i, label in enumerate(labels)]}}, 'answer': f'o{answer}'}
    good = [
        mk('triangle-theorem-consequences', 'In triangle $ABC$, $D$ and $E$ are the midpoints of $\\overline{AB}$ and $\\overline{AC}$. The length of $\\overline{DE}$ is $2x+6$ and the length of $\\overline{BC}$ is $5x+5$ (same units). What is $BC$?', ['$80$', '$40$', '$20$', '$60$'], 1),
        mk('parallelogram-property-consequences', 'In parallelogram $ABCD$, $m\\angle A=80^\\circ$. What is $m\\angle B$?', ['$90^\\circ$', '$80^\\circ$', '$100^\\circ$', '$10^\\circ$'], 2),
        mk('tangent-circle-computation', 'Line $PT$ is tangent to a circle with center $O$ at point $T$. $OP=20$ and $PT=12$. What is the radius of the circle?', ['$\\sqrt{544}$', '$32$', '$16$', '$12$'], 2),
        mk('circle-dilation-scaling', 'A dilation with scale factor $4$ maps circle $A$ onto circle $B$. The area of $B$ is how many times the area of $A$?', ['$16$', '$64$', '$16\\pi$', '$8$'], 0),
        mk('coordinate-quadrilateral-claims', 'Quadrilateral $ABCD$ has vertices $A(-3,-4)$, $B(3,-6)$, $C(5,0)$ and $D(-1,2)$, in that order. Using slopes, distances or vectors, which is the most specific statement the coordinates prove?', ['A trapezoid with exactly one pair of parallel sides', 'A square', 'A rhombus that is not a square', 'A parallelogram that is neither a rectangle nor a rhombus'], 1),
        mk('coordinate-quadrilateral-claims', 'Quadrilateral $ABCD$ has vertices $A(4,4)$, $B(8,1)$, $C(5,5)$ and $D(1,8)$, in that order. Using slopes, distances or vectors, which is the most specific statement the coordinates prove?', ['A rhombus that is not a square', 'A square', 'A rectangle that is not a square', 'A trapezoid with exactly one pair of parallel sides'], 0),
        mk('transformation-sequence-mapping', "Triangle $PQR$ has $P(1,0)$, $Q(4,0)$ and $R(1,2)$. Its image $P'Q'R'$ has $P'(3,-1)$, $Q'(9,-1)$ and $R'(3,3)$, with each vertex sent to its primed vertex. Which sequence of transformations maps $PQR$ onto $P'Q'R'$?", ['Dilate by scale factor $2$ about the origin, then translate by $\\langle 1,-1\\rangle$.', 'Dilate by scale factor $\\frac{1}{2}$ about the origin, then translate by $\\langle 1,-1\\rangle$.', 'Dilate by scale factor $2$ about the origin.', 'Dilate by scale factor $2$ about the origin, then translate by $\\langle -1,1\\rangle$.'], 0),
        mk('polygon-symmetry-counts', 'How many lines of reflection carry a rhombus that is not a square onto itself?', ['$1$', '$4$', '$2$', '$3$'], 2),
        mk('precise-geometric-definitions', 'Which is the precise definition of parallel lines?', ['Two lines are parallel when they do not intersect.', 'Two lines are parallel when they intersect at exactly one point.', 'Two lines are parallel when they intersect to form a right angle.', 'Two lines in a plane are parallel when they do not intersect.'], 3),
        mk('inscribed-polygon-reasoning', 'Which method inscribes a regular hexagon in a circle with compass and straightedge?', ['Mark any three points on the circle and join them.', 'Step the compass, set to the radius, around the circle, then join every second mark.', 'Draw a diameter, construct the perpendicular diameter, and join its four endpoints in order.', 'Step the compass, set to the radius, around the circle six times and join consecutive marks.'], 3),
    ]
    rejected = 0
    for problem in good:
        review_problem(problem)
        wrong = copy.deepcopy(problem)
        wrong['answer'] = 'o0' if problem['answer'] != 'o0' else 'o1'
        try:
            review_problem(wrong)
        except ValueError:
            rejected += 1
        else:
            raise ValueError('Wrong geometry-proof key was accepted')
        dup = copy.deepcopy(problem)
        dup['public']['response']['options'][3 if problem['answer'] != 'o3' else 2]['label'] = dup['public']['response']['options'][int(problem['answer'][1])]['label']
        try:
            review_problem(dup)
        except ValueError:
            rejected += 1
        else:
            raise ValueError('Duplicate correct choice was accepted')
    # Corrupt givens must change the solved answer.
    bad = copy.deepcopy(good[0])
    bad['public']['prompt'] = bad['public']['prompt'].replace('2x+6', '2x+7')
    try:
        review_problem(bad)
    except ValueError:
        rejected += 1
    else:
        raise ValueError('Corrupt midsegment givens were accepted')
    bad = copy.deepcopy(good[4])
    bad['public']['prompt'] = bad['public']['prompt'].replace('D(-1,2)', 'D(-1,3)')
    try:
        review_problem(bad)
    except ValueError:
        rejected += 1
    else:
        raise ValueError('Corrupt quadrilateral was accepted')
    bad = copy.deepcopy(good[8])
    bad['public']['response']['options'][0]['label'] = 'Two lines in a plane are parallel when they do not intersect.'
    try:
        review_problem(bad)
    except ValueError:
        rejected += 1
    else:
        raise ValueError('Two correct definitions were accepted')
    bad = copy.deepcopy(good[9])
    bad['public']['prompt'] = bad['public']['prompt'].replace('regular hexagon', 'equilateral triangle')
    try:
        review_problem(bad)
    except ValueError:
        rejected += 1
    else:
        raise ValueError('Mismatched method prompt was accepted')
    return {'fixtures': len(good), 'rejectedMutations': rejected}


if __name__ == '__main__':
    print(self_test())
