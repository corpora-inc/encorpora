"""Independent prompt-only review of the grade 6-7 number-system family.

Answers are re-derived from the public prompt and figure only: factors and
multiples by exhaustive search, quotients by repeated subtraction of place
values, signs from the direction words in the story, and decimals with exact
fractions. Generated answers are only ever the value under test. Malformed,
inconsistent or out-of-scope prompts are rejected.
"""
import copy
import json
import re
import subprocess
import xml.etree.ElementTree as ET
from fractions import Fraction
from pathlib import Path

NUMBER_SYSTEM_CHOICE = frozenset({'gcf-factor-sum'})
NUMBER_SYSTEM = frozenset({
    'greatest-common-factor', 'least-common-multiple', 'gcf-factor-sum',
    'long-division-quotient', 'division-remainder-story', 'signed-quantity',
    'opposite-on-line', 'signed-story', 'signed-jumps',
})
LESSONS = {
    'greatest-common-factor': ['greatest-common-factor', 'gcf-factor-sum'],
    'least-common-multiple': ['least-common-multiple'],
    'long-division': ['long-division-quotient', 'division-remainder-story'],
    'signed-numbers': ['signed-quantity', 'opposite-on-line'],
    'signed-stories': ['signed-story', 'signed-jumps'],
}
NUM = r'−?\d+(?:\.\d+)?'


def require(condition, message):
    if not condition:
        raise ValueError(message)


def number(text):
    require(re.fullmatch(r'[−-]?\d+(?:\.\d+)?', text) is not None, 'Malformed number: ' + text)
    return Fraction(text.replace('−', '-'))


def common_factors(a, b):
    return [d for d in range(1, min(a, b) + 1) if a % d == 0 and b % d == 0]


def gcf(a, b):
    return common_factors(a, b)[-1]


def lcm(a, b):
    m = max(a, b)
    while m % a or m % b:
        m += 1
    return m


def divide(n, d):
    """Quotient and remainder by subtracting the largest place-value multiples of d."""
    q, rest, place = 0, n, 1
    while d * place * 10 <= rest:
        place *= 10
    while place:
        while rest >= d * place:
            rest -= d * place
            q += place
        place //= 10
    return q, rest


# ---- parsers: public prompt (and figure) -> exact answer -------------------------------

def solve_gcf(prompt):
    m = re.fullmatch(r'What is the greatest common factor of (\d+) and (\d+)\?', prompt)
    if not m:
        m = re.fullmatch(r'(?:A coach has (\d+) balls and (\d+) cones to split into identical sets|A baker has (\d+) muffins and (\d+) cookies to split into identical boxes|A florist has (\d+) roses and (\d+) tulips to split into identical bouquets) with none left over\. What is the greatest number of (sets|boxes|bouquets) that can be made\?', prompt)
        if m:
            values = [g for g in m.groups()[:6] if g is not None]
            noun = {'A coach': 'sets', 'A baker': 'boxes', 'A florist': 'bouquets'}[prompt.split(' has ')[0]]
            require(m[7] == noun, 'Set noun mismatch')
            m = values
        else:
            m = re.fullmatch(r'A rectangular floor is (\d+) feet by (\d+) feet\. What is the largest whole number of feet that can be the side of square tiles covering it with no tiles cut\?', prompt)
            require(m is not None, 'Unrecognized GCF prompt')
            m = [m[1], m[2]]
    else:
        m = [m[1], m[2]]
    a, b = int(m[0]), int(m[1])
    require(a != b and 1 <= a <= 100 and 1 <= b <= 100 and max(a, b) >= 12, 'GCF numbers outside scope')
    return Fraction(gcf(a, b))


PACKS = {('Hot dogs', 'buns'), ('Cups', 'plates'), ('Juice boxes', 'granola bars')}


def solve_lcm(prompt):
    m = re.fullmatch(r'What is the least common multiple of (\d+) and (\d+)\?', prompt)
    if m:
        a, b = int(m[1]), int(m[2])
    else:
        m = re.fullmatch(r'([A-Z][a-z ]+) come in packs of (\d+) and ([a-z ]+) come in packs of (\d+)\. What is the least number of each you can buy to have equal numbers of ([a-z ]+) and ([a-z ]+)\?', prompt)
        if m:
            require((m[1], m[3]) in PACKS and m[5] == m[1].lower() and m[6] == m[3], 'Package nouns mismatch')
            a, b = int(m[2]), int(m[4])
        else:
            m = re.fullmatch(r'Two (lights|bells) (flash|ring) together now\. One (flashes|rings) every (\d+) (seconds|minutes) and the other every (\d+) (seconds|minutes)\. In how many (seconds|minutes) will they next (flash|ring) together\?', prompt)
            require(m is not None, 'Unrecognized LCM prompt')
            require({m[1]: m[2]} in ({'lights': 'flash'}, {'bells': 'ring'}) and m[3] == m[2] + ('es' if m[2] == 'flash' else 's') and m[5] == m[7] == m[8] and m[9] == m[2], 'Repeating-event wording mismatch')
            a, b = int(m[4]), int(m[6])
    require(a != b and 2 <= a <= 12 and 2 <= b <= 12, 'LCM numbers outside scope')
    return Fraction(lcm(a, b))


def factored(label):
    m = re.fullmatch(r'(\d+)\((\d+) \+ (\d+)\)', label)
    require(m is not None, 'Malformed factored option: ' + label)
    return int(m[1]), int(m[2]), int(m[3])


