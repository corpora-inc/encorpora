"""Independent prompt- and figure-only checks for Algebra 1 functions and models.

Domains and ranges are found by evaluating the drawn function on a fine exact
grid; function tests count the integer solutions y of each equation for many x;
average rates, models and formulas are evaluated with Fractions from the
display text; rearranged formulas are verified numerically against the
original formula on random assignments. Nothing here calls the TypeScript
generators, and malformed or inconsistent givens are rejected.
"""
import copy
import json
import random
import re
import subprocess
from fractions import Fraction
from pathlib import Path

from algebra_one_expr import evaluate, holds, number, parse, require, solve_linear, variables

LINEAR_FUNCTION_NUMBER = frozenset({
    'average-rate-formula', 'average-rate-display', 'linear-model-value', 'formula-value', 'solution-coordinate',
})
LINEAR_FUNCTION_CHOICE = frozenset({
    'graph-domain-range', 'context-domain-range', 'function-relation-test', 'linear-model-equation',
    'formula-isolate', 'solution-point-choice',
})
LINEAR_FUNCTION = LINEAR_FUNCTION_NUMBER | LINEAR_FUNCTION_CHOICE
N = r'(−?\d+(?:\.\d+)?)'


def options(public):
    response = public['response']
    require(response['kind'] == 'choice', 'Expected a choice response')
    return [(o['id'], o['label']) for o in response['options']]


def only(public, truth):
    true = [oid for oid, label in options(public) if truth(label)]
    require(len(true) == 1, f'Expected exactly one true option, found {len(true)}: {public["prompt"]}')
    return true[0]


def graph_of(public):
    figure = public.get('figure')
    require(figure and figure['kind'] == 'scene', 'Expected a scene figure')
    graphs = [e for e in figure['scene']['elements'] if e['type'] == 'graph']
    require(len(graphs) == 1, 'Expected one graph')
    return graphs[0]


def table_of(public):
    figure = public.get('figure')
    require(figure and figure['kind'] == 'scene', 'Expected a scene figure')
    tables = [e for e in figure['scene']['elements'] if e['type'] == 'table']
    require(len(tables) == 1, 'Expected one table')
    cell = lambda c: c if isinstance(c, str) else c['text']
    return [[cell(c) for c in row] for row in tables[0]['rows']], tables[0]


def fn_value(fn, x):
    """Evaluate a scene function spec exactly."""
    x = Fraction(x)
    if fn['f'] == 'poly':
        return sum(Fraction(str(c)) * x ** i for i, c in enumerate(fn['c']))
    if fn['f'] == 'abs':
        return Fraction(str(fn['a'])) * abs(x - Fraction(str(fn.get('h', 0)))) + Fraction(str(fn.get('k', 0)))
    raise ValueError('Unsupported function family ' + fn['f'])


# ------------------------------------------------------------ arithmetic in prose
TRAIL = re.compile(r'[−(\d|][\d ()×÷+/−²³|.^·]*$')
LEAD = re.compile(r'^\s*[−(\d|][\d ()×÷+/−²³|.^·]*')


def arithmetic_claims(step):
    """Check every 'arithmetic = arithmetic' pair, powers and absolute values
    included; equations between variables are skipped."""
    checked = 0
    parts = step.split(' = ')
    for left, right in zip(parts, parts[1:]):
        a, b = TRAIL.search(left), LEAD.match(right)
        if a is None or b is None:
            continue
        lhs, rhs = a[0].strip(), b[0].strip()
        while rhs and rhs[-1] in '(|.':
            rhs = rhs[:-1].strip()
        end = right.index(rhs) + len(rhs)
        after = right[end:end + 1]
        before = left[:a.start()].rstrip()
        # A partial expression (a variable term before it, or a coefficient
        # or function name glued to it) is not a value.
        if lhs.startswith('− ') or after.isalpha() or after == '(' or (before and before[-1] in '+−×÷·/(-') or (a.start() > 0 and left[a.start() - 1].isalnum()):
            continue
        if not re.search(r'\d', lhs) or not re.search(r'\d', rhs):
            continue
        try:
            lv, rv = evaluate(lhs, {}), evaluate(rhs, {})
        except (SyntaxError, ValueError, ZeroDivisionError):
            continue
        require(lv == rv, 'False arithmetic in explanation: ' + step)
        checked += 1
    return checked


# ------------------------------------------------------------ inequalities as text
def interval(label):
    m = re.fullmatch(N + r' (≤|<) ([xy]) (≤|<) ' + N, label)
    if not m:
        return None
    return (number(m[1]), m[2] == '≤', m[3], m[4] == '≤', number(m[5]))


