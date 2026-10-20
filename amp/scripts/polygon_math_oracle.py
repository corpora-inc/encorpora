"""Independent oracle for polygons, solids' parts and quadrilateral categories.

Shapes are classified from their drawn vertices with this file's own
definitions (inclusive: a square is a rectangle and a rhombus). Category
statements are judged on this file's own representative quadrilaterals.
Generated answers, hints and explanations never enter `solve_polygon`.
"""
import math
from geometry_scene_view import figure_view
import re

from shape_math_oracle import EPS, equal, only, options, require, right_corners, sides, simple, simplify

POLYGONS = frozenset({
    'name-polygon', 'polygon-with-angles', 'solid-parts', 'classify-quadrilateral', 'find-quadrilateral',
    'quadrilateral-names', 'hierarchy-statement', 'inherited-property',
})
POLYGONS_CHOICE = POLYGONS - {'solid-parts'}
NAMES = {3: 'triangle', 4: 'quadrilateral', 5: 'pentagon', 6: 'hexagon', 8: 'octagon'}
ORDER = ['square', 'rectangle', 'rhombus', 'parallelogram', 'quadrilateral']


def parallel(a, b, c, d):
    u, v = (b[0] - a[0], b[1] - a[1]), (d[0] - c[0], d[1] - c[1])
    return abs(u[0] * v[1] - u[1] * v[0]) <= EPS * math.hypot(*u) * math.hypot(*v)


def facts(points):
    p = simplify(points)
    require(len(p) == 4 and simple(p), 'A simple quadrilateral')
    pairs = sum(parallel(p[i], p[i + 1], p[(i + 2) % 4], p[(i + 3) % 4]) for i in range(2))
    s = sides(p)
    return {
        'right': right_corners(p),
        'equal': equal(s),
        'pairs': pairs,
        'opposite-equal': abs(s[0] - s[2]) <= EPS * s[0] and abs(s[1] - s[3]) <= EPS * s[1],
        'kite': (abs(s[0] - s[1]) <= EPS * s[0] and abs(s[2] - s[3]) <= EPS * s[2])
        or (abs(s[1] - s[2]) <= EPS * s[1] and abs(s[3] - s[0]) <= EPS * s[3]),
    }


def member(name, f):
    return {
        'square': f['right'] == 4 and f['equal'],
        'rectangle': f['right'] == 4,
        'rhombus': f['equal'],
        'parallelogram': f['pairs'] == 2,
        'trapezoid': f['pairs'] >= 1,
        'kite': f['kite'],
        'quadrilateral': True,
    }[name]


def names(points):
    f = facts(points)
    return {n for n in ORDER if member(n, f)}


PROPERTY = {
    '2 pairs of parallel sides': lambda f: f['pairs'] == 2,
    'opposite sides of equal length': lambda f: f['opposite-equal'],
    '4 right angles': lambda f: f['right'] == 4,
    '4 sides of equal length': lambda f: f['equal'],
}


def representatives():
    """One concrete quadrilateral of every kind this oracle knows."""
    t = math.radians(63)
    return [
        [(0, 0), (2, 0), (2, 2), (0, 2)],
        [(0, 0), (3, 0), (3, 1.4), (0, 1.4)],
        [(0, 0), (2, 0), (2 + 2 * math.cos(t), 2 * math.sin(t)), (2 * math.cos(t), 2 * math.sin(t))],
        [(0, 0), (3, 0), (3 + 1.3 * math.cos(t), 1.3 * math.sin(t)), (1.3 * math.cos(t), 1.3 * math.sin(t))],
        [(0, 0), (3, 0), (2.1, 1.2), (0.5, 1.2)],
        [(0, -0.8), (1, 0), (0, 2), (-1, 0)],
        [(0, 0), (2.6, 0.3), (2.1, 1.9), (-0.4, 1.2)],
    ]


def always(x, y):
    """Every representative that is an x is also a y."""
    fs = [facts(p) for p in representatives()]
    return all(member(y, f) for f in fs if member(x, f))


def must_have(kind, prop):
    fs = [facts(p) for p in representatives()]
    found = [f for f in fs if member(kind, f)]
    require(found, f'No representative {kind}')
    return all(PROPERTY[prop](f) for f in found)