def solve_factor_sum(public):
    m = re.fullmatch(r'Use the distributive property to write (\d+) \+ (\d+) as the greatest common factor of (\d+) and (\d+) times a sum\. Which expression is it\?', public['prompt'])
    require(m is not None and (m[1], m[2]) == (m[3], m[4]), 'Unrecognized factor-sum prompt')
    a, b = int(m[1]), int(m[2])
    g = gcf(a, b)
    require(a <= 100 and b <= 100 and a != b and g >= 2, 'Factor-sum numbers outside scope')
    options = public['response']['options']
    require(len(options) == 4 and len({o['label'] for o in options}) == 4, 'Need four distinct options')
    correct = [o['id'] for o in options if (lambda k, x, y: k == g and k * x == a and k * y == b)(*factored(o['label']))]
    require(len(correct) == 1, 'Exactly one option must factor out the GCF')
    return correct[0]


def solve_long_division(prompt):
    m = re.fullmatch(r'What is (\d+) ÷ (\d+)\?', prompt) or re.fullmatch(r'A school orders (\d+) sheets of paper packed equally into (\d+) boxes\. How many sheets are in each box\?', prompt)
    require(m is not None, 'Unrecognized long-division prompt')
    n, d = int(m[1]), int(m[2])
    require(10 <= d <= 99 and n < 100000, 'Division outside scope')
    q, rest = divide(n, d)
    require(rest == 0 and q >= 10, 'Long-division item must have an exact multidigit quotient')
    return Fraction(q)


REMAINDER = [
    (r'A school is taking (\d+) students on a trip\. Each bus holds (\d+) students\. How many buses are needed to carry every student\?', 'up', False),
    (r'An album holds (\d+) photos on each page\. How many pages are needed to hold all (\d+) photos\?', 'up', True),
    (r'A factory has (\d+) bolts and packs them in boxes of (\d+)\. How many boxes can it fill completely\?', 'down', False),
    (r'A library has (\d+) books to put on shelves that hold (\d+) books each\. How many shelves can it fill completely\?', 'down', False),
    (r'A factory packs (\d+) bolts into boxes of (\d+), filling as many boxes as it can\. How many bolts are left over\?', 'left', False),
    (r'A library puts (\d+) books on shelves that hold (\d+) books each, filling as many shelves as it can\. How many books are left over\?', 'left', False),
]


def remainder_parts(prompt):
    for pattern, meaning, swapped in REMAINDER:
        m = re.fullmatch(pattern, prompt)
        if m:
            n, d = (int(m[2]), int(m[1])) if swapped else (int(m[1]), int(m[2]))
            q, rest = divide(n, d)
            require(12 <= d <= 60 and n <= 9999 and rest > 0, 'Remainder story outside scope')
            return n, d, q, rest, meaning
    raise ValueError('Unrecognized remainder prompt')


def solve_remainder(prompt):
    _, _, q, rest, meaning = remainder_parts(prompt)
    return Fraction({'up': q + 1, 'down': q, 'left': rest}[meaning])


# Each sentence names its own direction; the rule names the positive direction.
QUANTITY = {
    'elevation': (r"A hawk flies (\d+) feet above sea level\.", r"A diver swims (\d+) feet below sea level\.",
                  'Sea level is 0, and heights above sea level are positive.', "the hawk's height", "the diver's height"),
    'temperature': (r'At noon the temperature is (\d+) degrees above zero\.', r'At dawn the temperature is (\d+) degrees below zero\.',
                    'Temperatures above zero are positive.', 'the noon temperature', 'the dawn temperature'),
    'money': (r'Sam deposits (\d+) dollars into a bank account\.', r'Sam withdraws (\d+) dollars from a bank account\.',
              'Money added to the account is positive.', "the change in Sam's balance", "the change in Sam's balance"),
    'yards': (r'On one play, a football team gains (\d+) yards\.', r'On one play, a football team loses (\d+) yards\.',
              'Yards gained are positive.', "the team's change in position on that play", "the team's change in position on that play"),
    'floors': (r'An office is (\d+) floors above ground level\.', r'A parking level is (\d+) floors below ground level\.',
               'Ground level is 0, and floors above ground are positive.', "the office's floor", "the parking level's floor"),
}
OPPOSITE = [
    (r'[Aa] height of (\d+) feet (above|below) sea level', 'elevation', 'above'),
    (r'[Aa] temperature (\d+) degrees (above|below) zero', 'temperature', 'above'),
    (r'[Aa] (deposit|withdrawal) of (\d+) dollars', 'money', 'deposit'),
    (r'[Aa] (gain|loss) of (\d+) yards', 'yards', 'gain'),
    (r'[Aa] floor (\d+) levels (above|below) ground level', 'floors', 'above'),
]


def opposite_phrase(text):
    for pattern, context, positive in OPPOSITE:
        m = re.fullmatch(pattern, text)
        if m:
            size, word = (int(m[2]), m[1]) if context in ('money', 'yards') else (int(m[1]), m[2])
            return context, size, 1 if word == positive else -1
    raise ValueError('Unrecognized signed quantity: ' + text)


def solve_signed_quantity(prompt):
    m = re.fullmatch(r'(.+) is written as (' + NUM + r')\. What number represents (.+)\?', prompt)
    if m:
        given, written, asked = opposite_phrase(m[1]), number(m[2]), opposite_phrase(m[3])
        require(given[0] == asked[0] and given[1] == asked[1] and given[2] == -asked[2], 'Not opposite quantities')
        # The written sign fixes the convention; the asked quantity has the opposite sign.
        require(abs(written) == given[1], 'Written value has the wrong size')
        return -written
    for context, (pos, neg, rule, pos_thing, neg_thing) in QUANTITY.items():
        for pattern, sign, thing in ((pos, 1, pos_thing), (neg, -1, neg_thing)):
            m = re.fullmatch(pattern + ' ' + re.escape(rule) + ' What number represents ' + re.escape(thing) + r'\?', prompt)
            if m:
                require(2 <= int(m[1]) <= 500, 'Quantity outside scope')
                return Fraction(sign * int(m[1]))
    raise ValueError('Unrecognized signed-quantity prompt')


