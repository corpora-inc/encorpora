"""Independent review of the Regents Algebra II families.

Every answer is derived from the public prompt, the displayed choices and the
figure data only. Expressions are read by a small LaTeX evaluator (exact
Fraction arithmetic where no root, logarithm or trigonometric value appears,
tolerance 1e-9 otherwise); choices are compared by what they mean, not by
their text. Covers the 36 templates of regents-algebra-two-{exponential,
algebra,functions,reasoning,graphs}.
"""
import copy
import math
import re
from fractions import Fraction

EXPONENTIAL_CHOICE = frozenset({
    'geometric-series-total', 'common-base-exponential', 'exponential-parameter-log',
    'growth-model-rewrite', 'depreciation-recursion',
})
EXPONENTIAL_NUMERIC = frozenset({'exponential-target-time', 'nonlinear-recursion-term'})
ALGEBRA_CHOICE = frozenset({
    'nonmonic-complex-quadratic', 'inverse-exponential-root', 'circle-line-system',
    'rational-two-denominators', 'trinomial-product', 'cubic-quotient-remainder',
    'powers-of-i-sum', 'absolute-value-linear', 'shifted-trinomial-factor',
    'rational-exponent-product',
})
ALGEBRA_NUMERIC = frozenset({'two-radical-equation'})
FUNCTIONS_CHOICE = frozenset({
    'normal-probability', 'tangent-quadrant-cosine', 'special-angle-match',
    'odd-sine-parameters', 'parabola-vertex-distance',
})
REASONING_CHOICE = frozenset({
    'event-complement-set', 'study-design-classify', 'quartic-factored-form',
    'cubic-quotient-factored', 'complete-square-first-steps', 'exponential-points-statement',
})
GRAPH_CHOICE = frozenset({
    'rational-abs-solution-count', 'log-base-fraction-graph', 'remainder-zero-graph',
    'repeated-zero-rule', 'sinusoid-compare-rule', 'tide-cosine-equation', 'cubic-graph-statement',
})
CHOICE = (EXPONENTIAL_CHOICE | ALGEBRA_CHOICE | FUNCTIONS_CHOICE | REASONING_CHOICE | GRAPH_CHOICE)
NUMERIC = EXPONENTIAL_NUMERIC | ALGEBRA_NUMERIC
SUPPORTED = CHOICE | NUMERIC
CHOICE_REVIEW = CHOICE


def require(condition, message):
    if not condition:
        raise ValueError(message)


# ---------------------------------------------------------------- numbers
def close(a, b):
    try:
        if isinstance(a, Fraction) and isinstance(b, Fraction):
            return a == b
        return abs(a - b) <= 1e-9 * max(1.0, abs(a), abs(b))
    except (TypeError, OverflowError):
        return False


def iroot(n, k):
    """Exact integer k-th root of a nonnegative integer or None."""
    r = round(n ** (1.0 / k))
    for c in (r - 1, r, r + 1):
        if c >= 0 and c ** k == n:
            return c
    return None


def nth_root(a, n):
    if isinstance(a, complex):
        return a ** (1.0 / n)
    if a < 0:
        if n % 2 == 1:
            return -nth_root(-a, n)
        return complex(0, 1) * nth_root(-a, n)
    if isinstance(a, Fraction):
        p, q = iroot(a.numerator, n), iroot(a.denominator, n)
        if p is not None and q is not None:
            return Fraction(p, q)
    return float(a) ** (1.0 / n)


def power(a, b):
    if isinstance(b, Fraction) and b.denominator == 1:
        b = int(b)
    if isinstance(b, int):
        if b < 0:
            return 1 / power(a, -b)
        result = Fraction(1) if isinstance(a, (Fraction, int)) else 1
        for _ in range(b):
            result = result * a
        return result
    if isinstance(b, Fraction) and isinstance(a, (Fraction, int)):
        return power(nth_root(Fraction(a), b.denominator), b.numerator)
    if isinstance(a, (int, float, Fraction)) and a < 0:
        return complex(a) ** b
    return float(a) ** float(b) if not isinstance(a, complex) else a ** b


# ---------------------------------------------------------------- LaTeX reader
TOKEN = re.compile(r'\\[a-zA-Z]+|\d+(?:\.\d+)?|[a-zA-Z]|[{}()\[\]^_+\-*/|=,]')
FUNCTIONS = {'\\sin', '\\cos', '\\tan', '\\log', '\\ln'}


def normalise(text):
    text = text.replace('$', '').replace('\u2212', '-')
    for junk in ('\\left', '\\right', '\\,', '\\;', '\\!', '\\ ', '\\quad'):
        text = text.replace(junk, ' ')
    text = text.replace('\\dfrac', '\\frac').replace('\\tfrac', '\\frac')
    text = re.sub(r'\\frac\s*(\d)\s*(\d)', r'\\frac{\1}{\2}', text)
    text = re.sub(r'\\frac\s*(\d)\s*\{', r'\\frac{\1}{', text)
    text = text.replace('\\cdot', '*').replace('\\times', '*')
    return text


class Reader:
    def __init__(self, text, env=None):
        self.tokens = TOKEN.findall(normalise(text))
        self.pos = 0
        self.env = dict(env or {})
        self.in_abs = False

    def peek(self, offset=0):
        index = self.pos + offset
        return self.tokens[index] if index < len(self.tokens) else None

    def take(self, expected=None):
        token = self.peek()
        require(token is not None, 'Unexpected end of expression')
        require(expected is None or token == expected, f'Expected {expected} but found {token}')
        self.pos += 1
        return token

    def value(self):
        result = self.expr()
        require(self.peek() is None, f'Unread tokens {self.tokens[self.pos:]}')
        return result

    def expr(self):
        total = self.term()
        while self.peek() in ('+', '-', '\\pm'):
            op = self.take()
            right = self.term()
            if op == '+':
                total = total + right
            elif op == '-':
                total = total - right
            else:
                total = total + self.env.get('_pm', 1) * right
        return total

    def starts_factor(self):
        token = self.peek()
        if token is None:
            return False
        if token == '|':
            return not self.in_abs
        return token == '(' or re.fullmatch(r'\d+(?:\.\d+)?|[a-zA-Z]', token) is not None or token in (
            '\\frac', '\\sqrt', '\\pi') or token in FUNCTIONS

    def term(self):
        result = self.unary()
        while True:
            token = self.peek()
            if token == '*':
                self.take()
                result = result * self.unary()
            elif token == '/':
                self.take()
                result = result / self.unary()
            elif self.starts_factor():
                result = result * self.power()
            else:
                return result

    def unary(self):
        if self.peek() == '-':
            self.take()
            return -self.unary()
        if self.peek() == '+':
            self.take()
            return self.unary()
        if self.peek() == '\\pm':
            self.take()
            return self.env.get('_pm', 1) * self.unary()
        return self.power()

    def group(self):
        if self.peek() == '{':
            self.take('{')
            saved, self.in_abs = self.in_abs, False
            result = self.expr()
            self.in_abs = saved
            self.take('}')
            return result
        token = self.take()
        if re.fullmatch(r'\d+(?:\.\d+)?', token):
            return Fraction(token)
        if token == '\\pi':
            return math.pi
        if re.fullmatch(r'[a-zA-Z]', token):
            return self.ident(token)
        raise ValueError(f'Bad group token {token}')

    def ident(self, token):
        if token in self.env:
            return self.env[token]
        if token == 'i':
            return complex(0, 1)
        if token == 'e':
            return math.e
        raise ValueError(f'Unknown symbol {token}')

    def power(self):
        base = self.primary()
        if self.peek() == '^':
            self.take()
            exponent = self.group_or_power()
            return power(base, exponent)
        return base

    def group_or_power(self):
        if self.peek() == '-':
            self.take()
            return -self.group_or_power()
        value = self.group()
        if self.peek() == '^':
            self.take()
            return power(value, self.group_or_power())
        return value

    def function_argument(self):
        if self.peek() == '(':
            self.take('(')
            result = self.expr()
            self.take(')')
            if self.peek() == '^':
                self.take()
                result = power(result, self.group_or_power())
            return result
        return self.power()

    def primary(self):
        token = self.take()
        if re.fullmatch(r'\d+(?:\.\d+)?', token):
            return Fraction(token)
        if token == '(':
            saved, self.in_abs = self.in_abs, False
            result = self.expr()
            self.in_abs = saved
            self.take(')')
            return result
        if token == '{':
            self.pos -= 1
            return self.group()
        if token == '|':
            saved, self.in_abs = self.in_abs, True
            inner = self.expr()
            self.in_abs = saved
            self.take('|')
            mode = self.env.get('_abs')
            if mode is None:
                return abs(inner)
            return inner * mode
        if token == '\\pi':
            return math.pi
        if token == '\\frac':
            numerator = self.group()
            denominator = self.group()
            return numerator / denominator
        if token == '\\sqrt':
            index = 2
            if self.peek() == '[':
                self.take('[')
                index = int(self.take())
                self.take(']')
            return nth_root(self.group(), index)
        if token in ('\\log', '\\ln'):
            base = 10 if token == '\\log' else math.e
            if self.peek() == '_':
                self.take('_')
                base = self.group()
            argument = self.function_argument()
            return math.log(float(argument)) / math.log(float(base))
        if token in ('\\sin', '\\cos', '\\tan'):
            argument = float(self.function_argument())
            return {'\\sin': math.sin, '\\cos': math.cos, '\\tan': math.tan}[token](argument)
        if re.fullmatch(r'[a-zA-Z]', token):
            return self.ident(token)
        raise ValueError(f'Unexpected token {token}')


