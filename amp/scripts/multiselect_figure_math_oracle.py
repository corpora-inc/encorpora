"""Independent oracle for the select-all figure families.

Every verdict is read from the drawn coordinates: polygon vertices, segment
ends, angle arms, protractor rays, solid bases, edge labels and plot rows.
Statements about a figure must match the drawing, and a drawing that is
within a few degrees of parallel, perpendicular, right or symmetric is
refused as ambiguous. Generated answers, hints and explanations never enter
`verdicts`.
"""
import math
import re
from collections import Counter
from fractions import Fraction

import multiselect_oracle_kit as kit
from multiselect_oracle_kit import require, options_of, elements, lettered, option_letters, edges, direction

SUPPORTED = frozenset({
    'shape-sides-select', 'polygon-sides-select', 'line-pair-select', 'angle-kind-select',
    'symmetry-lines-select', 'protractor-angles-select', 'prism-volume-select',
    'solid-figure-select', 'stem-leaf-match-select',
})
REVIEW_RETURNS_ANSWER = True
EPS = 1e-6


def kind_asked(prompt, words):
    found = [w for w in words if w in prompt]
    require(len(found) == 1, f'Prompt asks for one of {words}')
    return found[0]


def polygon_of(items):
    (polygon,) = [e for e in items if e['type'] == 'polygon']
    return polygon['points']


def corners(points):
    """Vertices of the drawn polygon, refusing a repeated or straight-through vertex."""
    n = len(points)
    require(n >= 3, 'Polygon needs three vertices')
    for i in range(n):
        a, b, c = points[i - 1], points[i], points[(i + 1) % n]
        require(math.hypot(b[0] - a[0], b[1] - a[1]) > EPS, 'Repeated vertex')
        cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])
        require(abs(cross) > 1e-6, 'A vertex lies straight through its neighbours')
    return points


def side_pair(points, kind):
    """True when two sides are parallel (not collinear) or perpendicular."""
    es = edges(corners(points))
    found = collinear = False
    for i in range(len(es)):
        for j in range(i + 1, len(es)):
            u, v = direction(*es[i]), direction(*es[j])
            if kind == 'parallel' and abs(u[0] * v[1] - u[1] * v[0]) < 1e-4:
                (ax, ay), (bx, by) = es[i]
                (cx, cy) = es[j][0]
                offset = (cx - ax) * u[1] - (cy - ay) * u[0]
                if abs(offset) <= 1e-4:
                    collinear = True  # two sides on one line are not a pair of parallel sides
                    continue
            if kit.line_relation(u, v, kind):
                found = True
    require(found or not collinear, 'Only collinear sides: parallel is ambiguous')
    return found


def shape_sides(public):
    kind = kind_asked(public['prompt'], ['parallel sides', 'perpendicular sides'])
    kind = kind.split()[0]
    require(f'at least one pair of {kind} sides' in public['prompt'], 'Prompt wording')
    shapes = lettered(elements(public))
    return [side_pair(polygon_of(shapes[letter]), kind) for letter in option_letters(public, 'Shape')]


SIDES = {
    'triangle': 3, 'quadrilateral': 4, 'parallelogram': 4, 'rectangle': 4, 'rhombus': 4, 'square': 4, 'trapezoid': 4,
    'pentagon': 5, 'hexagon': 6, 'heptagon': 7, 'octagon': 8,
}


def polygon_sides(public):
    (shape,) = [e for e in elements(public) if e['type'] == 'polygon']
    n = len(corners(shape['points']))
    out, seen = [], []
    for o in options_of(public):
        label = o['label']
        m = re.fullmatch(r'an? (\w+)', label)
        g = re.fullmatch(r'a shape with \$(\d+)\$ (?:corners|angles)', label)
        if m:
            require(m.group(1) in SIDES, f'Unknown name {label}')
            count = SIDES[m.group(1)]
        else:
            require(g is not None, f'Polygon statement: {label}')
            count = int(g.group(1))
        seen.append(label)
        out.append(count == n)
    return out


