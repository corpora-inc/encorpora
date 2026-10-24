"""Independent prompt-and-figure oracle for coordinate geometry and circles
(G-GPE, G-C).

Circles are solved by searching lattice points that satisfy the stated
equation; areas by counting with Pick's theorem (interior and boundary lattice
points), perimeters by the distance formula; partition points by walking the
segment's lattice steps; perpendicular lines by checking dot products of
direction vectors; circle angles by placing points on a unit circle and
measuring with vectors. Generated answers, hints and explanations never enter
`solve_coordinate_circle`.
"""
import math
import re
from fractions import Fraction

COORDINATE_CIRCLE = frozenset({
    'circle-equation', 'coordinate-polygon', 'segment-partition', 'perpendicular-slopes', 'circle-angles',
})
N = r'(−?\d+)'


def require(condition, message):
    if not condition:
        raise ValueError(message)


def plain(text):
    def inner(m):
        t = m[1].replace('^2', '²').replace('^\\circ', '°').replace('-', '−')
        t = re.sub(r'\\frac\{(\d+)\}\{(\d+)\}', r'\1/\2', t)
        return re.sub(r'\s+', ' ', t).strip()
    return re.sub(r'\$([^$]*)\$', inner, text)


def i(text):
    return int(text.replace('−', '-'))


def points_of(text):
    return [(i(x), i(y)) for x, y in re.findall(rf'\({N}, {N}\)', text)]


# ---------------------------------------------------------------- circles
def circle_from_equation(eq):
    """Return (h, k, r²) by testing which centers and radii reproduce the
    equation's polynomial at sample points."""
    m = re.fullmatch(r'(.+) = (−?\d+)', eq)
    require(m is not None, f'Unreadable equation {eq}')
    lhs, rhs = m[1], i(m[2])

    require(re.fullmatch(r'[\dxy²()+−= ]+', eq) is not None, 'Only a circle equation')
    # Split the left side into signed terms at top-level + and −.
    terms, depth, cur, sign = [], 0, '', 1
    for ch in lhs.replace(' ', ''):
        if ch in '+−' and depth == 0 and cur:
            terms.append((sign, cur))
            cur, sign = '', (1 if ch == '+' else -1)
        elif ch in '+−' and depth == 0:
            sign = 1 if ch == '+' else -1
        else:
            depth += ch == '('
            depth -= ch == ')'
            cur += ch
    terms.append((sign, cur))

    def term(t, x, y):
        v = {'x': x, 'y': y}
        m = re.fullmatch(r'\(([xy])([+−])(\d+)\)²', t)
        if m:
            return (v[m[1]] + (int(m[3]) if m[2] == '+' else -int(m[3]))) ** 2
        m = re.fullmatch(r'([xy])²', t)
        if m:
            return v[m[1]] ** 2
        m = re.fullmatch(r'(\d*)([xy])', t)
        if m:
            return int(m[1] or 1) * v[m[2]]
        require(re.fullmatch(r'\d+', t) is not None, f'Unknown term {t}')
        return int(t)

    def evaluate(x, y):
        return sum(sg * term(t, x, y) for sg, t in terms) - rhs
    for h in range(-20, 21):
        for k in range(-20, 21):
            # f(x, y) = (x − h)² + (y − k)² − r² for every sample, with one r².
            values = {evaluate(x, y) - ((x - h) ** 2 + (y - k) ** 2) for x, y in ((0, 0), (1, 0), (0, 1), (2, 3), (-1, 5))}
            if len(values) == 1:
                r2 = -values.pop()
                if r2 > 0:
                    return h, k, r2
    raise ValueError('No circle')


