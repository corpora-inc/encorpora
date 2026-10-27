"""Independent review of the figure-choice format families (paired values,
signed point, shifted graph) from public payloads and figure data only.

The correct graph is decided from the prompt and the shown table or graph with
exact Fractions; every option's SCENE (never its description or the private
answer) is read back into the same form and exactly one may match. Each
description is then checked against its own scene.
"""

import json
import re
import sys
from fractions import Fraction as F
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from figure_choice_math_oracle import (  # noqa: E402
    IDS, LETTERS, MINUS, NAMES, PLACEHOLDER, REVEALING,
    frame, option_element, require, scene_number, text_number, texts, window,
)

SUPPORTED = frozenset({"graph-of-paired-values", "point-on-signed-grid", "graph-after-shift"})
NUM = r"[−-]?\d+(?:\.\d+)?"
POINT = rf"\(({NUM}), ({NUM})\)"


def drawn_points(element):
    return sorted((scene_number(p["x"]), scene_number(p["y"])) for p in element.get("points", []))


def only_points(element):
    require(element["type"] == "graph", "Graph option must draw a graph")
    for key in ("lines", "curves", "segments", "regions", "circles"):
        require(not element.get(key), f"A points graph draws {key}")


# ------------------------------------------------------------ paired values

def table_pairs(public):
    elements = public["figure"]["scene"]["elements"]
    require(len(elements) == 1 and elements[0]["type"] == "lineTable", "Table prompt without a table")
    rows = elements[0]["rows"]
    require(len(rows) == 2 and rows[0][0] == "x" and rows[1][0] == "y", "Table must list x then y")
    xs = [text_number(v) for v in rows[0][1:]]
    ys = [text_number(v) for v in rows[1][1:]]
    require(len(xs) == len(ys) >= 3 and xs == sorted(set(xs)), "Table needs increasing x values")
    return sorted(zip(xs, ys))


def target_paired(public):
    prompt = public["prompt"]
    if re.fullmatch(r"The table shows \$x\$, [^$]+, and \$y\$, [^$]+\. Which graph plots every pair in the table\?", prompt):
        return table_pairs(public)
    require(public.get("figure") is None, "Rule prompt with a figure")
    match = re.fullmatch(r"[^$]+, \$y\$, is (\d+(?:\.\d+)?) times [^$]+, \$x\$\. Which graph shows the pairs for (.+)\?", prompt)
    if match:
        c, xs = F(match.group(1)), [F(v) for v in re.findall(r"\$x = (\d+)\$", match.group(2))]
        require(len(xs) >= 3, "Rule needs three x values")
        return sorted((x, c * x) for x in xs)
    match = re.fullmatch(r"[^$]+, \$y\$, is (\d+) (less|more) than [^$]+, \$x\$\. Which graph shows the pairs for (.+)\?", prompt)
    require(match is not None, f"Unrecognized prompt {prompt!r}")
    n = F(match.group(1)) * (-1 if match.group(2) == "less" else 1)
    xs = [F(v) for v in re.findall(r"\$x = (\d+)\$", match.group(3))]
    require(len(xs) >= 3, "Rule needs three x values")
    return sorted((x, x + n) for x in xs)


def read_points(label):
    match = re.fullmatch(r"Points at (.+)\.", label)
    require(match is not None, f"Unrecognized description {label!r}")
    found = [(text_number(a), text_number(b)) for a, b in re.findall(POINT, match.group(1))]
    require(len(found) >= 2 and re.sub(POINT, "", match.group(1)).replace(",", "").replace("and", "").strip() == "", f"Unreadable points {label!r}")
    return sorted(found)


# ------------------------------------------------------------ signed point

def target_signed(public):
    prompt = public["prompt"]
    match = re.fullmatch(r"Which graph shows the point \$\((-?\d+), (-?\d+)\)\$\?", prompt)
    if match:
        return [(F(match.group(1)), F(match.group(2)))]
    match = re.fullmatch(
        r"Which graph shows the point that is (\d+) units? (to the left of|to the right of) the \$y\$-axis and (\d+) units? (below|above) the \$x\$-axis\?",
        prompt)
    require(match is not None, f"Unrecognized prompt {prompt!r}")
    x = F(match.group(1)) * (-1 if match.group(2) == "to the left of" else 1)
    y = F(match.group(3)) * (-1 if match.group(4) == "below" else 1)
    return [(x, y)]


# ------------------------------------------------------------ shifted graph

