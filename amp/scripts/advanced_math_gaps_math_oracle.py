"""Independent review of series/recursion, compound growth, factoring patterns,
residual fits and exponential/logarithmic graph features.

Every answer is derived from the public prompt, choices and figure only. Exact
Fraction/Decimal arithmetic is used wherever the answer is exact; stated roundings
(nearest dollar, nearest tenth of a percent) use half-up rounding on exact or
50-digit values, and a value within 1e-6 of a rounding tie is rejected. Nothing here
reads the generator's case or answer logic. Both `\\frac{a}{b}` and `a/b` fraction
forms are accepted (the central script retries each review with a plain-text reading).
"""
import copy
import itertools
import math
import re
from decimal import Decimal, ROUND_HALF_UP, getcontext
from fractions import Fraction

getcontext().prec = 60

SERIES = 'series-recursion'
GROWTH = 'compound-growth'
FACTOR = 'polynomial-factoring-patterns'
RESIDUAL = 'residual-function-fit'
GRAPH = 'function-graph-features'
SUPPORTED = frozenset({SERIES, GROWTH, FACTOR, RESIDUAL, GRAPH})
CHOICE = SUPPORTED


def require(condition, message):
    if not condition:
        raise ValueError(message)


# ------------------------------------------------------------------ text
def plain(text):
    s = text.replace('$', '').replace('−', '-').replace('\\ ', ' ').replace('\\,', ' ')
    s = s.replace('\\left', '').replace('\\right', '').replace('\\dfrac', '\\frac')
    s = s.replace('\\tfrac', '\\frac')
    s = re.sub(r'\\text\{([^{}]*)\}', r'\1', s)
    s = re.sub(r'\\frac\{([^{}]*)\}\{([^{}]*)\}', r'(\1)/(\2)', s)
    return s.replace('\\quad', ' ')


def math_segments(prompt):
    return re.findall(r'\$([^$]*)\$', prompt)


def evaluate(text, numeric=Fraction, **variables):
    """Value of a displayed expression with implicit products, over Fraction or float."""
    s = plain(text).replace('\\cdot', '*').replace('\\times', '*')
    s = re.sub(r'a_\{?n\}?', 'A', s)
    s = re.sub(r'\^\{([^{}]*)\}', r'**(\1)', s)
    s = re.sub(r'\^(-?\d+|[a-zA-Z])', r'**(\1)', s)
    s = s.replace('{', '(').replace('}', ')')
    s = re.sub(r'\s+', '', s)
    require(re.fullmatch(r'[0-9A-Za-z+\-*/().]*', s) is not None, f'Cannot read expression: {text}')
    for _ in range(3):
        s = re.sub(r'(\d|[A-Za-z]|\))(?=[A-Za-z(])', r'\1*', s)
        s = re.sub(r'(\))(?=\d)', r'\1*', s)
    s = re.sub(r'\d+(?:\.\d+)?', lambda m: f"N('{m.group(0)}')", s)
    scope = {'N': numeric, **{k: numeric(v) for k, v in variables.items()}}
    try:
        return eval(s, {'__builtins__': {}}, scope)  # restricted: digits, variables, operators
    except Exception as error:
        raise ValueError(f'Cannot evaluate {text}: {error}')


def choice_options(public):
    response = public['response']
    require(response['kind'] == 'choice', 'Choice response required')
    options = response['options']
    require(len(options) == 4 and all(set(o) == {'id', 'label'} for o in options), 'Four public choices required')
    require(len({o['id'] for o in options}) == 4, 'Duplicate choice IDs')
    return options


def pick_correct(options, truth):
    """Exactly one option satisfies truth; options must also be mathematically distinct."""
    flags = [truth(o) for o in options]
    require(sum(flags) == 1, f'Expected exactly one correct choice, found {sum(flags)}')
    return options[flags.index(True)]['id']


def integer_label(label):
    text = plain(label).replace(',', '').strip()
    require(re.fullmatch(r'-?\d+', text) is not None, f'Integer choice expected: {label}')
    return int(text)


def half_up(value, places=0):
    """Round an exact Fraction or Decimal half-up; reject values within 1e-6 of a tie."""
    scaled = Decimal(value.numerator) / Decimal(value.denominator) if isinstance(value, Fraction) else value
    scaled = scaled * (Decimal(10) ** places)
    frac = scaled - scaled.to_integral_value(rounding='ROUND_FLOOR')
    require(abs(frac - Decimal('0.5')) > Decimal('0.000001'), f'Answer sits on a rounding tie: {value}')
    return scaled.quantize(Decimal(1), rounding=ROUND_HALF_UP) / (Decimal(10) ** places)


# ------------------------------------------------------------------ series
def linear_map(rhs):
    """Read the right side of a_{n+1}=... as u*a_n+v, checking linearity."""
    f = lambda a: Fraction(evaluate(rhs, A=a))
    v, u = f(0), f(1) - f(0)
    require(f(2) == 2 * u + v and f(-3) == -3 * u + v, f'Recurrence is not linear: {rhs}')
    return u, v


def recursion_terms(first, rhs, count):
    u, v = linear_map(rhs)
    terms = [Fraction(first)]
    while len(terms) < count:
        terms.append(u * terms[-1] + v)
    return terms


def parse_recursion(text):
    s = plain(text).replace(' ', '')
    m = re.fullmatch(r'a_\{?1\}?=(-?\d+),a_\{n\+1\}=(.+)', s)
    require(m is not None, f'Recursive definition expected: {text}')
    return int(m[1]), m[2]


def arithmetic_sum(first, diff, count):
    return Fraction(count) * (2 * first + (count - 1) * diff) / 2


