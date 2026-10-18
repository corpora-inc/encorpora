"""Independent exact solution sets from public one-variable inequality prompts.

The parser never evaluates source text or calls an author generator/answer helper.
"""
import copy
import math
import re
from collections import Counter
from fractions import Fraction

INEQUALITY = frozenset({'affine-linear-inequality', 'grouped-linear-inequality',
                        'cancelled-linear-inequality'})
OPS = ('<', '≤', '>', '≥')
REVERSE = {'<': '>', '≤': '≥', '>': '<', '≥': '≤'}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def compare(a, op, b):
    return {'<': a < b, '≤': a <= b, '>': a > b, '≥': a >= b}[op]


def affine(source):
    """Restricted arithmetic grammar, yielding (variable coefficient, constant)."""
    text = source.replace('−', '-')
    require(re.search(r'[0-9]+/[0-9]+\s*x', text) is None,
            'A fractional coefficient must be grouped before multiplying x')
    tokens = re.findall(r'[0-9]+(?:/[0-9]+)?|x|[()+×-]', text)
    require(''.join(tokens) == re.sub(r'\s+', '', text), 'Unsupported affine notation')
    position = 0

    def atom():
        nonlocal position
        require(position < len(tokens), 'Missing expression operand')
        token = tokens[position]
        position += 1
        if token in ('+', '-'):
            a, b = atom()
            return (a, b) if token == '+' else (-a, -b)
        if token == '(':
            value = addition()
            require(position < len(tokens) and tokens[position] == ')', 'Unclosed parentheses')
            position += 1
            return value
        if token == 'x':
            return Fraction(1), Fraction(0)
        require(re.fullmatch(r'[0-9]+(?:/[0-9]+)?', token) is not None,
                'Invalid expression operand')
        value = Fraction(token)
        require(abs(value) <= 100000, 'Number outside reviewed domain')
        return Fraction(0), value

    def product():
        nonlocal position
        value = atom()
        while position < len(tokens) and tokens[position] in ('x', '(', '×'):
            if tokens[position] == '×':
                position += 1
            other = atom()
            require(not (value[0] and other[0]), 'Nonlinear product')
            value = (value[0]*other[1] + value[1]*other[0], value[1]*other[1])
        return value

    def addition():
        nonlocal position
        value = product()
        while position < len(tokens) and tokens[position] in ('+', '-'):
            sign = 1 if tokens[position] == '+' else -1
            position += 1
            other = product()
            value = tuple(a + sign*b for a, b in zip(value, other))
        return value

    require(tokens, 'Empty expression')
    value = addition()
    require(position == len(tokens), 'Trailing or ambiguous expression tokens')
    return value


def solution(label):
    if label in ('All real numbers', 'No real numbers'):
        return ('all' if label == 'All real numbers' else 'none',)
    found = re.fullmatch(r'x ([<≤>≥]) ([-−]?[0-9]+(?:/[0-9]+)?)', label)
    require(found is not None, 'Unsupported solution-set label')
    boundary = Fraction(found[2].replace('−', '-'))
    require(abs(boundary) <= 100000, 'Boundary outside reviewed domain')
    return found[1], boundary


def parsed(public):
    template = public['templateId']
    require(template in INEQUALITY, 'Unknown inequality family')
    require(public.get('figure') is None, 'Unexpected inequality figure')
    require(public['response']['kind'] == 'choice', 'Inequality needs a solution-set choice')
    found = re.fullmatch(r'Solve for real x: (.+) ([<≤>≥]) (.+)\.', public['prompt'])
    require(found is not None, 'Unsupported inequality prompt or missing real domain')
    left_text, op, right_text = found.groups()
    left, right = affine(left_text), affine(right_text)
    if template == 'affine-linear-inequality':
        require(left[0] != 0 and right[0] == 0, 'Expected a nonzero affine left side and constant right side')
        require(abs(left[0].numerator) <= 9 and left[0].denominator <= 6 and
                abs(left[1].numerator) <= 12 and left[1].denominator <= 6,
                'Affine coefficients outside reviewed domain')
    else:
        grouped = re.fullmatch(r'(-?[2-4])\(([^()]+)\)(?: ([+-]) ([0-6]))?', left_text.replace('−', '-'))
        require(grouped is not None, 'Expected a grouped linear left side')
        inner = affine(grouped[2])
        require(inner[0].denominator == inner[1].denominator == 1 and
                1 <= abs(inner[0]) <= 6 and 1 <= abs(inner[1]) <= 6,
                'Grouped coefficients outside reviewed domain')
        require(right[0] != 0, 'Both-sides family needs a variable term on the right')
        if template == 'grouped-linear-inequality':
            require(abs(right[0].numerator) <= 12 and right[0].denominator <= 4,
                    'Right-side coefficient outside reviewed domain')
    a, b = left[0]-right[0], right[1]-left[1]
    cancelled = template == 'cancelled-linear-inequality'
    require((a == 0) == cancelled, 'Template cancellation class contradicts displayed inequality')
    if a == 0:
        expected = ('all' if compare(left[1], op, right[1]) else 'none',)
    else:
        expected = (op if a > 0 else REVERSE[op], b/a)
    return left, op, right, expected


