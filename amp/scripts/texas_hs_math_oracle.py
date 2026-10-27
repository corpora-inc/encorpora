"""Independent review of the Texas high-school gap templates.

Every answer is derived from the public prompt, answer choices, and figure data only, using exact
Fraction arithmetic wherever the quantity is rational and a stated tolerance where radicals or pi
appear. Nothing here imports or mirrors the generator.
"""
import copy
import math
import re
from fractions import Fraction

LINE_FORMS = frozenset({'line-equation-forms'})
LINE_RELATION = frozenset({'line-relationship-equations'})
SYSTEM_CHOICE = frozenset({'system-equation-choice'})
GRAPH_ESTIMATE = frozenset({'graph-estimate-system-solution'})
EXP_DOMAIN = frozenset({'exponential-domain-range'})
ABS_FORMULATE = frozenset({'absolute-value-equation-formulate'})
RATIONAL_FORMULATE = frozenset({'rational-equation-formulate'})
RATIONAL_EXPONENT = frozenset({'rational-exponent-equation'})
TRANSFORM_IMAGE = frozenset({'transformation-composition-image'})
COUNTEREXAMPLE = frozenset({'counterexample-choice'})
SPHERICAL = frozenset({'spherical-geometry-compare'})
POLYGON_AREA = frozenset({'regular-polygon-area'})
CURVED_SURFACE = frozenset({'curved-solid-surface-area'})
AREA_PROBABILITY = frozenset({'area-probability'})
COMPOSITION_ORDER = frozenset({'composition-order-choice'})
ONE_SIDED = frozenset({'one-sided-behavior-choice'})
PARAMETRIC = frozenset({'parametric-rectangular-convert'})
ANGULAR = frozenset({'angular-velocity-problem'})
REFERENCE_ANGLE = frozenset({'reference-angle-standard-position'})
BEARING = frozenset({'bearing-trig-problem'})
SIGMA = frozenset({'sigma-notation-represent'})
INFINITE_SUM = frozenset({'infinite-geometric-sum'})
POLY_INEQ = frozenset({'polynomial-inequality-solve'})
RATIONAL_INEQ = frozenset({'rational-inequality-solve'})
SUPPORTED = (
    LINE_FORMS | LINE_RELATION | SYSTEM_CHOICE | GRAPH_ESTIMATE | EXP_DOMAIN | ABS_FORMULATE
    | RATIONAL_FORMULATE | RATIONAL_EXPONENT | TRANSFORM_IMAGE | COUNTEREXAMPLE | SPHERICAL
    | POLYGON_AREA | CURVED_SURFACE | AREA_PROBABILITY | COMPOSITION_ORDER | ONE_SIDED
    | PARAMETRIC | ANGULAR | REFERENCE_ANGLE | BEARING | SIGMA | INFINITE_SUM | POLY_INEQ
    | RATIONAL_INEQ
)
INF = float('inf')
TOL = 1e-9


def require(condition, message):
    if not condition:
        raise ValueError(message)


# ---------------------------------------------------------------- tiny LaTeX evaluator

def plain(text):
    text = text.replace('$', '').replace('−', '-').replace('²', '^2')
    text = re.sub(r'\\left|\\right', '', text)
    text = text.replace('\\dfrac', '\\frac').replace('\\,', '')
    return text


def strip_text(text):
    return re.sub(r'\\text\{[^{}]*\}', '', text)


def _tokens(src):
    pattern = r'\d+(?:\.\d+)?|PI|SQRT|[A-Za-z]|\*\*|[-+*/()]'
    found = re.findall(pattern, src)
    require(''.join(found) == src.replace(' ', ''), f'Unreadable expression: {src}')
    return found


def tex_eval(text, **env):
    """Evaluate a restricted LaTeX arithmetic expression; Fractions unless pi/sqrt appear."""
    src = strip_text(plain(text))
    src = src.replace('\\cdot', '*').replace('\\pi', 'PI')
    src = re.sub(r'\\frac(\d)(\d)', r'\\frac{\1}{\2}', src)
    for _ in range(12):
        new = re.sub(r'\\frac\{([^{}]*)\}\{([^{}]*)\}', r'((\1)/(\2))', src)
        new = re.sub(r'\\sqrt\{([^{}]*)\}', r'SQRT(\1)', new)
        if new == src:
            break
        src = new
    src = re.sub(r'\^\{([^{}]*)\}', r'**(\1)', src)
    src = re.sub(r'\^(\d|[A-Za-z])', r'**\1', src)
    src = src.replace(' ', '')
    require('\\' not in src and '{' not in src, f'Unsupported markup: {text}')
    tokens = _tokens(src)
    use_float = 'PI' in tokens or 'SQRT' in tokens
    number = float if use_float else Fraction
    out = []
    for index, token in enumerate(tokens):
        if index:
            prev = tokens[index - 1]
            prev_value = bool(re.fullmatch(r'\d+(?:\.\d+)?|\)|PI|[A-Za-z]', prev)) and prev != 'SQRT'
            next_start = bool(re.fullmatch(r'\(|PI|SQRT|[A-Za-z]|\d+(?:\.\d+)?', token))
            if prev_value and next_start and not (re.fullmatch(r'\d+(?:\.\d+)?', prev) and re.fullmatch(r'\d+(?:\.\d+)?', token)):
                out.append('*')
        if re.fullmatch(r'\d+(?:\.\d+)?', token):
            out.append(f'N("{token}")')
        else:
            out.append(token)
    namespace = {'__builtins__': {}, 'N': number, 'PI': math.pi, 'SQRT': math.sqrt}
    for key, value in env.items():
        namespace[key] = number(value) if not isinstance(value, (int, float, Fraction)) else value
    return eval(''.join(out), namespace)  # noqa: S307 - tokens were produced above from a closed grammar


def as_fraction(value):
    require(isinstance(value, Fraction), 'Exact value expected')
    return value


def options_of(public):
    response = public['response']
    require(response['kind'] == 'choice', 'Choice response required')
    options = response['options']
    require(len(options) == 4 and all(set(o) == {'id', 'label'} for o in options), 'Four public choices required')
    require(len({o['id'] for o in options}) == 4, 'Duplicate choice IDs')
    return options


def finish(public, correct, keys):
    options = options_of(public)
    require(len(set(keys)) == 4, f'Mathematically duplicate choices: {keys}')
    ids = [o['id'] for o, flag in zip(options, correct) if flag]
    require(len(ids) == 1, f'Expected exactly one correct choice, found {len(ids)}: {keys}')
    return ids[0]


def squash(text):
    return re.sub(r'\s+', '', plain(text))


# ---------------------------------------------------------------- lines

def parse_frac_number(text):
    return tex_eval(text)


def linear_form(label):
    """Return (a, b, c) normalised so that a*x + b*y = c describes the same line."""
    text = plain(label)
    require(text.count('=') == 1, f'Not an equation: {label}')
    left, right = text.split('=')

    def value(x, y):
        return tex_eval(left, x=x, y=y) - tex_eval(right, x=x, y=y)

    f00 = value(Fraction(0), Fraction(0))
    a = value(Fraction(1), Fraction(0)) - f00
    b = value(Fraction(0), Fraction(1)) - f00
    require(value(Fraction(2), Fraction(3)) == 2 * a + 3 * b + f00, f'Not linear: {label}')
    require(a != 0 or b != 0, f'Degenerate line: {label}')
    c = -f00
    scale = a if a != 0 else b
    return (a / scale, b / scale, c / scale)


def line_from_slope_intercept(m, b):
    return linear_form_from(-m, Fraction(1), b)


def linear_form_from(a, b, c):
    scale = a if a != 0 else b
    return (Fraction(a) / scale, Fraction(b) / scale, Fraction(c) / scale)


def line_through(p, q):
    (x1, y1), (x2, y2) = p, q
    return linear_form_from(y1 - y2, x2 - x1, (y1 - y2) * x1 + (x2 - x1) * y1)


def slope_of(line):
    a, b, _ = line
    require(b != 0, 'Vertical line has no slope')
    return -a / b


def point_slope_parts(label):
    text = squash(label)
    match = re.fullmatch(r'y([+-])(\d+)=(.*)\(x([+-])(\d+)\)', text)
    if not match:
        return None
    y1 = -int(match[2]) if match[1] == '+' else int(match[2])
    x1 = -int(match[5]) if match[4] == '+' else int(match[5])
    return Fraction(x1), Fraction(y1)


def form_kind(label):
    text = squash(label)
    if point_slope_parts(label):
        return 'point-slope'
    if re.fullmatch(r'y=[^()y]*x(?:[+-]\d+)?', text) or re.fullmatch(r'y=[+-]?\d+', text):
        return 'slope-intercept'
    if re.fullmatch(r'-?\d*x[+-]\d*y=-?\d+', text):
        return 'standard'
    return 'other'


def standard_is_reduced(label):
    match = re.fullmatch(r'(-?\d*)x([+-]\d*)y=(-?\d+)', squash(label))
    require(match is not None, f'Not standard form: {label}')
    parts = []
    for item in match.groups():
        item = item.replace('+', '')
        parts.append(int({'': '1', '-': '-1'}.get(item, item)))
    return math.gcd(math.gcd(abs(parts[0]), abs(parts[1])), abs(parts[2])) == 1


def solve_line_forms(public):
    prompt = plain(public['prompt'])
    two = re.fullmatch(r'A line passes through \((-?\d+), (-?\d+)\) and \((-?\d+), (-?\d+)\)\. (.*)', prompt)
    slope_given = re.fullmatch(r'The line passes through \((-?\d+), (-?\d+)\) and has slope (-?\d+)\. (.*)', prompt)
    standard_given = re.fullmatch(r'A line is (y=.*?)\. Which equation is an equivalent standard form.*', prompt)
    labels = [o['label'] for o in options_of(public)]
    wanted_point = None
    if two:
        p, q = (Fraction(int(two[1])), Fraction(int(two[2]))), (Fraction(int(two[3])), Fraction(int(two[4])))
        require(p[0] != q[0], 'Vertical line cannot use these forms')
        line, rest = line_through(p, q), two[5]
        match = re.search(r'written with the point \((-?\d+), (-?\d+)\)', rest)
        if match:
            wanted_point = (Fraction(int(match[1])), Fraction(int(match[2])))
            require(wanted_point in (p, q), 'Named point must be one of the givens')
    elif slope_given:
        p, m = (Fraction(int(slope_given[1])), Fraction(int(slope_given[2]))), Fraction(int(slope_given[3]))
        line, rest = linear_form_from(-m, Fraction(1), -m * p[0] + p[1]), slope_given[4]
        wanted_point = p
    elif standard_given:
        line, rest = linear_form(standard_given[1]), 'standard'
    else:
        raise ValueError('Unrecognised line-form prompt')
    if 'point-slope' in rest:
        kind = 'point-slope'
    elif 'slope-intercept' in rest:
        kind = 'slope-intercept'
    else:
        kind = 'standard'
        require('no common factor' in rest or standard_given is not None, 'Standard form reduction rule must be stated')
    correct, keys = [], []
    for label in labels:
        got = linear_form(label)
        keys.append((got, form_kind(label), point_slope_parts(label)))
        flag = got == line and form_kind(label) == kind
        if kind == 'point-slope':
            flag = flag and wanted_point is not None and point_slope_parts(label) == wanted_point
        if kind == 'standard' and flag:
            flag = standard_is_reduced(label) and re.match(r'-', squash(label)) is None
        correct.append(flag)
    return finish(public, correct, keys)


