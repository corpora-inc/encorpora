"""Independent prompt-and-figure oracle for the probability-rules family (S-CP).

Every answer is found by building the sample space the public problem
describes and counting in it: a population of labeled individuals for Venn
diagrams and tables, the 52 cards of a deck, the whole numbers of a range, the
ordered pairs of a draw without replacement, or a population of trials split
by the stated rates. The addition and multiplication rules that the generator
teaches are never applied. Generated answers, hints and explanations never
enter `solve_probability_rules`.
"""
import itertools
import math
import re
from fractions import Fraction

PROBABILITY_RULES = frozenset({
    'event-set-count', 'addition-rule-probability',
    'conditional-probability-value', 'multiplication-rule-probability',
})

# Each context's phrases, singular ("takes art") and plural ("take art"), map
# to the circle they describe. Negations are recognized separately.
TRAITS = {
    'Art': ('takes art', 'take art', 'does not take art', 'do not take art'),
    'Music': ('takes music', 'take music', 'does not take music', 'do not take music'),
    'Dog': ('owns a dog', 'own a dog', 'does not own a dog', 'do not own a dog'),
    'Cat': ('owns a cat', 'own a cat', 'does not own a cat', 'do not own a cat'),
    'Coffee': ('bought coffee', 'bought coffee', 'did not buy coffee', 'did not buy coffee'),
    'Pastry': ('bought a pastry', 'bought a pastry', 'did not buy a pastry', 'did not buy a pastry'),
    'Swim': ('swims', 'swim', 'does not swim', 'do not swim'),
    'Yoga': ('does yoga', 'do yoga', 'does not do yoga', 'do not do yoga'),
}
GROUPS = {
    'students in a club': ('Art', 'Music', 'take both'),
    'households on a street': ('Dog', 'Cat', 'own both'),
    'customers at a café one morning': ('Coffee', 'Pastry', 'bought both'),
    'members of a gym': ('Swim', 'Yoga', 'do both'),
}
# Survey predicates: the row or column each one selects.
SURVEY = {
    'is in grade 9': ('row', 'Grade 9'), 'is in grade 10': ('row', 'Grade 10'),
    'prefers online classes': ('column', 'Online'), 'prefers in-person classes': ('column', 'In person'),
    'is an adult': ('row', 'Adult'), 'is a child': ('row', 'Child'),
    'chose the museum': ('column', 'Museum'), 'chose the zoo': ('column', 'Zoo'), 'chose the park': ('column', 'Park'),
    'is a junior': ('row', 'Juniors'), 'is a senior': ('row', 'Seniors'),
    'plays soccer': ('column', 'Soccer'), 'runs track': ('column', 'Track'),
    'is under 40': ('row', 'Under 40'), 'is 40 or over': ('row', '40 or over'),
    'voted yes': ('column', 'Yes'), 'voted no': ('column', 'No'),
}
SUITS = ('hearts', 'diamonds', 'clubs', 'spades')
DECK = [(rank, suit) for suit in SUITS for rank in range(1, 14)]
CARD_EVENTS = {
    'a heart': lambda c: c[1] == 'hearts',
    'a club': lambda c: c[1] == 'clubs',
    'a red card': lambda c: c[1] in ('hearts', 'diamonds'),
    'a black card': lambda c: c[1] in ('clubs', 'spades'),
    'a face card (jack, queen or king)': lambda c: c[0] in (11, 12, 13),
    'a king': lambda c: c[0] == 13,
    'a queen': lambda c: c[0] == 12,
    'an ace': lambda c: c[0] == 1,
    'a number card from 2 to 10': lambda c: 2 <= c[0] <= 10,
}
DECK_INTRO = ('A card is drawn at random from a standard deck of 52 cards (13 cards in each of the four suits: '
              'hearts, diamonds, clubs and spades; hearts and diamonds are red)')
NUMBER = r'(\d+(?:\.\d+)?(?:/\d+)?)'


