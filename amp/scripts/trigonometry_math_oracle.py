"""Independent trigonometry review from public prompts, choices and figures.

Every expected value is recomputed with floating-point trigonometry from the
displayed givens (never from generator logic). Choice labels are parsed from
LaTeX into numbers, so exact radical and pi forms compare by value.
"""
import copy
import math
import re
from figure_givens import check_figure_givens

SUPPORTED = frozenset({
    'special-angle-exact-value', 'trig-symmetry-value', 'sinusoid-parameters',
    'inverse-trig-value', 'trig-equation-solutions', 'trig-identity-value',
    'oblique-triangle-solve', 'trig-triangle-area', 'sinusoid-model',
})
EPS = 1e-9
PI = math.pi


def require(condition, message):
    if not condition:
        raise ValueError(message)


# ---------------------------------------------------------------- LaTeX values
def clean(text):
    text = text.replace('$', '').replace('−', '-')
    text = re.sub(r'\\left|\\right', '', text)
    text = text.replace('\\,', ' ').replace('\\ ', ' ')
    return text


FUNCTIONS = {
    'sin': math.sin, 'cos': math.cos, 'tan': math.tan,
    'arcsin': math.asin, 'arccos': math.acos, 'arctan': math.atan,
}


class Reader:
    def __init__(self, text, x=None):
        self.tokens = re.findall(r'\\[A-Za-z]+|\d+\.\d+|\d+|[A-Za-z]|[{}()+\-^]', clean(text))
        self.position = 0
        self.x = x

    def peek(self):
        return self.tokens[self.position] if self.position < len(self.tokens) else None

    def take(self, expected=None):
        token = self.peek()
        require(token is not None and (expected is None or token == expected), f'Expected {expected}')
        self.position += 1
        return token

    def value(self):
        result = self.expression()
        require(self.peek() is None, f'Trailing tokens in {self.tokens}')
        return result

    def expression(self):
        sign = 1
        while self.peek() in ('+', '-'):
            sign *= -1 if self.take() == '-' else 1
        total = sign * self.term()
        while self.peek() in ('+', '-'):
            op = self.take()
            total += self.term() if op == '+' else -self.term()
        return total

    def starts_factor(self):
        token = self.peek()
        return token is not None and (
            token[0].isdigit() or token in ('\\pi', '\\frac', '\\sqrt', '(', '{', 'X')
            or token[1:] in FUNCTIONS and token[0] == '\\')

    def term(self):
        result = self.factor()
        while self.starts_factor():
            result *= self.factor()
        return result

    def factor(self):
        result = self.atom()
        while self.peek() == '^':
            self.take()
            if self.peek() == '\\circ':
                self.take()
                result *= PI / 180
            else:
                result **= self.atom()
        return result

    def group(self):
        self.take('{')
        result = self.expression()
        self.take('}')
        return result

    def atom(self):
        token = self.take()
        if token[0].isdigit():
            return float(token)
        if token == '\\pi':
            return PI
        if token == '\\frac':
            top = self.group()
            return top / self.group()
        if token == '\\sqrt':
            return math.sqrt(self.group())
        if token == '(':
            result = self.expression()
            self.take(')')
            return result
        if token == '{':
            self.position -= 1
            return self.group()
        if token == 'X':
            require(self.x is not None, 'Unexpected variable')
            return self.x
        if token[0] == '\\' and token[1:] in FUNCTIONS:
            return FUNCTIONS[token[1:]](self.atom())
        raise ValueError(f'Unreadable token {token}')


def ev(text, x=None):
    return Reader(text, x).value()


def close(a, b, tol=1e-7):
    if a is None or b is None:
        return a is b
    if isinstance(a, (tuple, list)):
        return len(a) == len(b) and all(close(p, q, tol) for p, q in zip(a, b))
    return abs(a - b) <= tol


def sorted_set(values):
    ordered = sorted(values)
    out = []
    for v in ordered:
        if not out or abs(v - out[-1]) > 1e-7:
            out.append(v)
    return out


def trig(name, angle):
    value = FUNCTIONS[name](angle)
    if name == 'tan' and abs(math.cos(angle)) < 1e-9:
        return None
    return value


def labels(public):
    response = public['response']
    require(response['kind'] == 'choice', 'Trigonometry uses choice responses')
    options = response['options']
    require(len(options) == 4 and all(set(o) == {'id', 'label'} for o in options), 'Four public choices required')
    require(len({o['id'] for o in options}) == 4, 'Duplicate choice IDs')
    return options


def pick(public, expected, parse):
    """Return the one option whose parsed value equals expected, enforcing distinct choices."""
    options = labels(public)
    values = [parse(o['label']) for o in options]
    for i in range(4):
        for j in range(i):
            require(not close(values[i], values[j]), 'Mathematically duplicate choices')
    hits = [o['id'] for o, v in zip(options, values) if close(v, expected)]
    require(len(hits) == 1, f'Missing or ambiguous correct choice (expected {expected})')
    return hits[0]


def number_label(label):
    return ev(label)


def angle_degrees_or_radians(text):
    """Value in radians of an angle written with ^\\circ or as a radian expression."""
    return ev(text)


