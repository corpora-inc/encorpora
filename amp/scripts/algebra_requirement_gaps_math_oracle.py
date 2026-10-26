"""Independent review of the algebra requirement-gap families.

Every answer is derived from the public prompt and choices only, with exact
Fractions (Gaussian rationals for complex values). Radicals are compared as
exact (center, discriminant) pairs, never as decimals. Each choice is judged
true or false on its own, and exactly one must be true.
"""
import copy
import math
import re
from fractions import Fraction as F

SEQUENCE = frozenset({'arithmetic-sequence-as-function', 'geometric-sequence-as-function'})
SUPPORTED = SEQUENCE | frozenset({
    'geometric-rule-forms', 'solve-by-completing-square', 'complex-quadratic-solve',
    'complex-parts', 'interpret-linear-parameters', 'quadratic-form-conversion',
    'rational-extraneous-single', 'square-root-extraneous',
})


def require(condition, message):
    if not condition:
        raise ValueError(message)


# ---------------------------------------------------------------- numbers
class G:
    """A Gaussian rational re + im*i."""
    __slots__ = ('re', 'im')

    def __init__(self, re=0, im=0):
        self.re, self.im = F(re), F(im)

    def __add__(self, o):
        return G(self.re + o.re, self.im + o.im)

    def __sub__(self, o):
        return G(self.re - o.re, self.im - o.im)

    def __neg__(self):
        return G(-self.re, -self.im)

    def __mul__(self, o):
        return G(self.re * o.re - self.im * o.im, self.re * o.im + self.im * o.re)

    def __truediv__(self, o):
        n = o.re * o.re + o.im * o.im
        require(n != 0, 'Division by zero')
        return self * G(o.re / n, -o.im / n)

    def __eq__(self, o):
        return isinstance(o, G) and self.re == o.re and self.im == o.im

    def __hash__(self):
        return hash((self.re, self.im))

    def real(self):
        require(self.im == 0, 'Expected a real value')
        return self.re

    def power(self, k):
        require(isinstance(k, int), 'Integer exponent required')
        base, out = (self, G(1)) if k >= 0 else (G(1) / self, G(1))
        for _ in range(abs(k)):
            out = out * base
        return out


def exact_sqrt(value):
    """Rational square root of a nonnegative Fraction, or None."""
    value = F(value)
    if value < 0:
        return None
    a, b = math.isqrt(value.numerator), math.isqrt(value.denominator)
    return F(a, b) if a * a == value.numerator and b * b == value.denominator else None


def plain(text):
    text = text.replace('$', '').replace('−', '-').replace('\\cdot', '*').replace('\\times', '*')
    text = text.replace('\\left', '').replace('\\right', '').replace('\\,', '').replace('\\ ', ' ')
    return text


TOKEN = re.compile(r'\s*(\\frac|\\sqrt|\d+(?:\.\d+)?|[A-Za-z]|[-+*/^(){}])')


class Parser:
    """Exact arithmetic expressions with implicit multiplication."""

    def __init__(self, text, env=None):
        text = plain(text)
        # a typeset or plain fraction a/b is accepted: \frac{a}{b} is parsed natively.
        self.tokens = []
        pos = 0
        text = text.strip()
        while pos < len(text):
            match = TOKEN.match(text, pos)
            require(match is not None, f'Cannot read expression: {text!r} at {pos}')
            self.tokens.append(match[1])
            pos = match.end()
            while pos < len(text) and text[pos].isspace():
                pos += 1
        self.i = 0
        self.env = dict(env or {})
        self.env.setdefault('i', G(0, 1))

    def peek(self):
        return self.tokens[self.i] if self.i < len(self.tokens) else None

    def take(self, expected=None):
        tok = self.peek()
        require(tok is not None and (expected is None or tok == expected), f'Expected {expected}, got {tok}')
        self.i += 1
        return tok

    def parse(self):
        value = self.expr()
        require(self.peek() is None, f'Unread tokens: {self.tokens[self.i:]}')
        return value

    def expr(self):
        value = self.term()
        while self.peek() in ('+', '-'):
            op = self.take()
            right = self.term()
            value = value + right if op == '+' else value - right
        return value

    def starts_factor(self):
        tok = self.peek()
        return tok is not None and (tok in ('(', '\\frac', '\\sqrt') or tok[0].isdigit() or tok.isalpha())

    def term(self):
        value = self.unary()
        while True:
            tok = self.peek()
            if tok == '*':
                self.take()
                value = value * self.unary()
            elif tok == '/':
                self.take()
                value = value / self.unary()
            elif self.starts_factor():
                value = value * self.power()
            else:
                return value

    def unary(self):
        if self.peek() == '-':
            self.take()
            return -self.unary()
        if self.peek() == '+':
            self.take()
            return self.unary()
        return self.power()

    def power(self):
        base = self.atom()
        if self.peek() == '^':
            self.take()
            if self.peek() == '{':
                self.take()
                exponent = self.expr()
                self.take('}')
            else:
                exponent = self.atom()
            require(exponent.im == 0 and exponent.re.denominator == 1, 'Integer exponent required')
            return base.power(int(exponent.re))
        return base

    def braced(self):
        self.take('{')
        value = self.expr()
        self.take('}')
        return value

    def atom(self):
        tok = self.take()
        if tok == '(':
            value = self.expr()
            self.take(')')
            return value
        if tok == '\\frac':
            numerator = self.braced()
            return numerator / self.braced()
        if tok == '\\sqrt':
            radicand = self.braced().real()
            root = exact_sqrt(abs(radicand))
            require(root is not None, f'Irrational square root of {radicand}')
            return G(root) if radicand >= 0 else G(0, root)
        if tok[0].isdigit():
            return G(F(tok))
        require(tok in self.env, f'Unknown name {tok}')
        return self.env[tok]


def ev(text, **env):
    return Parser(text, env).parse()


def sides(text):
    left, sep, right = plain(text).partition('=')
    require(sep == '=' and '=' not in right, f'Expected one equation: {text!r}')
    return left, right


def inner(label):
    """The text inside the $...$ of a label."""
    matches = re.findall(r'\$([^$]*)\$', label)
    # a label read as plain text (a lone fraction a/b) has no dollar signs
    return matches or [label]


def poly_coeffs(left, right='0'):
    """Coefficients (c2, c1, c0) of left-right as a quadratic in x, by exact sampling."""
    ys = [ev(left, x=G(x)).real() - ev(right, x=G(x)).real() for x in range(-2, 5)]
    c0 = ys[2]
    c1 = (ys[3] - ys[1]) / 2
    c2 = (ys[3] + ys[1]) / 2 - c0
    for x, y in zip(range(-2, 5), ys):
        require(c2 * x * x + c1 * x + c0 == y, 'Expression is not a quadratic polynomial')
    return c2, c1, c0