def solve_circle(public, prompt):
    m = re.fullmatch(r'A circle has equation (.+)\. What is (its radius|the (x|y)-coordinate of its center)\?', prompt)
    if m:
        h, k, r2 = circle_from_equation(m[1])
        if m[2] == 'its radius':
            r = math.isqrt(r2)
            require(r * r == r2, 'A whole radius')
            return Fraction(r)
        return Fraction(h if m[3] == 'x' else k)
    m = re.fullmatch(rf'A circle has center \({N}, {N}\) and passes through \({N}, {N}\)\. Its equation is (.+)\. What is r²\?', prompt)
    if m:
        h, k, x, y = (i(v) for v in m.groups()[:4])
        return Fraction((x - h) ** 2 + (y - k) ** 2)
    require(prompt == 'The graph shows a circle with center C and a point P on it. Its equation is (x − a)² + (y − b)² = c. What is c?', f'Unrecognized circle prompt: {prompt}')
    g = [e for e in public['figure']['scene']['elements'] if e['type'] == 'graph'][0]
    pts = {p['label']: (p['x'], p['y']) for p in g['points']}
    (cx, cy), (px, py) = pts['C'], pts['P']
    circle = g['circles'][0]
    require(abs(math.hypot(px - cx, py - cy) - circle['r']) < 1e-9, 'P is on the circle')
    return Fraction((px - cx) ** 2 + (py - cy) ** 2)


# ------------------------------------------------------------ polygons
def lattice_area(poly):
    """Pick's theorem: A = I + B/2 − 1, counting lattice points directly."""
    def on_segment(p, a, b):
        cross = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])
        return cross == 0 and min(a[0], b[0]) <= p[0] <= max(a[0], b[0]) and min(a[1], b[1]) <= p[1] <= max(a[1], b[1])

    def inside(p):
        hit = False
        for j in range(len(poly)):
            a, b = poly[j], poly[(j + 1) % len(poly)]
            if (a[1] > p[1]) != (b[1] > p[1]):
                x = a[0] + (p[1] - a[1]) * (b[0] - a[0]) / (b[1] - a[1])
                if x > p[0]:
                    hit = not hit
        return hit
    xs, ys = [p[0] for p in poly], [p[1] for p in poly]
    interior = boundary = 0
    for x in range(min(xs), max(xs) + 1):
        for y in range(min(ys), max(ys) + 1):
            p = (x, y)
            if any(on_segment(p, poly[j], poly[(j + 1) % len(poly)]) for j in range(len(poly))):
                boundary += 1
            elif inside(p):
                interior += 1
    return Fraction(interior) + Fraction(boundary, 2) - 1


def solve_polygon(prompt):
    m = re.fullmatch(r'A (triangle|parallelogram|quadrilateral) has vertices (.+?)(, in order)?\. What is its (area, in square units|perimeter)\?', prompt)
    require(m is not None, f'Unrecognized polygon prompt: {prompt}')
    poly = points_of(m[2])
    require(len(poly) == {'triangle': 3, 'parallelogram': 4, 'quadrilateral': 4}[m[1]], 'Vertex count')
    if m[4] == 'perimeter':
        total = Fraction(0)
        for j in range(len(poly)):
            a, b = poly[j], poly[(j + 1) % len(poly)]
            d2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2
            d = math.isqrt(d2)
            require(d * d == d2, 'Whole side lengths')
            total += d
        return total
    return lattice_area(poly)


def solve_partition(prompt):
    m = re.fullmatch(rf'Point P is on segment AB, with A\({N}, {N}\) and B\({N}, {N}\), and divides it so that AP : PB = (\d+) : (\d+)\. What is the (x|y)-coordinate of P\?', prompt)
    if m:
        ax, ay, bx, by = (i(v) for v in m.groups()[:4])
        mm, nn, axis = int(m[5]), int(m[6]), m[7]
    else:
        m = re.fullmatch(rf'Point P is (\d+)/(\d+) of the way from A\({N}, {N}\) to B\({N}, {N}\)\. What is the (x|y)-coordinate of P\?', prompt)
        require(m is not None, f'Unrecognized partition prompt: {prompt}')
        num, den = int(m[1]), int(m[2])
        ax, ay, bx, by = (i(v) for v in m.groups()[2:6])
        mm, nn, axis = num, den - num, m[7]
    # Walk the segment in mm + nn equal steps and stop after mm of them.
    steps = mm + nn
    sx, sy = Fraction(bx - ax, steps), Fraction(by - ay, steps)
    x, y = Fraction(ax), Fraction(ay)
    for _ in range(mm):
        x, y = x + sx, y + sy
    # P splits AB with the stated ratio of lengths.
    ap = math.hypot(x - ax, y - ay)
    pb = math.hypot(bx - x, by - y)
    require(abs(ap * nn - pb * mm) < 1e-9, 'The ratio holds')
    return x if axis == 'x' else y


