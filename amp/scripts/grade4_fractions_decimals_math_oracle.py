"""Independent oracle for the grade-4 fraction and decimal notation types.

Answers are recomputed from the public prompt, figure and options. Generated
answers, hints and explanations are checked, never used as the source of the key.
"""

import copy
import json
import re
from fractions import Fraction

from multipart_oracle_support import (
    T,
    pick,
    require,
    response_of,
    sentence_of,
    untex,
)

SUPPORTED = frozenset({
    "fraction-decompositions-select",
    "mixed-fraction-sum",
    "like-fraction-sum-story",
    "unit-fraction-multiple-blanks",
    "equivalent-fractions-number-line",
    "compare-fractions-symbol-blanks",
    "compare-decimals-symbol-blanks",
    "decimal-fraction-locate",
    "decimal-place-value-hundredths",
})
REVIEW_RETURNS_ANSWER = True

GRADE4_DENOMS = {2, 3, 4, 5, 6, 8, 10, 12, 16, 100}
LINE_DENOMS = {2, 3, 4, 5, 6, 8, 10, 12, 100}


def rational(numerator, denominator):
    require(denominator > 0, "Zero denominator")
    value = Fraction(numerator, denominator)
    if value.denominator == 1:
        return str(value.numerator)
    return f"{value.numerator}/{value.denominator}"


def compact(value):
    if isinstance(value, list) and value and isinstance(value[0], tuple):
        value = dict(value)
    return json.dumps(value, separators=(",", ":"))


def fractions_in(label):
    return [(int(n), int(d)) for n, d in re.findall(r"\\frac\{(\d+)\}\{(\d+)\}", untex(label))]


def same_amount(parts, numerator, denominator):
    value = sum(Fraction(n, d) for n, d in parts)
    return value == Fraction(numerator, denominator)


def selection_of(public):
    response = public["response"]
    require(response.get("kind") == "multi-select", "Multi-select response")
    options = response["options"]
    require(3 <= len(options) <= 8, "Three to eight options")
    require(2 <= response["selectionCount"] < len(options), "Selection count")
    require(
        [o["id"] for o in options] == [f"option-{chr(97 + i)}" for i in range(len(options))],
        "Option ids",
    )
    labels = [o["label"] for o in options]
    require(len(set(labels)) == len(labels) and all(len(label) <= 120 for label in labels), "Option labels")
    return response, options


def selected_ids(options, true):
    ids = [o["id"] for o, ok in zip(options, true) if ok]
    require(len(ids) == len({*ids}), "Duplicate keyed ids")
    return compact(sorted(ids))


def target_amount(text, denominator):
    text = text.strip()
    mixed = re.fullmatch(r"(\d+)\\frac\{(\d+)\}\{(\d+)\}", text)
    if mixed:
        whole, rest, denom = (int(mixed[1]), int(mixed[2]), int(mixed[3]))
        require(denom == denominator and 0 < rest < denom and whole >= 1, "Mixed target")
        return whole * denom + rest
    bare = re.fullmatch(r"\\frac\{(\d+)\}\{(\d+)\}", text)
    if bare:
        numerator, denom = int(bare[1]), int(bare[2])
        require(denom == denominator and numerator > 0, "Fraction target")
        return numerator
    whole = re.fullmatch(r"(\d+)", text)
    require(whole is not None and int(whole[1]) >= 2, "Whole target")
    return int(whole[1]) * denominator


