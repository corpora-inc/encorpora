"""Independent exact choice oracle: public wording, diagram and option values only."""
import re
from fractions import Fraction

CHOICE = frozenset({
    'fraction-equivalence-choice', 'equation-solution-count', 'graph-equation-choice',
})


def require(condition, message):
    if not condition:
        raise ValueError(message)


def integer(value):
    return type(value) is int


def solve_choice(public):
    """Return the sole mathematically valid option ID; never read the answer key."""
    template = public['templateId']
    require(template in CHOICE, 'Unknown choice family')
    response = public['response']
    require(response['kind'] == 'choice', 'Choice response kind required')
    options = response['options']
    require(isinstance(options, list) and len(options) == (3 if template == 'equation-solution-count' else 4),
            'Unexpected option count')
    require(all(set(option) == {'id', 'label'} and isinstance(option['id'], str) and
                0 < len(option['id']) <= 64 and isinstance(option['label'], str) for option in options),
            'Options must contain only public ID and label')
    require(len({option['id'] for option in options}) == len(options), 'Duplicate option IDs')
    prompt = public['prompt']
    valid = []
    values = []
    if template == 'fraction-equivalence-choice':
        given = re.fullmatch(r'Which fraction names the same amount as ([0-9]+)/([0-9]+)\?', prompt)
        require(given is not None, 'Ambiguous fraction question')
        numerator, denominator = map(int, given.groups())
        require(0 < numerator < denominator <= 12, 'A visible proper fraction is required')
        target = Fraction(numerator, denominator)
        figure = public['figure']
        require(figure['kind'] == 'fraction-strips' and figure['parts'] == denominator and
                figure['wholes'] == 1 and len(figure['rows']) == 1 and
                figure['rows'][0]['selected'] == numerator and
                figure['rows'][0]['label'] == f'{numerator}/{denominator}' and
                figure['unit'] == 'one whole', 'Fraction strip contradicts the stated amount or whole')
        for option in options:
            match = re.fullmatch(r'([0-9]+)/([0-9]+)', option['label'])
            require(match is not None, 'Fraction choice must state two integer counts')
            n, d = map(int, match.groups())
            require(0 < n and 0 < d <= 36, 'Invalid or implausible fraction counts')
            value = Fraction(n, d)
            require(value <= 3, 'Distractor outside supported fraction magnitude')
            values.append(value)
            if value == target:
                valid.append(option['id'])
    elif template == 'equation-solution-count':
        given = re.fullmatch(r'How many real-number solutions does ([0-9]+)x \+ ([0-9]+) = ([0-9]+)x \+ ([0-9]+) have\?', prompt)
        require(given is not None, 'Equation must explicitly state real-number domain')
        a, b, c, d = map(int, given.groups())
        require(a > 0 and c > 0 and b >= 0 and d >= 0, 'Unsupported coefficient domain')
        require(public.get('figure') is None, 'Unexpected equation diagram')
        # Independently examine the difference of the two linear functions.
        coefficient, constant = a - c, b - d
        correct = 'Exactly one solution' if coefficient else 'No solution' if constant else 'Infinitely many solutions'
        categories = {'Exactly one solution', 'No solution', 'Infinitely many solutions'}
        require({option['label'] for option in options} == categories, 'Missing or duplicated solution-set category')
        for option in options:
            values.append(option['label'])
            if option['label'] == correct:
                valid.append(option['id'])
    else:
        require(prompt == 'Which equation matches the line through A and B?', 'Ambiguous graph question')
        figure = public['figure']
        require(figure['kind'] == 'coordinate-plane', 'Coordinate plane required')
        bounds = [figure[key] for key in ('xMin', 'xMax', 'yMin', 'yMax')]
        require(all(integer(value) for value in bounds) and bounds[0] < bounds[1] and bounds[2] < bounds[3], 'Invalid integer grid bounds')
        points = figure['points']
        require(len(points) == 2 and {point['label'] for point in points} == {'A', 'B'}, 'Two distinct named points required')
        require(all(integer(point['x']) and integer(point['y']) and
                    bounds[0] <= point['x'] <= bounds[1] and bounds[2] <= point['y'] <= bounds[3] for point in points),
                'Points must be visible integer grid intersections')
        first, second = points
        require(first['x'] != second['x'], 'This response vocabulary cannot describe a vertical line')
        slope = Fraction(second['y'] - first['y'], second['x'] - first['x'])
        intercept = first['y'] - slope * first['x']
        require(0 < slope <= 6 and 0 < intercept <= 10, 'Graph outside increasing positive-intercept scope')
        lines = figure['lines']
        require(len(lines) == 1 and Fraction(str(lines[0]['m'])) == slope and
                Fraction(str(lines[0]['b'])) == intercept, 'Rendered line contradicts public points')
        for option in options:
            match = re.fullmatch(r'y = (-?[0-9]+)x(?: \+ ([0-9]+))?', option['label'].replace('−', '-'))
            require(match is not None, 'Option is not a supported linear equation')
            m, b = int(match[1]), int(match[2] or 0)
            require(0 < abs(m) <= 10 and 0 <= b <= 10, 'Implausible graph option scale')
            values.append((m, b))
            if all(Fraction(m) * point['x'] + b == point['y'] for point in points):
                valid.append(option['id'])
    require(len(values) == len(set(values)), 'Semantically duplicate choice options')
    require(len(valid) == 1, 'A choice problem must have exactly one mathematically valid option')
    return valid[0]
