"""Independent prompt/figure-only checks for area, surface area and volume.

Nothing here reads the generator. Every answer is rebuilt from the public
prompt and the drawn figure by a method other than the formulas the lessons
teach:

* polygon areas come from the shoelace formula on the drawn vertices (and, for
  rectilinear faces with integer corners, from counting unit squares);
* every label is checked against the true drawn length, every height against
  perpendicularity, and every item against the question "do the labels alone
  determine the shape?";
* nets are folded into 3D solids whose faces are measured with Newell's
  vector-area method;
* fractional boxes are filled cube by cube;
* curved solids are integrated exactly as stacks of discs (Cavalieri), with the
  answer kept as a coefficient of pi.

Explanations are reviewed by evaluating every "a = b = c" chain, in plain text
and inside TeX, with values held as exact polynomials in pi.
"""
import ast
import copy
import itertools
import json
import math
import re
import subprocess
import xml.etree.ElementTree as ET
from collections import Counter
from fractions import Fraction
from pathlib import Path

AREA_VOLUME = frozenset({
    'triangle-area-base-height', 'polygon-area-decompose', 'net-surface-area',
    'unit-fraction-cube-packing', 'fraction-edge-volume', 'composite-area',
    'composite-face-prism-volume', 'composite-face-prism-surface-area', 'cylinder-volume',
    'cone-sphere-volume',
})
UNITS = {'cm': ('centimeter', 'centimeters'), 'm': ('meter', 'meters'),
         'in': ('inch', 'inches'), 'ft': ('foot', 'feet')}
PI_314 = Fraction(314, 100)


def require(condition, message):
    # Do not use assert: python -O must not disable review gates.
    if not condition:
        raise ValueError(message)


def exact(x):
    if type(x) is Fraction:
        return x
    require(type(x) in (int, float), f'Expected a number, got {x!r}')
    require(math.isfinite(x), 'Non-finite figure value')
    return Fraction(x) if type(x) is int else Fraction(repr(x))


def point(p):
    require(isinstance(p, list) and len(p) == 2, f'Bad point {p!r}')
    return (exact(p[0]), exact(p[1]))


def sub(p, q):
    return (p[0] - q[0], p[1] - q[1])


def dot(u, v):
    return u[0] * v[0] + u[1] * v[1]


def cross(u, v):
    return u[0] * v[1] - u[1] * v[0]


def dist2(p, q):
    d = sub(q, p)
    return dot(d, d)


def shoelace(vertices):
    """Signed area; positive counterclockwise."""
    n = len(vertices)
    return sum(cross(vertices[i], vertices[(i + 1) % n]) for i in range(n)) / 2


def sqrt_exact(q):
    q = Fraction(q)
    require(q >= 0, 'Negative square')
    a, b = math.isqrt(q.numerator), math.isqrt(q.denominator)
    require(a * a == q.numerator and b * b == q.denominator, f'{q} is not a rational square')
    return Fraction(a, b)


def newell_area(points3):
    """Area of a planar 3D polygon by Newell's normal; must be rational."""
    n = len(points3)
    nx = ny = nz = Fraction(0)
    for i in range(n):
        x1, y1, z1 = points3[i]
        x2, y2, z2 = points3[(i + 1) % n]
        nx += (y1 - y2) * (z1 + z2)
        ny += (z1 - z2) * (x1 + x2)
        nz += (x1 - x2) * (y1 + y2)
    return sqrt_exact(nx * nx + ny * ny + nz * nz) / 2


def on_line(p, a, b):
    return cross(sub(b, a), sub(p, a)) == 0


def within(p, a, b):
    """p on segment ab (inclusive)."""
    return on_line(p, a, b) and dot(sub(p, a), sub(p, b)) <= 0


# --- prompt helpers -------------------------------------------------------

TEX_NUMBER = r'(?:\d+(?:\\tfrac\{\d+\}\{\d+\})?|\\tfrac\{\d+\}\{\d+\})'


def tex_number(text, improper=False):
    """Value of '$2\\tfrac{1}{2}$'-style displayed numbers (proper and reduced;
    a lone improper fraction only where it multiplies pi)."""
    m = re.fullmatch(r'(\d+)?(?:\\tfrac\{(\d+)\}\{(\d+)\})?', text)
    require(m is not None and (m[1] or m[2]), f'Unreadable number {text!r}')
    whole = int(m[1]) if m[1] else 0
    if m[2]:
        n, d = int(m[2]), int(m[3])
        require(0 < n and d > 1 and math.gcd(n, d) == 1 and (n < d or (improper and not m[1])),
                f'Improper or unreduced fraction {text!r}')
        require(not m[1] or whole > 0, f'Zero whole part {text!r}')
        return whole + Fraction(n, d)
    require(not m[1].startswith('0') or m[1] == '0', f'Leading zero {text!r}')
    return Fraction(whole)


def unit_word(unit, value):
    singular, plural = UNITS[unit]
    return singular if value <= 1 else plural


def require_unit(word, unit, value, where):
    require(word == unit_word(unit, value), f'{where}: unit {word!r} disagrees with {unit} and value {value}')


def require_plural(word, unit, where):
    require(word == UNITS[unit][1], f'{where}: expected {UNITS[unit][1]!r}, got {word!r}')


# --- measured polygons ----------------------------------------------------

def validate_measured(figure):
    require(figure.get('kind') == 'measured-polygon', 'Expected a measured polygon')
    require(figure['unit'] in UNITS, 'Unknown unit')
    vertices = [point(p) for p in figure['vertices']]
    n = len(vertices)
    require(3 <= n <= 12 and len(set(vertices)) == n, 'Bad vertex list')
    require(shoelace(vertices) > 0, 'Vertices must run counterclockwise')
    sides = figure['sides']
    require(len(sides) == n, 'One label slot per edge')
    labels = [None if s is None else exact(s) for s in sides]
    for i, label in enumerate(labels):
        if label is not None:
            require(label > 0 and label * label == dist2(vertices[i], vertices[(i + 1) % n]),
                    f'Side label {label} disagrees with drawn edge {i}')
    heights = []
    for h in figure['heights']:
        a, b, v = point(h['from']), point(h['to']), exact(h['value'])
        require(a != b and v * v == dist2(a, b), f'Height label {v} disagrees with its drawn length')
        heights.append((a, b, v))
    guides = [(point(g['from']), point(g['to'])) for g in figure['guides']]
    require(all(a != b for a, b in guides), 'Empty guide')
    for i in figure['rightAngles']:
        require(type(i) is int and 0 <= i < n, 'Right-angle mark outside the polygon')
        prev, here, nxt = vertices[i - 1], vertices[i], vertices[(i + 1) % n]
        require(dot(sub(prev, here), sub(nxt, here)) == 0, f'Vertex {i} is marked square but is not a right angle')
    return vertices, labels, heights, guides, set(figure['rightAngles'])


def height_to_line(height, a, b, guides):
    """A height that drops perpendicularly onto line ab; a foot outside the
    segment must be joined to it by a dashed extension of the base."""
    top, foot, value = height
    if not (on_line(foot, a, b) and dot(sub(top, foot), sub(b, a)) == 0):
        return None
    if not within(foot, a, b):
        near = a if dist2(foot, a) < dist2(foot, b) else b
        require(any({g, h} == {foot, near} for g, h in guides),
                'A height outside the base needs the base extended to its foot')
    return value


def solve_triangle(public):
    prompt, figure = public['prompt'], public['figure']
    m = re.fullmatch(r'The figure shows a triangle with lengths in (\w+)\. What is the area of the triangle, in square (\w+)\?', prompt)
    require(m is not None, 'Unrecognized triangle prompt')
    vertices, labels, heights, guides, square = validate_measured(figure)
    require(len(vertices) == 3, 'A triangle has three vertices')
    require_plural(m[1], figure['unit'], 'triangle')
    require_plural(m[2], figure['unit'], 'triangle')
    pairs = []  # (base, height) pairs a learner can read from the labels.
    for i in range(3):
        if labels[i] is None:
            continue
        a, b, opposite = vertices[i], vertices[(i + 1) % 3], vertices[(i + 2) % 3]
        for h in heights:
            if h[0] == opposite:
                v = height_to_line(h, a, b, guides)
                if v is not None:
                    pairs.append((labels[i], v))
    for h in heights:
        require(any(h[0] == vertices[(i + 2) % 3] and labels[i] is not None and
                    height_to_line(h, vertices[i], vertices[(i + 1) % 3], guides) is not None
                    for i in range(3)), 'A drawn height has no labeled base')
    for v in square:
        before, after = labels[(v - 1) % 3], labels[v]
        if before is not None and after is not None:
            pairs.append((before, after))
    require(pairs, 'No labeled base with a perpendicular labeled height')
    area = shoelace(vertices)
    require(all(b * h / 2 == area for b, h in pairs), 'Base and height disagree with the drawn triangle')
    return area


def parallel(u, v):
    return cross(u, v) == 0


def solve_decompose(public):
    prompt, figure = public['prompt'], public['figure']
    vertices, labels, heights, guides, square = validate_measured(figure)
    unit = figure['unit']
    n = len(vertices)
    edge = [sub(vertices[(i + 1) % n], vertices[i]) for i in range(n)]
    area = shoelace(vertices)
    m = re.fullmatch(r'The figure is a trapezoid: its top and bottom sides are parallel\. Lengths are in (\w+)\. What is its area, in square (\w+)\?', prompt)
    if m:
        require_plural(m[1], unit, 'trapezoid'); require_plural(m[2], unit, 'trapezoid')
        require(n == 4 and edge[0][1] == 0 and edge[2][1] == 0 and edge[0][0] > 0 > edge[2][0],
                'Trapezoid needs a horizontal bottom and top')
        require(not parallel(edge[1], edge[3]), 'Both pairs parallel: a parallelogram, not the stated trapezoid')
        require(labels[0] is not None and labels[2] is not None, 'Both parallel sides must be labeled')
        between = []
        for h in heights:
            top, foot, v = h
            if (on_line(top, vertices[2], vertices[3]) and on_line(foot, vertices[0], vertices[1]) and
                    dot(sub(top, foot), edge[0]) == 0):
                between.append(v)
        for i in (1, 3):
            ends = {i, (i + 1) % 4}
            if labels[i] is not None and dot(edge[i], edge[0]) == 0 and ends & square:
                between.append(labels[i])
        require(len(between) >= 1 and len(heights) <= len(between), 'Trapezoid needs a labeled height between its parallel sides')
        gap = vertices[2][1] - vertices[0][1]
        require(all(v == gap for v in between), 'Trapezoid height disagrees with the drawing')
        return area
    m = re.fullmatch(r'The figure is a parallelogram with lengths in (\w+)\. What is its area, in square (\w+)\?', prompt)
    if m:
        require_plural(m[1], unit, 'parallelogram'); require_plural(m[2], unit, 'parallelogram')
        require(n == 4 and edge[0] == (-edge[2][0], -edge[2][1]) and edge[1] == (-edge[3][0], -edge[3][1]),
                'Opposite sides must be equal and parallel')
        found = []
        for i in range(4):
            if labels[i] is None:
                continue
            a, b = vertices[i], vertices[(i + 1) % 4]
            c, d = vertices[(i + 2) % 4], vertices[(i + 3) % 4]
            for top, foot, v in heights:
                if on_line(top, c, d) and on_line(foot, a, b) and dot(sub(top, foot), edge[i]) == 0:
                    found.append((labels[i], v))
        require(found and len(found) >= len(heights), 'Parallelogram needs a labeled base and its perpendicular height')
        require(all(b * h == area for b, h in found), 'Base × height disagrees with the drawing')
        return area
    m = re.fullmatch(r'The pentagon has right angles at its two bottom corners, and its top vertex is centered above the bottom side\. Lengths are in (\w+)\. What is its area, in square (\w+)\?', prompt)
    require(m is not None, 'Unrecognized decomposition prompt')
    require_plural(m[1], unit, 'pentagon'); require_plural(m[2], unit, 'pentagon')
    require(n == 5 and edge[0][1] == 0 and {0, 1} <= square, 'Pentagon needs a horizontal bottom with marked right angles')
    require(vertices[3][0] * 2 == vertices[0][0] + vertices[1][0], 'Top vertex is not centered')
    require(labels[0] is not None, 'Bottom side must be labeled')
    # Right angles make both walls vertical and centering fixes the apex's x,
    # but nothing stated makes the walls equal: each must be readable.
    walls = []
    for i in (1, 4):
        if labels[i] is not None:
            walls.append(labels[i])
        else:
            require(False, f'Pentagon wall (edge {i}) is unlabeled and not implied by the prompt; the area is not determined')
    apex = vertices[3]
    tops = []
    for top, foot, v in heights:
        require(top == apex, 'Pentagon height must start at the top vertex')
        if on_line(foot, vertices[0], vertices[1]) and dot(sub(top, foot), edge[0]) == 0:
            tops.append(v)
        elif any({g, h} == {vertices[4], vertices[2]} for g, h in guides) and within(foot, vertices[4], vertices[2]) \
                and dot(sub(top, foot), sub(vertices[2], vertices[4])) == 0:
            tops.append(v + walls[1])
        else:
            require(False, 'Pentagon height lands on no readable line')
    require(len(tops) == 1, 'Pentagon needs exactly one apex height')
    require(tops[0] == apex[1] - vertices[0][1], 'Apex height disagrees with the drawing')
    return area


