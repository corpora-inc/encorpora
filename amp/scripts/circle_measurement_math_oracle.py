"""Independent exact circle checks derived exclusively from public givens."""
import copy
import ast
import json
import math
import re
import subprocess
from collections import Counter
from fractions import Fraction
from pathlib import Path
from inequality_math_oracle import PublicationParser, PublicationNode

CIRCLE = frozenset({
    'circle-circumference-coefficient', 'circle-area-coefficient',
    'arc-length-coefficient', 'sector-area-coefficient',
})
ANGLES = frozenset({30, 45, 60, 90, 120, 135, 150, 180,
                    210, 225, 240, 270, 300, 315, 330})


def require(condition, message):
    if not condition:
        raise ValueError(message)


def parse_circle(public):
    template = public.get('templateId')
    require(template in CIRCLE, 'Unknown circle template')
    require(public.get('figure') is None, 'Unexpected runtime circle figure')
    require(public.get('response') == {'kind': 'fraction', 'label': 'Exact coefficient $a$'},
            'Circle response must request the exact coefficient')
    prefix = r'A circle has a (radius|diameter) of ([1-9][0-9]*(?:/2)?) cm\. '
    tails = {
        'circle-circumference-coefficient': r'Its circumference is \$a\\pi\$ cm\. What is \$a\$\?',
        'circle-area-coefficient': r'Its area is \$a\\pi\$ square centimeters\. What is \$a\$\?',
        'arc-length-coefficient': r'An arc corresponds to a central angle of ([1-9][0-9]*) degrees\. Its length is \$a\\pi\$ cm\. What is \$a\$\?',
        'sector-area-coefficient': r'A sector has a central angle of ([1-9][0-9]*) degrees\. Its area is \$a\\pi\$ square centimeters\. What is \$a\$\?',
    }
    found = re.fullmatch(prefix + tails[template], public.get('prompt', ''))
    require(found is not None, 'Malformed circle statement or units')
    dimension = Fraction(found[2])
    require(str(dimension) == found[2] and dimension.numerator <= 24,
            'Circle dimension must be canonical and in the reviewed domain')
    angle = int(found[3]) if len(found.groups()) == 3 else 360
    require(angle in ANGLES if len(found.groups()) == 3 else angle == 360,
            'Unsupported central angle')
    return template, found[1], dimension, angle


APPROXIMATE_AREA = re.compile(r'A circle has a (radius|diameter) of ([1-9][0-9]*) cm\. Use 3\.14 for \$\\pi\$\. What is its area, in square centimeters\?')


def solve_approximate_area(public):
    """Area with pi taken as 3.14, from a whole radius or an even diameter."""
    require(public.get('templateId') == 'circle-area-coefficient', 'Only the area family uses 3.14')
    require(public.get('figure') is None, 'Unexpected runtime circle figure')
    require(public.get('response') == {'kind': 'number', 'label': 'Area in square centimeters'},
            'Approximate area response must be numeric')
    found = APPROXIMATE_AREA.fullmatch(public.get('prompt', ''))
    require(found is not None, 'Malformed approximate area statement')
    given = int(found[2])
    require(found[1] == 'radius' or given % 2 == 0, 'A diameter must be even so the radius is whole')
    radius = Fraction(given) if found[1] == 'radius' else Fraction(given, 2)
    require(2 <= radius <= 15, 'Radius outside the reviewed domain')
    return Fraction(314, 100) * radius * radius


def solve_circle(public):
    if public.get('prompt', '').find('Use 3.14') >= 0:
        return solve_approximate_area(public)
    template, kind, dimension, angle = parse_circle(public)
    diameter = dimension if kind == 'diameter' else dimension + dimension
    # C/π = diameter; A/π = diameter squared divided by four.
    whole = diameter if template in {'circle-circumference-coefficient', 'arc-length-coefficient'} else diameter * diameter / 4
    return whole * Fraction(angle, 360)


