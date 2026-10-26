"""Independent review of 3x3 systems, quadratic inequalities, conditionals, cube-root
equations, polar graphs and cone sections.

Everything is derived from the public payload (prompt and choices). Exact Fractions are
used throughout; only the polar symmetry and maximum-distance checks sample the curve
numerically, with a stated tolerance, as a cross-check that does not reuse any rule.
"""
import itertools
import math
import re
from fractions import Fraction

SUPPORTED = frozenset({
    'gauss-3x3-solve', 'quadratic-inequality-interval', 'conditional-statements',
    'cube-root-equation', 'polar-graph-identify', 'cone-section-name',
})
CHOICE = SUPPORTED


def require(condition, message):
    if not condition:
        raise ValueError(message)


def plain(text):
    text = text.replace('\u2212', '-').replace('\\dfrac', '\\frac').replace('\\geq', '\\ge').replace('\\leq', '\\le')
    text = re.sub(r'\\(left|right)(?![a-zA-Z])', '', text).replace('\\,', '')
    return text.replace('$', '')


def squash(text):
    return re.sub(r'\s+', '', plain(text))


def options_of(public):
    response = public['response']
    require(response['kind'] == 'choice', 'Expected a choice response')
    options = response['options']
    require(len(options) == 4 and all(set(o) == {'id', 'label'} for o in options), 'Four public choices required')
    require(len({o['id'] for o in options}) == 4, 'Duplicate choice IDs')
    return options


def pick(options, keys, expected_key, what):
    require(len(set(keys)) == 4, f'Mathematically duplicate {what} choices')
    matches = [o['id'] for o, k in zip(options, keys) if k == expected_key]
    require(len(matches) == 1, f'Missing or ambiguous {what} answer')
    return matches[0]


# ------------------------------------------------------------------ 3x3 systems
VARS = 'xyz'


def parse_linear(side):
    """Return ({var: coefficient}, constant) for an expression like '2x - y + 3'."""
    text = squash(side)
    require(text != '', 'Empty expression')
    coeffs = {v: Fraction(0) for v in VARS}
    const = Fraction(0)
    tokens = re.findall(r'[+-]?[^+-]+', text)
    require(''.join(tokens) == text, f'Unparsed expression {side}')
    for token in tokens:
        m = re.fullmatch(r'([+-]?)(\d*)([xyz]?)', token)
        require(m is not None and (m[2] or m[3]), f'Bad term {token}')
        sign = -1 if m[1] == '-' else 1
        if m[3]:
            coeffs[m[3]] += sign * (int(m[2]) if m[2] else 1)
        else:
            const += sign * int(m[2])
    return coeffs, const


def parse_system(prompt):
    m = re.search(r'\\begin\{cases\}(.*?)\\end\{cases\}', prompt, re.S)
    require(m is not None, 'System of equations missing')
    rows = []
    for line in m[1].split('\\\\'):
        left, right = plain(line).split('=')
        lc, lk = parse_linear(left)
        rc, rk = parse_linear(right)
        rows.append(([lc[v] - rc[v] for v in VARS], rk - lk))
    require(len(rows) == 3, 'Three equations required')
    return rows


def rank(matrix):
    m = [row[:] for row in matrix]
    r = 0
    for c in range(len(m[0])):
        piv = next((i for i in range(r, len(m)) if m[i][c] != 0), None)
        if piv is None:
            continue
        m[r], m[piv] = m[piv], m[r]
        for i in range(len(m)):
            if i != r and m[i][c] != 0:
                f = m[i][c] / m[r][c]
                m[i] = [a - f * b for a, b in zip(m[i], m[r])]
        r += 1
    return r


def solve_unique(rows):
    a = [r[0][:] + [r[1]] for r in rows]
    n = 3
    for c in range(n):
        piv = next((i for i in range(c, n) if a[i][c] != 0), None)
        require(piv is not None, 'System does not have a unique solution')
        a[c], a[piv] = a[piv], a[c]
        a[c] = [v / a[c][c] for v in a[c]]
        for i in range(n):
            if i != c and a[i][c] != 0:
                f = a[i][c]
                a[i] = [x - f * y for x, y in zip(a[i], a[c])]
    return tuple(a[i][3] for i in range(n))


def solve_gauss(public):
    prompt = plain(public['prompt'])
    options = options_of(public)
    labels = [o['label'] for o in options]
    rows = parse_system(public['prompt'])
    row_op = re.search(r'eliminates ([xyz]) from equation (\d) using equation (\d)', prompt)
    if row_op:
        var, target, source = row_op[1], int(row_op[2]), int(row_op[3])
        require(target != source and {target, source} <= {1, 2, 3}, 'Bad equation indices')
        vi = VARS.index(var)
        ci, cj = rows[source - 1][0][vi], rows[target - 1][0][vi]
        require(ci != 0, 'Source equation lacks the variable to eliminate')
        keys = []
        for label in labels:
            m = re.fullmatch(rf'R_{target}\\toR_{target}([+-])(\d*)R_{source}', squash(label))
            require(m is not None, f'Unparseable row operation {label}')
            k = (-1 if m[1] == '-' else 1) * (int(m[2]) if m[2] else 1)
            keys.append(cj + k * ci == 0)
        require(keys.count(True) == 1, 'Exactly one row operation must eliminate the variable')
        require(len({squash(x) for x in labels}) == 4, 'Duplicate row operations')
        return options[keys.index(True)]['id']
    if 'How many solutions' in prompt:
        a = [r[0] for r in rows]
        aug = [r[0] + [r[1]] for r in rows]
        ra, rb = rank(a), rank(aug)
        if rb > ra:
            expected = 'No solution'
        elif ra == 3:
            expected = 'Exactly one solution'
        else:
            expected = 'Infinitely many solutions'
        return pick(options, [l.strip() for l in labels], expected, 'solution-count')
    require('ordered triple' in prompt, 'Unknown system question')
    solution = solve_unique(rows)
    keys = []
    for label in labels:
        m = re.fullmatch(r'\((-?\d+),(-?\d+),(-?\d+)\)', squash(label))
        require(m is not None, f'Unparseable triple {label}')
        keys.append(tuple(Fraction(int(g)) for g in m.groups()))
    return pick(options, keys, solution, 'ordered-triple')