def only_true(options, truth, what):
    flags = [truth(o) for o in options]
    require(sum(flags) == 1, f'{what}: {sum(flags)} choices are true, expected exactly one')
    return options[flags.index(True)]['id']


def choice_options(public, count=4):
    response = public['response']
    require(response['kind'] == 'choice', 'Choice response required')
    options = response['options']
    require(len(options) == count and all(set(o) == {'id', 'label'} for o in options), f'{count} public choices required')
    require(len({o['id'] for o in options}) == count, 'Duplicate choice IDs')
    require(len({plain(o['label']).replace(' ', '') for o in options}) == count, 'Textually duplicate choices')
    return options


# ------------------------------------------------------- solution sets
def element_set(center, d):
    """The two roots center +/- sqrt(d) as canonical, exactly comparable elements."""
    center, d = F(center), F(d)
    if d == 0:
        return frozenset({('r', center)})
    if d > 0:
        root = exact_sqrt(d)
        if root is not None:
            return frozenset({('r', center + root), ('r', center - root)})
    return frozenset({('s', center, d, 1), ('s', center, d, -1)})


def surd_element(center, coef, radicand, imaginary):
    d = coef * coef * radicand * (-1 if imaginary else 1)
    if d == 0:
        return frozenset({('r', F(center))})
    if d > 0:
        root = exact_sqrt(d)
        if root is not None:
            return frozenset({('r', F(center) + (root if coef > 0 else -root))})
    return frozenset({('s', F(center), d, 1 if coef > 0 else -1)})


def split_top(text, sep):
    depth, out, cur, i = 0, [], '', 0
    while i < len(text):
        ch = text[i]
        if ch == '{' or ch == '(':
            depth += 1
        elif ch == '}' or ch == ')':
            depth -= 1
        if depth == 0 and text.startswith(sep, i):
            out.append(cur)
            cur = ''
            i += len(sep)
            continue
        cur += ch
        i += 1
    out.append(cur)
    return out


def whole_fraction(text):
    """(numerator, denominator) if the whole text is one \\frac{..}{..}."""
    text = text.strip()
    if not text.startswith('\\frac{'):
        return None
    depth, i, parts = 0, 5, []
    start = None
    while i < len(text):
        if text[i] == '{':
            if depth == 0:
                start = i + 1
            depth += 1
        elif text[i] == '}':
            depth -= 1
            if depth == 0:
                parts.append(text[start:i])
                if len(parts) == 2:
                    return (parts[0], parts[1]) if i == len(text) - 1 else None
        i += 1
    return None


def surd_term(text):
    """(coefficient, radicand, imaginary) of a term like 3, \\sqrt{6}\\,i, \\frac{1}{2}i, -2\\sqrt{3}."""
    text = plain(text).replace(' ', '')
    match = re.fullmatch(r'(-?)((?:\\frac\{\d+\}\{\d+\}|\d+(?:/\d+)?)?)(?:\\sqrt\{(\d+)\})?(i?)', text)
    require(match is not None and (match[2] or match[3] or match[4]), f'Cannot read radical term {text!r}')
    coef = F(1)
    if match[2]:
        coef = ev(match[2]).real()
    sign = -1 if match[1] else 1
    return sign * coef, F(int(match[3])) if match[3] else F(1), bool(match[4])


def parse_solutions(label):
    """The solution set written in a label such as x=-5\\pm\\sqrt{6}\\,i or x=2 or x=8."""
    text = plain(label).strip()
    pieces = [p.strip() for p in text.split(' or ')]
    if len(pieces) > 1:
        out = frozenset()
        for p in pieces:
            require(p.startswith('x='), f'Cannot read solutions: {label!r}')
            out |= parse_solutions(p)
        return out
    require(text.startswith('x='), f'Cannot read solutions: {label!r}')
    body = text[2:].strip()
    frac = whole_fraction(body)
    if frac and '\\pm' in frac[0]:
        num, den = frac
        den = ev(den).real()
        left, right = num.split('\\pm')
        center = (ev(left).real() if left.strip() else F(0)) / den
        coef, rad, imag = surd_term(right)
        return element_set(center, (coef / den) ** 2 * rad * (-1 if imag else 1))
    if '\\pm' in body:
        left, right = body.split('\\pm')
        center = ev(left).real() if left.strip() else F(0)
        coef, rad, imag = surd_term(right)
        return element_set(center, coef * coef * rad * (-1 if imag else 1))
    try:
        value = ev(body)
    except ValueError:
        value = None
    if value is None or value.im != 0:
        coef, rad, imag = surd_term(body)
        return surd_element(0, coef, rad, imag)
    return frozenset({('r', value.re)})


def true_roots(a, b, c):
    a, b, c = F(a), F(b), F(c)
    require(a != 0, 'Not a quadratic')
    return element_set(-b / (2 * a), (b * b - 4 * a * c) / (4 * a * a))


# ------------------------------------------------------------- sequences
def sequence_function(prompt):
    match = re.match(r'An? (arithmetic|geometric) sequence is defined by \$a\(n\)=([^$]+)\$ for \$n=1,2,3,\\ldots\$\.', plain_keep(prompt))
    require(match is not None, 'Sequence definition must be explicit')
    kind, rule = match[1], match[2]
    return kind, rule, (lambda n: ev(rule, n=G(n)).real()), prompt[match.end():].strip()


def plain_keep(text):
    return text.replace('−', '-')


def is_positive_integer(value):
    return value.denominator == 1 and value >= 1


