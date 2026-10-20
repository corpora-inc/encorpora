"""Independent prompt- and figure-only checks for quadratic and polynomial structure.

Polynomials are read from the display text with algebra_one_expr and handled as
exact coefficient lists recovered by evaluation (Lagrange on integer points);
two expressions are equal when their coefficients agree. Vertices come from
−b/(2a), zeros and multiplicities from exact evaluation and the derivative,
quotients from long division with Fractions. Nothing here calls the TypeScript
generators, and malformed or inconsistent givens are rejected.
"""
import copy
import json
import re
import subprocess
from fractions import Fraction
from pathlib import Path

from algebra_one_expr import evaluate, parse, require, solve_linear
from linear_function_math_oracle import arithmetic_claims

QUADRATIC_STRUCTURE_NUMBER = frozenset({'parabola-axis', 'remainder-theorem'})
QUADRATIC_STRUCTURE_CHOICE = frozenset({
    'parabola-vertex', 'parabola-shift', 'binomial-area-product', 'structure-meaning', 'structure-rewrite',
    'zeros-from-factors', 'zero-multiplicity', 'polynomial-quotient',
})
QUADRATIC_STRUCTURE = QUADRATIC_STRUCTURE_NUMBER | QUADRATIC_STRUCTURE_CHOICE
N = r'(−?\d+)'
DEG = 6


def frac(text):
    return Fraction(text.replace('−', '-'))


def clean(text):
    return text.replace('⁴', '^4').replace('⁰', '^0')


def coefficients(text, var='x'):
    """Ascending exact coefficients of a polynomial written in `var`."""
    node = parse(clean(text))
    xs = list(range(-3, DEG))
    ys = [evaluate(node, {var: x}) for x in xs]
    # Newton differences give the coefficients through a Vandermonde solve.
    n = len(xs)
    rows = [[Fraction(x) ** j for j in range(n)] + [y] for x, y in zip(xs, ys)]
    for col in range(n):
        pivot = next(r for r in range(col, n) if rows[r][col] != 0)
        rows[col], rows[pivot] = rows[pivot], rows[col]
        rows[col] = [v / rows[col][col] for v in rows[col]]
        for r in range(n):
            if r != col and rows[r][col] != 0:
                rows[r] = [a - rows[r][col] * b for a, b in zip(rows[r], rows[col])]
    c = [rows[i][n] for i in range(n)]
    while len(c) > 1 and c[-1] == 0:
        c.pop()
    return c


def value(c, x):
    return sum(v * Fraction(x) ** i for i, v in enumerate(c))


def derivative(c):
    return [i * v for i, v in enumerate(c)][1:] or [Fraction(0)]


def options(public):
    response = public['response']
    require(response['kind'] == 'choice', 'Expected a choice response')
    return [(o['id'], o['label']) for o in response['options']]


def only(public, truth):
    true = []
    for oid, label in options(public):
        try:
            if truth(label):
                true.append(oid)
        except (ValueError, SyntaxError, ZeroDivisionError):
            pass
    require(len(true) == 1, f'Expected exactly one true option, found {len(true)}: {public["prompt"]}')
    return true[0]


def scene_element(public, kind):
    figure = public.get('figure')
    require(figure and figure['kind'] == 'scene', 'Expected a scene figure')
    found = [e for e in figure['scene']['elements'] if e['type'] == kind]
    require(len(found) == 1, f'Expected one {kind}')
    return found[0]


def graph_curve(public, index=0):
    g = scene_element(public, 'graph')
    fn = g['curves'][index]['fn']
    require(fn['f'] == 'poly', 'Expected a polynomial curve')
    return [Fraction(str(v)) for v in fn['c']], g


def pair(label):
    m = re.fullmatch(r'\(' + N + r', ' + N + r'\)', label)
    require(m is not None, 'Not an ordered pair: ' + label)
    return frac(m[1]), frac(m[2])


def equation_rhs(label):
    require(label.startswith('y = '), 'Not an equation: ' + label)
    return label[4:]


def vertex(c):
    require(len(c) == 3 and c[2] != 0, 'Not a quadratic')
    h = -c[1] / (2 * c[2])
    return h, value(c, h)


def integer_zeros(c, lo=-12, hi=12):
    return [x for x in range(lo, hi + 1) if value(c, x) == 0]


