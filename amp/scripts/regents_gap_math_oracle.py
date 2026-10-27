"""Independent review of Regents gap forms (rg-*), derived only from public payloads."""
import copy
import math
import re
from fractions import Fraction

CHOICE = frozenset({
    'rg-exponential-base-rate', 'rg-factor-completely', 'rg-polynomial-zeros-forms',
    'rg-exponent-monomial-power', 'rg-rational-exponent-forms', 'rg-polynomial-build',
    'rg-quadrilateral-choice', 'rg-segment-property-choice', 'rg-triangle-third-side-test',
})
NUMERIC = frozenset({
    'rg-solid-density', 'rg-parallelogram-perpendicular', 'rg-isosceles-right-decimal',
    'rg-triangle-area-sas', 'rg-altitude-segment',
})
SUPPORTED = CHOICE | NUMERIC


def require(condition, message):
    if not condition:
        raise ValueError(message)


def plain(text):
    return (text.replace('$', '').replace('−', '-').replace('\\left', '').replace('\\right', '')
            .replace('\\ ', ' ').replace('\\cdot', '*'))


# ---------- tiny exact polynomial algebra in x, y ----------
def padd(a, b, sign=1):
    out = dict(a)
    for k, v in b.items():
        out[k] = out.get(k, 0) + sign * v
        if out[k] == 0:
            del out[k]
    return out


def pmul(a, b):
    out = {}
    for (i, j), v in a.items():
        for (k, l), w in b.items():
            key = (i + k, j + l)
            out[key] = out.get(key, 0) + v * w
            if out[key] == 0:
                del out[key]
    return out


def ppow(a, n):
    out = {(0, 0): Fraction(1)}
    for _ in range(n):
        out = pmul(out, a)
    return out


def parse_poly(text):
    s = plain(text).replace(' ', '')
    pos = 0

    def peek():
        return s[pos] if pos < len(s) else ''

    def expr():
        nonlocal pos
        total = {}
        sign = 1
        if peek() in '+-':
            sign = -1 if peek() == '-' else 1
            pos += 1
        total = padd(total, term(), sign)
        while peek() in ('+', '-') and peek():
            sign = -1 if peek() == '-' else 1
            pos += 1
            total = padd(total, term(), sign)
        return total

    def term():
        nonlocal pos
        out = factor()
        while peek() and peek() not in '+-)':
            out = pmul(out, factor())
        return out

    def factor():
        nonlocal pos
        c = peek()
        if c == '(':
            pos += 1
            base = expr()
            require(peek() == ')', 'Unbalanced parentheses')
            pos += 1
        elif c.isdigit():
            m = re.match(r'\d+', s[pos:])
            base = {(0, 0): Fraction(int(m[0]))}
            pos += len(m[0])
        elif c in 'xy':
            base = {(1, 0) if c == 'x' else (0, 1): Fraction(1)}
            pos += 1
        else:
            raise ValueError(f'Cannot parse polynomial {text!r} at {s[pos:]!r}')
        if peek() == '^':
            m = re.match(r'\^\{(\d+)\}', s[pos:])
            require(m is not None, 'Exponent must be braced')
            pos += len(m[0])
            base = ppow(base, int(m[1]))
        return base

    result = expr()
    require(pos == len(s), f'Trailing text in {text!r}')
    return result


def top_factors(text):
    """Split a factored string into top-level parenthesized factors (with powers) and the rest."""
    s = plain(text).replace(' ', '')
    factors, rest, depth, start, i = [], '', 0, None, 0
    while i < len(s):
        c = s[i]
        if c == '(':
            if depth == 0:
                start = i
            depth += 1
        elif c == ')':
            depth -= 1
            if depth == 0:
                j = i + 1
                power = 1
                m = re.match(r'\^\{(\d+)\}', s[j:])
                if m:
                    power = int(m[1])
                    j += len(m[0])
                factors.append((s[start + 1:i], power))
                i = j
                continue
        elif depth == 0:
            rest += c
        i += 1
    return factors, rest


def irreducible_primitive(factor_text):
    poly = parse_poly(factor_text)
    coeffs = [abs(int(v)) for v in poly.values()]
    require(all(v.denominator == 1 for v in poly.values()), 'Non-integer factor')
    if math.gcd(*coeffs) != 1:
        return False
    degree = max(i + j for i, j in poly)
    if degree <= 1:
        return True
    require(degree == 2, 'Unverifiable factor degree')
    terms = set(poly)
    # Quadratic in one direction with coefficient list a (x^2), b (xy or x), c (y^2 or 1).
    a = poly.get((2, 0), 0)
    c = poly.get((0, 2), poly.get((0, 0), 0))
    b = poly.get((1, 1), poly.get((1, 0), 0))
    require(terms <= {(2, 0), (0, 2), (1, 1), (0, 0), (1, 0)}, 'Unverifiable quadratic shape')
    disc = int(b * b - 4 * a * c)
    return not (disc >= 0 and math.isqrt(disc) ** 2 == disc)


def expand_factored(text):
    return parse_poly(text)


def complete_and_equal(original, option):
    if expand_factored(option) != parse_poly(original):
        return False
    factors, _ = top_factors(option)
    return all(irreducible_primitive(f) for f, _ in factors)


