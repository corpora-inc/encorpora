"""Independent prompt- and figure-only checks for Algebra 1 two-variable work.

Systems are solved by Cramer's rule with Fractions; regions are compared
point by point on a lattice that includes boundary points; literal
equations and inequalities are tested at random parameter values that meet
the stated condition; each equation step is classified by comparing the two
lines as linear functions of x. Nothing here calls the TypeScript generators,
and malformed or inconsistent givens are rejected.
"""
import copy
import json
import random
import re
import subprocess
from fractions import Fraction
from pathlib import Path

from algebra_one_expr import evaluate, holds, number, parse, require, solve_linear
from linear_function_math_oracle import arithmetic_claims, options, only, graph_of, case, choice, scene

TWO_VARIABLE_NUMBER = frozenset({'system-model-value', 'parameter-solution-count'})
TWO_VARIABLE_CHOICE = frozenset({
    'constraint-feasible', 'half-plane-inequality', 'inequality-solution-point', 'literal-equation-solve',
    'equation-step-property', 'elimination-equivalent',
})
TWO_VARIABLE = TWO_VARIABLE_NUMBER | TWO_VARIABLE_CHOICE
N = r'(−?\d+)'
OPS = {'<': lambda a, b: a < b, '≤': lambda a, b: a <= b, '>': lambda a, b: a > b, '≥': lambda a, b: a >= b,
       '<=': lambda a, b: a <= b, '>=': lambda a, b: a >= b}


def cramer(a1, b1, c1, a2, b2, c2):
    det = a1 * b2 - a2 * b1
    require(det != 0, 'The system has no unique solution')
    return Fraction(c1 * b2 - c2 * b1, det), Fraction(a1 * c2 - a2 * c1, det)


def linear2(text):
    """'2x − 3y' (or with a constant) to (a, b, c) with a·x + b·y + c."""
    node = parse(text)
    f = lambda x, y: evaluate(node, {'x': Fraction(x), 'y': Fraction(y)})
    c = f(0, 0)
    a, b = f(1, 0) - c, f(0, 1) - c
    require(f(2, 3) == 2 * a + 3 * b + c, 'Not linear: ' + text)
    return a, b, c


def relation(text):
    """'y ≤ 2x − 1' to a predicate on (x, y)."""
    m = re.fullmatch(r'(.+?) (<|>|≤|≥) (.+)', text)
    require(m is not None, 'Not an inequality: ' + text)
    left, right = parse(m[1]), parse(m[3])
    op = OPS[m[2]]
    return lambda x, y: op(evaluate(left, {'x': x, 'y': y}), evaluate(right, {'x': x, 'y': y}))


LATTICE = [(Fraction(x, 2), Fraction(y, 2)) for x in range(-24, 25) for y in range(-24, 25)]


# ------------------------------------------------------------ models
def solve_system_model(public):
    p = public['prompt']
    stories = [
        (r'A theater sold (\d+) tickets for (\d+) dollars?\. Adult tickets cost (\d+) dollars? and child tickets cost (\d+) dollars?\. How many (adult|child) tickets were sold\?', ('adult', 'child')),
        (r'A bouquet of (\d+) roses and tulips costs (\d+) dollars?\. Roses cost (\d+) dollars? each and tulips cost (\d+) dollars? each\. How many (roses|tulips) are in it\?', ('roses', 'tulips')),
        (r'A test has (\d+) questions, each worth (?P<pa>\d+) points or (?P<pb>\d+) points, for (?P<v>\d+) points in all\. How many (?P<ask>\d+)-point questions are on it\?', None),
        (r'A jar holds (\d+) coins, all quarters and dimes, worth (\d+) cents in all\. How many (quarters|dimes) are in it\?', ('quarters', 'dimes')),
    ]
    for pattern, names in stories:
        m = re.fullmatch(pattern, p)
        if not m:
            continue
        if names is None:
            total, pa, pb, value = int(m[1]), int(m['pa']), int(m['pb']), int(m['v'])
            first = int(m['ask']) == pa
            require(int(m['ask']) in (pa, pb), 'Asked type not on the test')
        elif names[0] == 'quarters':
            total, value, pa, pb = int(m[1]), int(m[2]), 25, 10
            first = m[3] == 'quarters'
        else:
            total, value, pa, pb = int(m[1]), int(m[2]), int(m[3]), int(m[4])
            first = m[5] == names[0]
        a, b = cramer(1, 1, total, pa, pb, value)
        require(a.denominator == 1 and b.denominator == 1 and a >= 0 and b >= 0, 'Counts must be whole')
        return a if first else b
    raise ValueError('Unrecognized two-unknown story')


