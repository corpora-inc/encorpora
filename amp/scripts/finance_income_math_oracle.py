"""Independent review of personal-finance (income, taxes, budgets) problems.

Every answer is derived from the public prompt, choices and table figure with
exact Fraction arithmetic. Nothing here reads the generator.
"""
import copy
import re
from fractions import Fraction

SUPPORTED = frozenset({
    'profit-cost-breakeven', 'tax-kinds-defined', 'tax-bracket-owed',
    'payroll-property-tax', 'budget-percent-share', 'net-worth-statement',
    'incentive-compare',
})
MAX_LABEL = 18  # scene schema label cap


def require(condition, message):
    if not condition:
        raise ValueError(message)


def num(text):
    """First number in text as an exact Fraction (handles commas and U+2212)."""
    m = re.search(r'(−|-)?\d[\d,]*(?:\.\d+)?', text)
    require(m is not None, f'No number in {text!r}')
    value = Fraction(m.group(0).replace('−', '-').replace(',', ''))
    return value


def nums(text):
    return [Fraction(x.replace(',', '')) for x in re.findall(r'\d[\d,]*(?:\.\d+)?', text)]


def table(public):
    figure = public.get('figure')
    require(figure is not None and figure['kind'] == 'scene', 'Table figure required')
    elements = figure['scene']['elements']
    require(len(elements) == 1 and elements[0]['type'] == 'table', 'Exactly one table expected')
    rows = elements[0]['rows']
    for row in rows:
        require(len(row['label']) <= MAX_LABEL, f"Label too long: {row['label']}")
    return elements[0], rows


def choices(public):
    response = public['response']
    require(response['kind'] == 'choice', 'Choice response required')
    options = response['options']
    require(len(options) == 4 and len({o['id'] for o in options}) == 4, 'Four distinct choice ids required')
    require(len({o['label'].strip().lower() for o in options}) == 4, 'Duplicate choice text')
    return options


def pick_numeric(public, expected, parse=num):
    """Return the one option whose parsed value equals expected."""
    options = choices(public)
    values = [parse(o['label']) for o in options]
    require(len(set(values)) == 4, 'Mathematically duplicate choices')
    hits = [o['id'] for o, v in zip(options, values) if v == expected]
    require(len(hits) == 1, f'Expected {expected} matches {len(hits)} choices {values}')
    return hits[0]


def pick_text(public, predicate):
    options = choices(public)
    hits = [o['id'] for o in options if predicate(o['label'])]
    require(len(hits) == 1, f'{len(hits)} choices satisfy the independent answer')
    return hits[0]


def money(n):  # exact dollars; keep as Fraction
    return Fraction(n)


