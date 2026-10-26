"""Independent review of geometry measurement/modeling practice.

Every answer is derived from the public prompt, choices and figure only.
Exact arithmetic is used (Fraction, with pi and square roots kept symbolic);
the only rounding is the one the prompt states.
"""
import copy
import math
import re
from fractions import Fraction

SOLID = 'solid-volume-context'
DENSITY = 'density-context'
MODEL = 'geometric-model-choice'
DESIGN = 'geometric-design-constraint'
CAVALIERI = 'cavalieri-volume-reasoning'
REVOLUTION = 'section-revolution-solid'
SIMILARITY = 'similarity-theorem-length'
SUPPORTED = frozenset({SOLID, DENSITY, MODEL, DESIGN, CAVALIERI, REVOLUTION, SIMILARITY})

NUM = r'\d+(?:\.\d+)?'


def require(condition, message):
    if not condition:
        raise ValueError(message)


def frac(text):
    return Fraction(text)


def numbers(text):
    return [frac(x) for x in re.findall(NUM, text)]


def isqrt_exact(n):
    """Square root of a Fraction when exact, else None."""
    n = Fraction(n)
    a, b = math.isqrt(n.numerator), math.isqrt(n.denominator)
    return Fraction(a, b) if a * a == n.numerator and b * b == n.denominator else None


# A value is (coefficient, kind) where kind is '' , 'pi' or 'sqrt' (coefficient then holds the radicand).
def parse_value(label):
    """Parse '$17\\pi$ L', '$\\frac{20}{3}$ m', '12.5 kg', '$\\sqrt{15}$' ... -> (value, unit)."""
    text = label.replace('$', '').strip()
    m = re.fullmatch(
        r'(?:\\frac\{(\d+)\}\{(\d+)\}|(' + NUM + r')|\\sqrt\{(\d+)\})?(\\pi)?\s*(.*)', text)
    require(m is not None, f'Unreadable choice: {label}')
    f1, f2, plain, root, pi, unit = m.groups()
    require(not (root and pi), f'Unsupported choice: {label}')
    if f1:
        coef = Fraction(int(f1), int(f2))
    elif plain:
        coef = frac(plain)
    elif root:
        coef = Fraction(int(root))
    else:
        require(pi, f'No value in choice: {label}')
        coef = Fraction(1)
    kind = 'pi' if pi else 'sqrt' if root else ''
    return (coef, kind), unit.strip()


def same_value(a, b):
    return a == b


def pick(options, expected, unit=None, what='answer'):
    """Return the single option id whose value (and unit) equals expected."""
    values = []
    for option in options:
        value, got_unit = parse_value(option['label'])
        values.append((value, got_unit))
    require(len({v for v, _ in values}) == len(values), f'{what}: mathematically duplicate choices')
    matches = [o['id'] for o, (v, u) in zip(options, values)
               if v == expected and (unit is None or u == unit)]
    require(len(matches) == 1, f'{what}: expected {expected} {unit} matches {len(matches)} choices')
    return matches[0]


def require_choice(public, count=4):
    response = public['response']
    require(response['kind'] == 'choice', 'Choice response expected')
    options = response['options']
    require(len(options) == count and len({o['id'] for o in options}) == count, 'Four distinct choice ids required')
    require(len({o['label'].strip().lower() for o in options}) == count, 'Duplicate choice text')
    require(not any(re.search(r'\d\.\d{4,}', o['label']) for o in options), 'Unrounded decimal in a choice')
    return options


def sqrt_pair(squared):
    """Express a positive Fraction squared value as a parse_value-style value."""
    root = isqrt_exact(squared)
    if root is not None:
        return (root, '')
    return None


def sqrt_value(n):
    """Value of sqrt(n) for a positive Fraction n, matching the label forms '5' or '\\sqrt{n}'."""
    root = isqrt_exact(n)
    if root is not None:
        return (root, '')
    require(n.denominator == 1, 'Non-integer radicand')
    return (Fraction(n.numerator), 'sqrt')


def round_half_up(x, places=1):
    scale = 10 ** places
    return Fraction(math.floor(x * scale + Fraction(1, 2)), scale)


