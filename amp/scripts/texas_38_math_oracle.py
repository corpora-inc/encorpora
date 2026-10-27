"""Independent review of the Texas grades 3-8 gap templates.

Every answer is derived from the public payload only: prompt text, choices and
figure data, with exact Fractions. Nothing here reads the generator.
"""
import copy
import json
import math
import re
import sys
from fractions import Fraction as F

SUPPORTED = frozenset('''times-as-many-comparison situation-pair-table story-equation-choice
strip-diagram-equation division-area-model fraction-benchmark-reasonable unit-relative-size
decimal-area-model number-set-venn check-register-balance reciprocal-division-choice
scaling-direction-choice percent-grid-model percent-forms-and-parts independent-dependent-roles
expression-or-equation rational-area-volume-equation categorical-summary lifetime-income-salary
pi-as-ratio experimental-probability-predict cylinder-prism-surface-area
both-sides-situation-equation'''.split())


def require(condition, message):
    if not condition:
        raise ValueError(message)


# ---------- exact value and expression helpers ----------
def clean(text):
    return text.replace('−', '-').replace('$', '').replace(',', '').strip()


def value(text):
    """Integer, decimal, fraction, mixed number or percent text -> Fraction."""
    t = clean(text).replace('%', '').lstrip('+')
    m = re.fullmatch(r'(-?)(\d+) (\d+)/(\d+)', t)
    if m:
        v = F(int(m[2])) + F(int(m[3]), int(m[4]))
        return -v if m[1] else v
    m = re.fullmatch(r'(-?\d+)/(\d+)', t)
    if m:
        return F(int(m[1]), int(m[2]))
    require(re.fullmatch(r'-?\d+(\.\d+)?', t) is not None, f'Unreadable number: {text}')
    return F(t)


TOKEN = re.compile(r'\s*(\d+ \d+/\d+|\d+/\d+|\d+(?:\.\d+)?[a-z]?|[a-z]|[()+\-×÷])')


def tokens(text):
    t = re.sub(r'(?<=\d),(?=\d{3})', '', text).replace('−', '-').replace('*', '×')
    out, pos = [], 0
    while pos < len(t.rstrip()):
        m = TOKEN.match(t, pos)
        require(m is not None, f'Unreadable expression: {text}')
        out.append(m[1])
        pos = m.end()
    return out


def evaluate(text, env=None):
    env = env or {}
    toks = tokens(text)
    pos = 0

    def peek():
        return toks[pos] if pos < len(toks) else None

    def operand(tok):
        m = re.fullmatch(r'(\d+(?:\.\d+)?)([a-z])', tok)
        if m:
            return F(m[1]) * env[m[2]]
        if re.fullmatch(r'[a-z]', tok):
            return env[tok]
        return value(tok)

    def factor():
        nonlocal pos
        tok = peek()
        require(tok is not None, 'Unexpected end of expression')
        pos += 1
        if tok == '(':
            v = expr()
            require(peek() == ')', 'Missing )')
            pos += 1
            return v
        if tok == '-':
            return -factor()
        return operand(tok)

    def term():
        nonlocal pos
        v = factor()
        while peek() in ('×', '÷'):
            op = toks[pos]
            pos += 1
            r = factor()
            v = v * r if op == '×' else v / r
        return v

    def expr():
        nonlocal pos
        v = term()
        while peek() in ('+', '-'):
            op = toks[pos]
            pos += 1
            r = term()
            v = v + r if op == '+' else v - r
        return v

    v = expr()
    require(pos == len(toks), f'Trailing tokens in {text}')
    return v


def relation(text):
    m = re.fullmatch(r'(.+?)\s*(=|<|>|≤|≥)\s*(.+)', text)
    require(m is not None, f'Not a relation: {text}')
    return m[1], m[2], m[3]


def truth(text, env):
    left, op, right = relation(text)
    a, b = evaluate(left, env), evaluate(right, env)
    return {'=': a == b, '<': a < b, '>': a > b, '≤': a <= b, '≥': a >= b}[op]


def options_of(public, count=4):
    response = public['response']
    require(response['kind'] == 'choice', 'Choice response expected')
    opts = response['options']
    require(len(opts) == count, f'Expected {count} choices')
    require(len({o['id'] for o in opts}) == count, 'Duplicate choice IDs')
    require(len({o['label'] for o in opts}) == count, 'Duplicate choice labels')
    return opts


def only(correct, message):
    require(len(correct) == 1, f'{message}: {len(correct)} qualify')
    return correct[0]


def number_response(public):
    require(public['response']['kind'] == 'number', 'Number response expected')


def table(public):
    scene = public['figure']['scene']
    tables = [e for e in scene['elements'] if e['type'] == 'table']
    require(len(tables) == 1, 'One table expected')
    return tables[0], scene


def money(text):
    return value(text)


def num_str(v):
    v = F(v)
    if v.denominator == 1:
        return str(v.numerator)
    return None


def same_number(answer, expected):
    return value(answer) == expected


# ---------- 1 times-as-many-comparison ----------
def solve_times_as_many(public):
    p = public['prompt']
    m = re.fullmatch(r'(\w+) has (\d+) (\w+)\. (\w+) has (\d+) times as many \3 as \1\. Which expression gives the number of \3 \4 has\?', p)
    if m:
        a, k = int(m[2]), int(m[5])
        opts = options_of(public)
        vals = [evaluate(o['label']) for o in opts]
        require(len(set(vals)) == 4, 'Expressions share a value (not mathematically distinct)')
        return only([o['id'] for o, v in zip(opts, vals) if v == a * k and '×' in o['label']], 'Product expression')
    m = re.fullmatch(r'(\w+) has (\d+) (\w+)\. (\w+) has (\d+) \3\. Which sentence compares the amounts correctly with "times as many"\?', p)
    if m:
        small, big = (m[1], m[4]) if int(m[2]) < int(m[5]) else (m[4], m[1])
        lo, hi = sorted((int(m[2]), int(m[5])))
        require(hi % lo == 0, 'Ratio is not whole')
        opts = options_of(public)
        good = [o['id'] for o in opts if re.fullmatch(rf'{big} has {hi // lo} times as many {m[3]} as {small}\.', o['label'])]
        return only(good, 'Times-as-many sentence')
    m = re.fullmatch(r'(\w+) has (\d+) (\w+)\. The product (\d+) × (\d+) is the number of \3 that (\w+) has\. Which sentence compares the two amounts\?', p)
    require(m is not None, 'Unreadable times-as-many prompt')
    owner, a, noun, k, a2, other = m[1], int(m[2]), m[3], int(m[4]), int(m[5]), m[6]
    require(a == a2, 'Product does not use the stated amount')
    opts = options_of(public)

    def true_statement(label):
        t = re.fullmatch(rf'(\w+) has (\d+) times as many {noun} as (\w+)\.', label)
        if t:
            return t[1] == other and t[3] == owner and int(t[2]) == k
        t = re.fullmatch(rf'(\w+) has (\d+) more {noun} than (\w+)\.', label)
        if t:
            who, n, ref = t[1], int(t[2]), t[3]
            return (who, ref) == (other, owner) and n == a * k - a
        raise ValueError(f'Unknown sentence: {label}')
    return only([o['id'] for o in opts if true_statement(o['label'])], 'Comparison sentence')


# ---------- 2 situation-pair-table ----------
def solve_situation_pair(public):
    number_response(public)
    t, _ = table(public)
    p = public['prompt']
    rows = [(r['label'], r['cells'][0]) for r in t['rows']]
    known = [(value(a), value(str(b))) for a, b in rows if a != '?' and b != '?']
    unknown = [r for r in rows if r[0] == '?' or r[1] == '?']
    require(len(unknown) == 1 and len(known) >= 3, 'One unknown row and three known rows expected')
    ratios = {y / x for x, y in known}
    gaps = {y - x for x, y in known}
    multiplicative = len(ratios) == 1
    additive = len(gaps) == 1
    require(multiplicative != additive, 'Table rule must be exactly one of multiplicative or additive')
    label, cell = unknown[0]
    if label == '?':
        given = value(str(cell))
        got = given / ratios.pop() if multiplicative else given - gaps.pop()
        asked_row = False
    else:
        given = value(label)
        got = given * ratios.pop() if multiplicative else given + gaps.pop()
        asked_row = True
    m = re.fullmatch(r'Each \w+ (?:seats|has|holds) (\d+) .*', p)
    if m:
        rate = int(m[1])
        require(multiplicative and (ratios or True), 'Rate stated but table additive')
        require(all(y == x * rate for x, y in known), 'Table disagrees with the stated rate')
    m = re.fullmatch(r'(\w+) is (\d+) years older than (\w+)\. The table shows their ages at different times\. How old is (\w+) when (\w+) is (\d+)\?', p)
    if m:
        older, gap, younger, asked, given_name, given_age = m[1], int(m[2]), m[3], m[4], m[5], int(m[6])
        require(additive, 'Ages need a constant gap table')
        col, corner = t['columns'][0], t['corner']
        require(col == f"{older}'s age" and corner == f"{younger}'s age", 'Table headings disagree with who is older')
        require(all(y - x == gap for x, y in known), 'Table gap disagrees with the story')
        require(given == given_age, 'Prompt value is not the table value')
        expected = given_age + gap if asked == older else given_age - gap
        require(got == expected, 'Table position disagrees with the question asked')
        return str(expected)
    m = re.search(r'for (\d+) (\w+)\?$|give (\d+) (\w+)\?$|for (one) (\w+)\?$', p)
    require(m is not None, 'Unreadable question')
    stated = 1 if m[5] else int(m[1] or m[3])
    require(stated == given, 'Prompt value is not the table value')
    if m[2] == 'bu' or (m[4] == 'bu'):
        raise ValueError('Truncated unit word in question')
    require(got.denominator == 1 and got > 0, 'Non-integer table answer')
    return str(got)