# --- rectilinear faces ----------------------------------------------------

def rectilinear(vertices, labels, where):
    """Rebuild a rectilinear polygon from its labels plus closure. Directions are
    what the drawing shows; at most one horizontal and one vertical length may be
    unknown, so the labels alone fix the shape. Returns the rebuilt vertices."""
    n = len(vertices)
    axes, signs = [], []
    for i in range(n):
        dx, dy = sub(vertices[(i + 1) % n], vertices[i])
        require((dx == 0) != (dy == 0), f'{where}: edge {i} is not horizontal or vertical')
        axes.append('h' if dy == 0 else 'v')
        signs.append(1 if (dx or dy) > 0 else -1)
    require(all(axes[i] != axes[(i + 1) % n] for i in range(n)), f'{where}: consecutive edges must turn a right angle')
    lengths = list(labels)
    for axis in 'hv':
        unknown = [i for i in range(n) if axes[i] == axis and lengths[i] is None]
        require(len(unknown) <= 1, f'{where}: {len(unknown)} unlabeled {"horizontal" if axis == "h" else "vertical"} edges; the labels do not determine the shape')
        if unknown:
            u = unknown[0]
            rest = sum(signs[i] * lengths[i] for i in range(n) if axes[i] == axis and i != u)
            x = -rest * signs[u]
            require(x > 0, f'{where}: closure gives a non-positive edge')
            lengths[u] = x
        require(sum(signs[i] * lengths[i] for i in range(n) if axes[i] == axis) == 0, f'{where}: labels do not close the shape')
    rebuilt = [vertices[0]]
    for i in range(n - 1):
        x, y = rebuilt[-1]
        d = signs[i] * lengths[i]
        rebuilt.append((x + d, y) if axes[i] == 'h' else (x, y + d))
    require(rebuilt == vertices, f'{where}: labels rebuild a different shape than the one drawn')
    return lengths


def shape_name(vertices):
    n = len(vertices)
    reflex = [i for i in range(n) if cross(sub(vertices[i], vertices[i - 1]), sub(vertices[(i + 1) % n], vertices[i])) < 0]
    if n == 6 and len(reflex) == 1:
        return 'L'
    if n == 8 and len(reflex) == 2:
        a, b = reflex
        return 'U' if (b - a) % n in (1, n - 1) else 'T'
    return None


def inside(p, vertices):
    """Even-odd ray cast to the right; p is never on an edge here."""
    x, y = p
    hit = False
    n = len(vertices)
    for i in range(n):
        (x1, y1), (x2, y2) = vertices[i], vertices[(i + 1) % n]
        if (y1 > y) != (y2 > y):
            xc = x1 + (y - y1) * (x2 - x1) / (y2 - y1)
            if xc > x:
                hit = not hit
    return hit


def unit_square_count(vertices):
    xs, ys = [v[0] for v in vertices], [v[1] for v in vertices]
    require(all(v.denominator == 1 for v in xs + ys), 'Unit-square count needs integer corners')
    half = Fraction(1, 2)
    return sum(1 for x in range(int(min(xs)), int(max(xs))) for y in range(int(min(ys)), int(max(ys)))
               if inside((x + half, y + half), vertices))


def rectilinear_area(vertices, labels, where):
    lengths = rectilinear(vertices, labels, where)
    area = shoelace(vertices)
    require(unit_square_count(vertices) == area, f'{where}: unit squares disagree with the shoelace area')
    return area, lengths


def solve_composite_area(public):
    prompt, figure = public['prompt'], public['figure']
    vertices, labels, heights, guides, square = validate_measured(figure)
    unit = figure['unit']
    require(not heights, 'Composite figures carry no heights')
    m = re.fullmatch(r'All angles in the ([LTU])-shaped figure are right angles\. Lengths are in (\w+)\. What is its area, in square (\w+)\?', prompt)
    if m:
        require_plural(m[2], unit, 'composite'); require_plural(m[3], unit, 'composite')
        require(shape_name(vertices) == m[1], f'Figure is not {m[1]}-shaped')
        require(not guides, 'Unexpected guides')
        return rectilinear_area(vertices, labels, 'composite')[0]
    m = re.fullmatch(r'The figure is a rectangle with its top right corner cut off by a straight line\. Its other corners are right angles\. Lengths are in (\w+)\. What is its area, in square (\w+)\?', prompt)
    require(m is not None, 'Unrecognized composite prompt')
    require_plural(m[1], unit, 'cut corner'); require_plural(m[2], unit, 'cut corner')
    require(len(vertices) == 5 and {0, 1, 4} <= square, 'Cut rectangle needs its three square corners marked')
    e = [sub(vertices[(i + 1) % 5], vertices[i]) for i in range(5)]
    require(e[0][1] == 0 < e[0][0] and e[1][0] == 0 < e[1][1] and e[3][1] == 0 > e[3][0] and e[4][0] == 0 > e[4][1],
            'Cut rectangle edges are not bottom, right, top, left')
    require(e[2][0] < 0 < e[2][1], 'The cut must run up and to the left')
    require(all(labels[i] is not None for i in (0, 1, 3, 4)), 'All four straight sides must be labeled')
    b, r, t, l = labels[0], labels[1], labels[3], labels[4]
    require(t < b and r < l, 'The cut must remove a corner')
    x0, y0 = vertices[0]
    rebuilt = [(x0, y0), (x0 + b, y0), (x0 + b, y0 + r), (x0 + t, y0 + l), (x0, y0 + l)]
    require(rebuilt == vertices, 'Labels rebuild a different cut rectangle')
    corner = (x0 + b, y0 + l)
    for g, h in guides:
        require({g, h} <= {vertices[2], vertices[3], corner} and (g[0] == h[0] or g[1] == h[1]),
                'Guide does not complete the rectangle')
    return shoelace(vertices)


def solve_extruded(public):
    prompt, figure, template = public['prompt'], public['figure'], public['templateId']
    require(figure.get('kind') == 'extruded-polygon' and figure['unit'] in UNITS, 'Expected an extruded polygon')
    unit = figure['unit']
    asked = 'volume' if template == 'composite-face-prism-volume' else 'surface area'
    tail = 'cubic' if asked == 'volume' else 'square'
    m = re.fullmatch(r'A right prism has the ([LTU])-shaped front face shown and is (\d+) (\w+) deep\. All angles are right angles\. '
                     r'Lengths are in (\w+)\. What is the ' + asked + r' of the prism, in ' + tail + r' (\w+)\?', prompt)
    require(m is not None, 'Unrecognized prism prompt')
    depth = exact(figure['depth'])
    require(Fraction(int(m[2])) == depth, 'Prompt depth disagrees with the figure')
    require_unit(m[3], unit, depth, 'depth')
    require_plural(m[4], unit, 'prism'); require_plural(m[5], unit, 'prism')
    face = [point(p) for p in figure['face']]
    require(len(set(face)) == len(face) >= 4, 'Bad face')
    require(shoelace(face) > 0, 'Face must run counterclockwise')
    require(len(figure['sides']) == len(face), 'One label slot per edge')
    labels = [None if s is None else exact(s) for s in figure['sides']]
    for i, s in enumerate(labels):
        require(s is None or s * s == dist2(face[i], face[(i + 1) % len(face)]), f'Face label {s} disagrees with edge {i}')
    require(shape_name(face) == m[1], f'Front face is not {m[1]}-shaped')
    area, lengths = rectilinear_area(face, labels, template)
    lift = lambda p, z: (p[0], p[1], z)
    n = len(face)
    if asked == 'volume':
        # Stack depth layers of unit-square columns; each layer is one face thick.
        return sum(area for _ in range(int(depth))) if depth.denominator == 1 else area * depth
    faces = [[lift(p, Fraction(0)) for p in face], [lift(p, depth) for p in reversed(face)]]
    for i in range(n):
        p, q = face[i], face[(i + 1) % n]
        faces.append([lift(p, Fraction(0)), lift(q, Fraction(0)), lift(q, depth), lift(p, depth)])
    require(len(faces) == n + 2, 'Every edge sweeps one side face')
    return sum(newell_area(f) for f in faces)


# --- nets -----------------------------------------------------------------

def solve_net(public):
    prompt, figure = public['prompt'], public['figure']
    m = re.fullmatch(r'The net folds into an? (rectangular prism|triangular prism|pyramid with a square base)\. Lengths are in (\w+)\. '
                     r'What is the surface area of the (prism|pyramid), in square (\w+)\?', prompt)
    require(m is not None, 'Unrecognized net prompt')
    kind = {'rectangular prism': 'rectangular-prism-net', 'triangular prism': 'triangular-prism-net',
            'pyramid with a square base': 'square-pyramid-net'}[m[1]]
    require(figure.get('kind') == kind, 'Net figure disagrees with the prompt')
    require((m[3] == 'pyramid') == (kind == 'square-pyramid-net'), 'Solid named inconsistently')
    unit = figure['unit']
    require(unit in UNITS, 'Unknown unit')
    require_plural(m[2], unit, 'net'); require_plural(m[4], unit, 'net')
    return net_surface_area(figure)


def net_surface_area(figure):
    """Fold the net into its solid (or measure the flat pyramid net) and add the faces."""
    kind = figure['kind']
    z = Fraction(0)
    if kind == 'rectangular-prism-net':
        L, W, H = (exact(figure[k]) for k in ('length', 'width', 'height'))
        require(min(L, W, H) > 0, 'Edges must be positive')
        corners = {(x, y, h) for x in (z, L) for y in (z, W) for h in (z, H)}
        faces = []
        for axis in range(3):
            for fixed in sorted({c[axis] for c in corners}):
                pts = [c for c in corners if c[axis] == fixed]
                a, b = [i for i in range(3) if i != axis]
                center = [sum(c[i] for c in pts) / 4 for i in range(3)]
                pts.sort(key=lambda c: math.atan2(float(c[b] - center[b]), float(c[a] - center[a])))
                faces.append(pts)
        require(len(faces) == 6, 'A box has six faces')
        return sum(newell_area(f) for f in faces)
    if kind == 'triangular-prism-net':
        b, h, L = exact(figure['base']), exact(figure['height']), exact(figure['length'])
        s0, s1 = (exact(s) for s in figure['sides'])
        require(min(b, h, L, s0, s1) > 0, 'Lengths must be positive')
        # Place the apex where both slanted sides reach it.
        x = (s0 * s0 - s1 * s1 + b * b) / (2 * b)
        require(s0 * s0 - x * x == h * h, 'Triangle sides disagree with its base and height')
        tri = [(z, z), (b, z), (x, h)]
        require(dist2(tri[0], tri[2]) == s0 * s0 and dist2(tri[1], tri[2]) == s1 * s1, 'Apex misplaced')
        faces = [[(p[0], p[1], z) for p in tri], [(p[0], p[1], L) for p in reversed(tri)]]
        for i in range(3):
            p, q = tri[i], tri[(i + 1) % 3]
            faces.append([(p[0], p[1], z), (q[0], q[1], z), (q[0], q[1], L), (p[0], p[1], L)])
        return sum(newell_area(f) for f in faces)
    s, l = exact(figure['side']), exact(figure['slant'])
    require(s > 0 and l > s / 2, 'The triangles must meet at an apex')
    # Measure the flat net: the square and four flaps, each by the shoelace formula.
    square = [(z, z), (s, z), (s, s), (z, s)]
    half = s / 2
    flaps = [[(z, z), (half, -l), (s, z)], [(s, z), (s + l, half), (s, s)],
             [(s, s), (half, s + l), (z, s)], [(z, s), (-l, half), (z, z)]]
    for flap in flaps:
        require(dist2(flap[0], flap[1]) == dist2(flap[1], flap[2]), 'Flap is not isosceles')
    return abs(shoelace(square)) + sum(abs(shoelace(f)) for f in flaps)