def review_gauss_explanation(problem):
    prompt = plain(problem['public']['prompt'])
    row_op = re.search(r'eliminates ([xyz]) from equation (\d) using equation (\d)', prompt)
    if not row_op:
        return
    rows = parse_system(problem['public']['prompt'])
    target, source = int(row_op[2]), int(row_op[3])
    option = next(o for o in problem['public']['response']['options'] if o['id'] == problem['answer'])
    m = re.fullmatch(rf'R_{target}\\toR_{target}([+-])(\d*)R_{source}', squash(option['label']))
    k = (-1 if m[1] == '-' else 1) * (int(m[2]) if m[2] else 1)
    new = [a + k * b for a, b in zip(rows[target - 1][0], rows[source - 1][0])]
    const = rows[target - 1][1] + k * rows[source - 1][1]
    text = ' '.join(plain(s) for s in problem['explanation'])
    m = re.search(r'leaving ([^=]+?) = (-?\d+)', text)
    if m:
        coeffs, c0 = parse_linear(m[1])
        require([coeffs[v] for v in VARS] == new and Fraction(int(m[2])) == const - 0 and c0 == 0,
                'Row-operation explanation states a wrong resulting equation')


# --------------------------------------------------------- quadratic inequalities
def parse_quadratic(side):
    text = squash(side)
    tokens = re.findall(r'[+-]?[^+-]+', text)
    require(''.join(tokens) == text, f'Unparsed polynomial {side}')
    co = [Fraction(0)] * 3
    for token in tokens:
        m = re.fullmatch(r'([+-]?)(\d*)(x\^2|x)?', token)
        require(m is not None and (m[2] or m[3]), f'Bad term {token}')
        sign = -1 if m[1] == '-' else 1
        value = sign * (int(m[2]) if m[2] else 1)
        co[{None: 0, 'x': 1, 'x^2': 2}[m[3]]] += value
    return co


def exact_sqrt(q):
    q = Fraction(q)
    require(q >= 0, 'Negative discriminant has no root')
    n, d = math.isqrt(q.numerator), math.isqrt(q.denominator)
    require(n * n == q.numerator and d * d == q.denominator, 'Irrational endpoints unsupported')
    return Fraction(n, d)


def normalise(intervals):
    """Merge a list of (lo, lo_incl, hi, hi_incl); None means infinity."""
    def lo_key(i):
        return (-math.inf if i[0] is None else i[0], 0 if i[1] else 1)
    items = sorted(intervals, key=lo_key)
    out = []
    for lo, lic, hi, hic in items:
        if out:
            plo, plic, phi, phic = out[-1]
            touching = phi is None or lo is None or phi > lo or (phi == lo and (phic or lic))
            if touching:
                if phi is None or (hi is not None and (phi > hi or (phi == hi and phic))):
                    continue
                out[-1] = (plo, plic, hi, hic)
                continue
        out.append((lo, lic, hi, hic))
    return tuple(out)


def expected_quadratic_set(co, op):
    c, b, a = co
    require(a != 0, 'Not a quadratic')
    disc = b * b - 4 * a * c

    def holds(value):
        return {'<': value < 0, '>': value > 0, '\\le': value <= 0, '\\ge': value >= 0}[op]

    def f(x):
        return a * x * x + b * x + c

    if disc < 0:
        roots = []
    else:
        s = exact_sqrt(disc)
        roots = sorted({(-b - s) / (2 * a), (-b + s) / (2 * a)})
    pieces = []
    bounds = [None] + roots + [None]
    for i in range(len(bounds) - 1):
        lo, hi = bounds[i], bounds[i + 1]
        if lo is None and hi is None:
            test = Fraction(0)
        elif lo is None:
            test = hi - 1
        elif hi is None:
            test = lo + 1
        else:
            test = (lo + hi) / 2
        if holds(f(test)):
            pieces.append((lo, False, hi, False))
        if i + 1 < len(bounds) - 1 and holds(Fraction(0)):
            pieces.append((hi, True, hi, True))
    return normalise(pieces)


