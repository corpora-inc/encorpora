"""Independent Texas K-2 gap review from the public prompt, choices and figure data only."""
import copy
import math
import re
from fractions import Fraction

SUPPORTED = frozenset({
    'coin-name-and-cent-value', 'solid-bottom-face-shape', 'measurable-attribute-choice',
    'dot-group-compared-to-number', 'story-sentence-match-20', 'story-sentence-match-1000',
    'open-number-line-to-120', 'open-number-line-to-1000', 'eighths-and-parts-beyond-one',
    'decompose-flat-shape', 'unit-size-and-count', 'benchmark-length-estimate',
    'clock-minute-match', 'tally-and-t-chart', 'early-money-decisions',
})


def require(condition, message):
    if not condition:
        raise ValueError(message)


def options(public):
    response = public['response']
    require(response['kind'] == 'choice', 'Texas K-2 gap problems use choice responses')
    opts = response['options']
    require(2 <= len(opts) <= 4 and all(set(o) == {'id', 'label'} for o in opts), 'Public choices required')
    require(len({o['id'] for o in opts}) == len(opts), 'Duplicate choice IDs')
    require(len({o['label'] for o in opts}) == len(opts), 'Duplicate choice labels')
    return opts


def only(opts, predicate, message):
    found = [o['id'] for o in opts if predicate(o['label'])]
    require(len(found) == 1, message)
    return found[0]


def elements(public):
    figure = public['figure']
    require(figure['kind'] == 'scene' and figure['scene']['v'] == 1, 'Scene figure expected')
    return figure['scene']['elements']


# ---------------------------------------------------------------- coins
COIN_CENTS = {'penny': 1, 'nickel': 5, 'dime': 10, 'quarter': 25}
CENT_WORDS = {'one': 1, 'five': 5, 'ten': 10, 'twenty-five': 25}


# What a drawn coin shows: metal, edge and diameter in millimeters (United
# States Mint specifications). A drawn coin is named from these, never from
# printed text.
COIN_FEATURES = {
    'penny': ('copper', 'smooth', 19.05),
    'nickel': ('silver', 'smooth', 21.21),
    'dime': ('silver', 'reeded', 17.91),
    'quarter': ('silver', 'reeded', 24.26),
}


def name_by_features(metal, edge, diameter):
    """The coin with these features: copper is a penny; among silver coins a
    smooth edge is a nickel, and a reeded one is a dime or a quarter by size."""
    if metal == 'copper':
        return 'penny'
    if edge == 'smooth':
        return 'nickel'
    return 'dime' if diameter < 21 else 'quarter'


def pictured_coins(figure):
    """[(coin, label)] from either picture surface: lettered money sets with
    printed values, or the drawn `coins` scene component without values."""
    require(figure is not None, 'Coin picture expected')
    if figure['kind'] == 'money-sets':
        sets = figure['sets']
        require(all(len(s['items']) == 1 and s['items'][0] in COIN_CENTS for s in sets), 'Single coins per picture')
        return [(s['items'][0], s.get('label')) for s in sets]
    els = elements({'figure': figure})
    require(len(els) == 1 and els[0]['type'] == 'coins', 'One coins element')
    out = []
    for c in els[0]['coins']:
        require(set(c) <= {'coin', 'label'}, 'A drawn coin carries no value or text')
        require(c['coin'] in COIN_FEATURES, 'Unknown drawn coin')
        named = name_by_features(*COIN_FEATURES[c['coin']])
        require(named == c['coin'], 'Drawn features name a different coin')
        out.append((named, c.get('label')))
    text = repr(figure).lower()
    require('¢' not in text and 'cent' not in text, 'A drawn coin shows no value')
    labels = [l for _, l in out if l]
    require(len(out) == 1 and not labels or labels == list('ABC'[:len(out)]), 'Letters A, B, C on several coins only')
    return out


def solve_coin(public):
    opts = options(public)
    prompt = public['prompt']
    figure = public.get('figure')
    if prompt == 'What is the name of this coin?':
        coins = pictured_coins(figure)
        require(len(coins) == 1, 'One coin expected')
        coin = coins[0][0]
        if figure['kind'] == 'scene':
            require(not any(n in prompt.lower() for n in COIN_CENTS), 'Prompt names no coin')
        require(coin in COIN_CENTS, 'Unknown coin')
        require({o['label'] for o in opts} == set(COIN_CENTS), 'Four coin names expected')
        return only(opts, lambda l: l == coin, 'One correct coin name')
    match = re.fullmatch(r'Which picture shows an? (\w+)\?', prompt)
    if match:
        coin = match[1]
        require(coin in COIN_CENTS, 'Coin picture question')
        coins = pictured_coins(figure)
        require(len({c for c, _ in coins}) == len(coins), 'Duplicate coin pictures')
        letter = lambda label: label.strip('$')
        require(sorted(letter(o['label']) for o in opts) == sorted(l for _, l in coins), 'Choices must be the picture labels')
        labels = [l for c, l in coins if c == coin]
        require(len(labels) == 1, 'Named coin must appear exactly once')
        return only(opts, lambda l: letter(l) == labels[0], 'One correct picture')
    if prompt == 'How do you write the value of this coin with the cent symbol?':
        coins = pictured_coins(figure)
        require(len(coins) == 1, 'One coin')
        value = COIN_CENTS[coins[0][0]]
    else:
        match = re.fullmatch(r'An? (\w+) is worth ([\w-]+) cents?\. How do you write that value with the cent symbol\?', prompt)
        require(match and match[1] in COIN_CENTS and CENT_WORDS[match[2]] == COIN_CENTS[match[1]], 'Stated coin value must be true')
        require(figure is None, 'No figure on statement form')
        value = COIN_CENTS[match[1]]
    require(all(re.fullmatch(r'\d+¢', o['label']) or True for o in opts), '')
    for o in opts:
        require(not re.fullmatch(r'\d+¢', o['label']) or int(o['label'][:-1]) in COIN_CENTS.values(), 'Cent choice must be a coin value')
    return only(opts, lambda l: l == f'{value}¢', 'One correct cent writing')


