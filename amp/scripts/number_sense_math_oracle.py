"""Independent counting, number-line, rounding and powers-of-ten checks from public givens; no generator imports."""
import re
from fractions import Fraction

NUMBER_SENSE = frozenset({
    'count-sequence-missing', 'hundred-chart-missing', 'numeral-for-quantity',
    'number-line-hops', 'number-line-missing-hop', 'round-to-ten',
    'round-to-hundred', 'round-large', 'multiply-power-of-ten',
    'divide-power-of-ten', 'digit-value-ratio',
})
PLACE_UNITS = {'ten': 10, 'hundred': 100, 'thousand': 1000, 'ten thousand': 10000}
POWERS = {'10': 10, '100': 100, '1,000': 1000, '10¹': 10, '10²': 100, '10³': 1000}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def whole(text):
    require(re.fullmatch(r'\d{1,3}(,\d{3})*', text) is not None, f'Badly written number {text!r}')
    require(len(text) < 4 or ',' in text, f'Missing thousands separator in {text!r}')
    return int(text.replace(',', ''))


def decimal(text):
    m = re.fullmatch(r'([\d,]+)(?:\.(\d+))?', text)
    require(m is not None, f'Badly written decimal {text!r}')
    require(m[2] is None or not m[2].endswith('0'), f'Trailing zero in {text!r}')
    return Fraction(whole(m[1])) + (Fraction(int(m[2]), 10 ** len(m[2])) if m[2] else 0)


def round_half_up(n, unit):
    """Compare the remainder with half the unit: halfway goes up."""
    below = n - n % unit
    return below + unit if 2 * (n % unit) >= unit else below


def solve_number_sense(public):
    name, prompt, figure = public['templateId'], public['prompt'], public.get('figure')
    require(public['response']['kind'] == 'number', 'Numeric response expected')
    if name == 'count-sequence-missing':
        m = re.fullmatch(r'Count by (ones|tens): (.+)\. What number is missing\?', prompt)
        require(m is not None, f'Unexpected count prompt {prompt!r}')
        items = m[2].split(', ')
        require(len(items) == 4 and items.count('□') == 1 and items[0] != '□', 'One missing count after the first')
        step = 1 if m[1] == 'ones' else 10
        first = int(items[0])
        sequence = [first + step * i for i in range(4)]
        require(all(item == '□' or int(item) == value for item, value in zip(items, sequence)), 'Not a counting sequence')
        require(1 <= first and sequence[-1] <= 100, 'Count leaves 1 to 100')
        if step == 10:
            require(first % 10 == 0, 'Counting by tens starts at a ten')
        return sequence[items.index('□')]
    if name == 'hundred-chart-missing':
        require(figure and figure['kind'] == 'hundred-chart', 'Missing chart')
        first, rows, columns = figure['first'], figure['rows'], figure['columns']
        row, column = figure['blank']
        # Rebuild the chart: row r holds 10r + 1 … 10r + 10.
        chart = [[10 * r + c + 1 for c in range(10)] for r in range(10)]
        top, left = divmod(first - 1, 10)
        require(left + columns <= 10 and top + rows <= 10, 'Window leaves the chart')
        require((row, column) != (0, 0), 'Blank needs a visible neighbor')
        return chart[top + row][left + column]
    if name == 'numeral-for-quantity':
        require(figure and figure['kind'] == 'ten-frame' and figure['second'] == 0, 'Missing frames')
        require(prompt == 'How many counters are in the frames? Write the number.', 'Unexpected prompt')
        require((figure['capacity'] == 20) == (figure['first'] > 10), 'Second frame only past ten')
        return figure['first']
    if name == 'number-line-hops':
        m = re.fullmatch(r'Start at (\d+)\. Hop (forward|back) (\d+), then (forward|back) (\d+)\. Where do you land\?', prompt)
        require(m is not None and m[2] == m[4], f'Unexpected hop prompt {prompt!r}')
        start, tens, ones = int(m[1]), int(m[3]), int(m[5])
        require(tens % 10 == 0 and 1 <= ones <= 9, 'A tens hop then an ones hop')
        sign = 1 if m[2] == 'forward' else -1
        require(figure == {'kind': 'hop-line', 'min': figure['min'], 'max': figure['max'], 'start': start,
                           'hops': [{'size': sign * tens, 'label': 'size'}, {'size': sign * ones, 'label': 'size'}],
                           'end': 'hidden'}, 'Figure disagrees with the hops')
        end = start + sign * (tens + ones)
        require(figure['min'] <= min(start, end) and max(start, end) <= figure['max'] <= 100 and figure['min'] >= 0, 'Off the line')
        return end
    if name == 'number-line-missing-hop':
        m = re.fullmatch(r'A hop goes from (\d+) to (\d+)\. How long is the hop\?', prompt)
        require(m is not None, f'Unexpected missing-hop prompt {prompt!r}')
        a, b = int(m[1]), int(m[2])
        require(figure['kind'] == 'hop-line' and figure['start'] == a and figure['end'] == 'shown'
                and figure['hops'] == [{'size': b - a, 'label': '?'}], 'Figure disagrees with the hop')
        return abs(b - a)
    if name in ('round-to-ten', 'round-to-hundred', 'round-large'):
        m = re.fullmatch(r'Round ([\d,]+) to the nearest (ten thousand|ten|hundred|thousand)\.', prompt)
        require(m is not None, f'Unexpected rounding prompt {prompt!r}')
        n, unit = whole(m[1]), PLACE_UNITS[m[2]]
        expected_unit = {'round-to-ten': (10,), 'round-to-hundred': (100,), 'round-large': (100, 1000, 10000)}[name]
        require(unit in expected_unit, 'Wrong rounding place for the family')
        if name == 'round-large':
            require(10000 <= n <= 999999, 'Large rounding uses five or six digits')
        else:
            require(10 <= n <= 999, 'Grade 3 rounding stays below 1,000')
        return round_half_up(n, unit)
    if name in ('multiply-power-of-ten', 'divide-power-of-ten'):
        op = '×' if name == 'multiply-power-of-ten' else '÷'
        m = re.fullmatch(rf'What is ([\d,.]+) {op} (10[¹²³]|1,000|100|10)\?', prompt)
        require(m is not None, f'Unexpected power-of-ten prompt {prompt!r}')
        value, power = decimal(m[1]), POWERS[m[2]]
        result = value * power if op == '×' else value / power
        require((result * 1000).denominator == 1, 'Result beyond thousandths')
        return result
    if name == 'digit-value-ratio':
        m = re.fullmatch(r'In ([\d,]+), the first (\d) is worth how many times as much as the second (\d)\?', prompt)
        require(m is not None and m[2] == m[3], f'Unexpected ratio prompt {prompt!r}')
        digits = str(whole(m[1]))
        positions = [i for i, d in enumerate(digits) if d == m[2]]
        require(len(positions) == 2 and m[2] != '0', 'The digit appears exactly twice')
        return 10 ** (positions[1] - positions[0])
    raise ValueError(f'No number-sense solver for {name}')


