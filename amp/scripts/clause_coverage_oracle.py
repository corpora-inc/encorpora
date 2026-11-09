"""Independent public-payload oracle for the clause-coverage extensions.

This module deliberately does not import the TypeScript generators and never
uses their answer, variant, hint, explanation or private grading to solve an
item. Numerical rules are reconstructed from prompts; graph choices are tested
against their function data, and proofs are checked against independent reason
and prerequisite rules. Call review_problem for build proofs: several valid
topological orders can have different canonical strings.
"""
import copy
import json
import math
import re
from fractions import Fraction as F

from function_behavior_math_oracle import evaluate as expression_value


def require(value, message):
    if not value:
        raise ValueError(message)


def plain(text):
    return text.replace('$', '').replace('−', '-').replace('°', '^\\circ').strip()


def compact(text):
    return re.sub(r'\s+', '', plain(text))


def js(value):
    return json.dumps(value, separators=(',', ':'), ensure_ascii=False)


def num(text):
    return F(str(text).replace(',', ''))


def evaluate(text, x=0, variable='x'):
    text = plain(text).replace('\\tfrac', '\\frac')
    if '=' in text:
        text = text.split('=')[-1]
    if variable != 'x':
        text = re.sub(r'(?<![A-Za-z])' + re.escape(variable) + r'(?![A-Za-z])', 'x', text)
    return expression_value(text, x=F(x), y=F(0))


def numeric_pi(text):
    """Return (coefficient, has_pi), preserving pi as an exact formal factor."""
    s = plain(text).replace('^\\circ', '')
    has = '\\pi' in s
    s = s.replace('\\pi', '')
    return evaluate(s or '1'), has


def graph(public):
    elements = public.get('figure', {}).get('scene', {}).get('elements', [])
    found = [e for e in elements if e['type'] == 'graph']
    require(len(found) == 1, 'Expected one graph in the public figure')
    return found[0]


def table(public):
    elements = public.get('figure', {}).get('scene', {}).get('elements', [])
    found = [e for e in elements if e['type'] == 'table']
    require(len(found) == 1, 'Expected one table in the public figure')
    return found[0]


def fn_value(fn, x):
    x = F(x)
    kind = fn['f']
    if kind == 'poly':
        return sum((F(str(c)) * x ** i for i, c in enumerate(fn['c'])), F(0))
    if kind == 'rational':
        den = sum((F(str(c)) * x ** i for i, c in enumerate(fn['den'])), F(0))
        return sum((F(str(c)) * x ** i for i, c in enumerate(fn['num'])), F(0)) / den
    a, h, k = (F(str(fn.get(key, default))) for key, default in [('a', 1), ('h', 0), ('k', 0)])
    if kind == 'abs':
        return a * abs(x - h) + k
    if kind == 'exp':
        return float(a) * fn['b'] ** float(x - h) + float(k)
    if kind == 'log':
        return float(a) * math.log(float(x - h), fn['base']) + float(k)
    if kind in ('sin', 'cos'):
        return float(a) * getattr(math, kind)(fn['b'] * float(x - h)) + float(k)
    raise ValueError('Unrecognized public graph function ' + kind)


def expression_signature(label, variable='x'):
    """Compare these bounded-degree expression options as functions, exactly."""
    text = plain(label)
    has_pi = '\\pi' in text
    text = text.replace('\\pi', '').replace('^\\circ', '') or '1'
    values = []
    for x in (F(i) if variable in ('n', 't') else F(i, 17) for i in range(1, 14)):
        try:
            values.append(evaluate(text, x, variable))
        except ZeroDivisionError:
            values.append('undefined')
    return has_pi, tuple(values)


def distinct_expressions(options, variable='x'):
    signatures = [expression_signature(o['label'], variable) for o in options]
    require(len(set(signatures)) == len(signatures), 'Equivalent expression distractors')


def distinct_graphs(options):
    signatures = []
    for option in options:
        graphs = [e for e in option.get('scene', {}).get('elements', []) if e['type'] == 'graph']
        if len(graphs) != 1:
            return  # Construction scenes have a different independent check.
        curves = graphs[0].get('curves')
        if not curves:
            return  # Story polylines are checked against their public durations.
        curve_signatures = []
        for curve in curves:
            values = []
            # Nonintegral points also distinguish sin(pi*x) from the zero graph.
            for x in [F(i, 7) for i in range(-9, 10)]:
                try:
                    value = fn_value(curve['fn'], x)
                    values.append(str(value) if isinstance(value, F) else f'{value:.10f}')
                except (ValueError, ZeroDivisionError):
                    values.append('undefined')
            curve_signatures.append((tuple(curve.get('domain', [])), tuple(curve.get('ends', [])), tuple(values)))
        signatures.append(tuple(sorted(curve_signatures)))
    require(len(set(signatures)) == len(signatures), 'Equivalent graph distractors')


def choose(public, predicate, numeric=False):
    options = public['response']['options']
    require(len({o['label'] for o in options}) == len(options), 'Duplicate option labels')
    if public['response']['kind'] == 'figure-choice':
        distinct_graphs(options)
    found = [o['id'] for o in options if predicate(o)]
    require(len(found) == 1, 'Missing or ambiguous correct choice: ' + public['prompt'])
    if numeric:
        vals = [numeric_pi(o['label']) for o in options]
        require(len(set(vals)) == len(vals), 'Equivalent numerical distractors')
    return found[0]


def exact_choice(public, label):
    return choose(public, lambda o: compact(o['label']) == compact(label))


def slots(public, predicates):
    blanks = public['response']['blanks']
    require(len(blanks) == len(predicates), 'Wrong number of proof/value blanks')
    answer = {}
    for blank, predicate in zip(blanks, predicates):
        require(len({compact(o['label']) for o in blank['options']}) == len(blank['options']), 'Duplicate blank options')
        try:
            signatures = [expression_signature(o['label']) for o in blank['options']]
        except (ValueError, KeyError, SyntaxError):
            signatures = None  # Text reasons and definitions are checked by their meaning below.
        if signatures is not None:
            require(len(set(signatures)) == len(signatures), 'Equivalent blank distractors')
        ids = [o['id'] for o in blank['options'] if predicate(o['label'])]
        require(len(ids) == 1, 'Ambiguous blank ' + blank['label'])
        answer[blank['id']] = ids[0]
    return js(answer)


def equal(expected):
    return lambda text: compact(text) == compact(expected)


def number_equal(expected, pi=False):
    def accepts(text):
        try:
            return numeric_pi(text) == (F(expected), pi)
        except (ValueError, ZeroDivisionError):
            return False
    return accepts