def fixture(template, kind, dimension, angle=360):
    endings = {
        'circle-circumference-coefficient': 'Its circumference is $a\\pi$ cm.',
        'circle-area-coefficient': 'Its area is $a\\pi$ square centimeters.',
        'arc-length-coefficient': f'An arc corresponds to a central angle of {angle} degrees. Its length is $a\\pi$ cm.',
        'sector-area-coefficient': f'A sector has a central angle of {angle} degrees. Its area is $a\\pi$ square centimeters.',
    }
    return {'templateId': template,
            'prompt': f'A circle has a {kind} of {dimension} cm. {endings[template]} What is $a$?',
            'response': {'kind': 'fraction', 'label': 'Exact coefficient $a$'}}


def review_circle_fixtures():
    # Answers are handwritten, not obtained from an author helper.
    cases = [
        ('circle-circumference-coefficient', 'radius', '3', 360, '6'),
        ('circle-circumference-coefficient', 'diameter', '7/2', 360, '7/2'),
        ('circle-area-coefficient', 'radius', '3/2', 360, '9/4'),
        ('circle-area-coefficient', 'diameter', '7', 360, '49/4'),
        ('circle-area-coefficient', 'diameter', '1/2', 360, '1/16'),
        ('arc-length-coefficient', 'radius', '6', 30, '1'),
        ('arc-length-coefficient', 'diameter', '7', 270, '21/4'),
        ('arc-length-coefficient', 'diameter', '1/2', 330, '11/24'),
        ('sector-area-coefficient', 'radius', '4', 135, '6'),
        ('sector-area-coefficient', 'diameter', '6', 240, '6'),
        ('sector-area-coefficient', 'diameter', '1/2', 45, '1/128'),
        ('sector-area-coefficient', 'radius', '5/2', 180, '25/8'),
    ]
    for template, kind, dimension, angle, answer in cases:
        require(solve_circle(fixture(template, kind, dimension, angle)) == Fraction(answer),
                'Circle handwritten fixture mismatch')
    approximate = {'templateId': 'circle-area-coefficient',
                   'prompt': 'A circle has a diameter of 10 cm. Use 3.14 for $\\pi$. What is its area, in square centimeters?',
                   'response': {'kind': 'number', 'label': 'Area in square centimeters'}}
    require(solve_circle(approximate) == Fraction('78.5'), 'Circle handwritten fixture mismatch')
    approximate['prompt'] = approximate['prompt'].replace('diameter of 10', 'radius of 12')
    require(solve_circle(approximate) == Fraction('452.16'), 'Circle handwritten fixture mismatch')
    worked = {'public': {'id': 'x', 'templateId': 'circle-area-coefficient', 'templateVersion': 1, 'seed': 's', 'skillId': 'circle-measurement',
                         'prompt': 'A circle has a diameter of 10 cm. Use 3.14 for $\\pi$. What is its area, in square centimeters?',
                         'response': {'kind': 'number', 'label': 'Area in square centimeters'}},
              'answer': '78.5', 'hint': 'Square the radius, then multiply by 3.14.',
              'explanation': ['A diameter is twice the radius. Divide by 2: $r = 10 \\div 2 = 5$ cm.', 'Square the radius: $5 \\times 5 = 25$.',
                              'Replace $\\pi$ with 3.14: $A \\approx 3.14 \\times 25 = 78.5$ square centimeters.']}
    require(check_approximate_problem(worked) == Fraction('78.5'), 'Approximate worked fixture mismatch')
    for change in (lambda w: w.__setitem__('answer', '79'), lambda w: w['explanation'].__setitem__(1, 'Square the radius: $5 \\times 5 = 24$.'),
                   lambda w: w['explanation'].__setitem__(2, 'Replace $\\pi$ with 3.14: $A \\approx 3.14 \\times 25 = 78$ square centimeters.'),
                   lambda w: w['public'].__setitem__('answer', '78.5'), lambda w: w.__setitem__('hint', ' ')):
        altered = copy.deepcopy(worked); change(altered)
        try:
            check_approximate_problem(altered)
        except (ValueError, KeyError):
            continue
        raise ValueError('Approximate circle checker accepted a corrupted problem')
    original = fixture('sector-area-coefficient', 'diameter', '7/2', 270)
    mutants = []
    for old, new in [('radius of 12', 'diameter of 11'), ('radius of 12', 'radius of 1'), ('3.14', '3.1'),
                     ('in square centimeters', 'in centimeters'), ('Use 3.14 for $\\pi$. ', '')]:
        altered = copy.deepcopy(approximate)
        altered['prompt'] = altered['prompt'].replace(old, new)
        mutants.append(altered)
    altered = copy.deepcopy(approximate); altered['response'] = {'kind': 'fraction', 'label': 'Exact coefficient $a$'}; mutants.append(altered)
    altered = copy.deepcopy(approximate); altered['templateId'] = 'circle-circumference-coefficient'; mutants.append(altered)
    for old, new in [('7/2', '0'), ('7/2', '-1'), ('7/2', '2/2'),
                     ('7/2', '25'), ('270', '360'), ('270', '0'),
                     ('270', '361'), ('270', '25'), ('square centimeters', 'cm'),
                     ('diameter', 'chord'), ('$a\\pi$', 'aπ')]:
        altered = copy.deepcopy(original)
        altered['prompt'] = altered['prompt'].replace(old, new)
        mutants.append(altered)
    altered = copy.deepcopy(original); altered['response']['kind'] = 'number'; mutants.append(altered)
    altered = copy.deepcopy(original); altered['figure'] = {}; mutants.append(altered)
    for altered in mutants:
        try:
            solve_circle(altered)
        except (ValueError, ZeroDivisionError):
            continue
        raise ValueError(f'Circle parser accepted invalid fixture: {altered}')
    return {'handwritten': len(cases), 'rejectedMutations': len(mutants)}


