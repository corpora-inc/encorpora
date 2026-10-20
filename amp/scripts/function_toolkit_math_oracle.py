"""Independent prompt- and figure-only checks for the function toolkit:
piecewise functions, transformations, composition, inverses and comparisons
across representations.

TeX in prompts and options is read by a small reader written here (fractions,
roots, powers, absolute values, implicit products) and evaluated exactly with
Fractions (roots exactly when they are rational, else as floats compared with
a tolerance). Piecewise rules are chosen by their written conditions,
transformations are rebuilt from their words, compositions and inverses are
evaluated or searched, graphs are read from the scene's function specs and
their open and closed ends, and tables from their cells. Nothing here calls
the TypeScript generators; malformed or ambiguous givens are rejected.
"""
import ast
import copy
import json
import math
import re
import subprocess
from fractions import Fraction
from pathlib import Path

from linear_function_math_oracle import arithmetic_claims

FUNCTION_TOOLKIT_NUMBER = frozenset({'piecewise-evaluate', 'transform-point', 'composition-value', 'inverse-value'})
FUNCTION_TOOLKIT_CHOICE = frozenset({
    'piecewise-reading', 'transform-equation', 'composition-expression', 'inverse-expression', 'compare-representations',
})
FUNCTION_TOOLKIT = FUNCTION_TOOLKIT_NUMBER | FUNCTION_TOOLKIT_CHOICE
EPS = 1e-9


def require(condition, message):
    if not condition:
        raise ValueError(message)


# ------------------------------------------------------------ TeX reader
def braced(s, i):
    """The contents of the brace group starting at s[i] == '{', and the index after it."""
    require(s[i] == '{', 'Expected a brace group in ' + s)
    depth = 0
    for j in range(i, len(s)):
        if s[j] == '{':
            depth += 1
        elif s[j] == '}':
            depth -= 1
            if depth == 0:
                return s[i + 1:j], j + 1
    raise ValueError('Unbalanced braces in ' + s)


def python_source(tex):
    """TeX of an expression in x (or another letter) to Python source."""
    s = tex.replace('\\left', '').replace('\\right', '').replace('−', '-').replace('\\cdot', '*').replace('\\,', '')
    out, i = '', 0
    while i < len(s):
        if s.startswith('\\frac', i):
            a, i = braced(s, i + 5)
            b, i = braced(s, i)
            out += f'(({python_source(a)})/({python_source(b)}))'
        elif s.startswith('\\sqrt', i):
            a, i = braced(s, i + 5)
            out += f'sqrt({python_source(a)})'
        elif s[i] == '^':
            if s[i + 1] == '{':
                a, i = braced(s, i + 1)
            else:
                a, i = s[i + 1], i + 2
            out += f'**({python_source(a)})'
        elif s[i] == '|':
            j = s.index('|', i + 1)
            out += f'abs({python_source(s[i + 1:j])})'
            i = j + 1
        else:
            require(s[i] != '\\', 'Unsupported TeX command in ' + tex)
            out += s[i]
            i += 1
    # Implicit products: 2x, 3(…), x(…) is not used, )( and 2sqrt.
    tokens = re.findall(r'sqrt|abs|\d+(?:\.\d+)?|[a-z]|\*\*|[-+*/()]|\s+', out)
    require(''.join(tokens) == out, f'Unreadable expression {tex!r}')
    result, prev = [], None
    for t in tokens:
        if t.isspace():
            continue
        starts = t in ('(', 'sqrt', 'abs') or re.fullmatch(r'\d+(?:\.\d+)?|[a-z]', t)
        ends = prev is not None and (prev == ')' or re.fullmatch(r'\d+(?:\.\d+)?|[a-z]', prev))
        if starts and ends:
            result.append('*')
        result.append(t)
        prev = t
    return ' '.join(result)


def exact_sqrt(v):
    require(v >= 0, 'Square root of a negative number')
    if isinstance(v, Fraction):
        n, d = math.isqrt(v.numerator), math.isqrt(v.denominator)
        if n * n == v.numerator and d * d == v.denominator:
            return Fraction(n, d)
    return math.sqrt(v)


def run(node, env):
    if isinstance(node, ast.Constant):
        return Fraction(str(node.value))
    if isinstance(node, ast.Name):
        require(node.id in env, 'Unbound variable ' + node.id)
        return env[node.id]
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.USub, ast.UAdd)):
        v = run(node.operand, env)
        return -v if isinstance(node.op, ast.USub) else v
    if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and len(node.args) == 1:
        v = run(node.args[0], env)
        if node.func.id == 'abs':
            return abs(v)
        if node.func.id == 'sqrt':
            return exact_sqrt(v)
    if isinstance(node, ast.BinOp):
        a, b = run(node.left, env), run(node.right, env)
        if isinstance(node.op, ast.Add):
            return a + b
        if isinstance(node.op, ast.Sub):
            return a - b
        if isinstance(node.op, ast.Mult):
            return a * b
        if isinstance(node.op, ast.Div):
            require(b != 0, 'Division by zero')
            return a / b
        if isinstance(node.op, ast.Pow):
            require(b == int(b) and -12 <= b <= 12, 'Unsupported power')
            require(a != 0 or b >= 0, 'Zero to a negative power')
            return Fraction(a) ** int(b) if isinstance(a, Fraction) else a ** int(b)
    raise ValueError('Unsupported expression: ' + ast.dump(node))


def fn_of(tex, var='x'):
    node = ast.parse(python_source(tex), mode='eval').body

    def call(x):
        return run(node, {var: Fraction(x)})
    return call


def value(tex):
    return run(ast.parse(python_source(tex), mode='eval').body, {})


def same(a, b):
    return abs(float(a) - float(b)) < EPS


def defined(f, x):
    try:
        return f(x)
    except (ValueError, ZeroDivisionError):
        return None


def agree(f, g, xs):
    for x in xs:
        a, b = defined(f, x), defined(g, x)
        if a is None or b is None or not same(a, b):
            return False
    return True


def number(text):
    t = text.strip().strip('$').replace('−', '-')
    return value(t)


def maths(text):
    return re.findall(r'\$([^$]+)\$', text)


def options(public):
    response = public['response']
    require(response['kind'] == 'choice', 'Expected a choice response')
    return [(o['id'], o['label']) for o in response['options']]


def only(public, truth):
    true = []
    for oid, label in options(public):
        try:
            if truth(label):
                true.append(oid)
        except (ValueError, SyntaxError, ZeroDivisionError, KeyError, IndexError):
            pass
    require(len(true) == 1, f'Expected exactly one true option, found {len(true)}: {public["prompt"]}')
    return true[0]


def label_tex(label):
    m = re.fullmatch(r'\$([^$]+)\$', label)
    require(m is not None, 'Expected a formula option: ' + label)
    return m[1]


# ------------------------------------------------------------ figures
def element(public, kind):
    figure = public.get('figure')
    require(figure and figure['kind'] == 'scene', 'Expected a scene figure')
    found = [e for e in figure['scene']['elements'] if e['type'] == kind]
    require(len(found) == 1, f'Expected one {kind}')
    return found[0]


