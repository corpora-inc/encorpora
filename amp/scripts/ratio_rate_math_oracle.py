"""Independent prompt-and-figure checks for ratios, rates and multiplicative stories.

Answers are re-derived from the public prompt and figure only. Ratio tables and
double number lines are solved by cross-multiplication against a complete
column, not by the simplest-ratio or unit-rate steps the generator teaches;
stories are solved by searching the factor pairs within 100. Malformed,
inconsistent or ambiguous prompts are rejected.
"""
import ast
import copy
import json
import re
import subprocess
import xml.etree.ElementTree as ET
from fractions import Fraction
from pathlib import Path

RATE = frozenset({'unit-rate', 'fraction-unit-rate'})
TABLES = frozenset({'ratio-table-missing', 'double-number-line-missing'})
STORIES = frozenset({'story-operation-choice', 'multiplication-division-story'})
CHOICE_TYPES = frozenset({'better-buy', 'story-operation-choice'})
RATIO_RATE = RATE | TABLES | STORIES | {'better-buy'}

MONEY = r'(\d+(?:\.\d\d)?)'
FRACTION = r'(\d+/\d+|\d+)'
NAME = r'([A-Z][a-z]+)'


def require(condition, message):
    if not condition:
        raise ValueError(message)


def number(text):
    """Exact value of a whole number, decimal or a/b written in a prompt."""
    require(re.fullmatch(r'\d+(?:\.\d+)?|\d+/\d+', text) is not None, 'Malformed number: ' + text)
    if '/' in text:
        n, d = text.split('/')
        require(int(d) > 0, 'Zero denominator')
        return Fraction(int(n), int(d))
    return Fraction(text)


def proper(text):
    value = number(text)
    require('/' in text and 0 < value < 1 and Fraction(text) == value and value.denominator == int(text.split('/')[1]), 'Expected a proper fraction in lowest terms: ' + text)
    return value


# ---------- unit rates ----------

UNIT_RATE = [
    (r'A printer prints (\d+) pages in (\d+) minutes\. At this rate, how many pages does it print per minute\?', 'Pages per minute', lambda m: number(m[1]) / number(m[2])),
    (r'A car travels (\d+) miles on (\d+) gallons of gas\. How many miles does the car travel per gallon\?', 'Miles per gallon', lambda m: number(m[1]) / number(m[2])),
    (NAME + r' earns ' + MONEY + r' dollars? for (\d+) hours of babysitting\. How many dollars does \1 earn per hour\?', 'Dollars per hour', lambda m: number(m[2]) / number(m[3])),
    (r'A (\d+)-pound bag of apples costs ' + MONEY + r' dollars?\. What is the price per pound, in dollars\?', 'Dollars per pound', lambda m: number(m[2]) / number(m[1])),
    (r'A baker uses (\d+) cups of flour to make (\d+) loaves of bread\. How many cups of flour does each loaf use\?', 'Cups of flour per loaf', lambda m: number(m[1]) / number(m[2])),
    (r'A runner runs (\d+) miles in (\d+) minutes at a steady pace\. How many minutes does it take the runner to run 1 mile\?', 'Minutes per mile', lambda m: number(m[2]) / number(m[1])),
    (r'At a school store, (\d+) pencils cost (\d+) dollars?\. At this price, how many pencils can be bought for 1 dollar\?', 'Pencils per dollar', lambda m: number(m[1]) / number(m[2])),
]


def solve_unit_rate(public):
    for pattern, label, solve in UNIT_RATE:
        m = re.fullmatch(pattern, public['prompt'])
        if m:
            require(public['response']['label'] == label, 'Response label does not name the rate')
            require(all(int(x) >= 2 for x in re.findall(r'(?<![\d.$])\d+(?![\d.])', public['prompt']) if x != '1'), 'Quantities below 2 units')
            answer = solve(m)
            if 'dollar' in public['prompt'] and label.startswith('Dollars'):
                require((answer * 100).denominator == 1, 'Money rate is not whole cents')
            return answer
    raise ValueError('Unrecognized unit-rate prompt: ' + public['prompt'])


def fraction_label(value):
    return str(value.numerator) if value.denominator == 1 else f'{value.numerator}/{value.denominator}'


def check_line(figure, top_label, bottom_label, top, bottom):
    """A fraction-rate figure shows 0, the given pair and the 1-unit mark, with the rate unknown."""
    require(figure and figure['kind'] == 'double-number-line', 'Missing double number line')
    t, b = figure['top'], figure['bottom']
    require(t['label'] == top_label and b['label'] == bottom_label, 'Line labels do not match the story')
    require(t['numerators'] == [0, top * t['denominator'], None] and Fraction(t['numerators'][1], t['denominator']) == top, 'Top line does not show the given amount')
    require([Fraction(n, b['denominator']) for n in b['numerators']] == [0, bottom, 1], 'Bottom line must show 0, the given units and 1')