MARKERS = {
    'times-table-pattern': ('Complete the explanation for', 'Why does this work for every column?', 'In an addition table', 'addition-table entries'),
    'rule-pattern-feature': ('Why will',),
    'coordinate-context-points': ('Plot the point showing', 'Plot the three rows'),
    'pattern-pair-relationship': ('including the starting values, and plot',),
    'related-patterns-relationship': ('Why is each B term',),
    'dependent-variable-value': ('Plot the pairs for', 'Complete the ordered pairs'),
    'story-graph-match': ('The graph has parts A', 'A tub starts empty', 'Which graph shows a nonlinear function?'),
    'graphical-solution-table': ('which point lies on both graphs', 'Why is $x=', 'Use the table and its halfway input'),
    'rational-abs-solution-count': ('How many real solutions does $\\log_', 'How many real solutions does $2^x', 'How many real solutions does $3^x', 'How many real solutions does $4^x'),
    'fl-function-arithmetic': ('Coffee starts', 'Coffee cools in a room', 'A service charges a fixed', 'Which function gives profit?'),
    'composition-expression': ("A balloon's height",),
    'series-recursion': ('$a_n=a_{n-1}+',),
    'fl-even-odd-classify': ('Is the function shown even', 'Which graph shows an odd function?'),
    'inverse-expression': ('Check $f(g(x))=x$', 'Complete the inverse check'),
    'sat-entry-fn-linear-notation': ("plumber's charge",),
    'average-rate-table-rounded': ('Which statement interprets it?',),
    'graph-quadratic-points': ('two horizontal-axis intercepts',),
    'graph-sqrt-points': ('center point and the points exactly one',),
    'piecewise-reading': ('Which graph shows $f(x)=\\begin{cases}',),
    'polynomial-graph-match': ('Which graph shows $P(x)=',),
    'rational-function-features': ('Which graph shows $f(x)=\\frac',),
    'sinusoid-parameters': ('Which graph shows $y=',),
    'coordinate-terms-slots': ('Complete the definitions of a coordinate system.',),
    'circle-estimate-blanks': ('Complete the rectangle argument.',),
    'circle-angles': ('Tangents from $',),
    'triangle-circle-centers': ('Prove that opposite angles',),
    'arc-sector-derivation': ('Complete the dilation argument', 'Derive its area formula'),
    'two-column-angle-proof': ('Line $DE$ passes through $C$', 'Lines $AC$ and $BD$ intersect', 'Postulate: alternate interior', 'let $T$ translate along'),
    'compass-straightedge-reasoning': ('Copy segment $AB$', 'Copy $\\angle CAB=', 'Copy angle BAC=', 'Construct a line through $P$', 'A transversal through $P$', 'A transversal AP', 'Fold tracing paper', 'Fold one ray', 'Fold a line onto itself', 'A first fold through P', 'A reflection in a crease', 'which compass openings produce', 'place the compass center for the matching arc', 'Which picture adds the correct next circle?', 'Construct the perpendicular through P', 'Construct the perpendicular from P', 'Bisect angle BAC'),
}


def recognizes(public):
    if public['templateId'] == 'two-column-triangle-proof':
        return True
    return any(plain(marker) in plain(public['prompt']) for marker in MARKERS.get(public['templateId'], ()))


