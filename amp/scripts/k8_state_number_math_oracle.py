"""Independent review of K-8 state number-sense templates from public payloads only.

Divisibility, primes, making change, money sets, customary units and estimation are
re-derived from the prompt, the choices and the figure. Every option is evaluated, so
a distractor that is also true (or a missing correct answer) raises.
"""
import copy
import math
import re
from decimal import Decimal
from fractions import Fraction

SUPPORTED = frozenset({
    'divisibility-rule-check', 'prime-composite-sort', 'prime-factorization-exponents',
    'prime-factorization-value', 'decimal-money-change', 'fewest-coins-change',
    'compare-money-sets', 'customary-unit-rename', 'customary-unit-reverse',
    'customary-unit-choice', 'customary-mixed-units', 'compatible-number-estimate',
    'benchmark-percent-estimate',
})


def require(condition, message):
    if not condition:
        raise ValueError(message)


def num(text):
    return int(text.replace(',', ''))


def labels(public):
    response = public['response']
    require(response['kind'] == 'choice', 'Choice response expected')
    options = response['options']
    require(len({o['id'] for o in options}) == len(options), 'Duplicate option ids')
    return options


def pick(options, truth, what):
    require(sum(truth) == 1, f'{what}: need exactly one correct option, got {sum(truth)}')
    return next(o['id'] for o, t in zip(options, truth) if t)


def is_prime(n):
    return n > 1 and all(n % d for d in range(2, math.isqrt(n) + 1))


def factorize(n):
    out, d = {}, 2
    while n > 1:
        while n % d == 0:
            out[d] = out.get(d, 0) + 1
            n //= d
        d += 1
    return out


# ---------------------------------------------------------------- number theory
def solve_divisibility(public):
    options = labels(public)
    text = public['prompt']
    values = [o['label'].replace(',', '') for o in options]
    require(len(set(values)) == len(values), 'Duplicate choices')
    m = re.fullmatch(r'Which number is divisible by (\d+)\?', text)
    if m:
        k = int(m[1])
        return pick(options, [int(v) % k == 0 for v in values], 'divisible')
    m = re.fullmatch(r'One digit is hidden: (\d*)▢(\d*)\. Which digit can replace ▢ so that the number is divisible by (\d+)\?', text)
    require(m is not None, 'Unrecognized divisibility prompt')
    pre, post, k = m[1], m[2], int(m[3])
    require(all(re.fullmatch(r'\d', v) for v in values), 'Digit choices expected')
    if not pre:
        require('0' not in values, 'Leading hidden digit may not be 0')
    return pick(options, [int(pre + v + post) % k == 0 for v in values], 'missing digit')


def solve_prime_composite(public):
    options = labels(public)
    text = public['prompt']
    values = [int(o['label']) for o in options]
    require(len(set(values)) == len(values), 'Duplicate choices')
    if text == 'Which number is prime?':
        truth = [is_prime(v) for v in values]
    elif text == 'Which number is composite?':
        truth = [v > 1 and not is_prime(v) for v in values]
    elif text == 'Which number is neither prime nor composite?':
        truth = [v < 2 for v in values]
    else:
        raise ValueError('Unrecognized prime prompt')
    return pick(options, truth, 'prime/composite')


def parse_factorization(label):
    """$2^{2}\\times 3$ -> (product, all_prime, primes_distinct_sorted, exponents_collapsed)."""
    body = label.replace('$', '').strip()
    parts = [p.strip() for p in body.split('\\times')]
    value, bases, primes_ok = 1, [], True
    for p in parts:
        m = re.fullmatch(r'(\d+)(?:\^\{(\d+)\})?', p)
        require(m is not None, f'Bad factor {p}')
        base, exp = int(m[1]), int(m[2] or 1)
        require(exp >= 2 or m[2] is None, 'Exponent 1 written')
        value *= base ** exp
        bases.append(base)
        primes_ok &= is_prime(base)
    return value, primes_ok and bases == sorted(set(bases))


