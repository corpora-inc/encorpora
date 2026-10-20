"""Independent prompt-only checks for one- and two-step equations and simple inequalities.

Equations are solved by a small linear-expression parser over the displayed
text (or, for balances, from the drawn counts), never by the generator's
formulas. Stories are read by their own wording: the quantities' roles come
from this file's restatement of each context, and choices are judged by
equation equivalence and substitution. Malformed or ambiguous prompts fail.
"""
import copy
import json
import re
import subprocess
from fractions import Fraction
from pathlib import Path

ONE_STEP = frozenset({'one-step-equation', 'one-step-equation-story', 'balance-one-step'})
TWO_STEP = frozenset({'two-step-equation', 'two-step-word-problem', 'two-step-equation-model', 'balance-two-step'})
INEQUALITY = frozenset({'inequality-from-context', 'inequality-from-number-line',
                        'inequality-number-line-choice', 'inequality-solution-set'})
EQUATIONS = ONE_STEP | TWO_STEP | INEQUALITY
EQUATIONS_CHOICE = frozenset({'one-step-equation-story', 'two-step-equation-model'}) | INEQUALITY


def require(condition, message):
    if not condition:
        raise ValueError(message)


# ------------------------------------------------------------ number parsing
NUMBER = r'[−-]?\d+(?:\.\d+)?(?:/\d+)?'


def number(text):
    text = text.replace('−', '-')
    require(re.fullmatch(r'-?\d+(?:\.\d+)?(?:/\d+)?', text) is not None, f'Not a number: {text!r}')
    if '/' in text:
        top, bottom = text.split('/')
        return Fraction(Fraction(top), int(bottom))
    return Fraction(text)


def tokens(text):
    out, i = [], 0
    while i < len(text):
        c = text[i]
        if c == ' ':
            i += 1
            continue
        m = re.match(r'\d+(?:\.\d+)?', text[i:])
        if m:
            out.append(('num', Fraction(m.group()))); i += len(m.group())
            continue
        if c.isalpha():
            out.append(('var', c)); i += 1
            continue
        if c in '+−-×÷/()':
            out.append(('op', '-' if c == '−' else c)); i += 1
            continue
        raise ValueError(f'Unexpected character {c!r} in {text!r}')
    return out


class Linear:
    """Recursive-descent parser: each value is (a, b) meaning a·v + b."""

    def __init__(self, text, variable=None):
        self.items, self.i, self.variable = tokens(text), 0, variable

    def peek(self):
        return self.items[self.i] if self.i < len(self.items) else (None, None)

    def take(self):
        item = self.peek(); self.i += 1
        return item

    def parse(self):
        value = self.expression()
        require(self.i == len(self.items), 'Trailing tokens')
        return value

    def expression(self):
        a, b = self.term()
        while self.peek() in (('op', '+'), ('op', '-')):
            sign = 1 if self.take()[1] == '+' else -1
            c, d = self.term()
            a, b = a + sign * c, b + sign * d
        return a, b

    def term(self):
        a, b = self.factor()
        while True:
            kind, value = self.peek()
            if kind == 'op' and value in '×÷/':
                self.take()
                c, d = self.factor()
                if value == '×':
                    require(a == 0 or c == 0, 'Nonlinear product')
                    a, b = a * d + c * b, b * d
                else:
                    require(c == 0 and d != 0, 'Division by a variable or zero')
                    a, b = a / d, b / d
            elif kind in ('var', 'num') or (kind, value) == ('op', '('):
                # Juxtaposition: 3x, 2(x + 1), 0.5x.
                c, d = self.factor()
                require(a == 0 or c == 0, 'Nonlinear product')
                a, b = a * d + c * b, b * d
            else:
                return a, b

    def factor(self):
        kind, value = self.take()
        if (kind, value) == ('op', '-'):
            a, b = self.factor()
            return -a, -b
        if kind == 'num':
            return Fraction(0), value
        if kind == 'var':
            if self.variable is None:
                self.variable = value
            require(value == self.variable, 'More than one variable')
            return Fraction(1), Fraction(0)
        if (kind, value) == ('op', '('):
            inner = self.expression()
            require(self.take() == ('op', ')'), 'Unbalanced parentheses')
            return inner
        raise ValueError(f'Unexpected token {value!r}')


def equation(text, variable=None):
    """(a, b) with a·v + b = 0, the variable letter, and the unique solution."""
    text = text.replace('$', '')  # typeset as $8(n − 3) = 40$
    left, sep, right = text.partition('=')
    require(sep and '=' not in right, f'Not one equation: {text!r}')
    lp = Linear(left.strip(), variable)
    l = lp.parse()
    rp = Linear(right.strip(), lp.variable)
    r = rp.parse()
    a, b = l[0] - r[0], l[1] - r[1]
    require(a != 0, 'No unique solution')
    return (a, b), rp.variable, -b / a


def equivalent(first, second):
    (a, b), (c, d) = first, second
    return a * d == b * c


def arithmetic(text):
    a, b = Linear(text).parse()
    require(a == 0, 'Variable in arithmetic')
    return b


# ------------------------------------------------- explanation equality chains
RUN = re.compile(r'[0-9.()×÷+−/= -]+')


