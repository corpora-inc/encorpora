#!/usr/bin/env python3
"""Independent prompt-based exact oracle. Read export-math-cases.ts JSONL on stdin."""
import json
import math
import re
import sys
from collections import Counter
from fractions import Fraction
from elementary_math_oracle import ELEMENTARY, solve_elementary
from equal_groups_math_oracle import EQUAL_GROUPS, solve_equal_groups
from fraction_math_oracle import FRACTION_PRACTICE, solve_fraction_practice
from choice_math_oracle import CHOICE, solve_choice
from measurement_math_oracle import SUPPORTED as MEASUREMENT, solve as solve_measurement, self_test as review_measurement_fixtures
from algebra_math_oracle import ALGEBRA, ALGEBRA_CHOICE, solve_algebra, review_algebra_fixtures
from quadratic_math_oracle import QUADRATIC, QUADRATIC_CHOICE, solve_quadratic, review_quadratic_fixtures
from polynomial_math_oracle import POLYNOMIAL, solve_polynomial, review_polynomial_fixtures, PolynomialShortcutReview
from print_math_oracle import review_print_math

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
    'coordinate-point-reading', 'graphed-line-slope', 'bar-chart-total',
    'bar-chart-difference', 'clock-elapsed-minutes', 'number-line-distance',
})
SUPPORTED = SUPPORTED | ELEMENTARY | FRACTION_PRACTICE | CHOICE | EQUAL_GROUPS | ALGEBRA | MEASUREMENT | QUADRATIC | POLYNOMIAL


def require(condition, message):
    # Do not use assert: python -O must not disable review gates.
    if not condition:
        raise ValueError(message)


