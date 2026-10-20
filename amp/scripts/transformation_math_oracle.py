"""Independent prompt-only checks for coordinate geometry, rigid motions, dilations,
similar triangles and scale drawings.

Answers are re-derived from the public prompt with methods the generator does
not use: Euclidean squared distances and integer square roots for lengths, the
shoelace formula for area, complex-number multiplication for rotations, and
exact Fractions throughout. Every figure must state exactly the prompt's givens.
Malformed, inconsistent or ambiguous prompts are rejected.
"""
import ast
import copy
import json
import math
import re
import subprocess
import xml.etree.ElementTree as ET
from fractions import Fraction
from pathlib import Path

NUMBER = frozenset({'coordinate-side-length', 'coordinate-rectangle-measure', 'coordinate-distance',
                    'dilation-scale-factor', 'similar-triangles-side', 'scale-drawing'})
TRANSFORMATION_CHOICE = frozenset({'coordinate-distance-exact', 'transformation-image',
                                   'identify-rigid-motion', 'dilation-image'})
TRANSFORMATION = NUMBER | TRANSFORMATION_CHOICE
POINT = r'\((−?\d+), (−?\d+)\)'



def reading(prompt):
    """Primed vertices and axes typeset as math ($A'B'C'$, $B'$, the $y$-axis)
    read as the plain names the patterns below spell out."""
    prompt = prompt.replace("$A'B'C'$", 'A′B′C′')
    prompt = re.sub(r"\$([ABC])'\$", r'\1′', prompt)
    prompt = re.sub(r'\$([A-Z]+|[A-Z]{2,3} = [\d./−-]+)\$', r'\1', prompt)
    return re.sub(r'\$([xy])\$-axis', r'\1-axis', prompt)

def require(condition, message):
    if not condition:
        raise ValueError(message)


def integer(text):
    require(re.fullmatch(r'−?\d+', text) is not None and not text.startswith('−0'), 'Malformed integer ' + text)
    return -int(text[1:]) if text.startswith('−') else int(text)


def decimal(text):
    require(re.fullmatch(r'\d+(\.\d+)?', text) is not None, 'Malformed decimal ' + text)
    return Fraction(text)


def show(v):
    v = Fraction(v)
    require(v.denominator == 1, 'Expected a lattice coordinate')
    return ('−' if v < 0 else '') + str(abs(v.numerator))


def point_text(p):
    return f'({show(p[0])}, {show(p[1])})'


def series(text):
    items = text.split(', ')
    last = items.pop().split(' and ')
    require(len(last) == 2 or (len(last) == 1 and not items), 'Malformed list')
    return items + last


def vertices(text, letters):
    """'$A(1, 2)$, $B(3, 4)$ and $C(5, 6)$' with exactly the expected labels, in order."""
    text = text.replace("'", '′')  # TeX writes the prime as an apostrophe
    found = re.findall(r'([A-Z]′?)' + POINT, text)
    # Each labeled point is typeset as one TeX unit: $A(1, 2)$.
    items = [f'${label}({x}, {y})$' for label, x, y in found]
    expected = items[0] if len(items) == 1 else ', '.join(items[:-1]) + ' and ' + items[-1]
    require(text == expected, 'Malformed vertex list')
    require([label for label, _, _ in found] == list(letters), 'Vertex labels out of order')
    return [(integer(x), integer(y)) for _, x, y in found]


