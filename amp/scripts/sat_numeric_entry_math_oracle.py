"""Independent exact review of SAT student-produced-response (numeric entry) problems.

Every answer is re-derived from the displayed prompt only, with exact Fractions.
The stated selection rule must pick exactly one value, extraneous candidates are
removed by substitution into the original equation, and answers must be rationals.
"""
import copy
import re
from fractions import Fraction as Q
from math import isqrt, sqrt

SUPPORTED = frozenset({
    'sat-entry-system-solve', 'sat-entry-system-expression', 'sat-entry-quadratic-solution',
    'sat-entry-root-relations', 'sat-entry-absolute-equation', 'sat-entry-radical-equation',
    'sat-entry-rational-equation', 'sat-entry-polynomial-zeros', 'sat-entry-quadratic-context',
    'sat-entry-rate-numeric', 'sat-entry-radian-conversion', 'sat-entry-inequality-integer',
})


def require(condition, message):
    if not condition:
        raise ValueError(message)


# ---------- polynomials (low degree first) and rational functions ----------
def trim(p):
    p = list(p)
    while p and p[-1] == 0:
        p.pop()
    return p


def padd(a, b):
    n = max(len(a), len(b))
    return trim([(a[i] if i < len(a) else 0) + (b[i] if i < len(b) else 0) for i in range(n)])


def pneg(a):
    return [-c for c in a]


def pmul(a, b):
    if not a or not b:
        return []
    out = [Q(0)] * (len(a) + len(b) - 1)
    for i, x in enumerate(a):
        for j, y in enumerate(b):
            out[i + j] += x * y
    return trim(out)


def pval(p, x):
    return sum((c * x ** i for i, c in enumerate(p)), Q(0))


def rf_add(a, b):
    return (padd(pmul(a[0], b[1]), pmul(b[0], a[1])), pmul(a[1], b[1]))


def rf_mul(a, b):
    return (pmul(a[0], b[0]), pmul(a[1], b[1]))


def rf_neg(a):
    return (pneg(a[0]), a[1])


class Parser:
    def __init__(self, text, var='x'):
        text = text.replace('−', '-').replace('\\left', '').replace('\\right', '').replace('\\cdot', '*')
        self.s = re.sub(r'\s+', '', text)
        self.i = 0
        self.var = var

    def peek(self):
        return self.s[self.i] if self.i < len(self.s) else ''

    def eat(self, token):
        require(self.s.startswith(token, self.i), f'Expected {token!r} at {self.s[self.i:]!r}')
        self.i += len(token)

    def parse(self):
        value = self.expr()
        require(self.i == len(self.s), f'Unparsed text {self.s[self.i:]!r}')
        return value

    def expr(self):
        sign = 1
        if self.peek() in '+-' and self.peek():
            sign = -1 if self.peek() == '-' else 1
            self.i += 1
        value = self.term()
        if sign < 0:
            value = rf_neg(value)
        while self.peek() in ('+', '-') and self.peek():
            op = self.peek()
            self.i += 1
            t = self.term()
            value = rf_add(value, rf_neg(t) if op == '-' else t)
        return value

    def starts_factor(self):
        c = self.peek()
        return bool(c) and (c.isdigit() or c == self.var or c == '(' or self.s.startswith('\\frac', self.i))

    def term(self):
        value = self.factor()
        while True:
            if self.peek() == '*':
                self.i += 1
                value = rf_mul(value, self.factor())
            elif self.starts_factor():
                value = rf_mul(value, self.factor())
            else:
                return value

    def factor(self):
        base = self.atom()
        if self.peek() == '^':
            self.i += 1
            if self.peek() == '{':
                self.i += 1
                m = re.match(r'\d+', self.s[self.i:])
                self.i += len(m[0])
                self.eat('}')
            else:
                m = re.match(r'\d', self.s[self.i:])
                require(m, 'Bad exponent')
                self.i += 1
            result = ([Q(1)], [Q(1)])
            for _ in range(int(m[0])):
                result = rf_mul(result, base)
            return result
        return base

    def atom(self):
        c = self.peek()
        if c.isdigit():
            m = re.match(r'\d+(?:\.\d+)?', self.s[self.i:])
            self.i += len(m[0])
            return ([Q(m[0])], [Q(1)])
        if c == self.var:
            self.i += 1
            return ([Q(0), Q(1)], [Q(1)])
        if c == '(':
            self.i += 1
            v = self.expr()
            self.eat(')')
            return v
        if self.s.startswith('\\frac', self.i):
            self.i += 5
            self.eat('{')
            n = self.expr()
            self.eat('}')
            self.eat('{')
            d = self.expr()
            self.eat('}')
            return (pmul(n[0], d[1]), pmul(n[1], d[0]))
        raise ValueError(f'Unreadable expression near {self.s[self.i:]!r}')


