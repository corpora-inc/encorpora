"""Independent inverse rounding from public decimals, using exact fractions."""

import copy
import re
from fractions import Fraction as F

SUPPORTED = frozenset({'inverse-round-decimal'})


def require(ok, message):
    if not ok:
        raise ValueError(message)


def rounded(value, places):
    require(value >= 0, 'Negative decimals outside this family')
    shifted = value * 10**places + F(1, 2)
    return F(shifted.numerator // shifted.denominator, 10**places)


def solve(public):
    require(public['templateId'] in SUPPORTED, 'Wrong template')
    match = re.fullmatch(
        r'Which decimal rounds to (\d+\.\d+) to the nearest '
        r'(tenth|hundredth)\? Round halfway values up\.',
        public['prompt'],
    )
    require(match is not None, 'Unexpected rounding prompt')
    target = F(match[1])
    places = 1 if match[2] == 'tenth' else 2
    require(
        target > 0 and len(match[1].split('.')[1]) == places,
        'Positive target with stated precision required',
    )
    options = public['response']['options']
    require(
        public['response']['kind'] == 'choice' and len(options) == 4,
        'Four choices required',
    )
    require(len({option['id'] for option in options}) == 4, 'Duplicate IDs')
    values = []
    for option in options:
        decimal = re.fullmatch(r'\d+\.\d{3}', option['label'])
        require(decimal is not None, 'Expected thousandth decimal choice')
        values.append(F(decimal[0]))
    require(len(set(values)) == 4, 'Duplicate numeric choices')
    correct = [
        option['id']
        for option, value in zip(options, values)
        if rounded(value, places) == target
    ]
    require(len(correct) == 1, 'Missing or ambiguous answer')
    return correct[0]


def review_problem(problem):
    answer = solve(problem['public'])
    require(answer == problem['answer'], 'Stored answer mismatch')
    return answer


def self_test():
    fixtures = [
        ('4.68', 'hundredth', ['4.674', '4.675', '4.685', '4.686'], 1),
        ('1.00', 'hundredth', ['0.994', '0.995', '1.005', '0.990'], 1),
        ('0.01', 'hundredth', ['0.004', '0.005', '0.015', '0.020'], 1),
        ('1.0', 'tenth', ['0.949', '0.950', '1.050', '1.051'], 1),
        ('9.99', 'hundredth', ['9.980', '9.984', '9.994', '9.995'], 2),
    ]
    rejected = 0

    def reject(problem):
        nonlocal rejected
        try:
            review_problem(problem)
        except ValueError:
            rejected += 1
            return
        raise AssertionError('Corrupt rounding case accepted')

    for target, place, values, index in fixtures:
        problem = {
            'public': {
                'templateId': next(iter(SUPPORTED)),
                'prompt': (
                    f'Which decimal rounds to {target} to the nearest {place}? '
                    'Round halfway values up.'
                ),
                'response': {
                    'kind': 'choice',
                    'options': [
                        {'id': str(i), 'label': value}
                        for i, value in enumerate(values)
                    ],
                },
            },
            'answer': str(index),
        }
        review_problem(problem)
        bad = copy.deepcopy(problem)
        bad['answer'] = str((index + 1) % 4)
        reject(bad)

        bad = copy.deepcopy(problem)
        options = bad['public']['response']['options']
        options[0]['label'] = options[index]['label']
        reject(bad)

        bad = copy.deepcopy(problem)
        zero = '0.' + '0' * len(target.split('.')[1])
        bad['public']['prompt'] = bad['public']['prompt'].replace(target, zero)
        reject(bad)

        bad = copy.deepcopy(problem)
        bad['public']['response']['options'][index]['label'] = '999.999'
        reject(bad)

    # Check zero as an arithmetic boundary, although zero targets are not authored.
    assert rounded(F('0.004'), 2) == 0
    assert rounded(F('0.005'), 2) == F('0.01')
    assert rounded(F('4.675'), 2) == F('4.68')
    assert rounded(F('4.685'), 2) == F('4.69')
    return {'fixtures': len(fixtures), 'rejectedMutations': rejected}

# Read by independent-math-review.py (FamilyOracle).
CHOICE_REVIEW = SUPPORTED



if __name__ == '__main__':
    print(self_test())
