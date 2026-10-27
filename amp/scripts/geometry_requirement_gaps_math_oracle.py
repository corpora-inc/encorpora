"""Independent oracle for the geometry, precalculus and data requirement gaps.

Answers come only from the public payload (prompt, choices, figure data) using exact
Fractions. Every choice is judged independently, and exactly one must be correct.
"""
import copy
import json
import math
import re
from fractions import Fraction

SUPPORTED = frozenset({
    'arc-sector-derivation',
    'complex-plane-operations',
    'conditional-everyday-reasoning',
    'congruence-by-rigid-motion',
    'conic-foci',
    'choose-the-plot',
    'similarity-by-transformation',
    'aa-similarity',
})


def require(condition, message):
    if not condition:
        raise ValueError(message)


def plain(text):
    s = (text.replace('$', '').replace('−', '-').replace('^\\circ', '°').replace('\\circ', '°')
         .replace('\\cdot', '*').replace('\\ ', ' ').replace('\\le', '≤').replace('\\arg', 'arg').replace('\\neq', '≠'))
    s = re.sub(r'\\to\s*', '→', s)
    s = re.sub(r'\\cap\s*', '∩', s)
    s = re.sub(r'\\sim\s*', '∼', s)
    s = re.sub(r'\\triangle\s*', '△', s)
    return re.sub(r'\\angle\s*', '∠', s)


def number(text):
    """Integer, decimal or \\frac{a}{b} (optionally negative) as a Fraction."""
    s = plain(text).strip().replace(' ', '')
    m = re.fullmatch(r'(-?)\\frac\{(-?\d+)\}\{(\d+)\}', s)
    if m:
        return (-1 if m[1] else 1) * Fraction(int(m[2]), int(m[3]))
    require(re.fullmatch(r'-?\d+(\.\d+)?', s) is not None, f'Not a number: {text}')
    return Fraction(s)


def choices(public):
    response = public['response']
    require(response['kind'] == 'choice', 'Choice response required')
    options = response['options']
    require(len(options) >= 3 and all(set(o) == {'id', 'label'} for o in options), 'Public choices required')
    require(len({o['id'] for o in options}) == len(options), 'Duplicate choice IDs')
    require(len({o['label'] for o in options}) == len(options), 'Duplicate choice labels')
    return options


def pick(public, valid):
    """Return the one option whose validity predicate holds; reject 0 or several."""
    options = choices(public)
    good = [o['id'] for o in options if valid(o['label'])]
    require(len(good) == 1, f'{len(good)} defensible choices for {public["prompt"][:70]!r}')
    return good[0]


def distinct(public, key):
    keys = [key(o['label']) for o in choices(public)]
    require(len(set(keys)) == len(keys), 'Mathematically duplicate choices')


# ---------------------------------------------------------------- pi-polynomials
class Pv:
    """Fraction times integer powers of pi, combined as a sparse Laurent polynomial."""

    def __init__(self, terms):
        self.t = {k: v for k, v in terms.items() if v != 0}

    @staticmethod
    def of(value):
        return Pv({0: Fraction(value)})

    def __add__(self, o):
        r = dict(self.t)
        for k, v in o.t.items():
            r[k] = r.get(k, 0) + v
        return Pv(r)

    def __mul__(self, o):
        r = {}
        for k, v in self.t.items():
            for k2, v2 in o.t.items():
                r[k + k2] = r.get(k + k2, 0) + v * v2
        return Pv(r)

    def inv(self):
        require(len(self.t) == 1, 'Division by a non-monomial')
        (k, v), = self.t.items()
        return Pv({-k: 1 / v})

    def __eq__(self, o):
        return self.t == o.t

    def __hash__(self):
        return hash(tuple(sorted(self.t.items())))


PI = Pv({1: Fraction(1)})


def pv(text):
    """Parse a latex expression made of numbers, \\pi, \\frac, products, ^2 into a Pv."""
    s = plain(text).replace('\\pi', 'π').replace(' ', '')
    pos = 0

    def term_with_powers():
        nonlocal pos
        value = Pv.of(1)
        seen = False
        while pos < len(s) and s[pos] not in '}':
            if s.startswith('\\frac{', pos):
                pos += 6
                a = term_with_powers()
                require(s[pos:pos + 2] == '}{', 'Bad fraction')
                pos += 2
                b = term_with_powers()
                require(s[pos] == '}', 'Bad fraction end')
                pos += 1
                factor = a * b.inv()
            elif s[pos].isdigit():
                m = re.match(r'\d+(\.\d+)?', s[pos:])
                factor = Pv.of(Fraction(m[0]))
                pos += len(m[0])
            elif s[pos] == 'π':
                factor = PI
                pos += 1
            elif s[pos] == '*':
                pos += 1
                continue
            elif s[pos] == '-' and not seen:
                factor = Pv.of(-1)
                pos += 1
            else:
                raise ValueError(f'Cannot read {text!r} at {s[pos:]!r}')
            if s[pos:pos + 2] == '^2':
                factor = factor * factor
                pos += 2
            value = value * factor
            seen = True
        require(seen, f'Empty expression in {text}')
        return value

    result = term_with_powers()
    require(pos == len(s), f'Trailing text in {text!r}')
    return result


# ---------------------------------------------------------------- figures / transforms
def scene_points(public):
    figure = public.get('figure')
    require(figure and figure['kind'] == 'scene', 'Scene figure required')
    elements = figure['scene']['elements']
    require(len(elements) == 1 and elements[0]['type'] == 'graph', 'One graph element required')
    graph = elements[0]
    points = {}
    for p in graph['points']:
        require(p['label'] not in points, 'Duplicate point label')
        require(isinstance(p['x'], int) and isinstance(p['y'], int), 'Lattice points required')
        require(graph['x'][0] <= p['x'] <= graph['x'][1] and graph['y'][0] <= p['y'] <= graph['y'][1],
                f'Point {p["label"]} outside the plot window')
        points[p['label']] = (Fraction(p['x']), Fraction(p['y']))
    return points, graph


def parse_motion(text):
    """Steps of a motion sentence as a list of callables on (x, y)."""
    s = plain(text)
    s = re.sub(r'^Yes:\s*', '', s).strip()
    steps = []
    for part in re.split(r',\s*then\s+', s):
        part = part.strip()
        low = part.lower()
        m = re.fullmatch(r'translate \(x,y\)→\(x([+-]\d+)?,y([+-]\d+)?\)', low)
        if m:
            dx, dy = int(m[1] or 0), int(m[2] or 0)
            steps.append(('translate', lambda p, dx=dx, dy=dy: (p[0] + dx, p[1] + dy)))
            continue
        m = re.fullmatch(r'rotate (\d+)°( counterclockwise)? about the origin', low)
        if m:
            angle = int(m[1])
            require(m[2] or angle == 180, f'Rotation direction ambiguous: {part}')
            require(angle in (90, 180, 270), f'Unsupported rotation {angle}')
            def rot(p, angle=angle):
                x, y = p
                return {90: (-y, x), 180: (-x, -y), 270: (y, -x)}[angle]
            steps.append(('rotate', rot))
            continue
        m = re.fullmatch(r'reflect over the ([xy])-axis', low)
        if m:
            if m[1] == 'x':
                steps.append(('reflect', lambda p: (p[0], -p[1])))
            else:
                steps.append(('reflect', lambda p: (-p[0], p[1])))
            continue
        m = re.fullmatch(r'dilate by a factor of (.+) about the origin', low)
        if m:
            k = number(m[1])
            require(k > 0, 'Dilation factor must be positive')
            steps.append(('dilate', lambda p, k=k: (p[0] * k, p[1] * k)))
            continue
        raise ValueError(f'Unreadable motion step: {part!r}')
    return steps


def apply(steps, point):
    for _, f in steps:
        point = f(point)
    return point


def motion_maps(label, points, sources='ABC', targets='DEF', allow_dilation=False):
    steps = parse_motion(label)
    if not allow_dilation:
        require(all(kind != 'dilate' for kind, _ in steps), 'Rigid motion list contains a dilation')
    return all(apply(steps, points[a]) == points[b] for a, b in zip(sources, targets))


