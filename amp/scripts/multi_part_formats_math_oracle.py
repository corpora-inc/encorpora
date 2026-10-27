"""Independent review of the multi-part format families (the rule of a table,
and equations marked true or not true) from public payloads only.

The key is decided from the shown table or from the displayed equations with
exact Fractions; the private answer, hint and explanation are only values
under test. Every displayed row or blank is judged once.
"""

import json
import re
import sys
from fractions import Fraction as F
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from multi_part_choice_math_oracle import (  # noqa: E402
    common_response, compact, evaluate, pick, require, tex_tree, tree_vars,
)

SUPPORTED = frozenset({"table-rule-sentence", "substitution-match-table"})
PHRASES = {"increased by": "add", "decreased by": "subtract", "multiplied by": "multiply", "divided by": "divide"}
APPLY = {"add": lambda x, n: x + n, "subtract": lambda x, n: x - n,
         "multiply": lambda x, n: x * n, "divide": lambda x, n: F(x) / n}
KIND = {"add": "additive", "subtract": "additive", "multiply": "multiplicative", "divide": "multiplicative"}
PLACEHOLDER = re.compile(r"\$\{|\bundefined\b|\bNaN\b|\bnull\b|\[object")


def read_table(public):
    elements = public["figure"]["scene"]["elements"]
    require(len(elements) == 1 and elements[0]["type"] == "lineTable", "A table")
    rows = elements[0]["rows"]
    require(len(rows) == 2 and rows[0][0] == "x" and rows[1][0] == "y", "x then y")
    xs, ys = [F(v) for v in rows[0][1:]], [F(v) for v in rows[1][1:]]
    require(len(xs) == len(ys) >= 4 and xs == sorted(set(xs)), "Four or more increasing x values")
    return xs, ys


def rules_of(xs, ys):
    """Every (operation, n) with n a positive whole number that fits all pairs."""
    found = []
    for op, f in APPLY.items():
        for n in range(1, 40):
            if all(f(x, F(n)) == y for x, y in zip(xs, ys)):
                found.append((op, n))
    return found


def solve_rule(public):
    require(public["prompt"] == "The table shows $x$ and $y$ values that follow one rule. Complete the sentence.", "Prompt")
    xs, ys = read_table(public)
    rules = rules_of(xs, ys)
    require(len(rules) == 1, f"The table must follow exactly one rule, found {rules}")
    op, n = rules[0]
    response = public["response"]
    blanks = common_response(response, "inline", "Choose an answer for each blank")
    ids = tuple(b["id"] for b in blanks)
    key = {}
    if ids == ("op", "num"):
        require(response["sentence"] == [{"text": "Each $y$ is the $x$ above it "}, {"blank": "op"}, {"text": " "},
                                         {"blank": "num"}, {"text": "."}], "Sentence")
        require({o["label"] for o in blanks[0]["options"]} == set(PHRASES), "Operation options")
        key["op"] = pick(blanks[0], op, lambda label: PHRASES[label])
    else:
        require(ids == ("kind", "num"), "Blank ids")
        require(response["sentence"] == [{"text": "This relationship is "}, {"blank": "kind"},
                                         {"text": ", and the number in its rule is "}, {"blank": "num"}, {"text": "."}], "Sentence")
        require({o["label"] for o in blanks[0]["options"]} == {"additive", "multiplicative"}, "Kind options")
        key["kind"] = pick(blanks[0], KIND[op], lambda label: label)
    key["num"] = pick(blanks[1], n, lambda label: int(label))
    return compact(key), (xs, ys, op, n, ids)


def side_value(text, variable, value):
    tree = tex_tree(text)
    require(tree_vars(tree) <= {variable}, f"Unexpected variable in {text!r}")
    return evaluate(tree, {variable: value})


