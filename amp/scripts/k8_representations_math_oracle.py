"""Independent review of the K-8 representation templates from public payloads only.

Every answer is re-derived from the prompt, the answer choices and the figure data.
Each solver evaluates the truth of EVERY option, so a distractor that is also true
(or a correct answer that is missing) raises instead of passing.
"""
import copy
import itertools
import math
import re
from fractions import Fraction

SUPPORTED = frozenset({
    'proportional-graph',
    'story-graph-match',
    'coordinate-context-points',
    'pattern-pair-relationship',
    'triangle-uniqueness',
    'percent-applications',
    'compound-event-simulation',
})


def require(condition, message):
    if not condition:
        raise ValueError(message)


def strip(text):
    return text.replace('$', '').replace('−', '-').replace('\\%', '%').replace('^\\circ', '°')


def number(text):
    return Fraction(text)


def graph_of(public):
    figure = public.get('figure')
    require(figure and figure['kind'] == 'scene', 'Graph figure required')
    elements = figure['scene']['elements']
    require(len(elements) == 1 and elements[0]['type'] == 'graph', 'Exactly one graph expected')
    return elements[0]


def poly_value(coefficients, x):
    return sum(Fraction(str(c)) * Fraction(x) ** i for i, c in enumerate(coefficients))


def options_of(public):
    response = public['response']
    require(response['kind'] == 'choice', 'Choice response expected')
    options = response['options']
    require(len(options) == 4 and len({o['id'] for o in options}) == 4, 'Four distinct option ids required')
    require(len({strip(o['label']).strip() for o in options}) == 4, 'Duplicate option labels')
    return options


def pick(options, truth):
    """Exactly one option may be true; return its id."""
    hits = [o['id'] for o, t in zip(options, truth) if t]
    require(len(hits) == 1, f'Expected exactly one true option, found {len(hits)}')
    return hits[0]


def singular_ok(text):
    require(not re.search(r'\b1 (weeks|rounds|points|dollars|blocks|centimeters|years|flips)\b', text), f'Plural after 1: {text}')


# ---------------------------------------------------------------- proportional graphs

def solve_proportional(public):
    g = graph_of(public)
    prompt = strip(public['prompt'])
    options = options_of(public)
    x_name, y_name = g['axisNames']
    require(len(g['curves']) == 1 and g['curves'][0]['fn']['f'] == 'poly', 'One polynomial curve expected')
    c = g['curves'][0]['fn']['c']
    d0, d1 = g['curves'][0]['domain']
    # Figure sanity: curve stays inside the axes over its domain.
    for step in range(0, 13):
        x = Fraction(d0) + (Fraction(d1) - Fraction(d0)) * step / 12
        require(g['y'][0] <= poly_value(c, x) <= g['y'][1], 'Curve leaves the graph window')
    for p in g.get('points', []):
        require(poly_value(c, p['x']) == Fraction(str(p['y'])), 'Labeled point is not on the curve')
        require(p['label'] == f"({p['x']}, {p['y']})", 'Point label disagrees with coordinates')
    is_line = all(Fraction(str(v)) == 0 for v in c[2:])
    intercept, slope = Fraction(str(c[0])), Fraction(str(c[1]))
    if 'Which equation matches' in prompt:
        require(x_name in prompt and y_name in prompt, 'Axis names must match the stated variables')
        require(is_line and intercept == 0, 'Equation items need a proportional line')
        pt = g['points'][0]
        truth = []
        for o in options:
            t = strip(o['label'])
            if m := re.fullmatch(r'y = (\d+(?:\.\d+)?)x', t):
                f = lambda x, k=number(m[1]): k * x
            elif m := re.fullmatch(r'y = \\frac\{x\}\{(\d+)\}', t):
                f = lambda x, k=number(m[1]): x / k
            elif m := re.fullmatch(r'y = x \+ (\d+)', t):
                f = lambda x, k=number(m[1]): x + k
            else:
                raise ValueError(f'Unreadable equation {t}')
            matches_graph = all(f(Fraction(x)) == poly_value(c, x) for x in (1, 2, 3, 5))
            truth.append(matches_graph)
        return pick(options, truth)
    if 'unit rate' in prompt:
        require(is_line and intercept == 0, 'Unit rate needs a proportional line')
        m = re.search(r'the number of (\w+) for 1 (\w+)\?', prompt)
        require(m and m[1] == y_name and m[2] == x_name[:-1] if x_name.endswith('s') else m[2] == x_name, 'Unit-rate units disagree with the axes')
        truth = []
        for o in options:
            q = re.fullmatch(r'(\d+(?:\.\d+)?) (\w+) per (\w+)', strip(o['label']))
            require(q, 'Unreadable unit rate')
            require(q[2] == y_name, 'Unit rate unit must match the vertical axis')
            truth.append(number(q[1]) == slope)
        return pick(options, truth)
    if 'Is it a proportional relationship' in prompt:
        require(g['axisNames'][1] in prompt and g['axisNames'][0] in prompt, 'Axes must be named')
        proportional = is_line and intercept == 0
        truth = []
        for o in options:
            t = strip(o['label'])
            if t.startswith('Yes. It is a straight line through (0, 0)'):
                truth.append(proportional)
            elif t.startswith('No. It is a straight line, but it does not pass through (0, 0)'):
                truth.append(is_line and intercept != 0)
            elif t.startswith('No. It passes through (0, 0), but it is not a straight line'):
                truth.append((not is_line) and intercept == 0)
            elif t.startswith('Yes. Any graph that goes up is proportional'):
                # Increasing is not sufficient for proportionality; never an accepted justification.
                truth.append(False)
            else:
                raise ValueError(f'Unknown proportionality option {t}')
        return pick(options, truth)
    if 'What does the labeled point' in prompt:
        pt = g['points'][0]
        px, py = pt['x'], pt['y']
        story_fee = 'fixed fee' in prompt or 'joining fee' in prompt
        require(story_fee == (intercept != 0), 'Fee wording must match a nonzero intercept')
        require(y_name in prompt and x_name in prompt, 'Axes must be named in the prompt')
        truth = []
        for o in options:
            t = strip(o['label'])
            ok = False
            if m := re.fullmatch(r'With (\d+) (\w+) there are (\d+) (\w+)\.', t):
                ok = (number(m[1]), number(m[3])) == (px, py) and m[2] == x_name and m[4] == y_name
            elif m := re.fullmatch(r'In (\d+) (\w+) the \w+ (?:rides|prints|adds) (\d+) (\w+)\.', t):
                ok = (number(m[1]), number(m[3])) == (px, py) and m[2] == x_name and m[4] == y_name
            elif m := re.fullmatch(r'(\d+) pounds of apples cost (\d+) dollars\.', t):
                ok = (number(m[1]), number(m[2])) == (px, py)
            elif m := re.fullmatch(r'The (?:fixed|joining) fee is (\d+) dollars?, (?:charged|paid) before .*\.', t):
                ok = px == 0 and number(m[1]) == py == intercept
            elif m := re.fullmatch(r'(?:The (?:unit )?rate is|Each \w+ costs) (\d+) .*?\.|Every \w+ adds (\d+) \w+\.|The unit rate is (\d+) .*?\.', t):
                value = number(next(g_ for g_ in m.groups() if g_))
                # A true rate is a true statement but not the meaning of the labeled point.
                require(value != slope or px == 0 and py == 0 and False, 'Distractor states the true rate; ambiguous with the point meaning')
                ok = False
            elif re.fullmatch(r'The relationship is not proportional because it starts at 0\.|A fixed amount of \w+ is there before any \w+\.|Nothing is paid at 0 \w+\.|The ride costs nothing at 0 miles\.|The membership lasts \d+ months\.|The ride is \d+ miles long\.', t):
                if t.startswith('The relationship is not proportional'):
                    ok = False
                else:
                    ok = False
            else:
                raise ValueError(f'Unknown point-meaning option {t}')
            truth.append(ok)
        return pick(options, truth)
    raise ValueError('Unknown proportional-graph variant')