def decompositions(public):
    prompt = untex(public["prompt"])
    den = re.search(r"denominator (\d+)", prompt)
    choose = re.search(r"Choose (\d+)\.", prompt)
    require(den is not None and choose is not None, "Decomposition prompt")
    denominator = int(den[1])
    mixed = re.search(r"(\d+)\\frac\{(\d+)\}\{(\d+)\}", prompt)
    bare = re.search(r"\\frac\{(\d+)\}\{(\d+)\}", prompt)
    if mixed:
        token = mixed[0]
    elif bare:
        token = bare[0]
    else:
        whole = re.search(r"\b(\d+)\b", prompt)
        require(whole is not None, "Decomposition target")
        token = whole[1]
    numerator = target_amount(token, denominator)
    require(int(choose[1]) >= 2, "Choose count")
    figure = public.get("figure")
    require(figure and figure.get("kind") == "fraction-strips", "Strip figure")
    require(figure["parts"] == denominator and figure["unit"] == "one whole", "Strip unit")
    require(figure["rows"][0]["selected"] == numerator, "Strip shading")
    require(figure["wholes"] == -(-numerator // denominator), "Strip wholes")
    _, options = selection_of(public)
    require(options and public["response"]["selectionCount"] == int(choose[1]), "Choose count matches")
    flags = []
    for option in options:
        parts = fractions_in(option["label"])
        require(parts, "Sum label")
        equals = same_amount(parts, numerator, denominator)
        if equals:
            require(all(d == denominator for _, d in parts), "A true sum uses another denominator")
        flags.append(equals)
    require(sum(flags) == public["response"]["selectionCount"], "Keyed sums")
    unit = [
        parts
        for ok, option in zip(flags, options)
        if ok
        for parts in [fractions_in(option["label"])]
        if all(n == 1 and d == denominator for n, d in parts) and len(parts) == numerator
    ]
    require(unit, "Unit-fraction sum")
    return selected_ids(options, flags)


def plain_fractions(text):
    """Read both 3/4 and a lone typeset fraction as 3/4. A glued mixed number
    such as 2\\frac{1}{4} is left for the target parser."""
    return re.sub(r"(?<=\s)\\frac\{(\d+)\}\{(\d+)\}", r"\1/\2", untex(text))


def mixed_sum(public):
    prompt = plain_fractions(public["prompt"])
    found = re.findall(r"(\d+) (\d+)/(\d+)", prompt)
    require(len(found) == 2, "Mixed sum prompt")
    require(re.search(r"fraction or (?:a )?whole number", prompt), "Mixed sum asks for a fraction")
    w1, a, d = map(int, found[0])
    w2, b, d2 = map(int, found[1])
    require(d == d2 and d in GRADE4_DENOMS and 0 < a < d and 0 < b < d, "Mixed sum parts")
    require(public["response"]["kind"] == "fraction", "Fraction response")
    require(public.get("figure") is None, "No figure")
    return rational((w1 + w2) * d + a + b, d)


def sum_story(public):
    prompt = plain_fractions(public["prompt"])
    found = re.findall(r"(\d+)/(\d+)", prompt)
    require(len(found) == 2, "Join story prompt")
    a, d = map(int, found[0])
    b, d2 = map(int, found[1])
    require(d == d2 and d in GRADE4_DENOMS and 0 < a < d and 0 < b < d, "Like addends")
    require(public["response"]["kind"] == "fraction" and public.get("figure") is None, "Story response")
    return rational(a + b, d)


def unit_multiple(public):
    _, blanks = response_of(public, "inline", ["copies", "pieces"])
    sentence = untex(sentence_of(public["response"]))
    found = re.fullmatch(
        r"\\frac\{(\d+)\}\{(\d+)\}=\s*\{copies\}\s*\\times\\frac\{1\}\{\2\}\s*"
        r"(?:\\frac\{(\d+)\}\{\2\}\\times\s*(\d+)|(\d+)\\times\\frac\{(\d+)\}\{\2\})"
        r"=\s*\{pieces\}\s*\\times\\frac\{1\}\{\2\}",
        sentence,
    )
    require(found is not None, "Unit-fraction sentence")
    copies = int(found[1])
    denominator = int(found[2])
    if found[3] is not None:
        group, groups = int(found[3]), int(found[4])
    else:
        groups, group = int(found[5]), int(found[6])
    require(denominator in {3, 4, 5, 6, 8, 10, 12}, "Unit denominator")
    require(copies >= 2 and group >= 2 and groups >= 2, "Counts")
    figure = public.get("figure")
    require(
        figure and figure.get("kind") == "fraction-strips"
        and figure["parts"] == denominator and figure["wholes"] == 1
        and figure["rows"][0]["selected"] == group and figure["unit"] == "one whole",
        "One group on the strips",
    )
    product = groups * group
    return compact([
        ("copies", pick(blanks["copies"], ("n", Fraction(copies)))),
        ("pieces", pick(blanks["pieces"], ("n", Fraction(product)))),
    ])


def number_line_names(public):
    prompt = untex(public["prompt"])
    found = re.search(
        r"Each whole (?:is split into|has) (\d+) equal (?:steps|parts)\. Which fractions name P\? Choose 3\.",
        prompt,
    )
    require(found is not None, "Number-line prompt")
    base = int(found[1])
    figure = public.get("figure")
    require(figure and figure.get("kind") == "rational-line", "Number line")
    require(figure["denominator"] == base and figure["unit"] == "one whole", "Line unit")
    require(len(figure["points"]) == 1 and figure["points"][0]["label"] == "P", "Point P")
    steps = figure["points"][0]["numerator"]
    require(isinstance(steps, int) and steps > 0 and steps != base, "Steps")
    require(1 <= figure["maxWhole"] <= 3 and steps <= base * figure["maxWhole"], "Line range")
    _, options = selection_of(public)
    require(public["response"]["selectionCount"] == 3, "Choose 3")
    value = Fraction(steps, base)
    flags = []
    denoms = []
    for option in options:
        parts = fractions_in(option["label"])
        require(len(parts) == 1, "One fraction")
        numerator, denominator = parts[0]
        require(denominator != 16 and denominator in LINE_DENOMS, "Grade-4 denominator")
        ok = Fraction(numerator, denominator) == value
        flags.append(ok)
        if ok:
            denoms.append(denominator)
    require(sum(flags) == 3 and len(set(denoms)) == 3, "Three denominator names")
    return selected_ids(options, flags)


def symbol_for(left, right):
    if left < right:
        return "<"
    if left > right:
        return ">"
    return "="


def fraction_symbols(public):
    _, blanks = response_of(public, "inline", ["c1", "c2"])
    sentence = untex(sentence_of(public["response"]))
    parts = re.findall(r"\\frac\{(\d+)\}\{(\d+)\}", sentence)
    require(len(parts) == 4, "Four fractions")
    pairs = [(int(n), int(d)) for n, d in parts]
    require(all(d in GRADE4_DENOMS and 0 < n < d * 6 for n, d in pairs), "Fraction pair")
    # Unlike pairs may share a denominator. Equality is about the amounts.
    def amounts_differ(left, right):
        return left[0] * right[1] != right[0] * left[1]

    require(
        amounts_differ(pairs[0], pairs[1]) or amounts_differ(pairs[2], pairs[3]),
        "An unequal pair",
    )
    picks = {}
    for blank, (left_n, left_d), (right_n, right_d) in (
        ("c1", pairs[0], pairs[1]),
        ("c2", pairs[2], pairs[3]),
    ):
        symbol = symbol_for(left_n * right_d, right_n * left_d)
        picks[blank] = pick(blanks[blank], T(symbol))
    return compact(picks)


def hundredths_of(text):
    whole, frac = text.split(".")
    require(whole.isdigit() and frac.isdigit(), "Decimal")
    return int(whole) * 100 + int((frac + "00")[:2])


def trailing_zero_equal(left, right):
    if hundredths_of(left) != hundredths_of(right):
        return False
    lengths = sorted((len(left.split(".")[1]), len(right.split(".")[1])))
    longer = left if len(left.split(".")[1]) >= len(right.split(".")[1]) else right
    return lengths == [1, 2] and longer.endswith("0")


def decimal_symbols(public):
    _, blanks = response_of(public, "inline", ["c1", "c2"])
    sentence = untex(sentence_of(public["response"]))
    rows = re.findall(r"(\d+\.\d+)\s*\{c([12])\}\s*(\d+\.\d+)", sentence)
    require(len(rows) == 2 and [row[1] for row in rows] == ["1", "2"], "Two decimal rows")
    equal = [trailing_zero_equal(left, right) for left, _, right in rows]
    require(equal.count(True) == 1, "One trailing-zero equality")
    unequal = next((left, right) for (left, _, right), same in zip(rows, equal) if not same)
    require(hundredths_of(unequal[0]) != hundredths_of(unequal[1]), "Unequal row")
    require(
        len(unequal[0].split(".")[1]) != len(unequal[1].split(".")[1]),
        "Mixed lengths",
    )
    picks = {}
    for blank, (left, _, right) in zip(("c1", "c2"), rows):
        picks[blank] = pick(blanks[blank], T(symbol_for(hundredths_of(left), hundredths_of(right))))
    return compact(picks)


def locate(public):
    prompt = untex(public["prompt"])
    tenths = re.fullmatch(r"(?:Which point is at|Which letter marks) \\frac\{(\d+)\}\{10\}\?", prompt)
    hundredths = re.fullmatch(r"(?:Which point is at|Which letter marks) (\d+\.\d{2})\?", prompt)
    require((tenths is None) != (hundredths is None), "Locate prompt")
    response = public["response"]
    require(response.get("kind") == "choice", "Choice response")
    options = response["options"]
    require([o["id"] for o in options] == [f"option-{c}" for c in "abcd"], "Four choices")
    figure = public.get("figure")
    require(figure and figure.get("kind") == "scene", "Scene")
    lines = [e for e in figure["scene"]["elements"] if e.get("type") == "numberLine"]
    require(len(lines) == 1, "One number line")
    line = lines[0]
    labels = line.get("labels")
    require(isinstance(labels, list) and len(labels) == 2, "End labels only")
    marks = line.get("marks") or []
    require(len(marks) == 4, "Four marks")
    if tenths:
        target = int(tenths[1]) / 10
        hits = [m for m in marks if abs(float(m["at"]) - target) < 1e-6]
    else:
        target = hundredths[1]
        hits = [m for m in marks if f"{float(m['at']):.2f}" == target]
    require(len(hits) == 1, "One mark at the value")
    for mark in marks:
        require(all(abs(float(mark["at"]) - float(end)) > 1e-6 for end in labels), "A mark is an end label")
    letter = hits[0]["label"]
    chosen = [o["id"] for o in options if untex(o["label"]) == letter]
    require(len(chosen) == 1 and letter in "ABCD", "One letter")
    return chosen[0]


def place_value(public):
    prompt = untex(public["prompt"])
    shown = re.findall(r"(\d\.\d\d)", prompt)
    require(len(shown) == 1 and "Complete the sentence" in prompt, "Hundredths number")
    number = shown[0]
    _, blanks = response_of(public, "inline", ["place", "value"])
    sentence = untex(sentence_of(public["response"]))
    digit = re.fullmatch(
        r"The digit (\d) is in the \{place\} place\. Its value is \{value\}\.",
        sentence,
    )
    require(digit is not None, "Place sentence")
    asked = digit[1]
    require(asked != "0" and number.count(asked) == 1, "One nonzero digit")
    index = number.index(asked)
    place = {0: "ones", 2: "tenths", 3: "hundredths"}[index]
    value = {"ones": asked, "tenths": f"0.{asked}", "hundredths": f"0.0{asked}"}[place]
    return compact([
        ("place", pick(blanks["place"], T(place))),
        ("value", pick(blanks["value"], ("n", Fraction(value)))),
    ])


SOLVERS = {
    "fraction-decompositions-select": decompositions,
    "mixed-fraction-sum": mixed_sum,
    "like-fraction-sum-story": sum_story,
    "unit-fraction-multiple-blanks": unit_multiple,
    "equivalent-fractions-number-line": number_line_names,
    "compare-fractions-symbol-blanks": fraction_symbols,
    "compare-decimals-symbol-blanks": decimal_symbols,
    "decimal-fraction-locate": locate,
    "decimal-place-value-hundredths": place_value,
}


def solve(public):
    require(public["templateId"] in SUPPORTED, "Wrong family")
    return SOLVERS[public["templateId"]](public)


def review_problem(problem):
    expected = solve(problem["public"])
    require(problem.get("answer") == expected, f"Answer {problem.get('answer')!r} != {expected!r}")
    return expected


def _options(labels):
    return [{"id": f"option-{chr(97 + i)}", "label": label} for i, label in enumerate(labels)]


def _select(template, prompt, labels, count, answer, figure):
    return {
        "public": {
            "templateId": template,
            "prompt": prompt,
            "response": {
                "kind": "multi-select",
                "label": "Choose",
                "selectionCount": count,
                "options": _options(labels),
            },
            "figure": figure,
        },
        "answer": answer,
        "hint": "Add the parts.",
        "explanation": ["Checked."],
    }


def _fraction(template, prompt, answer):
    return {
        "public": {
            "templateId": template,
            "prompt": prompt,
            "response": {"kind": "fraction", "label": "Amount"},
        },
        "answer": answer,
        "hint": "Add.",
        "explanation": ["Checked."],
    }


def _blanks(template, prompt, sentence, blanks, answer, figure=None, layout="inline", label="Choose"):
    response = {
        "kind": "multi-part-choice",
        "label": label,
        "layout": layout,
        "blanks": [
            {"id": bid, "label": name, "options": [{"id": "abcdef"[i], "label": text} for i, text in enumerate(opts)]}
            for bid, name, opts in blanks
        ],
        "sentence": [{"text": part} if isinstance(part, str) else {"blank": part[1]} for part in sentence],
    }
    if layout == "cards":
        response["reuse"] = True
    public = {"templateId": template, "prompt": prompt, "response": response}
    if figure:
        public["figure"] = figure
    return {"public": public, "answer": answer, "hint": "Compare.", "explanation": ["Checked."]}


def _must_fail(problem, change, what):
    bad = copy.deepcopy(problem)
    change(bad)
    require(bad != problem, f"No-op mutation {what}")
    try:
        review_problem(bad)
    except (ValueError, TypeError, KeyError, AttributeError, IndexError):
        return
    raise ValueError(f"Corrupt case was accepted: {what}")


def self_test():
    strips = {
        "kind": "fraction-strips",
        "parts": 4,
        "wholes": 1,
        "rows": [{"selected": 3, "label": "shaded amount"}],
        "unit": "one whole",
    }
    decompose = _select(
        "fraction-decompositions-select",
        r"Which sums equal $\frac{3}{4}$? The pieces in each sum use the denominator 4. Choose 2.",
        [
            r"$\frac{1}{4}+\frac{1}{4}+\frac{1}{4}$",
            r"$\frac{1}{4}+\frac{1}{4}$",
            r"$\frac{2}{4}+\frac{1}{4}$",
            r"$\frac{3}{4}+\frac{1}{4}$",
            r"$\frac{1}{8}+\frac{3}{4}$",
        ],
        2,
        '["option-a","option-c"]',
        strips,
    )
    mixed = _fraction(
        "mixed-fraction-sum",
        "Find 1 1/4 + 1 1/4. Give a fraction or whole number.",
        "5/2",
    )
    story = _fraction(
        "like-fraction-sum-story",
        "Maya walks 3/4 of a meter along a path, then 2/4 of a meter farther on the same path. The two lengths are parts of the same path. How much of the path does she walk in all?",
        "5/4",
    )
    symbols = ["$<$", "$=$", "$>$"]
    group = {
        "kind": "fraction-strips",
        "parts": 5,
        "wholes": 1,
        "rows": [{"selected": 2, "label": "one group"}],
        "unit": "one whole",
    }
    multiple = _blanks(
        "unit-fraction-multiple-blanks",
        r"Fill in both boxes. The pieces are of size $\frac{1}{5}$.",
        [r"$\frac{2}{5}=$ ", ("b", "copies"), r" $\times\frac{1}{5}$" + "\n" + r"$\frac{2}{5}\times 3=$ ", ("b", "pieces"), r" $\times\frac{1}{5}$"],
        [
            ("copies", "How many copies of the unit fraction", ["3", "2", "10", "1"]),
            ("pieces", "How many pieces in the product", ["6", "5", "7", "2"]),
        ],
        '{"copies":"b","pieces":"a"}',
        group,
        label="Fill in both boxes",
    )
    line = {
        "kind": "rational-line",
        "denominator": 4,
        "maxWhole": 1,
        "points": [{"numerator": 3, "label": "P"}],
        "unit": "one whole",
    }
    names = _select(
        "equivalent-fractions-number-line",
        r"Point $P$ is marked on the line. Each whole is split into 4 equal steps. Which fractions name $P$? Choose 3.",
        [r"$\frac{3}{4}$", r"$\frac{4}{4}$", r"$\frac{6}{8}$", r"$\frac{3}{5}$", r"$\frac{9}{12}$", r"$\frac{3}{8}$"],
        3,
        '["option-a","option-c","option-e"]',
        line,
    )
    fraction_cards = _blanks(
        "compare-fractions-symbol-blanks",
        "Each fraction names parts of the same whole. Choose the symbol that makes each comparison true.",
        [r"$\frac{1}{2}$ ", ("b", "c1"), r" $\frac{2}{4}$" + "\n" + r"$\frac{1}{3}$ ", ("b", "c2"), r" $\frac{1}{2}$"],
        [
            ("c1", "The symbol for the first comparison", symbols),
            ("c2", "The symbol for the second comparison", symbols),
        ],
        '{"c1":"b","c2":"a"}',
        layout="cards",
        label="Put a symbol card in each box",
    )
    decimal_cards = _blanks(
        "compare-decimals-symbol-blanks",
        "Choose the symbol that makes each comparison true.",
        ["0.5 ", ("b", "c1"), " 0.50\n0.45 ", ("b", "c2"), " 0.5"],
        [
            ("c1", "The symbol for the first comparison", symbols),
            ("c2", "The symbol for the second comparison", symbols),
        ],
        '{"c1":"b","c2":"a"}',
        layout="cards",
        label="Put a symbol card in each box",
    )
    scene = {
        "kind": "scene",
        "scene": {
            "v": 1,
            "title": "Four points on a number line",
            "note": "Count the tick marks.",
            "elements": [{
                "type": "numberLine",
                "id": "line",
                "min": 0,
                "max": 2,
                "denominator": 10,
                "labels": [0, 2],
                "marks": [
                    {"at": 0.3, "label": "A"},
                    {"at": 0.4, "label": "B"},
                    {"at": 0.5, "label": "C"},
                    {"at": 0.6, "label": "D"},
                ],
            }],
        },
    }
    located = {
        "public": {
            "templateId": "decimal-fraction-locate",
            "prompt": r"Which point is at $\frac{4}{10}$?",
            "response": {
                "kind": "choice",
                "label": "Choose the point",
                "options": _options(["$A$", "$B$", "$C$", "$D$"]),
            },
            "figure": scene,
        },
        "answer": "option-b",
        "hint": "Count.",
        "explanation": ["Point B."],
    }
    place = _blanks(
        "decimal-place-value-hundredths",
        "Complete the sentence about 3.05.",
        ["The digit 5 is in the ", ("b", "place"), " place. Its value is ", ("b", "value"), "."],
        [
            ("place", "The place of the digit", ["ones", "tenths", "hundredths"]),
            ("value", "The value of the digit", ["0.05", "5", "0.5", "50"]),
        ],
        '{"place":"c","value":"a"}',
        label="Complete the sentence",
    )
    cases = [decompose, mixed, story, multiple, names, fraction_cards, decimal_cards, located, place]
    for case in cases:
        require(review_problem(case) == case["answer"], case["public"]["templateId"])
        require(solve(case["public"]) == case["answer"], case["public"]["templateId"])
    covered = {case["public"]["templateId"] for case in cases}
    require(covered == SUPPORTED, f"Missing {sorted(SUPPORTED - covered)}")
    _must_fail(decompose, lambda p: p.update(answer='["option-a","option-b"]'), "wrong decomposition key")
    _must_fail(
        decompose,
        lambda p: p["public"]["response"]["options"][1].update(label=r"$\frac{1}{4}+\frac{2}{4}$"),
        "decomposition distractor is also true",
    )
    _must_fail(names, lambda p: p["public"]["response"]["options"][1].update(label=r"$\frac{12}{16}$"), "sixteen")
    _must_fail(
        names,
        lambda p: p["public"]["response"]["options"][1].update(label=r"$\frac{75}{100}$"),
        "number-line distractor is also true",
    )
    _must_fail(mixed, lambda p: p.update(answer="2"), "wrong mixed sum")
    _must_fail(story, lambda p: p.update(answer="5/8"), "wrong story sum")
    _must_fail(multiple, lambda p: p.update(answer='{"copies":"a","pieces":"a"}'), "wrong copies")
    _must_fail(
        multiple,
        lambda p: p["public"]["response"]["blanks"][1]["options"][1].update(label="6"),
        "product distractor is also true",
    )
    _must_fail(fraction_cards, lambda p: p.update(answer='{"c1":"a","c2":"a"}'), "wrong fraction symbol")
    _must_fail(decimal_cards, lambda p: p.update(answer='{"c1":"c","c2":"a"}'), "wrong decimal symbol")
    _must_fail(
        decimal_cards,
        lambda p: p["public"]["response"]["sentence"][2].update(text=" 0.5\n0.4 "),
        "missing trailing-zero equality",
    )
    _must_fail(located, lambda p: p.update(answer="option-a"), "wrong point")
    _must_fail(located, lambda p: p["public"]["response"]["options"][0].update(label="$B$"), "two letters")
    _must_fail(place, lambda p: p.update(answer='{"place":"a","value":"a"}'), "wrong place")
    _must_fail(
        place,
        lambda p: p["public"]["response"]["blanks"][1]["options"][1].update(label="0.05"),
        "value distractor is also true",
    )


if __name__ == "__main__":
    self_test()