def solid_counts(solid):
    """Build the polyhedron and count its parts."""
    require(solid['base']['type'] == 'polygon', 'A straight-edged solid')
    base = [tuple(p) for p in simplify(solid['base']['points'])]
    n = len(base)
    bottom = [('b', i) for i in range(n)]
    edges = {frozenset((bottom[i], bottom[(i + 1) % n])) for i in range(n)}
    faces = [tuple(bottom)]
    if solid['type'] == 'prism':
        top = [('t', i) for i in range(n)]
        vertices = bottom + top
        edges |= {frozenset((top[i], top[(i + 1) % n])) for i in range(n)}
        edges |= {frozenset((bottom[i], top[i])) for i in range(n)}
        faces += [tuple(top)] + [(bottom[i], bottom[(i + 1) % n], top[(i + 1) % n], top[i]) for i in range(n)]
    else:
        vertices = bottom + [('apex', 0)]
        edges |= {frozenset((b, ('apex', 0))) for b in bottom}
        faces += [(bottom[i], bottom[(i + 1) % n], ('apex', 0)) for i in range(n)]
    counts = {'faces': len(faces), 'edges': len(edges), 'vertices': len(vertices)}
    require(counts['vertices'] - counts['edges'] + counts['faces'] == 2, 'Euler: V - E + F = 2')
    return n, counts


def items(figure):
    require(figure['kind'] == 'plane-shapes', 'Plane shapes')
    out = {}
    for item in figure['items']:
        require(len(item['pieces']) == 1 and item['pieces'][0]['type'] == 'polygon', 'One polygon per item')
        out[item.get('label')] = item['pieces'][0]['points']
    return out


def solve_polygon(public):
    family, prompt = public['templateId'], public['prompt']
    figure = figure_view(public.get('figure'))
    require(family in POLYGONS, 'Unsupported family')
    if family == 'name-polygon':
        require(prompt == 'What kind of polygon is this?', 'Name wording')
        (points,) = items(figure).values()
        p = simplify(points)
        require(simple(p) and len(p) == len(points), 'Every drawn vertex is a corner')
        require({o['label'] for o in options(public)} <= set(NAMES.values()), 'Polygon names only')
        return only(public, lambda label: label == NAMES[len(p)])
    if family == 'polygon-with-angles':
        found = re.fullmatch(r'Which shape has exactly (\d+) angles\?', prompt)
        require(found is not None, 'Angles wording')
        shapes = items(figure)
        require(set(shapes) == {o['label'] for o in options(public)}, 'Options name the lettered shapes')
        count = {k: len(simplify(v)) for k, v in shapes.items()}
        require(all(count[k] == len(v) and simple(simplify(v)) for k, v in shapes.items()), 'Every drawn vertex is a corner')
        return only(public, lambda label: count[label] == int(found[1]))
    if family == 'solid-parts':
        found = re.fullmatch(r'How many (faces|edges|vertices) does this solid have\? Dashed lines show edges hidden at the back\.', prompt)
        require(found is not None and figure['kind'] == 'solid-shape', 'Solid wording')
        return solid_counts(figure['solid'])[1][found[1]]
    if family == 'classify-quadrilateral':
        require(prompt == 'Which is the most exact name for this shape?', 'Classify wording')
        (item,) = figure['items']
        require(item.get('marks') in ('sides-angles', 'parallel'), 'Marked sides and angles')
        fits = names(item['pieces'][0]['points'])
        shown = [o['label'] for o in options(public)]
        require(set(shown) <= set(ORDER), 'Category names only')
        exact = next(n for n in ORDER if n in fits and n in shown)
        return only(public, lambda label: label == exact)
    if family == 'find-quadrilateral':
        shapes = items(figure)
        require(all(i.get('marks') == 'sides-angles' for i in figure['items']), 'Marked shapes')
        require(set(shapes) == {o['label'] for o in options(public)}, 'Options name the lettered shapes')
        if prompt == 'Which quadrilateral is not a square, a rectangle or a rhombus?':
            return only(public, lambda label: not names(shapes[label]) & {'square', 'rectangle', 'rhombus'})
        found = re.fullmatch(r'Which shape is an? (square|rectangle|rhombus)\?', prompt)
        require(found is not None, 'Find wording')
        return only(public, lambda label: found[1] in names(shapes[label]))
    if family == 'quadrilateral-names':
        require(prompt == 'Which list gives every name that fits this shape?', 'Names wording')
        (item,) = figure['items']
        require(item.get('marks') == 'parallel', 'Parallel sides must be marked to judge parallelograms')
        fits = names(item['pieces'][0]['points'])

        def listed(label):
            parts = label.split(', ')
            require(len(set(parts)) == len(parts) and set(parts) <= set(ORDER), f'Bad list {label!r}')
            return set(parts)
        return only(public, lambda label: listed(label) == fits)
    if family == 'hierarchy-statement':
        require(prompt == 'Which statement is always true?' and figure is None, 'Statement wording')

        def true(label):
            found = re.fullmatch(r'Every (\w+) is an? (\w+)\.', label)
            require(found is not None and found[1] in ORDER and found[2] in ORDER, f'Bad statement {label!r}')
            return always(found[1], found[2])
        return only(public, true)
    if family == 'inherited-property':
        found = re.fullmatch(r'Every (\w+) has (.+)\. Which shape must also have \2\?', prompt)
        require(found is not None and found[2] in PROPERTY and figure is None, 'Property wording')
        require(must_have(found[1], found[2]), 'The stated property is true of the category')
        return only(public, lambda label: must_have(label, found[2]))
    raise ValueError('Missing solver')