def solve_opposite(public):
    figure = public.get('figure')
    require(figure and figure['kind'] == 'signed-line' and figure['min'] == -10 and figure['max'] == 10 and 'jumps' not in figure, 'Opposite needs a −10 to 10 line')
    require(len(figure['points']) == 1 and figure['points'][0]['label'] == 'P', 'Exactly one point P')
    p = figure['points'][0]['value']
    require(type(p) is int and p != 0 and -10 < p < 10, 'P must be a nonzero integer inside the line')
    prompt = public['prompt']
    if prompt == 'Point P marks a number on the number line. What is the opposite of that number?':
        return Fraction(-p)
    if prompt == 'Point R (not shown) is the same distance from 0 as point P, on the other side of 0. What number is at R?':
        return Fraction(-p)
    if prompt == 'Point P marks a number on the number line. What is the opposite of the opposite of that number?':
        return Fraction(p)
    raise ValueError('Unrecognized opposite prompt')


def quarter(text):
    v = number(text)
    require((v * 4).denominator == 1, 'Story values are in quarters')
    return v


def money(text):
    require(re.fullmatch(r'−?\d+\.\d\d', text) is not None, 'Money needs two decimal places')
    return number(text)


M = r'meters?'


def unit(text, value):
    require(text == ('meter' if abs(value) == 1 else 'meters'), 'Meter agreement')


def solve_story(prompt):
    m = re.fullmatch(r'At 6 a\.m\. the temperature was (' + NUM + r')°C\. By noon it had risen (' + NUM + r')°C\. Then it fell (' + NUM + r')°C each hour for (\d+) hours\. What was the temperature then, in °C\?', prompt)
    if m:
        start, rise, fall, hours = quarter(m[1]), quarter(m[2]), quarter(m[3]), int(m[4])
        require(rise > 0 and fall > 0 and 2 <= hours <= 6, 'Temperature story outside scope')
        return start + rise + sum([-fall] * hours)
    m = re.fullmatch(r'A diver is (' + NUM + r') (' + M + r') below sea level\. She rises (' + NUM + r') (' + M + r'), then descends (' + NUM + r') (' + M + r') per minute for (\d+) minutes\. What is her elevation now, in meters\?', prompt)
    if m:
        depth, rise, rate, minutes = quarter(m[1]), quarter(m[3]), quarter(m[5]), int(m[7])
        unit(m[2], depth); unit(m[4], rise); unit(m[6], rate)
        require(depth > 0 and rise > 0 and rate > 0 and 2 <= minutes <= 5, 'Dive story outside scope')
        return -depth + rise + sum([-rate] * minutes)
    m = re.fullmatch(r'A bank account has a balance of (' + NUM + r') dollars\. The owner deposits (' + NUM + r') dollars, then pays (\d+) bills of (' + NUM + r') dollars each from the account\. What is the balance now, in dollars\?', prompt)
    if m:
        start, deposit, count, price = money(m[1]), money(m[2]), int(m[3]), money(m[4])
        require(deposit > 0 and price > 0 and 2 <= count <= 5, 'Account story outside scope')
        return start + deposit + sum([-price] * count)
    m = re.fullmatch(r'At 5 a\.m\. the temperature was (' + NUM + r')°C\. At 2 p\.m\. it was (' + NUM + r')°C\. By how many degrees did the temperature rise\?', prompt)
    if m:
        start, end = quarter(m[1]), quarter(m[2])
        require(end > start, 'A rise must increase')
        return end - start
    m = re.fullmatch(r'At noon the temperature was (' + NUM + r')°C\. At midnight it was (' + NUM + r')°C\. What was the change in temperature, in degrees\? Give a drop as a negative number\.', prompt)
    if m:
        start, end = quarter(m[1]), quarter(m[2])
        require(start != end, 'A change must be nonzero')
        return end - start
    m = re.fullmatch(r'A hiker stands on a ledge (' + NUM + r') (' + M + r') above sea level\. Directly below, a diver is (' + NUM + r') (' + M + r') below sea level\. How many meters apart are they vertically\?', prompt)
    require(m is not None, 'Unrecognized signed story')
    high, low = quarter(m[1]), -quarter(m[3])
    unit(m[2], high); unit(m[4], low)
    require(high > 0 and low < 0, 'Ledge above and diver below sea level')
    return high - low


def changes(text):
    items = text.split(', ')
    last = items.pop().split(' and ')
    require(len(last) == 2 or (len(last) == 1 and not items), 'Malformed change list')
    out = []
    for item in items + last:
        require(re.fullmatch(r'[+−]\d+(?:\.\d)?', item) is not None, 'Changes carry an explicit sign: ' + item)
        out.append(number(item.lstrip('+')))
    return out


def solve_jumps(public):
    m = re.fullmatch(r'The arrows start at (' + NUM + r') and show the changes (.+), in that order\. At what number does the last arrow end\?', public['prompt'])
    require(m is not None, 'Unrecognized jumps prompt')
    start, steps = number(m[1]), changes(m[2])
    figure = public.get('figure')
    require(figure and figure['kind'] == 'signed-line' and figure['points'] == [], 'Jumps need a signed line')
    require(Fraction(figure['start']).limit_denominator(4) == start and len(figure['jumps']) == len(steps) and all(Fraction(j).limit_denominator(4) == s for j, s in zip(figure['jumps'], steps)), 'Figure jumps disagree with the prompt')
    require(2 <= len(steps) <= 3, 'Two or three jumps')
    at = start
    for step in steps:
        require(step != 0, 'Zero jump')
        at += step
        require(figure['min'] <= at <= figure['max'], 'Jump leaves the drawn line')
    require(figure['min'] <= start <= figure['max'] and figure['min'] <= 0 <= figure['max'], 'Line must show the start and 0')
    return at