def solve_constraint(public):
    m = re.search(r'The shaded region shows x \+ y ≤ (\d+) and (\d+)x \+ (\d+)y ≥ (\d+)\. Which \(x, y\) meets both conditions\?$', public['prompt'])
    require(m is not None, 'Unrecognized constraint prompt')
    cap, p1, p2, goal = (int(v) for v in m.groups())
    story = re.search(r'at (\d+) dollars?', public['prompt'])
    require(story is not None, 'Story prices')
    region = graph_of(public)['regions'][0]['halfPlanes']
    want = [(1, 1, cap, '<='), (p1, p2, goal, '>='), (1, 0, 0, '>='), (0, 1, 0, '>=')]
    require(sorted((h['a'], h['b'], h['c'], h['op']) for h in region) == sorted(want), 'Shaded region differs from the constraints')
    def ok(label):
        x, y = (number(v) for v in re.fullmatch(r'\((\d+), (\d+)\)', label).groups())
        return x + y <= cap and p1 * x + p2 * y >= goal
    return only(public, ok)


# ------------------------------------------------------------ regions
def figure_region(public):
    g = graph_of(public)
    require(len(g['regions']) == 1, 'One shaded region')
    halves = g['regions'][0]['halfPlanes']
    return lambda x, y: all(OPS[h['op']](h['a'] * x + h['b'] * y, h['c']) for h in halves)


def solve_half_plane(public):
    require(public['prompt'] in ('Which inequality does the shaded region show?', 'Which system of inequalities does the shaded region show?'), 'Unrecognized region prompt')
    shaded = figure_region(public)
    truth = [shaded(x, y) for x, y in LATTICE]

    def same(label):
        parts = [relation(t) for t in label.split(' and ')]
        return all((all(f(x, y) for f in parts)) == t for (x, y), t in zip(LATTICE, truth))
    return only(public, same)


def solve_solution_point(public):
    m = re.fullmatch(r'Which point is a solution of (.+)\? The graph shows the boundary line and the four points\.', public['prompt'])
    require(m is not None, 'Unrecognized point prompt')
    test = relation(m[1])
    g = graph_of(public)
    line = g['lines'][0]
    strict = re.search(r' (<|>) ', m[1]) is not None
    require((line.get('dash') == 'dash') == strict, 'Dashed exactly when the inequality is strict')
    # The four options are drawn unlabeled; a labeled point is the test point.
    drawn = {(Fraction(str(p['x'])), Fraction(str(p['y']))) for p in g['points'] if not p.get('label')}
    tests = [p for p in g['points'] if p.get('label')]
    require(len(tests) == 1, 'One test point')
    shaded = g['regions'][0]['halfPlanes'][0]
    require(all(OPS[shaded['op']](shaded['a'] * x + shaded['b'] * y, shaded['c']) == test(x, y) for x, y in LATTICE), 'The walkthrough shades the solutions')
    pts = {}
    for oid, label in options(public):
        x, y = (number(v) for v in re.fullmatch(r'\(' + N + ', ' + N + r'\)', label).groups())
        pts[oid] = (x, y)
    require(drawn == set(pts.values()), 'The figure shows the four options')
    return only(public, lambda label: test(*next(v for k, v in pts.items() if dict(options(public))[k] == label)))


