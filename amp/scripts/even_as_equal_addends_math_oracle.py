"""Choose the equation with two equal addends that sum to the shown socks."""
import re

SUPPORTED = frozenset({"even-as-equal-addends"})
CHOICE_REVIEW = SUPPORTED


def require(condition, message):
    if not condition:
        raise ValueError(message)


def parts_of(label):
    text = label.replace("$", "").replace(" ", "")
    match = re.fullmatch(r"(\d+)=(.+)", text)
    require(match is not None, f"Not an equation: {label!r}")
    parts = [int(piece) for piece in match.group(2).split("+")]
    return int(match.group(1)), parts


def solve(public):
    require(public["templateId"] in SUPPORTED, "Wrong family")
    match = re.search(r"There are (\d+) socks", public["prompt"])
    require(match is not None, "The sock count is missing")
    n = int(match.group(1))
    require(n % 2 == 0 and 2 <= n <= 20, "Socks must be an even count from 2 to 20")
    equal = []
    seen = set()
    for option in public["response"]["options"]:
        require(option["label"] not in seen, "Repeated equation")
        seen.add(option["label"])
        total, parts = parts_of(option["label"])
        require(total == n and sum(parts) == n and parts, "Equation does not total the socks")
        if len(parts) == 2 and parts[0] == parts[1]:
            equal.append(option["id"])
    require(len(equal) == 1, "Exactly one equation has two equal addends")
    if n >= 6:
        pairs = "+".join(["2"] * (n // 2))
        require(any(parts_of(option["label"])[1] == [2] * (n // 2) for option in public["response"]["options"]),
                "The pairs-as-addends option is missing")
        require(pairs.count("+") >= 2, "Pairs need more than one plus")
    return equal[0]


def review_problem(problem):
    expected = solve(problem["public"])
    require(problem["answer"] == expected, f"Answer {problem['answer']} != {expected}")
    require(expected not in problem["hint"], "Hint quotes the answer id")
    correct = next(option["label"] for option in problem["public"]["response"]["options"] if option["id"] == expected)
    require(correct.replace("$", "") not in problem["hint"].replace("$", ""), "Hint quotes the equation")
    wrong = {option["id"] for option in problem["public"]["response"]["options"]} - {expected}
    require(set(problem.get("choiceFeedback") or {}) == wrong, "Feedback for each wrong equation")
    return expected


def self_test():
    options = [
        {"id": "option-a", "label": "$8 = 3 + 5$"},
        {"id": "option-b", "label": "$8 = 4 + 4$"},
        {"id": "option-c", "label": "$8 = 2 + 2 + 2 + 2$"},
        {"id": "option-d", "label": "$8 = 8 + 0$"},
    ]
    problem = {
        "public": {
            "templateId": "even-as-equal-addends",
            "prompt": "There are 8 socks. Put them in two equal groups. Which equation shows the 8 socks?",
            "response": {"kind": "choice", "options": options},
        },
        "answer": "option-b",
        "hint": "There are 8 socks in pairs.",
        "explanation": ["8 is 4 and 4."],
        "choiceFeedback": {"option-a": "Unequal.", "option-c": "Pairs.", "option-d": "Empty."},
    }
    require(review_problem(problem) == "option-b", "Eight socks")
    return {"ok": True}


if __name__ == "__main__":
    print(self_test())
