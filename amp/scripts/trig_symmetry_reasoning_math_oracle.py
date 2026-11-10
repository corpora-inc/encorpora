"""Independent oracle for HSF.TF.A.4: unit-circle explanations of symmetry
and periodicity (unit-circle-symmetry-derivation,
trig-periodicity-explanation, unit-circle-claim-check).

Only public fields enter `solve`. The point P = (a, b) is read from the
prompt and the drawn scene; the point for the target angle is computed from
the angle; every coordinate pair and every equation in an option is
evaluated numerically (a = cos theta, b = sin theta, at the drawn theta and at
sample angles for statements claimed "for every theta"). A conclusion is
valid only when an equation of the right form proves it: f(-theta) = +-f(theta)
for even or odd, f(theta + c) = f(theta) for a period. Splitting a sine or
tangent over a sum is never a valid step, even when the numbers agree.
"""
import copy
import json
import math
import re

import trig_reasoning_oracle_kit as kit
from trig_reasoning_oracle_kit import TAU, require, value_of

SUPPORTED = frozenset({
    'unit-circle-symmetry-derivation',
    'trig-periodicity-explanation',
    'unit-circle-claim-check',
})
REVIEW_RETURNS_ANSWER = True
SAMPLES = (0.37, 1.13, 2.29, 3.71, 4.9, 5.83, -0.8, -2.6)
TRUE_PARITY = {'cos': 'even', 'sin': 'odd', 'tan': 'odd'}


def near(a, b, tol=1e-7):
    return abs(a - b) < tol


def env_at(theta):
    return {'theta': theta, 'a': math.cos(theta), 'b': math.sin(theta)}


def has_numerals(tex):
    """A chain written with the instance's numbers holds only at that angle."""
    return re.search(r'\d\.\d', tex) is not None


def chain_holds(tex, theta):
    """Every '=' link of a TeX chain is true: at every sample angle when it is
    written with letters, at the drawn angle when it uses numbers."""
    parts = [p for p in tex.split('=')]
    require(len(parts) >= 2, f'Not an equation: {tex!r}')
    angles = (theta,) if has_numerals(tex) else (theta,) + SAMPLES
    for angle in angles:
        env = env_at(angle)
        if abs(math.cos(angle)) < 1e-6:
            continue  # tangent undefined there
        values = [value_of(p, env) for p in parts]
        if not all(near(values[0], v, 1e-6) for v in values[1:]):
            return False
    return True


def shape(tex):
    """(fn, argument kind) of a lone 'f(arg)' or 'f theta' term: kinds are
    'theta', 'neg', 'half' (theta + pi), 'supp' (pi - theta), 'full' (theta + 2pi)."""
    tex = tex.strip()
    sign = 1
    if tex.startswith('-'):
        sign, tex = -1, tex[1:].strip()
    m = re.fullmatch(r'\\(sin|cos|tan)(?:\((.+)\)|\\theta)', tex)
    if m is None:
        return None
    arg = m.group(2) or '\\theta'
    probe = 0.731
    value = value_of(arg, {'theta': probe})
    kinds = {'theta': probe, 'neg': -probe, 'half': probe + math.pi, 'supp': math.pi - probe, 'full': probe + TAU}
    found = [k for k, v in kinds.items() if near(value, v)]
    require(len(found) == 1, f'Unknown argument {arg!r}')
    return sign, m.group(1), found[0]


def relation(tex):
    """For a chain 'f(arg) = ... = +-f(theta)': (fn, arg kind, sign)."""
    parts = tex.split('=')
    first, last = shape(parts[0]), shape(parts[-1])
    if first is None or last is None or first[0] != 1:
        return None
    _, fn, kind = first
    sign, fn2, kind2 = last
    if fn2 != fn or kind2 != 'theta':
        return None
    return fn, kind, sign


# ------------------------------------------------- unit-circle-symmetry-derivation

