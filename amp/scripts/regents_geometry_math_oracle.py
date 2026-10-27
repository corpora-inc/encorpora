"""Independent review of the Regents Geometry families (geo-*), derived only from public payloads.

Choice templates return the option id the oracle derives; numeric templates return a Fraction.
Figures (dilation, reflection, density table) are read from the public scene data and must agree
with the givens in the prompt and with the options.
"""
import itertools
import math
import re
from fractions import Fraction

MEASURE = frozenset({
    'geo-arc-length-rounded', 'geo-trig-leg-degrees', 'geo-sas-triangle-area', 'geo-ring-area',
    'geo-sphere-diameter', 'geo-isosceles-trig', 'geo-volume-context',
})
COORDINATE = frozenset({
    'geo-segment-partition-point', 'geo-circle-general-form', 'geo-line-point-slope-choice',
    'geo-line-pair-relationship', 'geo-dilation-line-image',
})
MOTIONS = frozenset({
    'geo-dilation-center', 'geo-dilation-line-center', 'geo-motion-chain', 'geo-reflection-side',
    'geo-rigid-statement',
})
SIMILARITY = frozenset({
    'geo-altitude-ratio', 'geo-parallel-perimeter', 'geo-parallel-statement', 'geo-equal-legs-radical',
    'geo-elevation-depression', 'geo-density-rank', 'geo-altitude-hypotenuse', 'geo-centroid-median',
})
FIGURES = frozenset({
    'geo-polygon-rotation', 'geo-isosceles-exterior-angle', 'geo-complementary-trig-choice',
    'geo-parallel-segment-length', 'geo-area-changing-transformation', 'geo-section-impossible',
    'geo-parallelogram-sufficient',
})
SUPPORTED = MEASURE | COORDINATE | MOTIONS | SIMILARITY | FIGURES
NUMERIC = frozenset({
    'geo-arc-length-rounded', 'geo-trig-leg-degrees', 'geo-sas-triangle-area', 'geo-ring-area',
    'geo-sphere-diameter', 'geo-isosceles-trig', 'geo-volume-context', 'geo-parallel-perimeter',
    'geo-elevation-depression', 'geo-isosceles-exterior-angle', 'geo-parallel-segment-length',
})
CHOICE_REVIEW = SUPPORTED - NUMERIC
REVIEW_RETURNS_ANSWER = False


def require(condition, message):
    if not condition:
        raise ValueError(message)


def clean(text):
    text = (text.replace('$', '').replace('−', '-').replace('\\ ', ' ').replace('\\left', '')
            .replace('\\right', '').replace('\\,', ''))
    text = re.sub(r'\\text\{([^{}]*)\}', r'\1', text)
    return re.sub(r'\s+', ' ', text).strip()


def num(text):
    text = clean(text).replace(' ', '')
    text = re.sub(r'\\frac(\d)(\d)', r'\\frac{\1}{\2}', text)
    m = re.fullmatch(r'(-?)\\frac\{(\d+)\}\{(\d+)\}', text)
    if m:
        return (-1 if m[1] else 1) * Fraction(int(m[2]), int(m[3]))
    require(re.fullmatch(r'-?\d+(?:\.\d+)?', text) is not None, f'Unreadable number {text!r}')
    return Fraction(text)


def options(public):
    response = public['response']
    require(response['kind'] == 'choice', 'Choice response required')
    return response['options']


def only(opts, flags, what):
    hits = [o['id'] for o, f in zip(opts, flags) if f]
    require(len(hits) == 1, f'{what}: {len(hits)} options satisfy the givens')
    return hits[0]


def rounded(value, places, clearance=1e-6):
    scale = 10 ** places
    shifted = value * scale
    require(abs(shifted - math.floor(shifted) - 0.5) > clearance, 'Value too close to a rounding tie')
    return Fraction(str(round(math.floor(shifted + 0.5) / scale, places)))


def rad(degrees):
    return math.radians(degrees)


# ------------------------------------------------------------ linear expressions
def parse_linear(text):
    """Parse a side of an equation into (coef_x, coef_y, constant) with exact Fractions."""
    s = clean(text).replace(' ', '')
    pos = 0

    def peek():
        return s[pos] if pos < len(s) else ''

    def expr():
        nonlocal pos
        total = (Fraction(0),) * 3
        sign = 1
        if peek() in ('+', '-'):
            sign = -1 if peek() == '-' else 1
            pos += 1
        total = add(total, term(), sign)
        while peek() in ('+', '-') and peek():
            sign = -1 if peek() == '-' else 1
            pos += 1
            total = add(total, term(), sign)
        return total

    def term():
        nonlocal pos
        out = factor()
        while peek() and peek() not in '+-)':
            out = mul(out, factor())
        return out

    def factor():
        nonlocal pos
        c = peek()
        if c == '(':
            pos += 1
            inner = expr()
            require(peek() == ')', 'Unbalanced parentheses')
            pos += 1
            return inner
        if s.startswith('\\frac', pos):
            m = re.match(r'\\frac\{(\d+)\}\{(\d+)\}', s[pos:])
            require(m is not None, 'Bad fraction')
            pos += len(m[0])
            return (Fraction(0), Fraction(0), Fraction(int(m[1]), int(m[2])))
        m = re.match(r'\d+(?:\.\d+)?', s[pos:])
        if m:
            pos += len(m[0])
            return (Fraction(0), Fraction(0), Fraction(m[0]))
        if c == 'x':
            pos += 1
            return (Fraction(1), Fraction(0), Fraction(0))
        if c == 'y':
            pos += 1
            return (Fraction(0), Fraction(1), Fraction(0))
        raise ValueError(f'Cannot parse {text!r} at {s[pos:]!r}')

    def add(a, b, sign=1):
        return tuple(x + sign * y for x, y in zip(a, b))

    def mul(a, b):
        a_const = a[0] == 0 and a[1] == 0
        b_const = b[0] == 0 and b[1] == 0
        require(a_const or b_const, 'Non-linear product')
        if a_const:
            return tuple(a[2] * y for y in b)
        return tuple(b[2] * y for y in a)

    out = expr()
    require(pos == len(s), f'Trailing text in {text!r}')
    return out


def parse_equation(text):
    """Return the normalized (a, b, c) of a*x + b*y + c = 0, scaled so the first nonzero is 1."""
    left, right = clean(text).split('=')
    lx, ly, lc = parse_linear(left)
    rx, ry, rc = parse_linear(right)
    a, b, c = lx - rx, ly - ry, lc - rc
    lead = a if a != 0 else b
    require(lead != 0, 'Degenerate equation')
    return (a / lead, b / lead, c / lead)


def slope_intercept(eq):
    a, b, c = eq
    require(b != 0, 'Vertical line')
    return (-a / b, -c / b)


def point(text):
    m = re.fullmatch(r'\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)', clean(text))
    require(m is not None, f'Unreadable point {text!r}')
    return (Fraction(int(m[1])), Fraction(int(m[2])))


# ------------------------------------------------------------ coordinate
def solve_partition(public):
    prompt = clean(public['prompt'])
    m = re.fullmatch(r'Segment \\overline\{AB\} has endpoints A(\(.*?\)) and B(\(.*?\))\. Point P lies on \\overline\{AB\} so that (AP:PB|BP:PA)=(\d+):(\d+)\. What are the coordinates of P\?', prompt)
    require(m is not None, 'Unrecognized partition prompt')
    a, b = point(m[1]), point(m[2])
    first, second = int(m[4]), int(m[5])
    t = Fraction(first, first + second)
    start, end = (a, b) if m[3] == 'AP:PB' else (b, a)
    p = (start[0] + t * (end[0] - start[0]), start[1] + t * (end[1] - start[1]))
    opts = options(public)
    return only(opts, [point(o['label']) == p for o in opts], 'partition')


