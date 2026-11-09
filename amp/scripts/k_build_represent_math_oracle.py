"""Independent review of the kindergarten building and representing families
(K.G.B.5 stick-and-ball models and shape drawings; K.OA.A.1 joining and
taking away) from public payloads only.

Counts come from the drawn scene: clay balls and counters are circles,
sticks are segments, a drawing is a polygon (closed, straight), a polyline
(open) or a path with a quadratic piece (a curved side). The key is decided
from those counts and the prompt's words; the private answer, hint and
explanation are only values under test.
"""

import copy
import json
import math
import re
import sys

SUPPORTED = frozenset({
    "sticks-and-balls-needed",
    "check-the-drawing",
    "drawing-mistake",
    "picture-to-number-sentence",
    "number-sentence-to-picture",
})
CHOICE_TEMPLATES = SUPPORTED - {"sticks-and-balls-needed"}
SIDES = {"triangle": 3, "square": 4, "rectangle": 4, "hexagon": 6}
PLACEHOLDER = re.compile(r"\$\{|\bundefined\b|\bNaN\b|\bnull\b|\[object")


def require(condition, message):
    if not condition:
        raise ValueError(message)


def elements(scene):
    return [e for e in scene["elements"] if e.get("id") != "canvas"]


def scene_of(public):
    figure = public.get("figure")
    require(figure is not None and figure["kind"] == "scene", "A scene figure")
    return figure["scene"]


# ------------------------------------------------------------ shapes

def drawing_of(scene):
    """(kind, points) of the one drawing: 'closed', 'open' or 'curved'."""
    found = [e for e in elements(scene) if e["type"] in ("polygon", "polyline", "path")]
    require(len(found) == 1, "One drawing")
    e = found[0]
    if e["type"] == "polygon":
        return "closed", [tuple(p) for p in e["points"]]
    if e["type"] == "polyline":
        return "open", [tuple(p) for p in e["points"]]
    require(any(op[0] == "Q" for op in e["d"]), "A path drawing has a curved piece")
    pts = [tuple(op[1:3]) for op in e["d"] if op[0] in ("M", "L")]
    return "curved", pts


def corner_cosines(pts):
    n = len(pts)
    out = []
    for i in range(n):
        a, b, c = pts[i - 1], pts[i], pts[(i + 1) % n]
        u = (a[0] - b[0], a[1] - b[1])
        v = (c[0] - b[0], c[1] - b[1])
        out.append((u[0] * v[0] + u[1] * v[1]) / (math.hypot(*u) * math.hypot(*v)))
    return out


def side_lengths(pts):
    return [math.dist(pts[i], pts[(i + 1) % len(pts)]) for i in range(len(pts))]


def all_square_corners(pts):
    # Coordinates are rounded to thousandths; a leaning corner is far off.
    return all(abs(c) < 0.01 for c in corner_cosines(pts))


def equal_sides(pts):
    s = side_lengths(pts)
    return max(s) - min(s) < 0.01 * max(s)


def is_named_shape(kind, pts, shape):
    """The type-1 predicate: closed, straight, the right count, and for a
    square or rectangle square corners (and equal sides for a square)."""
    if kind != "closed" or len(pts) != SIDES[shape]:
        return False
    if any(abs(c) > 1 - 1e-6 for c in corner_cosines(pts)):
        return False  # three corners in a line would be a fake corner
    if shape in ("square", "rectangle") and not all_square_corners(pts):
        return False
    if shape == "square" and not equal_sides(pts):
        return False
    return True


def solve_check_drawing(public):
    m = re.fullmatch(r"Which drawing is a (triangle|square|rectangle|hexagon)\?", public["prompt"])
    require(m is not None, f"Prompt {public['prompt']!r}")
    shape = m.group(1)
    response = public["response"]
    require(response["kind"] == "figure-choice" and response["noun"] == "Picture", "Picture choice")
    require(len(response["options"]) == 4, "Four drawings")
    passing = []
    flaws = set()
    for option in response["options"]:
        kind, pts = drawing_of(option["scene"])
        if is_named_shape(kind, pts, shape):
            passing.append(option["id"])
        else:
            flaws.add(flaw_of(kind, pts, shape))
    require(len(passing) == 1, f"Exactly one drawing is a {shape}, found {passing}")
    require(len(flaws) == 3, f"The three wrong drawings show three different flaws, got {flaws}")
    return passing[0]