def solve_factorization_exponents(public):
    options = labels(public)
    text = public['prompt']
    m = re.fullmatch(r'Which is the prime factorization of (\d+), written with exponents for repeated factors\?', text)
    if m:
        n = int(m[1])
    else:
        m = re.fullmatch(r'A factor tree for (\d+) starts with \1 = (\d+) × (\d+)\. Which is the complete prime factorization of \1, written with exponents for repeated factors\?', text)
        require(m is not None, 'Unrecognized factorization prompt')
        n = int(m[1])
        require(int(m[2]) * int(m[3]) == n, 'Factor tree start must multiply to n')
    parsed = [parse_factorization(o['label']) for o in options]
    require(len({p for p in parsed}) == len(parsed), 'Duplicate factorizations')
    return pick(options, [v == n and ok for v, ok in parsed], 'factorization')


def solve_factorization_value(public):
    text = public['prompt']
    m = re.fullmatch(r'What is the greatest prime factor of (\d+)\?', text)
    if m:
        return Fraction(max(factorize(int(m[1]))))
    m = re.fullmatch(r'Write (\d+) as a product of primes, repeating a prime each time it is a factor\. How many primes are in the product\?', text)
    if m:
        return Fraction(sum(factorize(int(m[1])).values()))
    m = re.fullmatch(r'What number has the prime factorization \$(.+)\$\?', text)
    require(m is not None, 'Unrecognized factorization-value prompt')
    value, _ = parse_factorization(m[1])
    return Fraction(value)


# ------------------------------------------------------------------- money
COIN = {'dollar': 100, 'quarter': 25, 'dime': 10, 'nickel': 5, 'penny': 1}


def cents(text):
    return int((Decimal(text) * 100).to_integral_value())


def dollars_exact(text):
    d = Decimal(text) * 100
    require(d == d.to_integral_value(), f'Fractional cent in {text}')
    return int(d)


def solve_decimal_money(public):
    t = public['prompt']
    t = re.sub(r' Enter the amount in dollars and cents, such as 2\.35\.$', '', t)
    P = r'(\d+\.\d\d)'
    m = re.fullmatch(r'\w+ pays for an? [\w ]+ with an? (\d+)-dollar bill and gets ' + P + r' dollars in change\. How many dollars did the [\w ]+ cost\?', t)
    if m:
        total = int(m[1]) * 100 - dollars_exact(m[2])
    elif (m := re.fullmatch(r'\w+ has ' + P + r' dollars\. An? [\w ]+ costs ' + P + r' dollars\. How much more money does \w+ need\?', t)):
        total = dollars_exact(m[2]) - dollars_exact(m[1])
    elif (m := re.fullmatch(r'\w+ buys (\d+) [\w ]+ at ' + P + r' dollars each and an? [\w ]+ for ' + P + r' dollars\. \w+ pays with an? (\d+)-dollar bill\. How much change does \w+ get\?', t)):
        total = int(m[4]) * 100 - (int(m[1]) * dollars_exact(m[2]) + dollars_exact(m[3]))
    elif (m := re.fullmatch(r'\w+ buys an? [\w ]+ for ' + P + r' dollars and an? [\w ]+ for ' + P + r' dollars, and pays with an? (\d+)-dollar bill\. How much change should \w+ get\?', t)):
        total = int(m[3]) * 100 - dollars_exact(m[1]) - dollars_exact(m[2])
    elif (m := re.fullmatch(r'\w+ buys an? [\w ]+ for ' + P + r' dollars and pays with an? (\d+)-dollar bill\. How much change should \w+ get\?', t)):
        total = int(m[2]) * 100 - dollars_exact(m[1])
    else:
        raise ValueError(f'Unrecognized money prompt: {t}')
    require(total > 0, 'Non-positive money result')
    return Fraction(total, 100)


def min_pieces(amount, denominations):
    best = [0] + [None] * amount
    for a in range(1, amount + 1):
        options = [best[a - d] + 1 for d in denominations if d <= a and best[a - d] is not None]
        best[a] = min(options) if options else None
    return best[amount]


