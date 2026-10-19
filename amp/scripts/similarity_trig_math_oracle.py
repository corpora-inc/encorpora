"""Independent prompt-and-figure oracle for similarity and right-triangle
trigonometry (G-SRT).

Answers come from constructions, not from the rules the generator teaches:
dilations are applied to coordinates and lengths measured; similar triangles
are checked against the drawn figure; special triangles are built from an
equilateral triangle or a square; trigonometric ratios are read from a
triangle completed with integer square roots; cofunction items are solved by
searching angles with the sine and cosine functions. Generated answers, hints
and explanations never enter `solve_similarity_trig`.
"""
import math
import re
from fractions import Fraction

SIMILARITY_TRIG = frozenset({
    'dilation-measure', 'similar-triangle-side', 'special-right-triangle', 'trig-ratio', 'complementary-trig',
})
NUM = r'(−?\d+(?:/\d+)?)'


def require(condition, message):
    if not condition:
        raise ValueError(message)


def plain(text):
    """Read the TeX the generator writes ($\\sin A = \\frac{3}{5}$) as plain notation."""
    def inner(m):
        t = m[1]
        t = re.sub(r'\\frac\{(\d+)\}\{(\d+)\}', r'\1/\2', t)
        t = re.sub(r'\\sqrt\{(\d+)\}', r'√\1', t)
        t = t.replace('^\\circ', '°').replace('\\theta', 'θ').replace('\\sin', 'sin').replace('\\cos', 'cos').replace('\\tan', 'tan')
        t = t.replace('-', '−')
        return re.sub(r'\s+', ' ', t).strip()
    return re.sub(r'\$([^$]*)\$', inner, text)


def F(text):
    return Fraction(text.replace('−', '-'))


def nearest(x, what):
    """An exact value for a float the construction measured."""
    v = Fraction(x).limit_denominator(1000)
    require(abs(float(v) - x) < 1e-9, f'{what} is not a simple rational: {x}')
    return v


def figure_elements(public, kind):
    fig = public.get('figure')
    require(fig and fig['kind'] == 'scene', 'A scene figure is required')
    return [e for e in fig['scene']['elements'] if e.get('type') == kind]


def dist(p, q):
    return math.hypot(q[0] - p[0], q[1] - p[1])


def solve_dilation(prompt, public):
    m = re.fullmatch(rf'A dilation with center O and scale factor {NUM} maps A to A′ and B to B′\. AB = (\d+)\. What is A′B′\?', prompt)
    if m:
        k, L = F(m[1]), int(m[2])
        g = figure_elements(public, 'graph')[0]
        pts = {p['label']: (p['x'], p['y']) for p in g['points']}
        require(pts['O'] == (0, 0) and abs(dist(pts['A'], pts['B']) - L) < 1e-9, 'The figure shows AB')
        a2 = (float(k) * pts['A'][0], float(k) * pts['A'][1])
        b2 = (float(k) * pts['B'][0], float(k) * pts['B'][1])
        return nearest(dist(a2, b2), "A′B′")
    m = re.fullmatch(rf'A dilation with center O maps segment AB, of length (\d+), to segment A′B′, of length {NUM}\. What is the scale factor\?', prompt)
    if m:
        return F(m[2]) / int(m[1])
    m = re.fullmatch(rf'A dilation with center C\({NUM}, {NUM}\) and scale factor {NUM} maps P\({NUM}, {NUM}\) to P′\. What is the (x|y)-coordinate of P′\?', prompt)
    if m:
        c = (F(m[1]), F(m[2]))
        k = F(m[3])
        p = (F(m[4]), F(m[5]))
        image = (k * p[0] + (1 - k) * c[0], k * p[1] + (1 - k) * c[1])
        # P′ is on ray CP, k times as far from C.
        require(image[0] - c[0] == k * (p[0] - c[0]) and image[1] - c[1] == k * (p[1] - c[1]), 'Image on the ray')
        return image[0] if m[6] == 'x' else image[1]
    m = re.fullmatch(rf'Line ℓ has slope {NUM} and does not pass through the center of a dilation with scale factor {NUM}\. What is the slope of the image of ℓ\?', prompt)
    if m:
        slope, k = F(m[1]), F(m[2])
        # Two points of y = slope·x + 1, dilated about the origin (not on ℓ).
        p, q = (Fraction(0), Fraction(1)), (Fraction(1), slope + 1)
        p2, q2 = (k * p[0], k * p[1]), (k * q[0], k * q[1])
        return (q2[1] - p2[1]) / (q2[0] - p2[0])
    m = re.fullmatch(rf'Triangle ABC has ∠B = (\d+)°\. A dilation with scale factor {NUM} maps it to triangle A′B′C′\. What is the measure of ∠B′, in degrees\?', prompt)
    require(m is not None, f'Unrecognized dilation prompt: {prompt}')
    angle, k = int(m[1]), float(F(m[2]))
    t = math.radians(angle)
    b, a, c = (2.0, 1.0), (3.0, 1.0), (2.0 + math.cos(t), 1.0 + math.sin(t))
    b2, a2, c2 = [(k * x, k * y) for x, y in (b, a, c)]
    u, v = (a2[0] - b2[0], a2[1] - b2[1]), (c2[0] - b2[0], c2[1] - b2[1])
    measured = math.degrees(math.acos((u[0] * v[0] + u[1] * v[1]) / (math.hypot(*u) * math.hypot(*v))))
    return nearest(round(measured, 9), 'the image angle')