def solve_graph_domain_range(public):
    m = re.fullmatch(r'The graph shows the whole function f\. What is the (domain|range) of f\?', public['prompt'])
    require(m is not None, 'Unrecognized domain/range prompt')
    g = graph_of(public)
    require(len(g['curves']) == 1, 'One curve')
    c = g['curves'][0]
    a, b = (Fraction(str(v)) for v in c['domain'])
    ends = c.get('ends', ['closed', 'closed'])
    inc = [e == 'closed' for e in ends]
    if m[1] == 'domain':
        want = (a, inc[0], 'x', inc[1], b)
    else:
        # Exact grid of 1/60 steps: the curves here turn only at integers.
        steps = int((b - a) * 60)
        pts = [(a + Fraction(i, 60), fn_value(c['fn'], a + Fraction(i, 60))) for i in range(steps + 1)]
        lo = min(y for _, y in pts)
        hi = max(y for _, y in pts)
        attained = lambda v: any(y == v and ((x != a and x != b) or (x == a and inc[0]) or (x == b and inc[1])) for x, y in pts)
        want = (lo, attained(lo), 'y', attained(hi), hi)
    return only(public, lambda label: interval(label) == want)


# ------------------------------------------------------------ context domain/range
def meaning(label):
    m = re.fullmatch(r'Whole numbers from 0 to (\d+)', label)
    if m: return ('whole', 1, int(m[1]))
    m = re.fullmatch(r'Multiples of (\d+) from 0 to (\d+)', label)
    if m: return ('whole', int(m[1]), int(m[2]))
    m = re.fullmatch(r'All real numbers from 0 to (\d+)', label)
    if m: return ('real', 0, int(m[1]))
    if label == 'All whole numbers':
        return ('whole', 1, None)
    m = re.fullmatch(r'0 ≤ ([A-Za-z]) ≤ (\d+)', label)
    if m: return ('real', 0, int(m[2]), m[1])
    m = re.fullmatch(r'([A-Za-z]) ([≤≥]) (\d+)', label)
    if m: return ('half', m[2], int(m[3]), m[1])
    raise ValueError('Unrecognized description ' + label)


def solve_context_domain_range(public):
    p = public['prompt']
    ask = re.search(r'Which describes the (domain|range) of ([A-Z]) in this situation\?$', p)
    require(ask is not None, 'Unrecognized context prompt')
    counts = [
        r'A van carries at most (\d+) passengers, and each pays \$(\d+)\. The function F\(p\) = (\d+)p gives',
        r'A bakery bakes (\d+) loaves a day and sells them for \$(\d+) each\. The function R\(n\) = (\d+)n gives',
        r'A ferry takes at most (\d+) cars, and each car pays \$(\d+)\. The function T\(c\) = (\d+)c gives',
    ]
    for pattern in counts:
        m = re.match(pattern, p)
        if m:
            cap, price = int(m[1]), int(m[2])
            require(int(m[3]) == price, 'Rule disagrees with the price')
            want = ('whole', 1, cap) if ask[1] == 'domain' else ('whole', price, cap * price)
            return only(public, lambda label: meaning(label)[:3] == want)
    m = re.match(r'An? (\d+)-(liter|centimeter) (tank|candle) (?:drains at|burns) (\d+) (?:liters per minute|centimeters per hour)\. The function ([WL])\(t\) = (\d+) − (\d+)t gives', p)
    require(m is not None, 'Unrecognized context')
    total, rate = int(m[1]), int(m[4])
    require(int(m[6]) == total and int(m[7]) == rate and total % rate == 0, 'Rule disagrees with the story')
    require((m[1][0] == '8' or total in (11, 18)) == p.startswith('An '), 'Article')
    end = total // rate
    var = 't' if ask[1] == 'domain' else m[5]
    top = end if ask[1] == 'domain' else total
    return only(public, lambda label: meaning(label) == ('real', 0, top, var))


# ------------------------------------------------------------ is it a function?
def pair_set(label):
    pairs = re.findall(r'\((−?\d+), (−?\d+)\)', label)
    require(label.startswith('{') and len(pairs) == 4, 'Expected four ordered pairs')
    return [(number(x), number(y)) for x, y in pairs]


def is_function_pairs(pairs):
    out = {}
    for x, y in pairs:
        if x in out and out[x] != y:
            return False
        out[x] = y
    return True


def is_function_equation(text):
    """Count integer y-solutions for each integer x; two for one x is not a function."""
    left, right = text.split(' = ')
    eq = parse(left + ' - (' + right + ')')
    for x in range(-12, 13):
        ys = [y for y in range(-40, 41) if evaluate(eq, {'x': x, 'y': y}) == 0]
        if len(ys) > 1:
            return False
    return True