def solve(public):
    """Only public prompt/figure givens enter this function, never generated answers."""
    template = public['templateId']
    if template in POLYNOMIAL:
        return solve_polynomial(public)
    if template in QUADRATIC:
        return solve_quadratic(public)
    if template in MEASUREMENT:
        return solve_measurement(public)
    if template in ALGEBRA:
        return solve_algebra(public)
    if template in CHOICE:
        return solve_choice(public)
    if template in EQUAL_GROUPS:
        return solve_equal_groups(public)
    if template in FRACTION_PRACTICE:
        return solve_fraction_practice(public)
    if template in ELEMENTARY:
        return solve_elementary(public)
    prompt = public['prompt']
    # Standard notation omits a coefficient of 1 ("x + 5y", "−x²"); restore it
    # for terms inside equations and expressions before reading the givens.
    prompt = re.sub(r'([:;=+−-]\s*)([xy])(?=²|\s*[+=−-]|\s*$)', r'\g<1>1\2', prompt)
    numbers = [int(value) for value in re.findall(r'-?[0-9]+', prompt)]
    figure = public.get('figure')
    f = Fraction
    if template in {'coordinate-point-reading', 'graphed-line-slope'}:
        require(figure['kind'] == 'coordinate-plane', 'Wrong coordinate representation')
        require(figure['xMin'] < figure['xMax'] and figure['yMin'] < figure['yMax'], 'Invalid coordinate bounds')
        points = figure['points']
        require(all(figure['xMin'] <= point['x'] <= figure['xMax'] and
                    figure['yMin'] <= point['y'] <= figure['yMax'] and
                    type(point['x']) is int and type(point['y']) is int for point in points),
                'Coordinates must be visible integer grid points')
        if template == 'coordinate-point-reading':
            require(len(points) == 1 and points[0]['label'] == 'P', 'Expected one point P')
            requested = re.search(r'What is the ([xy])-coordinate of point P', prompt)
            require(requested is not None, 'Ambiguous requested coordinate')
            return points[0][requested[1]]
        require(len(points) == 2 and [point['label'] for point in points] == ['A', 'B'], 'Expected points A and B')
        left, right = points
        slope = f(right['y']-left['y'], right['x']-left['x'])
        lines = figure['lines']
        require(len(lines) == 1, 'Expected a single line')
        line = lines[0]
        # Rendering uses floating coefficients; grading remains an exact rational.
        require(math.isfinite(line['m']) and math.isfinite(line['b']) and
                math.isclose(line['m'], float(slope), rel_tol=0, abs_tol=1e-12), 'Line slope contradicts points')
        require(all(math.isclose(line['m']*point['x']+line['b'], point['y'], rel_tol=0, abs_tol=1e-12)
                    for point in points), 'Drawn line does not pass through marked points')
        return slope
    if template in {'bar-chart-total', 'bar-chart-difference'}:
        require(figure['kind'] == 'bar-chart' and figure['valueLabel'] == 'Trees', 'Wrong chart representation')
        categories, values = figure['categories'], figure['values']
        require(len(categories) == len(values) == 3 and len(set(categories)) == 3 and
                all(type(value) is int and value >= 0 for value in values), 'Invalid category counts')
        counts = dict(zip(categories, values))
        if template == 'bar-chart-total':
            return sum(values)
        requested = re.search(r'How many more (\w+) trees than (\w+) trees', prompt)
        require(requested is not None and requested[1] in counts and requested[2] in counts, 'Unknown named category')
        difference = counts[requested[1]] - counts[requested[2]]
        require(difference > 0, 'More-than prompt names the wrong larger category')
        return difference
    if template == 'clock-elapsed-minutes':
        require(figure['kind'] == 'clock' and 1 <= figure['hour'] <= 12 and
                0 <= figure['minute'] < 60, 'Invalid clock')
        end_time = re.search(r'ends at ([0-9]+):([0-9]{2}) later that same morning', prompt)
        require(end_time is not None, 'Missing same-morning ending time')
        hour, minute = map(int, end_time.groups())
        require(1 <= hour < 12 and 0 <= minute < 60, 'Ending time outside morning')
        elapsed = hour*60 + minute - (figure['hour']*60 + figure['minute'])
        require(0 < elapsed <= 120, 'Duration outside supported bounds')
        return elapsed
    if template == 'number-line-distance':
        require(figure['kind'] == 'number-line' and figure['min'] < figure['max'], 'Invalid number line')
        left, right = figure['points']
        require(all(type(point) is int and figure['min'] <= point <= figure['max'] for point in (left, right)),
                'Marked points must be visible integer ticks')
        require(left != right, 'Distance question needs distinct points')
        return abs(right-left)
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
    review_algebra_fixtures()
    review_measurement_fixtures()
    review_quadratic_fixtures()
    review_polynomial_fixtures()
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
    polynomial_shortcuts = PolynomialShortcutReview()
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
        solved = solve(public)
        if template in POLYNOMIAL:
            polynomial_shortcuts.record(public, solved)
        # Generated answer is used only as the value under test, never as an oracle input.
        if template in CHOICE | ALGEBRA_CHOICE | QUADRATIC_CHOICE | POLYNOMIAL or (template in MEASUREMENT and public["response"]["kind"] == "choice"):
            expected = solved
            actual = problem['answer']
            require(isinstance(actual, str), 'Choice answer must be an option ID')
        else:
            expected = Fraction(solved)
            actual = Fraction(problem['answer'])
        require(actual == expected, f'Mismatch {template}/{seed}: {public["prompt"]!r}; got {actual}, expected {expected}')
        counts[template] += 1
    require(all(counts[template] == count for template in SUPPORTED), f'Incomplete coverage: {dict(counts)}')
    print('Known polynomial choice shortcuts: ' + json.dumps(polynomial_shortcuts.finish(count)), file=sys.stderr)
    print('Independent print notation review: ' + json.dumps(review_print_math()), file=sys.stderr)
    return {'cases': sum(counts.values()), 'families': len(counts), 'seedsPerFamily': count,
            'seedStart': start, 'mismatches': 0}


if __name__ == '__main__':
    try:
        print(json.dumps(review(iter(sys.stdin))))
    except (ValueError, KeyError, TypeError, ZeroDivisionError, OverflowError) as error:
        print(f'Independent math review failed: {error}', file=sys.stderr)
        sys.exit(1)