# ---------------------------------------------------------------- story graphs

KIND_WORD = {'Increasing': 1, 'Decreasing': -1, 'Constant': 0}
STORY_VERB = [
    ('climbs', 1), ('descends', -1), ('hovers', 0),
    ('walks away from home', 1), ('walks back toward home', -1), ('stops to rest', 0),
    ('fills with water', 1), ('drains', -1), ('stays at the same level', 0),
]
SUBJECT = {'height above the ground': 'drone', 'distance from home': 'Ana', 'amount of water in a tub': 'tub'}


def sign(v):
    return (v > 0) - (v < 0)


def chain(g):
    segs = g['segments']
    for a, b in zip(segs, segs[1:]):
        require(a['to'] == b['from'], 'Segments must join end to start')
    require(segs[0]['from'][0] == g['x'][0] and segs[-1]['to'][0] == g['x'][1], 'Segments must span the time axis')
    for s in segs:
        require(s['to'][0] > s['from'][0], 'Time must increase')
        for v in (*s['from'], *s['to']):
            require(0 <= v <= max(g['x'][1], g['y'][1]), 'Segment outside the window')
        require(0 <= s['from'][1] <= g['y'][1] and 0 <= s['to'][1] <= g['y'][1], 'Segment outside the y window')
    return segs


def story_kinds(sentence, subject_name):
    """Kinds in the order the verbs are written in the sentence."""
    text = sentence
    found = []
    for verb, kind in STORY_VERB:
        for m in re.finditer(re.escape(verb), text):
            found.append((m.start(), kind))
    found.sort()
    return [k for _, k in found]


def solve_story(public):
    prompt = strip(public['prompt'])
    options = options_of(public)
    quantity = None
    for q in SUBJECT:
        if q in prompt:
            quantity = q
    require(quantity, 'Quantity must be named')
    g = public.get('figure') and graph_of(public)
    if g:
        require(g['axisNames'] == ['time', quantity], 'Axis names must match the stated quantity')
        segs = chain(g)
        kinds = [sign(s['to'][1] - s['from'][1]) for s in segs]
    if 'Which story matches' in prompt:
        require(g, 'Figure needed')
        truth = []
        for o in options:
            t = strip(o['label'])
            require(t.split()[0] == 'A' and SUBJECT[quantity] in t or SUBJECT[quantity] == 'Ana' and 'Ana' in t, 'Story subject disagrees with the quantity')
            ks = story_kinds(t, quantity)
            truth.append(ks == kinds)
        return pick(options, truth)
    if 'Which description fits' in prompt:
        if g:
            target = kinds
        else:
            head = prompt.split(' Which description')[0]
            require(SUBJECT[quantity] in head, 'Story subject disagrees with the quantity')
            target = story_kinds(head, quantity)
            require(len(target) == 3, 'Three-part story expected')
        truth = []
        for o in options:
            words = [w.capitalize() for w in re.findall(r'(?i)(increasing|decreasing|constant)', strip(o['label']))]
            require(len(words) == 3, 'Three-part description expected')
            truth.append([KIND_WORD[w] for w in words] == target)
        return pick(options, truth)
    m = re.search(r'On which part is it (increasing|decreasing|constant|changing most quickly|changing most slowly, but still changing)\?', prompt)
    require(m and g, 'Part question needs a figure')
    pts = {p['label']: (p['x'], p['y']) for p in g['points']}
    for s in segs:
        require(tuple(s['from']) in pts.values() and tuple(s['to']) in pts.values(), 'Segment ends must be labeled points')
    spans = {s['to'][0] - s['from'][0] for s in segs}
    parts = {}
    for s in segs:
        a = next(k for k, v in pts.items() if v == tuple(s['from']))
        b = next(k for k, v in pts.items() if v == tuple(s['to']))
        parts[f'From {a} to {b}'] = s
    ask = m[1]
    if 'quickly' in ask or 'slowly' in ask:
        require(len(spans) == 1 and 'same amount of time' in prompt, 'Equal time spans must be stated and true')
        mags = {k: abs(s['to'][1] - s['from'][1]) for k, s in parts.items()}
        if 'quickly' in ask:
            best = max(mags.values())
        else:
            best = min(v for v in mags.values() if v > 0)
        require(list(mags.values()).count(best) == 1, 'Fastest/slowest part is not unique')
        target = {k for k, v in mags.items() if v == best}
    else:
        want = {'increasing': 1, 'decreasing': -1, 'constant': 0}[ask]
        target = {k for k, s in parts.items() if sign(s['to'][1] - s['from'][1]) == want}
    truth = []
    for o in options:
        label = strip(o['label'])
        require(label in parts, f'Option names no part: {label}')
        truth.append(label in target)
    # Exactly one listed option is true; an unlisted qualifying part would be harmless but must not be a listed distractor.
    return pick(options, truth)