def flaw_of(kind, pts, shape):
    if kind != "closed":
        return kind
    if len(pts) != SIDES[shape]:
        return "count"
    if shape in ("square", "rectangle") and not all_square_corners(pts):
        return "corners"
    if shape == "square" and not equal_sides(pts):
        return "unequal"
    return None


def solve_drawing_mistake(public):
    m = re.fullmatch(r"(\w+) drew a (triangle|square|rectangle|hexagon)\. What is wrong with \1's drawing\?", public["prompt"])
    require(m is not None, f"Prompt {public['prompt']!r}")
    shape = m.group(2)
    n = SIDES[shape]
    kind, pts = drawing_of(scene_of(public))
    drawn_sides = len(pts)
    ok = is_named_shape(kind, pts, shape)

    def true(label):
        if label == "It is not closed.":
            return kind == "open"
        if label == "One side is curved.":
            return kind == "curved"
        if label == "The corners are not square corners.":
            return kind == "closed" and n == 4 and drawn_sides == 4 and not all_square_corners(pts)
        if label == "It is turned the wrong way.":
            return False
        if label == f"Nothing is wrong. It is a {shape}.":
            return ok
        cm = re.fullmatch(r"It has (\d+) sides, not (\d+)\.", label)
        require(cm is not None, f"Unknown choice {label!r}")
        require(int(cm.group(2)) == n, "The count choice names the shape's own count")
        return kind == "closed" and drawn_sides == int(cm.group(1)) != n
    response = public["response"]
    require(response["kind"] == "choice" and len(response["options"]) == 4, "Four choices")
    truths = [o["id"] for o in response["options"] if true(o["label"])]
    require(len(truths) == 1, f"Exactly one true choice, got {truths}")
    return truths[0]


def count_kinds(scene):
    els = elements(scene)
    balls = sum(1 for e in els if e["type"] == "circle")
    sticks = sum(1 for e in els if e["type"] == "segment")
    outline = [e for e in els if e["type"] == "polygon"]
    return balls, sticks, outline


def solve_sticks(public):
    prompt = public["prompt"]
    balls, sticks, outline = count_kinds(scene_of(public))
    label = public["response"]["label"]
    require(public["response"]["kind"] == "number", "Number entry")
    m = re.search(r"How many (sticks|clay balls) does (\w+) need\?$", prompt)
    if "builds a model of" in prompt:
        require(m is not None, "Plan question")
        asks = m.group(1)
        require(label == asks, "Label names what is counted")
        if "is a cube" in prompt:
            # A see-through stick model: every stick and ball is drawn.
            require((balls, sticks) == (8, 12), "A whole cube model")
            return str(sticks if asks == "sticks" else balls)
        require(len(outline) == 1 and balls == 0 and sticks == 0, "One outline")
        corners = len(outline[0]["points"])
        # A closed outline of straight sides has as many sides as corners.
        return str(corners)
    if "All the clay balls are placed" in prompt or "All 8 clay balls are placed" in prompt:
        fm = re.search(r"needed to finish the (triangle|square|rectangle|hexagon|cube)\?$", prompt)
        require(fm is not None and label == "more sticks", "Finish question")
        shape = fm.group(1)
        if shape == "cube":
            require(balls == 8, "8 clay balls")
            # A cube: 4 sticks on the bottom, 4 on top and 4 posts.
            return str(4 + 4 + 4 - sticks)
        require(balls == SIDES[shape], "A ball at every corner")
        require(1 <= sticks < balls, "Some sticks placed")
        return str(balls - sticks)
    jm = re.fullmatch(r"(\w+) has (\d+) sticks for a (triangle|square|rectangle|hexagon|cube)\. How many clay balls does \1 need to join them\?", prompt)
    require(jm is not None and label == "clay balls", f"Join question {prompt!r}")
    given, shape = int(jm.group(2)), jm.group(3)
    require(balls == 0 and sticks == given, "The given sticks are drawn")
    if shape == "cube":
        require(given == 12, "12 sticks for a cube")
        return "8"
    require(given == SIDES[shape], "One stick per side")
    return str(given)


