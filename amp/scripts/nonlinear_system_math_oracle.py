"""Independent exact checks of the public line/parabola equations and graph.

No generator parameters, seed derivation, tags or answer key enter the solver.
Coefficients are parsed from the displayed equations; roots use the quadratic
formula rather than the generator's chosen factorization.
"""
import copy
import re
from fractions import Fraction as Q
import math
from math import isqrt

from algebra_one_expr import require

NONLINEAR_SYSTEM = frozenset({
    'nonlinear-system-read', 'nonlinear-system-solve', 'nonlinear-system-count',
})


def polynomial(text):
    """Read the restricted, fully displayed integer polynomial, rejecting junk."""
    text = text.replace('−', '-').replace(' ', '').replace('²', '^2')
    terms = re.findall(r'[+-]?(?:\d*x(?:\^2)?|\d+)', text)
    require(''.join(terms) == text and bool(terms), 'Unreadable polynomial')
    coefficients = [Q(0), Q(0), Q(0)]
    for term in terms:
        power = 2 if term.endswith('x^2') else 1 if term.endswith('x') else 0
        coefficient = term.split('x')[0] if power else term
        coefficients[power] += Q({'': '1', '+': '1', '-': '-1'}.get(coefficient, coefficient))
    return coefficients


def _reduced(n, d):
    g = math.gcd(abs(n), abs(d))
    n, d = n // g, d // g
    if d < 0:
        n, d = -n, -d
    return Q(n, d)


def _parse_rhs(text):
    """Linear expression mx+b, including a TeX fraction coefficient."""
    s = text.replace("−", "-").replace(" ", "")
    if s == "":
        raise ValueError("Empty line")
    m = Q(0)
    rest = s
    frac = re.match(r"(-)?\\frac\{(\d+)\}\{(\d+)\}x", rest)
    if frac:
        m = _reduced((1 if frac[1] is None else -1) * int(frac[2]), int(frac[3]))
        rest = rest[frac.end():]
    elif re.match(r"-?(\d*)x", rest):
        head = re.match(r"(-)?(\d*)x", rest)
        coef = head[2]
        sign = -1 if head[1] else 1
        m = Q(sign * (int(coef) if coef else 1))
        rest = rest[head.end():]
    if rest == "":
        b = Q(0)
    else:
        bfrac = re.fullmatch(r"([+-])?\\frac\{(\d+)\}\{(\d+)\}", rest)
        if bfrac:
            sign = -1 if bfrac[1] == "-" else 1
            b = _reduced(sign * int(bfrac[2]), int(bfrac[3]))
        else:
            b = Q(rest)
    return m, b


def _rational_sqrt(disc):
    require(disc >= 0, "Negative discriminant")
    n, d = math.isqrt(disc.numerator), math.isqrt(disc.denominator)
    require(n * n == disc.numerator and d * d == disc.denominator, "Intersections must be rational")
    return Q(n, d)


def _on_grid(x, y):
    require(x.denominator == 1 and y.denominator == 1, "Intersection is not a lattice point")
    require(-8 <= x <= 8 and -10 <= y <= 10, "Point outside the grid")


