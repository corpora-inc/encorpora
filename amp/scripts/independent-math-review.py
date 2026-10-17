#!/usr/bin/env python3
"""Independent prompt-based exact oracle. Read export-math-cases.ts JSONL on stdin."""
import json
import math
import re
import sys
from collections import Counter
from fractions import Fraction

# Add an independently derived solver here before adding a generated family.
SUPPORTED = frozenset({
    'count-objects', 'add-within-20', 'subtract-within-20', 'multiply-facts',
    'fraction-model', 'add-fractions', 'rectangle-area', 'linear-equation',
    'mean-data', 'right-triangle', 'quadratic-vertex', 'geometric-sequence',
    'logarithm-integer', 'divide-facts', 'place-value-digit', 'decimal-addition',
    'compare-fractions', 'multiply-fractions', 'divide-fractions', 'ratio-missing',
    'percent-of', 'integer-addition', 'integer-power', 'line-slope',
    'linear-system-x', 'simple-probability', 'arithmetic-term',
    'function-evaluation', 'unit-price', 'decimal-multiplication', 'operation-order',
})


def require(condition, message):
    # Do not use assert: python -O must not disable review gates.
    if not condition:
        raise ValueError(message)


def solve(public):
    """Only public prompt/figure givens enter this function, never generated answers."""
    template = public['templateId']
    prompt = public['prompt']
    numbers = [int(value) for value in re.findall(r'-?[0-9]+', prompt)]
    figure = public.get('figure')
    f = Fraction
    if template == 'count-objects':
        require(figure['kind'] == 'collection' and 1 <= figure['count'] <= 10, 'Invalid counting representation')
        return figure['count']
    if template == 'add-within-20':
        require(len(numbers) == 2 and min(numbers) >= 0 and sum(numbers) <= 20, 'Addition bounds')
        return sum(numbers)
    if template == 'subtract-within-20':
        a, b = numbers
        require(0 <= b <= a <= 20, 'Subtraction bounds')
        return a - b
    if template == 'multiply-facts':
        a, b = numbers
        return a * b
    if template == 'fraction-model':
        require(figure['kind'] == 'fraction' and 0 < figure['selected'] < figure['parts'], 'Invalid fraction representation')
        return f(figure['selected'], figure['parts'])
    if template in {'add-fractions', 'compare-fractions', 'multiply-fractions', 'divide-fractions'}:
        a, b, c, d = numbers
        left, right = f(a, b), f(c, d)
        if template == 'add-fractions':
            return left + right
        if template == 'compare-fractions':
            require(left != right, 'Comparison must have a unique larger fraction')
            return max(left, right)
        if template == 'multiply-fractions':
            return left * right
        return left / right
    if template == 'rectangle-area':
        width, height = numbers
        require(figure == {'kind': 'rectangle', 'width': width, 'height': height, 'unit': 'cm'}, 'Rectangle prompt/figure mismatch')
        return width * height
    if template == 'linear-equation':
        coefficient, constant, total = numbers
        return f(total - constant, coefficient)
    if template == 'mean-data':
        require(figure == {'kind': 'dataset', 'values': numbers} and len(numbers) == 5, 'Dataset mismatch')
        return f(sum(numbers), len(numbers))
    if template == 'right-triangle':
        a, b = numbers
        require(figure == {'kind': 'right-triangle', 'a': a, 'b': b, 'unit': 'cm'}, 'Triangle prompt/figure mismatch')
        square = a*a + b*b
        root = math.isqrt(square)
        require(root*root == square, 'Integer-root family produced an irrational result')
        return root
    if template == 'quadratic-vertex':
        coefficient, vertex_x, vertex_y = numbers
        require(coefficient > 0 and 'For real x' in prompt, 'Minimum requires positive coefficient and real domain')
        return vertex_y
    if template == 'geometric-sequence':
        first, ratio, term, first_label = numbers
        require(first_label == 1, 'Unsupported sequence indexing')
        result = first
        for _ in range(term - 1):
            result *= ratio
        return result
    if template == 'logarithm-integer':
        base, argument = numbers
        require(base > 1 and argument > 0, 'Invalid logarithm domain')
        value, exponent = 1, 0
        while value < argument:
            value *= base
            exponent += 1
        require(value == argument, 'Integer logarithm family produced a noninteger result')
        return exponent
    if template == 'divide-facts':
        dividend, divisor = numbers
        return f(dividend, divisor)
    if template == 'place-value-digit':
        number, = numbers
        positions = [place for place in ('ones', 'tens', 'hundreds') if place in prompt]
        require(len(positions) == 1, 'Ambiguous digit position')
        place = ('ones', 'tens', 'hundreds').index(positions[0])
        return number // 10**place % 10 * 10**place
    if template in {'decimal-addition', 'decimal-multiplication'}:
        left, right = [f(value) for value in re.findall(r'[0-9]+\.[0-9]+', prompt)]
        return left + right if template == 'decimal-addition' else left * right
    if template == 'ratio-missing':
        blue, white, target_white = numbers
        return f(blue * target_white, white)
    if template == 'percent-of':
        percent, whole = numbers
        return f(percent * whole, 100)
    if template == 'integer-addition':
        left, right = numbers
        return left + right
    if template == 'integer-power':
        base, exponent = numbers
        return base ** exponent
    if template == 'line-slope':
        x1, y1, x2, y2 = numbers
        return f(y2-y1, x2-x1)
    if template == 'linear-system-x':
        a, b, e, c, d, total = numbers
        # Cramer's rule, distinct from generated elimination explanations.
        return f(e*d-b*total, a*d-b*c)
    if template == 'simple-probability':
        red, blue = numbers
        return f(red, red+blue)
    if template == 'arithmetic-term':
        first, difference, term, first_label = numbers
        require(first_label == 1, 'Unsupported sequence indexing')
        result = first
        for _ in range(term - 1):
            result += difference
        return result
    if template == 'function-evaluation':
        a, b, c, x = numbers
        return a*x*x + b*x + c
    if template == 'unit-price':
        quantity, cost, target = numbers
        return f(cost*target, quantity)
    if template == 'operation-order':
        a, b, c, d = numbers
        return a + (b+c)*d
    raise ValueError(f'No independent solver for {template}')


