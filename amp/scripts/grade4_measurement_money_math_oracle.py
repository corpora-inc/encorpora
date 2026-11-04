"""Independent review of grade-4 measurement and money templates.

Answers are recomputed from the public prompt, the clock or table or number
line or money figure, and the choice labels. The generator's own solver is
not used. Choice and multi-part keys are compared as exact strings.
"""
import copy
import json
import math
import re
from fractions import Fraction

SUPPORTED = frozenset({
    'elapsed-time-intervals',
    'conversion-table-slots',
    'unit-rename-larger',
    'measurement-line-fraction-story',
    'measuring-tool-choice',
    'decimal-sum-difference',
    'money-decimal-story',
    'money-model-decimal',
})

# Exact string compare. conversion-table-slots returns JSON, not a number.
CHOICE_REVIEW = frozenset({
    'elapsed-time-intervals',
    'conversion-table-slots',
    'measuring-tool-choice',
})

LINE_DENOMS = frozenset({2, 3, 4, 5, 6, 8, 10, 12})
DUR = r'(?:\d+ hours?(?: \d+ minutes?)?|\d+ minutes?)'
TWO = re.compile(
    r'The clock shows when the (\w+) starts, in the (morning|afternoon)\. '
    r'The \1 takes (' + DUR + r')\. Then the (\w+) takes (' + DUR + r')\. '
    r'What time does the \4 end\?'
)
ONE = re.compile(
    r'The clock shows when the (\w+) starts, in the (morning|afternoon)\. '
    r'The \1 lasts (' + DUR + r')\. What time does the \1 end\?'
)
TABLE_FACTOR = {
    ('feet', 'inches'): 12,
    ('kilograms', 'grams'): 1000,
    ('hours', 'minutes'): 60,
    ('liters', 'milliliters'): 1000,
}
RENAME_FACTOR = {
    ('inches', 'feet'): 12,
    ('feet', 'yards'): 3,
    ('ounces', 'pounds'): 16,
    ('cups', 'quarts'): 4,
    ('quarts', 'gallons'): 4,
    ('minutes', 'hours'): 60,
    ('centimeters', 'meters'): 100,
    ('millimeters', 'centimeters'): 10,
    ('grams', 'kilograms'): 1000,
    ('meters', 'kilometers'): 1000,
    ('milliliters', 'liters'): 1000,
}
TOOL_PHRASES = (
    ('length of a book', 'ruler'),
    ('compare the mass of a rock with known masses', 'balance'),
    ('temperature of the room', 'thermometer'),
    ('juice in a pitcher', 'measuring cup'),
    ('weight of a person in pounds', 'scale'),
)
MONEY_CENTS = {
    'five': 500,
    'dollar': 100,
    'quarter': 25,
    'dime': 10,
    'nickel': 5,
    'penny': 1,
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def field(obj, key):
    if not isinstance(obj, dict) or key not in obj:
        raise ValueError(f'Missing {key}')
    return obj[key]


def parse_duration(text):
    match = re.fullmatch(r'(\d+) hours?(?: (\d+) minutes?)?|(\d+) minutes?', text)
    require(match is not None, f'Bad duration {text!r}')
    if match[1]:
        total = int(match[1]) * 60 + (int(match[2]) if match[2] else 0)
    else:
        total = int(match[3])
    require(total > 0, 'Zero duration')
    return total


def format_time(mins):
    wrapped = mins % 1440
    h24 = wrapped // 60
    minute = wrapped % 60
    h12 = 12 if h24 % 12 == 0 else h24 % 12
    meridian = 'a.m.' if h24 < 12 else 'p.m.'
    return f'{h12}:{minute:02d} {meridian}'


def start_minutes(period, hour, minute):
    require(isinstance(hour, int) and 1 <= hour <= 12, 'Bad clock hour')
    require(isinstance(minute, int) and 0 <= minute <= 59, 'Bad clock minute')
    if period == 'morning':
        require(hour != 12, 'A morning clock is not 12')
        return hour * 60 + minute
    hour24 = 12 if hour == 12 else hour + 12
    return hour24 * 60 + minute


def choice_id(public, label):
    response = field(public, 'response')
    require(field(response, 'kind') == 'choice', 'Choice response expected')
    options = field(response, 'options')
    require(len({o['id'] for o in options}) == len(options), 'Duplicate option ids')
    hits = [o['id'] for o in options if o['label'] == label]
    require(len(hits) == 1, f'Need exactly one option {label!r}')
    return hits[0]


def cents_of(text):
    match = re.fullmatch(r'(\d+)\.(\d{1,2})', text)
    require(match is not None, f'Bad decimal {text!r}')
    frac = match[2]
    return int(match[1]) * 100 + int(frac) * (10 if len(frac) == 1 else 1)


def dollars_of(cents):
    require(isinstance(cents, int) and cents >= 0, 'Negative money')
    return f'{cents // 100}.{cents % 100:02d}'


def fewest_coins(cents):
    require(0 < cents < 100, 'Fewest coins stay under one dollar')
    best = [0] + [10 ** 9] * cents
    for coin in (1, 5, 10, 25):
        for amount in range(coin, cents + 1):
            best[amount] = min(best[amount], best[amount - coin] + 1)
    require(best[cents] < 10 ** 9, 'No coin combination')
    return best[cents]


def solve_elapsed(public):
    text = field(public, 'prompt')
    two = TWO.fullmatch(text)
    one = ONE.fullmatch(text)
    require((two is None) != (one is None), 'Unrecognized elapsed-time prompt')
    match = two or one
    period = match[2]
    durations = [parse_duration(match[3])]
    if two:
        durations.append(parse_duration(match[5]))
    figure = field(public, 'figure')
    require(field(figure, 'kind') == 'clock', 'Clock expected')
    start = start_minutes(period, field(figure, 'hour'), field(figure, 'minute'))
    end = start + sum(durations)
    require(0 <= end < 20 * 60, 'End time leaves the grade-4 day')
    require(end // 60 != start // 60, 'Interval does not cross an hour')
    label = format_time(end)
    require(label not in text, 'End time is written in the prompt')
    return choice_id(public, label)


def solve_table(public):
    text = field(public, 'prompt')
    match = re.fullmatch(
        r'The table matches (\w+) with (\w+)\. The first row shows (\d+) '
        r'(feet|kilograms|hours|liters)\. Fill in the two blanks\.',
        text,
    )
    require(match is not None, 'Unrecognized conversion table')
    large, small, shown, unit = match[1], match[2], int(match[3]), match[4]
    require(unit == large, 'The first row does not name the larger unit')
    factor = TABLE_FACTOR.get((large, small))
    require(factor is not None, f'Unknown pair {large}/{small}')
    figure = field(public, 'figure')
    require(field(figure, 'kind') == 'scene', 'Scene expected')
    elements = field(field(figure, 'scene'), 'elements')
    table = elements[0]
    require(field(table, 'type') == 'table', 'Table expected')
    require(field(table, 'columns') == [large, small], 'Table columns do not match')
    rows = field(table, 'rows')
    require(len(rows) == 3, 'Need three rows')
    first = rows[0]['cells']
    require(first[0] == shown and first[1] == shown * factor, 'First row breaks the rule')
    response = field(public, 'response')
    require(field(response, 'kind') == 'multi-part-choice', 'Multi-part response expected')
    key = {}
    filled = set()
    for blank in field(response, 'blanks'):
        label = re.fullmatch(r'Row (\d+), (\w+)', field(blank, 'label'))
        require(label is not None, 'Unrecognized blank')
        row_number, word = int(label[1]), label[2]
        require(row_number in (2, 3), 'Only rows 2 and 3 are blank')
        cells = rows[row_number - 1]['cells']
        if word == large:
            require(cells[0] is None and isinstance(cells[1], int), 'Large cell is not the blank')
            require(cells[1] % factor == 0, 'Smaller unit does not divide')
            expected = cells[1] // factor
        elif word == small:
            require(cells[1] is None and isinstance(cells[0], int), 'Small cell is not the blank')
            expected = cells[0] * factor
        else:
            raise ValueError(f'Blank names {word}, not a column')
        shown_label = f'{expected:,}'
        hits = [o['id'] for o in field(blank, 'options') if o['label'] == shown_label]
        require(len(hits) == 1, f'Need exactly one option {shown_label!r}')
        key[field(blank, 'id')] = hits[0]
        filled.add(word)
    require(filled == {large, small}, 'Both columns must be filled')
    return json.dumps(key, separators=(',', ':'))


def solve_rename(public):
    match = re.fullmatch(r'Write (\d+) (\w+) in (\w+)\.', field(public, 'prompt'))
    require(match is not None, 'Unrecognized rename prompt')
    amount, small, large = int(match[1]), match[2], match[3]
    factor = RENAME_FACTOR.get((small, large))
    require(factor is not None, f'Unknown rename {small} to {large}')
    require(amount % factor == 0 and amount // factor >= 1, 'Result is not a whole number of the larger unit')
    return str(amount // factor)


def solve_line(public):
    text = field(public, 'prompt')
    match = re.fullmatch(
        r'A class of (\d+) students? walks from \$A\$ to \$B\$ on the trail\. '
        r'How far is the walk, in miles\?',
        text,
    )
    require(match is not None, 'Unrecognized measurement line')
    require('equal steps' not in text, 'The prompt states the scale')
    figure = field(public, 'figure')
    require(field(figure, 'kind') == 'rational-line', 'Number line expected')
    denominator = field(figure, 'denominator')
    require(denominator in LINE_DENOMS, 'Denominator is outside the grade-4 line')
    require(field(figure, 'unit') == 'miles', 'Unit is not miles')
    points = {p['label']: p['numerator'] for p in field(figure, 'points')}
    require(set(points) == {'A', 'B'}, 'Need points A and B')
    start, end = points['A'], points['B']
    require(isinstance(start, int) and isinstance(end, int) and end > start, 'Points are out of order')
    span = end - start
    divisor = math.gcd(span, denominator)
    numerator, reduced = span // divisor, denominator // divisor
    answer = str(numerator) if reduced == 1 else f'{numerator}/{reduced}'
    if '/' in answer:
        require(answer not in text, 'The fraction is written in the prompt')
    return answer


def solve_tool(public):
    text = field(public, 'prompt')
    hits = [tool for phrase, tool in TOOL_PHRASES if phrase in text]
    require(len(hits) == 1, 'Need exactly one measuring tool')
    return choice_id(public, hits[0])


def solve_decimal(public):
    match = re.fullmatch(
        r'What is \$(\d+\.\d{1,2}) ([+-]) (\d+\.\d{1,2})\$\?',
        field(public, 'prompt'),
    )
    require(match is not None, 'Unrecognized decimal operation')
    left, op, right = cents_of(match[1]), match[2], cents_of(match[3])
    value = left + right if op == '+' else left - right
    require(value >= 0, 'Decimal result is negative')
    return dollars_of(value)


def solve_money(public):
    text = field(public, 'prompt')
    add = re.fullmatch(
        r'A book costs (\d+\.\d\d) dollars and a pen costs (\d+\.\d\d) dollars\. '
        r'What is the total cost in dollars\?',
        text,
    )
    if add:
        require(not add[1].endswith('00') and not add[2].endswith('00'), 'A price is a whole dollar')
        return dollars_of(cents_of(add[1]) + cents_of(add[2]))
    change = re.fullmatch(
        r'A snack costs (\d+\.\d\d) dollars\. You pay (\d+\.\d\d) dollars\. '
        r'How many dollars do you get back\?',
        text,
    )
    if change:
        require(not change[2].endswith('00'), 'The payment is a whole dollar')
        paid, cost = cents_of(change[2]), cents_of(change[1])
        require(paid > cost, 'The payment does not cover the cost')
        return dollars_of(paid - cost)
    shared = re.fullmatch(
        r'Markers cost (\d+\.\d\d) dollars each\. The club buys (\d+) markers and '
        r'(\d+) friends split the cost equally\. How many dollars does each friend pay\?',
        text,
    )
    if shared:
        price, items, friends = cents_of(shared[1]), int(shared[2]), int(shared[3])
        require(items >= 2 and friends >= 2, 'Need more than one marker and friend')
        total = items * price
        require(total % friends == 0, 'The share is not exact cents')
        return dollars_of(total // friends)
    stickers = re.fullmatch(
        r'Each sticker costs (\d+\.\d\d) dollars\. You buy (\d+) stickers and pay '
        r'(\d+\.\d\d) dollars\. How many dollars do you get back\?',
        text,
    )
    if stickers:
        price, count, paid = cents_of(stickers[1]), int(stickers[2]), cents_of(stickers[3])
        require(count >= 2, 'Need more than one sticker')
        cost = count * price
        require(paid > cost, 'The payment does not cover the stickers')
        return dollars_of(paid - cost)
    fewest = re.fullmatch(
        r'You need (\d+\.\d\d) dollars using quarters, dimes, nickels and pennies\. '
        r'Use as few coins as you can\. How many coins is that\?',
        text,
    )
    require(fewest is not None, 'Unrecognized money story')
    return str(fewest_coins(cents_of(fewest[1])))


def solve_model(public):
    match = re.fullmatch(
        r'Set A starts with (.+)\. Set B adds the coins\. What is the total in dollars\?',
        field(public, 'prompt'),
    )
    require(match is not None, 'Unrecognized money model')
    figure = field(public, 'figure')
    require(field(figure, 'kind') == 'money-sets', 'Money sets expected')
    sets = {s.get('label'): s.get('items') for s in field(figure, 'sets')}
    require(set(sets) == {'A', 'B'}, 'Need sets A and B')
    phrase = match[1]
    bills = sets['A']
    if phrase == '1 five-dollar bill':
        require(bills == ['five'], 'Set A is not one five-dollar bill')
    else:
        counted = re.fullmatch(r'(\d+) one-dollar bills?', phrase)
        require(counted is not None, 'Unrecognized bill phrase')
        require(bills == ['dollar'] * int(counted[1]), 'Set A does not match the bill phrase')
    coins = sets['B']
    require(isinstance(coins, list) and len(coins) == 10, 'Set B is not ten coins')
    require({'quarter', 'dime', 'nickel', 'penny'} <= set(coins), 'A denomination is missing')
    try:
        total = sum(MONEY_CENTS[item] for item in bills + coins)
    except KeyError as error:
        raise ValueError(f'Unknown money item {error}') from error
    return dollars_of(total)


SOLVERS = {
    'elapsed-time-intervals': solve_elapsed,
    'conversion-table-slots': solve_table,
    'unit-rename-larger': solve_rename,
    'measurement-line-fraction-story': solve_line,
    'measuring-tool-choice': solve_tool,
    'decimal-sum-difference': solve_decimal,
    'money-decimal-story': solve_money,
    'money-model-decimal': solve_model,
}


def solve(public):
    template = field(public, 'templateId')
    require(template in SOLVERS, f'Unsupported template {template}')
    return SOLVERS[template](public)


def review_problem(problem):
    public = field(problem, 'public')
    result = solve(public)
    answer = field(problem, 'answer')
    require(isinstance(answer, str) and answer, 'Missing answer')
    if field(public, 'templateId') in CHOICE_REVIEW:
        require(result == answer, f'Choice answer mismatch {answer} vs {result}')
    else:
        require(Fraction(answer) == Fraction(result), f'Numeric answer mismatch {answer} vs {result}')
    return result


def _choice(template, prompt, labels, key, figure=None):
    public = {
        'templateId': template,
        'prompt': prompt,
        'response': {
            'kind': 'choice',
            'options': [{'id': f'option-{i}', 'label': label} for i, label in enumerate(labels)],
        },
    }
    if figure:
        public['figure'] = figure
    return {'public': public, 'answer': f'option-{key}'}


def _number(template, prompt, answer, figure=None):
    public = {
        'templateId': template,
        'prompt': prompt,
        'response': {'kind': 'number', 'label': 'Answer'},
    }
    if figure:
        public['figure'] = figure
    return {'public': public, 'answer': answer}


def self_test():
    clock = lambda hour, minute: {'kind': 'clock', 'hour': hour, 'minute': minute}
    good = [
        _choice(
            'elapsed-time-intervals',
            'The clock shows when the hike starts, in the morning. The hike takes 1 hour 10 minutes. Then the snack takes 20 minutes. What time does the snack end?',
            ['10:50 a.m.', '11:10 a.m.', '12:10 p.m.', '10:10 a.m.'],
            1,
            clock(9, 40),
        ),
        _choice(
            'elapsed-time-intervals',
            'The clock shows when the practice starts, in the afternoon. The practice lasts 1 hour 25 minutes. What time does the practice end?',
            ['2:05 p.m.', '3:05 p.m.', '4:05 p.m.', '1:05 p.m.'],
            1,
            clock(1, 40),
        ),
        _choice(
            'elapsed-time-intervals',
            'The clock shows when the reading starts, in the morning. The reading lasts 1 hour 15 minutes. What time does the reading end?',
            ['11:35 a.m.', '12:35 p.m.', '1:35 p.m.', '10:35 a.m.'],
            1,
            clock(11, 20),
        ),
        {
            'public': {
                'templateId': 'conversion-table-slots',
                'prompt': 'The table matches kilograms with grams. The first row shows 2 kilograms. Fill in the two blanks.',
                'response': {
                    'kind': 'multi-part-choice',
                    'blanks': [
                        {
                            'id': 'r2large',
                            'label': 'Row 2, kilograms',
                            'options': [
                                {'id': 'a', 'label': '3'},
                                {'id': 'b', 'label': '2'},
                                {'id': 'c', 'label': '3,000'},
                            ],
                        },
                        {
                            'id': 'r3small',
                            'label': 'Row 3, grams',
                            'options': [
                                {'id': 'a', 'label': '4,000'},
                                {'id': 'b', 'label': '4'},
                                {'id': 'c', 'label': '8,000'},
                            ],
                        },
                    ],
                },
                'figure': {
                    'kind': 'scene',
                    'scene': {
                        'elements': [{
                            'type': 'table',
                            'columns': ['kilograms', 'grams'],
                            'rows': [
                                {'label': '1', 'cells': [2, 2000]},
                                {'label': '2', 'cells': [None, 3000]},
                                {'label': '3', 'cells': [4, None]},
                            ],
                        }],
                    },
                },
            },
            'answer': '{"r2large":"a","r3small":"a"}',
        },
        _number('unit-rename-larger', 'Write 48 inches in feet.', '4'),
        _number(
            'measurement-line-fraction-story',
            'A class of 24 students walks from $A$ to $B$ on the trail. How far is the walk, in miles?',
            '5/4',
            {
                'kind': 'rational-line',
                'denominator': 4,
                'maxWhole': 2,
                'points': [{'numerator': 1, 'label': 'A'}, {'numerator': 6, 'label': 'B'}],
                'unit': 'miles',
            },
        ),
        _choice(
            'measuring-tool-choice',
            'Which tool should you use to measure the length of a book?',
            ['balance', 'ruler', 'thermometer', 'scale'],
            1,
        ),
        _number('decimal-sum-difference', 'What is $3.4 - 1.27$?', '2.13'),
        _number('decimal-sum-difference', 'What is $1.25 + 2.40$?', '3.65'),
        _number(
            'money-decimal-story',
            'A book costs 1.25 dollars and a pen costs 2.40 dollars. What is the total cost in dollars?',
            '3.65',
        ),
        _number(
            'money-decimal-story',
            'A snack costs 1.55 dollars. You pay 2.40 dollars. How many dollars do you get back?',
            '0.85',
        ),
        _number(
            'money-decimal-story',
            'Markers cost 0.23 dollars each. The club buys 6 markers and 3 friends split the cost equally. How many dollars does each friend pay?',
            '0.46',
        ),
        _number(
            'money-decimal-story',
            'Each sticker costs 0.25 dollars. You buy 2 stickers and pay 1.25 dollars. How many dollars do you get back?',
            '0.75',
        ),
        _number(
            'money-decimal-story',
            'You need 0.41 dollars using quarters, dimes, nickels and pennies. Use as few coins as you can. How many coins is that?',
            '4',
        ),
        _number(
            'money-model-decimal',
            'Set A starts with 1 five-dollar bill. Set B adds the coins. What is the total in dollars?',
            '6.91',
            {
                'kind': 'money-sets',
                'sets': [
                    {'label': 'A', 'items': ['five']},
                    {'label': 'B', 'items': ['quarter'] * 7 + ['dime', 'nickel', 'penny']},
                ],
            },
        ),
    ]
    rejected = 0

    def reject(problem):
        nonlocal rejected
        try:
            review_problem(problem)
        except ValueError:
            rejected += 1
            return
        raise ValueError(f"Corrupt {problem['public']['templateId']} case was accepted")

    for problem in good:
        review_problem(problem)
        bad = copy.deepcopy(problem)
        if bad['public']['templateId'] in CHOICE_REVIEW:
            bad['answer'] = 'wrong'
        elif '/' in bad['answer']:
            numerator, denominator = bad['answer'].split('/')
            bad['answer'] = f'{int(numerator) + 1}/{denominator}'
        else:
            bad['answer'] = str(Fraction(bad['answer']) + 1)
        reject(bad)
    reject(_choice(
        'elapsed-time-intervals',
        'The clock shows when the art starts, in the morning. The art lasts 20 minutes. What time does the art end?',
        ['9:30 a.m.', '10:30 a.m.', '8:30 a.m.', '9:50 a.m.'],
        0,
        clock(9, 10),
    ))
    reject(_number('unit-rename-larger', 'Write 50 inches in feet.', '4'))
    reject(_choice(
        'measuring-tool-choice',
        'Which tool should you use to measure the length of a book?',
        ['ruler', 'ruler', 'balance', 'scale'],
        0,
    ))
    bare = copy.deepcopy(good[3])
    bare['public']['response']['blanks'][1]['options'][0]['label'] = '4000'
    reject(bare)
    return {'fixtures': len(good), 'rejectedMutations': rejected}


if __name__ == '__main__':
    print(self_test())
