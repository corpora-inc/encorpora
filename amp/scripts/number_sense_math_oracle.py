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


def number_line(figure):
    require(figure and figure['kind'] == 'scene', 'Missing number line')
    lines = [e for e in figure['scene']['elements'] if e['type'] == 'numberLine']
    require(len(lines) == 1, 'One number line')
    return lines[0]


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
        require(figure and figure['kind'] == 'scene', 'Missing chart')
        elements = figure['scene']['elements']
        squares = [e for e in elements if e['type'] == 'rect']
        numbers = {(e['at'][0] - 0.5, e['at'][1] - 0.5): int(e['text']) for e in elements if e['type'] == 'text'}
        blanks = [e for e in squares if e.get('id') == 'blank']
        require(len(blanks) == 1 and len(numbers) == len(squares) - 1, 'One empty square, every other numbered')
        require(all(tuple(e['size']) == (1, 1) for e in squares), 'Unit squares')
        # The visible numbers must be a window of the hundred chart: right is +1, down (y − 1) is +10.
        (x0, y0), v0 = next(iter(numbers.items()))
        def chart(x, y):
            return v0 + int(x - x0) - 10 * int(y - y0)
        require(all(v == chart(x, y) for (x, y), v in numbers.items()), 'Not a hundred-chart window')
        require(all(1 <= v <= 100 for v in numbers.values()), 'Inside 1 to 100')
        xs = [x for x, _ in numbers] + [blanks[0]['at'][0]]
        decade = lambda v: (v - 1) // 10
        require(all(decade(chart(min(xs), y)) == decade(chart(max(xs), y)) for _, y in numbers), 'A row stays in one decade')
        bx, by = blanks[0]['at']
        require((bx - 1, by) in numbers or (bx, by + 1) in numbers, 'Blank needs a visible neighbor')
        return chart(bx, by)
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
        line = number_line(figure)
        hops = [(h['from'], h['by'], h.get('landing')) for h in line['hops']]
        require(hops == [(start, sign * tens, 'none'), (start + sign * tens, sign * ones, 'derived')], 'Figure disagrees with the hops')
        end = start + sign * (tens + ones)
        require(all(m['at'] != end for m in line.get('marks', [])), 'The landing is not marked')
        require(all(v % 10 == 0 for v in line['labels']), 'Only tens are labeled')
        require(line['min'] <= min(start, end) and max(start, end) <= line['max'] <= 100 and line['min'] >= 0, 'Off the line')
        return end
    if name == 'number-line-missing-hop':
        m = re.fullmatch(r'A hop goes from (\d+) to (\d+)\. How long is the hop\?', prompt)
        require(m is not None, f'Unexpected missing-hop prompt {prompt!r}')
        a, b = int(m[1]), int(m[2])
        line = number_line(figure)
        require([(h['from'], h['by'], h.get('label')) for h in line['hops']] == [(a, b - a, '?')], 'Figure disagrees with the hop')
        require(sorted(m['at'] for m in line['marks']) == sorted([a, b]), 'Both ends are marked')
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
    # 8 9 10 / [ ] 19 20 / 28 29 30: the blank is 18.
    cells = [(c, 2 - r, 8 + 10 * r + c) for r in range(3) for c in range(3)]
    elements = [{'type': 'rect', 'id': 'blank' if (x, y) == (0, 1) else 'c', 'at': [x, y], 'size': [1, 1]} for x, y, _ in cells]
    elements += [{'type': 'text', 'at': [x + 0.5, y + 0.5], 'text': str(v)} for x, y, v in cells if (x, y) != (0, 1)]
    chart = {'templateId': 'hundred-chart-missing', 'prompt': '', 'response': {'kind': 'number'},
             'figure': {'kind': 'scene', 'scene': {'v': 1, 'elements': elements}}}
    require(solve_number_sense(chart) == 18, 'Chart fixture')
    # A window that wraps a decade (9 10 / 11 12 drawn side by side) is not the chart.
    wrapped = [dict(e) for e in elements]
    for e in wrapped:
        if e['type'] == 'text' and e['text'] == '10':
            e['text'] = '11'
    try:
        solve_number_sense({**chart, 'figure': {'kind': 'scene', 'scene': {'v': 1, 'elements': wrapped}}})
    except ValueError:
        pass
    else:
        raise ValueError('Accepted a window that is not the hundred chart')


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
            hops = number_line(public['figure'])['hops']
            tags.add('forward' if hops[0]['by'] > 0 else 'back')
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
