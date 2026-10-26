"""Independent review of the point-plot families from their public wording.

Every expected point is derived from the prompt alone: named coordinates,
axis-distance descriptions, a linear equation parsed exactly with Fractions,
or a rigid motion applied to the listed vertices. The private answer and the
on-line grading coefficients are only values under test. Grading is
reimplemented here (exact set or sequence; any distinct lattice points of one
line) and never imported from the generator.
"""

import copy
import json
import re
from fractions import Fraction as F
from math import gcd

SUPPORTED = frozenset({"plot-points", "graph-linear-equation", "place-transformed-image"})
GRID = {"xMin": -6, "xMax": 6, "yMin": -6, "yMax": 6, "step": 1, "xLabel": "x", "yLabel": "y"}
PRIME = "\u2032"
NUM = r"-?\(?-?\d+(?:/\d+)?\)?"
PAIR = re.compile(r"\((-?\d+), (-?\d+)\)")
NAMED = re.compile(r"([A-Z])'?\((-?\d+), (-?\d+)\)")


def require(condition, message):
    if not condition:
        raise ValueError(message)


def normalized(text):
    """One spelling for both the typeset and the plain reading of a string."""
    text = text.replace(PRIME, "'").replace("\u2212", "-")
    text = re.sub(r"\\[td]?frac\{(-?\d+|[a-z])\}\{(\d+|[a-z])\}", r"(\1/\2)", text)
    text = text.replace("\\to", "->").replace("$", "")
    return re.sub(r"(?<![\w()/])(\d+)/(\d+)(?![\w()/])", r"(\1/\2)", text)


def rational(token):
    text = token.replace(" ", "")
    core = text.replace("-", "").replace("(", "").replace(")", "")
    require(re.fullmatch(r"\d+(?:/\d+)?", core) is not None, f"Not a number: {token}")
    return (-1 if text.count("-") % 2 else 1) * F(core)


def english(items):
    return items[0] if len(items) == 1 else ", ".join(items[:-1]) + " and " + items[-1]


def unit(n, word="unit"):
    return f"{n} {word}" + ("" if n == 1 else "s")


def wire(points):
    return json.dumps([list(p) for p in points], separators=(",", ":"))


def in_grid(point):
    return GRID["xMin"] <= point[0] <= GRID["xMax"] and GRID["yMin"] <= point[1] <= GRID["yMax"]


def lattice():
    return [(x, y) for x in range(GRID["xMin"], GRID["xMax"] + 1) for y in range(GRID["yMin"], GRID["yMax"] + 1)]


# ---------------------------------------------------------------- linear forms
# A linear form is (coefficient of x, coefficient of y, constant).

def linear_tokens(text):
    tokens = re.findall(r"\d+|[xy]|[-+*/()]|\S", text.replace(" ", ""))
    require(all(re.fullmatch(r"\d+|[xy]|[-+*/()]", t) for t in tokens), f"Unreadable expression: {text}")
    return tokens


def linear_expression(text):
    tokens, position = linear_tokens(text), [0]

    def peek():
        return tokens[position[0]] if position[0] < len(tokens) else None

    def take():
        position[0] += 1
        return tokens[position[0] - 1]

    def times(u, v):
        if u[0] == u[1] == 0:
            return (u[2] * v[0], u[2] * v[1], u[2] * v[2])
        require(v[0] == v[1] == 0, "Nonlinear product")
        return times(v, u)

    def factor():
        token = take() if peek() is not None else None
        require(token is not None, "Truncated expression")
        if token == "-":
            u = factor()
            return (-u[0], -u[1], -u[2])
        if token == "(":
            u = expression()
            require(take() == ")", "Unbalanced parenthesis")
            return u
        if token == "x":
            return (F(1), F(0), F(0))
        if token == "y":
            return (F(0), F(1), F(0))
        require(token.isdigit(), f"Unexpected {token}")
        return (F(0), F(0), F(int(token)))

    def term():
        u = factor()
        while peek() is not None and peek() not in "+-)":
            if peek() == "/":
                take()
                v = factor()
                require(v[0] == v[1] == 0 and v[2] != 0, "Division by a non-constant")
                u = (u[0] / v[2], u[1] / v[2], u[2] / v[2])
            else:
                if peek() == "*":
                    take()
                u = times(u, factor())
        return u

    def expression():
        if peek() == "+":
            take()
        u = term()
        while peek() in ("+", "-"):
            sign = 1 if take() == "+" else -1
            v = term()
            u = (u[0] + sign * v[0], u[1] + sign * v[1], u[2] + sign * v[2])
        return u

    result = expression()
    require(position[0] == len(tokens), f"Trailing input in {text}")
    return result


def line_of_equation(text):
    """a·x + b·y = c in lowest integer terms, first nonzero of (a, b) positive."""
    sides = text.split("=")
    require(len(sides) == 2, f"Not one equation: {text}")
    left, right = (linear_expression(s) for s in sides)
    a, b, k = left[0] - right[0], left[1] - right[1], left[2] - right[2]
    return canonical_line(a, b, -k)


def canonical_line(a, b, c):
    a, b, c = F(a), F(b), F(c)
    require(a != 0 or b != 0, "Equation has no line")
    scale = 1
    for v in (a, b, c):
        scale = scale * v.denominator // gcd(scale, v.denominator)
    a, b, c = (int(v * scale) for v in (a, b, c))
    g = gcd(gcd(abs(a), abs(b)), abs(c))
    a, b, c = a // g, b // g, c // g
    if a < 0 or (a == 0 and b < 0):
        a, b, c = -a, -b, -c
    return a, b, c


def on_line(line, point):
    return line[0] * point[0] + line[1] * point[1] == line[2]


def slope_of(line):
    require(line[1] != 0, "Vertical line outside family")
    return F(-line[0], line[1])


# ---------------------------------------------------------------- prompts