# ------------------------------------------------------------ solvers
def solve_parabola_vertex(public):
    prompt = public['prompt']
    if prompt == 'The graph shows a parabola. What is its vertex?':
        c, g = graph_curve(public)
        v = vertex(c)
        require(all(t.denominator == 1 for t in v), 'A graphed vertex sits on a lattice point')
        require(g['x'][0] < v[0] < g['x'][1] and g['y'][0] < v[1] < g['y'][1] and g.get('grid', 1) == 1, 'Vertex readable in the window')
    else:
        m = re.fullmatch(r'What is the vertex of the graph of y = (.+)\?', prompt)
        require(m is not None, 'Unknown vertex prompt')
        v = vertex(coefficients(m[1]))
    return only(public, lambda label: pair(label) == v)


def solve_parabola_axis(public):
    prompt = public['prompt']
    m = re.fullmatch(r'The graph of y = (.+) is a parabola\. Its axis of symmetry is the line x = k\. What is k\?', prompt)
    if m:
        return vertex(coefficients(m[1]))[0]
    m = re.fullmatch(r'The points \(' + N + ', ' + N + r'\) and \(' + N + ', ' + N + r'\) lie on a parabola\. Its axis of symmetry is the line x = k\. What is k\?', prompt)
    if m:
        require(m[2] == m[4] and m[1] != m[3], 'Two distinct points at one height')
        return (frac(m[1]) + frac(m[3])) / 2
    require(prompt.startswith('The graph shows a parabola and the points where it crosses the x-axis.'), 'Unknown axis prompt')
    c, g = graph_curve(public)
    zeros = integer_zeros(c)
    require(len(zeros) == 2 and all(g['x'][0] < z < g['x'][1] for z in zeros), 'Two integer intercepts in view')
    return vertex(c)[0]


def shift_text(h, k):
    unit = lambda v: 'unit' if abs(v) == 1 else 'units'
    return (f'It moves {abs(h)} {unit(h)} {"right" if h > 0 else "left"} and '
            f'{abs(k)} {unit(k)} {"up" if k > 0 else "down"}.').replace('-', '−')


def solve_parabola_shift(public):
    prompt = public['prompt']
    m = re.fullmatch(r'The graph of y = x² is moved (\d+) units? (right|left) and (\d+) units? (up|down)\. Which equation describes the new graph\?', prompt)
    if m:
        h = int(m[1]) * (1 if m[2] == 'right' else -1)
        k = int(m[3]) * (1 if m[4] == 'up' else -1)
        target = [Fraction(h * h + k), Fraction(-2 * h), Fraction(1)]
    elif prompt.startswith('The solid parabola is the dashed graph of y = x² moved'):
        parent, g = graph_curve(public, 0)
        require(parent == [0, 0, 1] and g['curves'][0].get('dash') == 'dash', 'Dashed parent y = x²')
        target, _ = graph_curve(public, 1)
        require(target[2] == 1, 'A translation keeps the shape')
    else:
        m = re.fullmatch(r'How does the graph of y = (.+) compare with the graph of y = x²\?', prompt)
        require(m is not None, 'Unknown shift prompt')
        h, k = vertex(coefficients(m[1]))
        require(coefficients(m[1])[2] == 1, 'A translation keeps the shape')
        return only(public, lambda label: label == shift_text(int(h), int(k)))
    return only(public, lambda label: coefficients(equation_rhs(label)) == target)


def term(t):
    return [Fraction(0)] * t[1] + [Fraction(t[0])]


def multiply(a, b):
    out = [Fraction(0)] * (len(a) + len(b) - 1)
    for i, u in enumerate(a):
        for j, v in enumerate(b):
            out[i + j] += u * v
    return out


def add(a, b):
    n = max(len(a), len(b))
    return [(a[i] if i < len(a) else 0) + (b[i] if i < len(b) else 0) for i in range(n)]


