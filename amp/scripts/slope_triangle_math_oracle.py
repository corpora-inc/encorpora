"""Independent exact geometry for public slope-triangle statements.

All predicates use public point coordinates. Squared lengths and rational dot
products avoid trigonometric rounding and do not read generator truth flags.
"""

import copy
import json
import re
from fractions import Fraction as F

SUPPORTED = frozenset({"slope-triangle-statements"})


def require(condition, message):
    if not condition:
        raise ValueError(message)


def vector(a, b):
    return b[0] - a[0], b[1] - a[1]


def dot(a, b):
    return a[0] * b[0] + a[1] * b[1]


def cross(a, b):
    return a[0] * b[1] - a[1] * b[0]


def length2(a, b):
    v = vector(a, b)
    return dot(v, v)


def slope(a, b):
    dx, dy = vector(a, b)
    require(dx != 0, "Vertical slope outside family")
    return F(dy, dx)


def angle_signature(points, names):
    a, vertex, b = (points[name] for name in names)
    u, v = vector(vertex, a), vector(vertex, b)
    denominator = dot(u, u) * dot(v, v)
    require(denominator > 0, "Undefined angle")
    numerator = dot(u, v)
    # Squaring alone would conflate supplementary acute/obtuse angles.
    return (numerator > 0) - (numerator < 0), F(numerator * numerator, denominator)


def sides(points, names):
    return [length2(points[names[i]], points[names[(i + 1) % 3]]) for i in range(3)]


def similar(points, first, second):
    a, b = sides(points, first), sides(points, second)
    return all(x > 0 for x in a + b) and len({F(y, x) for x, y in zip(a, b)}) == 1


def congruent(points, first, second):
    return sides(points, first) == sides(points, second)


def geometry_fixtures():
    positive = {
        "A": (0, 1),
        "B": (2, 1),
        "C": (2, 4),
        "D": (4, 7),
        "E": (8, 7),
        "F": (8, 13),
    }
    require(similar(positive, "ABC", "DEF"), "Handwritten scaled triangles")
    require(not congruent(positive, "ABC", "DEF"), "Scaling changes size")
    require(slope(positive["A"], positive["C"]) == F(3, 2), "Positive rise/run")
    require(
        angle_signature(positive, "BAC") == angle_signature(positive, "EDF"),
        "Corresponding acute angles",
    )
    require(
        angle_signature(positive, "BAC") != angle_signature(positive, "DFE"),
        "Nonisosceles mismatched acute angles",
    )
    negative = {name: (x, -y) for name, (x, y) in positive.items()}
    require(similar(negative, "ABC", "DEF"), "Reflection preserves similarity")
    require(slope(negative["A"], negative["C"]) == F(-3, 2), "Signed falling slope")
    translation = dict(positive)
    translation.update({"D": (4, 7), "E": (6, 7), "F": (6, 10)})
    require(congruent(translation, "ABC", "DEF"), "Translated congruent triangles")
    require(similar(translation, "ABC", "DEF"), "Congruence is similarity")
    require(not similar(positive, "ABC", "DFE"), "Incorrect ordered correspondence")
    supplementary = {"A": (1, 1), "B": (0, 0), "C": (1, 0), "D": (-1, 1)}
    require(
        angle_signature(supplementary, "ABC") != angle_signature(supplementary, "DBC"),
        "Do not conflate supplementary angles",
    )


def plain(text):
    text = text.replace("$", "").replace("−", "-").replace(r"\ell", "ℓ")
    text = re.sub(r"\\(?:d?frac)\{(-?\d+)\}\{(\d+)\}", r"\1/\2", text)
    return text