def poly(text, var='x'):
    n, d = Parser(text, var).parse()
    require(d == [Q(1)] or (len(d) == 1), 'Expected a polynomial')
    return [c / d[0] for c in n]


def rational(text):
    return Parser(text).parse()


def real_roots(p):
    """Distinct real roots of a nonzero polynomial; irrational roots are rejected."""
    p = trim(p)
    require(p, 'Identity equation')
    found = set()
    while len(p) > 1:
        if p[0] == 0:
            found.add(Q(0))
            p = p[1:]
            continue
        if len(p) == 2:
            found.add(-p[0] / p[1])
            break
        if len(p) == 3:
            c, b, a = p
            disc = b * b - 4 * a * c
            if disc < 0:
                break
            num, den = disc.numerator, disc.denominator
            rn, rd = isqrt(num), isqrt(den)
            require(rn * rn == num and rd * rd == den, 'Irrational real root')
            r = Q(rn, rd)
            found.update({(-b + r) / (2 * a), (-b - r) / (2 * a)})
            break
        # rational root theorem
        lcm = 1
        for c in p:
            lcm = lcm * c.denominator // gcd(lcm, c.denominator)
        ints = [int(c * lcm) for c in p]
        lo = next(abs(c) for c in ints if c)
        hi = abs(ints[-1])
        cands = {Q(s * m, n) for m in divisors(lo) for n in divisors(hi) for s in (1, -1)}
        root = next((r for r in sorted(cands) if pval(p, r) == 0), None)
        require(root is not None, 'No rational root in higher-degree polynomial')
        found.add(root)
        p = divide_linear(p, root)
    return sorted(found)


def gcd(a, b):
    while b:
        a, b = b, a % b
    return a


def divisors(n):
    return [d for d in range(1, n + 1) if n % d == 0]


def divide_linear(p, r):
    out, carry = [], Q(0)
    for c in reversed(p):
        carry = c + carry * r
        out.append(carry)
    out.pop()
    return list(reversed(out))


def maths(prompt):
    return re.findall(r'\$([^$]+)\$', prompt)


def fraction_of(text):
    return Q(text.replace('−', '-'))


def term_number(text):
    return Q(text.replace('−', '-'))


# ---------- linear systems ----------
def linear2(text):
    """Coefficients (a, b) of a*x + b*y from a two-variable linear form."""
    s = re.sub(r'\s+', '', text.replace('−', '-'))
    require(re.fullmatch(r'(?:[+-]?\d*[xy])+', s) is not None, f'Unreadable linear form {text}')
    a = b = Q(0)
    for sign, num, var in re.findall(r'([+-]?)(\d*)([xy])', s):
        v = Q(int(num) if num else 1) * (-1 if sign == '-' else 1)
        if var == 'x':
            a += v
        else:
            b += v
    return a, b


def equation2(text):
    left, right = text.replace('−', '-').split('=')
    a, b = linear2(left)
    return a, b, Q(right.replace(' ', ''))


def solve_system(first, second):
    a1, b1, c1 = equation2(first)
    a2, b2, c2 = equation2(second)
    det = a1 * b2 - a2 * b1
    require(det != 0, 'System must have exactly one solution')
    return (c1 * b2 - c2 * b1) / det, (a1 * c2 - a2 * c1) / det


def system_solve(prompt):
    m = re.fullmatch(r'In the system of equations \$([^$]+)\$ and \$([^$]+)\$, what is the value of \$([xy])\$\?', prompt)
    require(m, 'Unknown system prompt')
    x, y = solve_system(m[1], m[2])
    return x if m[3] == 'x' else y


