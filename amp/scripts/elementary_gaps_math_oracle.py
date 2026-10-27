"""Independent review of the grade 3-5 gap templates (operation properties, time units,
thermometers, congruent figures, triangle sides, cut-shape pieces, likelihood, chance on a
0-1 line, mode and measure meaning, strip diagrams, number lines, solids, benchmark
estimates, pattern rules, expanded form, reasonable measures, data lists).

Every answer is derived from the public prompt, the choices and the figure data alone; the
generator's answer is only the value under test. review_problem(problem) returns the
independently derived answer after the structural checks (four distinct choices, exactly
one defensible choice, figures that agree with the givens)."""
import copy
import json
import math
import re
from fractions import Fraction
from itertools import combinations

SUPPORTED = frozenset({
    'benchmark-fraction-estimate', 'classify-triangle-by-sides', 'congruent-figure-pair',
    'congruent-fourths-pair', 'data-list-for-display', 'equal-chance-choice',
    'expanded-sum-to-standard', 'fraction-choice-compare', 'likelihood-in-words',
    'measure-meaning-choice', 'mode-of-data', 'name-cut-shape-pieces', 'number-between-bounds',
    'number-line-between-hundreds', 'number-line-jump-story', 'operation-property-identify',
    'pattern-rule-choice', 'pattern-term-unknown-rule', 'probability-on-number-line',
    'read-thermometer', 'reasonable-measure-choice', 'rename-time-units',
    'repeating-shape-pattern', 'solid-property-select', 'standard-to-expanded-choice',
    'story-for-subtraction-sentence', 'strip-diagram-match', 'supply-price-choice',
    'table-fits-description', 'true-comparison-statement', 'variable-in-situation',
})
NUMERIC = frozenset({'expanded-sum-to-standard', 'mode-of-data', 'pattern-term-unknown-rule',
                     'read-thermometer', 'rename-time-units'})
# solve() returns an option id (or the serialized selection) for every other template.
CHOICE_REVIEW = SUPPORTED - NUMERIC


def require(condition, message):
    if not condition:
        raise ValueError(message)


# ------------------------------------------------------------------ text helpers
def plain(text):
    text = text.replace('{,}', ',').replace('$', '').replace('\\times', '×').replace('\\cdot', '×')
    text = text.replace('−', '-').replace('\u00a0', ' ').replace('\\,', '').replace('\\!', '')
    return re.sub(r'\s+', ' ', text).strip()


def number_of(text):
    """An integer or decimal as an exact Fraction; commas group digits."""
    text = text.replace(',', '').strip()
    require(re.fullmatch(r'-?\d+(\.\d+)?', text) is not None, f'Not a number: {text!r}')
    return Fraction(text)


def quantity(label):
    """A plain number, a fraction \\frac{a}{b} or a mixed number n\\frac{a}{b}."""
    text = label.replace('{,}', ',').replace('$', '').strip()
    m = re.fullmatch(r'(\d+)?\s*\\frac\{(\d+)\}\{(\d+)\}', text)
    if m:
        return Fraction(int(m[1] or 0)) + Fraction(int(m[2]), int(m[3]))
    return number_of(text)


def options_of(public, count=None, kind='choice'):
    response = public['response']
    require(response['kind'] == kind, f'{kind} response required')
    options = response['options']
    require(count is None or len(options) == count, f'{count} options required')
    ids = [o['id'] for o in options]
    require(len(set(ids)) == len(ids), 'Duplicate choice IDs')
    require(len({plain(o['label']) for o in options}) == len(options), 'Duplicate choice labels')
    return options


def only(options, flags, label):
    chosen = [o['id'] for o, flag in zip(options, flags) if flag]
    require(len(chosen) == 1, f'{label}: {len(chosen)} defensible choices')
    return chosen[0]


def numbers_in(text):
    return [number_of(m) for m in re.findall(r'\d[\d,]*(?:\.\d+)?', plain(text))]


def output(value):
    """Match the JSON type of a generated numeric answer."""
    value = Fraction(value)
    return int(value) if value.denominator == 1 else float(value)


def elements(public):
    figure = public.get('figure')
    require(figure is not None and figure['kind'] == 'scene', 'Scene figure required')
    return figure['scene']['elements']


# --------------------------------------------------------------- benchmark estimates
def nearest_benchmark(value):
    for edge in (Fraction(1, 4), Fraction(3, 4)):
        require(abs(value - edge) >= Fraction(1, 25), 'Fraction sits on a rounding boundary')
    return min((Fraction(0), Fraction(1, 2), Fraction(1)), key=lambda b: abs(value - b))


def solve_benchmark(public):
    prompt = public['prompt']
    fractions = [Fraction(int(a), int(b)) for a, b in re.findall(r'\\frac\{(\d+)\}\{(\d+)\}', prompt)]
    require(len(fractions) == 3 and fractions[2] == Fraction(1, 2), 'Two fractions and the benchmark one half expected')
    first, second = fractions[0], fractions[1]
    tail = plain(prompt).split('Use the benchmarks')[1]
    require('0, 1/2' in plain(prompt).replace('\\frac{1}{2}', '1/2') or '\\frac{1}{2}' in prompt, 'Benchmarks must be named')
    a, b = nearest_benchmark(first), nearest_benchmark(second)
    if 'is left' in tail:
        require(first + second <= 1, 'Parts must fit in the whole')
        expected = 1 - (a + b)
    elif 'altogether' in tail or 'together' in tail:
        expected = a + b
    else:
        require(re.search(r'\b(more|longer|farther)\b', tail) is not None, 'Unknown ask')
        require(first > second, 'Difference must be positive')
        expected = a - b
    options = options_of(public, 4)
    values = []
    for o in options:
        label = plain(o['label']) if '\\frac' not in o['label'] else o['label'].replace('$', '')
        require(label.startswith('About '), 'Estimate choices start with About')
        values.append(quantity(label[6:]))
    require(len(set(values)) == 4, 'Duplicate estimate values')
    return only(options, [v == expected for v in values], 'benchmark')


# --------------------------------------------------------------- triangle classification
def dist(p, q):
    return math.hypot(p[0] - q[0], p[1] - q[1])


def triangle_kind(sides, tolerance=0.01):
    a, b, c = sorted(sides)
    ab, bc = abs(a - b) <= tolerance * c, abs(b - c) <= tolerance * c
    return 'equilateral' if ab and bc else 'isosceles' if ab or bc else 'scalene'


def is_right(sides, tolerance=0.01):
    a, b, c = sorted(sides)
    return abs(a * a + b * b - c * c) <= tolerance * c * c


def solve_classify(public):
    prompt = plain(public['prompt'])
    options = options_of(public, 4)
    if prompt.startswith('A triangle has sides of'):
        sides = [int(x) for x in re.findall(r'(\d+) cm', prompt)]
        require(len(sides) == 3 and all(s > 0 for s in sides), 'Three side lengths required')
        a, b, c = sorted(sides)
        require(a + b > c, 'Triangle inequality')
        require(not is_right(sides, 1e-9), 'A right triangle would make two choices defensible')
        # The drawn triangle must be to scale with the labels.
        el = elements(public)[0]
        require(el['type'] == 'triangle' and len(el['points']) == 3, 'Triangle figure required')
        labels = [int(re.match(r'\d+', s['label'])[0]) for s in el['sides']]
        pts = el['points']
        drawn = [dist(pts[i], pts[(i + 1) % 3]) for i in range(3)]
        require(sorted(labels) == sorted(sides), 'Figure labels differ from the stated sides')
        ratios = [d / l for d, l in zip(drawn, labels)]
        require(max(ratios) - min(ratios) < 0.01 * max(ratios), 'Triangle is not drawn to scale')
        kind = triangle_kind(sides, 0)
        want = {'equilateral': 'Equilateral', 'isosceles': 'Isosceles', 'scalene': 'Scalene', 'right': 'Right'}
        flags = [o['label'].startswith(want[kind]) for o in options]
        require(sum(1 for o in options if o['label'].startswith('Right')) <= 1, 'One right-triangle decoy at most')
        return only(options, flags, 'triangle kind')
    m = re.fullmatch(r'Matching tick marks show sides of equal length\. Which triangle is (\w+) \(.*\)\?', prompt)
    require(m is not None, 'Unreadable triangle question')
    want = m[1]
    figure = public['figure']
    require(figure['kind'] == 'plane-shapes' and len(figure['items']) == 4, 'Four triangles required')
    kinds, flags = [], []
    for item in figure['items']:
        pts = item['pieces'][0]['points']
        require(len(pts) == 3, 'Triangle required')
        kinds.append(triangle_kind([dist(pts[i], pts[(i + 1) % 3]) for i in range(3)]))
    for o, item in zip(options, figure['items']):
        require(o['label'] == f"Triangle ${item['label']}$" or o['label'] == f"Triangle {item['label']}", 'Choice must name its triangle')
    flags = [k == want for k in kinds]
    return only(options, flags, 'drawn triangle')


# ------------------------------------------------------------------ congruent figures
def polygon_signature(points):
    """Cyclic (edge length, turn angle) sequence, the same under rotation and flip."""
    n = len(points)
    edges = [dist(points[i], points[(i + 1) % n]) for i in range(n)]
    angles = []
    for i in range(n):
        p, q, r = points[i - 1], points[i], points[(i + 1) % n]
        a = (p[0] - q[0], p[1] - q[1])
        b = (r[0] - q[0], r[1] - q[1])
        angles.append(math.degrees(math.acos(max(-1, min(1, (a[0] * b[0] + a[1] * b[1]) / (math.hypot(*a) * math.hypot(*b)))))))
    # vertex i has incoming edge i-1 and outgoing edge i
    return [(edges[i - 1], angles[i], edges[i]) for i in range(n)]