def spec_fn(fn):
    """A scene function spec as a callable (exact where it can be)."""
    q = lambda v: Fraction(str(v))
    if fn['f'] == 'poly':
        c = [q(v) for v in fn['c']]
        return lambda x: sum(v * Fraction(x) ** i for i, v in enumerate(c))
    a, h, k = q(fn.get('a', 1)), q(fn.get('h', 0)), q(fn.get('k', 0))
    if fn['f'] == 'abs':
        return lambda x: a * abs(Fraction(x) - h) + k
    if fn['f'] == 'sqrt':
        return lambda x: a * exact_sqrt(Fraction(x) - h) + k
    if fn['f'] == 'exp':
        b = q(fn['b'])
        return lambda x: a * b ** int(Fraction(x) - h) + k if Fraction(x) - h == int(Fraction(x) - h) else a * float(b) ** float(Fraction(x) - h) + k
    if fn['f'] == 'log':
        base = float(fn['base'])
        return lambda x: a * math.log(float(Fraction(x) - h)) / math.log(base) + k
    raise ValueError('Unsupported function family ' + fn['f'])


def table_rows(public):
    t = element(public, 'lineTable')
    cell = lambda c: c if isinstance(c, str) else c['text']
    return {row[0]: [cell(c) for c in row[1:]] for row in (list(map(cell, r)) for r in t['rows'])}


def table_fn(rows, head):
    xs = [number(v) for v in rows['x']]
    ys = [number(v) for v in rows[head]]
    require(len(set(xs)) == len(xs), 'Repeated table input')
    return dict(zip(xs, ys))


class Piece:
    def __init__(self, fn, lo, hi, lo_in, hi_in):
        self.fn, self.lo, self.hi, self.lo_in, self.hi_in = fn, lo, hi, lo_in, hi_in

    def holds(self, x):
        return (self.lo is None or x > self.lo or (self.lo_in and x == self.lo)) and \
               (self.hi is None or x < self.hi or (self.hi_in and x == self.hi))


def graph_pieces(public):
    """Pieces drawn on the graph: a restricted domain ending in a closed dot
    includes its end, an open circle excludes it, and an arrow at the window
    edge continues past it."""
    g = element(public, 'graph')
    out = []
    for c in g.get('curves', []):
        lo, hi = c.get('domain', g['x'])
        ends = c.get('ends', ['closed', 'closed'] if 'domain' in c else ['none', 'none'])
        lo = Fraction(str(lo)); hi = Fraction(str(hi))
        lo_open_end = ends[0] == 'arrow' and lo == Fraction(str(g['x'][0]))
        hi_open_end = ends[1] == 'arrow' and hi == Fraction(str(g['x'][1]))
        require(ends[0] in ('open', 'closed') or lo_open_end, 'A piece must end in a dot or leave the window')
        require(ends[1] in ('open', 'closed') or hi_open_end, 'A piece must end in a dot or leave the window')
        out.append(Piece(spec_fn(c['fn']), None if lo_open_end else lo, None if hi_open_end else hi,
                         ends[0] == 'closed', ends[1] == 'closed'))
    return out, g


# ------------------------------------------------------------ conditions
REL = {'<': lambda a, b: a < b, '\\le': lambda a, b: a <= b, '>': lambda a, b: a > b, '\\ge': lambda a, b: a >= b}


def condition(text, var='x'):
    """A written condition ("x < 2", "-3 \\le x < 0", "0 < w \\le 4") as a predicate."""
    t = text.strip()
    v = re.escape(var)
    m = re.fullmatch(rf'(-?\d+) (<|\\le) {v} (<|\\le) (-?\d+)', t)
    if m:
        lo, hi = int(m[1]), int(m[4])
        require(lo < hi, 'Empty interval')
        return lambda x: REL[m[2]](lo, x) and REL[m[3]](x, hi)
    m = re.fullmatch(rf'{v} (<|\\le|>|\\ge) (-?\d+)', t)
    require(m is not None, 'Unreadable condition: ' + text)
    c = int(m[2])
    return lambda x: REL[m[1]](x, c)


def cases(tex, var='x'):
    m = re.fullmatch(r'\\begin\{cases\} (.+) \\end\{cases\}', tex.strip())
    require(m is not None, 'Not a cases expression')
    rows = []
    for row in m[1].split(' \\\\ '):
        rule, cond = row.split(' & ')
        rows.append((fn_of(rule, var), condition(cond, var)))
    return rows


def piecewise_at(rows, x, domain=(-12, 12)):
    # The conditions never overlap anywhere in a wide window, so every input
    # has one rule.
    for k in range(domain[0] * 4, domain[1] * 4 + 1):
        u = Fraction(k, 4)
        require(sum(1 for _, c in rows if c(u)) <= 1, 'Overlapping conditions')
    hits = [f for f, c in rows if c(x)]
    require(len(hits) == 1, 'The input satisfies no condition, or several')
    return hits[0](x)


# ------------------------------------------------------------ solvers
def solve_piecewise_evaluate(public):
    p = public['prompt']
    m = re.fullmatch(r'(?:Let \$f\(x\) = (.+)\$\. What is \$f\((-?\d+)\)\$\?|A function is defined by \$f\(x\) = (.+)\$\. Find \$f\((-?\d+)\)\$\.)', p)
    if m:
        tex, x = (m[1], m[2]) if m[1] else (m[3], m[4])
        return piecewise_at(cases(tex), Fraction(int(x)))
    m = re.fullmatch(r'The graph shows \$y = f\(x\)\$\. What is \$f\((-?\d+)\)\$\?', p)
    if m:
        x = Fraction(int(m[1]))
        pieces, g = graph_pieces(public)
        hits = [q for q in pieces if q.holds(x)]
        require(len(hits) == 1, 'The graph must have one point above the input')
        y = hits[0].fn(x)
        require(g['y'][0] < y < g['y'][1] and y == int(y), 'The point is readable on the grid')
        return y
    m = re.fullmatch(r'A courier charges \$C\(w\)\$ dollars to ship a parcel of \$w\$ kilograms, where \$C\(w\) = (.+)\$\. What does a parcel of (\d+) kilograms cost to ship, in dollars\?', p) or \
        re.fullmatch(r'A phone plan costs \$C\(g\)\$ dollars for a month in which \$g\$ gigabytes of data are used, where \$C\(g\) = (.+)\$\. What does a month with (\d+) gigabytes cost, in dollars\?', p)
    require(m is not None, 'Unknown piecewise prompt: ' + p)
    var = 'w' if p.startswith('A courier') else 'g'
    return piecewise_at(cases(m[1], var), Fraction(int(m[2])), (0, 20))


COUNTS = {'None': 0, 'Exactly one': 1, 'Exactly two': 2, 'Exactly three': 3}


