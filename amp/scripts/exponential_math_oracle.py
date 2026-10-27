"""Independent oracle for exponential growth, geometric sequences and series, and logarithms.

Answers are derived from the public prompt, figure and option labels only:
numbers are re-read from the text, tables and graphs; logarithms are computed
exactly by prime factorization; option labels are parsed by this file's own
TeX evaluator and tested against the stated condition. Generated answers,
hints and explanations never enter `solve_exponential`.
"""
import math
import re
from fractions import Fraction

EXPONENTIAL = frozenset({
    'exponential-model-value', 'exponential-model-rule', 'linear-or-exponential', 'exponential-overtakes',
    'same-base-equation', 'exponential-log-solution', 'log-equation', 'geometric-series-sum',
    'log-rules-evaluate', 'log-expand', 'change-of-base', 'logarithm-value', 'log-exponential-form',
    'geometric-sequence-rule',
})
EXPONENTIAL_CHOICE = frozenset({
    'exponential-model-rule', 'linear-or-exponential', 'exponential-log-solution', 'log-expand', 'log-exponential-form',
})


def require(condition, message):
    if not condition:
        raise ValueError(message)


def clean(text):
    """Unicode minus to ASCII, and thousands separators out of numbers."""
    return re.sub(r'(?<=\d),(?=\d{3}\b)', '', text.replace('−', '-'))


def num(text):
    return Fraction(clean(text))


# ------------------------------------------------------------ exact logs
def factor(n):
    """Prime exponents of a positive integer."""
    out, p = {}, 2
    while p * p <= n:
        while n % p == 0:
            out[p] = out.get(p, 0) + 1
            n //= p
        p += 1
    if n > 1:
        out[n] = out.get(n, 0) + 1
    return out


def exponents(value):
    value = Fraction(value)
    require(value > 0, 'Logarithm of a non-positive number')
    out = dict(factor(value.numerator))
    for p, e in factor(value.denominator).items():
        out[p] = out.get(p, 0) - e
    return {p: e for p, e in out.items() if e}


def exact_log(base, value):
    """log_base(value) as a Fraction when value is a rational power of base."""
    b, v = exponents(base), exponents(value)
    require(b, 'Base 1')
    if not v:
        return Fraction(0)
    require(set(b) == set(v), f'{value} is not a power of {base}')
    ratios = {Fraction(v[p], b[p]) for p in b}
    require(len(ratios) == 1, f'{value} is not a power of {base}')
    return ratios.pop()


# ------------------------------------------------------------ TeX evaluator
TOKEN = re.compile(r'\s*(\\left|\\right|\\cdot|\\dfrac|\\frac|\\sqrt|\\log|\\ln|\\times|\d+\.\d+|\d+|[a-z]|[{}()\[\]^_+\-=*])')


def tokenize(text):
    text = clean(text).strip().strip('$').strip()
    text = text.replace('\\left', '').replace('\\right', '').replace('\\,', '').replace('\\big', '').replace('\\Big', '')
    tokens, i = [], 0
    while i < len(text):
        m = TOKEN.match(text, i)
        require(m is not None, f'Cannot read {text[i:]!r} in {text!r}')
        tokens.append(m.group(1))
        i = m.end()
    return tokens