def solve_series(public):
    prompt, options = plain(public['prompt']), choice_options(public)
    segs = math_segments(public['prompt'])
    figure = public.get('figure')
    if prompt.startswith('Find the sum of the first'):
        m = re.fullmatch(r'Find the sum of the first (\d+) terms of the arithmetic series (.+)\.', prompt)
        require(m is not None, 'Series sum wording')
        count = int(m[1])
        shown = re.findall(r'-?\d+', m[2].replace('\\cdots', ''))
        require(len(shown) == 3 and m[2].endswith('\\cdots'), 'Three displayed terms then an ellipsis are required')
        t = [int(x) for x in shown]
        require(t[1] - t[0] == t[2] - t[1], 'Displayed terms must be arithmetic')
        expected = arithmetic_sum(t[0], t[1] - t[0], count)
        return pick_correct(options, lambda o: integer_label(o['label']) == expected)
    if prompt.startswith('A sequence is defined by'):
        require('for n≥1' in prompt.replace('\\ge', '≥').replace(' ', '') or 'n\\ge1' in public['prompt'].replace(' ', ''), 'Index range must be stated')
        s = plain(segs[0]).replace(' ', '')
        require(s.startswith('a_n=') or s.startswith('a_{n}='), 'Explicit rule expected')
        rule = s.split('=', 1)[1]
        seq = [Fraction(evaluate(rule, n=n)) for n in range(1, 9)]

        def matches(o):
            first, rhs = parse_recursion(o['label'])
            return recursion_terms(first, rhs, 8) == seq
        return pick_correct(options, matches)
    if prompt.startswith("A theater's first row has"):
        m = re.fullmatch(r"A theater's first row has (\d+) seats\. Each later row has (\d+) (more|fewer) seats than the row in front of it\. There are (\d+) rows\. How many seats are in the theater\?", prompt)
        require(m is not None, 'Theater wording')
        d = int(m[2]) * (1 if m[3] == 'more' else -1)
        expected = arithmetic_sum(int(m[1]), d, int(m[4]))
        return pick_correct(options, lambda o: integer_label(o['label']) == expected)
    if re.search(r'Which explicit rule gives', prompt):
        require(len(segs) == 4 and plain(segs[3]).replace(' ', '') in ('a_n', 'a_{n}'), 'Explicit-rule prompt segments')
        first, rhs = parse_recursion(segs[0] + ',' + segs[1] if '=' in segs[1] and segs[1].startswith('a_{n+1}') else segs[0])
        require(plain(segs[2]).replace('\\ge', '≥').replace(' ', '') == 'n≥1', 'Index range must be stated')
        seq = recursion_terms(first, rhs, 8)

        def explicit(o):
            s = plain(o['label']).replace(' ', '')
            require(s.startswith('a_n=') or s.startswith('a_{n}='), 'Explicit option expected')
            return [Fraction(evaluate(s.split('=', 1)[1], n=n)) for n in range(1, 9)] == seq
        return pick_correct(options, explicit)
    if prompt.startswith('The table shows two terms'):
        target = re.fullmatch(r'a_\{?(\d+)\}?', plain(segs[0]).replace(' ', ''))
        require(target is not None and len(segs) == 1, 'Target term wording')
        table = figure['scene']['elements'][0]
        require(table['type'] == 'table' and table['columns'] == ['a_n'] and len(table['rows']) == 2, 'Two-term table expected')
        (n1, v1), (n2, v2) = [(int(r['label']), Fraction(r['cells'][0])) for r in table['rows']]
        require(n1 != n2, 'Table indices must differ')
        d = (v2 - v1) / (n2 - n1)
        expected = v1 + (int(target[1]) - n1) * d
        return pick_correct(options, lambda o: integer_label(o['label']) == expected)
    if prompt.startswith('Evaluate'):
        m = re.fullmatch(r'\\sum_\{?k=(-?\d+)\}?\^\{?(\d+)\}?\s*\((.+)\)', segs[0].replace(' ', '') if False else segs[0].strip())
        require(m is not None, 'Summation wording')
        expected = sum(Fraction(evaluate(m[3], k=k)) for k in range(int(m[1]), int(m[2]) + 1))
        return pick_correct(options, lambda o: integer_label(o['label']) == expected)
    m = re.fullmatch(r'A sequence has (.+?) and (.+?) for (.+?)\. What is (.+?)\?', prompt)
    require(m is not None, 'Recursion evaluation wording')
    first, rhs = parse_recursion(m[1] + ',' + m[2])
    require(plain(m[3]).replace('\\ge', '≥').replace(' ', '') == 'n≥1', 'Index range must be stated')
    target = re.fullmatch(r'a_\{?(\d+)\}?', plain(m[4]).replace(' ', ''))
    require(target is not None, 'Target term')
    expected = recursion_terms(first, rhs, int(target[1]))[-1]
    return pick_correct(options, lambda o: integer_label(o['label']) == expected)


# ------------------------------------------------------------------ growth
PERIODS = {'annually': 1, 'semiannually': 2, 'quarterly': 4, 'monthly': 12}
WORD_FREQ = {'once a year': 1, 'twice a year': 2, 'four times a year': 4, 'monthly': 12}


def dollars(label):
    m = re.fullmatch(r'(\d{1,3}(?:,\d{3})*|\d+) dollars', plain(label).strip())
    require(m is not None, f'Dollar choice expected: {label}')
    return int(m[1].replace(',', ''))


def percent_label(label):
    m = re.fullmatch(r'(\d+(?:\.\d+)?)%', plain(label).strip())
    require(m is not None, f'Percent choice expected: {label}')
    return Decimal(m[1])


def dollars_prompt_number(text):
    return int(text.replace(',', ''))


def solve_growth(public):
    prompt, options = plain(public['prompt']), choice_options(public)
    segs = math_segments(public['prompt'])
    m = re.fullmatch(r'A value (grows|shrinks) (\d+(?:\.\d+)?)% each year, so (.+?) with (.+?) in years\. Which model gives the same values using \$?m\$?, the number of (quarters|months) since the start\?', prompt)
    if m:
        rate = Fraction(m[2]) / 100
        factor = 1 + rate if m[1] == 'grows' else 1 - rate
        k = {'quarters': 4, 'months': 12}[m[5]]
        lhs = segs[0].replace(' ', '')
        mm = re.fullmatch(r'V\(t\)=(\d+)\((.+)\)\^\{t\}', lhs)
        require(mm is not None, 'Annual model wording')
        require(Fraction(mm[2]) == factor, 'Displayed annual factor must match the stated percent change')
        p = int(mm[1])

        def equal(o):
            s = plain(o['label']).replace(' ', '')
            body = re.fullmatch(r'V=(\d+)(.+)', s)
            require(body is not None, f'Model option expected: {o["label"]}')
            if int(body[1]) != p:
                return False
            return all(
                math.isclose(float(evaluate(body[2], float, m=mv)), float(p and 1) * float(factor) ** (mv / k), rel_tol=1e-9)
                for mv in range(1, 25)
            )
        return pick_correct(options, equal)
    m = re.fullmatch(r'A quantity (increases|decreases) by (\d+(?:\.\d+)?)% each (month|quarter), with each change applied to the previous (?:month|quarter)\'s value\. By what percent does it (?:increase|decrease) over one year\? Round to the nearest tenth of a percent\.', prompt)
    if m:
        rate = Fraction(m[2]) / 100
        periods = {'month': 12, 'quarter': 4}[m[3]]
        total = (1 + rate) ** periods - 1 if m[1] == 'increases' else 1 - (1 - rate) ** periods
        expected = half_up(total * 100, 1)
        return pick_correct(options, lambda o: percent_label(o['label']) == expected)
    m = re.fullmatch(r'(\d[\d,]*) dollars is deposited at (\d+(?:\.\d+)?)% annual interest, compounded (continuously|annually|semiannually|quarterly|monthly)(?: \((\d+) times per year\))?\.(?: Use (.+?)\.)? What is the balance after (\d+) years, rounded to the nearest dollar\?', prompt)
    if m:
        principal, rate, t = dollars_prompt_number(m[1]), Fraction(m[2]) / 100, int(m[6])
        if m[3] == 'continuously':
            require(m[4] is None, 'Continuous compounding has no per-year count')
            if m[5]:
                require(plain(m[5]).replace(' ', '') == 'A=Pe^{rt}'.replace('{', '').replace('}', '') or m[5].replace(' ', '') == 'A=Pe^{rt}', 'Stated continuous formula')
            exponent = Decimal(rate.numerator) / Decimal(rate.denominator) * t
            balance = Decimal(principal) * exponent.exp()
        else:
            n = PERIODS[m[3]]
            require(m[4] is None or int(m[4]) == n, 'Stated compounding count contradicts the wording')
            require((m[3] == 'annually') == (m[4] is None), 'Count in parentheses is required except for annual compounding')
            if m[5]:
                require(m[5].replace(' ', '') == 'A=P(1+r/n)^{nt}', 'Stated compound formula')
            balance = Fraction(principal) * (1 + rate / n) ** (n * t)
        expected = int(half_up(balance))
        return pick_correct(options, lambda o: dollars(o['label']) == expected)
    m = re.fullmatch(r'The balance of an account is (.+?), where (.+?) is in years\. Which statement describes the account\?', prompt)
    require(m is not None, 'Unrecognized compound-growth wording')
    mm = re.fullmatch(r'B\(t\)=(\d+)\((\d+(?:\.\d+)?)\)\^\{(\d+)t\}', segs[0].replace(' ', ''))
    require(mm is not None, 'Account model wording')
    per_period, n = Fraction(mm[2]) - 1, int(mm[3])

    def statement(o):
        s = plain(o['label']).strip()
        a = re.fullmatch(r'It earns (\d+(?:\.\d+)?)% annual interest, compounded (once a year|twice a year|four times a year|monthly|(\d+) times a year)\.', s)
        if a:
            freq = int(a[3]) if a[3] else WORD_FREQ[a[2]]
            # Annual interest is the nominal annual rate: per-period rate times periods per year.
            return Fraction(a[1]) / 100 == per_period * n and freq == n
        b = re.fullmatch(r'It earns (\d+(?:\.\d+)?)% interest in every compounding period, (once a year|twice a year|four times a year|monthly|(\d+) times a year)\.', s)
        require(b is not None, f'Account statement expected: {o["label"]}')
        freq = int(b[3]) if b[3] else WORD_FREQ[b[2]]
        return Fraction(b[1]) / 100 == per_period and freq == n
    return pick_correct(options, statement)


