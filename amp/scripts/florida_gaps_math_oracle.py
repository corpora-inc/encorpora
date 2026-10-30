"""Independent review of the Florida B.E.S.T. gap templates from public prompts and choices only.

Every answer is re-derived with exact Fraction arithmetic (or an exact special-angle
test) from the displayed givens. Generator solvers and case functions are never used.
"""
import copy
import math
import re
from decimal import Decimal
from fractions import Fraction

EQUATION_TRUTH = frozenset({
    'fl-equation-truth-20', 'fl-equation-truth-100', 'multiplication-division-equation-truth',
    'whole-number-equation-truth', 'fl-equation-truth-grouped',
})
FL_CHOICE = EQUATION_TRUTH | frozenset({
    'fl-expression-description-match', 'fl-two-step-story-equation', 'fl-vector-angle',
    'fl-even-odd-classify', 'fl-function-arithmetic',
})
FL_NUMBER = frozenset({
    'fl-decimal-tenth-hundredth-step', 'fl-decimal-by-tenth-hundredth',
    'fl-metric-customary-conversion', 'fl-integer-multiply-divide',
    'fl-vector-dot-product', 'fl-trapezoid-consequences',
})
SUPPORTED = FL_CHOICE | FL_NUMBER


def require(condition, message):
    if not condition:
        raise ValueError(message)


def plain(text):
    return (text.replace('$', '').replace('−', '-').replace('\\dfrac', '\\frac')
            .replace('\\times', '*').replace('\\div', '/').replace('\\cdot', '*').strip())


def squash(text):
    return re.sub(r'\s+', '', plain(text))


def dec(text):
    return Fraction(Decimal(text))


# ---------------------------------------------------------------- arithmetic
TOKEN = re.compile(r'\d+(?:\.\d+)?|[a-z]|[-+*/()]')


def tokens(text):
    text = squash(text)
    out = TOKEN.findall(text)
    require(''.join(out) == text, f'Unreadable expression: {text}')
    return out


def parse_expression(text, implicit=False):
    """Return an AST: ('n', Fraction) | ('v', name) | (op, left, right) | ('neg', x)."""
    toks = tokens(text)
    if implicit:
        spaced = []
        for tok in toks:
            if spaced and (re.fullmatch(r'\d+(?:\.\d+)?|\)|[a-z]', spaced[-1])
                           and re.fullmatch(r'[a-z(]|\d+(?:\.\d+)?', tok)
                           and not (re.fullmatch(r'[a-z]', spaced[-1]) and re.fullmatch(r'\d.*', tok))):
                spaced.append('*')
            spaced.append(tok)
        toks = spaced
    pos = [0]

    def peek():
        return toks[pos[0]] if pos[0] < len(toks) else None

    def take():
        pos[0] += 1
        return toks[pos[0] - 1]

    def atom():
        tok = peek()
        require(tok is not None, 'Unexpected end')
        if tok == '-':
            take()
            return ('neg', atom())
        if tok == '(':
            take()
            node = add()
            require(take() == ')', 'Missing )')
            return node
        take()
        if re.fullmatch(r'\d+(?:\.\d+)?', tok):
            return ('n', dec(tok))
        require(re.fullmatch(r'[a-z]', tok) is not None, f'Bad token {tok}')
        return ('v', tok)

    def mul():
        node = atom()
        while peek() in ('*', '/'):
            op = take()
            node = (op, node, atom())
        return node

    def add():
        node = mul()
        while peek() in ('+', '-'):
            op = take()
            node = (op, node, mul())
        return node

    node = add()
    require(peek() is None, f'Trailing tokens in {text}')
    return node


def evaluate(node, env=None):
    kind = node[0]
    if kind == 'n':
        return node[1]
    if kind == 'v':
        return env[node[1]]
    if kind == 'neg':
        return -evaluate(node[1], env)
    left, right = evaluate(node[1], env), evaluate(node[2], env)
    if kind == '+':
        return left + right
    if kind == '-':
        return left - right
    if kind == '*':
        return left * right
    require(right != 0, 'Division by zero')
    return left / right


def value(text):
    return evaluate(parse_expression(text))


def choice_options(public):
    response = public['response']
    require(response['kind'] == 'choice', 'Choice response required')
    options = response['options']
    require(len(options) == 4 and all(set(o) == {'id', 'label'} for o in options), 'Four public choices required')
    require(len({o['id'] for o in options}) == 4, 'Duplicate choice IDs')
    require(len({squash(o['label']) for o in options}) == 4, 'Duplicate choice text')
    return options


def only_correct(options, flags, message):
    correct = [o['id'] for o, ok in zip(options, flags) if ok]
    require(len(correct) == 1, message)
    return correct[0]


def require_number(public):
    require(public['response']['kind'] == 'number', 'Number response required')


# ------------------------------------------------------------ equation truth
def solve_equation_truth(public):
    template = public['templateId']
    match = re.match(r'Which equation is (true|false)\? An equation is true when its two sides have the same value\.$',
                     public['prompt'])
    require(match is not None, 'Equation-truth prompt must define truth')
    want_true = match[1] == 'true'
    options = choice_options(public)
    flags = []
    for option in options:
        label = plain(option['label'])
        require(label.count('=') == 1, 'One equals sign per option')
        left, right = (value(side) for side in label.split('='))
        numerals = [dec(n) for n in re.findall(r'\d+(?:\.\d+)?', label)]
        has = lambda ch: ch in label
        if template == 'fl-equation-truth-20':
            require(not has('*') and not has('/') and not has('('), 'Within 20 uses only + and -')
            require(max(numerals) <= 20 and 0 <= left <= 20 and 0 <= right <= 20, 'Value above 20')
        elif template == 'fl-equation-truth-100':
            require(not has('*') and not has('/') and not has('('), 'Within 100 uses only + and -')
            require(max(numerals) <= 100 and 0 <= left <= 100 and 0 <= right <= 100, 'Value above 100')
        elif template == 'multiplication-division-equation-truth':
            require(not re.search(r'[+]|\d\s*-', label), 'Only multiplication and division')
            require(all(n.denominator == 1 for n in numerals), 'Whole numbers only')
            for a, op, b in re.findall(r'(\d+)\s*([*/])\s*(\d+)', label):
                require(int(b) <= 12 and (op == '/' or int(a) <= 12), 'Fact outside 12')
        elif template == 'whole-number-equation-truth':
            require(all(n.denominator == 1 for n in numerals), 'Whole numbers only')
            require(left.denominator == 1 and right.denominator == 1 and left >= 0 and right >= 0, 'Whole sides')
        else:
            require(all((n * 10).denominator == 1 for n in numerals), 'Decimals beyond tenths')
        flags.append((left == right) == want_true)
    return only_correct(options, flags, 'Missing or ambiguous equation-truth answer')


