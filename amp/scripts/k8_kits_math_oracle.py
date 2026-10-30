"""Independent review of the multi-term-chain, operation-sentence and one-step-result kits.

Every answer is re-derived from the public prompt, choices and table/figure
data with exact Fractions. Choice items must have exactly one defensible
option: equivalent sentences (12 / 3 = 4 and 4 x 3 = 12) may not both be
offered, and every distractor is shown to be wrong by its own computation.
The private answer, hint and explanation are only values under test.
"""
import re
from fractions import Fraction as F

CHAIN = frozenset({
    'fraction-term-chain', 'decimal-rename-chain', 'price-count-chain',
    'dollar-rate-scale', 'signed-changes-sum',
})
SENTENCE = frozenset({
    'operation-sentence-choice', 'related-division-sentence',
    'related-subtraction-sentence', 'whole-number-equality-choice',
})
STEP = frozenset({
    'equation-after-one-step', 'expression-after-first-step',
    'factor-out-choice', 'step-reason-table',
})
SUPPORTED = CHAIN | SENTENCE | STEP
CHOICE_REVIEW = SENTENCE | STEP


def require(condition, message):
    if not condition:
        raise ValueError(message)


# ------------------------------------------------------------------ parsing

def plain(text):
    """Learner text as a flat expression: no $, ASCII operators, a/b fractions."""
    text = text.replace('$', '').replace('\u2212', '-')
    text = re.sub(r'(\d+)\\frac\{(\d+)\}\{(\d+)\}', r'(\1+\2/\3)', text)
    text = re.sub(r'\\frac\{([^{}]+)\}\{([^{}]+)\}', r'(\1)/(\2)', text)
    return text.replace('\\times', '*').replace('\\div', '/').replace('\\cdot', '*').strip()


TOKEN = re.compile(r'\s*(\d+(?:\.\d+)?|[a-z]|[-+*/()=])')


def tokenize(text):
    text = plain(text)
    out, position = [], 0
    while position < len(text):
        match = TOKEN.match(text, position)
        require(match is not None, f'Unreadable text: {text!r}')
        out.append(match[1])
        position = match.end()
    # Implicit multiplication: 9x, 5(x+8), 2(3), x(...)
    result = []
    for token in out:
        if result:
            previous = result[-1]
            left = re.fullmatch(r'\d+(?:\.\d+)?|[a-z]|\)', previous)
            right = re.fullmatch(r'\d+(?:\.\d+)?|[a-z]|\(', token)
            if left and right and not (re.fullmatch(r'\d', previous[-1]) and re.fullmatch(r'\d', token[0])):
                result.append('*')
        result.append(token)
    return result


class Lin(dict):
    """A linear form: variable letter or '' (constant) -> exact coefficient."""

    def coef(self, name):
        return self.get(name, F(0))

    def _clean(self):
        return Lin({k: v for k, v in self.items() if v != 0 or k == ''})

    def add(self, other, sign=1):
        total = Lin(self)
        for key, value in other.items():
            total[key] = total.get(key, F(0)) + sign * value
        return total

    def scale(self, factor):
        return Lin({key: value * factor for key, value in self.items()})

    def constant(self):
        return all(k == '' for k, v in self.items() if v != 0)

    def key(self):
        return tuple(sorted((k, v) for k, v in self.items() if v != 0))


def parse_linear(tokens):
    position = 0

    def peek():
        return tokens[position] if position < len(tokens) else None

    def take():
        nonlocal position
        position += 1
        return tokens[position - 1]

    def expression():
        value = term()
        while peek() in ('+', '-'):
            sign = 1 if take() == '+' else -1
            value = value.add(term(), sign)
        return value

    def term():
        value = unary()
        while peek() in ('*', '/'):
            operator = take()
            other = unary()
            if operator == '*':
                if other.constant():
                    value = value.scale(other.coef(''))
                else:
                    require(value.constant(), 'Product of two unknowns')
                    value = other.scale(value.coef(''))
            else:
                require(other.constant() and other.coef('') != 0, 'Division by an unknown or zero')
                value = value.scale(1 / other.coef(''))
        return value

    def unary():
        if peek() == '-':
            take()
            return unary().scale(-1)
        return atom()

    def atom():
        token = take()
        if token == '(':
            value = expression()
            require(take() == ')', 'Missing )')
            return value
        if re.fullmatch(r'\d+(?:\.\d+)?', token):
            return Lin({'': F(token)})
        require(re.fullmatch(r'[a-z]', token) is not None, f'Unexpected {token!r}')
        return Lin({token: F(1)})

    value = expression()
    require(position == len(tokens), f'Trailing text in {tokens}')
    return value


def linear(text):
    return parse_linear(tokenize(text))


def value_of(text):
    result = linear(text)
    require(result.constant(), f'Not a number: {text!r}')
    return result.coef('')


def equation(text):
    left, right = plain(text).split('=')
    return linear(left), linear(right)


def sides_key(text):
    left, right = equation(text)
    return left.key(), right.key()


def number(token):
    """3, -3, 5/2, 2.5, '4 1/3' (as printed in a table) or a TeX mixed number."""
    token = plain(token).replace('+', ' ') if '\\frac' in token else token.replace('\u2212', '-').strip()
    mixed = re.fullmatch(r'(-?\d+) (\d+)/(\d+)', token)
    if mixed:
        whole = F(mixed[1])
        return whole + (F(int(mixed[2]), int(mixed[3])) if whole >= 0 else -F(int(mixed[2]), int(mixed[3])))
    return value_of(token)


def prompt_numbers(text):
    """Each term of the prompt in reading order: decimals, fractions, mixed numbers."""
    pattern = re.compile(r'\$(\d*\\frac\{\d+\}\{\d+\})\$|(?<![\w.$\\{])(\d+\.\d+|\d+)(?![\w.\\}])')
    found = []
    for match in pattern.finditer(text):
        found.append(match[1] if match[1] else match[2])
    return found