# ---------------------------------------------------------------- solids
def solve_solid(public):
    require(public['prompt'] == 'A solid stands on a table. What is the shape of its flat face that touches the table?', 'Solid prompt')
    solid = public['figure']['solid']
    require(public['figure']['kind'] == 'solid-shape' and solid['type'] in ('prism', 'pyramid'), 'Solid kind')
    base = solid['base']
    if base['type'] == 'ellipse':
        r = base['radii']
        require(abs(r[0] - r[1]) < 1e-9, 'Round base must be a circle')
        name = 'circle'
    else:
        pts = base['points']
        n = len(pts)
        sides = [math.dist(pts[i], pts[(i + 1) % n]) for i in range(n)]
        if n == 3:
            name = 'triangle'
        else:
            require(n == 4, 'Base polygon must have 3 or 4 corners')
            for i in range(4):
                a, b, c = pts[i], pts[(i + 1) % 4], pts[(i + 2) % 4]
                dot = (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1])
                require(abs(dot) < 1e-3, 'Four-sided base must have square corners')
            name = 'square' if max(sides) - min(sides) < 1e-3 else 'rectangle'
            if name == 'rectangle':
                require(max(sides) / min(sides) > 1.25, 'Rectangle must be visibly not square')
    opts = options(public)
    return only(opts, lambda l: l == name, 'One correct face shape')


# ---------------------------------------------------------------- attributes
def attribute_of(text):
    t = text.lower()
    hits = set()
    if re.fullmatch(r'what color is the \w+\?', t):
        return 'color'
    if re.search(r'heav', t):
        hits.add('weight')
    if re.search(r'\bhold\b|room for|fits|how much (?!heavy)', t):
        hits.add('capacity')
    if re.search(r'how (long|tall|wide)|long enough|tall enough|wide enough|reach', t):
        hits.add('length')
    require(len(hits) == 1, f'Ambiguous attribute: {text}')
    return hits.pop()


def solve_attribute(public):
    opts = options(public)
    prompt = public['prompt']
    match = re.fullmatch(r'Which question asks about the (length|capacity|weight) of the \w+\?', prompt)
    if match:
        return only(opts, lambda l: attribute_of(l) == match[1], 'One question for the attribute')
    match = re.fullmatch(r'You want to answer this question: (.+\?) Which attribute do you measure\?', prompt)
    if not match:
        match = re.fullmatch(r'(.+?\.) Which attribute should be measured\?', prompt)
    require(match, 'Attribute prompt form')
    attr = attribute_of(match[1])
    require({o['label'] for o in opts} == {'length', 'capacity', 'weight', 'color'}, 'Attribute choices')
    return only(opts, lambda l: l == attr, 'One correct attribute')


# ---------------------------------------------------------------- dots
def solve_dots(public):
    els = elements(public)
    labels = [e for e in els if e['type'] == 'text']
    paths = [e for e in els if e['type'] == 'path']
    require(len(labels) == len(paths) and len(paths) >= 3, 'One label per dot group')
    counts = {}
    for text, path in zip(labels, paths):
        dots = [c for c in path['d'] if c[0] == 'M']
        closed = [c for c in path['d'] if c[0] == 'Z']
        require(len(dots) == len(closed), 'Each dot is one closed shape')
        # Every dot is a circle of the same radius: centre/radius check.
        counts[text['text']] = len(dots)
    require(len(counts) == len(labels), 'Duplicate group labels')
    prompt = public['prompt']
    opts = options(public)
    if prompt == 'Which group has the same number of dots as the Start group?':
        start = counts.pop('Start')
        target = lambda n: n == start
    else:
        match = re.fullmatch(r'Which group has (exactly|fewer dots than|more dots than) (\d+)(?: dots)?\?', prompt.replace('fewer dots than', 'fewer dots than').replace('more dots than', 'more dots than'))
        match = re.fullmatch(r'Which group has (exactly|fewer dots than|more dots than) (\d+)( dots)?\?', prompt)
        require(match, 'Dot prompt form')
        n = int(match[2])
        require((match[1] == 'exactly') == bool(match[3]), 'Wording form')
        target = {'exactly': lambda c: c == n, 'fewer dots than': lambda c: c < n, 'more dots than': lambda c: c > n}[match[1]]
    require(sorted(o['label'] for o in opts) == sorted(counts), 'Choices are the group labels')
    require(len(set(counts.values())) == len(counts) or prompt.startswith('Which group has the same'), 'Groups should have different counts')
    return only(opts, lambda l: target(counts[l]), 'One matching dot group')


# ---------------------------------------------------------------- stories
def clean(text):
    return re.sub(r'\s+', '', text.replace('−', '-'))


def story_forms(text):
    """Acceptable equations for a story, as strings, from its own wording."""
    m = re.fullmatch(r'\w+ has (\d+) \w+\. \w+ gets (\d+) more\. How many \w+ does \w+ have now\?', text)
    if m:
        a, b = int(m[1]), int(m[2])
        return {f'{a}+{b}=□', f'{b}+{a}=□'}
    m = re.fullmatch(r'\w+ has (\d+) \w+\. \w+ gives away (\d+)\. How many \w+ does \w+ have left\?', text)
    if m:
        a, b = int(m[1]), int(m[2])
        return {f'{a}-{b}=□'}
    m = re.fullmatch(r'\w+ had some \w+\. \w+ gave away (\d+)\. Now \w+ has (\d+) left\. How many \w+ did \w+ have at first\?', text)
    if m:
        b, c = int(m[1]), int(m[2])
        return {f'□-{b}={c}'}
    m = re.fullmatch(r'\w+ has (\d+) \w+\. \w+ gets some more\. Now \w+ has (\d+)\. How many more \w+ did \w+ get\?', text)
    if m:
        a, c = int(m[1]), int(m[2])
        return {f'{a}+□={c}', f'□+{a}={c}'}
    m = re.fullmatch(r'\w+ has (\d+) \w+\. \w+ has (\d+)\. How many more \w+ does \w+ have than \w+\?', text)
    if m:
        a, b = int(m[1]), int(m[2])
        return {f'{a}-{b}=□', f'{b}+□={a}', f'□+{b}={a}'}
    raise ValueError(f'Unknown story: {text}')