# ----------------------------------------------------------------------------------------------
def solve_solid(public):
    prompt = public['prompt']
    options = require_choice(public)
    pi_value = None
    if prompt.startswith('A silo'):
        r, h = numbers(prompt.split('The cylinder')[1])[:2]
        # cylinder pi r^2 h + hemisphere (2/3) pi r^3
        return pick(options, (r * r * h + Fraction(2, 3) * r ** 3, 'pi'), 'cubic meters', 'silo')
    if prompt.startswith('A conical pile'):
        r, v = numbers(prompt)[:2]
        require(r > 0, 'radius')
        return pick(options, (3 * v / (r * r), ''), 'm', 'gravel height')
    if prompt.startswith('A glass pyramid'):
        s, h = numbers(prompt)[:2]
        return pick(options, (s * s * h / 3, ''), 'cubic meters', 'pyramid')
    if prompt.startswith('A cone-shaped paper cup'):
        r, h, big_r, big_h = numbers(prompt)[:4]
        cup = Fraction(1, 3) * r * r * h
        jar = big_r * big_r * big_h
        count = jar / cup
        require(count.denominator == 1, 'Non-integer number of cups: ambiguous "full cups"')
        return pick(options, (count, ''), 'cups', 'cups')
    if prompt.startswith('A spherical water tank'):
        d = numbers(prompt)[0]
        return pick(options, (Fraction(4, 3) * (d / 2) ** 3, 'pi'), 'cubic meters', 'sphere')
    liters = re.search(r'One liter is (\d+) cm³', prompt)
    require(liters is not None, 'Liter conversion must be stated')
    per_liter = Fraction(int(liters[1]))
    require(per_liter == 1000, 'Wrong liter conversion')
    if prompt.startswith('A cylindrical paint can'):
        m = re.search(r'radius of (' + NUM + r') cm and a height of (' + NUM + r') cm\. Use (' + NUM + r') for', prompt)
        require(m is not None, 'Paint-can givens')
        r, h, pi_value = frac(m[1]), frac(m[2]), frac(m[3])
        require(pi_value in (Fraction('3.14'), Fraction(22, 7)), 'Unexpected pi approximation')
        exact = pi_value * r * r * h / per_liter
        # Reject answers that sit on a rounding boundary: the stated rounding must be unambiguous.
        require(abs(exact * 10 - math.floor(exact * 10) - Fraction(1, 2)) > Fraction(1, 1000), 'Rounding tie')
        return pick(options, (round_half_up(exact), ''), 'L', 'paint can')
    m = re.fullmatch(r'A cylindrical tank has a (diameter|radius) of (' + NUM + r') cm and a height of (' + NUM + r') cm\..*', prompt)
    require(m is not None, f'Unknown solid-volume prompt: {prompt}')
    r = frac(m[2]) / (2 if m[1] == 'diameter' else 1)
    h = frac(m[3])
    return pick(options, (r * r * h / per_liter, 'pi'), 'L', 'tank')


# ----------------------------------------------------------------------------------------------
DENSITY_MATERIALS = {'iron': Fraction('7.9'), 'aluminum': Fraction('2.7'), 'lead': Fraction('11.3'), 'silver': Fraction('10.5'), 'steel': Fraction('7.8')}


def solve_density(public):
    prompt = public['prompt']
    options = require_choice(public)
    if prompt.startswith('A rectangular nature reserve'):
        l, w, people = numbers(prompt)[:3]
        return pick(options, (people / (l * w), ''), 'people per km²', 'reserve')
    if prompt.startswith('A county'):
        area, people = numbers(prompt)[:2]
        return pick(options, (people / area, ''), 'people per km²', 'county')
    if prompt.startswith('A solid steel rod'):
        m = re.search(r'radius of (' + NUM + r') cm and a length of (' + NUM + r') cm\. Assume steel has a density of (' + NUM + r') g/cm³', prompt)
        require(m is not None, 'rod givens')
        r, l, rho = frac(m[1]), frac(m[2]), frac(m[3])
        return pick(options, (rho * r * r * l, 'pi'), 'g', 'rod')
    if prompt.startswith('Block'):
        blocks = {}
        for name, mass, volume in re.findall(r'Block ([AB]) has a mass of (' + NUM + r') g and a volume of (' + NUM + r') cm³', prompt):
            blocks[name] = frac(mass) / frac(volume)
        require(set(blocks) == {'A', 'B'}, 'Both blocks must be stated')
        require(blocks['A'] != blocks['B'], 'Blocks tie on density')
        best = max(blocks, key=blocks.get)
        found = []
        for option in options:
            m = re.fullmatch(r'Block ([AB]), (.+?) g/cm³', option['label'])
            require(m is not None, f'Block choice: {option["label"]}')
            value, _ = parse_value(m[2])
            if m[1] == best and value == (blocks[best], ''):
                found.append(option['id'])
        require(len(found) == 1, 'Block-density answer is missing or ambiguous')
        # Distractors must not be a correct (block, density) pair for the other block either.
        return found[0]
    m = re.fullmatch(r"A sample of (\w+) has a mass of (" + NUM + r") g\. The density of \1 is (" + NUM + r") g/cm³\. What is the sample's volume, in cm³\?", prompt)
    if m:
        require(DENSITY_MATERIALS[m[1]] == frac(m[3]), f'Unrealistic {m[1]} density {m[3]}')
        return pick(options, (frac(m[2]) / frac(m[3]), ''), 'cm³', 'sample volume')
    m = re.fullmatch(r"A solid block of (\w+) has a volume of (" + NUM + r") cm³\. The density of \1 is (" + NUM + r") g/cm³\. What is the block's mass, in (grams|kilograms)\?(?: \((\d+) kg = (\d+) g\))?", prompt)
    require(m is not None, f'Unknown density prompt: {prompt}')
    require(DENSITY_MATERIALS[m[1]] == frac(m[3]), f'Unrealistic {m[1]} density {m[3]}')
    grams = frac(m[2]) * frac(m[3])
    if m[4] == 'grams':
        return pick(options, (grams, ''), 'g', 'block mass')
    require((m[5], m[6]) == ('1', '1000'), 'kilogram conversion must be stated as 1 kg = 1000 g')
    return pick(options, (grams / 1000, ''), 'kg', 'block mass kg')


# ----------------------------------------------------------------------------------------------
MODEL_RULES = [
    ('six rectangular faces', 'Rectangular prism'),
    ('same circular cross-section', 'Cylinder'),
    ('narrows evenly to one point', 'Cone'),
    ('two equal circular ends joined by a curved side', 'Cylinder'),
    ('same distance from its center to every point', 'Sphere'),
    ('two triangular ends joined by three rectangular panels', 'Triangular prism'),
]
MEASURE_RULES = [
    ('along its edges', 'Perimeter'),
    ('fence around', 'Perimeter'),
    ('cover it with sod', 'Area'),
    ('paint the floor', 'Area'),
    ('paint its outside faces', 'Surface area'),
    ('wrap all of its faces', 'Surface area'),
    ('fills it', 'Volume'),
]


