"""Independent oracle for the HSG.GMD.A.2 Cavalieri-argument types.

Only the public payload is read. Slice areas and volumes are recomputed
exactly, as rational multiples of pi, from the radius, height and plane
height in the prompt. Reasoning options are judged by a rule base written
here: each recognized statement is tested against the solids' slice-area
functions (checked at many heights), or against a stated rule of
argument (a principle applies only when its hypothesis has been shown;
equal slices at a few heights, equal bases, or equal heights alone are not
the hypothesis; a correct conclusion does not make an argument correct).
An unrecognized statement is an error, and exactly one option of every
choice (and every part) may be valid.
"""
import json
import math
import re
from fractions import Fraction

SUPPORTED = frozenset({
    'cavalieri-sphere-argument',
    'cavalieri-slice-area-check',
    'cavalieri-other-solids-argument',
})
REVIEW_RETURNS_ANSWER = True


def require(cond, message):
    if not cond:
        raise ValueError(message)


def only(found, what):
    require(len(found) == 1, f'Expected exactly one valid {what}, found {len(found)}')
    return found[0]


# --------------------------------------------------- the solids' slices

R = 5.0
HEIGHTS = [R * k / 20 for k in range(1, 20)]


def hemisphere(r, y):
    return math.pi * (r * r - y * y)


def ring(r, y):
    """Cylinder radius r, height r, minus the cone with its tip at the base
    center and its base on the top: the cone's radius at height y is y."""
    return math.pi * r * r - math.pi * y * y


def ring_inverted(r, y):
    """The cone with its tip at the top center: radius r - y at height y."""
    return math.pi * r * r - math.pi * (r - y) ** 2


def cone_up(r, y):
    """A cone of radius r and height r standing on its base."""
    return math.pi * (r - y) ** 2


def same(f, g):
    return all(abs(f(R, y) - g(R, y)) < 1e-9 for y in HEIGHTS)


def equal_everywhere(f, g):
    return same(f, g)


# ------------------------------------------------- 2. check the slices

def pi_value(label):
    """'$16\\pi$ cm²', '$\\frac{125}{3}\\pi$ cm³', '$\\pi$ cm²' as a Fraction of pi."""
    m = re.fullmatch(r'\$(?:(\d+)|\\frac\{(\d+)\}\{(\d+)\})?\\pi\$ cm[²³]', label)
    require(m is not None, f'Unreadable multiple of pi {label!r}')
    if m[1]:
        return Fraction(int(m[1]))
    if m[2]:
        return Fraction(int(m[2]), int(m[3]))
    return Fraction(1)


def plain_value(label):
    m = re.fullmatch(r'(\d+) cm²', label)
    require(m is not None, f'Unreadable area {label!r}')
    return Fraction(int(m[1]))


def plane_label(public):
    for e in public['figure']['scene']['elements']:
        if e.get('id') == 'ybrace':
            return e['label']
    return None