def solve_sequence(public):
    kind, rule, a, rest = sequence_function(public['prompt'])
    require(public['templateId'].startswith(kind), 'Sequence kind must match the template')
    first3 = [a(1), a(2), a(3)]
    if kind == 'arithmetic':
        require(first3[1] - first3[0] == first3[2] - first3[1] != 0, 'Arithmetic rule needs a constant nonzero difference')
    else:
        require(first3[0] != 0 and first3[1] / first3[0] == first3[2] / first3[1] not in (0, 1), 'Geometric rule needs a constant ratio')
    collinear = first3[1] - first3[0] == first3[2] - first3[1]
    options = choice_options(public)
    labels = {o['id']: o['label'] for o in options}
    if rest == 'Which set is the domain of the function $a$?':
        def truth(o):
            text = o['label']
            if text == 'All real numbers' or text == 'All integers':
                return False
            if text == 'All real numbers $n\\ge 1$':
                return False
            if text.startswith('The positive integers'):
                require(plain(text).replace(' ', '') == 'Thepositiveintegers1,2,3,\\ldots', 'Domain wording')
                return True
            values = re.findall(r'-?\d+', text)
            require([F(v) for v in values] == first3 and text.endswith('\\ldots$'), 'A list that is not the domain must be the outputs')
            return False
        return only_true(options, truth, 'domain')
    if rest.startswith('Using function notation, what is $a('):
        match = re.fullmatch(r'Using function notation, what is \$a\((\d+)\)\$\?', rest)
        require(match is not None, 'Evaluation wording')
        value = a(int(match[1]))
        return only_true(options, lambda o: ev(inner(o['label'])[0]).real() == value, 'evaluation')
    if rest == 'Which expression is undefined?':
        def truth(o):
            argument = re.fullmatch(r'\$a\((-?\d+(?:\.\d+)?)\)\$', o['label'])
            require(argument is not None, 'Expression wording')
            return not is_positive_integer(F(argument[1]))
        return only_true(options, truth, 'undefined')
    if rest.startswith('The sequence is graphed'):
        require('Which description of the graph is correct?' in rest, 'Graph wording')

        def truth(o):
            text = o['label']
            if text.startswith('A continuous') or text.startswith('A ray') or 'every half step' in text:
                return False
            require(text.startswith('Separate points'), f'Unknown graph description {text!r}')
            require(text.endswith('with no points between them'), 'Discrete wording')
            claims_line = 'do not lie on one line' not in text
            require('lie on one line' in text, 'Graph line wording')
            points = re.findall(r'\((-?\d+),(-?\d+)\)', text)
            if points:
                require([(F(x), F(y)) for x, y in points] == [(F(k + 1), first3[k]) for k in range(3)], 'Listed points must be the first terms')
            return claims_line == collinear
        return only_true(options, truth, 'graph')
    match = re.fullmatch(r'Is \$(-?\d+)\$ a term of this sequence\?', rest)
    require(match is not None, f'Unknown sequence question {rest!r}')
    target = F(match[1])
    is_term = any(a(n) == target for n in range(1, 80))

    def truth(o):
        text = o['label']
        m = re.fullmatch(r'Yes\. \$a\((\d+)\)=(-?\d+)\$\.', text)
        if m:
            return a(int(m[1])) == F(m[2]) == target
        m = re.fullmatch(r'Yes\. Some input between (\d+) and (\d+) produces \$(-?\d+)\$\.', text)
        if m:
            return False  # inputs between positions are not in the domain
        m = re.fullmatch(r'No\. \$(-?\d+)\$ lies between \$a\((\d+)\)=(-?\d+)\$ and \$a\((\d+)\)=(-?\d+)\$, and no position lies between (\d+) and (\d+)\.', text)
        if m:
            k, k2 = int(m[2]), int(m[4])
            require(F(m[1]) == target and k2 == k + 1 and int(m[6]) == k and int(m[7]) == k2, 'No-statement positions')
            lo, hi = a(k), a(k2)
            require(F(m[3]) == lo and F(m[5]) == hi, 'Stated neighbouring terms must be correct')
            return not is_term and min(lo, hi) < target < max(lo, hi)
        m = re.fullmatch(r'No\. No position produces \$(-?\d+)\$\.', text)
        if m:
            return F(m[1]) == target and not is_term
        raise ValueError(f'Unknown membership choice {text!r}')
    return only_true(options, truth, 'membership')


# -------------------------------------------------------- geometric rules
def norm_rule(text):
    return plain(text).replace('a_{n+1}', 'Q').replace('a_n', 'P').replace('a_1', 'A').replace(' ', '')


def recursion(text):
    """(first term, ratio-or-None, relation checker) from a_1=X, <relation>."""
    text = plain(text)
    left, sep, rest = text.partition(',')
    head = left.replace(' ', '')
    require(sep == ',' and re.match(r'a_[01]=', head), 'A recursive rule must state its starting term')
    first = ev(head.split('=', 1)[1]).real()
    if head.startswith('a_0='):
        # a starting term at position 0 shifts every term: never the sequence that starts at a_1
        return None, (lambda seq: False)
    relation = norm_rule(rest)
    lhs, rhs = relation.split('=')

    def holds(seq):
        for n in range(len(seq) - 1):
            env = {'P': G(seq[n]), 'Q': G(seq[n + 1]), 'n': G(n + 1)}
            if ev(lhs, **env) != ev(rhs, **env):
                return False
        return True
    # the relation must determine a_{n+1} (or a_n) uniquely from the other one.
    require(('Q' in lhs + rhs) and ('P' in lhs + rhs), 'Relation must connect consecutive terms')
    return first, holds


def explicit_sequence(label, count=7):
    text = plain(label).replace('a_n=', '', 1).strip()
    return [ev(text, n=G(n)).real() for n in range(1, count + 1)]


def rule_forms_truth_sets(public):
    prompt = plain_keep(public['prompt'])
    context = None
    m = re.fullmatch(r'A sequence has \$a_1=([^,]+),\\ a_\{n\+1\}=([^$]+?)\$\. Which explicit rule gives \$a_n\$ directly\?', prompt)
    if m:
        first, holds = recursion('a_1=' + m[1] + ',' + 'a_{n+1}=' + m[2])
        ratio = ev('Q', Q=G(1), P=G(1)).real()
        left, right = norm_rule('a_{n+1}=' + m[2]).split('=')
        ratio = ev(right, P=G(1), Q=G(0)).real()
        require(left == 'Q', 'Forward recursion expected')
        require(ratio not in (0, 1), 'Ratio must not be 0 or 1')
        seq = [first * ratio ** k for k in range(7)]
        return 'explicit', seq
    m = re.fullmatch(r'A geometric sequence has \$a_(\d+)=(-?\d+)\$ and \$a_(\d+)=(-?\d+)\$\. Which explicit rule gives \$a_n\$\?', prompt)
    if m:
        i, x, j, y = int(m[1]), F(m[2]), int(m[3]), F(m[4])
        require(j == i + 1 and x != 0 and y != 0, 'Two consecutive nonzero terms expected')
        ratio = y / x
        require(ratio not in (1,), 'Ratio must not be 1')
        first = x / ratio ** (i - 1)
        return 'explicit', [first * ratio ** k for k in range(7)]
    m = re.fullmatch(r'A sequence has the explicit rule \$a_n=([^$]+)\$\. Which recursive rule describes the same sequence\?', prompt)
    if m:
        seq = [ev(m[1], n=G(n)).real() for n in range(1, 8)]
        require(seq[0] != 0 and seq[1] / seq[0] == seq[2] / seq[1], 'Explicit rule must be geometric')
        return 'recursive', seq
    m = re.fullmatch(r'A (culture|ball|fund)(.+?) Let \$a_n\$ be (.+?)\. Which (rule gives \$a_n\$ directly from \$n\$|recursive rule describes the sequence)\?', prompt)
    require(m is not None, f'Unknown geometric rule question {prompt!r}')
    story = m[1] + m[2]
    if m[1] == 'culture':
        s = re.fullmatch(r"culture has (\d+) cells? at hour (\d+)\. Each hour the count is (\d+) times the count an hour earlier\.", story)
        require(s is not None, 'Culture wording')
        first, start, ratio = F(s[1]), int(s[2]), F(s[3])
    elif m[1] == 'ball':
        s = re.fullmatch(r"ball's first bounce is (\d+) centimeters? high\. Each bounce is (\$?\\frac\{\d+\}\{\d+\}\$?|\d+/\d+) as high as the previous bounce\.", story)
        require(s is not None, 'Ball wording')
        first, start, ratio = F(s[1]), 1, ev(s[2]).real()
    else:
        s = re.fullmatch(r"fund holds (\d+) dollars? at the end of year (\d+)\. Each year its balance is (\$?\\frac\{\d+\}\{\d+\}\$?|\d+/\d+) of the previous year's balance\.", story)
        require(s is not None, 'Fund wording')
        first, start, ratio = F(s[1]), int(s[2]), ev(s[3]).real()
    require(start == 1, 'The first listed value must be a_1 for these rules to start at n=1')
    seq = [first * ratio ** k for k in range(7)]
    return ('explicit' if m[4].startswith('rule gives') else 'recursive'), seq