def public_geometry(public):
    require(public["templateId"] in SUPPORTED, "Unexpected family")
    text = plain(public["prompt"])
    triples = re.findall(r"[Tt]riangle ([A-Z]{3}) has", text)
    require(
        len(triples) == 2 and len(set("".join(triples))) == 6,
        "Two ordered disjoint triangle names required",
    )
    vertices = re.findall(r"([A-Z])\((-?\d+),\s*(-?\d+)\)", text)
    require(len(vertices) == 6, "Six explicit public coordinates required")
    points = {name: (int(x), int(y)) for name, x, y in vertices}
    require(
        set(points) == set("".join(triples)) and len(set(points.values())) == 6,
        "Missing or repeated vertex",
    )
    first, second = triples
    coordinate_list = lambda names: ", ".join(
        f"{name}({points[name][0]}, {points[name][1]})" for name in names
    )
    expected_prompt = (
        "On a coordinate grid with equal-length units on both axes, two separate right triangles have hypotenuses on line ℓ. "
        f"Triangle {first} has {coordinate_list(first)}; triangle {second} has {coordinate_list(second)}. "
        f"The right angles are at {first[1]} and {second[1]}. "
        f"The hypotenuses {first[0] + first[2]} and {second[0] + second[2]} lie on ℓ. Choose exactly 3 true statements."
    )
    require(
        text == expected_prompt, "Prompt conditions disagree with named triangle roles"
    )
    a, b, c = (points[n] for n in triples[0])
    d, e, f = (points[n] for n in triples[1])
    for x, y, z in [(a, b, c), (d, e, f)]:
        require(
            x[1] == y[1] and y[0] == z[0],
            "Legs must be horizontal/vertical in stated order",
        )
        require(y[0] > x[0] and z[1] != y[1], "Positive run and nonzero rise required")
        require(
            length2(x, y) != length2(y, z), "Isosceles triangle outside bounded family"
        )
    require(c[0] < d[0] or f[0] < a[0], "Triangles must be separated")
    require(
        cross(vector(a, c), vector(a, d)) == 0
        and cross(vector(a, c), vector(a, f)) == 0,
        "Hypotenuses not on one line",
    )
    require(
        similar(points, *triples),
        "Public triangles must be similar with stated correspondence",
    )
    g = public["figure"]["scene"]["elements"]
    require(
        public["figure"]["kind"] == "scene" and len(g) == 1 and g[0]["type"] == "graph",
        "One public graph required",
    )
    graph = g[0]
    require(graph.get("aspect") == 1, "Geometric graph must preserve equal unit scale")
    actual = {p["label"]: (F(str(p["x"])), F(str(p["y"]))) for p in graph["points"]}
    require(
        len(graph["points"]) == 6 and actual == points, "Prompt/scene vertex mismatch"
    )
    require(len(graph["lines"]) == 1, "One shared line required")
    line = graph["lines"][0]["line"]
    require(
        "through" in line and len(line["through"]) == 2,
        "Exact through-point line required",
    )
    l0, l1 = (tuple(v) for v in line["through"])
    require(
        l0 != l1
        and all(cross(vector(l0, l1), vector(l0, p)) == 0 for p in [a, c, d, f]),
        "Wrong graph line",
    )
    expected = {(a, c), (d, f)}
    shown = {(tuple(t["from"]), tuple(t["to"])) for t in graph["slopeTriangles"]}
    require(
        len(graph["slopeTriangles"]) == 2 and shown == expected,
        "Wrong displayed slope triangles",
    )
    require(
        all(t.get("labels") == "none" for t in graph["slopeTriangles"]),
        "Public triangle annotations changed",
    )
    require(
        all(
            graph["x"][0] < p[0] < graph["x"][1]
            and graph["y"][0] < p[1] < graph["y"][1]
            for p in points.values()
        ),
        "Vertex clipped by graph bounds",
    )
    return points, triples


def vertex_angle(points, triples, vertex):
    names = next((t for t in triples if vertex in t), None)
    require(names is not None, "Unknown angle vertex")
    others = [name for name in names if name != vertex]
    return angle_signature(points, others[0] + vertex + others[1])


