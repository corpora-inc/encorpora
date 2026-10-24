"""Independent review of complex-plane, polar, parametric and conic practice.

Everything is derived from the public payload (prompt, choices, figure). Values live
in exact arithmetic: Q(sqrt n, i) numbers (dict of squarefree radicand and imaginary
flag to Fraction) inside small polynomials over x, y, t. Special-angle trig is exact.
"""
import copy
import json
import math
import re
from fractions import Fraction

SUPPORTED = frozenset({
    'complex-plane-forms', 'complex-conjugate-division', 'complex-distance-midpoint',
    'complex-quadratic-factors', 'polynomial-root-count', 'polar-cartesian-conversion',
    'parametric-linear-motion', 'conic-standard-form', 'parabola-focus-directrix',
})
CHOICE = SUPPORTED
VARS = ('x', 'y', 't')


def require(condition, message):
    if not condition:
        raise ValueError(message)


def plain(text):
    text = text.replace('$', '').replace('\u2212', '-').replace('\\dfrac', '\\frac')
    text = text.replace('\\left', '').replace('\\right', '').replace('\\,', '')
    return text


# ---------------------------------------------------------------- exact numbers
def split_square(n):
    """n = s*s*m with m squarefree."""
    s, m, p = 1, n, 2
    while p * p <= m:
        while m % (p * p) == 0:
            m //= p * p
            s *= p
        p += 1
    return s, m


class Num:
    __slots__ = ('t',)

    def __init__(self, terms=None):
        self.t = {k: v for k, v in (terms or {}).items() if v != 0}

    @staticmethod
    def const(value):
        return Num({(1, 0): Fraction(value)})

    @staticmethod
    def sqrt_int(n):
        require(n >= 0, 'square root of a negative')
        s, m = split_square(n)
        return Num({(m, 0): Fraction(s)})

    @staticmethod
    def sqrt_frac(q):
        q = Fraction(q)
        require(q >= 0, 'square root of a negative')
        root = Num.sqrt_int(q.numerator * q.denominator)
        return root * Num.const(Fraction(1, q.denominator))

    def __add__(self, other):
        out = dict(self.t)
        for k, v in other.t.items():
            out[k] = out.get(k, 0) + v
        return Num(out)

    def __neg__(self):
        return Num({k: -v for k, v in self.t.items()})

    def __sub__(self, other):
        return self + (-other)

    def __mul__(self, other):
        out = {}
        for (n1, i1), v1 in self.t.items():
            for (n2, i2), v2 in other.t.items():
                s, m = split_square(n1 * n2)
                coef = v1 * v2 * s
                if i1 and i2:
                    coef = -coef
                key = (m, (i1 + i2) % 2)
                out[key] = out.get(key, 0) + coef
        return Num(out)

    def key(self):
        return tuple(sorted(self.t.items()))

    def __eq__(self, other):
        return isinstance(other, Num) and self.key() == other.key()

    def __hash__(self):
        return hash(self.key())

    def is_zero(self):
        return not self.t

    def is_rational(self):
        return all(k == (1, 0) for k in self.t)

    def rational(self):
        require(self.is_rational(), 'Expected a rational value')
        return self.t.get((1, 0), Fraction(0))

    def real(self):
        return all(k[1] == 0 for k in self.t)

    def conj(self):
        return Num({k: (-v if k[1] else v) for k, v in self.t.items()})

    def inverse(self):
        require(not self.is_zero(), 'Division by zero')
        if self.real():
            # Only rational or single-radical values occur; handle those exactly.
            if self.is_rational():
                return Num.const(1 / self.rational())
            require(len(self.t) == 1, 'Unsupported divisor')
            (m, _), v = next(iter(self.t.items()))
            return Num({(m, 0): 1 / (v * m)})
        require(all(k[0] == 1 for k in self.t), 'Unsupported complex divisor')
        norm = self * self.conj()
        return self.conj() * Num.const(1 / norm.rational())

    def float(self):
        require(self.real(), 'Complex value has no real ordering')
        return sum(float(v) * math.sqrt(k[0]) for k, v in self.t.items())

    def parts(self):
        re_part = Num({(k[0], 0): v for k, v in self.t.items() if not k[1]})
        im_part = Num({(k[0], 0): v for k, v in self.t.items() if k[1]})
        return re_part, im_part


ZERO, ONE, I = Num(), Num.const(1), Num({(1, 1): Fraction(1)})


def rat(value):
    return Num.const(value)


# ------------------------------------------------------------------ polynomials
class Poly:
    """Multivariate polynomial in x, y, t with Num coefficients."""

    def __init__(self, terms=None):
        self.t = {k: v for k, v in (terms or {}).items() if not v.is_zero()}

    @staticmethod
    def const(num):
        return Poly({(0, 0, 0): num})

    @staticmethod
    def var(name):
        e = [0, 0, 0]
        e[VARS.index(name)] = 1
        return Poly({tuple(e): ONE})

    def __add__(self, other):
        out = dict(self.t)
        for k, v in other.t.items():
            out[k] = out[k] + v if k in out else v
        return Poly(out)

    def scale(self, num):
        return Poly({k: v * num for k, v in self.t.items()})

    def __neg__(self):
        return self.scale(rat(-1))

    def __sub__(self, other):
        return self + (-other)

    def __mul__(self, other):
        out = {}
        for k1, v1 in self.t.items():
            for k2, v2 in other.t.items():
                k = tuple(a + b for a, b in zip(k1, k2))
                out[k] = out[k] + v1 * v2 if k in out else v1 * v2
        return Poly(out)

    def power(self, n):
        require(n >= 0, 'Negative exponent')
        out = Poly.const(ONE)
        for _ in range(n):
            out = out * self
        return out

    def constant(self):
        require(all(k == (0, 0, 0) for k in self.t), 'Expected a constant')
        return self.t.get((0, 0, 0), ZERO)

    def coef(self, i, j=0, k=0):
        return self.t.get((i, j, k), ZERO)

    def degree(self, index=0):
        return max((k[index] for k in self.t), default=0)

    def key(self):
        return tuple(sorted((k, v.key()) for k, v in self.t.items()))

    def __eq__(self, other):
        return self.key() == other.key()

    def evaluate(self, **values):
        total = ZERO
        for k, v in self.t.items():
            term = v
            for name, e in zip(VARS, k):
                for _ in range(e):
                    term = term * values[name]
            total = total + term
        return total


TOKEN = re.compile(r'\\[a-zA-Z]+|\d+|[a-z]|[-+^{}()=,]')


def tokenize(text):
    text = re.sub(r'\s+', '', plain(text))
    tokens = TOKEN.findall(text)
    require(''.join(tokens) == text, f'Unreadable math: {text}')
    return tokens