def numeric_exercises(html):
    parser = PublicationParser(); parser.feed(html); parser.close()
    roots = [node for node in parser.root.children if isinstance(node, PublicationNode)]
    require(len(roots) == 1 and roots[0].tag == 'html', 'Expected complete publication HTML')
    exercises = [node for node in parser.root.descendants() if node.has_class('exercise')]
    require(len(exercises) == 12, 'Expected twelve printed exercises')
    result = []
    for index, exercise in enumerate(exercises, 1):
        nodes = list(exercise.descendants())
        children = [node for node in exercise.children if isinstance(node, PublicationNode)]
        require(all(isinstance(node, PublicationNode) or not node.strip() for node in exercise.children), 'Unexpected exercise text')
        tags = [node.tag for node in children]
        require(tags in (['h2', 'div'], ['h2', 'ol', 'p']), 'Malformed numeric exercise structure')
        require(not any(node.has_class('exercise') or node.tag in ('script', 'input') or 'data-answer' in node.attributes or 'data-correct' in node.attributes for node in nodes), 'Unexpected answer leakage or nested exercise')
        heading = children[0].text().strip(); prefix = f'{index}. '
        require(heading.startswith(prefix), 'Incorrect printed exercise order')
        if tags == ['h2', 'div']:
            require(children[1].has_class('writing') and not children[1].children, 'Workbook exposes content in answer space')
            answer, steps = None, []
        else:
            items = [node for node in children[1].children if isinstance(node, PublicationNode)]
            require(items and all(node.tag == 'li' for node in items), 'Malformed solution steps')
            strong = [node for node in children[2].children if isinstance(node, PublicationNode)]
            require(len(strong) == 1 and strong[0].tag == 'strong', 'Malformed printed answer')
            answer = strong[0].text().strip()
            require(answer.startswith('Answer: '), 'Missing printed answer label')
            answer = answer.removeprefix('Answer: ')
            steps = [node.text().strip() for node in items]
        result.append({'prompt': heading[len(prefix):], 'answer': answer, 'steps': steps})
    return result


