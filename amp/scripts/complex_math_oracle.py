"""Independent complex-product review from displayed factors and answer choices."""
import copy
import re

SUPPORTED = frozenset({'complex-multiplication'})


def require(condition, message):
    if not condition:
        raise ValueError(message)


def plain(text):
    return text.replace('$', '').replace('−', '-').replace('²', '^2')


def coefficients(expression):
    """Read a sum of integer real and imaginary terms, including i and -i."""
    text = re.sub(r'\s+', '', plain(expression))
    terms = re.findall(r'[+-]?(?:\d+i|\d+|i)', text)
    require(terms and ''.join(terms) == text, f'Invalid complex expression: {expression}')
    require(all(term[0] in '+-' for term in terms[1:]), 'Missing operator between complex terms')
    total = [0, 0]
    for term in terms:
        imaginary = term.endswith('i')
        coefficient = term[:-1] if imaginary else term
        if coefficient in ('', '+', '-'):
            coefficient += '1'
        total[int(imaginary)] += int(coefficient)
    return tuple(total)


def solve(public):
    require(public['templateId'] in SUPPORTED, 'Unexpected complex family')
    require(public.get('figure') is None, 'Unexpected diagram in symbolic product')
    match = re.fullmatch(
        r'Multiply \(([^()]+)\)\(([^()]+)\) using i\^2=-1\. Choose the exact product\.',
        plain(public['prompt']),
    )
    require(match is not None, 'Complex factors and the i-squared rule must be explicit')
    left, right = coefficients(match[1]), coefficients(match[2])
    # Convolve the two displayed degree-one polynomials, then reduce modulo i²+1.
    powers = [0, 0, 0]
    for degree, value in enumerate(left):
        for other_degree, other_value in enumerate(right):
            powers[degree + other_degree] += value * other_value
    expected = (powers[0] - powers[2], powers[1])
    response = public['response']
    require(response['kind'] == 'choice', 'Complex products use choice responses')
    options = response['options']
    require(len(options) == 4 and all(set(o) == {'id', 'label'} for o in options), 'Four public choices required')
    require(len({o['id'] for o in options}) == 4, 'Duplicate choice IDs')
    values = [coefficients(o['label']) for o in options]
    require(len(set(values)) == 4, 'Mathematically duplicate complex choices')
    correct = [o['id'] for o, value in zip(options, values) if value == expected]
    require(len(correct) == 1, 'Missing or ambiguous exact product')
    return correct[0]


def review_problem(problem):
    result = solve(problem['public'])
    require(result == problem['answer'], 'Complex product answer key mismatch')
    return result


def self_test():
    # Hand-calculated examples cover both cancellation types, signs, and i itself.
    cases = [
        ('2+3i', '4-i', '11+10i'),
        ('0-5i', '2-3i', '-15-10i'),
        ('-4-3i', '0+2i', '6-8i'),
        ('-2-2i', '5+5i', '-20i'),
        ('3+5i', '3-5i', '34'),
        ('-3-3i', '1+4i', '9-15i'),
        ('i', '-i', '1'),
        ('0', '3+i', '0'),
    ]
    rejected = 0
    def reject(problem):
        nonlocal rejected
        try:
            review_problem(problem)
        except ValueError:
            rejected += 1
            return
        raise ValueError('Corrupt complex product was accepted')
    for left, right, expected in cases:
        options = [expected, '1001+i', '1002+i', '1003+i']
        problem = {
            'public': {
                'templateId': 'complex-multiplication',
                'prompt': f'Multiply $({left})({right})$ using $i^2=-1$. Choose the exact product.',
                'response': {'kind': 'choice', 'options': [
                    {'id': str(i), 'label': f'${label}$'} for i, label in enumerate(options)
                ]},
            },
            'answer': '0',
        }
        review_problem(problem)
        bad = copy.deepcopy(problem)
        bad['answer'] = '1'
        reject(bad)
        bad = copy.deepcopy(problem)
        bad['public']['response']['options'][0]['label'] = '$1004+i$'
        reject(bad)
        bad = copy.deepcopy(problem)
        bad['public']['response']['options'][1]['label'] = f'${expected}+0i$'
        reject(bad)
        bad = copy.deepcopy(problem)
        bad['public']['prompt'] = bad['public']['prompt'].replace('i^2=-1', 'i^2=1')
        reject(bad)
    return {'fixtures': len(cases), 'rejectedMutations': rejected}

# Read by independent-math-review.py (FamilyOracle).
CHOICE_REVIEW = SUPPORTED



if __name__ == '__main__':
    print(self_test())