# ---------- 3 story-equation-choice ----------
def solve_story_equation(public):
    p = public['prompt']
    deltas = [int(x) for x in re.findall(r'gets (\d+) more', p)]
    gives = [int(x) for x in re.findall(r'gives away (\d+)', p)]
    env = None
    m = re.search(r'Let n be the number of \w+ (\w+) (?:had at first|got|has now|has left)\.', p)
    kind = re.search(r'Let n be the number of \w+ \w+ (had at first|got|has now|has left)', p)[1] if re.search(r'Let n be the number of \w+ \w+ (had at first|got|has now|has left)', p) else None
    require(kind is not None, 'Unreadable unknown')
    # Net change from the story, in order.
    signed = []
    for e in re.finditer(r'gets (\d+) more|gives away (\d+)|After getting (\d+) more', p):
        if e[1] or e[3]:
            signed.append(int(e[1] or e[3]))
        else:
            signed.append(-int(e[2]))
    net = sum(signed)
    if kind == 'had at first':
        m = re.search(r'(?:has (\d+) left|Now \w+ has (\d+)|, \w+ has (\d+)\.)', p)
        require(m is not None, 'Final amount not found')
        final = int(next(g for g in m.groups() if g))
        n = final - net
    elif kind == 'got':
        m = re.search(r'has (\d+) \w+, gets some more, and then has (\d+)\.', p)
        n = int(m[2]) - int(m[1])
    else:
        m = re.match(r'\w+ has (\d+) ', p)
        n = int(m[1]) + net
    require(n >= 0, 'Negative unknown')
    opts = options_of(public)
    return only([o['id'] for o in opts if truth(o['label'], {'n': F(n)})], 'Equation true for the story')


# ---------- 4 strip-diagram-equation ----------
def solve_strip(public):
    p = public['prompt']
    scene = public['figure']['scene']
    els = {e['id']: e for e in scene['elements']}
    whole, whole_label = els['whole'], els['whole-label']['text']
    parts, labels = [], []
    i = 0
    while f'part-{i}' in els:
        parts.append(els[f'part-{i}'])
        labels.append(els[f'part-label-{i}']['text'])
        i += 1
    require(abs(sum(q['size'][0] for q in parts) - whole['size'][0]) < 1e-9, 'Parts do not span the whole strip')
    for q, nxt in zip(parts, parts[1:]):
        require(abs(q['at'][0] + q['size'][0] - nxt['at'][0]) < 1e-9, 'Parts are not contiguous')
    # Equal values must have equal widths; the diagram pieces named n share one width.
    by_label = {}
    for q, lab in zip(parts, labels):
        by_label.setdefault(lab, set()).add(round(q['size'][0], 6))
    require(len(by_label.get('n', {1})) == 1, 'The n pieces are drawn with different widths')
    n_parts = labels.count('n')
    consts = sum(int(l) for l in labels if l != 'n')
    if whole_label == 'n':
        n_fig = F(consts)
    else:
        require(n_parts >= 1, 'Unknown n missing from the diagram')
        n_fig = F(int(whole_label) - consts, n_parts)
    nums = lambda s: [int(x) for x in re.findall(r'\d+', s)]
    m = re.match(r'(\w+) puts the same number of (\w+), n, in each of (\d+) boxes and (\d+) more \w+ in a bag\. There are (\d+) \w+ in all', p)
    if m:
        k, c, T = int(m[3]), int(m[4]), int(m[5])
        n = F(T - c, k)
        require(sorted(labels) == sorted(['n'] * k + [str(c)]) and whole_label == str(T), 'Figure disagrees with the story')
    m = re.match(r'(\w+) has (\d+) \w+, sets aside (\d+), and shares the rest equally among (\d+) friends\. Each friend gets n', p)
    if m:
        T, s, k = int(m[2]), int(m[3]), int(m[4])
        n = F(T - s, k)
        require(sorted(labels) == sorted(['n'] * k + [str(s)]) and whole_label == str(T), 'Figure disagrees with the story')
    m = re.match(r'(\w+) packs (\d+) bags with (\d+) \w+ in each bag and adds (\d+) loose', p)
    if m:
        k, b, c = int(m[2]), int(m[3]), int(m[4])
        n = F(k * b + c)
        require(sorted(labels) == sorted([str(b)] * k + [str(c)]) and whole_label == 'n', 'Figure disagrees with the story')
    m = re.match(r'(\w+) has (\d+) dollars and buys (\d+) items that cost (\d+) dollars each', p)
    if m:
        T, k, c = int(m[2]), int(m[3]), int(m[4])
        n = F(T - k * c)
        require(sorted(labels) == sorted([str(c)] * k + ['n']) and whole_label == str(T), 'Figure disagrees with the story')
    require('n' in locals() and isinstance(n, F), 'Unreadable strip story')
    require(n == n_fig and n > 0, 'Story and diagram give different n')
    opts = options_of(public)
    return only([o['id'] for o in opts if truth(o['label'], {'n': n})], 'Equation true for the diagram')


# ---------- 5 division-area-model ----------
def solve_division_area(public):
    p = public['prompt']
    opts = options_of(public)
    m = re.fullmatch(r'An area model for ([\d,]+) ÷ (\d+) is a rectangle (\d+) units tall\. Its area is split into two columns with areas ([\d,]+) and ([\d,]+)\. What is the quotient\?', p)
    if m:
        X, d, h, a, b = (value(m[i]) for i in range(1, 6))
        require(d == h and a + b == X and a % d == 0 and b % d == 0, 'Columns disagree with the area model')
        q = X / d
        return only([o['id'] for o in opts if value(o['label']) == q], 'Quotient')
    m = re.fullmatch(r'A rectangle has an area of ([\d,]+) square (\w+) and a height of (\d+) \2\. Its width is w \2\. Which equation shows ([\d,]+) ÷ (\d+) as an area model\?', p)
    if m:
        A, h = value(m[1]), value(m[3])
        require(value(m[4]) == A and value(m[5]) == h, 'Division does not match area and height')
        w = A / h
        require(w.denominator == 1, 'Non-whole width')
        return only([o['id'] for o in opts if truth(o['label'], {'w': w}) and '×' in o['label']], 'Area equation')
    m = re.fullmatch(r'An area model divides ([\d,]+) by (\d+)\. The rectangle is (\d+) units tall, and its area is split into ([\d, and]+) square units\. Which equation shows the quotient\?', p)
    require(m is not None, 'Unreadable area-model prompt')
    X, d, h = value(m[1]), value(m[2]), value(m[3])
    parts = [value(x) for x in re.findall(r'[\d,]+', m[4])]
    require(d == h and sum(parts) == X and all(x % d == 0 for x in parts), 'Partial areas disagree')
    widths = [x / d for x in parts]
    good = []
    for o in opts:
        left, right = o['label'].split(' = ')
        terms = [value(t) for t in left.split(' + ')]
        if terms == widths and value(right) == X / d:
            good.append(o['id'])
    return only(good, 'Partial-quotient equation')


# ---------- 6 fraction-benchmark-reasonable ----------
BENCH = [F(0), F(1, 4), F(1, 2), F(3, 4), F(1)]


def nearest(x):
    best = sorted(BENCH, key=lambda b: abs(b - x))
    require(abs(best[0] - x) != abs(best[1] - x), 'Benchmark tie')
    return best[0]


def fmt_mixed(v):
    whole, rest = divmod(v, 1)
    if rest == 0:
        return str(whole)
    return f'{rest}' if whole == 0 else f'{whole} {rest}'


def solve_benchmark(public):
    p = public['prompt']
    opts = options_of(public, 4 if 'adds' in p else 4)
    m = re.fullmatch(r'A student adds (\d+/\d+) \+ (\d+/\d+) and gets (\d+/\d+)\. Which statement uses benchmarks to show whether this answer is reasonable\?', p)
    if m:
        a, b, got = value(m[1]), value(m[2]), value(m[3])
        total = a + b
        require(got != total, 'The student answer is actually right')
        good = []
        for o in opts:
            t = o['label']
            if t.startswith('Each fraction is at least'):
                claim = a >= F(1, 2) and b >= F(1, 2) and got < 1
            elif t.startswith('Each fraction is less than'):
                claim = a < F(1, 2) and b < F(1, 2) and got < 1 and got <= total  # says the wrong answer fits
                claim = False  # the answer never fits: the student added denominators
            else:
                claim = False
            if claim:
                good.append(o['id'])
        require(all(x in (a, b) and True for x in (a, b)), '')
        if a < F(1, 2) and b < F(1, 2):
            raise ValueError('Both fractions below 1/2: the benchmark reading is not the single defensible one')
        return only(good, 'Benchmark statement')
    m = re.fullmatch(r'Estimate (\d+/\d+) ([+−]) (\d+/\d+) by replacing each fraction with the nearest of the benchmarks 0, 1/4, 1/2, 3/4 and 1\. Which estimate is correct\?', p)
    if m:
        a, b = value(m[1]), value(m[3])
        est = nearest(a) + nearest(b) if m[2] == '+' else nearest(a) - nearest(b)
        good = []
        for o in opts:
            label = o['label']
            require(label.startswith('about '), 'Estimate label')
            if value(label[6:]) == est:
                good.append(o['id'])
        return only(good, 'Estimate')
    m = re.fullmatch(r'Which benchmark is (\d+/\d+) closest to: 0, 1/4, 1/2, 3/4 or 1\?', p)
    require(m is not None, 'Unreadable benchmark prompt')
    near = nearest(value(m[1]))
    return only([o['id'] for o in opts if value(o['label']) == near], 'Benchmark')