# ---------------------------------------------------------- decimal practice
def solve_decimal_step(public):
    require_number(public)
    match = re.fullmatch(r'What number is (0\.1|0\.01) (more|less) than (\d+(?:\.\d+)?)\? Enter it as a decimal\.',
                         public['prompt'])
    require(match is not None, 'Decimal step wording')
    step = dec(match[1]) * (1 if match[2] == 'more' else -1)
    result = dec(match[3]) + step
    require(result >= 0, 'Negative decimal result')
    return result


def solve_decimal_scale(public):
    require_number(public)
    prompt = plain(public['prompt'])
    match = re.fullmatch(r'Find(\d+(?:\.\d+)?)([*/])(0\.1|0\.01)\.', squash(public['prompt']))
    if match:
        a, c = dec(match[1]), dec(match[3])
        return a * c if match[2] == '*' else a / c
    match = re.fullmatch(r'What number times (0\.1|0\.01) equals (\d+(?:\.\d+)?)\?', prompt)
    require(match is not None, 'Decimal scale wording')
    return dec(match[2]) / dec(match[1])


# ------------------------------------------------------ expression/description
def canon(node):
    kind = node[0]
    if kind == 'n':
        return node
    if kind in '+*':
        flat = []

        def collect(item):
            if item[0] == kind:
                collect(item[1])
                collect(item[2])
            else:
                flat.append(canon(item))
        collect(node)
        return (kind,) + tuple(sorted(flat, key=repr))
    if kind in '-/':
        return (kind, canon(node[1]), canon(node[2]))
    raise ValueError('Unexpected node')


def N(text):
    return ('n', dec(text))


NUM = r'(\d+(?:\.\d+)?)'
DESCRIPTIONS = [
    (rf'Add {NUM} and {NUM}, then divide the sum by {NUM}\.', lambda a, b, c: ('/', ('+', a, b), c)),
    (rf'Add {NUM} and {NUM}, then multiply the sum by {NUM}\.', lambda a, b, c: ('*', ('+', a, b), c)),
    (rf'Add {NUM} to double {NUM}\.', lambda a, b: ('+', a, ('*', ('n', Fraction(2)), b))),
    (rf'Add {NUM} to the sum of {NUM} and {NUM}\.', lambda a, b, c: ('+', a, ('+', b, c))),
    (rf'Divide {NUM} by {NUM}, then add {NUM}\.', lambda a, b, c: ('+', ('/', a, b), c)),
    (rf'Divide {NUM} by {NUM}, then subtract {NUM}\.', lambda a, b, c: ('-', ('/', a, b), c)),
    (rf'Divide {NUM} by {NUM}, then subtract the quotient from {NUM}\.', lambda a, b, c: ('-', c, ('/', a, b))),
    (rf'Divide {NUM} by the sum of {NUM} and {NUM}\.', lambda a, b, c: ('/', a, ('+', b, c))),
    (rf'Double the sum of {NUM} and {NUM}\.', lambda a, b: ('*', ('n', Fraction(2)), ('+', a, b))),
    (rf'Find the sum of {NUM}, {NUM} and {NUM}\.', lambda a, b, c: ('+', a, ('+', b, c))),
    (rf'Half the sum of {NUM} and {NUM}\.', lambda a, b: ('/', ('+', a, b), ('n', Fraction(2)))),
    (rf'Multiply {NUM} by {NUM}, then add {NUM}\.', lambda a, b, c: ('+', ('*', a, b), c)),
    (rf'Multiply {NUM} by the difference of {NUM} and {NUM}\.', lambda a, b, c: ('*', a, ('-', b, c))),
    (rf'Multiply {NUM} by the sum of {NUM} and {NUM}\.', lambda a, b, c: ('*', a, ('+', b, c))),
    (rf'Multiply the sum of {NUM} and {NUM} by {NUM}\.', lambda a, b, c: ('*', ('+', a, b), c)),
    (rf'Subtract {NUM} from {NUM}, then divide the difference by {NUM}\.', lambda a, b, c: ('/', ('-', b, a), c)),
    (rf'Subtract {NUM} from {NUM}, then multiply the difference by {NUM}\.', lambda a, b, c: ('*', ('-', b, a), c)),
    (rf'Subtract {NUM} from the product of {NUM} and {NUM}\.', lambda a, b, c: ('-', ('*', b, c), a)),
    (rf'Subtract the product of {NUM} and {NUM} from {NUM}\.', lambda a, b, c: ('-', c, ('*', a, b))),
]


def description_tree(text):
    for pattern, build in DESCRIPTIONS:
        match = re.fullmatch(pattern, text.strip())
        if match:
            return canon(build(*[N(g) for g in match.groups()]))
    raise ValueError(f'Unknown description: {text}')


def solve_expression_description(public):
    options = choice_options(public)
    prompt = public['prompt']
    match = re.fullmatch(r'Which expression matches this description\? "(.+)"', prompt)
    if match:
        target = description_tree(match[1])
        flags = [canon(parse_expression(o['label'])) == target for o in options]
        return only_correct(options, flags, 'Missing or ambiguous matching expression')
    match = re.fullmatch(r'Which description matches the expression \$(.+)\$\?', prompt)
    require(match is not None, 'Expression/description wording')
    target = canon(parse_expression(match[1]))
    flags = [description_tree(o['label']) == target for o in options]
    return only_correct(options, flags, 'Missing or ambiguous matching description')