def parse_interval_set(label):
    text = squash(label)
    if text == 'Norealsolution':
        return ()
    m = re.fullmatch(r'\\\{(-?\d+)\\\}', text)
    if m:
        v = Fraction(int(m[1]))
        return ((v, True, v, True),)
    pieces = []
    for part in text.split('\\cup'):
        m = re.fullmatch(r'([\[(])(-\\infty|-?\d+),(\\infty|-?\d+)([\])])', part)
        require(m is not None, f'Unparseable interval {label}')
        lo = None if m[2] == '-\\infty' else Fraction(int(m[2]))
        hi = None if m[3] == '\\infty' else Fraction(int(m[3]))
        require(lo is not None or m[1] == '(', 'Infinite endpoint must be open')
        require(hi is not None or m[4] == ')', 'Infinite endpoint must be open')
        require(lo is None or hi is None or lo < hi or (lo == hi and m[1] == '[' and m[4] == ']'), 'Interval is not ordered')
        pieces.append((lo, m[1] == '[', hi, m[4] == ']'))
    return normalise(pieces)


def solve_quadratic_inequality(public):
    prompt = plain(public['prompt'])
    m = re.match(r'Solve (.+?) (<|>|\\le|\\ge) (.+?)(?: over the real numbers\. Choose the solution set\.|\. Write the solution set in interval notation\.)$', prompt)
    require(m is not None, 'Inequality prompt not recognised')
    left, right = parse_quadratic(m[1]), parse_quadratic(m[3])
    co = [x - y for x, y in zip(left, right)]
    expected = expected_quadratic_set(co, m[2])
    options = options_of(public)
    keys = [parse_interval_set(o['label']) for o in options]
    if 'interval notation' in prompt:
        require(all(k and not (len(k) == 1 and k[0][0] == k[0][2] and k[0][0] is not None) for k in keys),
                'Interval-notation prompt offers non-interval answers')
    return pick(options, keys, expected, 'inequality')


# --------------------------------------------------------------- conditionals
def parse_formula(text):
    tokens = re.findall(r'\\leftrightarrow|\\land|\\lor|\\neg|\\to|\(|\)|[PQR]', plain(text))
    require(''.join(tokens) == squash(text), f'Unparsed formula {text}')
    pos = 0

    def operand():
        nonlocal pos
        require(pos < len(tokens), 'Truncated formula')
        t = tokens[pos]
        pos += 1
        if t == '\\neg':
            inner = operand()
            return ('not', inner)
        if t == '(':
            inner = sequence()
            require(pos < len(tokens) and tokens[pos] == ')', 'Missing parenthesis')
            pos += 1
            return inner
        require(t in 'PQR' and len(t) == 1, f'Unexpected token {t}')
        return ('var', t)

    def sequence():
        nonlocal pos
        first = operand()
        ops, args = [], [first]
        while pos < len(tokens) and tokens[pos] in ('\\land', '\\lor', '\\to', '\\leftrightarrow'):
            ops.append(tokens[pos])
            pos += 1
            args.append(operand())
        if not ops:
            return first
        require(len(set(ops)) == 1 and ops[0] in ('\\land', '\\lor') or len(ops) == 1,
                'Ambiguous unparenthesised connectives')
        node = args[0]
        for op, arg in zip(ops, args[1:]):
            node = (op, node, arg)
        return node

    tree = sequence()
    require(pos == len(tokens), 'Trailing formula tokens')
    return tree


def evaluate(node, env):
    kind = node[0]
    if kind == 'var':
        return env[node[1]]
    if kind == 'not':
        return not evaluate(node[1], env)
    a, b = evaluate(node[1], env), evaluate(node[2], env)
    return {'\\land': a and b, '\\lor': a or b, '\\to': (not a) or b, '\\leftrightarrow': a == b}[kind]


def truth_signature(node, names='PQR'):
    return tuple(evaluate(node, dict(zip(names, values))) for values in itertools.product((False, True), repeat=len(names)))


FACTS = {
    ('a polygon is a hexagon', 'the polygon has six sides'): (True, True),
    ('a whole number is a multiple of 10', 'the number is divisible by both 2 and 5'): (True, True),
    ('an angle is a right angle', 'the angle measures 90°'): (True, True),
    ('a triangle has three congruent sides', 'the triangle has three congruent angles'): (True, True),
    ('a triangle is equilateral', 'the triangle is isosceles'): (True, False),
    ('a quadrilateral is a square', 'the quadrilateral is a rectangle'): (True, False),
    ('a quadrilateral is a rhombus', 'the diagonals of the quadrilateral are perpendicular'): (True, False),
    ('a number is divisible by 6', 'the number is even'): (True, False),
    ('an integer ends in 0', 'the integer is divisible by 5'): (True, False),
    ('two angles are vertical angles', 'the two angles are congruent'): (True, False),
}


def fact_pair(h, c):
    if (h, c) in FACTS:
        return FACTS[(h, c)]
    require((c, h) in FACTS, f'Unknown geometric/number fact: {h} / {c}')
    orig, conv = FACTS[(c, h)]
    return conv, orig


def negate_phrase(phrase):
    rules = [(' is ', ' is not '), (' are ', ' are not '), (' has ', ' does not have '),
             (' ends ', ' does not end '), (' measures ', ' does not measure ')]
    best = None
    for old, new in rules:
        i = phrase.find(old)
        if i >= 0 and (best is None or i < best[0]):
            best = (i, old, new)
    require(best is not None, f'Cannot negate phrase {phrase}')
    i, old, new = best
    return phrase[:i] + new + phrase[i + len(old):]


