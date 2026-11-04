"""Independent oracle for the grade-4 geometry types.

Answers are recomputed from the drawn rays, polygon vertices, side labels and
rectangle dimensions. Generated answers, hints and explanations never enter
`solve`.
"""
import json
import math
import re

import multiselect_oracle_kit as kit

SUPPORTED = frozenset({
    'protractor-ray-choice',
    'adjacent-angle-equation',
    'angle-benchmark-estimate',
    'triangle-sides-angles-blanks',
    'quadrilateral-attributes',
    'composite-rectangle-measure',
    'rectangle-formula-select',
})
REVIEW_RETURNS_ANSWER = True
TOL = 1e-6
BENCHMARKS = (30, 45, 60, 90, 180)


def require(cond, message):
    if not cond:
        raise ValueError(message)


def span(a, b):
    """Counterclockwise turn from direction a to direction b, in [0, 360)."""
    return (b - a) % 360


def elements(public):
    figure = public['figure']
    require(figure['kind'] == 'scene' and figure['scene']['v'] == 1, 'Expected a scene')
    return figure['scene']['elements']


def one(items, kind):
    found = [e for e in items if e.get('type') == kind]
    require(len(found) == 1, f'Expected one {kind}')
    return found[0]


def option_id(public, label):
    found = [o['id'] for o in public['response']['options'] if o['label'] == label]
    require(len(found) == 1, f'Expected one option {label!r}')
    return found[0]


def interiors(points):
    """Interior angles in degrees. Orientation is corrected so a mirrored copy
    still reports the shape's own interior."""
    pts = [tuple(p) for p in points]
    n = len(pts)
    require(n >= 3, 'A polygon needs three vertices')
    area = 0.0
    for i in range(n):
        q = pts[(i + 1) % n]
        area += pts[i][0] * q[1] - q[0] * pts[i][1]
    orient = 1 if area >= 0 else -1
    out = []
    for i in range(n):
        a, b, c = pts[(i + n - 1) % n], pts[i], pts[(i + 1) % n]
        ix, iy = b[0] - a[0], b[1] - a[1]
        ox, oy = c[0] - b[0], c[1] - b[1]
        require(math.hypot(ix, iy) > TOL and math.hypot(ox, oy) > TOL, 'Zero-length side')
        turn = math.atan2(orient * (ix * oy - iy * ox), ix * ox + iy * oy)
        out.append(180 - math.degrees(turn))
    return out


def side_lengths(points):
    pts = [tuple(p) for p in points]
    return [math.hypot(pts[(i + 1) % len(pts)][0] - pts[i][0], pts[(i + 1) % len(pts)][1] - pts[i][1]) for i in range(len(pts))]


def parallel_pairs(points):
    pts = [tuple(p) for p in points]
    dirs = []
    for i, p in enumerate(pts):
        q = pts[(i + 1) % len(pts)]
        n = math.hypot(q[0] - p[0], q[1] - p[1])
        require(n > TOL, 'Zero-length side')
        dirs.append(((q[0] - p[0]) / n, (q[1] - p[1]) / n))
    pairs = 0
    for i in range(len(dirs)):
        for j in range(i + 1, len(dirs)):
            ax, ay = dirs[i]
            bx, by = dirs[j]
            if abs(ax * by - ay * bx) < 1e-3:
                pairs += 1
    return pairs


def shape_points(public):
    shapes = one(elements(public), 'shapes')
    (item,) = shapes['items']
    (piece,) = item['pieces']
    require(piece['type'] == 'polygon', 'The drawn piece is a polygon')
    return piece['points']


def ray_degrees(to):
    deg = math.degrees(math.atan2(to[1], to[0])) % 360
    nearest = round(deg) % 360
    gap = min(abs(deg - nearest), 360 - abs(deg - nearest))
    require(gap < 0.05, f'Ray at {deg:.3f}° is off a whole-degree mark')
    return nearest