MOTIONS = {
    'the reflection of $P$ across the $x$-axis': lambda x, y: (x, -y),
    'the reflection of $P$ across the $y$-axis': lambda x, y: (-x, y),
    'the half turn of $P$ about the origin': lambda x, y: (-x, -y),
    'the reflection of $P$ across the line $y = x$': lambda x, y: (y, x),
}


def scene_point(public, point_id):
    found = [e for e in public['figure']['scene']['elements'] if e.get('type') == 'point' and e.get('id') == point_id]
    require(len(found) == 1, f'Expected one point {point_id}')
    x, y = found[0]['at']
    require(near(math.hypot(x, y), 1, 1e-5), f'{point_id} is not on the unit circle')
    return x, y


def derivation_setup(public):
    prompt = public['prompt']
    m = re.match(r'On the unit circle, \$P = \((.+?), (.+?)\)\$ is the point for the angle \$\\theta\$, so (.+?)\. \$Q\$ is the point for the angle \$(.+?)\$\.', prompt)
    require(m is not None, 'Derivation wording')
    px, py = scene_point(public, 'P')
    theta = math.atan2(py, px)
    require(min(abs(theta - k * math.pi / 12) for k in range(-24, 25)) > 1e-6, 'theta is a special angle')
    if m.group(1) == 'a':
        require(m.group(2) == 'b' and m.group(3) == '$a = \\cos\\theta$ and $b = \\sin\\theta$', 'Symbolic coordinates')
    else:
        a, b = float(m.group(1)), float(m.group(2))
        require(near(a, px, 1e-5) and near(b, py, 1e-5) and near(a * a + b * b, 1), 'P is drawn at its stated coordinates')
        require(m.group(3) == f'$\\cos\\theta = {m.group(1)}$ and $\\sin\\theta = {m.group(2)}$', 'The prompt restates cos and sin')
    target = value_of(m.group(4), {'theta': theta})
    qx, qy = scene_point(public, 'Q')
    require(near(qx, math.cos(target), 1e-5) and near(qy, math.sin(target), 1e-5), 'Q is drawn at the target angle')
    return theta, target, 'Q is the point for the angle $\\pi - \\theta$. A student says' in prompt


def conclusion_valid(label, theta, contrast):
    verdict = None
    body = label
    if contrast:
        m = re.match(r'(Yes|No): (.+)$', label)
        require(m is not None, 'Contrast options answer yes or no')
        verdict, body = m.group(1), m.group(2)
        # Sine is not even: sin(-theta) = -sin(theta), not sin(theta).
        if verdict == 'Yes':
            return False
    asserted = []
    for m in re.finditer(r'\$([^$]*)\$', body):
        before = body[:m.start()]
        if before.endswith('even means '):
            continue  # a definition, not a claim
        if '=' in m.group(1):
            asserted.append(m.group(1))
    if not asserted:
        require(contrast is False or verdict is not None, 'Unknown conclusion')
    for eq in asserted:
        if not chain_holds(eq, theta):
            return False
    words = body.split(': ')[-1] if ': ' in body else body
    claims = {
        'cosine even, sine odd': [('cos', 'even'), ('sin', 'odd')],
        'cosine odd, sine even': [('cos', 'odd'), ('sin', 'even')],
        'both are even': [('cos', 'even'), ('sin', 'even')],
        'both are odd': [('cos', 'odd'), ('sin', 'odd')],
        'tangent is odd': [('tan', 'odd')],
        'tangent is even': [('tan', 'even')],
    }
    for phrase, parities in claims.items():
        if words.endswith(phrase):
            return all(TRUE_PARITY[fn] == parity for fn, parity in parities)
    if words.endswith('tangent stays the same'):
        return chain_holds('\\tan(\\pi+\\theta)=\\tan\\theta', theta)
    if words.endswith('so sine is odd instead') or words.endswith('so sine is even'):
        return words.endswith('odd instead')
    if words.startswith('even means'):
        return True  # the definition and a true identity, under the verdict "No"
    raise ValueError(f'Unknown conclusion {label!r}')


