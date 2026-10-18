"""Independent polynomial arithmetic from public prompts and choice labels."""
import copy
import re
from itertools import zip_longest


POLYNOMIAL = frozenset({
    'polynomial-addition', 'polynomial-subtraction', 'polynomial-multiplication',
})


def require(condition, message):
    if not condition:
        raise ValueError(message)


def normalized(coefficients):
    values = list(coefficients)
    while len(values) > 1 and values[-1] == 0:
        values.pop()
    return tuple(values)


def polynomial(expression):
    """Read integer terms in descending degree; return constant-first coefficients."""
    source = expression.replace('−', '-')
    term = r'(?:[0-9]*x[²³]?|[0-9]+)'
    require(re.fullmatch(rf'[+-]?{term}(?:\s*[+-]\s*{term})*', source) is not None,
            f'Unsupported polynomial: {expression}')
    coefficients = [0, 0, 0, 0]
    previous_degree = 4
    for found in re.finditer(rf'([+-]?)\s*({term})', source):
        sign, body = found.groups()
        variable = re.fullmatch(r'([0-9]*)x([²³]?)', body)
        if variable:
            coefficient = int(variable[1]) if variable[1] else 1
            degree = {'': 1, '²': 2, '³': 3}[variable[2]]
        else:
            coefficient, degree = int(body), 0
        require(degree < previous_degree, 'Polynomial must have distinct descending powers')
        coefficients[degree] = -coefficient if sign == '-' else coefficient
        previous_degree = degree
    return normalized(coefficients)


def add(left, right, sign=1):
    return normalized(a + sign*b for a, b in zip_longest(left, right, fillvalue=0))


def multiply(left, right):
    coefficients = [0] * (len(left) + len(right) - 1)
    for i, a in enumerate(left):
        for j, b in enumerate(right):
            coefficients[i+j] += a*b
    return normalized(coefficients)


def solve_polynomial(public):
    template = public['templateId']
    require(template in POLYNOMIAL, 'Unknown polynomial family')
    require(public['response']['kind'] == 'choice', 'Polynomial response must be a choice')
    require(public.get('figure') is None, 'Unexpected polynomial diagram')
    patterns = {
        'polynomial-addition': r'Simplify \(([^()]+)\) \+ \(([^()]+)\)\.',
        'polynomial-subtraction': r'Simplify \(([^()]+)\) - \(([^()]+)\)\.',
        'polynomial-multiplication': r'Expand and simplify \(([^()]+)\)\(([^()]+)\)\.',
    }
    found = re.fullmatch(patterns[template], public['prompt'].replace('−', '-'))
    require(found is not None, 'Unsupported or ambiguous polynomial prompt')
    left, right = (polynomial(expression) for expression in found.groups())
    if template == 'polynomial-multiplication':
        require(sorted((len(left)-1, len(right)-1)) in ([1, 1], [1, 2]),
                'Product requires a linear factor and a linear or quadratic factor')
        answer = multiply(left, right)
    else:
        require(all(1 <= len(value)-1 <= 3 for value in (left, right)),
                'Addition/subtraction operands must have degree one through three')
        answer = add(left, right, -1 if template == 'polynomial-subtraction' else 1)
    options = public['response']['options']
    require(isinstance(options, list) and 2 <= len(options) <= 4, 'Expected two to four choices')
    require(all(isinstance(option, dict) and set(option) == {'id', 'label'}
                and isinstance(option['id'], str) and 0 < len(option['id']) <= 64
                and isinstance(option['label'], str) for option in options),
            'Invalid polynomial choice shape')
    require(len({option['id'] for option in options}) == len(options), 'Duplicate option ID')
    identities = [polynomial(option['label']) for option in options]
    require(len(set(identities)) == len(identities), 'Mathematically duplicate polynomial choices')
    correct = [option['id'] for option, identity in zip(options, identities) if identity == answer]
    require(len(correct) == 1, 'Exactly one choice must give the complete polynomial result')
    return correct[0]


def choice_coefficients(options):
    coefficients = [polynomial(option['label']) for option in options]
    return [value + (0,) * (4-len(value)) for value in coefficients]