def protractor_measure(public):
    prompt = public['prompt']
    require('ray $BA$' in prompt or 'Ray $BA$' in prompt, 'Protractor wording')
    degrees = re.findall(r'\$(\d+)\^\\circ\$', prompt)
    require(len(degrees) == 1, 'Protractor wording')
    k = int(degrees[0])
    require(5 <= k <= 175 and k % 5 == 0 and k != 90, f'{k} is not a grade-4 protractor target')
    items = elements(public)
    tool = one(items, 'protractor')
    require(tool['labels'][0] == 'A' and tool['labels'][1] == 'B', 'Baseline ray is BA')
    base = tool['rays'][0]
    require(base in (0, 180), 'The baseline lies on the left or the right')
    rays = {tool['labels'][2]: tool['rays'][1]}
    for item in items:
        if item.get('type') == 'segment' and str(item.get('id', '')).startswith('ray'):
            letter = item['id'][3:]
            require(letter not in rays, f'Ray {letter} is drawn twice')
            require(item['from'] == [0, 0], 'Extra rays start at the vertex')
            rays[letter] = ray_degrees(item['to'])
    def choice_letter(label):
        body = label[1:-1] if label.startswith('$') and label.endswith('$') else label
        require(re.fullmatch(r'[A-Z]', body) is not None, f'Ray choice {label!r}')
        return body

    require(
        set(rays) == {choice_letter(o['label']) for o in public['response']['options']},
        'Options are the drawn rays',
    )

    def measure(direction):
        return direction if base == 0 else 180 - direction

    on_target = [letter for letter, direction in rays.items() if measure(direction) == k]
    on_wrong_scale = [letter for letter, direction in rays.items() if measure(direction) == 180 - k]
    require(len(on_target) == 1, 'Exactly one ray is at the named degree')
    require(len(on_wrong_scale) == 1, 'The wrong-scale ray is always drawn')
    letter = on_target[0]
    found = [o['id'] for o in public['response']['options'] if choice_letter(o['label']) == letter]
    require(len(found) == 1, f'Expected one option for ray {letter}')
    return found[0]


def eval_arith(text, env):
    """Evaluate a grade-4 arithmetic expression. Names in env are substituted."""
    body = text.strip()
    if body.startswith('$') and body.endswith('$'):
        body = body[1:-1]
    body = body.replace(r'\times', '*').replace(' ', '')
    for name in sorted(env, key=len, reverse=True):
        body = re.sub(rf'(?<![A-Za-z]){re.escape(name)}(?![A-Za-z])', f'({env[name]})', body)
    body = re.sub(r'(\d)\(', r'\1*(', body)
    body = re.sub(r'\)\(', r')*(', body)
    require(not re.search(r'[A-Za-z\\]', body), f'Unresolved expression {text!r} -> {body!r}')
    require(re.fullmatch(r'[0-9+*()\-]+', body) is not None, f'Bad expression {body!r}')

    class Parser:
        def __init__(self, source):
            self.source = source
            self.i = 0

        def parse(self):
            value = self.expr()
            require(self.i == len(self.source), 'Trailing expression')
            return value

        def expr(self):
            value = self.term()
            while self.i < len(self.source) and self.source[self.i] in '+-':
                op = self.source[self.i]
                self.i += 1
                right = self.term()
                value = value + right if op == '+' else value - right
            return value

        def term(self):
            value = self.factor()
            while self.i < len(self.source) and self.source[self.i] == '*':
                self.i += 1
                value *= self.factor()
            return value

        def factor(self):
            require(self.i < len(self.source), 'Expression ended early')
            if self.source[self.i] == '(':
                self.i += 1
                value = self.expr()
                require(self.i < len(self.source) and self.source[self.i] == ')', 'Missing )')
                self.i += 1
                return value
            match = re.match(r'\d+', self.source[self.i:])
            require(match is not None, 'Expected a number')
            self.i += len(match.group(0))
            return int(match.group(0))

    return Parser(body).parse()


def equation_holds(label, unknown):
    body = label.strip()
    require(body.startswith('$') and body.endswith('$'), 'Equation label')
    sides = body[1:-1].split('=')
    require(len(sides) == 2, 'One equals sign')
    left = eval_arith(sides[0], {'x': unknown})
    right = eval_arith(sides[1], {'x': unknown})
    return left == right