def check_problem(problem):
    public = problem['public']
    require(set(public) == {'id', 'templateId', 'templateVersion', 'seed', 'skillId', 'prompt', 'response'},
            'Unexpected public circle data or answer leakage')
    expected_skill = 'circle-measurement' if public['templateId'].startswith('circle-') else 'arc-sector-measure'
    require(public['templateVersion'] == 1 and public['skillId'] == expected_skill,
            'Wrong circle version or skill')
    answer = solve_circle(public)
    require(Fraction(problem['answer']) == answer, 'Mismatch in exact circle coefficient')
    require(isinstance(problem['hint'], str) and problem['hint'].strip(), 'Missing circle hint')
    require(len(problem['explanation']) >= 3 and all(isinstance(s, str) and s.strip() for s in problem['explanation']),
            'Missing explicit circle solution')
    check_steps(public, problem['explanation'])
    return parse_circle(public), answer


def check_approximate_problem(problem):
    """An area with pi taken as 3.14: public shape, exact answer and the worked steps' arithmetic."""
    public = problem['public']
    require(set(public) == {'id', 'templateId', 'templateVersion', 'seed', 'skillId', 'prompt', 'response'},
            'Unexpected public circle data or answer leakage')
    require(public['templateVersion'] == 1 and public['skillId'] == 'circle-measurement', 'Wrong circle version or skill')
    answer = solve_approximate_area(public)
    require(Fraction(problem['answer']) == answer, 'Mismatch in approximate circle area')
    require(isinstance(problem['hint'], str) and problem['hint'].strip(), 'Missing circle hint')
    steps = problem['explanation']
    require(len(steps) >= 3 and all(isinstance(step, str) and step.strip() for step in steps), 'Missing explicit circle solution')
    found = APPROXIMATE_AREA.fullmatch(public['prompt'])
    radius = int(found[2]) if found[1] == 'radius' else int(found[2]) // 2
    squares = re.findall(r'\$(\d+) \\times (\d+) = (\d+)\$', ' '.join(steps))
    require(squares and all(int(a) == int(b) == radius and int(a) * int(b) == int(c) for a, b, c in squares),
            'False radius square in an approximate area')
    products = re.findall(r'\$A \\approx 3\.14 \\times (\d+) = ([\d.]+)\$', steps[-1])
    require(len(products) == 1 and int(products[0][0]) == radius * radius and Fraction(products[0][1]) == answer,
            'False 3.14 product in an approximate area')
    return answer


def exact_expression(source, bindings):
    """Evaluate an affine expression in formal π, as (constant, coefficient)."""
    source = source.replace('\\pi', 'p').replace('\\times', '*').replace('\\div', '/')
    source = source.replace('×', '*').replace('÷', '/').replace('−', '-')
    while '\\frac' in source:
        source, changes = re.subn(r'\\frac\{([^{}]+)\}\{([^{}]+)\}', r'((\1)/(\2))', source)
        require(changes > 0, 'Unsupported exact TeX fraction')
    source = source.replace('{', '(').replace('}', ')').replace('^', '**')
    source = re.sub(r'(?<=[0-9)])\s*(?=[A-Za-z(])', '*', source)
    source = re.sub(r'(?<=[A-Za-z])\s*(?=[A-Za-z0-9(])', '*', source)
    def evaluate(node):
        if isinstance(node, ast.Constant) and type(node.value) is int:
            return Fraction(node.value), Fraction(0)
        if isinstance(node, ast.Name) and node.id in bindings:
            return bindings[node.id]
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.USub, ast.UAdd)):
            a, b = evaluate(node.operand)
            return (-a, -b) if isinstance(node.op, ast.USub) else (a, b)
        require(isinstance(node, ast.BinOp), 'Unsupported circle arithmetic')
        (a, b), (c, d) = evaluate(node.left), evaluate(node.right)
        if isinstance(node.op, ast.Add): return a+c, b+d
        if isinstance(node.op, ast.Sub): return a-c, b-d
        if isinstance(node.op, ast.Mult):
            require(b*d == 0, 'Nonlinear π expression'); return a*c, a*d+b*c
        if isinstance(node.op, ast.Div):
            require(d == 0 and c != 0, 'Invalid exact division'); return a/c, b/c
        if isinstance(node.op, ast.Pow):
            require(b == d == 0 and c.denominator == 1 and 0 <= c <= 2, 'Unsupported exact power')
            return a**int(c), Fraction(0)
        raise ValueError('Unsupported exact circle operation')
    try:
        return evaluate(ast.parse(source.strip(), mode='eval').body)
    except SyntaxError as error:
        raise ValueError('Malformed exact circle expression') from error