def squared(p, q):
    return (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2


def exact_root(n):
    r = math.isqrt(n)
    require(r * r == n, 'Expected a perfect square')
    return r


def shoelace(points):
    twice = sum(points[i][0] * points[(i + 1) % len(points)][1] - points[(i + 1) % len(points)][0] * points[i][1] for i in range(len(points)))
    return Fraction(abs(twice), 2)


def figure_points(public, role='given'):
    figure = public.get('figure')
    require(figure is not None and figure['kind'] == 'coordinate-geometry', 'Missing coordinate figure')
    shapes = [s for s in figure['shapes'] if s['role'] == role]
    require(len(shapes) == 1, 'Figure must show one ' + role + ' shape')
    for s in figure['shapes']:
        for v in s['vertices']:
            require(figure['xMin'] <= v['x'] <= figure['xMax'] and figure['yMin'] <= v['y'] <= figure['yMax'], 'Vertex outside the grid')
    return shapes[0], [(v['x'], v['y']) for v in shapes[0]['vertices']], [v['label'] for v in shapes[0]['vertices']]


def require_figure(public, points, labels, role='given', closed=True):
    shape, shown_points, shown_labels = figure_points(public, role)
    require(shown_points == points and shown_labels == labels and shape['closed'] == closed, 'Figure contradicts the prompt')


# ---------- motions as complex arithmetic, independent of coordinate rules ----------
def motion_function(motion):
    kind = motion[0]
    if kind == 'translate':
        shift = complex(motion[1], motion[2])
        return lambda z: z + shift
    if kind == 'reflect':
        return (lambda z: z.conjugate()) if motion[1] == 'x' else (lambda z: -z.conjugate())
    if kind == 'rotate':
        turn = {90: 1j, 180: -1, 270: -1j}[motion[1]]
        return lambda z: z * turn
    raise ValueError('Unknown motion')


def apply(motion, p):
    if motion[0] == 'dilate':
        return (p[0] * motion[1], p[1] * motion[1])
    z = motion_function(motion)(complex(*p))
    require(z.real == int(z.real) and z.imag == int(z.imag), 'Image off the lattice')
    return (int(z.real), int(z.imag))


def parse_motion(phrase):
    m = re.fullmatch(r'translated (.+)', phrase)
    if m:
        dx = dy = 0
        parts = m[1].split(' and ')
        require(1 <= len(parts) <= 2, 'Malformed translation')
        for part in parts:
            n = re.fullmatch(r'(\d+) units? (left|right|up|down)', part)
            require(n is not None and (n[1] == '1') == (' unit ' in part + ' '), 'Malformed translation amount')
            v = int(n[1]) * (1 if n[2] in ('right', 'up') else -1)
            if n[2] in ('left', 'right'):
                require(dx == 0 and dy == 0, 'Horizontal amount must come first')
                dx = v
            else:
                require(dy == 0, 'Repeated vertical amount')
                dy = v
        require(dx or dy, 'Empty translation')
        return ('translate', dx, dy)
    m = re.fullmatch(r'reflected over the (x|y)-axis', phrase)
    if m:
        return ('reflect', m[1])
    if phrase == 'rotated 180° about the origin':
        return ('rotate', 180)
    m = re.fullmatch(r'rotated 90° (counterclockwise|clockwise) about the origin', phrase)
    if m:
        return ('rotate', 90 if m[1] == 'counterclockwise' else 270)
    m = re.fullmatch(r'dilated with center at the origin and scale factor (\d+)(?:/(\d+))?', phrase)
    if m:
        k = Fraction(int(m[1]), int(m[2] or 1))
        require(str(k) == m[1] + ('/' + m[2] if m[2] else ''), 'Scale factor not in lowest terms')
        require(k > 0 and k != 1, 'Scale factor outside scope')
        return ('dilate', k)
    raise ValueError('Unknown motion ' + phrase)


def option_motion(label):
    label = reading(label)
    m = re.fullmatch(r'A translation (.+)', label)
    if m:
        return parse_motion('translated ' + m[1])
    m = re.fullmatch(r'A reflection over the (x|y)-axis', label)
    if m:
        return ('reflect', m[1])
    if label == 'A rotation of 180° about the origin':
        return ('rotate', 180)
    m = re.fullmatch(r'A rotation of 90° (counterclockwise|clockwise) about the origin', label)
    if m:
        return ('rotate', 90 if m[1] == 'counterclockwise' else 270)
    raise ValueError('Unknown motion option ' + label)


def figure_motion(motion):
    if motion[0] == 'translate':
        return {'kind': 'translate', 'dx': motion[1], 'dy': motion[2]}
    if motion[0] == 'reflect':
        return {'kind': 'reflect', 'axis': motion[1]}
    if motion[0] == 'rotate':
        return {'kind': 'rotate', 'degrees': motion[1]}
    return {'kind': 'dilate', 'numerator': motion[1].numerator, 'denominator': motion[1].denominator}


def options(public):
    response = public['response']
    require(response['kind'] == 'choice', 'Expected a choice response')
    labels = [o['label'] for o in response['options']]
    require(len(labels) == 4 and len(set(labels)) == 4, 'Expected four distinct options, found a duplicate choice')
    return response['options']


def unique(public, predicate):
    hits = [o['id'] for o in options(public) if predicate(o['label'])]
    require(len(hits) == 1, f'Expected exactly one correct option, found {len(hits)}')
    return hits[0]


# ---------- solvers ----------
def solve_side(public):
    m = re.fullmatch(r'(Rectangle|Triangle|Quadrilateral|Hexagon) ([A-F]+) has vertices (.+)\. What is the length of side ([A-F])([A-F]), in units\?', public['prompt'])
    require(m is not None, 'Unrecognized side-length prompt')
    letters = m[2]
    require({'Rectangle': 4, 'Triangle': 3, 'Quadrilateral': 4, 'Hexagon': 6}[m[1]] == len(letters) and letters == 'ABCDEF'[:len(letters)], 'Shape name contradicts vertices')
    pts = vertices(m[3], letters)
    i, j = letters.index(m[4]), letters.index(m[5])
    require((j - i) % len(pts) == 1, 'Asked side is not a side of the polygon')
    p, q = pts[i], pts[j]
    require((p[0] == q[0]) != (p[1] == q[1]), 'Asked side must be horizontal or vertical')
    if m[1] == 'Rectangle':
        review_rectangle(pts)
    require_figure(public, pts, list(letters))
    return Fraction(exact_root(squared(p, q)))


def review_rectangle(pts):
    require(len(pts) == 4 and len(set(pts)) == 4, 'Rectangle needs four vertices')
    for i in range(4):
        a, b, c = pts[i - 1], pts[i], pts[(i + 1) % 4]
        require((a[0] - b[0]) * (c[0] - b[0]) + (a[1] - b[1]) * (c[1] - b[1]) == 0, 'Not a right angle')


def solve_rectangle(public):
    m = re.fullmatch(r'Rectangle ABCD has vertices (.+)\. What is its (area, in square units|perimeter, in units)\?', public['prompt'])
    require(m is not None, 'Unrecognized rectangle prompt')
    pts = vertices(m[1], 'ABCD')
    review_rectangle(pts)
    require_figure(public, pts, list('ABCD'))
    if m[2].startswith('area'):
        return shoelace(pts)
    return Fraction(sum(exact_root(squared(pts[i], pts[(i + 1) % 4])) for i in range(4)))


def solve_distance(public):
    m = re.fullmatch(r'What is the distance between the points ' + POINT + ' and ' + POINT + r'\?', public['prompt'])
    require(m is not None, 'Unrecognized distance prompt')
    p, q = (integer(m[1]), integer(m[2])), (integer(m[3]), integer(m[4]))
    require(p[0] != q[0] and p[1] != q[1], 'Distance item must be slanted')
    require('figure' not in public, 'Whole-number distance items carry no figure')
    return Fraction(exact_root(squared(p, q)))


def radical_square(label):
    """Square of a displayed exact length; it must be in simplest form."""
    if re.fullmatch(r'\d+', label):
        return int(label) ** 2
    m = re.fullmatch(r'\$(\d*)\\sqrt\{(\d+)\}\$', label)
    require(m is not None, 'Malformed radical option ' + label)
    a, b = int(m[1] or 1), int(m[2])
    require(m[1] != '1' and b > 1 and all(b % (f * f) for f in range(2, math.isqrt(b) + 1)), 'Option not in simplest radical form')
    return a * a * b


def solve_exact_distance(public):
    m = re.fullmatch(r'Point A is at ' + POINT + ' and point B is at ' + POINT + r'\. What is the exact distance AB, in units\?', public['prompt'])
    require(m is not None, 'Unrecognized exact-distance prompt')
    p, q = (integer(m[1]), integer(m[2])), (integer(m[3]), integer(m[4]))
    require(p[0] != q[0] and p[1] != q[1], 'Distance item must be slanted')
    require_figure(public, [p, q], ['A', 'B'], closed=False)
    target = squared(p, q)
    return unique(public, lambda label: radical_square(label) == target)


def solve_image(public):
    m = re.fullmatch(r'Triangle ABC has vertices (.+)\. It is (.+) to form triangle A′B′C′\. What are the coordinates of ([ABC])′\?', reading(public['prompt']))
    require(m is not None, 'Unrecognized image prompt')
    pts = vertices(m[1], 'ABC')
    motion = parse_motion(m[2])
    require((motion[0] == 'dilate') == (public['templateId'] == 'dilation-image'), 'Motion outside the template')
    require_figure(public, pts, list('ABC'))
    require(public['figure'].get('motion') == figure_motion(motion), 'Figure motion contradicts the prompt')
    target = apply(motion, pts['ABC'.index(m[3])])
    return unique(public, lambda label: label == point_text(target))


def solve_identify(public):
    m = re.fullmatch(r'Triangle ABC has vertices (.+)\. Triangle A′B′C′ has vertices (.+)\. Which single transformation maps triangle ABC onto triangle A′B′C′\?', reading(public['prompt']))
    require(m is not None, 'Unrecognized identify prompt')
    before, after = vertices(m[1], 'ABC'), vertices(m[2], ['A′', 'B′', 'C′'])
    require(shoelace(before) > 0, 'Degenerate triangle')
    require_figure(public, before, list('ABC'))
    require_figure(public, after, ['A′', 'B′', 'C′'], role='image')
    return unique(public, lambda label: [apply(option_motion(label), p) for p in before] == after)


def solve_scale_factor(public):
    m = re.fullmatch(r'A dilation with center at the origin maps triangle ABC onto triangle A′B′C′\. Triangle ABC has vertices (.+), and triangle A′B′C′ has vertices (.+)\. What is the scale factor\?', reading(public['prompt']))
    require(m is not None, 'Unrecognized scale-factor prompt')
    before, after = vertices(m[1], 'ABC'), vertices(m[2], ['A′', 'B′', 'C′'])
    require_figure(public, before, list('ABC'))
    require_figure(public, after, ['A′', 'B′', 'C′'], role='image')
    require(public['figure'].get('rays') is True, 'Dilation figure shows its rays')
    # Ratio of distances from the center, as an exact square root of a ratio of squares.
    ratio = Fraction(squared(after[0], (0, 0)), squared(before[0], (0, 0)))
    k = Fraction(exact_root(ratio.numerator), exact_root(ratio.denominator))
    for p, q in zip(before, after):
        require((p[0] * k, p[1] * k) == q, 'Image is not a dilation from the origin')
    return k


def solve_similar(public):
    m = re.fullmatch(r'Triangle ([A-Z]{3}) is similar to triangle ([A-Z]{3}), with (.+)\. In (centimeters|meters|inches|feet), (.+)\. What is ([A-Z]{2}), in (centimeters|meters|inches|feet)\?', public['prompt'])
    require(m is not None and m[4] == m[7], 'Unrecognized similar-triangles prompt')
    first, second = m[1], m[2]
    pairs = [re.fullmatch(r'([A-Z]) corresponding to ([A-Z])', item) for item in series(m[3])]
    require(all(pairs) and [(p[1], p[2]) for p in pairs] == list(zip(first, second)), 'Correspondence must follow vertex order')
    lengths = {}
    for item in series(m[5]):
        g = re.fullmatch(r'([A-Z]{2}) = (\d+(?:\.\d+)?)', item)
        require(g is not None and g[1] not in lengths, 'Malformed given length')
        lengths[g[1]] = decimal(g[2])
    sides = [first[i] + first[(i + 1) % 3] for i in range(3)]
    images = [second[i] + second[(i + 1) % 3] for i in range(3)]
    require(all(s in lengths for s in sides), 'First triangle must state every side')
    a, b, c = (lengths[s] for s in sides)
    require(a + b > c and b + c > a and c + a > b, 'Impossible triangle')
    known = [i for i in range(3) if images[i] in lengths]
    require(len(known) == 1 and len(lengths) == 4 and m[6] in images and images.index(m[6]) != known[0], 'Need one known image side and a different asked side')
    k = lengths[images[known[0]]] / lengths[sides[known[0]]]
    asked = images.index(m[6])
    unit = {'centimeters': 'cm', 'meters': 'm', 'inches': 'in', 'feet': 'ft'}[m[4]]
    figure = public.get('figure')
    require(figure is not None and figure['kind'] == 'similar-triangles' and figure['unit'] == unit, 'Missing similar-triangles figure')
    t1, t2 = figure['triangles']
    require(''.join(t1['vertices']) == first and ''.join(t2['vertices']) == second, 'Figure labels contradict the prompt')
    require([Fraction(str(s)) for s in t1['sides']] == [a, b, c], 'Figure sides contradict the prompt')
    expected = [None, None, None]
    expected[known[0]] = lengths[images[known[0]]]
    expected[asked] = '?'
    require([s if s in (None, '?') else Fraction(str(s)) for s in t2['sides']] == expected, 'Figure image sides contradict the prompt')
    return lengths[sides[asked]] * k


UNITS = {
    'centimeter': ('centimeters', 'cm'), 'inch': ('inches', 'in'),
    'meter': ('meters', 'm'), 'foot': ('feet', 'ft'), 'kilometer': ('kilometers', 'km'),
}
PLURAL = {v[0]: k for k, v in UNITS.items()}


def solve_scale(public):
    m = re.fullmatch(r'On a (map|floor plan|garden plan), (\d+) ([a-z]+) represents (\d+) ([a-z]+)\. (.+)', public['prompt'])
    require(m is not None and 'figure' not in public, 'Unrecognized scale prompt')
    what, d, du, a, au, rest = m[1], int(m[2]), m[3], int(m[4]), m[5], m[6]
    drawing = du if d == 1 else PLURAL.get(du)
    require(drawing in ('centimeter', 'inch') and (du == drawing) == (d == 1), 'Drawing unit mismatch')
    require(au in PLURAL and PLURAL[au] in ('meter', 'foot', 'kilometer'), 'Actual unit mismatch')
    many = UNITS[drawing][0]
    plan = 'map' if what == 'map' else 'plan'
    k = Fraction(a, d)
    region = {'map': 'park', 'floor plan': 'room', 'garden plan': 'flower bed'}[what]
    length = {'map': None, 'floor plan': 'A wall', 'garden plan': 'A path'}[what]
    patterns = [
        (rf'Two towns are ([\d.]+) {many} apart on the map\. What is the actual distance between them, in {au}\?', lambda g: decimal(g[1]) * k, what == 'map'),
        (rf'{length} is ([\d.]+) {many} long on the plan\. What is its actual length, in {au}\?', lambda g: decimal(g[1]) * k, what != 'map'),
        (rf'Two towns are (\d+) {au} apart\. How far apart are they on the map, in {many}\?', lambda g: decimal(g[1]) / k, what == 'map'),
        (rf'{length} is actually (\d+) {au} long\. How long is it on the plan, in {many}\?', lambda g: decimal(g[1]) / k, what != 'map'),
        (rf'A rectangular {region} is ([\d.]+) {many} by ([\d.]+) {many} on the {plan}\. What is its actual area, in square {au}\?', lambda g: decimal(g[1]) * k * decimal(g[2]) * k, True),
        (rf'A {region} covers (\d+) square {many} on the {plan}\. What is its actual area, in square {au}\?', lambda g: decimal(g[1]) * k * k, True),
    ]
    for pattern, answer, allowed in patterns:
        g = re.fullmatch(pattern, rest)
        if g and allowed:
            return answer(g)
    raise ValueError('Unrecognized scale question: ' + rest)


SOLVERS = {
    'coordinate-side-length': solve_side,
    'coordinate-rectangle-measure': solve_rectangle,
    'coordinate-distance': solve_distance,
    'coordinate-distance-exact': solve_exact_distance,
    'transformation-image': solve_image,
    'identify-rigid-motion': solve_identify,
    'dilation-image': solve_image,
    'dilation-scale-factor': solve_scale_factor,
    'similar-triangles-side': solve_similar,
    'scale-drawing': solve_scale,
}


def solve_transformation(public):
    template = public['templateId']
    kind = public['response']['kind']
    require((kind == 'choice') == (template in TRANSFORMATION_CHOICE), 'Response kind mismatch')
    return SOLVERS[template]({**public, 'prompt': reading(public['prompt'])})


# ---------- explanations ----------
NUM = r'−?\d+(?:\.\d+)?(?:/\d+)?'
TERM = rf'(?:\(−\d+\)|{NUM})'
CLAIM = re.compile(rf'(?<![\w.(/′²])({TERM}(?: [+−×÷] {TERM})+) = ({NUM})(?![\d/²]| [+−×÷(])')


def evaluate(expression):
    """Exact value of a displayed chain such as '48 × 2 × 2' or '6 × 3/2'."""
    text = re.sub(r'\d+(?:\.\d+)?', lambda m: f'F("{m[0]}")', expression.replace('−', '-').replace('×', '*').replace('÷', '/'))
    tree = ast.parse(text, mode='eval')

    def visit(node):
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == 'F':
            return Fraction(node.args[0].value)
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.USub):
            return -visit(node.operand)
        if isinstance(node, ast.BinOp):
            a, b = visit(node.left), visit(node.right)
            return {ast.Add: a + b, ast.Sub: a - b, ast.Mult: a * b, ast.Div: a / b if b else None}[type(node.op)]
        raise ValueError('Unsupported arithmetic claim: ' + expression)
    return visit(tree.body)