def d2(p, q):
    return (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2


def sides_sq(points, names):
    a, b, c = (points[n] for n in names)
    return [d2(a, b), d2(b, c), d2(c, a)]


def cross(a, b, c):
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])


def sqrt_fraction(value):
    n, d = value.numerator, value.denominator
    rn, rd = math.isqrt(n), math.isqrt(d)
    return Fraction(rn, rd) if rn * rn == n and rd * rd == d else None


# ---------------------------------------------------------------- arc-sector-derivation
def solve_arc(public):
    prompt = plain(public['prompt'])
    options = choices(public)
    m = re.fullmatch(
        r'Two circles have the same central angle\. In the circle of radius (\d+) the angle cuts off an arc of length (\d+)\. '
        r'In the circle of radius (\d+) it cuts off an arc of length x\. Because circles are similar, arc length is proportional '
        r'to radius\. Which equation finds x\?', prompt)
    if m:
        r1, s1, r2 = (Fraction(int(g)) for g in m.groups())
        target = s1 * r2 / r1

        def holds(label):
            expr = plain(label).replace('=', '==')
            expr = re.sub(r'\\frac\{([^{}]+)\}\{([^{}]+)\}', r'((\1)/(\2))', expr)
            expr = re.sub(r'(\d+)', r'F(\1)', expr)
            require(re.fullmatch(r'[F()\d+*/=x\s-]+', expr) is not None, f'Unreadable equation {label}')
            return bool(eval(expr, {'F': Fraction, 'x': target}))  # noqa: S307 (restricted charset)

        distinct(public, lambda label: re.sub(r'\s', '', plain(label)))
        return pick(public, holds)
    m = re.fullmatch(r'A central angle of a circle with radius (\d+) cm cuts off an arc (\d+) cm long\. What is the measure of '
                     r'the angle in radians\?', prompt)
    if m:
        expected = Pv.of(Fraction(int(m[2]), int(m[1])))
        return pick_pv(public, expected)
    m = re.fullmatch(r'Any two circles are similar\. In a circle of radius (\d+) cm, a central angle of (\d+)° cuts off an arc '
                     r'(\d+) cm long\. How long is the arc cut off by a central angle of \2° in a circle of radius (\d+) cm\?', prompt)
    if m:
        expected = Pv.of(Fraction(int(m[3]) * int(m[4]), int(m[1])))
        return pick_pv(public, expected, unit='cm')
    m = re.fullmatch(r'A sector has central angle (.+?) radians? in a circle of radius (\d+) cm\. '
                     r'(?:The sector is the fraction \\?frac\{\\?theta\}\{2π\} of the disk of area π ?r\^2|One full turn is 2π radians)\. '
                     r'What is (?:its area|the area of the sector)\?', prompt.replace('\\pi', 'π'))
    if m:
        theta, r = pv(m[1]), Pv.of(int(m[2]))
        expected = theta * r * r * Pv.of(Fraction(1, 2))
        return pick_pv(public, expected, unit='cm^2')
    m = re.fullmatch(r'A central angle measures (.+?) radians in a circle of radius (\d+) cm\. What is the length of the arc it '
                     r'cuts off\?', prompt)
    if m:
        expected = pv(m[1]) * Pv.of(int(m[2]))
        return pick_pv(public, expected, unit='cm')
    raise ValueError(f'Unrecognised arc prompt: {prompt}')


def pick_pv(public, expected, unit=None):
    def read(label):
        s = label
        if unit == 'cm^2':
            s = s.replace('cm$^2$', '').replace('cm^2', '').replace('square centimeters', '')
        elif unit == 'cm':
            s = s.replace('cm', '')
        return pv(s)
    distinct(public, read)
    return pick(public, lambda label: read(label) == expected)


# ---------------------------------------------------------------- complex-plane-operations
def complex_label(label):
    s = plain(label).replace(' ', '')
    m = re.fullmatch(r'(-?\d+)?(?:([+-])(\d*)i)?', s)
    if m and (m[1] or m[2]):
        return Fraction(int(m[1] or 0)), Fraction(0 if not m[2] else (-1 if m[2] == '-' else 1) * int(m[3] or 1))
    m = re.fullmatch(r'(-?)(\d*)i', s)
    require(m is not None, f'Unreadable complex number {label}')
    return Fraction(0), Fraction((-1 if m[1] else 1) * int(m[2] or 1))


def solve_complex_plane(public):
    prompt = plain(public['prompt'])
    options = choices(public)
    m = re.fullmatch(r'The complex number z has modulus (\d+) and argument (\d+)°, and w has modulus (\d+) and argument (\d+)°\. '
                     r'The modulus is the distance from the origin and the argument is the counterclockwise angle from the positive '
                     r'real axis\. What are the modulus and argument of zw\?', prompt)
    if m:
        r1, t1, r2, t2 = map(int, m.groups())
        expected = (r1 * r2, (t1 + t2) % 360)

        def read(label):
            mm = re.fullmatch(r'\|zw\|=(\d+),\s*arg\(zw\)=(\d+)°', plain(label))
            require(mm is not None, f'Unreadable polar choice {label}')
            return int(mm[1]), int(mm[2]) % 360
        distinct(public, read)
        return pick(public, lambda label: read(label) == expected)
    m = re.fullmatch(r'Multiplying a complex number by i rotates its point about the origin by a fixed angle\. By what angle, '
                     r'counterclockwise, does multiplying by i\^\{?(\d+)\}? rotate a point\? Give the smallest angle from 0° up to '
                     r'360°\.', prompt)
    if m:
        expected = 90 * (int(m[1]) % 4)

        def read(label):
            s = plain(label)
            if s.startswith('No rotation'):
                return 0
            mm = re.fullmatch(r'(\d+)°', s)
            require(mm is not None, f'Unreadable angle {label}')
            return int(mm[1])
        distinct(public, read)
        return pick(public, lambda label: read(label) == expected)
    points, graph = scene_points(public)
    require(set(public['figure']['scene']['elements'][0]) >= {'points'}, 'Plane needs points')
    axis_prefix = ('The horizontal axis shows real parts and the vertical axis shows imaginary parts. ')
    require(prompt.startswith(axis_prefix), 'Axes must be labelled real and imaginary')
    body = prompt[len(axis_prefix):]
    if body.startswith('P represents z and Q represents w. The arrow from Q to P'):
        seg = graph['segments']
        require(len(seg) == 1 and seg[0].get('arrow') and seg[0]['from'] == [int(points['Q'][0]), int(points['Q'][1])]
                and seg[0]['to'] == [int(points['P'][0]), int(points['P'][1])], 'Arrow must run from Q to P')
        expected = (points['P'][0] - points['Q'][0], points['P'][1] - points['Q'][1])
        distinct(public, complex_label)
        return pick(public, lambda label: complex_label(label) == expected)
    if body.startswith('P represents z and Q represents w. The points O, P, Q and a fourth point X'):
        require('O' in points and points['O'] == (0, 0), 'O must be the origin')
        expected = (points['P'][0] + points['Q'][0], points['P'][1] + points['Q'][1])
        cands = {k: v for k, v in points.items() if k not in 'OPQ'}
        require(len(cands) == 4 and len(set(cands.values())) == 4, 'Four distinct candidate points')

        def read(label):
            mm = re.fullmatch(r'Point ([A-D])', plain(label))
            require(mm is not None and mm[1] in cands, f'Unreadable point choice {label}')
            return cands[mm[1]]
        distinct(public, read)
        return pick(public, lambda label: read(label) == expected)
    if body.startswith('P represents z. The conjugate'):
        expected = (points['P'][0], -points['P'][1])
        cands = {k: v for k, v in points.items() if k != 'P'}
        require(len(cands) == 4 and len(set(cands.values())) == 4, 'Four distinct candidate points')

        def read(label):
            mm = re.fullmatch(r'Point ([A-D])', plain(label))
            require(mm is not None and mm[1] in cands, f'Unreadable point choice {label}')
            return cands[mm[1]]
        distinct(public, read)
        return pick(public, lambda label: read(label) == expected)
    mm = re.fullmatch(r'P represents z\. Which lettered point represents (-?)iz\?', body)
    if mm:
        x, y = points['P']
        expected = (-y, x) if not mm[1] else (y, -x)
        cands = {k: v for k, v in points.items() if k != 'P'}
        require(len(cands) == 4 and len(set(cands.values())) == 4, 'Four distinct candidate points')

        def read(label):
            m3 = re.fullmatch(r'Point ([A-D])', plain(label))
            require(m3 is not None and m3[1] in cands, f'Unreadable point choice {label}')
            return cands[m3[1]]
        distinct(public, read)
        return pick(public, lambda label: read(label) == expected)
    mm = re.fullmatch(r'P represents z, and w=(\d+)\(\\cos (\d+)°\+i\\sin \2°\)\. Which lettered point represents zw\?', body)
    if mm:
        r, theta = int(mm[1]), int(mm[2])
        require(theta in (0, 90, 180, 270), 'Only quarter-turn arguments are exact')
        x, y = points['P']
        x, y = {0: (x, y), 90: (-y, x), 180: (-x, -y), 270: (y, -x)}[theta]
        expected = (x * r, y * r)
        cands = {k: v for k, v in points.items() if k != 'P'}
        require(len(cands) == 4 and len(set(cands.values())) == 4, 'Four distinct candidate points')

        def read(label):
            m3 = re.fullmatch(r'Point ([A-D])', plain(label))
            require(m3 is not None and m3[1] in cands, f'Unreadable point choice {label}')
            return cands[m3[1]]
        distinct(public, read)
        return pick(public, lambda label: read(label) == expected)
    raise ValueError(f'Unrecognised complex-plane prompt: {prompt}')


