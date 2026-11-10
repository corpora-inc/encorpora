"""Independent oracle for the HSG.SRT.D.9 types (deriving area = ½ab sin C).

Only the public payload is read. The triangle comes from the figure's
vertex coordinates (or, for the numeric items, from the stated sides and
angle, checked against the figure); the foot of each height is computed by
projection. Every option is judged by what it claims about that triangle:
an expression is evaluated and compared with the height or the area, a
segment is constructed and tested for being a height of the right length,
a derivation line is tested for truth, and a justification must be both
true and the reason the step needs. Exactly one option of every choice
(and every part) may be right.
"""
import json
import math
import re
from fractions import Fraction

SUPPORTED = frozenset({
    'trig-area-auxiliary-line',
    'trig-area-derivation-fill',
    'trig-area-derivation-reasoning',
})
REVIEW_RETURNS_ANSWER = True
EPS = 1e-9


def require(cond, message):
    if not cond:
        raise ValueError(message)


def only(found, what):
    require(len(found) == 1, f'Expected exactly one valid {what}, found {len(found)}')
    return found[0]


# ------------------------------------------------------------ geometry

def sub(a, b):
    return (a[0] - b[0], a[1] - b[1])


def dot(a, b):
    return a[0] * b[0] + a[1] * b[1]


def length(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])


def angle(v, p, q):
    """Angle pqv at v in degrees."""
    a, b = sub(p, v), sub(q, v)
    c = dot(a, b) / (math.hypot(*a) * math.hypot(*b))
    return math.degrees(math.acos(max(-1.0, min(1.0, c))))


def foot(p, a, b):
    """Foot of the perpendicular from p to line ab, and its parameter along a→b."""
    u = sub(b, a)
    t = dot(sub(p, a), u) / dot(u, u)
    return (a[0] + t * u[0], a[1] + t * u[1]), t


class Tri:
    def __init__(self, at):
        require(len(at) == 3, 'A triangle has three vertices')
        self.at = at

    def side(self, name):
        p, q = name
        return length(self.at[p], self.at[q])

    def opposite(self, letter):
        """The side opposite a vertex, as two letters."""
        return ''.join(v for v in self.at if v != letter)

    def side_of_name(self, low):
        """The side named by a lowercase vertex letter (side opposite it)."""
        v = low.upper()
        require(v in self.at, f'Unknown side name {low}')
        return self.side(self.opposite(v))

    def ang(self, v):
        others = [x for x in self.at if x != v]
        return angle(self.at[v], self.at[others[0]], self.at[others[1]])

    def area(self):
        (ax, ay), (bx, by), (cx, cy) = self.at.values()
        return abs((bx - ax) * (cy - ay) - (by - ay) * (cx - ax)) / 2


def triangle_from_figure(public):
    figure = public.get('figure')
    require(figure and figure['kind'] == 'scene', 'Expected a scene')
    tri = [e for e in figure['scene']['elements'] if e.get('type') == 'triangle']
    require(len(tri) == 1, 'Expected one triangle')
    names = tri[0]['names']
    pts = tri[0]['points']
    require(len(set(names)) == 3, 'Distinct vertex names')
    return Tri({n: tuple(p) for n, p in zip(names, pts)}), figure['scene']['elements']


def figure_point(elements, ident):
    found = [e for e in elements if e.get('id') == ident]
    require(len(found) == 1, f'Missing figure element {ident}')
    return tuple(found[0]['at'])


# ------------------------------------------------- expressions in TeX

TRIG = {'sin': math.sin, 'cos': math.cos, 'tan': math.tan}


def angle_value(text, tri, given):
    """An angle written as a letter, N^\\circ, or 180^\\circ-Z etc., in degrees."""
    text = text.strip()
    m = re.fullmatch(r'(\d+)\^\\circ', text)
    if m:
        return float(m[1])
    m = re.fullmatch(r'([A-Z])', text)
    if m:
        return given.get(m[1], tri.ang(m[1]))
    m = re.fullmatch(r'180\^\\circ-(.+)', text)
    if m:
        return 180 - angle_value(m[1], tri, given)
    m = re.fullmatch(r'90\^\\circ-(.+)', text)
    if m:
        return 90 - angle_value(m[1], tri, given)
    m = re.fullmatch(r'([A-Z])-90\^\\circ', text)
    if m:
        return angle_value(m[1], tri, given) - 90
    raise ValueError(f'Unreadable angle {text!r}')


def expression(text, tri, lengths, given):
    """Value of [-][\\frac12] factors \\sin|\\cos|\\tan angle, where a factor is
    a side name, a number or (number), optionally squared."""
    m = re.fullmatch(r'(-?)(\\frac12)?(.*?)\\(sin|cos|tan)(?:\((.+)\)| (.+))', text.strip())
    require(m is not None, f'Unreadable expression {text!r}')
    value = -1.0 if m[1] else 1.0
    if m[2]:
        value /= 2
    rest = m[3]
    pos = 0
    for f in re.finditer(r'(\([0-9.]+\)|[0-9.]+|[a-z])(\^2)?', rest):
        require(f.start() == pos, f'Unreadable factor in {text!r}')
        pos = f.end()
        token = f[1].strip('()')
        v = float(token) if re.fullmatch(r'[0-9.]+', token) else lengths(token)
        value *= v * v if f[2] else v
    require(pos == len(rest), f'Unreadable factors in {text!r}')
    a = angle_value(m[5] or m[6], tri, given)
    return value * TRIG[m[4]](math.radians(a))


