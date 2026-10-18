"""Independent quadratic solver using only public equations and choice labels."""
import copy
import math
import re
from fractions import Fraction


QUADRATIC_CHOICE = frozenset({
    'quadratic-factored-solutions', 'quadratic-expanded-solutions',
})
QUADRATIC = QUADRATIC_CHOICE | {'quadratic-real-solution-count'}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def match(pattern, text):
    found = re.fullmatch(pattern, text.replace('−', '-'))
    require(found is not None, f'Unsupported quadratic wording: {text}')
    return found


def signed(sign, magnitude, default=1):
    return (-1 if sign == '-' else 1) * (int(magnitude) if magnitude else default)


def linear(expression):
    found = match(r'([+-]?)([0-9]*)x(?:\s*([+-])\s*([0-9]+))?', expression)
    a = signed(found[1], found[2])
    b = signed(found[3], found[4], 0)
    require(a != 0, 'Each factor must be linear')
    return a, b


def expanded(expression):
    found = match(
        r'([+-]?)([0-9]*)x²(?:\s*([+-])\s*([0-9]*)x)?'
        r'(?:\s*([+-])\s*([0-9]+))?', expression)
    a = signed(found[1], found[2])
    b = signed(found[3], found[4]) if found[3] else 0
    c = signed(found[5], found[6], 0)
    require(a != 0, 'Quadratic coefficient must be nonzero')
    return a, b, c


def solution_set(label):
    number = r'[-+]?[0-9]+(?:/[0-9]+)?'
    found = match(rf'x = ({number})(?: or x = ({number}))?', label)
    roots = tuple(Fraction(text) for text in found.groups() if text is not None)
    require(len(set(roots)) == len(roots), 'A choice repeats the same root')
    return frozenset(roots)


def select_solution(public, roots):
    options = public['response']['options']
    require(isinstance(options, list) and 2 <= len(options) <= 6, 'Expected two to six choices')
    require(all(isinstance(option, dict) and set(option) == {'id', 'label'}
                and isinstance(option['id'], str) and 0 < len(option['id']) <= 64
                and isinstance(option['label'], str) for option in options),
            'Invalid quadratic choice shape')
    require(len({option['id'] for option in options}) == len(options), 'Duplicate choice ID')
    identities = [solution_set(option['label']) for option in options]
    require(len(set(identities)) == len(identities), 'Mathematically duplicate choices')
    correct = [option['id'] for option, identity in zip(options, identities) if identity == roots]
    require(len(correct) == 1, 'Exactly one choice must give the complete real solution set')
    return correct[0]


def solve_quadratic(public):
    template = public['templateId']
    require(template in QUADRATIC, 'Unsupported quadratic family')
    require(public.get('figure') is None, 'Unexpected quadratic diagram')
    kind = 'choice' if template in QUADRATIC_CHOICE else 'number'
    require(public['response']['kind'] == kind, 'Incorrect quadratic response protocol')
    if template == 'quadratic-real-solution-count':
        equation = match(r'How many distinct real solutions does (.+) = 0 have\?', public['prompt'])[1]
    else:
        equation = match(r'Solve (.+) = 0\. Choose the complete set of real solutions\.', public['prompt'])[1]
    if template == 'quadratic-factored-solutions':
        factors = match(r'\(([^()]+)\)\s*\(([^()]+)\)', equation)
        left_a, left_b = linear(factors[1])
        right_a, right_b = linear(factors[2])
        # Multiply the displayed factors and solve the resulting polynomial;
        # neither hidden factor roots nor generated answer keys are inputs.
        a = left_a * right_a
        b = left_a * right_b + left_b * right_a
        c = left_b * right_b
    else:
        a, b, c = expanded(equation)
    discriminant = b*b - 4*a*c
    if template == 'quadratic-real-solution-count':
        return 0 if discriminant < 0 else 1 if discriminant == 0 else 2
    require(discriminant >= 0, 'Rational-root family must have real solutions')
    square_root = math.isqrt(discriminant)
    require(square_root*square_root == discriminant, 'Rational-root family produced irrational roots')
    roots = frozenset(Fraction(-b + sign*square_root, 2*a) for sign in (-1, 1))
    require(all(a*root*root + b*root + c == 0 for root in roots), 'Root substitution failed')
    return select_solution(public, roots)