# ------------------------------------------------------- special angles
def solve_special(public):
    prompt = clean(public['prompt'])
    point = re.fullmatch(r'The terminal side of the angle \\theta=(.+?) meets the unit circle at a point \(x,y\)\. Which point is it\?', prompt)
    if point:
        angle = ev(point[1])

        def parse_point(label):
            body = clean(label).strip()
            require(body.startswith('(') and body.endswith(')'), 'Point label expected')
            first, second = re.split(r',\s', body[1:-1].replace('\\ ', ' '), maxsplit=1) if ', ' in body else re.split(r',', body[1:-1], maxsplit=1)
            return (ev(first), ev(second))
        return pick(public, (math.cos(angle), math.sin(angle)), parse_point)
    value = re.fullmatch(
        r'(?:Find the exact value of \\(sin|cos|tan)\((.+)\) \(angle in (?:degrees|radians)\)\.'
        r'|What is \\(sin|cos|tan)\((.+)\)\? If it has no value, choose the answer that says so\.)', prompt)
    require(value is not None, 'Unrecognised special-angle prompt')
    name = value[1] or value[3]
    angle_text = value[2] or value[4]
    unit = re.search(r'angle in (degrees|radians)', prompt)
    if unit:
        require((unit[1] == 'degrees') == ('circ' in angle_text), 'Stated angle unit disagrees with angle')
    angle = ev(angle_text)
    expected = trig(name, angle)

    def parse(label):
        return None if clean(label).strip() == 'Undefined' else ev(label)
    return pick(public, expected, parse)


# ------------------------------------------------------- symmetry
def solve_symmetry(public):
    prompt = clean(public['prompt'])
    match = re.fullmatch(r'Given \\(sin|cos)\\theta=(-?[\d.]+)( with \\theta acute)?, find \\(sin|cos|tan)\((.+)\)\.', prompt)
    require(match is not None, 'Unrecognised symmetry prompt')
    given, v, acute, target, argument = match[1], float(match[2]), bool(match[3]), match[4], match[5]
    other = math.sqrt(1 - v * v)
    candidates = [(v, other), (v, -other)] if given == 'sin' else [(other, v), (-other, v)]
    if acute:
        require(v > 0, 'Acute angle needs positive given value')
        candidates = candidates[:1]
    sign = -1 if re.search(r'-\s*\\theta', argument) else 1
    offset = ev(re.sub(r'[+-]?\s*\\theta', '', argument, count=1) or '0')
    require('\\theta' in argument, 'Argument must contain theta')
    results = []
    for sin_t, cos_t in candidates:
        if given == 'sin':
            require(abs(sin_t) <= 1, 'Impossible given value')
        s = sin_t if sign == 1 else -sin_t  # sin(sign*theta)
        c = cos_t
        sin_a = s * math.cos(offset) + c * math.sin(offset)
        cos_a = c * math.cos(offset) - s * math.sin(offset)
        results.append({'sin': sin_a, 'cos': cos_a, 'tan': sin_a / cos_a if abs(cos_a) > 1e-9 else None}[target])
    require(all(close(r, results[0]) for r in results), 'Symmetry prompt is ambiguous without a quadrant')
    return pick(public, results[0], number_label)


# ------------------------------------------------------- sinusoid parameters
def read_sinusoid(text):
    match = re.fullmatch(r'y=(-?\d*)\\sin\((.+)x\)([+-]\d+)?', clean(text).replace(' ', ''))
    require(match is not None, f'Unreadable sinusoid {text}')
    amplitude = {'': 1, '-': -1}.get(match[1], None)
    if amplitude is None:
        amplitude = int(match[1])
    return amplitude, ev(match[2]), int(match[3] or 0)


def solve_sinusoid_parameters(public):
    prompt = clean(public['prompt'])
    if prompt.startswith('Which equation matches the graph'):
        figure = public.get('figure')
        require(figure is not None and figure['kind'] == 'scene', 'Graph figure required')
        elements = figure['scene']['elements']
        require(len(elements) == 1 and elements[0]['type'] == 'graph', 'One graph expected')
        graph = elements[0]
        require(len(graph['curves']) == 1, 'One curve expected')
        fn = graph['curves'][0]['fn']
        require(fn['f'] == 'sin', 'Sine curve expected')
        a, b, k = fn['a'], fn['b'], fn['k']
        # The window must show the whole vertical range and at least one full cycle.
        require(graph['y'][0] <= k - abs(a) + EPS and graph['y'][1] >= k + abs(a) - EPS, 'Graph window clips the curve')
        require(graph['x'][0] == 0 and graph['x'][1] >= 2 * PI / b - EPS, 'Graph window shows less than one cycle')
        # Samples read off the graph determine the function the choices must match.
        samples = [(x / 8 * graph['x'][1], k + a * math.sin(b * x / 8 * graph['x'][1])) for x in range(9)]

        def parse(label):
            A, B, K = read_sinusoid(label)
            return (A, B, K)
        options = labels(public)
        values = [parse(o['label']) for o in options]
        hits = [o['id'] for o, (A, B, K) in zip(options, values)
                if all(abs(K + A * math.sin(B * x) - y) < 1e-7 for x, y in samples)]
        for i in range(4):
            for j in range(i):
                require(not close(values[i], values[j]), 'Duplicate sinusoid choices')
        require(len(hits) == 1, 'Graph matches zero or several equations')
        return hits[0]
    shift_find = re.fullmatch(r'Findthehorizontalshiftofy=(-?\d*)\\sin\((\d+)x([+-].+)\)([+-]\d+)?\.', prompt.replace(' ', ''))
    if shift_find:
        b = float(shift_find[2])
        shift = -ev(shift_find[3]) / b
        return pick(public, shift, shift_label)
    shift_compare = re.fullmatch(
        r'Describethehorizontalshiftofy=(-?\d*)\\sin\((.+?)\(x([+-].+)\)\)([+-]\d+)?comparedwithy=.*\.',
        prompt.replace(' ', ''))
    if shift_compare:
        return pick(public, -ev(shift_compare[3]), shift_label)
    ask = re.fullmatch(r'What is the (amplitude|period|maximum value|minimum value|equation of the midline) of (y=.+)\?', prompt)
    require(ask is not None, 'Unrecognised sinusoid prompt')
    A, B, K = read_sinusoid(ask[2])
    kind = ask[1]
    if kind == 'equation of the midline':
        return pick(public, K, lambda label: ev(re.fullmatch(r'\s*y=(.+)', clean(label))[1]))
    expected = {'amplitude': abs(A), 'period': 2 * PI / B, 'maximum value': K + abs(A), 'minimum value': K - abs(A)}[kind]
    return pick(public, expected, number_label)


