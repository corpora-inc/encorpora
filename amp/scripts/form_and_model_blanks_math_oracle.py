"""Independent review of the form-and-model-blanks family (multi-part-choice-v1).

Conversions between fractions, decimals, percents and mixed numbers, the
solutions of linear inequalities, a conversion proportion, the parameters of an
exponential model and circle estimates are all recomputed exactly from the
displayed prompt. Each blank passes only when exactly one option has the
computed meaning.
"""

import copy
import json
import math
import re
from fractions import Fraction as F

from multipart_oracle_support import (
    N, P, T, compact, expect_rejected, key_of, number_of, numbers_in, pick,
    public_text, require, response_of, review, sentence_of, untex,
)

SUPPORTED = frozenset({
    "fraction-forms-blanks", "decimal-mixed-number-blanks", "inequality-solution-blanks",
    "conversion-proportion-blanks", "exponential-parameters-blanks", "circle-estimate-blanks",
})
REVIEW_RETURNS_ANSWER = True


def match(pattern, text, what):
    m = re.search(pattern, text)
    require(m is not None, f"Unreadable {what}: {text!r}")
    return m


def fraction_forms(public):
    _, blanks = response_of(public, "inline", ["decimal", "percent"])
    m = match(r"Write \\frac\{(\d+)\}\{(\d+)\} as a decimal and as a percent", untex(public["prompt"]), "fraction")
    value = F(int(m[1]), int(m[2]))
    return {"decimal": pick(blanks["decimal"], N(value)), "percent": pick(blanks["percent"], P(value * 100))}


def decimal_mixed(public):
    response, blanks = response_of(public, "inline", ["whole", "num", "den"])
    text = untex(public["prompt"])
    m = match(r"Write (\d+)\.(\d+) as a mixed number", text, "decimal")
    whole, fraction = int(m[1]), F(int(m[2]), 10 ** len(m[2]))
    require(fraction.numerator != 0, "A mixed number needs a fractional part")
    # The fraction part may be written unreduced (tenths or hundredths); the pair of
    # numerator and denominator options must be unique.
    pairs = [
        (n["id"], d["id"])
        for n in blanks["num"]["options"] for d in blanks["den"]["options"]
        if number_of(d["label"])[1] != 0 and number_of(n["label"])[1] / number_of(d["label"])[1] == fraction
        and number_of(n["label"])[1] < number_of(d["label"])[1]
    ]
    require(len(pairs) == 1, f"{len(pairs)} numerator and denominator pairs equal the fractional part")
    return {"whole": pick(blanks["whole"], N(whole)), "num": pairs[0][0], "den": pairs[0][1]}


OPS = {"\\ge": ">=", "\\le": "<=", ">": ">", "<": "<"}
FLIP = {">=": "<=", "<=": ">=", ">": "<", "<": ">"}


def number_text(text):
    key = number_of(text)
    require(key is not None and key[0] == "n", f"Unreadable number {text!r}")
    return key[1]


def read_inequality(text):
    s = untex(text).replace(" ", "")
    m = re.fullmatch(r"(-?\d*)x(?:([+-]\d+))?(\\ge|\\le|>|<)(-?\d+)", s)
    require(m is not None, f"Unreadable inequality {text!r}")
    a = int(m[1] + "1") if m[1] in ("", "-") else int(m[1])
    return a, int(m[2] or 0), OPS[m[3]], int(m[4])


def solution_of(text):
    a, b, op, c = read_inequality(text)
    require(a != 0, "Zero coefficient")
    return (FLIP[op] if a < 0 else op), F(c - b, a)


def read_solution(label):
    m = re.fullmatch(r"x(\\ge|\\le|>|<)(.+)", untex(label).replace(" ", ""))
    require(m is not None, f"Unreadable solution {label!r}")
    return OPS[m[1]], number_text(m[2])