def solve_inequality(public):
    left, op, right, expected = parsed(public)
    options = public['response']['options']
    count = 2 if len(expected) == 1 else 4
    require(isinstance(options, list) and len(options) == count, 'Wrong number of solution-set choices')
    require(all(isinstance(item, dict) and set(item) == {'id', 'label'} and
                isinstance(item['id'], str) and re.fullmatch(r'option-[a-d]', item['id']) and
                isinstance(item['label'], str) for item in options), 'Invalid choice shape')
    require(len({item['id'] for item in options}) == count, 'Duplicate choice identifier')
    identities = [solution(item['label']) for item in options]
    require(len(set(identities)) == count, 'Mathematically duplicate solution sets')
    if len(expected) == 1:
        require(set(identities) == {('all',), ('none',)}, 'Cancellation needs all-real and no-real choices')
    else:
        require(all(len(identity) == 2 for identity in identities), 'Expected four half-lines')
        boundaries = {identity[1] for identity in identities}
        signs = {'<', '>'} if op in ('<', '>') else {'≤', '≥'}
        require(len(boundaries) == 2 and set(identities) == {(sign, boundary) for sign in signs for boundary in boundaries},
                'Choices must be two boundaries crossed with both directions at the stated strictness')
        # The two candidate boundaries have the same reduced denominator, so
        # fraction complexity cannot identify the intended boundary by itself.
        require(len({boundary.denominator for boundary in boundaries}) == 1,
                'Asymmetric boundary denominators')
        for boundary in boundaries:
            require(abs(boundary.numerator) <= 12 and boundary.denominator <= 6,
                    'Candidate boundary outside reviewed domain')
        coefficient = left[0]-right[0]
        require(abs(coefficient.numerator) <= 48, 'Remaining coefficient exceeds arithmetic budget')
        # Check both possible boundaries, not only the true answer: target-dependent
        # rejection would make the arithmetic budget an answer-choice shortcut.
        for boundary in boundaries:
            product = coefficient*boundary
            total = left[1]+product
            require(abs(product.numerator) <= 96 and product.denominator <= 24 and
                    abs(total.numerator) <= 96 and total.denominator <= 24 and
                    math.lcm(total.denominator, left[1].denominator) <= 24,
                    'A candidate boundary exceeds the symmetric arithmetic budget')
        # Check the derived set at its endpoint and on both open sides using
        # direct substitution into the public expressions, independently of labels.
        boundary = expected[1]
        for x in (boundary-1, boundary, boundary+1):
            require(compare(left[0]*x+left[1], op, right[0]*x+right[1]) ==
                    compare(x, expected[0], boundary), 'Solution-set substitution mismatch')
    matches = [item['id'] for item, identity in zip(options, identities) if identity == expected]
    require(len(matches) == 1, 'Exactly one choice must give the complete solution set')
    return matches[0]


