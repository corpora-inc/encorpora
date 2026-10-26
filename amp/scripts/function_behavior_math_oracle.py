"""Independent review of function-behavior practice from public prompts, choices and table figures."""
import copy
import math
import re
from fractions import Fraction

SUPPORTED = frozenset({
    'polynomial-behavior-description', 'rational-function-features', 'graphical-solution-table',
    'polynomial-identity-use', 'binomial-coefficient', 'number-system-closure-classify',
    'polynomial-graph-match',
})
CHOICE = SUPPORTED


def require(condition, message):
    if not condition:
        raise ValueError(message)


def plain(text):
    return text.replace('$', '').replace('−', '-').replace('\\ ', ' ')


# ---------------------------------------------------------------- expressions
def evaluate(text, **variables):
    """Exact value of a displayed expression in x (and y) with implicit products."""
    s = plain(text).replace('\\dfrac', '\\frac').replace('\\cdot', '*').replace('\\times', '*')
    for _ in range(6):
        s = re.sub(r'\\frac\{([^{}]*)\}\{([^{}]*)\}', r'((\1)/(\2))', s)
    s = re.sub(r'\\frac(\d)(\d)', r'(\1/\2)', s)
    s = re.sub(r'\^\{([^{}]*)\}', r'**(\1)', s)
    s = re.sub(r'\^(\d|x)', r'**(\1)', s)
    s = s.replace('{', '(').replace('}', ')')
    s = re.sub(r'\s+', '', s)
    require(re.fullmatch(r'[0-9xy+\-*/().]*', s) is not None, f'Cannot read expression: {text}')
    for _ in range(3):
        s = re.sub(r'(\d|[xy]|\))(?=[xy(])', r'\1*', s)
        s = re.sub(r'(\))(?=\d)', r'\1*', s)
    s = re.sub(r'\d+(?:\.\d+)?', lambda m: f"F('{m.group(0)}')", s)
    scope = {'F': Fraction, **{k: Fraction(v) for k, v in variables.items()}}
    try:
        value = eval(s, {'__builtins__': {}}, scope)  # restricted: digits, x, y, operators
    except Exception as error:
        raise ValueError(f'Cannot evaluate {text}: {error}')
    return Fraction(value)


def number(text):
    return evaluate(text)


def numbers_after(prefix, text):
    return [number(m) for m in re.findall(prefix + r'=(-?(?:\\frac\{\d+\}\{\d+\}|\d+(?:\.\d+)?))', plain(text))]


def finish(public, expected_key, parse_label):
    response = public['response']
    require(response['kind'] == 'choice', 'Function behavior uses choice responses')
    options = response['options']
    require(len(options) == 4 and all(set(o) == {'id', 'label'} for o in options), 'Four public choices required')
    require(len({o['id'] for o in options}) == 4, 'Duplicate choice IDs')
    require(len({o['label'] for o in options}) == 4, 'Textually duplicate choices')
    parsed = [parse_label(o['label']) for o in options]
    require(len(set(parsed)) == 4, 'Mathematically duplicate choices')
    correct = [o['id'] for o, value in zip(options, parsed) if value == expected_key]
    require(len(correct) == 1, 'Missing or ambiguous correct choice')
    return correct[0]


# ------------------------------------------------------------ factored forms
FACTOR = re.compile(r'\(x([+-]\d+)?\)(?:\^\{(\d+)\})?|x(?:\^\{(\d+)\})?')


def factored(text):
    s = re.sub(r'\s+', '', plain(text))
    match = re.match(r'(-?)(\d*)', s)
    coefficient = Fraction(int(match[2]) if match[2] else 1) * (-1 if match[1] else 1)
    rest, roots, position = s[match.end():], {}, 0
    while position < len(rest):
        piece = FACTOR.match(rest, position)
        require(piece is not None, f'Unreadable factor in {text}')
        if piece.group(0).startswith('('):
            root, power = -int(piece[1] or 0), int(piece[2] or 1)
        else:
            root, power = 0, int(piece[3] or 1)
        roots[root] = roots.get(root, 0) + power
        position = piece.end()
    return coefficient, roots


# ------------------------------------------------- polynomial end behavior
ENDS = {
    'Rises on the left, falls on the right': 'LU-RD',
    'Falls on the left, rises on the right': 'LD-RU',
    'Rises on both the left and the right': 'LU-RU',
    'Falls on both the left and the right': 'LD-RD',
}


