"""Independent review of the multi-part choice families from their public wording.

Every blank's correct option is derived from the prompt, the public figure,
the blank labels and the option labels alone: a line's slope and intercept
from two given points, a graph's labeled lattice points or a table; each
row's proportionality by evaluating its equation (or its pairs) exactly; an
expression's parts by parsing it. The private answer key and the explanation
are only values under test. Grading (every blank correct, the answer a
compact JSON object keyed in blank order) is reimplemented here.
"""

import copy
import json
import re
from fractions import Fraction as F

SUPPORTED = frozenset({"inline-linear-features", "proportional-match-table", "label-expression-parts"})
OPTION_IDS = "abcdef"
BLANK_ID = re.compile(r"[a-z][a-z0-9]{0,7}")
MATH = re.compile(r"\$([^$]+)\$")
PAIR = re.compile(r"\((-?\d+), (-?\d+)\)")
SAMPLES = [F(v) for v in (1, 2, 3, 5, 7, -1, -2, -3, -5, 11)] + [F(1, 2), F(-7, 3)]


def require(condition, message):
    if not condition:
        raise ValueError(message)


def compact(key):
    return json.dumps(key, separators=(",", ":"))


# ---------------------------------------------------------------- exact TeX arithmetic
# A small parser for the TeX the families print: integers, single-letter
# variables, + and -, \cdot / \times / juxtaposition, ^, parentheses and
# \frac{..}{..}. It yields a tree evaluated exactly with Fractions.

TOKEN = re.compile(r"\s*(\\[dt]?frac|\\cdot|\\times|\d+|[a-zA-Z]|[-+()^{}])")


def tex_tokens(text):
    tokens, position = [], 0
    text = text.replace("−", "-").rstrip()
    while position < len(text):
        match = TOKEN.match(text, position)
        require(match is not None, f"Unreadable math: {text!r}")
        tokens.append(match[1])
        position = match.end()
    return tokens


def tex_tree(text):
    tokens, at = tex_tokens(text), [0]

    def peek():
        return tokens[at[0]] if at[0] < len(tokens) else None

    def take(expected=None):
        token = peek()
        require(token is not None, f"Truncated math: {text!r}")
        require(expected is None or token == expected, f"Expected {expected} in {text!r}")
        at[0] += 1
        return token

    def primary():
        token = take()
        if token.isdigit():
            require(token == "0" or not token.startswith("0"), f"Leading zero in {text!r}")
            return ("num", F(int(token)))
        if re.fullmatch(r"[a-zA-Z]", token):
            return ("var", token)
        if token in ("(", "{"):
            inner = expression()
            take(")" if token == "(" else "}")
            return ("group", inner) if token == "(" else inner
        if token.endswith("frac"):
            take("{")
            top = expression()
            take("}")
            take("{")
            bottom = expression()
            take("}")
            return ("div", top, bottom)
        raise ValueError(f"Unexpected {token} in {text!r}")

    def power():
        base = primary()
        if peek() == "^":
            take()
            base = ("pow", base, primary())
        return base

    def factor():
        if peek() == "-":
            take()
            return ("neg", factor())
        return power()

    def term():
        node = factor()
        while True:
            token = peek()
            if token in ("\\cdot", "\\times"):
                take()
                node = ("mul", node, factor())
            elif token is not None and (token.isdigit() or token == "(" or token.endswith("frac")
                                        or re.fullmatch(r"[a-zA-Z]", token)):
                node = ("mul", node, power())
            else:
                return node

    def expression():
        node = ("neg", term()) if peek() == "-" and take() else term()
        while peek() in ("+", "-"):
            sign = take()
            right = term()
            node = ("add", node, right) if sign == "+" else ("sub", node, right)
        return node

    tree = expression()
    require(at[0] == len(tokens), f"Trailing input in {text!r}")
    return tree


def tree_vars(node):
    if node[0] == "var":
        return {node[1]}
    if node[0] == "num":
        return set()
    return set().union(*(tree_vars(child) for child in node[1:]))


def evaluate(node, env):
    kind = node[0]
    if kind == "num":
        return node[1]
    if kind == "var":
        require(node[1] in env, f"Unknown variable {node[1]}")
        return F(env[node[1]])
    if kind == "group":
        return evaluate(node[1], env)
    if kind == "neg":
        return -evaluate(node[1], env)
    a, b = evaluate(node[1], env), evaluate(node[2], env)
    if kind == "add":
        return a + b
    if kind == "sub":
        return a - b
    if kind == "mul":
        return a * b
    if kind == "div":
        if b == 0:
            raise ZeroDivisionError("Division by zero")
        return a / b
    require(kind == "pow" and b.denominator == 1 and 0 <= b <= 6, "Unsupported exponent")
    return a ** int(b)


def tex_number(label):
    """A displayed number option: $n$, $-n$, $\\frac{p}{q}$ or $-\\frac{p}{q}$, canonical."""
    match = re.fullmatch(r"\$(-?)(?:(\d+)|\\frac\{(\d+)\}\{(\d+)\})\$", label)
    require(match is not None, f"Not a number option: {label}")
    sign, whole, top, bottom = match.groups()
    if whole is not None:
        require(whole == "0" or not whole.startswith("0"), f"Leading zero: {label}")
        require(not (sign and whole == "0"), "Negative zero")
        return -F(int(whole)) if sign else F(int(whole))
    value = F(int(top), int(bottom))
    require(int(bottom) > 1 and value.numerator == int(top) and value.denominator == int(bottom),
            f"Fraction not in lowest terms: {label}")
    return -value if sign else value


def tex_of(value):
    value = F(value)
    sign = "-" if value < 0 else ""
    value = abs(value)
    body = str(value.numerator) if value.denominator == 1 else f"\\frac{{{value.numerator}}}{{{value.denominator}}}"
    return f"${sign}{body}$"


# ---------------------------------------------------------------- shared response checks

def common_response(response, layout, label):
    require(response.get("kind") == "multi-part-choice", "Response kind")
    require(response.get("layout") == layout, "Layout")
    require(response.get("label") == label, "Response label")
    blanks = response.get("blanks")
    require(isinstance(blanks, list) and 2 <= len(blanks) <= 6, "Two to six blanks")
    ids = [b["id"] for b in blanks]
    require(len(set(ids)) == len(ids) and all(BLANK_ID.fullmatch(i) for i in ids), "Blank identifiers")
    for b in blanks:
        require(set(b) == {"id", "label", "options"}, "Blank fields")
        require(isinstance(b["label"], str) and b["label"].strip() and len(b["label"]) <= 120, "Blank label")
        options = b["options"]
        require(2 <= len(options) <= 6, "Two to six options")
        require([o["id"] for o in options] == list(OPTION_IDS[:len(options)]), "Option ids a.. in order")
        require(all(set(o) == {"id", "label"} and o["label"].strip() and len(o["label"]) <= 80 for o in options),
                "Option fields")
        require(len({o["label"] for o in options}) == len(options), "Repeated option label")
    if layout == "inline":
        sentence = response.get("sentence")
        require(isinstance(sentence, list) and "rowHeader" not in response, "Inline sentence")
        order = [part["blank"] for part in sentence if "blank" in part]
        require(order == ids, "Sentence blanks follow blank order, once each")
        require(all(set(part) in ({"text"}, {"blank"}) for part in sentence), "Sentence parts")
    else:
        require("sentence" not in response, "Only inline layouts carry a sentence")
        if layout == "slots":
            require("rowHeader" not in response, "Slots carry no row header")
        else:
            require(all(b["options"] == blanks[0]["options"] for b in blanks), "Table rows share their columns")
    return blanks