def solve_slices(public):
    prompt = public['prompt']
    blanks = public['response']['blanks']
    key = {}
    sphere = re.fullmatch(r'A hemisphere of radius (\d+) cm stands beside a cylinder of radius \1 cm and height \1 cm with a cone removed\. '
                          r'The cone\'s tip is at the center of the cylinder\'s base, and its base is the cylinder\'s top\. A plane at height (\d+) cm cuts both solids\.', prompt)
    pyramid = re.fullmatch(r'A pyramid and a cone each have base area (\d+) cm² and height (\d+) cm\. A plane parallel to their bases cuts both at height (\d+) cm above the bases\.', prompt)
    hemicone = re.fullmatch(r'A hemisphere of radius (\d+) cm and a cone of radius \1 cm and height \1 cm stand on the same plane\. '
                            r'Both have base area \$(\d+)\\pi\$ cm² and height \1 cm\. A parallel plane cuts both at height (\d+) cm\.', prompt)
    volume = re.fullmatch(r'In the sphere argument, a hemisphere of radius (\d+) cm has the same volume as a cylinder of radius \1 cm and height \1 cm '
                          r'with a cone of the same base and height removed\. Finish the computation\.', prompt)
    require(sum(bool(x) for x in (sphere, pyramid, hemicone, volume)) == 1, 'Unknown slice question')
    if volume:
        r = Fraction(int(volume[1]))
        truth = {'Volume of the cylinder': r ** 3, 'Volume of the removed cone': r ** 3 / 3,
                 'Volume of the hemisphere': r ** 3 - r ** 3 / 3, 'Volume of the whole sphere': 2 * (r ** 3 - r ** 3 / 3)}
        for b in blanks:
            want = truth[b['label']]
            key[b['id']] = only([o['id'] for o in b['options'] if pi_value(o['label']) == want], b['label'])
        return json.dumps(key, separators=(',', ':'))
    if sphere:
        r, y = Fraction(int(sphere[1])), Fraction(int(sphere[2]))
        require(0 < y < r, 'The plane cuts both solids')
        areas = {"Area of the hemisphere's slice": r * r - y * y,
                 'Area of the ring-shaped slice of the other solid': r * r - y * y}
        reader = pi_value
        verdicts = {
            'Equal here; if equal at every height, Cavalieri gives equal volumes': lambda eq: eq,
            'The slices are equal, so the two solids are congruent': lambda eq: False,  # equal slices never give congruence
            'One equal slice is enough to conclude equal volumes': lambda eq: False,  # the principle needs every height
            'The slices differ, so the volumes differ': lambda eq: False,  # one height decides nothing about volume
        }
        equal = areas["Area of the hemisphere's slice"] == areas['Area of the ring-shaped slice of the other solid']
        # The same algebra holds at every height.
        require(equal_everywhere(hemisphere, ring), 'Hemisphere and ring slices agree at every height')
    elif pyramid:
        B, h, y = (Fraction(int(x)) for x in pyramid.groups())
        require(0 < y < h, 'The plane cuts both solids')
        s = B * ((h - y) / h) ** 2
        require(s.denominator == 1, 'Integer slice area')
        areas = {"Area of the pyramid's slice": s, "Area of the cone's slice": s}
        reader = plain_value
        verdicts = {
            # Each slice is the base scaled by (h - y)/h about the tip, so both
            # are B((h - y)/h)^2 at every height; the pyramid's volume is Bh/3.
            'Equal at every height, so the cone\'s volume is the pyramid\'s: $\\frac13Bh$': lambda eq: eq,
            'Equal here, so the cone and the pyramid are congruent': lambda eq: False,
            'A circle and a polygon can never have equal areas': lambda eq: not eq,
            'Equal slice areas mean equal surface areas': lambda eq: False,
        }
        equal = True
    else:
        r, base, y = Fraction(int(hemicone[1])), Fraction(int(hemicone[2])), Fraction(int(hemicone[3]))
        require(base == r * r, 'Base area is pi r squared')
        require(0 < y < r, 'The plane cuts both solids')
        areas = {"Area of the hemisphere's slice": r * r - y * y, "Area of the cone's slice": (r - y) ** 2}
        reader = pi_value
        equal = areas["Area of the hemisphere's slice"] == areas["Area of the cone's slice"]
        verdicts = {
            'No: the slices differ at this height': lambda eq: not eq,
            'Yes: they have the same base area and the same height': lambda eq: False,  # not the hypothesis
            'Yes: their slices are equal at the bottom and at the top': lambda eq: False,  # two heights are not every height
            "No: Cavalieri's principle applies only to prisms": lambda eq: False,  # it applies to any solids
        }
    label = plane_label(public)
    require(label is None or label == str(y), 'The figure plane differs from the prompt')
    for b in blanks:
        if b['label'] in areas:
            want = areas[b['label']]
            key[b['id']] = only([o['id'] for o in b['options'] if reader(o['label']) == want], b['label'])
        else:
            good = []
            for o in b['options']:
                require(o['label'] in verdicts, f'Unknown statement {o["label"]!r}')
                if verdicts[o['label']](equal):
                    good.append(o['id'])
            key[b['id']] = only(good, b['label'])
    return json.dumps(key, separators=(',', ':'))


# -------------------------------------------- 1. the sphere's argument