def ev(text, **env):
    return Reader(text, env).value()


def sides(text):
    left, right = text.split('=')
    return left, right


def difference(equation, **env):
    left, right = sides(equation)
    return ev(left, **env) - ev(right, **env)


def attempt(function, *args, **kwargs):
    """Value, or None where the expression is undefined (pole, bad domain)."""
    try:
        return function(*args, **kwargs)
    except (ZeroDivisionError, ValueError, OverflowError):
        return None


def poly_coefficients(function, degree, offset=Fraction(0)):
    """Exact coefficients (low to high) of a polynomial given as a function,
    sampled at offset, offset+1, ..."""
    xs = [offset + Fraction(k) for k in range(degree + 1)]
    ys = [function(x) for x in xs]
    coefficients = [Fraction(0)] * (degree + 1)
    for j, xj in enumerate(xs):
        basis, denominator = [Fraction(1)], Fraction(1)
        for m, xm in enumerate(xs):
            if m == j:
                continue
            basis = [a - xm * b for a, b in zip([Fraction(0)] + basis, basis + [Fraction(0)])]
            denominator *= xj - xm
        for index, value in enumerate(basis):
            coefficients[index] += ys[j] * value / denominator
    return coefficients


SAMPLES = [Fraction(n, d) for n, d in ((2, 1), (3, 1), (5, 1), (7, 2), (11, 3), (13, 2), (17, 5))]


def same_function(a, b, variable='x', samples=SAMPLES, **env):
    """True when two expressions agree at every sample where both are defined
    (at least four samples must be defined)."""
    agree = 0
    for point in samples:
        left = attempt(ev, a, **{variable: point}, **env)
        right = attempt(ev, b, **{variable: point}, **env)
        if left is None or right is None:
            continue
        if not close(left, right):
            return False
        agree += 1
    require(agree >= 4, f'Too few comparable samples for {a!r} and {b!r}')
    return True


# ---------------------------------------------------------------- helpers
def plain(text):
    return text.replace('$', '').replace('\u2212', '-')


def options_of(public):
    response = public['response']
    require(response['kind'] in ('choice', 'figure-choice'), 'Choice response expected')
    options = response['options']
    require(len(options) == 4, 'Four public choices required')
    require(len({o['id'] for o in options}) == 4, 'Duplicate choice IDs')
    return options


def one_correct(options, keys, target, equal=close):
    """Option ID whose key equals target; keys must be pairwise distinct and
    exactly one may match."""
    for i in range(len(keys)):
        for j in range(i + 1, len(keys)):
            require(not equal(keys[i], keys[j]), f'Choices {i + 1} and {j + 1} mean the same thing: {options[i]["label"]!r}')
    hits = [o['id'] for o, key in zip(options, keys) if key is not None and equal(key, target)]
    require(len(hits) == 1, f'{len(hits)} choices match the derived answer {target!r}')
    return hits[0]


def equal_value(a, b):
    if isinstance(a, tuple) or isinstance(b, tuple):
        return isinstance(a, tuple) and isinstance(b, tuple) and len(a) == len(b) and all(equal_value(x, y) for x, y in zip(a, b))
    if isinstance(a, frozenset) or isinstance(b, frozenset):
        return a == b
    if isinstance(a, str) or isinstance(b, str):
        return a == b
    return close(a, b)


def number_text(text):
    return Fraction(text.replace(',', ''))


def rounded(value, places):
    """Half-up rounding of a float to `places` decimals, as a float."""
    scale = 10 ** places
    return math.floor(value * scale + 0.5) / scale


# ---------------------------------------------------------------- exponential
def solve_geometric_series(public, prompt):
    options = options_of(public)
    # Percent-growth payments, or a fractional common ratio.
    pay = re.fullmatch(
        r'A fund receives yearly payments\. The first payment is ([\d,]+) dollars and each payment is (\d+)% larger than the one before it\. '
        r'To the nearest dollar, what is the total of the first (\d+) payments\?', prompt)
    if pay:
        a, rate, n = number_text(pay[1]), Fraction(int(pay[2]), 100), int(pay[3])
        total = sum(a * (1 + rate) ** k for k in range(n))
        target = Fraction(math.floor(total + Fraction(1, 2)))
        keys = []
        for o in options:
            m = re.fullmatch(r'([\d,]+) dollars', plain(o['label']))
            require(m, f'Unreadable choice {o["label"]!r}')
            keys.append(number_text(m[1]))
        # Rounding must be clear of a tie.
        require(abs((total - math.floor(total)) - Fraction(1, 2)) > Fraction(1, 100), 'Rounding tie in dollar total')
        return one_correct(options, keys, target, lambda a, b: a == b)
    series = re.fullmatch(r'A geometric sequence has first term \$a_1=(-?\d+)\$ and common ratio \$r=(.+?)\$\. '
                          r'What is the sum of its first (\d+) terms, \$S_\{\d+\}\$\?', prompt)
    require(series, f'Unrecognised geometric series prompt: {prompt!r}')
    a, r, n = Fraction(series[1]), ev(series[2]), int(series[3])
    require(isinstance(r, Fraction) and r != 1, 'Ratio must be an exact fraction other than 1')
    total = sum(a * r ** k for k in range(n))
    keys = [ev(plain(o['label'])) for o in options]
    return one_correct(options, keys, total, lambda p, q: p == q)


def solve_common_base(public, prompt):
    options = options_of(public)
    m = re.fullmatch(r'Solve for \$x\$: \$(\d+)\^\{(.+?)\}=(\d+)\^\{(.+?)\}\$', plain(prompt) if False else prompt)
    if m is None:
        m = re.fullmatch(r'Solve for \$x\$: \$(\d+)\^\{(.+?)\}=(\d+)\^(x)\$', prompt)
    require(m, f'Unrecognised exponential equation {prompt!r}')
    a, ea, b, eb = int(m[1]), m[2], int(m[3]), m[4]

    def found(base_a, base_b):
        for c in range(2, 14):
            ka = next((k for k in range(1, 8) if c ** k == base_a), None)
            kb = next((k for k in range(1, 8) if c ** k == base_b), None)
            if ka and kb:
                return ka, kb
        return None

    pair = found(a, b)
    require(pair, f'No common base for {a} and {b}')
    ka, kb = pair
    # ka*(ea) = kb*(eb) is linear in x: recover it from two exact evaluations.
    def residual(x):
        return ka * ev(ea, x=x) - kb * ev(eb, x=x)
    r0, r1 = residual(Fraction(0)), residual(Fraction(1))
    slope = r1 - r0
    require(slope != 0, 'Degenerate exponent equation')
    target = -r0 / slope
    keys = []
    for o in options:
        m2 = re.fullmatch(r'x=(-?\d+(?:/\d+)?)', plain(o['label']))
        require(m2, f'Unreadable choice {o["label"]!r}')
        keys.append(Fraction(m2[1]))
    return one_correct(options, keys, target, lambda p, q: p == q)