def shift_label(label):
    match = re.fullmatch(r'\s*(.+?) to the (left|right)\s*', clean(label))
    require(match is not None, f'Shift label expected: {label}')
    return ev(match[1]) * (1 if match[2] == 'right' else -1)


# ------------------------------------------------------- inverse trig
def solve_inverse(public):
    prompt = clean(public['prompt'])
    match = re.fullmatch(r'Find the exact value of (.+?)(?: in radians)?\.', prompt)
    require(match is not None, 'Unrecognised inverse-trig prompt')
    expression = match[1]
    if 'in radians' in prompt:
        require(expression.startswith('\\arc'), 'Radian answer needs an inverse function outermost')
    else:
        require(not expression.startswith('\\arc'), 'Plain value must not be an inverse function')
    return pick(public, ev(expression), number_label)


# ------------------------------------------------------- equations
def solutions(name, value, lo, hi, k=1):
    """All x in [lo, hi) with name(k x) = value, from principal branches plus periods."""
    if name == 'tan':
        bases, period = [math.atan(value)], PI
    else:
        if abs(value) > 1 + 1e-12:
            return []
        value = max(-1.0, min(1.0, value))
        bases = [math.asin(value), PI - math.asin(value)] if name == 'sin' else [math.acos(value), -math.acos(value)]
        period = 2 * PI
    found = []
    for base in bases:
        for m in range(-40, 41):
            x = (base + m * period) / k
            if lo - 1e-9 <= x < hi - 1e-9 and abs(FUNCTIONS[name](k * x) - value) < 1e-7:
                found.append(x)
    return sorted_set(found)


def read_interval(text):
    match = re.search(r'with (.+?)\\le x<(.+?)(?:\?|\.)?$', text)
    require(match is not None, 'Interval missing')
    lo, hi = ev(match[1]), ev(match[2])
    degrees = 'circ' in match[1]
    require(degrees == ('circ' in match[2]), 'Mixed interval units')
    return lo, hi, degrees


def solve_equation(public):
    prompt = clean(public['prompt'])
    lo, hi, degrees = read_interval(prompt)
    require(close(hi - lo, 2 * PI) and close(lo, 0), 'Interval is not one turn from zero')
    count = re.fullmatch(r'How many solutions does \\(sin|cos|tan)\s*(?:(\(.+?\))|x)\s*=\s*(.+?) have with .*', prompt)
    if count:
        k = 1.0
        if count[2]:
            argument = re.fullmatch(r'\((\d+)x\)', count[2])
            require(argument is not None, 'Argument must be kx')
            k = float(argument[1])
        n = len(solutions(count[1], ev(count[3]), lo, hi, k))

        def parse_count(label):
            require(re.fullmatch(r'\s*\d+\s*', clean(label)) is not None, 'Count label expected')
            return float(clean(label))
        return pick(public, float(n), parse_count)
    solve = re.fullmatch(r'Solve (.+?) for all x with .*', prompt)
    require(solve is not None, 'Unrecognised equation prompt')
    left, right = solve[1].split('=')
    function = re.search(r'\\(sin|cos|tan)\s*x', left)
    require(function is not None, 'Trig term missing')
    reduced = re.sub(r'\\(sin|cos|tan)\s*x(?![A-Za-z])', ' X ', left)
    f0, f1 = ev(reduced, 0.0), ev(reduced, 1.0)
    slope, intercept = f1 - f0, f0
    require(abs(slope) > EPS, 'No trig term')
    target = (ev(right) - intercept) / slope
    found = solutions(function[1], target, lo, hi)

    def parse_list(label):
        parts = [p for p in re.split(r',\s*', clean(label).replace('\\ ', ' ').strip()) if p.strip()]
        require(all(('circ' in p) == degrees or ev(p) == 0 for p in parts), 'List units disagree with the interval')
        values = [ev(p) for p in parts]
        require(len(values) == len(sorted_set(values)), 'Repeated solution in a list')
        return sorted_set(values)
    return pick(public, found, parse_list)