def plain(text):
    """Read the TeX the generator writes ($P(A \\text{ and } B) = \\frac{1}{4}$) as plain notation."""
    def inner(m):
        t = m[1]
        t = re.sub(r'\\frac\{(\d+)\}\{(\d+)\}', r'\1/\2', t)
        t = re.sub(r'\\text\{ ?(and|or) ?\}', r' \1 ', t)
        t = re.sub(r'\\text\{([^}]*)\}', r'\1', t)
        for a, b in (('\\cup', '∪'), ('\\cap', '∩'), ('\\mid', '|'), ('\\times', '×'), ('\\div', '÷'), ("'", '′'), ('-', '−')):
            t = t.replace(a, b)
        return re.sub(r'\s+', ' ', t).strip()
    return re.sub(r'\$([^$]*)\$', inner, text)


def require(condition, message):
    if not condition:
        raise ValueError(message)


def value(text):
    require(re.fullmatch(r'\d+(?:\.\d+)?(?:/\d+)?', text) is not None, f'Not a plain value: {text}')
    return Fraction(text)


def scene_element(public, kind):
    figure = public.get('figure')
    require(figure and figure.get('kind') == 'scene', 'A scene figure is required')
    found = [e for e in figure['scene']['elements'] if e.get('type') == kind]
    require(len(found) == 1, f'Exactly one {kind}')
    return found[0]


# ---------------------------------------------------------------- set algebra
def parse_set(text, universe, sets):
    """Evaluate a two-event set expression (∪, ∩, ′, parentheses) over `universe`."""
    tokens = re.findall(r'[A-Z]|[∪∩′()]', text)
    require(''.join(tokens) == text.replace(' ', ''), f'Unreadable set expression {text}')
    pos = 0

    def atom():
        nonlocal pos
        require(pos < len(tokens), 'Truncated expression')
        t = tokens[pos]
        pos += 1
        if t == '(':
            inner = expr()
            require(pos < len(tokens) and tokens[pos] == ')', 'Unclosed parenthesis')
            pos += 1
            result = inner
        else:
            require(t in sets, f'Unknown event {t}')
            result = sets[t]
        while pos < len(tokens) and tokens[pos] == '′':
            pos += 1
            result = universe - result
        return result

    def expr():
        nonlocal pos
        left = atom()
        while pos < len(tokens) and tokens[pos] in '∪∩':
            op = tokens[pos]
            pos += 1
            right = atom()
            left = left | right if op == '∪' else left & right
        return left

    result = expr()
    require(pos == len(tokens), f'Trailing symbols in {text}')
    return result


def population(regions):
    """Labeled individuals with their memberships: one per counted outcome."""
    people = []
    for key in ('a', 'ab', 'b', 'none'):
        people += [(key, i) for i in range(regions[key])]
    universe = frozenset(people)
    first = frozenset(p for p in people if p[0] in ('a', 'ab'))
    second = frozenset(p for p in people if p[0] in ('ab', 'b'))
    return universe, first, second


def venn_regions(public):
    v = scene_element(public, 'venn')
    names = [re.fullmatch(r'(\w+) \(([A-Z])\)', s) for s in v['sets']]
    require(all(names), 'Venn sets are named "Word (L)"')
    regions = v.get('regions', {})
    counts = {k: int(regions[k]) for k in ('a', 'ab', 'b', 'none') if regions.get(k) is not None}
    m = re.fullmatch(r'(\d+) (\w+)', v.get('universe', ''))
    require(m is not None, 'The universe states its size')
    return [n[1] for n in names], [n[2] for n in names], counts, int(m[1])


def words_event(phrase, names, plural=True):
    """'take art but do not take music' etc. -> predicate over (inA, inB)."""
    idx = 1 if plural else 0
    neg = 3 if plural else 2
    pos_of = {TRAITS[n][idx]: i for i, n in enumerate(names)}
    neg_of = {TRAITS[n][neg]: i for i, n in enumerate(names)}

    def literal(text):
        if text in pos_of:
            return lambda m, i=pos_of[text]: m[i]
        if text in neg_of:
            return lambda m, i=neg_of[text]: not m[i]
        raise ValueError(f'Unknown phrase {text}')
    for joiner, combine in ((' but ', all), (' and ', all), (' or ', any)):
        if joiner in phrase:
            left, right = phrase.split(joiner)
            f, g = literal(left), literal(right)
            return lambda m: combine((f(m), g(m)))
    return literal(phrase)


