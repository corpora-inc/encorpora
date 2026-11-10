"""Independent oracle for HSF.TF.A.2: the unit circle extends sine and
cosine to every real number (unit-circle-extension-reason,
unit-circle-extension-cloze, real-number-terminal-point,
real-number-same-terminal-point).

Only public fields enter `solve`: the real number t is read from the prompt,
terminal points from the drawn scene, and every option is judged by a rule
written here, from the mathematics: a terminal point is at angle t mod 2*pi,
the trip runs counterclockwise for t > 0, an arc of a radius-1 circle equals
its angle, the point is (cos t, sin t), no right triangle has an angle
outside (0, pi/2), and a justification is valid only if it is true and proves
the step. Numbers inside options (degrees, turns, the leftover distance, a
calculator value, a coefficient) are recomputed and must be right.
"""
import copy
import json
import math
import re

import trig_reasoning_oracle_kit as kit
from trig_reasoning_oracle_kit import TAU, require, value_of

SUPPORTED = frozenset({
    'unit-circle-extension-reason',
    'unit-circle-extension-cloze',
    'real-number-terminal-point',
    'real-number-same-terminal-point',
})
REVIEW_RETURNS_ANSWER = True
HALF_PI = math.pi / 2


def near(a, b, tol=1e-6):
    return abs(a - b) < tol


def distance_of(text):
    """A distance written as text ('3.8') or math ('$\\frac{5\\pi}{7}$')."""
    text = text.strip()
    if text.startswith('$'):
        require(text.endswith('$') and text.count('$') == 2, f'Distance {text!r}')
        return value_of(text[1:-1])
    require(re.fullmatch(r'\d+(\.\d+)?', text) is not None, f'Distance {text!r}')
    return float(text)


def direction_of(t):
    return 'counterclockwise' if t > 0 else 'clockwise'


def turns_of(t):
    """Whole turns in |t| and the leftover distance."""
    turns = math.floor(abs(t) / TAU)
    return turns, abs(t) - turns * TAU


TURN_WORDS = {'one full turn': 1, 'two full turns': 2}


def turn_part_ok(t, words, rest):
    """'one full turn ... then about 2.22 more' must match |t| exactly."""
    turns, left = turns_of(t)
    return TURN_WORDS[words] == turns and f'{left:.2f}' == rest


def degrees_ok(t, d):
    require(int(d) == round(math.degrees(t)), f'"about {d} degrees" is not t = {t} in degrees')
    return True


def acute(t):
    return 0 < t < HALF_PI


def point_angle(scene, point_id):
    found = [e for e in scene['elements'] if e.get('type') == 'point' and e.get('id') == point_id]
    require(len(found) == 1, f'Expected one point {point_id}')
    x, y = found[0]['at']
    require(near(math.hypot(x, y), 1, 1e-5), 'The point is not on the unit circle')
    return math.atan2(y, x)


def check_terminal(public, t):
    figure = public['figure']
    require(figure['kind'] == 'scene', 'Expected a scene')
    require(kit.angle_gap(point_angle(figure['scene'], 'P'), t) < 1e-5, 'P is not the terminal point of t')
    # Quadrant reasoning needs t well clear of the axes (never a special angle).
    require(kit.angle_gap(t, round(t / HALF_PI) * HALF_PI) >= 0.3 - 1e-9, 't is within 0.3 of an axis')


# --------------------------------------------------- real-number-terminal-point

QUADRANT = {'I': 1, 'II': 2, 'III': 3, 'IV': 4}


