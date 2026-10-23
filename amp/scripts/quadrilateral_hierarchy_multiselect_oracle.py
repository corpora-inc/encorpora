"""Independent inclusive-quadrilateral implications from public English claims.

Models enumerate all realizable combinations relevant to these claims: two
parallel pairs, four equal sides, four right angles, and equal opposite sides.
A generic irregular quadrilateral and trapezoid share the first profile; an
oblique parallelogram, nonsquare rectangle, nonsquare rhombus and square supply
the other profiles. No generator flags or answer helpers are imported.
"""

import copy
import json
import re

SUPPORTED = {"quadrilateral-hierarchy-multiselect"}
MODELS = (
    (False, False, False, False),
    (True, False, False, True),
    (True, False, True, True),
    (True, True, False, True),
    (True, True, True, True),
)


def require(condition, message):
    if not condition:
        raise ValueError(message)


def category(name, model):
    parallel, equal, right, _ = model
    return {
        "quadrilateral": True,
        "parallelogram": parallel,
        "rectangle": right,
        "rhombus": equal,
        "square": equal and right,
    }[name]


def property_value(words, model):
    properties = {
        "2 pairs of parallel opposite sides": model[0],
        "2 pairs of parallel sides": model[0],
        "4 sides of equal length": model[1],
        "4 equal sides": model[1],
        "4 right angles": model[2],
        "opposite sides of equal length": model[3],
    }
    require(words in properties, f"Unknown property: {words}")
    return properties[words]


def claim(label):
    """Translate a bounded English implication, then test every relevant model."""
    kinds = r"(quadrilateral|parallelogram|rectangle|rhombus|square)"
    text = label.rstrip(".").lower()
    source = target = condition = prop = None
    match = re.fullmatch(
        r"being a " + kinds + r" guarantees that a shape is also a " + kinds, text
    )
    if not match:
        match = re.fullmatch(
            r"(?:a |every )"
            + kinds
            + r"(?: always)? (?:also )?belongs to the "
            + kinds
            + r" group",
            text,
        )
    if match:
        source, target = match.groups()
    elif text == "a square belongs to both the rectangle group and the rhombus group":
        source, target = "square", ("rectangle", "rhombus")
    else:
        match = re.fullmatch(
            r"any " + kinds + r" with (.+) must (?:also be a|be a|be a[n]?) " + kinds,
            text,
        )
        if match:
            source, condition, target = match.groups()
        else:
            match = re.fullmatch(r"any " + kinds + r" with (.+) must have (.+)", text)
            if match:
                source, condition, prop = match.groups()
            else:
                match = re.fullmatch(
                    r"(?:every )?(squares|rectangles|rhombuses|rectangle|rhombus) (?:have|has) (.+)",
                    text,
                )
                require(match is not None, f"Unrecognized claim: {label}")
                source, prop = match.groups()
                source = {
                    "squares": "square",
                    "rectangles": "rectangle",
                    "rhombuses": "rhombus",
                }.get(source, source)
    eligible = [
        m
        for m in MODELS
        if category(source, m) and (condition is None or property_value(condition, m))
    ]
    require(bool(eligible), "Vacuous premise")
    targets = target if isinstance(target, tuple) else (target,)
    return all(
        all(category(t, m) for t in targets) if target else property_value(prop, m)
        for m in eligible
    )


def solve(public):
    require(public["templateId"] in SUPPORTED, "Wrong family")
    require(
        public["prompt"]
        == "Choose the 3 statements that are always true about quadrilaterals. A shape may belong to more than one category.",
        "Unexpected task",
    )
    response = public["response"]
    require(
        response["kind"] == "multi-select" and response["selectionCount"] == 3,
        "Wrong selection contract",
    )
    options = response["options"]
    require(len(options) in (5, 6), "Expected five or six statements")
    ids = [o["id"] for o in options]
    labels = [o["label"] for o in options]
    require(
        len(set(ids)) == len(ids)
        and all(re.fullmatch(r"option-[a-f]", i) for i in ids),
        "Duplicate or foreign option ID",
    )
    require(len(set(labels)) == len(labels), "Duplicate claim")
    correct = [o["id"] for o in options if claim(o["label"])]
    require(len(correct) == 3, "Task does not have exactly three true claims")
    return json.dumps(sorted(correct), separators=(",", ":"))