def solve_number_system(public):
    template = public['templateId']
    if template == 'greatest-common-factor':
        return solve_gcf(public['prompt'])
    if template == 'least-common-multiple':
        return solve_lcm(public['prompt'])
    if template == 'gcf-factor-sum':
        return solve_factor_sum(public)
    if template == 'long-division-quotient':
        return solve_long_division(public['prompt'])
    if template == 'division-remainder-story':
        return solve_remainder(public['prompt'])
    if template == 'signed-quantity':
        return solve_signed_quantity(public['prompt'])
    if template == 'opposite-on-line':
        return solve_opposite(public)
    if template == 'signed-story':
        return solve_story(public['prompt'])
    if template == 'signed-jumps':
        return solve_jumps(public)
    raise ValueError('Unknown number-system template ' + template)


# ---- displayed arithmetic -------------------------------------------------------------

def evaluate(text):
    """Exact value of displayed arithmetic: decimals, − × ÷ + and parentheses, a(b) products."""
    tokens = re.findall(r'\d+(?:\.\d+)?|[−\-+×÷()]', text)
    require(''.join(tokens) == re.sub(r'\s+', '', text), 'Unsupported arithmetic: ' + text)
    expanded = []
    for t in tokens:
        if t == '(' and expanded and (expanded[-1] == ')' or expanded[-1][0].isdigit()):
            expanded.append('×')
        expanded.append(t)
    pos = 0

    def peek():
        return expanded[pos] if pos < len(expanded) else None

    def take():
        nonlocal pos
        pos += 1
        return expanded[pos - 1]

    def atom():
        t = take()
        if t in ('−', '-'):
            return -atom()
        if t == '(':
            v = total()
            require(take() == ')', 'Unbalanced parentheses: ' + text)
            return v
        require(t is not None and t[0].isdigit(), 'Expected a number: ' + text)
        return Fraction(t)

    def term():
        v = atom()
        while peek() in ('×', '÷'):
            v = v * atom() if take() == '×' else v / atom()
        return v

    def total():
        v = term()
        while peek() in ('+', '−', '-'):
            v = v + term() if take() == '+' else v - term()
        return v
    value = total()
    require(pos == len(expanded), 'Trailing arithmetic: ' + text)
    return value


TRAILING = re.compile(r'[−(\d][\d .()×÷+−]*$')
LEADING = re.compile(r'^[−(\d][\d .()×÷+−]*')


def arithmetic(match, side):
    """The arithmetic next to '=', never crossing a sentence boundary ('. ')."""
    pieces = match.split('. ')
    return (pieces[-1] if side == 'left' else pieces[0]).strip().rstrip('.').strip()


def equalities(text, strict=True):
    """Check every adjacent pair of each 'a = b = c' chain; prose without arithmetic is skipped unless strict."""
    parts = text.split(' = ')
    checked = 0
    for left, right in zip(parts, parts[1:]):
        a, b = TRAILING.search(left), LEADING.match(right)
        if not (a and b):
            require(not strict, 'Equality without arithmetic: ' + text)
            continue
        require(evaluate(arithmetic(a[0], 'left')) == evaluate(arithmetic(b[0], 'right')), 'False equality: ' + text)
        checked += 1
    return checked


def numbers_in(text):
    return [number(t) for t in re.findall(r'−?\d+(?:\.\d+)?', text)]


def listed(text):
    items = text.split(', ')
    last = items.pop().split(' and ')
    return [int(x) for x in items + last]


def review_explanation(problem):
    public, steps = problem['public'], problem['explanation']
    template = public['templateId']
    require(problem['hint'] and len(steps) >= 2, 'Explanation or hint missing')
    chains = sum(equalities(step) for step in steps)
    answer = solve_number_system(public)
    if template in NUMBER_SYSTEM_CHOICE:
        require(problem['answer'] == answer, 'Wrong option')
        label = next(o['label'] for o in public['response']['options'] if o['id'] == answer)
        require(label in steps[-1], 'Final step does not state the expression')
        feedback = problem.get('choiceFeedback') or {}
        require(set(feedback) == {o['id'] for o in public['response']['options']} - {answer}, 'Every distractor needs feedback')
        for option in public['response']['options']:
            if option['id'] != answer:
                require(option['label'] in feedback[option['id']], 'Feedback must name its option')
                chains += equalities(feedback[option['id']])
        return chains
    require(Fraction(problem['answer']) == answer, 'Mismatch: incorrect exact answer')
    require(answer in numbers_in(steps[-1]), 'Final step does not state the answer')
    joined = ' '.join(steps)
    if template == 'greatest-common-factor':
        for m in re.finditer(r'The factors of (\d+) are ([\d, and]+)\.', joined):
            n = int(m[1])
            require(listed(m[2]) == [d for d in range(1, n + 1) if n % d == 0], 'Factor list misstated')
        m = re.search(r'The common factors are ([\d, and]+)[.,]', joined)
        if m:
            nums = [int(x) for x in re.findall(r'of (\d+) are', joined)]
            require(listed(m[1]) == common_factors(*nums[:2]), 'Common factors misstated')
    elif template == 'least-common-multiple':
        m = re.search(r'Multiples of (\d+): ([\d, and]+)\.', joined)
        require(m is not None, 'Missing multiples list')
        big = int(m[1])
        require(listed(m[2]) == list(range(big, int(answer) + 1, big)), 'Multiples list misstated')
    elif template == 'long-division-quotient':
        digits = ''.join(re.findall(r'[Ww]rite (\d) in the quotient', joined))
        require(digits == str(int(answer)), 'Quotient digits do not spell the quotient')
        m = re.search(r'(\d+) ÷ \d+\?|orders (\d+) sheets', public['prompt'])
        n = int(m[1] or m[2])
        brought = re.findall(r'Bring down (\d)', joined)
        require(''.join(brought) == str(n)[len(str(n)) - len(brought):], 'Brought-down digits must follow the dividend')
    elif template == 'division-remainder-story':
        n, d, q, rest, _ = remainder_parts(public['prompt'])
        require(f'{n} ÷ {d} is {q} with remainder {rest}' in steps[0], 'Quotient and remainder misstated')
    return chains