def solve_piecewise_reading(public):
    p = public['prompt']
    m = re.fullmatch(r'Let \$f\(x\) = (.+)\$\. Which expression equals \$f\(x\)\$ for \$(.+)\$\?', p)
    if m:
        f, cond = fn_of(m[1]), condition(m[2])
        h = int(re.search(r'-?\d+$', m[2])[0])
        xs = [x for x in [h - 3, h - 1.5, h - 1, h, h + 1, h + 2.5, h + 4] if cond(Fraction(x))]
        require(len(xs) >= 3, 'Too few sample inputs')
        return only(public, lambda label: agree(f, fn_of(label_tex(label)), xs))
    m = re.fullmatch(r'The graph of \$y = f\(x\)\$ is made of two pieces\. Which rule gives \$f\(x\)\$ for \$(.+)\$\?', p)
    if m:
        cond = condition(m[1])
        pieces, g = graph_pieces(public)
        require(len(pieces) == 2, 'Two pieces')
        grid = [Fraction(k, 2) for k in range(int(g['x'][0]) * 2, int(g['x'][1]) * 2 + 1)]
        match = [q for q in pieces if all(q.holds(x) == cond(x) for x in grid)]
        require(len(match) == 1, 'The condition names one drawn piece')
        xs = [x for x in grid if cond(x)][:5]
        return only(public, lambda label: agree(match[0].fn, fn_of(label_tex(label)), xs))
    m = re.fullmatch(r'The graph shows \$y = f\(x\)\$ and the dashed line \$y = (-?\d+)\$\. How many solutions does \$f\(x\) = (-?\d+)\$ have\?', p)
    require(m is not None and m[1] == m[2], 'Unknown piecewise reading prompt: ' + p)
    level = Fraction(int(m[1]))
    pieces, g = graph_pieces(public)
    lines = g.get('lines', [])
    require(len(lines) == 1 and lines[0]['line'] == {'m': 0, 'b': int(level)}, 'The dashed line is drawn at the level')
    x0, x1 = Fraction(str(g['x'][0])), Fraction(str(g['x'][1]))
    solutions = set()
    for q in pieces:
        b, s = q.fn(0), q.fn(1) - q.fn(0)
        require(q.fn(2) - q.fn(1) == s, 'Pieces are linear')
        if s == 0:
            require(b != level, 'A flat piece on the line has infinitely many solutions')
            continue
        x = (level - b) / s
        if q.holds(x):
            require(x0 < x < x1, 'Every solution is inside the window')
            solutions.add(x)
    count = len(solutions)
    return only(public, lambda label: COUNTS[label] == count)


PARENT = {'x^2': lambda u: u * u, '|x|': abs, '\\sqrt{x}': exact_sqrt, 'x^3': lambda u: u ** 3}


def parent_of(tex):
    require(tex in PARENT, 'Unknown parent ' + tex)
    return PARENT[tex]


def words_transform(base, text):
    """Rebuild y = a·p(x − h) + k from the written steps, in order."""
    f = base
    parts = re.split(r', and then |, ', text)
    for part in parts:
        m = re.fullmatch(r'shifted (\d+) units? (left|right|up|down)', part)
        if m:
            d = Fraction(int(m[1]))
            if m[2] in ('left', 'right'):
                s = d if m[2] == 'right' else -d
                f = (lambda g, s: lambda x: g(x - s))(f, s)
            else:
                s = d if m[2] == 'up' else -d
                f = (lambda g, s: lambda x: g(x) + s)(f, s)
            continue
        if part == 'reflected across the $x$-axis':
            f = (lambda g: lambda x: -g(x))(f)
            continue
        m = re.fullmatch(r'stretched vertically by a factor of (\d+)', part)
        require(m is not None, 'Unknown step: ' + part)
        f = (lambda g, a: lambda x: a * g(x))(f, int(m[1]))
    return f, len(parts)


def mapping(g_tex):
    """The point map (p, q) → (p', q') of y = g_tex from y = f(x)."""
    m = re.fullmatch(r'(-?\d*)f\((-?\d*)x(?: ([+-]) (\d+))?\)(?: ([+-]) (\d+))?', g_tex)
    require(m is not None, 'Unreadable transformed rule ' + g_tex)
    A = -1 if m[1] == '-' else int(m[1]) if m[1] else 1
    B = -1 if m[2] == '-' else int(m[2]) if m[2] else 1
    C = 0 if not m[3] else (int(m[4]) if m[3] == '+' else -int(m[4]))
    D = 0 if not m[5] else (int(m[6]) if m[5] == '+' else -int(m[6]))
    return lambda p: (Fraction(p[0] - C, B), A * p[1] + D)


def option_move(label):
    m = re.fullmatch(r'Shift (\d+) units? (left|right|up|down)', label)
    if m:
        d = int(m[1])
        return {'left': lambda p: (p[0] - d, p[1]), 'right': lambda p: (p[0] + d, p[1]),
                'up': lambda p: (p[0], p[1] + d), 'down': lambda p: (p[0], p[1] - d)}[m[2]]
    fixed = {
        'Reflect across the $x$-axis': lambda p: (p[0], -p[1]),
        'Reflect across the $y$-axis': lambda p: (-p[0], p[1]),
        'Reflect across the line $y = x$': lambda p: (p[1], p[0]),
        'Turn a half turn about the origin': lambda p: (-p[0], -p[1]),
    }
    if label in fixed:
        return fixed[label]
    m = re.fullmatch(r'(Multiply|Divide) every \$(x|y)\$-coordinate by (\d+)', label)
    require(m is not None, 'Unknown description ' + label)
    s = Fraction(int(m[3])) if m[1] == 'Multiply' else Fraction(1, int(m[3]))
    return (lambda p: (s * p[0], p[1])) if m[2] == 'x' else (lambda p: (p[0], s * p[1]))


def solve_transform_equation(public):
    p = public['prompt']
    m = re.fullmatch(r'The graph of \$y = (.+?)\$ is (.+)\. Which equation describes the new graph\?', p)
    if m:
        target, steps = words_transform(parent_of(m[1]), m[2])
        require(steps >= 2, 'At least two steps')
        xs = [Fraction(k) for k in range(-8, 9)]
        live = [x for x in xs if defined(target, x) is not None]
        require(len(live) >= 4, 'Too few inputs in the domain')
        return only(public, lambda label: agree(target, fn_of(label_tex(label)[4:]), live) and label_tex(label).startswith('y = '))
    m = re.fullmatch(r'The dashed curve is \$y = (.+)\$\. Which equation describes the solid curve\?', p)
    if m:
        g = element(public, 'graph')
        parent = parent_of(m[1])
        dashed, solid = g['curves']
        require(dashed.get('dash') == 'dash' and agree(parent, spec_fn(dashed['fn']), [0, 1, 2]), 'The dashed curve is the parent')
        f = spec_fn(solid['fn'])
        lo, hi = solid['domain']
        xs = [Fraction(k) for k in range(math.ceil(lo), math.floor(hi) + 1)]
        require(len(xs) >= 3, 'Too few readable inputs')
        return only(public, lambda label: label_tex(label).startswith('y = ') and agree(f, fn_of(label_tex(label)[4:]), xs))
    m = re.fullmatch(r'How does the graph of \$y = (.+)\$ compare with the graph of \$y = f\(x\)\$\?', p)
    require(m is not None, 'Unknown transformation prompt: ' + p)
    move = mapping(m[1])
    tests = [(Fraction(3), Fraction(7)), (Fraction(-2), Fraction(5)), (Fraction(4), Fraction(-6))]
    return only(public, lambda label: all(option_move(label)(t) == move(t) for t in tests))


