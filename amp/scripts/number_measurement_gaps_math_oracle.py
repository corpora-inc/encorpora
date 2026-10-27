"""Independent review of the number and measurement gap templates.

signed-context-order, equivalent-expressions-check, area-tiling-distributive,
estimate-reasonableness, unit-chain-conversion and fraction-of-set.

Every answer is derived from the public prompt, choices and figure only, in
exact Fractions. Equivalence of expressions is decided by comparing polynomial
coefficients, never by a single substitution.
"""
import copy
import math
import re
from fractions import Fraction

SIGNED_CONTEXT = frozenset({'signed-context-order'})
EQUIVALENT = frozenset({'equivalent-expressions-check'})
AREA_TILING = frozenset({'area-tiling-distributive'})
ESTIMATE = frozenset({'estimate-reasonableness'})
UNIT_CHAIN = frozenset({'unit-chain-conversion'})
FRACTION_SET = frozenset({'fraction-of-set'})
CHOICE_TEMPLATES = SIGNED_CONTEXT | EQUIVALENT | AREA_TILING | ESTIMATE
SUPPORTED = CHOICE_TEMPLATES | UNIT_CHAIN | FRACTION_SET


def require(condition, message):
    if not condition:
        raise ValueError(message)


def clean(text):
    return text.replace('−', '-').replace('−', '-').strip()


def num(text):
    text = clean(text).replace(',', '').replace('$', '')
    frac = re.fullmatch(r'(-?)\\frac\{(\d+)\}\{(\d+)\}', text)
    if frac:
        value = Fraction(int(frac[2]), int(frac[3]))
        return -value if frac[1] else value
    require(re.fullmatch(r'-?\d+(?:\.\d+)?', text) is not None, f'Not a number: {text!r}')
    return Fraction(text)


def round_half_up(value, step):
    return Fraction(math.floor(Fraction(value) / step + Fraction(1, 2))) * step


# ---------------------------------------------------------------- polynomials

TOKEN = re.compile(r'\s*(\d+(?:\.\d+)?|x|[-+*()×]|\\cdot)')


def tokens(text):
    text = clean(text).replace('$', '')
    out, position = [], 0
    while position < len(text.rstrip()):
        match = TOKEN.match(text, position)
        require(match is not None, f'Unreadable expression: {text!r}')
        out.append(match[1])
        position = match.end()
    return out


def padd(a, b, sign=1):
    result = dict(a)
    for degree, value in b.items():
        result[degree] = result.get(degree, 0) + sign * value
    return {d: v for d, v in result.items() if v != 0}


def pmul(a, b):
    result = {}
    for da, va in a.items():
        for db, vb in b.items():
            result[da + db] = result.get(da + db, 0) + va * vb
    return {d: v for d, v in result.items() if v != 0}


def polynomial(text):
    items = tokens(text)
    index = 0

    def peek():
        return items[index] if index < len(items) else None

    def take():
        nonlocal index
        index += 1
        return items[index - 1]

    def factor():
        token = take()
        if token == 'x':
            return {1: Fraction(1)}
        if token == '(':
            inner = expression()
            require(take() == ')', 'Unclosed parenthesis')
            return inner
        require(re.fullmatch(r'\d+(?:\.\d+)?', token) is not None, f'Unexpected token {token}')
        value = Fraction(token)
        return {0: value} if value else {}

    def term():
        result = factor()
        while peek() is not None and (peek() in ('*', '×', '\\cdot', 'x', '(')):
            if peek() in ('*', '×', '\\cdot'):
                take()
            result = pmul(result, factor())
        return result

    def expression():
        sign = 1
        if peek() in ('+', '-'):
            sign = -1 if take() == '-' else 1
        result = pmul({0: Fraction(sign)}, term())
        while peek() in ('+', '-'):
            op = take()
            result = padd(result, term(), 1 if op == '+' else -1)
        return result

    result = expression()
    require(index == len(items), f'Trailing tokens in {text!r}')
    return result


def evaluate(poly, x):
    return sum(value * Fraction(x) ** degree for degree, value in poly.items())


def integer_sum_of_products(label):
    """A written sentence such as 3 × 4 + 6 × 4 as a list of factor tuples."""
    text = clean(label)
    require(re.fullmatch(r'\d+(?: × \d+)*(?: \+ \d+(?: × \d+)*)*', text) is not None, f'Unreadable number sentence {label!r}')
    return [tuple(int(f) for f in part.split(' × ')) for part in text.split(' + ')]


def sentence_value(label):
    value = polynomial(label)
    require(set(value) <= {0}, f'Number sentence {label!r} must not contain a variable')
    return value.get(0, Fraction(0))


# --------------------------------------------------------------------- shared

def choice_options(public, count=4):
    response = public['response']
    require(response['kind'] == 'choice', 'Choice response required')
    options = response['options']
    require(len(options) == count and all(set(o) == {'id', 'label'} for o in options), 'Four public choices required')
    require(len({o['id'] for o in options}) == count, 'Duplicate choice IDs')
    require(len({clean(o['label']) for o in options}) == count, 'Duplicate choice labels')
    return options


def single(options, flags, message):
    correct = [o['id'] for o, flag in zip(options, flags) if flag]
    require(len(correct) == 1, message)
    return correct[0]


# --------------------------------------------------------- signed-context-order

NUMBER = r'-?(?:\d+(?:\.\d+)?|\\frac\{\d+\}\{\d+\})'