def solve_function_relation(public):
    m = re.fullmatch(r'Which (relation|equation) (is|is not|defines|does not define) (?:a function of x\? Each ordered pair is \(x, y\)\.|y as a function of x\?)', public['prompt'])
    require(m is not None, 'Unrecognized function prompt')
    want = m[2] in ('is', 'defines')
    if m[1] == 'relation':
        return only(public, lambda label: is_function_pairs(pair_set(label)) == want)
    return only(public, lambda label: is_function_equation(label) == want)


# ------------------------------------------------------------ average rate of change
def rate(f, a, b):
    require(a != b, 'Empty interval')
    return (f(b) - f(a)) / (b - a)


def solve_average_rate_formula(public):
    p = public['prompt']
    m = re.fullmatch(r'A function f has f\(' + N + r'\) = ' + N + r' and f\(' + N + r'\) = ' + N + r'\. What is the average rate of change of f from x = ' + N + ' to x = ' + N + r'\?', p)
    if m:
        require(m[1] == m[5] and m[3] == m[6], 'Interval disagrees with the values')
        return (number(m[4]) - number(m[2])) / (number(m[3]) - number(m[1]))
    m = re.fullmatch(r'For f\(x\) = (.+), what is the average rate of change of f from x = ' + N + ' to x = ' + N + r'\?', p)
    if m:
        f = lambda x: evaluate(m[1], {'x': x})
        return rate(f, number(m[2]), number(m[3]))
    m = re.fullmatch(r"A ball's height, in feet, t seconds after it is thrown up is h\(t\) = (.+)\. Find its average rate of change, in feet per second, from t = " + N + ' to t = ' + N + r'\.', p)
    require(m is not None, 'Unrecognized average-rate prompt')
    f = lambda t: evaluate(m[1], {'t': t})
    a, b = number(m[2]), number(m[3])
    require(f(a) >= 0 and f(b) >= 0, 'The ball is below the ground')
    return rate(f, a, b)


def solve_average_rate_display(public):
    p = public['prompt']
    m = re.fullmatch(r'The graph of y = f\(x\) passes through A at x = ' + N + ' and B at x = ' + N + r'\. What is the average rate of change of f from x = ' + N + ' to x = ' + N + r'\?', p)
    if m:
        require(m[1] == m[3] and m[2] == m[4], 'Interval disagrees with A and B')
        g = graph_of(public)
        fn = g['curves'][0]['fn']
        a, b = number(m[1]), number(m[2])
        pts = {pt['label']: (Fraction(str(pt['x'])), Fraction(str(pt['y']))) for pt in g['points']}
        require(pts['A'] == (a, fn_value(fn, a)) and pts['B'] == (b, fn_value(fn, b)), 'A and B must lie on the curve')
        require([Fraction(str(v)) for v in g['secants'][0]['x']] == [a, b], 'Secant through A and B')
        return rate(lambda x: fn_value(fn, x), a, b)
    rows, spec = table_of(public)
    m = re.fullmatch(r'The table gives values of a function f\. What is the average rate of change of f from x = ' + N + ' to x = ' + N + r'\?', p)
    if m:
        require(rows[0][0] == 'x' and rows[1][0] == 'f(x)', 'Table headings')
        a, b = m[1], m[2]
    else:
        m = re.fullmatch(r'The table shows (?:the temperature T, in degrees Fahrenheit, h hours after 6 a\.m\. What is the average rate of change of T, in degrees per hour, from h = (\d+) to h = (\d+)\?|a town\'s population P, in thousands, in each year\. What is the average rate of change of P, in thousands per year, from (\d+) to (\d+)\?)', p)
        require(m is not None, 'Unrecognized table prompt')
        a, b = (m[1], m[2]) if m[1] else (m[3], m[4])
        require(rows[0][0] in ('h', 'Year'), 'Table headings')
    xs = [number(v) for v in rows[0][1:]]
    ys = [number(v) for v in rows[1][1:]]
    i, j = xs.index(number(a)), xs.index(number(b))
    require(sorted(spec.get('highlight', [])) == [i + 1, j + 1], 'The interval columns must be shaded')
    return (ys[j] - ys[i]) / (xs[j] - xs[i])