def pick(blank, correct, value_of):
    """The one option whose value is correct; every other option differs from it and from each other."""
    values = [value_of(o["label"]) for o in blank["options"]]
    require(len(set(values)) == len(values), f"Two options of {blank['id']} are equal")
    hits = [o["id"] for o, v in zip(blank["options"], values) if v == correct]
    require(len(hits) == 1, f"{blank['id']} needs exactly one correct option, found {len(hits)}")
    return hits[0]


def checked_text(problem):
    explanation, hint = problem.get("explanation"), problem.get("hint")
    require(isinstance(explanation, list) and explanation and all(isinstance(e, str) and e.strip() for e in explanation),
            "Explanation lines")
    require(isinstance(hint, str) and hint.strip(), "Hint")
    return explanation, hint


# ---------------------------------------------------------------- inline-linear-features

SENTENCES = {
    ("slope", "int", "dir"): [{"text": "The slope of the line is "}, {"blank": "slope"},
                              {"text": ", its $y$-intercept is "}, {"blank": "int"},
                              {"text": ", and as $x$ increases, $y$ "}, {"blank": "dir"}, {"text": "."}],
    ("m", "b"): [{"text": "In the line’s equation $y = mx + b$, $m =$ "}, {"blank": "m"},
                 {"text": " and $b =$ "}, {"blank": "b"}, {"text": "."}],
}
BLANK_LABELS = {"slope": "the slope", "int": "the $y$-intercept", "dir": "the direction of change",
                "m": "$m$", "b": "$b$"}
DIRECTIONS = {"increases", "decreases", "stays the same"}
PROPORTIONAL_HINT = ("A proportional relationship can be written as $y = kx$: every pair has the same ratio "
                     "$\\frac{y}{x}$, and $x = 0$ gives $y = 0$. Start with ROW: simplify it, or compare its ratios, "
                     "before you decide.")


def line_hint(variant, points):
    """The hint names this problem's own givens (its points or table rows) and no answer."""
    (x1, y1), (x2, y2) = [(int(x), int(y)) for x, y in (points[0], points[-1])]
    if variant == "graph":
        return ("Read where the line crosses the $y$-axis for the $y$-intercept. For the slope, count the rise and "
                f"the run from $A({x1}, {y1})$ to $B({x2}, {y2})$.")
    if variant == "table":
        return (f"Take the rows for $x = {x1}$ and $x = {x2}$: the slope is the change in $y$ divided by the change "
                "in $x$. Then work back to $x = 0$ to find the $y$-intercept.")
    return (f"Divide the change in $y$ by the change in $x$ from $({x1}, {y1})$ to $({x2}, {y2})$ for the slope. "
            "Then put one point and the slope into $y = mx + b$ to find $b$.")


def scene_element(figure, kind):
    """The one element of a scene figure, of the expected type."""
    require(isinstance(figure, dict) and figure.get("kind") == "scene", "A scene figure is required")
    scene = figure["scene"]
    require(scene.get("v") == 1 and len(scene["elements"]) == 1, "One scene element")
    element = scene["elements"][0]
    require(element.get("type") == kind, f"The scene must show a {kind}")
    return element


def read_line_source(public):
    """(variant, given points, slope, intercept) from the prompt and figure only."""
    prompt, figure = public["prompt"], public.get("figure")
    match = re.fullmatch(r"A line passes through the points \$\((-?\d+), (-?\d+)\)\$ and \$\((-?\d+), (-?\d+)\)\$\. "
                         r"Complete the sentence about the line\.", prompt)
    if match:
        require(figure is None, "Point prompt with a figure")
        points = [(int(match[1]), int(match[2])), (int(match[3]), int(match[4]))]
        variant = "points"
    elif prompt.startswith("The graph shows"):
        match = re.fullmatch(r"The graph shows a line through \$A\((-?\d+), (-?\d+)\)\$ and \$B\((-?\d+), (-?\d+)\)\$\. "
                             r"Complete the sentence about the line\.", prompt)
        require(match is not None, f"Unknown graph prompt: {prompt}")
        points = [(int(match[1]), int(match[2])), (int(match[3]), int(match[4]))]
        plot = scene_element(figure, "graph")
        (x_min, x_max), (y_min, y_max) = plot["x"], plot["y"]
        require(plot.get("axisNames") == ["x", "y"], "Graph axes are x and y")
        shown = [(p["x"], p["y"], p.get("label")) for p in plot.get("points", [])]
        require(shown == [(*points[0], "A"), (*points[1], "B")], "Figure points disagree with the prompt")
        for p in points:
            require(x_min <= p[0] <= x_max and y_min <= p[1] <= y_max, "A labeled point is off the graph")
        variant = "graph"
    else:
        require(prompt == "The table shows four points on a line. Complete the sentence about the line.",
                f"Unknown line prompt: {prompt}")
        table = scene_element(figure, "table")
        require(table.get("corner") == "x" and table.get("columns") == ["y"], "Table columns are x and y")
        rows = table["rows"]
        require(len(rows) == 4 and all(len(r["cells"]) == 1 for r in rows), "Four table rows of one y each")
        # A row label is display text: a negative x is written with a true minus sign.
        require(all(re.fullmatch(r"\u2212?(?:0|[1-9]\d*)", r["label"]) and r["label"] != "\u22120"
                    and type(r["cells"][0]) is int for r in rows), "Table entries are integers")
        points = [(F(int(r["label"].replace("\u2212", "-"))), F(r["cells"][0])) for r in rows]
        variant = "table"
    require(len(set(p[0] for p in points)) == len(points), "Repeated x: no single slope")
    (x1, y1), (x2, y2) = points[0], points[1]
    m = F(y2 - y1) / F(x2 - x1)
    b = F(y1) - m * x1
    for x, y in points:
        require(m * x + b == y, "Table rows are not collinear")
    if variant == "graph":
        lines = plot.get("lines", [])
        require(len(lines) == 1, "One drawn line")
        through = [tuple(F(v) for v in q) for q in lines[0]["line"]["through"]]
        require(len(through) == 2 and through[0] != through[1], "The drawn line needs two distinct points")
        require(all(m * x + b == y for x, y in through), "Drawn line misses the labeled points")
        # The hint tells the learner to read the y-intercept off the graph.
        require(y_min <= b <= y_max and x_min <= 0 <= x_max, "The y-intercept is off the drawn graph")
    return variant, points, m, b