def solve_circle(public):
    prompt = clean(public['prompt'])
    m = re.fullmatch(r'A circle has the equation (.*?) = 0\. What are its center and radius\?', prompt)
    require(m is not None, 'Unrecognized circle prompt')
    # Read the general form with the exact linear parser, extracting coefficients of x^2, y^2, x, y.
    body = m[1].replace(' ', '')
    terms = re.findall(r'([+-]?)(\d*)(x\^2|y\^2|x|y)?', body)
    coef = {'x^2': Fraction(0), 'y^2': Fraction(0), 'x': Fraction(0), 'y': Fraction(0), '': Fraction(0)}
    rebuilt = ''
    for sign, digits, var in terms:
        if not (digits or var):
            continue
        rebuilt += sign + digits + (var or '')
        value = Fraction(int(digits) if digits else 1)
        coef[var or ''] += -value if sign == '-' else value
    require(rebuilt == body, 'Circle equation not fully read')
    a = coef['x^2']
    require(a != 0 and a == coef['y^2'], 'Circle needs equal x^2 and y^2 coefficients')
    cx, cy = -coef['x'] / (2 * a), -coef['y'] / (2 * a)
    r2 = cx * cx + cy * cy - coef[''] / a
    require(r2 > 0, 'Not a circle')
    opts = options(public)
    flags = []
    for o in opts:
        t = re.fullmatch(r'center (\(.*?\)), radius (\\sqrt\{\d+\}|\d+)', clean(o['label']))
        require(t is not None, f'Unreadable circle option {o["label"]!r}')
        r_sq = Fraction(t[2]) ** 2 if t[2].isdigit() else Fraction(int(re.search(r'\d+', t[2])[0]))
        flags.append(point(t[1]) == (cx, cy) and r_sq == r2)
    require(len({(point(re.fullmatch(r'center (\(.*?\)), radius .*', clean(o['label']))[1]), o['label'].split('radius')[1]) for o in opts}) == 4, 'Duplicate circle options')
    return only(opts, flags, 'circle')


def solve_point_slope(public):
    prompt = clean(public['prompt'])
    m = re.fullmatch(r'A line passes through (\(.*?\)) and (\(.*?\))\. Which equation represents the line through (\(.*?\)) that is (parallel|perpendicular) to it\?', prompt)
    require(m is not None, 'Unrecognized point-slope prompt')
    p, q, through = point(m[1]), point(m[2]), point(m[3])
    require(q[0] != p[0], 'Vertical given line')
    slope = (q[1] - p[1]) / (q[0] - p[0])
    if m[4] == 'perpendicular':
        require(slope != 0, 'Perpendicular to horizontal line is vertical')
        slope = -1 / slope
    want = (slope, through[1] - slope * through[0])
    opts = options(public)
    values = [slope_intercept(parse_equation(o['label'])) for o in opts]
    require(len(set(values)) == len(values), 'Choices describe the same line twice')
    return only(opts, [v == want for v in values], 'point-slope')


def solve_line_pair(public):
    prompt = clean(public['prompt'])
    m = re.fullmatch(r'Line \\ell has the equation (.*?) and line m has the equation (.*?)\. Which statement describes lines \\ell and m\?', prompt)
    require(m is not None, 'Unrecognized line-pair prompt')
    l1, l2 = parse_equation(m[1]), parse_equation(m[2])
    require(l1[1] != 0 and l2[1] != 0, 'Vertical line')
    (s1, i1), (s2, i2) = slope_intercept(l1), slope_intercept(l2)
    if s1 == s2:
        relation = 'the same line' if i1 == i2 else 'parallel'
    elif s1 * s2 == -1:
        relation = 'perpendicular'
    else:
        relation = 'neither parallel nor perpendicular'
    opts = options(public)
    require(len({clean(o['label']) for o in opts}) == 4, 'Duplicate relationships')
    return only(opts, [clean(o['label']) == relation for o in opts], 'line pair')


def dilate_line(equation, scale, center):
    slope, intercept = slope_intercept(parse_equation(equation))
    cx, cy = center
    # Image of (0, b) is (cx + k(0-cx), cy + k(b-cy)); the image has the same slope.
    x1, y1 = cx - scale * cx, cy + scale * (intercept - cy)
    return (slope, y1 - slope * x1)


def solve_dilation_line(public):
    prompt = clean(public['prompt'])
    m = re.fullmatch(r'Line \\ell has the equation (.*?)\. It is dilated by a scale factor of (.*?) centered at the origin\. Which equation represents the image of \\ell\?', prompt)
    if m:
        want, label = dilate_line(m[1], num(m[2]), (Fraction(0), Fraction(0))), 'line image'
    else:
        m = re.fullmatch(r'The line (.*?) is dilated by a scale factor of (.*?) centered at the point (\(.*?\))\. Which equation is the image of the line\?', prompt)
        require(m is not None, 'Unrecognized dilated-line prompt')
        want, label = dilate_line(m[1], num(m[2]), point(m[3])), 'line image'
    opts = options(public)
    values = [slope_intercept(parse_equation(o['label'])) for o in opts]
    require(len(set(values)) == len(values), 'Choices describe the same line twice')
    return only(opts, [v == want for v in values], label)


# ------------------------------------------------------------ measure
def solve_arc(public):
    prompt = clean(public['prompt'])
    m = re.fullmatch(r'A circle has a (radius|diameter) of (\d+) (\w+)\. A central angle of (\d+)\^\\circ intercepts an arc\. Find the arc length to the nearest (tenth of a unit|whole unit)\.', prompt)
    require(m is not None, 'Unrecognized arc prompt')
    r = int(m[2]) / (2 if m[1] == 'diameter' else 1)
    value = int(m[4]) / 360 * 2 * math.pi * r
    return rounded(value, 1 if m[5].startswith('tenth') else 0)


def solve_trig_leg(public):
    prompt = clean(public['prompt'])
    m = re.fullmatch(r'In right triangle (\w)(\w)(\w) the right angle is at (\w), (\w)(\w)=(\d+) and m\\angle (\w)=(\d+)\^\\circ\. Find (\w)(\w) to the nearest tenth\. Use a calculator in degree mode\.', prompt)
    require(m is not None, 'Unrecognized trig-leg prompt')
    a, b, c, right = m[1], m[2], m[3], m[4]
    require(right == c and (m[5], m[6]) == (a, b) and m[8] == a, 'Triangle naming disagrees with givens')
    hyp, angle = int(m[7]), int(m[9])
    side = {m[10], m[11]}
    require(side in ({a, c}, {b, c}), 'Target must be a leg')
    value = hyp * (math.cos(rad(angle)) if side == {a, c} else math.sin(rad(angle)))
    return rounded(value, 1)


def solve_sas(public):
    prompt = clean(public['prompt'])
    m = re.fullmatch(r'Two sides of a triangle measure ([\d.]+) cm and ([\d.]+) cm, and the angle between them measures (\d+)\^\\circ\. Find the area of the triangle to the nearest tenth of a square centimeter\. Use a calculator in degree mode\.', prompt)
    require(m is not None, 'Unrecognized SAS prompt')
    return rounded(0.5 * float(m[1]) * float(m[2]) * math.sin(rad(int(m[3]))), 1)


def solve_ring(public):
    prompt = clean(public['prompt'])
    m = re.fullmatch(r'A circular pool has a (radius|diameter) of (\d+) (\w+)\. A walkway (\d+) \3 wide surrounds it\. Find the area of the walkway to the nearest square (\w+)\.', prompt)
    require(m is not None, 'Unrecognized ring prompt')
    singular = {'feet': 'foot', 'meters': 'meter', 'inches': 'inch', 'centimeters': 'centimeter', 'yards': 'yard'}
    require(singular.get(m[3], m[3]) == m[5], 'Walkway unit and area unit disagree')
    r = int(m[2]) / (2 if m[1] == 'diameter' else 1)
    w = int(m[4])
    return rounded(math.pi * ((r + w) ** 2 - r ** 2), 0)


def solve_sphere(public):
    prompt = clean(public['prompt'])
    m = re.fullmatch(r'A sphere has a volume of (\d+) (\w+)\^3\. Find its (diameter|radius) to the nearest tenth of an? (\w+)\.', prompt)
    require(m is not None, 'Unrecognized sphere prompt')
    units = {'in': 'inch', 'm': 'meter', 'cm': 'centimeter'}
    require(units[m[2]] == m[4], 'Volume unit and length unit disagree')
    r = (3 * int(m[1]) / (4 * math.pi)) ** (1 / 3)
    return rounded(2 * r if m[3] == 'diameter' else r, 1)


def solve_isosceles_trig(public):
    prompt = clean(public['prompt'])
    m = re.fullmatch(r'An isosceles triangle has an apex angle of (\d+)\^\\circ\. The altitude from the apex to the base is (\d+) cm long\. Find the perimeter of the triangle to the nearest tenth of a centimeter\. Use a calculator in degree mode\.', prompt)
    if m:
        half, h = rad(int(m[1]) / 2), int(m[2])
        return rounded(2 * h / math.cos(half) + 2 * h * math.tan(half), 1)
    m = re.fullmatch(r'The end of a roof is an isosceles triangle\. Its base is (\d+) feet wide and its peak is (\d+) feet above the base\. Find the measure of a base angle to the nearest degree\. Use a calculator in degree mode\.', prompt)
    require(m is not None, 'Unrecognized isosceles trig prompt')
    return rounded(math.degrees(math.atan2(int(m[2]), int(m[1]) / 2)), 0)