# ---------------------------------------------------------------- coordinate contexts

def solve_coordinates(public):
    prompt = strip(public['prompt'])
    options = options_of(public)
    for o in options:
        singular_ok(strip(o['label']))
    singular_ok(prompt)
    if prompt.startswith('The graph has'):
        g = graph_of(public)
        m = re.fullmatch(r'The graph has (.+?) on the horizontal axis and (.+?) on the vertical axis\. What does the plotted point show\?', prompt)
        require(m and [m[1], m[2]] == g['axisNames'] and len(g['points']) == 1, 'Axes must agree with the figure')
        px, py = g['points'][0]['x'], g['points'][0]['y']
        assert_in_window(g)
        truth = []
        for o in options:
            t = strip(o['label'])
            ns = re.findall(r'(\d+) ([a-z]+)', t)
            if t.startswith('The place'):
                ok = [int(n) for n, _ in ns] == [px, py] and [w.rstrip('s') for _, w in ns[:2]] == ['block', 'block'] and 'east' in t and t.index('east') < t.index('north')
            else:
                ok = [int(n) for n, _ in ns[:2]] == [px, py]
                # The first number must be tied to the horizontal-axis word.
                ok = ok and ns[0][1].rstrip('s') == g['axisNames'][0].rstrip('s')
            truth.append(ok)
        return pick(options, truth)
    if m := re.fullmatch(r'Four points are labeled on the graph\. Which point shows this situation: (.*)\?', prompt):
        g = graph_of(public)
        assert_in_window(g)
        pts = g['points']
        require(len(pts) == 4 and len({(p['x'], p['y']) for p in pts}) == 4 and len({p['label'] for p in pts}) == 4, 'Four distinct labeled points required')
        x, y = situation_pair(m[1], g['axisNames'])
        truth = []
        for o in options:
            label = re.fullmatch(r'Point ([A-D])', strip(o['label']))
            require(label, 'Point option expected')
            p = next(q for q in pts if q['label'] == label[1])
            truth.append((p['x'], p['y']) == (x, y))
        return pick(options, truth)
    if m := re.fullmatch(r'(?:After|The place)(.*) Write this situation as an ordered pair \((.+?), (.+?)\)\. Which pair is correct\?', prompt):
        x, y = situation_pair(prompt.split(' Write this')[0].rstrip('.'), [m[2], m[3]])
        truth = []
        for o in options:
            mm = re.fullmatch(r'\((\d+), (\d+)\)', strip(o['label']))
            require(mm, 'Ordered pair expected')
            truth.append((int(mm[1]), int(mm[2])) == (x, y))
        return pick(options, truth)
    # Comparison of two points that share a horizontal value.
    g = graph_of(public)
    assert_in_window(g)
    a, b = g['points']
    require(a['label'] == 'A' and b['label'] == 'B' and a['x'] == b['x'], 'Compared points must share x')
    mx = re.search(r'(?:after|east of the school|measured after) (\d+)', prompt) or re.search(r'both (?:are )?(\d+) ', prompt)
    shared = re.search(r'(?:after|Both are) (\d+)', prompt)
    require(shared and int(shared[1]) == a['x'], 'Stated shared value must match the figure')
    asked_b = re.search(r'(more than|farther north is the park than|taller is Plant B than|has saved than Mia|How many more points does Team B have|How much more has Leo)', prompt)
    require(asked_b, 'Unrecognized comparison wording')
    require(b['y'] > a['y'], 'The point named second must be higher')
    diff = b['y'] - a['y']
    truth = []
    for o in options:
        mm = re.fullmatch(r'(\d+) [a-z]+', strip(o['label']))
        require(mm, 'Quantity option expected')
        truth.append(int(mm[1]) == diff)
    return pick(options, truth)


def assert_in_window(g):
    for p in g['points']:
        require(g['x'][0] <= p['x'] <= g['x'][1] and g['y'][0] <= p['y'] <= g['y'][1], 'Point outside the window')


def situation_pair(text, axis):
    ns = [int(n) for n in re.findall(r'(\d+)', text)]
    require(len(ns) == 2, f'Two quantities expected in {text}')
    if 'blocks east' in text or 'block east' in text:
        require(text.index('east') < text.index('north'), 'East before north')
        return ns[0], ns[1]
    # "after X <horizontal>, ... Y <vertical>"
    require(axis[0].rstrip('s') in text.split(',')[0] or axis[0].split()[0].rstrip('s') in text, 'Horizontal quantity must come first')
    return ns[0], ns[1]


# ---------------------------------------------------------------- patterns

def solve_patterns(public):
    prompt = strip(public['prompt'])
    options = options_of(public)
    m = re.match(r'Pattern A starts at (\d+) and adds (\d+) each time\. (.*)', prompt)
    require(m, 'Pattern A must be stated')
    a0, da = int(m[1]), int(m[2])
    A = lambda i: a0 + i * da  # i = 0 is the first term
    rest = m[3]
    if mm := re.match(r'Pattern B has the rule: each term of B is (\d+) times the matching term of A\. What is the (\d+)(?:st|nd|rd|th) term of Pattern B\?', rest):
        k, n = int(mm[1]), int(mm[2])
        want = k * A(n - 1)
        return pick(options, [int(strip(o['label'])) == want for o in options])
    mm = re.match(r'Pattern B starts at (\d+) and adds (\d+) each time\. (.*)', rest)
    require(mm, 'Pattern B must be stated')
    b0, db = int(mm[1]), int(mm[2])
    B = lambda i: b0 + i * db
    tail = mm[3]
    if tail.startswith('The first pairs are'):
        listed = [tuple(map(int, t)) for t in re.findall(r'\((\d+), (\d+)\)', tail)]
        require(listed == [(A(i), B(i)) for i in range(len(listed))] and len(listed) == 4, 'Listed pairs disagree with the rules')
        truth = []
        for o in options:
            s = strip(o['label'])
            r = re.fullmatch(r'Each term of ([AB]) is (\d+) (more|times) than the matching term of ([AB])\.'.replace('(more|times) than', '(more than|times)'), s) or \
                re.fullmatch(r'Each term of ([AB]) is (\d+) (times) the matching term of ([AB])\.', s)
            if not r:
                r = re.fullmatch(r'Each term of ([AB]) is (\d+) (more) than the matching term of ([AB])\.', s)
            require(r, f'Unreadable relationship {s}')
            first, k, kind, second = r[1], int(r[2]), r[3].split()[0], r[4]
            term = {'A': A, 'B': B}
            holds = all((term[first](i) == term[second](i) + k) if kind == 'more' else (term[first](i) == k * term[second](i)) for i in range(6))
            truth.append(holds)
        return pick(options, truth)
    if mm := re.fullmatch(r'Make ordered pairs \(term of A, matching term of B\)\. What is the (\d+)(?:st|nd|rd|th) ordered pair\?', tail):
        n = int(mm[1])
        want = (A(n - 1), B(n - 1))
        truth = []
        for o in options:
            p = re.fullmatch(r'\((\d+), (\d+)\)', strip(o['label']))
            require(p, 'Ordered pair expected')
            truth.append((int(p[1]), int(p[2])) == want)
        return pick(options, truth)
    raise ValueError('Unknown pattern variant')


