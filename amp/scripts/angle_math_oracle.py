"""Independent oracle for angle measure, lines and symmetry.

Measures come from the drawn rays, relationships from the drawn lines, and
lines of symmetry from reflecting the drawn vertices. Generated answers,
hints and explanations never enter `solve_angle`.
"""
import math
import re

from shape_math_oracle import only, require, simplify

ANGLES = frozenset({
    'protractor-reading', 'adjacent-angles', 'turn-degrees', 'angle-classify', 'line-ray-segment',
    'line-relationship', 'classify-triangle-angles', 'symmetry-line-count', 'symmetry-line-check',
})
ANGLES_CHOICE = frozenset({'angle-classify', 'line-ray-segment', 'line-relationship', 'classify-triangle-angles', 'symmetry-line-check'})
TOL = 1e-3


def span(a, b):
    """Counterclockwise turn from direction a to direction b, 0–360."""
    return (b - a) % 360


def between(a, b):
    d = abs(a - b) % 360
    return 360 - d if d > 180 else d


def reflect(p, a, b):
    ux, uy = b[0] - a[0], b[1] - a[1]
    n = math.hypot(ux, uy)
    ux, uy = ux / n, uy / n
    dx, dy = p[0] - a[0], p[1] - a[1]
    along = dx * ux + dy * uy
    return (a[0] + 2 * along * ux - dx, a[1] + 2 * along * uy - dy)


def mirrors(points, a, b):
    return all(any(math.hypot(q[0] - s[0], q[1] - s[1]) < 5 * TOL for s in points) for q in (reflect(p, a, b) for p in points))


def symmetry_axes(points):
    """Every axis of a polygon passes through its vertex centroid, and through
    a vertex or the midpoint of a side."""
    n = len(points)
    c = (sum(p[0] for p in points) / n, sum(p[1] for p in points) / n)
    targets = list(points) + [((points[i][0] + points[(i + 1) % n][0]) / 2, (points[i][1] + points[(i + 1) % n][1]) / 2) for i in range(n)]
    directions = set()
    for t in targets:
        if math.hypot(t[0] - c[0], t[1] - c[1]) < TOL:
            continue
        if mirrors(points, c, t):
            directions.add(round(math.degrees(math.atan2(t[1] - c[1], t[0] - c[0])) % 180, 1) % 180)
    merged = []
    for d in sorted(directions):
        if not merged or min(abs(d - merged[-1]), 180 - abs(d - merged[-1])) > 0.5:
            merged.append(d)
    if len(merged) > 1 and 180 - merged[-1] + merged[0] <= 0.5:
        merged.pop()
    return len(merged)


def triangle_angles(points):
    out = []
    for i in range(3):
        u, v, w = points[i - 1], points[i], points[(i + 1) % 3]
        a, b = (u[0] - v[0], u[1] - v[1]), (w[0] - v[0], w[1] - v[1])
        out.append(math.degrees(math.acos(max(-1, min(1, (a[0] * b[0] + a[1] * b[1]) / (math.hypot(*a) * math.hypot(*b)))))))
    return out


