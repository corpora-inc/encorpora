"""Independent oracle for complex clause items that are not single-choice.

Answers are recomputed from the public prompt and the displayed options.
"""

import json
import re

from complex_conics_math_oracle import num

SUPPORTED = frozenset({
    'complex-modulus-via-conjugate',
    'complex-axis-number-plot',
})
CHOICE_REVIEW = SUPPORTED
REVIEW_RETURNS_ANSWER = False


def require(condition, message):
    if not condition:
        raise ValueError(message)


def plain(text):
    return text.replace('$', '').replace('\\,', '').replace(' ', '')


def solve(public):
    template = public['templateId']
    if template == 'complex-modulus-via-conjugate':
        return solve_modulus(public)
    if template == 'complex-axis-number-plot':
        return solve_plot(public)
    raise ValueError(f'Unexpected template {template}')


def solve_modulus(public):
    prompt = public['prompt']
    match = re.search(r'Let \$z=(.+?)\$', prompt)
    require(match is not None, 'Modulus prompt')
    z = num(match[1])
    real, imag = z.parts()
    require(not real.is_zero() and not imag.is_zero(), 'A zero part hides the conjugate')
    product = z * z.conj()
    require(product.real() and product.rational() > 0, 'Product must be a positive real')
    root = product.rational()
    # Integer square root when it is a square; otherwise the displayed simplest radical.
    s = 0
    while s * s < root:
        s += 1
    modulus = num(str(s)) if s * s == root else _radical(int(root))
    response = public['response']
    require(response['kind'] == 'multi-part-choice', 'Three-part choice required')
    blanks = response['blanks']
    require([b['id'] for b in blanks] == ['conj', 'prod', 'mod'], 'Blank order')
    expected = {
        'conj': z.conj(),
        'prod': product,
        'mod': modulus,
    }
    key = {}
    for blank in blanks:
        labels = [o['label'] for o in blank['options']]
        require(len(labels) == len(set(plain(label) for label in labels)) >= 2, 'Options must be distinct')
        hits = []
        for option in blank['options']:
            # An unevaluated i^2, or an i left on a length, is not the evaluated answer.
            if blank['id'] != 'conj' and 'i' in plain(option['label']):
                continue
            try:
                value = num(option['label'])
            except ValueError:
                continue
            if value == expected[blank['id']]:
                hits.append(option['id'])
        require(len(hits) == 1, f'Missing key for {blank["id"]}')
        key[blank['id']] = hits[0]
    return json.dumps(key, separators=(',', ':'))


def _radical(n):
    from complex_conics_math_oracle import Num
    return Num.sqrt_int(n)


def _same(left, right):
    return left == right


def solve_plot(public):
    match = re.search(r'Plot \$(.+?)\$', public['prompt'])
    require(match is not None, 'Plot prompt')
    z = num(match[1])
    real, imag = z.parts()
    require(real.is_rational() and imag.is_rational(), 'Axis numbers are integers')
    a, b = int(real.rational()), int(imag.rational())
    require((a == 0) ^ (b == 0), 'Plot a real or pure imaginary number')
    require(a != 0 or b != 0, 'Zero is not an axis item')
    response = public['response']
    require(response['kind'] == 'point-plot', 'Point plot required')
    require(response['pointCount'] == 1 and response['ordered'] is False, 'One unordered point')
    grid = response['grid']
    require(grid['xMin'] <= a <= grid['xMax'] and grid['yMin'] <= b <= grid['yMax'], 'Point off the grid')
    text = ' '.join(public.get('explanation', []))
    # The generator's explanation is private; the public prompt must not name the coordinate pair.
    require(f'({a}, {b})' not in public['prompt'] and f'({a},{b})' not in public['prompt'], 'Prompt gives the point')
    return json.dumps([[a, b]], separators=(',', ':'))