def solve_fewest_coins(public):
    t = public['prompt']
    names = {'quarters': 25, 'dimes': 10, 'nickels': 5, 'pennies': 1}
    m = re.fullmatch(r'A cashier owes (\d+) cents in change\. Using quarters, dimes, nickels and pennies, what is the fewest number of coins the cashier can give\?', t)
    if m:
        amount, denominations = int(m[1]), [25, 10, 5, 1]
    else:
        m = re.fullmatch(r'A cashier owes (\d+\.\d\d) dollars in change\. Using (\d+)-dollar bills, quarters, dimes, nickels and pennies, what is the fewest number of bills and coins the cashier can give\?', t)
        if m:
            amount, denominations = dollars_exact(m[1]), [int(m[2]) * 100, 25, 10, 5, 1]
        else:
            m = re.fullmatch(r'A pack of markers costs (\d+\.\d\d) dollars\. \w+ pays with an? (\d+)-dollar bill\. The cashier gives change using (\d+)-dollar bills, quarters, dimes, nickels and pennies\. What is the fewest number of bills and coins the cashier can give\?', t)
            require(m is not None, f'Unrecognized coin prompt: {t}')
            amount = int(m[2]) * 100 - dollars_exact(m[1])
            denominations = [int(m[3]) * 100, 25, 10, 5, 1]
    require(amount > 0, 'Nothing to change')
    return Fraction(min_pieces(amount, denominations))


def solve_compare_money(public):
    figure = public['figure']
    require(figure and figure['kind'] == 'money-sets', 'money-sets figure required')
    sets = figure['sets']
    values = {s['label']: sum(COIN[i] for i in s['items']) for s in sets}
    options = labels(public)
    require(sorted(values) == sorted(o['label'].replace('Set ', '') for o in options), 'Figure sets must match choices')
    require(len(values) == len(sets), 'Duplicate set labels')
    t = public['prompt']
    if t == 'Which set of bills and coins is worth the most money?':
        target = max(values.values())
        require(list(values.values()).count(target) == 1, 'Tie for most')
        truth = [values[o['label'][4:]] == target for o in options]
    elif t == 'Which set of bills and coins is worth the least money?':
        target = min(values.values())
        require(list(values.values()).count(target) == 1, 'Tie for least')
        truth = [values[o['label'][4:]] == target for o in options]
    else:
        m = re.fullmatch(r'Which set of bills and coins is worth exactly (\d+(?:\.\d\d)?) dollars\?', t)
        require(m is not None, 'Unrecognized money-set prompt')
        target = dollars_exact(m[1])
        truth = [values[o['label'][4:]] == target for o in options]
    return pick(options, truth, 'money sets')


# ------------------------------------------------------------- customary units
UNIT = {
    'inch': 'in', 'inches': 'in', 'in': 'in', 'foot': 'ft', 'feet': 'ft', 'ft': 'ft',
    'yard': 'yd', 'yards': 'yd', 'yd': 'yd', 'mile': 'mi', 'miles': 'mi',
    'ounce': 'oz', 'ounces': 'oz', 'oz': 'oz', 'pound': 'lb', 'pounds': 'lb', 'lb': 'lb',
    'ton': 'ton', 'tons': 'ton', 'fluid ounce': 'floz', 'fluid ounces': 'floz', 'fl oz': 'floz',
    'cup': 'c', 'cups': 'c', 'c': 'c', 'pint': 'pt', 'pints': 'pt', 'quart': 'qt', 'quarts': 'qt', 'qt': 'qt',
    'gallon': 'gal', 'gallons': 'gal', 'gal': 'gal',
}
# Real-world relations (small units per one large unit); stated relations must match.
TRUE = {('ft', 'in'): 12, ('yd', 'ft'): 3, ('yd', 'in'): 36, ('mi', 'ft'): 5280, ('mi', 'yd'): 1760,
        ('lb', 'oz'): 16, ('ton', 'lb'): 2000, ('c', 'floz'): 8, ('pt', 'c'): 2, ('qt', 'pt'): 2,
        ('qt', 'c'): 4, ('gal', 'qt'): 4, ('gal', 'pt'): 8, ('gal', 'c'): 16}
UNIT_RE = r'(fluid ounces?|fl oz|[a-z]+)'
REL = re.compile(r'1 ' + UNIT_RE + r' = ([\d,]+) ' + UNIT_RE)


def relations(text):
    rel = {}
    for a, k, b in REL.findall(text):
        a, b = UNIT[a], UNIT[b]
        require(TRUE.get((a, b)) == num(k), f'Stated relation 1 {a} = {k} {b} is not true')
        rel[(a, b)] = num(k)
    return rel