def solve_geometric_rule(public):
    mode, seq = rule_forms_truth_sets(public)
    options = choice_options(public)

    def truth(o):
        label = inner(o['label'])
        require(len(label) == 1, 'One formula per rule choice')
        text = label[0]
        if mode == 'explicit':
            require(text.startswith('a_n='), 'Explicit choice must define a_n')
            return explicit_sequence(text) == seq
        first, holds = recursion(text)
        return first is not None and first == seq[0] and holds(seq)
    return only_true(options, truth, 'rule')


# ---------------------------------------------------- completing the square
def prompt_quadratic(prompt):
    match = re.search(r'\$([^$]*=0)\$', plain_keep(prompt))
    require(match is not None, 'Quadratic equation must be stated')
    left, _ = sides(match[1])
    return poly_coeffs(left)


def solve_completing_square(public):
    prompt = plain_keep(public['prompt'])
    a, b, c = prompt_quadratic(prompt)
    options = choice_options(public)
    if 'you add the same number to both sides' in prompt:
        require(a == 1, 'Intermediate step is stated for a monic quadratic')

        def truth(o):
            left, right = sides(inner(o['label'])[0])
            m = re.fullmatch(r'\(x([+-])(.+)\)\^2', plain(left).replace(' ', ''))
            require(m is not None, 'Square step wording')
            shift = ev(m[2]).real() * (1 if m[1] == '+' else -1)
            return shift == b / 2 and ev(right).real() == (b / 2) ** 2 - c
        return only_true(options, truth, 'intermediate step')
    require('by completing the square' in prompt and ('exact solutions' in prompt or 'lists all solutions' in prompt), 'Solve wording')
    require(a * 1 != 0, 'Leading coefficient')
    expected = true_roots(a, b, c)
    require(b * b - 4 * a * c > 0, 'Real solutions expected')
    return only_true(options, lambda o: parse_solutions(o['label']) == expected, 'solutions')


def solve_complex_quadratic(public):
    prompt = plain_keep(public['prompt'])
    options = choice_options(public)
    if prompt.startswith('Which quadratic equation with real coefficients has the solutions '):
        given = re.fullmatch(r'Which quadratic equation with real coefficients has the solutions \$(x=[^$]+)\$\?', prompt)
        require(given is not None, 'Solutions wording')
        roots = parse_solutions(given[1])
        require(len(roots) == 2 and all(r[0] == 's' and r[2] < 0 for r in roots), 'Nonreal conjugate pair expected')
        center = next(iter(roots))[1]
        d = next(iter(roots))[2]
        target = (F(1), -2 * center, center * center - d)

        def truth(o):
            left, right = sides(inner(o['label'])[0])
            coeffs = poly_coeffs(left, right)
            return coeffs[0] != 0 and tuple(c / coeffs[0] for c in coeffs) == target
        return only_true(options, truth, 'equation')
    match = re.fullmatch(r'Solve \$([^$]*=0)\$ over the complex numbers\. Which choice lists all solutions\?', prompt)
    require(match is not None, 'Complex solve wording')
    left, _ = sides(match[1])
    a, b, c = poly_coeffs(left)
    require(b * b - 4 * a * c < 0, 'Solutions must be nonreal')
    expected = true_roots(a, b, c)
    return only_true(options, lambda o: parse_solutions(o['label']) == expected, 'complex solutions')


def solve_complex_parts(public):
    prompt = plain_keep(public['prompt'])
    options = choice_options(public)
    m = re.fullmatch(r'Write the number \$z=([^$]+)\$ as \$a\+bi\$ with real numbers \$a\$ and \$b\$\. Which choice gives its real part and its imaginary part\?', prompt)
    if m:
        z = ev(m[1])

        def truth(o):
            parts = re.fullmatch(r'real part \$([^$]+)\$, imaginary part \$([^$]+)\$', o['label'])
            require(parts is not None, 'Parts wording')
            re_part, im_part = ev(parts[1]), ev(parts[2])
            return re_part.im == 0 and im_part.im == 0 and re_part.re == z.re and im_part.re == z.im
        return only_true(options, truth, 'parts')
    m = re.fullmatch(r'Write \$([^$]*\\sqrt\{-\d+\})\$ in the form \$a\+bi\$\.', prompt)
    if m:
        z = ev(m[1])
        return only_true(options, lambda o: ev(inner(o['label'])[0]) == z, 'root of a negative number')
    m = re.fullmatch(r'Simplify \$i\^\{(\d+)\}\$, using \$i\^2=-1\$\.', prompt)
    if m:
        z = G(0, 1).power(int(m[1]))
        return only_true(options, lambda o: ev(inner(o['label'])[0]) == z, 'power of i')
    m = re.fullmatch(r'Simplify \$(-?\d+)\\,i\^\{(\d+)\}\$ to the form \$a\+bi\$\.', prompt)
    if m:
        z = G(int(m[1])) * G(0, 1).power(int(m[2]))
        return only_true(options, lambda o: ev(inner(o['label'])[0]) == z, 'multiple of a power of i')
    require(prompt == 'Which of these is a real number (its imaginary part is 0)?', f'Unknown complex-parts question {prompt!r}')
    return only_true(options, lambda o: ev(inner(o['label'])[0]).im == 0, 'real number')