def fold(text):
    text = plain(text).strip()
    return text[:1].lower() + text[1:]


def split_conditional(sentence):
    m = re.fullmatch(r'If (.+?), then (.+?)\.', sentence)
    require(m is not None, f'Not an if-then sentence: {sentence}')
    return fold(m[1]), fold(m[2])


def solve_conditional(public):
    prompt = plain(public['prompt'])
    options = options_of(public)
    labels = [o['label'] for o in options]
    m = re.match(r'Suppose P is (true|false), Q is (true|false) and R is (true|false)\. Which of these statements is (true|false)\?$', prompt)
    if m:
        env = {'P': m[1] == 'true', 'Q': m[2] == 'true', 'R': m[3] == 'true'}
        wanted = m[4] == 'true'
        trees = [parse_formula(l) for l in labels]
        # Equivalent distractors (e.g. exportation) are allowed: both carry the same truth value,
        # so at most one choice can have the asked-for value. Textual duplicates are not.
        require(len({squash(l) for l in labels}) == 4, 'Duplicate statements offered')
        keys = [evaluate(t, env) == wanted for t in trees]
        require(keys.count(True) == 1, 'Exactly one statement must have the asked truth value')
        return options[keys.index(True)]['id']
    m = re.match(r'Let P be “(.+?)” and Q be “(.+?)”\. Both P \\to Q and its converse Q \\to P are true\. Which single statement says exactly this\?$', prompt)
    if m:
        h, c = fold(m[1]), fold(m[2])
        require(fact_pair(h, c) == (True, True), 'Biconditional claim is not true of the stated phrases')
        target = truth_signature(('\\leftrightarrow', ('var', 'P'), ('var', 'Q')), 'PQ')
        keys = []
        for label in labels:
            first = re.match(r'\$([^$]+)\$', label)
            require(first is not None, f'Unparseable connective choice {label}')
            tree = parse_formula(first[1])
            words = {'\\leftrightarrow': 'if and only if', '\\lor': ' or ', '\\land': 'both true', '\\to': 'then not'}
            require(words[tree[0]] in label, f'Parenthetical wording disagrees with formula in {label}')
            keys.append(truth_signature(tree, 'PQ') == target)
        require(len({squash(l) for l in labels}) == 4, 'Duplicate connective choices')
        require(keys.count(True) == 1, 'Exactly one connective must express the biconditional')
        return options[keys.index(True)]['id']
    m = re.match(r'Which statement is the (converse|inverse|contrapositive|negation) of “(.+?)”\?$', prompt)
    must = re.match(r'The statement “(.+?)” is true\. Which of these statements must also be true\?$', prompt)
    require(m or must, 'Conditional prompt not recognised')
    h, c = split_conditional(m[2] if m else must[1])
    orig, conv = fact_pair(h, c)
    require(orig, 'The given statement must be true')
    nh, nc = negate_phrase(h), negate_phrase(c)
    kind = m[1] if m else 'contrapositive'
    if must:
        require(not conv, 'A must-be-true question needs a false converse so only the contrapositive follows')
    expected = {
        'converse': f'if {c}, then {h}.',
        'inverse': f'if {nh}, then {nc}.',
        'contrapositive': f'if {nc}, then {nh}.',
        'negation': f'{h} and {nc}.',
    }[kind]
    keys = [fold(l) for l in labels]
    known = {f'if {x}, then {y}.' for x in (h, c, nh, nc) for y in (h, c, nh, nc)}
    known |= {f'{x} and {y}.' for x in (h, nh) for y in (c, nc)}
    require(all(k in known for k in keys), 'Choice is not a recognised transform of the statement')
    return pick(options, keys, expected, 'conditional')


# --------------------------------------------------------------- cube-root equations
def parse_rational(text):
    m = re.fullmatch(r'(-?)\\frac\{(\d+)\}\{(\d+)\}', text)
    if m:
        return (-1 if m[1] else 1) * Fraction(int(m[2]), int(m[3]))
    require(re.fullmatch(r'-?\d+', text) is not None, f'Bad number {text}')
    return Fraction(int(text))


def real_cuberoot(q):
    q = Fraction(q)
    sign = -1 if q < 0 else 1
    n, d = round(abs(q.numerator) ** (1 / 3)), round(q.denominator ** (1 / 3))
    for dn in (-1, 0, 1):
        for dd in (-1, 0, 1):
            if n + dn > 0 and d + dd > 0 and Fraction((n + dn) ** 3, (d + dd) ** 3) == abs(q):
                return sign * Fraction(n + dn, d + dd)
    raise ValueError(f'{q} is not a perfect rational cube')


def cube_root_solution(text):
    """Solve  cbrt(ax+b) +/- c = d  exactly (text already squashed, no $)."""
    m = re.fullmatch(r'\\sqrt\[3\]\{([^}]*)\}(?:([+-])(\d+))?=(-?\d+)', text)
    require(m is not None, 'Cube-root equation not recognised')
    lin = parse_linear(m[1])
    a, b = lin[0]['x'], lin[1]
    require(a != 0 and lin[0]['y'] == 0 and lin[0]['z'] == 0, 'Radicand must be linear in x')
    shift = 0 if m[2] is None else (int(m[3]) if m[2] == '+' else -int(m[3]))
    u = Fraction(int(m[4])) - shift
    return (u ** 3 - b) / a, a, b, shift, Fraction(int(m[4]))