def review_line_explanation(problem, variant, points, m, b, ids):
    explanation, hint = checked_text(problem)
    require(hint == line_hint(variant, points), "Hint must name this problem's givens and no answer")
    stated = set()
    for line in explanation:
        for x, y in PAIR.findall(line):
            require(m * int(x) + b == int(y), f"Explanation point ({x}, {y}) is not on the line")
        if line.startswith("The slope is the change in $y$ divided by the change in $x$."):
            match = re.search(r"From \$\((-?\d+), (-?\d+)\)\$ to \$\((-?\d+), (-?\d+)\)\$", line)
            require(match is not None, "Slope line names its points")
            used = [(int(match[1]), int(match[2])), (int(match[3]), int(match[4]))]
            require(all(p in points for p in used) and used[0] != used[1], "Slope from points that were not given")
            stated.add("m")
        elif line.startswith("Substitute"):
            stated.add("b")
        elif line.startswith("The point"):
            require(re.fullmatch(r"The point \$\(0, (-?\d+)\)\$ is on the \$y\$-axis, so the \$y\$-intercept is "
                                 r"\$b = (-?\d+)\$\.", line) is not None, "Intercept-point wording")
            stated.add("b")
        elif line.startswith("The equation is"):
            match = re.fullmatch(r"The equation is \$y = (.+)\$\.", line)
            require(match is not None, "Equation wording")
            tree = tex_tree(match[1])
            require(tree_vars(tree) <= {"x"}, "Equation in x")
            require(evaluate(tree, {"x": 0}) == b and evaluate(tree, {"x": 1}) == m + b, "Stated equation is wrong")
            stated.add("eq")
        elif line.startswith("The slope is "):
            sign = "positive" if m > 0 else "negative"
            way = "increases" if m > 0 else "decreases"
            require(m != 0 and line == f"The slope is {sign}, so $y$ {way} as $x$ increases.", "Direction statement")
            stated.add("dir")
        else:
            raise ValueError(f"Unknown explanation line: {line}")
        # Every fully numeric (or m, b) side of every displayed equation agrees.
        for segment in MATH.findall(line):
            if "," in segment:
                continue
            sides = segment.split("=")
            values = []
            for side in sides:
                tree = tex_tree(side)
                if tree_vars(tree) <= {"m", "b"}:
                    values.append(evaluate(tree, {"m": m, "b": b}))
            require(len(set(values)) <= 1, f"Unequal sides in ${segment}$")
    for line in explanation:
        for lhs, value in re.findall(r"\$([mb]) = (?:[^$]*= )?([^$=]+)\$", line):
            require(evaluate(tex_tree(value), {}) == {"m": m, "b": b}[lhs], f"Explanation states a wrong {lhs}")
    require({"m", "b"} <= stated, "Explanation must state the slope and the intercept")
    require(("dir" in stated) == ("dir" in ids) and ("eq" in stated) == ("dir" not in ids),
            "Explanation must close with the direction or the equation")


def solve_line(public):
    response = public["response"]
    blanks = common_response(response, "inline", "Choose an option for each blank")
    ids = tuple(b["id"] for b in blanks)
    require(ids in SENTENCES and response["sentence"] == SENTENCES[ids], "Unknown sentence")
    require(all(b["label"] == BLANK_LABELS[b["id"]] for b in blanks), "Blank labels")
    variant, points, m, b = read_line_source(public)
    key = {}
    for blank in blanks:
        if blank["id"] in ("slope", "m"):
            key[blank["id"]] = pick(blank, m, tex_number)
        elif blank["id"] in ("int", "b"):
            key[blank["id"]] = pick(blank, b, tex_number)
        else:
            require({o["label"] for o in blank["options"]} <= DIRECTIONS, "Direction options")
            way = "increases" if m > 0 else "decreases" if m < 0 else "stays the same"
            key[blank["id"]] = pick(blank, way, lambda label: label)
    return compact(key), (variant, points, m, b, ids)


# ---------------------------------------------------------------- proportional-match-table

VERDICTS = [{"id": "a", "label": "Proportional"}, {"id": "b", "label": "Not proportional"}]
PROPORTIONAL_LEAD = ("Proportional means $y = kx$ for one constant $k$: the ratio $\\frac{y}{x}$ never changes "
                     "and the graph is a line through the origin.")


def relation_of(label):
    """('pairs', [(x, y)]) or ('function', y(x)) read from a row label."""
    # A pair list is one math run "$(1, 4), (3, 12)$" or separate runs joined by
    # prose commas "$(1, 4)$, $(3, 12)$"; both read the same.
    if re.fullmatch(r"\$\(-?\d+, -?\d+\)\$(?:, \$\(-?\d+, -?\d+\)\$)+", label):
        label = "$" + label[1:-1].replace("$, $", ", ") + "$"
    match = re.fullmatch(r"\$([^$]+)\$", label)
    require(match is not None, f"Row label is not math: {label}")
    body = match[1]
    if body.startswith("("):
        require(re.fullmatch(r"\(-?\d+, -?\d+\)(?:, \(-?\d+, -?\d+\))+", body) is not None, f"Pair list: {body}")
        pairs = [(F(int(x)), F(int(y))) for x, y in PAIR.findall(body)]
        require(len(set(p[0] for p in pairs)) == len(pairs), "A pair list repeats an x: not a function")
        return "pairs", pairs
    sides = body.split("=")
    require(len(sides) == 2, f"Not one equation: {body}")
    left, right = tex_tree(sides[0]), tex_tree(sides[1])
    require(tree_vars(left) | tree_vars(right) <= {"x", "y"} and "y" in tree_vars(left) | tree_vars(right),
            f"Equation in x and y: {body}")

    def gap(x, y):
        return evaluate(left, {"x": x, "y": y}) - evaluate(right, {"x": x, "y": y})

    def y_of(x):
        g0, g1, g2 = gap(x, 0), gap(x, 1), gap(x, 2)
        require(g2 - g1 == g1 - g0 and g1 != g0, f"Equation is not solvable for y: {body}")
        return -g0 / (g1 - g0)

    return "function", y_of


def defined(f, x):
    try:
        return f(x)
    except (ZeroDivisionError, KeyError):
        return None


def proportional(relation):
    kind, data = relation
    if kind == "pairs":
        ratios = {y / x for x, y in data if x != 0}
        require(ratios, "No pair with x not zero")
        return len(ratios) == 1 and all(y == 0 for x, y in data if x == 0)
    if defined(data, F(0)) != 0:
        return False
    values = [defined(data, x) for x in SAMPLES]
    return None not in values and len({v / x for v, x in zip(values, SAMPLES)}) == 1


