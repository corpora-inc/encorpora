"""Independent SAT algebra-structure oracle using only public prompts and choices.

Exact Fractions throughout.  No seed, generator case model, answer key, or
TypeScript helper is used; every answer is re-derived from the displayed wording.
"""
import copy
import re
from fractions import Fraction as Q

SUPPORTED = frozenset({
    'quadratic-root-relations', 'system-expression-value', 'variation-constant',
    'rate-combination-model', 'absolute-compound-inequality', 'quadratic-from-data',
})
CHOICE = SUPPORTED


def require(ok, message):
    if not ok:
        raise ValueError(message)


def plain(s):
    return (s.replace('\\left', '').replace('\\right', '').replace('−', '-')
            .replace('\\le', '<=').replace('\\ge', '>=').replace('\\cdot', '*'))


# ---------------------------------------------------------------- expressions
def tokenize(s):
    s = plain(s).replace('\\%', '').replace('\\,', '')
    out, i = [], 0
    while i < len(s):
        ch = s[i]
        if ch.isspace():
            i += 1
        elif ch.isdigit():
            m = re.match(r'\d+(?:\.\d+)?', s[i:])
            out.append(('num', Q(m[0])))
            i += len(m[0])
        elif s.startswith('\\frac', i):
            out.append(('frac', None))
            i += 5
        elif ch.isalpha():
            out.append(('var', ch))
            i += 1
        elif ch in '+-*/^(){}':
            out.append((ch, None))
            i += 1
        else:
            raise ValueError(f'Unexpected character {ch!r} in {s!r}')
    return out


class Parser:
    def __init__(self, text, env):
        self.t, self.i, self.env = tokenize(text), 0, env

    def peek(self):
        return self.t[self.i][0] if self.i < len(self.t) else None

    def take(self, kind=None):
        require(self.i < len(self.t), 'Unexpected end of expression')
        tok = self.t[self.i]
        require(kind is None or tok[0] == kind, f'Expected {kind}, found {tok[0]}')
        self.i += 1
        return tok

    def expr(self):
        total = self.term()
        while self.peek() in ('+', '-'):
            sign = self.take()[0]
            rhs = self.term()
            total = total + rhs if sign == '+' else total - rhs
        return total

    def term(self):
        sign = 1
        while self.peek() in ('+', '-'):
            if self.take()[0] == '-':
                sign = -sign
        value = self.power()
        while True:
            kind = self.peek()
            if kind in ('num', 'var', '(', 'frac'):
                require(kind != 'num', 'Number cannot follow a factor implicitly')
                value *= self.power()
            elif kind == '*':
                self.take()
                value *= self.power()
            elif kind == '/':
                self.take()
                divisor = self.power()
                require(divisor != 0, 'Division by zero')
                value /= divisor
            else:
                return sign * value

    def power(self):
        base = self.primary()
        if self.peek() == '^':
            self.take()
            braced = self.peek() == '{'
            if braced:
                self.take()
            exponent = self.take('num')[1]
            if braced:
                self.take('}')
            require(exponent.denominator == 1, 'Integer exponent required')
            return base ** int(exponent)
        return base

    def primary(self):
        kind = self.peek()
        if kind == 'num':
            return self.take()[1]
        if kind == 'var':
            name = self.take()[1]
            require(name in self.env, f'Unknown variable {name}')
            return Q(self.env[name])
        if kind == '(':
            self.take()
            value = self.expr()
            self.take(')')
            return value
        if kind == 'frac':
            self.take()
            self.take('{')
            a = self.expr()
            self.take('}')
            self.take('{')
            b = self.expr()
            self.take('}')
            require(b != 0, 'Zero denominator')
            return a / b
        raise ValueError(f'Unexpected token {kind}')


def ev(text, **env):
    p = Parser(text, env)
    value = p.expr()
    require(p.i == len(p.t), f'Trailing tokens in {text!r}')
    return value


def maths(text):
    return re.findall(r'\$([^$]+)\$', text)


def label_value(label):
    """Numeric value of a label such as $-\\frac{3}{2}$, $26\\%$ or $10$ hours."""
    segs = maths(label)
    require(len(segs) == 1, f'One math segment expected in {label!r}')
    return ev(segs[0])


def choice_ids(public, expect=4):
    response = public['response']
    require(response['kind'] == 'choice', 'Choice response required')
    options = response['options']
    require(len(options) == expect and all(set(o) == {'id', 'label'} for o in options), 'Four public choices required')
    require(len({o['id'] for o in options}) == expect, 'Duplicate choice IDs')
    return options


def pick_numeric(public, expected):
    options = choice_ids(public)
    values = [label_value(o['label']) for o in options]
    require(len(set(values)) == len(values), 'Mathematically duplicate choices')
    hits = [o['id'] for o, v in zip(options, values) if v == expected]
    require(len(hits) == 1, f'Expected {expected} matches {len(hits)} choices')
    return hits[0]


def fraction_text(s):
    return s