class Parser:
    def __init__(self, tokens):
        self.tokens, self.pos = tokens, 0

    def peek(self):
        return self.tokens[self.pos] if self.pos < len(self.tokens) else None

    def take(self, expected=None):
        token = self.peek()
        require(token is not None and (expected is None or token == expected), f'Expected {expected}, found {token}')
        self.pos += 1
        return token

    def done(self):
        return self.pos == len(self.tokens)

    def expr(self):
        total = self.term(allow_sign=True)
        while self.peek() in ('+', '-'):
            sign = self.take()
            part = self.term(allow_sign=False)
            total = total + part if sign == '+' else total - part
        return total

    def term(self, allow_sign):
        negate = False
        if self.peek() in ('-', '+') and allow_sign or self.peek() == '-':
            negate = self.take() == '-'
        value = self.product()
        return -value if negate else value

    STARTS = re.compile(r'^(\d+|[xyti]|\(|\\sqrt|\\frac)$')

    def product(self):
        value = self.power()
        while self.peek() is not None and self.STARTS.match(self.peek()):
            value = value * self.power()
        return value

    def power(self):
        base = self.atom()
        if self.peek() == '^':
            self.take()
            if self.peek() == '{':
                self.take('{')
                sign = -1 if self.peek() == '-' and self.take() else 1
                n = sign * int(self.take())
                self.take('}')
            else:
                n = int(self.take())
            base = base.power(n)
        return base

    def group(self):
        self.take('{')
        value = self.expr()
        self.take('}')
        return value

    def atom(self):
        token = self.take()
        if token.isdigit():
            return Poly.const(rat(int(token)))
        if token == 'i':
            return Poly.const(I)
        if token in VARS:
            return Poly.var(token)
        if token == '(':
            value = self.expr()
            self.take(')')
            return value
        if token == '\\sqrt':
            inner = self.group().constant()
            return Poly.const(Num.sqrt_frac(inner.rational()))
        if token == '\\frac':
            top = self.group()
            bottom = self.group().constant()
            return top.scale(bottom.inverse())
        raise ValueError(f'Unexpected token {token}')


def poly(text):
    parser = Parser(tokenize(text))
    value = parser.expr()
    require(parser.done(), f'Trailing math in {text}')
    return value


def num(text):
    value = poly(text)
    return value.constant()


def equation(text):
    left, _, right = plain(text).partition('=')
    require(right != '', 'Expected an equation')
    return poly(left) - poly(right)


def pair(text):
    """Parse '(a, b)' into two Num values, splitting at the top-level comma."""
    body = plain(text).strip()
    require(body.startswith('(') and body.endswith(')'), f'Expected a pair: {text}')
    body = body[1:-1]
    depth = 0
    for index, ch in enumerate(body):
        depth += ch in '({'
        depth -= ch in ')}'
        if ch == ',' and depth == 0:
            return num(body[:index]), num(body[index + 1:])
    raise ValueError(f'No comma in pair {text}')


def complex_parts(z):
    return z.parts()


# ----------------------------------------------------------------------- trig
def cos_pi(x):
    x = Fraction(x) % 2
    if x > 1:
        x = 2 - x          # cos is even and 2-periodic
    if x > Fraction(1, 2):
        return -cos_pi(1 - x)
    table = {
        Fraction(0): rat(1), Fraction(1, 6): Num({(3, 0): Fraction(1, 2)}),
        Fraction(1, 4): Num({(2, 0): Fraction(1, 2)}), Fraction(1, 3): rat(Fraction(1, 2)),
        Fraction(1, 2): ZERO,
    }
    require(x in table, f'Unsupported angle {x}pi')
    return table[x]


def sin_pi(x):
    return cos_pi(Fraction(1, 2) - Fraction(x))


def angle(text):
    """Parse 0, \\pi, 2\\pi, \\frac{\\pi}{6}, \\frac{5\\pi}{6} as a Fraction of pi."""
    s = re.sub(r'\s+', '', plain(text))
    if s == '0':
        return Fraction(0)
    match = re.fullmatch(r'(\d*)\\pi', s)
    if match:
        return Fraction(int(match[1] or 1))
    match = re.fullmatch(r'\\frac\{(\d*)\\pi\}\{(\d+)\}', s)
    require(match is not None, f'Unreadable angle {text}')
    return Fraction(int(match[1] or 1), int(match[2]))


def polar_point(text):
    body = plain(text).strip()
    require(body.startswith('(') and body.endswith(')'), f'Expected polar pair: {text}')
    body = body[1:-1]
    depth, cut = 0, None
    for index, ch in enumerate(body):
        depth += ch in '({'
        depth -= ch in ')}'
        if ch == ',' and depth == 0:
            cut = index
            break
    require(cut is not None, 'Polar pair needs a comma')
    return num(body[:cut]), angle(body[cut + 1:])


def to_cartesian(r, theta):
    return r * cos_pi(theta), r * sin_pi(theta)


# ------------------------------------------------------------------ shared pieces
def squarefree_label(label):
    """True when radicals are simplified and fractions reduced in a displayed label."""
    text = plain(label)
    for radicand in re.findall(r'\\sqrt\{(\d+)\}', text):
        n = int(radicand)
        if n < 2 or split_square(n)[0] != 1:
            return False
    for top, bottom in re.findall(r'\\frac\{(-?\d+)\}\{(\d+)\}', text):
        if math.gcd(abs(int(top)), int(bottom)) != 1 or int(bottom) < 2:
            return False
    return True


def choices(public):
    response = public['response']
    require(response['kind'] == 'choice', 'Single-choice response required')
    options = response['options']
    require(len(options) == 4 and all(set(o) == {'id', 'label'} for o in options), 'Four public choices required')
    require(len({o['id'] for o in options}) == 4, 'Duplicate choice IDs')
    return options


def pick(public, parse, expected, simplest=False):
    """Return the single option whose parsed value equals expected; options distinct."""
    options = choices(public)
    values = [parse(o['label']) for o in options]
    keys = [v.key() if hasattr(v, 'key') else v for v in values]
    require(len(set(keys)) == 4, 'Mathematically duplicate choices')
    hits = [o['id'] for o, v in zip(options, values) if v == expected]
    require(len(hits) == 1, 'Missing or ambiguous correct choice')
    if simplest:
        label = next(o['label'] for o in options if o['id'] == hits[0])
        require(squarefree_label(label), 'Correct choice is not in simplest form')
    return hits[0]


def pair_key(label):
    a, b = pair(label)
    return (a, b)


def figure_graph(public, point_count, segments=0):
    figure = public.get('figure')
    require(figure and figure['kind'] == 'scene', 'Diagram expected')
    elements = figure['scene']['elements']
    require(len(elements) == 1 and elements[0]['type'] == 'graph', 'One graph expected')
    graph = elements[0]
    points = graph['points']
    require(len(points) == point_count, 'Unexpected number of plotted points')
    for p in points:
        require(graph['x'][0] <= p['x'] <= graph['x'][1] and graph['y'][0] <= p['y'] <= graph['y'][1], 'Point off the axes')
    require(len(graph.get('segments', [])) == segments, 'Unexpected segment count')
    return graph


def complex_value(point):
    return Num({(1, 0): Fraction(point['x']), (1, 1): Fraction(point['y'])})


def math_spans(prompt):
    return re.findall(r'\$(.+?)\$', prompt)


