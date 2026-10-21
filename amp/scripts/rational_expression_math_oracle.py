"""Public-prompt rational-expression oracle using exact polynomial identities.

Authored independently of the generator. Domain comes from original denominator
roots; equivalence is a cross-product polynomial identity, not sampled values.
"""
import ast
import copy
import re
from fractions import Fraction as Q
from math import isqrt

from algebra_one_expr import parse, require

RATIONAL_EXPRESSION = frozenset({'rational-expression-domain', 'rational-expression-simplify'})


def trim(p):
    while len(p) > 1 and p[-1] == 0:
        p.pop()
    return p


def add(p, q, sign=1):
    return trim([(p[i] if i < len(p) else Q(0)) + sign * (q[i] if i < len(q) else Q(0))
                 for i in range(max(len(p), len(q)))])


def multiply(p, q):
    result = [Q(0)] * (len(p) + len(q) - 1)
    for i, a in enumerate(p):
        for j, b in enumerate(q):
            result[i + j] += a * b
    return trim(result)


def polynomial(text):
    text = text.replace('\\left', '').replace('\\right', '').replace('\\cdot', '*')
    text = re.sub(r'\^\{([012])\}', r'^\1', text)

    def read(node):
        if isinstance(node, ast.Constant) and type(node.value) is int:
            return [Q(node.value)]
        if isinstance(node, ast.Name) and node.id == 'x':
            return [Q(0), Q(1)]
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub)):
            return [a * (-1 if isinstance(node.op, ast.USub) else 1) for a in read(node.operand)]
        if isinstance(node, ast.BinOp):
            if isinstance(node.op, ast.Pow):
                require(isinstance(node.right, ast.Constant) and type(node.right.value) is int and 0 <= node.right.value <= 2, 'Unsupported polynomial power')
                result = [Q(1)]
                for _ in range(node.right.value):
                    result = multiply(result, read(node.left))
                return result
            left, right = read(node.left), read(node.right)
            if isinstance(node.op, ast.Add): return add(left, right)
            if isinstance(node.op, ast.Sub): return add(left, right, -1)
            if isinstance(node.op, ast.Mult): return multiply(left, right)
        raise ValueError('Unsupported polynomial expression')

    return trim(read(parse(text)))


def fraction(text):
    match = re.fullmatch(r'\\(?:dfrac|frac)\{(.+)\}\{(.+)\}', text.strip())
    require(match is not None, 'Expected displayed rational expression')
    numerator, denominator = polynomial(match[1]), polynomial(match[2])
    require(denominator != [0], 'Zero denominator polynomial')
    return numerator, denominator


def roots(p):
    require(len(p) <= 3 and p != [0], 'Unsupported denominator polynomial')
    if len(p) == 1: return set()
    if len(p) == 2: return {-p[0] / p[1]}
    C, B, A = p
    D = B * B - 4 * A * C
    if D < 0: return set()
    n, d = isqrt(D.numerator), isqrt(D.denominator)
    require(n * n == D.numerator and d * d == D.denominator, 'Expected exact rational denominator roots')
    return {(-B - Q(n, d)) / (2 * A), (-B + Q(n, d)) / (2 * A)}


def exclusions(text):
    text = text.strip().replace('−', '-').replace('\\left', '').replace('\\right', '')
    match = re.fullmatch(r'\$\\\{\s*([+-]?\d+(?:\s*,\s*[+-]?\d+)*)\s*\\\}\$', text)
    require(match is not None, 'Expected integer exclusion set')
    values = [Q(s.strip()) for s in match[1].split(',')]
    require(len(values) == len(set(values)), 'Duplicate exclusion values')
    return set(values)