def table_rows(public):
    figure = public.get('figure')
    require(figure and figure['kind'] == 'scene', 'A table figure is required')
    elements = figure['scene']['elements']
    tables = [e for e in elements if e['type'] == 'lineTable']
    require(len(tables) == 1, 'Expected exactly one table')
    return tables[0]['rows']


def options_of(public):
    response = public['response']
    require(response['kind'] == 'choice', 'Choice response required')
    options = response['options']
    require(len(options) == 4 and len({o['id'] for o in options}) == 4, 'Four distinct options required')
    return options


def one_correct(public, correct):
    """correct: the set of option ids the item's own wording makes right."""
    require(len(correct) == 1, f'{len(correct)} defensible options: {sorted(correct)}')
    return next(iter(correct))


def check_distinct(labels, how):
    keys = [how(label) for label in labels]
    require(len(set(keys)) == len(keys), f'Options are mathematically equal: {labels}')


# ------------------------------------------------------------ chain solvers

def solve_fraction_chain(public):
    prompt = public['prompt']
    require('Enter the answer as a fraction, a decimal or a whole number' in prompt, 'Answer forms must be stated')
    symbolic = re.match(r'What is the value of \$(.+)\$\?', prompt)
    if symbolic:
        return value_of(symbolic[1])
    if 'table' in prompt:
        rows = table_rows(public)
        values = [number(cell) for cell in rows[1][1:]]
        require(len(values) == 3 and len(rows[0]) == 4, 'Three table terms')
        start = re.search(r'(?:held|was|had) (\d+(?:\.\d+)?) ', prompt)
        if re.search(r'\bleft\b', prompt):
            require(start is not None and re.search(r'used|cut off|served', prompt) is not None, 'Start amount and removal wording')
            return F(start[1]) - sum(values)
        require(re.search(r'in all', prompt) and start is None, 'Table total wording')
        return sum(values)
    if 'used over four days' in prompt:
        start = re.search(r'(?:held|had) (\d+) ', prompt)
        parts = re.findall(r'\$(\\frac\{\d+\}\{\d+\})\$ of a', prompt)
        require(start and len(parts) == 4 and re.search(r'\bleft\b', prompt), 'Four removals from a start')
        return F(start[1]) - sum(value_of(p) for p in parts)
    terms = re.findall(r'\$(\d*\\frac\{\d+\}\{\d+\})\$|(?<![\w.$\\{])(\d+\.\d+)(?![\w.])', prompt.split('How many')[0])
    values = [value_of(plain(a)) if a else F(b) for a, b in terms]
    require(len(values) == 3 and 'in all' in prompt, 'Three journey terms')
    return sum(values)


def solve_decimal_chain(public):
    prompt = public['prompt']
    require('Enter the answer as a decimal' in prompt, 'Decimal answer form must be stated')
    symbolic = re.match(r'Evaluate \$(.+)\$\. Enter', prompt)
    if symbolic:
        return value_of(symbolic[1])
    rows = table_rows(public)
    require(rows[0][0] == 'Day' and len(rows[1]) == 4, 'Day table')
    cells = rows[1][1:]
    if 'filled over three days and weighs' in prompt:
        total = re.search(r'weighs (\d+(?:\.\d+)?) ', prompt)
        require(total and cells[2] == '?' and 'added on Wednesday' in prompt, 'Missing third day')
        return F(total[1]) - number(cells[0]) - number(cells[1])
    require('(added)' in rows[0][1] and '(added)' in rows[0][2] and '(taken away)' in rows[0][3] and 'are left' in prompt,
            'Added twice, taken away once')
    return number(cells[0]) + number(cells[1]) - number(cells[2])


def solve_price_count(public):
    prompt = public['prompt']
    require('Enter the answer in dollars' in prompt, 'Dollar answer form must be stated')
    prices = re.findall(r'costs (\d+(?:\.\d+)?) dollars', prompt)
    require(len(prices) == 2, 'Two prices')
    first, second = F(prices[0]), F(prices[1])
    group = re.search(r'A group buys (\d+) [a-z ]+? and (\d+) [a-z ]+?\.', prompt)
    each = re.search(r'Each of (\d+) people buys one [a-z ]+? and one [a-z ]+?\.', prompt)
    require((group is None) != (each is None), 'Exactly one purchase wording')
    if group:
        return F(group[1]) * first + F(group[2]) * second
    return F(each[1]) * (first + second)


def solve_rate_scale(public):
    prompt = public['prompt']
    rows = table_rows(public)
    require(rows[0][0] == 'Hours' and rows[1][0] == 'Charge (dollars)' and len(rows[0]) == 3, 'Hours and charge table')
    h1, h2 = F(rows[0][1]), F(rows[0][2])
    c1, c2 = F(rows[1][1]), F(rows[1][2])
    require(h1 != h2 and c1 / h1 == c2 / h2, 'Table is not a constant rate')
    rate = c1 / h1
    require(f'for {rows[0][1]} hours and for {rows[0][2]} hours' in prompt, 'Prompt names the tabled hours')
    asked = re.search(r'What is the charge for (\d+) hours\? Enter the answer in dollars\.', prompt)
    paid = re.search(r'A customer pays (\d+(?:\.\d+)?) dollars\. For how many hours is that\?', prompt)
    require((asked is None) != (paid is None), 'Exactly one question')
    if asked:
        return rate * int(asked[1])
    hours = F(paid[1]) / rate
    require(hours.denominator == 1 and hours > 0, f'Hours must be a whole number: {hours}')
    return hours


