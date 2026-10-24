"""Independent vector and matrix review from public prompts, choices and figures only."""
import copy
import itertools
import math
import random
import re
from decimal import Decimal, ROUND_HALF_UP, getcontext
from fractions import Fraction

getcontext().prec = 60

VECTOR_COMPONENTS = frozenset({'vector-components'})
VECTOR_RESULTANT = frozenset({'vector-resultant'})
MATRIX_DATA = frozenset({'matrix-data-reading'})
MATRIX_OPERATIONS = frozenset({'matrix-operations'})
MATRIX_LAWS = frozenset({'matrix-laws'})
MATRIX_INVERSE = frozenset({'matrix-inverse-determinant'})
MATRIX_TRANSFORMATION = frozenset({'matrix-transformation'})
MATRIX_SYSTEM = frozenset({'matrix-linear-system'})
SUPPORTED = (VECTOR_COMPONENTS | VECTOR_RESULTANT | MATRIX_DATA | MATRIX_OPERATIONS
             | MATRIX_LAWS | MATRIX_INVERSE | MATRIX_TRANSFORMATION | MATRIX_SYSTEM)


def require(condition, message):
    if not condition:
        raise ValueError(message)


def plain(text):
    return text.replace('$', '').replace('−', '-').strip()


def squash(text):
    return re.sub(r'\s+', '', plain(text))


# ------------------------------------------------------------------ numbers
NUMBER = r'-?(?:\d+(?:\.\d+)?|\\frac\{\d+\}\{\d+\})'


def number(text):
    """Exact rational from an integer, decimal or signed \\frac{a}{b}."""
    text = squash(text).replace('\\dfrac', '\\frac')
    match = re.fullmatch(r'(-?)(?:(\d+(?:\.\d+)?)|\\frac\{(\d+)\}\{(\d+)\})', text)
    require(match is not None, f'Not a number: {text}')
    if match[2] is not None:
        value = Fraction(Decimal(match[2]))
    else:
        require(int(match[4]) != 0, 'Zero denominator')
        value = Fraction(int(match[3]), int(match[4]))
    return -value if match[1] else value


def option_table(public, count=4):
    response = public['response']
    require(response['kind'] == 'choice', 'Choice response required')
    options = response['options']
    require(len(options) == count, f'{count} public choices required')
    require(all({'id', 'label'} <= set(o) for o in options), 'Malformed choice')
    require(len({o['id'] for o in options}) == count, 'Duplicate choice IDs')
    return options


def pick(options, keys, expected):
    require(len(set(map(repr, keys))) == len(keys), 'Mathematically duplicate choices')
    hits = [o['id'] for o, key in zip(options, keys) if key == expected]
    require(len(hits) == 1, 'Missing or ambiguous correct choice')
    return hits[0]


def pick_true(options, truths):
    hits = [o['id'] for o, truth in zip(options, truths) if truth]
    require(len(hits) == 1, 'Missing or ambiguous correct statement')
    return hits[0]


# ------------------------------------------------------------------ matrices
BMATRIX = r'\\begin\{bmatrix\}(.*?)\\end\{bmatrix\}'


def parse_matrix(text, symbol=None):
    """Parse a KaTeX bmatrix (with an optional leading scalar) into Fraction rows.

    `symbol`, if given, is a letter standing for one unknown entry; its column
    (row, column) is returned in addition.
    """
    text = plain(text)
    match = re.fullmatch(r'(-?(?:\\d?frac\{\d+\}\{\d+\})?)' + BMATRIX, re.sub(r'\s+', '', text))
    require(match is not None, f'Not a bmatrix: {text}')
    scale = Fraction(1)
    if match[1] not in ('', '-'):
        scale = number(match[1])
    elif match[1] == '-':
        scale = Fraction(-1)
    rows = [row.split('&') for row in match[2].split('\\\\')]
    width = {len(r) for r in rows}
    require(len(width) == 1, 'Ragged matrix')
    where = None
    out = []
    for i, row in enumerate(rows):
        values = []
        for j, cell in enumerate(row):
            if symbol is not None and cell == symbol:
                require(where is None, 'Two unknown entries')
                where = (i, j)
                values.append(None)
            else:
                values.append(scale * number(cell))
        out.append(values)
    return (out, where) if symbol is not None else out


def find_matrices(text):
    return [parse_matrix(m[0]) for m in re.finditer(r'\\begin\{bmatrix\}.*?\\end\{bmatrix\}', plain(text))]


def mul(a, b):
    require(len(a[0]) == len(b), 'Dimension mismatch')
    return [[sum(a[i][k] * b[k][j] for k in range(len(b))) for j in range(len(b[0]))] for i in range(len(a))]


def add(a, b, scale=1):
    require(len(a) == len(b) and len(a[0]) == len(b[0]), 'Dimension mismatch')
    return [[x + scale * y for x, y in zip(r, s)] for r, s in zip(a, b)]


def scalar(k, a):
    return [[k * x for x in row] for row in a]


def det2(a):
    require(len(a) == 2 and len(a[0]) == 2, 'Not 2x2')
    return a[0][0] * a[1][1] - a[0][1] * a[1][0]


def inverse2(a):
    d = det2(a)
    require(d != 0, 'Singular matrix')
    return [[a[1][1] / d, -a[0][1] / d], [-a[1][0] / d, a[0][0] / d]]


def as_key(matrix):
    return tuple(tuple(r) for r in matrix)


# ------------------------------------------------------------------ vectors
def parse_vector(text):
    match = re.fullmatch(r'\\langle(-?\d+),(-?\d+)\\rangle', squash(text))
    require(match is not None, f'Not a vector: {text}')
    return (int(match[1]), int(match[2]))


def radical(text):
    """Return (sign, value squared) for a [-]a\\sqrt{n}, \\frac{a}{b} or \\frac{a\\sqrt n}{b} label."""
    t = squash(text)
    match = re.fullmatch(
        r'(-?)(?:\\frac\{(\d+)(?:\\sqrt\{(\d+)\})?\}\{(\d+)\}|(\d+)?(?:\\sqrt\{(\d+)\})?)', t)
    require(match is not None and t not in ('', '-'), f'Not a radical value: {t}')
    if match[4] is not None:
        num, root, den = int(match[2]), int(match[3] or 1), int(match[4])
    else:
        require(match[5] is not None or match[6] is not None, f'Empty value: {t}')
        num, root, den = int(match[5] or 1), int(match[6] or 1), 1
    require(den != 0, 'Zero denominator')
    return (-1 if match[1] else 1, Fraction(num * num * root, den * den)), (num, root, den)


def squarefree(n):
    return all(n % (p * p) for p in range(2, int(math.isqrt(n)) + 1))


def vector_expression(text):
    """Coefficients of u and v in a displayed combination such as 3\\mathbf{u}-\\mathbf{v}."""
    terms = re.findall(r'([+-]?)(\d*)\\mathbf\{([uv])\}', text)
    require(terms and ''.join(f'{s}{c}\\mathbf{{{n}}}' for s, c, n in terms) == text, f'Bad expression {text}')
    coefficient = {'u': 0, 'v': 0}
    for index, (sign, digits, name) in enumerate(terms):
        require(sign or index == 0, 'Missing operator')
        coefficient[name] += (-1 if sign == '-' else 1) * int(digits or 1)
    return coefficient


def graph_of(public):
    figure = public.get('figure')
    require(figure and figure['kind'] == 'scene', 'Graph figure required')
    elements = figure['scene']['elements']
    require(len(elements) == 1 and elements[0]['type'] == 'graph', 'Single graph expected')
    return elements[0]