def solve(public):
    require(recognizes(public), 'Not a clause-extension item')
    tid, prompt, response = public['templateId'], public['prompt'], public['response']
    text = plain(prompt)
    kind = response['kind']
    if kind == 'structured-work':
        return proof_answer(public)
    if tid == 'times-table-pattern':
        if kind == 'multi-part-choice':
            row, n = map(int, re.search(r'explanation for (\d+) × (\d+)', text).groups())
            return slots(public, [number_equal(F(row * n, 2))] * 4 + [equal('even')])
        if 'every column' in text:
            return choose(public, lambda o: 'equal groups are' in o['label'] and 'the groups add' in o['label'])
        return choose(public, lambda o: o['label'].startswith('Changing the order') if 'row ' in text else o['label'].startswith('One addend increases'))
    if tid == 'rule-pattern-feature':
        step = int(re.search(r'and add (\d+)', text)[1])
        if 'ones digit alternate' in text:
            correct = lambda s: s.startswith('Adding 5 twice adds 10')
        elif 'ones digit stay' in text:
            correct = lambda s: 'has 0 ones' in s and 'never changes' in s
        elif step % 2:
            correct = lambda s: s.startswith('Adding an odd number changes odd to even')
        else:
            correct = lambda s: s.startswith('Adding an even number keeps the parity')
        return choose(public, lambda o: correct(o['label']))
    if tid == 'coordinate-context-points':
        if 'after ' in text:
            x, y = map(int, re.search(r'after (\d+) weeks, (\d+) dollars', text).groups())
            return js([[x, y]])
        rate = int(re.search(r'holds (\d+) pencils', text)[1])
        points = [[x, rate * x] for x in (1, 2, 3)]
        require([row['cells'] for row in table(public)['rows']] == points, 'Table differs from box rate')
        return js(points)
    if tid == 'pattern-pair-relationship':
        a0, da, b0, db = map(int, re.search(r'A starts at (\d+) and adds (\d+)\. Pattern B starts at (\d+) and adds (\d+)', text).groups())
        return js([[a0 + i * da, b0 + i * db] for i in range(4)])
    if tid == 'related-patterns-relationship':
        a, b, multiple = map(int, re.search(r'adds (\d+)\. Pattern B starts at 0 and adds (\d+)\. Why is each B term (\d+) times', text).groups())
        require(b == multiple * a, 'Claimed relationship is false')
        return choose(public, lambda o: 'same number of steps' in o['label'] and f'{multiple} times' in o['label'])
    if tid == 'dependent-variable-value':
        rate = int(re.search(r'd=(\d+)t', text)[1])
        return js([[x, rate * x] for x in (1, 2, 3)]) if kind == 'point-plot' else slots(public, [number_equal(rate * x) for x in (1, 2, 3)])
    if tid == 'story-graph-match':
        if kind == 'figure-choice':
            if 'nonlinear function' in text:
                return choose(public, lambda o: any(c != 0 for c in next(e for e in o['scene']['elements'] if e['type'] == 'graph')['curves'][0]['fn']['c'][2:]))
            up, level, flat, down = map(int, re.search(r'for (\d+) minutes to (\d+) liters, stays there for (\d+) minutes, then drains steadily to empty in (\d+)', text).groups())
            points = [[0, 0], [up, level], [up + flat, level], [up + flat + down, 0]]
            def matches(o):
                g = next(e for e in o['scene']['elements'] if e['type'] == 'graph')
                segs = g['segments']
                return [segs[0]['from']] + [s['to'] for s in segs] == points
            return choose(public, matches)
        i = 'ABC'.index(re.search(r'From ([ABC]) to', text)[1])
        curve = graph(public)['curves'][i]['fn']
        nonlinear = any(F(str(c)) != 0 for c in curve['c'][2:])
        return choose(public, lambda o: o['label'].startswith('Nonlinear: its rate changes') if nonlinear else o['label'].startswith('Linear: the straight segment'))
    if tid == 'graphical-solution-table':
        if 'halfway input' in text:
            return bracket_solution(public)
        if text.startswith('Given f('):
            a, a2, b = re.search(r'f\((-?\d+)\)=g\((-?\d+)\)=(-?\d+)', text).groups()
            require(a == a2, 'Intersection inputs differ')
            return exact_choice(public, f'({a},{b})')
        a, b = map(int, re.search(r'meet at \((-?\d+),(-?\d+)\)', text).groups())
        require(all(fn_value(c['fn'], a) == b for c in graph(public)['curves']), 'Drawn graphs do not meet at the stated point')
        return choose(public, lambda o: o['label'].startswith('Both graphs contain') and f'f({a})={b}' in o['label'] and f'g({a})={b}' in o['label'])
    if tid == 'rational-abs-solution-count':
        curves = graph(public)['curves']
        nonlinear = next(c['fn'] for c in curves if c['fn']['f'] in ('log', 'exp'))
        line = next(c['fn'] for c in curves if c['fn']['f'] == 'poly')
        require(nonlinear.get('base', nonlinear.get('b')) > 1 and nonlinear['a'] > 0 and line['c'][1] < 0, 'Monotonicity argument does not apply')
        return exact_choice(public, '1')
    if tid == 'fl-function-arithmetic':
        if 'What does the constant' in text:
            return choose(public, lambda o: o['label'].startswith('The room temperature'))
        if 'Coffee starts' in text:
            room, excess, loss = map(F, re.search(r'room is (\d+).*?starts (\d+).*?shrinks by ([\d.]+)%', text).groups())
            expected = lambda x: room + excess * (1 - loss / 100) ** x
            variable = 't'
        elif 'service charges' in text:
            fixed, rate = map(F, re.search(r'fixed (\d+) dollars plus (\d+) dollars', text).groups())
            expected = lambda x: fixed + rate * x
            variable = 'n'
        else:
            price, fixed, cost = map(F, re.search(r'R\(n\)=(\d+)n.*?C\(n\)=(\d+)\+(\d+)n', text).groups())
            expected = lambda x: (price - cost) * x - fixed
            variable = 'n'
        distinct_expressions(response['options'], variable)
        return choose(public, lambda o: all(evaluate(o['label'], x, variable) == expected(x) for x in (0, 1, 2, 3)))
    if tid == 'composition-expression':
        h, climb, temp, lapse = map(F, re.search(r'h\(t\)=(\d+)\+(\d+)t.*?T\(y\)=(\d+)-([\d.]+)y', text).groups())
        if 'What does' in text:
            time = re.search(r'T\(h\((\d+)\)\)', text)[1]
            return exact_choice(public, f'The temperature at the balloon {time} minutes after launch.')
        return choose(public, lambda o: 'y' not in plain(o['label']) and all(evaluate(o['label'], x, 't') == temp - lapse * (h + climb * x) for x in (0, 1, 2)))
    if tid == 'series-recursion':
        first, step = map(F, re.search(r'a_1=(-?\d+).*?a_n=a_\{n-1\}\+\((-?\d+)\)', text).groups())
        distinct_expressions(response['options'], 'n')
        return choose(public, lambda o: all(evaluate(o['label'], n, 'n') == first + step * (n - 1) for n in (1, 2, 3, 4)))
    if tid == 'fl-even-odd-classify':
        if kind == 'figure-choice':
            def odd_graph(o):
                fn = next(e for e in o['scene']['elements'] if e['type'] == 'graph')['curves'][0]['fn']
                return fn_value(fn, 0) == 0 and all(fn_value(fn, x) == -fn_value(fn, -x) for x in range(1, 7))
            return choose(public, odd_graph)
        fn = graph(public)['curves'][0]['fn']
        even = all(fn_value(fn, x) == fn_value(fn, -x) for x in range(1, 7))
        odd = all(fn_value(fn, x) == -fn_value(fn, -x) for x in range(1, 7)) and fn_value(fn, 0) == 0
        prefix = 'Even: reflection' if even else 'Odd: a half turn' if odd else 'Neither:'
        return choose(public, lambda o: o['label'].startswith(prefix))
    if tid == 'inverse-expression':
        if kind == 'choice':
            a, b = map(F, re.search(r'f\(x\)=(-?[\d.]+)x\+\((-?\d+)\)', text).groups())
            distinct_expressions(response['options'])
            return choose(public, lambda o: all(a * evaluate(o['label'], x) + b == x for x in (0, 1, 2, 3, 4)))
        f = re.search(r'f\(x\)=(.*?) (?:and|for)', text)[1]
        if '\\sqrt[3]' in text:
            g = re.search(r'g\(x\)=\\sqrt\[3\]\{x/([^}]+)\}', text)
            require(g is not None, 'Unsupported cubic inverse expression')
            divisor = F(g[1])
            # Cubing and real cube root are inverse operations; the scaling
            # must cancel exactly in both compositions.
            require(all(evaluate(f, x) == divisor * x ** 3 for x in range(-3, 4)), 'Cubic scaling does not cancel')
        else:
            g = f if 'with g=f' in text else re.search(r'g\(x\)=(.*?)\. Complete', text)[1]
            for x in range(-5, 6):
                if 'with g=f' in text and x == 1:
                    continue
                require(evaluate(f, evaluate(g, x)) == x and evaluate(g, evaluate(f, x)) == x, 'The public functions are not inverses')
        return slots(public, [equal('x'), equal('x'), equal('f^{-1}=f' if 'with g=f' in text else 'g=f^{-1}')])
    if tid == 'sat-entry-fn-linear-notation':
        fixed, rate = map(int, re.search(r'C\(h\)=(\d+)\+(\d+)h', text).groups())
        if 'outside this domain' in text:
            return choose(public, lambda o: not (lambda x: x.denominator == 1 and 1 <= x <= 8)(F(re.search(r'C\(([\d.]+)\)', o['label'])[1])))
        match = re.search(r'C\((\d+)\)=(\d+) mean', text)
        if match:
            hours, charge = map(int, match.groups())
            require(fixed + rate * hours == charge, 'Function statement is false')
            return exact_choice(public, f'The charge for {hours} hours is {charge} dollars.')
        hours, charge = map(int, re.search(r'says (\d+) hours costs (\d+) dollars', text).groups())
        require(fixed + rate * hours == charge, 'Reverse function statement is false')
        return exact_choice(public, f'C({hours})={charge}')
    if tid == 'average-rate-table-rounded':
        rows = table(public)['rows']
        first, last = rows[0]['cells'], rows[-1]['cells']
        rate = F(last[1] - first[1], last[0] - first[0])
        stated = F(re.search(r'is (-?[\d,]+) people', text)[1].replace(',', ''))
        require(rate == stated, 'Average rate differs from table')
        direction = 'grew' if rate > 0 else 'declined'
        return choose(public, lambda o: f'Population {direction}' in o['label'] and 'on average' in o['label'] and F(re.search(r'by ([\d,]+)', o['label'])[1].replace(',', '')) == abs(rate))
    if tid == 'graph-quadratic-points':
        sign, p, q = re.search(r'y=(-?)\(x-\((-?\d+)\)\)\(x-\((-?\d+)\)\)', text).groups()
        a, p, q = (-1 if sign else 1), int(p), int(q)
        h = F(p + q, 2)
        require(h.denominator == 1, 'Nonlattice vertex')
        return js(sorted([[p, 0], [q, 0], [int(h), int(a * (h - p) * (h - q))], [0, a * p * q]]))
    if tid == 'graph-sqrt-points':
        a, h, k = map(int, re.search(r'y=(-?\d+)\\sqrt\[3\]\{x-\((-?\d+)\)\}\+\((-?\d+)\)', text).groups())
        return js(sorted([[h, k], [h - 1, k - a], [h + 1, k + a]]))
    if tid in ('piecewise-reading', 'polynomial-graph-match', 'rational-function-features', 'sinusoid-parameters'):
        return graph_choice(public)
    if tid == 'coordinate-terms-slots':
        return slots(public, [equal('axes'), equal('origin'), equal('ordered pair')])
    if tid in ('circle-estimate-blanks', 'circle-angles', 'triangle-circle-centers', 'arc-sector-derivation'):
        return circle_answer(public)
    if tid == 'compass-straightedge-reasoning':
        return construction_answer(public)
    raise ValueError('No clause solver for ' + tid)