def side_lengths(t):
    p = t['points']
    return [dist(p[i], p[(i + 1) % 3]) for i in range(3)]


def solve_similar(prompt, public):
    m = re.fullmatch(r'Triangle ABC is similar to triangle DEF, with A, B and C matching D, E and F\. (.+)\. What is (AB|BC|CA|DE|EF|FD)\?', prompt)
    if m:
        given = {k: F(v) for k, v in re.findall(rf'(AB|BC|CA|DE|EF|FD) = {NUM}', m[1])}
        names = (['AB', 'BC', 'CA'], ['DE', 'EF', 'FD'])
        full = 0 if all(n in given for n in names[0]) else 1
        require(all(n in given for n in names[full]), 'One triangle is given in full')
        a, b, c = (given[n] for n in names[full])
        require(a + b > c and a + c > b and b + c > a, 'A real triangle')
        known = [i for i in range(3) if names[1 - full][i] in given]
        require(len(known) == 1, 'One side of the other triangle')
        i = known[0]
        k = given[names[1 - full][i]] / given[names[full][i]]
        # The drawing must show the same shape at that ratio.
        t1, t2 = figure_elements(public, 'triangle')
        r = [y / x for x, y in zip(side_lengths(t1), side_lengths(t2))]
        require(max(r) - min(r) < 1e-9, 'The drawn triangles are similar')
        require(abs(r[0] - float(k if full == 0 else 1 / k)) < 1e-9, 'The drawing uses the stated ratio')
        j = (['AB', 'BC', 'CA'] + ['DE', 'EF', 'FD']).index(m[2]) % 3
        return given[names[full][j]] * k
    m = re.fullmatch(r'In triangle ABC, D is on AB and E is on AC, with DE parallel to BC\. AD = (\d+) and DB = (\d+)\. (DE|BC) = (\d+)\. What is (BC|DE)\?', prompt)
    if m:
        ad, db, known = int(m[1]), int(m[2]), Fraction(int(m[4]))
        # Construct D and E on the drawn triangle and measure DE against BC.
        t = figure_elements(public, 'triangle')[0]
        A, B, C = t['points']
        s = ad / (ad + db)
        D = (A[0] + (B[0] - A[0]) * s, A[1] + (B[1] - A[1]) * s)
        E = (A[0] + (C[0] - A[0]) * s, A[1] + (C[1] - A[1]) * s)
        ratio = nearest(dist(D, E) / dist(B, C), 'DE ÷ BC')
        return known / ratio if m[3] == 'DE' else known * ratio
    m = re.fullmatch(r'At the same time of day, a person (\d+) feet tall casts a shadow (\d+) feet long, and a tree casts a shadow (\d+) feet long\. How tall is the tree, in feet\?', prompt)
    if m:
        h, s, S = (int(x) for x in m.groups())
        # The sun's elevation is fixed by the person; the tree's height follows.
        slope = Fraction(h, s)
        return slope * S
    m = re.fullmatch(r'Two similar triangles have matching sides of length (\d+) and (\d+)\. The smaller triangle has (?:an area|a perimeter) of (\d+)\. What is the (area|perimeter) of the larger triangle\?', prompt)
    require(m is not None, f'Unrecognized similarity prompt: {prompt}')
    small, big, known = int(m[1]), int(m[2]), Fraction(int(m[3]))
    k = Fraction(big, small)
    if m[4] == 'perimeter':
        return known * k
    # A triangle with base 1 and height 2·known has that area; scale both.
    base, height = Fraction(1), 2 * known
    return (base * k) * (height * k) / 2