def arithmetic(text):
    """Check every displayed 'a op b … = c' claim; return how many were checked."""
    checked = 0
    for m in CLAIM.finditer(text):
        require(evaluate(m[1]) == Fraction(m[2].replace('−', '-')), 'False arithmetic: ' + m[0])
        checked += 1
    return checked


def answer_text(problem):
    public = problem['public']
    if public['response']['kind'] == 'choice':
        label = next(o['label'] for o in public['response']['options'] if o['id'] == problem['answer'])
        return label
    return problem['answer']


def review_problem(problem):
    public = problem['public']
    solved = solve_transformation(public)
    if public['response']['kind'] == 'choice':
        require(problem['answer'] == solved, 'Mismatch: wrong option')
        feedback = problem.get('choiceFeedback') or {}
        require(set(feedback) == {o['id'] for o in public['response']['options']} - {solved} and all(v.strip() for v in feedback.values()), 'Every distractor needs feedback')
    else:
        require(Fraction(problem['answer']) == solved, 'Mismatch: incorrect exact answer')
    steps = problem['explanation']
    require(len(steps) >= 3 and problem['hint'], 'Explanation or hint missing')
    final = steps[-1]
    shown = answer_text(problem)
    if public['response']['kind'] != 'choice':
        v = Fraction(shown)
        candidates = {shown, str(v), f'{v.numerator}/{v.denominator}', str(float(v)) if v.denominator in (2, 4) else shown}
        require(any(re.search(r'(?<![\d.])' + re.escape(c) + r'(?![\d])', final) for c in candidates), 'Final step does not state the answer')
    else:
        require(shown in final or shown.replace('A ', 'a ', 1) in final, 'Final step does not state the answer')
    return sum(arithmetic(step) for step in steps)


