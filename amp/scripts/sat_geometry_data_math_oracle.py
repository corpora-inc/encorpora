"""Independent review of SAT geometry and data practice.

Every answer is derived from the public prompt, choices and figure only, with exact
Fraction arithmetic (trigonometry uses math with the stated rounding). Nothing here
reads the generator's case or answer logic.
"""
import copy
import math
import re
from decimal import Decimal, ROUND_HALF_UP
from fractions import Fraction

TRIG = 'trig-context-triangle'
MIDPOINT = 'midpoint-endpoint'
SPACE = 'space-diagonal'
CIRCLE = 'circle-segment-lengths'
FREQ = 'frequency-table-center'
INDEP = 'independence-test'
SUPPORTED = frozenset({TRIG, MIDPOINT, SPACE, CIRCLE, FREQ, INDEP})

NUM = r'-?\d+(?:\.\d+)?'


def require(condition, message):
    if not condition:
        raise ValueError(message)


def plain(text):
    t = text.replace('\\%', '%').replace('\\ ', ' ').replace('\\,', ' ').replace('$', '').replace('−', '-')
    t = t.replace('\\overline{', '{').replace('\\text{', '{').replace('\\mid', '|')
    t = re.sub(r'\\left|\\right|\\!', '', t)
    t = re.sub(r'\s*\|\s*', '|', t)
    return re.sub(r'\s+', ' ', t).strip()


def options_of(public):
    response = public['response']
    require(response['kind'] == 'choice', 'Choice response required')
    options = response['options']
    require(len(options) == 4 and all(set(o) == {'id', 'label'} for o in options), 'Four public choices required')
    require(len({o['id'] for o in options}) == 4, 'Duplicate choice IDs')
    return options


def pick(options, keys, expected, what):
    """keys: comparable value per option. Exactly one must equal expected; all must be distinct."""
    require(len(set(keys)) == len(keys), f'{what}: mathematically duplicate choices {keys}')
    hit = [o['id'] for o, k in zip(options, keys) if k == expected]
    require(len(hit) == 1, f'{what}: expected {expected} matches {len(hit)} of {keys}')
    return hit[0]


def number(text):
    m = re.fullmatch(r'(-?\d+(?:\.\d+)?)(?:/(\d+))?', text.strip())
    require(m is not None, f'Unreadable number: {text}')
    return Fraction(m[1]) / (int(m[2]) if m[2] else 1)


def squarefree(n):
    return all(n % (p * p) for p in range(2, math.isqrt(n) + 1))


# ---------------------------------------------------------------- trigonometry
def dec1(x):
    return Decimal(repr(x)).quantize(Decimal('0.1'), rounding=ROUND_HALF_UP)