def function_of(element):
    """A function of x read from a graph element: x -> value or None."""
    parts = []
    for line in element.get("lines", []):
        spec = line["line"]
        require("m" in spec, "Lines are drawn by slope and intercept")
        m, b = scene_number(spec["m"]), scene_number(spec["b"])
        parts.append(lambda x, m=m, b=b: m * x + b)
    for curve in element.get("curves", []):
        fn = curve["fn"]
        if fn["f"] == "poly":
            c = [scene_number(v) for v in fn["c"]]
            parts.append(lambda x, c=c: sum(v * x ** i for i, v in enumerate(c)))
        elif fn["f"] == "abs":
            a, h, k = (scene_number(fn.get(key, 0)) for key in ("a", "h", "k"))
            parts.append(lambda x, a=a, h=h, k=k: a * abs(x - h) + k)
        else:
            raise ValueError(f"Unsupported curve {fn['f']}")
    segments = element.get("segments", [])
    if segments:
        chain = [(tuple(scene_number(v) for v in s["from"]), tuple(scene_number(v) for v in s["to"])) for s in segments]
        for (_, end), (start, _) in zip(chain, chain[1:]):
            require(end == start, "Zigzag segments must join")

        def zig(x, chain=chain):
            for (p, q) in chain:
                if p[0] <= x <= q[0]:
                    return p[1] + (q[1] - p[1]) * (x - p[0]) / (q[0] - p[0])
            return None
        parts.append(zig)
    require(len(parts) == 1, "A graph draws exactly one function")
    return parts[0]


SAMPLES = [F(i, 2) for i in range(-12, 13)]


def profile(function):
    return tuple(function(x) for x in SAMPLES)


def read_move(prompt):
    """(h, k): h right and k up, from words or from f(x - h) + k."""
    match = re.fullmatch(r"The graph of \$y = f\(x\)\$ is shown\. Which graph shows \$y = f\((x(?: [-+] \d+)?)\)(?: ([-+]) (\d+))?\$\?", prompt)
    if match:
        inner = re.fullmatch(r"x(?: ([-+]) (\d+))?", match.group(1))
        h = F(0) if inner.group(1) is None else (F(inner.group(2)) if inner.group(1) == "-" else -F(inner.group(2)))
        k = F(0) if match.group(2) is None else (F(match.group(3)) if match.group(2) == "+" else -F(match.group(3)))
        return h, k
    match = re.fullmatch(r"The graph of \$y = f\(x\)\$ is shown\. Which graph shows the graph of \$f\$ moved (.+)\?", prompt)
    require(match is not None, f"Unrecognized prompt {prompt!r}")
    h, k = F(0), F(0)
    for amount, direction in re.findall(r"(\d+) units? (to the right|to the left|up|down)", match.group(1)):
        n = F(amount)
        if direction == "to the right": h += n
        elif direction == "to the left": h -= n
        elif direction == "up": k += n
        else: k -= n
    require(h != 0 or k != 0, "No move")
    return h, k


def target_shift(public):
    figure = public["figure"]["scene"]["elements"]
    require(len(figure) == 1 and figure[0]["type"] == "graph", "The shown graph")
    base = function_of(figure[0])
    h, k = read_move(public["prompt"])

    def moved(x):
        v = base(x - h)
        return None if v is None else v + k
    return profile(moved)


def points_of_label(label):
    return [(text_number(a), text_number(b)) for a, b in re.findall(POINT, label)]


def review_shift_label(option):
    element, label = option_element(option), option["label"]
    require(element["type"] == "graph", "Graph option must draw a graph")
    function = function_of(element)
    line = re.fullmatch(rf"A straight line through {POINT} and {POINT}, (rising|falling) from left to right\.", label)
    vee = re.fullmatch(rf"A V-shaped graph opening (up|down) with its vertex at {POINT}\.", label)
    para = re.fullmatch(rf"A parabola opening (up|down) with its vertex at {POINT}\.", label)
    zig = re.fullmatch(r"A zigzag through the points (.+)\.", label)
    if line:
        pts = points_of_label(label)
        require(all(function(x) == y for x, y in pts), f"{label!r}: a point is off the line")
        slope = function(F(1)) - function(F(0))
        require((slope > 0) == (line.group(5) == "rising"), f"{label!r}: direction")
    elif vee or para:
        direction, (vx, vy) = (vee or para).group(1), points_of_label(label)[0]
        require(function(vx) == vy, f"{label!r}: the vertex is off the graph")
        second = function(vx + 1) - vy
        require((second > 0) == (direction == "up") and second != 0, f"{label!r}: opening")
        require(function(vx - 1) == function(vx + 1), f"{label!r}: not symmetric about its vertex")
        require(all(function(vx + d) > vy if direction == "up" else function(vx + d) < vy for d in (F(1, 2), F(1), F(2))),
                f"{label!r}: vertex is not the extreme point")
    elif zig:
        pts = points_of_label(label)
        require(pts == drawn_points(element), f"{label!r}: drawn points differ")
        require(all(function(x) == y for x, y in pts), f"{label!r}: a point is off the zigzag")
    else:
        raise ValueError(f"Unrecognized description {label!r}")