def solve_special(prompt):
    root2, root3 = math.sqrt(2), math.sqrt(3)
    # 45°-45°-90°: half of a square of side s; 30°-60°-90°: half of an
    # equilateral triangle of side 2s.
    m = re.fullmatch(r'A 45°-45°-90° triangle has (legs of length|a hypotenuse of length) (\d+)(√2)?\. (.+)', prompt)
    if m:
        value = int(m[2]) * (root2 if m[3] else 1)
        s = value if m[1].startswith('legs') else value / root2
        diag = math.hypot(s, s)
        ask = m[4]
        if ask == 'Its hypotenuse is c√2. What is c?':
            return nearest(diag / root2, 'c')
        if ask == 'How long is each leg?':
            return nearest(s, 'leg')
        require(ask == 'Each leg is c√2. What is c?', f'Unknown ask {ask}')
        return nearest(s / root2, 'c')
    m = re.fullmatch(r'In a 30°-60°-90° triangle, the (shorter leg|longer leg|hypotenuse) has length (\d+)(√3)?\. (.+)', prompt)
    require(m is not None, f'Unrecognized special-triangle prompt: {prompt}')
    value = int(m[2]) * (root3 if m[3] else 1)
    # Equilateral triangle of side e: hypotenuse e, shorter leg e/2, altitude (longer leg) √(e² − (e/2)²).
    e = {'hypotenuse': value, 'shorter leg': 2 * value}.get(m[1])
    if e is None:
        e = value / math.sqrt(1 - 0.25)
    short, long_, hyp = e / 2, math.sqrt(e * e - (e / 2) ** 2), e
    ask = m[4]
    if ask == 'How long is the hypotenuse?':
        return nearest(hyp, 'hypotenuse')
    if ask == 'The longer leg is c√3. What is c?':
        return nearest(long_ / root3, 'c')
    require(ask == 'The shorter leg is c√3. What is c?', f'Unknown ask {ask}')
    return nearest(short / root3, 'c')


def isqrt_exact(n):
    r = math.isqrt(n)
    require(r * r == n, f'{n} is not a perfect square')
    return r


