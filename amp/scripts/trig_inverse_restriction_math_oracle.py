"""Independent oracle for HSF.TF.B.6: restricting a trigonometric function
so that its inverse can be built (trig-restriction-domain,
trig-restriction-domain-graph, trig-one-to-one-intervals,
restricted-trig-inverse, trig-inverse-why-restrict).

Only public fields enter `solve`. Intervals are read from option text or
from the highlighted curve of each drawn graph; one-to-one is decided by the
function's own turning points (sine at pi/2 + n pi, cosine at n pi) and, for
tangent, its asymptotes (pi/2 + n pi); "takes every value of the range" by
the values reached at included endpoints, or by an open tangent branch
between consecutive asymptotes. The inverse value is the one x in D with
f(x) = v, found here by scanning special angles. Reasons are judged by rules
written here: a reason must be true and prove the step it is offered for.
"""
import copy
import json
import math
import re

import trig_reasoning_oracle_kit as kit
from trig_reasoning_oracle_kit import require, value_of

SUPPORTED = frozenset({
    'trig-restriction-domain',
    'trig-restriction-domain-graph',
    'trig-one-to-one-intervals',
    'restricted-trig-inverse',
    'trig-inverse-why-restrict',
})
REVIEW_RETURNS_ANSWER = True
HALF = math.pi / 2
F = {'sin': math.sin, 'cos': math.cos, 'tan': math.tan}
NAMES = {'sine': 'sin', 'cosine': 'cos', 'tangent': 'tan'}
# The convention behind arcsin, arccos and arctan.
CONVENTIONAL = {
    'sin': (-HALF, HALF, False, False),
    'cos': (0.0, math.pi, False, False),
    'tan': (-HALF, HALF, True, True),
}


def near(a, b, tol=1e-9):
    return abs(a - b) < tol


def special_points(fn, lo, hi):
    """Turning points (sine, cosine) or asymptotes (tangent) in [lo, hi]."""
    start = 0.0 if fn == 'cos' else HALF
    n0 = math.floor((lo - start) / math.pi) - 1
    out = []
    for n in range(n0, n0 + int((hi - lo) / math.pi) + 4):
        x = start + n * math.pi
        if lo - 1e-9 <= x <= hi + 1e-9:
            out.append(x)
    return out


def one_to_one(fn, interval):
    lo, hi, lo_open, hi_open = interval
    require(math.isfinite(lo) and math.isfinite(hi), 'A restricted domain is bounded here')
    inside = [x for x in special_points(fn, lo, hi) if lo + 1e-9 < x < hi - 1e-9]
    if fn != 'tan':
        return not inside
    # Tangent must be defined on the whole interval: no asymptote inside or
    # at a closed end.
    if inside:
        return False
    for x, is_open in ((lo, lo_open), (hi, hi_open)):
        if not is_open and any(near(x, s, 1e-9) for s in special_points(fn, x, x)):
            return False
    return True


def onto_range(fn, interval):
    """The restricted function takes every value of the function's range:
    [-1, 1] for sine and cosine, every real number for tangent."""
    lo, hi, lo_open, hi_open = interval
    if fn == 'tan':
        asym = special_points('tan', lo, hi)
        return lo_open and hi_open and any(near(lo, s) for s in asym) and any(near(hi, s) for s in asym) and near(hi - lo, math.pi)
    reached = [F[fn](x) for x, is_open in ((lo, lo_open), (hi, hi_open)) if not is_open]
    reached += [F[fn](x) for x in special_points(fn, lo, hi) if lo + 1e-9 < x < hi - 1e-9]
    return any(near(v, 1) for v in reached) and any(near(v, -1) for v in reached)


def invertible(fn, interval):
    return one_to_one(fn, interval) and onto_range(fn, interval)


def same_interval(a, b):
    return all(x == y or near(x, y) for x, y in zip(a[:2], b[:2])) and tuple(a[2:]) == tuple(b[2:])


def interval_label(label):
    if label.strip() == '$(-\\infty, \\infty)$':
        return (-math.inf, math.inf, True, True)
    return kit.interval_of(label)


def graph_of(scene):
    graphs = [e for e in scene['elements'] if e.get('type') == 'graph']
    require(len(graphs) == 1, 'Expected one graph')
    return graphs[0]


