"""Exact public-prompt review for integer missing legs and the Pythagorean converse."""
import copy
import math
import re
from collections import Counter
from itertools import permutations

MISSING_LEG = 'right-triangle-missing-leg'
CONVERSE = 'pythagorean-converse'
RIGHT_TRIANGLE = frozenset({MISSING_LEG, CONVERSE})
RIGHT_TRIANGLE_CHOICE = frozenset({CONVERSE})
LABELS = ('Right triangle', 'Not a right triangle')
INTEGER = r'([1-9][0-9]*)'
PATTERNS = {
    MISSING_LEG: rf'A right triangle has a hypotenuse of {INTEGER} cm and one leg of {INTEGER} cm\. '
                 r'What is the length of the other leg, in centimeters\?',
    CONVERSE: rf'A triangle has side lengths {INTEGER} cm, {INTEGER} cm, and {INTEGER} cm\. '
              r'Is it a right triangle\?',
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def givens(public):
    template = public['templateId']
    require(template in RIGHT_TRIANGLE, 'Unsupported right-triangle family')
    require(public.get('figure') is None, 'These triangle prompts must not disclose a diagram answer')
    found = re.fullmatch(PATTERNS[template], public['prompt'])
    require(found is not None, 'Malformed or ambiguous right-triangle prompt')
    return tuple(map(int, found.groups()))


def triangle_class(sides):
    a, b, c = sorted(sides)
    require(1 <= a <= b <= c <= 30 and a+b > c,
            'Converse requires a nondegenerate integer triangle with sides at most 30')
    delta = a*a+b*b-c*c
    return 'right' if delta == 0 else 'acute' if delta > 0 else 'obtuse'


def solve_right_triangle(public):
    values = givens(public)
    response = public['response']
    if public['templateId'] == MISSING_LEG:
        require(response['kind'] == 'number' and 'options' not in response,
                'Missing leg requires a numeric response')
        hypotenuse, leg = values
        require(0 < leg < hypotenuse <= 50, 'Invalid integer missing-leg bounds')
        difference = hypotenuse*hypotenuse-leg*leg
        other = math.isqrt(difference)
        require(other > 0 and other*other == difference, 'Missing leg must be a positive integer')
        return other
    category = triangle_class(values)
    require(response['kind'] == 'choice', 'Converse requires a choice response')
    options = response['options']
    require(isinstance(options, list) and len(options) == 2, 'Converse requires exactly two choices')
    require(all(isinstance(option, dict) and set(option) == {'id', 'label'}
                and isinstance(option['id'], str)
                and re.fullmatch(r'option-[a-d]', option['id'])
                and isinstance(option['label'], str) for option in options),
            'Invalid converse choice shape')
    require(len({option['id'] for option in options}) == 2, 'Duplicate converse choice ID')
    require({option['label'] for option in options} == set(LABELS),
            'Converse choices must contain each complete classification exactly once')
    label = LABELS[0 if category == 'right' else 1]
    return next(option['id'] for option in options if option['label'] == label)


def finite_domains():
    """Enumerate mathematical domains without any generated/private answer data."""
    missing = {(c, a, b) for c in range(1, 51) for a in range(1, c)
               for b in range(1, c) if a*a+b*b == c*c}
    converse = {(a, b, c): triangle_class((a, b, c))
                for c in range(1, 31) for b in range(1, c+1)
                for a in range(1, b+1) if a+b > c}
    return missing, converse


def review_converse_explanation(public, explanation):
    """Review the exported, polished explanation, independently of the answer key."""
    require(public['templateId'] == CONVERSE, 'Explanation check requires a converse problem')
    require(isinstance(explanation, list) and explanation and
            all(isinstance(step, str) and step for step in explanation), 'Missing converse explanation')
    a, b, c = sorted(givens(public))
    category = triangle_class((a, b, c))
    text = ' '.join(explanation)
    if category == 'right':
        relations = re.findall(r'(?<![0-9])([0-9]+)²\s*\+\s*([0-9]+)²\s*=\s*([0-9]+)²', text)
        require(any(sorted((int(x), int(y))) == [a, b] and int(z) == c for x, y, z in relations),
                'Polished converse explanation lost the exact side-square equality')
    else:
        require(re.search(rf'(?<![0-9]){a*a+b*b}\s*≠\s*{c*c}(?![0-9])', text) is not None,
                'Polished nonright explanation must show the exact unequal squared totals')


MISSING_DOMAIN, CONVERSE_DOMAIN = finite_domains()
RIGHT_DOMAIN = {sides for sides, category in CONVERSE_DOMAIN.items() if category == 'right'}


def balanced(observed, total, chance, label):
    """Reject substantial balance regressions, with a conservative sampling tolerance."""
    require(total > 0, f'Missing balance evidence: {label}')
    deviation = abs(observed/total-chance)
    bound = min(1, 2*math.exp(-2*total*deviation*deviation))
    require(not (total >= 32 and deviation > 0.15 and bound < 0.001),
            f'Right-triangle sampling imbalance: {label}: {observed}/{total}, expected {chance}')


class RightTriangleCorpusReview:
    def __init__(self):
        self.counts = Counter()
        self.missing = set()
        self.right = set()
        self.classes = Counter()
        self.positions = Counter()
        self.unique_longest = Counter()
        self.keys = Counter()

    def record(self, public, independent_answer):
        values = givens(public)
        template = public['templateId']
        self.counts[template] += 1
        if template == MISSING_LEG:
            self.missing.add((*values, independent_answer))
            return
        category = triangle_class(values)
        self.classes[category] += 1
        if category == 'right':
            self.right.add(tuple(sorted(values)))
        if values.count(max(values)) == 1:
            self.unique_longest[category] += 1
            self.positions[category, values.index(max(values))] += 1
        options = public['response']['options']
        position = next(i for i, option in enumerate(options) if option['id'] == independent_answer)
        self.keys[category, position] += 1

    def finish(self, count):
        require(type(count) is int and count >= 256, 'Triangle review requires at least 256 cases per family')
        require(all(self.counts[template] == count for template in RIGHT_TRIANGLE),
                'Incomplete right-triangle corpus')
        require(self.missing <= MISSING_DOMAIN and self.right <= RIGHT_DOMAIN,
                'Observed case outside independent finite domain')
        require(len(self.missing) >= 32 and len(self.right) >= 8,
                'Insufficient distinct right-triangle cases')
        for category, chance in [('right', 0.5), ('acute', 0.25), ('obtuse', 0.25)]:
            total = self.classes[category]
            balanced(total, count, chance, category)
            require(total > 0, f'Missing converse category: {category}')
            require(all(self.keys[category, i] > 0 for i in range(2)),
                    f'Missing correct-choice position for {category}')
            balanced(self.keys[category, 0], total, 0.5, f'{category}/answer position')
            require(all(self.positions[category, i] > 0 for i in range(3)),
                    f'Missing longest-side position for {category}')
            for i in range(3):
                balanced(self.positions[category, i], self.unique_longest[category],
                         1/3, f'{category}/longest-side position {i}')
        if count >= 4096:
            require(self.missing == MISSING_DOMAIN and self.right == RIGHT_DOMAIN,
                    'Large triangle sweep omitted a finite missing-leg or right-triangle case')
        return {'casesPerFamily': count, 'missingLegPairs': len(self.missing),
                'rightTriples': len(self.right), 'converseClasses': dict(self.classes),
                'completeSmallDomains': self.missing == MISSING_DOMAIN and self.right == RIGHT_DOMAIN,
                'converseDomainSize': len(CONVERSE_DOMAIN),
                'converseDomainExhaustivelyGenerated': False,
                'answerPositions': {category: [self.keys[category, i] for i in range(2)]
                                    for category in ('right', 'acute', 'obtuse')}}


def fixture_public(template, values, reverse=False):
    if template == MISSING_LEG:
        c, leg = values
        return {'templateId': template,
                'prompt': f'A right triangle has a hypotenuse of {c} cm and one leg of {leg} cm. '
                          'What is the length of the other leg, in centimeters?',
                'response': {'kind': 'number'}}
    a, b, c = values
    labels = list(reversed(LABELS)) if reverse else LABELS
    return {'templateId': template,
            'prompt': f'A triangle has side lengths {a} cm, {b} cm, and {c} cm. Is it a right triangle?',
            'response': {'kind': 'choice', 'options': [
                {'id': f'option-{chr(97+i)}', 'label': label} for i, label in enumerate(labels)]}}


def review_right_triangle_fixtures():
    handwritten = [
        (MISSING_LEG, (5, 3), 4), (MISSING_LEG, (5, 4), 3),
        (MISSING_LEG, (13, 5), 12), (MISSING_LEG, (50, 48), 14),
        (MISSING_LEG, (50, 14), 48), (MISSING_LEG, (41, 9), 40),
        (CONVERSE, (5, 3, 4), 'option-a'), (CONVERSE, (20, 21, 29), 'option-a'),
        (CONVERSE, (4, 5, 6), 'option-b'), (CONVERSE, (4, 2, 3), 'option-b'),
        (CONVERSE, (1, 1, 1), 'option-b'), (CONVERSE, (5, 5, 5), 'option-b'),
    ]
    for template, values, expected in handwritten:
        require(solve_right_triangle(fixture_public(template, values)) == expected,
                'Handwritten triangle fixture failed')
    explanation_public = fixture_public(CONVERSE, (24, 26, 10))
    review_converse_explanation(explanation_public, ['The results are equal: 10² + 24² = 26².'])
    review_converse_explanation(fixture_public(CONVERSE, (4, 5, 6)), ['The results differ: 41 ≠ 36.'])
    rejected_explanations = 0
    for explanation in ([], ['The results are equal: 676.'], ['10² + 24² ≠ 26².'],
                        ['10² + 24² = 25².'], ['a² + b² = c².']):
        try:
            review_converse_explanation(explanation_public, explanation)
        except ValueError:
            rejected_explanations += 1
        else:
            raise ValueError('Accepted a missing or corrupted polished converse equality')
    require(len(MISSING_DOMAIN) == 40 and len(CONVERSE_DOMAIN) == 2600
            and Counter(CONVERSE_DOMAIN.values()) == {'right': 11, 'acute': 1342, 'obtuse': 1247},
            'Independent domain inventory changed')
    for c, leg, other in MISSING_DOMAIN:
        require(solve_right_triangle(fixture_public(MISSING_LEG, (c, leg))) == other,
                'Finite missing-leg domain failed')
    exhaustive = 0
    for sides, category in CONVERSE_DOMAIN.items():
        for ordered in set(permutations(sides)):
            for reverse in (False, True):
                index = int(category != 'right') ^ reverse
                require(solve_right_triangle(fixture_public(CONVERSE, ordered, reverse)) == f'option-{chr(97+index)}',
                        'Converse permutation/choice invariance failed')
                exhaustive += 1
    bad = [fixture_public(MISSING_LEG, values) for values in
           [(5, 5), (3, 5), (0, 0), (-5, 3), (5, 2), (65, 16), ('5.0', 3)]]
    bad += [fixture_public(CONVERSE, values) for values in
            [(1, 2, 3), (1, 2, 4), (0, 3, 3), (-1, 3, 3), (30, 30, 31), ('3.0', 4, 5)]]
    baseline = fixture_public(CONVERSE, (3, 4, 5))
    def changed():
        item = copy.deepcopy(baseline)
        bad.append(item)
        return item
    changed()['response']['options'][1]['label'] = LABELS[0]
    changed()['response']['options'][1]['label'] = 'Acute triangle'
    changed()['response']['options'][1]['id'] = 'option-a'
    changed()['response']['options'].pop()
    changed()['response']['options'].append({'id': 'option-c', 'label': 'Cannot form a triangle'})
    changed()['response']['options'][0]['extra'] = True
    changed()['response']['options'][0]['id'] = 'option-z'
    changed()['response']['kind'] = 'number'
    changed()['figure'] = {'kind': 'right-triangle', 'a': 3, 'b': 4, 'unit': 'cm'}
    changed()['prompt'] += ' Assume a right angle.'
    changed()['prompt'] = baseline['prompt'].replace('4 cm', '4 m')
    changed()['templateId'] = 'triangle-area'
    for value in bad:
        try:
            solve_right_triangle(value)
        except ValueError:
            continue
        raise ValueError(f'Accepted corrupt triangle fixture: {value}')

    # A deterministic reference corpus exercises the aggregate, independently of runtime seeds.
    domain_by_class = {name: sorted(s for s, name_of_s in CONVERSE_DOMAIN.items() if name == name_of_s)
                       for name in ('right', 'acute', 'obtuse')}
    domain_by_class['acute'] = [s for s in domain_by_class['acute'] if s.count(max(s)) == 1]
    review = RightTriangleCorpusReview()
    missing = sorted(MISSING_DOMAIN)
    for i in range(4096):
        c, leg, other = missing[i % len(missing)]
        public = fixture_public(MISSING_LEG, (c, leg))
        review.record(public, solve_right_triangle(public))
        category = ('right', 'right', 'acute', 'obtuse')[i % 4]
        sides = domain_by_class[category][(i//4) % len(domain_by_class[category])]
        rotation = (i//4) % 3
        public = fixture_public(CONVERSE, sides[rotation:]+sides[:rotation], bool((i//12) % 2))
        review.record(public, solve_right_triangle(public))
        if i == 255:
            review.finish(256)
    review.finish(4096)
    rejected_coverage = 0
    for mutation in ('small-sample', 'missing-case', 'missing-pair', 'missing-right', 'class-bias', 'key-bias', 'side-bias'):
        altered = copy.deepcopy(review)
        if mutation == 'small-sample':
            altered.counts = Counter({MISSING_LEG: 31, CONVERSE: 31})
        elif mutation == 'missing-case':
            altered.counts[MISSING_LEG] -= 1
        elif mutation == 'missing-pair':
            altered.missing.pop()
        elif mutation == 'missing-right':
            altered.right.pop()
        elif mutation == 'class-bias':
            altered.classes['right'] = 4000
        elif mutation == 'key-bias':
            altered.keys['right', 0] = altered.classes['right']-1
            altered.keys['right', 1] = 1
        else:
            altered.positions['right', 0] = altered.unique_longest['right']-2
            altered.positions['right', 1] = altered.positions['right', 2] = 1
        try:
            altered.finish(31 if mutation == 'small-sample' else 4096)
        except ValueError:
            rejected_coverage += 1
        else:
            raise ValueError(f'Accepted corrupt triangle coverage: {mutation}')
    return {'handwrittenCases': len(handwritten), 'missingLegDomainCases': len(MISSING_DOMAIN),
            'conversePermutationChoiceCases': exhaustive, 'rejectedMutations': len(bad),
            'rejectedCoverageMutations': rejected_coverage,
            'rejectedExplanationMutations': rejected_explanations}


if __name__ == '__main__':
    import json
    print(json.dumps(review_right_triangle_fixtures()))