def solve_area_model(public):
    prompt = public['prompt']
    m = re.fullmatch(r'The algebra tiles form a rectangle with sides (.+) and (.+)\. Which expression is its area\?', prompt)
    if m:
        tiles = scene_element(public, 'polyArea')
        side = lambda terms: [Fraction(v) for v in __import__('functools').reduce(add, [term(t) for t in terms])]
        across, down = side(tiles['across']), side(tiles['down'])
        require(across == coefficients(m[1]) and down == coefficients(m[2]), 'Tile sides match the prompt')
        require(tiles.get('products', 'derived') == 'derived', 'Region terms stay unknown')
        target = multiply(across, down)
    else:
        m = (re.fullmatch(r'Which expression is equivalent to (.+)\?', prompt)
             or re.fullmatch(r'A rectangular garden has length (.+) and width (.+), both in meters\. Which expression gives its area in square meters\?', prompt))
        require(m is not None, 'Unknown product prompt')
        target = coefficients(m[1]) if m.lastindex == 1 else multiply(coefficients(m[1]), coefficients(m[2]))
    while len(target) > 1 and target[-1] == 0:
        target.pop()
    return only(public, lambda label: coefficients(label) == target)


def solve_structure_meaning(public):
    prompt = public['prompt']
    m = re.fullmatch(r'A ball is thrown upward\. Its height, in feet, t seconds later is h = (.+)\. What does (\d+) represent\?', prompt)
    if m:
        c = coefficients(m[1], 't')
        asked = Fraction(m[2])
        require(c[2] == -16 and (asked == c[0]) != (asked == c[1]), 'One projectile part asked')
        key = 'when the ball is released' if asked == c[0] else 'upward speed'
        return only(public, lambda label: key in label)
    m = re.fullmatch(r'(?:A plumber|A moving van|A tutor) charges C dollars for ([a-z]) [a-z]+, where C = (\d+) \+ (\d+)\1\. What does (\d+) represent\?', prompt)
    if m:
        fee, rate, asked = int(m[2]), int(m[3]), int(m[4])
        require(fee != rate and asked in (fee, rate), 'One cost part asked')
        key = 'fixed charge' if asked == fee else 'The cost of each'
        return only(public, lambda label: key in label)
    m = re.fullmatch(r"A town's population t years from now is modeled by P = (\d+)\((1\.0\d)\)\^t\. What does (\S+) represent\?", prompt)
    require(m is not None, 'Unknown meaning prompt')
    key = 'multiplied by ' + m[2] if m[3] == m[2] else 'at the start'
    require(m[3] in (m[1], m[2]), 'One growth part asked')
    return only(public, lambda label: key in label)


def solve_structure_rewrite(public):
    prompt = public['prompt']
    m = (re.fullmatch(r'Write (x⁴ − \d+) as a difference of two squares\. Which product is equal to it\?', prompt)
         or re.fullmatch(r'Treat \((x [+−] \d+)\) as a single quantity\. Which product equals (\(x [+−] \d+\)² − \d+)\?', prompt)
         or re.fullmatch(r'Which square is equal to (.+)\?', prompt))
    require(m is not None, 'Unknown rewrite prompt')
    target = coefficients(m[m.lastindex])
    return only(public, lambda label: coefficients(label) == target and ')' in label)


def zero_set(label):
    m = re.fullmatch(r'x = (.+)', label)
    require(m is not None, 'Not a zero set')
    return sorted(frac(v) for v in m[1].split(', '))


def solve_zeros(public):
    prompt = public['prompt']
    m = re.fullmatch(r'What are the zeros of y = (.+)\?', prompt)
    if m:
        c = coefficients(m[1])
        zeros = integer_zeros(c)
        require(len(zeros) == len(c) - 1, 'Every zero is an integer')
        return only(public, lambda label: zero_set(label) == zeros)
    m = re.fullmatch(r'Which polynomial has zeros at (.+) and nowhere else\?', prompt)
    if m:
        zeros = sorted(frac(z) for z in re.findall(r'x = (−?\d+)', m[1]))

        def fits(label):
            c = coefficients(equation_rhs(label))
            return len(c) - 1 == len(zeros) and integer_zeros(c) == zeros
        return only(public, fits)
    require(prompt == 'Which equation could the graph show?', 'Unknown zeros prompt')
    c, g = graph_curve(public)
    require(all(g['x'][0] < z < g['x'][1] for z in integer_zeros(c)), 'Intercepts in view')
    return only(public, lambda label: coefficients(equation_rhs(label)) == c)


def touch_cross(c):
    zeros = integer_zeros(c)
    return [(z, value(derivative(c), z) == 0) for z in zeros]


