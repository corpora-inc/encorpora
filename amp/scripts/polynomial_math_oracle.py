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


def known_choice_shortcut(values):
    """Reproduce the reviewed option-only attack, including its last-match ordering."""
    def near(i, j):
        changed = [k for k in range(4) if values[i][k] != values[j][k]]
        return changed[0] if len(changed) == 1 else None

    guess = None
    for i in range(len(values)):
        for k in range(4):
            differences = {values[j][k]-values[i][k] for j in range(len(values))
                           if i != j and near(i, j) == k}
            if {-1, 1} <= differences:
                guess = i
    if guess is None:
        for i in range(len(values)):
            for j in range(len(values)):
                k = near(i, j) if i != j else None
                if k is not None and values[j][k]-values[i][k] == 1:
                    guess = i
    return guess


def unique_extreme(scores, extreme):
    target = extreme(scores)
    winners = [i for i, score in enumerate(scores) if score == target]
    return winners[0] if len(winners) == 1 else None


def coefficient_agreement_shortcut(values):
    scores = [sum(a == b for j, other in enumerate(values) if i != j
                  for a, b in zip(value, other)) for i, value in enumerate(values)]
    return unique_extreme(scores, max)


CHOICE_SHORTCUTS = {'unit-coefficient-neighbors': known_choice_shortcut,
                   'coefficient-agreement': coefficient_agreement_shortcut}
for metric_name, metric in {
    'signed-sum': sum,
    'l1': lambda value: sum(abs(a) for a in value),
    'linf': lambda value: max(abs(a) for a in value),
    'term-count': lambda value: sum(a != 0 for a in value),
}.items():
    for direction, extreme in [('min', min), ('max', max)]:
        CHOICE_SHORTCUTS[f'{metric_name}-{direction}'] = (
            lambda values, metric=metric, extreme=extreme:
                unique_extreme([metric(value) for value in values], extreme))


def shortcut_evidence(counts, label):
    """Compare this rule's predictions with their individual uniform-choice baselines.

    The one-sided Hoeffding bound assumes independent uniform keys conditional on
    public options. It detects these named rules, not every possible shortcut.
    """
    import math
    n, correct, chance = counts['applications'], counts['correct'], counts['chanceTwelfths']
    accuracy = correct/n if n else None
    mean_chance = chance/(12*n) if n else None
    excess = (12*correct-chance)/(12*n) if n else 0
    bound = math.exp(-2*n*max(0, excess)**2) if n else None
    # Compare excess > 3/20 exactly; avoid floating error at the 0.15 boundary.
    material_excess = 60*correct > 5*chance + 9*n
    require(not (n >= 32 and material_excess and bound < 0.001),
            f'Known choice-only shortcut regression: {label}, {correct}/{n} correct; '
            f'chance={mean_chance}, Hoeffding upper bound={bound}')
    status = ('no-applications' if not n else 'insufficient-evidence'
              if n < 32 or (material_excess and bound >= 0.001) else 'threshold-not-exceeded')
    return {key: value for key, value in counts.items() if key != 'chanceTwelfths'} | {
        'meanChance': mean_chance, 'accuracy': accuracy, 'hoeffdingUpperBound': bound, 'status': status,
    }


class PolynomialShortcutReview:
    """Regression checks for named shortcuts, not general leakage certification."""
    def __init__(self):
        self.counts = {name: {template: {'cases': 0, 'applications': 0, 'correct': 0, 'chanceTwelfths': 0}
                             for template in sorted(POLYNOMIAL)} for name in CHOICE_SHORTCUTS}

    def record(self, public, independent_answer):
        options = public['response']['options']
        values = choice_coefficients(options)
        for name, predict in CHOICE_SHORTCUTS.items():
            counts = self.counts[name][public['templateId']]
            guess = predict(values)
            counts['cases'] += 1
            if guess is not None:
                counts['applications'] += 1
                counts['correct'] += options[guess]['id'] == independent_answer
                # Two, three, and four choices have exact baselines in twelfths.
                counts['chanceTwelfths'] += 12//len(options)

    def finish(self, expected_per_family):
        require(type(expected_per_family) is int and expected_per_family >= 256,
                'Shortcut review requires a manifest with at least 256 cases per family')
        report = {}
        for name, families in self.counts.items():
            report[name] = {}
            for template, counts in families.items():
                require(counts['cases'] == expected_per_family,
                        f'Incomplete shortcut review coverage for {template}')
                report[name][template] = shortcut_evidence(counts, f'{name}/{template}')
        return report