def named_points(text):
    """'A(1, 2), B(3, 4) and C(5, 6)': each name with its coordinates, in order."""
    items = re.findall(r"[A-Z]\(-?\d+, -?\d+\)", text)
    require(len(items) >= 2 and text == english(items), f"Points not listed as 'A, B and C': {text}")
    points = []
    for item in items:
        match = re.fullmatch(r"([A-Z])\((-?\d+), (-?\d+)\)", item)
        points.append((match[1], (int(match[2]), int(match[3]))))
    require(len({n for n, _ in points}) == len(points), "Repeated point name")
    return points


def axis_description(name, text):
    match = re.fullmatch(
        name + r" is (\d+) (units?) (left|right) of the y-axis and (\d+) (units?) (above|below) the x-axis\.", text)
    if match:
        h, hw, lr, v, vw, ab = match.groups()
        h, v = int(h), int(v)
        require(h > 0 and v > 0 and hw == unit(h).split()[1] and vw == unit(v).split()[1], "Distance grammar")
        return (h if lr == "right" else -h, v if ab == "above" else -v)
    match = re.fullmatch(name + r" lies on the x-axis, (\d+) (units?) (left|right) of the y-axis\.", text)
    if match:
        h, hw, lr = match.groups()
        require(int(h) > 0 and hw == unit(int(h)).split()[1], "Distance grammar")
        return (int(h) if lr == "right" else -int(h), 0)
    match = re.fullmatch(name + r" lies on the y-axis, (\d+) (units?) (above|below) the x-axis\.", text)
    require(match is not None, f"Unreadable description: {text}")
    v, vw, ab = match.groups()
    require(int(v) > 0 and vw == unit(int(v)).split()[1], "Distance grammar")
    return (0, int(v) if ab == "above" else -int(v))


def read_plot_points(prompt):
    """(variant, labelled source points, expected answer points)."""
    match = re.fullmatch(r"Plot the points (.+)\.", prompt)
    if match:
        points = named_points(match[1])
        require(3 <= len(points) <= 4, "Plot 3 or 4 named points")
        return "list", points, [p for _, p in points]
    match = re.fullmatch(r"Point ([A-Z])\((-?\d+), (-?\d+)\) is plotted\. Plot its reflection across the x-axis "
                         r"and its reflection across the y-axis\.", prompt)
    if match:
        x, y = int(match[2]), int(match[3])
        require(x != 0 and y != 0, "An image would coincide with the plotted point")
        return "reflection", [(match[1], (x, y))], [(x, -y), (-x, y)]
    match = re.fullmatch(r"Plot both points\. ([A-Z]) (.+?\.) ([A-Z]) (.+\.)", prompt)
    require(match is not None, f"Unknown plot-points prompt: {prompt}")
    first, second = match[1], match[3]
    require(first != second, "Two points share a name")
    p = axis_description(first, f"{first} {match[2]}")
    q = axis_description(second, f"{second} {match[4]}")
    return "described", [(first, p), (second, q)], [p, q]


def read_line(prompt):
    match = re.fullmatch(r"y is proportional to x, and y = (-?\d+) when x = (-?\d+)\. Graph the relationship "
                         r"by placing (\d+) points on its line\.", prompt)
    if match:
        y, x = int(match[1]), int(match[2])
        require(x != 0, "A proportional relationship needs x ≠ 0 to fix k")
        return "proportional", canonical_line(y, -x, 0), int(match[3])
    match = re.fullmatch(r"Graph (.+) by placing (\d+) points on its line\.", prompt)
    require(match is not None, f"Unknown graphing prompt: {prompt}")
    equation = match[1]
    if re.fullmatch(r"y = -?\d+", equation):
        variant = "horizontal"
    elif re.fullmatch(r"y = .*x.*", equation):
        variant = "point-slope" if "(x" in equation else "slope-intercept"
    elif re.fullmatch(r"y [+-] \d+ = .+", equation):
        variant = "point-slope"
    else:
        variant = "standard"
    return variant, line_of_equation(equation), int(match[2])


MOTION_RULES = {
    "reflected over the x-axis": lambda p: (p[0], -p[1]),
    "reflected over the y-axis": lambda p: (-p[0], p[1]),
    "rotated 90° counterclockwise about the origin": lambda p: (-p[1], p[0]),
    "rotated 90° clockwise about the origin": lambda p: (p[1], -p[0]),
    "rotated 180° about the origin": lambda p: (-p[0], -p[1]),
}


def read_motion(text):
    if text in MOTION_RULES:
        return text, MOTION_RULES[text]
    match = re.fullmatch(r"translated(?: (\d+) (units?) (left|right))?(?: and)?(?: (\d+) (units?) (up|down))?", text)
    require(match is not None and (match[1] or match[4]), f"Unknown motion: {text}")
    require((match[1] is None or match[4] is None) == (" and " not in text), "Translation conjunction")
    dx = dy = 0
    if match[1]:
        require(int(match[1]) > 0 and match[2] == unit(int(match[1])).split()[1], "Distance grammar")
        dx = int(match[1]) * (1 if match[3] == "right" else -1)
    if match[4]:
        require(int(match[4]) > 0 and match[5] == unit(int(match[4])).split()[1], "Distance grammar")
        dy = int(match[4]) * (1 if match[6] == "up" else -1)
    return ("translation", dx, dy), lambda p: (p[0] + dx, p[1] + dy)