# --- boxes ----------------------------------------------------------------

def figure_fraction(f):
    require(isinstance(f, dict) and set(f) == {'n', 'd'} and type(f['n']) is int and f['d'] in (1, 2, 3, 4) and f['n'] >= 1,
            'Bad figure fraction')
    return Fraction(f['n'], f['d'])


EDGE = r'\$(' + TEX_NUMBER + r')\$ (\w+)'


def solve_packing(public):
    prompt, figure = public['prompt'], public['figure']
    m = re.fullmatch(r'An? ([a-z ]+?) is ' + EDGE + ' long, ' + EDGE + ' wide and ' + EDGE + r' tall\. '
                     r'It is packed with cubes that have edges of ' + EDGE + r', as shown\. '
                     r'(How many of these cubes fill the prism\?|What is the volume of the prism, in cubic (\w+)\?)', prompt)
    require(m is not None, 'Unrecognized packing prompt')
    require(figure.get('kind') == 'fraction-box-prism' and figure['unit'] in UNITS, 'Expected a box')
    unit = figure['unit']
    edges = [tex_number(m[i]) for i in (2, 4, 6)]
    cube = tex_number(m[8])
    for value, word, key in zip(edges, (m[3], m[5], m[7]), ('length', 'width', 'height')):
        require(figure[key] is not None and figure_fraction(figure[key]) == value, f'Prompt {key} disagrees with the figure')
        require_unit(word, unit, value, key)
    require(figure['cubeEdge'] is not None and figure_fraction(figure['cubeEdge']) == cube, 'Cube edge disagrees with the figure')
    require_unit(m[9], unit, cube, 'cube edge')
    require(cube.numerator == 1 and cube < 1, 'Packing cubes must have a unit-fraction edge')
    counts = []
    for e in edges:
        k = e / cube
        require(k.denominator == 1 and k >= 1, f'Cubes do not fit a {e} edge exactly')
        counts.append(int(k))
    # Fill the box cube by cube.
    cubes = list(itertools.product(*(range(k) for k in counts)))
    require(all(all((i + 1) * cube <= e for i, e in zip(c, edges)) for c in cubes), 'A cube sticks out of the box')
    if m[10].startswith('How many'):
        return Fraction(len(cubes))
    require_plural(m[11], unit, 'volume')
    volume = sum(cube ** 3 for _ in cubes)
    require(volume == edges[0] * edges[1] * edges[2], 'Cubes do not fill the box')
    return volume


def solve_fraction_edge(public):
    prompt, figure = public['prompt'], public['figure']
    require(figure.get('kind') == 'fraction-box-prism' and figure['unit'] in UNITS and figure['cubeEdge'] is None, 'Expected a plain box')
    unit = figure['unit']
    keys = {'long': 'length', 'wide': 'width', 'tall': 'height'}
    m = re.fullmatch(r'An? ([a-z ]+?) is ' + EDGE + ' long, ' + EDGE + ' wide and ' + EDGE + r' tall\. What is its volume, in cubic (\w+)\?', prompt)
    if m:
        edges = [tex_number(m[i]) for i in (2, 4, 6)]
        for value, word, key in zip(edges, (m[3], m[5], m[7]), ('length', 'width', 'height')):
            require(figure[key] is not None and figure_fraction(figure[key]) == value, f'Prompt {key} disagrees with the figure')
            require_unit(word, unit, value, key)
        require_plural(m[8], unit, 'volume')
        # Cut the box into cubes 1/D on a side, D the common denominator.
        D = math.lcm(*(e.denominator for e in edges))
        cells = [e * D for e in edges]
        require(all(c.denominator == 1 for c in cells), 'Grid does not fit')
        return Fraction(int(cells[0]) * int(cells[1]) * int(cells[2]), D ** 3)
    m = re.fullmatch(r'An? ([a-z ]+?) has a volume of \$(' + TEX_NUMBER + r')\$ cubic (\w+)\. It is ' + EDGE + r' (long|wide|tall) and '
                     + EDGE + r' (long|wide|tall)\. How (long|wide|tall) is it, in (\w+)\?', prompt)
    require(m is not None, 'Unrecognized box prompt')
    volume = tex_number(m[2])
    require_unit(m[3], unit, volume, 'volume')
    dims = [m[6], m[9], m[10]]
    require(len(set(dims)) == 3, 'Box dimensions repeat')
    require(dims[:2] == [d for d in ('long', 'wide', 'tall') if d != m[10]], 'Known dimensions out of order')
    known = []
    for text, word, dim in ((m[4], m[5], m[6]), (m[7], m[8], m[9])):
        value = tex_number(text)
        require(figure[keys[dim]] is not None and figure_fraction(figure[keys[dim]]) == value, f'Prompt {dim} disagrees with the figure')
        require_unit(word, unit, value, dim)
        known.append(value)
    require(figure[keys[m[10]]] is None, 'The asked edge must be unknown in the figure')
    require_plural(m[11], unit, 'answer unit')
    missing = volume / (known[0] * known[1])
    require(missing > 0 and missing * known[0] * known[1] == volume, 'No positive edge gives this volume')
    return missing


# --- curved solids --------------------------------------------------------

def integrate(poly, a, b):
    """Exact ∫_a^b of Σ c_k y^k."""
    return sum(c * (b ** (k + 1) - a ** (k + 1)) / (k + 1) for k, c in poly.items())


def disc_volume_coefficient(solid, r, h):
    """Volume ÷ pi, as a stack of discs of radius ρ(y): ∫ ρ(y)² dy."""
    if solid == 'cylinder':
        return integrate({0: r * r}, 0, h)
    if solid == 'cone':
        # ρ(y) = r(1 − y/h): expand r²(1 − y/h)².
        return integrate({0: r * r, 1: -2 * r * r / h, 2: r * r / (h * h)}, 0, h)
    if solid == 'sphere':
        return integrate({0: r * r, 2: Fraction(-1)}, -r, r)
    require(solid == 'hemisphere', 'Unknown solid')
    return integrate({0: r * r, 2: Fraction(-1)}, 0, r)


PLAIN = r'(\d+(?:\.\d+)?)'
TAIL = r'(?:Its volume is \$a\\pi\$ cubic (\w+)\. What is a\?|Use 3\.14 for \$\\pi\$\. What is its volume, in cubic (\w+)\?)'


def solve_curved(public):
    prompt, figure, template = public['prompt'], public['figure'], public['templateId']
    require(figure.get('kind') == 'curved-solid' and figure['unit'] in UNITS, 'Expected a curved solid')
    unit = figure['unit']
    require((figure['radius'] is None) != (figure['diameter'] is None), 'Give exactly one of radius and diameter')
    solid = figure['solid']
    allowed = {'cylinder'} if template == 'cylinder-volume' else {'cone', 'sphere', 'hemisphere'}
    require(solid in allowed, f'{solid} does not belong to {template}')
    m = re.fullmatch(r'A cylinder has a volume of \$(' + TEX_NUMBER + r')?\\pi\$ cubic (\w+) and a (radius|diameter) of ' + PLAIN + r' (\w+)\. What is its height, in (\w+)\?', prompt)
    if m:
        require(solid == 'cylinder' and figure['height'] is None, 'Missing-height item must hide the height')
        volume = tex_number(m[1], improper=True) if m[1] else Fraction(1)
        require_unit(m[2], unit, volume, 'volume')
        given = Fraction(m[4])
        require(figure[m[3]] is not None and exact(figure[m[3]]) == given, f'Prompt {m[3]} disagrees with the figure')
        require_unit(m[5], unit, given, m[3])
        require_plural(m[6], unit, 'height')
        r = given / 2 if m[3] == 'diameter' else given
        per_unit = disc_volume_coefficient('cylinder', r, Fraction(1))  # Volume ÷ pi of a 1-unit slice.
        return volume / per_unit
    m = re.fullmatch(r'An? (cylinder|cone|sphere|hemisphere) has an? (radius|diameter) of ' + PLAIN + r' (\w+)'
                     r'(?: and a height of ' + PLAIN + r' (\w+))?\. ' + TAIL, prompt)
    require(m is not None, 'Unrecognized curved-solid prompt')
    require(m[1] == solid, 'Prompt solid disagrees with the figure')
    given = Fraction(m[3])
    require(figure[m[2]] is not None and exact(figure[m[2]]) == given, f'Prompt {m[2]} disagrees with the figure')
    require_unit(m[4], unit, given, m[2])
    r = given / 2 if m[2] == 'diameter' else given
    require(r > 0, 'Radius must be positive')
    if solid in ('cylinder', 'cone'):
        require(m[5] is not None and figure['height'] is not None and exact(figure['height']) == Fraction(m[5]), 'Height disagrees with the figure')
        require_unit(m[6], unit, Fraction(m[5]), 'height')
        h = Fraction(m[5])
    else:
        require(m[5] is None and figure['height'] is None, 'Spheres have no height')
        h = None
    coefficient = disc_volume_coefficient(solid, r, h)
    if m[7] is not None:
        require_plural(m[7], unit, 'volume')
        require(public['response']['kind'] == 'fraction', 'Exact coefficient needs a fraction response')
        return coefficient
    require_plural(m[8], unit, 'volume')
    return coefficient * PI_314


def solve_area_volume(public):
    template = public['templateId']
    require(template in AREA_VOLUME, f'Not an area/volume template: {template}')
    solved = {
        'triangle-area-base-height': solve_triangle,
        'polygon-area-decompose': solve_decompose,
        'net-surface-area': solve_net,
        'unit-fraction-cube-packing': solve_packing,
        'fraction-edge-volume': solve_fraction_edge,
        'composite-area': solve_composite_area,
        'composite-face-prism-volume': solve_extruded,
        'composite-face-prism-surface-area': solve_extruded,
        'cylinder-volume': solve_curved,
        'cone-sphere-volume': solve_curved,
    }[template](public)
    solved = Fraction(solved)
    require(solved > 0, 'Measures are positive')
    kind = public['response']['kind']
    require(kind in ('number', 'fraction'), 'Unexpected response kind')
    if kind == 'number':
        d = solved.denominator
        for prime in (2, 5):
            while d % prime == 0:
                d //= prime
        require(d == 1, 'A number response needs a terminating decimal answer')
    return solved


# --- explanation arithmetic ----------------------------------------------

def poly(c, k=0):
    return {k: Fraction(c)} if c else {}


def p_add(a, b, s=1):
    out = dict(a)
    for k, v in b.items():
        out[k] = out.get(k, 0) + s * v
    return {k: v for k, v in out.items() if v}


def p_mul(a, b):
    out = {}
    for i, x in a.items():
        for j, y in b.items():
            out[i + j] = out.get(i + j, 0) + x * y
    return {k: v for k, v in out.items() if v}


def p_div(a, b):
    require(len(b) == 1, 'Division by a non-monomial')
    (k, c), = b.items()
    return {i - k: v / c for i, v in a.items()}


def p_at(a, pi):
    return sum(v * pi ** k for k, v in a.items())


TEX_TOKEN = re.compile(r'\s*(?:(\d+)\\tfrac\{(\d+)\}\{(\d+)\}|\\[td]?frac\{(\d+)\}\{(\d+)\}|(\d+(?:\.\d+)?)|'
                       r'(\\times|\\cdot|\\div|\\pi|\\left\(|\\right\)|[-+−()^{}]))')


class Unparsed(Exception):
    pass


def tex_tokens(text):
    out, i = [], 0
    text = text.strip()
    while i < len(text):
        m = TEX_TOKEN.match(text, i)
        if not m or m.end() == i:
            raise Unparsed(text)
        if m[1]:
            out.append(('n', int(m[1]) + Fraction(int(m[2]), int(m[3]))))
        elif m[4]:
            out.append(('n', Fraction(int(m[4]), int(m[5]))))
        elif m[6]:
            out.append(('n', Fraction(m[6])))
        else:
            out.append(('o', {'−': '-', '\\cdot': '\\times'}.get(m[7], m[7])))
        i = m.end()
    return out