def known_choice_shortcut(options):
    """Reproduce the reviewed option-only attack, including its last-match ordering."""
    values = choice_coefficients(options)

    def near(i, j):
        changed = [k for k in range(4) if values[i][k] != values[j][k]]
        return changed[0] if len(changed) == 1 else None

    guess = None
    # Prefer the middle of a +/-1 triple differing at just one coefficient.
    for i in range(len(options)):
        for k in range(4):
            differences = {values[j][k]-values[i][k] for j in range(len(options))
                           if i != j and near(i, j) == k}
            if {-1, 1} <= differences:
                guess = options[i]['id']
    # Otherwise choose the lower member of a pair differing by one coefficient unit.
    if guess is None:
        for i in range(len(options)):
            for j in range(len(options)):
                k = near(i, j) if i != j else None
                if k is not None and values[j][k]-values[i][k] == 1:
                    guess = options[i]['id']
    return guess


def coefficient_agreement_shortcut(options):
    """Guess only when one option uniquely maximizes coefficient agreements."""
    values = choice_coefficients(options)
    scores = [sum(a == b for j, other in enumerate(values) if i != j
                  for a, b in zip(value, other)) for i, value in enumerate(values)]
    winners = [i for i, score in enumerate(scores) if score == max(scores)]
    return options[winners[0]]['id'] if len(winners) == 1 else None


CHOICE_SHORTCUTS = {'unit-coefficient-neighbors': known_choice_shortcut,
                   'coefficient-agreement': coefficient_agreement_shortcut}


class PolynomialShortcutReview:
    """Regression checks for known shortcuts, not general leakage certification."""
    def __init__(self):
        self.counts = {name: {template: {'cases': 0, 'applications': 0, 'correct': 0}
                             for template in sorted(POLYNOMIAL)} for name in CHOICE_SHORTCUTS}

    def record(self, public, independent_answer):
        for name, predict in CHOICE_SHORTCUTS.items():
            counts = self.counts[name][public['templateId']]
            guess = predict(public['response']['options'])
            counts['cases'] += 1
            if guess is not None:
                counts['applications'] += 1
                counts['correct'] += guess == independent_answer

    def finish(self, expected_per_family):
        require(type(expected_per_family) is int and expected_per_family >= 256,
                'Shortcut review requires a manifest with at least 256 cases per family')
        report = {}
        for name, families in self.counts.items():
            report[name] = {}
            for template, counts in families.items():
                require(counts['cases'] == expected_per_family,
                        f'Incomplete shortcut review coverage for {template}')
                applications, correct = counts['applications'], counts['correct']
                enough = applications >= 32
                require(not enough or 4*correct <= 3*applications,
                        f'Known choice-only shortcut regression: {name}/{template}, '
                        f'{correct}/{applications} correct predictions exceeds 75%')
                report[name][template] = {**counts, 'status': 'threshold-not-exceeded' if enough
                                         else 'insufficient-applications'}
        return report