def read_transform(prompt):
    match = re.fullmatch(r"(Triangle|Segment) ([A-Z]+) has (vertices|endpoints) (.+?)\. It is (.+?)\. "
                         r"Place (.+), the images of (.+)\.", prompt)
    require(match is not None, f"Unknown transformation prompt: {prompt}")
    shape, name, noun, listed, motion, primes, images_of = match.groups()
    size = 3 if shape == "Triangle" else 2
    require(noun == ("vertices" if size == 3 else "endpoints") and len(name) == size, "Shape wording")
    vertices = named_points(listed)
    require([n for n, _ in vertices] == list(name), "Vertices must be listed in the shape's name order")
    require(len(set(name)) == size, "Repeated vertex name")
    require(primes == english([n + "'" for n in name]), "Placed names must be the primed vertices")
    require(images_of == english(list(name)), "Image list must name every vertex")
    coordinates = [p for _, p in vertices]
    require(len(set(coordinates)) == size, "Coincident vertices")
    if size == 3:
        (ax, ay), (bx, by), (cx, cy) = coordinates
        require((bx - ax) * (cy - ay) - (by - ay) * (cx - ax) != 0, "Collinear triangle vertices")
    kind, rule = read_motion(motion)
    return shape, vertices, kind, rule, [rule(p) for p in coordinates]


# ---------------------------------------------------------------- solve

def solve(public):
    template = public["templateId"]
    require(template in SUPPORTED, "Wrong family")
    prompt = normalized(public["prompt"])
    if template == "plot-points":
        _, _, points = read_plot_points(prompt)
        return wire(sorted(points))
    if template == "graph-linear-equation":
        _, line, _ = read_line(prompt)
        return "line:{}x+{}y={}".format(*line)
    _, _, _, _, images = read_transform(prompt)
    return wire(images)


# ---------------------------------------------------------------- review

def grade(response, grading, points):
    """Independent grader: True when the placed points answer the item."""
    if len(points) != response["pointCount"] or not all(in_grid(p) for p in points):
        return False
    if len(set(points)) != len(points):
        return False
    if grading["mode"] == "on-line":
        return all(grading["a"] * x + grading["b"] * y == grading["c"] for x, y in points)
    return None  # exact grading compares against the expected answer at the caller


def answer_points(problem, ordered):
    value = json.loads(problem["answer"])
    require(isinstance(value, list) and all(
        isinstance(p, list) and len(p) == 2 and all(type(v) is int for v in p) for p in value), "Answer is not lattice points")
    require(problem["answer"] == wire(value), "Answer is not compact JSON")
    points = [tuple(p) for p in value]
    require(len(set(points)) == len(points), "Duplicate answer point")
    require(all(in_grid(p) for p in points), "Answer point outside the grid")
    if not ordered:
        require(points == sorted(points), "An unordered answer must be sorted by x then y")
    return points


def common_response(response, count, ordered, connect):
    require(response["kind"] == "point-plot", "Not a point-plot response")
    require(response["grid"] == GRID, "Grid must be -6..6 on both axes with step 1")
    require(response["pointCount"] == count, "Point count disagrees with the prompt")
    require(response["ordered"] is ordered and response["connect"] == connect, "Order/connect contract")
    require(("pointLabels" in response) == ordered, "Labels exactly for ordered points")


def pairs_in(text):
    return {(int(a), int(b)) for a, b in PAIR.findall(text)}


def walkthrough_points(problem, color):
    walk = problem.get("walkthrough")
    if not walk:
        return None
    return [(pt["x"], pt["y"], pt.get("label")) for e in walk["elements"] for pt in e.get("points", [])
            if pt.get("color") == color]


def review_explanation_mentions(problem, points, extra=""):
    explanation = problem["explanation"]
    require(isinstance(explanation, list) and explanation and all(isinstance(s, str) and s.strip() for s in explanation),
            "Explanation must be non-empty")
    require(isinstance(problem.get("hint"), str) and problem["hint"].strip(), "Missing hint")
    text = normalized(" ".join(explanation)) + " " + extra
    mentioned = pairs_in(text)
    for p in points:
        require(p in mentioned, f"Explanation never states the point {p}")
    return normalized(" ".join(explanation)), normalized(problem["hint"])


def review_plot_points(problem):
    public = problem["public"]
    response = public["response"]
    prompt = normalized(public["prompt"])
    variant, sources, points = read_plot_points(prompt)
    require(len(set(points)) == len(points), "Two named points coincide")
    common_response(response, len(points), False, "none")
    expected = sorted(points)
    actual = answer_points(problem, False)
    require(actual == expected, f"Wrong points: expected {wire(expected)}")
    require(problem["pointGrading"] == {"mode": "exact"}, "Plotting named points is exact")
    text, hint = review_explanation_mentions(problem, expected, prompt if variant == "list" else "")
    if variant == "reflection":
        (name, (x, y)), = sources
        require(response["label"] == "Plot both reflections", "Label")
        require(response.get("given") == {"vertices": [{"x": x, "y": y, "label": name}], "closed": False},
                "The plotted point must be the only given")
        for axis, value in re.findall(r"across the (x|y)-axis keeps [xy] = (-?\d+)", text):
            require(int(value) == (x if axis == "x" else y), "Reflection keeps the wrong coordinate")
        for a, b, c, d in re.findall(r"\((-?\d+), (-?\d+)\) becomes \((-?\d+), (-?\d+)\)", text):
            require((int(a), int(b)) == (x, y) and (int(c), int(d)) in points, "False reflection image")
        match = re.search(r"keeps the horizontal position of ([A-Z]), x = (-?\d+)", hint)
        require(match is None or (match[1], int(match[2])) == (name, x), "Hint misreads the point")
    else:
        require(response["label"] == f"Plot {len(points)} points", "Label")
        require("given" not in response, "No given shape")
        for name, x, y in re.findall(r"so ([A-Z]) is \((-?\d+), (-?\d+)\)", text):
            require((name, (int(x), int(y))) in sources, "Explanation places a point wrongly")
        for name, x, y in NAMED.findall(text + " " + hint):
            require((name, (int(x), int(y))) in sources, "Explanation renames a point")
        for name, x, y in NAMED.findall(text):
            p = (int(x), int(y))
            step = re.search(re.escape(f"{name}({x}, {y}): from the origin,") + r"([^.]*)\.", text)
            if step:
                moves = dict((d, int(n)) for n, d in re.findall(r"move (\d+) units? (right|left|up|down)", step[1]))
                require(moves.get("right", 0) - moves.get("left", 0) == p[0]
                        and moves.get("up", 0) - moves.get("down", 0) == p[1], "Wrong moves to a point")
        match = re.search(r"Start with ([A-Z])\((-?\d+), (-?\d+)\)\. The first number, (-?\d+), .*the second, (-?\d+),", hint)
        if match:
            require(match[2] == match[4] and match[3] == match[5], "Hint misreads the coordinates")
    walk = walkthrough_points(problem, "accent")
    if walk is not None:
        require(sorted((x, y) for x, y, _ in walk) == expected, "Solved grid shows other points")
    return wire(expected)