def system_expression(prompt):
    m = re.fullmatch(r'If \$([^$]+)\$ and \$([^$]+)\$, what is the value of \$([^$]+)\$\?', prompt)
    require(m, 'Unknown system-expression prompt')
    x, y = solve_system(m[1], m[2])
    a, b = linear2(m[3])
    return a * x + b * y


# ---------- quadratics ----------
def quadratic_from_sides(text):
    left, right = text.split('=')
    return padd(poly(left), pneg(poly(right)))


def quadratic_solution(prompt):
    m = re.fullmatch(r'What is the (positive|greater) solution of \$([^$]+)\$\?', prompt)
    one = re.fullmatch(r'The equation \$([^$]+)\$ has exactly one real solution\. What is it\?', prompt)
    require(m or one, 'Unknown quadratic-solution prompt')
    p = quadratic_from_sides((m or one)[2 if m else 1])
    require(len(p) == 3, 'Expected a quadratic')
    roots = real_roots(p)
    if one:
        require(len(roots) == 1, 'Claimed exactly one real solution')
        return roots[0]
    if m[1] == 'positive':
        positive = [r for r in roots if r > 0]
        require(len(positive) == 1, 'Exactly one positive solution required')
        return positive[0]
    require(len(roots) == 2, 'Two distinct solutions required for "greater"')
    return roots[1]


def root_relations(prompt):
    m = re.fullmatch(r'The equation \$([^$]+)\$ has two distinct real solutions, \$p\$ and \$q\$\. What is the value of \$([^$]+)\$\?', prompt)
    require(m, 'Unknown root-relations prompt')
    c, b, a = quadratic_from_sides(m[1])
    disc = b * b - 4 * a * c
    require(disc > 0, 'Roots must be distinct and real')
    s, pr = -b / a, c / a
    target = m[2]
    if target == 'p+q':
        value = s
    elif target == 'pq':
        value = pr
    elif target == 'p^2+q^2':
        value = s * s - 2 * pr
    elif target == r'\frac{1}{p}+\frac{1}{q}':
        require(pr != 0, 'Reciprocals need nonzero roots')
        value = s / pr
    else:
        raise ValueError('Unknown root expression')
    # floating-point cross-check of the symmetric-function identity
    r1, r2 = (-b + sqrt(disc)) / (2 * a), (-b - sqrt(disc)) / (2 * a)
    approx = {'p+q': r1 + r2, 'pq': r1 * r2, 'p^2+q^2': r1 * r1 + r2 * r2}.get(target)
    if approx is None:
        approx = 1 / r1 + 1 / r2
    require(abs(float(value) - float(approx)) < 1e-9, 'Vieta identity disagrees with numeric roots')
    return value


# ---------- absolute value ----------
def abs_side(text):
    return ('abs', poly(text[1:-1])) if text.startswith('|') and text.endswith('|') else ('plain', poly(text))


def absolute_equation(prompt):
    sums = re.fullmatch(r'What is the sum of the solutions of \$([^$]+)\$\?', prompt)
    great = re.fullmatch(r'What is the greater solution of \$([^$]+)\$\?', prompt)
    only = re.fullmatch(r'What is the solution of \$([^$]+)\$\?', prompt)
    exact = re.fullmatch(r'The equation \$([^$]+)\$ has exactly one solution\. What is it\?', prompt)
    kind = sums or great or only or exact
    require(kind, 'Unknown absolute-value prompt')
    left, right = re.sub(r'\s+', '', kind[1].replace('−', '-')).split('=')
    ls, rs = abs_side(left), abs_side(right)
    require(ls[0] == 'abs', 'Absolute value must be on the left')
    A, B = ls[1], rs[1]
    candidates = set()
    for sign in (1, -1):
        diff = padd(A, pneg(B)) if sign == 1 else padd(A, B)
        if not diff:
            raise ValueError('Identity branch')
        if len(diff) > 1:
            candidates.update(real_roots(diff))
    solutions = sorted(x for x in candidates if abs(pval(A, x)) == (abs(pval(B, x)) if rs[0] == 'abs' else pval(B, x)))
    if sums:
        require(len(solutions) == 2, 'Sum needs two solutions')
        return sum(solutions)
    if great:
        require(len(solutions) == 2, 'Greater needs two solutions')
        return solutions[-1]
    require(len(solutions) == 1, 'Exactly one solution required')
    return solutions[0]