def inequality_solution(public):
    _, blanks = response_of(public, "slots")
    text = untex(public["prompt"])
    picks = {}
    for blank_id, blank in blanks.items():
        label = match(r"^The solution of (.+)$", blank["label"], "slot label")[1]
        require(untex(label) in text, "The slot names an inequality of the prompt")
        expected = solution_of(label)
        options = [read_solution(o["label"]) for o in blank["options"]]
        require(len(set(options)) == len(options), "Distinct solutions")
        hits = [o["id"] for o, value in zip(blank["options"], options) if value == expected]
        require(len(hits) == 1, f"{blank_id}: {len(hits)} options solve {label}")
        picks[blank_id] = hits[0]
    return picks


def conversion(public):
    _, blanks = response_of(public, "inline", ["a", "b", "c", "d"])
    text = untex(public["prompt"])
    m = match(r"One (\w+) is about (\d[\d.]*) (\w+)\.", text, "conversion factor")
    first, rate, second = m[1], F(m[2]), m[3]
    n = match(r"finds x, the number of (\w+) in (\d[\d,]*) (\w+)", text, "target")
    second_p, first_p = n[1], n[3]
    require(second_p.rstrip("s") == second.rstrip("s") and first_p.rstrip("s") == first.rstrip("s"),
            "The target converts the first unit into the second")
    amount = F(n[2].replace(",", ""))
    sentence = sentence_of(public["response"])
    require(sentence == f"{first_p.capitalize()} to {second_p}: " + "{a} : {b} = {c} : {d}", "Both ratios put the first unit on the left")
    wanted = {
        f"The {first_p} in the conversion factor": N(1),
        f"The {second_p} in the conversion factor": N(rate),
        f"The {first_p} to convert": N(amount),
        f"The {second_p} to find": T("x"),
    }
    picks = {}
    for blank_id, blank in blanks.items():
        require(blank["label"] in wanted, f"Unknown slot {blank['label']!r}")
        picks[blank_id] = pick(blank, wanted[blank["label"]])
    require(len({blank["label"] for blank in blanks.values()}) == 4, "Four different roles")
    return picks


def exponential(public):
    _, blanks = response_of(public, "inline", ["start", "dir", "pct"])
    text = untex(public["prompt"])
    m = match(r"=(\d[\d,]*)\((\d[\d.]*)\)\^\{t\}", text, "model")
    start, base = F(m[1].replace(",", "")), F(m[2])
    require(base > 0 and base != 1, "Growth or decay base")
    return {
        "start": pick(blanks["start"], N(start)),
        "dir": pick(blanks["dir"], T("increases" if base > 1 else "decreases")),
        "pct": pick(blanks["pct"], N(abs(base - 1) * 100)),
    }


def round_half_up(value, places):
    scale = 10 ** places
    return F(math.floor(value * scale + F(1, 2)), scale)


def circle(public):
    response, blanks = response_of(public, "inline")
    text = untex(public["prompt"])
    ids = list(blanks)
    if ids == ["radius", "area"]:
        m = match(r"circular sign is (\d+) feet across\. Use (\d\.\d+) for \\pi to estimate its area", text, "sign")
        diameter, pi = F(m[1]), F(m[2])
        radius = diameter / 2
        return {"radius": pick(blanks["radius"], N(radius)), "area": pick(blanks["area"], N(pi * radius * radius))}
    require(ids == ["top", "bottom", "pi"], f"Blank ids {ids}")
    m = match(r"circumference of (\d[\d.]*) centimeters and a diameter of (\d[\d.]*) centimeters", text, "circle")
    circumference, diameter = F(m[1]), F(m[2])
    ratio = circumference / diameter
    # "About": the quotient is the nearest hundredth, and no other option is close.
    expected = round_half_up(ratio, 2)
    values = [number_text(o["label"]) for o in blanks["pi"]["options"]]
    require(sum(abs(v - ratio) < F(1, 20) for v in values) == 1, "Only one option is near the quotient")
    return {"top": pick(blanks["top"], T("circumference")), "bottom": pick(blanks["bottom"], T("diameter")), "pi": pick(blanks["pi"], N(expected))}


SOLVERS = {
    "fraction-forms-blanks": fraction_forms,
    "decimal-mixed-number-blanks": decimal_mixed,
    "inequality-solution-blanks": inequality_solution,
    "conversion-proportion-blanks": conversion,
    "exponential-parameters-blanks": exponential,
    "circle-estimate-blanks": circle,
}