def solve_slopes(prompt):
    head = rf'Line ℓ passes through A\({N}, {N}\) and B\({N}, {N}\)\. '
    m = re.match(head, prompt)
    require(m is not None, f'Unrecognized slope prompt: {prompt}')
    ax, ay, bx, by = (i(v) for v in m.groups())
    d = (bx - ax, by - ay)
    rest = prompt[m.end():]
    m = re.fullmatch(r'What is the slope of a line (parallel|perpendicular) to ℓ\?', rest)
    if m:
        # A direction with zero dot product (perpendicular) or zero cross product (parallel).
        e = (d[0], d[1]) if m[1] == 'parallel' else (-d[1], d[0])
        require(e[0] != 0, 'Not vertical')
        return Fraction(e[1], e[0])
    m = re.fullmatch(rf'(?:The|A) line through P\({N}, {N}\) (parallel|perpendicular) to ℓ has equation y = mx \+ b\. What is b\?', rest)
    if m:
        px, py = i(m[1]), i(m[2])
        e = (d[0], d[1]) if m[3] == 'parallel' else (-d[1], d[0])
        require(e[0] != 0, 'Not vertical')
        # Walk from P along the direction to x = 0.
        t = Fraction(-px, e[0])
        return py + t * e[1]
    m = re.fullmatch(rf'Line j passes through C\({N}, {N}\) and D\({N}, k\)\. For which value of k is j perpendicular to ℓ\?', rest)
    require(m is not None, f'Unrecognized slope ask: {rest}')
    cx, cy, dx = i(m[1]), i(m[2]), i(m[3])
    # (dx − cx, k − cy) · d = 0.
    require(d[1] != 0, 'k is determined')
    return cy + Fraction(-(dx - cx) * d[0], d[1])


def solve_circle_angle(prompt):
    def angle(v, a, b):
        u1 = (a[0] - v[0], a[1] - v[1])
        u2 = (b[0] - v[0], b[1] - v[1])
        c = (u1[0] * u2[0] + u1[1] * u2[1]) / (math.hypot(*u1) * math.hypot(*u2))
        return math.degrees(math.acos(max(-1, min(1, c))))

    def on(deg):
        return (math.cos(math.radians(deg)), math.sin(math.radians(deg)))

    def whole(x, what):
        v = round(x)
        require(abs(x - v) < 1e-7, f'{what} is not whole')
        return Fraction(v)
    m = re.fullmatch(r'In circle O, central angle AOB measures (\d+)°, and C is on the circle but not on arc AB, the arc inside angle AOB\. What is the measure of inscribed angle ACB, in degrees\?', prompt)
    if m:
        central = int(m[1])
        A, B = on(0), on(central)
        return whole(angle(on(central + (360 - central) / 3), A, B), 'ACB')
    m = re.fullmatch(r'In circle O, inscribed angle ACB measures (\d+)°\. What is the measure of central angle AOB, in degrees, on the same arc AB\?', prompt)
    if m:
        target = int(m[1])
        # Search the central angle whose inscribed angle (from a far point) matches.
        hits = [c for c in range(1, 180) if abs(angle(on(c + (360 - c) / 2), on(0), on(c)) - target) < 1e-9]
        require(len(hits) == 1, 'One central angle')
        return Fraction(hits[0])
    m = re.fullmatch(r'AB is a diameter of circle O, and C is another point on the circle\. ∠CAB = (\d+)°\. What is the measure of ∠CBA, in degrees\?', prompt)
    if m:
        x = int(m[1])
        A, B = on(180), on(0)
        # Find C on the circle with ∠CAB = x by search, then measure ∠CBA.
        for c in range(1, 180):
            if abs(angle(A, on(c), B) - x) < 1e-9:
                return whole(angle(B, on(c), A), 'CBA')
        raise ValueError('No such C')
    m = re.fullmatch(r'PT is tangent to circle O at T\. (?:The radius is (\d+)|PT = (\d+)) and OP = (\d+)\. (How long is PT|What is the radius of the circle)\?', prompt)
    if m:
        op = int(m[3])
        if m[1]:
            r = int(m[1])
            # T on the circle where OT ⟂ TP: |TP|² = |OP|² − r², found by search over lattice lengths.
            hits = [t for t in range(1, op) if t * t + r * r == op * op]
            require(len(hits) == 1, 'A whole tangent length')
            return Fraction(hits[0])
        pt = int(m[2])
        hits = [r for r in range(1, op) if r * r + pt * pt == op * op]
        require(len(hits) == 1, 'A whole radius')
        return Fraction(hits[0])
    m = re.fullmatch(r'Points A, B, C and D are on a circle, with C and D on the same side of chord AB\. ∠ACB = (\d+)°\. What is the measure of ∠ADB, in degrees\?', prompt)
    require(m is not None, f'Unrecognized circle-angle prompt: {prompt}')
    x = int(m[1])
    A, B = on(0), on(2 * x)
    require(abs(angle(on(2 * x + (360 - 2 * x) * 0.3), A, B) - x) < 1e-9, 'C sees AB at the stated angle')
    return whole(angle(on(2 * x + (360 - 2 * x) * 0.8), A, B), 'ADB')