# ------------------------------------------------------------ linear models
def solve_linear_model_value(public):
    p = public['prompt']
    money = [int(v) for v in re.findall(r'\$(\d+)', p)]
    if 'cost the same' in p:
        m = re.fullmatch(r'.+ \$(\d+) plus \$(\d+) per (\w+)\. .+ \$(\d+) plus \$(\d+) per \3\. After how many \w+ do they cost the same\?', p)
        require(m is not None, 'Unrecognized two-plan prompt')
        a1, b1, a2, b2 = int(m[1]), int(m[2]), int(m[4]), int(m[5])
        return Fraction(a1 - a2, b2 - b1)
    if 'perimeter' in p:
        m = re.fullmatch(r"A rectangle's length is (\d+) cm more than (?:its width|(twice|three times) its width)\. Its perimeter is (\d+) cm\. What is its width, in centimeters\?", p)
        require(m is not None, 'Unrecognized perimeter prompt')
        c = {None: 1, 'twice': 2, 'three times': 3}[m[2]]
        return solve_linear(f'{m[3]} = 2*(({c})*w + {m[1]} + w)', 'w', {})
    if 'greatest' in p:
        require(len(money) == 3, 'Expected three amounts')
        e, r, b = money
        # Count up until the next unit no longer fits.
        k = 0
        while e + r * (k + 1) <= b:
            k += 1
        return Fraction(k)
    require(len(money) == 3, 'Expected a fee, a rate and a total')
    fee, r, total = money
    k = Fraction(total - fee, r)
    require(k.denominator == 1 and k > 0, 'Not a whole count')
    return k


def line_from_table(rows):
    xs = [number(v) for v in rows[0][1:]]
    ys = [number(v) for v in rows[1][1:]]
    m = (ys[1] - ys[0]) / (xs[1] - xs[0])
    require(all(ys[i] - ys[0] == m * (xs[i] - xs[0]) for i in range(len(xs))), 'Table is not linear')
    return m, ys[0] - m * xs[0]


def solve_linear_model_equation(public):
    p = public['prompt']
    m = re.search(r'Which equation gives ([A-Z]) in terms of ([a-z])\?$', p)
    require(m is not None, 'Unrecognized model prompt')
    Y, X = m[1], m[2]
    if p.startswith('The graph shows'):
        g = graph_of(public)
        fn = g['curves'][0]['fn']
        require(fn['f'] == 'poly' and len(fn['c']) == 2 and g['axisNames'] == [X, Y], 'Expected a line with named axes')
        b, slope = (Fraction(str(v)) for v in fn['c'])
    elif p.startswith('The table shows'):
        rows, _ = table_of(public)
        require(rows[0][0] == X and rows[1][0] == Y, 'Table headings')
        slope, b = line_from_table(rows)
    else:
        story = [
            (r'A taxi charges \$(\d+) plus \$(\d+) per mile\.', 1),
            (r'A plant is (\d+) cm tall when planted and grows (\d+) cm each week\.', 1),
            (r'A candle is (\d+) cm long and burns (\d+) cm each hour\.', -1),
        ]
        for pattern, sign in story:
            s = re.match(pattern, p)
            if s:
                b, slope = Fraction(int(s[1])), sign * Fraction(int(s[2]))
                break
        else:
            raise ValueError('Unrecognized model story')
    def matches(label):
        lhs, rhs = label.split(' = ')
        require(lhs == Y, 'Option must give ' + Y)
        return all(evaluate(rhs, {X: v}) == slope * v + b for v in (0, 1, 5))
    return only(public, matches)


# ------------------------------------------------------------ formulas
FORMULA_VARS = re.compile(r'gives ([A-Za-z]) in terms of (.+)\?$')


def solve_formula_isolate(public):
    p = public['prompt']
    m = re.fullmatch(r'The formula (.+?) gives .+\. Which formula gives ([A-Za-z]) in terms of (.+)\?', p)
    require(m is not None, 'Unrecognized formula prompt')
    original, target = m[1], m[2]
    others = re.split(r', | and ', m[3])
    require(sorted(others + [target]) == sorted(variables(original.replace(' = ', ' + '))), 'Variables named do not match the formula')
    rng = random.Random(p)

    def isolates(label):
        lhs, rhs = label.split(' = ')
        require(lhs == target and target not in variables(rhs), 'Option must isolate ' + target)
        for _ in range(4):
            env = {v: Fraction(rng.randint(2, 19), rng.choice([1, 1, 2, 3])) for v in others}
            try:
                env[target] = evaluate(rhs, env)
            except ValueError:
                return False
            if not holds(original, env):
                return False
        return True
    return only(public, isolates)


def solve_formula_value(public):
    p = public['prompt']
    forms = [
        (r"A rectangle's perimeter is P = 2l \+ 2w\. Find the width w when P = (\d+) and the length l = (\d+)\.", 'P = 2l + 2w', 'w', ('P', 'l')),
        (r'Temperatures satisfy F = 9C/5 \+ 32\. What Celsius temperature C equals ' + N + r' degrees Fahrenheit\?', 'F = 9C/5 + 32', 'C', ('F',)),
        (r"A trapezoid's area is A = ½\(b₁ \+ b₂\)h\. Find the height h when A = (\d+), b₁ = (\d+) and b₂ = (\d+)\.", 'A = ½(b₁ + b₂)h', 'h', ('A', 'b_1', 'b_2')),
        (r"A cart's speed is v = u \+ at\. Find its acceleration a when v = (\d+), u = (\d+) and t = (\d+)\.", 'v = u + at', 'a', ('v', 'u', 't')),
        (r'Simple interest is I = Prt\. Find the time t, in years, when I = (\d+), P = (\d+) and r = ([\d.]+)\.', 'I = Prt', 't', ('I', 'P', 'r')),
    ]
    for pattern, formula, unknown, names in forms:
        m = re.fullmatch(pattern, p)
        if m:
            env = {name: number(m[i + 1]) for i, name in enumerate(names)}
            v = solve_linear(formula, unknown, env)
            require(v > 0 or unknown == 'C', 'A length, rate or time must be positive')
            return v
    raise ValueError('Unrecognized formula-value prompt')