def describe(c):
    parts = touch_cross(c)
    touch = [z for z, t in parts if t]
    cross = [z for z, t in parts if not t]
    num = lambda z: str(z).replace('-', '−')
    words = [f'touches the x-axis at x = {num(z)}' for z in touch] + [f'crosses it at x = {num(z)}' for z in cross]
    return 'The graph ' + ' and '.join(words) + '.'


def solve_multiplicity(public):
    prompt = public['prompt']
    m = re.fullmatch(r'How does the graph of y = (.+) meet the x-axis\?', prompt)
    if m:
        c = coefficients(m[1])
        require(len(touch_cross(c)) == 2, 'One touching and one crossing zero')
        return only(public, lambda label: label == describe(c))
    m = re.fullmatch(r'A cubic graph touches the x-axis at x = ' + N + ' and crosses it at x = ' + N + r', and nowhere else\. Which equation could it have\?', prompt)
    if m:
        d, s = frac(m[1]), frac(m[2])

        def fits(label):
            c = coefficients(equation_rhs(label))
            return len(c) == 4 and sorted(touch_cross(c)) == sorted([(d, True), (s, False)])
        return only(public, fits)
    require(prompt == 'Which equation could the graph show?', 'Unknown multiplicity prompt')
    c, _ = graph_curve(public)
    require(any(t for _, t in touch_cross(c)), 'The graph touches at one zero')
    return only(public, lambda label: coefficients(equation_rhs(label)) == c)


def divisor_zero(text):
    m = re.fullmatch(r'x ([+−]) (\d+)', text)
    require(m is not None, 'Divisor must be x ± a')
    return Fraction(int(m[2]) * (1 if m[1] == '−' else -1))


def check_tableau(public, a, c):
    t = scene_element(public, 'lineTable')
    top = [cell if isinstance(cell, str) else cell['text'] for cell in t['rows'][0]]
    require(frac(top[0]) == a and [frac(v) for v in top[1:]] == list(reversed(c)), 'Layout matches the divisor and coefficients')
    require(all((cell if isinstance(cell, str) else cell['text']) == '' for row in t['rows'][1:] for cell in row), 'The working rows start empty')


def solve_remainder(public):
    prompt = public['prompt']
    m = re.fullmatch(r'What is the remainder when p\(x\) = (.+) is divided by (x [+−] \d+)\?', prompt)
    if m:
        return value(coefficients(m[1]), divisor_zero(m[2]))
    m = re.fullmatch(r'The layout is set up to divide p\(x\) = (.+) by (x [+−] \d+)\. What is the remainder\?', prompt)
    if m:
        c, a = coefficients(m[1]), divisor_zero(m[2])
        check_tableau(public, a, c)
        return value(c, a)
    m = re.fullmatch(r'For which number k is (x [+−] \d+) a factor of p\(x\) = (.+)\?', prompt)
    require(m is not None, 'Unknown remainder prompt')
    a = divisor_zero(m[1])
    return solve_linear(clean(m[2]) + ' = 0', 'k', {'x': a})


def divide(c, a):
    """Long division of ascending coefficients c by (x − a)."""
    rest = list(reversed(c))
    q = []
    carry = Fraction(0)
    for coeff in rest:
        carry = carry * a + coeff
        q.append(carry)
    remainder = q.pop()
    return list(reversed(q)), remainder


def quotient_label(label):
    m = re.fullmatch(r'(.+), remainder (−?\d+)', label)
    require(m is not None, 'Not a quotient and remainder')
    return coefficients(m[1]), frac(m[2])


def solve_quotient(public):
    prompt = public['prompt']
    m = (re.fullmatch(r'Divide (.+) by (x [+−] \d+)\. What are the quotient and remainder\?', prompt)
         or re.fullmatch(r'Use the layout to divide p\(x\) = (.+) by (x [+−] \d+)\. What are the quotient and remainder\?', prompt))
    if m:
        c, a = coefficients(m[1]), divisor_zero(m[2])
        if prompt.startswith('Use the layout'):
            check_tableau(public, a, c)
    else:
        m = re.fullmatch(r'(.+) = \((x [+−] \d+)\)q\(x\) \+ R for a quadratic q\(x\) and a number R\. What are q\(x\) and R\?', prompt)
        require(m is not None, 'Unknown quotient prompt')
        c, a = coefficients(m[1]), divisor_zero(m[2])
    q, r = divide(c, a)
    require(add(multiply(q, [-a, Fraction(1)]), [r]) == c, 'Division identity')
    return only(public, lambda label: quotient_label(label) == (q, r))