# ------------------------------------------------------------ literal equations
def solve_literal(public):
    p = public['prompt']
    m = re.fullmatch(r'Solve (.+) for x, where ([a-z]) ≠ ' + N + r'\.', p)
    rng = random.Random(p)
    if m:
        eq, k, bad = m[1], m[2], number(m[3])
        values = [v for v in (Fraction(rng.randint(-30, 30), rng.randint(1, 4)) for _ in range(12)) if v != bad][:6]
        def right(label):
            lm = re.fullmatch(r'x = (.+)', label)
            require(lm is not None, 'Option must solve for x')
            try:
                return all(holds(eq, {k: v, 'x': evaluate(lm[1], {k: v})}) for v in values)
            except ValueError:
                return False
        return only(public, right)
    m = re.fullmatch(r'If ([a-z]) (>|<) 0, solve (.+) for x\.', p)
    require(m is not None, 'Unrecognized literal prompt')
    k, sign, ineq = m[1], m[2], m[3]
    values = [Fraction(rng.randint(1, 30), rng.randint(1, 4)) * (1 if sign == '>' else -1) for _ in range(6)]
    def right(label):
        lm = re.fullmatch(r'x (<|>|≤|≥) (.+)', label)
        require(lm is not None, 'Option must bound x')
        for v in values:
            b = evaluate(lm[2], {k: v})
            test = OPS[lm[1]]
            edge = solve_linear(re.sub(r' (<|>|≤|≥) ', ' = ', ineq), 'x', {k: v})
            near = (Fraction(0), Fraction(1, 7), Fraction(-1, 7), Fraction(1), Fraction(-1), Fraction(9), Fraction(-9))
            for x in [b + d for d in near] + [edge + d for d in near]:
                if test(x, b) != eval_ineq(ineq, k, v, x):
                    return False
        return True
    return only(public, right)


def eval_ineq(text, k, v, x):
    m = re.fullmatch(r'(.+?) (<|>|≤|≥) (.+)', text)
    return OPS[m[2]](evaluate(m[1], {k: v, 'x': x}), evaluate(m[3], {k: v, 'x': x}))


def solution_count(text, env):
    """0, 1 or 'all' for a linear equation in x."""
    left, right = text.split(' = ')
    g = lambda x: evaluate(left, dict(env, x=x)) - evaluate(right, dict(env, x=x))
    slope, const = g(1) - g(0), g(0)
    require(g(2) - g(1) == slope, 'Not linear in x')
    if slope != 0:
        return 1
    return 'all' if const == 0 else 0


def solve_parameter(public):
    p = public['prompt']
    m = re.fullmatch(r'For what value of ([a-z]) does the equation (.+) have (no solution|infinitely many solutions)\?', p)
    if m:
        want = 0 if m[3] == 'no solution' else 'all'
        hits = [Fraction(v) for v in range(-60, 61) if solution_count(m[2], {m[1]: Fraction(v)}) == want]
        require(len(hits) == 1, f'Expected one parameter value, found {hits}')
        return hits[0]
    m = re.fullmatch(r'For what value of k does the system (.+) = ' + N + ' and (.+) = ' + N + r' have no solution\?', p)
    require(m is not None, 'Unrecognized parameter prompt')
    hits = []
    for v in range(-60, 61):
        a1, b1, z1 = linear2(m[1].replace('k', f'({v})'))
        a2, b2, z2 = linear2(m[3])
        require(z1 == 0 and z2 == 0, 'Constants belong on the right')
        c1, c2 = number(m[2]), number(m[4])
        if a1 * b2 - a2 * b1 == 0:
            # Parallel: no solution unless the equations are multiples.
            t = b1 / b2 if b2 else a1 / a2
            if c1 != t * c2:
                hits.append(Fraction(v))
    require(len(hits) == 1, f'Expected one k, found {hits}')
    return hits[0]


# ------------------------------------------------------------ equation reasoning
PROPERTY = {
    'distribute': 'Distributive property', 'add': 'Addition property of equality',
    'subtract': 'Subtraction property of equality', 'multiply': 'Multiplication property of equality',
    'divide': 'Division property of equality', 'combine': 'Combining like terms',
}


