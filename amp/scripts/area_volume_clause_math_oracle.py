"""Independent answers for the area and volume clause templates that are not
a single measured number: piece cards, an area expression, a packing count,
and the solid named by a net.
"""
import json
import re
from fractions import Fraction

SUPPORTED = frozenset({
    "polygon-show-the-pieces",
    "polygon-which-expression",
    "count-then-size-then-check",
    "net-name-the-solid",
})
CHOICE_REVIEW = frozenset({"polygon-which-expression", "net-name-the-solid"})


def require(condition, message):
    if not condition:
        raise ValueError(message)


def dumps(value):
    return json.dumps(value, separators=(",", ":"))


def by_label(options, label):
    hits = [o["id"] for o in options if o["label"] == label]
    require(len(hits) == 1, f"{label!r} -> {hits}")
    return hits[0]


def slots(response, labels):
    return dumps({
        blank["id"]: by_label(blank["options"], labels[blank["id"]])
        for blank in response["blanks"]
    })


def text_of(q):
    q = Fraction(q)
    return str(q.numerator) if q.denominator == 1 else f"{q.numerator}/{q.denominator}"


def edge(item):
    return Fraction(int(item["n"]), int(item["d"]))


def solve(public):
    template = public["templateId"]
    prompt = public["prompt"]
    response = public["response"]
    require(template in SUPPORTED, template)
    if template == "polygon-which-expression":
        big, small, height = [int(n) for n in re.search(
            r"parallel sides (\d+) and (\d+) and height (\d+)", prompt).groups()]
        require((big - small) % 2 == 0 and big > small and height > 0, "trapezoid")
        overhang = (big - small) // 2
        label = f"{small} × {height} + 2 × (1/2 × {overhang} × {height})"
        return by_label(response["options"], label)
    if template == "polygon-show-the-pieces":
        trap = re.search(r"parallel sides are (\d+) and (\d+), and the height is (\d+)", prompt)
        if trap:
            big, small, height = (int(n) for n in trap.groups())
            overhang = (big - small) // 2
            rect, tri = small * height, overhang * height // 2
            require(overhang * height % 2 == 0, "triangle")
            return slots(response, {"rect": str(rect), "tri": str(tri), "total": str(rect + 2 * tri)})
        slide = re.search(r"The base is (\d+) \w+ and the height is (\d+)", prompt)
        if slide:
            base, height = (int(n) for n in slide.groups())
            return slots(response, {"len": str(base), "wid": str(height), "area": str(base * height)})
        legs = re.search(r"The legs are (\d+) and (\d+)", prompt)
        require(legs is not None, prompt)
        base, height = (int(n) for n in legs.groups())
        rect = base * height
        require(rect % 2 == 0, "half")
        return slots(response, {
            "base": str(base), "high": str(height), "box": str(rect), "half": str(rect // 2),
        })
    if template == "count-then-size-then-check":
        figure = public["figure"]
        require(figure["kind"] == "fraction-box-prism", "box")
        cube = edge(figure["cubeEdge"])
        edges = [edge(figure[name]) for name in ("length", "width", "height")]
        counts = []
        for side in edges:
            count = side / cube
            require(count.denominator == 1 and count > 0, "cube count")
            counts.append(count.numerator)
        total = counts[0] * counts[1] * counts[2]
        small = cube ** 3
        volume = small * total
        require(volume == edges[0] * edges[1] * edges[2], "edge volume")
        return dumps([
            [str(counts[0]), str(counts[1])],
            [str(counts[2]), str(total)],
            [text_of(small)],
            [text_of(volume)],
            [text_of(volume)],
        ])
    if template == "net-name-the-solid":
        figure = public["figure"]
        kind = figure["kind"]
        if kind == "rectangular-prism-net":
            name = "cube" if figure["length"] == figure["width"] == figure["height"] else "rectangular prism"
        elif kind == "triangular-prism-net":
            name = "triangular prism"
        elif kind == "square-pyramid-net":
            name = "square pyramid"
        else:
            raise ValueError(kind)
        return by_label(response["options"], name)
    raise ValueError(template)


def review_problem(problem):
    got = solve(problem["public"])
    actual = problem["answer"]
    same = json.loads(got) == json.loads(actual) if got[:1] in "[{" else got == actual
    require(same, f"{problem['public']['templateId']}: {got} != {actual}")
    return got


def self_test():
    expression = solve({
        "templateId": "polygon-which-expression",
        "prompt": "A trapezoid has parallel sides 22 and 12 and height 6. Lengths are in inches. Which expression gives its area?",
        "response": {"kind": "choice", "options": [
            {"id": "option-a", "label": "22 × 12"},
            {"id": "option-b", "label": "22 × 6"},
            {"id": "option-c", "label": "12 × 6"},
            {"id": "option-d", "label": "12 × 6 + 2 × (1/2 × 5 × 6)"},
        ]},
    })
    require(expression == "option-d", expression)
    packed = solve({
        "templateId": "count-then-size-then-check",
        "prompt": "A box is packed with small cubes.",
        "response": {"kind": "structured-work"},
        "figure": {
            "kind": "fraction-box-prism",
            "length": {"n": 2, "d": 1},
            "width": {"n": 9, "d": 4},
            "height": {"n": 3, "d": 4},
            "cubeEdge": {"n": 1, "d": 4},
        },
    })
    require(packed == '[["8","9"],["3","216"],["1/64"],["27/8"],["27/8"]]', packed)
    return 2


if __name__ == "__main__":
    print(self_test())