def solve_vector_components(public):
    prompt = plain(public['prompt'])
    options = option_table(public)
    if prompt.startswith('The graph shows'):
        graph = graph_of(public)
        points = {p['label']: (p['x'], p['y']) for p in graph['points']}
        require(len(points) == len(graph['points']), 'Duplicate point labels')
        for x, y in points.values():
            require(graph['x'][0] <= x <= graph['x'][1] and graph['y'][0] <= y <= graph['y'][1], 'Point off graph')
        segments = graph['segments']
        require(all(s.get('arrow') for s in segments), 'Every vector segment needs an arrowhead')

        def segment(a, b):
            hits = [s for s in segments if tuple(s['from']) == points[a] and tuple(s['to']) == points[b]]
            require(len(hits) == 1, f'Arrow {a}->{b} missing or repeated')
        if 'placed tip to tail' in prompt:
            require(re.fullmatch(
                r'The graph shows \\mathbf\{u\}=\\overrightarrow\{OP\} and \\mathbf\{v\}=\\overrightarrow\{PQ\} '
                r'placed tip to tail\. What are the components of \\mathbf\{u\}\+\\mathbf\{v\}\?', prompt) is not None,
                'Unexpected tip-to-tail wording')
            require(set(points) == {'O', 'P', 'Q'} and len(segments) == 2, 'Tip-to-tail graph needs O, P, Q')
            segment('O', 'P'), segment('P', 'Q')
            expected = (points['Q'][0] - points['O'][0], points['Q'][1] - points['O'][1])
        else:
            require(prompt == 'The graph shows vector \\overrightarrow{PQ} from its tail P to its tip Q. '
                    'What are its components?', 'Unexpected graph wording')
            require(set(points) == {'P', 'Q'} and len(segments) == 1, 'Single-vector graph needs P and Q')
            segment('P', 'Q')
            expected = (points['Q'][0] - points['P'][0], points['Q'][1] - points['P'][1])
        require(public.get('figure') is not None, 'Figure required')
        return pick(options, [parse_vector(o['label']) for o in options], expected)
    require(public.get('figure') is None, 'Unexpected figure')
    match = re.fullmatch(
        r'Vector \\overrightarrow\{AB\} starts at the initial point A\((-?\d+), (-?\d+)\) and ends at the '
        r'terminal point B\((-?\d+), (-?\d+)\)\. What are its components\?', prompt)
    if match:
        a, b, c, d = map(int, match.groups())
        return pick(options, [parse_vector(o['label']) for o in options], (c - a, d - b))
    match = re.fullmatch(
        r'Let \\mathbf\{u\}=\\langle (-?\d+), (-?\d+)\\rangle and \\mathbf\{v\}=\\langle (-?\d+), (-?\d+)\\rangle\. '
        r'Find (.+)\.', prompt)
    if match:
        ux, uy, vx, vy = map(int, match.groups()[:4])
        k = vector_expression(match[5])
        expected = (k['u'] * ux + k['v'] * vx, k['u'] * uy + k['v'] * vy)
        return pick(options, [parse_vector(o['label']) for o in options], expected)
    match = re.fullmatch(r'Find the magnitude of \\mathbf\{v\}=\\langle (-?\d+), (-?\d+)\\rangle\. '
                         r'Give the exact value in simplest radical form if it is not a whole number\.', prompt)
    scale = Fraction(1)
    if not match:
        match = re.fullmatch(
            r'Let \\mathbf\{v\}=\\langle (-?\d+), (-?\d+)\\rangle\. What is the magnitude \|(.*?)\\mathbf\{v\}\|\?', prompt)
        require(match is not None, f'Unrecognized vector prompt: {prompt}')
        scale = number(match[3]) if match[3] not in ('', '-') else Fraction(-1 if match[3] == '-' else 1)
    x, y = int(match[1]), int(match[2])
    target = scale * scale * (x * x + y * y)
    keys, forms = [], []
    for o in options:
        key, form = radical(o['label'])
        keys.append(key), forms.append(form)
    answer = pick(options, keys, (1, target))
    num, root, den = forms[[o['id'] for o in options].index(answer)]
    require(squarefree(root) and math.gcd(num, den) == 1, 'Correct magnitude is not in simplest form')
    return answer


# --------------------------------------------------------------- resultants
def plain_quantity(label):
    t = plain(label).replace('\\text{ mph}', '').replace('\\text{ N}', '').replace('^\\circ', '')
    require(re.fullmatch(r'\d+(\.\d+)?', t) is not None, f'Not a plain quantity: {label}')
    return Fraction(t)


def sqrt_exact(n, rounded):
    root = Decimal(n).sqrt()
    if rounded == 'tenth':
        return Fraction(root.quantize(Decimal('0.1'), rounding=ROUND_HALF_UP))
    require(root == root.to_integral_value(), f'Unrounded answer is not exact: sqrt({n})')
    return Fraction(root)


def degrees(opposite, adjacent):
    value = math.degrees(math.atan2(opposite, adjacent))
    require(abs(value - math.floor(value) - 0.5) > 1e-6, 'Degree answer sits on a rounding tie')
    return Fraction(int(Decimal(value).quantize(Decimal('1'), rounding=ROUND_HALF_UP)))


def solve_vector_resultant(public):
    require(public.get('figure') is None, 'Unexpected figure')
    prompt = plain(public['prompt'])
    options = option_table(public)
    rounding = None
    if prompt.endswith(' Round to the nearest tenth.'):
        rounding, prompt = 'tenth', prompt[:-len(' Round to the nearest tenth.')]
    elif prompt.endswith(' Round to the nearest degree.'):
        rounding, prompt = 'degree', prompt[:-len(' Round to the nearest degree.')]
    n = r'(\d+)'
    patterns = [
        ('boat-mag', rf"A boat heads straight across a river at {n} mph relative to the water\. The current flows downstream at {n} mph, perpendicular to the boat's heading\. What is the boat's speed relative to the shore\?"),
        ('plane-mag', rf"A plane flies due north at {n} mph relative to the air\. A wind blows due east at {n} mph\. What is the plane's speed relative to the ground\?"),
        ('force-mag', rf"Two forces pull on a ring at right angles: {n} N due east and {n} N due north\. What is the magnitude of the resultant force\?"),
        ('boat-theta-down', rf"A boat heads straight across a river at {n} mph relative to the water\. The current flows downstream at {n} mph, perpendicular to the boat's heading\. The boat's actual path makes an angle \\theta with the downstream direction\. Find \\theta\."),
        ('boat-theta-head', rf"A boat heads straight across a river at {n} mph relative to the water\. The current flows downstream at {n} mph, perpendicular to the boat's heading\. The boat's actual path makes an angle \\theta with its heading \(straight across\)\. Find \\theta\."),
        ('plane-en', rf"A plane flies due north at {n} mph relative to the air\. A wind blows due east at {n} mph\. The plane's ground path points \\theta degrees east of north\. Find \\theta\."),
        ('plane-ne', rf"A plane flies due north at {n} mph relative to the air\. A wind blows due east at {n} mph\. The plane's ground path points \\theta degrees north of east\. Find \\theta\."),
        ('force-ne', rf"Two forces pull on a ring at right angles: {n} N due east and {n} N due north\. The resultant points \\theta degrees north of east\. Find \\theta\."),
        ('force-en', rf"Two forces pull on a ring at right angles: {n} N due east and {n} N due north\. The resultant points \\theta degrees east of north\. Find \\theta\."),
    ]
    for name, pattern in patterns:
        match = re.fullmatch(pattern, prompt)
        if not match:
            continue
        a, b = int(match[1]), int(match[2])
        # boat/plane: first number is the heading speed (north / across); second is the east / downstream drift.
        # forces: first is east, second is north.
        if name.endswith('-mag'):
            require(rounding in (None, 'tenth'), 'Magnitude cannot round to degrees')
            expected = sqrt_exact(a * a + b * b, rounding)
        else:
            require(rounding == 'degree', 'Angle answers must state degree rounding')
            toward, away = {
                'boat-theta-down': (a, b), 'boat-theta-head': (b, a),
                'plane-en': (b, a), 'plane-ne': (a, b),
                'force-ne': (b, a), 'force-en': (a, b),
            }[name]
            expected = degrees(toward, away)
        keys = [plain_quantity(o['label']) for o in options]
        return pick(options, keys, expected)
    reverse = [
        rf"A boat heads straight across a river\. The current flows downstream at {n} mph, perpendicular to the boat's heading, and the boat's speed relative to the shore is {n} mph\. What is the boat's speed relative to the water\?",
        rf"A plane heads due north through the air\. A wind blows due east at {n} mph, perpendicular to the plane's heading, and the plane's ground speed is {n} mph\. What is the plane's air speed\?",
        rf"Two forces act on a ring at right angles\. One force is {n} N and the magnitude of the resultant is {n} N\. What is the magnitude of the other force\?",
    ]
    stripped = prompt
    for pattern in reverse:
        match = re.fullmatch(pattern, stripped)
        if match:
            require(rounding is None, 'Unexpected rounding on a missing-leg problem')
            leg, hyp = int(match[1]), int(match[2])
            require(hyp > leg, 'Resultant must exceed the leg')
            expected = sqrt_exact(hyp * hyp - leg * leg, None)
            return pick(options, [plain_quantity(o['label']) for o in options], expected)
    raise ValueError(f'Unrecognized resultant prompt: {prompt}')