def review_polygon_fixtures():
    def rejects(public):
        try:
            solve_polygon(public)
        except ValueError:
            return True
        return False

    def opts(*labels):
        return {'kind': 'choice', 'options': [{'id': f'option-{"abcd"[i]}', 'label': s} for i, s in enumerate(labels)]}
    reps = representatives()
    require(names(reps[0]) == set(ORDER), 'A square has every name')
    require(names(reps[3]) == {'parallelogram', 'quadrilateral'}, 'A slanted parallelogram')
    require(names(reps[5]) == {'quadrilateral'}, 'A kite is in none of the parallelogram family')
    require(always('square', 'rhombus') and not always('rhombus', 'square'), 'Inclusion runs one way')
    require(must_have('square', '4 right angles') and not must_have('trapezoid', '2 pairs of parallel sides'), 'Inherited properties')
    cube = {'type': 'prism', 'base': {'type': 'polygon', 'points': [[0, 0], [1, 0], [1, 1], [0, 1]]}, 'height': 1}
    require(solid_counts(cube)[1] == {'faces': 6, 'edges': 12, 'vertices': 8}, 'Cube counts')
    pyramid = dict(cube, type='pyramid')
    require(solid_counts(pyramid)[1] == {'faces': 5, 'edges': 8, 'vertices': 5}, 'Square pyramid counts')
    statement = {'templateId': 'hierarchy-statement', 'prompt': 'Which statement is always true?',
                 'response': opts('Every square is a rectangle.', 'Every rectangle is a square.', 'Every rhombus is a square.')}
    require(solve_polygon(statement) == 'option-a', 'Squares are rectangles')
    statement['response'] = opts('Every square is a rectangle.', 'Every square is a rhombus.')
    require(rejects(statement), 'Two true statements are ambiguous')
    classify = {'templateId': 'classify-quadrilateral', 'prompt': 'Which is the most exact name for this shape?',
                'response': opts('square', 'rectangle', 'rhombus', 'quadrilateral'),
                'figure': {'kind': 'plane-shapes', 'items': [{'pieces': [{'type': 'polygon', 'points': reps[2]}], 'marks': 'sides-angles'}]}}
    require(solve_polygon(classify) == 'option-c', 'A slanted rhombus')
    return 9


def review_polygon_problem(problem):
    public = problem['public']
    text = ' '.join(problem['explanation'])
    if public['response']['kind'] == 'choice':
        label = next(o['label'] for o in public['response']['options'] if o['id'] == problem['answer'])
        require(label.rstrip('.').lower() in text.lower() or f'Shape {label}' in text, f'Explanation never names the answer {label}')
    else:
        require(re.search(rf'(?<!\d){problem["answer"]}(?!\d)', problem['explanation'][-1]) is not None, 'Explanation must conclude with the answer')