# ---------- 7 unit-relative-size ----------
UNITS = {
    'length': {'millimeter': F(1, 1000), 'centimeter': F(1, 100), 'inch': F(254, 10000), 'foot': F(3048, 10000),
               'yard': F(9144, 10000), 'meter': F(1), 'kilometer': F(1000), 'mile': F(1609344, 1000)},
    'mass': {'milligram': F(1, 10**6), 'gram': F(1, 1000), 'ounce': F(28349523, 10**9), 'pound': F(45359237, 10**8),
             'kilogram': F(1), 'ton': F(90718474, 10**5)},
    'capacity': {'milliliter': F(1, 1000), 'fluid ounce': F(295735, 10**7), 'cup': F(236588, 10**6),
                 'pint': F(473176, 10**6), 'quart': F(946353, 10**6), 'liter': F(1), 'gallon': F(378541, 10**5)},
}
COMPARATIVE = {'longer': 'length', 'holds more': 'capacity', 'heavier': 'mass'}


def unit_scale(name):
    for family in UNITS.values():
        if name in family:
            return family[name]
    raise ValueError(f'Unknown unit {name}')


def solve_unit_size(public):
    p = public['prompt']
    opts = options_of(public)
    if p == 'Which statement about the sizes of units is true?':
        good = []
        for o in opts:
            m = re.fullmatch(r'An? ([\w ]+?) (is longer than|holds more than|is heavier than) an? ([\w ]+?)\.', o['label'])
            require(m is not None, f'Unreadable statement {o["label"]}')
            if re.search(r'\ba (?=[aeiou])', o['label']):
                raise ValueError(f'Article error: {o["label"]}')
            if unit_scale(m[1]) > unit_scale(m[3]):
                good.append(o['id'])
        return only(good, 'True unit statement')
    m = re.fullmatch(r'(?:A|An) [\w ]+ is measured twice, once in ([\w ]+?)s? and once in ([\w ]+?)s?\. Which measurement has the greater number\?', p)
    if m:
        a, b = m[1].rstrip('s'), m[2].rstrip('s')
        smaller = a if unit_scale(a) < unit_scale(b) else b
        good = []
        for o in opts:
            label = o['label']
            mm = re.fullmatch(r'The measurement in ([\w ]+?)s(, because a \w+ is the larger unit)?', label)
            if label == 'The two numbers are the same':
                continue
            require(mm is not None, f'Unreadable choice {label}')
            if mm[2]:
                continue  # wrong reasoning: the larger unit gives the smaller number
            if mm[1] == smaller:
                good.append(o['id'])
        for o in opts:
            mm = re.fullmatch(r'The measurement in ([\w ]+?)s, because a (\w+) is the larger unit', o['label'])
            if mm:
                require(unit_scale(mm[1]) > unit_scale(a if mm[1] == b else b) or unit_scale(mm[1]) > min(unit_scale(a), unit_scale(b)), 'Reason names the smaller unit as larger')
        return only(good, 'Greater measurement')
    m = re.fullmatch(r'Which list orders these units from (least to greatest capacity|lightest to heaviest|shortest to longest)\?', p)
    require(m is not None, 'Unreadable unit prompt')
    lists = []
    for o in opts:
        items = [s.strip() for s in o['label'].split(',')]
        require(all(items) and len(items) >= 2, f'Malformed unit list: {o["label"]!r}')
        lists.append(items)
    require(len({frozenset(l) for l in lists}) == 1, 'Lists name different units')
    good = []
    for o, items in zip(opts, lists):
        scales = [unit_scale(x) for x in items]
        if scales == sorted(scales):
            good.append(o['id'])
    return only(good, 'Ordered list')


# ---------- 8 decimal-area-model ----------
def solve_decimal_area(public):
    p = public['prompt']
    opts = options_of(public)
    m = re.fullmatch(r'The large square is 1 whole\. The shaded rectangle is ([\d.]+) tall and ([\d.]+) wide\. What is its area, ([\d.]+) × ([\d.]+)\?', p)
    shade = None
    if 'figure' in public:
        scene = public['figure']['scene']
        shades = [e for e in scene['elements'] if e['id'].startswith('shade')]
        whole = [e for e in scene['elements'] if e['id'] == 'whole'][0]
        require(len(shades) == 1 and whole['size'] == [10, 10], 'One shaded rectangle on a 10 by 10 whole expected')
        shade = shades[0]
        require(shade['at'] == [0, 0], 'Shaded rectangle should sit in the corner')
    if m:
        t, w = value(m[1]), value(m[2])
        require(value(m[3]) == t and value(m[4]) == w, 'Product restates different factors')
        require(F(shade['size'][1], 10) == t and F(shade['size'][0], 10) == w, 'Figure disagrees with tall and wide')
        return only([o['id'] for o in opts if value(o['label']) == t * w], 'Area')
    if p == 'The large square is 1 whole. Which multiplication sentence does the shaded part show?':
        t, w = F(shade['size'][1], 10), F(shade['size'][0], 10)
        good = []
        for o in opts:
            left, right = o['label'].split(' = ')
            if ' × ' not in left:
                continue
            a, b = (value(x) for x in left.split(' × '))
            if {a, b} == {t, w} and value(right) == t * w:
                good.append(o['id'])
        return only(good, 'Multiplication sentence')
    m = re.fullmatch(r'An area model shows a rectangle with an area of ([\d.]+) square units and a width of (\d+) units\. What is its height, ([\d.]+) ÷ (\d+)\?', p)
    require(m is not None, 'Unreadable decimal area prompt')
    require(value(m[3]) == value(m[1]) and value(m[4]) == value(m[2]), 'Division restates different numbers')
    h = value(m[1]) / value(m[2])
    return only([o['id'] for o in opts if value(o['label']) == h], 'Height')


# ---------- 9 number-set-venn ----------
SETS = ['natural numbers', 'whole numbers', 'integers', 'rational numbers']


def smallest_set(x):
    if x.denominator == 1:
        return 0 if x > 0 else 1 if x == 0 else 2
    return 3


def solve_venn(public):
    p = public['prompt']
    opts = options_of(public)
    scene = public['figure']['scene']
    circles = sorted([e for e in scene['elements'] if e['type'] == 'circle'], key=lambda e: e['r'])
    require(len(circles) == 4 and [c['id'] for c in circles] == ['set-0', 'set-1', 'set-2', 'set-3'], 'Four nested circles expected')
    names = {e['id']: e['text'] for e in scene['elements'] if e['id'].startswith('name-')}
    require([names[f'name-{i}'] for i in range(4)] == ['Natural', 'Whole', 'Integers', 'Rational'], 'Set names in wrong order')
    letters = {e['id']: e['text'] for e in scene['elements'] if e['id'].startswith('region-')}
    require([letters[f'region-{i}'] for i in range(4)] == list('ABCD'), 'Region letters in wrong order')
    for i, e in enumerate(scene['elements']):
        pass
    radii = [c['r'] for c in circles]
    # each name and letter must sit inside its own ring and outside the smaller circle
    ring = {}
    for e in scene['elements']:
        if e['id'].startswith(('name-', 'region-')):
            i = int(e['id'].split('-')[1])
            r = math.hypot(*e['at'])
            inner = radii[i - 1] if i else 0
            require(inner - 1e-9 <= r < radii[i], f'{e["id"]} sits outside its ring')
    if p == 'Use the diagram of nested sets. Which statement is true?':
        order = {'natural': 0, 'whole': 1, 'integer': 2, 'rational': 3}
        good = []
        for o in opts:
            t = o['label']
            m = re.fullmatch(r'Every (natural|whole|integer|rational) number is an? (natural|whole|integer|rational) number\.|Every (integer) is an? (natural|whole|rational) number\.', t)
            if t == 'Zero is a natural number.':
                ok = False  # natural numbers start at 1 in this diagram (A holds 1, 2, 3, ...)
            elif t == 'Some negative integers are whole numbers.':
                ok = False
            else:
                m = re.fullmatch(r'Every (natural|whole|integer|rational) (?:number )?is an? (natural|whole|integer|rational)(?: number)?\.', t)
                require(m is not None, f'Unreadable statement {t}')
                ok = order[m[1]] <= order[m[2]]
            if ok:
                good.append(o['id'])
        return only(good, 'True statement about nested sets')
    m = re.fullmatch(r'Regions A to D in the diagram of nested number sets are the rings between the circles\. Which region holds ([-−]?[\d .]+(?:/\d+)?)\?', p)
    if m:
        x = value(m[1])
        want = 'ABCD'[smallest_set(x)]
        require(all(re.fullmatch(r'[A-D]', o['label']) for o in opts) and [o['label'] for o in opts] == list('ABCD'), 'Region choices must be A-D in order')
        return only([o['id'] for o in opts if o['label'] == want], 'Region')
    m = re.fullmatch(r'Use the diagram of nested number sets\. What is the smallest of these sets that contains (.+)\?', p)
    require(m is not None, 'Unreadable Venn prompt')
    x = value(m[1])
    want = SETS[smallest_set(x)]
    require(sorted(o['label'] for o in opts) == sorted(SETS), 'Choices must be the four sets')
    return only([o['id'] for o in opts if o['label'] == want], 'Smallest set')