def chains(text):
    """Check every displayed numeric chain a = b = c; return how many were checked."""
    checked = 0
    for m in RUN.finditer(text):
        run = m.group()
        if '=' not in run:
            continue
        before = text[m.start() - 1] if m.start() else ' '
        after = text[m.end()] if m.end() < len(text) else ' '
        pieces = run.split('=')
        values = []
        for k, piece in enumerate(pieces):
            raw = piece
            piece = piece.strip().rstrip('.')
            usable = bool(piece) and re.search(r'\d', piece)
            if k == 0 and (before.isalnum() or before in ')$') and not raw.startswith(' '):
                usable = False
            if k == len(pieces) - 1 and after.isalpha() and not raw.endswith(' '):
                usable = False
            if usable and (re.match(r'^[+×÷/−-]\s', piece) or re.match(r'^[+×÷/)]', piece)
                           or re.search(r'[+×÷/−(-]$', piece) or piece.count('(') != piece.count(')')):
                usable = False
            value = None
            if usable:
                try:
                    value = arithmetic(piece)
                except (ValueError, ZeroDivisionError):
                    value = None
            values.append(value)
        for x, y in zip(values, values[1:]):
            if x is not None and y is not None:
                require(x == y, f'False equality in {text!r}: {x} ≠ {y}')
                checked += 1
    return checked


# ------------------------------------------------------------------- stories
ONE_STEP_STORIES = [
    # (pattern, operation applied to the unknown, order of the captured numbers)
    (r'A class had some stickers\. The teacher added (\d+) more, and now the class has (\d+) stickers\. Let (s) be the number of stickers the class had at first\.', 'add'),
    (r'Rain raised the water in a barrel by (\d+) centimeters\. The water is now (\d+) centimeters deep\. Let (d) be the depth before the rain, in centimeters\.', 'add'),
    (r'A bakery sold (\d+) muffins in the morning and had (\d+) muffins left\. Let (m) be the number of muffins the bakery had at the start\.', 'subtract'),
    (r'A (\d+)-centimeter piece was cut from a ribbon, leaving (\d+) centimeters\. Let (r) be the ribbon\'s original length, in centimeters\.', 'subtract'),
    (r'Museum tickets cost (\d+) dollars each\. A class paid (\d+) dollars for tickets\. Let (t) be the number of tickets the class bought\.', 'groups'),
    (r'A hall has (\d+) chairs set out in rows of (\d+)\. Let (r) be the number of rows\.', 'rows'),
    (r'A box of pencils is shared equally among (\d+) students, and each student gets (\d+) pencils\. Let (n) be the number of pencils in the box\.', 'share'),
    (r'A rope is cut into (\d+) pieces of equal length\. Each piece is (\d+) meters long\. Let (L) be the length of the rope, in meters\.', 'share'),
]


def one_step_story(prompt):
    """The story's equation as (a, b) for a·v + b = 0, its variable, and the unknown."""
    hits = [(re.match(p, prompt), op) for p, op in ONE_STEP_STORIES]
    hits = [(m, op) for m, op in hits if m]
    require(len(hits) == 1, f'Unrecognized one-step story: {prompt!r}')
    m, op = hits[0]
    first, second, v = int(m[1]), int(m[2]), m[3]
    if op == 'add':          # start + change = now
        form, unknown = (Fraction(1), Fraction(first - second)), second - first
    elif op == 'subtract':   # start − removed = left
        form, unknown = (Fraction(1), Fraction(-first - second)), first + second
    elif op == 'groups':     # price × count = paid
        form, unknown = (Fraction(first), Fraction(-second)), Fraction(second, first)
    elif op == 'rows':       # rows × per row = chairs
        form, unknown = (Fraction(second), Fraction(-first)), Fraction(first, second)
    else:                    # total ÷ parts = each part
        form, unknown = (Fraction(1, first), Fraction(-second)), first * second
    require(Fraction(unknown).denominator == 1 and unknown > 0, 'Story unknown must be a positive whole number')
    rest = prompt[m.end():].strip()
    require(rest == 'Which equation represents the situation, and what is its solution?', 'Unexpected question')
    return form, v, Fraction(unknown)


def dollars(text):
    return Fraction(text)


TWO_STEP_STORIES = {
    'gym': r'A gym charges a (\d+)-dollar sign-up fee plus (\d+) dollars per month\. Ravi has paid (\d+) dollars in all\.',
    'savings': r'Mia has (\d+) dollars saved and adds (\d+) dollars each week\. She wants to have (\d+) dollars\.',
    'taxi': r'A taxi ride costs (\d+(?:\.\d\d)?) dollars to start plus (\d+(?:\.\d\d)?) dollars for each mile\. Ana\'s ride cost (\d+(?:\.\d\d)?) dollars\.',
    'tank': r'A tank holds (\d+) liters of water\. It drains (\d+) liters each minute until it holds (\d+) liters\.',
    'tickets': r'Each of (\d+) friends buys one movie ticket and one (\d+)-dollar snack\. Together they spend (\d+) dollars\.',
    'perimeter': r'A rectangle has a perimeter of (\d+) centimeters\. Its length is (\d+) centimeters\.',
    'sale': r'In a sale, every shirt is (\d+) dollars off its regular price\. Jo buys (\d+) shirts at the sale price and pays (\d+) dollars\.',
}
TWO_STEP_QUESTIONS = {
    'gym': ('m', 'Let m be the number of months Ravi has paid for.', 'For how many months has Ravi paid?'),
    'savings': ('w', 'Let w be the number of weeks until Mia has that amount.', None),
    'taxi': ('d', 'Let d be the number of miles Ana rode.', 'How many miles did Ana ride?'),
    'tank': ('t', 'Let t be the number of minutes the tank drains.', None),
    'tickets': ('c', 'Let c be the cost of one ticket, in dollars.', 'What does one ticket cost, in dollars?'),
    'perimeter': ('w', "Let w be the rectangle's width, in centimeters.", "What is the rectangle's width, in centimeters?"),
    'sale': ('s', 'Let s be the regular price of one shirt, in dollars.', 'What is the regular price of one shirt, in dollars?'),
}