def sides(line):
    left, right = line.split(' = ')
    lf, rf = parse(left), parse(right)
    lin = lambda node: (evaluate(node, {'x': Fraction(1)}) - evaluate(node, {'x': Fraction(0)}), evaluate(node, {'x': Fraction(0)}))
    return lin(lf), lin(rf), left, right


def classify(prev, nxt):
    (pl, pr, pls, prs), (nl, nr, nls, nrs) = sides(prev), sides(nxt)
    if pl == nl and pr == nr:
        changed = pls if pls != nls else prs
        return 'distribute' if '(' in changed else 'combine'
    dl = (nl[0] - pl[0], nl[1] - pl[1])
    dr = (nr[0] - pr[0], nr[1] - pr[1])
    if dl == dr:
        # The same term on both sides: a positive amount is added.
        lead = dl[0] if dl[0] != 0 else dl[1]
        return 'add' if lead > 0 else 'subtract'
    for f in (Fraction(k) for k in range(2, 31)):
        if nl == (pl[0] * f, pl[1] * f) and nr == (pr[0] * f, pr[1] * f):
            return 'multiply'
        if nl == (pl[0] / f, pl[1] / f) and nr == (pr[0] / f, pr[1] / f):
            return 'divide'
    raise ValueError(f'Step from {prev} to {nxt} is not an equality-preserving move')


def root(line):
    (l, r_, _, _) = sides(line)[0], sides(line)[1], None, None
    a, c = l[0] - r_[0], r_[1] - l[1]
    require(a != 0, 'Not a one-solution equation')
    return c / a


def table_rows(public):
    figure = public['figure']['scene']
    t = [e for e in figure['elements'] if e['type'] == 'lineTable'][0]
    cell = lambda c: c if isinstance(c, str) else c['text']
    return [[cell(c) for c in row] for row in t['rows']]


def solve_step_property(public):
    p = public['prompt']
    rows = table_rows(public)
    m = re.fullmatch(r'The table solves (.+) one step at a time\. Which reason justifies the step from (.+) to (.+)\?', p)
    if m:
        lines = [r[0] for r in rows]
        require(lines[0] == m[1], 'The table starts at the stated equation')
        i = lines.index(m[3])
        require(lines[i - 1] == m[2] and rows[i][1] == '?', 'The asked step is the masked one')
        for j in range(1, len(lines)):
            kind = classify(lines[j - 1], lines[j])
            if rows[j][1] != '?':
                require(rows[j][1] == PROPERTY[kind], 'A shown reason is wrong: ' + lines[j])
        want = PROPERTY[classify(m[2], m[3])]
        return only(public, lambda label: label == want)
    m = re.fullmatch(r'Each step below should keep (.+) equivalent: Step k turns the line above it into its own line\. Which step contains an error\?', p)
    require(m is not None, 'Unrecognized step prompt')
    lines = [r[1] for r in rows]
    require(lines[0] == m[1], 'The table starts at the stated equation')
    bad = None
    for j in range(1, len(lines)):
        if root(lines[j]) != root(lines[j - 1]):
            bad = j
            break
    require(bad is not None, 'Expected a broken step')
    for j in range(bad + 1, len(lines)):
        require(root(lines[j]) == root(lines[j - 1]), 'Only one step may break the equality')
    return only(public, lambda label: label == f'Step {bad}')


# ------------------------------------------------------------ elimination
def stacked(public):
    rows = table_rows(public)
    eqs = []
    k = Fraction(1)
    for i, row in enumerate(rows[:2]):
        if i == 1 and row[0] != '+':
            km = re.fullmatch(r'\+ ' + N + ' ×', row[0])
            require(km is not None, 'Second row multiplier')
            k = number(km[1])
        eqs.append((linear2(row[1] + ' ' + row[2]), number(row[4])))
    return eqs, k, rows


def eq_of(text):
    left, right = text.split(' = ')
    a, b, c0 = linear2(left)
    require(c0 == 0, 'Constants belong on the right')
    return a, b, number(right)