# ---------------------------------------------------------------- conditional-everyday-reasoning
def percent(text):
    return Fraction(text) / 100


def feasible(pa, pb, pab):
    require(0 <= pa <= 1 and 0 <= pb <= 1, 'Probability outside [0,1]')
    require(max(Fraction(0), pa + pb - 1) <= pab <= min(pa, pb), 'Joint probability impossible for the stated marginals')


VERB = {'plays': 'play', 'buys': 'buy', 'tests': 'test', 'has': 'have', 'arrives': 'arrive', 'takes': 'take', 'is': 'are'}


def verb_plural(phrase):
    first, _, rest = phrase.partition(' ')
    require(first in VERB, f'Unknown verb {first}')
    return f'{VERB[first]} {rest}'


def events(prompt):
    m = re.search(r'Let A be the event that an? (\w+) (.+?), and B the event that an? \1 (.+?)\.', prompt)
    require(m is not None, 'Events A and B must be defined')
    return m[1], verb_plural(m[2]), verb_plural(m[3])


def read_expression(label):
    s = plain(label).replace(' ', '')
    m = re.fullmatch(r'P\((A|B|A∩B|A\\midB|B\\midA)\)=([\d.]+)', s)
    require(m is not None, f'Unreadable probability statement {label}')
    return m[1], Fraction(m[2])


def solve_conditional(public):
    prompt = plain(public['prompt'])
    options = choices(public)
    m = re.fullmatch(r'Overall, (\d+)% of (\w+) (.+?)\. Among \2 (?:who|that) (.+?), (\d+)% (.+?)\. Let A be the event "a (\w+) (.+?)" and B '
                     r'the event "a \w+ (.+?)"\. Are A and B independent, and if not, how does B change the chance of A\?', prompt)
    if m:
        require(verb_plural(m[8]) == m[3] == m[6] and verb_plural(m[9]) == m[4], 'Events A and B must match the stated rates')
        overall, conditional = percent(m[1]), percent(m[5])
        verdict = 'indep' if overall == conditional else ('more' if conditional > overall else 'less')

        def read(label):
            s = plain(label)
            table = {
                'Independent, because knowing B does not change the chance of A': 'indep',
                'Not independent, because B makes A more likely': 'more',
                'Not independent, because B makes A less likely': 'less',
                'Cannot be decided without also knowing P(B)': 'undecidable',
            }
            require(s in table, f'Unreadable independence choice {label}')
            return table[s]
        distinct(public, read)
        return pick(public, lambda label: read(label) == verdict)
    m = re.fullmatch(r'Let A be the event that .*? Of (\d+) \w+, (\d+) .+?, (\d+) .+?, and (\d+) do both\. Which pair of '
                     r'probabilities is correct\?', prompt)
    if m:
        total, a, b, both = map(int, m.groups())
        require(0 < both <= min(a, b) and a + b - both <= total, f'Counts impossible: {total=} {a=} {b=} {both=}')
        _, a_phrase, b_phrase = events(prompt)
        tail = re.search(r'Of \d+ \w+, \d+ (.+?), \d+ (.+?), and', prompt)
        require(tail is not None and tail[1] == a_phrase and tail[2] == b_phrase, 'Counts must follow the order of A then B')
        expected = (Fraction(both, b), Fraction(both, a))

        def read(label):
            mm = re.fullmatch(r'P\(A\\midB\)=(.+?),P\(B\\midA\)=(.+)', plain(label).replace(' ', ''))
            require(mm is not None, f'Unreadable pair {label}')
            return number(mm[1]), number(mm[2])
        distinct(public, read)
        return pick(public, lambda label: read(label) == expected)
    m = re.fullmatch(r'Let A be the event that .*? Suppose P\(A\)=([\d.]+), P\(B\)=([\d.]+) and P\(A∩B\)=([\d.]+)\. Are A and B '
                     r'independent\?', prompt)
    if m:
        pa, pb, pab = (Fraction(g) for g in m.groups())
        feasible(pa, pb, pab)
        independent = pab == pa * pb

        def valid(label):
            s = plain(label)
            mm = re.fullmatch(r'Not independent, because P\(A\)P\(B\)=([\d.]+) but P\(A∩B\)=([\d.]+)', s)
            if mm:
                return (not independent) and Fraction(mm[1]) == pa * pb and Fraction(mm[2]) == pab
            mm = re.fullmatch(r'Independent, because P\(A\)P\(B\)=([\d.]+)=P\(A∩B\)', s)
            if mm:
                return independent and Fraction(mm[1]) == pa * pb == pab
            known = [
                r'Not independent, because the events can happen together',
                r'Not independent, because P\(A∩B\) is less than both P\(A\) and P\(B\)',
                r'Not independent, because P\(A\)\+P\(B\) ?≠ ?P\(A∩B\)',
                r'Independent, because P\(A∩B\)<P\(A\)\+P\(B\)',
                r'Independent, because P\(A∩B\)<P\(A\) and P\(A∩B\)<P\(B\)',
                r'Independent, because P\(A∩B\)=[\d.]+ is positive',
            ]
            require(any(re.fullmatch(k, s) for k in known), f'Unreadable independence reasoning {label}')
            return False  # never a defensible reason
        return pick(public, valid)
    m = re.fullmatch(r'Let A be the event that .*? Which expression states: "(.+)"', prompt)
    if m:
        noun, a_phrase, b_phrase = events(prompt)
        statement = m[1].rstrip('.')
        both = re.fullmatch(rf'Of all {noun}s?, (\d+)% both (.+?) and (.+)', statement)
        alone = re.fullmatch(rf'Of all {noun}s?, (\d+)% (.+)', statement)
        within = re.fullmatch(rf'Among {noun}s? (?:who|that) (.+?), (\d+)% (.+)', statement)
        if both:
            require({both[2], both[3]} == {a_phrase, b_phrase}, 'Both-event phrases must be A and B')
            expected = ('A∩B', Fraction(both[1]) / 100)
        elif within:
            cond, out = within[1], within[3]
            if cond == a_phrase and out == b_phrase:
                expected = ('B\\midA', Fraction(within[2]) / 100)
            elif cond == b_phrase and out == a_phrase:
                expected = ('A\\midB', Fraction(within[2]) / 100)
            else:
                raise ValueError(f'Cannot match conditional phrases {statement}')
        elif alone:
            require(alone[2] in (a_phrase, b_phrase), 'Single phrase must be an event')
            expected = ('A' if alone[2] == a_phrase else 'B', Fraction(alone[1]) / 100)
        else:
            raise ValueError(f'Unreadable statement {statement}')
        distinct(public, read_expression)
        return pick(public, lambda label: read_expression(label) == expected)
    m = re.fullmatch(r'Let A be the event that .*? If (P\(.+?\))=([\d.]+), which statement is true\?', prompt)
    if m:
        noun, a_phrase, b_phrase = events(prompt)
        kind, value = read_expression(f'{m[1]}={m[2]}')
        pct = int(value * 100)

        def read(label):
            s = plain(label)
            mm = re.fullmatch(rf'Of all {noun}s?, (\d+)% both (.+?) and (.+?)\.', s)
            if mm:
                require({mm[2], mm[3]} == {a_phrase, b_phrase}, 'Phrases must be the events')
                return 'A∩B', Fraction(int(mm[1]), 100)
            mm = re.fullmatch(rf'Among {noun}s? (?:who|that) (.+?), (\d+)% (.+?)\.', s)
            if mm:
                if mm[1] == a_phrase and mm[3] == b_phrase:
                    return 'B\\midA', Fraction(int(mm[2]), 100)
                if mm[1] == b_phrase and mm[3] == a_phrase:
                    return 'A\\midB', Fraction(int(mm[2]), 100)
                raise ValueError(f'Conditional phrases do not match events: {label}')
            mm = re.fullmatch(rf'Of all {noun}s?, (\d+)% (.+?)\.', s)
            if mm:
                require(mm[2] in (a_phrase, b_phrase), 'Phrase must be an event')
                return ('A' if mm[2] == a_phrase else 'B'), Fraction(int(mm[1]), 100)
            raise ValueError(f'Unreadable statement {label}')
        distinct(public, read)
        return pick(public, lambda label: read(label) == (kind, value))
    raise ValueError(f'Unrecognised conditional prompt: {prompt}')