def solve_trig(public):
    t = plain(public['prompt'])
    rad = math.radians
    answer = None
    unit = None
    rounded = 'Round to the nearest tenth.' in t
    m = None
    if (m := re.fullmatch(r'A boat on the level sea is (\d+) meters from the base of a vertical cliff\. From the top of the cliff, the angle of depression to the boat is (\d+)°\. How high is the cliff, in meters\? Round to the nearest tenth\.', t)):
        answer = int(m[1]) * math.tan(rad(int(m[2])))
        unit = 'meters'
    elif (m := re.fullmatch(r'A ladder must reach a window (\d+) feet above level ground and make a (\d+)° angle with the ground\. How long must the ladder be, in feet\? Round to the nearest tenth\.', t)):
        answer = int(m[1]) / math.sin(rad(int(m[2])))
        unit = 'feet'
    elif (m := re.fullmatch(r'From the top of a vertical cliff (\d+) meters high, the angle of depression to a boat on the level sea is (\d+)°\. How far is the boat from the base of the cliff, in meters\? Round to the nearest tenth\.', t)):
        answer = int(m[1]) / math.tan(rad(int(m[2])))
        unit = 'meters'
    elif (m := re.fullmatch(r'A vertical pole (\d+) meters tall casts a shadow (\d+) meters long on level ground\. What is the angle of elevation of the sun, in degrees\? Round to the nearest tenth\.', t)):
        answer = math.degrees(math.atan2(int(m[1]), int(m[2])))
        unit = '°'
    elif (m := re.fullmatch(r'A (\d+)-foot ladder leans against a vertical wall and makes a (\d+)° angle with the level ground\. How high up the wall does the ladder reach, in feet\? Round to the nearest tenth\.', t)):
        answer = int(m[1]) * math.sin(rad(int(m[2])))
        unit = 'feet'
    elif (m := re.fullmatch(r'A (\d+)-foot ladder leans against a vertical wall and makes a (\d+)° angle with the level ground\. How far is the foot of the ladder from the wall, in feet\? Round to the nearest tenth\.', t)):
        answer = int(m[1]) * math.cos(rad(int(m[2])))
        unit = 'feet'
    elif (m := re.fullmatch(r'A straight ramp rises (\d+) feet over a horizontal distance of (\d+) feet\. What angle does the ramp make with the level ground, in degrees\? Round to the nearest tenth\.', t)):
        answer = math.degrees(math.atan2(int(m[1]), int(m[2])))
        unit = '°'
    elif (m := re.fullmatch(r'From a point on level ground (\d+) feet from the base of a vertical flagpole, the angle of elevation to the top of the pole is (\d+)°\. How tall is the pole, in feet\? Round to the nearest tenth\.', t)):
        answer = int(m[1]) * math.tan(rad(int(m[2])))
        unit = 'feet'
    elif (m := re.fullmatch(r'A surveyor whose eyes are (\d+) feet above level ground stands (\d+) feet from the base of a vertical flagpole\. The angle of elevation from her eyes to the top of the pole is (\d+)°\. How tall is the pole, in feet\? Round to the nearest tenth\.', t)):
        # The pole is eye height plus the part above eye level.
        answer = int(m[1]) + int(m[2]) * math.tan(rad(int(m[3])))
        unit = 'feet'
    elif (m := re.fullmatch(r'A vertical flagpole (\d+) feet tall casts a shadow on level ground when the angle of elevation of the sun is (\d+)°\. How long is the shadow, in feet\? Round to the nearest tenth\.', t)):
        answer = int(m[1]) / math.tan(rad(int(m[2])))
        unit = 'feet'
    elif (m := re.fullmatch(r'From the top T of a vertical lighthouse, the angle of depression to a ship S on the level sea is (\d+)°\. The base of the lighthouse is B, so triangle TBS has a right angle at B\. What is the measure of angle (BST|BTS) at the ship, in degrees\?', t)) or \
            (m := re.fullmatch(r'From the top T of a vertical lighthouse, the angle of depression to a ship S on the level sea is (\d+)°\. The base of the lighthouse is B, so triangle TBS has a right angle at B\. What is the measure of angle (BST|BTS) at the top, in degrees\?', t)):
        d = int(m[1])
        # Depression is measured from the horizontal at T; alternate interior angles put it at S.
        # Angle BTS is the complement, measured from the vertical.
        if m[2] == 'BST':
            require('at the ship' in t, 'BST must be described as the ship angle')
            answer = d
        else:
            require('at the top' in t, 'BTS must be described as the top angle')
            answer = 90 - d
        unit = '°'
        rounded = False
    require(m is not None, f'Unknown trigonometry wording: {t}')
    options = options_of(public)
    parsed = []
    for o in options:
        mm = re.fullmatch(r'(' + NUM + r')\s*(feet|meters|°)', plain(o['label']))
        require(mm is not None and mm[2] == unit, f'Choice must carry unit {unit}: {o["label"]}')
        parsed.append(Decimal(mm[1]))
    if rounded:
        scaled = answer * 10
        require(abs(scaled - math.floor(scaled) - 0.5) > 1e-6, 'Answer sits on a rounding boundary')
        expected = dec1(answer)
    else:
        require(abs(answer - round(answer)) < 1e-9, 'Unrounded angle must be exact')
        expected = Decimal(round(answer))
    return pick(options, parsed, expected, 'trig')


# ------------------------------------------------------------------- midpoint
def points(text):
    return [(number(a), number(b)) for a, b in re.findall(r'\((' + NUM + r'),\s*(' + NUM + r')\)', text)]


def label_point(label):
    pts = points(plain(label))
    require(len(pts) == 1, f'Choice must be one point: {label}')
    return pts[0]


def solve_midpoint(public):
    t = plain(public['prompt'])
    options = options_of(public)
    if (m := re.fullmatch(r'Segment AB has endpoints A(\(.*?\)) and B(\(.*?\))\. What are the coordinates of the midpoint of \{?AB\}?\?', t.replace('{AB}', 'AB'))):
        (a, b) = points(m[1] + m[2])
        mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
        return pick(options, [label_point(o['label']) for o in options], mid, 'midpoint')
    if (m := re.fullmatch(r'The midpoint of \{?AB\}? is M(\(.*?\)) and A is (\(.*?\))\. What are the coordinates of B\?', t.replace('{AB}', 'AB'))):
        (mm, a) = points(m[1] + m[2])
        b = (2 * mm[0] - a[0], 2 * mm[1] - a[1])
        return pick(options, [label_point(o['label']) for o in options], b, 'endpoint')
    if (m := re.fullmatch(r'The midpoint of \{?AB\}? is M(\(.*?\)) and A is (\(.*?\))\. What is the sum of the coordinates of B\?', t.replace('{AB}', 'AB'))):
        (mm, a) = points(m[1] + m[2])
        total = 2 * mm[0] - a[0] + 2 * mm[1] - a[1]
        return pick(options, [number(plain(o['label'])) for o in options], total, 'sum')
    if (m := re.fullmatch(r'In the xy-plane, \{?AB\}? is a diameter of a circle, with A(\(.*?\)) and B(\(.*?\))\. What are the coordinates of the center of the circle\?', t.replace('{AB}', 'AB'))):
        (a, b) = points(m[1] + m[2])
        c = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
        return pick(options, [label_point(o['label']) for o in options], c, 'center')
    if (m := re.fullmatch(r'In the xy-plane, a circle has a diameter with endpoints (\(.*?\)) and (\(.*?\))\. Which equation represents the circle\?', t)):
        (a, b) = points(m[1] + ' ' + m[2])
        h, k = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
        r2 = ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) / 4
        keys = []
        for o in options:
            mm = re.fullmatch(r'(?:\(x([+-]\d+)\)|x)\^2\+(?:\(y([+-]\d+)\)|y)\^2=(\d+)', plain(o['label']).replace(' ', ''))
            require(mm is not None, f'Unreadable equation: {o["label"]}')
            keys.append((-Fraction(mm[1] or 0), -Fraction(mm[2] or 0), Fraction(mm[3])))
        return pick(options, keys, (h, k, r2), 'circle equation')
    raise ValueError(f'Unknown midpoint wording: {t}')