def review_line(problem):
    public = problem["public"]
    response = public["response"]
    prompt = normalized(public["prompt"])
    variant, line, count = read_line(prompt)
    require(count == 2, "Two points determine the line")
    common_response(response, count, False, "line")
    require(response["label"] == "Place 2 points on the line" and "given" not in response, "Label/given")
    grading = problem["pointGrading"]
    require(grading.get("mode") == "on-line" and set(grading) == {"mode", "a", "b", "c"}, "Line items grade on-line")
    a, b, c = grading["a"], grading["b"], grading["c"]
    require(all(type(v) is int for v in (a, b, c)) and (a, b) != (0, 0), "Integer coefficients")
    require(gcd(gcd(abs(a), abs(b)), abs(c)) == 1, "Coefficients not in lowest terms")
    require(canonical_line(a, b, c) == line, f"Grading line {a}x+{b}y={c} is not the prompt's line {line}")
    on_window = [p for p in lattice() if on_line(line, p)]
    require(len(on_window) >= 3, "Fewer than three lattice points of the line are placeable")
    accepted = [p for p in lattice() if grade({"pointCount": 1}, grading, [p])]
    require(accepted == on_window, "Grading accepts a point set other than the line's lattice points")
    pairs = [(p, q) for i, p in enumerate(on_window) for q in on_window[i + 1:]]
    require(all(grade(response, grading, list(pair)) for pair in pairs), "A correct pair is rejected")
    require(not grade(response, grading, [on_window[0], on_window[0]]), "A repeated point is accepted")
    actual = answer_points(problem, False)
    require(len(actual) == 2 and all(on_line(line, p) for p in actual), "Stored answer is not two points on the line")
    require(grade(response, grading, actual), "Stored answer fails grading")
    text, hint = review_explanation_mentions(problem, actual)
    for p in pairs_in(text + " " + hint):
        require(on_line(line, p), f"Explanation names {p}, which is off the line")
    m = slope_of(line)
    for match in re.finditer(r"slope (?:is |of )?(?:m = |-\(a/b\) = )?(" + NUM + r")(?![\d/])", text + " " + hint):
        require(rational(match[1]) == m, f"False slope {match[1]}")
    for rise, run in re.findall(r"rise of (" + NUM + r") for every run of (\d+)", text):
        require(rational(rise) / int(run) == m, "Rise/run disagrees with the slope")
    for rise, run in re.findall(r"rises (" + NUM + r") over a run of (" + NUM + r")", text):
        require(rational(rise) / rational(run) == m, "Rise/run disagrees with the slope")
    for x0, y0, h, hd, v, vd, x1, y1 in re.findall(
            r"From \((-?\d+), (-?\d+)\) move (\d+) units? (right|left) and (\d+) units? (up|down) to \((-?\d+), (-?\d+)\)",
            text + " " + hint):
        dx = int(h) * (1 if hd == "right" else -1)
        dy = int(v) * (1 if vd == "up" else -1)
        require((int(x0) + dx, int(y0) + dy) == (int(x1), int(y1)), "Moves do not reach the stated point")
    for h, hd, v, vd in re.findall(r"move (\d+) units? (right|left) and (\d+) units? (up|down)", text + " " + hint):
        require(F(int(v) * (1 if vd == "up" else -1), int(h) * (1 if hd == "right" else -1)) == m,
                "Moves disagree with the slope")
    for sx, left, right, coefficient, value, solved in re.findall(
            r"Substitute x = (-?\d+): ([^=]+) = (-?\d+), so (-?\d*)y = (-?\d+) and y = (-?\d+)", text):
        form = linear_expression(left)
        require(form[0] == 0 and form[1] == (int(coefficient) if coefficient not in ("", "-") else (1 if coefficient == "" else -1)),
                "Substitution left x in the equation or misreads the coefficient of y")
        require(form[1] * int(solved) + form[2] == int(right), "Substitution arithmetic")
        require(F(int(coefficient) if coefficient not in ("", "-") else (1 if coefficient == "" else -1)) * int(solved)
                == int(value), "Solving for y")
        require(on_line(line, (int(sx), int(solved))), "Substitution lands off the line")
    for value in re.findall(r"the equation is (y = [^,.]+)", text):
        require(line_of_equation(value) == line, "Rewritten equation is a different line")
    for left, right in re.findall(r"k = (" + NUM + r")(?: = (" + NUM + r"))?", text):
        require(rational(left) == m and (not right or rational(right) == m), "Constant of proportionality")
    if variant == "horizontal":
        level = F(line[2], line[1])
        match = re.search(r"horizontal line (\d+) units? (above|below) the x-axis", text)
        require(match is not None and int(match[1]) * (1 if match[2] == "above" else -1) == level, "Horizontal level")
    if variant == "proportional":
        require((0, 0) in pairs_in(text), "A proportional graph passes through the origin")
    walk = walkthrough_points(problem, "accent")
    if walk is not None:
        require(sorted((x, y) for x, y, _ in walk) == actual, "Solved grid shows other points")
    return problem["answer"]