# ------------------------------------------------------------ counters

def counters(scene):
    """(teal, rust, faded, arrow direction, frame?) of a counter picture."""
    els = elements(scene)
    circles = [e for e in els if e["type"] == "circle"]
    teal = sum(1 for e in circles if e.get("fill") == "accent")
    rust = sum(1 for e in circles if e.get("fill") == "warm")
    faded = sum(1 for e in circles if e.get("fill") == "empty")
    require(teal + rust + faded == len(circles), "Every counter has a known color")
    arrows = [e for e in els if e["type"] == "arrow"]
    require(len(arrows) <= 1, "At most one arrow")
    direction = None
    if arrows:
        direction = "in" if arrows[0]["from"][0] > arrows[0]["to"][0] else "out"
    frame = any(e["type"] == "rect" and str(e.get("id", "")).startswith("slot") for e in els)
    crosses = sum(1 for e in els if e["type"] == "segment")
    return teal, rust, faded, direction, frame, crosses


def picture_numbers(public):
    """('join', a, b) or ('take', t, r) from the figure, or from a story."""
    figure = public.get("figure")
    if figure is not None:
        teal, rust, faded, direction, frame, _ = counters(figure["scene"])
        require(not frame, "A counter picture")
        if rust:
            require(faded == 0 and direction == "in", "Joining counters come in")
            return "join", teal, rust
        require(faded and rust == 0 and direction == "out", "Leaving counters go out")
        return "take", teal + faded, faded
    story = public["prompt"].rsplit(" Which number sentence tells the story?", 1)
    require(len(story) == 2, "A story prompt")
    numbers = [int(v) for v in re.findall(r"\b\d+\b", story[0])]
    require(len(numbers) == 2, "Two numbers in the story")
    # Joining stories say "more"; taking-away stories never do.
    if re.search(r"\bmore\b", story[0]):
        return "join", numbers[0], numbers[1]
    return "take", numbers[0], numbers[1]


def parse_sentence(label):
    m = re.fullmatch(r"\$?(\d+) ([+-]) (\d+)(?: = (\d+))?\$?", label)
    if not m:
        return None
    return int(m.group(1)), m.group(2), int(m.group(3)), (int(m.group(4)) if m.group(4) else None)


def solve_picture_to_sentence(public):
    action, x, y = picture_numbers(public)
    require(1 <= x <= 10 and 1 <= y <= 10, "Numbers within 10")
    result = x + y if action == "join" else x - y
    require(1 <= result <= 10, "Totals within 10, nothing left at zero")
    options = public["response"]["options"]
    require(len(options) == 4, "Four choices")
    words = all(parse_sentence(o["label"]) is None and not o["label"].isdigit() for o in options)
    matches = []
    if words:
        for o in options:
            numbers = [int(v) for v in re.findall(r"\b\d+\b", o["label"])]
            joins = re.search(r"\bmore\b", o["label"]) is not None
            if action == "join" and joins and numbers == [x, y, result]:
                matches.append(o["id"])
            if action == "take" and not joins and numbers == [x, y, result] and o["label"].endswith("left."):
                matches.append(o["id"])
    else:
        equation = any("=" in o["label"] for o in options)
        sign = "+" if action == "join" else "-"
        for o in options:
            parsed = parse_sentence(o["label"])
            if parsed is None:
                continue
            a, s, b, c = parsed
            if (a, s, b) == (x, sign, y) and (c == result if equation else c is None):
                matches.append(o["id"])
    require(len(matches) == 1, f"Exactly one choice shows it, got {matches}")
    return matches[0]