def review_problem(problem):
    return review_explanation(problem)


def review_number_system_fixtures():
    """Handwritten cases with answers worked by hand, then malformed prompts that must fail."""
    good = [
        ({'templateId': 'greatest-common-factor', 'prompt': 'What is the greatest common factor of 48 and 72?'}, 24),
        ({'templateId': 'greatest-common-factor', 'prompt': 'A florist has 36 roses and 60 tulips to split into identical bouquets with none left over. What is the greatest number of bouquets that can be made?'}, 12),
        ({'templateId': 'greatest-common-factor', 'prompt': 'A rectangular floor is 27 feet by 40 feet. What is the largest whole number of feet that can be the side of square tiles covering it with no tiles cut?'}, 1),
        ({'templateId': 'least-common-multiple', 'prompt': 'What is the least common multiple of 6 and 8?'}, 24),
        ({'templateId': 'least-common-multiple', 'prompt': 'Hot dogs come in packs of 10 and buns come in packs of 8. What is the least number of each you can buy to have equal numbers of hot dogs and buns?'}, 40),
        ({'templateId': 'least-common-multiple', 'prompt': 'Two bells ring together now. One rings every 4 minutes and the other every 12 minutes. In how many minutes will they next ring together?'}, 12),
        ({'templateId': 'long-division-quotient', 'prompt': 'What is 8736 ÷ 24?'}, 364),
        ({'templateId': 'long-division-quotient', 'prompt': 'What is 7248 ÷ 24?'}, 302),
        ({'templateId': 'division-remainder-story', 'prompt': 'A school is taking 437 students on a trip. Each bus holds 52 students. How many buses are needed to carry every student?'}, 9),
        ({'templateId': 'division-remainder-story', 'prompt': 'A factory has 437 bolts and packs them in boxes of 52. How many boxes can it fill completely?'}, 8),
        ({'templateId': 'division-remainder-story', 'prompt': 'A factory packs 437 bolts into boxes of 52, filling as many boxes as it can. How many bolts are left over?'}, 21),
        ({'templateId': 'division-remainder-story', 'prompt': 'An album holds 12 photos on each page. How many pages are needed to hold all 100 photos?'}, 9),
        ({'templateId': 'signed-quantity', 'prompt': "A diver swims 35 feet below sea level. Sea level is 0, and heights above sea level are positive. What number represents the diver's height?"}, -35),
        ({'templateId': 'signed-quantity', 'prompt': 'A withdrawal of 40 dollars is written as −40. What number represents a deposit of 40 dollars?'}, 40),
        ({'templateId': 'signed-quantity', 'prompt': 'A gain of 12 yards is written as 12. What number represents a loss of 12 yards?'}, -12),
        ({'templateId': 'opposite-on-line', 'prompt': 'Point P marks a number on the number line. What is the opposite of the opposite of that number?',
          'figure': {'kind': 'signed-line', 'min': -10, 'max': 10, 'labelEvery': 5, 'points': [{'value': -7, 'label': 'P'}]}}, -7),
        ({'templateId': 'signed-story', 'prompt': 'At 6 a.m. the temperature was −4.5°C. By noon it had risen 7.25°C. Then it fell 1.5°C each hour for 3 hours. What was the temperature then, in °C?'}, Fraction(-7, 4)),
        ({'templateId': 'signed-story', 'prompt': 'A bank account has a balance of −32.50 dollars. The owner deposits 75.25 dollars, then pays 3 bills of 18.40 dollars each from the account. What is the balance now, in dollars?'}, Fraction(-1245, 100)),
        ({'templateId': 'signed-story', 'prompt': 'A diver is 12.5 meters below sea level. She rises 4.75 meters, then descends 1 meter per minute for 3 minutes. What is her elevation now, in meters?'}, Fraction(-43, 4)),
        ({'templateId': 'signed-story', 'prompt': 'At 5 a.m. the temperature was −7.5°C. At 2 p.m. it was 4.25°C. By how many degrees did the temperature rise?'}, Fraction(47, 4)),
        ({'templateId': 'signed-story', 'prompt': 'A hiker stands on a ledge 26.5 meters above sea level. Directly below, a diver is 16.5 meters below sea level. How many meters apart are they vertically?'}, 43),
        ({'templateId': 'signed-jumps', 'prompt': 'The arrows start at 9 and show the changes +2.5, −8 and +2, in that order. At what number does the last arrow end?',
          'figure': {'kind': 'signed-line', 'min': -5, 'max': 15, 'labelEvery': 5, 'points': [], 'start': 9, 'jumps': [2.5, -8, 2]}}, Fraction(11, 2)),
    ]
    for public, expected in good:
        require(solve_number_system(public) == expected, 'Fixture failed: ' + public['prompt'])
    choice = {'templateId': 'gcf-factor-sum', 'prompt': 'Use the distributive property to write 36 + 8 as the greatest common factor of 36 and 8 times a sum. Which expression is it?',
              'response': {'options': [{'id': 'option-a', 'label': '2(18 + 4)'}, {'id': 'option-b', 'label': '4(9 + 8)'}, {'id': 'option-c', 'label': '4(9 + 2)'}, {'id': 'option-d', 'label': '4(36 + 2)'}]}}
    require(solve_number_system(choice) == 'option-c', 'Choice fixture failed')
    bad = [
        {'templateId': 'greatest-common-factor', 'prompt': 'What is the greatest common factor of 48 and 48?'},
        {'templateId': 'greatest-common-factor', 'prompt': 'A coach has 48 balls and 72 cones to split into identical boxes with none left over. What is the greatest number of boxes that can be made?'},
        {'templateId': 'least-common-multiple', 'prompt': 'What is the least common multiple of 6 and 18?'},
        {'templateId': 'least-common-multiple', 'prompt': 'Two lights ring together now. One rings every 4 minutes and the other every 12 minutes. In how many minutes will they next ring together?'},
        {'templateId': 'long-division-quotient', 'prompt': 'What is 8737 ÷ 24?'},
        {'templateId': 'division-remainder-story', 'prompt': 'A factory has 520 bolts and packs them in boxes of 52. How many boxes can it fill completely?'},
        {'templateId': 'signed-quantity', 'prompt': 'A withdrawal of 40 dollars is written as −40. What number represents a deposit of 30 dollars?'},
        {'templateId': 'signed-quantity', 'prompt': "A diver swims 35 feet below sea level. Temperatures above zero are positive. What number represents the diver's height?"},
        {'templateId': 'signed-story', 'prompt': 'A bank account has a balance of −32.5 dollars. The owner deposits 75.25 dollars, then pays 3 bills of 18.40 dollars each from the account. What is the balance now, in dollars?'},
        {'templateId': 'signed-story', 'prompt': 'A diver is 12.5 meters below sea level. She rises 4.75 meters, then descends 1 meters per minute for 3 minutes. What is her elevation now, in meters?'},
        {'templateId': 'signed-jumps', 'prompt': 'The arrows start at 9 and show the changes +2.5, −8 and +2, in that order. At what number does the last arrow end?',
         'figure': {'kind': 'signed-line', 'min': -5, 'max': 15, 'labelEvery': 5, 'points': [], 'start': 9, 'jumps': [2.5, -8, 3]}},
        {'templateId': 'opposite-on-line', 'prompt': 'Point P marks a number on the number line. What is the opposite of that number?',
         'figure': {'kind': 'signed-line', 'min': -10, 'max': 10, 'labelEvery': 5, 'points': [{'value': 0, 'label': 'P'}]}},
        dict(choice, response={'options': [{'id': 'option-a', 'label': '2(18 + 4)'}, {'id': 'option-b', 'label': '4(9 + 8)'}, {'id': 'option-c', 'label': '1(36 + 8)'}, {'id': 'option-d', 'label': '4(36 + 2)'}]}),
    ]
    for public in bad:
        try:
            solve_number_system(public)
        except ValueError:
            pass
        else:
            raise ValueError('Malformed or inconsistent prompt accepted: ' + public['prompt'])
    require(divide(97902, 98) == (999, 0) and divide(437, 52) == (8, 21), 'Place-value division self-check')
    require(evaluate('4(9 + 2)') == 44 and evaluate('−4.5 + 7.25 + (−4.5)') == Fraction(-7, 4), 'Arithmetic self-check')
    return {'handwritten': len(good) + 1, 'rejected': len(bad)}