def tex_value(text):
    """Exact value of a TeX side as a polynomial in pi, or None if it is not pure arithmetic."""
    try:
        toks = tex_tokens(text)
    except Unparsed:
        return None
    if not toks:
        return None
    pos = [0]

    def peek():
        return toks[pos[0]] if pos[0] < len(toks) else (None, None)

    def take():
        pos[0] += 1
        return toks[pos[0] - 1]

    def starts_primary():
        t, v = peek()
        return t == 'n' or v in ('\\pi', '(', '\\left(')

    def expr():
        v = term()
        while peek()[1] in ('+', '-'):
            op = take()[1]
            v = p_add(v, term(), 1 if op == '+' else -1)
        return v

    def term():
        # Juxtaposition binds tighter than an explicit sign: 36\pi \div 16\pi = (36\pi) ÷ (16\pi).
        v = juxtaposed()
        while peek()[1] in ('\\times', '\\div'):
            op = take()[1]
            w = juxtaposed()
            v = p_mul(v, w) if op == '\\times' else p_div(v, w)
        return v

    def juxtaposed():
        v = power()
        while starts_primary():
            v = p_mul(v, power())
        return v

    def power():
        if peek()[1] == '-':
            take()
            return p_mul(poly(-1), power())
        base = primary()
        if peek()[1] == '^':
            take()
            t, e = take()
            if e == '{':
                t, e = take()
                if take()[1] != '}':
                    raise Unparsed(text)
            if t != 'n' or e.denominator != 1 or not (0 <= e <= 3):
                raise Unparsed(text)
            out = poly(1)
            for _ in range(int(e)):
                out = p_mul(out, base)
            return out
        return base

    def primary():
        t, v = take() if pos[0] < len(toks) else (None, None)
        if t == 'n':
            return poly(v)
        if v == '\\pi':
            return poly(1, 1)
        if v in ('(', '\\left('):
            inner = expr()
            if take()[1] != (')' if v == '(' else '\\right)'):
                raise Unparsed(text)
            return inner
        raise Unparsed(text)

    try:
        value = expr()
    except (Unparsed, IndexError):
        return None
    return value if pos[0] == len(toks) else None


def tex_equalities(segment, where):
    parts = re.split(r'(=|\\approx)', segment)
    sides, links = parts[0::2], parts[1::2]
    checked = 0
    for (left, right), link in zip(zip(sides, sides[1:]), links):
        a, b = tex_value(left), tex_value(right)
        if a is None or b is None:
            continue
        if link == '=':
            require(a == b, f'False TeX equality {left.strip()} = {right.strip()}: {where}')
        else:
            require(p_at(a, PI_314) == p_at(b, PI_314) and (1 in a or 1 in b),
                    f'False approximation {left.strip()} ≈ {right.strip()}: {where}')
        checked += 1
    return checked


ARITH = r'(?:[\d ()×÷+/−π²³]|\.(?=\d))'
TRAILING = re.compile(r'[−(π\d]' + ARITH + r'*$')
LEADING = re.compile(r'^[−(π\d]' + ARITH + r'*')
OPERATORS = '×÷+/−-'


def plain_value(source):
    """Exact value (polynomial in pi) of plain arithmetic such as '1/2 × 2 1/4 × 3²' or '9π ÷ 3π'."""
    text = source.strip()
    while text.count('(') > text.count(')') and text.startswith('('):
        text = text[1:].strip()
    text = re.sub(r'(\d+) (\d+)/(\d+)', r'\1\\tfrac{\2}{\3}', text)          # mixed number 2 1/4
    text = re.sub(r'(?<![\d.])(\d+)/(\d+)(?![\d.])', r'\\tfrac{\1}{\2}', text)  # fraction literal
    for old, new in (('×', ' \\times '), ('÷', ' \\div '), ('/', ' \\div '), ('π', '\\pi '),
                     ('²', '^2'), ('³', '^3'), ('−', '-')):
        text = text.replace(old, new)
    value = tex_value(text)
    require(value is not None, 'Unreadable arithmetic claim: ' + source)
    return value


def plain_equalities(text, where):
    """Check 'a = b = c' chains in prose. A side that runs on into words or
    symbols (such as '= 1/2 × base') is not arithmetic and is skipped."""
    parts = text.split(' = ')
    checked = 0
    for left, right in zip(parts, parts[1:]):
        a, b = TRAILING.search(left), LEADING.match(right)
        if a is None or b is None:
            continue
        before, after = left[:a.start()], right[b.end():]
        if before.rstrip()[-1:] in tuple(OPERATORS) or (before[-1:].isalpha()):
            continue
        if b[0].rstrip()[-1:] in tuple(OPERATORS) or (not b[0][-1:].isspace() and after[:1].isalpha()):
            continue
        if not re.search(r'\d', a[0]) or not re.search(r'\d', b[0]):
            continue
        require(plain_value(a[0]) == plain_value(b[0]), f'False equality {a[0].strip()} = {b[0].strip()}: {where}')
        checked += 1
    return checked


TEX_SEGMENT = re.compile(r'\$([^$]*)\$')


def step_equalities(step):
    checked = sum(tex_equalities(m[1], step) for m in TEX_SEGMENT.finditer(step))
    plain = TEX_SEGMENT.sub(' ⟦⟧ ', step)
    require('$' not in plain, f'Unbalanced TeX: {step}')
    return checked + plain_equalities(plain, step)


def final_claim(step):
    """Value the final sentence of the final step claims: '... is X', 'is about X',
    'Exactly X ...' or '$a = X$'. The last such claim wins."""
    sentence = re.split(r'(?<=\.) (?=[A-Z$])', step.strip())[-1]
    claims = []
    for m in re.finditer(r'(?:\bis (?:about )?|^Exactly )(?:\$([^$]*)\$|(\d+(?:\.\d+)?(?:/\d+)?)(?![\w/]))|\$a = ([^$]*)\$', sentence):
        text = m[1] if m[1] is not None else m[3]
        if text is None:
            claims.append((m.start(), Fraction(m[2])))
            continue
        v = tex_value(text)
        if v is not None and set(v) <= {0}:
            claims.append((m.start(), v.get(0, Fraction(0))))
    return max(claims)[1] if claims else None


def review_problem(problem):
    public, steps = problem['public'], problem['explanation']
    where = f'{public["templateId"]}/{public.get("seed")}'
    solved = solve_area_volume(public)
    answer = problem['answer']
    require(isinstance(answer, str) and re.fullmatch(r'\d+(?:/\d+|\.\d+)?', answer), f'{where}: malformed answer {answer!r}')
    require(Fraction(answer) == solved, f'{where}: answer {answer} but the figure gives {solved}')
    if '/' in answer:
        n, d = map(int, answer.split('/'))
        require(math.gcd(n, d) == 1 and d > 1, f'{where}: unreduced answer {answer}')
    require(isinstance(steps, list) and len(steps) >= 2 and all(isinstance(s, str) and s for s in steps), f'{where}: explanation needs at least two steps')
    require(isinstance(problem.get('hint'), str) and problem['hint'].strip(), f'{where}: hint missing')
    checked = 0
    for step in steps:
        checked += step_equalities(step)
    require(checked >= 1, f'{where}: explanation has no checked arithmetic')
    figure = public['figure']
    if figure.get('kind') == 'curved-solid':
        radius = exact(figure['radius']) if figure['radius'] is not None else exact(figure['diameter']) / 2
        for step in steps:
            for m in re.finditer(r'(?<![\w$])r = (\d+(?:\.\d+)?)(?![\d/])', TEX_SEGMENT.sub(' ', step)):
                require(Fraction(m[1]) == radius, f'{where}: explanation states r = {m[1]}, the radius is {radius}')
    require(final_claim(steps[-1]) == solved, f'{where}: final step does not state the answer {answer}: {steps[-1]!r}')
    return checked


# --- handwritten fixtures -------------------------------------------------

def _poly_fig(unit, vertices, sides, heights=(), guides=(), right=()):
    return {'kind': 'measured-polygon', 'unit': unit, 'vertices': [list(v) for v in vertices], 'sides': list(sides),
            'heights': [{'from': list(a), 'to': list(b), 'value': v} for a, b, v in heights],
            'guides': [{'from': list(a), 'to': list(b)} for a, b in guides], 'rightAngles': list(right)}


def _public(template, prompt, figure, kind='number'):
    return {'templateId': template, 'prompt': prompt, 'figure': figure, 'response': {'kind': kind}}


TRI = 'The figure shows a triangle with lengths in centimeters. What is the area of the triangle, in square centimeters?'
TRAP = 'The figure is a trapezoid: its top and bottom sides are parallel. Lengths are in feet. What is its area, in square feet?'
PENT = 'The pentagon has right angles at its two bottom corners, and its top vertex is centered above the bottom side. Lengths are in feet. What is its area, in square feet?'
NET = 'The net folds into a {}. Lengths are in inches. What is the surface area of the {}, in square inches?'
L_SHAPE = 'All angles in the L-shaped figure are right angles. Lengths are in meters. What is its area, in square meters?'
PRISM = 'A right prism has the L-shaped front face shown and is 4 meters deep. All angles are right angles. Lengths are in meters. What is the {} of the prism, in {} meters?'
L_FACE = [(0, 0), (6, 0), (6, 2), (3, 2), (3, 5), (0, 5)]


def _fixtures():
    tri = _poly_fig('cm', [(0, 0), (10, 0), (4, 6)], [10, None, None], [((4, 6), (4, 0), 6)])
    obtuse = _poly_fig('cm', [(0, 0), (6, 0), (-3, 4)], [6, None, 5], [((-3, 4), (-3, 0), 4)], [((-3, 0), (0, 0))])
    right = _poly_fig('cm', [(0, 0), (8, 0), (0, 6)], [8, 10, 6], right=[0])
    trap = _poly_fig('ft', [(0, 0), (10, 0), (7, 4), (2, 4)], [10, 5, 5, None], [((2, 4), (2, 0), 4)])
    para = _poly_fig('ft', [(0, 0), (6, 0), (9, 4), (3, 4)], [6, 5, None, None], [((3, 4), (3, 0), 4)])
    pent = _poly_fig('ft', [(0, 0), (6, 0), (6, 4), (3, 9), (0, 4)], [6, 4, None, None, 4], [((3, 9), (3, 4), 5)], [((0, 4), (6, 4))], [0, 1])
    lshape = _poly_fig('m', L_FACE, [6, 2, None, 3, 3, None])
    cut = _poly_fig('cm', [(0, 0), (11, 0), (11, 6), (3, 8), (0, 8)], [11, 6, None, 3, 8], guides=[((3, 8), (11, 8)), ((11, 8), (11, 6))], right=[0, 1, 4])
    face = {'kind': 'extruded-polygon', 'unit': 'm', 'face': [list(p) for p in L_FACE], 'sides': [6, 2, None, 3, 3, None], 'depth': 4}
    box = lambda l, w, h, c=None: {'kind': 'fraction-box-prism', 'unit': 'in', 'length': l, 'width': w, 'height': h, 'cubeEdge': c}
    fr = lambda n, d: {'n': n, 'd': d}
    curved = lambda solid, r=None, d=None, h=None, unit='cm': {'kind': 'curved-solid', 'unit': unit, 'solid': solid, 'radius': r, 'diameter': d, 'height': h}
    cases = [
        (_public('triangle-area-base-height', TRI, tri), 30),
        (_public('triangle-area-base-height', TRI, obtuse), 12),
        (_public('triangle-area-base-height', TRI, right), 24),
        (_public('polygon-area-decompose', TRAP, trap), 30),
        (_public('polygon-area-decompose', 'The figure is a parallelogram with lengths in feet. What is its area, in square feet?', para), 24),
        (_public('polygon-area-decompose', PENT, pent), 39),
        (_public('net-surface-area', NET.format('rectangular prism', 'prism'), {'kind': 'rectangular-prism-net', 'unit': 'in', 'length': 2, 'width': 3, 'height': 4}), 52),
        (_public('net-surface-area', NET.format('triangular prism', 'prism'), {'kind': 'triangular-prism-net', 'unit': 'in', 'base': 6, 'height': 4, 'sides': [5, 5], 'length': 10}), 184),
        (_public('net-surface-area', NET.format('pyramid with a square base', 'pyramid'), {'kind': 'square-pyramid-net', 'unit': 'in', 'side': 6, 'slant': 4}), 84),
        (_public('unit-fraction-cube-packing', r'A box is $1\tfrac{1}{2}$ inches long, $1$ inch wide and $2$ inches tall. It is packed with cubes that have edges of $\tfrac{1}{2}$ inch, as shown. How many of these cubes fill the prism?', box(fr(3, 2), fr(1, 1), fr(2, 1), fr(1, 2))), 24),
        (_public('unit-fraction-cube-packing', r'A box is $1\tfrac{1}{2}$ inches long, $1$ inch wide and $2$ inches tall. It is packed with cubes that have edges of $\tfrac{1}{2}$ inch, as shown. What is the volume of the prism, in cubic inches?', box(fr(3, 2), fr(1, 1), fr(2, 1), fr(1, 2)), 'fraction'), 3),
        (_public('fraction-edge-volume', r'A box is $2\tfrac{1}{2}$ inches long, $1\tfrac{1}{3}$ inches wide and $3$ inches tall. What is its volume, in cubic inches?', box(fr(5, 2), fr(4, 3), fr(3, 1)), 'fraction'), 10),
        (_public('fraction-edge-volume', r'A box has a volume of $10$ cubic inches. It is $1\tfrac{1}{3}$ inches wide and $3$ inches tall. How long is it, in inches?', box(None, fr(4, 3), fr(3, 1)), 'fraction'), Fraction(5, 2)),
        (_public('composite-area', L_SHAPE, lshape), 21),
        (_public('composite-area', 'The figure is a rectangle with its top right corner cut off by a straight line. Its other corners are right angles. Lengths are in centimeters. What is its area, in square centimeters?', cut), 80),
        (_public('composite-face-prism-volume', PRISM.format('volume', 'cubic'), face), 84),
        (_public('composite-face-prism-surface-area', PRISM.format('surface area', 'square'), face), 130),
        (_public('cylinder-volume', r'A cylinder has a radius of 3 centimeters and a height of 5 centimeters. Its volume is $a\pi$ cubic centimeters. What is a?', curved('cylinder', r=3, h=5), 'fraction'), 45),
        (_public('cylinder-volume', r'A cylinder has a diameter of 6 centimeters and a height of 5 centimeters. Use 3.14 for $\pi$. What is its volume, in cubic centimeters?', curved('cylinder', d=6, h=5)), Fraction('141.3')),
        (_public('cylinder-volume', r'A cylinder has a volume of $45\pi$ cubic centimeters and a radius of 3 centimeters. What is its height, in centimeters?', curved('cylinder', r=3)), 5),
        (_public('cone-sphere-volume', r'A cone has a radius of 3 centimeters and a height of 4 centimeters. Its volume is $a\pi$ cubic centimeters. What is a?', curved('cone', r=3, h=4), 'fraction'), 12),
        (_public('cone-sphere-volume', r'A sphere has a radius of 3 centimeters. Its volume is $a\pi$ cubic centimeters. What is a?', curved('sphere', r=3), 'fraction'), 36),
        (_public('cone-sphere-volume', r'A hemisphere has a radius of 3 centimeters. Its volume is $a\pi$ cubic centimeters. What is a?', curved('hemisphere', r=3), 'fraction'), 18),
        (_public('cone-sphere-volume', r'A sphere has a diameter of 3 centimeters. Its volume is $a\pi$ cubic centimeters. What is a?', curved('sphere', d=3), 'fraction'), Fraction(9, 2)),
    ]
    return cases