def _intersections(first, second):
    first = first.replace("−", "-").replace(" ", "")
    second = second.replace("−", "-")
    circle = re.fullmatch(r"x\^2\+y\^2=(\d+)", first)
    if circle:
        radius2 = Q(int(circle[1]))
        require(second.startswith("y = ") or second.startswith("y="), "Circle paired with a line")
        rhs = second.split("=", 1)[1]
        m, b = _parse_rhs(rhs)
        # x^2 + (mx+b)^2 = r^2
        A = 1 + m * m
        B = 2 * m * b
        C = b * b - radius2
        root = _rational_sqrt(B * B - 4 * A * C)
        xs = sorted({(-B - root) / (2 * A), (-B + root) / (2 * A)})
        points = [(x, m * x + b) for x in xs]
        for x, y in points:
            require(x * x + y * y == radius2, "Point misses the circle")
            _on_grid(x, y)
        return points
    require(first.startswith("y=") or first.startswith("y ="), "Expected y = parabola")
    require(second.startswith("y=") or second.startswith("y ="), "Expected y = line")
    quad = polynomial(first.split("=", 1)[1])
    line = polynomial(second.split("=", 1)[1])
    require(quad[2] != 0 and line[2] == 0, "Expected a parabola and a line")
    C, B, A = [q - l for q, l in zip(quad, line)]
    root = _rational_sqrt(B * B - 4 * A * C)
    xs = sorted({(-B - root) / (2 * A), (-B + root) / (2 * A)})
    points = [(x, line[0] + line[1] * x) for x in xs]
    for x, y in points:
        require(quad[0] + quad[1] * x + quad[2] * x * x == y, "Point misses the parabola")
        _on_grid(x, y)
    return points


def _plot_answer(public):
    prompt = public["prompt"].replace("−", "-")
    match = re.fullmatch(
        r"The graphs of \$([^$]+)\$ and \$([^$]+)\$ are shown on the grid from \$x=-8\$ to \$8\$ and \$y=-10\$ to \$10\$\. "
        r"Plot every solution of the system\. (.+)",
        prompt,
    )
    require(match is not None, "Unrecognized plot prompt")
    points = _intersections(match[1], match[2])
    require(points, "Nothing to plot")
    question = match[3]
    smaller, larger = points[0], points[-1]
    if question == "What is the smaller $x$-coordinate of a solution?":
        return smaller[0]
    if question == "What is the larger $x$-coordinate of a solution?":
        return larger[0]
    require(question == "What is the $y$-coordinate of the solution with the smaller $x$-coordinate?", "Unknown plot question")
    return smaller[1]


def givens(public):
    require(public['templateId'] in NONLINEAR_SYSTEM, 'Unknown nonlinear template')
    match = re.fullmatch(r'The system is \$y = ([^$]+)\$ and \$y = ([^$]+)\$\. (.+)', public['prompt'])
    require(match is not None, 'Unrecognized system prompt')
    quadratic, line = polynomial(match[1]), polynomial(match[2])
    require(quadratic[2] != 0 and line[2] == 0, 'Expected parabola and line')
    return quadratic, line, match[3]


def details(public):
    quadratic, line, question = givens(public)
    C, B, A = [q - l for q, l in zip(quadratic, line)]
    discriminant = B * B - 4 * A * C
    if public['templateId'] == 'nonlinear-system-count':
        require(question == 'How many distinct real ordered-pair solutions does the system have?', 'Unknown count question')
        return Q(2 if discriminant > 0 else 1 if discriminant == 0 else 0), [], quadratic, line
    requested = re.fullmatch(r'What is the \$([xy])\$-coordinate of the intersection with the (smaller|larger) \$x\$-coordinate\?', question)
    require(requested is not None and discriminant > 0, 'Expected two intersections and coordinate request')
    require(discriminant.denominator == 1, 'Expected integer discriminant')
    root = isqrt(discriminant.numerator)
    require(root * root == discriminant, 'Coordinate family requires exact rational roots')
    xs = sorted([(-B - root) / (2 * A), (-B + root) / (2 * A)])
    points = [(x, line[0] + line[1] * x) for x in xs]
    for x, y in points:
        require(quadratic[0] + quadratic[1] * x + quadratic[2] * x * x == y, 'Root fails original equation')
    point = points[0 if requested[2] == 'smaller' else 1]
    return point[0 if requested[1] == 'x' else 1], points, quadratic, line