# ---------------------------------------------------------------- per-template solvers
def solve_plane(public):
    prompt = public['prompt']
    if prompt.startswith('The modulus'):
        require(public.get('figure') is None, 'Unexpected diagram')
        match = re.search(r'Find \$\|(.+)\|\$ in simplest exact form\.$', prompt)
        require(match is not None, 'Modulus statement')
        a, b = num(match[1]).parts()
        value = Num.sqrt_int(int(a.rational() ** 2 + b.rational() ** 2))
        return pick(public, num, value, simplest=True)
    if prompt.startswith('The point $P$'):
        require('Write $z$ in the form $a+bi$.' in prompt, 'Rectangular-form request')
        graph = figure_graph(public, 1)
        require(graph['points'][0]['label'] == 'P' and graph.get('tick') == 1, 'Point label/ticks')
        return pick(public, num, complex_value(graph['points'][0]))
    if prompt.startswith('The points $P$ and $Q$'):
        require('Choose $z+w$.' in prompt, 'Sum request')
        graph = figure_graph(public, 2, segments=2)
        labels = [p['label'] for p in graph['points']]
        require(labels == ['P', 'Q'], 'Point labels')
        # Arrows must run from the origin to each plotted point.
        for p, s in zip(graph['points'], graph['segments']):
            require(s['from'] == [0, 0] and s['to'] == [p['x'], p['y']], 'Arrow does not match its point')
        total = complex_value(graph['points'][0]) + complex_value(graph['points'][1])
        return pick(public, num, total)
    match = re.fullmatch(r'Write \$(.+)\$ in polar form \$r\(\\cos\\theta\+i\\sin\\theta\)\$ with \$r>0\$ and \$0\\le\\theta<2\\pi\$\.', prompt)
    if match:
        z = num(match[1])
        options = choices(public)
        found, keys = [], set()
        for o in options:
            m = re.fullmatch(r'(.+?)\(\\cos (.+?)\+i\\sin (.+?)\)', plain(o['label']))
            require(m is not None and m[2] == m[3], f'Polar label {o["label"]}')
            r, th = num(m[1]), angle(m[2])
            require(r.float() > 0 and 0 <= th < 2, 'Polar label violates r>0 and 0<=theta<2pi')
            keys.add((r.key(), th))
            c, s = to_cartesian(r, th)
            if c + s * I == z:
                found.append(o['id'])
        require(len(keys) == 4, 'Duplicate polar choices')
        require(len(found) == 1, 'Missing or ambiguous polar form')
        return found[0]
    match = re.fullmatch(r'Write \$(.+?)\(\\cos (.+?)\+i\\sin (.+?)\)\$ in the form \$a\+bi\$, using exact values\.', prompt)
    require(match is not None and match[2] == match[3], 'Unknown complex-plane-forms prompt')
    r, th = num(match[1]), angle(match[2])
    c, s = to_cartesian(r, th)
    return pick(public, num, c + s * I)


def parse_z(text):
    return num(text)


def solve_conjugate(public):
    prompt = public['prompt']
    require(public.get('figure') is None, 'Unexpected diagram')
    match = re.fullmatch(r'(?:Divide|Write) \$\\dfrac\{(.+)\}\{(.+)\}\$ (?:and write the exact quotient in the form \$x\+yi\$|in the form \$a\+bi\$ with exact real numbers \$a\$ and \$b\$)\.', prompt)
    if match:
        top, bottom = num(match[1]), num(match[2])
        require(not bottom.is_zero(), 'Zero denominator')
        return pick(public, num, top * bottom.inverse())
    match = re.fullmatch(r'The conjugate of \$z=(.+?)\$ is \$\\bar z=(.+?)\$, with the sign of the imaginary part reversed\. Find \$z\\bar z\$\.', prompt)
    if match:
        z = num(match[1])
        require(num(match[2]) == z.conj(), 'Stated conjugate is wrong')
        return pick(public, num, z * z.conj())
    match = re.fullmatch(r'Find the conjugate of \$(.+?)\$, the number with the sign of the imaginary part reversed\.', prompt)
    require(match is not None, 'Unknown conjugate prompt')
    return pick(public, num, num(match[1]).conj())


def solve_distance(public):
    prompt = public['prompt']
    require(public.get('figure') is None, 'Unexpected diagram')
    match = re.fullmatch(r'Let \$z=(.+?)\$ and \$w=(.+?)\$\. The distance between them in the complex plane is \$\|z-w\|\$\. Find it in simplest exact form\.', prompt)
    if match:
        a, b = (num(match[1]) - num(match[2])).parts()
        return pick(public, num, Num.sqrt_int(int(a.rational() ** 2 + b.rational() ** 2)), simplest=True)
    match = re.fullmatch(r'Find the midpoint of the segment joining \$z=(.+?)\$ and \$w=(.+?)\$ in the complex plane, written as a complex number\.', prompt)
    if match:
        return pick(public, num, (num(match[1]) + num(match[2])) * rat(Fraction(1, 2)))
    match = re.fullmatch(r'The midpoint of the segment joining \$z=(.+?)\$ and \$w\$ is \$m=(.+?)\$\. Find \$w\$\.', prompt)
    if match:
        return pick(public, num, num(match[2]) * rat(2) - num(match[1]))
    match = re.fullmatch(r'The complex numbers \$z\$ with \$\|z([+-])\((.+?)\)\|=(\d+)\$ form a circle in the complex plane\. Which gives its center and radius\?', prompt)
    require(match is not None, 'Unknown distance prompt')
    shift = num(match[2])
    center = -shift if match[1] == '+' else shift
    radius = rat(int(match[3]))

    def parse(label):
        m = re.fullmatch(r'Center \$(.+?)\$, radius \$(.+?)\$', label)
        require(m is not None, f'Circle label {label}')
        r = num(m[2])
        require(r.float() > 0, 'Radius must be positive')
        return (num(m[1]), r)
    return pick(public, parse, (center, radius))