def point(tex):
    t = tex.replace('\\left', '').replace('\\right', '')
    m = re.fullmatch(r'\((.+), (.+)\)', t)
    require(m is not None, 'Not a point: ' + tex)
    return m[1], m[2]


def solve_transform_point(public):
    p = public['prompt']
    m = re.fullmatch(r'The graph shows \$y = f\(x\)\$\. Let \$g\(x\) = (-?\d*)f\(x\)(?: ([+-]) (\d+))?\$\. What is \$g\((-?\d+)\)\$\?', p)
    if m:
        A = -1 if m[1] == '-' else int(m[1]) if m[1] else 1
        K = 0 if not m[2] else (int(m[3]) if m[2] == '+' else -int(m[3]))
        g = element(public, 'graph')
        require(len(g['curves']) == 1, 'One graph of f')
        x = Fraction(int(m[4]))
        y = spec_fn(g['curves'][0]['fn'])(x)
        require(y == int(y) and g['y'][0] < y < g['y'][1] and g['x'][0] < x < g['x'][1], 'f(x) is readable on the grid')
        return A * y + K
    m = re.fullmatch(r'The point \$(.+?)\$ is on the graph of \$y = f\(x\)\$\. The graph of \$y = (.+?)\$ passes through \$(.+?)\$\. What is \$(p|q)\$\?', p)
    if m:
        x0, y0 = (number(v) for v in point(m[1]))
        rule = m[2]
        px, qy = point(m[3])
        unknown = m[4]
        n = re.fullmatch(r'(-?)f\((.+)\)', rule)
        require(n is not None, 'Unreadable rule ' + rule)
        sign = -1 if n[1] else 1
        inner = fn_of(n[2])
        b0, s = inner(0), inner(1) - inner(0)
        require(inner(2) - inner(1) == s and s != 0, 'A linear input')
        x_new = (x0 - b0) / s
        y_new = sign * y0
        if unknown == 'p':
            require(px == 'p' and number(qy) == y_new, 'The stated height must match')
            return x_new
        require(qy == 'q' and number(px) == x_new, 'The stated input must match')
        return y_new
    m = re.fullmatch(r'\$f\$ is an (even|odd) function and \$f\((-?\d+)\) = (-?\d+)\$\. What is \$f\((-?\d+)\)\$\?', p)
    require(m is not None, 'Unknown transform-point prompt: ' + p)
    require(int(m[4]) == -int(m[2]) and int(m[2]) != 0, 'Asked at the opposite input')
    v = Fraction(int(m[3]))
    return v if m[1] == 'even' else -v


def composite(expr):
    m = re.fullmatch(r'(f|g)\((f|g)\((-?\d+)\)\)', expr) or re.fullmatch(r'\((f|g) \\circ (f|g)\)\((-?\d+)\)', expr)
    require(m is not None and m[1] != m[2], 'Unreadable composition ' + expr)
    return m[1], m[2], Fraction(int(m[3]))


def solve_composition_value(public):
    p = public['prompt']
    m = re.fullmatch(r'Let \$f\(x\) = \\frac\{(\d+)\}\{x ([+-]) (\d+)\}\$ and \$g\(x\) = (.+)\$\. Which value of \$x\$ is not in the domain of \$f\(g\(x\)\)\$\?', p)
    if m:
        c = Fraction(int(m[3])) * (1 if m[2] == '-' else -1)
        g = fn_of(m[4])
        b, s = g(0), g(1) - g(0)
        require(g(2) - g(1) == s and s != 0, 'A linear inner function')
        return (c - b) / s
    m = re.fullmatch(r'Let \$f\(x\) = (.+?)\$ and \$g\(x\) = (.+?)\$\. What is \$(.+)\$\?', p)
    if m:
        fns = {'f': fn_of(m[1]), 'g': fn_of(m[2])}
        outer, inner, a = composite(m[3])
        return fns[outer](fns[inner](a))
    m = re.fullmatch(r'The table gives values of \$f\$ and \$g\$\. What is \$(.+)\$\?', p)
    if m:
        rows = table_rows(public)
        fns = {'f': table_fn(rows, 'f(x)'), 'g': table_fn(rows, 'g(x)')}
        outer, inner, a = composite(m[1])
        require(a in fns[inner], 'The input is in the table')
        mid = fns[inner][a]
        require(mid in fns[outer], 'The inner output is in the table')
        return fns[outer][mid]
    m = re.fullmatch(r'The graphs show \$y = f\(x\)\$ and \$y = g\(x\)\$\. What is \$(.+)\$\?', p)
    require(m is not None, 'Unknown composition prompt: ' + p)
    g = element(public, 'graph')
    fns = {}
    for c in g['curves']:
        name = {'y = f(x)': 'f', 'y = g(x)': 'g'}[c['label']]
        fns[name] = spec_fn(c['fn'])
    require(set(fns) == {'f', 'g'}, 'Both graphs are labelled')
    outer, inner, a = composite(m[1])
    mid = fns[inner](a)
    out = fns[outer](mid)
    for x, y in [(a, mid), (mid, out)]:
        require(y == int(y) and g['x'][0] < x < g['x'][1] and g['y'][0] < y < g['y'][1], 'Each reading is on the grid')
    return out


SAMPLES = [Fraction(k, 2) for k in range(-7, 8)]


def solve_composition_expression(public):
    p = public['prompt']
    m = re.fullmatch(r'Let \$f\(x\) = (.+?)\$ and \$g\(x\) = (.+?)\$\. Which expression equals \$(f\(g\(x\)\)|g\(f\(x\)\))\$\?', p)
    if m:
        f, g = fn_of(m[1]), fn_of(m[2])
        target = (lambda x: f(g(x))) if m[3] == 'f(g(x))' else (lambda x: g(f(x)))
        return only(public, lambda label: agree(target, fn_of(label_tex(label)), SAMPLES))
    m = re.fullmatch(r'\$h\(x\) = (.+?)\$ can be written as \$h\(x\) = f\(g\(x\)\)\$ with \$(f|g)\(x\) = (.+?)\$\. Which is \$(f|g)\(x\)\$\?', p)
    require(m is not None and m[2] != m[4], 'Unknown composition-expression prompt: ' + p)
    h, known = fn_of(m[1]), fn_of(m[3])
    if m[2] == 'g':
        return only(public, lambda label: agree(h, (lambda o: lambda x: o(known(x)))(fn_of(label_tex(label))), SAMPLES))
    return only(public, lambda label: agree(h, (lambda o: lambda x: known(o(x)))(fn_of(label_tex(label))), SAMPLES))


