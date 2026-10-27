"""Independent exact review of the SAT function-form templates.

Every answer is re-derived from the public prompt and choices only, with exact
Fractions (floats only to compare exponential choices at non-integer exponents).
Numeric templates must return the exact accepted value; choice templates must have
exactly one option that satisfies the stated conditions and no two options that are
mathematically the same.
"""
import copy
import re
from fractions import Fraction as Q
from math import isclose

NUMERIC = frozenset({'sat-entry-fn-linear-notation', 'sat-entry-fn-exponential', 'sat-entry-fn-related-value'})
CHOICE = frozenset({'sat-fn-line-equation-choice', 'sat-fn-constraint-choice', 'sat-fn-exponential-choice'})
SUPPORTED = NUMERIC | CHOICE


def require(condition, message):
    if not condition:
        raise ValueError(message)


# ---------------------------------------------------------------- expression evaluation
def clean(text):
    text = text.replace('−', '-').replace('\\left', '').replace('\\right', '').replace('\\cdot', '*').replace('$', '')
    text = re.sub(r'\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}', r'((\1)/(\2))', text)
    text = re.sub(r'\^\{([^{}]*)\}', r'**(\1)', text)
    text = re.sub(r'\^(\d)', r'**(\1)', text)
    return re.sub(r'\s+', '', text)


def evaluate(text, **env):
    """Evaluate a LaTeX arithmetic expression; env maps variable names to numbers."""
    s = clean(text)
    require(re.fullmatch(r'[0-9a-zA-Z.+\-*/()]*', s) is not None, f'Unreadable expression {text!r}')
    tokens = re.findall(r'\d+(?:\.\d+)?|[a-zA-Z]|\*\*|[+\-*/()]', s)
    require(''.join(tokens) == s, f'Unreadable expression {text!r}')
    out = []
    for token in tokens:
        starts_value = token[0].isdigit() or token[0].isalpha() or token == '('
        if out and starts_value and (out[-1][-1].isalnum() or out[-1][-1] in ')]'):
            out.append('*')
        if token[0].isdigit():
            out.append(f"Q('{token}')")
        elif token[0].isalpha():
            require(token in env, f'Unknown variable {token}')
            out.append(f'env[{token!r}]')
        else:
            out.append(token)
    code = ''.join(out)
    # Pow of an exact base by a Fraction exponent: keep exact when the exponent is integral.
    value = eval(code, {'Q': Q, 'env': env, '__builtins__': {}}, {})  # noqa: S307 - sanitized arithmetic only
    return value


def num(text):
    value = evaluate(text)
    require(isinstance(value, Q), f'Not a rational: {text!r}')
    return value


def canonical(value):
    return str(value.numerator) if value.denominator == 1 else f'{value.numerator}/{value.denominator}'


def linear_coeffs(expr, var='x'):
    """(slope, intercept) of a linear expression in one variable, checked at three points."""
    f = lambda v: evaluate(expr, **{var: Q(v)})
    a, b = f(0), f(1)
    slope = b - a
    require(f(2) - f(1) == slope and f(-3) - f(-4) == slope, f'Not linear: {expr!r}')
    return slope, a


def equation_sides(text):
    left, right = text.split('=')
    return left, right


def nth_root(value, n):
    """Exact positive rational n-th root or ValueError."""
    require(value > 0, 'Root of a non-positive value')

    def iroot(m):
        lo, hi = 0, 1
        while hi ** n <= m:
            hi *= 2
        while lo < hi - 1:
            mid = (lo + hi) // 2
            if mid ** n <= m:
                lo = mid
            else:
                hi = mid
        return lo

    a, b = iroot(value.numerator), iroot(value.denominator)
    require(a ** n == value.numerator and b ** n == value.denominator, f'{value} has no exact rational {n}-th root')
    return Q(a, b)


# ---------------------------------------------------------------- numeric templates
LATEX_NUM = r'(?:-?\d+(?:\.\d+)?|-?\\frac\{-?\d+\}\{\d+\})'