class Expr:
    """Recursive-descent reader for the TeX subset used in this family's labels."""

    def __init__(self, text, env):
        self.t, self.i, self.env = tokenize(text), 0, env

    def peek(self):
        return self.t[self.i] if self.i < len(self.t) else None

    def take(self, expected=None):
        token = self.peek()
        require(token is not None and (expected is None or token == expected), f'Expected {expected} at {self.t[self.i:]}')
        self.i += 1
        return token

    def done(self):
        return self.i == len(self.t)

    def expr(self):
        value = self.term()
        while self.peek() in ('+', '-'):
            value = value + self.term() if self.take() == '+' else value - self.term()
        return value

    def starts_factor(self, token):
        return token is not None and (token in ('(', '{', '\\frac', '\\dfrac', '\\sqrt', '\\log', '\\ln') or token.isalpha() or token[0].isdigit())

    def term(self):
        value = self.unary()
        while True:
            if self.peek() in ('\\cdot', '\\times', '*'):
                self.take()
                value *= self.unary()
            elif self.starts_factor(self.peek()):
                value *= self.unary()
            else:
                return value

    def unary(self):
        if self.peek() == '-':
            self.take()
            return -self.unary()
        return self.power()

    def power(self):
        value = self.atom()
        if self.peek() == '^':
            self.take()
            value = value ** self.group()
        return value

    def group(self):
        if self.peek() == '{':
            self.take('{')
            value = self.expr()
            self.take('}')
            return value
        return self.atom()

    def atom(self):
        token = self.take()
        if token[0].isdigit():
            return float(token)
        if token == 'e':
            return math.e
        if token.isalpha():
            require(token in self.env, f'Unknown variable {token}')
            return self.env[token]
        if token == '(':
            value = self.expr()
            self.take(')')
            return value
        if token == '{':
            value = self.expr()
            self.take('}')
            return value
        if token in ('\\frac', '\\dfrac'):
            top = self.group()
            return top / self.group()
        if token == '\\sqrt':
            index = 2.0
            if self.peek() == '[':
                self.take('[')
                index = self.expr()
                self.take(']')
            return self.group() ** (1 / index)
        if token in ('\\log', '\\ln'):
            base = math.e if token == '\\ln' else 10.0
            if token == '\\log' and self.peek() == '_':
                self.take('_')
                base = self.group()
            argument = self.power()
            require(argument > 0 and base > 0 and base != 1, 'Undefined logarithm')
            return math.log(argument) / math.log(base)
        raise ValueError(f'Unexpected token {token}')


def evaluate(text, **env):
    reader = Expr(text, env)
    value = reader.expr()
    require(reader.done(), f'Trailing input in {text!r}')
    return value


def sides(label):
    body = clean(label).strip().strip('$')
    require(body.count('=') == 1, f'Not an equation: {label}')
    left, right = body.split('=')
    return left.strip(), right.strip()


def close(a, b):
    return math.isclose(a, b, rel_tol=1e-9, abs_tol=1e-9)


def only(options, test, what):
    hits = [o['id'] for o in options if test(o['label'])]
    require(len(hits) == 1, f'{what}: {len(hits)} options qualify')
    return hits[0]


# ------------------------------------------------------------ figure readers
def scene_elements(public):
    figure = public.get('figure')
    require(figure and figure.get('kind') == 'scene', 'A scene figure is required')
    return figure['scene']['elements']


def table_rows(public):
    tables = [e for e in scene_elements(public) if e['type'] == 'table']
    require(len(tables) == 1, 'One table')
    # Each row is its input label followed by its output cells.
    return [[Fraction(clean(row['label']))] + [Fraction(c) for c in row['cells']] for row in tables[0]['rows']]


def classify(values):
    diffs = {b - a for a, b in zip(values, values[1:])}
    if len(diffs) == 1:
        return 'linear'
    if all(v != 0 for v in values) and len({b / a for a, b in zip(values, values[1:])}) == 1:
        return 'exponential'
    return 'neither'