# ---------- handwritten fixtures ----------
def case(template, prompt, figure=None, opts=None, kind=None):
    public = {'templateId': template, 'prompt': prompt,
              'response': {'kind': kind or ('choice' if template in TRANSFORMATION_CHOICE else 'number'),
                           **({'options': [{'id': f'option-{"abcd"[i]}', 'label': o} for i, o in enumerate(opts)]} if opts else {})}}
    if figure:
        public['figure'] = figure
    return public


def grid(shapes, **extra):
    return {'kind': 'coordinate-geometry', 'xMin': -12, 'xMax': 12, 'yMin': -12, 'yMax': 12,
            'shapes': [{'role': role, 'closed': closed, 'vertices': [{'x': x, 'y': y, 'label': l} for l, (x, y) in zip(labels, pts)]}
                       for role, closed, labels, pts in shapes], **extra}


def review_transformation_fixtures():
    rect = [(-4, 3), (5, 3), (5, -2), (-4, -2)]
    tri = [(1, 1), (4, 1), (1, 3)]
    fixtures = [
        (case('coordinate-side-length', 'Rectangle ABCD has vertices $A(−4, 3)$, $B(5, 3)$, $C(5, −2)$ and $D(−4, −2)$. What is the length of side AB, in units?', grid([('given', True, 'ABCD', rect)])), Fraction(9)),
        (case('coordinate-side-length', 'Rectangle ABCD has vertices $A(−4, 3)$, $B(5, 3)$, $C(5, −2)$ and $D(−4, −2)$. What is the length of side BC, in units?', grid([('given', True, 'ABCD', rect)])), Fraction(5)),
        (case('coordinate-rectangle-measure', 'Rectangle ABCD has vertices $A(−4, 3)$, $B(5, 3)$, $C(5, −2)$ and $D(−4, −2)$. What is its perimeter, in units?', grid([('given', True, 'ABCD', rect)])), Fraction(28)),
        (case('coordinate-rectangle-measure', 'Rectangle ABCD has vertices $A(−4, 3)$, $B(5, 3)$, $C(5, −2)$ and $D(−4, −2)$. What is its area, in square units?', grid([('given', True, 'ABCD', rect)])), Fraction(45)),
        (case('coordinate-distance', 'What is the distance between the points (−3, −1) and (5, 5)?'), Fraction(10)),
        (case('coordinate-distance-exact', 'Point A is at (1, 2) and point B is at (5, 4). What is the exact distance AB, in units?', grid([('given', False, 'AB', [(1, 2), (5, 4)])]), ['6', '$2\\sqrt{5}$', '20', '$4\\sqrt{5}$']), 'option-b'),
        (case('transformation-image', 'Triangle ABC has vertices $A(1, 1)$, $B(4, 1)$ and $C(1, 3)$. It is rotated 90° counterclockwise about the origin to form triangle A′B′C′. What are the coordinates of B′?', grid([('given', True, 'ABC', tri)], motion={'kind': 'rotate', 'degrees': 90}), ['(1, −4)', '(−1, 4)', '(−4, 1)', '(4, −1)']), 'option-b'),
        (case('transformation-image', 'Triangle ABC has vertices $A(1, 1)$, $B(4, 1)$ and $C(1, 3)$. It is translated 6 units left and 2 units up to form triangle A′B′C′. What are the coordinates of C′?', grid([('given', True, 'ABC', tri)], motion={'kind': 'translate', 'dx': -6, 'dy': 2}), ['(7, 1)', '(−5, 5)', '(−4, −3)', '(3, −3)']), 'option-b'),
        (case('identify-rigid-motion', 'Triangle ABC has vertices $A(1, 1)$, $B(4, 1)$ and $C(1, 3)$. Triangle A′B′C′ has vertices $A′(1, −1)$, $B′(4, −1)$ and $C′(1, −3)$. Which single transformation maps triangle ABC onto triangle A′B′C′?', grid([('given', True, 'ABC', tri), ('image', True, ['A′', 'B′', 'C′'], [(1, -1), (4, -1), (1, -3)])]), ['A reflection over the y-axis', 'A translation 2 units down', 'A reflection over the x-axis', 'A rotation of 180° about the origin']), 'option-c'),
        (case('dilation-image', 'Triangle ABC has vertices $A(2, 4)$, $B(6, 2)$ and $C(4, −2)$. It is dilated with center at the origin and scale factor 3/2 to form triangle A′B′C′. What are the coordinates of C′?', grid([('given', True, 'ABC', [(2, 4), (6, 2), (4, -2)])], motion={'kind': 'dilate', 'numerator': 3, 'denominator': 2}), ['(6, −3)', '(6, −2)', '(−6, 3)', '(4, −3)']), 'option-a'),
        (case('dilation-scale-factor', 'A dilation with center at the origin maps triangle ABC onto triangle A′B′C′. Triangle ABC has vertices $A(2, −4)$, $B(4, 2)$ and $C(−2, 2)$, and triangle A′B′C′ has vertices $A′(3, −6)$, $B′(6, 3)$ and $C′(−3, 3)$. What is the scale factor?', grid([('given', True, 'ABC', [(2, -4), (4, 2), (-2, 2)]), ('image', True, ['A′', 'B′', 'C′'], [(3, -6), (6, 3), (-3, 3)])], rays=True), kind='fraction'), Fraction(3, 2)),
        (case('similar-triangles-side', 'Triangle ABC is similar to triangle DEF, with A corresponding to D, B corresponding to E and C corresponding to F. In centimeters, AB = 4, BC = 6, CA = 5 and DE = 6. What is EF, in centimeters?', {'kind': 'similar-triangles', 'unit': 'cm', 'triangles': [{'vertices': ['A', 'B', 'C'], 'sides': [4, 6, 5]}, {'vertices': ['D', 'E', 'F'], 'sides': [6, '?', None]}]}, kind='fraction'), Fraction(9)),
        (case('scale-drawing', 'On a floor plan, 1 centimeter represents 2 meters. A rectangular room is 4.5 centimeters by 3 centimeters on the plan. What is its actual area, in square meters?'), Fraction(54)),
        (case('scale-drawing', 'On a map, 2 centimeters represents 5 kilometers. Two towns are 7 centimeters apart on the map. What is the actual distance between them, in kilometers?'), Fraction(35, 2)),
        (case('scale-drawing', 'On a garden plan, 1 inch represents 6 feet. A flower bed covers 5 square inches on the plan. What is its actual area, in square feet?'), Fraction(180)),
        (case('scale-drawing', 'On a floor plan, 1 inch represents 4 feet. A wall is actually 18 feet long. How long is it on the plan, in inches?'), Fraction(9, 2)),
    ]
    for public, expected in fixtures:
        require(solve_transformation(public) == expected, 'Independent handwritten mismatch: ' + public['prompt'])
    bad = [
        # Not a side of the polygon, a slanted side, mislabeled shapes, wrong motion words, inconsistent figures.
        case('coordinate-side-length', 'Rectangle ABCD has vertices $A(−4, 3)$, $B(5, 3)$, $C(5, −2)$ and $D(−4, −2)$. What is the length of side AC, in units?', grid([('given', True, 'ABCD', rect)])),
        case('coordinate-side-length', 'Triangle ABC has vertices $A(−4, 3)$, $B(5, 3)$, $C(5, −2)$ and $D(−4, −2)$. What is the length of side AB, in units?', grid([('given', True, 'ABCD', rect)])),
        case('coordinate-side-length', 'Rectangle ABCD has vertices $A(−4, 3)$, $B(5, 3)$, $C(5, −2)$ and $D(−4, −2)$. What is the length of side AB, in units?', grid([('given', True, 'ABCD', [(-4, 3), (6, 3), (5, -2), (-4, -2)])])),
        case('coordinate-rectangle-measure', 'Rectangle ABCD has vertices $A(−4, 3)$, $B(5, 3)$, $C(6, −2)$ and $D(−4, −2)$. What is its area, in square units?', grid([('given', True, 'ABCD', [(-4, 3), (5, 3), (6, -2), (-4, -2)])])),
        case('coordinate-distance', 'What is the distance between the points (1, 2) and (5, 4)?'),
        case('coordinate-distance-exact', 'Point A is at (1, 2) and point B is at (5, 4). What is the exact distance AB, in units?', grid([('given', False, 'AB', [(1, 2), (5, 4)])]), ['6', '$\\sqrt{20}$', '20', '$4\\sqrt{5}$']),
        case('coordinate-distance-exact', 'Point A is at (1, 2) and point B is at (5, 4). What is the exact distance AB, in units?', grid([('given', False, 'AB', [(1, 2), (5, 4)])]), ['6', '$2\\sqrt{5}$', '$2\\sqrt{5}$', '$4\\sqrt{5}$']),
        case('transformation-image', 'Triangle ABC has vertices $A(1, 1)$, $B(4, 1)$ and $C(1, 3)$. It is rotated 90° counterclockwise about the origin to form triangle A′B′C′. What are the coordinates of B′?', grid([('given', True, 'ABC', tri)], motion={'kind': 'rotate', 'degrees': 270}), ['(1, −4)', '(−1, 4)', '(−4, 1)', '(4, −1)']),
        case('transformation-image', 'Triangle ABC has vertices $A(1, 1)$, $B(4, 1)$ and $C(1, 3)$. It is spun about the origin to form triangle A′B′C′. What are the coordinates of B′?', grid([('given', True, 'ABC', tri)]), ['(1, −4)', '(−1, 4)', '(−4, 1)', '(4, −1)']),
        case('identify-rigid-motion', 'Triangle ABC has vertices $A(1, 1)$, $B(4, 1)$ and $C(1, 3)$. Triangle A′B′C′ has vertices $A′(1, −1)$, $B′(4, −1)$ and $C′(1, −3)$. Which single transformation maps triangle ABC onto triangle A′B′C′?', grid([('given', True, 'ABC', tri), ('image', True, ['A′', 'B′', 'C′'], [(1, -1), (4, -1), (1, -3)])]), ['A reflection over the y-axis', 'A translation 2 units down', 'A rotation of 90° clockwise about the origin', 'A rotation of 180° about the origin']),
        case('dilation-scale-factor', 'A dilation with center at the origin maps triangle ABC onto triangle A′B′C′. Triangle ABC has vertices $A(2, −4)$, $B(4, 2)$ and $C(−2, 2)$, and triangle A′B′C′ has vertices $A′(3, −6)$, $B′(6, 4)$ and $C′(−3, 3)$. What is the scale factor?', grid([('given', True, 'ABC', [(2, -4), (4, 2), (-2, 2)]), ('image', True, ['A′', 'B′', 'C′'], [(3, -6), (6, 4), (-3, 3)])], rays=True), kind='fraction'),
        case('similar-triangles-side', 'Triangle ABC is similar to triangle DEF, with A corresponding to E, B corresponding to D and C corresponding to F. In centimeters, AB = 4, BC = 6, CA = 5 and DE = 6. What is EF, in centimeters?', {'kind': 'similar-triangles', 'unit': 'cm', 'triangles': [{'vertices': ['A', 'B', 'C'], 'sides': [4, 6, 5]}, {'vertices': ['D', 'E', 'F'], 'sides': [6, '?', None]}]}, kind='fraction'),
        case('similar-triangles-side', 'Triangle ABC is similar to triangle DEF, with A corresponding to D, B corresponding to E and C corresponding to F. In centimeters, AB = 4, BC = 6, CA = 5 and DE = 6. What is EF, in centimeters?', {'kind': 'similar-triangles', 'unit': 'cm', 'triangles': [{'vertices': ['A', 'B', 'C'], 'sides': [4, 6, 5]}, {'vertices': ['D', 'E', 'F'], 'sides': [8, '?', None]}]}, kind='fraction'),
        case('scale-drawing', 'On a map, 1 centimeter represents 5 kilometers. A wall is 3 centimeters long on the plan. What is its actual length, in kilometers?'),
        case('scale-drawing', 'On a floor plan, 1 centimeters represents 2 meters. A wall is 3 centimeters long on the plan. What is its actual length, in meters?'),
    ]
    for public in bad:
        try:
            solve_transformation(public)
        except (ValueError, KeyError, IndexError, TypeError):
            continue
        raise ValueError('Malformed or inconsistent prompt accepted: ' + public['prompt'])
    return {'handwritten': len(fixtures), 'rejected': len(bad)}