def solve_picks(public):
    require(public["templateId"] in SUPPORTED, "Wrong family")
    return SOLVERS[public["templateId"]](public)


def solve(public):
    picks = solve_picks(public)
    return compact({b["id"]: picks[b["id"]] for b in public["response"]["blanks"]})


def review_problem(problem):
    return review(problem, solve_picks)


# ---------------------------------------------------------------- self test

def opts(*labels):
    return [{"id": "abcdef"[i], "label": label} for i, label in enumerate(labels)]


def inline(template, prompt, sentence, blanks, answer, layout="inline"):
    response = {"kind": "multi-part-choice", "label": "Choose", "layout": layout,
                "blanks": [{"id": i, "label": l, "options": opts(*o)} for i, l, o in blanks]}
    if layout == "inline":
        response["sentence"] = [{"text": p} if isinstance(p, str) else {"blank": p[1]} for p in sentence]
    return {"public": {"templateId": template, "prompt": prompt, "response": response}, "answer": compact(answer), "explanation": [], "hint": "Think."}


def fixtures():
    yards = ["$x$", "1", "800", "0.91"]
    return {
        "forms": inline("fraction-forms-blanks", "Write $\\frac{17}{20}$ as a decimal and as a percent. Complete the sentence.",
                        ["$\\frac{17}{20}$ is equal to the decimal ", ("b", "decimal"), " and to the percent ", ("b", "percent"), "."],
                        [("decimal", "The decimal", ["0.17", "0.85", "0.085", "0.15"]), ("percent", "The percent", ["85%", "850%", "8.5%", "0.85%"])],
                        {"decimal": "b", "percent": "a"}),
        "mixed": inline("decimal-mixed-number-blanks", "Write 8.11 as a mixed number. Complete the sentence.",
                        ["8.11 is the mixed number ", ("b", "whole"), " and ", ("b", "num"), " over ", ("b", "den"), "."],
                        [("whole", "The whole number", ["9", "8", "11", "811"]), ("num", "The numerator of the fraction", ["1", "11", "12", "811"]),
                         ("den", "The denominator of the fraction", ["100", "1,000", "8", "10"])], {"whole": "b", "num": "b", "den": "a"}),
        "inequalities": inline("inequality-solution-blanks", "Choose the solution of each inequality: $-5x-7\\ge-37$ and $-6x+7\\le55$.", None,
                               [("q1", "The solution of $-5x-7\\ge-37$", ["$x\\le37$", "$x\\ge6$", "$x\\le-6$", "$x\\le6$"]),
                                ("q2", "The solution of $-6x+7\\le55$", ["$x\\ge8$", "$x\\le8$", "$x\\ge-9$", "$x\\ge-8$"])], {"q1": "d", "q2": "d"}, layout="slots"),
        "proportion": inline("conversion-proportion-blanks", "One yard is about 0.91 meter. The first ratio in the proportion is the conversion factor, yards to meters. Complete the proportion that finds $x$, the number of meters in 800 yards.",
                             ["Yards to meters: ", ("b", "a"), " : ", ("b", "b"), " = ", ("b", "c"), " : ", ("b", "d")],
                             [("a", "The yards in the conversion factor", yards), ("b", "The meters in the conversion factor", yards),
                              ("c", "The yards to convert", yards), ("d", "The meters to find", yards)], {"a": "b", "b": "d", "c": "c", "d": "a"}),
        "model": inline("exponential-parameters-blanks", "The value of a machine after $t$ years is modeled by $V(t)=400(1.2)^{t}$. Complete the sentence about the model.",
                        ["The starting amount is ", ("b", "start"), " dollars. Each year the amount ", ("b", "dir"), " by ", ("b", "pct"), " percent."],
                        [("start", "The starting amount", ["480", "1.2", "400", "420"]), ("dir", "Whether the amount increases or decreases", ["increases", "decreases"]),
                         ("pct", "The percent change each year", ["2", "120", "1.2", "20"])], {"start": "c", "dir": "a", "pct": "d"}),
        "sign": inline("circle-estimate-blanks", "A circular sign is 4 feet across. Use 3.14 for $\\pi$ to estimate its area. Complete the sentence.",
                       ["The radius is ", ("b", "radius"), " feet, so the area is about ", ("b", "area"), " square feet."],
                       [("radius", "The radius in feet", ["16", "4", "2"]), ("area", "The area in square feet", ["12.56", "50.24", "25.12"])], {"radius": "c", "area": "a"}),
        "pi": inline("circle-estimate-blanks", "A circle has a circumference of 28.3 centimeters and a diameter of 9 centimeters. Complete the sentence about estimating $\\pi$.",
                     ["To estimate $\\pi$, divide the ", ("b", "top"), " by the ", ("b", "bottom"), "; the quotient is about ", ("b", "pi"), "."],
                     [("top", "The measurement divided", ["circumference", "diameter", "radius"]), ("bottom", "The measurement divided by", ["circumference", "diameter", "radius"]),
                      ("pi", "The quotient", ["19.3", "3.14", "0.32", "6.29"])], {"top": "a", "bottom": "b", "pi": "b"}),
    }


