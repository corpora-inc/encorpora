"""Independent oracle for intercept-point-choice, from the public payload only.

The line comes from the displayed equation (parsed exactly with Fractions) or
from two points of the drawn line. Intercept points, intercept sums and zeros
are derived from that line; the option equal to the derived value must be the
single choice marked correct, and no distractor may repeat its value.
"""

import copy
import re
from fractions import Fraction as F

SUPPORTED = frozenset({'intercept-point-choice'})
CHOICE_REVIEW = SUPPORTED
REVIEW_RETURNS_ANSWER = False


def require(condition, message):
    if not condition:
        raise ValueError(message)


def plain(text):
    text = text.replace('\u2212', '-').replace('$', '').replace('\\,', '')
    text = re.sub(r'\\[td]?frac\{(-?\d+)\}\{(\d+)\}', r'(\1/\2)', text)
    return text.replace(' ', '')


def number(token):
    token = plain(token)
    require(re.fullmatch(r'-?\(?-?\d+(?:/\d+)?\)?', token) is not None, f'Not a number: {token}')
    sign = -1 if token.count('-') % 2 else 1
    return sign * F(token.replace('-', '').strip('()'))


def line_of_rule(text):
    """(a, b, c) with a x + b y = c from 'y = mx + k', 'f(x) = mx + k' (or g) or 'ax + by = c'."""
    text = plain(text)
    text = re.sub(r'^[fg]\(x\)=', 'y=', text)
    require(text.count('=') == 1, f'Not one equation: {text}')
    left, right = text.split('=')

    def terms(side):
        # Parenthesised fractions are held aside so their sign is not read as a term break.
        side = re.sub(r'\((-?)(\d+)/(\d+)\)', lambda m: f"[{'n' if m[1] else 'p'}{m[2]}q{m[3]}]", side)
        x = y = k = F(0)
        for t in re.findall(r'[+-]?[^+-]+', side):
            sign = -1 if t.startswith('-') else 1
            body = t.lstrip('+-')
            unknown = body[-1] if body[-1] in 'xy' else None
            coefficient_text = body[:-1] if unknown else body
            if coefficient_text == '':
                coefficient = F(1)
            else:
                m = re.fullmatch(r'\[([np])(\d+)q(\d+)\]|(\d+)', coefficient_text)
                require(m is not None, f'Unreadable term: {t}')
                coefficient = (F(int(m[2]), int(m[3])) * (-1 if m[1] == 'n' else 1)) if m[1] else F(int(m[4]))
            if unknown == 'x':
                x += sign * coefficient
            elif unknown == 'y':
                y += sign * coefficient
            else:
                k += sign * coefficient
        return x, y, k
    lx, ly, lk = terms(left)
    rx, ry, rk = terms(right)
    return lx - rx, ly - ry, rk - lk


def line_of_points(p, q):
    (x1, y1), (x2, y2) = [(F(a), F(b)) for a, b in (p, q)]
    require((x1, y1) != (x2, y2), 'Degenerate line')
    a, b = y2 - y1, x1 - x2
    return a, b, a * x1 + b * y1


def intercepts(line):
    a, b, c = line
    require(a != 0 and b != 0 and c != 0, 'Both intercepts must exist, off the origin')
    return F(c) / a, F(c) / b


def graph_line(public):
    figure = public.get('figure')
    require(figure and figure['kind'] == 'scene', 'Graph required')
    graphs = [e for e in figure['scene']['elements'] if e['type'] == 'graph']
    require(len(graphs) == 1 and len(graphs[0]['lines']) == 1, 'One graphed line required')
    g = graphs[0]
    through = g['lines'][0]['line']['through']
    line = line_of_points(*through)
    xi, yi = intercepts(line)
    # Both intercepts must be readable inside the drawn window.
    require(g['x'][0] <= xi <= g['x'][1] and g['y'][0] <= yi <= g['y'][1], 'Intercept outside the drawn window')
    require(all(g['x'][0] <= px <= g['x'][1] and g['y'][0] <= py <= g['y'][1] for px, py in through), 'Through-point outside window')
    return line, g