def evaluate_claim(label, points, triples):
    text = plain(label).rstrip(".")
    text = re.sub(
        r"^The ratio is ([A-Z]{2}/[A-Z]{2})=(.+)$", r"The ratio \1 is \2", text
    )
    match = re.fullmatch(
        r"Triangles ([A-Z]{3}) and ([A-Z]{3}) are (similar but not congruent|not similar|similar|congruent)",
        text,
    )
    if match:
        first, second, relation = match.groups()
        require(
            set(first) == set(triples[0]) and set(second) == set(triples[1]),
            "Foreign triangle names",
        )
        s, c = similar(points, first, second), congruent(points, first, second)
        return "relation", {
            "similar": s,
            "congruent": c,
            "not similar": not s,
            "similar but not congruent": s and not c,
        }[relation]
    match = re.fullmatch(r"Angles at ([A-Z]) and ([A-Z]) have equal measures", text)
    if match:
        a, b = match.groups()
        return "angle", vertex_angle(points, triples, a) == vertex_angle(
            points, triples, b
        )
    match = re.fullmatch(
        r"The slopes of ([A-Z]{2}) and ([A-Z]{2}) are (equal|unequal)", text
    )
    if match:
        first, second, relation = match.groups()
        require(set(first + second) <= set(points), "Unknown slope segment")
        dx1, dy1 = vector(points[first[0]], points[first[1]])
        dx2, dy2 = vector(points[second[0]], points[second[1]])
        require(dx1 != 0 and dx2 != 0, "Undefined segment slope")
        equal = dy1 * dx2 == dy2 * dx1
        return "slope", equal if relation == "equal" else not equal
    match = re.fullmatch(r"The slope of line ℓ is (-?\d+(?:/\d+)?)", text)
    if match:
        a, _, c = triples[0]
        return "slope", slope(points[a], points[c]) == F(match[1])
    match = re.fullmatch(
        r"(?:The length of )?([A-Z]{2}) is (\d+) times (?:the length of )?([A-Z]{2})",
        text,
    )
    if match:
        target, ratio, base = match.groups()
        require(set(target + base) <= set(points), "Unknown segment")
        kind = (
            "horizontal" if points[base[0]][1] == points[base[1]][1] else "hypotenuse"
        )
        return kind, length2(points[target[0]], points[target[1]]) == int(
            ratio
        ) ** 2 * length2(points[base[0]], points[base[1]])
    match = re.fullmatch(
        r"(?:The ratio )?([A-Z]{2})/([A-Z]{2}) is (\d+(?:/\d+)?)", text
    )
    if match:
        numerator, denominator, ratio = match.groups()
        require(set(numerator + denominator) <= set(points), "Unknown segment")
        return "ratio", F(
            length2(points[numerator[0]], points[numerator[1]]),
            length2(points[denominator[0]], points[denominator[1]]),
        ) == F(ratio) ** 2
    raise ValueError(f"Unrecognized public claim: {label}")


def solve(public):
    points, triples = public_geometry(public)
    response = public["response"]
    require(
        response["kind"] == "multi-select" and response["selectionCount"] == 3,
        "Three selections required",
    )
    options = response["options"]
    require(
        len(options) == 6
        and len({o["id"] for o in options}) == 6
        and len({o["label"] for o in options}) == 6,
        "Six distinct options required",
    )
    require(
        all(re.fullmatch(r"option-[a-f]", o["id"]) for o in options),
        "Foreign option IDs",
    )
    claims = [evaluate_claim(o["label"], points, triples) for o in options]
    require(
        {kind for kind, _ in claims}
        == {"relation", "angle", "slope", "horizontal", "hypotenuse", "ratio"},
        "Repeated or missing conceptual category",
    )
    correct = [o["id"] for o, (_, truth) in zip(options, claims) if truth]
    require(len(correct) == 3, "Exactly three semantic truths required")
    return json.dumps(sorted(correct), separators=(",", ":"))