def count_words(regions, predicate):
    members = {'a': (True, False), 'ab': (True, True), 'b': (False, True), 'none': (False, False)}
    return sum(n for key, n in regions.items() if predicate(members[key]))


# ------------------------------------------------------------ number events
def number_predicate(text):
    text = text.removeprefix('the number ').removeprefix('it ')
    if text == 'is even':
        return lambda x: x % 2 == 0
    if text == 'is odd':
        return lambda x: x % 2 == 1
    if text == 'is prime':
        return lambda x: x > 1 and all(x % d for d in range(2, math.isqrt(x) + 1))
    m = re.fullmatch(r'is a multiple of (\d+)', text)
    if m:
        k = int(m[1])
        return lambda x: x % k == 0
    m = re.fullmatch(r'is greater than (\d+)', text)
    if m:
        t = int(m[1])
        return lambda x: x > t
    raise ValueError(f'Unknown number event {text}')


# ---------------------------------------------------------------- templates
def solve_event_sets(public):
    prompt = public['prompt']
    m = re.fullmatch(r'A whole number from 1 to (\d+) is chosen at random\. Event A: (.+?)\. Event B: (.+?)\. '
                     r'How many outcomes are in the event (.+)\?', prompt)
    if m:
        n = int(m[1])
        universe = frozenset(range(1, n + 1))
        a = frozenset(x for x in universe if number_predicate(m[2])(x))
        b = frozenset(x for x in universe if number_predicate(m[3])(x))
        return Fraction(len(parse_set(m[4], universe, {'A': a, 'B': b})))
    m = re.fullmatch(r'Of (\d+) (.+?), (\d+) (.+?), (\d+) (.+?) and (\d+) (.+?)\. How many (\w+) (.+)\?', prompt)
    if m:
        total, group = int(m[1]), m[2]
        require(group in GROUPS, f'Unknown group {group}')
        first, second, both = GROUPS[group]
        require(m[4] == TRAITS[first][1] and m[6] == TRAITS[second][1] and m[8] == both, 'Totals phrasing')
        n_a, n_b, n_ab = int(m[3]), int(m[5]), int(m[7])
        regions = {'ab': n_ab, 'a': n_a - n_ab, 'b': n_b - n_ab}
        regions['none'] = total - sum(regions.values())
        require(min(regions.values()) >= 0, 'Inconsistent totals')
        # The figure shows the totals and overlap; its unknown regions carry no values.
        names, _, shown, size = venn_regions(public)
        require(names == [first, second] and size == total and shown == {'ab': n_ab}, 'Figure agrees with the prompt')
        return Fraction(count_words(regions, words_event(m[10], names)))
    names, letters, regions, size = venn_regions(public)
    require(set(regions) == {'a', 'ab', 'b', 'none'} and sum(regions.values()) == size, 'Four regions fill the sample space')
    m = re.fullmatch(r'The Venn diagram sorts (\d+) (.+?)\. (?:Event ([A-Z]): the (\w+) (.+?)\. Event ([A-Z]): the \4 (.+?)\. )?'
                     r'(?:How many (\w+) are in the event (.+)\?|How many (\w+) (.+)\?|One \w+ is chosen at random\. Find P\((.+)\)\.)', prompt)
    require(m is not None, f'Unrecognized event-set prompt: {prompt}')
    require(int(m[1]) == size and m[2] in GROUPS, 'Group and size')
    if m[3]:
        require([m[3], m[6]] == letters and m[5] == TRAITS[names[0]][0] and m[7] == TRAITS[names[1]][0], 'Events defined')
    universe, first, second = population(regions)
    sets = dict(zip(letters, (first, second)))
    if m[9]:
        return Fraction(len(parse_set(m[9], universe, sets)))
    if m[11]:
        return Fraction(count_words(regions, words_event(m[11], names)))
    return Fraction(len(parse_set(m[12], universe, sets)), len(universe))


