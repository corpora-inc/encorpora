"""Independent review of the figure-choice families from their public wording.

The correct figure is decided from the prompt alone: an equation, a slope and
intercept, a table, a constant rate or an inequality is parsed exactly with
Fractions into the graph or solution set it names, and every option's SCENE
(never its description) is read back into the same exact form. Exactly one
option may match. Each description is then checked against its own scene, so a
screen-reader user is told the truth about every card. The private answer,
explanation, hint and feedback are only values under test.
"""

import copy
import json
import re
from fractions import Fraction as F

SUPPORTED = frozenset({
    "graph-of-linear-rule",
    "graph-of-proportional-rate",
    "graph-of-inequality-number-line",
    "graph-of-quadratic-or-exponential",
})
IDS = ("option-a", "option-b", "option-c", "option-d")
LETTERS = "ABCD"
NOUNS = {
    "graph-of-linear-rule": "Graph",
    "graph-of-proportional-rate": "Graph",
    "graph-of-inequality-number-line": "Number line",
    "graph-of-quadratic-or-exponential": "Graph",
}
MINUS = "\u2212"
REVEALING = re.compile(r"\b(correct|incorrect|answer|wrong|right answer|true|false|solutions?|distractor|mistake|error)\b", re.I)
NAMES = re.compile(r"\b(Graph|Number line) ([A-D])\b")
PLACEHOLDER = re.compile(r"\$\{|\bundefined\b|\bNaN\b|\bnull\b|\[object")


def require(condition, message):
    if not condition:
        raise ValueError(message)


# ---------------------------------------------------------------- numbers

def scene_number(value):
    """A scene coordinate as an exact rational: the simplest fraction whose
    double is exactly the stored number (1/3 is stored as 0.333...)."""
    require(isinstance(value, (int, float)) and not isinstance(value, bool), f"Not a number: {value!r}")
    if isinstance(value, int):
        return F(value)
    exact = F(value).limit_denominator(10000)
    require(float(exact) == value, f"Coordinate {value!r} is not a simple rational")
    return exact


def clip_number(value):
    """The far end of an arrowed segment is only where the drawing leaves the
    window; it may be printed to 6 decimals (4/3 as 1.333333). Read it as the
    one fraction with denominator <= 1000 within that rounding (two such
    fractions are always more than 1e-6 apart, so the reading is unique)."""
    require(isinstance(value, (int, float)) and not isinstance(value, bool), f"Not a number: {value!r}")
    exact = F(value).limit_denominator(1000)
    require(abs(exact - F(value)) <= F(1, 2 * 10 ** 6), f"Clip coordinate {value!r} is not a rounded simple rational")
    return exact


def text_number(token):
    """A number as printed in a description or table: 3, −3, 5/2, −2.5."""
    text = token.strip().replace(MINUS, "-")
    match = re.fullmatch(r"(-?)(\d+(?:\.\d+)?)(?:/(\d+))?", text)
    require(match is not None, f"Unreadable number: {token!r}")
    value = F(match.group(2)) / (F(match.group(3)) if match.group(3) else 1)
    return -value if match.group(1) else value


def point_pattern():
    n = r"[\u2212-]?\d+(?:\.\d+)?(?:/\d+)?"
    return rf"\(({n}), ({n})\)"


POINT = point_pattern()


def read_point(x, y):
    return (text_number(x), text_number(y))


# ---------------------------------------------------------------- expressions
# A polynomial in x and y is a dict {(power of x, power of y): Fraction}.

def normalized(tex):
    text = tex.replace("$", "").replace(MINUS, "-")
    text = text.replace("\\left(", "(").replace("\\right)", ")").replace("\\cdot", "*")
    text = re.sub(r"\\[dt]?frac\{([^{}]+)\}\{([^{}]+)\}", r"((\1)/(\2))", text)
    require("\\" not in text and "{" not in text, f"Unread TeX in {tex!r}")
    return text.replace(" ", "")


def p_clean(p):
    return {k: v for k, v in p.items() if v != 0}


def p_const(c):
    return p_clean({(0, 0): F(c)})


def p_add(p, q, sign=1):
    out = dict(p)
    for k, v in q.items():
        out[k] = out.get(k, F(0)) + sign * v
    return p_clean(out)


def p_mul(p, q):
    out = {}
    for (i, j), u in p.items():
        for (k, l), v in q.items():
            out[(i + k, j + l)] = out.get((i + k, j + l), F(0)) + u * v
    return p_clean(out)


def p_pow(p, n):
    out = p_const(1)
    for _ in range(n):
        out = p_mul(out, p)
    return out


def constant_of(p):
    require(all(k == (0, 0) for k in p), "Expected a constant")
    return p.get((0, 0), F(0))


def compose(f, arg):
    """f(arg) for a polynomial f in x alone."""
    require(all(j == 0 for (_, j) in f), "f must be a function of x")
    out = {}
    for (i, _), c in f.items():
        out = p_add(out, p_mul(p_const(c), p_pow(arg, i)))
    return out