# ------------------------------------------------------------------ polynomials
def poly_mul(a, b):
    out = [0] * (len(a) + len(b) - 1)
    for i, x in enumerate(a):
        for j, y in enumerate(b):
            out[i + j] += x * y
    return out


def trim(c):
    c = list(c)
    while len(c) > 1 and c[-1] == 0:
        c.pop()
    return c


def parse_poly(text):
    """Sum of integer monomials in x, as ascending integer coefficients."""
    s = plain(text).replace(' ', '').replace('{', '').replace('}', '')
    terms = re.findall(r'[+-]?[^+-]+', s)
    require(terms and ''.join(terms) == s, f'Polynomial expected: {text}')
    coef = {}
    for t in terms:
        m = re.fullmatch(r'([+-]?)(\d*)(?:(x)(?:\^(\d+))?)?', t)
        require(m is not None and (m[2] or m[3]), f'Monomial expected: {t}')
        value = int(m[2]) if m[2] else 1
        value = -value if m[1] == '-' else value
        degree = (int(m[4]) if m[4] else 1) if m[3] else 0
        coef[degree] = coef.get(degree, 0) + value
    return [coef.get(i, 0) for i in range(max(coef) + 1)]


def parse_product(text):
    """Product of an integer constant and factors (poly)^k or x^k, as (constant, [(coefs, mult)])."""
    s = plain(text).replace(' ', '').replace('{', '').replace('}', '')
    constant, factors, pos = 1, [], 0
    m = re.match(r'-?\d+', s)
    if m and not s[m.end():m.end() + 1] == '^':
        constant, pos = int(m[0]), m.end()
    elif s.startswith('-') and s[1:2] in ('(', 'x'):
        constant, pos = -1, 1
    while pos < len(s):
        m = re.match(r'\(([^()]*)\)(?:\^(\d+))?', s[pos:])
        if m:
            factors.append((parse_poly(m[1]), int(m[2]) if m[2] else 1))
        else:
            m = re.match(r'x(?:\^(\d+))?', s[pos:])
            require(m is not None, f'Factor expected in {text}')
            factors.append(([0, 1], int(m[1]) if m[1] else 1))
        pos += m.end()
    return constant, factors


def expand(constant, factors):
    out = [constant]
    for coefs, mult in factors:
        for _ in range(mult):
            out = poly_mul(out, coefs)
    return trim(out)


def divisors(n):
    n = abs(n)
    return [d for d in range(1, n + 1) if n % d == 0]


def poly_eval(c, x):
    return sum(Fraction(a) * x ** i for i, a in enumerate(c))


def has_rational_root(c):
    c = trim(c)
    if c[0] == 0:
        return True
    return any(poly_eval(c, Fraction(sign * p, q)) == 0
               for p in divisors(c[0]) for q in divisors(c[-1]) for sign in (1, -1))


def has_quadratic_split(c):
    """Whether a quartic splits as two integer quadratics (Gauss's lemma)."""
    c = trim(c)
    for a in divisors(c[4]):
        d = c[4] // a
        for f1 in divisors(c[0]):
            for sg in (1, -1):
                cc, ff = sg * f1, c[0] // (sg * f1)
                # x^3: a e + b d = c3 ; x: b ff + cc e = c1 ; solve for b, e.
                det = -(a * ff) + 0 if False else (d * cc - a * ff)
                # unknowns b,e: [d a; ff cc][b e]^T = [c3 c1]^T
                det = d * cc - a * ff
                if det == 0:
                    continue
                b = Fraction(c[3] * cc - a * c[1], det)
                e = Fraction(d * c[1] - ff * c[3], det)
                if b.denominator != 1 or e.denominator != 1:
                    continue
                b, e = int(b), int(e)
                if poly_mul([cc, b, a], [ff, e, d]) == c:
                    return True
    return False


def irreducible(c):
    c = trim(c)
    degree = len(c) - 1
    require(1 <= degree <= 4, f'Unsupported factor degree {degree}')
    if degree == 1:
        return True
    if degree == 2:
        disc = c[1] ** 2 - 4 * c[2] * c[0]
        return disc < 0 or math.isqrt(disc) ** 2 != disc
    if has_rational_root(c):
        return False
    return degree == 3 or not has_quadratic_split(c)


def primitive(c):
    return math.gcd(*[abs(x) for x in c]) == 1


def equals_target(segment, target):
    try:
        return expand(*parse_product(segment)) == trim(target)
    except ValueError:
        return False


def complete_factorization(constant, factors):
    return all(primitive(c) and irreducible(c) for c, _ in factors)


def canonical(constant, factors):
    items = []
    for coefs, mult in factors:
        c = list(coefs)
        if c[-1] < 0:
            c = [-x for x in c]
            constant = constant * (-1) ** mult
        items.append((tuple(c), mult))
    return constant, tuple(sorted(items))