def solve_quadratic_factors(public):
    prompt = public['prompt']
    require(public.get('figure') is None, 'Unexpected diagram')
    x = Poly.var('x')
    match = re.fullmatch(r'Factor \$(.+?)\$ over the complex numbers\. Write any radicals in simplest form\.', prompt)
    if match:
        target = poly(match[1])
        require(target.degree() == 2 and target.coef(2) == ONE and target.coef(1).is_zero(), 'Expected x^2+k')
        require(target.coef(0).rational() > 0, 'Sum of squares expected')
        return pick(public, poly, target, simplest=True)
    match = re.fullmatch(r'Solve \$(.+?)=0\$ over the complex numbers\. Choose the exact solutions\.', prompt)
    if match:
        target = poly(match[1])
        require(target.degree() == 2 and target.coef(2) == ONE, 'Monic quadratic expected')

        def parse(label):
            m = re.fullmatch(r'x=(.+?)\\pm (.+)', plain(label))
            divisor = rat(1)
            fraction = re.fullmatch(r'x=\\frac\{(.+?)\\pm (.+)\}\{(\d+)\}', plain(label))
            if fraction:
                m, divisor = fraction, rat(Fraction(1, int(fraction[3])))
            require(m is not None, f'Solution label {label}')
            base, spread = num(m[1]) * divisor, num(m[2]) * divisor
            roots = (base + spread, base - spread)
            return frozenset(r.key() for r in roots), roots
        options = choices(public)
        parsed = [parse(o['label']) for o in options]
        require(len({p[0] for p in parsed}) == 4, 'Duplicate solution sets')
        hits = [o['id'] for o, (_, roots) in zip(options, parsed)
                if all(target.evaluate(x=r).is_zero() for r in roots) and roots[0] != roots[1]]
        require(len(hits) == 1, 'Missing or ambiguous solution set')
        label = next(o['label'] for o in options if o['id'] == hits[0])
        require(squarefree_label(label), 'Solutions not simplified')
        return hits[0]
    match = re.fullmatch(r'A quadratic with real coefficients and leading coefficient (\d+) has the solutions \$(.+?)\$ and \$(.+?)\$\. Choose its equation\.', prompt)
    require(match is not None, 'Unknown quadratic prompt')
    s1, s2 = num(match[2]), num(match[3])
    require(s1 == s2.conj() and not s1.real(), 'Roots must be a nonreal conjugate pair')
    lead = rat(int(match[1]))
    expected = (x - Poly.const(s1)) * (x - Poly.const(s2)) * Poly.const(lead)
    return pick(public, lambda lab: equation(lab), expected)


def solve_root_count(public):
    prompt = public['prompt']
    require(public.get('figure') is None, 'Unexpected diagram')
    match = re.fullmatch(r'A polynomial with real coefficients has degree (\d+)\. Counting multiplicity, which number of real roots can it have\?', prompt)
    if match:
        degree = int(match[1])
        options = choices(public)
        values = [int(plain(o['label'])) for o in options]
        require(len(set(values)) == 4, 'Duplicate counts')
        # Nonreal roots pair up with their conjugates, so degree - real is even and nonnegative.
        hits = [o['id'] for o, v in zip(options, values) if 0 <= v <= degree and (degree - v) % 2 == 0]
        require(len(hits) == 1, 'Missing or ambiguous possible real-root count')
        return hits[0]
    match = re.fullmatch(r'How many (?:complex )?roots does \$p\(x\)=(.+?)\$ have(?: in the complex numbers)?, counting each root as many times as its multiplicity\?', prompt)
    if match:
        p = poly(match[1])
        require(p.degree() >= 1, 'Constant polynomial')
        return pick(public, lambda lab: int(plain(lab)), p.degree())
    match = re.fullmatch(r'A polynomial of degree (\d+) has real coefficients, and \$(.+?)\$ is one of its roots\. Which other number must also be a root\?', prompt)
    if match:
        z = num(match[2])
        require(not z.real() and int(match[1]) >= 2, 'Nonreal root and degree >= 2 required')
        return pick(public, num, z.conj())
    match = re.fullmatch(r'A polynomial with real coefficients has degree (\d+)\. Its roots include \$(.+?)\$(?: and \$(.+?)\$, which are not conjugates of each other)?\. At most how many of its \1 roots, counting multiplicity, can be real\?', prompt)
    require(match is not None, 'Unknown root-count prompt')
    degree = int(match[1])
    listed = [num(match[2])] + ([num(match[3])] if match[3] else [])
    require(all(not z.real() for z in listed), 'Listed roots must be nonreal')
    closure = {z.key() for z in listed} | {z.conj().key() for z in listed}
    if len(listed) == 2:
        require(listed[0] != listed[1] and listed[0] != listed[1].conj(), 'Stated non-conjugate pair is not')
    require(len(closure) <= degree, 'Degree too small for the forced roots')
    return pick(public, lambda lab: int(plain(lab)), degree - len(closure))


def cartesian_key(label):
    a, b = pair(label)
    return (a, b)


def solve_polar(public):
    prompt = public['prompt']
    require(public.get('figure') is None, 'Unexpected diagram')
    match = re.fullmatch(r'The polar point \$(.+?)\$ (?:has a negative \$r\$\. Which pair with \$r>0\$ names the same point\?|can be named in more than one way\. Which pair names the same point\?)', prompt)
    if match:
        r0, t0 = polar_point(match[1])
        negative = 'negative' in prompt
        require((r0.float() < 0) == negative, 'Prompt and sign of r disagree')
        target = to_cartesian(r0, t0)
        options = choices(public)
        found, keys = [], set()
        for o in options:
            r, th = polar_point(o['label'])
            if negative:
                require(r.float() > 0, 'Answer choices must use r>0')
            keys.add((r.key(), th))
            if to_cartesian(r, th) == target:
                found.append(o['id'])
        require(len(keys) == 4, 'Duplicate polar names')
        require(len(found) == 1, 'Missing or ambiguous equivalent polar name')
        # Duplicate names of one point (e.g. +2pi) count as one wrong answer; here exactly one equals.
        return found[0]
    match = re.fullmatch(r'Write the Cartesian point \$(.+?)\$ in polar coordinates \$\(r,\\theta\)\$ with \$r>0\$ and \$0\\le\\theta<2\\pi\$\.', prompt)
    if match:
        target = pair(match[1])
        options = choices(public)
        found, keys = [], set()
        for o in options:
            r, th = polar_point(o['label'])
            require(r.float() > 0 and 0 <= th < 2, 'Choice violates stated polar range')
            keys.add((r.key(), th))
            if to_cartesian(r, th) == target:
                found.append(o['id'])
        require(len(keys) == 4, 'Duplicate polar choices')
        require(len(found) == 1, 'Missing or ambiguous polar conversion')
        label = next(o['label'] for o in options if o['id'] == found[0])
        require(squarefree_label(label), 'Polar radius not simplified')
        return found[0]
    match = re.fullmatch(r'Convert the polar point \$(.+?)\$ to Cartesian coordinates \$\(x,y\)\$\. Use exact values\.', prompt)
    require(match is not None, 'Unknown polar prompt')
    r, th = polar_point(match[1])
    expected = to_cartesian(r, th)
    return pick(public, cartesian_key, expected, simplest=True)


def motion(prompt):
    match = re.search(r'\$x\(t\)=(.+?)\$, \$y\(t\)=(.+?)\$', prompt)
    require(match is not None, 'Parametric equations missing')
    px, py = poly(match[1]), poly(match[2])
    for p in (px, py):
        require(p.degree(2) == 1 and all(k[0] == 0 and k[1] == 0 for k in p.t), 'Linear in t expected')
    return (px.coef(0, 0, 0), px.coef(0, 0, 1)), (py.coef(0, 0, 0), py.coef(0, 0, 1))