def review_transform(problem):
    public = problem["public"]
    response = public["response"]
    prompt = normalized(public["prompt"])
    shape, vertices, kind, rule, images = read_transform(prompt)
    size = len(vertices)
    common_response(response, size, True, "polygon")
    labels = [n + PRIME for n, _ in vertices]
    require(response["pointLabels"] == labels, "Slots must be the primed vertices in order")
    require(response["label"] == "Place " + english(labels), "Label")
    require(response.get("given") == {
        "vertices": [{"x": p[0], "y": p[1], "label": n} for n, p in vertices], "closed": size == 3},
        "Given shape disagrees with the prompt")
    require(len(set(images)) == size, "Images coincide")
    require(all(in_grid(p) for p in images), "An image falls outside the grid")
    require(problem["pointGrading"] == {"mode": "exact"}, "Images are exact")
    actual = answer_points(problem, True)
    require(actual == images, f"Wrong images: expected {wire(images)}")
    text, hint = review_explanation_mentions(problem, images)
    probes = [(0, 0), (1, 0), (0, 1), (2, 3)]
    for first, second in re.findall(r"\(x, y\) -> \(([^,]+), ([^)]+)\)", text + " " + hint):
        f, s = linear_expression(first), linear_expression(second)
        for p in probes:
            mapped = (f[0] * p[0] + f[1] * p[1] + f[2], s[0] * p[0] + s[1] * p[1] + s[2])
            require(mapped == rule(p), "Stated coordinate rule is not the motion")
    require("coordinate rule is" in text, "Explanation must state the rule")
    for name, x, y, image, ix, iy in re.findall(
            r"([A-Z])\((-?\d+), (-?\d+)\) maps to ([A-Z])'\((-?\d+), (-?\d+)\)", text):
        require(name == image and (name, (int(x), int(y))) in vertices, "Maps an unknown vertex")
        require(rule((int(x), int(y))) == (int(ix), int(iy)), "False image of a vertex")
    named = "".join(n for n, _ in vertices)
    if size == 3:
        require(f"triangle {''.join(n + chr(39) for n in named)} is congruent to triangle {named}" in text, "Congruence")
    else:
        require(f"{''.join(n + chr(39) for n in named)} has the same length as {named}" in text, "Length")
    if isinstance(kind, tuple):
        match = re.search(r"[Aa]dd (-?\d+) to its x-coordinate and (-?\d+) to its y-coordinate", hint)
        require(match is not None and (int(match[1]), int(match[2])) == kind[1:], "Translation hint amounts")
    elif kind.startswith("reflected"):
        axis = kind.split()[-1][0]
        require(f"over the {axis}-axis keeps the {axis}-coordinate" in hint, "Reflection hint")
    elif "180" in kind:
        require("half turn" in hint, "Half-turn hint")
    else:
        turn = kind.split()[2]
        require(f"quarter turn {turn}" in hint, "Quarter-turn hint direction")
    first = re.search(r"Start with ([A-Z])\((-?\d+), (-?\d+)\)", hint)
    require(first is not None and (first[1], (int(first[2]), int(first[3]))) == vertices[0], "Hint starts elsewhere")
    walk = walkthrough_points(problem, "accent")
    if walk is not None:
        require([(x, y, (label or "").replace(PRIME, "'")) for x, y, label in walk]
                == [(p[0], p[1], n + "'") for (n, _), p in zip(vertices, images)], "Solved grid shows other images")
        ink = walkthrough_points(problem, "ink")
        require([(x, y, label) for x, y, label in ink] == [(p[0], p[1], n) for n, p in vertices], "Solved grid pre-image")
    return wire(images)


def review_problem(problem):
    template = problem["public"]["templateId"]
    require(template in SUPPORTED, "Wrong family")
    expected = solve(problem["public"])
    if template == "plot-points":
        reviewed = review_plot_points(problem)
    elif template == "graph-linear-equation":
        reviewed = review_line(problem)
        line = tuple(int(v) for v in re.findall(r"-?\d+", expected))
        require(canonical_line(*line) == canonical_line(*(problem["pointGrading"][k] for k in "abc")), "Line")
        return reviewed
    else:
        reviewed = review_transform(problem)
    require(reviewed == expected and problem["answer"] == expected, "Answer disagrees with the prompt")
    return expected


# ---------------------------------------------------------------- self test

def fixture(template, prompt, response, answer, grading, explanation, hint):
    return {
        "public": {"templateId": template, "seed": "fixture", "prompt": prompt, "response": response},
        "answer": answer,
        "pointGrading": grading,
        "explanation": explanation,
        "hint": hint,
    }


def response_for(count, ordered=False, connect="none", label=None, labels=None, given=None):
    r = {"kind": "point-plot", "label": label or f"Plot {count} points", "grid": dict(GRID), "pointCount": count,
         "ordered": ordered, "connect": connect}
    if labels:
        r["pointLabels"] = labels
    if given:
        r["given"] = given
    return r


