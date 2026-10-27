"""Independent oracle for the Regents Algebra I families (sequences, linear, functions,
expressions, data, figures). Every answer is derived from the public prompt, choices and
figure data with exact Fraction arithmetic; no generator code, seed or answer key is used.
"""
import ast
import copy
import json
import math
import re
from fractions import Fraction as Q
from pathlib import Path

from function_toolkit_math_oracle import fn_of, python_source, run, exact_sqrt

NUMERIC = frozenset({
    'exponential-passes-linear', 'quartile-list', 'average-rate-table-rounded', 'budget-whole-items',
    'abs-equals-linear-unique', 'radical-function-value', 'grouped-both-sides-solve',
})
CHOICE = frozenset({
    'arithmetic-distant-term', 'geometric-signed-term', 'rate-unit-chain', 'negative-monomial-power',
    'combine-unlike-radicals', 'complete-square-equation', 'complete-square-step-property',
    'polynomial-structure', 'exponential-initial-value', 'exponential-decay-table', 'two-way-share',
    'correlation-causation-choice', 'parabola-axis-vertex-graph', 'graph-is-function',
    'inequality-both-sides-number-line', 'function-missing-input', 'shift-function-notation',
    'zeros-of-factored-product', 'quadratic-negative-output', 'parabola-axis-rule',
    'quadratic-formula-positive', 'factor-large-trinomial', 'decimal-both-sides-equation',
    'point-slope-two-points', 'total-and-cost-equation', 'isolate-two-term-formula',
    'substitute-into-equation',
})
SUPPORTED = NUMERIC | CHOICE
CHOICE_REVIEW = CHOICE


def require(ok, message):
    if not ok:
        raise ValueError(message)


def plain(s):
    return (s.replace('$', '').replace('−', '-').replace('\\left', '').replace('\\right', '')
            .replace('\\ ', ' ').replace('\\,', ''))


def dollars(text):
    return re.findall(r'\$([^$]+)\$', text)


def options(public):
    r = public['response']
    require(r['kind'] in ('choice', 'figure-choice'), 'Expected a choice response')
    return [(o['id'], o['label']) for o in r['options']]


def only(public, truth):
    """The single option for which truth(label) holds; any other count is a defect."""
    found = []
    for oid, label in options(public):
        try:
            if truth(label):
                found.append(oid)
        except (ValueError, SyntaxError, ZeroDivisionError, KeyError, IndexError, TypeError):
            pass
    require(len(found) == 1, f'Expected exactly one correct option, found {len(found)}: {public["prompt"]}')
    return found[0]


def num(text):
    t = plain(text).strip()
    return fn_of(t)(0)


def ev(tex, **env):
    node = ast.parse(python_source(plain(tex)), mode='eval').body
    return run(node, {k: Q(v) for k, v in env.items()})


def fit_poly(f, degree):
    """Exact coefficients (ascending) of the polynomial f of known degree, by Newton differences."""
    pts = [Q(i) for i in range(degree + 1)]
    mat = [[p ** j for j in range(degree + 1)] + [f(p)] for p in pts]
    for i in range(degree + 1):
        piv = next(r for r in range(i, degree + 1) if mat[r][i] != 0)
        mat[i], mat[piv] = mat[piv], mat[i]
        mat[i] = [v / mat[i][i] for v in mat[i]]
        for r in range(degree + 1):
            if r != i:
                mat[r] = [a - mat[r][i] * b for a, b in zip(mat[r], mat[i])]
    return [mat[i][-1] for i in range(degree + 1)]


def quad_roots(a, b, c):
    d = b * b - 4 * a * c
    if d < 0:
        return set()
    s = exact_sqrt(d)
    require(isinstance(s, Q), 'Irrational roots')
    return {(-b + s) / (2 * a), (-b - s) / (2 * a)}


def round_half_up(v, places):
    scale = Q(10) ** places
    return Q(math.floor(v * scale + Q(1, 2))) / scale if v >= 0 else -Q(math.floor(-v * scale + Q(1, 2))) / scale


def scene(public):
    f = public.get('figure')
    require(f and f['kind'] == 'scene', 'Expected a scene figure')
    return f['scene']['elements']


def element(public, kind):
    found = [e for e in scene(public) if e['type'] == kind]
    require(len(found) == 1, f'Expected one {kind} element')
    return found[0]