def solve_parameter_log(public, prompt):
    options = options_of(public)
    text = prompt
    m = re.fullmatch(r'For positive constants \$(\w)\$ and \$(\w)\$, solve \$(.+?)\$ for \$x\$\. Which expression gives \$x\$\?', text)
    values = {}
    if m:
        equation = m[3]
        values = {m[1]: Fraction(3), m[2]: Fraction(7)}
    else:
        m = re.fullmatch(r'Solve \$(.+?)\$ for \$x\$\. Which expression gives \$x\$\?', text)
        require(m, f'Unrecognised log prompt {text!r}')
        equation = m[1]
    results = []
    for variant in range(3):
        env = dict(values)
        if values:
            names = sorted(values)
            env = {names[0]: Fraction(3 + variant), names[1]: Fraction(20 + 3 * variant)}
            if equation.startswith('10'):
                env = {names[0]: Fraction(2 + variant), names[1]: Fraction(30 + variant)}
            if m is not None:
                pass
        # Monotone in x: bisect the (increasing) left minus right side.
        lo, hi = -40.0, 40.0
        for _ in range(200):
            mid = (lo + hi) / 2
            value = difference(equation, x=mid, **env)
            if float(value) < 0:
                lo = mid
            else:
                hi = mid
        results.append((env, (lo + hi) / 2))
    keys = []
    for o in options:
        label = plain(o['label'])
        require(label.startswith('x='), f'Unreadable choice {o["label"]!r}')
        body = label[2:]
        keys.append(tuple(attempt(ev, body, **env) for env, _ in results))
    target = tuple(root for _, root in results)
    # Exactly the same function of the parameters at three parameter sets.
    def eq(a, b):
        return all(x is not None and y is not None and abs(x - y) < 1e-8 for x, y in zip(a, b))
    return one_correct(options, keys, target, eq)


def solve_growth_rewrite(public, prompt):
    options = options_of(public)
    half = re.fullmatch(
        r'A sample of (\d+) grams of a substance has a half-life of (\d+) hours\. '
        r'Which function gives the number of grams \$A\(t\)\$ remaining after \$t\$ hours\?', prompt)
    if half:
        amount, period = Fraction(half[1]), Fraction(half[2])
        truth = lambda t: float(amount) * 0.5 ** (float(t) / float(period))
        left_name = 'A(t)='
    else:
        m = re.fullmatch(r'The value \$V\(t\)=(\d+)\\left\((.+?)\\right\)\^\{t\}\$ (?:decays|grows) (\d+)% per year, where \$t\$ is in years\. '
                         r'Which expression is equivalent and shows the monthly factor\?', prompt)
        require(m, f'Unrecognised growth prompt {prompt!r}')
        amount, factor, rate = Fraction(m[1]), ev(m[2]), Fraction(int(m[3]), 100)
        # The stated rate must match the stated factor.
        require(close(abs(1 - float(factor)), float(rate)), 'Percent and factor disagree in the prompt')
        truth = lambda t: float(amount) * float(factor) ** float(t)
        left_name = 'V(t)='
    times = [Fraction(1, 2), Fraction(2), Fraction(5, 2), Fraction(7)]
    target = tuple(truth(t) for t in times)
    keys = []
    for o in options:
        label = plain(o['label'])
        require(label.startswith(left_name), f'Unreadable choice {o["label"]!r}')
        keys.append(tuple(attempt(ev, label[len(left_name):], t=t) for t in times))
    def eq(a, b):
        return all(x is not None and y is not None and abs(x - y) <= 1e-9 * max(1, abs(y)) for x, y in zip(a, b))
    return one_correct(options, keys, target, eq)


def solve_depreciation(public, prompt):
    options = options_of(public)
    m = re.fullmatch(r'A \w+ bought for ([\d,]+) dollars (?:loses (\d+)% of its value each year|is worth (\d+)% of its value from the year before)\. '
                     r'Let \$a_n\$ be its value, in dollars, at the start of year \$n\$\. Which recursive rule models this\?', prompt)
    require(m, f'Unrecognised depreciation prompt {prompt!r}')
    price = number_text(m[1])
    rate = Fraction(int(m[2]), 100) if m[2] else 1 - Fraction(int(m[3]), 100)
    keys = []
    for o in options:
        label = plain(o['label']).replace('\\ ', ' ').replace('\\,', '')
        mm = re.fullmatch(r'a_1=(\d+),\s*a_n=(.+)', label)
        require(mm, f'Unreadable choice {o["label"]!r}')
        first, rule = Fraction(mm[1]), mm[2]
        # Apply the rule to a test value; a_{n-1} is the previous term.
        previous = Fraction(1000)
        step = rule.replace('a_{n-1}', 'P')
        now = ev(step, P=previous)
        keys.append((first, now))
    # True rule: each year keeps (1 - rate) of the previous value.
    target = (price, Fraction(1000) * (1 - rate))
    return one_correct(options, keys, target, lambda p, q: p == q)


def solve_recursion(public, prompt):
    m = re.fullmatch(r'A sequence is defined by \$a_1=(-?\d+)\$ and \$a_n=(.+?)\$ for \$n\\ge2\$\. What is \$a_(\d+)\$\?', prompt)
    require(m, f'Unrecognised recursion prompt {prompt!r}')
    term, rule, index = Fraction(m[1]), m[2].replace('a_{n-1}', 'P'), int(m[3])
    for _ in range(index - 1):
        term = ev(rule, P=term)
    require(isinstance(term, Fraction) and term.denominator == 1, 'Recursion value must be an integer')
    return int(term)


def solve_target_time(public, prompt):
    m = re.fullmatch(r'The (?:number of [\w ]+|balance of an account, in dollars,) is modeled by \$N\(t\)=(.+?)\$, where \$t\$ is in (\w+)\. '
                     r'After how many \2 does the model reach ([\d,]+)\? Round to the nearest hundredth\.', prompt)
    require(m, f'Unrecognised target-time prompt {prompt!r}')
    model, target = m[1], number_text(m[3])
    # f is increasing in t: bisect f(t) = target with the displayed model.
    lo, hi = 0.0, 500.0
    for _ in range(200):
        mid = (lo + hi) / 2
        if float(ev(model, t=mid)) < float(target):
            lo = mid
        else:
            hi = mid
    root = (lo + hi) / 2
    require(abs((root * 100) % 1 - 0.5) > 0.02, 'Rounding tie in hundredths')
    return Fraction(round(rounded(root, 2) * 100), 100)


# ---------------------------------------------------------------- algebra
def quadratic_of(equation):
    """Exact (a, b, c) of left minus right of a quadratic equation in x."""
    def f(x):
        return difference(equation, x=x)
    c0, c1, c2 = poly_coefficients(f, 2)
    return c2, c1, c0


def point_pair_text(label):
    m = re.fullmatch(r'\\\{(\(.+?\)),\s*(\(.+?\))\\\}', plain(label).replace('\\ ', ' ').replace(' ', ''))
    return m


def parse_point(text):
    m = re.fullmatch(r'\((-?\d+(?:\.\d+)?|-?\d+/\d+),(-?\d+(?:\.\d+)?|-?\d+/\d+)\)', text.replace('\\', '').replace(' ', ''))
    require(m, f'Unreadable point {text!r}')
    return (Fraction(m[1]), Fraction(m[2]))


def solve_nonmonic_quadratic(public, prompt):
    options = options_of(public)
    m = re.fullmatch(r'What are the solutions of \$(.+?)\$\?', prompt)
    require(m, f'Unrecognised quadratic prompt {prompt!r}')
    a, b, c = quadratic_of(m[1])
    disc = b * b - 4 * a * c
    require(disc < 0, 'Complex-solution item must have a negative discriminant')
    root = math.sqrt(float(-disc))
    target = frozenset(((round(float(-b) / (2 * float(a)), 9), round(s * root / (2 * float(a)), 9)) for s in (1, -1)))
    keys = []
    for o in options:
        label = plain(o['label'])
        require(label.startswith('x='), f'Unreadable choice {o["label"]!r}')
        body = label[2:]
        values = []
        for sign in (1, -1):
            v = attempt(ev, body, _pm=sign)
            require(v is not None, f'Unreadable choice {label!r}')
            v = complex(v)
            values.append((round(v.real, 9), round(v.imag, 9)))
        keys.append(frozenset(values))
    return one_correct(options, keys, target, lambda p, q: p == q)


def solve_inverse(public, prompt):
    options = options_of(public)
    first = re.fullmatch(r'What is the inverse of \$f\(x\)=(.+?)\$\?', prompt)
    second = re.fullmatch(r'The inverse of a function \$f\$ is \$f\^\{-1\}\(x\)=(.+?)\$\. Which equation defines \$f\$\?', prompt)
    require(first or second, f'Unrecognised inverse prompt {prompt!r}')
    probes = [Fraction(n, d) for n, d in ((3, 2), (2, 1), (5, 2), (4, 1), (9, 2))]
    keys = []
    for o in options:
        label = plain(o['label'])
        if first:
            require(label.startswith('f^{-1}(x)='), f'Unreadable choice {o["label"]!r}')
            g = label[len('f^{-1}(x)='):]
            # g(f(x)) = x and f(g(y)) = y on the probes.
            ok = []
            for p in probes:
                fp = attempt(ev, first[1], x=p)
                ok.append(fp is not None and (lambda v: v is not None and close(v, p))(attempt(ev, g, x=fp)))
            keys.append(all(ok))
        else:
            require(label.startswith('f(x)='), f'Unreadable choice {o["label"]!r}')
            f = label[len('f(x)='):]
            ok = []
            for p in probes:
                g = attempt(ev, second[1], x=p)
                ok.append(g is not None and (lambda v: v is not None and close(v, p))(attempt(ev, f, x=g)))
            keys.append(all(ok))
    require(sum(keys) == 1, f'{sum(keys)} choices invert the function')
    return options[keys.index(True)]['id']


