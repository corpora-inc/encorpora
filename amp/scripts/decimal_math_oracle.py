"""Independent decimal oracle: grids, number lines, place value, comparison,
rounding and multidigit operations derived only from the public prompt and
figure. It never reads a generated answer or explanation."""
import re
from fractions import Fraction

DECIMAL = frozenset({
    'decimal-grid-read', 'tenths-as-hundredths', 'decimal-line-point',
    'compare-decimals-hundredths', 'decimal-digit-value', 'expanded-decimal',
    'compare-decimals-thousandths', 'round-decimal',
    'multidigit-decimal-sum', 'multidigit-decimal-product', 'multidigit-decimal-quotient',
})
NUMBER = r'(\d+(?:\.\d+)?)'
PLACES = {'whole number': 0, 'tenth': 1, 'hundredth': 2}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def match(pattern, text):
    found = re.fullmatch(pattern, text)
    require(found is not None, f'Unrecognized decimal wording: {text!r}')
    return found.groups()


def value(text):
    require(re.fullmatch(r'\d+(\.\d+)?', text) is not None, f'Not a decimal: {text!r}')
    whole, _, digits = text.partition('.')
    return Fraction(int(whole + digits), 10 ** len(digits))


def places(text):
    return len(text.partition('.')[2])


def round_half_up(x, p):
    unit = Fraction(1, 10 ** p)
    low = (x // unit) * unit
    return low + unit if x - low >= unit / 2 else low


def compare(public, max_places):
    ask, a, b = match(r'Which is (greater|less): ' + NUMBER + ' or ' + NUMBER + r'\? Enter that decimal\.', public['prompt'])
    require(a != b and value(a) != value(b), 'Comparison needs unequal decimals')
    require(max(places(a), places(b)) <= max_places, 'Too many decimal places')
    figure = public.get('figure')
    require(figure and figure['kind'] == 'place-value-chart' and figure['places'] == max_places, 'Chart figure')
    written = [f"{r['ones']}.{r['decimals']}" for r in figure['rows']]
    require(written == [a, b], 'Chart rows must be the prompt decimals in order')
    return max(value(a), value(b)) if ask == 'greater' else min(value(a), value(b))


def solve_decimal(public):
    template, prompt = public['templateId'], public['prompt']
    figure = public.get('figure')
    if template == 'decimal-grid-read':
        require(figure and figure['kind'] == 'decimal-grid', 'Grid figure')
        if figure['unit'] == 'tenths':
            require(prompt.startswith('The strip is one whole, cut into 10 equal parts.'), 'Tenths wording')
            require(1 <= figure['shaded'] <= 9, 'Shaded tenths')
            return Fraction(figure['shaded'], 10)
        require(prompt.startswith('The large square is one whole, cut into 100 equal squares.'), 'Hundredths wording')
        require(1 <= figure['shaded'] <= 99, 'Shaded hundredths')
        return Fraction(figure['shaded'], 100)
    if template == 'tenths-as-hundredths':
        found = re.fullmatch(r'(\d)/10 \+ (\d)/100 = □/100\. What number belongs in the box\?', prompt)
        if found:
            return (Fraction(int(found[1]), 10) + Fraction(int(found[2]), 100)) * 100
        found = re.fullmatch(r'(0\.\d) = □/100\. What number belongs in the box\?', prompt)
        if found:
            return value(found[1]) * 100
        a, b = match(r'What is (\d)/10 \+ (\d)/100 written as a decimal\?', prompt)
        return Fraction(int(a), 10) + Fraction(int(b), 100)
    if template == 'decimal-line-point':
        require(prompt == 'What decimal is at point P?', 'Number-line wording')
        require(figure and figure['kind'] == 'decimal-line', 'Number-line figure')
        require(1 <= figure['point'] <= 9, 'P lies strictly inside the line')
        return Fraction(figure['start'] + figure['point'], figure['denominator'])
    if template == 'compare-decimals-hundredths':
        return compare(public, 2)
    if template == 'compare-decimals-thousandths':
        return compare(public, 3)
    if template == 'decimal-digit-value':
        number, digit = match(r'In (\d\.\d{3}), what is the value of the digit (\d)\?', prompt)
        require(number.count(digit) == 1, 'The digit must name one place')
        position = number.index(digit)
        require(position > 1, 'Asked digit lies after the point')
        return Fraction(int(digit), 10 ** (position - 1))
    if template == 'expanded-decimal':
        (terms,) = match(r'What decimal is (.+)\?', prompt)
        total, seen = Fraction(0), []
        for term in terms.split(' + '):
            d, unit = match(r'(\d) × (1|1/10|1/100|1/1000)', term)
            require(unit not in seen, 'Each place appears once')
            seen.append(unit)
            total += int(d) * Fraction(unit)
        require(seen == sorted(seen, key=lambda u: Fraction(u), reverse=True), 'Places in order')
        return total
    if template == 'round-decimal':
        number, target = match(r'Round ' + NUMBER + r' to the nearest (whole number|tenth|hundredth)\.', prompt)
        p = PLACES[target]
        require(places(number) > p, 'Already rounded')
        return round_half_up(value(number), p)
    if template == 'multidigit-decimal-sum':
        a, op, b = match(NUMBER.join(['What is ', r' ([+−]) ', r'\?']), prompt)
        result = value(a) + value(b) if op == '+' else value(a) - value(b)
        require(result > 0, 'Differences stay positive')
        return result
    if template == 'multidigit-decimal-product':
        a, b = match(NUMBER.join(['What is ', ' × ', r'\?']), prompt)
        return value(a) * value(b)
    if template == 'multidigit-decimal-quotient':
        a, b = match(NUMBER.join(['What is ', ' ÷ ', r'\?']), prompt)
        require('.' in b, 'The divisor is a decimal')
        q = value(a) / value(b)
        d = q.denominator
        for prime in (2, 5):
            while d % prime == 0:
                d //= prime
        require(d == 1, 'Quotient must terminate')
        return q
    raise ValueError(f'Unknown decimal family {template}')


class DecimalCorpus:
    """Comparison items must include pairs that defeat 'more digits is more'."""

    def __init__(self):
        self.shorter_greater = 0
        self.comparisons = 0

    def record(self, public, solved):
        if not public['templateId'].startswith('compare-decimals'):
            return
        _, a, b = match(r'Which is (greater|less): ' + NUMBER + ' or ' + NUMBER + r'\? Enter that decimal\.', public['prompt'])
        self.comparisons += 1
        big, small = (a, b) if value(a) > value(b) else (b, a)
        if places(big) < places(small):
            self.shorter_greater += 1

    def finish(self):
        require(self.comparisons == 0 or self.shorter_greater * 5 >= self.comparisons,
                'At least a fifth of comparisons must have the shorter decimal greater')
        return {'comparisons': self.comparisons, 'shorterGreater': self.shorter_greater}


def review_decimal_fixtures():
    """Hand-built cases with known answers."""
    chart = lambda rows, p: {'kind': 'place-value-chart', 'places': p, 'rows': rows}
    cases = [
        ({'templateId': 'decimal-grid-read', 'prompt': 'The large square is one whole, cut into 100 equal squares. What decimal names the shaded part?',
          'figure': {'kind': 'decimal-grid', 'unit': 'hundredths', 'shaded': 47}}, Fraction(47, 100)),
        ({'templateId': 'tenths-as-hundredths', 'prompt': '3/10 + 5/100 = □/100. What number belongs in the box?'}, 35),
        ({'templateId': 'decimal-line-point', 'prompt': 'What decimal is at point P?',
          'figure': {'kind': 'decimal-line', 'denominator': 100, 'start': 230, 'point': 7}}, Fraction(237, 100)),
        ({'templateId': 'compare-decimals-hundredths', 'prompt': 'Which is greater: 0.45 or 0.5? Enter that decimal.',
          'figure': chart([{'ones': 0, 'decimals': '45'}, {'ones': 0, 'decimals': '5'}], 2)}, Fraction(1, 2)),
        ({'templateId': 'compare-decimals-thousandths', 'prompt': 'Which is less: 0.3 or 0.299? Enter that decimal.',
          'figure': chart([{'ones': 0, 'decimals': '3'}, {'ones': 0, 'decimals': '299'}], 3)}, Fraction(299, 1000)),
        ({'templateId': 'decimal-digit-value', 'prompt': 'In 3.615, what is the value of the digit 1?'}, Fraction(1, 100)),
        ({'templateId': 'expanded-decimal', 'prompt': 'What decimal is 3 × 1 + 6 × 1/10 + 8 × 1/1000?'}, Fraction(3608, 1000)),
        ({'templateId': 'round-decimal', 'prompt': 'Round 2.35 to the nearest tenth.'}, Fraction(24, 10)),
        ({'templateId': 'round-decimal', 'prompt': 'Round 9.6 to the nearest whole number.'}, 10),
        ({'templateId': 'multidigit-decimal-sum', 'prompt': 'What is 12.5 − 3.75?'}, Fraction(875, 100)),
        ({'templateId': 'multidigit-decimal-product', 'prompt': 'What is 1.2 × 0.35?'}, Fraction(42, 100)),
        ({'templateId': 'multidigit-decimal-quotient', 'prompt': 'What is 0.84 ÷ 0.02?'}, 42),
    ]
    for public, expected in cases:
        require(solve_decimal(public) == expected, f'Decimal fixture {public["prompt"]!r}')
    rejected = [
        {'templateId': 'decimal-digit-value', 'prompt': 'In 3.313, what is the value of the digit 3?'},
        {'templateId': 'compare-decimals-hundredths', 'prompt': 'Which is greater: 0.5 or 0.50? Enter that decimal.',
         'figure': chart([{'ones': 0, 'decimals': '5'}, {'ones': 0, 'decimals': '50'}], 2)},
        {'templateId': 'compare-decimals-hundredths', 'prompt': 'Which is greater: 0.5 or 0.45? Enter that decimal.',
         'figure': chart([{'ones': 0, 'decimals': '45'}, {'ones': 0, 'decimals': '5'}], 2)},
        {'templateId': 'multidigit-decimal-quotient', 'prompt': 'What is 1 ÷ 0.3?'},
        {'templateId': 'round-decimal', 'prompt': 'Round 2.3 to the nearest tenth.'},
    ]
    for public in rejected:
        try:
            solve_decimal(public)
        except ValueError:
            continue
        raise ValueError(f'Decimal oracle must reject {public["prompt"]!r}')