# The reference argument: each step, whether it is true, and the steps it
# needs. A principle is applied only after its hypothesis is a step.
STEP = {
    'Set the hemisphere beside the cylinder with the cone removed; both have height $r$.': (True, set()),
    "At height $y$ the hemisphere's slice is a circle of radius $\\sqrt{r^2-y^2}$, with area $\\pi(r^2-y^2)$.": (True, {1}),
    'At height $y$ the other slice is a ring with radii $r$ and $y$, with area $\\pi r^2-\\pi y^2$.': (True, {1}),
    'The two slices have equal area at every height $y$, and both solids have height $r$.': (True, {2, 3}),
    "By Cavalieri's principle, the two solids have equal volume.": (True, {4}),
    "So the hemisphere's volume is $\\pi r^3-\\frac13\\pi r^3=\\frac23\\pi r^3$, and the sphere's is $\\frac43\\pi r^3$.": (True, {5}),
    # False statements.
    "At height $y$ the hemisphere's slice is a circle of radius $r$.": (False, set()),
    "So the hemisphere's volume is $\\pi r^3$, the cylinder's volume.": (False, set()),
    "At height $y$ the ring's inner radius is $r-y$.": (False, set()),
}
ORDER = [text for text, (true, _) in STEP.items() if true]

# Checks of the step contents against the slice functions.
assert same(hemisphere, ring)
assert not same(hemisphere, lambda r, y: math.pi * r * r)
assert not same(ring, ring_inverted)


def students_steps(prompt):
    m = re.search(r'A student argues: (.+?) Which step is wrong, and why\?', prompt)
    require(m is not None, 'Missing the student argument')
    parts = re.split(r'Step (\d): ', m[1])
    steps = [parts[i + 1].strip() for i in range(1, len(parts) - 1, 2)]
    require([int(parts[i]) for i in range(1, len(parts), 2)] == list(range(1, len(steps) + 1)), 'Steps numbered in order')
    return steps


# Each student argument: (step texts, the first step that is false or does
# not follow, with the reason), checked against the slice functions.
def first_bad_step(steps):
    for i, text in enumerate(steps, 1):
        if not student_step_ok(text, steps[:i - 1]):
            return i
    return None


def student_step_ok(text, before):
    setup = re.fullmatch(r'(Compare|Set|Remove from) .+\.', text)
    if text == 'At every height $y$, each solid\'s slice is a circle of radius $r$.':
        return same(lambda r, y: math.pi * r * r, hemisphere)  # false for the hemisphere
    if text.startswith('By Cavalieri\'s principle, the') and 'equal' in text:
        # Needs equal heights and equal slices at every height to have been
        # stated. The plain-cylinder argument has stated that (falsely) in
        # step 2, so this step follows from it; the 2r-tall solid has not.
        heights_equal = not any('height $2r$' in s for s in before)
        stated_every = any('At every height' in s or 'match' in s for s in before)
        return heights_equal and stated_every
    if text.startswith('So the hemisphere\'s volume is'):
        return True  # a computation from the step before it
    if text == 'A hemisphere of radius $r$ has slice area $\\pi(r^2-y^2)$ at height $y$.':
        return True
    if text == 'The ring at height $y$ has inner radius $y$, so its area is $\\pi r^2-\\pi y^2$.':
        # True only when the cone's tip is at the bottom.
        inverted = any('tip is at the center of the top' in s for s in before)
        return same(ring_inverted if inverted else ring, ring)
    if text == 'The slices match, so by Cavalieri\'s principle the hemisphere\'s volume is $\\pi r^3-\\frac13\\pi r^3=\\frac23\\pi r^3$.':
        inverted = any('tip is at the center of the top' in s for s in before)
        return same(ring_inverted if inverted else ring, hemisphere)
    if text == 'The hemisphere\'s slice at height $y$ has radius $r-y$, so its area is $\\pi(r-y)^2$.':
        return same(cone_up, hemisphere)
    if text == 'The ring at height $y$ has area $\\pi r^2-\\pi y^2$.':
        return True
    if text == 'These areas differ, so Cavalieri\'s principle cannot give the hemisphere\'s volume.':
        return not same(hemisphere, ring)
    if text == 'Both solids stand on circles of radius $r$.':
        return True  # the cone's tip is at the base center, as in the standard solid
    if text == 'At $y=0$ both slices have area $\\pi r^2$.':
        return abs(hemisphere(R, 0) - ring(R, 0)) < 1e-9
    if text == 'At $y=r$ both slices have area 0.':
        return abs(hemisphere(R, R)) < 1e-9 and abs(ring(R, R)) < 1e-9
    if text == 'The slices match, so by Cavalieri\'s principle the hemisphere\'s volume is $\\frac23\\pi r^3$.':
        # Only two heights were checked: the hypothesis is not shown.
        return any('At every height' in s for s in before)
    if setup:
        return True  # a construction is not a claim
    raise ValueError(f'Unknown student step {text!r}')