# ---------------------------------------------------------------- data read
def name_list(text):
    parts = re.split(r',\s*and\s+|,\s*|\s+and\s+', text)
    require(len(parts) >= 2 and all(parts), 'Bad list')
    return parts


def solve_matrix_data(public):
    prompt = plain(public['prompt'])
    options = option_table(public)
    match = re.fullmatch(
        r'Matrix A=(\\begin\{bmatrix\}.*?\\end\{bmatrix\}) lists the stock of (.+?) \(columns, in that order\) at '
        r'(.+?) \(rows, in that order\)\. (.+)', prompt)
    require(match is not None, f'Unrecognized data prompt: {prompt}')
    matrix = parse_matrix(match[1])
    items, stores = name_list(match[2]), name_list(match[3])
    rows, cols = len(matrix), len(matrix[0])
    require(len(stores) == rows and len(items) == cols, 'Labels do not match matrix shape')
    require(all(v == int(v) and v >= 0 for r in matrix for v in r), 'Stock must be whole non-negative counts')
    question = match[4]

    def cell(item, store):
        return matrix[stores.index(store)][items.index(item)]
    m = re.fullmatch(r'How many (.+?) does (\w+) have\?', question)
    if m and m[1] != 'items of all kinds':
        return pick(options, [number(o['label']) for o in options], cell(m[1], m[2]))
    m = re.fullmatch(r'How many (.+?) are in stock at all the stores combined\?', question)
    if m:
        col = items.index(m[1])
        return pick(options, [number(o['label']) for o in options], sum(r[col] for r in matrix))
    m = re.fullmatch(r'How many items of all kinds does (\w+) have in stock\?', question)
    if m:
        return pick(options, [number(o['label']) for o in options], sum(matrix[stores.index(m[1])]))
    m = re.fullmatch(r'Which entry gives the number of (.+?) at (\w+)\?', question)
    if m:
        r, c = stores.index(m[2]) + 1, items.index(m[1]) + 1
        keys = []
        for o in options:
            mm = re.fullmatch(r'a_\{(\d)(\d)\}', squash(o['label']))
            require(mm is not None, 'Entry choices must be subscripted a_{rc}')
            keys.append((int(mm[1]), int(mm[2])))
        return pick(options, keys, (r, c))
    require(question == 'What are the dimensions of A, written rows \\times columns?' or
            re.fullmatch(r'Which statement describes the entry a_\{(\d)(\d)\}, in row (\d) and column (\d)\?', question)
            is not None, f'Unrecognized data question: {question}')
    if question.startswith('What are the dimensions'):
        keys = []
        for o in options:
            mm = re.fullmatch(r'(\d)\\times(\d)', squash(o['label']))
            require(mm is not None, 'Dimension choices must be r x c')
            keys.append((int(mm[1]), int(mm[2])))
        return pick(options, keys, (rows, cols))
    mm = re.fullmatch(r'Which statement describes the entry a_\{(\d)(\d)\}, in row (\d) and column (\d)\?', question)
    require((mm[1], mm[2]) == (mm[3], mm[4]), 'Subscript disagrees with the stated row and column')
    r, c = int(mm[1]), int(mm[2])
    truths = []
    for o in options:
        label = plain(o['label'])
        single = re.fullmatch(r'The number of (.+?) at (\w+)', label)
        total = re.fullmatch(r'The total (.+?) at all stores', label)
        if single:
            truths.append(single[1] == items[c - 1] and single[2] == stores[r - 1])
        elif total:
            truths.append(False)  # one entry is a single store's count, never a column total
        else:
            raise ValueError(f'Unrecognized entry description: {label}')
    return pick_true(options, truths)


# --------------------------------------------------------------- operations
def solve_matrix_operations(public):
    prompt = plain(public['prompt'])
    options = option_table(public)
    require(public.get('figure') is None, 'Unexpected figure')
    m = re.fullmatch(r'Matrix A is (\d)\\times(\d) and matrix B is (\d)\\times(\d)\. '
                     r'Which statement about the product (AB|BA) is true\?', prompt)
    if m:
        dims = {'A': (int(m[1]), int(m[2])), 'B': (int(m[3]), int(m[4]))}
        left, right = m[5][0], m[5][1]
        defined = dims[left][1] == dims[right][0]
        truths = []
        for o in options:
            label = plain(o['label'])
            bad = re.fullmatch(rf'{m[5]} is not defined: {left} has (\d) columns but {right} has (\d) rows', label)
            wrong_reason = re.fullmatch(rf'{m[5]} is not defined: {left} has (\d) rows but {right} has (\d) columns', label)
            good = re.fullmatch(rf'{m[5]} is defined and is (\d)\\times(\d)', label)
            if bad:
                truths.append((not defined) and (int(bad[1]), int(bad[2])) == (dims[left][1], dims[right][0]))
            elif good:
                truths.append(defined and (int(good[1]), int(good[2])) == (dims[left][0], dims[right][1]))
            elif wrong_reason:
                # Rows of the left factor versus columns of the right factor never decide whether AB exists,
                # so a statement that offers them as the reason is not a correct explanation of anything.
                truths.append(False)
                require(defined, 'A true-but-irrelevant "not defined" reason would be a second defensible answer')
            else:
                raise ValueError(f'Unrecognized product statement: {label}')
        return pick_true(options, truths)
    m = re.fullmatch(r'Let A=(\\begin.*?\\end\{bmatrix\}) and B=(\\begin.*?\\end\{bmatrix\})\. Find (.+)\.', prompt)
    if m:
        a, b = parse_matrix(m[1]), parse_matrix(m[2])
        expr = m[3]
        if expr == 'AB':
            expected = mul(a, b)
        else:
            mm = re.fullmatch(r'(-?\d*)A([+-])(\d*)B', expr)
            require(mm is not None, f'Unrecognized expression {expr}')
            ka = Fraction(-1 if mm[1] == '-' else int(mm[1] or 1))
            kb = Fraction(-1 if mm[2] == '-' else 1) * int(mm[3] or 1)
            expected = add(scalar(ka, a), scalar(kb, b))
    else:
        m = re.fullmatch(r'Let A=(\\begin.*?\\end\{bmatrix\})\. Find (-?\d+)A\.', prompt)
        require(m is not None, f'Unrecognized operations prompt: {prompt}')
        expected = scalar(Fraction(int(m[2])), parse_matrix(m[1]))
    return pick(options, [as_key(parse_matrix(o['label'])) for o in options], as_key(expected))