def ask_and_line(public):
    prompt = public['prompt']
    m = re.fullmatch(r'A line has the equation \$(.+)\$\. Which ordered pair is its \$([xy])\$-intercept\?', prompt)
    if m:
        return 'x-point' if m[2] == 'x' else 'y-point', line_of_rule(m[1])
    m = re.fullmatch(r'A line has the equation \$(.+)\$\. It crosses the \$x\$-axis at point \$P\$ and the \$y\$-axis at point \$Q\$\. '
                     r'What is the sum of the nonzero coordinate of \$P\$ and the nonzero coordinate of \$Q\$\?', prompt)
    if m:
        return 'sum', line_of_rule(m[1])
    m = re.fullmatch(r'The function \$f\$ is given by \$(f\(x\) = .+)\$\. For which value of \$x\$ is \$f\(x\) = 0\$\?', prompt)
    if m:
        return 'zero', line_of_rule(m[1])
    m = re.fullmatch(r'The line \$(.+)\$ is the graph of a linear function \$f\$\. What is the zero of \$f\$\?', prompt)
    if m:
        return 'zero', line_of_rule(m[1])
    if prompt == 'The graph shows a line. Which ordered pair is its $y$-intercept?':
        return 'y-point', graph_line(public)[0]
    if prompt == 'The graph shows a line. Which ordered pair is its $x$-intercept?':
        return 'x-point', graph_line(public)[0]
    if prompt == 'The graph shows a linear function $f$. For which value of $x$ is $f(x) = 0$?':
        return 'zero', graph_line(public)[0]
    if prompt == ('The graph shows a line that crosses the $x$-axis at point $P$ and the $y$-axis at point $Q$. '
                  'What is the sum of the nonzero coordinate of $P$ and the nonzero coordinate of $Q$?'):
        return 'sum', graph_line(public)[0]
    raise ValueError(f'Unrecognized wording: {prompt}')


def option_value(label, kind):
    text = plain(label)
    if kind in ('x-point', 'y-point'):
        m = re.fullmatch(r'\((-?\(?-?\d+(?:/\d+)?\)?),(-?\(?-?\d+(?:/\d+)?\)?)\)', text)
        require(m is not None, f'Not an ordered pair: {label}')
        return number(m[1]), number(m[2])
    return number(text)


def expected(public):
    kind, line = ask_and_line(public)
    a, b, c = line
    if kind == 'x-point':
        require(a != 0 and b != 0, 'x-intercept must exist and be unique')
        return kind, (F(c) / a, F(0))
    if kind == 'y-point':
        require(a != 0 and b != 0, 'y-intercept must exist and be unique')
        return kind, (F(0), F(c) / b)
    xi, yi = intercepts(line)
    return kind, (xi + yi if kind == 'sum' else xi)


def solve(public):
    require(public['templateId'] in SUPPORTED, 'Unexpected template')
    response = public['response']
    require(response['kind'] == 'choice' and len(response['options']) == 4, 'Four choices required')
    kind, value = expected(public)
    values = [option_value(o['label'], kind) for o in response['options']]
    require(len(set(values)) == 4, 'Choices must be mathematically distinct')
    require(len({o['id'] for o in response['options']}) == 4, 'Option ids must be distinct')
    matches = [o['id'] for o, v in zip(response['options'], values) if v == value]
    require(len(matches) == 1, f'Exactly one option must equal {value}; found {len(matches)}')
    return matches[0]


def review_problem(problem):
    public = problem['public']
    result = solve(public)
    require(problem['answer'] == result, f'Answer key {problem["answer"]} != derived {result}')
    labels = {o['id']: o['label'] for o in public['response']['options']}
    correct = labels[result]
    hint = problem.get('hint', '')
    # A short whole number can occur in the givens by coincidence (x - 2y = 11 has zero 11); anything longer is a leak.
    short = re.fullmatch(r'-?\d{1,3}', plain(correct)) is not None
    require(short or correct not in public['prompt'], 'Prompt leaks the answer label')
    require(short or correct not in hint, 'Hint leaks the answer label')
    require(correct in ' '.join(problem.get('explanation', [correct])), 'Explanation never states the correct label')
    feedback = problem.get('choiceFeedback') or {}
    require(result not in feedback, 'Correct choice has wrong-answer feedback')
    require(set(feedback) <= set(labels) - {result}, 'Feedback for an unknown option')
    # No unreadable intercept hiding in plain sight: a graph never names the intercept it asks for.
    figure = public.get('figure')
    if figure:
        require(not figure['scene'].get('note'), 'Graph carries a note')
        for element in figure['scene']['elements']:
            require('points' not in element and 'labels' not in element, 'Graph labels an intercept')
    return result