def two_step_story(prompt):
    """Story key, its equation (a, b) in the story's own roles, the variable and the unknown."""
    hits = [(key, re.match(p, prompt)) for key, p in TWO_STEP_STORIES.items()]
    hits = [(key, m) for key, m in hits if m]
    require(len(hits) == 1, f'Unrecognized two-step story: {prompt!r}')
    key, m = hits[0]
    a, b, c = ([dollars(g) for g in m.groups()] + [None])[:3]
    if key in ('gym', 'savings', 'taxi'):   # once-only amount a, rate b, total c
        form, unknown = (b, a - c), (c - a) / b
    elif key == 'tank':                     # full a drains b per minute to c
        form, unknown = (-b, a - c), (a - c) / b
    elif key == 'tickets':                  # a friends × (ticket + b) = c
        form, unknown = (a, a * b - c), c / a - b
    elif key == 'perimeter':                # 2 × (width + length b... ) = a
        form, unknown = (Fraction(2), 2 * b - a), a / 2 - b
    else:                                   # b shirts × (price − a) = c
        form, unknown = (b, -a * b - c), c / b + a
    require(unknown.denominator == 1 and unknown > 0, 'Story unknown must be a positive whole number')
    return key, form, TWO_STEP_QUESTIONS[key], unknown, prompt[m.end():].strip()


# --------------------------------------------------------------- inequalities
CONDITIONS = [
    (r'A ride admits only riders taller than (\d+) inches\. Let (h) be the height of a rider the ride admits, in inches\.', '>'),
    (r'An order ships free only when its total is more than (\d+) dollars\. Let (t) be the total of an order that ships free, in dollars\.', '>'),
    (r'All afternoon the temperature stayed above ([−-]?\d+) °C\. Let (t) be an afternoon temperature, in degrees Celsius\.', '>'),
    (r'A bridge allows only trucks that weigh less than (\d+) tons\. Let (w) be the weight of a truck the bridge allows, in tons\.', '<'),
    (r'A freezer must stay colder than ([−-]?\d+) °C\. Let (t) be an allowed freezer temperature, in degrees Celsius\.', '<'),
    (r'Children younger than (\d+) years ride the bus free\. Let (a) be the age of a child who rides free, in years\.', '<'),
    (r'A team needs at least (\d+) players to start a game\. Let (p) be the number of players on a team that can start\.', '≥'),
    (r'A test is passed with a score of (\d+) points or more\. Let (s) be a passing score, in points\.', '≥'),
    (r'An elevator may carry at most (\d+) people\. Let (n) be the number of people on the elevator during a trip\.', '≤'),
    (r'A carry-on bag may weigh no more than (\d+) kilograms\. Let (w) be the weight of an allowed bag, in kilograms\.', '≤'),
]
WORDS = {'greater than': '>', 'less than': '<', 'greater than or equal to': '≥', 'less than or equal to': '≤'}


def holds(value, op, c):
    return {'>': value > c, '<': value < c, '≥': value >= c, '≤': value <= c}[op]


def relation_label(label, variable=None):
    m = re.fullmatch(r'([a-zA-Z]) ([<>≤≥]) (' + NUMBER + ')', label)
    require(m is not None, f'Not a simple inequality: {label!r}')
    require(variable is None or m[1] == variable, 'Wrong variable')
    return m[2], number(m[3])


def line_relation(line):
    return ('≥' if line['included'] else '>') if line['direction'] == 'right' else ('≤' if line['included'] else '<')


def choice_options(public, count):
    options = public['response']['options']
    require(isinstance(options, list) and len(options) == count, 'Wrong number of choices')
    ids = [o['id'] for o in options]
    require(ids == [f'option-{c}' for c in 'abcd'[:count]], 'Choice identifiers out of order')
    require(len({o['label'] for o in options}) == count, 'Duplicate choice labels')
    return options


def only(matches, message):
    require(len(matches) == 1, message)
    return matches[0]


def solve_context(public):
    prompt = public['prompt']
    hits = [(re.match(p, prompt), op) for p, op in CONDITIONS]
    hits = [(m, op) for m, op in hits if m]
    require(len(hits) == 1, f'Unrecognized condition: {prompt!r}')
    m, op = hits[0]
    c, v = number(m[1]), m[2]
    require(prompt[m.end():].strip() == f'Which inequality describes all possible values of {v}?', 'Unexpected question')
    options = choice_options(public, 4)
    parsed = [relation_label(o['label'], v) for o in options]
    require({p[1] for p in parsed} == {c} and {p[0] for p in parsed} == set('<>≤≥'), 'Choices must be the four signs at the stated boundary')
    return only([o['id'] for o, p in zip(options, parsed) if p == (op, c)], 'Exactly one matching inequality')