# ------------------------------------------------------- identities
def solve_identity(public):
    prompt = clean(public['prompt'])
    exact = re.fullmatch(r'Find the exact value of \\(sin|cos)\((.+)\)\.', prompt)
    if exact:
        return pick(public, FUNCTIONS[exact[1]](ev(exact[2])), number_label)
    cofunction = re.fullmatch(r'If \\(sin|cos)\((.+)\)=\\(sin|cos)\(k\) and (.+)<k<(.+), what is k\?', prompt)
    if cofunction:
        require(cofunction[1] != cofunction[3], 'Cofunction pair must differ')
        value = FUNCTIONS[cofunction[1]](ev(cofunction[2]))
        k = math.acos(value) if cofunction[3] == 'cos' else math.asin(value)
        require(ev(cofunction[4]) < k < ev(cofunction[5]), 'Cofunction angle outside the stated interval')
        return pick(public, k, number_label)
    given = re.fullmatch(r'Given \\(sin|cos)\\theta=(-?[\d\\frac{}]+) and (.+), find \\(sin|cos|tan)\\theta\.', prompt)
    require(given is not None, 'Unrecognised identity prompt')
    v = ev(given[2])
    other = math.sqrt(1 - v * v)
    condition = given[3]
    quadrant = re.fullmatch(r'\\theta is in quadrant (I|II|III|IV)', condition)
    if quadrant:
        sin_sign, cos_sign = {'I': (1, 1), 'II': (1, -1), 'III': (-1, -1), 'IV': (-1, 1)}[quadrant[1]]
    else:
        sign_condition = re.fullmatch(r'\\(sin|cos)\\theta([<>])0', condition)
        require(sign_condition is not None, 'Unrecognised sign condition')
        sign = 1 if sign_condition[2] == '>' else -1
        sin_sign = sign if sign_condition[1] == 'sin' else None
        cos_sign = sign if sign_condition[1] == 'cos' else None
    if given[1] == 'sin':
        s = v
        require(cos_sign is not None, 'Condition must fix the unknown sign')
        c = cos_sign * other
        require(sin_sign is None or math.copysign(1, v) == sin_sign, 'Conflicting sign data')
    else:
        c = v
        require(sin_sign is not None, 'Condition must fix the unknown sign')
        s = sin_sign * other
        require(cos_sign is None or math.copysign(1, v) == cos_sign, 'Conflicting sign data')
    expected = {'sin': s, 'cos': c, 'tan': s / c}[given[4]]
    return pick(public, expected, number_label)


# ------------------------------------------------------- triangles
TIE = 1e-6


def not_tie(value, step):
    """Reject rounding on a knife edge, where the printed answer would be arguable."""
    frac = (value / step) % 1
    require(abs(frac - 0.5) > TIE / step, f'Rounding tie at {value}')


def nearest(value, step):
    not_tie(value, step)
    return round(value / step) * step


def decimal(label):
    return ev(label)


def degrees_label(label):
    text = clean(label)
    require(re.fullmatch(r'\s*\d+(\.\d+)?\^\\circ\s*', text) is not None, 'Whole-degree label expected')
    return ev(text) * 180 / PI


def triangle_count(A, a, b):
    """Triangles with angle A (radians), opposite side a and adjacent side b."""
    s = b * math.sin(A) / a
    if s > 1 + 1e-9:
        return 0
    if s > 1 - 1e-9:
        return 1 if A < PI / 2 - 1e-9 else 0
    B = math.asin(s)
    return sum(1 for angle in (B, PI - B) if A + angle < PI - 1e-9)


def solve_oblique(public):
    prompt = clean(public['prompt'])
    ssa = re.fullmatch(r'In triangle \$?ABC\$?, A=(\d+)\^\\circ, a=(\d+) units and b=(\d+) units\. How many different triangles have these measurements\?', prompt)
    if ssa:
        A, a, b = math.radians(int(ssa[1])), int(ssa[2]), int(ssa[3])
        height = b * math.sin(A)
        require(abs(a - height) > 1e-6 or abs(a - height) < 1e-9, 'Near-miss boundary')
        count = triangle_count(A, a, b)
        names = {'No triangle': 0, 'Exactly one triangle': 1, 'Two different triangles': 2}
        options = labels(public)
        require(len({o['label'] for o in options}) == 4, 'Duplicate count labels')
        hits = [o['id'] for o in options if names.get(o['label']) == count]
        require(len(hits) == 1, 'Triangle-count choice missing')
        return hits[0]
    aas = re.fullmatch(r'In triangle ABC, A=(\d+)\^\\circ, B=(\d+)\^\\circ and a=(\d+) units \(side a is opposite A\)\. Find side b to the nearest tenth\.', prompt)
    if aas:
        A, B, a = math.radians(int(aas[1])), math.radians(int(aas[2])), int(aas[3])
        require(A + B < PI, 'Impossible angles')
        return pick(public, nearest(a * math.sin(B) / math.sin(A), 0.1), decimal)
    angle_b = re.fullmatch(r'In triangle ABC, A=(\d+)\^\\circ, a=(\d+) units and b=(\d+) units\. Find angle B to the nearest degree\.', prompt)
    if angle_b:
        A, a, b = math.radians(int(angle_b[1])), int(angle_b[2]), int(angle_b[3])
        require(triangle_count(A, a, b) == 1, 'Angle B is not unique')
        B = math.asin(b * math.sin(A) / a)
        if A + (PI - B) < PI - 1e-9:
            B = PI - B
        return pick(public, nearest(math.degrees(B), 1), degrees_label)
    sas = re.fullmatch(r'In triangle ABC, a=(\d+) units, b=(\d+) units and the angle between them is C=(\d+)\^\\circ\. Find side c to the nearest tenth\.', prompt)
    if sas:
        a, b, C = int(sas[1]), int(sas[2]), math.radians(int(sas[3]))
        return pick(public, nearest(math.sqrt(a * a + b * b - 2 * a * b * math.cos(C)), 0.1), decimal)
    sss = re.fullmatch(r'A triangle has sides a=(\d+), b=(\d+) and c=(\d+) units\. Find the angle C opposite side c to the nearest degree\.', prompt)
    require(sss is not None, 'Unrecognised oblique prompt')
    a, b, c = (int(sss[i]) for i in (1, 2, 3))
    require(a + b > c and a + c > b and b + c > a, 'Triangle inequality fails')
    return pick(public, nearest(math.degrees(math.acos((a * a + b * b - c * c) / (2 * a * b))), 1), degrees_label)