def parse(text, f=None):
    tokens = re.findall(r"\d+(?:\.\d+)?|[xyf]|[-+*/^()]|\S", text)
    require(all(re.fullmatch(r"\d+(?:\.\d+)?|[xyf]|[-+*/^()]", t) for t in tokens), f"Unreadable expression {text!r}")
    at = [0]

    def peek():
        return tokens[at[0]] if at[0] < len(tokens) else None

    def take(expected=None):
        token = peek()
        require(token is not None, f"Truncated expression {text!r}")
        require(expected is None or token == expected, f"Expected {expected} in {text!r}")
        at[0] += 1
        return token

    def atom():
        token = take()
        if token == "(":
            value = expression()
            take(")")
            return value
        if token == "x":
            return {(1, 0): F(1)}
        if token == "y":
            return {(0, 1): F(1)}
        if token == "f":
            require(f is not None, "f is not defined")
            take("(")
            arg = expression()
            take(")")
            return compose(f, arg)
        require(re.fullmatch(r"\d+(?:\.\d+)?", token) is not None, f"Unexpected {token!r} in {text!r}")
        return p_const(F(token))

    def power():
        base = atom()
        if peek() == "^":
            take()
            exponent = take()
            require(exponent.isdigit(), f"Only whole-number powers: {text!r}")
            return p_pow(base, int(exponent))
        return base

    def term():
        value = power()
        while peek() is not None and peek() not in "+-)":
            if peek() == "/":
                take()
                divisor = constant_of(power())
                require(divisor != 0, "Division by zero")
                value = p_mul(value, p_const(1 / divisor))
            else:
                if peek() == "*":
                    take()
                value = p_mul(value, power())
        return value

    def expression():
        sign = 1
        if peek() in ("+", "-"):
            sign = 1 if take() == "+" else -1
        value = p_mul(p_const(sign), term())
        while peek() in ("+", "-"):
            sign = 1 if take() == "+" else -1
            value = p_add(value, term(), sign)
        return value

    result = expression()
    require(at[0] == len(tokens), f"Trailing input in {text!r}")
    return result


def coefficients(p):
    """Ascending coefficients of a polynomial in x alone, trailing zeros trimmed."""
    require(all(j == 0 for (_, j) in p), "Expected a function of x")
    degree = max((i for (i, _) in p), default=0)
    out = [p.get((i, 0), F(0)) for i in range(degree + 1)]
    while len(out) > 1 and out[-1] == 0:
        out.pop()
    return tuple(out)


def solve_for_y(equation, f=None):
    """y as a polynomial in x from an equation linear in y."""
    sides = equation.split("=")
    require(len(sides) == 2, f"Not one equation: {equation!r}")
    p = p_add(parse(sides[0], f), parse(sides[1], f), -1)
    require(all(j <= 1 for (_, j) in p) and all(i == 0 for (i, j) in p if j == 1), "Not solvable for y")
    cy = p.get((0, 1), F(0))
    require(cy != 0, "Equation has no y")
    rest = {k: v for k, v in p.items() if k[1] == 0}
    return poly(coefficients(p_mul(rest, p_const(-1 / cy))))


# ---------------------------------------------------------------- figures
# A figure is a hashable exact object:
#   ("poly", c0, c1, ...)   any graph y = polynomial (a non-vertical line is degree <= 1)
#   ("vertical", x)
#   ("half-line", line, start, +1|-1) a graph segment drawn with an arrow: the
#                                    half-line from start, x increasing (+1) or
#                                    decreasing (-1); y for a vertical line
#   ("segment", line, end, end)      a graph segment without an arrow, ends sorted
#   ("exp", A, B, k)         y = A * B^x + k
#   ("ray", boundary, "left"|"right", inclusive) / ("interval", ...) / ("all",)

def poly(c):
    c = list(c)
    while len(c) > 1 and c[-1] == 0:
        c.pop()
    return ("poly",) + tuple(F(v) for v in c)


def exp_figure(a, b, h=F(0), k=F(0)):
    require(a != 0 and b > 0 and b != 1, "Degenerate exponential")
    require(h.denominator == 1, "Exponential with a fractional horizontal shift")
    return ("exp", a * b ** int(-h), b, k)


def through(p, q):
    """The line through two exact points."""
    (x1, y1), (x2, y2) = p, q
    require(p != q, "A line through one repeated point")
    if x1 == x2:
        return ("vertical", x1)
    m = (y2 - y1) / (x2 - x1)
    return poly([y1 - m * x1, m])


def line_figure(spec):
    if "through" in spec:
        return through(*[tuple(scene_number(v) for v in p) for p in spec["through"]])
    if "m" in spec:
        return poly([scene_number(spec["b"]), scene_number(spec["m"])])
    if "x" in spec:
        return ("vertical", scene_number(spec["x"]))
    a, b, c = (scene_number(spec[k]) for k in "abc")
    require(a != 0 or b != 0, "Degenerate line")
    return ("vertical", c / a) if b == 0 else poly([c / b, -a / b])




def segment_figure(segment):
    start = tuple(scene_number(v) for v in segment["from"])
    end = tuple((clip_number if segment.get("arrow") else scene_number)(v) for v in segment["to"])
    line = through(start, end)
    if segment.get("arrow"):
        axis = 1 if line[0] == "vertical" else 0
        return ("half-line", line, start, 1 if end[axis] > start[axis] else -1)
    return ("segment", line) + tuple(sorted((start, end)))


def support(figure):
    """The whole line a ray or segment lies on; any other figure itself."""
    return figure[1] if figure[0] in ("half-line", "segment") else figure


def fn_figure(fn):
    if fn["f"] == "poly":
        return poly([scene_number(v) for v in fn["c"]])
    require(fn["f"] == "exp", f"Unsupported curve {fn['f']}")
    return exp_figure(scene_number(fn["a"]), scene_number(fn["b"]),
                      scene_number(fn.get("h", 0)), scene_number(fn.get("k", 0)))


def interval_figure(iv):
    lo, hi = iv["from"], iv["to"]
    lo_open, hi_open = iv.get("open", [False, False])
    if lo is None and hi is None:
        return ("all",)
    if lo is None:
        return ("ray", scene_number(hi), "left", not hi_open)
    if hi is None:
        return ("ray", scene_number(lo), "right", not lo_open)
    lo, hi = scene_number(lo), scene_number(hi)
    require(lo < hi, "Empty interval")
    return ("interval", lo, not lo_open, hi, not hi_open)


def drawn(element):
    """Every exact figure an element draws."""
    if element["type"] == "graph":
        return [line_figure(l["line"]) for l in element.get("lines", [])] + \
               [segment_figure(g) for g in element.get("segments", [])] + \
               [fn_figure(c["fn"]) for c in element.get("curves", [])]
    if element["type"] == "numberLine":
        return [interval_figure(iv) for iv in element.get("intervals", [])]
    return []


def option_element(option):
    elements = option["scene"]["elements"]
    require(len(elements) == 1, f"{option['id']} must draw one figure")
    return elements[0]