def solve_cube_root(public):
    prompt = plain(public['prompt'])
    options = options_of(public)
    labels = [o['label'] for o in options]
    m = re.fullmatch(r'Solve (.+?) for real x\.', prompt)
    if m:
        x = cube_root_solution(re.sub(r'\s+', '', m[1]))[0]
        keys = []
        for label in labels:
            t = squash(label)
            keys.append('none' if t == 'Norealsolution' else parse_rational(re.fullmatch(r'x=(.+)', t)[1]))
        return pick(options, keys, x, 'cube-root')
    m = re.fullmatch(r'Find all real solutions of (.+?)\. Choose the complete solution set\.', prompt)
    if m:
        t = re.sub(r'\s+', '', m[1])
        mm = re.fullmatch(r'(-?\d*)x\^3(?:([+-])(\d+))?=(-?\d+)', t)
        require(mm is not None, 'Cubic not recognised')
        a = {'': 1, '-': -1}.get(mm[1], None)
        a = Fraction(int(mm[1])) if a is None else Fraction(a)
        b = 0 if mm[2] is None else (int(mm[3]) if mm[2] == '+' else -int(mm[3]))
        root = real_cuberoot((Fraction(int(mm[4])) - b) / a)
        keys = []
        for label in labels:
            s = squash(label)
            sm = re.fullmatch(r'\\\{(.+)\\\}', s)
            require(sm is not None, f'Unparseable set {label}')
            keys.append(frozenset(parse_rational(p) for p in sm[1].split(',')))
        return pick(options, keys, frozenset({root}), 'real-cubic')
    m = re.fullmatch(r'To solve (.+?) a student cubes both sides and gets x=(-?\d+)\. Which statement is correct\?', prompt)
    require(m is not None, 'Cube-root prompt not recognised')
    x, a, b, shift, rhs = cube_root_solution(re.sub(r'\s+', '', m[1]))
    cand = Fraction(int(m[2]))
    require(cand == x, 'Student candidate differs from the true solution')
    radicand = a * cand + b
    keys = []
    for label in labels:
        t = squash(label)
        sm = re.fullmatch(r'x=(-?\d+)isasolution,because\\sqrt\[3\]\{(-?\d+)\}=(-?\d+)\.', t)
        if sm:
            ok = Fraction(int(sm[1])) == cand and Fraction(int(sm[2])) == radicand and real_cuberoot(radicand) == Fraction(int(sm[3]))
            keys.append('true' if ok else 'wrong-solution')
        elif re.fullmatch(r'x=-?\d+isextraneous,because.*', t) or re.fullmatch(r'Theequationhastwosolutions,x=-?\d+andx=-?\d+\.', t):
            keys.append('false-claim:' + t)  # a real cube root is defined for every real number; neither claim holds
        else:
            raise ValueError(f'Unrecognised cube-root claim {label}')
    require(keys.count('true') == 1, 'Exactly one claim must be the true statement')
    require(len(set(keys)) == 4, 'Duplicate claims')
    return options[keys.index('true')]['id']


# ------------------------------------------------------------------ polar graphs
def parse_polar(expr):
    s = re.sub(r'\s+', '', plain(expr))
    if s.startswith('r='):
        s = s[2:]
    m = re.fullmatch(r'\\theta=(?:\\frac\{(\d*)\\pi\}\{(\d+)\}|\\pi)', s)
    if m:
        return ('line',)
    if re.fullmatch(r'-?\d+', s):
        return ('const', abs(int(s)))
    m = re.fullmatch(r'(-?\d*)\\(sin|cos)\((\d+)\\theta\)', s)
    if m:
        a = {'': 1, '-': -1}.get(m[1]) or int(m[1])
        require(int(m[3]) >= 2, 'Rose multiplier must be at least 2')
        return ('rose', a, m[2], int(m[3]))
    m = re.fullmatch(r'(-?\d*)\\(sin|cos)\\theta', s)
    if m:
        a = {'': 1, '-': -1}.get(m[1]) or int(m[1])
        return ('circle', a, m[2])
    m = re.fullmatch(r'(-?\d+)([+-])(\d*)\\(sin|cos)\\theta', s)
    require(m is not None, f'Polar equation not recognised: {expr}')
    b = int(m[3]) if m[3] else 1
    return ('limacon', int(m[1]), -b if m[2] == '-' else b, m[4])


def polar_function(spec):
    kind = spec[0]
    fn = {'sin': math.sin, 'cos': math.cos}
    if kind == 'limacon':
        return lambda t: spec[1] + spec[2] * fn[spec[3]](t)
    if kind == 'rose':
        return lambda t: spec[1] * fn[spec[2]](spec[3] * t)
    if kind == 'circle':
        return lambda t: spec[1] * fn[spec[2]](t)
    if kind == 'const':
        return lambda t: spec[1]
    raise ValueError('No radial function')


def on_curve(f, x, y, tol=1e-9):
    rho = math.hypot(x, y)
    phi = math.atan2(y, x)
    if rho < 1e-12:
        return min(abs(f(t)) for t in [i * math.pi / 720 for i in range(1441)]) < 1e-6
    return abs(f(phi) - rho) < tol or abs(f(phi + math.pi) + rho) < tol