# ---------------------------------------------------------------- triangle uniqueness

def count_triangles(measures, name):
    """Number of non-congruent triangles (0, 1, 2) or 'infinite', from named sides/angles."""
    sides = {}
    angles = {}
    for v, d in measures['angles']:
        angles[v] = d
    for s, length in measures['sides']:
        sides[frozenset(s)] = length
    if len(angles) == 3:
        return 'infinite' if sum(angles.values()) == 180 and all(a > 0 for a in angles.values()) else 0
    if len(sides) == 3:
        a, b, c = sorted(sides.values())
        return 1 if a + b > c else 0
    if len(angles) == 2:
        return 1 if sum(angles.values()) < 180 and all(a > 0 for a in angles.values()) else 0
    require(len(angles) == 1 and len(sides) == 2, 'Unsupported measure set')
    (vertex, deg), = angles.items()
    adjacent = [l for s, l in sides.items() if vertex in s]
    opposite = [l for s, l in sides.items() if vertex not in s]
    if len(adjacent) == 2:
        return 1 if 0 < deg < 180 else 0
    require(len(adjacent) == 1 and len(opposite) == 1, 'Unsupported side layout')
    b, a = adjacent[0], opposite[0]
    if deg >= 90:
        return 1 if a > b else 0
    h = b * math.sin(math.radians(deg))
    if abs(a - h) < 1e-9:
        return 1
    if a < h:
        return 0
    return 2 if a < b else 1


def parse_measures(text):
    angles = [(m[1], int(m[2])) for m in re.finditer(r'\\angle ([A-Z]) = (\d+)\^\\circ', text)]
    sides = [(m[1], int(m[2])) for m in re.finditer(r'(?<![\\a-z])([A-Z]{2}) = (\d+)\$? cm', text)]
    return {'angles': angles, 'sides': sides}


def solve_triangle(public):
    prompt = public['prompt']
    options = options_of(public)
    labels = {'No triangle': 0, 'Exactly one triangle': 1, 'Exactly two different triangles': 2, 'Infinitely many triangles of different sizes': 'infinite'}
    if prompt.startswith('Which set of measures determines exactly one triangle'):
        truth = []
        for o in options:
            measures = parse_measures(o['label'])
            truth.append(count_triangles(measures, None) == 1)
        return pick(options, truth)
    m = re.match(r'A triangle \$([A-Z]{3})\$ has \$\\angle ([A-Z]) = (\d+)\^\\circ\$, \$([A-Z]{2}) = (\d+)\$ cm and \$([A-Z]{2}) = (\d+)\$ cm\. Side \$([A-Z]{2})\$ is opposite \$\\angle ([A-Z])\$\. How many different triangles fit these measures\?', prompt)
    require(m, 'Unreadable triangle prompt')
    name, vertex, deg, s1, l1, s2, l2, opp, ov = m.groups()
    require(set(name) == set(vertex + s1 + s2) and vertex == ov and vertex not in opp and opp == s2, 'Named parts must be consistent with the triangle')
    require(vertex in s1 and set(opp) | {vertex} == set(name), 'Opposite side must be the one missing the angle vertex')
    expected = count_triangles({'angles': [(vertex, int(deg))], 'sides': [(s1, int(l1)), (s2, int(l2))]}, name)
    # Independent geometric cross-check: sin B = b sin A / a decides the number of solutions.
    b, a, A = int(l1), int(l2), math.radians(int(deg))
    ratio = b * math.sin(A) / a
    if ratio > 1 + 1e-9:
        alt = 0
    elif abs(ratio - 1) <= 1e-9:
        alt = 1 if A < math.pi / 2 else 0
    else:
        B1 = math.asin(min(1.0, ratio))
        sols = {round(B1, 9), round(math.pi - B1, 9)}
        alt = sum(1 for B in sols if A + B < math.pi - 1e-9)
    require(alt == expected, 'Law-of-sines count disagrees with the case count')
    return pick(options, [labels[strip(o['label'])] == expected for o in options])


# ---------------------------------------------------------------- percent applications

def money(text):
    return Fraction(text)


def option_value(label):
    t = strip(label).strip()
    if m := re.fullmatch(r'(-?\d+(?:\.\d+)?)%', t):
        return ('percent', number(m[1]))
    if m := re.fullmatch(r'(\d*)\\frac\{(\d+)\}\{(\d+)\}%', t):
        return ('percent', int(m[1] or 0) + Fraction(int(m[2]), int(m[3])))
    if m := re.fullmatch(r'(-?\d+(?:\.\d+)?) (dollars?|[a-z]+)', t):
        return (m[2], number(m[1]))
    raise ValueError(f'Unreadable value {label}')