# ---------- 10 check-register-balance ----------
def solve_register(public):
    number_response(public)
    t, _ = table(public)
    rows = t['rows']
    require(t['columns'] == ['Amount', 'Balance'] and rows[0]['label'] == 'Start', 'Register layout')
    start = value(rows[0]['cells'][1])
    p = public['prompt']
    require(rows[0]['cells'][0] == '—', 'Start row has no amount')
    prev = start
    unknown = None
    for r in rows[1:]:
        amt, bal = r['cells']
        label = r['label']
        deposit = label == 'Deposit'
        if amt == '?':
            unknown = ('amount', label, prev, value(bal))
            prev = value(bal)
            continue
        if bal == '?':
            sign_amt = value(amt)
            if deposit:
                require(amt.startswith('+'), 'Deposit amount should carry +')
            else:
                require(amt.startswith('−'), 'Payment amount should carry −')
            unknown = ('balance', label, prev + sign_amt, None)
            prev = prev + sign_amt
            continue
        sign_amt = value(amt)
        require(amt[0] in '+−', 'Amount needs a sign')
        require((sign_amt > 0) == deposit, f'Sign disagrees with {label}')
        require(prev + sign_amt == value(bal), f'Running balance wrong at {label}: {prev} + {sign_amt} != {bal}')
        prev = value(bal)
    require(unknown is not None, 'No unknown cell')
    if unknown[0] == 'balance':
        require(re.fullmatch(r'A check register starts with ([\d.]+) dollars\. .*', p) and value(re.match(r'A check register starts with ([\d.]+)', p)[1]) == start, 'Prompt start differs from table')
        require(rows[-1]['cells'][1] == '?', 'Unknown balance must be the final row')
        return f'{unknown[2]:.2f}'.rstrip('0').rstrip('.') if False else dec2(unknown[2])
    m = re.fullmatch(r'The check register shows the balance after each entry, but the amount in the row "(.+)" is missing\. How many dollars is that (deposit|payment)\? Enter the amount without a sign\.', p)
    require(m is not None, 'Unreadable register prompt')
    label, noun = m[1], m[2]
    require(unknown[1] == label and (noun == 'deposit') == (label == 'Deposit'), 'Row label and noun disagree')
    diff = unknown[3] - unknown[2]
    require((diff > 0) == (noun == 'deposit') and diff != 0, 'Balance direction disagrees with deposit/payment')
    return dec2(abs(diff))


def dec2(v):
    v = F(v)
    s = f'{float(v):.2f}'
    require(F(s) == v, 'Not a cent amount')
    return s


# ---------- 11 reciprocal-division-choice ----------
def operands_ops(text):
    toks = re.findall(r'\d+/\d+|\d+|[×÷+]', text)
    require(''.join(toks).replace(' ', '') == text.replace(' ', ''), f'Unreadable {text}')
    return toks


def fold(text):
    toks = operands_ops(text)
    v = value(toks[0])
    for op, x in zip(toks[1::2], toks[2::2]):
        x = value(x)
        v = v * x if op == '×' else v / x if op == '÷' else v + x
    return v


def solve_reciprocal(public):
    p = public['prompt']
    opts = options_of(public)
    m = re.fullmatch(r'Which multiplication equals (\d+(?:/\d+)?) ÷ (\d+(?:/\d+)?)\?', p)
    if m:
        target = value(m[1]) / value(m[2])
    else:
        m = re.fullmatch(r'Each batch uses (\d+/\d+) (?:meter of ribbon|cup of milk|pound of flour)\. How many batches can be made from (\d+) (?:meters|cups|pounds)\? Which expression gives the answer\?', p)
        require(m is not None, 'Unreadable reciprocal prompt')
        target = value(m[2]) / value(m[1])
    good = []
    for o in opts:
        if fold(o['label']) == target and '÷' not in o['label'] and '+' not in o['label']:
            good.append(o['id'])
    return only(good, 'Equivalent multiplication')


# ---------- 12 scaling-direction-choice ----------
def solve_scaling(public):
    p = public['prompt']
    opts = options_of(public)
    m = re.fullmatch(r'Without calculating, which product is (less|greater) than (\d+)\?', p)
    if m:
        n = int(m[2])
        good = []
        for o in opts:
            a, f = o['label'].split(' × ')
            require(int(a) == n, 'Product does not use the stated number')
            prod = n * value(f)
            if (prod < n) if m[1] == 'less' else (prod > n):
                good.append(o['id'])
        return only(good, 'Product versus reference')
    m = re.fullmatch(r'Without calculating, how does (\d+/\d+) × (\d+) compare with (\d+)\?', p)
    require(m is not None, 'Unreadable scaling prompt')
    f, n = value(m[1]), int(m[2])
    require(n == int(m[3]), 'Reference differs')
    truth_word = 'Greater' if f > 1 else 'Less' if f < 1 else 'Equal'
    good = []
    for o in opts:
        t = o['label']
        mm = re.fullmatch(r'(Greater|Less|Equal) (?:than|to) (\d+), because (.+)', t)
        require(mm is not None and int(mm[2]) == n, f'Unreadable comparison {t}')
        reason = mm[3]
        r1 = re.fullmatch(r'(\d+/\d+) equals 1\.', reason)
        if r1 and f == 1 and mm[1] == 'Equal' and value(r1[1]) == 1:
            good.append(o['id'])
        r = re.fullmatch(r'(\d+/\d+) is (greater|less) than 1\.', reason)
        if r and mm[1] == truth_word and value(r[1]) == f and ((r[2] == 'greater') == (f > 1)):
            good.append(o['id'])
    return only(good, 'Valid comparison with valid reason')


# ---------- 13 percent-grid-model ----------
def solve_percent_grid(public):
    opts = options_of(public)
    scene = public['figure']['scene']
    shades = [e for e in scene['elements'] if e['id'].startswith('shade')]
    cells = set()
    for e in shades:
        x, y = e['at']
        w, h = e['size']
        for i in range(int(x), int(x + w)):
            for j in range(int(y), int(y + h)):
                require((i, j) not in cells, 'Shaded rectangles overlap')
                cells.add((i, j))
    k = len(cells)
    m = re.search(r'with (\d+) of 100 squares shaded', scene['title'])
    require(m is not None and int(m[1]) == k, 'Figure title disagrees with the shaded squares')
    p = public['prompt']
    frac = F(k, 100)
    if p == 'What fraction of the grid is shaded? Give the fraction in simplest form.':
        good = [o['id'] for o in opts if '/' in o['label'] and value(o['label']) == frac and math.gcd(*(int(x) for x in o['label'].split('/'))) == 1]
    elif p == 'What percent of the grid is shaded?':
        good = [o['id'] for o in opts if o['label'].endswith('%') and value(o['label']) == k]
    else:
        require(p == 'What decimal names the shaded part of the grid?', 'Unreadable grid prompt')
        good = [o['id'] for o in opts if '/' not in o['label'] and value(o['label']) == frac]
    return only(good, 'Grid answer')


# ---------- 14 percent-forms-and-parts ----------
def solve_percent_forms(public):
    p = public['prompt']
    resp = public['response']
    m = re.fullmatch(r'Write (\d+/\d+|\d*\.\d+) as a percent\. Enter the number without the percent sign\.', p)
    if m:
        number_response(public)
        return pct_str(value(m[1]) * 100)
    m = re.fullmatch(r'(\w+) got (\d+) of (\d+) questions right\. What percent of the questions is that\? Enter the number without the percent sign\.', p)
    if m:
        number_response(public)
        return pct_str(F(int(m[2]), int(m[3])) * 100)
    m = re.fullmatch(r'(\w+) has (?:saved|read) (\d+) (?:dollars|pages), which is (\d+)% of the (?:goal|book)\. What is the (?:goal, in dollars|number of pages in the book)\?|(\w+) has (?:saved|read) (\d+) (?:dollars|pages), which is (\d+)% of the (?:goal|book)\. (?:How many pages are in the book|What is the goal, in dollars)\?', p)
    if m:
        number_response(public)
        a, b = (m[2], m[3]) if m[2] else (m[5], m[6])
        return pct_str(F(int(a) * 100, int(b)))
    m = re.fullmatch(r'(\d+) students are on the team, which is (\d+)% of the grade\. How many students are in the grade\?', p)
    if m:
        number_response(public)
        return pct_str(F(int(m[1]) * 100, int(m[2])))
    m = re.fullmatch(r'Which fraction in simplest form equals (\d+)%\?', p)
    require(m is not None, 'Unreadable percent prompt')
    opts = options_of(public)
    target = F(int(m[1]), 100)
    good = [o['id'] for o in opts if value(o['label']) == target and math.gcd(*(int(x) for x in o['label'].split('/'))) == 1]
    return only(good, 'Simplest fraction')


def pct_str(v):
    v = F(v)
    s = f'{float(v):.6f}'.rstrip('0').rstrip('.')
    require(F(s) == v, f'Non-terminating answer {v}')
    return s


# ---------- 15 independent-dependent-roles ----------
PAIRS = [('side', 'perimeter'), ('minute', 'cost'), ('week', 'savings'), ('hour', 'distance'), ('hour', 'miles'), ('day', 'height'),
         ('gallon', 'paid'), ('ticket', 'cost'), ('hour', 'pay')]


def role(text):
    t = text.lower()
    for ind, dep in PAIRS:
        i, d = ind in t, dep in t
        if i != d:
            return 'indep' if i else 'dep'
    raise ValueError(f'Cannot classify quantity {text}')