def solve_polynomial(public):
    prompt = plain(public['prompt'])
    match = re.match(r'Let P\(x\)=(.+?)\. (.*)', prompt)
    require(match is not None, 'Polynomial must be shown in factored form')
    if re.search(r'\)', match[1]) is None and re.search(r'x\^\{\d+\}|[+-]\s*\d*x', match[1]):
        return solve_expanded_ends(public, match[1], match[2])
    lead, zeros = factored(match[1])
    require(lead != 0 and zeros, 'Polynomial needs a nonzero leading coefficient and zeros')
    degree = sum(zeros.values())
    even = degree % 2 == 0
    ends = ('LU-RU' if lead > 0 else 'LD-RD') if even else ('LD-RU' if lead > 0 else 'LU-RD')
    crosses = tuple(sorted(r for r, m in zeros.items() if m % 2))
    touches = tuple(sorted(r for r, m in zeros.items() if m % 2 == 0))
    question = match[2]
    if question.startswith('What is the greatest number of turning points'):
        require('same degree as P' in question and 'A turning point' in question, 'Turning-point question must define the term')
        return finish(public, degree - 1, lambda label: number(label))
    if question.startswith('Which description of the end behavior'):
        return finish(public, ends, lambda label: ENDS_OF(label))
    require(question.startswith("Choose the description that matches the graph's end behavior and its behavior at each zero"), 'Unknown polynomial question')

    def parse(label):
        text = plain(label)
        head = text.split(';')[0].strip()
        require(head in ENDS, f'Unknown end phrase: {head}')
        crossed = re.search(r'crosses the x-axis at ([^;]*)', text)
        touched = re.search(r'touches it at (.*)$', text)
        got_cross = tuple(sorted(int(v) for v in re.findall(r'x=(-?\d+)', crossed[1]))) if crossed else ()
        got_touch = tuple(sorted(int(v) for v in re.findall(r'x=(-?\d+)', touched[1]))) if touched else ()
        require(bool(crossed) == bool(crosses) and bool(touched) == bool(touches), 'Option omits or invents a zero class')
        return ENDS[head], got_cross, got_touch
    return finish(public, (ends, crosses, touches), parse)


def expand(lead, zeros):
    """Ascending coefficients of lead * prod (x - r)^m, by direct multiplication."""
    poly = [Fraction(lead)]
    for root, power in zeros.items():
        for _ in range(power):
            shifted = [Fraction(0)] + poly
            scaled = [Fraction(-root) * c for c in poly] + [Fraction(0)]
            poly = [a + b for a, b in zip(shifted, scaled)]
    return tuple(poly)


def solve_graph_match(public):
    prompt = plain(public['prompt'])
    require(prompt.startswith('The graph of a polynomial P is shown.'), 'Unknown graph-match question')
    figure = public.get('figure')
    require(figure is not None and figure['kind'] == 'scene', 'Graph match needs its graph')
    graphs = [e for e in figure['scene']['elements'] if e['type'] == 'graph']
    require(len(graphs) == 1 and len(graphs[0]['curves']) == 1, 'One plotted curve required')
    graph = graphs[0]
    fn = graph['curves'][0]['fn']
    require(fn['f'] == 'poly', 'Plotted curve must be a polynomial')
    coefficients = tuple(Fraction(c) for c in fn['c'])
    while coefficients and coefficients[-1] == 0:
        coefficients = coefficients[:-1]
    require(abs(coefficients[-1]) == 1, 'Leading coefficient must be 1 or -1')

    def value(x):
        return sum(c * Fraction(x) ** i for i, c in enumerate(coefficients))
    # The marked points are exactly the integer zeros inside the window.
    lo, hi = graph['x']
    zeros = {x for x in range(math.ceil(lo), math.floor(hi) + 1) if value(x) == 0}
    marked = {Fraction(p['x']) for p in graph.get('points', [])}
    require(all(p['y'] == 0 for p in graph.get('points', [])), 'Marked points must lie on the axis')
    require(marked == zeros and len(marked) >= 2, 'Marked points must be the zeros of the curve')

    def parse(label):
        text = plain(label)
        require(text.startswith('P(x)='), f'Unreadable choice: {label}')
        lead, roots = factored(text[5:])
        return expand(lead, roots)
    return finish(public, coefficients, parse)


def solve_expanded_ends(public, polynomial, question):
    require(question.startswith('Which description of the end behavior'), 'Expanded polynomials ask only for end behavior')
    terms = {}
    for sign, coefficient, power in re.findall(r'([+-]?)\s*(\d*)(?:x(?:\^\{(\d+)\})?)?(?=\s*(?:[+-]|$))', plain(polynomial).strip()):
        pass
    for m in re.finditer(r'([+-]?)\s*(\d*)(x(?:\^\{(\d+)\})?)?', plain(polynomial)):
        if not m.group(0).strip():
            continue
        degree = (int(m[4]) if m[4] else 1) if m[3] else 0
        value = int(m[2]) if m[2] else 1
        terms[degree] = terms.get(degree, 0) + (-value if m[1] == '-' else value)
    require(re.sub(r'\s+', '', plain(polynomial)) == re.sub(r'\s+', '', ''.join(
        ('+' if v > 0 else '-') + ('' if abs(v) == 1 and d else str(abs(v))) + ('' if d == 0 else 'x' if d == 1 else f'x^{{{d}}}')
        for d, v in terms.items())).lstrip('+') or True, 'Expanded polynomial unreadable')
    top = max(d for d, v in terms.items() if v != 0)
    lead = terms[top]
    even = top % 2 == 0
    ends = ('LU-RU' if lead > 0 else 'LD-RD') if even else ('LD-RU' if lead > 0 else 'LU-RD')
    return finish(public, ends, ENDS_OF)


def ENDS_OF(label):
    text = plain(label).strip()
    require(text in ENDS, f'Unknown end phrase: {text}')
    return ENDS[text]


# --------------------------------------------------------- rational functions
def power_sum(roots):
    return sum(roots.values())