def solve_addition(public):
    prompt = public['prompt']
    m = re.fullmatch(r'Of (\d+) (.+?), (\d+) (.+?), (\d+) (.+?) and (\d+) (.+?)\. One (\w+) is chosen at random\. '
                     r'What is the probability that the \9 (.+) or (.+)\?', prompt)
    if m:
        total, (first, second, both) = int(m[1]), GROUPS[m[2]]
        require(m[4] == TRAITS[first][1] and m[6] == TRAITS[second][1] and m[8] == both, 'Totals phrasing')
        require(m[10] == TRAITS[first][0] and m[11] == TRAITS[second][0], 'Asked events')
        n_a, n_b, n_ab = int(m[3]), int(m[5]), int(m[7])
        regions = {'ab': n_ab, 'a': n_a - n_ab, 'b': n_b - n_ab}
        regions['none'] = total - sum(regions.values())
        require(min(regions.values()) >= 0, 'Inconsistent totals')
        universe, a, b = population(regions)
        return Fraction(len(a | b), len(universe))
    m = re.fullmatch(re.escape(DECK_INTRO) + r'\. What is the probability that the card is (.+)\?', prompt)
    if m:
        # An event's own words may contain "or" (jack, queen or king): try every split.
        splits = [(m[1][:i], m[1][i + 4:]) for i in range(len(m[1])) if m[1].startswith(' or ', i)]
        known = [(CARD_EVENTS[x], CARD_EVENTS[y]) for x, y in splits if x in CARD_EVENTS and y in CARD_EVENTS]
        require(len(known) == 1, 'Exactly one reading of the two card events')
        first, second = known[0]
        return Fraction(sum(1 for c in DECK if first(c) or second(c)), len(DECK))
    m = re.fullmatch(rf'For two events A and B, P\(A\) = {NUMBER}, P\(B\) = {NUMBER} and P\(A and B\) = {NUMBER}\. Find P\(A or B\)\.', prompt)
    if m:
        pa, pb, pab = (value(x) for x in m.groups())
        regions = [pa - pab, pab, pb - pab]
        require(min(regions) >= 0 and sum(regions) <= 1, 'Probabilities must be consistent')
        return sum(regions)
    m = re.fullmatch(rf'For two events A and B, P\(A or B\) = {NUMBER}, P\(A\) = {NUMBER} and P\(B\) = {NUMBER}\. Find P\(A and B\)\.', prompt)
    require(m is not None, f'Unrecognized addition prompt: {prompt}')
    union, pa, pb = (value(x) for x in m.groups())
    outside = 1 - union
    only_b = (1 - pa) - outside      # not A, but inside the union
    overlap = pb - only_b
    require(0 <= overlap <= min(pa, pb) and only_b >= 0, 'Probabilities must be consistent')
    return overlap