# ------------------------------------------------------ quadratic-root-relations
def quad_coeffs(poly):
    f = lambda x, k=0: ev(poly, x=x, k=k)
    c = f(0)
    a = (f(1) + f(-1)) / 2 - c
    b = (f(1) - f(-1)) / 2
    require(f(2) == 4 * a + 2 * b + c and f(3) == 9 * a + 3 * b + c, 'Not a quadratic polynomial')
    return a, b, c


def solve_root_relations(public):
    prompt = plain(public['prompt'])
    segs = maths(prompt)
    poly = segs[0].split('=')[0]
    require(segs[0].split('=')[1].strip() == '0', 'Equation must equal zero')
    stats = {}
    m = re.fullmatch(r'One solution of \$[^$]+\$ is \$x=(-?\d+)\$\. What is the value of \$k\$\?', prompt)
    if m:
        r = Q(m[1])
        f0, f1 = ev(poly, x=r, k=0), ev(poly, x=r, k=1)
        require(f1 != f0, 'k must appear in the equation')
        return pick_numeric(public, -f0 / (f1 - f0))
    a, b, c = quad_coeffs(poly)
    require(a != 0, 'Leading coefficient must be nonzero')
    disc = b * b - 4 * a * c
    m = re.fullmatch(r'One solution of \$[^$]+\$ is \$x=(-?\d+)\$\. What is the other solution\?', prompt)
    if m:
        r = Q(m[1])
        require(a * r * r + b * r + c == 0, 'Stated solution is not a solution')
        return pick_numeric(public, -b / a - r)
    require('real' in prompt and disc >= 0, 'Real solutions must exist (discriminant >= 0)')
    total, prod = -b / a, c / a
    if re.fullmatch(r'Without solving, find the sum of the two real solutions of \$[^$]+\$\.', prompt):
        return pick_numeric(public, total)
    if re.fullmatch(r'Without solving, find the product of the two real solutions of \$[^$]+\$\.', prompt):
        return pick_numeric(public, prod)
    m = re.fullmatch(r'The real solutions of \$[^$]+\$ are \$p\$ and \$q\$\. What is the value of \$(.+)\$\?', prompt)
    require(m is not None, 'Unrecognized root-relation wording: ' + prompt)
    target = m[1].replace(' ', '')
    if target == r'\frac{1}{p}+\frac{1}{q}':
        require(c != 0, 'Zero is a root; reciprocal sum undefined')
        return pick_numeric(public, total / prod)
    if target == 'p^2+q^2':
        return pick_numeric(public, total * total - 2 * prod)
    raise ValueError('Unrecognized root expression ' + target)


# ------------------------------------------------------ system-expression-value
def linear2(text):
    f = lambda x, y: ev(text, x=x, y=y)
    c = f(0, 0)
    require(c == 0, 'Linear form must have no constant term')
    a, b = f(1, 0), f(0, 1)
    require(f(2, 3) == 2 * a + 3 * b, 'Not a linear form in x and y')
    return a, b


def solve_system_expression(public):
    prompt = plain(public['prompt'])
    segs = maths(prompt)
    require(len(segs) >= 2 and re.fullmatch(r'If .*, what is the value of \$[^$]+\$\?', prompt), 'Unrecognized system wording')
    eqs = []
    for seg in segs[:-1]:
        lhs, rhs = seg.split('=')
        eqs.append((*linear2(lhs), ev(rhs)))
    ta, tb = linear2(segs[-1])
    require(1 <= len(eqs) <= 2, 'One or two equations expected')
    # The target is determined iff it is a combination of the given equations
    # (or the system pins down x and y); an inconsistent system is rejected.
    n = len(eqs)
    value = None
    if n == 1:
        a, b, c = eqs[0]
        m1 = ta / a if a != 0 else tb / b
        if m1 * a == ta and m1 * b == tb:
            value = m1 * c
    else:
        (a1, b1, c1), (a2, b2, c2) = eqs
        det = a1 * b2 - a2 * b1
        if det != 0:
            value = ta * (c1 * b2 - c2 * b1) / det + tb * (a1 * c2 - a2 * c1) / det
        else:
            require((a1, b1) != (0, 0), 'Degenerate first equation')
            lam = (a2 / a1) if a1 != 0 else (b2 / b1)
            require(lam * a1 == a2 and lam * b1 == b2, 'Rows are not parallel')
            require(lam * c1 == c2, 'Inconsistent system (no solution)')
            m1 = ta / a1 if a1 != 0 else tb / b1
            if m1 * a1 == ta and m1 * b1 == tb:
                value = m1 * c1
    options = choice_ids(public)
    sentinel = [o['id'] for o in options if o['label'] == 'The value cannot be determined']
    if value is None:
        require(len(sentinel) == 1, 'Expression is not determined by the system and no honest choice exists')
        return sentinel[0]
    values = []
    for o in options:
        values.append(None if o['id'] in sentinel else label_value(o['label']))
    numeric = [v for v in values if v is not None]
    require(len(set(numeric)) == len(numeric), 'Mathematically duplicate choices')
    hits = [o['id'] for o, v in zip(options, values) if v == value]
    require(len(hits) == 1, 'Expected value must match exactly one choice')
    return hits[0]