def search_input(f, v, window=range(-60, 61)):
    xs = [Fraction(x) for x in window if defined(f, x) is not None and same(f(x), v)]
    require(len(xs) == 1, 'Exactly one input gives the value')
    return xs[0]


def monotone(f, xs):
    ys = [f(x) for x in xs]
    require(all(a < b for a, b in zip(ys, ys[1:])) or all(a > b for a, b in zip(ys, ys[1:])), 'The function is one-to-one')


def solve_inverse_value(public):
    p = public['prompt']
    m = re.fullmatch(r'Let \$f\(x\) = (.+)\$\. What is \$f\^\{-1\}\((-?\d+)\)\$\?', p)
    if m:
        f = fn_of(m[1])
        monotone(f, [Fraction(k) for k in range(-6, 7)])
        return search_input(f, Fraction(int(m[2])))
    m = re.fullmatch(r'The table shows values of the one-to-one function \$f\$\. What is \$f\^\{-1\}\((-?\d+)\)\$\?', p)
    if m:
        table = table_fn(table_rows(public), 'f(x)')
        require(len(set(table.values())) == len(table), 'The table is one-to-one')
        v = Fraction(int(m[1]))
        hits = [x for x, y in table.items() if y == v]
        require(len(hits) == 1, 'The value is in the table')
        return hits[0]
    m = re.fullmatch(r'The graph shows the one-to-one function \$y = f\(x\)\$\. What is \$f\^\{-1\}\((-?\d+)\)\$\?', p)
    require(m is not None, 'Unknown inverse prompt: ' + p)
    g = element(public, 'graph')
    require(len(g['curves']) == 1, 'One curve')
    c = g['curves'][0]
    f = spec_fn(c['fn'])
    lo, hi = c.get('domain', g['x'])
    xs = [Fraction(k) for k in range(math.ceil(max(lo, g['x'][0])), math.floor(min(hi, g['x'][1])) + 1)]
    monotone(f, [x for x in xs if defined(f, x) is not None])
    x = search_input(f, Fraction(int(m[1])), [int(v) for v in xs])
    require(g['y'][0] < int(m[1]) < g['y'][1], 'The value is on the grid')
    return x


def solve_inverse_expression(public):
    p = public['prompt']
    m = re.fullmatch(r'Let \$f\(x\) = (.+)\$\. Which expression is \$f\^\{-1\}\(x\)\$\?', p)
    if m:
        f = fn_of(m[1])
        xs = [Fraction(k, 3) for k in range(-9, 10)]

        def inverse(label):
            o = fn_of(label_tex(label))
            return agree(lambda x: f(o(x)), lambda x: x, xs) and agree(lambda x: o(f(x)), lambda x: x, xs)
        return only(public, inverse)
    m = re.fullmatch(r'The function \$f\(x\) = (.+?)\$ with domain \$x (\\ge|\\le) (-?\d+)\$ is one-to-one\. Which expression is \$f\^\{-1\}\(x\)\$\?', p)
    if m:
        f = fn_of(m[1])
        h = Fraction(int(m[3]))
        side = 1 if m[2] == '\\ge' else -1
        xs = [h + side * Fraction(t, 2) for t in range(0, 9)]
        monotone(f, xs)
        return only(public, lambda label: agree(lambda x: fn_of(label_tex(label))(f(x)), lambda x: x, xs))
    m = re.fullmatch(r'The graph of \$y = f\(x\)\$ passes through \$\((-?\d+), (-?\d+)\)\$, and \$f\$ has an inverse\. Which point is on the graph of \$y = f\^\{-1\}\(x\)\$\?', p)
    if m:
        target = (Fraction(int(m[2])), Fraction(int(m[1])))
        return only(public, lambda label: tuple(value(v) for v in point(label_tex(label))) == target)
    m = re.fullmatch(r'The function \$f\(x\) = (.+)\$ is not one-to-one\. On which domain does it have an inverse function\?', p)
    require(m is not None, 'Unknown inverse-expression prompt: ' + p)
    f = fn_of(m[1])
    a = (f(1) + f(-1) - 2 * f(0)) / 2
    b = (f(1) - f(-1)) / 2
    require(a != 0 and agree(f, lambda x: a * x * x + b * x + f(0), SAMPLES), 'A quadratic')
    vertex = -b / (2 * a)

    def one_to_one(label):
        if label == 'All real numbers':
            return False
        n = re.fullmatch(r'\$x (\\ge|\\le) (-?\d+)\$', label)
        require(n is not None, 'Unreadable domain ' + label)
        c = Fraction(int(n[2]))
        return c >= vertex if n[1] == '\\ge' else c <= vertex
    return only(public, one_to_one)


FEATURES = {
    'maximum value': 'maximum', 'minimum value': 'minimum', '$y$-intercept': 'intercept',
    'average rate of change from $x = 0$ to $x = 2$': 'rate',
}


def quadratic_extreme(f, kind):
    a = (f(1) + f(-1) - 2 * f(0)) / 2
    b = (f(1) - f(-1)) / 2
    require(agree(f, lambda x: a * x * x + b * x + f(0), SAMPLES), 'Not a quadratic')
    require(a < 0 if kind == 'maximum' else a > 0, f'A quadratic without a {kind}')
    return f(-b / (2 * a))


def feature_of(f, kind):
    if kind in ('maximum', 'minimum'):
        return quadratic_extreme(f, kind)
    if kind == 'intercept':
        return f(0)
    return (f(2) - f(0)) / 2


def solve_compare(public):
    p = public['prompt']
    m = re.fullmatch(r'The function \$f\$ is defined by \$f\(x\) = (.+?)\$\. (The graph shows (?:the quadratic function )?\$y = g\(x\)\$\.|The table shows values of (?:the quadratic function )?\$g\$\.) Which statement is true\?', p)
    require(m is not None, 'Unknown comparison prompt: ' + p)
    f = fn_of(m[1])
    quadratic = 'quadratic' in m[2]
    if m[2].startswith('The graph'):
        g_el = element(public, 'graph')
        require(len(g_el['curves']) == 1, 'One graph of g')
        g = spec_fn(g_el['curves'][0]['fn'])
        readable = lambda x: g_el['x'][0] < x < g_el['x'][1] and g_el['y'][0] < g(x) < g_el['y'][1] and g(x) == int(g(x))
    else:
        table = table_fn(table_rows(public), 'g(x)')
        xs = sorted(table)
        if quadratic:
            # Fit the quadratic through three entries and check every entry.
            x0, x1, x2 = xs[:3]
            def g(x, x0=x0, x1=x1, x2=x2):
                x = Fraction(x)
                return sum(table[xi] * math.prod((x - xj) / (xi - xj) for xj in (x0, x1, x2) if xj != xi) for xi in (x0, x1, x2))
            require(all(g(x) == y for x, y in table.items()), 'The table is quadratic')
        else:
            def g(x):
                require(Fraction(x) in table, 'The table does not give g there')
                return table[Fraction(x)]
        readable = lambda x: Fraction(x) in table
    labels = [label for _, label in options(public)]
    kinds = set()
    for label in labels:
        for text, kind in FEATURES.items():
            if label.endswith(text):
                kinds.add(kind)
    require(len(kinds) == 1, 'One feature compared')
    kind = kinds.pop()
    fv, gv = feature_of(f, kind), feature_of(g, kind)
    if kind in ('maximum', 'minimum'):
        a = (g(1) + g(-1) - 2 * g(0)) / 2
        b = (g(1) - g(-1)) / 2
        require(readable(-b / (2 * a)), "g's vertex is shown")
    elif kind == 'intercept':
        require(readable(0), "g(0) is shown")
    else:
        require(readable(0) and readable(2), "g(0) and g(2) are shown")
    text = {v: k for k, v in FEATURES.items()}[kind]

    def true(label):
        if label == f'$f$ has the greater {text}':
            return fv > gv
        if label == f'$g$ has the greater {text}':
            return gv > fv
        if label == f'$f$ and $g$ have the same {text}':
            return fv == gv
        n = re.fullmatch(r'\$f\((-?\d+)\) = g\((-?\d+)\)\$', label)
        require(n is not None and n[1] == n[2], 'Unknown statement ' + label)
        c = Fraction(int(n[1]))
        require(readable(c), 'The statement is checkable')
        return f(c) == g(c)
    return only(public, true)