# ---------------------------------------------------- 1. the foot (plot)

def solve_foot(public):
    prompt = public['prompt']
    m = re.fullmatch(
        r'In triangle \$(\w{3})\$, sides \$\\overline\{(\w\w)\}\$ and \$\\overline\{(\w\w)\}\$ and the angle \$(\w)\$ between them are known\. '
        r'The formula area \$=\\frac12(\w)(\w)\\sin (\w)\$ comes from the height drawn from \$(\w)\$ perpendicular to line \$(\w\w)\$\. '
        r'Plot its foot \$D\$, the point where it meets line \$\w\w\$, extended if needed\. The vertices are (.+)\.', prompt)
    require(m is not None, 'Unreadable prompt')
    names, s1, s2, Z, p1, p2, Z2, X, line = m.groups()[:9]
    require(Z2 == Z and Z in s1 and Z in s2, 'The given angle lies between the given sides')
    response = public['response']
    require(response['kind'] == 'point-plot' and response['pointCount'] == 1, 'Expected one plotted point')
    at = {v['label']: (Fraction(v['x']), Fraction(v['y'])) for v in response['given']['vertices']}
    require(set(at) == set(names), 'Vertices are the triangle')
    listed = re.findall(r'\$(\w)\((-?\d+), (-?\d+)\)\$', m[10])
    require({k: (Fraction(int(x)), Fraction(int(y))) for k, x, y in listed} == at, 'Listed vertices differ from the grid')
    # The construction that derives the formula: from the far end X of one
    # given side, perpendicular to the line of the other given side.
    require(X != Z and (X in s1) != (X in s2), 'The height starts at the far end of one given side')
    other = s2 if X in s1 else s1
    require(set(line) == set(other), 'The height meets the line of the other given side')
    # The formula names the two given sides by their opposite vertices.
    lows = sorted(next(v for v in names if v not in s).lower() for s in (s1, s2))
    require(sorted([p1, p2]) == lows and ''.join(sorted([p1, p2])) == p1 + p2, 'The formula names the given sides')
    a, b = at[line[0]], at[line[1]]
    u = (b[0] - a[0], b[1] - a[1])
    p = at[X]
    t = ((p[0] - a[0]) * u[0] + (p[1] - a[1]) * u[1]) / (u[0] ** 2 + u[1] ** 2)
    d = (a[0] + t * u[0], a[1] + t * u[1])
    require(d[0].denominator == 1 and d[1].denominator == 1, 'The foot is a lattice point')
    grid = response['grid']
    require(grid['xMin'] <= d[0] <= grid['xMax'] and grid['yMin'] <= d[1] <= grid['yMax'], 'The foot is on the grid')
    return json.dumps([[int(d[0]), int(d[1])]], separators=(',', ':'))


# ---------------------------------------------- 2. the derivation (parts)

def fill_triangle(public):
    prompt = public['prompt']
    numeric = re.match(r'Triangle \$(\w{3})\$ has \$(\w\w)=(\d+)\$, \$(\w\w)=(\d+)\$ and \$m\\angle (\w)=(\d+)\^\\circ\$\.', prompt)
    symbolic = re.match(r'Triangle \$(\w{3})\$ has sides \$(\w)=(\w\w)\$ and \$(\w)=(\w\w)\$ and the angle \$(\w)\$ between them\.', prompt)
    require(bool(numeric) != bool(symbolic), 'Unreadable givens')
    hm = re.search(r'The figure shows the height \$h\$ from \$(\w)\$, with foot \$D\$\. Complete each line of the derivation of area \$=\\frac12(\w)(\w)\\sin (\w)\$\.', prompt)
    require(hm is not None, 'Missing the height')
    X, Z = hm[1], hm[4]
    drawn, elements = triangle_from_figure(public)
    names = list(drawn.at)
    Y = next(v for v in names if v not in (X, Z))
    obtuse = f'Angle ${Z}$ is obtuse.' in prompt
    given = {}
    if numeric:
        sides = {numeric[2]: float(numeric[3]), numeric[4]: float(numeric[5])}
        require(numeric[6] == Z, 'The given angle is the one in the formula')
        theta = float(numeric[7])
        given[Z] = theta
        base, hyp = sides.get(Y + Z, sides.get(Z + Y)), sides.get(X + Z, sides.get(Z + X))
        require(base is not None and hyp is not None, 'The given sides meet at the angle')
        tri = Tri({Z: (0.0, 0.0), Y: (base, 0.0), X: (hyp * math.cos(math.radians(theta)), hyp * math.sin(math.radians(theta)))})
        # The figure is this triangle to scale.
        k = drawn.side(Y + Z) / base
        require(abs(drawn.side(X + Z) - k * hyp) < 1e-6 and abs(drawn.ang(Z) - theta) < 1e-6, 'Figure differs from the givens')
        lengths = lambda low: tri.side_of_name(low)
    else:
        require({symbolic[2], symbolic[4]} == {(next(v for v in names if v not in symbolic[3])).lower(),
                                                (next(v for v in names if v not in symbolic[5])).lower()}, 'Side names')
        require(symbolic[6] == Z, 'The given angle is the one in the formula')
        tri = drawn
        lengths = lambda low: tri.side_of_name(low)
    require((tri.ang(Z) > 90) == obtuse, 'Obtuse flag differs from the figure')
    d_fig = figure_point(elements, 'd')
    d_true, _ = foot(drawn.at[X], drawn.at[Y], drawn.at[Z])
    require(length(d_fig, d_true) < 1e-7, 'The drawn foot is the foot of the perpendicular from the vertex')
    h = length(foot(tri.at[X], tri.at[Y], tri.at[Z])[0], tri.at[X])
    return tri, X, Y, Z, lengths, given, h, obtuse, numeric is not None