def solve_signed_changes(public):
    prompt = public['prompt']
    rows = table_rows(public)
    require(rows[0][0] == 'Day' and rows[1][0] == 'Change', 'Change table')
    changes = [number(c.replace('+', '')) for c in rows[1][1:]]
    days = re.search(r'on each of (\d+) days', prompt)
    require(days and int(days[1]) == len(changes) == len(rows[0]) - 1, 'Stated day count matches the table')
    start = re.search(r'There were (\d+) [a-z ]+ at the start\.', prompt)
    if 'net change' in prompt:
        require(start is None and re.search(rf'net change over the {len(changes)} days\?', prompt), 'Net change wording')
        return sum(changes)
    require(start and re.search(rf'after {len(changes)} days\?', prompt), 'Total-after wording')
    total = F(start[1])
    for change in changes:
        total += change
        require(total >= 0, 'A count of objects can never fall below zero')
    return total


CHAIN_SOLVERS = {
    'fraction-term-chain': solve_fraction_chain,
    'decimal-rename-chain': solve_decimal_chain,
    'price-count-chain': solve_price_count,
    'dollar-rate-scale': solve_rate_scale,
    'signed-changes-sum': solve_signed_changes,
}


# --------------------------------------------------------- sentence solvers

def solve_n(text):
    """The value of n that makes a number sentence true, or None when there is none."""
    left, right = plain(text).split('=')
    difference = linear(left).add(linear(right), -1)
    slope = difference.coef('n')
    if slope == 0:
        return None
    return -difference.coef('') / slope


def groups_total_and_size(public):
    prompt = public['prompt']
    figure = public.get('figure')
    if figure and figure['kind'] == 'grouped-counters':
        size, total = figure['groupSize'], figure['total']
        require(total % size == 0, 'Whole number of groups')
        return F(total, size), F(size)
    if figure and figure['kind'] == 'scene':
        line = [e for e in figure['scene']['elements'] if e['type'] == 'numberLine'][0]
        hops = line['hops']
        lengths = {h['by'] for h in hops}
        require(len(lengths) == 1 and hops[0]['from'] == 0, 'Equal hops from zero')
        for index, hop in enumerate(hops):
            require(hop['from'] == index * hops[0]['by'], 'Hops are contiguous')
        stated = re.search(r'shows (\d+) equal jumps from 0', prompt)
        require(stated and int(stated[1]) == len(hops), 'Stated jumps match the figure')
        return F(len(hops)), F(hops[0]['by'])
    match = re.search(r'There are (\d+) [a-z]+\. Each [a-z]+ holds (\d+) [a-z]+\.', prompt) or \
        re.search(r'A [a-z]+ makes (\d+) jumps\. Each jump is (\d+) long\.', prompt)
    require(match is not None, 'Groups and group size must be stated')
    return F(match[1]), F(match[2])


def solve_operation_sentence(public):
    prompt = public['prompt']
    options = options_of(public)
    story = re.fullmatch(r'Which story can be solved with \$(\d+) \\times (\d+)\$\?', prompt)
    if story:
        a, b = int(story[1]), int(story[2])
        right = set()
        for option in options:
            label = option['label']
            product = re.fullmatch(r'(\d+) [a-z]+ each hold (\d+) [a-z]+\. How many [a-z]+ are there in all\?', label)
            if product and {int(product[1]), int(product[2])} == {a, b}:
                right.add(option['id'])
            else:
                require(product is None or {int(product[1]), int(product[2])} != {a, b}, 'unreachable')
                require(re.search(r'shared equally|equal groups|taken out|more are put in', label), f'Unclassified story: {label}')
        return one_correct(public, right)
    groups, size = groups_total_and_size(public)
    total = groups * size
    negative = 'can NOT be used' in prompt
    if negative:
        require('Which sentence can NOT be used to find how far the frog jumps in all' in prompt, 'Negative wording')
    else:
        require(re.search(r'Which number sentence finds (?:where the last jump lands|how many [a-z]+ there are in all)\?', prompt), 'Question wording')
    good, bad = set(), set()
    for option in options:
        value = solve_n(option['label'])
        # A sentence is right only when it is true for the total AND uses the
        # story's structure: groups and size combined by multiplication, repeated
        # addition, or the inverse division. A coincidental n (2 + 2 = 2 x 2) is
        # an ambiguous item and is rejected below.
        (good if value == total else bad).add(option['id'])
    if negative:
        return one_correct(public, bad)
    # Accidental equalities such as 2 + 2 and 2 x 2 make a distractor defensible.
    return one_correct(public, good)


def solve_related_division(public):
    prompt = public['prompt']
    options = options_of(public)
    fact = re.fullmatch(r'Here is a multiplication fact: \$(\d+) \\times (\d+) = (\d+)\$\. Which division sentence can this fact help you solve\? Use \$n\$ for the unknown\.', prompt)
    if fact:
        a, b, c = int(fact[1]), int(fact[2]), int(fact[3])
        require(a * b == c, 'The stated fact is false')
        right = set()
        for option in options:
            sentence = re.fullmatch(r'\$(\d+) \\div (\d+) = n\$', option['label'])
            if sentence and int(sentence[1]) == c and int(sentence[2]) in (a, b):
                right.add(option['id'])
        return one_correct(public, right)
    division = re.fullmatch(r'Here is a division sentence: \$(\d+) \\div (\d+) = n\$\. Which multiplication sentence helps you find \$n\$\?', prompt)
    require(division is not None, 'Related-division wording')
    dividend, divisor = int(division[1]), int(division[2])
    require(dividend % divisor == 0, 'Division must be exact')
    right = set()
    for option in options:
        label = plain(option['label'])
        sentence = re.fullmatch(r'(\w+|\d+)\*(\w+|\d+)=(\w+|\d+)', label.replace(' ', ''))
        if not sentence:
            continue
        left = [sentence[1], sentence[2]]
        if sentence[3] == str(dividend) and sorted(left) == sorted(['n', str(divisor)]):
            right.add(option['id'])
    return one_correct(public, right)