def bracket_solution(public):
    prompt = plain(public['prompt'])
    match = re.search(r'f\(x\)=(.*?) and g\(x\)=([\d.]+)-x', prompt)
    fn, c = match[1], float(match[2])
    if fn.startswith('\\log_'):
        base = int(re.search(r'\\log_\{(\d+)\}', fn)[1])
        value = lambda x: math.log(x, base)
    elif re.fullmatch(r'\d+\^x', fn):
        base = int(re.search(r'(\d+)\^x', fn)[1])
        value = lambda x: base ** x
    else:
        value = {'-1/x': lambda x: -1 / x, '2|x|': lambda x: 2 * abs(x), 'x^2': lambda x: x*x, '2x+1': lambda x: 2*x+1}[fn]
    rows = table(public)['rows']
    xs = [F(row['cells'][0]) for row in rows]
    require(xs[2] - xs[0] == F(1, 10) and xs[1] * 2 == xs[0] + xs[2], 'Table is not a tenth bracket with midpoint')
    differences = []
    for x, row in zip(xs, rows):
        a, b = value(float(x)), c - float(x)
        require(abs(float(row['cells'][1]) - a) <= 0.000501 and abs(float(row['cells'][2]) - b) <= 0.000501, 'Incorrect table function value')
        differences.append(a - b)
    require(differences[0] < 0 < differences[2], 'No root in displayed bracket')
    require(abs(differences[1]) >= 0.005, 'Ambiguous halfway test')
    return str(float(xs[0] if differences[1] > 0 else xs[2])).rstrip('0').rstrip('.')


def graph_choice(public):
    prompt = plain(public['prompt'])
    tid = public['templateId']
    def option_graph(o):
        gs = [e for e in o['scene']['elements'] if e['type'] == 'graph']
        require(len(gs) == 1, 'Graph choice must contain one graph')
        return gs[0]
    if tid == 'piecewise-reading':
        if '\\le x<' in prompt:
            values = [int(x) for x in re.findall(r'(?:cases\}|\\\\)(-?\d+)&', prompt)]
            require(len(values) == 3, 'Could not parse step function')
            def matches(o):
                curves = option_graph(o)['curves']
                return len(curves) == 3 and all(c['domain'] == [i, i + 1] and c['ends'] == ['closed', 'open'] and fn_value(c['fn'], F(2 * i + 1, 2)) == values[i] for i, c in enumerate(curves))
        else:
            b, intercept = map(int, re.search(r'-x\+\((-?\d+)\).*?2x\+\((-?\d+)\)', prompt).groups())
            def matches(o):
                curves = option_graph(o)['curves']
                return len(curves) == 2 and curves[0]['domain'][1] == b and curves[1]['domain'][0] == b and curves[0]['ends'][1] == 'closed' and curves[1]['ends'][0] == 'open' and all(fn_value(curves[0]['fn'], x) == -x + b for x in (b - 1, b)) and all(fn_value(curves[1]['fn'], x) == 2 * x + intercept for x in (b, b + 1))
        return choose(public, matches)
    if tid == 'polynomial-graph-match':
        sign, p, ep, q, eq = re.search(r'P\(x\)=(-?)\(x-\((-?\d+)\)\)\^\{(\d+)\}\(x-\((-?\d+)\)\)\^\{(\d+)\}', prompt).groups()
        a, p, ep, q, eq = -1 if sign else 1, int(p), int(ep), int(q), int(eq)
        require(ep + eq <= 5, 'Polynomial-degree check requires more samples')
        expected = lambda x: a * (x - p) ** ep * (x - q) ** eq
        return choose(public, lambda o: all(fn_value(option_graph(o)['curves'][0]['fn'], x) == expected(x) for x in range(-6, 7)))
    if tid == 'rational-function-features':
        a, z = map(int, re.search(r'\\frac\{(-?\d+)\(x-\((-?\d+)\)\)\}', prompt).groups())
        poles = list(map(int, re.findall(r'x-\((-?\d+)\)', prompt)))[1:]
        def expected(x):
            d = 1
            for v in poles:
                d *= x - v
            return F(a * (x - z), d)
        def matches(o):
            fn = option_graph(o)['curves'][0]['fn']
            for x in range(-9, 10):
                if x in poles:
                    continue
                try:
                    if fn_value(fn, x) != expected(x):
                        return False
                except ZeroDivisionError:
                    return False
            return True
        # There is no tolerance: equality at enough exact samples establishes these low-degree rational identities.
        return choose(public, matches)
    a, trig, argument, k = re.search(r'y=(-?\d+)\\(sin|cos)\(([^)]+)\)\+\((-?\d+)\)', prompt).groups()
    a, k = int(a), int(k)
    argument = compact(argument)
    pi_factor = re.fullmatch(r'\\pix(?:/(\d+))?', argument)
    numeric_factor = re.fullmatch(r'(\d*)x', argument)
    require(pi_factor or numeric_factor, 'Unsupported trigonometric input coefficient')
    frequency = math.pi / int(pi_factor[1] or 1) if pi_factor else int(numeric_factor[1] or 1)
    def matches(o):
        fn = option_graph(o)['curves'][0]['fn']
        return fn['f'] == trig and fn['a'] == a and fn.get('k', 0) == k and abs(fn['b'] - frequency) < 1e-12 and fn.get('h', 0) == 0
    return choose(public, matches)


