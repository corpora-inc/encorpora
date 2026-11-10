"""Independent public-input solver for transformation clause variants.

Affine maps, squared distances and proof correspondences are reconstructed
from the displayed question. This module owns no existing template IDs in
the discovery registry; the central reviewer routes the new surfaces here.
"""
import ast
import json
import re
from fractions import Fraction

NUMBER = r'-?\d+(?:\.\d+)?'
POINT = r'\((' + NUMBER + r'),\s*(' + NUMBER + r')\)'
SUPPORTED = frozenset({'similarity-by-transformation-grade-8'})
CHOICE_REVIEW = SUPPORTED


def require(ok, message):
    if not ok:
        raise ValueError(message)


def plain(text):
    text = (text.replace('$', '').replace('−', '-').replace('′', "'")
            .replace(r'\langle', '<').replace(r'\rangle', '>')
            .replace(r'\triangle ', '△').replace(r'\triangle', '△')
            .replace(r'\angle ', '∠').replace(r'\angle', '∠')
            .replace(r'\cong', '≅').replace(r'\sim', '~')
            .replace(r'\parallel', '∥').replace(r'\perp', '⊥')
            .replace(r'\cdot', '*').replace(r'^\circ', '°').strip())
    return re.sub(r'\s*([≅~∥⊥*=])\s*', r'\1', text)


def point(x, y):
    return (Fraction(str(x)), Fraction(str(y)))


def named_points(text):
    return {name: point(x, y) for name, x, y in
            re.findall(r"([A-Z]'?)" + POINT, plain(text))}


def subtract(a, b):
    return tuple(x - y for x, y in zip(a, b))


def distance2(a, b):
    return sum(v*v for v in subtract(a, b))


def cross(a, b):
    return a[0] * b[1] - a[1] * b[0]


def squared_sides(points):
    return [distance2(points[i], points[(i+1) % 3]) for i in range(3)]


def named_triangle(points, names):
    require(all(name in points for name in names), 'Every triangle vertex is stated')
    result = [points[name] for name in names]
    require(cross(subtract(result[1], result[0]), subtract(result[2], result[0])) != 0,
            'A triangle has nonzero area')
    return result


def transform(label, p):
    """Interpret the named motion independently, about its stated center."""
    label = plain(label).rstrip('.').strip().lower()
    translate = re.fullmatch(r'translate by <\s*(' + NUMBER + r'),\s*(' + NUMBER + r')\s*>', label)
    if translate:
        dx, dy = map(Fraction, translate.groups())
        return (p[0] + dx, p[1] + dy)
    rotation = re.fullmatch(r'rotate (90|180)° (clockwise|counterclockwise) about ' + POINT, label)
    if rotation:
        degrees, direction, cx, cy = rotation.groups()
        cx, cy = Fraction(cx), Fraction(cy)
        x, y = p[0] - cx, p[1] - cy
        if degrees == '180':
            return (cx-x, cy-y)
        return (cx+y, cy-x) if direction == 'clockwise' else (cx-y, cy+x)
    if label == 'reflect over the x-axis':
        return (p[0], -p[1])
    if label == 'reflect over the y-axis':
        return (-p[0], p[1])
    if label == 'reflect over y=x':
        return (p[1], p[0])
    if label == 'reflect over y=-x':
        return (-p[1], -p[0])
    mirror = re.fullmatch(r'reflect over ([xy])=(' + NUMBER + ')', label)
    if mirror:
        axis, location = mirror.groups()
        location = Fraction(location)
        return (2*location-p[0], p[1]) if axis == 'x' else (p[0], 2*location-p[1])
    raise ValueError('Unrecognized motion: ' + label)


def sequence(label, original):
    result = list(original)
    for motion in plain(label).rstrip('.').split(', then '):
        result = [transform(motion, p) for p in result]
    return result


def one(options, test, context):
    matches = [o['id'] for o in options if test(plain(o['label']))]
    require(len(matches) == 1, f'{context}: expected one correct answer, got {matches}')
    return matches[0]


def graphs(public):
    figure = public.get('figure')
    require(figure and figure['kind'] == 'scene', 'Transformation has its drawn figure')
    result = [e for e in figure['scene']['elements'] if e['type'] == 'graph']
    require(len(result) == 1, 'One coordinate diagram')
    return result[0]


def check_named_figure(public, expected):
    graph = graphs(public)
    actual = {plain(p['label']): point(p['x'], p['y']) for p in graph.get('points', []) if p.get('label')}
    for name, coordinates in expected.items():
        require(name in actual and actual[name] == coordinates, f'Diagram point {name} matches its stated coordinates')