def solve_trig(prompt):
    m = re.fullmatch(r'In right triangle ABC, the right angle is at C\. (.+?)\. Find (sin|cos|tan) (A|B) as a fraction\.', prompt)
    if m:
        sides = {k: int(v) for k, v in re.findall(r'(AC|CB|AB) = (\d+)', m[1])}
        require(len(sides) >= 2, 'Two sides')
        if 'AB' not in sides:
            sides['AB'] = isqrt_exact(sides['AC'] ** 2 + sides['CB'] ** 2)
        if 'AC' not in sides:
            sides['AC'] = isqrt_exact(sides['AB'] ** 2 - sides['CB'] ** 2)
        if 'CB' not in sides:
            sides['CB'] = isqrt_exact(sides['AB'] ** 2 - sides['AC'] ** 2)
        require(sides['AC'] ** 2 + sides['CB'] ** 2 == sides['AB'] ** 2, 'A right triangle')
        # From A: CB is across, AC touches. From B: AC is across, CB touches.
        opp, adj = (sides['CB'], sides['AC']) if m[3] == 'A' else (sides['AC'], sides['CB'])
        return {'sin': Fraction(opp, sides['AB']), 'cos': Fraction(adj, sides['AB']), 'tan': Fraction(opp, adj)}[m[2]]
    m = re.fullmatch(r'In right triangle ABC, the right angle is at C and AB = (\d+)\. (sin|cos) (A|B) = (\d+)/(\d+)\. How long is the side (opposite|adjacent to) angle \3\?', prompt)
    if m:
        hyp, ratio = int(m[1]), Fraction(int(m[4]), int(m[5]))
        require((m[2] == 'sin') == (m[6] == 'opposite'), 'The ratio names the asked side')
        leg = hyp * ratio
        require(leg.denominator == 1, 'A whole side')
        isqrt_exact(hyp * hyp - int(leg) ** 2)
        return leg
    m = re.fullmatch(r'A (\d+)-foot ladder leans against a vertical wall\. Its foot is (\d+) feet from the wall, and its top is (\d+) feet above the ground\. What is (sin|cos|tan) θ, where θ is the angle between the ladder and the ground\?', prompt)
    require(m is not None, f'Unrecognized trigonometry prompt: {prompt}')
    ladder, foot, top = int(m[1]), int(m[2]), int(m[3])
    require(foot ** 2 + top ** 2 == ladder ** 2, 'The ladder fits')
    return {'sin': Fraction(top, ladder), 'cos': Fraction(foot, ladder), 'tan': Fraction(top, foot)}[m[4]]


def solve_complementary(prompt):
    rad = math.radians
    m = re.fullmatch(r'(sin|cos) (\d+)° = (sin|cos) x°, where x is between 0 and 90\. What is x\?', prompt)
    if m:
        f = math.sin if m[1] == 'sin' else math.cos
        g = math.sin if m[3] == 'sin' else math.cos
        target = f(rad(int(m[2])))
        hits = [x for x in range(1, 90) if abs(g(rad(x)) - target) < 1e-12]
        require(len(hits) == 1, 'One angle')
        return Fraction(hits[0])
    m = re.fullmatch(r'sin\((\d*)x ([+−]) (\d+)\)° = cos\((\d*)x ([+−]) (\d+)\)°, and both angles are acute\. What is x\?', prompt)
    if m:
        p, s = int(m[1] or 1), int(m[4] or 1)
        b = int(m[3]) * (1 if m[2] == '+' else -1)
        c = int(m[6]) * (1 if m[5] == '+' else -1)
        hits = [x for x in range(-200, 201)
                if 0 < p * x + b < 90 and 0 < s * x + c < 90
                and abs(math.sin(rad(p * x + b)) - math.cos(rad(s * x + c))) < 1e-12]
        require(len(hits) == 1, 'One solution')
        return Fraction(hits[0])
    m = re.fullmatch(r'In right triangle ABC, the right angle is at C, and (sin A|cos B) = (\d+)/(\d+)\. Find (cos B|sin A)\.', prompt)
    if m:
        n, d = int(m[2]), int(m[3])
        other = isqrt_exact(d * d - n * n)
        # The side n is across from A and touches B; measure both angles.
        angle_a = math.atan2(n, other)
        angle_b = math.atan2(other, n)
        require(abs(angle_a + angle_b - math.pi / 2) < 1e-12, 'Complementary angles')
        sin_a = math.sin(angle_a)
        cos_b = math.cos(angle_b)
        if m[1] == 'cos B':
            require(abs(cos_b - n / d) < 1e-12, 'The given ratio')
        return nearest(cos_b if m[4] == 'cos B' else sin_a, 'the ratio')
    m = re.fullmatch(r'For an acute angle A, sin A = (\d+)/(\d+)\. Find cos\(90° − A\)\.', prompt)
    require(m is not None, f'Unrecognized cofunction prompt: {prompt}')
    a = math.asin(int(m[1]) / int(m[2]))
    return nearest(round(math.cos(math.pi / 2 - a), 12), 'cos(90° − A)')