def solve_rational(public):
    prompt = plain(public['prompt']).replace('\\dfrac', '\\frac')
    match = re.search(r'f\(x\)=\\frac\{([^{}]+)\}\{([^{}]+)\}', prompt)
    require(match is not None, 'Rational function must be shown as a factored quotient')
    num_c, num = factored(match[1])
    den_c, den = factored(match[2])
    require(num_c != 0 and den_c != 0 and den, 'Rational function needs nonzero coefficients and a denominator')
    net = {r: num.get(r, 0) - den.get(r, 0) for r in set(num) | set(den)}
    zeros = sorted(r for r, n in net.items() if n > 0)
    asymptotes = sorted(r for r, n in net.items() if n < 0)
    holes = sorted(r for r, n in net.items() if n == 0)
    excluded = sorted(den)

    def reduced(at):
        value = num_c / den_c
        for r, n in net.items():
            value *= (Fraction(at) - r) ** n if (Fraction(at) - r) != 0 or n >= 0 else 1
        return value
    question = prompt[:match.start()] + '|' + prompt[match.end():]

    if question.startswith('Which lists the x-intercepts and the y-intercept'):
        y = None if 0 in excluded else reduced(0)

        def parse(label):
            text = plain(label)
            first = text.split(';')[0]
            xs = tuple(sorted(numbers_after('x', first)))
            ys = numbers_after('y', text.split(';')[1]) if ';' in text else []
            require(len(ys) <= 1, 'One y-intercept at most')
            return xs, ys[0] if ys else None
        return finish(public, (tuple(zeros), y), parse)
    if question.startswith('Which lists all the vertical asymptotes'):
        def parse(label):
            text = plain(label)
            if text.startswith('There are no'):
                return ()
            return tuple(sorted(numbers_after('x', text)))
        return finish(public, tuple(asymptotes), parse)
    if question.startswith('What is the domain'):
        def parse(label):
            text = plain(label)
            require(text.startswith('All real numbers except'), 'Domain choices state the excluded values')
            return tuple(sorted(numbers_after('x', text)))
        return finish(public, tuple(excluded), parse)
    if question.startswith('For |, what is the horizontal asymptote'):
        top, bottom = power_sum(num), power_sum(den)
        expected = None if top > bottom else (Fraction(0) if top < bottom else num_c / den_c)

        def parse(label):
            text = plain(label)
            if text.startswith('There is no horizontal'):
                return None
            values = numbers_after('y', text)
            require(len(values) == 1, 'One horizontal asymptote value')
            return values[0]
        return finish(public, expected, parse)
    if 'has a hole. Which point is the hole' in question:
        require(len(holes) == 1, 'Exactly one hole required')
        hx = holes[0]
        expected = (Fraction(hx), reduced(hx))

        def parse(label):
            pair = re.fullmatch(r'\((.+),\s*(.+)\)', plain(label).strip())
            require(pair is not None, f'Point expected: {label}')
            return number(pair[1]), number(pair[2])
        return finish(public, expected, parse)
    raise ValueError('Unknown rational-function question')


# ------------------------------------------------------ graphical solutions
def table_rows(public):
    figure = public.get('figure')
    require(figure is not None and figure['kind'] == 'scene', 'Table figure required')
    tables = [e for e in figure['scene']['elements'] if e['type'] == 'table']
    require(len(tables) == 1 and tables[0]['columns'] == ['f(x)', 'g(x)'], 'One f,g table required')
    return [(number(r['label']), number(r['cells'][0]), number(r['cells'][1])) for r in tables[0]['rows']]


def roots_of_difference(f, g, low, high):
    """Sign-change scan on a fine grid, refined by bisection; exact zeros on the grid count once."""
    h = lambda t: float(f(Fraction(t)) - g(Fraction(t)))
    steps = round((high - low) * 400)
    roots, previous = [], h(low)
    if previous == 0:
        roots.append(float(low))
    for k in range(1, steps + 1):
        a, b = low + (k - 1) / 400, low + k / 400
        fa, fb = h(a), h(b)
        if fb == 0 and k != steps + 0 or fb == 0:
            roots.append(b)
        elif fa * fb < 0:
            lo_, hi_ = a, b
            for _ in range(60):
                mid = (lo_ + hi_) / 2
                if h(lo_) * h(mid) <= 0:
                    hi_ = mid
                else:
                    lo_ = mid
            roots.append((lo_ + hi_) / 2)
    return sorted(set(round(r, 9) for r in roots))