def solve_volume_context(public):
    prompt = clean(public['prompt'])
    m = re.fullmatch(r'A solid trophy is a square prism with a square pyramid on top\. The base of the prism is (\d+) cm by \1 cm and the prism is (\d+) cm tall\. The pyramid has the same base and is (\d+) cm tall\. The trophy is made of metal with a density of ([\d.]+) grams per cubic centimeter\. Find the mass of the trophy to the nearest gram\.', prompt)
    if m:
        s, hp, hy = int(m[1]), int(m[2]), int(m[3])
        volume = Fraction(s * s * hp) + Fraction(s * s * hy, 3)
        return rounded(float(volume * Fraction(m[4])), 0)
    m = re.fullmatch(r'A cylindrical bucket has an inside diameter of ([\d.]+) feet and a height of ([\d.]+) feet\. It is filled to the top with soil that weighs (\d+) pounds per cubic foot\. Find the weight of the soil to the nearest pound\.', prompt)
    if m:
        r = float(m[1]) / 2
        return rounded(math.pi * r * r * float(m[2]) * int(m[3]), 0)
    m = re.fullmatch(r'A pile of sand is a cone with a radius of (\d+) feet and a height of (\d+) feet\. A wagon carries (\d+) cubic feet of sand per trip\. What is the fewest number of trips needed to carry all of the sand\?', prompt)
    require(m is not None, 'Unrecognized volume context prompt')
    volume = math.pi * int(m[1]) ** 2 * int(m[2]) / 3
    trips = volume / int(m[3])
    require(abs(trips - round(trips)) > 1e-6, 'Trips sit on an integer boundary')
    return Fraction(math.ceil(trips))


# ------------------------------------------------------------ figures
def graph_points(public):
    figure = public.get('figure')
    require(figure is not None and figure['kind'] == 'scene', 'Scene figure required')
    graphs = [e for e in figure['scene']['elements'] if e['type'] == 'graph']
    require(len(graphs) == 1, 'One graph required')
    return {p['label']: (Fraction(p['x']), Fraction(p['y'])) for p in graphs[0]['points']}, graphs[0]


def solve_dilation_center(public):
    pts, graph = graph_points(public)
    prompt = clean(public['prompt'])
    for letter in 'ABC':
        require(letter in pts and letter + "'" in pts, 'Figure must label the preimage and image')
    # Image triangle edges drawn in the figure must connect the labeled image vertices.
    drawn = {frozenset((tuple(map(Fraction, s['from'])), tuple(map(Fraction, s['to'])))) for s in graph['segments']}
    for u, v in (('A', 'B'), ('B', 'C'), ('C', 'A')):
        require(frozenset((pts[u], pts[v])) in drawn and frozenset((pts[u + "'"], pts[v + "'"])) in drawn, 'Figure edges disagree with labels')
    given = re.search(r'scale factor of (.+?)\?', prompt)
    opts = options(public)
    flags = []
    for o in opts:
        t = re.fullmatch(r'(?:Scale factor (.+?) and c|C)enter (\(.*?\))', clean(o['label']))
        require(t is not None, f'Unreadable dilation option {o["label"]!r}')
        k = num(t[1]) if t[1] else num(given[1])
        require(t[1] or given is not None, 'Scale factor must be given somewhere')
        center = point(t[2])
        ok = all(pts[n + "'"] == (center[0] + k * (pts[n][0] - center[0]), center[1] + k * (pts[n][1] - center[1])) for n in 'ABC')
        flags.append(ok)
    return only(opts, flags, 'dilation center')


def orientation(p, q, r):
    return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])


def isometry_kinds(src, dst):
    """Kinds of single rigid motion mapping the labelled triangle src onto dst, vertex by vertex."""
    s = [complex(float(x), float(y)) for x, y in src]
    d = [complex(float(x), float(y)) for x, y in dst]
    kinds = set()
    du, su = d[1] - d[0], s[1] - s[0]
    for reflecting in (False, True):
        w = du / (su.conjugate() if reflecting else su)
        if abs(abs(w) - 1) > 1e-9:
            continue
        t = d[0] - w * (s[0].conjugate() if reflecting else s[0])
        if not all(abs(w * (a.conjugate() if reflecting else a) + t - b) < 1e-9 for a, b in zip(s, d)):
            continue
        if reflecting:
            if abs(w * t.conjugate() + t) < 1e-9:
                kinds.add('reflection')
        elif abs(w - 1) < 1e-9:
            if abs(t) > 1e-9:
                kinds.add('translation')
        else:
            kinds.add('rotation')
    return kinds


def solve_motion_chain(public):
    prompt = clean(public['prompt'])
    tris = re.findall(r'Triangle (\w\w\w) has vertices (\w)(\(.*?\)), (\w)(\(.*?\)), (\w)(\(.*?\))\.', prompt)
    require(len(tris) == 3, 'Three triangles required')
    shapes = [[point(t[2]), point(t[4]), point(t[6])] for t in tris]
    first = isometry_kinds(shapes[0], shapes[1])
    second = isometry_kinds(shapes[1], shapes[2])
    require(first and second, 'Not a pair of single rigid motions')
    opts = options(public)
    flags = []
    parsed = []
    for o in opts:
        t = re.fullmatch(r'An? (\w+) followed by an? (\w+)', clean(o['label']))
        require(t is not None, f'Unreadable motion option {o["label"]!r}')
        parsed.append((t[1], t[2]))
        flags.append(t[1] in first and t[2] in second)
    require(len(set(parsed)) == len(parsed), 'Duplicate motion choices')
    return only(opts, flags, 'motion chain')


def solve_reflection_side(public):
    pts, graph = graph_points(public)
    prompt = clean(public['prompt'])
    axis = r'(?:the (x|y)-axis|the line (y=x|y=-x))'
    m = re.fullmatch(r'Quadrilateral ABCD is reflected over ' + axis + r' and the result is then reflected over ' + axis + r'\. The final image has vertices E, F, G and H as shown\. Which segment is the image of \\overline\{(\w\w)\}\?', prompt)
    require(m is not None, 'Unrecognized reflection prompt')
    mirrors = [m[1] or m[2], m[3] or m[4]]

    def reflect(p, mirror):
        x, y = p
        return {'x': (x, -y), 'y': (-x, y), 'y=x': (y, x), 'y=-x': (-y, -x)}[mirror]

    def move(p):
        for mirror in mirrors:
            p = reflect(p, mirror)
        return p

    images = {}
    for n in 'ABCD':
        hits = [l for l in 'EFGH' if pts[l] == move(pts[n])]
        require(len(hits) == 1, f'Figure has no unique image vertex for {n}')
        images[n] = hits[0]
    require(len(set(images.values())) == 4, 'Image vertices repeat')
    want = frozenset(images[c] for c in m[5])
    opts = options(public)
    flags = []
    for o in opts:
        t = re.fullmatch(r'\\overline\{(\w\w)\}', clean(o['label']))
        require(t is not None, f'Unreadable segment option {o["label"]!r}')
        flags.append(frozenset(t[1]) == want)
    require(len({frozenset(clean(o['label'])[-3:-1]) for o in opts}) == 4, 'Duplicate segments')
    return only(opts, flags, 'reflection side')


def solve_rigid_statement(public):
    prompt = clean(public['prompt'])
    m = re.fullmatch(r"Triangle ABC is mapped to triangle A'B'C' by (\d+) rigid motions: (.*?)\. Which statement must be true\?", prompt)
    require(m is not None, 'Unrecognized rigid-motion prompt')
    motions = re.findall(r'(?:a |then a )(rotation|reflection|translation)', m[2])
    require(len(motions) == int(m[1]), 'Motion count disagrees with list')
    reflections = motions.count('reflection')
    opts = options(public)
    flags = []
    for o in opts:
        t = clean(o['label'])
        if 'larger' in t:
            flags.append(False)
        elif 'parallel' in t:
            flags.append(all(k == 'translation' for k in motions))
        elif 'same order' in t:
            flags.append(reflections % 2 == 0)
        elif 'opposite order' in t:
            flags.append(reflections % 2 == 1)
        elif any(w in t for w in ('area', 'congruent to', 'same measure', 'same length')):
            flags.append(True)
        else:
            raise ValueError(f'Unreadable rigid-motion statement {t!r}')
    return only(opts, flags, 'rigid statement')


