"""Independent oracle for system-second-equation, parallel-line-intercept and
table-standard-form, from the public payload only.

Every equation is parsed exactly into a x + b y = c. Systems are classified by
determinant and by proportionality of the constants: crossing lines, parallel
distinct lines, and the same line are three different cases, so "no solution"
(parallel distinct), "infinitely many" (same line), "exactly one" (crossing)
and "at least one" (crossing or same line) each select exactly one choice.
Tables are read from the lineTable figure and must be exactly collinear.
"""

import copy
import re
from fractions import Fraction as F

from intercept_point_math_oracle import line_of_rule, number, plain

SUPPORTED = frozenset({'system-second-equation', 'parallel-line-intercept', 'table-standard-form'})
CHOICE_REVIEW = SUPPORTED
REVIEW_RETURNS_ANSWER = False

GOALS = {
    'no solution': 'none',
    'infinitely many solutions': 'many',
    'exactly one solution': 'one',
    'at least one solution': 'some',
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def math_of(label):
    m = re.fullmatch(r'\$(.+)\$', label)
    require(m is not None, f'Option is not typeset math: {label}')
    return m[1]


def relation(first, second):
    """'cross', 'parallel' (distinct) or 'same' for two lines a x + b y = c."""
    a1, b1, c1 = first
    a2, b2, c2 = second
    require((a1, b1) != (0, 0) and (a2, b2) != (0, 0), 'Degenerate equation')
    if a1 * b2 - a2 * b1 != 0:
        return 'cross'
    return 'same' if (a1 * c2 - a2 * c1 == 0 and b1 * c2 - b2 * c1 == 0) else 'parallel'


def meets(goal, rel):
    return {'none': rel == 'parallel', 'many': rel == 'same', 'one': rel == 'cross', 'some': rel in ('cross', 'same')}[goal]


def single_choice(public, test):
    response = public['response']
    require(response['kind'] == 'choice' and len(response['options']) == 4, 'Four choices required')
    require(len({o['id'] for o in response['options']}) == 4, 'Option ids must be distinct')
    hits = [o['id'] for o in response['options'] if test(o)]
    require(len(hits) == 1, f'Exactly one choice must satisfy the condition; found {len(hits)}')
    return hits[0]


def distinct_lines(lines):
    for i in range(len(lines)):
        for j in range(i):
            require(relation(lines[i], lines[j]) != 'same', 'Two choices describe the same line')


# ------------------------------------------------------------------ systems
def system_parts(public):
    m = re.fullmatch(r'The equation \$(.+)\$ is one equation of a system of two linear equations in \$x\$ and \$y\$\. '
                     r'Which equation can be the second equation so that the system has (no solution|infinitely many solutions|exactly one solution|at least one solution)\?',
                     public['prompt'])
    require(m is not None, f'Unrecognized wording: {public["prompt"]}')
    return line_of_rule(m[1]), GOALS[m[2]]


def solve_system(public):
    given, goal = system_parts(public)
    options = public['response']['options']
    lines = {o['id']: line_of_rule(math_of(o['label'])) for o in options}
    require(len({o['label'] for o in options}) == 4, 'Choices must differ in text')
    # Two choices that are the same line would be right or wrong together; keep every choice a distinct line.
    distinct_lines(list(lines.values()))
    return single_choice(public, lambda o: meets(goal, relation(given, lines[o['id']])))


def review_system(problem):
    public = problem['public']
    given, goal = system_parts(public)
    options = public['response']['options']
    lines = {o['id']: line_of_rule(math_of(o['label'])) for o in options}
    result = solve_system(public)
    require(problem['answer'] == result, 'Answer key differs from the derived choice')
    words = {'cross': 'exactly one', 'parallel': 'no solution', 'same': 'infinitely many'}
    feedback = problem.get('choiceFeedback') or {}
    require(result not in feedback, 'Correct choice has wrong-answer feedback')
    for option in options:
        rel = relation(given, lines[option['id']])
        if option['id'] != result:
            require(not meets(goal, rel), 'A distractor satisfies the goal')
            note = feedback.get(option['id'], '')
            require(note != '', 'Wrong choice lacks feedback')
            # Feedback names the relationship of that choice with the given equation.
            mentioned = [k for k, w in words.items() if w in note]
            require(mentioned == [rel], f'Feedback for {option["id"]} describes {mentioned}, but the lines are {rel}')
    correct = math_of({o['id']: o['label'] for o in options}[result])
    require(correct not in problem.get('hint', ''), 'Hint leaks the correct equation')
    require(correct in ' '.join(problem.get('explanation', [correct])), 'Explanation never states the correct equation')
    return result


# ------------------------------------------------------------ parallel lines
def parallel_parts(public):
    prompt = public['prompt']
    head = r'Line \$s\$ has the equation \$(.+?)\$\. Line \$t\$ is parallel to line \$s\$ and '
    tail = r' Which equation represents line \$t\$\?'
    m = re.fullmatch(head + r'passes through the \$([xy])\$-intercept of the line \$(.+?)\$\.' + tail, prompt)
    if m:
        other = line_of_rule(m[3])
        a, b, c = other
        if m[2] == 'y':
            require(b != 0, 'Anchor line has no y-intercept')
            point = (F(0), F(c) / b)
        else:
            require(a != 0, 'Anchor line has no x-intercept')
            point = (F(c) / a, F(0))
        return line_of_rule(m[1]), point
    m = re.fullmatch(head + r'passes through the point \$\((-?\d+), 0\)\$, its \$x\$-intercept\.' + tail, plain_minus(prompt))
    if m:
        return line_of_rule(m[1]), (F(int(m[2])), F(0))
    m = re.fullmatch(head + r'has \$y\$-intercept \$\(0, (-?\d+)\)\$\.' + tail, plain_minus(prompt))
    if m:
        return line_of_rule(m[1]), (F(0), F(int(m[2])))
    raise ValueError(f'Unrecognized wording: {prompt}')


def plain_minus(text):
    # Only the unicode minus in coordinates is normalised; equations keep their own spelling for line_of_rule.
    return re.sub(r'\(−(\d+)', r'(-\1', re.sub(r', −(\d+)\)', r', -\1)', text))


def solve_parallel(public):
    given, point = parallel_parts(public)
    a_s, b_s, _ = given
    require(b_s != 0, 'Given line must be non-vertical')
    options = public['response']['options']
    lines = {o['id']: line_of_rule(math_of(o['label'])) for o in options}
    require(all(b != 0 for _, b, _ in lines.values()), 'Every choice must be a non-vertical line')
    require(len({o['label'] for o in options}) == 4, 'Choices must differ in text')
    distinct_lines(list(lines.values()))
    return single_choice(public, lambda o: relation(given, (lines[o['id']][0], lines[o['id']][1], lines[o['id']][2])) in ('same', 'parallel')
                         and lines[o['id']][0] * point[0] + lines[o['id']][1] * point[1] == lines[o['id']][2]
                         and lines[o['id']][0] * b_s == a_s * lines[o['id']][1])


def review_parallel(problem):
    public = problem['public']
    result = solve_parallel(public)
    require(problem['answer'] == result, 'Answer key differs from the derived choice')
    given, point = parallel_parts(public)
    labels = {o['id']: math_of(o['label']) for o in public['response']['options']}
    require(labels[result] not in problem.get('hint', ''), 'Hint leaks the correct equation')
    require(labels[result] in ' '.join(problem.get('explanation', [labels[result]])), 'Explanation never states the correct equation')
    require(result not in (problem.get('choiceFeedback') or {}), 'Correct choice has wrong-answer feedback')
    # A parallel line through a different point, or a different slope through the point, must not be the key.
    for option_id, text in labels.items():
        if option_id != result:
            a, b, c = line_of_rule(text)
            same_slope = a * given[1] == given[0] * b
            through = a * point[0] + b * point[1] == c
            require(not (same_slope and through), 'A distractor is also a correct line')
    return result


# -------------------------------------------------------------------- tables
def table_points(public):
    figure = public['figure']
    require(figure['kind'] == 'scene', 'Table figure required')
    tables = [e for e in figure['scene']['elements'] if e['type'] == 'lineTable']
    require(len(tables) == 1 and tables[0].get('header') == 'column', 'One column-headed table required')
    rows = tables[0]['rows']
    require(len(rows) == 2 and rows[0][0] == 'x' and rows[1][0] == 'y' and len(rows[0]) == len(rows[1]) >= 4, 'x row and y row required')
    xs = [number(v) for v in rows[0][1:]]
    ys = [number(v) for v in rows[1][1:]]
    require(len(set(xs)) == len(xs), 'Repeated input')
    line = line_through(xs, ys)
    return xs, ys, line


def line_through(xs, ys):
    m = (ys[1] - ys[0]) / (xs[1] - xs[0])
    k = ys[0] - m * xs[0]
    require(all(y == m * x + k for x, y in zip(xs, ys)), 'Table is not exactly linear')
    return -m, F(1), k


def standard_form_text(label):
    m = re.fullmatch(r'(-?\d*)x ([+-]) (\d*)y = (-?\d+)', plain_minus_all(label))
    require(m is not None, f'Not standard form Ax + By = C: {label}')
    a = int(m[1]) if m[1] not in ('', '-') else (1 if m[1] == '' else -1)
    b = int(m[3]) if m[3] else 1
    return a, (b if m[2] == '+' else -b), int(m[4])


def plain_minus_all(label):
    return label.replace('−', '-')


def proportional(first, second):
    return relation(first, second) == 'same'


def table_parts(public):
    prompt = public['prompt']
    if prompt == 'The table shows values of a linear function. Which equation of the line is written in standard form?':
        return 'standard', 0
    m = re.fullmatch(r'The table shows values of a linear function \$f\$\. The function \$g\$ is defined by \$g\(x\) = f\(x\) ([+−-]) (\d+)\$\. Which equation defines \$g\$\?', prompt)
    require(m is not None, f'Unrecognized wording: {prompt}')
    shift = int(m[2])
    return 'shifted', shift if m[1] == '+' else -shift


def solve_table(public):
    xs, ys, line = table_points(public)
    kind, shift = table_parts(public)
    options = public['response']['options']
    if kind == 'standard':
        parsed = {o['id']: standard_form_text(math_of(o['label'])) for o in options}
        target = line
    else:
        m, k = -line[0], line[2]
        target = (-m, F(1), k + shift)
        parsed = {o['id']: line_of_rule(math_of(o['label'])) for o in options}
        require(all(b != 0 for _, b, _ in parsed.values()), 'g must be a function of x')
        require(all(o['label'].startswith('$g(x) = ') for o in options), 'Options must define g')
    require(len({o['label'] for o in options}) == 4, 'Choices must differ in text')
    distinct_lines(list(parsed.values()))
    return single_choice(public, lambda o: proportional(parsed[o['id']], target))


def review_table(problem):
    public = problem['public']
    result = solve_table(public)
    require(problem['answer'] == result, 'Answer key differs from the derived choice')
    xs, ys, line = table_points(public)
    kind, shift = table_parts(public)
    labels = {o['id']: math_of(o['label']) for o in public['response']['options']}
    if kind == 'standard':
        a, b, c = standard_form_text(labels[result])
        from math import gcd
        require(gcd(gcd(abs(a), abs(b)), abs(c)) == 1 and a > 0, 'Standard form must have integer coefficients with no common factor and A > 0')
    require(labels[result] not in problem.get('hint', ''), 'Hint leaks the correct equation')
    explanation = ' '.join(problem.get('explanation', []))
    require(labels[result] in explanation, 'Explanation never states the correct equation')
    require(result not in (problem.get('choiceFeedback') or {}), 'Correct choice has wrong-answer feedback')
    # The worked steps must describe this table.
    dx, dy = xs[1] - xs[0], ys[1] - ys[0]
    m = re.search(r'\$x\$ changes by (\$[^$]+\$|[\u2212-]?\d+) and \$y\$ changes by (\$[^$]+\$|[\u2212-]?\d+)', explanation)
    require(m is not None, 'Explanation does not state the first-column changes')
    require(number(m[1]) == dx and number(m[2]) == dy, 'Explanation misstates the changes in the table')
    if re.search(r'input 0 is not in the table', explanation):
        require(F(0) not in xs, 'Explanation says input 0 is not in the table, but the table has an x = 0 column')
    return result


# --------------------------------------------------------------------- shared
def solve(public):
    template = public['templateId']
    require(template in SUPPORTED, 'Unexpected template')
    if template == 'system-second-equation':
        return solve_system(public)
    if template == 'parallel-line-intercept':
        return solve_parallel(public)
    return solve_table(public)


def review_problem(problem):
    template = problem['public']['templateId']
    return {'system-second-equation': review_system, 'parallel-line-intercept': review_parallel, 'table-standard-form': review_table}[template](problem)


def self_test():
    def mk(template, prompt, labels, answer, figure=None, hint='Compare the coefficients.', explanation=None, feedback=None):
        public = {'templateId': template, 'prompt': prompt,
                  'response': {'kind': 'choice', 'options': [{'id': f'option-{c}', 'label': l} for c, l in zip('abcd', labels)]}}
        if figure:
            public['figure'] = figure
        correct = labels['abcd'.index(answer[-1])].strip('$')
        return {'public': public, 'answer': answer, 'hint': hint, 'explanation': explanation or [f'So ${correct}$ works.'], 'choiceFeedback': feedback or {}}

    sys_prompt = lambda eq, goal: f'The equation ${eq}$ is one equation of a system of two linear equations in $x$ and $y$. Which equation can be the second equation so that the system has {goal}?'
    feedback = lambda **kw: {f'option-{k}': v for k, v in kw.items()}
    table = lambda xs, ys: {'kind': 'scene', 'scene': {'v': 1, 'elements': [{'id': 't', 'type': 'lineTable', 'header': 'column', 'rows': [['x', *xs], ['y', *ys]]}]}}
    good = [
        mk('system-second-equation', sys_prompt('5x + 5y = −11', 'exactly one solution'),
           ['$10x + 10y = −18$', '$15x + 15y = −33$', '$x − 4y = −4$', '$10x + 10y = −11$'], 'option-c',
           feedback=feedback(a='Parallel: no solution.', b='The same line: infinitely many solutions.', d='Parallel: no solution.')),
        mk('system-second-equation', sys_prompt('3x − 4y = 10', 'infinitely many solutions'),
           ['$6x − 8y = 10$', '$−6x − 5y = −16$', '$−6x + 8y = −14$', '$6x − 8y = 20$'], 'option-d',
           feedback=feedback(a='Parallel: no solution.', b='The lines cross at exactly one point.', c='Parallel: no solution.')),
        mk('system-second-equation', sys_prompt('y = −\\tfrac{4}{3}x + 2', 'at least one solution'),
           ['$2x − 3y = −3$', '$8x + 6y = 6$', '$−8x − 6y = −8$', '$−12x − 9y = −11$'], 'option-a',
           feedback=feedback(b='Parallel: no solution.', c='Parallel: no solution.', d='Parallel: no solution.')),
        mk('system-second-equation', sys_prompt('y = −5x + 6', 'no solution'),
           ['$6x + y = −1$', '$15x + 3y = 18$', '$−2x − 6y = −9$', '$5x + y = 8$'], 'option-d',
           feedback=feedback(a='The lines cross at exactly one point.', b='The same line: infinitely many solutions.', c='The lines cross at exactly one point.')),
        mk('parallel-line-intercept', 'Line $s$ has the equation $3x − 2y = 10$. Line $t$ is parallel to line $s$ and passes through the $y$-intercept of the line $2x + y = 1$. Which equation represents line $t$?',
           ['$y = −\\tfrac{2}{3}x + 1$', '$y = −\\tfrac{3}{2}x + 1$', '$y = \\tfrac{3}{2}x − 1$', '$y = \\tfrac{3}{2}x + 1$'], 'option-d'),
        mk('parallel-line-intercept', 'Line $s$ has the equation $6x − 4y = 11$. Line $t$ is parallel to line $s$ and passes through the point $(−5, 0)$, its $x$-intercept. Which equation represents line $t$?',
           ['$y = \\tfrac{3}{2}x − \\tfrac{15}{2}$', '$y = \\tfrac{3}{2}x + \\tfrac{15}{2}$', '$y = −\\tfrac{3}{2}x + \\tfrac{15}{2}$', '$y = −\\tfrac{2}{3}x + \\tfrac{15}{2}$'], 'option-b'),
        mk('parallel-line-intercept', 'Line $s$ has the equation $y = −4x + 7$. Line $t$ is parallel to line $s$ and has $y$-intercept $(0, −8)$. Which equation represents line $t$?',
           ['$y = −4x + 7$', '$y = \\tfrac{1}{4}x − 8$', '$y = 4x − 8$', '$y = −4x − 8$'], 'option-d'),
        mk('table-standard-form', 'The table shows values of a linear function. Which equation of the line is written in standard form?',
           ['$2x + y = 6$', '$2x + y = −6$', '$x + 2y = 12$', '$4x + y = 5$'], 'option-a',
           figure=table(['−1/2', '3/2', '2', '3'], ['7', '3', '2', '0']),
           explanation=['$x$ changes by 2 and $y$ changes by −4.', 'So $2x + y = 6$.']),
        mk('table-standard-form', 'The table shows values of a linear function $f$. The function $g$ is defined by $g(x) = f(x) − 2$. Which equation defines $g$?',
           ['$g(x) = x − 11$', '$g(x) = −x − 9$', '$g(x) = −x − 11$', '$g(x) = −x − 7$'], 'option-c',
           figure=table(['0', '2', '6', '8'], ['−9', '−11', '−15', '−17']),
           explanation=['$x$ changes by 2 and $y$ changes by −2.', 'Then $g(x) = −x − 11$.']),
    ]
    count = 0

    def reject(bad, why):
        nonlocal count
        try:
            review_problem(bad)
        except ValueError:
            count += 1
        else:
            raise AssertionError('Corrupted fixture accepted: ' + why)
    for case in good:
        review_problem(case)
        bad = copy.deepcopy(case)
        bad['answer'] = 'option-a' if case['answer'] != 'option-a' else 'option-b'
        reject(bad, 'wrong key')
        bad = copy.deepcopy(case)
        options = bad['public']['response']['options']
        right = next(i for i, o in enumerate(options) if o['id'] == case['answer'])
        options[(right + 1) % 4]['label'] = options[right]['label']
        reject(bad, 'duplicate of the correct choice')
    # Goal corruption: the same choices cannot answer a different goal.
    bad = copy.deepcopy(good[0])
    bad['public']['prompt'] = bad['public']['prompt'].replace('exactly one solution', 'at least one solution')
    bad['answer'] = 'option-c'
    reject(bad, 'at least one must also admit the same line')
    bad = copy.deepcopy(good[1])  # infinitely many: the parallel-distinct choice is not the same line
    bad['answer'] = 'option-a'
    reject(bad, 'parallel distinct keyed as infinitely many')
    bad = copy.deepcopy(good[3])  # no solution: the identical line is not parallel-distinct
    bad['answer'] = 'option-b'
    reject(bad, 'identical line keyed as no solution')
    bad = copy.deepcopy(good[2])
    bad['public']['response']['options'][1]['label'] = '$4x + 3y = 6$'  # the same line as the given equation joins the options
    reject(bad, 'identical line among at-least-one choices')
    bad = copy.deepcopy(good[0])
    bad['choiceFeedback']['option-a'] = 'The lines cross at exactly one point.'
    reject(bad, 'feedback mislabels a parallel choice')
    bad = copy.deepcopy(good[4])
    bad['public']['prompt'] = bad['public']['prompt'].replace('2x + y = 1', '2x + y = 2')
    reject(bad, 'moved anchor')
    bad = copy.deepcopy(good[5])
    bad['public']['prompt'] = bad['public']['prompt'].replace('(−5, 0)', '(5, 0)')
    reject(bad, 'moved point')
    bad = copy.deepcopy(good[7])
    bad['public']['figure']['scene']['elements'][0]['rows'][1][2] = '4'
    reject(bad, 'nonlinear table')
    bad = copy.deepcopy(good[7])
    bad['public']['figure']['scene']['elements'][0]['rows'][1][1] = '9'
    reject(bad, 'changed table value')
    bad = copy.deepcopy(good[8])
    bad['explanation'][0] = 'The input 0 is not in the table. ' + bad['explanation'][0]
    reject(bad, 'false statement about the table')
    bad = copy.deepcopy(good[8])
    bad['public']['prompt'] = bad['public']['prompt'].replace('− 2', '+ 2')
    reject(bad, 'shift sign flipped')
    return {'fixtures': len(good), 'rejectedMutations': count}


if __name__ == '__main__':
    print(self_test())