def graph_fn(scene):
    curves = graph_of(scene)['curves']
    fns = {c['fn']['f'] for c in curves}
    require(len(fns) == 1 and fns <= set(F), 'One trigonometric function is drawn')
    for c in curves:
        require(c['fn'].get('a') == 1 and c['fn'].get('b') == 1 and not c['fn'].get('h') and not c['fn'].get('k'), 'Unshifted y = f(x)')
    return fns.pop()


def highlighted(scene):
    pieces = [c for c in graph_of(scene)['curves'] if 'domain' in c]
    require(len(pieces) == 1, 'Expected one highlighted piece')
    lo, hi = pieces[0]['domain']
    ends = pieces[0].get('ends', ['closed', 'closed'])
    return (lo, hi, ends[0] == 'open', ends[1] == 'open')


def prompt_fn(public):
    m = re.search(r'\$y = \\(sin|cos|tan) x\$', public['prompt'])
    require(m is not None, 'The prompt names y = f(x)')
    fn = m.group(1)
    if public.get('figure'):
        require(graph_fn(public['figure']['scene']) == fn, 'The graph draws the named function')
    return fn


# -------------------------------------------------------- trig-restriction-domain

def restriction_domain(public):
    prompt = public['prompt']
    conv = re.fullmatch(r'The function \$\\arc(sin|cos|tan) x\$ is defined as the inverse of \$\\\1 x\$ restricted to which domain\?', prompt)
    if conv:
        fn = conv.group(1)
        require(invertible(fn, CONVENTIONAL[fn]), 'The conventional interval works')
        return kit.single(public, lambda o: same_interval(interval_label(o['label']), CONVENTIONAL[fn]))
    m = re.fullmatch(r'The graph shows \$y = \\(sin|cos|tan) x\$\. Which interval could be a restricted domain for (sine|cosine|tangent), so that the restricted function has an inverse function defined at (every value from \$-1\$ to \$1\$|every real number)\?', prompt)
    require(m is not None, 'Restriction wording')
    fn = m.group(1)
    require(NAMES[m.group(2)] == fn and (m.group(3) == 'every real number') == (fn == 'tan'), 'Function and range named consistently')
    prompt_fn(public)
    return kit.single(public, lambda o: invertible(fn, interval_label(o['label'])))


# -------------------------------------------------- trig-restriction-domain-graph

def plain_value(text):
    t = text.replace('−', '-')
    m = re.fullmatch(r'(-?)(\d*)π(?:/(\d+))?', t)
    if m:
        k = int(m.group(2) or 1)
        return (-1 if m.group(1) else 1) * k * math.pi / int(m.group(3) or 1)
    require(re.fullmatch(r'-?\d+', t) is not None, f'Unreadable value {text!r}')
    return float(t)


def restriction_graph(public):
    m = re.fullmatch(r'Each graph shows \$y = \\(sin|cos|tan) x\$ with one piece highlighted\. Which piece is always increasing or always decreasing and takes every value of (sine|cosine|tangent)\'s range, so it can be used to build an inverse function\?', public['prompt'])
    require(m is not None and NAMES[m.group(2)] == m.group(1), 'Graph-choice wording')
    fn = m.group(1)
    response = public['response']
    require(response['kind'] == 'figure-choice', 'Expected a figure-choice response')

    def valid(option):
        scene = option['scene']
        require(graph_fn(scene) == fn, 'Each card draws the named function')
        interval = highlighted(scene)
        words = re.search(r'with the piece from (\S+) to (\S+?)(, not including (?:either end|\S+))? highlighted\.$', option['label'])
        require(words is not None, 'Card description')
        require(near(plain_value(words.group(1)), interval[0], 1e-6) and near(plain_value(words.group(2)), interval[1], 1e-6), 'Card description names the drawn piece')
        return invertible(fn, interval)
    return kit.single(public, valid, kinds=('figure-choice',))


# ------------------------------------------------------- trig-one-to-one-intervals

def one_to_one_truth(public):
    m = re.fullmatch(r'The graph shows \$y = \\(sin|cos) x\$\. On which \d+ of these intervals is (sine|cosine) one-to-one, always increasing or always decreasing\?', public['prompt'])
    require(m is not None and NAMES[m.group(2)] == m.group(1), 'One-to-one wording')
    fn = prompt_fn(public)
    return lambda label: one_to_one(fn, interval_label(label))


def one_to_one_select(public):
    return kit.select_all(public, one_to_one_truth(public))[0]


# --------------------------------------------------------- restricted-trig-inverse