# -------------------------------------------------- linear model meaning
def solve_linear_meaning(public):
    prompt = plain_keep(public['prompt'])
    options = choice_options(public)
    m = re.fullmatch(r'(.+?) is modeled by \$([A-Za-z])=([^$]+)\$\. (What does the number (\d+) represent in this model\?|Which statement interprets both numbers in the model\?)', prompt)
    require(m is not None, 'Linear model wording')
    head, output, rule, question = m[1], m[2], m[3], m[4]
    names = re.findall(r'\$([A-Za-z])\$ ([a-z]+)', head)
    require(len(names) >= 1, 'Variables and units must be declared in the prompt')
    var = next((v for v, _ in names if v != output), None)
    if var is None:
        var = re.search(r'\$([a-z])\$', head.replace(f'${output}$', ''))[1]
    value = lambda x: ev(rule, **{var: G(x)}).real()
    intercept, slope = value(0), value(1) - value(0)
    require(value(2) - value(1) == slope and slope != 0 and intercept != 0, 'Model must be linear with nonzero parts')
    time_words = re.findall(r'\$' + var + r'\$ ([a-z]+)', head)
    require(len(time_words) == 1, 'Input unit must be declared')
    unit_in = time_words[0]
    singular = {'miles': 'mile', 'minutes': 'minute', 'weeks': 'week', 'years': 'year', 'hours': 'hour'}[unit_in]
    year_match = re.search(r'years after (\d{4})', head)
    out_unit = re.search(r'\$' + output + r'\$ ([a-z]+)', head)
    out_unit = out_unit[1] if out_unit else None
    if out_unit is None:
        require('subscribers' in head, 'Output unit must be declared')
        out_unit = 'subscribers'
    claims = {'rate': None}

    def part_truth(sentence):
        r = re.fullmatch(r'The .+? (increases|decreases) by (\d+) ([a-z]+) for each additional ([a-z]+)\.', sentence)
        if r:
            require(r[3] == out_unit and r[4] == singular, f'Units in {sentence!r} must match the prompt')
            return (1 if r[1] == 'increases' else -1) * F(r[2]) == slope
        r = re.fullmatch(r'The .+? after one ([a-z]+) is (\d+) ([a-z]+)\.', sentence)
        if r:
            require(r[1] == singular and r[3] == out_unit, f'Units in {sentence!r} must match the prompt')
            return F(r[2]) == value(1)
        r = re.fullmatch(r'The .+? in (\d{4}) \(0 years after (\d{4})\) is (\d+) ([a-z]+)\.', sentence)
        if r:
            require(year_match is not None and r[1] == r[2] == year_match[1], 'Start year must be the year in the prompt')
            require(r[4] == out_unit, 'Output unit must match')
            return F(r[3]) == intercept
        r = re.fullmatch(r'The .+? (?:when the drain opens|at purchase|at planting|for a (?:trip|job) of) ?\(?(\d+) ?([a-z]+)\)?(?: miles| hours)? is (\d+) ([a-z]+)\.', sentence)
        if r:
            return None
        raise ValueError(f'Unknown meaning sentence {sentence!r}')

    def start_truth(sentence):
        r = re.fullmatch(r'The .+? (?:when the drain opens|at purchase|at planting) \(0 ([a-z]+)\) is (\d+) ([a-z]+)\.', sentence)
        if r is None:
            r = re.fullmatch(r'The .+? for a (?:trip|job) of 0 ([a-z]+) is (\d+) ([a-z]+)\.', sentence)
        if r is None:
            return part_truth(sentence)
        require(r[1] == unit_in and r[3] == out_unit, f'Units in {sentence!r} must match the prompt')
        require(year_match is None, 'A model with a start year must name the year')
        return F(r[2]) == intercept

    def truth(o):
        label = o['label']
        sentences = re.findall(r'The .+?\.(?= The |$)', label)
        require(''.join(sentences).replace(' ', '') == label.replace(' ', '') and 1 <= len(sentences) <= 2, f'Choice wording {label!r}')
        require(len(sentences) == (2 if question.startswith('Which') else 1), 'Sentence count must match the question')
        return all(start_truth(s) for s in sentences)
    return only_true(options, truth, 'meaning')


# -------------------------------------------------------- quadratic forms
def shows_extreme_directly(form):
    text = plain(form).replace(' ', '')
    return re.fullmatch(r'-?\d*\(x[+-]\d+\)\^2(?:[+-]\d+)?', text) is not None or re.fullmatch(r'-?\d*x\^2(?:[+-]\d+)?', text) is not None


def vertex_extreme(form):
    """(h, k) of a form a(x-h)^2+k, read from the written form."""
    text = plain(form).replace(' ', '')
    m = re.fullmatch(r'(-?\d*)\(x([+-]\d+)\)\^2(?:([+-]\d+))?', text)
    if m:
        return -F(m[2]), F(m[3] or 0)
    m = re.fullmatch(r'-?\d*x\^2(?:([+-]\d+))?', text)
    return F(0), F(m[1] or 0)


def solve_quadratic_conversion(public):
    prompt = plain_keep(public['prompt'])
    options = choice_options(public)
    m = re.fullmatch(r'Rewrite \$y=([^$]+)\$ in vertex form \$y=\(x-h\)\^2\+k\$ by completing the square\. Which equation is correct\?', prompt)
    if m:
        a, b, c = poly_coeffs(m[1])
        require(a == 1, 'Vertex form with unit leading coefficient')

        def truth(o):
            right = sides(inner(o['label'])[0])[1]
            require(shows_extreme_directly(right), 'Vertex-form choice must show the vertex')
            return poly_coeffs(right) == (a, b, c)
        return only_true(options, truth, 'vertex form')
    m = re.fullmatch(r'Rewrite \$y=([^$]+)\$ by factoring\. Which choice lists the zeros of the function\?', prompt)
    if m:
        a, b, c = poly_coeffs(m[1])
        expected = true_roots(a, b, c)
        require(all(e[0] == 'r' for e in expected), 'Rational zeros expected for factoring')
        return only_true(options, lambda o: parse_solutions(o['label']) == expected, 'zeros')
    m = re.fullmatch(r'By completing the square, find the (maximum|minimum) value of \$y=([^$]+)\$\.', prompt)
    if m:
        a, b, c = poly_coeffs(m[2])
        require((a < 0) == (m[1] == 'maximum'), 'Extreme asked must exist')
        value = c - b * b / (4 * a)
        return only_true(options, lambda o: ev(inner(o['label'])[0]).real() == value, 'extreme value')
    m = re.fullmatch(r'The parabola is \$y=([^$]+)\$\. Which equation is its axis of symmetry\?', prompt)
    if m:
        a, b, c = poly_coeffs(m[1])
        axis = -b / (2 * a)
        return only_true(options, lambda o: ev(sides(inner(o['label'])[0])[1]).real() == axis and inner(o['label'])[0].startswith('x='), 'axis')
    m = re.fullmatch(r'The function \$f\$ is written three equivalent ways: option A: \$f\(x\)=([^$]+)\$, option B: \$f\(x\)=([^$]+)\$, option C: \$f\(x\)=([^$]+)\$\. Which option shows the (minimum|maximum) value of \$f\$ directly, and what is that value\?', prompt)
    require(m is not None, f'Unknown quadratic conversion question {prompt!r}')
    forms = {'A': m[1], 'B': m[2], 'C': m[3]}
    coeffs = {k: poly_coeffs(v) for k, v in forms.items()}
    require(len(set(coeffs.values())) == 1, 'The three forms must be equivalent')
    a, b, c = coeffs['A']
    require((a < 0) == (m[4] == 'maximum'), 'Extreme asked must exist')
    value = c - b * b / (4 * a)

    def shows(key):
        text = forms[key]
        if shows_extreme_directly(text):
            return True
        # a factored form with a repeated factor is a square, not a displayed extreme value
        return False

    def truth(o):
        t = re.fullmatch(r'Option ([ABC]); the (minimum|maximum) value is \$([^$]+)\$(?: or \$([^$]+)\$)?\.', o['label'])
        require(t is not None, 'Form choice wording')
        require(t[2] == m[4], 'Choice must name the extreme asked')
        if t[4]:
            return False  # two values name the zeros, never one extreme value
        stated = ev(t[3]).real()
        if shows(t[1]):
            require(vertex_extreme(forms[t[1]])[1] == value, 'Displayed constant must be the extreme')
        return shows(t[1]) and stated == value
    return only_true(options, truth, 'form and value')


