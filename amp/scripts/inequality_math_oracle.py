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


def check_worksheet_order_variation(patterns, first_answers):
    for template in INEQUALITY:
        # Collisions are valid. These thresholds reject fixed requirement ordering,
        # not ordinary repeat patterns (six all/six none has only924 patterns).
        require(len(patterns[template]) >= 4, 'Worksheet classification order is too repetitive')
        require(len(first_answers[template]) >= 2, 'First worksheet answer is constant across editions')


def check_inequality_content(records):
    """Solve selected public problems; author tags and answers never guide coverage."""
    import hashlib
    import json
    require(records and records[0].get('kind') == 'inequality-content-manifest',
            'Missing inequality content manifest')
    header = records[0]
    require(header.get('editions') == 16, 'Require sixteen worksheet editions')
    expected_facets = {
        'affine-linear-inequality': 'linear-inequalities.affine-solution-set',
        'grouped-linear-inequality': 'linear-inequalities.grouped-solution-set',
        'cancelled-linear-inequality': 'linear-inequalities.cancellation-solution-set',
    }
    templates = header['templates']
    require(len(templates) == 3 and {item['id'] for item in templates} == INEQUALITY and
            all(item['skillId'] == 'linear-inequalities' for item in templates),
            'Incorrect inequality template/skill inventory')
    for name in ('declaredMappings', 'registeredMappings'):
        mappings = header[name]
        require(len(mappings) == 3 and {m['templateId'] for m in mappings} == INEQUALITY and
                all(m['facetId'] == expected_facets[m['templateId']] and
                    m['extent'] == 'partial' and isinstance(m['rationale'], str) and
                    m['rationale'].strip() for m in mappings),
                f'Expected exactly three partial inequality bindings in {name}')
    require(header['coverageValid'] is True, 'Default coverage manifest is invalid')
    bindings = header['defaultBindings']
    require(len(bindings) == 3 and {b['templateId'] for b in bindings} == INEQUALITY and
            all(b['facetId'] == expected_facets[b['templateId']] and
                b['skillId'] == 'linear-inequalities' and b['independentlyReviewed'] is False
                for b in bindings), 'Default facet registry must expose the three partial task bindings')

    require(header['emptyOverrideValid'] is True and header['emptyOverrideBindings'] == bindings,
            'Empty production-queue mapping input must preserve default bindings')
    require(header['isolatedBindings'] == [], 'Custom template inventories must not inherit unrelated defaults')
    probes = header['mappingProbes']
    key = probes['replacementKey']
    expected_keys = {f'{template}:{facet}' for template, facet in expected_facets.items()}
    require(key in expected_keys, 'Replacement probe must exercise an actual default mapping')
    for name in ('replacement', 'completeWithoutEvidence'):
        probe = probes[name]
        require(probe['valid'] is True and probe['errors'] == [] and probe['bindings'] == bindings,
                f'Same-key {name} must replace its default without granting independent review')
    duplicate = probes['duplicate']
    require(duplicate['valid'] is False and duplicate['errors'] == [f'Duplicate facet mapping: {key}'] and
            duplicate['bindings'] == bindings, 'Duplicate supplied mappings must remain validation errors')
    invalid = probes['invalidReplacement']
    retained = [binding for binding in bindings if f"{binding['templateId']}:{binding['facetId']}" != key]
    require(invalid['valid'] is False and invalid['errors'] == [f'Invalid facet mapping: {key}'] and
            invalid['bindings'] == retained, 'Invalid replacement must not silently retain its valid default')
    explicit = probes['explicitCatalogSkills']
    require(explicit['valid'] is True and explicit['errors'] == [] and explicit['bindings'] == [],
            'Any explicit skill inventory, including catalog skills, must suppress default mappings')

    seen, patterns, first_answers = set(), {t: set() for t in INEQUALITY}, {t: set() for t in INEQUALITY}
    total = 0
    for sheet in records[1:]:
        require(sheet.get('kind') == 'inequality-worksheet', 'Unexpected inequality content record')
        template, edition = sheet['templateId'], sheet['edition']
        require(template in INEQUALITY and edition in {str(i) for i in range(1, 17)},
                'Worksheet outside declared inventory')
        identity = template, edition
        require(identity not in seen, 'Duplicate inequality worksheet')
        seen.add(identity)
        require(sheet['lessonId'] == template, 'Incorrect standalone lesson association')
        problems, replayed = sheet['problems'], sheet['replayed']
        require(len(problems) == len(replayed) == 12 and problems == replayed,
                'Selected worksheet must replay to twelve unchanged runtime problems')
        require(len({p['public']['prompt'] for p in problems}) == 12 and
                len({p['public']['seed'] for p in problems}) == 12,
                'Worksheet needs twelve distinct givens and seeds')
        ordered_hashes = []
        derived = []
        workbook, solutions = sheet['workbook'], sheet['solutions']
        require(len(workbook) == len(solutions) == 12, 'Workbook/key exercise count mismatch')
        for index, problem in enumerate(problems):
            require(set(problem) == {'public', 'answer', 'hint', 'explanation', 'choiceFeedback'},
                    'Unexpected generated worksheet fields')
            public = problem['public']
            require(set(public) == {'id', 'templateId', 'templateVersion', 'seed', 'skillId', 'prompt', 'response'},
                    'Private or unexpected fields in public worksheet payload')
            require(public['templateId'] == template and public['skillId'] == 'linear-inequalities' and
                    public['templateVersion'] == 1 and re.fullmatch(r'[a-f0-9]{64}', public['id']) and
                    re.fullmatch(rf'print:{re.escape(template)}:{edition}:(0|[1-9][0-9]*)', public['seed']),
                    'Invalid worksheet problem identity')
            require(set(public['response']) == {'kind', 'label', 'options'}, 'Unexpected public response fields')
            answer = solve_inequality(public)
            require(problem['answer'] == answer, 'Worksheet answer differs from independent solution')
            values = parsed(public)
            derived.append(values)
            options = public['response']['options']
            labels = [option['label'] for option in options]
            correct_label = next(option['label'] for option in options if option['id'] == answer)
            for rendered in (workbook[index], solutions[index]):
                require(rendered['prompt'] == public['prompt'] and rendered['choices'] == labels,
                        'Workbook/key prompt or choice order differs from selected problem')
                require(rendered['hiddenAnswerMarkers'] == 0, 'Hidden answer markers in rendered exercise')
            require(workbook[index]['answer'] is None and workbook[index]['steps'] == [],
                    'Worksheet contains an answer or worked steps')
            require(solutions[index]['answer'] == f'Answer: {correct_label}' and
                    solutions[index]['steps'] == problem['explanation'],
                    'Worked key answer or steps differ from the selected problem')
            material = ['inequality-sheet-order', template, sheet['lessonId'], edition, public['seed']]
            ordered_hashes.append(hashlib.sha256(json.dumps(material, separators=(',', ':')).encode()).hexdigest())
        require(ordered_hashes == sorted(ordered_hashes), 'Worksheet must use independent edition-derived order')
        require(Counter(op for _, op, _, _ in derived) == dict.fromkeys(OPS, 3),
                'Worksheet needs three examples of every comparison operator')
        if template == 'cancelled-linear-inequality':
            for op in OPS:
                classes = ['equal' if left[1] == right[1] else 'true' if result == ('all',) else 'false'
                           for left, sign, right, result in derived if sign == op]
                require(sorted(classes) == ['equal', 'false', 'true'],
                        'Each operator needs equal constants, unequal true, and unequal false examples')
            require(sum(result == ('all',) for _, _, _, result in derived) == 6,
                    'Cancellation worksheet must balance all-real/no-real outcomes')
            signature = tuple(result[0] for _, _, _, result in derived)
        else:
            require(any(result[1] == 0 for _, _, _, result in derived), 'Worksheet is missing a zero boundary')
            require(any(result[1].denominator > 1 for _, _, _, result in derived),
                    'Worksheet is missing a fractional boundary')
            require({left[0] > right[0] for left, _, right, _ in derived} == {True, False},
                    'Worksheet must exercise both coefficient signs')
            if template == 'affine-linear-inequality':
                require(any(left[0].denominator > 1 for left, _, _, _ in derived),
                        'Affine worksheet must include a fractional coefficient')
            signature = tuple((op, left[0] > right[0], result[1] == 0)
                              for left, op, right, result in derived)
        patterns[template].add(signature)
        first_answers[template].add(derived[0][3])
        total += len(problems)
    require(seen == {(template, str(edition)) for template in INEQUALITY for edition in range(1, 17)},
            'Missing inequality worksheet editions or families')
    check_worksheet_order_variation(patterns, first_answers)
    return {'worksheets': len(seen), 'problems': total, 'defaultFacetBindings': 3, 'mappingOverrideProbes': 5,
            'distinctClassificationOrders': {t: len(patterns[t]) for t in sorted(INEQUALITY)},
            'mismatches': 0}