def circle_answer(public):
    tid, text, response = public['templateId'], plain(public['prompt']), public['response']
    if tid == 'circle-estimate-blanks':
        decimal = 'Use 3.14' in text
        value = re.search(r'has (radius|diameter|circumference) (.*?) cm', text)
        source, amount = value.groups()
        coefficient, has_pi = numeric_pi(amount)
        radius = coefficient if source == 'radius' else coefficient / 2 if source == 'diameter' else coefficient / (F(628, 100) if decimal else 2)
        require(radius.denominator == 1 and 2 <= radius <= 12, 'Invalid radius from givens')
        width, area = (F(314, 100) * radius, F(314, 100) * radius * radius) if decimal else (radius, radius * radius)
        height = ('half-diameter' if source == 'diameter' else 'radius') + f', {radius} cm'
        return slots(public, [equal(height), equal('half the circumference'), number_equal(width, not decimal), number_equal(area, not decimal)])
    if tid == 'circle-angles':
        if 'Which equation always' in text:
            return choose(public, lambda o: '+' in o['label'] and '=180^\\circ' in compact(o['label']))
        given = int(re.search(r'=([0-9]+)\^\\circ', text)[1])
        answer = 180 - given
        if 'on the major arc' in text:
            answer = F(answer, 2)
        result = choose(public, lambda o: numeric_pi(o['label']) == (answer, False), numeric=True)
        elements = public['figure']['scene']['elements']
        segments = {e.get('id'): e for e in elements if e['type'] == 'segment'}
        # The tangent/radius pairs must be perpendicular in the actual scene.
        for radius_id, tangent_id in [('s0', 's2'), ('s1', 's3')]:
            first, second = segments[radius_id], segments[tangent_id]
            u = [first['to'][i] - first['from'][i] for i in (0, 1)]
            v = [second['to'][i] - second['from'][i] for i in (0, 1)]
            require(abs(sum(a * b for a, b in zip(u, v))) < 1e-7, 'A tangent is not perpendicular to its radius')
        return result
    if tid == 'triangle-circle-centers':
        labels = re.search(r'inscribed quadrilateral ([A-Z]{4})', text)[1]
        a, b, c, d = labels
        predicates = [equal(b + c + d), equal('An inscribed angle is half its intercepted arc.'), equal(d + a + b), number_equal(360), equal('The two arcs make the whole circle, without overlap.')]
        numeric = re.search(r'measure (\d+)\^\\circ and (\d+)\^\\circ', text)
        if numeric:
            arc1, arc2 = map(int, numeric.groups())
            require(arc1 + arc2 == 360, 'Complementary arcs must cover one circle')
            predicates.append(equal(f'{arc1 / 2:g}^\\circ, {arc2 / 2:g}^\\circ; 180^\\circ'))
        else:
            predicates.append(number_equal(180))
        return slots(public, predicates)
    if 'Concentric circles' in text:
        r1, r2, s1 = map(F, re.search(r'r_1=(\d+(?:\.\d+)?).*?r_2=(\d+(?:\.\d+)?).*?s_1=(\d+(?:\.\d+)?)', text).groups())
        scale, s2 = r2 / r1, s1 * r2 / r1
        require(s1 / r1 == s2 / r2, 'Arc/radius proportionality failed')
        return slots(public, [number_equal(scale), equal('\\theta'), number_equal(s2), equal('s_2/r_2=(ks_1)/(kr_1)=s_1/r_1'), equal('the angle'), equal('radians')])
    radius, theta = re.search(r'check it for radius (\d+) and angle (.*?)(?: radians)?\.$', text).groups()
    radius = F(radius)
    degree = 'measured in degrees' in text
    predicates = [equal('\\theta/360' if degree else '\\theta/(2\\pi)'), equal('\\pi r^2'), equal('(\\theta/360)\\pi r^2' if degree else '\\tfrac12 r^2\\theta')]
    if not degree:
        predicates.append(equal('\\tfrac12 sr'))
    if degree:
        area = radius * radius * numeric_pi(theta)[0] / 360
        predicates.append(number_equal(area, True))
    elif '\\pi' in theta:
        den = F(re.search(r'\\pi/(\d+)', theta)[1])
        predicates.append(number_equal(radius * radius / (2 * den), True))
    else:
        predicates.append(number_equal(radius * radius * F(theta) / 2))
    return slots(public, predicates)