def review_row_line(line, label, relation, verdict):
    prefix = f"{label}: {'proportional' if verdict else 'not proportional'}. "
    require(line.startswith(prefix), f"Row explanation for {label} must open with its verdict")
    rest = line[len(prefix):]
    kind, data = relation
    f = (lambda x: dict(data)[x]) if kind == "pairs" else data
    for x, y in re.findall(r"\$x = (-?\d+)\$(?:,| gives) \$y = (-?\d+)\$", rest):
        require(defined(f, F(int(x))) == int(y), f"False value at x = {x} for {label}")
    doubled = re.search(r"\$x = (-?\d+)\$ gives \$y = (-?\d+)\$ and \$x = (-?\d+)\$ gives \$y = (-?\d+)\$, "
                        r"not twice as much", rest)
    if doubled:
        x1, y1, x2, y2 = (int(v) for v in doubled.groups())
        require(x2 == 2 * x1 and y2 != 2 * y1, "Not-twice claim")
    match = re.search(r"When \$x = 0\$, \$y = (-?\d+)\$, not 0", rest)
    if match:
        require(int(match[1]) != 0, "Claimed miss of the origin")
    if "As $x$ doubles, $y$ halves" in rest:
        require(kind == "function" and all(defined(f, 2 * x) == defined(f, x) / 2 for x in SAMPLES), "Halving claim")
    match = re.search(r"Dividing by (\d+) is multiplying by \$\\frac\{1\}\{(\d+)\}\$", rest)
    if match:
        require(match[1] == match[2], "Reciprocal")
    rest = re.sub(r"\$x = -?\d+\$(?:,| gives) \$y = -?\d+\$", "", rest)
    for segment in MATH.findall(rest):
        if "\\ne" in segment:
            sides = [evaluate(tex_tree(s), {}) for s in segment.split("\\ne")]
            require(len(sides) == 2 and sides[0] != sides[1], f"False inequality ${segment}$")
            if kind == "pairs":
                ratios = {y / x for x, y in data if x != 0}
                require(set(sides) <= ratios, "The compared ratios are not the pairs' ratios")
            continue
        if "=" not in segment or segment == "y = kx":
            continue
        sides = [s.strip() for s in segment.split("=")]
        head, values = sides[0], [tex_tree(s) for s in sides[1:]]
        if head == "y":
            for tree in values:
                require(tree_vars(tree) <= {"x"}, f"Rewritten equation in x: ${segment}$")
                for x in SAMPLES:
                    require(defined(f, x) == evaluate(tree, {"x": x}), f"Rewrite is not equivalent: ${segment}$")
        elif head == "\\frac{y}{x}":
            for tree in values:
                if kind == "pairs":
                    require(all(y / x == evaluate(tree, {}) for x, y in data), f"False ratio ${segment}$")
                else:
                    require(all(defined(f, x) / x == evaluate(tree, {"x": x}) for x in SAMPLES), f"False ratio ${segment}$")
        elif head == "k":
            require(verdict, "A constant of proportionality for a non-proportional row")
            for tree in values:
                require(all(defined(f, x) == evaluate(tree, {}) * x for x in SAMPLES), f"False k: ${segment}$")
        else:
            raise ValueError(f"Unchecked claim ${segment}$ for {label}")


def solve_proportional(public):
    require(public["prompt"] == "Decide whether each relationship between $x$ and $y$ is proportional.", "Prompt")
    response = public["response"]
    blanks = common_response(response, "table", "Choose one column in each row")
    require(response.get("rowHeader") == "Relationship", "Row header")
    require(blanks[0]["options"] == VERDICTS, "Columns are Proportional / Not proportional")
    require([b["id"] for b in blanks] == [f"r{i}" for i in range(1, len(blanks) + 1)], "Row ids")
    require(len({b["label"] for b in blanks}) == len(blanks), "Repeated row")
    rows, key = [], {}
    for blank in blanks:
        relation = relation_of(blank["label"])
        verdict = proportional(relation)
        rows.append((blank["label"], relation, verdict))
        key[blank["id"]] = pick(blank, "Proportional" if verdict else "Not proportional", lambda label: label)
    return compact(key), rows


def review_proportional_explanation(problem, rows):
    explanation, hint = checked_text(problem)
    require(hint == PROPORTIONAL_HINT.replace("ROW", rows[0][0]), "Hint must start with this problem's first row")
    require(explanation[0] == PROPORTIONAL_LEAD and len(explanation) == len(rows) + 1, "One line per row")
    for line, (label, relation, verdict) in zip(explanation[1:], rows):
        review_row_line(line, label, relation, verdict)


# ---------------------------------------------------------------- label-expression-parts

def term_of(text):
    """('term', coefficient, variable, exponent) or ('num', value) for one monomial in TeX."""
    text = text.strip()
    match = re.fullmatch(r"(-?)(\d*)([a-z])(?:\^(\d+))?", text)
    if match:
        sign, digits, variable, exponent = match.groups()
        require(digits != "1" and not digits.startswith("0"), f"Noncanonical coefficient: {text}")
        coefficient = F(int(digits) if digits else 1) * (-1 if sign else 1)
        require(exponent is None or int(exponent) >= 2, f"Noncanonical exponent: {text}")
        return ("term", coefficient, variable, int(exponent) if exponent else 1)
    match = re.fullmatch(r"-?\d+", text)
    require(match is not None and not re.fullmatch(r"-?0\d+", text), f"Not a monomial: {text}")
    return ("num", F(int(text)))


def sum_of(text):
    """Terms of a TeX sum such as `8x^2 + 6x + 3` or `x - 4`, signs folded into the terms."""
    pieces = re.split(r" ([+-]) ", text.strip())
    terms = [term_of(pieces[0])]
    for sign, piece in zip(pieces[1::2], pieces[2::2]):
        require(not piece.startswith("-"), f"Doubled sign in {text}")
        terms.append(term_of(("-" if sign == "-" else "") + piece))
    return terms


def tex_term(term):
    if term[0] == "num":
        return str(term[1])
    _, c, v, e = term
    lead = "" if c == 1 else "-" if c == -1 else str(c)
    return lead + v + (f"^{e}" if e > 1 else "")


def read_expression(prompt):
    match = re.fullmatch(r"Label the parts of the expression \$(.+)\$\.", prompt)
    require(match is not None, f"Unknown expression prompt: {prompt}")
    body = match[1]
    product = re.fullmatch(r"(-?\d+)\((.+)\)", body)
    if product:
        factor = term_of(product[1])
        inner = sum_of(product[2])
        require(len(inner) >= 2, "The parenthesized factor is not a sum")
        require(factor[1] not in (0, 1), "A unit factor hides the product")
        return {"kind": "product", "factor": factor, "inner": inner, "text": body}
    terms = sum_of(body)
    require(len(terms) >= 2, "A single term is not a sum")
    monomials = [(t[2], t[3]) for t in terms if t[0] == "term"]
    require(len(monomials) == len(set(monomials)) and sum(t[0] == "num" for t in terms) <= 1,
            "Like terms are not combined")
    require(all(t[1] != 0 for t in terms), "Zero term")
    return {"kind": "sum", "terms": terms, "text": body}


def option_value(label):
    """What a slot option names: a number, a monomial, a sum, or an operation word."""
    match = re.fullmatch(r"\$(.+)\$", label)
    if match is None:
        require(label in {"sum", "difference", "product", "quotient"}, f"Unknown word option: {label}")
        return ("word", label)
    body = match[1]
    if re.search(r" [+-] ", body):
        return ("sum", frozenset(sum_of(body)))
    return term_of(body)


def slot_part(expression, label):
    """The correct part for one slot label, derived from the parsed expression."""
    if expression["kind"] == "product":
        if label == "the kind of expression":
            return ("word", "product")
        if label == "the factor that is a sum":
            return ("sum", frozenset(expression["inner"]))
        if label == "the number of terms in the sum":
            return ("num", F(len(expression["inner"])))
        raise ValueError(f"Unknown product slot: {label}")
    terms = expression["terms"]
    if label == "the constant term":
        constants = [t for t in terms if t[0] == "num"]
        require(len(constants) == 1, "No constant term")
        return constants[0]
    if label == "the number of terms":
        return ("num", F(len(terms)))
    if label == "the kind of expression":
        return ("word", "sum")
    match = re.fullmatch(r"the coefficient of \$([a-z])(?:\^(\d+))?\$", label)
    if match:
        exponent = int(match[2] or 1)
        hits = [t for t in terms if t[0] == "term" and (t[2], t[3]) == (match[1], exponent)]
        require(len(hits) == 1, f"No single term in {label}")
        return ("num", hits[0][1])
    match = re.fullmatch(r"the term containing \$([a-z])\$", label)
    if match:
        hits = [t for t in terms if t[0] == "term" and t[2] == match[1]]
        require(len(hits) == 1, f"Not one term contains {match[1]}")
        return hits[0]
    match = re.fullmatch(r"the exponent in \$(.+)\$", label)
    if match:
        term = term_of(match[1])
        require(term in terms and term[0] == "term" and term[3] > 1, "The exponent's term is not in the expression")
        return ("num", F(term[3]))
    raise ValueError(f"Unknown slot: {label}")