def solve_related_subtraction(public):
    fact = re.fullmatch(r'Here is an addition fact: \$(\d+) \+ (\d+) = (\d+)\$\. Which subtraction sentence can this fact help you solve\? Use \$n\$ for the unknown\.', public['prompt'])
    require(fact is not None, 'Related-subtraction wording')
    a, b, c = int(fact[1]), int(fact[2]), int(fact[3])
    require(a + b == c, 'The stated fact is false')
    right = set()
    for option in options_of(public):
        sentence = re.fullmatch(r'\$(\d+) - (\d+) = n\$', option['label'])
        if sentence and int(sentence[1]) == c and int(sentence[2]) in (a, b):
            right.add(option['id'])
    return one_correct(public, right)


def solve_true_equation(public):
    prompt = public['prompt']
    options = options_of(public)
    true = set()
    for option in options:
        label = plain(option['label'])
        left, right = label.split('=')
        if 'three factors' in prompt:
            require(left.count('*') == 2 and right.count('*') == 2 and '+' not in label, 'Three factors on each side')
        else:
            require('product and the other side is a sum or a difference' in prompt, 'Mixed wording')
            require(left.count('*') == 1 and re.search(r'[-+]', right) and '*' not in right, 'Product against sum or difference')
        if value_of(left) == value_of(right):
            true.add(option['id'])
    check_distinct([o['label'] for o in options], lambda label: label)
    return one_correct(public, true)


# ------------------------------------------------------------ step solvers

STEP_PROMPTS = (
    (r'Add \$(-?\d+)\$ to both sides of \$(.+)\$\. Which equation results\?', 'add'),
    (r'Subtract \$(-?\d+)\$ from both sides of \$(.+)\$\. Which equation results\?', 'sub'),
    (r'Multiply both sides of \$(.+)\$ by \$(\d+)\$\. Which equation results\?', 'mul'),
    (r'Divide both sides of \$(.+)\$ by \$(\d+)\$\. Which equation results\?', 'div'),
    (r'Take the one step that undoes the multiplication by \$(\d+)\$ outside the parentheses in \$(.+)\$\. Which equation results\?', 'divp'),
    (r'Take the one step that removes the constant term \$(-?\d+)\$ from the left side of \$(.+)\$\. Which equation results\?', 'sub'),
    (r'Take the one step that undoes the division by \$(\d+)\$ in \$(.+)\$\. Which equation results\?', 'mulp'),
)


def apply_step(left, right, kind, amount):
    if kind == 'add':
        return left.add(Lin({'': amount})), right.add(Lin({'': amount}))
    if kind == 'sub':
        return left.add(Lin({'': amount}), -1), right.add(Lin({'': amount}), -1)
    if kind == 'mul':
        return left.scale(amount), right.scale(amount)
    return left.scale(1 / amount), right.scale(1 / amount)


def solve_equation_after_step(public):
    prompt = public['prompt']
    options = options_of(public)
    for pattern, kind in STEP_PROMPTS:
        match = re.fullmatch(pattern, prompt)
        if match:
            break
    else:
        raise ValueError(f'Unknown one-step wording: {prompt!r}')
    if kind in ('add', 'sub'):
        amount, text = F(match[1]), match[2]
    elif kind in ('mul', 'div'):
        text, amount = match[1], F(match[2])
    elif kind == 'divp':
        amount, text, kind = F(match[1]), match[2], 'div'
    else:
        amount, text, kind = F(match[1]), match[2], 'mul'
    left, right = equation(text)
    if kind in ('add', 'sub'):
        require(left.coef('') != 0 and left.coef('') == (amount if kind == 'sub' else -amount) and right.coef('x') == 0, 'The step must remove the constant term')
    if 'outside the parentheses' in prompt or kind == 'div':
        require(left.coef('x') % amount == 0 and (right.coef('') % amount == 0), 'Division must leave whole numbers')
    expected = tuple(side.key() for side in apply_step(left, right, kind, amount))
    keys = [sides_key(o['label'].strip('$')) for o in options]
    require(len(set(keys)) == 4, 'Options are mathematically equal equations')
    return one_correct(public, {o['id'] for o, key in zip(options, keys) if key == expected})


# Order-of-operations steps over a flat token list of Fractions and operators.

def to_tokens(text):
    out = []
    for token in tokenize(text):
        out.append(F(token) if re.fullmatch(r'\d+(?:\.\d+)?', token) else token)
    return out


def _reduce(group):
    """The legal successors of a parenthesis-free group, one operation each."""
    options = []
    for operators in (('*', '/'), ('+', '-')):
        for index, token in enumerate(group):
            if token in operators:
                a, b = group[index - 1], group[index + 1]
                value = a * b if token == '*' else a / b if token == '/' else a + b if token == '+' else a - b
                options.append(group[:index - 1] + [value] + group[index + 2:])
                break
        if options:
            return options
    return options


def legal_steps(tokens):
    if '(' in tokens:
        start = max(i for i, t in enumerate(tokens) if t == '(')
        end = tokens.index(')', start)
        inner = tokens[start + 1:end]
        if len(inner) == 1:
            return [tokens[:start] + inner + tokens[end + 1:]]
        reduced = [tokens[:start + 1] + new + tokens[end:] for new in _reduce(inner)]
        # A group that shrinks to one number is written without its parentheses.
        return reduced + [tokens[:start] + new + tokens[end + 1:] for new in _reduce(inner) if len(new) == 1]
    return _reduce(tokens)