def symmetries(spec):
    f = polar_function(spec)
    result = {'axis': True, 'yaxis': True, 'pole': True}
    for i in range(720):
        t = 2 * math.pi * (i + 0.37) / 720
        r = f(t)
        x, y = r * math.cos(t), r * math.sin(t)
        result['axis'] &= on_curve(f, x, -y)
        result['yaxis'] &= on_curve(f, -x, y)
        result['pole'] &= on_curve(f, -x, -y)
    return result


def solve_polar(public):
    prompt = plain(public['prompt'])
    options = options_of(public)
    labels = [o['label'].strip() for o in options]
    m = re.fullmatch(r'How many petals does the graph of (.+?) have\?', prompt)
    if m:
        spec = parse_polar(m[1])
        require(spec[0] == 'rose', 'Petal question needs a rose')
        n = spec[3]
        petals = n if n % 2 else 2 * n
        keys = []
        for l in labels:
            pm = re.fullmatch(r'(\d+) petals', l)
            require(pm is not None, f'Bad petal label {l}')
            keys.append(int(pm[1]))
        return pick(options, keys, petals, 'petal-count')
    m = re.fullmatch(r'The graph of (.+?) is symmetric about which of these\?', prompt)
    if m:
        spec = parse_polar(m[1])
        require(spec[0] == 'limacon', 'Symmetry question expects a limacon')
        sym = symmetries(spec)
        names = {'The polar axis (the x-axis)': 'axis', 'The line \\theta=\\frac{\\pi}{2} (the y-axis)': 'yaxis',
                 'The pole (the origin)': 'pole'}
        true_set = {k for k, v in sym.items() if v}
        keys = []
        for l in labels:
            if l == 'None of these':
                keys.append('none' if not true_set else 'wrong-none')
            else:
                name = names.get(plain(l).strip())
                require(name is not None, f'Unknown symmetry label {l}')
                keys.append(name if name in true_set else 'false:' + name)
        want = 'none' if not true_set else None
        if want:
            return pick(options, keys, want, 'symmetry')
        require(len(true_set) == 1, 'More than one symmetry holds; the question is ambiguous')
        return pick(options, keys, next(iter(true_set)), 'symmetry')
    m = re.fullmatch(r'What is the greatest distance from the pole to a point on the graph of (.+?)\?', prompt)
    if m:
        spec = parse_polar(m[1])
        f = polar_function(spec)
        numeric = max(abs(f(2 * math.pi * i / 36000)) for i in range(36001))
        exact = {'limacon': lambda: abs(spec[1]) + abs(spec[2]), 'rose': lambda: abs(spec[1]), 'circle': lambda: abs(spec[1]),
                 'const': lambda: spec[1]}[spec[0]]()
        require(abs(numeric - exact) < 1e-3, 'Numeric and exact maxima disagree')
        keys = [Fraction(int(l)) for l in labels]
        return pick(options, keys, Fraction(exact), 'maximum-distance')
    m = re.fullmatch(r'Which description matches the graph of (.+?)\?', prompt)
    require(m is not None, 'Polar prompt not recognised')
    spec = parse_polar(m[1])
    kind = spec[0]
    if kind == 'line':
        expected = 'A line through the pole'
    elif kind == 'const':
        expected = 'A circle centered at the pole'
    elif kind == 'circle':
        expected = 'A circle that passes through the pole'
    elif kind == 'rose':
        expected = 'A rose'
    else:
        a, b = abs(spec[1]), abs(spec[2])
        expected = 'A cardioid' if a == b else ('A limaçon with an inner loop' if a < b else 'A limaçon without an inner loop')
    return pick(options, labels, expected, 'polar-description')


# ------------------------------------------------------------------ cone sections
def classify_cone(alpha, beta, vertex):
    if vertex:
        return 'A single point' if beta > alpha else ('A single line' if beta == alpha else 'Two intersecting lines')
    if beta == 90:
        return 'A circle'
    if beta > alpha:
        return 'An ellipse'
    return 'A parabola' if beta == alpha else 'A hyperbola'


def solve_cone(public):
    prompt = plain(public['prompt'])
    options = options_of(public)
    labels = [o['label'].strip() for o in options]
    m = re.fullmatch(r'The sides of a double cone make an angle of (\d+)° with its axis\. A plane that does not pass through the vertex cuts the cone at (\d+)° to the axis\. What curve is the intersection\?', prompt)
    if m:
        return pick(options, labels, classify_cone(int(m[1]), int(m[2]), False), 'cone-section')
    m = re.fullmatch(r'The sides of a double cone make an angle of (\d+)° with its axis\. A plane passes through the vertex and makes an angle of (\d+)° with the axis\. What is the intersection\?', prompt)
    if m:
        return pick(options, labels, classify_cone(int(m[1]), int(m[2]), True), 'cone-section')
    m = re.fullmatch(r'The sides of a double cone make an angle of (\d+)° with its axis\. A plane that does not pass through the vertex cuts the cone\. The plane makes an angle \\beta with the axis \(0\^\\circ means parallel to the axis, 90\^\\circ means perpendicular\)\. For which value of \\beta is the intersection an? (hyperbola|ellipse|circle|parabola)\?', prompt)
    if m:
        alpha = int(m[1])
        want = 'A' + ('n ' if m[2] == 'ellipse' else ' ') + m[2]
        keys = []
        for l in labels:
            lm = re.fullmatch(r'(\d+)°', l)
            require(lm is not None, f'Bad angle label {l}')
            keys.append(int(lm[1]))
        matches = [o['id'] for o, k in zip(options, keys) if classify_cone(alpha, k, False) == want]
        require(len(set(keys)) == 4, 'Duplicate angle choices')
        require(len(matches) == 1, 'Exactly one angle must give the named curve')
        return matches[0]
    fixed = {
        'A plane cuts only one nappe of a double cone in a closed curve, but is not perpendicular to the axis. What curve is the intersection?': 'An ellipse',
        'A plane perpendicular to the axis cuts one nappe of a double cone and does not pass through the vertex. What curve is the intersection?': 'A circle',
        'A plane parallel to the axis of a double cone does not pass through the vertex. What curve is the intersection?': 'A hyperbola',
        'A plane is parallel to one side line of a double cone and does not pass through the vertex. What curve is the intersection?': 'A parabola',
    }
    require(prompt in fixed, 'Cone prompt not recognised')
    return pick(options, labels, fixed[prompt], 'cone-section')