def _mutate(public, path, value):
    out = copy.deepcopy(public)
    target = out
    for key in path[:-1]:
        target = target[key]
    target[path[-1]] = value
    return out


def review_area_volume_fixtures():
    cases = _fixtures()
    for public, expected in cases:
        require(solve_area_volume(public) == expected, f'Independent handwritten mismatch: {public["templateId"]} {public["prompt"][:60]}')
    by = {}
    for public, _ in cases:
        by.setdefault(public['templateId'], public)
    tri, trap, net, pack, edge, comp, vol, sa, cyl, cone = (by[t] for t in (
        'triangle-area-base-height', 'polygon-area-decompose', 'net-surface-area', 'unit-fraction-cube-packing',
        'fraction-edge-volume', 'composite-area', 'composite-face-prism-volume', 'composite-face-prism-surface-area',
        'cylinder-volume', 'cone-sphere-volume'))
    tri_net = cases[7][0]
    pyramid = cases[8][0]
    missing = cases[12][0]
    pentagon = cases[5][0]
    bad = [
        _mutate(tri, ('figure', 'heights', 0, 'value'), 7),                                  # wrong height label
        _mutate(tri, ('figure', 'sides', 0), 11),                                            # label vs drawn edge
        _mutate(_mutate(tri, ('figure', 'heights', 0, 'to'), [-4, 0]), ('figure', 'heights', 0, 'value'), 10),  # slanted "height", true length
        _mutate(tri, ('figure', 'sides', 0), None),                                          # height without a labeled base
        _mutate(cases[1][0], ('figure', 'guides'), []),                                      # outside foot, base not extended
        _mutate(cases[2][0], ('figure', 'sides', 2), None),                                  # one leg unlabeled, no height
        _mutate(trap, ('figure', 'heights'), []),                                            # trapezoid without a height
        _mutate(trap, ('figure', 'sides', 0), None),                                         # a parallel side unlabeled
        _mutate(pentagon, ('figure', 'sides', 1), None),                                     # pentagon wall not determined
        _mutate(tri_net, ('figure', 'sides'), [5, 6]),                                       # triangle sides vs base/height
        _mutate(pyramid, ('figure', 'slant'), 3),                                            # faces cannot meet
        _mutate(pack, ('prompt',), pack['prompt'].replace('$1$ inch wide', '$2$ inches wide')),  # prompt vs figure
        _mutate(_mutate(pack, ('figure', 'length'), {'n': 5, 'd': 4}), ('prompt',), pack['prompt'].replace(r'$1\tfrac{1}{2}$', r'$1\tfrac{1}{4}$')),  # non-whole count
        _mutate(pack, ('prompt',), pack['prompt'].replace('$1$ inch wide', '$1$ inches wide')),  # unit agreement
        _mutate(missing, ('figure', 'length'), {'n': 5, 'd': 2}),                            # asked edge drawn as known
        _mutate(edge, ('figure', 'height'), {'n': 4, 'd': 1}),                               # prompt vs figure
        _mutate(comp, ('figure', 'sides'), [6, 2, None, None, 3, None]),                     # two unknown verticals
        _mutate(comp, ('figure', 'sides'), [6, 2, None, 3, None, 5]),                        # two unknown horizontals
        _mutate(comp, ('figure', 'sides'), [6, 2, None, 4, 3, None]),                        # label vs drawn edge
        _mutate(comp, ('prompt',), L_SHAPE.replace('L-shaped', 'T-shaped')),                 # wrong shape word
        _mutate(vol, ('prompt',), vol['prompt'].replace('4 meters deep', '5 meters deep')),  # depth mismatch
        _mutate(_mutate(sa, ('figure', 'face', 2), [7, 2]), ('figure', 'sides'), [6, None, None, 3, 3, None]),  # face not rectilinear
        _mutate(cyl, ('figure', 'radius'), 4),                                               # prompt vs figure radius
        _mutate(_mutate(cyl, ('figure', 'radius'), None), ('figure', 'diameter'), 3),        # radius vs diameter
        _mutate(cases[19][0], ('figure', 'height'), 5),                                      # missing height shown
        _mutate(cases[21][0], ('figure', 'height'), 3),                                      # sphere with a height
        _mutate(cone, ('templateId',), 'cylinder-volume'),                                   # tampered template
        _mutate(cyl, ('templateId',), 'cylinder-surface-area'),                              # unknown template
        _mutate(tri, ('templateId',), 'composite-area'),                                     # prompt under wrong family
    ]
    for public in bad:
        try:
            solve_area_volume(public)
        except (ValueError, KeyError, TypeError, ZeroDivisionError):
            continue
        raise ValueError(f'Corrupted area/volume item accepted: {public["templateId"]} {public["prompt"][:70]}')
    # Explanation review must catch false arithmetic, a false approximation and a wrong final claim.
    good = {'public': cyl, 'answer': '45', 'hint': 'Volume = base area × height.', 'explanation': [
        r'The base is a circle. Its area is $\pi r^2 = \pi \times 3^2 = 9\pi$ square centimeters.',
        r'Volume = base area × height: $9\pi \times 5 = 45\pi$ cubic centimeters. The number multiplying $\pi$ is a, so $a = 45$.']}
    require(review_problem(good) == 2, 'Explanation fixture miscounted')
    wrong = [
        ('explanation', 0, r'The base is a circle. Its area is $\pi r^2 = \pi \times 3^2 = 6\pi$ square centimeters.'),
        ('explanation', 1, r'Volume = base area × height: 9 × 5 = 46. The number multiplying $\pi$ is a, so $a = 45$.'),
        ('explanation', 1, r'Replace $\pi$: $45\pi \approx 3.14 \times 46$. The number multiplying $\pi$ is a, so $a = 45$.'),
        ('explanation', 1, r'Volume = base area × height: $9\pi \times 5 = 45\pi$ cubic centimeters. The number multiplying $\pi$ is a, so $a = 44$.'),
        ('answer', None, '44'),
        ('explanation', 0, r'The radius is r = 4 centimeters. Its area is $\pi \times 3^2 = 9\pi$ square centimeters.'),
    ]
    for key, index, text in wrong:
        broken = copy.deepcopy(good)
        if index is None:
            broken[key] = text
        else:
            broken[key][index] = text
        try:
            review_problem(broken)
        except ValueError:
            continue
        raise ValueError(f'Corrupted explanation accepted: {text}')
    return {'handwritten': len(cases), 'mutants': len(bad) + len(wrong)}


# --- authored content: lessons, worksheets, illustrations -----------------

_EXPORT = None


def content(data=None):
    """Authored content, exported once per process; callers receive a private copy."""
    global _EXPORT
    if data is not None:
        return data
    if _EXPORT is None:
        app = Path(__file__).resolve().parent.parent
        _EXPORT = subprocess.check_output(['node', '--import', 'tsx', 'scripts/area-volume-content-oracle.ts'], cwd=app, text=True)
    return json.loads(_EXPORT)


def fmt(v):
    v = Fraction(v)
    return str(v.numerator) if v.denominator == 1 else f'{v.numerator}/{v.denominator}'


def unit_of(*words):
    """The one unit every word names (singular or plural)."""
    units = {u for w in words for u, names in UNITS.items() if w in names}
    require(len(units) == 1 and all(any(w in names for names in UNITS.values()) for w in words), f'Mixed or unknown units {words}')
    return units.pop()


VAL = r'(\$' + TEX_NUMBER + r'\$|\d+)'


def val(text):
    return tex_number(text[1:-1]) if text.startswith('$') else Fraction(int(text))


def l_face(b, l, t, r, where):
    """L-shaped face with the notch at the top right: bottom b, left l, top t, right r."""
    require(0 < t < b and 0 < r < l, f'{where}: these sides make no L')
    verts = [(Fraction(0), Fraction(0)), (b, Fraction(0)), (b, r), (t, r), (t, l), (Fraction(0), l)]
    lengths = rectilinear(verts, [b, r, None, None, t, l], where)
    area = shoelace(verts)
    require(unit_square_count(verts) == area, f'{where}: unit squares disagree')
    return verts, lengths, area