# ------------------------------------------------- extraneous solutions
def excluded_value(text):
    ds = set()
    for m in re.finditer(r'\\frac\{[^{}]*\}\{x ([+-]) (\d+)\}', text):
        ds.add(-F(int(m[2])) if m[1] == '+' else F(int(m[2])))
    require(len(ds) == 1, 'Exactly one variable denominator expected')
    return ds.pop()


def rational_analysis(equation):
    left, right = sides(equation)
    d = excluded_value(equation)
    samples = [d + k for k in range(1, 7)]
    g = lambda x: ev(left, x=G(x)).real() - ev(right, x=G(x)).real()
    h = lambda x: g(x) * (x - d)
    xs = samples[:3]
    ys = [h(x) for x in xs]
    # Lagrange interpolation of the cleared polynomial through three points.
    def q(x):
        total = F(0)
        for i, xi in enumerate(xs):
            term = ys[i]
            for j, xj in enumerate(xs):
                if i != j:
                    term *= (x - xj) / (xi - xj)
            total += term
        return total
    require(all(q(x) == h(x) for x in samples[3:]), 'Cleared equation must be at most quadratic')
    c0, c1, c2 = q(F(0)), None, None
    c2 = (q(F(1)) + q(F(-1))) / 2 - c0
    c1 = (q(F(1)) - q(F(-1))) / 2
    if (c0, c1, c2) == (0, 0, 0):
        return d, None, None
    if c2 == 0:
        require(c1 != 0, 'Inconsistent cleared equation')
        candidates = {-c0 / c1}
    else:
        root = exact_sqrt(c1 * c1 - 4 * c2 * c0)
        require(root is not None, 'Candidates must be rational')
        candidates = {(-c1 + root) / (2 * c2), (-c1 - root) / (2 * c2)}
    return d, candidates, {x for x in candidates if x != d}


def solve_rational(public):
    prompt = plain_keep(public['prompt'])
    options = choice_options(public)
    m = re.fullmatch(r'Solve \$(.+)\$ over the real numbers\. Which statement is correct\?', prompt)
    if m:
        d, candidates, solutions = rational_analysis(m[1])

        def truth(o):
            text = o['label']
            if text.startswith('Every real number except'):
                require(ev(inner(text)[0].replace('x=', '')).real() == d, 'Excluded value')
                return candidates is None
            if candidates is None:
                return False
            if text.startswith('No solution. The only candidate'):
                return not solutions and candidates == {d} and ev(inner(text)[0].split('=')[1]).real() == d
            if text == 'No solution. The candidate makes the denominator zero.':
                return not solutions and bool(candidates)
            nums = [ev(s.split('=')[1]).real() for s in inner(text)] if 'and' in text else [ev(inner(text)[0].split('=')[1]).real()]
            require(text.startswith('$x=') and len(inner(text)) == len(nums), f'Unknown statement {text!r}')
            return set(nums) == solutions and bool(solutions)
        return only_true(options, truth, 'rational solution')
    m = re.fullmatch(r'A student solves \$(.+)\$ by multiplying both sides by \$x ([+-]) (\d+)\$ and gets \$x=(-?\d+)\$\. Which statement about \$x=(-?\d+)\$ is correct\?', prompt)
    require(m is not None, f'Unknown rational question {prompt!r}')
    d, candidates, solutions = rational_analysis(m[1])
    shown = -F(int(m[3])) if m[2] == '+' else F(int(m[3]))
    k = F(m[4])
    require(shown == d and m[5] == m[4], 'Student multiplier must be the denominator')
    require(candidates is not None and k in candidates, 'The stated value must come from the cleared equation')

    def truth(o):
        text = o['label']
        extraneous = k == d and not solutions
        if text.startswith('It is extraneous: it makes the denominator'):
            den = re.fullmatch(r'It is extraneous: it makes the denominator \$x ([+-]) (\d+)\$ equal to 0, so the equation has no solution\.', text)
            require(den is not None and (-F(int(den[2])) if den[1] == '+' else F(int(den[2]))) == k, 'Denominator in statement')
            return extraneous
        if re.fullmatch(r'It is extraneous because -?\d+ is (positive|negative)\.', text):
            return False  # the sign of a number is never the reason
        if text == 'It is a solution, because it satisfies the equation after the denominators are cleared.':
            return k in solutions
        if text == 'It is a solution, and there is also a second solution that the student missed.':
            return k in solutions and len(solutions) > 1
        raise ValueError(f'Unknown statement {text!r}')
    return only_true(options, truth, 'student statement')


def sqrt_analysis(equation):
    left, right = sides(equation)
    m = re.fullmatch(r'\\sqrt\{([^{}]+)\}(?:([+-])(\d+))?', left.replace(' ', ''))
    require(m is not None, 'Radical equation wording')
    radicand = m[1]
    shift = (-1 if m[2] == '-' else 1) * F(int(m[3])) if m[2] else F(0)
    inside = lambda x: ev(radicand, x=G(x)).real()
    u = lambda x: ev(right, x=G(x)).real() - shift
    # inside = u^2 is quadratic in x: interpolate from exact samples.
    pts = [F(k) for k in range(-3, 4)]
    vals = [inside(x) - u(x) ** 2 for x in pts]
    c0 = vals[3]
    c2 = (vals[4] + vals[2]) / 2 - c0
    c1 = (vals[4] - vals[2]) / 2
    for x, y in zip(pts, vals):
        require(c2 * x * x + c1 * x + c0 == y, 'Squared equation must be quadratic')
    require(c2 != 0, 'Quadratic candidate expected')
    root = exact_sqrt(c1 * c1 - 4 * c2 * c0)
    require(root is not None, 'Rational candidates expected')
    candidates = sorted({(-c1 + root) / (2 * c2), (-c1 - root) / (2 * c2)})
    valid = [x for x in candidates if u(x) >= 0 and inside(x) >= 0]
    return left, right, radicand, candidates, valid, u