SOLVERS = {
    'parabola-vertex': solve_parabola_vertex,
    'parabola-axis': solve_parabola_axis,
    'parabola-shift': solve_parabola_shift,
    'binomial-area-product': solve_area_model,
    'structure-meaning': solve_structure_meaning,
    'structure-rewrite': solve_structure_rewrite,
    'zeros-from-factors': solve_zeros,
    'zero-multiplicity': solve_multiplicity,
    'remainder-theorem': solve_remainder,
    'polynomial-quotient': solve_quotient,
}


def solve_quadratic_structure(public):
    require(public['templateId'] in SOLVERS, 'Not a quadratic-structure template')
    return SOLVERS[public['templateId']](public)


def review_problem(problem):
    public = problem['public']
    template = public['templateId']
    answer = solve_quadratic_structure(public)
    steps = problem['explanation']
    require(len(steps) >= 2 and problem['hint'], 'Explanation or hint missing')
    checked = sum(arithmetic_claims(step) for step in steps)
    if template in QUADRATIC_STRUCTURE_NUMBER:
        shown = str(answer).replace('-', '−')
        require(re.search(r'(?<![\d/])' + re.escape(shown) + r'(?![\d/])', ' '.join(steps[-2:])), f'The last steps must state the answer {shown}')
    else:
        labels = dict(options(public))
        feedback = problem.get('choiceFeedback') or {}
        require(set(feedback) == set(labels) - {answer}, 'Every wrong option needs feedback')
        math = re.fullmatch(r'[\dxy\s=()+−,²³⁴]+', labels[answer].split(', remainder')[0])
        require(not math or labels[answer].split(', remainder')[0] in ' '.join(steps), 'The explanation reaches the answer')
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