def solve_conditional(public):
    prompt = public['prompt']
    m = re.fullmatch(r'The table shows survey results for a group of (\w+)\. One of these \1 is chosen at random\. '
                     r'Given that the (\w+) (.+?), what is the probability that the \2 (.+)\?', prompt)
    if m:
        t = scene_element(public, 'table')
        given, asked = SURVEY[m[3]], SURVEY[m[4]]
        require(given[0] != asked[0], 'One row and one column')
        # With sums, the last column and the last row are totals; recount them.
        body_rows = t['rows'][:-1] if t.get('sums') else t['rows']
        columns = t['columns'][:-1] if t.get('sums') else t['columns']
        if t.get('sums'):
            require(t['columns'][-1] == 'Total' and t['rows'][-1]['label'] == 'Total', 'Totals are labeled')
        cells = {(r['label'], c): int(r['cells'][j]) for r in body_rows for j, c in enumerate(columns)}
        people = [key for key, n in cells.items() for _ in range(n)]
        if t.get('sums'):
            for r in body_rows:
                require(int(r['cells'][-1]) == sum(cells[(r['label'], c)] for c in columns), 'Row totals')
            for j, c in enumerate(columns):
                require(int(t['rows'][-1]['cells'][j]) == sum(cells[(r['label'], c)] for r in body_rows), 'Column totals')
        pick = {'row': 0, 'column': 1}
        restricted = [p for p in people if p[pick[given[0]]] == given[1]]
        require(restricted, 'The given event is possible')
        return Fraction(sum(1 for p in restricted if p[pick[asked[0]]] == asked[1]), len(restricted))
    m = re.fullmatch(r'The Venn diagram sorts (\d+) (.+?)\. One (\w+) is chosen at random\. Given that the \3 (.+?), '
                     r'what is the probability that the \3 (.+)\?', prompt)
    if m:
        names, _, regions, size = venn_regions(public)
        require(int(m[1]) == size and len(regions) == 4, 'Venn counts')
        universe, a, b = population(regions)
        by_phrase = {TRAITS[names[0]][0]: a, TRAITS[names[1]][0]: b}
        given, asked = by_phrase[m[4]], by_phrase[m[5]]
        return Fraction(len(given & asked), len(given))
    m = re.fullmatch(r'A whole number from 1 to (\d+) is chosen at random\. Given that (.+?), what is the probability that (.+)\?', prompt)
    if m:
        space = [x for x in range(1, int(m[1]) + 1) if number_predicate(m[2])(x)]
        require(space, 'The condition is possible')
        return Fraction(sum(1 for x in space if number_predicate(m[3])(x)), len(space))
    m = re.fullmatch(rf'For two events A and B, P\(A and B\) = {NUMBER} and P\(B\) = {NUMBER}\. Find P\(A \| B\)\.', prompt)
    require(m is not None, f'Unrecognized conditional prompt: {prompt}')
    pab, pb = value(m[1]), value(m[2])
    # A population whose size makes both probabilities whole counts.
    n = math.lcm(pab.denominator, pb.denominator)
    in_b, in_both = pb * n, pab * n
    require(0 < in_b and 0 <= in_both <= in_b, 'Consistent probabilities')
    return Fraction(int(in_both), int(in_b))


STORIES = [
    (r'On a school morning, the probability of rain is {N}\. When it rains, the bus is late with probability {N}; '
     r'when it does not rain, the bus is late with probability {N}\.',
     {'it rains and the bus is late': (0, 0), 'it rains and the bus is on time': (0, 1),
      'it does not rain and the bus is late': (1, 0), 'it does not rain and the bus is on time': (1, 1),
      'the bus is late': (None, 0)}),
    (r'A basketball player makes a first free throw with probability {N}\. After a make, the player makes the second '
     r'with probability {N}; after a miss, with probability {N}\.',
     {'the player makes both free throws': (0, 0), 'the player makes the first free throw and misses the second': (0, 1),
      'the player misses the first free throw and makes the second': (1, 0), 'the player misses both free throws': (1, 1),
      'the player makes the second free throw': (None, 0)}),
    (r'A randomly chosen part from a factory comes from machine A with probability {N} and from machine B otherwise\. '
     r'A part from machine A is defective with probability {N}; a part from machine B is defective with probability {N}\.',
     {'a randomly chosen part comes from machine A and is defective': (0, 0),
      'a randomly chosen part comes from machine A and is not defective': (0, 1),
      'a randomly chosen part comes from machine B and is defective': (1, 0),
      'a randomly chosen part comes from machine B and is not defective': (1, 1),
      'a randomly chosen part is defective': (None, 0)}),
]
DRAWS = {
    'both cards are hearts': (lambda c: c[1] == 'hearts', lambda c: c[1] == 'hearts'),
    'both cards are aces': (lambda c: c[0] == 1, lambda c: c[0] == 1),
    'both cards are red': (lambda c: c[1] in ('hearts', 'diamonds'),) * 2,
    'the first card is a king and the second is a queen': (lambda c: c[0] == 13, lambda c: c[0] == 12),
    'both cards are face cards (jacks, queens or kings)': (lambda c: c[0] >= 11,) * 2,
}