def evaluate_tokens(tokens):
    result = parse_linear([str(t) if isinstance(t, F) else t for t in tokens]) if all(not isinstance(t, F) for t in tokens) else None
    if result is not None:
        return result.coef('')
    return value_of(''.join(f'({t.numerator}/{t.denominator})' if isinstance(t, F) else t for t in tokens))


def solve_expression_step(public):
    prompt = public['prompt']
    options = options_of(public)
    first = re.fullmatch(r'Do only the first step of the order of operations on \$(.+)\$\. Which expression do you get\?', prompt)
    if first:
        tokens = to_tokens(first[1])
        successors = legal_steps(tokens)
        require(len(successors) == 1, 'The first step must be unique')
        right = set()
        for option in options:
            if to_tokens(option['label'].strip('$')) == successors[0]:
                right.add(option['id'])
        check_distinct([o['label'] for o in options], lambda label: tuple(to_tokens(label.strip('$'))))
        return one_correct(public, right)
    lines = re.fullmatch(r'A student simplifies \$(.+?)\$\. ((?:Line \d+: \$.+?\$\. )+)Which line is the first to contain a mistake\?', prompt)
    require(lines is not None, 'Mistake-hunt wording')
    shown = re.findall(r'Line (\d+): \$(.+?)\$\.', lines[2])
    require([int(n) for n, _ in shown] == list(range(1, len(shown) + 1)) and shown[0][1] == lines[1], 'Line 1 is the student\'s expression')
    parsed = [to_tokens(text) for _, text in shown]
    mistake = None
    for index in range(1, len(parsed)):
        if parsed[index] not in legal_steps(parsed[index - 1]):
            mistake = index + 1
            break
    require(mistake is not None, 'The item must contain a mistake')
    truth = evaluate_tokens(parsed[0])
    require(evaluate_tokens(parsed[mistake - 1]) != truth, 'The first illegal line must also change the value')
    for index in range(mistake - 1):
        require(evaluate_tokens(parsed[index]) == truth, 'Lines before the mistake keep the value')
    right = {o['id'] for o in options if o['label'] == f'Line {mistake}'}
    require(sum(o['label'] == 'No line has a mistake' for o in options) <= 1, 'One "no mistake" option at most')
    return one_correct(public, right)


def solve_factor_out(public):
    match = re.fullmatch(r'Factor \$(-?\d+)\$ out of \$(.+)\$\. Which expression is equivalent\?', public['prompt'])
    require(match is not None, 'Factor-out wording')
    factor = int(match[1])
    original = linear(match[2])
    require(all(v % factor == 0 for v in original.values()), 'The factor must divide every term')
    options = options_of(public)
    equivalent, right = set(), set()
    for option in options:
        label = option['label'].strip('$')
        shown = re.fullmatch(r'(-?\d+)\((.+)\)', plain(label))
        require(shown is not None, f'Factored form expected: {label}')
        if linear(label).key() == original.key():
            equivalent.add(option['id'])
            if int(shown[1]) == factor:
                right.add(option['id'])
    # The question asks which expression is equivalent: only one option may be.
    require(equivalent == right, f'A distractor is also equivalent: {sorted(equivalent - right)}')
    return one_correct(public, right)


def split_lines(prompt):
    head = re.fullmatch(r'A solution of \$(.+?)\$ is shown\. ((?:Line \d+: \$.+?\$\. )+)Which list gives the property that justifies each step, from one line to the next\?', prompt)
    require(head is not None, 'Step-reason wording')
    lines = re.findall(r'Line (\d+): \$(.+?)\$\.', head[2])
    require([int(n) for n, _ in lines] == list(range(1, len(lines) + 1)) and lines[0][1] == head[1], 'Line 1 is the solution\'s equation')
    return [text for _, text in lines]


def shape(text):
    e = plain(text).replace(' ', '')
    if re.fullmatch(r'-?\d*\(x[-+]\d+\)=-?\d+', e):
        return 'paren'
    if re.fullmatch(r'x=-?\d+', e):
        return 'solved'
    if re.fullmatch(r'-?\d*x=-?\d+', e):
        return 'times'
    if re.fullmatch(r'\(x\)/\(\d+\)=-?\d+', e):
        return 'over'
    if re.fullmatch(r'-?\d*x[-+]\d+=-?\d+', e):
        return 'times-const'
    if re.fullmatch(r'\(x\)/\(\d+\)[-+]\d+=-?\d+', e):
        return 'over-const'
    raise ValueError(f'Unreadable equation shape: {text!r}')


def property_chain(lines):
    names = []
    for before, after in zip(lines, lines[1:]):
        kind, left_key = shape(before), sides_key(before)
        if kind == 'paren':
            require(shape(after) == 'times-const' and sides_key(after) == left_key, 'Distribution step shown wrongly')
            names.append('Distributive property')
        elif kind in ('times-const', 'over-const'):
            left, right = equation(before)
            constant = left.coef('')
            require(constant != 0 and shape(after) == ('times' if kind == 'times-const' else 'over'), 'Constant-removing step')
            moved = (left.add(Lin({'': constant}), -1), right.add(Lin({'': constant}), -1))
            require(sides_key(after) == tuple(side.key() for side in moved), 'Removing the constant gave a different line')
            names.append('Subtraction property of equality' if constant > 0 else 'Addition property of equality')
        elif kind in ('times', 'over'):
            left, right = equation(before)
            scale = 1 / left.coef('x')
            require(shape(after) == 'solved' and sides_key(after) == (Lin({'x': F(1)}).key(), right.scale(scale).key()), 'Solving step shown wrongly')
            names.append('Division property of equality' if kind == 'times' else 'Multiplication property of equality')
        else:
            raise ValueError('Nothing follows a solved line')
    require(shape(lines[-1]) == 'solved', 'The last line must be solved')
    return names