def check_steps(public, steps):
    _, kind, dimension, angle = parse_circle(public)
    radius = dimension if kind == 'radius' else dimension / 2
    zero = Fraction(0)
    bindings = {'p': (zero, Fraction(1)), 'r': (radius, zero), 'd': (2*radius, zero),
                'C': (zero, radius*2), 'A': (zero, radius*radius),
                'L': (zero, 2*radius*Fraction(angle, 360)),
                'S': (zero, radius*radius*Fraction(angle, 360)),
                'a': (solve_circle(public), zero)}
    checked = 0
    for step in steps:
        for expression in re.findall(r'\$([^$]+)\$', step):
            parts = re.split(r'([=<>])', expression)
            if len(parts) == 1:
                continue
            values = [exact_expression(part, bindings) for part in parts[::2]]
            for left, op, right in zip(values, parts[1::2], values[1:]):
                if op == '=':
                    require(left == right, 'False exact circle equality: ' + expression)
                else:
                    require(left[1] == right[1] == 0 and (left[0] < right[0] if op == '<' else left[0] > right[0]),
                            'False circle comparison: ' + expression)
                checked += 1
        prose = re.sub(r'\$[^$]+\$', '', step)
        for chain in re.findall(r'(?<![A-Za-z0-9])([rad0-9(][rad0-9() /×÷+−-]*(?:=[rad0-9() /×÷+−-]+)+)', prose):
            values = [exact_expression(part, bindings) for part in chain.split('=')]
            require(all(value == values[0] for value in values), 'False circle arithmetic: ' + chain)
            checked += len(values)-1
    require(checked >= 3, 'Missing checked circle worked equalities')


def check_worksheet(record):
    problems = record['problems']
    require(len(problems) == 12 and len({p['public']['prompt'] for p in problems}) == 12,
            'Circle worksheet requires twelve distinct problems')
    require(problems == record['replayed'], 'Printed circle problems do not replay')
    work = numeric_exercises(record['workbookHtml'])
    key = numeric_exercises(record['solutionsHtml'])
    values = []
    for problem, blank, solution in zip(problems, work, key):
        parsed, answer = check_problem(problem)
        require(parsed[0] == record['templateId'], 'Wrong circle worksheet family')
        require(blank['prompt'] == solution['prompt'] == problem['public']['prompt'],
                'Circle printed prompt differs from runtime')
        require(blank['answer'] is None and not blank['steps'], 'Circle workbook exposes solutions')
        require(Fraction(solution['answer']) == answer and solution['steps'] == problem['explanation'],
                'Circle printed answer or steps differ from validated solution')
        values.append((*parsed[1:], answer))
    require(Counter(kind for kind, *_ in values) == {'radius': 6, 'diameter': 6},
            'Circle sheet must balance radius and diameter givens')
    require(sum(d.denominator > 1 for _, d, _, _ in values) >= 3 and
            sum(a.denominator > 1 for *_, a in values) >= 2,
            'Missing fractional givens or answers')
    if record['templateId'] in {'arc-length-coefficient', 'sector-area-coefficient'}:
        angles = [angle for _, _, angle, _ in values]
        require(len(set(angles)) >= 6 and sum(a > 180 for a in angles) >= 3,
                'Insufficient angle variety')
        require(any(a < 90 for a in angles) and 90 in angles and
                any(90 < a < 180 for a in angles) and 180 in angles,
                'Missing acute, right, obtuse or straight central angle')