def line_pair(public):
    kind = kind_asked(public['prompt'], ['appear parallel', 'appear perpendicular']).split()[1]
    lines = {}
    for letter, items in lettered(elements(public)).items():
        (segment,) = items
        lines[letter] = direction(segment['from'], segment['to'])
    out = []
    for letter in option_letters(public, 'Line'):
        out.append(any(kit.line_relation(lines[letter], lines[other], kind) for other in lines if other != letter))
    return out


def angle_degrees(points):
    a, b, c = points
    u, v = (a[0] - b[0], a[1] - b[1]), (c[0] - b[0], c[1] - b[1])
    return math.degrees(math.acos((u[0] * v[0] + u[1] * v[1]) / (math.hypot(*u) * math.hypot(*v))))


def angle_kind(public):
    kind = kind_asked(public['prompt'], ['appear obtuse', 'appear acute', 'appear right']).split()[1]
    angles = {}
    for letter, items in lettered(elements(public)).items():
        (arms,) = items
        require(arms['type'] == 'polyline' and len(arms['points']) == 3, 'An angle is two arms from one vertex')
        angles[letter] = angle_degrees(arms['points'])
    out = []
    for letter in option_letters(public, 'Angle'):
        a = angles[letter]
        require(5 < a < 175, f'Angle {a:.1f} too near a line or a point to read')
        is_right = abs(a - 90) < 0.5
        require(is_right or abs(a - 90) >= 5, f'Angle {a:.1f} is too close to a right angle to call')
        out.append({'right': is_right, 'acute': a < 90 and not is_right, 'obtuse': a > 90 and not is_right}[kind])
    return out


def reflect(p, a, b):
    ux, uy = direction(a, b)
    dx, dy = p[0] - a[0], p[1] - a[1]
    along = dx * ux + dy * uy
    return (a[0] + 2 * along * ux - dx, a[1] + 2 * along * uy - dy)


def mirror_gap(points, a, b):
    """Smallest over alignments of the largest distance between the reflected
    vertex cycle and the original (rotations and the reversed order)."""
    reflected = [reflect(p, a, b) for p in points]
    n = len(points)
    best = math.inf
    for cycle in (reflected, reflected[::-1]):
        for shift in range(n):
            gap = max(math.hypot(cycle[(i + shift) % n][0] - points[i][0], cycle[(i + shift) % n][1] - points[i][1]) for i in range(n))
            best = min(best, gap)
    return best


def symmetry(public):
    both = 'whose two dashed lines are both lines of symmetry' in public['prompt']
    require(both or 'whose dashed line is a line of symmetry' in public['prompt'], 'Prompt wording')
    out = []
    figures = lettered(elements(public))
    for letter in option_letters(public, 'Figure'):
        items = figures[letter]
        points = corners(polygon_of(items))
        dashed = [e for e in items if e['type'] == 'segment']
        require(len(dashed) == (2 if both else 1) and all(e.get('dash') for e in dashed), 'Dashed lines per figure')
        gaps = [mirror_gap(points, d['from'], d['to']) for d in dashed]
        for gap in gaps:
            require(gap < 1e-6 or gap > 0.15, f'Dashed line nearly a line of symmetry (gap {gap:.3f})')
        out.append(all(g < 1e-6 for g in gaps))
    return out