def solve_model(public):
    prompt = public['prompt']
    options = require_choice(public)
    if 'best geometric model' in prompt:
        hits = [name for key, name in MODEL_RULES if key in prompt]
        require(len(hits) == 1, f'Model description not recognized: {prompt}')
        labels = [o['label'] for o in options]
        require(labels.count(hits[0]) == 1, 'Best model must be one choice')
        return options[labels.index(hits[0])]['id']
    if 'Which measure' in prompt:
        hits = [name for key, name in MEASURE_RULES if key in prompt]
        require(len(hits) == 1, f'Measure cue not recognized: {prompt}')
        labels = [o['label'] for o in options]
        require(labels.count(hits[0]) == 1, 'Measure must be one choice')
        return options[labels.index(hits[0])]['id']
    if prompt.startswith('A pup tent'):
        b, h, length = numbers(prompt)[:3]
        return pick(options, (b * h * length / 2, ''), 'cubic meters', 'tent')
    if prompt.startswith('A can of beans'):
        r, h = numbers(prompt)[:2]
        require('no overlap' in prompt and 'covers no part of the ends' in prompt, 'Label conditions')
        return pick(options, (2 * r * h, 'pi'), 'cm²', 'label')
    if prompt.startswith('A soccer ball'):
        d = numbers(prompt)[0]
        return pick(options, (d * d, 'pi'), 'cm²', 'ball')  # 4*pi*(d/2)^2 = pi*d^2
    raise ValueError(f'Unknown model prompt: {prompt}')