# --------------------------------------------------------------------- laws
class M:
    def __init__(self, rows):
        self.rows = tuple(tuple(map(Fraction, r)) for r in rows)

    def __add__(self, o):
        return M(add(self.rows, o.rows))

    def __sub__(self, o):
        return M(add(self.rows, o.rows, -1))

    def __neg__(self):
        return M(scalar(-1, self.rows))

    def __mul__(self, o):
        if isinstance(o, M):
            return M(mul(self.rows, o.rows))
        return M(scalar(o, self.rows))

    __rmul__ = __mul__

    def __pow__(self, k):
        out = self
        for _ in range(k - 1):
            out = out * self
        return out

    def __eq__(self, o):
        return self.rows == o.rows

    def __hash__(self):
        return hash(self.rows)


def law_source(side):
    tokens = re.findall(r'[ABCI]|\d+|\^|[()+\-]', side)
    require(''.join(tokens) == side, f'Bad law text {side}')
    out, prev = [], None
    for t in tokens:
        if t == '^':
            out.append('**')
        elif prev == '^':
            out.append(t)
        else:
            starts = t.isalpha() or t == '(' or t.isdigit()
            ended = prev is not None and (prev.isalpha() or prev == ')' or prev.isdigit())
            if ended and starts:
                out.append('*')
            out.append(t)
        prev = t
    return ''.join(out)


def sample_matrices(n, rng):
    pool = []
    for _ in range(60):
        pool.append([M([[rng.randint(-3, 3) for _ in range(n)] for _ in range(n)]) for _ in range(3)])
    return pool


def law_holds(law, n):
    """True if the displayed law is an identity for all n x n matrices (tested on exact samples)."""
    rng = random.Random(7)
    ident = M([[1 if i == j else 0 for j in range(n)] for i in range(n)])
    if '\\text{ implies }' in law:
        premise, conclusion = [squash(x) for x in law.split('\\text{ implies }')]
        a, b, c = [M([[0] * n for _ in range(n)]) for _ in range(3)]
        # Rank-one A with A(B-C)=0 refutes cancellation; random samples confirm nothing else is assumed.
        a = M([[1 if (i, j) == (0, 0) else 0 for j in range(n)] for i in range(n)])
        b = M([[1] * n for _ in range(n)])
        c = M([[1] * n if i == 0 else [2] * n for i in range(n)])
        scope = {'A': a, 'B': b, 'C': c, 'I': ident}
        left = [eval(law_source(s), {}, scope) for s in premise.split('=')]
        right = [eval(law_source(s), {}, scope) for s in conclusion.split('=')]
        if all(x == left[0] for x in left) and not all(x == right[0] for x in right):
            return False
        return True
    for a, b, c in sample_matrices(n, rng):
        scope = {'A': a, 'B': b, 'C': c, 'I': ident}
        sides = [eval(law_source(s), {}, scope) for s in squash(law).split('=')]
        if not all(x == sides[0] for x in sides):
            return False
    return True


def solve_matrix_laws(public):
    prompt = plain(public['prompt'])
    options = option_table(public)
    m = re.fullmatch(r'A, B and C are (\d)\\times(\d) matrices, and I is the (\d)\\times(\d) identity\. '
                     r'Which equation (holds|does NOT hold) for all such matrices\?', prompt)
    if m:
        require(len({m[1], m[2], m[3], m[4]}) == 1, 'Law dimensions must agree')
        n = int(m[1])
        holds = [law_holds(plain(o['label']), n) for o in options]
        return pick_true(options, holds if m[5] == 'holds' else [not h for h in holds])
    m = re.fullmatch(r'Which (\d)\\times(\d) matrix I satisfies IA=A and AI=A for every (\d)\\times(\d) matrix A\?', prompt)
    if m:
        require(len({m[1], m[2], m[3], m[4]}) == 1, 'Identity dimensions must agree')
        n = int(m[1])
        ident = tuple(tuple(Fraction(int(i == j)) for j in range(n)) for i in range(n))
        return pick(options, [as_key(parse_matrix(o['label'])) for o in options], ident)
    m = re.fullmatch(r'Let A=(\\begin.*?\\end\{bmatrix\}) and B=(\\begin.*?\\end\{bmatrix\})\. (Find BA|Which statement is true)\?*\.?', prompt)
    require(m is not None, f'Unrecognized laws prompt: {prompt}')
    a, b = parse_matrix(m[1]), parse_matrix(m[2])
    ab, ba = mul(a, b), mul(b, a)
    if m[3] == 'Find BA':
        return pick(options, [as_key(parse_matrix(o['label'])) for o in options], as_key(ba))
    truths = []
    for o in options:
        label = plain(o['label'])
        sym = re.fullmatch(r'AB\\ne BA: the entry in row (\d), column (\d) is (-?\d+) in AB and (-?\d+) in BA', label)
        both = re.fullmatch(r'AB=BA: the entry in row (\d), column (\d) is (-?\d+) in both', label)
        if sym:
            i, j = int(sym[1]) - 1, int(sym[2]) - 1
            truths.append(ab != ba and (ab[i][j], ba[i][j]) == (int(sym[3]), int(sym[4])))
        elif both:
            i, j = int(both[1]) - 1, int(both[2]) - 1
            truths.append(ab == ba and ab[i][j] == int(both[3]))
        elif label in ('AB\\ne BA because matrices never commute', 'AB=BA only if one of them is the identity matrix'):
            truths.append(False)  # both are false claims about matrices in general
        else:
            raise ValueError(f'Unrecognized statement: {label}')
    return pick_true(options, truths)


# ------------------------------------------------------------ inverse / det
def solve_matrix_inverse(public):
    prompt = plain(public['prompt'])
    options = option_table(public)
    m = re.fullmatch(r'Find the determinant of A=(\\begin.*?\\end\{bmatrix\})\.', prompt)
    if m:
        return pick(options, [number(o['label']) for o in options], det2(parse_matrix(m[1])))
    m = re.fullmatch(r'Find the inverse of A=(\\begin.*?\\end\{bmatrix\})\.', prompt)
    if m:
        a = parse_matrix(m[1])
        keys = [as_key(parse_matrix(o['label'])) for o in options]
        return pick(options, keys, as_key(inverse2(a)))
    m = re.fullmatch(r'Exactly one of these (\d)\\times(\d) matrices has no inverse\. Which one\?', prompt)
    if m:
        require(m[1] == m[2] == '2', 'Only 2x2 supported')
        matrices = [parse_matrix(o['label']) for o in options]
        return pick_true(options, [det2(x) == 0 for x in matrices])
    m = re.fullmatch(r'For which value of k does (\\begin.*?\\end\{bmatrix\}) have no inverse\?', prompt)
    require(m is not None, f'Unrecognized inverse prompt: {prompt}')
    rows, where = parse_matrix(m[1], 'k')
    require(where is not None, 'Missing unknown entry k')
    def with_k(value):
        return [[value if (i, j) == where else x for j, x in enumerate(r)] for i, r in enumerate(rows)]
    d0, d1 = det2(with_k(Fraction(0))), det2(with_k(Fraction(1)))
    require(d1 != d0, 'k does not affect the determinant')
    return pick(options, [number(o['label']) for o in options], -d0 / (d1 - d0))


