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


def scene_elements(figure):
    require(figure['kind'] == 'scene', 'A scene figure')
    return {e.get('id', f'e{i}'): e for i, e in enumerate(figure['scene']['elements'])}


def solve_angle(public):
    family, prompt = public['templateId'], public['prompt']
    el = scene_elements(public['figure'])
    require(family in ANGLES, 'Unsupported family')
    if family == 'protractor-reading':
        found = re.fullmatch(r'What is the measure of angle ([A-Z])([A-Z])([A-Z]), in degrees\?', prompt)
        (p,) = [e for e in el.values() if e['type'] == 'protractor']
        require(found is not None and list(found.groups()) == p['labels'], 'The named angle is the drawn one')
        r0, r1 = p['rays']
        require(r0 in (0, 180) and 0 <= r1 <= 180, 'The first ray lies on the baseline')
        for overlay in (e for e in el.values() if e['type'] == 'angle'):
            require(sorted(overlay['rays']) == sorted(p['rays']), 'The sweep runs between the drawn rays')
        return abs(r1 - r0)
    if family == 'adjacent-angles':
        (g,) = [e for e in el.values() if e['type'] == 'angle']
        d0, d1, d2 = g['rays']
        a, c, d = g['labels']['ends']
        b = g['labels']['vertex']
        drawn = (span(d0, d1), span(d1, d2), span(d0, d2))
        require(abs(drawn[0] + drawn[1] - drawn[2]) < TOL and drawn[2] <= 180, 'The middle ray lies inside the whole angle')
        names = {f'{a}{b}{c}': drawn[0], f'{c}{b}{d}': drawn[1], f'{a}{b}{d}': drawn[2]}
        stated = {m[0]: int(m[1]) for m in re.findall(r'[Aa]ngle ([A-Z]{3}) measures (\d+)°', prompt)}
        for name, value in stated.items():
            require(abs(names[name] - value) < TOL, f'Prompt states {name} as drawn')
        asked = re.search(r'What is the measure of angle ([A-Z]{3})\?$', prompt)
        require(asked is not None and asked[1] not in stated, 'The question asks for an angle the prompt does not give')
        derived = [m for m in g['marks'] if m.get('derived')]
        if asked[1] != f'{a}{b}{d}':
            require(len(derived) == 1 and names[asked[1]] == drawn[derived[0]['from']], 'The unknown part is the one drawn as ?')
        # Solve from the stated measures only.
        if asked[1] == f'{a}{b}{d}':
            return sum(stated.values())
        return stated[f'{a}{b}{d}'] - next(v for k, v in stated.items() if k != f'{a}{b}{d}')
    if family == 'turn-degrees':
        found = re.fullmatch(r'The circle is cut into (\d+) equal angles that meet at its center\. How many degrees is the shaded angle\?', prompt)
        spokes = [e for k, e in el.items() if k.startswith('spoke')]
        require(found is not None and int(found[1]) == len(spokes), 'The prompt counts the drawn angles')
        dirs = sorted(math.degrees(math.atan2(e['to'][1], e['to'][0])) % 360 for e in spokes)
        gaps = [(dirs[(i + 1) % len(dirs)] - dirs[i]) % 360 for i in range(len(dirs))]
        require(max(gaps) - min(gaps) < 1e-6, 'Equal angles')
        shaded = el['shaded']
        swept = shaded['to'] - shaded['from']
        parts = swept / gaps[0]
        require(abs(parts - round(parts)) < 1e-6 and 0 < round(parts) < len(spokes), 'The shading covers whole angles')
        # Count the shaded parts, then use 360 degrees in a full turn.
        return round(round(parts) * 360 / len(spokes))
    if family == 'angle-classify':
        require(prompt == 'What kind of angle is this?', 'Classify wording')
        (g,) = [e for e in el.values() if e['type'] == 'angle']
        m = span(*g['rays'])
        kind = 'right' if abs(m - 90) < TOL else 'straight' if abs(m - 180) < TOL else 'acute' if m < 90 else 'obtuse'
        require(kind in ('right', 'straight') or abs(m - 90) >= 15, 'An acute or obtuse angle is plainly so')
        return only(public, lambda label: label == kind)
    if family == 'line-ray-segment':
        require(prompt == 'Which name matches this figure?', 'Figure wording')
        seg = el['figure']
        p0, p1 = el['point0']['at'], el['point1']['at']
        n0, n1 = el['name0']['text'], el['name1']['text']
        arrow = seg.get('arrow')
        near = lambda q, r: math.hypot(q[0] - r[0], q[1] - r[1]) < TOL
        if arrow == 'both':
            same = {f'line {n0}{n1}', f'line {n1}{n0}'}
        elif arrow is None:
            require(near(seg['from'], p0) and near(seg['to'], p1), 'A segment stops at its points')
            same = {f'line segment {n0}{n1}', f'line segment {n1}{n0}'}
        else:
            require(arrow == 'end', 'One arrow, at the end')
            start = n0 if near(seg['from'], p0) else n1 if near(seg['from'], p1) else None
            require(start is not None, 'A ray starts at one of its points')
            same = {f'ray {start}{n1 if start == n0 else n0}'}
        return only(public, lambda label: label in same)
    if family == 'line-relationship':
        require(prompt == 'How are these two lines related?', 'Lines wording')
        p1, q1, p2, q2 = (el[k]['at'] for k in ('on0a', 'on0b', 'on1a', 'on1b'))
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
        require(prompt == 'Classify this triangle by its angles.', 'Triangle wording')
        points = simplify(el['triangle']['points'])
        require(len(points) == 3, 'A triangle')
        angles = triangle_angles(points)
        top = max(angles)
        kind = 'right' if abs(top - 90) < 0.05 else 'obtuse' if top > 90 else 'acute'
        marked = [k for k in el if k.startswith('right')]
        require(len(marked) == (1 if kind == 'right' else 0), 'Exactly the right angle is marked')
        require(kind == 'right' or abs(top - 90) >= 15, 'The largest angle is plainly acute or obtuse')
        return only(public, lambda label: label == f'{kind} triangle')
    if family == 'symmetry-line-count':
        require(prompt == 'How many lines of symmetry does this shape have?', 'Count wording')
        return symmetry_axes([tuple(p) for p in el['shape']['points']])
    if family == 'symmetry-line-check':
        require(prompt == 'Which dashed line is a line of symmetry?', 'Check wording')
        points = [tuple(p) for p in el['shape']['points']]
        lines = {k[4:]: (e['from'], e['to']) for k, e in el.items() if k.startswith('line')}
        require(set(lines) == {o['label'] for o in public['response']['options']}, 'Options name the drawn lines')
        keys = sorted(lines)
        for i, x in enumerate(keys):
            for y in keys[i + 1:]:
                (a, b), (c, d) = lines[x], lines[y]
                t1 = math.degrees(math.atan2(b[1] - a[1], b[0] - a[0])) % 180
                t2 = math.degrees(math.atan2(d[1] - c[1], d[0] - c[0])) % 180
                if min(abs(t1 - t2), 180 - abs(t1 - t2)) < 8:
                    ux, uy = math.cos(math.radians(t1)), math.sin(math.radians(t1))
                    require(abs((c[0] - a[0]) * uy - (c[1] - a[1]) * ux) >= 0.3, f'Lines {x} and {y} must be told apart')
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

    def scene(*elements):
        return {'kind': 'scene', 'scene': {'v': 1, 'elements': list(elements)}}
    protractor = {'templateId': 'protractor-reading', 'prompt': 'What is the measure of angle ABC, in degrees?',
                  'figure': scene({'type': 'protractor', 'rays': [180, 130], 'labels': ['A', 'B', 'C']})}
    require(solve_angle(protractor) == 50, 'From 0 on the left, a ray at 130 reads 50')
    parts = {'templateId': 'adjacent-angles', 'prompt': 'Angle ABD measures 120°. Angle ABC measures 45°. What is the measure of angle CBD?',
             'figure': scene({'type': 'angle', 'rays': [10, 55, 130], 'labels': {'vertex': 'B', 'ends': ['A', 'C', 'D']},
                              'marks': [{'from': 0, 'to': 1, 'measure': True}, {'from': 1, 'to': 2, 'measure': True, 'derived': True}]})}
    require(solve_angle(parts) == 75, '120 - 45')
    parts['figure']['scene']['elements'][0]['rays'] = [10, 60, 130]
    require(rejects(parts), 'A drawing that disagrees with its numbers is rejected')
    require(symmetry_axes([(-1, -1), (1, -1), (1, 1), (-1, 1)]) == 4, 'A square has 4 lines of symmetry')
    require(symmetry_axes([(-1.6, -0.8), (1.6, -0.8), (1.6, 0.8), (-1.6, 0.8)]) == 2, 'A rectangle has 2')
    require(symmetry_axes([(0, 0), (2.6, 0), (3.4, 1.4), (0.8, 1.4)]) == 0, 'A slanted parallelogram has none')
    hexagon = [(math.cos(math.radians(60 * i)), math.sin(math.radians(60 * i))) for i in range(6)]
    require(symmetry_axes(hexagon) == 6, 'A regular hexagon has 6')
    check = {'templateId': 'symmetry-line-check', 'prompt': 'Which dashed line is a line of symmetry?', 'response': opts('A', 'B'),
             'figure': scene({'type': 'polygon', 'id': 'shape', 'points': [[-1.6, -0.8], [1.6, -0.8], [1.6, 0.8], [-1.6, 0.8]]},
                             {'type': 'segment', 'id': 'lineA', 'from': [-2, -1], 'to': [2, 1]},
                             {'type': 'segment', 'id': 'lineB', 'from': [0, -1.2], 'to': [0, 1.2]})}
    require(solve_angle(check) == 'option-b', 'A rectangle\'s diagonal is not a line of symmetry')
    lines = {'templateId': 'line-relationship', 'prompt': 'How are these two lines related?', 'response': opts('parallel', 'perpendicular', 'neither'),
             'figure': scene(*[{'type': 'point', 'id': k, 'at': at} for k, at in (('on0a', [1, 1]), ('on0b', [3, 2]), ('on1a', [3, 1]), ('on1b', [2, 3]))])}
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