def solve_sqrt(public):
    prompt = plain_keep(public['prompt'])
    options = choice_options(public)
    m = re.fullmatch(r'Solve \$(.+)\$ over the real numbers\. Which statement describes all solutions\?', prompt)
    if m:
        *_, candidates, valid, _u = sqrt_analysis(m[1])

        def truth(o):
            text = o['label']
            if text == 'There are no real solutions.':
                return not valid
            only = re.fullmatch(r'Only \$x=(-?\d+)\$\.', text)
            if only:
                return valid == [F(only[1])]
            both = re.fullmatch(r'\$x=(-?\d+)\$ and \$x=(-?\d+)\$', text)
            require(both is not None, f'Unknown statement {text!r}')
            return valid == sorted({F(both[1]), F(both[2])}) and F(both[1]) != F(both[2])
        return only_true(options, truth, 'real solutions')
    m = re.fullmatch(r'Solving \$(.+)\$ by squaring gives the candidates \$x=(-?\d+)\$ and \$x=(-?\d+)\$\. Which candidate is extraneous, and why\?', prompt)
    if m:
        left, right, radicand, candidates, valid, u = sqrt_analysis(m[1])
        require(sorted({F(m[2]), F(m[3])}) == candidates, 'Stated candidates must be the squared equation roots')
        extraneous = [x for x in candidates if x not in valid]

        def truth(o):
            text = o['label']
            if text.startswith('Both:'):
                return len(extraneous) == 2
            if text.startswith('Neither:'):
                return not extraneous
            c = re.fullmatch(r'\$x=(-?\d+)\$: the square root there does not equal the right side\.', text)
            if c:
                return F(c[1]) in extraneous
            c = re.fullmatch(r'\$x=(-?\d+)\$: the right side \$([^$]+)\$ equals (-?\d+), which is negative, but a square root is never negative\.', text)
            require(c is not None, f'Unknown statement {text!r}')
            x = F(c[1])
            require(ev(c[2], x=G(x)).real() == F(c[3]) == u(x) if sides(m[1])[0].replace(' ', '').startswith('\\sqrt{') and '+' not in sides(m[1])[0].split('}')[-1] and '-' not in sides(m[1])[0].split('}')[-1] else True, 'Stated right-side value')
            return x in extraneous and u(x) < 0
        return only_true(options, truth, 'extraneous candidate')
    m = re.fullmatch(r'To solve \$(.+)\$, a student squares both sides and finds \$x=(-?\d+)\$ and \$x=(-?\d+)\$\. Why must each candidate be checked in the original equation\?', prompt)
    require(m is not None, f'Unknown square-root question {prompt!r}')
    left, right, radicand, candidates, valid, u = sqrt_analysis(m[1])
    require(sorted({F(m[2]), F(m[3])}) == candidates, 'Stated candidates must be the squared equation roots')
    require(len(valid) < len(candidates), 'The reason offered requires a candidate to fail')

    def truth(o):
        text = o['label']
        if text.startswith('Squaring also keeps solutions of $'):
            eq = re.fullmatch(r'Squaring also keeps solutions of \$(.+)\$, so a candidate may satisfy the squared equation but not the original\.', text)
            require(eq is not None, 'Reason wording')
            l2, r2 = sides(eq[1])
            return plain(l2).replace(' ', '') == plain(left).replace(' ', '') and plain(r2).replace(' ', '') == '-(' + plain(right).replace(' ', '') + ')'
        if text == 'Squaring changes the numbers, so the check is only to catch arithmetic mistakes.':
            return False
        if text == 'A square root equation always has exactly one solution, and the check picks which.':
            return False  # square-root equations can have two solutions or none
        if text == 'Squaring can make solutions disappear, so the check finds the missing ones.':
            return False  # A=B implies A^2=B^2, so squaring never loses a solution
        raise ValueError(f'Unknown reason {text!r}')
    return only_true(options, truth, 'reason')


# ------------------------------------------------------------- dispatch
def solve(public):
    template = public['templateId']
    require(template in SUPPORTED, 'Unexpected algebra requirement-gap family')
    require(public.get('figure') is None, 'Unexpected figure')
    if template in SEQUENCE:
        return solve_sequence(public)
    return {
        'geometric-rule-forms': solve_geometric_rule,
        'solve-by-completing-square': solve_completing_square,
        'complex-quadratic-solve': solve_complex_quadratic,
        'complex-parts': solve_complex_parts,
        'interpret-linear-parameters': solve_linear_meaning,
        'quadratic-form-conversion': solve_quadratic_conversion,
        'rational-extraneous-single': solve_rational,
        'square-root-extraneous': solve_sqrt,
    }[template](public)


def review_problem(problem):
    public = problem['public']
    result = solve(public)
    require(result == problem['answer'], f"{public['templateId']}: answer key mismatch")
    # No giveaway: the answer id must not be named in the prompt or hint.
    require(problem['answer'] not in public['prompt'] and problem['answer'] not in problem.get('hint', ''), 'Answer id leaked')
    return result