DIAGNOSIS = {
    # flaw texts after "Step n: ": true diagnoses of what is wrong there.
    "the hemisphere's slice at height $y$ has radius $\\sqrt{r^2-y^2}$, not $r$.": True,
    'the cylinder should have height $2r$.': False,
    "Cavalieri's principle needs the solids to be congruent.": False,
    'with the tip on top, the inner radius at height $y$ is $r-y$, so the slices are not equal.': not same(ring_inverted, hemisphere),
    "the hemisphere's slice area should be $\\pi(r-y)^2$.": same(cone_up, hemisphere),
    'the cone should be subtracted twice.': False,
    'the slice radius is $\\sqrt{r^2-y^2}$ by the Pythagorean theorem, so the areas are equal after all.': same(hemisphere, ring),
    "the ring's inner radius should be $r-y$ to match.": False,
    "Cavalieri's principle only needs equal bases.": False,
    'the heights differ, $r$ and $2r$, so the slices cannot be equal at every height.': True,
    'the bases have different areas.': False,
    "the cone's volume should be $\\frac12\\pi r^2\\cdot 2r$.": False,
    'equal slices at two heights are not enough; the slices must be equal at every height.': True,
    'at $y=r$ the slices are not both 0.': not (abs(hemisphere(R, R)) < 1e-9 and abs(ring(R, R)) < 1e-9),
    'the cone must be removed from the hemisphere, not the cylinder.': False,
}
# "Nothing is wrong" options: valid only when no step is wrong AND the
# reason they add is sound. Every added reason here is unsound.
NOTHING_WRONG = {
    'Nothing is wrong; the hemisphere\'s volume is $\\pi r^3$.': False,  # it is 2/3 pi r^3
    'Nothing is wrong: the conclusion is correct, so the argument is correct.': False,  # a true conclusion proves nothing
    "Nothing is wrong; Cavalieri's principle does not apply here.": False,  # it applies with the right slices
    'Nothing is wrong; the hemisphere\'s volume is $\\frac43\\pi r^3$.': False,  # that is the whole sphere
    'Nothing is wrong; two matching slices determine the volume.': False,  # the principle needs every height
}

# Single-question rule bases: option -> valid answer to that question.
SPHERE_QUESTIONS = {
    'Which reason justifies that inner radius?': {
        "The cone's radius is $r$ at height $r$ and grows at the same rate as the height, so it is $y$ at height $y$.":
            same(lambda r, y: math.pi * r * r - math.pi * y * y, ring),
        'The sphere\'s radius is $r$, so every circle in the figure has a radius tied to $r$.': False,  # names no inner radius
        'Every slice of a cone is the same circle as its base.': same(lambda r, y: 0.0 * y, ring),  # would leave no ring
        "The cone's radius shrinks by 1 for each unit of height, starting from $r$ at the bottom.": same(ring_inverted, ring),
    },
    'Why?': {
        "A sphere radius to the slice's edge is the hypotenuse of a right triangle with legs $y$ and the slice radius.":
            same(lambda r, y: math.pi * (r * r - y * y), hemisphere),
        'The radius shrinks by $y$ as the slice rises, so it is $r-y$.': same(cone_up, hemisphere),
        'Every slice of the hemisphere is a great circle, so its radius is $r$.': same(lambda r, y: math.pi * r * r, hemisphere),
        'The area formula $\\pi r^2$ gives the radius.': False,  # the area needs the radius first
    },
    'Which fact lets the argument go from Step 4 to Step 5?': {
        "Cavalieri's principle: solids of the same height with equal slice areas at every height have equal volumes.": True,
        'Solids with the same base area and the same height have equal volumes.': False,  # cone and cylinder share both
        'Solids with the same height have equal volumes.': False,
        'Congruent solids have equal volumes.': False,  # true, but these solids are not congruent
    },
    'Why?volume': {
        'The cylinder\'s volume is $Bh=\\pi r^2\\cdot r$; the cone has the same base and height, so its volume is $\\frac13Bh$.': True,
        'The cylinder\'s volume is $\\pi r^2\\cdot r$, and the cone\'s volume is also $\\pi r^2\\cdot r$.': False,
        'The cylinder\'s volume is $2\\pi r\\cdot r$, its curved surface area.': False,
        'The cone\'s volume is half the cylinder\'s, $\\frac12\\pi r^2\\cdot r$.': False,
    },
    'Which argument correctly and completely shows that the hemisphere\'s volume is $\\frac23\\pi r^3$?': {
        # Both slices are pi(r^2 - y^2) at every height, both solids are r
        # tall, so the principle applies; the cylinder minus its cone is
        # pi r^3 - pi r^3 / 3.
        "Equal slices $\\pi(r^2-y^2)$ at every $y$ and equal heights, so by Cavalieri's principle $V=\\pi r^3-\\frac13\\pi r^3$.":
            same(hemisphere, ring) and same(ring, lambda r, y: math.pi * (r * r - y * y)),
        'At $y=0$ both slices have area $\\pi r^2$, so the volumes are equal: $\\pi r^3-\\frac13\\pi r^3$.': False,
        'The slices are equal at every height, so the hemisphere\'s volume is the cylinder\'s, $\\pi r^3$.': False,
        'Both have base area $\\pi r^2$ and height $r$, so they have equal volume: $\\pi r^3-\\frac13\\pi r^3$.': False,
    },
}
SETUP = ('A hemisphere of radius $r$ stands on its flat face. Beside it stands a cylinder of radius $r$ and height $r$ with a cone removed: '
         "the cone's tip is at the center of the cylinder's base, and its base is the cylinder's top.")