def solve_parametric(public):
    prompt = public['prompt']
    require(public.get('figure') is None, 'Unexpected diagram')
    (x0, a), (y0, b) = motion(prompt)
    require(not (a.is_zero() and b.is_zero()), 'Drone does not move')
    t_sym = Poly.var('t')
    if 'constant speed' in prompt:
        require('with $t$ in seconds' in prompt, 'Time units')
        speed = Num.sqrt_int(int(a.rational() ** 2 + b.rational() ** 2))

        def parse(label):
            m = re.fullmatch(r'(.+?)\\text\{ m/s\}', plain(label))
            require(m is not None, f'Speed label needs m/s: {label}')
            return num(m[1])
        return pick(public, parse, speed, simplest=True)
    if 'Eliminate $t$' in prompt:
        require(not a.is_zero(), 'x must change to write y in terms of x')
        slope = b.rational() / a.rational()
        intercept = y0.rational() - slope * x0.rational()
        expected = Poly.const(rat(slope)) * Poly.var('x') + Poly.const(rat(intercept))

        def parse(label):
            m = re.fullmatch(r'y=(.+)', plain(label))
            require(m is not None, f'Path label {label}')
            return poly(m[1])
        return pick(public, parse, expected)
    match = re.search(r'Where is the drone at \$t=(-?\d+)\$ s\?', prompt)
    if match:
        T = rat(int(match[1]))
        return pick(public, cartesian_key, (x0 + a * T, y0 + b * T))
    match = re.search(r'At what time is its ([xy])-coordinate (-?\d+)\?', prompt)
    if match:
        require('with $t$ in seconds' in prompt, 'Time units')
        start, rate = (x0, a) if match[1] == 'x' else (y0, b)
        require(not rate.is_zero(), 'Coordinate never reaches the value')
        t = (rat(int(match[2])) - start) * rate.inverse()

        def parse(label):
            m = re.fullmatch(r'(.+?)\\text\{ s\}', plain(label))
            require(m is not None, f'Time label needs seconds: {label}')
            return num(m[1])
        return pick(public, parse, t)
    require('Which statement describes its motion?' in prompt and 'increasing to the right' in prompt and 'increasing upward' in prompt, 'Unknown parametric prompt')
    ax, bx = a.rational(), b.rational()

    def truth(label):
        m = re.fullmatch(r'Moves (left|right) and (up|down), faster (horizontally than vertically|vertically than horizontally)', label)
        require(m is not None, f'Motion label {label}')
        horizontal = (ax > 0) if m[1] == 'right' else (ax < 0)
        vertical = (bx > 0) if m[2] == 'up' else (bx < 0)
        faster = abs(ax) > abs(bx) if m[3].startswith('horizontally') else abs(bx) > abs(ax)
        return horizontal and vertical and faster
    options = choices(public)
    require(len({o['label'] for o in options}) == 4, 'Duplicate statements')
    hits = [o['id'] for o in options if truth(o['label'])]
    require(len(hits) == 1, 'Missing or ambiguous motion statement')
    return hits[0]


def classify(e):
    """Classify a conic from its polynomial; returns (kind, center, details)."""
    require(e.coef(1, 1).is_zero(), 'xy term not supported')
    A, C, D, E, F = e.coef(2), e.coef(0, 2), e.coef(1), e.coef(0, 1), e.coef(0)
    require(e.degree(0) <= 2 and e.degree(1) <= 2, 'Degree > 2')
    A, C, D, E, F = (v.rational() for v in (A, C, D, E, F))
    if A == 0 and C == 0:
        raise ValueError('Not a conic')
    if A == 0 or C == 0:
        require((C != 0 and D != 0) or (A != 0 and E != 0), 'Degenerate parabola')
        return 'Parabola', None, None
    h, k = -D / (2 * A), -E / (2 * C)
    rhs = -(F - D * D / (4 * A) - E * E / (4 * C))   # A(x-h)^2 + C(y-k)^2 = rhs
    require(rhs != 0, 'Degenerate conic')
    if A * C > 0:
        require(rhs / A > 0, 'Empty conic')
        kind = 'Circle' if A == C else 'Ellipse'
    else:
        kind = 'Hyperbola'
    return kind, (h, k), (A, C, rhs)


def pt(x, y):
    return (rat(x), rat(y))


def solve_conic(public):
    prompt = public['prompt']
    require(public.get('figure') is None, 'Unexpected diagram')
    match = re.fullmatch(r'What kind of conic section is the graph of \$(.+)\$\?', prompt)
    if match:
        kind = classify(equation(match[1]))[0]
        options = choices(public)
        labels = [o['label'] for o in options]
        require(len(set(labels)) == 4 and set(labels) == {'Parabola', 'Ellipse', 'Hyperbola', 'Circle'}, 'Conic names')
        return next(o['id'] for o in options if o['label'] == kind)
    match = re.fullmatch(r'Find the center of the ellipse \$(.+)\$\.', prompt)
    if match:
        kind, center, _ = classify(equation(match[1]))
        require(kind == 'Ellipse', 'Not an ellipse')
        return pick(public, cartesian_key, pt(*center))
    match = re.fullmatch(r'The graph of \$(.+)\$ is an ellipse\. Complete the square in \$x\$ and in \$y\$ to find its center\.', prompt)
    if match:
        kind, center, _ = classify(equation(match[1]))
        require(kind == 'Ellipse', 'Stated ellipse is not an ellipse')
        return pick(public, cartesian_key, pt(*center))
    match = re.fullmatch(r'Complete the square to find the center and radius of the circle \$(.+)\$\.', prompt)
    if match:
        kind, center, (A, C, rhs) = classify(equation(match[1]))
        require(kind == 'Circle', 'Stated circle is not a circle')
        radius_squared = rhs / A

        def parse(label):
            m = re.fullmatch(r'Center \$(.+?)\$, radius \$(.+?)\$', label)
            require(m is not None, f'Circle label {label}')
            r = num(m[2])
            require(r.float() > 0, 'Radius must be positive')
            return (pair_key(m[1]), (r * r).key())
        expected = (pt(*center), rat(radius_squared).key())
        return pick(public, parse, expected, simplest=False)
    match = re.fullmatch(r'The ellipse \$(.+)\$ has a longer axis\. Which points are the ends of its longer axis\?', prompt)
    require(match is not None, 'Unknown conic prompt')
    kind, (h, k), (A, C, rhs) = classify(equation(match[1]))
    require(kind == 'Ellipse' and A != C, 'Ellipse with distinct axes required')
    p_sq, q_sq = rhs / A, rhs / C        # squared semi-axes along x and y
    require(p_sq != q_sq, 'Ambiguous longer axis')
    if p_sq > q_sq:
        ends = frozenset({((rat(h) + Num.sqrt_frac(p_sq)).key(), rat(k).key()), ((rat(h) - Num.sqrt_frac(p_sq)).key(), rat(k).key())})
    else:
        ends = frozenset({(rat(h).key(), (rat(k) + Num.sqrt_frac(q_sq)).key()), (rat(h).key(), (rat(k) - Num.sqrt_frac(q_sq)).key())})

    def parse(label):
        m = re.fullmatch(r'(\(.+?\)) and (\(.+?\))', plain(label))
        require(m is not None, f'Axis label {label}')
        return frozenset((a.key(), b.key()) for a, b in (pair(m[1]), pair(m[2])))
    return pick(public, parse, ends)