def solve_area(public):
    prompt = clean(public['prompt'])
    rounded = re.fullmatch(r'A triangle has sides (\d+) units and (\d+) units with an included angle of (\d+)\^\\circ\. Find its area to the nearest tenth of a square unit\.', prompt)
    if rounded:
        a, b, C = int(rounded[1]), int(rounded[2]), math.radians(int(rounded[3]))
        return pick(public, nearest(0.5 * a * b * math.sin(C), 0.1), decimal)
    compare = re.fullmatch(r'Triangle 1 has sides (\d+) and (\d+) units with included angle (\d+)\^\\circ\. Triangle 2 has the same two side lengths with included angle (\d+)\^\\circ\. How do their areas compare\?', prompt)
    if compare:
        s = int(compare[1]) * int(compare[2]) / 2
        first, second = s * math.sin(math.radians(int(compare[3]))), s * math.sin(math.radians(int(compare[4])))
        verdict = 'equal' if abs(first - second) < 1e-9 else ('first' if first > second else 'second')
        names = {'The two areas are equal': 'equal', 'The first triangle has the greater area': 'first',
                 'The second triangle has the greater area': 'second'}
        options = labels(public)
        require(len({o['label'] for o in options}) == 4, 'Duplicate comparison labels')
        hits = [o['id'] for o in options if names.get(clean(o['label'])) == verdict]
        require(len(hits) == 1, 'Comparison choice missing')
        require(any(clean(o['label']) == 'They cannot be compared without the third side' for o in options), 'Unexpected comparison set')
        return hits[0]
    exact = re.fullmatch(r'Two sides of a triangle measure (\d+) units and (\d+) units, and the angle between them is (\d+)\^\\circ\. What is the exact area in square units\?', prompt)
    if exact:
        a, b, C = int(exact[1]), int(exact[2]), math.radians(int(exact[3]))
        return pick(public, 0.5 * a * b * math.sin(C), number_label)
    side = re.fullmatch(r'A triangle has area (.+?) square units\. Two sides are a and b=(\d+) units, and the angle between them is C=(\d+)\^\\circ\. Find a\.', prompt)
    require(side is not None, 'Unrecognised area prompt')
    area, b, C = ev(side[1]), int(side[2]), math.radians(int(side[3]))
    return pick(public, 2 * area / (b * math.sin(C)), number_label)


# ------------------------------------------------------- sinusoid model
def read_function(label):
    match = re.fullmatch(r'h\(t\)=(-?\d*)\\(sin|cos)\((.+)t\)([+-]\d+)?', clean(label).replace(' ', ''))
    require(match is not None, f'Unreadable model {label}')
    A = {'': 1, '-': -1}.get(match[1])
    if A is None:
        A = int(match[1])
    return A, match[2], ev(match[3]), int(match[4] or 0)


def solve_model(public):
    text = public['prompt']
    prompt = clean(text)
    evaluate = re.fullmatch(r'The height in (?:feet|meters) of a (?:tide|rider on a wheel) is modeled by (h\(t\)=.+?), where t is in (?:hours|minutes)\. What is h\((\d+)\)\?', prompt)
    if evaluate:
        A, name, B, K = read_function(evaluate[1])
        t = int(evaluate[2])
        return pick(public, K + A * FUNCTIONS[name](B * t), number_label)
    period = re.fullmatch(r'A sinusoidal model y=A\\sin\(Bt\)\+k has period (\d+) \(in the same units as t\)\. What is B\?', prompt)
    if period:
        return pick(public, 2 * PI / int(period[1]), number_label)
    extremes = re.fullmatch(r'A periodic quantity has a maximum of (\d+) and a minimum of (\d+)\. What is the (amplitude|equation of the midline) of a sinusoidal model of it\?', prompt)
    if extremes:
        hi, lo = int(extremes[1]), int(extremes[2])
        require(hi > lo, 'Maximum must exceed minimum')
        if extremes[3] == 'amplitude':
            return pick(public, (hi - lo) / 2, number_label)
        return pick(public, (hi + lo) / 2, lambda label: ev(re.fullmatch(r'\s*y=(.+)', clean(label))[1]))
    # Narrative: build the intended wave from the stated extremes, period and start behaviour.
    require('t=0' in prompt, 'Start time must be t=0')
    numbers = [int(n) for n in re.findall(r'(?<![\w=])(\d+)(?= (?:meters?|cm|feet|seconds|minutes|hours))', prompt)]
    require(len(numbers) == 3, f'Expected two heights and a period, found {numbers}')
    hi, lo, P = max(numbers[:2]), min(numbers[:2]), numbers[2]
    require(hi > lo, 'Flat wave')
    mid, amp = (hi + lo) / 2, (hi - lo) / 2
    if 'midpoint' in prompt:
        require('moving upward' in prompt, 'Direction must be stated')
        expected = lambda t: mid + amp * math.sin(2 * PI * t / P)
    elif re.search(r'boards at the lowest point, (\d+) ', prompt):
        require(int(re.search(r'lowest point, (\d+) ', prompt)[1]) == lo, 'Start height is not the minimum')
        expected = lambda t: mid - amp * math.cos(2 * PI * t / P)
    elif re.search(r'highest position, (\d+) cm, at t=0|At t=0 hours the tide is at its highest, (\d+) feet', prompt):
        expected = lambda t: mid + amp * math.cos(2 * PI * t / P)
    else:
        raise ValueError('Unrecognised start behaviour')
    options = labels(public)
    values = [read_function(o['label']) for o in options]
    for i in range(4):
        for j in range(i):
            require(not close(values[i][2:], values[j][2:]) or values[i][:2] != values[j][:2] or values[i][3] != values[j][3], 'Duplicate model choices')
    hits = []
    for option, (A, name, B, K) in zip(options, values):
        if all(abs(K + A * FUNCTIONS[name](B * t) - expected(t)) < 1e-7 for t in [i * P / 16 for i in range(33)]):
            hits.append(option['id'])
    require(len(hits) == 1, 'Model choice missing or ambiguous')
    return hits[0]