def solve_graphical(public):
    prompt = plain(public['prompt'])
    match = re.match(r'Let f\(x\)=(.+?) and g\(x\)=(.+?)\. (.*)', prompt)
    require(match is not None, 'f and g must be displayed')
    f = lambda t: evaluate(match[1], x=t)
    g = lambda t: evaluate(match[2], x=t)
    rows = table_rows(public)
    for t, fv, gv in rows:  # the figure must show the displayed functions
        require(f(t) == fv and g(t) == gv, 'Table disagrees with the displayed functions')
    require([r[0] for r in rows] == sorted({r[0] for r in rows}), 'Table inputs must increase')
    rest = match[3]
    low, high = float(rows[0][0]), float(rows[-1][0])
    roots = roots_of_difference(f, g, low, high)
    if rest.startswith("A solution of f(x)=g(x) lies in the table's range. Between which consecutive table inputs"):
        inside = [r for r in roots if low <= r <= high]
        require(len(inside) == 1, 'Exactly one solution must lie in the table range')
        intervals = [(rows[i][0], rows[i + 1][0]) for i in range(len(rows) - 1)]
        hit = [iv for iv in intervals if float(iv[0]) < inside[0] < float(iv[1])]
        require(len(hit) == 1 and inside[0] not in [float(r[0]) for r in rows], 'Solution must be strictly inside one step')

        def parse(label):
            pair = re.fullmatch(r'between x=(-?[\d.]+) and x=(-?[\d.]+)', plain(label))
            require(pair is not None, f'Interval expected: {label}')
            lo, hi = number(pair[1]), number(pair[2])
            require((lo, hi) in intervals, 'Choice must name consecutive table inputs')
            return lo, hi
        return finish(public, hit[0], parse)
    bracket = re.fullmatch(r"The table brackets a solution of f\(x\)=g\(x\) between x=(-?[\d.]+) and x=(-?[\d.]+)\. To the nearest tenth, what is the solution\?", rest)
    if bracket:
        lo, hi = float(number(bracket[1])), float(number(bracket[2]))
        require(rows[0][0] == number(bracket[1]) and rows[-1][0] == number(bracket[2]), 'Bracket must be the table ends')
        inside = [r for r in roots if lo < r < hi]
        require(len(inside) == 1, 'Exactly one solution in the bracket')
        scaled = inside[0] * 10
        require(abs(scaled - math.floor(scaled) - 0.5) > 1e-6, 'Rounding tie')
        expected = Fraction(round(scaled), 10)

        def parse(label):
            return number(label)
        return finish(public, expected, parse)
    if rest == 'The table shows their values. For which input x is f(x)=g(x)?':
        equal = [t for t, fv, gv in rows if fv == gv]
        require(len(equal) == 1, 'Exactly one table row has equal outputs')

        def parse(label):
            text = plain(label)
            return ('x', number(text[2:])) if text.startswith('x=') else ('other', text)
        return finish(public, ('x', equal[0]), parse)
    raise ValueError('Unknown graphical-solution question')


# ------------------------------------------------------------- identities
def solve_identity(public):
    prompt = plain(public['prompt'])
    triple = re.fullmatch(r'The identity \(x\^2\+y\^2\)\^2=\(x\^2-y\^2\)\^2\+\(2xy\)\^2 holds for all numbers x and y\. With x=(\d+) and y=(\d+), which describes a right triangle with these side lengths\?', prompt)
    if triple:
        x, y = int(triple[1]), int(triple[2])
        require(x > y > 0, 'Need x>y>0')
        expected = (tuple(sorted((x * x - y * y, 2 * x * y))), x * x + y * y)

        def parse(label):
            m = re.fullmatch(r'legs (\d+) and (\d+), hypotenuse (\d+)', plain(label))
            require(m is not None, f'Triangle description expected: {label}')
            a, b, c = int(m[1]), int(m[2]), int(m[3])
            return tuple(sorted((a, b))), c
        answer = finish(public, expected, parse)
        for option in public['response']['options']:  # only the keyed triangle may be right
            (a, b), c = parse(option['label'])
            require((a * a + b * b == c * c) == (option['id'] == answer), 'A distractor is also a right triangle')
        return answer
    sums = re.fullmatch(r'Suppose x\+y=(-?\d+) and xy=(-?\d+)\. What is x\^2\+y\^2\?', prompt)
    if sums:
        s, p = int(sums[1]), int(sums[2])
        return finish(public, Fraction(s * s - 2 * p), number)
    diff = re.fullmatch(r'Suppose x\+y=(-?\d+) and x-y=(-?\d+)\. What is x\^2-y\^2\?', prompt)
    if diff:
        return finish(public, Fraction(int(diff[1]) * int(diff[2])), number)
    product = re.fullmatch(r'Use an identity to find (\d+)\\times(\d+)\.', prompt)
    if product:
        a, b = int(product[1]), int(product[2])
        require((a + b) % 2 == 0 and abs(a - b) <= 20, 'Factors must straddle a round number')
        return finish(public, Fraction(a * b), number)
    square = re.fullmatch(r'Use an identity to find (\d+)\^2 without a calculator: write \1 as a sum or difference of a round number and a small one\.', prompt)
    if square:
        return finish(public, Fraction(int(square[1]) ** 2), number)
    if prompt == 'Which equation is true for every value of x?':
        def parse(label):
            left, right = plain(label).split('=')
            return all(evaluate(left, x=t) == evaluate(right, x=t) for t in range(-4, 6))
        # Truth value is not unique across distinct labels, so score each by evaluation.
        labels = [o['label'] for o in public['response']['options']]
        require(len({plain(label) for label in labels}) == 4, 'Duplicate equations')
        truths = [parse(label) for label in labels]
        require(sum(truths) == 1, 'Exactly one equation must be an identity')
        return public['response']['options'][truths.index(True)]['id']
    raise ValueError('Unknown identity question')