SOLVERS = {
    'piecewise-evaluate': solve_piecewise_evaluate,
    'piecewise-reading': solve_piecewise_reading,
    'transform-equation': solve_transform_equation,
    'transform-point': solve_transform_point,
    'composition-value': solve_composition_value,
    'composition-expression': solve_composition_expression,
    'inverse-value': solve_inverse_value,
    'inverse-expression': solve_inverse_expression,
    'compare-representations': solve_compare,
}


def solve_function_toolkit(public):
    require(public['templateId'] in SOLVERS, 'Not a function-toolkit template')
    return SOLVERS[public['templateId']](public)


# ------------------------------------------------------------ explanations
def display(text):
    """TeX in an explanation as display arithmetic for the shared claim checker."""
    def convert(m):
        t = m[1].replace('\\left', '').replace('\\right', '').replace('\\cdot', '·')
        # Function names are not arithmetic: (g ∘ f)(2) and f⁻¹(4) apply a function.
        t = re.sub(r'\((\w) \\circ (\w)\)', r'\1∘\2', t).replace('^{-1}', '⁻¹')
        while '\\frac' in t:
            i = t.index('\\frac')
            a, j = braced(t, i + 5)
            b, k = braced(t, j)
            t = t[:i] + f'({a})/({b})' + t[k:]
        t = re.sub(r'\^\{([^}]*)\}', r'^\1', t)
        return t.replace('-', '−')
    return re.sub(r'\$([^$]+)\$', convert, text)


def shown(v):
    v = Fraction(v)
    if v.denominator == 1:
        return [str(v.numerator), str(v.numerator).replace('-', '−')]
    s = '-' if v < 0 else ''
    return [f'{s}\\frac{{{abs(v.numerator)}}}{{{v.denominator}}}']


def review_problem(problem):
    public = problem['public']
    answer = solve_function_toolkit(public)
    steps = problem['explanation']
    require(len(steps) >= 2 and problem['hint'], 'Explanation or hint missing')
    checked = sum(arithmetic_claims(display(step)) for step in steps)
    tail = ' '.join(steps[-2:])
    if public['templateId'] in FUNCTION_TOOLKIT_NUMBER:
        require(any(re.search(r'(?<![\d/{])' + re.escape(s) + r'(?![\d/}])', tail) for s in shown(answer)), f'The last steps must state the answer {answer}')
    else:
        labels = dict(options(public))
        feedback = problem.get('choiceFeedback') or {}
        require(set(feedback) == set(labels) - {answer}, 'Every wrong option needs feedback')
        label = labels[answer]
        if label.startswith('$') and label.endswith('$') and label.count('$') == 2:
            require(label[1:-1] in ' '.join(steps), 'The explanation reaches the answer ' + label)
    return checked


# ------------------------------------------------------------ fixtures
def case(template, prompt, response=None, figure=None):
    public = {'templateId': template, 'prompt': prompt, 'response': response or {'kind': 'number'}}
    if figure is not None:
        public['figure'] = figure
    return public


def choice(*labels):
    return {'kind': 'choice', 'options': [{'id': f'option-{"abcd"[i]}', 'label': label} for i, label in enumerate(labels)]}


def scene(*elements):
    return {'kind': 'scene', 'scene': {'v': 1, 'elements': list(elements)}}


TWO = '\\begin{cases} 2x + 1 & x < 2 \\\\ -x + 7 & x \\ge 2 \\end{cases}'
PIECES = {'type': 'graph', 'x': [-6, 6], 'y': [-6, 10], 'curves': [
    {'fn': {'f': 'poly', 'c': [1, 2]}, 'domain': [-6, 2], 'ends': ['arrow', 'open']},
    {'fn': {'f': 'poly', 'c': [7, -1]}, 'domain': [2, 6], 'ends': ['closed', 'arrow']},
]}