def handwritten():
    cases = {}
    cases["list"] = fixture(
        "plot-points", "Plot the points $A(3, -2)$, $B(0, 4)$ and $C(-5, 0)$.", response_for(3),
        "[[-5,0],[0,4],[3,-2]]", {"mode": "exact"},
        ["Each pair is (horizontal, vertical).",
         "$A(3, -2)$: from the origin, move 3 units right, then move 2 units down.",
         "$B(0, 4)$: from the origin, move 4 units up.",
         "$C(-5, 0)$: from the origin, move 5 units left."],
        "Start with $A(3, -2)$. The first number, $3$, is the run; the second, $-2$, is the rise.")
    cases["described"] = fixture(
        "plot-points",
        "Plot both points. $P$ is 4 units left of the $y$-axis and 3 units above the $x$-axis. "
        "$Q$ lies on the $x$-axis, 5 units right of the $y$-axis.", response_for(2),
        "[[-4,3],[5,0]]", {"mode": "exact"},
        ["$P$: left makes $x$ negative and above makes $y$ positive, so $P$ is $(-4, 3)$.",
         "$Q$: on the $x$-axis $y$ is 0, so $Q$ is $(5, 0)$."], "Distance from an axis is a coordinate's size.")
    cases["reflection"] = fixture(
        "plot-points",
        "Point $P(3, -2)$ is plotted. Plot its reflection across the $x$-axis and its reflection across the $y$-axis.",
        response_for(2, label="Plot both reflections", given={"vertices": [{"x": 3, "y": -2, "label": "P"}], "closed": False}),
        "[[-3,-2],[3,2]]", {"mode": "exact"},
        ["A reflection across the $x$-axis keeps $x = 3$ and changes the sign of $y$: $(3, -2)$ becomes $(3, 2)$.",
         "A reflection across the $y$-axis keeps $y = -2$ and changes the sign of $x$: $(3, -2)$ becomes $(-3, -2)$."],
        "A reflection across the $x$-axis keeps the horizontal position of $P$, $x = 3$.")
    line_response = response_for(2, connect="line", label="Place 2 points on the line")
    cases["slope-intercept"] = fixture(
        "graph-linear-equation", "Graph $y = -\\frac{2}{3}x + 3$ by placing 2 points on its line.", line_response,
        "[[0,3],[3,1]]", {"mode": "on-line", "a": 2, "b": 3, "c": 9},
        ["The line crosses the $y$-axis at $(0, 3)$, and the slope is $m = -\\frac{2}{3}$.",
         "A slope of $-\\frac{2}{3}$ means a rise of $-2$ for every run of 3. From $(0, 3)$ move 3 units right and 2 units down to $(3, 1)$."],
        "Use the slope $-\\frac{2}{3}$: move 3 units right and 2 units down.")
    cases["standard"] = fixture(
        "graph-linear-equation", "Graph $2x - 5y = -13$ by placing 2 points on its line.", line_response,
        "[[-4,1],[1,3]]", {"mode": "on-line", "a": 2, "b": -5, "c": -13},
        ["Substitute $x = 1$: $2(1) - 5y = -13$, so $-5y = -15$ and $y = 3$. The point $(1, 3)$ is on the line.",
         "Substitute $x = -4$: $2(-4) - 5y = -13$, so $-5y = -5$ and $y = 1$. The point $(-4, 1)$ is on the line.",
         "The slope is $-\\frac{a}{b} = \\frac{2}{5}$: the line rises $2$ over a run of 5."],
        "Choose whole-number values of $x$.")
    cases["point-slope"] = fixture(
        "graph-linear-equation", "Graph $y + 4 = -(x - 2)$ by placing 2 points on its line.", line_response,
        "[[2,-4],[3,-5]]", {"mode": "on-line", "a": 1, "b": 1, "c": -2},
        ["The line passes through $(2, -4)$ with slope $m = -1$.",
         "From $(2, -4)$ move 1 unit right and 1 unit down to $(3, -5)$."], "Use the slope $-1$.")
    cases["point-slope-fraction"] = fixture(
        "graph-linear-equation", "Graph $y - 1 = \\frac{3}{2}(x + 4)$ by placing 2 points on its line.", line_response,
        "[[-4,1],[-2,4]]", {"mode": "on-line", "a": 3, "b": -2, "c": -14},
        ["The line passes through $(-4, 1)$.", "From $(-4, 1)$ move 2 units right and 3 units up to $(-2, 4)$."],
        "Use the slope $\\frac{3}{2}$.")
    cases["horizontal"] = fixture(
        "graph-linear-equation", "Graph $y = -3$ by placing 2 points on its line.", line_response,
        "[[0,-3],[2,-3]]", {"mode": "on-line", "a": 0, "b": 1, "c": -3},
        ["The graph is the horizontal line 3 units below the $x$-axis, through $(0, -3)$ and $(2, -3)$. Its slope is 0."],
        "Every point has $y = -3$.")
    cases["proportional"] = fixture(
        "graph-linear-equation",
        "$y$ is proportional to $x$, and $y = 3$ when $x = 2$. Graph the relationship by placing 2 points on its line.",
        line_response, "[[0,0],[2,3]]", {"mode": "on-line", "a": 3, "b": -2, "c": 0},
        ["The graph passes through the origin $(0, 0)$.", "$k = \\frac{3}{2}$, so the equation is $y = \\frac{3}{2}x$.",
         "From $(0, 0)$ move 2 units right and 3 units up to $(2, 3)$."], "Divide $y$ by $x$.")
    tri = [("A", 1, 2), ("B", 4, 2), ("C", 1, 5)]

    def transform(motion, images, rule, hint, points=tri, shape="Triangle"):
        names = "".join(n for n, _, _ in points)
        listed = english([f"${n}({x}, {y})$" for n, x, y in points])
        noun = "vertices" if shape == "Triangle" else "endpoints"
        prompt = (f"{shape} ${names}$ has {noun} {listed}. It is {motion}. Place "
                  f"{english([f'${n}' + chr(39) + '$' for n in names])}, the images of {english([f'${n}$' for n in names])}.")
        labels = [n + PRIME for n in names]
        response = response_for(len(points), True, "polygon", "Place " + english(labels), labels,
                                {"vertices": [{"x": x, "y": y, "label": n} for n, x, y in points],
                                 "closed": shape == "Triangle"})
        maps = [f"${n}({x}, {y})$ maps to ${n}'({ix}, {iy})$." for (n, x, y), (ix, iy) in zip(points, images)]
        last = (f"so triangle ${names[0]}'{names[1]}'{names[2]}'$ is congruent to triangle ${names}$." if shape == "Triangle"
                else f"so ${names[0]}'{names[1]}'$ has the same length as ${names}$.")
        n0, x0, y0 = points[0]
        return fixture("place-transformed-image", prompt, response, wire(images), {"mode": "exact"},
                       [f"The coordinate rule is ${rule}$.", *maps, "A rigid motion keeps lengths and angles, " + last],
                       hint + f" Start with ${n0}({x0}, {y0})$.")

    cases["rotate-ccw"] = transform("rotated 90° counterclockwise about the origin", [(-2, 1), (-2, 4), (-5, 1)],
                                    "(x, y) \\to (-y, x)", "Use the rule for a quarter turn counterclockwise.")
    cases["rotate-cw"] = transform("rotated 90° clockwise about the origin", [(2, -1), (2, -4), (5, -1)],
                                   "(x, y) \\to (y, -x)", "Use the rule for a quarter turn clockwise.")
    cases["half-turn"] = transform("rotated 180° about the origin", [(-1, -2), (-4, -2), (-1, -5)],
                                   "(x, y) \\to (-x, -y)", "A half turn changes both signs.")
    cases["reflect-x"] = transform("reflected over the $x$-axis", [(1, -2), (4, -2), (1, -5)], "(x, y) \\to (x, -y)",
                                   "A reflection over the $x$-axis keeps the $x$-coordinate.")
    cases["translate"] = transform("translated 4 units left and 1 unit up", [(-3, 3), (0, 3), (-3, 6)],
                                   "(x, y) \\to (x - 4, y + 1)",
                                   "A translation: add $-4$ to its $x$-coordinate and $1$ to its $y$-coordinate.")
    cases["segment"] = transform("translated 2 units down", [(-2, 3), (5, -1)], "(x, y) \\to (x + 0, y - 2)",
                                 "Add $0$ to its $x$-coordinate and $-2$ to its $y$-coordinate.",
                                 points=[("P", -2, 5), ("Q", 5, 1)], shape="Segment")
    cases["segment-reflect-y"] = transform("reflected over the $y$-axis", [(2, 5), (-5, 1)], "(x, y) \\to (-x, y)",
                                           "A reflection over the $y$-axis keeps the $y$-coordinate.",
                                           points=[("P", -2, 5), ("Q", 5, 1)], shape="Segment")
    return cases