def option_figure(option):
    figures = drawn(option_element(option))
    require(len(figures) == 1, f"{option['id']} must draw exactly one line, curve or interval")
    return figures[0]


def value_at(figure, x):
    if figure[0] == "poly":
        return sum(c * x ** i for i, c in enumerate(figure[1:]))
    if figure[0] == "exp":
        require(x.denominator == 1, "Exponential evaluated at a fractional x")
        return figure[1] * figure[2] ** int(x) + figure[3]
    raise ValueError(f"No value for {figure[0]}")


def on_figure(figure, point):
    if figure[0] == "half-line":
        _, line, start, sense = figure
        axis = 1 if line[0] == "vertical" else 0
        return on_figure(line, point) and (point[axis] - start[axis]) * sense >= 0
    if figure[0] == "segment":
        _, line, p, q = figure
        return on_figure(line, point) and min(p, q) <= point <= max(p, q)
    if figure[0] == "vertical":
        return point[0] == figure[1]
    return value_at(figure, point[0]) == point[1]


# ---------------------------------------------------------------- prompts

def target_linear_rule(public):
    prompt = public["prompt"]
    match = re.fullmatch(r"Which graph shows \$([^$]+)\$\?", prompt)
    if match:
        require(public.get("figure") is None, "Equation prompt with a figure")
        return solve_for_y(normalized(match.group(1)))
    match = re.fullmatch(r"Which graph shows the line with slope (\$[^$]+\$|\S+) and \$y\$-intercept (\$[^$]+\$|\S+)\?", prompt)
    if match:
        m = constant_of(parse(normalized(match.group(1))))
        b = constant_of(parse(normalized(match.group(2))))
        return poly([b, m])
    require(prompt == "The table shows a linear relationship between $x$ and $y$. Which graph shows it?",
            f"Unrecognized prompt {prompt!r}")
    elements = public["figure"]["scene"]["elements"]
    require(len(elements) == 1 and elements[0]["type"] == "lineTable", "Table prompt without a table")
    rows = elements[0]["rows"]
    require(len(rows) == 2 and rows[0][0] == "x" and rows[1][0] == "y", "Table must list x then y")
    xs = [constant_of(parse(normalized(v))) for v in rows[0][1:]]
    ys = [constant_of(parse(normalized(v))) for v in rows[1][1:]]
    require(len(xs) >= 2 and len(set(xs)) == len(xs), "Table needs distinct x values")
    m = (ys[1] - ys[0]) / (xs[1] - xs[0])
    b = ys[0] - m * xs[0]
    require(all(y == m * x + b for x, y in zip(xs, ys)), "Table is not linear")
    return poly([b, m])


RATE = re.compile(
    r"(An? [a-z]+) ([a-z]+) (\d+) ([a-z]+) (?:every (\d+) ([a-z]+) at a constant rate|per ([a-z]+))\. "
    r"Which graph shows the number of ([a-z]+), \$y\$, after \$x\$ ([a-z]+)\?")


def read_rate(prompt):
    match = RATE.fullmatch(prompt)
    require(match is not None, f"Unrecognized prompt {prompt!r}")
    amount, units = int(match.group(3)), match.group(4)
    require(match.group(8) == units, "Question counts other units")
    time = match.group(9)
    if match.group(5):
        per = int(match.group(5))
        require(per >= 2 and match.group(6) == time, "Rate period")
    else:
        per = 1
        require(match.group(7) + "s" == time, "Rate unit")
    require(amount > 0 and units.endswith("s"), "Rate amount")
    return F(amount, per), units, time


def target_rate(public):
    rate, _, _ = read_rate(public["prompt"])
    return ("half-line", poly([0, rate]), (F(0), F(0)), 1)


INEQUALITY = re.compile(r"Which number line shows the solutions of \$([^$]+?) *(<|>|\\leq|\\geq|\\le|\\ge) *([^$]+)\$\?")


def read_inequality(prompt):
    match = INEQUALITY.fullmatch(prompt)
    require(match is not None, f"Unrecognized prompt {prompt!r}")
    p = p_add(parse(normalized(match.group(1))), parse(normalized(match.group(3))), -1)
    require(set(p) <= {(1, 0), (0, 0)}, "Not linear in x")
    a, c = p.get((1, 0), F(0)), p.get((0, 0), F(0))
    require(a != 0, "No x term")
    op = match.group(2).replace("q", "")
    boundary = -c / a
    greater = op in (">", "\\ge")
    if a < 0:
        greater = not greater
    return boundary, greater, op in ("\\le", "\\ge")


def target_inequality(public):
    boundary, greater, inclusive = read_inequality(public["prompt"])
    return ("ray", boundary, "right" if greater else "left", inclusive)


def target_quadratic_or_exponential(public):
    prompt = public["prompt"]
    match = re.fullmatch(r"The graph of \$y = f\(x\)\$, with \$f\(x\) = ([^$]+)\$, is shown\. "
                         r"Which graph shows \$([^$]+)\$\?", prompt)
    if match:
        f = parse(normalized(match.group(1)))
        require(not any(j for (_, j) in f), "f must be a function of x")
        elements = public["figure"]["scene"]["elements"]
        require(len(elements) == 1 and drawn(elements[0]) == [poly(coefficients(f))],
                "The shown graph is not y = f(x)")
        return solve_for_y(normalized(match.group(2)), f)
    match = re.fullmatch(r"Which graph shows \$y = ([^$]+)\$\?", prompt)
    require(match is not None, f"Unrecognized prompt {prompt!r}")
    require(public.get("figure") is None, "Equation prompt with a figure")
    rhs = normalized(match.group(1))
    if "^x" in rhs:
        exp = re.fullmatch(r"(?:(.+)\*)?(\d+|\(.+\))\^x", rhs)
        require(exp is not None, f"Unreadable exponential {rhs!r}")
        a = constant_of(parse(exp.group(1))) if exp.group(1) else F(1)
        return exp_figure(a, constant_of(parse(exp.group(2))))
    return solve_for_y("y=" + rhs)