# ------------------------------------------------------------- story equation
def story_function(prompt):
    """Return (variable, function n -> expression value, total) for the displayed story."""
    variable = re.search(r'\$([a-z])\$', prompt)
    require(variable is not None, 'Story must name its variable')
    forms = [
        (r'(\d+) friends each have the same number of cards\. Each friend gets (\d+) more cards, and together they now have (\d+) cards\.',
         lambda g: (lambda n: g[0] * (n + g[1]), g[2])),
        (r'A school buys (\d+) boxes of markers with the same number of markers in each box\. It also has (\d+) loose markers\. In all there are (\d+) markers\.',
         lambda g: (lambda n: g[0] * n + g[1], g[2])),
        (r'A teacher shares \$[a-z]\$ stickers equally among (\d+) students and then gives each student (\d+) more\. Each student now has (\d+) stickers\.',
         lambda g: (lambda n: Fraction(n) / g[0] + g[1], g[2])),
        (r'A store puts (\d+) equal rows of books on a shelf\. Then (\d+) books are sold, and (\d+) books are left\.',
         lambda g: (lambda n: g[0] * n - g[1], g[2])),
        (r'(\d+) teams each have the same number of players\. Each team sends (\d+) players to a game, and (\d+) players are left in all\.',
         lambda g: (lambda n: g[0] * (n - g[1]), g[2])),
    ]
    for pattern, build in forms:
        match = re.match(pattern, prompt)
        if match:
            function, total = build([int(g) for g in match.groups()])
            return variable[1], function, Fraction(total)
    raise ValueError('Unknown story')


def solve_story_equation(public):
    options = choice_options(public)
    prompt = public['prompt']
    require(prompt.endswith('Which equation matches the story?'), 'Story question wording')
    variable, story, total = story_function(prompt)
    # The story model is linear in the unknown: two points fix it.
    story_root = None
    slope = story(Fraction(1)) - story(Fraction(0))
    require(slope != 0, 'Degenerate story')
    story_root = (total - story(Fraction(0))) / slope
    require(story_root.denominator == 1 and story_root > 0, 'Story unknown must be a positive whole number')
    flags = []
    for option in options:
        label = plain(option['label'])
        require(label.count('=') == 1, 'One equals sign per option')
        left, right = (parse_expression(side, implicit=True) for side in label.split('='))
        require(variable in re.sub(r'[^a-z]', '', label), 'Option must use the story variable')
        def difference(n):
            env = {variable: Fraction(n)}
            return evaluate(left, env) - evaluate(right, env)
        points = [Fraction(k) for k in (0, 1, 2, 7)]
        targets = [story(p) - total for p in points]
        flags.append(all(difference(p) == t for p, t in zip(points, targets)))
        if not flags[-1]:
            # A distractor must still be a different equation, not a rewrite of the correct one.
            require(any(difference(p) * (story(Fraction(1)) - total) != (story(p) - total) * difference(Fraction(1))
                        for p in points) or story(Fraction(1)) - total == 0, 'Distractor is an equivalent equation')
    return only_correct(options, flags, 'Missing or ambiguous story equation')


# --------------------------------------------------------- unit conversions
def unit_key(unit):
    unit = unit.strip()
    square = unit.startswith('square ')
    base = unit[7:] if square else unit
    return ('sq ' if square else '') + base[:4]


def solve_conversion(public):
    require_number(public)
    prompt = public['prompt']
    match = re.fullmatch(
        rf'A[n]? (?:[a-z ]+?) (?:weighs|holds|has an area of|is|costs) {NUM} ([a-zA-Z ]+?)(?: long)?\. '
        rf'Use 1 ([a-zA-Z ]+?) = {NUM} ([a-zA-Z ]+?)\. How many ([a-zA-Z ]+?) is that\? Enter the number\.', prompt)
    require(match is not None, 'Conversion wording must state the factor and the asked unit')
    quantity, given_unit, unit_one, factor, unit_two, asked = match.groups()
    quantity, factor = dec(quantity), dec(factor)
    keys = {unit_key(unit_one): 'one', unit_key(unit_two): 'two'}
    require(len(keys) == 2, 'Ambiguous conversion units')
    given_side, asked_side = keys.get(unit_key(given_unit)), keys.get(unit_key(asked))
    require(given_side and asked_side and given_side != asked_side, 'Conversion units do not match the stated factor')
    return quantity * factor if given_side == 'one' else quantity / factor