def solve_fraction_rate(public):
    p, fig = public['prompt'], public.get('figure')
    m = re.fullmatch(NAME + r' walks ' + FRACTION + r' (mile|miles) in ' + FRACTION + r' hour\. At this rate, how many miles does \1 walk in 1 hour\?', p)
    if m:
        a, c = proper(m[2]), proper(m[4])
        require(m[3] == 'mile', 'A distance of at most 1 mile is singular')
        check_line(fig, 'Miles', 'Hours', a, c)
        require(public['response']['label'] == 'Miles per hour', 'Label')
        return a / c
    m = re.fullmatch(r'A recipe uses ' + FRACTION + r' cup of sugar for every ' + FRACTION + r' cup of flour\. How many cups of sugar does it use for 1 cup of flour\?', p)
    if m:
        a, c = proper(m[1]), proper(m[2])
        check_line(fig, 'Sugar (cups)', 'Flour (cups)', a, c)
        require(public['response']['label'] == 'Cups of sugar per cup of flour', 'Label')
        return a / c
    m = re.fullmatch(NAME + r' buys ' + FRACTION + r' pound of cheese for (\d+) dollars?\. What is the price of 1 pound of cheese, in dollars\?', p)
    if m:
        c, a = proper(m[2]), number(m[3])
        check_line(fig, 'Cost ($)', 'Pounds', a, c)
        require(public['response']['label'] == 'Dollars per pound', 'Label')
        require(((a / c) * 100).denominator == 1, 'Price is not whole cents')
        return a / c
    m = re.fullmatch(NAME + r' mows ' + FRACTION + r' of a lawn in ' + FRACTION + r' hour\. At this rate, how many lawns does \1 mow in 1 hour\?', p)
    if m:
        a, c = proper(m[2]), proper(m[3])
        check_line(fig, 'Lawns', 'Hours', a, c)
        require(public['response']['label'] == 'Lawns per hour', 'Label')
        return a / c
    raise ValueError('Unrecognized fraction-rate prompt: ' + p)


# ---------- better buy ----------

GOODS = {'granola bar': 'granola bars', 'juice box': 'juice boxes', 'pencil': 'pencils', 'ounce': 'ounces'}


def article(n):
    return 'an' if str(n).startswith('8') or n in (11, 18) else 'a'


def parse_pack(text, item):
    if item == 'ounce':
        m = re.fullmatch(r'(an?) (\d+)-ounce box of cereal', text)
        require(m and m[1] == article(int(m[2])), 'Malformed cereal box: ' + text)
        return int(m[2])
    m = re.fullmatch(r'a pack of (\d+) ' + re.escape(GOODS[item]), text)
    require(m is not None, 'Malformed pack: ' + text)
    return int(m[1])


def solve_better_buy(public):
    m = re.fullmatch(r'Store A sells (.+?) for ' + MONEY + r' dollars\. Store B sells (.+?) for ' + MONEY + r' dollars\. Which is the better buy, with the lower price per (granola bar|juice box|pencil|ounce)\?', public['prompt'])
    require(m is not None, 'Unrecognized better-buy prompt')
    item = m[5]
    na, nb = parse_pack(m[1], item), parse_pack(m[3], item)
    require(na != nb and min(na, nb) >= 2, 'Packs must differ in size')
    require('.' in m[2] and '.' in m[4], 'Prices show cents')
    ua, ub = number(m[2]) / na, number(m[4]) / nb
    require((ua * 100).denominator == 1 and (ub * 100).denominator == 1, 'Unit prices must be whole cents')
    options = {o['label']: o['id'] for o in public['response']['options']}
    same = f'The same price per {item}'
    require(set(options) == {'Store A', 'Store B', same}, 'Option set')
    require([o['label'] for o in public['response']['options']] == ['Store A', 'Store B', same], 'Options keep store order')
    return options['Store A' if ua < ub else 'Store B' if ub < ua else same]


# ---------- ratio tables and double number lines ----------

TABLE_CONTEXTS = {
    'flour to sugar, in cups': ('Flour (cups)', 'Sugar (cups)'),
    'blue beads to white beads in a necklace': ('Blue beads', 'White beads'),
    'laps run to minutes at a steady pace': ('Laps', 'Minutes'),
    'tickets to their cost in dollars': ('Tickets', 'Cost ($)'),
    'red paint to white paint, in liters': ('Red paint (L)', 'White paint (L)'),
}


def cross_solve(columns):
    """columns: (top, bottom) exact values with one None. Solve by cross-multiplication."""
    unknown = [(i, j) for i, c in enumerate(columns) for j in (0, 1) if c[j] is None]
    require(len(unknown) == 1, 'Exactly one unknown value')
    full = [c for c in columns if None not in c and c != (0, 0)]
    require(full, 'No complete pair')
    a, b = full[0]
    require(a > 0 and b > 0, 'Complete pair must be positive')
    require(all(x * b == y * a for x, y in full), 'Columns are not equivalent ratios')
    i, j = unknown[0]
    other = columns[i][1 - j]
    require(other > 0, 'Unknown must pair with a positive value')
    return other * a / b if j == 0 else other * b / a