class InequalityReview:
    """Public-derived coverage and named option-only regression checks."""
    def __init__(self):
        self.coverage = {template: Counter() for template in INEQUALITY}
        self.attacks = {template: {name: [0, 0] for name in (
            'first-option', 'last-option', 'lower-boundary', 'upper-boundary',
            'smaller-magnitude', 'larger-magnitude', 'less-than-direction', 'zero-boundary')}
            for template in INEQUALITY}

    def record(self, public, answer):
        template = public['templateId']
        left, op, right, expected = parsed(public)
        counts = self.coverage[template]
        counts['cases'] += 1
        counts['operator:' + op] += 1
        identities = [solution(item['label']) for item in public['response']['options']]
        key = next(i for i, item in enumerate(public['response']['options']) if item['id'] == answer)
        counts[f'position:{key}'] += 1
        guesses = {'first-option': {0}, 'last-option': {len(identities)-1}}
        if len(expected) == 1:
            counts['outcome:' + expected[0]] += 1
            relation = 'equal' if left[1] == right[1] else 'less' if left[1] < right[1] else 'greater'
            counts['constant:' + relation] += 1
            counts[f'constant:{relation}/operator:{op}'] += 1
        else:
            counts['coefficient:' + ('positive' if left[0] > right[0] else 'negative')] += 1
            counts['coefficient-form:' + ('integer' if left[0].denominator == 1 else 'fraction')] += 1
            counts['right-coefficient-form:' + ('integer' if right[0].denominator == 1 else 'fraction')] += 1
            counts['boundary:' + ('integer' if expected[1].denominator == 1 else 'fraction')] += 1
            counts['boundary-sign:' + ('zero' if expected[1] == 0 else 'positive' if expected[1] > 0 else 'negative')] += 1
            counts['direction:' + expected[0]] += 1
            for name, metric, extreme in (
                ('lower-boundary', lambda v: v, min), ('upper-boundary', lambda v: v, max),
                ('smaller-magnitude', abs, min), ('larger-magnitude', abs, max)):
                values = [metric(identity[1]) for identity in identities]
                target = extreme(values)
                selected = {i for i, value in enumerate(values) if value == target}
                if len(selected) == 2:
                    guesses[name] = selected
            zeros = {i for i, value in enumerate(identities) if value[1] == 0}
            if zeros:
                guesses['zero-boundary'] = zeros
            guesses['less-than-direction'] = {i for i, value in enumerate(identities) if value[0] in ('<', '≤')}
        for name, selected in guesses.items():
            tally = self.attacks[template][name]
            # All listed guesses select half the choices except fixed positions
            # in the four-option family. Store exact chance in quarter units.
            if len(tally) == 2:
                tally.append(0)
            tally[0] += 1
            tally[1] += key in selected
            tally[2] += 4*len(selected)//len(identities)

    def finish(self, expected_per_family):
        require(type(expected_per_family) is int and expected_per_family >= 256,
                'Inequality review requires at least 256 cases per family')
        report = {}
        for template, counts in self.coverage.items():
            require(counts['cases'] == expected_per_family, f'Incomplete inequality coverage: {template}')
            required = [f'operator:{op}' for op in OPS]
            required += [f'position:{i}' for i in range(2 if template == 'cancelled-linear-inequality' else 4)]
            if template == 'cancelled-linear-inequality':
                required += ['outcome:all', 'outcome:none']
                required += [f'constant:{relation}/operator:{op}' for relation in ('equal', 'less', 'greater') for op in OPS]
            else:
                required += ['coefficient:positive', 'coefficient:negative', 'boundary:integer', 'boundary:fraction',
                             'boundary-sign:negative', 'boundary-sign:positive', 'boundary-sign:zero']
                required += [f'direction:{op}' for op in OPS]
            require(all(counts[key] > 0 for key in required),
                    f'Missing inequality coverage classes in {template}: {[key for key in required if not counts[key]]}')
            attacks = {}
            for name, tally in self.attacks[template].items():
                n, hits = tally[:2]
                chance = tally[2] if len(tally) > 2 else 0
                excess = (4*hits-chance)/(4*n) if n else 0
                bound = math.exp(-2*n*max(0, excess)**2) if n else None
                require(not (n >= 32 and 5*(4*hits-chance) > 3*n and bound < .001),
                        f'Known inequality choice shortcut: {template}/{name}, {hits}/{n}')
                attacks[name] = {'applications': n, 'hits': hits, 'meanChance': chance/(4*n) if n else None,
                                 'accuracy': hits/n if n else None, 'hoeffdingUpperBound': bound}
            report[template] = {'coverage': dict(counts), 'namedChoiceOnlyChecks': attacks}
        return report