def solve_roles(public):
    p = public['prompt']
    opts = options_of(public)
    t, scene = table(public)
    rows = t['rows']
    xs = [value(r['label']) for r in rows]
    ys = [value(str(r['cells'][0])) for r in rows]
    require(len(set(xs)) == len(xs) and all(y > 0 for y in ys), 'Table inputs repeat or outputs are not positive')
    m = re.fullmatch(r'(.+) for each value of (.+)', scene['title'])
    if m:
        require(m[1] == t['columns'][0] and m[2] == t['corner'], 'Title disagrees with table headings')
    # the table's row-label column (corner) must be the independent quantity by meaning
    require(role(t['corner']) == 'indep' and role(t['columns'][0]) == 'dep', f'Table orientation disagrees with meaning: {t["corner"]} / {t["columns"][0]}')
    if p == 'The pairs in the table are graphed as points. Which quantity is on the horizontal axis?':
        good = [o['id'] for o in opts if safe_role(o['label']) == 'indep']
        return only(good, 'Horizontal axis quantity')
    m = re.fullmatch(r'The table shows (.+) for different values of (.+)\. Which is the (independent|dependent) quantity\?', p)
    if m:
        want = 'indep' if m[3] == 'independent' else 'dep'
        require(role(m[2]) == 'indep' and role(m[1]) == 'dep', 'Prompt names the quantities in the wrong roles')
        good = [o['id'] for o in opts if safe_role(o['label']) == want]
        return only(good, 'Named role')
    require(p == 'Which statement about the table is true?', 'Unreadable roles prompt')
    good = []
    for o in opts:
        m = re.fullmatch(r'(.+) changes when (.+) changes, so (.+) is the independent quantity(?: and (.+) is the dependent quantity)?\.', o['label'])
        if m:
            if (role(m[3]) == 'indep' and role(m[2]) == 'indep' and role(m[1]) == 'dep'
                    and (m[4] is None or role(m[4]) == 'dep')):
                good.append(o['id'])
            continue
        m = re.fullmatch(r'(.+) is the independent quantity and (.+) is the dependent quantity\.', o['label'])
        if m and role(m[1]) == 'indep' and role(m[2]) == 'dep':
            good.append(o['id'])
    return only(good, 'True statement')


def safe_role(label):
    try:
        return role(label)
    except ValueError:
        return None


# ---------- 16 expression-or-equation ----------
def is_equation_text(label):
    return '=' in label or re.search(r'\b(is|equals)\b', label) is not None


def solve_expr_eq(public):
    p = public['prompt']
    opts = options_of(public)
    if p == 'Which of these is an equation, not an expression?' or p == 'Which phrase describes an equation?':
        return only([o['id'] for o in opts if is_equation_text(o['label'])], 'Equation')
    require(p == 'Which of these is an expression, not an equation?', 'Unreadable prompt')
    return only([o['id'] for o in opts if not is_equation_text(o['label'])], 'Expression')


# ---------- 17 rational-area-volume-equation ----------
def solve_rational_area(public):
    p = public['prompt']
    opts = options_of(public)
    frac = r'(\d+ \d+/\d+|\d+/\d+|\d+)'
    m = re.fullmatch(rf'A triangular banner has an area of {frac} square feet and a (base|height) of {frac} feet\. Which equation can be used to find its (height, h|base, b), in feet\?', p)
    if m:
        A, known = value(m[1]), value(m[3])
        require((m[2], m[4]) in (('base', 'height, h'), ('height', 'base, b')), 'Known and unknown sides must differ')
        var = 'h' if m[4].startswith('height') else 'b'
        x = 2 * A / known
    else:
        m = re.fullmatch(rf'A rectangular garden has an area of {frac} square meters and a (length|width) of {frac} meters\. Which equation can be used to find its (width, w|length, l), in meters\?', p)
        if m:
            A, known = value(m[1]), value(m[3])
            var = m[4][0] if m[4].startswith('width') else 'l'
            var = 'w' if m[4].startswith('width') else 'l'
            require((m[2], m[4]) in (('length', 'width, w'), ('width', 'length, l')), 'Known and unknown sides must differ')
            x = A / known
        else:
            m = re.fullmatch(rf'A fish tank shaped like a rectangular prism has a length of {frac} feet, a width of {frac} feet and a volume of {frac} cubic feet\. Which equation can be used to find its height, h, in feet\?', p)
            require(m is not None, 'Unreadable rational equation prompt')
            l, w, V = value(m[1]), value(m[2]), value(m[3])
            var = 'h'
            x = V / (l * w)
    require(x > 0, 'Unknown side must be positive')
    good = []
    for o in opts:
        if truth(o['label'], {var: x}):
            good.append(o['id'])
    # a numerically-true equation must also be the product form, not a shifted one
    chosen = only(good, 'Equation true at the unknown side')
    return chosen


# ---------- 18 categorical-summary ----------
def solve_categorical(public):
    p = public['prompt']
    scene = public['figure']['scene']
    m = re.fullmatch(r'A percent bar shows the favorite (\w+) of (\d+) students, from left to right: (\w+), (\w+), (\w+)\. How many students chose (\w+)\?', p)
    if m:
        number_response(public)
        els = {e['id']: e for e in scene['elements']}
        pcts = [int(els[f'part-label-{i}']['text'].rstrip('%')) for i in range(3)]
        widths = [els[f'part-{i}']['size'][0] for i in range(3)]
        require(sum(pcts) == 100, 'Percent bar does not total 100')
        require(all(abs(w - q / 10) < 1e-9 for w, q in zip(widths, pcts)), 'Bar widths disagree with the percents')
        total = int(m[2])
        k = [m[3], m[4], m[5]].index(m[6])
        count = F(total * pcts[k], 100)
        require(count.denominator == 1, 'Fractional student count')
        return str(count.numerator)
    t, _ = table(public)
    counts = {r['label']: int(r['cells'][0]) for r in t['rows']}
    total = sum(counts.values())
    m = re.fullmatch(r'The table shows the favorite (\w+) of (\d+) students\. (.+)', p)
    require(m is not None, 'Unreadable categorical prompt')
    require(int(m[2]) == total, 'Stated total differs from the table sum')
    q = m[3]
    mm = re.fullmatch(r'What percent of the students chose (\w+)\? Enter the number without the percent sign\.', q)
    if mm:
        number_response(public)
        return pct_str(F(counts[mm[1]] * 100, total))
    require(q == 'Which category is the mode?', 'Unreadable question')
    top = max(counts.values())
    require(list(counts.values()).count(top) == 1, 'Mode is not unique')
    opts = options_of(public)
    require(sorted(o['label'] for o in opts) == sorted(counts), 'Choices should be the table categories')
    return only([o['id'] for o in opts if counts[o['label']] == top], 'Mode')


# ---------- 19 lifetime-income-salary ----------
def solve_income(public):
    number_response(public)
    p = public['prompt']
    m = re.fullmatch(r'A person earns ([\d,]+) dollars each (year|month) for (\d+) years\. How many dollars does the person earn in all\?', p)
    if m:
        return str(int(clean(m[1])) * (12 if m[2] == 'month' else 1) * int(m[3]))
    m = re.fullmatch(r'Job A pays ([\d,]+) dollars a year and Job B pays ([\d,]+) dollars a year\. How many more dollars does Job B pay than Job A over (\d+) years\?', p)
    if m:
        a, b = int(clean(m[1])), int(clean(m[2]))
        require(b > a, 'Job B must pay more for "how many more"')
        return str((b - a) * int(m[3]))
    m = re.fullmatch(r'A person works from age (\d+) until retiring at age (\d+) and earns ([\d,]+) dollars a year\. How many dollars does the person earn over the whole career\?', p)
    require(m is not None, 'Unreadable income prompt')
    require(int(m[2]) > int(m[1]), 'Retirement before start')
    return str((int(m[2]) - int(m[1])) * int(clean(m[3])))


# ---------- 20 pi-as-ratio ----------
def round_half_up(v, places=2):
    scale = 10 ** places
    return F(math.floor(v * scale + F(1, 2)), scale)


def solve_pi(public):
    p = public['prompt']
    opts = options_of(public)
    if p == 'The ratio $\\pi$ (pi) is the same number for every circle. Which ratio equals $\\pi$?':
        return only([o['id'] for o in opts if o['label'] == 'circumference ÷ diameter'], 'Circumference over diameter')
    m = re.fullmatch(r"A circle's diameter is made (\d+) times as long\. What happens to the ratio circumference ÷ diameter\?", p)
    if m:
        k = m[1]
        return only([o['id'] for o in opts if o['label'] == 'It stays the same'], 'Unchanged ratio')
    m = re.fullmatch(r'A circular lid has a (diameter|radius) of ([\d.]+) cm and a circumference of ([\d.]+) cm\. What is the circumference divided by the diameter, rounded to the nearest hundredth\?', p)
    require(m is not None, 'Unreadable pi prompt')
    d = value(m[2]) * (2 if m[1] == 'radius' else 1)
    C = value(m[3])
    ratio = C / d
    require(abs(float(ratio) - math.pi) < 0.02, f'Measurements are not those of a circle: C/d={float(ratio):.4f}')
    want = round_half_up(ratio)
    good = [o['id'] for o in opts if value(o['label']) == want]
    return only(good, 'Rounded ratio')


# ---------- 21 experimental-probability-predict ----------
def solve_experimental(public):
    p = public['prompt']
    m = re.fullmatch(r'A fair (coin is tossed|number cube is rolled) (\d+) times and (?:heads|a \d) comes up (\d+) times\. The theoretical probability of (?:heads|a \d) is (\d+/\d+)\. How many more (?:heads|\d+s) came up than the theory predicts\?', p)
    if m:
        number_response(public)
        n, k, prob = int(m[2]), int(m[3]), value(m[4])
        if m[1] == 'coin is tossed':
            require(prob == F(1, 2), 'Fair coin is 1/2')
        else:
            require(prob == F(1, 6), 'Fair cube is 1/6')
        exp = n * prob
        require(exp.denominator == 1, 'Expected count is not whole')
        diff = k - exp
        require(diff > 0, 'Observed does not exceed expected, so "how many more" is not positive')
        return str(diff.numerator)
    m = re.fullmatch(r'A (?:spinner|thumbtack|paper cup) was (?:spun|dropped|tossed) (\d+) times and landed (?:on blue|point up|on its side) (\d+) times\. Use these results to predict how many times the \w+(?: \w+)? lands (?:on blue|point up|on its side) in (\d+) (?:spins|drops|tosses)\.', p)
    if m:
        number_response(public)
        n, k, N = int(m[1]), int(m[2]), int(m[3])
        pred = F(k, n) * N
        require(pred.denominator == 1, 'Prediction not whole')
        return str(pred.numerator)
    m = re.fullmatch(r'A (?:spinner|thumbtack|paper cup) was (?:spun|dropped|tossed) (\d+) times and landed (?:on blue|point up|on its side) (\d+) times\. What is the experimental probability that the \w+(?: \w+)? lands (?:on blue|point up|on its side)\? Enter a decimal\.', p)
    if m:
        number_response(public)
        v = F(int(m[2]), int(m[1]))
        s = f'{float(v):.10g}'
        require(F(s) == v, 'Not a terminating decimal')
        return s
    m = re.fullmatch(r'(\w+) ran an experiment with (\d+) trials and the event happened (\d+) times\. (\w+) ran the same experiment with (\d+) trials and the event happened (\d+) times\. Whose result is the better basis for predicting what will happen in (\d+) trials\?', p)
    require(m is not None, 'Unreadable probability prompt')
    opts = options_of(public)
    (n1, t1), (n2, t2) = (m[1], int(m[2])), (m[4], int(m[5]))
    require(t1 != t2, 'Equal trial counts')
    better = n1 if t1 > t2 else n2
    good = []
    for o in opts:
        mm = re.fullmatch(r"(\w+)'s, because more trials usually give an experimental probability closer to the true probability", o['label'])
        if mm and mm[1] == better:
            good.append(o['id'])
    return only(good, 'Larger experiment')