# ------------------------------------------------------------ graphs as solution sets
def point(label):
    m = re.fullmatch(r'\(' + N + ', ' + N + r'\)', label)
    require(m is not None, 'Not an ordered pair: ' + label)
    return number(m[1]), number(m[2])


def solve_solution_point(public):
    m = re.fullmatch(r'Which point is on the graph of (.+)\?', public['prompt'])
    require(m is not None, 'Unrecognized point prompt')
    eq = m[1]
    return only(public, lambda label: holds(eq, dict(zip(('x', 'y'), point(label)))))


def solve_solution_coordinate(public):
    m = re.fullmatch(r'The point \((k|' + N + '), (k|' + N + r')\) is on the graph of (.+)\. What is k\?', public['prompt'])
    require(m is not None and (m[1] == 'k') != (m[3] == 'k'), 'Unrecognized coordinate prompt')
    eq = m[5]
    known = number(m[2] if m[2] else m[4])
    env = {'y': known} if m[1] == 'k' else {'x': known}
    unknown = 'x' if m[1] == 'k' else 'y'
    k = solve_linear(eq, unknown, env)
    g = graph_of(public)
    if g.get('lines'):
        ln = g['lines'][0]['line']
        require(all(holds(eq, {'x': x, 'y': (ln['c'] - ln['a'] * x) / Fraction(ln['b'])}) for x in (Fraction(-3), Fraction(5))), 'Drawn line differs from the equation')
    else:
        fn = g['curves'][0]['fn']
        require(all(holds(eq, {'x': x, 'y': fn_value(fn, x)}) for x in range(-3, 4)), 'Drawn curve differs from the equation')
    seg = g['segments'][0]
    axis = 0 if unknown == 'y' else 1
    require(Fraction(str(seg['from'][axis])) == known == Fraction(str(seg['to'][axis])), 'The dashed guide must sit at the known coordinate')
    return k


SOLVERS = {
    'graph-domain-range': solve_graph_domain_range,
    'context-domain-range': solve_context_domain_range,
    'function-relation-test': solve_function_relation,
    'average-rate-formula': solve_average_rate_formula,
    'average-rate-display': solve_average_rate_display,
    'linear-model-value': solve_linear_model_value,
    'linear-model-equation': solve_linear_model_equation,
    'formula-isolate': solve_formula_isolate,
    'formula-value': solve_formula_value,
    'solution-point-choice': solve_solution_point,
    'solution-coordinate': solve_solution_coordinate,
}


def solve_linear_function(public):
    require(public['templateId'] in SOLVERS, 'Not an Algebra 1 function template')
    return SOLVERS[public['templateId']](public)


def review_problem(problem):
    public = problem['public']
    template = public['templateId']
    answer = solve_linear_function(public)
    steps = problem['explanation']
    require(len(steps) >= 2 and problem['hint'], 'Explanation or hint missing')
    checked = sum(arithmetic_claims(step) for step in steps)
    if template in LINEAR_FUNCTION_NUMBER:
        require(checked >= 1, 'Explanation has no checked arithmetic: ' + template)
        shown = str(answer).replace('-', '−')
        require(re.search(r'(?<![\d/])' + re.escape(shown) + r'(?![\d/])', ' '.join(steps[-2:])), f'The last steps must state the answer {shown}')
    else:
        labels = dict(options(public))
        feedback = problem.get('choiceFeedback') or {}
        require(set(feedback) == set(labels) - {answer}, 'Every wrong option needs feedback')
    return checked


# ------------------------------------------------------------ fixtures
def case(template, prompt, response=None, figure=None):
    public = {'templateId': template, 'prompt': prompt, 'response': response or {'kind': 'number'}}
    if figure is not None:
        public['figure'] = figure
    return public


def choice(*labels):
    return {'kind': 'choice', 'options': [{'id': f'option-{"abcd"[i]}', 'label': label} for i, label in enumerate(labels)]}


def scene(*elements):
    return {'kind': 'scene', 'scene': {'v': 1, 'elements': list(elements)}}