# ------------------------------------------------------------- variation-constant
def solve_variation(public):
    prompt = plain(public['prompt'])
    options = choice_ids(public)
    labels = [o['label'] for o in options]
    ids = [o['id'] for o in options]
    probe = [Q(1), Q(2), Q(3), Q(5), Q(7), Q(11)]

    def model_fn(kind, k):
        return (lambda x: k * x) if kind == 'direct' else (lambda x: k / x)

    def equation_fn(label):
        seg = maths(label)
        require(len(seg) == 1 and '=' in seg[0], 'Equation choice expected')
        lhs, rhs = seg[0].split('=')
        require(len(lhs.strip()) == 1, 'Dependent variable alone expected')
        free = sorted(set(re.findall(r'[A-Za-z]', rhs.replace('\\frac', ''))))
        require(len(free) == 1, 'One independent variable expected')
        return lambda v: ev(rhs, **{free[0]: v})

    if 'table' in prompt:
        require(prompt.startswith('The table shows three values of $y$ for three values of $x$. Which equation fits every row?'), 'Unrecognized table wording')
        table = re.search(r'x&(.+?)&(.+?)&(.+?)\\\\\\hline y&(.+?)&(.+?)&(.+?)\\end', prompt)
        require(table is not None, 'Table not readable')
        xs = [ev(table[i]) for i in (1, 2, 3)]
        ys = [ev(table[i]) for i in (4, 5, 6)]
        require(len(set(xs)) == 3 and all(x != 0 for x in xs), 'x values must be distinct and nonzero')
        direct = len({y / x for x, y in zip(xs, ys)}) == 1
        inverse = len({y * x for x, y in zip(xs, ys)}) == 1
        require(not (direct and inverse), 'Table cannot be both direct and inverse')
        fits = [i for i, label in enumerate(labels) if all(equation_fn(label)(x) == y for x, y in zip(xs, ys))]
        require(len(fits) == 1, f'Exactly one equation must fit every row; {len(fits)} do')
        funcs = [tuple(equation_fn(l)(p) for p in probe) for l in labels]
        require(len(set(funcs)) == 4, 'Mathematically duplicate equation choices')
        return ids[fits[0]]

    m = re.search(r'varies (directly|inversely) with', prompt)
    require(m is not None, 'Variation type must be stated')
    kind = 'direct' if m[1] == 'directly' else 'inverse'

    m = re.search(r'By what factor does \$y\$ change when \$x\$ changes from (-?\d+) to (-?\d+)\?', prompt)
    if m:
        x0, x1 = Q(m[1]), Q(m[2])
        require(x0 != 0 and x1 != 0 and x0 != x1, 'Distinct nonzero x values required')
        factor = x1 / x0 if kind == 'direct' else x0 / x1
        vals, hits = [], []
        for i, label in enumerate(labels):
            t = plain(maths(label)[0]) if maths(label) else ''
            mm = re.fullmatch(r'\$y\$ is multiplied by \$(.+)\$', label)
            if mm:
                v = ev(mm[1])
                vals.append(('mul', v))
                if v == factor:
                    hits.append(i)
            else:
                mm = re.fullmatch(r'\$y\$ (increases|decreases) by \$(.+)\$', label)
                require(mm is not None, 'Unrecognized factor choice ' + label)
                vals.append((mm[1], ev(mm[2])))
        require(len(set(vals)) == 4, 'Duplicate factor choices')
        require(len(hits) == 1, 'Exactly one multiplicative factor must match')
        return ids[hits[0]]

    pair = (re.search(r'When \$(\w)=(-?\d+)\$, \$(\w)=(-?\d+)\$\.', prompt)
            or re.search(r'The value of \$(\w)\$ is (-?\d+) when \$(\w)\$ is (-?\d+)\.', prompt)
            or re.search(r'\$(\w)=(\-?\d+)\$ when \$(\w)=(-?\d+)\$\.', prompt))
    require(pair is not None, 'Reference pair not found')
    if pair.re.pattern.startswith('When'):
        dep, dv, ind, iv = pair[1], Q(pair[4]), pair[3], Q(pair[2])
        dep, ind = pair[3], pair[1]
        dv, iv = Q(pair[4]), Q(pair[2])
    elif pair.re.pattern.startswith('The value'):
        dep, dv, ind, iv = pair[1], Q(pair[2]), pair[3], Q(pair[4])
    else:
        dep, dv, ind, iv = pair[1], Q(pair[2]), pair[3], Q(pair[4])
    require(iv != 0, 'Independent value cannot be zero')
    k = dv / iv if kind == 'direct' else dv * iv
    if 'constant of variation' in prompt:
        require(re.search(r'\$' + dep + r'=\\frac\{k\}\{' + ind + r'\}\$|\$' + dep + '=k' + ind + r'\$', prompt), 'Relationship form must be stated')
        return pick_numeric(public, k)
    m = re.search(r'What is \$(\w)\$ when \$(\w)=(-?\d+)\$\?', prompt)
    if m:
        require(m[1] == dep and m[2] == ind, 'Variable roles mismatch')
        new = Q(m[3])
        require(new != 0, 'New value must be nonzero')
        return pick_numeric(public, model_fn(kind, k)(new))
    if 'Which equation models the relationship?' in prompt:
        target = tuple(model_fn(kind, k)(p) for p in probe)
        funcs = [tuple(equation_fn(l)(p) for p in probe) for l in labels]
        require(len(set(funcs)) == 4, 'Mathematically duplicate equation choices')
        hits = [i for i, f in enumerate(funcs) if f == target]
        require(len(hits) == 1, 'Exactly one model equation expected')
        return ids[hits[0]]
    raise ValueError('Unrecognized variation wording: ' + prompt)