def figure_lines(public, count):
    f = public.get('figure')
    require(isinstance(f, dict) and f.get('kind') == 'inequality-lines', 'Missing number-line figure')
    require(type(f['min']) is int and type(f['max']) is int and 6 <= f['max'] - f['min'] <= 12, 'Number-line window')
    lines = f['lines']
    require(len(lines) == count, 'Wrong number of graphed lines')
    for line in lines:
        require(type(line['boundary']) is int and f['min'] < line['boundary'] < f['max'], 'Boundary must be an interior tick')
    return lines


def solve_number_line(public):
    require(public['prompt'] == 'Which inequality does the number line show?', 'Unexpected prompt')
    line = figure_lines(public, 1)[0]
    require('label' not in line, 'A single line is unlabeled')
    options = choice_options(public, 4)
    parsed = [relation_label(o['label'], 'x') for o in options]
    target = (line_relation(line), Fraction(line['boundary']))
    require({p[1] for p in parsed} == {target[1]}, 'Choices must share the graphed boundary')
    return only([o['id'] for o, p in zip(options, parsed) if p == target], 'Exactly one matching inequality')


def solve_line_choice(public):
    prompt = public['prompt']
    m = re.fullmatch(r'Which number line shows (?:the solutions of x ([<>≤≥]) (' + NUMBER + r')|all numbers (greater than or equal to|less than or equal to|greater than|less than) (' + NUMBER + r'))\?', prompt)
    require(m is not None, f'Unexpected prompt: {prompt!r}')
    op, c = (m[1], number(m[2])) if m[1] else (WORDS[m[3]], number(m[4]))
    lines = figure_lines(public, 4)
    require([l.get('label') for l in lines] == list('ABCD'), 'Lines must be labeled A to D')
    require(len({line_relation(l) for l in lines}) == 4 and {l['boundary'] for l in lines} == {c}, 'Graphs must differ only in circle and direction')
    options = choice_options(public, 4)
    require([o['label'] for o in options] == [f'Number line {l}' for l in 'ABCD'], 'Choices must name the lines in order')
    letter = only([l['label'] for l in lines if line_relation(l) == op], 'Exactly one graph matches')
    return options['ABCD'.index(letter)]['id']


def statement_truth(text, op, c):
    """Decide a statement about the solution set of x op c by its own claims."""
    sample = c + (Fraction(1, 2) if op in '>≥' else Fraction(-1, 2))
    require(holds(sample, op, c) and sample.denominator != 1, 'Sample solution')
    side = 'greater' if op in '>≥' else 'less'
    n = r'(' + NUMBER + r')'
    m = re.fullmatch(r'Every number (greater|less) than ' + n + r' is a solution, but ' + n + r' is not\. There are infinitely many solutions\.', text)
    if m:
        require(number(m[2]) == c == number(m[3]), 'Statement boundary')
        return m[1] == side and not holds(c, op, c)
    m = re.fullmatch(n + r' and every number (greater|less) than ' + n + r' are solutions\. There are infinitely many solutions\.', text)
    if m:
        require(number(m[1]) == c == number(m[3]), 'Statement boundary')
        return m[2] == side and holds(c, op, c)
    if re.fullmatch(r'Only the whole numbers .* are solutions\.', text):
        return False  # sample is a solution and is not whole
    m = re.fullmatch(n + r' is the only solution\.', text)
    if m:
        return False  # number(m[1]) and sample cannot both be the only solution
    raise ValueError(f'Unrecognized statement: {text!r}')


def solve_solution_set(public):
    prompt = public['prompt']
    options = choice_options(public, 4)
    m = re.fullmatch(r'Which statement about the solutions of x ([<>≤≥]) (\d+) is true\?', prompt)
    if m:
        op, c = m[1], number(m[2])
        return only([o['id'] for o in options if statement_truth(o['label'], op, c)], 'Exactly one true statement')
    m = re.fullmatch(r'Which list contains only solutions of x ([<>≤≥]) (' + NUMBER + r')\?', prompt)
    require(m is not None, f'Unexpected prompt: {prompt!r}')
    op, c = m[1], number(m[2])
    good = []
    for o in options:
        values = [number(t) for t in o['label'].split(', ')]
        require(len(values) == 3 and values == sorted(values), 'Lists hold three ascending numbers')
        if all(holds(v, op, c) for v in values):
            good.append(o['id'])
    return only(good, 'Exactly one list of solutions')


# ------------------------------------------------------------------- solving
def solve_balance(public, two_step):
    f = public.get('figure')
    require(isinstance(f, dict) and f.get('kind') == 'balance-scale', 'Missing balance')
    g, p, q, r = f['groups'], f['blocks'], f['units'], f['right']
    require(all(type(v) is int for v in (g, p, q, r)), 'Balance counts must be integers')
    if two_step:
        require((g == 1 and p >= 2 and q >= 1) or (g >= 2 and p == 1 and q >= 1), 'A two-step balance')
    else:
        require(g == 1 and ((p == 1 and q >= 1) or (p >= 2 and q == 0)), 'A one-step balance')
    if g > 1:
        cubes = f'{q} cube' if q == 1 else f'{q} cubes'
        require(public['prompt'] == f'The balance is level. The left pan holds {g} identical bags, and each bag holds one x block and {cubes}. The right pan holds {r} cubes. Each cube weighs 1 gram. How many grams does one x block weigh?', 'Bag prompt must state the drawn bags')
    else:
        require(public['prompt'] == 'The balance is level. Every block labeled x has the same weight, and each small cube weighs 1 gram. How many grams does one x block weigh?', 'Unexpected balance prompt')
    # Try every whole weight that fits on the right pan; exactly one must level the pans.
    weights = [x for x in range(1, r + 1) if g * (p * x + q) == r]
    return Fraction(only(weights, 'A level balance needs exactly one whole weight'))