def check_manifest(record):
    require(record['kind'] == 'circle-measurement-manifest' and record['seeds'] == 1024 and record['editions'] == 16,
            'Invalid circle review manifest')
    require(len(record['templates']) == 4 and {t['id'] for t in record['templates']} == CIRCLE,
            'Missing circle template registration')
    for template in record['templates']:
        circle = template['id'].startswith('circle-')
        require(template['version'] == 1 and template['skillId'] == ('circle-measurement' if circle else 'arc-sector-measure') and
                template['gradeBand'] == ('6–8' if circle else '9–12'), 'Wrong circle template placement')
    # Each template may assess several facets; every circle template needs at least one partial mapping.
    require(record['coverageValid'] and len(record['mappings']) >= 4 and
            {m['templateId'] for m in record['mappings']} == CIRCLE and
            all(m['extent'] == 'partial' for m in record['mappings']),
            'Missing circle facets or unsupported completeness claim')
    require(len(record['bindings']) >= 4 and {b['templateId'] for b in record['bindings']} == CIRCLE,
            'Circle templates are not bound to default curriculum facets')
    expected_facets = {
        'circle-circumference-coefficient': 'circle-measurement.exact-circumference',
        'circle-area-coefficient': 'circle-measurement.exact-area',
        'arc-length-coefficient': 'arc-sector-measure.degree-arc-length',
        'sector-area-coefficient': 'arc-sector-measure.degree-sector-area',
    }
    # Each template keeps its narrow facet; extra mappings may only name facets of the same skill.
    allowed = lambda t, f: f.split('.')[0] == expected_facets[t].split('.')[0]
    require(all((t, f) in {(m['templateId'], m['facetId']) for m in record['mappings']} for t, f in expected_facets.items()) and
            all(allowed(m['templateId'], m['facetId']) for m in record['mappings']) and
            all(allowed(b['templateId'], b['facetId']) and
                b['skillId'] == b['facetId'].split('.')[0] and b['independentlyReviewed'] is False
                for b in record['bindings']), 'Incorrect circle facet binding or verification claim')
    expected_inputs = [('0.125', '1/8'), ('1/8', '1/8'), ('2/16', '1/8'),
                       ('12.25', '49/4'), ('49/4', '49/4'), ('98/8', '49/4'),
                       ('−3', '-3'), ('-3', '-3')]
    require(record['equivalentInputs'] == [{'input': value, 'normalized': normalized}
                                           for value, normalized in expected_inputs],
            'Equivalent exact circle answer input regression')
    skills = {s['id']: s for s in record['skills']}
    require(set(skills) == {'circle-measurement', 'arc-sector-measure'}, 'Missing circle skills')
    require(skills['circle-measurement']['gradeBand'] == '7' and
            {'decimal-arithmetic', 'integer-powers', 'fraction-multiplication'} <= set(skills['circle-measurement']['prerequisites']),
            'Missing foundational circle prerequisites')
    require({'circle-measurement', 'percentages', 'angle-measure', 'fraction-multiplication'} <= set(skills['arc-sector-measure']['prerequisites']),
            'Missing arc/sector prerequisites')
    check_figures(record['illustrations'])