SOLVERS = {
    'special-angle-exact-value': solve_special,
    'trig-symmetry-value': solve_symmetry,
    'sinusoid-parameters': solve_sinusoid_parameters,
    'inverse-trig-value': solve_inverse,
    'trig-equation-solutions': solve_equation,
    'trig-identity-value': solve_identity,
    'oblique-triangle-solve': solve_oblique,
    'trig-triangle-area': solve_area,
    'sinusoid-model': solve_model,
}


def solve(public):
    template = public['templateId']
    require(template in SUPPORTED, 'Unexpected trigonometry family')
    if template == 'oblique-triangle-solve':
        check_figure_givens(public, require)
    else:
        require((public.get('figure') is not None) == (public['prompt'].startswith('Which equation matches the graph')),
                'Diagram present only for graph-reading prompts')
    return SOLVERS[template](public)


def review_problem(problem):
    public = problem['public']
    result = solve(public)
    require(result == problem['answer'], 'Trigonometry answer key mismatch')
    correct = clean(next(o['label'] for o in public['response']['options'] if o['id'] == result)).strip()
    hint = clean(problem.get('hint', ''))
    # A hint may mention range bounds or periods; it must not assert the answer.
    asserted = re.search(r'(?:=|\bis|\bequals|\banswer)\s*' + re.escape(correct) + r'(?![\w\\{}]|\.\d)', hint) if len(correct) > 2 else None
    require(asserted is None, 'Hint gives away the answer')
    feedback = problem.get('choiceFeedback') or {}
    require(result not in feedback, 'Feedback attached to the correct choice')
    require(all(key in {o['id'] for o in public['response']['options']} for key in feedback), 'Feedback for unknown choice')
    return result


# ------------------------------------------------------- self test
def option_list(labels_):
    return [{'id': f'option-{"abcd"[i]}', 'label': f'${label}$' if not label[0].isupper() else label} for i, label in enumerate(labels_)]


GRAPH = {'kind': 'scene', 'scene': {'v': 1, 'title': 'A sinusoidal graph', 'elements': [
    {'type': 'graph', 'x': [0, 16], 'y': [-4, 0], 'grid': [4, 1], 'tick': [4, 1], 'labels': 'auto',
     'curves': [{'fn': {'f': 'sin', 'a': 1, 'b': PI / 4, 'k': -2}}]}]}}