def judge(options, rules, what):
    good = []
    for o in options:
        require(o['label'] in rules, f'Unknown statement {o["label"]!r}')
        if rules[o['label']]:
            good.append(o['id'])
    return only(good, what)


def solve_sphere(public):
    prompt = public['prompt']
    opts = public['response']['options']
    require(public['response']['kind'] == 'choice' and len(opts) == 4 and len({o['label'] for o in opts}) == 4, 'Four distinct options')
    if 'Which step is wrong, and why?' in prompt:
        steps = students_steps(prompt)
        bad = first_bad_step(steps)
        good = []
        for o in opts:
            if o['label'] in NOTHING_WRONG:
                if bad is None and NOTHING_WRONG[o['label']]:
                    good.append(o['id'])
                continue
            m = re.fullmatch(r'Step (\d): (.+)', o['label'])
            require(m is not None and m[2] in DIAGNOSIS, f'Unknown diagnosis {o["label"]!r}')
            if int(m[1]) == bad and DIAGNOSIS[m[2]]:
                good.append(o['id'])
        return only(good, 'diagnosis')
    require(prompt.startswith(SETUP), 'Missing the standard setup')
    if 'Which statement comes next?' in prompt:
        m = re.search(r'The argument so far: (.+) Which statement comes next\?', prompt)
        parts = re.split(r'Step (\d): ', m[1])
        shown = [parts[i + 1].strip() for i in range(1, len(parts) - 1, 2)]
        require(shown == ORDER[:len(shown)], 'The steps shown are the reference argument')
        have = set(range(1, len(shown) + 1))
        good = []
        for o in opts:
            require(o['label'] in STEP, f'Unknown statement {o["label"]!r}')
            true, needs = STEP[o['label']]
            if true and o['label'] not in shown and needs <= have:
                good.append(o['id'])
        return only(good, 'next step')
    if 'Which reason justifies that inner radius?' in prompt:
        return judge(opts, SPHERE_QUESTIONS['Which reason justifies that inner radius?'], 'reason')
    if 'has radius $\\sqrt{r^2-y^2}$. Why?' in prompt:
        return judge(opts, SPHERE_QUESTIONS['Why?'], 'reason')
    if 'Which fact lets the argument go from Step 4 to Step 5?' in prompt:
        return judge(opts, SPHERE_QUESTIONS['Which fact lets the argument go from Step 4 to Step 5?'], 'fact')
    if 'computes the volume of the cylinder with the cone removed as $\\pi r^3-\\frac13\\pi r^3$. Why?' in prompt:
        return judge(opts, SPHERE_QUESTIONS['Why?volume'], 'reason')
    q = "Which argument correctly and completely shows that the hemisphere's volume is $\\frac23\\pi r^3$?"
    require(q in prompt, 'Unknown sphere question')
    return judge(opts, SPHERE_QUESTIONS[q], 'argument')