def adjacent_equation(public):
    prompt = public['prompt']
    patterns = [
        r'Angle \$([A-Z]{3})\$ measures (\d+)°\. Angle \$([A-Z]{3})\$ measures (\d+)°\. The measure of angle \$([A-Z]{3})\$ is \$x\$ degrees\.',
        r'The whole angle \$([A-Z]{3})\$ is (\d+)°\. The known part \$([A-Z]{3})\$ is (\d+)°\. Angle \$([A-Z]{3})\$ is \$x\$ degrees\.',
        r'Angle \$([A-Z]{3})\$ measures (\d+)°\. Inside it, angle \$([A-Z]{3})\$ measures (\d+)°\. Angle \$([A-Z]{3})\$ is \$x\$ degrees\.',
        r'Start from angle \$([A-Z]{3})\$, which measures (\d+)°\. Angle \$([A-Z]{3})\$ measures (\d+)°\. The measure of angle \$([A-Z]{3})\$ is \$x\$ degrees\.',
        r'Angle \$([A-Z]{3})\$ measures (\d+)°\. Inside it, the adjacent angle \$([A-Z]{3})\$ measures (\d+)°\. Angle \$([A-Z]{3})\$ is \$x\$ degrees\.',
        r'Two adjacent angles make angle \$([A-Z]{3})\$, which measures (\d+)°\. Angle \$([A-Z]{3})\$ measures (\d+)°\. Angle \$([A-Z]{3})\$ is \$x\$ degrees\.',
        r'(?:The ramp rises from the floor at|The ladder meets the ground at|The door opens from the wall at|The gate opens from the fence at|The roof rises from the top of the wall at|The pizza slice opens at) angle \$([A-Z]{3})\$, which measures (\d+)°\. (?:The brace|The strut|One cut) splits it into angle \$([A-Z]{3})\$ of (\d+)° and angle \$([A-Z]{3})\$ of \$x\$ degrees\.',
    ]
    found = next((re.search(pattern, prompt) for pattern in patterns if re.search(pattern, prompt)), None)
    require(found is not None, 'Adjacent-angle wording')
    whole_name, whole, known_name, known, missing_name = found.group(1), int(found.group(2)), found.group(3), int(found.group(4)), found.group(5)
    require(known_name != missing_name and whole_name not in (known_name, missing_name), 'Three distinct angles')
    g = one(elements(public), 'angle')
    d0, d1, d2 = g['rays']
    a, c, d = g['labels']['ends']
    b = g['labels']['vertex']
    drawn = (span(d0, d1), span(d1, d2), span(d0, d2))
    require(abs(drawn[0] + drawn[1] - drawn[2]) < 1e-3 and drawn[2] <= 180 + 1e-3, 'The middle ray lies inside the whole angle')
    names = {f'{a}{b}{c}': drawn[0], f'{c}{b}{d}': drawn[1], f'{a}{b}{d}': drawn[2]}
    require(whole_name == f'{a}{b}{d}', 'The whole angle is the outer rays')
    require(abs(names[whole_name] - whole) < 1e-3 and abs(names[known_name] - known) < 1e-3, 'The prompt matches the drawing')
    require(abs(names[missing_name] - (whole - known)) < 1e-3, 'The unknown is the remaining part')
    part_of = {0: f'{a}{b}{c}', 1: f'{c}{b}{d}'}
    for mark in g['marks']:
        require(mark.get('measure') is True and (mark['from'], mark['to']) in ((0, 1), (1, 2)), 'Both parts are marked')
        part = part_of[mark['from']]
        require(bool(mark.get('derived')) == (part == missing_name), 'The unknown part is the one marked ?')
    unknown = whole - known
    true_forms = {f'$x + {known} = {whole}$', f'${whole} - {known} = x$'}
    true_options = [o for o in public['response']['options'] if equation_holds(o['label'], unknown)]
    require(len(true_options) == 1, 'Exactly one equation is true')
    require(true_options[0]['label'] in true_forms, 'The true equation is x + part = whole or whole - part = x')
    added = f'${whole} + {known} = x$'
    require(any(o['label'] == added for o in public['response']['options']), 'Adding the whole and the part is a choice')
    require(not equation_holds(added, unknown), 'Adding the whole and the part is not true')
    return true_options[0]['id']