def construction_answer(public):
    public = copy.deepcopy(public)
    for option in public['response'].get('options', []):
        option['label'] = plain(option['label'])
    text, response = plain(public['prompt']), public['response']
    kind = response['kind']
    if kind == 'multi-select':
        length = F(re.search(r'has length (\d+)', text)[1])
        ids = [o['id'] for o in response['options'] if F(re.search(r'[\d.]+', o['label'])[0]) > length / 2]
        require(len(ids) == 2, 'Exactly two openings must make two intersections')
        return js(sorted(ids))
    if kind == 'point-plot':
        x, y = map(int, re.search(r'B=\((\d+),(\d+)\)', text).groups())
        return js([[x, y]])
    if kind == 'figure-choice':
        if text.startswith('A transversal AP'):
            return choose(public, lambda o: (lambda s: s['to'][1] == s['from'][1])(o['scene']['elements'][-1]))
        if 'matching circle' in text or 'places the next circle' in text or 'adds the next circle' in text:
            options = response['options']
            first_elements = options[0]['scene']['elements']
            points = {e['text']: e['at'] for e in first_elements if e['type'] == 'text' and re.fullmatch('[A-Z]', e['text'])}
            if text.startswith('Construct the perpendicular'):
                center, radius = points['B'], float(re.search(r'circle of radius ([\d.]+)', text)[1])
            elif text.startswith('Bisect angle BAC'):
                center, radius = points['C'], float(re.search(r'circle of radius ([\d.]+)', text)[1])
            elif text.startswith('Copy segment AB'):
                center, radius = points['P'], float(re.search(r'length ([\d.]+)', text)[1])
            elif text.startswith('Copy angle BAC'):
                center, radius = points['Q'], math.dist(points['B'], points['C'])
            else:
                raise ValueError('Unrecognized next-circle construction')
            return choose(public, lambda o: (lambda e: e['type'] == 'circle' and e['center'] == center and abs(e['r'] - radius) < 1e-9)(o['scene']['elements'][-1]))
        length, radius = map(F, re.search(r'length (\d+)\. A circle of radius ([\d.]+)', text).groups())
        def matches(o):
            circles = [e for e in o['scene']['elements'] if e['type'] == 'circle']
            return len(circles) == 2 and circles[0]['center'] == [0, 0] and circles[1]['center'] == [length, 0] and all(F(str(c['r'])) == radius for c in circles)
        return choose(public, matches)
    if text.startswith('Copy segment'):
        if 'What is next?' in text:
            return choose(public, lambda o: ('Open the compass' in o['label'] or 'Set the string length' in o['label'] or 'Use the circle tool' in o['label']) and 'AB' in o['label'])
        if 'Which order' in text:
            def valid(o):
                s = o['label']
                if any(bad in s.lower() for bad in ('before', 'change', 'half of', 'radius pa', 'radius PA')):
                    return False
                return 'ray' in s.lower() and 'AB' in s and ('center at P' in s or 'at P' in s or 'center P' in s) and 'Q' in s
            return choose(public, valid)
        return choose(public, lambda o: ('segment addition' in o['label'] if 'PR=2AB' in compact(text) else 'radius AB' in o['label'] and 'PQ = AB' in o['label']))
    if text.startswith('Copy \\angle CAB'):
        if 'Why will' in text:
            return choose(public, lambda o: 'SSS' in o['label'] and 'CPCTC' in o['label'])
        return choose(public, lambda o: 'radius to BC' in o['label'] and 'center at q' in o['label'].lower() and 'R' in o['label'])
    if text.startswith('Construct a line'):
        if 'What is next?' in text:
            return choose(public, lambda o: 'Center at B' in o['label'] and 'same radius' in o['label'] and 'distinct from A' in o['label'])
        if 'Which complete order' in text:
            return choose(public, lambda o: (o['label'].startswith('Mark A from center P') or o['label'].startswith('Center P marks A')) and ('Mark B' in o['label'] or 'marks B' in o['label']) and 'Q distinct from A' in o['label'])
        return choose(public, lambda o: 'rhombus' in o['label'] and 'opposite sides' in o['label'])
    if text.startswith('A transversal through'):
        if 'What is next?' in text:
            return choose(public, lambda o: o['label'].startswith('Copy the angle') and 'corresponding position' in o['label'])
        if 'Which order' in text:
            return choose(public, lambda o: o['label'].startswith('Draw a transversal') and 'Copy its angle' in o['label'])
        return choose(public, lambda o: 'converse' in o['label'] and 'imply parallel' in o['label'])
    if text.startswith('Fold tracing paper'):
        return exact_choice(public, 'The perpendicular bisector of AB.')
    if text.startswith('Fold one ray'):
        return exact_choice(public, 'The angle bisector.')
    if text.startswith('Fold a line onto itself'):
        return exact_choice(public, 'The perpendicular to the line through P.')
    if text.startswith('A first fold'):
        return choose(public, lambda o: 'first crease onto itself' in o['label'] and 'distinct crease' in o['label'])
    if text.startswith('A reflection in a crease'):
        return choose(public, lambda o: 'P stays fixed' in o['label'] and 'preserves distance' in o['label'])
    raise ValueError('Unrecognized construction task')