# ------------------------------------------------------------- space diagonal
def length_square(label):
    """Squared value of '36', '$4\\sqrt{2}$', '$\\sqrt{82}$'. Also flags a non-simplest radical."""
    s = plain(label).replace(' ', '')
    m = re.fullmatch(r'(\d*)\\sqrt\{(\d+)\}', s)
    if m:
        coef, rad = int(m[1] or 1), int(m[2])
        require(rad > 1 and squarefree(rad), f'Radical not in simplest form: {label}')
        return Fraction(coef * coef * rad), True
    m = re.fullmatch(r'-?\d+', s)
    require(m is not None, f'Unreadable length: {label}')
    # A negative length is never a valid distance; keep it distinct from its positive twin.
    return Fraction(int(s) ** 2 if int(s) >= 0 else -(int(s) ** 2)), False


def solve_space(public):
    t = plain(public['prompt'])
    options = options_of(public)
    d2 = h = None
    if (m := re.fullmatch(r'A cube has edges of length (\d+) centimeters\. What is the distance, in centimeters, from one vertex of the cube to the opposite vertex\?', t)):
        e = int(m[1])
        d2 = Fraction(3 * e * e)
    elif (m := re.fullmatch(r'A rectangular box has dimensions (\d+) (?:inch|inches) by (\d+) (?:inch|inches) by (\d+) (?:inch|inches)\. What is the exact distance, in inches, between two opposite corners\? Simplify any radical\.', t)):
        d2 = Fraction(sum(int(x) ** 2 for x in m.groups()))
    elif (m := re.fullmatch(r'A shipping tube is a straight, thin rod\. What is the length, in (\w+), of the longest rod that fits inside a closed rectangular box (\d+) \w+ by (\d+) \w+ by (\d+) \w+\? The rod can lie along the diagonal from one corner to the opposite corner\.', t)):
        d2 = Fraction(sum(int(x) ** 2 for x in m.groups()[1:]))
    elif (m := re.fullmatch(r'A rectangular box is (\d+) \w+ long, (\d+) \w+ wide and (\d+) \w+ tall\. What is the distance, in \w+, from one corner of the box to the opposite corner\?', t)):
        d2 = Fraction(sum(int(x) ** 2 for x in m.groups()))
    elif (m := re.fullmatch(r'A rectangular box has a base (\d+) \w+ long and (\d+) \w+ wide\. The longest straight segment between two corners of the box is (\d+) \w+\. What is the height of the box, in \w+\?', t)):
        l, w, dd = map(int, m.groups())
        h2 = dd * dd - l * l - w * w
        require(h2 > 0, 'Height must be positive')
        d2 = Fraction(h2)
    else:
        raise ValueError(f'Unknown space-diagonal wording: {t}')
    squares = []
    for o in options:
        sq, _ = length_square(o['label'])
        squares.append(sq)
    return pick(options, squares, d2, 'space diagonal')