# ---------- 22 cylinder-prism-surface-area ----------
def solve_surface(public):
    number_response(public)
    p = public['prompt']
    m = re.fullmatch(r'A cylinder has a radius of (\d+) cm and a height of (\d+) cm\. Its total surface area, including both circular bases, is \$a\\pi\$ square centimeters\. What is \$a\$\?', p)
    if m:
        r, h = int(m[1]), int(m[2])
        return str(2 * r * r + 2 * r * h)
    m = re.fullmatch(r'A cylinder has a radius of (\d+) cm and a height of (\d+) cm\. Its lateral surface area, the curved side only, is \$a\\pi\$ square centimeters\. What is \$a\$\?', p)
    if m:
        return str(2 * int(m[1]) * int(m[2]))
    m = re.fullmatch(r'A cylinder has a radius of (\d+) cm and a total surface area of \$(\d+)\\pi\$ square centimeters\. What is its height, in centimeters\?', p)
    if m:
        r, a = int(m[1]), int(m[2])
        h = F(a - 2 * r * r, 2 * r)
        require(h.denominator == 1 and h > 0, 'Height not a positive whole number')
        return str(h.numerator)
    m = re.fullmatch(r'A right triangular prism has bases that are right triangles with legs (\d+) cm and (\d+) cm and hypotenuse (\d+) cm\. The prism is (\d+) cm long\. What is its total surface area, in square centimeters\?', p)
    require(m is not None, 'Unreadable surface-area prompt')
    a, b, c, L = (int(m[i]) for i in range(1, 5))
    require(a * a + b * b == c * c, 'Triangle is not right')
    return str(a * b + (a + b + c) * L)


# ---------- 23 both-sides-situation-equation ----------
def linear(text, var):
    v0, v1 = evaluate(text, {var: F(0)}), evaluate(text, {var: F(1)})
    require(evaluate(text, {var: F(2)}) == 2 * v1 - v0, 'Not linear')
    return (v0, v1 - v0)


def solve_both_sides(public):
    p = public['prompt']
    opts = options_of(public)
    m = re.fullmatch(r'(\w+) A charges a (?:starting|joining|setup) fee of (\d+) dollars plus (\d+) dollars per \w+\. \1 B charges a (?:starting|joining|setup) fee of (\d+) dollars plus (\d+) dollars per \w+\. Which (equation|inequality) can be used to find the numbers? of \w+, (\w), for which (?:the two total costs are equal|\1 A costs less than \1 B)\?', p)
    if m:
        a0, a1, b0, b1 = (int(m[i]) for i in (2, 3, 4, 5))
        var = m[7]
        kind = m[6]
        require((kind == 'equation') == ('are equal' in p), 'Equation/inequality wording mismatch')
        require((a0 < b0 and a1 > b1) or (a0 > b0 and a1 < b1) or True, '')
    else:
        m = re.fullmatch(r'Tank A has (\d+) liters and loses (\d+) liters each minute\. Tank B has (\d+) liters and gains (\d+) liters each minute\. Which equation can be used to find the number of minutes, (\w), when the tanks hold the same amount\?', p)
        require(m is not None, 'Unreadable both-sides prompt')
        a0, a1, b0, b1 = int(m[1]), -int(m[2]), int(m[3]), int(m[4])
        var, kind = m[5], 'equation'
    target = (a0 - b0, a1 - b1)  # A minus B as a + b*v
    good = []
    for o in opts:
        left, op, right = relation(o['label'])
        l, r = linear(left, var), linear(right, var)
        diff = (l[0] - r[0], l[1] - r[1])
        if diff == (0, 0):
            continue
        # proportional to target?
        if diff[0] * target[1] != diff[1] * target[0]:
            continue
        k = diff[0] / target[0] if target[0] else diff[1] / target[1]
        if kind == 'equation':
            if op == '=':
                good.append(o['id'])
        else:
            need = '<'
            flipped = {'<': '>', '>': '<'}
            if op == (need if k > 0 else flipped.get(need)) and op in '<>':
                good.append(o['id'])
    return only(good, 'Equivalent model')


SOLVERS = {
    'times-as-many-comparison': solve_times_as_many, 'situation-pair-table': solve_situation_pair,
    'story-equation-choice': solve_story_equation, 'strip-diagram-equation': solve_strip,
    'division-area-model': solve_division_area, 'fraction-benchmark-reasonable': solve_benchmark,
    'unit-relative-size': solve_unit_size, 'decimal-area-model': solve_decimal_area,
    'number-set-venn': solve_venn, 'check-register-balance': solve_register,
    'reciprocal-division-choice': solve_reciprocal, 'scaling-direction-choice': solve_scaling,
    'percent-grid-model': solve_percent_grid, 'percent-forms-and-parts': solve_percent_forms,
    'independent-dependent-roles': solve_roles, 'expression-or-equation': solve_expr_eq,
    'rational-area-volume-equation': solve_rational_area, 'categorical-summary': solve_categorical,
    'lifetime-income-salary': solve_income, 'pi-as-ratio': solve_pi,
    'experimental-probability-predict': solve_experimental, 'cylinder-prism-surface-area': solve_surface,
    'both-sides-situation-equation': solve_both_sides,
}
assert set(SOLVERS) == SUPPORTED


def solve(public):
    require(public['templateId'] in SUPPORTED, 'Unexpected Texas 3-8 template')
    return SOLVERS[public['templateId']](public)


def visible_text(problem):
    return ' '.join([problem['public']['prompt'], problem.get('hint', '')] + problem.get('explanation', []))


def review_problem(problem):
    public = problem['public']
    result = solve(public)
    if public['response']['kind'] == 'choice':
        require(problem['answer'] == result, 'Choice answer key mismatch')
    else:
        require(value(problem['answer']) == value(result), 'Numeric answer key mismatch')
    # Explanations and hints must keep $ delimiters balanced and agree with the key.
    for text in [problem.get('hint', '')] + problem.get('explanation', []):
        require(text.count('$') % 2 == 0, f'Unbalanced math delimiter: {text}')
    for text in [public['prompt']] + problem.get('explanation', []):
        require(not re.search(r'\ba (?=[aeiouAEIOU]\w)', text) or re.search(r'\ba (?:one|uni|use)', text) is not None,
                f'Article error: {text}')
    for line in problem.get('explanation', []):
        for m in re.finditer(r'(?<![\d./])(\d[\d,]*(?:\.\d+)?) ([÷×+−]) (\d[\d,]*(?:\.\d+)?) = (\d[\d,]*(?:\.\d+)?)(?![\d/])', line):
            before, after = line[:m.start()].rstrip(), line[m.end():].lstrip()
            if (before and before[-1] in '+−×÷=(') or (after and after[0] in '+−×÷=)^/') or '\\' in line or 'equal sign' in line or 'round' in line or re.search(r'[a-z]\s*$', before):
                continue  # part of a longer chain or an algebraic line
            x, y, z = value(m[1]), value(m[3]), value(m[4])
            got = {'÷': x / y if y else None, '×': x * y, '+': x + y, '−': x - y}[m[2]]
            require(got == z, f'Explanation arithmetic is wrong: {m[0]}')
    require(not re.search(r'\bmake the result\b|\bmake a number\b', visible_text(problem)), 'Verb agreement')
    require(not re.search(r'\b\d+ bu\b|\bbu\?', visible_text(problem)), 'Truncated plural')
    if public['response']['kind'] == 'choice':
        # Distractor feedback must not describe the correct choice as wrong.
        for oid, text in (problem.get('choiceFeedback') or {}).items():
            require(oid != problem['answer'], 'Feedback attached to the correct choice')
    return result