# ------------------------------------------- 3. other solids and the principle

OTHER_QUESTIONS = {
    'Which argument shows that its volume is $\\pi r^2h$?': {
        'Slices parallel to the base are circles of radius $r$, as in a right cylinder of height $h$; by Cavalieri, $\\pi r^2h$.': True,
        'It is the right cylinder turned on its side, so the two are congruent.': False,  # leaning changes the shape
        'Its volume is $\\pi r^2$ times the length of its slanted side.': False,  # the slant is longer than h
        'Its curved surface is larger, so its volume is larger than $\\pi r^2h$.': False,
    },
    'Which reason shows that their slices at each height $y$ above the base have equal areas?': {
        'Each slice is its base scaled by $\\frac{h-y}{h}$, so both slice areas are $B\\left(\\frac{h-y}{h}\\right)^2$.': True,
        'Both slices are circles.': False,  # a pyramid's slices are polygons
        'Both slices have area $B$ at every height.': False,  # both narrow to the tip
        'Both areas are $B\\cdot\\frac{h-y}{h}$, since lengths scale by $\\frac{h-y}{h}$.': False,  # areas scale by the square
    },
    'What follows?': {
        "The cone's volume equals the pyramid's: $\\frac13Bh$.": True,
        'The cone and the pyramid are congruent.': False,
        "The cone's volume is $Bh$, like a prism's.": False,
        'The cone has the larger volume, because its base is round.': False,
    },
    'Does Cavalieri\'s principle show that they have equal volumes?': {
        'No: at $y=\\frac r2$ the slices are $\\frac34\\pi r^2$ and $\\frac14\\pi r^2$, so they are not equal at every height.':
            abs(hemisphere(R, R / 2) - 0.75 * math.pi * R * R) < 1e-9 and abs(cone_up(R, R / 2) - 0.25 * math.pi * R * R) < 1e-9,
        'Yes: they have the same base area and the same height.': False,
        'Yes: their slices are equal at the bottom and at the top.': False,
        "No: Cavalieri's principle applies only to prisms.": False,
    },
    'Which is a correct statement of Cavalieri\'s principle?': {
        'Two solids of the same height whose slices at every height have equal areas have equal volumes.': True,
        'Two solids of the same height whose bases have equal areas have equal volumes.': False,
        'Two solids of the same height whose slices at every height have equal perimeters have equal volumes.': False,
        'Two solids of the same height whose slices at every height have equal areas have equal surface areas.': False,
    },
}
FLAW_RULES = {
    'pyramid': {
        "Cavalieri needs equal slices at every height; the pyramid's slices shrink to 0, the prism's stay $B$.": True,
        "Cavalieri's principle applies only to solids of the same shape.": False,
        'Nothing is wrong.': False,  # Bh/3 is not Bh
        'The bases must also have the same perimeter.': False,
    },
    'cone': {
        'Cavalieri needs equal slices at every height; here they are $\\pi(r^2-y^2)$ and $\\pi(r-y)^2$.': not same(hemisphere, cone_up),
        "The cone's height should be $2r$.": False,
        "Cavalieri's principle applies only to solids of the same shape.": False,
        'Nothing is wrong.': same(hemisphere, cone_up),
    },
}