# ------------------------------------------------------------ similarity
def length(text):
    return text


def solve_altitude_ratio(public):
    prompt = clean(public['prompt'])
    m = re.fullmatch(r'In right triangle ABC, the right angle is at C, AC=(\d+) and BC=(\d+)\. Altitude \\overline\{CD\} is drawn to hypotenuse \\overline\{AB\}\. Which equation is true\?', prompt)
    require(m is not None, 'Unrecognized altitude prompt')
    ac, bc = int(m[1]), int(m[2])
    ab = math.hypot(ac, bc)
    seg = {'AC': ac, 'BC': bc, 'AB': ab, 'AD': ac * ac / ab, 'BD': bc * bc / ab, 'CD': ac * bc / ab}
    opts = options(public)
    flags = []
    cos_angles = set()
    for o in opts:
        t = re.fullmatch(r'\\(cos|sin|tan) (A|B) = \\frac\{(\w\w)\}\{(\w\w)\}', clean(o['label']))
        require(t is not None, f'Unreadable cosine option {o["label"]!r}')
        cos_angles.add((t[1], t[2]))
        adjacent, opposite = (ac, bc) if t[2] == 'A' else (bc, ac)
        true_ratio = {'cos': adjacent / ab, 'sin': opposite / ab, 'tan': opposite / adjacent}[t[1]]
        flags.append(abs(seg[t[3]] / seg[t[4]] - true_ratio) < 1e-9)
    require(len(cos_angles) == 1, 'Options must name one angle')
    return only(opts, flags, 'altitude ratio')


def solve_parallel_perimeter(public):
    prompt = clean(public['prompt'])
    m = re.fullmatch(r'In triangle ABC, point D is on \\overline\{AB\} and point E is on \\overline\{AC\}, with \\overline\{DE\}\\parallel\\overline\{BC\}\. (.*?)\. What is the perimeter of triangle ABC in centimeters\?', prompt)
    require(m is not None, 'Unrecognized parallel-perimeter prompt')
    given = {k: Fraction(v) for k, v in re.findall(r'(\w\w)=(\d+) cm', m[1])}
    ad, de, ae = given['AD'], given['DE'], given['AE']
    ab = given['AB'] if 'AB' in given else ad + given['DB']
    return ab / ad * (ad + de + ae)


def solve_parallel_statement(public):
    prompt = clean(public['prompt'])
    opts = options(public)
    # Numeric model: build concrete figures satisfying the givens and test every statement.
    m = re.fullmatch(r'In triangle (\w)(\w)(\w), point (\w) is on \\overline\{(\w)(\w)\} and point (\w) is on \\overline\{(\w)(\w)\}, with \\overline\{(\w)(\w)\}\\parallel\\overline\{(\w)(\w)\}\. Which statement is not always true\?', prompt)
    n = re.fullmatch(r'Segments \\overline\{(\w)(\w)\} and \\overline\{(\w)(\w)\} intersect at (\w), and \\overline\{(\w)(\w)\}\\parallel\\overline\{(\w)(\w)\}\. Which statement is not always true\?', prompt)
    models = []
    if m:
        apex, y, x, z, _, _, v = m[1], m[2], m[3], m[4], None, None, m[7]
        require(m[5] == apex and m[6] == y and m[8] == apex and m[9] == x, 'Triangle givens disagree')
        require((m[10], m[11]) == (z, v) and (m[12], m[13]) == (y, x), 'Parallel givens disagree')
        for apex_pt, y_pt, x_pt, s in (((0.3, 0.2), (4.1, 0.7), (1.9, 3.6), 0.35), ((-1.0, 0.5), (3.0, -0.7), (0.4, 4.4), 0.62), ((2.0, 2.0), (-2.5, 3.3), (5.1, 6.0), 0.8)):
            z_pt = tuple(a + s * (b - a) for a, b in zip(apex_pt, y_pt))
            v_pt = tuple(a + s * (b - a) for a, b in zip(apex_pt, x_pt))
            models.append({apex: apex_pt, y: y_pt, x: x_pt, z: z_pt, v: v_pt})
    else:
        require(n is not None, 'Unrecognized parallel statement prompt')
        f, p, nn, l, e = n[1], n[2], n[3], n[4], n[5]
        require((n[6], n[7]) == (f, nn) and (n[8], n[9]) == (p, l), 'Parallel givens disagree')
        for e_pt, u, w, r in (((0.2, -0.3), (2.0, 1.1), (-1.5, 2.2), 0.7), ((1.0, 1.0), (-3.0, 0.4), (0.6, 2.9), 1.9), ((0.0, 0.0), (1.4, 3.1), (4.2, -1.0), 0.45)):
            models.append({e: e_pt, f: u, p: tuple(e_pt[i] - r * (u[i] - e_pt[i]) for i in range(2)), nn: w,
                           l: tuple(e_pt[i] - r * (w[i] - e_pt[i]) for i in range(2))})

    def dist(model, a, b):
        return math.dist(model[a], model[b])

    def angle(model, a, b, c):
        u = (model[a][0] - model[b][0], model[a][1] - model[b][1])
        v = (model[c][0] - model[b][0], model[c][1] - model[b][1])
        return math.acos((u[0] * v[0] + u[1] * v[1]) / (math.hypot(*u) * math.hypot(*v)))

    def holds(label, model):
        t = clean(label).replace(' ', '')
        a = re.fullmatch(r'\\angle(\w\w\w)\\cong\\angle(\w\w\w)', t)
        if a:
            return abs(angle(model, *a[1]) - angle(model, *a[2])) < 1e-9
        tri = re.fullmatch(r'\\triangle(\w\w\w)(\\cong|\\sim)\\triangle(\w\w\w)', t)
        if tri:
            s1 = [dist(model, tri[1][i], tri[1][(i + 1) % 3]) for i in range(3)]
            s2 = [dist(model, tri[3][i], tri[3][(i + 1) % 3]) for i in range(3)]
            if tri[2] == '\\cong':
                return all(abs(x - y) < 1e-9 for x, y in zip(s1, s2))
            ratios = [x / y for x, y in zip(s1, s2)]
            return max(ratios) - min(ratios) < 1e-9
        fr = re.fullmatch(r'\\frac\{(\w\w)\}\{(\w\w)\}=\\frac\{(\w\w)\}\{(\w\w)\}', t)
        if fr:
            return abs(dist(model, *fr[1]) / dist(model, *fr[2]) - dist(model, *fr[3]) / dist(model, *fr[4])) < 1e-9
        eq = re.fullmatch(r'(\w\w)=(\w\w)', t)
        if eq:
            return abs(dist(model, *eq[1]) - dist(model, *eq[2])) < 1e-9
        raise ValueError(f'Unreadable statement {t!r}')

    always = [all(holds(o['label'], model) for model in models) for o in opts]
    return only(opts, [not a for a in always], 'not-always-true statement')


def sqrt_square(label):
    """Exact square of a displayed value a, sqrt(b) or a*sqrt(b)."""
    t = clean(label).replace(' ', '')
    m = re.fullmatch(r'(\d*)\\sqrt\{(\d+)\}', t)
    if m:
        a = int(m[1]) if m[1] else 1
        return Fraction(a * a * int(m[2]))
    require(re.fullmatch(r'\d+', t) is not None, f'Unreadable radical {label!r}')
    return Fraction(int(t) ** 2)


def solve_equal_legs(public):
    prompt = clean(public['prompt'])
    m = re.fullmatch(r'In right triangle ABC, AC=BC=(\d+) and the right angle is at C\. Triangle DEF is similar to triangle ABC, with the right angle at F and (DE|DF)=(\d+)\. What is the length of \\overline\{(DF|DE)\}\?', prompt)
    require(m is not None and m[2] != m[4], 'Unrecognized equal-legs prompt')
    given = int(m[3])
    # The right angle is at F: DE is the hypotenuse, DF a leg; hypotenuse^2 = 2 leg^2.
    want = Fraction(given * given, 2) if m[2] == 'DE' else Fraction(2 * given * given)
    opts = options(public)
    squares = [sqrt_square(o['label']) for o in opts]
    require(len(set(squares)) == 4, 'Choices equal in value')
    return only(opts, [s == want for s in squares], 'equal legs')