# ------------------------------------------------------------ review

def option_target(template, option):
    element = option_element(option)
    if template == "graph-after-shift":
        return profile(function_of(element))
    require(element["type"] == "graph", "Graph option must draw a graph")
    only_points(element)
    return drawn_points(element)


def solve(public):
    template = public["templateId"]
    require(template in SUPPORTED, "Wrong family")
    response = public["response"]
    require(response["kind"] == "figure-choice" and response["noun"] == "Graph", "Response kind or noun")
    options = response["options"]
    require(len(options) == 4 and [o["id"] for o in options] == list(IDS), "Option ids out of order")
    target = {"graph-of-paired-values": target_paired, "point-on-signed-grid": target_signed,
              "graph-after-shift": target_shift}[template](public)
    matches = [o["id"] for o in options if option_target(template, o) == target]
    require(len(matches) == 1, f"Expected one figure of {target}, found {matches}")
    return matches[0]


def review_problem(problem):
    public = problem["public"]
    template = public["templateId"]
    expected = solve(public)
    require(problem["answer"] == expected, f"Answer {problem['answer']} disagrees with the prompt ({expected})")
    options = public["response"]["options"]
    name = {o["id"]: f"Graph {LETTERS[i]}" for i, o in enumerate(options)}
    require(len({frame(o) for o in options}) == 1, "Options differ in window or styling")
    require(len({o["label"] for o in options}) == 4, "Two options share a description")
    require(len({json.dumps(option_element(o), sort_keys=True) for o in options}) == 4, "Two options draw the same figure")
    for option in options:
        label = option["label"]
        require(not REVEALING.search(label), f"Description judges the option: {label!r}")
        element = option_element(option)
        if template == "graph-of-paired-values":
            require(read_points(label) == drawn_points(element), f"{label!r}: described points differ from drawn points")
            x0, x1, y0, y1 = window(element)
            require((x0, x1, y0, y1) == (0, 12, 0, 12), "Not a 0 to 12 first-quadrant window")
        elif template == "point-on-signed-grid":
            match = re.fullmatch(rf"A single point at {POINT}\.", label)
            require(match is not None and read_one(match) == drawn_points(element)[0] and len(drawn_points(element)) == 1,
                    f"{label!r}: described point differs from drawn point")
            require(window(element) == [-6, 6, -6, 6], "Not a four-quadrant window")
        else:
            review_shift_label(option)
    require(not any(NAMES.search(o["label"]) for o in options) and not NAMES.search(public["prompt"]), "Public text names an option")
    for text in texts(problem):
        require(not PLACEHOLDER.search(text), f"Unrendered placeholder in {text!r}")
    feedback = problem["choiceFeedback"]
    require(set(feedback) == {o["id"] for o in options} - {expected}, "Feedback must cover exactly the other options")
    for option_id, text in feedback.items():
        require(text.startswith(name[option_id] + " "), f"Feedback for {option_id} must open with {name[option_id]}: {text!r}")
    last = problem["explanation"][-1]
    require({f"Graph {b}" for b in re.findall(r"\bGraph ([A-D])\b", last)} == {name[expected]}, f"Last step must name {name[expected]} only")
    if template != "graph-after-shift":
        stated = [(text_number(a), text_number(b)) for a, b in re.findall(POINT, last)]
        require(sorted(stated) == option_target(template, next(o for o in options if o["id"] == expected)),
                f"Last step names other points: {last!r}")
    walkthrough = problem.get("walkthrough")
    require(walkthrough, "A lesson figure")
    return expected


def read_one(match):
    return (text_number(match.group(1)), text_number(match.group(2)))


# ------------------------------------------------------------ self test

def graph_element(**extra):
    base = {"type": "graph", "x": [-6, 6], "y": [-6, 6], "grid": 1, "tick": 2, "aspect": 1, "axisNames": ["x", "y"]}
    base.update(extra)
    return base


def scene_of(element):
    return {"v": 1, "width": 264, "maxHeight": 280, "elements": [element]}