def handles(public):
    ident, prompt, kind = public['templateId'], plain(public['prompt']), public['response']['kind']
    if ident == 'identify-rigid-motion':
        return 'Which sequence maps every vertex' in prompt or 'Which rigid motion maps ABC onto DEF' in prompt
    if ident == 'transformation-image':
        return prompt.startswith('Translate P')
    if ident in {'similarity-by-transformation', *SUPPORTED}:
        return ('Are they similar? Choose a sequence' in prompt or 'Why does a similarity transformation' in prompt
                or prompt.startswith('A dilation with scale factor'))
    if ident == 'transformation-rule-slots':
        return kind == 'structured-work'
    if ident == 'place-transformed-image':
        return prompt.startswith('Triangle ABC has vertices')
    if ident == 'dilation-measure':
        return kind == 'structured-work'
    if ident == 'similarity-proof-aa':
        return prompt.startswith('Right triangle ') or 'lies inside side' in prompt
    if ident == 'two-column-congruence-proof':
        return 'CPCTC means' in prompt
    return False


def work_answer(public, values):
    rows = public['response']['rows']
    require(len(rows) == len(values), 'Every work row has a public-givens derivation')
    answer = []
    for row, expected in zip(rows, values):
        require(len(row['fields']) == len(expected), 'Every work field independently solved')
        answer.append(['' if field.get('given') is not None else str(value)
                       for field, value in zip(row['fields'], expected)])
    return json.dumps(answer, separators=(',', ':'))


def bank_option(public, bank, label):
    options = next(b['options'] for b in public['response']['banks'] if b['id'] == bank)
    return one(options, lambda shown: shown == plain(label), 'Proof or classification bank')


def expression(expr, x, y):
    """Evaluate a coordinate expression as exact arithmetic, never Python eval."""
    source = re.sub(r'(\d)([xy])', r'\1*\2', expr)
    tree = ast.parse(source, mode='eval').body

    def visit(node):
        if isinstance(node, ast.Name) and node.id in {'x', 'y'}:
            return x if node.id == 'x' else y
        if isinstance(node, ast.Constant) and isinstance(node.value, int):
            return Fraction(node.value)
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.USub):
            return -visit(node.operand)
        if isinstance(node, ast.BinOp):
            a, b = visit(node.left), visit(node.right)
            if isinstance(node.op, ast.Add):
                return a+b
            if isinstance(node.op, ast.Sub):
                return a-b
            if isinstance(node.op, ast.Mult):
                return a*b
        raise ValueError('Invalid coordinate expression: ' + source)

    return visit(tree)