def self_test():
    cases = fixtures()
    for c in cases.values():
        review_problem(c)
    require({c["public"]["templateId"] for c in cases.values()} == SUPPORTED, "A fixture for every template")
    rejected = 0
    for name, c in cases.items():
        key = json.loads(c["answer"])
        ids = list(key)

        def corrupt(what, change):
            nonlocal rejected
            bad = copy.deepcopy(c)
            change(bad)
            require(bad != c, f"No-op mutation {what}")
            rejected += expect_rejected(review_problem, bad, f"{name}: {what}")

        first = ids[0]
        other = "a" if key[first] != "a" else "b"
        corrupt("wrong answer", lambda p: p.update(answer=compact({**key, first: other})))
        corrupt("missing blank", lambda p: p.update(answer=compact({k: v for k, v in key.items() if k != first})))
        corrupt("keys out of order", lambda p: p.update(answer=compact(dict(reversed(list(key.items()))))))
        blank = c["public"]["response"]["blanks"][0]
        right = next(o["label"] for o in blank["options"] if o["id"] == key[first])
        spare = next(i for i, o in enumerate(blank["options"]) if o["id"] != key[first])
        corrupt("two correct options", lambda p: p["public"]["response"]["blanks"][0]["options"][spare].update(label=right))
        for b in c["public"]["response"]["blanks"]:
            label = next(o["label"] for o in b["options"] if o["id"] == key[b["id"]])
            k = key_of(label)
            if k[0] == "n" and "\\" not in label and abs(k[1]) not in numbers_in(public_text(c["public"])) and abs(k[1]) not in (0, 1):
                corrupt("leaking hint", lambda p: p.update(hint=f"The answer is {label}."))
                break
    bad = copy.deepcopy(cases["inequalities"])
    bad["public"]["response"]["blanks"][0]["options"][3]["label"] = "$x\\ge6$"
    rejected += expect_rejected(review_problem, bad, "reversed symbol duplicates a distractor")
    bad = copy.deepcopy(cases["inequalities"])
    bad["public"]["response"]["blanks"][1]["options"][3]["label"] = "$x\\le-8$"
    rejected += expect_rejected(review_problem, bad, "no option solves the inequality")
    bad = copy.deepcopy(cases["model"])
    bad["public"]["prompt"] = bad["public"]["prompt"].replace("(1.2)", "(0.8)")
    rejected += expect_rejected(review_problem, bad, "decay model with growth answers")
    bad = copy.deepcopy(cases["proportion"])
    bad["public"]["response"]["sentence"][0] = {"text": "Meters to yards: "}
    rejected += expect_rejected(review_problem, bad, "ratio order reversed")
    bad = copy.deepcopy(cases["pi"])
    bad["public"]["prompt"] = bad["public"]["prompt"].replace("28.3", "25.1")
    rejected += expect_rejected(review_problem, bad, "different circumference")
    return {"fixtures": len(cases), "rejectedMutations": rejected}


if __name__ == "__main__":
    print(self_test())