def solve_linear_notation(public):
    prompt = public['prompt']
    plain = re.fullmatch(r'A (?:savings account|reservoir) holds ([\d.]+)(?: thousand liters| dollars)?(?: and ([\d.]+) dollars is added at the end of each week| and loses ([\d.]+) thousand liters each day)\. How many (?:dollars are in the account|thousand liters does it hold) after (\d+) (?:weeks|days)\?', prompt)
    if plain:
        start, step, n = Q(plain[1]), Q(plain[2] or plain[3]), Q(plain[4])
        return start + step * n if plain[2] else start - step * n
    match = re.search(r'\$(?:\\mathrm\{)?([A-Za-z])\(([a-z])\)=([^$]+)\$', prompt)
    require(match is not None, 'Function definition not found')
    name, var, rhs = match[1], match[2], match[3]
    if 'where $c$ is a constant' in prompt:
        arg = num(re.search(rf'If \${name}\((.+?)\)=', prompt)[1])
        out = num(re.search(r'\)=([^$]+)\$, what is the value of \$c\$\?', prompt)[1])
        require(rhs.endswith('+c'), 'Expected form mx+c')
        slope, zero = linear_coeffs(rhs[:-2], var)
        require(zero == 0, 'Unexpected constant in the linear part')
        return out - slope * arg
    value = re.search(rf'What is the value of \${name}(?:\\left)?\((.+?)(?:\\right)?\)\$\?', prompt)
    if value:
        return evaluate(rhs, **{var: num(value[1])})
    target = re.search(rf'(?:For what value of \${var}\$ is|For how many (?:tickets sold|hours) is the (?:profit|total cost)) (?:\${name}\({var}\)=([^$]+)\$|(-?\d+) dollars)\?', prompt)
    require(target is not None, 'Question not recognised')
    out = num(target[1] or target[2])
    slope, base = linear_coeffs(rhs, var)
    require(slope != 0, 'Constant function')
    return (out - base) / slope