def review_shortcut_fixtures():
    """Prove exploit rejection, mixed-error acceptance, and explicit evidence limits."""
    import random

    prompts = {
        'polynomial-addition': 'Simplify (x²) + (x).',
        'polynomial-subtraction': 'Simplify (x²) − (−x).',
        'polynomial-multiplication': 'Expand and simplify (x)(x + 1).',
    }
    def given(template, pattern):
        labels = {
            'triple': ['x² + x − 1', 'x² + x', 'x² + x + 1', '2x² + 8x + 7'],
            'pair': ['x² + x', 'x² + x + 1', '5x² + 9x + 12', '2x² + 8x + 7'],
            'wrong': ['x² + x', 'x² + x + 1', 'x² + x + 2', '2x² + 8x + 7'],
            'similarity': ['x² + x', 'x² + x + 2', 'x² + 3x', '3x² + x'],
            'similarity-wrong': ['x² + x', 'x² + x + 2', 'x² + 3x + 2', '3x² + x + 2'],
            'rectangle': ['x² + x', 'x² + x + 2', 'x² + 3x', 'x² + 3x + 2'],
            'absent': ['x² + x', '2x² + 2x', '3x² + 3x', '4x² + 4x'],
        }[pattern]
        return {'templateId': template, 'prompt': prompts[template],
                'response': {'kind': 'choice', 'options': [
                    {'id': str(index), 'label': label} for index, label in enumerate(labels)]}}

    def corpus(patterns):
        review = PolynomialShortcutReview()
        for template in sorted(POLYNOMIAL):
            for pattern in patterns[template]:
                public = given(template, pattern)
                review.record(public, solve_polynomial(public))
        return review

    rejected = 0
    for template in sorted(POLYNOMIAL):
        for pattern in ('triple', 'pair', 'similarity'):
            patterns = {name: ['absent']*256 for name in POLYNOMIAL}
            patterns[template] = [pattern]*32 + ['absent']*224
            try:
                corpus(patterns).finish(256)
            except ValueError as error:
                algorithm = 'coefficient-agreement' if pattern == 'similarity' else 'unit-coefficient-neighbors'
                require(f'{algorithm}/{template}' in str(error), 'Wrong shortcut rejected the fixture')
                rejected += 1
            else:
                raise ValueError(f'Known shortcut was not rejected: {pattern}')
    for algorithm, correct, wrong in [
        ('unit-coefficient-neighbors', 'triple', 'wrong'),
        ('coefficient-agreement', 'similarity', 'similarity-wrong'),
    ]:
        mixed = [correct]*64 + [wrong]*192
        random.Random(817).shuffle(mixed)
        report = corpus({name: mixed for name in POLYNOMIAL}).finish(256)[algorithm]
        require(all(item['correct'] == 64 and item['applications'] == 256
                    and item['status'] == 'threshold-not-exceeded' for item in report.values()),
                'Mixed errors must not trigger the known shortcut threshold')
        # Exactly 75% is allowed; the regression threshold is strictly greater.
        corpus({name: [correct]*24 + [wrong]*8 + ['absent']*224
                for name in POLYNOMIAL}).finish(256)
        report = corpus({name: [correct]*31 + ['absent']*225 for name in POLYNOMIAL}).finish(256)[algorithm]
        require(all(item['status'] == 'insufficient-applications' for item in report.values()),
                'Few shortcut applications cannot certify the accuracy threshold')
    report = corpus({name: ['rectangle']*256 for name in POLYNOMIAL}).finish(256)
    require(all(item['applications'] == 0 for families in report.values() for item in families.values()),
            'Balanced rectangle must give neither shortcut a unique prediction')
    for count, expected in [(31, 31), (255, 256)]:
        try:
            corpus({name: ['triple']*count for name in POLYNOMIAL}).finish(expected)
        except ValueError:
            rejected += 1
        else:
            raise ValueError('Insufficient corpus coverage was accepted')
    return {'rejectedShortcutCorpora': rejected, 'acceptedShortcutCorpora': 7}