def solve_coordinate_circle(public):
    template = public['templateId']
    require(template in COORDINATE_CIRCLE, f'Unknown template {template}')
    prompt = plain(public['prompt'])
    if template == 'circle-equation':
        return solve_circle(public, prompt)
    if template == 'coordinate-polygon':
        return solve_polygon(prompt)
    if template == 'segment-partition':
        return solve_partition(prompt)
    if template == 'perpendicular-slopes':
        return solve_slopes(prompt)
    return solve_circle_angle(prompt)


def review_coordinate_circle_fixtures():
    def pub(template, prompt):
        return {'templateId': template, 'prompt': prompt, 'response': {'kind': 'number', 'label': 'x'}}

    def rejects(p):
        try:
            solve_coordinate_circle(p)
        except (ValueError, KeyError, IndexError):
            return True
        return False
    require(solve_coordinate_circle(pub('circle-equation', 'A circle has equation $x^2 + y^2 - 4x + 6y - 12 = 0$. What is its radius?')) == 5, 'General form')
    require(solve_coordinate_circle(pub('circle-equation', 'A circle has equation $(x + 3)^2 + y^2 = 16$. What is the x-coordinate of its center?')) == -3, 'Standard form')
    require(solve_coordinate_circle(pub('coordinate-polygon', 'A triangle has vertices A(0, 0), B(4, 0) and C(6, 3). What is its area, in square units?')) == 6, 'Pick')
    require(rejects(pub('coordinate-polygon', 'A triangle has vertices A(0, 0), B(2, 0) and C(3, 3). What is its perimeter?')), 'Irrational perimeter rejected')
    require(solve_coordinate_circle(pub('segment-partition', 'Point P is on segment AB, with A(−3, −2) and B(6, 4), and divides it so that AP : PB = 1 : 2. What is the y-coordinate of P?')) == 0, 'Partition')
    require(solve_coordinate_circle(pub('perpendicular-slopes', 'Line ℓ passes through A(0, 1) and B(3, 3). What is the slope of a line perpendicular to ℓ?')) == Fraction(-3, 2), 'Perpendicular')
    require(solve_coordinate_circle(pub('circle-angles', 'PT is tangent to circle O at T. The radius is 5 and OP = 13. How long is PT?')) == 12, 'Tangent')
    require(solve_coordinate_circle(pub('circle-angles', 'In circle O, central angle AOB measures 110°, and C is on the circle but not on arc AB, the arc inside angle AOB. What is the measure of inscribed angle ACB, in degrees?')) == 55, 'Inscribed')
    return 8


def review_coordinate_circle_problem(problem, solved):
    last = plain(problem['explanation'][-1])
    v = Fraction(solved)
    base = str(v.numerator) if v.denominator == 1 else f'{v.numerator}/{v.denominator}'
    require(any(re.search(rf'(?<![\d/.]){re.escape(s)}(?![\d/])', last) for s in {base, base.replace('-', '−')}),
            f'Explanation must conclude with the answer: {last}')