def solve_symbolic(public, two_step):
    m = re.fullmatch(r'Solve for ([a-z]): (.+)\.', public['prompt'])
    require(m is not None, 'Unexpected equation prompt')
    form, variable, solution = equation(m[2], m[1])
    require(variable == m[1], 'Solve for the displayed variable')
    text = m[2]
    require(len(re.findall(r'(?<![a-z])' + m[1] + r'(?![a-z])', text)) == 1, 'The variable appears once')
    operations = len(re.findall(r'[+×÷]| − |\(|\d[a-z]', text))
    require(operations == (2 if two_step else 1), f'Expected {"two" if two_step else "one"} operations: {text}')
    if two_step:
        require(solution.denominator == 1, 'Two-step solutions are integers')
    else:
        require(solution >= 0 and re.search(r'[−-]\d', text) is None, 'One-step values are nonnegative')
        require(public['response']['kind'] == ('fraction' if '/' in text else 'number'), 'Response kind follows the number system')
    return solution


def solve_one_step_story(public):
    form, v, unknown = one_step_story(public['prompt'])
    options = choice_options(public, 4)
    good = []
    for o in options:
        eq, sep, sol = o['label'].partition('; ')
        require(sep, 'Choice gives an equation and a solution')
        claimed_form, variable, solution = equation(eq, v)
        m = re.fullmatch(re.escape(v) + r' = (\d+)', sol)
        require(m is not None, 'Choice states the solution')
        if equivalent(claimed_form, form) and Fraction(m[1]) == unknown:
            good.append(o['id'])
    return only(good, 'Exactly one equation-and-solution choice matches the story')


def solve_two_step_story(public):
    key, form, (v, define, question), unknown, rest = two_step_story(public['prompt'])
    if public['templateId'] == 'two-step-word-problem':
        if question is None:
            question = {'savings': r'After how many weeks will Mia have exactly \d+ dollars\?',
                        'tank': r'After how many minutes does the tank hold \d+ liters\?'}[key]
            require(re.fullmatch(question, rest) is not None, 'Unexpected question')
        else:
            require(rest == question, 'Unexpected question')
        return unknown
    require(rest == f'{define} Which equation can be used to find {v}?', 'Unexpected model question')
    options = choice_options(public, 4)
    good = []
    for o in options:
        claimed, variable, solution = equation(o['label'], v)
        if equivalent(claimed, form):
            good.append(o['id'])
        else:
            # A wrong equation must not also produce the story's answer.
            require(solution != unknown, 'A distractor equation solves the story')
    return only(good, 'Exactly one equivalent equation')


def solve_equations(public):
    template = public['templateId']
    require(template in EQUATIONS, 'Unknown equation task')
    kind = public['response']['kind']
    require((kind == 'choice') == (template in EQUATIONS_CHOICE), 'Response kind')
    if template not in ('balance-one-step', 'balance-two-step', 'inequality-from-number-line', 'inequality-number-line-choice'):
        require(public.get('figure') is None, 'Unexpected figure')
    return {
        'one-step-equation': lambda p: solve_symbolic(p, False),
        'two-step-equation': lambda p: solve_symbolic(p, True),
        'balance-one-step': lambda p: solve_balance(p, False),
        'balance-two-step': lambda p: solve_balance(p, True),
        'one-step-equation-story': solve_one_step_story,
        'two-step-word-problem': solve_two_step_story,
        'two-step-equation-model': solve_two_step_story,
        'inequality-from-context': solve_context,
        'inequality-from-number-line': solve_number_line,
        'inequality-number-line-choice': solve_line_choice,
        'inequality-solution-set': solve_solution_set,
    }[template](public)


def review_problem(problem):
    checked = sum(chains(step) for step in problem['explanation'])
    checked += chains(problem['hint'])
    public = problem['public']
    if public['response']['kind'] == 'choice':
        wrong = {o['id'] for o in public['response']['options']} - {problem['answer']}
        require(set(problem.get('choiceFeedback', {})) == wrong, 'Every wrong choice needs feedback')
        for text in problem['choiceFeedback'].values():
            checked += chains(text)
    return checked