# ----------------------------------------------------------------------------------------------
def solve_design(public):
    prompt = public['prompt']
    options = require_choice(public)
    if prompt.startswith('A rectangular garden'):
        fence = numbers(prompt.split('You have')[1])[0]
        require('three sides' in prompt and 'use all of it' in prompt, 'Constraint wording')
        areas = []
        for o in options:
            m = re.fullmatch(r'Width (' + NUM + r') m, length (' + NUM + r') m', o['label'])
            require(m is not None, f'Garden choice: {o["label"]}')
            w, l = frac(m[1]), frac(m[2])
            require(2 * w + l == fence, f'Option {o["label"]} does not use exactly {fence} m of fence')
            areas.append(w * l)
        return _unique_best(options, areas, max, 'garden')
    if prompt.startswith('A box must hold exactly'):
        volume = numbers(prompt)[0]
        areas = []
        for o in options:
            m = re.fullmatch(r'(\d+) × (\d+) × (\d+) cm', o['label'])
            require(m is not None, f'Box choice: {o["label"]}')
            l, w, h = (int(x) for x in m.groups())
            require(l * w * h == volume, f'Box {o["label"]} does not hold {volume} cm³')
            areas.append(2 * (l * w + l * h + w * h))
        return _unique_best(options, areas, min, 'box')
    if prompt.startswith('You have') and 'rectangular pen' in prompt:
        fence = numbers(prompt)[0]
        require('use all of it' in prompt and 'whole-number' in prompt, 'Constraint wording')
        areas = []
        for o in options:
            m = re.fullmatch(r'(\d+) m by (\d+) m', o['label'])
            require(m is not None, f'Pen choice: {o["label"]}')
            a, b = int(m[1]), int(m[2])
            require(2 * (a + b) == fence, f'Pen {o["label"]} does not use exactly {fence} m')
            areas.append(a * b)
        # The offered options are the whole universe only if the prompt says so; otherwise the
        # true whole-number optimum (the most square pair) must itself be offered.
        best_square = (fence // 4) * (fence // 2 - fence // 4)
        require('Which of these' in prompt or max(areas) == best_square, 'Pen prompt asks for the unrestricted optimum but it is not offered')
        return _unique_best(options, areas, max, 'pen')
    m = re.fullmatch(r'A wall is (\d+) m wide and (\d+) m tall\. A window (\d+) m wide and (\d+) m tall is not painted\. Paint costs (\d+) dollars per square meter\. How much does it cost to paint the rest of the wall\?', prompt)
    require(m is not None, f'Unknown design prompt: {prompt}')
    ww, wh, dw, dh, price = (int(x) for x in m.groups())
    require(dw <= ww and dh <= wh, 'Window does not fit in wall')
    return pick(options, (Fraction((ww * wh - dw * dh) * price), ''), 'dollars', 'wall')


def _unique_best(options, scores, chooser, what):
    best = chooser(scores)
    require(scores.count(best) == 1, f'{what}: optimum is tied')
    return options[scores.index(best)]['id']


# ----------------------------------------------------------------------------------------------
def scene_elements(public):
    figure = public.get('figure')
    require(figure is not None and figure['kind'] == 'scene', 'Figure required')
    return figure['scene']['elements']


def solve_cavalieri(public):
    prompt = public['prompt']
    options = require_choice(public)
    if prompt.startswith('Which pair'):
        require(public.get('figure') is None, 'Pair question has no figure')
        good = []
        for o in options:
            label = o['label']
            kinds = re.findall(r'cylinder|square prism|square pyramid|cone', label)
            heights = [frac(x) for x in re.findall(r'(' + NUM + r') cm tall', label)]
            areas = [frac(x) for x in re.findall(r'(' + NUM + r') cm²', label)]
            require(len(kinds) == 2, f'Pair kinds: {label}')
            prism_like = all(k in ('cylinder', 'square prism') for k in kinds)
            same_height = len(set(heights)) == 1
            same_area = len(set(areas)) == 1
            require(len(heights) in (1, 2) and len(areas) in (1, 2), f'Pair numbers: {label}')
            if prism_like and same_height and same_area:
                good.append(o['id'])
        require(len(good) == 1, 'Exactly one pair must be forced equal')
        return good[0]
    if prompt.startswith('An oblique'):
        m = re.match(r'An oblique \(slanted\) cylinder has circular bases of radius (' + NUM + r') cm\. Its perpendicular height is (' + NUM + r') cm and its slanted side is (' + NUM + r') cm long', prompt)
        require(m is not None, 'Oblique givens')
        r, h, slant = frac(m[1]), frac(m[2]), frac(m[3])
        # The side-view parallelogram must agree with the givens.
        polygon = next(e for e in scene_elements(public) if e['type'] == 'polygon')['points']
        xs = sorted({p[0] for p in polygon})
        ys = sorted({p[1] for p in polygon})
        bottom = [p for p in polygon if p[1] == ys[0]]
        top = [p for p in polygon if p[1] == ys[-1]]
        require(len(bottom) == 2 and len(top) == 2, 'Parallelogram bases')
        require(abs(abs(bottom[0][0] - bottom[1][0]) - 2 * r) < 1e-9, 'Base width is not the diameter')
        require(abs(abs(top[0][0] - top[1][0]) - 2 * r) < 1e-9, 'Top width is not the diameter')
        require(abs((ys[-1] - ys[0]) - h) < 1e-9, 'Figure height differs from perpendicular height')
        sides = [math.hypot(polygon[i][0] - polygon[(i + 1) % 4][0], polygon[i][1] - polygon[(i + 1) % 4][1]) for i in range(4)]
        require(any(abs(s - slant) < 1e-9 for s in sides), 'Figure slant differs from stated slant')
        require(slant > h, 'Slanted side must exceed the height')
        texts = [e['text'] for e in scene_elements(public) if e['type'] == 'text']
        require(sorted(texts) == sorted([f'diameter {2 * r} cm'.replace('.0', ''), f'{h} cm', f'{slant} cm']), f'Figure labels {texts}')
        return pick(options, (r * r * h, 'pi'), 'cm³', 'oblique cylinder')
    m = re.fullmatch(r'(\d+) identical foam sheets, each a rectangle (' + NUM + r') cm by (' + NUM + r') cm and (' + NUM + r') cm thick, are stacked straight\..*What is the volume of the leaning stack, in cubic centimeters\?', prompt)
    if m:
        n, a, b, t = frac(m[1]), frac(m[2]), frac(m[3]), frac(m[4])
        return pick(options, (n * a * b * t, ''), 'cm³', 'foam')
    m = re.fullmatch(r'Solids X and Y are both (\d+) cm tall\. At every height, the horizontal slice of X has area (?:(\d+)/(\d+)|(\d+) times) the area of the slice of Y at that height\. Solid Y has a volume of (' + NUM + r') cm³\. What is the volume of solid X\?', prompt)
    require(m is not None, f'Unknown Cavalieri prompt: {prompt}')
    ratio = Fraction(int(m[2]), int(m[3])) if m[2] else Fraction(int(m[4]))
    return pick(options, (ratio * frac(m[5]), ''), 'cm³', 'slice ratio')


# ----------------------------------------------------------------------------------------------
def line_frame(axis):
    (x1, y1), (x2, y2) = axis['from'], axis['to']
    length = math.hypot(x2 - x1, y2 - y1)
    ux, uy = (x2 - x1) / length, (y2 - y1) / length

    def along(p):
        return (p[0] - x1) * ux + (p[1] - y1) * uy

    def dist(p):
        return abs(-(p[0] - x1) * uy + (p[1] - y1) * ux)
    return along, dist


def figure_axis(public):
    axes = [e for e in scene_elements(public) if e['type'] == 'segment' and e.get('dash')]
    require(len(axes) == 1, 'Exactly one dashed axis required')
    return axes[0]


def rounded_int(x):
    r = round(x)
    require(abs(x - r) < 1e-9, f'Figure dimension {x} is not a whole number')
    return Fraction(r)


def revolve_from_figure(public):
    """Return ('cylinder'|'cone'|'sphere', radius, height) measured from the drawn figure."""
    elements = scene_elements(public)
    axis = figure_axis(public)
    along, dist = line_frame(axis)
    polygons = [e for e in elements if e['type'] == 'polygon']
    arcs = [e for e in elements if e['type'] == 'arc']
    require(len(polygons) + len(arcs) == 1, 'One revolved figure required')
    if arcs:
        arc = arcs[0]
        require(dist(arc['center']) < 1e-9, 'Axis must pass through the arc center')
        require(abs(arc['to'] - arc['from']) == 180, 'Semicircle expected')
        return 'sphere', rounded_int(arc['r']), None
    points = polygons[0]['points']
    on_axis = [p for p in points if dist(p) < 1e-9]
    require(len(on_axis) >= 2, 'Axis must contain a side of the figure')
    radius = rounded_int(max(dist(p) for p in points))
    height = rounded_int(max(along(p) for p in on_axis) - min(along(p) for p in on_axis))
    return ('cylinder' if len(points) == 4 else 'cone'), radius, height


def solve_revolution(public):
    prompt = public['prompt']
    options = require_choice(public)
    if prompt.startswith('A plane'):
        require(public.get('figure') is None, 'Cross-section question has no figure')
        rules = [
            ('contains the axis of a cylinder', 'Rectangle'),
            ('contains the axis of a cone', 'Triangle'),
            ('cuts a sphere', 'Circle'),
            ('parallel to the bases cuts a cylinder', 'Circle'),
            ('tilted to the axis cuts all the way across the curved side of a cylinder', 'Ellipse'),
            ('parallel to the base cuts a cone', 'Circle'),
        ]
        hits = [name for key, name in rules if key in prompt]
        require(len(hits) == 1, f'Cross-section not recognized: {prompt}')
        labels = [o['label'] for o in options]
        require(labels.count(hits[0]) == 1, 'Cross-section must be one choice')
        return options[labels.index(hits[0])]['id']
    solid, radius, height = revolve_from_figure(public)
    texts = {e['text'] for e in scene_elements(public) if e['type'] == 'text'}
    if prompt.startswith('A semicircle'):
        r = numbers(prompt)[0]
        require(radius == r, 'Figure radius differs from stated radius')
        require(f'radius {r} cm' in texts, 'Figure label')
        return pick(options, (Fraction(4, 3) * r ** 3, 'pi'), 'cm³', 'sphere')
    given = sorted(numbers(prompt.split('.')[0]))
    if prompt.startswith('A rectangle'):
        require(solid == 'cylinder', 'Figure is not a rectangle')
        require(sorted([radius, height]) == given, 'Figure sides differ from stated dimensions')
        require(texts >= {f'{radius} cm', f'{height} cm'} or texts >= {f'{height} cm', f'{radius} cm'}, 'Figure labels')
        if 'Which solid' in prompt:
            wanted = f'A cylinder with radius {radius} cm and height {height} cm'
            labels = [o['label'] for o in options]
            require(labels.count(wanted) == 1, 'Cylinder with the swept radius must be a single choice')
            return options[labels.index(wanted)]['id']
        return pick(options, (radius * radius * height, 'pi'), 'cm³', 'rectangle revolution')
    if prompt.startswith('A right triangle'):
        require(solid == 'cone', 'Figure is not a triangle')
        require(sorted([radius, height]) == given, 'Figure legs differ from stated legs')
        if 'Which solid' in prompt:
            wanted = f'A cone with radius {radius} cm and height {height} cm'
            labels = [o['label'] for o in options]
            require(labels.count(wanted) == 1, 'Cone with the swept radius must be a single choice')
            return options[labels.index(wanted)]['id']
        return pick(options, (Fraction(1, 3) * radius * radius * height, 'pi'), 'cm³', 'cone revolution')
    raise ValueError(f'Unknown revolution prompt: {prompt}')


# ----------------------------------------------------------------------------------------------
def labelled_points(public):
    points = {}
    for e in scene_elements(public):
        if e['type'] == 'text' and re.fullmatch(r'[A-E]', e['text']):
            points[e['text']] = tuple(e['at'])
    return points


def midpoint(a, b):
    return ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)