def solve_sentence_to_picture(public):
    m = re.fullmatch(r"Which (picture|ten frame) shows \$(\d+) ([+-]) (\d+)(?: = (\d+))?\$\?", public["prompt"])
    require(m is not None, f"Prompt {public['prompt']!r}")
    frame_asked = m.group(1) == "ten frame"
    x, sign, y = int(m.group(2)), m.group(3), int(m.group(4))
    result = x + y if sign == "+" else x - y
    if m.group(5) is not None:
        require(int(m.group(5)) == result, "The shown equation is true")
    require(1 <= result <= 10 and x <= 10 and y >= 1, "Within 10")
    response = public["response"]
    require(response["kind"] == "figure-choice" and len(response["options"]) == 4, "Four pictures")
    matches = []
    for o in response["options"]:
        teal, rust, faded, direction, frame, crosses = counters(o["scene"])
        if frame_asked:
            require(frame, "Every option is a ten frame")
            require(crosses == 2 * faded, "Each faded counter is crossed out")
            if sign == "+" and (teal, rust, faded) == (x, y, 0):
                matches.append(o["id"])
        elif sign == "+":
            if (teal, rust, faded, direction) == (x, y, 0, "in"):
                matches.append(o["id"])
        elif (teal, rust, faded, direction) == (result, 0, y, "out"):
            matches.append(o["id"])
    require(len(matches) == 1, f"Exactly one picture shows it, got {matches}")
    return matches[0]


SOLVERS = {
    "sticks-and-balls-needed": solve_sticks,
    "check-the-drawing": solve_check_drawing,
    "drawing-mistake": solve_drawing_mistake,
    "picture-to-number-sentence": solve_picture_to_sentence,
    "number-sentence-to-picture": solve_sentence_to_picture,
}


def solve(public):
    template = public["templateId"]
    require(template in SUPPORTED, "Wrong family")
    return SOLVERS[template](public)


def review_problem(problem):
    public = problem["public"]
    expected = solve(public)
    require(problem["answer"] == expected, f"Answer {problem['answer']} disagrees; expected {expected}")
    for text in [public["prompt"], problem["hint"], *problem["explanation"]]:
        require(not PLACEHOLDER.search(text), f"Unrendered placeholder in {text!r}")
    if public["templateId"] == "sticks-and-balls-needed":
        require(re.search(rf"\b{expected}\b", " ".join(problem["explanation"])), "The explanation reaches the answer")
    if public["templateId"] in CHOICE_TEMPLATES:
        feedback = problem.get("choiceFeedback") or {}
        ids = {o["id"] for o in public["response"]["options"]}
        require(set(feedback) == ids - {expected}, "Feedback for every wrong choice")
    return expected


REVIEW_RETURNS_ANSWER = True


# ------------------------------------------------------------ self test

def circle(fill, x=0):
    return {"type": "circle", "center": [x, 0], "r": 0.38, "fill": fill}


def scene(*els):
    return {"v": 1, "elements": list(els)}