def quadrant(angle):
    return int((angle % TAU) // HALF_PI) + 1


def terminal_point(public):
    m = re.search(r'the trip for \$t = ([^$]+)\$ ends\?$', public['prompt'])
    require(m is not None, 'Terminal-point wording')
    t = value_of(m.group(1))
    require(kit.angle_gap(t, round(t / HALF_PI) * HALF_PI) >= 0.3 - 1e-9, 't is within 0.3 of an axis')
    response = public['response']
    require(response['kind'] == 'figure-choice', 'Expected a figure-choice response')
    angles = []
    for option in response['options']:
        angle = point_angle(option['scene'], 'Q')
        words = re.fullmatch(r'A point on the unit circle in quadrant (I|II|III|IV), at about \((−?\d\.\d), (−?\d\.\d)\)\.', option['label'])
        require(words is not None, 'Option description wording')
        require(QUADRANT[words.group(1)] == quadrant(angle), 'Option description names the wrong quadrant')
        for text, coordinate in ((words.group(2), math.cos(angle)), (words.group(3), math.sin(angle))):
            require(abs(float(text.replace('−', '-')) - coordinate) <= 0.05 + 1e-9, 'Option description coordinates')
        angles.append(angle)
    for i in range(len(angles)):
        for j in range(i + 1, len(angles)):
            require(kit.angle_gap(angles[i], angles[j]) >= 0.3 - 1e-9, 'Two option points are closer than 0.3')
    keys = [o['id'] for o, a in zip(response['options'], angles) if kit.angle_gap(a, t) < 1e-5]
    require(len(keys) == 1, 'Expected exactly one terminal point among the options')
    return keys[0]


# ---------------------------------------------- real-number-same-terminal-point

def same_t(public):
    m = re.search(r'shows the trip for \$t = ([^$]+)\$: it starts at \$\(1, 0\)\$ and travels ([\d.]+) units counterclockwise', public['prompt'])
    require(m is not None, 'Same-terminal-point wording')
    t = value_of(m.group(1))
    require(near(t, float(m.group(2))) and t > 0, 'The trip distance is t')
    check_terminal(public, t)
    return t


def same_truth(public):
    t = same_t(public)

    def truth(label):
        value = value_of(label)
        require(not near(value, t), 'An option is t itself, not another number')
        turns = (value - t) / TAU
        return kit.is_whole(turns)
    return truth


def same_terminal(public):
    return kit.select_all(public, same_truth(public))[0]


# ---------------------------------------------------- unit-circle-extension-cloze

def cloze_t(public):
    m = re.match(r'For the real number \$t = ([^$]+)\$, complete the explanation', public['prompt'])
    require(m is not None, 'Cloze wording')
    t = value_of(m.group(1))
    sentence = public['response']['sentence']
    arc = re.search(r'an arc of length (\$[^$]+\$|[\d.]+)(, travelled clockwise,)? makes an angle of', ''.join(p.get('text', '') for p in sentence))
    require(arc is not None and near(distance_of(arc.group(1)), abs(t)), 'The sentence states the arc length |t|')
    require(bool(arc.group(2)) == (t < 0), 'The sentence states the direction only for negative t')
    check_terminal(public, t)
    return t


def move_valid(t):
    def valid(label):
        if label.endswith(', since $\\pi$ is a full turn'):
            return False  # pi is half a turn
        degrees = re.fullmatch(r'\$.+\^\\circ\$ (counterclockwise|clockwise)', label)
        if degrees:
            return False  # a distance along the circle is not a number of degrees
        m = re.fullmatch(r'(\$[^$]+\$|[\d.]+) units (counterclockwise|clockwise)(?:: (one full turn|two full turns), then about ([\d.]+) more)?', label)
        require(m is not None, f'Unknown distance option {label!r}')
        ok = near(distance_of(m.group(1)), abs(t)) and m.group(2) == direction_of(t)
        if m.group(3):
            ok = ok and turn_part_ok(t, m.group(3), m.group(4))
        return ok
    return valid


def angle_valid(t):
    def valid(label):
        m = re.fullmatch(r'(\$[^$]+\$|-?[\d.]+) radians', label)
        if m:
            written = m.group(1)
            return near(value_of(written[1:-1]) if written.startswith('$') else float(written), t)
        require(re.fullmatch(r'\$.+\^\\circ\$', label) is not None, f'Unknown angle option {label!r}')
        return near(value_of(label[1:-1]), t)  # degrees: read as degrees, never t
    return valid


def point_valid(t):
    def valid(label):
        m = re.fullmatch(r'\$\((.+), (.+)\)\$', label)
        require(m is not None, f'Unknown point option {label!r}')
        x, y = (value_of(part, {'t': t}) for part in (m.group(1), m.group(2)))
        return near(x, math.cos(t)) and near(y, math.sin(t))
    return valid


REASONS = [
    (r'the circle has no end: any distance can be travelled, going around either way', True),
    (r'every real number is between 0 and \$2\\pi\$', False),
    (r'every real number is positive', False),
    (r'the circumference of the unit circle is 1', False),  # it is 2*pi
]


def by_rules(rules, label, what):
    hits = [verdict for pattern, verdict in rules if re.fullmatch(pattern, label)]
    require(len(hits) == 1, f'Unknown {what} {label!r}')
    return hits[0]


def cloze(public):
    t = cloze_t(public)
    return kit.multi_part(public, {
        'move': move_valid(t),
        'angle': angle_valid(t),
        'point': point_valid(t),
        'reason': lambda label: by_rules(REASONS, label, 'reason'),
    })


# ---------------------------------------------------- unit-circle-extension-reason

def reason_kind(prompt):
    if prompt.startswith('Before the unit circle'):
        return 's0'
    m = re.search(r'Which statement justifies (?:the last sentence of |the bounds in )?Step (\d)', prompt)
    if m:
        return 's' + m.group(1)
    if 'is correct and complete?' in prompt:
        return 'explain'
    require(prompt.endswith('What is the flaw?'), 'Unknown reasoning prompt')
    if 'opposite leg over the hypotenuse' in prompt:
        return 'f1'
    if 'Negative angles do not exist' in prompt:
        return 'f2'
    if 'is a full turn, so every angle is between' in prompt:
        return 'f3'
    require('On a circle of radius 3' in prompt, 'Unknown flaw claim')
    return 'f4'


def reason_t(public, kind):
    prompt = public['prompt']
    if kind == 's0':
        m = re.search(r'give no value for \$\\sin(.+)\$\?$', prompt)
        require(m is not None, 'S0 wording')
        return value_of(m.group(1))
    m = re.search(r'(?:For|trip for) \$t = ([^$]+)\$', prompt)
    require(m is not None, 'The prompt states t')
    t = value_of(m.group(1))
    if kind in ('s1', 's2', 's3', 's4'):
        step1 = re.search(r'Step 1: Start at \$\(1, 0\)\$ and move (\$[^$]+\$|[\d.]+) units along the unit circle, (counterclockwise because \$t\$ is positive|clockwise because \$t\$ is negative)\.', prompt)
        require(step1 is not None, 'Step 1 wording')
        require(near(distance_of(step1.group(1)), abs(t)), 'Step 1 distance is |t|')
        require(step1.group(2).startswith(direction_of(t)), 'Step 1 direction')
        step2 = re.search(r'Step 2: The turn from the positive \$x\$-axis to ray \$OP\$ measures \$t = ([^$]+)\$ radians\.', prompt)
        require(step2 is not None and near(value_of(step2.group(1)), t), 'Step 2 states the angle t')
    return t


def rules_for(kind, t, fn):
    """(pattern, verdict) pairs; a verdict is True when the statement is true
    and proves what is asked. Patterns are full-match regular expressions."""
    T = re.escape
    sin_t = rf'\$\\{fn} t\$'
    if kind == 's0':
        return [
            (r'No right triangle has an angle of \$t\$ radians, about \$(-?\d+)\^\\circ\$: its acute angles are between 0 and \$\\frac\{\\pi\}\{2\}\$\.',
             lambda m: degrees_ok(t, m.group(1)) and not acute(t)),
            (r'Right triangles have only angles that are multiples of \$\\pi\$, and \$t\$ is not one\.', False),
            (r'\$t\$ radians cannot be converted to degrees\.', False),
            (r'\$\\sin t\$ would be greater than 1\.', False),
            (r'A right triangle cannot have a hypotenuse of length (\$[^$]+\$|[\d.]+)\.', False),
        ]
    if kind == 's1':
        return [
            (r'The circle has no end: you can keep going past \$2\\pi\$, or go clockwise, so every distance ends at one point\.', True),
            (r'Every real number is less than \$2\\pi\$, so the trip never goes past one full turn\.', False),
            (r"The unit circle's circumference is 1, so \$t\$ is a fraction of one turn\.", False),
            (r'Only multiples of \$\\pi\$ land on the circle; other distances fall between points\.', False),
            (r'The step works only for \$0 < t < \\frac\{\\pi\}\{2\}\$, where a right triangle exists\.', False),
        ]
    if kind == 's2':
        return [
            (r"An angle in radians is arc length divided by radius\. The radius is 1, so the angle's size equals the distance travelled\.", True),
            (r"An arc's length equals its angle in radians on every circle, whatever the radius\.", False),
            (r'One radian is the same as one degree\.', False),
            (r'The arc length is \$t\\pi\$, and \$\\pi\$ radians is half a turn\.', False),
            (r'Point \$P\$ is \$t\$ units from the origin\.', False),
        ]
    if kind == 's3':
        require(acute(t), 'Step 3 is asked about a t that is not acute')
        require(not near(t, math.pi / 4), 't = pi/4 makes the legs equal')
        return [
            (r'From \$P\$, drop a perpendicular: adjacent leg \$x\$, opposite leg \$y\$, hypotenuse 1, so the ratios are \$x\$ and \$y\$\.', True),
            (r'The hypotenuse is \$x\$ and the adjacent leg is 1\.', False),
            (r'The triangle is always a 45-45-90 triangle, so \$x = y\$\.', False),
            (r'The coordinates \$x\$ and \$y\$ are positive for every \$t\$\.', False),
            (r'\$\\sin t = t\$ for every \$t\$\.', False),
        ]
    if kind == 's4':
        return [
            (r'\$P\$ lies on the circle \$x\^2 \+ y\^2 = 1\$, so neither coordinate can be more than 1 in size\.', True),
            (r'The number \$t\$ is never more than 1\.', False),
            (r'The angle \$t\$ is never more than \$2\\pi\$\.', False),
            (r'\$\\sin t\$ is close to \$t\$, and \$t\$ is small\.', False),
            (r'Sine is never negative\.', False),
        ]
    if kind == 'explain':
        coord = '$x$' if fn == 'cos' else '$y$'
        name = 'cosine' if fn == 'cos' else 'sine'

        def trip(m):
            if m.group('turns'):
                ok = m.group('dir') == direction_of(t) and turn_part_ok(t, m.group('turns'), m.group('rest'))
            else:
                ok = abs(t) < TAU and near(distance_of(m.group('dist')), abs(t)) and m.group('dir') == direction_of(t)
            return ok and m.group('coord') == coord

        def calculator(m):
            value = math.cos(t) if fn == 'cos' else math.sin(t)
            require(m.group(1) == f'{value:.3f}', 'The calculator value is wrong')
            return False  # a device's output is not an explanation

        def identity(m):
            other = value_of(m.group(1), {'t': t})
            same = math.cos(other) if fn == 'cos' else math.sin(other)
            require(near(same, math.cos(t) if fn == 'cos' else math.sin(t)), 'The quoted identity is false')
            return False  # uses a property of the extended function to define it
        return [
            (rf'From \$\(1, 0\)\$, (?:travel (?P<dist>\$[^$]+\$|[\d.]+) units (?P<dir>counterclockwise|clockwise)|go (?P<turns>one full turn|two full turns) (?P<dir2>counterclockwise|clockwise) and about (?P<rest>[\d.]+) more)\. {sin_t} is the (?P<coord>\$[xy]\$)-coordinate where you stop\.',
             lambda m: trip(m) if not m.group('turns') else (m.group('dir2') == direction_of(t) and turn_part_ok(t, m.group('turns'), m.group('rest')) and m.group('coord') == coord)),
            (rf'\$t\$ radians is about \$(-?\d+)\^\\circ\$, and every angle has a {name}, so {sin_t} is defined\.',
             lambda m: not degrees_ok(t, m.group(1))),
            (rf'A calculator shows \$\\{fn} t \\approx (-?\d\.\d\d\d)\$, so it is defined\.', calculator),
            (r'\$t\$ is a real number, and the unit circle contains every real number\.', False),
            (rf'Draw a right triangle with an angle of \$t\$ radians; {sin_t} is (?:adjacent|opposite) over hypotenuse\.',
             lambda m: acute(t)),
            (rf'\$\\{fn} t = \\{fn}\((.+)\)\$, and that angle is acute\.', identity),
        ]
    if kind == 'f1':
        return [
            (r'It uses \$\\sin t\$ to define \$\\sin t\$, and no right triangle has an angle of \$t\$ radians\. Point \$P\$ defines it\.',
             lambda m: not acute(t)),
            (r'The hypotenuse should be (\$[^$]+\$|[\d.]+), not 1\.', False),
            (r'\$t\$ should be converted to degrees first\.', False),
            (r'Opposite over hypotenuse works only for angles measured in degrees\.', False),
            (r'There is no flaw; the argument is correct\.', False),
        ]
    if kind == 'f2':
        require(t < 0, 'The negative-angle claim needs a negative t')

        def drop_sign(m):
            a = value_of(m.group(1))
            b = value_of(m.group(2))
            return near(a, b)  # sin t = sin|t| is false for t < 0 off the axis
        return [
            (r'Negative means clockwise: move (\$[^$]+\$|[\d.]+) units from \$\(1, 0\)\$ to a point, and \$\\sin t\$ is its \$y\$-coordinate\.',
             lambda m: near(distance_of(m.group(1)), abs(t))),
            (r'The fix is to drop the sign: \$(.+) = (.+)\$\.', drop_sign),
            (r'The claim is right: arc lengths are never negative, so \$\\sin t\$ is undefined\.', False),
            (r'A negative number means starting at \$\(-1, 0\)\$ instead of \$\(1, 0\)\$\.', False),
            (r'There is no flaw; the argument is correct\.', False),
        ]
    if kind == 'f3':
        require(abs(t) > TAU, 'The full-turn claim needs |t| > 2pi')
        return [
            (r'Travel (\$[^$]+\$|[\d.]+) units( clockwise)?: (one full turn|two full turns) of \$2\\pi\$, then about ([\d.]+) more\. That ends at a point, so \$\\sin t\$ exists\.',
             lambda m: near(distance_of(m.group(1)), abs(t)) and bool(m.group(2)) == (t < 0) and turn_part_ok(t, m.group(3), m.group(4))),
            (r'Reduce \$t\$ by \$\\pi\$, since \$\\pi\$ is one full turn\.', False),
            (r'The flaw is the unit: \$\\sin t\$ means the sine of \$t\$ degrees, and any number of degrees works\.', False),
            (r'The flaw is that every angle is between 0 and \$\\pi\$, not \$2\\pi\$\.', False),
            (r'There is no flaw; the argument is correct\.', False),
        ]
    require(kind == 'f4' and 0 < t < math.pi, 'The radius-3 claim needs 0 < t < pi')
    return [
        (r'On radius 3 the arc is \$3t\$ and the \$y\$-coordinate is \$3\\sin t\$\. Only radius 1 gives \$t\$ and \$\\sin t\$\.', True),
        (r'The arc should be \$\\frac\{t\}\{3\}\$\.', False),
        (r'\$\\sin t\$ is the \$x\$-coordinate, not the \$y\$-coordinate\.', False),
        (r'The arc is \$t\$, but the \$y\$-coordinate is \$\\frac\{\\sin t\}\{3\}\$\.', False),
        (r'There is no flaw; arc length equals the angle on any circle\.', False),
    ]


def judge(rules, label):
    hits = []
    for pattern, verdict in rules:
        m = re.fullmatch(pattern, label)
        if m:
            hits.append(verdict(m) if callable(verdict) else verdict)
    require(len(hits) == 1, f'Unknown or ambiguous option {label!r}')
    return bool(hits[0])


def reason(public):
    prompt = public['prompt']
    kind = reason_kind(prompt)
    t = reason_t(public, kind)
    check_terminal(public, t)
    fn = 'sin'
    if kind == 'explain':
        m = re.search(r'Which explanation of why \$\\(sin|cos)', prompt)
        require(m is not None, 'Explain wording')
        fn = m.group(1)
    if kind in ('f1', 's0'):
        require(not acute(t), 'The triangle argument is used for an acute t')
    rules = rules_for(kind, t, fn)
    return kit.single(public, lambda o: judge(rules, o['label']))


SOLVERS = {
    'unit-circle-extension-reason': reason,
    'unit-circle-extension-cloze': cloze,
    'real-number-terminal-point': terminal_point,
    'real-number-same-terminal-point': same_terminal,
}


def solve(public):
    require(public['templateId'] in SUPPORTED, 'Unexpected template')
    return SOLVERS[public['templateId']](public)


def review_problem(problem):
    public = problem['public']
    expected = solve(public)
    if public['templateId'] == 'real-number-same-terminal-point':
        _, truths = kit.select_all(public, same_truth(public))
        kit.review_select_explanation(problem, truths)
    if public['response']['kind'] in ('choice', 'figure-choice'):
        feedback = problem.get('choiceFeedback') or {}
        wrong = {o['id'] for o in public['response']['options']} - {expected}
        require(set(feedback) == wrong, 'Feedback for exactly the wrong options')
    if public['templateId'] == 'unit-circle-extension-reason' and reason_kind(public['prompt']) == 'f3':
        t = reason_t(public, 'f3')
        # sin t equals sin(|t| - 2*pi*turns) only for positive t; for negative t
        # it is the sine of the leftover distance travelled clockwise.
        require(t > 0 or not any('equals the sine of the leftover distance' in line for line in problem['explanation']),
                'Explanation: sin t of a negative t is not the sine of the positive leftover distance')
    hint = problem['hint']
    require(not re.search(r'option-[a-f]', hint), 'Hint names an option')
    if public['response']['kind'] == 'choice':
        key = next(o['label'] for o in public['response']['options'] if o['id'] == expected)
        require(key not in hint, 'Hint quotes the answer')
    return expected


# ------------------------------------------------------------------ self test

def _choice(labels):
    return {'kind': 'choice', 'label': 'Choose one', 'options': [{'id': f'option-{chr(97 + i)}', 'label': label} for i, label in enumerate(labels)]}


def _circle(t, point='P'):
    return {'kind': 'scene', 'scene': {'v': 1, 'elements': [
        {'type': 'point', 'id': 'start', 'at': [1, 0]},
        {'type': 'point', 'id': point, 'at': [round(math.cos(t), 6), round(math.sin(t), 6)]},
    ]}}


def self_test():
    checks = 0
    # Terminal point of 4.3: quadrant III.
    terminal = {
        'templateId': 'real-number-terminal-point',
        'prompt': 'A real number $t$ names a trip along the unit circle that starts at $(1, 0)$. Which graph shows the terminal point, where the trip for $t = 4.3$ ends?',
        'response': {'kind': 'figure-choice', 'label': 'Choose the graph', 'noun': 'Graph', 'options': []},
    }
    for i, angle in enumerate([-4.3, 4.3, math.pi - 4.3, 4.3 - math.pi]):
        x, y = math.cos(angle), math.sin(angle)
        label = f'A point on the unit circle in quadrant {["I", "II", "III", "IV"][quadrant(angle) - 1]}, at about ({x:.1f}, {y:.1f}).'.replace('-', '−')
        terminal['response']['options'].append({'id': f'option-{chr(97 + i)}', 'label': label, 'scene': _circle(angle, 'Q')['scene']})
    require(solve(terminal) == 'option-b', '4.3 lands at angle 4.3')
    checks += 1
    twin = copy.deepcopy(terminal)
    twin['response']['options'][0]['scene'] = _circle(4.3, 'Q')['scene']
    twin['response']['options'][0]['label'] = twin['response']['options'][1]['label']
    kit.must_fail(solve, twin)
    checks += 1

    # Same terminal point: whole turns only.
    same = {
        'templateId': 'real-number-same-terminal-point',
        'prompt': 'The figure shows the trip for $t = 3.8$: it starts at $(1, 0)$ and travels 3.8 units counterclockwise to its terminal point $P$. Which 2 other real numbers also have terminal point $P$?',
        'response': {'kind': 'multi-select', 'label': 'Choose 2 numbers', 'selectionCount': 2, 'options': [
            {'id': f'option-{chr(97 + i)}', 'label': label} for i, label in enumerate(
                ['$3.8 + 2\\pi$', '$-3.8$', '$3.8 - 4\\pi$', '$\\pi - 3.8$', '$3.8 + \\pi$', '$3.8 + 360$'])]},
        'figure': _circle(3.8),
    }
    require(solve(same) == '["option-a","option-c"]', 'Whole turns of 2pi share P')
    checks += 1
    wrong_count = copy.deepcopy(same)
    wrong_count['response']['options'][4]['label'] = '$3.8 + 6\\pi$'
    kit.must_fail(solve, wrong_count)
    checks += 1

    # Cloze for t = -2.4.
    def blank(bid, labels):
        return {'id': bid, 'label': bid, 'options': [{'id': 'abcdef'[i], 'label': label} for i, label in enumerate(labels)]}
    cloze_public = {
        'templateId': 'unit-circle-extension-cloze',
        'prompt': 'For the real number $t = -2.4$, complete the explanation of how the unit circle gives $\\sin\\left(-2.4\\right)$ and $\\cos\\left(-2.4\\right)$.',
        'response': {'kind': 'multi-part-choice', 'label': 'Choose', 'layout': 'inline', 'blanks': [
            blank('move', ['2.4 units counterclockwise', '2.4 units clockwise', '$2.4^\\circ$ clockwise', '$2.4\\pi$ units clockwise']),
            blank('angle', ['$-2.4^\\circ$', '$-2.4$ radians', '$\\frac{-2.4}{2\\pi}$ radians', '$-2.4\\pi$ radians']),
            blank('point', ['$(\\sin t, \\cos t)$', '$(t, \\sin t)$', '$(\\cos t, \\sin t)$', '$(\\cos t^\\circ, \\sin t^\\circ)$']),
            blank('reason', ['every real number is positive', 'the circle has no end: any distance can be travelled, going around either way', 'every real number is between 0 and $2\\pi$', 'the circumference of the unit circle is 1']),
        ], 'sentence': [{'text': 'Start at $(1, 0)$ and move '}, {'blank': 'move'}, {'text': ' along the unit circle. Because the radius is 1, an arc of length 2.4, travelled clockwise, makes an angle of '}, {'blank': 'angle'}, {'text': '.'}]},
        'figure': _circle(-2.4),
    }
    require(solve(cloze_public) == '{"move":"b","angle":"b","point":"c","reason":"b"}', 'Cloze for -2.4')
    checks += 1
    bad_direction = copy.deepcopy(cloze_public)
    bad_direction['response']['blanks'][0]['options'][1]['label'] = '2.4 units counterclockwise, again'
    kit.must_fail(solve, bad_direction)
    checks += 1

    # Winding distance with its turn decomposition.
    require(turn_part_ok(8.5, 'one full turn', f'{8.5 - TAU:.2f}'), '8.5 is one turn and 2.22')
    require(not turn_part_ok(8.5, 'two full turns', f'{8.5 - TAU:.2f}'), 'Wrong turn count rejected')
    checks += 2

    # Justify Step 4 for t = 5.6.
    argument = ('For $t = 5.6$, the figure shows the trip that defines $\\sin t$ and $\\cos t$. '
                'Step 1: Start at $(1, 0)$ and move 5.6 units along the unit circle, counterclockwise because $t$ is positive. This reaches exactly one point $P$. '
                'Step 2: The turn from the positive $x$-axis to ray $OP$ measures $t = 5.6$ radians. ')
    step4 = {
        'templateId': 'unit-circle-extension-reason',
        'prompt': argument + 'Which statement justifies the bounds in Step 4: that $\\sin t$ and $\\cos t$ always lie between $-1$ and $1$?',
        'response': _choice(['The number $t$ is never more than 1.', '$P$ lies on the circle $x^2 + y^2 = 1$, so neither coordinate can be more than 1 in size.', 'Sine is never negative.', 'The angle $t$ is never more than $2\\pi$.']),
        'figure': _circle(5.6),
    }
    require(solve(step4) == 'option-b', 'Step 4 rests on x^2 + y^2 = 1')
    checks += 1
    two_true = copy.deepcopy(step4)
    two_true['response']['options'][0]['label'] = '$P$ lies on the circle $x^2 + y^2 = 1$, so neither coordinate can be more than 1 in size. '
    kit.must_fail(solve, two_true)
    checks += 1

    # Correct-and-complete explanation, with a wrong calculator value caught.
    explain = {
        'templateId': 'unit-circle-extension-reason',
        'prompt': 'The figure shows the trip for $t = 8.5$. Which explanation of why $\\cos 8.5$ has a value is correct and complete?',
        'response': _choice([
            'From $(1, 0)$, go one full turn counterclockwise and about 2.22 more. $\\cos t$ is the $x$-coordinate where you stop.',
            f'A calculator shows $\\cos t \\approx {math.cos(8.5):.3f}$, so it is defined.',
            '$t$ is a real number, and the unit circle contains every real number.',
            'Draw a right triangle with an angle of $t$ radians; $\\cos t$ is adjacent over hypotenuse.',
        ]),
        'figure': _circle(8.5),
    }
    require(solve(explain) == 'option-a', 'One turn and 2.22 more')
    checks += 1
    wrong_value = copy.deepcopy(explain)
    wrong_value['response']['options'][1]['label'] = 'A calculator shows $\\cos t \\approx 0.123$, so it is defined.'
    kit.must_fail(solve, wrong_value)
    wrong_rest = copy.deepcopy(explain)
    wrong_rest['response']['options'][0]['label'] = 'From $(1, 0)$, go one full turn counterclockwise and about 2.30 more. $\\cos t$ is the $x$-coordinate where you stop.'
    kit.must_fail(solve, wrong_rest)
    checks += 2

    # Find the flaw, radius 3; a "no flaw" key is rejected.
    flaw = {
        'templateId': 'unit-circle-extension-reason',
        'prompt': 'The figure shows the trip for $t = 2.1$. Maya argues: “On a circle of radius 3, an angle of 2.1 radians cuts an arc of length 2.1, so $\\sin 2.1$ is the $y$-coordinate of the point reached.” What is the flaw?',
        'response': _choice(['The arc should be $\\frac{t}{3}$.', 'On radius 3 the arc is $3t$ and the $y$-coordinate is $3\\sin t$. Only radius 1 gives $t$ and $\\sin t$.', 'There is no flaw; arc length equals the angle on any circle.', '$\\sin t$ is the $x$-coordinate, not the $y$-coordinate.']),
        'figure': _circle(2.1),
    }
    require(solve(flaw) == 'option-b', 'Radius 3 scales arc and height')
    checks += 1
    problem = {'public': flaw, 'answer': 'option-b', 'hint': 'Compare radius 3 with radius 1.', 'explanation': [],
               'choiceFeedback': {'option-a': '.', 'option-c': '.', 'option-d': '.'}}
    require(review_problem(problem) == 'option-b', 'Review returns the key')
    kit.must_fail(review_problem, dict(problem, choiceFeedback={'option-a': '.'}))
    checks += 2

    # S0 with a wrong degree conversion is caught.
    s0 = {
        'templateId': 'unit-circle-extension-reason',
        'prompt': 'Before the unit circle, $\\sin t$ meant the opposite leg divided by the hypotenuse, for an acute angle $t$ of a right triangle. Why does that definition give no value for $\\sin\\left(-2.4\\right)$?',
        'response': _choice([f'No right triangle has an angle of $t$ radians, about ${round(math.degrees(-2.4))}^\\circ$: its acute angles are between 0 and $\\frac{{\\pi}}{{2}}$.',
                             '$t$ radians cannot be converted to degrees.', '$\\sin t$ would be greater than 1.', 'A right triangle cannot have a hypotenuse of length 2.4.']),
        'figure': _circle(-2.4),
    }
    require(solve(s0) == 'option-a', 'No right triangle has a negative angle')
    bad_degrees = copy.deepcopy(s0)
    bad_degrees['response']['options'][0]['label'] = bad_degrees['response']['options'][0]['label'].replace('-138', '-140')
    kit.must_fail(solve, bad_degrees)
    checks += 2
    return checks


if __name__ == '__main__':
    print(self_test())