# ------------------------------------------------------------ transformation
def transform_matrix(text, angle_ok=True):
    """Matrix of a stated geometric transformation, from its public wording."""
    t = plain(text)
    m = re.fullmatch(r'(?:[Rr]otates?|rotates) points (\d+)\^\\circ(?: (clockwise|counterclockwise))? about the origin', t)
    if m:
        angle = int(m[1])
        direction = m[2]
        if angle == 180:
            return [[-1, 0], [0, -1]]
        require(direction is not None, 'Rotation direction must be stated')
        require(angle in (90, 270), f'Unsupported rotation {angle}')
        quarter = angle // 90 % 4
        if direction == 'clockwise':
            quarter = -quarter % 4
        return {1: [[0, -1], [1, 0]], 2: [[-1, 0], [0, -1]], 3: [[0, 1], [-1, 0]]}[quarter]
    m = re.fullmatch(r'[Dd]ilates? points by a factor of (\d+) from the origin', t)
    if m:
        k = int(m[1])
        return [[k, 0], [0, k]]
    table = {
        'reflects points across the x-axis': [[1, 0], [0, -1]],
        'reflects points across the y-axis': [[-1, 0], [0, 1]],
        'reflects points across the line y=x': [[0, 1], [1, 0]],
    }
    key = squash(t).lower()
    for phrase, matrix in table.items():
        if key == squash(phrase).lower():
            return matrix
    raise ValueError(f'Unrecognized transformation: {t}')


def fractional_point(label):
    m = re.fullmatch(r'\((.+?),(.+)\)', squash(label))
    require(m is not None, f'Not a point: {label}')
    return (number(m[1]), number(m[2]))


def solve_matrix_transformation(public):
    prompt = plain(public['prompt'])
    options = option_table(public)
    m = re.fullmatch(r'Multiplying the column \\begin\{bmatrix\}x\\\\y\\end\{bmatrix\} by M=(\\begin.*?\\end\{bmatrix\}) '
                     r'transforms points\. What does it do\?', prompt)
    if m:
        target = as_key(parse_matrix(m[1]))
        truths = [as_key([[Fraction(x) for x in r] for r in transform_matrix(o['label'])]) == target for o in options]
        return pick_true(options, truths)
    m = re.fullmatch(r'The matrix M=(\\begin.*?\\end\{bmatrix\}) transforms each point \(x,y\) to the point given by '
                     r'M\\begin\{bmatrix\}x\\\\y\\end\{bmatrix\}\. Where does M send \((-?\d+), (-?\d+)\)\?', prompt)
    if m:
        image = mul(parse_matrix(m[1]), [[Fraction(int(m[2]))], [Fraction(int(m[3]))]])
        return pick(options, [fractional_point(o['label']) for o in options], (image[0][0], image[1][0]))
    m = re.fullmatch(r'The matrix (\\begin.*?\\end\{bmatrix\}) (rotates|dilates|reflects) (.+?)\. Where does it send '
                     r'\((-?\d+), (-?\d+)\)\?', prompt)
    if m:
        matrix = [[Fraction(x) for x in r] for r in transform_matrix(f'{m[2]} {m[3]}')]
        require(as_key(parse_matrix(m[1])) == as_key(matrix), 'Displayed matrix does not perform the stated transformation')
        image = mul(matrix, [[Fraction(int(m[4]))], [Fraction(int(m[5]))]])
        return pick(options, [fractional_point(o['label']) for o in options], (image[0][0], image[1][0]))
    m = re.fullmatch(r'Which matrix (rotates|dilates|reflects) (.+?), when it multiplies the column '
                     r'\\begin\{bmatrix\}x\\\\y\\end\{bmatrix\}\?', prompt)
    if m:
        matrix = [[Fraction(x) for x in r] for r in transform_matrix(f'{m[1]} {m[2]}')]
        return pick(options, [as_key(parse_matrix(o['label'])) for o in options], as_key(matrix))
    m = re.fullmatch(r'A triangle with area (\d+) square units is transformed by M=(\\begin.*?\\end\{bmatrix\})\. '
                     r'What is the area of the image\?', prompt)
    if m:
        area, matrix = Fraction(int(m[1])), m[2]
    else:
        m = re.fullmatch(r'The unit square \(area 1\) is transformed by M=(\\begin.*?\\end\{bmatrix\})\. '
                         r'What is the area of its image\?', prompt)
        require(m is not None, f'Unrecognized transformation prompt: {prompt}')
        area, matrix = Fraction(1), m[1]
    return pick(options, [number(o['label']) for o in options], abs(det2(parse_matrix(matrix))) * area)


# ------------------------------------------------------------- linear system
def equation_row(text):
    """Return (a, b, c) for ax+by=c after moving every constant to the right."""
    left, right = squash(text).split('=')
    totals = {'x': 0, 'y': 0, '': 0}
    for sign, side in ((1, left), (-1, right)):
        terms = re.findall(r'[+-]?\d*[xy]?', side)
        require(''.join(terms) == side, f'Bad equation side {side}')
        for term in filter(None, terms):
            variable = term[-1] if term[-1] in 'xy' else ''
            digits = term[:-1] if variable else term
            value = -1 if digits == '-' else 1 if digits in ('', '+') else int(digits)
            totals[variable] += sign * value
    return Fraction(totals['x']), Fraction(totals['y']), -Fraction(totals[''])


def point_key(label):
    m = re.fullmatch(r'\(x,y\)=\((.+?),(.+)\)', squash(label))
    require(m is not None, f'Not an (x, y) answer: {label}')
    return (number(m[1]), number(m[2]))


def solve_matrix_system(public):
    prompt = plain(public['prompt'])
    options = option_table(public)
    m = re.fullmatch(r'The system (.+?), (.+?) is written AX=B with A=(\\begin.*?\\end\{bmatrix\})\. '
                     r'Can it be solved as X=A\^\{-1\}B\?', prompt)
    if m:
        r1, r2 = equation_row(m[1]), equation_row(m[2])
        a = parse_matrix(m[3])
        require(a == [[r1[0], r1[1]], [r2[0], r2[1]]], 'Displayed A disagrees with the system')
        d = det2(a)
        keys = []
        for o in options:
            mm = re.fullmatch(r'(Yes|No):\\detA=(-?\d+),soA\^\{-1\}(exists|doesnotexist)', squash(o['label']))
            require(mm is not None, f'Unrecognized solvability choice: {o["label"]}')
            keys.append((mm[1] == 'Yes', Fraction(int(mm[2])), mm[3] == 'exists'))
        return pick(options, keys, (d != 0, d, d != 0))
    m = re.fullmatch(r'The system (.+?), (.+?) is AX=B with A=(\\begin.*?\\end\{bmatrix\}) and B=(\\begin.*?\\end\{bmatrix\})\. '
                     r'Solve it using X=A\^\{-1\}B\.', prompt)
    if m:
        r1, r2 = equation_row(m[1]), equation_row(m[2])
        a, b = parse_matrix(m[3]), parse_matrix(m[4])
        require(a == [[r1[0], r1[1]], [r2[0], r2[1]]] and b == [[r1[2]], [r2[2]]], 'Displayed A or B disagrees with the system')
        solution = mul(inverse2(a), b)
        return pick(options, [point_key(o['label']) for o in options], (solution[0][0], solution[1][0]))
    m = re.fullmatch(r'For AX=B, the inverse is A\^\{-1\}=(.+?) and B=(\\begin.*?\\end\{bmatrix\})\. '
                     r'Find \(x, y\) from X=A\^\{-1\}B\.', prompt)
    if m:
        inv, b = parse_matrix(m[1]), parse_matrix(m[2])
        original = inverse2(inv)
        require(all(v.denominator == 1 for r in original for v in r), 'Given inverse does not come from an integer matrix')
        solution = mul(inv, b)
        return pick(options, [point_key(o['label']) for o in options], (solution[0][0], solution[1][0]))
    m = re.fullmatch(r'Write the system (.+?) and (.+?) as AX=B with X=\\begin\{bmatrix\}x\\\\y\\end\{bmatrix\}\. '
                     r'What is the (coefficient|constant) matrix (A|B)\?', prompt)
    require(m is not None, f'Unrecognized system prompt: {prompt}')
    r1, r2 = equation_row(m[1]), equation_row(m[2])
    expected = [[r1[0], r1[1]], [r2[0], r2[1]]] if m[3] == 'coefficient' else [[r1[2]], [r2[2]]]
    require((m[3], m[4]) in (('coefficient', 'A'), ('constant', 'B')), 'Matrix name disagrees with role')
    return pick(options, [as_key(parse_matrix(o['label'])) for o in options], as_key(expected))