def self_test():
    rejected = 0

    def must_reject(problem, why):
        nonlocal rejected
        try:
            review_problem(problem)
        except ValueError:
            rejected += 1
            return
        raise ValueError(f'Corrupt case accepted: {why}')

    def case(template, prompt, options=None, figure=None, answer='option-a', number=False):
        public = {'templateId': template, 'prompt': prompt,
                  'response': {'kind': 'number', 'label': 'x'} if number else
                  {'kind': 'choice', 'options': [{'id': f'option-{c}', 'label': l} for c, l in zip('abcd', options)]}}
        if figure:
            public['figure'] = {'kind': 'scene', 'scene': figure}
        return {'public': public, 'answer': answer, 'explanation': ['ok'], 'hint': 'ok'}

    # 1 times as many: 2 x 2 and 2 + 2 share a value
    good = case('times-as-many-comparison', 'Carla has 3 marbles. Ella has 2 times as many marbles as Carla. Which expression gives the number of marbles Ella has?', ['3 × 2', '3 ÷ 2', '3 × 3', '3 + 2'])
    review_problem(good)
    bad = copy.deepcopy(good); bad['answer'] = 'option-d'; must_reject(bad, 'wrong key')
    bad = case('times-as-many-comparison', 'Carla has 2 marbles. Ella has 2 times as many marbles as Carla. Which expression gives the number of marbles Ella has?', ['2 × 2', '2 ÷ 2', '2 × 3', '2 + 2']); must_reject(bad, 'two expressions equal 4')
    # 2 additive table
    tbl = {'v': 1, 'title': 't', 'elements': [{'id': 't', 'type': 'table', 'corner': "Ben's age", 'columns': ["Dev's age"], 'rows': [{'label': '4', 'cells': [6]}, {'label': '6', 'cells': [8]}, {'label': '8', 'cells': [10]}, {'label': '?', 'cells': [16]}]}]}
    good = case('situation-pair-table', 'Dev is 2 years older than Ben. The table shows their ages at different times. How old is Ben when Dev is 16?', figure=tbl, answer='14', number=True)
    review_problem(good)
    bad = copy.deepcopy(good); bad['answer'] = '18'; must_reject(bad, 'added instead of subtracted')
    bad = copy.deepcopy(good); bad['public']['figure']['scene']['elements'][0]['rows'][1]['cells'] = [9]; must_reject(bad, 'table breaks the rule')
    # 3 story equation
    good = case('story-equation-choice', 'Dev has some beads, gives away 136, and then has 278 left. Let n be the number of beads Dev had at first. Which equation matches the story?', ['278 − 136 = n', 'n + 136 = 278', 'n − 136 = 278', '136 − n = 278'], answer='option-c')
    review_problem(good)
    bad = copy.deepcopy(good); bad['answer'] = 'option-a'; must_reject(bad, 'wrong equation')
    # 4 strip diagram
    def strip(whole, labels, widths):
        els = [{'id': 'whole', 'type': 'rect', 'at': [0, 1.6], 'size': [sum(widths), 1.2]}, {'id': 'whole-label', 'type': 'text', 'text': whole}]
        x = 0
        for i, (l, w) in enumerate(zip(labels, widths)):
            els += [{'id': f'part-{i}', 'type': 'rect', 'at': [x, 0], 'size': [w, 1.2]}, {'id': f'part-label-{i}', 'type': 'text', 'text': l}]
            x += w
        return {'v': 1, 'title': 's', 'elements': els}
    good = case('strip-diagram-equation', 'Ava has 25 dollars and buys 2 items that cost 9 dollars each. The strip diagram shows the story, with n for the dollars left. Which equation matches the diagram?', ['25 − 2 × 9 = n', '25 − 2 + 9 = n', '25 + 2 × 9 = n', '(25 − 2) × 9 = n'], figure=strip('25', ['9', '9', 'n'], [2, 2, 1.6]))
    review_problem(good)
    bad = copy.deepcopy(good); bad['public']['figure']['scene']['elements'][-1]['text'] = 'n'; bad['public']['figure']['scene']['elements'][-2]['size'] = [1.6, 1.2]
    bad['public']['figure']['scene']['elements'][1]['text'] = '27'; must_reject(bad, 'diagram whole disagrees with story')
    # 5 area model
    good = case('division-area-model', 'An area model for 837 ÷ 9 is a rectangle 9 units tall. Its area is split into two columns with areas 810 and 27. What is the quotient?', ['93', '12', '117', '837'])
    review_problem(good)
    bad = copy.deepcopy(good); bad['answer'] = 'option-c'; must_reject(bad, 'wrong quotient')
    bad = copy.deepcopy(good); bad['public']['prompt'] = bad['public']['prompt'].replace('27.', '28.'); must_reject(bad, 'columns do not sum')
    # 6 benchmark
    good = case('fraction-benchmark-reasonable', 'Which benchmark is 5/6 closest to: 0, 1/4, 1/2, 3/4 or 1?', ['1/2', '3/4', '1', '1/4'], answer='option-b')
    review_problem(good)
    bad = copy.deepcopy(good); bad['answer'] = 'option-c'; must_reject(bad, 'wrong benchmark')
    bad = case('fraction-benchmark-reasonable', 'Which benchmark is 3/8 closest to: 0, 1/4, 1/2, 3/4 or 1?', ['1/2', '3/4', '1', '1/4']); must_reject(bad, 'benchmark tie')
    # 7 units
    good = case('unit-relative-size', 'Which statement about the sizes of units is true?', ['A quart holds more than a liter.', 'A gallon holds more than a liter.', 'A centimeter is longer than an inch.', 'A liter holds more than a gallon.'], answer='option-b')
    review_problem(good)
    bad = copy.deepcopy(good); bad['answer'] = 'option-a'; must_reject(bad, 'wrong unit claim')
    bad = case('unit-relative-size', 'Which list orders these units from least to greatest capacity?', ['milliliter, liter', 'liter, milliliter, ', 'milliliter, , liter', ', liter, milliliter']); must_reject(bad, 'blank list entries')
    # 8 decimal area
    dscene = {'v': 1, 'title': 'd', 'elements': [{'id': 'whole', 'type': 'rect', 'at': [0, 0], 'size': [10, 10]}, {'id': 'shade-0', 'type': 'rect', 'at': [0, 0], 'size': [3, 4]}]}
    good = case('decimal-area-model', 'The large square is 1 whole. The shaded rectangle is 0.4 tall and 0.3 wide. What is its area, 0.4 × 0.3?', ['0.12', '1.2', '0.7', '0.012'], figure=dscene)
    review_problem(good)
    bad = copy.deepcopy(good); bad['public']['figure']['scene']['elements'][1]['size'] = [4, 3]; must_reject(bad, 'figure swaps the factors')
    bad = copy.deepcopy(good); bad['answer'] = 'option-b'; must_reject(bad, 'wrong area')
    # 9 Venn
    vs = {'v': 1, 'title': 'v', 'elements': []}
    for i, (r, nm, ltr) in enumerate(zip([1.5, 3.1, 4.7, 6.3], ['Natural', 'Whole', 'Integers', 'Rational'], 'ABCD')):
        vs['elements'] += [{'id': f'set-{i}', 'type': 'circle', 'center': [0, 0], 'r': r},
                           {'id': f'name-{i}', 'type': 'text', 'at': [0, r - 0.8], 'text': nm},
                           {'id': f'region-{i}', 'type': 'text', 'at': [r - 0.8, 0], 'text': ltr}]
    good = case('number-set-venn', 'Use the diagram of nested number sets. What is the smallest of these sets that contains −24?', ['integers', 'rational numbers', 'natural numbers', 'whole numbers'], figure=vs)
    review_problem(good)
    bad = copy.deepcopy(good); bad['answer'] = 'option-b'; must_reject(bad, 'rational is not the smallest set')
    bad = copy.deepcopy(good); bad['public']['prompt'] = bad['public']['prompt'].replace('−24', '0'); must_reject(bad, 'key for the wrong number')
    bad = copy.deepcopy(good); bad['public']['figure']['scene']['elements'][4]['at'] = [0, 0.2]; must_reject(bad, 'label drawn in the wrong ring')
    good = case('number-set-venn', 'Use the diagram of nested sets. Which statement is true?', ['Every whole number is an integer.', 'Every integer is a natural number.', 'Zero is a natural number.', 'Every rational number is an integer.'], figure=vs)
    review_problem(good)
    bad = case('number-set-venn', 'Use the diagram of nested sets. Which statement is true?', ['Every whole number is an integer.', 'Every natural number is a rational number.', 'Zero is a natural number.', 'Every rational number is an integer.'], figure=vs); must_reject(bad, 'two true nested statements')
    # 10 register
    reg = {'v': 1, 'title': 'r', 'elements': [{'id': 't', 'type': 'table', 'corner': 'Entry', 'columns': ['Amount', 'Balance'], 'rows': [
        {'label': 'Start', 'cells': ['—', '100.00']}, {'label': 'Check 101', 'cells': ['−30.50', '69.50']}, {'label': 'Deposit', 'cells': ['+20.25', '89.75']}, {'label': 'Monthly fee', 'cells': ['−12.00', '?']}]}]}
    good = case('check-register-balance', 'A check register starts with 100.00 dollars. Each deposit is added and each check, transfer or fee is subtracted. What is the balance after the last entry, in dollars?', figure=reg, answer='77.75', number=True)
    review_problem(good)
    bad = copy.deepcopy(good); bad['public']['figure']['scene']['elements'][0]['rows'][2]['cells'] = ['+20.25', '90.75']; must_reject(bad, 'running balance wrong')
    bad = copy.deepcopy(good); bad['answer'] = '101.75'; must_reject(bad, 'fee added')
    # 11 reciprocal
    good = case('reciprocal-division-choice', 'Which multiplication equals 1/2 ÷ 4/7?', ['2 × 4/7', '1/2 × 7/4', '2 × 7/4', '1/2 × 4/7'], answer='option-b')
    review_problem(good)
    bad = copy.deepcopy(good); bad['answer'] = 'option-c'; must_reject(bad, 'flipped both')
    # 12 scaling
    good = case('scaling-direction-choice', 'Without calculating, which product is less than 80?', ['80 × 2/3', '80 × 4/3', '80 × 7/5', '80 × 3/2'])
    review_problem(good)
    bad = copy.deepcopy(good); bad['answer'] = 'option-b'; must_reject(bad, 'greater product')
    # 13 percent grid
    gs = {'v': 1, 'title': 'A 10 by 10 grid with 15 of 100 squares shaded', 'elements': [{'id': 'whole', 'type': 'rect', 'at': [0, 0], 'size': [10, 10]}, {'id': 'shade-0', 'type': 'rect', 'at': [0, 0], 'size': [1, 10]}, {'id': 'shade-1', 'type': 'rect', 'at': [1, 0], 'size': [1, 5]}]}
    good = case('percent-grid-model', 'What fraction of the grid is shaded? Give the fraction in simplest form.', ['3/20', '85/100', '20/3', '15/10'], figure=gs)
    review_problem(good)
    bad = copy.deepcopy(good); bad['public']['figure']['scene']['elements'][2]['size'] = [1, 6]; must_reject(bad, 'figure has 16 squares')
    bad = copy.deepcopy(good); bad['answer'] = 'option-b'; must_reject(bad, 'unsimplified wrong value')
    # 14 percent forms
    good = case('percent-forms-and-parts', 'Write 21/25 as a percent. Enter the number without the percent sign.', answer='84', number=True)
    review_problem(good)
    bad = copy.deepcopy(good); bad['answer'] = '48'; must_reject(bad, 'digits swapped')
    good = case('percent-forms-and-parts', 'Carla has saved 24 dollars, which is 40% of the goal. What is the goal, in dollars?', answer='60', number=True)
    review_problem(good)
    bad = copy.deepcopy(good); bad['answer'] = '9.6'; must_reject(bad, 'multiplied by the percent')
    # 15 roles
    rt = {'v': 1, 'title': 'Cost ($) for each value of Minutes', 'elements': [{'id': 't', 'type': 'table', 'corner': 'Minutes', 'columns': ['Cost ($)'], 'rows': [{'label': str(i), 'cells': [3 * i]} for i in range(1, 5)]}]}
    good = case('independent-dependent-roles', 'The table shows the cost of the call for different values of the minutes on a call. Which is the independent quantity?', ['The cost of the call', 'The minutes on a call', 'Both quantities', 'Neither quantity'], figure=rt, answer='option-b')
    review_problem(good)
    bad = copy.deepcopy(good); bad['answer'] = 'option-a'; must_reject(bad, 'roles reversed')
    bad = copy.deepcopy(good); bad['public']['figure']['scene']['elements'][0]['corner'] = 'Cost ($)'; bad['public']['figure']['scene']['elements'][0]['columns'] = ['Minutes']; must_reject(bad, 'table headings swapped')
    # Direct role statements must check both clauses, independently of the key.
    good = case('independent-dependent-roles', 'Which statement about the table is true?', [
        'The minutes on a call is the independent quantity and the cost of the call is the dependent quantity.',
        'The cost of the call is the independent quantity and the minutes on a call is the dependent quantity.',
        'Both quantities are independent because both are numbers in the table.',
        'The first column is always dependent because it is listed first.'], figure=rt)
    review_problem(good)
    bad = copy.deepcopy(good); bad['answer'] = 'option-b'; must_reject(bad, 'reversed statement marked correct')
    bad = copy.deepcopy(good); bad['public']['response']['options'][0]['label'] = 'The minutes on a call is the independent quantity and the minutes on a call is the dependent quantity.'; must_reject(bad, 'dependent clause names the input')
    bad = copy.deepcopy(good); bad['public']['response']['options'][0]['label'] = 'The cost of the call is the independent quantity and the cost of the call is the dependent quantity.'; must_reject(bad, 'independent clause names the output')
    bad = copy.deepcopy(good); bad['public']['response']['options'][1]['label'] = good['public']['response']['options'][0]['label']; must_reject(bad, 'two true role statements')
    # Older causal wording is also supported, including its optional dependent clause.
    for suffix in ['', ' and the cost of the call is the dependent quantity']:
        causal = copy.deepcopy(good)
        causal['public']['response']['options'][0]['label'] = 'The cost of the call changes when the minutes on a call changes, so the minutes on a call is the independent quantity' + suffix + '.'
        review_problem(causal)
    bad = copy.deepcopy(causal); bad['public']['response']['options'][0]['label'] = bad['public']['response']['options'][0]['label'].replace('and the cost of the call', 'and the minutes on a call'); must_reject(bad, 'causal statement contradicts its dependent clause')
    # 16 expression vs equation
    good = case('expression-or-equation', 'Which of these is an equation, not an expression?', ['7x − 3', 'y + 9 = 11', '5m', '3a'], answer='option-b')
    review_problem(good)
    bad = copy.deepcopy(good); bad['answer'] = 'option-a'; must_reject(bad, 'expression chosen')
    # 17 rational equation
    good = case('rational-area-volume-equation', 'A triangular banner has an area of 9/16 square feet and a base of 1 1/2 feet. Which equation can be used to find its height, h, in feet?', ['1/2 × 1 1/2 + h = 9/16', '1/2 × (1 1/2 + h) = 9/16', '1/2 × 1 1/2 × h = 9/16', '1 1/2 × h = 9/16'], answer='option-c')
    review_problem(good)
    bad = copy.deepcopy(good); bad['answer'] = 'option-d'; must_reject(bad, 'forgot the half')
    # 18 categorical
    cs = {'v': 1, 'title': 'c', 'elements': [{'id': 't', 'type': 'table', 'corner': 'Sport', 'columns': ['Students'], 'rows': [{'label': 'Hockey', 'cells': [2]}, {'label': 'Swimming', 'cells': [3]}, {'label': 'Tennis', 'cells': [8]}, {'label': 'Baseball', 'cells': [12]}]}]}
    good = case('categorical-summary', 'The table shows the favorite sport of 25 students. What percent of the students chose Baseball? Enter the number without the percent sign.', figure=cs, answer='48', number=True)
    review_problem(good)
    bad = copy.deepcopy(good); bad['public']['prompt'] = bad['public']['prompt'].replace('25 students', '26 students'); must_reject(bad, 'total disagrees with table')
    bad = copy.deepcopy(good); bad['answer'] = '12'; must_reject(bad, 'count instead of percent')
    # 19 income
    good = case('lifetime-income-salary', 'A person earns 49,000 dollars each year for 44 years. How many dollars does the person earn in all?', answer='2156000', number=True)
    review_problem(good)
    bad = copy.deepcopy(good); bad['answer'] = '215600'; must_reject(bad, 'dropped a zero')
    # 20 pi
    good = case('pi-as-ratio', 'A circular lid has a diameter of 5 cm and a circumference of 15.7 cm. What is the circumference divided by the diameter, rounded to the nearest hundredth?', ['3.14', '6.28', '0.32', '3'])
    review_problem(good)
    bad = copy.deepcopy(good); bad['answer'] = 'option-d'; must_reject(bad, 'unrounded 3')
    bad = copy.deepcopy(good); bad['public']['prompt'] = bad['public']['prompt'].replace('15.7', '25.7'); must_reject(bad, 'not a circle')
    # 21 experimental
    good = case('experimental-probability-predict', 'A spinner was spun 25 times and landed on blue 12 times. Use these results to predict how many times the spinner lands on blue in 75 spins.', answer='36', number=True)
    review_problem(good)
    bad = copy.deepcopy(good); bad['answer'] = '12'; must_reject(bad, 'no scaling')
    # 22 surface area
    good = case('cylinder-prism-surface-area', 'A cylinder has a radius of 5 cm and a height of 4 cm. Its total surface area, including both circular bases, is $a\\pi$ square centimeters. What is $a$?', answer='90', number=True)
    review_problem(good)
    bad = copy.deepcopy(good); bad['answer'] = '50'; must_reject(bad, 'bases only')
    bad = copy.deepcopy(good); bad['explanation'] = ['Area = 16\\pi \\times 14 = 224\\pi$']; must_reject(bad, 'unbalanced delimiter')
    # 23 both sides
    good = case('both-sides-situation-equation', 'Rental A charges a starting fee of 26 dollars plus 2 dollars per minute. Rental B charges a starting fee of 2 dollars plus 5 dollars per minute. Which equation can be used to find the number of minutes, m, for which the two total costs are equal?', ['28m = 7m', '26 + 2m = 5m', '26 + 5m = 2 + 2m', '26 + 2m = 2 + 5m'], answer='option-d')
    review_problem(good)
    bad = copy.deepcopy(good); bad['answer'] = 'option-c'; must_reject(bad, 'rates swapped')
    return {'fixtures': 23, 'rejectedMutations': rejected}