def derivation(public):
    theta, target, contrast = derivation_setup(public)
    a, b = math.cos(theta), math.sin(theta)
    q = (math.cos(target), math.sin(target))

    def motion_valid(label):
        require(label in MOTIONS, f'Unknown motion {label!r}')
        image = MOTIONS[label](a, b)
        return near(image[0], q[0]) and near(image[1], q[1])

    def coords_valid(label):
        m = re.fullmatch(r'\$\((.+), (.+)\)\$', label)
        require(m is not None, f'Unknown coordinates {label!r}')
        x, y = (value_of(part, env_at(theta)) for part in m.groups())
        return near(x, q[0], 1e-6) and near(y, q[1], 1e-6)

    return kit.multi_part(public, {
        'motion': motion_valid,
        'coords': coords_valid,
        'result': lambda label: conclusion_valid(label, theta, contrast),
    })


# ---------------------------------------------------- trig-periodicity-explanation

TURNS = {'one': 1, 'two': 2, 'three': 3}


def additive(label):
    """A step that splits a trigonometric function over a sum."""
    return 'splits as' in label or re.search(r'\\(sin|tan|cos)\(\\theta \+ [^)]*\) = \\\1\\theta \+ \\\1', label) is not None


def full_turn(public, prompt):
    m = re.search(r'justify \$\\(sin|cos)\(\\theta ([+-]) (\d+)\\pi\) = \\\1\\theta\$ for every real number', prompt)
    require(m is not None, 'Full-turn wording')
    k = (1 if m.group(2) == '+' else -1) * int(m.group(3)) / 2
    require(kit.is_whole(k) and k != 0, 'The shift is a whole number of turns')
    k = int(round(k))

    def valid(option):
        label = option['label']
        # An arc is a length: |2k pi|, travelled clockwise exactly when k < 0.
        good = re.fullmatch(r'(An arc|A clockwise arc) of \$(\d*\\pi)\$ is (one|two|three) full (turns?), since the circumference is \$2\\pi\$; it ends back at \$P\$\.', label)
        if good:
            length = value_of(good.group(2))
            count = TURNS[good.group(3)]
            return (near(length, 2 * math.pi * abs(k)) and count == abs(k)
                    and (good.group(1) == 'A clockwise arc') == (k < 0)
                    and good.group(4) == ('turn' if count == 1 else 'turns'))
        if additive(label):
            return False  # sine and cosine do not split over a sum
        if re.fullmatch(r'The graph of (sine|cosine) repeats every \$2\\pi\$, so its value at \$\\theta [+-] \d+\\pi\$ repeats too\.', label):
            return False  # assumes the repeat it should explain
        if label == "An arc of length $\\pi$ already returns $P$ to its start, since the unit circle's diameter is 2.":
            return False  # the circumference is 2*pi; pi reaches (-a, -b)
        raise ValueError(f'Unknown full-turn option {label!r}')
    return kit.single(public, valid)


def half_turn(public):
    theta = 0.83
    a, b = math.cos(theta), math.sin(theta)
    half = (math.cos(theta + math.pi), math.sin(theta + math.pi))

    def valid(option):
        label = option['label']
        if label == 'An arc of $\\pi$ is half the circumference, so $\\theta + \\pi$ gives $(-a, -b)$, and $\\frac{-b}{-a} = \\frac{b}{a}$.':
            return near(half[0], -a) and near(half[1], -b) and chain_holds('\\frac{-b}{-a}=\\frac{b}{a}', theta)
        if label == 'The point for $\\theta + \\pi$ is $(a, -b)$, and the sign of the ratio does not change.':
            return near(half[0], a) and near(half[1], -b)
        if additive(label):
            return False  # tangent does not split over a sum, though tan(pi) = 0
        if label == 'Sine and cosine repeat every $2\\pi$, so their ratio repeats every $2\\pi$, and $\\pi$ is half of that.':
            return False  # half of a period is not a period
        raise ValueError(f'Unknown half-turn option {label!r}')
    return kit.single(public, valid)