def review_function_toolkit_fixtures():
    fixtures = [
        (case('piecewise-evaluate', f'Let $f(x) = {TWO}$. What is $f(2)$?'), 5),
        (case('piecewise-evaluate', f'A function is defined by $f(x) = {TWO}$. Find $f(1)$.'), 3),
        (case('piecewise-evaluate', 'The graph shows $y = f(x)$. What is $f(2)$?', figure=scene(PIECES)), 5),
        (case('piecewise-evaluate', 'A courier charges $C(w)$ dollars to ship a parcel of $w$ kilograms, where $C(w) = \\begin{cases} 9 & 0 < w \\le 4 \\\\ 9 + 2(w - 4) & w > 4 \\end{cases}$. What does a parcel of 7 kilograms cost to ship, in dollars?'), 15),
        (case('piecewise-reading', 'Let $f(x) = 2|x - 3| + 1$. Which expression equals $f(x)$ for $x < 3$?', choice('$2x - 5$', '$-2x + 7$', '$-2x - 5$', '$2x + 7$')), 'option-b'),
        (case('piecewise-reading', 'The graph of $y = f(x)$ is made of two pieces. Which rule gives $f(x)$ for $x \\ge 2$?', choice('$2x + 1$', '$-x + 7$', '$x + 7$', '$-x + 5$'), scene(PIECES)), 'option-b'),
        (case('piecewise-reading', 'The graph shows $y = f(x)$ and the dashed line $y = 5$. How many solutions does $f(x) = 5$ have?', choice('None', 'Exactly one', 'Exactly two', 'Exactly three'),
              scene(dict(PIECES, lines=[{'line': {'m': 0, 'b': 5}, 'dash': 'dash'}]))), 'option-b'),
        (case('transform-equation', 'The graph of $y = |x|$ is shifted 2 units left, stretched vertically by a factor of 3, and then shifted 1 unit down. Which equation describes the new graph?',
              choice('$y = 3|x - 2| - 1$', '$y = 3|x + 2| - 1$', '$y = 3|x + 2| - 3$', '$y = -3|x + 2| - 1$')), 'option-b'),
        (case('transform-equation', 'How does the graph of $y = f(x + 3)$ compare with the graph of $y = f(x)$?',
              choice('Shift 3 units left', 'Shift 3 units right', 'Shift 3 units up', 'Shift 3 units down')), 'option-a'),
        (case('transform-equation', 'How does the graph of $y = f(2x)$ compare with the graph of $y = f(x)$?',
              choice('Multiply every $y$-coordinate by 2', 'Divide every $y$-coordinate by 2', 'Multiply every $x$-coordinate by 2', 'Divide every $x$-coordinate by 2')), 'option-d'),
        (case('transform-point', 'The point $(2, 5)$ is on the graph of $y = f(x)$. The graph of $y = f(x + 3)$ passes through $\\left(p, 5\\right)$. What is $p$?'), -1),
        (case('transform-point', 'The point $(4, 6)$ is on the graph of $y = f(x)$. The graph of $y = f(3x)$ passes through $\\left(p, 6\\right)$. What is $p$?'), Fraction(4, 3)),
        (case('transform-point', 'The point $(3, -2)$ is on the graph of $y = f(x)$. The graph of $y = -f(x)$ passes through $\\left(3, q\\right)$. What is $q$?'), 2),
        (case('transform-point', '$f$ is an odd function and $f(3) = 7$. What is $f(-3)$?'), -7),
        (case('composition-value', 'Let $f(x) = 2x - 3$ and $g(x) = x^2 + 1$. What is $f(g(3))$?'), 17),
        (case('composition-value', 'Let $f(x) = 2x - 3$ and $g(x) = x^2 + 1$. What is $(g \\circ f)(3)$?'), 10),
        (case('composition-value', 'Let $f(x) = \\frac{1}{x - 5}$ and $g(x) = 2x - 1$. Which value of $x$ is not in the domain of $f(g(x))$?'), 3),
        (case('composition-expression', 'Let $f(x) = 2x - 3$ and $g(x) = x^2 + 1$. Which expression equals $g(f(x))$?',
              choice('$2x^2 - 1$', '$4x^2 - 12x + 10$', '$4x^2 + 10$', '$x^2 + 2x - 2$')), 'option-b'),
        (case('composition-expression', '$h(x) = (3x - 1)^2 + 4$ can be written as $h(x) = f(g(x))$ with $g(x) = 3x - 1$. Which is $f(x)$?',
              choice('$x^2 + 4$', '$(3x - 1)^2 + 4$', '$3x^2 + 4$', '$x^2 + 3$')), 'option-a'),
        (case('inverse-value', 'Let $f(x) = 3x - 7$. What is $f^{-1}(8)$?'), 5),
        (case('inverse-value', 'Let $f(x) = 2^x - 3$. What is $f^{-1}(5)$?'), 3),
        (case('inverse-expression', 'Let $f(x) = 2x - 3$. Which expression is $f^{-1}(x)$?', choice('$\\frac{x - 3}{2}$', '$\\frac{x + 3}{2}$', '$2x + 3$', '$\\frac{x}{2} + 3$')), 'option-b'),
        (case('inverse-expression', 'The function $f(x) = (x - 2)^2 + 3$ with domain $x \\ge 2$ is one-to-one. Which expression is $f^{-1}(x)$?',
              choice('$\\sqrt{x - 3} + 2$', '$-\\sqrt{x - 3} + 2$', '$\\sqrt{x - 2} + 3$', '$\\sqrt{x + 3} - 2$')), 'option-a'),
        (case('inverse-expression', 'The graph of $y = f(x)$ passes through $(2, 7)$, and $f$ has an inverse. Which point is on the graph of $y = f^{-1}(x)$?',
              choice('$(7, 2)$', '$(-2, -7)$', '$(2, \\frac{1}{7})$', '$(-7, -2)$')), 'option-a'),
        (case('inverse-expression', 'The function $f(x) = (x - 3)^2$ is not one-to-one. On which domain does it have an inverse function?',
              choice('$x \\ge 0$', '$x \\ge 3$', 'All real numbers', '$x \\le 5$')), 'option-b'),
        (case('compare-representations', 'The function $f$ is defined by $f(x) = -(x - 1)^2 + 5$. The table shows values of the quadratic function $g$. Which statement is true?',
              choice('$f$ has the greater maximum value', '$g$ has the greater maximum value', '$f$ and $g$ have the same maximum value', '$f(0) = g(0)$'),
              scene({'type': 'lineTable', 'rows': [['x', '-3', '-2', '-1', '0', '1'], ['g(x)', '-1', '2', '3', '2', '-1']]})), 'option-a'),
    ]
    for public, expected in fixtures:
        got = solve_function_toolkit(public)
        require(got == expected, f'Fixture failed: {public["prompt"]} gave {got}')
    mutants = [
        # Overlapping conditions.
        case('piecewise-evaluate', 'Let $f(x) = \\begin{cases} 2x + 1 & x \\le 2 \\\\ -x + 7 & x \\ge 2 \\end{cases}$. What is $f(2)$?'),
        # The graph's two pieces both include x = 2.
        case('piecewise-evaluate', 'The graph shows $y = f(x)$. What is $f(2)$?', figure=scene(dict(PIECES, curves=[dict(PIECES['curves'][0], ends=['arrow', 'closed']), PIECES['curves'][1]]))),
        # Two options are the same function.
        case('piecewise-reading', 'Let $f(x) = 2|x - 3| + 1$. Which expression equals $f(x)$ for $x < 3$?', choice('$-2x + 7$', '$7 - 2x$', '$-2x - 5$', '$2x + 7$')),
        # A flat piece on the level line.
        case('piecewise-reading', 'The graph shows $y = f(x)$ and the dashed line $y = 3$. How many solutions does $f(x) = 3$ have?', choice('None', 'Exactly one', 'Exactly two', 'Exactly three'),
             scene({'type': 'graph', 'x': [-6, 6], 'y': [-6, 6], 'curves': [{'fn': {'f': 'poly', 'c': [3]}, 'domain': [-6, 0], 'ends': ['arrow', 'open']}, {'fn': {'f': 'poly', 'c': [0, 1]}, 'domain': [0, 6], 'ends': ['closed', 'arrow']}],
                    'lines': [{'line': {'m': 0, 'b': 3}}]})),
        # Asked at an input that is not the opposite.
        case('transform-point', '$f$ is an even function and $f(3) = 7$. What is $f(-4)$?'),
        # The inner output is not in the table.
        case('composition-value', 'The table gives values of $f$ and $g$. What is $f(g(1))$?', figure=scene({'type': 'lineTable', 'rows': [['x', '0', '1', '2'], ['f(x)', '3', '4', '5'], ['g(x)', '1', '7', '0']]})),
        # A table that is not one-to-one.
        case('inverse-value', 'The table shows values of the one-to-one function $f$. What is $f^{-1}(4)$?', figure=scene({'type': 'lineTable', 'rows': [['x', '0', '1', '2'], ['f(x)', '4', '2', '4']]})),
        # Both branches offered as correct domains.
        case('inverse-expression', 'The function $f(x) = (x - 3)^2$ is not one-to-one. On which domain does it have an inverse function?', choice('$x \\ge 3$', '$x \\le 3$', 'All real numbers', '$x \\ge 0$')),
    ]
    for public in mutants:
        try:
            solve_function_toolkit(public)
        except (ValueError, KeyError, StopIteration, IndexError):
            continue
        raise ValueError('Malformed fixture accepted: ' + public['prompt'])
    return len(fixtures)