def proof_rules(public):
    """The mathematical argument, including dependency edges, independent of banks.

    Texts identify statements, never their bank ids or their display positions.
    Statements absent from a task's bank must be supplied as earlier proved facts
    before a later part may use them.
    """
    prompt = plain(public['prompt'])
    def row(statement, reason, *before):
        return compact(statement), reason, set(before)
    if 'Line DE passes' in prompt:
        return [
            row('DE\\parallel AB', 'Given'),
            row('\\angle DCA\\cong\\angle CAB', 'Alternate interior angles', 0),
            row('\\angle ECB\\cong\\angle ABC', 'Alternate interior angles', 0),
            row('m\\angle DCA+m\\angle ACB+m\\angle ECB=180^\\circ', 'Straight angle and angle addition', 1, 2),
            row('m\\angle CAB+m\\angle ACB+m\\angle ABC=180^\\circ', 'Substitution', 1, 2, 3),
        ]
    if 'Lines AC and BD intersect' in prompt:
        a, c = re.search(r'Prove \\angle ([A-Z]{3})\\cong\\angle ([A-Z]{3})', prompt).groups()
        b = 'COD' if a == 'BOC' else 'BOC'
        return [
            row(f'\\angle {a},\\angle {b}\\text{{ and }}\\angle {b},\\angle {c}\\text{{ are linear pairs}}', 'Definition of linear pair'),
            row(f'm\\angle {a}+m\\angle {b}=180^\\circ,\\quad m\\angle {b}+m\\angle {c}=180^\\circ', 'Linear pair postulate', 0),
            row(f'm\\angle {a}+m\\angle {b}=m\\angle {b}+m\\angle {c}', 'Transitive property of equality', 1),
            row(f'm\\angle {a}=m\\angle {c}', 'Subtraction property of equality', 2),
            row(f'\\angle {a}\\cong\\angle {c}', 'Definition of congruent angles', 3),
        ]
    if 'let T translate along' in prompt:
        return [
            row('T(P)=Q', 'Definition of the translation'),
            row('T(t)=t', 'Translation along a line preserves that line', 0),
            row('T(\\ell) passes through Q parallel to \\ell', 'A translation maps a line to a parallel line', 0),
            row('T(\\ell)=m', 'Uniqueness of the parallel through Q', 2),
            row('T maps the rays of \\angle1 to those of \\angle5', 'Images of the two rays', 1, 3),
            row('\\angle1\\cong\\angle5', 'Translations preserve angle measure', 4),
        ]
    if prompt.startswith('Postulate: alternate interior'):
        return [row('\\ell\\parallel m', 'Given'), row('\\angle1\\cong\\angle4', 'Vertical angles are congruent'), row('\\angle4\\cong\\angle5', 'Alternate interior angles postulate', 0), row('\\angle1\\cong\\angle5', 'Transitive property of congruence', 1, 2)]
    if 'D and E are midpoints' in prompt:
        return [
            row('AE\\cong EC,\\ AD\\cong DB', 'Definition of midpoint'),
            row('DE\\cong EF', 'Given'),
            row('\\angle AED\\cong\\angle CEF', 'Vertical angles are congruent'),
            row('\\triangle ADE\\cong\\triangle CFE', 'SAS', 0, 1, 2),
            row('AD\\cong CF,\\ \\angle DAE\\cong\\angle FCE', 'CPCTC', 3),
            row('CF\\parallel AB', 'Converse of alternate interior angles', 4),
            row('CF\\cong DB', 'Transitive property', 0, 4),
            row('DBCF is a parallelogram', 'One opposite pair both congruent and parallel', 5, 6),
            row('DF\\parallel BC,\\ DF=BC', 'Opposite sides of a parallelogram', 7),
            row('DE\\parallel BC,\\ DE=\\tfrac12 DF=\\tfrac12 BC', 'Segment addition and substitution', 1, 8),
        ]
    if 'medians BE and CF meet' in prompt:
        return [
            row('E,F are midpoints of AC,AB', 'Definition of median'),
            row('FE\\parallel BC,\\ FE=\\tfrac12 BC', 'Midsegment theorem in triangle ABC', 0),
            row('MN\\parallel BC,\\ MN=\\tfrac12 BC', 'Midsegment theorem in triangle GBC'),
            row('FE\\parallel MN,\\ FE=MN', 'Transitive property and substitution', 1, 2),
            row('FMNE is a parallelogram', 'One opposite pair both congruent and parallel', 3),
            row('FG=GN,\\ EG=GM', 'Diagonals of a parallelogram bisect each other', 4),
            row('GN=NC,\\ GM=MB', 'Definition of midpoint'),
            row('BG=2GE,\\ CG=2GF', 'Segment addition and substitution', 5, 6),
            row('The third median also passes through G', 'Repeat with AD and BE: the same two-thirds point of BE', 7),
        ]
    if 'perpendicular bisector of AB' in prompt:
        converse = prompt.startswith('Given PA=PB')
        rows = [
            row('PA\\cong PB', 'Given'),
            row('AM\\cong MB', 'Definition of midpoint'),
            row('PM\\cong PM', 'Reflexive property'),
            row('\\triangle PAM\\cong\\triangle PBM', 'SSS', 0, 1, 2),
            row('\\angle PMA\\cong\\angle PMB', 'CPCTC', 3),
            row('m\\angle PMA+m\\angle PMB=180^\\circ', 'Linear pair postulate'),
            row('m\\angle PMA=90^\\circ', 'Equal halves of 180 degrees', 4, 5),
            row('P lies on the perpendicular bisector of AB', 'Perpendicular at the midpoint', 1, 6),
        ] if converse else [
            row('AM\\cong MB', 'Definition of perpendicular bisector'),
            row('\\angle PMA,\\angle PMB are right angles', 'Definition of perpendicular'),
            row('\\angle PMA\\cong\\angle PMB', 'All right angles are congruent', 1),
            row('PM\\cong PM', 'Reflexive property'),
            row('\\triangle PMA\\cong\\triangle PMB', 'SAS', 0, 2, 3),
            row('PA\\cong PB', 'CPCTC', 4),
        ]
        bank_labels = ' '.join(o['label'] for bank in public['response']['banks'] for o in bank['options'])
        if 'To obtain exactly' in bank_labels or 'To obtain exactly' in prompt:
            rows.append(row('To obtain exactly all equidistant points, also prove the forward direction' if converse else 'To obtain exactly all equidistant points, also prove the converse', 'Every point on the perpendicular bisector is equidistant from the endpoints' if converse else 'Every point equidistant from the endpoints lies on the perpendicular bisector', len(rows) - 1))
        return rows
    if prompt.startswith('In triangle ABC,'):
        converse = 'In triangle ABC, \\angle B\\cong\\angle C' in prompt
        midpoint = 'D is the midpoint' in prompt
        return [
            row('\\angle ABD\\cong\\angle ACD' if converse else 'AB\\cong AC', 'Given'),
            row('BD\\cong CD' if midpoint else '\\angle BAD\\cong\\angle CAD', 'Definition of midpoint' if midpoint else 'Definition of angle bisector'),
            row('AD\\cong AD', 'Reflexive property'),
            row('\\triangle BAD\\cong\\triangle CAD', 'AAS' if converse else 'SSS' if midpoint else 'SAS', 0, 1, 2),
            row('AB\\cong AC' if converse else '\\angle B\\cong\\angle C', 'CPCTC', 3),
        ]
    raise ValueError('Unrecognized proof givens')


def proof_model(public):
    response = public['response']
    require(response['kind'] == 'structured-work' and response['layout'] == 'proof', 'Expected proof layout')
    rules = proof_rules(public)
    by_text = {text: i for i, (text, _, _) in enumerate(rules)}
    statement_bank = next(bank for bank in response['banks'] if bank['id'] == 'statements')
    reason_bank = next(bank for bank in response['banks'] if bank['id'] == 'reasons')
    statements = {o['id']: compact(o['label']) for o in statement_bank['options']}
    reasons = {o['id']: plain(o['label']) for o in reason_bank['options']}
    chosen = {sid: by_text[text] for sid, text in statements.items() if text in by_text}
    require(len(chosen) == len(response['rows']), 'Missing or duplicate required proof statement')
    require(len(set(chosen.values())) == len(chosen), 'Repeated proof statement in bank')
    external = set(range(len(rules))) - set(chosen.values())
    needed_external = set().union(*(rules[i][2] for i in chosen.values())) & external
    prior = compact(public['prompt'].split('Already proved:', 1)[1]) if 'Already proved:' in public['prompt'] else ''
    for i in needed_external:
        require(rules[i][0] in prior, 'A proof dependency is neither in the task nor explicitly supplied')
    rid_by_reason = {label: rid for rid, label in reasons.items()}
    require(all(rules[i][1] in rid_by_reason for i in chosen.values()), 'Needed reason missing from bank')
    goal = compact(response['goal'])
    require(goal in by_text and by_text[goal] == max(chosen.values()), 'The stated proof goal is not the last task conclusion')
    return rules, statements, reasons, chosen, needed_external


def proof_answer(public):
    rules, statements, reasons, chosen, _ = proof_model(public)
    response = public['response']
    rid = {label: key for key, label in reasons.items()}
    sid = {index: key for key, index in chosen.items()}
    if response['mode'] == 'build':
        return js([[sid[i], rid[rules[i][1]]] for i in sorted(sid)])
    require(response['mode'] == 'fill', 'Unsupported proof response mode')
    result = []
    for row in response['rows']:
        statement, reason = row['fields']
        require('given' in statement, 'Reason completion must show the statement')
        index = chosen[statement['given']]
        correct = rid[rules[index][1]]
        if 'given' in reason:
            require(reason['given'] == correct, 'An incorrect reason is printed as given')
        result.append(['', '' if 'given' in reason else correct])
    return js(result)