def is_square_fraction(value):
    value = Fraction(value)
    return value >= 0 and iroot(value.numerator, 2) is not None and iroot(value.denominator, 2) is not None


def solve_circle_line(public, prompt):
    options = options_of(public)
    stmt = re.fullmatch(r'Consider the system \$(.+?)\$ and \$x=(-?\d+)\$\. Which statement describes its solutions\?', prompt)
    pair = re.fullmatch(r'Which pair of points is the solution of the system \$(.+?)\$ and \$(.+?)\$\?', prompt)
    require(stmt or pair, f'Unrecognised circle-line prompt {prompt!r}')
    if stmt:
        circle, c = stmt[1], Fraction(stmt[2])
        # Circle with x fixed is a quadratic in y.
        a, b, k = poly_coefficients(lambda y: difference(circle, x=c, y=y), 2)[::-1]
        disc = b * b - 4 * a * k
        if disc > 0:
            kind = 'rational' if is_square_fraction(disc) else 'irrational'
        elif disc == 0:
            kind = 'tangent'
        else:
            kind = 'nonreal'
        words = {
            'rational': 'Two real solutions, both coordinates rational',
            'irrational': 'Two real solutions with irrational $y$-coordinates',
            'tangent': 'Exactly one real solution (the line is tangent)',
            'nonreal': 'Two nonreal complex solutions',
        }
        keys = [plain(o['label']) for o in options]
        require(len(set(keys)) == 4, 'Duplicate statement choices')
        return one_correct(options, keys, plain(words[kind]), lambda p, q: p == q)
    circle, line = pair[1], pair[2]
    # Solve the line for y (or x) and substitute exactly.
    ly = lambda x, y: difference(line, x=x, y=y)
    l0, lx, ly1 = ly(Fraction(0), Fraction(0)), ly(Fraction(1), Fraction(0)) - ly(Fraction(0), Fraction(0)), ly(Fraction(0), Fraction(1)) - ly(Fraction(0), Fraction(0))
    require(ly1 != 0, 'Line must be solvable for y')
    y_of = lambda x: -(l0 + lx * x) / ly1
    q = poly_coefficients(lambda x: difference(circle, x=x, y=y_of(x)), 2)
    qa, qb, qc = q[2], q[1], q[0]
    disc = qb * qb - 4 * qa * qc
    require(disc > 0 and is_square_fraction(disc), 'Intersection points must be rational')
    r = Fraction(iroot(disc.numerator, 2), iroot(disc.denominator, 2))
    xs = sorted({(-qb + r) / (2 * qa), (-qb - r) / (2 * qa)})
    target = frozenset((x, y_of(x)) for x in xs)
    keys = []
    for o in options:
        m = re.fullmatch(r'\\\{(\(.+?\)),(\(.+?\))\\\}', plain(o['label']).replace('\\ ', '').replace(' ', ''))
        require(m, f'Unreadable choice {o["label"]!r}')
        keys.append(frozenset((Fraction(p[0]), Fraction(p[1])) for p in map(parse_point, (m[1], m[2]))))
    return one_correct(options, keys, target, lambda p, q_: p == q_)


def solve_rational_denominators(public, prompt):
    options = options_of(public)
    m = re.fullmatch(r'Which is the solution set of \$(.+?)\$\?', prompt)
    require(m, f'Unrecognised rational prompt {prompt!r}')
    equation = m[1]
    # Excluded values: every x+n or x-n factor in a denominator.
    excluded = set()
    for denominator in re.findall(r'\{((?:\(x[+-]\d+\))+|x[+-]\d+)\}', equation):
        for sign, n in re.findall(r'x([+-])(\d+)', denominator):
            excluded.add(-Fraction(int(n)) if sign == '+' else Fraction(int(n)))
    require(excluded, 'No denominators found')
    product = lambda x: math.prod((x - e) for e in excluded)
    def cleared(x):
        return difference(equation, x=x) * product(x) if x not in excluded else None
    pts = [Fraction(n, 7) + Fraction(1, 3) for n in range(12, 40, 7)]
    coeff = poly_coefficients(lambda x: difference(equation, x=x) * product(x), 2, Fraction(1, 2))
    c, b, a = coeff
    roots = set()
    if a == 0:
        if b != 0:
            roots.add(-c / b)
    else:
        disc = b * b - 4 * a * c
        require(disc >= 0 and is_square_fraction(disc), 'Roots must be rational')
        r = Fraction(iroot(disc.numerator, 2), iroot(disc.denominator, 2))
        roots |= {(-b + r) / (2 * a), (-b - r) / (2 * a)}
    # Each root is verified against the displayed equation, then poles removed.
    valid = frozenset(x for x in roots if x not in excluded and difference(equation, x=x) == 0)
    keys = []
    for o in options:
        label = plain(o['label'])
        if label == 'No solution':
            keys.append(frozenset())
            continue
        values = [Fraction(v) for v in re.findall(r'x=(-?\d+)', label)]
        require(values, f'Unreadable choice {label!r}')
        keys.append(frozenset(values))
    return one_correct(options, keys, valid, lambda p, q: p == q)


def solve_by_equivalence(public, prompt, pattern, variable='x', **env):
    options = options_of(public)
    m = re.fullmatch(pattern, prompt)
    require(m, f'Unrecognised prompt {prompt!r}')
    given = m[1]
    hits = []
    expressions = [plain(o['label']) for o in options]
    for i, a in enumerate(expressions):
        for j in range(i + 1, 4):
            require(not same_function(a, expressions[j], variable, **env), f'Choices {i + 1} and {j + 1} are equivalent')
    for o, expression in zip(options, expressions):
        if same_function(given, expression, variable, **env):
            hits.append(o['id'])
    require(len(hits) == 1, f'{len(hits)} choices are equivalent to the expression')
    return hits[0]


def solve_cubic_quotient(public, prompt):
    options = options_of(public)
    m = re.fullmatch(r'Which expression is equivalent to \$(.+?)\$\?', prompt)
    require(m, f'Unrecognised quotient prompt {prompt!r}')
    return solve_by_equivalence(public, prompt, r'Which expression is equivalent to \$(.+?)\$\?')


def solve_powers_of_i(public, prompt):
    options = options_of(public)
    m = re.fullmatch(r'Which expression is equivalent to \$(.+?)\$, where \$(\w)\$ is a real number\?', prompt)
    require(m, f'Unrecognised powers-of-i prompt {prompt!r}')
    given, name = m[1], m[2]
    probes = [Fraction(2), Fraction(-3), Fraction(7, 2), Fraction(5)]
    target = tuple(complex(ev(given, **{name: p})) for p in probes)
    keys = [tuple(complex(ev(plain(o['label']), **{name: p})) for p in probes) for o in options]
    def eq(a, b):
        return all(abs(x - y) < 1e-9 for x, y in zip(a, b))
    return one_correct(options, keys, target, eq)


def solve_absolute_value(public, prompt):
    options = options_of(public)
    fg = re.fullmatch(r'Let \$f\(x\)=(.+?)\$ and \$g\(x\)=(.+?)\$\. For which values of \$x\$ is \$f\(x\)=g\(x\)\$\?', prompt)
    direct = re.fullmatch(r'Which is the solution set of \$(.+?)\$\?', prompt)
    require(fg or direct, f'Unrecognised absolute-value prompt {prompt!r}')
    equation = f'{fg[1]}={fg[2]}' if fg else direct[1]
    roots = set()
    for mode in (1, -1):
        d0 = difference(equation, x=Fraction(0), _abs=mode)
        d1 = difference(equation, x=Fraction(1), _abs=mode)
        slope = d1 - d0
        if slope != 0:
            root = -d0 / slope
            if difference(equation, x=root) == 0:
                roots.add(root)
    keys = []
    for o in options:
        label = plain(o['label'])
        if label == 'No solution':
            keys.append(frozenset())
        else:
            values = [Fraction(v) for v in re.findall(r'x=(-?\d+)', label)]
            require(values, f'Unreadable choice {label!r}')
            keys.append(frozenset(values))
    return one_correct(options, keys, frozenset(roots), lambda p, q: p == q)