def review_linear_function_fixtures():
    parabola = scene({'type': 'graph', 'x': [-7, 7], 'y': [-7, 7], 'curves': [{'fn': {'f': 'poly', 'c': [-1, -2, 1]}, 'domain': [-2, 4], 'ends': ['closed', 'closed']}]})
    line = scene({'type': 'graph', 'x': [-7, 7], 'y': [-7, 7], 'curves': [{'fn': {'f': 'poly', 'c': [1, -1]}, 'domain': [-3, 4], 'ends': ['closed', 'open']}]})
    secant = scene({'type': 'graph', 'x': [-6, 6], 'y': [-8, 8], 'curves': [{'fn': {'f': 'poly', 'c': [-1, -2, 1]}}], 'secants': [{'curve': 0, 'x': [1, 4]}],
                    'points': [{'x': 1, 'y': -2, 'label': 'A'}, {'x': 4, 'y': 7, 'label': 'B'}]})
    taxi = scene({'type': 'table', 'rows': [['d', '1', '2', '3', '4'], ['F', '5', '7', '9', '11']]})
    fixtures = [
        (case('graph-domain-range', 'The graph shows the whole function f. What is the range of f?', choice('−2 ≤ y ≤ 7', '−1 ≤ y ≤ 7', '−2 ≤ x ≤ 4', '−2 < y < 7'), parabola), 'option-a'),
        (case('graph-domain-range', 'The graph shows the whole function f. What is the range of f?', choice('−3 < y ≤ 4', '−3 ≤ y < 4', '−3 ≤ y ≤ 4', '−4 < y ≤ 3'), line), 'option-a'),
        (case('graph-domain-range', 'The graph shows the whole function f. What is the domain of f?', choice('−3 < x ≤ 4', '−3 ≤ x < 4', '−3 ≤ x ≤ 4', '−3 < y ≤ 4'), line), 'option-b'),
        (case('context-domain-range', 'A van carries at most 12 passengers, and each pays $5. The function F(p) = 5p gives the fares collected from p passengers. Which describes the range of F in this situation?',
              choice('Whole numbers from 0 to 60', 'Multiples of 5 from 0 to 60', 'All real numbers from 0 to 60', 'Whole numbers from 0 to 12')), 'option-b'),
        (case('context-domain-range', 'An 800-liter tank drains at 25 liters per minute. The function W(t) = 800 − 25t gives the water left after t minutes, until the tank is empty. Which describes the domain of W in this situation?',
              choice('0 ≤ t ≤ 800', '0 ≤ t ≤ 32', 't ≥ 0', 'Whole numbers from 0 to 32')), 'option-b'),
        (case('function-relation-test', 'Which relation is a function of x? Each ordered pair is (x, y).',
              choice('{(1, 4), (2, 5), (1, 6), (3, 0)}', '{(1, 4), (2, 4), (3, 4), (5, 0)}', '{(0, 0), (0, 1), (2, 2), (3, 3)}', '{(−1, 2), (4, 2), (−1, 3), (6, 1)}')), 'option-b'),
        (case('function-relation-test', 'Which equation does not define y as a function of x?', choice('y = x² − 4', 'x = |y| + 1', 'y = |x − 2|', 'y = 3x + 1')), 'option-b'),
        (case('average-rate-formula', 'For f(x) = x² − 2x − 1, what is the average rate of change of f from x = 1 to x = 4?'), Fraction(3)),
        (case('average-rate-formula', 'For f(x) = 3 · 2^x, what is the average rate of change of f from x = 1 to x = 4?'), Fraction(14)),
        (case('average-rate-formula', "A ball's height, in feet, t seconds after it is thrown up is h(t) = −16t² + 64t + 5. Find its average rate of change, in feet per second, from t = 1 to t = 3."), Fraction(0)),
        (case('average-rate-display', 'The graph of y = f(x) passes through A at x = 1 and B at x = 4. What is the average rate of change of f from x = 1 to x = 4?', figure=secant), Fraction(3)),
        (case('linear-model-value', 'A gym charges a $40 joining fee plus $25 per month. Maya has paid $315 in all. For how many months has she been a member?'), Fraction(11)),
        (case('linear-model-value', 'Phone plan A costs $30 plus $12 per month. Plan B costs $6 plus $18 per month. After how many months do they cost the same?'), Fraction(4)),
        (case('linear-model-value', "A rectangle's length is 3 cm more than twice its width. Its perimeter is 54 cm. What is its width, in centimeters?"), Fraction(8)),
        (case('linear-model-value', 'A fair charges $7 to enter and $4 per ride. Ana has $60. What is the greatest number of rides she can take?'), Fraction(13)),
        (case('linear-model-equation', 'The table shows a linear relationship. F is the fare, in dollars, for a ride of d miles. Which equation gives F in terms of d?',
              choice('F = 3d + 2', 'F = 2d + 3', 'F = 5d', 'F = 2d − 3'), taxi), 'option-b'),
        (case('formula-isolate', 'The formula A = ½bh gives the area A of a triangle with base b and height h. Which formula gives h in terms of A and b?',
              choice('h = A/(2b)', 'h = 2A/b', 'h = 2b/A', 'h = 2A − b')), 'option-b'),
        (case('formula-isolate', 'The formula F = 9C/5 + 32 gives a temperature F in degrees Fahrenheit from C in degrees Celsius. Which formula gives C in terms of F?',
              choice('C = 5F/9 − 32', 'C = 9(F − 32)/5', 'C = 5(F − 32)/9', 'C = (5F − 32)/9')), 'option-c'),
        (case('formula-value', "A trapezoid's area is A = ½(b₁ + b₂)h. Find the height h when A = 60, b₁ = 7 and b₂ = 5."), Fraction(10)),
        (case('formula-value', 'Simple interest is I = Prt. Find the time t, in years, when I = 288, P = 1200 and r = 0.08.'), Fraction(3)),
        (case('solution-point-choice', 'Which point is on the graph of 3x − 2y = 12?', choice('(2, 3)', '(2, −3)', '(−2, 3)', '(3, 2)')), 'option-b'),
        (case('solution-point-choice', 'Which point is on the graph of y = |x − 2| + 1?', choice('(−1, 4)', '(4, −1)', '(−1, 2)', '(1, 4)')), 'option-a'),
    ]
    for public, expected in fixtures:
        require(solve_linear_function(public) == expected, 'Independent handwritten mismatch: ' + public['prompt'])
    bad = [
        case('graph-domain-range', 'The graph shows the whole function f. What is the range of f?', choice('−1 ≤ y ≤ 7', '−2 ≤ x ≤ 4', '−2 < y < 7', '−3 ≤ y ≤ 7'), parabola),
        case('context-domain-range', 'A 800-liter tank drains at 25 liters per minute. The function W(t) = 800 − 25t gives the water left after t minutes, until the tank is empty. Which describes the domain of W in this situation?',
             choice('0 ≤ t ≤ 800', '0 ≤ t ≤ 32', 't ≥ 0', 'Whole numbers from 0 to 32')),
        case('context-domain-range', 'A van carries at most 12 passengers, and each pays $5. The function F(p) = 6p gives the fares collected from p passengers. Which describes the domain of F in this situation?',
             choice('Whole numbers from 0 to 12', 'All real numbers from 0 to 12', 'Whole numbers from 0 to 60', 'All whole numbers')),
        case('function-relation-test', 'Which equation does not define y as a function of x?', choice('x = y² − 4', 'x = |y| + 1', 'y = |x − 2|', 'y = 3x + 1')),
        case('average-rate-display', 'The graph of y = f(x) passes through A at x = 1 and B at x = 3. What is the average rate of change of f from x = 1 to x = 4?', figure=secant),
        case('linear-model-value', 'A gym charges a $40 joining fee plus $25 per month. Maya has paid $316 in all. For how many months has she been a member?'),
        case('linear-model-equation', 'The table shows a linear relationship. F is the fare, in dollars, for a ride of d miles. Which equation gives F in terms of d?',
             choice('F = 3d + 2', 'F = 2d + 4', 'F = 5d', 'F = 2d − 3'), taxi),
        case('formula-isolate', 'The formula A = ½bh gives the area A of a triangle with base b and height h. Which formula gives h in terms of A and b?',
             choice('h = A/(2b)', 'h = 2A/b', 'h = 2b/A', 'h = (2A)/b')),
        case('solution-point-choice', 'Which point is on the graph of 3x − 2y = 12?', choice('(2, 3)', '(4, 0)', '(−2, 3)', '(0, −6)')),
    ]
    for public in bad:
        try:
            solve_linear_function(public)
        except (ValueError, KeyError, TypeError, IndexError, ZeroDivisionError):
            continue
        raise ValueError('Malformed or inconsistent prompt accepted: ' + public['prompt'])
    return {'handwritten': len(fixtures), 'mutants': len(bad)}