def solve_order(prompt, options):
    match = re.fullmatch(r'Order \$(.+?)\$ from (greatest to least|least to greatest)\. Which list is in the correct order\?', prompt)
    require(match is not None, 'Order prompt not recognised')
    given = [num(part) for part in match[1].split(',\\ ')]
    require(len(given) == 4 and len(set(given)) == 4, 'Four distinct numbers to order are required')
    descending = match[2] == 'greatest to least'
    target = sorted(given, reverse=descending)
    flags = []
    for option in options:
        body = re.fullmatch(r'\$(.+)\$', clean(option['label']))
        require(body is not None, 'Typeset list expected')
        listed = [num(part) for part in body[1].split(',\\ ')]
        require(sorted(listed) == sorted(given), 'Every list must reorder the same four numbers')
        flags.append(listed == target)
    return single(options, flags, 'Missing or ambiguous correct ordering')


def solve_temperature(prompt, options):
    match = re.fullmatch(r'At noon, (.+?) is \$(' + NUMBER + r')\$ degrees Celsius and (.+?) is \$(' + NUMBER + r')\$ degrees Celsius\. Which statement is correct\?', prompt)
    require(match is not None, 'Temperature prompt not recognised')
    temperature = {match[1].lower().removeprefix('the '): num(match[2]), match[3].lower().removeprefix('the '): num(match[4])}
    require(len(temperature) == 2 and len(set(temperature.values())) == 2, 'Two distinct readings required')
    flags = []
    for option in options:
        label = clean(option['label'])
        colder = re.fullmatch(r'(.+?) is colder than (.+?), so \$(' + NUMBER + r')(<|>)(' + NUMBER + r')\$\.', label)
        if colder:
            x, y = colder[1].lower().removeprefix('the '), colder[2].lower().removeprefix('the ')
            require(x in temperature and y in temperature and x != y, f'Unknown place in {label!r}')
            left, right = num(colder[3]), num(colder[5])
            holds = left < right if colder[4] == '<' else left > right
            # A faithful statement names the colder place first and writes that
            # place's reading on the left of a true inequality.
            flags.append(temperature[x] < temperature[y] and holds and left == temperature[x] and right == temperature[y])
        else:
            require(label == 'Neither is colder, because both readings are measured from 0.', f'Unrecognised statement {label!r}')
            flags.append(False)  # Distinct readings: one place is always colder.
    return single(options, flags, 'Missing or ambiguous temperature statement')


def solve_money_or_height(prompt, options):
    money = re.fullmatch(r"(\w+)'s account balance is \$(" + NUMBER + r")\$ dollars and (\w+)'s is \$(" + NUMBER + r")\$ dollars\. Which statement is correct\?", prompt)
    if money:
        value = {money[1]: num(money[2]), money[3]: num(money[4])}
        require(all(v < 0 for v in value.values()), 'Both balances must be debts')
        require(len(value) == 2 and abs(value[money[1]]) != abs(value[money[3]]), 'Debts must differ in size')
        farther = max(value, key=lambda name: abs(value[name]))
        flags = []
        for option in options:
            label = clean(option['label'])
            valid = re.fullmatch(r'(\w+) owes more, because \$\|(' + NUMBER + r')\|=([\d.]+)\$ is greater than \$\|(' + NUMBER + r')\|=([\d.]+)\$\.', label)
            signed = re.fullmatch(r'(\w+) owes more, because \$(' + NUMBER + r')\$ is greater than \$(' + NUMBER + r')\$\.', label)
            balance = re.fullmatch(r'(\w+) has the greater balance, because ([\d.]+) is greater than ([\d.]+)\.', label)
            if valid:
                name = valid[1]
                other = next(n for n in value if n != name)
                flags.append(name in value and name == farther and num(valid[2]) == value[name] and abs(value[name]) == num(valid[3])
                             and num(valid[4]) == value[other] and abs(value[other]) == num(valid[5]) and abs(value[name]) > abs(value[other]))
            elif signed:
                require(signed[1] in value, 'Unknown person')
                flags.append(False)  # Compares signed values, which reverses the size of a debt.
            elif balance:
                require(balance[1] in value, 'Unknown person')
                flags.append(False)  # Debts of negative balances: more owed is the lesser balance.
            else:
                require(label == 'They owe the same amount, because both balances are negative.', f'Unrecognised statement {label!r}')
                flags.append(False)
        return single(options, flags, 'Missing or ambiguous debt statement')
    height = re.fullmatch(r'Height above sea level is positive and depth below sea level is negative\. An? (.+?) is at \$(' + NUMBER + r')\$ meters and an? (.+?) is at \$(' + NUMBER + r')\$ meters\. Which statement is correct about distance from sea level\?', prompt)
    require(height is not None, 'Money or height prompt not recognised')
    value = {height[1].lower(): num(height[2]), height[3].lower(): num(height[4])}
    require(len(value) == 2 and abs(value[height[1].lower()]) != abs(value[height[3].lower()]), 'Distances must differ')
    require(value[height[1].lower()] * value[height[3].lower()] < 0, 'One place above and one below sea level expected')
    farther = max(value, key=lambda name: abs(value[name]))
    flags = []
    for option in options:
        label = clean(option['label'])
        valid = re.fullmatch(r'An? (.+?) is farther, because \$\|(' + NUMBER + r')\|=([\d.]+)\$ is greater than \$\|(' + NUMBER + r')\|=([\d.]+)\$\.', label)
        signed = re.fullmatch(r'An? (.+?) is farther, because \$(' + NUMBER + r')\$ is (greater|less) than \$(' + NUMBER + r')\$\.', label)
        if valid:
            name = valid[1].lower()
            require(name in value, 'Unknown place')
            other = next(n for n in value if n != name)
            flags.append(name == farther and num(valid[2]) == value[name] and abs(value[name]) == num(valid[3])
                         and num(valid[4]) == value[other] and abs(value[other]) == num(valid[5]))
        elif signed:
            name = signed[1].lower()
            require(name in value, 'Unknown place')
            other = next(n for n in value if n != name)
            # The inequality is about signed values (order, not distance) and must be true of the givens.
            left, right = num(signed[2]), num(signed[4])
            require(left == value[name] and right == value[other] and (left > right if signed[3] == 'greater' else left < right), 'Signed comparison must be true of the givens')
            flags.append(False)  # Signed order says higher or lower, not farther.
        else:
            require(label in ('They cannot be compared, because one number is negative.',
                              'They are the same distance, because one is above and one is below sea level.'), f'Unrecognised statement {label!r}')
            flags.append(False)
    return single(options, flags, 'Missing or ambiguous distance statement')