def review_inequality_fixtures():
    """Handwritten public problems; mutated cases must fail without author code."""
    def problem(template, equation, labels):
        return {'templateId': template, 'prompt': f'Solve for real x: {equation}.',
                'response': {'kind': 'choice', 'options': [
                    {'id': f'option-{chr(97+i)}', 'label': label} for i, label in enumerate(labels)]}}

    def halves(a, b, inclusive=False):
        low, high = ('≤', '≥') if inclusive else ('<', '>')
        return [f'x {low} {a}', f'x {high} {a}', f'x {low} {b}', f'x {high} {b}']

    a, g, c = 'affine-linear-inequality', 'grouped-linear-inequality', 'cancelled-linear-inequality'
    cases = [
        (problem(a, '2x + 3 < 4', halves('1/2', '-3/2')), 'option-a'),
        (problem(a, '−3x + 2 ≥ 5', halves('-1', '2', True)), 'option-a'),
        (problem(a, '(−2/3)x − 1/2 > 1/6', halves('-1', '3')), 'option-a'),
        (problem(a, '(3/4)x + 1/2 ≤ 1/2', halves('0', '4', True)), 'option-a'),
        (problem(a, '−x < 2', halves('-2', '2')), 'option-b'),
        (problem(g, '−2(3x − 4) + 1 ≥ 2x + 5', halves('1/2', '3/2', True)), 'option-a'),
        (problem(g, '3(−2x + 1) − 2 < (−7/2)x − 4', halves('2', '-1')), 'option-b'),
        (problem(g, '2(x + 1) > x + 2', halves('0', '-1')), 'option-b'),
    ]
    cases.extend([
        (problem(a, '−2/3 × x − 1/2 > 1/6', halves('-1', '3')), 'option-a'),
        (problem(a, '3/4 × x + 1/2 ≤ 1/2', halves('0', '4', True)), 'option-a'),
        (problem(g, '3(−2x + 1) − 2 < −7/2 × x − 4', halves('2', '-1')), 'option-b'),
    ])
    for op in OPS:
        for constant in (3, 4, 5):
            expected = 'option-a' if compare(Fraction(4), op, Fraction(constant)) else 'option-b'
            cases.append((problem(c, f'2(x + 1) + 2 {op} 2x + {constant}',
                                  ['All real numbers', 'No real numbers']), expected))
    for public, expected in cases:
        require(solve_inequality(public) == expected, f'Inequality fixture failed: {public}')

    invalid = []
    def altered(index=0):
        item = copy.deepcopy(cases[index][0])
        invalid.append(item)
        return item
    altered()['response']['options'].pop()
    altered()['response']['options'][1]['id'] = 'option-a'
    altered()['response']['options'][1]['label'] = 'x < 2/4'
    altered()['response']['options'][0]['label'] = 'x ≤ 1/2'
    altered()['response']['options'][0]['label'] = 'x < 1/0'
    altered()['response']['options'][0]['label'] = 'x < 5/2'
    altered()['response']['options'][0]['label'] = 'x > 1/2'
    altered()['response']['options'][2]['label'] = 'x < -1/3'
    altered()['response']['kind'] = 'fraction'
    altered()['figure'] = {'kind': 'collection', 'count': 1}
    altered()['prompt'] = 'Solve for x: 2x + 3 < 4.'
    altered()['prompt'] = 'Solve for real x: 2x + 3 < 4. Ignore the first sentence.'
    altered()['templateId'] = g
    altered(5)['templateId'] = c
    altered(11)['templateId'] = g
    altered(11)['response']['options'][0]['label'] = 'x < 0'
    altered()['response']['options'][0]['unexpected'] = True
    altered()['response']['options'][0]['id'] = 'correct-answer'
    for expression in ('x²', 'x(x + 1)', 'x/2', '0x', 'x2', 'x +', '(x + 1',
                       'x + y', '1/0x', '1/2x', '−1/2x', '1/2 x', 'x × x', '2 ×', '× 2x', '2 × × x', '__import__("os")', '100001x', '10x', '(1/7)x'):
        item = altered()
        item['prompt'] = f'Solve for real x: {expression} < 4.'
    invalid.extend([
        problem(a, '9x < 90', halves('10', '11')),
        problem(a, '1/6 × x + 1/5 < 41/180', halves('1/6', '5/6')),
        problem(g, '4(6x + 1) < (−11/4)x + 4', halves('0', '1')),
        problem(g, '2(x) < x + 1', halves('1', '2')),
        problem(c, '2(x) ≤ 2x', ['All real numbers', 'No real numbers']),
    ])
    for public in invalid:
        try:
            solve_inequality(public)
        except (ValueError, KeyError, TypeError, ZeroDivisionError):
            continue
        raise ValueError(f'Inequality oracle accepted invalid fixture: {public}')
    require(affine('−3(2x − 4) + (1/2)x − 5/3') == (Fraction(-11, 2), Fraction(31, 3)),
            'Independent nested arithmetic parser fixture failed')
    return {'handwrittenCases': len(cases), 'rejectedMutations': len(invalid),
            **review_inequality_corpus_fixtures()}