# ------------------------------------------------------------ authored content
_EXPORT = None


def content(data=None):
    global _EXPORT
    if data is not None:
        return data
    if _EXPORT is None:
        app = Path(__file__).resolve().parent.parent
        _EXPORT = subprocess.check_output(['node', '--import', 'tsx', 'scripts/linear-function-content-oracle.ts'], cwd=app, text=True)
    return json.loads(_EXPORT)


def worked_answer(lesson):
    """Recompute each worked example from its own prompt."""
    prompt = lesson['workedExample']['prompt']
    m = re.fullmatch(r'An? (\d+)-liter tank drains at (\d+) liters per minute\. W\(t\) = \1 − \2t gives the water left after t minutes, until the tank is empty\. What is the domain of W\?', prompt)
    if m:
        return f'0 ≤ t ≤ {solve_linear(f"0 = {m[1]} - {m[2]}t", "t", {})}'
    for template in ('average-rate-formula', 'linear-model-value', 'formula-value', 'solution-coordinate'):
        try:
            if template == 'solution-coordinate':
                m = re.fullmatch(r'The point \((\d+), k\) is on the graph of (.+)\. What is k\?', prompt)
                require(m is not None, 'not this form')
                return str(solve_linear(m[2], 'y', {'x': int(m[1])}))
            return str(SOLVERS[template](case(template, prompt)))
        except (ValueError, KeyError):
            continue
    raise ValueError('Unrecognized worked example: ' + lesson['id'])