# ---------- authored content ----------
_EXPORT = None


def content(data=None):
    global _EXPORT
    if data is not None:
        return data
    if _EXPORT is None:
        app = Path(__file__).resolve().parent.parent
        _EXPORT = subprocess.check_output(['node', '--import', 'tsx', 'scripts/transformation-content-oracle.ts'], cwd=app, text=True)
    return json.loads(_EXPORT)


def tags(problems, template):
    prompts = [reading(p['public']['prompt']) for p in problems]
    if template == 'coordinate-side-length':
        return {p.split(' ')[0] for p in prompts} == {'Rectangle', 'Triangle', 'Quadrilateral', 'Hexagon'}
    if template == 'coordinate-rectangle-measure':
        return any('area' in p for p in prompts) and any('perimeter' in p for p in prompts)
    if template in ('transformation-image',):
        words = ' '.join(prompts)
        return all(w in words for w in ('translated', 'x-axis', 'y-axis', '90° counterclockwise', '90° clockwise', '180°'))
    if template == 'identify-rigid-motion':
        answers = {answer_text(p) for p in problems}
        return {a.split(' ')[1] for a in answers} == {'translation', 'reflection', 'rotation'}
    if template == 'scale-drawing':
        return any('area' in p for p in prompts) and any('How long' in p or 'How far' in p for p in prompts) and any('map' in p for p in prompts)
    if template in ('dilation-image', 'dilation-scale-factor'):
        return any('/' in p for p in prompts) or any('/' in str(p['answer']) for p in problems)
    return True


