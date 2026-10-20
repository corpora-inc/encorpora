"""Independent oracle for flat and solid shapes.

Every answer is computed from the displayed figure's coordinates: shapes are
classified from their vertices, a composite's outline is found by cancelling
shared edges, and a puzzle's gap is the outline minus the placed pieces.
Generated answers, hints and explanations never enter `solve_shape`.
"""
import math
from geometry_scene_view import figure_view
import re

SHAPES = frozenset({
    'name-flat-shape', 'find-named-shape', 'name-solid-shape', 'compose-shape-name',
    'complete-the-shape', 'count-sides-corners', 'defining-attribute',
})
SHAPES_CHOICE = SHAPES - {'count-sides-corners'}
EPS = 1e-3


def require(condition, message):
    if not condition:
        raise ValueError(message)


def options(public):
    response = public['response']
    require(response['kind'] == 'choice', 'Choice response required')
    found = response['options']
    require(2 <= len(found) <= 4, 'Two to four options')
    require(len({o['id'] for o in found}) == len(found), 'Duplicate option IDs')
    require(len({o['label'] for o in found}) == len(found), 'Duplicate option labels')
    return found


def only(public, predicate):
    good = [o['id'] for o in options(public) if predicate(o['label'])]
    require(len(good) == 1, f'Exactly one displayed option must be correct, got {len(good)}')
    return good[0]


# Plane geometry -----------------------------------------------------------

def area(points):
    return sum(points[i][0] * points[(i + 1) % len(points)][1] - points[(i + 1) % len(points)][0] * points[i][1]
               for i in range(len(points))) / 2


def ccw(points):
    points = [tuple(p) for p in points]
    return points if area(points) > 0 else points[::-1]


def simplify(points):
    """Drop vertices where the boundary goes straight on."""
    points = [tuple(p) for p in points]
    changed = True
    while changed and len(points) > 3:
        changed = False
        for i in range(len(points)):
            u, v, w = points[i - 1], points[i], points[(i + 1) % len(points)]
            a, b = (v[0] - u[0], v[1] - u[1]), (w[0] - v[0], w[1] - v[1])
            la, lb = math.hypot(*a), math.hypot(*b)
            if la < EPS or (abs(a[0] * b[1] - a[1] * b[0]) / (la * lb) < EPS and a[0] * b[0] + a[1] * b[1] > 0):
                del points[i]
                changed = True
                break
    return points


def sides(points):
    return [math.hypot(points[(i + 1) % len(points)][0] - p[0], points[(i + 1) % len(points)][1] - p[1]) for i, p in enumerate(points)]


def right_corners(points):
    n = len(points)
    count = 0
    for i in range(n):
        u, v, w = points[i - 1], points[i], points[(i + 1) % n]
        a, b = (u[0] - v[0], u[1] - v[1]), (w[0] - v[0], w[1] - v[1])
        if abs(a[0] * b[0] + a[1] * b[1]) / (math.hypot(*a) * math.hypot(*b)) < EPS:
            count += 1
    return count


def simple(points):
    """No two non-adjacent sides touch."""
    n = len(points)

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    for i in range(n):
        for j in range(i + 1, n):
            if j == i + 1 or (i == 0 and j == n - 1):
                continue
            a, b, c, d = points[i], points[(i + 1) % n], points[j], points[(j + 1) % n]
            if cross(a, b, c) * cross(a, b, d) <= 0 and cross(c, d, a) * cross(c, d, b) <= 0:
                return False
    return True


def equal(values, tolerance=EPS):
    return max(values) - min(values) <= tolerance * max(values)


def classify_polygon(points):
    points = simplify(points)
    require(simple(points), 'Shape outline must not cross itself')
    n = len(points)
    if n == 3:
        return 'triangle'
    if n == 4:
        rights, same = right_corners(points), equal(sides(points))
        if rights == 4:
            return 'square' if same else 'rectangle'
        if same:
            return 'rhombus'
        return 'quadrilateral'
    return {5: 'pentagon', 6: 'hexagon', 8: 'octagon'}.get(n, f'{n}-gon')


def classify(shape):
    if shape['type'] == 'ellipse':
        a, b = shape['radii']
        return 'circle' if abs(a - b) <= EPS * max(a, b) else 'oval'
    return classify_polygon(shape['points'])