# ------------------------------------------------------- rate-combination-model
def solve_rate(public):
    prompt = plain(public['prompt'])
    n = r'(\d+)'
    m = re.fullmatch(rf'A driver goes {n} miles to a lake at an average speed of {n} miles per hour and returns the same {n} miles at {n} miles per hour\. What is the average speed for the whole round trip, in miles per hour\? Give the exact value\.', prompt)
    if m:
        d, a, d2, b = (Q(m[i]) for i in (1, 2, 3, 4))
        require(d == d2, 'Return distance must match')
        return pick_numeric(public, 2 * d / (d / a + d / b))
    m = re.fullmatch(rf'A lab mixes {n} liters? of a {n}% salt solution with {n} liters? of a {n}% salt solution\. What is the salt concentration of the mixture, as a percent\?', prompt)
    if m:
        v1, p1, v2, p2 = (Q(m[i]) for i in (1, 2, 3, 4))
        return pick_numeric(public, (v1 * p1 + v2 * p2) / (v1 + v2))
    m = re.fullmatch(rf'How many liters of a {n}% salt solution must be added to {n} liters? of a {n}% salt solution to make a mixture that is {n}% salt\?', prompt)
    if m:
        p_add, v, p0, target = (Q(m[i]) for i in (1, 2, 3, 4))
        require(min(p_add, p0) < target < max(p_add, p0), 'Target must lie strictly between the two strengths')
        # (v*p0 + x*p_add) = target*(v+x)
        x = v * (target - p0) / (p_add - target)
        require(x > 0, 'Added amount must be positive')
        return pick_numeric(public, x)
    m = re.fullmatch(rf'A pipe alone can fill an empty tank in {n} hours\. A drain alone can empty a full tank in {n} hours\. With the tank empty, both are opened and each works at its constant rate\. How long until the tank is full\? Give the exact time in hours\.', prompt)
    if m:
        a, b = Q(m[1]), Q(m[2])
        net = 1 / a - 1 / b
        require(net > 0, 'Tank would never fill')
        return pick_numeric(public, 1 / net)
    m = re.fullmatch(rf'Working alone, [^.]*? can [^.]*? in {n} hours and [^.]*? can do the same job in {n} hours\. Working together, each at the same constant rate as before, how long do they need\? Give the exact time in hours\.', prompt)
    if m:
        a, b = Q(m[1]), Q(m[2])
        return pick_numeric(public, 1 / (1 / a + 1 / b))
    m = re.fullmatch(rf'(?:A tank holds {n} liters|An empty tank is being filled)\.(?: For| For) the first {n} minutes a pump adds {n} liters per minute\. Then a second pump takes over and adds {n} liters per minute\. How many minutes after the start does the tank hold {n} liters\? Give the exact time in minutes\.', prompt)
    if m:
        start = Q(m[1]) if m[1] is not None else Q(0)
        t1, r1, r2, goal = (Q(m[i]) for i in (2, 3, 4, 5))
        level = start + t1 * r1
        require(goal > level and r2 > 0, 'Goal must be reached in the second phase')
        return pick_numeric(public, t1 + (goal - level) / r2)
    raise ValueError('Unrecognized rate wording: ' + prompt)


# --------------------------------------------- absolute-compound-inequality
class Pred:
    def __init__(self, fn, pts):
        self.fn, self.pts = fn, set(pts)


REL = re.compile(r'(<=|>=|<|>)')


def linear1(text):
    f = lambda x: ev(text, x=x)
    return f(1) - f(0), f(0)


def rel_ok(op, left, right):
    return {'<': left < right, '>': left > right, '<=': left <= right, '>=': left >= right}[op]


def chain_pred(text):
    parts = REL.split(plain(text).replace(' ', ''))
    require(len(parts) in (3, 5), f'Chain of one or two relations expected: {text}')
    operands, ops = parts[0::2], parts[1::2]
    pts = []
    for left, right in zip(operands, operands[1:]):
        a1, b1 = linear1(left)
        a2, b2 = linear1(right)
        slope = a1 - a2
        if slope != 0:
            pts.append((b2 - b1) / slope)
    def fn(x):
        vals = [ev(o, x=x) for o in operands]
        return all(rel_ok(op, vals[i], vals[i + 1]) for i, op in enumerate(ops))
    return Pred(fn, pts)


def or_pred(segments):
    preds = [chain_pred(s) for s in segments]
    return Pred(lambda x: any(p.fn(x) for p in preds), set().union(*[p.pts for p in preds]))