TARGETS = {
    "graph-of-linear-rule": target_linear_rule,
    "graph-of-proportional-rate": target_rate,
    "graph-of-inequality-number-line": target_inequality,
    "graph-of-quadratic-or-exponential": target_quadratic_or_exponential,
}


def solve(public):
    template = public["templateId"]
    require(template in SUPPORTED, "Wrong family")
    response = public["response"]
    require(response["kind"] == "figure-choice" and response["noun"] == NOUNS[template], "Response kind or noun")
    options = response["options"]
    require(2 <= len(options) <= 4 and [o["id"] for o in options] == list(IDS[:len(options)]), "Option ids out of order")
    target = TARGETS[template](public)
    matches = [o["id"] for o in options if option_figure(o) == target]
    require(len(matches) == 1, f"Expected one figure of {target}, found {matches}")
    return matches[0]


# ---------------------------------------------------------------- descriptions

def window(element):
    return [scene_number(v) for v in element["x"]] + [scene_number(v) for v in element["y"]]


def in_window(element, point):
    x0, x1, y0, y1 = window(element)
    return x0 <= point[0] <= x1 and y0 <= point[1] <= y1


def drawn_points(element):
    return sorted((scene_number(p["x"]), scene_number(p["y"])) for p in element.get("points", []))


def slope_word(figure):
    require(figure[0] == "poly" and len(figure) == 3 and figure[2] != 0, "Rising or falling needs a slanted line")
    return "rising" if figure[2] > 0 else "falling"


def entry_point(element, figure):
    """The leftmost point of a line inside the graph window."""
    require(figure[0] == "poly" and len(figure) <= 3, "Starting point of a non-line")
    x0, x1, y0, y1 = window(element)
    b, m = figure[1], (figure[2] if len(figure) == 3 else F(0))
    lo = x0
    if m != 0:
        lo = max(lo, min((y0 - b) / m, (y1 - b) / m))
    require(lo <= x1 and y0 <= value_at(figure, lo) <= y1, "Line misses the window")
    return (lo, value_at(figure, lo))


def review_graph_label(template, option):
    element, figure, label = option_element(option), option_figure(option), option["label"]
    require(element["type"] == "graph", "Graph option must draw a graph")
    named = None
    if template == "graph-of-proportional-rate":
        match = re.fullmatch(rf"A line starting at {POINT} and passing through {POINT}\.", label)
        require(match is not None, f"Unrecognized description {label!r}")
        start, through = read_point(*match.group(1, 2)), read_point(*match.group(3, 4))
        if figure[0] == "half-line":
            require(figure[1][0] == "poly" and figure[3] == 1, f"{label!r}: not a ray to the right")
            require(figure[2] == start, f"{label!r}: the ray does not start there")
        else:
            require(figure[0] == "poly" and len(figure) <= 3, "Described as a line")
            require(entry_point(element, figure) == start, f"{label!r}: the line does not start there")
        require(on_figure(figure, through) and through[0] > start[0], f"{label!r}: misses its point")
        named = [start, through]
    else:
        lines = r"A line" if template == "graph-of-linear-rule" else r"A straight line"
        match = re.fullmatch(rf"{lines} through {POINT} and {POINT}, (rising|falling) from left to right\.", label)
        if match:
            require(figure[0] == "poly" and len(figure) <= 3, f"{label!r} describes a curve as a line")
            require(slope_word(figure) == match.group(5), f"{label!r}: wrong direction")
            named = [read_point(*match.group(1, 2)), read_point(*match.group(3, 4))]
        elif template == "graph-of-quadratic-or-exponential":
            parabola = re.fullmatch(rf"A parabola opening (up|down) with its vertex at {POINT}\.", label)
            curve = re.fullmatch(rf"A curve through {POINT} and {POINT}, (rising|falling) from left to right and "
                                 r"leveling off toward the x-axis on the (left|right)\.", label)
            if parabola:
                require(figure[0] == "poly" and len(figure) == 4, f"{label!r}: not a parabola")
                c, b, a = figure[1:]
                require(parabola.group(1) == ("up" if a > 0 else "down"), f"{label!r}: wrong opening")
                vx = -b / (2 * a)
                named = [read_point(*parabola.group(2, 3))]
                require(named[0] == (vx, value_at(figure, vx)), f"{label!r}: wrong vertex")
            else:
                require(curve is not None, f"Unrecognized description {label!r}")
                require(figure[0] == "exp", f"{label!r}: not an exponential curve")
                _, a, b, k = figure
                require(k == 0, f"{label!r}: the asymptote is not the x-axis")
                require(curve.group(5) == ("rising" if (a > 0) == (b > 1) else "falling"), f"{label!r}: wrong direction")
                require(curve.group(6) == ("left" if b > 1 else "right"), f"{label!r}: levels off on the other side")
                named = [read_point(*curve.group(1, 2)), read_point(*curve.group(3, 4))]
        else:
            raise ValueError(f"Unrecognized description {label!r}")
    require(len(set(named)) == len(named), f"{label!r}: repeated point")
    for point in named:
        require(on_figure(figure, point), f"{label!r}: {point} is not on the figure")
        require(in_window(element, point), f"{label!r}: {point} is outside the window")
    require(drawn_points(element) == sorted(named), f"{label!r}: drawn points differ from the named points")


def review_number_line_label(option):
    element, figure, label = option_element(option), option_figure(option), option["label"]
    require(element["type"] == "numberLine", "Number line option must draw a number line")
    match = re.fullmatch(r"(A closed|An open) circle at ([\u2212-]?\d+(?:\.\d+)?(?:/\d+)?) with the ray shaded to the (left|right)\.", label)
    require(match is not None, f"Unrecognized description {label!r}")
    require(figure[0] == "ray", f"{label!r}: not a ray")
    _, boundary, direction, inclusive = figure
    require(text_number(match.group(2)) == boundary, f"{label!r}: wrong boundary")
    require(match.group(3) == direction, f"{label!r}: ray points the other way")
    require((match.group(1) == "A closed") == inclusive, f"{label!r}: open/closed circle")
    require(scene_number(element["min"]) < boundary < scene_number(element["max"]), f"{label!r}: boundary off the line")
    require(not element.get("marks") and not element.get("hops"), "Number line draws extra marks")