def names(shape):
    """Every K–2 name that is true of a shape: a square is also a rectangle."""
    kind = classify(shape)
    return {kind, 'rectangle'} if kind == 'square' else {kind}


def key(p):
    return (round(p[0], 3) + 0.0, round(p[1], 3) + 0.0)


def boundary(loops):
    """Cancel every edge traversed both ways; return the loop that remains.
    Edges are split at every vertex lying on them, so a long outline side
    cancels against the short piece sides along it."""
    vertices = {key(p): p for loop in loops for p in loop}
    edges = []
    for loop in loops:
        for i, a in enumerate(loop):
            b = loop[(i + 1) % len(loop)]
            length = math.hypot(b[0] - a[0], b[1] - a[1])
            # Cut at the drawn vertices themselves, so both sides of a seam
            # name exactly the same points.
            cuts = [(0.0, key(a)), (1.0, key(b))]
            for v in vertices.values():
                t = ((v[0] - a[0]) * (b[0] - a[0]) + (v[1] - a[1]) * (b[1] - a[1])) / (length * length)
                off = abs((b[0] - a[0]) * (v[1] - a[1]) - (b[1] - a[1]) * (v[0] - a[0])) / length
                if EPS < t < 1 - EPS and off < EPS:
                    cuts.append((t, key(v)))
            cuts.sort()
            for (_, s), (_, t) in zip(cuts, cuts[1:]):
                edges.append((s, t))
    remaining = list(edges)
    for e in edges:
        if e in remaining and (e[1], e[0]) in remaining:
            remaining.remove(e)
            remaining.remove((e[1], e[0]))
    require(remaining, 'Nothing remains after cancelling shared edges')
    following = {}
    for a, b in remaining:
        require(a not in following, 'The remaining edges must form one simple loop')
        following[a] = b
    start = remaining[0][0]
    loop, at = [start], following[start]
    while at != start:
        require(len(loop) <= len(remaining), 'The remaining edges must form one loop')
        loop.append(at)
        at = following[at]
    require(len(loop) == len(remaining), 'The remaining edges must form exactly one loop')
    return loop


def outline(pieces):
    loops = [ccw(p['points']) for p in pieces]
    require(all(p['type'] == 'polygon' for p in pieces), 'Composite pieces are polygons')
    shape = boundary(loops)
    require(abs(abs(area(shape)) - sum(area(l) for l in loops)) < EPS * 10, 'Pieces must not overlap')
    return shape


def congruent(a, b, mirror):
    """Same cyclic sequence of side lengths and turns, up to rotation."""
    a, b = simplify(ccw(a)), simplify(ccw(b))
    if len(a) != len(b):
        return False

    def signature(p):
        out = []
        for i, v in enumerate(p):
            u, w = p[i - 1], p[(i + 1) % len(p)]
            d1, d2 = (v[0] - u[0], v[1] - u[1]), (w[0] - v[0], w[1] - v[1])
            out.append((math.hypot(*d2), math.atan2(d1[0] * d2[1] - d1[1] * d2[0], d1[0] * d2[0] + d1[1] * d2[1])))
        return out
    sa = signature(a)
    candidates = [signature(b)]
    if mirror:
        candidates.append(signature(ccw([(-x, y) for x, y in b])))
    n = len(sa)
    return any(all(abs(sa[i][0] - sb[(i + k) % n][0]) < 5 * EPS and abs(sa[i][1] - sb[(i + k) % n][1]) < 5 * EPS
                   for i in range(n)) for sb in candidates for k in range(n))


# Solids -------------------------------------------------------------------

def classify_solid(solid):
    if solid['type'] == 'sphere':
        return 'sphere'
    base = solid['base']
    if base['type'] == 'ellipse':
        require(classify(base) == 'circle', 'Curved solids stand on a circle')
        return 'cylinder' if solid['type'] == 'prism' else 'cone'
    kind = classify_polygon(base['points'])
    if solid['type'] == 'prism' and kind == 'square' and abs(sides(base['points'])[0] - solid['height']) < EPS:
        return 'cube'
    return {'prism': 'prism', 'pyramid': 'pyramid'}[solid['type']] + ':' + kind