# ------------------------------------------------------------ content
_EXPORT = None


def content(data=None):
    global _EXPORT
    if data is not None:
        return data
    if _EXPORT is None:
        app = Path(__file__).resolve().parent.parent
        _EXPORT = subprocess.check_output(['node', '--import', 'tsx', 'scripts/function-toolkit-content-oracle.ts'], cwd=app, text=True)
    return json.loads(_EXPORT)


WORKED_TEMPLATE = {
    'piecewise-functions': 'piecewise-evaluate',
    'function-transformations': 'transform-point',
    'function-composition': 'composition-value',
    'inverse-functions': 'inverse-value',
}


def worked_answer(lesson):
    prompt = lesson['workedExample']['prompt']
    if lesson['id'] in WORKED_TEMPLATE:
        v = solve_function_toolkit(case(WORKED_TEMPLATE[lesson['id']], prompt))
        return str(v).replace('-', '−')
    m = re.fullmatch(r'\$f\(x\) = (.+?)\$, and the quadratic function \$g\$ has (.+)\. Which function has the greater maximum value\?', prompt)
    require(m is not None, 'Unrecognized worked example: ' + lesson['id'])
    f = fn_of(m[1])
    table = {Fraction(int(a)): Fraction(int(b)) for a, b in re.findall(r'\$g\((-?\d+)\) = (-?\d+)\$', m[2])}
    xs = sorted(table)[:3]
    g = lambda x: sum(table[xi] * math.prod((Fraction(x) - xj) / (xi - xj) for xj in xs if xj != xi) for xi in xs)
    require(all(g(x) == y for x, y in table.items()), 'The worked table is quadratic')
    fv, gv = quadratic_extreme(f, 'maximum'), quadratic_extreme(g, 'maximum')
    require(fv != gv, 'The worked comparison has a winner')
    return '$f$' if fv > gv else '$g$'


def review_illustrations(figures):
    by = {f['kind']: f['scene'] for f in figures}
    g = by['piecewise-pieces']['elements'][0]
    curves = [spec_fn(c['fn']) for c in g['curves']]
    require(curves[1](2) == g['points'][0]['y'] == 5 and g['curves'][0]['ends'][1] == 'open' and g['curves'][1]['ends'][0] == 'closed', 'f(2) = 5 on the closed piece')
    a = by['abs-pieces']['elements'][0]
    left, right = (spec_fn(c['fn']) for c in a['curves'])
    require(all(left(x) == abs(Fraction(x) - 1) + 2 for x in (-2, 0)) and all(right(x) == abs(Fraction(x) - 1) + 2 for x in (1, 3)), '|x − 1| + 2 in pieces')
    texts = {e['id']: e['text'] for e in by['composition-machine']['elements'] if e['type'] == 'text'}
    x = number(texts['in'])
    require(number(texts['mid']) == x * x + 1 and number(texts['out']) == 2 * number(texts['mid']) - 3, 'The machine computes g, then f')
    for kind in ('inverse-reflection', 'inverse-restricted'):
        r = by[kind]['elements'][0]
        f, inv = (spec_fn(c['fn']) for c in r['curves'])
        lo, hi = r['curves'][0]['domain']
        for t in range(0, 5):
            u = Fraction(lo) + (Fraction(hi) - Fraction(lo)) * t / 4
            require(same(inv(f(u)), u), f'{kind}: the curves are inverses')
        (p, q), (s, t) = [(pt['x'], pt['y']) for pt in r['points']]
        require((p, q) == (t, s) and same(f(p), q), f'{kind}: the mirrored points')
    c = by['compare-formula-table']['elements'][0]
    f = spec_fn(c['curves'][0]['fn'])
    require(quadratic_extreme(f, 'maximum') == 5, 'f has maximum 5')
    require(max(pt['y'] for pt in c['points']) == 3, "g's highest table value is 3")
    return len(by)


def review_function_toolkit_content(data=None):
    data = content(data)
    checked = 0
    for sheet in data['worksheets']:
        problems = sheet['problems']
        require(len(problems) == 12, 'Worksheet length')
        keys = {json.dumps([p['public']['prompt'], p['public'].get('figure'), sorted(o['label'] for o in p['public']['response'].get('options', []))]) for p in problems}
        require(len(keys) == 12, 'Repeated worksheet problem')
        for p in problems:
            solved = solve_function_toolkit(p['public'])
            require((p['answer'] == solved) if isinstance(solved, str) else Fraction(p['answer']) == solved, 'Worksheet answer mismatch')
            checked += review_problem(p)
    lessons = {lesson['id']: lesson for lesson in data['lessons']}
    require(sorted(t for l in lessons.values() for t in l['templateIds']) == sorted(FUNCTION_TOOLKIT), 'Every template has one standalone lesson')
    for lesson in lessons.values():
        require(worked_answer(lesson) == lesson['workedExample']['answer'], 'Worked example answer: ' + lesson['id'])
        for text in lesson['workedExample']['steps'] + [p for s in lesson['sections'] for p in s['paragraphs']]:
            checked += arithmetic_claims(display(text))
    figures = review_illustrations(data['figures'])
    return {'worksheets': len(data['worksheets']), 'checkedClaims': checked, 'lessons': len(lessons), 'figures': figures}


def review_content_mutations():
    data = content()
    mutants = []
    bad = copy.deepcopy(data); bad['lessons'][0]['workedExample']['answer'] = '7'; mutants.append(bad)
    bad = copy.deepcopy(data); bad['lessons'][2]['workedExample']['answer'] = '10'; mutants.append(bad)
    bad = copy.deepcopy(data); bad['worksheets'][0]['problems'][1] = bad['worksheets'][0]['problems'][0]; mutants.append(bad)
    bad = copy.deepcopy(data); bad['worksheets'][3]['problems'][0]['explanation'].append('A false check: $4 \\cdot 3 = 13$.'); mutants.append(bad)
    bad = copy.deepcopy(data)
    for f in bad['figures']:
        if f['kind'] == 'composition-machine':
            for e in f['scene']['elements']:
                if e.get('id') == 'out':
                    e['text'] = '19'
    mutants.append(bad)
    for mutant in mutants:
        try:
            review_function_toolkit_content(mutant)
        except (ValueError, KeyError, TypeError, IndexError):
            continue
        raise ValueError('Content mutant accepted')
    return len(mutants)