def solve_substitution(public):
    match = re.fullmatch(r"Mark each equation as true or not true when \$([a-z]) = (-?\d+)\$\.", public["prompt"])
    require(match is not None, f"Unrecognized prompt {public['prompt']!r}")
    variable, value = match.group(1), F(match.group(2))
    response = public["response"]
    blanks = common_response(response, "table", "Choose one column in each row")
    require(response.get("rowHeader") == "Equation", "Row header")
    require(4 <= len(blanks) <= 5, "Four or five equations")
    require(blanks[0]["options"] == [{"id": "a", "label": "True"}, {"id": "b", "label": "Not true"}], "Columns")
    require(len({b["label"] for b in blanks}) == len(blanks), "Repeated equation")
    key, rows = {}, []
    for blank in blanks:
        label = blank["label"]
        require(label.startswith("$") and label.endswith("$") and label.count("=") == 1, f"Equation {label!r}")
        left, right = label.strip("$").split(" = ")
        lv, rv = side_value(left, variable, value), side_value(right, variable, value)
        key[blank["id"]] = pick(blank, "True" if lv == rv else "Not true", lambda l: l)
        rows.append((label, lv, rv))
    require(any(lv == rv for _, lv, rv in rows) and any(lv != rv for _, lv, rv in rows), "Both verdicts must appear")
    return compact(key), (variable, value, rows)


def review_substitution_explanation(problem, variable, value, rows):
    explanation = problem["explanation"]
    require(len(explanation) == len(rows) + 1, "One lead line and one line per row")
    for line, (label, lv, rv) in zip(explanation[1:], rows):
        match = re.fullmatch(re.escape(label) + r": the left side is \$(.+?)\$ and the right side is \$(.+?)\$, so it is (true|not true)\.", line)
        require(match is not None, f"Row line {line!r}")
        parts = match.group(1).split(" = ")
        require(len(parts) == 2, f"Work {match.group(1)!r}")
        require(evaluate(tex_tree(parts[0]), {}) == lv == evaluate(tex_tree(parts[1]), {}), f"Substitution work of {label}")
        require(evaluate(tex_tree(match.group(2)), {}) == rv, f"Right side of {label}")
        require((match.group(3) == "true") == (lv == rv), f"Verdict of {label}")


def review_rule_explanation(problem, xs, ys, op, n):
    explanation = problem["explanation"]
    require(len(explanation) == 3, "Three explanation lines")
    for x, y, line in ((xs[0], ys[0], explanation[0]), ):
        require(f"$x = {x}$ to $y = {y}$" in line, f"First pair in {line!r}")
    for number in re.findall(r"\$(\d+) (?:\\cdot|\\div|\+|-) (\d+) = (\d+)\$", " ".join(explanation)):
        a, b, c = (F(v) for v in number)
        require(b == n and c in ys and a in xs, f"Worked check {number}")
        require(APPLY[op](a, b) == c, f"Worked check {number} is false")
    require(re.search(rf"\b{n}\b", explanation[2]) is not None, "Last line names the number")


def solve(public):
    template = public["templateId"]
    require(template in SUPPORTED, "Wrong family")
    require(public["response"].get("kind") == "multi-part-choice", "Response protocol")
    return (solve_rule if template == "table-rule-sentence" else solve_substitution)(public)[0]


def review_problem(problem):
    public = problem["public"]
    template = public["templateId"]
    require(template in SUPPORTED, "Wrong family")
    require(public["response"].get("kind") == "multi-part-choice", "Response protocol")
    if template == "table-rule-sentence":
        expected, (xs, ys, op, n, ids) = solve_rule(public)
        review_rule_explanation(problem, xs, ys, op, n)
    else:
        expected, (variable, value, rows) = solve_substitution(public)
        review_substitution_explanation(problem, variable, value, rows)
    require(isinstance(problem["answer"], str) and problem["answer"] == expected,
            f"Answer {problem['answer']} disagrees with the wording; expected {expected}")
    require(list(json.loads(problem["answer"])) == [b["id"] for b in public["response"]["blanks"]], "Answer keys follow blank order")
    for text in [public["prompt"], problem["hint"], *problem["explanation"]]:
        require(not PLACEHOLDER.search(text), f"Unrendered placeholder in {text!r}")
    return expected


# ---------------------------------------------------------------- self test

def opts(*labels):
    return [{"id": "abcdef"[i], "label": label} for i, label in enumerate(labels)]


