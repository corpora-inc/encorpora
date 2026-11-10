"""Independent answers for the area, coordinate and solid clause templates.

Unique answers are rebuilt from the public prompt and figure. A rectangle the
learner may choose (same perimeter, or same area) is checked against the
stated rectangle, and the submitted answer is returned when it is one of the
accepted rectangles.
"""
import json
import math
import re

SUPPORTED = frozenset({
    "define-unit-square",
    "which-is-a-unit-square",
    "count-square-units",
    "gaps-overlaps",
    "tile-then-multiply",
    "split-tiled-count",
    "choose-the-split",
    "your-own-cut",
    "which-cut",
    "exhibit-same-perimeter",
    "exhibit-same-area",
    "plot-the-polygon",
    "missing-vertex",
    "cone-section-area",
    "cavalieri-coin-stack",
    "tilted-rectangle",
})
OPEN = frozenset({"exhibit-same-perimeter", "exhibit-same-area"})
CHOICE_REVIEW = frozenset({
    "define-unit-square",
    "which-is-a-unit-square",
    "gaps-overlaps",
    "choose-the-split",
    "which-cut",
    "tilted-rectangle",
})
REVIEW_RETURNS_ANSWER = True

SQUARE = {
    "1 cm": "1 square centimeter",
    "1 in": "1 square inch",
    "1 m": "1 square meter",
    "1 ft": "1 square foot",
    "1 note": "1 square note",
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def dumps(value):
    return json.dumps(value, separators=(",", ":"))


def num(text):
    return int(text.replace("−", "-").replace("–", "-"))


def pick(options, label):
    hits = [option["id"] for option in options if option["label"] == label]
    require(len(hits) == 1, f"expected one choice {label!r}, found {len(hits)}")
    return hits[0]


def cards(public, expected):
    blanks = public["response"]["blanks"]
    require([blank["id"] for blank in blanks] == list(expected), "blank order")
    return dumps({
        blank["id"]: pick(blank["options"], expected[blank["id"]])
        for blank in blanks
    })


def pairs(text):
    return [(num(x), num(y)) for x, y in re.findall(r"\(([-−]?\d+), ([-−]?\d+)\)", text)]


def define_unit(public):
    prompt = public["prompt"]
    if "1 note on a side" in prompt:
        label = "1 square note"
    else:
        found = re.search(r"sides (1 (?:cm|in|m|ft)) long", prompt)
        require(found is not None, "unit side")
        label = SQUARE[found[1]]
    return pick(public["response"]["options"], label)


def count_squares(public):
    note = public["figure"]["scene"]["note"]
    found = re.search(r"from the top: ([0-9, ]+)\.", note)
    require(found is not None, "row counts")
    counts = [int(part) for part in found[1].split(",")]
    require(counts and all(n > 0 for n in counts), "rows")
    return str(sum(counts))


def tile_then(public):
    found = re.search(r"(\d+) rows and (\d+) unit squares in each row", public["prompt"])
    require(found is not None, "rows")
    rows, cols = int(found[1]), int(found[2])
    area = rows * cols
    return cards(public, {
        "onerow": str(cols),
        "allrow": str(rows),
        "cover": str(area),
        "prod": str(area),
    })


def split_tiled(public):
    found = re.search(
        r"(\d+) units tall and (\d+) units wide\. A line splits the width into (\d+) and (\d+)",
        public["prompt"],
    )
    require(found is not None, "split")
    rows, width, left, right = (int(found[i]) for i in range(1, 5))
    require(left + right == width, "width")
    left_area, right_area = rows * left, rows * right
    total = left_area + right_area
    return cards(public, {
        "left": str(left_area),
        "right": str(right_area),
        "total": str(total),
        "prod": str(total),
    })


def choose_split(public):
    found = re.search(r"= (\d+) × (\d+) \+ (\d+) × (\d+)", public["prompt"])
    require(found is not None, "split equation")
    columns = int(found[2])
    return pick(public["response"]["options"], f"The tiled rectangle with a heavy line after {columns} columns.")


def own_cut(public):
    sides = public["figure"]["sides"]
    require(len(sides) == 6 and all(isinstance(side, int) for side in sides), "L sides")
    width, low, _gap_w, rise, inner, height = sides
    one = width * low
    other = inner * rise
    require(height > low and one + other == width * low + inner * (height - low), "pieces")
    total = one + other
    return dumps([[str(one)], [str(other)], [str(total)]])


def plot_polygon(public):
    points = pairs(public["prompt"])
    require(len(points) == 4, "four vertices")
    points.sort()
    return dumps(points)


def missing_vertex(public):
    points = pairs(public["prompt"])
    require(len(points) == 3, "three vertices")
    xs = [point[0] for point in points]
    ys = [point[1] for point in points]
    lone_x = [value for value in set(xs) if xs.count(value) == 1]
    lone_y = [value for value in set(ys) if ys.count(value) == 1]
    require(len(lone_x) == 1 and len(lone_y) == 1, "rectangle")
    return dumps([[lone_x[0], lone_y[0]]])


def cone_or_cavalieri(public):
    prompt = public["prompt"]
    section = re.search(
        r"base area (\d+) and height (\d+)\. A plane parallel to the base at height (\d+)",
        prompt,
    )
    if section:
        base, height, level = (int(section[i]) for i in (1, 2, 3))
        require(height and level * 2 == height, "halfway")
        area = base * level * level // (height * height)
        require(base * level * level % (height * height) == 0, "section area")
        return str(area)
    cone = re.search(r"base area (\d+) and height (\d+)\. Its volume", prompt)
    if cone:
        base, height = int(cone[1]), int(cone[2])
        require(base * height % 3 == 0, "cone volume")
        return str(base * height // 3)
    coins = re.search(r"stack of (\d+) coins, each of volume ([0-9.]+) cubic centimeters?", prompt)
    require(coins is not None, "solid prompt")
    count = int(coins[1])
    each = coins[2]
    require(re.fullmatch(r"\d+(?:\.\d)?", each), "coin volume")
    tenths = int(round(float(each) * 10))
    require(abs(tenths / 10 - float(each)) < 1e-9, "tenths")
    require(count * tenths % 10 == 0, "stack volume")
    return str(count * tenths // 10)


def simplest(coef, radicand):
    coef, radicand = int(coef), int(radicand)
    factor = 2
    while factor * factor <= radicand:
        while radicand % (factor * factor) == 0:
            radicand //= factor * factor
            coef *= factor
        factor += 1
    return coef, radicand


def radical_text(coef, radicand):
    coef, radicand = simplest(coef, radicand)
    if radicand == 1:
        return str(coef)
    if coef == 1:
        return f"$\\sqrt{{{radicand}}}$"
    return f"${coef}\\sqrt{{{radicand}}}$"


def tilted(public):
    points = pairs(public["prompt"])
    require(len(points) == 4, "rectangle vertices")
    ax, ay = points[0]
    bx, by = points[1]
    dx, dy = points[3]
    ab = (bx - ax, by - ay)
    ad = (dx - ax, dy - ay)
    require(ab[0] * ad[0] + ab[1] * ad[1] == 0, "right angle")
    require(math.gcd(abs(ab[0]), abs(ab[1])) > 0, "side")
    steps_ab = math.gcd(abs(ab[0]), abs(ab[1]))
    steps_ad = math.gcd(abs(ad[0]), abs(ad[1]))
    square = (ab[0] // steps_ab) ** 2 + (ab[1] // steps_ab) ** 2
    require(ad[0] // steps_ad * ad[0] // steps_ad + ad[1] // steps_ad * ad[1] // steps_ad == square, "same direction length")
    area = steps_ab * steps_ad * square
    if "area, in square units" in public["prompt"]:
        label = f"{area} square units"
    else:
        require("perimeter" in public["prompt"], "area or perimeter")
        label = radical_text(2 * (steps_ab + steps_ad), square)
    return pick(public["response"]["options"], label)


def whole_rows(answer):
    rows = json.loads(answer)
    require(isinstance(rows, list) and len(rows) == 3, "three rows")
    values = []
    for row in rows:
        require(isinstance(row, list) and len(row) == 1 and re.fullmatch(r"-?\d+", row[0]), "whole number")
        values.append(int(row[0]))
    return values


def same_pair(left, right, given):
    return (left, right) == tuple(given) or (right, left) == tuple(given)


def accept_exhibit(public, answer):
    length, width, third = whole_rows(answer)
    if public["templateId"] == "exhibit-same-perimeter":
        found = re.search(r"This rectangle is (\d+) cm by (\d+) cm", public["prompt"])
        require(found is not None, "given rectangle")
        given = (int(found[1]), int(found[2]))
        require(length + width == given[0] + given[1], "perimeter")
        require(not same_pair(length, width, given), "different rectangle")
        require(third == length * width, "area")
        return
    found = re.search(r"This rectangle is (\d+) by (\d+)", public["prompt"])
    require(found is not None, "given rectangle")
    given = (int(found[1]), int(found[2]))
    require(length * width == given[0] * given[1], "area")
    require(not same_pair(length, width, given), "different rectangle")
    require(third == 2 * (length + width), "perimeter")


def solve(public):
    template = public["templateId"]
    require(template in SUPPORTED, "Unsupported family")
    if template == "define-unit-square":
        return define_unit(public)
    if template == "which-is-a-unit-square":
        return pick(public["response"]["options"], "A square one grid unit wide and one grid unit tall, shaded on the grid.")
    if template == "count-square-units":
        return count_squares(public)
    if template == "gaps-overlaps":
        return next(
            option["id"] for option in public["response"]["options"]
            if option["label"].startswith("Every cell of the outline has one tile")
        )
    if template == "tile-then-multiply":
        return tile_then(public)
    if template == "split-tiled-count":
        return split_tiled(public)
    if template == "choose-the-split":
        return choose_split(public)
    if template == "your-own-cut":
        return own_cut(public)
    if template == "which-cut":
        return pick(public["response"]["options"], "One straight cut from the inner corner across to the opposite side.")
    if template == "plot-the-polygon":
        return plot_polygon(public)
    if template == "missing-vertex":
        return missing_vertex(public)
    if template in ("cone-section-area", "cavalieri-coin-stack"):
        return cone_or_cavalieri(public)
    if template == "tilted-rectangle":
        return tilted(public)
    # A stand-in. review_problem checks the submitted rectangle.
    if template == "exhibit-same-perimeter":
        found = re.search(r"This rectangle is (\d+) cm by (\d+) cm", public["prompt"])
        given = (int(found[1]), int(found[2]))
        other = 1 if given != (1, given[0] + given[1] - 1) else 2
        width = given[0] + given[1] - other
        return dumps([[str(min(other, width))], [str(max(other, width))], [str(other * width)]])
    found = re.search(r"This rectangle is (\d+) by (\d+)", public["prompt"])
    area = int(found[1]) * int(found[2])
    return dumps([["1"], [str(area)], [str(2 * (1 + area))]])


def review_problem(problem):
    public = problem["public"]
    if public["templateId"] in OPEN:
        accept_exhibit(public, problem["answer"])
        return problem["answer"]
    got = solve(public)
    require(got == problem["answer"], f"{public['templateId']}: {got} != {problem['answer']}")
    return got


def self_test():
    unit = {
        "templateId": "define-unit-square",
        "prompt": "Each small square has sides 1 ft long. How much area does one small square cover?",
        "response": {"options": [
            {"id": "option-a", "label": "1 foot"},
            {"id": "option-b", "label": "1 square foot"},
            {"id": "option-c", "label": "4 feet"},
            {"id": "option-d", "label": "4 square feet"},
        ]},
    }
    require(solve(unit) == "option-b", "square foot")
    coins = {
        "templateId": "cavalieri-coin-stack",
        "prompt": "A stack of 30 coins, each of volume 1.5 cubic centimeters, is pushed into a slanted stack. What is the volume of the slanted stack, in cubic centimeters?",
    }
    require(solve(coins) == "45", "coins")
    one = {
        "templateId": "cavalieri-coin-stack",
        "prompt": "A stack of 10 coins, each of volume 1 cubic centimeter, is pushed into a slanted stack. What is the volume of the slanted stack, in cubic centimeters?",
    }
    require(solve(one) == "10", "one cubic centimeter")
    return 2


if __name__ == "__main__":
    print(self_test())