# The four arguments, step by step: True when the step is a valid inference.
STEPS = {
    'The point for $\\theta + \\pi$ is the half turn of $P$, which is $(-a, -b)$.': True,
    'It has the same $x$-coordinate as $P$.': False,
    'So $\\cos(\\theta + \\pi) = \\cos\\theta$, and $\\pi$ is a period of cosine.': False,
    'An arc of $2\\pi$ is one full turn.': True,
    'So $\\sin(\\theta + 2\\pi) = \\sin\\theta + \\sin 2\\pi$.': False,  # splits sine over a sum
    '$\\sin 2\\pi = 0$, so $\\sin(\\theta + 2\\pi) = \\sin\\theta$.': True,
    'Sine and cosine repeat every $2\\pi$.': True,
    'So $\\tan(\\theta + 2\\pi) = \\tan\\theta$, and $2\\pi$ is a period of tangent.': True,
    'So $\\pi$ cannot also be a period of tangent.': False,  # tan(theta + pi) = tan(theta)
    "The unit circle's diameter is 2, so its circumference is $\\pi$.": False,
    'So an arc of $\\pi$ goes around once and returns to $P$.': False,
    'So $\\sin(\\theta + \\pi) = \\sin\\theta$, and $\\pi$ is a period of sine.': False,
}
# Reasons an option gives for a step: True when the reason is a true fact
# that names the actual error.
FLAW_REASONS = [
    (r"Step (\d): the half-turn point's \$x\$-coordinate is \$-a\$, not \$a\$, so \$\\cos\(\\theta \+ \\pi\) = -\\cos\\theta\$\.",
     lambda: chain_holds('\\cos(\\theta + \\pi) = -\\cos\\theta', 0.4)),
    (r'Step (\d): a half turn adds \$2\\pi\$ to the angle, not \$\\pi\$, so the point in Step \d is wrong\.', False),
    (r'Step (\d): equal values at \$\\theta\$ and \$\\theta \+ \\pi\$ for every \$\\theta\$ would not make \$\\pi\$ a period\.', False),
    (r'Step (\d): sine does not split over a sum\. The result is true because an arc of \$2\\pi\$ returns to \$P\$\.',
     lambda: not near(math.sin(math.pi / 2 + math.pi / 2), 2 * math.sin(math.pi / 2)) and chain_holds('\\sin(\\theta + 2\\pi) = \\sin\\theta', 0.4)),
    (r'Step (\d): \$\\sin 2\\pi\$ is 1, not 0, so the correct sum is \$\\sin\\theta \+ 1\$ instead\.', False),
    (r'Step (\d): an arc of \$2\\pi\$ is only half a turn, because the radius of the circle is 1\.', False),
    (r'Step (\d): a function can repeat sooner than its parts; \$\\theta \+ \\pi\$ gives \$\(-a, -b\)\$, ratio \$\\frac\{b\}\{a\}\$\.',
     lambda: chain_holds('\\tan(\\theta + \\pi) = \\tan\\theta', 0.4)),
    (r'Step (\d): tangent does not repeat after \$2\\pi\$, because it is undefined at some of those angles\.', False),
    (r'Step (\d): sine repeats every \$\\pi\$, not every \$2\\pi\$, since a half turn already returns to \$P\$\.', False),
    (r'Step (\d): the circumference is \$2\\pi\$, not \$\\pi\$, so an arc of \$\\pi\$ reaches the opposite point\.', True),
    (r"Step (\d): the unit circle's diameter is 1, not 2, since the radius and the diameter are equal\.", False),
    (r'Step (\d): returning to the same point \$P\$ can still change the value of the sine\.', False),
]