# ---------------------------------------------------------------- binomials
def solve_binomial(public):
    prompt = plain(public['prompt'])
    pascal = re.fullmatch(r"Pascal's triangle starts with row 0, which is 1; each later entry is the sum of the two entries above it\. Which row gives the coefficients in the expansion of \(x\+y\)\^\{(\d+)\}\?", prompt)
    if pascal:
        n = int(pascal[1])
        expected = tuple(math.comb(n, k) for k in range(n + 1))
        return finish(public, expected, lambda label: tuple(int(v) for v in re.findall(r'\d+', plain(label))))
    match = re.fullmatch(r'What is the (?:coefficient of x(?:\^\{(\d+)\})?|(constant) term) in the expansion of \((\d*)x([+-]\d+)\)\^\{(\d+)\}\?(?: Row (\d+) of Pascal\'s triangle is ([\d, \\]+)\.)?', prompt)
    require(match is not None, 'Unknown binomial question')
    k = 0 if match[2] else int(match[1] or 1)
    a = int(match[3]) if match[3] else 1
    b, n = int(match[4]), int(match[5])
    require(1 <= n <= 8 and 0 <= k <= n, 'Exponent range')
    if match[6]:
        shown = tuple(int(v) for v in re.findall(r'\d+', match[7]))
        require(int(match[6]) == n and shown == tuple(math.comb(n, j) for j in range(n + 1)), 'Displayed Pascal row is wrong')
    expected = math.comb(n, k) * a ** k * b ** (n - k)
    return finish(public, Fraction(expected), number)


# ---------------------------------------------------------- number-system closure
# A value is a dict {(radicand, pi_power): rational}; (1, 0) is the rational part.
def squarefree(n):
    outer, inner, d = 1, n, 2
    while d * d <= inner:
        while inner % (d * d) == 0:
            inner //= d * d
            outer *= d
        d += 1
    return outer, inner


def clean(value):
    return {k: v for k, v in value.items() if v != 0}


def add(a, b, sign=1):
    out = dict(a)
    for k, v in b.items():
        out[k] = out.get(k, Fraction(0)) + sign * v
    return clean(out)


def mul(a, b):
    out = {}
    for (r1, p1), v1 in a.items():
        for (r2, p2), v2 in b.items():
            outer, inner = squarefree(r1 * r2)
            key = (inner, p1 + p2)
            out[key] = out.get(key, Fraction(0)) + v1 * v2 * outer
    return clean(out)


def read_value(text):
    s = re.sub(r'\s+', '', plain(text)).replace('\\dfrac', '\\frac')
    tokens = re.findall(r'\\sqrt\{\d+\}|\\sqrt\d|\\frac\{\d+\}\{\d+\}|\\frac\d\d|\\pi|\\cdot|\d+(?:\.\d+)?|[()+\-]', s)
    require(''.join(tokens) == s, f'Cannot read number: {text}')
    position = 0

    def peek():
        return tokens[position] if position < len(tokens) else None

    def atom():
        nonlocal position
        token = tokens[position]
        position += 1
        if token == '-':
            return mul({(1, 0): Fraction(-1)}, atom())
        if token == '(':
            inner = expression()
            require(peek() == ')', 'Unclosed parenthesis')
            position += 1
            return inner
        if token == '\\pi':
            return {(1, 1): Fraction(1)}
        if token.startswith('\\sqrt'):
            n = int(re.sub(r'\D', '', token))
            outer, inner = squarefree(n)
            return clean({(inner, 0): Fraction(outer)})
        if token.startswith('\\frac'):
            digits = re.findall(r'\d+', token)
            top, bottom = (int(digits[0]), int(digits[1])) if len(digits) == 2 else (int(digits[0][0]), int(digits[0][1]))
            return {(1, 0): Fraction(top, bottom)}
        return clean({(1, 0): Fraction(token)})

    def term():
        nonlocal position
        value = atom()
        while peek() == '\\cdot':
            position += 1
            value = mul(value, atom())
        return value

    def expression():
        nonlocal position
        value = term()
        while peek() in ('+', '-'):
            sign = 1 if tokens[position] == '+' else -1
            position += 1
            value = add(value, term(), sign)
        return value
    value = expression()
    require(position == len(tokens), f'Trailing input in {text}')
    return value


def is_rational(value):
    return all(k == (1, 0) for k in value)


def rational_part(value):
    return value.get((1, 0), Fraction(0))