def solve_rational_expression(public):
    template = public['templateId']
    require(template in RATIONAL_EXPRESSION, 'Unknown rational expression template')
    domain = template == 'rational-expression-domain'
    pattern = (r'For the expression \$(.+)\$, which real values of \$x\$ are excluded from its domain\?' if domain
               else r'Simplify \$(.+)\$ and retain every exclusion from the original expression\.')
    match = re.fullmatch(pattern, public['prompt'])
    require(match is not None, 'Unrecognized rational-expression prompt')
    numerator, denominator = fraction(match[1])
    require(len(denominator) == 3, 'Expected quadratic original denominator')
    excluded = roots(denominator)
    require(bool(excluded), 'Expected real excluded values')
    response = public['response']
    require(response['kind'] == 'choice', 'Expected choice response')
    options = response['options']
    require(len({o['id'] for o in options}) == len(options), 'Duplicate option identifiers')
    correct = []
    for option in options:
        label = option['label']
        if domain:
            valid = exclusions(label) == excluded
        else:
            candidate = re.fullmatch(r'\$(.+)\$; excluded values: (.+)', label)
            require(candidate is not None, 'Unrecognized simplify choice')
            top, bottom = fraction(candidate[1])
            valid = (len(top) <= 2 and len(bottom) <= 2
                     and exclusions(candidate[2]) == excluded
                     and roots(bottom) <= excluded
                     and multiply(numerator, bottom) == multiply(top, denominator))
        if valid: correct.append(option['id'])
    require(len(correct) == 1, f'Expected exactly one correct rational-expression option, found {len(correct)}')
    return correct[0]


def review_rational_expression_problem(generated):
    answer = solve_rational_expression(generated['public'])
    require(generated['answer'] == answer, 'Incorrect rational-expression answer')
    return answer


def review_rational_expression_fixtures():
    def item(template, fraction_text, labels, answer='a'):
        question = (f'For the expression ${fraction_text}$, which real values of $x$ are excluded from its domain?' if template.endswith('domain')
                    else f'Simplify ${fraction_text}$ and retain every exclusion from the original expression.')
        return {'public': {'templateId': template, 'prompt': question,
                          'response': {'kind': 'choice', 'options': [{'id': chr(97+i), 'label': label} for i, label in enumerate(labels)]}}, 'answer': answer}

    cases = [
        item('rational-expression-domain', r'\dfrac{5}{x(x+2)}', [r'$\{0, -2\}$', r'$\{0, 2\}$', r'$\{-2\}$']),
        item('rational-expression-domain', r'\dfrac{(x-3)(-2x+1)}{(x-3)(x-3)}', [r'$\{3\}$', r'$\{-3\}$', r'$\{0, 3\}$']),
        item('rational-expression-domain', r'\dfrac{-3x}{x^2}', [r'$\{0\}$', r'$\{3\}$', r'$\{-3\}$']),
        item('rational-expression-simplify', r'\dfrac{-2x^2+4x}{x^2+x}', [r'$\dfrac{-2x+4}{x+1}$; excluded values: $\{0, -1\}$', r'$\dfrac{-2x+4}{x+1}$; excluded values: $\{-1\}$', r'$\dfrac{x+1}{-2x+4}$; excluded values: $\{0, -1, 2\}$']),
        item('rational-expression-simplify', r'\dfrac{x^2-4x+3}{x^2+x-2}', [r'$\dfrac{x-3}{x+2}$; excluded values: $\{1, -2\}$', r'$\dfrac{x-3}{x+2}$; excluded values: $\{-2\}$', r'$\dfrac{x+3}{x+2}$; excluded values: $\{1, -2\}$']),
    ]
    rejected = 0
    def reject(case):
        nonlocal rejected
        try: review_rational_expression_problem(case)
        except ValueError:
            rejected += 1
            return
        raise ValueError('Oracle accepted corrupted rational-expression fixture')
    for case in cases:
        review_rational_expression_problem(case)
        bad = copy.deepcopy(case); bad['answer'] = 'b'; reject(bad)
        bad = copy.deepcopy(case); bad['public']['response']['options'][1]['label'] = bad['public']['response']['options'][0]['label']; reject(bad)
        bad = copy.deepcopy(case); bad['public']['response']['options'].pop(0); reject(bad)
    # Equivalent-looking cancellation must not remove an original hole.
    bad = copy.deepcopy(cases[-1]); bad['public']['response']['options'][0]['label'] = r'$\dfrac{x-3}{x+2}$; excluded values: $\{-2\}$'; reject(bad)
    require(polynomial(r'-2(x-1)(x+3)') == [Q(6), Q(-4), Q(-2)], 'Factored polynomial parser fixture')
    require(roots(polynomial('(x+2)^2')) == {Q(-2)}, 'Repeated root parser fixture')
    return {'fixtures': len(cases), 'rejectedMutations': rejected}


if __name__ == '__main__':
    import json
    print(json.dumps(review_rational_expression_fixtures()))