def solve_elimination(public):
    p = public['prompt']
    (((a1, b1, _), c1), ((a2, b2, _), c2)), k, rows = stacked(public)
    if p.startswith('Add the two equations') or p.startswith('Multiply the second equation by'):
        if p.startswith('Multiply'):
            km = re.match(r'Multiply the second equation by ' + N + r', then add it to the first\. Which equation results\?$', p)
            require(km is not None and number(km[1]) == k, 'Multiplier disagrees with the figure')
        else:
            require(p == 'Add the two equations. Which equation results?' and k == 1, 'Plain sum')
        want = (a1 + k * a2, b1 + k * b2, c1 + k * c2)
        return only(public, lambda label: eq_of(label) == want)
    x, y = cramer(a1, b1, c1, a2, b2, c2)
    if p.startswith('Which system has exactly the same solutions'):
        def same(label):
            e, f = (eq_of(t) for t in label.split(' and '))
            try:
                return cramer(*e, *f) == (x, y)
            except ValueError:
                return False
        return only(public, same)
    m = re.fullmatch(r'The system (.+) and (.+) is replaced by (.+) and (.+), the sum of the two equations\. Why do both systems have the same solutions\?', p)
    require(m is not None, 'Unrecognized elimination prompt')
    e1, e2, keep, total = (eq_of(t) for t in m.groups())
    require(e1 == (a1, b1, c1) and e2 == (a2, b2, c2) and keep == e1, 'Prompt disagrees with the figure')
    require(total == (a1 + a2, b1 + b2, c1 + c2), 'The stated sum is wrong')
    require(tuple(t - u for t, u in zip(total, e1)) == e2, 'Subtracting the first from the sum must give the second')
    return only(public, lambda label: 'gives back the second' in label)


SOLVERS = {
    'system-model-value': solve_system_model,
    'constraint-feasible': solve_constraint,
    'half-plane-inequality': solve_half_plane,
    'inequality-solution-point': solve_solution_point,
    'literal-equation-solve': solve_literal,
    'parameter-solution-count': solve_parameter,
    'equation-step-property': solve_step_property,
    'elimination-equivalent': solve_elimination,
}


def solve_two_variable(public):
    require(public['templateId'] in SOLVERS, 'Not a two-variable template')
    return SOLVERS[public['templateId']](public)


def review_problem(problem):
    public = problem['public']
    template = public['templateId']
    answer = solve_two_variable(public)
    steps = problem['explanation']
    require(len(steps) >= 2 and problem['hint'], 'Explanation or hint missing')
    checked = sum(arithmetic_claims(step) for step in steps)
    if template in TWO_VARIABLE_NUMBER:
        require(checked >= 1, 'Explanation has no checked arithmetic: ' + template)
        shown = str(answer).replace('-', '−')
        require(re.search(r'(?<![\d/])' + re.escape(shown) + r'(?![\d/])', steps[-1]), f'The last step must state the answer {shown}')
    else:
        labels = dict(options(public))
        feedback = problem.get('choiceFeedback') or {}
        require(set(feedback) == set(labels) - {answer}, 'Every wrong option needs feedback')
    return checked


