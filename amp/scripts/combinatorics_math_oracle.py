"""Independent prompt-only counting and discrete-probability checks.

Every count is found by enumerating the sample space described in the public
prompt (itertools.product / permutations / combinations), never by the
multiplication, factorial or binomial formulas that the generator and lessons
teach. Malformed, inconsistent or ambiguous prompts are rejected.
"""
import ast
import copy
import itertools
import json
import re
import subprocess
from fractions import Fraction
from pathlib import Path

COUNTING = frozenset({'counting-principle', 'permutation-count', 'combination-count'})
PROBABILITY = frozenset({'combination-probability', 'independent-events-probability', 'expected-value'})
COMBINATORICS = COUNTING | PROBABILITY
NUMBER_WORDS = {'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10}
MENUS = {
    "A café's lunch special": ('lunch specials', [('sandwich', 'sandwiches'), ('soup', 'soups'), ('drink', 'drinks'), ('dessert', 'desserts')]),
    'An outfit': ('outfits', [('shirt', 'shirts'), ('pair of pants', 'pairs of pants'), ('pair of shoes', 'pairs of shoes'), ('hat', 'hats')]),
    'A pizza order': ('pizza orders', [('crust', 'crusts'), ('sauce', 'sauces'), ('cheese', 'cheeses'), ('topping', 'toppings')]),
}
OFFICES = ['president', 'vice president', 'secretary', 'treasurer']
PLACES = ['first', 'second', 'third']


def require(condition, message):
    if not condition:
        raise ValueError(message)


def series(text):
    """Split 'a, b and c' into its items, insisting on the house list style."""
    items = text.split(', ')
    last = items.pop().split(' and ')
    require(len(last) == 2 or (len(last) == 1 and not items), 'Malformed list')
    return items + last


def size(iterable):
    return sum(1 for _ in iterable)


def parse_counting(prompt):
    """Return the number of options at each stage."""
    m = re.fullmatch(r'A code has (\d) positions\. Each position is one of the (\d+) (digits 0 through 9|letters A through ([A-Z])), and (digits|letters) may repeat\. How many different codes are possible\?', prompt)
    if m:
        k, n = int(m[1]), int(m[2])
        require(2 <= k <= 4, 'Code length outside scope')
        if m[3].startswith('digits'):
            require(n == 10 and m[5] == 'digits', 'Digit set mismatch')
            symbols = '0123456789'
        else:
            require(m[5] == 'letters' and 3 <= n <= 9 and ord(m[4]) - 64 == n, 'Letter range mismatch')
            symbols = [chr(65 + i) for i in range(n)]
        return [len(symbols)] * k
    m = re.fullmatch(r'A trip goes from ([A-Z][a-z]+) to ([A-Z][a-z]+), passing through (.+?)( in that order)?\. There are (.+)\. How many different routes are possible\?', prompt)
    if m:
        middle = series(m[3])
        require((m[4] is not None) == (len(middle) > 1), 'Route order wording')
        path = [m[1], *middle, m[2]]
        require(len(set(path)) == len(path), 'Repeated town')
        legs = series(m[5])
        require(len(legs) == len(path) - 1 and 2 <= len(legs) <= 4, 'Leg count mismatch')
        roads = []
        for i, leg in enumerate(legs):
            n = re.fullmatch(r'(\d) roads from ([A-Z][a-z]+) to ([A-Z][a-z]+)', leg)
            require(n and (n[2], n[3]) == (path[i], path[i + 1]) and 2 <= int(n[1]) <= 8, 'Broken route leg')
            roads.append(int(n[1]))
        return roads
    m = re.fullmatch(r"(A café's lunch special|An outfit|A pizza order) has (.+)\. There are (.+) to choose from\. How many different ([a-z ]+) are possible\?", prompt)
    require(m is not None, 'Unrecognized counting prompt')
    whole, stages = MENUS[m[1]]
    require(m[4] == whole, 'Outcome noun mismatch')
    ones, counts = series(m[2]), series(m[3])
    require(2 <= len(ones) <= 4 and len(ones) == len(counts), 'Stage count mismatch')
    options = []
    for i, (one, many) in enumerate(zip(ones, counts)):
        singular, plural = stages[i]
        require(one == 'one ' + singular, 'Stage order or noun mismatch')
        n = re.fullmatch(r'(\d) (.+)', many)
        require(n and n[2] == plural and 2 <= int(n[1]) <= 8, 'Stage option mismatch')
        options.append(int(n[1]))
    return options


def solve_counting(prompt):
    return size(itertools.product(*(range(n) for n in parse_counting(prompt))))


def parse_permutation(prompt):
    """Return (pool size, positions filled)."""
    m = re.fullmatch(r'A club with (\d+) members will choose (.+)\. No member can hold more than one office\. In how many different ways can the offices be filled\?', prompt)
    if m:
        n, offices = int(m[1]), series(m[2])
        require(offices == ['a ' + o for o in OFFICES[:len(offices)]] and len(offices) >= 2, 'Office list')
        require(5 <= n <= 12, 'Club size outside scope')
        return n, len(offices)
    m = re.fullmatch(r'([A-Z][a-z]+) runners finish a race with no ties\. In how many different ways can (.+) places be awarded\?', prompt)
    if m:
        n, places = NUMBER_WORDS.get(m[1].lower()), series(m[2])
        require(n is not None and 4 <= n <= 10 and places == PLACES[:len(places)] and len(places) >= 2, 'Race wording')
        return n, len(places)
    m = re.fullmatch(r'In how many different orders can (\d) different books be arranged in a row on a shelf\?', prompt)
    if m:
        n = int(m[1])
        require(3 <= n <= 8, 'Shelf size outside scope')
        return n, n
    m = re.fullmatch(r'([A-Z][a-z]+) of (\d) different photos will be hung in a row of (\d) frames, from left to right\. How many different arrangements are possible\?', prompt)
    require(m is not None, 'Unrecognized permutation prompt')
    k, n = NUMBER_WORDS.get(m[1].lower()), int(m[2])
    require(k == int(m[3]) and 2 <= k < n <= 9, 'Frame wording')
    return n, k


def solve_permutation(prompt):
    n, r = parse_permutation(prompt)
    return size(itertools.permutations(range(n), r))


def parse_combination(prompt):
    """Return (pool size, group size)."""
    m = re.fullmatch(r'At a meeting, each of (\d+) people shakes hands once with every other person\. How many handshakes take place\?', prompt)
    if m:
        n = int(m[1])
        require(4 <= n <= 15, 'Meeting size outside scope')
        return n, 2
    patterns = [
        r'A teacher will choose (\d) students from a group of (\d+) to form a committee\. Every committee member has the same role\. How many different committees are possible\?',
        r'A pizza will have exactly (\d) different toppings chosen from (\d+) available toppings\. The order in which toppings are chosen does not matter\. How many different topping combinations are possible\?',
        r'Maya will pack (\d) of her (\d+) different books for a trip\. How many different sets of (\d) books can she pack\?',
    ]
    for pattern in patterns:
        m = re.fullmatch(pattern, prompt)
        if m:
            k, n = int(m[1]), int(m[2])
            require(m.lastindex == 2 or int(m[3]) == k, 'Set size mismatch')
            require(2 <= k < n <= 14 and k <= 5, 'Selection outside scope')
            return n, k
    raise ValueError('Unrecognized combination prompt')


def solve_combination(prompt):
    n, k = parse_combination(prompt)
    return size(itertools.combinations(range(n), k))


def parse_selection(prompt):
    """Return (special count, other count, group size, condition on the special count)."""
    m = re.fullmatch(r'A club has (\d) juniors and (\d) seniors\. A committee of (\d) members is chosen at random, so every group of (\d) members is equally likely\. What is the probability that (.+)\?', prompt)
    if m:
        a, b, k, quality, condition = int(m[1]), int(m[2]), int(m[3]), 'junior', m[5]
        require(int(m[4]) == k, 'Group size mismatch')
        conditions = {('both' if k == 2 else f'all {k}') + ' are juniors': lambda x: x == k, 'none of them is a junior': lambda x: x == 0}
        exact = re.fullmatch(r'exactly (\d) (is a junior|are juniors)', condition)
    else:
        m = re.fullmatch(r'A bag holds (\d) red marbles and (\d) blue marbles\. ([A-Z][a-z]+) marbles are drawn at random at the same time, so every set of (\d) marbles is equally likely\. What is the probability that (.+)\?', prompt)
        require(m is not None, 'Unrecognized selection prompt')
        a, b, k, condition = int(m[1]), int(m[2]), int(m[4]), m[5]
        require(NUMBER_WORDS.get(m[3].lower()) == k, 'Draw count mismatch')
        conditions = {('both' if k == 2 else f'all {k}') + ' are red': lambda x: x == k, 'none of them is red': lambda x: x == 0}
        exact = re.fullmatch(r'exactly (\d) (is red|are red)', condition)
    require(2 <= a <= 8 and 2 <= b <= 8 and 2 <= k <= min(4, a + b - 1), 'Selection outside scope')
    if exact:
        target = int(exact[1])
        require((target == 1) == exact[2].startswith('is'), 'Agreement')
        require(0 < target < k, 'Exact count must differ from all or none')
        test = lambda x: x == target
    else:
        require(condition in conditions, 'Unrecognized condition')
        test = conditions[condition]
    return a, b, k, test


def solve_selection(prompt):
    a, b, k, test = parse_selection(prompt)
    items = ['special'] * a + ['other'] * b
    groups = list(itertools.combinations(range(a + b), k))
    favorable = sum(1 for g in groups if test(sum(items[i] == 'special' for i in g)))
    require(favorable > 0, 'Impossible event')
    return Fraction(favorable, len(groups))


def predicate(phrase):
    m = re.fullmatch(r'a number (greater|less) than (\d+)', phrase)
    if m:
        t = int(m[2])
        return (lambda x: x > t) if m[1] == 'greater' else (lambda x: x < t)
    m = re.fullmatch(r'(a|an) (\d+)', phrase)
    if m:
        t = int(m[2])
        require((m[1] == 'an') == (str(t)[0] == '8'), 'Article')
        return lambda x: x == t
    return {'an even number': lambda x: x % 2 == 0, 'an odd number': lambda x: x % 2 == 1,
            'a multiple of 3': lambda x: x % 3 == 0}[phrase]


def event(text, outcomes):
    m = re.fullmatch(r'the (cube|spinner|coin) (shows|does not show|lands on|does not land on|lands|does not land) (.+)', text)
    require(m is not None, 'Unrecognized event')
    device, verb, phrase = m[1], m[2], m[3]
    negated = verb.startswith('does not')
    expected = {'cube': 'show', 'spinner': 'land on', 'coin': 'land'}[device]
    require(verb.replace('does not ', '') in {expected, expected.replace('show', 'shows').replace('land', 'lands')}, 'Verb does not fit device')
    if device == 'coin':
        side = re.fullmatch(r'(heads|tails) up', phrase)
        require(side is not None, 'Coin event')
        test = lambda x: x == side[1]
    else:
        test = predicate(phrase)
    require(device in outcomes, 'Event names an absent device')
    values = outcomes[device]
    count = sum(1 for x in values if test(x))
    require(0 < count < len(values), 'Event must be uncertain')
    return device, (lambda x: not test(x)) if negated else test, negated


def solve_independent(prompt):
    m = re.fullmatch(r'(A fair number cube with faces numbered 1 through 6 is rolled|A spinner with (\d+) equal sections numbered 1 through (\d+) is spun), and (a spinner with (\d+) equal sections numbered 1 through (\d+) is spun|a fair coin is tossed)\. The two results are independent\. What is the probability that (.+)\?', prompt)
    require(m is not None, 'Unrecognized independent-events prompt')
    outcomes = {}
    if m[1].startswith('A fair number cube'):
        outcomes['cube'] = list(range(1, 7))
    else:
        require(m[2] == m[3] and 3 <= int(m[2]) <= 10, 'Spinner labels')
        outcomes['spinner'] = list(range(1, int(m[2]) + 1))
    if m[4] == 'a fair coin is tossed':
        outcomes['coin'] = ['heads', 'tails']
    else:
        require('spinner' not in outcomes and m[5] == m[6] and 3 <= int(m[5]) <= 10, 'Second spinner labels')
        outcomes['spinner'] = list(range(1, int(m[5]) + 1))
    question = m[7]
    at_least = question.startswith('at least one of these happens: ')
    parts = question.removeprefix('at least one of these happens: ').split('; ' if at_least else ' and the ')
    require(len(parts) == 2, 'Two events required')
    if not at_least:
        parts[1] = 'the ' + parts[1]
    devices = list(outcomes)
    (d1, t1, n1), (d2, t2, n2) = event(parts[0], outcomes), event(parts[1], outcomes)
    require([d1, d2] == devices, 'Events must follow the device order')
    require(n1 == n2 and not (at_least and n1), 'Unsupported mixture of negations')
    combine = (lambda x, y: t1(x) or t2(y)) if at_least else (lambda x, y: t1(x) and t2(y))
    pairs = list(itertools.product(outcomes[d1], outcomes[d2]))
    return Fraction(sum(1 for x, y in pairs if combine(x, y)), len(pairs))


def parse_expected(prompt):
    """Return (payoff on each section, cost of one play)."""
    net = re.fullmatch(r'A game costs (\d+) (tokens?) to play\. The player spins a spinner that has (\d+) equal sections: (.+)\. What is the expected net gain, in tokens, from one play\? Give a loss as a negative number\.', prompt)
    if net:
        cost, n, clauses, unit = int(net[1]), int(net[3]), net[4], 'token'
        require((cost == 1) == (net[2] == 'token'), 'Cost agreement')
    else:
        m = re.fullmatch(r'A spinner has (\d+) equal sections: (.+)\. What is the expected number of points from one spin\?', prompt)
        require(m is not None, 'Unrecognized expected-value prompt')
        cost, n, clauses, unit = 0, int(m[1]), m[2], 'point'
    require(n in {4, 5, 6, 8, 10, 12}, 'Spinner size outside scope')
    sections = []
    items = series(clauses)
    for i, clause in enumerate(items):
        c = re.fullmatch(r'(the other )?(\d+) (section awards|sections award) (\d+) (\w+)', clause)
        require(c is not None, 'Malformed payoff clause')
        count, value = int(c[2]), int(c[4])
        require(count >= 1 and (count == 1) == (c[3] == 'section awards'), 'Section agreement')
        require(c[5] == (unit if value == 1 else unit + 's'), 'Payoff unit')
        require((c[1] is not None) == (value == 0) and (value != 0 or i == len(items) - 1), 'Zero payoff clause')
        sections += [value] * count
    require(len(sections) == n, 'Sections do not fill the spinner')
    return sections, cost


def solve_expected(prompt):
    sections, cost = parse_expected(prompt)
    n = len(sections)
    # Average the payoff over the equally likely sections, then subtract the fixed cost.
    return sum(Fraction(v - cost) for v in sections) / n


def solve_combinatorics(public):
    template = public['templateId']
    require(template in COMBINATORICS, 'Unknown combinatorics task')
    require(public.get('figure') is None, 'Unexpected figure')
    kind = public['response']['kind']
    require(kind == ('number' if template in COUNTING else 'fraction'), 'Response kind')
    prompt = public['prompt']
    return {
        'counting-principle': solve_counting,
        'permutation-count': solve_permutation,
        'combination-count': solve_combination,
        'combination-probability': solve_selection,
        'independent-events-probability': solve_independent,
        'expected-value': solve_expected,
    }[template](prompt)


def review_combinatorics_fixtures():
    def case(template, prompt):
        return {'templateId': template, 'prompt': prompt,
                'response': {'kind': 'number' if template in COUNTING else 'fraction'}}
    fixtures = [
        ('counting-principle', "A café's lunch special has one sandwich, one soup and one drink. There are 4 sandwiches, 3 soups and 2 drinks to choose from. How many different lunch specials are possible?", 24),
        ('counting-principle', 'An outfit has one shirt and one pair of pants. There are 3 shirts and 2 pairs of pants to choose from. How many different outfits are possible?', 6),
        ('counting-principle', 'A trip goes from Ash to Cedar, passing through Birch. There are 3 roads from Ash to Birch and 2 roads from Birch to Cedar. How many different routes are possible?', 6),
        ('counting-principle', 'A code has 4 positions. Each position is one of the 10 digits 0 through 9, and digits may repeat. How many different codes are possible?', 10000),
        ('counting-principle', 'A code has 2 positions. Each position is one of the 3 letters A through C, and letters may repeat. How many different codes are possible?', 9),
        ('permutation-count', 'A club with 5 members will choose a president, a vice president and a secretary. No member can hold more than one office. In how many different ways can the offices be filled?', 60),
        ('permutation-count', 'Eight runners finish a race with no ties. In how many different ways can first, second and third places be awarded?', 336),
        ('permutation-count', 'In how many different orders can 5 different books be arranged in a row on a shelf?', 120),
        ('permutation-count', 'Three of 7 different photos will be hung in a row of 3 frames, from left to right. How many different arrangements are possible?', 210),
        ('combination-count', 'A teacher will choose 4 students from a group of 10 to form a committee. Every committee member has the same role. How many different committees are possible?', 210),
        ('combination-count', 'At a meeting, each of 6 people shakes hands once with every other person. How many handshakes take place?', 15),
        ('combination-count', 'Maya will pack 3 of her 7 different books for a trip. How many different sets of 3 books can she pack?', 35),
        ('combination-probability', 'A bag holds 5 red marbles and 4 blue marbles. Three marbles are drawn at random at the same time, so every set of 3 marbles is equally likely. What is the probability that exactly 2 are red?', Fraction(10, 21)),
        ('combination-probability', 'A club has 4 juniors and 3 seniors. A committee of 2 members is chosen at random, so every group of 2 members is equally likely. What is the probability that none of them is a junior?', Fraction(1, 7)),
        ('combination-probability', 'A bag holds 3 red marbles and 3 blue marbles. Three marbles are drawn at random at the same time, so every set of 3 marbles is equally likely. What is the probability that all 3 are red?', Fraction(1, 20)),
        ('independent-events-probability', 'A fair number cube with faces numbered 1 through 6 is rolled, and a spinner with 5 equal sections numbered 1 through 5 is spun. The two results are independent. What is the probability that the cube shows an even number and the spinner lands on a number greater than 3?', Fraction(1, 5)),
        ('independent-events-probability', 'A fair number cube with faces numbered 1 through 6 is rolled, and a spinner with 5 equal sections numbered 1 through 5 is spun. The two results are independent. What is the probability that at least one of these happens: the cube shows an even number; the spinner lands on a number greater than 3?', Fraction(7, 10)),
        ('independent-events-probability', 'A spinner with 4 equal sections numbered 1 through 4 is spun, and a fair coin is tossed. The two results are independent. What is the probability that the spinner does not land on an 8 and the coin does not land heads up?', None),
        ('independent-events-probability', 'A fair number cube with faces numbered 1 through 6 is rolled, and a fair coin is tossed. The two results are independent. What is the probability that the cube does not show a multiple of 3 and the coin does not land tails up?', Fraction(1, 3)),
        ('expected-value', 'A spinner has 8 equal sections: 1 section awards 12 points, 3 sections award 4 points and the other 4 sections award 0 points. What is the expected number of points from one spin?', Fraction(3)),
        ('expected-value', 'A game costs 5 tokens to play. The player spins a spinner that has 4 equal sections: 1 section awards 10 tokens and the other 3 sections award 0 tokens. What is the expected net gain, in tokens, from one play? Give a loss as a negative number.', Fraction(-5, 2)),
        ('expected-value', 'A game costs 1 token to play. The player spins a spinner that has 5 equal sections: 2 sections award 1 token and 3 sections award 2 tokens. What is the expected net gain, in tokens, from one play? Give a loss as a negative number.', Fraction(3, 5)),
    ]
    solved = 0
    for template, prompt, expected in fixtures:
        if expected is None:  # An event that cannot fail is outside the declared scope.
            try:
                solve_combinatorics(case(template, prompt))
            except (ValueError, KeyError):
                continue
            raise ValueError('Certain event accepted')
        require(solve_combinatorics(case(template, prompt)) == expected, 'Independent handwritten mismatch: ' + prompt)
        solved += 1
    bad = [
        ('counting-principle', 'A code has 2 positions. Each position is one of the 4 letters A through C, and letters may repeat. How many different codes are possible?'),
        ('counting-principle', "A café's lunch special has one sandwich and one soup. There are 4 soups and 3 sandwiches to choose from. How many different lunch specials are possible?"),
        ('counting-principle', 'A trip goes from Ash to Dale, passing through Birch and Cedar in that order. There are 3 roads from Ash to Birch and 2 roads from Cedar to Dale. How many different routes are possible?'),
        ('permutation-count', 'Three of 7 different photos will be hung in a row of 4 frames, from left to right. How many different arrangements are possible?'),
        ('permutation-count', 'A club with 9 members will choose a president, a secretary and a vice president. No member can hold more than one office. In how many different ways can the offices be filled?'),
        ('combination-count', 'Maya will pack 3 of her 7 different books for a trip. How many different sets of 4 books can she pack?'),
        ('combination-probability', 'A bag holds 5 red marbles and 4 blue marbles. Two marbles are drawn at random at the same time, so every set of 3 marbles is equally likely. What is the probability that exactly 2 are red?'),
        ('combination-probability', 'A bag holds 5 red marbles and 4 blue marbles. Three marbles are drawn at random at the same time, so every set of 3 marbles is equally likely. What is the probability that exactly 2 is red?'),
        ('independent-events-probability', 'A spinner with 5 equal sections numbered 1 through 6 is spun, and a fair coin is tossed. The two results are independent. What is the probability that the spinner lands on a 1 and the coin lands heads up?'),
        ('independent-events-probability', 'A fair number cube with faces numbered 1 through 6 is rolled, and a fair coin is tossed. The two results are independent. What is the probability that the cube lands on a 1 and the coin lands heads up?'),
        ('expected-value', 'A spinner has 8 equal sections: 1 section awards 12 points and 3 sections award 4 points. What is the expected number of points from one spin?'),
        ('expected-value', 'A spinner has 4 equal sections: 1 sections award 12 points and the other 3 sections award 0 points. What is the expected number of points from one spin?'),
    ]
    for template, prompt in bad:
        try:
            solve_combinatorics(case(template, prompt))
        except (ValueError, KeyError):
            pass
        else:
            raise ValueError('Malformed or inconsistent prompt accepted: ' + prompt)
    return {'handwritten': solved, 'mutants': len(bad) + 1}


def value(source):
    """Exact value of a displayed arithmetic expression (× ÷ + − and fractions)."""
    text = source.strip().replace('−', '-').replace('×', '*').replace('÷', '/')
    tree = ast.parse(text, mode='eval')

    def visit(node):
        if isinstance(node, ast.Constant) and type(node.value) is int:
            return Fraction(node.value)
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


TRAILING = re.compile(r'[−(\d][\d ()×÷+/−]*$')
LEADING = re.compile(r'^[−(\d][\d ()×÷+/−]*')


def equalities(step):
    """Check every adjacent pair in each 'a = b = c' chain; return how many were checked."""
    parts = step.split(' = ')
    for left, right in zip(parts, parts[1:]):
        a, b = TRAILING.search(left), LEADING.match(right)
        require(a is not None and b is not None, 'Equality without arithmetic: ' + step)
        require(value(a[0]) == value(b[0].rstrip(' ')), 'False equality in worked arithmetic: ' + step)
    return len(parts) - 1


def shown(v):
    v = Fraction(v)
    return ('−' if v < 0 else '') + str(abs(v.numerator)) + ('' if v.denominator == 1 else f'/{v.denominator}')


def factors(text):
    return [int(x) for x in text.split(' × ')]


def review_explanation(problem):
    public, steps = problem['public'], problem['explanation']
    template, answer = public['templateId'], solve_combinatorics(public)
    require(Fraction(problem['answer']) == answer, 'Mismatch: incorrect exact answer')
    require(len(steps) >= 3 and problem['hint'], 'Explanation or hint missing')
    chains = sum(equalities(step) for step in steps)
    require(chains >= 1, 'Explanation has no checked arithmetic')
    final = steps[-1]
    require(re.search(r'(?<![\d/−])' + re.escape(shown(answer)) + r'(?![\d/])', final), 'Final step does not state the answer')
    joined = ' '.join(steps)
    prompt = public['prompt']
    if template == 'counting-principle':
        m = re.search(r'(?:All together|multiply \d factors of \d+): ([\d ×]+) = (\d+)\.', joined)
        require(m and int(m[2]) == answer, 'Missing complete product')
        require(factors(m[1]) == parse_counting(prompt), 'Product uses the wrong stage counts')
    elif template == 'permutation-count':
        m = re.search(r'Multiply the numbers of options: ([\d ×]+) = (\d+)\.', joined)
        n, r = parse_permutation(prompt)
        require(m and factors(m[1]) == list(range(n, n - r, -1)) and int(m[2]) == answer, 'Permutation factors must count down from the pool')
    elif template == 'combination-count':
        n, k = parse_combination(prompt)
        top = re.search(r'First count ordered selections: ([\d ×]+) = (\d+)\.', joined)
        bottom = re.search(r'its (\d) [a-z]+: ([\d ×]+) = (\d+) times\.', joined)
        require(top and factors(top[1]) == list(range(n, n - k, -1)), 'Ordered selections must count down from the pool')
        require(bottom and int(bottom[1]) == k and factors(bottom[2]) == list(range(k, 0, -1)), 'Division must remove every order of the group')
    elif template == 'combination-probability':
        a, b, k, _ = parse_selection(prompt)
        for m in re.finditer(r'Choose (\d) of the (\d+) [a-z ]+?: [^.]*= (\d+) ways', joined):
            require(int(m[2]) in {a, b, a + b} and size(itertools.combinations(range(int(m[2])), int(m[1]))) == int(m[3]), 'Group count misstated')
        m = re.search(r'The probability is (\d+)/(\d+)', final)
        require(m and Fraction(int(m[1]), int(m[2])) == answer, 'Unreduced probability is wrong')
        require(int(m[2]) == size(itertools.combinations(range(a + b), k)), 'Denominator must count all equally likely groups')
    elif template == 'expected-value':
        sections, _ = parse_expected(prompt)
        m = re.search(r'The probabilities are: (.+?)\.', joined)
        require(m is not None, 'Missing payoff probabilities')
        listed = {}
        for item in m[1].split('; '):
            payoff, probability = item.split(', ')
            listed[int(payoff.split(' ')[0])] = Fraction(probability)
        require(listed == {v: Fraction(sections.count(v), len(sections)) for v in set(sections)}, 'Payoff probabilities misstated')
    return chains


def review_independent_outcomes(problem):
    """Listed favorable outcomes must be exactly the outcomes the stated event selects."""
    public = problem['public']
    counts = []
    for step in problem['explanation'][:2]:
        m = re.fullmatch(r'The (cube|spinner|coin) (.+?) for (\d+) of the (\d+) equally likely outcomes: ([a-z0-9, ]+)\. Its probability is (.+)\.', step)
        require(m is not None, 'Missing event probability step')
        sides = re.search(r'with (\d+) equal sections', public['prompt'])
        outcomes = {'cube': list(range(1, 7)), 'coin': ['heads', 'tails'],
                    'spinner': list(range(1, int(sides[1]) + 1)) if sides else []}
        _, test, _ = event('the ' + m[1] + ' ' + m[2], outcomes)
        favorable = [str(x) for x in outcomes[m[1]] if test(x)]
        require(series(m[5]) == favorable and int(m[3]) == len(favorable) and int(m[4]) == len(outcomes[m[1]]), 'Favorable outcomes misstated')
        require(value(m[6].split(' = ')[-1]) == Fraction(len(favorable), len(outcomes[m[1]])), 'Event probability misstated')
        counts.append((len(favorable), len(outcomes[m[1]])))
    check = [s for s in problem['explanation'] if s.startswith('Check by counting pairs: ')]
    if check:
        m = re.fullmatch(r'Check by counting pairs: there are (\d+) × (\d+) = \d+ equally likely pairs of results, and (\d+) × (\d+) = \d+ of them (?:is|are) favorable, giving .+\.', check[0])
        require(m is not None and [(int(m[3]), int(m[1])), (int(m[4]), int(m[2]))] == counts, 'Pair check uses the wrong counts')


def review_problem(problem):
    chains = review_explanation(problem)
    if problem['public']['templateId'] == 'independent-events-probability':
        review_independent_outcomes(problem)
    return chains


_EXPORT = None


def content(data=None):
    """Authored content, exported once per process; callers receive a private copy."""
    global _EXPORT
    if data is not None:
        return data
    if _EXPORT is None:
        app = Path(__file__).resolve().parent.parent
        _EXPORT = subprocess.check_output(['node', '--import', 'tsx', 'scripts/combinatorics-content-oracle.ts'], cwd=app, text=True)
    return json.loads(_EXPORT)


WORKSHEET_BREADTH = {
    'counting-principle': lambda answers, prompts: {'code', 'trip', 'menu'} <= {('code' if p.startswith('A code') else 'trip' if p.startswith('A trip') else 'menu') for p in prompts},
    'permutation-count': lambda answers, prompts: any('on a shelf' in p for p in prompts) and any('frames' in p for p in prompts) and any('club' in p for p in prompts),
    'combination-count': lambda answers, prompts: any('handshakes' in p for p in prompts) and any('committee' in p for p in prompts),
    'combination-probability': lambda answers, prompts: any('none of them' in p for p in prompts) and any('exactly' in p for p in prompts) and any(re.search(r'that (?:all \d|both) are', p) for p in prompts),
    'independent-events-probability': lambda answers, prompts: any('at least one' in p for p in prompts) and any('does not' in p for p in prompts) and any('coin' in p for p in prompts),
    'expected-value': lambda answers, prompts: any(a < 0 for a in answers) and any('net gain' not in p for p in prompts) and any(a.denominator > 1 for a in answers),
}


def review_combinatorics_content(data=None):
    data = content(data)
    chains = 0
    for sheet in data['worksheets']:
        problems = sheet['problems']
        require(len(problems) == 12, 'Worksheet length')
        prompts = [p['public']['prompt'] for p in problems]
        require(len(set(prompts)) == 12, 'Repeated worksheet problem')
        answers = [solve_combinatorics(p['public']) for p in problems]
        require(WORKSHEET_BREADTH[sheet['templateId']](answers, prompts), 'Worksheet lacks required breadth: ' + sheet['templateId'])
        chains += sum(review_problem(p) for p in problems)
    lessons = {lesson['id']: lesson for lesson in data['lessons']}
    require(set(lessons) == COMBINATORICS, 'Missing standalone lesson')
    for template, lesson in lessons.items():
        worked = lesson['workedExample']
        expected = solve_combinatorics({'templateId': template, 'prompt': worked['prompt'],
                                        'response': {'kind': 'number' if template in COUNTING else 'fraction'}})
        require(Fraction(worked['answer'].replace('−', '-')) == expected, 'Worked example answer: ' + template)
        for step in worked['steps']:
            chains += equalities(step)
        # Lesson prose claims are checked too; n! is expanded by direct multiplication.
        for section in lesson['sections']:
            for paragraph in section['paragraphs']:
                chains += equalities(re.sub(r'(\d+)!', lambda f: str(size(itertools.permutations(range(int(f[1]))))), paragraph))
    chains += review_figures(data['figures'])
    return {'worksheets': len(data['worksheets']), 'checkedEqualities': chains, 'lessons': len(lessons), 'figures': len(data['figures'])}


def review_figures(figures):
    import xml.etree.ElementTree as ET
    by_kind = {f['kind']: ET.fromstring(f['html']) for f in figures}
    require(set(by_kind) == {'counting-tree', 'permutation-slots', 'combination-orders', 'independent-grid', 'expected-spinner'}, 'Figure inventory')
    checks = 0
    tree = by_kind['counting-tree']
    leaves = [e for e in tree.iter() if 'data-outcome' in e.attrib]
    firsts = sorted({e.attrib['data-outcome'].split(',')[0] for e in leaves})
    seconds = sorted({e.attrib['data-outcome'].split(',')[1] for e in leaves})
    require(len(leaves) == len(firsts) * len(seconds) == size(itertools.product(firsts, seconds)), 'Tree leaves must be every pair once')
    require(len({e.attrib['data-outcome'] for e in leaves}) == len(leaves), 'Duplicate tree leaf')
    checks += 1
    slots = [int(e.attrib['data-options']) for e in by_kind['permutation-slots'].iter() if 'data-options' in e.attrib]
    pool = int(next(e for e in by_kind['permutation-slots'].iter() if 'data-pool' in e.attrib).attrib['data-pool'])
    require(slots == list(range(pool, pool - len(slots), -1)), 'Slot options must decrease from the pool')
    require(size(itertools.permutations(range(pool), len(slots))) == int(next(e for e in by_kind['permutation-slots'].iter() if 'data-total' in e.attrib).attrib['data-total']), 'Slot total')
    checks += 1
    orders = [e.attrib['data-order'] for e in by_kind['combination-orders'].iter() if 'data-order' in e.attrib]
    columns = {}
    for e in by_kind['combination-orders'].iter():
        if 'data-order' in e.attrib:
            columns.setdefault(e.attrib['data-group'], []).append(e.attrib['data-order'])
    people = sorted({c for o in orders for c in o})
    require(sorted(orders) == sorted(''.join(p) for p in itertools.permutations(people, 2)), 'Every ordered pair appears once')
    require(all(sorted(v) == sorted([g, g[::-1]]) for g, v in columns.items()) and len(columns) == size(itertools.combinations(people, 2)), 'Each column holds both orders of one pair')
    checks += 1
    grid = by_kind['independent-grid']
    cells = [e for e in grid.iter() if 'data-cell' in e.attrib]
    rows = {int(e.attrib['data-cell'].split(',')[1]) for e in cells}
    cols = {int(e.attrib['data-cell'].split(',')[0]) for e in cells}
    require(len(cells) == len(rows) * len(cols) == 30, 'Grid must show every cube-spinner pair')
    shaded = {tuple(map(int, e.attrib['data-cell'].split(','))) for e in cells if e.attrib.get('data-favorable') == 'true'}
    require(shaded == {(x, y) for x in range(1, 7) for y in range(1, 6) if x % 2 == 0 and y > 3}, 'Shaded cells must be even cube results with spins above 3')
    checks += 1
    spinner = by_kind['expected-spinner']
    payoffs = [int(e.attrib['data-payoff']) for e in spinner.iter() if 'data-payoff' in e.attrib]
    require(len(payoffs) == 8 and sorted(payoffs) == [0, 0, 0, 0, 4, 4, 4, 12], 'Spinner sections')
    require(Fraction(sum(payoffs), len(payoffs)) == Fraction(next(e for e in spinner.iter() if 'data-expected' in e.attrib).attrib['data-expected']), 'Spinner expected value')
    checks += 1
    return checks


def review_content_mutations():
    data = content()
    mutants = []
    bad = copy.deepcopy(data); bad['lessons'][0]['workedExample']['answer'] = '25'; mutants.append(bad)
    bad = copy.deepcopy(data); bad['worksheets'][0]['problems'][1] = bad['worksheets'][0]['problems'][0]; mutants.append(bad)
    bad = copy.deepcopy(data); bad['worksheets'][0]['problems'][0]['explanation'].append('A false check: 4 × 3 = 13.'); mutants.append(bad)
    bad = copy.deepcopy(data); bad['worksheets'][-1]['problems'][0]['answer'] = '999'; mutants.append(bad)
    bad = copy.deepcopy(data); bad['lessons'][1]['sections'][2]['paragraphs'][0] = bad['lessons'][1]['sections'][2]['paragraphs'][0].replace('= 120', '= 121'); mutants.append(bad)
    for index, kind in enumerate(f['kind'] for f in data['figures']):
        bad = copy.deepcopy(data)
        html = bad['figures'][index]['html']
        replaced = re.sub(r'data-(outcome|options|order|favorable|payoff)="([^"]*)"', lambda m: f'data-{m[1]}="{ {"outcome": "Z,Z", "options": "99", "order": "ZZ", "favorable": "true" if m[2] == "false" else "false", "payoff": "99"}[m[1]] }"', html, count=1)
        require(replaced != html, 'Figure mutation did not apply: ' + kind)
        bad['figures'][index]['html'] = replaced
        mutants.append(bad)
    for bad in mutants:
        try:
            review_combinatorics_content(bad)
        except (ValueError, KeyError, TypeError, StopIteration, AttributeError):
            pass
        else:
            raise ValueError('Corrupted content accepted')
    return len(mutants)


if __name__ == '__main__':
    print(review_combinatorics_fixtures())
    print(review_combinatorics_content())
    print({'contentMutantsRejected': review_content_mutations()})