def expect_rejected(problem, what):
    try:
        review_problem(problem)
    except (ValueError, KeyError, TypeError):
        return 1
    raise AssertionError(f"Accepted corrupt point-plot case: {what}")


def self_test():
    cases = handwritten()
    for name, case in cases.items():
        review_problem(case)
    require(solve(cases["slope-intercept"]["public"]) == "line:2x+3y=9", "Slope-intercept parse")
    require(line_of_equation("y + 4 = -(x - 2)") == (1, 1, -2), "Point-slope parse")
    require(line_of_equation("y - 1 = (3/2)(x + 4)") == (3, -2, -14), "Fractional point-slope parse")
    require(line_of_equation("-3x - 2y = 11") == (3, 2, -11), "Standard-form parse")
    require(linear_expression("-3(-3) - 2y") == (0, -2, 9), "Implicit products")
    mutations = 0

    def mutate(name, change, what):
        nonlocal mutations
        bad = copy.deepcopy(cases[name])
        change(bad)
        require(bad != cases[name], f"No-op mutation: {what}")
        mutations += expect_rejected(bad, what)

    def setter(*path, value):
        def change(problem):
            target = problem
            for key in path[:-1]:
                target = target[key]
            target[path[-1]] = value
        return change

    mutate("list", setter("answer", value="[[-5,0],[0,4],[3,2]]"), "wrong point")
    mutate("list", setter("answer", value="[[0,4],[-5,0],[3,-2]]"), "unsorted set")
    mutate("list", setter("answer", value="[[-5,0],[0,4],[0,4]]"), "duplicate point")
    mutate("list", setter("answer", value="[[-5,0],[0,4]]"), "missing point")
    mutate("list", setter("answer", value="[[-5, 0],[0,4],[3,-2]]"), "noncanonical spacing")
    mutate("list", setter("public", "response", "pointCount", value=4), "point count")
    mutate("list", setter("public", "response", "grid", "xMax", value=5), "grid")
    mutate("list", setter("public", "prompt", value="Plot the points $A(3, -2)$, $B(3, -2)$ and $C(-5, 0)$."),
           "coincident named points")
    mutate("list", setter("pointGrading", value={"mode": "on-line", "a": 1, "b": 1, "c": 0}), "grading mode")
    mutate("list", setter("explanation", value=["$A(3, -2)$: from the origin, move 3 units left, then move 2 units down.",
                                                 "$B(0, 4)$ and $C(-5, 0)$."]), "false moves")
    mutate("described", setter("answer", value="[[-4,-3],[5,0]]"), "above read as below")
    mutate("described", setter("explanation", value=["So $P$ is $(-4, 3)$."]), "explanation omits a point")
    mutate("reflection", setter("answer", value="[[-3,2],[3,-2]]"), "reflection answered as half turn")
    mutate("reflection", setter("public", "response", "given", "vertices", 0, "y", value=2), "mismatched given")
    mutate("reflection", setter("public", "prompt", value="Point $P(3, 0)$ is plotted. Plot its reflection across the "
                                "$x$-axis and its reflection across the $y$-axis."), "image coincides with point")
    mutate("slope-intercept", setter("answer", value="[[0,3],[3,2]]"), "off-line point")
    mutate("slope-intercept", setter("answer", value="[[0,3],[0,3]]"), "duplicate line point")
    mutate("slope-intercept", setter("answer", value="[[0,3]]"), "one point")
    mutate("slope-intercept", setter("answer", value="[[-3,5],[9,-3]]"), "out-of-grid line point")
    mutate("slope-intercept", setter("pointGrading", value={"mode": "on-line", "a": 2, "b": 3, "c": 6}), "parallel line")
    mutate("slope-intercept", setter("pointGrading", value={"mode": "on-line", "a": 4, "b": 6, "c": 18}), "not lowest terms")
    mutate("slope-intercept", setter("pointGrading", value={"mode": "exact"}), "exact line grading")
    mutate("slope-intercept", setter("public", "response", "connect", value="none"), "connect")
    mutate("slope-intercept", setter("explanation", 1, value="A slope of $-\\frac{3}{2}$ means a rise of $-3$ for every "
                                     "run of 2. From $(0, 3)$ move 3 units right and 2 units down to $(3, 1)$."), "false slope")
    mutate("standard", setter("explanation", 0, value="Substitute $x = 1$: $2(1) - 5y = -13$, so $-5y = -15$ and $y = 2$. "
                              "The point $(1, 3)$ is on the line."), "false substitution")
    mutate("standard", setter("pointGrading", "c", value=13), "wrong constant")
    mutate("point-slope", setter("public", "prompt", value="Graph $y + 4 = (x - 2)$ by placing 2 points on its line."),
           "sign of slope")
    mutate("point-slope-fraction", setter("explanation", 1, value="It also passes through $(-2, 4)$. From $(-4, 1)$ move "
                                          "2 units right and 3 units up to $(-2, 3)$."), "moves miss the point")
    mutate("horizontal", setter("explanation", 0, value="The graph is the horizontal line 3 units above the $x$-axis, "
                                "through $(0, -3)$ and $(2, -3)$."), "wrong level")
    steep = copy.deepcopy(cases["slope-intercept"])
    steep["public"]["prompt"] = "Graph $y = 5x + 3$ by placing 2 points on its line."
    steep["answer"] = "[[-1,-2],[0,3]]"
    steep["pointGrading"] = {"mode": "on-line", "a": 5, "b": -1, "c": -3}
    steep["explanation"] = ["From $(-1, -2)$ move 1 unit right and 5 units up to $(0, 3)$."]
    steep["hint"] = "Use the slope $5$."
    mutations += expect_rejected(steep, "only two placeable lattice points")
    mutate("proportional", setter("public", "prompt", value="$y$ is proportional to $x$, and $y = 3$ when $x = 0$. "
                                  "Graph the relationship by placing 2 points on its line."), "x = 0")
    mutate("proportional", setter("answer", value="[[0,1],[2,4]]"), "misses origin line")
    mutate("proportional", setter("explanation", 1, value="$k = \\frac{2}{3}$, so the equation is $y = \\frac{3}{2}x$."),
           "false constant of proportionality")
    mutate("proportional", setter("explanation", 1, value="$k = \\frac{3}{2}$, so the equation is $y = \\frac{2}{3}x$."),
           "false rewritten equation")
    mutate("rotate-ccw", setter("answer", value="[[-2,4],[-2,1],[-5,1]]"), "swapped ordered slots")
    mutate("rotate-ccw", setter("answer", value=wire([(2, -1), (2, -4), (5, -1)])), "clockwise for counterclockwise")
    mutate("rotate-ccw", setter("public", "response", "given", "vertices", 1, "x", value=3), "mismatched given vertex")
    mutate("rotate-ccw", setter("public", "response", "pointLabels", value=["B′", "A′", "C′"]), "label order")
    mutate("rotate-ccw", setter("public", "response", "ordered", value=False), "unordered images")
    mutate("rotate-ccw", setter("explanation", 0, value="The coordinate rule is $(x, y) \\to (y, -x)$."), "false rule")
    mutate("rotate-ccw", lambda bad: bad["explanation"].append("$A(1, 2)$ maps to $A'(2, 1)$."), "false vertex image")
    mutate("rotate-cw", setter("hint", value="Use the rule for a quarter turn counterclockwise. Start with $A(1, 2)$."),
           "hint direction")
    mutate("half-turn", setter("answer", value="[[-1,-2],[-4,-2],[-1,-2]]"), "duplicate image")
    mutate("reflect-x", setter("answer", value=wire([(-1, 2), (-4, 2), (-1, 5)])), "wrong mirror")
    mutate("translate", setter("public", "prompt", value=cases["translate"]["public"]["prompt"].replace(
        "4 units left", "4 units right")), "translation direction")
    mutate("translate", setter("public", "prompt", value=cases["translate"]["public"]["prompt"].replace(
        "1 unit up", "1 units up")), "unit grammar")
    mutate("translate", setter("hint", value="Add $-4$ to its $x$-coordinate and $-1$ to its $y$-coordinate. "
                               "Start with $A(1, 2)$."), "hint amounts")
    mutate("segment", setter("public", "response", "given", "closed", value=True), "closed segment")
    mutate("segment", setter("public", "response", "connect", value="line"), "segment connect")
    out = copy.deepcopy(cases["segment"])
    out["public"]["prompt"] = out["public"]["prompt"].replace("2 units down", "6 units up")
    out["answer"] = "[[-2,11],[5,7]]"
    out["explanation"][0:3] = ["The coordinate rule is $(x, y) \\to (x + 0, y + 6)$.", "$P(-2, 5)$ maps to $P'(-2, 11)$.",
                               "$Q(5, 1)$ maps to $Q'(5, 7)$."]
    out["hint"] = "Add $0$ to its $x$-coordinate and $6$ to its $y$-coordinate. Start with $P(-2, 5)$."
    mutations += expect_rejected(out, "image outside the grid")
    flat = copy.deepcopy(cases["rotate-ccw"])
    flat["public"]["prompt"] = flat["public"]["prompt"].replace("C(1, 5)", "C(7, 2)")
    mutations += expect_rejected(flat, "collinear triangle")
    return {"handwritten_cases": len(cases), "mutations": mutations}


if __name__ == "__main__":
    print(self_test())