def factor(rel, big, small):
    """small units in one big unit, following the stated chain."""
    if big == small:
        return 1
    if (big, small) in rel:
        return rel[(big, small)]
    for (a, b), k in rel.items():
        if a == big and b != small:
            try:
                return k * factor(rel, b, small)
            except ValueError:
                pass
    raise ValueError(f'No stated relation from {big} to {small}')


def solve_unit_rename(public):
    t = public['prompt']
    rel = relations(t)
    m = re.search(r'One amount is ([\d,]+) ' + UNIT_RE + r' and another is ([\d,]+) ' + UNIT_RE + r'\. How many ' + UNIT_RE + r' (?:longer|heavier|larger) is the first amount than the second\?', t)
    if m:
        big, small, target = UNIT[m[2]], UNIT[m[4]], UNIT[m[5]]
        require(target == small, 'Difference unit must be the smaller unit')
        result = num(m[1]) * factor(rel, big, small) - num(m[3])
        require(result > 0, 'First amount must be larger')
        return Fraction(result)
    m = re.search(r'([\d,]+) ' + UNIT_RE + r'(?: is how many |[^.?]*\. How many )' + UNIT_RE, t)
    require(m is not None, f'Unrecognized rename prompt: {t}')
    return Fraction(num(m[1]) * factor(rel, UNIT[m[2]], UNIT[m[3]]))