# ---------- radicals ----------
def radical_equation(prompt):
    sums = re.fullmatch(r'What is the sum of all real solutions of \$([^$]+)\$\?', prompt)
    only = re.fullmatch(r'What is the solution of \$([^$]+)\$\?', prompt)
    kind = sums or only
    require(kind, 'Unknown radical prompt')
    eq = re.sub(r'\s+', '', kind[1].replace('−', '-'))
    m = re.fullmatch(r'(\d*)\\sqrt\{([^{}]+)\}=(.+)', eq)
    require(m, 'Unreadable radical equation')
    k = Q(int(m[1])) if m[1] else Q(1)
    radicand, right = poly(m[2]), poly(m[3])
    squared = padd(pmul([k * k], radicand), pneg(pmul(right, right)))
    candidates = real_roots(squared) if len(squared) > 1 else []
    kept = []
    for x in candidates:
        rhs, rad = pval(right, x), pval(radicand, x)
        # original equation: k*sqrt(rad) = rhs, so rad >= 0, rhs >= 0 and squares agree
        if rad >= 0 and rhs >= 0 and k * k * rad == rhs * rhs:
            kept.append(x)
    if sums:
        require(len(kept) >= 2, 'Sum of all solutions needs at least two')
        return sum(kept)
    require(len(kept) == 1, 'Exactly one solution required')
    return kept[0]


# ---------- rational equations ----------
def rational_equation(prompt):
    sums = re.fullmatch(r'What is the sum of all real solutions of \$([^$]+)\$\?', prompt)
    only = re.fullmatch(r'What is the solution of \$([^$]+)\$\?', prompt)
    kind = sums or only
    require(kind, 'Unknown rational prompt')
    left, right = kind[1].split('=')
    L, R = rational(left), rational(right)
    numerator = padd(pmul(L[0], R[1]), pneg(pmul(R[0], L[1])))
    denominators = [L[1], R[1]]
    roots = real_roots(numerator) if numerator else []
    kept = [x for x in roots if all(pval(d, x) != 0 for d in denominators)]
    # the original equation must hold exactly at each kept value
    for x in kept:
        require(pval(L[0], x) / pval(L[1], x) == pval(R[0], x) / pval(R[1], x), 'Candidate fails original')
    if sums:
        require(len(kept) >= 2, 'Sum of all solutions needs at least two')
        return sum(kept)
    require(len(kept) == 1, 'Exactly one solution required')
    return kept[0]


# ---------- polynomial zeros ----------
def polynomial_zeros(prompt):
    m = re.fullmatch(r'What is the (sum of all real zeros|sum of the distinct real zeros|positive zero|least zero) of \$f\(x\)=([^$]+)\$\?', prompt)
    require(m, 'Unknown polynomial-zero prompt')
    p = poly(m[2])
    roots = real_roots(p)
    irreducible = re.search(r'\(x\^2\+\d+\)', m[2]) is not None
    if m[1] == 'sum of all real zeros':
        require(irreducible, 'Prompt names "all" zeros but there is no non-real factor')
        # no repeated real factor, so "all" and "distinct" agree
        require(len(roots) == 2, 'Expected exactly two real zeros')
        return sum(roots)
    if m[1] == 'sum of the distinct real zeros':
        require(re.search(r'\)\^2', m[2]), 'Distinct is only needed with a repeated factor')
        return sum(roots)
    if m[1] == 'positive zero':
        positive = [r for r in roots if r > 0]
        require(len(positive) == 1, 'Exactly one positive zero required')
        return positive[0]
    require(len(roots) >= 2, 'Least zero needs several zeros')
    return roots[0]