def review_problem(problem):
    public = problem['public']
    expected = solve(public)
    require(expected == problem['answer'], 'Clause item answer mismatch')
    if public['templateId'] == 'complex-modulus-via-conjugate':
        hint = problem.get('hint', '')
        require(not re.search(r'\d', hint), 'Modulus hint contains a digit')
        joined = '\n'.join(problem.get('explanation', []))
        require('z\\bar z=|z|^2' in joined, 'Explanation misses the square of the length')
    if public['templateId'] == 'complex-axis-number-plot':
        joined = '\n'.join(problem.get('explanation', []))
        require('tan' not in joined.lower(), 'Axis explanation mentions tan')
    return expected


def self_test():
    modulus = {
        'templateId': 'complex-modulus-via-conjugate',
        'prompt': r'Let $z=5 - 12i$. (a) Write $\bar z$. (b) Compute $z\bar z$. (c) Use the result to find $|z|$.',
        'response': {
            'kind': 'multi-part-choice',
            'blanks': [
                {'id': 'conj', 'options': [
                    {'id': 'b', 'label': '$5 + 12i$'},
                    {'id': 'a', 'label': '$-5 - 12i$'},
                    {'id': 'c', 'label': '$-5 + 12i$'},
                ]},
                {'id': 'prod', 'options': [
                    {'id': 'a', 'label': '$169$'},
                    {'id': 'b', 'label': '$-119$'},
                    {'id': 'c', 'label': '$25-144i^2$'},
                ]},
                {'id': 'mod', 'options': [
                    {'id': 'c', 'label': '$13$'},
                    {'id': 'a', 'label': '$169$'},
                    {'id': 'b', 'label': '$13\\,i$'},
                    {'id': 'd', 'label': '$17$'},
                ]},
            ],
        },
    }
    modulus_answer = solve(modulus)
    require(modulus_answer == '{"conj":"b","prod":"a","mod":"c"}', modulus_answer)
    radical = {
        'templateId': 'complex-modulus-via-conjugate',
        'prompt': r'Let $z=2 - 4i$. (a) Write $\bar z$. (b) Compute $z\bar z$. (c) Use the result to find $|z|$.',
        'response': {
            'kind': 'multi-part-choice',
            'blanks': [
                {'id': 'conj', 'options': [
                    {'id': 'a', 'label': '$2 + 4i$'},
                    {'id': 'b', 'label': '$-2 - 4i$'},
                    {'id': 'c', 'label': '$-2 + 4i$'},
                ]},
                {'id': 'prod', 'options': [
                    {'id': 'b', 'label': '$20$'},
                    {'id': 'a', 'label': '$-12$'},
                    {'id': 'c', 'label': '$4-16i^2$'},
                ]},
                {'id': 'mod', 'options': [
                    {'id': 'd', 'label': '$2\\sqrt{5}$'},
                    {'id': 'a', 'label': '$20$'},
                    {'id': 'b', 'label': '$2\\sqrt{5}\\,i$'},
                    {'id': 'c', 'label': '$6$'},
                ]},
            ],
        },
    }
    radical_answer = solve(radical)
    require(radical_answer == '{"conj":"a","prod":"b","mod":"d"}', radical_answer)
    plot = {
        'templateId': 'complex-axis-number-plot',
        'prompt': r'Plot $-3i$ on the complex plane. Across is the real part and up is the imaginary part.',
        'response': {
            'kind': 'point-plot',
            'pointCount': 1,
            'ordered': False,
            'grid': {'xMin': -10, 'xMax': 10, 'yMin': -10, 'yMax': 10},
        },
    }
    require(solve(plot) == '[[0,-3]]', solve(plot))
    problem = {
        'public': modulus,
        'answer': modulus_answer,
        'hint': 'Flip only the imaginary sign.',
        'explanation': ['For any complex number $z$, $z\\bar z=|z|^2$, so the length follows.'],
    }
    review_problem(problem)
    return {'fixtures': 3}


if __name__ == '__main__':
    print(self_test())