def check_figures(figures):
    expected = {'circle-circumference': (5, None), 'circle-area': (3, None),
                'circle-arc': (6, 150), 'circle-sector': (4, 270)}
    require(len(figures) == 4 and {f['kind'] for f in figures} == set(expected), 'Missing circle teaching figure')
    for figure in figures:
        radius, angle = expected[figure['kind']]
        parser = PublicationParser(); parser.feed(figure['html']); parser.close()
        nodes = list(parser.root.descendants())
        def one(attribute, value):
            matches = [n for n in nodes if n.attributes.get(attribute) == value]
            require(len(matches) == 1, 'Missing or duplicate circle geometry element')
            return matches[0]
        svg = one('data-lesson-illustration', figure['kind'])
        a = svg.attributes
        require(float(a['data-radius']) == radius and a['data-angle'] == (str(angle) if angle else 'full'), 'Wrong teaching figure givens')
        cx, cy, scale = (float(a[k]) for k in ['data-center-x', 'data-center-y', 'data-pixels-per-unit'])
        circle = one('data-circle', 'boundary').attributes
        pixels = float(circle['r'])
        require(scale > 0 and math.isclose(pixels, radius*scale) and float(circle['cx']) == cx and float(circle['cy']) == cy,
                'Circle boundary contradicts its scale or center')
        labels = [n.text() for n in nodes if n.tag == 'text']
        require(f'r = {radius} cm' in labels, 'Wrong circle radius label')
        centers = [n for n in nodes if n.tag == 'circle' and n.attributes.get('r') == '3']
        require(len(centers) == 1 and float(centers[0].attributes['cx']) == cx and
                float(centers[0].attributes['cy']) == cy, 'Missing or misplaced circle center dot')
        def segment(name, start, end):
            line = one('data-segment', name).attributes
            require(all(math.isclose(float(line[k]), v, abs_tol=1e-8) for k,v in zip(['x1','y1','x2','y2'], [*start,*end])), 'Wrong radius/diameter endpoints')
        if angle is None:
            segment('radius', (cx,cy), (cx,cy-pixels))
            segment('diameter', (cx-pixels,cy), (cx+pixels,cy))
            require(f'd = {2*radius} cm' in labels, 'Wrong diameter label')
        else:
            theta = math.radians(angle)
            endpoint = (cx+pixels*math.cos(theta), cy-pixels*math.sin(theta))
            segment('radius-start', (cx,cy), (cx+pixels,cy))
            segment('radius-end', (cx,cy), endpoint)
            require(f'{angle}°' in labels, 'Wrong central-angle label')
            for name, distance in [('selected', pixels), ('angle-marker', 32)]:
                path = one('data-arc', name).attributes['d']
                tokens = path.split()
                require(len(tokens) == 11 and tokens[0] == 'M' and tokens[3] == 'A', 'Unsupported circle arc path')
                actual = [float(v) for v in tokens[1:3]+tokens[4:]]
                wanted = [cx+distance,cy,distance,distance,0,int(angle>180),0,cx+distance*math.cos(theta),cy-distance*math.sin(theta)]
                require(all(math.isclose(v,w,abs_tol=1e-8) for v,w in zip(actual,wanted)), 'Arc geometry contradicts the stated turn')
            if figure['kind'] == 'circle-sector':
                selected = one('data-arc', 'selected').attributes['d']
                region = one('data-region', 'sector').attributes['d']
                require(region == f'M {cx:g} {cy:g} L ' + selected.removeprefix('M ') + ' Z', 'Shaded sector does not match selected arc')
        if figure['kind'] == 'circle-area':
            square = one('data-unit-square', '1').attributes
            require(math.isclose(float(square['width']), scale) and math.isclose(float(square['height']), scale), 'Unit square has wrong area scale')


def check_lesson(record):
    lesson, template = record['lesson'], record['templateId']
    require(lesson['id'] == template and lesson['templateIds'] == [template], 'Missing standalone circle lesson')
    worked = lesson['workedExample']
    public = {'templateId': template, 'prompt': worked['prompt'],
              'response': {'kind': 'fraction', 'label': 'Exact coefficient $a$'}}
    require(Fraction(worked['answer']) == solve_circle(public), 'Mismatch in circle lesson example')
    require(len(worked['steps']) >= 3, 'Incomplete circle lesson worked solution')
    check_steps(public, worked['steps'])