def merged(constant, factors):
    counts = {}
    for coefs, mult in factors:
        c = tuple(coefs)
        counts[c] = counts.get(c, 0) + mult
    return canonical(constant, [(list(k), v) for k, v in counts.items()])


def solve_factor(public):
    options = choice_options(public)
    m = re.fullmatch(r'Which is the complete factorization of (.+) over the integers\?', plain(public['prompt']))
    require(m is not None, '"complete factorization ... over the integers" must be stated')
    target = parse_poly(m[1])
    forms = []
    for o in options:
        constant, factors = parse_product(o['label'])
        forms.append((constant, factors))
    require(len({merged(*f) for f in forms}) == 4, 'Mathematically duplicate factorizations')
    return pick_correct(options, lambda o: (lambda f: expand(*f) == trim(target) and complete_factorization(*f))(forms[options.index(o)]))


# ------------------------------------------------------------------ residuals
def fit_quadratic(xs, ys):
    s = [sum(x ** k for x in xs) for k in range(5)]
    t = [sum(y * x ** k for x, y in zip(xs, ys)) for k in range(3)]
    mat = [[s[i + j] for j in range(3)] + [t[i]] for i in range(3)]
    for i in range(3):
        p = max(range(i, 3), key=lambda r: abs(mat[r][i]))
        mat[i], mat[p] = mat[p], mat[i]
        for r in range(3):
            if r != i:
                f = mat[r][i] / mat[i][i]
                mat[r] = [a - f * b for a, b in zip(mat[r], mat[i])]
    return [mat[i][3] / mat[i][i] for i in range(3)]


def residual_pattern(points):
    """curve-up, curve-down or none, from the plotted residuals alone."""
    xs, ys = [float(p[0]) for p in points], [float(p[1]) for p in points]
    require(len(points) >= 7 and xs == sorted(xs), 'Residual plot needs ordered points')
    c = fit_quadratic(xs, ys)
    mean = sum(ys) / len(ys)
    sst = sum((y - mean) ** 2 for y in ys)
    ssr = sum((y - (c[0] + c[1] * x + c[2] * x * x)) ** 2 for x, y in zip(xs, ys))
    r2 = 1 - ssr / sst
    signs = [y > 0 for y in ys if y != 0]
    runs = 1 + sum(1 for a, b in zip(signs, signs[1:]) if a != b)
    if r2 >= 0.9:
        # A curved residual pattern is a single sign run in the middle flanked by the opposite sign.
        require(runs == 3 and signs[0] == signs[-1] and signs[0] == (c[2] > 0), 'Curved residuals must be a clean U or arch')
        return 'up' if c[2] > 0 else 'down'
    require(r2 <= 0.4 and runs >= 2, f'Residual pattern is neither clearly curved nor patternless (R2={r2:.2f})')
    return 'none'


def table_kind(rows):
    xs = [Fraction(r['label']) for r in rows]
    ys = [Fraction(r['cells'][0]) for r in rows]
    require(len(ys) >= 5 and all(b - a == xs[1] - xs[0] for a, b in zip(xs, xs[1:])), 'Equally spaced x values with at least five rows')
    d1 = [b - a for a, b in zip(ys, ys[1:])]
    d2 = [b - a for a, b in zip(d1, d1[1:])]
    ratios = [b / a for a, b in zip(ys, ys[1:])] if all(y != 0 for y in ys[:-1]) else None
    linear = len(set(d1)) == 1
    quadratic = len(set(d2)) == 1 and d2[0] != 0
    exponential = ratios is not None and len(set(ratios)) == 1 and ratios[0] > 0 and ratios[0] != 1
    kinds = [k for k, ok in (('Linear', linear), ('Quadratic', quadratic), ('Exponential', exponential)) if ok]
    require(len(kinds) <= 1, f'Table fits more than one model type: {kinds}')
    return kinds[0] if kinds else 'None'


def solve_residual(public):
    prompt, options = plain(public['prompt']), choice_options(public)
    figure = public.get('figure')
    if prompt.startswith('A line was fit to'):
        element = figure['scene']['elements'][0]
        require(element['type'] == 'graph' and element['axisNames'][1] == 'residual', 'Residual graph expected')
        scatter = element['scatter']
        require(scatter['fit'] == {'m': 0, 'b': 0} and scatter['residuals'] is False, 'Residuals must be plotted about y=0')
        require(element['y'][0] == -element['y'][1], 'Residual axis must be centred on 0')
        ys = [p[1] for p in scatter['points']]
        require(all(element['y'][0] <= y <= element['y'][1] for y in ys), 'Residuals must lie inside the plotted window')
        pattern = residual_pattern(scatter['points'])
        text = {
            'up': 'Switch to a curved model that bends upward, such as a parabola opening upward.',
            'down': 'Switch to a curved model that bends downward, such as a parabola opening downward.',
            'none': 'Keep the linear model: its residuals show no pattern.',
        }[pattern]
        known = {
            'Switch to a curved model that bends upward, such as a parabola opening upward.',
            'Switch to a curved model that bends downward, such as a parabola opening downward.',
            'Keep the linear model: its residuals show no pattern.',
            'Use a line with a steeper slope, because some residuals are far from 0.',
            'Replace the line with a different line, because some residuals are positive and some are negative.',
        }
        # Every other conclusion must be wrong for any least-squares residual plot.
        require(all(plain(o['label']).strip() in known for o in options), 'Unreviewed residual conclusion')
        return pick_correct(options, lambda o: plain(o['label']).strip() == text)
    if prompt.startswith('The table gives exact measurements'):
        table = figure['scene']['elements'][0]
        require(table['type'] == 'table' and table['columns'] == ['y'], 'Measurement table expected')
        kind = table_kind(table['rows'])
        label = {'Linear': 'Linear', 'Quadratic': 'Quadratic', 'Exponential': 'Exponential'}.get(kind, 'None of these: not linear, quadratic or exponential')
        return pick_correct(options, lambda o: plain(o['label']).strip() == label)
    m = re.fullmatch(r'A model predicts (.+?)\. At (.+?) the observed value is (.+?)\.(?: A residual is observed minus predicted\.)? (Which statement describes the model at .+?\?|What is the residual at .+?\?)', prompt)
    require(m is not None, 'Residual wording')
    model = re.fullmatch(r'\\hat y=(.+)', m[1].replace(' ', '') if False else m[1].strip())
    require(model is not None, 'Model expected')
    xv = re.fullmatch(r'x=(-?\d+)', m[2].replace(' ', ''))
    yv = re.fullmatch(r'y=(-?\d+)', m[3].replace(' ', ''))
    require(xv is not None and yv is not None, 'Evaluation point expected')
    predicted = Fraction(evaluate(model[1], x=int(xv[1])))
    residual = int(yv[1]) - predicted
    require(residual != 0, 'Zero residual would make over/under statements ambiguous')
    if m[4].startswith('What is the residual'):
        require('observed minus predicted' in prompt, 'Residual sign convention must be stated')
        return pick_correct(options, lambda o: integer_label(o['label']) == residual)

    def statement(o):
        s = re.fullmatch(r'The model (overestimates|underestimates) the observed value by (\d+)\.', plain(o['label']).strip())
        require(s is not None, f'Residual statement expected: {o["label"]}')
        amount = int(s[2]) * (1 if s[1] == 'underestimates' else -1)
        return amount == residual  # residual = observed - predicted: positive means underestimate
    return pick_correct(options, statement)


