"""Independent exact checks of the public line/parabola equations and graph.

No generator parameters, seed derivation, tags or answer key enter the solver.
Coefficients are parsed from the displayed equations; roots use the quadratic
formula rather than the generator's chosen factorization.
"""
import copy
import re
from fractions import Fraction as Q
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