def solve_percent(public):
    prompt = strip(public['prompt'])
    options = options_of(public)
    d = r'(\d+(?:\.\d+)?)'
    if m := re.fullmatch(rf'A jacket costs {d} dollars before tax\. The sales tax is {d}% of the price\. What is the total cost, including tax\?', prompt):
        want = ('dollars', number(m[1]) * (1 + number(m[2]) / 100))
    elif m := re.fullmatch(rf'A dinner bill is {d} dollars\. You leave a tip of {d}% of the bill\. How much do you pay in all, with the tip\?', prompt):
        want = ('dollars', number(m[1]) * (1 + number(m[2]) / 100))
    elif m := re.fullmatch(rf'A bike costs {d} dollars\. It is on sale for {d}% off\. What is the sale price\?', prompt):
        want = ('dollars', number(m[1]) * (1 - number(m[2]) / 100))
    elif m := re.fullmatch(rf'A store buys a lamp for {d} dollars and marks up the price by {d}% of the cost\. What is the selling price\?', prompt):
        want = ('dollars', number(m[1]) * (1 + number(m[2]) / 100))
    elif m := re.fullmatch(rf'A salesperson earns a base pay of {d} dollars plus a commission of {d}% of the sales\. This week the sales were {d} dollars\. What is the total pay\?', prompt):
        want = ('dollars', number(m[1]) + number(m[2]) / 100 * number(m[3]))
    elif m := re.fullmatch(rf'You put {d} dollars in an account that pays simple interest of {d}% per year on the amount you put in\. You leave it for {d} years\. How much interest do you earn in all\?', prompt):
        want = ('dollars', number(m[1]) * number(m[2]) / 100 * number(m[3]))
    elif m := re.fullmatch(rf'You put {d} dollars in an account that pays simple interest of {d}% per year on the amount you put in\. You leave it for {d} years\. How much is in the account then, with the interest\?', prompt):
        want = ('dollars', number(m[1]) * (1 + number(m[2]) / 100 * number(m[3])))
    elif m := re.fullmatch(rf'You put {d} dollars in an account with simple interest\. After {d} years you have earned {d} dollars in interest\. What is the yearly interest rate\?', prompt):
        want = ('percent', number(m[3]) / (number(m[1]) * number(m[2])) * 100)
    elif m := re.fullmatch(rf'A coat was {d} dollars\. It is now {d} dollars\. What percent of the original price was taken off\?', prompt):
        want = ('percent', (number(m[1]) - number(m[2])) / number(m[1]) * 100)
    elif m := re.fullmatch(rf'A scale shows {d} ([a-z]+) for an object whose true amount is {d} ([a-z]+)\. What is the percent error, the size of the error as a percent of the true amount\?', prompt):
        require(m[2] == m[4], 'Units must agree')
        measured, actual = number(m[1]), number(m[3])
        want = ('percent', abs(measured - actual) / actual * 100)
    else:
        raise ValueError('Unknown percent-applications prompt')
    if want[0] == 'dollars':
        require((want[1] * 100).denominator == 1, 'Dollar answer must be exact in cents')
    values = [option_value(o['label']) for o in options]
    require(len(set(values)) == 4, 'Mathematically duplicate options')
    truth = [v[1] == want[1] and (v[0] == 'percent') == (want[0] == 'percent') and (v[0] in ('percent', 'dollars', 'dollar') or v[0] not in ('percent',) and want[0] == 'dollars' and v[0].startswith('dollar')) for v in values]
    # An absolute-error distractor ("9 seconds") is a different quantity, never the percent answer.
    return pick(options, truth)


# ---------------------------------------------------------------- compound events

def prob_value(label):
    t = strip(label).strip()
    if m := re.fullmatch(r'\\frac\{(\d+)\}\{(\d+)\}', t):
        return Fraction(int(m[1]), int(m[2]))
    return Fraction(t)


def outcomes_and_event(text):
    """Return (outcomes, predicate) for an event sentence about a sample space."""
    if m := re.match(r'Two fair (\d+)-sided dice, each with faces 1 to (\d+), are rolled\. (.*)', text):
        n = int(m[1])
        require(int(m[2]) == n, 'Die faces must match')
        space = list(itertools.product(range(1, n + 1), repeat=2))
        return space, m[3]
    if m := re.match(r'A fair coin is flipped and a fair (\d+)-sided die is rolled\. (.*)', text):
        space = list(itertools.product('HT', range(1, int(m[1]) + 1)))
        return space, m[2]
    if m := re.match(r'A fair coin is flipped (\d+) times\. (.*)', text):
        space = list(itertools.product('HT', repeat=int(m[1])))
        return space, m[2]
    if text.startswith('Spinner 1 has three equal parts: red, blue and green. Spinner 2 has four equal parts numbered 1 to 4. Both are spun once. '):
        space = list(itertools.product(['red', 'blue', 'green'], range(1, 5)))
        return space, text.split('spun once. ')[1]
    raise ValueError('Unknown sample space')


def event_predicate(event, space):
    e = event
    if e == 'the product is even':
        return lambda o: (o[0] * o[1]) % 2 == 0
    if e == 'both dice show the same number':
        return lambda o: o[0] == o[1]
    if m := re.fullmatch(r'the sum is at least (\d+)', e):
        return lambda o, k=int(m[1]): o[0] + o[1] >= k
    if m := re.fullmatch(r'the sum is (\d+)', e):
        return lambda o, k=int(m[1]): o[0] + o[1] == k
    if e == 'the coin shows heads and the die shows an even number':
        return lambda o: o[0] == 'H' and o[1] % 2 == 0
    if m := re.fullmatch(r'the coin shows heads and the die shows at least (\d+)', e):
        return lambda o, k=int(m[1]): o[0] == 'H' and o[1] >= k
    if m := re.fullmatch(r'the coin shows tails or the die shows (\d+)', e):
        return lambda o, k=int(m[1]): o[0] == 'T' or o[1] == k
    if m := re.fullmatch(r'exactly (\d+) flips show heads', e):
        return lambda o, k=int(m[1]): o.count('H') == k
    if m := re.fullmatch(r'all (\d+) flips show the same side', e):
        return lambda o: len(set(o)) == 1
    if m := re.fullmatch(r'at least (\d+) flips? shows? tails', e):
        return lambda o, k=int(m[1]): o.count('T') >= k
    if e == 'the first and last flips are different':
        return lambda o: o[0] != o[-1]
    if e == 'the first spinner does not land on red and the second spinner lands on a number greater than 2':
        return lambda o: o[0] != 'red' and o[1] > 2
    if e == 'the first spinner lands on red and the second spinner lands on an even number':
        return lambda o: o[0] == 'red' and o[1] % 2 == 0
    raise ValueError(f'Unknown event: {e}')


def theory(text_head, event_text):
    space, _ = outcomes_and_event(text_head + ' x')
    pred = event_predicate(event_text, space)
    return Fraction(sum(1 for o in space if pred(o)), len(space))