def review_inequality_content_mutations(records):
    """Start with independently checked evidence; prove known regressions fail."""
    mutations = []
    def changed():
        value = copy.deepcopy(records)
        mutations.append(value)
        return value
    changed().pop()
    changed().append(copy.deepcopy(records[1]))
    changed()[0]['registeredMappings'] = []
    changed()[0]['defaultBindings'] = []
    changed()[0]['emptyOverrideBindings'] = []
    changed()[0]['isolatedBindings'] = copy.deepcopy(records[0]['defaultBindings'])
    changed()[0]['mappingProbes']['replacement']['valid'] = False
    changed()[0]['mappingProbes']['replacement']['bindings'].append(copy.deepcopy(records[0]['defaultBindings'][0]))
    changed()[0]['mappingProbes']['completeWithoutEvidence']['bindings'][0]['independentlyReviewed'] = True
    changed()[0]['mappingProbes']['duplicate']['valid'] = True
    changed()[0]['mappingProbes']['duplicate']['errors'] = []
    changed()[0]['mappingProbes']['invalidReplacement']['bindings'] = copy.deepcopy(records[0]['defaultBindings'])
    changed()[0]['mappingProbes']['explicitCatalogSkills']['bindings'] = copy.deepcopy(records[0]['defaultBindings'])
    changed()[0]['declaredMappings'][0]['extent'] = 'complete'
    changed()[0]['defaultBindings'][0]['skillId'] = 'simple-inequalities'
    changed()[0]['defaultBindings'][0]['facetId'] = 'linear-inequalities.unknown'
    changed()[1]['problems'][0]['public']['tags'] = ['zero']
    changed()[1]['workbook'][0]['answer'] = 'Answer: x < 0'
    changed()[1]['workbook'][0]['hiddenAnswerMarkers'] = 1
    changed()[1]['solutions'][0]['answer'] = 'Answer: no such set'
    value = changed()
    value[1]['workbook'][0], value[1]['workbook'][1] = value[1]['workbook'][1], value[1]['workbook'][0]
    value = changed()
    value[1]['problems'][0] = copy.deepcopy(value[1]['problems'][1])
    value[1]['replayed'] = copy.deepcopy(value[1]['problems'])
    # Reversing all parallel arrays preserves answer-key correspondence but must
    # still fail the independently recomputed ordering contract.
    value = changed()
    for field in ('problems', 'replayed', 'workbook', 'solutions'):
        value[1][field].reverse()
    expected_failures = {}
    def replace_prompt(sheet, index, public):
        problem = sheet['problems'][index]
        problem['public'] = public
        problem['answer'] = solve_inequality(public)
        sheet['replayed'][index] = copy.deepcopy(problem)
        labels = [option['label'] for option in public['response']['options']]
        answer = next(option['label'] for option in public['response']['options'] if option['id'] == problem['answer'])
        for kind in ('workbook', 'solutions'):
            sheet[kind][index]['prompt'] = public['prompt']
            sheet[kind][index]['choices'] = labels
        sheet['solutions'][index]['answer'] = f'Answer: {answer}'

    def linear(a, b):
        if a == 0:
            return str(b)
        term = ('x' if a == 1 else '-x' if a == -1 else f'{a}x'
                if a.denominator == 1 else f'{a} × x')
        return term + (f" {'+' if b > 0 else '-'} {abs(b)}" if b else '')

    value = changed()
    sheet = next(row for row in value[1:] if row['templateId'] == 'affine-linear-inequality')
    for index, problem in enumerate(sheet['problems']):
        left, op, right, result = parsed(problem['public'])
        if result[1] != 0:
            continue
        original = problem['public']
        left_text = re.fullmatch(r'Solve for real x: (.+) ([<≤>≥]) (.+)\.', original['prompt'])[1]
        for replacement in (Fraction(i) for i in range(-12, 13) if i):
            public = copy.deepcopy(original)
            total = left[1] + (left[0]-right[0])*replacement
            public['prompt'] = f'Solve for real x: {left_text} {op} {linear(right[0], total)}.'
            for option in public['response']['options']:
                sign, boundary = solution(option['label'])
                if boundary == 0:
                    option['label'] = f'x {sign} {replacement}'
            try:
                solve_inequality(public)
            except ValueError:
                continue
            replace_prompt(sheet, index, public)
            break
        else:
            raise ValueError('Could not construct missing-zero mutation')
    expected_failures[id(value)] = 'Worksheet is missing a zero boundary'

    value = changed()
    sheet = next(row for row in value[1:] if row['templateId'] == 'cancelled-linear-inequality')
    for index, problem in enumerate(sheet['problems']):
        left, op, right, result = parsed(problem['public'])
        if left[1] != right[1] or op not in ('<', '>'):
            continue
        public = copy.deepcopy(problem['public'])
        left_text = re.fullmatch(r'Solve for real x: (.+) ([<≤>≥]) (.+)\.', public['prompt'])[1]
        total = left[1] + (-1 if op == '<' else 1)
        public['prompt'] = f'Solve for real x: {left_text} {op} {linear(right[0], total)}.'
        replace_prompt(sheet, index, public)
    expected_failures[id(value)] = 'Each operator needs equal constants'

    rejected = 0
    for mutated in mutations:
        try:
            check_inequality_content(mutated)
        except (ValueError, KeyError, TypeError, ZeroDivisionError) as error:
            expected = expected_failures.get(id(mutated))
            require(expected is None or expected in str(error),
                    f'Content mutation failed for an unrelated reason: {error}')
            rejected += 1
        else:
            raise ValueError('Inequality content oracle accepted a known regression')
    # Four distinct patterns among sixteen editions explicitly permits repeated
    # patterns; uniqueness of every shuffle is not a mathematical requirement.
    patterns = {template: {(i,) for i in range(4)} for template in INEQUALITY}
    first_answers = {template: {('all',), ('none',)} for template in INEQUALITY}
    check_worksheet_order_variation(patterns, first_answers)
    for kind in ('pattern', 'first-answer'):
        bad_patterns, bad_first = copy.deepcopy(patterns), copy.deepcopy(first_answers)
        if kind == 'pattern':
            bad_patterns['cancelled-linear-inequality'] = {(0,)}
        else:
            bad_first['affine-linear-inequality'] = {('<', Fraction(0))}
        try:
            check_worksheet_order_variation(bad_patterns, bad_first)
        except ValueError:
            rejected += 1
        else:
            raise ValueError('Fixed worksheet answer order escaped review')
    return rejected


def review_inequality_content():
    import json
    import subprocess
    from pathlib import Path
    root = Path(__file__).resolve().parent.parent
    result = subprocess.run(['node', '--import', 'tsx', str(root/'scripts/inequality-content-oracle.ts')],
                            cwd=root, capture_output=True, text=True, timeout=180)
    require(result.returncode == 0, f'Inequality content export failed: {result.stderr[:2000]}')
    records = [json.loads(line) for line in result.stdout.splitlines()]
    report = check_inequality_content(records)
    report['rejectedMutations'] = review_inequality_content_mutations(records)
    return report


if __name__ == '__main__':
    import json
    print(json.dumps(review_inequality_fixtures()))