def solve_elevation(public):
    prompt = clean(public['prompt'])
    m = re.fullmatch(r'A lookout is (\d+) feet from a (\w+), measured along level ground\. From the lookout, the angle of elevation to the top of the \2 is (\d+)\^\\circ and the angle of depression to its base is (\d+)\^\\circ\. What is the height of the \2, to the nearest (foot|tenth of a foot)\?', prompt)
    require(m is not None, 'Unrecognized elevation prompt')
    d = int(m[1])
    return rounded(d * (math.tan(rad(int(m[3]))) + math.tan(rad(int(m[4])))), 0 if m[5] == 'foot' else 1)


def solve_density(public):
    prompt = clean(public['prompt'])
    m = re.fullmatch(r'The table shows the population and the land area of four counties\. Population density is the number of people per square mile\. Which list ranks the counties from (least to greatest|greatest to least) population density\?', prompt)
    require(m is not None, 'Unrecognized density prompt')
    table = [e for e in public['figure']['scene']['elements'] if e['type'] == 'table']
    require(len(table) == 1 and table[0]['columns'] == ['Population', 'Area (sq mi)'], 'Density table required')
    density = {}
    for row in table[0]['rows']:
        pop, area = (int(c.replace(',', '')) for c in row['cells'])
        density[row['label']] = Fraction(pop, area)
    require(len(set(density.values())) == len(density), 'Tied densities')
    order = sorted(density, key=density.get, reverse=m[1].startswith('greatest'))
    opts = options(public)
    lists = [[c.strip() for c in clean(o['label']).split(',')] for o in opts]
    require(len({tuple(l) for l in lists}) == 4 and all(sorted(l) == sorted(density) for l in lists), 'Counties must be a permutation')
    return only(opts, [l == order for l in lists], 'density rank')


def solve_altitude_hypotenuse(public):
    prompt = clean(public['prompt'])
    m = re.fullmatch(r'In right triangle ABC the right angle is at C\. The altitude from C meets hypotenuse \\overline\{AB\} at D, with AD=(\d+) and DB=(\d+)\. What is the length of \\overline\{(AC|BC|CD)\}\?', prompt)
    require(m is not None, 'Unrecognized altitude-hypotenuse prompt')
    p, q = int(m[1]), int(m[2])
    square = {'AC': p * (p + q), 'BC': q * (p + q), 'CD': p * q}[m[3]]
    opts = options(public)
    squares = [sqrt_square(o['label']) for o in opts]
    require(len(set(squares)) == 4, 'Choices equal in value')
    return only(opts, [s == square for s in squares], 'altitude hypotenuse')


def solve_centroid(public):
    prompt = clean(public['prompt'])
    m = re.fullmatch(r'In \\triangle ABC, G is the centroid and \\overline\{(\w)(\w)\} is the median to \\overline\{(\w\w)\}, so G lies on \\overline\{\1\2\}\. (.*)', prompt)
    require(m is not None, 'Unrecognized centroid prompt')
    vertex, foot = m[1], m[2]
    whole = Fraction(1)
    seg = {vertex + foot: whole, vertex + 'G': Fraction(2, 3), 'G' + foot: Fraction(1, 3)}
    opts = options(public)
    if m[4] == 'Which statement is always true?':
        flags = []
        for o in opts:
            t = re.fullmatch(r'(\w\w)=(?:(\d+|\\frac\{\d+\}\{\d+\}|\\frac\d+)\((\w\w)\)|(\w\w))', clean(o['label']).replace('\\frac12', '\\frac{1}{2}').replace(' ', ''))
            require(t is not None, f'Unreadable centroid statement {o["label"]!r}')
            coefficient = num(t[2]) if t[2] else Fraction(1)
            right = t[3] or t[4]
            flags.append(seg[t[1]] == coefficient * seg[right])
        return only(opts, flags, 'centroid statement')
    t = re.fullmatch(r'The median \\overline\{(\w\w)\} has length (\d+)\. What is the length of \\overline\{(\w\w)\}\?', m[4])
    require(t is not None and t[1] == vertex + foot, 'Unrecognized centroid question')
    want = seg[t[3]] * int(t[2])
    values = [num(o['label']) for o in opts]
    require(len(set(values)) == 4, 'Duplicate lengths')
    return only(opts, [v == want for v in values], 'centroid length')


# ------------------------------------------------------------ figures families
POLYGONS = {
    'Equilateral triangle': 3, 'Square': 4, 'Regular pentagon': 5, 'Regular hexagon': 6,
    'Regular octagon': 8, 'Regular nonagon': 9, 'Regular decagon': 10, 'Regular dodecagon': 12,
}


def solve_polygon_rotation(public):
    prompt = clean(public['prompt'])
    m = re.fullmatch(r'Which polygon maps onto itself when it is rotated (.*?) about its center\?(?: It must map onto itself under each of the rotations\.)?', prompt)
    require(m is not None, 'Unrecognized polygon-rotation prompt')
    angles = [int(a) for a in re.findall(r'(\d+)\^\\circ', m[1])]
    require(angles and all(0 < a < 360 for a in angles), 'Rotation angles required')
    if len(angles) > 1:
        require('must map onto itself under each' in prompt, 'Several angles need the each-rotation statement')
    opts = options(public)
    names = [clean(o['label']) for o in opts]
    require(all(n in POLYGONS for n in names), 'Unknown polygon name')
    return only(opts, [all((a * POLYGONS[n]) % 360 == 0 for a in angles) for n in names], 'polygon rotation')


POSSIBLE_SECTIONS = {
    'rectangular prism': {'a triangle', 'a parallelogram', 'a rectangle', 'a hexagon', 'a pentagon', 'a trapezoid', 'a square', 'a rhombus'},
    'cone': {'a circle', 'an ellipse', 'a triangle'},
    'cylinder': {'a circle', 'an ellipse', 'a rectangle', 'a square'},
}
IMPOSSIBLE_SECTIONS = {
    'rectangular prism': {'a heptagon', 'an octagon', 'a circle', 'an ellipse'},
    'cone': {'a pentagon', 'a rectangle', 'a square', 'a hexagon', 'a trapezoid', 'a parallelogram'},
    'cylinder': {'a hexagon', 'a triangle', 'a pentagon', 'a trapezoid'},
}


def solve_section(public):
    prompt = clean(public['prompt'])
    m = re.fullmatch(r'A plane cuts through an? (rectangular prism|cone|cylinder)\. Which shape cannot be the cross section\?', prompt)
    require(m is not None, 'Unrecognized cross-section prompt')
    opts = options(public)
    labels = [clean(o['label']) for o in opts]
    for label in labels:
        require(label in POSSIBLE_SECTIONS[m[1]] | IMPOSSIBLE_SECTIONS[m[1]], f'No ruling for {label!r} in a {m[1]}')
    return only(opts, [l in IMPOSSIBLE_SECTIONS[m[1]] for l in labels], 'impossible cross section')


SUFFICIENT = {
    'rectangle': {'Its diagonals are congruent.', 'It has a right angle.'},
    'rhombus': {'Its diagonals are perpendicular.', 'Two consecutive sides are congruent.', 'A diagonal bisects an angle of the parallelogram.'},
}
NOT_SUFFICIENT = {
    'rectangle': {'Its diagonals are perpendicular.', 'Its opposite sides are congruent.', 'Two consecutive sides are congruent.',
                  'Its diagonals bisect each other.', 'Its consecutive angles are supplementary.', 'Its opposite angles are congruent.',
                  'A diagonal bisects an angle of the parallelogram.'},
    'rhombus': {'Its diagonals bisect each other.', 'It has a right angle.', 'Its consecutive angles are supplementary.',
                'Its opposite sides are congruent.', 'Its diagonals are congruent.', 'Its opposite angles are congruent.'},
}


def solve_parallelogram(public):
    prompt = clean(public['prompt'])
    m = re.fullmatch(r'Parallelogram ABCD is given\. Which added condition is enough to prove that ABCD is an? (rectangle|rhombus)\?', prompt)
    require(m is not None, 'Unrecognized parallelogram prompt')
    opts = options(public)
    labels = [clean(o['label']) for o in opts]
    for label in labels:
        require(label in SUFFICIENT[m[1]] | NOT_SUFFICIENT[m[1]], f'No ruling for {label!r} as a {m[1]} test')
    return only(opts, [l in SUFFICIENT[m[1]] for l in labels], 'sufficient condition')