# --------------------------------------------------------------------------- sequences
def solve_sequences(public):
    p = plain(public['prompt'])
    if public['templateId'] == 'arithmetic-distant-term':
        m = re.search(r'sequence are (.*?), \\dots\. What is the (\d+)(?:st|nd|rd|th)? term', p)
        require(m, 'Unrecognized arithmetic wording')
        terms = [Q(t.strip()) for t in m[1].split(',')]
        d = terms[1] - terms[0]
        require(all(terms[i + 1] - terms[i] == d for i in range(len(terms) - 1)), 'Not arithmetic')
        n = int(m[2])
        suffix = 'th' if 11 <= n % 100 <= 13 else {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th')
        require(f'the {n}{suffix} term' in p, 'Ordinal suffix is wrong')
        require(re.search(rf'a_\{{{n}\}}', p), 'Index mismatch')
        target = terms[0] + (n - 1) * d
    else:
        n = int(re.search(r'term a_\{(\d+)\}\?', p)[1])
        if 'first term' in p:
            a1, r = re.search(r'first term a_1=(-?\d+), and each term is (-?\d+) times', p).groups()
            a1, r = Q(a1), Q(r)
        else:
            terms = [Q(t.strip()) for t in re.search(r'sequence are ([^.]*?), \\dots', p)[1].split(',')]
            r = terms[1] / terms[0]
            require(all(terms[i + 1] == terms[i] * r for i in range(len(terms) - 1)), 'Not geometric')
            a1 = terms[0]
        target = a1 * r ** (n - 1)
    return only(public, lambda l: num(l) == target)


# --------------------------------------------------------------------------- units
def unit_stem(u):
    u = u.strip()
    return {'feet': 'foot', 'inches': 'inch'}.get(u, u[:-1] if u.endswith('s') and u not in ('mass',) else u)


def solve_rate_unit_chain(public):
    p = public['prompt']
    fracs = re.findall(r'\\frac\{[\d.]+\\ \\text\{([a-z ]+)\}\}\{[\d.]+\\ \\text\{([a-z ]+)\}\}', p)
    require(len(fracs) >= 2, 'Expected a chain of unit fractions')
    top, bottom = {}, {}
    for a, b in fracs:
        top[unit_stem(a)] = top.get(unit_stem(a), 0) + 1
        bottom[unit_stem(b)] = bottom.get(unit_stem(b), 0) + 1
    for u in set(top) & set(bottom):
        k = min(top[u], bottom[u])
        top[u] -= k
        bottom[u] -= k
    top = {u for u, c in top.items() if c > 0}
    bottom = {u for u, c in bottom.items() if c > 0}
    require(len(top) == 1 and len(bottom) == 1, 'Chain does not reduce to one rate')
    want = (next(iter(top)), next(iter(bottom)))

    def truth(label):
        m = re.fullmatch(r'\\text\{([a-z]+) per ([a-z]+)\}', plain(label).strip())
        return m and (unit_stem(m[1]), unit_stem(m[2])) == want
    return only(public, truth)


# --------------------------------------------------------------------------- expressions
def monomial(text):
    m = re.fullmatch(r'(-?\d*)([a-z])(?:\^\{?(\d+)\}?)?', plain(text).replace(' ', ''))
    require(m, 'Not a monomial: ' + text)
    c = {'': 1, '-': -1}.get(m[1], None)
    return (Q(m[1]) if c is None else Q(c)), m[2], int(m[3] or 1)


def solve_negative_monomial(public):
    inner = re.search(r'\(([^()]*)\)\^\{?(\d+)\}?', plain(public['prompt']))
    c, v, e = monomial(inner[1])
    k = int(inner[2])
    want = (c ** k, v, e * k)
    return only(public, lambda l: monomial(l) == want)


def squarefree(n):
    k = 1
    for f in range(int(math.isqrt(n)), 1, -1):
        if n % (f * f) == 0:
            k = f
            break
    return k, n // (k * k)


def radical_sum(text):
    s = plain(text).replace(' ', '')
    terms = re.findall(r'([+-]?)(\d*)\\sqrt\{(\d+)\}|([+-]?)(\d+)(?!\\|\d*\\sqrt)', s)
    out = {}
    rebuilt = ''
    for sign, c, r, sign2, k in terms:
        if r:
            coef = int(c or 1) * (-1 if sign == '-' else 1)
            outer, rad = squarefree(int(r))
            out[rad] = out.get(rad, 0) + coef * outer
            rebuilt += f'{sign}{c}\\sqrt{{{r}}}'
        else:
            out[1] = out.get(1, 0) + int(k) * (-1 if sign2 == '-' else 1)
            rebuilt += f'{sign2}{k}'
    require(rebuilt.lstrip('+') == s.lstrip('+'), 'Unreadable radical sum ' + text)
    return {k: v for k, v in out.items() if v}


def solve_combine_radicals(public):
    want = radical_sum(re.search(r'equivalent to \$([^$]+)\$', public['prompt'])[1])
    return only(public, lambda l: radical_sum(l) == want)


def quad_fn(equation):
    left, right = plain(equation).split('=')
    return lambda x: ev(left, x=x) - ev(right, x=x)


def solve_complete_square_equation(public):
    d = quad_fn(re.search(r'solutions as \$([^$]+)\$', public['prompt'])[1])
    return only(public, lambda l: all(quad_fn(l)(Q(x)) == d(Q(x)) for x in range(-3, 4)))


def solve_step_property(public):
    eqs = dollars(public['prompt'])
    require(len(eqs) == 2, 'Expected before and after equations')
    sides = [[plain(s) for s in e.split('=')] for e in eqs]
    xs = [Q(v) for v in (0, 1, 2, 5, 7)]
    L1, R1 = (lambda x: ev(sides[0][0], x=x)), (lambda x: ev(sides[0][1], x=x))
    L2, R2 = (lambda x: ev(sides[1][0], x=x)), (lambda x: ev(sides[1][1], x=x))
    added = all(L2(x) - L1(x) == R2(x) - R1(x) for x in xs)
    ratios = {(L2(x) / L1(x)) for x in xs if L1(x) != 0} | {(R2(x) / R1(x)) for x in xs if R1(x) != 0}
    scaled = len(ratios) == 1 and ratios != {Q(1)}
    require(added != scaled, 'Step is neither (or both) an addition and a scaling')
    name = 'Addition property of equality' if added else 'Multiplication property of equality'
    return only(public, lambda l: l.strip() == name)


def poly_terms(text):
    s = plain(text).replace(' ', '')
    parts = re.findall(r'[+-]?[^+-]+', s)
    require(''.join(parts) == s, 'Unreadable polynomial ' + text)
    poly = {}
    for t in parts:
        m = re.fullmatch(r'([+-]?)(\d*)(?:x(?:\^\{?(\d+)\}?)?)?', t)
        require(m and t not in ('+', '-'), 'Bad term ' + t)
        has_x = 'x' in t
        coef = int(m[2] or 1) if has_x else int(m[2])
        coef *= -1 if m[1] == '-' else 1
        deg = int(m[3] or 1) if has_x else 0
        poly[deg] = poly.get(deg, 0) + coef
    return {d: c for d, c in poly.items() if c}


def solve_polynomial_structure(public):
    p = plain(public['prompt'])
    degree = int(re.search(r'degree of (-?\d+)', p)[1])
    const = int(re.search(r'constant term of (-?\d+)', p)[1])
    lead = re.search(r'leading coefficient of (-?\d+)', p)

    def truth(label):
        poly = poly_terms(label)
        top = max(poly)
        return top == degree and poly.get(0, 0) == const and (not lead or poly[top] == int(lead[1]))
    return only(public, truth)


def solve_exponential_initial(public):
    m = re.search(r'\$([A-Za-z])\((\w)\) = ([^$]+)\$', public['prompt'])
    require(m, 'Unrecognized model')
    initial = ev(m[3], **{m[2]: 0})
    return only(public, lambda l: num(l) == initial)


def solve_decay_table(public):
    def truth(label):
        v = [Q(t) for t in plain(label).replace('\\ ', '').split(',')]
        r = v[1] / v[0]
        return len(v) == 4 and all(x > 0 for x in v) and 0 < r < 1 and all(v[i + 1] == v[i] * r for i in range(3))
    return only(public, truth)


def solve_passes_linear(public):
    fns = {}
    for name, body in re.findall(r'\$([fg])\(x\) = ([^$]+)\$', public['prompt']):
        fns[name] = body.replace('\\cdot', '*')
    require(set(fns) == {'f', 'g'}, 'Expected f and g')
    for x in range(0, 400):
        if ev(fns['f'], x=x) > ev(fns['g'], x=x):
            return str(x)
    raise ValueError('f never exceeds g')


# --------------------------------------------------------------------------- data
def stems(text):
    words = re.sub(r'[^a-z ]', ' ', text.lower()).split()
    fix = {'has': 'have', 'uses': 'use', 'takes': 'take', 'drives': 'drive'}
    out = []
    for w in words:
        w = fix.get(w, w)
        if w in ('a', 'do', 'does', 'the'):
            continue
        out.append(w)
    if out and out[0] == 'no':
        out = ['not', 'have'] + out[1:]
    return out


def solve_two_way(public):
    t = element(public, 'table')
    cols = t['columns']
    rows = t['rows']
    grid = {r['label']: [Q(c) for c in r['cells']] for r in rows}
    for lab, cells in grid.items():
        if lab != 'Total':
            require(cells[0] + cells[1] == cells[2], 'Row does not sum')
    for i in range(3):
        require(grid[rows[0]['label']][i] + grid[rows[1]['label']][i] == grid['Total'][i], 'Column does not sum')
    labels = [r['label'] for r in rows[:2]]
    colstems = [stems(c) for c in cols[:2]]

    def row_of(phrase):
        words = stems(phrase)
        hit = [l for l in labels if l.lower() in words or l.lower().rstrip('s') in [w.rstrip('s') for w in words]]
        require(len(hit) == 1, 'Row not identified: ' + phrase)
        return hit[0]

    def col_of(phrase):
        words = stems(phrase)
        best = [(len(cs), i) for i, cs in enumerate(colstems) if words[len(words) - len(cs):] == cs]
        require(best, 'Column not identified: ' + phrase)
        return max(best)[1]

    p = plain(public['prompt']).split(' Round to')[0]
    q = p.split('counts for ', 1)[1].split('. ', 1)[1]
    if m := re.fullmatch(r'Of the \w+ who (.+), what percent are (.+)\?', q):
        c = col_of(m[1]); r = row_of(m[2]); den = grid['Total'][c]
    elif m := re.fullmatch(r'What percent of all (\d+) \w+ surveyed are (.+?) who (.+)\?', q):
        require(Q(m[1]) == grid['Total'][2], 'Stated total disagrees with table')
        c = col_of(m[3]); r = row_of(m[2]); den = grid['Total'][2]
    elif m := re.fullmatch(r'What percent of the (.+)\?', q):
        phrase = m[1]
        r = next(l for l in labels if phrase.lower().startswith(l.lower()))
        rest = phrase.split(None, 2)
        c = col_of(' '.join(phrase.split()[1:]))
        den = grid[r][2]
    else:
        raise ValueError('Unrecognized two-way question: ' + q)
    part = grid[r][c]
    want = round_half_up(100 * part / den, 0)
    return only(public, lambda l: num(l.replace('\\%', '')) == want)


def solve_quartile(public):
    p = plain(public['prompt'])
    n = int(re.search(r'has (\d+) values', p)[1])
    data = sorted(Q(v) for v in re.search(r'values: ([^.]*?)\. The', p.replace('\\ ', ''))[1].split(','))
    require(len(data) == n, 'Value count mismatch')
    lower = 'lower quartile is' in p
    half = data[:n // 2] if lower else data[(n + 1) // 2:]

    def median(v):
        k = len(v)
        return v[k // 2] if k % 2 else (v[k // 2 - 1] + v[k // 2]) / 2
    return str(median(half))


def table_values(public):
    t = element(public, 'table')
    return {r['label']: Q(r['cells'][0].replace(',', '')) for r in t['rows']}


def solve_average_rate(public):
    p = plain(public['prompt'])
    a, b = re.search(r'from (?:year )?(\d+) to (?:year )?(\d+)', p).groups()
    v = table_values(public)
    rate = (v[b] - v[a]) / (Q(b) - Q(a))
    places = 0 if 'whole number' in p else 1 if 'tenth' in p else 2 if 'hundredth' in p else None
    require(places is not None, 'Rounding not stated')
    return str(round_half_up(rate, places))


CORRELATION = {  # judged by the oracle author: (sign, direct cause between the two measures)
    'the number of coats sold each week and the number of swimmers at a public pool': ('Negative', False),
    'the height of a mountain hike and the air pressure at the top': ('Negative', True),
    'daily ice cream sales and the number of sunburns treated at a beach each day': ('Positive', False),
    'the hours a phone has been charging and the battery percentage': ('Positive', True),
    'the outdoor temperature on winter days and the amount of heating oil a house uses': ('Negative', True),
    'the number of storks nesting in towns and the number of babies born there': ('Positive', False),
    'the number of firefighters sent to a fire and the amount of damage it causes': ('Positive', False),
    'the number of miles a car is driven and the amount of gasoline it has used': ('Positive', True),
    'the number of hours a generator has run and the fuel left in its tank': ('Negative', True),
    "children's shoe sizes and their scores on a reading test": ('Positive', False),
}


def solve_correlation(public):
    m = re.search(r'A study measures (.+)\. Which', public['prompt'])
    require(m and m[1] in CORRELATION, 'Unknown scenario: ' + public['prompt'])
    verdict = CORRELATION[m[1]]
    require(verdict is not None, 'Scenario has no defensible causal verdict: ' + m[1])
    sign, causal = verdict
    want = f'{sign} correlation; {"one causes the other" if causal else "neither causes the other"}'
    return only(public, lambda l: l.strip() == want)


def solve_budget(public):
    a, b, c = [Q(v) for v in re.findall(r'\$([\d.]+)\$ dollars', public['prompt'])]
    return str(math.floor((a - b) / c))


# --------------------------------------------------------------------------- functions
def solve_abs_equals_linear(public):
    stem = public['prompt'].split(' For what value')[0]
    fns = dict(re.findall(r'\$([fg])\(x\) = ([^$]+)\$', stem))
    m = re.search(r'\|x(?: ([+-]) (\d+))?\|', fns['f'])
    require(m, 'Expected an absolute value in f')
    h = Q(0) if m[1] is None else -Q(m[2]) if m[1] == '+' else Q(m[2])
    F = lambda x: ev(fns['f'], x=x) - ev(fns['g'], x=x)
    roots = set()
    left, right = F(h) - F(h - 1), F(h + 1) - F(h)
    if left != 0 and h - F(h) / left <= h:
        roots.add(h - F(h) / left)
    if right != 0 and h - F(h) / right >= h:
        roots.add(h - F(h) / right)
    if F(h) == 0:
        roots.add(h)
    require(len(roots) == 1, f'Expected exactly one solution, found {sorted(roots)}')
    r = next(iter(roots))
    require(F(r) == 0, 'Root check failed')
    return str(r)


def solve_parabola_vertex_graph(public):
    g = element(public, 'graph')
    curves = g['curves']
    require(len(curves) == 1 and curves[0]['fn']['f'] == 'poly', 'Expected one polynomial curve')
    c0, c1, c2 = [Q(str(v)) for v in curves[0]['fn']['c']]
    require(c2 != 0, 'Not a parabola')
    h = -c1 / (2 * c2)
    k = c0 + c1 * h + c2 * h * h
    require(g['x'][0] <= h <= g['x'][1] and g['y'][0] <= k <= g['y'][1], 'Vertex outside the shown window')

    def truth(label):
        m = re.fullmatch(r'(x|y) = (-?\d+) and vertex \((-?\d+), (-?\d+)\)', plain(label).strip())
        return m and m[1] == 'x' and Q(m[2]) == h and (Q(m[3]), Q(m[4])) == (h, k)
    return only(public, truth)


def graph_is_function(sc):
    el = [e for e in sc['elements'] if e['type'] == 'graph']
    require(len(el) == 1, 'Expected one graph')
    g = el[0]
    extra = set(g) - {'type', 'x', 'y', 'grid', 'tick', 'aspect', 'axisNames', 'segments', 'circles', 'curves', 'lines'}
    require(not extra, 'Unreviewed graph keys ' + str(extra))
    if g.get('circles'):
        require(all(c['r'] > 0 for c in g['circles']), 'Degenerate circle')
        return False
    for c in g.get('curves', []):
        require(c['fn']['f'] == 'poly', 'Unreviewed curve kind')
    for ln in g.get('lines', []):
        (x1, _), (x2, _) = ln['line']['through']
        if x1 == x2:
            return False
    segs = [(tuple(map(float, s['from'])), tuple(map(float, s['to']))) for s in g.get('segments', [])]
    xs = sorted({p[0] for s in segs for p in s})
    probes = list(xs) + [(a + b) / 2 for a, b in zip(xs, xs[1:])]
    for x in probes:
        ys = []
        for (x1, y1), (x2, y2) in segs:
            if abs(x1 - x2) < 1e-9:
                if abs(x - x1) < 1e-9:
                    if abs(y1 - y2) > 1e-9:
                        return False
                    ys.append(y1)
            elif min(x1, x2) - 1e-9 <= x <= max(x1, x2) + 1e-9:
                ys.append(y1 + (y2 - y1) * (x - x1) / (x2 - x1))
        if any(abs(a - b) > 1e-6 for a in ys for b in ys):
            return False
    return True


def described_as_function(label):
    """What the option's own text alternative claims about the graph."""
    t = label.lower()
    if 'vertical line' in t or 'circle' in t or 'to the right' in t and 'parabola' in t or 'opening to the left' in t:
        return False
    if 'rays' in t:
        return not re.search(r'opening to the (?:right|left)', t)
    return True


def solve_graph_is_function(public):
    for o in public['response']['options']:
        require(graph_is_function(o['scene']) == described_as_function(o['label']), 'Figure disagrees with its text alternative: ' + o['label'])
    found = [o['id'] for o in public['response']['options'] if graph_is_function(o['scene'])]
    require(len(found) == 1, f'Expected one function graph, found {len(found)}')
    return found[0]


def interval_set(sc):
    nl = [e for e in sc['elements'] if e['type'] == 'numberLine']
    require(len(nl) == 1 and len(nl[0]['intervals']) == 1, 'Expected one interval')
    iv = nl[0]['intervals'][0]
    lo, hi = iv['from'], iv['to']
    ol, oh = iv['open']
    require((lo is None) != (hi is None), 'Expected a ray')
    return (lo, ol, None, None) if hi is None else (None, None, hi, oh)


def solve_inequality_line(public):
    text = plain(re.search(r'solutions of \$([^$]+)\$', public['prompt'])[1])
    m = re.fullmatch(r'(.+?)(\\ge|\\le|<|>)(.+)', text)
    require(m, 'Unrecognized inequality')
    D = lambda x: ev(m[1], x=x) - ev(m[3], x=x)
    s, i = D(Q(1)) - D(Q(0)), D(Q(0))
    require(s != 0, 'Not a linear inequality')
    b = -i / s
    op = m[2]
    holds_right = (s > 0) == (op in ('\\ge', '>'))
    closed = op in ('\\ge', '\\le')

    def truth(oid):
        sc = next(o['scene'] for o in public['response']['options'] if o['id'] == oid)
        lo, ol, hi, oh = interval_set(sc)
        if holds_right:
            return lo is not None and Q(str(lo)) == b and ol == (not closed)
        return hi is not None and Q(str(hi)) == b and oh == (not closed)
    found = [o['id'] for o in public['response']['options'] if truth(o['id'])]
    require(len(found) == 1, f'Expected one number line, found {len(found)}')
    return found[0]


def solve_function_missing_input(public):
    p = plain(public['prompt'])
    pairs = re.findall(r'\((-?\d+|k), (-?\d+)\)', p.split('has an unknown')[0])
    fixed = [(Q(a), Q(b)) for a, b in pairs if a != 'k']
    ky = [Q(b) for a, b in pairs if a == 'k']
    require(len(ky) == 1, 'Exactly one unknown input expected')
    want_function = 'is not a function' not in p
    require('a function' in p, 'Question wording')

    def is_function(k):
        rel = fixed + [(k, ky[0])]
        return all(y1 == y2 for x1, y1 in rel for x2, y2 in rel if x1 == x2)
    return only(public, lambda l: is_function(num(l)) == want_function)


def solve_shift_notation(public):
    p = plain(public['prompt'])
    m = re.search(r'(\d+) units? to the (left|right) and (\d+) units? (up|down)', p)
    require(m, 'Unrecognized shift')
    h = Q(m[1]) * (1 if m[2] == 'right' else -1)
    k = Q(m[3]) * (1 if m[4] == 'up' else -1)
    concrete = re.search(r'function f\(x\) = ([^ ].*?) is shifted', p)

    def truth(label):
        rhs = plain(label).split('=', 1)[1]
        if concrete:
            f = lambda x: ev(concrete[1], x=x)
            return all(ev(rhs, x=x) == f(x - h) + k for x in map(Q, (-3, 0, 1, 4, 7)))
        s = re.fullmatch(r'\s*f\(x ([+-]) (\d+)\) ([+-]) (\d+)\s*', rhs)
        require(s, 'Unrecognized symbolic shift')
        return (-Q(s[2]) if s[1] == '+' else Q(s[2])) == h and (Q(s[4]) if s[3] == '+' else -Q(s[4])) == k
    return only(public, truth)


def solve_radical_value(public):
    f = re.search(r'f\(x\) = ([^$]+)\$', public['prompt'])[1]
    a = re.search(r'What is \$f\((-?\d+)\)\$', public['prompt'])[1]
    return str(ev(f, x=Q(a)))


def set_of(label):
    m = re.fullmatch(r'\\\{(.+)\\\}', label.replace('$', '').strip())
    require(m, 'Expected a set ' + label)
    vals = [num(v) for v in m[1].split(',')]
    require(len(set(vals)) == len(vals), 'Repeated set element')
    return set(vals)


def real_zero_set(f, degree):
    coeffs = fit_poly(f, degree)
    zeros = set()
    for r in range(-300, 301):
        if sum(c * Q(r) ** i for i, c in enumerate(coeffs)) == 0:
            zeros.add(Q(r))
    # Divide every zero out (with multiplicity); nothing real may remain.
    rem = coeffs
    while len(rem) > 1 and rem[-1] == 0:
        rem = rem[:-1]
    for z in sorted(zeros):
        while len(rem) > 1 and sum(c * z ** i for i, c in enumerate(rem)) == 0:
            out, carry = [], Q(0)
            for c in rem[::-1][:-1]:
                carry = c + carry * z
                out.append(carry)
            rem = out[::-1]
    require(len(rem) != 2, 'Non-integer linear zero')
    if len(rem) == 3:
        require(not quad_roots(rem[2], rem[1], rem[0]), 'Non-integer real zero left over')
    require(len(rem) <= 3, 'Unfactored remainder')
    return zeros


def solve_zeros(public):
    f = re.search(r'f\(x\) = ([^$]+)\$', public['prompt'])[1]
    fn = lambda x: ev(f, x=x)
    zeros = real_zero_set(fn, 4)
    return only(public, lambda l: set_of(l) == zeros)


def solve_quadratic_negative_output(public):
    f = re.search(r'f\(x\) = ([^$]+)\$', public['prompt'])[1]
    target = num(re.search(r'f\(x\) = (-?\d+)\?', plain(public['prompt']))[1])
    c0, c1, c2 = fit_poly(lambda x: ev(f, x=x), 2)
    roots = quad_roots(c2, c1, c0 - target)
    require(roots, 'No real solutions')
    return only(public, lambda l: set_of(l) == roots)


def solve_axis_rule(public):
    h = Q(re.search(r'axis of symmetry of \$x = (-?\d+)\$', public['prompt'])[1])

    def truth(label):
        rhs = plain(label).split('=', 1)[1]
        c0, c1, c2 = fit_poly(lambda x: ev(rhs, x=x), 2)
        return c2 != 0 and -c1 / (2 * c2) == h
    return only(public, truth)


def solve_quadratic_formula(public):
    left, right = plain(re.search(r'solutions of \$([^$]+)\$', public['prompt'])[1]).split('=')
    c0, c1, c2 = fit_poly(lambda x: ev(left, x=x) - ev(right, x=x), 2)
    disc = c1 * c1 - 4 * c2 * c0

    def truth(label):
        m = re.fullmatch(r'x = \\frac\{(-?\d+) \\pm \\sqrt\{(\d+)\}\}\{(-?\d+)\}', plain(label).strip())
        require(m, 'Unrecognized quadratic-formula option')
        p, rad, q = Q(m[1]), Q(m[2]), Q(m[3])
        return p / q == -c1 / (2 * c2) and rad / (q * q) == disc / (4 * c2 * c2)
    return only(public, truth)


def solve_factor_trinomial(public):
    target = fit_poly(lambda x: ev(re.search(r'equivalent to \$([^$]+)\$', public['prompt'])[1], x=x), 2)
    return only(public, lambda l: fit_poly(lambda x: ev(plain(l), x=x), 2) == target)


# --------------------------------------------------------------------------- equations
def linear_root(left, right):
    D = lambda x: ev(left, x=x) - ev(right, x=x)
    s = D(Q(1)) - D(Q(0))
    require(s != 0, 'Not a unique linear solution')
    return -D(Q(0)) / s


def solve_decimal_both_sides(public):
    left, right = plain(re.search(r'solution of \$([^$]+)\$', public['prompt'])[1]).split('=')
    x = linear_root(left, right)
    return only(public, lambda l: num(l) == x)


def solve_grouped(public):
    left, right = plain(re.search(r'Solve for \$x\$: \$([^$]+)\$', public['prompt'])[1]).split('=')
    return str(linear_root(left, right))


def solve_point_slope(public):
    pts = [(Q(a), Q(b)) for a, b in re.findall(r'\((-?\d+), (-?\d+)\)', plain(public['prompt']))]
    require(len(pts) == 2 and pts[0][0] != pts[1][0], 'Expected two points with distinct x')

    def truth(label):
        left, right = plain(label).split('=')
        return all(ev(left, x=x, y=y) == ev(right, x=x, y=y) for x, y in pts)
    return only(public, truth)


def solve_total_cost(public):
    p = plain(public['prompt'])
    m = re.search(r'sells (.+?) for (\d+) dollars each and (.+?) for (\d+) dollars each\. In one day it sells (\d+) \w+ '
                  r'and (?:takes in|collects) (\d+) dollars\. Let n be the number of (.+?) sold', p)
    require(m, 'Unrecognized wording')
    a_name, a_price, b_name, b_price, count, total, n_name = m.groups()
    n_price, other = (a_price, b_price) if n_name == a_name else (b_price, a_price)
    require(n_name in (a_name, b_name), 'n names neither item')
    right = lambda n: Q(n_price) * n + Q(other) * (Q(count) - n) - Q(total)

    def truth(label):
        left, rhs = plain(label).split('=')
        D = lambda n: ev(left, n=n) - ev(rhs, n=n)
        s = D(Q(1)) - D(Q(0))
        t = right(Q(1)) - right(Q(0))
        require(t != 0, 'Degenerate equation')
        lam = s / t
        return lam != 0 and all(D(Q(n)) == lam * right(Q(n)) for n in range(0, 6))
    return only(public, truth)


def solve_isolate_formula(public):
    p = public['prompt']
    formula = next(d for d in dollars(p) if re.match(r'[A-Za-z] = ', d))
    target = re.search(r'gives \$([^$]+)\$ in terms', p)[1]
    lhs, rhs = formula.split(' = ', 1)
    assign = [Q(3), Q(5), Q(7), Q(2), Q(11), Q(13)]

    def symbols(*texts):
        toks = []
        for t in texts:
            for m in re.finditer(r'\\pi|\\[a-zA-Z]+|[A-Za-z](?:_\d)?', t):
                if m[0].startswith('\\') and m[0] != '\\pi':
                    continue
                if m[0] not in toks:
                    toks.append(m[0])
        return toks

    def compile_(text, letter):
        text = re.sub(r'\\frac(\d)(\d)', r'\\frac{\1}{\2}', text)

        def sub(m):
            if m[0].startswith('\\') and m[0] != '\\pi':
                return m[0]
            return letter[m[0]]
        return re.sub(r'\\pi|\\[a-zA-Z]+|[A-Za-z](?:_\d)?', sub, text)

    def truth(label):
        left, opt = label.replace('$', '').split(' = ', 1)
        require(left.strip() == target, 'Option solves for a different symbol')
        toks = symbols(formula, label)
        pool = [c for c in 'abcdefghijklmnopqrstuvwxyz' if c not in 'xy'][:len(toks)]
        letter = dict(zip(toks, pool))
        for shift in range(3):
            env = {letter[t]: assign[(i + shift) % len(assign)] for i, t in enumerate(toks)}
            tv = ev(compile_(opt, letter), **{k: v for k, v in env.items() if k != letter[target]})
            env[letter[target]] = tv
            if ev(compile_(rhs, letter), **env) != env[letter[lhs.strip()]]:
                return False
        return True
    return only(public, truth)


def solve_substitute(public):
    p = plain(public['prompt'])
    e1, e2 = [s.split('=') for s in dollars(public['prompt'])[:2]]
    e1, e2 = [plain(x) for x in e1], [plain(x) for x in e2]
    m = re.search(r'solving the (first|second) equation for y and substituting into the (first|second)', p)
    require(m and m[1] != m[2], 'Unrecognized substitution wording')
    src, dst = (e1, e2) if m[1] == 'first' else (e2, e1)
    # y = (src_left - src_right at y=0 ...): solve src for y exactly (linear in y).
    S = lambda x, y: ev(src[0], x=x, y=y) - ev(src[1], x=x, y=y)
    sy = S(Q(0), Q(1)) - S(Q(0), Q(0))
    require(sy != 0, 'Cannot solve for y')
    y_of = lambda x: -S(x, Q(0)) / sy
    D = lambda x: ev(dst[0], x=x, y=y_of(x)) - ev(dst[1], x=x, y=y_of(x))

    def truth(label):
        left, right = plain(label).split('=')
        O = lambda x: ev(left, x=x) - ev(right, x=x)
        xs = [Q(i) for i in range(-3, 4)]
        base = next(x for x in xs if D(x) != 0)
        lam = O(base) / D(base)
        return lam != 0 and all(O(x) == lam * D(x) for x in xs)
    return only(public, truth)


SOLVERS = {
    'arithmetic-distant-term': solve_sequences, 'geometric-signed-term': solve_sequences,
    'rate-unit-chain': solve_rate_unit_chain, 'negative-monomial-power': solve_negative_monomial,
    'combine-unlike-radicals': solve_combine_radicals, 'complete-square-equation': solve_complete_square_equation,
    'complete-square-step-property': solve_step_property, 'polynomial-structure': solve_polynomial_structure,
    'exponential-initial-value': solve_exponential_initial, 'exponential-decay-table': solve_decay_table,
    'exponential-passes-linear': solve_passes_linear, 'two-way-share': solve_two_way,
    'quartile-list': solve_quartile, 'average-rate-table-rounded': solve_average_rate,
    'correlation-causation-choice': solve_correlation, 'budget-whole-items': solve_budget,
    'abs-equals-linear-unique': solve_abs_equals_linear, 'parabola-axis-vertex-graph': solve_parabola_vertex_graph,
    'graph-is-function': solve_graph_is_function, 'inequality-both-sides-number-line': solve_inequality_line,
    'function-missing-input': solve_function_missing_input, 'shift-function-notation': solve_shift_notation,
    'radical-function-value': solve_radical_value, 'zeros-of-factored-product': solve_zeros,
    'quadratic-negative-output': solve_quadratic_negative_output, 'parabola-axis-rule': solve_axis_rule,
    'quadratic-formula-positive': solve_quadratic_formula, 'factor-large-trinomial': solve_factor_trinomial,
    'decimal-both-sides-equation': solve_decimal_both_sides, 'grouped-both-sides-solve': solve_grouped,
    'point-slope-two-points': solve_point_slope, 'total-and-cost-equation': solve_total_cost,
    'isolate-two-term-formula': solve_isolate_formula, 'substitute-into-equation': solve_substitute,
}
require(set(SOLVERS) == SUPPORTED, 'Solver table and SUPPORTED disagree')


def solve(public):
    return SOLVERS[public['templateId']](public)


def review_problem(problem):
    public = problem['public']
    expected = solve(public)
    if public['templateId'] in CHOICE:
        require(expected == problem['answer'], f'Incorrect choice for {public["templateId"]}')
    else:
        require(public['response']['kind'] in ('number', 'fraction'), 'Expected numeric response')
        require(Q(expected) == Q(problem['answer']), f'Incorrect numeric answer for {public["templateId"]}')
    if public['templateId'] in CHOICE:
        ids = [o for o, _ in options(public)]
        require(len(set(ids)) == len(ids), 'Duplicate option ids')
        labels = [re.sub(r'\s+', '', plain(l)) for _, l in options(public)]
        require(len(set(labels)) == len(labels), 'Two options read the same')
    return expected


FIXTURES = Path(__file__).with_name('regents_algebra_one_oracle_fixtures.json')


def self_test():
    """Each fixture is a real exported case; every corrupted copy must be rejected."""
    cases = json.loads(FIXTURES.read_text())
    require({c['public']['templateId'] for c in cases} == SUPPORTED, 'Missing fixture for a template')
    rejected = 0

    def reject(bad):
        nonlocal rejected
        try:
            review_problem(bad)
        except (ValueError, ZeroDivisionError, StopIteration, KeyError, IndexError, AttributeError, TypeError):
            rejected += 1
            return
        raise AssertionError('Corrupted Algebra I fixture accepted: ' + bad['public']['templateId'])

    for case in cases:
        review_problem(case)
        kind = case['public']['templateId'] in CHOICE
        bad = copy.deepcopy(case)
        if kind:
            ids = [o for o, _ in options(case['public'])]
            bad['answer'] = next(i for i in ids if i != case['answer'])
        else:
            bad['answer'] = str(Q(case['answer']) + 1)
        reject(bad)
        if kind and case['public']['response']['kind'] == 'choice':
            labels = case['public']['response']['options']
            bad = copy.deepcopy(case)
            wrong = next(i for i, o in enumerate(labels) if o['id'] != case['answer'])
            bad['public']['response']['options'][wrong]['label'] = next(o['label'] for o in labels if o['id'] == case['answer'])
            reject(bad)
    by = {c['public']['templateId']: c for c in cases}
    bad = copy.deepcopy(by['two-way-share']); bad['public']['figure']['scene']['elements'][0]['rows'][0]['cells'][0] += 5; reject(bad)
    bad = copy.deepcopy(by['parabola-axis-vertex-graph']); bad['public']['figure']['scene']['elements'][0]['curves'][0]['fn']['c'][0] += 1; reject(bad)
    bad = copy.deepcopy(by['average-rate-table-rounded']); bad['public']['figure']['scene']['elements'][0]['rows'][-1]['cells'][0] = '1'; reject(bad)
    bad = copy.deepcopy(by['graph-is-function'])
    answer = next(o for o in bad['public']['response']['options'] if o['id'] == bad['answer'])
    answer['scene']['elements'][0].pop('curves', None)
    answer['scene']['elements'][0].pop('lines', None)
    answer['scene']['elements'][0]['segments'] = [{'from': [0, 0], 'to': [0, 3]}]
    reject(bad)
    bad = copy.deepcopy(by['inequality-both-sides-number-line'])
    for o in bad['public']['response']['options']:
        o['scene']['elements'][0]['intervals'][0]['open'] = [True, True]
    reject(bad)
    for tid, old, new in (('arithmetic-distant-term', 'term', 'term'), ('quartile-list', 'upper', 'lower'), ('budget-whole-items', 'greatest', 'greatest')):
        bad = copy.deepcopy(by[tid])
        if old != new:
            bad['public']['prompt'] = bad['public']['prompt'].replace(old, new)
            reject(bad)
    bad = copy.deepcopy(by['rate-unit-chain']); bad['public']['prompt'] = bad['public']['prompt'].replace('meters', 'feet', 1); reject(bad)
    bad = copy.deepcopy(by['shift-function-notation']); bad['public']['prompt'] = bad['public']['prompt'].replace('right', 'left').replace('up', 'down'); reject(bad)
    return {'fixtures': len(cases), 'rejectedMutations': rejected}


if __name__ == '__main__':
    print(self_test())
