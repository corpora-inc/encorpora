"""Independent beginner oracle: classify only public geometry and displayed choices."""
import copy
import math

SUPPORTED = {'compare-aligned-lengths', 'identify-basic-shape'}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def finite_number(value):
    require(type(value) in (int, float) and math.isfinite(value), 'Finite coordinate required')
    return float(value)


def choose(public, correct, labels):
    response = public['response']
    require(response.get('kind') == 'choice', 'Choice response required')
    options = response['options']
    require(len(options) == 3, 'Three meaningful choices required')
    require({o['id'] for o in options} == {'option-a', 'option-b', 'option-c'}, 'Unique protocol choice IDs required')
    require({o['label'] for o in options} == set(labels), 'Every named alternative must occur exactly once')
    answers = [o['id'] for o in options if o['label'] == correct]
    require(len(answers) == 1, 'Exactly one correct displayed choice required')
    return answers[0]


def polygon_name(vertices):
    require(type(vertices) is list and len(vertices) in (3, 4), 'Three or four vertices required')
    points = []
    for point in vertices:
        require(type(point) is list and len(point) == 2, 'Coordinate pair required')
        x, y = map(finite_number, point)
        require(30 <= x <= 290 and 15 <= y <= 165, 'Polygon outside declared visible domain')
        points.append((x, y))
    require(len(set(points)) == len(points), 'Repeated vertex')
    edges = [(points[(i + 1) % len(points)][0] - p[0],
              points[(i + 1) % len(points)][1] - p[1]) for i, p in enumerate(points)]
    squared = [x * x + y * y for x, y in edges]
    require(min(squared) > 1e-8, 'Zero-length side')
    twice_area = sum(p[0] * points[(i + 1) % len(points)][1] -
                     p[1] * points[(i + 1) % len(points)][0] for i, p in enumerate(points))
    require(abs(twice_area) > 1e-7, 'Degenerate polygon')
    if len(points) == 3:
        return 'Triangle'
    require(all(math.isclose(n, squared[0], rel_tol=1e-9, abs_tol=1e-7) for n in squared),
            'Four-sided entry shape must have equal sides')
    turns = []
    for i, (x, y) in enumerate(edges):
        u, v = edges[(i + 1) % 4]
        require(abs(x * u + y * v) <= max(squared) * 1e-9 + 1e-7,
                'Four-sided entry shape must have perpendicular adjoining sides')
        turns.append(x * v - y * u)
    require(all(t > 0 for t in turns) or all(t < 0 for t in turns), 'Square boundary must not cross itself')
    return 'Square'


def solve(public):
    family = public['templateId']
    require(family in SUPPORTED, 'Unsupported beginner family')
    figure = public['figure']
    if family == 'compare-aligned-lengths':
        require(public['skillId'] == 'compare-attributes', 'Wrong comparison skill')
        require(public['prompt'] in ('Which strip is longer?', 'Which strip is shorter?'), 'Unexpected comparison question')
        require(set(figure) == {'kind', 'lengths', 'tone'} and figure['kind'] == 'aligned-strips', 'Aligned strip givens required')
        require(figure['tone'] in ('teal-first', 'coral-first'), 'Unknown strip style')
        lengths = figure['lengths']
        require(type(lengths) is list and len(lengths) == 2, 'Two strip lengths required')
        require(all(type(n) is int and 80 <= n <= 240 for n in lengths), 'Strip length outside domain')
        a, b = lengths
        require(a == b or abs(a - b) >= 40, 'Unequal strip difference must remain visibly distinct')
        if a == b:
            answer = 'Same length'
        elif public['prompt'] == 'Which strip is longer?':
            answer = 'Strip A' if a > b else 'Strip B'
        else:
            answer = 'Strip A' if a < b else 'Strip B'
        return choose(public, answer, ['Strip A', 'Strip B', 'Same length'])
    require(public['skillId'] == 'name-shapes', 'Wrong recognition skill')
    require(public['prompt'] == 'What is this shape called?', 'Unexpected shape question')
    require(set(figure) == {'kind', 'outline', 'tone'} and figure['kind'] == 'shape-outline', 'Shape outline givens required')
    require(figure['tone'] in ('teal', 'coral'), 'Unknown shape style')
    outline = figure['outline']
    if outline['form'] == 'round':
        require(set(outline) == {'form', 'radius'}, 'Circle must have a single radius, not ellipse axes')
        radius = outline['radius']
        require(type(radius) is int and 34 <= radius <= 65, 'Circle radius outside domain')
        answer = 'Circle'
    else:
        require(outline['form'] == 'polygon' and set(outline) == {'form', 'vertices'}, 'Polygon vertices required')
        answer = polygon_name(outline['vertices'])
    return choose(public, answer, ['Circle', 'Triangle', 'Square'])


