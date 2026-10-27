"""Independent review of the number-order slot families from public payloads.

Every position's correct option is found by reading the numbers or the named
quantities out of the prompt, sorting them exactly (Fractions) and mapping the
sorted item to the option that shows it. The private answer, hint and
explanation are values under test. Grading (every blank correct, no partial
credit) is reimplemented in `grade`.
"""

import copy
import json
import re
import sys
from fractions import Fraction as F
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from multi_part_choice_math_oracle import common_response, compact, require  # noqa: E402

SUPPORTED = frozenset({"order-whole-numbers-slots", "order-fractions-slots", "order-rationals-slots"})
TEX_NUMBER = re.compile(r"\$(-?)(?:(\d+(?:\.\d+)?)|\\frac\{(\d+)\}\{(\d+)\})\$")
DIRECTION = re.compile(r"in order from (?:the )?(greatest|least|smallest)(?: \w+)? to (?:the )?(greatest|least|smallest)")


def tex_value(text):
    match = TEX_NUMBER.fullmatch(text)
    require(match is not None, f"Not a number: {text!r}")
    sign, decimal, top, bottom = match.groups()
    value = F(decimal) if decimal is not None else F(int(top), int(bottom))
    return -value if sign else value


def labels_for(count, descending, noun):
    """The positions, first to last, named by their rank."""
    greatest_first = {3: ["Greatest", "Middle", "Least"],
                      4: ["Greatest", "Second greatest", "Second least", "Least"],
                      5: ["Greatest", "Second greatest", "Middle", "Second least", "Least"]}[count]
    names = greatest_first if descending else greatest_first[::-1]
    return [f"{name} {noun}" for name in names]


def read_direction(prompt):
    match = DIRECTION.search(prompt)
    require(match is not None, f"No ordering direction in {prompt!r}")
    first, last = match.groups()
    require((first == "greatest") != (last == "greatest") and "greatest" in (first, last), "Direction must run between greatest and least")
    return first == "greatest"


def read_items(public):
    """[(option label, exact value)] in the order the prompt lists them."""
    template, prompt = public["templateId"], public["prompt"]
    if template == "order-whole-numbers-slots":
        body = prompt.split(": ", 1)[1].rsplit(". Put", 1)[0]
        items = []
        for clause in body.split("; "):
            match = re.fullmatch(r"([A-Z][A-Za-z ]+?) holds (\d{1,3}(?:,\d{3})+|\d+) people", clause)
            require(match is not None, f"Unreadable clause {clause!r}")
            digits = match[2]
            require("," not in digits or re.fullmatch(r"\d{1,3}(,\d{3})+", digits), "Digit grouping")
            items.append((match[1], F(int(digits.replace(",", "")))))
        return items
    colon = prompt.rsplit(": ", 1)[1].rstrip(".")
    return [(label, tex_value(label)) for label in colon.split(", ")]


def solve_detail(public):
    require(public["templateId"] in SUPPORTED, "Wrong family")
    template = public["templateId"]
    descending = read_direction(public["prompt"])
    items = read_items(public)
    require(len(items) in ((3,) if template != "order-rationals-slots" else (4, 5)), f"Count of {template}")
    values = [v for _, v in items]
    require(len(set(values)) == len(values), "Tied values")
    if template == "order-whole-numbers-slots":
        require(len({n for n, _ in items}) == len(items), "Repeated name")
    blanks = common_response(public["response"], "slots", {
        "order-whole-numbers-slots": "Choose the stadium for each position",
        "order-fractions-slots": "Choose the fraction for each position",
        "order-rationals-slots": "Choose the number for each position"}[template])
    noun = {"order-whole-numbers-slots": "capacity", "order-fractions-slots": "fraction", "order-rationals-slots": "number"}[template]
    require([b["label"] for b in blanks] == labels_for(len(items), descending, noun), "Position labels disagree with the prompt")
    require([b["id"] for b in blanks] == [f"p{i + 1}" for i in range(len(items))], "Blank ids")
    ranked = sorted(items, key=lambda it: it[1], reverse=descending)
    key = {}
    for blank, (label, _) in zip(blanks, ranked):
        # every position offers every item once, each option equal to exactly one prompt item
        require([o["label"] for o in blank["options"]] == [n for n, _ in items], "Options must list the items in prompt order")
        hits = [o["id"] for o in blank["options"] if o["label"] == label]
        require(len(hits) == 1, "One correct option")
        key[blank["id"]] = hits[0]
    return compact(key), ranked, descending


def solve(public):
    return solve_detail(public)[0]


def grade(public, key, submitted):
    """Correct only when every blank is answered with its key option."""
    try:
        given = json.loads(submitted)
    except (TypeError, ValueError):
        return False
    return isinstance(given, dict) and list(given) == [b["id"] for b in public["response"]["blanks"]] and given == json.loads(key)


def review_problem(problem):
    public = problem["public"]
    expected, ranked, descending = solve_detail(public)
    require(problem["answer"] == expected, f"Answer {problem['answer']} disagrees with the wording; expected {expected}")
    key = json.loads(expected)
    require(grade(public, expected, expected), "The key must grade correct")
    for blank in public["response"]["blanks"]:
        for option in blank["options"]:
            if option["id"] != key[blank["id"]]:
                wrong = dict(key)
                wrong[blank["id"]] = option["id"]
                require(not grade(public, expected, compact(wrong)), "One wrong blank must fail")
    # a different order is a different answer: reversing the ranking never matches the key
    require(len(ranked) >= 3 and ranked[0][1] != ranked[-1][1], "Ranking")
    text = " ".join([public["prompt"], problem["hint"], *problem["explanation"]])
    names = [label for label, _ in ranked]
    # no leak: the hint and the prompt never already state the finished order
    hint_positions = [problem["hint"].find(n) for n in names]
    require(not (all(p >= 0 for p in hint_positions) and hint_positions == sorted(hint_positions)), "Hint states the order")
    require(not re.search(r"\$\{|\bundefined\b|\bNaN\b|\[object", text), "Unrendered placeholder")
    last = problem["explanation"][-1]
    require(last.endswith(": " + ", ".join(names) + "."), f"Final explanation line must give the order, got {last!r}")
    if public["templateId"] == "order-whole-numbers-slots":
        shown = " < ".join(f"{int(v):,}" for _, v in sorted(ranked, key=lambda it: it[1]))
        require(shown in " ".join(problem["explanation"]), "Explanation chain of comparisons")
    return expected