# ------------------------------------------------------------ fixtures
def review_two_variable_fixtures():
    stack = lambda first, second, k='+': scene({'type': 'lineTable', 'id': 't', 'rows': [['', *first], [k, *second]]})
    fixtures = [
        (case('system-model-value', 'A theater sold 40 tickets for 380 dollars. Adult tickets cost 12 dollars and child tickets cost 7 dollars. How many adult tickets were sold?'), Fraction(20)),
        (case('system-model-value', 'A jar holds 20 coins, all quarters and dimes, worth 350 cents in all. How many dimes are in it?'), Fraction(10)),
        (case('system-model-value', 'A test has 30 questions, each worth 5 points or 2 points, for 87 points in all. How many 5-point questions are on it?'), Fraction(9)),
        (case('half-plane-inequality', 'Which inequality does the shaded region show?', choice('y > 2x − 1', 'y < 2x − 1', 'y ≤ 2x − 1', 'y < −2x − 1'),
              scene({'type': 'graph', 'x': [-6, 6], 'y': [-6, 6], 'regions': [{'halfPlanes': [{'a': -2, 'b': 1, 'c': -1, 'op': '<'}]}]})), 'option-b'),
        (case('half-plane-inequality', 'Which inequality does the shaded region show?', choice('2x + 3y ≥ 12', '3x + 2y ≥ 12', '2x + 3y > 12', '2x + 3y ≤ 12'),
              scene({'type': 'graph', 'x': [-2, 9], 'y': [-2, 9], 'regions': [{'halfPlanes': [{'a': 2, 'b': 3, 'c': 12, 'op': '>='}]}]})), 'option-a'),
        (case('literal-equation-solve', 'Solve kx + 7 = 19 for x, where k ≠ 0.', choice('x = 26/k', 'x = 12/k', 'x = 12k', 'x = 12 − k')), 'option-b'),
        (case('literal-equation-solve', 'If k < 0, solve kx + 4 ≥ 10 for x.', choice('x ≥ 6/k', 'x ≤ 6/k', 'x ≤ 14/k', 'x ≤ 6k')), 'option-b'),
        (case('literal-equation-solve', 'Solve ax + 5 = 3x + 11 for x, where a ≠ 3.', choice('x = 6/(a + 3)', 'x = 6/(a − 3)', 'x = −6/(a − 3)', 'x = 6/(3 − a)')), 'option-b'),
        (case('parameter-solution-count', 'For what value of a does the equation ax + 4 = 3x + 9 have no solution?'), Fraction(3)),
        (case('parameter-solution-count', 'For what value of c does the equation 2(x + 3) = 2x + c have infinitely many solutions?'), Fraction(6)),
        (case('parameter-solution-count', 'For what value of k does the system kx + 2y = 5 and 3x + y = 1 have no solution?'), Fraction(6)),
        (case('equation-step-property', 'The table solves 3(x − 4) = 18 one step at a time. Which reason justifies the step from 3x − 12 = 18 to 3x = 30?',
              choice('Addition property of equality', 'Subtraction property of equality', 'Distributive property', 'Division property of equality'),
              scene({'type': 'lineTable', 'rows': [['3(x − 4) = 18', 'Given'], ['3x − 12 = 18', 'Distributive property'], ['3x = 30', {'text': '?'}], ['x = 10', 'Division property of equality']]})), 'option-a'),
        (case('equation-step-property', 'Each step below should keep 3(x − 4) = 18 equivalent: Step k turns the line above it into its own line. Which step contains an error?',
              choice('Step 1', 'Step 2', 'Step 3', 'No step has an error'),
              scene({'type': 'lineTable', 'rows': [['Given', '3(x − 4) = 18'], ['Step 1', '3x − 4 = 18'], ['Step 2', '3x = 22'], ['Step 3', 'x = 22/3']]})), 'option-a'),
        (case('elimination-equivalent', 'Add the two equations. Which equation results?', choice('4x = 12', '4x = 2', '4x + 4y = 12', '−2x = 2'),
              stack(['x', '+ 2y', '=', '7'], ['3x', '− 2y', '=', '5'])), 'option-a'),
        (case('elimination-equivalent', 'Which system has exactly the same solutions as the system shown?',
              choice('x + 2y = 7 and 4x = 12', 'x + 2y = 7 and 4x = 7', 'x + 2y = 7 and 6x − 4y = 5', 'x + 2y = 7 and 3x − 2y = 6'),
              stack(['x', '+ 2y', '=', '7'], ['3x', '− 2y', '=', '5'])), 'option-a'),
    ]
    for public, expected in fixtures:
        require(solve_two_variable(public) == expected, 'Independent handwritten mismatch: ' + public['prompt'])
    bad = [
        case('system-model-value', 'A theater sold 40 tickets for 381 dollars. Adult tickets cost 12 dollars and child tickets cost 7 dollars. How many adult tickets were sold?'),
        case('half-plane-inequality', 'Which inequality does the shaded region show?', choice('y > 2x − 1', 'y ≥ 2x − 1', 'y ≤ 2x − 1', 'y < −2x − 1'),
             scene({'type': 'graph', 'x': [-6, 6], 'y': [-6, 6], 'regions': [{'halfPlanes': [{'a': -2, 'b': 1, 'c': -1, 'op': '<'}]}]})),
        case('literal-equation-solve', 'If k < 0, solve kx + 4 ≥ 10 for x.', choice('x ≥ 6/k', 'x ≥ −6/k', 'x ≤ 14/k', 'x ≤ 6k')),
        case('equation-step-property', 'The table solves 3(x − 4) = 18 one step at a time. Which reason justifies the step from 3x − 12 = 18 to 3x = 30?',
             choice('Addition property of equality', 'Subtraction property of equality', 'Distributive property', 'Division property of equality'),
             scene({'type': 'lineTable', 'rows': [['3(x − 4) = 18', 'Given'], ['3x − 12 = 18', 'Combining like terms'], ['3x = 30', {'text': '?'}], ['x = 10', 'Division property of equality']]})),
        case('elimination-equivalent', 'Add the two equations. Which equation results?', choice('4x = 13', '4x = 2', '4x + 4y = 12', '−2x = 2'),
             stack(['x', '+ 2y', '=', '7'], ['3x', '− 2y', '=', '5'])),
    ]
    for public in bad:
        try:
            solve_two_variable(public)
        except (ValueError, KeyError, TypeError, IndexError, ZeroDivisionError):
            continue
        raise ValueError('Malformed or inconsistent prompt accepted: ' + public['prompt'])
    return {'handwritten': len(fixtures), 'mutants': len(bad)}