def solve_compound(public):
    prompt = strip(public['prompt'])
    options = options_of(public)
    if 'Here are' in prompt:
        m = re.search(r'Here are (\d+) trials: ([0-9, ]+)\. Based on these trials, what is the estimated probability that (.*)\?', prompt)
        require(m, 'Trial table required')
        n, trials, event = int(m[1]), [t.strip() for t in m[2].split(',')], m[3]
        require(len(trials) == n and len(set(map(len, trials))) == 1, 'Trial count and width must match the statement')
        if prompt.startswith('A family has'):
            k = int(re.match(r'A family has (\d+) children', prompt)[1])
            require(all(len(t) == k for t in trials) and 'even digit (0, 2, 4, 6, 8) means a girl' in prompt, 'Family digit rule')
            girls = lambda t: sum(1 for c in t if int(c) % 2 == 0)
            if event == f'all {k} children are the same':
                pred = lambda t: girls(t) in (0, k)
            elif mm := re.fullmatch(r'the family has exactly (\d+) girls?', event):
                pred = lambda t, j=int(mm[1]): girls(t) == j
            elif mm := re.fullmatch(r'the family has at least (\d+) girls?', event):
                pred = lambda t, j=int(mm[1]): girls(t) >= j
            else:
                raise ValueError('Unknown family event')
        else:
            mm = re.search(r'makes (\d+)% of free throws\. To simulate two shots, use random digits: (\d) to (\d) mean a made shot and (\d) to (\d) mean a miss\. Each pair of digits is one trial, two shots', prompt)
            require(mm and all(len(t) == 2 for t in trials), 'Free-throw digit rule')
            lo, hi, mlo, mhi = int(mm[2]), int(mm[3]), int(mm[4]), int(mm[5])
            require(lo == 0 and mlo == hi + 1 and mhi == 9 and Fraction(hi + 1, 10) == Fraction(int(mm[1]), 100), 'Digits must model the stated percent exactly')
            made = lambda t: sum(1 for c in t if int(c) <= hi)
            if event == 'the player makes both shots':
                pred = lambda t: made(t) == 2
            elif ee := re.fullmatch(r'the player makes exactly (\d+) shots?', event):
                pred = lambda t, j=int(ee[1]): made(t) == j
            elif ee := re.fullmatch(r'the player makes at least (\d+) shots?', event):
                pred = lambda t, j=int(ee[1]): made(t) >= j
            else:
                raise ValueError('Unknown free-throw event')
        want = Fraction(sum(1 for t in trials if pred(t)), n)
        values = [prob_value(o['label']) for o in options]
        require(len(set(values)) == 4, 'Mathematically duplicate options')
        return pick(options, [v == want for v in values])
    if 'How does the experimental probability compare' in prompt:
        m = re.fullmatch(r'(.*?) The theoretical probability that (.*?) is \\frac\{(\d+)\}\{(\d+)\}\. In (\d+) trials of a simulation, this happened (\d+) times\. How does the experimental probability compare with the theoretical probability\?', prompt)
        require(m, 'Unreadable comparison prompt')
        head, event = m[1], m[2]
        stated = Fraction(int(m[3]), int(m[4]))
        require(theory(head, event) == stated, 'Stated theoretical probability is wrong')
        n, hits = int(m[5]), int(m[6])
        require(0 <= hits <= n, 'Impossible simulation count')
        experimental = Fraction(hits, n)
        truth = []
        for o in options:
            t = strip(o['label'])
            if t.startswith('The experimental and theoretical probabilities must be equal'):
                truth.append(False)
                continue
            r = re.fullmatch(r'The experimental probability, \\frac\{(\d+)\}\{(\d+)\}, is (greater than|less than|equal to) the theoretical probability, \\frac\{(\d+)\}\{(\d+)\}\.', t)
            require(r and (int(r[1]), int(r[2])) == (hits, n) and Fraction(int(r[4]), int(r[5])) == stated and (int(r[4]), int(r[5])) == (int(m[3]), int(m[4])), 'Echoed fractions must match the givens')
            rel = {'greater than': experimental > stated, 'less than': experimental < stated, 'equal to': experimental == stated}[r[3]]
            truth.append(rel)
        return pick(options, truth)
    m = re.fullmatch(r'(.*?) What is the probability that (.*?)\? Count the outcomes of the sample space, where every outcome is equally likely\.', prompt)
    require(m, 'Unreadable sample-space prompt')
    want = theory(m[1], m[2])
    values = [prob_value(o['label']) for o in options]
    require(len(set(values)) == 4, 'Mathematically duplicate options')
    correct = [o for o, v in zip(options, values) if v == want]
    require(len(correct) == 1 and re.fullmatch(r'\\frac\{(\d+)\}\{(\d+)\}', strip(correct[0]['label']).strip()) is not None, 'Missing answer')
    mm = re.fullmatch(r'\\frac\{(\d+)\}\{(\d+)\}', strip(correct[0]['label']).strip())
    require(math.gcd(int(mm[1]), int(mm[2])) == 1, 'Answer fraction must be in lowest terms')
    return pick(options, [v == want for v in values])


# ---------------------------------------------------------------- entry points

SOLVERS = {
    'proportional-graph': solve_proportional,
    'story-graph-match': solve_story,
    'coordinate-context-points': solve_coordinates,
    'pattern-pair-relationship': solve_patterns,
    'triangle-uniqueness': solve_triangle,
    'percent-applications': solve_percent,
    'compound-event-simulation': solve_compound,
}


def solve(public):
    require(public['templateId'] in SUPPORTED, 'Unexpected K-8 representation family')
    return SOLVERS[public['templateId']](public)


def review_problem(problem):
    result = solve(problem['public'])
    require(result == problem['answer'], 'K-8 representation answer key mismatch')
    prompt = strip(problem['public']['prompt'])
    correct = next(o for o in problem['public']['response']['options'] if o['id'] == result)
    label = strip(correct['label']).strip()
    # The correct label must not be spoiled by the question text itself when it is a bare value.
    if re.fullmatch(r'[\d.]+( dollars| centimeters| liters| pages)?%?', label):
        require(label not in re.findall(r'[\d.]+ ?[a-z%]*', prompt) or label.split()[0] in re.findall(r'\d+', prompt) and False, 'Answer value appears in the prompt')
    return result


# ---------------------------------------------------------------- self test

def make(template, prompt, labels, answer=0, figure=None):
    public = {
        'templateId': template,
        'prompt': prompt,
        'response': {'kind': 'choice', 'options': [{'id': f'option-{i}', 'label': l} for i, l in enumerate(labels)]},
    }
    if figure:
        public['figure'] = {'kind': 'scene', 'scene': {'v': 1, 'elements': [figure]}}
    return {'public': public, 'answer': f'option-{answer}'}