def number_or_name(text, lengths):
    text = text.strip()
    if re.fullmatch(r'\d+', text):
        return float(text)
    return lengths(text)


def solve_fill(public):
    tri, X, Y, Z, lengths, given, h, obtuse, numeric = fill_triangle(public)
    blanks = public['response']['blanks']
    key = {}
    base_side = {Y, Z}
    area = tri.area()
    dpt, tpar = foot(tri.at[X], tri.at[Y], tri.at[Z])
    for b in blanks:
        good = []
        bid, label = b['id'], b['label']
        for o in b['options']:
            text = o['label']
            if bid == 'base':
                require(label == f'Line 1: $\\overline{{{X}D}}$ is the height $h$ to the base', 'Base line')
                mm = re.fullmatch(r'(?:\$(\w)\$, )?side \$\\overline\{(\w\w)\}\$(?:, length \$(\d+)\$)?', text)
                require(mm is not None, f'Unreadable base {text!r}')
                ok = set(mm[2]) == base_side
                if mm[1]:
                    ok = ok and mm[1] == next(v for v in tri.at if v not in mm[2]).lower()
                if mm[3]:
                    ok = ok and abs(float(mm[3]) - tri.side(mm[2])) < 1e-9
                if ok:
                    good.append(o['id'])
            elif bid == 'ratio':
                lm = re.fullmatch(r'Line 2: in right triangle \$(\w)D(\w)\$, this ratio equals \$\\frac\{h\}\{(\w+)\}\$', label)
                require(lm is not None and {lm[1], lm[2]} == {X, Z}, 'Ratio line')
                r = h / number_or_name(lm[3], lengths)
                mm = re.fullmatch(r'\$\\(sin|cos|tan) (.+)\$', text)
                require(mm is not None, f'Unreadable ratio {text!r}')
                if abs(TRIG[mm[1]](math.radians(angle_value(mm[2], tri, given))) - r) < EPS:
                    good.append(o['id'])
            elif bid == 'height':
                if obtuse:
                    lm = re.fullmatch(r'Line 3: \$h=(\w+)\\sin\(\\angle (\w)(\w)D\)\$, which equals', label)
                    require(lm is not None and lm[2] == X and lm[3] == Z, 'Height line')
                    require(abs(number_or_name(lm[1], lengths) * math.sin(math.radians(angle(tri.at[Z], tri.at[X], dpt))) - h) < EPS,
                            'The height line itself is true')
                else:
                    require(label == 'Line 3: so the height $h$ equals', 'Height line')
                mm = re.fullmatch(r'\$(.+)\$', text)
                if abs(expression(mm[1], tri, lengths, given) - h) < EPS:
                    good.append(o['id'])
            elif bid == 'area':
                require(label == 'Line 4: the area, half the base times the height, equals', 'Area line')
                mm = re.fullmatch(r'\$(.+)\$', text)
                if abs(expression(mm[1], tri, lengths, given) - area) < EPS:
                    good.append(o['id'])
            elif bid == 'foot':
                require(label.startswith(f'Line 1: the perpendicular from ${X}$ meets line $'), 'Foot line')
                between = re.fullmatch(r'between \$(\w)\$ and \$(\w)\$', text)
                beyond = re.fullmatch(r'on the extension of \$\\overline\{(\w\w)\}\$ beyond \$(\w)\$', text)
                require(between or beyond, f'Unreadable place {text!r}')
                if between:
                    ok = {between[1], between[2]} == base_side and 0 < tpar < 1
                else:
                    ok = set(beyond[1]) == base_side and ((beyond[2] == Z and tpar > 1) or (beyond[2] == Y and tpar < 0))
                if ok:
                    good.append(o['id'])
            elif bid == 'supp':
                lm = re.fullmatch(r'Line 2: in right triangle \$(\w)D(\w)\$, \$m\\angle (\w)(\w)D\$ is', label)
                require(lm is not None and lm[3] == X and lm[4] == Z, 'Supplement line')
                actual = angle(tri.at[Z], tri.at[X], dpt)
                mm = re.fullmatch(r'\$(.+)\$', text)
                if abs(angle_value(mm[1], tri, given) - actual) < 1e-7:
                    good.append(o['id'])
            elif bid == 'reason':
                require(label == 'Line 4: line 3 holds because', 'Reason line')
                if text == '$\\sin(180^\\circ-\\theta)=\\sin\\theta$ for every angle $\\theta$':
                    # True for every angle, and it is exactly what turns
                    # sin(angle XZD) = sin(180° - Z) into sin Z.
                    good.append(o['id'])
                    continue
                both = re.fullmatch(r'\$\\angle (\w)\$ and \$\\angle (\w)(\w)D\$ are both angles of triangle \$(\w)D(\w)\$', text)
                if both:
                    inner = [angle(tri.at[Z], tri.at[X], dpt), angle(dpt, tri.at[X], tri.at[Z]), angle(tri.at[X], tri.at[Z], dpt)]
                    if any(abs(tri.ang(both[1]) - a) < 1e-7 for a in inner):
                        good.append(o['id'])
                    continue
                if text == 'sine is negative for obtuse angles, so take its absolute value':
                    require(math.sin(math.radians(tri.ang(Z))) > 0, 'Sine of an obtuse angle is positive')
                    continue
                bis = re.fullmatch(r'the height bisects angle \$(\w)\$', text)
                require(bis is not None, f'Unknown reason {text!r}')
                v = bis[1]
                o1, o2 = [p for p in tri.at if p != v]
                if abs(angle(tri.at[v], tri.at[o1], dpt) - angle(tri.at[v], dpt, tri.at[o2])) < 1e-7 and \
                        abs(angle(tri.at[v], tri.at[o1], dpt) + angle(tri.at[v], dpt, tri.at[o2]) - tri.ang(v)) < 1e-7:
                    good.append(o['id'])
            else:
                raise ValueError(f'Unknown part {bid}')
        key[bid] = only(good, f'choice for {bid}')
    expected = ['foot', 'supp', 'height', 'reason'] if obtuse else ['base', 'ratio', 'height', 'area']
    require([b['id'] for b in blanks] == expected, 'Unexpected parts')
    return json.dumps(key, separators=(',', ':'))