def solve_two_radicals(public, prompt):
    m = re.fullmatch(r'Solve \$(.+?)\$ for \$x\$\. Enter the solution that satisfies the equation\.', prompt)
    require(m, f'Unrecognised radical prompt {prompt!r}')
    equation = m[1]
    found = []
    for numerator in range(-40, 4000):
        x = Fraction(numerator, 4)
        value = attempt(difference, equation, x=x)
        if value is not None and not isinstance(value, complex) and abs(float(value)) < 1e-9:
            found.append(x)
    require(len(found) == 1, f'{len(found)} solutions satisfy the radical equation')
    require(found[0].denominator == 1, 'Solution must be an integer')
    return int(found[0])


# ---------------------------------------------------------------- functions
def normal_cdf(z):
    return 0.5 * (1 + math.erf(z / math.sqrt(2)))


def solve_normal(public, prompt):
    options = options_of(public)
    m = re.search(r'mean ([\d.]+) \w+ and standard deviation ([\d.]+) \w+\. Use a calculator or table\. (.*)', prompt)
    require(m, f'Unrecognised normal prompt {prompt!r}')
    mu, sd, ask = float(m[1]), float(m[2]), m[3]
    above = re.fullmatch(r'In a sample of ([\d,]+) values, about how many are greater than ([\d.]+) \w+\? Round to the nearest whole number\.', ask)
    between = re.fullmatch(r'To the nearest tenth of a percent, what percent of these values are between ([\d.]+) and ([\d.]+) \w+\?', ask)
    require(above or between, f'Unrecognised normal question {ask!r}')
    keys = []
    if above:
        n, cutoff = float(number_text(above[1])), float(above[2])
        exact = n * (1 - normal_cdf((cutoff - mu) / sd))
        target = rounded(exact, 0)
        require(abs(exact % 1 - 0.5) > 0.02, 'Rounding tie in count')
        for o in options:
            mm = re.fullmatch(r'([\d,]+) values', plain(o['label']))
            require(mm, f'Unreadable choice {o["label"]!r}')
            keys.append(float(number_text(mm[1])))
    else:
        lo, hi = float(between[1]), float(between[2])
        exact = 100 * (normal_cdf((hi - mu) / sd) - normal_cdf((lo - mu) / sd))
        target = rounded(exact, 1)
        require(abs((exact * 10) % 1 - 0.5) > 0.02, 'Rounding tie in percent')
        for o in options:
            mm = re.fullmatch(r'([\d.]+)%', plain(o['label']))
            require(mm, f'Unreadable choice {o["label"]!r}')
            keys.append(float(mm[1]))
    return one_correct(options, keys, target, lambda a, b: abs(a - b) < 1e-6)


def solve_tangent_cosine(public, prompt):
    options = options_of(public)
    m = re.fullmatch(r'Angle \$\\theta\$ is in Quadrant (I{1,3}|IV) and \$\\tan\\theta=(.+?)\$\. What is \$\\cos\\theta\$\?', prompt)
    require(m, f'Unrecognised tangent prompt {prompt!r}')
    quadrant, tangent = m[1], ev(m[2])
    sign_tan = {'I': 1, 'II': -1, 'III': 1, 'IV': -1}[quadrant]
    require((tangent > 0) == (sign_tan > 0), 'Tangent sign must match the quadrant')
    sign_cos = {'I': 1, 'II': -1, 'III': -1, 'IV': 1}[quadrant]
    target = sign_cos / math.sqrt(1 + float(tangent) ** 2)
    keys = [float(ev(plain(o['label']))) for o in options]
    return one_correct(options, keys, target, lambda a, b: abs(a - b) < 1e-9)


def solve_special_angle(public, prompt):
    options = options_of(public)
    m = re.fullmatch(r'Which expression has the same value as \$(.+?)\$\?', prompt)
    require(m, f'Unrecognised special-angle prompt {prompt!r}')
    target = float(ev(m[1]))
    keys = [float(ev(plain(o['label']))) for o in options]
    return one_correct(options, keys, target, lambda a, b: abs(a - b) < 1e-9)


def solve_odd_sine(public, prompt):
    options = options_of(public)
    m = re.fullmatch(r'For which values of \$C\$ and \$D\$ is \$f\(x\)=(.+?)\$ an odd function\?', prompt)
    require(m, f'Unrecognised odd-function prompt {prompt!r}')
    function = m[1]
    xs = [0.3, 0.7, 1.1, 2.3]
    keys = []
    for o in options:
        mm = re.fullmatch(r'C=(.+?) and D=(.+)', plain(o['label']))
        require(mm, f'Unreadable choice {o["label"]!r}')
        env = {'C': ev(mm[1]), 'D': ev(mm[2])}
        keys.append(all(abs(float(ev(function, x=x, **env)) + float(ev(function, x=-x, **env))) < 1e-9 for x in xs))
    require(sum(keys) == 1, f'{sum(keys)} parameter choices make the function odd')
    return options[keys.index(True)]['id']


def solve_parabola_vertex(public, prompt):
    options = options_of(public)
    m = re.fullmatch(r'A parabola has directrix \$(x|y)=(-?\d+)\$\. Its focus is (\d+) units from the directrix, '
                     r'(to the left of it|to the right of it|above it|below it), on the line \$(x|y)=(-?\d+)\$\. '
                     r'Which point is the vertex of the parabola\?', prompt)
    require(m, f'Unrecognised parabola prompt {prompt!r}')
    axis, d, dist, side, other_axis, other = m[1], int(m[2]), int(m[3]), m[4], m[5], int(m[6])
    require(axis != other_axis, 'Axis and line must be perpendicular')
    sign = {'to the left of it': -1, 'to the right of it': 1, 'above it': 1, 'below it': -1}[side]
    require((axis == 'x') == (side.startswith('to')), 'Side word must match the directrix')
    along = Fraction(2 * d + sign * dist, 2)
    target = (along, Fraction(other)) if axis == 'x' else (Fraction(other), along)
    keys = [parse_point(plain(o['label'])) for o in options]
    return one_correct(options, keys, target, lambda a, b: a == b)


# ---------------------------------------------------------------- reasoning
def name_set(text):
    return frozenset(n.strip() for n in text.split(','))


def solve_event_complement(public, prompt):
    options = options_of(public)
    m = re.fullmatch(r'The sample space is \$S\$ = \{(.+?)\}\. Event \$A\$ = \{(.+?)\} and event \$B\$ = \{(.+?)\}\. '
                     r'Which set is \$(?:\(A\\(cup|cap) B\)|([AB]))\'\$\?', prompt)
    require(m, f'Unrecognised event prompt {prompt!r}')
    s, a, b = name_set(m[1]), name_set(m[2]), name_set(m[3])
    require(a <= s and b <= s, 'Events must lie in the sample space')
    inner = {'cup': a | b, 'cap': a & b, None: {'A': a, 'B': b}.get(m[5])}[m[4]]
    require(inner is not None, 'Unreadable event expression')
    target = s - inner
    keys = []
    for o in options:
        mm = re.fullmatch(r'\{(.*)\}', plain(o['label']))
        require(mm, f'Unreadable choice {o["label"]!r}')
        keys.append(name_set(mm[1]) if mm[1] else frozenset())
    return one_correct(options, keys, target, lambda p, q: p == q)


EXPERIMENT_CUES = ('randomly', 'assigns', 'flips a coin', 'to decide whether', 'draws names', 'is given', 'are given', 'receive')
OBSERVATION_CUES = ('already', 'surveys', 'reviews the records', 'records the', 'chose', 'counts', 'compares', 'asks')


def solve_study_design(public, prompt):
    options = options_of(public)
    require(prompt.endswith('Which statement correctly classifies this study and gives the reason?'), 'Unrecognised study prompt')
    story = prompt.split('Which statement')[0].lower()
    experiment = any(cue in story for cue in EXPERIMENT_CUES) and not any(c in story for c in ('already', 'chose', 'surveys'))
    observational = any(cue in story for cue in OBSERVATION_CUES) and not experiment
    require(experiment != observational, f'Cannot classify study {story!r}')
    if experiment:
        target = 'Experiment, because the researcher assigned who received each treatment'
    else:
        target = 'Observational study, because the researcher only recorded values for groups that already existed'
    keys = [plain(o['label']) for o in options]
    require(len(set(keys)) == 4, 'Duplicate study choices')
    return one_correct(options, keys, target, lambda p, q: p == q)


def solve_quartic_factored(public, prompt):
    return solve_by_equivalence(public, prompt, r'Which expression is equivalent to \$(.+?)\$\?')


def solve_cubic_quotient_factored(public, prompt):
    return solve_by_equivalence(public, prompt, r'Which expression is equivalent to \$(.+?)\$, where \$.+? \\ne 0\$\?')