def solve_signed_context(public):
    options = choice_options(public)
    require(public.get('figure') is None, 'Unexpected figure')
    prompt = clean(public['prompt'])
    if prompt.startswith('Order '):
        return solve_order(prompt, options)
    if prompt.startswith('At noon'):
        return solve_temperature(prompt, options)
    return solve_money_or_height(prompt, options)


# ------------------------------------------------- equivalent-expressions-check

def solve_equivalent(public):
    options = choice_options(public)
    require(public.get('figure') is None, 'Unexpected figure')
    prompt = clean(public['prompt'])
    positive = re.fullmatch(r'Which expression is equivalent to \$(.+)\$\?', prompt)
    negative = re.fullmatch(r'Which expression is NOT equivalent to \$(.+)\$\?', prompt)
    if positive or negative:
        target = polynomial((positive or negative)[1])
        same = []
        for option in options:
            body = re.fullmatch(r'\$(.+)\$', clean(option['label']))
            require(body is not None, 'Typeset expression expected')
            same.append(polynomial(body[1]) == target)
        return single(options, same if positive else [not s for s in same],
                      'Missing or ambiguous equivalent expression' if positive else 'Missing or ambiguous non-equivalent expression')
    match = re.fullmatch(r'(\w+) checks whether \$(.+?)\$ and \$(.+?)\$ are equivalent by substituting x = (-?\d+)\. Both expressions give (-?\d+)\. Which conclusion is correct\?', prompt)
    require(match is not None, 'Equivalence prompt not recognised')
    first, second = polynomial(match[2]), polynomial(match[3])
    point, shared = Fraction(match[4]), Fraction(match[5])
    require(evaluate(first, point) == shared == evaluate(second, point), 'Stated common value is not shared at the substitution point')
    differ = first != second
    require(differ, 'A one-point check that is actually an identity has no valid reason to reject')
    flags = []
    for option in options:
        label = clean(option['label'])
        contrary = re.fullmatch(r'Not equivalent: at x = (-?\d+) the first gives (-?\d+) and the second gives (-?\d+)\.', label)
        if contrary:
            at, a, b = Fraction(contrary[1]), Fraction(contrary[2]), Fraction(contrary[3])
            flags.append(evaluate(first, at) == a and evaluate(second, at) == b and a != b)
        else:
            require(label in ('Equivalent, because both contain %s.' % match[5], 'Equivalent, because they give the same value at x = %s.' % match[4],
                              'Not equivalent, because one expression has parentheses and the other does not.'), f'Unrecognised conclusion {label!r}')
            flags.append(False)
    return single(options, flags, 'Missing or ambiguous conclusion')


# ----------------------------------------------------- area-tiling-distributive

UNIT_WORDS = {'in': 'inches', 'ft': 'feet', 'm': 'meters', 'cm': 'centimeters'}


def polygon_area(vertices):
    total = 0
    for (x1, y1), (x2, y2) in zip(vertices, vertices[1:] + vertices[:1]):
        total += x1 * y2 - x2 * y1
    return Fraction(abs(total), 2)