# ------------------------------------------------------------------ graph features
def number_text(text):
    s = plain(text).strip().replace(' ', '')
    return Fraction(evaluate(s))


def parse_function(prompt):
    s = plain(math_segments(prompt)[0]).replace(' ', '').replace('{', '').replace('}', '')
    m = re.fullmatch(r'f\(x\)=(-?\d*)\\log_(\d+)\(x([+-]\d+)?\)([+-]\d+)?', s)
    if m:
        a = {'': 1, '-': -1}.get(m[1], None)
        a = int(m[1]) if a is None else a
        return ('log', a, int(m[2]), -(int(m[3] or 0)), int(m[4] or 0))
    m = re.fullmatch(r'f\(x\)=(-?)(?:(\d+)\\\*)?(.+?)\^x([+-]\d+)?', s.replace('\\cdot', '\\*'))
    require(m is not None, f'Function not recognised: {prompt}')
    a = int(m[2] or 1) * (-1 if m[1] else 1)
    return ('exp', a, Fraction(evaluate(m[3])), 0, int(m[4] or 0))


def exp_end_values(a, b, k):
    grow = b > 1
    pos_inf = (math.inf if a > 0 else -math.inf) if grow else Fraction(k)
    neg_inf = Fraction(k) if grow else (math.inf if a > 0 else -math.inf)
    return pos_inf, neg_inf


def limit_value(text):
    if text == '∞':
        return math.inf
    if text == '-∞':
        return -math.inf
    return Fraction(text)


def solve_graph(public):
    prompt, options = plain(public['prompt']), choice_options(public)
    figure = public.get('figure')
    if figure is None:
        kind, a, b, h, k = parse_function(public['prompt'])
        require(a != 0, 'Zero coefficient')
        if prompt.startswith('For') and 'vertical asymptote' in prompt:
            require(kind == 'log', 'Domain question needs a logarithm')

            def truth(o):
                s = plain(o['label']).replace('\\ ', ' ').replace(' ', '')
                m = re.fullmatch(r'domainx>(-?\d+);(vertical|horizontal)asymptote(x|y)=(-?\d+)', s)
                require(m is not None, f'Domain/asymptote option expected: {o["label"]}')
                return m[2] == 'vertical' and m[3] == 'x' and int(m[1]) == h and int(m[4]) == h
            return pick_correct(options, truth)
        if 'horizontal asymptote and the range' in prompt:
            require(kind == 'exp', 'Range question needs an exponential')

            def truth(o):
                s = plain(o['label']).replace(' ', '')
                m = re.fullmatch(r'(x|y)=(-?\d+);range(y>|y<|allrealnumbers)(-?\d+)?', s)
                require(m is not None, f'Asymptote/range option expected: {o["label"]}')
                if m[1] != 'y' or int(m[2]) != k:
                    return False
                return m[3] == ('y>' if a > 0 else 'y<') and int(m[4]) == k
            return pick_correct(options, truth)
        require(prompt.startswith('Which describes the end behavior'), 'Unrecognised function-features wording')
        require(kind == 'exp', 'End-behaviour question needs an exponential')
        pos_inf, neg_inf = exp_end_values(a, b, k)

        def truth(o):
            s = plain(o['label']).replace('\\to', '→').replace('\\infty', '∞').replace(' ', '')
            m = re.fullmatch(r'x→∞:f\(x\)→(.+?);x→-∞:f\(x\)→(.+)', s)
            require(m is not None, f'End-behaviour option expected: {o["label"]}')
            return limit_value(m[1]) == pos_inf and limit_value(m[2]) == neg_inf
        return pick_correct(options, truth)
    # Graph figures: read the curve exactly, then answer from the plotted function.
    element = figure['scene']['elements'][0]
    require(element['type'] == 'graph' and len(element['curves']) == 1, 'One plotted curve expected')
    fn = element['curves'][0]['fn']
    (x0, x1), (y0, y1) = element['x'], element['y']
    h, k = Fraction(fn.get('h', 0)), Fraction(fn.get('k', 0))
    if fn['f'] == 'log':
        require('logarithmic' in prompt, 'Prompt must name the plotted family')
        a, base = Fraction(fn['a']), fn['base']
        require(a != 0 and base > 1 and x0 < h < x1, 'Vertical asymptote must be visible')
        if 'cross the x-axis' in prompt:
            zero = h + Fraction(base) ** int(-k / a) if (-k / a).denominator == 1 else None
            require(zero is not None and x0 <= zero <= x1 and y0 <= 0 <= y1, 'x-intercept must be inside the window')
            return pick_correct(options, lambda o: point_label(o['label']) == (zero, Fraction(0)))
        require('domain' in prompt, 'Logarithm figure question')
        def domain(o):
            s = plain(o['label']).replace(' ', '')
            if s == 'allrealnumbers':
                return False
            m = re.fullmatch(r'x([<>])(-?\d+)', s)
            require(m is not None, f'Domain option expected: {o["label"]}')
            return m[1] == '>' and int(m[2]) == h
        return pick_correct(options, domain)
    require(fn['f'] == 'exp', 'Unexpected plotted family')
    require('exponential' in prompt, 'Prompt must name the plotted family')
    a, b = Fraction(fn['a']), Fraction(fn['b']).limit_denominator(1000)
    require(a != 0 and b > 0 and b != 1 and y0 < k < y1, 'Horizontal asymptote must be visible')
    if 'cross the y-axis' in prompt:
        y = a * b ** int(-h) + k if h.denominator == 1 else None
        require(y is not None and x0 <= 0 <= x1 and y0 <= y <= y1, 'y-intercept must be inside the window')
        return pick_correct(options, lambda o: point_label(o['label']) == (Fraction(0), y))
    require(prompt.startswith('Which statement is true for the exponential function'), 'Exponential figure question')
    increasing = (a > 0) == (b > 1)

    def truth(o):
        m = re.fullmatch(r'The graph is (increasing|decreasing) with horizontal asymptote (x|y)=(-?\d+)\.', plain(o['label']).strip())
        require(m is not None, f'Graph statement expected: {o["label"]}')
        return (m[1] == 'increasing') == increasing and m[2] == 'y' and int(m[3]) == k
    return pick_correct(options, truth)


def point_label(label):
    m = re.fullmatch(r'\((-?\d+),\s*(-?\d+)\)', plain(label).replace(' ', ''))
    require(m is not None, f'Point choice expected: {label}')
    return Fraction(int(m[1])), Fraction(int(m[2]))


# ------------------------------------------------------------------ entry points
SOLVERS = {SERIES: solve_series, GROWTH: solve_growth, FACTOR: solve_factor, RESIDUAL: solve_residual, GRAPH: solve_graph}