def review_equation_fixtures():
    def public(template, prompt, response=None, figure=None):
        p = {'templateId': template, 'prompt': prompt, 'response': response or {'kind': 'number', 'label': 'Value'}}
        if figure is not None:
            p['figure'] = figure
        return p
    def choices(*labels):
        return {'kind': 'choice', 'label': 'Choose', 'options': [{'id': f'option-{c}', 'label': l} for c, l in zip('abcd', labels)]}
    assert solve_equations(public('one-step-equation', 'Solve for n: n + 3.25 = 9.')) == Fraction(23, 4)
    assert solve_equations(public('one-step-equation', 'Solve for k: k ÷ 11 = 5/3.', {'kind': 'fraction', 'label': 'v'})) == Fraction(55, 3)
    assert solve_equations(public('one-step-equation', 'Solve for x: 9x = 54.')) == 6
    assert solve_equations(public('two-step-equation', 'Solve for t: −4(t − 3) = 28.')) == -4
    assert solve_equations(public('two-step-equation', 'Solve for t: 7 − 3t = 19.')) == -4
    assert solve_equations(public('two-step-equation', 'Solve for k: −1.25k + 3.5 = −6.5.')) == 8
    assert solve_equations(public('balance-two-step', 'The balance is level. The left pan holds 3 identical bags, and each bag holds one x block and 3 cubes. The right pan holds 15 cubes. Each cube weighs 1 gram. How many grams does one x block weigh?',
                                  figure={'kind': 'balance-scale', 'groups': 3, 'blocks': 1, 'units': 3, 'right': 15})) == 2
    story = 'A box of pencils is shared equally among 6 students, and each student gets 24 pencils. Let n be the number of pencils in the box. Which equation represents the situation, and what is its solution?'
    assert solve_equations(public('one-step-equation-story', story, choices('6n = 24; n = 4', 'n ÷ 6 = 24; n = 4', 'n ÷ 6 = 24; n = 144', '6n = 24; n = 144'))) == 'option-c'
    assert solve_equations(public('two-step-word-problem', 'A taxi ride costs 3.50 dollars to start plus 1.75 dollars for each mile. Ana\'s ride cost 22.75 dollars. How many miles did Ana ride?')) == 11
    model = 'Each of 5 friends buys one movie ticket and one 8-dollar snack. Together they spend 95 dollars. Let c be the cost of one ticket, in dollars. Which equation can be used to find c?'
    assert solve_equations(public('two-step-equation-model', model, choices('5c + 8 = 95', '5(c − 8) = 95', '5(c + 8) = 95', '8(c + 5) = 95'))) == 'option-c'
    ctx = 'An elevator may carry at most 11 people. Let n be the number of people on the elevator during a trip. Which inequality describes all possible values of n?'
    assert solve_equations(public('inequality-from-context', ctx, choices('n ≥ 11', 'n > 11', 'n ≤ 11', 'n < 11'))) == 'option-c'
    line = {'kind': 'inequality-lines', 'min': -12, 'max': -2, 'lines': [{'boundary': -8, 'direction': 'right', 'included': False}]}
    assert solve_equations(public('inequality-from-number-line', 'Which inequality does the number line show?', choices('x ≤ −8', 'x > −8', 'x ≥ −8', 'x < −8'), line)) == 'option-b'
    lists = choices('−13, −4, −2', '−1.3, 0, 28', '−11, −2, 0', '−10, −2.7, −1.3')
    assert solve_equations(public('inequality-solution-set', 'Which list contains only solutions of x ≤ −2?', lists)) == 'option-a'
    # Malformed or inconsistent displays are rejected.
    rejected = 0
    for bad in [
        public('one-step-equation', 'Solve for x: x + x = 4.'),
        public('two-step-equation', 'Solve for x: 3x = 9.'),
        public('balance-one-step', 'The balance is level. Every block labeled x has the same weight, and each small cube weighs 1 gram. How many grams does one x block weigh?',
               figure={'kind': 'balance-scale', 'groups': 1, 'blocks': 2, 'units': 0, 'right': 7}),
        public('one-step-equation-story', story, choices('6n = 24; n = 4', 'n ÷ 6 = 24; n = 144', 'n ÷ 6 = 24; n = 144', '6n = 24; n = 144')),
        public('two-step-equation-model', model, choices('5c + 40 = 95', '5(c − 8) = 95', '5(c + 8) = 95', '8(c + 5) = 95')),
        public('inequality-solution-set', 'Which list contains only solutions of x ≤ −2?', choices('−13, −4, −2', '−11, −3, −2', '−11, −2, 0', '−10, −2.7, −1.3')),
    ]:
        try:
            solve_equations(bad)
        except (ValueError, KeyError):
            rejected += 1
    require(rejected == 6, f'Malformed fixtures accepted: {6 - rejected}')
    require(chains('x = 12 ÷ 3 = 4. Check: 3 × (−2) + 7 = 1.') == 2, 'Chain checker')
    try:
        chains('So 4(x − 3) = 4x − 12 and 12 ÷ 3 = 5.')
    except ValueError:
        pass
    else:
        raise ValueError('False chain accepted')
    return {'fixtures': 14, 'rejected': rejected}


# ------------------------------------------------------------------- content
_EXPORT = None


def content(data=None):
    global _EXPORT
    if data is not None:
        return data
    if _EXPORT is None:
        app = Path(__file__).resolve().parent.parent
        _EXPORT = subprocess.check_output(['node', '--import', 'tsx', 'scripts/equation-content-oracle.ts'], cwd=app, text=True)
    return json.loads(_EXPORT)