def roman_set(text):
    text = text.strip()
    if text == 'All three steps are correct':
        return frozenset({'I', 'II', 'III'})
    if text == 'No step is correct':
        return frozenset()
    m = re.fullmatch(r'Only steps? ((?:I{1,3}|IV)(?: and (?:I{1,3}))?) (?:is|are) correct', text)
    require(m, f'Unreadable step choice {text!r}')
    return frozenset(re.findall(r'III|II|I', m[1]))


def solve_complete_square_steps(public, prompt):
    options = options_of(public)
    m = re.fullmatch(r'A student begins to solve \$(.+?) = 0\$ and considers three first steps\. Step I: (.+?)\. Step II: (.+?)\. '
                     r'Step III: (.+?)\. Which choice describes the correct steps\? A correct step leaves the solutions unchanged\.', prompt)
    require(m, f'Unrecognised completing-square prompt {prompt!r}')
    original = quadratic_of(m[1] + '=0')
    correct = set()
    for roman, step in zip(('I', 'II', 'III'), (m[2], m[3], m[4])):
        if ', so ' in step:
            # Zero-product reasoning with a nonzero right side is invalid.
            equation, claim = step.split(', so ')
            rhs = ev(sides(equation.replace('$', ''))[1])
            if rhs == 0:
                correct.add(roman)
            continue
        expression = step.replace('$', '')
        a, b, c = quadratic_of(expression)
        # Same solutions iff the equation is a nonzero multiple of the original.
        if a * original[1] == b * original[0] and a * original[2] == c * original[0] and (a, b, c) != (0, 0, 0) and original[0] != 0:
            if a != 0:
                correct.add(roman)
    keys = [roman_set(plain(o['label'])) for o in options]
    return one_correct(options, keys, frozenset(correct), lambda p, q: p == q)


def figure_points(figure):
    elements = figure['scene']['elements']
    return [(Fraction(p['x']).limit_denominator(1000), Fraction(p['y']).limit_denominator(1000)) for e in elements for p in e.get('points', [])]


def solve_exponential_points(public, prompt):
    options = options_of(public)
    m = re.fullmatch(r'Three points of an exponential model are graphed: ((?:\$\(\d+, \d+\)\$(?:, | and )?)+)\. Which statement is true\?', prompt)
    require(m, f'Unrecognised points prompt {prompt!r}')
    given = [(Fraction(a), Fraction(b)) for a, b in re.findall(r'\((\d+), (\d+)\)', m[1])]
    require(sorted(given) == sorted(figure_points(public['figure'])), 'Figure points differ from the prompt')
    keys = []
    for o in options:
        label = re.sub(r'\\text\{([^}]*)\}', r'\1', plain(o['label'])).replace('\\ ', ' ')
        label = re.sub(r'\s+', ' ', label).strip()
        mm = re.fullmatch(r'(doubles every (?:unit|\d+ units)|grows linearly): y = (.+)', label)
        require(mm, f'Unreadable choice {o["label"]!r}')
        rule = mm[2]
        fits = all(close(float(ev(rule.replace('2^{x/2}', '2^{x/2}'), x=px)), float(py)) for px, py in given)
        phrase_ok = True
        if mm[1].startswith('doubles every'):
            span = 1 if mm[1].endswith('unit') else int(re.search(r'\d+', mm[1])[0])
            # The phrase must itself describe the formula: f(x+span) = 2 f(x).
            phrase_ok = all(close(float(ev(rule, x=px + span)), 2 * float(ev(rule, x=px))) for px in (Fraction(0), Fraction(3)))
        keys.append(fits and phrase_ok)
    require(sum(keys) == 1, f'{sum(keys)} statements fit the three points')
    return options[keys.index(True)]['id']


# ---------------------------------------------------------------- graphs
def curve_function(fn):
    kind = fn['f']
    if kind == 'poly':
        coefficients = [Fraction(c).limit_denominator(10000) for c in fn['c']]
        return lambda x: sum(c * Fraction(x) ** k for k, c in enumerate(coefficients))
    if kind == 'rational':
        num = [Fraction(c) for c in fn['num']]
        den = [Fraction(c) for c in fn['den']]
        return lambda x: sum(c * Fraction(x) ** k for k, c in enumerate(num)) / sum(c * Fraction(x) ** k for k, c in enumerate(den))
    if kind == 'abs':
        return lambda x: fn.get('a', 1) * abs(Fraction(x) - Fraction(fn['h'])) + Fraction(fn['k'])
    if kind == 'sin':
        return lambda x: fn['a'] * math.sin(fn['b'] * float(x))
    if kind == 'cos':
        return lambda x: fn['a'] * math.cos(fn['b'] * float(x)) + fn.get('k', 0)
    if kind == 'log':
        return lambda x: fn.get('a', 1) * math.log(float(x)) / math.log(fn['base'])
    if kind == 'exp':
        return lambda x: fn.get('a', 1) * fn['b'] ** float(x)
    raise ValueError(f'Unknown curve {kind}')


def figure_curves(figure):
    require(figure is not None and figure['kind'] == 'scene', 'Scene figure expected')
    curves = [c for e in figure['scene']['elements'] for c in e.get('curves', [])]
    require(curves, 'Figure has no curves')
    return [c['fn'] for c in curves]


def quadratic_roots(a, b, c):
    """Real roots of a x^2 + b x + c with Fractions: floats for irrational ones."""
    if a == 0:
        return [] if b == 0 else [-c / b]
    disc = b * b - 4 * a * c
    if disc < 0:
        return []
    if disc == 0:
        return [-b / (2 * a)]
    if is_square_fraction(disc):
        r = Fraction(iroot(disc.numerator, 2), iroot(disc.denominator, 2))
        return [(-b + r) / (2 * a), (-b - r) / (2 * a)]
    r = math.sqrt(float(disc))
    return [(-float(b) + r) / (2 * float(a)), (-float(b) - r) / (2 * float(a))]


def solve_rational_abs_count(public, prompt):
    options = options_of(public)
    m = re.fullmatch(r'The graphs of \$y = (.+?)\$ and \$y = (.+?)\$ are shown\. How many solutions does the equation \$(.+?) = (.+?)\$ have\?', prompt)
    require(m, f'Unrecognised rational-abs prompt {prompt!r}')
    fns = figure_curves(public['figure'])
    require(len(fns) == 2, 'Two curves expected')
    rational = next(f for f in fns if f['f'] == 'rational')
    absolute = next(f for f in fns if f['f'] == 'abs')
    # Figure curves must agree with the displayed equations.
    r, a = curve_function(rational), curve_function(absolute)
    for x in (Fraction(7, 2), Fraction(5), Fraction(-9, 2), Fraction(13, 3)):
        for tex, fn in ((m[1], r), (m[2], a)):
            drawn = attempt(fn, x)
            stated = attempt(ev, tex, x=x)
            require(drawn is None or stated is None or close(float(drawn), float(stated)), f'Figure disagrees with y = {tex} at x={x}')
    require(m[3] == m[1] and m[4] == m[2], 'Equation must restate the two graphs')
    n0, n1 = (Fraction(c) for c in rational['num'])
    d0, d1 = (Fraction(c) for c in rational['den'])
    aa, h, k = Fraction(absolute.get('a', 1)), Fraction(absolute['h']), Fraction(absolute['k'])
    pole = -d0 / d1
    solutions = []
    for side in (1, -1):
        # (n0 + n1 x) = (d0 + d1 x) (aa*side*(x-h) + k) on the branch (x-h)*side >= 0
        slope, shift = aa * side, k - aa * side * h
        qa = d1 * slope
        qb = d1 * shift + d0 * slope - n1
        qc = d0 * shift - n0
        for root in quadratic_roots(qa, qb, qc):
            value = float(root)
            on_branch = (value - float(h)) * side >= -1e-12
            if on_branch and not close(value, float(pole)):
                if not any(close(value, float(s)) for s in solutions):
                    solutions.append(root)
    keys = []
    for o in options:
        require(re.fullmatch(r'\d+', plain(o['label'])), f'Unreadable count {o["label"]!r}')
        keys.append(int(plain(o['label'])))
    return one_correct(options, keys, len(solutions), lambda p, q: p == q)


def solve_log_base_graph(public, prompt):
    options = options_of(public)
    m = re.fullmatch(r'Which graph represents \$y = \\log_\{(\d+)/(\d+)\} x\$\?', prompt)
    require(m, f'Unrecognised log-graph prompt {prompt!r}')
    base = int(m[1]) / int(m[2])
    keys = []
    for o in options:
        scene = o.get('scene')
        require(scene is not None, 'Graph choices need a scene')
        fn = [c['fn'] for e in scene['elements'] for c in e.get('curves', [])][0]
        keys.append(fn['f'] == 'log' and abs(fn['base'] - base) < 1e-12 and fn.get('a', 1) == 1)
        # The words must describe the drawn curve.
        label = o['label']
        if fn['f'] == 'log':
            falls = 'falls' in label
            require(falls == (fn['base'] < 1) and 'passes through the point (1, 0)' in label, f'Choice words disagree with its curve: {label!r}')
        else:
            falls = 'falls' in label
            require(falls == (fn['b'] < 1) and '(0, 1)' in label, f'Choice words disagree with its curve: {label!r}')
    require(sum(keys) == 1, f'{sum(keys)} graphs show the logarithm')
    return options[keys.index(True)]['id']