# ---------------------------------------- 3. reasoning about the derivation

def known(prompt):
    m = re.search(r'In triangle \$(\w{3})\$, sides \$(\w)=(\w\w)\$ and \$(\w)=(\w\w)\$ and the angle \$(\w)\$ between them are known\.', prompt)
    return m


def line_truths(tri, lines):
    """Truth of each line of a derivation, in order; h is set by line 1."""
    state = {}
    out = []
    for text in lines:
        out.append(line_true(tri, text, state))
    return out


def line_true(tri, text, state):
    m = re.fullmatch(r'Draw the perpendicular from \$(\w)\$ to \$\\overline\{(\w\w)\}\$, meeting it at \$D\$, with \$h=(\w)D\$\. Right triangle \$(\w)D(\w)\$ contains angle \$(\w)\$\.', text)
    if m:
        v, side, hv, p, q, z = m.groups()
        d, t = foot(tri.at[v], tri.at[side[0]], tri.at[side[1]])
        state.update(h=length(d, tri.at[v]), D=d, V=v, line=side)
        if hv != v or not (0 < t < 1) or v in side:
            return False
        if z not in (p, q) or {p, q} - {z} == set():
            return False
        other = p if q == z else q
        # Triangle (other, D, z) must be right at D and have angle z equal to the triangle's.
        right = abs(angle(d, tri.at[other], tri.at[z]) - 90) < 1e-7
        return right and abs(angle(tri.at[z], tri.at[other], d) - tri.ang(z)) < 1e-7
    m = re.fullmatch(r'The perpendicular from \$(\w)\$ meets line \$(\w\w)\$ at \$D\$, beyond \$(\w)\$, with \$h=(\w)D\$\.', text)
    if m:
        v, side, end, hv = m.groups()
        d, t = foot(tri.at[v], tri.at[side[0]], tri.at[side[1]])
        state.update(h=length(d, tri.at[v]), D=d, V=v, line=side)
        beyond = (end == side[1] and t > 1) or (end == side[0] and t < 0)
        return hv == v and beyond
    m = re.fullmatch(r'The perpendicular from \$(\w)\$ meets \$\\overline\{(\w\w)\}\$ at \$D\$, between \$(\w)\$ and \$(\w)\$, with \$h=(\w)D\$\.', text)
    if m:
        v, side, a, b, hv = m.groups()
        d, t = foot(tri.at[v], tri.at[side[0]], tri.at[side[1]])
        state.update(h=length(d, tri.at[v]), D=d, V=v, line=side)
        return hv == v and {a, b} == set(side) and 0 < t < 1
    require('h' in state, 'Line 1 must define h')
    h = state['h']
    m = re.fullmatch(r'In right triangle \$(\w)D(\w)\$, \$\\(sin|cos) (\w)=\\frac\{h\}\{(\w)\}\$, so \$h=(\w)\\(sin|cos) (\w)\$\.', text)
    if m:
        p, q, f, z, s, s2, f2, z2 = m.groups()
        val = TRIG[f](math.radians(tri.ang(z)))
        return f == f2 and z == z2 and s == s2 and abs(val - h / tri.side_of_name(s)) < EPS
    m = re.fullmatch(r'\$h\$ is the height to the base \$\\overline\{(\w\w)\}\$, of length \$(\w)\$\.', text)
    if m:
        side, low = m.groups()
        ok_side = set(side) == set(state['line']) and state['V'] not in side
        return ok_side and low == next(v for v in tri.at if v not in side).lower()
    m = re.fullmatch(r'The area is \$(\\frac12\\cdot )?(\w)\\cdot h=(.+)\$\.', text)
    if m:
        half = 0.5 if m[1] else 1.0
        left = half * tri.side_of_name(m[2]) * h
        right = expression(m[3], tri, tri.side_of_name, {})
        return abs(left - tri.area()) < EPS and abs(right - tri.area()) < EPS
    m = re.fullmatch(r'In right triangle \$(\w)D(\w)\$, \$m\\angle (\w)(\w)D=(.+?)\$, so \$h=(\w)\\sin(.+)\$\.', text)
    if m:
        p, q, x, z, claimed, s, arg = m.groups()
        actual = angle(tri.at[z], tri.at[x], state['D'])
        ok_angle = abs(angle_value(claimed, tri, {}) - actual) < 1e-7
        arg = arg.strip()
        arg = arg[1:-1] if arg.startswith('(') else arg
        ok_h = abs(tri.side_of_name(s) * math.sin(math.radians(angle_value(arg, tri, {}))) - h) < EPS
        return ok_angle and ok_h
    m = re.fullmatch(r'Since \$\\sin\(180\^\\circ-(\w)\)=(-?)\\sin (\w)\$, \$h=(-?)(\w)\\sin (\w)\$\.', text)
    if m:
        z, sign, z2, sign2, s, z3 = m.groups()
        ident = math.sin(math.radians(180 - tri.ang(z))) * (1 if not sign else -1)
        ok_ident = z == z2 and abs(ident - math.sin(math.radians(tri.ang(z)))) < EPS
        value = (-1 if sign2 else 1) * tri.side_of_name(s) * math.sin(math.radians(tri.ang(z3)))
        return ok_ident and abs(value - h) < EPS
    m = re.fullmatch(r'The area is \$\\frac12\\cdot (\w)\\cdot h=(-?\\frac12.+)\$\.', text)
    if m:
        left = 0.5 * tri.side_of_name(m[1]) * h
        right = expression(m[2], tri, tri.side_of_name, {})
        return abs(left - tri.area()) < EPS and abs(right - tri.area()) < EPS
    raise ValueError(f'Unknown derivation line {text!r}')