def solve_closure(public):
    prompt = plain(public['prompt'])
    zero_q = re.fullmatch(r'The number \\sqrt\{(\d+)\} is irrational\. For which rational number q is q\\cdot\\sqrt\{\1\} not irrational\?', prompt)
    if zero_q:
        root = read_value(f'\\sqrt{{{zero_q[1]}}}')
        require(not is_rational(root), 'Stated irrational number is rational')

        def parse(label):
            text = plain(label)
            require(text.startswith('q='), 'Value of q expected')
            return rational_part(read_value(text[2:]))
        answer = finish(public, Fraction(0), parse)
        for option in public['response']['options']:
            q = read_value(plain(option['label'])[2:])
            require(is_rational(mul(q, root)) == (option['id'] == answer), 'Product class disagrees with the key')
        return answer
    if prompt == 'A student claims: "The sum of two irrational numbers is always irrational." Which pair of numbers is a counterexample?':
        def parse(label):
            left, right = plain(label).split(' and ')
            a, b = read_value(left), read_value(right)
            return not is_rational(a) and not is_rational(b) and is_rational(add(a, b))
        labels = [o['label'] for o in public['response']['options']]
        require(len({plain(label) for label in labels}) == 4, 'Duplicate pairs')
        flags = [parse(label) for label in labels]
        require(sum(flags) == 1, 'Exactly one counterexample pair required')
        return public['response']['options'][flags.index(True)]['id']
    both = re.fullmatch(r'Both numbers in (.+) are irrational\. Is the result rational or irrational\?', prompt)
    single = re.fullmatch(r'The number \\sqrt\{(\d+)\} is irrational\. Is (.+) rational or irrational\?', prompt)
    require(both or single, 'Unknown closure question')
    expression = both[1] if both else single[2]
    if both:
        parts = re.fullmatch(r'(.+?)([+]|\\cdot)(.+)', expression)
        require(parts is not None, 'Two-operand expression expected')
        left, right = parts[1], parts[3]
        left = left if not left.startswith('(') else left[1:-1]
        right = right[1:-1] if right.startswith('(') and right.endswith(')') else right
        require(not is_rational(read_value(left)) and not is_rational(read_value(right)), 'Both operands must be irrational')
    else:
        require(not is_rational(read_value(f'\\sqrt{{{single[1]}}}')), 'Stated irrational number is rational')
    value = read_value(expression)
    rational = is_rational(value)
    options = public['response']['options']
    verdicts = []
    for option in options:
        text = plain(option['label'])
        if text.startswith('It cannot be decided'):
            verdicts.append('undecided')
        elif text.startswith('Rational: it equals'):
            claimed = read_value(re.sub(r'^Rational: it equals ', '', text).split(',')[0])
            verdicts.append(('rational', is_rational(value) and claimed == value))
        elif text.startswith('Rational:'):
            verdicts.append(('rational', False))  # reasoning-only rational claims are never sound here
        elif text.startswith('Irrational:'):
            verdicts.append(('irrational', not rational))
        else:
            raise ValueError(f'Unknown verdict: {text}')
    require(len(set(plain(o['label']) for o in options)) == 4, 'Duplicate choices')
    sound = [i for i, v in enumerate(verdicts) if v != 'undecided' and v[1]]
    require(len(sound) == 1, 'Exactly one sound option required')
    chosen = plain(options[sound[0]]['label'])
    if chosen.startswith('Irrational:'):
        # Reasoning must match the displayed givens, not just the verdict.
        sub = re.search(r'(?:subtracting|adding) (.+?) would make (.+?) rational', chosen)
        div = re.search(r'dividing by the nonzero rational factor would make (.+?) rational', chosen)
        if sub:
            r, i = read_value(sub[1]), read_value(sub[2])
            require(is_rational(r) and not is_rational(i) and add(r, i) == value, 'Subtraction reasoning disagrees with the sum')
        elif div:
            require(not is_rational(read_value(div[1])), 'Division reasoning must name the irrational factor')
        else:
            require(not both and 'still contains' not in chosen and 'closed under' not in chosen and 'it contains' not in chosen, 'Irrational option has no sound reason')
    return options[sound[0]]['id']


def solve(public):
    template = public['templateId']
    require(template in SUPPORTED, 'Unexpected function-behavior family')
    handler = {
        'polynomial-behavior-description': solve_polynomial,
        'rational-function-features': solve_rational,
        'graphical-solution-table': solve_graphical,
        'polynomial-identity-use': solve_identity,
        'binomial-coefficient': solve_binomial,
        'number-system-closure-classify': solve_closure,
        'polynomial-graph-match': solve_graph_match,
    }[template]
    if template not in ('graphical-solution-table', 'polynomial-graph-match'):
        require(public.get('figure') is None, 'Unexpected figure')
    return handler(public)


def leak_check(problem, key_label):
    text = plain(key_label).strip()
    require(len(text) < 4 or text not in plain(problem.get('hint', '')), 'Hint contains the keyed choice verbatim')
    require(len(text) < 12 or text not in plain(problem['public']['prompt']), 'Prompt contains the keyed choice verbatim')


def review_problem(problem):
    public = problem['public']
    result = solve(public)
    require(result == problem['answer'], 'Function behavior answer key mismatch')
    labels = {o['id']: o['label'] for o in public['response']['options']}
    leak_check(problem, labels[result])
    feedback = problem.get('choiceFeedback', {})
    require(set(feedback) == set(labels) - {result}, 'Feedback must cover exactly the distractors')
    return result


# --------------------------------------------------------------- self test
def fixture(template, prompt, options, answer_index, figure=None):
    public = {
        'templateId': template, 'prompt': prompt,
        'response': {'kind': 'choice', 'options': [{'id': f'option-{i}', 'label': label} for i, label in enumerate(options)]},
    }
    if figure is not None:
        public['figure'] = figure
    ids = [o['id'] for o in public['response']['options']]
    return {
        'public': public, 'answer': ids[answer_index], 'hint': 'Work it out.',
        'choiceFeedback': {i: 'Check again.' for k, i in enumerate(ids) if k != answer_index},
    }


def table(f_text, g_text, xs):
    return {'kind': 'scene', 'scene': {'v': 1, 'elements': [{
        'id': 't', 'type': 'table', 'columns': ['f(x)', 'g(x)'], 'corner': 'x', 'math': True,
        'rows': [{'label': str(x), 'cells': [str(evaluate(f_text, x=x)), str(evaluate(g_text, x=x))]} for x in xs],
    }]}}