def solve_ratio_table(public):
    m = re.fullmatch(r'The table shows equivalent ratios of (.+)\. What number belongs in the cell with the question mark\?', public['prompt'])
    require(m and m[1] in TABLE_CONTEXTS, 'Unrecognized ratio-table prompt')
    fig = public.get('figure')
    require(fig and fig['kind'] == 'ratio-table', 'Missing ratio table')
    top, bottom = fig['rows']
    require((top['label'], bottom['label']) == TABLE_CONTEXTS[m[1]], 'Row labels do not match the prompt')
    require(len(top['values']) == len(bottom['values']) and 3 <= len(top['values']) <= 4, 'Table shape')
    columns = [(None if t is None else Fraction(t), None if b is None else Fraction(b)) for t, b in zip(top['values'], bottom['values'])]
    known = [v for c in columns for v in c if v is not None]
    require(all(v > 0 and v.denominator == 1 for v in known), 'Entries are positive whole numbers')
    tops = [c[0] for c in columns]
    answer = cross_solve(columns)
    require(answer.denominator == 1, 'Missing entry is not a whole number')
    filled = [answer if v is None else v for v in tops]
    require(filled == sorted(filled) and len(set(filled)) == len(filled), 'Columns increase')
    require(public['response']['label'] == 'Missing number', 'Label')
    return answer


LINES = {
    'A train travels at a constant speed. The double number line shows its distance and time.': ('Miles', 'Hours', r'How many miles does the train travel in (\d+) (hour|hours)\?', r'How many hours does it take the train to travel (\d+) miles\?', 'Miles', 'Hours'),
    'Grapes cost the same amount for every pound. The double number line shows cost and weight.': ('Cost ($)', 'Pounds', r'How many dollars (do|does) (\d+) (pound|pounds) of grapes cost\?', r'How many pounds of grapes cost (\d+) dollars?\?', 'Dollars', 'Pounds'),
    'Jo reads at a steady pace. The double number line shows pages read and minutes.': ('Pages', 'Minutes', r'How many pages does Jo read in (\d+) (minute|minutes)\?', r'How many minutes does it take Jo to read (\d+) pages\?', 'Pages', 'Minutes'),
    'A rice recipe uses the same ratio of water to rice in every batch. The double number line shows cups of each.': ('Water (cups)', 'Rice (cups)', r'How many cups of water go with (\d+) (cup|cups) of rice\?', r'How many cups of rice go with (\d+) cups of water\?', 'Cups of water', 'Cups of rice'),
}


def line_values(line):
    return [None if n is None else Fraction(n, line['denominator']) for n in line['numerators']]


def solve_double_line(public):
    fig = public.get('figure')
    require(fig and fig['kind'] == 'double-number-line', 'Missing double number line')
    lead = next((k for k in LINES if public['prompt'].startswith(k + ' ')), None)
    require(lead is not None, 'Unrecognized double-number-line story')
    top_label, bottom_label, ask_top, ask_bottom, label_top, label_bottom = LINES[lead]
    ask = public['prompt'][len(lead) + 1:]
    require(fig['top']['label'] == top_label and fig['bottom']['label'] == bottom_label, 'Line labels')
    require(fig['top']['denominator'] == 1 and fig['bottom']['denominator'] == 1, 'Whole-number marks')
    tops, bottoms = line_values(fig['top']), line_values(fig['bottom'])
    require(len(tops) == 3 and tops[0] == 0 and bottoms[0] == 0, 'Lines start at 0 with two more marks')
    columns = list(zip(tops, bottoms))
    answer = cross_solve(columns)
    m = re.fullmatch(ask_top, ask)
    if m:
        groups = [g for g in m.groups() if g and g.isdigit()]
        given = Fraction(int(groups[0]))
        word = m.groups()[-1]
        require(word in ('hour', 'minute', 'pound', 'cup') if given == 1 else word.endswith('s'), 'Unit agreement')
        if lead.startswith('Grapes'):
            require(m[1] == ('does' if given == 1 else 'do'), 'Verb agreement')
        require(any(t is None and b == given for t, b in columns), 'Asked bottom value is not the unknown column')
        require(public['response']['label'] == label_top, 'Label')
    else:
        m = re.fullmatch(ask_bottom, ask)
        require(m is not None, 'Unrecognized question')
        given = Fraction(int(m[1]))
        require(any(b is None and t == given for t, b in columns), 'Asked top value is not the unknown column')
        require(public['response']['label'] == label_bottom, 'Label')
    require(answer.denominator == 1 and answer > 0, 'Answer is a positive whole number')
    filled = [answer if b is None else b for t, b in columns]
    require(filled == sorted(filled) and len(set(filled)) == 3, 'Marks increase along the line')
    return answer


# ---------- multiplicative stories ----------