def solve(public):
    require(public['templateId'] in SUPPORTED, 'Unexpected advanced-math family')
    return SOLVERS[public['templateId']](public)


def label_text(options, answer):
    return plain(next(o['label'] for o in options if o['id'] == answer))


def review_problem(problem):
    public = problem['public']
    result = solve(public)
    require(result == problem['answer'], f'Advanced-math answer key mismatch: {public["prompt"]!r}')
    # No leakage: the hint may not state the keyed choice.
    hint = plain(problem.get('hint') or '')
    key = label_text(public['response']['options'], result).strip()
    bare = re.escape(key.strip('$'))
    if re.fullmatch(r'-?\d{1,2}', key.strip('$')):  # short numbers recur in hints; flag only a stated result
        leaked = re.search(r'(answer|result|total|sum|residual)\s*(is|=|:)\s*\$?' + bare + r'(?![\w.])', hint)
    else:
        leaked = re.search(r'(?<![\w.])' + re.escape(key) + r'(?![\w.])', hint)
    require(leaked is None, 'Hint states the keyed answer')
    template = public['templateId']
    explanation = ' '.join(problem.get('explanation') or [])
    if template == FACTOR:
        keyed = merged(*parse_product(label_text(public['response']['options'], result)))
        stated = re.search(r'complete factorization is \$([^$]*)\$', explanation)
        if stated:
            candidates = [stated[1]]
        else:  # otherwise the last displayed product that equals the polynomial is the conclusion
            target = parse_poly(re.search(r'factorization of (.+) over the integers', plain(public['prompt']))[1])
            products = [seg for seg in reversed(re.findall(r'\$([^$]*)\$', explanation)) if seg.startswith('(')]
            candidates = [seg for seg in products if equals_target(seg, target)][:1]
        require(candidates, 'Factoring explanation must end with the factorization')
        constant, factors = parse_product(candidates[0])
        require(complete_factorization(constant, factors), 'Explanation factorization is not complete over the integers')
        require(merged(constant, factors) == keyed, 'Explanation disagrees with the keyed factorization')
    if template == GROWTH and 'approx' in explanation and label_text(public['response']['options'], result).endswith(' dollars'):
        m = re.search(r'\\approx([\d,]+)', explanation)
        require(m is not None and int(m[1].replace(',', '')) == dollars(label_text(public['response']['options'], result)), 'Explanation value disagrees with the key')
    return result


# ------------------------------------------------------------------ self-test
def make(template, prompt, labels, correct, figure=None, hint='', explanation=None):
    options = [{'id': f'option-{c}', 'label': label} for c, label in zip('abcd', labels)]
    public = {'templateId': template, 'seed': 'fixture', 'prompt': prompt,
              'response': {'kind': 'choice', 'label': 'Choose one answer', 'options': options}}
    if figure:
        public['figure'] = figure
    return {'public': public, 'answer': f'option-{"abcd"[correct]}', 'hint': hint, 'explanation': explanation or []}


def scatter_figure(points, window=4):
    return {'kind': 'scene', 'scene': {'v': 1, 'elements': [{
        'id': 'g', 'type': 'graph', 'x': [0, 10], 'y': [-window, window], 'axisNames': ['x', 'residual'],
        'scatter': {'points': points, 'fit': {'m': 0, 'b': 0}, 'residuals': False}}]}}


def table_figure(ys):
    return {'kind': 'scene', 'scene': {'v': 1, 'elements': [{
        'id': 't', 'type': 'table', 'columns': ['y'], 'corner': 'x', 'math': True,
        'rows': [{'label': str(i), 'cells': [y]} for i, y in enumerate(ys)]}]}}


def curve_figure(fn, x, y):
    return {'kind': 'scene', 'scene': {'v': 1, 'elements': [{
        'id': 'g', 'type': 'graph', 'x': x, 'y': y, 'curves': [{'fn': fn}]}]}}


CURVE_WORDS = {'residual': 'Keep the linear model: its residuals show no pattern.'}
UP = 'Switch to a curved model that bends upward, such as a parabola opening upward.'
DOWN = 'Switch to a curved model that bends downward, such as a parabola opening downward.'
KEEP = 'Keep the linear model: its residuals show no pattern.'
STEEP = 'Use a line with a steeper slope, because some residuals are far from 0.'
SIGN = 'Replace the line with a different line, because some residuals are positive and some are negative.'
RES_PROMPT = ('A line was fit to plant height against days. The residual plot shows each residual, '
              'observed − predicted, against days. Which conclusion does the residual plot support?')