def parabola_data(e):
    """From E=0 where E is lhs-rhs of (v-c)^2=4p(w-d): return vertex, p, axis."""
    require(e.coef(1, 1).is_zero(), 'xy term not supported')
    if e.coef(2) == ONE and e.coef(0, 2).is_zero():
        h = -e.coef(1).rational() / 2
        four_p = -e.coef(0, 1).rational()
        require(four_p != 0, 'Degenerate parabola')
        k = (e.coef(0).rational() - h * h) / four_p
        return 'vertical', (h, k), four_p / 4
    require(e.coef(0, 2) == ONE and e.coef(2).is_zero(), 'Unsupported parabola form')
    k = -e.coef(0, 1).rational() / 2
    four_p = -e.coef(1).rational()
    require(four_p != 0, 'Degenerate parabola')
    h = (e.coef(0).rational() - k * k) / four_p
    return 'horizontal', (h, k), four_p / 4


def solve_parabola(public):
    prompt = public['prompt']
    require(public.get('figure') is None, 'Unexpected diagram')
    match = re.fullmatch(r'A parabola has focus \$\((-?\d+), (-?\d+)\)\$ and directrix \$y=(-?\d+)\$\. (What is its vertex\?|Choose its equation\.)', prompt)
    if match:
        h, f, d = (Fraction(int(v)) for v in match.groups()[:3])
        require(f != d, 'Focus on the directrix')
        k, p = (f + d) / 2, (f - d) / 2
        if match[4].startswith('What'):
            return pick(public, cartesian_key, pt(h, k))
        x, y = Poly.var('x'), Poly.var('y')
        expected = (x - Poly.const(rat(h))).power(2) - (y - Poly.const(rat(k))).scale(rat(4 * p))
        return pick(public, lambda lab: equation(lab), expected)
    match = re.fullmatch(r'(?:The parabola \$(.+?)\$ has a horizontal axis of symmetry, so the roles of \$x\$ and \$y\$ are exchanged: \$\(y-k\)\^2=4p\(x-h\)\$\. Find its focus\.|Find the focus of the parabola \$(.+?)\$\.|Find the equation of the directrix of the parabola \$(.+?)\$\.)', prompt)
    require(match is not None, 'Unknown parabola prompt')
    source = match[1] or match[2] or match[3]
    orientation, (h, k), p = parabola_data(equation(source))
    if match[1]:
        require(orientation == 'horizontal', 'Prompt claims a horizontal axis')
    if match[3]:
        if orientation == 'vertical':
            expected = ('y', rat(k - p))
        else:
            expected = ('x', rat(h - p))

        def parse(label):
            m = re.fullmatch(r'([xy])=(.+)', plain(label))
            require(m is not None, f'Directrix label {label}')
            return (m[1], num(m[2]))
        return pick(public, parse, expected)
    focus = pt(h, k + p) if orientation == 'vertical' else pt(h + p, k)
    return pick(public, cartesian_key, focus)


SOLVERS = {
    'complex-plane-forms': solve_plane,
    'complex-conjugate-division': solve_conjugate,
    'complex-distance-midpoint': solve_distance,
    'complex-quadratic-factors': solve_quadratic_factors,
    'polynomial-root-count': solve_root_count,
    'polar-cartesian-conversion': solve_polar,
    'parametric-linear-motion': solve_parametric,
    'conic-standard-form': solve_conic,
    'parabola-focus-directrix': solve_parabola,
}


def solve(public):
    require(public['templateId'] in SUPPORTED, 'Unexpected complex/conic family')
    return SOLVERS[public['templateId']](public)


def condensed(text):
    return re.sub(r'[\s$]', '', text.replace('\u2212', '-'))


def review_problem(problem):
    public = problem['public']
    result = solve(public)
    require(result == problem['answer'], 'Complex/conic answer key mismatch')
    options = choices(public)
    correct = next(o['label'] for o in options if o['id'] == result)
    # The correct label must not be printed in the hint or figure (a quotient that happens
    # to equal a given operand is legitimately visible in the prompt).
    visible = condensed(problem.get('hint', '') + ' ' + json.dumps(public.get('figure', '')))
    needle = condensed(correct)
    require(len(needle) < 5 or needle not in visible, 'Correct answer is printed in the hint or figure')
    # Wrong-choice feedback exists for exactly the wrong choices and never names the right one.
    feedback = problem.get('choiceFeedback', {})
    wrong = {o['id'] for o in options if o['id'] != result}
    require(set(feedback) == wrong, 'Feedback must cover exactly the wrong choices')
    for text in feedback.values():
        require(isinstance(text, str) and text.strip(), 'Empty feedback')
    return result


# -------------------------------------------------------------------- self test
def _case(template, prompt, labels, answer, figure=None):
    public = {
        'templateId': template, 'prompt': prompt,
        'response': {'kind': 'choice', 'options': [{'id': f'option-{c}', 'label': f'${l}$' if not l.startswith(('Center', 'Moves', 'Parabola', 'Ellipse', 'Hyperbola', 'Circle')) else l} for c, l in zip('abcd', labels)]},
    }
    if figure:
        public['figure'] = figure
    return {'public': public, 'answer': f'option-{answer}', 'hint': 'Think.',
            'choiceFeedback': {f'option-{c}': 'Check.' for c in 'abcd' if c != answer}}


def _graph(points, segments=None):
    graph = {'id': 'g', 'type': 'graph', 'x': [-5, 5], 'y': [-5, 5], 'tick': 1, 'points': points}
    if segments:
        graph['segments'] = segments
    return {'kind': 'scene', 'scene': {'v': 1, 'title': 'Plane', 'elements': [graph]}}