def close(a, b, tol=1e-6):
    return abs(a[0] - b[0]) < tol and abs(a[1] - b[1]) < tol


def check_segment_labels(public, pts, given, unknown):
    """Every number label sits at its segment's midpoint; '?' at the unknown segment."""
    seg = lambda name: midpoint(pts[name[0]], pts[name[1]])
    expected = [(str(v), seg(n)) for n, v in given.items()] + [('?', seg(unknown))]
    texts = [(e['text'], tuple(e['at'])) for e in scene_elements(public)
             if e['type'] == 'text' and (e['text'] == '?' or re.fullmatch(NUM, e['text']))]
    require(len(texts) == len(expected), f'Figure labels {texts} vs {expected}')
    for text, at in expected:
        require(any(t == text and close(a, at) for t, a in texts), f'Figure label {text} is not on its segment')


def solve_similarity(public):
    prompt = public['prompt']
    if prompt.startswith('In right triangle $ABC$'):
        prompt = prompt.replace('$', '')
    options = require_choice(public)
    pts = labelled_points(public)
    dist = lambda a, b: math.hypot(pts[a][0] - pts[b][0], pts[a][1] - pts[b][1])
    outline = next(e for e in scene_elements(public) if e['type'] == 'polygon')['points']
    require(all(any(close(tuple(q), pts[n]) for q in outline) for n in 'ABC') and len(outline) == 3, 'Triangle outline differs from its labelled vertices')
    if prompt.startswith('In right triangle ABC'):
        require(set(pts) == {'A', 'B', 'C', 'D'}, 'Altitude figure points')
        # Figure facts: right angle at C, CD perpendicular to AB, D between A and B.
        ca = (pts['A'][0] - pts['C'][0], pts['A'][1] - pts['C'][1])
        cb = (pts['B'][0] - pts['C'][0], pts['B'][1] - pts['C'][1])
        require(abs(ca[0] * cb[0] + ca[1] * cb[1]) < 1e-6, 'Angle C is not right in the figure')
        ab = (pts['B'][0] - pts['A'][0], pts['B'][1] - pts['A'][1])
        cd = (pts['D'][0] - pts['C'][0], pts['D'][1] - pts['C'][1])
        require(abs(ab[0] * cd[0] + ab[1] * cd[1]) < 1e-6, 'CD is not perpendicular to AB')
        require(abs(dist('A', 'D') + dist('D', 'B') - dist('A', 'B')) < 1e-6, 'D is not between A and B')
        m = re.search(r'AD = (\d+) and DB = (\d+)\. What is the length of (CD|leg AC)\?', prompt)
        if m:
            ad, db = Fraction(int(m[1])), Fraction(int(m[2]))
            require(abs(dist('A', 'D') - ad) < 1e-6 and abs(dist('D', 'B') - db) < 1e-6, 'Figure AD/DB differ from givens')
            if m[3] == 'CD':
                expected, unknown, name = ad * db, 'CD', 'CD'
            else:
                expected, unknown, name = ad * (ad + db), 'AC', 'AC'
            check_segment_labels(public, pts, {'AD': int(ad), 'DB': int(db)}, unknown)
            require(abs(dist(*unknown) - math.sqrt(expected)) < 1e-6, f'Figure {unknown} differs from solved value')
            return pick(options, sqrt_value(expected), None, 'altitude')
        m = re.search(r'AC = (\d+) and AB = (\d+)\. What is the length of AD\?', prompt)
        require(m is not None, f'Unknown altitude prompt: {prompt}')
        ac, ab_len = Fraction(int(m[1])), Fraction(int(m[2]))
        require(abs(dist('A', 'C') - ac) < 1e-6 and abs(dist('A', 'B') - ab_len) < 1e-6, 'Figure AC/AB differ from givens')
        expected = ac * ac / ab_len
        require(abs(dist('A', 'D') - float(expected)) < 1e-6, 'Figure AD differs from solved value')
        check_segment_labels(public, pts, {'AC': int(ac), 'AB': int(ab_len)}, 'AD')
        return pick(options, (expected, ''), None, 'AD')
    prompt = prompt.replace('$', '')
    m = re.fullmatch(r'In triangle ABC, D is on AB and E is on AC, and DE is parallel to BC, as shown\. (.*) What is the length of (DB|EC)\?', prompt)
    require(m is not None, f'Unknown similarity prompt: {prompt}')
    require(set(pts) == {'A', 'B', 'C', 'D', 'E'}, 'Parallel figure points')
    given = {k: Fraction(int(v)) for k, v in re.findall(r'([A-E]{2}) = (\d+)', m[1])}
    unknown = m[2]
    other = 'EC' if unknown == 'DB' else 'DB'
    require(set(given) == {'AD', 'AE', other}, f'Parallel givens {given}')
    if unknown == 'DB':
        value = given['AD'] * given['EC'] / given['AE']
        sides = {'AD': given['AD'], 'DB': value, 'AE': given['AE'], 'EC': given['EC']}
    else:
        value = given['AE'] * given['DB'] / given['AD']
        sides = {'AD': given['AD'], 'DB': given['DB'], 'AE': given['AE'], 'EC': value}
    # Figure: DE || BC, and D and E divide AB and AC in the same ratio as the solved sides.
    de = (pts['E'][0] - pts['D'][0], pts['E'][1] - pts['D'][1])
    bc = (pts['C'][0] - pts['B'][0], pts['C'][1] - pts['B'][1])
    require(abs(de[0] * bc[1] - de[1] * bc[0]) < 1e-6, 'DE is not parallel to BC in the figure')
    t_d = dist('A', 'D') / dist('A', 'B')
    t_e = dist('A', 'E') / dist('A', 'C')
    require(abs(t_d - float(sides['AD'] / (sides['AD'] + sides['DB']))) < 1e-6, 'Figure D position differs from lengths')
    require(abs(t_e - float(sides['AE'] / (sides['AE'] + sides['EC']))) < 1e-6, 'Figure E position differs from lengths')
    check_segment_labels(public, pts, {k: int(v) for k, v in given.items()}, unknown)
    return pick(options, (value, ''), None, unknown)