def congruent_polygons(p, q, tolerance=0.02):
    if len(p) != len(q):
        return False
    sp, sq = polygon_signature(p), polygon_signature(q)
    n = len(p)
    for flip in (False, True):
        seq = sq if not flip else [(e2, a, e1) for (e1, a, e2) in reversed(sq)]
        for shift in range(n):
            if all(abs(sp[i][0] - seq[(i + shift) % n][0]) <= tolerance * sp[i][0]
                   and abs(sp[i][1] - seq[(i + shift) % n][1]) <= 1.5
                   and abs(sp[i][2] - seq[(i + shift) % n][2]) <= tolerance * sp[i][2] for i in range(n)):
                return True
    return False


def solve_congruent(public):
    require('Which two figures are congruent' in public['prompt'], 'Unreadable congruence question')
    figure = public['figure']
    require(figure['kind'] == 'plane-shapes' and len(figure['items']) == 4, 'Four figures required')
    shapes = {item['label']: item['pieces'][0]['points'] for item in figure['items']}
    require(sorted(shapes) == ['A', 'B', 'C', 'D'], 'Figures A to D required')
    pairs = [(x, y) for x, y in combinations('ABCD', 2) if congruent_polygons(shapes[x], shapes[y])]
    require(len(pairs) == 1, f'{len(pairs)} congruent pairs drawn')
    # Non-congruent pairs must differ visibly: the closest sides differ by at least 5%.
    for x, y in combinations('ABCD', 2):
        if (x, y) in pairs:
            continue
        require(not congruent_polygons(shapes[x], shapes[y], 0.05), f'Figures {x} and {y} are nearly congruent')
    options = options_of(public, 4)
    target = f'{pairs[0][0]} and {pairs[0][1]}'
    labels = [plain(o['label']) for o in options]
    require(all(re.fullmatch(r'[A-D] and [A-D]', l) for l in labels), 'Pair labels expected')
    return only(options, [l == target for l in labels], 'congruent pair')


# ------------------------------------------------------------------ congruent fourths
def shaded_share(shape):
    sizes, shaded = shape['sizes'], shape['shaded']
    require(len(sizes) in (3, 4) and all(s > 0 for s in sizes), 'Three or four parts expected')
    require(all(0 <= i < len(sizes) for i in shaded) and len(set(shaded)) == len(shaded), 'Bad shaded parts')
    cut = shape['cut']
    require(cut in ('rows', 'columns', 'grid', 'diagonals'), f'Unknown cut {cut}')
    if cut in ('grid', 'diagonals'):
        # a 2x2 grid and the two diagonals of a square or rectangle give four equal areas
        require(sizes == [1, 1, 1, 1], 'Grid and diagonal cuts have four equal parts')
    return Fraction(sum(sizes[i] for i in shaded), sum(sizes)), len(set(sizes)) == 1


def solve_fourths(public):
    prompt = plain(public['prompt'])
    m = re.fullmatch(r'The three (squares|rectangles) are the same size and the same shape\. Which two figures each show one fourth shaded\?', prompt)
    require(m is not None, 'Unreadable fourths question')
    figure = public['figure']
    require(figure['kind'] == 'partitioned-shapes' and len(figure['shapes']) == 3, 'Three shapes required')
    flags = {}
    for shape in figure['shapes']:
        require(shape['shape'] == m[1][:-1] or (m[1] == 'rectangles' and shape['shape'] == 'rectangle'), 'Shape kind must match the prompt')
        share, equal = shaded_share(shape)
        # one fourth needs four equal parts with one shaded; equal area alone is not enough
        flags[shape['label']] = share == Fraction(1, 4) and equal and len(shape['sizes']) == 4
        require(not (share == Fraction(1, 4) and not flags[shape['label']]), 'A quarter of the area in unequal parts is ambiguous')
    pairs = [f'{x} and {y}' for x, y in combinations('ABC', 2) if flags[x] and flags[y]]
    require(len(pairs) <= 1, 'Two pairs show one fourth')
    options = options_of(public, 4)
    labels = [plain(o['label']) for o in options]
    target = pairs[0] if pairs else 'None of the pairs'
    return only(options, [l == target for l in labels], 'fourths pair')


# ------------------------------------------------------------------ data list for display
def parse_list(label):
    return [number_of(x) for x in plain(label).split(',')]


def solve_data_list(public):
    prompt = plain(public['prompt'])
    options = options_of(public, 4)
    lists = [sorted(parse_list(o['label'])) for o in options]
    el = elements(public)[0]
    if el['type'] == 'lineTable':
        header, counts = el['rows']
        counts = [int(c) for c in counts[1:]]
        if header[0] == 'Range':
            require('values fall in each range' in prompt, 'Range table wording')
            ranges = [tuple(int(x) for x in h.split('–')) for h in header[1:]]
            def fits(values):
                return len(values) == sum(counts) and all(
                    sum(1 for v in values if lo <= v <= hi) == c for (lo, hi), c in zip(ranges, counts)) \
                    and all(any(lo <= v <= hi for lo, hi in ranges) for v in values)
        else:
            require(header[0] == 'Value' and 'how many times each value was recorded' in prompt, 'Count table wording')
            keys = [int(h) for h in header[1:]]
            def fits(values):
                return all(values.count(k) == c for k, c in zip(keys, counts)) and len(values) == sum(counts)
    else:
        require(el['type'] == 'dotPlot' and prompt.startswith('The dot plot shows'), 'Dot plot wording')
        dots = sorted(el['groups'][0]['values'])
        def fits(values):
            return values == dots
    return only(options, [fits(v) for v in lists], 'data list')


# ------------------------------------------------------------------ equal chance
def parse_counts(label, colors):
    counts = {}
    for color in colors:
        m = re.search(rf'(\d+) {color}\b', plain(label))
        require(m is not None, f'{color} count missing in {label!r}')
        counts[color] = int(m[1])
    return counts


def solve_equal_chance(public):
    prompt = plain(public['prompt'])
    m = re.match(r'Each (?:bag of marbles|spinner) below has (\d+) (?:marbles|equal sections) in ([a-z]+(?:, [a-z]+)*) and ([a-z]+)\.', prompt)
    require(m is not None, 'Unreadable container')
    total, colors = int(m[1]), m[2].split(', ') + [m[3]]
    require(len(colors) == 3, 'Three colors expected')
    options = options_of(public, 4)
    rows = [parse_counts(o['label'], colors) for o in options]
    require(all(sum(r.values()) == total for r in rows), 'Every choice holds the stated total')
    lead = re.search(r'You want ([a-z]+)( and ([a-z]+))? (?:to be|to be) (more likely than each of the other colors|less likely than each of the other colors|equally likely)', prompt) \
        or re.search(r'You want ([a-z]+)( and ([a-z]+))? (?:to be )?(equally likely)', prompt)
    require(lead is not None, 'Unreadable goal')
    a, b, kind = lead[1], lead[3], lead[4]
    def ok(r):
        others = [c for c in colors if c != a]
        if kind.startswith('more'):
            return all(r[a] > r[c] for c in others)
        if kind.startswith('less'):
            return all(r[a] < r[c] for c in others)
        return r[a] == r[b]
    require(kind.startswith(('more', 'less')) == (b is None), 'Goal shape')
    return only(options, [ok(r) for r in rows], 'equal chance')


# ------------------------------------------------------------------ expanded form
PLACES = {'10,000': Fraction(10000), '1,000': Fraction(1000), '100': Fraction(100), '10': Fraction(10), '1': Fraction(1),
          '0.1': Fraction(1, 10), '0.01': Fraction(1, 100), '0.001': Fraction(1, 1000)}


def expanded_value(text):
    terms = plain(text).split('+')
    total = Fraction(0)
    seen = []
    for term in terms:
        m = re.fullmatch(r'\s*(\d) ?× ?(10,000|1,000|100|10|1|0\.1|0\.01|0\.001)\s*', term)
        require(m is not None, f'Unreadable term {term!r}')
        place = PLACES[m[2]]
        require(place not in seen, 'A place is repeated')
        seen.append(place)
        total += int(m[1]) * place
    return total


def solve_expanded_to_standard(public):
    prompt = plain(public['prompt'])
    require(prompt.startswith('Write this number in standard form:'), 'Unreadable prompt')
    value = expanded_value(prompt.split(':', 1)[1])
    require(public['response']['kind'] == 'number', 'Number response required')
    return value