def review_transformation_content(data=None):
    data = content(data)
    checks = 0
    for sheet in data['worksheets']:
        problems = sheet['problems']
        require(len(problems) == 12, 'Worksheet length')
        require(len({p['public']['prompt'] for p in problems}) == 12, 'Repeated worksheet problem')
        require(all(p['public']['templateId'] == sheet['templateId'] for p in problems), 'Worksheet mixes types')
        require(tags(problems, sheet['templateId']), 'Worksheet lacks required breadth: ' + sheet['templateId'])
        checks += sum(review_problem(p) for p in problems)
    lessons = {lesson['id']: lesson for lesson in data['lessons']}
    require(set(lessons) == set(WORKED), 'Missing standalone lesson')
    require(sorted(t for lesson in lessons.values() for t in lesson['templateIds']) == sorted(TRANSFORMATION), 'Every type needs exactly one lesson')
    for lesson_id, lesson in lessons.items():
        worked = lesson['workedExample']
        template = WORKED[lesson_id]
        require(template in lesson['templateIds'], 'Worked example outside its lesson')
        if template in TRANSFORMATION_CHOICE:
            require(worked['answer'] == _worked_choice(template, worked['prompt']), 'Worked example answer: ' + lesson_id)
        else:
            require(Fraction(worked['answer']) == _solve_prompt_only(template, worked['prompt']), 'Worked example answer: ' + lesson_id)
        for step in worked['steps']:
            checks += arithmetic(step)
        for section in lesson['sections']:
            for paragraph in section['paragraphs']:
                checks += arithmetic(paragraph)
        for pitfall in lesson['pitfalls']:
            checks += arithmetic(pitfall)
    checks += review_figures(data['figures'])
    return {'worksheets': len(data['worksheets']), 'checks': checks, 'lessons': len(lessons), 'figures': len(data['figures'])}