def segment_option(tri, text):
    """(is a height equal to a given side times sin Z, location claim true)."""
    m = re.fullmatch(r'From \$(\w)\$, perpendicular to (?:line \$|\$\\overline\{)(\w\w)\}?\$(?:, meeting it (beyond \$(\w)\$|between \$(\w)\$ and \$(\w)\$))?', text)
    if m:
        v, side = m[1], m[2]
        if v in side:
            return None
        d, t = foot(tri.at[v], tri.at[side[0]], tri.at[side[1]])
        where = True
        if m[3]:
            end = m[4]
            where = (end == side[1] and t > 1) or (end == side[0] and t < 0)
        elif m[5]:
            where = 0 < t < 1
        return v, d, where
    m = re.fullmatch(r'From \$(\w)\$ to the midpoint of \$\\overline\{(\w\w)\}\$', text)
    if m:
        a, b = tri.at[m[2][0]], tri.at[m[2][1]]
        return m[1], ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2), True
    m = re.fullmatch(r'From \$(\w)\$, perpendicular to \$\\overline\{(\w\w)\}\$, until it meets line \$(\w\w)\$', text)
    require(m is not None, f'Unknown auxiliary line {text!r}')
    v, perp, line = m.groups()
    require(v in perp, 'Perpendicular at the vertex')
    # The line through v perpendicular to perp, met with line `line`.
    u = sub(tri.at[perp[1]], tri.at[perp[0]])
    n = (-u[1], u[0])
    a, b = tri.at[line[0]], tri.at[line[1]]
    w = sub(b, a)
    den = n[0] * w[1] - n[1] * w[0]
    require(abs(den) > 1e-12, 'Parallel lines')
    s = ((a[0] - tri.at[v][0]) * w[1] - (a[1] - tri.at[v][1]) * w[0]) / den
    return v, (tri.at[v][0] + s * n[0], tri.at[v][1] + s * n[1]), True