def benchmark_estimate(public):
    require('benchmark' in public['prompt'].lower(), 'Benchmark wording')
    require(re.search(r'\d', public['prompt']) is None, 'The prompt does not state a degree')
    g = one(elements(public), 'angle')
    require(len(g['rays']) == 2, 'One angle')
    marks = g.get('marks') or []
    require(marks and not any(m.get('clockwise') or m.get('measure') for m in marks), 'The exact degree is not labeled')
    measure = span(*g['rays'])
    require(measure <= 180 + 1e-3, 'The drawn opening is at most a straight angle')
    distances = [(abs(measure - b), b) for b in BENCHMARKS]
    gap, nearest = min(distances)
    require(gap <= 10, 'The opening is within 10° of a benchmark')
    require(sum(1 for d, _b in distances if abs(d - gap) < 1e-6) == 1, 'The nearest benchmark is unique')
    require(all(d > 10 for d, b in distances if b != nearest), 'Every other benchmark is more than 10° away')
    return option_id(public, f'${nearest}^\\circ$')


def triangle_classes(points):
    lengths = side_lengths(points)
    close = lambda a, b: abs(a - b) / max(a, b) < 0.02
    equal_pairs = sum(1 for a, b in ((lengths[0], lengths[1]), (lengths[1], lengths[2]), (lengths[0], lengths[2])) if close(a, b))
    require(equal_pairs != 2, 'Side classes overlap')
    sides = {3: 'equilateral', 1: 'isosceles', 0: 'scalene'}[equal_pairs]
    angles = interiors(points)
    right = any(abs(a - 90) <= 0.5 for a in angles)
    require(right or all(abs(a - 90) >= 15 for a in angles), 'An angle is too close to a right angle to name')
    kind = 'right' if right else 'obtuse' if max(angles) > 90.5 else 'acute'
    return sides, kind


def blank_answer(public, picks):
    response = public['response']
    require(response['kind'] == 'multi-part-choice', 'Multi-part response')
    out = {}
    for blank in response['blanks']:
        label = picks[blank['id']]
        matches = [o['id'] for o in blank['options'] if o['label'] == label]
        require(len(matches) == 1, f'{blank["id"]} has no option {label}')
        out[blank['id']] = matches[0]
    return json.dumps(out, separators=(',', ':'))


def triangle_blanks(public):
    require('tick marks' in public['prompt'].lower(), 'Triangle wording')
    sides, angles = triangle_classes(shape_points(public))
    return blank_answer(public, {'sides': sides, 'angles': angles})


def quad_name(points):
    require(len(points) == 4, 'A quadrilateral')
    angles = interiors(points)
    lengths = side_lengths(points)
    rights = sum(1 for a in angles if abs(a - 90) < 0.5)
    equal = max(lengths) / min(lengths) < 1.02
    pairs = parallel_pairs(points)
    if rights == 4 and equal:
        return 'square'
    if rights == 4:
        return 'rectangle'
    if equal and rights == 0 and pairs >= 2:
        return 'rhombus'
    if pairs >= 2 and rights == 0 and not equal:
        return 'parallelogram'
    if pairs == 1:
        return 'trapezoid'
    raise ValueError('The quadrilateral does not have one of the five names')


def quadrilateral_attributes(public):
    require('most exact name' in public['prompt'] and 'quadrilateral' in public['prompt'], 'Quadrilateral wording')
    return option_id(public, quad_name(shape_points(public)))


def whole_number(value):
    require(abs(value - round(value)) < 1e-6, 'Expected a whole-number measure')
    return str(int(round(value)))