# ---------- helpers ----------
def number(text):
    t = plain(text).replace(' ', '')
    m = re.fullmatch(r'(-?)\\frac\{(-?\d+)\}\{(-?\d+)\}', t)
    if m:
        v = Fraction(int(m[2]), int(m[3]))
        return -v if m[1] else v
    if re.fullmatch(r'-?\d+(\.\d+)?', t):
        return Fraction(t)
    raise ValueError(f'Not a number: {text!r}')


def choice_options(public, count=4):
    response = public['response']
    require(response['kind'] == 'choice', 'Choice response required')
    options = response['options']
    require(len(options) == count and all(set(o) == {'id', 'label'} for o in options), 'Four public choices required')
    require(len({o['id'] for o in options}) == count, 'Duplicate choice IDs')
    return options


def pick(options, predicate, values):
    require(len(set(values)) == len(values), 'Mathematically duplicate choices')
    hits = [o['id'] for o, v in zip(options, values) if predicate(v)]
    require(len(hits) == 1, 'Missing or ambiguous correct choice')
    return hits[0]


def nth_root_exact(value, n):
    """Exact n-th root of a non-negative Fraction, or None."""
    def root(k):
        r = round(k ** (1 / n))
        for c in (r - 1, r, r + 1):
            if c >= 0 and c ** n == k:
                return c
        return None
    p, q = root(value.numerator), root(value.denominator)
    return None if p is None or q is None else Fraction(p, q)


def round_tenth(frac):
    scaled = frac * 10
    return Fraction(math.floor(scaled + Fraction(1, 2)), 10)