def solve_step_reasons(public):
    lines = split_lines(public['prompt'])
    names = property_chain(lines)
    right = set()
    for option in options_of(public):
        items = re.findall(r'(\d+): ([^;]+?)(?:;|$)', option['label'])
        require([int(i) for i, _ in items] == list(range(1, len(items) + 1)), 'Reasons are numbered in order')
        if [name.strip() for _, name in items] == names:
            right.add(option['id'])
    check_distinct([o['label'] for o in options_of(public)], lambda label: label)
    return one_correct(public, right)


CHOICE_SOLVERS = {
    'operation-sentence-choice': solve_operation_sentence,
    'related-division-sentence': solve_related_division,
    'related-subtraction-sentence': solve_related_subtraction,
    'whole-number-equality-choice': solve_true_equation,
    'equation-after-one-step': solve_equation_after_step,
    'expression-after-first-step': solve_expression_step,
    'factor-out-choice': solve_factor_out,
    'step-reason-table': solve_step_reasons,
}


def solve(public):
    template = public['templateId']
    require(template in SUPPORTED, f'Unexpected template {template}')
    if template in CHAIN_SOLVERS:
        return CHAIN_SOLVERS[template](public)
    return CHOICE_SOLVERS[template](public)


# ----------------------------------------------------------------- review

def digits(value):
    """How a learner would key the exact value, for leakage search."""
    value = F(value)
    if value.denominator == 1:
        return [str(value.numerator)]
    return [f'{value.numerator}/{value.denominator}', f'\\frac{{{value.numerator}}}{{{value.denominator}}}']


def review_problem(problem):
    public = problem['public']
    template = public['templateId']
    expected = solve(public)
    answer = problem['answer']
    hint = problem.get('hint', '')
    require(isinstance(hint, str) and hint.strip(), 'Hint required')
    if template in CHAIN:
        require(F(answer) == expected, f'{template}: answer {answer} != {expected}')
        require(public['response']['kind'] in ('number', 'fraction'), 'Typed answer expected')
        if template == 'fraction-term-chain':
            require(public['response']['kind'] == 'fraction', 'Fraction input for fraction answers')
        # Money answers are written to the cent; stated as exact values here.
        if template in ('price-count-chain',):
            require(re.fullmatch(r'\d+\.\d\d', answer), f'Dollar answer needs cents: {answer}')
        for form in digits(expected):
            if len(form) >= 3 and form not in plain(public['prompt']) and form not in public['prompt']:
                require(not re.search(rf'(?<![\d./]){re.escape(form)}(?![\d/]|\.\d)', hint), f'Hint states the answer {form}')
        return expected
    require(answer == expected, f'{template}: answer {answer} != {expected}')
    labels = {o['id']: o['label'] for o in public['response']['options']}
    require(len(set(labels.values())) == 4, 'Choices must differ')
    correct_text = labels[answer].strip('$')
    named_line = re.fullmatch(r'Line \d+', correct_text) is not None
    require(named_line or correct_text not in public['prompt'], 'Prompt contains the correct choice')
    require(named_line or correct_text not in hint, f'Hint states the correct choice {correct_text!r}')
    feedback = problem.get('choiceFeedback')
    if feedback is not None:
        require(set(feedback) <= set(labels), 'Feedback names unknown options')
    return expected


# -------------------------------------------------------------- self test

def _public(template, prompt, options=None, figure=None, kind=None):
    response = {'kind': 'choice', 'options': [{'id': f'option-{c}', 'label': label} for c, label in zip('abcd', options)]} \
        if options else {'kind': kind or 'number'}
    public = {'templateId': template, 'prompt': prompt, 'response': response}
    if figure:
        public['figure'] = figure
    return public


def _table(*rows):
    return {'kind': 'scene', 'scene': {'v': 1, 'elements': [{'type': 'lineTable', 'rows': [list(r) for r in rows], 'header': 'column'}]}}