def frame(option):
    """The option's scene with its line, curve, points or interval removed."""
    scene = copy.deepcopy(option["scene"])
    for element in scene["elements"]:
        for key in ("lines", "segments", "curves", "points", "intervals"):
            element.pop(key, None)
    return json.dumps(scene, sort_keys=True)


def texts(problem):
    public = problem["public"]
    yield public["prompt"]
    yield public["response"]["label"]
    for option in public["response"]["options"]:
        yield option["label"]
    yield from problem["explanation"]
    yield problem["hint"]
    yield from problem["choiceFeedback"].values()
    walkthrough = problem.get("walkthrough") or {}
    if walkthrough.get("title"):
        yield walkthrough["title"]


def review_problem(problem):
    public = problem["public"]
    template = public["templateId"]
    require(template in SUPPORTED, "Wrong family")
    expected = solve(public)
    require(problem["answer"] == expected, f"Answer {problem['answer']} disagrees with the prompt ({expected})")
    response = public["response"]
    options, noun = response["options"], response["noun"]
    name = {o["id"]: f"{noun} {LETTERS[i]}" for i, o in enumerate(options)}
    target = option_figure(options[[o["id"] for o in options].index(expected)])

    figures = [option_figure(o) for o in options]
    require(len(set(figures)) == len(figures), "Two options draw the same figure")
    require(len({o["label"] for o in options}) == len(options), "Two options share a description")
    require(len({frame(o) for o in options}) == 1, "Options differ in window or styling")
    for option in options:
        require(not REVEALING.search(option["label"]), f"Description judges the option: {option['label']!r}")
        if template == "graph-of-inequality-number-line":
            review_number_line_label(option)
        else:
            review_graph_label(template, option)
    if template == "graph-of-proportional-rate":
        _, units, time = read_rate(public["prompt"])
        for option in options:
            names = option_element(option).get("axisNames")
            require(names == [time.capitalize(), units.capitalize()], f"Axis names {names}")
            require(window(option_element(option))[0] == 0 == window(option_element(option))[2], "Not a first-quadrant window")

    public_text = json.dumps(public, ensure_ascii=False)
    for option_id in IDS:
        require(option_id not in public_text.replace(f'"id": "{option_id}"', "").replace(f'"id":"{option_id}"', ""),
                f"Public text names {option_id}")
    require(not NAMES.search(public["prompt"]) and not any(NAMES.search(o["label"]) for o in options),
            "Public text names an option")
    for text in texts(problem):
        require(not PLACEHOLDER.search(text), f"Unrendered placeholder in {text!r}")

    feedback = problem["choiceFeedback"]
    require(set(feedback) == {o["id"] for o in options} - {expected}, "Feedback must cover exactly the other options")
    for option_id, text in feedback.items():
        require(re.match(rf"{re.escape(name[option_id])}\b", text) is not None,
                f"Feedback for {option_id} must open with {name[option_id]}: {text!r}")
    require(not NAMES.search(problem["hint"]) and expected not in problem["hint"], "Hint names an option")

    last = problem["explanation"][-1]
    mentioned = {f"{a} {b}" for a, b in NAMES.findall(last)}
    require(mentioned == {name[expected]}, f"Last step must name {name[expected]} only: {last!r}")
    if template == "graph-of-inequality-number-line":
        stated = re.findall(r"\$x (<|>|\\le|\\ge) ([^$]+)\$", last)
        require(stated, f"Last step states no solution set: {last!r}")
        for op, value in stated:
            claim = ("ray", constant_of(parse(normalized(value))), "right" if op in (">", "\\ge") else "left",
                     op in ("\\le", "\\ge"))
            require(claim == target, f"Last step states another set: {last!r}")
    else:
        for x, y in re.findall(POINT, last):
            require(on_figure(target, read_point(x, y)), f"Last step names a point off the graph: {last!r}")

    walkthrough = problem.get("walkthrough")
    if walkthrough:
        shown = [support(fig) for element in walkthrough["elements"] for fig in drawn(element)]
        require(support(target) in shown, "Walkthrough does not draw the answer")
    return expected


# ---------------------------------------------------------------- self test

def graph_option(option_id, label, figure, points, x=(-6, 6), y=(-6, 6), names=("x", "y")):
    element = {"type": "graph", "x": list(x), "y": list(y), "grid": 1, "tick": 2, "aspect": 1,
               "axisNames": list(names), "points": [{"x": p[0], "y": p[1], "color": "accent"} for p in points]}
    if figure[0] == "half-line":
        element["segments"] = [{"from": list(figure[1]), "to": list(figure[2]), "arrow": True, "color": "accent"}]
    elif figure[0] == "through":
        element["lines"] = [{"line": {"through": [list(figure[1]), list(figure[2])]}, "color": "accent"}]
    else:
        element["curves"] = [{"fn": figure[1], "color": "accent"}]
    return {"id": option_id, "label": label, "scene": {"v": 1, "width": 240, "maxHeight": 240, "elements": [element]}}


def ray_option(option_id, label, start, end, open_flags):
    element = {"type": "numberLine", "min": -6, "max": 6, "step": 1,
               "intervals": [{"from": start, "to": end, "open": list(open_flags)}]}
    return {"id": option_id, "label": label, "scene": {"v": 1, "width": 260, "maxHeight": 110, "elements": [element]}}


def fixture(template, prompt, noun, options, answer, explanation, hint, feedback, figure=None):
    public = {"templateId": template, "seed": "fixture", "prompt": prompt,
              "response": {"kind": "figure-choice", "label": f"Choose the {noun.lower()}", "noun": noun,
                           "options": options}}
    if figure is not None:
        public["figure"] = figure
    return {"public": public, "answer": answer, "explanation": explanation, "hint": hint, "choiceFeedback": feedback}