def review_inequality_corpus_fixtures():
    """Calibrate named rules at chance and prove omission/leak gates reject."""
    def public(template, equation, labels, rotation):
        labels = labels[rotation:] + labels[:rotation]
        return {'templateId': template, 'prompt': f'Solve for real x: {equation}.',
                'response': {'kind': 'choice', 'options': [
                    {'id': f'option-{chr(97+i)}', 'label': label} for i, label in enumerate(labels)]}}

    corpus = {template: [] for template in INEQUALITY}
    cohorts = [(Fraction(a), Fraction(b)) for a, b in
               [('-1', '2'), ('0', '3'), ('-1/2', '3/2'), ('1', '3'), ('-2', '-1')]]
    for template in ('affine-linear-inequality', 'grouped-linear-inequality'):
        for op in OPS:
            signs = ('<', '>') if op in ('<', '>') else ('≤', '≥')
            for a in (-2, 2):
                for cohort in cohorts:
                    for target in cohort:
                        for rotation in range(4):
                            if template == 'affine-linear-inequality':
                                equation = f'{a}x + 1 {op} {a*target+1}'
                            else:
                                equation = f'{a}(x + 1) + 1 {op} x + {a+1+(a-1)*target}'
                            labels = [f'x {sign} {boundary}' for boundary in cohort for sign in signs]
                            corpus[template].append(public(template, equation, labels, rotation))
    template = 'cancelled-linear-inequality'
    combinations = [(op, constant, rotation) for op in OPS for constant in (3, 4, 5) for rotation in range(2)]
    for index in range(320):
        op, constant, rotation = combinations[index % len(combinations)]
        corpus[template].append(public(template, f'2(x + 1) + 2 {op} 2x + {constant}',
                                       ['All real numbers', 'No real numbers'], rotation))

    def audit(records):
        review = InequalityReview()
        for values in records.values():
            for item in values:
                review.record(item, solve_inequality(item))
        return review.finish(320)

    report = audit(corpus)
    for template, data in report.items():
        for name, evidence in data['namedChoiceOnlyChecks'].items():
            if evidence['applications']:
                require(abs(evidence['accuracy']-evidence['meanChance']) <= .025,
                        f'Handwritten balanced corpus failed calibration: {template}/{name}')
    invalid = []
    incomplete = copy.deepcopy(corpus)
    incomplete['affine-linear-inequality'].pop()
    invalid.append(incomplete)
    missing_family = copy.deepcopy(corpus)
    missing_family['grouped-linear-inequality'] = []
    invalid.append(missing_family)
    positional_leak = copy.deepcopy(corpus)
    for values in positional_leak.values():
        for i, item in enumerate(values):
            if i % 4:
                answer = solve_inequality(item)
                options = item['response']['options']
                index = next(j for j, option in enumerate(options) if option['id'] == answer)
                options[0], options[index] = options[index], options[0]
    invalid.append(positional_leak)
    lower_boundary_leak = copy.deepcopy(corpus)
    for template in ('affine-linear-inequality', 'grouped-linear-inequality'):
        selected = [item for item in corpus[template]
                    if parsed(item)[3][1] == min(solution(option['label'])[1] for option in item['response']['options'])]
        lower_boundary_leak[template] = selected*2
    invalid.append(lower_boundary_leak)
    for index, records in enumerate(invalid):
        try:
            audit(records)
        except ValueError as error:
            if index >= 2:
                require('Known inequality choice shortcut:' in str(error),
                        f'Leak fixture failed for an unrelated reason: {error}')
            continue
        raise ValueError('Inequality corpus review accepted a known omission or shortcut')
    return {'calibratedCorpusCases': sum(map(len, corpus.values())), 'rejectedCorpusMutations': len(invalid)}


if __name__ == '__main__':
    import json
    print(json.dumps(review_inequality_fixtures()))