def self_test():
    T = 'complex-plane-forms'
    polar = lambda r, a: f'{r}(\\cos {a}+i\\sin {a})'
    cases = [
        (T, 'The modulus $|z|$ of a complex number is its distance from 0 in the complex plane. Find $|-12 + 5i|$ in simplest exact form.', ['\\sqrt{119}', '13', '169', '17'], 'b', None),
        (T, 'The point $P$ in the complex plane represents a complex number $z$. The horizontal axis shows real parts and the vertical axis shows imaginary parts. Write $z$ in the form $a+bi$.', ['2 - 3i', '-2 + 3i', '3 + 2i', '2 + 3i'], 'd', _graph([{'x': 2, 'y': 3, 'label': 'P'}])),
        (T, 'The points $P$ and $Q$ represent the complex numbers $z$ and $w$. The horizontal axis shows real parts and the vertical axis shows imaginary parts. Adding complex numbers adds their arrows from 0. Choose $z+w$.', ['-1', '-1 - 5i', '3 - i', '-2 + 6i'], 'b',
         _graph([{'x': 1, 'y': -3, 'label': 'P'}, {'x': -2, 'y': -2, 'label': 'Q'}], [{'from': [0, 0], 'to': [1, -3]}, {'from': [0, 0], 'to': [-2, -2]}])),
        (T, 'Write $-\\sqrt{3} + i$ in polar form $r(\\cos\\theta+i\\sin\\theta)$ with $r>0$ and $0\\le\\theta<2\\pi$.', [polar(2, '\\frac{11\\pi}{6}'), polar(2, '\\frac{5\\pi}{6}'), polar(2, '\\frac{7\\pi}{6}'), polar(2, '\\frac{\\pi}{6}')], 'b', None),
        (T, 'Write $2(\\cos \\frac{\\pi}{3}+i\\sin \\frac{\\pi}{3})$ in the form $a+bi$, using exact values.', ['1 - \\sqrt{3}i', '1 + \\sqrt{3}i', '\\sqrt{3} + i', '-1 + \\sqrt{3}i'], 'b', None),
        ('complex-conjugate-division', 'Divide $\\dfrac{13 - 9i}{-3 - i}$ and write the exact quotient in the form $x+yi$.', ['-\\frac{13}{3} + 9i', '-30 + 40i', '-\\frac{24}{5} + \\frac{7}{5}i', '-3 + 4i'], 'd', None),
        ('complex-conjugate-division', 'The conjugate of $z=1 - 2i$ is $\\bar z=1 + 2i$, with the sign of the imaginary part reversed. Find $z\\bar z$.', ['-3', '1', '-5', '5'], 'd', None),
        ('complex-conjugate-division', 'Find the conjugate of $-7i$, the number with the sign of the imaginary part reversed.', ['-7i', '7i', '-7', '8i'], 'b', None),
        ('complex-distance-midpoint', 'Let $z=-2 - 4i$ and $w=-9 - 3i$. The distance between them in the complex plane is $|z-w|$. Find it in simplest exact form.', ['7', '5\\sqrt{2}', '8', '50'], 'b', None),
        ('complex-distance-midpoint', 'The midpoint of the segment joining $z=-6 - 6i$ and $w$ is $m=-2 + 4i$. Find $w$.', ['2 + 14i', '-8 - 2i', '4 + 10i', '-10 - 16i'], 'a', None),
        ('complex-distance-midpoint', 'The complex numbers $z$ with $|z+(-1 - 4i)|=4$ form a circle in the complex plane. Which gives its center and radius?', ['Center $-1 - 4i$, radius $4$', 'Center $1 + 4i$, radius $16$', 'Center $1 + 4i$, radius $4$', 'Center $1 - 4i$, radius $4$'], 'c', None),
        ('complex-quadratic-factors', 'Factor $x^2+8$ over the complex numbers. Write any radicals in simplest form.', ['(x+2\\sqrt{2}i)^2', '(x+2\\sqrt{2})(x-2\\sqrt{2})', '(x+8i)(x-8i)', '(x+2\\sqrt{2}i)(x-2\\sqrt{2}i)'], 'd', None),
        ('complex-quadratic-factors', 'Solve $x^2-8x+24=0$ over the complex numbers. Choose the exact solutions.', ['x=-4\\pm 2\\sqrt{2}i', 'x=4\\pm 2\\sqrt{2}i', 'x=8\\pm 2\\sqrt{2}i', 'x=4\\pm 2\\sqrt{2}'], 'b', None),
        ('complex-quadratic-factors', 'A quadratic with real coefficients and leading coefficient 1 has the solutions $1 + 2i$ and $1 - 2i$. Choose its equation.', ['x^2-2x-3=0', 'x^2-2x+5=0', 'x^2+2x+5=0', 'x^2-2x+4=0'], 'b', None),
        ('polynomial-root-count', 'A polynomial with real coefficients has degree 5. Counting multiplicity, which number of real roots can it have?', ['5', '0', '4', '2'], 'a', None),
        ('polynomial-root-count', 'A polynomial with real coefficients has degree 6. Counting multiplicity, which number of real roots can it have?', ['5', '3', '4', '1'], 'c', None),
        ('polynomial-root-count', 'How many complex roots does $p(x)=(x+3)^3(x^2+3)$ have, counting each root as many times as its multiplicity?', ['2', '3', '5', '4'], 'c', None),
        ('polynomial-root-count', 'A polynomial of degree 4 has real coefficients, and $2 + 6i$ is one of its roots. Which other number must also be a root?', ['2 - 6i', '-2 + 6i', '6 + 2i', '-2 - 6i'], 'a', None),
        ('polynomial-root-count', 'A polynomial with real coefficients has degree 8. Its roots include $2 + 2i$ and $6 - 2i$, which are not conjugates of each other. At most how many of its 8 roots, counting multiplicity, can be real?', ['8', '4', '3', '6'], 'b', None),
        ('polar-cartesian-conversion', 'The polar point $\\left(-6, \\frac{5\\pi}{6}\\right)$ has a negative $r$. Which pair with $r>0$ names the same point?', ['\\left(6, \\frac{5\\pi}{6}\\right)', '\\left(6, \\frac{7\\pi}{6}\\right)', '\\left(6, \\frac{11\\pi}{6}\\right)', '\\left(6, \\frac{4\\pi}{3}\\right)'], 'c', None),
        ('polar-cartesian-conversion', 'The polar point $\\left(2, \\frac{4\\pi}{3}\\right)$ can be named in more than one way. Which pair names the same point?', ['\\left(-2, \\frac{4\\pi}{3}\\right)', '\\left(2, \\frac{\\pi}{3}\\right)', '\\left(2, \\frac{10\\pi}{3}\\right)', '\\left(-2, \\frac{10\\pi}{3}\\right)'], 'c', None),
        ('polar-cartesian-conversion', 'Write the Cartesian point $(3\\sqrt{2}, 3\\sqrt{2})$ in polar coordinates $(r,\\theta)$ with $r>0$ and $0\\le\\theta<2\\pi$.', ['\\left(6, \\frac{7\\pi}{4}\\right)', '\\left(6, \\frac{3\\pi}{4}\\right)', '\\left(6, \\frac{\\pi}{4}\\right)', '\\left(6, \\frac{5\\pi}{4}\\right)'], 'c', None),
        ('polar-cartesian-conversion', 'Convert the polar point $\\left(-6, \\frac{5\\pi}{4}\\right)$ to Cartesian coordinates $(x,y)$. Use exact values.', ['(-3\\sqrt{2}, 3\\sqrt{2})', '(3\\sqrt{2}, -3\\sqrt{2})', '(6, 6)', '(3\\sqrt{2}, 3\\sqrt{2})'], 'd', None),
        ('parametric-linear-motion', 'A drone\'s position, in meters, is $x(t)=-3-5t$, $y(t)=-4-3t$ with $t$ in seconds. What is its constant speed, in simplest exact form?', ['34\\text{ m/s}', '\\sqrt{34}\\text{ m/s}', '5\\text{ m/s}', '8\\text{ m/s}'], 'b', None),
        ('parametric-linear-motion', 'A drone\'s position, in meters, is $x(t)=-1-5t$, $y(t)=1+t$. Eliminate $t$ to write the path as $y$ in terms of $x$.', ['y=-\\frac{1}{5}x+1', 'y=-\\frac{1}{5}x+\\frac{6}{5}', 'y=-\\frac{1}{5}x+\\frac{4}{5}', 'y=-5x-4'], 'c', None),
        ('parametric-linear-motion', 'A drone\'s position, in meters, is $x(t)=-3+5t$, $y(t)=3+4t$, with $x$ increasing to the right and $y$ increasing upward. Which statement describes its motion?', ['Moves right and up, faster horizontally than vertically', 'Moves right and up, faster vertically than horizontally', 'Moves left and up, faster horizontally than vertically', 'Moves right and down, faster horizontally than vertically'], 'a', None),
        ('parametric-linear-motion', 'A drone\'s position, in meters, at time $t$ seconds is $x(t)=-5+4t$, $y(t)=4-3t$. Where is the drone at $t=3$ s?', ['(-1, 1)', '(-5, 7)', '(12, -9)', '(7, -5)'], 'd', None),
        ('parametric-linear-motion', 'A drone\'s position, in meters, is $x(t)=-6+4t$, $y(t)=5+3t$ with $t$ in seconds. At what time is its y-coordinate 17?', ['\\frac{22}{3}\\text{ s}', '\\frac{17}{3}\\text{ s}', '4\\text{ s}', '12\\text{ s}'], 'c', None),
        ('conic-standard-form', 'What kind of conic section is the graph of $\\frac{(x+5)^2}{16}+\\frac{(y-3)^2}{9}=1$?', ['Parabola', 'Ellipse', 'Hyperbola', 'Circle'], 'b', None),
        ('conic-standard-form', 'The graph of $9x^2+4y^2-72x+16y+124=0$ is an ellipse. Complete the square in $x$ and in $y$ to find its center.', ['(36, -8)', '(8, -4)', '(-4, 2)', '(4, -2)'], 'd', None),
        ('conic-standard-form', 'Complete the square to find the center and radius of the circle $x^2+y^2-10x+4y+19=0$.', ['Center $(10, -4)$, radius $\\sqrt{10}$', 'Center $(-5, 2)$, radius $\\sqrt{10}$', 'Center $(5, -2)$, radius $\\sqrt{10}$', 'Center $(5, -2)$, radius $10$'], 'c', None),
        ('conic-standard-form', 'The ellipse $\\frac{(x+1)^2}{25}+\\frac{(y-5)^2}{16}=1$ has a longer axis. Which points are the ends of its longer axis?', ['(-5, 5) and (3, 5)', '(-1, 0) and (-1, 10)', '(-26, 5) and (24, 5)', '(-6, 5) and (4, 5)'], 'd', None),
        ('parabola-focus-directrix', 'A parabola has focus $(4, -1)$ and directrix $y=-9$. What is its vertex?', ['(4, -9)', '(4, -10)', '(4, -1)', '(4, -5)'], 'd', None),
        ('parabola-focus-directrix', 'The parabola $(y-5)^2=16(x+2)$ has a horizontal axis of symmetry, so the roles of $x$ and $y$ are exchanged: $(y-k)^2=4p(x-h)$. Find its focus.', ['(-2, 9)', '(2, 5)', '(14, 5)', '(-6, 5)'], 'b', None),
        ('parabola-focus-directrix', 'A parabola has focus $(2, 0)$ and directrix $y=8$. Choose its equation.', ['(x-2)^2=-32(y-4)', '(x-2)^2=-16(y-4)', '(x-2)^2=16(y-4)', '(x-2)^2=-16y'], 'b', None),
        ('parabola-focus-directrix', 'Find the equation of the directrix of the parabola $(x+1)^2=8(y+1)$.', ['y=-9', 'y=-2', 'y=-3', 'y=1'], 'c', None),
    ]
    rejected = 0

    def reject(problem, why):
        nonlocal rejected
        try:
            review_problem(problem)
        except ValueError:
            rejected += 1
            return
        raise ValueError(f'Corrupt complex/conic case was accepted: {why}')

    for template, prompt, labels, answer, figure in cases:
        problem = _case(template, prompt, labels, answer, figure)
        review_problem(problem)
        other = 'a' if answer != 'a' else 'b'
        bad = copy.deepcopy(problem)
        bad['answer'] = f'option-{other}'
        reject(bad, 'wrong answer key')
        # A wrong choice rewritten to equal the correct one must be caught as a duplicate.
        bad = copy.deepcopy(problem)
        correct_label = bad['public']['response']['options']['abcd'.index(answer)]['label']
        bad['public']['response']['options']['abcd'.index(other)]['label'] = correct_label
        reject(bad, 'duplicate correct value')
        # The correct label printed in the hint is a leak (long labels only).
        if len(condensed(correct_label)) >= 5:
            bad = copy.deepcopy(problem)
            bad['hint'] = 'The answer is ' + correct_label
            reject(bad, 'hint leak')
        bad = copy.deepcopy(problem)
        bad['choiceFeedback'].pop(next(iter(bad['choiceFeedback'])))
        reject(bad, 'missing feedback')
        if figure:
            bad = copy.deepcopy(problem)
            graph = bad['public']['figure']['scene']['elements'][0]
            graph['points'][0]['x'] += 1 if graph['points'][0]['x'] < 5 else -1
            reject(bad, 'figure no longer matches the choices')
        else:
            bad = copy.deepcopy(problem)
            bad['public']['prompt'] = re.sub(r'(\d)', lambda m: str(int(m[1]) + 1), bad['public']['prompt'], count=1)
            try:
                review_problem(bad)
                shifted_ok = True
            except ValueError:
                shifted_ok = False
            rejected += 0 if shifted_ok else 1
    # A non-simplified correct radical must be refused.
    unsimplified = _case('complex-distance-midpoint', 'Let $z=-2 - 4i$ and $w=-9 - 3i$. The distance between them in the complex plane is $|z-w|$. Find it in simplest exact form.', ['7', '\\sqrt{50}', '8', '50'], 'b')
    reject(unsimplified, 'unsimplified radical')
    # A non-conjugate list pair mislabelled as conjugates must be refused.
    mislabelled = _case('polynomial-root-count', 'A polynomial with real coefficients has degree 8. Its roots include $2 + 2i$ and $2 - 2i$, which are not conjugates of each other. At most how many of its 8 roots, counting multiplicity, can be real?', ['8', '4', '3', '6'], 'b')
    reject(mislabelled, 'conjugates mislabelled')
    # An equal-speed motion statement is ambiguous and must be refused.
    tie = _case('parametric-linear-motion', 'A drone\'s position, in meters, is $x(t)=-3+4t$, $y(t)=3+4t$, with $x$ increasing to the right and $y$ increasing upward. Which statement describes its motion?', ['Moves right and up, faster horizontally than vertically', 'Moves right and up, faster vertically than horizontally', 'Moves left and up, faster horizontally than vertically', 'Moves right and down, faster horizontally than vertically'], 'a')
    reject(tie, 'tied speeds')
    return {'fixtures': len(cases) + 3, 'rejectedMutations': rejected}


if __name__ == '__main__':
    print(self_test())