WORKED = {
    'coordinate-polygons': 'coordinate-rectangle-measure',
    'coordinate-distance': 'coordinate-distance',
    'rigid-motions': 'transformation-image',
    'dilations-similarity': 'similar-triangles-side',
    'scale-drawings': 'scale-drawing',
}


def _with_figure(template, prompt):
    """Rebuild the figure a worked example describes, so the solvers' figure checks pass."""
    pts = [(integer(a), integer(b)) for a, b in re.findall(POINT, prompt)]
    if template == 'coordinate-distance-exact':
        return grid([('given', False, 'AB', pts)])
    if template in ('coordinate-side-length', 'coordinate-rectangle-measure'):
        letters = re.search(r' ([A-F]+) has vertices', prompt)[1]
        return grid([('given', True, letters, pts)])
    m = re.search(r'It is (.+) to form', prompt)
    if m:
        return grid([('given', True, 'ABC', pts[:3])], motion=figure_motion(parse_motion(m[1])))
    return None


def _solve_prompt_only(template, prompt):
    prompt = reading(prompt)
    if template == 'similar-triangles-side':
        m = re.search(r'Triangle ([A-Z]{3}) is similar to triangle ([A-Z]{3}).*In (\w+), (.+)\. What is ([A-Z]{2})', prompt)
        lengths = dict(re.findall(r'([A-Z]{2}) = ([\d.]+)', m[4]))
        first, second = m[1], m[2]
        sides = [first[i] + first[(i + 1) % 3] for i in range(3)]
        images = [second[i] + second[(i + 1) % 3] for i in range(3)]
        known = next(i for i in range(3) if images[i] in lengths)
        unit = {'centimeters': 'cm', 'meters': 'm', 'inches': 'in', 'feet': 'ft'}[m[3]]
        side2 = [None, None, None]
        side2[known] = float(lengths[images[known]])
        side2[images.index(m[5])] = '?'
        figure = {'kind': 'similar-triangles', 'unit': unit, 'triangles': [{'vertices': list(first), 'sides': [float(lengths[s]) for s in sides]}, {'vertices': list(second), 'sides': side2}]}
        return solve_transformation(case(template, prompt, figure, kind='fraction'))
    return solve_transformation(case(template, prompt, _with_figure(template, prompt)))


def _worked_choice(template, prompt):
    require(template == 'transformation-image', 'Only image examples are worked as choices')
    m = re.fullmatch(r'Triangle ABC has vertices (.+)\. It is (.+) to form triangle A′B′C′\. What are the coordinates of ([ABC])′\?', reading(prompt))
    require(m is not None, 'Unrecognized worked example')
    pts = vertices(m[1], 'ABC')
    return point_text(apply(parse_motion(m[2]), pts['ABC'.index(m[3])]))


def svg_points(root, role=None):
    found = {}
    for e in root.iter():
        if 'data-vertex' in e.attrib:
            found[e.attrib['data-vertex']] = ((int(e.attrib['data-x']), int(e.attrib['data-y'])), (float(e.attrib['cx']), float(e.attrib['cy'])))
    return found


def review_scale(root):
    """Every plotted vertex sits on one unit, the same on both axes."""
    svg = root if root.tag.endswith('svg') else next(e for e in root.iter() if e.tag.endswith('svg') and 'data-unit' in e.attrib)
    unit = float(svg.attrib['data-unit'])
    points = list(svg_points(svg).values())
    (x0, y0), (px0, py0) = points[0]
    for (x, y), (px, py) in points[1:]:
        require(abs((px - px0) - (x - x0) * unit) < 1e-6 and abs((py0 - py) - (y - y0) * unit) < 1e-6, 'Unequal or inexact grid scale')
    return 1