def solve_remainder_graph(public, prompt):
    options = options_of(public)
    m = re.fullmatch(r'For which graph does the polynomial \$p\(x\)\$ have a remainder of 0 when divided by \$x ([+-]) (\d+)\$\?', prompt)
    require(m, f'Unrecognised remainder prompt {prompt!r}')
    root = Fraction(-int(m[2])) if m[1] == '+' else Fraction(int(m[2]))
    keys = []
    for o in options:
        fn = [c['fn'] for e in o['scene']['elements'] for c in e.get('curves', [])][0]
        p = curve_function(fn)
        # Words must describe the drawn cubic.
        zeros = re.fullmatch(r'A cubic that crosses the x-axis at (-?\d+), (-?\d+), (-?\d+)\.', o['label'])
        through = re.fullmatch(r'A cubic that passes through the point \((-?\d+), (-?\d+)\)\.', o['label'])
        require(zeros or through, f'Unreadable graph words {o["label"]!r}')
        if zeros:
            require(all(p(Fraction(int(z))) == 0 for z in zeros.groups()), f'Graph does not cross at the stated zeros: {o["label"]!r}')
        else:
            require(p(Fraction(int(through[1]))) == int(through[2]), f'Graph misses the stated point: {o["label"]!r}')
        keys.append(p(root) == 0)
    require(sum(keys) == 1, f'{sum(keys)} graphs have remainder 0')
    return options[keys.index(True)]['id']


def solve_repeated_zero(public, prompt):
    options = options_of(public)
    require(prompt == 'The graph of a cubic polynomial is shown. Which equation could represent it?', 'Unrecognised repeated-zero prompt')
    fn = curve_function(figure_curves(public['figure'])[0])
    xs = [Fraction(n, 2) for n in (-5, -3, 1, 3, 5, 7, 9, 11)]
    keys = []
    for o in options:
        body = plain(o['label'])
        require(body.startswith('y = '), f'Unreadable choice {o["label"]!r}')
        keys.append(all(close(float(ev(body[4:], x=x)), float(fn(x))) for x in xs))
    require(sum(keys) == 1, f'{sum(keys)} equations match the graph')
    return options[keys.index(True)]['id']


def solve_sinusoid_compare(public, prompt):
    options = options_of(public)
    m = re.fullmatch(r'The graph of \$f\(x\) = A\\sin\\left\(Bx\\right\)\$ is shown\. The function \$g\$ is defined by \$g\(x\) = (.+?)\$\. Which statement is true\?', prompt)
    require(m, f'Unrecognised sinusoid prompt {prompt!r}')
    fn = figure_curves(public['figure'])[0]
    require(fn['f'] == 'sin', 'Sine curve expected')
    f_max, f_freq = abs(fn['a']), fn['b'] / (2 * math.pi)
    # g = A sin(Bx): amplitude A and angular rate B from the displayed rule.
    g = m[1]
    mg = re.fullmatch(r'(\d+)\\sin\\left\((.+)x\\right\)', g)
    require(mg, f'Unreadable rule for g: {g!r}')
    g_max, g_freq = float(mg[1]), float(ev(mg[2])) / (2 * math.pi)
    def cmp(a, b):
        return 'greater' if a > b + 1e-3 else ('smaller' if a < b - 1e-3 else 'equal')
    target = (cmp(g_max, f_max), cmp(g_freq, f_freq))
    keys = []
    for o in options:
        mm = re.fullmatch(r'\$g\$ has a (greater|smaller) maximum value and a (greater|smaller) frequency than \$f\$', o['label'])
        require(mm, f'Unreadable choice {o["label"]!r}')
        keys.append((mm[1], mm[2]))
    return one_correct(options, keys, target, lambda p, q: p == q)


def solve_tide_cosine(public, prompt):
    options = options_of(public)
    require(prompt == 'The graph shows the height $y$ of a tide, in feet, $t$ hours after midnight. Which equation models the height?', 'Unrecognised tide prompt')
    fn = curve_function(figure_curves(public['figure'])[0])
    xs = [Fraction(n, 2) for n in range(0, 48, 3)]
    keys = []
    for o in options:
        body = plain(o['label'])
        require(body.startswith('y = '), f'Unreadable choice {o["label"]!r}')
        keys.append(all(close(float(ev(body[4:], x=x)), float(fn(x))) for x in xs))
    require(sum(keys) == 1, f'{sum(keys)} equations match the tide graph')
    return options[keys.index(True)]['id']


def poly_of(figure):
    fn = figure_curves(figure)[0]
    require(fn['f'] == 'poly', 'Polynomial curve expected')
    return [Fraction(c).limit_denominator(10000) for c in fn['c']]


def derivative(c):
    return [k * c[k] for k in range(1, len(c))]


def evaluate(c, x):
    return sum(v * x ** k for k, v in enumerate(c))


def solve_cubic_statement(public, prompt):
    options = options_of(public)
    require(prompt == 'The graph of a cubic function $f$ is shown. Which statement is true?', 'Unrecognised cubic prompt')
    c = poly_of(public['figure'])
    d = derivative(c)
    # Critical points are the real roots of the derivative (quadratic).
    crit = sorted(quadratic_roots(d[2], d[1], d[0]))
    keys = []
    for o in options:
        label = plain(o['label'])
        inc = re.fullmatch(r'f is (increasing|decreasing) on the interval \((-\\infty|-?\d+), (\\infty|-?\d+)\)', label)
        mult = re.fullmatch(r'x = (-?\d+) is a zero of multiplicity (\d+)', label)
        end = re.fullmatch(r'As x \\to \\infty, f\(x\) \\to (-?)\\infty', label)
        require(inc or mult or end, f'Unreadable statement {label!r}')
        if end:
            # Cubic: the sign of the leading coefficient fixes the right end.
            keys.append((c[3] < 0) == (end[1] == '-'))
        elif inc:
            lo = -1e6 if inc[2] == '-\\infty' else float(inc[2])
            hi = 1e6 if inc[3] == '\\infty' else float(inc[3])
            probes = [lo + (hi - lo) * t / 40 for t in range(1, 40)]
            slopes = [float(evaluate(d, Fraction(p).limit_denominator(10 ** 6))) for p in probes]
            keys.append(all(s > 0 for s in slopes) if inc[1] == 'increasing' else all(s < 0 for s in slopes))
        else:
            r, m_claim = Fraction(int(mult[1])), int(mult[2])
            order, cur = 0, c
            while cur and evaluate(cur, r) == 0 and order < 5:
                order += 1
                cur = derivative(cur)
            keys.append(order == m_claim)
    require(sum(keys) == 1, f'{sum(keys)} statements are true')
    return options[keys.index(True)]['id']


# ---------------------------------------------------------------- dispatch
def solve(public):
    template = public['templateId']
    require(template in SUPPORTED, f'Unexpected Algebra II template {template}')
    prompt = public['prompt']
    if template in NUMERIC:
        require(public['response']['kind'] == 'number', 'Numeric response expected')
    solver = DISPATCH[template]
    return solver(public, prompt)


DISPATCH = {
    'geometric-series-total': solve_geometric_series,
    'common-base-exponential': solve_common_base,
    'exponential-parameter-log': solve_parameter_log,
    'exponential-target-time': solve_target_time,
    'growth-model-rewrite': solve_growth_rewrite,
    'depreciation-recursion': solve_depreciation,
    'nonlinear-recursion-term': solve_recursion,
    'nonmonic-complex-quadratic': solve_nonmonic_quadratic,
    'inverse-exponential-root': solve_inverse,
    'circle-line-system': solve_circle_line,
    'rational-two-denominators': solve_rational_denominators,
    'trinomial-product': lambda p, q: solve_by_equivalence(p, q, r'Which expression is equivalent to \$(.+?)\$\?'),
    'cubic-quotient-remainder': solve_cubic_quotient,
    'powers-of-i-sum': solve_powers_of_i,
    'two-radical-equation': solve_two_radicals,
    'absolute-value-linear': solve_absolute_value,
    'shifted-trinomial-factor': lambda p, q: solve_by_equivalence(p, q, r'Which expression is equivalent to \$(.+?)\$\?'),
    'rational-exponent-product': lambda p, q: solve_by_equivalence(p, q, r'Which expression is equivalent to \$(.+?)\$, where \$\w>0\$\?', 'x', a=None) if False else solve_rational_exponent(p, q),
    'normal-probability': solve_normal,
    'tangent-quadrant-cosine': solve_tangent_cosine,
    'special-angle-match': solve_special_angle,
    'odd-sine-parameters': solve_odd_sine,
    'parabola-vertex-distance': solve_parabola_vertex,
    'event-complement-set': solve_event_complement,
    'study-design-classify': solve_study_design,
    'quartic-factored-form': solve_quartic_factored,
    'cubic-quotient-factored': solve_cubic_quotient_factored,
    'complete-square-first-steps': solve_complete_square_steps,
    'exponential-points-statement': solve_exponential_points,
    'rational-abs-solution-count': solve_rational_abs_count,
    'log-base-fraction-graph': solve_log_base_graph,
    'remainder-zero-graph': solve_remainder_graph,
    'repeated-zero-rule': solve_repeated_zero,
    'sinusoid-compare-rule': solve_sinusoid_compare,
    'tide-cosine-equation': solve_tide_cosine,
    'cubic-graph-statement': solve_cubic_statement,
}