def protractor(public):
    items = elements(public)
    (scale,) = [e for e in items if e['type'] == 'protractor']
    require(len(scale['rays']) == 2 and scale['labels'][1] == 'O', 'Protractor rays')
    rays = {scale['labels'][0]: float(scale['rays'][0]), scale['labels'][2]: float(scale['rays'][1])}
    rest = [e for e in items if e is not scale]
    require(len(rest) % 2 == 0, 'Each extra ray has one letter')
    for segment, text in zip(rest[0::2], rest[1::2]):
        require(segment['type'] == 'segment' and segment['from'] == [0, 0] and text['type'] == 'text', 'Extra ray')
        angle = math.degrees(math.atan2(segment['to'][1], segment['to'][0])) % 360
        require(abs(angle - round(angle)) < 0.05, f'Ray {text["text"]} is not on a whole degree ({angle:.3f})')
        rays[text['text']] = float(round(angle))
    require(len(rays) == 2 + len(rest) // 2, 'Repeated ray letter')
    out, seen = [], []
    for o in options_of(public):
        m = re.fullmatch(r'\$\\angle ([A-D])O([A-D])(?:=(\d+)\^\\circ)?\$', o['label'])
        require(m is not None and m.group(1) != m.group(2), f"Angle statement: {o['label']}")
        measure = abs(rays[m.group(1)] - rays[m.group(2)])
        measure = 360 - measure if measure > 180 else measure
        seen.append((frozenset(m.group(1, 2)), m.group(3)))
        if m.group(3) is not None:
            require('true statements' in public['prompt'], 'Reading under a not-the-measure prompt')
            out.append(measure == int(m.group(3)))
        else:
            n = re.search(r'whose measure is not \$(\d+)\^\\circ\$', public['prompt'])
            require(n is not None, 'Not-the-measure prompt')
            out.append(measure != int(n.group(1)))
    require(len(set(seen)) == len(seen), 'The same angle named twice')
    return out


def prism_volume(public):
    m = re.search(r'volume of \$(\d+)\$ cubic centimeters', public['prompt'])
    require(m is not None, 'Volume prompt')
    out = []
    prisms = lettered(elements(public))
    seen = []
    for letter in option_letters(public, 'Prism'):
        items = prisms[letter]
        edge_texts = [e['text'] for e in items if e['type'] == 'text']
        require(len(edge_texts) == 3 and len([e for e in items if e['type'] == 'polygon']) == 3, 'A prism has three labelled edges')
        dims = []
        for text in edge_texts:
            d = re.fullmatch(r'(\d+) cm', text)
            require(d is not None, f'Edge label {text}')
            dims.append(int(d.group(1)))
        seen.append(tuple(sorted(dims)))
        out.append(dims[0] * dims[1] * dims[2] == int(m.group(1)))
    require(len(set(seen)) == len(seen), 'Two prisms are the same box')
    return out


def solid_traits(solid):
    kind, base = solid['type'], solid.get('base')
    if kind == 'sphere':
        return dict(curved=True, flat=0, prism=False, polygon=None, parallel=False, triangle=False)
    if base['type'] == 'ellipse':
        require(abs(base['radii'][0] - base['radii'][1]) < 1e-9, 'Round base is a circle')
        return dict(curved=True, flat=2 if kind == 'prism' else 1, prism=kind == 'prism', polygon=None, parallel=False, triangle=False)
    n = len(corners(base['points']))
    return dict(curved=False, flat=n + 2 if kind == 'prism' else n + 1, prism=kind == 'prism', polygon=n, parallel=kind == 'prism',
                triangle=(kind == 'prism' and n == 3) or kind == 'pyramid')


def solid_figure(public):
    prompt = public['prompt']
    solids = lettered(elements(public))
    traits = {}
    for letter, items in solids.items():
        (solid,) = items
        require(solid['type'] == 'solid', 'A solid')
        traits[letter] = solid_traits(solid['solid'])
    letters = option_letters(public, 'Solid')
    if prompt.endswith('have a curved surface.'):
        return [traits[x]['curved'] for x in letters]
    if prompt.endswith('have only flat surfaces.'):
        return [not traits[x]['curved'] for x in letters]
    # Whether a cylinder, cone or sphere has "faces" differs between curricula,
    # so every statement about faces must concern polyhedra only.
    require('faces' not in prompt or not any(traits[x]['curved'] for x in traits), 'Face statement with a curved solid drawn')
    if prompt.endswith('have two congruent parallel faces.'):
        return [traits[x]['parallel'] for x in letters]
    m = re.search(r'have (\d+) or more flat faces\.$', prompt)
    if m:
        return [traits[x]['flat'] >= int(m.group(1)) for x in letters]
    if prompt.endswith('have at least one triangular face.'):
        return [traits[x]['triangle'] for x in letters]
    raise ValueError(f'Solid question: {prompt}')


def stem_leaf(public):
    prompt = public['prompt']
    head = prompt.split('In each plot')[0]
    data = sorted(int(n) for n in re.findall(r'\$(\d+)\$', head))
    require(f'Select the' in prompt and 'the stem is the tens digit' in prompt, 'Plot reading rule')
    plots = lettered(elements(public))
    out, drawn = [], []
    for letter in option_letters(public, 'Plot'):
        values = []
        drawn.append(tuple(row['text'] for row in plots[letter]))
        for row in plots[letter]:
            m = re.fullmatch(r'(\d+) \|((?: \d)*) ?', row['text'])
            require(m is not None and row['type'] == 'text', f"Plot row: {row['text']}")
            values += [int(m.group(1)) * 10 + int(d) for d in m.group(2).split()]
        out.append(sorted(values) == data)
    require(len(set(drawn)) == len(drawn), 'Two plots are drawn identically')
    return out


VERDICTS = {
    'shape-sides-select': shape_sides,
    'polygon-sides-select': polygon_sides,
    'line-pair-select': line_pair,
    'angle-kind-select': angle_kind,
    'symmetry-lines-select': symmetry,
    'protractor-angles-select': protractor,
    'prism-volume-select': prism_volume,
    'solid-figure-select': solid_figure,
    'stem-leaf-match-select': stem_leaf,
}


def verdicts(public):
    require(public['templateId'] in SUPPORTED, 'Wrong family')
    return VERDICTS[public['templateId']](public)


def solve(public):
    return kit.answer(public, verdicts(public))


def review_problem(problem):
    return kit.review(problem, verdicts)


def _public(template, prompt, labels, count, label, items):
    return {
        'templateId': template, 'prompt': prompt,
        'response': {'kind': 'multi-select', 'label': label, 'selectionCount': count,
                     'options': [{'id': f'option-{chr(97 + i)}', 'label': t} for i, t in enumerate(labels)]},
        'figure': {'kind': 'scene', 'scene': {'v': 1, 'elements': items}},
    }


def _poly(points):
    return {'type': 'polygon', 'points': [list(p) for p in points]}


def _name(letter):
    return {'type': 'text', 'id': f'label{letter}', 'text': letter}


def _labelled(*shapes):
    items = []
    for letter, parts in zip('ABCDEF', shapes):
        items += list(parts) + [_name(letter)]
    return items


def _unit(degrees):
    return [math.cos(math.radians(degrees)), math.sin(math.radians(degrees))]


def self_test():
    letters = lambda noun, n: [f'{noun} ${c}$' for c in 'ABCDEF'[:n]]
    dashed = lambda a, b: {'type': 'segment', 'from': list(a), 'to': list(b), 'dash': 'dash'}
    segment = lambda a, b: {'type': 'segment', 'from': list(a), 'to': list(b)}
    rectangle = [(0, 0), (4, 0), (4, 2), (0, 2)]
    cases = [
        (_public('shape-sides-select', 'Parallel sides are always the same distance apart. Select the 2 shapes that have at least one pair of parallel sides.',
                 letters('Shape', 5), 2, 'Choose 2 shapes', _labelled(
                     [_poly([(0, 0), (4, 0), (2, 3)])], [_poly(rectangle)], [_poly([(0, 0), (6, 0), (4, 3), (1, 3)])],
                     [_poly([(0, 0), (5, 1), (2, 4)])], [_poly([(0, 2), (2, 4), (4, 2), (2, -2)])])), '["option-b","option-c"]'),
        (_public('shape-sides-select', 'Perpendicular sides meet at a right angle. Select the 1 shapes that have at least one pair of perpendicular sides.',
                 letters('Shape', 3), 1, 'Choose 1 shapes', _labelled(
                     [_poly([(0, 0), (4, 0), (2, 3)])], [_poly([(0, 0), (4, 0), (4, 2), (0, 2)])], [_poly([(0, 0), (4, 0), (5, 2), (1, 2)])])), '["option-b"]'),
        (_public('polygon-sides-select', 'The shape below is a polygon. Select the 2 named shapes or descriptions that have as many sides as the shape below.',
                 ['a triangle', 'a shape with $6$ angles', 'a trapezoid', 'a shape with $6$ corners', 'a shape with $3$ corners'], 2, 'Choose 2 descriptions',
                 [_poly([(1, 0), (0.5, 0.87), (-0.5, 0.87), (-1, 0), (-0.5, -0.87), (0.5, -0.87)])]), '["option-b","option-d"]'),
        (_public('line-pair-select', 'Select the 2 lines that appear parallel.', letters('Line', 5), 2, 'Choose 2 lines', _labelled(
            [segment((0, 0), (4, 0))], [segment((0, 1), (4, 3))], [segment((0, 2), (4, 4))], [segment((1, 0), (1, 4))], [segment((0, 0), (3, 3))])), '["option-b","option-c"]'),
        (_public('angle-kind-select', 'An obtuse angle is larger than a right angle. Select the 2 angles that appear obtuse.', letters('Angle', 5), 2, 'Choose 2 angles', _labelled(
            [{'type': 'polyline', 'points': [(1, 0), (0, 0), (0, 1)]}], [{'type': 'polyline', 'points': [(2, 0), (0, 0), (-1, 1)]}],
            [{'type': 'polyline', 'points': [(1, 0), (0, 0), (1, 1)]}], [{'type': 'polyline', 'points': [(1, 0), (0, 0), (-1, 0.3)]}],
            [{'type': 'polyline', 'points': [(1, 0), (0, 0), (1, 3)]}])), '["option-b","option-d"]'),
        (_public('symmetry-lines-select', 'A line of symmetry folds a figure so that the halves match. Select the 2 figures whose dashed line is a line of symmetry.',
                 letters('Figure', 4), 2, 'Choose 2 figures', _labelled(
                     [_poly([(0, 0), (2, 0), (2, 2), (0, 2)]), dashed((1, -1), (1, 3))], [_poly(rectangle), dashed((0, 0), (4, 2))],
                     [_poly([(0, 0), (4, 0), (2, 3)]), dashed((2, -1), (2, 4))], [_poly([(0, 0), (4, 0), (5, 2), (1, 2)]), dashed((-1, 1), (6, 1))])), '["option-a","option-c"]'),
        (_public('protractor-angles-select', 'Rays from vertex $O$ are drawn on one protractor. Select the 5 angles whose measure is not $85^\\circ$.',
                 ['$\\angle AOB$', '$\\angle AOC$', '$\\angle AOD$', '$\\angle BOC$', '$\\angle BOD$', '$\\angle COD$'], 5, 'Choose 5 angles',
                 [{'type': 'protractor', 'rays': [0, 85], 'labels': ['A', 'O', 'B']},
                  {'type': 'segment', 'from': [0, 0], 'to': _unit(140)}, {'type': 'text', 'text': 'C'},
                  {'type': 'segment', 'from': [0, 0], 'to': _unit(175)}, {'type': 'text', 'text': 'D'}]), '["option-b","option-c","option-d","option-e","option-f"]'),
        (_public('prism-volume-select', 'Each prism is drawn with its edge lengths in centimeters. Select the 2 prisms that have a volume of $30$ cubic centimeters.',
                 letters('Prism', 3), 2, 'Choose 2 prisms', _labelled(
                     [_poly(rectangle)] * 3 + [{'type': 'text', 'text': t} for t in ('5 cm', '6 cm', '1 cm')],
                     [_poly(rectangle)] * 3 + [{'type': 'text', 'text': t} for t in ('5 cm', '3 cm', '2 cm')],
                     [_poly(rectangle)] * 3 + [{'type': 'text', 'text': t} for t in ('2 cm', '2 cm', '2 cm')])), '["option-a","option-b"]'),
        (_public('solid-figure-select', 'Select the 3 solids that have a curved surface.', letters('Solid', 5), 3, 'Choose 3 solids', _labelled(
            [{'type': 'solid', 'solid': {'type': 'prism', 'base': {'type': 'polygon', 'points': [(0, 1), (1, 0.5), (1, -0.5), (0, -1), (-1, -0.5), (-1, 0.5)]}, 'height': 2}}],
            [{'type': 'solid', 'solid': {'type': 'sphere', 'radius': 1}}],
            [{'type': 'solid', 'solid': {'type': 'pyramid', 'base': {'type': 'ellipse', 'center': [0, 0], 'radii': [1, 1], 'angle': 0}, 'height': 2}}],
            [{'type': 'solid', 'solid': {'type': 'pyramid', 'base': {'type': 'polygon', 'points': [(0, 1), (-1, -1), (1, -1)]}, 'height': 2}}],
            [{'type': 'solid', 'solid': {'type': 'prism', 'base': {'type': 'ellipse', 'center': [0, 0], 'radii': [1, 1], 'angle': 0}, 'height': 2}}])), '["option-b","option-c","option-e"]'),
        (_public('stem-leaf-match-select', 'The data are $12$, $15$, $23$, $27$. In each plot, the stem is the tens digit and a leaf is a ones digit, so $2\\mid3$ means $23$. Select the 2 stem-and-leaf plots that show this data.',
                 letters('Plot', 4), 2, 'Choose 2 plots', _labelled(
                     [{'type': 'text', 'text': '1 | 2 5'}, {'type': 'text', 'text': '2 | 3 7'}], [{'type': 'text', 'text': '1 | 5 2'}, {'type': 'text', 'text': '2 | 7 3'}],
                     [{'type': 'text', 'text': '1 | 2 5'}, {'type': 'text', 'text': '2 | 3 8'}], [{'type': 'text', 'text': '1 | 2'}, {'type': 'text', 'text': '2 | 3 5 7'}])), '["option-a","option-b"]'),
    ]
    for public, expected in cases:
        labels = [o['label'] for o in public['response']['options']]
        explanation = [f"{t}: {'true' if o['id'] in expected else 'false'}. Checked." for t, o in zip(labels, public['response']['options'])]
        kit.standard_mutants(public, expected, explanation, 'Look at each drawing.', verdicts, solve)
    by = {}
    for c in cases:
        by.setdefault(c[0]['templateId'], c[0])

    def edit(template, change):
        return kit.tamper(by[template], change)
    # drawings within a few degrees of the property are ambiguous and refused
    kit.must_fail(solve, edit('shape-sides-select', lambda p: p['figure']['scene']['elements'][2]['points'][2].__setitem__(1, 2.2)))
    kit.must_fail(solve, edit('line-pair-select', lambda p: p['figure']['scene']['elements'][4]['to'].__setitem__(1, 4.1)))
    kit.must_fail(solve, edit('angle-kind-select', lambda p: p['figure']['scene']['elements'][0]['points'].__setitem__(2, (-0.04, 1))))
    kit.must_fail(solve, edit('symmetry-lines-select', lambda p: p['figure']['scene']['elements'][1]['from'].__setitem__(0, 1.05)))
    kit.must_fail(solve, edit('protractor-angles-select', lambda p: p['figure']['scene']['elements'][1].__setitem__('to', _unit(140.4))))
    kit.must_fail(solve, edit('stem-leaf-match-select', lambda p: [p['figure']['scene']['elements'][3].__setitem__('text', '1 | 2 5'), p['figure']['scene']['elements'][4].__setitem__('text', '2 | 3 7')]))
    kit.must_fail(solve, edit('stem-leaf-match-select', lambda p: p['figure']['scene']['elements'][3].__setitem__('text', '2 | 8 3')))
    # a changed edge label changes the volume, so the stated count no longer holds
    kit.must_fail(solve, edit('prism-volume-select', lambda p: p['figure']['scene']['elements'][4].__setitem__('text', '7 cm')))
    # statements about faces never concern a curved solid
    solids = by['solid-figure-select']
    for ask in ('have two congruent parallel faces.', 'have only flat faces.'):
        faces = kit.tamper(solids, lambda p: p.__setitem__('prompt', 'Select the 2 solids that ' + ask))
        kit.must_fail(solve, faces)