def review_quadratic_structure_fixtures():
    fixtures = [
        (case('parabola-vertex', 'What is the vertex of the graph of y = 2x² − 12x + 13?', choice('(3, −5)', '(−3, 85)', '(3, 13)', '(−5, 3)')), 'option-a'),
        (case('parabola-vertex', 'What is the vertex of the graph of y = −(x + 2)² + 7?', choice('(2, 7)', '(−2, 7)', '(7, −2)', '(−2, −7)')), 'option-b'),
        (case('parabola-vertex', 'The graph shows a parabola. What is its vertex?', choice('(1, −4)', '(−1, −4)', '(−4, 1)', '(1, 4)'),
              scene({'type': 'graph', 'x': [-4, 5], 'y': [-6, 6], 'grid': 1, 'curves': [{'fn': {'f': 'poly', 'c': [-3, -2, 1]}}]})), 'option-a'),
        (case('parabola-axis', 'The graph of y = 3x² + 10x + 8 is a parabola. Its axis of symmetry is the line x = k. What is k?'), Fraction(-5, 3)),
        (case('parabola-axis', 'The points (−4, 7) and (2, 7) lie on a parabola. Its axis of symmetry is the line x = k. What is k?'), Fraction(-1)),
        (case('parabola-shift', 'The graph of y = x² is moved 3 units right and 1 unit down. Which equation describes the new graph?',
              choice('y = (x + 3)² − 1', 'y = (x − 3)² − 1', 'y = (x − 1)² + 3', 'y = (x − 3)² + 1')), 'option-b'),
        (case('parabola-shift', 'How does the graph of y = (x + 2)² + 5 compare with the graph of y = x²?',
              choice('It moves 2 units right and 5 units up.', 'It moves 2 units left and 5 units up.', 'It moves 5 units left and 2 units up.', 'It moves 2 units left and 5 units down.')), 'option-b'),
        (case('binomial-area-product', 'Which expression is equivalent to (2x − 3)(x + 4)?',
              choice('2x² − 12', '2x² + 5x − 12', '2x² + 11x − 12', '2x² + 5x + 12')), 'option-b'),
        (case('structure-meaning', 'A plumber charges C dollars for h hours, where C = 75 + 60h. What does 75 represent?',
              choice('The cost of each hour', 'A fixed charge paid whatever the number of hours', 'The total cost for one hour', 'The number of hours')), 'option-b'),
        (case('structure-rewrite', 'Treat (x + 3) as a single quantity. Which product equals (x + 3)² − 4?',
              choice('(x + 1)(x + 5)', '(x − 5)(x − 1)', '(x + 1)²', '(x − 1)(x + 7)')), 'option-a'),
        (case('zeros-from-factors', 'What are the zeros of y = (x + 2)(x − 1)(x − 4)?',
              choice('x = −4, −1, 2', 'x = −2, 1, 4', 'x = −2, −1, 4', 'x = 2, 1, 4')), 'option-b'),
        (case('zero-multiplicity', 'How does the graph of y = (x − 2)²(x + 1) meet the x-axis?',
              choice('The graph touches the x-axis at x = 2 and crosses it at x = −1.', 'The graph touches the x-axis at x = −1 and crosses it at x = 2.',
                     'The graph crosses the x-axis at x = 2 and at x = −1.', 'The graph touches the x-axis at x = 2 and at x = −1.')), 'option-a'),
        (case('remainder-theorem', 'What is the remainder when p(x) = 2x³ − 3x² + x − 4 is divided by x + 2?'), Fraction(-34)),
        (case('remainder-theorem', 'For which number k is x − 2 a factor of p(x) = x³ + kx − 6?'), Fraction(-1)),
        (case('polynomial-quotient', 'Divide x³ − 2x² − 5x + 6 by x − 3. What are the quotient and remainder?',
              choice('x² + x − 2, remainder 0', 'x² − 5x + 10, remainder −24', 'x² − 2x − 5, remainder 6', 'x² + x − 2, remainder 6')), 'option-a'),
    ]
    for public, expected in fixtures:
        require(solve_quadratic_structure(public) == expected, 'Fixture failed: ' + public['prompt'])
    mutants = [
        case('parabola-vertex', 'What is the vertex of the graph of y = 2x² − 12x + 13?', choice('(3, −5)', '(3, −5)', '(3, 13)', '(−5, 3)')),
        case('parabola-axis', 'The points (−4, 7) and (2, 8) lie on a parabola. Its axis of symmetry is the line x = k. What is k?'),
        case('parabola-vertex', 'The graph shows a parabola. What is its vertex?', choice('(1, −4)', '(−1, −4)', '(−4, 1)', '(1, 4)'),
             scene({'type': 'graph', 'x': [2, 5], 'y': [-6, 6], 'grid': 1, 'curves': [{'fn': {'f': 'poly', 'c': [-3, -2, 1]}}]})),
        case('structure-meaning', 'A plumber charges C dollars for h hours, where C = 60 + 60h. What does 60 represent?',
             choice('The cost of each hour', 'A fixed charge paid whatever the number of hours', 'The total cost for one hour', 'The number of hours')),
        case('remainder-theorem', 'What is the remainder when p(x) = 2x³ − 3x² + x − 4 is divided by 2x + 2?'),
    ]
    for public in mutants:
        try:
            solve_quadratic_structure(public)
        except (ValueError, KeyError, StopIteration):
            continue
        raise ValueError('Malformed fixture accepted: ' + public['prompt'])
    return len(fixtures)


# ------------------------------------------------------------ content
_EXPORT = None


def content(data=None):
    global _EXPORT
    if data is not None:
        return data
    if _EXPORT is None:
        app = Path(__file__).resolve().parent.parent
        _EXPORT = subprocess.check_output(['node', '--import', 'tsx', 'scripts/quadratic-structure-content-oracle.ts'], cwd=app, text=True)
    return json.loads(_EXPORT)