def abs_pred(inner, op, bound):
    a, b = linear1(inner)
    c = ev(bound)
    pts = []
    if a != 0:
        pts = [(c - b) / a, (-c - b) / a]
    else:
        pts = []
    return Pred(lambda x: rel_ok(op, abs(a * x + b), c), pts)


def text_choice(label):
    m = re.fullmatch(r'Every real number except \$x=(.+)\$', label)
    if m:
        v = ev(m[1])
        return Pred(lambda x: x != v, [v])
    m = re.fullmatch(r'Only \$x=(.+)\$', label)
    if m:
        v = ev(m[1])
        return Pred(lambda x: x == v, [v])
    if label == 'Every real number is a solution':
        return Pred(lambda x: True, [])
    if label == 'There are no real solutions':
        return Pred(lambda x: False, [])
    return None


def choice_pred(label):
    p = text_choice(label)
    if p:
        return p
    segs = maths(label)
    require(len(segs) >= 1 and re.fullmatch(r'\$[^$]+\$(?: or \$[^$]+\$)*', label), f'Unreadable inequality choice {label!r}')
    if len(segs) == 1 and plain(segs[0]).lstrip().startswith('|'):
        m = re.fullmatch(r'\|(.+)\|(<=|>=|<|>)(.+)', plain(segs[0]).replace(' ', ''))
        require(m is not None, 'Absolute-value choice unreadable')
        return abs_pred(m[1], m[2], m[3])
    pieces = []
    for seg in segs:
        pieces += re.split(r'\s+or\s+', plain(seg))
    return or_pred(pieces)


def test_points(preds):
    pts = sorted(set().union(*[p.pts for p in preds]))
    if not pts:
        return [Q(0), Q(1)]
    out = list(pts) + [pts[0] - 1, pts[-1] + 1]
    out += [(a + b) / 2 for a, b in zip(pts, pts[1:])]
    return out


def solve_absolute(public):
    prompt = plain(public['prompt'])
    options = choice_ids(public)
    expected = None
    m = re.fullmatch(r'Which (?:describes|gives) all real solutions of \$\|(.+)\|\s*(<=|>=|<|>)\s*(-?\d+)\$\?', prompt)
    if m:
        expected = abs_pred(m[1], m[2], m[3])
        a, _ = linear1(m[1])
        require(a != 0, 'Absolute argument must depend on x')
        c = ev(m[3])
        # Boundary variants should use the text choices exactly when c <= 0.
        text_labels = [bool(text_choice(o['label'])) for o in options]
        if c <= 0:
            require(sum(text_labels) >= 3, 'Boundary variant should offer the four descriptive choices')
        else:
            require(not any(text_labels), 'Positive bound should use interval choices')
    elif re.fullmatch(r'Which gives every real \$x\$ that satisfies \$.+\$ or \$.+\$\?', prompt):
        expected = or_pred(maths(prompt.replace('real $x$', 'real'))) 
    elif re.fullmatch(r'Which gives all real \$x\$ satisfying \$.+\$\?', prompt):
        chains = maths(prompt.replace('real $x$', 'real'))
        require(len(chains) == 1, 'One chain expected')
        expected = chain_pred(chains[0])
    else:
        m = re.fullmatch(r'On a number line, the solution set is every point (at or )?to the left of \$(-?\d+)\$ together with every point (at or )?to the right of \$(-?\d+)\$\. Which inequality has exactly this solution set\?', prompt)
        if m:
            lo, hi = Q(m[2]), Q(m[4])
            closed = bool(m[1])
            require(bool(m[1]) == bool(m[3]), 'Mixed endpoint wording')
            expected = Pred((lambda x: x <= lo or x >= hi) if closed else (lambda x: x < lo or x > hi), [lo, hi])
        else:
            m = re.fullmatch(r'On a number line, the solution set is the segment from \$(-?\d+)\$ to \$(-?\d+)\$, with (both endpoints included|neither endpoint included)\. Which inequality has exactly this solution set\?', prompt)
            require(m is not None, 'Unrecognized inequality wording: ' + prompt)
            lo, hi = Q(m[1]), Q(m[2])
            closed = m[3].startswith('both')
            expected = Pred((lambda x: lo <= x <= hi) if closed else (lambda x: lo < x < hi), [lo, hi])
    preds = [choice_pred(o['label']) for o in options]
    expected.pts |= set()
    pts = test_points(preds + [expected])
    sigs = [tuple(p.fn(x) for x in pts) for p in preds]
    require(len(set(sigs)) == 4, 'Mathematically duplicate inequality choices')
    target = tuple(expected.fn(x) for x in pts)
    hits = [o['id'] for o, s in zip(options, sigs) if s == target]
    require(len(hits) == 1, f'Expected solution set matches {len(hits)} choices')
    return hits[0]