# --------------------------------------------------------------- circle segments
def solve_circle(public):
    t = plain(public['prompt'])
    options = options_of(public)

    def squares():
        return [length_square(o['label'])[0] if re.search(r'sqrt', o['label']) or re.fullmatch(r'\s*\$?\d+\$?\s*', o['label'])
                else number(plain(o['label'])) ** 2 for o in options]

    def values():
        return [number(plain(o['label'])) for o in options]

    if (m := re.fullmatch(r'Chords \{AB\} and \{CD\} of a circle intersect at point E inside the circle\. AE=(\d+), EB=(\d+) and CE=(\d+)\. What is the length of (\{ED\}|\{CD\})\?', t)):
        ae, eb, ce = map(int, m.groups()[0:3])
        ed = Fraction(ae * eb, ce)
        v = ed if m[4] == '{ED}' else ed + ce
        return pick(options, values(), v, 'intersecting chords')
    if (m := re.fullmatch(r'From an external point P, \{PT\} is tangent to a circle at T, and a secant from P meets the circle at A and then B\. PT=(\d+) and PA=(\d+)\. What is the length of (chord \{AB\}|\{PB\})\?', t)):
        pt, pa = map(int, m.groups()[0:2])
        pb = Fraction(pt * pt, pa)
        require(pb > pa, 'Secant must extend past A')
        v = pb - pa if m[3].startswith('chord') else pb
        return pick(options, values(), v, 'tangent-secant')
    if (m := re.fullmatch(r'From an external point P, \{PT\} is tangent to a circle at T, and a secant from P meets the circle at A and then B\. PA=(\d+) and PB=(\d+)\. What is the length of \{PT\}\?', t)):
        pa, pb = map(int, m.groups()[0:2])
        require(pb > pa, 'Whole secant must exceed the outside part')
        return pick(options, squares(), Fraction(pa * pb), 'tangent length')
    if (m := re.fullmatch(r'Two secants from an external point P meet a circle\. The first secant meets it at A and then B, with PA=(\d+) and PB=(\d+)\. The second meets it at C and then D, with PC=(\d+)\. What is the length of (chord \{CD\}|\{PD\})\?', t)):
        pa, pb, pc = map(int, m.groups()[0:3])
        pd = Fraction(pa * pb, pc)
        require(pb > pa and pd > pc, 'Secant order must be outside part then whole')
        v = pd - pc if m[4].startswith('chord') else pd
        return pick(options, values(), v, 'two secants')
    if (m := re.fullmatch(r'In the xy-plane, a circle has center (\(.*?\)) and passes through P(\(.*?\))\. What is the slope of the line tangent to the circle at P\?', t)):
        (c, p) = points(m[1] + m[2])
        require(c != p, 'Radius must be nonzero')
        dx, dy = p[0] - c[0], p[1] - c[1]
        expected = 'undefined' if dy == 0 else (-dx / dy)  # vertical tangent has no slope; horizontal tangent has slope 0
        keys = []
        for o in options:
            s = plain(o['label']).replace(' ', '')
            if s == 'undefined':
                keys.append('undefined')
                continue
            mm = re.fullmatch(r'(-?)\\frac\{(\d+)\}\{(\d+)\}', s)
            keys.append((-1 if mm[1] else 1) * Fraction(int(mm[2]), int(mm[3])) if mm else number(s))
        return pick(options, keys, expected, 'tangent slope')
    raise ValueError(f'Unknown circle wording: {t}')


# ------------------------------------------------------------- frequency tables
NOUNS = {'Score': 'quiz scores', 'Goals': 'numbers of goals scored', 'Pets': 'numbers of pets', 'Books': 'numbers of books read'}


def table_data(public):
    figure = public.get('figure')
    require(figure and figure['kind'] == 'scene', 'Frequency table figure required')
    elements = figure['scene']['elements']
    require(len(elements) == 1 and elements[0]['type'] == 'table', 'One table element required')
    table = elements[0]
    require(table['columns'] == ['Frequency'], 'Frequency column required')
    rows = [(number(r['label']), r['cells'][0]) for r in table['rows']]
    require(all(len(r['cells']) == 1 for r in table['rows']), 'One cell per row')
    require(all(isinstance(f, int) and f > 0 for _, f in rows), 'Frequencies must be positive integers')
    values = [v for v, _ in rows]
    require(values == sorted(set(values)), 'Values must be strictly ascending')
    return table['corner'], rows