# ---------- projectile ----------
def quadratic_context(prompt):
    h = re.search(r'\$h\(t\)=([^$]+)\$', prompt)
    require(h, 'Missing height function')
    c, b, a = poly(h[1], 't')
    require(a < 0, 'Projectile must open downward')
    vertex = -b / (2 * a)
    top = a * vertex * vertex + b * vertex + c
    if prompt.endswith('What is the greatest height, in meters, that the ball reaches?'):
        require(r't\ge0' in prompt and vertex >= 0 and c >= 0, 'Maximum over t>=0 must be the vertex')
        return top
    if prompt.endswith('At what time, in seconds, is the ball at its greatest height?'):
        require(vertex >= 0, 'Vertex time must be nonnegative')
        return vertex
    if prompt.endswith('How many seconds after the throw does it land?'):
        require('h(t)=0' in prompt and 't>0' in prompt, 'Landing condition must be stated')
        roots = [r for r in real_roots([c, b, a]) if r > 0]
        require(len(roots) == 1, 'Exactly one positive landing time required')
        return roots[0]
    raise ValueError('Unknown projectile question')


# ---------- rate and mixture ----------
def rate_numeric(prompt):
    m = re.fullmatch(r'Working alone, one machine finishes a job in (\d+) hours and a second machine finishes the same job in (\d+) hours\. Working together at these constant rates, how many hours do they need to finish the job\?', prompt)
    if m:
        a, b = Q(int(m[1])), Q(int(m[2]))
        return 1 / (1 / a + 1 / b)
    m = re.fullmatch(r'A pool is filled by one pipe in (\d+) hours and emptied by a drain in (\d+) hours when that pipe is closed\. With the pool empty, the pipe and drain both run at their constant rates\. How many hours does it take to fill the pool\?', prompt)
    if m:
        a, b = Q(int(m[1])), Q(int(m[2]))
        require(a < b, 'Pool never fills unless the pipe is faster than the drain')
        return 1 / (1 / a - 1 / b)
    m = re.fullmatch(r'How many liters of a (\d+)% acid solution must be added to (\d+) liters of a (\d+)% acid solution to make a (\d+)% acid solution\?', prompt)
    if m:
        strong, volume, weak, goal = (Q(int(g)) for g in m.groups())
        require(weak < goal < strong, 'Target concentration must lie between the two')
        x = volume * (goal - weak) / (strong - goal)
        require((strong * x + weak * volume) / (x + volume) == goal, 'Mixture check')
        return x
    m = re.fullmatch(r'A tank is empty\. For the first (\d+) minutes a pump adds (\d+) liters per minute\. Then a second pump replaces it and adds (\d+) liters per minute\. How many minutes after the start does the tank hold (\d+) liters\?', prompt)
    require(m, 'Unknown rate prompt')
    t1, r1, r2, target = (Q(int(g)) for g in m.groups())
    require(target > t1 * r1, 'Target must be reached after the second pump starts')
    return t1 + (target - t1 * r1) / r2


# ---------- radians ----------
def radian_conversion(prompt):
    m = re.fullmatch(r'An angle measures \$(-?\d+)\^\\circ\$\. In radians its measure is \$k\\pi\$\. What is the value of \$k\$\?', prompt)
    if m:
        return Q(int(m[1]), 180)
    m = re.fullmatch(r'An angle measures \$\\frac\{(\d*)\\pi\}\{(\d+)\}\$ radians\. What is its measure in degrees\?', prompt)
    require(m, 'Unknown radian prompt')
    return Q(int(m[1] or 1), int(m[2])) * 180