def review_scene_illustrations(figures):
    by = {f['kind']: f['scene'] for f in figures}
    g = by['domain-range-axes']['elements'][0]
    fn, (a, b) = g['curves'][0]['fn'], g['curves'][0]['domain']
    require(fn_value(fn, a) == 6 and fn_value(fn, 1) == -2 and fn_value(fn, b) == Fraction(5, 2), 'Domain/range illustration values')
    sec = by['average-rate-secant']['elements'][0]
    f2 = sec['curves'][0]['fn']
    tri = sec['slopeTriangles'][0]
    require(tuple(tri['from']) == (1, fn_value(f2, 1)) and tuple(tri['to']) == (4, fn_value(f2, 4)), 'Secant triangle on the curve')
    sol = by['solution-set-line']['elements'][0]
    ln = sol['lines'][0]['line']
    for pt in sol['points']:
        on = ln['a'] * pt['x'] + ln['b'] * pt['y'] == ln['c']
        require(on != bool(pt.get('open')), 'Solution points are filled, the non-solution is open')
    lm = by['linear-model-graph']['elements'][0]
    require(lm['curves'][0]['fn']['c'] == [3, 2] and lm['points'][0]['y'] == 3, 'Model graph F = 2d + 3')
    return len(by)


def review_linear_function_content(data=None):
    data = content(data)
    checked = 0
    for sheet in data['worksheets']:
        problems = sheet['problems']
        require(len(problems) == 12, 'Worksheet length')
        keys = {json.dumps([p['public']['prompt'], p['public'].get('figure'), sorted(o['label'] for o in p['public']['response'].get('options', []))]) for p in problems}
        require(len(keys) == 12, 'Repeated worksheet problem')
        for p in problems:
            solved = solve_linear_function(p['public'])
            require((p['answer'] == solved) if isinstance(solved, str) else Fraction(p['answer']) == solved, 'Worksheet answer mismatch')
            checked += review_problem(p)
    lessons = {lesson['id']: lesson for lesson in data['lessons']}
    require(sorted(t for l in lessons.values() for t in l['templateIds']) == sorted(LINEAR_FUNCTION), 'Every template has one standalone lesson')
    for lesson in lessons.values():
        require(worked_answer(lesson) == lesson['workedExample']['answer'], 'Worked example answer: ' + lesson['id'])
        for text in lesson['workedExample']['steps'] + [p for s in lesson['sections'] for p in s['paragraphs']]:
            checked += arithmetic_claims(text)
    figures = review_scene_illustrations(data['figures'])
    return {'worksheets': len(data['worksheets']), 'checkedClaims': checked, 'lessons': len(lessons), 'figures': figures}


def review_content_mutations():
    data = content()
    mutants = []
    bad = copy.deepcopy(data); bad['lessons'][0]['workedExample']['answer'] = '0 ≤ t ≤ 300'; mutants.append(bad)
    bad = copy.deepcopy(data); bad['lessons'][2]['workedExample']['answer'] = '12'; mutants.append(bad)
    bad = copy.deepcopy(data); bad['worksheets'][0]['problems'][1] = bad['worksheets'][0]['problems'][0]; mutants.append(bad)
    bad = copy.deepcopy(data); bad['worksheets'][4]['problems'][0]['explanation'].append('A false check: 4 × 3 = 13.'); mutants.append(bad)
    bad = copy.deepcopy(data); bad['lessons'][1]['sections'][0]['paragraphs'][1] += ' So 9 ÷ 3 = 4.'; mutants.append(bad)
    bad = copy.deepcopy(data); bad['figures'][0]['scene']['elements'][0]['curves'][0]['domain'] = [-2, 4]; mutants.append(bad)
    for mutant in mutants:
        try:
            review_linear_function_content(mutant)
        except (ValueError, KeyError, TypeError, IndexError):
            continue
        raise ValueError('Content mutant accepted')
    return len(mutants)