# (template, prompt, labels with the hand-checked correct one first, replacement prompt that breaks it, figure)
FIXTURES = [
    ('special-angle-exact-value', r'Find the exact value of $\cos\left(\frac{5\pi}{4}\right)$ (angle in radians).',
     [r'-\frac{\sqrt{2}}{2}', r'\frac{\sqrt{2}}{2}', r'-\frac{\sqrt{3}}{2}', '-1'], r'\frac{5\pi}{4}', r'\frac{\pi}{4}', None),
    ('special-angle-exact-value', r'The terminal side of the angle $\theta=225^\circ$ meets the unit circle at a point $(x,y)$. Which point is it?',
     [r'(-\frac{\sqrt{2}}{2},\ -\frac{\sqrt{2}}{2})', r'(\frac{\sqrt{2}}{2},\ -\frac{\sqrt{2}}{2})', r'(-\frac{1}{2},\ -\frac{\sqrt{3}}{2})', r'(-\frac{\sqrt{2}}{2},\ \frac{\sqrt{2}}{2})'], '225', '315', None),
    ('special-angle-exact-value', r'What is $\tan\left(90^\circ\right)$? If it has no value, choose the answer that says so.',
     ['Undefined', '0', '1', r'\sqrt{3}'], '90', '45', None),
    ('trig-symmetry-value', r'Given $\sin\theta=0.28$ with $\theta$ acute, find $\tan\left(-\theta-\pi\right)$.',
     [r'-\frac{7}{24}', r'\frac{7}{24}', r'-\frac{24}{7}', r'\frac{24}{7}'], '0.28', '0.6', None),
    ('trig-symmetry-value', r'Given $\sin\theta=0.6$, find $\sin\left(\pi-\theta\right)$.',
     ['0.6', '-0.6', '0.8', '-0.8'], r'\pi-\theta', r'-\theta', None),
    ('sinusoid-parameters', r'What is the amplitude of $y=-3\sin\left(\frac{1}{3}x\right)+6$?',
     ['3', '-3', '6', '1'], '-3', '-5', None),
    ('sinusoid-parameters', r'What is the period of $y=4\sin\left(4x\right)+6$?',
     [r'\frac{\pi}{2}', r'2\pi', r'8\pi', r'\frac{\pi}{4}'], '4x', '2x', None),
    ('sinusoid-parameters', r'Find the horizontal shift of $y=5\sin\left(2x+\pi\right)-3$.',
     [r'\frac{\pi}{2}$ to the left', r'\frac{\pi}{2}$ to the right', r'2\pi$ to the left', r'\pi$ to the left'], '+\\pi', '-\\pi', None),
    ('sinusoid-parameters', r'Which equation matches the graph? Every choice has the form $y=A\sin(Bx)+k$.',
     [r'y=\sin\left(\frac{\pi}{4}\,x\right)-2', r'y=-\sin\left(\frac{\pi}{4}\,x\right)-2', r'y=\sin\left(\frac{\pi}{8}\,x\right)-2', r'y=\sin\left(\frac{\pi}{4}\,x\right)'], 'form', 'form', GRAPH),
    ('inverse-trig-value', r'Find the exact value of $\arccos\left(-\frac{\sqrt{3}}{2}\right)$ in radians.',
     [r'\frac{5\pi}{6}', r'\frac{\pi}{6}', r'-\frac{\pi}{6}', r'-\frac{5\pi}{6}'], r'-\frac{\sqrt{3}}{2}', r'\frac{\sqrt{3}}{2}', None),
    ('inverse-trig-value', r'Find the exact value of $\arcsin\left(\sin\left(\frac{3\pi}{4}\right)\right)$ in radians.',
     [r'\frac{\pi}{4}', r'\frac{3\pi}{4}', r'-\frac{\pi}{4}', r'\frac{\pi}{2}'], r'\frac{3\pi}{4}\right)\right)', r'\frac{5\pi}{4}\right)\right)', None),
    ('trig-equation-solutions', r'Solve $2\cos\,x=1$ for all $x$ with $0\le x<2\pi$.',
     [r'\frac{\pi}{3},\ \frac{5\pi}{3}', r'\frac{\pi}{3}', r'\frac{\pi}{6},\ \frac{5\pi}{6}', r'\frac{2\pi}{3},\ \frac{4\pi}{3}'], '=1', '=-1', None),
    ('trig-equation-solutions', r'How many solutions does $\cos\left(2x\right)=-1$ have with $0\le x<2\pi$?',
     ['2', '1', '4', '3'], '-1', '3', None),
    ('trig-equation-solutions', r'Solve $\tan x=1$ for all $x$ with $0^\circ\le x<360^\circ$.',
     [r'45^\circ,\ 225^\circ', r'45^\circ', r'135^\circ,\ 315^\circ', r'45^\circ,\ 135^\circ'], '=1', '=-1', None),
    ('trig-equation-solutions', r'How many solutions does $\sin\,x=1$ have with $0\le x<2\pi$?',
     ['1', '2', '0', '4'], '=1', '=0.5', None),
    ('trig-identity-value', r'Find the exact value of $\sin\left(105^\circ\right)$.',
     [r'\frac{\sqrt{6}+\sqrt{2}}{4}', r'\frac{\sqrt{6}-\sqrt{2}}{4}', r'-\frac{\sqrt{6}+\sqrt{2}}{4}', r'\frac{\sqrt{6}+\sqrt{2}}{2}'], '105', '15', None),
    ('trig-identity-value', r'If $\sin\left(\frac{\pi}{3}\right)=\cos(k)$ and $0<k<\frac{\pi}{2}$, what is $k$?',
     [r'\frac{\pi}{6}', r'\frac{\pi}{3}', r'\frac{\pi}{4}', r'\frac{\pi}{2}'], r'\frac{\pi}{3}\right)', r'\frac{\pi}{6}\right)', None),
    ('trig-identity-value', r'Given $\cos\theta=\frac{5}{13}$ and $\sin\theta<0$, find $\sin\theta$.',
     [r'-\frac{12}{13}', r'\frac{12}{13}', r'-\frac{5}{13}', r'-\frac{12}{5}'], '<0', '>0', None),
    ('oblique-triangle-solve', r'In triangle $ABC$, $A=30^\circ$, $a=5$ units and $b=10$ units. How many different triangles have these measurements?',
     ['Exactly one triangle', 'No triangle', 'Two different triangles', 'Not enough information'], 'a=5', 'a=4', None),
    ('oblique-triangle-solve', r'In triangle $ABC$, $A=35^\circ$, $a=15$ units and $b=18$ units. How many different triangles have these measurements?',
     ['Two different triangles', 'Exactly one triangle', 'No triangle', 'Not enough information'], 'a=15', 'a=9', None),
    ('oblique-triangle-solve', r'In triangle $ABC$, $A=122^\circ$, $a=18$ units and $b=7$ units. Find angle $B$ to the nearest degree.',
     [r'19^\circ', r'20^\circ', r'161^\circ', r'18^\circ'], 'b=7', 'b=9', None),
    ('oblique-triangle-solve', r'In triangle $ABC$, $a=5$ units, $b=10$ units and the angle between them is $C=48^\circ$. Find side $c$ to the nearest tenth.',
     ['7.6', '7.5', '8.2', '10.0'], '48', '60', None),
    ('oblique-triangle-solve', r'A triangle has sides $a=15$, $b=9$ and $c=14$ units. Find the angle $C$ opposite side $c$ to the nearest degree.',
     [r'66^\circ', r'65^\circ', r'114^\circ', r'60^\circ'], 'c=14', 'c=12', None),
    ('trig-triangle-area', r'A triangle has sides 10 units and 6 units with an included angle of $38^\circ$. Find its area to the nearest tenth of a square unit.',
     ['18.5', '36.9', '23.6', '30.0'], '38', '58', None),
    ('trig-triangle-area', r'Two sides of a triangle measure 7 units and 12 units, and the angle between them is $45^\circ$. What is the exact area in square units?',
     [r'21\sqrt{2}', r'42\sqrt{2}', '42', r'21'], '45', '30', None),
    ('trig-triangle-area', r'Triangle 1 has sides 7 and 6 units with included angle $90^\circ$. Triangle 2 has the same two side lengths with included angle $135^\circ$. How do their areas compare?',
     ['The first triangle has the greater area', 'The second triangle has the greater area', 'The two areas are equal', 'They cannot be compared without the third side'], '90', '30', None),
    ('trig-triangle-area', r'A triangle has area $21\sqrt{3}$ square units. Two sides are $a$ and $b=7$ units, and the angle between them is $C=120^\circ$. Find $a$.',
     ['12', '6', '24', '14'], '21', '14', None),
    ('sinusoid-model', r'A Ferris wheel rider boards at the lowest point, 11 meters above the ground, at $t=0$ minutes. The highest point is 21 meters, and one turn takes 8 minutes. Which function models the rider\'s height $h(t)$ in meters?',
     [r'h(t)=-5\cos\left(\frac{\pi}{4}t\right)+16', r'h(t)=5\cos\left(\frac{\pi}{4}t\right)+16', r'h(t)=-5\cos\left(\frac{\pi}{8}t\right)+16', r'h(t)=-5\sin\left(\frac{\pi}{4}t\right)+16'], '11 meters', '21 meters', None),
    ('sinusoid-model', r'A buoy bobs between 9 cm and 25 cm above the sea floor. At $t=0$ seconds it passes through the midpoint of that range moving upward, and it completes a cycle every 24 seconds. Which function models its height $h(t)$ in cm?',
     [r'h(t)=8\sin\left(\frac{\pi}{12}t\right)+17', r'h(t)=8\cos\left(\frac{\pi}{12}t\right)+17', r'h(t)=-8\sin\left(\frac{\pi}{12}t\right)+17', r'h(t)=8\sin\left(\frac{\pi}{24}t\right)+17'], '24 seconds', '12 seconds', None),
    ('sinusoid-model', r'The height in feet of a tide is modeled by $h(t)=6\cos\left(\frac{\pi}{12}t\right)+13$, where $t$ is in hours. What is $h(4)$?',
     ['16', '19', '10', '13'], '(4)', '(6)', None),
    ('sinusoid-model', r'A sinusoidal model $y=A\sin(Bt)+k$ has period 24 (in the same units as $t$). What is $B$?',
     [r'\frac{\pi}{12}', r'\frac{\pi}{24}', r'\frac{\pi}{6}', r'12\pi'], 'period 24', 'period 12', None),
    ('sinusoid-model', r'A periodic quantity has a maximum of 28 and a minimum of 8. What is the equation of the midline of a sinusoidal model of it?',
     ['y=18', 'y=10', 'y=20', 'y=28'], 'of 28', 'of 30', None),
]