def fixtures():
    """Hand-calculated cases: (problem, mutations that must be rejected)."""
    cases = []
    cases.append(make(SERIES, 'Find the sum of the first 11 terms of the arithmetic series $9+14+19+\\cdots$.', ['$59$', '$374$', '$99$', '$438$'], 1))
    cases.append(make(SERIES, 'A sequence is defined by $a_n=-6n-4$ for $n\\ge1$. Which recursive definition gives the same sequence?',
                      ['$a_1=-6,\\ a_{n+1}=a_n-4$', '$a_1=-10,\\ a_{n+1}=-6a_n$', '$a_1=-4,\\ a_{n+1}=a_n-6$', '$a_1=-10,\\ a_{n+1}=a_n-6$'], 3))
    cases.append(make(SERIES, "A theater's first row has 7 seats. Each later row has 3 more seats than the row in front of it. There are 12 rows. How many seats are in the theater?", ['$84$', '$242$', '$282$', '$325$'], 2))
    cases.append(make(SERIES, 'A sequence has $a_1=12$ and $a_{n+1}=a_n+8$ for $n\\ge1$. Which explicit rule gives $a_n$?', ['$a_n=8n+4$', '$a_n=12n+8$', '$a_n=8n+12$', '$a_n=-8n+20$'], 0))
    cases.append(make(SERIES, 'The table shows two terms of an arithmetic sequence. What is $a_{8}$?', ['$-44$', '$-53$', '$-98$', '$-35$'], 0,
                      figure={'kind': 'scene', 'scene': {'v': 1, 'elements': [{'id': 't', 'type': 'table', 'columns': ['a_n'], 'corner': 'n', 'math': True, 'rows': [{'label': '2', 'cells': [10]}, {'label': '6', 'cells': [-26]}]}]}}))
    cases.append(make(SERIES, 'Evaluate $\\sum_{k=1}^{12} (-2k+3)$.', ['$-120$', '$-240$', '$12$', '$-143$'], 0))
    cases.append(make(SERIES, 'A sequence has $a_1=1$ and $a_{n+1}=3a_n-1$ for $n\\ge1$. What is $a_5$?', ['$77$', '$14$', '$81$', '$41$'], 3))
    cases.append(make(GROWTH, 'A value shrinks 12% each year, so $V(t)=2400(0.88)^{t}$ with $t$ in years. Which model gives the same values using $m$, the number of quarters since the start?',
                      ['$V=2400(0.97)^{m}$', '$V=2400(0.88)^{m}$', '$V=2400\\left(\\tfrac{0.88}{4}\\right)^{m}$', '$V=2400(0.88)^{m/4}$'], 3))
    cases.append(make(GROWTH, '2,000 dollars is deposited at 6% annual interest, compounded continuously. What is the balance after 20 years, rounded to the nearest dollar?',
                      ['4,640 dollars', '6,640 dollars', '2,003 dollars', '4,400 dollars'], 1))
    cases.append(make(GROWTH, "A quantity increases by 1.5% each month, with each change applied to the previous month's value. By what percent does it increase over one year? Round to the nearest tenth of a percent.",
                      ['119.6%', '19.6%', '18.0%', '0.1%'], 1))
    cases.append(make(GROWTH, '8,000 dollars is deposited at 5% annual interest, compounded monthly (12 times per year). What is the balance after 5 years, rounded to the nearest dollar?',
                      ['10,000 dollars', '10,267 dollars', '2,267 dollars', '10,224 dollars'], 1))
    cases.append(make(GROWTH, 'The balance of an account is $B(t)=4000(1.02)^{12t}$, where $t$ is in years. Which statement describes the account?',
                      ['It earns 24% annual interest, compounded monthly.', 'It earns 2% annual interest, compounded monthly.', 'It earns 12% annual interest, compounded 24 times a year.', 'It earns 24% annual interest, compounded once a year.'], 0))
    cases.append(make(FACTOR, 'Which is the complete factorization of $x^{3}-3x^{2}-4x+12$ over the integers?',
                      ['$(x-3)(x-2)^2$', '$(x-3)(x^2-4)$', '$(x-3)(x-2)(x+2)$', '$(x-3)(x^2+4)$'], 2,
                      explanation=['The complete factorization is $(x-3)(x-2)(x+2)$.']))
    cases.append(make(FACTOR, 'Which is the complete factorization of $3x^{3}-192$ over the integers?',
                      ['$3(x-4)^3$', '$3(x-4)(x^{2}+8x+16)$', '$3(x+4)(x^{2}-4x+16)$', '$3(x-4)(x^{2}+4x+16)$'], 3,
                      explanation=['The complete factorization is $3(x-4)(x^{2}+4x+16)$.']))
    cases.append(make(RESIDUAL, RES_PROMPT, [DOWN, SIGN, STEEP, UP], 3,
                      figure=scatter_figure([[1, 1.6], [2, 0.4], [3, -0.2], [4, -0.9], [5, -1.1], [6, -0.8], [7, -0.6], [8, 0.3], [9, 1.5]])))
    cases.append(make(RESIDUAL, RES_PROMPT, [KEEP, UP, DOWN, STEEP], 0,
                      figure=scatter_figure([[1, 1], [2, -0.9], [3, -1.2], [4, 0.4], [5, 0.7], [6, 0.7], [7, -1.1], [8, 0], [9, -0.2]])))
    cases.append(make(RESIDUAL, 'The table gives exact measurements at equally spaced values of $x$. Which type of model fits the data exactly?',
                      ['Linear', 'Quadratic', 'None of these: not linear, quadratic or exponential', 'Exponential'], 0, figure=table_figure([16, 11, 6, 1, -4, -9])))
    cases.append(make(RESIDUAL, 'The table gives exact measurements at equally spaced values of $x$. Which type of model fits the data exactly?',
                      ['Linear', 'Quadratic', 'None of these: not linear, quadratic or exponential', 'Exponential'], 3, figure=table_figure([3, 6, 12, 24, 48, 96])))
    cases.append(make(RESIDUAL, 'The table gives exact measurements at equally spaced values of $x$. Which type of model fits the data exactly?',
                      ['Linear', 'Quadratic', 'None of these: not linear, quadratic or exponential', 'Exponential'], 1, figure=table_figure([1, 2, 5, 10, 17, 26])))
    cases.append(make(RESIDUAL, 'The table gives exact measurements at equally spaced values of $x$. Which type of model fits the data exactly?',
                      ['Linear', 'Quadratic', 'None of these: not linear, quadratic or exponential', 'Exponential'], 2, figure=table_figure([1, 2, 4, 7, 12, 20])))
    cases.append(make(RESIDUAL, 'A model predicts $\\hat y=3x^{2}+3x+1$. At $x=2$ the observed value is $y=11$. Which statement describes the model at $x=2$?',
                      ['The model overestimates the observed value by 32.', 'The model overestimates the observed value by 8.', 'The model overestimates the observed value by 19.', 'The model underestimates the observed value by 19.'], 1))
    cases.append(make(RESIDUAL, 'A model predicts $\\hat y=4\\cdot2^{x}$. At $x=2$ the observed value is $y=13$. A residual is observed minus predicted. What is the residual at $x=2$?',
                      ['$-3$', '$16$', '$3$', '$13$'], 0))
    cases.append(make(GRAPH, 'For $f(x)=-\\log_{3}(x-2)+4$, which gives the domain and the vertical asymptote?',
                      ['$\\text{domain }x>0;\\ \\text{vertical asymptote }x=0$', '$\\text{domain }x>2;\\ \\text{horizontal asymptote }y=4$',
                       '$\\text{domain }x>2;\\ \\text{vertical asymptote }x=2$', '$\\text{domain }x>-2;\\ \\text{vertical asymptote }x=-2$'], 2))
    cases.append(make(GRAPH, 'Which describes the end behavior of $f(x)=2\\cdot2^{x}-4$?',
                      ['$x\\to\\infty:\\ f(x)\\to\\infty;\\quad x\\to-\\infty:\\ f(x)\\to-4$', '$x\\to\\infty:\\ f(x)\\to-\\infty;\\quad x\\to-\\infty:\\ f(x)\\to-4$',
                       '$x\\to\\infty:\\ f(x)\\to-4;\\quad x\\to-\\infty:\\ f(x)\\to-4$', '$x\\to\\infty:\\ f(x)\\to\\infty;\\quad x\\to-\\infty:\\ f(x)\\to\\infty$'], 0))
    cases.append(make(GRAPH, 'For $f(x)=2^{x}-1$, which gives the horizontal asymptote and the range?',
                      ['$y=1\\text{; range }y>1$', '$y=-1\\text{; range }y>-1$', '$x=0\\text{; range all real numbers}$', '$y=0\\text{; range }y>0$'], 1))
    cases.append(make(GRAPH, 'The graph shows a logarithmic function. At which point does it cross the x-axis?', ['$(3,1)$', '$(3,0)$', '$(2,0)$', '$(0,2)$'], 2,
                      figure=curve_figure({'f': 'log', 'a': -1, 'base': 2, 'h': 1}, [-1, 9], [-3, 3])))
    cases.append(make(GRAPH, 'The graph shows an exponential function. At which point does the graph cross the y-axis?', ['$(0,-2)$', '$(0,2)$', '$(-2,0)$', '$(0,-3)$'], 0,
                      figure=curve_figure({'f': 'exp', 'a': 2, 'b': 0.5, 'k': -4}, [-2, 3], [-5, 5])))
    cases.append(make(GRAPH, 'The graph shows a logarithmic function. What is its domain?', ['$\\text{all real numbers}$', '$x>1$', '$x>0$', '$x>2$'], 1,
                      figure=curve_figure({'f': 'log', 'a': -1, 'base': 2, 'h': 1}, [-1, 9], [-3, 3])))
    cases.append(make(GRAPH, 'Which statement is true for the exponential function whose graph is shown?',
                      ['The graph is increasing with horizontal asymptote $y=1$.', 'The graph is increasing with horizontal asymptote $x=0$.',
                       'The graph is increasing with horizontal asymptote $y=0$.', 'The graph is decreasing with horizontal asymptote $y=0$.'], 0,
                      figure=curve_figure({'f': 'exp', 'a': -1, 'b': 0.5, 'k': 1}, [-3, 3], [-8, 2])))
    return cases