def sqrt_tenth(frac):
    """Exact nearest tenth of sqrt(frac) for rational frac, ties impossible for irrational."""
    scaled = frac * 100  # (10 sqrt)^2
    root = math.isqrt(scaled.numerator // scaled.denominator)
    lo = Fraction(root, 1)
    # compare scaled to (r+1/2)^2 where r integer = floor(10*sqrt)
    base = math.isqrt(math.floor(scaled))
    value = Fraction(base)
    threshold = (value + Fraction(1, 2)) ** 2
    require(scaled != threshold, 'Rounding tie')
    return (value + (1 if scaled > threshold else 0)) / 10


# ---------- solvers ----------
def solve_exponential(public):
    prompt = plain(public['prompt'])
    options = choice_options(public)
    m = re.fullmatch(r'A quantity is modeled by Q\(t\)=(\d+)\(([\d.]+)\)\^\{t/(\d+)\}, where t is time in (\w+)\. Which statement is true\?', prompt)
    m2 = re.fullmatch(r'The .* modeled by [A-Z]\(t\)=(\d+)\(([\d.]+)\)\^\{t\}, where t is time in (\w+)\. Which statement describes how it changes each (\w+)\?', prompt)
    if m or m2:
        if m:
            base, period, unit = Fraction(m[2]), int(m[3]), m[4]
        else:
            base, period, unit = Fraction(m2[2]), 1, m2[3]
            require(m2[4] + 's' == unit, 'Unit and change period disagree')
        percent = abs(base - 1) * 100
        direction = 'increases' if base > 1 else 'decreases'
        parsed = []
        for o in options:
            t = re.fullmatch(r'It (increases|decreases) by ([\d.]+)% (?:each (\w+)|every (\d+) (\w+))\.', o['label'])
            require(t is not None, f'Unreadable statement {o["label"]!r}')
            p = 1 if t[3] else int(t[4])
            u = t[3] or t[5]
            require(p != 1 or t[3], 'Use "each" for one unit')
            require(u + ('s' if not t[3] else '') == unit or u == unit.rstrip('s') or u == unit, 'Unit mismatch in option')
            parsed.append((t[1], Fraction(t[2]), p, u.rstrip('s')))
        want = (direction, percent, period, unit.rstrip('s'))
        return pick(options, lambda v: v == want, parsed)
    m = re.fullmatch(r'A medicine has a half-life of (\d+) hours: the amount in the body is cut in half every \1 hours\. A patient takes (\d+) mg\. Which function models the amount A\(t\) in mg remaining t hours after the dose\?', prompt)
    require(m is not None, 'Unrecognized exponential prompt')
    h, mass = int(m[1]), int(m[2])
    samples = [0, h, 2 * h, 3 * h, 1, 5]

    def evaluate(label, t):
        f = re.fullmatch(r'A\(t\)=(\d+)\(([\d.]+)\)\^\{(.+)\}', plain(label))
        require(f is not None, f'Unreadable function {label!r}')
        e = f[3]
        if e == 't':
            ex = Fraction(t)
        elif re.fullmatch(r't/\d+', e):
            ex = Fraction(t, int(e[2:]))
        elif re.fullmatch(r't-\d+', e):
            ex = Fraction(t - int(e[2:]))
        elif re.fullmatch(r'\d+t', e):
            ex = Fraction(t * int(e[:-1]))
        else:
            raise ValueError(f'Unreadable exponent {e!r}')
        return int(f[1]) * float(Fraction(f[2])) ** float(ex)
    target = [mass * 0.5 ** (t / h) for t in samples]
    values = [tuple(round(evaluate(o['label'], t), 9) for t in samples) for o in options]
    return pick(options, lambda v: all(abs(a - b) < 1e-7 * max(1, abs(b)) for a, b in zip(v, target)), values)


def solve_factor(public):
    prompt = plain(public['prompt'])
    m = re.fullmatch(r'Which expression is (.+) (?:factored completely|written in factored form)\?', prompt)
    require(m is not None, 'Unrecognized factoring prompt')
    options = choice_options(public)
    original = m[1]
    flags = [complete_and_equal(original, o['label']) for o in options]
    # Distinctness by expansion plus form.
    require(len({tuple(sorted(parse_poly(o['label']).items())) for o in options}) >= 3, 'Too few distinct expansions')
    require(len(set(plain(o['label']) for o in options)) == 4, 'Duplicate text')
    hits = [o['id'] for o, f in zip(options, flags) if f]
    require(len(hits) == 1, 'Missing or ambiguous completely factored choice')
    return hits[0]


def parse_value_list(label):
    return frozenset(number(p) for p in plain(label).replace(',', ' , ').split(' , ')) if ',' in label else frozenset([number(label)])


def solve_zeros(public):
    prompt = plain(public['prompt'])
    options = choice_options(public)
    m = re.fullmatch(r'Which value is a zero of f\(x\)=(.+)\?', prompt)
    if m:
        poly = parse_poly(m[1])
        values = [number(o['label']) for o in options]
        def f(v):
            return sum(c * v ** i for (i, j), c in poly.items())
        require(all(j == 0 for _, j in poly), 'x only')
        return pick(options, lambda v: f(v) == 0, values)
    m = re.fullmatch(r'What are the zeros of f\(x\)=(.+)\?', prompt)
    require(m is not None, 'Unrecognized zeros prompt')
    expected = set()
    for part in re.findall(r'\(([^()]*)\)|(?<![\w)])x(?![\w^(])', m[1]):
        pass
    s = m[1].replace(' ', '')
    require(re.fullmatch(r'(\([^()]+\)|x)+', s) is not None, 'Product of linear factors required')
    for fac in re.findall(r'\([^()]+\)|x', s):
        if fac == 'x':
            expected.add(Fraction(0))
            continue
        p = parse_poly(fac)
        a, b = p.get((1, 0), 0), p.get((0, 0), 0)
        require(a != 0 and set(p) <= {(1, 0), (0, 0)}, 'Linear factor required')
        expected.add(-b / a)
    values = [parse_value_list(o['label']) for o in options]
    require(len(set(values)) == 4, 'Duplicate zero sets')
    return pick(options, lambda v: v == frozenset(expected), values)


def solve_monomial(public):
    m = re.fullmatch(r'Which expression is equivalent to (.+)\?', plain(public['prompt']))
    require(m is not None, 'Unrecognized exponent prompt')
    target = parse_poly(m[1])
    options = choice_options(public)
    values = [tuple(sorted(parse_poly(o['label']).items())) for o in options]
    return pick(options, lambda v: v == tuple(sorted(target.items())), values)


def parse_rational_power_label(label):
    """Return (coeff, exponent Fraction) for c x^{p/q}, or a radical/fraction value descriptor."""
    t = plain(label).replace(' ', '')
    m = re.fullmatch(r'(\d+)x\^\{\\frac\{(\d+)\}\{(\d+)\}\}', t)
    require(m is not None, f'Unreadable power {label!r}')
    return ('xpow', int(m[1]), Fraction(int(m[2]), int(m[3])))


def solve_rational(public):
    prompt = plain(public['prompt'])
    options = choice_options(public)
    m = re.fullmatch(r'What is the value of \(\\frac\{(\d+)\}\{(\d+)\}\)\^\{-\\frac\{(\d+)\}\{(\d+)\}\}\?', prompt)
    if m:
        p, q, a, b = map(int, m.groups())
        base = Fraction(q, p) if True else None
        root = nth_root_exact(base, b)
        require(root is not None, 'Prompt value must be exactly computable')
        expected = root ** a
        values = [number(o['label']) for o in options]
        return pick(options, lambda v: v == expected, values)
    m = re.fullmatch(r'Which expression is \(\\frac\{x\}\{y\}\)\^\{-\\frac\{(\d+)\}\{(\d+)\}\}, for x>0 and y>0, written in radical form\?', prompt)
    if m:
        a, b = int(m[1]), int(m[2])
        # (x/y)^(-a/b) = (y/x)^(a/b); a label is (num/den)^(pw/rt) with sign.
        values = []
        for o in options:
            t = plain(o['label']).replace(' ', '')
            r = re.fullmatch(r'(-?)\\sqrt(?:\[(\d+)\])?\{\(\\frac\{([xy])\}\{([xy])\}\)\^\{(\d+)\}\}', t)
            if r:
                root = int(r[2] or 2)
                values.append(('rad', r[1] == '-', r[3] + r[4], Fraction(int(r[5]), root)))
                continue
            r = re.fullmatch(r'\\frac\{1\}\{\\sqrt(?:\[(\d+)\])?\{x\}\}', t)
            require(r is not None, f'Unreadable radical {o["label"]!r}')
            values.append(('inv-root-x', Fraction(1, int(r[1] or 2))))
        want = ('rad', False, 'yx', Fraction(a, b))
        return pick(options, lambda v: v == want, values)
    prompt = prompt.replace(' ', '')
    m = re.fullmatch(r'Whichexpressionisequivalentto(\d+)\\sqrt(?:\[(\d+)\])?\{x\}\*(\d+)x\^\{\\frac\{(\d+)\}\{(\d+)\}\},forx>0\?', prompt)
    require(m is not None, 'Unrecognized rational exponent prompt')
    root = int(m[2] or 2)
    coeff = int(m[1]) * int(m[3])
    exponent = Fraction(1, root) + Fraction(int(m[4]), int(m[5]))
    values = [parse_rational_power_label(o['label'])[1:] for o in options]
    return pick(options, lambda v: v == (coeff, exponent), values)


def poly_summary(poly):
    require(all(j == 0 for _, j in poly), 'x only')
    degree = max(i for i, _ in poly)
    return len(poly), degree, poly[(degree, 0)], poly.get((0, 0), Fraction(0))


def solve_polynomial_build(public):
    prompt = plain(public['prompt'])
    options = choice_options(public)
    m = re.fullmatch(r'The polynomial P\(x\)=(.+) is written out of order\. Which statement is true\?', prompt)
    if m:
        _, degree, lead, const = poly_summary(parse_poly(m[1]))
        values = []
        for o in options:
            t = re.fullmatch(r'Degree (\d+), leading coefficient (-?\d+), constant term (-?\d+)', plain(o['label']))
            require(t is not None, 'Unreadable statement')
            values.append(tuple(Fraction(int(v)) for v in t.groups()))
        return pick(options, lambda v: v == (degree, lead, const), values)
    m = re.fullmatch(r'Which polynomial is an? (four-term polynomial|trinomial|binomial) of degree (\d+) with a leading coefficient of (-?\d+) and a constant term of (-?\d+)\?', prompt)
    require(m is not None, 'Unrecognized polynomial prompt')
    terms = {'four-term polynomial': 4, 'trinomial': 3, 'binomial': 2}[m[1]]
    want = (terms, int(m[2]), Fraction(int(m[3])), Fraction(int(m[4])))
    values = [poly_summary(parse_poly(o['label'])) for o in options]
    require(len({tuple(sorted(parse_poly(o['label']).items())) for o in options}) == 4, 'Duplicate polynomials')
    return pick(options, lambda v: v == want, values)


def solve_quadrilateral(public):
    prompt = plain(public['prompt'])
    options = choice_options(public)
    m = re.fullmatch(r'Quadrilateral (\w{4}) is a parallelogram\. Which additional fact is enough to prove that \1 is a (rhombus|rectangle)\?', prompt)
    if m:
        # Parallelogram characterizations; each label maps to the property it states.
        rhombus = {'Its diagonals are perpendicular.', 'A diagonal bisects a pair of opposite angles.', 'Two consecutive sides are congruent.'}
        rectangle = {'One of its angles is a right angle.', 'Its diagonals are congruent.'}
        always = {'Its opposite angles are congruent.', 'Its opposite sides are congruent.', 'Its diagonals bisect each other.'}
        labels = [o['label'] for o in options]
        require(all(l in rhombus | rectangle | always for l in labels), 'Unknown property statement')
        good = rhombus if m[2] == 'rhombus' else rectangle
        return pick(options, lambda v: v in good, labels)
    m = re.fullmatch(r'In trapezoid ABCD, \\overline\{AB\}\\parallel\\overline\{DC\}\. The angles \\angle A and \\angle D lie on leg \\overline\{AD\}, with m\\angle A=\((-?\d*)x([+-]\d+)\)\^\\circ and m\\angle D=\((-?\d*)x([+-]\d+)\)\^\\circ\. What is m\\angle ([AD])\?', prompt)
    require(m is not None, 'Unrecognized quadrilateral prompt')
    ca, ba = int(m[1] or 1), int(m[2])
    cd, bd = int(m[3] or 1), int(m[4])
    x = Fraction(180 - ba - bd, ca + cd)  # co-interior angles on a leg are supplementary
    angle = ca * x + ba if m[5] == 'A' else cd * x + bd
    require(0 < ca * x + ba < 180 and 0 < cd * x + bd < 180, 'Angles must be valid')
    values = [number(o['label'].replace('°', '')) for o in options]
    return pick(options, lambda v: v == angle, values)


def solve_segment(public):
    prompt = plain(public['prompt'])
    options = choice_options(public)
    lin = r'(\d*)x([+-]\d+)'
    m = re.fullmatch(r'In triangle (\w{3}), (\w) and (\w) are the midpoints of \\overline\{(\w{2})\} and \\overline\{(\w{2})\}\. (\w{2})=' + lin + r' and (\w{2})=' + lin + r'\. What is the length (\w{2})\?', prompt)
    if m:
        tri, pa, pb, s1, s2, mid, ma, mb, side, sa, sb, ask = m.groups()
        require(s1 == tri[0] + tri[1] and s2 == tri[0] + tri[2] and side == tri[1] + tri[2] and ask == side and mid == pa + pb, 'Midsegment labels inconsistent')
        # Midsegment is half the opposite side: 2*mid = side.
        a = 2 * int(ma or 1) - int(sa or 1)
        b = int(sb) - 2 * int(mb)
        x = Fraction(b, a)
        value = int(sa or 1) * x + int(sb)
        require(x > 0 and int(ma or 1) * x + int(mb) > 0, 'Lengths must be positive')
        values = [number(o['label']) for o in options]
        return pick(options, lambda v: v == value, values)
    m = re.fullmatch(r'Point P is on the perpendicular bisector of \\overline\{AB\}\. PA=' + lin + r' and PB=' + lin + r'\. What is the length PA\?', prompt)
    if m:
        ca, ba, cb, bb = int(m[1] or 1), int(m[2]), int(m[3] or 1), int(m[4])
        require(ca != cb, 'Equation must have one solution')
        x = Fraction(bb - ba, ca - cb)
        value = ca * x + ba
        require(value > 0, 'Length must be positive')
        values = [number(o['label']) for o in options]
        return pick(options, lambda v: v == value, values)
    m = re.fullmatch(r'In triangle (\w{3}), (\w) is the midpoint of \\overline\{(\w{2})\} and (\w) is the midpoint of \\overline\{(\w{2})\}\. Which statement must be true\?', prompt)
    if m:
        tri, p1, s1, p2, s2 = m.groups()
        require(s1 == tri[0] + tri[1] and s2 == tri[0] + tri[2], 'Midpoint labels inconsistent')
        opposite = tri[1] + tri[2]
        parsed = []
        for o in options:
            t = plain(o['label']).replace('\\text{ and }', ' and ')
            r = re.fullmatch(r'\\overline\{(\w{2})\}\\(parallel|perp)\\overline\{(\w{2})\} and (\w{2})=(?:(\d+)|\\frac\{(\d+)\}\{(\d+)\})?(\w{2})', t)
            require(r is not None, f'Unreadable midsegment statement {o["label"]!r}')
            ratio = Fraction(int(r[5])) if r[5] else Fraction(int(r[6]), int(r[7])) if r[6] else Fraction(1)
            parsed.append((r[1] == p1 + p2, r[2], r[3], r[4] == p1 + p2, ratio, r[8]))
        want = (True, 'parallel', opposite, True, Fraction(1, 2), opposite)
        return pick(options, lambda v: v == want, parsed)
    m = re.fullmatch(r'In triangle ABC, line \\ell is the perpendicular bisector of \\overline\{AB\}\. Line \\ell meets \\overline\{AC\} at point P\. Which statement must be true\?', prompt)
    require(m is not None, 'Unrecognized segment prompt')
    labels = [plain(o['label']) for o in options]
    return pick(options, lambda v: v == 'PA=PB', labels)


def solve_third_side(public):
    m = re.fullmatch(r'Two sides of a triangle have lengths (\d+) and (\d+)\. Which length could( not)? be the third side\?', plain(public['prompt']))
    require(m is not None, 'Unrecognized triangle prompt')
    a, b = int(m[1]), int(m[2])
    options = choice_options(public)
    values = [int(plain(o['label'])) for o in options]
    possible = lambda c: abs(a - b) < c < a + b
    return pick(options, (lambda v: not possible(v)) if m[3] else possible, values)


def numeric_answer(public, problem=None):
    prompt = plain(public['prompt'])
    require(public['response']['kind'] == 'number', 'Numeric response required')
    t = public['templateId']
    if t == 'rg-solid-density':
        m = re.fullmatch(r'A rectangular tank is (\d+) centimeters long, (\d+) centimeters wide and (\d+) centimeters high\. Water fills the tank to a level (\d+) centimeters below the top\. How many liters of water are in the tank\?', prompt)
        if m:
            l, w, h, d = map(int, m.groups())
            require(d < h, 'Water level must be above the base')
            return Fraction(l * w * (h - d), 1000)
        m = re.fullmatch(r'A sculptor has (\d+) kilograms of clay\. The clay has a density of ([\d.]+) grams per cubic centimeter\. Each pyramid has a square base with side (\d+) centimeters and a height of (\d+) centimeters\. How many whole pyramids can be made\?', prompt)
        if m:
            kg, dens, s, h = int(m[1]), Fraction(m[2]), int(m[3]), int(m[4])
            volume = Fraction(kg * 1000) / dens  # cm^3 of clay
            return Fraction(math.floor(volume / Fraction(s * s * h, 3)))
        m = re.fullmatch(r'A log is shaped like a cylinder with a diameter of (\d+) inches and a height of (\d+) feet\. The wood weighs (\d+) pounds per cubic foot\. Use a calculator and the \\pi key\. To the nearest pound, how much does the log weigh\?', prompt)
        require(m is not None, 'Unrecognized density prompt')
        d, h, w = map(int, m.groups())
        value = math.pi * (d / 24) ** 2 * h * w
        require(abs(value - math.floor(value) - 0.5) > 1e-6, 'Pound rounding too close to a tie')
        return Fraction(round(value))
    if t == 'rg-parallelogram-perpendicular':
        m = re.fullmatch(r'In parallelogram ABCD, m\\angle (ABC|ADC)=(\d+)\^\\circ\. Point E is on (side [BD]C|line [BD]C so that [BD] is between E and C)(?: with|,)? ?(?:so that )?(?:and )?\\overline\{AE\}\\perp\\overline\{[BD]C\}\. What is m\\angle ([BD]AE) in degrees\?', prompt)
        require(m is not None, 'Unrecognized parallelogram prompt')
        angle, theta, where, ask = m[1], int(m[2]), m[3], m[4]
        vertex = angle[1]
        require(ask == vertex + 'AE' and where.split()[1][0] == vertex, 'Vertex labels inconsistent')
        if where.startswith('side'):
            require(theta < 90, 'Foot on the side requires an acute angle')
            return Fraction(90 - theta)
        require(theta > 90, 'Extended line requires an obtuse angle')
        return Fraction(theta - 90)
    if t == 'rg-isosceles-right-decimal':
        m = re.fullmatch(r'Each leg of an isosceles right triangle is (\d+) centimeters long\. To the nearest tenth of a centimeter, how long is the hypotenuse\?', prompt)
        if m:
            return sqrt_tenth(Fraction(2 * int(m[1]) ** 2))
        m = re.fullmatch(r'The hypotenuse of an isosceles right triangle is (\d+) inches long\. To the nearest tenth of an inch, how long is each leg\?', prompt) or \
            re.fullmatch(r'A square has a diagonal of (\d+) feet\. To the nearest tenth of a foot, how long is each side\?', prompt)
        require(m is not None, 'Unrecognized isosceles prompt')
        return sqrt_tenth(Fraction(int(m[1]) ** 2, 2))
    if t == 'rg-triangle-area-sas':
        m = re.fullmatch(r'A triangular lot has two sides of (\d+) feet and (\d+) feet that meet at an angle of (\d+)°\. Use a calculator in degree mode\. To the nearest tenth, what is the area of the lot in square feet\?', prompt) or \
            re.fullmatch(r'In triangle ABC, AB=(\d+), BC=(\d+) and m\\angle B=(\d+)\^\\circ\. Use a calculator in degree mode\. To the nearest tenth, what is the area of the triangle\?', prompt)
        require(m is not None, 'Unrecognized SAS area prompt')
        a, b, c = map(int, m.groups())
        require(0 < c < 180, 'Included angle must be a triangle angle')
        area = a * b * math.sin(math.radians(c)) / 2
        require(abs(area * 10 - math.floor(area * 10) - 0.5) > 1e-6, 'Area too close to a rounding tie')
        return Fraction(round(area * 10), 10)
    if t == 'rg-altitude-segment':
        m = re.fullmatch(r'In right triangle ABC, the right angle is at C\. Altitude \\overline\{CD\} meets the hypotenuse \\overline\{AB\} at D\. AC=(\d+) and AD=(\d+)\. To the nearest tenth, what is the length DB\?', prompt)
        require(m is not None, 'Unrecognized altitude prompt')
        ac, ad = int(m[1]), int(m[2])
        require(ac > ad, 'Leg must exceed its projection')
        return round_tenth(Fraction(ac * ac, ad) - ad)  # AC^2 = AD * AB
    raise ValueError('Unexpected numeric template')


CHOICE_SOLVERS = {
    'rg-exponential-base-rate': solve_exponential,
    'rg-factor-completely': solve_factor,
    'rg-polynomial-zeros-forms': solve_zeros,
    'rg-exponent-monomial-power': solve_monomial,
    'rg-rational-exponent-forms': solve_rational,
    'rg-polynomial-build': solve_polynomial_build,
    'rg-quadrilateral-choice': solve_quadrilateral,
    'rg-segment-property-choice': solve_segment,
    'rg-triangle-third-side-test': solve_third_side,
}


def solve(public):
    require(public['templateId'] in SUPPORTED, 'Unexpected Regents gap template')
    require(public.get('figure') is None, 'Unexpected figure')
    if public['templateId'] in CHOICE:
        return CHOICE_SOLVERS[public['templateId']](public)
    return numeric_answer(public)


def review_problem(problem):
    public = problem['public']
    result = solve(public)
    if public['templateId'] in CHOICE:
        require(result == problem['answer'], 'Choice answer key mismatch')
        labels = {o['id']: plain(o['label']) for o in public['response']['options']}
        correct = labels[result]
        for field in ('prompt',):
            require(len(correct) < 4 or correct not in plain(public[field]), 'Prompt leaks the correct label')
        require(len(correct) < 4 or correct not in plain(problem.get('hint', '')), 'Hint leaks the correct label')
        require(result not in (problem.get('choiceFeedback') or {}), 'Correct choice has wrong-answer feedback')
    else:
        require(isinstance(problem['answer'], (int, float, str)) and not isinstance(problem['answer'], bool), 'Numeric answer required')
        require(Fraction(str(problem['answer'])) == result, f'Numeric answer mismatch: {problem["answer"]} != {result}')
        hint = plain(problem.get('hint', ''))
        text = str(problem['answer'])
        require(len(text) < 3 or not re.search(r'(?<![\d.])' + re.escape(text) + r'(?![\d])', hint), 'Hint leaks the numeric answer')
    return result


# ---------- self-test with corrupted fixtures ----------
def mk(template, prompt, labels=None, answer=None):
    response = {'kind': 'number'} if labels is None else {'kind': 'choice', 'options': [{'id': f'option-{c}', 'label': l} for c, l in zip('abcd', labels)]}
    return {'public': {'templateId': template, 'prompt': prompt, 'response': response}, 'answer': answer, 'hint': ''}


def self_test():
    good = [
        mk('rg-exponential-base-rate', 'A quantity is modeled by $Q(t)=6500(0.92)^{t/6}$, where $t$ is time in years. Which statement is true?',
           ['It decreases by 48% every 6 years.', 'It decreases by 8% every 6 years.', 'It decreases by 8% each year.', 'It increases by 8% every 6 years.'], 'option-b'),
        mk('rg-exponential-base-rate', 'A medicine has a half-life of 2 hours: the amount in the body is cut in half every 2 hours. A patient takes 800 mg. Which function models the amount $A(t)$ in mg remaining $t$ hours after the dose?',
           ['$A(t)=800(0.5)^{t-2}$', '$A(t)=800(2)^{t/2}$', '$A(t)=800(0.5)^{2t}$', '$A(t)=800(0.5)^{t/2}$'], 'option-d'),
        mk('rg-factor-completely', 'Which expression is $12x^{3}-27xy^{2}$ factored completely?',
           ['$3x(2x-3y)(2x+3y)$', '$x(6x-3y)(6x+3y)$', '$3x(4x^{2}-9y^{2})$', '$3x(2x-3y)^{2}$'], 'option-a'),
        mk('rg-polynomial-zeros-forms', 'Which value is a zero of $f(x)=x^{3}+2x^{2}-16x-32$?', ['16', '2', '4', '8'], 'option-c'),
        mk('rg-polynomial-zeros-forms', 'What are the zeros of $f(x)=x(2x-7)(x+2)$?',
           ['$-2,\\ \\frac{7}{2}$', '$-2,\\ 0,\\ 7$', '$-2,\\ 0,\\ \\frac{2}{7}$', '$-2,\\ 0,\\ \\frac{7}{2}$'], 'option-d'),
        mk('rg-exponent-monomial-power', 'Which expression is equivalent to $(4x)^{2}(-3xy)$?', ['$-48x^{2}y$', '$-48x^{4}y$', '$-12x^{3}y$', '$-48x^{3}y$'], 'option-d'),
        mk('rg-rational-exponent-forms', 'What is the value of $\\left(\\frac{9}{16}\\right)^{-\\frac{3}{2}}$?', ['$\\frac{12}{9}$', '$-\\frac{27}{64}$', '$\\frac{64}{27}$', '$\\frac{16}{9}$'], 'option-c'),
        mk('rg-rational-exponent-forms', 'Which expression is $\\left(\\frac{x}{y}\\right)^{-\\frac{4}{3}}$, for $x>0$ and $y>0$, written in radical form?',
           ['$\\sqrt[3]{\\left(\\frac{y}{x}\\right)^{4}}$', '$\\frac{1}{\\sqrt[3]{x}}$', '$\\sqrt[4]{\\left(\\frac{y}{x}\\right)^{3}}$', '$\\sqrt[3]{\\left(\\frac{x}{y}\\right)^{4}}$'], 'option-a'),
        mk('rg-rational-exponent-forms', 'Which expression is equivalent to $5\\sqrt[4]{x}\\cdot 6x^{\\frac{1}{2}}$, for $x>0$?',
           ['$30x^{\\frac{1}{8}}$', '$30x^{\\frac{1}{4}}$', '$11x^{\\frac{3}{4}}$', '$30x^{\\frac{3}{4}}$'], 'option-d'),
        mk('rg-polynomial-build', 'Which polynomial is a four-term polynomial of degree 4 with a leading coefficient of $5$ and a constant term of $-7$?',
           ['$-7x^{4}-6x^{3}+x^{2}+5$', '$5x^{4}-6x^{3}+x^{2}-7$', '$5x^{4}-6x^{3}+x^{2}+3x-7$', '$5x^{4}-6x^{3}-7$'], 'option-b'),
        mk('rg-polynomial-build', 'The polynomial $P(x)=-6-9x^{3}+2x^{4}+2x^{2}$ is written out of order. Which statement is true?',
           ['Degree 3, leading coefficient 2, constant term -6', 'Degree 4, leading coefficient 2, constant term 6', 'Degree 4, leading coefficient -6, constant term -6', 'Degree 4, leading coefficient 2, constant term -6'], 'option-d'),
        mk('rg-quadrilateral-choice', 'Quadrilateral ABCD is a parallelogram. Which additional fact is enough to prove that ABCD is a rhombus?',
           ['One of its angles is a right angle.', 'Its opposite angles are congruent.', 'Its diagonals are congruent.', 'Its diagonals are perpendicular.'], 'option-d'),
        mk('rg-quadrilateral-choice', 'In trapezoid ABCD, $\\overline{AB}\\parallel\\overline{DC}$. The angles $\\angle A$ and $\\angle D$ lie on leg $\\overline{AD}$, with $m\\angle A=(5x+27)^\\circ$ and $m\\angle D=(x+39)^\\circ$. What is $m\\angle D$?',
           ['58°', '42°', '43°', '122°'], 'option-a'),
        mk('rg-segment-property-choice', 'In triangle XYZ, M and N are the midpoints of $\\overline{XY}$ and $\\overline{XZ}$. $MN=2x+4$ and $YZ=3x+13$. What is the length YZ?', ['14', '28', '5', '42'], 'option-b'),
        mk('rg-segment-property-choice', 'In triangle ABC, line $\\ell$ is the perpendicular bisector of $\\overline{AB}$. Line $\\ell$ meets $\\overline{AC}$ at point P. Which statement must be true?',
           ['$AB=2PA$', '$PA=PB$', '$\\angle APB=90^\\circ$', '$PA=PC$'], 'option-b'),
        mk('rg-segment-property-choice', 'In triangle XYZ, M is the midpoint of $\\overline{XY}$ and N is the midpoint of $\\overline{XZ}$. Which statement must be true?',
           ['$\\overline{MN}\\parallel\\overline{YZ}\\text{ and }MN=\\frac{1}{2}YZ$', '$\\overline{MN}\\perp\\overline{YZ}\\text{ and }MN=\\frac{1}{2}YZ$', '$\\overline{MN}\\parallel\\overline{YZ}\\text{ and }MN=YZ$', '$\\overline{MN}\\parallel\\overline{XY}\\text{ and }MN=\\frac{1}{2}XY$'], 'option-a'),
        mk('rg-triangle-third-side-test', 'Two sides of a triangle have lengths 6 and 17. Which length could be the third side?', ['16', '24', '10', '11'], 'option-a'),
        mk('rg-triangle-third-side-test', 'Two sides of a triangle have lengths 7 and 16. Which length could not be the third side?', ['20', '22', '23', '18'], 'option-c'),
        mk('rg-solid-density', 'A rectangular tank is 50 centimeters long, 50 centimeters wide and 45 centimeters high. Water fills the tank to a level 6 centimeters below the top. How many liters of water are in the tank?', None, 97.5),
        mk('rg-solid-density', 'A sculptor has 40 kilograms of clay. The clay has a density of 1.8 grams per cubic centimeter. Each pyramid has a square base with side 6 centimeters and a height of 9 centimeters. How many whole pyramids can be made?', None, 205),
        mk('rg-solid-density', 'A log is shaped like a cylinder with a diameter of 26 inches and a height of 6 feet. The wood weighs 49 pounds per cubic foot. Use a calculator and the $\\pi$ key. To the nearest pound, how much does the log weigh?', None, 1084),
        mk('rg-parallelogram-perpendicular', 'In parallelogram ABCD, $m\\angle ABC=62^\\circ$. Point E is on side BC with $\\overline{AE}\\perp\\overline{BC}$. What is $m\\angle BAE$ in degrees?', None, 28),
        mk('rg-parallelogram-perpendicular', 'In parallelogram ABCD, $m\\angle ABC=107^\\circ$. Point E is on line BC so that B is between E and C, and $\\overline{AE}\\perp\\overline{BC}$. What is $m\\angle BAE$ in degrees?', None, 17),
        mk('rg-isosceles-right-decimal', 'Each leg of an isosceles right triangle is 9 centimeters long. To the nearest tenth of a centimeter, how long is the hypotenuse?', None, 12.7),
        mk('rg-isosceles-right-decimal', 'A square has a diagonal of 31 feet. To the nearest tenth of a foot, how long is each side?', None, 21.9),
        mk('rg-triangle-area-sas', 'A triangular lot has two sides of 10 feet and 21 feet that meet at an angle of 29°. Use a calculator in degree mode. To the nearest tenth, what is the area of the lot in square feet?', None, 50.9),
        mk('rg-altitude-segment', 'In right triangle ABC, the right angle is at C. Altitude $\\overline{CD}$ meets the hypotenuse $\\overline{AB}$ at D. $AC=21$ and $AD=3$. To the nearest tenth, what is the length DB?', None, 144.0),
    ]
    rejected = 0

    def reject(problem, why):
        nonlocal rejected
        try:
            review_problem(problem)
        except (ValueError, KeyError, IndexError, ZeroDivisionError):
            rejected += 1
            return
        raise ValueError(f'Corrupt Regents gap case was accepted: {why}')
    for case in good:
        review_problem(case)
        bad = copy.deepcopy(case)
        if case['public']['response']['kind'] == 'choice':
            bad['answer'] = 'option-a' if case['answer'] != 'option-a' else 'option-b'
            reject(bad, 'wrong key')
            # Duplicate / second-correct: copy the correct label onto a wrong option.
            bad = copy.deepcopy(case)
            options = bad['public']['response']['options']
            right = next(o for o in options if o['id'] == case['answer'])
            wrong = next(o for o in options if o['id'] != case['answer'])
            wrong['label'] = right['label']
            reject(bad, 'duplicate correct choice')
            bad = copy.deepcopy(case)
            bad['public']['response']['options'][0 if case['answer'] != 'option-a' else 1]['label'] = '$999$'
            if case['public']['templateId'] in ('rg-quadrilateral-choice', 'rg-segment-property-choice', 'rg-exponential-base-rate') and '$999$' not in str(case):
                pass
            bad2 = copy.deepcopy(case)
            next(o for o in bad2['public']['response']['options'] if o['id'] == case['answer'])['label'] = '21' if 'could not' in case['public']['prompt'] else '$777$'
            reject(bad2, 'no correct choice')
        else:
            bad['answer'] = float(case['answer']) + 0.1
            reject(bad, 'off numeric answer')
    incomplete = mk('rg-factor-completely', 'Which expression is $12x^{3}-12xy^{2}$ factored completely?',
                    ['$3x(2x-2y)^{2}$', '$x(6x-2y)(6x+2y)$', '$3x(2x-2y)(2x+2y)$', '$3(2x-2y)(2x+2y)$'], 'option-c')
    reject(incomplete, 'keyed factorization still has a common factor in each binomial')
    reject(mk('rg-polynomial-zeros-forms', 'What are the zeros of $f(x)=x(2x-7)(x+2)$?',
              ['$-2,\\ \\frac{7}{2}$', '$-2,\\ 0,\\ 7$', '$-2,\\ 0,\\ \\frac{7}{2}$', '$-2,\\ 0,\\ \\frac{14}{4}$'], 'option-c'),
           'mathematically duplicate zero sets')
    return {'fixtures': len(good), 'rejectedMutations': rejected}

# Read by independent-math-review.py (FamilyOracle).
CHOICE_REVIEW = CHOICE



if __name__ == '__main__':
    print(self_test())