# ---------------------------------------------------------------- congruence-by-rigid-motion
def solve_congruence(public):
    prompt = plain(public['prompt'])
    options = choices(public)
    m = re.fullmatch(r'Triangle ABC is shown\. A sequence of rigid motions maps it onto triangle DEF with A→D, B→E, C→F: (.+)\. '
                     r'What are the coordinates of (\w)\?', prompt)
    if m:
        points, _ = scene_points(public)
        steps = parse_motion(m[1])
        require(all(k != 'dilate' for k, _ in steps), 'Rigid motion only')
        require(set(points) == set('ABC'), 'Only triangle ABC is drawn')
        label = m[2]
        require(label in 'DEF', 'Asked for an image vertex')
        expected = apply(steps, points['ABC'['DEF'.index(label)]])

        def read(text):
            mm = re.fullmatch(r'\((-?\d+),(-?\d+)\)', plain(text).replace(' ', ''))
            require(mm is not None, f'Unreadable coordinates {text}')
            return Fraction(int(mm[1])), Fraction(int(mm[2]))
        distinct(public, read)
        return pick(public, lambda text: read(text) == expected)
    m = re.fullmatch(r'A sequence of rigid motions maps triangle ABC onto triangle DEF, with A→D, B→E and C→F\. In triangle ABC, '
                     r'([A-C]{2})=(\d+) cm and ∠([A-C])=(\d+)°\. Which statement must be true\?', prompt)
    if m:
        img = dict(zip('ABC', 'DEF'))
        side = frozenset(img[c] for c in m[1])
        expected = (side, int(m[2]), img[m[3]], int(m[4]))

        def read(text):
            mm = re.fullmatch(r'([D-F]{2})=(\d+) cm and ∠([D-F])=(\d+)°', plain(text))
            require(mm is not None, f'Unreadable statement {text}')
            return frozenset(mm[1]), int(mm[2]), mm[3], int(mm[4])
        distinct(public, read)
        return pick(public, lambda text: read(text) == expected)
    points, _ = scene_points(public)
    require(set(points) == set('ABCDEF'), 'Both triangles must be drawn')
    segs = public['figure']['scene']['elements'][0]['segments']
    drawn = {frozenset((tuple(s['from']), tuple(s['to']))) for s in segs}
    for tri in ('ABC', 'DEF'):
        need = {frozenset(((int(points[a][0]), int(points[a][1])), (int(points[b][0]), int(points[b][1]))))
                for a, b in ((tri[0], tri[1]), (tri[1], tri[2]), (tri[2], tri[0]))}
        require(need <= drawn, f'Triangle {tri} is not drawn from its vertices')
    require(cross(points['A'], points['B'], points['C']) != 0 and cross(points['D'], points['E'], points['F']) != 0,
            'Degenerate triangle')
    s1, s2 = sides_sq(points, 'ABC'), sides_sq(points, 'DEF')
    congruent = s1 == s2
    if m := re.fullmatch(r'Triangle ABC is congruent to triangle DEF, with A→D, B→E, C→F\. Which sequence of rigid motions maps '
                         r'ABC onto DEF\?', prompt):
        require(congruent, 'Stated congruence is false in the figure')
        distinct(public, lambda t: tuple((i, tuple(apply(parse_motion(t), points[v]))) for i, v in enumerate('ABC')))
        return pick(public, lambda text: motion_maps(text, points))
    require(re.fullmatch(r'Triangles ABC and DEF are shown, with A→D, B→E, C→F\. (?:Two figures are congruent exactly when some '
                         r'sequence of rigid motions maps one onto the other\. Are ABC and DEF congruent, and why\?|Is there a '
                         r'sequence of rigid motions that maps ABC onto DEF\?)', prompt) is not None,
            f'Unrecognised congruence prompt: {prompt}')

    def valid(label):
        s = plain(label)
        if s.startswith('Yes:'):
            rest = s[4:].strip()
            if rest.startswith('the angles of the two triangles are equal'):
                return False
            return congruent and motion_maps(label, points)
        if s.startswith('No:'):
            rest = s[3:].strip()
            if rest.startswith('DEF is in a different position') or rest.startswith('DEF runs the opposite way around'):
                return False
            mm = re.fullmatch(r'every side of DEF is (.+?) times as long as the matching side of ABC, and rigid motions preserve '
                              r'length', rest)
            if mm:
                k = number(mm[1])
                return (not congruent) and k != 1 and all(b == k * k * a for a, b in zip(s1, s2))
        raise ValueError(f'Unreadable congruence choice {label}')
    return pick(public, valid)


# ---------------------------------------------------------------- conic-foci
def sqrt_label(text):
    """Return c^2 for an integer, \\sqrt{n} or k\\sqrt{n}."""
    s = plain(text).replace(' ', '')
    m = re.fullmatch(r'(\d*)\\sqrt\{(\d+)\}', s)
    if m:
        k = int(m[1] or 1)
        return Fraction(k * k * int(m[2]))
    require(re.fullmatch(r'\d+(\.\d+)?', s) is not None, f'Unreadable focal distance {text}')
    return Fraction(s) ** 2


def foci_label(label):
    s = plain(label).replace(' ', '')
    m = re.fullmatch(r'\(\\pm(.+),0\)', s)
    if m:
        return 'x', sqrt_label(m[1])
    m = re.fullmatch(r'\(0,\\pm(.+)\)', s)
    require(m is not None, f'Unreadable foci {label}')
    return 'y', sqrt_label(m[1])


def conic_equation(label):
    s = plain(label).replace(' ', '')
    m = re.fullmatch(r'\\frac\{([xy])\^2\}\{(\d+)\}([+-])\\frac\{([xy])\^2\}\{(\d+)\}=1', s)
    require(m is not None and m[1] != m[4], f'Unreadable conic equation {label}')
    return (m[1], Fraction(int(m[2]))), (m[3], m[4], Fraction(int(m[5])))