def solve_worked(template, prompt):
    """Re-derive a lesson's worked example from its text-only prompt. Returns (value, asked unit or None)."""
    def same(*pairs):  # (word, value) pairs must agree on one unit and on singular/plural
        unit = unit_of(*(w for w, _ in pairs))
        for w, v in pairs:
            require_unit(w, unit, v, template)
        return unit

    if template == 'triangle-area-base-height':
        m = re.fullmatch(r'A triangle has a base of (\d+) (\w+)\. The dashed height from the opposite vertex to the base is (\d+) (\w+), '
                         r'and the slanted sides are (\d+) (\w+) and (\d+) (\w+)\. What is its area, in square (\w+)\?', prompt)
        require(m is not None, 'Unrecognized worked triangle')
        b, h, s1, s2 = (Fraction(int(m[i])) for i in (1, 3, 5, 7))
        unit = same((m[2], b), (m[4], h), (m[6], s1), (m[8], s2))
        require_plural(m[9], unit, template)
        root = sqrt_exact(s1 * s1 - h * h)
        apex = [x for x in (root, -root) if (b - x) ** 2 + h * h == s2 * s2]
        require(apex, 'Worked triangle: the sides cannot meet at that height')
        return abs(shoelace([(0, 0), (b, 0), (apex[0], h)])), 'square ' + m[9]
    if template == 'polygon-area-decompose':
        m = re.fullmatch(r'A trapezoid has parallel sides of (\d+) (\w+) and (\d+) (\w+), and the distance between them is (\d+) (\w+)\. '
                         r'What is its area, in square (\w+)\?', prompt)
        require(m is not None, 'Unrecognized worked trapezoid')
        a, c, h = (Fraction(int(m[i])) for i in (1, 3, 5))
        unit = same((m[2], a), (m[4], c), (m[6], h))
        require_plural(m[7], unit, template)
        require(a != c, 'A trapezoid needs unequal parallel sides')
        return shoelace([(0, 0), (a, 0), (c, h), (0, h)]), 'square ' + m[7]
    if template == 'net-surface-area':
        m = re.fullmatch(r'A square pyramid has a base (\d+) (\w+) on each side\. Each triangular face has a base of (\d+) (\w+) and a height of (\d+) (\w+)\. '
                         r'What is its surface area, in square (\w+)\?', prompt)
        require(m is not None, 'Unrecognized worked net')
        side, face_base, slant = (Fraction(int(m[i])) for i in (1, 3, 5))
        unit = same((m[2], side), (m[4], face_base), (m[6], slant))
        require_plural(m[7], unit, template)
        require(face_base == side, 'Each face sits on a base edge')
        return net_surface_area({'kind': 'square-pyramid-net', 'side': side, 'slant': slant}), 'square ' + m[7]
    if template in ('unit-fraction-cube-packing', 'fraction-edge-volume'):
        m = re.fullmatch(r'An? ([a-z ]+?) is ' + VAL + r' (\w+) long, ' + VAL + r' (\w+) wide and ' + VAL + r' (\w+) tall\. (.+)', prompt)
        require(m is not None, 'Unrecognized worked box')
        edges = [val(m[i]) for i in (2, 4, 6)]
        unit = same((m[3], edges[0]), (m[5], edges[1]), (m[7], edges[2]))
        rest = m[8]
        if template == 'fraction-edge-volume':
            q = re.fullmatch(r'What is its volume, in cubic (\w+)\?', rest)
            require(q is not None, 'Unrecognized worked volume question')
            require_plural(q[1], unit, template)
            D = math.lcm(*(e.denominator for e in edges))
            return Fraction(math.prod(int(e * D) for e in edges), D ** 3), 'cubic ' + q[1]
        q = re.fullmatch(r'It is packed with cubes that have edges of \$(' + TEX_NUMBER + r')\$ (\w+)\. How many cubes fill it, and what is its volume, in cubic (\w+)\?', rest)
        require(q is not None, 'Unrecognized worked packing question')
        cube = tex_number(q[1])
        require_unit(q[2], unit, cube, template)
        require_plural(q[3], unit, template)
        counts = [e / cube for e in edges]
        require(all(c.denominator == 1 for c in counts), 'Worked cubes do not fit')
        cubes = list(itertools.product(*(range(int(c)) for c in counts)))
        return sum(cube ** 3 for _ in cubes), 'cubic ' + q[3]
    if template == 'composite-area':
        m = re.fullmatch(r'An L-shaped figure has all right angles\. Its bottom is (\d+) (\w+), its left side is (\d+) (\w+), its top is (\d+) (\w+) '
                         r'and its right side is (\d+) (\w+)\. What is its area, in square (\w+)\?', prompt)
        require(m is not None, 'Unrecognized worked L')
        b, l, t, r = (Fraction(int(m[i])) for i in (1, 3, 5, 7))
        unit = same((m[2], b), (m[4], l), (m[6], t), (m[8], r))
        require_plural(m[9], unit, template)
        return l_face(b, l, t, r, template)[2], 'square ' + m[9]
    if template in ('composite-face-prism-volume', 'composite-face-prism-surface-area'):
        m = re.fullmatch(r'A right prism is (\d+) (\w+) deep\. Its front face is L-shaped with all right angles: the bottom is (\d+) (\w+), the left side is (\d+) (\w+), '
                         r'the top is (\d+) (\w+) and the right side is (\d+) (\w+)\. What is its (volume|surface area), in (cubic|square) (\w+)\?', prompt)
        require(m is not None, 'Unrecognized worked prism')
        depth, b, l, t, r = (Fraction(int(m[i])) for i in (1, 3, 5, 7, 9))
        unit = same((m[2], depth), (m[4], b), (m[6], l), (m[8], t), (m[10], r))
        require_plural(m[13], unit, template)
        asked = 'volume' if template.endswith('volume') else 'surface area'
        require(m[11] == asked and m[12] == ('cubic' if asked == 'volume' else 'square'), 'Worked prism asks the wrong measure')
        verts, _, area = l_face(b, l, t, r, template)
        if asked == 'volume':
            return sum(area for _ in range(int(depth))), 'cubic ' + m[13]
        lift = lambda p, z: (p[0], p[1], z)
        faces = [[lift(p, Fraction(0)) for p in verts], [lift(p, depth) for p in reversed(verts)]]
        faces += [[lift(p, Fraction(0)), lift(q, Fraction(0)), lift(q, depth), lift(p, depth)] for p, q in zip(verts, verts[1:] + verts[:1])]
        return sum(newell_area(f) for f in faces), 'square ' + m[13]
    require(template in ('cylinder-volume', 'cone-sphere-volume'), f'No worked solver for {template}')
    m = re.search(r'An? (cylinder|cone|sphere|hemisphere) has an? (radius|diameter) of (\d+) (\w+)(?: and a height of (\d+) (\w+))?\.', prompt)
    require(m is not None, 'Unrecognized worked solid')
    unit = unit_of(m[4], *( [m[6]] if m[6] else []))
    figure = {'kind': 'curved-solid', 'unit': unit, 'solid': m[1], 'radius': None, 'diameter': None,
              'height': int(m[5]) if m[5] else None}
    figure[m[2]] = int(m[3])
    public = {'templateId': template, 'prompt': prompt, 'figure': figure, 'response': {'kind': 'fraction'}}
    tail = re.search(r'in (cubic \w+)\?$', prompt)
    return solve_area_volume(public), tail[1] if tail else None


def numbers_in(text):
    """Every displayed number in a step: plain, decimal, a/b, mixed 'a b/c' and TeX."""
    out = set()
    for seg in TEX_SEGMENT.findall(text):
        for m in re.finditer(r'(\d+)?\\tfrac\{(\d+)\}\{(\d+)\}|\d+(?:\.\d+)?', seg):
            out.add((int(m[1]) if m[1] else 0) + Fraction(int(m[2]), int(m[3])) if m[2] else Fraction(m[0]))
    plain = TEX_SEGMENT.sub(' ', text)
    for m in re.finditer(r'(?<![\d.])(\d+) (\d+)/(\d+)(?![\d/])', plain):
        out.add(int(m[1]) + Fraction(int(m[2]), int(m[3])))
    for m in re.finditer(r'(?<![\d./])(\d+(?:\.\d+)?)(?:/(\d+))?(?![\d/])', plain):
        out.add(Fraction(m[1]) / (int(m[2]) if m[2] else 1))
    return out


def prose_equalities(text):
    return step_equalities(text)


def worksheet_tags(problem):
    """Independent classification of what a worksheet item exercises."""
    public = problem['public']
    template, prompt, f = public['templateId'], public['prompt'], public['figure']
    answer = solve_area_volume(public)
    tags = set()
    if template == 'triangle-area-base-height':
        v = [point(p) for p in f['vertices']]
        dots = [dot(sub(v[i - 1], v[i]), sub(v[(i + 1) % 3], v[i])) for i in range(3)]
        tags.add('obtuse' if min(dots) < 0 else 'right' if min(dots) == 0 else 'acute')
        labeled = sum(s is not None for s in f['sides'])
        needed = 1 if f['heights'] else 2
        tags.add('base-height-only' if labeled == needed else 'extra-sides')
    elif template == 'polygon-area-decompose':
        if prompt.startswith('The figure is a parallelogram'):
            tags.add('parallelogram')
        elif prompt.startswith('The figure is a trapezoid'):
            tags.add('trapezoid' if f['heights'] else 'right-trapezoid')
        else:
            tags.add('pentagon')
            if any(point(h['to'])[1] == point(f['vertices'][0])[1] for h in f['heights']):
                tags.add('total-height')
    elif template == 'net-surface-area':
        tags.add(f['kind'])
        if f['kind'] == 'triangular-prism-net':
            b, h, (s0, s1) = exact(f['base']), exact(f['height']), (exact(x) for x in f['sides'])
            if s0 * s0 + s1 * s1 == b * b or s0 == h or s1 == h:
                tags.add('right-triangle')
            if s0 == s1:
                tags.add('isosceles-triangle')
    elif template == 'unit-fraction-cube-packing':
        tags.add('count' if 'How many' in prompt else 'volume')
        tags.add('edge-' + fmt(figure_fraction(f['cubeEdge'])))
        if 'How many' not in prompt and answer.denominator > 1:
            tags.add('fraction-volume')
    elif template == 'fraction-edge-volume':
        m = re.search(r'How (long|wide|tall) is it', prompt)
        tags.add('missing-' + {'long': 'length', 'wide': 'width', 'tall': 'height'}[m[1]] if m else 'volume')
    elif template == 'composite-area':
        if f['guides']:
            tags.add('cut-corner')
        else:
            tags.add(shape_name([point(p) for p in f['vertices']]) + '-shape')
            if sum(s is None for s in f['sides']) == 2:
                tags.add('two-hidden')
    elif template in ('composite-face-prism-volume', 'composite-face-prism-surface-area'):
        tags.add(shape_name([point(p) for p in f['face']]) + '-shape')
    else:
        if template == 'cone-sphere-volume':
            tags.add(f['solid'])
        if 'Use 3.14' in prompt:
            tags.add('approximate')
        elif 'What is a?' in prompt:
            tags.add('exact')
            if answer.denominator > 1:
                tags.add('fraction-coefficient')
        else:
            tags.add('missing-height')
        if 'diameter' in prompt:
            tags.add('diameter')
    return tags


WORKSHEET_BREADTH = {
    'triangle-area-base-height': {'acute', 'right', 'obtuse', 'extra-sides', 'base-height-only'},
    'polygon-area-decompose': {'parallelogram', 'trapezoid', 'right-trapezoid', 'pentagon', 'total-height'},
    'net-surface-area': {'rectangular-prism-net', 'triangular-prism-net', 'square-pyramid-net', 'right-triangle', 'isosceles-triangle'},
    'unit-fraction-cube-packing': {'count', 'volume', 'edge-1/2', 'edge-1/3', 'edge-1/4', 'fraction-volume'},
    'fraction-edge-volume': {'volume', 'missing-length', 'missing-width', 'missing-height'},
    'composite-area': {'L-shape', 'T-shape', 'U-shape', 'cut-corner', 'two-hidden'},
    'composite-face-prism-volume': {'L-shape', 'T-shape'},
    'composite-face-prism-surface-area': {'L-shape', 'T-shape'},
    'cylinder-volume': {'exact', 'approximate', 'missing-height', 'diameter', 'fraction-coefficient'},
    'cone-sphere-volume': {'cone', 'sphere', 'hemisphere', 'approximate', 'diameter'},
}


# Illustrations are re-measured from their SVG coordinates and data-* attributes.

def nums(text):
    return [Fraction(x) for x in re.findall(r'-?\d+(?:\.\d+)?', text)]


def pairs(values):
    require(len(values) % 2 == 0, 'Odd coordinate list')
    return list(zip(values[0::2], values[1::2]))


def path_points(d):
    require(re.fullmatch(r'M[-\d. L]+(?: Z)?', d) is not None, f'Not a straight-edged path: {d}')
    return pairs(nums(d))


def to_units(points, origin, s):
    """SVG pixels (y down) to figure units (y up) about an origin pixel."""
    return [((x - origin[0]) / s, (origin[1] - y) / s) for x, y in points]


def cells(polygon):
    xs, ys = [p[0] for p in polygon], [p[1] for p in polygon]
    require(all(v.denominator == 1 for v in xs + ys), 'Cells need integer corners')
    half = Fraction(1, 2)
    return {(x, y) for x in range(int(min(xs)), int(max(xs))) for y in range(int(min(ys)), int(max(ys)))
            if inside((x + half, y + half), polygon)}