def review_problem(problem):
    expected = solve(problem["public"])
    require(problem["answer"] == expected, "Wrong or noncanonical complete answer set")
    explanations = problem.get("explanation", [])
    require(
        len(explanations) == len(problem["public"]["response"]["options"]),
        "Missing statement explanation",
    )
    for option, explanation in zip(
        problem["public"]["response"]["options"], explanations
    ):
        prefix = (
            f"“{option['label']}” {'True' if claim(option['label']) else 'False'}: "
        )
        require(explanation.startswith(prefix), "Explanation misclassifies claim")
        rectangle = re.search(r"rectangle (\d+) cm wide and (\d+) cm long", explanation)
        if rectangle:
            a, b = map(int, rectangle.groups())
            require(
                0 < a < b, "Rectangle counterexample must have unequal positive sides"
            )
        angles = re.search(
            r"alternating angles of \$(\d+)\^\\circ\$ and \$(\d+)\^\\circ\$",
            explanation,
        )
        if angles:
            a, b = map(int, angles.groups())
            require(
                0 < a < 180 and a + b == 180 and a != 90,
                "Invalid nonsquare rhombus counterexample",
            )
    return expected


def self_test():
    labels = [
        "A square belongs to both the rectangle group and the rhombus group.",
        "Rectangles have opposite sides of equal length.",
        "Any quadrilateral with 4 equal sides must be a rhombus.",
        "Being a rectangle guarantees that a shape is also a rhombus.",
        "Every quadrilateral belongs to the parallelogram group.",
    ]
    public = {
        "templateId": next(iter(SUPPORTED)),
        "prompt": "Choose the 3 statements that are always true about quadrilaterals. A shape may belong to more than one category.",
        "response": {
            "kind": "multi-select",
            "selectionCount": 3,
            "options": [
                {"id": f"option-{chr(97 + i)}", "label": label}
                for i, label in enumerate(labels)
            ],
        },
    }
    answer = '["option-a","option-b","option-c"]'
    require(solve(public) == answer, "Handwritten five-option fixture")
    six = copy.deepcopy(public)
    six["response"]["options"].append(
        {"id": "option-f", "label": "Every rhombus has 4 right angles."}
    )
    require(solve(six) == answer, "Handwritten six-option fixture")
    for source, truth in [
        ("Any rhombus with 4 right angles must also be a square.", True),
        (
            "Any quadrilateral with 2 pairs of parallel sides must have 4 equal sides.",
            False,
        ),
        ("Being a parallelogram guarantees that a shape is also a rectangle.", False),
    ]:
        require(claim(source) == truth, "Independent implication fixture")
    mutants = []
    for field, value in [("selectionCount", 2), ("kind", "choice")]:
        bad = copy.deepcopy(public)
        bad["response"][field] = value
        mutants.append(bad)
    for field, value in [
        ("id", "option-a"),
        ("id", "foreign"),
        ("label", labels[0]),
        ("label", "Squares have 4 right angles."),
    ]:
        bad = copy.deepcopy(public)
        bad["response"]["options"][-1][field] = value
        mutants.append(bad)
    bad = copy.deepcopy(public)
    bad["response"]["options"].pop()
    mutants.append(bad)
    for bad in mutants:
        try:
            solve(bad)
        except ValueError:
            continue
        raise AssertionError("Accepted malformed public fixture")
    problem = {
        "public": public,
        "answer": answer,
        "explanation": [
            f"“{label}” {'True' if claim(label) else 'False'}: Definition check."
            for label in labels
        ],
    }
    review_problem(problem)
    for wrong in [
        '["option-a","option-a","option-c"]',
        '["option-a","option-b","foreign"]',
        '["option-a","option-b"]',
        '["option-a","option-b","option-d"]',
        '["option-c","option-b","option-a"]',
    ]:
        bad = copy.deepcopy(problem)
        bad["answer"] = wrong
        try:
            review_problem(bad)
        except ValueError:
            continue
        raise AssertionError("Accepted corrupt private answer")
    for suffix in [
        "A rectangle 4 cm wide and 4 cm long has unequal neighboring sides.",
        "A rhombus has alternating angles of $90^\\circ$ and $90^\\circ$, with no right angles.",
        "A rhombus has alternating angles of $50^\\circ$ and $120^\\circ$, with no right angles.",
    ]:
        bad = copy.deepcopy(problem)
        bad["explanation"][-2] += suffix
        try:
            review_problem(bad)
        except ValueError:
            continue
        raise AssertionError("Accepted invalid numerical counterexample")
    bad = copy.deepcopy(problem)
    bad["explanation"][0] = bad["explanation"][0].replace("True:", "False:")
    try:
        review_problem(bad)
    except ValueError:
        pass
    else:
        raise AssertionError("Accepted false explanation classification")
    return {
        "public_mutations": len(mutants),
        "answer_mutations": 5,
        "explanation_mutations": 4,
    }