def solve_isosceles_exterior(public):
    prompt = clean(public['prompt'])
    m = re.fullmatch(r'In isosceles triangle ABC, AB=AC\. The base angles are m\\angle B=\((.*?)\)\^\\circ and m\\angle C=\((.*?)\)\^\\circ\. Find the measure, in degrees, of the exterior angle at (A|B), formed by extending \\overline\{(BA|AB)\} beyond \3\.', prompt)
    require(m is not None, 'Unrecognized exterior-angle prompt')
    require((m[3], m[4]) in (('A', 'BA'), ('B', 'AB')), 'Extension disagrees with vertex')
    ax, ac = parse_linear(m[1])[0], parse_linear(m[1])[2]
    bx, bc = parse_linear(m[2])[0], parse_linear(m[2])[2]
    require(ax != bx, 'Base angles cannot be equal for every x')
    x = (bc - ac) / (ax - bx)
    base = ax * x + ac
    require(base > 0 and 2 * base < 180 and x == int(x), 'Base angles must give a valid triangle at an integer x')
    apex = 180 - 2 * base
    return Fraction(180 - apex) if m[3] == 'A' else Fraction(180 - base)


def solve_complementary(public):
    prompt = clean(public['prompt'])
    m = re.fullmatch(r'Angles A and B are acute, with m\\angle A=\((.*?)\)\^\\circ and m\\angle B=\((.*?)\)\^\\circ, and \\sin A=\\cos B\. (Which equation can be used to solve for x|What is the measure of the smallest angle of triangle ABC)\?', prompt)
    require(m is not None, 'Unrecognized complementary prompt')
    a, b = parse_linear(m[1]), parse_linear(m[2])
    total_x, total_c = a[0] + b[0], a[2] + b[2]
    require(total_x != 0, 'Degenerate equation')
    x = (90 - total_c) / total_x
    angle_a, angle_b = a[0] * x + a[2], b[0] * x + b[2]
    require(0 < angle_a < 90 and 0 < angle_b < 90, 'Angles must be acute')
    if m[3].startswith('What'):
        # sin A = cos B makes A + B = 90, so the third angle is 90 and the smallest is min(A, B).
        smallest = min(angle_a, angle_b)
        if public['response']['kind'] == 'choice':
            opts = options(public)
            values = [num(o['label'].replace('^\\circ', '').replace('°', '')) for o in opts]
            require(len(set(values)) == 4, 'Duplicate angle choices')
            return only(opts, [v == smallest for v in values], 'smallest angle')
        return Fraction(smallest)
    opts = options(public)
    roots = []
    for o in opts:
        left, right = clean(o['label']).split('=')
        lx, _, lc = parse_linear(left)
        rx, _, rc = parse_linear(right)
        roots.append(None if lx == rx else (rc - lc) / (lx - rx))
    require(len([r for r in roots if r == x]) == 1, 'Exactly one equation must have the correct root')
    return only(opts, [r == x for r in roots], 'complementary equation')


def solve_parallel_length(public):
    prompt = clean(public['prompt'])
    m = re.fullmatch(r'In triangle ABC, point D is on \\overline\{AB\} and point E is on \\overline\{AC\}, with AD=(\d+), DB=(\d+) and AE=(\d+)\. \\overline\{DE\}\\parallel\\overline\{BC\}\. Find the length of \\overline\{AC\}\.', prompt)
    if m:
        ad, db, ae = map(int, m.groups())
        return Fraction(ae * (ad + db), ad)
    m = re.fullmatch(r'In triangle ABC, point D is on \\overline\{AB\} and point E is on \\overline\{AC\}, with AD=(\d+), DB=(\d+) and AE=(\d+)\. What must the length of \\overline\{EC\} be so that \\overline\{DE\}\\parallel\\overline\{BC\}\?', prompt)
    require(m is not None, 'Unrecognized parallel-length prompt')
    ad, db, ae = map(int, m.groups())
    return Fraction(ae * db, ad)


def parse_map(label):
    t = clean(label).replace(' ', '')
    m = re.fullmatch(r'\(x,y\)\\to\((.*),(.*)\)', t)
    require(m is not None, f'Unreadable map {label!r}')
    rows = []
    for part in m.groups():
        part = re.sub(r'\\frac\{([xy])\}\{(\d+)\}', lambda q: f'(1/{q[2]}){q[1]}', part)
        cx, cy, c = Fraction(0), Fraction(0), Fraction(0)
        for sign, coef, var in re.findall(r'([+-]?)(\(1/\d+\)|\d*)([xy]?)', part):
            if not (coef or var):
                continue
            value = Fraction(1, int(coef[3:-1])) if coef.startswith('(1/') else (Fraction(int(coef)) if coef else Fraction(1))
            if not var and not coef:
                continue
            value = -value if sign == '-' else value
            if var == 'x':
                cx += value
            elif var == 'y':
                cy += value
            else:
                c += value
        rows.append((cx, cy))
    return rows


def solve_area_transform(public):
    prompt = clean(public['prompt'])
    m = re.fullmatch(r'A rectangle in the coordinate plane is transformed\. Which transformation (changes the area of the rectangle|keeps the area of the rectangle the same but does not always produce a figure congruent to the rectangle)\?', prompt)
    require(m is not None, 'Unrecognized area-transformation prompt')
    opts = options(public)
    flags = []
    for o in opts:
        (a, b), (c, d) = parse_map(o['label'])
        det = a * d - b * c
        isometry = (a * a + c * c == 1 and b * b + d * d == 1 and a * b + c * d == 0)
        if m[1].startswith('changes'):
            flags.append(abs(det) != 1)
        else:
            flags.append(abs(det) == 1 and not isometry)
    return only(opts, flags, 'area transformation')


SOLVERS = {
    'geo-segment-partition-point': solve_partition, 'geo-circle-general-form': solve_circle,
    'geo-line-point-slope-choice': solve_point_slope, 'geo-line-pair-relationship': solve_line_pair,
    'geo-dilation-line-image': solve_dilation_line, 'geo-dilation-line-center': solve_dilation_line,
    'geo-arc-length-rounded': solve_arc, 'geo-trig-leg-degrees': solve_trig_leg,
    'geo-sas-triangle-area': solve_sas, 'geo-ring-area': solve_ring, 'geo-sphere-diameter': solve_sphere,
    'geo-isosceles-trig': solve_isosceles_trig, 'geo-volume-context': solve_volume_context,
    'geo-dilation-center': solve_dilation_center, 'geo-motion-chain': solve_motion_chain,
    'geo-reflection-side': solve_reflection_side, 'geo-rigid-statement': solve_rigid_statement,
    'geo-altitude-ratio': solve_altitude_ratio, 'geo-parallel-perimeter': solve_parallel_perimeter,
    'geo-parallel-statement': solve_parallel_statement, 'geo-equal-legs-radical': solve_equal_legs,
    'geo-elevation-depression': solve_elevation, 'geo-density-rank': solve_density,
    'geo-altitude-hypotenuse': solve_altitude_hypotenuse, 'geo-centroid-median': solve_centroid,
    'geo-polygon-rotation': solve_polygon_rotation, 'geo-isosceles-exterior-angle': solve_isosceles_exterior,
    'geo-complementary-trig-choice': solve_complementary, 'geo-parallel-segment-length': solve_parallel_length,
    'geo-area-changing-transformation': solve_area_transform, 'geo-section-impossible': solve_section,
    'geo-parallelogram-sufficient': solve_parallelogram,
}


def solve(public):
    template = public['templateId']
    require(template in SUPPORTED and template in SOLVERS, f'Unexpected Geometry template {template}')
    return SOLVERS[template](public)


def review_problem(problem):
    public = problem['public']
    template = public['templateId']
    result = solve(public)
    hint = clean(problem.get('hint', ''))
    prompt = clean(public['prompt'])
    if template in NUMERIC:
        require(public['response']['kind'] == 'number', 'Numeric response required')
        require(Fraction(str(problem['answer'])) == result, f'Numeric answer mismatch: {problem["answer"]} != {result}')
        text = str(problem['answer'])
        coincidence = re.search(r'(?<![\d.])' + re.escape(text) + r'(?![\d])', prompt) is not None
        require(coincidence or len(text) < 3 or not re.search(r'(?<![\d.])' + re.escape(text) + r'(?![\d])', hint), 'Hint leaks the numeric answer')
        return result
    require(result == problem['answer'], f'Choice answer key mismatch: {problem["answer"]} != {result}')
    opts = options(public)
    labels = {o['id']: clean(o['label']) for o in opts}
    require(len(set(labels.values())) == len(labels) == 4, 'Choices must be four distinct options')
    correct = labels[result]
    # A line through the dilation center is its own image: restating the given line is the boundary case, not a leak.
    invariant = template == 'geo-dilation-line-center' and correct in prompt
    require(invariant or len(correct) < 4 or correct not in prompt, f'Prompt leaks the correct label {correct!r} in {template}')
    require(len(correct) < 5 or correct not in hint, 'Hint leaks the correct label')
    require(result not in (problem.get('choiceFeedback') or {}), 'Correct choice has wrong-answer feedback')
    return result