def find_flaw(public, prompt):
    m = re.search(r'A student writes this argument\. Step 1: (.+?) Step 2: (.+?) Step 3: (.+?) Which statement identifies the error\?', prompt)
    require(m is not None, 'Flaw wording')
    steps = [m.group(i) for i in (1, 2, 3)]
    for s in steps:
        require(s in STEPS, f'Unknown argument step {s!r}')
    flawed = next((i + 1 for i, s in enumerate(steps) if not STEPS[s]), None)
    require(flawed is not None, 'The argument has no flaw')

    def valid(option):
        label = option['label']
        if label.startswith('Nothing is wrong'):
            return False
        hits = [(re.fullmatch(p, label), v) for p, v in FLAW_REASONS]
        hits = [(h, v) for h, v in hits if h]
        require(len(hits) == 1, f'Unknown flaw option {label!r}')
        found, verdict = hits[0]
        true_reason = verdict() if callable(verdict) else verdict
        return true_reason and int(found.group(1)) == flawed
    return kit.single(public, valid)


def counterexample(public, prompt):
    m = re.match(r'A student claims that \$(.+?)\$ is a period of (sine|cosine): \$\\(sin|cos)\(\\theta \+ (.+?)\) = \\\3\\theta\$ for every \$\\theta\$\.', prompt)
    require(m is not None, 'Counterexample wording')
    c = value_of(m.group(1))
    require(near(value_of(m.group(4)), c), 'The claim restates c')
    f = math.sin if m.group(3) == 'sin' else math.cos
    require({'sine': 'sin', 'cosine': 'cos'}[m.group(2)] == m.group(3), 'Function named consistently')

    def valid(option):
        o = re.fullmatch(r'\$\\theta = (.+)\$', option['label'])
        require(o is not None, 'Option is an angle')
        x = value_of(o.group(1))
        require(min(abs(x - k * math.pi / 12) for k in range(-48, 49)) < 1e-9, 'Counterexample angles are special')
        return not near(f(x + c), f(x), 1e-9)
    return kit.single(public, valid)


def periodicity(public):
    prompt = public['prompt']
    if 'Which explanation uses the unit circle to justify $\\tan(\\theta + \\pi)' in prompt:
        return half_turn(public)
    if 'Which explanation uses the unit circle to justify' in prompt:
        return full_turn(public, prompt)
    if 'A student writes this argument.' in prompt:
        return find_flaw(public, prompt)
    return counterexample(public, prompt)


# ------------------------------------------------------- unit-circle-claim-check

def claim_truth(label):
    if label == 'Tangent is neither odd nor even because its graph has asymptotes.':
        return not chain_holds('\\tan(-\\theta) = -\\tan\\theta', 0.5)  # tangent is odd
    m = re.fullmatch(r'\$(.+?)\$(?: for every \$\\theta\$)?(?:, so (.+)| because (.+))\.', label)
    require(m is not None, f'Unknown claim {label!r}')
    eq, conclusion, reason = m.group(1), m.group(2), m.group(3)
    if not chain_holds(eq, 0.6):
        return False
    rel = relation(eq)
    require(rel is not None, f'Unknown equation form {eq!r}')
    fn, kind, sign = rel
    if conclusion:
        names = {'cosine': 'cos', 'sine': 'sin', 'tangent': 'tan'}
        parity = re.fullmatch(r'(cosine|sine|tangent) is (even|odd)', conclusion)
        if parity:
            # Even or odd compares f(-theta) with f(theta).
            return kind == 'neg' and names[parity.group(1)] == fn and (sign == 1) == (parity.group(2) == 'even')
        period = re.fullmatch(r'\$\\pi\$ is( not)? a period of (sine|tangent|cosine)', conclusion)
        require(period is not None, f'Unknown conclusion {conclusion!r}')
        if names[period.group(2)] != fn or kind != 'half':
            return False
        if period.group(1):
            return sign == -1  # f(theta + pi) = -f(theta) with f not always 0
        return sign == 1
    if reason == 'an arc of $2\\pi$ returns to $P$':
        return kind == 'full' and sign == 1
    require(reason in ('the angle is negative', '$-\\theta$ and $\\theta$ have the same arc length'), f'Unknown reason {reason!r}')
    return False  # neither reason locates the point for -theta