def solve_area_tiling(public):
    options = choice_options(public)
    prompt = clean(public['prompt'])
    figure = public.get('figure')
    require(figure is not None, 'Every area-tiling problem has a figure')
    kind = figure['kind']
    if kind == 'area-model':
        sentence = re.fullmatch(r'The rectangle is (\d+) units tall and (\d+) units wide\. It is split into parts (\d+) and (\d+) units wide\. Which number sentence does NOT give the area of the rectangle\?', prompt)
        if sentence:
            h, w, a, b = (int(g) for g in sentence.groups())
            require(figure['rows'] == [h] and figure['columns'] == [a, b] and a + b == w, 'Figure disagrees with the stated dimensions')
            flags = [sentence_value(o['label']) != h * w for o in options]
            return single(options, flags, 'Missing or ambiguous non-area sentence')
        stated = re.fullmatch(r'The rectangle is (\d+) units tall\. It is split into a left part (\d+) units wide and a right part (\d+) units wide\. The left part has area (\d+) square units\. What is the area of the whole rectangle, in square units\?', prompt)
        require(stated is not None, 'Area-model prompt not recognised')
        h, a, b, left = (int(g) for g in stated.groups())
        require(figure['rows'] == [h] and figure['columns'] == [a, b], 'Figure disagrees with the stated dimensions')
        require(h * a == left, 'Stated left area is not height times left width')
        flags = [Fraction(clean(o['label']).replace(',', '')) == h * (a + b) for o in options]
        require(len({Fraction(clean(o['label']).replace(',', '')) for o in options}) == 4, 'Duplicate numeric choices')
        return single(options, flags, 'Missing or ambiguous area')
    if kind == 'unit-array':
        stated = re.fullmatch(r'A rectangle is tiled with unit squares: (\d+) rows of (\d+) squares\. The heavy line splits it into region A and region B\. Which number sentence uses the two regions to find the total number of squares\?', prompt)
        require(stated is not None, 'Unit-array prompt not recognised')
        rows, columns = int(stated[1]), int(stated[2])
        split = figure['splitAfterRow']
        require(figure['rows'] == rows and figure['columns'] == columns and 0 < split < rows, 'Figure disagrees with the stated array')
        wanted = sorted([tuple(sorted((split, columns))), tuple(sorted((rows - split, columns)))])
        flags = []
        for option in options:
            terms = integer_sum_of_products(option['label'])
            structured = sorted(tuple(sorted(t)) for t in terms) == wanted
            # A sentence that merely equals the total without the two regions
            # would be a second defensible answer.
            require(structured or sentence_value(option['label']) != rows * columns, f'Distractor also totals the array: {option["label"]!r}')
            flags.append(structured)
        return single(options, flags, 'Missing or ambiguous region sentence')
    require(kind == 'measured-polygon', f'Unknown figure {kind}')
    stated = re.fullmatch(r'All corners of the figure are right angles\. The dashed line splits it into two rectangles\. Lengths are in (\w+)\. What is the area of the figure, in square (\w+)\?', prompt)
    require(stated is not None and stated[1] == stated[2] == UNIT_WORDS[figure['unit']], 'Unit wording must match the figure unit')
    vertices = [tuple(v) for v in figure['vertices']]
    require(len(vertices) == 6 and len(set(vertices)) == 6, 'An L-shape has six distinct vertices')
    edges = list(zip(vertices, vertices[1:] + vertices[:1]))
    for (x1, y1), (x2, y2) in edges:
        require(x1 == x2 or y1 == y2, 'Rectilinear figure required')
    require([abs(x2 - x1) + abs(y2 - y1) for (x1, y1), (x2, y2) in edges] == figure['sides'], 'Side labels disagree with the vertices')
    for index in range(6):
        (ax, ay), (bx, by), (cx, cy) = vertices[index - 1], vertices[index], vertices[(index + 1) % 6]
        require((bx - ax) * (cx - bx) + (by - ay) * (cy - by) == 0, 'Every corner must be a right angle')
    for index in figure['rightAngles']:
        require(0 <= index < 6, 'Right-angle mark outside the figure')
    for height in figure['heights']:
        (fx, fy), (tx, ty) = height['from'], height['to']
        require(abs(fx - tx) + abs(fy - ty) == height['value'], 'Dashed-line length disagrees with its endpoints')
    area = polygon_area(vertices)
    labels = [Fraction(clean(o['label']).replace(',', '')) for o in options]
    require(len(set(labels)) == 4, 'Duplicate numeric choices')
    return single(options, [value == area for value in labels], 'Missing or ambiguous polygon area')


# ------------------------------------------------------ estimate-reasonableness

def count(text):
    return int(text.replace(',', ''))


def solve_estimate(public):
    options = choice_options(public)
    require(public.get('figure') is None, 'Unexpected figure')
    prompt = clean(public['prompt'])
    kai = re.fullmatch(r'Kai calculated (\d+) × (\d+) = ([\d,]+)\. Use rounding to the nearest ten to decide whether this answer is reasonable\. Which statement is correct\?', prompt)
    if kai:
        x, y, claimed = int(kai[1]), int(kai[2]), count(kai[3])
        a, b = round_half_up(x, 10), round_half_up(y, 10)
        estimate = int(a * b)
        ratio = Fraction(claimed, estimate)
        # The shown product is either the exact product (reasonable) or a slip. A clear
        # verdict needs the estimate to agree: within 15 percent for the exact product,
        # off by more than a factor of two for a slip.
        reasonable = claimed == x * y
        if reasonable:
            require(Fraction(85, 100) <= ratio <= Fraction(115, 100), f'Exact product is not clearly near its estimate: {claimed} against {estimate}')
        else:
            require(ratio < Fraction(1, 2) or ratio > 2, f'Wrong product is not clearly far from its estimate: {claimed} against {estimate}')
        flags = []
        for option in options:
            label = clean(option['label'])
            verdict = re.fullmatch(r'(Reasonable|Not reasonable)\. Rounding gives (\d+) × (\d+) = ([\d,]+)(?:, which is close to ([\d,]+)|, so the answer should be near ([\d,]+), not ([\d,]+))\.', label)
            if verdict:
                says_ok = verdict[1] == 'Reasonable'
                shown = (int(verdict[2]), int(verdict[3]), count(verdict[4]))
                tail = count(verdict[5]) if says_ok else count(verdict[7])
                require(says_ok or count(verdict[6]) == count(verdict[4]), 'Not-reasonable text must repeat the estimate')
                flags.append(says_ok == reasonable and shown == (a, b, estimate) and tail == claimed)
            else:
                require(label in ('Cannot tell without finding the exact product of %d and %d.' % (x, y), 'Reasonable, because %s is a whole number.' % kai[3]), f'Unrecognised statement {label!r}')
                flags.append(False)
        return single(options, flags, 'Missing or ambiguous verdict')
    amounts = []
    buses = re.fullmatch(r'(\d+) students ride to a game on buses that each seat (\d+)\. Round \1 to the nearest hundred and \2 to the nearest ten\. Which is the best estimate of the number of buses needed\?', prompt)
    trays = re.fullmatch(r'A bakery fills (\d+) trays with (\d+) rolls each in the morning and (\d+) trays with (\d+) rolls each in the afternoon\. Round the number on each tray to the nearest ten\. Which is the best estimate of the total number of rolls\?', prompt)
    groups = re.fullmatch(r'A [a-z]+ [a-z]+ (\d+) [a-z]+ with (\d+) [a-z]+ (?:on|in) each [a-z]+\. Round each number to the nearest ten\. Which is the best estimate of the total number of [a-z]+\?', prompt)
    if buses:
        quotient = Fraction(round_half_up(int(buses[1]), 100), round_half_up(int(buses[2]), 10))
        require(quotient.denominator == 1, 'Rounded quotient must be a whole number of buses')
        estimate = quotient
    elif trays:
        n1, p1, n2, p2 = (int(g) for g in trays.groups())
        estimate = n1 * round_half_up(p1, 10) + n2 * round_half_up(p2, 10)
    else:
        require(groups is not None, 'Estimation prompt not recognised')
        estimate = round_half_up(int(groups[1]), 10) * round_half_up(int(groups[2]), 10)
    values = [Fraction(clean(o['label']).replace(',', '')) for o in options]
    require(len(set(values)) == 4, 'Duplicate numeric choices')
    return single(options, [v == estimate for v in values], 'Missing or ambiguous best estimate')