# ----------------------------------------------------------------------------------------------
SOLVERS = {SOLID: solve_solid, DENSITY: solve_density, MODEL: solve_model, DESIGN: solve_design,
           CAVALIERI: solve_cavalieri, REVOLUTION: solve_revolution, SIMILARITY: solve_similarity}


def solve(public):
    require(public['templateId'] in SUPPORTED, 'Unexpected geometry-modeling family')
    return SOLVERS[public['templateId']](public)


def normalize(text):
    return re.sub(r'\s+', ' ', text.replace('$', '').lower()).strip()


def review_problem(problem):
    public = problem['public']
    result = solve(public)
    require(result == problem['answer'], 'Geometry-modeling answer key mismatch')
    options = public['response']['options']
    correct = next(o for o in options if o['id'] == result)
    # Leakage: neither the prompt nor the hint may state the full correct choice text.
    label = normalize(correct['label'])
    for field in ('prompt', 'hint'):
        text = normalize(public['prompt'] if field == 'prompt' else problem['hint'])
        require(not re.search('[a-z]', label) or not re.search(r'(?<![\d.])' + re.escape(label) + r'(?![\w])', text), f'Correct choice leaks in the {field}')
    # Feedback is written for wrong choices only.
    feedback = problem.get('choiceFeedback') or {}
    require(result not in feedback, 'Feedback attached to the correct choice')
    require(set(feedback) <= {o['id'] for o in options}, 'Feedback for an unknown choice')
    return result