def solve_nonlinear_system(public):
    if public["prompt"].startswith("The graphs of "):
        return _plot_answer(public)
    answer, points, quadratic, line = details(public)
    if public['templateId'] == 'nonlinear-system-read':
        figure = public.get('figure', {})
        require(figure.get('kind') == 'scene', 'Reading problem requires graph')
        graphs = [e for e in figure['scene']['elements'] if e['type'] == 'graph']
        require(len(graphs) == 1, 'Expected exactly one graph')
        graph = graphs[0]
        curves = graph.get('curves', [])
        require(len(curves) == 2, 'Expected exactly two curves')
        for curve, expected in zip(curves, [quadratic, line[:2]]):
            fn = curve['fn']
            require(fn['f'] == 'poly' and [Q(str(c)) for c in fn['c']] == expected, 'Graph coefficients disagree with displayed equations')
        require(curves[0].get('dash', 'solid') == 'solid' and curves[1].get('dash') == 'dash', 'Graph line styles disagree with hint')
        for x, y in points:
            require(graph['x'][0] < x < graph['x'][1] and graph['y'][0] < y < graph['y'][1], 'Intersection not visible inside graph')
    return answer


def review_nonlinear_system_problem(problem):
    answer = solve_nonlinear_system(problem['public'])
    require(Q(problem['answer']) == answer, 'Incorrect nonlinear-system answer')
    return answer


def review_nonlinear_system_fixtures():
    cases = [
        ('solve', 'x^2 - 4', '0', 'x', 'smaller', -2),
        ('solve', '-2x^2 + 3x + 8', '3x', 'y', 'larger', 6),
        ('solve', 'x^2 + 2x', '-x - 2', 'y', 'smaller', 0),
        ('count', 'x^2 + 1', '0', None, None, 0),
        ('count', '-x^2 + 2x - 1', '0', None, None, 1),
        ('count', 'x^2 - 2', '0', None, None, 2),
    ]
    checked = 0
    for suffix, quadratic, line, coord, order, answer in cases:
        question = ('How many distinct real ordered-pair solutions does the system have?' if suffix == 'count'
                    else f'What is the ${coord}$-coordinate of the intersection with the {order} $x$-coordinate?')
        problem = {'public': {'templateId': 'nonlinear-system-' + suffix,
                             'prompt': f'The system is $y = {quadratic}$ and $y = {line}$. {question}'}, 'answer': str(answer)}
        review_nonlinear_system_problem(problem)
        corrupted = copy.deepcopy(problem)
        corrupted['answer'] = str(answer + 1)
        _reject(corrupted)
        checked += 1
    read = {'public': {'templateId': 'nonlinear-system-read',
                       'prompt': 'The system is $y = x^2 - 4$ and $y = 0$. What is the $x$-coordinate of the intersection with the smaller $x$-coordinate?',
                       'figure': {'kind': 'scene', 'scene': {'elements': [{'type': 'graph', 'x': [-5, 5], 'y': [-5, 5],
                           'curves': [{'fn': {'f': 'poly', 'c': [-4, 0, 1]}}, {'fn': {'f': 'poly', 'c': [0, 0]}, 'dash': 'dash'}]}]}}}, 'answer': '-2'}
    review_nonlinear_system_problem(read)
    for mutation in ['parabola', 'line', 'window', 'style', 'missing']:
        bad = copy.deepcopy(read)
        graph = bad['public']['figure']['scene']['elements'][0]
        if mutation == 'parabola': graph['curves'][0]['fn']['c'][0] = -9
        elif mutation == 'line': graph['curves'][1]['fn']['c'][1] = 1
        elif mutation == 'window': graph['x'] = [-1, 1]
        elif mutation == 'style': graph['curves'][1]['dash'] = 'solid'
        else: del bad['public']['figure']
        _reject(bad)
    return {'fixtures': checked + 1, 'rejectedMutations': checked + 5}


def _reject(problem):
    try:
        review_nonlinear_system_problem(problem)
    except ValueError:
        return
    raise ValueError('Oracle accepted corrupted nonlinear-system evidence')


if __name__ == '__main__':
    import json
    print(json.dumps(review_nonlinear_system_fixtures()))