def review_problem(problem):
    expected = solve(problem["public"])
    require(problem["answer"] == expected, "Wrong or noncanonical complete answer")
    if "explanation" in problem:
        points, triples = public_geometry(problem["public"])
        options = problem["public"]["response"]["options"]
        require(len(problem["explanation"]) == 6, "Every statement needs explanation")
        for option, step in zip(options, problem["explanation"]):
            _, truth = evaluate_claim(option["label"], points, triples)
            require(
                step.startswith(
                    f"“{option['label']}” {'True' if truth else 'False'}: "
                ),
                "Explanation misclassifies claim",
            )
            explanation = plain(step.split(": ", 1)[1])
            for segment, value in re.findall(
                r"(?<![/A-Z])([A-Z]{2})=(\d+)(?=[,;. ]|$)", explanation
            ):
                require(
                    length2(points[segment[0]], points[segment[1]]) == int(value) ** 2,
                    "Incorrect stated leg length",
                )
            for segment, value in re.findall(r"([A-Z]{2})\^2=(\d+)", explanation):
                require(
                    length2(points[segment[0]], points[segment[1]]) == int(value),
                    "Incorrect squared hypotenuse",
                )
            for target, scale, source in re.findall(
                r"([A-Z]{2})=(\d+)\\cdot ([A-Z]{2})", explanation
            ):
                require(
                    length2(points[target[0]], points[target[1]])
                    == int(scale) ** 2 * length2(points[source[0]], points[source[1]]),
                    "Incorrect length scaling",
                )
            for segment, rise, run, quotient in re.findall(
                r"([A-Z]{2}): (?:signed rise/run )?(-?\d+)/(\d+)=(-?\d+(?:/\d+)?)",
                explanation,
            ):
                require(
                    vector(points[segment[0]], points[segment[1]])
                    == (int(run), int(rise))
                    and F(quotient) == F(int(rise), int(run)),
                    "Incorrect signed rise/run equation",
                )

            for segment, squared in re.findall(
                r"([A-Z]{2}) has squared length (\d+)", explanation
            ):
                require(
                    length2(points[segment[0]], points[segment[1]]) == int(squared),
                    "Wrong squared length in explanation",
                )
            for segment, value in re.findall(
                r"([A-Z]{2}) is (\d+) units long", explanation
            ):
                require(
                    length2(points[segment[0]], points[segment[1]]) == int(value) ** 2,
                    "Wrong leg length in explanation",
                )
            for start, end, rise, run in re.findall(
                r"From ([A-Z]) to ([A-Z]) the signed rise is (-?\d+) and the positive run is (\d+)",
                explanation,
            ):
                require(
                    vector(points[start], points[end]) == (int(run), int(rise)),
                    "Wrong signed slope explanation",
                )
            for numerator, denominator, value in re.findall(
                r"([A-Z]{2})/([A-Z]{2})=(-?\d+(?:/\d+)?)", explanation
            ):
                require(
                    F(value) > 0
                    and F(
                        length2(points[numerator[0]], points[numerator[1]]),
                        length2(points[denominator[0]], points[denominator[1]]),
                    )
                    == F(value) ** 2,
                    "Wrong leg ratio explanation",
                )
    return expected


def fixture(scale=2, sign=1):
    points = {
        "A": (0, 1),
        "B": (2, 1),
        "C": (2, 1 + 3 * sign),
        "D": (4, 1 + 6 * sign),
        "E": (4 + 2 * scale, 1 + 6 * sign),
        "F": (4 + 2 * scale, 1 + (6 + 3 * scale) * sign),
    }

    def description(names):
        return ", ".join(f"${n}({points[n][0]}, {points[n][1]})$" for n in names)

    options = [
        "Triangles $ABC$ and $DEF$ are congruent.",
        "Angles at $B$ and $E$ have equal measures.",
        f"The slope of line $ℓ$ is ${3 * sign}/2$.",
        "$DE$ is 2 times $AB$.",
        "$DF$ is 3 times $AC$.",
        "$BC/AB$ is 2.",
    ]
    public = {
        "templateId": next(iter(SUPPORTED)),
        "prompt": "On a coordinate grid with equal-length units on both axes, two separate right triangles have hypotenuses on line $ℓ$. "
        + f"Triangle $ABC$ has {description('ABC')}; triangle $DEF$ has {description('DEF')}. The right angles are at $B$ and $E$. The hypotenuses $AC$ and $DF$ lie on $ℓ$. Choose exactly 3 true statements.",
        "response": {
            "kind": "multi-select",
            "selectionCount": 3,
            "options": [
                {"id": f"option-{chr(97 + i)}", "label": v}
                for i, v in enumerate(options)
            ],
        },
        "figure": {
            "kind": "scene",
            "scene": {
                "elements": [
                    {
                        "type": "graph",
                        "aspect": 1,
                        "x": [-1, 12],
                        "y": [-20, 20],
                        "points": [
                            {"label": n, "x": p[0], "y": p[1]}
                            for n, p in points.items()
                        ],
                        "lines": [{"line": {"through": [points["A"], points["C"]]}}],
                        "slopeTriangles": [
                            {"from": points[a], "to": points[b], "labels": "none"}
                            for a, b in [("A", "C"), ("D", "F")]
                        ],
                    }
                ]
            },
        },
    }
    return {
        "public": public,
        "answer": '["option-a","option-b","option-c"]'
        if scale == 1
        else '["option-b","option-c","option-d"]',
    }