def worked_answer(lesson):
    """Recompute each worked example from its prompt with this file's readers."""
    template, worked = lesson['id'], lesson['workedExample']
    prompt, answer = worked['prompt'], worked['answer']
    if template in ('one-step-equation', 'two-step-equation'):
        m = re.fullmatch(r'Solve for ([a-z]): (.+)\.', prompt)
        return number(answer) == equation(m[2], m[1])[2]
    if template == 'one-step-equation-story':
        form, v, unknown = one_step_story(prompt)
        eq, _, sol = answer.partition('; ')
        return equivalent(equation(eq, v)[0], form) and sol == f'{v} = {unknown}'
    if template in ('balance-one-step', 'balance-two-step'):
        m = re.fullmatch(r'A level balance has (one|\d+) x blocks? and (\d+) cubes on the left pan and (\d+) cubes on the right pan\. Each cube weighs 1 gram\. How many grams does (?:the|one) x block weigh\?', prompt)
        p = 1 if m[1] == 'one' else int(m[1])
        return [x for x in range(1, 100) if p * x + int(m[2]) == int(m[3])] == [int(answer)]
    if template == 'two-step-word-problem':
        return two_step_story(prompt)[3] == number(answer)
    if template == 'two-step-equation-model':
        key, form, (v, define, _), unknown, rest = two_step_story(prompt)
        return equivalent(equation(answer, v)[0], form)
    if template == 'inequality-from-context':
        m, op = next((re.match(p, prompt), op) for p, op in CONDITIONS if re.match(p, prompt))
        return relation_label(answer, m[2]) == (op, number(m[1]))
    if template == 'inequality-from-number-line':
        m = re.fullmatch(r'A number line shows an? (filled|open) circle at (' + NUMBER + r') and a thick ray to the (left|right)\. Which inequality does the number line show\?', prompt)
        op = line_relation({'included': m[1] == 'filled', 'direction': m[3]})
        return relation_label(answer, 'x') == (op, number(m[2]))
    if template == 'inequality-number-line-choice':
        m = re.match(r'Describe the number line that shows the solutions of x ([<>≤≥]) (' + NUMBER + r'):', prompt)
        op, c = m[1], m[2]
        return answer == f'A {"filled" if op in "≤≥" else "open"} circle at {c} and a ray pointing {"right" if op in ">≥" else "left"}'
    m = re.fullmatch(r'Which of the numbers (.+) are solutions of x ([<>≤≥]) (' + NUMBER + r')\?', prompt)
    values = re.split(r', | and ', m[1])
    solutions = [v for v in values if holds(number(v), m[2], number(m[3]))]
    return answer == ' and '.join(solutions)


WORKSHEET_BREADTH = {
    'one-step-equation': lambda ps: {'+', '−', '÷', '/', '.'} <= set(''.join(p['prompt'] for p in ps)),
    'one-step-equation-story': lambda ps: len({p['prompt'].split('.')[0][:12] for p in ps}) >= 8,
    'balance-one-step': lambda ps: {p['figure']['units'] == 0 for p in ps} == {True, False},
    'two-step-equation': lambda ps: any('(' in p['prompt'] for p in ps) and any('.' in p['prompt'][:-1] for p in ps) and any('−' in p['prompt'] for p in ps),
    'two-step-word-problem': lambda ps: len({two_step_story(p['prompt'])[0] for p in ps}) == 7,
    'two-step-equation-model': lambda ps: len({two_step_story(p['prompt'])[0] for p in ps}) == 7,
    'balance-two-step': lambda ps: {p['figure']['groups'] > 1 for p in ps} == {True, False},
    'inequality-from-context': lambda ps: len({re.search(r'[<>≤≥]', ' '.join(o['label'] for o in p['response']['options'])) is not None for p in ps}) == 1,
    'inequality-from-number-line': lambda ps: {line_relation(p['figure']['lines'][0]) for p in ps} == set('<>≤≥'),
    'inequality-number-line-choice': lambda ps: any('all numbers' in p['prompt'] for p in ps) and any('solutions of' in p['prompt'] for p in ps),
    'inequality-solution-set': lambda ps: any('statement' in p['prompt'] for p in ps) and any('list' in p['prompt'] for p in ps),
}