def claim_setup(public):
    prompt = public['prompt']
    require(prompt.startswith('On the unit circle, $P = (a, b)$ is the point for the angle $\\theta$, so $a = \\cos\\theta$ and $b = \\sin\\theta$. The figure also marks the point for $-\\theta$, $(a, -b)$; the point for $\\pi - \\theta$, $(-a, b)$; and the point for $\\pi + \\theta$, $(-a, -b)$.'), 'Claim-check wording')
    px, py = scene_point(public, 'P')
    theta = math.atan2(py, px)
    for point_id, angle in (('M', -theta), ('N', math.pi - theta), ('H', math.pi + theta)):
        x, y = scene_point(public, point_id)
        require(near(x, math.cos(angle), 1e-5) and near(y, math.sin(angle), 1e-5), f'{point_id} is drawn at its angle')


def claims(public):
    claim_setup(public)
    return kit.select_all(public, claim_truth)[0]


SOLVERS = {
    'unit-circle-symmetry-derivation': derivation,
    'trig-periodicity-explanation': periodicity,
    'unit-circle-claim-check': claims,
}


def solve(public):
    require(public['templateId'] in SUPPORTED, 'Unexpected template')
    return SOLVERS[public['templateId']](public)


def review_problem(problem):
    public = problem['public']
    expected = solve(public)
    if public['templateId'] == 'unit-circle-claim-check':
        _, truths = kit.select_all(public, claim_truth)
        kit.review_select_explanation(problem, truths)
    if public['response']['kind'] == 'choice':
        wrong = {o['id'] for o in public['response']['options']} - {expected}
        require(set(problem.get('choiceFeedback') or {}) == wrong, 'Feedback for exactly the wrong options')
        key = next(o['label'] for o in public['response']['options'] if o['id'] == expected)
        require(key not in problem['hint'], 'Hint quotes the answer')
    return expected


# ------------------------------------------------------------------ self test

def _choice(labels):
    return {'kind': 'choice', 'label': 'Choose one', 'options': [{'id': f'option-{chr(97 + i)}', 'label': label} for i, label in enumerate(labels)]}


def _points(**points):
    return {'kind': 'scene', 'scene': {'v': 1, 'elements': [
        {'type': 'point', 'id': k, 'at': [round(math.cos(v), 6), round(math.sin(v), 6)]} for k, v in points.items()]}}