# ---- authored lessons, worksheets and figures -----------------------------------------

_EXPORT = None


def content(data=None):
    """Authored content, exported once per process; callers receive a private copy."""
    global _EXPORT
    if data is not None:
        return data
    if _EXPORT is None:
        app = Path(__file__).resolve().parent.parent
        _EXPORT = subprocess.check_output(['node', '--import', 'tsx', 'scripts/number-system-content-oracle.ts'], cwd=app, text=True)
    return json.loads(_EXPORT)


BREADTH = {
    'greatest-common-factor': lambda ps: any(p.startswith('What is') for p in ps) and any('identical' in p for p in ps) and any('floor' in p for p in ps),
    'least-common-multiple': lambda ps: any(p.startswith('What is') for p in ps) and any('packs' in p for p in ps) and any('together now' in p for p in ps),
    'gcf-factor-sum': lambda ps: True,
    'long-division-quotient': lambda ps: any('sheets' in p for p in ps) and any(p.startswith('What is') for p in ps),
    'division-remainder-story': lambda ps: any('needed' in p for p in ps) and any('completely' in p for p in ps) and any('left over' in p for p in ps),
    'signed-quantity': lambda ps: any('written as' in p for p in ps) and any('represents' in p and 'written' not in p for p in ps),
    'opposite-on-line': lambda ps: len(set(ps)) == 3,
    'signed-story': lambda ps: any('a.m.' in p and 'fell' in p for p in ps) and any('diver is' in p for p in ps) and any('bank account' in p for p in ps) and any('change in temperature' in p or 'rise?' in p or 'apart' in p for p in ps),
    'signed-jumps': lambda ps: any(p.count(', ') >= 2 for p in ps) and any(p.count(', ') == 1 for p in ps),
}