def solve_integer(public):
    require_number(public)
    match = re.fullmatch(r'Find \$(.+)\$\.', public['prompt'])
    require(match is not None, 'Integer operation wording')
    text = plain(match[1])
    sides = re.fullmatch(r'\(?(-?\d+)\)?\s*([*/])\s*\(?(-?\d+)\)?', text)
    require(sides is not None, 'Integer operation shape')
    a, op, b = int(sides[1]), sides[2], int(sides[3])
    if op == '*':
        return Fraction(a * b)
    require(b != 0 and a % b == 0, 'Integer division must be exact and nonzero')
    return Fraction(a // b)


# ------------------------------------------------------------------- vectors
def vectors(prompt):
    found = re.findall(r'\\langle\s*(-?\d+|k),\s*(-?\d+|k)\\rangle', prompt)
    require(len(found) == 2, 'Two displayed vectors required')
    return found


def exact_sqrt(n):
    if isinstance(n, Fraction):
        return Fraction(exact_sqrt(n.numerator)) / Fraction(exact_sqrt(n.denominator))
    root = math.isqrt(n)
    require(root * root == n, 'Magnitude is not exact')
    return root


def solve_dot(public):
    require_number(public)
    prompt = public['prompt']
    u, v = vectors(prompt)
    if 'perpendicular' in prompt:
        require(prompt.endswith('Find $k$.'), 'Perpendicular wording')
        known = [list(u), list(v)]
        flat = [x for pair in known for x in pair]
        require(flat.count('k') == 1, 'One unknown component')
        ks = [(i, j) for i in range(2) for j in range(2) if known[i][j] == 'k']
        i, j = ks[0]
        other = known[1 - i]
        # u.v = k*other[j] + (other component) * (own other component) = 0
        own_other = Fraction(int(known[i][1 - j]))
        coefficient = Fraction(int(other[j]))
        rest = Fraction(int(other[1 - j])) * own_other
        require(coefficient != 0, 'Unsolvable perpendicular condition')
        return -rest / coefficient
    a, b = [(Fraction(int(x)), Fraction(int(y))) for x, y in (u, v)]
    dot = a[0] * b[0] + a[1] * b[1]
    if 'scalar projection' in prompt:
        require('\\frac{\\mathbf{u}\\cdot\\mathbf{v}}{|\\mathbf{v}|}' in prompt.replace('\\dfrac', '\\frac'),
                'Projection formula must be displayed')
        length = exact_sqrt(b[0] ** 2 + b[1] ** 2)
        require(length != 0, 'Zero vector')
        return dot / length
    require(prompt.startswith('Let ') and 'Find the dot product' in prompt, 'Dot product wording')
    return dot


SPECIAL_ANGLES = {Fraction(0): 90, Fraction(1, 4): 60, Fraction(1, 2): 45, Fraction(3, 4): 30, Fraction(1): 0}


def solve_vector_angle(public):
    options = choice_options(public)
    prompt = public['prompt']
    u, v = vectors(prompt)
    a, b = [(Fraction(int(x)), Fraction(int(y))) for x, y in (u, v)]
    dot = a[0] * b[0] + a[1] * b[1]
    cross = a[0] * b[1] - a[1] * b[0]
    if prompt.startswith('Which statement describes'):
        def holds(label):
            text = plain(label)
            if text == 'The vectors are perpendicular.':
                return dot == 0
            if text == 'The vectors are parallel and point in the same direction.':
                return cross == 0 and dot > 0
            if text == 'The vectors are parallel and point in opposite directions.':
                return cross == 0 and dot < 0
            if text == 'The vectors are neither perpendicular nor parallel.':
                return dot != 0 and cross != 0
            raise ValueError(f'Unknown statement {text}')
        return only_correct(options, [holds(o['label']) for o in options], 'Missing or ambiguous vector statement')
    require(prompt.endswith('with $0^\\circ\\le\\theta\\le180^\\circ$.'), 'Angle range must be stated')
    norms = (a[0] ** 2 + a[1] ** 2) * (b[0] ** 2 + b[1] ** 2)
    require(norms != 0, 'Zero vector has no angle')
    cos_squared = dot * dot / norms
    require(cos_squared in SPECIAL_ANGLES, 'Angle is not a special angle, so the stated degree cannot be exact')
    acute = SPECIAL_ANGLES[cos_squared]
    angle = acute if dot > 0 else 180 - acute
    if dot == 0:
        angle = 90
    check = math.degrees(math.acos(float(dot) / math.sqrt(float(norms))))
    require(abs(check - angle) < 1e-9, 'Exact angle disagrees with the numeric angle')
    labels = []
    for option in options:
        match = re.fullmatch(r'(\d+)\^\\circ', squash(option['label']))
        require(match is not None, 'Angle option must be degrees')
        labels.append(int(match[1]))
    require(len(set(labels)) == 4, 'Duplicate angle choices')
    return only_correct(options, [x == angle for x in labels], 'Missing or ambiguous angle')


# ------------------------------------------------------------- polynomials
TERM = re.compile(r'([+-]?)(\d*)x(?:\^\{(\d+)\})?|([+-]?)(\d+)')


def polynomial(text):
    text = squash(text)
    out, used = {}, ''
    for match in TERM.finditer(text):
        used += match[0]
        sign = -1 if (match[1] or match[4]) == '-' else 1
        if match[5] is not None:
            out[0] = out.get(0, 0) + sign * int(match[5])
        else:
            power = int(match[3]) if match[3] else 1
            coefficient = int(match[2]) if match[2] else 1
            out[power] = out.get(power, 0) + sign * coefficient
    require(used == text, f'Unreadable polynomial {text}')
    return {k: v for k, v in out.items() if v}


def poly_multiply(p, q):
    out = {}
    for i, a in p.items():
        for j, b in q.items():
            out[i + j] = out.get(i + j, 0) + a * b
    return {k: v for k, v in out.items() if v}


def poly_at(p, x):
    return sum(Fraction(c) * Fraction(x) ** k for k, c in p.items())


def classify(p):
    odd_terms = any(k % 2 for k in p)
    even_terms = any(k % 2 == 0 for k in p)
    if not odd_terms:
        return 'even'
    if not even_terms:
        return 'odd'
    return 'neither'


def negate_input(p):
    return {k: c * (-1) ** k for k, c in p.items()}


def solve_even_odd(public):
    options = choice_options(public)
    prompt = public['prompt']
    match = re.fullmatch(r'Which function is (even|odd|neither even nor odd)\?', prompt)
    if match:
        word = 'neither' if match[1].startswith('neither') else match[1]
        flags = []
        for option in options:
            body = re.fullmatch(r'\$f\(x\)=(.+)\$', option['label'])
            require(body is not None, 'Function option shape')
            p = polynomial(body[1])
            # Symbolic check against f(-x) = f(x) / -f(x) term by term.
            q = negate_input(p)
            kind = 'even' if q == p else 'odd' if q == {k: -c for k, c in p.items()} else 'neither'
            require(kind == classify(p), 'Parity tests disagree')
            flags.append(kind == word)
        return only_correct(options, flags, 'Missing or ambiguous parity choice')
    match = re.fullmatch(r'Let \$f\(x\)=(.+)\$\. Which statement correctly finds \$f\(-x\)\$ and classifies \$f\$\?', prompt)
    require(match is not None, 'Parity wording')
    p = polynomial(match[1])
    q = negate_input(p)
    kind = classify(p)
    flags = []
    for option in options:
        body = re.fullmatch(r'\$f\(-x\)=(.+)\$, so \$f\$ is (even|odd|neither even nor odd)', option['label'])
        require(body is not None, 'Statement option shape')
        stated = 'neither' if body[2].startswith('neither') else body[2]
        flags.append(polynomial(body[1]) == q and stated == kind)
    return only_correct(options, flags, 'Missing or ambiguous f(-x) statement')


def rational_roots(p):
    a, b, c = p.get(2, 0), p.get(1, 0), p.get(0, 0)
    if a == 0:
        require(b != 0, 'Constant divisor')
        return {Fraction(-c, b)}
    disc = b * b - 4 * a * c
    require(disc >= 0, 'No real zeros')
    root = exact_sqrt(disc)
    return {(Fraction(-b) + sign * root) / (2 * a) for sign in (1, -1)}


def parse_function_value(label):
    text = squash(label)
    match = re.fullmatch(r'(-?)(?:(\d+)|\\frac\{(\d+)\}\{(\d+)\})', text)
    require(match is not None, f'Not a value: {text}')
    magnitude = Fraction(int(match[2])) if match[2] is not None else Fraction(int(match[3]), int(match[4]))
    return -magnitude if match[1] else magnitude


def solve_function_arithmetic(public):
    options = choice_options(public)
    prompt = public['prompt']
    head = re.match(r'Let \$f\(x\)=(.+?)\$ and \$g\(x\)=(.+?)\$\. (.+)$', prompt)
    require(head is not None, 'Function pair wording')
    f, g, question = polynomial(head[1]), polynomial(head[2]), head[3]
    ask = re.fullmatch(r'Which expression is \$\((fg|f\+g|f-g)\)\(x\)\$\?', question)
    if ask:
        if ask[1] == 'fg':
            target = poly_multiply(f, g)
        else:
            sign = 1 if ask[1] == 'f+g' else -1
            target = {k: f.get(k, 0) + sign * g.get(k, 0) for k in set(f) | set(g)}
            target = {k: v for k, v in target.items() if v}
        return only_correct(options, [polynomial(re.sub(r'^\$|\$$', '', o['label'])) == target for o in options],
                            'Missing or ambiguous function expression')
    ask = re.fullmatch(r'What is \$\\left\(\\frac\{f\}\{g\}\\right\)\((-?\d+)\)\$\?', question.replace('\\dfrac', '\\frac'))
    if ask:
        x = Fraction(int(ask[1]))
        denominator = poly_at(g, x)
        require(denominator != 0, 'Quotient is undefined at the evaluation point')
        target = poly_at(f, x) / denominator
        values = [parse_function_value(o['label']) for o in options]
        require(len(set(values)) == 4, 'Duplicate quotient values')
        return only_correct(options, [v == target for v in values], 'Missing or ambiguous quotient value')
    require(question.replace('\\dfrac', '\\frac') == 'What is the domain of $\\left(\\frac{f}{g}\\right)(x)$?',
            'Function question wording')
    zeros = rational_roots(g)
    sets = []
    for option in options:
        label = squash(option['label'])
        if label == '\\text{allrealnumbers}':
            sets.append(frozenset())
            continue
        excluded = re.findall(r'x\\ne(-?\d+)', label)
        require(excluded and re.fullmatch(r'x\\ne-?\d+(?:\\text\{and\}x\\ne-?\d+)*', label), 'Domain option shape')
        sets.append(frozenset(Fraction(int(e)) for e in excluded))
    require(len(set(sets)) == 4, 'Duplicate domain choices')
    return only_correct(options, [s == frozenset(zeros) for s in sets], 'Missing or ambiguous domain')


# ---------------------------------------------------------------- trapezoids
LIN = r'(\(?-?\d*x(?: [+-] \d+)?\)?|\d+)'


def linear(text):
    p = polynomial(text.replace('(', '').replace(')', ''))
    require(set(p) <= {0, 1}, 'Expression must be linear')
    return Fraction(p.get(1, 0)), Fraction(p.get(0, 0))


def solve_equal(left, right):
    slope = left[0] - right[0]
    require(slope != 0, 'No unique unknown')
    return (right[1] - left[1]) / slope


def solve_trapezoid(public):
    require_number(public)
    prompt = public['prompt']
    base = r'In trapezoid \$ABCD\$, \$\\overline\{AB\}\\parallel\\overline\{DC\}\$'
    match = re.fullmatch(base + rf' and \$AB={NUM}\$\. The midsegment \$\\overline\{{MN\}}\$ joins the midpoints of the legs and \$MN={NUM}\$\. Find \$DC\$\.', prompt)
    if match:
        ab, mn = dec(match[1]), dec(match[2])
        dc = 2 * mn - ab
        require(dc > 0 and dc != ab, 'Bases must be positive and unequal')
        return dc
    match = re.fullmatch(base + rf', \$AB={NUM}\$ and \$DC={NUM}\$\. \$\\overline\{{MN\}}\$ joins the midpoints of the legs \$\\overline\{{AD\}}\$ and \$\\overline\{{BC\}}\$\. Find \$MN\$\.', prompt)
    if match:
        ab, dc = dec(match[1]), dec(match[2])
        require(ab != dc, 'Bases must be unequal')
        return (ab + dc) / 2
    match = re.fullmatch(base + r', \$AB=(.+?)\$ and \$DC=(.+?)\$\. The midsegment joining the midpoints of the legs has length (\d+)\. Find \$(AB|DC)\$\.', prompt)
    if match:
        ab, dc, mn = linear(match[1]), linear(match[2]), Fraction(int(match[3]))
        average = ((ab[0] + dc[0]) / 2, (ab[1] + dc[1]) / 2)
        x = solve_equal(average, (Fraction(0), mn))
        lengths = {'AB': ab[0] * x + ab[1], 'DC': dc[0] * x + dc[1]}
        require(x > 0 and all(v > 0 for v in lengths.values()) and lengths['AB'] != lengths['DC'], 'Invalid bases')
        return lengths[match[4]]
    iso = r'In isosceles trapezoid \$ABCD\$, \$\\overline\{AB\}\\parallel\\overline\{DC\}\$ and \$\\overline\{AD\}\\cong\\overline\{BC\}\$\. '
    match = re.fullmatch(iso + r'The measure of \$\\angle D\$ is \$(\d+)\^\\circ\$\. Find the measure of \$\\angle A\$ in degrees\.', prompt)
    if match:
        d = Fraction(int(match[1]))
        require(0 < d < 180 and d != 90, 'Angle must make a non-rectangle')
        return 180 - d
    match = re.fullmatch(iso + r'The measure of \$\\angle D\$ is \$(\(.+?\)|\d+)\^\\circ\$ and the measure of \$\\angle C\$ is \$(\(.+?\)|\d+)\^\\circ\$\. Find the measure of \$\\angle C\$ in degrees\.', prompt)
    if match:
        d, c = linear(match[1]), linear(match[2])
        x = solve_equal(d, c)  # base angles on DC are congruent
        angle = c[0] * x + c[1]
        require(x > 0 and 0 < angle < 90, 'Base angle must be acute and positive')
        return angle
    match = re.fullmatch(iso + r'Its diagonals have lengths \$AC=(.+?)\$ and \$BD=(.+?)\$\. Find \$AC\$\.', prompt)
    if match:
        ac, bd = linear(match[1]), linear(match[2])
        x = solve_equal(ac, bd)
        length = ac[0] * x + ac[1]
        require(x > 0 and length > 0, 'Diagonal must be positive')
        return length
    raise ValueError('Unknown trapezoid wording')


# --------------------------------------------------------------------- driver
def solve(public):
    template = public['templateId']
    require(template in SUPPORTED, 'Unexpected Florida gap family')
    require(public.get('figure') is None, 'Unexpected diagram')
    if template in EQUATION_TRUTH:
        return solve_equation_truth(public)
    solver = {
        'fl-decimal-tenth-hundredth-step': solve_decimal_step,
        'fl-decimal-by-tenth-hundredth': solve_decimal_scale,
        'fl-expression-description-match': solve_expression_description,
        'fl-two-step-story-equation': solve_story_equation,
        'fl-metric-customary-conversion': solve_conversion,
        'fl-integer-multiply-divide': solve_integer,
        'fl-vector-dot-product': solve_dot,
        'fl-vector-angle': solve_vector_angle,
        'fl-even-odd-classify': solve_even_odd,
        'fl-function-arithmetic': solve_function_arithmetic,
        'fl-trapezoid-consequences': solve_trapezoid,
    }[template]
    return solver(public)


def review_leakage(problem, result):
    public = problem['public']
    hint = squash(problem.get('hint', ''))
    if public['response']['kind'] == 'choice':
        correct = next(o for o in public['response']['options'] if o['id'] == problem['answer'])
        core = squash(correct['label'])
        if len(core) >= 8:
            require(core not in hint, 'Hint states the correct choice')
            if public['templateId'] != 'fl-vector-angle':  # the stated range legitimately shows 0 and 180 degrees
                require(core not in squash(public['prompt']), 'Prompt states the correct choice')
    else:
        answer = str(problem['answer'])
        require(not re.search(rf'=\s*{re.escape(answer)}(?![\d.])', hint.replace('=', '= ')), 'Hint states the final answer')
    for text in problem.get('explanation', []) + [problem.get('hint', '')] + list(problem.get('choiceFeedback', {}).values()):
        require(not re.search(r'[A-Za-z]_[A-Za-z]_|_[a-z]\d?_|\bu_v_|f_g_', text), f'Garbled subscript text: {text}')


def review_problem(problem):
    result = solve(problem['public'])
    if problem['public']['response']['kind'] == 'choice':
        require(result == problem['answer'], 'Florida gap answer key mismatch')
    else:
        require(Fraction(str(problem['answer'])) == result, 'Florida gap numeric answer mismatch')
    review_leakage(problem, result)
    return result


# ------------------------------------------------------------------ self test
def opts(labels):
    return {'kind': 'choice', 'label': 'Choose one answer',
            'options': [{'id': f'option-{chr(97 + i)}', 'label': label} for i, label in enumerate(labels)]}


def fixture(template, prompt, response, answer):
    return {'public': {'templateId': template, 'prompt': prompt, 'response': response}, 'answer': answer,
            'explanation': [], 'hint': 'Work it out.'}


NUMBER_RESPONSE = {'kind': 'number', 'label': 'Answer'}


def self_test():
    truth = ' An equation is true when its two sides have the same value.'
    cases = [
        ('fl-equation-truth-20', 'Which equation is false?' + truth, opts(['$15 - 1 = 14$', '$11 - 1 = 10 + 1$', '$16 = 18 - 2$', '$19 - 6 = 18 - 5$']), 'option-b', 'option-a'),
        ('fl-equation-truth-100', 'Which equation is true?' + truth, opts(['$2 + 21 = 23$', '$69 - 54 = 92 - 78$', '$56 + 42 = 55 + 33$', '$81 = 88 - 5$']), 'option-a', 'option-d'),
        ('multiplication-division-equation-truth', 'Which equation is false?' + truth, opts(['$41 = 4 \\times 10$', '$4 \\times 7 = 28$', '$72 \\div 6 = 60 \\div 5$', '$15 = 5 \\times 3$']), 'option-a', 'option-b'),
        ('whole-number-equation-truth', 'Which equation is true?' + truth, opts(['$72 \\div 2 = 4 \\times 10$', '$8 \\times 7 = 75 - 20$', '$15 = 112 \\div 8$', '$6 \\times 2 = 24 \\div 2$']), 'option-d', 'option-a'),
        ('fl-equation-truth-grouped', 'Which equation is true?' + truth, opts(['$(21 + 11) \\div 4 = (21 + 21) \\div 6$', '$30.2 - 9 = 23.2 - 7$', '$(69 + 36) \\div 5 = (1 + 6) \\times 3$', '$34.8 = 30.8 - 6$']), 'option-c', 'option-a'),
        ('fl-decimal-tenth-hundredth-step', 'What number is 0.01 more than 3.79? Enter it as a decimal.', NUMBER_RESPONSE, '3.8', '3.7'),
        ('fl-decimal-tenth-hundredth-step', 'What number is 0.1 less than 7.06? Enter it as a decimal.', NUMBER_RESPONSE, '6.96', '7.05'),
        ('fl-decimal-by-tenth-hundredth', 'Find $47\\times0.1$.', NUMBER_RESPONSE, '4.7', '470'),
        ('fl-decimal-by-tenth-hundredth', 'Find $74.2\\div0.01$.', NUMBER_RESPONSE, '7420', '0.742'),
        ('fl-decimal-by-tenth-hundredth', 'What number times 0.1 equals 3?', NUMBER_RESPONSE, '30', '0.3'),
        ('fl-expression-description-match', 'Which expression matches this description? "Subtract 7 from 6.5, then divide the difference by 9."', opts(['$6.5 - 7 \\div 9$', '$(6.5 \\div 9) - 7$', '$(6.5 - 7) \\div 9$', '$(7 - 6.5) \\div 9$']), 'option-c', 'option-d'),
        ('fl-expression-description-match', 'Which description matches the expression $2 \\times (8 + 3)$?', opts(['Half the sum of 8 and 3.', 'Add 2 to the sum of 8 and 3.', 'Double the sum of 8 and 3.', 'Add 3 to double 8.']), 'option-c', 'option-d'),
        ('fl-two-step-story-equation', '8 friends each have the same number of cards. Each friend gets 5 more cards, and together they now have 136 cards. Let $n$ be the number of cards each friend had at first. Which equation matches the story?', opts(['$8(n + 5) = 136$', '$n \\div 8 + 5 = 136$', '$8n - 5 = 136$', '$8n + 5 = 136$']), 'option-a', 'option-d'),
        ('fl-two-step-story-equation', 'A teacher shares $x$ stickers equally among 4 students and then gives each student 2 more. Each student now has 8 stickers. Which equation matches the story?', opts(['$4x + 2 = 8$', '$x \\div 4 + 2 = 8$', '$4(x + 2) = 8$', '$x \\div 4 - 2 = 8$']), 'option-b', 'option-a'),
        ('fl-metric-customary-conversion', 'A package weighs 37 ounces. Use 1 ounce = 28 grams. How many grams is that? Enter the number.', NUMBER_RESPONSE, '1036', '1.32'),
        ('fl-metric-customary-conversion', 'A tank holds 102.6 liters. Use 1 gallon = 3.8 liters. How many gallons is that? Enter the number.', NUMBER_RESPONSE, '27', '389.88'),
        ('fl-metric-customary-conversion', 'A park has an area of 11 square miles. Use 1 square mile = 2.6 square kilometers. How many square kilometers is that? Enter the number.', NUMBER_RESPONSE, '28.6', '4.23'),
        ('fl-integer-multiply-divide', 'Find $(-4) \\times (-2)$.', NUMBER_RESPONSE, '8', '-8'),
        ('fl-integer-multiply-divide', 'Find $77 \\div (-7)$.', NUMBER_RESPONSE, '-11', '11'),
        ('fl-integer-multiply-divide', 'Find $0 \\div 5$.', NUMBER_RESPONSE, '0', '5'),
        ('fl-vector-dot-product', 'Let $\\mathbf{u}=\\langle 8, -3\\rangle$ and $\\mathbf{v}=\\langle 9, 7\\rangle$. Find the dot product $\\mathbf{u}\\cdot\\mathbf{v}$.', NUMBER_RESPONSE, '51', '93'),
        ('fl-vector-dot-product', 'Let $\\mathbf{u}=\\langle -8, 1\\rangle$ and $\\mathbf{v}=\\langle -6, -8\\rangle$. Find the scalar projection of $\\mathbf{u}$ on $\\mathbf{v}$, which is $\\dfrac{\\mathbf{u}\\cdot\\mathbf{v}}{|\\mathbf{v}|}$.', NUMBER_RESPONSE, '4', '40'),
        ('fl-vector-dot-product', 'The vectors $\\mathbf{u}=\\langle k, 6\\rangle$ and $\\mathbf{v}=\\langle 4, 4\\rangle$ are perpendicular. Find $k$.', NUMBER_RESPONSE, '-6', '6'),
        ('fl-vector-angle', 'Which statement describes $\\mathbf{u}=\\langle 5, -4\\rangle$ and $\\mathbf{v}=\\langle -15, 12\\rangle$?', opts(['The vectors are perpendicular.', 'The vectors are parallel and point in opposite directions.', 'The vectors are parallel and point in the same direction.', 'The vectors are neither perpendicular nor parallel.']), 'option-b', 'option-c'),
        ('fl-vector-angle', 'Find the angle $\\theta$ between $\\mathbf{u}=\\langle -1, -1\\rangle$ and $\\mathbf{v}=\\langle 0, -1\\rangle$, with $0^\\circ\\le\\theta\\le180^\\circ$.', opts(['$45^\\circ$', '$135^\\circ$', '$0^\\circ$', '$90^\\circ$']), 'option-a', 'option-b'),
        ('fl-even-odd-classify', 'Which function is even?', opts(['$f(x)=-x^{4} + 6x^{2}$', '$f(x)=-2x^{5} + 6x^{3} + 5x$', '$f(x)=-5x^{5} - 5x$', '$f(x)=4x^{3} + 4x$']), 'option-a', 'option-b'),
        ('fl-even-odd-classify', 'Let $f(x)=-5x^{3} - 4$. Which statement correctly finds $f(-x)$ and classifies $f$?', opts(['$f(-x)=-5x^{3} - 4$, so $f$ is even', '$f(-x)=5x^{3} - 4$, so $f$ is neither even nor odd', '$f(-x)=5x^{3} - 4$, so $f$ is odd', '$f(-x)=5x^{3} - 4$, so $f$ is even']), 'option-b', 'option-c'),
        ('fl-function-arithmetic', 'Let $f(x)=2x - 3$ and $g(x)=5x - 7$. Which expression is $(fg)(x)$?', opts(['$7x - 10$', '$10x^{2} - 29x + 21$', '$10x^{2} - 28x + 21$', '$10x^{2} - x + 21$']), 'option-b', 'option-c'),
        ('fl-function-arithmetic', 'Let $f(x)=4x - 2$ and $g(x)=-x^{2} - 4x - 2$. What is $\\left(\\dfrac{f}{g}\\right)(-3)$?', opts(['$-13$', '$-15$', '$-\\frac{1}{14}$', '$-14$']), 'option-d', 'option-c'),
        ('fl-function-arithmetic', 'Let $f(x)=x + 4$ and $g(x)=x^{2} + x - 2$. What is the domain of $\\left(\\dfrac{f}{g}\\right)(x)$?', opts(['$x\\ne -4$', '$x\\ne 1\\text{ and }x\\ne -2$', '$x\\ne -1\\text{ and }x\\ne 2$', '$x\\ne 1$']), 'option-b', 'option-a'),
        ('fl-trapezoid-consequences', 'In trapezoid $ABCD$, $\\overline{AB}\\parallel\\overline{DC}$ and $AB=9$. The midsegment $\\overline{MN}$ joins the midpoints of the legs and $MN=18$. Find $DC$.', NUMBER_RESPONSE, '27', '36'),
        ('fl-trapezoid-consequences', 'In trapezoid $ABCD$, $\\overline{AB}\\parallel\\overline{DC}$, $AB=21$ and $DC=35$. $\\overline{MN}$ joins the midpoints of the legs $\\overline{AD}$ and $\\overline{BC}$. Find $MN$.', NUMBER_RESPONSE, '28', '14'),
        ('fl-trapezoid-consequences', 'In trapezoid $ABCD$, $\\overline{AB}\\parallel\\overline{DC}$, $AB=4x + 4$ and $DC=2x + 8$. The midsegment joining the midpoints of the legs has length 18. Find $AB$.', NUMBER_RESPONSE, '20', '6'),
        ('fl-trapezoid-consequences', 'In isosceles trapezoid $ABCD$, $\\overline{AB}\\parallel\\overline{DC}$ and $\\overline{AD}\\cong\\overline{BC}$. The measure of $\\angle D$ is $72^\\circ$. Find the measure of $\\angle A$ in degrees.', NUMBER_RESPONSE, '108', '72'),
        ('fl-trapezoid-consequences', 'In isosceles trapezoid $ABCD$, $\\overline{AB}\\parallel\\overline{DC}$ and $\\overline{AD}\\cong\\overline{BC}$. The measure of $\\angle D$ is $(4x + 7)^\\circ$ and the measure of $\\angle C$ is $(5x - 8)^\\circ$. Find the measure of $\\angle C$ in degrees.', NUMBER_RESPONSE, '67', '82'),
        ('fl-trapezoid-consequences', 'In isosceles trapezoid $ABCD$, $\\overline{AB}\\parallel\\overline{DC}$ and $\\overline{AD}\\cong\\overline{BC}$. Its diagonals have lengths $AC=4x - 5$ and $BD=x + 16$. Find $AC$.', NUMBER_RESPONSE, '23', '16'),
    ]
    covered = {case[0] for case in cases}
    require(covered == SUPPORTED, f'Self-test must cover every template: {sorted(SUPPORTED - covered)}')
    rejected = 0
    for template, prompt, response, answer, wrong in cases:
        good = fixture(template, prompt, response, answer)
        require(review_problem(good) is not None, 'Valid fixture rejected')
        bad = copy.deepcopy(good)
        bad['answer'] = wrong
        try:
            review_problem(bad)
        except ValueError:
            rejected += 1
        else:
            raise ValueError(f'Corrupt Florida gap answer was accepted: {prompt[:60]}')
    # Structural corruptions: duplicate choices, two correct options, unstated rounding, leaked hint.
    duplicate = fixture('fl-equation-truth-20', 'Which equation is false?' + truth,
                        opts(['$15 - 1 = 14$', '$15 - 1 = 14$', '$16 = 18 - 2$', '$11 - 1 = 10 + 1$']), 'option-d')
    two_correct = fixture('fl-equation-truth-20', 'Which equation is false?' + truth,
                          opts(['$15 - 1 = 13$', '$11 - 1 = 10 + 1$', '$16 = 18 - 2$', '$19 - 6 = 18 - 5$']), 'option-b')
    inexact_angle = fixture('fl-vector-angle', 'Find the angle $\\theta$ between $\\mathbf{u}=\\langle 1, 2\\rangle$ and $\\mathbf{v}=\\langle 3, 2\\rangle$, with $0^\\circ\\le\\theta\\le180^\\circ$.',
                            opts(['$45^\\circ$', '$135^\\circ$', '$0^\\circ$', '$90^\\circ$']), 'option-a')
    leaked = fixture('fl-equation-truth-20', 'Which equation is false?' + truth,
                     opts(['$15 - 1 = 14$', '$11 - 1 = 10 + 1$', '$16 = 18 - 2$', '$19 - 6 = 18 - 5$']), 'option-b')
    leaked['hint'] = 'Look at 11 - 1 = 10 + 1.'
    undefined_quotient = fixture('fl-function-arithmetic', 'Let $f(x)=x + 1$ and $g(x)=x - 2$. What is $\\left(\\dfrac{f}{g}\\right)(2)$?',
                                 opts(['$0$', '$1$', '$2$', '$3$']), 'option-a')
    wrong_domain = fixture('fl-function-arithmetic', 'Let $f(x)=x + 4$ and $g(x)=x - 5$. What is the domain of $\\left(\\dfrac{f}{g}\\right)(x)$?',
                           opts(['$x\\ne -4$', '$x\\ne 5$', '$x\\ne 4$', '$x\\ne -5$']), 'option-a')
    garbled = fixture('fl-vector-angle', 'Which statement describes $\\mathbf{u}=\\langle 5, -4\\rangle$ and $\\mathbf{v}=\\langle -15, 12\\rangle$?',
                      opts(['The vectors are perpendicular.', 'The vectors are parallel and point in opposite directions.',
                            'The vectors are parallel and point in the same direction.', 'The vectors are neither perpendicular nor parallel.']), 'option-b')
    garbled['explanation'] = ['Check for a multiple: $u_v_2-u_2v_1=0$.']
    equal_bases = fixture('fl-trapezoid-consequences', 'In trapezoid $ABCD$, $\\overline{AB}\\parallel\\overline{DC}$, $AB=21$ and $DC=21$. $\\overline{MN}$ joins the midpoints of the legs $\\overline{AD}$ and $\\overline{BC}$. Find $MN$.',
                          NUMBER_RESPONSE, '21')
    for corrupt in (duplicate, two_correct, inexact_angle, leaked, undefined_quotient, wrong_domain, garbled, equal_bases):
        try:
            review_problem(corrupt)
        except ValueError:
            rejected += 1
        else:
            raise ValueError('Corrupt Florida gap structure was accepted')
    return rejected


# Read by independent-math-review.py (FamilyOracle).
CHOICE_REVIEW = FL_CHOICE