# ---------------------------------------------------------------- dispatch
def solve(public):
    template = public['templateId']
    require(template in SUPPORTED, 'Unexpected vector or matrix family')
    handler = (solve_vector_components if template in VECTOR_COMPONENTS else
               solve_vector_resultant if template in VECTOR_RESULTANT else
               solve_matrix_data if template in MATRIX_DATA else
               solve_matrix_operations if template in MATRIX_OPERATIONS else
               solve_matrix_laws if template in MATRIX_LAWS else
               solve_matrix_inverse if template in MATRIX_INVERSE else
               solve_matrix_transformation if template in MATRIX_TRANSFORMATION else
               solve_matrix_system)
    return handler(public)


def leak_text(label):
    return re.sub(r'\\text\{[^}]*\}', '', plain(label)).strip()


def review_leakage(problem, answer):
    """The prompt, hint and feedback of other choices must not hand over the correct label."""
    public = problem['public']
    label = plain(next(o['label'] for o in public['response']['options'] if o['id'] == answer))
    text_label = leak_text(label)
    # Finding an inverse must display the matrix, and an involutory matrix is its own inverse.
    shown = '' if public['templateId'] in MATRIX_INVERSE else plain(public['prompt'])
    pool = [shown, plain(problem.get('hint', ''))]
    feedback = problem.get('choiceFeedback', {})
    require(answer not in feedback, 'Correct choice must not carry distractor feedback')
    require(set(feedback) <= {o['id'] for o in public['response']['options']}, 'Feedback for unknown choice')
    pool += [plain(v) for v in feedback.values()]
    for candidate in (label, text_label):
        if public['templateId'] in MATRIX_INVERSE and candidate in plain(public['prompt']):
            continue  # an involutory matrix is displayed in the prompt and is its own inverse
        if len(candidate) >= 5:
            for text in pool:
                require(candidate not in text, f'Correct answer {candidate!r} leaks into support text')
    # A hint must not state the finished result as an equation ("... = answer", "\approx answer").
    value = re.sub(r'\\text\{[^}]*\}|\^\\circ', '', label).strip()
    if value:
        for text in pool[1:2]:
            require(not re.search(r'(=|\\approx|is)\s*' + re.escape(value) + r'(?![\d.])', text),
                    'Hint states the final result')


def review_problem(problem):
    result = solve(problem['public'])
    require(result == problem['answer'], 'Vector or matrix answer key mismatch')
    review_leakage(problem, result)
    return result


# ---------------------------------------------------------------- self test
def labelled(labels, correct_index):
    options = [{'id': f'option-{chr(97 + i)}', 'label': f'${label}$'} for i, label in enumerate(labels)]
    return options, options[correct_index]['id']


def fixture(template, prompt, labels, correct_index, figure=None):
    options, answer = labelled(labels, correct_index)
    public = {'templateId': template, 'prompt': prompt,
              'response': {'kind': 'choice', 'options': options}}
    if figure is not None:
        public['figure'] = figure
    return {'public': public, 'answer': answer, 'hint': 'Work it out step by step.', 'choiceFeedback': {}}


def bm(*rows):
    return '\\begin{bmatrix}' + '\\\\'.join('&'.join(map(str, r)) for r in rows) + '\\end{bmatrix}'


def vector_graph(points, segments):
    return {'kind': 'scene', 'scene': {'v': 1, 'title': 't', 'elements': [{
        'id': 'g', 'type': 'graph', 'x': [-8, 8], 'y': [-8, 8], 'tick': 1,
        'points': [{'x': x, 'y': y, 'label': l} for l, (x, y) in points.items()],
        'segments': [{'from': list(a), 'to': list(b), 'arrow': True} for a, b in segments]}]}}