# ---------------------------------------------------------------- profit
def solve_profit(public):
    p = public['prompt']
    options = choices(public)
    if 'Which cost is a variable cost' in p:
        costs = re.findall(r'([A-Za-z][A-Za-z ,]*?) \((\d+) dollars?( for each one made)?\)', p.split(':', 1)[1])
        require(len(costs) == 4, 'Four listed costs required')
        variable = [name for name, _, each in costs if each]
        require(len(variable) == 1, 'Exactly one variable cost required')
        first = re.sub(r'^(?:and )', '', variable[0]).split()[0].lower().rstrip(',')
        fixed_first = [re.sub(r'^(?:and )', '', n).split()[0].lower().rstrip(',') for n, _, e in costs if not e]
        require(first not in fixed_first, 'Variable cost is not distinguishable')
        def head(label):
            return label.split()[0].lower().rstrip(',')
        hits = [o['id'] for o in options if head(o['label']) == first]
        require(len(hits) == 1 and all(head(o['label']) in fixed_first + [first] for o in options),
                'Variable cost choice ambiguous')
        return hits[0]
    price = int(re.search(r'for (\d+) dollars? each', p)[1])
    fixed = sum(int(x) for x in re.findall(r'(\d+) dollars? for the', p))
    variable = int(re.search(r'Making each one costs (\d+) dollars?', p)[1])
    require(price > variable, 'Unit price must exceed unit cost')
    require('The fixed costs, which stay the same no matter how many are made' in p and 'a variable cost' in p,
            'Fixed and variable costs must be defined')
    margin = price - variable
    if 'total cost of making' in p:
        n = int(re.search(r'total cost of making (\d+)', p)[1])
        return pick_numeric(public, Fraction(fixed + variable * n))
    if 'what is the result' in p:
        n = int(re.search(r'If (\d+) .* are made and all are sold', p)[1])
        profit = price * n - fixed - variable * n

        def parse(label):
            if label.startswith('No profit'):
                return Fraction(0)
            m = re.fullmatch(r'(Profit|Loss) of (\d+) dollars?', label)
            require(m is not None, f'Bad result label {label}')
            return Fraction(int(m[2])) * (1 if m[1] == 'Profit' else -1)
        return pick_numeric(public, Fraction(profit), parse)
    if 'to break even' in p:
        require('break-even number is the number sold at which revenue equals total cost' in p, 'Break-even undefined')
        require(fixed % margin == 0, 'Break-even must be a whole number of units without rounding')
        return pick_numeric(public, Fraction(fixed, margin))
    if 'How many more must be sold to reach the break-even number' in p:
        sold = int(re.search(r'So far (\d+) ', p)[1])
        # at least: round up to whole units, stated or exact
        be = -(-fixed // margin)
        require(fixed % margin == 0 or 'at least' in p, 'Rounding up must be stated when not exact')
        require(be > sold, 'More must still be needed')
        return pick_numeric(public, Fraction(be - sold))
    raise ValueError('Unknown profit question')


# ------------------------------------------------------------ tax kinds
KINDS = {
    'Sales tax': ('register', 'of the price', 'receipt'),
    'Payroll tax': ('paycheck', 'social security', 'medicare'),
    'Property tax': ('house', 'land or a building', 'owner of land'),
    'Income tax': ('earn', 'tax return', 'filing a return'),
}


def solve_kinds(public):
    p = public['prompt']
    require(p.endswith('Which kind of tax is this?'), 'Question missing')
    text = p.lower()
    matches = [k for k, cues in KINDS.items() if any(c in text for c in cues)]
    require(len(matches) == 1, f'Tax kind not uniquely defined: {matches}')
    return pick_text(public, lambda label: label == matches[0])


# --------------------------------------------------------------- brackets
def bracket_rows(public):
    _, rows = table(public)
    require(len(rows) == 3, 'Three brackets required')
    first = nums(rows[0]['label'])[0]
    mid = nums(rows[1]['label'])
    last = nums(rows[2]['label'])[0]
    require(rows[0]['label'].startswith('Up to') and rows[2]['label'].startswith('Over'), 'Row wording')
    require(mid[0] == first and mid[1] == last, 'Brackets must be contiguous')
    rates = [Fraction(num(r['cells'][0]), 100) for r in rows]
    require(rates[0] < rates[1] < rates[2], 'Rates should rise')
    return first, last, rates


def tax(income, a, b, rates):
    income = Fraction(income)
    return (min(income, a) * rates[0]
            + max(Fraction(0), min(income, b) - a) * rates[1]
            + max(Fraction(0), income - b) * rates[2])


def solve_bracket(public):
    p = public['prompt']
    require('Each rate applies only to the part of the income that lies inside its row' in p, 'Marginal rule must be stated')
    a, b, rates = bracket_rows(public)
    if 'gets a raise' in p:
        x = nums(p.split('taxable income of', 1)[1])[0]
        r = nums(p.split('raise of', 1)[1])[0]
        ta, tb = tax(x, a, b, rates), tax(x + r, a, b, rates)
        slope = (tb - ta) / r
        require(slope in rates, 'Raise must stay inside one row')
        require((a < x <= b and x + r <= b) or (x > b) or (x <= a and x + r <= a),
                'Raise crosses a row boundary')
        expected = tb - ta
    elif 'standard deduction' in p:
        earned = nums(p.split('earned', 1)[1])[0]
        ded = nums(p.split('deduction of', 1)[1])[0]
        require(earned > ded, 'Deduction exceeds income')
        require('subtracted before tax' in p, 'Deduction order must be stated')
        expected = tax(earned - ded, a, b, rates)
    elif 'taxed at the middle rate' in p:
        x = nums(p.split('taxable income of', 1)[1])[0]
        rate = num(p.split('middle rate,', 1)[1])
        require(rate == rates[1] * 100, 'Stated middle rate disagrees with the table')
        expected = max(Fraction(0), min(x, b) - a)
    elif 'exactly' in p:
        x = nums(p.split('income of exactly', 1)[1])[0]
        require(x in (a, b), 'Boundary income must sit at a threshold')
        expected = tax(x, a, b, rates)
    else:
        x = nums(p.split('taxable income of', 1)[1])[0]
        expected = tax(x, a, b, rates)
    return pick_numeric(public, expected)


# ---------------------------------------------------------- payroll etc.
def solve_payroll(public):
    p = public['prompt']
    if 'property tax of' in p:
        rate, unit = nums(p)[0], nums(p)[1]
        require(unit == 100, 'Per-100 unit required')
        if 'homestead exemption' in p:
            value = nums(p.split('worth', 1)[1])[0]
            ex = nums(p.split('exemption of', 1)[1])[0]
            require(value > ex, 'Exemption exceeds value')
            require('subtracted from its value before the tax is found' in p, 'Exemption order')
            taxable = value - ex
        else:
            taxable = nums(p.split('assessed at', 1)[1])[0]
        return pick_numeric(public, taxable / 100 * rate)
    if 'payroll tax is' in p and 'How much payroll tax' in p:
        pct = nums(p.split('payroll tax is', 1)[1])[0]
        pay = nums(p.split('gross pay for the week is', 1)[1])[0]
        return pick_numeric(public, pay * pct / 100)
    if 'What is the net pay' in p:
        gross = nums(p)[0]
        p1 = nums(p.split('payroll tax of', 1)[1])[0]
        p2 = nums(p.split('income tax of', 1)[1])[0]
        return pick_numeric(public, gross - gross * (p1 + p2) / 100)
    if 'sales tax of' in p:
        rate = nums(p)[0]
        jacket = nums(p.split('jacket for', 1)[1])[0]
        food = nums(p.split('groceries for', 1)[1])[0]
        require('but not to groceries' in p, 'Exempt item must be stated')
        return pick_numeric(public, jacket + food + jacket * rate / 100)
    raise ValueError('Unknown payroll family')


# ----------------------------------------------------------------- budget
def solve_budget(public):
    p = public['prompt']
    options = choices(public)
    if 'planned expenses of' in p:
        income = nums(p.split('income of', 1)[1])[0]
        spend = nums(p.split('planned expenses of', 1)[1])[0]
        return pick_numeric(public, spend * 100 / income)
    el, rows = table(public)
    labels = [r['label'] for r in rows]
    require(len(set(labels)) == len(labels), 'Duplicate row labels')
    cells = [r['cells'] for r in rows]
    if 'How many dollars go to' in p:
        income = nums(p)[0]
        pct = [num(c[0]) for c in cells]
        require(all(c[0].endswith('%') for c in cells) and sum(pct) == 100, 'Percents must sum to 100')
        name = re.search(r'How many dollars go to (.+)\?', p)[1]
        require(labels.count(name) == 1, 'Category must appear once')
        return pick_numeric(public, income * pct[labels.index(name)] / 100)
    if 'What percent is saved' in p:
        shown = [num(c[0]) for c in cells if c[0] != '?']
        require(sum(1 for c in cells if c[0] == '?') == 1 and len(shown) == 4, 'One unknown percent')
        require('the rest is saved' in p, 'Remainder rule must be stated')
        return pick_numeric(public, 100 - sum(shown))
    if 'What percent of the income goes to fixed' in p:
        income = nums(p)[0]
        amounts = [num(c[1]) for c in cells]
        require(sum(amounts) == income, 'Table amounts must total the income')
        require('Fixed expenses stay the same each month' in p, 'Fixed defined')
        fixed = sum(a for c, a in zip(cells, amounts) if c[0] == 'Fixed')
        return pick_numeric(public, fixed * 100 / income)
    m = re.search(r'What percent of the budget is (.+)\?', p)
    require(m is not None, 'Unknown budget question')
    total = nums(p)[0]
    amounts = [num(c[0]) for c in cells]
    require(sum(amounts) == total, 'Table amounts must total the budget')
    require(labels.count(m[1]) == 1, 'Category must appear once')
    value = amounts[labels.index(m[1])] * 100 / total
    require(value.denominator == 1, 'Percent must be exact')
    return pick_numeric(public, value)


# -------------------------------------------------------------- net worth
LIABILITY_WORDS = ('loan', 'debt', 'unpaid', 'owe')


def solve_net_worth(public):
    p = public['prompt']
    options = choices(public)
    if p.endswith('What is the net worth?'):
        _, rows = table(public)
        require(len({r['label'] for r in rows}) == len(rows), 'Duplicate items')
        assets = sum(num(r['cells'][0]) for r in rows if not any(w in r['label'].lower() for w in LIABILITY_WORDS))
        liabilities = sum(num(r['cells'][0]) for r in rows if any(w in r['label'].lower() for w in LIABILITY_WORDS))
        require('An asset is something owned that has value; a liability is money owed' in p, 'Definitions required')
        return pick_numeric(public, assets - liabilities)
    if 'What are the person' in p and 'total liabilities' in p:
        a = nums(p.split('total assets are', 1)[1])[0]
        nw = num(p.split('net worth is', 1)[1])
        return pick_numeric(public, a - nw)
    if p.startswith('A liability is money a person owes.'):
        n = sum(any(w in o['label'].lower() for w in LIABILITY_WORDS) for o in options)
        require(n == 1, 'Exactly one liability choice required')
        return pick_text(public, lambda l: any(w in l.lower() for w in LIABILITY_WORDS))
    if p.startswith('An asset is something a person owns'):
        n = sum(not any(w in o['label'].lower() for w in LIABILITY_WORDS) for o in options)
        require(n == 1, 'Exactly one asset choice required')
        return pick_text(public, lambda l: not any(w in l.lower() for w in LIABILITY_WORDS))
    if 'How does the person' in p:
        amount = nums(p)[0]
        if 'buys a bicycle' in p and 'savings account' in p:
            delta = 0  # one asset replaces another of equal value
        elif 'borrows' in p and 'keeps the cash in a savings account' in p:
            delta = 0  # asset up, liability up by same amount
        elif 'used up' in p:
            delta = -amount  # asset down, nothing replaces it
        elif 'toward a loan' in p:
            delta = 0  # asset down, liability down
        else:
            raise ValueError('Unknown transaction')

        def parse(label):
            if label == 'It does not change':
                return Fraction(0)
            m = re.fullmatch(r'It (increases|decreases) by ([\d,]+) dollars?', label)
            require(m is not None, 'Bad change label')
            return Fraction(m[2].replace(',', '')) * (1 if m[1] == 'increases' else -1)
        return pick_numeric(public, Fraction(delta), parse)
    raise ValueError('Unknown net worth family')


# -------------------------------------------------------------- incentives
def solve_incentive(public):
    p = public['prompt']
    if 'uses both a' in p:
        price = nums(p)[0]
        pct = nums(p.split('uses both a', 1)[1])[0]
        coupon = nums(p.split('and a', 1)[1])[0]
        first_pct = 'discount is taken from the price first, and then the' in p
        first_coupon = re.search(r'coupon is subtracted first, and then the \d+% discount is taken from the reduced price', p)
        require(first_pct != bool(first_coupon), 'Order must be stated exactly once')
        if first_pct:
            return pick_numeric(public, price - price * pct / 100 - coupon)
        return pick_numeric(public, (price - coupon) * (100 - pct) / 100)
    if 'Offer A is a coupon' in p:
        price = nums(p)[0]
        coupon = nums(p.split('coupon for', 1)[1])[0]
        pct = nums(p.split('Offer B is', 1)[1])[0]
        rebate = nums(p.split('then receive', 1)[1])[0]
        require('Only one offer can be used' in p, 'One-offer rule')
        finals = {
            'The dollar coupon': price - coupon,
            'The percent discount': price - price * pct / 100,
            'The mail-in rebate': price - rebate,
        }
        low = min(finals.values())
        winners = [k for k, v in finals.items() if v == low]
        options = choices(public)
        hits = []
        for o in options:
            if o['label'].startswith('All three'):
                if len(set(finals.values())) == 1:
                    hits.append(o['id'])
                continue
            m = re.fullmatch(r'(.+), for a final cost of ([\d,\.]+) dollars?', o['label'])
            require(m is not None, 'Bad offer label')
            if len(winners) == 1 and m[1] == winners[0] and Fraction(m[2].replace(',', '')) == low:
                hits.append(o['id'])
            # a stated final cost must always match that offer's true final cost
            require(Fraction(m[2].replace(',', '')) == finals[m[1]], f'Stated final cost wrong for {m[1]}')
        require(len(hits) == 1 and len(winners) == 1, 'Lowest offer must be unique and unique in choices')
        return hits[0]
    if 'two stores' in p:
        la = nums(p.split('Store A lists it at', 1)[1])
        lb = nums(p.split('Store B lists it at', 1)[1])
        a = la[0] - la[0] * la[1] / 100
        b = lb[0] - lb[1]
        require(a != b, 'Stores must differ')
        winner = 'Store A' if a < b else 'Store B'
        diff = abs(a - b)

        def predicate(label):
            m = re.fullmatch(r'(Store [AB]), by ([\d,\.]+) dollars?', label)
            return m is not None and m[1] == winner and Fraction(m[2].replace(',', '')) == diff
        return pick_text(public, predicate)
    raise ValueError('Unknown incentive family')


def solve(public):
    t = public['templateId']
    require(t in SUPPORTED, 'Unexpected finance family')
    return {
        'profit-cost-breakeven': solve_profit,
        'tax-kinds-defined': solve_kinds,
        'tax-bracket-owed': solve_bracket,
        'payroll-property-tax': solve_payroll,
        'budget-percent-share': solve_budget,
        'net-worth-statement': solve_net_worth,
        'incentive-compare': solve_incentive,
    }[t](public)


def review_problem(problem):
    result = solve(problem['public'])
    require(result == problem['answer'], 'Finance answer key mismatch')
    hint = problem.get('hint', '')
    options = problem['public']['response']['options']
    correct = next(o['label'] for o in options if o['id'] == result)
    require(correct not in hint, 'Hint leaks the correct choice text')
    return result


def self_test():
    def build(template, prompt, labels, figure=None):
        public = {
            'templateId': template,
            'prompt': prompt,
            'response': {'kind': 'choice', 'options': [
                {'id': f'option-{c}', 'label': label} for c, label in zip('abcd', labels)
            ]},
        }
        if figure:
            public['figure'] = {'kind': 'scene', 'scene': {'v': 1, 'elements': [{
                'id': 't', 'type': 'table', 'columns': ['x'], 'corner': 'c',
                'rows': [{'label': a, 'cells': b} for a, b in figure]}]}}
        return {'public': public, 'answer': 'option-a', 'hint': 'Work it out.'}

    bracket = [('Up to 10,000', ['10%']), ('10,000–40,000', ['20%']), ('Over 40,000', ['30%'])]
    head = ('A tax table taxes income in brackets. Each rate applies only to the part of the income '
            'that lies inside its row. ')
    # 50,000: 1,000 + 6,000 + 3,000 = 10,000
    cases = [
        build('tax-bracket-owed', head + 'A person has taxable income of 50,000 dollars. How much tax is owed?',
              ['10,000.00 dollars', '15,000.00 dollars', '7,000.00 dollars', '14,000.00 dollars'], bracket),
        build('tax-bracket-owed', head + 'A person has taxable income of exactly 10,000 dollars. How much tax is owed?',
              ['1,000.00 dollars', '2,000.00 dollars', '3,000.00 dollars', '500.00 dollars'], bracket),
        build('budget-percent-share', 'A monthly income of 900 dollars is split as shown. How many dollars go to Rent?',
              ['135 dollars', '765 dollars', '15 dollars', '1,350 dollars'],
              [('Rent', ['15%']), ('Gas', ['35%']), ('Food', ['30%']), ('Savings', ['20%'])]),
        build('net-worth-statement',
              'Each item is listed with its value or the amount owed, in dollars. An asset is something owned that has '
              'value; a liability is money owed. What is the net worth?',
              ['−250 dollars', '250 dollars', '1,000 dollars', '1,250 dollars'],
              [('Laptop', ['500']), ('Car loan balance', ['750'])]),
        build('incentive-compare', 'A jacket costs 60 dollars. A shopper uses both a 20% discount and a 5 dollars coupon. '
              'The 20% discount is taken from the price first, and then the 5 dollars coupon is subtracted. '
              'What is the final cost?', ['43.00 dollars', '55.00 dollars', '48.00 dollars', '44.00 dollars']),
        build('profit-cost-breakeven',
              'A club sells bracelets for 7 dollars each. The fixed costs, which stay the same no matter how many are made, '
              'are 36 dollars for the table fee and 18 dollars for the banner. Making each one costs 4 dollars in beads and '
              'string, a variable cost. What is the total cost of making 5 bracelets?',
              ['74 dollars', '20 dollars', '54 dollars', '35 dollars']),
        build('tax-kinds-defined',
              'A percent of the price that is added at the register when a customer buys something. '
              'Which kind of tax is this?', ['Sales tax', 'Income tax', 'Property tax', 'Payroll tax']),
        build('payroll-property-tax',
              'A county charges a property tax of 2 dollars for each 100 dollars of taxable value. '
              'A home is assessed at 50,000 dollars for the tax. What is the yearly property tax?',
              ['1,000 dollars', '100 dollars', '10,000 dollars', '25 dollars']),
    ]
    rejected = 0

    def reject(problem):
        nonlocal rejected
        try:
            review_problem(problem)
        except ValueError:
            rejected += 1
            return
        raise ValueError('Corrupt finance problem was accepted')

    for case in cases:
        # every fixture's first choice is the hand-computed answer
        true = 'option-a'
        review_problem(case)
        wrong = next(o['id'] for o in case['public']['response']['options'] if o['id'] != true)
        bad = copy.deepcopy(case)
        bad['answer'] = wrong
        reject(bad)
        bad = copy.deepcopy(case)
        bad['public']['response']['options'][3]['label'] = bad['public']['response']['options'][0]['label']
        reject(bad)
    # Rule-statement and long-label mutations must fail.
    bad = copy.deepcopy(cases[0])
    bad['public']['prompt'] = bad['public']['prompt'].replace('only to the part', 'to all')
    reject(bad)
    bad = copy.deepcopy(cases[2])
    bad['public']['figure']['scene']['elements'][0]['rows'][0]['label'] = 'A very long category label'
    reject(bad)
    bad = copy.deepcopy(cases[2])
    bad['public']['figure']['scene']['elements'][0]['rows'][1]['cells'] = ['45%']
    reject(bad)
    bad = copy.deepcopy(cases[1])
    bad['public']['prompt'] = bad['public']['prompt'].replace('exactly 10,000', 'exactly 10,001')
    reject(bad)
    leak = copy.deepcopy(cases[6])
    leak['hint'] = 'The answer is Sales tax.'
    reject(leak)
    return {'fixtures': len(cases), 'rejectedMutations': rejected}

# Read by independent-math-review.py (FamilyOracle).
CHOICE_REVIEW = SUPPORTED



if __name__ == '__main__':
    print(self_test())