def solve_angle(public):
    family, prompt, figure = public['templateId'], public['prompt'], public['figure']
    require(family in ANGLES, 'Unsupported family')
    if family == 'protractor-reading':
        found = re.fullmatch(r'What is the measure of angle ([A-Z])([A-Z])([A-Z]), in degrees\?', prompt)
        require(found is not None and figure['kind'] == 'protractor', 'Protractor wording')
        require(list(found.groups()) == figure['labels'], 'The named angle is the drawn one')
        r0, r1 = figure['rays']
        require(r0 in (0, 180), 'The first ray lies on the baseline')
        require(0 <= r1 <= 180, 'The second ray crosses the scale')
        return abs(r1 - r0)
    if family == 'adjacent-angles':
        require(figure['kind'] == 'angle-parts', 'Angle parts')
        a, b, c, d = figure['labels']
        d0, d1, d2 = figure['rays']
        drawn = (span(d0, d1), span(d1, d2), span(d0, d2))
        require(abs(drawn[0] + drawn[1] - drawn[2]) < TOL and drawn[2] <= 180, 'The middle ray lies inside the whole angle')
        p, q = figure['parts']
        w = figure['whole']
        for given, true in ((p, drawn[0]), (q, drawn[1]), (w, drawn[2])):
            if given is not None:
                require(abs(given - true) < TOL, 'Written measures match the drawing')
        stated = {m[0]: int(m[1]) for m in re.findall(r'Angle ([A-Z]{3}) measures (\d+)°', prompt.replace('and angle', '. Angle'))}
        names = {f'{a}{b}{c}': p, f'{c}{b}{d}': q, f'{a}{b}{d}': w}
        for name, value in stated.items():
            require(names.get(name) == value, f'Prompt states {name} as drawn')
        asked = re.search(r'What is the measure of angle ([A-Z]{3})\?$', prompt)
        require(asked is not None and names.get(asked[1], 0) is None, 'The question asks for the unknown')
        if w is None:
            return p + q
        return w - (q if p is None else p)
    if family == 'turn-degrees':
        found = re.fullmatch(r'The circle is cut into (\d+) equal angles that meet at its center\. How many degrees is the shaded angle\?', prompt)
        require(found is not None and figure['kind'] == 'turn-circle' and int(found[1]) == figure['parts'], 'Turn wording')
        total = 360 * figure['shaded']
        require(total % figure['parts'] == 0, 'Whole degrees')
        return total // figure['parts']
    if family == 'angle-classify':
        require(prompt == 'What kind of angle is this?' and figure['kind'] == 'angle-figure', 'Classify wording')
        m = between(*figure['rays'])
        kind = 'right' if abs(m - 90) < TOL else 'straight' if abs(m - 180) < TOL else 'acute' if m < 90 else 'obtuse'
        require(kind in ('right', 'straight') or abs(m - 90) >= 15, 'An acute or obtuse angle is plainly so')
        return only(public, lambda label: label == kind)
    if family == 'line-ray-segment':
        require(prompt == 'Which name matches this figure?' and figure['kind'] == 'linear-object', 'Figure wording')
        a, b = figure['labels']
        ends = tuple(figure['ends'])
        name = {('arrow', 'arrow'): f'line {a}{b}', ('point', 'point'): f'line segment {a}{b}',
                ('point', 'arrow'): f'ray {a}{b}', ('arrow', 'point'): f'ray {b}{a}'}[ends]
        same = {f'line {a}{b}', f'line {b}{a}'} if ends == ('arrow', 'arrow') else {f'line segment {a}{b}', f'line segment {b}{a}'} if ends == ('point', 'point') else {name}
        return only(public, lambda label: label in same)
    if family == 'line-relationship':
        require(prompt == 'How are these two lines related?' and figure['kind'] == 'line-pair', 'Lines wording')
        (p1, q1), (p2, q2) = figure['lines']
        u = (q1[0] - p1[0], q1[1] - p1[1])
        v = (q2[0] - p2[0], q2[1] - p2[1])
        cross = u[0] * v[1] - u[1] * v[0]
        dot = u[0] * v[0] + u[1] * v[1]
        if cross == 0:
            require(u[0] * (p2[1] - p1[1]) - u[1] * (p2[0] - p1[0]) != 0, 'Two distinct lines')
            kind = 'parallel'
        elif dot == 0:
            kind = 'perpendicular'
        else:
            angle = math.degrees(math.acos(abs(dot) / (math.hypot(*u) * math.hypot(*v))))
            require(angle <= 65, 'Crossing lines that are not perpendicular are plainly so')
            kind = 'neither'
        return only(public, lambda label: label == kind)
    if family == 'classify-triangle-angles':
        require(prompt == 'Classify this triangle by its angles.' and figure['kind'] == 'plane-shapes', 'Triangle wording')
        (item,) = figure['items']
        require(item.get('marks') == 'sides-angles', 'Right angles are marked')
        points = simplify(item['pieces'][0]['points'])
        require(len(points) == 3, 'A triangle')
        top = max(triangle_angles(points))
        kind = 'right' if abs(top - 90) < 0.05 else 'obtuse' if top > 90 else 'acute'
        require(kind == 'right' or abs(top - 90) >= 15, 'The largest angle is plainly acute or obtuse')
        return only(public, lambda label: label == f'{kind} triangle')
    if family == 'symmetry-line-count':
        require(prompt == 'How many lines of symmetry does this shape have?' and figure['kind'] == 'plane-shapes', 'Count wording')
        (item,) = figure['items']
        return symmetry_axes([tuple(p) for p in item['pieces'][0]['points']])
    if family == 'symmetry-line-check':
        require(prompt == 'Which dashed line is a line of symmetry?' and figure['kind'] == 'symmetry-lines', 'Check wording')
        points = [tuple(p) for p in figure['shape']]
        lines = {l['label']: (l['a'], l['b']) for l in figure['lines']}
        require(set(lines) == {o['label'] for o in public['response']['options']}, 'Options name the drawn lines')
        return only(public, lambda label: mirrors(points, *lines[label]))
    raise ValueError('Missing solver')


