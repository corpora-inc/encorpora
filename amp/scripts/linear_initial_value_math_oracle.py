"""Independent initial-value review from public equations, statements and figures.

No generator imports or private context/coefficient data. Each offered statement
is evaluated as an amount at zero/one or a per-unit/whole-interval change.
"""

import copy
import re

SUPPORTED = frozenset({"linear-initial-value-meaning"})


def solve(public):
    assert public["templateId"] in SUPPORTED
    prompt = public["prompt"].replace("−", "-")
    duration = int(re.search(r"For the first (\d+)", prompt)[1])
    formula = re.search(r"\$([VHC]) = ([^$]+)\$", prompt)
    output, expression = formula.groups()
    expression = expression.replace(" ", "")
    # Interpret a public sum of integer constants and integer-times-input terms.
    terms = re.findall(r"[+-]?[^+-]+", expression)
    assert "".join(terms) == expression
    m = b = 0
    variable = None
    for term in terms:
        variable_term = re.fullmatch(r"([+-]?\d*)([thd])", term)
        if variable_term:
            assert variable in (None, variable_term[2]), "Mixed input variables"
            m += (
                int(variable_term[1])
                if variable_term[1] not in ("", "+", "-")
                else (-1 if variable_term[1] == "-" else 1)
            )
            variable = variable_term[2]
        else:
            b += int(term)
    assert variable == {"V": "t", "H": "h", "C": "d"}[output]
    assert m and b >= 0 and b + m * duration >= 0
    requested = re.search(r"What does (?:the number )?(\d+) mean", prompt)
    assert requested and int(requested[1]) == b
    units = {
        "V": ("minutes", "liters"),
        "H": ("hours", "centimeters"),
        "C": ("kilometers", "dollars"),
    }[output]
    assert units[0] in prompt and "in " + units[1] in prompt
    graph = public["figure"]["scene"]["elements"][0]
    assert graph["type"] == "graph" and graph["x"] == [0, duration]
    assert graph["axisNames"] == list(units)
    assert graph["lines"] == [{"line": {"m": m, "b": b}}]
    assert [(p["x"], p["y"]) for p in graph["points"]] == [(0, b)]
    assert graph["y"][0] == 0 and graph["y"][1] >= max(b, b + m * duration)
    assert public["response"]["kind"] == "choice"
    options = public["response"]["options"]
    truth = []
    seen = set()
    assert len(options) == 4 and len({o["id"] for o in options}) == 4
    for option in options:
        label = option["label"]
        assert label not in seen
        seen.add(label)
        claimed = int(re.search(r"\d+", label)[0])
        assert units[1] in label
        if "each " in label:
            assert ("lost" in label) == (m < 0)
            actual = abs(m)
        elif "first " in label:
            assert ("lost" in label) == (m < 0)
            interval = int(re.search(r"first (\d+)", label)[1])
            assert interval == duration
            actual = abs(m) * interval
        elif "one minute" in label or "one hour" in label or "one kilometer" in label:
            actual = b + m
        else:
            assert any(
                s in label
                for s in [
                    "when filling began",
                    "when it was lit",
                    "before any distance was traveled",
                ]
            )
            actual = b
        if claimed == actual:
            truth.append(option["id"])
    assert len(truth) == 1
    return truth[0]


def review_problem(problem):
    answer = solve(problem["public"])
    assert answer == problem["answer"], "Incorrect initial-value choice"
    return answer


def self_test():
    public = {
        "templateId": "linear-initial-value-meaning",
        "prompt": "For the first 4 hours after lighting, the height $H$ of a candle, in centimeters, is modeled by $H = 17 - h$, where $h$ is hours since lighting. What does 17 mean?",
        "figure": {
            "kind": "scene",
            "scene": {
                "elements": [
                    {
                        "type": "graph",
                        "x": [0, 4],
                        "y": [0, 20],
                        "axisNames": ["hours", "centimeters"],
                        "points": [{"x": 0, "y": 17}],
                        "lines": [{"line": {"m": -1, "b": 17}}],
                    }
                ]
            },
        },
        "response": {
            "kind": "choice",
            "options": [
                {
                    "id": "a",
                    "label": "The candle was 17 centimeters tall when it was lit.",
                },
                {
                    "id": "b",
                    "label": "The candle lost 17 centimeters of height each hour.",
                },
                {
                    "id": "c",
                    "label": "The candle was 17 centimeters tall one hour after it was lit.",
                },
                {
                    "id": "d",
                    "label": "The candle lost 17 centimeters of height during the first 4 hours.",
                },
            ],
        },
    }
    assert solve(public) == "a"
    reordered = copy.deepcopy(public)
    reordered["prompt"] = public["prompt"].replace("17 - h", "-h + 17")
    reordered["response"]["options"].reverse()
    assert solve(reordered) == "a"
    mutants = []
    bad = copy.deepcopy(public)
    bad["figure"]["scene"]["elements"][0]["lines"][0]["line"]["b"] = 16
    mutants.append(bad)
    bad = copy.deepcopy(public)
    bad["figure"]["scene"]["elements"][0]["points"][0]["y"] = 16
    mutants.append(bad)
    bad = copy.deepcopy(public)
    bad["figure"]["scene"]["elements"][0]["axisNames"].reverse()
    mutants.append(bad)
    bad = copy.deepcopy(public)
    bad["response"]["options"][2]["label"] = (
        "The candle was 16 centimeters tall one hour after it was lit."
    )
    mutants.append(bad)  # Two distinct true statements, not duplicate text.
    bad = copy.deepcopy(public)
    bad["response"]["options"][0]["label"] = (
        "The candle was 18 centimeters tall when it was lit."
    )
    mutants.append(bad)
    bad = copy.deepcopy(public)
    bad["response"]["options"][1]["label"] = (
        "The candle gained 17 centimeters of height each hour."
    )
    mutants.append(bad)
    for bad in mutants:
        try:
            solve(bad)
        except (AssertionError, ValueError):
            continue
        raise AssertionError("Malformed public initial-value problem accepted")
    try:
        review_problem({"public": public, "answer": "b"})
    except AssertionError:
        pass
    else:
        raise AssertionError("Incorrect private answer accepted")
    return {"fixtures": 2, "rejectedMutations": len(mutants) + 1}


# Read by independent-math-review.py (FamilyOracle).
CHOICE_REVIEW = SUPPORTED