def worked_answer(lesson):
    prompt = lesson['workedExample']['prompt']
    m = re.fullmatch(r'What is the vertex of the graph of y = (.+)\?', prompt)
    if m:
        h, k = vertex(coefficients(m[1]))
        return f'({h}, {k})'.replace('-', '−')
    m = re.fullmatch(r'What is the remainder when p\(x\) = (.+) is divided by (x [+−] \d+)\?', prompt)
    if m:
        return str(value(coefficients(m[1]), divisor_zero(m[2]))).replace('-', '−')
    m = re.fullmatch(r'Which product equals (.+)\?', prompt)
    if m:
        answer = lesson['workedExample']['answer']
        require(coefficients(answer) == coefficients(m[1]), 'Worked rewrite is not equivalent')
        return answer
    m = re.fullmatch(r'Which polynomial has zeros at x = (.+) and nowhere else\?', prompt)
    require(m is not None, 'Unrecognized worked example: ' + lesson['id'])
    zeros = sorted(frac(z) for z in re.split(r', | and ', m[1]))
    answer = lesson['workedExample']['answer']
    c = coefficients(equation_rhs(answer))
    require(len(c) - 1 == len(zeros) and integer_zeros(c) == zeros, 'Worked polynomial has other zeros')
    return answer


def review_scene_illustrations(figures):
    by = {f['kind']: f['scene'] for f in figures}
    g = by['parabola-features']['elements'][0]
    c = [Fraction(v) for v in g['curves'][0]['fn']['c']]
    require(vertex(c) == (1, -4) and integer_zeros(c) == [-1, 3] and g['lines'][0]['line'] == {'x': 1}, 'Parabola features')
    t = by['synthetic-layout']['elements'][0]
    rows = [[cell if isinstance(cell, str) else cell['text'] for cell in row] for row in t['rows']]
    a = frac(rows[0][0])
    coeffs = [frac(v) for v in rows[0][1:]]
    q, r = divide(list(reversed(coeffs)), a)
    require([frac(v) for v in rows[2][1:]] == list(reversed(q)) + [r], 'Synthetic layout sums')
    m = by['multiplicity-touch']['elements'][0]
    mc = [Fraction(v) for v in m['curves'][0]['fn']['c']]
    require(touch_cross(mc) == [(-1, True), (2, False)], 'Touch at −1, cross at 2')
    return len(by)


def review_quadratic_structure_content(data=None):
    data = content(data)
    checked = 0
    for sheet in data['worksheets']:
        problems = sheet['problems']
        require(len(problems) == 12, 'Worksheet length')
        keys = {json.dumps([p['public']['prompt'], p['public'].get('figure'), sorted(o['label'] for o in p['public']['response'].get('options', []))]) for p in problems}
        require(len(keys) == 12, 'Repeated worksheet problem')
        for p in problems:
            solved = solve_quadratic_structure(p['public'])
            require((p['answer'] == solved) if isinstance(solved, str) else Fraction(p['answer']) == solved, 'Worksheet answer mismatch')
            checked += review_problem(p)
    lessons = {lesson['id']: lesson for lesson in data['lessons']}
    require(sorted(t for l in lessons.values() for t in l['templateIds']) == sorted(QUADRATIC_STRUCTURE), 'Every template has one standalone lesson')
    for lesson in lessons.values():
        require(worked_answer(lesson) == lesson['workedExample']['answer'], 'Worked example answer: ' + lesson['id'])
        for text in lesson['workedExample']['steps'] + [p for s in lesson['sections'] for p in s['paragraphs']]:
            checked += arithmetic_claims(text)
    figures = review_scene_illustrations(data['figures'])
    return {'worksheets': len(data['worksheets']), 'checkedClaims': checked, 'lessons': len(lessons), 'figures': figures}


def review_content_mutations():
    data = content()
    mutants = []
    bad = copy.deepcopy(data); bad['lessons'][0]['workedExample']['answer'] = '(−3, −5)'; mutants.append(bad)
    bad = copy.deepcopy(data); bad['lessons'][3]['workedExample']['answer'] = '−30'; mutants.append(bad)
    bad = copy.deepcopy(data); bad['worksheets'][0]['problems'][1] = bad['worksheets'][0]['problems'][0]; mutants.append(bad)
    bad = copy.deepcopy(data); bad['worksheets'][2]['problems'][0]['explanation'].append('A false check: 4 × 3 = 13.'); mutants.append(bad)
    bad = copy.deepcopy(data); bad['figures'][0]['scene']['elements'][0]['lines'][0]['line'] = {'x': 2}; mutants.append(bad)
    for mutant in mutants:
        try:
            review_quadratic_structure_content(mutant)
        except (ValueError, KeyError, TypeError, IndexError):
            continue
        raise ValueError('Content mutant accepted')
    return len(mutants)