# ------------------------------------------------------------------ entry points
SOLVERS = {
    'gauss-3x3-solve': solve_gauss,
    'quadratic-inequality-interval': solve_quadratic_inequality,
    'conditional-statements': solve_conditional,
    'cube-root-equation': solve_cube_root,
    'polar-graph-identify': solve_polar,
    'cone-section-name': solve_cone,
}


def solve(public):
    require(public['templateId'] in SUPPORTED, 'Unexpected high-school state-gap family')
    require(public.get('figure') is None, 'Unexpected figure in text-only practice')
    return SOLVERS[public['templateId']](public)


def review_problem(problem):
    public = problem['public']
    result = solve(public)
    require(result == problem['answer'], 'High-school state-gap answer key mismatch')
    answer = next(o for o in public['response']['options'] if o['id'] == result)
    leaked = squash(answer['label'])
    visible = squash(public['prompt']) + squash(problem.get('hint', ''))
    require(len(leaked) < 8 or leaked not in visible, 'Correct choice text appears in the prompt or hint')
    if public['templateId'] == 'gauss-3x3-solve':
        review_gauss_explanation(problem)
    return result


def self_test():
    def make(template, prompt, labels, correct):
        options = [{'id': f'option-{c}', 'label': l} for c, l in zip('abcd', labels)]
        return {'public': {'templateId': template, 'prompt': prompt, 'figure': None,
                           'response': {'kind': 'choice', 'label': 'Choose one answer', 'options': options}},
                'answer': options[correct]['id'], 'hint': 'Work it through.', 'explanation': []}

    sys_a = r'$\begin{cases} x + y + z = 6 \\ 2x - y + z = 3 \\ x + 2y - z = 2 \end{cases}$'
    sys_dep = r'$\begin{cases} x + y + z = 3 \\ 2x + 2y + 2z = 6 \\ x - y = 0 \end{cases}$'
    sys_bad = r'$\begin{cases} x + y + z = 3 \\ 2x + 2y + 2z = 7 \\ x - y = 0 \end{cases}$'
    fixtures = [
        make('gauss-3x3-solve', f'Solve the system {sys_a} Which ordered triple $(x, y, z)$ satisfies all three equations?',
             ['$(1, 2, 3)$', '$(3, 2, 1)$', '$(2, 1, 3)$', '$(1, 3, 2)$'], 0),
        make('gauss-3x3-solve', f'How many solutions does the system {sys_dep} have?',
             ['No solution', 'Infinitely many solutions', 'Exactly two solutions', 'Exactly one solution'], 1),
        make('gauss-3x3-solve', f'How many solutions does the system {sys_bad} have?',
             ['No solution', 'Infinitely many solutions', 'Exactly two solutions', 'Exactly one solution'], 0),
        make('gauss-3x3-solve', f'In the system {sys_a} equations are numbered 1, 2, 3 from the top, and $R_n$ means equation $n$. Which row operation eliminates $x$ from equation 2 using equation 1?',
             ['$R_2 \\to R_2 + 2R_1$', '$R_2 \\to R_2 - 2R_1$', '$R_2 \\to R_2 - R_1$', '$R_2 \\to R_2 + R_1$'], 1),
        make('quadratic-inequality-interval', 'Solve $x^2 - 4x + 3 < 0$. Write the solution set in interval notation.',
             ['$(1, 3)$', '$[1, 3]$', '$(-\\infty, 1) \\cup (3, \\infty)$', '$(-\\infty, -3) \\cup (-1, \\infty)$'], 0),
        make('quadratic-inequality-interval', 'Solve $x^2 - 4x + 4 > 0$ over the real numbers. Choose the solution set.',
             ['$(-\\infty, \\infty)$', 'No real solution', '$(-\\infty, 2) \\cup (2, \\infty)$', '$\\{2\\}$'], 2),
        make('quadratic-inequality-interval', 'Solve $-x^2 + 4x - 12 < 0$ over the real numbers. Choose the solution set.',
             ['$(-\\infty, \\infty)$', 'No real solution', '$(-\\infty, 2) \\cup (2, \\infty)$', '$\\{2\\}$'], 0),
        make('quadratic-inequality-interval', 'Solve $x^2 - 4x + 4 \\le 0$ over the real numbers. Choose the solution set.',
             ['$(-\\infty, \\infty)$', 'No real solution', '$(-\\infty, 2) \\cup (2, \\infty)$', '$\\{2\\}$'], 3),
        make('conditional-statements', 'Suppose $P$ is true, $Q$ is false and $R$ is true. Which of these statements is true?',
             ['$P \\to Q$', '$\\neg Q \\to (P \\land R)$', '$\\neg P \\land \\neg Q$', '$Q \\leftrightarrow R$'], 1),
        make('conditional-statements', 'Suppose $P$ is false, $Q$ is false and $R$ is true. Which of these statements is false?',
             ['$P \\to Q$', '$\\neg P \\to Q$', '$\\neg P \\lor R$', '$Q \\to R$'], 1),
        make('conditional-statements', 'Which statement is the contrapositive of “If a number is divisible by 6, then the number is even.”?',
             ['If the number is even, then a number is divisible by 6.', 'If a number is not divisible by 6, then the number is not even.',
              'If the number is not even, then a number is not divisible by 6.', 'If the number is even, then a number is not divisible by 6.'], 2),
        make('conditional-statements', 'Which statement is the negation of “If an integer ends in 0, then the integer is divisible by 5.”?',
             ['An integer ends in 0 and the integer is not divisible by 5.', 'If an integer ends in 0, then the integer is not divisible by 5.',
              'An integer does not end in 0 and the integer is not divisible by 5.', 'If an integer does not end in 0, then the integer is not divisible by 5.'], 0),
        make('cube-root-equation', 'Solve $\\sqrt[3]{2x - 16} = -2$ for real $x$.',
             ['$x = 7$', 'No real solution', '$x = 4$', '$x = 10$'], 2),
        make('cube-root-equation', 'Solve $\\sqrt[3]{x + 3} + 2 = 3$ for real $x$.',
             ['$x = 122$', '$x = 24$', '$x = 4$', '$x = -2$'], 3),
        make('cube-root-equation', 'Find all real solutions of $4x^3 + 6 = -26$. Choose the complete solution set.',
             ['$\\{-2\\}$', '$\\{2\\}$', '$\\{-2, 2\\}$', '$\\{-8\\}$'], 0),
        make('polar-graph-identify', 'How many petals does the graph of $r = -5 \\sin(7\\theta)$ have?',
             ['7 petals', '14 petals', '8 petals', '5 petals'], 0),
        make('polar-graph-identify', 'How many petals does the graph of $r = 7 \\cos(2\\theta)$ have?',
             ['4 petals', '7 petals', '3 petals', '2 petals'], 0),
        make('polar-graph-identify', 'The graph of $r = 3 + 4\\cos\\theta$ is symmetric about which of these?',
             ['The polar axis (the $x$-axis)', 'The line $\\theta=\\frac{\\pi}{2}$ (the $y$-axis)', 'The pole (the origin)', 'None of these'], 0),
        make('polar-graph-identify', 'What is the greatest distance from the pole to a point on the graph of $r = 2 - 8\\sin\\theta$?',
             ['2', '10', '8', '6'], 1),
        make('polar-graph-identify', 'Which description matches the graph of $r = 7 + 11 \\cos\\theta$?',
             ['A limaçon with an inner loop', 'A cardioid', 'A circle that passes through the pole', 'A line through the pole'], 0),
        make('cone-section-name', 'The sides of a double cone make an angle of 41° with its axis. A plane that does not pass through the vertex cuts the cone at 31° to the axis. What curve is the intersection?',
             ['An ellipse', 'A circle', 'A parabola', 'A hyperbola'], 3),
        make('cone-section-name', 'The sides of a double cone make an angle of 35° with its axis. A plane passes through the vertex and makes an angle of 35° with the axis. What is the intersection?',
             ['A single line', 'Two intersecting lines', 'A parabola', 'A single point'], 0),
        make('cone-section-name', 'The sides of a double cone make an angle of 35° with its axis. A plane passes through the vertex and makes an angle of 50° with the axis. What is the intersection?',
             ['A single line', 'Two intersecting lines', 'A parabola', 'A single point'], 3),
    ]
    rejected = 0

    def reject(problem, why):
        nonlocal rejected
        try:
            review_problem(problem)
        except ValueError:
            rejected += 1
            return
        raise ValueError(f'Corrupt high-school state-gap fixture was accepted: {why}')

    for fixture in fixtures:
        require(review_problem(fixture) == fixture['answer'], 'Hand-computed fixture rejected')
        options = fixture['public']['response']['options']
        for wrong in options:
            if wrong['id'] != fixture['answer']:
                bad = {**fixture, 'answer': wrong['id']}
                reject(bad, f"wrong key {wrong['label']}")
        twin = {**fixture, 'public': {**fixture['public'], 'response': {**fixture['public']['response'],
                'options': [dict(o) for o in options[:3]] + [dict(options[0], id=options[3]['id'])]}}}
        reject(twin, 'duplicate choice')
    return {'fixtures': len(fixtures), 'rejected': rejected}


# Read by independent-math-review.py (FamilyOracle).
CHOICE_REVIEW = SUPPORTED