def solve_unit_reverse(public):
    t = public['prompt']
    rel = relations(t)
    m = re.match(r'How many whole ' + UNIT_RE + r' can be made from ([\d,]+) ' + UNIT_RE + r'\?', t)
    if m:
        small, big = UNIT[m[3]], UNIT[m[1]]
        return Fraction(num(m[2]) // factor(rel, big, small))
    m = re.match(r'How many ' + UNIT_RE + r' are in ([\d,]+) ' + UNIT_RE + r'\?', t)
    if m:
        return Fraction(num(m[2]) * factor(rel, UNIT[m[3]], UNIT[m[1]]))
    m = re.match(r'([\d,]+) ' + UNIT_RE + r' is how many ' + UNIT_RE + r'\?', t)
    require(m is not None, f'Unrecognized reverse prompt: {t}')
    q, f = num(m[1]), factor(rel, UNIT[m[3]], UNIT[m[2]])
    require(q % f == 0, 'Reverse conversion must be a whole number when "is how many" is asked')
    return Fraction(q, f)


# Reasonable ranges in a base unit, written independently from everyday knowledge.
IN, FT, YD, MI = 1, 12, 36, 63360
OZ, LB, TON = 1, 16, 32000
FLOZ, CUP, PT, QT, GAL = 1, 8, 16, 32, 128
BASE = {'in': (IN, 'len'), 'ft': (FT, 'len'), 'yd': (YD, 'len'), 'mi': (MI, 'len'),
        'oz': (OZ, 'wt'), 'lb': (LB, 'wt'), 'ton': (TON, 'wt'),
        'floz': (FLOZ, 'cap'), 'c': (CUP, 'cap'), 'pt': (PT, 'cap'), 'qt': (QT, 'cap'), 'gal': (GAL, 'cap')}
OBJECTS = {  # object: (dimension, low, high) in base units
    'the length of a school bus': ('len', 20 * FT, 60 * FT),
    'the drive from one town to the next': ('len', 1 * MI, 100 * MI),
    'the length of a pencil': ('len', 5 * IN, 9 * IN),
    'the length of a crayon': ('len', 2 * IN, 5 * IN),
    'the length of a football field': ('len', 80 * YD, 130 * YD),
    'the height of a classroom door': ('len', 6 * FT, 9 * FT),
    'the weight of an apple': ('wt', 3 * OZ, 12 * OZ),
    'the weight of a car': ('wt', TON // 2, 4 * TON),
    'the weight of a slice of bread': ('wt', OZ // 2, 2 * OZ),
    'the weight of a bowling ball': ('wt', 6 * LB, 16 * LB),
    'the weight of a backpack': ('wt', 3 * LB, 25 * LB),
    'the amount in a cooler of water': ('cap', 2 * GAL, 12 * GAL),
    'the amount in a glass of milk': ('cap', 6 * FLOZ, 12 * FLOZ),
    'the amount in a juice box': ('cap', 4 * FLOZ, 10 * FLOZ),
    'the amount in a bathtub of water': ('cap', 20 * GAL, 80 * GAL),
}


def solve_unit_choice(public):
    options = labels(public)
    m = re.fullmatch(r'Which measure is most reasonable for (.+)\?', public['prompt'])
    require(m is not None and m[1] in OBJECTS, f'Unknown object: {public["prompt"]}')
    dim, low, high = OBJECTS[m[1]]
    truth = []
    for o in options:
        q = re.fullmatch(r'(\d+) (fluid ounces?|[a-z]+)', o['label'])
        require(q is not None, f'Bad measure label {o["label"]}')
        base, d = BASE[UNIT[q[2]]]
        truth.append(d == dim and low <= int(q[1]) * base <= high)
    return pick(options, truth, 'reasonable unit')


MIXED_RE = re.compile(r'(\d+) (yd|ft|in|lb|oz|gal|qt|cups?|c|fl oz)\b')


def mixed_findall(text):
    return [(q, 'c' if u in ('cup', 'cups') else u) for q, u in MIXED_RE.findall(text)]

MIXED_PAIR = {'yd': ('ft', 3), 'ft': ('in', 12), 'lb': ('oz', 16), 'gal': ('qt', 4), 'c': ('fl oz', 8)}
SMALL_OF = {big: small for big, (small, _) in MIXED_PAIR.items()}


def mixed_total(text, big):
    """Total in the small unit of 'a big b small'; `big` fixes the pair."""
    small, ratio = MIXED_PAIR[big]
    total = 0
    for q, u in mixed_findall(text):
        require(u in (big, small), f'Unit {u} outside {big}/{small}')
        total += int(q) * (ratio if u == big else 1)
    return total


ABBR = {'yd': 'yard', 'ft': 'foot', 'lb': 'pound', 'gal': 'gallon', 'c': 'cup'}


def solve_mixed(public):
    options = labels(public)
    t = public['prompt']
    rel = relations(t)
    first = t.split('. ')[0]
    quantities = mixed_findall(first)
    if first.startswith('Write') and first.endswith('only'):
        require(len(quantities) == 2, 'One mixed amount expected')
        big = quantities[0][1]
        small, ratio = MIXED_PAIR[big]
        require(rel.get((UNIT[big], UNIT[small])) == ratio, 'Stated relation must match the units')
        expected = mixed_total(first, big)
        truth = []
        for o in options:
            lm = re.fullmatch(r'(\d+) ' + re.escape(small), o['label'])
            require(lm is not None, f'Bad only-label {o["label"]}')
            truth.append(int(lm[1]) == expected)
        return pick(options, truth, 'mixed only')
    if first.startswith('Write'):
        m = re.fullmatch(r'Write (\d+) [a-z ]+ as ([a-z]+) and [a-z ]+, with fewer than (\d+) [a-z ]+ left over', first)
        require(m is not None, f'Unrecognized write prompt: {first}')
        ratio = int(m[3])
        big = next(b for b, (s, r) in MIXED_PAIR.items() if r == ratio and UNIT[b] == UNIT[m[2].rstrip('s') if m[2] != 'feet' else 'foot'])
        require(rel.get((UNIT[big], UNIT[MIXED_PAIR[big][0]])) == ratio, 'Stated relation must match the units')
        return _normal_form_pick(options, int(m[1]), big, ratio)
    require(first.startswith(('Add', 'Subtract')) and len(quantities) == 4, f'Unrecognized mixed prompt: {t}')
    big = quantities[0][1]
    small, ratio = MIXED_PAIR[big]
    require(rel.get((UNIT[big], UNIT[small])) == ratio, 'Stated relation must match the units')
    require(f'fewer than {ratio} ' in t, 'Normal form bound must be stated')
    a = mixed_total(' '.join(f'{q} {u}' for q, u in quantities[:2]), big)
    b = mixed_total(' '.join(f'{q} {u}' for q, u in quantities[2:]), big)
    if first.startswith('Add'):
        total = a + b
    else:
        total = b - a  # "Subtract A from B"
        require(total > 0, 'Negative difference')
    return _normal_form_pick(options, total, big, ratio)


def _normal_form_pick(options, total, big, ratio):
    small = MIXED_PAIR[big][0]
    truth = []
    for o in options:
        lm = re.fullmatch(r'(\d+) ' + ('cups?' if big == 'c' else big) + r' (\d+) ' + re.escape(small), o['label'])
        require(lm is not None, f'Bad mixed label {o["label"]}')
        b, s = int(lm[1]), int(lm[2])
        truth.append(b * ratio + s == total and s < ratio)
    return pick(options, truth, 'mixed normal form')


# ------------------------------------------------------------------ estimation
def nearest_multiple(n, k):
    lo = n // k * k
    hi = lo + k
    require(n - lo != hi - n, f'Tie when rounding {n} to a multiple of {k}')
    return lo if n - lo < hi - n else hi


def option_value(label):
    m = re.fullmatch(r'(?:about )?([\d,]+(?:\.\d+)?)(?: (dollar|dollars))?', label)
    require(m is not None, f'Bad estimate label {label}')
    if m[2]:
        require((m[2] == 'dollar') == (Fraction(m[1].replace(',', '')) == 1), 'Dollar singular/plural mismatch')
    return Fraction(m[1].replace(',', ''))


def front_end(n):
    digits = len(str(n))
    return int(str(n)[0]) * 10 ** (digits - 1)


def solve_compatible(public):
    options = labels(public)
    t = public['prompt']
    m = re.fullmatch(r'Estimate (\d+) × (\d+) with compatible numbers\. Change \1 to the closest multiple of (\d+), then multiply by \2\.', t)
    if m:
        expected = nearest_multiple(int(m[1]), int(m[3])) * int(m[2])
    else:
        m = re.fullmatch(r'Estimate (\d+) ÷ (\d+) with compatible numbers\. Change \1 to the closest multiple of (\d+), then divide by \2\.', t)
        if m:
            rounded = nearest_multiple(int(m[1]), int(m[3]))
            require(rounded % int(m[2]) == 0, 'Compatible number must divide evenly')
            expected = Fraction(rounded, int(m[2]))
        else:
            m = re.fullmatch(r'Use front-end estimation to estimate ([\d, +]+)\. Add only the first digit of each number, keeping its place value\.', t)
            require(m is not None, 'Unrecognized estimation prompt')
            expected = sum(front_end(num(x)) for x in m[1].split(' + '))
    values = [option_value(o['label']) for o in options]
    require(len(set(values)) == len(values), 'Duplicate estimates')
    return pick(options, [v == expected for v in values], 'compatible estimate')


def solve_benchmark(public):
    options = labels(public)
    t = public['prompt']
    cost = r'(\d+\.\d\d)'
    m = re.fullmatch(r'A jacket costs ' + cost + r' dollars and is (\d+)% off\. Round the cost to the nearest (\d+) dollars, then estimate the (amount of the discount|sale price)\.', t)
    if m:
        c = Decimal(m[1])
        k = int(m[3])
        lo = int(c // k) * k
        require(c - lo != k - (c - lo), 'Tie when rounding cost')
        rounded = lo if c - lo < k - (c - lo) else lo + k
        pct = int(m[2])
        require(pct in (10, 25, 50), 'Stated benchmark percent expected')
        discount = Fraction(rounded * pct, 100)
        expected = discount if m[4].startswith('amount') else rounded - discount
    else:
        m = re.fullmatch(r"\w+'s (?:meal|purchase) costs " + cost + r' dollars\. Round the cost to the nearest (\d+) dollars, then use benchmarks to estimate the (?:tip|sales tax) at (\d+)%\.', t)
        require(m is not None, f'Unrecognized benchmark prompt: {t}')
        c, k = Decimal(m[1]), int(m[2])
        lo = int(c // k) * k
        require(c - lo != k - (c - lo), 'Tie when rounding cost')
        rounded = lo if c - lo < k - (c - lo) else lo + k
        expected = Fraction(rounded * int(m[3]), 100)
    values = [option_value(o['label']) for o in options]
    require(len(set(values)) == len(values), 'Duplicate estimates')
    return pick(options, [v == expected for v in values], 'benchmark estimate')


SOLVERS = {
    'divisibility-rule-check': solve_divisibility, 'prime-composite-sort': solve_prime_composite,
    'prime-factorization-exponents': solve_factorization_exponents,
    'prime-factorization-value': solve_factorization_value, 'decimal-money-change': solve_decimal_money,
    'fewest-coins-change': solve_fewest_coins, 'compare-money-sets': solve_compare_money,
    'customary-unit-rename': solve_unit_rename, 'customary-unit-reverse': solve_unit_reverse,
    'customary-unit-choice': solve_unit_choice, 'customary-mixed-units': solve_mixed,
    'compatible-number-estimate': solve_compatible, 'benchmark-percent-estimate': solve_benchmark,
}


def solve(public):
    require(public['templateId'] in SUPPORTED, 'Unexpected K-8 state number family')
    return SOLVERS[public['templateId']](public)


def review_problem(problem):
    public = problem['public']
    result = solve(public)
    if public['response']['kind'] == 'number':
        answer = problem['answer']
        require(isinstance(answer, str) and re.fullmatch(r'\d+(\.\d\d)?', answer), f'Bad numeric answer format {answer!r}')
        if public['templateId'] in ('decimal-money-change',):
            require(re.fullmatch(r'\d+\.\d\d', answer), 'Money answers are dollars and cents')
        require(Fraction(answer) == result, f'Numeric answer mismatch {answer} vs {result}')
        return result
    require(result == problem['answer'], 'Choice answer key mismatch')
    return result


def _choice_problem(template, prompt, labels_, key, figure=None):
    public = {'templateId': template, 'prompt': prompt,
              'response': {'kind': 'choice', 'options': [{'id': f'o{i}', 'label': l} for i, l in enumerate(labels_)]}}
    if figure:
        public['figure'] = figure
    return {'public': public, 'answer': f'o{key}'}


def _number_problem(template, prompt, answer):
    return {'public': {'templateId': template, 'prompt': prompt, 'response': {'kind': 'number', 'label': 'x'}}, 'answer': answer}


def self_test():
    good = [
        _choice_problem('divisibility-rule-check', 'One digit is hidden: ▢608. Which digit can replace ▢ so that the number is divisible by 3?', ['3', '9', '5', '4'], 3),
        _choice_problem('divisibility-rule-check', 'Which number is divisible by 4?', ['102', '114', '116', '130'], 2),
        _choice_problem('prime-composite-sort', 'Which number is neither prime nor composite?', ['1', '2', '9', '11'], 0),
        _choice_problem('prime-composite-sort', 'Which number is composite?', ['91', '37', '59', '67'], 0),
        _choice_problem('prime-factorization-exponents', 'Which is the prime factorization of 12, written with exponents for repeated factors?', ['$2\\times 3$', '$2^{2}\\times 3$', '$2^{3}\\times 3$', '$3\\times 4$'], 1),
        _number_problem('prime-factorization-value', 'What is the greatest prime factor of 52?', '13'),
        _number_problem('prime-factorization-value', 'What number has the prime factorization $2^{2}\\times 3^{2}$?', '36'),
        _number_problem('decimal-money-change', 'Finn buys a sticker book for 8.63 dollars and pays with a 10-dollar bill. How much change should Finn get? Enter the amount in dollars and cents, such as 2.35.', '1.37'),
        _number_problem('fewest-coins-change', 'A cashier owes 1.55 dollars in change. Using 1-dollar bills, quarters, dimes, nickels and pennies, what is the fewest number of bills and coins the cashier can give?', '4'),
        _number_problem('fewest-coins-change', 'A cashier owes 30 cents in change. Using quarters, dimes, nickels and pennies, what is the fewest number of coins the cashier can give?', '2'),
        _choice_problem('compare-money-sets', 'Which set of bills and coins is worth the most money?',
                        ['Set A', 'Set B', 'Set C'], 0, {'kind': 'money-sets', 'sets': [
                            {'label': 'A', 'items': ['dollar', 'penny']}, {'label': 'B', 'items': ['quarter', 'dime', 'dime']},
                            {'label': 'C', 'items': ['quarter', 'quarter', 'penny']}]}),
        _number_problem('customary-unit-rename', 'A tank holds 6 quarts of water. How many cups of water does it hold? 1 quart = 4 cups.', '24'),
        _number_problem('customary-unit-rename', 'One amount is 4 miles and another is 18,777 feet. How many feet longer is the first amount than the second? 1 mile = 5,280 feet.', '2343'),
        _number_problem('customary-unit-reverse', 'How many whole quarts can be made from 14 cups? Use 1 quart = 4 cups.', '3'),
        _number_problem('customary-unit-reverse', 'How many cups are in 9 quarts? Use 1 quart = 2 pints and 1 pint = 2 cups.', '36'),
        _choice_problem('customary-unit-choice', 'Which measure is most reasonable for the length of a pencil?', ['7 inches', '7 yards', '7 miles', '7 feet'], 0),
        _choice_problem('customary-mixed-units', 'Write 9 yd 2 ft as feet only. 1 yard = 3 feet.', ['29 ft', '27 ft', '92 ft', '11 ft'], 0),
        _choice_problem('customary-mixed-units', 'Subtract 4 yd 2 ft from 8 yd 1 ft. Write the difference with fewer than 3 feet. 1 yard = 3 feet.', ['3 yd 9 ft', '4 yd 2 ft', '4 yd 1 ft', '3 yd 2 ft'], 3),
        _choice_problem('customary-mixed-units', 'Write 30 inches as feet and inches, with fewer than 12 inches left over. 1 foot = 12 inches.', ['2 ft 6 in', '1 ft 6 in', '3 ft 0 in', '6 ft 2 in'], 0),
        _choice_problem('compatible-number-estimate', 'Estimate 491 ÷ 5 with compatible numbers. Change 491 to the closest multiple of 50, then divide by 5.', ['100', '1,000', '90', '10'], 0),
        _choice_problem('compatible-number-estimate', 'Use front-end estimation to estimate 7,201 + 9,406. Add only the first digit of each number, keeping its place value.', ['16,607', '16,000', '16', '160,000'], 1),
        _choice_problem('benchmark-percent-estimate', 'A jacket costs 121.52 dollars and is 25% off. Round the cost to the nearest 20 dollars, then estimate the sale price.', ['about 95 dollars', 'about 150 dollars', 'about 30 dollars', 'about 90 dollars'], 3),
        _choice_problem('benchmark-percent-estimate', "Ben's meal costs 52.56 dollars. Round the cost to the nearest 10 dollars, then use benchmarks to estimate the tip at 15%.", ['about 0.75 dollars', 'about 7.50 dollars', 'about 15 dollars', 'about 75 dollars'], 1),
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
        if bad['public']['response']['kind'] == 'choice':
            n = len(bad['public']['response']['options'])
            bad['answer'] = f"o{(int(bad['answer'][1:]) + 1) % n}"
            reject(bad)
            bad = copy.deepcopy(problem)
            options = bad['public']['response']['options']
            wrong = next(i for i in range(len(options)) if f'o{i}' != problem['answer'])
            options[wrong]['label'] = next(o['label'] for o in options if f"o" + str(options.index(o)) == problem['answer'])
            reject(bad)
        else:
            bad['answer'] = str(int(Decimal(bad['answer'])) + 1) if '.' not in bad['answer'] else '0.01'
            reject(bad)
    # Specific hazards: a tie in rounding, an unreasonable unit, a two-correct money set, a false relation.
    reject(_choice_problem('compatible-number-estimate', 'Estimate 475 ÷ 5 with compatible numbers. Change 475 to the closest multiple of 50, then divide by 5.', ['100', '90', '95', '10'], 0))
    reject(_choice_problem('customary-unit-choice', 'Which measure is most reasonable for the length of a pencil?', ['7 inches', '7 feet', '7 yards', '7 miles'], 1))
    reject(_number_problem('customary-unit-rename', 'A rope is 4 yards long. How many feet long is it? 1 yard = 4 feet.', '16'))
    reject(_choice_problem('prime-composite-sort', 'Which number is prime?', ['2', '3', '9', '4'], 0))
    reject(_number_problem('fewest-coins-change', 'A cashier owes 30 cents in change. Using quarters, dimes, nickels and pennies, what is the fewest number of coins the cashier can give?', '3'))
    return {'fixtures': len(good), 'rejectedMutations': rejected}

# Read by independent-math-review.py (FamilyOracle).
CHOICE_REVIEW = 'choice-response'



if __name__ == '__main__':
    print(self_test())