def handwritten():
    linear_options = [
        graph_option("option-a", "A line through (0, 1) and (1, 3), rising from left to right.", ("through", (0, 1), (1, 3)), [(0, 1), (1, 3)]),
        graph_option("option-b", "A line through (0, 1) and (1, \u22121), falling from left to right.", ("through", (0, 1), (1, -1)), [(0, 1), (1, -1)]),
        graph_option("option-c", "A line through (0, 2) and (1, 3), rising from left to right.", ("through", (0, 2), (1, 3)), [(0, 2), (1, 3)]),
        graph_option("option-d", "A line through (\u22121, 0) and (0, 2), rising from left to right.", ("through", (-1, 0), (0, 2)), [(-1, 0), (0, 2)]),
    ]
    linear_feedback = {
        "option-b": "Graph B has slope \u22122: the sign is flipped.",
        "option-c": "Graph C swaps the slope and the intercept.",
        "option-d": "Graph D crosses the y-axis at 2.",
    }
    linear_explanation = ["The slope is 2 and the y-intercept is 1.", "Graph A is the line through (0, 1) and (1, 3)."]
    cases = {
        "slope-intercept": fixture("graph-of-linear-rule", "Which graph shows $y = 2x + 1$?", "Graph", linear_options,
                                   "option-a", linear_explanation, "Start at the y-intercept.", linear_feedback),
        "standard": fixture("graph-of-linear-rule", "Which graph shows $-2x + y = 1$?", "Graph", linear_options,
                            "option-a", linear_explanation, "Solve for y.", linear_feedback),
        "words": fixture("graph-of-linear-rule", "Which graph shows the line with slope 2 and $y$-intercept 1?", "Graph",
                         linear_options, "option-a", linear_explanation, "Start at the y-intercept.", linear_feedback),
        "table": fixture("graph-of-linear-rule", "The table shows a linear relationship between $x$ and $y$. Which graph shows it?",
                         "Graph", linear_options, "option-a", linear_explanation, "Find the change in y.", linear_feedback,
                         {"kind": "scene", "scene": {"v": 1, "elements": [{"type": "lineTable", "header": "column",
                          "rows": [["x", "\u22121", "0", "2"], ["y", "\u22121", "1", "5"]]}]}}),
        "fraction-slope": fixture(
            "graph-of-linear-rule", "Which graph shows $y = -\\frac{2}{3}x + 2$?", "Graph", [
                graph_option("option-a", "A line through (0, 2) and (3, 4), rising from left to right.", ("through", (0, 2), (3, 4)), [(0, 2), (3, 4)]),
                graph_option("option-b", "A line through (0, 2) and (3, 0), falling from left to right.", ("through", (0, 2), (3, 0)), [(0, 2), (3, 0)]),
                graph_option("option-c", "A line through (0, 2) and (2, \u22121), falling from left to right.", ("through", (0, 2), (2, -1)), [(0, 2), (2, -1)]),
            ], "option-b", ["Graph B is the line through (0, 2) and (3, 0)."], "Use the slope.",
            {"option-a": "Graph A rises.", "option-c": "Graph C uses the slope upside down."}),
        "rate": fixture(
            "graph-of-proportional-rate",
            "A pump fills 6 liters every 4 minutes at a constant rate. Which graph shows the number of liters, $y$, after $x$ minutes?",
            "Graph", [
                graph_option("option-a", "A line starting at (0, 0) and passing through (2, 3).", ("half-line", (0, 0), (8, 12)), [(0, 0), (2, 3)], (0, 12), (0, 12), ("Minutes", "Liters")),
                graph_option("option-b", "A line starting at (0, 0) and passing through (3, 2).", ("half-line", (0, 0), (12, 8)), [(0, 0), (3, 2)], (0, 12), (0, 12), ("Minutes", "Liters")),
                graph_option("option-c", "A line starting at (0, 6) and passing through (2, 9).", ("half-line", (0, 6), (4, 12)), [(0, 6), (2, 9)], (0, 12), (0, 12), ("Minutes", "Liters")),
                graph_option("option-d", "A line starting at (0, 0) and passing through (1, 6).", ("half-line", (0, 0), (2, 12)), [(0, 0), (1, 6)], (0, 12), (0, 12), ("Minutes", "Liters")),
            ], "option-a", ["The unit rate is 3/2 liters per minute.", "Graph A is the line from (0, 0) through (2, 3)."],
            "Find the liters per minute.",
            {"option-b": "Graph B has the rate upside down.", "option-c": "Graph C starts at 6.", "option-d": "Graph D ignores the 4 minutes."}),
        "per": fixture(
            "graph-of-proportional-rate",
            "A reader reads 2 books per week. Which graph shows the number of books, $y$, after $x$ weeks?",
            "Graph", [
                graph_option("option-a", "A line starting at (0, 2) and passing through (1, 3).", ("half-line", (0, 2), (10, 12)), [(0, 2), (1, 3)], (0, 12), (0, 12), ("Weeks", "Books")),
                graph_option("option-b", "A line starting at (0, 0) and passing through (1, 2).", ("half-line", (0, 0), (6, 12)), [(0, 0), (1, 2)], (0, 12), (0, 12), ("Weeks", "Books")),
            ], "option-b", ["Graph B is the line from (0, 0) through (1, 2)."], "Zero weeks, zero books.",
            {"option-a": "Graph A starts at 2."}),
        "inequality": fixture(
            "graph-of-inequality-number-line", "Which number line shows the solutions of $-3x + 1 \\le 7$?", "Number line", [
                ray_option("option-a", "A closed circle at \u22122 with the ray shaded to the left.", None, -2, (False, False)),
                ray_option("option-b", "A closed circle at \u22122 with the ray shaded to the right.", -2, None, (False, False)),
                ray_option("option-c", "An open circle at \u22122 with the ray shaded to the right.", -2, None, (True, False)),
                ray_option("option-d", "A closed circle at 2 with the ray shaded to the right.", 2, None, (False, False)),
            ], "option-b", ["Subtract 1: $-3x \\le 6$.", "Divide by \u22123 and reverse the sign: Number line B shows $x \\ge -2$."],
            "Dividing by a negative number reverses the sign.",
            {"option-a": "Number line A did not reverse the sign.", "option-c": "Number line C leaves out \u22122.",
             "option-d": "Number line D lost the sign of \u22122."}),
        "inequality-strict": fixture(
            "graph-of-inequality-number-line", "Which number line shows the solutions of $2x - 4 > 2$?", "Number line", [
                ray_option("option-a", "An open circle at 3 with the ray shaded to the right.", 3, None, (True, False)),
                ray_option("option-b", "An open circle at 3 with the ray shaded to the left.", None, 3, (False, True)),
            ], "option-a", ["Number line A shows $x > 3$."], "Add 4, then divide by 2.",
            {"option-b": "Number line B points the wrong way."}),
        "parabola": fixture(
            "graph-of-quadratic-or-exponential", "Which graph shows $y = -\\frac{1}{2}(x + 2)^2 + 3$?", "Graph", [
                graph_option("option-a", "A parabola opening down with its vertex at (\u22122, 3).", ("curve", {"f": "poly", "c": [1, -2, -0.5]}), [(-2, 3)], (-5, 5)),
                graph_option("option-b", "A parabola opening down with its vertex at (2, 3).", ("curve", {"f": "poly", "c": [1, 2, -0.5]}), [(2, 3)], (-5, 5)),
                graph_option("option-c", "A parabola opening up with its vertex at (\u22122, 3).", ("curve", {"f": "poly", "c": [5, 2, 0.5]}), [(-2, 3)], (-5, 5)),
                graph_option("option-d", "A straight line through (\u22122, 3) and (0, 1), falling from left to right.", ("through", (-2, 3), (0, 1)), [(-2, 3), (0, 1)], (-5, 5)),
            ], "option-a", ["Graph A is the parabola with its vertex at (\u22122, 3)."], "Read the vertex from the form.",
            {"option-b": "Graph B moves right.", "option-c": "Graph C opens up.", "option-d": "Graph D is a line."}),
        "exponential": fixture(
            "graph-of-quadratic-or-exponential", "Which graph shows $y = 4 \\cdot \\left(\\frac{1}{2}\\right)^x$?", "Graph", [
                graph_option("option-a", "A curve through (\u22121, 2) and (0, 4), rising from left to right and leveling off toward the x-axis on the left.",
                             ("curve", {"f": "exp", "a": 4, "b": 2}), [(-1, 2), (0, 4)], (-5, 5), (-2, 12)),
                graph_option("option-b", "A curve through (0, 4) and (1, 2), falling from left to right and leveling off toward the x-axis on the right.",
                             ("curve", {"f": "exp", "a": 4, "b": 0.5}), [(0, 4), (1, 2)], (-5, 5), (-2, 12)),
                graph_option("option-c", "A curve through (0, 1) and (1, 0.5), falling from left to right and leveling off toward the x-axis on the right.",
                             ("curve", {"f": "exp", "a": 1, "b": 0.5}), [(0, 1), (1, 0.5)], (-5, 5), (-2, 12)),
                graph_option("option-d", "A curve through (0, 3) and (1, 1), falling from left to right and leveling off toward the x-axis on the right.",
                             ("curve", {"f": "exp", "a": 3, "b": 1 / 3}), [(0, 3), (1, 1)], (-5, 5), (-2, 12)),
            ], "option-b", ["Graph B is that curve, through (0, 4) and (1, 2)."], "Put x = 0 first.",
            {"option-a": "Graph A grows.", "option-c": "Graph C starts at 1.", "option-d": "Graph D uses another factor."}),
        "transform": fixture(
            "graph-of-quadratic-or-exponential",
            "The graph of $y = f(x)$, with $f(x) = x^2$, is shown. Which graph shows $y = f(x + 1) - 2$?", "Graph", [
                graph_option("option-a", "A parabola opening up with its vertex at (1, \u22122).", ("curve", {"f": "poly", "c": [-1, -2, 1]}), [(1, -2)], (-5, 5)),
                graph_option("option-b", "A parabola opening up with its vertex at (\u22121, \u22122).", ("curve", {"f": "poly", "c": [-1, 2, 1]}), [(-1, -2)], (-5, 5)),
                graph_option("option-c", "A parabola opening up with its vertex at (\u22122, 1).", ("curve", {"f": "poly", "c": [5, 4, 1]}), [(-2, 1)], (-5, 5)),
            ], "option-b", ["Graph B is the parabola with its vertex at (\u22121, \u22122)."], "Follow the vertex.",
            {"option-a": "Graph A moves right.", "option-c": "Graph C swaps the shifts."},
            {"kind": "scene", "scene": {"v": 1, "elements": [{"type": "graph", "x": [-5, 5], "y": [-6, 6],
                                                              "curves": [{"fn": {"f": "poly", "c": [0, 0, 1]}}]}]}}),
    }
    return cases