def solve_parts(public):
    response = public["response"]
    blanks = common_response(response, "slots", "Choose the part that matches each label")
    expression = read_expression(public["prompt"])
    key = {}
    for blank in blanks:
        key[blank["id"]] = pick(blank, slot_part(expression, blank["label"]), option_value)
    return compact(key), expression


def review_parts_explanation(problem, expression):
    explanation, hint = checked_text(problem)
    text = " ".join(explanation)
    if expression["kind"] == "product":
        factor, inner = tex_term(expression["factor"]), " + ".join(tex_term(t) for t in expression["inner"])
        inner = re.sub(r"\+ -", "- ", inner)
        require(f"the last operation is multiplication, so it is a product of two factors, ${factor}$ and ${'(' + inner + ')'}$"
                in text, "Explanation must name the product's factors")
        require(f"The factor $({inner})$ is a sum." in text, "Explanation must name the sum")
        listed = [f"${tex_term(t)}$" for t in expression["inner"]]
        require(f"That sum has {len(listed)} terms, {', '.join(listed[:-1])} and {listed[-1]}." in text,
                "Explanation must count the sum's terms")
        require(hint == f"In ${expression['text']}$, the number {factor} written next to the parentheses multiplies "
                "them. Decide what the last operation is, then look inside the parentheses.", "Product hint")
        return
    terms = expression["terms"]
    squares = [t for t in terms if t[0] == "term" and t[3] == 2]
    if squares:
        expected_hint = (f"In the term ${tex_term(squares[0])}$, the coefficient multiplies the power and the exponent "
                         f"says how many factors of ${squares[0][2]}$ there are. The constant term of "
                         f"${expression['text']}$ has no variable.")
    else:
        expected_hint = (f"The terms of ${expression['text']}$ are the parts joined by $+$. A coefficient is the "
                         "number that multiplies a variable, and the constant term has no variable.")
    require(len(squares) <= 1 and hint == expected_hint, "Hint must name this problem's expression and no answer")
    listed = [f"${tex_term(t)}$" for t in terms]
    require(f"{', '.join(listed[:-1])} and {listed[-1]}" in text, "Explanation must list the terms")
    for count in re.findall(r"there are (\d+) terms", text):
        require(int(count) == len(terms), "False term count")
    for variable, value in re.findall(r"The coefficient of \$([a-z])\$ is (?:the number multiplying it: )?\$(-?\d+)\$", text):
        require(slot_part(expression, f"the coefficient of ${variable}$") == ("num", F(int(value))), "False coefficient")
    for variable, term, value in re.findall(
            r"The term containing \$([a-z])\$ is the whole term \$([^$]+)\$; its coefficient is \$(-?\d+)\$", text):
        part = slot_part(expression, f"the term containing ${variable}$")
        require(part == term_of(term) and part[1] == int(value), "False term")
    for term, coefficient, exponent in re.findall(
            r"In \$([^$]+)\$, the coefficient is \$(-?\d+)\$ and the exponent is \$(\d+)\$", text):
        parsed = term_of(term)
        require(parsed in terms and parsed[1] == int(coefficient) and parsed[3] == int(exponent), "False power term")
    for value in re.findall(r"The constant term has no variable: \$(-?\d+)\$", text):
        require(slot_part(expression, "the constant term") == ("num", F(int(value))), "False constant")
    labels = [b["label"] for b in problem["public"]["response"]["blanks"]]
    for label in labels:
        if label == "the constant term":
            require("The constant term has no variable:" in text, "Explanation must state the constant")
        elif label.startswith("the coefficient of $") and "^" not in label:
            require(re.search(r"The coefficient of " + re.escape(label[len("the coefficient of "):]), text),
                    f"Explanation must state {label}")
        elif label.startswith("the term containing"):
            require(("The " + label[4:]) in text, f"Explanation must state {label}")
        elif label.startswith("the exponent in") or label.startswith("the coefficient of $") and "^" in label:
            require(re.search(r"In \$[^$]+\$, the coefficient is \$-?\d+\$ and the exponent is \$\d+\$", text),
                    f"Explanation must state {label}")
        elif label == "the number of terms":
            require(re.search(r"there are \d+ terms", text), "Explanation must count the terms")


# ---------------------------------------------------------------- entry points

def solve(public):
    template = public["templateId"]
    require(template in SUPPORTED, "Wrong family")
    if template == "inline-linear-features":
        return solve_line(public)[0]
    if template == "proportional-match-table":
        return solve_proportional(public)[0]
    return solve_parts(public)[0]


def review_problem(problem):
    public = problem["public"]
    template = public["templateId"]
    require(template in SUPPORTED, "Wrong family")
    require(public["response"].get("kind") == "multi-part-choice", "Response protocol")
    if template == "inline-linear-features":
        expected, (variant, points, m, b, ids) = solve_line(public)
        review_line_explanation(problem, variant, points, m, b, ids)
    elif template == "proportional-match-table":
        expected, rows = solve_proportional(public)
        review_proportional_explanation(problem, rows)
    else:
        expected, expression = solve_parts(public)
        review_parts_explanation(problem, expression)
    answer = problem["answer"]
    require(isinstance(answer, str) and answer == expected, f"Answer {answer} disagrees with the wording; expected {expected}")
    key = json.loads(answer)
    require(list(key) == [b["id"] for b in public["response"]["blanks"]], "Answer keys follow blank order")
    return expected


# ---------------------------------------------------------------- self test

def options(*labels):
    return [{"id": OPTION_IDS[i], "label": label} for i, label in enumerate(labels)]


def fixture(template, prompt, response, answer, explanation, hint, figure=None):
    public = {"templateId": template, "seed": "fixture", "prompt": prompt, "response": response}
    if figure is not None:
        public["figure"] = figure
    return {"public": public, "answer": answer, "explanation": explanation, "hint": hint}


