"""Shared plumbing for the select-all (multi-select-v1) independent oracles.

Not an oracle itself: it holds no template ids and no answers. Each family
module supplies `verdicts(public)`, a list with one truth value per displayed
statement, computed from the prompt, the statement text and the drawn figure.
The kit then checks the response contract (stated count equals the true
count, distinct statements, canonical answer) and the private fields
(answer, per-statement explanation verdict, no statement leaked by the hint).
"""
import ast
import copy
import json
import math
import re
from fractions import Fraction


def require(condition, message):
    if not condition:
        raise ValueError(message)


def strip_commas(text):
    return text.replace('{,}', '')


def dollars(label):
    """Every $...$ span of a label, in order."""
    return re.findall(r'\$([^$]*)\$', label)


def whole_numbers(label):
    """Whole numbers written as $12{,}345$ spans, in order."""
    return [int(strip_commas(s)) for s in re.findall(r'\$(\d(?:\d|\{,\})*)\$', label)]


def arith(text):
    """Exact value of an integer/decimal expression using + - \\times \\div and parentheses."""
    t = strip_commas(text).replace('\\times', '*').replace('\\div', '/').replace('\\cdot', '*').replace(' ', '')
    require(re.fullmatch(r'[0-9.+\-*/()]+', t) is not None, f'Not arithmetic: {text}')

    def ev(node):
        if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
            return Fraction(repr(node.value))
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.USub):
            return -ev(node.operand)
        if isinstance(node, ast.BinOp):
            a, b = ev(node.left), ev(node.right)
            if isinstance(node.op, ast.Add):
                return a + b
            if isinstance(node.op, ast.Sub):
                return a - b
            if isinstance(node.op, ast.Mult):
                return a * b
            if isinstance(node.op, ast.Div):
                require(b != 0, 'Division by zero')
                return a / b
        raise ValueError(f'Unsupported expression: {text}')
    return ev(ast.parse(t, mode='eval').body)


def pair_count(public):
    """N when the prompt asks for a true/false verdict on each of N statements
    (the options are then 'S is true.' / 'S is false.' per statement), else None."""
    m = re.fullmatch(r'Decide whether each of the (\d+) statements is true or false, and choose the correct statement for each statement\.', public['prompt'])
    return int(m.group(1)) if m else None


def options_of(public):
    response = public['response']
    require(response['kind'] == 'multi-select', 'Not a multi-select response')
    options = response['options']
    require(2 <= len(options) <= (12 if pair_count(public) else 6), 'Unexpected number of statements')
    require([o['id'] for o in options] == [f'option-{chr(97 + i)}' for i in range(len(options))], 'Option ids not option-a..')
    labels = [o['label'] for o in options]
    require(len(set(labels)) == len(labels), 'Duplicate statement text')
    return options


def stated_count(public):
    """The count the learner is told: the prompt's 'Select the N' and the response label."""
    found = re.findall(r'Select the (\d+) ', public['prompt'])
    require(len(found) == 1, 'Prompt does not state the selection count once')
    n = int(found[0])
    require(public['response']['selectionCount'] == n, 'selectionCount differs from the prompt')
    label = re.match(r'Choose (\d+) ', public['response']['label'])
    require(label is not None and int(label.group(1)) == n, 'Response label states another count')
    return n


def answer(public, truths):
    options = options_of(public)
    require(len(truths) == len(options), 'One verdict per statement')
    pairs = pair_count(public)
    if pairs:
        require(public['response']['selectionCount'] == pairs and len(options) == 2 * pairs, 'Pair-format count')
        label = re.match(r'Choose (\d+) ', public['response']['label'])
        require(label is not None and int(label.group(1)) == pairs, 'Response label states another count')
        for i in range(pairs):
            require(truths[2 * i] != truths[2 * i + 1], 'Exactly one of a statement\'s two verdicts is correct')
        return json.dumps(sorted(o['id'] for o, t in zip(options, truths) if t), separators=(',', ':'))
    n = stated_count(public)
    correct = [o['id'] for o, t in zip(options, truths) if t]
    require(len(correct) == n, f'Stated count {n} but {len(correct)} statements are true')
    require(0 < n < len(options), 'Degenerate select-all')
    return json.dumps(sorted(correct), separators=(',', ':'))