# ----------------------------------------------------------- quadratic-from-data
def solve_quadratic_data(public):
    prompt = plain(public['prompt'])
    options = choice_ids(public)
    pt = r'\$\((-?\d+),(-?\d+)\)\$'
    m = re.search(r'crosses the \$x\$-axis at \$x=(-?\d+)\$ and \$x=(-?\d+)\$ and passes through the point ' + pt, prompt)
    if m:
        r, s, px, py = (Q(m[i]) for i in (1, 2, 3, 4))
        require(r != s and px not in (r, s), 'Zeros distinct and point off the axis')
        a = py / ((px - r) * (px - s))
        require(a != 0, 'Leading coefficient must be nonzero')
        coef = (a, -a * (r + s), a * r * s)
    else:
        m = re.search(r'vertex at ' + pt + r' and passes through the point ' + pt, prompt)
        if m:
            h, k, px, py = (Q(m[i]) for i in (1, 2, 3, 4))
            require(px != h, 'Point must differ from the vertex x-value')
            a = (py - k) / (px - h) ** 2
            require(a != 0, 'Leading coefficient must be nonzero')
            coef = (a, -2 * a * h, a * h * h + k)
        else:
            m = re.search(r'passes through ' + pt + ', ' + pt + ' and ' + pt, prompt)
            points = None
            if m:
                points = [(Q(m[1]), Q(m[2])), (Q(m[3]), Q(m[4])), (Q(m[5]), Q(m[6]))]
            else:
                t = re.search(r'x&(.+?)&(.+?)&(.+?)\\\\\\hline y&(.+?)&(.+?)&(.+?)\\end', prompt)
                require(t is not None, 'Unrecognized quadratic data: ' + prompt)
                require('table shows three values of a quadratic function' in prompt, 'Table wording missing')
                points = [(Q(t[i]), Q(t[i + 3])) for i in (1, 2, 3)]
            xs = [p[0] for p in points]
            require(len(set(xs)) == 3, 'Three distinct x values required')
            # Newton divided differences to monomial coefficients.
            (x0, y0), (x1, y1), (x2, y2) = points
            d01 = (y1 - y0) / (x1 - x0)
            d12 = (y2 - y1) / (x2 - x1)
            a = (d12 - d01) / (x2 - x0)
            b = d01 - a * (x0 + x1)
            c = y0 - a * x0 * x0 - b * x0
            coef = (a, b, c)
            require(a != 0, 'Data must be genuinely quadratic')
    def coefficients(label):
        seg = maths(label)
        require(len(seg) == 1 and seg[0].startswith('y='), 'Equation choice expected')
        rhs = seg[0][2:]
        f = lambda x: ev(rhs, x=x)
        c = f(0)
        a = (f(1) + f(-1)) / 2 - c
        b = (f(1) - f(-1)) / 2
        require(f(3) == 9 * a + 3 * b + c, 'Choice is not quadratic')
        return (a, b, c)
    cs = [coefficients(o['label']) for o in options]
    require(len(set(cs)) == 4, 'Mathematically duplicate quadratic choices')
    hits = [o['id'] for o, c in zip(options, cs) if c == coef]
    require(len(hits) == 1, 'Exactly one choice must match the unique quadratic')
    return hits[0]


SOLVERS = {
    'quadratic-root-relations': solve_root_relations,
    'system-expression-value': solve_system_expression,
    'variation-constant': solve_variation,
    'rate-combination-model': solve_rate,
    'absolute-compound-inequality': solve_absolute,
    'quadratic-from-data': solve_quadratic_data,
}


def solve(public):
    require(public['templateId'] in SUPPORTED, 'Unexpected SAT algebra-structure family')
    require(public.get('figure') is None, 'Unexpected diagram')
    return SOLVERS[public['templateId']](public)


def review_problem(problem):
    result = solve(problem['public'])
    require(result == problem['answer'], 'SAT algebra-structure answer key mismatch')
    # Leakage: the keyed label must not be handed over in the prompt or hint.
    label = next(o['label'] for o in problem['public']['response']['options'] if o['id'] == result)
    core = plain(label).replace('$', '').strip()
    if len(core) >= 6 and re.search(r'[=(\\]', core):
        for field in (problem['public']['prompt'], problem.get('hint', '')):
            require(core not in plain(field).replace('$', ''), 'Correct choice leaked in prompt or hint')
    return result


def _fixture(template, prompt, labels, answer_index):
    return {
        'public': {
            'templateId': template, 'prompt': prompt, 'figure': None,
            'response': {'kind': 'choice', 'options': [{'id': f'option-{i}', 'label': l} for i, l in enumerate(labels)]},
        },
        'answer': f'option-{answer_index}',
    }


