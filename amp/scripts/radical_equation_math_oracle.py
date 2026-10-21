"""Independent exact solutions from displayed radical equations only.

Squaring supplies candidates, never acceptance: the original right side must
be nonnegative and its square must equal the original nonnegative radicand.
"""
import copy
import re
from fractions import Fraction as Q
from rational_expression_math_oracle import polynomial, multiply, add, roots, require
from rational_equation_math_oracle import number

RADICAL_EQUATION_CHOICE = frozenset({'radical-equation-check'})
RADICAL_EQUATION = RADICAL_EQUATION_CHOICE | {'radical-equation-isolated', 'radical-equation-shifted'}


def value(p, x):
    return sum(coefficient * x ** i for i, coefficient in enumerate(p))


def solution(public):
    template = public['templateId']
    require(template in RADICAL_EQUATION, 'Unknown radical-equation template')
    suffix = (' over the real numbers. Which statement describes all solutions?' if template in RADICAL_EQUATION_CHOICE
              else ' for $x$ over the real numbers.')
    require(public['prompt'].startswith('Solve $') and public['prompt'].endswith('$' + suffix), 'Unknown radical-equation prompt')
    equation = public['prompt'][7:-(len(suffix) + 1)]
    match = re.fullmatch(r'\\sqrt\{([^{}]+)\}(?:\s*([+−-])\s*(\d+))? = (.+)', equation)
    require(match is not None, 'Unreadable radical equation')
    radicand = polynomial(match[1])
    require(len(radicand) == 2 and radicand[1] != 0, 'Expected nonconstant linear radicand')
    offset = Q(int(match[3])) * (-1 if match[2] in ('−', '-') else 1) if match[3] else Q(0)
    if template in RADICAL_EQUATION_CHOICE:
        require(match[2] is None, 'Checking family must have isolated radical')
        right = polynomial(match[4])
        require(len(right) == 2 and right[1] == 1, 'Expected monic linear right side')
        squared = add(multiply(right, right), radicand, -1)
        candidates = roots(squared)
        require(len(candidates) == 2 and all(x.denominator == 1 for x in candidates), 'Expected two distinct integer squared candidates')
    else:
        if template == 'radical-equation-isolated':
            require(match[2] is None, 'Unexpected shifted isolated equation')
        else:
            require(match[2] is not None and int(match[3]) > 0, 'Shifted equation needs nonzero shift')
        rhs = number(match[4])
        require(rhs.denominator == 1 and rhs - offset >= 0, 'Expected integer right side and nonnegative isolated radical')
        right = [rhs - offset]
        candidates = {(right[0] ** 2 - radicand[0]) / radicand[1]}
    return {x for x in candidates if value(radicand, x) >= 0
            and value(right, x) >= 0 and value(right, x) ** 2 == value(radicand, x)}


def choice_values(label):
    if label == 'There are no real solutions.': return set()
    parts = label.split(' or ')
    require(1 <= len(parts) <= 2, 'Unknown solution-set choice')
    values = []
    for part in parts:
        match = re.fullmatch(r'\$x = ([^$]+)\$', part)
        require(match is not None, 'Unreadable solution choice')
        values.append(number(match[1]))
    require(len(values) == len(set(values)), 'Repeated solution in option')
    return set(values)


def solve_radical_equation(public):
    solutions = solution(public)
    response = public['response']
    if public['templateId'] not in RADICAL_EQUATION_CHOICE:
        require(response['kind'] in ('number', 'fraction') and len(solutions) == 1, 'Expected unique exact response')
        return str(next(iter(solutions)))
    require(response['kind'] == 'choice', 'Expected choice response')
    options = response['options']
    require(len(options) == 4 and len({o['id'] for o in options}) == 4, 'Expected four unique option IDs')
    correct = [o['id'] for o in options if choice_values(o['label']) == solutions]
    require(len(correct) == 1, 'Missing or ambiguous radical solution set')
    return correct[0]


def review_radical_equation_problem(problem):
    answer = solve_radical_equation(problem['public'])
    if problem['public']['templateId'] in RADICAL_EQUATION_CHOICE:
        require(problem['answer'] == answer, 'Incorrect radical-equation choice')
    else:
        require(Q(problem['answer']) == Q(answer), 'Incorrect radical-equation number')
    return answer


def review_radical_equation_fixtures():
    def numeric(kind, expression, answer):
        return {'public': {'templateId': 'radical-equation-' + kind,
                           'prompt': f'Solve ${expression}$ for $x$ over the real numbers.',
                           'response': {'kind': 'fraction'}}, 'answer': answer}
    def checked(expression, p, q, correct):
        labels = [f'$x = {p}$ or $x = {q}$', f'$x = {p}$', f'$x = {q}$', 'There are no real solutions.']
        return {'public': {'templateId': 'radical-equation-check',
                           'prompt': f'Solve ${expression}$ over the real numbers. Which statement describes all solutions?',
                           'response': {'kind': 'choice', 'options': [{'id': str(i), 'label': label} for i, label in enumerate(labels)]}}, 'answer': str(correct)}
    cases = [
        numeric('isolated', r'\sqrt{2x+1} = 0', '-1/2'),
        numeric('isolated', r'\sqrt{-3x+1} = 2', '-1'),
        numeric('shifted', r'\sqrt{3x-2} + 4 = 7', '11/3'),
        numeric('shifted', r'\sqrt{-2x+6} − 5 = -5', '3'),
        checked(r'\sqrt{2x+3} = x', -1, 3, 2),
        checked(r'\sqrt{5x-4} = x', 1, 4, 0),
        checked(r'\sqrt{-5x-4} = x', -4, -1, 3),
        checked(r'\sqrt{x} = x', 0, 1, 0),
        checked(r'\sqrt{-x-2} = x+2', -3, -2, 2),
    ]
    rejected = 0
    def reject(case):
        nonlocal rejected
        try: review_radical_equation_problem(case)
        except (ValueError, ZeroDivisionError):
            rejected += 1
            return
        raise ValueError('Oracle accepted corrupt radical-equation fixture')
    for case in cases:
        review_radical_equation_problem(case)
        bad = copy.deepcopy(case)
        bad['answer'] = str((int(case['answer']) + 1) % 4) if case['public']['templateId'] in RADICAL_EQUATION_CHOICE else str(Q(case['answer']) + 1)
        reject(bad)
        if case['public']['templateId'] in RADICAL_EQUATION_CHOICE:
            options = case['public']['response']['options']
            correct = next(o for o in options if o['id'] == case['answer'])
            bad = copy.deepcopy(case); next(o for o in bad['public']['response']['options'] if o['id'] != case['answer'])['label'] = correct['label']; reject(bad)
            bad = copy.deepcopy(case); bad['public']['response']['options'] = [o for o in options if o['id'] != case['answer']]; reject(bad)
    reject(numeric('isolated', r'\sqrt{2x+1} = -1', '0'))
    reject(numeric('shifted', r'\sqrt{x} + 3 = 2', '1'))
    return {'fixtures': len(cases), 'rejectedMutations': rejected}


if __name__ == '__main__':
    import json
    print(json.dumps(review_radical_equation_fixtures()))