def review_number_system_content(data=None):
    data = content(data)
    checked = 0
    sheets = {}
    for sheet in data['worksheets']:
        problems = sheet['problems']
        require(len(problems) == 12, 'Worksheet length')
        keys = [json.dumps([p['public']['prompt'], p['public'].get('figure')], sort_keys=True) for p in problems]
        require(len(set(keys)) == 12, 'Repeated worksheet problem')
        require(all(p['public']['templateId'] == sheet['templateId'] for p in problems), 'Worksheet mixes templates')
        require(BREADTH[sheet['templateId']]([p['public']['prompt'] for p in problems]), 'Worksheet lacks breadth: ' + sheet['templateId'])
        for p in problems:
            checked += review_problem(p)
        sheets.setdefault(sheet['templateId'], 0)
        sheets[sheet['templateId']] += 1
    require(set(sheets) == NUMBER_SYSTEM and all(v == 16 for v in sheets.values()), 'Every template needs 16 worksheet editions')
    lessons = {lesson['id']: lesson for lesson in data['lessons']}
    require({k: v['templateIds'] for k, v in lessons.items()} == LESSONS, 'Lesson inventory')
    for lesson_id, lesson in lessons.items():
        worked = lesson['workedExample']
        solved = None
        for template in lesson['templateIds']:
            try:
                solved = solve_number_system({'templateId': template, 'prompt': worked['prompt']})
                break
            except (ValueError, KeyError, TypeError):
                continue
        require(solved is not None, 'Worked example is not a recognizable problem: ' + lesson_id)
        require(number(worked['answer']) == solved, 'Worked example answer: ' + lesson_id)
        require(solved in numbers_in(worked['steps'][-1]) or solved in numbers_in(worked['steps'][-2]), 'Worked example must state its answer: ' + lesson_id)
        for step in worked['steps']:
            checked += equalities(step, strict=False)
        for section in lesson['sections']:
            for paragraph in section['paragraphs']:
                checked += equalities(paragraph, strict=False)
        for pitfall in lesson['pitfalls']:
            checked += equalities(pitfall, strict=False)
    checked += review_figures(data['figures'])
    return {'worksheets': len(data['worksheets']), 'checkedEqualities': checked, 'lessons': len(lessons), 'figures': len(data['figures'])}


def prime_factors(n):
    out, p = [], 2
    while n > 1:
        while n % p == 0:
            out.append(p)
            n //= p
        p += 1
    return out


def review_figures(figures):
    by_kind = {f['kind']: ET.fromstring(f['html']) for f in figures}
    require(set(by_kind) == {'prime-factor-venn', 'gcf-area', 'multiple-jumps', 'long-division', 'elevation-line', 'opposite-line', 'story-jumps'}, 'Figure inventory')
    checks = 0
    svg = lambda root: next(e for e in root.iter() if e.tag == 'svg')

    venn = by_kind['prime-factor-venn']
    s = svg(venn)
    a, b = int(s.attrib['data-a']), int(s.attrib['data-b'])
    regions = {'left': [], 'shared': [], 'right': []}
    for e in venn.iter():
        if 'data-region' in e.attrib:
            regions[e.attrib['data-region']].append(int(e.attrib['data-prime']))
    require(sorted(regions['left'] + regions['shared']) == prime_factors(a) and sorted(regions['shared'] + regions['right']) == prime_factors(b), 'Venn regions must hold each prime factorization')
    require(not set(regions['left']) & set(regions['right']), 'A prime both numbers contain belongs in the overlap')
    shared = 1
    for p in regions['shared']:
        shared *= p
    gcf_mark = next(e for e in venn.iter() if 'data-gcf' in e.attrib)
    require(shared == gcf(a, b) == int(gcf_mark.attrib['data-gcf']), 'Shared primes must multiply to the GCF')
    checks += 1

    area = svg(by_kind['gcf-area'])
    height, widths = int(area.attrib['data-height']), [int(w) for w in area.attrib['data-widths'].split(',')]
    parts = [int(e.attrib['data-part-area']) for e in by_kind['gcf-area'].iter() if 'data-part-area' in e.attrib]
    require(parts == [height * w for w in widths] and height == gcf(*parts), 'Area model must factor out the GCF')
    rects = [e for e in by_kind['gcf-area'].iter() if 'data-part-area' in e.attrib]
    unit = float(rects[0].attrib['height']) / height
    require(all(abs(float(r.attrib['width']) - w * unit) < 1e-6 for r, w in zip(rects, widths)), 'Area model must be drawn to scale')
    checks += 1

    jumps = by_kind['multiple-jumps']
    landings = {}
    for e in jumps.iter():
        if 'data-landing' in e.attrib:
            step, land = map(int, e.attrib['data-landing'].split(':'))
            landings.setdefault(step, []).append(land)
    steps = [int(x) for x in svg(jumps).attrib['data-steps'].split(',')]
    end = max(max(v) for v in landings.values())
    require(all(landings[s] == list(range(s, end + 1, s)) for s in steps), 'Jumps must land on consecutive multiples')
    common = sorted(set(landings[steps[0]]) & set(landings[steps[1]]))
    require(common == [int(x) for x in svg(jumps).attrib['data-common'].split(',')] == sorted(int(e.attrib['data-common-mark']) for e in jumps.iter() if 'data-common-mark' in e.attrib), 'Common multiples misstated')
    require(common[0] == lcm(*steps), 'First shared landing must be the LCM')
    checks += 1

    division = by_kind['long-division']
    s = svg(division)
    n, d, q = int(s.attrib['data-dividend']), int(s.attrib['data-divisor']), s.attrib['data-quotient']
    require(divide(n, d) == (int(q), 0), 'Layout quotient is wrong')
    rows = [(e.attrib['data-row'], int(e.attrib['data-value']), int(e.attrib['data-end-col'])) for e in division.iter() if 'data-row' in e.attrib]
    digits = str(n)
    # Re-run the algorithm from the dividend's digits and compare the drawn rows.
    expected, partial, i = [], 0, 0
    while partial < d:
        partial = partial * 10 + int(digits[i]); i += 1
    col = i - 1
    for k, qd in enumerate(q):
        product = int(qd) * d
        require(product <= partial < product + d, 'Quotient digit is not the largest that fits')
        if k:
            expected.append(('partial', partial, col))
        expected.append(('product', product, col))
        rest = partial - product
        if col + 1 < len(digits):
            partial = rest * 10 + int(digits[col + 1]); col += 1
        else:
            expected.append(('rest', rest, col))
    require(rows == expected, 'Long-division rows do not follow the algorithm')
    checks += 1

    def geometry(root, axis):
        ticks = {float(e.attrib['data-tick']): float(e.attrib[axis + '1']) for e in root.iter() if e.tag == 'line' and 'data-tick' in e.attrib}
        values = sorted(ticks)
        scale = (ticks[values[-1]] - ticks[values[0]]) / (values[-1] - values[0])
        at = lambda v: ticks[values[0]] + (v - values[0]) * scale
        require(all(abs(ticks[v] - at(v)) < 1e-6 for v in values), 'Ticks must be evenly spaced')
        return at

    elevation = by_kind['elevation-line']
    at = geometry(elevation, 'y')
    marks = [e for e in elevation.iter() if e.tag == 'circle' and 'data-value' in e.attrib]
    require(sorted(float(e.attrib['data-value']) for e in marks) == [-20, 30], 'Elevation points')
    require(all(abs(float(e.attrib['cy']) - at(float(e.attrib['data-value']))) < 1e-4 for e in marks), 'Elevation points must sit on their ticks')
    checks += 1

    opposite = by_kind['opposite-line']
    at = geometry(opposite, 'x')
    s = svg(opposite)
    p, o = float(s.attrib['data-point']), float(s.attrib['data-opposite'])
    require(o == -p, 'Opposite must negate the point')
    marks = {float(e.attrib['data-value']): float(e.attrib['cx']) for e in opposite.iter() if e.tag == 'circle' and 'data-value' in e.attrib}
    require(set(marks) == {p, o} and all(abs(marks[v] - at(v)) < 1e-4 for v in marks) and abs((marks[p] + marks[o]) / 2 - at(0)) < 1e-4, 'Opposites must mirror across 0')
    require({int(e.attrib['data-distance']) for e in opposite.iter() if 'data-distance' in e.attrib} == {abs(int(p))}, 'Distance brackets')
    checks += 1

    story = by_kind['story-jumps']
    at = geometry(story, 'x')
    s = svg(story)
    start, steps, end = Fraction(s.attrib['data-start']), [Fraction(x) for x in s.attrib['data-jumps'].split(',')], Fraction(s.attrib['data-end'])
    require(start + sum(steps) == end, 'Story jumps must add to the end')
    drawn = [Fraction(e.attrib['data-jump']) for e in story.iter() if 'data-jump' in e.attrib]
    require(drawn == steps, 'Drawn jumps disagree')
    marks = {Fraction(e.attrib['data-value']): float(e.attrib['cx']) for e in story.iter() if e.tag == 'circle' and 'data-value' in e.attrib}
    require(set(marks) == {start, end} and all(abs(marks[v] - at(float(v))) < 1e-4 for v in marks), 'Start and end must sit at their values')
    checks += 1
    return checks