def expect_rejected(problem, what):
    try:
        review_problem(problem)
    except (ValueError, KeyError, TypeError, IndexError, ZeroDivisionError):
        return 1
    raise AssertionError(f"Accepted corrupt figure-choice case: {what}")


def self_test():
    cases = handwritten()
    for case in cases.values():
        require(review_problem(case) == case["answer"], "Handwritten fixture")
    require(solve_for_y("y=-((1)/(2))(x+2)^2+3") == poly([1, -2, F(-1, 2)]), "Vertex-form parse")
    require(read_inequality("Which number line shows the solutions of $-3x + 1 \\le 7$?") == (-2, True, True), "Reversal")
    require(scene_number(1 / 3) == F(1, 3), "Rational coordinate")
    require(clip_number(1.333333) == F(4, 3), "Rounded clip coordinate")
    try:
        scene_number(1.333333)
    except ValueError:
        pass
    else:
        raise AssertionError("A rounded coordinate read as exact away from a clip end")
    mutations = 0

    def mutate(name, change, what):
        nonlocal mutations
        bad = copy.deepcopy(cases[name])
        change(bad)
        mutations += expect_rejected(bad, what)

    def options(bad):
        return bad["public"]["response"]["options"]

    def element(bad, i):
        return options(bad)[i]["scene"]["elements"][0]

    mutate("slope-intercept", lambda b: b.update(answer="option-c"), "swapped answer")
    mutate("slope-intercept", lambda b: b["public"].update(prompt="Which graph shows $y = 2x + 5$?"), "no option matches")
    mutate("standard", lambda b: b["public"].update(prompt="Which graph shows $2x + y = 1$?"), "standard form sign")
    mutate("table", lambda b: b["public"]["figure"]["scene"]["elements"][0]["rows"][1].__setitem__(3, "6"), "nonlinear table")

    def duplicate(b):
        options(b)[2]["scene"] = copy.deepcopy(options(b)[0]["scene"])
        options(b)[2]["label"] = "A line through (0, 1) and (1, 3), rising from left to right, again."
    mutate("slope-intercept", duplicate, "two identical figures")
    mutate("slope-intercept", lambda b: options(b)[1].update(label="A line through (0, 1) and (2, \u22121), falling from left to right."),
           "description point off the line")
    mutate("slope-intercept", lambda b: options(b)[1].update(label="A line through (0, 1) and (1, \u22121), rising from left to right."),
           "rising for falling")
    mutate("slope-intercept", lambda b: element(b, 1)["points"].pop(), "named point not drawn")
    mutate("slope-intercept", lambda b: options(b)[2].update(label="The correct line through (0, 2) and (1, 3), rising from left to right."),
           "revealing description")
    mutate("slope-intercept", lambda b: options(b)[2].update(label=options(b)[3]["label"]), "duplicate descriptions")
    mutate("slope-intercept", lambda b: b["choiceFeedback"].pop("option-c"), "missing feedback key")
    mutate("slope-intercept", lambda b: b["choiceFeedback"].update({"option-a": "Graph A is right."}), "feedback for the answer")
    mutate("slope-intercept", lambda b: b["choiceFeedback"].update({"option-c": "Graph D swaps the slope."}), "feedback names another card")
    mutate("slope-intercept", lambda b: b["explanation"].__setitem__(-1, "Graph C is the line through (0, 1) and (1, 3)."),
           "explanation names another card")
    mutate("slope-intercept", lambda b: b["explanation"].__setitem__(-1, "Graph A is the line through (0, 1) and (2, 3)."),
           "explanation point off the answer")
    mutate("slope-intercept", lambda b: b.update(hint="Look at Graph A."), "hint names a card")
    mutate("slope-intercept", lambda b: b["public"]["response"].update(label="Choose the graph (option-a)"), "prompt leaks an id")
    mutate("slope-intercept", lambda b: b["explanation"].insert(0, "Divide by ${signed(a)}."), "unrendered placeholder")
    mutate("slope-intercept", lambda b: element(b, 3).update(x=[-8, 8]), "one card has another window")
    mutate("rate", lambda b: b["public"].update(prompt=b["public"]["prompt"].replace("every 4", "every 3")), "rate period")
    mutate("rate", lambda b: [element(b, i).update(axisNames=["Liters", "Minutes"]) for i in range(4)], "axes swapped")
    mutate("rate", lambda b: options(b)[2].update(label="A line starting at (2, 9) and passing through (4, 12)."), "false start")
    mutate("rate", lambda b: element(b, 0)["segments"][0].pop("arrow"), "answer drawn as a segment that stops")
    mutate("rate", lambda b: element(b, 0)["segments"][0].update(**{"from": [2, 3]}), "ray starts away from the origin")
    mutate("rate", lambda b: element(b, 0)["segments"][0].update(to=[-8, -12]), "ray points back in time")
    mutate("per", lambda b: b["public"].update(prompt=b["public"]["prompt"].replace("per week", "per day")), "rate unit")
    mutate("inequality", lambda b: element(b, 0)["intervals"][0].update(open=[False, True]), "open flag flipped")
    mutate("inequality", lambda b: b["public"].update(prompt="Which number line shows the solutions of $3x + 1 \\le 7$?"),
           "sign not reversed")
    mutate("inequality", lambda b: options(b)[0].update(label="A closed circle at \u22122 with the ray shaded to the right, too."),
           "unreadable description")
    mutate("inequality", lambda b: b["explanation"].__setitem__(-1, "Number line B shows $x \\le -2$."), "explanation set")
    mutate("inequality-strict", lambda b: element(b, 1)["intervals"][0].update(to=4), "boundary differs from description")
    mutate("parabola", lambda b: options(b)[1].update(label="A parabola opening up with its vertex at (2, 3)."), "opening")
    mutate("parabola", lambda b: element(b, 0)["curves"][0]["fn"].update(c=[1, -2, -1]), "curve not in vertex form")
    mutate("parabola", lambda b: options(b)[1].update(label="A parabola opening down with its vertex at (2, 4)."), "wrong vertex")
    mutate("exponential", lambda b: options(b)[1].update(label=options(b)[1]["label"].replace("on the right", "on the left")),
           "asymptote side")
    mutate("exponential", lambda b: element(b, 2)["curves"][0]["fn"].update(k=1), "shifted asymptote")
    mutate("exponential", lambda b: b["public"].update(prompt="Which graph shows $y = 4 \\cdot 2^x$?"),
           "growth read as decay")
    mutate("transform", lambda b: b["public"]["figure"]["scene"]["elements"][0]["curves"][0]["fn"].update(c=[0, 0, 2]),
           "shown graph is not f")
    mutate("transform", lambda b: b["public"].update(prompt=b["public"]["prompt"].replace("f(x + 1)", "f(x - 1)")),
           "horizontal shift direction")
    return {"handwritten_cases": len(cases), "mutations": mutations}


if __name__ == "__main__":
    print(self_test())