def solve_line_relation(public):
    prompt = plain(public['prompt'])
    labels = [o['label'] for o in options_of(public)]
    correct, keys = [], []
    if (m := re.fullmatch(r'What is the slope of the line ([xy]=-?\d+)\?', prompt)):
        undefined = m[1].startswith('x')
        for label in labels:
            text = squash(label)
            if 'undefined' in text:
                value = 'undefined'
            else:
                value = tex_eval(re.fullmatch(r'Theslopeis(.*)', text)[1])
            keys.append(value)
            correct.append(value == ('undefined' if undefined else 0))
        return finish(public, correct, keys)
    if (m := re.fullmatch(r'Which equation describes the (vertical|horizontal) line through \((-?\d+), (-?\d+)\)\?', prompt)):
        x0, y0 = Fraction(int(m[2])), Fraction(int(m[3]))
        target = linear_form_from(1, 0, x0) if m[1] == 'vertical' else linear_form_from(0, 1, y0)
    elif (m := re.fullmatch(r'Which equation is the line through \((-?\d+), (-?\d+)\) that is (parallel|perpendicular) to (.*)\?', prompt)):
        x0, y0 = Fraction(int(m[1])), Fraction(int(m[2]))
        base = linear_form(m[4])
        a, b, _ = base
        if m[3] == 'parallel':
            na, nb = a, b
            require(a * x0 + b * y0 != base[2], 'A parallel line through a point on the given line is the given line itself')
        else:
            na, nb = -b, a  # rotate the normal vector by 90 degrees
        target = linear_form_from(na, nb, na * x0 + nb * y0)
    else:
        raise ValueError('Unrecognised line-relationship prompt')
    for label in labels:
        got = linear_form(label)
        keys.append(got)
        correct.append(got == target)
    return finish(public, correct, keys)


def split_system(label):
    parts = re.split(r'\s*(?:\\text\{\s*and\s*\}|\band\b)\s*', plain(label))
    require(len(parts) == 2, f'Two equations required: {label}')
    return [linear_form(part) for part in parts]


def graph_lines(public):
    figure = public.get('figure')
    require(figure and figure['kind'] == 'scene', 'Graph scene required')
    graphs = [e for e in figure['scene']['elements'] if e['type'] == 'graph']
    require(len(graphs) == 1, 'One graph required')
    graph = graphs[0]
    lines = [(Fraction(item['line']['m']), Fraction(item['line']['b'])) for item in graph['lines']]
    require(len(lines) == 2 and lines[0][0] != lines[1][0], 'Two distinct crossing lines required')
    return graph, lines


def solve_system_choice(public):
    prompt = plain(public['prompt'])
    labels = [o['label'] for o in options_of(public)]
    if (m := re.match(r'A theater sold (\d+) tickets for (\d+) dollars\. Adult tickets cost (\d+) dollars and child tickets cost (\d+) dollars\.', prompt)):
        count, total, adult, child = (int(m[i]) for i in range(1, 5))
        require('Let x be the number of adult tickets and y the number of child tickets' in prompt, 'Variables must be defined')
        expected = {linear_form_from(1, 1, count), linear_form_from(adult, child, total)}
    elif (m := re.match(r'(Plan|Gym) A charges a sign-up fee of (\d+) dollars plus (\d+) dollars for each of .*? (Plan|Gym) B charges a sign-up fee of (\d+) dollars plus (\d+) dollars for each', prompt)):
        require('Let y be the total cost' in prompt, 'Total cost variable must be defined')
        fa, ra, fb, rb = int(m[2]), int(m[3]), int(m[5]), int(m[6])
        expected = {linear_form_from(-ra, 1, fa), linear_form_from(-rb, 1, fb)}
    elif prompt.startswith('The table shows'):
        rows = None
        for element in public['figure']['scene']['elements']:
            if element['type'] == 'lineTable':
                rows = element['rows']
        require(rows is not None and len(rows) == 3, 'Two-line table required')
        xs = [Fraction(v) for v in rows[0][1:]]
        require(xs == sorted(set(xs)) and len(xs) >= 3, 'Table x values must increase')
        expected = set()
        for row in rows[1:]:
            ys = [Fraction(v) for v in row[1:]]
            slope = (ys[1] - ys[0]) / (xs[1] - xs[0])
            require(all(ys[i] - ys[0] == slope * (xs[i] - xs[0]) for i in range(len(xs))), 'Table row must be linear')
            expected.add(linear_form_from(-slope, 1, ys[0] - slope * xs[0]))
        require(len(expected) == 2, 'Table rows must give different lines')
    elif prompt == 'Which system of equations is graphed?':
        graph, lines = graph_lines(public)
        for m_, b_ in lines:
            ys = [m_ * x + b_ for x in graph['x']]
            require(max(ys) > graph['y'][0] and min(ys) < graph['y'][1], 'Plotted line must be visible')
        expected = {linear_form_from(-m_, 1, b_) for m_, b_ in lines}
    else:
        raise ValueError('Unrecognised system prompt')
    require(len(expected) == 2, 'System must contain two different lines')
    correct, keys = [], []
    for label in labels:
        got = frozenset(split_system(label))
        keys.append(got)
        correct.append(got == expected)
    return finish(public, correct, keys)


def solve_graph_estimate(public):
    graph, lines = graph_lines(public)
    (m1, b1), (m2, b2) = lines
    x = (b2 - b1) / (m1 - m2)
    y = m1 * x + b1
    (xlo, xhi), (ylo, yhi) = graph['x'], graph['y']
    require(xlo < x < xhi and ylo < y < yhi, 'Crossing must be inside the plotted window')
    for m_, b_ in lines:
        require(ylo <= m_ * xlo + b_ <= yhi and ylo <= m_ * xhi + b_ <= yhi, 'Lines must stay inside the window')
    require(re.search(r'ordered pair \(x, y\)', plain(public['prompt'])), 'Pair order must be named')
    labels = [o['label'] for o in options_of(public)]
    pairs = []
    for label in labels:
        match = re.fullmatch(r'\((-?[\d.]+), (-?[\d.]+)\)', plain(label))
        require(match is not None, f'Ordered pair expected: {label}')
        pairs.append((Fraction(match[1]), Fraction(match[2])))
    # Distance in screen units: scale each axis by its plotted span so the choice nearest the crossing is nearest on the picture.
    sx, sy = Fraction(xhi - xlo), Fraction(yhi - ylo)
    distances = [math.hypot(float((px - x) / sx), float((py - y) / sy)) for px, py in pairs]
    order = sorted(range(4), key=lambda i: distances[i])
    require(distances[order[1]] - distances[order[0]] > 0.02, 'Nearest estimate must be clearly nearest on the graph')
    require(distances[order[0]] < 0.05, 'Best estimate must lie close to the crossing')
    correct = [i == order[0] for i in range(4)]
    return finish(public, correct, pairs)


# ---------------------------------------------------------------- exponentials and equation modelling

def interval(text):
    """Parse one inequality such as -\\infty<x<\\infty, t\\ge0, 0<P\\le50 into (lo, lo_closed, hi, hi_closed)."""
    s = squash(text).replace('\\ge', '>=').replace('\\le', '<=')
    lo, lo_closed, hi, hi_closed = -INF, False, INF, False
    if (m := re.fullmatch(r'-\\infty<[A-Za-z]<\\infty', s)):
        return lo, lo_closed, hi, hi_closed
    if (m := re.fullmatch(r'(-?\d+(?:\.\d+)?)(<=|<)[A-Za-z](<=|<)(-?\d+(?:\.\d+)?)', s)):
        return float(m[1]), m[2] == '<=', float(m[4]), m[3] == '<='
    if (m := re.fullmatch(r'[A-Za-z](>=|>|<=|<)(-?\d+(?:\.\d+)?)', s)):
        value = float(m[2])
        if m[1] in ('>=', '>'):
            return value, m[1] == '>=', INF, False
        return -INF, False, value, m[1] == '<='
    raise ValueError(f'Unreadable inequality: {text}')


def solve_exp_domain(public):
    prompt = plain(public['prompt'])
    labels = [o['label'] for o in options_of(public)]
    if (m := re.match(r'What are the domain and range of f\(x\)=(-?\d*)\((\d+(?:\.\d+)?)\)\^x ([+-]) (\d+), written as inequalities\?', prompt)):
        a, b = float({'': '1', '-': '-1'}.get(m[1], m[1])), float(m[2])
        c = float(m[4]) * (1 if m[3] == '+' else -1)
        require(b > 0 and b != 1 and a != 0, 'Exponential base and coefficient must be valid')
        domain = (-INF, False, INF, False)
        rng = (c, False, INF, False) if a > 0 else (-INF, False, c, False)
    elif (m := re.match(r'The number of .* after t \w+ is modeled by P\(t\)=(\d+)\((\d+(?:\.\d+)?)\)\^t, where t starts at 0', prompt)):
        a, b = float(m[1]), float(m[2])
        require(b > 0 and b != 1 and a > 0, 'Exponential model must be valid')
        domain = (0.0, True, INF, False)
        rng = (a, True, INF, False) if b > 1 else (0.0, False, a, True)
    else:
        raise ValueError('Unrecognised exponential prompt')
    correct, keys = [], []
    for label in labels:
        match = re.fullmatch(r'Domain (.*?); range (.*)', plain(label))
        require(match is not None, f'Domain and range required: {label}')
        got = (interval(match[1]), interval(match[2]))
        keys.append(got)
        correct.append(got == (domain, rng))
    return finish(public, correct, keys)


def abs_solutions(label, variable):
    text = squash(label)
    if (m := re.fullmatch(r'\|' + variable + r'(?:([+-])(\d+))?\|=(-?\d+)', text)):
        shift = Fraction(0) if m[1] is None else (int(m[2]) if m[1] == '+' else -int(m[2]))
        center, radius = -Fraction(shift), Fraction(int(m[3]))
        if radius < 0:
            return frozenset()
        return frozenset({center - radius, center + radius})
    if (m := re.fullmatch(variable + r'([+-])(\d+)=(-?\d+)', text)):
        shift = int(m[2]) if m[1] == '+' else -int(m[2])
        return frozenset({Fraction(int(m[3]) - shift)})
    raise ValueError(f'Unreadable absolute-value choice: {label}')