def review_proof(problem):
    public = problem['public']
    rules, statements, reasons, chosen, external = proof_model(public)
    response = public['response']
    rows = json.loads(problem['answer'])
    require(len(rows) == len(response['rows']), 'Proof key has the wrong number of rows')
    established = set(external)
    for row_index, entries in enumerate(rows):
        require(isinstance(entries, list) and len(entries) == 2, 'Invalid proof key row')
        if response['mode'] == 'fill':
            fields = response['rows'][row_index]['fields']
            sid = fields[0].get('given', entries[0])
            rid = fields[1].get('given', entries[1])
            require(entries[0] == '' and ('given' not in fields[1] or entries[1] == ''), 'Key writes over a given proof field')
        else:
            sid, rid = entries
        require(sid in chosen and rid in reasons, 'Unknown or unprovable statement/reason')
        i = chosen[sid]
        require(i not in established, 'Repeated proof claim')
        require(reasons[rid] == rules[i][1], 'Incorrect proof reason')
        require(rules[i][2] <= established, 'Conclusion placed before its supporting claims')
        established.add(i)
    require(set(chosen.values()) <= established, 'Proof does not establish its goal')
    # Check the private rule as a value under test, not as mathematical evidence.
    grading = problem.get('workGrading', {})
    sid_by_index = {index: sid for sid, index in chosen.items()}
    rid_by_label = {label: rid for rid, label in reasons.items()}
    expected = {sid: {rid_by_label[rules[i][1]]: [[sid_by_index[j] for j in sorted(rules[i][2]) if j in sid_by_index]]} for sid, i in chosen.items()}
    require(grading.get('mode') == 'proof' and grading.get('claims') == expected, 'Private proof claims differ from independent dependency rules')
    require(statements[grading.get('goal')] == compact(response['goal']), 'Private proof goal differs from public goal')
    check_proof_geometry(public)
    return problem['answer']


def check_proof_geometry(public):
    elements = public.get('figure', {}).get('scene', {}).get('elements', [])
    points = {e['text']: e['at'] for e in elements if e['type'] == 'text' and re.fullmatch('[A-Z]', e['text'])}
    def distance(a, b):
        return math.dist(points[a], points[b])
    def mid(a, b, c):
        require(math.dist(points[b], [(points[a][i] + points[c][i]) / 2 for i in (0, 1)]) < 1e-7, 'Drawn midpoint does not bisect its segment')
    prompt = plain(public['prompt'])
    if 'medians BE and CF' in prompt:
        mid('A', 'E', 'C'); mid('A', 'F', 'B'); mid('B', 'M', 'G'); mid('C', 'N', 'G')
        centroid = [sum(points[p][i] for p in 'ABC') / 3 for i in (0, 1)]
        require(math.dist(points['G'], centroid) < 1e-7, 'Drawn median intersection is not the centroid')
        require(abs(distance('B', 'G') - 2 * distance('G', 'E')) < 1e-7, 'Drawn centroid ratio is not two to one')
    elif 'D and E are midpoints' in prompt:
        mid('A', 'D', 'B'); mid('A', 'E', 'C'); mid('D', 'E', 'F')
        require(abs(2 * distance('D', 'E') - distance('B', 'C')) < 1e-7, 'Midsegment length is incorrect')
    elif 'perpendicular bisector of AB' in prompt:
        mid('A', 'M', 'B')
        require(abs(distance('P', 'A') - distance('P', 'B')) < 1e-7, 'Endpoint distances disagree')
        if prompt.startswith('Given PA=PB'):
            require(not any(str(e.get('id', '')).startswith('right') for e in elements), 'Converse proof assumes a right angle in the figure')
    elif prompt.startswith('In triangle ABC,'):
        require(abs(distance('A', 'B') - distance('A', 'C')) < 1e-7, 'Isosceles figure has unequal legs')


def review_problem(problem):
    public = problem['public']
    require(recognizes(public), 'Not a clause-extension problem')
    if public['response']['kind'] == 'structured-work':
        return review_proof(problem)
    expected = solve(public)
    actual = problem['answer']
    if public['response']['kind'] in ('number', 'fraction'):
        require(F(actual) == F(expected), 'Incorrect numeric clause answer')
    else:
        require(actual == expected, f'Incorrect clause answer: {public["templateId"]}; expected {expected}, got {actual}')
    return expected


def self_test():
    def reject(fn):
        try:
            fn()
        except (ValueError, ZeroDivisionError):
            return
        raise ValueError('Oracle accepted a mutation')
    require(numeric_pi('$\\frac{3}{2}\\pi$') == (F(3, 2), True), 'Exact pi coefficient parser')
    require(evaluate('$a_n=6+4(n-1)$', 3, 'n') == 14, 'Recursion expression parser')
    public = {'templateId': 'coordinate-context-points', 'prompt': 'Plot the point showing that after 6 weeks, 4 dollars have been saved.', 'response': {'kind': 'point-plot'}}
    require(solve(public) == '[[6,4]]', 'Coordinate axes reversed')
    reject(lambda: review_problem({'public': public, 'answer': '[[4,6]]'}))
    p = {'templateId': 'circle-angles', 'prompt': 'Tangents from $P$ touch circle $O$ at $A$ and $B$. Which equation always connects the circumscribed angle and the central angle on the minor arc?', 'response': {'kind': 'choice', 'options': [{'id': 'a', 'label': '$m\\angle APB+m\\angle AOB=180^\\circ$'}, {'id': 'b', 'label': '$m\\angle APB=m\\angle AOB$'}]}}
    require(solve(p) == 'a', 'Tangent sum theorem')
    mutated = copy.deepcopy(p)
    mutated['response']['options'][1]['label'] = mutated['response']['options'][0]['label']
    reject(lambda: solve(mutated))
    return 5


if __name__ == '__main__':
    import sys
    self_test()
    count = 0
    failures = {}
    for raw in sys.stdin:
        if not raw.strip():
            continue
        problem = json.loads(raw)
        try:
            review_problem(problem)
        except Exception as error:
            key = (problem['public']['templateId'], str(error))
            failures.setdefault(key, problem['public'].get('seed'))
            continue
        count += 1
    if failures:
        for (tid, error), seed in failures.items():
            print(f'{tid}/{seed}: {error}', file=sys.stderr)
        sys.exit(1)
    print(f'Independent clause oracle: {count} cases passed; self-tests passed')