def self_test():
    checks = 0
    theta = math.atan2(0.8, 0.6)

    def blank(bid, labels):
        return {'id': bid, 'label': bid, 'options': [{'id': 'abcdef'[i], 'label': label} for i, label in enumerate(labels)]}
    derivation_public = {
        'templateId': 'unit-circle-symmetry-derivation',
        'prompt': 'On the unit circle, $P = (0.6, 0.8)$ is the point for the angle $\\theta$, so $\\cos\\theta = 0.6$ and $\\sin\\theta = 0.8$. $Q$ is the point for the angle $-\\theta$. Complete the explanation.',
        'response': {'kind': 'multi-part-choice', 'label': 'Choose', 'layout': 'slots', 'blanks': [
            blank('motion', list(MOTIONS)),
            blank('coords', ['$(0.6, -0.8)$', '$(-0.6, 0.8)$', '$(-0.6, -0.8)$', '$(0.8, 0.6)$']),
            blank('result', ['$\\tan(-\\theta)=\\frac{-0.8}{0.6}=-\\tan\\theta$: tangent is odd', '$\\tan(-\\theta)=\\frac{0.8}{0.6}=\\tan\\theta$: tangent is even',
                             '$\\tan(-\\theta)=\\frac{0.6}{-0.8}$: tangent is odd', '$\\tan(-\\theta)=\\tan\\theta$, since $\\tan(\\pi+\\theta)=\\tan\\theta$']),
        ]},
        'figure': _points(P=theta, Q=-theta),
    }
    require(solve(derivation_public) == '{"motion":"a","coords":"a","result":"a"}', 'Reflection across the x-axis, tangent odd')
    checks += 1
    swapped = copy.deepcopy(derivation_public)
    swapped['response']['blanks'][2]['options'][1]['label'] = '$\\tan(-\\theta)=\\frac{-0.8}{0.6}=-\\tan\\theta$: tangent is odd, again'
    kit.must_fail(solve, swapped)
    checks += 1
    contrast = copy.deepcopy(derivation_public)
    contrast['prompt'] = contrast['prompt'].replace('the angle $-\\theta$.', 'the angle $\\pi - \\theta$. A student says the figure shows that sine is even.')
    contrast['figure'] = _points(P=theta, Q=math.pi - theta)
    contrast['response']['blanks'][2]['options'] = [{'id': 'abcd'[i], 'label': label} for i, label in enumerate([
        'No: even means $\\sin(-\\theta)=\\sin\\theta$, but $\\sin(-\\theta)=-\\sin\\theta$',
        'Yes: $\\sin(\\pi-\\theta)=\\sin\\theta$ gives equal values, so sine is even',
        'Yes: $P$ and $Q$ have the same $y$-coordinate, so sine is even',
        'No: here $\\sin(\\pi-\\theta)=-\\sin\\theta$, so sine is odd instead'])]
    require(solve(contrast) == '{"motion":"b","coords":"b","result":"a"}', 'pi - theta is the y-axis mirror; sine is still odd')
    checks += 1

    setup = 'On the unit circle, $P = (a, b)$ is the point for the angle $\\theta$, so $a = \\cos\\theta$ and $b = \\sin\\theta$. '
    half = {'templateId': 'trig-periodicity-explanation',
            'prompt': setup + 'Which explanation uses the unit circle to justify $\\tan(\\theta + \\pi) = \\tan\\theta$ for every $\\theta$ where tangent is defined?',
            'response': _choice([
                'The point for $\\theta + \\pi$ is $(a, -b)$, and the sign of the ratio does not change.',
                '$\\tan\\pi = 0$, so $\\tan(\\theta + \\pi) = \\tan\\theta + \\tan\\pi = \\tan\\theta + 0 = \\tan\\theta$.',
                'An arc of $\\pi$ is half the circumference, so $\\theta + \\pi$ gives $(-a, -b)$, and $\\frac{-b}{-a} = \\frac{b}{a}$.',
                'Sine and cosine repeat every $2\\pi$, so their ratio repeats every $2\\pi$, and $\\pi$ is half of that.'])}
    require(solve(half) == 'option-c', 'The half turn keeps the ratio')
    checks += 1
    turns = {'templateId': 'trig-periodicity-explanation',
             'prompt': setup + 'Which explanation uses the unit circle to justify $\\sin(\\theta - 4\\pi) = \\sin\\theta$ for every real number $\\theta$?',
             'response': _choice([
                 '$\\sin(\\theta - 4\\pi)$ splits as $\\sin\\theta + \\sin(-4\\pi)$, so the two values must match.',
                 'A clockwise arc of $4\\pi$ is two full turns, since the circumference is $2\\pi$; it ends back at $P$.',
                 'The graph of sine repeats every $2\\pi$, so its value at $\\theta - 4\\pi$ repeats too.',
                 "An arc of length $\\pi$ already returns $P$ to its start, since the unit circle's diameter is 2."])}
    require(solve(turns) == 'option-b', 'Two clockwise turns')
    counterclockwise = copy.deepcopy(turns)
    counterclockwise['response']['options'][1]['label'] = 'An arc of $4\\pi$ is two full turns, since the circumference is $2\\pi$; it ends back at $P$.'
    kit.must_fail(solve, counterclockwise)
    checks += 2
    flaw = {'templateId': 'trig-periodicity-explanation',
            'prompt': setup + "A student writes this argument. Step 1: The unit circle's diameter is 2, so its circumference is $\\pi$. Step 2: So an arc of $\\pi$ goes around once and returns to $P$. Step 3: So $\\sin(\\theta + \\pi) = \\sin\\theta$, and $\\pi$ is a period of sine. Which statement identifies the error?",
            'response': _choice([
                "Step 1: the unit circle's diameter is 1, not 2, since the radius and the diameter are equal.",
                'Step 1: the circumference is $2\\pi$, not $\\pi$, so an arc of $\\pi$ reaches the opposite point.',
                'Step 3: returning to the same point $P$ can still change the value of the sine.',
                'Nothing is wrong: an arc of $\\pi$ returns to $P$, so $\\pi$ is a period of sine.'])}
    require(solve(flaw) == 'option-b', 'The circumference is 2 pi')
    checks += 1
    shifted = copy.deepcopy(flaw)
    shifted['response']['options'][1]['label'] = shifted['response']['options'][1]['label'].replace('Step 1', 'Step 2')
    kit.must_fail(solve, shifted)
    checks += 1
    counter = {'templateId': 'trig-periodicity-explanation',
               'prompt': 'A student claims that $\\pi$ is a period of cosine: $\\cos(\\theta + \\pi) = \\cos\\theta$ for every $\\theta$. Which value of $\\theta$ shows that the claim is false?',
               'response': _choice(['$\\theta = \\frac{\\pi}{2}$', '$\\theta = 0$', '$\\theta = \\frac{3\\pi}{2}$', '$\\theta = -\\frac{\\pi}{2}$'])}
    require(solve(counter) == 'option-b', 'cos(pi) = -1 differs from cos 0 = 1')
    checks += 1
    two = copy.deepcopy(counter)
    two['response']['options'][0]['label'] = '$\\theta = \\pi$'
    kit.must_fail(solve, two)
    checks += 1

    claims_public = {
        'templateId': 'unit-circle-claim-check',
        'prompt': 'On the unit circle, $P = (a, b)$ is the point for the angle $\\theta$, so $a = \\cos\\theta$ and $b = \\sin\\theta$. The figure also marks the point for $-\\theta$, $(a, -b)$; the point for $\\pi - \\theta$, $(-a, b)$; and the point for $\\pi + \\theta$, $(-a, -b)$. Which 2 statements are true, with a correct reason?',
        'response': {'kind': 'multi-select', 'label': 'Choose 2 statements', 'selectionCount': 2, 'options': [
            {'id': f'option-{chr(97 + i)}', 'label': label} for i, label in enumerate([
                '$\\sin(\\pi - \\theta) = \\sin\\theta$, so sine is even.',
                '$\\cos(-\\theta) = \\cos\\theta$ for every $\\theta$, so cosine is even.',
                '$\\tan(\\theta + \\pi) = \\tan\\theta$, so tangent is even.',
                '$\\sin(\\pi + \\theta) = -\\sin\\theta$, so $\\pi$ is not a period of sine.',
                'Tangent is neither odd nor even because its graph has asymptotes.',
                '$\\cos(-\\theta) = -\\cos\\theta$ because the angle is negative.'])]},
        'figure': _points(P=0.9, M=-0.9, N=math.pi - 0.9, H=math.pi + 0.9),
    }
    require(solve(claims_public) == '["option-b","option-d"]', 'Two correctly justified claims')
    checks += 1
    wrong_reason = copy.deepcopy(claims_public)
    wrong_reason['response']['options'][1]['label'] = '$\\cos(-\\theta) = \\cos\\theta$ for every $\\theta$, so cosine is odd.'
    kit.must_fail(solve, wrong_reason)
    checks += 1
    return checks


if __name__ == '__main__':
    print(self_test())