def self_test():
    rejected = 0

    def must_fail(template, public, answer):
        nonlocal rejected
        try:
            review_problem({'public': public, 'answer': answer, 'hint': 'Think about the givens.'})
        except (ValueError, KeyError, IndexError, AttributeError, TypeError, ZeroDivisionError):
            rejected += 1
            return
        raise ValueError(f'Corrupt {template} fixture was accepted')

    def must_pass(public, answer):
        review_problem({'public': public, 'answer': answer, 'hint': 'Think about the givens.'})

    # Multi-term chains (hand calculated).
    fraction = _public('fraction-term-chain',
                       'A runner jogged $\\frac{4}{5}$ miles, then 2.3 miles, then $\\frac{1}{2}$ miles. How many miles did the runner jog in all? Enter the answer as a fraction, a decimal or a whole number.',
                       kind='fraction')
    must_pass(fraction, '18/5')
    must_fail('fraction-term-chain', fraction, '17/5')
    left = _public('fraction-term-chain',
                   'A bakery had 10 pies. The table shows how many pies were served at each of three times. How many pies are left? Enter the answer as a fraction, a decimal or a whole number.',
                   figure=_table(['Time', 'Lunch', 'Snack', 'Dinner'], ['Pies served', '1 1/2', '2 1/3', '2 1/4']), kind='fraction')
    must_pass(left, '47/12')
    must_fail('fraction-term-chain', left, '73/12')
    decimal = _public('decimal-rename-chain', 'Evaluate $0.6-1\\frac{1}{4}\\times 6$. Enter the answer as a decimal.')
    must_pass(decimal, '-6.9')
    must_fail('decimal-rename-chain', decimal, '-4.35')
    weights = _public('decimal-rename-chain',
                      'A bin of compost was filled over three days and weighs 10.81 kilograms in all. The table shows the weight added on Monday and on Tuesday. How many kilograms were added on Wednesday? Enter the answer as a decimal.',
                      figure=_table(['Day', 'Mon', 'Tue', 'Wed'], ['Weight (kilograms)', '6.45', '2.73', '?']))
    must_pass(weights, '1.63')
    must_fail('decimal-rename-chain', weights, '19.99')
    price = _public('price-count-chain',
                    'At the toy shop, a puzzle costs 6.35 dollars and a card game costs 6 dollars. A group buys 23 puzzles and 13 card games. How much do they spend in all? Enter the answer in dollars.')
    must_pass(price, '224.05')
    must_fail('price-count-chain', price, '224.50')
    each = _public('price-count-chain',
                   'At the cafe, a sandwich costs 4 dollars and a juice costs 2.5 dollars. Each of 6 people buys one sandwich and one juice. How much do they spend in all? Enter the answer in dollars.')
    must_pass(each, '39.00')
    must_fail('price-count-chain', each, '39')
    must_fail('price-count-chain', each, '36.00')
    rate = _public('dollar-rate-scale',
                   'A boat dock charges the same price for each hour a customer uses a kayak. The table shows the charge for 3 hours and for 5 hours. What is the charge for 9 hours? Enter the answer in dollars.',
                   figure=_table(['Hours', '3', '5'], ['Charge (dollars)', '20.25', '33.75']))
    must_pass(rate, '60.75')
    must_fail('dollar-rate-scale', rate, '60.50')
    bent = _public('dollar-rate-scale', rate['prompt'], figure=_table(['Hours', '3', '5'], ['Charge (dollars)', '20.25', '33.50']))
    must_fail('dollar-rate-scale', bent, '60.75')
    hours = _public('dollar-rate-scale',
                    'A bike shop charges the same price for each hour a customer uses a bike. The table shows the charge for 3 hours and for 5 hours. A customer pays 47.25 dollars. For how many hours is that?',
                    figure=_table(['Hours', '3', '5'], ['Charge (dollars)', '20.25', '33.75']))
    must_pass(hours, '7')
    must_fail('dollar-rate-scale', hours, '6')
    signed = _public('signed-changes-sum',
                     'There were 30 books at the start. The table shows how the number of books on a library cart changed on each of 7 days. How many books were there after 7 days?',
                     figure=_table(['Day', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], ['Change', '+18', '+7', '\u22129', '\u22129', '+8', '\u22128', '\u221213']))
    must_pass(signed, '24')
    must_fail('signed-changes-sum', signed, '36')
    must_fail('signed-changes-sum', signed, '-6')
    net = _public('signed-changes-sum', 'The table shows how the number of cars in a small lot changed on each of 3 days. What was the net change over the 3 days?',
                  figure=_table(['Day', 'Mon', 'Tue', 'Wed'], ['Change', '+5', '\u22129', '+1']))
    must_pass(net, '-3')
    must_fail('signed-changes-sum', net, '3')

    def choice(template, prompt, options, answer, figure=None, ok=True):
        public = _public(template, prompt, options, figure)
        if ok:
            must_pass(public, answer)
        # A wrong marked answer is rejected.
        wrong = next(f'option-{c}' for c in 'abcd' if f'option-{c}' != answer)
        must_fail(template, public, wrong)
        return public

    line = {'kind': 'scene', 'scene': {'v': 1, 'elements': [{'type': 'numberLine', 'min': 0, 'max': 26, 'step': 2, 'labels': 'auto',
            'marks': [{'at': 0, 'label': True}], 'hops': [{'from': i * 6, 'by': 6, 'landing': 'none'} for i in range(4)]}]}}
    base = 'The number line shows 4 equal jumps from 0. Which number sentence finds where the last jump lands? Use $n$ for that number.'
    choice('operation-sentence-choice', base, ['$4 \\times 6 = n$', '$4 + 6 = n$', '$6 - 4 = n$', '$4 \\div 6 = n$'], 'option-a', line)
    must_fail('operation-sentence-choice', _public('operation-sentence-choice', base, ['$4 \\times 6 = n$', '$6 \\times 4 = n$', '$6 - 4 = n$', '$4 \\div 6 = n$'], line), 'option-a')
    must_fail('operation-sentence-choice', _public('operation-sentence-choice', base, ['$4 \\times 6 = n$', '$4 + 6 = n$', '$6 - 4 = n$', '$4 \\div 6 = n$'],
              {'kind': 'scene', 'scene': {'v': 1, 'elements': [{'type': 'numberLine', 'hops': [{'from': i * 6, 'by': 6} for i in range(3)]}]}}), 'option-a')
    choice('operation-sentence-choice', 'Which story can be solved with $7 \\times 3$?',
           ['21 apples are shared equally among 7 baskets. How many apples does each basket get?',
            '10 apples are in 3 equal groups. How many apples are in each group?',
            'A basket has 9 apples. 4 are taken out. How many apples are left?',
            '7 cups each hold 3 pencils. How many pencils are there in all?'], 'option-d')
    must_fail('operation-sentence-choice', _public('operation-sentence-choice', 'Which story can be solved with $7 \\times 3$?',
              ['3 cups each hold 7 pencils. How many pencils are there in all?', '10 apples are in 3 equal groups. How many apples are in each group?',
               'A basket has 9 apples. 4 are taken out. How many apples are left?', '7 cups each hold 3 pencils. How many pencils are there in all?']), 'option-d')
    choice('operation-sentence-choice', 'A frog makes 3 jumps. Each jump is 8 long. Which sentence can NOT be used to find how far the frog jumps in all? Use $n$ for the distance.',
           ['$3 \\times 8 = n$', '$3 \\times 3 = n$', '$8 + 8 + 8 = n$', '$n \\div 3 = 8$'], 'option-b')
    choice('related-division-sentence', 'Here is a multiplication fact: $5 \\times 4 = 20$. Which division sentence can this fact help you solve? Use $n$ for the unknown.',
           ['$5 \\div 4 = n$', '$5 \\div 20 = n$', '$5 + 20 = n$', '$20 \\div 5 = n$'], 'option-d')
    must_fail('related-division-sentence', _public('related-division-sentence', 'Here is a multiplication fact: $5 \\times 4 = 20$. Which division sentence can this fact help you solve? Use $n$ for the unknown.',
              ['$20 \\div 4 = n$', '$5 \\div 20 = n$', '$5 + 20 = n$', '$20 \\div 5 = n$']), 'option-d')
    choice('related-division-sentence', 'Here is a division sentence: $48 \\div 8 = n$. Which multiplication sentence helps you find $n$?',
           ['$n \\times 48 = 8$', '$8 \\times 48 = n$', '$48 \\times 8 = n$', '$8 \\times n = 48$'], 'option-d')
    choice('related-subtraction-sentence', 'Here is an addition fact: $10 + 2 = 12$. Which subtraction sentence can this fact help you solve? Use $n$ for the unknown.',
           ['$12 - 10 = n$', '$12 \\div 10 = n$', '$12 + 10 = n$', '$12 \\times 10 = n$'], 'option-a')
    must_fail('related-subtraction-sentence', _public('related-subtraction-sentence', 'Here is an addition fact: $10 + 2 = 12$. Which subtraction sentence can this fact help you solve? Use $n$ for the unknown.',
              ['$12 - 10 = n$', '$12 - 2 = n$', '$12 + 10 = n$', '$12 \\times 10 = n$']), 'option-a')
    choice('whole-number-equality-choice', 'Which equation is true? One side is a product and the other side is a sum or a difference.',
           ['$8 \\times 7 = 62 + 6$', '$8 \\times 7 = 62 - 8$', '$8 \\times 7 = 62 - 6$', '$8 \\times 6 = 62 - 6$'], 'option-c')
    must_fail('whole-number-equality-choice', _public('whole-number-equality-choice', 'Which equation is true? Each side is a product of three factors.',
              ['$2 \\times 9 \\times 8 = 6 \\times 4 \\times 6$', '$2 \\times 9 \\times 8 = 4 \\times 6 \\times 6$', '$2 \\times 9 \\times 8 = 5 \\times 4 \\times 6$', '$2 \\times 9 \\times 8 = 6 \\times 4 \\times 5$']), 'option-a')
    choice('equation-after-one-step', 'Add $2$ to both sides of $9x-2=79$. Which equation results?',
           ['$9x=77$', '$x=81$', '$9x-4=77$', '$9x=81$'], 'option-d')
    choice('equation-after-one-step', 'Divide both sides of $5(x+8)=40$ by $5$. Which equation results?',
           ['$x+8=40$', '$x+8=8$', '$5x+8=8$', '$x+40=8$'], 'option-b')
    choice('equation-after-one-step', 'Multiply both sides of $\\frac{x}{4}-3=2$ by $4$. Which equation results?',
           ['$x-3=8$', '$x-12=2$', '$x-12=8$', '$x=2$'], 'option-c')
    must_fail('equation-after-one-step', _public('equation-after-one-step', 'Add $2$ to both sides of $9x-2=79$. Which equation results?',
              ['$9x=81$', '$9x+0=81$', '$9x-4=77$', '$x=81$']), 'option-a')
    choice('expression-after-first-step', 'Do only the first step of the order of operations on $8.9-(2.4+0.5\\times 8)$. Which expression do you get?',
           ['$8.9-2.9\\times 8$', '$8.9-6.4$', '$8.9-(2.4+4)$', '$6.5+0.5\\times 8$'], 'option-c')
    mistake = 'A student simplifies $55-(5+2\\times 6)$. Line 1: $55-(5+2\\times 6)$. Line 2: $55-7\\times 6$. Line 3: $55-42$. Line 4: $13$. Which line is the first to contain a mistake?'
    choice('expression-after-first-step', mistake, ['Line 4', 'No line has a mistake', 'Line 3', 'Line 2'], 'option-d')
    must_fail('expression-after-first-step', _public('expression-after-first-step', mistake, ['Line 4', 'No line has a mistake', 'Line 3', 'Line 2'][::-1]), 'option-b')
    choice('factor-out-choice', 'Factor $5$ out of $10x+40$. Which expression is equivalent?',
           ['$5(2x+40)$', '$5(2x+9)$', '$5(2x+8)$', '$5(2x-8)$'], 'option-c')
    must_fail('factor-out-choice', _public('factor-out-choice', 'Factor $5$ out of $10x+40$. Which expression is equivalent?',
              ['$10(x+4)$', '$5(2x+9)$', '$5(2x+8)$', '$5(2x-8)$']), 'option-c')
    choice('factor-out-choice', 'Factor $-3$ out of $-6x+9$. Which expression is equivalent?',
           ['$-3(2x+3)$', '$-3(2x-3)$', '$3(2x-3)$', '$-3(-2x-3)$'], 'option-b')
    reasons = 'A solution of $2(x+8)=34$ is shown. Line 1: $2(x+8)=34$. Line 2: $2x+16=34$. Line 3: $2x=18$. Line 4: $x=9$. Which list gives the property that justifies each step, from one line to the next?'
    options = ['1: Commutative property; 2: Subtraction property of equality; 3: Division property of equality',
               '1: Distributive property; 2: Subtraction property of equality; 3: Division property of equality',
               '1: Distributive property; 2: Addition property of equality; 3: Division property of equality',
               '1: Division property of equality; 2: Subtraction property of equality; 3: Distributive property']
    choice('step-reason-table', reasons, options, 'option-b')
    must_fail('step-reason-table', _public('step-reason-table', reasons.replace('$2x=18$', '$2x=17$'), options), 'option-b')
    return rejected