def solve(public):
    require(handles(public), 'Not a transformation clause surface')
    ident, prompt, response = public['templateId'], plain(public['prompt']), public['response']
    points = named_points(prompt)
    if ident == 'transformation-image':
        original = points['P']
        motion = re.search(r' by (<[^>]+>)\.', prompt)[1]
        target = transform('translate by ' + motion, original)
        return one(response['options'], lambda label: point(*re.fullmatch(POINT, label).groups()) == target, 'Translation image')
    if ident == 'identify-rigid-motion':
        original = named_triangle(points, 'ABC')
        names = ["A'", "B'", "C'"] if 'Which sequence' in prompt else list('DEF')
        target = named_triangle(points, names)
        check_named_figure(public, points)
        lengths, image_lengths = squared_sides(original), squared_sides(target)

        def correct(label):
            if label.startswith('No rigid motion'):
                return lengths != image_lengths
            return sequence(label, original) == target

        return one(response['options'], correct, 'Rigid correspondence')
    if ident in {'similarity-by-transformation', *SUPPORTED}:
        if 'Are they similar? Choose a sequence' in prompt:
            original = named_triangle(points, 'ABC')
            target = named_triangle(points, ["A'", "B'", "C'"])
            check_named_figure(public, points)
            ratios = [b/a for a, b in zip(squared_sides(original), squared_sides(target))]

            def correct(label):
                if label.startswith('No: the side lengths'):
                    return len(set(ratios)) > 1
                if label.startswith('No: a dilation'):
                    return False
                scale, motion = re.fullmatch(r'Yes: dilate by ([\d/]+) about the origin, then (.+)\.', label).groups()
                k = Fraction(scale)
                return sequence(motion, [(k*x, k*y) for x, y in original]) == target

            return one(response['options'], correct, 'Similarity correspondence')
        if 'Why does a similarity transformation' in prompt:
            k = Fraction(re.search(r'FD/CA=([\d/]+)\.', prompt)[1])
            require(k > 0 and k != 1, 'Nonunit positive similarity ratio')
            return one(response['options'], lambda label: label.startswith(f'Dilate by {k}') and 'SSS' in label and 'rigid motion' in label, 'Similarity explanation')
        k = Fraction(re.search(r'scale factor ([\d/]+)', prompt)[1])
        ab = Fraction(re.search(r'AB=(' + NUMBER + ')', prompt)[1])
        bc = Fraction(re.search(r'BC=(' + NUMBER + ')', prompt)[1])
        angle = Fraction(re.search(r'∠A=(' + NUMBER + ')°', prompt)[1])
        require(ab != bc and k != 1, 'Noncorresponding-side and congruence distractors are false')
        truth = []
        for option in response['options']:
            text = plain(option['label'])
            if text == 'DE/AB=EF/BC=FD/CA':
                good = True
            elif text == '△DEF≅△ABC':
                good = k == 1
            elif text.startswith('∠D='):
                good = Fraction(text.removeprefix('∠D=').removesuffix('°')) == angle
            else:
                side, shown = re.fullmatch(r'(DE|EF)=(' + NUMBER + ')', text).groups()
                good = Fraction(shown) == (ab if side == 'DE' else bc) * k
            if good:
                truth.append(option['id'])
        require(len(truth) == response['selectionCount'], 'Exactly the stated number of true similarity statements')
        return json.dumps(sorted(truth), separators=(',', ':'))
    if ident == 'transformation-rule-slots':
        rule = re.search(r'T\(x,y\)=\(([^)]+)\)', prompt)[1].split(',')
        raw_input = re.search(r'Find T' + POINT, prompt).groups()
        x, y = point(*raw_input)
        output = tuple(expression(e, x, y) for e in rule)
        image = point(*re.search(r'T\(P\)=' + POINT, prompt).groups())
        shift = tuple(expression(e, 0, 0) for e in rule)
        first = tuple(expression(e, 1, 0)-s for e, s in zip(rule, shift))
        second = tuple(expression(e, 0, 1)-s for e, s in zip(rule, shift))
        determinant = cross(first, second)
        require(determinant != 0, 'The rule has a unique preimage')
        dx, dy = subtract(image, shift)
        preimage = ((dx*second[1]-dy*second[0])/determinant,
                    (first[0]*dy-first[1]*dx)/determinant)
        require(tuple(expression(e, *preimage) for e in rule) == image, 'Preimage solves both coordinate equations')
        matrix = tuple(first + second)
        names = {
            (1, 0, 0, 1): 'A translation only',
            (-1, 0, 0, 1): 'Reflection over the y-axis, then translation',
            (1, 0, 0, -1): 'Reflection over the x-axis, then translation',
            (0, 1, -1, 0): 'A 90° counterclockwise rotation',
            (0, -1, 1, 0): 'A 90° clockwise rotation',
            (-1, 0, 0, -1): 'A 180° rotation',
            (0, 1, 1, 0): 'A reflection over y = x',
        }
        rigid = sum(v*v for v in first) == sum(v*v for v in second) == 1 and sum(a*b for a, b in zip(first, second)) == 0
        classification = names.get(matrix) if rigid else 'Not a rigid motion'
        require(classification is not None, 'Recognized rigid function')
        return work_answer(public, [output, preimage, [bank_option(public, 'classify', classification)]])
    if ident == 'place-transformed-image':
        original = named_triangle(points, 'ABC')
        motion = re.search(r'\. (.+)\. Place', prompt)[1]
        target = sequence(motion, original)
        grid = response['grid']
        require(all(grid['xMin'] <= x <= grid['xMax'] and grid['yMin'] <= y <= grid['yMax'] and x.denominator == y.denominator == 1 for x, y in target), 'All image points lie on the plot lattice')
        require(response['ordered'] and response['pointLabels'] == ['A′', 'B′', 'C′'], 'Preserve vertex correspondence')
        require([point(p['x'], p['y']) for p in response['given']['vertices']] == original, 'Plot preimage matches the prompt')
        return json.dumps([[int(x), int(y)] for x, y in target], separators=(',', ':'))
    if ident == 'dilation-measure':
        center, a, b, p = (points[name] for name in 'CABP')
        k = Fraction(re.search(r'scale factor (' + NUMBER + ')', prompt)[1])
        require(center != (0, 0) and k > 0 and k != 1, 'Nonorigin dilation with a nonunit positive scale')
        check_named_figure(public, points)
        image = lambda q: tuple(c+k*(v-c) for c, v in zip(center, q))
        ap, bp, pp = image(a), image(b), image(p)
        require(distance2(ap, bp) == k*k*distance2(a, b), 'Dilation scales lengths uniformly')
        require(cross(subtract(p, center), subtract(a, center)) == 0 and cross(subtract(pp, center), subtract(a, center)) == 0, 'The line through the center maps to itself')
        dx, dy = subtract(bp, ap)
        slope = None if dx == 0 else dy/dx
        bank = next(b for b in response['banks'] if b['id'] == 'slope')['options']
        values = [None if o['label'].startswith('Undefined') else Fraction(o['label']) for o in bank]
        require(len(set(values)) == len(values), 'Slope distractors are mathematically distinct')
        selection = [o['id'] for o, v in zip(bank, values) if v == slope]
        require(len(selection) == 1, 'Exactly one image slope')
        return work_answer(public, [ap, bp, [k], [selection[0]], pp])
    return solve_proof(public)