# ------------------------------------------------------------ authored content
_EXPORT = None


def content(data=None):
    global _EXPORT
    if data is not None:
        return data
    if _EXPORT is None:
        app = Path(__file__).resolve().parent.parent
        _EXPORT = subprocess.check_output(['node', '--import', 'tsx', 'scripts/two-variable-content-oracle.ts'], cwd=app, text=True)
    return json.loads(_EXPORT)


def worked_answer(lesson):
    prompt = lesson['workedExample']['prompt']
    m = re.fullmatch(r'Is \((−?\d+), (−?\d+)\) a solution of (.+)\?', prompt)
    if m:
        return 'Yes' if relation(m[3])(number(m[1]), number(m[2])) else 'No'
    m = re.fullmatch(r'In solving (.+), which property justifies the step from (.+) to (.+)\?', prompt)
    if m:
        return PROPERTY[classify(m[2], m[3])]
    m = re.fullmatch(r'Add (.+) and (.+)\. What is x\?', prompt)
    if m:
        (a1, b1, c1), (a2, b2, c2) = eq_of(m[1]), eq_of(m[2])
        require(b1 + b2 == 0, 'The y-terms cancel')
        return str(Fraction(c1 + c2, a1 + a2))
    for template in ('system-model-value', 'parameter-solution-count'):
        try:
            return str(SOLVERS[template](case(template, prompt)))
        except (ValueError, KeyError):
            continue
    raise ValueError('Unrecognized worked example: ' + lesson['id'])