def self_test():
    def mk(prompt, labels, answer, figure=None):
        public = {'templateId': 'intercept-point-choice', 'prompt': prompt,
                  'response': {'kind': 'choice', 'options': [{'id': f'option-{c}', 'label': l} for c, l in zip('abcd', labels)]}}
        if figure:
            public['figure'] = figure
        return {'public': public, 'answer': answer, 'hint': 'Set one coordinate to zero.', 'explanation': ['Work: ' + labels['abcd'.index(answer[-1])]]}

    def graph(a, b):
        return {'kind': 'scene', 'scene': {'v': 1, 'elements': [{'id': 'g', 'type': 'graph', 'x': [-8, 8], 'y': [-8, 8], 'grid': 1, 'tick': 2,
                                                                  'axisNames': ['x', 'y'], 'lines': [{'line': {'through': [a, b]}}]}]}}
    good = [
        mk('A line has the equation $y = \\tfrac{3}{2}x \u2212 1$. Which ordered pair is its $x$-intercept?', ['(0, 2/3)', '(\u22121, 0)', '(0, \u22121)', '(2/3, 0)'], 'option-d'),
        mk('A line has the equation $3x + y = 5$. Which ordered pair is its $y$-intercept?', ['(0, 5)', '(0, 5/3)', '(0, \u22125)', '(5, 0)'], 'option-a'),
        mk('A line has the equation $2x + 5y = \u22124$. Which ordered pair is its $x$-intercept?', ['(\u22124/5, 0)', '(0, \u22122)', '(2, 0)', '(\u22122, 0)'], 'option-d'),
        mk('A line has the equation $y = \\tfrac{3}{2}x + 7$. It crosses the $x$-axis at point $P$ and the $y$-axis at point $Q$. '
           'What is the sum of the nonzero coordinate of $P$ and the nonzero coordinate of $Q$?', ['\u221214/3', '7', '\u221235/3', '7/3'], 'option-d'),
        mk('The function $f$ is given by $f(x) = \u2212\\tfrac{7}{5}x \u2212 1$. For which value of $x$ is $f(x) = 0$?', ['5/7', '\u22125/7', '\u22121', '1'], 'option-b'),
        mk('The line $3x + 2y = 11$ is the graph of a linear function $f$. What is the zero of $f$?', ['11/3', '\u221211/2', '11/2', '\u221211/3'], 'option-a'),
        mk('The graph shows a line. Which ordered pair is its $y$-intercept?', ['(3, 0)', '(0, 3)', '(5, 0)', '(0, 5)'], 'option-b', graph([5, 0], [0, 3])),
        mk('The graph shows a line. Which ordered pair is its $x$-intercept?', ['(0, \u22124)', '(7, 0)', '(\u22127, 0)', '(0, \u22127)'], 'option-c', graph([-7, 0], [0, -4])),
        mk('The graph shows a linear function $f$. For which value of $x$ is $f(x) = 0$?', ['\u22125', '2', '\u22122', '5'], 'option-b', graph([2, 0], [0, 5])),
        mk('The graph shows a line that crosses the $x$-axis at point $P$ and the $y$-axis at point $Q$. '
           'What is the sum of the nonzero coordinate of $P$ and the nonzero coordinate of $Q$?', ['0', '2', '\u22122', '\u22121'], 'option-c', graph([-1, 0], [0, -1])),
    ]
    count = 0
    for case in good:
        review_problem(case)
        # Wrong key.
        bad = copy.deepcopy(case)
        bad['answer'] = 'option-a' if case['answer'] != 'option-a' else 'option-b'
        try:
            review_problem(bad)
        except ValueError:
            count += 1
        else:
            raise AssertionError('Wrong key accepted')
        # A second option repeating the right value (also: duplicate distractors).
        bad = copy.deepcopy(case)
        options = bad['public']['response']['options']
        right = next(i for i, o in enumerate(options) if o['id'] == case['answer'])
        options[(right + 1) % 4]['label'] = options[right]['label']
        try:
            review_problem(bad)
        except ValueError:
            count += 1
        else:
            raise AssertionError('Duplicate correct value accepted')
        # Change the givens so that the keyed option is no longer right.
        bad = copy.deepcopy(case)
        if 'figure' in bad['public']:
            through = bad['public']['figure']['scene']['elements'][0]['lines'][0]['line']['through']
            for point in through:
                for j in (0, 1):
                    point[j] += 1 if point[j] != 0 else 0
        else:
            head, equation, tail = re.match(r'(.*\$)([^$]*=[^$]*)(\$.*)', bad['public']['prompt']).groups()
            last = list(re.finditer(r'\d+', equation))[-1]
            equation = equation[:last.start()] + str(int(last[0]) + 1) + equation[last.end():]
            bad['public']['prompt'] = head + equation + tail
        try:
            review_problem(bad)
        except ValueError:
            count += 1
        else:
            raise AssertionError('Changed givens accepted: ' + bad['public']['prompt'])
    # Leaked answer in the hint.
    bad = copy.deepcopy(good[0])
    bad['hint'] = 'The answer is (2/3, 0).'
    try:
        review_problem(bad)
    except ValueError:
        count += 1
    else:
        raise AssertionError('Hint leak accepted')
    return {'fixtures': len(good), 'rejectedMutations': count}


if __name__ == '__main__':
    print(self_test())