# Attributes ---------------------------------------------------------------

def extent(points):
    xs, ys = [p[0] for p in points], [p[1] for p in points]
    return max(xs) - min(xs), max(ys) - min(ys)


def flat_bottom(points):
    low = min(p[1] for p in points)
    return any(abs(points[i][1] - low) < EPS and abs(points[(i + 1) % len(points)][1] - low) < EPS for i in range(len(points)))


def level_gap(points):
    """Smallest angle, in degrees, between any side and the horizontal."""
    out = 90
    for i, a in enumerate(points):
        b = points[(i + 1) % len(points)]
        t = abs(math.degrees(math.atan2(b[1] - a[1], b[0] - a[0]))) % 180
        out = min(out, t, 180 - t)
    return out


STATEMENTS = {
    'All of its sides are the same length.': lambda p: equal(sides(p)),
    'It has a side that lies flat along the bottom.': flat_bottom,
    'It is taller than it is wide.': lambda p: extent(p)[1] > extent(p)[0],
    'It is wider than it is tall.': lambda p: extent(p)[0] > extent(p)[1],
}
DEFINING = {
    'triangle': ('It has exactly 3 straight sides and 3 corners.', lambda p: len(simplify(p)) == 3),
    'rectangle': ('It has 4 straight sides and 4 square corners.', lambda p: len(simplify(p)) == 4 and right_corners(simplify(p)) == 4),
    'hexagon': ('It has exactly 6 straight sides and 6 corners.', lambda p: len(simplify(p)) == 6),
}


def visibly_refutes(statement, points):
    """A counterexample must be plain to see, not a rounding artifact."""
    w, h = extent(points)
    if statement.startswith('All of its sides'):
        return max(sides(points)) >= 1.2 * min(sides(points))
    if statement.startswith('It has a side that lies flat'):
        return level_gap(points) >= 15
    if statement.startswith('It is taller'):
        return w >= 1.12 * h
    return h >= 1.12 * w


SOLID_NAMES = {'cube', 'cone', 'cylinder', 'sphere'}
FLAT_NAMES = {'circle', 'triangle', 'square', 'rectangle', 'hexagon'}