def self_test():
    def make(template, prompt, labels, answer, figure=None):
        public = {'templateId': template, 'prompt': prompt,
                  'response': {'kind': 'choice', 'options': [{'id': f'option-{i}', 'label': label} for i, label in enumerate(labels)]}}
        if figure:
            public['figure'] = figure
        return {'public': public, 'answer': f'option-{answer}', 'hint': 'Think.', 'choiceFeedback': {}}

    def scene(*elements):
        return {'kind': 'scene', 'scene': {'v': 1, 'title': 't', 'elements': list(elements)}}

    def text(s, at):
        return {'type': 'text', 'at': list(at), 'text': s}

    axis = {'type': 'segment', 'dash': 'dash', 'from': [-0.6, 0], 'to': [7.6, 0]}
    rect = lambda w, h: {'type': 'polygon', 'points': [[0, 0], [w, 0], [w, h], [0, h]]}
    rect_fig = scene(rect(7, 2), axis, text('7 cm', (3.5, 0)), text('2 cm', (7, 1)))
    tri_axis = {'type': 'segment', 'dash': 'dash', 'from': [0, -0.6], 'to': [0, 8.6]}
    tri_fig = scene({'type': 'polygon', 'points': [[0, 0], [6, 0], [0, 8]]}, tri_axis, text('6 cm', (3, 0)), text('8 cm', (0, 4)))
    parallel_fig = scene(
        {'type': 'polygon', 'points': [[4, 9], [0, 0], [11, 0]]},
        text('A', (4, 9)), text('B', (0, 0)), text('C', (11, 0)), text('D', (1.6, 3.6)), text('E', (8.2, 3.6)),
        text('6', (2.8, 6.3)), text('?', (0.8, 1.8)), text('6', (6.1, 6.3)), text('4', (9.6, 1.8)))
    altitude_fig = scene(
        {'type': 'polygon', 'points': [[0, 0], [9, 0], [4, 4.47213595499958]]},
        text('A', (0, 0)), text('B', (9, 0)), text('C', (4, 4.47213595499958)), text('D', (4, 0)),
        text('?', (2, 0)), text('9', (4.5, 0)), text('6', (2, 2.23606797749979)))
    oblique_fig = scene({'type': 'polygon', 'points': [[0, 0], [16, 0], [25, 12], [9, 12]]},
                        text('diameter 16 cm', (8, 0)), text('12 cm', (9, 6)), text('15 cm', (20.5, 6)))
    good = [
        make(SOLID, 'A cone-shaped paper cup has a radius of 4 cm and a height of 12 cm. A cylindrical jar has a radius of 16 cm and a height of 12 cm. How many full cups of water does it take to fill the jar?',
             ['32 cups', '12 cups', '16 cups', '48 cups'], 3),
        make(SOLID, 'A cylindrical tank has a radius of 10 cm and a height of 30 cm. One liter is 1000 cm³. How many liters does it hold? Give the capacity in terms of $\\pi$.',
             ['$3\\pi$ L', '$30\\pi$ L', '$9\\pi$ L', '$\\frac{1}{3}\\pi$ L'], 0),
        make(DENSITY, 'A county has an area of 36 square kilometers and a population of 2664 people. What is its population density, in people per square kilometer?',
             ['2628 people per km²', '$\\frac{1}{74}$ people per km²', '95904 people per km²', '74 people per km²'], 3),
        make(DENSITY, 'Block A has a mass of 90 g and a volume of 30 cm³. Block B has a mass of 100 g and a volume of 50 cm³. Which block is denser, and what is its density?',
             ['Block A, 3 g/cm³', 'Block B, 2 g/cm³', 'Block A, 2 g/cm³', 'Block B, 3 g/cm³'], 0),
        make(MODEL, 'A pup tent is modeled as a triangular prism lying on one rectangular face. Each triangular end has a base of 2 m and a height of 2 m, and the tent is 5 m long. How many cubic meters of space are inside the tent?',
             ['$\\frac{20}{3}$ cubic meters', '10 cubic meters', '2 cubic meters', '20 cubic meters'], 1),
        make(DESIGN, 'A rectangular garden will be built against the straight wall of a barn, so fence is needed on only three sides: two sides of equal width and one side parallel to the barn. You have 24 m of fence and will use all of it. Which option encloses the greatest area?',
             ['Width 8 m, length 8 m', 'Width 6 m, length 12 m', 'Width 9 m, length 6 m', 'Width 5 m, length 14 m'], 1),
        make(DESIGN, 'A box must hold exactly 96 cm³ and is made from cardboard, so the box that uses the least cardboard is cheapest. Which of these boxes (length × width × height) uses the least cardboard?',
             ['3 × 4 × 8 cm', '2 × 4 × 12 cm', '4 × 4 × 6 cm', '1 × 8 × 12 cm'], 2),
        make(CAVALIERI, 'Solids X and Y are both 10 cm tall. At every height, the horizontal slice of X has area 3/2 the area of the slice of Y at that height. Solid Y has a volume of 174 cm³. What is the volume of solid X?',
             ['174 cm³', '391.5 cm³', '116 cm³', '261 cm³'], 3),
        make(CAVALIERI, 'An oblique (slanted) cylinder has circular bases of radius 8 cm. Its perpendicular height is 12 cm and its slanted side is 15 cm long, as in the side view. What is its volume, in cubic centimeters? Give the volume in terms of $\\pi$.',
             ['$320\\pi$ cm³', '$768\\pi$ cm³', '$960\\pi$ cm³', '$256\\pi$ cm³'], 1, oblique_fig),
        make(REVOLUTION, 'A rectangle 7 cm wide and 2 cm tall is rotated one full turn about the dashed line shown. Which solid does it sweep out?',
             ['A cylinder with radius 2 cm and height 7 cm', 'A cylinder with diameter 2 cm and height 7 cm', 'A cylinder with radius 7 cm and height 2 cm', 'A cone with radius 2 cm and height 7 cm'], 0, rect_fig),
        make(REVOLUTION, 'A right triangle has legs of 8 cm and 6 cm. It is rotated one full turn about the dashed line, which contains one leg. What is the volume of the solid, in cubic centimeters? Give the volume in terms of $\\pi$.',
             ['$128\\pi$ cm³', '$120\\pi$ cm³', '$288\\pi$ cm³', '$96\\pi$ cm³'], 3, tri_fig),
        make(SIMILARITY, 'In triangle ABC, D is on AB and E is on AC, and DE is parallel to BC, as shown. AD = 6, AE = 6 and EC = 4. What is the length of DB?',
             ['9', '4', '6', '10'], 1, parallel_fig),
        make(SIMILARITY, 'In right triangle ABC, the right angle is at C and CD is the altitude to the hypotenuse AB. AC = 6 and AB = 9. What is the length of AD?',
             ['$\\sqrt{15}$', '4', '3', '6'], 1, altitude_fig),
    ]
    rejected = 0

    def reject(problem, why):
        nonlocal rejected
        try:
            review_problem(problem)
        except ValueError:
            rejected += 1
            return
        raise ValueError(f'Corrupt geometry-modeling case was accepted: {why}')

    for case in good:
        review_problem(case)
        wrong = copy.deepcopy(case)
        wrong['answer'] = 'option-0' if case['answer'] != 'option-0' else 'option-1'
        reject(wrong, 'wrong key')
        # A distractor equal to the correct value must be caught as a duplicate or second correct answer.
        twin = copy.deepcopy(case)
        correct_label = twin['public']['response']['options'][int(case['answer'][-1])]['label']
        other = 0 if case['answer'] != 'option-0' else 1
        twin['public']['response']['options'][other]['label'] = correct_label
        reject(twin, 'duplicate correct choice')
        leak = copy.deepcopy(case)
        leak['hint'] = f'The answer is {correct_label}.'
        if re.search('[a-z]', normalize(correct_label)):
            reject(leak, 'hint leaks answer')
    # Corrupt givens or figures so the stated answer no longer follows.
    mutants = [
        (good[0], lambda p: p.update(prompt=p['prompt'].replace('radius of 16 cm', 'radius of 12 cm'))),
        (good[1], lambda p: p.update(prompt=p['prompt'].replace('One liter is 1000', 'One liter is 100'))),
        (good[2], lambda p: p.update(prompt=p['prompt'].replace('2664', '2665'))),
        (good[3], lambda p: p.update(prompt=p['prompt'].replace('mass of 100 g', 'mass of 200 g'))),
        (good[4], lambda p: p.update(prompt=p['prompt'].replace('base of 2 m', 'base of 3 m'))),
        (good[5], lambda p: p.update(prompt=p['prompt'].replace('24 m', '26 m'))),
        (good[6], lambda p: p['response']['options'][2].update(label='4 × 4 × 7 cm')),
        (good[7], lambda p: p.update(prompt=p['prompt'].replace('3/2', '2/3'))),
        (good[8], lambda p: p['figure']['scene']['elements'][0].update(points=[[0, 0], [16, 0], [25, 13], [9, 13]])),
        (good[9], lambda p: p['figure']['scene']['elements'].__setitem__(1, {'type': 'segment', 'dash': 'dash', 'from': [0, 2.5], 'to': [8, 2.5]})),
        (good[10], lambda p: p['figure']['scene']['elements'].__setitem__(0, {'type': 'polygon', 'points': [[0, 0], [6, 0], [0, 9]]})),
        (good[11], lambda p: p['figure']['scene']['elements'].__setitem__(5, text('E', (8.2, 5.0)))),
        (good[12], lambda p: p['figure']['scene']['elements'].__setitem__(0, {'type': 'polygon', 'points': [[0, 0], [9, 0], [3, 4.47213595499958]]})),
    ]
    for number, (case, mutate) in enumerate(mutants):
        bad = copy.deepcopy(case)
        mutate(bad['public'])
        reject(bad, f'corrupt givens or figure #{number}')
    pen = make(DESIGN, 'You have 48 m of fencing to enclose a rectangular pen, and you will use all of it. Which of these whole-number dimensions encloses the greatest area?',
               ['15 m by 9 m', '19 m by 5 m', '13 m by 11 m', '16 m by 8 m'], 2)
    review_problem(pen)
    bad = copy.deepcopy(pen)
    bad['public']['prompt'] = bad['public']['prompt'].replace('Which of these whole-number dimensions encloses', 'Which whole-number dimensions enclose')
    reject(bad, 'unrestricted optimum (12 by 12) is not offered')
    # An infeasible design option (does not use all the fence) must be rejected.
    bad = copy.deepcopy(good[5])
    bad['public']['response']['options'][1]['label'] = 'Width 6 m, length 13 m'
    reject(bad, 'option breaks the stated constraint')
    return {'fixtures': len(good), 'rejectedMutations': rejected}

# Read by independent-math-review.py (FamilyOracle).
CHOICE_REVIEW = SUPPORTED



if __name__ == '__main__':
    print(self_test())
