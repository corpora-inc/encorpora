"""Independent multiplication and division checks from public givens; no generator imports."""
import re

MULTIPLY_DIVIDE = frozenset({
    'multiply-by-tens', 'multiply-by-one-digit', 'area-model-product',
    'multiply-multidigit', 'divide-by-one-digit', 'division-remainder',
    'divide-by-two-digit',
})
NUMBER = r'(\d{1,3}(?:,\d{3})*)'


def require(condition, message):
    if not condition:
        raise ValueError(message)


def whole(text):
    require(re.fullmatch(r'\d{1,3}(,\d{3})*', text) is not None, f'Badly written number {text!r}')
    require(len(text) < 4 or ',' in text, f'Missing thousands separator in {text!r}')
    return int(text.replace(',', ''))


def product_prompt(prompt):
    m = re.fullmatch(rf'What is {NUMBER} × {NUMBER}\?', prompt)
    require(m is not None, f'Unexpected product prompt {prompt!r}')
    return whole(m[1]), whole(m[2])


def long_divide(n, d):
    """Schoolbook division digit by digit, independent of Python's divmod."""
    q, rest = 0, 0
    for digit in str(n):
        rest = rest * 10 + int(digit)
        k = 0
        while (k + 1) * d <= rest:
            k += 1
        q, rest = q * 10 + k, rest - k * d
    return q, rest


def solve_multiply_divide(public):
    name, prompt, figure = public['templateId'], public['prompt'], public.get('figure')
    if name != 'area-model-product':
        require(figure is None, 'Unexpected figure')
    if name == 'multiply-by-tens':
        a, b = product_prompt(prompt)
        one, ten = sorted((a, b))
        require(2 <= one <= 9 and ten % 10 == 0 and 10 <= ten <= 90, 'Not one digit times tens')
        return a * b
    if name == 'multiply-by-one-digit':
        a, b = product_prompt(prompt)
        require(10 <= a <= 9999 and 2 <= b <= 9, 'Factor sizes')
        return a * b
    if name == 'area-model-product':
        m = re.fullmatch(r'The area model splits (\d+) × (\d+) by place value\. What is \1 × \2\?', prompt)
        require(m is not None, f'Unexpected area prompt {prompt!r}')
        a, b = int(m[1]), int(m[2])
        require(figure and figure['kind'] == 'area-model', 'Missing area model')
        for parts, n in ((figure['columns'], a), (figure['rows'], b)):
            require(sum(parts) == n, 'Parts do not make the factor')
            require(parts == sorted(parts, reverse=True) and all(re.fullmatch(r'[1-9]0*', str(p)) for p in parts), 'Not place-value parts')
            require(len(parts) == len([c for c in str(n) if c != '0']), 'A place is missing')
        # Sum of region areas: the area model itself, not the factors.
        return sum(x * y for x in figure['columns'] for y in figure['rows'])
    if name == 'multiply-multidigit':
        a, b = product_prompt(prompt)
        require(10 <= a <= 999 and 10 <= b <= 99, 'Factor sizes')
        return a * b
    if name in ('divide-by-one-digit', 'divide-by-two-digit'):
        m = re.fullmatch(rf'What is {NUMBER} ÷ (\d+)\?', prompt)
        require(m is not None, f'Unexpected quotient prompt {prompt!r}')
        n, d = whole(m[1]), int(m[2])
        low, high = (2, 9) if name == 'divide-by-one-digit' else (11, 99)
        require(low <= d <= high and n <= 9999, 'Divisor or dividend size')
        q, rest = long_divide(n, d)
        require(rest == 0, 'Exact quotient expected')
        return q
    if name == 'division-remainder':
        m = re.fullmatch(rf'What is the remainder when {NUMBER} is divided by (\d)\?', prompt)
        require(m is not None, f'Unexpected remainder prompt {prompt!r}')
        n, d = whole(m[1]), int(m[2])
        q, rest = long_divide(n, d)
        require(rest > 0 and q > 0, 'A remainder item needs a nonzero quotient and remainder')
        return rest
    raise ValueError(f'No multiply-divide solver for {name}')


def review_multiply_divide_fixtures():
    require(long_divide(1476, 6) == (246, 0) and long_divide(1830, 6) == (305, 0), 'Long division fixture')
    require(long_divide(389, 4) == (97, 1), 'Remainder fixture')
    area = {'templateId': 'area-model-product', 'prompt': 'The area model splits 46 × 23 by place value. What is 46 × 23?',
            'figure': {'kind': 'area-model', 'columns': [40, 6], 'rows': [20, 3]}}
    require(solve_multiply_divide(area) == 1058, 'Area model fixture')
    bad = dict(area, figure={'kind': 'area-model', 'columns': [40, 6], 'rows': [10, 13]})
    try:
        solve_multiply_divide(bad)
    except ValueError:
        return
    raise ValueError('Accepted a split that is not by place value')


class MultiplyDivideCorpus:
    """Each family must reach its hard cases."""

    def __init__(self):
        self.seen = {}

    def record(self, public, solved):
        name, prompt = public['templateId'], public['prompt']
        tags = self.seen.setdefault(name, set())
        numbers = [whole(n) for n in re.findall(r'\d[\d,]*\d|\d', prompt)]
        if name == 'multiply-by-tens':
            a, b = numbers
            tags.add('tens-first' if a % 10 == 0 else 'digit-first')
            if (min(a, b) * (max(a, b) // 10)) % 10 == 0:
                tags.add('fact-ends-in-zero')
        elif name in ('multiply-by-one-digit', 'multiply-multidigit'):
            a, b = numbers
            tags.add(f'{len(str(a))}x{len(str(b))}')
            if '0' in str(a) or '0' in str(b):
                tags.add('zero-factor')
            if name == 'multiply-by-one-digit':
                carries = sum(1 for c in str(a) if int(c) * b >= 10)
                if carries >= 2:
                    tags.add('several-regroupings')
        elif name == 'area-model-product':
            tags.add('area')
        elif name in ('divide-by-one-digit', 'divide-by-two-digit'):
            n, d = numbers
            tags.add(f'quotient-{len(str(solved))}')
            if '0' in str(solved):
                tags.add('zero-in-quotient')
            if int(str(n)[0]) < d:
                tags.add('leading-digit-short')
        elif name == 'division-remainder':
            n, d = numbers
            tags.add('largest-remainder' if solved == d - 1 else 'remainder')
            q, _ = long_divide(n, d)
            if '0' in str(q):
                tags.add('zero-in-quotient')

    def finish(self):
        required = {
            'multiply-by-tens': {'tens-first', 'digit-first', 'fact-ends-in-zero'},
            'multiply-by-one-digit': {'2x1', '3x1', '4x1', 'zero-factor', 'several-regroupings'},
            'area-model-product': {'area'},
            'multiply-multidigit': {'2x2', '3x2', 'zero-factor'},
            'divide-by-one-digit': {'quotient-2', 'quotient-3', 'zero-in-quotient', 'leading-digit-short'},
            'division-remainder': {'largest-remainder', 'remainder', 'zero-in-quotient'},
            'divide-by-two-digit': {'quotient-2', 'quotient-3', 'zero-in-quotient', 'leading-digit-short'},
        }
        for name, tags in required.items():
            missing = tags - self.seen.get(name, set())
            require(not missing, f'{name} never reaches {sorted(missing)}')
        return {name: len(tags) for name, tags in sorted(self.seen.items())}