def figure_parts(html):
    root = ET.fromstring(html)
    svg = root.find('svg')
    require(svg is not None, 'Figure has no svg')
    caption = ''.join(root.find('figcaption').itertext())
    texts = [''.join(t.itertext()) for t in svg.iter('text')]
    return svg, caption, texts


def review_triangle_half(svg, caption, texts):
    s, base, height = (Fraction(svg.get(k)) for k in ('data-scale', 'data-base', 'data-height'))
    tri, copy_ = pairs(nums(svg.get('data-triangle'))), pairs(nums(svg.get('data-copy')))
    paths = svg.findall('path')
    require(set(path_points(paths[0].get('d'))) == set(copy_) and set(path_points(paths[1].get('d'))) == set(tri), 'Drawn triangles differ from their data')
    require(tri[0][1] == tri[1][1] and tri[1][0] - tri[0][0] == base * s, 'Triangle base is not the stated base')
    require(tri[0][1] - tri[2][1] == height * s, 'Apex is not at the stated height')
    mid = ((tri[1][0] + tri[2][0]) / 2, (tri[1][1] + tri[2][1]) / 2)
    turned = [(2 * mid[0] - x, 2 * mid[1] - y) for x, y in tri]
    require(set(turned) == set(copy_), 'The copy is not the half-turn about the middle of the right side')
    quad = [tri[0], tri[1], turned[0], tri[2]]
    require(sub(quad[1], quad[0]) == sub(quad[2], quad[3]), 'The two copies do not make a parallelogram')
    edge = sub(tri[2], tri[1])
    require(cross(edge, sub(tri[0], tri[1])) * cross(edge, sub(turned[0], tri[1])) < 0, 'The copies overlap')
    require(abs(shoelace(quad)) == base * height * s * s == 2 * abs(shoelace(tri)), 'Parallelogram area is not base × height')
    line = svg.find('line')
    require(line.get('x1') == line.get('x2') and Fraction(line.get('x1')) == tri[2][0] and Fraction(line.get('y1')) == tri[2][1]
            and Fraction(line.get('y2')) == tri[0][1], 'Dashed height is not the perpendicular from the apex')
    require(fmt(height) in texts and f'base {fmt(base)}' in texts, 'Labels disagree with the data')
    require(f'{fmt(base)} × {fmt(height)} = {fmt(base * height)}' in caption and f'{fmt(base * height)} ÷ 2 = {fmt(base * height / 2)}' in caption, 'Caption areas')
    return {'base': base, 'height': height}


def review_polygon_split(svg, caption, texts):
    s, bottom, top, height = (Fraction(svg.get(k)) for k in ('data-scale', 'data-bottom', 'data-top', 'data-height'))
    lower, upper = pairs(nums(svg.get('data-lower'))), pairs(nums(svg.get('data-upper')))
    paths = svg.findall('path')
    require(path_points(paths[0].get('d')) == lower and path_points(paths[1].get('d')) == upper, 'Drawn triangles differ from their data')
    require(lower[0] == upper[0] and lower[2] == upper[1], 'Triangles must share the diagonal')
    a, b, c, d = lower[0], lower[1], lower[2], upper[2]
    require(a[1] == b[1] and c[1] == d[1] and b[0] - a[0] == bottom * s and c[0] - d[0] == top * s, 'Parallel sides disagree with the data')
    require(a[1] - d[1] == height * s, 'Height disagrees with the data')
    low, up = abs(shoelace(lower)) / (s * s), abs(shoelace(upper)) / (s * s)
    require(low + up == abs(shoelace([a, b, c, d])) / (s * s), 'Triangles do not tile the trapezoid')
    require(fmt(low) in texts and fmt(up) in texts and f'= {fmt(low + up)}' in caption, 'Triangle area labels')
    line = svg.find('line')
    require(line.get('x1') == line.get('x2') and Fraction(line.get('y2')) - Fraction(line.get('y1')) == height * s, 'Dashed height')
    return {'bottom': bottom, 'top': top, 'height': height}


def rect_bounds(points):
    xs, ys = [p[0] for p in points], [p[1] for p in points]
    require(len(points) == 4 and len(set(xs)) == 2 and len(set(ys)) == 2, 'Not an upright rectangle')
    return min(xs), min(ys), max(xs), max(ys)


def review_prism_net(svg, caption, texts):
    s = Fraction(svg.get('data-scale'))
    L, W, H = (Fraction(svg.get(k)) for k in ('data-length', 'data-width', 'data-height'))
    faces = []
    for g in svg.iter('g'):
        if g.get('data-face') is None:
            continue
        x0, y0, x1, y1 = rect_bounds(path_points(g.find('path').get('d')))
        w, h = (x1 - x0) / s, (y1 - y0) / s
        require(Fraction(g.get('data-area')) == w * h and ''.join(g.find('text').itertext()) == fmt(w * h), f'Face {g.get("data-face")} area label')
        faces.append(((x0, y0, x1, y1), tuple(sorted((w, h)))))
    require(sorted(f[1] for f in faces) == sorted(tuple(sorted(p)) for p in [(L, W), (L, W), (L, H), (L, H), (W, H), (W, H)]),
            'Net faces are not the six faces of the box')
    rects = [f[0] for f in faces]
    touching = {0}
    for i, a in enumerate(rects):
        for j, b in enumerate(rects[i + 1:], i + 1):
            ox, oy = min(a[2], b[2]) - max(a[0], b[0]), min(a[3], b[3]) - max(a[1], b[1])
            require(not (ox > 0 and oy > 0), 'Net faces overlap')
    changed = True
    while changed:  # Faces must hang together along shared edges.
        changed = False
        for i, a in enumerate(rects):
            if i in touching:
                continue
            for j in list(touching):
                b = rects[j]
                ox, oy = min(a[2], b[2]) - max(a[0], b[0]), min(a[3], b[3]) - max(a[1], b[1])
                if (ox == 0 and oy > 0) or (oy == 0 and ox > 0):
                    touching.add(i); changed = True; break
    require(len(touching) == 6, 'Net is not connected')
    corners = [(x, y, z) for x in (0, L) for y in (0, W) for z in (0, H)]
    total = sum(f[1][0] * f[1][1] for f in faces)
    box = net_surface_area({'kind': 'rectangular-prism-net', 'length': L, 'width': W, 'height': H})
    require(total == box and f'= {fmt(box)}' in caption and len(corners) == 8, 'Net total disagrees with the box surface area')
    return {'length': L, 'width': W, 'height': H}


def review_cube_packing(svg, caption, texts):
    edge = Fraction(svg.get('data-edge'))
    prism = [Fraction(x) for x in svg.get('data-prism').split(',')]
    counted = []
    for dims in ([Fraction(1)] * 3, prism):
        k = [e / edge for e in dims]
        require(all(c.denominator == 1 for c in k), 'Cubes do not fit')
        counted.append((len(list(itertools.product(*(range(int(c)) for c in k)))), k))
    require(counted[0][0] == int(svg.get('data-unit-cubes')) and counted[1][0] == int(svg.get('data-prism-cubes')), 'Cube counts disagree')
    for g, (_, k) in zip([g for g in svg if g.tag == 'g'], counted):
        lines = [p for p in g.iter('path') if p.get('stroke-width') == '1']
        require(len(lines) == sum(int(c) - 1 for c in k), 'Drawn cube grid disagrees with the count')
    volume = counted[1][0] * edge ** 3
    require(volume == math.prod(prism) and fmt(volume) in caption, 'Packed volume disagrees with the edges')
    return {'edge': edge, 'prism': prism, 'cubes': counted[1][0]}


def review_composite_split(svg, caption, texts):
    s = Fraction(svg.get('data-scale'))
    shape = [tuple(Fraction(v) for v in p.split(',')) for p in svg.get('data-shape').split(' ')]
    lower, upper, missing, outline_ = (path_points(p.get('d')) for p in svg.findall('path'))
    left = lower[0]
    lower, upper = to_units(lower, left, s), to_units(upper, left, s)
    right = outline_[0]
    missing, outline_ = to_units(missing, right, s), to_units(outline_, right, s)
    require(outline_ == shape, 'Drawn L differs from its data')
    lengths = rectilinear(shape, [None if i in (2, 3) else Fraction(math.isqrt(int(dist2(shape[i], shape[(i + 1) % 6]))))
                                  for i in range(6)], 'composite figure')
    require(shape_name(shape) == 'L', 'Composite figure is not an L')
    whole = cells(shape)
    a, b, gap = cells(lower), cells(upper), cells(missing)
    require(not (a & b) and a | b == whole, 'Split rectangles do not tile the L exactly once')
    xs, ys = [p[0] for p in shape], [p[1] for p in shape]
    box = {(x, y) for x in range(int(min(xs)), int(max(xs))) for y in range(int(min(ys)), int(max(ys)))}
    require(not (gap & whole) and gap | whole == box, 'Missing piece and L do not complete the rectangle')
    require(fmt(len(a)) in texts and fmt(len(b)) in texts and fmt(len(gap)) in texts and f'{len(box)} − {len(gap)}' in texts, 'Area labels')
    require(f'= {len(whole)}' in caption, 'Caption total')
    return {'bottom': lengths[0], 'right': lengths[1], 'top': lengths[4], 'left': lengths[5], 'area': len(whole)}


def face_from(text):
    return [tuple(Fraction(v) for v in p.split(',')) for p in text.split(' ')]


def labeled_face(face, where):
    labels = [sqrt_exact(dist2(face[i], face[(i + 1) % len(face)])) for i in range(len(face))]
    return rectilinear_area(face, labels, where)


def review_prism_layers(svg, caption, texts):
    face = face_from(svg.get('data-face'))
    area, _ = labeled_face(face, 'layer face')
    depth, layers = int(svg.get('data-depth')), int(svg.get('data-layers'))
    groups = [g for g in svg if g.tag == 'g']
    require(layers == depth == len(groups), 'Each unit of depth is one drawn layer')
    for g in groups:
        require(len(path_points(g.findall('path')[-1].get('d'))) == len(face), 'Layer is not a copy of the face')
    volume = sum(area for _ in groups)
    require(f'{fmt(area)} unit cubes' in caption and f'= {fmt(volume)} cubic units' in caption, 'Caption volume')
    return {'area': area, 'depth': depth, 'volume': volume}


def review_prism_unrolled(svg, caption, texts):
    face = face_from(svg.get('data-face'))
    area, lengths = labeled_face(face, 'unrolled face')
    widths = [Fraction(w) for w in svg.get('data-widths').split(',')]
    depth = Fraction(svg.get('data-depth'))
    require(widths == lengths, 'Strips are not one per face edge, in order')
    strips = [g for g in svg.iter('g') if g.get('data-strip') is not None]
    rects = [g.find('rect') for g in strips]
    s = Fraction(rects[0].get('width')) / widths[0]
    x = Fraction(rects[0].get('x'))
    for g, r, w in zip(strips, rects, widths):
        require(Fraction(g.get('data-strip')) == w and Fraction(r.get('x')) == x and Fraction(r.get('width')) == w * s
                and Fraction(r.get('height')) == depth * s and r.get('y') == rects[0].get('y'), 'Strips are not laid end to end')
        x += w * s
    perimeter = sum(lengths)
    outline_ = path_points(svg.find('path').get('d'))
    drawn = to_units(outline_, outline_[0], Fraction(abs(outline_[1][0] - outline_[0][0])) / (face[1][0] - face[0][0]))
    require(drawn == [(p[0] - face[0][0], p[1] - face[0][1]) for p in face], 'Drawn face differs from its data')
    lift = lambda p, z: (p[0], p[1], z)
    sides = [newell_area([lift(p, Fraction(0)), lift(q, Fraction(0)), lift(q, depth), lift(p, depth)]) for p, q in zip(face, face[1:] + face[:1])]
    require((x - Fraction(rects[0].get('x'))) / s == perimeter and sum(sides) == perimeter * depth, 'Strip length is not the perimeter')
    total = 2 * area + sum(sides)
    require(f'perimeter {fmt(perimeter)}' in texts and f'surface area of {fmt(total)}' in caption, 'Perimeter or surface area label')
    return {'area': area, 'perimeter': perimeter, 'depth': depth, 'surface': total}