def self_test():
    rejected = 0

    def reject(problem):
        nonlocal rejected
        try:
            review_problem(problem)
        except (ValueError, KeyError, TypeError, ZeroDivisionError, IndexError, StopIteration):
            rejected += 1
            return
        raise ValueError('Corrupt trigonometry problem was accepted')

    for template, prompt, texts, target, replacement, figure in FIXTURES:
        texts = [t if not t.endswith('$ to the left') and not t.endswith('$ to the right') else t for t in texts]
        options = [{'id': f'option-{"abcd"[i]}', 'label': (f'${t}' if '$ to the' in t else (t if t[0].isupper() else f'${t}$'))} for i, t in enumerate(texts)]
        public = {'templateId': template, 'prompt': prompt, 'response': {'kind': 'choice', 'options': options}}
        if figure:
            public['figure'] = figure
        problem = {'public': public, 'answer': 'option-a', 'hint': 'Work it out.', 'choiceFeedback': {'option-b': 'Check.'}}
        require(review_problem(problem) == 'option-a', 'Fixture rejected')
        bad = copy.deepcopy(problem)
        bad['answer'] = 'option-b'
        reject(bad)
        bad = copy.deepcopy(problem)
        bad['public']['response']['options'][1]['label'] = options[0]['label']
        reject(bad)
        bad = copy.deepcopy(problem)
        bad['public']['response']['options'][0]['label'] = options[2]['label'] if options[2]['label'] != options[0]['label'] else options[3]['label']
        bad['public']['response']['options'][2]['label'] = options[1]['label']
        reject(bad)  # correct choice removed or duplicated
        bad = copy.deepcopy(problem)
        bad['hint'] = 'The answer is ' + options[0]['label'] + '.'
        if len(clean(options[0]['label']).strip()) > 2:
            reject(bad)
        if figure:
            bad = copy.deepcopy(problem)
            bad['public']['figure']['scene']['elements'][0]['curves'][0]['fn']['k'] = -1
            reject(bad)
            bad = copy.deepcopy(problem)
            bad['public']['figure']['scene']['elements'][0]['y'] = [-2.5, 0]
            reject(bad)
        elif target != replacement:
            bad = copy.deepcopy(problem)
            require(target in bad['public']['prompt'], f'Fixture mutation target missing: {target}')
            bad['public']['prompt'] = bad['public']['prompt'].replace(target, replacement, 1)
            reject(bad)
    return {'fixtures': len(FIXTURES), 'rejectedMutations': rejected}


if __name__ == '__main__':
    print(self_test())