def self_test():
    figure = {"kind": "scene", "scene": {"v": 1, "elements": [{"type": "lineTable", "rows": [["x", "2", "4", "6", "8"], ["y", "6", "12", "18", "24"]]}]}}
    rule = {"public": {"templateId": "table-rule-sentence", "seed": "f", "figure": figure,
                       "prompt": "The table shows $x$ and $y$ values that follow one rule. Complete the sentence.",
                       "response": {"kind": "multi-part-choice", "label": "Choose an answer for each blank", "layout": "inline",
                                    "blanks": [{"id": "op", "label": "the operation", "options": opts("divided by", "multiplied by", "increased by", "decreased by")},
                                               {"id": "num", "label": "the number", "options": opts("4", "3", "6", "2")}],
                                    "sentence": [{"text": "Each $y$ is the $x$ above it "}, {"blank": "op"}, {"text": " "}, {"blank": "num"}, {"text": "."}]}},
            "answer": '{"op":"b","num":"b"}', "hint": "Compare 2 and 6.",
            "explanation": ["Compare each $x$ with the $y$ below it. From $x = 2$ to $y = 6$: $2 \\cdot 3 = 6$.",
                            "The same operation works for every pair: $4 \\cdot 3 = 12$ and $8 \\cdot 3 = 24$.",
                            "Each $y$ is the $x$ above it multiplied by 3."]}
    require(review_problem(rule) == rule["answer"], "Rule fixture")
    table = {"public": {"templateId": "substitution-match-table", "seed": "f",
                        "prompt": "Mark each equation as true or not true when $m = -5$.",
                        "response": {"kind": "multi-part-choice", "label": "Choose one column in each row", "layout": "table", "rowHeader": "Equation",
                                     "blanks": [{"id": f"r{i + 1}", "label": label, "options": opts("True", "Not true")}
                                                for i, label in enumerate(["$3m + 4 = -11$", "$m + 6 = -1$", "$\\frac{m}{5} = -1$", "$-2m = -10$"])]}},
             "answer": '{"r1":"a","r2":"b","r3":"a","r4":"b"}', "hint": "Replace $m$ with −5 in $3m + 4 = -11$.",
             "explanation": ["An equation is true for $m = -5$ when both sides have the same value.",
                             "$3m + 4 = -11$: the left side is $3 \\cdot (-5) + 4 = -11$ and the right side is $-11$, so it is true.",
                             "$m + 6 = -1$: the left side is $(-5) + 6 = 1$ and the right side is $-1$, so it is not true.",
                             "$\\frac{m}{5} = -1$: the left side is $\\frac{-5}{5} = -1$ and the right side is $-1$, so it is true.",
                             "$-2m = -10$: the left side is $-2 \\cdot (-5) = 10$ and the right side is $-10$, so it is not true."]}
    require(review_problem(table) == table["answer"], "Match table fixture")
    mutations = 0
    for base, change, what in (
            (rule, lambda p: p.update(answer='{"op":"b","num":"a"}'), "number of the first output"),
            (rule, lambda p: p["public"]["figure"]["scene"]["elements"][0]["rows"][1].__setitem__(2, "13"), "table follows no rule"),
            (rule, lambda p: p["explanation"].__setitem__(1, "The same operation works for every pair: $4 \\cdot 3 = 13$ and $8 \\cdot 3 = 24$."), "false worked check"),
            (table, lambda p: p.update(answer='{"r1":"b","r2":"b","r3":"a","r4":"b"}'), "wrong verdict"),
            (table, lambda p: p["public"].update(prompt="Mark each equation as true or not true when $m = 5$."), "sign slip in the prompt"),
            (table, lambda p: p["explanation"].__setitem__(2, p["explanation"][2].replace("so it is not true", "so it is true")), "verdict in the explanation")):
        import copy
        bad = copy.deepcopy(base)
        change(bad)
        try:
            review_problem(bad)
        except (ValueError, KeyError, TypeError, IndexError, ZeroDivisionError):
            mutations += 1
        else:
            raise AssertionError(f"Accepted corrupt multi-part format case: {what}")
    return {"fixtures": 2, "mutations": mutations}


REVIEW_RETURNS_ANSWER = True

if __name__ == "__main__":
    print(self_test())