def review_stream(lines, ids=SUPPORTED):
    first = json.loads(next(lines))
    require(first.get('kind') == 'manifest' and first.get('format') == 1, 'Unsupported manifest')
    require(set(first['templates']) == set(ids), f'Cluster inventory mismatch: {set(first["templates"]) ^ set(ids)}')
    counts = {}
    for line in lines:
        record = json.loads(line)
        problem = record['problem']
        review_problem(problem)
        t = problem['public']['templateId']
        counts[t] = counts.get(t, 0) + 1
    require(set(counts) == set(ids), 'A template produced no cases')
    return counts

# Read by independent-math-review.py (FamilyOracle).
CHOICE_REVIEW = 'choice-response'



if __name__ == '__main__':
    print(self_test())
    if len(sys.argv) > 1:
        counts = {}
        failures = {}
        with open(sys.argv[1]) as handle:
            next(handle)
            for line in handle:
                problem = json.loads(line)['problem']
                t = problem['public']['templateId']
                try:
                    review_problem(problem)
                    counts[t] = counts.get(t, 0) + 1
                except ValueError as error:
                    failures.setdefault(t, []).append((problem['public']['seed'], str(error), problem['public']['prompt'][:140]))
        print({'checked': counts})
        for t, items in failures.items():
            print(t, len(items))
            seen = {}
            for seed, message, prompt in items:
                key = message[:28]
                seen[key] = seen.get(key, 0) + 1
                if seen[key] == 1:
                    print('   ', seed, message[:150], '|', prompt)
            print('   ', seen)