def review(problem, verdicts, explanation_frame=None):
    public = problem['public']
    truths = verdicts(public)
    expected = answer(public, truths)
    require(problem['answer'] == expected, 'Wrong or noncanonical answer set')
    options = options_of(public)
    explanations = problem['explanation']
    expected_lines = len(options) // 2 if pair_count(public) else len(options)
    if explanation_frame is not None and len(explanations) != expected_lines:
        lead, tail = explanation_frame(public)
        require(len(explanations) == len(lead) + expected_lines + len(tail),
                'Recognized teaching prose and one explanation per statement')
        require(explanations[:len(lead)] == lead and (not tail or explanations[-len(tail):] == tail),
                'Teaching prose disagrees with prompt or figure givens')
        explanations = explanations[len(lead):len(lead) + expected_lines]
    if pair_count(public):
        require(len(explanations) == len(options) // 2, 'One explanation per statement')
        for i, text in enumerate(explanations):
            base = options[2 * i]['label'].removesuffix(' is true.')
            require(options[2 * i + 1]['label'] == base + ' is false.', 'Pair labels')
            require(text.startswith(f"{base}: {'true' if truths[2 * i] else 'false'}."), f'Explanation misstates {base}')
    else:
        require(len(explanations) == len(options), 'One explanation per statement')
        for option, truth, text in zip(options, truths, explanations):
            require(text.startswith(f"{option['label']}: {'true' if truth else 'false'}."), f"Explanation misstates {option['label']}")
    hint = problem['hint']
    for option, truth in zip(options, truths):
        if truth and len(option['label']) > 6:
            require(option['label'] not in hint, f"Hint repeats a correct statement: {option['label']}")
        if truth:
            require(option['label'] not in public['prompt'], 'Prompt repeats a correct statement')
    require(not re.search(r'option-[a-f]', hint + public['prompt']), 'Hint or prompt names an option id')
    return expected


# Polygons, lines and labelled figure parts ---------------------------------

def elements(public):
    figure = public['figure']
    require(figure['kind'] == 'scene' and figure['scene']['v'] == 1, 'Expected a scene figure')
    return figure['scene']['elements']


def lettered(items, prefix='label'):
    """Group the elements drawn before each `label<X>` text under that letter."""
    out, pending = {}, []
    for e in items:
        if e['type'] == 'text' and str(e.get('id', '')).startswith(prefix):
            require(e['text'] not in out, 'Repeated figure letter')
            out[e['text']] = pending
            pending = []
        else:
            pending.append(e)
    require(not pending, 'Elements drawn after the last label')
    return out


def option_letters(public, noun):
    """Map each statement to the figure letter it names: 'Shape $B$' -> 'B'."""
    letters = []
    for o in options_of(public):
        m = re.fullmatch(noun + r' \$([A-F])\$', o['label'])
        require(m is not None, f"Statement is not '{noun} $X$': {o['label']}")
        letters.append(m.group(1))
    require(len(set(letters)) == len(letters), 'Two statements name one figure')
    return letters


def edges(points):
    n = len(points)
    return [(points[i], points[(i + 1) % n]) for i in range(n)]


def direction(a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    n = math.hypot(dx, dy)
    require(n > 1e-9, 'Zero-length side')
    return dx / n, dy / n


def acute_between(u, v):
    """Smaller angle in degrees between two lines with unit directions u and v (0..90)."""
    c = min(1.0, abs(u[0] * v[0] + u[1] * v[1]))
    return math.degrees(math.acos(c))


def line_relation(u, v, kind, near=3.0):
    """True when two unit directions are exactly parallel (kind 'parallel') or
    perpendicular (kind 'perpendicular'). A near miss within `near` degrees
    would look parallel or perpendicular in the picture, so it is refused."""
    a = acute_between(u, v)
    gap = a if kind == 'parallel' else abs(a - 90)
    require(gap < 1e-4 or gap >= near, f'Ambiguous near-{kind} pair ({gap:.2f} degrees off)')
    return gap < 1e-4


def tamper(public, mutate):
    bad = copy.deepcopy(public)
    mutate(bad)
    return bad


def must_fail(function, *args):
    try:
        function(*args)
    except ValueError:
        return
    raise AssertionError('Accepted a corrupted fixture')


def standard_mutants(public, answer_string, explanation, hint, verdicts, solve_function):
    """Corrupt the public contract and the private fields of a handwritten
    fixture; each must raise ValueError."""
    require(solve_function(public) == answer_string, 'Handwritten fixture answer')
    problem = {'public': public, 'answer': answer_string, 'explanation': explanation, 'hint': hint}
    review(problem, verdicts)
    n = public['response']['selectionCount']
    for field, value in [('selectionCount', n + 1), ('kind', 'choice')]:
        must_fail(solve_function, tamper(public, lambda p: p['response'].__setitem__(field, value)))
    must_fail(solve_function, tamper(public, lambda p: p['response']['options'][1].__setitem__('label', p['response']['options'][0]['label'])))
    first_true = json.loads(answer_string)[0]
    must_fail(solve_function, tamper(public, lambda p: p['response'].__setitem__('options', [o for o in p['response']['options'] if o['id'] != first_true])))
    for wrong in ['["option-a"]', '["option-a","option-a"]', json.dumps(['option-c'] + json.loads(answer_string)[:-1])]:
        bad = dict(problem, answer=wrong)
        must_fail(review, bad, verdicts)
    flipped = [explanation[0].replace(': true.', ': TMP.').replace(': false.', ': true.').replace(': TMP.', ': false.')] + explanation[1:]
    must_fail(review, dict(problem, explanation=flipped), verdicts)
    leaked = next(o['label'] for o, e in zip(public['response']['options'], explanation) if e.split(': ', 1)[1].startswith('true') and len(o['label']) > 6)
    must_fail(review, dict(problem, hint=f'{hint} Try {leaked}.'), verdicts)