def median_of(rows):
    n = sum(f for _, f in rows)
    expanded = [v for v, f in rows for _ in range(f)]
    return Fraction(expanded[n // 2 - 1] + expanded[n // 2], 2) if n % 2 == 0 else Fraction(expanded[n // 2])


def mean_of(rows):
    return Fraction(sum(v * f for v, f in rows), sum(f for _, f in rows))


def change(before, after):
    return 'increases' if after > before else 'decreases' if after < before else 'does not change'


def solve_freq(public):
    t = plain(public['prompt'])
    options = options_of(public)
    values = lambda: [number(plain(o['label'])) for o in options]
    if (m := re.fullmatch(r'The frequency table shows (.+?) for a group\. (What is the (mean|median) of the data\?|A new data value of (\d+) is added to the data\. Which statement describes what happens to the mean and the median\?)', t)):
        require(public.get('figure') is not None, 'Table required')
        corner, rows = table_data(public)
        require(NOUNS.get(corner) == m[1], f'Table header {corner} does not match prompt noun {m[1]}')
        if m[3]:
            return pick(options, values(), mean_of(rows) if m[3] == 'mean' else median_of(rows), 'table center')
        added = int(m[4])
        after = [(v, f + (1 if v == added else 0)) for v, f in rows]
        if added not in [v for v, _ in rows]:
            after = sorted(rows + [(Fraction(added), 1)])
        want = f'The mean {change(mean_of(rows), mean_of(after))}; the median {change(median_of(rows), median_of(after))}.'
        labels = [plain(o['label']) for o in options]
        for label in labels:
            require(re.fullmatch(r'The mean (increases|decreases|does not change); the median (increases|decreases|does not change)\.', label), f'Bad change statement: {label}')
        return pick(options, labels, want, 'change statement')
    require(public.get('figure') is None, 'Unexpected figure')
    if (m := re.fullmatch(r'A set of (\d+) numbers has a mean of (\d+)\. One of the numbers, (\d+), is removed\. What is the mean of the remaining (\d+) numbers\?', t)):
        n, mean, r, k = map(int, m.groups())
        require(k == n - 1, 'Remaining count wrong')
        return pick(options, values(), Fraction(n * mean - r, n - 1), 'removal mean')
    if (m := re.fullmatch(r'A set of (\d+) numbers has a mean of (\d+)\. A new number, (\d+), is added to the set\. What is the mean of the new set of (\d+) numbers\?', t)):
        n, mean, a, k = map(int, m.groups())
        require(k == n + 1, 'New count wrong')
        return pick(options, values(), Fraction(n * mean + a, n + 1), 'addition mean')
    if (m := re.fullmatch(r'One class of (\d+) students has a mean test score of (\d+)\. Another class of (\d+) students has a mean test score of (\d+)\. What is the mean test score of all (\d+) students together\?', t)):
        n1, m1, n2, m2, tot = map(int, m.groups())
        require(tot == n1 + n2, 'Combined count wrong')
        return pick(options, values(), Fraction(n1 * m1 + n2 * m2, n1 + n2), 'combined mean')
    if (m := re.fullmatch(r"A course grade counts tests for (\d+)%, projects for (\d+)% and homework for (\d+)%\. A student's averages are (\d+) on tests, (\d+) on projects and (\d+) on homework\. What is the student's course grade\?", t)):
        w = list(map(int, m.groups()[:3]))
        a = list(map(int, m.groups()[3:]))
        require(sum(w) == 100, 'Weights must total 100%')
        return pick(options, values(), Fraction(sum(x * y for x, y in zip(w, a)), 100), 'weighted grade')
    raise ValueError(f'Unknown frequency wording: {t}')


# ----------------------------------------------------------------- independence
def base_verb(phrase):
    """'owns a car' -> 'own a car', 'is in the city' -> 'are in the city'."""
    first, _, rest = phrase.partition(' ')
    if first == 'is':
        return ('are ' + rest).strip()
    require(first.endswith('s'), f'Unexpected predicate: {phrase}')
    return (first[:-1] + ' ' + rest).strip()


def table2(public):
    figure = public.get('figure')
    require(figure and figure['kind'] == 'scene', 'Table figure required')
    elements = figure['scene']['elements']
    require(len(elements) == 1 and elements[0]['type'] == 'table', 'One table element required')
    table = elements[0]
    require(table.get('sums') is True and table['columns'][-1] == 'Total', 'Totals required')
    rows = table['rows']
    for r in rows[:-1]:
        require(r['cells'][0] + r['cells'][1] == r['cells'][2], f'Row total wrong: {r}')
    require(all(sum(r['cells'][i] for r in rows[:-1]) == rows[-1]['cells'][i] for i in range(3)), 'Column totals wrong')
    require(rows[-1]['label'] == 'Total', 'Last row must be the total')
    return table, rows


def solve_indep(public):
    t = plain(public['prompt'])
    options = options_of(public)
    labels = [plain(o['label']) for o in options]
    if (m := re.fullmatch(r'Events A and B are independent\. P\(A\)=(\d+)% and P\(B\)=(\d+)%\. What is P\(A and B\)\?', t.replace('{ and }', ' and '))):
        v = Fraction(int(m[1]), 100) * Fraction(int(m[2]), 100) * 100
        keys = []
        for label in labels:
            mm = re.fullmatch(r'(' + NUM + r')%', label)
            require(mm is not None, f'Percent expected: {label}')
            keys.append(number(mm[1]))
        return pick(options, keys, v, 'independent product')
    if (m := re.fullmatch(r'A survey asked (\d+) people two questions\. (\S+) people answered Yes to question 1 and (\S+) answered Yes to question 2\. If the answers to the two questions are independent, how many people are expected to answer Yes to both\?', t)):
        n, a, b = map(number, m.groups())
        require(all(x.denominator == 1 and x > 0 for x in (n, a, b)) and a <= n and b <= n, 'Survey counts must be whole numbers within the sample')
        return pick(options, [number(l) for l in labels], Fraction(a * b, n), 'expected both')
    if (m := re.fullmatch(r'In a survey of (\w+), let (\w) be the event that a randomly selected respondent (.+?), and let (\w) be the event that the respondent (.+?)\. It is known that P\((\w)\|(\w)\)=(0\.\d+)\. Which statement correctly interprets this probability\?', t)):
        noun, e1, p1, e2, p2, x, y, prob = m.groups()
        events = {e1: base_verb(p1), e2: base_verb(p2)}
        require(x in events and y in events and x != y, 'Conditional must name the two events')
        pct = Fraction(prob) * 100
        classified = []
        for label in labels:
            if (mm := re.fullmatch(r'Among surveyed ' + noun + r' who (do not |are not )?(.+?), (' + NUM + r')% (.+?)\.', label)):
                cond = ('are ' + mm[2]) if mm[1] == 'are not ' else mm[2]
                group = [e for e, ph in events.items() if cond == ph]
                result = [e for e, ph in events.items() if mm[4] == ph]
                require(len(group) == 1 and len(result) == 1, f'Unreadable statement: {label}')
                classified.append(('among', group[0], bool(mm[1]), result[0], number(mm[3])))
            elif (mm := re.fullmatch(r'(' + NUM + r')% of all surveyed ' + noun + r' (.+?) and (.+?)\.', label)):
                classified.append(('joint', mm[2], mm[3], number(mm[1])))
            else:
                raise ValueError(f'Unreadable statement: {label}')
        return pick(options, classified, ('among', y, False, x, pct), 'conditional meaning')
    if (m := re.fullmatch(r'The table shows how (\d+) people are classified by two events, A and B\. Which statement is true\?', t)):
        table, rows = table2(public)
        require(table['columns'] == ['B', 'Not B', 'Total'] and [r['label'] for r in rows] == ['A', 'Not A', 'Total'], 'Unexpected table labels')
        n = rows[-1]['cells'][2]
        require(n == int(m[1]) and n > 0, 'Prompt count must match table')
        both = rows[0]['cells'][0]
        pa, pb = Fraction(rows[0]['cells'][2], n), Fraction(rows[-1]['cells'][0], n)
        require(pb > 0, 'P(B) must be positive')
        cond = Fraction(both, rows[-1]['cells'][0])
        truth = []
        for label in labels:
            if label == 'P(A|B)=P(A), so the events are independent.':
                truth.append(cond == pa)
            elif label == 'P(A|B)>P(A), so the events are not independent.':
                truth.append(cond > pa)
            elif label == 'P(A|B)<P(A), so the events are not independent.':
                truth.append(cond < pa)
            elif label == 'No person is in both A and B, so the events are independent.':
                truth.append(both == 0 and Fraction(both, n) == pa * pb)
            else:
                raise ValueError(f'Unreadable statement: {label}')
        require(len(set(labels)) == 4 and sum(truth) == 1, f'Exactly one statement must be true: {truth}')
        return options[truth.index(True)]['id']
    if (m := re.fullmatch(r'\w+ in four groups were asked whether they (.+?)\. The table shows the counts\. For which group is belonging to that group independent of answering Yes\?', t)):
        table, rows = table2(public)
        require(table['columns'] == ['Yes', 'No', 'Total'] and len(rows) == 5, 'Four groups and a total row required')
        overall = Fraction(rows[-1]['cells'][0], rows[-1]['cells'][2])
        groups = {r['label']: Fraction(r['cells'][0], r['cells'][2]) for r in rows[:-1]}
        require(len(groups) == 4, 'Distinct group labels required')
        independent = [g for g, p in groups.items() if p == overall]
        require(len(independent) == 1, f'Exactly one independent group required: {independent}')
        require(sorted(labels) == sorted(groups), 'Choices must be exactly the table groups')
        return pick(options, labels, independent[0], 'independent group')
    raise ValueError(f'Unknown independence wording: {t}')


# ---------------------------------------------------------------------- entry points
SOLVERS = {TRIG: solve_trig, MIDPOINT: solve_midpoint, SPACE: solve_space, CIRCLE: solve_circle, FREQ: solve_freq, INDEP: solve_indep}


def solve(public):
    require(public['templateId'] in SUPPORTED, 'Unexpected SAT geometry/data family')
    return SOLVERS[public['templateId']](public)


def numbers_in(text):
    return set(re.findall(r'\d+(?:\.\d+)?', plain(text)))


def review_problem(problem):
    public = problem['public']
    result = solve(public)
    require(result == problem['answer'], f'SAT geometry/data answer key mismatch: oracle {result}, key {problem["answer"]}')
    options = options_of(public)
    correct = next(o['label'] for o in options if o['id'] == result)
    # Leakage: a wordy correct label must not be spelled out in the prompt, and a numeric answer
    # that is not a given must not appear in the hint.
    cl = plain(correct)
    if len(cl) > 12:
        require(cl.lower() not in plain(public['prompt']).lower() and cl.lower() not in plain(problem['hint']).lower(), 'Correct choice is spelled out in the prompt or hint')
    return result


def self_test():
    def trig(prompt, labels, key):
        return {'public': {'templateId': TRIG, 'prompt': prompt, 'response': {'kind': 'choice', 'options': [
            {'id': f'o{i}', 'label': l} for i, l in enumerate(labels)]}}, 'answer': f'o{key}', 'hint': 'Use a ratio.'}

    def make(template, prompt, labels, key, figure=None):
        public = {'templateId': template, 'prompt': prompt, 'response': {'kind': 'choice', 'options': [
            {'id': f'o{i}', 'label': l} for i, l in enumerate(labels)]}}
        if figure:
            public['figure'] = figure
        return {'public': public, 'answer': f'o{key}', 'hint': 'Work it out.'}

    def table(corner, rows):
        return {'kind': 'scene', 'scene': {'elements': [{'id': 't', 'type': 'table', 'columns': ['Frequency'], 'corner': corner,
                                                           'rows': [{'label': str(v), 'cells': [f]} for v, f in rows]}]}}

    def grid(rows, cols=('B', 'Not B', 'Total')):
        return {'kind': 'scene', 'scene': {'elements': [{'id': 't', 'type': 'table', 'columns': list(cols), 'sums': True,
                                                           'rows': [{'label': l, 'cells': c} for l, c in rows]}]}}

    stmts = ['$P(A\\mid B)=P(A)$, so the events are independent.', '$P(A\\mid B)>P(A)$, so the events are not independent.',
             '$P(A\\mid B)<P(A)$, so the events are not independent.', 'No person is in both A and B, so the events are independent.']
    cases = [
        # (problem, mutation that must be rejected)
        trig('A 25-foot ladder leans against a vertical wall and makes a 64° angle with the level ground. How far is the foot of the ladder from the wall, in feet? Round to the nearest tenth.',
             ['22.5 feet', '12.2 feet', '11.0 feet', '57.0 feet'], 2),
        trig('From the top $T$ of a vertical lighthouse, the angle of depression to a ship $S$ on the level sea is 27°. The base of the lighthouse is $B$, so triangle $TBS$ has a right angle at $B$. What is the measure of angle $BTS$ at the top, in degrees?',
             ['27°', '63°', '117°', '73°'], 1),
        trig('A surveyor whose eyes are 5 feet above level ground stands 80 feet from the base of a vertical flagpole. The angle of elevation from her eyes to the top of the pole is 53°. How tall is the pole, in feet? Round to the nearest tenth.',
             ['106.2 feet', '111.2 feet', '101.2 feet', '60.3 feet'], 1),
        make(MIDPOINT, 'The midpoint of $\\overline{AB}$ is $M(-8,\\ 2)$ and $A$ is $(2,\\ 6)$. What are the coordinates of $B$?',
             ['$(-6,\\ 8)$', '$(-3,\\ 4)$', '$(-18,\\ -2)$', '$(-10,\\ -4)$'], 2),
        make(MIDPOINT, 'In the $xy$-plane, a circle has a diameter with endpoints $(-6,\\ -7)$ and $(-4,\\ 1)$. Which equation represents the circle?',
             ['$(x-5)^2+(y-3)^2=17$', '$(x+5)^2+(y+3)^2=1$', '$(x+5)^2+(y+3)^2=68$', '$(x+5)^2+(y+3)^2=17$'], 3),
        make(SPACE, 'A rectangular box has dimensions 5 inches by 8 inches by 2 inches. What is the exact distance, in inches, between two opposite corners? Simplify any radical.',
             ['15', '93', '$\\sqrt{89}$', '$\\sqrt{93}$'], 3),
        make(SPACE, 'A rectangular box has a base 9 centimeters long and 2 centimeters wide. The longest straight segment between two corners of the box is 11 centimeters. What is the height of the box, in centimeters?',
             ['$2\\sqrt{10}$', '0', '6', '36'], 2),
        make(CIRCLE, 'Chords $\\overline{AB}$ and $\\overline{CD}$ of a circle intersect at point $E$ inside the circle. $AE=4$, $EB=12$ and $CE=6$. What is the length of $\\overline{ED}$?',
             ['42', '2', '10', '8'], 3),
        make(CIRCLE, 'In the $xy$-plane, a circle has center $(2,\\ -6)$ and passes through $P(7,\\ -6)$. What is the slope of the line tangent to the circle at $P$?',
             ['$-1$', '$1$', '$0$', 'undefined'], 3),
        make(CIRCLE, 'In the $xy$-plane, a circle has center $(-3,\\ 6)$ and passes through $P(-3,\\ -11)$. What is the slope of the line tangent to the circle at $P$?',
             ['$0$', 'undefined', '$-1$', '$1$'], 0),
        make(CIRCLE, 'In the $xy$-plane, a circle has center $(-6,\\ 0)$ and passes through $P(-3,\\ 4)$. What is the slope of the line tangent to the circle at $P$?',
             ['$-\\frac{3}{4}$', '$\\frac{3}{4}$', '$\\frac{4}{3}$', '$-\\frac{4}{3}$'], 0),
        # Even total frequency: the median averages the two middle values.
        make(FREQ, 'The frequency table shows quiz scores for a group. What is the median of the data?',
             ['6', '5', '5.5', '4'], 2, table('Score', [(4, 2), (5, 2), (6, 2), (7, 2)])),
        make(FREQ, 'The frequency table shows numbers of pets for a group. A new data value of 8 is added to the data. Which statement describes what happens to the mean and the median?',
             ['The mean decreases; the median increases.', 'The mean decreases; the median does not change.', 'The mean decreases; the median decreases.', 'The mean increases; the median does not change.'], 3,
             table('Pets', [(2, 2), (4, 2), (6, 2)])),
        make(FREQ, 'A set of 10 numbers has a mean of 33. One of the numbers, 6, is removed. What is the mean of the remaining 9 numbers?',
             ['32.4', '19.5', '36', '33'], 2),
        make(INDEP, 'The table shows how 45 people are classified by two events, $A$ and $B$. Which statement is true?', stmts, 1,
             grid([('A', [14, 16, 30]), ('Not A', [4, 11, 15]), ('Total', [18, 27, 45])])),
        make(INDEP, 'Employees in four groups were asked whether they bike to work. The table shows the counts. For which group is belonging to that group independent of answering Yes?',
             ['South', 'East', 'West', 'North'], 3,
             grid([('North', [10, 15, 25]), ('South', [1, 9, 10]), ('East', [3, 7, 10]), ('West', [14, 11, 25]), ('Total', [28, 42, 70])], ('Yes', 'No', 'Total'))),
        make(INDEP, 'In a survey of households, let $C$ be the event that a randomly selected respondent owns a car, and let $L$ be the event that the respondent is in the city. It is known that $P(L\\mid C)=0.35$. Which statement correctly interprets this probability?',
             ['Among surveyed households who own a car, 35% are in the city.', '35% of all surveyed households own a car and are in the city.',
              'Among surveyed households who do not own a car, 35% are in the city.', 'Among surveyed households who are in the city, 35% own a car.'], 0),
        make(INDEP, 'A survey asked 150 people two questions. 30 people answered Yes to question 1 and 60 answered Yes to question 2. If the answers to the two questions are independent, how many people are expected to answer Yes to both?',
             ['30', '1800', '12', '-60'], 2),
    ]
    rejected = 0

    def reject(problem):
        nonlocal rejected
        try:
            review_problem(problem)
        except ValueError:
            rejected += 1
            return
        raise ValueError('Corrupt SAT geometry/data case was accepted')

    for problem in cases:
        review_problem(problem)
        for wrong in range(4):
            if f'o{wrong}' != problem['answer']:
                bad = copy.deepcopy(problem)
                bad['answer'] = f'o{wrong}'
                reject(bad)
        bad = copy.deepcopy(problem)
        bad['public']['response']['options'][3]['label'] = bad['public']['response']['options'][(int(problem['answer'][1]) + 1) % 4 if int(problem['answer'][1]) != 3 else 0]['label']
        if bad['public']['response']['options'][3]['label'] != problem['public']['response']['options'][3]['label']:
            reject(bad)
    # Corrupt givens must break the key.
    for index, (old, new) in {0: ('64°', '65°'), 3: ('(-8,', '(-9,'), 5: ('5 inches', '4 inches'), 7: ('AE=4', 'AE=5'), 8: ('P(7,\\ -6)', 'P(7,\\ -5)')}.items():
        bad = copy.deepcopy(cases[index])
        require(old in bad['public']['prompt'], 'Fixture mutation must apply')
        bad['public']['prompt'] = bad['public']['prompt'].replace(old, new)
        reject(bad)
    # Table disagreeing with the prompt.
    bad = copy.deepcopy(cases[11])
    bad['public']['figure']['scene']['elements'][0]['rows'][0]['cells'] = [9]
    reject(bad)
    bad = copy.deepcopy(cases[11])
    bad['public']['figure']['scene']['elements'][0]['corner'] = 'Pets'
    reject(bad)
    # Two independent groups would make the question ambiguous.
    bad = copy.deepcopy(cases[15])
    bad['public']['figure']['scene']['elements'][0]['rows'][1]['cells'] = [4, 6, 10]
    bad['public']['figure']['scene']['elements'][0]['rows'][-1]['cells'] = [31, 39, 70]
    reject(bad)
    # A non-simplest radical in a choice is rejected.
    bad = copy.deepcopy(cases[5])
    bad['public']['response']['options'][3]['label'] = '$\\sqrt{12}$'
    reject(bad)
    # Rounded values must respect the stated rounding.
    bad = copy.deepcopy(cases[0])
    bad['public']['response']['options'][2]['label'] = '10.96 feet'
    reject(bad)
    return {'fixtures': len(cases), 'rejectedMutations': rejected}


if __name__ == '__main__':
    print(self_test())