def handwritten():
    cases = {}
    features = lambda slope, intercept: {  # noqa: E731
        "kind": "multi-part-choice", "label": "Choose an option for each blank", "layout": "inline",
        "blanks": [{"id": "slope", "label": "the slope", "options": options(*slope)},
                   {"id": "int", "label": "the $y$-intercept", "options": options(*intercept)},
                   {"id": "dir", "label": "the direction of change",
                    "options": options("increases", "decreases", "stays the same")}],
        "sentence": copy.deepcopy(SENTENCES[("slope", "int", "dir")])}
    equation = lambda slope, intercept: {  # noqa: E731
        "kind": "multi-part-choice", "label": "Choose an option for each blank", "layout": "inline",
        "blanks": [{"id": "m", "label": "$m$", "options": options(*slope)},
                   {"id": "b", "label": "$b$", "options": options(*intercept)}],
        "sentence": copy.deepcopy(SENTENCES[("m", "b")])}
    cases["table"] = fixture(
        "inline-linear-features", "The table shows four points on a line. Complete the sentence about the line.",
        features(["$5$", "$\\frac{2}{3}$", "$\\frac{3}{2}$", "$-\\frac{3}{2}$"], ["$11$", "$-\\frac{10}{3}$", "$5$", "$-5$"]),
        '{"slope":"c","int":"c","dir":"a"}',
        ["The slope is the change in $y$ divided by the change in $x$. From $(4, 11)$ to $(10, 20)$: "
         "$m = \\frac{20 - 11}{10 - 4} = \\frac{9}{6} = \\frac{3}{2}$.",
         "Substitute $(4, 11)$ into $y = mx + b$: $11 = \\frac{3}{2} \\cdot 4 + b$, so $b = 11 - 6 = 5$.",
         "The slope is positive, so $y$ increases as $x$ increases."],
        "Take the rows for $x = 4$ and $x = 10$: the slope is the change in $y$ divided by the change in $x$. Then "
        "work back to $x = 0$ to find the $y$-intercept.",
        {"kind": "scene", "scene": {"v": 1, "title": "A table of four points on a line", "elements": [
            {"id": "t", "type": "table", "columns": ["y"], "corner": "x", "math": True, "rows": [
                {"label": "4", "cells": [11]}, {"label": "6", "cells": [14]}, {"label": "8", "cells": [17]},
                {"label": "10", "cells": [20]}]}]}})
    cases["graph"] = fixture(
        "inline-linear-features",
        "The graph shows a line through $A(-3, -3)$ and $B(3, -5)$. Complete the sentence about the line.",
        equation(["$-\\frac{1}{3}$", "$\\frac{1}{3}$", "$-4$", "$-3$"], ["$-4$", "$-12$", "$-3$", "$4$"]),
        '{"m":"a","b":"a"}',
        ["The slope is the change in $y$ divided by the change in $x$. From $(-3, -3)$ to $(3, -5)$: "
         "$m = \\frac{-5 - (-3)}{3 - (-3)} = \\frac{-2}{6} = -\\frac{1}{3}$.",
         "Substitute $(-3, -3)$ into $y = mx + b$: $-3 = -\\frac{1}{3} \\cdot (-3) + b$, so $b = -3 - 1 = -4$.",
         "The equation is $y = -\\frac{1}{3}x - 4$."],
        "Read where the line crosses the $y$-axis for the $y$-intercept. For the slope, count the rise and the run "
        "from $A(-3, -3)$ to $B(3, -5)$.",
        {"kind": "scene", "scene": {"v": 1, "title": "A line through points A and B on a coordinate grid",
                                    "elements": [{
            "id": "plot", "type": "graph", "x": [-6, 6], "y": [-6, 6], "grid": 1, "tick": 1, "aspect": 1,
            "axisNames": ["x", "y"],
            "points": [{"x": -3, "y": -3, "label": "A", "color": "ink"}, {"x": 3, "y": -5, "label": "B", "color": "ink"}],
            "lines": [{"line": {"through": [[-3, -3], [3, -5]]}, "color": "accent"}]}]}})
    cases["points"] = fixture(
        "inline-linear-features",
        "A line passes through the points $(0, -3)$ and $(4, 3)$. Complete the sentence about the line.",
        features(["$-\\frac{3}{2}$", "$\\frac{3}{2}$", "$-3$", "$\\frac{2}{3}$"], ["$\\frac{3}{2}$", "$2$", "$-3$", "$3$"]),
        '{"slope":"b","int":"c","dir":"a"}',
        ["The slope is the change in $y$ divided by the change in $x$. From $(0, -3)$ to $(4, 3)$: "
         "$m = \\frac{3 - (-3)}{4 - 0} = \\frac{6}{4} = \\frac{3}{2}$.",
         "The point $(0, -3)$ is on the $y$-axis, so the $y$-intercept is $b = -3$.",
         "The slope is positive, so $y$ increases as $x$ increases."],
        "Divide the change in $y$ by the change in $x$ from $(0, -3)$ to $(4, 3)$ for the slope. Then put one point "
        "and the slope into $y = mx + b$ to find $b$.")
    rows = ["$y = \\frac{x}{6}$", "$(1, 5), (2, 8), (3, 11)$", "$y = 4(x + 4)$", "$y = x^2$",
            "$3y = 12x$", "$y = 2(x + 3) - 6$"]
    cases["proportional"] = fixture(
        "proportional-match-table", "Decide whether each relationship between $x$ and $y$ is proportional.",
        {"kind": "multi-part-choice", "label": "Choose one column in each row", "layout": "table",
         "rowHeader": "Relationship",
         "blanks": [{"id": f"r{i + 1}", "label": row, "options": copy.deepcopy(VERDICTS)} for i, row in enumerate(rows)]},
        '{"r1":"a","r2":"b","r3":"b","r4":"b","r5":"a","r6":"a"}',
        [PROPORTIONAL_LEAD,
         "$y = \\frac{x}{6}$: proportional. Dividing by 6 is multiplying by $\\frac{1}{6}$, so $y = \\frac{1}{6}x$.",
         "$(1, 5), (2, 8), (3, 11)$: not proportional. $\\frac{5}{1} \\ne \\frac{8}{2}$, so the ratio "
         "$\\frac{y}{x}$ is not constant.",
         "$y = 4(x + 4)$: not proportional. It simplifies to $y = 4x + 16$; when $x = 0$, $y = 16$.",
         "$y = x^2$: not proportional. $\\frac{y}{x} = x$ changes with $x$: $x = 1$ gives $y = 1$ and $x = 2$ "
         "gives $y = 4$, not twice as much.",
         "$3y = 12x$: proportional. Dividing both sides by 3 gives $y = 4x$.",
         "$y = 2(x + 3) - 6$: proportional. It simplifies to $y = 2x + 6 - 6 = 2x$."],
        "A proportional relationship can be written as $y = kx$: every pair has the same ratio $\\frac{y}{x}$, "
        "and $x = 0$ gives $y = 0$. Start with $y = \\frac{x}{6}$: simplify it, or compare its ratios, before you "
        "decide.")
    rows2 = ["$y = \\frac{12}{x}$", "$(2, 6)$, $(4, 12)$, $(5, 15)$", "$y = 3x - 2$", "$y = \\frac{2}{5}x$"]
    cases["proportional-pairs"] = fixture(
        "proportional-match-table", "Decide whether each relationship between $x$ and $y$ is proportional.",
        {"kind": "multi-part-choice", "label": "Choose one column in each row", "layout": "table",
         "rowHeader": "Relationship",
         "blanks": [{"id": f"r{i + 1}", "label": row, "options": copy.deepcopy(VERDICTS)} for i, row in enumerate(rows2)]},
        '{"r1":"b","r2":"a","r3":"b","r4":"a"}',
        [PROPORTIONAL_LEAD,
         "$y = \\frac{12}{x}$: not proportional. As $x$ doubles, $y$ halves, so $\\frac{y}{x}$ is not constant.",
         "$(2, 6)$, $(4, 12)$, $(5, 15)$: proportional. Every pair has $\\frac{y}{x} = 3$.",
         "$y = 3x - 2$: not proportional. When $x = 0$, $y = -2$, not 0, so the line misses the origin.",
         "$y = \\frac{2}{5}x$: proportional. It has the form $y = kx$ with $k = \\frac{2}{5}$."],
        "A proportional relationship can be written as $y = kx$: every pair has the same ratio $\\frac{y}{x}$, "
        "and $x = 0$ gives $y = 0$. Start with $y = \\frac{12}{x}$: simplify it, or compare its ratios, before you "
        "decide.")
    quad = options("$x^2$", "$8$", "$3$", "$6$", "$2$", "$6x$")
    cases["quadratic"] = fixture(
        "label-expression-parts", "Label the parts of the expression $8x^2 + 6x + 3$.",
        {"kind": "multi-part-choice", "label": "Choose the part that matches each label", "layout": "slots",
         "blanks": [{"id": "coefsq", "label": "the coefficient of $x^2$", "options": copy.deepcopy(quad)},
                    {"id": "power", "label": "the exponent in $8x^2$", "options": copy.deepcopy(quad)},
                    {"id": "coef", "label": "the coefficient of $x$", "options": copy.deepcopy(quad)},
                    {"id": "const", "label": "the constant term", "options": copy.deepcopy(quad)}]},
        '{"coefsq":"b","power":"e","coef":"d","const":"c"}',
        ["The terms are $8x^2$, $6x$ and $3$.",
         "In $8x^2$, the coefficient is $8$ and the exponent is $2$: $8x^2 = 8 \\cdot x \\cdot x$.",
         "The coefficient of $x$ is $6$, from the term $6x$.", "The constant term has no variable: $3$."],
        "In the term $8x^2$, the coefficient multiplies the power and the exponent says how many factors of $x$ "
        "there are. The constant term of $8x^2 + 6x + 3$ has no variable.")
    linear = options("$p$", "$8$", "$3$", "$8q$", "$3p$", "$6$")
    cases["linear"] = fixture(
        "label-expression-parts", "Label the parts of the expression $3p + 8q + 6$.",
        {"kind": "multi-part-choice", "label": "Choose the part that matches each label", "layout": "slots",
         "blanks": [{"id": "coef", "label": "the coefficient of $p$", "options": copy.deepcopy(linear)},
                    {"id": "term", "label": "the term containing $q$", "options": copy.deepcopy(linear)},
                    {"id": "const", "label": "the constant term", "options": copy.deepcopy(linear)},
                    {"id": "count", "label": "the number of terms", "options": options("$2$", "$3$", "$4$")}]},
        '{"coef":"c","term":"d","const":"f","count":"b"}',
        ["The terms are the parts joined by $+$: $3p$, $8q$ and $6$, so there are 3 terms.",
         "The coefficient of $p$ is the number multiplying it: $3$.",
         "The term containing $q$ is the whole term $8q$; its coefficient is $8$.",
         "The constant term has no variable: $6$."],
        "The terms of $3p + 8q + 6$ are the parts joined by $+$. A coefficient is the number that multiplies a "
        "variable, and the constant term has no variable.")
    cases["product"] = fixture(
        "label-expression-parts", "Label the parts of the expression $2(n + 8)$.",
        {"kind": "multi-part-choice", "label": "Choose the part that matches each label", "layout": "slots",
         "blanks": [{"id": "whole", "label": "the kind of expression",
                     "options": options("quotient", "sum", "difference", "product")},
                    {"id": "sum", "label": "the factor that is a sum", "options": options("$n + 8$", "$n$", "$2$", "$8$")},
                    {"id": "count", "label": "the number of terms in the sum", "options": options("$1$", "$2$", "$3$")}]},
        '{"whole":"d","sum":"a","count":"b"}',
        ["$2(n + 8)$ means $2 \\cdot (n + 8)$: the last operation is multiplication, so it is a product of two "
         "factors, $2$ and $(n + 8)$.", "The factor $(n + 8)$ is a sum.", "That sum has 2 terms, $n$ and $8$."],
        "In $2(n + 8)$, the number 2 written next to the parentheses multiplies them. Decide what the last operation "
        "is, then look inside the parentheses.")
    return cases