def self_test():
    rejected = 0

    def reject(problem):
        nonlocal rejected
        try:
            review_problem(problem)
        except (ValueError, KeyError, IndexError, StopIteration, AttributeError):
            rejected += 1
            return
        raise ValueError('Corrupt K-8 representation case was accepted')

    def wrong_key(problem):
        bad = copy.deepcopy(problem)
        bad['answer'] = 'option-3' if problem['answer'] != 'option-3' else 'option-2'
        reject(bad)

    def alias(problem, index, label):
        bad = copy.deepcopy(problem)
        bad['public']['response']['options'][index]['label'] = label
        reject(bad)

    graph = {'type': 'graph', 'x': [0, 6], 'y': [0, 25], 'axisNames': ['hours', 'miles'],
             'points': [{'x': 2, 'y': 8, 'label': '(2, 8)'}],
             'curves': [{'fn': {'f': 'poly', 'c': [0, 4]}, 'domain': [0, 6]}]}
    fixtures = []

    eq = make('proportional-graph', 'A cyclist rides at a steady speed. Let $x$ be the number of hours and $y$ the number of miles. Which equation matches the graph?',
              ['$y = 4x$', '$y = \\frac{x}{4}$', '$y = x + 4$', '$y = 8x$'], 0, graph)
    fixtures.append(eq)
    wrong_key(eq)
    alias(eq, 1, '$y = 4.0x$')
    bad = copy.deepcopy(eq); bad['public']['figure']['scene']['elements'][0]['points'][0]['y'] = 9; reject(bad)
    bad = copy.deepcopy(eq); bad['public']['figure']['scene']['elements'][0]['curves'][0]['fn']['c'] = [0, 3]; reject(bad)

    unit = make('proportional-graph', 'A cyclist rides at a steady speed. The graph shows miles for different numbers of hours. What is the unit rate, the number of miles for 1 hour?',
                ['4 miles per hour', '8 miles per hour', '2 miles per hour', '16 miles per hour'], 0, graph)
    fixtures.append(unit)
    wrong_key(unit)
    alias(unit, 1, '4 miles per hour')

    meaning = make('proportional-graph', 'A cyclist rides at a steady speed. The graph shows miles for different numbers of hours. What does the labeled point $(2, 8)$ mean?',
                   ['In 2 hours the cyclist rides 8 miles.', 'In 8 hours the cyclist rides 2 miles.', 'The unit rate is 8 miles per hour.', 'Every hour adds 4 miles.'], 0, graph)
    reject(meaning)  # Every hour adds 4 is true of the line: ambiguous with the point meaning.
    meaning['public']['response']['options'][3]['label'] = 'Every hour adds 3 miles.'
    fixtures.append(meaning)
    wrong_key(meaning)

    stories = {'type': 'graph', 'x': [0, 6], 'y': [0, 8], 'axisNames': ['time', 'height above the ground'],
               'segments': [{'from': [0, 1], 'to': [2, 1]}, {'from': [2, 1], 'to': [4, 5]}, {'from': [4, 5], 'to': [6, 5]}]}
    story = make('story-graph-match', 'The graph shows the height above the ground over time. Which story matches the graph?',
                 ['A drone hovers, then climbs, then hovers.', 'A drone climbs, then hovers, then descends.', 'A drone hovers, then climbs, then descends.', 'A drone descends, then climbs, then hovers.'], 0, stories)
    fixtures.append(story)
    wrong_key(story)
    alias(story, 1, 'A drone hovers, then climbs, then hovers.')
    bad = copy.deepcopy(story); bad['public']['figure']['scene']['elements'][0]['segments'][2]['to'] = [6, 2]; reject(bad)

    description = make('story-graph-match', 'A drone climbs, then hovers, then descends. Which description fits the graph of the height above the ground over time, read from left to right?',
                       ['Increasing, then constant, then decreasing.', 'Constant, then increasing, then decreasing.', 'Increasing, then decreasing, then constant.', 'Decreasing, then constant, then increasing.'], 0)
    fixtures.append(description)
    wrong_key(description)

    points = {'type': 'graph', 'x': [0, 10], 'y': [0, 10], 'axisNames': ['weeks', 'dollars'],
              'points': [{'x': 8, 'y': 1}]}
    cp = make('coordinate-context-points', 'The graph has weeks on the horizontal axis and dollars on the vertical axis. What does the plotted point show?',
              ['After 8 weeks, the student has saved 1 dollar.', 'After 1 week, the student has saved 8 dollars.', 'After 9 weeks, the student has saved 1 dollar.', 'After 8 weeks, the student has saved 2 dollars.'], 0, points)
    fixtures.append(cp)
    wrong_key(cp)
    bad = copy.deepcopy(cp); bad['public']['figure']['scene']['elements'][0]['points'][0]['x'] = 1; reject(bad)
    pair = make('coordinate-context-points', 'After 8 weeks, the student has saved 4 dollars. Write this situation as an ordered pair (weeks, dollars). Which pair is correct?',
                ['$(8, 4)$', '$(4, 8)$', '$(8, 5)$', '$(9, 4)$'], 0)
    fixtures.append(pair)
    wrong_key(pair)
    alias(pair, 1, '$(8, 4)$')

    pat = make('pattern-pair-relationship', 'Pattern A starts at 1 and adds 4 each time. Pattern B has the rule: each term of B is 3 times the matching term of A. What is the 10th term of Pattern B?',
               ['111', '37', '40', '123'], 0)
    fixtures.append(pat)
    wrong_key(pat)
    pat2 = make('pattern-pair-relationship', 'Pattern A starts at 1 and adds 2 each time. Pattern B starts at 4 and adds 2 each time. The first pairs are (1, 4), (3, 6), (5, 8), (7, 10). How are the terms of B related to the matching terms of A?',
                ['Each term of B is 3 more than the matching term of A.', 'Each term of A is 3 more than the matching term of B.', 'Each term of B is 2 more than the matching term of A.', 'Each term of B is 3 times the matching term of A.'], 0)
    fixtures.append(pat2)
    wrong_key(pat2)
    bad = copy.deepcopy(pat2); bad['public']['prompt'] = bad['public']['prompt'].replace('(3, 6)', '(3, 7)'); reject(bad)

    tri_labels = ['Exactly two different triangles', 'No triangle', 'Exactly one triangle', 'Infinitely many triangles of different sizes']
    tri = make('triangle-uniqueness', 'A triangle $ABC$ has $\\angle A = 30^\\circ$, $AC = 10$ cm and $BC = 6$ cm. Side $BC$ is opposite $\\angle A$. How many different triangles fit these measures? Triangles with the same size and shape count as one.', tri_labels, 0)
    fixtures.append(tri)
    wrong_key(tri)
    for h_case, a_len, correct in ((30, 5, 2), (30, 4, 1), (30, 2, 0), (30, 10, 1), (90, 10, 0), (100, 12, 1), (100, 4, 0)):
        pass
    cases = [(30, 10, 5, 'Exactly one triangle'), (30, 10, 4, 'No triangle'), (30, 10, 12, 'Exactly one triangle'), (90, 10, 6, 'No triangle'), (100, 7, 12, 'Exactly one triangle'), (30, 10, 10, 'Exactly one triangle'), (45, 10, 8, 'Exactly two different triangles')]
    for deg, b, a, label in cases:
        order = [label] + [l for l in tri_labels if l != label]
        t = make('triangle-uniqueness', f'A triangle $ABC$ has $\\angle A = {deg}^\\circ$, $AC = {b}$ cm and $BC = {a}$ cm. Side $BC$ is opposite $\\angle A$. How many different triangles fit these measures? Triangles with the same size and shape count as one.', order, 0)
        review_problem(t)
        wrong_key(t)
    tset = make('triangle-uniqueness', 'Which set of measures determines exactly one triangle $PQR$? Triangles with the same size and shape count as one.',
                ['$PQ = 6$ cm, $\\angle P = 50^\\circ$, $PR = 6$ cm', '$PQ = 3$ cm, $QR = 4$ cm, $RP = 11$ cm', '$\\angle P = 40^\\circ$, $\\angle Q = 70^\\circ$, $\\angle R = 70^\\circ$', '$\\angle P = 117^\\circ$, $\\angle Q = 94^\\circ$, $PQ = 4$ cm'], 0)
    fixtures.append(tset)
    wrong_key(tset)
    alias(tset, 1, '$PQ = 3$ cm, $QR = 4$ cm, $RP = 6$ cm')

    pa = make('percent-applications', 'A dinner bill is 114 dollars. You leave a tip of 18% of the bill. How much do you pay in all, with the tip?',
              ['134.52 dollars', '20.52 dollars', '93.48 dollars', '132 dollars'], 0)
    fixtures.append(pa)
    wrong_key(pa)
    alias(pa, 1, '134.520 dollars')
    pe = make('percent-applications', 'A scale shows 54 seconds for an object whose true amount is 45 seconds. What is the percent error, the size of the error as a percent of the true amount?',
              ['20%', '9 seconds', '$16\\frac{2}{3}\\%$', '5%'], 0)
    fixtures.append(pe)
    wrong_key(pe)
    alias(pe, 1, '20.0%')
    bad = copy.deepcopy(pe); bad['public']['prompt'] = bad['public']['prompt'].replace('true amount is 45', 'true amount is 46'); reject(bad)
    pc = make('percent-applications', 'A bike costs 33 dollars. It is on sale for 15% off. What is the sale price?', ['28.05 dollars', '4.95 dollars', '37.95 dollars', '18 dollars'], 0)
    fixtures.append(pc)
    pr = make('percent-applications', 'A jacket costs 33 dollars before tax. The sales tax is 4.5% of the price. What is the total cost, including tax?', ['34.49 dollars', '1.49 dollars', '31.51 dollars', '37 dollars'], 0)
    reject(pr)  # 34.485 is not exact in cents

    ce = make('compound-event-simulation', 'Two fair 4-sided dice, each with faces 1 to 4, are rolled. What is the probability that the product is even? Count the outcomes of the sample space, where every outcome is equally likely.',
              ['$\\frac{3}{4}$', '$\\frac{13}{16}$', '$\\frac{1}{4}$', '$\\frac{1}{16}$'], 0)
    fixtures.append(ce)
    wrong_key(ce)
    alias(ce, 1, '$\\frac{6}{8}$')
    cmp_ = make('compound-event-simulation', 'Two fair 4-sided dice, each with faces 1 to 4, are rolled. The theoretical probability that the sum is at least 6 is $\\frac{3}{8}$. In 40 trials of a simulation, this happened 15 times. How does the experimental probability compare with the theoretical probability?',
                ['The experimental probability, $\\frac{15}{40}$, is equal to the theoretical probability, $\\frac{3}{8}$.', 'The experimental probability, $\\frac{15}{40}$, is greater than the theoretical probability, $\\frac{3}{8}$.', 'The experimental probability, $\\frac{15}{40}$, is less than the theoretical probability, $\\frac{3}{8}$.', 'The experimental and theoretical probabilities must be equal, so the trials were done wrongly.'], 0)
    fixtures.append(cmp_)
    wrong_key(cmp_)
    bad = copy.deepcopy(cmp_); bad['public']['prompt'] = bad['public']['prompt'].replace('\\frac{3}{8}$. In', '\\frac{1}{3}$. In'); reject(bad)
    sim = make('compound-event-simulation', 'A player makes 60% of free throws. To simulate two shots, use random digits: 0 to 5 mean a made shot and 6 to 9 mean a miss. Each pair of digits is one trial, two shots. Here are 20 trials: 98, 09, 77, 56, 70, 84, 52, 94, 26, 90, 48, 72, 29, 31, 68, 96, 99, 56, 28, 80. Based on these trials, what is the estimated probability that the player makes both shots?',
               ['$\\frac{1}{10}$', '$\\frac{3}{4}$', '$\\frac{9}{10}$', '$\\frac{13}{20}$'], 0)
    fixtures.append(sim)
    wrong_key(sim)
    bad = copy.deepcopy(sim); bad['public']['prompt'] = bad['public']['prompt'].replace('31,', '61,'); reject(bad)
    bad = copy.deepcopy(sim); bad['public']['prompt'] = bad['public']['prompt'].replace('0 to 5 mean', '0 to 6 mean'); reject(bad)

    for fixture in fixtures:
        if fixture is meaning:
            pass
        review_problem(fixture)
    return {'fixtures': len(fixtures), 'rejectedMutations': rejected}

# Read by independent-math-review.py (FamilyOracle).
CHOICE_REVIEW = SUPPORTED



if __name__ == '__main__':
    print(self_test())