def solve_other(public):
    prompt = public['prompt']
    opts = public['response']['options']
    require(public['response']['kind'] == 'choice' and len(opts) == 4 and len({o['label'] for o in opts}) == 4, 'Four distinct options')
    if prompt.startswith('A stack of identical coins of radius'):
        m = re.fullmatch(r'A stack of identical coins of radius (\d+) cm is (\d+) cm tall\. It is pushed so that it leans: its slanted side is now (\d+) cm long, '
                         r'and its height is still \2 cm\. Which quantity stays the same, and so keeps the volume at \$(\d+)\\pi\$ cm³\?', prompt)
        require(m is not None, 'Unreadable stack')
        r, h, s, v = (int(x) for x in m.groups())
        require(s > h and v == r * r * h, 'The stated volume is pi r^2 h')
        rules = {
            # Each slice is a coin; its area times the height is the volume.
            f'The area of every horizontal slice, ${r * r}\\pi$ cm²': True,
            f'The length of its side, {h} cm': False,  # the side is now s cm
            # The leaning side meets the table at asin(h / s) degrees, which is
            # 90 only while the stack stands straight (s = h).
            'The angle between its side and the table, $90^\\circ$': abs(math.degrees(math.asin(h / s)) - 90) < 1e-9,
            'Nothing: leaning changes the volume too': False,
        }
        return judge(opts, rules, 'quantity')
    if 'cut into three pyramids' in prompt:
        m = re.search(r'Why do \$(\w)\$-\$(\w{3})\$ and \$(\w)\$-\$(\w{3})\$(?:, written \$(\w)\$-\$(\w{3})\$,)? have equal volumes\?', prompt)
        require(m is not None and 'three different side lengths' in prompt, 'Unreadable dissection')
        first = (m[1], m[2])
        second = (m[5], m[6]) if m[5] else (m[3], m[4])
        # Prism ABC-DEF: ABC and DEF are its congruent ends; BCFE is a
        # parallelogram face that diagonal BF halves.
        ends = {first, second} == {('D', 'ABC'), ('B', 'DEF')}
        halves = {first, second} == {('D', 'BCF'), ('D', 'BEF')}
        require(ends or halves, 'Unknown pair of pyramids')
        rules = {
            'Their bases $ABC$ and $DEF$ are congruent and their heights are equal, so Cavalieri gives equal volumes.': ends,
            'Bases $BCF$ and $BEF$ are congruent halves of face $BCFE$ and tip $D$ is shared, so Cavalieri gives equal volumes.': halves,
            # With three different base sides the two pyramids have different
            # edge lengths, so they are not congruent.
            'They are congruent pyramids.': False,
            'They share a face, so they have equal volumes.': False,  # sharing a face says nothing about volume
            'Each is half of the prism.': False,  # three pyramids, not two
        }
        return judge(opts, rules, 'reason')
    if 'A student says:' in prompt:
        if 'a pyramid and a prism with the same base area $B$ and the same height $h$' in prompt:
            return judge(opts, FLAW_RULES['pyramid'], 'flaw')
        require('a cone of radius $r$ and height $r$ has the same base area and height as a hemisphere of radius $r$' in prompt, 'Unknown claim')
        return judge(opts, FLAW_RULES['cone'], 'flaw')
    for question, rules in OTHER_QUESTIONS.items():
        if prompt.endswith(question):
            return judge(opts, rules, 'answer')
    raise ValueError('Unknown question')


def solve(public):
    template = public['templateId']
    require(template in SUPPORTED, 'Unexpected template')
    if template == 'cavalieri-slice-area-check':
        return solve_slices(public)
    if template == 'cavalieri-sphere-argument':
        return solve_sphere(public)
    return solve_other(public)


def review_problem(problem):
    return solve(problem['public'])


# -------------------------------------------------------------- tests

def _must_fail(public):
    try:
        solve(public)
    except ValueError:
        return
    raise AssertionError('Accepted a corrupted fixture')


def _choice(labels):
    return {'kind': 'choice', 'options': [{'id': f'option-{"abcd"[i]}', 'label': x} for i, x in enumerate(labels)]}