def review_quadratic_fixtures():
    """Handwritten roots, degeneracies, and mutations independent of generators."""
    def public(template, equation, labels=None):
        if labels is None:
            prompt = f'How many distinct real solutions does {equation} = 0 have?'
            response = {'kind': 'number'}
        else:
            prompt = f'Solve {equation} = 0. Choose the complete set of real solutions.'
            response = {'kind': 'choice', 'options': [
                {'id': str(index), 'label': label} for index, label in enumerate(labels)
            ]}
        return {'templateId': template, 'prompt': prompt, 'response': response}

    factored, expanded_id, count = 'quadratic-factored-solutions', 'quadratic-expanded-solutions', 'quadratic-real-solution-count'
    cases = [
        (public(factored, '(2x − 1)(3x + 2)', ['x = -2/3 or x = 1/2', 'x = 1/2', 'x = 2/3 or x = -1/2']), '0'),
        (public(factored, '(2x − 1)(4x − 2)', ['x = -1/2', 'x = 1/2', 'x = 1/2 or x = 2']), '1'),
        (public(factored, '(x)(−x + 3)', ['x = 0', 'x = 3 or x = 0', 'x = 0 or x = -3']), '1'),
        (public(expanded_id, '6x² + x − 2', ['x = -1/2 or x = 2/3', 'x = 1/2 or x = −2/3', 'x = 1/2']), '1'),
        (public(expanded_id, '−x² + 9', ['x = -3', 'x = 3', 'x = 3 or x = -3']), '2'),
        (public(expanded_id, 'x² − 6x + 9', ['x = 3', 'x = -3', 'x = 3 or x = -3']), '0'),
        (public(expanded_id, 'x²', ['x = 0', 'x = 1', 'x = 0 or x = 1']), '0'),
        (public(expanded_id, '−2x² − x', ['x = 0 or x = -1/2', 'x = 0 or x = 1/2', 'x = -1/2']), '0'),
        (public(count, 'x² + 1'), 0),
        (public(count, '−3x² − 12x − 12'), 1),
        (public(count, 'x² − 2'), 2),
        (public(count, 'x² + x'), 2),
        (public(count, 'x²'), 1),
        (public(count, '2x² + 0x + 0'), 1),
        (public(count, '−x² − 1'), 0),
    ]
    for given, expected in cases:
        require(solve_quadratic(given) == expected, f'Quadratic fixture failed: {given}')

    invalid = []
    def altered(index):
        item = copy.deepcopy(cases[index][0])
        invalid.append(item)
        return item
    altered(0)['prompt'] = cases[0][0]['prompt'].replace('2x', '5x')
    altered(3)['prompt'] = cases[3][0]['prompt'].replace('6x²', '7x²')
    altered(0)['response']['options'][1]['label'] = 'x = 1/2 or x = -2/3'
    altered(0)['response']['options'][1]['label'] = 'x = 2/4 or x = -4/6'
    altered(0)['response']['options'][0]['label'] = 'x = -2/3'
    altered(1)['response']['options'][1]['label'] = 'x = 1/2 or x = 1/2'
    altered(0)['response']['options'][0]['id'] = '1'
    altered(0)['response']['options'][0]['label'] = 'x = 1/0'
    altered(0)['response']['kind'] = 'number'
    altered(8)['response']['kind'] = 'choice'
    altered(8)['prompt'] = 'How many solutions does x² + 1 = 0 have?'
    altered(8)['figure'] = {'kind': 'collection', 'count': 2}
    for bad in ['0x² + x + 1', 'x² + 1 = 1', 'x² + y', 'x² + x²', 'x³',
                'x² + 1 2', 'x² +', 'x² / x', '__import__("os")']:
        invalid.append(public(count, bad))
    for bad in ['(0x + 1)(x + 2)', '(x + 1)(x + 2)(x + 3)', '(x² + 1)(x + 2)', '(x + 1) / (x + 2)']:
        invalid.append(public(factored, bad, ['x = -1', 'x = -2']))
    for bad in ['x² + 1', 'x² − 2']:
        invalid.append(public(expanded_id, bad, ['x = -1', 'x = 1']))
    for given in invalid:
        try:
            solve_quadratic(given)
        except (ValueError, ZeroDivisionError):
            continue
        raise ValueError(f'Quadratic oracle accepted invalid fixture: {given}')
    return {'handwrittenCases': len(cases), 'rejectedMutations': len(invalid)}


if __name__ == '__main__':
    import json
    print(json.dumps(review_quadratic_fixtures()))