def self_test():
    def case(family, figure, prompt, labels):
        return {'templateId': family, 'skillId': 'compare-attributes' if family == 'compare-aligned-lengths' else 'name-shapes',
                'prompt': prompt, 'figure': figure,
                'response': {'kind': 'choice', 'options': [{'id': 'option-' + key, 'label': label} for key, label in zip('abc', labels)]}}
    labels = ['Same length', 'Strip B', 'Strip A']
    strip = case('compare-aligned-lengths', {'kind': 'aligned-strips', 'lengths': [80, 240], 'tone': 'coral-first'},
                 'Which strip is longer?', labels)
    checks = 0
    for lengths, prompt, correct in [([80, 240], 'Which strip is longer?', 'option-b'),
                                      ([240, 80], 'Which strip is shorter?', 'option-b'),
                                      ([120, 120], 'Which strip is longer?', 'option-a'),
                                      ([120, 120], 'Which strip is shorter?', 'option-a')]:
        c = copy.deepcopy(strip); c['figure']['lengths'] = lengths; c['prompt'] = prompt
        require(solve(c) == correct, 'Hand-authored strip result mismatch'); checks += 1
    shape = case('identify-basic-shape', {'kind': 'shape-outline', 'tone': 'teal',
                 'outline': {'form': 'round', 'radius': 34}}, 'What is this shape called?', ['Square', 'Circle', 'Triangle'])
    for outline, expected in [({'form': 'round', 'radius': 34}, 'option-b'),
                              ({'form': 'round', 'radius': 65}, 'option-b'),
                              ({'form': 'polygon', 'vertices': [[160, 25], [225, 90], [160, 155], [95, 90]]}, 'option-a'),
                              ({'form': 'polygon', 'vertices': [[100, 40], [220, 55], [130, 145]]}, 'option-c')]:
        c = copy.deepcopy(shape); c['figure']['outline'] = outline
        require(solve(c) == expected, 'Hand-authored shape result mismatch'); checks += 1
    corrupt = []
    c = copy.deepcopy(strip); c['figure']['lengths'] = [120, 121]; corrupt.append(c)
    c = copy.deepcopy(strip); c['figure']['lengths'] = [True, 160]; corrupt.append(c)
    c = copy.deepcopy(strip); c['response']['options'][1]['label'] = 'Strip A'; corrupt.append(c)
    c = copy.deepcopy(strip); c['response']['options'][0]['id'] = 'option-1'; corrupt.append(c)
    for outline in [
        {'form': 'polygon', 'vertices': [[100, 60], [140, 80], [180, 100]]},
        {'form': 'polygon', 'vertices': [[100, 40], [220, 40], [220, 140], [100, 140]]},
        {'form': 'polygon', 'vertices': [[160, 30], [240, 90], [160, 150], [80, 90]]},
        {'form': 'polygon', 'vertices': [[100, 40], [220, 140], [100, 140], [220, 40]]},
        {'form': 'polygon', 'vertices': [[100, 40], [100, 40], [140, 100]]},
        {'form': 'polygon', 'vertices': [[100, 40], [float('nan'), 40], [140, 100]]},
        {'form': 'round', 'radius': 66},
        {'form': 'round', 'radius': 40, 'radiusY': 50},
    ]:
        c = copy.deepcopy(shape); c['figure']['outline'] = outline; corrupt.append(c)
    for c in corrupt:
        try:
            solve(c)
        except (ValueError, KeyError, TypeError):
            checks += 1
        else:
            raise AssertionError('Corrupt public geometry/options were accepted')
    return checks


if __name__ == '__main__':
    print(f'{self_test()} independent beginner boundary checks passed')