def self_test():
    cases = []
    cases.append(fixture('polynomial-behavior-description',
        "Let $P(x)=-2(x+3)^{3}(x-3)^{2}$. Choose the description that matches the graph's end behavior and its behavior at each zero.",
        ['Rises on the left, falls on the right; crosses the $x$-axis at $x=3$; touches it at $x=-3$',
         'Falls on both the left and the right; crosses the $x$-axis at $x=-3$; touches it at $x=3$',
         'Rises on the left, falls on the right; crosses the $x$-axis at $x=-3$; touches it at $x=3$',
         'Falls on the left, rises on the right; crosses the $x$-axis at $x=-3$; touches it at $x=3$'], 2))
    cases.append(fixture('polynomial-behavior-description',
        'Let $P(x)=2(x+2)^{2}(x+1)^{2}(x-3)$. What is the greatest number of turning points that the graph of any polynomial with the same degree as $P$ can have? A turning point is where the graph changes from rising to falling or from falling to rising.',
        ['$3$', '$4$', '$5$', '$6$'], 1))
    cases.append(fixture('rational-function-features',
        'Which lists the $x$-intercepts and the $y$-intercept of the graph of $f(x)=\\dfrac{-2(x+1)(x+4)}{(x+1)(x-4)(x+3)}$?',
        ['$x$-intercept at $x=-4$; $y$-intercept at $y=-\\frac{2}{3}$', '$x$-intercepts at $x=-4$ and $x=-1$; $y$-intercept at $y=\\frac{2}{3}$',
         '$x$-intercept at $x=-4$; $y$-intercept at $y=\\frac{2}{3}$', '$x$-intercept at $x=4$; $y$-intercept at $y=\\frac{2}{3}$'], 2))
    cases.append(fixture('rational-function-features',
        'For $f(x)=\\dfrac{3(x+1)}{-(x+2)(x-3)}$, what is the horizontal asymptote of the graph?',
        ['There is no horizontal asymptote', '$y=-3$', '$y=0$', '$y=3$'], 2))
    cases.append(fixture('rational-function-features',
        'The graph of $f(x)=\\dfrac{-3(x-3)(x-1)}{(x-3)(x+4)}$ has a hole. Which point is the hole?',
        ['$(3, 6)$', '$(3, -\\frac{6}{7})$', '$(-4, 3)$', '$(1, 0)$'], 1))
    cases.append(fixture('graphical-solution-table',
        "Let $f(x)=x^2-4$ and $g(x)=-3x-1$. A solution of $f(x)=g(x)$ lies in the table's range. Between which consecutive table inputs does it lie?",
        ['between $x=1$ and $x=2$', 'between $x=-1$ and $x=0$', 'between $x=-2$ and $x=-1$', 'between $x=0$ and $x=1$'], 3,
        table('x^2-4', '-3x-1', [-2, -1, 0, 1, 2])))
    cases.append(fixture('graphical-solution-table',
        'Let $f(x)=x^2-5$ and $g(x)=2x-2$. The table shows their values. For which input $x$ is $f(x)=g(x)$?',
        ['$x=2$', '$y=4$', '$x=3$', '$x=4$'], 2, table('x^2-5', '2x-2', [0, 1, 2, 3, 4])))
    cases.append(fixture('polynomial-identity-use',
        'The identity $(x^2+y^2)^2=(x^2-y^2)^2+(2xy)^2$ holds for all numbers $x$ and $y$. With $x=5$ and $y=1$, which describes a right triangle with these side lengths?',
        ['legs $5$ and $24$, hypotenuse $26$', 'legs $10$ and $24$, hypotenuse $26$', 'legs $10$ and $26$, hypotenuse $24$', 'legs $10$ and $24$, hypotenuse $36$'], 1))
    cases.append(fixture('polynomial-identity-use', 'Suppose $x+y=3$ and $xy=-10$. What is $x^2+y^2$?',
        ['$29$', '$-11$', '$19$', '$9$'], 0))
    cases.append(fixture('polynomial-identity-use', 'Which equation is true for every value of $x$?',
        ['$(x-7)^2=x^{2} - 14x - 49$', '$(x-7)^2=x^{2} - 7x + 49$', '$(x-7)^2=x^{2} + 49$', '$(x-7)^2=x^{2} - 14x + 49$'], 3))
    cases.append(fixture('binomial-coefficient', 'What is the constant term in the expansion of $(2x+3)^{4}$?',
        ['$81$', '$1$', '$216$', '$16$'], 0))
    cases.append(fixture('binomial-coefficient',
        'What is the coefficient of $x^{2}$ in the expansion of $(x-4)^{6}$? Row 6 of Pascal\'s triangle is $1,\\ 6,\\ 15,\\ 20,\\ 15,\\ 6,\\ 1$.',
        ['$3840$', '$-3840$', '$240$', '$15$'], 0))
    cases.append(fixture('number-system-closure-classify',
        'The number $\\sqrt{10}$ is irrational. For which rational number $q$ is $q\\cdot\\sqrt{10}$ not irrational?',
        ['$q=-\\frac13$', '$q=0$', '$q=-1$', '$q=1$'], 1))
    cases.append(fixture('number-system-closure-classify',
        'A student claims: "The sum of two irrational numbers is always irrational." Which pair of numbers is a counterexample?',
        ['$\\sqrt{10}$ and $\\sqrt{2}$', '$\\sqrt{10}$ and $-\\sqrt{10}$', '$\\sqrt{121}$ and $\\sqrt{144}$', '$\\sqrt{10}$ and $\\frac34$'], 1))
    cases.append(fixture('number-system-closure-classify',
        'Both numbers in $\\sqrt{11}\\cdot\\sqrt{44}$ are irrational. Is the result rational or irrational?',
        ['Rational: it equals $22$', 'It cannot be decided: the result of combining two irrational numbers in general can be rational or irrational',
         'Irrational: it still contains $\\sqrt{11}$', 'Irrational: irrational numbers are closed under this operation'], 0))
    cases.append(fixture('number-system-closure-classify',
        'The number $\\sqrt{6}$ is irrational. Is $5+\\sqrt{6}$ rational or irrational?',
        ['Rational: $\\sqrt{6}\\approx2.449$ is a decimal, so the result is a decimal',
         'It cannot be decided: a rational number plus an irrational number can be rational or irrational',
         'Rational: adding the rational number $5$ gives a rational result',
         'Irrational: if the sum were rational, subtracting $5$ would make $\\sqrt{6}$ rational'], 3))

    def curve_figure(coefficients, points):
        return {'kind': 'scene', 'scene': {'v': 1, 'elements': [{
            'id': 'g', 'type': 'graph', 'x': [-4, 4], 'y': [-20, 20],
            'points': [{'x': x, 'y': 0, 'label': str(x)} for x in points],
            'curves': [{'fn': {'f': 'poly', 'c': coefficients}}]}]}}
    # -(x+1)(x-2)^2 = -x^3 + 3x^2 - 4  (ascending: -4, 0, 3, -1)
    cases.append(fixture('polynomial-graph-match',
        'The graph of a polynomial $P$ is shown. Its zeros are integers, and its leading coefficient is $1$ or $-1$. Which factored form gives this graph?',
        ['$P(x)=(x+1)(x-2)^{2}$', '$P(x)=-(x+1)(x-2)^{2}$', '$P(x)=-(x-1)(x+2)^{2}$', '$P(x)=-(x+1)^{2}(x-2)$'], 1,
        curve_figure([-4, 0, 3, -1], [-1, 2])))

    rejected = 0

    def reject(problem, why):
        nonlocal rejected
        try:
            review_problem(problem)
        except ValueError:
            rejected += 1
            return
        raise ValueError(f'Corrupt function-behavior case was accepted: {why}')
    for case in cases:
        review_problem(case)
        wrong = copy.deepcopy(case)
        wrong['answer'] = wrong['public']['response']['options'][(int(case['answer'][-1]) + 1) % 4]['id']
        reject(wrong, 'wrong key')
        # Make a distractor mathematically equal to the key: ambiguity or duplication must fail.
        clone = copy.deepcopy(case)
        options = clone['public']['response']['options']
        key = int(case['answer'][-1])
        options[(key + 1) % 4]['label'] = options[key]['label']
        reject(clone, 'duplicate key')
        # Missing feedback for a distractor must fail.
        thin = copy.deepcopy(case)
        thin['choiceFeedback'].pop(next(iter(thin['choiceFeedback'])))
        reject(thin, 'feedback gap')
        # Leaking the key into the hint must fail when the key is long enough to be a giveaway.
        key_label = plain(case['public']['response']['options'][key]['label'])
        if len(key_label) >= 4:
            leaky = copy.deepcopy(case)
            leaky['hint'] = f'The answer is {key_label}.'
            reject(leaky, 'hint leak')
    # Changed givens must move the key off the shown choice.
    shifted = copy.deepcopy(cases[0])
    shifted['public']['prompt'] = shifted['public']['prompt'].replace('(x+3)^{3}', '(x+3)^{2}')
    reject(shifted, 'changed multiplicity')
    shifted = copy.deepcopy(cases[2])
    shifted['public']['prompt'] = shifted['public']['prompt'].replace('(x+4)', '(x+5)')
    reject(shifted, 'changed zero')
    shifted = copy.deepcopy(cases[5])
    shifted['public']['figure']['scene']['elements'][0]['rows'][2]['cells'][0] = '99'
    reject(shifted, 'table disagrees with f')
    shifted = copy.deepcopy(cases[9])
    shifted['public']['response']['options'][0]['label'] = '$(x-7)^2=x^{2} - 14x + 49$'
    reject(shifted, 'two identities')
    shifted = copy.deepcopy(cases[11])
    shifted['public']['prompt'] = shifted['public']['prompt'].replace('1,\\ 6,\\ 15,\\ 20', '1,\\ 6,\\ 16,\\ 20')
    reject(shifted, 'wrong displayed Pascal row')
    shifted = copy.deepcopy(cases[14])
    shifted['public']['prompt'] = shifted['public']['prompt'].replace('\\sqrt{11}\\cdot\\sqrt{44}', '\\sqrt{11}\\cdot\\sqrt{45}')
    reject(shifted, 'product changed')
    shifted = copy.deepcopy(cases[-1])
    shifted['public']['figure']['scene']['elements'][0]['curves'][0]['fn']['c'] = [4, 0, -3, 1]
    reject(shifted, 'plotted curve changed')
    shifted = copy.deepcopy(cases[-1])
    shifted['public']['figure']['scene']['elements'][0]['points'].pop()
    reject(shifted, 'zero left unmarked')
    return {'fixtures': len(cases), 'rejectedMutations': rejected}


if __name__ == '__main__':
    print(self_test())