def self_test():
    F = _fixture
    cases = [
        F('quadratic-root-relations', 'One solution of $2x^2 + kx + 24=0$ is $x=4$. What is the value of $k$?', ['$24$', '$14$', '$-7$', '$-14$'], 3),
        F('quadratic-root-relations', 'One solution of $3x^2 + 2x - 8=0$ is $x=-2$. What is the other solution?', ['$-\\frac{8}{3}$', '$-\\frac{4}{3}$', '$\\frac{4}{3}$', '$-\\frac{2}{3}$'], 2),
        F('quadratic-root-relations', 'The real solutions of $3x^2 + 12x + 1=0$ are $p$ and $q$. What is the value of $\\frac{1}{p}+\\frac{1}{q}$?', ['$-12$', '$-\\frac{1}{12}$', '$12$', '$-4$'], 0),
        F('quadratic-root-relations', 'The real solutions of $x^2 - 3x - 3=0$ are $p$ and $q$. What is the value of $p^2+q^2$?', ['$15$', '$9$', '$3$', '$-3$'], 0),
        F('system-expression-value', 'If $-3x + 3y=-3$ and $5x + 4y=14$, what is the value of $2x + 7y$?', ['$-42$', '$11$', '$-11$', '$-17$'], 1),
        F('system-expression-value', 'If $-8x - 2y=4$, what is the value of $-16x - 4y$?', ['$8$', '$-4$', '$2$', '$-8$'], 0),
        F('system-expression-value', 'If $-24x - 12y=-36$ and $-20x - 10y=-30$, what is the value of $-12x - 6y$?', ['$-18$', '$18$', '$-36$', '$0$'], 0),
        F('variation-constant', 'A fixed prize pool is split equally, so each winner\'s share $w$, in dollars, varies inversely with the number $n$ of winners. When $n=7$, $w=9$. What is $w$ when $n=9$?', ['$7$', '$63$', '$81$', '$\\frac{81}{7}$'], 0),
        F('variation-constant', 'The table shows three values of $y$ for three values of $x$. Which equation fits every row?\n$\\begin{array}{c|ccc}x&2&5&6\\\\\\hline y&5&14&17\\end{array}$', ['$y=x+3$', '$y=\\frac{5}{2}x$', '$y=3x-1$', '$y=\\frac{10}{x}$'], 2),
        F('variation-constant', 'The quantity $y$ varies inversely with $x$. By what factor does $y$ change when $x$ changes from 2 to 7?', ['$y$ is multiplied by $\\frac{4}{49}$', '$y$ is multiplied by $\\frac{7}{2}$', '$y$ is multiplied by $\\frac{2}{7}$', '$y$ increases by $5$'], 2),
        F('variation-constant', 'The time $t$, in hours, to drive a fixed route varies inversely with the average speed $s$, in miles per hour. The relationship is $t=\\frac{k}{s}$, and $t=5$ when $s=11$. What is the constant of variation $k$?', ['$\\frac{5}{11}$', '$55$', '$16$', '$\\frac{11}{5}$'], 1),
        F('variation-constant', 'At a steady speed, the distance $d$, in miles, that a train travels varies directly with the time $t$, in hours. The value of $d$ is 10 when $t$ is 5. Which equation models the relationship?', ['$d=\\frac{1}{2}t$', '$d=2t$', '$d=t+5$', '$d=\\frac{50}{t}$'], 1),
        F('rate-combination-model', 'A driver goes 52 miles to a lake at an average speed of 40 miles per hour and returns the same 52 miles at 45 miles per hour. What is the average speed for the whole round trip, in miles per hour? Give the exact value.', ['$\\frac{720}{17}$ mph', '$\\frac{5}{2}$ mph', '$\\frac{85}{2}$ mph', '$\\frac{360}{17}$ mph'], 0),
        F('rate-combination-model', 'How many liters of a 30% salt solution must be added to 3 liters of a 20% salt solution to make a mixture that is 29% salt?', ['$9$ liters', '$\\frac{27}{10}$ liters', '$27$ liters', '$\\frac{1}{3}$ liters'], 2),
        F('rate-combination-model', 'A pipe alone can fill an empty tank in 2 hours. A drain alone can empty a full tank in 15 hours. With the tank empty, both are opened and each works at its constant rate. How long until the tank is full? Give the exact time in hours.', ['$13$ hours', '$\\frac{17}{2}$ hours', '$\\frac{30}{17}$ hours', '$\\frac{30}{13}$ hours'], 3),
        F('rate-combination-model', 'A tank holds 50 liters. For the first 5 minutes a pump adds 6 liters per minute. Then a second pump takes over and adds 7 liters per minute. How many minutes after the start does the tank hold 136 liters? Give the exact time in minutes.', ['$\\frac{86}{7}$ minutes', '$\\frac{43}{3}$ minutes', '$\\frac{121}{7}$ minutes', '$13$ minutes'], 3),
        F('absolute-compound-inequality', 'Which describes all real solutions of $|x - 9|\\le 0$?', ['Every real number except $x=9$', 'Only $x=9$', 'Every real number is a solution', 'There are no real solutions'], 1),
        F('absolute-compound-inequality', 'Which describes all real solutions of $|x - 7|>-4$?', ['Every real number except $x=7$', 'Every real number is a solution', 'There are no real solutions', '$x<3$ or $x>11$'], 1),
        F('absolute-compound-inequality', 'Which gives all real solutions of $|-3x + 6|\\ge 2$?', ['$x\\le -\\frac{8}{3}$ or $x\\ge -\\frac{4}{3}$', '$x\\le -8$ or $x\\ge -4$', '$x\\le \\frac{4}{3}$ or $x\\ge \\frac{8}{3}$', '$\\frac{4}{3}\\le x\\le \\frac{8}{3}$'], 2),
        F('absolute-compound-inequality', 'Which gives every real $x$ that satisfies $4x - 4\\le -28$ or $-4x - 2<14$?', ['$x<-6$ or $x\\ge -4$', '$x\\le -6$ or $x<-4$', '$-6\\le x<-4$', '$x\\le -6$ or $x>-4$'], 3),
        F('absolute-compound-inequality', 'Which gives all real $x$ satisfying $-4\\le -4x + 2<5$?', ['$-\\frac{3}{4}\\le x<\\frac{3}{2}$', '$-\\frac{3}{4}<x\\le \\frac{3}{2}$', '$-\\frac{7}{4}<x\\le \\frac{1}{2}$', '$-6<x\\le 3$'], 1),
        F('absolute-compound-inequality', 'On a number line, the solution set is every point at or to the left of $-8$ together with every point at or to the right of $4$. Which inequality has exactly this solution set?', ['$|x+2|>6$', '$|x+2|\\ge 6$', '$|x+2|<6$', '$|x+2|\\le 6$'], 1),
        F('absolute-compound-inequality', 'On a number line, the solution set is the segment from $-9$ to $3$, with neither endpoint included. Which inequality has exactly this solution set?', ['$|x+3|>6$', '$|x+3|<6$', '$|x+3|\\ge 6$', '$|x+3|\\le 6$'], 1),
        F('quadratic-from-data', 'A parabola crosses the $x$-axis at $x=-2$ and $x=3$ and passes through the point $(-3,-6)$. Which equation represents the parabola?', ['$y=-(x+2)(x-3)$', '$y=(x+2)(x-3)$', '$y=6(x+2)(x-3)$', '$y=-(x+3)(x-2)$'], 0),
        F('quadratic-from-data', 'The graph of a quadratic function $y=f(x)$ passes through $(-1,-1)$, $(1,-9)$ and $(4,24)$. Which equation defines $f$?', ['$y=3x^2 - 4x - 8$', '$y=3x^2 - 4x - 1$', '$y=3x^2 + 4x - 8$', '$y=-3x^2 - 4x - 8$'], 0),
        F('quadratic-from-data', 'The table shows three values of a quadratic function $y=f(x)$. Which equation defines $f$?\n$\\begin{array}{c|ccc}x&1&3&5\\\\\\hline y&-6&6&42\\end{array}$', ['$y=3x^2 - 6x - 6$', '$y=3x^2 + 6x - 3$', '$y=3x^2 - 6x - 3$', '$y=24x^2 - 6x - 3$'], 2),
        F('quadratic-from-data', 'A parabola has its vertex at $(-2,1)$ and passes through the point $(-5,-17)$. Which equation represents the parabola?', ['$y=-2(x+2)^2+1$', '$y=-2(x+2)^2-1$', '$y=2(x+2)^2+1$', '$y=-2(x-2)^2+1$'], 0),
    ]
    rejected = 0

    def reject(problem, why):
        nonlocal rejected
        try:
            review_problem(problem)
        except (ValueError, KeyError, AttributeError, IndexError, TypeError):
            rejected += 1
            return
        raise ValueError(f'Corrupt SAT algebra-structure fixture was accepted: {why}: {problem["public"]["prompt"][:60]}')

    for case in cases:
        review_problem(case)
        options = case['public']['response']['options']
        wrong = copy.deepcopy(case)
        wrong['answer'] = options[(int(case['answer'][-1]) + 1) % 4]['id']
        reject(wrong, 'wrong key')
        dup = copy.deepcopy(case)
        keyed = int(case['answer'][-1])
        other = (keyed + 1) % 4
        dup['public']['response']['options'][other]['label'] = options[keyed]['label']
        reject(dup, 'duplicate of correct choice')
        bad = copy.deepcopy(case)
        # Perturb the first number in the prompt so the keyed choice is no longer right.
        bad['public']['prompt'] = re.sub(r'(?<![\^\d])(\d+)', lambda mm: str(int(mm[1]) + 1), bad['public']['prompt'], count=1)
        if bad['public']['prompt'] != case['public']['prompt']:
            try:
                review_problem(bad)
            except (ValueError, KeyError, AttributeError, IndexError, TypeError):
                rejected += 1
    # Domain violations that must be refused outright.
    reject(F('quadratic-root-relations', 'Without solving, find the sum of the two real solutions of $x^2 + x + 5=0$.', ['$-1$', '$1$', '$5$', '$-5$'], 0), 'no real solutions')
    reject(F('system-expression-value', 'If $2x + 2y=4$ and $x + y=3$, what is the value of $x + y$?', ['$1$', '$2$', '$3$', '$4$'], 2), 'inconsistent system')
    reject(F('system-expression-value', 'If $2x + 2y=4$, what is the value of $x - y$?', ['$1$', '$2$', '$3$', '$0$'], 3), 'undetermined expression')
    reject(F('quadratic-from-data', 'The graph of a quadratic function $y=f(x)$ passes through $(0,0)$, $(1,1)$ and $(2,2)$. Which equation defines $f$?', ['$y=x$', '$y=x^2$', '$y=2x$', '$y=-x$'], 0), 'collinear points')
    return {'fixtures': len(cases), 'rejectedMutations': rejected}


if __name__ == '__main__':
    print(self_test())