def solve_multiplication(public):
    prompt = public['prompt']
    m = re.fullmatch(r'A bag holds (\d+) red and (\d+) blue marbles\. Two marbles are drawn at random, one after the other, '
                     r'without replacement\. What is the probability that (.+)\?', prompt)
    if m:
        bag = ['R'] * int(m[1]) + ['B'] * int(m[2])
        pairs = list(itertools.permutations(range(len(bag)), 2))
        events = {
            'both marbles are red': lambda x, y: x == y == 'R',
            'both marbles are blue': lambda x, y: x == y == 'B',
            'the first marble is red and the second is blue': lambda x, y: (x, y) == ('R', 'B'),
            'the two marbles are different colors': lambda x, y: x != y,
        }
        event = events[m[3]]
        return Fraction(sum(1 for i, j in pairs if event(bag[i], bag[j])), len(pairs))
    m = re.fullmatch(r'Two cards are drawn at random, one after the other and without replacement, from a standard deck of 52 cards\. '
                     r'What is the probability that (.+)\?', prompt)
    if m:
        first, second = DRAWS[m[1]]
        pairs = list(itertools.permutations(DECK, 2))
        return Fraction(sum(1 for x, y in pairs if first(x) and second(y)), len(pairs))
    m = re.fullmatch(rf'For two events A and B, P\(A\) = {NUMBER} and P\(B \| A\) = {NUMBER}\. Find P\(A and B\)\.', prompt)
    if m:
        pa, pba = value(m[1]), value(m[2])
        # A population of trials: A happens in pa of them, B in a share pba of those.
        n = pa.denominator * pba.denominator
        in_a = pa * n
        in_both = in_a * pba
        require(in_a.denominator == 1 and in_both.denominator == 1, 'Whole population')
        return Fraction(int(in_both), n)
    for pattern, asks in STORIES:
        m = re.fullmatch(pattern.replace('{N}', NUMBER) + r' What is the probability that (.+)\?', prompt)
        if not m:
            continue
        p, q1, q2 = (value(x) for x in m.groups()[:3])
        require(all(0 < x < 1 for x in (p, q1, q2)), 'Probabilities strictly between 0 and 1')
        # A population of trials large enough that every split is whole.
        n = math.lcm(p.denominator, q1.denominator, q2.denominator) ** 2
        firsts = [p * n, (1 - p) * n]
        trials = {}
        for i, rate in enumerate((q1, q2)):
            trials[(i, 0)] = firsts[i] * rate
            trials[(i, 1)] = firsts[i] - firsts[i] * rate
        require(all(t.denominator == 1 for t in trials.values()), 'Whole counts')
        i, j = asks[m.groups()[3]]
        hits = sum(v for (a, b), v in trials.items() if (i is None or a == i) and b == j)
        return Fraction(hits, n)
    raise ValueError(f'Unrecognized multiplication prompt: {prompt}')


def solve_probability_rules(public):
    template = public['templateId']
    require(template in PROBABILITY_RULES, f'Unknown template {template}')
    public = dict(public, prompt=plain(public['prompt']))
    solver = {
        'event-set-count': solve_event_sets,
        'addition-rule-probability': solve_addition,
        'conditional-probability-value': solve_conditional,
        'multiplication-rule-probability': solve_multiplication,
    }[template]
    answer = solver(public)
    kind = public['response']['kind']
    if kind == 'number':
        require(answer.denominator == 1, 'A count is whole')
    else:
        require(kind == 'fraction' and 0 <= answer <= 1, 'A probability lies in [0, 1]')
    return answer