def solve_abs_formulate(public):
    prompt = plain(public['prompt'])
    labels = [o['label'] for o in options_of(public)]
    if (m := re.fullmatch(r'An absolute value equation has the two solutions x=(-?\d+) and x=(-?\d+)\. Which equation has exactly these solutions\?', prompt)):
        expected, variable = frozenset({Fraction(int(m[1])), Fraction(int(m[2]))}), 'x'
    elif (m := re.fullmatch(r'Which equation describes all numbers x that are exactly (\d+) units from (-?\d+) on the number line\?', prompt)):
        expected = frozenset({Fraction(int(m[2]) - int(m[1])), Fraction(int(m[2]) + int(m[1]))})
        variable = 'x'
    elif (m := re.fullmatch(r'.*? set to (?:cut boards )?(\d+) \w+(?: long)?\. .*? ([A-Z]) differs from the setting by exactly (\d+) units\. Which equation models this\?', prompt)):
        center, variable, radius = int(m[1]), m[2], int(m[3])
        expected = frozenset({Fraction(center - radius), Fraction(center + radius)})
    else:
        raise ValueError('Unrecognised absolute-value prompt')
    require(len(expected) == 2, 'Two distinct solutions required')
    correct, keys = [], []
    for label in labels:
        got = abs_solutions(label, variable)
        keys.append((got, '|' in label))
        correct.append(got == expected and '|' in label)
    return finish(public, correct, keys)


def equation_function(label, x):
    left, right = plain(label).split('=')
    return tex_eval(left, x=x) - tex_eval(right, x=x)


def equivalent_models(expected, label, poles):
    """True when the choice equals the model up to a nonzero constant or a product of the clearing factors."""
    samples = [Fraction(n) for n in range(7, 23) if all(n != p for p in poles)]
    multipliers = [lambda x: Fraction(1), lambda x: x, lambda x: 1 / x]
    for pole in {p for p in poles if p != 0}:
        multipliers.append(lambda x, pole=pole: x - pole)
    for first in list(multipliers):
        for second in list(multipliers):
            multipliers.append(lambda x, first=first, second=second: first(x) * second(x))
    for multiplier in multipliers:
        ratios = set()
        for x in samples:
            base = expected(x)
            try:
                got = equation_function(label, x)
            except ZeroDivisionError:
                break
            if base == 0:
                if got != 0:
                    break
                continue
            ratios.add(got / base / multiplier(x))
        else:
            if len(ratios) == 1 and next(iter(ratios)) != 0:
                return True
    return False


def solve_rational_formulate(public):
    prompt = plain(public['prompt'])
    labels = [o['label'] for o in options_of(public)]
    if (m := re.fullmatch(r'A driver travels (\d+) miles at x miles per hour, then (\d+) more miles at (\d+) miles per hour faster\. The whole trip takes (\d+) hours\. Which equation models this\?', prompt)):
        d1, d2, step, hours = (int(m[i]) for i in range(1, 5))
        def expected(x):
            return Fraction(d1) / x + Fraction(d2) / (x + step) - hours
        poles = [0, -step]
    elif (m := re.fullmatch(r'A boat travels (\d+) miles downstream in the same time it takes to travel (\d+) miles upstream\. The current flows at (\d+) miles per hour\. Let x be the boat\'s speed in still water, in miles per hour\. Which equation models this\?', prompt)):
        down, up, current = (int(m[i]) for i in range(1, 4))
        def expected(x):
            return Fraction(down) / (x + current) - Fraction(up) / (x - current)
        poles = [-current, current]
    elif (m := re.fullmatch(r'One (?:pipe fills a pool|painter paints a fence) in (\d+) hours working alone\. A second \w+ does the same job in (\d+) hours working alone\. Working together they take x hours\. Which equation models this\?', prompt)):
        t1, t2 = int(m[1]), int(m[2])
        def expected(x):
            return Fraction(1, t1) + Fraction(1, t2) - 1 / x
        poles = [0]
    else:
        raise ValueError('Unrecognised rational-equation prompt')
    correct, keys = [], []
    for label in labels:
        flag = equivalent_models(expected, label, poles)
        correct.append(flag)
        keys.append(squash(label))
    return finish(public, correct, keys)


def real_power(x, p, q):
    """x^(p/q) over the reals with the principal reading: odd q uses the real root, even q needs x >= 0."""
    if q % 2 == 0 and x < 0:
        return None
    root = round(abs(x) ** (1 / q))
    if root ** q != abs(x):
        return None
    return (Fraction(-root) if x < 0 else Fraction(root)) ** p


def solve_rational_exponent(public):
    prompt = plain(public['prompt'])
    m = re.fullmatch(r'Solve x\^\{\\frac\{(\d+)\}\{(\d+)\}\}=(-?\d+) for all real x\.', prompt)
    require(m is not None, 'Unrecognised rational-exponent prompt')
    p, q, r = int(m[1]), int(m[2]), int(m[3])
    require(math.gcd(p, q) == 1, 'Exponent must be in lowest terms')
    magnitude = round(abs(r) ** (q / p))
    candidates = {magnitude, -magnitude, 0}
    require(abs(r) == 0 or magnitude ** p == abs(r) ** q, 'Answers must be integers')
    expected = frozenset(Fraction(x) for x in candidates if real_power(x, p, q) == r)
    correct, keys = [], []
    for label in (o['label'] for o in options_of(public)):
        text = squash(label)
        if 'nosolution' in text.lower() or 'norealsolution' in text.lower():
            got = frozenset()
        else:
            values = re.findall(r'x=(-?\d+)', text)
            require(values and re.fullmatch(r'x=-?\d+(?:orx=-?\d+)*', text), f'Unreadable solution list: {label}')
            got = frozenset(Fraction(int(v)) for v in values)
        keys.append(got)
        correct.append(got == expected)
    return finish(public, correct, keys)


# ---------------------------------------------------------------- geometry

def parse_scale(text):
    return tex_eval(text)