def polygon_measures(figure):
    require(figure['kind'] == 'measured-polygon', 'Measured polygon')
    vertices = [tuple(p) for p in figure['vertices']]
    sides = figure['sides']
    require(len(sides) == len(vertices) and all(s is not None for s in sides), 'Every outer side is labeled')
    for i, side in enumerate(sides):
        dist = math.hypot(vertices[(i + 1) % len(vertices)][0] - vertices[i][0], vertices[(i + 1) % len(vertices)][1] - vertices[i][1])
        require(abs(side - dist) < 1e-9, 'A side label does not match the drawing')
    for height in figure['heights']:
        dist = math.hypot(height['to'][0] - height['from'][0], height['to'][1] - height['from'][1])
        require(abs(height['value'] - dist) < 1e-9, 'A dashed length does not match the drawing')
    signed = sum(vertices[i][0] * vertices[(i + 1) % len(vertices)][1] - vertices[(i + 1) % len(vertices)][0] * vertices[i][1] for i in range(len(vertices))) / 2
    require(signed > 0, 'Vertices run counterclockwise')
    return signed, sum(sides)


def composite_rectangle(public):
    area, perimeter = polygon_measures(public['figure'])
    prompt = public['prompt']
    asks_perimeter = 'perimeter' in prompt
    asks_area = re.search(r'\barea\b', prompt) is not None
    require(asks_perimeter != asks_area, 'The question asks for the area or the perimeter')
    return whole_number(perimeter if asks_perimeter else area)


def formula_truths(public):
    prompt = public['prompt']
    figure = public['figure']
    require(figure['kind'] == 'measure-rectangle', 'Measure rectangle')
    length = figure['width']['value']
    width = figure['height']['value']
    unit = figure['width']['unit']
    require(unit == figure['height']['unit'] and unit in ('cm', 'm'), 'Length unit')
    require(length != width, 'The rectangle is not a square')
    area = length * width
    around = 2 * (length + width)
    require(area != around and area != length + width, 'Area and perimeter must not share a number')
    if 'equal the perimeter' in prompt:
        require('equal the area' not in prompt, 'One question')
        target = around
    elif 'equal the area' in prompt:
        target = area
    else:
        raise ValueError('Formula wording')
    truths = []
    for option in public['response']['options']:
        truths.append(eval_arith(option['label'], {'l': length, 'w': width}) == target)
    return truths


def rectangle_formulas(public):
    return kit.answer(public, formula_truths(public))


SOLVERS = {
    'protractor-ray-choice': protractor_measure,
    'adjacent-angle-equation': adjacent_equation,
    'angle-benchmark-estimate': benchmark_estimate,
    'triangle-sides-angles-blanks': triangle_blanks,
    'quadrilateral-attributes': quadrilateral_attributes,
    'composite-rectangle-measure': composite_rectangle,
    'rectangle-formula-select': rectangle_formulas,
}


def solve(public):
    require(public['templateId'] in SUPPORTED, 'Unexpected grade-4 geometry template')
    return SOLVERS[public['templateId']](public)


def review_problem(problem):
    public = problem['public']
    if public['templateId'] == 'rectangle-formula-select':
        return kit.review(problem, formula_truths)
    return solve(public)


def _choice(labels):
    return {'kind': 'choice', 'options': [{'id': f'option-{chr(97 + i)}', 'label': label} for i, label in enumerate(labels)]}


def _scene(*items):
    return {'kind': 'scene', 'scene': {'v': 1, 'elements': list(items)}}


def _ray(deg):
    return [1.15 * math.cos(math.radians(deg)), 1.15 * math.sin(math.radians(deg))]


def _shapes(points):
    return _scene({'type': 'shapes', 'id': 'shapes', 'items': [{'pieces': [{'type': 'polygon', 'points': [list(p) for p in points]}]}]})


def _must_fail(public):
    try:
        solve(public)
    except ValueError:
        return
    raise AssertionError('Accepted a corrupted fixture')