STORY = [
    # (pattern, unknown, group noun, item noun)
    (NAME + r' fills (\d+) bags with (\d+) apples in each bag\.', 'product', 'bags', 'apples'),
    (NAME + r' packs (\d+) apples equally into (\d+) bags\.', 'size', 'bags', 'apples'),
    (NAME + r' packs (\d+) apples into bags, with (\d+) apples in each bag\.', 'groups', 'bags', 'apples'),
    (NAME + r' sets up (\d+) rows of chairs with (\d+) chairs in each row\.', 'product', 'rows', 'chairs'),
    (NAME + r' sets up (\d+) chairs in (\d+) equal rows\.', 'size', 'rows', 'chairs'),
    (NAME + r' sets up (\d+) chairs in rows of (\d+) chairs\.', 'groups', 'rows', 'chairs'),
    (NAME + r' cuts a ribbon into (\d+) pieces that are each (\d+) centimeters long, with none left over\.', 'product', 'pieces', 'centimeters'),
    (NAME + r' cuts a (\d+)-centimeter ribbon into (\d+) pieces of equal length\.', 'size', 'pieces', 'centimeters'),
    (NAME + r' cuts a (\d+)-centimeter ribbon into pieces that are each (\d+) centimeters long\.', 'groups', 'pieces', 'centimeters'),
    (NAME + r' fills (\d+) jugs with (\d+) liters of water each\.', 'product', 'jugs', 'liters'),
    (NAME + r' pours (\d+) liters of water equally into (\d+) jugs\.', 'size', 'jugs', 'liters'),
    (NAME + r' pours (\d+) liters of water into jugs that each hold (\d+) liters, filling every jug\.', 'groups', 'jugs', 'liters'),
]
QUESTIONS = {
    ('product', 'apples'): ('How many apples are in the bags in all?', 'the total number of apples'),
    ('size', 'apples'): ('How many apples go in each bag?', 'the number of apples in each bag'),
    ('groups', 'apples'): ('How many bags does {name} fill?', 'the number of bags'),
    ('product', 'chairs'): ('How many chairs are there in all?', 'the total number of chairs'),
    ('size', 'chairs'): ('How many chairs are in each row?', 'the number of chairs in each row'),
    ('groups', 'chairs'): ('How many rows are there?', 'the number of rows'),
    ('product', 'centimeters'): ('How long was the ribbon, in centimeters?', 'the length of the ribbon'),
    ('size', 'centimeters'): ('How long is each piece, in centimeters?', 'the length of each piece'),
    ('groups', 'centimeters'): ('How many pieces does {name} cut?', 'the number of pieces'),
    ('product', 'liters'): ('How many liters of water is that in all?', 'the total number of liters'),
    ('size', 'liters'): ('How many liters go in each jug?', 'the number of liters in each jug'),
    ('groups', 'liters'): ('How many jugs does {name} fill?', 'the number of jugs'),
}


def parse_story(prompt):
    for pattern, unknown, groups, items in STORY:
        m = re.match(pattern + ' ', prompt)
        if m:
            x, y = int(m[2]), int(m[3])
            # Search the factor pairs within 100 for the one story the numbers describe.
            if unknown == 'product':
                pairs = [(g, s) for g in range(2, 11) for s in range(2, 11) if (g, s) == (x, y)]
            elif unknown == 'size':
                pairs = [(g, s) for g in range(2, 11) for s in range(2, 11) if g == y and g * s == x]
            else:
                pairs = [(g, s) for g in range(2, 11) for s in range(2, 11) if s == y and g * s == x]
            require(len(pairs) == 1, 'Story numbers are not a whole equal-groups story within 100')
            g, s = pairs[0]
            require(g != s and g * s <= 100, 'Story outside scope')
            return m, unknown, groups, items, g, s, prompt[m.end():]
    raise ValueError('Unrecognized story: ' + prompt)


def solve_story(public):
    m, unknown, groups, items, g, s, rest = parse_story(public['prompt'])
    question, find = QUESTIONS[(unknown, items)]
    answer = {'product': g * s, 'size': s, 'groups': g}[unknown]
    if public['templateId'] == 'multiplication-division-story':
        require(rest == question.format(name=m[1]), 'Question does not match the story')
        label = f'Number of {groups}' if unknown == 'groups' else 'Centimeters' if items == 'centimeters' else 'Liters' if items == 'liters' else f'Number of {items}'
        require(public['response']['label'] == label, 'Label')
        return Fraction(answer)
    require(rest == f'Which equation can be used to find {find}?', 'Choice question does not match the story')
    x, y = (g, s) if unknown == 'product' else (g * s, g if unknown == 'size' else s)
    big, small = max(x, y), min(x, y)
    labels = {o['label']: o['id'] for o in public['response']['options']}
    require(set(labels) == {f'{x} + {y} = ?', f'{big} − {small} = ?', f'{x} × {y} = ?', f'{big} ÷ {small} = ?'}, 'Equation options')
    return labels[f'{g} × {s} = ?' if unknown == 'product' else f'{g * s} ÷ {y} = ?']


def solve_ratio_rate(public):
    template = public['templateId']
    require(template in RATIO_RATE, 'Unknown ratio-rate task')
    kind = public['response']['kind']
    require(kind == ('choice' if template in CHOICE_TYPES else 'fraction' if template in RATE else 'number'), 'Response kind')
    if template not in TABLES and template != 'fraction-unit-rate':
        require(public.get('figure') is None, 'Unexpected figure')
    return {
        'unit-rate': solve_unit_rate,
        'better-buy': solve_better_buy,
        'ratio-table-missing': solve_ratio_table,
        'double-number-line-missing': solve_double_line,
        'fraction-unit-rate': solve_fraction_rate,
        'story-operation-choice': solve_story,
        'multiplication-division-story': solve_story,
    }[template](public)


# ---------- explanations ----------

def value(source):
    """Exact value of a displayed expression: × ÷ + −, a/b fractions, decimals and $ amounts."""
    text = source.strip().replace('$', '')
    text = re.sub(r'(\d+(?:\.\d+)?)/(\d+)', r'(\1/\2)', text)
    text = text.replace('−', '-').replace('×', '*').replace('÷', '/')
    tree = ast.parse(text, mode='eval')

    def visit(node):
        if isinstance(node, ast.Constant) and type(node.value) in (int, float):
            return Fraction(str(node.value))
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.USub):
            return -visit(node.operand)
        if isinstance(node, ast.BinOp):
            a, b = visit(node.left), visit(node.right)
            op = type(node.op)
            if op is ast.Add: return a + b
            if op is ast.Sub: return a - b
            if op is ast.Mult: return a * b
            if op is ast.Div: return a / b
        raise ValueError('Unsupported arithmetic claim: ' + source)
    return visit(tree.body)