def solve_shape(public):
    family, prompt, figure = public['templateId'], public['prompt'], figure_view(public['figure'])
    require(family in SHAPES, 'Unsupported family')
    if family == 'name-flat-shape':
        require(prompt == 'What is the name of this shape?' and figure['kind'] == 'plane-shapes', 'Name wording')
        require(len(figure['items']) == 1 and len(figure['items'][0]['pieces']) == 1, 'One shape')
        shape = figure['items'][0]['pieces'][0]
        require({o['label'] for o in options(public)} <= FLAT_NAMES, 'Options are K shape names')
        return only(public, lambda label: label in names(shape))
    if family == 'find-named-shape':
        found = re.fullmatch(r'Which shape is an? (triangle|square|rectangle|hexagon|circle)\?', prompt)
        require(found is not None and figure['kind'] == 'plane-shapes', 'Find wording')
        items = {i['label']: i['pieces'] for i in figure['items']}
        require(set(items) == {o['label'] for o in options(public)} and all(len(p) == 1 for p in items.values()), 'Options name the lettered shapes')
        return only(public, lambda label: found[1] in names(items[label][0]))
    if family == 'name-solid-shape':
        require(prompt == 'What is the name of this solid shape?' and figure['kind'] == 'solid-shape', 'Solid wording')
        kind = classify_solid(figure['solid'])
        require(kind in SOLID_NAMES, 'A K solid')
        return only(public, lambda label: label == kind)
    if family == 'compose-shape-name':
        found = re.fullmatch(r'These (\d+) (triangles|squares|rectangles|pieces) are put together with no gaps or overlaps\. What shape do they make\?', prompt)
        require(found is not None and figure['kind'] == 'plane-shapes' and len(figure['items']) == 1, 'Compose wording')
        pieces = figure['items'][0]['pieces']
        require(len(pieces) == int(found[1]) >= 2, 'The count names the pieces')
        if found[2] != 'pieces':
            require(all(classify(p) == found[2][:-1] for p in pieces), 'Every piece is the named kind')
        whole = {'type': 'polygon', 'points': outline(pieces)}
        return only(public, lambda label: label in names(whole))
    if family == 'complete-the-shape':
        found = re.fullmatch(r'Which piece fills the empty space to complete the (triangle|square|rectangle|hexagon)\? A piece may be turned\.', prompt)
        require(found is not None and figure['kind'] == 'shape-puzzle', 'Puzzle wording')
        target = ccw(figure['outline'])
        require(found[1] in names({'type': 'polygon', 'points': target}), 'The outline is the named shape')
        placed = [ccw(p['points']) for p in figure['placed']]
        gap = boundary([target] + [p[::-1] for p in placed])
        require(abs(area(target) - sum(area(p) for p in placed) - area(gap)) < 10 * EPS, 'Placed pieces lie inside the outline without overlap')
        candidates = {c['label']: c['pieces'] for c in figure['candidates']}
        require(set(candidates) == {o['label'] for o in options(public)} and all(len(p) == 1 for p in candidates.values()), 'Options name the lettered pieces')
        for label, piece in candidates.items():
            fits = congruent(gap, piece[0]['points'], False)
            require(fits or not congruent(gap, piece[0]['points'], True), f'Piece {label} fits only when flipped')
        return only(public, lambda label: congruent(gap, candidates[label][0]['points'], False))
    if family == 'count-sides-corners':
        require(prompt in ('How many sides does this shape have?', 'How many corners, or vertices, does this shape have?'), 'Count wording')
        require(figure['kind'] == 'plane-shapes' and len(figure['items']) == 1 and len(figure['items'][0]['pieces']) == 1, 'One shape')
        shape = figure['items'][0]['pieces'][0]
        require(shape['type'] == 'polygon', 'A straight-sided shape')
        points = simplify(shape['points'])
        require(simple(points) and len(points) == len(shape['points']), 'Every drawn vertex is a true corner')
        return len(points)
    if family == 'defining-attribute':
        found = re.fullmatch(r'Shapes A, B and C are all (triangle|rectangle|hexagon)s\. Which sentence is true for every \1\?', prompt)
        require(found is not None and figure['kind'] == 'plane-shapes', 'Attribute wording')
        category = found[1]
        shapes = [simplify(i['pieces'][0]['points']) for i in figure['items']]
        require([i['label'] for i in figure['items']] == ['A', 'B', 'C'], 'Three lettered shapes')
        require(all(category in names({'type': 'polygon', 'points': s}) for s in shapes), 'Every shape is the named kind')
        defining, test = DEFINING[category]

        def true_for_all(label):
            if label == defining:
                return all(test(s) for s in shapes)
            require(label in STATEMENTS, f'Unknown statement {label!r}')
            holds = [STATEMENTS[label](s) for s in shapes]
            if not all(holds):
                require(any(not h and visibly_refutes(label, s) for h, s in zip(holds, shapes)), f'{label!r} is refuted only invisibly')
            return all(holds)
        return only(public, true_for_all)
    raise ValueError('Missing solver')