def solve_similarity_trig(public):
    template = public['templateId']
    require(template in SIMILARITY_TRIG, f'Unknown template {template}')
    prompt = plain(public['prompt'])
    if template == 'dilation-measure':
        return solve_dilation(prompt, public)
    if template == 'similar-triangle-side':
        return solve_similar(prompt, public)
    if template == 'special-right-triangle':
        return solve_special(prompt)
    if template == 'trig-ratio':
        return solve_trig(prompt)
    return solve_complementary(prompt)


def review_similarity_trig_fixtures():
    def pub(template, prompt, figure=None):
        p = {'templateId': template, 'prompt': prompt, 'response': {'kind': 'number', 'label': 'x'}}
        if figure:
            p['figure'] = {'kind': 'scene', 'scene': {'v': 1, 'elements': figure}}
        return p

    def rejects(p):
        try:
            solve_similarity_trig(p)
        except (ValueError, KeyError, IndexError):
            return True
        return False
    require(solve_similarity_trig(pub('dilation-measure', 'A dilation with center C(1, 2) and scale factor 3 maps P(2, 0) to P′. What is the y-coordinate of P′?')) == -4, 'Center not at origin')
    require(solve_similarity_trig(pub('special-right-triangle', 'In a 30°-60°-90° triangle, the hypotenuse has length 14. The longer leg is c√3. What is c?')) == 7, '30-60-90')
    require(solve_similarity_trig(pub('special-right-triangle', 'A 45°-45°-90° triangle has a hypotenuse of length 12. Each leg is c√2. What is c?')) == 6, '45-45-90')
    require(solve_similarity_trig(pub('trig-ratio', 'In right triangle ABC, the right angle is at C. CB = 24 and AB = 26. Find $\\sin B$ as a fraction.')) == Fraction(5, 13), 'sin B')
    require(rejects(pub('trig-ratio', 'In right triangle ABC, the right angle is at C. AC = 3, CB = 4 and AB = 6. Find $\\sin A$ as a fraction.')), 'Not a right triangle')
    require(solve_similarity_trig(pub('complementary-trig', '$\\sin(2x - 3)^\\circ = \\cos(3x - 2)^\\circ$, and both angles are acute. What is x?')) == 19, 'Cofunction equation')
    splitter = [{'type': 'triangle', 'points': [[2, 5], [0, 0], [6, 0]]}]
    require(solve_similarity_trig(pub('similar-triangle-side', 'In triangle ABC, D is on AB and E is on AC, with DE parallel to BC. AD = 4 and DB = 2. DE = 6. What is BC?', splitter)) == 9, 'Side splitter')
    pair = [{'type': 'triangle', 'points': [[0, 0], [3, 0], [1, 2]]}, {'type': 'triangle', 'points': [[5, 0], [11, 0], [7, 4]]}]
    bad = 'Triangle ABC is similar to triangle DEF, with A, B and C matching D, E and F. AB = 3, BC = 2.8284271247461903, CA = 2.23606797749979 and DE = 9. What is EF?'
    require(rejects(pub('similar-triangle-side', bad, pair)), 'Irrational sides are rejected')
    return 8


def review_similarity_trig_problem(problem, solved):
    last = plain(problem['explanation'][-1])
    v = Fraction(solved)
    base = str(v.numerator) if v.denominator == 1 else f'{v.numerator}/{v.denominator}'
    shown = {base, base.replace('-', '−')}
    require(any(re.search(rf'(?<![\d/.]){re.escape(s)}(?![\d/])', last) for s in shown), f'Explanation must conclude with the answer: {last}')