def review_shortcut_fixtures():
    """Handwritten attack predictions, calibrated null corpora, and evidence limits."""
    import random

    def values(labels):
        return choice_coefficients([{'label': label} for label in labels])

    triples = ['x² + x − 1', 'x² + x', 'x² + x + 1', '2x² + 8x + 7']
    pairs = ['x² + x', 'x² + x + 1', '5x² + 9x + 12', '2x² + 8x + 7']
    similarity = ['x² + x', 'x² + x + 2', 'x² + 3x', '3x² + x']
    require(known_choice_shortcut(values(triples)) == 1, 'Missed middle-of-triple attack')
    require(known_choice_shortcut(values(pairs)) == 0, 'Missed lower-neighbor attack')
    require(coefficient_agreement_shortcut(values(similarity)) == 0, 'Missed agreement attack')
    measured = values(['x³ − 2x² + 3x − 5', 'x²', '2x + 1'])
    expected = {'signed-sum-min': 0, 'signed-sum-max': 2, 'l1-min': 1, 'l1-max': 0,
                'linf-min': 1, 'linf-max': 0, 'term-count-min': 1, 'term-count-max': 0}
    for name, index in expected.items():
        require(CHOICE_SHORTCUTS[name](measured) == index, f'Wrong extremum prediction: {name}')
    tied = values(['x', '−x'])
    require(all(CHOICE_SHORTCUTS[name](tied) is None for name in expected if not name.startswith('signed')),
            'Tied extrema must abstain')

    def counts(n, correct, choices=4):
        return {'cases': max(256, n), 'applications': n, 'correct': correct,
                'chanceTwelfths': n*(12//choices)}

    rejected = 0
    for n, correct, choices in [(32, 32, 4), (32, 32, 3), (32, 32, 2),
                                (10000, 4500, 4), (10000, 4700, 4), (1000, 401, 4)]:
        try:
            shortcut_evidence(counts(n, correct, choices), 'handwritten-leak')
        except ValueError:
            rejected += 1
        else:
            raise ValueError('Known excess-over-chance leak was accepted')
    for choices in (2, 3, 4):
        evidence = shortcut_evidence(counts(1200, 1200//choices, choices), 'uniform-key')
        require(evidence['accuracy'] == evidence['meanChance'] and evidence['hoeffdingUpperBound'] == 1,
                'Chance baseline must depend on option count')
    require(shortcut_evidence(counts(1000, 400), 'exact-margin')['status'] == 'threshold-not-exceeded',
            'Exact 0.15 excess must not exceed the threshold')
    require(shortcut_evidence(counts(32, 17), 'weak-bound')['status'] == 'insufficient-evidence',
            'Applications alone do not establish the requested Hoeffding bound')
    require(shortcut_evidence(counts(31, 31), 'few-predictions')['status'] == 'insufficient-evidence',
            'Fewer than 32 predictions cannot establish the gate threshold')
    require(shortcut_evidence(counts(0, 0), 'abstention')['status'] == 'no-applications',
            'No predictions must be reported honestly')

    def public(template, labels, k=1):
        prompts = {'polynomial-addition': f'Simplify (x²) + ({k}x).',
                   'polynomial-subtraction': f'Simplify (x²) − (−{k}x).',
                   'polynomial-multiplication': f'Expand and simplify (x)(x + {k}).'}
        return {'templateId': template, 'prompt': prompts[template], 'response': {'kind': 'choice',
                'options': [{'id': str(i), 'label': label} for i, label in enumerate(labels)]}}

    # Reproduce each old attack in a complete public-prompt corpus.
    for labels, algorithm in [(triples, 'unit-coefficient-neighbors'),
                              (pairs, 'unit-coefficient-neighbors'), (similarity, 'coefficient-agreement')]:
        review = PolynomialShortcutReview()
        for template in sorted(POLYNOMIAL):
            given = public(template, labels)
            for _ in range(256):
                review.record(given, solve_polynomial(given))
        try:
            review.finish(256)
        except ValueError as error:
            require(algorithm in str(error), 'Wrong rule rejected the attack corpus')
            rejected += 1
        else:
            raise ValueError('Old option-only attack corpus was accepted')

    # For every option set, ask each valid associated problem equally often.
    # Shuffle order independently; exercise each fixed option count and mixed counts.
    for sizes in [(2,), (3,), (4,), (2, 3, 4)]:
        schedule = [(size, k) for size in sizes for k in range(1, size+1)]*144
        random.Random(817).shuffle(schedule)
        review = PolynomialShortcutReview()
        for template in sorted(POLYNOMIAL):
            for size, k in schedule:
                given = public(template, [f'x² + {i}x' for i in range(1, size+1)], k)
                review.record(given, solve_polynomial(given))
        report = review.finish(len(schedule))
        for families in report.values():
            for evidence in families.values():
                if evidence['applications']:
                    require(abs(evidence['accuracy']-evidence['meanChance']) < 1e-12,
                            'Uniform keys must calibrate each applying rule to chance')
                else:
                    require(evidence['status'] == 'no-applications', 'Missing abstention report')
    for declared in (31, 256):
        try:
            PolynomialShortcutReview().finish(declared)
        except ValueError:
            rejected += 1
        else:
            raise ValueError('Small or incomplete corpus was accepted')
    return {'rejectedShortcutFixtures': rejected, 'calibratedShortcutCorpora': 4}


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