def self_test_cases():
    cases = []
    tip = vector_graph({'O': (0, 0), 'P': (-1, -2), 'Q': (-4, -1)}, [((0, 0), (-1, -2)), ((-1, -2), (-4, -1))])
    cases.append(fixture('vector-components',
        'The graph shows $\\mathbf{u}=\\overrightarrow{OP}$ and $\\mathbf{v}=\\overrightarrow{PQ}$ placed tip to tail. '
        'What are the components of $\\mathbf{u}+\\mathbf{v}$?',
        ['\\langle 2, -3\\rangle', '\\langle -3, 1\\rangle', '\\langle -1, -2\\rangle', '\\langle -4, -1\\rangle'], 3, tip))
    pq = vector_graph({'P': (2, 3), 'Q': (-3, 1)}, [((2, 3), (-3, 1))])
    cases.append(fixture('vector-components',
        'The graph shows vector $\\overrightarrow{PQ}$ from its tail $P$ to its tip $Q$. What are its components?',
        ['\\langle 5, 2\\rangle', '\\langle -5, -2\\rangle', '\\langle -1, 4\\rangle', '\\langle 5, -2\\rangle'], 1, pq))
    cases.append(fixture('vector-components',
        'Let $\\mathbf{u}=\\langle 3, -5\\rangle$ and $\\mathbf{v}=\\langle 2, -2\\rangle$. Find $-\\mathbf{u}-\\mathbf{v}$.',
        ['\\langle -5, 7\\rangle', '\\langle -1, 3\\rangle', '\\langle -5, -3\\rangle', '\\langle 1, -3\\rangle'], 0))
    cases.append(fixture('vector-components',
        'Vector $\\overrightarrow{AB}$ starts at the initial point $A(-4, -3)$ and ends at the terminal point $B(-10, -6)$. '
        'What are its components?',
        ['\\langle -3, -6\\rangle', '\\langle -6, -3\\rangle', '\\langle -14, -9\\rangle', '\\langle 6, 3\\rangle'], 1))
    cases.append(fixture('vector-components',
        'Find the magnitude of $\\mathbf{v}=\\langle 4, -4\\rangle$. Give the exact value in simplest radical form if it is not a whole number.',
        ['\\sqrt{34}', '4\\sqrt{2}', '32', '8'], 1))
    cases.append(fixture('vector-components',
        'Let $\\mathbf{v}=\\langle 24, 10\\rangle$. What is the magnitude $|-\\frac{1}{2}\\mathbf{v}|$?',
        ['\\frac{53}{2}', '-13', '13', '26'], 2))
    cases.append(fixture('vector-resultant',
        "A plane flies due north at 287 mph relative to the air. A wind blows due east at 251 mph. "
        "What is the plane's speed relative to the ground? Round to the nearest tenth.",
        ['145370\\text{ mph}', '381.3\\text{ mph}', '538\\text{ mph}', '36\\text{ mph}'], 1))
    cases.append(fixture('vector-resultant',
        "Two forces pull on a ring at right angles: 75 N due east and 50 N due north. "
        "The resultant points $\\theta$ degrees east of north. Find $\\theta$. Round to the nearest degree.",
        ['56^\\circ', '40^\\circ', '34^\\circ', '29^\\circ'], 0))
    cases.append(fixture('vector-resultant',
        "Two forces act on a ring at right angles. One force is 16 N and the magnitude of the resultant is 34 N. "
        "What is the magnitude of the other force?",
        ['900\\text{ N}', '18\\text{ N}', '37.6\\text{ N}', '30\\text{ N}'], 3))
    cases.append(fixture('matrix-data-reading',
        f"Matrix $A={bm((45, 49, 31), (15, 6, 47))}$ lists the stock of backpacks, lunch boxes, and water bottles "
        "(columns, in that order) at Eastside and Westside (rows, in that order). How many lunch boxes does Westside have?",
        ['49', '6', '15', '45'], 1))
    cases.append(fixture('matrix-data-reading',
        f"Matrix $A={bm((45, 49), (15, 6), (1, 2))}$ lists the stock of backpacks and lunch boxes "
        "(columns, in that order) at Eastside, Westside, and Lakeview (rows, in that order). "
        "Which statement describes the entry $a_{21}$, in row 2 and column 1?",
        ['The number of backpacks at Eastside', 'The number of backpacks at Westside',
         'The total backpacks at all stores', 'The number of lunch boxes at Westside'], 1))
    cases.append(fixture('matrix-operations',
        f"Let $A={bm((-1, -1), (0, 1))}$ and $B={bm((0, -1), (-3, 0))}$. Find $AB$.",
        [bm((0, 1), (0, 0)), bm((3, 1), (-3, 0)), bm((0, -1), (3, 3)), bm((1, 3), (-1, 0))], 1))
    cases.append(fixture('matrix-operations',
        f"Let $A={bm((-2, 2), (-1, 1))}$ and $B={bm((0, -5), (-2, -4))}$. Find $2A-B$.",
        [bm((-4, 9), (0, 6)), bm((-4, -1), (0, 6)), bm((-4, 9), (0, -2)), bm((0, 9), (0, 6))], 0))
    cases.append(fixture('matrix-operations',
        'Matrix $A$ is $2\\times2$ and matrix $B$ is $3\\times4$. Which statement about the product $AB$ is true?',
        ['AB\\text{ x}', 'AB\\text{ y}', 'AB\\text{ z}', 'AB\\text{ w}'], 0))
    cases[-1]['public']['response']['options'] = [
        {'id': 'option-a', 'label': '$AB$ is not defined: $A$ has 2 columns but $B$ has 3 rows'},
        {'id': 'option-b', 'label': '$AB$ is defined and is $2\\times4$'},
        {'id': 'option-c', 'label': '$AB$ is defined and is $2\\times3$'},
        {'id': 'option-d', 'label': '$AB$ is defined and is $4\\times2$'}]
    cases.append(fixture('matrix-laws',
        '$A$, $B$ and $C$ are $2\\times2$ matrices, and $I$ is the $2\\times2$ identity. Which equation holds for all such matrices?',
        ['(AB)C=A(BC)', '(A+B)(A-B)=A^2-B^2', 'AB=BA', '(A+B)^2=A^2+2AB+B^2'], 0))
    cases.append(fixture('matrix-laws',
        '$A$, $B$ and $C$ are $2\\times2$ matrices, and $I$ is the $2\\times2$ identity. Which equation does NOT hold for all such matrices?',
        ['(AB)C=A(BC)', 'AI=IA=A', 'AB=AC\\text{ implies }B=C', '(A+B)C=AC+BC'], 2))
    cases.append(fixture('matrix-laws',
        f"Let $A={bm((-1, 2), (-1, 3))}$ and $B={bm((-2, -2), (-1, -3))}$. Which statement is true?",
        ['AB\\ne BA: the entry in row 1, column 2 is $-10$ in $AB$ and $-4$ in $BA$',
         'AB\\ne BA: the entry in row 1, column 2 is $-4$ in $AB$ and $-10$ in $BA$',
         'AB=BA: the entry in row 1, column 2 is $-10$ in both',
         'AB=BA: the entry in row 1, column 2 is $-4$ in both'], 1))
    cases[-1]['public']['response']['options'] = [
        {'id': f'option-{c}', 'label': f'${l}$'.replace('$$', '$')} for c, l in zip('abcd', [
            'AB\\ne BA$: the entry in row 1, column 2 is $-10$ in $AB$ and $-4$ in $BA',
            'AB\\ne BA$: the entry in row 1, column 2 is $-4$ in $AB$ and $-10$ in $BA',
            'AB=BA$: the entry in row 1, column 2 is $-10$ in both',
            'AB=BA$: the entry in row 1, column 2 is $-4$ in both'])]
    cases.append(fixture('matrix-laws',
        'Which $2\\times2$ matrix $I$ satisfies $IA=A$ and $AI=A$ for every $2\\times2$ matrix $A$?',
        [bm((1, 0), (0, -1)), bm((1, 1), (1, 1)), bm((1, 0), (0, 1)), bm((0, 1), (1, 0))], 2))
    cases.append(fixture('matrix-inverse-determinant',
        f"Find the determinant of $A={bm((-3, -5), (2, -3))}$.", ['-19', '19', '-1', '21'], 1))
    cases.append(fixture('matrix-inverse-determinant',
        f"Find the inverse of $A={bm((4, 3), (-3, -2))}$.",
        [bm((-2, -3), (3, 4)), bm((-2, 3), (-3, 4)), bm((2, 3), (-3, -4)), bm((4, -3), (3, -2))], 0))
    cases.append(fixture('matrix-inverse-determinant',
        'Exactly one of these $2\\times2$ matrices has no inverse. Which one?',
        [bm((-3, 2), (-9, 6)), bm((-3, 1), (-9, 6)), bm((-3, 2), (-8, 6)), bm((-4, 2), (-9, 6))], 0))
    cases.append(fixture('matrix-inverse-determinant',
        f"For which value of $k$ does ${bm(('k', -5), (1, -2))}$ have no inverse?",
        ['-5', '\\frac{5}{2}', '\\frac{2}{5}', '-\\frac{5}{2}'], 1))
    cases.append(fixture('matrix-transformation',
        f"Multiplying the column ${bm(('x',), ('y',))}$ by $M={bm((-1, 0), (0, 1))}$ transforms points. What does it do?",
        ['Dilates points by a factor of 3 from the origin', 'Reflects points across the $y$-axis',
         'Rotates points $90^\\circ$ clockwise about the origin', 'Dilates points by a factor of 2 from the origin'], 1))
    cases[-1]['public']['response']['options'] = [
        {'id': f'option-{c}', 'label': l} for c, l in zip('abcd', [
            'Dilates points by a factor of 3 from the origin', 'Reflects points across the $y$-axis',
            'Rotates points $90^\\circ$ clockwise about the origin', 'Dilates points by a factor of 2 from the origin'])]
    cases.append(fixture('matrix-transformation',
        f"The matrix ${bm((0, 1), (-1, 0))}$ rotates points $90^\\circ$ clockwise about the origin. Where does it send $(-1, 5)$?",
        ['(5, 1)', '(-2, 10)', '(1, -5)', '(-1, -5)'], 0))
    cases.append(fixture('matrix-transformation',
        f"A triangle with area 8 square units is transformed by $M={bm((-4, -2), (4, -2))}$. What is the area of the image?",
        ['2048', '64', '24', '128'], 3))
    cases.append(fixture('matrix-transformation',
        f"The unit square (area 1) is transformed by $M={bm((3, -3), (-2, 2))}$. What is the area of its image?",
        ['1', '6', '0', '5'], 2))
    cases.append(fixture('matrix-transformation',
        'Which matrix reflects points across the line $y=x$, when it multiplies the column '
        f'${bm(("x",), ("y",))}$?',
        [bm((-1, 0), (0, 1)), bm((1, 0), (0, -1)), bm((0, 1), (1, 0)), bm((0, 1), (-1, 0))], 2))
    cases.append(fixture('matrix-linear-system',
        f"The system $2x - y = 7$, $-5x - 3y = -4$ is written $AX=B$ with $A={bm((2, -1), (-5, -3))}$. Can it be solved as $X=A^{{-1}}B$?",
        ['Yes: $\\det A=11$, so $A^{-1}$ exists', 'Yes: $\\det A=-11$, so $A^{-1}$ exists',
         'Yes: $\\det A=-1$, so $A^{-1}$ exists', 'No: $\\det A=0$, so $A^{-1}$ does not exist'], 1))
    cases[-1]['public']['response']['options'] = [
        {'id': f'option-{c}', 'label': l} for c, l in zip('abcd', [
            'Yes: $\\det A=11$, so $A^{-1}$ exists', 'Yes: $\\det A=-11$, so $A^{-1}$ exists',
            'Yes: $\\det A=-1$, so $A^{-1}$ exists', 'No: $\\det A=0$, so $A^{-1}$ does not exist'])]
    cases.append(fixture('matrix-linear-system',
        f"The system $2x - 4y = 3$, $-x + 2y = 1$ is written $AX=B$ with $A={bm((2, -4), (-1, 2))}$. Can it be solved as $X=A^{{-1}}B$?",
        ['Yes: $\\det A=0$, so $A^{-1}$ exists', 'Yes: $\\det A=8$, so $A^{-1}$ exists',
         'No: $\\det A=0$, so $A^{-1}$ does not exist', 'No: $\\det A=-8$, so $A^{-1}$ does not exist'], 2))
    cases[-1]['public']['response']['options'] = [
        {'id': f'option-{c}', 'label': l} for c, l in zip('abcd', [
            'Yes: $\\det A=0$, so $A^{-1}$ exists', 'Yes: $\\det A=8$, so $A^{-1}$ exists',
            'No: $\\det A=0$, so $A^{-1}$ does not exist', 'No: $\\det A=-8$, so $A^{-1}$ does not exist'])]
    cases.append(fixture('matrix-linear-system',
        f"The system $-x - 3y = 4$, $3x - 2y = -4$ is $AX=B$ with $A={bm((-1, -3), (3, -2))}$ and $B={bm((4,), (-4,))}$. "
        "Solve it using $X=A^{-1}B$.",
        ['(x, y)=(-\\frac{8}{11}, -\\frac{20}{11})', '(x, y)=(-\\frac{20}{11}, -\\frac{8}{11})',
         '(x, y)=(-20, -8)', '(x, y)=(\\frac{4}{11}, \\frac{16}{11})'], 1))
    cases.append(fixture('matrix-linear-system',
        f"For $AX=B$, the inverse is $A^{{-1}}=\\frac{{1}}{{4}}{bm((-2, -2), (-1, -3))}$ and $B={bm((-1,), (6,))}$. "
        "Find $(x, y)$ from $X=A^{-1}B$.",
        ['(x, y)=(-\\frac{17}{4}, -\\frac{5}{2})', '(x, y)=(-\\frac{5}{2}, -\\frac{17}{4})',
         '(x, y)=(\\frac{5}{2}, \\frac{17}{4})', '(x, y)=(-10, -17)'], 1))
    cases.append(fixture('matrix-linear-system',
        "Write the system $-3x - 5y + 7 = 0$ and $-5y - x - 4 = 0$ as $AX=B$ with "
        f"$X={bm(('x',), ('y',))}$. What is the constant matrix $B$?",
        [bm((7,), (-4,)), bm((4,), (-7,)), bm((7,), (4,)), bm((-7,), (4,))], 3))
    cases.append(fixture('matrix-linear-system',
        "Write the system $5x - 4y = -5$ and $4x - 4y = -9$ as $AX=B$ with "
        f"$X={bm(('x',), ('y',))}$. What is the coefficient matrix $A$?",
        [bm((5, -5), (4, -9)), bm((5, 4), (-4, -4)), bm((-4, 5), (-4, 4)), bm((5, -4), (4, -4))], 3))
    return cases