TRAILING = re.compile(r'[$(\d][\d ().$×÷+/−]*$')
LEADING = re.compile(r'^[$(\d−][\d ().$×÷+/−]*')


def equalities(step):
    """Check each adjacent pair in every 'a = b = c' chain; '= ?' marks an unknown."""
    parts = step.split(' = ')
    checked = 0
    for left, right in zip(parts, parts[1:]):
        if right.startswith('?'):
            continue
        a, b = TRAILING.search(left), LEADING.match(right)
        require(a is not None and b is not None, 'Equality without arithmetic: ' + step)
        require(value(a[0].strip(' .')) == value(b[0].rstrip(' .,')), 'False equality in worked arithmetic: ' + step)
        checked += 1
    return checked


def shown(answer):
    if isinstance(answer, str):
        return None
    return fraction_label(answer)


def review_problem(problem):
    public, steps = problem['public'], problem['explanation']
    template = public['templateId']
    solved = solve_ratio_rate(public)
    require(len(steps) >= 3 and problem['hint'], 'Explanation or hint missing')
    chains = sum(equalities(s) for s in steps)
    require(chains >= 1, 'Explanation has no checked arithmetic')
    final, joined = steps[-1], ' '.join(steps)
    if template in CHOICE_TYPES:
        require(problem['answer'] == solved, 'Mismatch: wrong option')
        label = next(o['label'] for o in public['response']['options'] if o['id'] == solved)
        if template == 'story-operation-choice':
            require(final.startswith(label), 'Final step does not name the matching equation')
        else:
            require(('Store ' + label[-1]) in final or ('neither' in final and label.startswith('The same')), 'Final step does not name the better buy')
        feedback = problem.get('choiceFeedback') or {}
        require(set(feedback) == {o['id'] for o in public['response']['options']} - {solved}, 'Every distractor needs feedback')
        return chains
    answer = number(problem['answer'])
    require(answer == solved, 'Mismatch: incorrect exact answer')
    as_text = [fraction_label(answer)]
    if answer.denominator in (2, 4, 5, 10, 20, 25, 50, 100):
        as_text.append(f'{float(answer):.2f}')
    require(any(re.search(r'(?<![\d/.])' + re.escape(t) + r'(?![\d/])', final) for t in as_text), 'Final step does not state the answer')
    prompt = public['prompt']
    if template == 'unit-rate':
        nums = [number(x) for x in re.findall(r'\d+(?:\.\d\d)?', prompt) if x != '1']
        m = re.search(r': ([\d.]+)(?: dollars?)? ÷ (\d+) = ', joined)
        require(m is not None and number(m[1]) / number(m[2]) == solved and {number(m[1]), number(m[2])} <= set(nums), 'Division must use the given quantities in the asked order')
    elif template == 'fraction-unit-rate':
        m = re.search(r': ' + FRACTION + r' ÷ ' + FRACTION + r'\.', steps[0])
        require(m is not None and number(m[1]) / number(m[2]) == solved, 'Fraction division must divide the amount by the units')
    elif template == 'ratio-table-missing':
        m = re.search(r'the ratio is (\d+) : (\d+)|simplest ratio, (\d+) : (\d+)', steps[0])
        require(m is not None, 'Missing simplest ratio')
        p, s = (int(m[1]), int(m[2])) if m[1] else (int(m[3]), int(m[4]))
        top, bottom = public['figure']['rows']
        full = [(t, b) for t, b in zip(top['values'], bottom['values']) if t is not None and b is not None]
        g = Fraction(full[0][0], full[0][1])
        require(Fraction(p, s) == g and Fraction(p, s).numerator == p, 'Simplest ratio misstated')
    elif template == 'double-number-line-missing':
        m = re.search(r'Find the [a-z ]+?(?:in|for) 1 [a-z ]+: (\d+) ÷ (\d+) = (\d+)\.', joined)
        require(m is not None, 'Missing unit rate step')
        cols = [(t, b) for t, b in zip(line_values(public['figure']['top']), line_values(public['figure']['bottom'])) if t and b]
        require(Fraction(int(m[1]), int(m[2])) == cols[0][0] / cols[0][1], 'Unit rate misstated')
    elif template == 'multiplication-division-story':
        _, unknown, *_ = parse_story(prompt)
        require(('×' if unknown == 'product' else '÷') in steps[1], 'Operation does not match the unknown')
    return chains


# ---------- authored content ----------

_EXPORT = None


def content(data=None):
    """Authored content, exported once per process; callers receive a private copy."""
    global _EXPORT
    if data is not None:
        return data
    if _EXPORT is None:
        app = Path(__file__).resolve().parent.parent
        _EXPORT = subprocess.check_output(['node', '--import', 'tsx', 'scripts/ratio-rate-content-oracle.ts'], cwd=app, text=True)
    return json.loads(_EXPORT)


def story_breadth(prompts):
    parsed = [parse_story(p) for p in prompts]
    return {x[1] for x in parsed} == {'product', 'size', 'groups'} and {x[3] for x in parsed} == {'apples', 'chairs', 'centimeters', 'liters'}