def review_figures(figures):
    import xml.etree.ElementTree as ET
    checked = 0
    by_kind = {f['kind']: ET.fromstring(f['html']) for f in figures}
    require(set(by_kind) == {'balance-remove', 'balance-split', 'balance-bags', 'undo-chain', 'equation-tape', 'two-step-tape', 'inequality-many-solutions'}, 'Figure inventory')
    for kind in ('balance-remove', 'balance-split', 'balance-bags'):
        weights = set()
        for svg in (e for e in by_kind[kind].iter() if 'data-equation' in e.attrib):
            form, _, x = equation(svg.attrib['data-equation'], 'x')
            left_blocks, left_cubes = int(svg.attrib['data-left-blocks']), int(svg.attrib['data-left-cubes'])
            right = int(svg.attrib['data-right-cubes'])
            require(left_blocks * x + left_cubes == right, f'{kind}: drawn counts do not balance')
            l, _, r = svg.attrib['data-equation'].partition('=')
            la, lb = Linear(l.strip(), 'x').parse()
            require((la, lb) == (left_blocks, left_cubes) and Linear(r.strip(), 'x').parse() == (0, right), f'{kind}: equation does not match the drawing')
            drawn_blocks = sum(1 for e in svg.iter() if e.attrib.get('data-x-block') == 'true')
            drawn_cubes = sum(1 for e in svg.iter() if e.attrib.get('data-cube') == 'true' or e.attrib.get('data-removed-cube') == 'true')
            require(drawn_blocks == left_blocks and drawn_cubes == left_cubes + right, f'{kind}: drawn objects miscounted')
            removed = int(svg.attrib['data-removed'])
            require(sum(1 for e in svg.iter() if e.attrib.get('data-removed-cube') == 'true') == 2 * removed, f'{kind}: removal must be equal on both pans')
            weights.add(x)
            checked += 1
        require(len(weights) == 1, f'{kind}: panels disagree about the weight')
    chain = by_kind['undo-chain']
    values = [int(e.attrib['data-value']) for e in chain.iter() if 'data-value' in e.attrib]
    steps = [e.attrib['data-step'] for e in chain.iter() if 'data-step' in e.attrib]
    require(steps[:2] == ['× 3', '+ 5'] and steps[2:] == ['− 5', '÷ 3'], 'Undo chain steps')
    require(values == [20, 20, 15, 5] and 20 - 5 == 15 and Fraction(15, 3) == 5 and 3 * 5 + 5 == 20, 'Undo chain values')
    checked += 1
    for kind in ('equation-tape', 'two-step-tape'):
        for tape in (e for e in by_kind[kind].iter() if 'data-tape' in e.attrib):
            segments = [e for e in tape.iter() if 'data-segment' in e.attrib]
            total = int(tape.attrib['data-total'])
            require(sum(int(s.attrib['data-value']) for s in segments) == total, f'{kind}: segments must fill the total')
            unknowns = {int(s.attrib['data-value']) for s in segments if s.attrib['data-segment'].isalpha()}
            letter = next(s.attrib['data-segment'] for s in segments if s.attrib['data-segment'].isalpha())
            require(len(unknowns) == 1 and equation(tape.attrib['data-tape'], letter)[2] == unknowns.pop(), f'{kind}: unknown length must solve the equation')
            for s in segments:
                if not s.attrib['data-segment'].isalpha():
                    require(int(s.attrib['data-segment']) == int(s.attrib['data-value']), f'{kind}: label must equal length')
            checked += 1
    many = next(e for e in by_kind['inequality-many-solutions'].iter() if 'data-boundary' in e.attrib)
    boundary = Fraction(many.attrib['data-boundary'])
    points = [Fraction(e.attrib['data-solution']) for e in many.iter() if 'data-solution' in e.attrib]
    require(len(points) == 6 and all(holds(p, many.attrib['data-relation'], boundary) for p in points), 'Marked points must be solutions')
    checked += 1
    return checked


def review_equation_content(data=None):
    data = content(data)
    checked = 0
    for sheet in data['worksheets']:
        problems = sheet['problems']
        require(len(problems) == 12, 'Worksheet length')
        keys = [json.dumps([p['public']['prompt'], p['public'].get('figure')], sort_keys=True) for p in problems]
        require(len(set(keys)) == 12, 'Repeated worksheet problem')
        for p in problems:
            expected = solve_equations(p['public'])
            actual = p['answer'] if p['public']['response']['kind'] == 'choice' else number(p['answer'])
            require(actual == expected, f'Worksheet answer: {p["public"]["prompt"]!r}')
            checked += review_problem(p)
        require(WORKSHEET_BREADTH[sheet['templateId']]([p['public'] for p in problems]), 'Worksheet lacks breadth: ' + sheet['templateId'])
    lessons = {lesson['id']: lesson for lesson in data['lessons']}
    require(set(lessons) == EQUATIONS, 'Missing standalone lesson')
    for lesson in lessons.values():
        require(worked_answer(lesson), 'Worked example answer: ' + lesson['id'])
        for step in lesson['workedExample']['steps']:
            checked += chains(step)
        for section in lesson['sections']:
            for paragraph in section['paragraphs']:
                checked += chains(paragraph)
    checked += review_figures(data['figures'])
    return {'worksheets': len(data['worksheets']), 'lessons': len(lessons), 'checkedEqualities': checked}


def review_content_mutations():
    data = content()
    mutants = []
    bad = copy.deepcopy(data); bad['lessons'][0]['workedExample']['answer'] = '1.95'; mutants.append(bad)
    bad = copy.deepcopy(data); bad['lessons'][3]['sections'][1]['paragraphs'][0] = bad['lessons'][3]['sections'][1]['paragraphs'][0].replace('28 ÷ 4 = 7', '28 ÷ 4 = 8'); mutants.append(bad)
    bad = copy.deepcopy(data); bad['worksheets'][0]['problems'][1] = bad['worksheets'][0]['problems'][0]; mutants.append(bad)
    bad = copy.deepcopy(data); bad['worksheets'][0]['problems'][0]['explanation'].append('A false check: 4 × 3 = 13.'); mutants.append(bad)
    bad = copy.deepcopy(data); bad['worksheets'][-1]['problems'][0]['answer'] = 'option-d' if bad['worksheets'][-1]['problems'][0]['answer'] != 'option-d' else 'option-a'; mutants.append(bad)
    for index, figure in enumerate(data['figures']):
        bad = copy.deepcopy(data)
        html = figure['html']
        replaced = re.sub(r'data-(right-cubes|value|solution)="([^"]*)"', lambda m: f'data-{m[1]}="{"-5" if m[1] == "solution" else str(int(m[2]) + 1)}"', html, count=1)
        require(replaced != html, 'Figure mutation did not apply: ' + figure['kind'])
        bad['figures'][index]['html'] = replaced
        mutants.append(bad)
    for bad in mutants:
        try:
            review_equation_content(bad)
        except (ValueError, KeyError, TypeError, StopIteration, AttributeError):
            pass
        else:
            raise ValueError('Corrupted content accepted')
    return len(mutants)


if __name__ == '__main__':
    print(review_equation_fixtures())
    print(review_equation_content())
    print({'contentMutantsRejected': review_content_mutations()})