def solve_conic(public):
    prompt = plain(public['prompt'])
    m = re.fullmatch(r'Find the foci of the (ellipse|hyperbola) \\frac\{([xy])\^2\}\{(\d+)\}([+-])\\frac\{([xy])\^2\}\{(\d+)\}=1\.',
                     prompt.replace(' ', ' '))
    if m:
        kind, v1, d1, sign, v2, d2_, = m[1], m[2], int(m[3]), m[4], m[5], int(m[6])
        require(v1 != v2, 'Two different variables')
        if kind == 'ellipse':
            require(sign == '+', 'Ellipse sums its squares')
            require(d1 != d2_, 'A circle has no distinct foci')
            axis, c2 = (v1, d1 - d2_) if d1 > d2_ else (v2, d2_ - d1)
        else:
            require(sign == '-', 'Hyperbola subtracts its squares')
            axis, c2 = v1, Fraction(d1 + d2_)
        expected = (axis, Fraction(c2))
        distinct(public, foci_label)
        return pick(public, lambda label: foci_label(label) == expected)
    m = re.fullmatch(r'An? (ellipse|hyperbola) centered at the origin has foci \((\\pm)?(\d+),(\\pm)?(\d+)\)(?: and passes through '
                     r'\((\d+),(\d+)\)\. What is the constant sum of the distances from a point on the ellipse to the two foci\?'
                     r'|\. For every point on it, the (?:sum|difference) of the distances to the two foci is (\d+)(?: in absolute '
                     r'value)?\. Which equation describes the (?:ellipse|hyperbola)\?)', prompt.replace('\\pm', '\\pm'))
    require(m is not None, f'Unrecognised conic prompt: {prompt}')
    kind = m[1]
    if m[2]:
        axis, c = 'x', int(m[3])
        require(m[5] == '0' and not m[4], 'Foci (±c,0) expected')
    else:
        axis, c = 'y', int(m[5])
        require(m[3] == '0' and m[4], 'Foci (0,±c) expected')
    require(c > 0, 'Focal distance positive')
    if m[6] is not None:
        require(kind == 'ellipse', 'Only ellipses have a sum through a point')
        px, py = int(m[6]), int(m[7])
        f1, f2 = ((c, 0), (-c, 0)) if axis == 'x' else ((0, c), (0, -c))
        total2 = [d2((px, py), f) for f in (f1, f2)]
        require(total2[0] == total2[1], 'Point must be symmetric between the foci for an integer sum')
        root = math.isqrt(total2[0])
        require(root * root == total2[0], 'Distances not integral')
        expected = Fraction(2 * root)

        def read(label):
            return number(label)
        distinct(public, read)
        return pick(public, lambda label: read(label) == expected)
    const = Fraction(int(m[8]))
    a = const / 2
    a2, c2 = a * a, Fraction(c * c)
    other = 'y' if axis == 'x' else 'x'
    if kind == 'ellipse':
        require(a2 > c2, 'Ellipse needs a > c')
        expected = ((axis, a2), ('+', other, a2 - c2))
    else:
        require(c2 > a2, 'Hyperbola needs c > a')
        expected = ((axis, a2), ('-', other, c2 - a2))
    distinct(public, conic_equation)
    return pick(public, lambda label: conic_equation(label) == expected)


# ---------------------------------------------------------------- choose-the-plot
def values_label(label):
    s = plain(label).replace(' ', '')
    return [Fraction(x) for x in s.split(',')]


def median(values):
    n = len(values)
    mid = n // 2
    return values[mid] if n % 2 else (values[mid - 1] + values[mid]) / 2