# ------------------------------------------------------------ solvers
def model_value(prompt, public):
    if prompt.startswith('The table shows an exponential function. If the pattern'):
        rows = table_rows(public)
        xs, ys = [r[0] for r in rows], [r[1] for r in rows]
        require(classify(ys) == 'exponential' and all(b - a == 1 for a, b in zip(xs, xs[1:])), 'Exponential table in unit steps')
        ratio = ys[1] / ys[0]
        target = int(re.search(r'when \$x = (\d+)\$', prompt)[1])
        return ys[0] * ratio ** int(target - xs[0])
    if 'Round to the nearest cent' in prompt:
        # A percent change over whole years, valued exactly and rounded half up to cents.
        text = clean(prompt)
        m = re.search(r'(?:holds|is worth) (\d+) dollars and (earns|loses) (\d+)% .*?after (\d+) years', text)
        require(m is not None, f'Unknown rounded model prompt: {prompt}')
        start, pct, years = int(m[1]), Fraction(int(m[3]), 100), int(m[4])
        value = start * (1 + (pct if m[2] == 'earns' else -pct)) ** years
        cents = value * 100
        require(cents.denominator != 2, 'No half-cent ties')
        return Fraction(int(cents + Fraction(1, 2)) if cents >= 0 else 0, 100)
    m = re.search(r'(?:has|holds) (\d+) (?:residents|dollars).*?(\d+)% .*?after (\d+) years', clean(prompt))
    if m:
        start, pct, years = int(m[1]), Fraction(int(m[2]), 100), int(m[3])
        value = start * (1 + pct) ** years
        require(value.denominator == 1, 'Whole result')
        return value
    m = re.search(r'takes a (\d+) mg dose.*halves every (\d+) hours.*after (\d+) hours', prompt)
    if m:
        dose, half, hours = int(m[1]), int(m[2]), int(m[3])
        require(hours % half == 0, 'Whole number of halvings')
        return Fraction(dose, 2 ** (hours // half))
    m = re.search(r'f\(t\) = (\d+) \\cdot (.+?)\^\{t\}\$, what is \$f\((\d+)\)', prompt)
    require(m is not None, f'Unknown model prompt: {prompt}')
    base = m[2]
    frac = re.fullmatch(r'\\left\(\\frac\{(\d+)\}\{(\d+)\}\\right\)', base)
    b = Fraction(int(frac[1]), int(frac[2])) if frac else Fraction(int(base))
    return int(m[1]) * b ** int(m[3])


def model_points(prompt, public):
    if prompt.startswith('The table shows'):
        return [(r[0], r[1]) for r in table_rows(public)]
    if prompt.startswith('The graph shows'):
        graphs = [e for e in scene_elements(public) if e['type'] == 'graph']
        return [(Fraction(p['x']), Fraction(p['y'])) for p in graphs[0]['points']]
    m = re.search(r'starts with (\d+) thousand cells and (doubles|triples|quadruples) every hour', prompt)
    if m:
        a, b = int(m[1]), {'doubles': 2, 'triples': 3, 'quadruples': 4}[m[2]]
        return [(Fraction(x), Fraction(a * b ** x)) for x in range(5)]
    m = re.search(r'worth (\d+) dollars and loses (\d+)% of its value each year', clean(prompt))
    require(m is not None, f'Unknown rule prompt: {prompt}')
    value, keep = int(m[1]), 1 - Fraction(int(m[2]), 100)
    return [(Fraction(x), value * keep ** x) for x in range(5)]


def model_rule(prompt, public):
    points = model_points(prompt, public)
    require(len(points) >= 3, 'Enough points to decide')

    def fits(label):
        left, right = sides(label)
        require(left == 'y', 'y = …')
        return all(close(evaluate(right, x=float(x)), float(y)) for x, y in points)
    return only(public['response']['options'], fits, 'Equation through every point')


def story_values(prompt):
    """Five periods of the story's quantity, simulated from its own words."""
    p = clean(prompt)
    start = re.search(r'(?:is|holds) (\d+) (?:cm|dollars)', p)
    require(start is not None, f'Unknown story: {prompt}')
    v = Fraction(int(start[1]))
    m = re.search(r'grows (\d+) cm each week|and (\d+) dollars are added each month', p)
    if m:
        step = int(m[1] or m[2])
        return [v + step * i for i in range(5)]
    m = re.search(r'grows by (\d+)% each week|earns (\d+)% interest each month', p)
    if m:
        f = 1 + Fraction(int(m[1] or m[2]), 100)
        return [v * f ** i for i in range(5)]
    m = re.search(r'grows 1 cm in the first week,? 2 cm in the second|Each month,? (\d+) dollars more are added than the month before', p)
    require(m is not None, f'Unknown story: {prompt}')
    step = int(m[1]) if m[1] else 1
    out = [v]
    for i in range(1, 5):
        out.append(out[-1] + step * i)
    return out


def linear_or_exponential(prompt, public):
    if prompt.startswith('Which kind of function does the table show?'):
        rows = table_rows(public)
        xs = [r[0] for r in rows]
        require(len({b - a for a, b in zip(xs, xs[1:])}) == 1, 'Equal x-steps')
        kind = classify([r[1] for r in rows])
    else:
        kind = classify(story_values(prompt))
    return only(public['response']['options'], lambda label: label.lower().startswith(kind), 'Kind of change')


def first_exceed(m, c, b):
    require(b ** 0 <= c, 'The line starts at or above the exponential')
    x = 0
    while b ** x <= m * x + c:
        x += 1
        require(x < 100, 'No crossing')
    return x


def overtakes(prompt, public):
    m = re.search(r'f\(x\) = (\d+)x \+ (\d+)\$ and \$g\(x\) = (\d+)\^\{x\}', prompt)
    if m:
        return first_exceed(int(m[1]), int(m[2]), int(m[3]))
    m = re.search(r'Offer A starts with (\d+) coins and adds (\d+) coins each day\. Offer B starts with 1 coin and doubles', prompt)
    if m:
        return first_exceed(int(m[2]), int(m[1]), 2)
    rows = table_rows(public)
    f, g = [r[1] for r in rows], [r[2] for r in rows]
    require(classify(f) == 'linear' and classify(g) == 'exponential' and g[0] == 1, 'Linear f, exponential g from 1')
    return first_exceed(f[1] - f[0], f[0], g[1] / g[0])


def linear(text):
    """a·x + b from 'x + 1', '3x - 2', 'x', '1'."""
    text = clean(text).replace(' ', '')
    m = re.fullmatch(r'(\d*)x([+-]\d+)?|([+-]?\d+)', text)
    require(m is not None, f'Not linear: {text}')
    if m[3]:
        return Fraction(0), Fraction(int(m[3]))
    return Fraction(int(m[1]) if m[1] else 1), Fraction(int(m[2]) if m[2] else 0)


def power_side(text):
    """(base, exponent as linear) from '8^{x+1}', '32', '\\frac{1}{27}', '3^{2x - 1}'."""
    text = clean(text).strip()
    m = re.fullmatch(r'(\d+)\^\{(.+)\}', text)
    if m:
        return Fraction(int(m[1])), linear(m[2])
    m = re.fullmatch(r'\\frac\{1\}\{(\d+)\}', text)
    if m:
        return Fraction(1, int(m[1])), (Fraction(0), Fraction(1))
    return Fraction(int(text)), (Fraction(0), Fraction(1))


def same_base(prompt):
    m = re.fullmatch(r'Solve \$(.+) = (.+)\$\.', prompt)
    require(m is not None, f'Unknown equation: {prompt}')
    (b1, (a1, c1)), (b2, (a2, c2)) = power_side(m[1]), power_side(m[2])
    # Natural-log free: write both bases over one prime by exact logarithms.
    prime = min(exponents(b1) or exponents(b2))
    e1, e2 = exact_log(prime, b1), exact_log(prime, b2)
    # e1(a1 x + c1) = e2(a2 x + c2)
    slope = e1 * a1 - e2 * a2
    require(slope != 0, 'One solution')
    return (e2 * c2 - e1 * c1) / slope


def log_solution(prompt, public):
    options = public['response']['options']
    m = re.search(r'solution of \$(\d+) \\cdot (\d+)\^\{x\} = (\d+)\$', prompt)
    if m:
        a, b, c = map(int, m.groups())
        return only(options, lambda l: close(a * b ** evaluate(sides(l)[1]), c), 'Solution')
    m = re.search(r'solution of \$(\d+)\^\{x \+ (\d+)\} = (\d+)\$', prompt)
    if m:
        b, h, k = map(int, m.groups())

        def ok(label):
            try:
                return close(b ** (evaluate(sides(label)[1]) + h), k)
            except ValueError:
                return False
        return only(options, ok, 'Solution')
    m = re.search(r'solution of \$e\^\{(\d+)t\} = (\d+)\$', prompt)
    if m:
        r, k = map(int, m.groups())
        return only(options, lambda l: close(math.exp(r * evaluate(sides(l)[1])), k), 'Solution')
    m = re.search(r'becomes \$B \\cdot (\d+\.\d+)\^\{t\}\$', prompt)
    require(m is not None and 'double' in prompt, f'Unknown log-solution prompt: {prompt}')
    f = float(m[1])
    return only(options, lambda l: close(f ** evaluate(l), 2), 'Doubling time')


def log_equation(prompt):
    p = clean(prompt)
    m = re.fullmatch(r'Solve \$\\log(?:_\{(\d+)\})?\(x ([+-]) (\d+)\) = (\d+)\$\.', p)
    if m:
        b, c, n = int(m[1] or 10), int(m[3]) * (1 if m[2] == '+' else -1), int(m[4])
        x = Fraction(b ** n - c)
        require(x + c > 0, 'Domain')
        return x
    m = re.fullmatch(r'Solve \$\\log(?:_\{(\d+)\})? x ([+-]) \\log(?:_\{(\d+)\})?\(x ([+-]) (\d+)\) = (\d+)\$\.', p)
    require(m is not None and m[1] == m[3], f'Unknown log equation: {prompt}')
    b, n, d = int(m[1] or 10), int(m[6]), int(m[5])
    if m[2] == '+':
        require(m[4] == '+', 'Sum of logs of x and x + d')
        # x(x + d) = b^n: roots of x^2 + d x - b^n.
        disc = d * d + 4 * b ** n
        root = math.isqrt(disc)
        require(root * root == disc, 'Rational roots')
        roots = [Fraction(-d + root, 2), Fraction(-d - root, 2)]
        valid = [x for x in roots if x > 0 and x + d > 0]
    else:
        require(m[4] == '-', 'Difference of logs of x and x - d')
        x = Fraction(b ** n * d, b ** n - 1)
        valid = [x] if x > 0 and x - d > 0 else []
    require(len(valid) == 1, 'Exactly one solution in the domain')
    return valid[0]


def series(prompt, public):
    p = clean(prompt)
    m = re.search(r'Find the sum \$(\d+) \+ (\d+) \+ (\d+) \+ \\cdots \+ (\d+)\$', p)
    if m:
        a, b, c, last = (Fraction(int(v)) for v in m.groups())
        r = b / a
        require(c == b * r and r > 1, 'Geometric list')
        total, term = Fraction(0), a
        while term <= last:
            total += term
            if term == last:
                return total
            term *= r
        raise ValueError('Last term is not a term')
    m = re.search(r'\\sum_\{k=1\}\^\{(\d+)\} (?:(\d+) \\cdot )?(\d+)\^\{k-1\}', p)
    if m:
        n, a, r = int(m[1]), int(m[2] or 1), int(m[3])
        return Fraction(sum(a * r ** (k - 1) for k in range(1, n + 1)))
    m = re.search(r'first term (\d+) and common ratio \$(.+?)\$\. What is the sum of its first (\d+) terms', p)
    if m:
        a, n = Fraction(int(m[1])), int(m[3])
        frac = re.fullmatch(r'\\frac\{(\d+)\}\{(\d+)\}', m[2])
        r = Fraction(int(frac[1]), int(frac[2])) if frac else Fraction(int(m[2]))
        return sum(a * r ** k for k in range(n))
    m = re.search(r'On day 1, (\d+) coins? go(?:es)? in\. Each day after that, (\d+) times as many coins go in as the day before\..*after day (\d+)\?', p)
    require(m is not None, f'Unknown series prompt: {prompt}')
    a, r, n = int(m[1]), int(m[2]), int(m[3])
    deposits = [a * r ** k for k in range(n)]
    shown = [e for e in scene_elements(public) if e['type'] == 'bars'][0]['series'][0]['values']
    require([Fraction(v) for v in shown] == deposits, 'Bars match the story')
    return Fraction(sum(deposits))


LOG_TERM = re.compile(r'([+-]?)\s*(\d*)\\log(?:_\{(\d+)\})? (\d+)')


def log_rules(prompt):
    m = re.fullmatch(r'What is \$(.+)\$\?', prompt)
    require(m is not None, f'Unknown log-rules prompt: {prompt}')
    terms = LOG_TERM.findall(clean(m[1]))
    require(terms and ''.join(LOG_TERM.sub('', clean(m[1])).split()) == '', 'Only log terms')
    bases = {int(t[2] or 10) for t in terms}
    require(len(bases) == 1, 'One base')
    product = Fraction(1)
    for sign, coef, _, arg in terms:
        k = int(coef or 1) * (-1 if sign == '-' else 1)
        product *= Fraction(int(arg)) ** k
    return exact_log(bases.pop(), product)


def log_expand(prompt, public):
    m = re.search(r'(?:equivalent to|equals) \$(.+?)\$ for positive', prompt)
    require(m is not None, f'Unknown log-expand prompt: {prompt}')
    samples = [dict(x=1.7, y=2.9, z=0.6), dict(x=3.3, y=0.45, z=5.2), dict(x=0.8, y=7.1, z=2.4)]
    target = [evaluate(m[1], **env) for env in samples]

    def same(label):
        try:
            return all(close(evaluate(label, **env), t) for env, t in zip(samples, target))
        except (ValueError, ZeroDivisionError):
            return False
    return only(public['response']['options'], same, 'Equivalent expression')


def log_arg(text):
    text = clean(text).strip()
    m = re.fullmatch(r'\\frac\{(\d+)\}\{(\d+)\}', text)
    if m:
        return Fraction(int(m[1]), int(m[2]))
    m = re.fullmatch(r'\\sqrt(?:\[(\d+)\])?\{(\d+)\}', text)
    if m:
        return ('root', int(m[1] or 2), Fraction(int(m[2])))
    return Fraction(text)


def change_of_base(prompt):
    p = clean(prompt)
    m = re.fullmatch(r'What is \$\\log_\{(\d+)\} (\d+) \\cdot \\log_\{(\d+)\} (\d+)\$\?', p)
    if m:
        a, c, c2, n = map(int, m.groups())
        require(c == c2, 'Chained bases')
        return exact_log(a, n)
    m = re.fullmatch(r'What is \$\\log_\{(\d+)\} (.+)\$\?', p)
    if m:
        return exact_log(int(m[1]), log_arg(m[2]))
    m = re.fullmatch(r'If \$\\log_\{(\d+)\} x = (\d+)\$, what is \$\\log_\{(\d+)\} x\$\?', p)
    if m:
        b, value, new = map(int, m.groups())
        return Fraction(value) / exact_log(b, new)
    m = re.fullmatch(r'What is \$\\frac\{\\log (\d+)\}\{\\log (\d+)\}\$\?', p)
    require(m is not None, f'Unknown change-of-base prompt: {prompt}')
    return exact_log(int(m[2]), int(m[1]))


def log_value(prompt):
    p = clean(prompt)
    m = re.fullmatch(r'What is \$\\log(?:_\{(\d+)\})? (.+)\$\?', p)
    if m:
        base, arg = int(m[1] or 10), log_arg(m[2])
        if isinstance(arg, tuple):
            return exact_log(base, arg[2]) / arg[1]
        return exact_log(base, arg)
    m = re.search(r'graph shows \$y = \\log_\{(\d+)\} x\$\. What is \$y\$ where the dashed line \$x = (\d+)\$', p)
    require(m is not None, f'Unknown log-value prompt: {prompt}')
    return exact_log(int(m[1]), int(m[2]))


def log_form(prompt, public):
    options = public['response']['options']
    p = clean(prompt)
    m = re.search(r'same as \$\\log(?:_\{(\d+)\})? (\d+) = (\d+)\$', p)
    if m:
        b, n, e = int(m[1] or 10), int(m[2]), int(m[3])

        def same(label):
            left, right = sides(label)
            power = re.fullmatch(r'(\d+)\^\{(\d+)\}', left)
            return power is not None and (int(power[1]), int(power[2]), int(right)) == (b, e, n)
        return only(options, same, 'Power form')
    m = re.search(r'same as \$(\d+)\^\{(\d+)\} = (\d+)\$', p)
    if m:
        b, e, n = map(int, m.groups())

        def same(label):
            left, right = sides(label)
            log = re.fullmatch(r'\\log(?:_\{(\d+)\})? (\d+)', left)
            return log is not None and (int(log[1] or 10), int(log[2]), int(right)) == (b, n, e)
        return only(options, same, 'Logarithmic form')
    m = re.search(r'Between which two consecutive whole numbers is \$\\log(?:_\{(\d+)\})? (\d+)\$', p)
    require(m is not None, f'Unknown log-form prompt: {prompt}')
    b, n = int(m[1] or 10), int(m[2])
    k = 0
    while b ** (k + 1) <= n:
        k += 1
    require(b ** k < n < b ** (k + 1), 'Strictly between powers')
    return only(options, lambda l: l == f'{k} and {k + 1}', 'Bracketing whole numbers')


def exact_root(value, n):
    """The real n-th root of a rational when it is rational."""
    sign = -1 if value < 0 else 1
    require(sign > 0 or n % 2 == 1, 'Even root of a negative')
    roots = []
    for part in (abs(value.numerator), value.denominator):
        r = round(part ** (1 / n))
        r = next((c for c in (r - 1, r, r + 1) if c >= 0 and c ** n == part), None)
        require(r is not None, 'Not a perfect power')
        roots.append(r)
    return sign * Fraction(roots[0], roots[1])


def sequence_rule(prompt, public):
    p = clean(prompt)
    if p.startswith('The table shows the first four terms'):
        terms = [r[1] for r in table_rows(public)]
        ratios = {b / a for a, b in zip(terms, terms[1:])}
        require(len(ratios) == 1, 'Constant ratio')
        return ratios.pop()
    m = re.search(r'The numbers (\d+), \?, (\d+) are consecutive terms of a geometric sequence with positive terms', p)
    if m:
        a, c = Fraction(int(m[1])), Fraction(int(m[2]))
        return a * exact_root(c / a, 2)
    m = re.search(r'\$a_1 = (\d+)\$ and \$a_n = (-?\d+(?:\.\d+)?)a_\{n-1\}\$.*What is \$a_\{(\d+)\}\$', p)
    if m:
        a, r, k = int(m[1]), Fraction(m[2]), int(m[3])
        term = Fraction(a)
        for _ in range(k - 1):
            term *= r
        return term
    m = re.search(r'\$a_2 = (-?\d+)\$ and \$a_5 = (-?\d+)\$\. What is \$a_1\$', p)
    require(m is not None, f'Unknown sequence prompt: {prompt}')
    second, fifth = Fraction(int(m[1])), Fraction(int(m[2]))
    r = exact_root(fifth / second, 3)
    return second / r


def solve_exponential(public):
    template, prompt = public['templateId'], public['prompt']
    if template == 'exponential-model-value':
        return model_value(prompt, public)
    if template == 'exponential-model-rule':
        return model_rule(prompt, public)
    if template == 'linear-or-exponential':
        return linear_or_exponential(prompt, public)
    if template == 'exponential-overtakes':
        return Fraction(overtakes(prompt, public))
    if template == 'same-base-equation':
        return same_base(prompt)
    if template == 'exponential-log-solution':
        return log_solution(prompt, public)
    if template == 'log-equation':
        return log_equation(prompt)
    if template == 'geometric-series-sum':
        return series(prompt, public)
    if template == 'log-rules-evaluate':
        return log_rules(prompt)
    if template == 'log-expand':
        return log_expand(prompt, public)
    if template == 'change-of-base':
        return change_of_base(prompt)
    if template == 'logarithm-value':
        return log_value(prompt)
    if template == 'log-exponential-form':
        return log_form(prompt, public)
    if template == 'geometric-sequence-rule':
        return sequence_rule(prompt, public)
    raise ValueError(f'Unknown exponential template {template}')


def review_exponential_fixtures():
    """Hand-checked cases for the readers, independent of any generator."""
    require(exact_log(8, 32) == Fraction(5, 3), 'log_8 32')
    require(exact_log(10, Fraction(1, 1000)) == -3, 'log 0.001')
    require(exact_log(4, Fraction(1, 8)) == Fraction(-3, 2), 'log_4 1/8')
    require(close(evaluate('\\frac{1}{2}\\log_{3} x + \\frac{5}{2}\\log_{3} y', x=9.0, y=3.0), 3.5), 'TeX reader')
    require(close(evaluate('3 \\cdot 2^{x}', x=3.0), 24), 'Power reader')
    require(same_base('Solve $4^{x + 1} = 8^{x}$.') == 2, '4^(x+1) = 8^x')
    require(same_base('Solve $3^{2x - 1} = \\frac{1}{27}$.') == -1, '3^(2x-1) = 1/27')
    require(log_equation('Solve $\\log_{2} x + \\log_{2}(x + 7) = 3$.') == 1, 'reject -8')
    require(log_equation('Solve $\\log_{3} x - \\log_{3}(x - 4) = 1$.') == 6, 'quotient log')
    require(log_rules('What is $\\log_{6} 4 + \\log_{6} 9$?') == 2, 'product rule')
    require(log_rules('What is $2\\log_{3} 6 - \\log_{3} 4$?') == 2, 'power rule')
    require(model_value('A savings account holds 1,700 dollars and earns 4% interest, added to the balance at the end of each year. With no withdrawals, how many dollars will it hold after 3 years? Round to the nearest cent.', None) == Fraction(191227, 100), 'rounded growth')
    require(model_value('A delivery van is worth 6,000 dollars and loses 18% of its value each year. How many dollars is it worth after 12 years? Round to the nearest cent.', None) == Fraction(55452, 100), 'rounded decay')
    require(sequence_rule('A sequence has $a_1 = 64$ and $a_n = -2.5a_{n-1}$ for $n \\ge 2$. What is $a_{5}$?', None) == 2500, 'decimal ratio')
    require(series('Find the sum $3 + 6 + 12 + \\cdots + 96$.', None) == 189, 'series')
    require(first_exceed(10, 10, 2) == 7, 'overtake')
    require(classify([Fraction(v) for v in (1, 4, 9, 16)]) == 'neither', 'squares')
    return {'fixtures': 12}