def review_scene_illustrations(figures):
    by = {f['kind']: f['scene'] for f in figures}
    g = by['feasible-bakery']['elements'][0]
    region = lambda x, y: all(OPS[h['op']](h['a'] * x + h['b'] * y, h['c']) for h in g['regions'][0]['halfPlanes'])
    for p in g['points']:
        require(region(p['x'], p['y']) != bool(p.get('open')), 'Feasible points are filled, infeasible ones open')
    h = by['half-plane-test-point']['elements'][0]
    t = h['points'][0]
    require(not all(OPS[q['op']](q['a'] * t['x'] + q['b'] * t['y'], q['c']) for q in h['regions'][0]['halfPlanes']), 'The test point lies on the unshaded side')
    rows = [[c if isinstance(c, str) else c['text'] for c in r] for r in by['equation-step-reasons']['elements'][0]['rows']]
    for j in range(1, len(rows)):
        require(rows[j][1] == PROPERTY[classify(rows[j - 1][0], rows[j][0])], 'Step reason: ' + rows[j][0])
    st = [[c if isinstance(c, str) else c['text'] for c in r] for r in by['elimination-stacked']['elements'][0]['rows']]
    e1, e2 = eq_of(st[0][1] + ' ' + st[0][2] + ' = ' + st[0][4]), eq_of(st[1][1] + ' ' + st[1][2] + ' = ' + st[1][4])
    require(eq_of((st[2][1] + ' ' + st[2][2]).strip() + ' = ' + st[2][4]) == tuple(u + v for u, v in zip(e1, e2)), 'Stacked sum')
    lines = by['elimination-lines']['elements'][0]
    pt = lines['points'][0]
    for ln in lines['lines']:
        spec = ln['line']
        on = spec['x'] == pt['x'] if 'x' in spec else spec['a'] * pt['x'] + spec['b'] * pt['y'] == spec['c']
        require(on, 'Every line passes through the solution')
    return len(by)


def review_two_variable_content(data=None):
    data = content(data)
    checked = 0
    for sheet in data['worksheets']:
        problems = sheet['problems']
        require(len(problems) == 12, 'Worksheet length')
        keys = {json.dumps([p['public']['prompt'], p['public'].get('figure'), sorted(o['label'] for o in p['public']['response'].get('options', []))]) for p in problems}
        require(len(keys) == 12, 'Repeated worksheet problem')
        for p in problems:
            solved = solve_two_variable(p['public'])
            require((p['answer'] == solved) if isinstance(solved, str) else Fraction(p['answer']) == solved, 'Worksheet answer mismatch')
            checked += review_problem(p)
    lessons = {lesson['id']: lesson for lesson in data['lessons']}
    require(sorted(t for l in lessons.values() for t in l['templateIds']) == sorted(TWO_VARIABLE), 'Every template has one standalone lesson')
    for lesson in lessons.values():
        require(worked_answer(lesson) == lesson['workedExample']['answer'], 'Worked example answer: ' + lesson['id'])
        for text in lesson['workedExample']['steps'] + [p for s in lesson['sections'] for p in s['paragraphs']]:
            checked += arithmetic_claims(text)
    figures = review_scene_illustrations(data['figures'])
    return {'worksheets': len(data['worksheets']), 'checkedClaims': checked, 'lessons': len(lessons), 'figures': figures}


def review_content_mutations():
    data = content()
    mutants = []
    bad = copy.deepcopy(data); bad['lessons'][0]['workedExample']['answer'] = '21'; mutants.append(bad)
    bad = copy.deepcopy(data); bad['lessons'][1]['workedExample']['answer'] = 'No'; mutants.append(bad)
    bad = copy.deepcopy(data); bad['worksheets'][0]['problems'][1] = bad['worksheets'][0]['problems'][0]; mutants.append(bad)
    bad = copy.deepcopy(data); bad['worksheets'][0]['problems'][0]['explanation'].append('A false check: 4 × 3 = 13.'); mutants.append(bad)
    bad = copy.deepcopy(data); bad['lessons'][0]['sections'][0]['paragraphs'][1] += ' So 5 × 20 = 120.'; mutants.append(bad)
    bad = copy.deepcopy(data); bad['figures'][2]['scene']['elements'][0]['rows'][2][1] = 'Subtraction property of equality'; mutants.append(bad)
    bad = copy.deepcopy(data); bad['figures'][4]['scene']['elements'][0]['points'][0]['y'] = 3; mutants.append(bad)
    for mutant in mutants:
        try:
            review_two_variable_content(mutant)
        except (ValueError, KeyError, TypeError, IndexError):
            continue
        raise ValueError('Content mutant accepted')
    return len(mutants)