def review_content_mutations():
    data = content()
    mutants = []
    bad = copy.deepcopy(data); bad['lessons'][0]['workedExample']['answer'] = '12'; mutants.append(bad)
    bad = copy.deepcopy(data); bad['worksheets'][0]['problems'][1] = bad['worksheets'][0]['problems'][0]; mutants.append(bad)
    bad = copy.deepcopy(data); bad['worksheets'][0]['problems'][0]['explanation'].append('A false check: 4 × 3 = 13.'); mutants.append(bad)
    bad = copy.deepcopy(data); bad['worksheets'][-1]['problems'][0]['answer'] = '999'; mutants.append(bad)
    bad = copy.deepcopy(data); bad['lessons'][2]['sections'][1]['paragraphs'][0] = bad['lessons'][2]['sections'][1]['paragraphs'][0].replace('87 − 72 = 15', '87 − 72 = 25'); mutants.append(bad)
    replacements = {'prime-factor-venn': ('data-prime="3"', 'data-prime="5"'), 'gcf-area': ('data-part-area="8"', 'data-part-area="9"'),
                    'multiple-jumps': ('data-landing="8:24"', 'data-landing="8:25"'), 'long-division': ('data-value="144"', 'data-value="154"'),
                    'elevation-line': ('data-value="30"', 'data-value="20"'), 'opposite-line': ('data-opposite="6"', 'data-opposite="5"'),
                    'story-jumps': ('data-end="-1.75"', 'data-end="-1.5"')}
    for index, figure in enumerate(data['figures']):
        old, new = replacements[figure['kind']]
        bad = copy.deepcopy(data)
        require(old in bad['figures'][index]['html'], 'Figure mutation did not apply: ' + figure['kind'])
        bad['figures'][index]['html'] = bad['figures'][index]['html'].replace(old, new, 1)
        mutants.append(bad)
    for bad in mutants:
        try:
            review_number_system_content(bad)
        except (ValueError, KeyError, TypeError, StopIteration, AttributeError, IndexError):
            pass
        else:
            raise ValueError('Corrupted content accepted')
    return len(mutants)


if __name__ == '__main__':
    print(review_number_system_fixtures())
    print(review_number_system_content())
    print({'contentMutantsRejected': review_content_mutations()})