def solve_proof(public):
    prompt, response = plain(public['prompt']), public['response']
    statements = [plain(row['label']) for row in response['rows']]
    reasons = []
    numeric = None
    if 'lies inside side' in prompt:
        a, b, c = re.match(r'In triangle ([A-Z])([A-Z])([A-Z]),', prompt).groups()
        d, e = re.findall(r'([A-Z]) lies inside side', prompt)
        points = {p['label']: point(p['x'], p['y']) for p in graphs(public)['points']}
        u, v = subtract(points[d], points[a]), subtract(points[e], points[a])
        ab, ac = subtract(points[b], points[a]), subtract(points[c], points[a])
        require(cross(u, ab) == cross(v, ac) == 0, 'Points lie on the stated sides')
        ratio1 = next(x/y for x, y in zip(u, ab) if y)
        ratio2 = next(x/y for x, y in zip(v, ac) if y)
        require(0 < ratio1 == ratio2 < 1, 'Positive equal ratios of interior side segments')
        expected = [f'∠{a}≅∠{a}', f'△{a}{d}{e}~△{a}{b}{c}', f'∠{a}{d}{e}≅∠{a}{b}{c}', f'{d}{e}∥{b}{c}']
        reasons = ['Reflexive property', 'SAS similarity', 'Corresponding angles of similar triangles are congruent', 'Equal corresponding angles imply parallel lines']
        if f'{a}{d}/{d}{b}={a}{e}/{e}{c}' in prompt:
            expected.insert(0, f'{a}{d}/{a}{b}={a}{e}/{a}{c}')
            reasons.insert(0, 'Equal part/part ratios give equal part/whole ratios')
        require(statements == expected, 'Converse proof has the matching side and angle correspondences')
        bank_labels = [plain(o['label']) for bnk in response['banks'] for o in bnk['options']]
        require('Parallel lines imply equal corresponding angles' in bank_labels, 'The forward/converse confusion is offered')
    elif prompt.startswith('Right triangle '):
        a, b, c = re.match(r'Right triangle ([A-Z])([A-Z])([A-Z])', prompt).groups()
        d = re.search(r'Altitude ' + c + '([A-Z])', prompt)[1]
        require(f'∠{a}{d}{c} and ∠{c}{d}{b} are right angles' in prompt,
                'The two altitude angles, not the straight angle, are right')
        require(graphs(public).get('aspect') == 1, 'The right-triangle diagram preserves equal coordinate scales')
        expected = [f'△{a}{c}{d}~△{a}{b}{c} and △{c}{b}{d}~△{a}{b}{c}',
                    f'{a}{c}/{a}{b}={a}{d}/{a}{c}; {b}{c}/{a}{b}={d}{b}/{b}{c}',
                    f'{a}{c}^2={a}{d}*{a}{b}; {b}{c}^2={d}{b}*{a}{b}',
                    f'{a}{c}^2+{b}{c}^2=({a}{d}+{d}{b}){a}{b}',
                    f'{a}{d}+{d}{b}={a}{b}, so {a}{c}^2+{b}{c}^2={a}{b}^2']
        require(statements[:5] == expected, 'Similarity proof proportions and algebra preserve corresponding sides')
        reasons = ['AA similarity', 'Corresponding sides of similar triangles are proportional', 'Cross products property', 'Addition of equalities and distributive property', 'Segment addition, followed by substitution']
        bank_labels = [plain(o['label']) for bnk in response['banks'] for o in bnk['options']]
        require('Pythagorean Theorem' in bank_labels and 'Pythagorean Theorem' not in reasons, 'Circular proof is offered but never accepted')
        if 'Finally use ' in prompt:
            ad = int(re.search(a+d+r'=(\d+)', prompt)[1])
            db = int(re.search(d+b+r'=(\d+)', prompt)[1])
            numeric = [ad*(ad+db), db*(ad+db)]
            require(sum(numeric) == (ad+db)**2, 'Leg squares sum to the hypotenuse square')
    elif public['templateId'] == 'two-column-congruence-proof':
        if 'SM∥IL' in prompt:
            expected = ['∠MSE≅∠LIE and ∠SME≅∠ILE', 'SM≅IL', '△SME≅△ILE', 'SE≅IE', 'E is the midpoint of SI']
            reasons = ['Alternate interior angles of parallel lines', 'Given', 'ASA congruence', 'CPCTC', 'Definition of midpoint']
        elif 'AD bisects ∠BAC, with D on BC' in prompt:
            expected = ['AB≅AC', '∠BAD≅∠CAD', 'AD≅AD', '△BAD≅△CAD', '∠B≅∠C']
            reasons = ['Given', 'Definition of angle bisector', 'Reflexive property', 'SAS congruence', 'CPCTC']
        elif 'DB≅DC' in prompt:
            require('D inside ∠BAC' in prompt, 'The stated ray is the internal angle bisector')
            expected = ['AB≅AC and DB≅DC', 'AD≅AD', '△BAD≅△CAD', '∠BAD≅∠CAD', 'AD bisects ∠BAC']
            reasons = ['Given', 'Reflexive property', 'SSS congruence', 'CPCTC', 'Definition of angle bisector']
        else:
            require('M is the midpoint of AB' in prompt and 'CM⊥AB' in prompt, 'Perpendicular-bisector givens')
            expected = ['AM≅MB', '∠AMC≅∠BMC', 'CM≅CM', '△AMC≅△BMC', 'CA≅CB']
            reasons = ['Definition of midpoint', 'Perpendicular lines form congruent right angles', 'Reflexive property', 'SAS congruence', 'CPCTC']
        require(len(statements) == len(expected), 'Every requested congruence-proof step is present')
        congruence_index = next(i for i, s in enumerate(expected) if s.startswith('△'))
        require(all(i > congruence_index for i, reason in enumerate(reasons) if reason == 'CPCTC'), 'CPCTC is used only after congruence')
        answers = [[bank_option(public, 'statement', statement), bank_option(public, 'reason', reason)]
                   for statement, reason in zip(expected, reasons)]
        return work_answer(public, answers)
    else:
        raise ValueError('Unknown proof surface')
    answers = [[bank_option(public, 'reason', reason)] for reason in reasons]
    if numeric is not None:
        answers.append(numeric)
    return work_answer(public, answers)


