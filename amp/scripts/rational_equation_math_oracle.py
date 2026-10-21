"""Independent public-text oracle for linear rational equations.

Clear the denominator as an exact polynomial identity, then intersect the
candidate solution set with the original domain. No generator state is read.
"""
import copy
import re
from fractions import Fraction as Q

from rational_expression_math_oracle import fraction, add, roots, require

RATIONAL_EQUATION_CHOICE = frozenset({'rational-equation-check'})
RATIONAL_EQUATION = RATIONAL_EQUATION_CHOICE | {'rational-equation-one-denominator'}


def number(text):
    text = text.strip().replace('−', '-').replace(' ', '')
    if re.fullmatch(r'[+-]?\d+', text):
        return Q(text)
    match = re.fullmatch(r'([+-]?)\\(?:dfrac|tfrac|frac)\{([+-]?\d+)\}\{([+-]?\d+)\}', text)
    require(match is not None and int(match[3]) != 0, 'Unreadable or undefined rational value')
    return (-1 if match[1] == '-' else 1) * Q(int(match[2]), int(match[3]))


def solution(public):
    template = public['templateId']
    require(template in RATIONAL_EQUATION, 'Unknown rational-equation template')
    suffix = (' for \\$x\\$\\.' if template not in RATIONAL_EQUATION_CHOICE
              else ' over the real numbers\\. Which statement describes all solutions\\?')
    match = re.fullmatch(r'Solve \$(.+) = ([^$]+)\$' + suffix, public['prompt'])
    require(match is not None, 'Unrecognized rational-equation prompt')
    numerator, denominator = fraction(match[1])
    require(len(denominator) == 2 and len(numerator) <= 2, 'Expected linear denominator and at most linear numerator')
    rhs = number(match[2])
    require(rhs != 0, 'Expected nonzero right side')
    excluded = roots(denominator)
    reduced = add(numerator, [rhs * coefficient for coefficient in denominator], -1)
    if reduced == [0]:
        return 'domain', excluded, None
    if len(reduced) == 1:
        return 'empty', excluded, None
    candidate = -reduced[0] / reduced[1]
    if candidate in excluded:
        return 'empty', excluded, None
    return 'single', excluded, candidate


def solve_rational_equation(public):
    kind, excluded, candidate = solution(public)
    response = public['response']
    if public['templateId'] not in RATIONAL_EQUATION_CHOICE:
        require(response['kind'] in ('fraction', 'number') and kind == 'single', 'Expected unique numeric solution')
        return str(candidate)
    require(response['kind'] == 'choice', 'Expected choice response')
    options = response['options']
    require(len({o['id'] for o in options}) == len(options), 'Duplicate choice identifiers')
    correct = []
    for option in options:
        label = option['label']
        point = re.fullmatch(r'\$x = ([^$]+)\$', label)
        domain = re.fullmatch(r'Every real number with \$x \\ne ([^$]+)\$ is a solution\.', label)
        if point:
            valid = kind == 'single' and number(point[1]) == candidate
        elif domain:
            valid = kind == 'domain' and {number(domain[1])} == excluded
        elif label == 'There are no real solutions.':
            valid = kind == 'empty'
        elif label == 'Every real number is a solution.':
            # A missing original exclusion can never be correct here.
            valid = False
        else:
            raise ValueError('Unrecognized rational-equation choice')
        if valid:
            correct.append(option['id'])
    require(len(correct) == 1, f'Expected exactly one correct rational-equation choice, found {len(correct)}')
    return correct[0]


def review_rational_equation_problem(generated):
    answer = solve_rational_equation(generated['public'])
    if generated['public']['templateId'] in RATIONAL_EQUATION_CHOICE:
        require(generated['answer'] == answer, 'Incorrect rational-equation choice')
    else:
        require(Q(generated['answer']) == Q(answer), 'Incorrect rational-equation numeric answer')
    return answer


def review_rational_equation_fixtures():
    def numeric(expression, rhs, answer):
        return {'public': {'templateId': 'rational-equation-one-denominator',
                           'prompt': f'Solve ${expression} = {rhs}$ for $x$.',
                           'response': {'kind': 'fraction'}}, 'answer': answer}

    def choice(expression, rhs, labels, answer='a'):
        return {'public': {'templateId': 'rational-equation-check',
                           'prompt': f'Solve ${expression} = {rhs}$ over the real numbers. Which statement describes all solutions?',
                           'response': {'kind': 'choice', 'options': [{'id': chr(97+i), 'label': label} for i, label in enumerate(labels)]}}, 'answer': answer}

    cases = [
        numeric(r'\dfrac{3}{x-2}', '2', '7/2'),
        numeric(r'\dfrac{-3}{x+2}', '2', '-7/2'),
        numeric(r'\dfrac{5}{x}', '-2', '-5/2'),
        numeric(r'\dfrac{6}{x+3}', '2', '0'),
        choice(r'\dfrac{2x+1}{x-2}', '4', [r'$x = \frac{9}{2}$', '$x = 2$', 'There are no real solutions.', r'Every real number with $x \ne 2$ is a solution.']),
        choice(r'\dfrac{0}{x-2}', '3', ['There are no real solutions.', '$x = 2$', '$x = 0$', r'Every real number with $x \ne 2$ is a solution.']),
        choice(r'\dfrac{-2x-4}{x+2}', '-2', [r'Every real number with $x \ne -2$ is a solution.', 'There are no real solutions.', '$x = -2$', '$x = 0$']),
        choice(r'\dfrac{2x+1}{x}', '2', ['There are no real solutions.', '$x = 0$', '$x = 1$', r'Every real number with $x \ne 0$ is a solution.']),
        choice(r'\dfrac{2x-4}{x-2}', '3', ['There are no real solutions.', '$x = 2$', '$x = 0$', r'Every real number with $x \ne 2$ is a solution.']),
    ]
    rejected = 0
    def reject(case):
        nonlocal rejected
        try:
            review_rational_equation_problem(case)
        except (ValueError, ZeroDivisionError):
            rejected += 1
            return
        raise ValueError('Oracle accepted corrupted rational-equation fixture')

    for case in cases:
        review_rational_equation_problem(case)
        bad = copy.deepcopy(case)
        bad['answer'] = 'b' if case['public']['response']['kind'] == 'choice' else str(Q(case['answer']) + 1)
        reject(bad)
    for case in cases[4:]:
        bad = copy.deepcopy(case); bad['public']['response']['options'][1]['label'] = bad['public']['response']['options'][0]['label']; reject(bad)
        bad = copy.deepcopy(case); bad['public']['response']['options'].pop(0); reject(bad)
    bad = copy.deepcopy(cases[6]); bad['public']['response']['options'][0]['label'] = 'Every real number is a solution.'; reject(bad)
    bad = copy.deepcopy(cases[6]); bad['public']['response']['options'][0]['label'] = r'Every real number with $x \ne 2$ is a solution.'; reject(bad)
    reject(numeric(r'\dfrac{1}{0}', '2', '0'))
    require(number(r'-\frac{3}{2}') == Q(-3, 2), 'External fraction sign fixture')
    require(number(r'\dfrac{-3}{2}') == Q(-3, 2), 'Internal fraction sign fixture')
    return {'fixtures': len(cases), 'rejectedMutations': rejected}


if __name__ == '__main__':
    import json
    print(json.dumps(review_rational_equation_fixtures()))