def review_figures(figures):
    by_kind = {f['kind']: ET.fromstring(f['html']) for f in figures}
    require(set(by_kind) == {'coordinate-side-lengths', 'distance-triangle', 'rigid-motions-panels', 'dilation-rays', 'similar-triangles-marked', 'scale-drawing-plan'}, 'Figure inventory')
    checks = 0
    root = by_kind['coordinate-side-lengths']
    pts = svg_points(root)
    measures = [int(e.attrib['data-measure']) for e in root.iter() if 'data-measure' in e.attrib]
    ab = exact_root(squared(pts['A'][0], pts['B'][0]))
    bc = exact_root(squared(pts['B'][0], pts['C'][0]))
    require(measures[0] + measures[1] == ab and measures[2] + measures[3] == bc, 'Side measures must add to the sides')
    require(measures[0] == -pts['A'][0][0] and measures[1] == pts['B'][0][0], 'AB measures split at the y-axis')
    checks += review_scale(root) + 1
    root = by_kind['distance-triangle']
    legs = {e.attrib['data-leg']: (e.attrib['data-from'], e.attrib['data-to']) for e in root.iter() if 'data-leg' in e.attrib}
    for length, (a, b) in legs.items():
        p = tuple(integer(v) for v in re.fullmatch(POINT, a).groups())
        q = tuple(integer(v) for v in re.fullmatch(POINT, b).groups())
        require(exact_root(squared(p, q)) == int(length), 'Leg label contradicts its endpoints')
    hyp = int(next(e.attrib['data-hypotenuse'] for e in root.iter() if 'data-hypotenuse' in e.attrib))
    pts = svg_points(root)
    require(hyp == exact_root(squared(pts['A'][0], pts['B'][0])) and hyp ** 2 == sum(int(k) ** 2 for k in legs), 'Hypotenuse label')
    checks += review_scale(root) + 1
    panels = [e for e in by_kind['rigid-motions-panels'].iter() if 'data-motion' in e.attrib]
    require(len(panels) == 3, 'Three motion panels')
    rules = {('translate', -6, 2): '(x, y) → (x − 6, y + 2)', ('reflect', 'x'): '(x, y) → (x, −y)', ('rotate', 90): '(x, y) → (−y, x)'}
    for panel in panels:
        m = json.loads(panel.attrib['data-motion'])
        motion = (m['kind'], m['dx'], m['dy']) if m['kind'] == 'translate' else (m['kind'], m.get('axis', m.get('degrees')))
        require(rules.get(motion) == panel.attrib['data-rule'], 'Panel rule contradicts its motion')
        pts = svg_points(panel)
        for v in 'ABC':
            require(apply(motion, pts[v][0]) == pts[v + '′'][0], 'Panel image misplaced')
        checks += review_scale(panel)
    root = by_kind['dilation-rays']
    pts = svg_points(root)
    k = int(root.attrib['data-scale'])
    require(all(pts[v + '′'][0] == (pts[v][0][0] * k, pts[v][0][1] * k) for v in 'ABC'), 'Dilation images')
    require(len([e for e in root.iter() if 'data-ray' in e.attrib]) == 3, 'One ray per vertex')
    checks += review_scale(root)
    root = by_kind['similar-triangles-marked']
    sides = {e.attrib['data-side']: Fraction(e.attrib['data-length']) for e in root.iter() if 'data-side' in e.attrib}
    ratios = {sides['DE'] / sides['AB'], sides['EF'] / sides['BC'], sides['FD'] / sides['CA']}
    require(len(ratios) == 1, 'Similar triangles need one ratio')
    checks += 1
    root = by_kind['scale-drawing-plan']
    svg = next(e for e in root.iter() if 'data-plan' in e.attrib)
    w, h = map(int, svg.attrib['data-plan'].split('x'))
    s = int(svg.attrib['data-scale'])
    aw, ah = map(int, svg.attrib['data-actual'].split('x'))
    plan_squares = len([e for e in svg.iter() if 'data-plan-square' in e.attrib])
    actual_squares = len([e for e in svg.iter() if 'data-actual-square' in e.attrib])
    require((aw, ah) == (w * s, h * s) and plan_squares == w * h and actual_squares == plan_squares * s * s, 'Scale drawing areas')
    checks += 1
    return checks


def review_content_mutations():
    data = content()
    mutants = []
    bad = copy.deepcopy(data); bad['lessons'][0]['workedExample']['answer'] = '29'; mutants.append(bad)
    bad = copy.deepcopy(data); bad['worksheets'][0]['problems'][1] = bad['worksheets'][0]['problems'][0]; mutants.append(bad)
    bad = copy.deepcopy(data); bad['worksheets'][0]['problems'][0]['explanation'].append('A false check: 4 × 3 = 13.'); mutants.append(bad)
    bad = copy.deepcopy(data); bad['worksheets'][-1]['problems'][0]['answer'] = '999'; mutants.append(bad)
    bad = copy.deepcopy(data); bad['lessons'][4]['sections'][1]['paragraphs'][1] = bad['lessons'][4]['sections'][1]['paragraphs'][1].replace('12 × 4 = 48', '12 × 4 = 47'); mutants.append(bad)
    for index in range(len(data['figures'])):
        bad = copy.deepcopy(data)
        html = bad['figures'][index]['html']
        replaced = re.sub(r'data-(x|measure|leg|length|scale|plan)="(\d+)', lambda m: f'data-{m[1]}="{int(m[2]) + 1}', html, count=1)
        require(replaced != html, 'Figure mutation did not apply: ' + data['figures'][index]['kind'])
        bad['figures'][index]['html'] = replaced
        mutants.append(bad)
    for bad in mutants:
        try:
            review_transformation_content(bad)
        except (ValueError, KeyError, TypeError, StopIteration, AttributeError, IndexError):
            continue
        raise ValueError('Corrupted content accepted')
    return len(mutants)


if __name__ == '__main__':
    print(review_transformation_fixtures())
    print(review_transformation_content())
    print({'contentMutantsRejected': review_content_mutations()})