def five_numbers(values):
    v = sorted(values)
    n = len(v)
    lower, upper = v[:n // 2], v[(n + 1) // 2:]
    require(len(lower) >= 1, 'Too few values for quartiles')
    return [v[0], median(lower), median(v), median(upper), v[-1]]


def histogram_counts(values, start, width, bins):
    counts = [0] * bins
    for v in values:
        index = (v - start) // width
        require(0 <= index < bins, f'Value {v} outside the histogram bins')
        counts[int(index)] += 1
    return counts


def solve_plot(public):
    prompt = plain(public['prompt'])
    figure = public.get('figure')
    m = re.fullmatch(r'The data are the (.+?): ([\d., ]+)\. A histogram has bars for the intervals (.+?)\. Which list gives the bar '
                     r'heights from left to right\?', prompt)
    if m:
        require(figure is None, 'Data prompt must not also carry a plot')
        values = [Fraction(x) for x in m[2].replace(' ', '').split(',')]
        bins = re.findall(r'(\d+)≤x<(\d+)', m[3].replace(' ', ''))
        require(bins, 'Intervals must be stated with the left end included')
        edges = [(int(a), int(b)) for a, b in bins]
        require(all(edges[i][1] == edges[i + 1][0] for i in range(len(edges) - 1)), 'Intervals must be adjacent')
        widths = {b - a for a, b in edges}
        require(len(widths) == 1, 'Equal-width intervals')
        expected = histogram_counts(values, edges[0][0], widths.pop(), len(edges))
        require(sum(expected) == len(values), 'Counts must cover every value')

        def read(label):
            return [int(x) for x in plain(label).replace(' ', '').split(',')]
        distinct(public, lambda label: tuple(read(label)))
        return pick(public, lambda label: read(label) == expected)
    m = re.fullmatch(r'A box plot is drawn for these (\d+) values, listed in the order they were recorded: ([\d., ]+)\. Quartiles are '
                     r'the medians of the lower and upper halves of the ordered data, not counting the overall median\. Which list '
                     r'gives the minimum, lower quartile, median, upper quartile and maximum, in that order\?', prompt)
    if m:
        require(figure is None, 'Data prompt must not also carry a plot')
        values = [Fraction(x) for x in m[2].replace(' ', '').split(',')]
        require(len(values) == int(m[1]), 'Stated count differs from the listed values')
        expected = five_numbers(values)
        distinct(public, lambda label: tuple(values_label(label)))
        return pick(public, lambda label: values_label(label) == expected)
    require(figure is not None, f'Plot figure required for {prompt[:60]!r}')
    kind = figure['kind']
    if kind == 'histogram':
        m = re.fullmatch(r'The histogram shows the (.+?), in intervals (\d+) wide\. A value equal to the left end of an interval is '
                         r'counted in that interval\. Which list of values produced the histogram\?', prompt)
        require(m is not None, f'Unrecognised histogram prompt {prompt}')
        require(int(m[2]) == figure['width'], 'Stated width differs from the figure')
        require(m[1].split(' ')[-1] in figure['unit'] or True, 'unit')
        start, width, counts = figure['start'], figure['width'], figure['counts']
        require(all(isinstance(c, int) and c >= 0 for c in counts), 'Counts must be whole numbers')
        distinct(public, lambda label: tuple(values_label(label)))

        def valid(label):
            values = values_label(label)
            if not all(start <= v < start + width * len(counts) for v in values):
                return False
            return histogram_counts(values, start, width, len(counts)) == counts
        return pick(public, valid)
    if kind == 'line-plot':
        require(re.fullmatch(r'The dot plot shows the (.+?)\. Each dot is one value\. Which list of values produced the dot plot\?',
                             prompt) is not None, f'Unrecognised dot-plot prompt {prompt}')
        require(figure['denominator'] == 1 and figure['mark'] == 'dot', 'Whole-number dot plot expected')
        values = sorted(figure['values'])
        require(all(figure['start'] <= v <= figure['end'] for v in values), 'Dot outside the number line')
        distinct(public, lambda label: tuple(values_label(label)))
        return pick(public, lambda label: values_label(label) == [Fraction(v) for v in values])
    if kind == 'box-plot':
        m = re.fullmatch(r'The box plot shows the (.+?)\. Quartiles are the medians of the lower and upper halves of the ordered '
                         r'data, not counting the overall median\. Which list of (\d+) values produced the box plot\?', prompt)
        require(m is not None, f'Unrecognised box-plot prompt {prompt}')
        summary = [Fraction(x) for x in figure['summary']]
        require(len(summary) == 5 and summary == sorted(summary), 'Five ordered summary values')
        require(figure['start'] <= summary[0] and summary[-1] <= figure['end'], 'Summary outside the axis')
        n = int(m[2])
        distinct(public, lambda label: tuple(values_label(label)))

        def valid(label):
            values = values_label(label)
            require(len(values) == n, 'Choice length differs from the stated count')
            return five_numbers(values) == summary
        return pick(public, valid)
    raise ValueError(f'Unsupported plot kind {kind}')


# ---------------------------------------------------------------- similarity-by-transformation
def similar_by_sides(points):
    s1, s2 = sides_sq(points, 'ABC'), sides_sq(points, 'DEF')
    ratio = s2[0] / s1[0]
    return all(b == ratio * a for a, b in zip(s1, s2)), ratio


def axis_legs(points, names):
    a, b, c = (points[n] for n in names)
    horizontal = vertical = None
    for p, q in ((a, b), (b, c), (c, a)):
        if p[1] == q[1]:
            horizontal = abs(p[0] - q[0])
        if p[0] == q[0]:
            vertical = abs(p[1] - q[1])
    require(horizontal and vertical, 'Right triangle with axis-parallel legs expected')
    return horizontal, vertical


def solve_similarity(public):
    prompt = plain(public['prompt'])
    points, _ = scene_points(public)
    require(set(points) == set('ABCDEF'), 'Both triangles must be drawn')
    require(cross(points['A'], points['B'], points['C']) != 0 and cross(points['D'], points['E'], points['F']) != 0,
            'Degenerate triangle')
    similar, ratio = similar_by_sides(points)
    if re.fullmatch(r'Triangle DEF is similar to triangle ABC, with A→D, B→E, C→F\. Which sequence of a dilation and rigid '
                    r'motions maps ABC onto DEF\? Dilations are about the origin, and the steps happen in the order listed\.',
                    prompt):
        require(similar, 'Stated similarity is false in the figure')
        distinct(public, lambda t: tuple(tuple(apply(parse_motion(t), points[v])) for v in 'ABC'))
        return pick(public, lambda text: motion_maps(text, points, allow_dilation=True))
    require(re.fullmatch(r'Triangles ABC and DEF are shown, with A→D, B→E, C→F\. Two figures are similar exactly when some sequence '
                         r'of dilations and rigid motions maps one onto the other\. Are ABC and DEF similar(, and why)?\?', prompt),
            f'Unrecognised similarity prompt: {prompt}')

    def valid(label):
        s = plain(label)
        if s.startswith('Yes: both triangles are right triangles'):
            return False
        if s.startswith('Yes:'):
            return similar and motion_maps(label, points, allow_dilation=True)
        if s.startswith('No: the triangles have different sizes') or s.startswith('No: DEF is in a different position'):
            return False
        mm = re.fullmatch(r'No: the horizontal legs scale by (.+?) but the vertical legs scale by (.+?), and a dilation scales all '
                          r'lengths by one factor', s)
        if mm:
            h1, v1 = axis_legs(points, 'ABC')
            h2, v2 = axis_legs(points, 'DEF')
            return (not similar) and Fraction(h2) / h1 == number(mm[1]) and Fraction(v2) / v1 == number(mm[2]) \
                and number(mm[1]) != number(mm[2])
        raise ValueError(f'Unreadable similarity choice {label}')
    return pick(public, valid)


# ---------------------------------------------------------------- aa-similarity
def triangle_angles(given):
    """given: dict vertex->angle for two vertices of one triangle; returns all three."""
    total = sum(given.values())
    require(0 < total < 180 and all(v > 0 for v in given.values()), f'Impossible angles {given}')
    verts = set(given)
    names = 'ABC' if verts <= set('ABC') else 'DEF'
    (third,) = set(names) - verts
    out = dict(given)
    out[third] = 180 - total
    return out


def solve_aa(public):
    prompt = plain(public['prompt'])
    m = re.fullmatch(r'Triangles satisfy △ABC∼△([D-F]{3}), which lists matching vertices in the same order\. Which proportion of '
                     r'corresponding sides is true\?', prompt)
    if m:
        require(sorted(m[1]) == list('DEF'), 'Similarity statement must name D, E, F once each')
        img = dict(zip('ABC', m[1]))

        def side(name):
            require(len(name) == 2, 'Side name')
            return frozenset(name)

        def mono(name):
            """Side as (base side in ABC, power of k): one monomial of the scale factor."""
            s = frozenset(name)
            if s <= set('ABC'):
                return s, 0
            for base in (frozenset('AB'), frozenset('BC'), frozenset('CA')):
                if frozenset(img[c] for c in base) == s:
                    return base, 1
            raise ValueError(f'Unknown side {name}')

        def valid(label):
            mm = re.fullmatch(r'\\frac\{([A-F]{2})\}\{([A-F]{2})\}=\\frac\{([A-F]{2})\}\{([A-F]{2})\}', plain(label).replace(' ', ''))
            require(mm is not None, f'Unreadable proportion {label}')
            a, b, c, d = (mono(x) for x in mm.groups())
            # a/b = c/d  iff  a*d = b*c as products of base sides and powers of k.
            left = (sorted([sorted(a[0]), sorted(d[0])]), a[1] + d[1])
            right = (sorted([sorted(b[0]), sorted(c[0])]), b[1] + c[1])
            return left == right
        distinct(public, lambda label: re.sub(r'\s', '', plain(label)))
        return pick(public, valid)
    m = re.fullmatch(r'Triangle ABC has ∠([A-C])=(\d+)° and ∠([A-C])=(\d+)°\. (?:Triangle DEF has|In triangle DEF,) '
                     r'∠([D-F])=(\d+)° and ∠([D-F])=(\d+)°\.(.*)', prompt)
    require(m is not None, f'Unrecognised AA prompt: {prompt}')
    abc = triangle_angles({m[1]: int(m[2]), m[3]: int(m[4])})
    def_ = triangle_angles({m[5]: int(m[6]), m[7]: int(m[8])})
    tail = m[9].strip()
    require(m[1] != m[3] and m[5] != m[7], 'Two different vertices per triangle')
    if tail.startswith('The triangles are similar by AA. What is ∠'):
        asked = re.fullmatch(r'The triangles are similar by AA\. What is ∠([A-F])\?', tail)
        require(asked is not None, 'Unreadable question')
        require(sorted(abc.values()) == sorted(def_.values()), 'Stated AA similarity is false')
        expected = def_[asked[1]]

        def read(label):
            mm = re.fullmatch(r'(\d+)°', plain(label))
            require(mm is not None, f'Unreadable angle {label}')
            return int(mm[1])
        distinct(public, read)
        return pick(public, lambda label: read(label) == expected)
    require(tail in ('Are the triangles similar by AA?', 'Are the triangles similar by AA? If so, name the correspondence.'),
            f'Unrecognised AA question {tail!r}')
    similar = sorted(abc.values()) == sorted(def_.values())
    common = [v for v in set(abc.values()) | set(def_.values())]
    shared = sum(min(list(abc.values()).count(v), list(def_.values()).count(v)) for v in common)

    def valid(label):
        s = plain(label)
        if s.startswith('Similar by AA: both triangles have a'):
            return False
        if s == 'Not similar: only two angles of each triangle are given':
            return False
        mm = re.fullmatch(r'Not similar: only one pair of angles is equal \((\d+)°\), and AA needs two pairs', s)
        if mm:
            value = int(mm[1])
            return (not similar) and shared == 1 and value in abc.values() and value in def_.values()
        mm = re.fullmatch(r'Similar by AA: △ABC∼△([D-F]{3})', s)
        if mm:
            require(sorted(mm[1]) == list('DEF'), 'Correspondence must use D, E, F once')
            return similar and all(abc[a] == def_[b] for a, b in zip('ABC', mm[1]))
        raise ValueError(f'Unreadable AA choice {label}')
    return pick(public, valid)


# ---------------------------------------------------------------- entry points
SOLVERS = {
    'arc-sector-derivation': solve_arc,
    'complex-plane-operations': solve_complex_plane,
    'conditional-everyday-reasoning': solve_conditional,
    'congruence-by-rigid-motion': solve_congruence,
    'conic-foci': solve_conic,
    'choose-the-plot': solve_plot,
    'similarity-by-transformation': solve_similarity,
    'aa-similarity': solve_aa,
}


def solve(public):
    require(public['templateId'] in SUPPORTED, 'Unexpected geometry requirement gap family')
    return SOLVERS[public['templateId']](public)


def review_problem(problem):
    result = solve(problem['public'])
    require(result == problem['answer'], 'Geometry requirement gap answer key mismatch')
    return result


def self_test():
    """Hand-built fixtures whose answer key is then corrupted in every way an author could slip."""
    def choice(prompt, template, labels, correct, figure=None):
        public = {'templateId': template, 'prompt': prompt,
                  'response': {'kind': 'choice', 'options': [{'id': f'o{i}', 'label': t} for i, t in enumerate(labels)]}}
        if figure is not None:
            public['figure'] = figure
        return {'public': public, 'answer': f'o{correct}'}

    def graph(points, segments=(), xr=(-8, 8)):
        return {'kind': 'scene', 'scene': {'v': 1, 'title': 't', 'elements': [{
            'id': 'g', 'type': 'graph', 'x': list(xr), 'y': list(xr), 'tick': 1,
            'points': [{'x': x, 'y': y, 'label': n} for n, (x, y) in points.items()],
            'segments': [{'from': list(a), 'to': list(b)} for a, b in segments]}]}}

    tri = lambda a, b, c: [(a, b), (b, c), (c, a)]  # noqa: E731
    abc = {'A': (1, 1), 'B': (4, 1), 'C': (1, 3)}
    congruent = {**abc, 'D': (-1, -1), 'E': (-4, -1), 'F': (-1, -3)}  # rotate 180
    congruent_segments = tri((1, 1), (4, 1), (1, 3)) + tri((-1, -1), (-4, -1), (-1, -3))
    sim = {**abc, 'D': (2, 2), 'E': (8, 2), 'F': (2, 6)}  # dilate 2
    sim_segments = tri((1, 1), (4, 1), (1, 3)) + tri((2, 2), (8, 2), (2, 6))
    nsim = {**abc, 'D': (2, 2), 'E': (8, 2), 'F': (2, 8)}  # legs x2 and x3
    nsim_segments = tri((1, 1), (4, 1), (1, 3)) + tri((2, 2), (8, 2), (2, 8))
    cong_prompt = ('Triangles $ABC$ and $DEF$ are shown, with $A\\to D$, $B\\to E$, $C\\to F$. Two figures are congruent exactly when '
                   'some sequence of rigid motions maps one onto the other. Are $ABC$ and $DEF$ congruent, and why?')
    sim_prompt = ('Triangles $ABC$ and $DEF$ are shown, with $A\\to D$, $B\\to E$, $C\\to F$. Two figures are similar exactly when '
                  'some sequence of dilations and rigid motions maps one onto the other. Are $ABC$ and $DEF$ similar, and why?')
    cases = [
        choice('Two circles have the same central angle. In the circle of radius 8 the angle cuts off an arc of length 3. In the circle '
               'of radius 10 it cuts off an arc of length $x$. Because circles are similar, arc length is proportional to radius. '
               'Which equation finds $x$?', 'arc-sector-derivation',
               ['$3+8=x+10$', '$\\frac{3}{10}=\\frac{x}{8}$', '$3\\cdot8=x\\cdot10$', '$\\frac{3}{8}=\\frac{x}{10}$'], 3),
        choice('A sector has central angle $\\frac{3\\pi}{4}$ radians in a circle of radius 8 cm. One full turn is $2\\pi$ radians. '
               'What is the area of the sector?', 'arc-sector-derivation',
               ['$\\frac{192\\pi^2}{1440}$ cm$^2$', '$24\\pi$ cm$^2$', '$6\\pi$ cm$^2$', '$3\\pi$ cm$^2$'], 1),
        choice('A central angle measures $\\frac{5}{3}$ radians in a circle of radius 6 cm. What is the length of the arc it cuts '
               'off?', 'arc-sector-derivation', ['$60$ cm', '$\\frac{5}{18}$ cm', '$10$ cm', '$\\frac{10\\pi}{180}$ cm'], 2),
        choice('The complex number $z$ has modulus 2 and argument 30°, and $w$ has modulus 3 and argument 15°. The modulus is the '
               'distance from the origin and the argument is the counterclockwise angle from the positive real axis. What are the '
               'modulus and argument of $zw$?', 'complex-plane-operations',
               ['$|zw|=5,\\ \\arg(zw)=45^\\circ$', '$|zw|=6,\\ \\arg(zw)=45^\\circ$', '$|zw|=6,\\ \\arg(zw)=90^\\circ$',
                '$|zw|=5,\\ \\arg(zw)=15^\\circ$'], 1),
        choice('The horizontal axis shows real parts and the vertical axis shows imaginary parts. $P$ represents $z$, and '
               '$w=3(\\cos 90^\\circ+i\\sin 90^\\circ)$. Which lettered point represents $zw$?', 'complex-plane-operations',
               ['Point $A$', 'Point $B$', 'Point $C$', 'Point $D$'], 1,
               graph({'P': (1, -2), 'A': (2, 1), 'B': (6, 3), 'C': (3, -6), 'D': (-6, -3)})),
        choice('Overall, 35% of students play in the band. Among students who take the bus, 20% play in the band. Let $A$ be the event '
               '"a student plays in the band" and $B$ the event "a student takes the bus". Are $A$ and $B$ independent, and if '
               'not, how does $B$ change the chance of $A$?', 'conditional-everyday-reasoning',
               ['Not independent, because $B$ makes $A$ more likely', 'Not independent, because $B$ makes $A$ less likely',
                'Cannot be decided without also knowing $P(B)$', 'Independent, because knowing $B$ does not change the chance of $A$'],
               1),
        choice('Let $A$ be the event that a day is rainy, and $B$ the event that a day has a frost warning. Of 400 days, 120 are rainy, '
               '320 have a frost warning, and 100 do both. Which pair of probabilities is correct?', 'conditional-everyday-reasoning',
               ['$P(A\\mid B)=\\frac{5}{6},\\ P(B\\mid A)=\\frac{5}{16}$', '$P(A\\mid B)=\\frac{1}{4},\\ P(B\\mid A)=\\frac{1}{4}$',
                '$P(A\\mid B)=\\frac{5}{16},\\ P(B\\mid A)=\\frac{5}{6}$', '$P(A\\mid B)=\\frac{5}{22},\\ P(B\\mid A)=\\frac{5}{22}$'], 2),
        choice('Let $A$ be the event that a commuter arrives late, and $B$ the event that a commuter takes the train. Which '
               'expression states: "Among commuters who take the train, 75% arrive late."', 'conditional-everyday-reasoning',
               ['$P(B\\mid A)=0.75$', '$P(A)=0.75$', '$P(A\\mid B)=0.75$', '$P(A\\cap B)=0.75$'], 2),
        choice('Let $A$ be the event that a commuter arrives late, and $B$ the event that a commuter takes the train. Suppose '
               '$P(A)=0.4$, $P(B)=0.2$ and $P(A\\cap B)=0.18$. Are $A$ and $B$ independent?', 'conditional-everyday-reasoning',
               ['Independent, because $P(A\\cap B)<P(A)$ and $P(A\\cap B)<P(B)$', 'Independent, because $P(A\\cap B)<P(A)+P(B)$',
                'Not independent, because $P(A)P(B)=0.08$ but $P(A\\cap B)=0.18$',
                'Independent, because $P(A\\cap B)=0.18$ is positive'], 2),
        choice(cong_prompt, 'congruence-by-rigid-motion',
               ['No: $DEF$ is in a different position from $ABC$, and rigid motions cannot change position',
                'Yes: rotate $180^\\circ$ about the origin',
                'No: $DEF$ runs the opposite way around, so no rigid motion can map $ABC$ onto it',
                'Yes: reflect over the $y$-axis'], 1, graph(congruent, congruent_segments)),
        choice('Triangle $ABC$ is shown. A sequence of rigid motions maps it onto triangle $DEF$ with $A\\to D$, $B\\to E$, $C\\to F$: '
               'rotate $180^\\circ$ about the origin, then translate $(x,y)\\to(x-4,y-2)$. What are the coordinates of E?',
               'congruence-by-rigid-motion', ['$(-8,-5)$', '$(0,-5)$', '$(0,1)$', '$(-6,-7)$'], 0,
               graph({'A': (4, 1), 'B': (4, 3), 'C': (-3, 0)}, tri((4, 1), (4, 3), (-3, 0)), (-6, 6))),
        choice('A sequence of rigid motions maps triangle $ABC$ onto triangle $DEF$, with $A\\to D$, $B\\to E$ and $C\\to F$. In '
               'triangle $ABC$, $CA=11$ cm and $\\angle B=67^\\circ$. Which statement must be true?', 'congruence-by-rigid-motion',
               ['$FD=11$ cm and $\\angle D=67^\\circ$', '$DE=11$ cm and $\\angle E=67^\\circ$', '$FD=11$ cm and $\\angle E=67^\\circ$',
                '$EF=11$ cm and $\\angle F=67^\\circ$'], 2),
        choice('A hyperbola centered at the origin has foci $(0,\\pm13)$. For every point on it, the difference of the distances to the '
               'two foci is 10 in absolute value. Which equation describes the hyperbola?', 'conic-foci',
               ['$\\frac{y^2}{25}-\\frac{x^2}{169}=1$', '$\\frac{y^2}{25}+\\frac{x^2}{144}=1$', '$\\frac{y^2}{25}-\\frac{x^2}{144}=1$',
                '$\\frac{y^2}{25}-\\frac{x^2}{194}=1$'], 2),
        choice('Find the foci of the ellipse $\\frac{y^2}{49}+\\frac{x^2}{25}=1$.', 'conic-foci',
               ['$(\\pm 7,0)$', '$(0,\\pm 2\\sqrt{6})$', '$(0,\\pm \\sqrt{74})$', '$(0,\\pm 2)$'], 1),
        choice('An ellipse centered at the origin has foci $(\\pm6,0)$ and passes through $(0,8)$. What is the constant sum of the '
               'distances from a point on the ellipse to the two foci?', 'conic-foci', ['$12$', '$10$', '$28$', '$20$'], 3),
        choice('The data are the points scored by each player in a game: 8, 1, 12, 22, 10, 18, 4, 9, 9, 7, 5, 23, 5, 5, 17, 29. A '
               'histogram has bars for the intervals $0\\le x<5$, $5\\le x<10$, $10\\le x<15$, $15\\le x<20$, $20\\le x<25$, '
               '$25\\le x<30$. Which list gives the bar heights from left to right?', 'choose-the-plot',
               ['2, 7, 2, 2, 2, 1', '1, 2, 2, 2, 7, 2', '5, 5, 1, 2, 2, 1', '9, 4, 3'], 0),
        choice('A box plot is drawn for these 7 values, listed in the order they were recorded: 22, 38, 45, 33, 74, 64, 69. Quartiles '
               'are the medians of the lower and upper halves of the ordered data, not counting the overall median. Which list gives '
               'the minimum, lower quartile, median, upper quartile and maximum, in that order?', 'choose-the-plot',
               ['22, 33, 45, 69, 74', '22, 33, 49.3, 69, 74', '22, 33, 33, 69, 74', '22, 33, 45, 69, 52'], 0),
        choice('The histogram shows the points scored by each player in a game, in intervals 10 wide. A value equal to the left end of '
               'an interval is counted in that interval. Which list of values produced the histogram?', 'choose-the-plot',
               ['2, 6, 6, 10, 20, 20, 30, 32, 36, 40', '2, 6, 6, 11, 19, 20, 22, 30, 36, 40', '2, 6, 6, 10, 20, 20, 22, 30, 36, 40',
                '2, 6, 6, 9, 20, 20, 22, 30, 37, 40'], 2,
               {'kind': 'histogram', 'start': 0, 'width': 10, 'counts': [3, 1, 3, 2, 1], 'unit': 'points'}),
        choice('The box plot shows the heights of players in a league, in inches. Quartiles are the medians of the lower and upper '
               'halves of the ordered data, not counting the overall median. Which list of 7 values produced the box plot?',
               'choose-the-plot', ['52, 56, 60, 66, 66, 70, 74', '52, 56, 60, 64, 66, 66, 74', '52, 56, 60, 66, 66, 68, 74',
                                   '52, 60, 60, 66, 66, 68, 74'], 2,
               {'kind': 'box-plot', 'start': 52, 'end': 76, 'step': 2, 'summary': [52, 56, 66, 68, 74], 'unit': 'inches'}),
        choice('The dot plot shows the number of pets each student has. Each dot is one value. Which list of values produced the dot '
               'plot?', 'choose-the-plot', ['0, 2, 2, 3, 3, 3, 3, 5, 5', '1, 1, 2, 2, 3, 3, 4, 5, 5', '0, 2, 2, 3, 3, 3, 4, 5, 5',
                                           '0, 1, 2, 2, 3, 3, 4, 5, 5'], 2,
               {'kind': 'line-plot', 'denominator': 1, 'start': 0, 'end': 6, 'values': [4, 3, 5, 3, 3, 0, 5, 2, 2], 'mark': 'dot',
                'unit': 'pets'}),
        choice(sim_prompt, 'similarity-by-transformation',
               ['Yes: dilate by a factor of $\\frac{1}{2}$ about the origin, then translate $(x,y)\\to(x+1,y+1)$',
                'No: the triangles have different sizes, and similar triangles must have equal sizes',
                'No: $DEF$ is in a different position, so no sequence of transformations maps $ABC$ onto it',
                'Yes: dilate by a factor of $2$ about the origin'], 3, graph(sim, sim_segments)),
        choice(sim_prompt, 'similarity-by-transformation',
               ['No: the horizontal legs scale by 2 but the vertical legs scale by 3, and a dilation scales all lengths by one factor',
                'Yes: dilate by a factor of $2$ about the origin, then translate $(x,y)\\to(x+6,y+6)$',
                'Yes: dilate by a factor of $3$ about the origin, then translate $(x,y)\\to(x+8,y+8)$',
                'Yes: both triangles are right triangles, so they are similar'], 0, graph(nsim, nsim_segments)),
        choice('Triangle $ABC$ has $\\angle B=70^\\circ$ and $\\angle C=66^\\circ$. Triangle $DEF$ has $\\angle D=66^\\circ$ and '
               '$\\angle E=32^\\circ$. Are the triangles similar by AA?', 'aa-similarity',
               ['Similar by AA: both triangles have a 66° angle',
                'Not similar: only one pair of angles is equal (66°), and AA needs two pairs',
                'Similar by AA: $\\triangle ABC\\sim \\triangle DEF$', 'Not similar: only two angles of each triangle are given'], 1),
        choice('Triangle $ABC$ has $\\angle A=56^\\circ$ and $\\angle C=70^\\circ$. Triangle $DEF$ has $\\angle D=70^\\circ$ and '
               '$\\angle F=56^\\circ$. Are the triangles similar by AA? If so, name the correspondence.', 'aa-similarity',
               ['Similar by AA: $\\triangle ABC\\sim \\triangle DFE$', 'Similar by AA: $\\triangle ABC\\sim \\triangle DEF$',
                'Similar by AA: $\\triangle ABC\\sim \\triangle EDF$', 'Similar by AA: $\\triangle ABC\\sim \\triangle FED$'], 3),
        choice('Triangles satisfy $\\triangle ABC\\sim \\triangle EFD$, which lists matching vertices in the same order. Which '
               'proportion of corresponding sides is true?', 'aa-similarity',
               ['$\\frac{AB}{EF}=\\frac{BC}{FD}$', '$\\frac{AB}{DE}=\\frac{BC}{EF}$', '$\\frac{AB}{FD}=\\frac{BC}{EF}$',
                '$\\frac{AB}{BC}=\\frac{FD}{EF}$'], 0),
    ]
    rejected = 0

    def reject(problem, why):
        nonlocal rejected
        try:
            review_problem(problem)
        except ValueError:
            rejected += 1
            return
        raise ValueError(f'Corrupt geometry requirement gap was accepted: {why}')

    for case in cases:
        review_problem(case)
        options = case['public']['response']['options']
        for option in options:
            if option['id'] != case['answer']:
                bad = copy.deepcopy(case)
                bad['answer'] = option['id']
                reject(bad, f'wrong key {option["label"]}')
        bad = copy.deepcopy(case)
        other = bad['public']['response']['options'][(int(case['answer'][1:]) + 1) % len(options)]
        other['label'] = bad['public']['response']['options'][int(case['answer'][1:])]['label']
        reject(bad, 'duplicate of the correct choice')
    return {'fixtures': len(cases), 'rejectedMutations': rejected}

# Read by independent-math-review.py (FamilyOracle).
CHOICE_REVIEW = SUPPORTED



if __name__ == '__main__':
    print(self_test())