def mutate_option(problem, index, label):
    bad = copy.deepcopy(problem)
    bad['public']['response']['options'][index]['label'] = label
    return bad


def self_test():
    cases = self_test_cases()
    rejected = 0

    def reject(problem):
        nonlocal rejected
        try:
            review_problem(problem)
        except (ValueError, KeyError, TypeError, AttributeError, StopIteration, IndexError, SyntaxError):
            rejected += 1
            return
        raise ValueError('Corrupt vector or matrix case was accepted')
    for case in cases:
        review_problem(case)
        correct = int(case['answer'][-1:] and ord(case['answer'][-1]) - 97)
        wrong = (correct + 1) % 4
        bad = copy.deepcopy(case)
        bad['answer'] = case['public']['response']['options'][wrong]['id']
        reject(bad)  # key marks a distractor
        other = (correct + 2) % 4
        label = case['public']['response']['options'][correct]['label']
        reject(mutate_option(case, other, label))  # second choice equals the correct one
        bad = copy.deepcopy(case)
        if len(plain(label)) >= 5:
            bad['choiceFeedback'] = {case['public']['response']['options'][wrong]['id']: 'Careful: ' + plain(label)}
            reject(bad)  # distractor feedback leaks the correct label
    # Corrupt the givens: the answer key no longer matches an independent solve.
    shifted = copy.deepcopy(cases[2])
    shifted['public']['prompt'] = shifted['public']['prompt'].replace('3, -5', '3, -6')
    reject(shifted)
    misdrawn = copy.deepcopy(cases[0])
    misdrawn['public']['figure']['scene']['elements'][0]['points'][2]['x'] = -3
    reject(misdrawn)  # Q no longer lies at the end of the second arrow
    misdrawn = copy.deepcopy(cases[1])
    misdrawn['public']['figure']['scene']['elements'][0]['segments'][0]['arrow'] = False
    reject(misdrawn)  # a vector must be drawn with an arrowhead
    unrounded = copy.deepcopy(cases[6])
    unrounded['public']['prompt'] = unrounded['public']['prompt'].replace(' Round to the nearest tenth.', '')
    reject(unrounded)  # rounding instruction removed from an irrational magnitude
    directionless = copy.deepcopy(cases[7])
    directionless['public']['prompt'] = directionless['public']['prompt'].replace('east of north', 'from north')
    reject(directionless)  # reference axis no longer stated
    swapped = copy.deepcopy(cases[7])
    swapped['public']['prompt'] = swapped['public']['prompt'].replace('east of north', 'north of east')
    reject(swapped)  # the other reference axis picks a different angle
    wrong_matrix = copy.deepcopy(cases[11])
    wrong_matrix['public']['prompt'] = wrong_matrix['public']['prompt'].replace('Find $AB$', 'Find $BA$')
    reject(wrong_matrix)
    undefined = copy.deepcopy(cases[13])
    undefined['public']['prompt'] = undefined['public']['prompt'].replace('$3\\times4$', '$2\\times4$')
    reject(undefined)  # the product becomes defined, so the key is wrong
    law = copy.deepcopy(cases[14])
    law['public']['response']['options'][1]['label'] = '$A(B+C)=AB+AC$'
    reject(law)  # two laws now hold for all matrices
    transform = copy.deepcopy(cases[23])
    transform['public']['prompt'] = transform['public']['prompt'].replace('clockwise', 'counterclockwise')
    reject(transform)  # displayed matrix no longer matches the stated rotation
    area = copy.deepcopy(cases[25])
    area['public']['prompt'] = area['public']['prompt'].replace('3&-3', '3&-2')
    reject(area)  # singular matrix made non-singular
    system = copy.deepcopy(cases[27])
    system['public']['prompt'] = system['public']['prompt'].replace('2x - y = 7', '2x + y = 7')
    reject(system)  # displayed A no longer matches the equations
    return {'fixtures': len(cases), 'rejectedMutations': rejected}


if __name__ == '__main__':
    print(self_test())