def inverse_setup(public):
    m = re.match(r'Let \$g\(x\) = \\(sin|cos|tan) x\$ for \$x\$ in \$D = (.+?)\$ only\. The graph shows \$y = \\\1 x\$ with \$D\$ highlighted and the dashed line \$y = (.+?)\$\.', public['prompt'])
    require(m is not None, 'Restricted-inverse wording')
    fn = m.group(1)
    D = kit.interval_of(m.group(2))
    v = value_of(m.group(3))
    scene = public['figure']['scene']
    require(graph_fn(scene) == fn, 'The graph draws g')
    require(same_interval(highlighted(scene), D), 'The highlighted piece is D')
    lines = graph_of(scene).get('lines', [])
    require(len(lines) == 1 and lines[0]['line'].get('m') == 0 and near(lines[0]['line']['b'], v), 'The dashed line is y = v')
    return fn, D, v


def in_interval(x, interval):
    lo, hi, lo_open, hi_open = interval
    return (lo < x - 1e-9 or (not lo_open and near(x, lo))) and (x < hi - 1e-9 or (not hi_open and near(x, hi)))


def restricted_inverse(public):
    fn, D, v = inverse_setup(public)
    require(one_to_one(fn, D), 'D is not a one-to-one piece')
    mid_lo, mid_hi = D[0] + 1e-3, D[1] - 1e-3
    rising = F[fn](mid_hi) > F[fn](mid_lo)
    trend = 'increasing' if rising else 'decreasing'
    full = (-math.inf, math.inf, True, True) if fn == 'tan' else (-1.0, 1.0, False, False)
    require(onto_range(fn, D), 'D does not reach the whole range')

    def value_valid(label):
        x = value_of(label.strip('$'))
        return in_interval(x, D) and not (fn == 'tan' and abs(math.cos(x)) < 1e-9) and near(F[fn](x), v, 1e-9)
    # The equation f(x) = v has exactly one solution in D: scan multiples of pi/12.
    hits = [k for k in range(-60, 61) if in_interval(k * math.pi / 12, D) and not (fn == 'tan' and k % 6 == 0 and (k // 6) % 2 == 1)
            and near(F[fn](k * math.pi / 12), v, 1e-9)]
    require(len(hits) == 1, f'f(x) = v has {len(hits)} special solutions in D')
    def trend_valid(label):
        require(label in ('increasing', 'decreasing', 'neither increasing nor decreasing'), f'Unknown trend {label!r}')
        return label == trend
    return kit.multi_part(public, {
        'trend': trend_valid,
        'domain': lambda label: same_interval(interval_label(label), full),
        'range': lambda label: same_interval(interval_label(label), D),
        'value': value_valid,
    })


# ------------------------------------------------------- trig-inverse-why-restrict

def why_no_inverse(public, prompt):
    m = re.match(r'Why does \$y = \\(sin|cos|tan) x\$, (?:with every real number as its domain|on its whole domain \(every real number except the odd multiples of \$\\frac\{\\pi\}\{2\}\$\)), not have an inverse function\? In the graph, the dashed line \$y = (.+?)\$ crosses the curve at \$a = (.+?)\$ and at \$b = (.+?)\$\.', prompt)
    require(m is not None, 'No-inverse wording')
    fn = m.group(1)
    v, a, b = (value_of(m.group(i)) for i in (2, 3, 4))
    require(near(F[fn](a), v) and near(F[fn](b), v) and not near(a, b), 'a and b both give v')
    require(prompt_fn(public) == fn, 'Graph')
    rules = [
        (rf'Inputs share outputs: \$\\{fn} a = \\{fn} b\$ with \$a \\ne b\$, so a reverse would send one output to two inputs\.', True),
        (r'Its outputs are only between \$-1\$ and \$1\$\.', False),  # limits the inverse's domain only
        (r'Its outputs can be any real number, so there are too many to reverse\.', False),
        (r'It is increasing on some intervals, so it cannot be reversed\.', False),
        (r'It is not defined for every real number\.', False if fn != 'tan' else None),
        (r'It is undefined at \$x = \\frac\{\\pi\}\{2\}\$, and a function with gaps never has an inverse\.', False),
    ]
    return kit.single(public, lambda o: judge(rules, o['label']))


def arc_value(fn, v):
    return {'sin': math.asin, 'cos': math.acos, 'tan': math.atan}[fn](v)


def why_two_values(public, prompt):
    m = re.match(r'A student writes: “\$\\(sin|cos|tan) a = \\\1 b = v\$, where \$a = (.+?)\$, \$b = (.+?)\$ and \$v = (.+?)\$\. Therefore \$\\arc\1 v\$ equals both \$a\$ and \$b\$\.” Which statement identifies the flaw\?', prompt)
    require(m is not None, 'Two-values wording')
    fn = m.group(1)
    a, b, v = (value_of(m.group(i)) for i in (2, 3, 4))
    require(near(F[fn](a), v) and near(F[fn](b), v) and not near(a, b), 'The student computed f(a) = f(b) = v correctly')
    principal = arc_value(fn, v)

    def correct(match):
        interval = kit.interval_of(match.group(1))
        return (same_interval(interval, CONVENTIONAL[fn]) and in_interval(a, interval)
                and not in_interval(b, interval) and near(principal, a))
    rules = [
        (rf'\$\\arc{fn}\$ inverts (?:sine|cosine|tangent) on (\$[^$]+\$); \$b\$ is outside it, so \$\\arc{fn} v = a\$ only\.', correct),
        (rf'\$\\{fn} b\$ is not actually equal to \$v\$\.', lambda _m: not near(F[fn](b), v)),
        (r'There is no flaw: an inverse can have two outputs\.', False),
        (rf'\$\\arc{fn} v = b\$, not \$a\$, because .+\.', lambda _m: near(principal, b)),
    ]
    return kit.single(public, lambda o: judge(rules, o['label']))


def why_step(public, prompt):
    m = re.match(r'To build (?:\$\\arc(sin|cos|tan)\$|an inverse), we restrict \$\\(sin|cos|tan) x\$ to \$I = (.+?)\$\. One step says: “(.+?)” Which fact justifies this step\?', prompt)
    require(m is not None, 'Justify-step wording')
    fn = m.group(2)
    I = kit.interval_of(m.group(3))
    require(m.group(1) in (None, fn), 'arc names the restricted function')
    if m.group(1):
        require(same_interval(I, CONVENTIONAL[fn]), 'The interval behind the arc function is the conventional one')
    require(invertible(fn, I), 'I is a good restriction')
    step = m.group(4)
    full = '(-\\infty, \\infty)' if fn == 'tan' else '[-1, 1]'
    if step == f'On $I$, $\\{fn} x$ is one-to-one.':
        kind = 'one-to-one'
    else:
        require(step == f'So the inverse has domain ${full}$.', 'Unknown step')
        kind = 'domain'
    scene = public['figure']['scene']
    require(graph_fn(scene) == fn and same_interval(highlighted(scene), I), 'The graph highlights I')
    rising = F[fn](I[1] - 1e-3) > F[fn](I[0] + 1e-3)
    direction = 'increasing' if rising else 'decreasing'

    def monotone(match):
        relation = match.groupdict().get('rel')
        true = match.group('dir') == direction and (relation is None or relation == ('<' if rising else '>'))
        require(true, 'The monotone statement misstates the direction')
        # Always increasing or decreasing rules out repeats: it proves
        # one-to-one, not which outputs are reached.
        return kind == 'one-to-one'

    def onto(match, says_domain):
        if fn == 'tan':
            true = match.group(0).startswith('$\\tan x$ takes every real number')
        else:
            start, end = (value_of(match.group(i).strip('$')) for i in (1, 2))
            true = near(start, F[fn](I[0])) and near(end, F[fn](I[1])) and {round(start), round(end)} == {-1, 1}
        require(true, 'The onto statement misstates the values reached')
        return kind == 'domain' and says_domain
    values = r'(?:every value from (\$?-?\d\$?) to (\$?-?\d\$?)|every real number)'
    rules = [
        (rf'\$\\{fn} x\$ is (?P<dir>increasing|decreasing) on \$I\$: if \$a < b\$ in \$I\$, then \$\\{fn} a (?P<rel>[<>]) \\{fn} b\$, so no output repeats\.', monotone),
        (rf'\$\\{fn} x\$ is (?P<dir>increasing|decreasing) on \$I\$, so no two inputs there share an output\.', monotone),
        (rf'\$\\{fn} x\$ takes {values} on \$I\$\.', lambda mm: onto(mm, False)),
        (rf'\$\\{fn} x\$ takes {values} on \$I\$, so every number in \${re.escape(full)}\$ is an output\.', lambda mm: onto(mm, True)),
        (rf'\$\\{fn} x\$ passes the vertical line test on \$I\$\.', False),  # every function does
        (rf'\$I\$ is shorter than one period of \$\\{fn} x\$, which is \$2\\pi\$\.', False),  # shorter pieces can still turn
        (r'\$\\tan x\$ is defined at both ends of \$I\$\.', lambda _m: False),  # odd multiples of pi/2
    ]
    return kit.single(public, lambda o: judge(rules, o['label']))


def judge(rules, label):
    hits = []
    for pattern, verdict in rules:
        found = re.fullmatch(pattern, label)
        if found:
            require(verdict is not None, f'Option does not apply here: {label!r}')
            hits.append(verdict(found) if callable(verdict) else verdict)
    require(len(hits) == 1, f'Unknown or ambiguous option {label!r}')
    return bool(hits[0])


def why_restrict(public):
    prompt = public['prompt']
    if prompt.startswith('Why does'):
        return why_no_inverse(public, prompt)
    if prompt.startswith('A student writes'):
        return why_two_values(public, prompt)
    return why_step(public, prompt)


SOLVERS = {
    'trig-restriction-domain': restriction_domain,
    'trig-restriction-domain-graph': restriction_graph,
    'trig-one-to-one-intervals': one_to_one_select,
    'restricted-trig-inverse': restricted_inverse,
    'trig-inverse-why-restrict': why_restrict,
}


def solve(public):
    require(public['templateId'] in SUPPORTED, 'Unexpected template')
    return SOLVERS[public['templateId']](public)


def review_problem(problem):
    public = problem['public']
    expected = solve(public)
    if public['templateId'] == 'trig-one-to-one-intervals':
        _, truths = kit.select_all(public, one_to_one_truth(public))
        kit.review_select_explanation(problem, truths)
    if public['response']['kind'] in ('choice', 'figure-choice'):
        wrong = {o['id'] for o in public['response']['options']} - {expected}
        require(set(problem.get('choiceFeedback') or {}) == wrong, 'Feedback for exactly the wrong options')
    if public['response']['kind'] == 'choice':
        key = next(o['label'] for o in public['response']['options'] if o['id'] == expected)
        require(len(key) < 8 or key not in problem['hint'], 'Hint quotes the answer')
    return expected


# ------------------------------------------------------------------ self test

def _graph(fn, highlight=None, line=None):
    curves = [{'fn': {'f': fn, 'a': 1, 'b': 1}, 'color': 'muted'}]
    if highlight:
        lo, hi, lo_open, hi_open = highlight
        curves.append({'fn': {'f': fn, 'a': 1, 'b': 1}, 'domain': [lo, hi], 'ends': ['open' if lo_open else 'closed', 'open' if hi_open else 'closed']})
    graph = {'type': 'graph', 'id': 'g', 'x': [-6.3, 6.3], 'y': [-1.5, 1.5], 'curves': curves}
    if line is not None:
        graph['lines'] = [{'line': {'m': 0, 'b': line}}]
    return {'kind': 'scene', 'scene': {'v': 1, 'elements': [graph]}}


def _choice(labels):
    return {'kind': 'choice', 'label': 'Choose one', 'options': [{'id': f'option-{chr(97 + i)}', 'label': label} for i, label in enumerate(labels)]}


def self_test():
    checks = 0
    require(invertible('sin', (HALF, 3 * HALF, False, False)), '[pi/2, 3pi/2] works for sine')
    require(not invertible('sin', (0.0, math.pi, False, False)), 'Sine turns inside [0, pi]')
    require(not invertible('cos', (0.0, HALF, False, False)), 'Half a piece misses -1')
    require(invertible('tan', (HALF, 3 * HALF, True, True)), 'The next tangent branch')
    require(not invertible('tan', (0.0, math.pi, True, True)), 'Crosses an asymptote')
    require(not one_to_one('tan', (-HALF, HALF, False, False)), 'Closed ends of tangent are undefined')
    checks += 6
    another = {
        'templateId': 'trig-restriction-domain',
        'prompt': 'The graph shows $y = \\sin x$. Which interval could be a restricted domain for sine, so that the restricted function has an inverse function defined at every value from $-1$ to $1$?',
        'response': _choice(['$\\left[\\pi, \\frac{3\\pi}{2}\\right]$', '$\\left[\\frac{\\pi}{2}, \\frac{3\\pi}{2}\\right]$', '$\\left[\\pi, 2\\pi\\right]$', '$\\left[-\\frac{\\pi}{2}, \\frac{3\\pi}{2}\\right]$']),
        'figure': _graph('sin'),
    }
    require(solve(another) == 'option-b', 'Sine decreases through its whole range on [pi/2, 3pi/2]')
    checks += 1
    two = copy.deepcopy(another)
    two['response']['options'][0]['label'] = '$\\left[-\\frac{3\\pi}{2}, -\\frac{\\pi}{2}\\right]$'
    kit.must_fail(solve, two)
    checks += 1
    convention = {
        'templateId': 'trig-restriction-domain',
        'prompt': 'The function $\\arctan x$ is defined as the inverse of $\\tan x$ restricted to which domain?',
        'response': _choice(['$\\left[-\\frac{\\pi}{2}, \\frac{\\pi}{2}\\right]$', '$\\left(-\\frac{\\pi}{2}, \\frac{\\pi}{2}\\right)$', '$(-\\infty, \\infty)$', '$\\left[0, 2\\pi\\right]$']),
    }
    require(solve(convention) == 'option-b', 'Open interval for arctan')
    checks += 1

    def blank(bid, labels):
        return {'id': bid, 'label': bid, 'options': [{'id': 'abcdef'[i], 'label': label} for i, label in enumerate(labels)]}
    D = (HALF, 3 * HALF, False, False)
    inverse = {
        'templateId': 'restricted-trig-inverse',
        'prompt': 'Let $g(x) = \\sin x$ for $x$ in $D = \\left[\\frac{\\pi}{2}, \\frac{3\\pi}{2}\\right]$ only. The graph shows $y = \\sin x$ with $D$ highlighted and the dashed line $y = \\frac{1}{2}$. Complete each statement.',
        'response': {'kind': 'multi-part-choice', 'label': 'Choose', 'layout': 'slots', 'blanks': [
            blank('trend', ['increasing', 'decreasing', 'neither increasing nor decreasing']),
            blank('domain', ['$[-1, 1]$', '$\\left[\\frac{\\pi}{2}, \\frac{3\\pi}{2}\\right]$', '$[0, 1]$']),
            blank('range', ['$[-1, 1]$', '$\\left[\\frac{\\pi}{2}, \\frac{3\\pi}{2}\\right]$', '$[0, 2\\pi)$']),
            blank('value', ['$\\frac{\\pi}{6}$', '$\\frac{5\\pi}{6}$', '$\\frac{17\\pi}{6}$', '$-\\frac{5\\pi}{6}$']),
        ]},
        'figure': _graph('sin', D, 0.5),
    }
    require(solve(inverse) == '{"trend":"b","domain":"a","range":"b","value":"b"}', 'g^-1(1/2) = 5pi/6 on [pi/2, 3pi/2]')
    checks += 1
    second = copy.deepcopy(inverse)
    second['response']['blanks'][3]['options'][0]['label'] = '$\\frac{5\\pi}{6}$ '
    kit.must_fail(solve, second)
    checks += 1
    flaw = {
        'templateId': 'trig-inverse-why-restrict',
        'prompt': 'A student writes: “$\\cos a = \\cos b = v$, where $a = \\frac{\\pi}{3}$, $b = -\\frac{\\pi}{3}$ and $v = \\frac{1}{2}$. Therefore $\\arccos v$ equals both $a$ and $b$.” Which statement identifies the flaw?',
        'response': _choice([
            '$\\cos b$ is not actually equal to $v$.',
            '$\\arccos$ inverts cosine on $\\left[0, \\pi\\right]$; $b$ is outside it, so $\\arccos v = a$ only.',
            'There is no flaw: an inverse can have two outputs.',
            '$\\arccos v = b$, not $a$, because $b$ is in $\\left[-\\frac{\\pi}{2}, \\frac{\\pi}{2}\\right]$.']),
        'figure': _graph('cos', line=0.5),
    }
    require(solve(flaw) == 'option-b', 'arccos(1/2) = pi/3 only')
    checks += 1
    wrong_interval = copy.deepcopy(flaw)
    wrong_interval['response']['options'][1]['label'] = '$\\arccos$ inverts cosine on $\\left[-\\frac{\\pi}{2}, \\frac{\\pi}{2}\\right]$; $b$ is outside it, so $\\arccos v = a$ only.'
    kit.must_fail(solve, wrong_interval)
    checks += 1
    return checks


if __name__ == '__main__':
    print(self_test())