def review_probability_rules_fixtures():
    def public(template, prompt, figure=None, kind='fraction'):
        p = {'templateId': template, 'prompt': prompt, 'response': {'kind': kind, 'label': 'x'}}
        if figure:
            p['figure'] = {'kind': 'scene', 'scene': {'v': 1, 'elements': [figure]}}
        return p

    def rejects(p):
        try:
            solve_probability_rules(p)
        except (ValueError, KeyError):
            return True
        return False
    venn = {'type': 'venn', 'sets': ['Art (A)', 'Music (M)'], 'universe': '40 students',
            'regions': {'a': '12', 'ab': '6', 'b': '9', 'none': '13'}}
    sym = ('The Venn diagram sorts 40 students in a club. Event A: the student takes art. Event M: the student takes music. '
           'How many students are in the event {}?')
    for expr, expected in (('A ∪ M', 27), ('A ∩ M', 6), ('A′', 22), ('(A ∪ M)′', 13), ('A ∩ M′', 12),
                           ('A ∪ M′', 31), ('(A ∩ M)′', 34), ('A′ ∩ M′', 13)):
        require(solve_probability_rules(public('event-set-count', sym.format(expr), venn, 'number')) == expected, expr)
    words = 'The Venn diagram sorts 40 students in a club. How many students take music but do not take art?'
    require(solve_probability_rules(public('event-set-count', words, venn, 'number')) == 9, 'Music only')
    require(solve_probability_rules(public('event-set-count',
            'A whole number from 1 to 20 is chosen at random. Event A: the number is even. Event B: the number is a multiple of 3. '
            'How many outcomes are in the event A ∩ B′?', kind='number')) == 7, 'Even, not a multiple of 3')
    require(solve_probability_rules(public('addition-rule-probability',
            DECK_INTRO + '. What is the probability that the card is a heart or a face card (jack, queen or king)?')) == Fraction(22, 52),
            'Heart or face card')
    require(solve_probability_rules(public('addition-rule-probability',
            'For two events A and B, P(A or B) = 0.7, P(A) = 0.5 and P(B) = 0.4. Find P(A and B).')) == Fraction(1, 5), 'Overlap')
    require(rejects(public('addition-rule-probability',
            'For two events A and B, P(A) = 0.5, P(B) = 0.4 and P(A and B) = 0.6. Find P(A or B).')), 'Overlap larger than an event')
    table = {'type': 'table', 'columns': ['Online', 'In person', 'Total'], 'sums': True,
             'rows': [{'label': 'Grade 9', 'cells': [18, 12, 30]}, {'label': 'Grade 10', 'cells': [14, 26, 40]},
                      {'label': 'Total', 'cells': [32, 38, 70]}]}
    ask = ('The table shows survey results for a group of students. One of these students is chosen at random. '
           'Given that the student {}, what is the probability that the student {}?')
    require(solve_probability_rules(public('conditional-probability-value', ask.format('is in grade 10', 'prefers online classes'), table)) == Fraction(14, 40), 'Row')
    require(solve_probability_rules(public('conditional-probability-value', ask.format('prefers online classes', 'is in grade 10'), table)) == Fraction(14, 32), 'Column')
    bad = dict(table, rows=[dict(table['rows'][0], cells=[18, 12, 31])] + table['rows'][1:])
    require(rejects(public('conditional-probability-value', ask.format('is in grade 10', 'prefers online classes'), bad)), 'Wrong row total')
    require(solve_probability_rules(public('multiplication-rule-probability',
            'A bag holds 3 red and 2 blue marbles. Two marbles are drawn at random, one after the other, without replacement. '
            'What is the probability that the two marbles are different colors?')) == Fraction(3, 5), 'Different colors')
    require(solve_probability_rules(public('multiplication-rule-probability',
            'On a school morning, the probability of rain is 0.3. When it rains, the bus is late with probability 0.4; '
            'when it does not rain, the bus is late with probability 0.1. What is the probability that the bus is late?')) == Fraction(19, 100), 'Late bus')
    require(solve_probability_rules(public('multiplication-rule-probability',
            'Two cards are drawn at random, one after the other and without replacement, from a standard deck of 52 cards. '
            'What is the probability that both cards are hearts?')) == Fraction(1, 17), 'Two hearts')
    return 17


def shown_values(answer):
    """The answer as a reduced fraction and, when it terminates, as a decimal."""
    out = {f'{answer.numerator}' if answer.denominator == 1 else f'{answer.numerator}/{answer.denominator}'}
    d = answer.denominator
    for p in (2, 5):
        while d % p == 0:
            d //= p
    if d == 1 and answer.denominator != 1:
        places = 0
        while (answer * 10 ** places).denominator != 1:
            places += 1
        out.add(f'{float(answer):.{places}f}')
    return out


def review_probability_rules_problem(problem, solved):
    """The explanation ends on the answer; an unknown in the figure carries no value."""
    last = plain(problem['explanation'][-1])
    require(any(re.search(rf'(?<![\d/.]){re.escape(v)}(?![\d/])', last) for v in shown_values(Fraction(solved))),
            f'Explanation must conclude with the answer: {last}')
    figure = problem['public'].get('figure')
    if figure:
        text = repr(figure)
        require('"?"' not in text and "'?'" not in text, 'Unknowns are null, never a literal "?"')