def self_test():
    geometry_fixtures()
    for scale in [1, 2]:
        for sign in [-1, 1]:
            review_problem(fixture(scale, sign))
    for sign in [-1, 1]:
        relational = fixture(2, sign)
        relational["public"]["response"]["options"][2]["label"] = (
            "The slopes of $AC$ and $DF$ are equal."
        )
        review_problem(relational)
        bad = copy.deepcopy(relational)
        bad["public"]["response"]["options"][2]["label"] = (
            "The slopes of $AC$ and $DF$ are unequal."
        )
        try:
            review_problem(bad)
        except ValueError:
            pass
        else:
            raise AssertionError("Accepted false slope comparison")
    # A parser probe with unequal slopes proves it evaluates coordinates,
    # rather than assuming every relational statement says equal.
    probe = {"A": (0, 0), "C": (2, 3), "D": (4, 1), "F": (6, -2)}
    require(
        evaluate_claim("The slopes of $AC$ and $DF$ are unequal.", probe, [])
        == ("slope", True),
        "Unequal signed slopes",
    )
    require(
        evaluate_claim("The slopes of $AC$ and $DF$ are equal.", probe, [])
        == ("slope", False),
        "Opposite signs do not match",
    )
    base = fixture()
    mutants = []
    for wrong in [
        '["option-a","option-b","option-c"]',
        '["option-b","option-b","option-d"]',
        '["option-b","foreign","option-d"]',
        '["option-b","option-c"]',
        '["option-d","option-c","option-b"]',
    ]:
        bad = copy.deepcopy(base)
        bad["answer"] = wrong
        mutants.append(bad)
    bad = copy.deepcopy(base)
    bad["public"]["response"]["selectionCount"] = 2
    mutants.append(bad)
    bad = copy.deepcopy(base)
    bad["public"]["response"]["options"][0]["id"] = "option-b"
    mutants.append(bad)
    bad = copy.deepcopy(base)
    bad["public"]["figure"]["scene"]["elements"][0]["points"][0]["x"] = 1
    mutants.append(bad)
    bad = copy.deepcopy(base)
    bad["public"]["figure"]["scene"]["elements"][0]["aspect"] = 0.7
    mutants.append(bad)
    bad = copy.deepcopy(base)
    bad["public"]["figure"]["scene"]["elements"][0]["lines"][0]["line"]["through"][
        0
    ] = (1, 1)
    mutants.append(bad)
    bad = copy.deepcopy(base)
    bad["public"]["prompt"] = bad["public"]["prompt"].replace(
        "triangle $DEF$", "triangle $DFE$"
    )
    mutants.append(bad)
    bad = copy.deepcopy(base)
    bad["public"]["response"]["options"][1]["label"] = (
        "Angles at $A$ and $F$ have equal measures."
    )
    mutants.append(bad)
    for bad in mutants:
        require(bad != base, "No-op mutation")
        try:
            review_problem(bad)
        except (ValueError, KeyError):
            continue
        raise AssertionError("Accepted corrupt slope-triangle case")
    return {"handwritten_cases": 6, "mutations": len(mutants) + 2}


# Read by independent-math-review.py (FamilyOracle).
REVIEW_RETURNS_ANSWER = True