def review_angle_fixtures():
    def rejects(public):
        try:
            solve_angle(public)
        except ValueError:
            return True
        return False

    def opts(*labels):
        return {'kind': 'choice', 'options': [{'id': f'option-{"abcd"[i]}', 'label': s} for i, s in enumerate(labels)]}
    protractor = {'templateId': 'protractor-reading', 'prompt': 'What is the measure of angle ABC, in degrees?',
                  'figure': {'kind': 'protractor', 'rays': [180, 130], 'labels': ['A', 'B', 'C']}}
    require(solve_angle(protractor) == 50, 'From 0 on the left, a ray at 130 reads 50')
    parts = {'templateId': 'adjacent-angles', 'prompt': 'Angle ABD measures 120°. Angle ABC measures 45°. What is the measure of angle CBD?',
             'figure': {'kind': 'angle-parts', 'rays': [10, 55, 130], 'labels': ['A', 'B', 'C', 'D'], 'parts': [45, None], 'whole': 120}}
    require(solve_angle(parts) == 75, '120 - 45')
    parts['figure']['rays'] = [10, 60, 130]
    require(rejects(parts), 'A drawing that disagrees with its numbers is rejected')
    require(symmetry_axes([(-1, -1), (1, -1), (1, 1), (-1, 1)]) == 4, 'A square has 4 lines of symmetry')
    require(symmetry_axes([(-1.6, -0.8), (1.6, -0.8), (1.6, 0.8), (-1.6, 0.8)]) == 2, 'A rectangle has 2')
    require(symmetry_axes([(0, 0), (2.6, 0), (3.4, 1.4), (0.8, 1.4)]) == 0, 'A slanted parallelogram has none')
    hexagon = [(math.cos(math.radians(60 * i)), math.sin(math.radians(60 * i))) for i in range(6)]
    require(symmetry_axes(hexagon) == 6, 'A regular hexagon has 6')
    check = {'templateId': 'symmetry-line-check', 'prompt': 'Which dashed line is a line of symmetry?', 'response': opts('A', 'B'),
             'figure': {'kind': 'symmetry-lines', 'shape': [[-1.6, -0.8], [1.6, -0.8], [1.6, 0.8], [-1.6, 0.8]],
                        'lines': [{'label': 'A', 'a': [-2, -1], 'b': [2, 1]}, {'label': 'B', 'a': [0, -1.2], 'b': [0, 1.2]}]}}
    require(solve_angle(check) == 'option-b', 'A rectangle\'s diagonal is not a line of symmetry')
    lines = {'templateId': 'line-relationship', 'prompt': 'How are these two lines related?', 'response': opts('parallel', 'perpendicular', 'neither'),
             'figure': {'kind': 'line-pair', 'columns': 7, 'rows': 6, 'lines': [[[1, 1], [3, 2]], [[3, 1], [2, 3]]]}}
    require(solve_angle(lines) == 'option-b', '(2, 1) and (-1, 2) are perpendicular')
    return 9


def review_angle_problem(problem):
    public = problem['public']
    text = ' '.join(problem['explanation'])
    if public['response']['kind'] == 'choice':
        label = next(o['label'] for o in public['response']['options'] if o['id'] == problem['answer'])
        require(label in text or f'line {label}' in text.lower(), f'Explanation never names the answer {label}')
    else:
        require(re.search(rf'(?<!\d){problem["answer"]}(?!\d)', problem['explanation'][-1]) is not None, 'Explanation must conclude with the answer')