def is_height(tri, v, end):
    """A segment from vertex v ending on the line of the opposite side, at a
    right angle to it."""
    side = tri.opposite(v)
    a, b = tri.at[side[0]], tri.at[side[1]]
    u = sub(b, a)
    on_line = abs(u[0] * (end[1] - a[1]) - u[1] * (end[0] - a[0])) < 1e-7
    perpendicular = abs(dot(sub(end, tri.at[v]), u)) < 1e-7
    return on_line and perpendicular


def solve_reasoning(public):
    prompt = public['prompt']
    opts = public['response']['options']
    require(public['response']['kind'] == 'choice' and len(opts) == 4 and len({o['label'] for o in opts}) == 4, 'Four distinct options')
    tri, elements = triangle_from_figure(public)
    good = []
    if 'Which auxiliary line gives a height of the triangle equal to a known side times' in prompt:
        k = known(prompt)
        require(k is not None, 'Missing givens')
        Z = k[6]
        sides = [tri.side(k[3]), tri.side(k[5])]
        require(Z in k[3] and Z in k[5], 'Given sides meet at Z')
        for o in opts:
            v, end, where = segment_option(tri, o['label']) or (None, None, False)
            if v is None or not where or not is_height(tri, v, end):
                continue
            hl = length(tri.at[v], end)
            if any(abs(hl - s * math.sin(math.radians(tri.ang(Z)))) < EPS for s in sides):
                good.append(o['id'])
        return only(good, 'auxiliary line')
    if 'In which line does the derivation first go wrong?' in prompt:
        m = re.search(r'A student derives the area\. (.+) In which line does the derivation first go wrong\?', prompt)
        parts = re.split(r'Line \d: ', m[1])
        lines = [p.strip() for p in parts if p.strip()]
        require(len(lines) == 4, 'Four lines')
        truths = line_truths(tri, lines)
        require(False in truths, 'The derivation has an error')
        first = truths.index(False) + 1
        require(sorted(o['label'] for o in opts) == ['Line 1', 'Line 2', 'Line 3', 'Line 4'], 'Line options')
        return only([o['id'] for o in opts if o['label'] == f'Line {first}'], 'first wrong line')
    if 'Which statement justifies the step' in prompt:
        m = re.fullmatch(r'In triangle \$(\w{3})\$, the perpendicular from \$(\w)\$ meets \$\\overline\{(\w\w)\}\$ at \$D\$, and \$h=(\w)D\$\. Which statement justifies the step \$h=(\w)\\sin (\w)\$\?', prompt)
        require(m is not None, 'Unreadable step')
        v, side, s, z = m[2], m[3], m[5], m[6]
        d, t = foot(tri.at[v], tri.at[side[0]], tri.at[side[1]])
        require(0 < t < 1, 'The foot is on the segment')
        h = length(d, tri.at[v])
        require(abs(tri.side_of_name(s) * math.sin(math.radians(tri.ang(z))) - h) < EPS, 'The step is true')
        for o in opts:
            text = o['label']
            mm = re.fullmatch(r'In right triangle \$(\w)D(\w)\$, \$\\sin (\w)=\\frac\{\\text\{opposite\}\}\{\\text\{hypotenuse\}\}=\\frac\{h\}\{(\w)\}\$\.', text)
            if mm:
                p, q, zz, ss = mm.groups()
                hyp_side = tri.opposite(ss.upper())
                # The right triangle holds angle z, h is opposite it, the named
                # side is its hypotenuse, and the ratio is true.
                ok = {p, q} == {v, z} and zz == z and set(hyp_side) == {v, z} and \
                    abs(math.sin(math.radians(tri.ang(z))) - h / tri.side_of_name(ss)) < EPS
                if ok:
                    good.append(o['id'])
                continue
            mm = re.fullmatch(r'In right triangle \$(\w)D(\w)\$, \$\\cos (\w)=\\frac\{h\}\{(\w)\}\$\.', text)
            if mm:
                if abs(math.cos(math.radians(tri.ang(mm[3]))) - h / tri.side_of_name(mm[4])) < EPS:
                    good.append(o['id'])
                continue
            mm = re.fullmatch(r'\$\\sin (\w)=\\frac\{h\}\{(\w)\}\$, because \$h\$ is drawn to side \$\\overline\{(\w\w)\}\$ of length \$(\w)\$\.', text)
            if mm:
                if abs(math.sin(math.radians(tri.ang(mm[1]))) - h / tri.side_of_name(mm[2])) < EPS:
                    good.append(o['id'])
                continue
            # No definition says this: it is the statement to be justified.
            require(text == 'A height always equals a side times the sine of the included angle, by definition.', f'Unknown statement {text!r}')
        return only(good, 'justification')
    if 'Which explanation correctly and completely shows' in prompt:
        m = re.fullmatch(r'In triangle \$(\w{3})\$, angle \$(\w)\$ is obtuse\. The perpendicular from \$(\w)\$ meets line \$(\w\w)\$ at \$D\$, beyond \$(\w)\$, with \$h=(\w)D\$\. Which explanation correctly and completely shows that the area is \$\\frac12(\w)(\w)\\sin (\w)\$\?', prompt)
        require(m is not None, 'Unreadable obtuse setup')
        z, v, side = m[2], m[3], m[4]
        require(tri.ang(z) > 90, 'The angle is obtuse')
        d, t = foot(tri.at[v], tri.at[side[0]], tri.at[side[1]])
        require((side[1] == z and t > 1) or (side[0] == z and t < 0), 'The foot is beyond the obtuse vertex')
        h = length(d, tri.at[v])
        for o in opts:
            text = o['label']
            mm = re.fullmatch(r'\$m\\angle (\w)(\w)D=180\^\\circ-(\w)\$ and \$\\sin\(180\^\\circ-(\w)\)=\\sin (\w)\$, so \$h=(\w)\\sin (\w)\$ and the area is \$\\frac12(\w)h\$\.', text)
            if mm:
                x, zz, z1, z2, z3, s, z4, b = mm.groups()
                ok = (x, zz) == (v, z) and abs(angle(tri.at[z], tri.at[x], d) - (180 - tri.ang(z))) < 1e-7
                ok = ok and z1 == z2 == z3 == z4 == z
                ok = ok and abs(tri.side_of_name(s) * math.sin(math.radians(tri.ang(z))) - h) < EPS
                ok = ok and abs(0.5 * tri.side_of_name(b) * h - tri.area()) < EPS
                if ok:
                    good.append(o['id'])
                continue
            if re.fullmatch(r'Right triangle \$(\w)D(\w)\$ gives \$h=(\w)\\sin (\w)\$, so the area is .+', text):
                # The right triangle's angle at the vertex is the supplement;
                # without sin(180° - Z) = sin Z the step is not shown.
                continue
            mm = re.fullmatch(r'Since \$(\w)\$ is obtuse, \$\\sin (\w)\$ is negative; use .+', text)
            if mm:
                require(math.sin(math.radians(tri.ang(mm[2]))) > 0, 'Sine of an obtuse angle is positive')
                continue
            require(re.fullmatch(r'The formula holds only for acute \$(\w)\$; for obtuse \$\w\$ use .+', text) is not None, f'Unknown explanation {text!r}')
        return only(good, 'complete explanation')
    m = re.search(r'A student draws the perpendicular from \$(\w)\$ to \$\\overline\{(\w\w)\}\$, meeting it at \$E\$\. Why does it not lead directly to the area \$\\frac12(\w)(\w)\\sin (\w)\$\?', prompt)
    require(m is not None, 'Unknown reasoning question')
    z, side = m[1], m[2]
    require(z == m[5], 'The perpendicular starts at the given angle')
    e, t = foot(tri.at[z], tri.at[side[0]], tri.at[side[1]])
    require(length(e, figure_point(elements, 'e')) < 1e-7, 'The drawn E is the foot')
    hz = length(e, tri.at[z])
    for o in opts:
        text = o['label']
        mm = re.fullmatch(r'Its right triangles contain angles \$(\w)\$ and \$(\w)\$ but only parts of angle \$(\w)\$, so its height is \$(\w)\\sin (\w)\$\.', text)
        if mm:
            a, b, zz, s, w = mm.groups()
            ok = {a, b} == set(side) and zz == z and 0 < t < 1 and w != z
            ok = ok and abs(tri.side_of_name(s) * math.sin(math.radians(tri.ang(w))) - hz) < EPS
            if ok:
                good.append(o['id'])
            continue
        if text == 'A perpendicular cannot be drawn from the vertex of the given angle.':
            continue  # one can be drawn from every vertex
        if text == 'It gives a different area, so the formula would be wrong.':
            continue  # every height with its base gives the same area
        mm = re.fullmatch(r'The perpendicular from \$(\w)\$ always falls outside the triangle\.', text)
        require(mm is not None, f'Unknown explanation {text!r}')
        if not (0 < t < 1):
            good.append(o['id'])
    return only(good, 'reason')


