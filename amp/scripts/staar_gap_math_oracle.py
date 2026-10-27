"""Independent STAAR-gap review from public prompts, figures and answer choices only."""
import copy
import re
from fractions import Fraction
from math import gcd, isqrt

SUPPORTED = frozenset({
    'staar-nested-grouping', 'staar-signed-exponent-order', 'staar-number-word-form',
    'staar-rename-percent-fraction-decimal', 'staar-ratio-statements', 'staar-story-model-choice',
    'staar-rate-equation-choice', 'staar-order-decimals', 'staar-order-mixed-forms',
    'staar-decimal-operations', 'staar-salary-percent', 'staar-measure-chains',
    'staar-multistep-stories', 'staar-line-from-points', 'staar-stem-leaf-combine',
    'staar-dot-plot-threshold', 'staar-money-vocabulary', 'staar-table-rule-choice',
    'staar-multistep-equations', 'staar-experiment-probability', 'staar-number-sets',
})
CHOICE = SUPPORTED - {
    'staar-nested-grouping', 'staar-signed-exponent-order', 'staar-decimal-operations',
    'staar-salary-percent', 'staar-measure-chains', 'staar-multistep-stories',
    'staar-stem-leaf-combine', 'staar-dot-plot-threshold', 'staar-multistep-equations',
    'staar-experiment-probability',
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def plain(text):
    return text.replace('$', '').replace('\u2212', '-').replace('\\%', '%')


def num(text):
    return Fraction(text.replace('{,}', '').replace(',', ''))


# ---------- exact expression evaluator for the LaTeX subset on the page ----------
def to_python(text):
    s = plain(text).replace('\\ ', ' ').replace('{,}', '')
    s = s.replace('\\times', '*').replace('\\div', '/').replace('\\left', '').replace('\\right', '')
    s = s.replace('[', '(').replace(']', ')')
    s = re.sub(r'(\d+)\\frac\{(\d+)\}\{(\d+)\}', r'(\1+\2/\3)', s)  # mixed number
    for _ in range(4):
        s = re.sub(r'\\frac\{([^{}]*)\}\{([^{}]*)\}', r'((\1)/(\2))', s)
    s = re.sub(r'\^\{([^{}]*)\}', r'**(\1)', s)
    s = re.sub(r'\^(\d)', r'**(\1)', s)
    s = re.sub(r'\s+', '', s)
    s = re.sub(r'(\d|\))([a-z])', r'\1*\2', s)
    s = re.sub(r'(\d|\)|[a-z])\(', r'\1*(', s)
    s = re.sub(r'\)(\d)', r')*\1', s)
    s = re.sub(r'(\d+(?:\.\d+)?)', r"F('\1')", s)
    return s


def evaluate(text, **variables):
    code = to_python(text)
    require(re.fullmatch(r"[F()'0-9.+\-*/a-z]*", code) is not None, f'Unreadable expression: {text}')
    env = {'F': Fraction, '__builtins__': {}}
    env.update({k: Fraction(v) for k, v in variables.items()})
    try:
        value = eval(code, env)
    except Exception as error:
        raise ValueError(f'Cannot evaluate {text}: {error}')
    return Fraction(value)


def value_of(text):
    """Real value of a number written as integer, decimal, fraction, mixed number, percent or square root."""
    s = plain(text).strip().replace('{,}', '').replace(',', '')
    root = re.fullmatch(r'(-?)\\sqrt\{(\d+)\}', s)
    if root:
        n = int(root[2])
        r = isqrt(n)
        magnitude = Fraction(r) if r * r == n else Fraction(isqrt(n * 10 ** 80), 10 ** 40)
        return -magnitude if root[1] else magnitude
    if s.endswith('%'):
        return evaluate(s[:-1]) / 100
    return evaluate(s)


def table_of(public):
    figure = public.get('figure')
    require(figure and figure['kind'] == 'scene', 'Expected a table figure')
    elements = figure['scene']['elements']
    require(len(elements) == 1 and elements[0]['type'] == 'table', 'Expected exactly one table')
    return elements[0]


def options_of(public, count=4):
    response = public['response']
    require(response['kind'] == 'choice', 'Choice response required')
    options = response['options']
    require(len(options) == count, f'{count} choices required')
    ids = [o['id'] for o in options]
    require(len(set(ids)) == count and all(set(o) == {'id', 'label'} for o in options), 'Bad choice ids')
    require(len({plain(o['label']) for o in options}) == count, 'Duplicate choice text')
    return options


def only(options, test, message):
    hits = [o['id'] for o in options if test(o)]
    require(len(hits) == 1, f'{message}: {len(hits)} qualifying choices')
    return hits[0]


def pick_by_value(options, expected):
    values = [value_of(o['label']) for o in options]
    require(len(set(values)) == len(values), 'Mathematically duplicate choices')
    return only([dict(o, v=v) for o, v in zip(options, values)], lambda o: o['v'] == expected, 'Value choice')


# ---------- word forms ----------
ONES = {w: i for i, w in enumerate(
    'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split())}
TENS = {w: 10 * (i + 2) for i, w in enumerate('twenty thirty forty fifty sixty seventy eighty ninety'.split())}


def words_to_int(text):
    total, current = 0, 0
    tokens = re.split(r'[\s,\-]+', text.strip())
    for token in tokens:
        if token in ONES:
            current += ONES[token]
        elif token in TENS:
            current += TENS[token]
        elif token == 'hundred':
            current *= 100
        elif token == 'thousand':
            total += current * 1000
            current = 0
        else:
            raise ValueError(f'Unknown number word {token}')
    return total + current


def words_to_value(text):
    text = text.strip()
    denominators = {'tenths': 10, 'hundredths': 100, 'thousandths': 1000}
    match = re.fullmatch(r'(?:(.+?) and )?(.+?) (tenths?|hundredths?|thousandths?)', text)
    if match:
        whole = words_to_int(match[1]) if match[1] else 0
        return whole + Fraction(words_to_int(match[2]), denominators[match[3].rstrip('s') + 's'])
    return Fraction(words_to_int(text))


def solve_number_word_form(public):
    prompt = plain(public['prompt'])
    options = options_of(public)
    match = re.fullmatch(r'Which number is (\d+) hundreds?, (\d+) tens? and (\d+) ones?\?', prompt)
    if match:
        expected = int(match[1]) * 100 + int(match[2]) * 10 + int(match[3])
        return pick_by_value(options, Fraction(expected))
    match = re.fullmatch(r'Which shows (?:the number )?(.+?) written in words\?', prompt)
    require(match is not None, 'Unknown number-word prompt')
    expected = sum(num(t) for t in match[1].split('+'))
    values = [words_to_value(o['label']) for o in options]
    require(len(set(values)) == 4, 'Duplicate word-form values')
    return only([dict(o, v=v) for o, v in zip(options, values)], lambda o: o['v'] == expected, 'Word form')


def solve_rename(public):
    prompt = plain(public['prompt'])
    options = options_of(public)
    if prompt == 'Which equation is true?':
        def true(o):
            left, right = plain(o['label']).split('=')
            return value_of(left) == value_of(right)
        return only(options, true, 'True equation')
    lowest = re.fullmatch(r'Which fraction in lowest terms is equal to (\d+\.\d+)\?', prompt)
    if lowest:
        source = Fraction(lowest[1])
        require(source.denominator != 1 and len(lowest[1].split('.')[1]) == 2,
                'A two-place decimal that is not whole is required')
        def reduced(o):
            parts = re.fullmatch(r'\\frac\{(\d+)\}\{(\d+)\}', plain(o['label']))
            require(parts is not None, 'Fraction choices need the form a/b')
            top, bottom = int(parts[1]), int(parts[2])
            return Fraction(top, bottom) == source and gcd(top, bottom) == 1
        return only(options, reduced, 'Lowest-terms fraction')
    match = re.fullmatch(r'Which (decimal|percent) is equal to (.+?)\??', prompt)
    require(match is not None, 'Unknown rename prompt')
    source = value_of(match[2].rstrip('?'))
    if match[1] == 'percent':
        require(all(o['label'].endswith('%') for o in options), 'Percent choices need a percent sign')
    else:
        require(not any('%' in o['label'] for o in options), 'Decimal choices must be plain decimals')
    return pick_by_value(options, source)


def gcd_frac(a, b):
    return gcd(a, b)


def solve_ratio(public):
    prompt = plain(public['prompt'])
    options = options_of(public)
    match = re.fullmatch(r'A floor uses \w+ tiles and \w+ tiles in the ratio (\d+) to (\d+)\. There are (\d+) tiles in all\. How many are \w+\?', prompt)
    if match:
        a, b, total = map(int, match.groups())
        require(total % (a + b) == 0, 'Ratio total must split into whole parts')
        return pick_by_value(options, Fraction(total * a, a + b))
    match = re.fullmatch(r'.*? (\d+) ([a-z]+) in (\d+) ([a-z]+)\. Which is the unit rate in ([a-z]+) per ([a-z]+)\?', prompt)
    if match:
        a, unit_a, b, unit_b, top, bottom = match.groups()
        a, b = int(a), int(b)
        require(unit_a == top and bottom in (unit_b, unit_b[:-1], unit_b[:-2]), 'Unit-rate orientation must be consistent')
        require(a % b == 0, 'Unit rate must be a whole number')
        def good(o):
            m = re.fullmatch(r'(\d+) ([a-z]+) per ([a-z]+)', o['label'])
            require(m is not None, 'Unit-rate choice format')
            return (int(m[1]), m[2], m[3]) == (a // b, top, bottom)
        return only(options, good, 'Unit rate')
    match = re.fullmatch(r'.*? has (\d+) ([a-z ]+?) and (\d+) ([a-z ]+?)\. What is the ratio of ([a-z ]+?) to ([a-z ]+?) in simplest form\?', prompt)
    require(match is not None, 'Unknown ratio prompt')
    counts = {match[2]: int(match[1]), match[4]: int(match[3])}
    require(match[5] in counts and match[6] in counts and match[5] != match[6], 'Ratio order must name both quantities')
    first, second = counts[match[5]], counts[match[6]]
    g = gcd(first, second)
    expected = (first // g, second // g)
    def good(o):
        m = re.fullmatch(r'(\d+):(\d+)', plain(o['label']))
        return (int(m[1]), int(m[2])) == expected
    return only(options, good, 'Simplest ratio')


def solve_story_model(public):
    prompt = plain(public['prompt'])
    options = options_of(public)
    share = re.match(r'(?:A store puts )?(\d+) .*?(?:shared equally (?:among|into)|into) (\d+) ', prompt)
    purchase = re.fullmatch(r'\w+ buys an? [a-z ]+? for ([\d.]+) dollars and an? [a-z ]+? for ([\d.]+) dollars\. He also buys an? [a-z ]+?\. He spends ([\d.]+) dollars in all\. Let (\w) be the price of an? [a-z ]+? in dollars\. Which equation matches the story\?', prompt)
    if purchase:
        a, b, total = num(purchase[1]), num(purchase[2]), num(purchase[3])
        var = purchase[4]
        unknown = total - a - b
        def holds(o):
            left, right = plain(o['label']).split('=')
            return evaluate(left, **{var: unknown}) == evaluate(right, **{var: unknown})
        return only(options, holds, 'Matching purchase equation')
    require(share is not None, 'Unknown story-model prompt')
    total, groups = int(share[1]), int(share[2])
    require(total % groups == 0, 'Equal share must be whole')
    each = Fraction(total, groups)
    equation = re.search(r'Let (\w) be', prompt)
    negative = 'can NOT be used' in prompt
    require(negative or 'can be used' in prompt, 'Question must say can or can NOT')
    if equation:
        var = equation[1]
        def holds(o):
            left, right = plain(o['label']).split('=')
            return evaluate(left, **{var: each}) == evaluate(right, **{var: each})
    else:
        require('Which expression' in prompt, 'Expression or equation question required')
        holds = lambda o: evaluate(o['label']) == each
    if negative:
        return only(options, lambda o: not holds(o), 'Single invalid model')
    return only(options, holds, 'Single valid model')


def solve_rate_equation(public):
    prompt = plain(public['prompt'])
    options = options_of(public)
    match = re.fullmatch(r'.*? (\d+) [a-z ]+? over (\d+) [a-z]+ at a steady rate\. Let (\w) be the [a-z ]+? used in (\w) [a-z]+\. Which equation gives \3 in terms of \4\?', prompt)
    require(match is not None, 'Unknown rate prompt')
    amount, span = int(match[1]), int(match[2])
    out, inp = match[3], match[4]
    def good(o):
        left, right = plain(o['label']).split('=')
        require(left == out, 'Equation must solve for the amount')
        return all(evaluate(right, **{inp: h}) == Fraction(amount * h, span) for h in (0, 1, 2, 7, span))
    return only(options, good, 'Rate equation')


def listing(text):
    return [t.strip() for t in re.split(r',\\ |,\s*', plain(text)) if t.strip()]


def solve_order_decimals(public):
    prompt = plain(public['prompt'])
    options = options_of(public)
    match = re.fullmatch(r'Which list shows the numbers (.+?) in order from (least to greatest|greatest to least)\?', prompt)
    if match:
        items = [value_of(t) for t in re.split(r',\s*', match[1])]
        require(len(set(items)) == len(items), 'Numbers to order must be distinct')
        expected = sorted(items, reverse=match[2].startswith('greatest'))
        return only(options, lambda o: [value_of(t) for t in listing(o['label'])] == expected, 'Ordered list')
    match = re.fullmatch(r'Four measurements are (.+?) [a-z]+\. When they are ordered from least to greatest, which is (second|third)\?', prompt)
    require(match is not None, 'Unknown ordering prompt')
    items = [num(t) for t in re.split(r',\s*', match[1])]
    require(len(items) == 4 and len(set(items)) == 4, 'Four distinct measurements required')
    expected = sorted(items)[{'second': 1, 'third': 2}[match[2]]]
    return pick_by_value(options, expected)


def solve_order_mixed(public):
    prompt = plain(public['prompt'])
    options = options_of(public)
    if prompt == 'Which comparison is true?':
        def true(o):
            m = re.fullmatch(r'(.+?)([<>])(.+)', plain(o['label']))
            left, right = value_of(m[1]), value_of(m[3])
            require(left != right, 'Comparison sides must differ')
            return (left > right) == (m[2] == '>')
        return only(options, true, 'True comparison')
    match = re.fullmatch(r'Which list shows the numbers (.+?) in order from least to greatest\?', prompt)
    require(match is not None, 'Unknown mixed-form prompt')
    items = [t for t in re.split(r',\s*(?=-?(?:\\|\d))', match[1])]
    values = [value_of(t) for t in items]
    require(len(set(values)) == len(values) and len(values) in (4, 5), 'Distinct numbers to order required')
    expected = sorted(values)
    return only(options, lambda o: [value_of(t) for t in listing(o['label'])] == expected, 'Ordered list')


# ---------- numeric-entry templates ----------
def solve_nested(public):
    prompt = plain(public['prompt'])
    match = re.fullmatch(r'Find the product of (\d+) and the (sum|difference) of (\d+) and (\d+)\.', prompt)
    if match:
        a, b, c = int(match[1]), int(match[3]), int(match[4])
        return Fraction(a * (b + c if match[2] == 'sum' else b - c))
    match = re.fullmatch(r'Evaluate (.+)\.', prompt)
    require(match is not None, 'Unknown grouping prompt')
    return evaluate(match[1])


def solve_signed(public):
    match = re.fullmatch(r'Evaluate (.+)\.', plain(public['prompt']))
    require(match is not None, 'Unknown signed-order prompt')
    expression = match[1]
    # Convention check on the page: a leading minus before a power applies after the exponent.
    return evaluate(expression)


def solve_decimal_ops(public):
    prompt = plain(public['prompt'])
    match = re.fullmatch(r'.*? saved ([\d.]+) dollars over (\d+) weeks\. She saved the same amount each week\. How many dollars did she save each week\?', prompt)
    if match:
        return num(match[1]) / int(match[2])
    match = re.fullmatch(r'Find ([\d.]+)-\\frac\{(\d+)\}\{(\d+)\}\. Write the answer as a decimal\.', prompt)
    if match:
        return num(match[1]) - Fraction(int(match[2]), int(match[3]))
    match = re.fullmatch(r'A collector has (\d+) tokens\. Each token is worth ([\d.]+) dollars\. What is the total value of the tokens, in dollars\?', prompt)
    if match:
        return int(match[1]) * num(match[2])
    match = re.fullmatch(r'\w+ had ([\d.]+) kilograms of sugar and used ([\d.]+) kilograms for baking\. \w+ has ([\d.]+) kilograms of sugar\. How many more kilograms of sugar does \w+ have now than \w+\?', prompt)
    require(match is not None, 'Unknown decimal-operation prompt')
    return num(match[1]) - num(match[2]) - num(match[3])


def solve_salary(public):
    prompt = plain(public['prompt'])
    match = re.fullmatch(r'A worker earns ([\d,]+) dollars a year and gets a (\d+) percent raise\. How many dollars (is the raise each year|a year does the worker earn after the raise)\?', prompt)
    if match:
        pay, pct = num(match[1]), int(match[2])
        return pay * pct / 100 if match[3].startswith('is') else pay * (100 + pct) / 100
    match = re.fullmatch(r'The table shows the yearly salaries of two careers\. How many more dollars does an? (\w+) earn than an? (\w+) in (\d+) years\?', prompt)
    require(match is not None, 'Unknown salary prompt')
    rows = {r['label']: num(r['cells'][0]) for r in table_of(public)['rows']}
    require(set(rows) == {match[1], match[2]} and len(rows) == 2, 'Table careers must match the question')
    return (rows[match[1]] - rows[match[2]]) * int(match[3])


def solve_measure(public):
    prompt = plain(public['prompt'])
    match = re.fullmatch(r'A square has a perimeter of ([\d.]+) (\w+)\. What is its area in square \2\?', prompt)
    if match:
        return (num(match[1]) / 4) ** 2
    match = re.fullmatch(r'A rectangle has a perimeter of (\d+) (\w+) and a length of (\d+) \2\. What is its area in square \2\?', prompt)
    if match:
        perimeter, length = int(match[1]), int(match[3])
        width = Fraction(perimeter, 2) - length
        require(width > 0 and width != length, 'Width must be positive and the shape not a square')
        return length * width
    match = re.fullmatch(r'A rectangular \w+ is ([\d.]+) (\w+) long and ([\d.]+) (?:feet|foot|meters?|inch|inches|centimeters?) wide\. What is its perimeter in \2\?', prompt)
    require(match is not None, 'Unknown measure prompt')
    return 2 * (num(match[1]) + num(match[3]))


CONVERSIONS = {('hours', 'minutes'): 60, ('pounds', 'ounces'): 16, ('gallons', 'quarts'): 4,
               ('miles', 'feet'): 5280, ('feet', 'inches'): 12, ('yards', 'feet'): 3}


def solve_multistep(public):
    prompt = plain(public['prompt'])
    match = re.fullmatch(r'Each glass holds ([\d.]+) liter of juice\. A server fills (\d+) glasses\. How many milliliters of juice does the server pour\? Use 1 liter = 1,000 milliliters\.', prompt)
    if match:
        return num(match[1]) * int(match[2]) * 1000
    match = re.fullmatch(r'A school sold (\d+) tickets to the fall play and (\d+) tickets to the winter play\. It sold (\d+) tickets to the spring play\. How many more tickets did the school sell for the fall and winter plays together than for the spring play\?', prompt)
    if match:
        result = int(match[1]) + int(match[2]) - int(match[3])
        require(result > 0, 'Comparison must be positive')
        return Fraction(result)
    match = re.fullmatch(r'(\d+) stickers are shared equally among (\d+) friends\. Each friend then puts their stickers into piles of (\d+)\. How many piles does one friend make\?', prompt)
    if match:
        total, friends, pile = map(int, match.groups())
        require(total % friends == 0 and (total // friends) % pile == 0, 'Whole piles required')
        return Fraction(total // friends // pile)
    match = re.fullmatch(r'A cafeteria bakes (\d+) pizzas with (\d+) slices each\. A serving is (\d+) slices\. How many full servings can the cafeteria make\?', prompt)
    if match:
        pizzas, slices, serving = map(int, match.groups())
        return Fraction(pizzas * slices // serving)
    match = re.fullmatch(r'A conversion table shows that (\d+) (\w+) = ([\d,]+) (\w+)\. How many \4 are in (\d+) \2\?', prompt)
    require(match is not None, 'Unknown multistep prompt')
    big, small = match[2], match[4]
    require((big, small) in CONVERSIONS, 'Unknown conversion pair')
    require(num(match[3]) == int(match[1]) * CONVERSIONS[(big, small)], 'Stated conversion fact is false')
    return Fraction(int(match[5]) * CONVERSIONS[(big, small)])


def solve_multistep_equation(public):
    match = re.fullmatch(r'Solve (.+)\.', plain(public['prompt']))
    require(match is not None, 'Unknown equation prompt')
    left, right = match[1].split('=')
    f = lambda x: evaluate(left, x=x) - evaluate(right, x=x)
    f0, f1, f2 = f(0), f(1), f(2)
    require(f2 - f1 == f1 - f0 != 0, 'Equation must be linear with exactly one solution')
    return -f0 / (f1 - f0)


def solve_stem_leaf(public):
    prompt = plain(public['prompt'])
    match = re.fullmatch(r'The stem-and-leaf plot shows the [a-z ]+? for (\d+) students\. Key: (\d)\\mid (\d) means (\d+) [a-z]+\. What is the (sum of the two greatest values|difference between the greatest value and the second-least value)\?', prompt)
    require(match is not None, 'Unknown stem-and-leaf prompt')
    n, ks, kl, kv = int(match[1]), int(match[2]), int(match[3]), int(match[4])
    require(kv == 10 * ks + kl, 'Key must read stem then leaf')
    table = table_of(public)
    require(table['columns'] == ['Leaf'] and table['corner'] == 'Stem', 'Stem/leaf headers')
    values = []
    for row in table['rows']:
        leaves = [int(t) for t in row['cells'][0].split()]
        require(leaves == sorted(leaves), 'Leaves must be ordered')
        values += [10 * int(row['label']) + leaf for leaf in leaves]
    require(values == sorted(values) and len(values) == n, 'Plot must hold n ordered values')
    if match[5].startswith('sum'):
        return Fraction(values[-1] + values[-2])
    return Fraction(values[-1] - values[1])


def solve_dot_plot(public):
    prompt = plain(public['prompt'])
    match = re.fullmatch(r'The dot plot shows the [a-z ]+? (?:that )?(\d+) \w+(?: gave a \w+)?\.? ?(?:of the \w+ )?Each dot is one of the \w+\. How many of the \w+ had an? \w+ (less than|at least|greater than) (\d+)\?', prompt)
    match = match or re.fullmatch(r'The dot plot shows the [a-z ]+? of (\d+) \w+\. Each dot is one of the \w+\. How many of the \w+ had an? \w+ (less than|at least|greater than) (\d+)\?', prompt)
    require(match is not None, 'Unknown dot-plot prompt')
    n, relation, threshold = int(match[1]), match[2], int(match[3])
    figure = public['figure']
    require(figure['kind'] == 'line-plot' and figure['mark'] == 'dot', 'Dot plot figure required')
    values = figure['values']
    require(len(values) == n, 'Dots must equal the number of respondents')
    require(all(figure['start'] <= v <= figure['end'] for v in values), 'Dots must be on the axis')
    test = {'less than': lambda v: v < threshold, 'at least': lambda v: v >= threshold, 'greater than': lambda v: v > threshold}[relation]
    return Fraction(sum(1 for v in values if test(v)))


def solve_probability(public):
    prompt = plain(public['prompt'])
    match = re.fullmatch(r'A box holds (\d+) cards\. (\d+) of the cards are red and (\d+) of the cards are labeled 0\. A card is drawn at random and put back\. Then a second card is drawn\. What is the probability that the first card is red and the second card is labeled 0\? Give a fraction in simplest form\.', prompt)
    if match:
        total, red, zero = map(int, match.groups())
        return Fraction(red, total) * Fraction(zero, total)
    match = re.fullmatch(r'A bag has tiles of four colors\. A tile is drawn, its color is recorded and it is put back, (\d+) times\. The table shows the results\. Based on the results, what is the experimental probability of drawing an? (\w+) tile or an? (\w+) tile\? Give a fraction in simplest form\.', prompt)
    require(match is not None, 'Unknown probability prompt')
    counts = {r['label']: int(r['cells'][0]) for r in table_of(public)['rows']}
    require(sum(counts.values()) == int(match[1]) and len(counts) == 4, 'Table must total the stated trials')
    require(match[2] != match[3] and match[2] in counts and match[3] in counts, 'Two listed colors required')
    return Fraction(counts[match[2]] + counts[match[3]], int(match[1]))


# ---------- remaining choice templates ----------
def solve_line(public):
    prompt = plain(public['prompt'])
    options = options_of(public)
    match = re.fullmatch(r'The equation (-?\d+)x([+-]\d+)y=(-?\d+) describes a line\. What is the rate of change of y with respect to x\?', prompt)
    if match:
        a, b = int(match[1]), int(match[2])
        return pick_by_value(options, Fraction(-a, b))
    match = re.fullmatch(r'A line passes through the points \((-?\d+), (-?\d+)\) and \((-?\d+), (-?\d+)\)\. Which gives its slope m and its y-intercept b\?', prompt)
    if match:
        x1, y1, x2, y2 = map(int, match.groups())
        require(x1 != x2, 'Points need different x')
        m = Fraction(y2 - y1, x2 - x1)
        b = y1 - m * x1
        def good(o):
            parts = re.fullmatch(r'm=(.+?),\\ b=(.+)', plain(o['label']))
            return (value_of(parts[1]), value_of(parts[2])) == (m, b)
        return only(options, good, 'Slope and intercept')
    match = re.fullmatch(r'A line has slope (.+?) and passes through \((-?\d+), (-?\d+)\)\. Which is an equation of the line\?', prompt)
    require(match is not None, 'Unknown line prompt')
    m, px, py = value_of(match[1]), int(match[2]), int(match[3])
    def good(o):
        left, right = plain(o['label']).split('=')
        require(left == 'y', 'Line equations must be solved for y')
        b = evaluate(right, x=0)
        return evaluate(right, x=1) - b == m and evaluate(right, x=px) == py
    return only(options, good, 'Line equation')


def solve_money(public):
    prompt = plain(public['prompt'])
    options = options_of(public)
    if prompt == 'Which is an example of using credit?':
        borrowing = lambda t: bool(re.search(r'pays? (?:the )?[a-z ]+? back|agrees to pay|credit card|borrow|loan', t))
        spending = lambda t: bool(re.search(r'\b(?:pays|puts|earns)\b', t)) and not borrowing(t)
        require(sum(spending(o['label']) for o in options) == 3, 'Credit distractors must be plain spending, saving or earning')
        return only(options, lambda o: borrowing(o['label']), 'Credit example')
    match = re.fullmatch(r"A family's expenses for three months are shown in dollars\. Which expense is a (variable|fixed) expense, one that (?:changes from month to month|stays the same each month)\?", prompt)
    require(match is not None, 'Unknown money prompt')
    table = table_of(public)
    require(table['columns'] == ['January', 'February', 'March'], 'Three month columns')
    rows = {r['label']: [num(c) for c in r['cells']] for r in table['rows']}
    require(sorted(rows) == sorted(o['label'] for o in options), 'Choices must be the table rows')
    constant = lambda name: len(set(rows[name])) == 1
    return only(options, (lambda o: not constant(o['label'])) if match[1] == 'variable' else (lambda o: constant(o['label'])), 'Expense type')


def parse_table_option(label):
    m = re.fullmatch(r'\\begin\{array\}\{c\|c+\}x((?:&-?\d+)+)\\\\\\hline y((?:&-?\d+)+)\\end\{array\}', plain(label))
    require(m is not None, 'Unreadable table choice')
    xs = [int(t) for t in m[1].split('&')[1:]]
    ys = [int(t) for t in m[2].split('&')[1:]]
    require(len(xs) == len(ys) >= 4, 'Table needs at least four pairs')
    return xs, ys


def solve_table_rule(public):
    prompt = plain(public['prompt'])
    options = options_of(public)
    add = re.fullmatch(r'Which table shows that every pair follows the rule y=x([+-])(\d+)\?', prompt)
    times = re.fullmatch(r'Which table shows that every output y is (\d+) times its input x\?', prompt)
    require(add or times, 'Unknown table-rule prompt')
    rule = (lambda x: x + (1 if add[1] == '+' else -1) * int(add[2])) if add else (lambda x: x * int(times[1]))
    def good(o):
        xs, ys = parse_table_option(o['label'])
        require(len(set(xs)) == len(xs), 'Inputs must be distinct')
        return all(rule(x) == y for x, y in zip(xs, ys))
    return only(options, good, 'Table rule')


def classify(label):
    v = value_of(label)
    if v.denominator != 1:
        return 'rational'
    return 'whole' if v >= 0 else 'integer'


REGION = {'whole numbers': 'whole', 'integers that are not whole numbers': 'integer',
          'rational numbers that are not integers': 'rational'}


def solve_number_sets(public):
    prompt = plain(public['prompt'])
    options = options_of(public)
    head = 'In a diagram of nested sets, the whole numbers are inside the integers, and the integers are inside the rational numbers. '
    require(prompt.startswith(head), 'Nested-set statement must be given')
    rest = prompt[len(head):]
    if rest == 'Which number does NOT belong in the region for the integers?':
        return only(options, lambda o: classify(o['label']) == 'rational', 'Non-integer')
    if rest == 'Which number does NOT belong in the region for the whole numbers?':
        return only(options, lambda o: classify(o['label']) != 'whole', 'Non-whole')
    match = re.fullmatch(r'Which number belongs in the region for (?:the )?(whole numbers|integers that are not whole numbers|rational numbers that are not integers)\?', rest)
    if match:
        return only(options, lambda o: classify(o['label']) == REGION[match[1]], 'Region member')
    match = re.fullmatch(r'A student put (.+?) in the region for (whole numbers|integers that are not whole numbers|rational numbers that are not integers)\. Which statement fixes the diagram\?', rest)
    require(match is not None, 'Unknown number-set prompt')
    actual, put = classify(match[1]), REGION[match[2]]
    def good(o):
        t = o['label']
        if t == 'Leave it where it is.':
            return actual == put
        moved = re.fullmatch(r'Move it to the region for (.+)\.', t)
        if moved:
            require(moved[1] in REGION, 'Unknown destination region')
            return actual != put and REGION[moved[1]] == actual
        require(t == 'Remove it, because it is not a rational number.', 'Unknown statement')
        return False
    return only(options, good, 'Diagram fix')


NUMERIC = {
    'staar-nested-grouping': solve_nested, 'staar-signed-exponent-order': solve_signed,
    'staar-decimal-operations': solve_decimal_ops, 'staar-salary-percent': solve_salary,
    'staar-measure-chains': solve_measure, 'staar-multistep-stories': solve_multistep,
    'staar-multistep-equations': solve_multistep_equation, 'staar-stem-leaf-combine': solve_stem_leaf,
    'staar-dot-plot-threshold': solve_dot_plot, 'staar-experiment-probability': solve_probability,
}
CHOICES = {
    'staar-number-word-form': solve_number_word_form, 'staar-rename-percent-fraction-decimal': solve_rename,
    'staar-ratio-statements': solve_ratio, 'staar-story-model-choice': solve_story_model,
    'staar-rate-equation-choice': solve_rate_equation, 'staar-order-decimals': solve_order_decimals,
    'staar-order-mixed-forms': solve_order_mixed, 'staar-line-from-points': solve_line,
    'staar-money-vocabulary': solve_money, 'staar-table-rule-choice': solve_table_rule,
    'staar-number-sets': solve_number_sets,
}


def solve(public):
    template = public['templateId']
    require(template in SUPPORTED, 'Unexpected STAAR family')
    if template in NUMERIC:
        require(public['response']['kind'] in ('number', 'fraction'), 'Numeric response required')
        return NUMERIC[template](public)
    return CHOICES[template](public)


def review_problem(problem):
    public = problem['public']
    result = solve(public)
    if public['templateId'] in NUMERIC:
        answer = Fraction(problem['answer'])
        require(answer == result, f"STAAR numeric answer key mismatch: {problem['answer']} vs {result}")
        if public['response']['kind'] == 'fraction':
            text = problem['answer']
            if '/' in text:
                p, q = map(int, text.split('/'))
                require(gcd(p, q) == 1 and q > 1, 'Fraction answer must be in simplest form')
        require(result.denominator in (1, 2, 4, 5, 8, 10, 20, 25, 50, 100) or public['response']['kind'] == 'fraction' or result.denominator <= 10 ** 4,
                'Unexpected denominator')
        if public['response']['kind'] == 'number':
            d = result.denominator
            while d % 2 == 0:
                d //= 2
            while d % 5 == 0:
                d //= 5
            require(d == 1, 'Numeric answer must be a terminating decimal')
    else:
        require(result == problem['answer'], 'STAAR choice answer key mismatch')
        label = next(o['label'] for o in public['response']['options'] if o['id'] == result)
        hint = problem.get('hint', '')
        bare = plain(label).strip()
        require(len(bare) < 5 or bare not in hint, 'Hint gives away the answer label')
    return result


# ---------- self test ----------
def choice_public(template, prompt, labels, figure=None):
    public = {'templateId': template, 'prompt': prompt,
              'response': {'kind': 'choice', 'options': [{'id': f'o{i}', 'label': l} for i, l in enumerate(labels)]}}
    if figure:
        public['figure'] = figure
    return public


def numeric_public(template, prompt, kind='number', figure=None):
    public = {'templateId': template, 'prompt': prompt, 'response': {'kind': kind}}
    if figure:
        public['figure'] = figure
    return public


def table_figure(columns, rows, corner):
    return {'kind': 'scene', 'scene': {'elements': [{'type': 'table', 'columns': columns, 'corner': corner,
                                                    'rows': [{'label': l, 'cells': c} for l, c in rows]}]}}


def array(xs, ys):
    return '$\\begin{array}{c|' + 'c' * len(xs) + '}x&' + '&'.join(map(str, xs)) + '\\\\\\hline y&' + '&'.join(map(str, ys)) + '\\end{array}$'


def self_test():
    sets = 'In a diagram of nested sets, the whole numbers are inside the integers, and the integers are inside the rational numbers. '
    numeric = [
        (numeric_public('staar-nested-grouping', 'Evaluate $16+[(6\\times9)-38]\\div2$.'), '24'),
        (numeric_public('staar-nested-grouping', 'Find the product of 737 and the difference of 37 and 7.'), '22110'),
        (numeric_public('staar-signed-exponent-order', 'Evaluate $-6^{2}+3\\times6$.'), '-18'),
        (numeric_public('staar-signed-exponent-order', 'Evaluate $(6-12)^{2}-5\\times8$.'), '-4'),
        (numeric_public('staar-decimal-operations', 'Find $3.59-\\frac{1}{5}$. Write the answer as a decimal.'), '3.39'),
        (numeric_public('staar-decimal-operations', 'Nora had 10 kilograms of sugar and used 2.3 kilograms for baking. Eli has 6.8 kilograms of sugar. How many more kilograms of sugar does Nora have now than Eli?'), '0.9'),
        (numeric_public('staar-salary-percent', 'A worker earns 21,000 dollars a year and gets a 4 percent raise. How many dollars a year does the worker earn after the raise?'), '21840'),
        (numeric_public('staar-salary-percent', 'The table shows the yearly salaries of two careers. How many more dollars does a nurse earn than a teacher in 4 years?',
                        figure=table_figure(['Dollars a year'], [('nurse', ['49,500']), ('teacher', ['38,000'])], 'Career')), '46000'),
        (numeric_public('staar-measure-chains', 'A square has a perimeter of 54 inches. What is its area in square inches?'), '182.25'),
        (numeric_public('staar-measure-chains', 'A rectangle has a perimeter of 28 feet and a length of 9 feet. What is its area in square feet?'), '45'),
        (numeric_public('staar-multistep-stories', 'A conversion table shows that 5 miles = 26,400 feet. How many feet are in 19 miles?'), '100320'),
        (numeric_public('staar-multistep-stories', 'A cafeteria bakes 27 pizzas with 8 slices each. A serving is 7 slices. How many full servings can the cafeteria make?'), '30'),
        (numeric_public('staar-multistep-equations', 'Solve $\\frac{1}{5}(x-10)=\\frac{7}{5}x+22$.'), '-20'),
        (numeric_public('staar-multistep-equations', 'Solve $-5(x-9)=5x+115$.'), '-7'),
        (numeric_public('staar-stem-leaf-combine', 'The stem-and-leaf plot shows the pages read in a week for 10 students. Key: $7\\mid 1$ means $71$ pages. What is the difference between the greatest value and the second-least value?',
                        figure=table_figure(['Leaf'], [('5', ['3 4']), ('6', ['3 7 8']), ('7', ['1 2 2 4 6'])], 'Stem')), '22'),
        (numeric_public('staar-dot-plot-threshold', 'The dot plot shows the quiz scores of 5 students. Each dot is one of the students. How many of the students had a score at least 3?',
                        figure={'kind': 'line-plot', 'denominator': 1, 'start': 0, 'end': 6, 'values': [1, 3, 3, 5, 2], 'mark': 'dot', 'unit': 'points'}), '3'),
        (numeric_public('staar-experiment-probability', 'A bag has tiles of four colors. A tile is drawn, its color is recorded and it is put back, 40 times. The table shows the results. Based on the results, what is the experimental probability of drawing a yellow tile or a red tile? Give a fraction in simplest form.', 'fraction',
                        table_figure(['Times drawn'], [('red', ['17']), ('green', ['10']), ('yellow', ['5']), ('blue', ['8'])], 'Color')), '11/20'),
        (numeric_public('staar-experiment-probability', 'A box holds 20 cards. 2 of the cards are red and 8 of the cards are labeled 0. A card is drawn at random and put back. Then a second card is drawn. What is the probability that the first card is red and the second card is labeled 0? Give a fraction in simplest form.', 'fraction'), '1/25'),
    ]
    expenses = table_figure(['January', 'February', 'March'], [('Car payment', ['335', '335', '335']), ('Water bill', ['165', '185', '160']), ('Rent', ['1165'] * 3), ('Gym membership', ['30'] * 3)], 'Expense')
    choices = [
        (choice_public('staar-number-word-form', 'Which shows the number $400{,}000+20{,}000+600+7$ written in words?',
                       ['four hundred twenty thousand, six hundred seven', 'four hundred twenty thousand, sixty-seven', 'four hundred twenty thousand, six hundred seventy', 'four hundred two thousand, six hundred seven']), 0),
        (choice_public('staar-number-word-form', 'Which shows $3+0.5+0.006$ written in words?',
                       ['five hundred six thousandths', 'three and fifty-six hundredths', 'three and six hundred five thousandths', 'three and five hundred six thousandths']), 3),
        (choice_public('staar-number-word-form', 'Which number is 77 hundreds, 7 tens and 3 ones?', ['8,403', '7,710', '843', '7,773']), 3),
        (choice_public('staar-rename-percent-fraction-decimal', 'Which decimal is equal to 6%?', ['0.6', '0.006', '6', '0.06']), 3),
        (choice_public('staar-rename-percent-fraction-decimal', 'Which fraction in lowest terms is equal to 0.05?', ['$\\frac{5}{100}$', '$\\frac{1}{20}$', '$\\frac{5}{10}$', '$\\frac{1}{100}$']), 1),
        (choice_public('staar-rename-percent-fraction-decimal', 'Which fraction in lowest terms is equal to 0.68?', ['$\\frac{68}{100}$', '$\\frac{17}{100}$', '$\\frac{17}{25}$', '$\\frac{34}{25}$']), 2),
        (choice_public('staar-rename-percent-fraction-decimal', 'Which percent is equal to $\\frac{47}{20}$?', ['2350%', '2.35%', '235%', '47%']), 2),
        (choice_public('staar-rename-percent-fraction-decimal', 'Which equation is true?', ['$2.02=2\\frac{2}{10}$', '$2.02=\\frac{2}{100}$', '$2.02=2\\frac{2}{100}$', '$2.02=2\\frac{2}{1000}$']), 2),
        (choice_public('staar-ratio-statements', 'A floor uses green tiles and yellow tiles in the ratio 1 to 4. There are 30 tiles in all. How many are green?', ['36', '24', '29', '6']), 3),
        (choice_public('staar-ratio-statements', 'A reader finishes 90 pages in 15 minutes. Which is the unit rate in pages per minute?', ['6 minutes per page', '90 pages per minute', '6 pages per minute', '75 pages per minute']), 2),
        (choice_public('staar-ratio-statements', 'A shelf has 30 fiction books and 42 nonfiction books. What is the ratio of fiction books to nonfiction books in simplest form?', ['$5:12$', '$5:7$', '$30:42$', '$12:6$']), 1),
        (choice_public('staar-story-model-choice', '72 stickers are shared equally among 8 friends. Let $n$ be the number of stickers each of the friends gets. Which equation can be used to find $n$?', ['$8\\times n=72$', '$8\\div n=72$', '$n-8=72$', '$72\\times8=n$']), 0),
        (choice_public('staar-story-model-choice', 'A store puts 25 books into 5 equal shelves. Let $m$ be the number of books in each. Which equation can NOT be used to find $m$?', ['$25\\times5=m$', '$m\\times5=25$', '$25\\div m=5$', '$25\\div5=m$']), 0),
        (choice_public('staar-story-model-choice', '15 gallons of juice are shared equally into 3 jugs. Which expression can NOT be used to find the number of gallons of juice in each?', ['$15\\times\\frac{1}{3}$', '$\\frac{15}{3}$', '$15\\div3$', '$15-3$']), 3),
        (choice_public('staar-story-model-choice', 'Sam buys a notebook for 1.71 dollars and a pen for 2.42 dollars. He also buys a folder. He spends 10.26 dollars in all. Let $f$ be the price of a folder in dollars. Which equation matches the story?', ['$1.71+2.42+f=10.26$', '$1.71+2.42=f+10.26$', '$1.71\\times2.42\\times f=10.26$', '$1.71+2.42-f=10.26$']), 0),
        (choice_public('staar-rate-equation-choice', 'A truck uses 60 gallons of fuel over 150 hours at a steady rate. Let $g$ be the gallons of fuel used in $h$ hours. Which equation gives $g$ in terms of $h$?', ['$g=h+0.4$', '$g=150h$', '$g=0.4h$', '$g=\\frac{5}{2}h$']), 2),
        (choice_public('staar-order-decimals', 'Four measurements are 0.9, 0.94, 0.51, 0.76 kilograms. When they are ordered from least to greatest, which is second?', ['0.9', '0.76', '0.94', '0.51']), 1),
        (choice_public('staar-order-decimals', 'Which list shows the numbers 0.7, 0.51, 0.99, 0.068 in order from greatest to least?', ['$0.7,\\ 0.99,\\ 0.51,\\ 0.068$', '$0.99,\\ 0.068,\\ 0.51,\\ 0.7$', '$0.99,\\ 0.7,\\ 0.51,\\ 0.068$', '$0.99,\\ 0.51,\\ 0.7,\\ 0.068$']), 2),
        (choice_public('staar-order-mixed-forms', 'Which comparison is true?', ['$-\\sqrt{5}>-2.32$', '$\\sqrt{5}<0.5$', '$\\sqrt{6}>\\sqrt{10}$', '$-\\sqrt{7}>-0.5$']), 0),
        (choice_public('staar-order-mixed-forms', 'Which list shows the numbers $\\sqrt{6}$, $205\\%$, $3.12$, $\\frac{13}{8}$ in order from least to greatest?',
                       ['$\\frac{13}{8},\\ 205\\%,\\ 3.12,\\ \\sqrt{6}$', '$205\\%,\\ \\frac{13}{8},\\ \\sqrt{6},\\ 3.12$', '$\\frac{13}{8},\\ 205\\%,\\ \\sqrt{6},\\ 3.12$', '$\\frac{13}{8},\\ \\sqrt{6},\\ 3.12,\\ 205\\%$']), 2),
        (choice_public('staar-line-from-points', 'A line passes through the points $(2, 16)$ and $(4, 24)$. Which gives its slope $m$ and its $y$-intercept $b$?', ['$m=4,\\ b=16$', '$m=\\frac{1}{4},\\ b=8$', '$m=-4,\\ b=8$', '$m=4,\\ b=8$']), 3),
        (choice_public('staar-line-from-points', 'A line has slope $-\\frac{3}{2}$ and passes through $(-4, 2)$. Which is an equation of the line?', ['$y=-\\frac{2}{3}x-4$', '$y=\\frac{3}{2}x-4$', '$y=-\\frac{3}{2}x-4$', '$y=-\\frac{3}{2}x+8$']), 2),
        (choice_public('staar-line-from-points', 'The equation $7x-8y=17$ describes a line. What is the rate of change of $y$ with respect to $x$?', ['$\\frac{7}{8}$', '$\\frac{8}{7}$', '$-\\frac{7}{8}$', '$-\\frac{17}{8}$']), 0),
        (choice_public('staar-money-vocabulary', "A family's expenses for three months are shown in dollars. Which expense is a variable expense, one that changes from month to month?", ['Rent', 'Car payment', 'Water bill', 'Gym membership'], expenses), 2),
        (choice_public('staar-money-vocabulary', 'Which is an example of using credit?', ['Dev pays 10 dollars of sales tax on a couch at the register.', 'Dev puts 125 dollars into a savings account.', 'Dev earns 125 dollars mowing lawns.', 'Dev takes a couch that costs 125 dollars home today and agrees to pay the store back over 11 months.']), 3),
        (choice_public('staar-table-rule-choice', 'Which table shows that every pair follows the rule $y=x+9$?', [array([1, 3, 5, 7], ys) for ys in ([11, 13, 15, 17], [9, 27, 45, 63], [9, 11, 13, 15], [10, 12, 14, 16])]), 3),
        (choice_public('staar-table-rule-choice', 'Which table shows that every pair follows the rule $y=x-5$?', [array([8, 9, 10, 11], ys) for ys in ([3, 4, 7, 6], [3, 4, 5, 6], [4, 5, 6, 7], [13, 14, 15, 16])]), 1),
        (choice_public('staar-table-rule-choice', 'Which table shows that every output $y$ is 9 times its input $x$?', [array([2, 3, 4, 5], ys) for ys in ([11, 12, 13, 14], [16, 24, 32, 40], [18, 27, 36, 45], [19, 28, 37, 46])]), 2),
        (choice_public('staar-number-sets', sets + 'Which number does NOT belong in the region for the integers?', ['$0$', '$15$', '$-2.5$', '$\\frac{40}{5}$']), 2),
        (choice_public('staar-number-sets', sets + 'Which number belongs in the region for integers that are not whole numbers?', ['$36\\div6$', '$15$', '$\\frac{-20}{5}$', '$\\frac{24}{3}$']), 2),
        (choice_public('staar-number-sets', sets + 'A student put $-\\frac{5}{3}$ in the region for whole numbers. Which statement fixes the diagram?', ['Leave it where it is.', 'Move it to the region for integers that are not whole numbers.', 'Remove it, because it is not a rational number.', 'Move it to the region for rational numbers that are not integers.']), 3),
    ]
    rejected = 0

    def reject(problem, why):
        nonlocal rejected
        try:
            review_problem(problem)
        except (ValueError, KeyError, TypeError, AttributeError):
            rejected += 1
            return
        raise ValueError(f'Corrupt STAAR case was accepted: {why}')

    for public, answer in numeric:
        problem = {'public': public, 'answer': answer}
        review_problem(problem)
        bad = copy.deepcopy(problem)
        bad['answer'] = str(Fraction(answer) + 1) if '/' not in answer else '1/2'
        reject(bad, 'shifted numeric key')
    for public, index in choices:
        problem = {'public': public, 'answer': f'o{index}', 'hint': ''}
        review_problem(problem)
        bad = copy.deepcopy(problem)
        bad['answer'] = f'o{(index + 1) % 4}'
        reject(bad, 'wrong choice key')
        bad = copy.deepcopy(problem)
        wrong = (index + 1) % 4
        bad['public']['response']['options'][wrong]['label'] = bad['public']['response']['options'][index]['label']
        reject(bad, 'duplicate correct choice')
    # Specific corruptions of conditions the generator must keep.
    base = {'public': numeric[10][0], 'answer': numeric[10][1]}
    bad = copy.deepcopy(base)
    bad['public']['prompt'] = bad['public']['prompt'].replace('26,400', '26,000')
    reject(bad, 'false conversion fact')
    base = {'public': numeric[14][0], 'answer': numeric[14][1]}
    bad = copy.deepcopy(base)
    bad['public']['figure']['scene']['elements'][0]['rows'][0]['cells'] = ['3 4 5']
    reject(bad, 'plot count disagrees with n')
    base = {'public': next(c[0] for c in choices if 'variable expense' in c[0]['prompt']), 'answer': 'o2'}
    bad = copy.deepcopy(base)
    bad['public']['figure']['scene']['elements'][0]['rows'][0]['cells'] = ['335', '335', '340']
    reject(bad, 'two varying expenses')
    return {'fixtures': len(numeric) + len(choices), 'rejectedMutations': rejected}

# Read by independent-math-review.py (FamilyOracle).
CHOICE_REVIEW = CHOICE



if __name__ == '__main__':
    print(self_test())