WORKSHEET_BREADTH = {
    'unit-rate': lambda answers, prompts: all(any(k in p for p in prompts) for k in ('runner', 'pencils', 'baker', 'printer', 'car', 'babysitting', 'apples')) and any('dollar' in p and a.denominator > 1 for a, p in zip(answers, prompts)) and any('baker' in p and a.denominator > 1 for a, p in zip(answers, prompts)),
    'better-buy': lambda answers, prompts: len({a for a in answers}) == 3 and any('cereal' in p for p in prompts),
    'ratio-table-missing': lambda answers, prompts: len({p for p in prompts}) == 5,
    'double-number-line-missing': lambda answers, prompts: any('How many hours' in p or 'How many pounds' in p or 'How many minutes' in p or 'cups of rice go' in p for p in prompts) and len({p.split('.')[0] for p in prompts}) == 4,
    'fraction-unit-rate': lambda answers, prompts: {'walks', 'recipe', 'cheese', 'lawn'} <= {w for p in prompts for w in ('walks', 'recipe', 'cheese', 'lawn') if w in p} and any(a.denominator > 1 for a in answers) and any(a.denominator == 1 for a in answers),
    'story-operation-choice': lambda answers, prompts: story_breadth(prompts),
    'multiplication-division-story': lambda answers, prompts: story_breadth(prompts),
}

# Worked examples, re-derived by hand from their prompts.
WORKED = {
    'unit-rate': Fraction(34, 4),
    'better-buy': 'Store B' if Fraction(440, 20) < Fraction(300, 12) else 'Store A',
    'ratio-table-missing': Fraction(14 * 6, 4),
    'double-number-line-missing': Fraction(45, 3) * 5,
    'fraction-unit-rate': Fraction(3, 4) / Fraction(2, 3),
    'story-operation-choice': '42 ÷ 7 = ?',
    'multiplication-division-story': Fraction(36, 4),
}


def review_ratio_rate_content(data=None):
    data = content(data)
    chains = 0
    for sheet in data['worksheets']:
        problems = sheet['problems']
        require(len(problems) == 12, 'Worksheet length')
        keys = [json.dumps([p['public']['prompt'], p['public'].get('figure')]) for p in problems]
        require(len(set(keys)) == 12, 'Repeated worksheet problem')
        prompts = [p['public']['prompt'] for p in problems]
        answers = []
        for p in problems:
            solved = solve_ratio_rate(p['public'])
            answers.append(solved)
            chains += review_problem(p)
        require(WORKSHEET_BREADTH[sheet['templateId']](answers, prompts), 'Worksheet lacks required breadth: ' + sheet['templateId'] + '/' + sheet['edition'])
    lessons = {lesson['id']: lesson for lesson in data['lessons']}
    require(set(lessons) == RATIO_RATE, 'Missing standalone lesson')
    for template, lesson in lessons.items():
        require(template in lesson['templateIds'], 'Lesson binds its template')
        worked = lesson['workedExample']
        expected = WORKED[template]
        if isinstance(expected, str):
            require(worked['answer'] == expected, 'Worked example answer: ' + template)
        else:
            require(number(worked['answer']) == expected, 'Worked example answer: ' + template)
        for step in worked['steps']:
            chains += equalities(step)
        for section in lesson['sections']:
            for paragraph in section['paragraphs']:
                chains += equalities(paragraph)
    chains += review_figures(data['figures'])
    chains += review_rendered(data['rendered'])
    return {'worksheets': len(data['worksheets']), 'checkedEqualities': chains, 'lessons': len(lessons), 'figures': len(data['figures']), 'renderedFigures': len(data['rendered'])}


def svg(html):
    return ET.fromstring(html)


def review_figures(figures):
    by_kind = {f['kind']: svg(f['html']) for f in figures}
    require(set(by_kind) == {'rate-double-line', 'unit-price-tapes', 'ratio-table-scaling', 'rate-through-one', 'fraction-rate-copies', 'story-tapes'}, 'Figure inventory')
    checks = 0
    for kind, rate in (('rate-double-line', Fraction(22)), ('rate-through-one', Fraction(15)), ('fraction-rate-copies', Fraction(2))):
        pairs = [(e.attrib['data-pair'].split(','), float(e.attrib['data-at'])) for e in by_kind[kind].iter() if 'data-pair' in e.attrib]
        bottoms = [number(b) for (b, _), _ in pairs]
        require(len(pairs) >= 4 and bottoms[0] == 0, 'Double line pairs: ' + kind)
        for (b, t), at in pairs:
            require(number(t) == rate * number(b), 'Aligned pair breaks the rate: ' + kind)
            require(abs(at - float(number(b) / max(bottoms))) < 1e-9, 'Mark not at true scale: ' + kind)
            checks += 1
    widths = []
    for e in by_kind['unit-price-tapes'].iter():
        if 'data-pack' in e.attrib:
            parts = [p for p in e.iter() if 'data-part-cents' in p.attrib]
            total = int(e.attrib['data-total-cents'])
            require(len(parts) == int(e.attrib['data-parts']), 'Part count')
            require(all(Fraction(p.attrib['data-part-cents']) * len(parts) == total for p in parts), 'Equal parts must make the total')
            widths += [float(p.attrib['data-width']) / float(p.attrib['data-part-cents']) for p in parts]
            checks += 1
    require(len(widths) == 14 and max(widths) - min(widths) < 1e-9, 'Both tapes must share one money scale')
    for e in by_kind['ratio-table-scaling'].iter():
        if 'data-column' in e.attrib:
            m, top, bottom = map(int, e.attrib['data-column'].split(','))
            p, s = map(int, e.attrib['data-simplest'].split(','))
            require((top, bottom) == (m * p, m * s), 'Column is not the simplest ratio times its multiplier')
            checks += 1
    for e in by_kind['story-tapes'].iter():
        if 'data-unknown' in e.attrib and 'data-total' in e.attrib:
            require(int(e.attrib['data-total']) == int(e.attrib['data-parts']) * int(e.attrib['data-size']), 'Tape parts must make the total')
            checks += 1
    return checks


