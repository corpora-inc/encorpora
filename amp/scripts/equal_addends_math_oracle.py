"""Derive array sums from public dimensions or the story, independently of TS."""
import copy
import json
import re

SUPPORTED = {"array-equal-addends-equation"}
CHOICE_REVIEW = SUPPORTED
REVIEW_RETURNS_ANSWER = True


def solve(public):
    response = public["response"]
    if response["mode"] == "given":
        rows, columns = response["rows"], response["columns"]
    else:
        match = re.search(r"in (\d+) rows with (\d+) in each row", public["prompt"])
        assert match, "Story must give both dimensions"
        rows, columns = map(int, match.groups())
    assert 2 <= rows <= 5 and 2 <= columns <= 5
    by_columns = "Add the columns." in public["prompt"]
    assert response["orientation"] == ("columns" if by_columns else "either")
    return {"rows": rows, "columns": columns,
            "addends": [rows] * columns if by_columns else [columns] * rows,
            "total": sum([columns] * rows)}


def review_problem(problem):
    expected = solve(problem["public"])
    assert json.loads(problem["answer"]) == expected, "Wrong array, addends or total"
    elements = problem["walkthrough"]["elements"]
    assert sum(e["type"] == "path" and e["fill"] == "accent" for e in elements) == expected["total"]
    return json.dumps(expected, separators=(",", ":"))


def self_test():
    for mode in ("given", "build"):
        p = {"prompt": "Arrange cups in 3 rows with 4 in each row.",
             "response": {"mode": mode, "orientation": "either", "rows": 3, "columns": 4}}
        assert solve(p) == {"rows": 3, "columns": 4, "addends": [4, 4, 4], "total": 12}
    return 2


if __name__ == "__main__":
    import sys
    self_test()
    cases = [json.loads(line) for line in sys.stdin if line.strip()]
    for problem in cases:
        review_problem(problem)
        for part in ("rows", "columns", "addends", "total"):
            bad = copy.deepcopy(problem)
            key = json.loads(bad["answer"])
            if part == "addends":
                key[part][0] += 1
            else:
                key[part] += 1
            bad["answer"] = json.dumps(key)
            try:
                review_problem(bad)
            except AssertionError:
                pass
            else:
                raise AssertionError("Corrupted key accepted")
    print(f"Verified {len(cases)} arrays and {len(cases) * 4} corrupted keys")