# --------------------------------------------------------- unit-chain-conversion

def solve_unit_chain(public):
    require(public['response']['kind'] == 'fraction', 'Numeric entry expected')
    require(public.get('figure') is None, 'Unexpected figure')
    prompt = clean(public['prompt'])
    n = r'([\d,]+)'
    rules = [
        (r'Water flows from a pipe at %s liters per minute\. Given 1 hour = %s minutes and 1 cubic meter = %s liters, how many cubic meters of water flow in %s hours\?' % (n, n, n, n),
         lambda r, minutes, liters, hours: r * hours * minutes / liters),
        (r'A solid block of metal has mass %s kilograms? and density %s grams per cubic centimeter\. Given 1 kilogram = %s grams, what is its volume in cubic centimeters\?' % (n, n, n),
         lambda mass, density, grams: mass * grams / density),
        (r'A solid block of metal has volume %s cubic centimeters and density %s grams per cubic centimeter\. Given 1 kilogram = %s grams, what is its mass in kilograms\?' % (n, n, n),
         lambda volume, density, grams: volume * density / grams),
        (r"A doctor orders %s milligrams of a medicine per kilogram of body mass per day\. A patient's mass is %s kilograms\. The daily amount is split into %s equal doses\. How many milligrams are in one dose\?" % (n, n, n),
         lambda rate, mass, doses: rate * mass / doses),
        (r"A doctor orders %s milligrams of a medicine per kilogram of body mass per day\. A patient's mass is %s kilograms\. The daily amount is split into %s equal doses\. Each tablet contains %s milligrams\. How many tablets are in one dose\?" % (n, n, n, n),
         lambda rate, mass, doses, tablet: rate * mass / doses / tablet),
        (r'A cyclist rides at a steady %s kilometers per hour for %s minutes\. Given 1 kilometer = %s meters and 1 hour = %s minutes, how many meters does the cyclist ride\?' % (n, n, n, n),
         lambda speed, minutes, meters, per_hour: speed * minutes * meters / per_hour),
        (r'A tank is a rectangular box %s meters? long, %s meters? wide and %s meters? high\. Given 1 meter = %s centimeters and 1 liter = %s cubic centimeters, how many liters does it hold when full\?' % (n, n, n, n, n),
         lambda l, w, h, cm, liter: l * w * h * cm ** 3 / liter),
    ]
    for pattern, compute in rules:
        match = re.fullmatch(pattern, prompt)
        if match:
            answer = compute(*(Fraction(count(g)) for g in match.groups()))
            break
    else:
        tiles = re.fullmatch(r'A rectangular floor measures %s meters by %s meters\. It is covered with no gaps or overlaps by square tiles, each %s centimeters on a side\. Given 1 meter = %s centimeters, how many tiles are needed\?' % (n, n, n, n), prompt)
        require(tiles is not None, 'Unit-chain prompt not recognised')
        length, width, side, cm = (Fraction(count(g)) for g in tiles.groups())
        require((length * cm / side).denominator == 1 and (width * cm / side).denominator == 1, 'Square tiles must fit each side exactly')
        answer = length * cm / side * (width * cm / side)
    require(answer.denominator == 1 and answer > 0, f'Unit-chain answer must be a positive whole number, got {answer}')
    return answer


# ------------------------------------------------------------------ fraction-of-set

def solve_fraction_set(public):
    require(public['response']['kind'] == 'number', 'Numeric entry expected')
    prompt = clean(public['prompt'])
    figure = public.get('figure')
    counting = re.fullmatch(r'A set has (\d+) (\w+)\. \$\\frac\{(\d+)\}\{(\d+)\}\$ of the \2 are red( and the rest are blue)?\. How many are (red|blue)\?', prompt)
    if counting:
        total, noun, top, bottom = int(counting[1]), counting[2], int(counting[3]), int(counting[4])
        require(0 < top < bottom and total % bottom == 0, 'Total must split into equal groups')
        require(counting[6] == 'red' or counting[5], 'Blue is asked only when the rest are blue')
        require(figure is not None and figure['kind'] == 'grouped-counters', 'Grouped counters expected')
        require(figure['total'] == total and figure['unit'] == noun and figure['groupSize'] * bottom == total, 'Counter figure disagrees with the counts')
        group = Fraction(total, bottom)
        return group * (top if counting[6] == 'red' else bottom - top)
    stated = re.fullmatch(r'\$\\frac\{1\}\{(\d+)\}\$ of the (\w+) in a box is (\d+) \2\. How many \2 are in \$\\frac\{(\d+)\}\{\1\}\$ of the box\?', prompt)
    require(stated is not None, 'Fraction-of-set prompt not recognised')
    require(figure is None, 'Unexpected figure')
    require(0 < int(stated[4]) <= int(stated[1]), 'Fraction of the box must not exceed the whole')
    return Fraction(int(stated[3]) * int(stated[4]))