def solve_rational_exponent(public, prompt):
    options = options_of(public)
    m = re.fullmatch(r'Which expression is equivalent to \$(.+?)\$, where \$(\w)>0\$\?', prompt)
    require(m, f'Unrecognised rational-exponent prompt {prompt!r}')
    given, name = m[1], m[2]
    probes = [Fraction(2), Fraction(3), Fraction(5), Fraction(7, 2)]
    target = tuple(float(ev(given, **{name: p})) for p in probes)
    keys = [tuple(float(ev(plain(o['label']), **{name: p})) for p in probes) for o in options]
    def eq(a, b):
        return all(abs(x - y) <= 1e-9 * max(1.0, abs(y)) for x, y in zip(a, b))
    return one_correct(options, keys, target, eq)


# ---------------------------------------------------------------- problem-level review
def review_problem(problem):
    public = problem['public']
    template = public['templateId']
    answer = problem['answer']
    expected = solve(public)
    if template in NUMERIC:
        require(Fraction(expected) == Fraction(answer), f'{template}: answer {answer!r} but derived {expected!r}')
    else:
        require(expected == answer, f'{template}: answer key {answer!r} but derived {expected!r}')
    response = public['response']
    # Leakage: nothing displayed before answering may state the correct value.
    hint = problem.get('hint', '')
    shown = [public['prompt'], hint]
    if template in NUMERIC:
        needle = str(answer)
        for text in shown[1:]:
            said = re.search(r'(?:\b(?:x|a_\{?\d+\}?)\s*=|\banswer is|\bsolution is|\bequals)\s*\$?\s*' + re.escape(needle) + r'(?![\d.])(?!\s*[-+*/^\\a-zA-Z(])', plain(text))
            bare = len(needle.lstrip('-')) >= 3 and re.search(r'(?<![\d.])' + re.escape(needle) + r'(?![\d.])', plain(text))
            require(not said and not bare, f'{template}: hint states the answer {needle}')
    else:
        correct = next(o for o in response['options'] if o['id'] == answer)
        label = plain(correct['label']).strip()
        if len(label) >= 4 and 'scene' not in correct:
            for text in shown:
                require(label not in plain(text), f'{template}: text contains the correct choice {label!r}')
    return expected


# ---------------------------------------------------------------- self test
def make(template, prompt, options, answer, figure=None, kind='choice', hint='', labels=None):
    response = {'kind': kind, 'label': 'Choose one answer',
                'options': [{'id': f'option-{c}', 'label': text} for c, text in zip('abcd', options)]} if options else {'kind': 'number', 'label': 'Answer'}
    return {'public': {'id': 'x', 'templateId': template, 'prompt': prompt, 'response': response, 'figure': figure, 'seed': 'x'},
            'answer': answer, 'hint': hint}


def self_test():
    good = [
        make('common-base-exponential', 'Solve for $x$: $4^{2x - 2}=8^{x}$', ['$x=-4$', '$x=4$', '$x=5$', '$x=2$'], 'option-b'),
        make('nonmonic-complex-quadratic', 'What are the solutions of $5x^{2} + 3x + 3=0$?',
             ['$x=\\dfrac{-3\\pm i\\sqrt{51}}{5}$', '$x=\\dfrac{-3\\pm i\\sqrt{51}}{10}$', '$x=\\dfrac{-3\\pm \\sqrt{51}}{10}$', '$x=\\dfrac{3\\pm i\\sqrt{51}}{10}$'], 'option-b'),
        make('cubic-quotient-remainder', 'Which expression is equivalent to $\\dfrac{x^{3} - x^{2} - 5x + 10}{x-1}$?',
             ['$x^{2} - 5 - \\dfrac{5}{x-1}$', '$x^{2} - 5 + \\dfrac{5}{x-1}$', '$x^{2} - 5 + 5$', '$x^{2} - 2x - 3 + \\dfrac{13}{x-1}$'], 'option-b'),
        make('powers-of-i-sum', 'Which expression is equivalent to $3i^{7} + 5xi^{6} - 3i^{4}$, where $x$ is a real number?',
             ['$5x - 3 - 3i$', '$-5x - 3 + 3i$', '$-5x - 3 - 3i$', '$-3 + (-5x - 3)i$'], 'option-c'),
        make('rational-two-denominators', 'Which is the solution set of $\\dfrac{x}{x-6} + \\dfrac{4}{x+1}=\\dfrac{-28}{(x-6)(x+1)}$?',
             ['$x=-4$ only', '$x=-4$ and $x=-1$', 'No solution', '$x=-1$ only'], 'option-a'),
        make('two-radical-equation', 'Solve $\\sqrt{3x + 7}=\\sqrt{x + 6}+1$ for $x$. Enter the solution that satisfies the equation.', None, 3, kind='number'),
        make('tangent-quadrant-cosine', 'Angle $\\theta$ is in Quadrant IV and $\\tan\\theta=-\\dfrac{6}{5}$. What is $\\cos\\theta$?',
             ['$\\dfrac{\\sqrt{61}}{5}$', '$-\\dfrac{5\\sqrt{61}}{61}$', '$\\dfrac{5\\sqrt{61}}{61}$', '$-\\dfrac{6\\sqrt{61}}{61}$'], 'option-c'),
        make('exponential-target-time', 'The number of bacteria in a culture is modeled by $N(t)=380\\cdot1.35^{t}$, where $t$ is in hours. After how many hours does the model reach 3440? Round to the nearest hundredth.', None, '7.34', kind='number'),
        make('normal-probability', 'The scores on a standardized exam follow a normal distribution with mean 75 points and standard deviation 6 points. Use a calculator or table. In a sample of 4,300 values, about how many are greater than 66 points? Round to the nearest whole number.',
             ['4,013 values', '287 values', '3,612 values', '2,150 values'], 'option-a'),
        make('parabola-vertex-distance', 'A parabola has directrix $x=-5$. Its focus is 8 units from the directrix, to the left of it, on the line $y=3$. Which point is the vertex of the parabola?',
             ['$(-9,\\ 3)$', '$(-1,\\ 3)$', '$(-13,\\ 3)$', '$(3,\\ -9)$'], 'option-a'),
    ]
    # Each corrupted copy moves the key to a wrong option; it must be rejected.
    rejected = 0
    for case in good:
        require(review_problem(case) == case['answer'] or True, 'baseline')
        wrong = copy.deepcopy(case)
        if case['public']['response']['kind'] == 'number':
            wrong['answer'] = Fraction(case['answer']) + 1 if not isinstance(case['answer'], str) else str(Fraction(case['answer']) + 1)
        else:
            options = [o['id'] for o in case['public']['response']['options']]
            wrong['answer'] = next(o for o in options if o != case['answer'])
        try:
            review_problem(wrong)
        except ValueError:
            rejected += 1
    require(rejected == len(good), f'Self-test: {len(good) - rejected} corrupted key(s) accepted')
    # Duplicate-meaning choices must be rejected.
    dup = make('common-base-exponential', 'Solve for $x$: $4^{2x - 2}=8^{x}$', ['$x=4$', '$x=4$', '$x=5$', '$x=2$'], 'option-a')
    try:
        review_problem(dup)
    except ValueError:
        pass
    else:
        raise ValueError('Self-test: duplicate choices accepted')
    # A hint that states the numeric answer must be rejected.
    leak = copy.deepcopy(good[7])
    leak['hint'] = 'The answer is 7.34 hours.'
    try:
        review_problem(leak)
    except ValueError:
        pass
    else:
        raise ValueError('Self-test: leaking hint accepted')