def self_test():
    # A zigzag moved 1 left and 2 up, and a V moved 2 down.
    verts = [(-2, 0), (-1, 2), (1, -1), (2, 1)]

    def zig(dx, dy):
        pts = [(x + dx, y + dy) for x, y in verts]
        return graph_element(
            segments=[{"from": list(a), "to": list(b), "color": "accent"} for a, b in zip(pts, pts[1:])],
            points=[{"x": x, "y": y, "color": "accent"} for x, y in pts]), pts

    shown, _ = zig(0, 0)
    options, descriptions = [], []
    for i, (dx, dy) in enumerate([(-1, 2), (1, 2), (-1, -2), (2, -1)]):
        element, pts = zig(dx, dy)
        options.append({"id": IDS[i], "label": "A zigzag through the points " + ", ".join(f"({'−' if x < 0 else ''}{abs(x)}, {'−' if y < 0 else ''}{abs(y)})" for x, y in pts[:-1]) + f" and ({'−' if pts[-1][0] < 0 else ''}{abs(pts[-1][0])}, {'−' if pts[-1][1] < 0 else ''}{abs(pts[-1][1])}).",
                        "scene": scene_of(element)})
    problem = {
        "public": {"templateId": "graph-after-shift", "seed": "fixture",
                   "prompt": "The graph of $y = f(x)$ is shown. Which graph shows $y = f(x + 1) + 2$?",
                   "figure": {"kind": "scene", "scene": scene_of(shown)},
                   "response": {"kind": "figure-choice", "label": "Choose the graph", "noun": "Graph", "options": options}},
        "answer": "option-a", "hint": "Follow one point.", "explanation": ["Moves left 1 and up 2.", "Graph A is the zigzag."],
        "choiceFeedback": {"option-b": "Graph B moves right.", "option-c": "Graph C moves down.", "option-d": "Graph D is another move."},
        "walkthrough": scene_of(shown)}
    require(review_problem(problem) == "option-a", "Shifted zigzag")
    words = dict(problem, public=dict(problem["public"], prompt="The graph of $y = f(x)$ is shown. Which graph shows the graph of $f$ moved 1 unit to the left and 2 units up?"))
    require(review_problem(words) == "option-a", "Words and notation agree")
    bad = json.loads(json.dumps(problem))
    bad["public"]["prompt"] = "The graph of $y = f(x)$ is shown. Which graph shows $y = f(x - 1) + 2$?"
    for fixture, what in ((bad, "horizontal direction"),):
        try:
            review_problem(fixture)
        except (ValueError, KeyError, TypeError, IndexError):
            pass
        else:
            raise AssertionError(f"Accepted corrupt shift case: {what}")
    require(read_move("The graph of $y = f(x)$ is shown. Which graph shows $y = f(x - 2)$?") == (2, 0), "f(x - h)")
    require(read_move("The graph of $y = f(x)$ is shown. Which graph shows $y = f(x) - 3$?") == (0, -3), "f(x) - k")

    pair = lambda pts: graph_element(x=[0, 12], y=[0, 12], points=[{"x": x, "y": y, "color": "accent"} for x, y in pts])
    sets = [[(2, 3), (4, 6), (6, 9)], [(3, 2), (6, 4), (9, 6)], [(2, 3), (4, 6)], [(2, 2), (4, 4), (6, 6)]]
    opts = [{"id": IDS[i], "label": "Points at " + ", ".join(f"({x}, {y})" for x, y in s[:-1]) + f" and ({s[-1][0]}, {s[-1][1]}).", "scene": scene_of(pair(s))}
            for i, s in enumerate(sets)]
    paired = {"public": {"templateId": "graph-of-paired-values", "seed": "fixture",
                         "prompt": "The cost in dollars, $y$, is 1.5 times the number of bags, $x$. Which graph shows the pairs for $x = 2$, $x = 4$ and $x = 6$?",
                         "response": {"kind": "figure-choice", "label": "Choose the graph", "noun": "Graph", "options": opts}},
              "answer": "option-a", "hint": "Multiply.", "explanation": ["1.5 times each.", "Graph A plots (2, 3), (4, 6) and (6, 9)."],
              "choiceFeedback": {"option-b": "Graph B swaps.", "option-c": "Graph C leaves one out.", "option-d": "Graph D rounds."},
              "walkthrough": scene_of(pair(sets[0]))}
    require(review_problem(paired) == "option-a", "Paired values")
    for change, what in ((lambda p: p.update(answer="option-b"), "swapped answer"),
                         (lambda p: p["public"].update(prompt=p["public"]["prompt"].replace("1.5", "2.5")), "wrong multiplier")):
        corrupt = json.loads(json.dumps(paired))
        change(corrupt)
        try:
            review_problem(corrupt)
        except (ValueError, KeyError, TypeError, IndexError):
            pass
        else:
            raise AssertionError(f"Accepted corrupt paired case: {what}")
    require(target_signed({"prompt": "Which graph shows the point that is 3 units to the left of the $y$-axis and 4 units below the $x$-axis?"}) == [(-3, -4)], "Distances")
    return {"fixtures": 3}


REVIEW_RETURNS_ANSWER = True

if __name__ == "__main__":
    print(self_test())