# ------------------------------------------------------------ self test
def mk(template, prompt, labels=None, answer=None, figure=None, hint=''):
    response = {'kind': 'number'} if labels is None else {'kind': 'choice', 'options': [{'id': f'option-{c}', 'label': l} for c, l in zip('abcd', labels)]}
    public = {'templateId': template, 'prompt': prompt, 'response': response}
    if figure:
        public['figure'] = figure
    return {'public': public, 'answer': answer, 'hint': hint}


def scene(points, segments=()):
    return {'kind': 'scene', 'scene': {'v': 1, 'elements': [{'type': 'graph', 'points': [{'x': x, 'y': y, 'label': n} for n, (x, y) in points.items()],
                                                          'segments': [{'from': list(a), 'to': list(b)} for a, b in segments]}]}}


def self_test():
    dil_points = {'A': (-6, -2), 'B': (-1, -3), 'C': (-6, 0), "A'": (-8, -2), "B'": (2, -4), "C'": (-8, 2)}
    dil_edges = [((-6, -2), (-1, -3)), ((-1, -3), (-6, 0)), ((-6, 0), (-6, -2)), ((-8, -2), (2, -4)), ((2, -4), (-8, 2)), ((-8, 2), (-8, -2))]
    refl_points = {'A': (-2, -4), 'B': (1, -3), 'C': (3, 2), 'D': (1, 2), 'F': (2, 4), 'G': (-1, 3), 'E': (-3, -2), 'H': (-1, -2)}
    good = [
        mk('geo-segment-partition-point', 'Segment $\\overline{AB}$ has endpoints $A(-2,\\ 4)$ and $B(-20,\\ -14)$. Point $P$ lies on $\\overline{AB}$ so that $AP:PB=5:4$. What are the coordinates of $P$?',
           ['$(-12,\\ -6)$', '$(-10,\\ -4)$', '$(-11,\\ -5)$', '$(-6,\\ -12)$'], 'option-a'),
        mk('geo-circle-general-form', 'A circle has the equation $4x^2 + 4y^2 - 48x - 32y + 192 = 0$. What are its center and radius?',
           ['center $(24,\\ 16)$, radius $2$', 'center $(6,\\ 4)$, radius $4$', 'center $(-6,\\ -4)$, radius $2$', 'center $(6,\\ 4)$, radius $2$'], 'option-d'),
        mk('geo-line-point-slope-choice', 'A line passes through $(4,\\ -6)$ and $(7,\\ -12)$. Which equation represents the line through $(-3,\\ 0)$ that is perpendicular to it?',
           ['$y = \\frac{1}{2}(x + 3)$', '$y = -2(x + 3)$', '$y = \\frac{1}{2}(x - 3)$', '$y = -\\frac{1}{2}(x + 3)$'], 'option-a'),
        mk('geo-line-pair-relationship', 'Line $\\ell$ has the equation $y = -\\frac{1}{3}x - 5$ and line $m$ has the equation $-3x - 9y = 45$. Which statement describes lines $\\ell$ and $m$?',
           ['parallel', 'the same line', 'neither parallel nor perpendicular', 'perpendicular'], 'option-b'),
        mk('geo-dilation-line-image', 'Line $\\ell$ has the equation $y = 5x - 2$. It is dilated by a scale factor of $\\frac{1}{2}$ centered at the origin. Which equation represents the image of $\\ell$?',
           ['$y = 5x - 4$', '$y = 10x - 1$', '$y = 5x - 1$', '$y = 5x - 2$'], 'option-c'),
        mk('geo-dilation-line-center', 'The line $y = 3x + 2$ is dilated by a scale factor of $4$ centered at the point $(1, 5)$. Which equation is the image of the line?',
           ['$y = 12x + 2$', '$y = 3x + 8$', '$y = 12x + 8$', '$y = 3x + 2$'], 'option-d'),
        mk('geo-arc-length-rounded', 'A circle has a diameter of 30 inches. A central angle of $35^\\circ$ intercepts an arc. Find the arc length to the nearest tenth of a unit.', answer='9.2'),
        mk('geo-trig-leg-degrees', 'In right triangle $PQR$ the right angle is at $R$, $PQ=40$ and $m\\angle P=17^\\circ$. Find $QR$ to the nearest tenth. Use a calculator in degree mode.', answer='11.7'),
        mk('geo-sas-triangle-area', 'Two sides of a triangle measure $8.0$ cm and $8.8$ cm, and the angle between them measures $106^\\circ$. Find the area of the triangle to the nearest tenth of a square centimeter. Use a calculator in degree mode.', answer='33.8'),
        mk('geo-ring-area', 'A circular pool has a diameter of 38 meters. A walkway 6 meters wide surrounds it. Find the area of the walkway to the nearest square meter.', answer='829'),
        mk('geo-sphere-diameter', 'A sphere has a volume of $2016\\ \\text{in}^3$. Find its diameter to the nearest tenth of an inch.', answer='15.7'),
        mk('geo-isosceles-trig', 'An isosceles triangle has an apex angle of $110^\\circ$. The altitude from the apex to the base is $27$ cm long. Find the perimeter of the triangle to the nearest tenth of a centimeter. Use a calculator in degree mode.', answer='171.3'),
        mk('geo-volume-context', 'A pile of sand is a cone with a radius of $8$ feet and a height of $9$ feet. A wagon carries $19$ cubic feet of sand per trip. What is the fewest number of trips needed to carry all of the sand?', answer='32'),
        mk('geo-dilation-center', 'Triangle $A\'B\'C\'$ is the image of triangle $ABC$ under a dilation. Which choice gives the center of the dilation, which has a scale factor of $2$?',
           ['Center $(-6, -2)$', 'Center $(4, 2)$', 'Center $(0, 0)$', 'Center $(-4, -2)$'], 'option-d', figure=scene(dil_points, dil_edges)),
        mk('geo-motion-chain', 'Triangle $ABC$ has vertices $A(1, -2)$, $B(-1, -1)$, $C(2, -1)$. Triangle $DEF$ has vertices $D(5, -5)$, $E(3, -4)$, $F(6, -4)$. Triangle $GHI$ has vertices $G(5, 5)$, $H(3, 4)$, $I(6, 4)$. Which sequence of rigid motions maps triangle $ABC$ onto triangle $DEF$ and then triangle $DEF$ onto triangle $GHI$?',
           ['A translation followed by a rotation', 'A reflection followed by a translation', 'A translation followed by a reflection', 'A rotation followed by a reflection'], 'option-c'),
        mk('geo-reflection-side', 'Quadrilateral $ABCD$ is reflected over the $x$-axis and the result is then reflected over the $y$-axis. The final image has vertices $E$, $F$, $G$ and $H$ as shown. Which segment is the image of $\\overline{CD}$?',
           ['$\\overline{FH}$', '$\\overline{EG}$', '$\\overline{FG}$', '$\\overline{EH}$'], 'option-d', figure=scene(refl_points)),
        mk('geo-rigid-statement', "Triangle $ABC$ is mapped to triangle $A'B'C'$ by 4 rigid motions: a rotation, then a reflection, then a reflection, then a reflection. Which statement must be true?",
           ["The vertices of $A'B'C'$ appear in the same order, clockwise or counterclockwise, as those of $ABC$.", "Each side of $A'B'C'$ is parallel to its corresponding side of $ABC$.", "The area of $A'B'C'$ equals the area of $ABC$.", "Triangle $A'B'C'$ is larger than triangle $ABC$."], 'option-c'),
        mk('geo-altitude-ratio', 'In right triangle $ABC$, the right angle is at $C$, $AC=4$ and $BC=7$. Altitude $\\overline{CD}$ is drawn to hypotenuse $\\overline{AB}$. Which equation is true?',
           ['$\\cos A = \\frac{BD}{BC}$', '$\\cos A = \\frac{CD}{AC}$', '$\\cos A = \\frac{AB}{AD}$', '$\\cos A = \\frac{AD}{AC}$'], 'option-d'),
        mk('geo-parallel-perimeter', 'In triangle $ABC$, point $D$ is on $\\overline{AB}$ and point $E$ is on $\\overline{AC}$, with $\\overline{DE}\\parallel\\overline{BC}$. $AD=12\\ \\text{cm}$, $AB=21\\ \\text{cm}$, $DE=12\\ \\text{cm}$ and $AE=8\\ \\text{cm}$. What is the perimeter of triangle $ABC$ in centimeters?', answer='56'),
        mk('geo-parallel-statement', 'In triangle $BYX$, point $Z$ is on $\\overline{BY}$ and point $V$ is on $\\overline{BX}$, with $\\overline{ZV}\\parallel\\overline{YX}$. Which statement is not always true?',
           ['$ZV=YX$', '$\\angle BZV\\cong\\angle BYX$', '$\\triangle BZV\\sim\\triangle BYX$', '$\\frac{BZ}{BY}=\\frac{BV}{BX}$'], 'option-a'),
        mk('geo-equal-legs-radical', 'In right triangle $ABC$, $AC=BC=2$ and the right angle is at $C$. Triangle $DEF$ is similar to triangle $ABC$, with the right angle at $F$ and $DE=16$. What is the length of $\\overline{DF}$?',
           ['$16\\sqrt{2}$', '$16$', '$8$', '$8\\sqrt{2}$'], 'option-d'),
        mk('geo-elevation-depression', 'A lookout is $245$ feet from a tower, measured along level ground. From the lookout, the angle of elevation to the top of the tower is $40^\\circ$ and the angle of depression to its base is $33^\\circ$. What is the height of the tower, to the nearest foot?', answer='365'),
        mk('geo-altitude-hypotenuse', 'In right triangle $ABC$ the right angle is at $C$. The altitude from $C$ meets hypotenuse $\\overline{AB}$ at $D$, with $AD=7$ and $DB=8$. What is the length of $\\overline{BC}$?',
           ['$\\sqrt{105}$', '$2\\sqrt{30}$', '$2\\sqrt{14}$', '$15$'], 'option-b'),
        mk('geo-centroid-median', 'In $\\triangle ABC$, $G$ is the centroid and $\\overline{AD}$ is the median to $\\overline{BC}$, so $G$ lies on $\\overline{AD}$. Which statement is always true?',
           ['$GD=\\frac12(AD)$', '$AG=2(GD)$', '$AD=2(GD)$', '$AG=\\frac12(AD)$'], 'option-b'),
        mk('geo-polygon-rotation', 'Which polygon maps onto itself when it is rotated $180^\\circ$ and $270^\\circ$ about its center? It must map onto itself under each of the rotations.',
           ['Square', 'Regular hexagon', 'Regular pentagon', 'Regular nonagon'], 'option-a'),
        mk('geo-isosceles-exterior-angle', 'In isosceles triangle $ABC$, $AB=AC$. The base angles are $m\\angle B=(5x + 1)^\\circ$ and $m\\angle C=(2x + 28)^\\circ$. Find the measure, in degrees, of the exterior angle at $A$, formed by extending $\\overline{BA}$ beyond $A$.', answer='92'),
        mk('geo-complementary-trig-choice', 'Angles $A$ and $B$ are acute, with $m\\angle A=(2x + 24)^\\circ$ and $m\\angle B=(3x + 26)^\\circ$, and $\\sin A=\\cos B$. Which equation can be used to solve for $x$?',
           ['$2x + 24=3x + 26$', '$(2x + 24)-(3x + 26)=90$', '$(2x + 24)+(3x + 26)=90$', '$(2x + 24)+(3x + 26)=180$'], 'option-c'),
        mk('geo-parallel-segment-length', 'In triangle $ABC$, point $D$ is on $\\overline{AB}$ and point $E$ is on $\\overline{AC}$, with $AD=6$, $DB=6$ and $AE=24$. $\\overline{DE}\\parallel\\overline{BC}$. Find the length of $\\overline{AC}$.', answer='48'),
        mk('geo-area-changing-transformation', 'A rectangle in the coordinate plane is transformed. Which transformation keeps the area of the rectangle the same but does not always produce a figure congruent to the rectangle?',
           ['$(x,\\ y)\\to(4x,\\ 4y)$', '$(x,\\ y)\\to(x+3,\\ y-4)$', '$(x,\\ y)\\to(4x,\\ y)$', '$(x,\\ y)\\to(2x,\\ \\frac{y}{2})$'], 'option-d'),
        mk('geo-section-impossible', 'A plane cuts through a rectangular prism. Which shape cannot be the cross section?',
           ['a heptagon', 'a triangle', 'a parallelogram', 'a rectangle'], 'option-a'),
        mk('geo-parallelogram-sufficient', 'Parallelogram $ABCD$ is given. Which added condition is enough to prove that $ABCD$ is a rectangle?',
           ['Its diagonals are congruent.', 'Its diagonals are perpendicular.', 'Its opposite sides are congruent.', 'Two consecutive sides are congruent.'], 'option-a'),
    ]
    for problem in good:
        review_problem(problem)
    require({p['public']['templateId'] for p in good} >= SUPPORTED - {'geo-density-rank'}, 'Self-test must cover every template')
    density = mk('geo-density-rank', 'The table shows the population and the land area of four counties. Population density is the number of people per square mile. Which list ranks the counties from least to greatest population density?',
                 ['Alder, Birch, Cedar, Fir', 'Fir, Cedar, Birch, Alder', 'Alder, Cedar, Birch, Fir', 'Birch, Alder, Cedar, Fir'], 'option-a',
                 figure={'kind': 'scene', 'scene': {'v': 1, 'elements': [{'type': 'table', 'columns': ['Population', 'Area (sq mi)'], 'rows': [
                     {'label': 'Fir', 'cells': ['4,666,000', '22,500']}, {'label': 'Cedar', 'cells': ['2,757,000', '27,600']},
                     {'label': 'Birch', 'cells': ['3,875,000', '59,300']}, {'label': 'Alder', 'cells': ['2,393,000', '57,900']}]}]}})
    review_problem(density)
    good.append(density)

    # Corrupted fixtures must all fail: wrong key, wrong number, duplicated choice, leaked answer, figure disagreeing with givens.
    def corrupt(problem, **changes):
        bad = {**problem, **changes}
        if 'public' in changes:
            bad['public'] = changes['public']
        return bad

    def expect_failure(problem, why):
        try:
            review_problem(problem)
        except (ValueError, KeyError):
            return
        raise AssertionError(f'Corrupted fixture was accepted: {why}')

    for problem in good:
        if problem['public']['response']['kind'] == 'choice':
            wrong = next(o['id'] for o in problem['public']['response']['options'] if o['id'] != problem['answer'])
            expect_failure(corrupt(problem, answer=wrong), f'wrong key for {problem["public"]["templateId"]}')
        else:
            expect_failure(corrupt(problem, answer=str(Fraction(problem['answer']) + (Fraction(1, 10) if '.' in problem['answer'] else 1)).replace('/', '')), f'wrong number for {problem["public"]["templateId"]}')
    arc = good[6]
    expect_failure(corrupt(arc, hint='The arc length is 9.2 units.'), 'hint leaks numeric answer')
    dil = good[13]
    moved = dict(dil['public'], figure=scene({**dil_points, "B'": (2, -5)}, dil_edges))
    expect_failure(corrupt(dil, public=moved), 'image vertex off the figure edges')
    shifted = dict(dil['public'], figure=scene({**dil_points, "A'": (-9, -2)}, [((-6, -2), (-1, -3)), ((-1, -3), (-6, 0)), ((-6, 0), (-6, -2)), ((-9, -2), (2, -4)), ((2, -4), (-8, 2)), ((-8, 2), (-9, -2))]))
    expect_failure(corrupt(dil, public=shifted), 'image no longer a dilation about any option')
    refl = good[15]
    off = dict(refl['public'], figure=scene({**refl_points, 'H': (-1, -3)}))
    expect_failure(corrupt(refl, public=off), 'figure disagrees with reflection')
    dup = dict(good[0]['public'], response={'kind': 'choice', 'options': [{'id': f'option-{c}', 'label': '$(-12,\\ -6)$'} for c in 'abcd']})
    expect_failure(corrupt(good[0], public=dup), 'duplicate choices')
    leak = dict(good[0]['public'], prompt=good[0]['public']['prompt'] + ' Is it $(-12,\\ -6)$?')
    expect_failure(corrupt(good[0], public=leak), 'prompt leaks label')
    chain = good[14]
    twisted = chain['public']['prompt'].replace('G(5, 5)', 'G(6, 5)')
    expect_failure(corrupt(chain, public=dict(chain['public'], prompt=twisted)), 'no single motions')