def equivalent(public, actual, expected):
    kind = public['response']['kind']
    if kind in {'choice', 'figure-choice'}:
        return actual == expected
    if kind in {'point-plot', 'multi-select'}:
        return json.loads(actual) == json.loads(expected)
    a, b = json.loads(actual), json.loads(expected)
    if len(a) != len(b) or any(len(x) != len(y) for x, y in zip(a, b)):
        return False
    for ar, br, row in zip(a, b, public['response']['rows']):
        for x, y, field in zip(ar, br, row['fields']):
            if field['kind'] == 'number':
                if Fraction(x) != Fraction(y):
                    return False
            elif x != y:
                return False
    return True


def review_problem(problem):
    answer = solve(problem['public'])
    require(equivalent(problem['public'], problem['answer'], answer), 'Generated answer differs from independent transformation solution')
    return answer


def self_test():
    original = [(Fraction(1), Fraction(1)), (Fraction(4), Fraction(1)), (Fraction(4), Fraction(3))]
    require(sequence('rotate 90° clockwise about (4, 1)', original) == [(4, 4), (4, 1), (6, 1)], 'Nonorigin rotation fixture')
    require(transform('reflect over x=3', (1, 4)) == (5, 4), 'Nonaxis mirror fixture')
    require(transform('reflect over y=-x', (1, 4)) == (-4, -1), 'Diagonal mirror fixture')
    require(sequence('reflect over the x-axis, then translate by <2,3>', [(1, 4)]) != sequence('translate by <2,3>, then reflect over the x-axis', [(1, 4)]), 'Noncommuting sequence fixture')
    require(expression('-y', 4, 2) == -2 and expression('2x', 4, 2) == 8, 'Exact coordinate function fixtures')
    return 'Transformation clause oracle fixtures passed'