def review_cylinder_stack(svg, caption, texts):
    r, h, layers = Fraction(svg.get('data-radius')), Fraction(svg.get('data-height')), int(svg.get('data-layers'))
    slabs = [g for g in svg.iter('g') if g.get('data-layer') is not None]
    require(len(slabs) == layers == h, 'One drawn layer per unit of height')
    shapes = set()
    for g in slabs:
        v = nums(g.find('path').get('d'))
        shapes.add((v[2] - v[0], v[3] - v[1], g.find('ellipse').get('rx')))
    require(len(shapes) == 1, 'Layers are not equal copies of the base')
    volume = disc_volume_coefficient('cylinder', r, h)
    layer = disc_volume_coefficient('cylinder', r, Fraction(1))
    require(f'= {fmt(volume)}π' in caption and f'{fmt(layer)}π × {fmt(h)} = {fmt(volume)}π' in texts, 'Stack volume label')
    return {'radius': r, 'height': h, 'volume': volume}


def review_cone_sphere_cylinder(svg, caption, texts):
    r, h = Fraction(svg.get('data-radius')), Fraction(svg.get('data-height'))
    require(h == 2 * r, 'The sphere must just fit: height = diameter')
    stated = [Fraction(v) for v in svg.get('data-volumes').split(',')]
    measured = [disc_volume_coefficient('cone', r, h), disc_volume_coefficient('sphere', r, None), disc_volume_coefficient('cylinder', r, h)]
    require(stated == measured and measured[0] * 2 == measured[1] and measured[0] * 3 == measured[2], 'Cone, sphere and cylinder volumes')
    groups = {g.get('data-solid'): g for g in svg.iter('g') if g.get('data-solid')}
    require([groups[k].get('data-volume') for k in ('cone', 'sphere', 'cylinder')] == [fmt(v) + 'π' for v in measured], 'Volume labels')
    R = Fraction(groups['sphere'].find('circle').get('r'))
    cone = nums(groups['cone'].find('path').get('d'))
    cyl = nums(groups['cylinder'].find('path').get('d'))
    require(cone[2] - cone[0] == R and (cone[3] - cone[1]) / R == h / r, 'Cone drawn out of proportion')
    require(cyl[2] - cyl[0] == 0 and (cyl[3] - cyl[1]) / R == h / r, 'Cylinder drawn out of proportion')
    require(f'{fmt(measured[2])}π' in caption, 'Caption cylinder volume')
    return {'radius': r, 'height': h, 'volumes': measured}


FIGURE_REVIEWS = {
    'av-triangle-half': review_triangle_half, 'av-polygon-split': review_polygon_split, 'av-prism-net': review_prism_net,
    'av-cube-packing': review_cube_packing, 'av-composite-split': review_composite_split, 'av-prism-layers': review_prism_layers,
    'av-prism-unrolled': review_prism_unrolled, 'av-cylinder-stack': review_cylinder_stack,
    'av-cone-sphere-cylinder': review_cone_sphere_cylinder,
}


def review_figures(figures):
    facts, chains = {}, 0
    for f in figures:
        svg, caption, texts = figure_parts(f['html'])
        require(svg.get('data-lesson-illustration') == f['kind'], 'Figure kind mismatch')
        facts[f['kind']] = FIGURE_REVIEWS[f['kind']](svg, caption, texts)
        chains += prose_equalities(caption)
    require(set(facts) == set(FIGURE_REVIEWS), 'Figure inventory')
    return facts, chains


def lesson_text(lesson, illustration=None):
    return ' '.join(p for section in lesson['sections'] if illustration is None or section.get('illustration') == illustration
                    for p in section['paragraphs'])


def review_lesson_figure_links(lessons, facts):
    """Where prose describes the figure beside it, its numbers must be the figure's."""
    links = [
        ('triangle-area-base-height', 'av-triangle-half', r'For base (\d+) cm and height (\d+) cm',
         lambda f: (f['base'], f['height'])),
        ('polygon-area-decompose', 'av-polygon-split', r'For parallel sides (\d+) and (\d+) and height (\d+)',
         lambda f: (f['bottom'], f['top'], f['height'])),
        ('net-surface-area', None, r'For a box (\d+) cm long, (\d+) cm wide and (\d+) cm tall',
         lambda f: (facts['av-prism-net']['length'], facts['av-prism-net']['width'], facts['av-prism-net']['height'])),
        ('unit-fraction-cube-packing', 'av-cube-packing', r'A prism (\d+ \d+/\d+|\d+) cm by (\d+ \d+/\d+|\d+) cm by (\d+ \d+/\d+|\d+) cm holds (?:\d+ × )*\d+ = (\d+)',
         lambda f: (*f['prism'], f['cubes'])),
        ('composite-area', None, r'bottom of (\d+) m and a top of (\d+) m.*?A left side of (\d+) m and a right side of (\d+) m',
         lambda f: (facts['av-composite-split']['bottom'], facts['av-composite-split']['top'], facts['av-composite-split']['left'], facts['av-composite-split']['right'])),
        ('composite-face-prism-surface-area', 'av-prism-unrolled', r'with area (\d+), perimeter (\d+) and depth (\d+)',
         lambda f: (f['area'], f['perimeter'], f['depth'])),
        ('cylinder-volume', 'av-cylinder-stack', r'A cylinder with radius (\d+) cm and height (\d+) cm',
         lambda f: (f['radius'], f['height'])),
    ]
    by_id = {lesson['id']: lesson for lesson in lessons}
    for lesson_id, kind, pattern, expected in links:
        text = lesson_text(by_id[lesson_id], kind)
        m = re.search(pattern, text, re.S)
        require(m is not None, f'Lesson {lesson_id} no longer describes its figure')
        got = tuple(plain_value(g).get(0, Fraction(0)) for g in m.groups())
        require(got == tuple(expected(facts.get(kind))), f'Lesson {lesson_id} describes its figure with numbers {got}, the figure shows {expected(facts.get(kind))}')
    return len(links)


def review_area_volume_content(data=None):
    data = content(data)
    chains = 0
    sheets = Counter()
    for sheet in data['worksheets']:
        template, problems = sheet['templateId'], sheet['problems']
        require(template in AREA_VOLUME and len(problems) == 12, f'Worksheet length {template}/{sheet["edition"]}')
        keys = [json.dumps({k: p['public'][k] for k in ('prompt', 'figure')}, sort_keys=True) for p in problems]
        require(len(set(keys)) == 12, f'Repeated worksheet problem {template}/{sheet["edition"]}')
        require(all(p['public']['templateId'] == template for p in problems), 'Worksheet mixes families')
        tags = set().union(*(worksheet_tags(p) for p in problems))
        missing = WORKSHEET_BREADTH[template] - tags
        require(not missing, f'Worksheet {template}/{sheet["edition"]} lacks {sorted(missing)}')
        chains += sum(review_problem(p) for p in problems)
        sheets[template] += 1
    require(set(sheets) == AREA_VOLUME and len(set(sheets.values())) == 1, 'Every family needs the same number of worksheet editions')
    lessons = {lesson['id']: lesson for lesson in data['lessons']}
    require(set(lessons) == AREA_VOLUME and all(lesson['templateIds'][0] == i for i, lesson in lessons.items()), 'Lesson inventory')
    for template, lesson in lessons.items():
        worked = lesson['workedExample']
        expected, unit = solve_worked(template, worked['prompt'])
        require(Fraction(worked['answer']) == expected, f'Worked example {template}: answer {worked["answer"]}, the prompt gives {fmt(expected)}')
        require(worked.get('answerUnit') == unit, f'Worked example {template}: unit {worked.get("answerUnit")!r}, the prompt asks for {unit!r}')
        require(len(worked['steps']) >= 2 and expected in numbers_in(worked['steps'][-1]), f'Worked example {template}: last step does not reach the answer')
        texts = worked['steps'] + [lesson['summary'], lesson['parentGuide'], *lesson['objectives'], *lesson['pitfalls']]
        texts += [p for section in lesson['sections'] for p in section['paragraphs']]
        chains += sum(prose_equalities(t) for t in texts)
    figures, figure_chains = review_figures(data['figures'])
    used = {section.get('illustration') for lesson in lessons.values() for section in lesson['sections']} - {None}
    require(used == set(figures), f'Lessons and illustrations disagree: {used ^ set(figures)}')
    links = review_lesson_figure_links(data['lessons'], figures)
    return {'worksheets': len(data['worksheets']), 'checkedEqualities': chains + figure_chains, 'lessons': len(lessons),
            'figures': len(figures), 'figureLinks': links}


def review_content_mutations(data=None):
    data = content(data)
    review_area_volume_content(data)  # Mutants only mean something if the original passes.
    mutants = []

    def mutant(change):
        bad = copy.deepcopy(data)
        change(bad)
        mutants.append(bad)

    def lesson(bad, lesson_id):
        return next(lesson for lesson in bad['lessons'] if lesson['id'] == lesson_id)

    def figure(bad, kind):
        return next(f for f in bad['figures'] if f['kind'] == kind)

    def swap(target, key, old, new):
        require(old in target[key], f'Mutation does not apply: {old}')
        target[key] = target[key].replace(old, new, 1)

    mutant(lambda b: lesson(b, 'triangle-area-base-height')['workedExample'].update(answer='85'))
    mutant(lambda b: lesson(b, 'cone-sphere-volume')['workedExample'].update(answer='216'))
    mutant(lambda b: lesson(b, 'composite-area')['workedExample'].update(prompt=lesson(b, 'composite-area')['workedExample']['prompt'].replace('top is 6', 'top is 7')))
    mutant(lambda b: lesson(b, 'fraction-edge-volume')['workedExample'].update(answerUnit='square feet'))
    mutant(lambda b: b['worksheets'][0]['problems'].__setitem__(1, b['worksheets'][0]['problems'][0]))
    mutant(lambda b: b['worksheets'][3]['problems'].pop())
    mutant(lambda b: b['worksheets'][-1]['problems'][0].update(answer='999'))
    mutant(lambda b: b['worksheets'][10]['problems'][2]['explanation'].append('A false check: 4 × 3 = 13.'))
    mutant(lambda b: swap(lesson(b, 'net-surface-area')['sections'][1]['paragraphs'], 0, '= 62', '= 64'))
    mutant(lambda b: lesson(b, 'cylinder-volume')['sections'][1].__setitem__('paragraphs', [p.replace('141.3', '141.4') for p in lesson(b, 'cylinder-volume')['sections'][1]['paragraphs']]))
    mutant(lambda b: lesson(b, 'composite-face-prism-surface-area')['sections'][1].__setitem__('paragraphs', [p.replace('perimeter 28', 'perimeter 30').replace('2 × 28 + 28 × 4 = 56 + 112', '2 × 28 + 30 × 4 = 56 + 120').replace('= 168', '= 176') for p in lesson(b, 'composite-face-prism-surface-area')['sections'][1]['paragraphs']]))
    mutant(lambda b: lesson(b, 'cone-sphere-volume')['workedExample']['steps'].__setitem__(1, lesson(b, 'cone-sphere-volume')['workedExample']['steps'][1].replace('288', '289', 1)))
    for kind, old, new in [
        ('av-triangle-half', 'data-copy="350,40', 'data-copy="340,40'),
        ('av-polygon-split', 'data-top="6"', 'data-top="7"'),
        ('av-prism-net', 'data-area="15"', 'data-area="16"'),
        ('av-cube-packing', 'data-prism-cubes="30"', 'data-prism-cubes="32"'),
        ('av-composite-split', 'data-shape="0,0 10,0 10,4 6,4', 'data-shape="0,0 10,0 10,4 7,4'),
        ('av-prism-layers', 'data-layers="4"', 'data-layers="5"'),
        ('av-prism-unrolled', 'data-widths="8,2,5,4,3,6"', 'data-widths="8,2,5,4,6,3"'),
        ('av-cylinder-stack', 'data-height="5"', 'data-height="6"'),
        ('av-cone-sphere-cylinder', 'data-volumes="18,36,54"', 'data-volumes="18,36,56"'),
        ('av-cone-sphere-cylinder', '36π = 4/3', '36π = 5/3'),
        ('av-composite-split', '90 − 20 = 70', '90 − 20 = 60'),
    ]:
        mutant(lambda b, kind=kind, old=old, new=new: swap(figure(b, kind), 'html', old, new))
    for bad in mutants:
        try:
            review_area_volume_content(bad)
        except (ValueError, KeyError, TypeError, StopIteration, AttributeError, IndexError):
            continue
        raise ValueError('Corrupted area/volume content accepted')
    return len(mutants)


if __name__ == '__main__':
    print(review_area_volume_fixtures())
    print(review_area_volume_content())
    print({'contentMutantsRejected': review_content_mutations()})