def review_rendered(rendered):
    """Problem figures: every mark sits at its true-scale position on both lines."""
    checks = 0
    for item in rendered:
        fig, root = item['figure'], svg(item['html'])
        require(item['templateId'] in TABLES | {'fraction-unit-rate'}, 'Unexpected figure source')
        if fig['kind'] == 'ratio-table':
            unknown = [e for e in root.iter() if e.attrib.get('data-unknown') == 'true']
            require(len(unknown) == 1, 'One marked unknown cell')
            checks += 1
            continue
        tops, bottoms = line_values(fig['top']), line_values(fig['bottom'])
        full = next(i for i in range(1, len(tops)) if tops[i] is not None and bottoms[i] is not None)
        scale = bottoms[full] / tops[full]
        positions = [b if b is not None else t * scale for t, b in zip(tops, bottoms)]
        xs = []
        for e in root.iter():
            if 'data-column' in e.attrib:
                lines = [c for c in e if c.tag.endswith('line')]
                require(len({c.attrib['x1'] for c in lines}) == 1 and all(c.attrib['x1'] == c.attrib['x2'] for c in lines), 'Ticks on both lines must align')
                xs.append(float(lines[0].attrib['x1']))
        require(len(xs) == len(positions), 'One tick per column')
        span = xs[-1] - xs[0] if positions[-1] == max(positions) else None
        require(span, 'Last mark is the farthest')
        for x, p in zip(xs, positions):
            require(abs((x - xs[0]) / span - float(p / max(positions))) < 1e-9, 'Tick not at true scale')
        checks += 1
    return checks


