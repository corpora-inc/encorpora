"""Independent volume and first-quadrant oracle.

Answers come only from the displayed public givens: the prompt and the
semantic figure (cube counts, edge labels, plotted points). Generated answers,
hints and explanations never enter `solve_volume_coordinate`.
"""
import re
from geometry_scene_view import figure_view
from fractions import Fraction

VOLUME_COORDINATE = frozenset({
    'unit-cube-volume', 'cube-layer-count', 'prism-volume-edges', 'prism-missing-edge',
    'composite-prism-volume', 'first-quadrant-locate', 'first-quadrant-coordinates', 'coordinate-move',
})
VOLUME_COORDINATE_CHOICE = frozenset({'first-quadrant-locate', 'first-quadrant-coordinates', 'coordinate-move'})


def require(condition, message):
    if not condition:
        raise ValueError(message)


def whole(value, low, high, what):
    require(type(value) is int and low <= value <= high, f'{what} must be a whole number in [{low}, {high}]')
    return value


def edge(item):
    if item is None:
        return None
    require(set(item) == {'value', 'unit'} and item['unit'] == 'cm', 'Edge must be a centimeter length')
    return whole(item['value'], 1, 12, 'Edge')


def pair(label):
    found = re.fullmatch(r'\((\d+), (\d+)\)', label)
    require(found is not None, f'Not an ordered pair: {label!r}')
    return int(found[1]), int(found[2])


def chosen(public, predicate):
    response = public['response']
    require(response['kind'] == 'choice', 'Choice response required')
    options = response['options']
    require(2 <= len(options) <= 4, 'Two to four options')
    require(len({o['id'] for o in options}) == len(options), 'Duplicate option IDs')
    require(len({o['label'] for o in options}) == len(options), 'Duplicate option labels')
    good = [o['id'] for o in options if predicate(o['label'])]
    require(len(good) == 1, 'Exactly one displayed option must be correct')
    return good[0]


def grid(figure):
    require(figure['kind'] == 'quadrant-grid', 'Quadrant grid required')
    size = whole(figure['size'], 4, 10, 'Grid size')
    points = {}
    for point in figure['points']:
        x, y = whole(point['x'], 0, size, 'x'), whole(point['y'], 0, size, 'y')
        require(point['label'] not in points, 'Duplicate point label')
        require((x, y) not in points.values(), 'Two labels on one point')
        points[point['label']] = (x, y)
    return size, points


def solve_volume_coordinate(public):
    family, prompt, figure = public['templateId'], public['prompt'], figure_view(public['figure'])
    require(family in VOLUME_COORDINATE, 'Unsupported family')
    if family in {'unit-cube-volume', 'cube-layer-count'}:
        require(prompt == ('Each small cube is 1 cubic unit. What is the volume of this rectangular prism, in cubic units?'
                           if family == 'unit-cube-volume' else
                           'This prism is built from unit cubes. How many cubes are in its bottom layer?'), 'Cube wording')
        require(figure['kind'] == 'cube-prism', 'Cube prism required')
        l, w, h = (whole(figure[k], 1, 6, k) for k in ('length', 'width', 'height'))
        # Count cube by cube rather than by formula.
        cubes = [(i, j, k) for i in range(l) for j in range(w) for k in range(h)]
        return Fraction(len(cubes) if family == 'unit-cube-volume' else sum(1 for c in cubes if c[2] == 0))
    if family == 'prism-volume-edges':
        require(prompt == 'What is the volume of this rectangular prism, in cubic centimeters?', 'Prism wording')
        require(figure['kind'] == 'box-prism', 'Box required')
        edges = [edge(figure[k]) for k in ('length', 'width', 'height')]
        require(None not in edges, 'All edges must be displayed')
        return Fraction(edges[0] * edges[1] * edges[2])
    if family == 'prism-missing-edge':
        found = re.fullmatch(r'This rectangular prism has a volume of (\d+) cubic centimeters\. What is the length of the edge marked \?, in centimeters\?', prompt)
        require(found is not None and figure['kind'] == 'box-prism', 'Missing-edge wording')
        volume = int(found[1])
        edges = [edge(figure[k]) for k in ('length', 'width', 'height')]
        require(edges.count(None) == 1, 'Exactly one unknown edge')
        known = [e for e in edges if e is not None]
        # Search every whole edge rather than dividing.
        fits = [n for n in range(1, volume + 1) if known[0] * known[1] * n == volume]
        require(len(fits) == 1, 'Volume must determine one whole edge')
        return Fraction(fits[0])
    if family == 'composite-prism-volume':
        require(prompt == 'This solid is made of two rectangular prisms of the same depth that do not overlap. What is its total volume, in cubic centimeters?', 'Composite wording')
        require(figure['kind'] == 'composite-prism' and figure['unit'] == 'cm' and len(figure['parts']) == 2, 'Composite figure')
        depth = whole(figure['width'], 1, 12, 'Depth')
        parts = [(whole(p['length'], 1, 12, 'Length'), whole(p['height'], 1, 12, 'Height')) for p in figure['parts']]
        require(parts[0][1] > parts[1][1], 'Taller prism stands behind')
        # Unit-cube count of the union: columns over the joint base.
        total = 0
        for x in range(parts[0][0] + parts[1][0]):
            column = parts[0][1] if x < parts[0][0] else parts[1][1]
            total += depth * column
        return Fraction(total)
    size, points = grid(figure)
    if family == 'first-quadrant-locate':
        found = re.fullmatch(r'Which point is at \((\d+), (\d+)\)\?', prompt)
        require(found is not None, 'Locate wording')
        target = (int(found[1]), int(found[2]))
        require(len(points) == 4 and target in points.values(), 'The named pair must be plotted among four points')
        require({o['label'] for o in public['response']['options']} == set(points), 'Options name the plotted points')
        return chosen(public, lambda label: points[label] == target)
    if family == 'first-quadrant-coordinates':
        require(prompt == 'What are the coordinates of point P?' and set(points) == {'P'}, 'Coordinates wording')
        return chosen(public, lambda label: pair(label) == points['P'])
    if family == 'coordinate-move':
        found = re.fullmatch(r'Start at point A\. Move (\d+) units? right and (\d+) units? up\. What are the coordinates of the point where you stop\?', prompt)
        require(found is not None and set(points) == {'A'}, 'Move wording')
        right, up = int(found[1]), int(found[2])
        ax, ay = points['A']
        require(ax + right <= size and ay + up <= size, 'Destination must lie on the grid')
        return chosen(public, lambda label: pair(label) == (ax + right, ay + up))
    raise ValueError('Missing solver')