# -------------------------------------------------------------------- entry points

def solve(public):
    template = public['templateId']
    require(template in SUPPORTED, 'Unexpected number-measurement family')
    if template in SIGNED_CONTEXT:
        return solve_signed_context(public)
    if template in EQUIVALENT:
        return solve_equivalent(public)
    if template in AREA_TILING:
        return solve_area_tiling(public)
    if template in ESTIMATE:
        return solve_estimate(public)
    if template in UNIT_CHAIN:
        return solve_unit_chain(public)
    return solve_fraction_set(public)


def review_problem(problem):
    public = problem['public']
    result = solve(public)
    if public['templateId'] in CHOICE_TEMPLATES:
        require(result == problem['answer'], 'Number-measurement answer key mismatch')
    else:
        require(re.fullmatch(r'\d+', str(problem['answer'])) is not None, 'Whole-number answer must be a plain integer')
        require(result == Fraction(problem['answer']), 'Number-measurement answer mismatch')
    return result


def self_test():
    def choice(template, prompt, labels, answer, figure=None):
        public = {'templateId': template, 'prompt': prompt,
                  'response': {'kind': 'choice', 'options': [{'id': f'option-{i}', 'label': label} for i, label in enumerate(labels)]}}
        if figure is not None:
            public['figure'] = figure
        return {'public': public, 'answer': f'option-{answer}'}

    def numeric(template, prompt, kind, answer, figure=None):
        public = {'templateId': template, 'prompt': prompt, 'response': {'kind': kind}}
        if figure is not None:
            public['figure'] = figure
        return {'public': public, 'answer': answer}

    fixtures = [
        choice('signed-context-order', r'Order $-1,\ \frac{2}{5},\ -\frac{1}{5},\ 1.8$ from greatest to least. Which list is in the correct order?',
               [r'$-1,\ -\frac{1}{5},\ \frac{2}{5},\ 1.8$', r'$1.8,\ \frac{2}{5},\ -\frac{1}{5},\ -1$', r'$1.8,\ -1,\ \frac{2}{5},\ -\frac{1}{5}$', r'$\frac{2}{5},\ -\frac{1}{5},\ -1,\ 1.8$'], 1),
        choice('signed-context-order', 'At noon, Town A is $-3.2$ degrees Celsius and Town B is $-2.8$ degrees Celsius. Which statement is correct?',
               ['Town A is colder than Town B, so $-3.2>-2.8$.', 'Neither is colder, because both readings are measured from 0.', 'Town B is colder than Town A, so $-2.8<-3.2$.', 'Town A is colder than Town B, so $-3.2<-2.8$.'], 3),
        choice('signed-context-order', "Mei's account balance is $-97$ dollars and Sam's is $-58.25$ dollars. Which statement is correct?",
               ['Sam owes more, because $-58.25$ is greater than $-97$.', 'Mei owes more, because $|-97|=97$ is greater than $|-58.25|=58.25$.', 'They owe the same amount, because both balances are negative.', 'Mei has the greater balance, because 97 is greater than 58.25.'], 1),
        choice('signed-context-order', 'Height above sea level is positive and depth below sea level is negative. A cave floor is at $-255$ meters and a bridge is at $95$ meters. Which statement is correct about distance from sea level?',
               ['A bridge is farther, because $95$ is greater than $-255$.', 'They cannot be compared, because one number is negative.', 'They are the same distance, because one is above and one is below sea level.', 'A cave floor is farther, because $|-255|=255$ is greater than $|95|=95$.'], 3),
        choice('equivalent-expressions-check', 'Which expression is equivalent to $5(x - 7) - 1(x - 5)$?',
               ['$4x - 2$', '$6x - 30$', '$4x - 30$', '$6x - 40$'], 2),
        choice('equivalent-expressions-check', 'Which expression is NOT equivalent to $5(x - 5) - x$?',
               ['$-25 + 5x - x$', '$-25 + 4x$', '$4x - 25$', '$5x - 25$'], 3),
        choice('equivalent-expressions-check', 'Sam checks whether $3(x + 6)$ and $x + 18$ are equivalent by substituting x = 0. Both expressions give 18. Which conclusion is correct?',
               ['Equivalent, because both contain 18.', 'Not equivalent: at x = 1 the first gives 21 and the second gives 19.', 'Equivalent, because they give the same value at x = 0.', 'Not equivalent, because one expression has parentheses and the other does not.'], 1),
        choice('area-tiling-distributive', 'The rectangle is 4 units tall and 23 units wide. It is split into parts 20 and 3 units wide. Which number sentence does NOT give the area of the rectangle?',
               ['4 + 20 × 3', '4 × 23', '23 × 4', '4 × 3 + 4 × 20'], 0, {'kind': 'area-model', 'columns': [20, 3], 'rows': [4]}),
        choice('area-tiling-distributive', 'The rectangle is 4 units tall. It is split into a left part 5 units wide and a right part 2 units wide. The left part has area 20 square units. What is the area of the whole rectangle, in square units?',
               ['28', '27', '40', '8'], 0, {'kind': 'area-model', 'columns': [5, 2], 'rows': [4]}),
        choice('area-tiling-distributive', 'A rectangle is tiled with unit squares: 9 rows of 4 squares. The heavy line splits it into region A and region B. Which number sentence uses the two regions to find the total number of squares?',
               ['3 × 4 + 6 × 4', '3 × 4 + 6', '3 × 4 + 6 × 9', '3 × 6 × 4'], 0, {'kind': 'unit-array', 'rows': 9, 'columns': 4, 'splitAfterRow': 3}),
        choice('area-tiling-distributive', 'All corners of the figure are right angles. The dashed line splits it into two rectangles. Lengths are in inches. What is the area of the figure, in square inches?',
               ['35', '24', '41', '29'], 3, {'kind': 'measured-polygon', 'unit': 'in', 'vertices': [[0, 0], [7, 0], [7, 3], [4, 3], [4, 5], [0, 5]], 'sides': [7, 3, 3, 2, 4, 5],
                                           'heights': [{'from': [4, 3], 'to': [0, 3], 'value': 4}], 'guides': [], 'rightAngles': [0, 1, 4, 5]}),
        choice('estimate-reasonableness', 'Kai calculated 68 × 22 = 150. Use rounding to the nearest ten to decide whether this answer is reasonable. Which statement is correct?',
               ['Reasonable, because 150 is a whole number.', 'Not reasonable. Rounding gives 70 × 20 = 1,400, so the answer should be near 1,400, not 150.', 'Reasonable. Rounding gives 70 × 20 = 1,400, which is close to 150.', 'Cannot tell without finding the exact product of 68 and 22.'], 1),
        choice('estimate-reasonableness', '270 students ride to a game on buses that each seat 48. Round 270 to the nearest hundred and 48 to the nearest ten. Which is the best estimate of the number of buses needed?',
               ['6', '60', '15000', '250'], 0),
        choice('estimate-reasonableness', 'A bakery fills 7 trays with 82 rolls each in the morning and 6 trays with 57 rolls each in the afternoon. Round the number on each tray to the nearest ten. Which is the best estimate of the total number of rolls?',
               ['1,820', '626', '920', '560'], 2),
        choice('estimate-reasonableness', 'A school orders 46 boxes with 71 pencils in each box. Round each number to the nearest ten. Which is the best estimate of the total number of pencils?',
               ['1,200', '35,000', '350', '3,500'], 3),
        numeric('unit-chain-conversion', 'A cyclist rides at a steady 18 kilometers per hour for 25 minutes. Given 1 kilometer = 1000 meters and 1 hour = 60 minutes, how many meters does the cyclist ride?', 'fraction', '7500'),
        numeric('unit-chain-conversion', 'A rectangular floor measures 8 meters by 3 meters. It is covered with no gaps or overlaps by square tiles, each 25 centimeters on a side. Given 1 meter = 100 centimeters, how many tiles are needed?', 'fraction', '384'),
        numeric('unit-chain-conversion', 'A tank is a rectangular box 6 meters long, 6 meters wide and 1 meter high. Given 1 meter = 100 centimeters and 1 liter = 1000 cubic centimeters, how many liters does it hold when full?', 'fraction', '36000'),
        numeric('unit-chain-conversion', 'A solid block of metal has mass 13 kilograms and density 4 grams per cubic centimeter. Given 1 kilogram = 1000 grams, what is its volume in cubic centimeters?', 'fraction', '3250'),
        numeric('fraction-of-set', r'$\frac{1}{6}$ of the buttons in a box is 7 buttons. How many buttons are in $\frac{3}{6}$ of the box?', 'number', '21'),
        numeric('fraction-of-set', r'A set has 36 counters. $\frac{3}{6}$ of the counters are red and the rest are blue. How many are blue?', 'number', '18',
                {'kind': 'grouped-counters', 'total': 36, 'groupSize': 6, 'unit': 'counters'}),
        numeric('unit-chain-conversion', "A doctor orders 40 milligrams of a medicine per kilogram of body mass per day. A patient's mass is 10 kilograms. The daily amount is split into 4 equal doses. Each tablet contains 50 milligrams. How many tablets are in one dose?", 'fraction', '2'),
        choice('area-tiling-distributive', 'The rectangle is 5 units tall and 16 units wide. It is split into parts 10 and 6 units wide. Which number sentence does NOT give the area of the rectangle?',
               ['(5 + 10) × 6', '5 × 16', '5 × 10 + 5 × 6', '16 × 5'], 0, {'kind': 'area-model', 'columns': [10, 6], 'rows': [5]}),
        choice('signed-context-order', 'Height above sea level is positive and depth below sea level is negative. A submarine is at $-230$ meters and a gull is at $265$ meters. Which statement is correct about distance from sea level?',
               ['A submarine is farther, because $-230$ is less than $265$.', 'They cannot be compared, because one number is negative.', 'They are the same distance, because one is above and one is below sea level.', 'A gull is farther, because $|265|=265$ is greater than $|-230|=230$.'], 3),
    ]
    rejected = 0

    def reject(problem, why):
        nonlocal rejected
        try:
            review_problem(problem)
        except (ValueError, KeyError, TypeError, AttributeError):
            rejected += 1
            return
        raise ValueError(f'Corrupt number-measurement fixture was accepted: {why}')

    for fixture in fixtures:
        review_problem(fixture)
        public = fixture['public']
        if public['response']['kind'] == 'choice':
            ids = [o['id'] for o in public['response']['options']]
            wrong = copy.deepcopy(fixture)
            wrong['answer'] = next(i for i in ids if i != fixture['answer'])
            reject(wrong, 'wrong key')
            twin = copy.deepcopy(fixture)
            labels = twin['public']['response']['options']
            labels[ids.index(next(i for i in ids if i != fixture['answer']))]['label'] = labels[ids.index(fixture['answer'])]['label']
            reject(twin, 'duplicate correct label')
        else:
            wrong = copy.deepcopy(fixture)
            wrong['answer'] = str(int(fixture['answer']) + 1)
            reject(wrong, 'off by one')
            padded = copy.deepcopy(fixture)
            padded['answer'] = fixture['answer'] + '.0'
            reject(padded, 'non-canonical integer')

    def mutated(index, edit, why):
        problem = copy.deepcopy(fixtures[index])
        edit(problem['public'])
        reject(problem, why)

    mutated(0, lambda p: p['response']['options'][1].update(label=r'$1.8,\ -\frac{1}{5},\ \frac{2}{5},\ -1$'), 'two plausible orders')
    mutated(0, lambda p: p.update(prompt=p['prompt'].replace('greatest to least', 'least to greatest')), 'reversed direction')
    mutated(1, lambda p: p.update(prompt=p['prompt'].replace('-2.8', '-3.2')), 'equal temperatures')
    mutated(2, lambda p: p.update(prompt=p['prompt'].replace('-58.25', '-97')), 'equal debts')
    mutated(2, lambda p: p.update(prompt=p['prompt'].replace('-97', '97')), 'a positive balance')
    mutated(3, lambda p: p.update(prompt=p['prompt'].replace('$95$', '$-95$')), 'both places below sea level')
    mutated(4, lambda p: p['response']['options'][0].update(label='$-30 + 3x + x$'), 'two equivalent expressions')
    mutated(4, lambda p: p.update(prompt=p['prompt'].replace('- 1(x - 5)', '- 1(x - 6)')), 'changed expression')
    mutated(5, lambda p: p['response']['options'][1].update(label='$5x - 20$'), 'two non-equivalent expressions')
    mutated(6, lambda p: p.update(prompt=p['prompt'].replace('Both expressions give 18', 'Both expressions give 19')), 'false substitution claim')
    mutated(6, lambda p: p.update(prompt=p['prompt'].replace('x + 18', '3x + 18')), 'actually equivalent pair')
    mutated(6, lambda p: p['response']['options'][1].update(label='Not equivalent: at x = 1 the first gives 21 and the second gives 20.'), 'wrong evidence values')
    mutated(7, lambda p: p['figure'].update(columns=[20, 4]), 'figure disagrees with split')
    mutated(7, lambda p: p['response']['options'][1].update(label='4 × 3 + 20'), 'two non-area sentences')
    mutated(8, lambda p: p.update(prompt=p['prompt'].replace('area 20', 'area 21')), 'left area inconsistent')
    mutated(8, lambda p: p['figure'].update(rows=[5]), 'figure height disagrees')
    mutated(9, lambda p: p['figure'].update(splitAfterRow=4), 'figure split disagrees')
    mutated(9, lambda p: p['response']['options'][1].update(label='9 × 4'), 'unstructured sentence equals the total')
    mutated(10, lambda p: p['figure'].update(vertices=[[0, 0], [7, 0], [7, 3], [4, 3], [4, 6], [0, 6]]), 'vertices disagree with side labels')
    mutated(10, lambda p: p['figure'].update(sides=[7, 3, 3, 2, 4, 6]), 'side label disagrees')
    mutated(10, lambda p: p['figure']['heights'][0].update(value=3), 'dashed length disagrees')
    mutated(10, lambda p: p.update(prompt=p['prompt'].replace('inches', 'feet')), 'unit wording disagrees')
    mutated(11, lambda p: p.update(prompt=p['prompt'].replace('68 × 22 = 150', '68 × 22 = 1,500')), 'reasonable answer keyed as not reasonable')
    mutated(11, lambda p: p.update(prompt=p['prompt'].replace('= 150', '= 1,000')), 'verdict margin unclear')
    mutated(12, lambda p: p['response']['options'][1].update(label='6'), 'duplicate numeric choice')
    mutated(12, lambda p: p.update(prompt=p['prompt'].replace('48', '58')), 'changed given')
    mutated(13, lambda p: p.update(prompt=p['prompt'].replace('57', '67')), 'changed given')
    mutated(14, lambda p: p['response']['options'][0].update(label='3500'), 'duplicate numeric choice')
    mutated(15, lambda p: p.update(prompt=p['prompt'].replace('18 kilometers', '19 kilometers')), 'non-whole result')
    mutated(16, lambda p: p.update(prompt=p['prompt'].replace('25 centimeters', '35 centimeters')), 'tiles do not fit')
    mutated(17, lambda p: p.update(prompt=p['prompt'].replace('1 liter = 1000', '1 liter = 1100')), 'changed conversion')
    mutated(18, lambda p: p.update(prompt=p['prompt'].replace('density 4', 'density 3')), 'non-whole volume')
    mutated(19, lambda p: p.update(prompt=p['prompt'].replace('3}{6}', '7}{6}')), 'more than the whole box')
    mutated(20, lambda p: p['figure'].update(groupSize=5), 'counter groups disagree')
    mutated(20, lambda p: p['figure'].update(total=30), 'counter total disagrees')
    mutated(20, lambda p: p.update(prompt=p['prompt'].replace('counters', 'marbles')), 'object noun disagrees')
    mutated(21, lambda p: p.update(prompt=p['prompt'].replace('Each tablet contains 50', 'Each tablet contains 30')), 'tablets do not divide the dose')
    mutated(22, lambda p: p['response']['options'][2].update(label='(5 + 10) × 6 + 1'), 'two non-area sentences')
    mutated(23, lambda p: p.update(prompt=p['prompt'].replace('$265$', '$-265$')), 'both below sea level')
    mutated(23, lambda p: p['response']['options'][0].update(label='A submarine is farther, because $-230$ is greater than $265$.'), 'false signed comparison')
    return {'fixtures': len(fixtures), 'rejectedMutations': rejected}

# Read by independent-math-review.py (FamilyOracle).
CHOICE_REVIEW = CHOICE_TEMPLATES



if __name__ == '__main__':
    print(self_test())