def review_circle_content():
    root = Path(__file__).resolve().parents[1]
    result = subprocess.run(['node', '--import', 'tsx', 'scripts/circle-measurement-content-oracle.ts'],
                            cwd=root, text=True, capture_output=True, timeout=120)
    require(result.returncode == 0, 'Circle content exporter failed: ' + result.stderr)
    records = [json.loads(line) for line in result.stdout.splitlines()]
    require(records, 'Missing circle review export')
    check_manifest(records[0])
    seen, sheets, lessons = set(), set(), set()
    approximate = 0
    values = {template: [] for template in CIRCLE}
    for record in records[1:]:
        template = record['templateId']; require(template in CIRCLE, 'Unknown circle export family')
        if record['kind'] == 'circle-measurement-runtime':
            key = (template, record['index'])
            require(key not in seen and 0 <= record['index'] < 1024, 'Duplicate or invalid circle seed')
            seen.add(key)
            problem = record['problem']
            require(problem == record['replayed'] and problem['public']['seed'] == f'circle-measurement-review-{record["index"]}' and problem['public']['templateId'] == template,
                    'Circle runtime determinism or identity mismatch')
            if 'Use 3.14' in problem['public']['prompt']:
                # The pi-3-14 surface of the area family: numeric, decimal, not a coefficient.
                require(template == 'circle-area-coefficient', 'Only the area family uses 3.14')
                check_approximate_problem(problem); approximate += 1
                continue
            parsed, answer = check_problem(problem); values[template].append((*parsed[1:], answer))
        elif record['kind'] == 'circle-measurement-worksheet':
            key = (template, record['edition'])
            require(key not in sheets and record['edition'] in {str(i) for i in range(1, 17)}, 'Duplicate or invalid circle edition')
            sheets.add(key); check_worksheet(record)
        elif record['kind'] == 'circle-measurement-lesson':
            require(template not in lessons, 'Duplicate circle lesson')
            lessons.add(template); check_lesson(record)
        else:
            raise ValueError('Unknown circle review record')
    require(len(seen) == 4096 and len(sheets) == 64 and lessons == CIRCLE, 'Incomplete circle review inventory')
    require(approximate >= 100, 'The 3.14 area surface is not reached')
    for template, rows in values.items():
        require({row[0] for row in rows} == {'radius', 'diameter'} and
                any(row[1].denominator > 1 for row in rows) and len(set(rows)) >= 30,
                'Missing circle runtime variety')
        if not template.startswith('circle-'):
            require({row[2] for row in rows} == ANGLES, 'Circle runtime misses a central angle')
    return {'runtimeCases': len(seen), 'approximateAreas': approximate, 'worksheetEditions': len(sheets), 'lessons': len(lessons),
            'exactFigures': 4, 'rejectedContentMutations': review_content_mutations(records)}


def review_content_mutations(records):
    problem = next(r['problem'] for r in records if r['kind'] == 'circle-measurement-runtime')
    worksheet = next(r for r in records if r['kind'] == 'circle-measurement-worksheet')
    lesson = next(r for r in records if r['kind'] == 'circle-measurement-lesson')
    probes = []
    def probe(source, checker, change):
        value = copy.deepcopy(source); change(value); probes.append((checker, value))
    probe(problem, check_problem, lambda p:p.__setitem__('answer', '999'))
    probe(problem, check_problem, lambda p:p['explanation'].__setitem__(2, 'Therefore $a = 999$.'))
    probe(problem, check_problem, lambda p:p['public'].__setitem__('answer', p['answer']))
    probe(worksheet, check_worksheet, lambda r:r['problems'].__setitem__(1, r['problems'][0]))
    probe(worksheet, check_worksheet, lambda r:r.__setitem__('solutionsHtml', r['solutionsHtml'].replace('Answer: ', 'Answer: 999 ', 1)))
    probe(worksheet, check_worksheet, lambda r:r.__setitem__('workbookHtml', r['solutionsHtml']))
    probe(lesson, check_lesson, lambda r:r['lesson']['workedExample'].__setitem__('answer', '999'))
    probe(records[0], check_manifest, lambda r:r['mappings'][0].__setitem__('extent', 'complete'))
    probe(records[0], check_manifest, lambda r:r['bindings'][0].__setitem__('independentlyReviewed', True))
    probe(records[0], check_manifest, lambda r:r['equivalentInputs'][0].__setitem__('normalized', '999'))
    probe(records[0]['illustrations'], check_figures, lambda f:f[0].__setitem__('html', f[0]['html'].replace('r="110"', 'r="111"')))
    probe(records[0]['illustrations'], check_figures, lambda f:f[2].__setitem__('html', f[2]['html'].replace('150°', '160°')))
    probe(records[0]['illustrations'], check_figures, lambda f:f[3].__setitem__('html', f[3]['html'].replace('0 1 0', '0 0 0')))
    for checker, value in probes:
        try: checker(value)
        except (ValueError, KeyError, ZeroDivisionError): continue
        raise ValueError('Circle review accepted a deliberately incorrect mutation')
    return len(probes)

