"""Independent K.OA.A.1 oracle: derive the model only from the public story."""
import copy
import json
import re

SUPPORTED = {"build-the-number-sentence"}
CHOICE_REVIEW = SUPPORTED
REVIEW_RETURNS_ANSWER = True


def givens(public):
    prompt = public["prompt"]
    expression = re.search(r"(\d+)\s*([+−-])\s*(\d+)", prompt)
    if expression:
        x, sign, y = expression.groups()
        return int(x), "-" if sign in ("-", "−") else "+", int(y)
    numbers = [int(n) for n in re.findall(r"\b\d+\b", prompt)]
    assert len(numbers) == 2, "Story must state a start and a change"
    leaves = bool(re.search(r"\b(eats|gives away|swims? away|flies away|fly away|hops? away|runs? away)\b", prompt))
    joins = bool(re.search(r"\b(gets|comes?|flies over|fly over|hops? in|joins?|join)\b", prompt))
    assert leaves != joins, "Story needs one unambiguous action"
    return numbers[0], "-" if leaves else "+", numbers[1]


def solve(public):
    x, sign, y = givens(public)
    result = x + y if sign == "+" else x - y
    return json.dumps({"groups": [x, y] if sign == "+" else [x], "removed": y if sign == "-" else 0,
                       "sentence": [x, sign, y, result]}, separators=(",", ":"))


def review_problem(problem):
    public = problem["public"]
    response = public["response"]
    x, sign, y = givens(public)
    total = x + y if sign == "+" else x
    assert 1 <= x <= 10 and 1 <= y <= 9 and total <= 10
    assert sign == "+" or x > y
    assert response["kind"] == "counter-builder"
    assert response["max"] == 10
    assert response["canRemove"] == (sign == "-")
    assert response["board"] == ("row" if sign == "-" else "frame" if "ten frame" in public["prompt"] else "two-groups")
    assert response["thing"] + "s" in public["prompt"] or re.search(r"\b" + response["thing"] + r"\b", public["prompt"])
    expected = solve(public)
    assert problem["answer"] == expected, "Key does not represent the public story"
    # The worked model must show every starting object and exactly the crossed-out count.
    elements = problem.get("walkthrough", {}).get("elements", [])
    assert sum(e["type"] == "path" for e in elements) == 2 * total
    assert sum(e["type"] == "segment" for e in elements) == (2 * y if sign == "-" else 0)
    return expected


def self_test():
    for prompt, expected in [
        ("Show $3 + 2$ with apples.", {"groups": [3, 2], "removed": 0, "sentence": [3, "+", 2, 5]}),
        ("5 frogs are on the log. 2 frogs hop away. Show the story.", {"groups": [5], "removed": 2, "sentence": [5, "-", 2, 3]}),
        ("Maya has 4 cups. Maya gives away 1. Show the story.", {"groups": [4], "removed": 1, "sentence": [4, "-", 1, 3]}),
    ]:
        assert json.loads(solve({"prompt": prompt})) == expected
    return 3


if __name__ == "__main__":
    import sys
    self_test()
    cases = [json.loads(line) for line in sys.stdin if line.strip()]
    for problem in cases:
        review_problem(problem)
        for part in ("groups", "removed", "sentence"):
            bad = copy.deepcopy(problem)
            answer = json.loads(bad["answer"])
            if part == "groups":
                answer[part][0] += 1
            elif part == "removed":
                answer[part] += 1
            else:
                answer[part][3] += 1
            bad["answer"] = json.dumps(answer, separators=(",", ":"))
            try:
                review_problem(bad)
            except AssertionError:
                pass
            else:
                raise AssertionError("Corrupted model accepted")
    print(f"Verified {len(cases)} stories and {3 * len(cases)} corrupted keys")