def solve_story(public):
    opts = options(public)
    prompt = public['prompt']
    require(public.get('figure') is None, 'No figure')
    m = re.fullmatch(r'Which story matches (.+ = .+)\? The box □ is the number to find\.', prompt)
    if m:
        equation = clean(m[1])
        require(equation.count('□') == 1, 'One box')
        return only(opts, lambda l: equation in story_forms(l), 'Exactly one story matches the number sentence')
    m = re.fullmatch(r'Which number sentence matches this story\? The box □ is the number to find\. (.+)', prompt)
    require(m, 'Story prompt form')
    forms = story_forms(m[1])
    for o in opts:
        require(re.fullmatch(r'(\d+ [+−] □|□ [+−] \d+|\d+ [+−] \d+) = (\d+|□)', o['label']) and o['label'].count('□') == 1, 'Equation choices')
    return only(opts, lambda l: clean(l) in forms, 'Exactly one number sentence matches the story')


# ---------------------------------------------------------------- number lines
def solve_number_line(public):
    els = elements(public)
    require(len(els) == 1 and els[0]['type'] == 'numberLine', 'One number line')
    line = els[0]
    lo, hi, step = line['min'], line['max'], line['step']
    require(hi > lo and step > 0 and (hi - lo) % step == 0 and 5 <= (hi - lo) / step <= 20, 'Tick spacing')
    require(len(line['labels']) == 3 and line['labels'] == [lo, (lo + hi) // 2, hi], 'Three labels: ends and middle')
    require(all((v - lo) % step == 0 for v in line['labels']), 'Labels on tick marks')
    marks = line['marks']
    values = [m['at'] for m in marks]
    require(len(set(values)) == len(values) and len({m['label'] for m in marks}) == len(marks), 'Distinct marks')
    require(all(lo <= v <= hi and (v - lo) % step == 0 for v in values), 'Marks on tick marks inside the line')
    opts = options(public)
    m = re.fullmatch(r'Which point is at (\d+) on the number line\?', public['prompt'])
    if m:
        n = int(m[1])
        require(len(marks) == 4 and sorted(o['label'] for o in opts) == sorted(k['label'] for k in marks), 'Choices are the points')
        hits = [k['label'] for k in marks if k['at'] == n]
        require(len(hits) == 1, 'One point at the number')
        return only(opts, lambda l: l == hits[0], 'One correct point')
    m = re.fullmatch(r'Which number is at point (\w) on the number line\?', public['prompt'])
    require(m, 'Number line prompt')
    point = [k['at'] for k in marks if k['label'] == m[1]]
    require(len(point) == 1 and len(marks) == 1, 'Single named point')
    for o in opts:
        require(re.fullmatch(r'\d+', o['label']), 'Numeric choices')
    require(len({abs(int(o['label']) - point[0]) for o in opts}) >= 1, '')
    return only(opts, lambda l: int(l) == point[0], 'One correct number')


# ---------------------------------------------------------------- fractions
PART_NAMES = {'half': 2, 'halves': 2, 'third': 3, 'thirds': 3, 'fourth': 4, 'fourths': 4, 'eighth': 8, 'eighths': 8}


def fraction_label_value(label):
    m = re.fullmatch(r'(?:(\d+) wholes? and )?(\d+) (half|halves|third|thirds|fourth|fourths|eighth|eighths)', label) or \
        re.fullmatch(r'(?:(\d+) wholes?)()()', label)
    require(m, f'Fraction label {label}')
    if m[2] == '':
        return Fraction(int(m[1]))
    d = PART_NAMES[m[3]]
    k = int(m[2])
    require((k == 1) == (m[3] in ('half', 'third', 'fourth', 'eighth')), f'Singular/plural: {label}')
    return Fraction(int(m[1] or 0)) + Fraction(k, d)


def solve_fraction(public):
    els = elements(public)
    require(len(els) == 1 and els[0]['type'] == 'fractionBar', 'One fraction bar element')
    bars = els[0]['bars']
    require(len(bars) == 1, 'One bar')
    bar = bars[0]
    parts, shaded, wholes = bar['parts'], bar['shaded'], bar.get('wholes', 1)
    require(shaded <= parts * wholes and wholes >= 1, 'Shading fits the bar')
    opts = options(public)
    prompt = public['prompt']
    m = re.fullmatch(r'The bar is one whole, cut into equal parts\. How many (\w+) make one whole\?', prompt)
    if m:
        require(PART_NAMES[m[1]] == parts and wholes == 1 and shaded == parts, 'Bar matches the named part')
        return only(opts, lambda l: int(l) == parts, 'One correct count')
    if prompt == 'The bar is cut into equal parts. How much of the bar is shaded?':
        require(wholes == 1 and shaded < parts, 'Less than one whole')
        value = Fraction(shaded, parts)
        return only(opts, lambda l: fraction_label_value(l) == value, 'One equal amount')
    m = re.fullmatch(r'Each bar is one whole, cut into (\w+)\. How many \1 are shaded in all\?', prompt)
    if m:
        require(PART_NAMES[m[1]] == parts, 'Bar parts match the prompt')
        return only(opts, lambda l: int(l) == shaded, 'One correct shaded count')
    m = re.fullmatch(r'Each bar is one whole, cut into (\w+)\. How much is shaded\?', prompt)
    require(m and PART_NAMES[m[1]] == parts, 'Fraction prompt')
    require(shaded > parts, 'Beyond one whole')
    value = Fraction(shaded, parts)
    return only(opts, lambda l: fraction_label_value(l) == value, 'One equal amount')


# ---------------------------------------------------------------- partitions
def solve_decompose(public):
    figure = public['figure']
    require(figure['kind'] == 'partitioned-shapes' and len(figure['shapes']) == 1, 'One shape')
    shape = figure['shapes'][0]
    sizes = shape['sizes']
    require(len(set(sizes)) == 1 and not shape['shaded'], 'Equal parts, none shaded')
    m = re.fullmatch(r'An? (square|rectangle) is cut into equal parts\. What are the new shapes\?', public['prompt'])
    require(m and m[1] == shape['shape'], 'Prompt names the drawn shape')
    cut, n = shape['cut'], len(sizes)
    expected_count = {'diagonal': 2, 'diagonals': 4}.get(cut, n)
    require(n == expected_count, 'Piece count follows the cut')
    if cut in ('diagonal', 'diagonals'):
        name = 'triangles'
    elif cut in ('rows', 'columns'):
        name = 'rectangles'
    else:
        require(cut == 'grid' and n == 4, 'Grid cut')
        name = 'squares' if shape['shape'] == 'square' else 'rectangles'
    return only(options(public), lambda l: l == f'{n} {name}', 'One correct description')


# ---------------------------------------------------------------- unit size
def solve_units(public):
    els = elements(public)
    rects = [e for e in els if e['type'] == 'rect']
    texts = {e['text']: e['at'][1] for e in els if e['type'] == 'text'}
    ribbon = [r for r in rects if r['at'][1] == 2.4]
    require(len(ribbon) == 1 and ribbon[0]['at'][0] == 0, 'One ribbon')
    length = ribbon[0]['size'][0]
    rows = {}
    for r in rects:
        if r is ribbon[0]:
            continue
        rows.setdefault(r['at'][1], []).append(r)
    require(len(rows) == 2, 'Two unit rows')
    info = {}
    for name, y in texts.items():
        if name == 'Ribbon':
            continue
        long_only = name == 'Long'
        row = sorted(rows[round(y - 0.45, 6)] if round(y - 0.45, 6) in rows else rows[min(rows, key=lambda k: abs(k - (y - 0.45)))], key=lambda r: r['at'][0])
        width = row[0]['size'][0]
        require(all(r['size'][0] == width for r in row), 'Equal units in a row')
        require(all(r['at'][0] == i * width for i, r in enumerate(row)), 'Units end to end, no gaps')
        require(long_only or len(row) * width == length, 'Units cover the ribbon exactly')
        require(not long_only or len(row) == 1, 'One long unit')
        info[name] = (width, len(row))
    require(len(info) == 2, 'Two named units')
    prompt = public['prompt']
    opts = options(public)
    m = re.fullmatch(r'The ribbon is (\d+) small units long\. One long unit is as long as (\d+) small units\. How many long units cover the ribbon\?', prompt)
    if m:
        small, long_ = info['Small'], info['Long']
        require(small[0] == 1 and small[1] == int(m[1]) and long_[0] == int(m[2]), 'Figure matches the givens')
        require(int(m[1]) % int(m[2]) == 0, 'Whole number of long units')
        return only(opts, lambda l: int(l) == int(m[1]) // int(m[2]), 'One correct count')
    require(set(info) == {'Unit A', 'Unit B'}, 'Unit names')
    a, b = info['Unit A'], info['Unit B']
    require(a[0] != b[0], 'Units differ')
    m = re.fullmatch(r'Both rows cover the same ribbon, end to end, with no gaps\. Row ([AB]) uses more units than row ([AB])\. Why\?', prompt)
    if m:
        more, fewer = info[f'Unit {m[1]}'], info[f'Unit {m[2]}']
        require(more[1] > fewer[1], 'Figure agrees with the stated row counts')
        short, long_ = m[1], m[2]

        def true(label):
            t = re.fullmatch(r'Unit ([AB]) is (shorter|longer) than unit ([AB])\.', label)
            if t:
                wa, wb = info[f'Unit {t[1]}'][0], info[f'Unit {t[3]}'][0]
                require(t[1] != t[3], 'Two different units')
                return (wa < wb) if t[2] == 'shorter' else (wa > wb)
            return False
        for o in opts:
            if o['label'].startswith('The copies') and 'gaps' in o['label']:
                continue
            if o['label'].startswith('The ribbon is longer'):
                continue
            require(re.fullmatch(r'Unit [AB] is (shorter|longer) than unit [AB]\.', o['label']), f'Unknown reason {o["label"]}')
        return only(opts, true, 'Exactly one true reason')
    require(prompt == 'The same ribbon is measured with unit A and with unit B. Which unit needs fewer copies to cover the ribbon, and why?', 'Unit prompt')
    fewer = 'A' if a[1] < b[1] else 'B'

    def true2(label):
        t = re.fullmatch(r'Unit ([AB]), because it is (shorter|longer)', label)
        require(t, f'Choice form {label}')
        w = info[f'Unit {t[1]}'][0]
        other = info['Unit B' if t[1] == 'A' else 'Unit A'][0]
        return t[1] == fewer and ((w > other) == (t[2] == 'longer'))
    return only(opts, true2, 'Exactly one true unit and reason')


# ---------------------------------------------------------------- benchmarks
METERS = {'inch': 0.0254, 'inches': 0.0254, 'foot': 0.3048, 'feet': 0.3048, 'centimeter': 0.01, 'centimeters': 0.01, 'meter': 1.0, 'meters': 1.0}
OBJECT_RANGE_M = {
    ('length', 'school bus'): (8.0, 14.0),
    ('length', 'pencil'): (0.15, 0.21),
    ('height', 'classroom door'): (1.9, 2.3),
    ('length', 'bed'): (1.8, 2.2),
}


def meters(label):
    m = re.fullmatch(r'(\d+) (inch|inches|foot|feet|centimeters?|meters?)', label)
    require(m, f'Length label {label}')
    return int(m[1]) * METERS[m[2]]


def solve_benchmark(public):
    opts = options(public)
    prompt = public['prompt']
    m = re.fullmatch(r'Which is the best estimate for the (length|height) of an? (school bus|pencil|classroom door|bed)\?', prompt)
    if m:
        lo, hi = OBJECT_RANGE_M[(m[1], m[2])]
        return only(opts, lambda l: lo <= meters(l) <= hi, 'Exactly one realistic length')
    m = re.fullmatch(r'An? ([\w ]+?) is about (\d+) (inch|inches|centimeters) long\. An? (\w+) is about (\d+) \1s long, end to end\. About how long is an? \4\?', prompt)
    require(m, 'Benchmark prompt form')
    unit = {'inch': 'inches'}.get(m[3], m[3])
    total = int(m[2]) * int(m[5])
    require(m[3] != 'inch' or m[2] == '1', 'Singular inch')
    return only(opts, lambda l: l == f'{total} {unit}', 'One correct product')


# ---------------------------------------------------------------- clocks
def solve_clock(public):
    figure = public['figure']
    require(figure['kind'] == 'analog-clocks', 'Clock figure')
    clocks = figure['clocks']
    for c in clocks:
        require(1 <= c['hour'] <= 12 and 0 <= c['minute'] < 60, 'Valid time')
    opts = options(public)
    prompt = public['prompt']
    if prompt == 'How many minutes after the hour does the clock show?':
        require(len(clocks) == 1, 'One clock')
        return only(opts, lambda l: int(l) == clocks[0]['minute'], 'One correct minute')
    if prompt == 'Which digital time matches the clock?':
        require(len(clocks) == 1, 'One clock')
        c = clocks[0]
        text = f"{c['hour']}:{c['minute']:02d}"
        for o in opts:
            require(re.fullmatch(r'\d{1,2}:\d\d', o['label']), 'Digital times')
        return only(opts, lambda l: l == text, 'One matching digital time')
    m = re.fullmatch(r'Which clock shows (\d{1,2}):(\d\d)\?', prompt)
    require(m, 'Clock prompt')
    require(sorted(o['label'] for o in opts) == sorted(c['label'] for c in clocks), 'Choices are the clock labels')
    require(len({(c['hour'], c['minute']) for c in clocks}) == len(clocks), 'Distinct clocks')
    hits = [c['label'] for c in clocks if (c['hour'], c['minute']) == (int(m[1]), int(m[2]))]
    require(len(hits) == 1, 'One clock shows the time')
    return only(opts, lambda l: l == hits[0], 'One correct clock')


# ---------------------------------------------------------------- tally
def tally_rows(els):
    texts = sorted((e for e in els if e['type'] == 'text' and e['at'][0] == 0 and e['text'] not in ('Game', 'Fruit', 'Pet', 'Color', 'Tally')
                    and e['at'][1] < -0.5), key=lambda e: -e['at'][1])
    require(len(texts) >= 2, 'Tally rows')
    segs = [e for e in els if e['type'] == 'segment' and e['width'] == 2.5]
    result = {}
    for i, t in enumerate(texts):
        top = t['at'][1] + 0.9
        bottom = t['at'][1] - 1.1
        mine = [s for s in segs if bottom <= min(s['from'][1], s['to'][1]) and max(s['from'][1], s['to'][1]) <= top]
        vert = sorted(s['from'][0] for s in mine if s['from'][0] == s['to'][0])
        diag = [s for s in mine if s['from'][0] != s['to'][0]]
        require(len(vert) + len(diag) == len(mine), 'Strokes classified')
        require(len(set(vert)) == len(vert), 'Overlapping tally strokes')
        require(all(max(s['from'][0], s['to'][0]) <= 9.6 for s in mine), 'Tally overflows the table')
        # Each slash must cross exactly the four strokes before it.
        for d in diag:
            lo, hi = sorted((d['from'][0], d['to'][0]))
            require(len([x for x in vert if lo <= x <= hi]) == 4, 'A slash crosses exactly four strokes')
        result[t['text']] = len(vert) + len(diag)
    return result


def solve_tally(public):
    opts = options(public)
    prompt = public['prompt']
    m = re.fullmatch(r'\w+ asked (\d+) children for a favorite (\w+)\. The answers were: ([\w, ]+)\. Which T-chart shows how many children chose each\?', prompt)
    if m:
        answers = [a.strip() for a in m[3].split(',')]
        require(len(answers) == int(m[1]), 'Number asked matches the list')
        counts = {a: answers.count(a) for a in set(answers)}

        def good(label):
            pairs = [p.strip().rsplit(' ', 1) for p in label.split(',')]
            got = {k: int(v) for k, v in pairs}
            return got == counts
        return only(opts, good, 'One correct T-chart')
    rows = tally_rows(elements(public))
    for pattern, f in (
        (r"The tally chart shows each child's favorite \w+\. How many children answered in all\?", lambda m: sum(rows.values())),
        (r"The tally chart shows each child's favorite \w+\. How many children chose (\w+)\?", lambda m: rows[m[1]]),
        (r"The tally chart shows each child's favorite \w+\. How many more children chose (\w+) than (\w+)\?", lambda m: rows[m[1]] - rows[m[2]]),
    ):
        m = re.fullmatch(pattern, prompt)
        if m:
            value = f(m)
            require(value > 0, 'Positive answer')
            return only(opts, lambda l: int(l) == value, 'One correct count')
    raise ValueError('Tally prompt form')


# ---------------------------------------------------------------- early money
CLASSES = {
    'withdrawal': r'takes \$\d+ out of',
    'deposit': r'(puts \$\d+ (of pay )?into (the|a) bank|adds \$\d+ to savings)',
    'spending': r'buys',
    'income': r'is paid \$\d+',
    'gift': r'gets \$\d+ (as a present|in a card|from Grandma as a birthday present)',
    'saving': r'to keep for later',
}
ASKED = {
    'a withdrawal': 'withdrawal', 'a deposit': 'deposit', 'spending': 'spending',
    'income, money earned by working': 'income',
    'a gift, money given to you that you did not earn': 'gift', 'saving': 'saving',
}


def solve_money(public):
    opts = options(public)
    prompt = public['prompt']
    m = re.fullmatch(r'Which one (?:is|shows) (.+)\?', prompt)
    if m:
        asked = ASKED[m[1]]
        for o in opts:
            classes = {k for k, rx in CLASSES.items() if re.search(rx, o['label'])}
            require(classes, f'Unclassified money sentence: {o["label"]}')
            # Withdrawals to pay are also spending words only in sentence wording; keep one reading per sentence.
            require(len(classes) == 1, f'Sentence fits several ideas: {o["label"]}')
        return only(opts, lambda l: re.search(CLASSES[asked], l), 'Exactly one sentence for the idea')
    m = re.fullmatch(r"(\w+) makes one ([\w ]+?) and buys (.+)\. How much does it cost \1 to make the \2\?", prompt)
    if m:
        total = 0
        for part in m[3].split(', '):
            part = re.sub(r'^and ', '', part)
            each = re.fullmatch(r'(\d+) [\w ]+? at (\d+)¢ each', part)
            one = re.fullmatch(r'(\d+) [\w ]+? for (\d+)¢', part)
            require(each or one, f'Cost item {part}')
            total += int(each[1]) * int(each[2]) if each else int(one[1]) * int(one[2]) if int(one[1]) == 1 else 10 ** 9
        require(total < 10 ** 8, 'Single priced items only')
        return only(opts, lambda l: l == f'{total}¢', 'One correct cost')
    m = re.fullmatch(r"(\w+)'s bank account has \$(\d+)\. \1 makes a deposit of \$(\d+) and a withdrawal of \$(\d+)\. How much is in the account now\?", prompt)
    if m:
        total = int(m[2]) + int(m[3]) - int(m[4])
        require(total >= 0, 'Balance cannot be negative')
        return only(opts, lambda l: l == f'${total}', 'One correct balance')
    m = re.fullmatch(r'(\w+) already has \$(\d+) saved and saves \$(\d+) more each week\. How much does \1 have after (\d+) weeks\?', prompt)
    if m:
        return only(opts, lambda l: l == f'${int(m[2]) + int(m[3]) * int(m[4])}', 'One correct savings total')
    m = re.fullmatch(r'(\w+) saves \$(\d+) each week\. How much has \1 saved after (\d+) weeks\?', prompt)
    if m:
        return only(opts, lambda l: l == f'${int(m[2]) * int(m[3])}', 'One correct savings total')
    m = re.fullmatch(r'(\w+) (?:makes|bakes|grows) [\w ]+? and sells (?:it|them)\. (\w+) buys an? [\w ]+\. Which sentence is true\?', prompt)
    require(m, 'Money prompt form')
    seller, buyer = m[1], m[2]
    allowed = {f'{seller} is the producer and {buyer} is the consumer.', f'{seller} is the consumer and {buyer} is the producer.',
               f'{seller} and {buyer} are both producers.', f'{seller} and {buyer} are both consumers.'}
    require({o['label'] for o in opts} <= allowed, 'Role sentences')
    return only(opts, lambda l: l == f'{seller} is the producer and {buyer} is the consumer.', 'One true role sentence')


# ---------------------------------------------------------------- dispatch
SOLVERS = {
    'coin-name-and-cent-value': solve_coin,
    'solid-bottom-face-shape': solve_solid,
    'measurable-attribute-choice': solve_attribute,
    'dot-group-compared-to-number': solve_dots,
    'story-sentence-match-20': solve_story,
    'story-sentence-match-1000': solve_story,
    'open-number-line-to-120': solve_number_line,
    'open-number-line-to-1000': solve_number_line,
    'eighths-and-parts-beyond-one': solve_fraction,
    'decompose-flat-shape': solve_decompose,
    'unit-size-and-count': solve_units,
    'benchmark-length-estimate': solve_benchmark,
    'clock-minute-match': solve_clock,
    'tally-and-t-chart': solve_tally,
    'early-money-decisions': solve_money,
}


def solve(public):
    require(public['templateId'] in SUPPORTED, 'Unexpected Texas K-2 family')
    return SOLVERS[public['templateId']](public)


def review_problem(problem):
    public = problem['public']
    result = solve(public)
    require(result == problem['answer'], 'Texas K-2 answer key mismatch')
    labels = {o['id']: o['label'] for o in public['response']['options']}
    correct = labels[result]
    # The prompt and hint must not hand over a distinctive correct label.
    if len(correct) >= 5 and re.search(r'[a-z]{4}', correct):
        require(correct.lower() not in public['prompt'].lower(), 'Prompt leaks the correct label')
        require(correct.lower() not in problem['hint'].lower(), 'Hint leaks the correct label')
    for option_id, text in problem.get('choiceFeedback', {}).items():
        require(option_id != result, 'Feedback written for the correct choice')
        require(option_id in labels, 'Feedback for unknown choice')
    return result


def review_cases(problems):
    counts = {}
    for problem in problems:
        review_problem(problem)
        counts[problem['public']['templateId']] = counts.get(problem['public']['templateId'], 0) + 1
    return counts


# ---------------------------------------------------------------- self test
def choice_problem(template, prompt, labels, answer_index, figure=None):
    public = {
        'templateId': template, 'prompt': prompt,
        'response': {'kind': 'choice', 'options': [{'id': f'option-{i}', 'label': l} for i, l in enumerate(labels)]},
    }
    if figure is not None:
        public['figure'] = figure
    return {'public': public, 'answer': f'option-{answer_index}', 'hint': 'Look carefully.', 'choiceFeedback': {}}


def self_test():
    nl = lambda lo, hi, step, marks: {'kind': 'scene', 'scene': {'v': 1, 'elements': [{
        'type': 'numberLine', 'min': lo, 'max': hi, 'step': step, 'labels': [lo, (lo + hi) // 2, hi],
        'marks': [{'at': a, 'label': l} for a, l in marks]}]}}
    bar = lambda parts, shaded, wholes=1: {'kind': 'scene', 'scene': {'v': 1, 'elements': [{
        'type': 'fractionBar', 'bars': [{'parts': parts, 'shaded': shaded, 'wholes': wholes}]}]}}
    rect = lambda x, y, w, h=0.9: {'type': 'rect', 'at': [x, y], 'size': [w, h]}
    txt = lambda t, x, y: {'type': 'text', 'at': [x, y], 'text': t}

    def units(a_w, b_w, total):
        els = [rect(0, 2.4, total), txt('Ribbon', 6, 2.85), txt('Unit A', -0.5, 1.65), txt('Unit B', -0.5, 0.45)]
        els += [rect(i * a_w, 1.2, a_w) for i in range(total // a_w)]
        els += [rect(i * b_w, 0, b_w) for i in range(total // b_w)]
        return {'kind': 'scene', 'scene': {'v': 1, 'elements': els}}

    def seg(x1, y1, x2, y2):
        return {'type': 'segment', 'width': 2.5, 'from': [x1, y1], 'to': [x2, y2]}

    def tally_fig(a, b):
        els = [txt('Game', 0, 0), txt('Tally', 3.6, 0)]
        for row, (name, n) in enumerate((('jump', a), ('hide', b))):
            y = -1.6 - 1.5 * row
            els.append(txt(name, 0, y))
            x = 3.7
            for g in range(n // 5):
                els += [seg(x + 0.4 * k, y - 0.5, x + 0.4 * k, y + 0.5) for k in range(4)] + [seg(x - 0.2, y + 0.4, x + 1.4, y - 0.4)]
                x += 2
            els += [seg(x + 0.4 * k, y - 0.5, x + 0.4 * k, y + 0.5) for k in range(n % 5)]
        return {'kind': 'scene', 'scene': {'v': 1, 'elements': els}}

    def dots(counts):
        els = []
        for label, n in counts:
            els.append(txt(label, 0, 0))
            els.append({'type': 'path', 'd': [[c, 0, 0] for _ in range(n) for c in ('M', 'Z')]})
        return {'kind': 'scene', 'scene': {'v': 1, 'elements': els}}

    cases = [
        choice_problem('coin-name-and-cent-value', 'What is the name of this coin?', ['penny', 'nickel', 'dime', 'quarter'], 1,
                       {'kind': 'money-sets', 'sets': [{'items': ['nickel']}]}),
        choice_problem('coin-name-and-cent-value', 'A dime is worth ten cents. How do you write that value with the cent symbol?', ['10', '$10', '10¢', '¢10'], 2),
        choice_problem('coin-name-and-cent-value', 'Which picture shows a dime?', ['A', 'B', 'C'], 2,
                       {'kind': 'money-sets', 'sets': [{'items': ['penny'], 'label': 'A'}, {'items': ['nickel'], 'label': 'B'}, {'items': ['dime'], 'label': 'C'}]}),
        choice_problem('solid-bottom-face-shape', 'A solid stands on a table. What is the shape of its flat face that touches the table?',
                       ['circle', 'triangle', 'square', 'rectangle'], 3,
                       {'kind': 'solid-shape', 'solid': {'type': 'prism', 'base': {'type': 'polygon', 'points': [[0, 0], [3, 0], [3, 2], [0, 2]]}, 'height': 2}}),
        choice_problem('measurable-attribute-choice', 'You want to answer this question: How heavy is the dog? Which attribute do you measure?',
                       ['length', 'capacity', 'weight', 'color'], 2),
        choice_problem('measurable-attribute-choice', 'Which question asks about the capacity of the jar?',
                       ['How long is the jar?', 'How heavy is the jar?', 'How much can the jar hold?'], 2),
        choice_problem('dot-group-compared-to-number', 'Which group has more dots than 5?', ['A', 'B', 'C'], 1, dots([('A', 4), ('B', 8), ('C', 2)])),
        choice_problem('story-sentence-match-20', 'Which story matches 10 − 8 = □? The box □ is the number to find.',
                       ['Leo has 2 stamps. Leo gets 8 more. How many stamps does Leo have now?',
                        'Leo has 10 stamps. Leo gives away 8. How many stamps does Leo have left?',
                        'Leo had some stamps. Leo gave away 8. Now Leo has 2 left. How many stamps did Leo have at first?'], 1),
        choice_problem('story-sentence-match-1000', 'Which number sentence matches this story? The box □ is the number to find. Mia has 530 cards. Ben has 210. How many more cards does Mia have than Ben?',
                       ['530 − 210 = □', '530 + 210 = □', '□ − 210 = 530'], 0),
        choice_problem('open-number-line-to-120', 'Which point is at 80 on the number line?', ['A', 'B', 'C', 'D'], 2,
                       nl(20, 120, 10, [(100, 'A'), (110, 'B'), (80, 'C'), (50, 'D')])),
        choice_problem('open-number-line-to-1000', 'Which number is at point P on the number line?', ['350', '360', '370', '340'], 1,
                       nl(300, 400, 10, [(360, 'P')])),
        choice_problem('eighths-and-parts-beyond-one', 'Each bar is one whole, cut into eighths. How much is shaded?',
                       ['1 whole and 3 eighths', '3 eighths', '2 wholes', '1 whole and 5 eighths'], 0, bar(8, 11, 2)),
        choice_problem('eighths-and-parts-beyond-one', 'The bar is one whole, cut into equal parts. How many halves make one whole?', ['1', '2', '3', '4'], 1, bar(2, 2)),
        choice_problem('decompose-flat-shape', 'A square is cut into equal parts. What are the new shapes?', ['2 triangles', '4 triangles', '4 squares', '2 rectangles'], 1,
                       {'kind': 'partitioned-shapes', 'shapes': [{'shape': 'square', 'cut': 'diagonals', 'sizes': [1, 1, 1, 1], 'shaded': []}]}),
        choice_problem('unit-size-and-count', 'Both rows cover the same ribbon, end to end, with no gaps. Row A uses more units than row B. Why?',
                       ['Unit A is shorter than unit B.', 'Unit A is longer than unit B.', 'The copies of unit A have gaps between them.'], 0, units(2, 4, 12)),
        choice_problem('unit-size-and-count', 'The same ribbon is measured with unit A and with unit B. Which unit needs fewer copies to cover the ribbon, and why?',
                       ['Unit A, because it is longer', 'Unit A, because it is shorter', 'Unit B, because it is longer', 'Unit B, because it is shorter'], 0, units(4, 2, 12)),
        choice_problem('benchmark-length-estimate', 'Which is the best estimate for the length of a school bus?', ['4 feet', '40 feet', '400 feet', '40 inches'], 1),
        choice_problem('benchmark-length-estimate', 'A ruler is about 12 inches long. A mat is about 3 rulers long, end to end. About how long is a mat?',
                       ['15 inches', '36 inches', '4 inches', '123 inches'], 1),
        choice_problem('clock-minute-match', 'Which digital time matches the clock?', ['7:36', '7:37', '8:36'], 0,
                       {'kind': 'analog-clocks', 'clocks': [{'hour': 7, 'minute': 36}]}),
        choice_problem('clock-minute-match', 'Which clock shows 5:19?', ['A', 'B', 'C'], 0,
                       {'kind': 'analog-clocks', 'clocks': [{'hour': 5, 'minute': 19, 'label': 'A'}, {'hour': 6, 'minute': 19, 'label': 'B'}, {'hour': 5, 'minute': 41, 'label': 'C'}]}),
        choice_problem('tally-and-t-chart', "The tally chart shows each child's favorite game. How many more children chose jump than hide?", ['7', '8', '6', '2'], 2, tally_fig(13, 7)),
        choice_problem('tally-and-t-chart', 'Ana asked 5 children for a favorite game. The answers were: jump, jump, hide, jump, hide. Which T-chart shows how many children chose each?',
                       ['jump 3, hide 2', 'jump 2, hide 3', 'jump 3, hide 3'], 0),
        choice_problem('early-money-decisions', 'Which one is a withdrawal?',
                       ['Ana takes $30 out of the bank to pay for shoes.', 'Ana puts $30 into a bank account.', 'Ana adds $30 to savings at the bank.'], 0),
        choice_problem('early-money-decisions', 'Dee saves $6 each week. How much has Dee saved after 4 weeks?', ['$10', '$24', '$64', '$2'], 1),
    ]
    drawn = lambda *coins: {'kind': 'scene', 'scene': {'v': 1, 'elements': [{'type': 'coins', 'id': 'coins', 'coins': [
        {'coin': c, **({'label': 'ABC'[i]} if len(coins) > 1 else {})} for i, c in enumerate(coins)]}]}}
    first_drawn = len(cases)
    cases += [
        choice_problem('coin-name-and-cent-value', 'What is the name of this coin?', ['penny', 'nickel', 'dime', 'quarter'], 3, drawn('quarter')),
        choice_problem('coin-name-and-cent-value', 'Which picture shows a dime?', ['$A$', '$B$', '$C$'], 1, drawn('quarter', 'dime', 'penny')),
        choice_problem('coin-name-and-cent-value', 'How do you write the value of this coin with the cent symbol?', ['5', '5¢', '¢5', '$5'], 1, drawn('nickel')),
    ]
    # Fixtures use hand-built figures, so mutate each one that has an unambiguous cheap corruption.
    rejected = 0

    def reject(problem, why):
        nonlocal rejected
        try:
            review_problem(problem)
        except (ValueError, KeyError, IndexError, TypeError):
            rejected += 1
            return
        raise ValueError(f'Corrupt Texas K-2 case was accepted: {why}')

    for case in cases:
        review_problem(case)
        template = case['public']['templateId']
        bad = copy.deepcopy(case)
        n = len(bad['public']['response']['options'])
        bad['answer'] = f'option-{(int(case["answer"][-1]) + 1) % n}'
        reject(bad, f'{template} wrong key')
        bad = copy.deepcopy(case)
        bad['public']['response']['options'][(int(case['answer'][-1]) + 1) % n]['label'] = \
            case['public']['response']['options'][int(case['answer'][-1])]['label']
        reject(bad, f'{template} duplicate of the correct choice')
    # Figure corruptions that must be caught.
    def fig_case(index, mutate, why):
        bad = copy.deepcopy(cases[index])
        mutate(bad['public'])
        reject(bad, why)
    fig_case(3, lambda p: p['figure']['solid']['base']['points'].__setitem__(2, [3, 3]), 'rectangle base no longer square cornered')
    fig_case(6, lambda p: p['figure']['scene']['elements'][1]['d'].extend([['M', 0, 0], ['Z']] * 6), 'dot group count changed')
    fig_case(9, lambda p: p['figure']['scene']['elements'][0]['marks'].__setitem__(2, {'at': 85, 'label': 'C'}), 'point off the tick marks')
    fig_case(9, lambda p: p['figure']['scene']['elements'][0]['marks'].__setitem__(0, {'at': 80, 'label': 'A'}), 'two points at the same number')
    fig_case(11, lambda p: p['figure']['scene']['elements'][0]['bars'][0].update({'shaded': 12}), 'bar shading changed')
    fig_case(13, lambda p: p['figure']['shapes'][0].update({'cut': 'grid'}), 'cut changed')
    fig_case(14, lambda p: p['figure']['scene']['elements'][5].update({'at': [3, 1.2]}), 'gap in unit row')
    fig_case(14, lambda p: p['figure']['scene']['elements'][2].update({'text': 'Unit B'}), 'duplicate unit name')
    fig_case(18, lambda p: p['figure']['clocks'][0].update({'minute': 37}), 'clock minute changed')
    fig_case(19, lambda p: p['figure']['clocks'][1].update({'hour': 5}), 'two clocks show the same time')
    fig_case(20, lambda p: p['figure']['scene']['elements'].pop(-1), 'tally stroke removed')
    fig_case(20, lambda p: p['figure']['scene']['elements'].pop(-6), 'tally slash removed')
    prompt_case = lambda index, old, new, why: fig_case(index, lambda p: p.update(prompt=p['prompt'].replace(old, new)), why)
    prompt_case(1, 'ten cents', 'five cents', 'false coin value')
    fig_case(first_drawn, lambda p: p['figure']['scene']['elements'][0]['coins'][0].update({'value': '25¢'}), 'a drawn coin prints its value')
    fig_case(first_drawn + 1, lambda p: p['figure']['scene']['elements'][0]['coins'][1].update({'coin': 'quarter'}), 'two pictures of one coin')
    fig_case(first_drawn + 1, lambda p: p['figure']['scene']['elements'][0]['coins'][1].update({'coin': 'nickel'}), 'named coin missing from the drawing')
    fig_case(first_drawn + 2, lambda p: p['figure']['scene']['elements'][0]['coins'][0].update({'coin': 'dime'}), 'drawn coin changed')
    fig_case(first_drawn, lambda p: p['figure']['scene']['elements'].append({'type': 'text', 'at': [0, 0], 'text': '25¢'}), 'value text beside a drawn coin')
    prompt_case(7, '10 − 8', '10 + 8', 'sentence changed')
    prompt_case(8, '530 cards', '520 cards', 'story numbers changed')
    prompt_case(14, 'Row A uses more', 'Row B uses more', 'row claim contradicts figure')
    prompt_case(16, 'school bus', 'pencil', 'object changed')
    prompt_case(17, '3 rulers', '4 rulers', 'product changed')
    return {'fixtures': len(cases), 'rejectedMutations': rejected}

# Read by independent-math-review.py (FamilyOracle).
CHOICE_REVIEW = SUPPORTED



if __name__ == '__main__':
    import json
    import sys
    print(self_test())
    if len(sys.argv) > 1:
        problems = []
        for line in open(sys.argv[1]):
            row = json.loads(line)
            if row.get('kind') == 'case' and row['problem']['public']['templateId'] in SUPPORTED:
                problems.append(row['problem'])
        print(review_cases(problems))