def review_number_sense_fixtures():
    require(round_half_up(345, 10) == 350 and round_half_up(344, 10) == 340, 'Halfway rounds up')
    require(round_half_up(396, 10) == 400 and round_half_up(449, 100) == 400, 'Across a hundred, no double rounding')
    require(round_half_up(999700, 1000) == 1000000, 'Carry past the last place')
    require(decimal('0.547') == Fraction(547, 1000) and decimal('7,100') == 7100, 'Decimal parser')
    for bad in ('0.50', '7100', '1,00'):
        try:
            decimal(bad)
        except ValueError:
            continue
        raise ValueError(f'Accepted {bad!r}')
    chart = {'templateId': 'hundred-chart-missing', 'prompt': '', 'response': {'kind': 'number'},
             'figure': {'kind': 'hundred-chart', 'first': 8, 'rows': 3, 'columns': 3, 'blank': [1, 0]}}
    require(solve_number_sense(chart) == 18, 'Chart fixture')


class NumberSenseCorpus:
    """Hard cases must occur: halfway, across a hundred, zeros, decimals."""

    def __init__(self):
        self.seen = {}

    def record(self, public, solved):
        name, prompt = public['templateId'], public['prompt']
        tags = self.seen.setdefault(name, set())
        if name.startswith('round'):
            m = re.search(r'Round ([\d,]+) to the nearest (.+)\.', prompt)
            n, unit = whole(m[1]), PLACE_UNITS[m[2]]
            if 2 * (n % unit) == unit:
                tags.add('halfway')
            if n % unit == 0:
                tags.add('already-round')
            if solved % (10 * unit) == 0 and n // (10 * unit) != solved // (10 * unit):
                tags.add('carries')
            if name != 'round-to-ten' and n % unit < unit // 2 and (n % unit) % (unit // 10) >= unit // 20 and (n % unit) // (unit // 10) == 4:
                tags.add('no-double-rounding')
            tags.add(f'unit-{unit}')
        elif name == 'count-sequence-missing':
            tags.add('tens' if 'tens' in prompt else 'ones')
            numbers = [int(x) for x in re.findall(r'\d+', prompt)]
            if 'ones' in prompt and len({n // 10 for n in numbers + [solved]}) > 1:
                tags.add('crosses-ten')
        elif name in ('multiply-power-of-ten', 'divide-power-of-ten'):
            tags.add('decimal' if Fraction(solved).denominator != 1 or '.' in prompt else 'whole')
            tags.add('exponent' if re.search('[¹²³]', prompt) else 'plain')
        elif name == 'digit-value-ratio':
            tags.add(f'ratio-{solved}')
        elif name == 'numeral-for-quantity':
            n = public['figure']['first']
            tags.add('zero' if n == 0 else 'teen' if n > 10 else 'small')
        elif name in ('number-line-hops', 'number-line-missing-hop'):
            hops = public['figure']['hops']
            tags.add('forward' if hops[0]['size'] > 0 else 'back')
        else:
            tags.add('seen')

    def finish(self):
        required = {
            'round-to-ten': {'halfway', 'already-round', 'carries'},
            'round-to-hundred': {'halfway', 'already-round', 'carries', 'no-double-rounding'},
            'round-large': {'halfway', 'carries', 'no-double-rounding', 'unit-100', 'unit-1000', 'unit-10000'},
            'count-sequence-missing': {'tens', 'ones', 'crosses-ten'},
            'multiply-power-of-ten': {'decimal', 'whole', 'exponent', 'plain'},
            'divide-power-of-ten': {'decimal', 'whole', 'exponent', 'plain'},
            'digit-value-ratio': {'ratio-10', 'ratio-100', 'ratio-1000'},
            'numeral-for-quantity': {'zero', 'teen', 'small'},
            'number-line-hops': {'forward', 'back'},
            'number-line-missing-hop': {'forward', 'back'},
        }
        for name, tags in required.items():
            missing = tags - self.seen.get(name, set())
            require(not missing, f'{name} never reaches {sorted(missing)}')
        return {name: sorted(tags) for name, tags in sorted(self.seen.items())}