def solve(public):
    template = public['templateId']
    require(template in SUPPORTED, 'Unexpected template')
    if template == 'trig-area-auxiliary-line':
        return solve_foot(public)
    if template == 'trig-area-derivation-fill':
        return solve_fill(public)
    return solve_reasoning(public)


def review_problem(problem):
    return solve(problem['public'])


# -------------------------------------------------------------- tests

def _must_fail(public):
    try:
        solve(public)
    except ValueError:
        return
    raise AssertionError('Accepted a corrupted fixture')


def self_test():
    import copy
    plot = {'templateId': 'trig-area-auxiliary-line',
            'prompt': 'In triangle $ABC$, sides $\\overline{AC}$ and $\\overline{AB}$ and the angle $A$ between them are known. '
                      'The formula area $=\\frac12bc\\sin A$ comes from the height drawn from $C$ perpendicular to line $AB$. '
                      'Plot its foot $D$, the point where it meets line $AB$, extended if needed. The vertices are $A(1, 4)$, $B(9, 4)$ and $C(8, 11)$.',
            'response': {'kind': 'point-plot', 'pointCount': 1, 'grid': {'xMin': 0, 'xMax': 12, 'yMin': 0, 'yMax': 12},
                         'given': {'vertices': [{'x': 8, 'y': 11, 'label': 'C'}, {'x': 9, 'y': 4, 'label': 'B'}, {'x': 1, 'y': 4, 'label': 'A'}]}}}
    require(solve(plot) == '[[8,4]]', 'Foot of the height from C')
    wrong_line = copy.deepcopy(plot)
    wrong_line['prompt'] = wrong_line['prompt'].replace('perpendicular to line $AB$', 'perpendicular to line $BC$')
    _must_fail(wrong_line)
    obtuse = copy.deepcopy(plot)
    obtuse['prompt'] = obtuse['prompt'].replace('$C(8, 11)$', '$C(0, 11)$')
    obtuse['response']['given']['vertices'][0]['x'] = 0
    require(solve(obtuse) == '[[0,4]]', 'Foot beyond A for an obtuse angle')
    # Symbolic acute fill: Z = C at the origin, Y = B, X = A.
    th = math.radians(60)
    at = {'A': (5 * math.cos(th), 5 * math.sin(th)), 'B': (7.0, 0.0), 'C': (0.0, 0.0)}
    d = (at['A'][0], 0.0)
    fig = {'kind': 'scene', 'scene': {'v': 1, 'elements': [
        {'type': 'triangle', 'points': [list(at['A']), list(at['B']), list(at['C'])], 'names': ['A', 'B', 'C']},
        {'id': 'd', 'type': 'point', 'at': list(d)}]}}
    def blank(i, label, labels):
        return {'id': i, 'label': label, 'options': [{'id': 'abcd'[k], 'label': x} for k, x in enumerate(labels)]}
    fill = {'templateId': 'trig-area-derivation-fill', 'figure': fig,
            'prompt': 'Triangle $ABC$ has sides $a=BC$ and $b=AC$ and the angle $C$ between them. The figure shows the height $h$ from $A$, with foot $D$. Complete each line of the derivation of area $=\\frac12ab\\sin C$.',
            'response': {'kind': 'multi-part-choice', 'blanks': [
                blank('base', 'Line 1: $\\overline{AD}$ is the height $h$ to the base', ['$b$, side $\\overline{AC}$', '$a$, side $\\overline{BC}$', '$c$, side $\\overline{AB}$']),
                blank('ratio', 'Line 2: in right triangle $ADC$, this ratio equals $\\frac{h}{b}$', ['$\\cos C$', '$\\sin C$', '$\\tan C$', '$\\sin A$']),
                blank('height', 'Line 3: so the height $h$ equals', ['$b\\cos C$', '$a\\sin C$', '$b\\sin C$', '$b\\tan C$']),
                blank('area', 'Line 4: the area, half the base times the height, equals', ['$ab\\sin C$', '$\\frac12b^2\\sin C$', '$\\frac12ab\\cos C$', '$\\frac12ab\\sin C$'])]}}
    require(solve(fill) == '{"base":"b","ratio":"b","height":"c","area":"d"}', 'Acute symbolic fill')
    hyp = copy.deepcopy(fill)
    hyp['response']['blanks'][2]['options'][1]['label'] = '$b\\sin C$'
    _must_fail(hyp)
    moved = copy.deepcopy(fill)
    moved['figure']['scene']['elements'][1]['at'] = [1.0, 0.0]
    _must_fail(moved)
    # Find the flaw: cos for sin is the first wrong line.
    flaw = {'templateId': 'trig-area-derivation-reasoning', 'figure': fig,
            'prompt': 'In triangle $ABC$, sides $a=BC$ and $b=AC$ and the angle $C$ between them are known. A student derives the area. '
                      'Line 1: Draw the perpendicular from $A$ to $\\overline{BC}$, meeting it at $D$, with $h=AD$. Right triangle $ADC$ contains angle $C$. '
                      'Line 2: In right triangle $ADC$, $\\cos C=\\frac{h}{b}$, so $h=b\\cos C$. '
                      'Line 3: $h$ is the height to the base $\\overline{BC}$, of length $a$. '
                      'Line 4: The area is $\\frac12\\cdot a\\cdot h=\\frac12ab\\cos C$. In which line does the derivation first go wrong?',
            'response': {'kind': 'choice', 'options': [{'id': f'option-{c}', 'label': f'Line {i + 1}'} for i, c in enumerate('abcd')]}}
    require(solve(flaw) == 'option-b', 'Cosine line')
    fixed = copy.deepcopy(flaw)
    fixed['prompt'] = fixed['prompt'].replace('\\cos C=\\frac{h}{b}$, so $h=b\\cos C', '\\sin C=\\frac{h}{b}$, so $h=b\\sin C')
    require(solve(fixed) == 'option-d', 'Then the area line is the first error')
    clean = copy.deepcopy(fixed)
    clean['prompt'] = clean['prompt'].replace('\\frac12ab\\cos C', '\\frac12ab\\sin C')
    _must_fail(clean)
    return 8


if __name__ == '__main__':
    print(self_test())