def self_test():
    import copy

    protractor = {
        'templateId': 'protractor-ray-choice',
        'prompt': r'Ray $BA$ lies on the baseline. Which other ray makes a $50^\circ$ angle with ray $BA$?',
        'response': _choice(['C', 'D', 'E', 'F']),
        'figure': _scene(
            {'type': 'protractor', 'id': 'p', 'rays': [0, 50], 'labels': ['A', 'B', 'C']},
            {'type': 'segment', 'id': 'rayD', 'from': [0, 0], 'to': _ray(130)},
            {'type': 'segment', 'id': 'rayE', 'from': [0, 0], 'to': _ray(20)},
            {'type': 'segment', 'id': 'rayF', 'from': [0, 0], 'to': _ray(70)},
        ),
    }
    require(solve(protractor) == 'option-a', '50° on the right-hand scale is ray C')
    left = copy.deepcopy(protractor)
    left['figure']['scene']['elements'][0]['rays'] = [180, 130]
    # The right-base wrong-scale ray sat at 130°, which is now the correct ray.
    left['figure']['scene']['elements'][1]['to'] = _ray(50)
    require(solve(left) == 'option-a', '50° on the left-hand scale is the ray at 130°')
    missing_scale = copy.deepcopy(protractor)
    missing_scale['figure']['scene']['elements'][1]['to'] = _ray(110)
    _must_fail(missing_scale)

    adjacent = {
        'templateId': 'adjacent-angle-equation',
        'prompt': 'Angle $ABD$ measures 120°. Angle $CBD$ measures 40°. The measure of angle $ABC$ is $x$ degrees. Which equation is true?',
        'response': _choice(['$x + 40 = 120$', '$120 + 40 = x$', '$40 - 120 = x$', '$x = 120$']),
        'figure': _scene({'type': 'angle', 'rays': [10, 90, 130], 'labels': {'vertex': 'B', 'ends': ['A', 'C', 'D']},
                          'marks': [{'from': 0, 'to': 1, 'measure': True, 'derived': True}, {'from': 1, 'to': 2, 'measure': True, 'derived': False}]}),
    }
    require(solve(adjacent) == 'option-a', 'x + 40 = 120')
    difference = copy.deepcopy(adjacent)
    difference['response']['options'][0]['label'] = '$120 - 40 = x$'
    require(solve(difference) == 'option-a', '120 - 40 = x')
    story = copy.deepcopy(adjacent)
    story['prompt'] = 'The door opens from the wall at angle $ABD$, which measures 120°. The brace splits it into angle $CBD$ of 40° and angle $ABC$ of $x$ degrees. Which equation finds $x$?'
    require(solve(story) == 'option-a', 'A door story still names the drawn angles')
    both_true = copy.deepcopy(adjacent)
    both_true['response']['options'][3]['label'] = '$120 - 40 = x$'
    _must_fail(both_true)

    benchmark = {
        'templateId': 'angle-benchmark-estimate',
        'prompt': 'Which benchmark is this angle nearest?',
        'response': _choice([r'$30^\circ$', r'$45^\circ$', r'$60^\circ$', r'$90^\circ$']),
        'figure': _scene({'type': 'angle', 'rays': [15, 47], 'marks': [{'from': 0, 'to': 1, 'color': 'warm'}]}),
    }
    require(solve(benchmark) == 'option-a', '32° is nearest 30°')
    tie = copy.deepcopy(benchmark)
    tie['figure']['scene']['elements'][0]['rays'] = [0, 37]
    _must_fail(tie)

    def blanks(sides, angles):
        return {
            'kind': 'multi-part-choice',
            'blanks': [
                {'id': 'sides', 'options': [{'id': 'a', 'label': 'scalene'}, {'id': 'b', 'label': 'isosceles'}, {'id': 'c', 'label': 'equilateral'}]},
                {'id': 'angles', 'options': [{'id': 'a', 'label': 'acute'}, {'id': 'b', 'label': 'right'}, {'id': 'c', 'label': 'obtuse'}]},
            ],
        }

    triangle_prompt = 'The triangle is marked with tick marks for equal sides and a square for a right angle. Fill in the two blanks.'
    right_iso = {'templateId': 'triangle-sides-angles-blanks', 'prompt': triangle_prompt, 'response': blanks(None, None),
                 'figure': _shapes([(0, 0), (4, 0), (0, 4)])}
    require(solve(right_iso) == '{"sides":"b","angles":"b"}', 'Right isosceles')
    equilateral = copy.deepcopy(right_iso)
    equilateral['figure'] = _shapes([(0, 0), (4, 0), (2, 2 * math.sqrt(3))])
    require(solve(equilateral) == '{"sides":"c","angles":"a"}', 'Equilateral acute')

    quad_prompt = 'What is the most exact name for this quadrilateral?'
    names = {
        'square': [(0, 0), (2, 0), (2, 2), (0, 2)],
        'rectangle': [(0, 0), (4, 0), (4, 2), (0, 2)],
        'rhombus': [(0, 0), (2, 1), (0, 2), (-2, 1)],
        'parallelogram': [(0, 0), (4, 0), (5, 2), (1, 2)],
        'trapezoid': [(0, 0), (4, 0), (3, 2), (1, 2)],
    }
    for name, points in names.items():
        shown = ['square', 'rectangle', 'rhombus', 'parallelogram'] if name != 'trapezoid' else ['trapezoid', 'parallelogram', 'rectangle', 'square']
        public = {'templateId': 'quadrilateral-attributes', 'prompt': quad_prompt, 'response': _choice(shown), 'figure': _shapes(points)}
        require(solve(public) == option_id(public, name), name)

    composite = {
        'templateId': 'composite-rectangle-measure',
        'prompt': 'A dashed line splits this figure into two rectangles. Every outer side is labeled in centimeters, and the marked corners are right angles. The dashed line is inside the figure. What is the perimeter, in centimeters?',
        'figure': {
            'kind': 'measured-polygon', 'unit': 'cm',
            'vertices': [[0, 0], [6, 0], [6, 3], [3, 3], [3, 8], [0, 8]],
            'sides': [6, 3, 3, 5, 3, 8],
            'heights': [{'from': [3, 3], 'to': [0, 3], 'value': 3}],
            'rightAngles': [0, 1, 4, 5],
        },
    }
    require(solve(composite) == '28', 'Perimeter of the sample L is 28')
    area_item = copy.deepcopy(composite)
    area_item['prompt'] = 'A dashed line splits this figure into two rectangles. Every outer side is labeled in centimeters, and the marked corners are right angles. What is the area, in square centimeters?'
    require(solve(area_item) == '33', 'Area of the sample L is 33')
    bad_side = copy.deepcopy(composite)
    bad_side['figure']['sides'][0] = 7
    _must_fail(bad_side)

    formulas = {
        'templateId': 'rectangle-formula-select',
        'prompt': 'The length $l$ is the horizontal side and the width $w$ is the vertical side. Select the 3 expressions that equal the perimeter.',
        'response': {
            'kind': 'multi-select', 'label': 'Choose 3 expressions', 'selectionCount': 3,
            'options': [{'id': f'option-{chr(97 + i)}', 'label': label} for i, label in enumerate(
                ['$l + w + l + w$', '$2l + 2w$', '$2(l + w)$', r'$l \times w$', '$l + w$'])],
        },
        'figure': {'kind': 'measure-rectangle', 'width': {'value': 6, 'unit': 'cm'}, 'height': {'value': 4, 'unit': 'cm'}},
    }
    expected = '["option-a","option-b","option-c"]'
    require(solve(formulas) == expected, 'Three perimeter writings')
    labels = [o['label'] for o in formulas['response']['options']]
    explanation = [f"{label}: {'true' if o['id'] in json.loads(expected) else 'false'}. Checked." for label, o in zip(labels, formulas['response']['options'])]
    problem = {'public': formulas, 'answer': expected, 'explanation': explanation, 'hint': 'The length is 6 centimeters and the width is 4 centimeters.'}
    require(review_problem(problem) == expected, 'Perimeter review')
    area_formulas = copy.deepcopy(formulas)
    area_formulas['prompt'] = 'The length $l$ is the horizontal side and the width $w$ is the vertical side. Select the 2 expressions that equal the area.'
    area_formulas['response']['selectionCount'] = 2
    area_formulas['response']['label'] = 'Choose 2 expressions'
    area_formulas['response']['options'] = [{'id': f'option-{chr(97 + i)}', 'label': label} for i, label in enumerate(
        [r'$l \times w$', r'$w \times l$', '$l + w + l + w$', '$2l + 2w$', '$2(l + w)$'])]
    require(solve(area_formulas) == '["option-a","option-b"]', 'Two area writings')
    same = copy.deepcopy(formulas)
    same['figure']['width']['value'] = 4
    same['figure']['height']['value'] = 4
    _must_fail(same)
    return 17


if __name__ == '__main__':
    print(self_test())