def mutations(problem):
    """Corruptions that a sound reviewer must reject."""
    out = []
    wrong = copy.deepcopy(problem)
    wrong['answer'] = next(o['id'] for o in problem['public']['response']['options'] if o['id'] != problem['answer'])
    out.append(wrong)
    dup = copy.deepcopy(problem)
    options = dup['public']['response']['options']
    correct = next(o for o in options if o['id'] == dup['answer'])
    other = next(o for o in options if o['id'] != dup['answer'])
    other['label'] = correct['label']
    out.append(dup)
    leak = copy.deepcopy(problem)
    leak['hint'] = 'The answer is ' + plain(next(o['label'] for o in leak['public']['response']['options'] if o['id'] == leak['answer']))
    out.append(leak)
    return out


def self_test():
    rejected = checked = 0

    def reject(problem, note):
        nonlocal rejected
        try:
            review_problem(problem)
        except (ValueError, KeyError, IndexError, TypeError):
            rejected += 1
            return
        raise ValueError(f'Corrupt advanced-math case was accepted: {note}')

    cases = fixtures()
    for case in cases:
        review_problem(case)
        checked += 1
        for bad in mutations(case):
            reject(bad, case['public']['prompt'][:50])
    # Targeted mutations of givens and figures.
    by_prompt = lambda text: next(copy.deepcopy(c) for c in cases if c['public']['prompt'].startswith(text))
    bad = by_prompt('Find the sum'); bad['public']['prompt'] = bad['public']['prompt'].replace('11 terms', '12 terms'); reject(bad, 'series count')
    bad = by_prompt('Find the sum'); bad['public']['prompt'] = bad['public']['prompt'].replace('14+19', '15+19'); reject(bad, 'non-arithmetic terms')
    bad = by_prompt('A sequence is defined'); bad['public']['prompt'] = bad['public']['prompt'].replace('-6n-4', '-6n-5'); reject(bad, 'explicit rule')
    bad = by_prompt('Evaluate'); bad['public']['prompt'] = bad['public']['prompt'].replace('k=1', 'k=2'); reject(bad, 'summation start')
    bad = by_prompt('A sequence has $a_1=1$'); bad['public']['prompt'] = bad['public']['prompt'].replace('a_5', 'a_6'); reject(bad, 'term index')
    bad = by_prompt('The table shows'); bad['public']['figure']['scene']['elements'][0]['rows'][1]['cells'] = [-25]; reject(bad, 'table cell')
    bad = by_prompt('A value shrinks'); bad['public']['prompt'] = bad['public']['prompt'].replace('12%', '13%'); reject(bad, 'percent vs factor')
    bad = by_prompt('A value shrinks'); bad['public']['prompt'] = bad['public']['prompt'].replace('quarters', 'months'); reject(bad, 'period unit')
    bad = by_prompt('2,000 dollars'); bad['public']['prompt'] = bad['public']['prompt'].replace('20 years', '19 years'); reject(bad, 'years')
    bad = by_prompt('A quantity increases'); bad['public']['prompt'] = bad['public']['prompt'].replace('each month', 'each quarter'); reject(bad, 'period count')
    bad = by_prompt('8,000 dollars'); bad['public']['prompt'] = bad['public']['prompt'].replace('12 times', '4 times'); reject(bad, 'compounding count')
    bad = by_prompt('The balance'); bad['public']['prompt'] = bad['public']['prompt'].replace('12t', '4t'); reject(bad, 'account exponent')
    bad = by_prompt('Which is the complete factorization of $x^{3}'); bad['public']['prompt'] = bad['public']['prompt'].replace('+12', '+13'); reject(bad, 'polynomial')
    bad = by_prompt('Which is the complete factorization of $x^{3}'); bad['public']['prompt'] = bad['public']['prompt'].replace(' over the integers', ''); reject(bad, 'integers not stated')
    bad = by_prompt('Which is the complete factorization of $3x'); bad['public']['response']['options'][3]['label'] = '$(3x-12)(x^{2}+4x+16)$'; reject(bad, 'content not extracted')
    bad = by_prompt('Which is the complete factorization of $3x'); bad['explanation'] = ['The complete factorization is $(3x-12)(x^{2}+4x+16)$.']; reject(bad, 'explanation incomplete')
    bad = by_prompt('A line was fit'); bad['public']['figure']['scene']['elements'][0]['scatter']['points'][4][1] = 1.1; reject(bad, 'residual pattern broken')
    bad = by_prompt('The table gives'); bad['public']['figure']['scene']['elements'][0]['rows'][3]['cells'] = [2]; reject(bad, 'table broken')
    bad = by_prompt('A model predicts $\\hat y=3x'); bad['public']['prompt'] = bad['public']['prompt'].replace('y=11', 'y=12'); reject(bad, 'observed value')
    bad = by_prompt('A model predicts $\\hat y=4'); bad['public']['prompt'] = bad['public']['prompt'].replace(' A residual is observed minus predicted.', ''); reject(bad, 'sign convention unstated')
    bad = by_prompt('For $f(x)=-\\log'); bad['public']['prompt'] = bad['public']['prompt'].replace('(x-2)', '(x-3)'); reject(bad, 'log shift')
    bad = by_prompt('Which describes'); bad['public']['prompt'] = bad['public']['prompt'].replace('2\\cdot2^{x}', '-2\\cdot2^{x}'); reject(bad, 'end behavior sign')
    bad = by_prompt('For $f(x)=2^{x}'); bad['public']['prompt'] = bad['public']['prompt'].replace('-1$', '-2$'); reject(bad, 'asymptote shift')
    for text in ('The graph shows a logarithmic function. At', 'The graph shows an exponential', 'The graph shows a logarithmic function. What', 'Which statement is true'):
        bad = by_prompt(text)
        fn = bad['public']['figure']['scene']['elements'][0]['curves'][0]['fn']
        if fn['f'] == 'log':
            fn['h'] = 2
        else:
            fn['k'] = fn['k'] + 1
            fn['a'] = -fn['a'] if text.startswith('The graph shows an') else fn['a']
        reject(bad, 'figure edited: ' + text)
    return {'fixtures': checked, 'rejectedMutations': rejected}


if __name__ == '__main__':
    print(self_test())