# ---------------------------------------------------------------- self test

def opts(*labels):
    return [{"id": "abcdef"[i], "label": label} for i, label in enumerate(labels)]


def fixture(template, prompt, names, labels, answer, explanation, hint="Compare the first two numbers."):
    return {"public": {"templateId": template, "seed": "f", "prompt": prompt,
                       "response": {"kind": "multi-part-choice", "label": {
                           "order-whole-numbers-slots": "Choose the stadium for each position",
                           "order-fractions-slots": "Choose the fraction for each position",
                           "order-rationals-slots": "Choose the number for each position"}[template], "layout": "slots",
                                    "blanks": [{"id": f"p{i + 1}", "label": label, "options": opts(*names)} for i, label in enumerate(labels)]}},
            "answer": answer, "hint": hint, "explanation": explanation}


def self_test():
    whole = fixture("order-whole-numbers-slots",
                    "Three stadiums hold crowds of different sizes: Harbor Field holds 55,671 people; Canyon Dome holds 55,138 people; Lakeside Grounds holds 55,759 people. Put the stadiums in order from the greatest capacity to the smallest capacity.",
                    ["Harbor Field", "Canyon Dome", "Lakeside Grounds"], ["Greatest capacity", "Middle capacity", "Least capacity"],
                    '{"p1":"c","p2":"a","p3":"b"}',
                    ["The hundreds digits are 1, 6 and 7, so from smallest to greatest the capacities are 55,138 < 55,671 < 55,759.",
                     "Greatest to smallest: Lakeside Grounds, Harbor Field, Canyon Dome."])
    frac = fixture("order-fractions-slots", "Put these three fractions in order from least to greatest: $\\frac{3}{6}$, $\\frac{5}{12}$, $\\frac{2}{3}$.",
                   ["$\\frac{3}{6}$", "$\\frac{5}{12}$", "$\\frac{2}{3}$"], ["Least fraction", "Middle fraction", "Greatest fraction"],
                   '{"p1":"b","p2":"a","p3":"c"}',
                   ["So $\\frac{5}{12}<\\frac{3}{6}<\\frac{2}{3}$.", "Least to greatest: $\\frac{5}{12}$, $\\frac{3}{6}$, $\\frac{2}{3}$."])
    rational = fixture("order-rationals-slots", "Put these numbers in order from greatest to least: $-0.75$, $-\\frac{1}{5}$, $0.8$, $\\frac{7}{4}$.",
                       ["$-0.75$", "$-\\frac{1}{5}$", "$0.8$", "$\\frac{7}{4}$"],
                       ["Greatest number", "Second greatest number", "Second least number", "Least number"],
                       '{"p1":"d","p2":"c","p3":"b","p4":"a"}',
                       ["Write every number as a decimal.", "Greatest to least: $\\frac{7}{4}$, $0.8$, $-\\frac{1}{5}$, $-0.75$."])
    for base in (whole, frac, rational):
        require(review_problem(base) == base["answer"], "Fixture must pass")
    mutations = 0
    for base, change, what in (
            (whole, lambda p: p.update(answer='{"p1":"a","p2":"c","p3":"b"}'), "swapped positions"),
            (whole, lambda p: p["public"].update(prompt=p["public"]["prompt"].replace("55,138", "55,938")), "changed capacity"),
            (whole, lambda p: p["public"].update(prompt=p["public"]["prompt"].replace("greatest capacity to the smallest", "smallest capacity to the greatest")), "reversed direction"),
            (whole, lambda p: p["public"]["response"]["blanks"][0]["options"].__setitem__(1, {"id": "b", "label": "Harbor Field"}), "repeated option"),
            (whole, lambda p: p["explanation"].__setitem__(1, "Greatest to smallest: Lakeside Grounds, Canyon Dome, Harbor Field."), "false explanation order"),
            (frac, lambda p: p.update(answer='{"p1":"a","p2":"b","p3":"c"}'), "equal-to-half confusion"),
            (frac, lambda p: p["public"]["response"]["blanks"][1].update(label="Greatest fraction"), "position label"),
            (frac, lambda p: p.update(hint="Least to greatest: $\\frac{5}{12}$, $\\frac{3}{6}$, $\\frac{2}{3}$."), "hint states the order"),
            (rational, lambda p: p.update(answer='{"p1":"d","p2":"c","p3":"a","p4":"b"}'), "negatives misordered"),
            (rational, lambda p: p["public"].update(prompt=p["public"]["prompt"].replace("$-\\frac{1}{5}$", "$-0.75$")), "tied value")):
        bad = copy.deepcopy(base)
        change(bad)
        try:
            review_problem(bad)
        except (ValueError, KeyError, TypeError, IndexError, ZeroDivisionError):
            mutations += 1
        else:
            raise AssertionError(f"Accepted corrupt number-order case: {what}")
    return {"fixtures": 3, "mutations": mutations}


REVIEW_RETURNS_ANSWER = True

if __name__ == "__main__":
    print(self_test())