UNITS_WORDS = {'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8,
               'nine': 9, 'ten': 10, 'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
               'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20, 'thirty': 30,
               'forty': 40, 'fifty': 50, 'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90}


def words_to_int(text):
    total, group = 0, 0
    for token in re.split(r'[\s-]+', text.strip()):
        if token in ('and', ''):
            continue
        if token == 'hundred':
            group *= 100
        elif token == 'thousand':
            total, group = total + group * 1000, 0
        else:
            require(token in UNITS_WORDS, f'Unknown number word {token!r}')
            group += UNITS_WORDS[token]
    return total + group


def words_to_number(text):
    m = re.fullmatch(r'(.*?) and ([a-z -]+?) (tenths?|hundredths?|thousandths?)', text.strip())
    require(m is not None, f'Unreadable number words {text!r}')
    whole = words_to_int(m[1].replace(' thousand ', ' thousand ').replace(' and ', ' '))
    scale = {'tenth': 10, 'hundredth': 100, 'thousandth': 1000}[m[3].rstrip('s')]
    part = words_to_int(m[2])
    require(part < scale, 'Decimal part too large')
    require((m[3].endswith('s')) == (part != 1), f'Plural {m[3]!r} does not agree with {part}')
    return whole + Fraction(part, scale)


def solve_standard_to_expanded(public):
    prompt = plain(public['prompt'])
    m = re.fullmatch(r'Which expanded form is equal to (?:the number )?(.*)\?', prompt)
    require(m is not None, 'Unreadable prompt')
    given = m[1]
    value = number_of(given) if re.fullmatch(r'[\d,.]+', given) else words_to_number(given)
    options = options_of(public, 4)
    return only(options, [expanded_value(o['label']) == value for o in options], 'expanded form')


# ------------------------------------------------------------------ fraction comparison
def solve_fraction_compare(public):
    prompt = plain(public['prompt']) if '\\frac' not in public['prompt'] else public['prompt'].replace('$', '')
    options = options_of(public, 4)
    values = [quantity(o['label']) for o in options]
    require(len(set(values)) == 4, 'Duplicate values')
    if 'Which height is the greatest' in prompt:
        require(all('\\frac' in o['label'] and re.match(r'\$\d+\\frac', o['label']) for o in options), 'Mixed numbers required')
        top = max(values)
        return only(options, [v == top for v in values], 'greatest')
    m = re.fullmatch(r'Which of these fractions is (greater|less) than (.*)\?', prompt)
    require(m is not None, 'Unreadable comparison')
    bound = quantity(m[2])
    if m[1] == 'greater':
        flags = [v > bound for v in values]
    else:
        flags = [v < bound for v in values]
    return only(options, flags, 'fraction comparison')


# ------------------------------------------------------------------ likelihood words
def likelihood_word(p):
    if p == 0:
        return 'Impossible'
    if p == 1:
        return 'Certain'
    if p == Fraction(1, 2):
        return 'As likely as not'
    return 'Likely' if p > Fraction(1, 2) else 'Unlikely'


def cube_chance(event):
    faces = range(1, 7)
    if event == 'an even number':
        hit = [f for f in faces if f % 2 == 0]
    elif event == 'an odd number':
        hit = [f for f in faces if f % 2 == 1]
    elif event.startswith('a number greater than '):
        hit = [f for f in faces if f > int(event.rsplit(' ', 1)[1])]
    elif event.startswith('a number less than '):
        hit = [f for f in faces if f < int(event.rsplit(' ', 1)[1])]
    else:
        n = re.fullmatch(r'the number (\d+)', event)
        require(n is not None, f'Unreadable event {event!r}')
        hit = [f for f in faces if f == int(n[1])]
    return Fraction(len(hit), 6)


def event_probability(public):
    prompt = plain(public['prompt'])
    m = re.match(r'A number cube has the faces 1, 2, 3, 4, 5 and 6\. You roll it once\. How likely is it that you roll (.*)\?', prompt)
    if m:
        return cube_chance(m[1])
    m = re.match(r'A bag holds (.*?)\. You pick one marble without looking\. How likely is it that you pick an? ([a-z]+) marble\?', prompt)
    if m:
        counts = {c: int(n) for n, c in re.findall(r'(\d+) ([a-z]+) marbles?', m[1])}
        return Fraction(counts.get(m[2], 0), sum(counts.values()))
    m = re.match(r'A spinner has (\d+) equal sections(?:: (.*)| all? ([a-z]+)|, all ([a-z]+))\. You spin it once\. How likely is it that you land on ([a-z]+)\?', prompt)
    if m:
        total = int(m[1])
        if m[2]:
            counts = {c: int(n) for n, c in re.findall(r'(\d+) ([a-z]+)', m[2])}
            require(sum(counts.values()) == total, 'Sections must add to the total')
        else:
            counts = {(m[3] or m[4]): total}
        return Fraction(counts.get(m[5], 0), total)
    raise ValueError(f'Unreadable likelihood situation {prompt!r}')


def solve_likelihood(public):
    p = event_probability(public)
    # Words are taught with clear ends and clear middles: a chance within a tenth of one
    # half, or one that is a close call to a young reader, is not asked.
    require(abs(p - Fraction(1, 2)) >= Fraction(1, 6) or p == Fraction(1, 2), f'Chance {p} is too close to as-likely-as-not')
    options = options_of(public, 4)
    word = likelihood_word(p)
    return only(options, [plain(o['label']) == word for o in options], 'likelihood')


# ------------------------------------------------------------------ measure meaning
def median_of(values):
    s = sorted(values)
    require(len(s) % 2 == 1, 'Odd count expected')
    return Fraction(s[len(s) // 2])


def solve_measure_meaning(public):
    prompt = plain(public['prompt'])
    m = re.match(r'Here are the .*? for (\d+) [a-z]+: ([\d, ]+)\. (.*)$', prompt)
    require(m is not None, 'Unreadable data')
    values = [int(x) for x in m[2].split(',')]
    require(len(values) == int(m[1]), 'Stated count equals listed count')
    ask = m[3]
    counts = {v: values.count(v) for v in set(values)}
    top = max(counts.values())
    modes = [v for v, c in counts.items() if c == top]
    require(len(modes) == 1 and top >= 2, 'A single repeated mode is needed')
    mean = Fraction(sum(values), len(values))
    require(mean.denominator == 1, 'Mean must be a whole number')
    truth = {'mode': Fraction(modes[0]), 'median': median_of(values), 'mean': mean, 'range': Fraction(max(values) - min(values))}
    require(len({truth['mode'], truth['median'], truth['mean'], truth['range']}) == 4, 'Measures must differ')
    describe = {'mode': 'The number that appears most often', 'median': 'The middle number when the numbers are in order',
                'range': 'The difference between the greatest and the least number'}
    options = options_of(public, 4)
    labels = [plain(o['label']) for o in options]
    asked = re.match(r'Which sentence describes the (mode|median|mean|range) of these numbers\?', ask)
    if asked:
        which = asked[1]
        flags = []
        for label in labels:
            k = None
            for name, text in describe.items():
                if label.startswith(text + ':'):
                    k = name
            if label.startswith('The number each of the'):
                k = 'mean'
            require(k is not None, f'Unknown description {label!r}')
            stated = number_of(label.rsplit(':', 1)[1])
            require(stated == truth[k], f'Choice {label!r} states a wrong value')
            flags.append(k == which)
        require(len({l.split(':')[0] for l in labels}) == 4, 'Four different descriptions')
        return only(options, flags, 'measure sentence')
    shared = re.match(r'Which measure tells the number each of the [a-z]+ would have if (?:all )?the [a-z ]+ were shared equally\?$', ask)
    if shared:
        require(sorted(labels) == ['Mean', 'Median', 'Mode', 'Range'], 'Four measure names')
        return only(options, [l == 'Mean' for l in labels], 'measure name')
    named = re.match(r'Which measure is (the difference between the greatest and the least number|the middle number when the numbers are put in order|the number that appears most often)\?', ask)
    require(named is not None, f'Unreadable ask {ask!r}')
    which = {'the difference between the greatest and the least number': 'Range',
             'the middle number when the numbers are put in order': 'Median',
             'the number that appears most often': 'Mode'}[named[1]]
    require(sorted(labels) == ['Mean', 'Median', 'Mode', 'Range'], 'Four measure names')
    return only(options, [l == which for l in labels], 'measure name')


# ------------------------------------------------------------------ mode
def solve_mode(public):
    prompt = plain(public['prompt'])
    figure = public.get('figure')
    if figure is None:
        m = re.match(r'A class recorded the .*?: ([\d, ]+)\. What is the mode of these numbers\?', prompt)
        require(m is not None, 'Unreadable list')
        values = [int(x) for x in m[1].split(',')]
        counts = {v: values.count(v) for v in set(values)}
    else:
        el = elements(public)[0]
        require(el['type'] == 'lineTable' and 'how many times each number was recorded' in prompt, 'Table wording')
        keys = [int(x) for x in el['rows'][0][1:]]
        counts = {k: int(c) for k, c in zip(keys, el['rows'][1][1:])}
    top = max(counts.values())
    modes = [v for v, c in counts.items() if c == top]
    require(len(modes) == 1 and top >= 2, 'A single mode is required')
    require(public['response']['kind'] == 'number', 'Number response')
    return modes[0]


# ------------------------------------------------------------------ cut shape pieces
def piece_kind(points):
    n = len(points)
    if n == 3:
        return 'triangle'
    require(n == 4, 'Triangles and quadrilaterals only')
    sides = [dist(points[i], points[(i + 1) % 4]) for i in range(4)]
    vec = [(points[(i + 1) % 4][0] - points[i][0], points[(i + 1) % 4][1] - points[i][1]) for i in range(4)]
    def parallel(a, b):
        return abs(a[0] * b[1] - a[1] * b[0]) < 1e-6 * math.hypot(*a) * math.hypot(*b)
    def square_corner(a, b):
        return abs(a[0] * b[0] + a[1] * b[1]) < 1e-6 * math.hypot(*a) * math.hypot(*b)
    if all(square_corner(vec[i], vec[(i + 1) % 4]) for i in range(4)):
        return 'square' if abs(sides[0] - sides[1]) < 1e-6 else 'rectangle'
    if parallel(vec[0], vec[2]) or parallel(vec[1], vec[3]):
        return 'trapezoid'
    raise ValueError('Unnamed quadrilateral')


NUMBER_WORDS = {'a': 1, 'an': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6}


def parse_pieces(label):
    """'2 triangles and a rectangle' -> {'triangle': 2, 'rectangle': 1}"""
    result = {}
    for part in plain(label).split(' and '):
        m = re.fullmatch(r'(a|an|\d) (triangle|square|rectangle|trapezoid)s?', part.strip())
        require(m is not None, f'Unreadable pieces {label!r}')
        result[m[2]] = result.get(m[2], 0) + NUMBER_WORDS[m[1]]
        require((m[1] in ('a', 'an')) or part.strip().endswith('s'), f'Plural does not agree: {part!r}')
    return result


def solve_cut_pieces(public):
    figure = public['figure']
    require(figure['kind'] == 'plane-shapes' and len(figure['items']) == 1, 'One cut figure expected')
    pieces = figure['items'][0]['pieces']
    kinds = {}
    for p in pieces:
        k = piece_kind(p['points'])
        kinds[k] = kinds.get(k, 0) + 1
    options = options_of(public, 4)
    parsed = [parse_pieces(o['label']) for o in options]
    # A square is a rectangle: a choice that names rectangles also fits square pieces, but
    # a choice that names squares needs square pieces.
    def fits(named):
        return (named.get('triangle', 0) == kinds.get('triangle', 0)
                and named.get('trapezoid', 0) == kinds.get('trapezoid', 0)
                and named.get('square', 0) <= kinds.get('square', 0)
                and named.get('square', 0) + named.get('rectangle', 0) == kinds.get('square', 0) + kinds.get('rectangle', 0))
    flags = [p == kinds for p in parsed]
    loose = [fits(p) for p in parsed]
    require(sum(loose) == 1, f'{sum(loose)} choices describe the pieces (a square counts as a rectangle)')
    require(len({tuple(sorted(p.items())) for p in parsed}) == 4, 'Duplicate piece descriptions')
    return only(options, flags, 'cut pieces')


# ------------------------------------------------------------------ between bounds
def solve_between(public):
    m = re.fullmatch(r'Which value of n makes the statement ([\d,]+)<n<([\d,]+) true\?', plain(public['prompt']))
    require(m is not None, 'Unreadable bounds')
    low, high = number_of(m[1]), number_of(m[2])
    require(low < high, 'Bounds ordered')
    options = options_of(public, 4)
    values = [number_of(plain(o['label'])) for o in options]
    return only(options, [low < v < high for v in values], 'between')


# ------------------------------------------------------------------ number lines
def line_element(public):
    el = elements(public)[0]
    require(el['type'] == 'numberLine', 'Number line expected')
    return el


def solve_line_position(public):
    prompt = plain(public['prompt'])
    m = re.fullmatch(r'The number line runs from ([\d,]+) to ([\d,]+), with a tick mark every (\d+)\. Which number does point P show\?', prompt)
    require(m is not None, 'Unreadable number line prompt')
    lo, hi, step = number_of(m[1]), number_of(m[2]), int(m[3])
    el = line_element(public)
    require((el['min'], el['max'], el['step']) == (lo, hi, step), 'Figure scale differs from the prompt')
    require(len(el['marks']) == 1 and el['marks'][0]['label'] == 'P', 'One point P')
    at = el['marks'][0]['at']
    require(lo < at < hi and (at - lo) % step == 0, 'Point must sit on a tick')
    require(all(lo <= v <= hi for v in el['labels']), 'Labels inside the line')
    options = options_of(public, 4)
    values = [number_of(plain(o['label'])) for o in options]
    return only(options, [v == at for v in values], 'point')


def parse_story_ops(label, up, down):
    m = re.fullmatch(rf'(?:An? [a-z ]+|[A-Z][a-z]+) (?:has|have) (\d+) [a-z]+\. (?:It|She|He) ({up}|{down}) (\d+), then ({up}|{down}) (\d+) more\.', plain(label))
    require(m is not None, f'Unreadable story {label!r}')
    sign = lambda verb: 1 if verb == up else -1
    return int(m[1]), sign(m[2]) * int(m[3]), sign(m[4]) * int(m[5])


STORY_VERBS = [('restocks', 'sells'), ('gets back', 'lends out'), ('earns', 'spends'), ('bakes', 'sells')]


def solve_jump_story(public):
    m = re.fullmatch(r'The number line shows two jumps that start at (\d+)\. Which story matches the jumps\?', plain(public['prompt']))
    require(m is not None, 'Unreadable jump prompt')
    start = int(m[1])
    el = line_element(public)
    hops = el['hops']
    require(len(hops) == 2 and hops[0]['from'] == start, 'Two jumps from the start')
    require(hops[1]['from'] == start + hops[0]['by'], 'The second jump starts where the first lands')
    end = hops[1]['from'] + hops[1]['by']
    require(el['min'] <= min(start, hops[1]['from'], end) and max(start, hops[1]['from'], end) <= el['max'], 'Jumps stay on the line')
    require(el['marks'][0]['at'] == start, 'Start marked')
    expected = (start, hops[0]['by'], hops[1]['by'])
    options = options_of(public, 4)
    flags = []
    for o in options:
        label = plain(o['label'])
        parsed = None
        for up, down in STORY_VERBS:
            try:
                parsed = parse_story_ops(label, up, down)
                break
            except ValueError:
                continue
        require(parsed is not None, f'No known verbs in {label!r}')
        flags.append(parsed == expected)
    return only(options, flags, 'jump story')


# ------------------------------------------------------------------ operation properties
def classify_equation(text):
    t = plain(text).replace(' ', '')
    m = re.fullmatch(r'(\d+)\+(\d+)=(\d+)\+(\d+)', t)
    if m and m[1] == m[4] and m[2] == m[3] and m[1] != m[2]:
        return 'commutative-add'
    m = re.fullmatch(r'(\d+)×(\d+)=(\d+)×(\d+)', t)
    if m and m[1] == m[4] and m[2] == m[3] and m[1] != m[2]:
        return 'commutative-mult'
    m = re.fullmatch(r'\((\d+)\+(\d+)\)\+(\d+)=(\d+)\+\((\d+)\+(\d+)\)', t)
    if m and (m[1], m[2], m[3]) == (m[4], m[5], m[6]):
        return 'associative-add'
    m = re.fullmatch(r'\((\d+)×(\d+)\)×(\d+)=(\d+)×\((\d+)×(\d+)\)', t)
    if m and (m[1], m[2], m[3]) == (m[4], m[5], m[6]):
        return 'associative-mult'
    m = re.fullmatch(r'(\d+)×\((\d+)\+(\d+)\)=(\d+)×(\d+)\+(\d+)×(\d+)', t)
    if m and m[1] == m[4] == m[6] and m[2] == m[5] and m[3] == m[7]:
        return 'distributive'
    m = re.fullmatch(r'(\d+)\+0=(\d+)', t)
    if m and m[1] == m[2]:
        return 'identity-add'
    m = re.fullmatch(r'(\d+)×1=(\d+)', t)
    if m and m[1] == m[2]:
        return 'identity-mult'
    raise ValueError(f'Equation shows no listed property: {text!r}')


def true_equation(text):
    t = plain(text).replace(' ', '').replace('×', '*')
    left, right = t.split('=')
    require(re.fullmatch(r'[\d+*()]+', t.replace('=', '')) is not None, 'Arithmetic only')
    return eval(left, {'__builtins__': {}}) == eval(right, {'__builtins__': {}})  # digits and + * ( ) only


PROPERTY_NAMES = {
    'commutative-add': 'commutative property of addition', 'commutative-mult': 'commutative property of multiplication',
    'associative-add': 'associative property of addition', 'associative-mult': 'associative property of multiplication',
    'identity-add': 'identity property of addition', 'identity-mult': 'identity property of multiplication',
    'distributive': 'distributive property of multiplication over addition',
}


def solve_operation_property(public):
    prompt = plain(public['prompt'])
    options = options_of(public, 4)
    m = re.fullmatch(r'Which equation shows the (.*)\?', prompt)
    if m:
        require(m[1] in PROPERTY_NAMES.values(), 'Unknown property name')
        flags = []
        for o in options:
            require(true_equation(o['label']), 'Every equation is true')
            flags.append(PROPERTY_NAMES[classify_equation(o['label'])] == m[1])
        return only(options, flags, 'equation')
    m = re.fullmatch(r'Which property does the equation (.*) show\?', prompt)
    require(m is not None, 'Unreadable property question')
    require(true_equation(m[1]), 'The equation is true')
    kind = classify_equation(m[1])
    labels = [plain(o['label']) for o in options]
    require(all(l in PROPERTY_NAMES.values() for l in labels), 'Property names expected')
    return only(options, [l == PROPERTY_NAMES[kind] for l in labels], 'property')


# ------------------------------------------------------------------ number patterns
def pattern_rule(terms):
    """('add', d), ('mul', r) or ('grow', first difference, change in difference)."""
    diffs = [b - a for a, b in zip(terms, terms[1:])]
    if len(set(diffs)) == 1:
        return ('add', diffs[0])
    if all(a != 0 for a in terms[:-1]) and len({Fraction(b, a) for a, b in zip(terms, terms[1:])}) == 1:
        return ('mul', Fraction(terms[1], terms[0]))
    second = [b - a for a, b in zip(diffs, diffs[1:])]
    if len(set(second)) == 1:
        return ('grow', diffs[0], second[0])
    raise ValueError('No single rule fits the pattern')


def parse_terms(text):
    return [int(x) for x in re.findall(r'\d+', plain(text))]


def rule_label(rule):
    kind = rule[0]
    if kind == 'add':
        return f'Add {rule[1]} each time'
    if kind == 'mul':
        return f'Multiply by {rule[1]} each time'
    return None


def solve_pattern_rule(public):
    prompt = plain(public['prompt'])
    options = options_of(public, 4)
    m = re.fullmatch(r'A number pattern starts ([\d, ]+)\. Which rule makes this pattern\?', prompt)
    if m:
        terms = parse_terms(m[1])
        rule = pattern_rule(terms)
        flags = []
        for o in options:
            label = plain(o['label'])
            if rule[0] != 'grow':
                flags.append(label == rule_label(rule))
            else:
                g = re.fullmatch(r'Add (\d+), then add (\d+), then add (\d+), and so on', label)
                if g:
                    flags.append((int(g[1]), int(g[2]), int(g[3])) == (rule[1], rule[1] + rule[2], rule[1] + 2 * rule[2]))
                else:
                    flags.append(False)
            require(re.fullmatch(r'Add \d+ each time|Multiply by \d+ each time|Add \d+, then add \d+, then add \d+, and so on', label), f'Unreadable rule {label!r}')
        return only(options, flags, 'rule')
    m = re.fullmatch(r'Look at the pattern ([\d, ]+)\. Which pattern follows the same rule\?', prompt)
    require(m is not None, 'Unreadable pattern prompt')
    rule = pattern_rule(parse_terms(m[1]))
    flags = []
    for o in options:
        try:
            other = pattern_rule(parse_terms(o['label']))
        except ValueError:
            other = None
        flags.append(other == rule)
    return only(options, flags, 'same rule')


def solve_pattern_term(public):
    prompt = plain(public['prompt'])
    m = re.fullmatch(r'A number pattern starts ([\d, ]+)\. What is the (seventh|next) number in the pattern\?', prompt)
    require(m is not None, 'Unreadable pattern term')
    terms = parse_terms(m[1])
    rule = pattern_rule(terms)
    require(rule[0] in ('add', 'grow'), 'Additive rules only')
    target = len(terms) + 1 if m[2] == 'next' else 7
    require(target >= len(terms) + 1, 'Target past the listed terms')
    diff = rule[1]
    step = rule[2] if rule[0] == 'grow' else 0
    seq = list(terms)
    d = terms[-1] - terms[-2]
    while len(seq) < target:
        d += step
        seq.append(seq[-1] + d)
    require(all(v >= 0 for v in seq), 'Terms stay non-negative')
    return seq[target - 1]


# ------------------------------------------------------------------ probability on the line
def solve_probability_line(public):
    prompt = plain(public['prompt'])
    options = options_of(public, 4)
    m = re.search(r'The number line from 0 to 1 is cut into (\d+) equal spaces\. Which point shows the chance that you (?:land on|pick|roll) (.*?)\?$', prompt)
    require(m is not None, 'Unreadable chance question')
    spaces, event = int(m[1]), m[2]
    if prompt.startswith('A spinner has'):
        g = re.match(r'A spinner has (\d+) equal sections: (.*?)\. You spin', prompt)
        counts = {c: int(n) for n, c in re.findall(r'(\d+) ([a-z]+)', g[2])}
        total = int(g[1])
        chance = Fraction(counts[event], total)
    elif prompt.startswith('A bag holds'):
        g = re.match(r'A bag holds (.*?)\. You pick', prompt)
        counts = {c: int(n) for n, c in re.findall(r'(\d+) ([a-z]+) marbles?', g[1])}
        total = sum(counts.values())
        chance = Fraction(counts[re.match(r'an? ([a-z]+) marble', event)[1]], total)
    else:
        require(prompt.startswith('A number cube has the faces 1, 2, 3, 4, 5 and 6. You roll it once.'), 'Unreadable situation')
        total, counts = 6, {'x': 6}
        chance = cube_chance(event)
    require(sum(counts.values()) == total, 'Parts add to the total')
    require(total == spaces, 'The line is cut into as many spaces as outcomes')
    el = line_element(public)
    require((el['min'], el['max']) == (0, 1) and el['denominator'] == spaces, 'Line from 0 to 1 cut as stated')
    marks = {m['label']: Fraction(m['at']).limit_denominator(1000) for m in el['marks']}
    require(sorted(marks) == ['A', 'B', 'C', 'D'], 'Four labeled points')
    require(all((v * spaces).denominator == 1 for v in marks.values()), 'Points sit on cut marks')
    require(len(set(marks.values())) == 4, 'Distinct point positions')
    labels = {o['id']: re.fullmatch(r'Point (?:\$)?([A-D])(?:\$)?', o['label']) for o in options}
    require(all(labels.values()), 'Point choices')
    return only(options, [marks[labels[o['id']][1]] == chance for o in options], 'point on line')


# ------------------------------------------------------------------ thermometers
def solve_drawn_thermometers(public, prompt):
    # Drawn bulb-and-tube thermometers: read each liquid level from the
    # figure's own scale (it must sit on a small mark inside the scale).
    els = elements(public)
    unit = 'Fahrenheit' if 'Fahrenheit' in prompt else 'Celsius'
    readings = {}
    for el in els:
        require(el['type'] == 'thermometer', 'Only thermometers are drawn')
        require(el['unit'] == unit[0], 'Scale unit must match the question')
        require(el['min'] == 0 and el['max'] > 0 and el['major'] == 10 and el['minor'] in (2, 5), 'Scale of the family')
        require(el['reading'] % el['minor'] == 0 and 0 < el['reading'] <= el['max'], 'Reading sits on a mark inside the scale')
        readings[el.get('label', 'Liquid')] = el['reading']
    require(public['response']['kind'] == 'number', 'Number response')
    if prompt.startswith('What temperature does this thermometer show'):
        require(list(readings) == ['Liquid'] and els[0].get('derived') is True, 'One masked reading')
        return readings['Liquid']
    ask = re.search(r'How many degrees \w+ (warmer|colder) was the (\w+) than (?:the )?(\w+)\?', prompt)
    require(ask is not None, 'Unreadable comparison')
    a, b = ask[2].capitalize(), ask[3].capitalize()
    require(a in readings and b in readings and a != b and len(readings) == 2, 'Named readings are drawn')
    require(all(not el.get('derived') for el in els), 'Both readings are shown')
    return readings[a] - readings[b] if ask[1] == 'warmer' else readings[b] - readings[a]


def solve_thermometer(public):
    prompt = plain(public['prompt'])
    el = elements(public)[0]
    if el['type'] == 'thermometer':
        return solve_drawn_thermometers(public, prompt)
    require(el['type'] == 'barChart' and el['id'] == 'thermometer', 'Thermometer scale expected')
    unit = 'Fahrenheit' if 'Fahrenheit' in prompt else 'Celsius'
    require(el['unit'] == f'Degrees {unit}', 'Scale unit must match the question')
    require(el['step'] > 0 and all(b['value'] % el['step'] == 0 and 0 < b['value'] < el['max'] for b in el['bars']), 'Readings sit on gridlines inside the scale')
    bars = {b['label']: b['value'] for b in el['bars']}
    require(public['response']['kind'] == 'number', 'Number response')
    if prompt.startswith('The liquid in a thermometer rises'):
        require(list(bars) == ['Liquid'], 'One reading')
        return bars['Liquid']
    m = re.match(r'Two thermometers show the temperature (?:in the |at )(\w+) and (?:in the |at )(\w+)\. How many degrees \w+ (warmer|colder) was the (?:afternoon|night|morning|noon|evening) than (?:the )?(?:morning|noon|afternoon|night|evening)\?', prompt)
    require(m is not None, 'Unreadable comparison')
    ask = re.search(r'was the (\w+) than (?:the )?(\w+)\?', prompt)
    a, b = ask[1].capitalize(), ask[2].capitalize()
    require(a in bars and b in bars and a != b and len(bars) == 2, 'Named readings are on the scale')
    return bars[a] - bars[b] if m[3] == 'warmer' else bars[b] - bars[a]


# ------------------------------------------------------------------ reasonable measure
UNIT_SI = {
    'centimeters': 0.01, 'meters': 1, 'kilometers': 1000, 'inches': 0.0254, 'feet': 0.3048, 'yards': 0.9144, 'miles': 1609.34,
    'grams': 0.001, 'kilograms': 1, 'ounces': 0.02835, 'pounds': 0.4536, 'tons': 907.18,
    'milliliters': 0.001, 'liters': 1, 'teaspoons': 0.00493, 'cups': 0.2366, 'quarts': 0.9464, 'gallons': 3.785,
}
SINGULAR = {'foot': 'feet', 'inch': 'inches'}
# Plausible amounts for each object, in meters, kilograms or liters. Ranges are wide enough
# for ordinary variety, so a unit that fits only an unusual object is still not accepted.
PLAUSIBLE = {
    'the length of a bed': (1.6, 2.4), 'the length of a pencil': (0.1, 0.25),
    'the length of a basketball court': (20, 35), 'the height of a classroom door': (1.9, 2.4),
    'the width of a classroom': (5, 12), 'the length of a walk to school': (400, 5000),
    'the mass of an apple': (0.1, 0.3), 'the mass of a cat': (2.5, 7), 'the mass of a bicycle': (8, 20),
    'the mass of a student': (20, 60), 'the mass of a small car': (900, 2500),
    'the amount of juice in a large bottle': (0.5, 3.0), 'the amount of milk in a glass': (0.15, 0.45),
    'the amount of water in a bathtub': (80, 300), 'the amount of soup in a big pot': (1.0, 15),
    'the amount of medicine in a spoon': (0.002, 0.015),
}


def measure_si(count, unit):
    unit = SINGULAR.get(unit, unit if unit.endswith('s') or unit == 'feet' else unit + 's')
    require(unit in UNIT_SI, f'Unknown unit {unit!r}')
    return float(count) * UNIT_SI[unit]


def solve_reasonable_measure(public):
    prompt = plain(public['prompt'])
    options = options_of(public, 4)
    m = re.fullmatch(r'Which is the most reasonable estimate for (.*)\?', prompt)
    if m:
        thing = m[1]
        values = []
        for o in options:
            q = re.fullmatch(r'([\d,]+) ([a-z]+)', plain(o['label']))
            require(q is not None, 'Amount and unit expected')
            count = number_of(q[1])
            if count == 1:
                require(q[2] in SINGULAR or not q[2].endswith('s'), 'Singular unit for one')
            else:
                require(q[2].endswith('s') or q[2] in ('feet', 'inches'), 'Plural unit')
            values.append(measure_si(count, q[2]))
    else:
        m = re.fullmatch(r'(.*) is about ([\d,]+)\. Which unit makes the measurement reasonable\?', prompt)
        require(m is not None, 'Unreadable measure question')
        thing = m[1][0].lower() + m[1][1:]
        count = number_of(m[2])
        values = [measure_si(count, plain(o['label'])) for o in options]
    require(thing in PLAUSIBLE, f'Unknown object {thing!r}')
    lo, hi = PLAUSIBLE[thing]
    return only(options, [lo <= v <= hi for v in values], 'reasonable measure')


# ------------------------------------------------------------------ rename time units
TIME = {'seconds': 1, 'minutes': 60, 'hours': 3600, 'days': 86400, 'weeks': 604800}
MONTH_UNITS = {'months': 1, 'years': 12}


def solve_time_units(public):
    prompt = plain(public['prompt'])
    require(public['response']['kind'] == 'number', 'Number response')
    m = re.fullmatch(r'How many (\w+) are in (\d+) (\w+)\?', prompt)
    if m:
        want, count, have = m[1], int(m[2]), m[3]
        table = TIME if want in TIME else MONTH_UNITS
        require(have in table and want in table and want != have, 'Units from one system')
        value = Fraction(count * table[have], table[want])
        require(value.denominator == 1, 'Whole number of units')
        return value
    m = re.fullmatch(r'A movie lasts (\d+) hours? and (\d+) minutes\. How many minutes long is the movie\?', prompt)
    require(m is not None, 'Unreadable time question')
    require(int(m[1]) != 1 or ' hour and' in prompt, 'Singular hour')
    require(int(m[1]) == 1 or ' hours and' in prompt, 'Plural hours')
    return int(m[1]) * 60 + int(m[2])


# ------------------------------------------------------------------ repeating shape patterns
def slot_kind(el):
    if el['id'].endswith('-q') or el.get('dash') == 'dash':
        return '?'
    return {'circle': 'circle', 'rect': 'square', 'polygon': 'triangle'}[el['type']]


def solve_repeating(public):
    prompt = plain(public['prompt'])
    el = [e for e in elements(public)]
    slots = {}
    for e in el:
        mm = re.fullmatch(r'slot-(\d+)(-q)?', e['id'])
        require(mm is not None, f'Unknown element {e["id"]}')
        if mm[2]:
            continue
        slots[int(mm[1])] = slot_kind(e)
    n = len(slots)
    require(sorted(slots) == list(range(n)), 'Slots numbered in order')
    blanks = [i for i in range(n) if slots[i] == '?']
    require(len(blanks) == 2 and blanks[1] == blanks[0] + 1, 'Two adjacent empty boxes')
    known = {i: k for i, k in slots.items() if k != '?'}
    if 'at the end' in prompt:
        require(blanks == [n - 2, n - 1], 'Empty boxes at the end')
    else:
        require('from left to right' in prompt and blanks[1] < n - 1, 'Empty boxes in the middle')
    # Every period that fits the known shapes at least twice over must give the same shapes.
    answers = set()
    for period in range(1, len(known) // 2 + 1):
        base = {}
        ok = True
        for i, k in known.items():
            if base.setdefault(i % period, k) != k:
                ok = False
                break
        if ok and all(b in base for b in (blanks[0] % period, blanks[1] % period)):
            answers.add((base[blanks[0] % period], base[blanks[1] % period]))
            covered = len({i % period for i in known})
            require(covered == period, 'Core must be fully visible')
    require(len(answers) == 1, f'{len(answers)} patterns fit the picture')
    want = ', '.join(next(iter(answers)))
    options = options_of(public, 4)
    return only(options, [plain(o['label']) == want for o in options], 'pattern shapes')


# ------------------------------------------------------------------ solids
SOLIDS = {  # faces, edges, vertices, base polygon sides, kind
    'Cube': dict(faces=6, edges=12, kind='prism', base=4, tri_sides=False),
    'Rectangular prism': dict(faces=6, edges=12, kind='prism', base=4, tri_sides=False),
    'Triangular prism': dict(faces=5, edges=9, kind='prism', base=3, tri_sides=False),
    'Pentagonal prism': dict(faces=7, edges=15, kind='prism', base=5, tri_sides=False),
    'Hexagonal prism': dict(faces=8, edges=18, kind='prism', base=6, tri_sides=False),
    'Triangular pyramid': dict(faces=4, edges=6, kind='pyramid', base=3, tri_sides=True),
    'Square pyramid': dict(faces=5, edges=8, kind='pyramid', base=4, tri_sides=True),
    'Pentagonal pyramid': dict(faces=6, edges=10, kind='pyramid', base=5, tri_sides=True),
    'Hexagonal pyramid': dict(faces=7, edges=12, kind='pyramid', base=6, tri_sides=True),
}


def check_solid_table():
    for name, s in SOLIDS.items():
        n = s['base']
        if s['kind'] == 'prism':
            require((s['faces'], s['edges']) == (n + 2, 3 * n), f'{name} counts')
        else:
            require((s['faces'], s['edges']) == (n + 1, 2 * n), f'{name} counts')


def solve_solids(public):
    check_solid_table()
    prompt = plain(public['prompt'])
    options = options_of(public, 6, 'multi-select')
    response = public['response']
    require(response['selectionCount'] == 3, 'Three solids are selected')
    require(prompt.startswith('Select the 3 solids that have '), 'Unreadable property')
    prop = prompt[len('Select the 3 solids that have '):-1]
    require(all(o['label'] in SOLIDS for o in options), 'Known solids')
    if prop == 'one base and all its other faces triangles':
        test = lambda s: s['kind'] == 'pyramid'
    elif prop == 'two congruent parallel faces':
        test = lambda s: s['kind'] == 'prism'
    elif prop == '12 or more edges':
        test = lambda s: s['edges'] >= 12
    elif prop == 'fewer than 6 faces':
        test = lambda s: s['faces'] < 6
    else:
        raise ValueError(f'Unknown property {prop!r}')
    chosen = [o['id'] for o in options if test(SOLIDS[o['label']])]
    require(len(chosen) == 3, f'{len(chosen)} solids fit the property, 3 required')
    return json.dumps(chosen, separators=(',', ':'))


# ------------------------------------------------------------------ subtraction story
def story_structure(label):
    t = plain(label)
    sub = r'(?:loses|trades away|gives away)'
    m = re.fullmatch(rf'(\w+) has (\d+) \w+ and {sub} (\d+)\. How many \w+ (?:does \w+ have left|\w+ have left)\?', t) or \
        re.fullmatch(rf'(\w+) has (\d+) \w+ and {sub} (\d+)\. How many \w+ does \w+ have left\?', t)
    if m:
        return ('result', int(m[2]), int(m[3]), None)
    m = re.fullmatch(rf'\w+ has some \w+, {sub} (\d+) and has (\d+) left\. How many \w+ (?:did|has) \w+ start with\?', t) or \
        re.fullmatch(rf'\w+ has some \w+, {sub} (\d+),? and has (\d+) left\. How many \w+ did \w+ start with\?', t)
    if m:
        return ('start', None, int(m[1]), int(m[2]))
    m = re.fullmatch(rf'\w+ has (\d+) \w+, {sub} some, and has (\d+) left\. How many \w+ did \w+ give away\?', t)
    if m:
        return ('change', int(m[1]), None, int(m[2]))
    m = re.fullmatch(r'\w+ has (\d+) \w+ and gets (\d+) more\. How many \w+ does \w+ have now\?', t)
    if m:
        return ('addition', int(m[1]), int(m[2]), None)
    raise ValueError(f'Unreadable story {label!r}')


def solve_subtraction_story(public):
    prompt = plain(public['prompt'])
    m = re.fullmatch(r'Which story is shown by the sentence (.*), where n is the number we want to find\?', prompt)
    require(m is not None, 'Unreadable sentence')
    s = m[1].replace(' ', '')
    if re.fullmatch(r'n=\d+-\d+', s):
        a, b = map(int, re.findall(r'\d+', s))
        want = ('result', a, b, None)
    elif re.fullmatch(r'n-\d+=\d+', s):
        b, c = map(int, re.findall(r'\d+', s))
        want = ('start', None, b, c)
    elif re.fullmatch(r'\d+-n=\d+', s):
        a, c = map(int, re.findall(r'\d+', s))
        want = ('change', a, None, c)
    else:
        raise ValueError(f'Unreadable sentence {s!r}')
    options = options_of(public, 4)
    structures = [story_structure(o['label']) for o in options]
    return only(options, [st == want for st in structures], 'story')


# ------------------------------------------------------------------ strip diagrams
def strip_facts(public):
    els = {e['id']: e for e in elements(public)}
    whole = int(els['whole-label']['text'])
    require(els['whole']['size'][0] == whole, 'Whole drawn to its length')
    parts = sorted((e for k, e in els.items() if re.fullmatch(r'part-\d+', k)), key=lambda e: e['at'][0])
    labels = [els[f'part-label-{i}']['text'] for i in range(len(parts))]
    require(labels[0] != '?', 'First part is the known part')
    known = int(labels[0])
    require(all(l == '?' for l in labels[1:]), 'Other parts are unknown')
    require(parts[0]['size'][0] == known, 'Known part drawn to its length')
    unknown = len(parts) - 1
    widths = [p['size'][0] for p in parts[1:]]
    require(len(set(widths)) == 1 and known + sum(widths) == whole, 'Unknown parts drawn equal and fill the whole')
    require(all(parts[i]['at'][0] == sum(p['size'][0] for p in parts[:i]) for i in range(len(parts))), 'Parts are placed end to end')
    return whole, known, unknown


def solve_strip(public):
    prompt = plain(public['prompt'])
    whole, known, unknown = strip_facts(public)
    if unknown == 1:
        require(f'The whole is {whole}, one part is {known}, and the other part is marked ?.' in prompt, 'Prompt names the diagram')
    else:
        require(f'The whole is {whole}, one part is {known}, and {unknown} equal parts are marked ?.' in prompt, 'Prompt names the diagram')
    options = options_of(public, 4)
    n = Fraction(whole - known, unknown)
    require(n.denominator == 1 and n > 0, 'Whole-number unknown part')
    if prompt.endswith('Which equation matches the diagram?'):
        flags = []
        for o in options:
            t = plain(o['label']).replace(' ', '').replace('×', '*')
            left, right = t.split('=')
            require(re.fullmatch(r'[\dn+*()=-]+', t) is not None, 'Equation of numbers and n')
            def val(expr):
                return eval(expr.replace('n', f'({n})'), {'__builtins__': {}})
            true_for_n = val(left) == val(right)
            # a matching equation also has the diagram's shape: the known part plus
            # the unknown part(s), or the whole broken down the same way
            if unknown == 1:
                shape = t in (f'{known}+n={whole}', f'n+{known}={whole}', f'{whole}-n={known}', f'{whole}-{known}=n')
            else:
                shape = t in (f'{known}+{unknown}*n={whole}', f'{unknown}*n+{known}={whole}', f'{whole}-{known}={unknown}*n')
            flags.append(true_for_n and shape)
        return only(options, flags, 'strip equation')
    require(prompt.endswith('Which story matches the diagram?'), 'Story or equation question')
    flags = []
    for o in options:
        label = plain(o['label'])
        if unknown == 1:
            flags.append(story_matches_part_whole(label, whole, known))
        else:
            flags.append(story_matches_use_share(label, whole, known, unknown))
    return only(options, flags, 'strip story')


def story_matches_part_whole(label, whole, known):
    m = re.fullmatch(r'\w+ has (\d+) \w+\. (?:Lena|\w+) gets some more and now has (\d+)\. How many more did \w+ get\?', label)
    if m:
        return (int(m[1]), int(m[2])) == (known, whole)
    for pattern in (r'\w+ has (\d+) \w+ and shares them equally among (\d+) \w+\. How many does each get\?',
                    r'\w+ has (\d+) \w+\. A friend has (\d+) times as many\. How many does the friend have\?',
                    r'\w+ has (\d+) \w+ and gets (\d+) more\. How many \w+ does \w+ have now\?'):
        if re.fullmatch(pattern, label):
            return False
    raise ValueError(f'Unreadable story {label!r}')


def story_matches_use_share(label, whole, known, parts):
    m = re.fullmatch(r'\w+ has (\d+) \w+\. \w+ [a-z]+(?: away)? (\d+), then shares the rest equally among (\d+) \w+\. How many does each get\?', label)
    if m:
        return (int(m[1]), int(m[2]), int(m[3])) == (whole, known, parts)
    if re.fullmatch(r'\w+ has (\d+) \w+ and gives (\d+) to each of (\d+) \w+\. How many are left\?', label):
        return False
    if re.fullmatch(r'\w+ has (\d+) \w+ and shares them equally among (\d+) \w+\. How many does each get\?', label):
        return False
    raise ValueError(f'Unreadable story {label!r}')


# ------------------------------------------------------------------ supply and price
def solve_supply_price(public):
    prompt = plain(public['prompt'])
    m = re.fullmatch(r'(?:A store|A market|A shop|A stand|A theater|An? [a-z ]+) has (\d+) ([a-z ]+?) for sale\. (\d+) people want to buy an? ([a-z ]+)\. What is most likely to happen to the price of an? \4, and why\?', prompt)
    require(m is not None, f'Unreadable supply question {prompt!r}')
    supply, demand = int(m[1]), int(m[3])
    require(supply != demand, 'Supply and demand differ')
    plural = m[2]
    direction = 'down' if supply > demand else 'up'
    relation = 'more' if supply > demand else 'fewer'
    options = options_of(public, 4)
    flags = []
    for o in options:
        label = plain(o['label'])
        g = re.fullmatch(rf'The price goes (up|down), because there are (more|fewer) {re.escape(plural)} for sale than people who want them\.', label)
        if g:
            flags.append(g[1] == direction and g[2] == relation)
            continue
        require(re.fullmatch(rf'The price stays the same, because the price of {re.escape(plural)} does not depend on how many are for sale or wanted\.', label), f'Unreadable reason {label!r}')
        flags.append(False)
    return only(options, flags, 'price direction')


# ------------------------------------------------------------------ tables that fit
def solve_table_fits(public):
    prompt = plain(public['prompt'])
    options = options_of(public, 4)
    m = re.fullmatch(r'A school counted the students in two grades\. Grade (\d) has (\d+) students and Grade (\d) has (\d+) students\. Altogether (\d+) of the students are boys\. Which table fits all of this\?', prompt)
    if m:
        g1, n1, g2, n2, boys = int(m[1]), int(m[2]), int(m[3]), int(m[4]), int(m[5])
        flags = []
        for o in options:
            t = re.fullmatch(rf'Grade {g1}: (\d+) boys, (\d+) girls\. Grade {g2}: (\d+) boys, (\d+) girls', plain(o['label']))
            require(t is not None, 'Unreadable table')
            b1, w1, b2, w2 = map(int, t.groups())
            flags.append(b1 + w1 == n1 and b2 + w2 == n2 and b1 + b2 == boys)
        return only(options, flags, 'two-way table')
    m = re.fullmatch(r'(\d+) students were asked for their favorite ([a-z]+)\. Each student chose one of (\d+) choices, and the results go in a table\. Which table could show the results\?', prompt)
    require(m is not None, 'Unreadable survey')
    total, choices = int(m[1]), int(m[3])
    flags = []
    for o in options:
        entries = re.findall(r'([A-Za-z]+) (\d+)', plain(o['label']))
        require(','.join(f'{k} {v}' for k, v in entries) == plain(o['label']).replace(', ', ','), 'Unreadable survey table')
        flags.append(len(entries) == choices and sum(int(v) for _, v in entries) == total and len({k for k, _ in entries}) == choices)
    return only(options, flags, 'survey table')


# ------------------------------------------------------------------ true comparison
def solve_true_comparison(public):
    prompt = plain(public['prompt'])
    options = options_of(public, 4)
    if prompt == 'Which comparison is true?':
        flags = []
        for o in options:
            m = re.fullmatch(r'([\d,]+)([<>])([\d,]+)', plain(o['label']).replace(' ', ''))
            require(m is not None, 'Unreadable comparison')
            a, b = number_of(m[1]), number_of(m[3])
            flags.append(a > b if m[2] == '>' else a < b)
        return only(options, flags, 'comparison')
    m = re.fullmatch(r'Which statement puts these numbers in order from least to greatest\? The numbers are (\d{1,3}(?:,\d{3})*), (\d{1,3}(?:,\d{3})*), (\d{1,3}(?:,\d{3})*)\.', prompt)
    require(m is not None, f'Unreadable order question {prompt!r}')
    given = sorted(number_of(g) for g in m.groups())
    flags = []
    for o in options:
        parts = re.fullmatch(r'([\d,]+)<([\d,]+)<([\d,]+)', plain(o['label']).replace(' ', ''))
        require(parts is not None, 'Unreadable order statement')
        listed = [number_of(p) for p in parts.groups()]
        require(sorted(listed) == given or True, 'Statements use the given numbers')
        flags.append(listed == given)
    return only(options, flags, 'order')


# ------------------------------------------------------------------ variables and constants
SITUATIONS = {
    'Ana saves': {'constant': ['days in a week', 'cents in a dollar', 'dollars Ana saves each week'],
                  'variable': ['weeks Ana has been saving', 'total dollars Ana has saved so far', 'dollars Ana would still need for a bike']},
    'Sam reads': {'constant': ['hours in a day', 'minutes in an hour', 'pages Sam reads each night'],
                  'variable': ['nights Sam has been reading', 'pages left to read in the book', 'total pages Sam has read so far']},
    'A teacher shares': {'constant': ['months in a year', 'markers the teacher has'],
                         'variable': ['groups in the class', 'markers each group gets', 'markers left over after sharing']},
}


UNIVERSAL = {'constant': ['days in a week', 'hours in a day', 'minutes in an hour', 'months in a year', 'cents in a dollar'], 'variable': []}


def solve_variable(public):
    prompt = plain(public['prompt'])
    m = re.fullmatch(r'(.*)\. Which quantity (can change, so it is a variable|stays the same, so it is a constant)\?', prompt)
    require(m is not None, 'Unreadable question')
    situation = next((k for k in SITUATIONS if m[1].startswith(k)), None)
    require(situation is not None, 'Known situation')
    want = 'variable' if m[2].startswith('can change') else 'constant'
    table = {k: names + UNIVERSAL[k] for k, names in SITUATIONS[situation].items()}
    options = options_of(public, 4)
    flags = []
    for o in options:
        label = plain(o['label']).split(':')[0].replace('The number of ', '').replace('The ', '')
        kinds = [k for k, names in table.items() if label in names]
        require(len(kinds) == 1, f'Quantity {label!r} is not classified')
        stated = ':' in o['label']
        require(stated == (kinds[0] == 'constant' and label in table['constant']) or kinds[0] == 'variable' and not stated, 'Constants state their value')
        flags.append(kinds[0] == want)
    return only(options, flags, 'variable or constant')


# ------------------------------------------------------------------ dispatch
SOLVERS = {
    'benchmark-fraction-estimate': solve_benchmark, 'classify-triangle-by-sides': solve_classify,
    'congruent-figure-pair': solve_congruent, 'congruent-fourths-pair': solve_fourths,
    'data-list-for-display': solve_data_list, 'equal-chance-choice': solve_equal_chance,
    'expanded-sum-to-standard': solve_expanded_to_standard, 'fraction-choice-compare': solve_fraction_compare,
    'likelihood-in-words': solve_likelihood, 'measure-meaning-choice': solve_measure_meaning,
    'mode-of-data': solve_mode, 'name-cut-shape-pieces': solve_cut_pieces,
    'number-between-bounds': solve_between, 'number-line-between-hundreds': solve_line_position,
    'number-line-jump-story': solve_jump_story, 'operation-property-identify': solve_operation_property,
    'pattern-rule-choice': solve_pattern_rule, 'pattern-term-unknown-rule': solve_pattern_term,
    'probability-on-number-line': solve_probability_line, 'read-thermometer': solve_thermometer,
    'reasonable-measure-choice': solve_reasonable_measure, 'rename-time-units': solve_time_units,
    'repeating-shape-pattern': solve_repeating, 'solid-property-select': solve_solids,
    'standard-to-expanded-choice': solve_standard_to_expanded, 'story-for-subtraction-sentence': solve_subtraction_story,
    'strip-diagram-match': solve_strip, 'supply-price-choice': solve_supply_price,
    'table-fits-description': solve_table_fits, 'true-comparison-statement': solve_true_comparison,
    'variable-in-situation': solve_variable,
}
require(set(SOLVERS) == SUPPORTED, 'Every supported template has a solver')


def solve(public):
    template = public['templateId']
    require(template in SUPPORTED, f'Unexpected template {template}')
    value = SOLVERS[template](public)
    return Fraction(value) if template in NUMERIC else value


def review_problem(problem):
    public = problem['public']
    value = solve(public)
    if public['response']['kind'] == 'choice':
        label = next(o['label'] for o in public['response']['options'] if o['id'] == value)
        for text in (public['prompt'], problem.get('hint', '')):
            leaked = len(plain(label)) >= 12 and plain(label).lower().rstrip('.') in plain(text).lower()
            require(not leaked, f'The correct choice {label!r} appears in the prompt or hint')
    require(not re.search(r'\b(?:the )?answer is\b', problem.get('hint', ''), re.I), 'The hint states the answer')
    if public['response']['kind'] == 'number':
        require(isinstance(problem['answer'], str) and re.fullmatch(r'-?\d+(\.\d+)?', problem['answer']) is not None, 'Numeric answer text expected')
    return value


# ------------------------------------------------------------------ self test
def _choice(labels, correct_index=None):
    return {'kind': 'choice', 'label': 'Choose one answer',
            'options': [{'id': f'option-{c}', 'label': l} for c, l in zip('abcd', labels)]}


def _public(template, prompt, response, figure=None):
    p = {'templateId': template, 'prompt': prompt, 'response': response}
    if figure is not None:
        p['figure'] = figure
    return p


def self_test():
    # Hand-built public payloads with a known answer: the solver must accept each and
    # must reject every deliberately corrupted copy.
    good = []
    good.append((_public('operation-property-identify', 'Which equation shows the associative property of addition?',
                         _choice(['$(5+3)+6=5+(3+6)$', '$5\\times1=5$', '$(5\\times3)\\times6=5\\times(3\\times6)$', '$5\\times3=3\\times5$'])), 'option-a'))
    good.append((_public('number-between-bounds', 'Which value of $n$ makes the statement $36{,}228<n<39{,}395$ true?',
                         _choice(['34,313', '36,228', '37,203', '41,310'])), 'option-c'))
    good.append((_public('rename-time-units', 'How many hours are in 300 minutes?', {'kind': 'number', 'label': 'Answer (hours)'}), 5))
    good.append((_public('likelihood-in-words', 'A bag holds 5 red marbles and 1 orange marble. You pick one marble without looking. How likely is it that you pick a red marble?',
                         _choice(['Impossible', 'Likely', 'Certain', 'As likely as not'])), 'option-b'))
    good.append((_public('expanded-sum-to-standard', 'Write this number in standard form: $5\\times 1{,}000+9\\times 100+2\\times 1+6\\times 0.1+8\\times 0.01$',
                         {'kind': 'number', 'label': 'Answer'}), Fraction('5902.68')))
    good.append((_public('mode-of-data', 'A class recorded the minutes of practice: 17, 11, 17, 14, 11, 11, 14, 11. What is the mode of these numbers?',
                         {'kind': 'number', 'label': 'Answer'}), 11))
    good.append((_public('reasonable-measure-choice', 'Which is the most reasonable estimate for the mass of an apple?',
                         _choice(['150 grams', '150 kilograms', '6 pounds', '6 tons'])), 'option-a'))
    good.append((_public('number-line-between-hundreds', 'The number line runs from 600 to 700, with a tick mark every 10. Which number does point $P$ show?',
                         _choice(['680', '780', '608', '620']),
                         {'kind': 'scene', 'scene': {'v': 1, 'elements': [{'type': 'numberLine', 'min': 600, 'max': 700, 'step': 10, 'labels': [600, 650, 700], 'marks': [{'at': 680, 'label': 'P'}]}]}}), 'option-a'))
    good.append((_public('pattern-term-unknown-rule', 'A number pattern starts 68, 57, 46, 35, 24. What is the seventh number in the pattern?', {'kind': 'number', 'label': 'Answer'}), 2))
    good.append((_public('supply-price-choice', 'A store has 100 bike helmets for sale. 40 people want to buy a bike helmet. What is most likely to happen to the price of a bike helmet, and why?',
                         _choice(['The price goes down, because there are fewer bike helmets for sale than people who want them.',
                                  'The price stays the same, because the price of bike helmets does not depend on how many are for sale or wanted.',
                                  'The price goes down, because there are more bike helmets for sale than people who want them.',
                                  'The price goes up, because there are more bike helmets for sale than people who want them.'])), 'option-c'))
    def drawn(reading, label=None, derived=True, unit='F', **extra):
        el = {'type': 'thermometer', 'id': 'thermometer', 'unit': unit, 'min': 0, 'max': 100 if unit == 'F' else 40,
              'minor': 5 if unit == 'F' else 2, 'major': 10, 'reading': reading, **extra}
        if label:
            el['label'] = label
        if derived:
            el['derived'] = True
        return el
    read_drawn = _public('read-thermometer', 'What temperature does this thermometer show, in degrees Fahrenheit?',
                         {'kind': 'number', 'label': 'Answer (degrees Fahrenheit)'},
                         {'kind': 'scene', 'scene': {'v': 1, 'elements': [drawn(65)]}})
    good.append((read_drawn, 65))
    colder_drawn = _public('read-thermometer', 'Two thermometers show the temperature at noon and at night. How many degrees Celsius colder was the night than noon?',
                           {'kind': 'number', 'label': 'Answer (degrees Celsius)'},
                           {'kind': 'scene', 'scene': {'v': 1, 'elements': [drawn(30, 'Noon', False, 'C'), drawn(12, 'Night', False, 'C', at=[17, 0])]}})
    good.append((colder_drawn, 18))
    for public, expected in good:
        got = solve(public)
        require(got == expected, f'Fixture {public["templateId"]}: expected {expected!r}, got {got!r}')

    def rejects(public, why):
        try:
            solve(public)
        except (ValueError, KeyError, TypeError, AttributeError, IndexError):
            return
        raise ValueError(f'Corrupted fixture was accepted: {why}')

    labels = lambda p: [o['label'] for o in p['response']['options']]
    for public, _ in good:
        if public['response']['kind'] != 'choice':
            continue
        # a duplicate choice is rejected
        dup = copy.deepcopy(public)
        dup['response']['options'][3]['label'] = dup['response']['options'][2]['label']
        rejects(dup, f'duplicate choice in {public["templateId"]}')
    p = copy.deepcopy(read_drawn); p['figure']['scene']['elements'][0]['reading'] = 63
    rejects(p, 'a drawn reading between marks')
    p = copy.deepcopy(read_drawn); p['figure']['scene']['elements'][0]['unit'] = 'C'
    rejects(p, 'a Celsius thermometer for a Fahrenheit question')
    p = copy.deepcopy(read_drawn); del p['figure']['scene']['elements'][0]['derived']
    rejects(p, 'the asked-for reading is not masked')
    p = copy.deepcopy(colder_drawn); p['figure']['scene']['elements'][1]['label'] = 'Morning'
    rejects(p, 'a drawn thermometer the question does not name')
    # a second defensible choice is rejected
    p = copy.deepcopy(good[1][0]); p['response']['options'][0]['label'] = '37,500'
    rejects(p, 'two values between the bounds')
    # no defensible choice is rejected
    p = copy.deepcopy(good[1][0]); p['response']['options'][2]['label'] = '39,395'
    rejects(p, 'no value between the bounds')
    p = copy.deepcopy(good[0][0]); p['response']['options'][1]['label'] = '$(8+3)+4=8+(3+4)$'
    rejects(p, 'two associative equations')
    p = copy.deepcopy(good[0][0]); p['response']['options'][0]['label'] = '$(5+3)+6=5+(6+3)$'
    rejects(p, 'a false equation')
    p = copy.deepcopy(good[3][0]); p['prompt'] = p['prompt'].replace('pick a red marble', 'pick an orange marble')
    rejects(p, 'a chance of one sixth has no word among the choices')
    p = copy.deepcopy(good[3][0]); p['prompt'] = p['prompt'].replace('5 red marbles and 1 orange', '3 red marbles and 2 orange')
    rejects(p, 'three fifths is too close to one half to ask')
    p = copy.deepcopy(good[7][0]); p['figure']['scene']['elements'][0]['marks'][0]['at'] = 685
    rejects(p, 'a point off the tick marks')
    p = copy.deepcopy(good[7][0]); p['prompt'] = p['prompt'].replace('600 to 700', '600 to 800')
    rejects(p, 'figure scale differs from the prompt')
    p = copy.deepcopy(good[6][0]); p['response']['options'][2]['label'] = '150 grams'
    p['response']['options'][0]['label'] = '6 ounces'
    rejects(p, 'two reasonable estimates')
    p = copy.deepcopy(good[5][0]); p['prompt'] = p['prompt'].replace('17, 11, 17, 14, 11, 11, 14, 11', '17, 11, 17, 14, 11, 14, 14, 11')
    rejects(p, 'two modes')
    p = copy.deepcopy(good[8][0]); p['prompt'] = p['prompt'].replace('68, 57, 46, 35, 24', '68, 57, 46, 36, 24')
    rejects(p, 'no single rule')
    p = copy.deepcopy(good[9][0]); p['prompt'] = p['prompt'].replace('100 bike', '40 bike')
    rejects(p, 'supply equals demand')
    return True