def solve_exponential_entry(public):
    prompt = public['prompt']
    match = re.fullmatch(r'For the exponential function \$f\(x\)=(.+?)\\cdot b\^\{x\}\$, where \$b\$ is a positive constant, \$f\((\d+)\)=(\d+)\$\. What is the value of \$f\((\d+)\)\$\?', prompt)
    if match:
        a, k, v, m = num(match[1]), int(match[2]), Q(match[3]), int(match[4])
        require(m > k > 0, 'Asked value must be later than the given one')
        b = nth_root(v / a, k)
        return a * b ** m
    match = re.fullmatch(r'The number of members of an online group (doubles|triples) every (\d+) years\. After (\d+) years the group has (\d+) members\. How many members did it have at the start\?', prompt)
    require(match is not None, 'Exponential prompt not recognised')
    factor = {'doubles': 2, 'triples': 3}[match[1]]
    every, after, total = int(match[2]), int(match[3]), Q(match[4])
    require(after % every == 0, 'Growth period must divide the elapsed time')
    return total / Q(factor) ** (after // every)


def solve_related_value(public):
    prompt = public['prompt']
    match = re.fullmatch(r'If \$x\$ and \$y\$ are nonzero and \$\\frac\{x\}\{y\}=(.+?)\$, what is the value of \$\\frac\{y\}\{x\}\$\?', prompt)
    if match:
        ratio = num(match[1])
        require(ratio != 0, 'x/y = 0 contradicts x nonzero')
        return 1 / ratio
    match = re.fullmatch(r'If \$(.+?)\$, what is the value of \$(.+?)\$\?', prompt)
    require(match is not None, 'Related-value prompt not recognised')
    eq, target = match[1], match[2]
    left, right = equation_sides(eq)
    require(clean(target) not in (clean(left), clean(right)), 'The asked expression is already a side of the given equation')
    if re.search(r'y', eq):
        f = lambda text, x, y: evaluate(text, x=Q(x), y=Q(y))
        a, b = [f(left, 1, 0) - f(left, 0, 0), f(left, 0, 1) - f(left, 0, 0)]
        require(f(left, 0, 0) == 0 and f(right, 0, 0) == f(right, 1, 0) == f(right, 0, 1), 'Expected c1 x + c2 y = constant')
        rhs = f(right, 0, 0)
        c, d = f(target, 1, 0) - f(target, 0, 0), f(target, 0, 1) - f(target, 0, 0)
        require(f(target, 0, 0) == 0, 'Target has a constant term')
        # Determined only when the target is a multiple of the given left side.
        require(a * d == b * c, 'Target is not determined by the given equation')
        require(a != 0, 'Degenerate equation')
        return c / a * rhs
    f = lambda text, x: evaluate(text, x=Q(x))
    slope = (f(left, 1) - f(right, 1)) - (f(left, 0) - f(right, 0))
    require(slope != 0, 'Equation does not determine x')
    x = -(f(left, 0) - f(right, 0)) / slope
    require(f(left, 3) - f(right, 3) == slope * 3 + (f(left, 0) - f(right, 0)), 'Equation is not linear')
    return f(target, x)


# ---------------------------------------------------------------- choice templates
def option_rhs(label):
    require(re.match(r'\$(?:y|f\(x\))=', label) is not None, f'Option is not a y= or f(x)= equation: {label}')
    return label.strip('$').split('=', 1)[1]


def solve_line(public):
    prompt = public['prompt']
    slope = None
    match = re.fullmatch(r'The graph of the linear function \$f\$ has slope \$(.+?)\$ and passes through the point \$\((-?\d+),(-?\d+)\)\$\. Which of the following defines \$f\$\?', prompt)
    if match:
        m, px, py = num(match[1]), Q(match[2]), Q(match[3])
        slope, intercept = m, py - m * px
    match = re.fullmatch(r'A line in the \$xy\$-plane has slope \$(.+?)\$ and passes through the point \$\((-?\d+),(-?\d+)\)\$\. Which equation represents the line\?', prompt)
    if match:
        m, px, py = num(match[1]), Q(match[2]), Q(match[3])
        slope, intercept = m, py - m * px
    match = re.fullmatch(r'A line in the \$xy\$-plane has slope \$(.+?)\$ and a \$y\$-intercept of (-?\d+)\. Which equation represents the line\?', prompt)
    if match:
        slope, intercept = num(match[1]), Q(match[2])
    match = re.fullmatch(r'The water level in a pool (rises|falls) at a constant rate of (\d+) centimeters each hour\. After (\d+) hours the level is (\d+) centimeters?\. Which equation gives the level \$y\$, in centimeters, after \$x\$ hours\?', prompt)
    if match:
        rate = Q(match[2]) * (1 if match[1] == 'rises' else -1)
        slope, intercept = rate, Q(match[4]) - rate * Q(match[3])
    require(slope is not None, 'Line prompt not recognised')
    hits = [o['id'] for o in public['response']['options'] if linear_coeffs(option_rhs(o['label'])) == (slope, intercept)]
    require(len(hits) == 1, f'{len(hits)} options represent y={slope}x+{intercept}')
    return hits[0]


def two_var(label):
    left, right = equation_sides(label.strip('$'))
    f = lambda x, y: evaluate(left, x=Q(x), y=Q(y)) - evaluate(right, x=Q(x), y=Q(y))
    c0 = f(0, 0)
    a, b = f(1, 0) - c0, f(0, 1) - c0
    require(f(2, 3) - c0 == 2 * a + 3 * b and f(-5, 7) - c0 == -5 * a + 7 * b, f'Not linear: {label}')
    return a, b, -c0


def normalise(triple):
    a, b, c = triple
    k = next((v for v in (a, b, c) if v != 0), None)
    require(k is not None, 'Degenerate equation')
    return (a / k, b / k, c / k)


def solve_constraint(public):
    prompt = public['prompt']
    numbers = [Q(n) for n in re.findall(r'\d+', prompt)]
    truck = re.search(r'exactly (\d+) small crates and no large crates, or exactly (\d+) large crates and no small crates', prompt)
    if truck:
        # Full load: x/small_capacity + y/large_capacity = 1.
        target = (1 / Q(truck[1]), 1 / Q(truck[2]), Q(1))
    else:
        require(re.search(r'\$x\$ (?:hours at|small candles|easy)|(?:answering|If) \$x\$', prompt) is not None, 'Variable order not as assumed')
        a, b, total = numbers[0], numbers[1], numbers[-1]
        # Rates are listed in the order of x then y in every wording.
        target = (a, b, total)
    hits = [o['id'] for o in public['response']['options'] if normalise(two_var(o['label'])) == normalise(target)]
    require(len(hits) == 1, f'{len(hits)} options represent the situation')
    return hits[0]


def fn_points_exponential(prompt):
    """Points (input, output) that the defined function must pass through."""
    match = re.search(r'The values are \$f\(0\)=(\d+)\$, \$f\(1\)=(\d+)\$ and \$f\(2\)=([\d.]+)\$', prompt)
    if match:
        return [(0, Q(match[1])), (1, Q(match[2])), (2, Q(match[3]))], 'f', 'x'
    match = re.search(r'contained (\d+) thousand bacteria at the start\. The count is multiplied by the same constant factor each day, and after (\d+) days it was (\d+) thousand', prompt)
    if match:
        a, n, v = Q(match[1]), int(match[2]), Q(match[3])
        b = nth_root(v / a, n)
        return [(0, a), (1, a * b), (n, v)], 'N', 'd'
    match = re.search(r'A tournament has (\d+) teams in round 1\. Each later round has \$\\frac\{1\}\{(\d+)\}\$ as many', prompt)
    if match:
        a, r = Q(match[1]), Q(1, int(match[2]))
        return [(1, a), (2, a * r), (3, a * r * r)], 'f', 'x'
    match = re.search(r'A colony has (\d+) cells at time \$t=0\$\. Each hour the number of cells increases by (\d+)% of the number at the start of that hour', prompt)
    if match:
        a, g = Q(match[1]), 1 + Q(int(match[2]), 100)
        return [(0, a), (1, a * g), (2, a * g * g)], 'f', 't'
    match = re.search(r'A town had (\d+) residents in 2000\. Its population (doubles|triples) every (\d+) years', prompt)
    if match:
        a, g, k = Q(match[1]), {'doubles': 2, 'triples': 3}[match[2]], int(match[3])
        return [(0, a), (k, a * g), (2 * k, a * g * g), (3 * k, a * g ** 3)], 'P', 't'
    raise ValueError('Exponential prompt not recognised')


def float_eval(label, var, x):
    rhs = label.strip('$').split('=', 1)[1]
    s = clean(rhs)
    s = re.sub(r'(\d|\))(?=[a-z(])', r'\1*', s)
    s = re.sub(r'(?<=\))(?=\d)', '*', s)
    s = re.sub(r'(?<=[a-z])(?=\d)', '*', s)
    s = s.replace(var, f'({x})')
    s = re.sub(r'\*\*\(([^()]*)\)', r'**(\1)', s)
    require(re.fullmatch(r'[0-9.+\-*/() ]*', s) is not None, f'Unreadable option {label}')
    return eval(s, {'__builtins__': {}}, {})  # noqa: S307 - sanitized arithmetic only


def solve_exponential_choice(public):
    points, _, var = fn_points_exponential(public['prompt'])
    hits = []
    for option in public['response']['options']:
        try:
            ok = all(isclose(float_eval(option['label'], var, x), float(y), rel_tol=1e-9, abs_tol=1e-9) for x, y in points)
        except (ZeroDivisionError, OverflowError, SyntaxError):
            ok = False
        if ok:
            hits.append(option['id'])
    require(len(hits) == 1, f'{len(hits)} options match the stated values')
    # Distinctness: no two options may agree on all of a probe set.
    probes = [0, 1, 2, 3, 4, 5, 6, 7, 10]
    signatures = []
    for option in public['response']['options']:
        sig = tuple(round(float_eval(option['label'], var, x), 9) for x in probes)
        require(sig not in signatures, 'Two options are the same function')
        signatures.append(sig)
    return hits[0]


# ---------------------------------------------------------------- entry points
def solve(public):
    template = public['templateId']
    if template == 'sat-entry-fn-linear-notation':
        return solve_linear_notation(public)
    if template == 'sat-entry-fn-exponential':
        return solve_exponential_entry(public)
    if template == 'sat-entry-fn-related-value':
        return solve_related_value(public)
    if template == 'sat-fn-line-equation-choice':
        return solve_line(public)
    if template == 'sat-fn-constraint-choice':
        return solve_constraint(public)
    if template == 'sat-fn-exponential-choice':
        return solve_exponential_choice(public)
    raise ValueError(f'Unsupported template {template}')


def review_problem(problem):
    public = problem['public']
    template = public['templateId']
    expected = solve(public)
    answer = problem['answer']
    hint = problem['hint'].replace('−', '-')
    require(isinstance(answer, str), 'Answer must be text')
    if template in CHOICE:
        require(answer == expected, f'Answer key {answer} differs from derived {expected}')
        options = public['response']['options']
        require(public['response']['kind'] == 'choice' and len(options) == 4 and len({o['id'] for o in options}) == 4, 'Four distinct option ids expected')
        require(len({o['label'] for o in options}) == 4, 'Duplicate option labels')
        correct = next(o['label'] for o in options if o['id'] == answer).strip('$')
        require(correct.replace(' ', '') not in hint.replace(' ', '').replace('$', ''), 'Hint states the correct equation')
        feedback = problem.get('choiceFeedback', {})
        require(answer not in feedback and set(feedback) == {o['id'] for o in options} - {answer}, 'Feedback must cover exactly the wrong options')
        return expected
    require(public['response']['kind'] == 'fraction' and problem.get('entryPolicy') == 'sat-spr', 'Numeric entry shape')
    require(answer == canonical(expected), f'Answer key {answer} differs from derived {canonical(expected)}')
    require(re.fullmatch(r'Answer \(fraction, decimal, or whole number\)', public['response']['label']) is not None, 'Unexpected answer label')
    flat_prompt = re.sub(r'\s+', '', public['prompt'].replace('$', '').replace('−', '-'))
    # A hint may not hand over the finished value as an assignment unless it was already given.
    for match in re.finditer(rf'(?:^|[\s(])([a-zA-Z](?:\([^)]*\))?\s*=\s*{re.escape(answer)})(?![\d/.])', hint.replace('$', '')):
        require(re.sub(r'\s+', '', match[1]) in flat_prompt, 'Hint states the answer')
    return expected


def self_test():
    num_public = lambda t, prompt: {'templateId': t, 'prompt': prompt, 'response': {'kind': 'fraction', 'label': 'Answer (fraction, decimal, or whole number)'}}
    numeric = [
        ('sat-entry-fn-linear-notation', 'The function $h$ is defined by $h(x)=\\frac{3}{2}x-13$. What is the value of $h(4)$?', '-7'),
        ('sat-entry-fn-linear-notation', 'The function $p$ is defined by $p(x)=4x+10$. What is the value of $p\\left(-\\frac{3}{4}\\right)$?', '7'),
        ('sat-entry-fn-linear-notation', 'The function $p$ is defined by $p(x)=4(x+1)$. For what value of $x$ is $p(x)=36$?', '8'),
        ('sat-entry-fn-linear-notation', 'The linear function $h$ is defined by $h(x)=-6x+c$, where $c$ is a constant. If $h(-5)=48$, what is the value of $c$?', '18'),
        ('sat-entry-fn-linear-notation', 'A savings account holds 75 dollars and 9 dollars is added at the end of each week. How many dollars are in the account after 12 weeks?', '183'),
        ('sat-entry-fn-linear-notation', 'A club\'s profit, in dollars, from selling $n$ tickets is given by $P(n)=4n-110$. For how many tickets sold is the profit 42 dollars?', '38'),
        ('sat-entry-fn-exponential', 'For the exponential function $f(x)=3\\cdot b^{x}$, where $b$ is a positive constant, $f(2)=12$. What is the value of $f(3)$?', '24'),
        ('sat-entry-fn-exponential', 'The number of members of an online group triples every 2 years. After 4 years the group has 144 members. How many members did it have at the start?', '16'),
        ('sat-entry-fn-related-value', 'If $\\frac{8}{3}x=-24$, what is the value of $4x$?', '-36'),
        ('sat-entry-fn-related-value', 'If $3(x-1)+2=2(x-1)+9$, what is the value of $x-1$?', '7'),
        ('sat-entry-fn-related-value', 'If $10x - 2y=14$, what is the value of $-20x + 4y$?', '-28'),
        ('sat-entry-fn-related-value', 'If $x$ and $y$ are nonzero and $\\frac{x}{y}=\\frac{5}{-5}$, what is the value of $\\frac{y}{x}$?', '-1'),
    ]
    for template, prompt, answer in numeric:
        require(canonical(solve(num_public(template, prompt))) == answer, f'Self-test fixture failed: {prompt}')
        wrong = num_public(template, prompt)
        problem = {'public': wrong, 'answer': canonical(Q(answer) + 1), 'hint': 'Work it out.', 'entryPolicy': 'sat-spr'}
        try:
            review_problem(problem)
        except ValueError:
            pass
        else:
            raise AssertionError(f'Corrupted answer accepted: {prompt}')
    for template, prompt in [
        ('sat-entry-fn-exponential', 'For the exponential function $f(x)=3\\cdot b^{x}$, where $b$ is a positive constant, $f(2)=15$. What is the value of $f(3)$?'),
        ('sat-entry-fn-related-value', 'If $4x + 8y=40$, what is the value of $2x + 5y$?'),
        ('sat-entry-fn-related-value', 'If $7x=-7$, what is the value of $7x$?'),
        ('sat-entry-fn-related-value', 'If $x$ and $y$ are nonzero and $\\frac{x}{y}=\\frac{0}{5}$, what is the value of $\\frac{y}{x}$?'),
    ]:
        try:
            solve(num_public(template, prompt))
        except ValueError:
            continue
        raise AssertionError(f'Undetermined or inexact problem accepted: {prompt}')

    def choice(template, prompt, labels, answer_index):
        options = [{'id': f'option-{c}', 'label': label} for c, label in zip('abcd', labels)]
        public = {'templateId': template, 'prompt': prompt, 'response': {'kind': 'choice', 'label': 'Choose one answer', 'options': options}}
        right = options[answer_index]['id']
        return public, right, options

    line = ('sat-fn-line-equation-choice', 'A line in the $xy$-plane has slope $-6$ and passes through the point $(5,3)$. Which equation represents the line?', ['$y=-6x-27$', '$y=-6x+3$', '$y=-6x-33$', '$y=-6x+33$'], 3)
    constraint = ('sat-fn-constraint-choice', 'A store sold small candles for 3 dollars each and large candles for 17 dollars each. The sales from candles were 540 dollars. If $x$ small candles and $y$ large candles were sold, which equation represents this situation?', ['$17x + 3y=540$', '$\\frac{x}{3}+\\frac{y}{17}=540$', '$(3+17)(x+y)=540$', '$3x + 17y=540$'], 3)
    truck = ('sat-fn-constraint-choice', 'A truck is full when it carries exactly 5 small crates and no large crates, or exactly 3 large crates and no small crates. It is loaded with $x$ small crates and $y$ large crates and is full. Which equation represents this situation?', ['$5x+3y=1$', '$\\frac{x}{3}+\\frac{y}{5}=1$', '$x+y=8$', '$3x + 5y=15$'], 3)
    expo = ('sat-fn-exponential-choice', 'A town had 900 residents in 2000. Its population triples every 5 years. Which function gives the population $P(t)$ $t$ years after 2000?', ['$P(t)=900\\cdot 3^{5t}$', '$P(t)=900\\cdot 3^{\\frac{t}{5}}$', '$P(t)=900\\cdot 5^{\\frac{t}{3}}$', '$P(t)=900+3t$'], 1)
    for template, prompt, labels, index in (line, constraint, truck, expo):
        public, right, options = choice(template, prompt, labels, index)
        require(solve(public) == right, f'Self-test fixture failed: {prompt}')
        for wrong in range(4):
            if wrong == index:
                continue
            problem = {'public': public, 'answer': options[wrong]['id'], 'hint': 'Think.', 'choiceFeedback': {}}
            try:
                review_problem(problem)
            except ValueError:
                continue
            raise AssertionError(f'Wrong choice accepted: {prompt}')
        # Two equivalent options must be rejected as ambiguous.
        duplicate = copy.deepcopy(public)
        duplicate['response']['options'][(index + 1) % 4]['label'] = labels[index]
        try:
            solve(duplicate)
        except ValueError:
            continue
        raise AssertionError(f'Duplicate correct options accepted: {prompt}')


# Read by independent-math-review.py (FamilyOracle).
CHOICE_REVIEW = CHOICE