def review(stream):
    first_line = next(stream, None)
    require(first_line is not None, 'Missing manifest')
    manifest = json.loads(first_line)
    require(manifest.get('kind') == 'manifest' and manifest.get('format') == 1, 'Unsupported manifest')
    ids = manifest['templates']
    require(isinstance(ids, list) and all(isinstance(item, str) for item in ids), 'Invalid template inventory')
    require(len(ids) == len(set(ids)) and set(ids) == SUPPORTED,
            f'Oracle inventory mismatch; unknown={set(ids)-SUPPORTED}, missing={SUPPORTED-set(ids)}')
    start, count = manifest['seedStart'], manifest['seedCount']
    require(type(start) is int and type(count) is int and start >= 0 and count >= 256, 'Require at least 256 seeds per family')
    seen, counts = set(), Counter()
    for line_number, line in enumerate(stream, 2):
        require(line.strip(), f'Empty record at line {line_number}')
        record = json.loads(line)
        require(record.get('kind') == 'case', f'Unexpected record at line {line_number}')
        problem = record['problem']
        public = problem['public']
        template, seed = public['templateId'], public['seed']
        require(template in SUPPORTED, f'Unknown family {template}')
        match = re.fullmatch(r'independent-(0|[1-9][0-9]*)', seed)
        require(match is not None, f'Invalid seed {seed}')
        index = int(match[1])
        require(start <= index < start + count, f'Seed outside declared range: {seed}')
        identity = (template, seed)
        require(identity not in seen, f'Duplicate case {identity}')
        seen.add(identity)
        expected = Fraction(solve(public))
        # Generated answer is used only as the value under test, never as an oracle input.
        actual = Fraction(problem['answer'])
        require(actual == expected, f'Mismatch {template}/{seed}: {public["prompt"]!r}; got {actual}, expected {expected}')
        counts[template] += 1
    require(all(counts[template] == count for template in SUPPORTED), f'Incomplete coverage: {dict(counts)}')
    return {'cases': sum(counts.values()), 'families': len(counts), 'seedsPerFamily': count,
            'seedStart': start, 'mismatches': 0}


if __name__ == '__main__':
    try:
        print(json.dumps(review(iter(sys.stdin))))
    except (ValueError, KeyError, TypeError, ZeroDivisionError, OverflowError) as error:
        print(f'Independent math review failed: {error}', file=sys.stderr)
        sys.exit(1)