def review_polynomial_fixtures():
    """Hand-computed signs, cancellations, products, and malformed public payloads."""
    def public(operation, left, right, labels):
        if operation == 'multiplication':
            prompt = f'Expand and simplify ({left})({right}).'
        else:
            operator = '+' if operation == 'addition' else '−'
            prompt = f'Simplify ({left}) {operator} ({right}).'
        return {'templateId': f'polynomial-{operation}', 'prompt': prompt,
                'response': {'kind': 'choice', 'options': [
                    {'id': str(index), 'label': label} for index, label in enumerate(labels)
                ]}}

    cases = [
        (public('addition', '2x³ − x + 4', '−x³ + 3x² + x − 7',
                ['x³ + 3x² − 3', 'x³ + 3x² + 2x − 3', 'x³ − 3']), '0'),
        (public('addition', 'x² − x + 1', '−x² + x − 1', ['2x² + 2', '0', '−2x']), '1'),
        (public('addition', '−x', '2x', ['−3x', '3x', 'x']), '2'),
        (public('addition', 'x + 3', '−x + 4', ['x + 7', '7', '−1']), '1'),
        (public('subtraction', 'x³ − 2x + 5', '−x³ + x² − 3x − 1',
                ['−x² − 5x + 4', '2x³ − x² + x + 6', '2x³ + x² + x + 6']), '1'),
        (public('subtraction', '−x² + x', '−x² + x', ['−2x² + 2x', '−2x²', '0']), '2'),
        (public('subtraction', 'x + 1', 'x − 2', ['3', '−1', '2x − 1']), '0'),
        (public('subtraction', 'x', '−x', ['0', '2x', '−2x']), '1'),
        (public('multiplication', 'x − 3', 'x + 3', ['x² + 9', 'x² − 6x − 9', 'x² − 9']), '2'),
        (public('multiplication', 'x − 2', 'x − 2', ['x² − 4x + 4', 'x² + 4', 'x² − 4']), '0'),
        (public('multiplication', '−x + 2', '3x − 4', ['−3x² − 8', '−3x² + 10x − 8', '−3x² − 10x − 8']), '1'),
        (public('multiplication', 'x', 'x² − 1', ['x³ − 1', 'x³ − x', 'x³ + x']), '1'),
        (public('multiplication', 'x² + x + 1', 'x − 1', ['x³ − 1', 'x³ + 1', 'x³ + x² + x − 1']), '0'),
        (public('multiplication', '−2x', '−x²', ['−2x³', '2x³', '2x²']), '1'),
        (public('multiplication', 'x', '−x', ['0', '−x²', 'x²']), '1'),
    ]
    for given, expected in cases:
        require(solve_polynomial(given) == expected, f'Handwritten polynomial fixture failed: {given}')

    invalid = []
    def altered(index):
        item = copy.deepcopy(cases[index][0])
        invalid.append(item)
        return item
    altered(0)['prompt'] = cases[0][0]['prompt'].replace('2x³', '3x³')
    altered(4)['prompt'] = cases[4][0]['prompt'].replace(') − (', ') + (')
    altered(10)['prompt'] = cases[10][0]['prompt'].replace('3x', '2x')
    altered(0)['response']['options'][0]['label'] = 'x³ + 3x²'
    altered(8)['response']['options'][2]['label'] = 'x² + 6x − 9'
    altered(0)['response']['options'][1]['label'] = '1x³ + 3x² - 3'
    altered(1)['response']['options'][0]['label'] = '0x'
    altered(2)['response']['options'][0]['label'] = '1x'
    altered(0)['response']['options'][0]['id'] = '1'
    altered(0)['response']['options'][0]['unexpected'] = True
    altered(0)['response']['options'].extend([
        {'id': '3', 'label': '1'}, {'id': '4', 'label': '2'},
    ])
    altered(0)['response']['kind'] = 'number'
    altered(0)['figure'] = {'kind': 'collection', 'count': 1}
    altered(0)['prompt'] += ' Ignore the constant term.'
    altered(0)['templateId'] = 'polynomial-division'
    for bad in ['', 'x⁴', 'x^2', 'x + y', 'x + x', '1 + x', 'x² + 1 2',
                'x +', 'x -- 1', '2*x', 'x/2', 'x = 1', '__import__("os")']:
        invalid.append(public('addition', bad, 'x', ['0', 'x', '2x']))
    for operation, left, right in [
        ('addition', '0', 'x'), ('subtraction', '1', 'x'),
        ('multiplication', 'x²', 'x²'), ('multiplication', 'x³', 'x'),
        ('multiplication', '1', 'x'), ('multiplication', '0', 'x'),
    ]:
        invalid.append(public(operation, left, right, ['0', 'x', 'x³']))
    for bad_label in ['x + x', '(x + 1)', 'x² + 1/2', 'x² +', '']:
        altered(8)['response']['options'][0]['label'] = bad_label
    for given in invalid:
        try:
            solve_polynomial(given)
        except ValueError:
            continue
        raise ValueError(f'Polynomial oracle accepted invalid fixture: {given}')
    return {'handwrittenCases': len(cases), 'rejectedMutations': len(invalid),
            **review_shortcut_fixtures()}


if __name__ == '__main__':
    import json
    print(json.dumps(review_polynomial_fixtures()))