def apply_motion(point, clause):
    x, y = point
    clause = plain(clause)
    if re.search(r'reflected across the x-axis', clause):
        return x, -y
    if re.search(r'reflected across the y-axis', clause):
        return -x, y
    if re.search(r'reflected across the line y=x', clause):
        return y, x
    if (m := re.search(r'rotated (\d+)° (?:(counterclockwise|clockwise) )?about the origin', clause.replace('^\\circ', '°'))):
        require(int(m[1]) == 180 or m[2] is not None, 'Quarter turns need a direction')
        turns = (int(m[1]) // 90) * (-1 if m[2] == 'clockwise' else 1)
        for _ in range(turns % 4):
            x, y = -y, x
        return x, y
    if (m := re.search(r'translated (\d+) units? (left|right) and (\d+) units? (up|down)', clause)):
        return x + (int(m[1]) if m[2] == 'right' else -int(m[1])), y + (int(m[3]) if m[4] == 'up' else -int(m[3]))
    if (m := re.search(r'dilated with center \((-?\d+), (-?\d+)\) and scale factor (\S+)', clause)):
        cx, cy, k = Fraction(int(m[1])), Fraction(int(m[2])), parse_scale(m[3].rstrip(','))
        return cx + k * (x - cx), cy + k * (y - cy)
    raise ValueError(f'Unknown motion: {clause}')


def solve_transformation(public):
    prompt = plain(public['prompt'])
    m = re.fullmatch(r'Point A=\((-?\d+), (-?\d+)\) is (.*?), and then its image is (.*?)\. What are the coordinates of the final image of A\?', prompt)
    require(m is not None, 'Unrecognised transformation prompt')
    point = (Fraction(int(m[1])), Fraction(int(m[2])))
    for clause in (m[3], m[4]):
        point = apply_motion(point, clause)
    correct, keys = [], []
    for label in (o['label'] for o in options_of(public)):
        match = re.fullmatch(r'\((.*?), (.*?)\)', plain(label))
        require(match is not None, f'Ordered pair expected: {label}')
        got = (tex_eval(match[1]), tex_eval(match[2]))
        keys.append(got)
        correct.append(got == point)
    return finish(public, correct, keys)


def rect(label):
    m = re.fullmatch(r'An? (\d+) by (\d+) rectangle', label)
    return (int(m[1]), int(m[2])) if m else None


def solve_counterexample(public):
    prompt = plain(public['prompt'])
    labels = [plain(o['label']) for o in options_of(public)]
    correct, keys = [], []
    if prompt.startswith('Conjecture: If two rectangles have the same perimeter'):
        for label in labels:
            m = re.fullmatch(r'An? (\d+) by (\d+) rectangle and an? (\d+) by (\d+) rectangle', label)
            require(m is not None, f'Rectangle pair expected: {label}')
            a, b, c, d = (int(m[i]) for i in range(1, 5))
            keys.append(frozenset({frozenset({a, b}), frozenset({c, d})}) if True else None)
            correct.append(a + b == c + d and a * b != c * d)
            keys[-1] = (min(a, b), max(a, b), min(c, d), max(c, d))
    elif prompt.startswith('Conjecture: If the diagonals of a quadrilateral are congruent'):
        table = {
            'A rhombus that is not a square': (False, False),
            'A rectangle': (True, True),
            'A parallelogram that is not a rectangle': (False, False),
            'An isosceles trapezoid': (True, False),
        }
        for label in labels:
            require(label in table, f'Unknown figure: {label}')
            hypothesis, is_rectangle = table[label]
            keys.append(label)
            correct.append(hypothesis and not is_rectangle)
    elif prompt.startswith('Conjecture: If a quadrilateral has four congruent sides'):
        for label in labels:
            keys.append(label)
            if label == 'A square':
                correct.append(False)
            elif (m := re.fullmatch(r'A rhombus with angles of (\d+)° and (\d+)°', label.replace('^\\circ', '°'))):
                require(int(m[1]) + int(m[2]) == 180, 'Rhombus angles must be supplementary')
                correct.append(int(m[1]) != 90)
            elif (m := re.fullmatch(r'A rectangle with sides (\d+) and (\d+)', label)):
                correct.append(int(m[1]) == int(m[2]) and False)  # equal sides would make it a square, not a counterexample
            elif (m := re.fullmatch(r'A kite with sides (\d+), (\d+), (\d+), (\d+)', label)):
                sides = [int(m[i]) for i in range(1, 5)]
                correct.append(len(set(sides)) == 1 and False)
            else:
                raise ValueError(f'Unknown figure: {label}')
    elif prompt.startswith('Conjecture: If two triangles have the same area'):
        for label in labels:
            if (m := re.fullmatch(r'Two right triangles, each with legs (\d+) and (\d+)', label)):
                keys.append((m[1], m[2], m[1], m[2]))
                correct.append(False)
                continue
            m = re.fullmatch(r'An? right triangle with legs (\d+) and (\d+), and an? right triangle with legs (\d+) and (\d+)', label)
            require(m is not None, f'Triangle pair expected: {label}')
            a, b, c, d = (int(m[i]) for i in range(1, 5))
            keys.append((a, b, c, d))
            correct.append(a * b == c * d and {a, b} != {c, d})
    elif 'two sides and an angle that is not between them' in prompt:
        require('BC is opposite angle A' in prompt, 'Side-angle layout must be stated')
        for label in labels:
            m = re.fullmatch(r'∠\s*A=(\d+)°, AC=(\d+) and BC=(\d+)', label.replace('\\angle', '∠').replace('^\\circ', '°'))
            require(m is not None, f'SSA data expected: {label}')
            angle, b, a = int(m[1]), int(m[2]), int(m[3])
            keys.append((angle, b, a))
            height = b * math.sin(math.radians(angle))
            # Two triangles exist exactly when the opposite side is strictly between the height and the adjacent side.
            correct.append(height + 1e-9 < a < b - 1e-9)
    else:
        raise ValueError('Unrecognised conjecture')
    return finish(public, correct, keys)


def solve_spherical(public):
    prompt = plain(public['prompt'])
    require('great circle' in prompt and 'center is the center of the sphere' in prompt, 'Sphere line definition must be stated')
    labels = [plain(o['label']) for o in options_of(public)]
    correct, keys = [], []
    if 'parallel to the given line' in prompt:
        expected = 'Plane: exactly one. Sphere: none.'
        for label in labels:
            keys.append(label)
            correct.append(label == expected)
    elif 'greatest number of right angles' in prompt:
        expected = 'Plane: one. Sphere: three.'
        for label in labels:
            keys.append(label)
            correct.append(label == expected)
    elif 'Which could be the three angle measures' in prompt:
        for label in labels:
            keys.append(label)
            if (m := re.fullmatch(r'Three angles of (\d+)° each', label.replace('^\\circ', '°'))):
                angles = [int(m[1])] * 3
            elif (m := re.fullmatch(r'Angles of (\d+)°, (\d+)° and (\d+)°', label.replace('^\\circ', '°'))):
                angles = [int(m[i]) for i in range(1, 4)]
            else:
                raise ValueError(f'Unreadable angle list: {label}')
            # A spherical triangle has angles in (0, 180) whose sum lies strictly between 180 and 540 degrees.
            correct.append(all(0 < a < 180 for a in angles) and 180 < sum(angles) < 540)
    elif 'shortest route along the surface' in prompt:
        for label in labels:
            keys.append(label)
            correct.append(label == 'The shorter arc of the great circle through the two points')
    else:
        raise ValueError('Unrecognised sphere prompt')
    return finish(public, correct, keys)


def closeness(a, b):
    return abs(a - b) <= 1e-9 * max(1.0, abs(a), abs(b))


def numeric_choices(public, expected, unit=None):
    correct, keys = [], []
    for label in (o['label'] for o in options_of(public)):
        value = float(tex_eval(label))
        if unit is not None:
            units = re.findall(r'\\text\{\s*([^{}]*)\}', plain(label))
            keys.append((round(value, 9), tuple(units)))
            correct.append(closeness(value, expected) and tuple(u.strip() for u in units) == (unit,))
        else:
            keys.append(round(value, 9))
            correct.append(closeness(value, expected))
    return finish(public, correct, keys)


POLYGONS = {'triangle': 3, 'square': 4, 'pentagon': 5, 'hexagon': 6, 'heptagon': 7, 'octagon': 8, 'nonagon': 9, 'decagon': 10}


def solve_polygon_area(public):
    prompt = plain(public['prompt'])
    if (m := re.fullmatch(r'A regular hexagon has side length (\d+) cm\. What is its area in square centimeters\?', prompt)):
        side = int(m[1])
        return numeric_choices(public, 3 * math.sqrt(3) / 2 * side ** 2)
    if (m := re.fullmatch(r'A regular polygon with 3 sides, an equilateral triangle, has side length (\d+) cm\. Its apothem is the distance from its center to a side, (\d*)\\sqrt\{3\} cm\. What is its area in square centimeters\?', prompt)):
        side, a = int(m[1]), int(m[2] or 1)
        apothem = a * math.sqrt(3)
        require(math.isclose(apothem, side / (2 * math.tan(math.pi / 3)), rel_tol=1e-9), 'Stated apothem must match the triangle')
        return numeric_choices(public, 0.5 * apothem * 3 * side)
    if (m := re.fullmatch(r'A square has an apothem of (\d+) cm\. What is its area in square centimeters\?', prompt)):
        return numeric_choices(public, (2 * int(m[1])) ** 2)
    if (m := re.fullmatch(r'A regular hexagon has side length (\d+) cm\. What is its apothem, the distance from the center to the midpoint of a side\?', prompt)):
        return numeric_choices(public, int(m[1]) * math.sqrt(3) / 2, 'cm')
    if (m := re.fullmatch(r'A regular (\w+) has an apothem of ([\d.]+) cm and an area of ([\d.]+) square centimeters\. What is the length of one side in centimeters\?', prompt)):
        n, apothem, area = POLYGONS[m[1]], float(m[2]), float(m[3])
        side = 2 * area / (apothem * n)
        require(abs(round(side) - side) < 1e-6, 'Side must come out whole')
        true_apothem = round(side) / (2 * math.tan(math.pi / n))
        require(abs(true_apothem - apothem) <= 0.005 + 1e-9, 'Stated apothem must match the polygon')
        return numeric_choices(public, side)
    if (m := re.fullmatch(r'A regular (\w+) has side length (\d+) cm and an apothem of ([\d.]+) cm, rounded to the nearest hundredth\. Use the rounded apothem to find the area in square centimeters\.', prompt)):
        n, side, apothem = POLYGONS[m[1]], int(m[2]), float(m[3])
        require(abs(side / (2 * math.tan(math.pi / n)) - apothem) <= 0.005 + 1e-9, 'Stated apothem must match the polygon')
        return numeric_choices(public, 0.5 * apothem * n * side)
    raise ValueError('Unrecognised polygon-area prompt')


def solve_curved_surface(public):
    prompt = plain(public['prompt'])
    pi = math.pi
    unit = 'cm^2'
    if (m := re.match(r'A closed cone has a base radius of (\d+) cm and a height of (\d+) cm\. What is its total surface area, including the base\?', prompt)):
        r, h = int(m[1]), int(m[2])
        slant = math.hypot(r, h)
        total = pi * r * (r + slant)
    elif (m := re.match(r'A closed cone has a base radius of (\d+) cm and a slant height of (\d+) cm\. What is its total surface area, including the base\?', prompt)):
        r, slant = int(m[1]), int(m[2])
        require(slant > r, 'Slant height must exceed the radius')
        total = pi * r * (r + slant)
    elif (m := re.match(r'An ice-cream cone is a cone of base radius (\d+) cm and slant height (\d+) cm topped with a hemisphere of radius (\d+) cm that sits over the open end\. What is the surface area of the outside, counting the cone\'s side and the hemisphere\'s curved surface\?', prompt)):
        r, slant, rh = int(m[1]), int(m[2]), int(m[3])
        require(r == rh and slant > r, 'Hemisphere must match the cone opening')
        total = pi * r * slant + 2 * pi * r * r
    elif (m := re.match(r'A solid is a cylinder with radius (\d+) cm and height (\d+) cm, with a hemisphere of radius (\d+) cm attached to its top face\. The bottom face is exposed\. What is the surface area of the solid, counting only the outside surfaces\?', prompt)):
        r, h, rh = int(m[1]), int(m[2]), int(m[3])
        require(r == rh, 'Hemisphere must match the cylinder')
        total = pi * r * r + 2 * pi * r * h + 2 * pi * r * r
    elif (m := re.match(r'A silo is a cylinder of radius (\d+) cm and height (\d+) cm with a cone of slant height (\d+) cm and the same radius on top\. The bottom of the cylinder is a flat base\. What is the surface area of the silo, counting only the outside surfaces\?', prompt)):
        r, h, slant = int(m[1]), int(m[2]), int(m[3])
        require(slant > r, 'Cone slant height must exceed the radius')
        total = pi * r * r + 2 * pi * r * h + pi * r * slant
    else:
        raise ValueError('Unrecognised surface-area prompt')
    correct, keys = [], []
    for label in (o['label'] for o in options_of(public)):
        m2 = re.fullmatch(r'(\d+)\\pi\\text\{ cm\}\^2', plain(label))
        require(m2 is not None, f'Surface area in terms of pi expected: {label}')
        value = int(m2[1]) * pi
        keys.append(value)
        correct.append(closeness(value, total))
    require(abs(total / pi - round(total / pi)) < 1e-9, 'Exact answer must be a whole multiple of pi')
    return finish(public, correct, keys)


def solve_area_probability(public):
    prompt = plain(public['prompt'])
    labels = [o['label'] for o in options_of(public)]
    symbolic = None  # value as float
    if (m := re.match(r'A dart lands at a random point of a square target with side (\d+) cm\. The target has a shaded circle of radius (\d+) cm entirely inside the square\. What is the probability that the dart lands (in|outside) the circle\? Give the exact probability\.', prompt)):
        side, r = int(m[1]), int(m[2])
        require(2 * r < side, 'Circle must fit inside the square')
        inside = math.pi * r * r / side ** 2
        symbolic = inside if m[3] == 'in' else 1 - inside
    elif (m := re.match(r'A circular target has radius (\d+) cm\. Its center is a circle of radius (\d+) cm, and the ring around it is shaded\. A dart lands at a random point on the target\. What is the probability that it lands in the shaded ring\? Give a fraction in simplest form\.', prompt)):
        big, small = int(m[1]), int(m[2])
        require(0 < small < big, 'Ring must have positive width')
        symbolic = float(1 - Fraction(small * small, big * big))
    elif (m := re.match(r'A point is chosen at random on a rectangle that is (\d+) cm wide and (\d+) cm tall\. A shaded triangle inside the rectangle has base (\d+) cm and height (\d+) cm\. What is the probability that the point is in the triangle\? Give a fraction in simplest form\.', prompt)):
        w, h, b, th = (int(m[i]) for i in range(1, 5))
        require(b <= w and th <= h, 'Triangle must fit in the rectangle')
        symbolic = float(Fraction(b * th, 2 * w * h))
    elif (m := re.match(r'A point is chosen at random on a (\d+) by (\d+) rectangular board\. A shaded (\d+) by (\d+) rectangle lies entirely on the board\. What is the probability that the point is in the shaded rectangle\? Give a fraction in simplest form\.', prompt)):
        w, h, sw, sh = (int(m[i]) for i in range(1, 5))
        require(sw <= w and sh <= h, 'Shaded rectangle must fit on the board')
        symbolic = float(Fraction(sw * sh, w * h))
    else:
        raise ValueError('Unrecognised area-probability prompt')
    require(0 < symbolic < 1, 'Probability must lie between 0 and 1')
    correct, keys = [], []
    for label in labels:
        value = float(tex_eval(label))
        keys.append(round(value, 12))
        correct.append(closeness(value, symbolic))
        if 'simplest form' in prompt:
            frac = re.fullmatch(r'\\frac\{(\d+)\}\{(\d+)\}', plain(label))
            if frac:
                require(math.gcd(int(frac[1]), int(frac[2])) == 1 or not correct[-1], 'Correct fraction must be in simplest form')
    return finish(public, correct, keys)


# ---------------------------------------------------------------- functions, limits, parametrics

def monomial(text):
    m = re.fullmatch(r'(\d+)x(?:\^2)?', squash(text))
    require(m is not None, f'Monomial expected: {text}')
    return int(m[1]), 2 if '^2' in text else 1


def solve_composition(public):
    prompt = plain(public['prompt'])
    m = re.fullmatch(r'Let f\(x\)=(.*?) and g\(x\)=(.*?)\. Which statement about f\(g\(x\)\) and g\(f\(x\)\) is true\?', prompt)
    require(m is not None, 'Unrecognised composition prompt')
    samples = [Fraction(n) for n in range(-4, 5)]
    def f(x):
        return tex_eval(m[1], x=x)
    def g(x):
        return tex_eval(m[2], x=x)
    true_fg = tuple(f(g(x)) for x in samples)
    true_gf = tuple(g(f(x)) for x in samples)
    require(m[1].count('x^3') == 0 and m[2].count('x^3') == 0, 'Inner functions stay low degree')
    correct, keys = [], []
    def values(expression):
        return tuple(tex_eval(expression, x=x) for x in samples)
    for label in (o['label'] for o in options_of(public)):
        text = plain(label)
        both = re.fullmatch(r'f\(g\(x\)\)=g\(f\(x\)\)=(.*?), so (.*)', text)
        split = re.fullmatch(r'f\(g\(x\)\)=(.*?) and g\(f\(x\)\)=(.*?), so (.*)', text)
        if both:
            fg = gf = values(both[1])
            conclusion = both[2]
        else:
            require(split is not None, f'Unreadable statement: {label}')
            fg, gf, conclusion = values(split[1]), values(split[2]), split[3]
        says_equal = 'does not matter' in conclusion or 'commutative' in conclusion
        general = 'every pair' in conclusion
        require('matters' in conclusion or says_equal, f'Conclusion unreadable: {conclusion}')
        honest = says_equal == (fg == gf)
        keys.append((fg, gf, says_equal, general))
        correct.append(fg == true_fg and gf == true_gf and honest and not general)
    return finish(public, correct, keys)


def factor_list(text):
    """Parse a product like -(x + 3)(x - 2)^2 x into (constant, [(root, power)])."""
    s = squash(text)
    constant = Fraction(1)
    if s.startswith('-'):
        constant, s = Fraction(-1), s[1:]
    if (m := re.match(r'(\d+)(?=\(|x)', s)):
        constant *= int(m[1])
        s = s[m.end():]
    factors = []
    while s:
        if (m := re.match(r'\(x([+-])(\d+)\)(\^2)?', s)):
            root = -int(m[2]) if m[1] == '+' else int(m[2])
            factors.append((Fraction(root), 2 if m[3] else 1))
        elif (m := re.match(r'x(\^2)?', s)):
            factors.append((Fraction(0), 2 if m[1] else 1))
        else:
            raise ValueError(f'Unreadable factor list: {text}')
        s = s[m.end():]
    return constant, factors


def evaluate_factors(constant, factors, x):
    value = constant
    for root, power in factors:
        value *= (x - root) ** power
    return value


def one_sided_limits(label):
    text = plain(label)
    m = re.fullmatch(r'x\\to(.*?)\^-:\\ f\(x\)\\to(.*?);\\quad x\\to(.*?)\^\+:\\ f\(x\)\\to(.*)', text)
    require(m is not None, f'Unreadable one-sided statement: {label}')
    def value(part):
        part = part.strip()
        if part == '\\infty':
            return 'inf'
        if part == '-\\infty':
            return '-inf'
        return tex_eval(part)
    return value(m[2]), value(m[4])


def solve_one_sided(public):
    prompt = plain(public['prompt'])
    if (m := re.fullmatch(r'For f\(x\)=\\frac\{(.*?)\}\{(.*?)\}, there is a vertical asymptote at x=(-?\d+)\. Which statement.*', prompt)):
        nc, nf = factor_list(m[1])
        dc, df = factor_list(m[2])
        a = Fraction(int(m[3]))
        require(any(root == a for root, _ in df) and not any(root == a for root, _ in nf), 'Asymptote must be a true pole')
        eps = Fraction(1, 10 ** 6)
        def sign(x):
            value = evaluate_factors(nc, nf, x) / evaluate_factors(dc, df, x)
            return 'inf' if value > 0 else '-inf'
        expected = (sign(a - eps), sign(a + eps))
    elif (m := re.fullmatch(r'Let f\(x\)=\\begin\{cases\}(.*?) & x<(-?\d+)\\\\ (.*?) & x\\ge(-?\d+)\\end\{cases\}\. Which statement.*', prompt)):
        a = Fraction(int(m[2]))
        require(a == int(m[4]), 'Piece boundary must match')
        expected = (tex_eval(m[1], x=a), tex_eval(m[3], x=a))
        require(expected[0] != expected[1], 'Jump must be visible')
    elif (m := re.fullmatch(r'Let f\(x\)=\\frac\{\(x ([+-]) (\d+)\)\(x ([+-]) (\d+)\)\}\{x ([+-]) (\d+)\}, which is undefined at x=(-?\d+)\. Which statement.*', prompt)):
        roots = {}
        for sign, number in ((m[1], m[2]), (m[3], m[4]), (m[5], m[6])):
            roots.setdefault('n', []).append(-int(number) if sign == '+' else int(number))
        numerator_roots, hole = roots['n'][:2], roots['n'][2]
        require(int(m[7]) == hole and hole in numerator_roots, 'Hole must cancel a numerator factor')
        other = [r for r in numerator_roots if r != hole] if numerator_roots.count(hole) == 1 else None
        require(other is not None and len(other) == 1, 'One surviving factor expected')
        expected = (Fraction(hole - other[0]), Fraction(hole - other[0]))
    else:
        raise ValueError('Unrecognised one-sided prompt')
    correct, keys = [], []
    for label in (o['label'] for o in options_of(public)):
        got = one_sided_limits(label)
        keys.append(got)
        correct.append(got == expected)
    return finish(public, correct, keys)


def parse_expression_in(text, variable, **env):
    return tex_eval(text, **{variable: env.pop(variable)}, **env)


def solve_parametric(public):
    prompt = plain(public['prompt'])
    labels = [o['label'] for o in options_of(public)]
    correct, keys = [], []
    if (m := re.fullmatch(r'A line has the rectangular equation (y=.*?)\. Which pair of parametric equations describes this line, using (x=.*?)\?', prompt)):
        line = linear_form(m[1])
        xt = m[2].split('=')[1]
        for label in labels:
            parts = re.fullmatch(r'(x=.*?)\\text\{ and \}(y=.*)', plain(label))
            require(parts is not None and parts[1].split('=')[1] == xt, f'Parametric pair with the stated x expected: {label}')
            ok = True
            for t in (Fraction(-2), Fraction(0), Fraction(3)):
                x = tex_eval(xt, t=t)
                y = tex_eval(parts[2].split('=')[1], t=t)
                ok = ok and line[0] * x + line[1] * y == line[2]
            correct.append(ok)
            keys.append(squash(parts[2]))
        return finish(public, correct, keys)
    m = re.fullmatch(r'A point moves so that x=(.*?) and y=(.*?)(?: for 0\\le t<2\\pi|, where t (?:can be|is) any real number)\. Which rectangular equation describes its path\?', prompt)
    require(m is not None, 'Unrecognised parametric prompt')
    trig = '\\cos' in m[1]
    xs, ys = m[1].replace('\\cos t', 'c').replace('\\sin t', 's'), m[2].replace('\\cos t', 'c').replace('\\sin t', 's')
    if trig:
        require('\\cos t' in m[1] and '\\sin t' in m[2], 'Circle needs cosine for x and sine for y')
        points = []
        for degrees in (0, 30, 45, 90, 135, 200, 270, 330):
            c, s = math.cos(math.radians(degrees)), math.sin(math.radians(degrees))
            points.append((tex_eval(xs, c=c, s=s), tex_eval(ys, c=c, s=s)))
    else:
        points = [(tex_eval(xs, t=Fraction(t)), tex_eval(ys, t=Fraction(t))) for t in range(-4, 5)]
    for label in labels:
        text = plain(label)
        require(text.count('=') == 1, f'Equation expected: {label}')
        left, right = text.split('=')
        ok = all(abs(float(tex_eval(left, x=px, y=py) - tex_eval(right, x=px, y=py))) < 1e-9 for px, py in points)
        correct.append(ok)
        keys.append(squash(text) if not trig else tuple(round(float(tex_eval(left, x=px, y=py) - tex_eval(right, x=px, y=py)), 6) for px, py in points))
    if trig:
        # Equations that coincide on every sampled point and have identical form would be duplicates; shape keys above separate them.
        keys = [(k, squash(l)) for k, l in zip(keys, labels)]
    return finish(public, correct, keys)


def solve_angular(public):
    prompt = plain(public['prompt'])
    tau = 2 * math.pi
    if (m := re.fullmatch(r'An? \w+ turns at (\d+) revolutions per minute\. What is its angular speed in radians per second\?', prompt)):
        return numeric_choices(public, int(m[1]) * tau / 60, 'rad/s')
    if (m := re.fullmatch(r'An? \w+ turns at (\d+) revolutions per minute\. What is its angular speed in radians per minute\?', prompt)):
        return numeric_choices(public, int(m[1]) * tau, 'rad/min')
    if (m := re.fullmatch(r'An? \w+ with radius (\d+) cm turns at (\d+) revolutions per minute\. How fast, in centimeters per minute, does a point on its rim move\?', prompt)):
        return numeric_choices(public, int(m[1]) * int(m[2]) * tau, 'cm/min')
    if (m := re.fullmatch(r'A point on the rim of an? \w+ with radius (\d+) cm turns at an angular speed of (\d+) radians per second\. How far along the rim, in centimeters, does the point travel in (\d+) seconds\?', prompt)):
        return numeric_choices(public, int(m[1]) * int(m[2]) * int(m[3]), 'cm')
    if (m := re.fullmatch(r'A point on the rim of an? \w+ with radius (\d+) cm moves at (\d+) centimeters per second\. What is the \w+\'s angular speed in radians per second\?', prompt)):
        return numeric_choices(public, int(m[2]) / int(m[1]), 'rad/s')
    raise ValueError('Unrecognised angular-velocity prompt')


def solve_reference_angle(public):
    prompt = plain(public['prompt'])
    labels = [o['label'] for o in options_of(public)]
    degrees = None
    radian = re.search(r'\\theta=(-?)\\frac\{(\d*)\\pi\}\{(\d+)\}', prompt)
    if prompt.startswith('What is the reference angle of') and radian:
        turns = Fraction(int(radian[2] or 1), int(radian[3])) * (-1 if radian[1] else 1)
        mod = turns % 2
        require((mod * 2) % 1 != 0 or (mod * 2) % 1 == 0 and False, 'Angle must not lie on an axis')
        ref = min(mod % 1, 1 - mod % 1)
        return reference_choices(public, float(ref) * math.pi, 'rad')
    if (m := re.fullmatch(r'What is the reference angle of (-?\d+)\^\\circ, the acute angle.*standard position\?', prompt)):
        mod = Fraction(int(m[1])) % 360
        require(mod % 90 != 0, 'Angle must not lie on an axis')
        ref = min(mod % 180, 180 - mod % 180)
        return reference_choices(public, float(ref), 'deg')
    if prompt.startswith('In which quadrant') and radian:
        degrees = Fraction(int(radian[2] or 1), int(radian[3])) * 180 * (-1 if radian[1] else 1)
    elif (m := re.fullmatch(r'In which quadrant does the terminal side of an angle of (-?\d+)\^\\circ in standard position lie\?', prompt)):
        degrees = Fraction(int(m[1]))
    elif (m := re.fullmatch(r'Which angle between 0\^\\circ and 360\^\\circ is coterminal with (-?\d+)\^\\circ\?', prompt)):
        target = int(m[1]) % 360
        correct, keys = [], []
        for label in labels:
            m2 = re.fullmatch(r'(-?\d+)\^\\circ', plain(label))
            require(m2 is not None, f'Degree measure expected: {label}')
            keys.append(int(m2[1]))
            correct.append(0 <= int(m2[1]) < 360 and int(m2[1]) % 360 == target)
        return finish(public, correct, keys)
    else:
        raise ValueError('Unrecognised reference-angle prompt')
    mod = degrees % 360
    require(mod % 90 != 0, 'Angle must not lie on an axis')
    quadrant = 1 + int(mod // 90)
    names = {1: 'I', 2: 'II', 3: 'III', 4: 'IV'}
    correct, keys = [], []
    for label in labels:
        m2 = re.fullmatch(r'Quadrant (I|II|III|IV)', plain(label))
        require(m2 is not None, f'Quadrant expected: {label}')
        keys.append(m2[1])
        correct.append(m2[1] == names[quadrant])
    return finish(public, correct, keys)


def reference_choices(public, expected, unit):
    correct, keys = [], []
    for label in (o['label'] for o in options_of(public)):
        text = plain(label)
        if unit == 'deg':
            m = re.fullmatch(r'(-?\d+)\^\\circ', text)
            require(m is not None, f'Degree measure expected: {label}')
            value = float(m[1])
        else:
            require('\\pi' in text, f'Radian measure expected: {label}')
            value = float(tex_eval(text))
        keys.append(round(value, 9))
        correct.append(closeness(value, expected))
    return finish(public, correct, keys)


def direction_choices(public, east, north, ask):
    """ask is 'east', 'west', 'north', 'south', 'east-west' or 'north-south'."""
    correct, keys = [], []
    for label in (o['label'] for o in options_of(public)):
        text = plain(label)
        word = re.search(r'\b(east|west|north|south)\b', text)
        number = float(tex_eval(re.sub(r'\\text\{[^{}]*\}', '', text)))
        if ask in ('east-west', 'north-south'):
            require(word is not None, f'Direction word required: {label}')
            direction = word[1]
            signed = {'east': number, 'west': -number, 'north': number, 'south': -number}[direction]
            truth = east if ask == 'east-west' else north
            flag = closeness(signed, truth) and direction in (ask.split('-') if True else [])
            keys.append((round(number, 9), direction))
            correct.append(flag and ((truth > 0) == (direction in ('east', 'north'))))
        else:
            require(word is None, f'Distance only expected: {label}')
            truth = {'east': east, 'west': -east, 'north': north, 'south': -north}[ask]
            require(truth > 0, 'Asked direction must point that way')
            keys.append(round(number, 9))
            correct.append(closeness(number, truth))
    return finish(public, correct, keys)


def solve_bearing(public):
    prompt = plain(public['prompt'])
    labels = [o['label'] for o in options_of(public)]
    if (m := re.fullmatch(r'A ship leaves port and travels (\d+) km on a bearing of (\d{3})\^\\circ\. A three-digit bearing is the angle measured clockwise from north\. How far (east or west|north or south) of the port is the ship\?', prompt)):
        distance, bearing = int(m[1]), int(m[2])
        east, north = distance * math.sin(math.radians(bearing)), distance * math.cos(math.radians(bearing))
        return direction_choices(public, east, north, 'east-west' if m[3].startswith('east') else 'north-south')
    if (m := re.fullmatch(r'A plane flies (\d+) km on a bearing of \\mathrm\{([NS])\}(\d+)\^\\circ\\mathrm\{([EW])\}, which means \3\^\\circ from (north|south) toward (east|west)\. How many kilometers (north|south|east|west) of its starting point is it\?', prompt)):
        distance, ns, angle, ew = int(m[1]), m[2], int(m[3]), m[4]
        require({'N': 'north', 'S': 'south'}[ns] == m[5] and {'E': 'east', 'W': 'west'}[ew] == m[6], 'Convention text must match the bearing')
        along = distance * math.cos(math.radians(angle))
        across = distance * math.sin(math.radians(angle))
        north = along if ns == 'N' else -along
        east = across if ew == 'E' else -across
        return direction_choices(public, east, north, m[7])
    if (m := re.fullmatch(r'A hiker starts at a trailhead, walks (\d+|\d+\\sqrt\{3\}) km due (north|south), and then (\d+|\d+\\sqrt\{3\}) km due (east|west)\. A three-digit bearing is the angle measured clockwise from north\. What is the bearing of the hiker from the trailhead\?', prompt)):
        first, second = float(tex_eval(m[1])), float(tex_eval(m[3]))
        north = first if m[2] == 'north' else -first
        east = second if m[4] == 'east' else -second
        bearing = math.degrees(math.atan2(east, north)) % 360
        correct, keys = [], []
        for label in labels:
            m2 = re.fullmatch(r'(\d{3})\^\\circ', plain(label))
            require(m2 is not None, f'Three-digit bearing expected: {label}')
            keys.append(int(m2[1]))
            correct.append(closeness(float(int(m2[1])), bearing))
        return finish(public, correct, keys)
    raise ValueError('Unrecognised bearing prompt')


# ---------------------------------------------------------------- series

def series_terms(text):
    return [Fraction(int(v.replace(' ', ''))) for v in re.findall(r'[+-]?\s*\d+', text)]


def solve_sigma(public):
    prompt = plain(public['prompt'])
    m = re.fullmatch(r'Which sigma notation represents the series (.*?) \+ \\cdots (\+|-) (\d+), which has (\d+) terms\?', prompt) or re.fullmatch(r'Which sigma notation represents the series (.*?)\+ \\cdots (\+|-) (\d+), which has (\d+) terms\?', prompt)
    require(m is not None, 'Unrecognised sigma prompt')
    shown = series_terms(m[1].replace('$', ''))
    last = Fraction(int(m[3])) * (-1 if m[2] == '-' else 1)
    n = int(m[4])
    require(len(shown) in (3, 4) and n > len(shown), 'Series must show 3 or 4 terms before the ellipsis')
    arithmetic = len({shown[i + 1] - shown[i] for i in range(len(shown) - 1)}) == 1
    geometric = all(v != 0 for v in shown) and len({shown[i + 1] / shown[i] for i in range(len(shown) - 1)}) == 1
    candidates = []
    if arithmetic:
        d = shown[1] - shown[0]
        candidates.append([shown[0] + d * i for i in range(n)])
    if geometric:
        r = shown[1] / shown[0]
        candidates.append([shown[0] * r ** i for i in range(n)])
    candidates = [c for c in candidates if c[-1] == last]
    require(len(candidates) == 1, 'Shown terms and last term must define one sequence')
    expected = candidates[0]
    correct, keys = [], []
    for label in (o['label'] for o in options_of(public)):
        text = plain(label)
        match = re.fullmatch(r'\\sum_\{k=(\d+)\}\^\{(\d+)\}(.*)', text)
        require(match is not None, f'Sigma notation expected: {label}')
        lo, hi = int(match[1]), int(match[2])
        body = match[3].strip()
        terms = [tex_eval(body, k=Fraction(k)) for k in range(lo, hi + 1)]
        keys.append((tuple(terms)))
        correct.append(terms == expected)
    return finish(public, correct, keys)


def solve_infinite_sum(public):
    prompt = plain(public['prompt'])
    labels = [o['label'] for o in options_of(public)]
    total = None
    if (m := re.fullmatch(r'A ball is dropped from a height of (\d+) meters?\. After each fall it bounces back up to \\frac\{(\d+)\}\{(\d+)\} of the height it fell\. Assume it keeps bouncing forever\. What is the total distance the ball travels, counting every fall and every rise, in meters\?', prompt)):
        h, r = Fraction(int(m[1])), Fraction(int(m[2]), int(m[3]))
        require(0 < r < 1, 'Bounce ratio must be a proper fraction')
        total = h + 2 * h * r / (1 - r)
    elif (m := re.fullmatch(r'(?:Find|What is) the sum of the infinite geometric series (.*?)\s*\+\s*\\cdots[.?]', prompt)):
        shown = series_terms(m[1])
        require(len(shown) >= 3 and shown[0] != 0, 'At least three terms are needed to show a ratio')
        ratios = {shown[i + 1] / shown[i] for i in range(len(shown) - 1)}
        require(len(ratios) == 1, 'Shown terms must be geometric')
        r = ratios.pop()
        total = shown[0] / (1 - r) if abs(r) < 1 else None
    elif (m := re.fullmatch(r'Find the sum \\displaystyle\\sum_\{k=(\d+)\}\^\{\\infty\}(\d+)\((-?\\frac\{\d+\}\{\d+\})\)\^\{(k(?:-1)?)\}\.', prompt)):
        start, a, r, exponent = int(m[1]), Fraction(int(m[2])), tex_eval(m[3]), m[4]
        first = start - (1 if exponent == 'k-1' else 0)
        require(first in (0, 1), 'Unexpected index offset')
        total = a * r ** first / (1 - r) if abs(r) < 1 else None
    else:
        raise ValueError('Unrecognised infinite-series prompt')
    correct, keys = [], []
    for label in labels:
        text = plain(label)
        if text == 'The series has no finite sum':
            got = 'none'
        else:
            got = tex_eval(text)
        keys.append(got)
        correct.append(got == ('none' if total is None else total))
    return finish(public, correct, keys)


def parse_interval_set(label):
    """Return a membership test for a union of intervals and singletons written in interval notation."""
    text = squash(label)
    pieces = text.split('\\cup')
    parsed = []
    for piece in pieces:
        if (m := re.fullmatch(r'\\\{(-?\d+)\\\}', piece)):
            parsed.append(('point', Fraction(int(m[1]))))
        elif (m := re.fullmatch(r'([\[(])(-\\infty|-?\d+),(\\infty|-?\d+)([\])])', piece)):
            lo = -INF if m[2] == '-\\infty' else Fraction(int(m[2]))
            hi = INF if m[3] == '\\infty' else Fraction(int(m[3]))
            require(m[1] == '(' or lo != -INF, 'Infinity cannot be closed')
            require(m[4] == ')' or hi != INF, 'Infinity cannot be closed')
            require(lo < hi, f'Empty or reversed interval: {piece}')
            parsed.append(('range', lo, m[1] == '[', hi, m[4] == ']'))
        else:
            raise ValueError(f'Unreadable interval notation: {label}')
    endpoints = {Fraction(p[1]) for p in parsed if p[0] == 'point'}
    for p in parsed:
        if p[0] == 'range':
            endpoints |= {v for v in (p[1], p[3]) if v not in (INF, -INF)}

    def member(x):
        for p in parsed:
            if p[0] == 'point' and x == p[1]:
                return True
            if p[0] == 'range':
                _, lo, lo_c, hi, hi_c = p
                if (x > lo or (lo_c and x == lo)) and (x < hi or (hi_c and x == hi)):
                    return True
        return False
    return member, endpoints


def inequality_choices(public, truth, roots):
    labels = [o['label'] for o in options_of(public)]
    members, points = [], set(roots)
    for label in labels:
        member, endpoints = parse_interval_set(label)
        members.append(member)
        points |= endpoints
    ordered = sorted(points)
    probes = set(ordered) | {ordered[0] - 1, ordered[-1] + 1}
    probes |= {(a + b) / 2 for a, b in zip(ordered, ordered[1:])}
    probes |= {a + Fraction(1, 1000) for a in ordered} | {a - Fraction(1, 1000) for a in ordered}
    probes = sorted(probes)
    signatures = [tuple(member(x) for x in probes) for member in members]
    expected = tuple(truth(x) for x in probes)
    return finish(public, [sig == expected for sig in signatures], signatures)


RELATIONS = {
    '>': lambda v: v > 0,
    '<': lambda v: v < 0,
    '\\ge': lambda v: v >= 0,
    '\\le': lambda v: v <= 0,
}


def relation_of(text):
    for key in ('\\ge', '\\le', '>', '<'):
        if text.endswith(key + '0'):
            return key, text[:-len(key) - 1]
    raise ValueError(f'Inequality against zero expected: {text}')


def solve_poly_ineq(public):
    prompt = plain(public['prompt'])
    m = re.fullmatch(r'Solve (.*)\. Write the solution in interval notation\.', prompt)
    require(m is not None, 'Unrecognised polynomial-inequality prompt')
    relation, left = relation_of(squash(m[1]))
    test = RELATIONS[relation]
    def value(x):
        return tex_eval(left, x=x)
    roots = {Fraction(n) for n in range(-40, 41) if value(Fraction(n)) == 0}
    return inequality_choices(public, lambda x: test(value(x)), roots)


def solve_rational_ineq(public):
    prompt = plain(public['prompt'])
    m = re.fullmatch(r'Solve \\frac\{(.*?)\}\{(.*?)\}(\\ge|\\le|>|<)0\. Write the solution in interval notation\.', prompt)
    require(m is not None, 'Unrecognised rational-inequality prompt')
    test = RELATIONS[m[3]]
    roots = {Fraction(n) for n in range(-40, 41) if tex_eval(m[1], x=Fraction(n)) == 0 or tex_eval(m[2], x=Fraction(n)) == 0}

    def truth(x):
        denominator = tex_eval(m[2], x=x)
        if denominator == 0:
            return False  # undefined points are never in the solution set
        return test(tex_eval(m[1], x=x) / denominator)
    return inequality_choices(public, truth, roots)


SOLVERS = {}
for _ids, _fn in (
    (LINE_FORMS, solve_line_forms), (LINE_RELATION, solve_line_relation), (SYSTEM_CHOICE, solve_system_choice),
    (GRAPH_ESTIMATE, solve_graph_estimate), (EXP_DOMAIN, solve_exp_domain), (ABS_FORMULATE, solve_abs_formulate),
    (RATIONAL_FORMULATE, solve_rational_formulate), (RATIONAL_EXPONENT, solve_rational_exponent),
    (TRANSFORM_IMAGE, solve_transformation), (COUNTEREXAMPLE, solve_counterexample), (SPHERICAL, solve_spherical),
    (POLYGON_AREA, solve_polygon_area), (CURVED_SURFACE, solve_curved_surface), (AREA_PROBABILITY, solve_area_probability),
    (COMPOSITION_ORDER, solve_composition), (ONE_SIDED, solve_one_sided), (PARAMETRIC, solve_parametric),
    (ANGULAR, solve_angular), (REFERENCE_ANGLE, solve_reference_angle), (BEARING, solve_bearing), (SIGMA, solve_sigma),
    (INFINITE_SUM, solve_infinite_sum), (POLY_INEQ, solve_poly_ineq), (RATIONAL_INEQ, solve_rational_ineq),
):
    for _id in _ids:
        SOLVERS[_id] = _fn


def solve(public):
    template = public['templateId']
    require(template in SUPPORTED, 'Unexpected Texas high-school family')
    return SOLVERS[template](public)


def label_text(problem, option_id):
    for option in problem['public']['response']['options']:
        if option['id'] == option_id:
            return option['label']
    raise ValueError('Unknown option id')


def substantial(key):
    return len(key) >= 8 and re.search(r'[=<>:|,]|cup', key) is not None


def check_no_leakage(problem):
    """The prompt and hint must not state the keyed choice verbatim."""
    key = squash(label_text(problem, problem['answer']))
    if not substantial(key):
        return  # bare numbers and measures occur naturally in a prompt; only whole statements can leak
    for field in ('prompt',):
        require(key not in squash(problem['public'][field]), f'{field} leaks the keyed choice')
    hint = problem.get('hint')
    if hint:
        require(key not in squash(hint), 'Hint leaks the keyed choice')
    feedback = problem.get('choiceFeedback') or {}
    require(problem['answer'] not in feedback, 'The keyed choice must not carry wrong-answer feedback')


def review_problem(problem):
    result = solve(problem['public'])
    require(result == problem['answer'], 'Texas high-school answer key mismatch')
    check_no_leakage(problem)
    return result


# ---------------------------------------------------------------- self test

def _fixture(template, prompt, labels, answer, figure=None, hint=None):
    options = [{'id': f'option-{c}', 'label': label} for c, label in zip('abcd', labels)]
    public = {
        'templateId': template, 'prompt': prompt,
        'response': {'kind': 'choice', 'label': 'Choose one answer', 'options': options},
    }
    if figure:
        public['figure'] = figure
    return {'public': public, 'answer': f'option-{answer}', 'hint': hint or 'Work from the givens.', 'choiceFeedback': {}}


def _graph(m1, b1, m2, b2, x=(0, 6), y=(0, 32)):
    return {'kind': 'scene', 'scene': {'v': 1, 'elements': [{'id': 'g', 'type': 'graph', 'x': list(x), 'y': list(y), 'grid': 1, 'tick': 2, 'lines': [{'line': {'m': m1, 'b': b1}}, {'line': {'m': m2, 'b': b2}}]}]}}


FIXTURES = [
    _fixture('line-equation-forms', 'A line passes through $(-3, 12)$ and $(0, 3)$. Which equation, written with the point $(0, 3)$, is in point-slope form?',
             ['$y - 3=-\\frac{1}{3}(x - 0)$', '$y - 3=3(x - 0)$', '$y - 3=-3(x - 0)$', '$y - 3=\\frac{1}{3}(x - 0)$'], 'c'),
    _fixture('line-equation-forms', 'A line is $y=-\\frac{2}{3}x + 4$. Which equation is an equivalent standard form, $Ax+By=C$ with integer coefficients and no common factor?',
             ['$2x - 3y=-12$', '$2x + 3y=4$', '$2x + 3y=12$', '$2x + 3y=-12$'], 'c'),
    _fixture('line-relationship-equations', 'Which equation is the line through $(4, 3)$ that is perpendicular to $y=-4x - 5$?',
             ['$y=\\frac{1}{4}x + 2$', '$y=4x - 13$', '$y=-4x + 19$', '$y=\\frac{1}{4}x - 2$'], 'a'),
    _fixture('line-relationship-equations', 'Which equation is the line through $(7, 5)$ that is parallel to $y=-5$?',
             ['$x=7$', '$y=7$', '$y=5$', '$y=-5$'], 'c'),
    _fixture('system-equation-choice', 'A theater sold 22 tickets for 163 dollars. Adult tickets cost 9 dollars and child tickets cost 4 dollars. Let $x$ be the number of adult tickets and $y$ the number of child tickets. Which system models the sales?',
             ['$x+y=22\\text{ and }9x+4y=163$', '$x+y=163\\text{ and }9x+4y=22$', '$x+y=22\\text{ and }4x+9y=163$', '$x+y=22\\text{ and }9x+4y=22$'], 'a'),
    _fixture('graph-estimate-system-solution', 'The graph shows the total cost in dollars $y$ of Plan A and Plan B after $x$ months. Which ordered pair $(x, y)$ best estimates when the two costs are equal and what that amount is?',
             ['$(2.5, 12)$', '$(0, 2)$', '$(12, 2.5)$', '$(4, 12)$'], 'a', _graph(4, 2, 2, 7)),
    _fixture('exponential-domain-range', 'What are the domain and range of $f(x)=-3\\left(3\\right)^x + 3$, written as inequalities?',
             ['Domain $x>0$; range $y<3$', 'Domain $-\\infty<x<\\infty$; range $y<3$', 'Domain $-\\infty<x<\\infty$; range $y>3$', 'Domain $-\\infty<x<\\infty$; range $y\\le3$'], 'b'),
    _fixture('absolute-value-equation-formulate', 'An absolute value equation has the two solutions $x=-5$ and $x=-1$. Which equation has exactly these solutions?',
             ['$\\left|x\\right|=-1$', '$\\left|x - 3\\right|=2$', '$\\left|x + 3\\right|=2$', '$\\left|x - 2\\right|=3$'], 'c'),
    _fixture('rational-equation-formulate', 'A boat travels 24 miles downstream in the same time it takes to travel 18 miles upstream. The current flows at 2 miles per hour. Let $x$ be the boat\'s speed in still water, in miles per hour. Which equation models this?',
             ['$\\frac{24}{x}+2=\\frac{18}{x}-2$', '$\\frac{24}{x+2}=\\frac{18}{x-2}$', '$\\frac{24}{x-2}=\\frac{18}{x+2}$', '$\\frac{24}{x+2}=\\frac{18}{x}$'], 'b'),
    _fixture('rational-exponent-equation', 'Solve $x^{\\frac{4}{3}}=16$ for all real $x$.',
             ['$x=2$', '$x=-8$ or $x=8$', '$x=12$', '$x=16$'], 'b'),
    _fixture('transformation-composition-image', 'Point $A=(-2, 2)$ is dilated with center $(-2, -4)$ and scale factor $\\frac12$, and then its image is rotated $180^\\circ$ about the origin. What are the coordinates of the final image of $A$?',
             ['$(1, -1)$', '$(2, 1)$', '$(2, -1)$', '$(0, -3)$'], 'b'),
    _fixture('counterexample-choice', 'Conjecture: If two sides and an angle that is not between them in one triangle are congruent to the matching parts of another triangle, then the triangles are congruent. In each choice, triangle $ABC$ has the given angle $A$ and sides $AC$ and $BC$ ($BC$ is opposite angle $A$). Which choice describes a counterexample?',
             ['$\\angle A=30^\\circ$, $AC=10$ and $BC=10$', '$\\angle A=30^\\circ$, $AC=10$ and $BC=6$', '$\\angle A=30^\\circ$, $AC=10$ and $BC=5$', '$\\angle A=30^\\circ$, $AC=10$ and $BC=12$'], 'b'),
    _fixture('spherical-geometry-compare', 'On a sphere, a "line" is a great circle: a circle whose center is the center of the sphere, such as the equator. What is the greatest number of right angles a triangle can have in the plane and on the sphere?',
             ['Plane: two. Sphere: three.', 'Plane: one. Sphere: three.', 'Plane: one. Sphere: one.', 'Plane: three. Sphere: one.'], 'b'),
    _fixture('regular-polygon-area', 'A square has an apothem of 9 cm. What is its area in square centimeters?',
             ['$81$', '$324$', '$162$', '$648$'], 'b'),
    _fixture('curved-solid-surface-area', 'A closed cone has a base radius of 9 cm and a height of 12 cm. What is its total surface area, including the base?',
             ['$135\\pi\\text{ cm}^2$', '$432\\pi\\text{ cm}^2$', '$216\\pi\\text{ cm}^2$', '$189\\pi\\text{ cm}^2$'], 'c'),
    _fixture('area-probability', 'A circular target has radius 6 cm. Its center is a circle of radius 4 cm, and the ring around it is shaded. A dart lands at a random point on the target. What is the probability that it lands in the shaded ring? Give a fraction in simplest form.',
             ['$\\frac{5}{9}$', '$\\frac{4}{9}$', '$\\frac{5\\pi}{9}$', '$\\frac{1}{3}$'], 'a'),
    _fixture('composition-order-choice', 'Let $f(x)=3x$ and $g(x)=4x$. Which statement about $f(g(x))$ and $g(f(x))$ is true?',
             ['$f(g(x))=g(f(x))=12x$, so composition is commutative for every pair of functions', '$f(g(x))=g(f(x))=12x$, so for these two functions the order does not matter', '$f(g(x))=12x$ and $g(f(x))=12x^2$, so the order matters', '$f(g(x))=g(f(x))=12x^2$, so the order does not matter'], 'b'),
    _fixture('one-sided-behavior-choice', 'For $f(x)=\\dfrac{2(x - 5)}{(x + 3)^2(x - 2)}$, there is a vertical asymptote at $x=-3$. Which statement describes $f(x)$ as $x$ approaches -3 from the left and from the right?',
             ['$x\\to-3^-:\\ f(x)\\to-\\infty;\\quad x\\to-3^+:\\ f(x)\\to-\\infty$', '$x\\to-3^-:\\ f(x)\\to\\infty;\\quad x\\to-3^+:\\ f(x)\\to-\\infty$', '$x\\to-3^-:\\ f(x)\\to-\\infty;\\quad x\\to-3^+:\\ f(x)\\to\\infty$', '$x\\to-3^-:\\ f(x)\\to\\infty;\\quad x\\to-3^+:\\ f(x)\\to\\infty$'], 'd'),
    _fixture('parametric-rectangular-convert', 'A line has the rectangular equation $y=-3x + 5$. Which pair of parametric equations describes this line, using $x=2t - 2$?',
             ['$x=2t - 2\\text{ and }y=-3t + 11$', '$x=2t - 2\\text{ and }y=-6t - 1$', '$x=2t - 2\\text{ and }y=-6t + 11$', '$x=2t - 2\\text{ and }y=-6t + 5$'], 'c'),
    _fixture('angular-velocity-problem', 'A fan turns at 30 revolutions per minute. What is its angular speed in radians per second?',
             ['$\\frac{1}{2}\\text{ rev/s}$', '$\\frac{\\pi}{2}\\text{ rad/s}$', '$60\\pi\\text{ rad/s}$', '$\\pi\\text{ rad/s}$'], 'd'),
    _fixture('reference-angle-standard-position', 'What is the reference angle of $-420^\\circ$, the acute angle between the terminal side and the $x$-axis, when the angle is in standard position?',
             ['$300^\\circ$', '$-420^\\circ$', '$60^\\circ$', '$30^\\circ$'], 'c'),
    _fixture('bearing-trig-problem', 'A hiker starts at a trailhead, walks 9 km due north, and then $9\\sqrt{3}$ km due west. A three-digit bearing is the angle measured clockwise from north. What is the bearing of the hiker from the trailhead?',
             ['$120^\\circ$', '$330^\\circ$', '$300^\\circ$', '$060^\\circ$'], 'c'),
    _fixture('sigma-notation-represent', 'Which sigma notation represents the series $-5 - 3 - 1 + \\cdots + 7$, which has 7 terms?',
             ['$\\sum_{k=1}^{7}\\left(-5+2(k-1)\\right)$', '$\\sum_{k=0}^{7}\\left(-5+2k\\right)$', '$\\sum_{k=1}^{6}\\left(2k - 7\\right)$', '$\\sum_{k=1}^{7}\\left(2k - 5\\right)$'], 'a'),
    _fixture('infinite-geometric-sum', 'What is the sum of the infinite geometric series $-3 + 3 - 3 + 3 + \\cdots$?',
             ['The series has no finite sum', '$-\\dfrac{3}{2}$', '$0$', '$\\dfrac{3}{2}$'], 'a'),
    _fixture('polynomial-inequality-solve', 'Solve $(x + 3)(x + 2)^2(x - 5)\\ge0$. Write the solution in interval notation.',
             ['$(-\\infty,-3)\\cup(5,\\infty)$', '$(-3,-2)\\cup(-2,5)$', '$[-3,5]$', '$(-\\infty,-3]\\cup\\{-2\\}\\cup[5,\\infty)$'], 'd'),
    _fixture('rational-inequality-solve', 'Solve $\\dfrac{(x - 1)(x - 4)}{x}\\le0$. Write the solution in interval notation.',
             ['$(0,1]\\cup[4,\\infty)$', '$(-\\infty,0]\\cup[1,4]$', '$(-\\infty,0)\\cup(1,4)$', '$(-\\infty,0)\\cup[1,4]$'], 'd'),
]


def self_test():
    covered = {fixture['public']['templateId'] for fixture in FIXTURES}
    require(covered == SUPPORTED, 'Every Texas template needs a fixture')
    rejected = 0

    def reject(problem, why):
        nonlocal rejected
        try:
            review_problem(problem)
        except (ValueError, KeyError, ZeroDivisionError, TypeError):
            rejected += 1
            return
        raise AssertionError(f'Texas oracle accepted a corrupted case: {why}')

    for fixture in FIXTURES:
        template = fixture['public']['templateId']
        review_problem(fixture)
        for letter in 'abcd':
            if f'option-{letter}' == fixture['answer']:
                continue
            wrong = copy.deepcopy(fixture)
            wrong['answer'] = f'option-{letter}'
            reject(wrong, f'{template} wrong key {letter}')
        duplicate = copy.deepcopy(fixture)
        options = duplicate['public']['response']['options']
        wrong_index = next(i for i, o in enumerate(options) if o['id'] != fixture['answer'])
        options[wrong_index]['label'] = next(o['label'] for o in options if o['id'] == fixture['answer'])
        reject(duplicate, f'{template} duplicate of the keyed choice')
        if substantial(squash(label_text(fixture, fixture['answer']))):
            leaky = copy.deepcopy(fixture)
            leaky['hint'] = 'The answer is ' + label_text(fixture, fixture['answer'])
            reject(leaky, f'{template} hint leak')
    # Boundary variants the random exports may not reach.
    boat = 'A boat travels 24 miles downstream in the same time it takes to travel 18 miles upstream. The current flows at 2 miles per hour. Let $x$ be the boat\'s speed in still water, in miles per hour. Which equation models this?'
    reject(_fixture('rational-equation-formulate', boat, ['$\\frac{24}{x}+2=\\frac{18}{x}-2$', '$\\frac{24}{x+2}=\\frac{18}{x-2}$', '$\\frac{24}{x-2}=\\frac{18}{x+2}$', '$\\frac{x+2}{24}=\\frac{x-2}{18}$'], 'b'), 'reciprocal equation is also correct')
    reject(_fixture('rational-equation-formulate', 'A driver travels 60 miles at $x$ miles per hour, then 60 more miles at 10 miles per hour faster. The whole trip takes 3 hours. Which equation models this?', ['$\\frac{60}{x+10}+\\frac{60}{x}=3$', '$\\frac{60}{x}+\\frac{60}{x}+10=3$', '$\\frac{60}{x}+\\frac{60}{x+10}=3$', '$60x+60(x+10)=3$'], 'c'), 'swapped legs are the same equation')
    reject(_fixture('line-relationship-equations', 'Which equation is the line through $(1, -1)$ that is parallel to $y=x - 2$?', ['$y=x - 1$', '$y=x$', '$y=x - 2$', '$y=-x$'], 'c'), 'parallel line through a point on the given line')
    reject(_fixture('spherical-geometry-compare', 'On a sphere, a "line" is a great circle: a circle whose center is the center of the sphere, such as the equator. A triangle on the sphere is bounded by three arcs of great circles. Which could be the three angle measures of such a triangle?', ['Three angles of $55^\\circ$ each', 'Three angles of $60^\\circ$ each', 'Angles of $55^\\circ$, $65^\\circ$ and $75^\\circ$', 'Three angles of $120^\\circ$ each'], 'd'), 'second valid spherical triangle')
    reject(_fixture('system-equation-choice', 'A theater sold 22 tickets for 163 dollars. Adult tickets cost 9 dollars and child tickets cost 4 dollars. Let $x$ be the number of adult tickets and $y$ the number of child tickets. Which system models the sales?', ['$x+y=22\\text{ and }9x+4y=163$', '$x+y=163\\text{ and }9x+4y=22$', '$x+y=22\\text{ and }4x+9y=163$', '$9x+4y=22\\text{ and }x+y=163$'], 'a'), 'swapped equations repeat a choice')
    reject(_fixture('graph-estimate-system-solution', 'The graph shows the total cost in dollars $y$ of Plan A and Plan B after $x$ months. Which ordered pair $(x, y)$ best estimates when the two costs are equal and what that amount is?', ['$(2, 12)$', '$(0, 2)$', '$(12, 2.5)$', '$(3, 12)$'], 'a', _graph(4, 2, 2, 7)), 'two estimates equally near the crossing')
    review_problem(_fixture('infinite-geometric-sum', 'Find the sum of the infinite geometric series $4 - 2 + 1+\\cdots$.', ['The series has no finite sum', '$\\dfrac{8}{3}$', '$8$', '$-\\dfrac{4}{3}$'], 'b'))
    reject(_fixture('infinite-geometric-sum', 'Find the sum of the infinite geometric series $2 + 4 + 8+\\cdots$.', ['The series has no finite sum', '$\\dfrac{8}{3}$', '$8$', '$-\\dfrac{4}{3}$'], 'b'), 'divergent ratio keyed to a sum')
    review_problem(_fixture('infinite-geometric-sum', 'Find the sum of the infinite geometric series $2 + 4 + 8+\\cdots$.', ['The series has no finite sum', '$\\dfrac{8}{3}$', '$8$', '$-\\dfrac{4}{3}$'], 'a'))
    reject(_fixture('rational-inequality-solve', 'Solve $\\dfrac{x + 3}{(x - 2)^2}>0$. Write the solution in interval notation.', ['$(-3,2)\\cup(2,\\infty)$', '$[-3,2)\\cup(2,\\infty)$', '$(-\\infty,-3]$', '$(-3,\\infty)$'], 'd'), 'excluded pole kept in answer')
    review_problem(_fixture('rational-inequality-solve', 'Solve $\\dfrac{x + 3}{(x - 2)^2}>0$. Write the solution in interval notation.', ['$(-3,2)\\cup(2,\\infty)$', '$[-3,2)\\cup(2,\\infty)$', '$(-\\infty,-3]$', '$(-3,\\infty)$'], 'a'))
    require(rejected >= len(FIXTURES) * 4, 'Texas oracle self-test did not exercise enough corrupted cases')


# Read by independent-math-review.py (FamilyOracle).
CHOICE_REVIEW = SUPPORTED