def review_shape_fixtures():
    """Hand-built cases, including ones the oracle must reject."""
    def rejects(public):
        try:
            solve_shape(public)
        except ValueError:
            return True
        return False

    def opts(*labels):
        return {'kind': 'choice', 'options': [{'id': f'option-{"abcd"[i]}', 'label': s} for i, s in enumerate(labels)]}

    def poly(*points):
        return {'type': 'polygon', 'points': [list(p) for p in points]}
    s = math.sqrt(2) / 2
    diamond = poly((0, -s), (s, 0), (0, s), (-s, 0))
    named = {'templateId': 'name-flat-shape', 'prompt': 'What is the name of this shape?', 'response': opts('triangle', 'square', 'circle'),
             'figure': {'kind': 'plane-shapes', 'items': [{'pieces': [diamond]}]}}
    require(solve_shape(named) == 'option-b', 'A square turned 45 degrees is still a square')
    named['response'] = opts('square', 'rectangle', 'circle')
    require(rejects(named), 'A square offered with "rectangle" has two right answers')
    require(classify(poly((0, 0), (1, 0), (2, 0), (2, 1), (0, 1))) == 'rectangle', 'A straight-through vertex is not a corner')
    require(classify(poly((0, 0), (2, 0), (2.4, 1), (0.4, 1))) == 'quadrilateral', 'A slanted four-sided shape is no rectangle')
    two = [poly((0, 0), (2, 0), (2, 2)), poly((0, 0), (2, 2), (0, 2))]
    require(classify({'type': 'polygon', 'points': outline(two)}) == 'square', 'Two half-squares make a square')
    h = math.sqrt(3) / 2
    medial = [poly((0, 0), (1, 0), (0.5, h)), poly((1, 0), (2, 0), (1.5, h)), poly((0.5, h), (1.5, h), (1, 2 * h)), poly((1, 0), (1.5, h), (0.5, h))]
    require(classify({'type': 'polygon', 'points': outline(medial)}) == 'triangle', 'Four small triangles make one large triangle')
    try:
        outline([poly((0, 0), (2, 0), (2, 2), (0, 2)), poly((1, 0), (3, 0), (3, 2), (1, 2))])
        require(False, 'Overlapping pieces are rejected')
    except ValueError:
        pass
    puzzle = {'templateId': 'complete-the-shape', 'prompt': 'Which piece fills the empty space to complete the square? A piece may be turned.',
              'response': opts('A', 'B', 'C'),
              'figure': {'kind': 'shape-puzzle', 'outline': [[0, 0], [2, 0], [2, 2], [0, 2]], 'placed': [poly((0, 0), (2, 0), (2, 2))],
                         'candidates': [{'label': 'A', 'pieces': [poly((0, 0), (1, 0), (1, 1))]},
                                        {'label': 'B', 'pieces': [poly((0, 0), (0, -2), (2, 0))]},
                                        {'label': 'C', 'pieces': [poly((0, 0), (3, 0), (0, 2))]}]}}
    require(solve_shape(puzzle) == 'option-b', 'The turned half-square fills the gap')
    attribute = {'templateId': 'defining-attribute', 'prompt': 'Shapes A, B and C are all triangles. Which sentence is true for every triangle?',
                 'response': opts('It has exactly 3 straight sides and 3 corners.', 'It is wider than it is tall.'),
                 'figure': {'kind': 'plane-shapes', 'items': [{'label': 'A', 'pieces': [poly((0, 0), (2, 0), (1, 1))]},
                                                              {'label': 'B', 'pieces': [poly((0, 0), (1, 0), (0.5, 3))]},
                                                              {'label': 'C', 'pieces': [poly((0, 0), (3, 0), (0, 1))]}]}}
    require(solve_shape(attribute) == 'option-a', 'Only the side count is defining')
    attribute['figure']['items'][1]['pieces'] = [poly((0, 0), (1, 0), (0.5, 1.02))]
    require(rejects(attribute), 'A counterexample that is barely taller is not visible enough')
    cube = {'type': 'prism', 'base': poly((-1, -1), (1, -1), (1, 1), (-1, 1)), 'height': 2}
    require(classify_solid(cube) == 'cube' and classify_solid(dict(cube, height=3)) == 'prism:square', 'A cube has equal edges')
    require(classify_solid({'type': 'pyramid', 'base': {'type': 'ellipse', 'center': [0, 0], 'radii': [1, 1], 'angle': 0}, 'height': 2}) == 'cone', 'Cone')
    return 12


def review_shape_problem(problem):
    """The worked solution must name the graded answer."""
    public = problem['public']
    text = ' '.join(problem['explanation'])
    if public['response']['kind'] == 'choice':
        label = next(o['label'] for o in public['response']['options'] if o['id'] == problem['answer'])
        require(label in text or f'Shape {label}' in text or f'Piece {label}' in text, f'Explanation never names the answer {label}')
        for option_id, note in (problem.get('choiceFeedback') or {}).items():
            chosen = next(o['label'] for o in public['response']['options'] if o['id'] == option_id)
            require(len(chosen) > 1 or f' {chosen} ' in f' {note} ', f'Feedback for {chosen} must name it')
    else:
        require(re.search(rf'(?<!\d){problem["answer"]}(?!\d)', problem['explanation'][-1]) is not None, 'Explanation must conclude with the answer')