def self_test():
    """Deliberately corrupted fixtures must be rejected."""
    def make(template, prompt, labels, answer):
        return {
            'public': {'templateId': template, 'prompt': prompt, 'response': {'kind': 'choice', 'options': [
                {'id': f'option-{c}', 'label': label} for c, label in zip('abcd', labels)
            ]}},
            'answer': f'option-{answer}',
        }
    fixtures = [
        make('arithmetic-sequence-as-function',
             'An arithmetic sequence is defined by $a(n)=2 + 8(n - 1)$ for $n=1,2,3,\\ldots$. Using function notation, what is $a(4)$?',
             ['$26$', '$34$', '$18$', '$10$'], 'a'),
        make('geometric-sequence-as-function',
             'A geometric sequence is defined by $a(n)=3\\cdot 2^{n-1}$ for $n=1,2,3,\\ldots$. Is $5$ a term of this sequence?',
             ['Yes. $a(1)=5$.', 'Yes. $a(2)=5$.', 'No. $5$ lies between $a(1)=3$ and $a(2)=6$, and no position lies between 1 and 2.', 'Yes. Some input between 1 and 2 produces $5$.'], 'c'),
        make('geometric-rule-forms',
             'A sequence has the explicit rule $a_n=7\\cdot \\left(\\frac{1}{2}\\right)^{n-1}$. Which recursive rule describes the same sequence?',
             ['$a_1=7,\\ a_{n+1}=\\frac{1}{2}\\,a_n$', '$a_1=\\frac{1}{2},\\ a_{n+1}=7\\,a_n$', '$a_1=7,\\ a_n=\\frac{1}{2}\\,a_{n+1}$', '$a_1=7,\\ a_{n+1}=a_n+\\frac{1}{2}$'], 'a'),
        make('geometric-rule-forms',
             "A ball's first bounce is 9 centimeters high. Each bounce is $\\frac{1}{3}$ as high as the previous bounce. Let $a_n$ be the height of bounce $n$. Which rule gives $a_n$ directly from $n$?",
             ['$a_n=9+\\frac{1}{3}(n-1)$', '$a_n=\\frac{1}{3}\\cdot 9^{n-1}$', '$a_n=9\\cdot \\left(\\frac{1}{3}\\right)^{n}$', '$a_n=9\\cdot \\left(\\frac{1}{3}\\right)^{n-1}$'], 'd'),
        make('geometric-rule-forms',
             "A ball's first bounce is 9 centimeters high. Each bounce is 1/3 as high as the previous bounce. Let $a_n$ be the height of bounce $n$. Which rule gives $a_n$ directly from $n$?",
             ['$a_n=9+\\frac{1}{3}(n-1)$', '$a_n=\\frac{1}{3}\\cdot 9^{n-1}$', '$a_n=9\\cdot \\left(\\frac{1}{3}\\right)^{n}$', '$a_n=9\\cdot \\left(\\frac{1}{3}\\right)^{n-1}$'], 'd'),
        make('solve-by-completing-square',
             'Solve $x^2 + 10x + 3=0$ by completing the square. Give the exact solutions.',
             ['$x=-5\\pm \\sqrt{22}$', '$x=-10\\pm \\sqrt{22}$', '$x=-5\\pm 22$', '$x=5\\pm \\sqrt{22}$'], 'a'),
        make('complex-quadratic-solve',
             'Solve $2x^2 + 20x + 62=0$ over the complex numbers. Which choice lists all solutions?',
             ['$x=5\\pm \\sqrt{6}\\,i$', '$x=-5\\pm \\sqrt{6}$', '$x=-5\\pm \\sqrt{6}\\,i$', '$x=-10\\pm \\sqrt{6}\\,i$'], 'c'),
        make('complex-parts',
             'Simplify $7\\,i^{11}$ to the form $a+bi$.',
             ['$-7i$', '$7$', '$7i$', '$-7$'], 'a'),
        make('interpret-linear-parameters',
             'A town\'s population, $P$ people, $t$ years after 1990 is modeled by $P=5400-120t$. Which statement interprets both numbers in the model?',
             ['The population decreases by 120 people for each additional year. The population in 1990 (0 years after 1990) is 5400 people.',
              'The population increases by 120 people for each additional year. The population in 1990 (0 years after 1990) is 5400 people.',
              'The population decreases by 120 people for each additional year. The population after one year is 5400 people.',
              'The population decreases by 5400 people for each additional year. The population in 1990 (0 years after 1990) is 120 people.'], 'a'),
        make('quadratic-form-conversion',
             'The parabola is $y=(x-1)(x-3)$. Which equation is its axis of symmetry?',
             ['$x=4$', '$x=1$', '$x=-2$', '$x=2$'], 'd'),
        make('rational-extraneous-single',
             'Solve $\\frac{x^2-25}{x - 5}=10$ over the real numbers. Which statement is correct?',
             ['No solution. The only candidate, $x=5$, makes the denominator zero.', '$x=-5$', 'Every real number except $5$ is a solution.', '$x=5$'], 'a'),
        make('square-root-extraneous',
             'Solving $\\sqrt{3x - 8}=-x + 6$ by squaring gives the candidates $x=4$ and $x=11$. Which candidate is extraneous, and why?',
             ['Both: every candidate found by squaring is extraneous.', 'Neither: both candidates satisfy the original equation.',
              '$x=4$: the square root there does not equal the right side.',
              '$x=11$: the right side $-x + 6$ equals -5, which is negative, but a square root is never negative.'], 'd'),
    ]
    rejected = 0
    by = lambda template: next(f for f in fixtures if f['public']['templateId'] == template)

    def reject(problem, why):
        nonlocal rejected
        try:
            review_problem(problem)
        except (ValueError, KeyError, TypeError, AttributeError, IndexError):
            rejected += 1
            return
        raise ValueError(f'Corrupt algebra requirement-gap case was accepted: {why}')
    for fixture in fixtures:
        review_problem(fixture)
        bad = copy.deepcopy(fixture)
        bad['answer'] = 'option-b' if fixture['answer'] != 'option-b' else 'option-c'
        reject(bad, 'wrong key')
        # a second correct choice is ambiguous; swap in a copy of the correct label's meaning
        bad = copy.deepcopy(fixture)
        correct = fixture['answer'][-1]
        index = 'abcd'.index(correct)
        other = 0 if index != 0 else 1
        bad['public']['response']['options'][other]['label'] = fixture['public']['response']['options'][index]['label'] + ' '
        reject(bad, 'duplicate correct choice')
    # givens changed so the key is no longer right
    bad = copy.deepcopy(fixtures[0])
    bad['public']['prompt'] = bad['public']['prompt'].replace('2 + 8', '2 + 9')
    reject(bad, 'changed rule')
    bad = copy.deepcopy(by('interpret-linear-parameters'))
    bad['public']['prompt'] = bad['public']['prompt'].replace('years after 1990', 'years after 1991')
    reject(bad, 'changed start year')
    bad = copy.deepcopy(by('interpret-linear-parameters'))
    bad['public']['response']['options'][0]['label'] = bad['public']['response']['options'][0]['label'].replace('people', 'dollars')
    reject(bad, 'wrong unit')
    bad = copy.deepcopy(by('complex-parts'))
    bad['public']['prompt'] = bad['public']['prompt'].replace('i^{11}', 'i^{12}')
    reject(bad, 'changed exponent')
    bad = copy.deepcopy(by('complex-quadratic-solve'))
    bad['public']['prompt'] = bad['public']['prompt'].replace('62', '12')
    reject(bad, 'real roots stated as complex')
    # typeset and plain fractions must both be read
    typeset = ev('\\frac{3}{4}+\\left(\\frac{1}{2}\\right)^{2}')
    assert typeset == ev('3/4+(1/2)^2') == G(1), 'fraction readings differ'
    return {'fixtures': len(fixtures), 'rejectedMutations': rejected}


if __name__ == '__main__':
    print(self_test())