def expect_rejected(problem, what):
    try:
        review_problem(problem)
    except (ValueError, KeyError, TypeError, ZeroDivisionError, AttributeError):
        return 1
    raise AssertionError(f"Accepted corrupt multi-part choice case: {what}")


def self_test():
    cases = handwritten()
    for case in cases.values():
        review_problem(case)
    require(tex_number("$-\\frac{10}{3}$") == F(-10, 3) and tex_number("$0$") == 0, "Number options")
    require(evaluate(tex_tree("\\frac{-5 - (-3)}{3 - (-3)}"), {}) == F(-1, 3), "Fraction arithmetic")
    require(proportional(relation_of("$y = 3(x + 2) - 6$")) and not proportional(relation_of("$y = 2x^2$")),
            "Proportionality")
    require(proportional(relation_of("$2y = 8x$")) and not proportional(relation_of("$y = \\frac{12}{x}$")),
            "Equation forms")
    require(not proportional(relation_of("$(0, 2), (1, 3), (2, 6)$")), "Pairs off the origin")
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

    # Answer key form and value.
    mutate("table", setter("answer", value='{"slope":"d","int":"c","dir":"a"}'), "slope sign flipped")
    mutate("table", setter("answer", value='{"slope":"c","int":"c","dir":"b"}'), "wrong direction")
    mutate("table", setter("answer", value='{"int":"c","slope":"c","dir":"a"}'), "keys out of blank order")
    mutate("table", setter("answer", value='{"slope": "c","int":"c","dir":"a"}'), "noncompact answer")
    mutate("table", setter("answer", value='{"slope":"c","int":"c"}'), "missing blank")
    mutate("table", setter("answer", value='{"slope":"c","int":"c","dir":"a","x":"a"}'), "extra blank")
    # Options: a second correct option, a non-canonical value, a missing correct option.
    mutate("table", setter("public", "response", "blanks", 0, "options", 0, "label", value="$\\frac{6}{4}$"),
           "unreduced duplicate of the slope")
    mutate("table", setter("public", "response", "blanks", 1, "options", 0, "label", value="$5.0$"), "decimal label")
    mutate("table", setter("public", "response", "blanks", 1, "options", 2, "label", value="$6$"), "no correct intercept")
    mutate("table", setter("public", "response", "blanks", 0, "options", 3, "id", value="e"), "option id gap")
    mutate("table", setter("public", "response", "blanks", 2, "options", 0, "label", value="rises"), "unknown direction")
    # Figure and wording.
    table_rows = ("public", "figure", "scene", "elements", 0, "rows")
    mutate("table", setter(*table_rows, 3, "cells", value=[21]), "table not collinear")
    mutate("table", setter(*table_rows, 1, "label", value="4"), "repeated x")
    mutate("table", setter(*table_rows, 1, "label", value="6.5"), "non-integer x label")
    mutate("table", setter(*table_rows, 0, "label", value="-4"), "hyphen for a minus sign")
    mutate("table", setter("public", "figure", "scene", "elements", 0, "corner", value="t"), "table corner")
    mutate("table", setter("public", "figure", "kind", value="function-display"), "not a scene")
    mutate("table", setter("public", "response", "sentence", 1, value={"blank": "int"}), "sentence blank order")
    mutate("table", setter("public", "response", "blanks", 1, "label", value="the intercept"), "blank label")
    plot = ("public", "figure", "scene", "elements", 0)
    mutate("graph", setter(*plot, "points", 1, "y", value=-4), "figure point disagrees with prompt")
    mutate("graph", setter(*plot, "points", 0, "label", value="B"), "figure labels swapped")
    mutate("graph", setter(*plot, "lines", 0, "line", "through", 1, value=[3, -4]), "drawn line misses the points")
    mutate("graph", setter(*plot, "lines", 0, "line", "through", 1, value=[-3, -3]), "degenerate drawn line")
    mutate("graph", setter(*plot, "y", value=[-3, 6]), "intercept off the graph")
    mutate("graph", setter(*plot, "type", value="table"), "graph prompt with a table scene")
    mutate("graph", setter("public", "prompt", value="The graph shows a line through $A(-3, -3)$ and $B(3, -1)$. "
                           "Complete the sentence about the line."), "prompt point moved")
    mutate("points", setter("public", "prompt", value="A line passes through the points $(0, -3)$ and $(0, 3)$. "
                            "Complete the sentence about the line."), "vertical line")
    # Explanation claims.
    mutate("table", setter("explanation", 0, value="The slope is the change in $y$ divided by the change in $x$. "
                           "From $(4, 11)$ to $(10, 20)$: $m = \\frac{20 - 11}{10 - 4} = \\frac{9}{6} = \\frac{2}{3}$."),
           "explanation states a wrong slope")
    mutate("table", setter("explanation", 1, value="Substitute $(4, 11)$ into $y = mx + b$: "
                           "$11 = \\frac{3}{2} \\cdot 4 + b$, so $b = 11 - 6 = 4$."), "explanation states a wrong b")
    mutate("table", setter("explanation", 2, value="The slope is negative, so $y$ decreases as $x$ increases."),
           "explanation direction")
    mutate("table", lambda p: p["explanation"].pop(1), "explanation omits the intercept")
    mutate("graph", setter("explanation", 2, value="The equation is $y = -\\frac{1}{3}x + 4$."), "wrong equation")
    mutate("points", setter("explanation", 1, value="The point $(0, 3)$ is on the $y$-axis, so the $y$-intercept "
                            "is $b = 3$."), "wrong intercept point")
    mutate("points", setter("hint", value=""), "empty hint")
    mutate("points", setter("hint", value=cases["graph"]["hint"]), "hint for another representation")
    mutate("graph", setter("hint", value=cases["graph"]["hint"].replace("B(3, -5)", "B(3, -4)")), "hint names other points")
    mutate("table", setter("hint", value=cases["table"]["hint"].replace("x = 10", "x = 8")), "hint names other rows")
    mutate("points", setter("hint", value=cases["points"]["hint"] + " The slope is $\\frac{3}{2}$."), "hint states the answer")
    mutate("proportional", setter("hint", value=cases["proportional"]["hint"].replace("\\frac{x}{6}", "x^2")),
           "hint names another row")
    mutate("quadratic", setter("hint", value=cases["quadratic"]["hint"].replace("$8x^2$,", "$6x$,")), "hint names another term")
    mutate("linear", setter("hint", value=cases["linear"]["hint"] + " Here the coefficient of $p$ is $3$."),
           "hint states a coefficient")
    mutate("product", setter("hint", value=cases["product"]["hint"].replace("number 2", "number 8")), "hint names another factor")
    # Proportional table.
    mutate("proportional", setter("answer", value='{"r1":"a","r2":"a","r3":"b","r4":"b","r5":"a","r6":"a"}'),
           "non-proportional pairs marked proportional")
    mutate("proportional", setter("answer", value='{"r1":"a","r2":"b","r3":"b","r4":"b","r5":"a","r6":"b"}'),
           "simplifying form marked not proportional")
    mutate("proportional", setter("public", "response", "blanks", 1, "options", value=list(reversed(VERDICTS))),
           "rows with different columns")
    mutate("proportional", setter("public", "response", "rowHeader", value="Equation"), "row header")
    mutate("proportional", setter("public", "response", "blanks", 3, "label", value="$y = x$"),
           "row changed under a fixed key")
    mutate("proportional", setter("explanation", 3, value="$y = 4(x + 4)$: proportional. It simplifies to $y = 4x$."),
           "explanation verdict and rewrite")
    mutate("proportional", setter("explanation", 3, value="$y = 4(x + 4)$: not proportional. It simplifies to "
                                  "$y = 4x + 4$; when $x = 0$, $y = 4$."), "false simplification")
    mutate("proportional", setter("explanation", 4, value="$y = x^2$: not proportional. $\\frac{y}{x} = x$ changes "
                                  "with $x$: $x = 1$ gives $y = 1$ and $x = 2$ gives $y = 2$, not twice as much."),
           "false evaluated point")
    mutate("proportional", setter("explanation", 5, value="$3y = 12x$: proportional. Dividing both sides by 3 gives "
                                  "$y = 3x$."), "false division")
    mutate("proportional", lambda p: p["explanation"].pop(), "explanation omits a row")
    mutate("proportional-pairs", setter("explanation", 2, value="$(2, 6)$, $(4, 12)$, $(5, 15)$: proportional. Every "
                                        "pair has $\\frac{y}{x} = 2$."), "false ratio")
    mutate("proportional-pairs", setter("explanation", 4, value="$y = \\frac{2}{5}x$: proportional. It has the form "
                                        "$y = kx$ with $k = \\frac{5}{2}$."), "false k")
    mutate("proportional-pairs", setter("public", "response", "blanks", 1, "label", value="$(2, 6)$, $(4, 12)$, $(5, 16)$"),
           "pair breaks the ratio")
    # Expression parts.
    mutate("quadratic", setter("answer", value='{"coefsq":"e","power":"b","coef":"d","const":"c"}'),
           "coefficient and exponent swapped")
    mutate("quadratic", setter("answer", value='{"coefsq":"b","power":"e","coef":"f","const":"c"}'),
           "term for coefficient")
    mutate("quadratic", setter("public", "prompt", value="Label the parts of the expression $8x^2 + 6x + 2$."),
           "prompt changed under a fixed key and explanation")
    mutate("quadratic", setter("public", "response", "blanks", 1, "label", value="the exponent in $6x^2$"),
           "exponent of a term that is not there")
    mutate("quadratic", setter("explanation", 2, value="The coefficient of $x$ is $8$, from the term $6x$."),
           "false coefficient")
    mutate("quadratic", setter("explanation", 0, value="The terms are $8x^2$ and $6x$."), "terms not listed")
    mutate("linear", setter("public", "response", "blanks", 0, "options", 0, "label", value="$3$"), "repeated option")
    mutate("linear", setter("public", "response", "blanks", 3, "label", value="the number of factors"), "unknown slot")
    mutate("linear", setter("explanation", 0, value="The terms are the parts joined by $+$: $3p$, $8q$ and $6$, so "
                            "there are 2 terms."), "false count")
    mutate("linear", setter("explanation", 2, value="The term containing $q$ is the whole term $3p$; its coefficient "
                            "is $3$."), "false term")
    mutate("linear", setter("public", "response", "sentence", value=[{"text": "x"}, {"blank": "coef"}]),
           "slots with a sentence")
    mutate("product", setter("answer", value='{"whole":"b","sum":"a","count":"b"}'), "product called a sum")
    mutate("product", setter("public", "response", "blanks", 1, "options", 1, "label", value="$8 + n$"),
           "commuted sum: two correct options")
    mutate("product", setter("answer", value='{"whole":"d","sum":"a","count":"c"}'), "term count")
    mutate("product", setter("explanation", 2, value="That sum has 3 terms, $n$ and $8$."), "false sum count")
    return {"handwritten_cases": len(cases), "mutations": mutations}


if __name__ == "__main__":
    print(self_test())