def self_test():
    import copy
    slices = {'templateId': 'cavalieri-slice-area-check', 'figure': {'kind': 'scene', 'scene': {'elements': [{'id': 'ybrace', 'label': '3'}]}},
              'prompt': 'A hemisphere of radius 5 cm stands beside a cylinder of radius 5 cm and height 5 cm with a cone removed. '
                        "The cone's tip is at the center of the cylinder's base, and its base is the cylinder's top. A plane at height 3 cm cuts both solids.",
              'response': {'kind': 'multi-part-choice', 'blanks': [
                  {'id': 'hemi', 'label': "Area of the hemisphere's slice", 'options': [{'id': c, 'label': f'${v}\\pi$ cm²'} for c, v in zip('abcd', (25, 16, 9, 4))]},
                  {'id': 'ring', 'label': 'Area of the ring-shaped slice of the other solid', 'options': [{'id': c, 'label': f'${v}\\pi$ cm²'} for c, v in zip('abcd', (4, 9, 16, 25))]},
                  {'id': 'means', 'label': 'What the two slices show', 'options': [
                      {'id': 'a', 'label': 'The slices are equal, so the two solids are congruent'},
                      {'id': 'b', 'label': 'Equal here; if equal at every height, Cavalieri gives equal volumes'},
                      {'id': 'c', 'label': 'The slices differ, so the volumes differ'},
                      {'id': 'd', 'label': 'One equal slice is enough to conclude equal volumes'}]}]}}
    require(solve(slices) == '{"hemi":"b","ring":"c","means":"b"}', 'Sphere slices at y = 3')
    plane = copy.deepcopy(slices)
    plane['figure']['scene']['elements'][0]['label'] = '4'
    _must_fail(plane)
    two = copy.deepcopy(slices)
    two['response']['blanks'][0]['options'][0]['label'] = '$16\\pi$ cm²'
    _must_fail(two)
    vol = {'templateId': 'cavalieri-slice-area-check', 'figure': {'kind': 'scene', 'scene': {'elements': []}},
           'prompt': 'In the sphere argument, a hemisphere of radius 3 cm has the same volume as a cylinder of radius 3 cm and height 3 cm with a cone of the same base and height removed. Finish the computation.',
           'response': {'kind': 'multi-part-choice', 'blanks': [
               {'id': 'cyl', 'label': 'Volume of the cylinder', 'options': [{'id': 'a', 'label': '$9\\pi$ cm³'}, {'id': 'b', 'label': '$27\\pi$ cm³'}]},
               {'id': 'cone', 'label': 'Volume of the removed cone', 'options': [{'id': 'a', 'label': '$9\\pi$ cm³'}, {'id': 'b', 'label': '$\\frac{27}{2}\\pi$ cm³'}]},
               {'id': 'hemi', 'label': 'Volume of the hemisphere', 'options': [{'id': 'a', 'label': '$27\\pi$ cm³'}, {'id': 'b', 'label': '$18\\pi$ cm³'}]},
               {'id': 'sphere', 'label': 'Volume of the whole sphere', 'options': [{'id': 'a', 'label': '$36\\pi$ cm³'}, {'id': 'b', 'label': '$18\\pi$ cm³'}]}]}}
    require(solve(vol) == '{"cyl":"b","cone":"a","hemi":"b","sphere":"a"}', 'Volumes for r = 3')
    flaw = {'templateId': 'cavalieri-sphere-argument',
            'prompt': 'A student argues: Step 1: Remove from a cylinder of radius $r$ and height $r$ a cone whose tip is at the center of the top and whose base is the bottom. '
                      'Step 2: A hemisphere of radius $r$ has slice area $\\pi(r^2-y^2)$ at height $y$. '
                      'Step 3: The ring at height $y$ has inner radius $y$, so its area is $\\pi r^2-\\pi y^2$. '
                      "Step 4: The slices match, so by Cavalieri's principle the hemisphere's volume is $\\pi r^3-\\frac13\\pi r^3=\\frac23\\pi r^3$. Which step is wrong, and why?",
            'response': _choice(['Step 3: with the tip on top, the inner radius at height $y$ is $r-y$, so the slices are not equal.',
                                 'Nothing is wrong: the conclusion is correct, so the argument is correct.',
                                 "Step 2: the hemisphere's slice area should be $\\pi(r-y)^2$.",
                                 'Step 4: the cone should be subtracted twice.'])}
    require(solve(flaw) == 'option-a', 'Inverted cone: step 3')
    upright = copy.deepcopy(flaw)
    upright['prompt'] = upright['prompt'].replace('whose tip is at the center of the top and whose base is the bottom', 'whose tip is at the center of the bottom')
    _must_fail(upright)  # Step 1 no longer matches a known construction, or no step is wrong
    statement = {'templateId': 'cavalieri-other-solids-argument', 'prompt': "Which is a correct statement of Cavalieri's principle?",
                 'response': _choice(['Two solids of the same height whose bases have equal areas have equal volumes.',
                                      'Two solids of the same height whose slices at every height have equal areas have equal volumes.',
                                      'Two solids of the same height whose slices at every height have equal perimeters have equal volumes.',
                                      'Two solids of the same height whose slices at every height have equal areas have equal surface areas.'])}
    require(solve(statement) == 'option-b', 'Statement of the principle')
    dup = copy.deepcopy(statement)
    dup['response']['options'][0]['label'] = 'Two solids of the same height whose slices at every height have equal areas have equal volumes.'
    _must_fail(dup)
    return 7


if __name__ == '__main__':
    print(self_test())