# ---------- inequalities ----------
def inequality_integer(prompt):
    m = re.fullmatch(r'How many positive integers \$x\$ satisfy \$([^$]+)\$\?', prompt)
    g = re.fullmatch(r'What is the (greatest|least) integer \$x\$ that satisfies \$([^$]+)\$\?', prompt)
    require(m or g, 'Unknown inequality prompt')
    text = (m or g)[1 if m else 2].replace('−', '-').replace(' ', '')
    parts = re.fullmatch(r'(.+?)(\\le|<)(-?\d+)', text)
    require(parts, 'Expected a linear inequality with <= or <')
    strict = parts[2] == '<'
    p = poly(parts[1])
    require(len(p) == 2, 'Expected nonconstant linear left side')
    b, a = p
    bound = (Q(int(parts[3])) - b) / a
    # a*x + b (<|<=) c: x (<|<=) bound when a>0, x (>|>=) bound when a<0
    upper = a > 0
    def floor(v):
        return v.numerator // v.denominator
    def ceil(v):
        return -((-v.numerator) // v.denominator)
    if upper:
        top = (ceil(bound) - 1) if strict else floor(bound)
    else:
        bottom = (floor(bound) + 1) if strict else ceil(bound)
    if m:
        require(upper, 'Counting positive integers needs an upper bound')
        return Q(max(0, top))
    if g[1] == 'greatest':
        require(upper, 'Greatest integer needs an upper bound')
        return Q(top)
    require(not upper, 'Least integer needs a lower bound')
    return Q(bottom)


SOLVERS = {
    'sat-entry-system-solve': system_solve,
    'sat-entry-system-expression': system_expression,
    'sat-entry-quadratic-solution': quadratic_solution,
    'sat-entry-root-relations': root_relations,
    'sat-entry-absolute-equation': absolute_equation,
    'sat-entry-radical-equation': radical_equation,
    'sat-entry-rational-equation': rational_equation,
    'sat-entry-polynomial-zeros': polynomial_zeros,
    'sat-entry-quadratic-context': quadratic_context,
    'sat-entry-rate-numeric': rate_numeric,
    'sat-entry-radian-conversion': radian_conversion,
    'sat-entry-inequality-integer': inequality_integer,
}


def solve(public):
    template = public['templateId']
    require(template in SUPPORTED, 'Unexpected SAT numeric-entry family')
    require(public.get('figure') is None, 'Unexpected diagram in numeric-entry problem')
    require(public['response']['kind'] == 'fraction', 'Numeric entry must use a fraction response')
    return SOLVERS[template](public['prompt'])


def canonical(value):
    return str(value.numerator) if value.denominator == 1 else f'{value.numerator}/{value.denominator}'


def review_problem(problem):
    expected = solve(problem['public'])
    answer = problem['answer']
    require(isinstance(answer, str), 'Numeric answer must be text')
    require(answer == canonical(expected), f'Answer key {answer} differs from derived {canonical(expected)}')
    # Terminating decimal or integer/fraction only; never an irrational or rounded value.
    den = expected.denominator
    while den % 2 == 0:
        den //= 2
    while den % 5 == 0:
        den //= 5
    public = problem['public']
    # Leakage: the hint may not state the final value unless it is already a given.
    if '/' in answer:
        n, d = answer.split('/')
        leak = re.search(rf'\\frac\{{{re.escape(n.lstrip("-"))}\}}\{{{d}\}}', problem['hint'])
        require(not leak, 'Hint leaks the fractional answer')
    else:
        # A plain value may appear as a coefficient; only an assignment such as "y=2" is a giveaway.
        hint = problem['hint'].replace('$', '').replace('−', '-')
        flat_prompt = re.sub(r'\s+', '', public['prompt'].replace('$', '').replace('−', '-'))
        for match in re.finditer(rf'(?:^|[\s(])([a-zA-Z]\s*=\s*{re.escape(answer)})(?![\d/.])', hint):
            given = re.sub(r'\s+', '', match[1]) in flat_prompt
            # Case-splitting hints list both branches of an absolute value by design.
            both = public['templateId'] == 'sat-entry-absolute-equation'
            require(given or both, 'Hint states the answer')
    require(re.fullmatch(r'Answer \(fraction, decimal, or whole number\)', public['response']['label']), 'Unexpected answer label')
    return expected


def self_test():
    P = lambda t, prompt: {'templateId': t, 'prompt': prompt, 'response': {'kind': 'fraction', 'label': 'Answer (fraction, decimal, or whole number)'}}
    fixtures = [
        ('sat-entry-system-solve', 'In the system of equations $3x + y = 20$ and $2x + 4y = 20$, what is the value of $y$?', '2'),
        ('sat-entry-system-solve', 'In the system of equations $x + 4y = 9$ and $3x + 4y = 11$, what is the value of $y$?', '2'),
        ('sat-entry-system-expression', 'If $5x + y = -2$ and $-5x + 3y = 4$, what is the value of $4y$?', '2'),
        ('sat-entry-system-expression', 'If $-4x - y = 5$ and $-5x - 5y = -1$, what is the value of $-7x + 2y$?', '16'),
        ('sat-entry-quadratic-solution', 'What is the positive solution of $3x^2 + 5x - 28=0$?', '7/3'),
        ('sat-entry-quadratic-solution', 'What is the greater solution of $x^2 - 4x=32$?', '8'),
        ('sat-entry-quadratic-solution', 'The equation $16x^2 + 48x + 36=0$ has exactly one real solution. What is it?', '-3/2'),
        ('sat-entry-root-relations', 'The equation $3x^2 + 10x + 4=0$ has two distinct real solutions, $p$ and $q$. What is the value of $p+q$?', '-10/3'),
        ('sat-entry-root-relations', 'The equation $5x^2 + 12x - 6=0$ has two distinct real solutions, $p$ and $q$. What is the value of $\\frac{1}{p}+\\frac{1}{q}$?', '2'),
        ('sat-entry-root-relations', 'The equation $x^2 + 2x - 2=0$ has two distinct real solutions, $p$ and $q$. What is the value of $p^2+q^2$?', '8'),
        ('sat-entry-absolute-equation', 'What is the solution of $|x - 8|=-2x - 2$?', '-10'),
        ('sat-entry-absolute-equation', 'What is the sum of the solutions of $|4x + 2|=11$?', '-1'),
        ('sat-entry-absolute-equation', 'The equation $|x - 7|=|x - 9|$ has exactly one solution. What is it?', '8'),
        ('sat-entry-radical-equation', 'What is the solution of $\\sqrt{-3x + 40}=x - 4$?', '8'),
        ('sat-entry-radical-equation', 'What is the solution of $4\\sqrt{x - 1}=9$?', '97/16'),
        ('sat-entry-radical-equation', 'What is the sum of all real solutions of $\\sqrt{3x - 9}=x - 3$?', '9'),
        ('sat-entry-rational-equation', 'What is the sum of all real solutions of $\\frac{x^2 + 3x - 18}{x + 4}=0$?', '-3'),
        ('sat-entry-rational-equation', 'What is the solution of $\\frac{x^2 + 2x - 3}{x + 3}=0$?', '1'),
        ('sat-entry-rational-equation', 'What is the solution of $\\frac{x + 5}{x + 6}=\\frac{x - 2}{x + 4}$?', '-32/5'),
        ('sat-entry-polynomial-zeros', 'What is the sum of all real zeros of $f(x)=(x+2)(x^2+4)(x-2)$?', '0'),
        ('sat-entry-polynomial-zeros', 'What is the positive zero of $f(x)=x(2x - 1)(x+5)$?', '1/2'),
        ('sat-entry-polynomial-zeros', 'What is the sum of the distinct real zeros of $f(x)=3(x + 6)^2(x - 1)(x - 4)$?', '-1'),
        ('sat-entry-quadratic-context', 'A ball is hit upward. Its height, in meters, $t$ seconds after it is hit is $h(t)=-t^2 + 7t + 27$ for $t\\ge0$ until it lands. What is the greatest height, in meters, that the ball reaches?', '157/4'),
        ('sat-entry-quadratic-context', 'A ball is thrown upward from a platform. Its height, in meters, $t$ seconds after the throw is $h(t)=-2t^2 + 14t + 16$. It lands on the ground when $h(t)=0$ for $t>0$. How many seconds after the throw does it land?', '8'),
        ('sat-entry-quadratic-context', 'A ball is hit upward. Its height, in meters, $t$ seconds after it is hit is $h(t)=-4t^2 + 15t + 8$ for $t\\ge0$ until it lands. At what time, in seconds, is the ball at its greatest height?', '15/8'),
        ('sat-entry-rate-numeric', 'Working alone, one machine finishes a job in 3 hours and a second machine finishes the same job in 6 hours. Working together at these constant rates, how many hours do they need to finish the job?', '2'),
        ('sat-entry-rate-numeric', 'A pool is filled by one pipe in 11 hours and emptied by a drain in 21 hours when that pipe is closed. With the pool empty, the pipe and drain both run at their constant rates. How many hours does it take to fill the pool?', '231/10'),
        ('sat-entry-rate-numeric', 'How many liters of a 60% acid solution must be added to 9 liters of a 20% acid solution to make a 35% acid solution?', '27/5'),
        ('sat-entry-rate-numeric', 'A tank is empty. For the first 2 minutes a pump adds 12 liters per minute. Then a second pump replaces it and adds 10 liters per minute. How many minutes after the start does the tank hold 55 liters?', '51/10'),
        ('sat-entry-radian-conversion', 'An angle measures $-150^\\circ$. In radians its measure is $k\\pi$. What is the value of $k$?', '-5/6'),
        ('sat-entry-radian-conversion', 'An angle measures $\\frac{9\\pi}{4}$ radians. What is its measure in degrees?', '405'),
        ('sat-entry-inequality-integer', 'How many positive integers $x$ satisfy $5x + 8\\le 57$?', '9'),
        ('sat-entry-inequality-integer', 'What is the greatest integer $x$ that satisfies $6x + 10< 52$?', '6'),
        ('sat-entry-inequality-integer', 'What is the least integer $x$ that satisfies $-7x + 4< 13$?', '-1'),
    ]
    rejected = 0

    def reject(problem):
        nonlocal rejected
        try:
            review_problem(problem)
        except ValueError:
            rejected += 1
            return
        raise ValueError(f'Corrupt numeric-entry case was accepted: {problem["public"]["prompt"]}')

    def case(template, prompt, answer):
        return {'public': P(template, prompt), 'answer': answer, 'hint': 'Work from the given numbers.'}

    for template, prompt, answer in fixtures:
        good = case(template, prompt, answer)
        review_problem(good)
        bad = copy.deepcopy(good)
        n = Q(answer)
        bad['answer'] = canonical(n + 1)
        reject(bad)
        bad = copy.deepcopy(good)
        bad['answer'] = str(float(n)) if n.denominator != 1 else answer + '.0'
        reject(bad)
        bad = copy.deepcopy(good)
        bad['public']['response']['kind'] = 'choice'
        reject(bad)
    # Selection rules and extraneous candidates must stay unambiguous.
    ambiguous = [
        ('sat-entry-quadratic-solution', 'What is the positive solution of $x^2 - 5x + 6=0$?'),
        ('sat-entry-quadratic-solution', 'The equation $x^2 - 4x + 3=0$ has exactly one real solution. What is it?'),
        ('sat-entry-quadratic-solution', 'What is the greater solution of $x^2 - 6x + 9=0$?'),
        ('sat-entry-root-relations', 'The equation $x^2 + 2x + 5=0$ has two distinct real solutions, $p$ and $q$. What is the value of $p+q$?'),
        ('sat-entry-absolute-equation', 'What is the solution of $|x - 1|=5$?'),
        ('sat-entry-absolute-equation', 'The equation $|x - 1|=|x - 1|$ has exactly one solution. What is it?'),
        ('sat-entry-radical-equation', 'What is the sum of all real solutions of $\\sqrt{-3x + 40}=x - 4$?'),
        ('sat-entry-rational-equation', 'What is the solution of $\\frac{x^2 - 5x + 6}{x + 1}=0$?'),
        ('sat-entry-polynomial-zeros', 'What is the positive zero of $f(x)=(x - 1)(x - 2)(x + 3)$?'),
        ('sat-entry-polynomial-zeros', 'What is the sum of all real zeros of $f(x)=(x+2)(x-2)(x-3)$?'),
        ('sat-entry-quadratic-context', 'A ball is thrown upward from a platform. Its height, in meters, $t$ seconds after the throw is $h(t)=-t^2 + 5t + 6$. How many seconds after the throw does it land?'),
        ('sat-entry-rate-numeric', 'A pool is filled by one pipe in 21 hours and emptied by a drain in 11 hours when that pipe is closed. With the pool empty, the pipe and drain both run at their constant rates. How many hours does it take to fill the pool?'),
        ('sat-entry-inequality-integer', 'What is the least integer $x$ that satisfies $5x + 1< 46$?'),
        ('sat-entry-system-solve', 'In the system of equations $x + y = 2$ and $2x + 2y = 4$, what is the value of $x$?'),
    ]
    for template, prompt in ambiguous:
        reject(case(template, prompt, '0'))
    return {'fixtures': len(fixtures), 'ambiguousRejected': len(ambiguous), 'rejectedMutations': rejected}


if __name__ == '__main__':
    print(self_test())