def review_volume_coordinate_fixtures():
    """Hand-built cases, including ones the oracle must reject."""
    def rejects(public):
        try:
            solve_volume_coordinate(public)
        except ValueError:
            return True
        return False
    cube = {'templateId': 'unit-cube-volume', 'prompt': 'Each small cube is 1 cubic unit. What is the volume of this rectangular prism, in cubic units?',
            'figure': {'kind': 'cube-prism', 'length': 4, 'width': 3, 'height': 2}}
    require(solve_volume_coordinate(cube) == 24, '4 by 3 by 2 holds 24 cubes')
    layer = dict(cube, templateId='cube-layer-count', prompt='This prism is built from unit cubes. How many cubes are in its bottom layer?')
    require(solve_volume_coordinate(layer) == 12, 'A layer of a 4 by 3 base holds 12')
    missing = {'templateId': 'prism-missing-edge', 'prompt': 'This rectangular prism has a volume of 60 cubic centimeters. What is the length of the edge marked ?, in centimeters?',
               'figure': {'kind': 'box-prism', 'length': {'value': 5, 'unit': 'cm'}, 'width': None, 'height': {'value': 3, 'unit': 'cm'}}}
    require(solve_volume_coordinate(missing) == 4, '60 = 5 x 3 x 4')
    require(rejects(dict(missing, prompt=missing['prompt'].replace('60', '61'))), 'A non-whole edge is rejected')
    composite = {'templateId': 'composite-prism-volume',
                 'prompt': 'This solid is made of two rectangular prisms of the same depth that do not overlap. What is its total volume, in cubic centimeters?',
                 'figure': {'kind': 'composite-prism', 'width': 2, 'unit': 'cm', 'parts': [{'length': 3, 'height': 5}, {'length': 4, 'height': 2}]}}
    require(solve_volume_coordinate(composite) == 46, '30 + 16')
    def options(*labels):
        return {'kind': 'choice', 'options': [{'id': f'option-{"abcd"[i]}', 'label': s} for i, s in enumerate(labels)]}
    locate = {'templateId': 'first-quadrant-locate', 'prompt': 'Which point is at (2, 5)?', 'response': options('P', 'Q', 'R', 'S'),
              'figure': {'kind': 'quadrant-grid', 'size': 7, 'points': [{'x': 5, 'y': 2, 'label': 'P'}, {'x': 2, 'y': 5, 'label': 'Q'},
                                                                         {'x': 2, 'y': 4, 'label': 'R'}, {'x': 3, 'y': 5, 'label': 'S'}]}}
    require(solve_volume_coordinate(locate) == 'option-b', 'Across first, then up')
    require(rejects(dict(locate, prompt='Which point is at (6, 6)?')), 'An unplotted pair is rejected')
    coordinates = {'templateId': 'first-quadrant-coordinates', 'prompt': 'What are the coordinates of point P?',
                   'response': options('(4, 1)', '(1, 4)', '(5, 2)'), 'figure': {'kind': 'quadrant-grid', 'size': 6, 'points': [{'x': 1, 'y': 4, 'label': 'P'}]}}
    require(solve_volume_coordinate(coordinates) == 'option-b', 'Reversed pair is wrong')
    move = {'templateId': 'coordinate-move', 'prompt': 'Start at point A. Move 1 unit right and 3 units up. What are the coordinates of the point where you stop?',
            'response': options('(4, 5)', '(6, 3)', '(1, 3)'), 'figure': {'kind': 'quadrant-grid', 'size': 10, 'points': [{'x': 3, 'y': 2, 'label': 'A'}]}}
    require(solve_volume_coordinate(move) == 'option-a', 'Right adds to x, up adds to y')
    move['response'] = options('(4, 5)', '(4, 5 )')
    require(rejects(move), 'Malformed pairs are rejected')
    return 10


def review_volume_coordinate_problem(problem):
    """The worked solution must end at the graded value."""
    public = problem['public']
    text = ' '.join(problem['explanation'])
    if public['response']['kind'] == 'choice':
        label = next(o['label'] for o in public['response']['options'] if o['id'] == problem['answer'])
        require(label in text, f'Explanation never states the answer {label}')
    else:
        require(re.search(rf'(?<![\d.]){re.escape(problem["answer"])}(?![\d.])', problem['explanation'][-1].replace('$', '')) is not None
                or problem['answer'] in problem['explanation'][-2], 'Explanation must conclude with the answer')
    for option_id, note in (problem.get('choiceFeedback') or {}).items():
        label = next(o['label'] for o in public['response']['options'] if o['id'] == option_id)
        require(label in note, f'Feedback for {label} must name the chosen option')