def review_ratio_rate_fixtures():
    def case(template, prompt, figure=None, label=None, options=None):
        kind = 'choice' if template in CHOICE_TYPES else 'fraction' if template in RATE else 'number'
        response = {'kind': kind, 'label': label or 'Choose one answer'}
        if options:
            response['options'] = [{'id': f'option-{"abcd"[i]}', 'label': o} for i, o in enumerate(options)]
        public = {'templateId': template, 'prompt': prompt, 'response': response}
        if figure:
            public['figure'] = figure
        return public
    table = {'kind': 'ratio-table', 'rows': [{'label': 'Flour (cups)', 'values': [4, 10, 14]}, {'label': 'Sugar (cups)', 'values': [6, 15, None]}]}
    line = {'kind': 'double-number-line', 'top': {'label': 'Miles', 'denominator': 1, 'numerators': [0, 45, None]}, 'bottom': {'label': 'Hours', 'denominator': 1, 'numerators': [0, 3, 5]}}
    walk = {'kind': 'double-number-line', 'top': {'label': 'Miles', 'denominator': 2, 'numerators': [0, 1, None]}, 'bottom': {'label': 'Hours', 'denominator': 4, 'numerators': [0, 1, 4]}}
    good = [
        (case('unit-rate', 'A printer prints 132 pages in 6 minutes. At this rate, how many pages does it print per minute?', label='Pages per minute'), Fraction(22)),
        (case('unit-rate', 'Ana earns 67.50 dollars for 5 hours of babysitting. How many dollars does Ana earn per hour?', label='Dollars per hour'), Fraction(27, 2)),
        (case('unit-rate', 'A runner runs 4 miles in 36 minutes at a steady pace. How many minutes does it take the runner to run 1 mile?', label='Minutes per mile'), Fraction(9)),
        (case('unit-rate', 'A baker uses 9 cups of flour to make 4 loaves of bread. How many cups of flour does each loaf use?', label='Cups of flour per loaf'), Fraction(9, 4)),
        (case('better-buy', 'Store A sells a pack of 6 granola bars for 4.50 dollars. Store B sells a pack of 8 granola bars for 5.60 dollars. Which is the better buy, with the lower price per granola bar?', options=['Store A', 'Store B', 'The same price per granola bar']), 'option-b'),
        (case('better-buy', 'Store A sells an 8-ounce box of cereal for 2.00 dollars. Store B sells a 12-ounce box of cereal for 3.00 dollars. Which is the better buy, with the lower price per ounce?', options=['Store A', 'Store B', 'The same price per ounce']), 'option-c'),
        (case('ratio-table-missing', 'The table shows equivalent ratios of flour to sugar, in cups. What number belongs in the cell with the question mark?', table, 'Missing number'), Fraction(21)),
        (case('double-number-line-missing', 'A train travels at a constant speed. The double number line shows its distance and time. How many miles does the train travel in 5 hours?', line, 'Miles'), Fraction(75)),
        (case('fraction-unit-rate', 'Ana walks 1/2 mile in 1/4 hour. At this rate, how many miles does Ana walk in 1 hour?', walk, 'Miles per hour'), Fraction(2)),
        (case('multiplication-division-story', 'Sam packs 48 apples into bags, with 8 apples in each bag. How many bags does Sam fill?', label='Number of bags'), Fraction(6)),
        (case('story-operation-choice', 'Jo sets up 18 chairs in 3 equal rows. Which equation can be used to find the number of chairs in each row?', options=['18 − 3 = ?', '18 × 3 = ?', '18 ÷ 3 = ?', '18 + 3 = ?']), 'option-c'),
    ]
    for public, expected in good:
        require(solve_ratio_rate(public) == expected, 'Independent handwritten mismatch: ' + public['prompt'])
    bad_table = copy.deepcopy(table); bad_table['rows'][0]['values'] = [4, 11, 14]
    bad_line = copy.deepcopy(line); bad_line['bottom']['numerators'] = [0, 3, 4]
    bad = [
        case('unit-rate', 'A printer prints 132 pages in 6 minutes. At this rate, how many minutes does it take per page?', label='Pages per minute'),
        case('unit-rate', 'A baker uses 9 cups of flour to make 4 loaves of bread. How many cups of flour does each loaf use?', label='Pages per minute'),
        case('better-buy', 'Store A sells a 8-ounce box of cereal for 2.00 dollars. Store B sells a 12-ounce box of cereal for 3.00 dollars. Which is the better buy, with the lower price per ounce?', options=['Store A', 'Store B', 'The same price per ounce']),
        case('better-buy', 'Store A sells a pack of 6 granola bars for 4.50 dollars. Store B sells a pack of 6 granola bars for 5.60 dollars. Which is the better buy, with the lower price per granola bar?', options=['Store A', 'Store B', 'The same price per granola bar']),
        case('ratio-table-missing', 'The table shows equivalent ratios of flour to sugar, in cups. What number belongs in the cell with the question mark?', bad_table, 'Missing number'),
        case('double-number-line-missing', 'A train travels at a constant speed. The double number line shows its distance and time. How many miles does the train travel in 5 hours?', bad_line, 'Miles'),
        case('fraction-unit-rate', 'Ana walks 2/4 mile in 1/4 hour. At this rate, how many miles does Ana walk in 1 hour?', walk, 'Miles per hour'),
        case('multiplication-division-story', 'Sam packs 50 apples into bags, with 8 apples in each bag. How many bags does Sam fill?', label='Number of bags'),
        case('story-operation-choice', 'Jo sets up 18 chairs in 3 equal rows. Which equation can be used to find the number of rows?', options=['18 − 3 = ?', '18 × 3 = ?', '18 ÷ 3 = ?', '18 + 3 = ?']),
    ]
    for public in bad:
        try:
            solve_ratio_rate(public)
        except (ValueError, KeyError, StopIteration):
            continue
        raise ValueError('Malformed or inconsistent prompt accepted: ' + public['prompt'])
    return {'handwritten': len(good), 'mutants': len(bad)}


def review_content_mutations():
    data = content()
    mutants = []
    bad = copy.deepcopy(data); bad['lessons'][0]['workedExample']['answer'] = '9'; mutants.append(bad)
    bad = copy.deepcopy(data); bad['worksheets'][0]['problems'][1] = bad['worksheets'][0]['problems'][0]; mutants.append(bad)
    bad = copy.deepcopy(data); bad['worksheets'][0]['problems'][0]['explanation'].append('A false check: 4 × 3 = 13.'); mutants.append(bad)
    bad = copy.deepcopy(data); bad['worksheets'][-1]['problems'][0]['answer'] = '999'; mutants.append(bad)
    bad = copy.deepcopy(data); bad['lessons'][0]['sections'][1]['paragraphs'][1] = bad['lessons'][0]['sections'][1]['paragraphs'][1].replace('= 88', '= 86'); mutants.append(bad)
    for index, kind in enumerate(f['kind'] for f in data['figures']):
        bad = copy.deepcopy(data)
        html = bad['figures'][index]['html']
        replaced = re.sub(r'data-(pair|part-cents|column|total)="([^"]*)"', lambda m: f'data-{m[1]}="' + {'pair': '1,99', 'part-cents': '99', 'column': '2,4,7', 'total': '49'}[m[1]] + '"', html, count=1)
        require(replaced != html, 'Figure mutation did not apply: ' + kind)
        bad['figures'][index]['html'] = replaced
        mutants.append(bad)
    bad = copy.deepcopy(data)
    item = next(i for i in bad['rendered'] if i['figure']['kind'] == 'double-number-line')
    item['html'] = re.sub(r'(<g data-column="1"><line x1=")([\d.]+)', lambda m: m[1] + str(float(m[2]) + 7), item['html'], count=1)
    mutants.append(bad)
    for bad in mutants:
        try:
            review_ratio_rate_content(bad)
        except (ValueError, KeyError, TypeError, StopIteration, AttributeError):
            pass
        else:
            raise ValueError('Corrupted content accepted')
    return len(mutants)


if __name__ == '__main__':
    print(review_ratio_rate_fixtures())
    print(review_ratio_rate_content())
    print({'contentMutantsRejected': review_content_mutations()})