def self_test():
    sticks_case = {
        "public": {
            "templateId": "sticks-and-balls-needed", "seed": "f",
            "prompt": "Ava is building a hexagon with sticks and clay balls. All the clay balls are placed. How many more sticks are needed to finish the hexagon?",
            "response": {"kind": "number", "label": "more sticks"},
            "figure": {"kind": "scene", "scene": scene(
                *[{"type": "segment", "from": [0, 0], "to": [1, 0]} for _ in range(4)],
                *[circle("warm", i) for i in range(6)])},
        },
        "answer": "2", "hint": "Count the gaps.",
        "explanation": ["A hexagon has 6 corners.", "4 sticks are placed.", "So 2 more sticks are needed."],
    }
    require(review_problem(sticks_case) == "2", "Sticks fixture")
    square = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
    rhombus = [[0, 0], [2, 0], [2.85, 1.81], [0.85, 1.81]]
    pentagon = [[-1, -1], [1, -1], [1, 0.2], [0.2, 1], [-1, 1]]

    def opt(i, el):
        return {"id": f"option-{'abcd'[i]}", "label": f"drawing number {i}", "scene": scene(el)}
    check = {
        "public": {
            "templateId": "check-the-drawing", "seed": "f", "prompt": "Which drawing is a square?",
            "response": {"kind": "figure-choice", "label": "Choose", "noun": "Picture", "options": [
                opt(0, {"type": "polygon", "points": rhombus}),
                opt(1, {"type": "polyline", "points": square + [[-1, 0.6]]}),
                opt(2, {"type": "polygon", "points": square}),
                opt(3, {"type": "polygon", "points": pentagon}),
            ]},
        },
        "answer": "option-c", "hint": "Check.", "explanation": ["A square has 4 equal sides."],
        "choiceFeedback": {"option-a": "x", "option-b": "x", "option-d": "x"},
    }
    require(review_problem(check) == "option-c", "Drawing fixture")
    take = {
        "public": {
            "templateId": "picture-to-number-sentence", "seed": "f", "prompt": "Which one shows this picture?",
            "response": {"kind": "choice", "label": "Choose", "options": [
                {"id": "option-a", "label": "$7 - 3$"}, {"id": "option-b", "label": "$7 + 3$"},
                {"id": "option-c", "label": "$7 - 4$"}, {"id": "option-d", "label": "4"}]},
            "figure": {"kind": "scene", "scene": scene(
                *[circle("accent", i) for i in range(4)], *[circle("empty", 6 + i) for i in range(3)],
                {"type": "arrow", "from": [4.5, 1], "to": [5.8, 1]})},
        },
        "answer": "option-a", "hint": "Count.", "explanation": ["7 take away 3."],
        "choiceFeedback": {"option-b": "x", "option-c": "x", "option-d": "x"},
    }
    require(review_problem(take) == "option-a", "Take-away fixture")
    story = {
        "public": {
            "templateId": "picture-to-number-sentence", "seed": "f",
            "prompt": "4 ducks are on the pond. 3 more ducks come. Which number sentence tells the story?",
            "response": {"kind": "choice", "label": "Choose", "options": [
                {"id": "option-a", "label": "$4 - 3 = 1$"}, {"id": "option-b", "label": "$4 + 3 = 8$"},
                {"id": "option-c", "label": "$4 + 3 = 7$"}, {"id": "option-d", "label": "$7 + 3 = 10$"}]},
        },
        "answer": "option-c", "hint": "4 ducks.", "explanation": ["4 and 3 more."],
        "choiceFeedback": {"option-a": "x", "option-b": "x", "option-d": "x"},
    }
    require(review_problem(story) == "option-c", "Story fixture")
    mutations = 0
    for base, change, what in (
            (sticks_case, lambda p: p.update(answer="6"), "counted every side"),
            (sticks_case, lambda p: p["public"]["figure"]["scene"]["elements"].pop(0), "a stick removed from the picture"),
            (check, lambda p: p.update(answer="option-a"), "rhombus for square"),
            (check, lambda p: p["public"]["response"]["options"][0]["scene"]["elements"][0].update(points=square), "two squares"),
            (take, lambda p: p.update(answer="option-c"), "taken and left swapped"),
            (take, lambda p: p["public"]["figure"]["scene"]["elements"][-1].update(**{"from": [5.8, 1], "to": [4.5, 1]}), "arrow turned around"),
            (story, lambda p: p.update(answer="option-b"), "miscounted total"),
            (story, lambda p: p["public"].update(prompt="4 ducks are on the pond. 3 ducks swim away. Which number sentence tells the story?"), "leaving story")):
        bad = copy.deepcopy(base)
        change(bad)
        try:
            review_problem(bad)
        except (ValueError, KeyError, TypeError, IndexError, ZeroDivisionError):
            mutations += 1
        else:
            raise AssertionError(f"Accepted corrupt case: {what}")
    return {"fixtures": 4, "mutations": mutations}


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--cases":
        cases = json.load(sys.stdin)
        for problem in cases:
            review_problem(problem)
        print({"cases": len(cases)})
    else:
        print(self_test())
