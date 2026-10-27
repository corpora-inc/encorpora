"""Independent review of the statement-blanks family (multi-part-choice-v1).

Every blank or table row is decided from the displayed wording alone: triangle
sides are tested with exact squares, transformation rules by the orthogonality
of their linear part, expression equivalence by exact evaluation at many
values, inequalities by comparing exact numbers, and vocabulary by an
independent glossary. A blank passes only when exactly one option has the
computed meaning.
"""

import copy
import json
import re
from fractions import Fraction as F

from multipart_oracle_support import (
    MINUS, N, T, compact, expect_rejected, figure_rows, key_of, number_of,
    numbers_in, pick, public_text, require, response_of, review, sentence_of, untex,
)

SUPPORTED = frozenset({
    "fixed-variable-expense-table", "pythagorean-sort-table", "congruence-claims-table",
    "equivalent-expressions-table", "gross-net-sentence", "coordinate-terms-slots",
    "point-on-axis-sentence", "times-as-many-blanks", "compare-fractions-reason-blanks",
    "inequality-number-blanks",
})
REVIEW_RETURNS_ANSWER = True

# Everyday expenses whose bill is a set amount each month, or depends on use.
STAYS_THE_SAME = {"rent", "phone plan", "internet service", "car payment", "insurance"}
VARIES = {"eating out", "groceries", "gasoline", "electricity", "water bill"}


def match(pattern, text, what):
    m = re.search(pattern, text)
    require(m is not None, f"Unreadable {what}: {text!r}")
    return m


def table_rows(public, columns):
    response, blanks = response_of(public, "table")
    require(response.get("rowHeader"), "A row heading")
    return response, blanks


def fixed_variable(public):
    response, blanks = table_rows(public, ["varies", "stays the same"])
    picks = {}
    shown = "Jan" in public_text(public)
    for blank_id, blank in blanks.items():
        label = blank["label"]
        name = label.split(":")[0].strip()
        kind = "varies" if name.lower() in VARIES else "stays the same" if name.lower() in STAYS_THE_SAME else None
        require(kind is not None, f"Unknown expense {name}")
        if ":" in label:
            amounts = [int(x) for x in re.findall(r"(?:Jan|Feb|Mar|Apr) (\d+)", untex(label))]
            require(len(amounts) >= 3, f"Monthly amounts in {label!r}")
            by_amounts = "stays the same" if len(set(amounts)) == 1 else "varies"
            require(by_amounts == kind, f"The amounts of {name} contradict what kind of expense it is")
        else:
            require(not shown, "Amounts are shown for every row or none")
        picks[blank_id] = pick(blank, T(kind))
    return picks


def pythagorean(public):
    _, blanks = table_rows(public, None)
    picks = {}
    for blank_id, blank in blanks.items():
        sides = sorted(int(x) for x in re.findall(r"\d+", untex(blank["label"])))
        require(len(sides) == 3 and sides[0] > 0, "Three side lengths")
        require(sides[0] + sides[1] > sides[2], f"{sides} is not a triangle")
        right = sides[0] ** 2 + sides[1] ** 2 == sides[2] ** 2
        picks[blank_id] = pick(blank, T("right triangle" if right else "not a right triangle"))
    return picks


# A rule (x, y) -> (f, g) with f, g linear in x and y.
def linear_part(component):
    text = untex(component).replace(" ", "")
    require(re.fullmatch(r"[-+]?(?:\d*[xy]|\d+)(?:[-+](?:\d*[xy]|\d+))*", text) is not None, f"Unreadable rule part {component!r}")
    cx = cy = 0
    for sign, coefficient, variable in re.findall(r"([-+]?)(\d*)([xy]?)", text):
        if not coefficient and not variable:
            continue
        value = int(coefficient) if coefficient else 1
        value = -value if sign == "-" else value
        if variable == "x":
            cx += value
        elif variable == "y":
            cy += value
    return cx, cy


def congruence(public):
    _, blanks = table_rows(public, None)
    picks = {}
    for blank_id, blank in blanks.items():
        m = match(r"^\(x, y\)\\to \((.+), (.+)\)$", untex(blank["label"]).replace("\\to", "\\to"), "rule")
        (a, b), (c, d) = linear_part(m[1]), linear_part(m[2])
        # Distances are kept exactly when the linear part is orthogonal.
        isometry = a * a + c * c == 1 and b * b + d * d == 1 and a * b + c * d == 0
        picks[blank_id] = pick(blank, T("preserves congruence" if isometry else "does not preserve"))
    return picks


TOKENS = re.compile(r"\s*(\\cdot|\\div|\\times|\d+|[a-z]|[-+()^])")


def expression_value(text, variable_values):
    """Exact value of a printed expression; juxtaposition multiplies."""
    source = untex(text).replace("\\cdot", "\\cdot")
    tokens, at = [], 0
    while at < len(source.rstrip()):
        m = TOKENS.match(source, at)
        require(m is not None, f"Unreadable expression {text!r}")
        tokens.append(m[1])
        at = m.end()
    position = [0]

    def peek():
        return tokens[position[0]] if position[0] < len(tokens) else None

    def take():
        position[0] += 1
        return tokens[position[0] - 1]

    def atom():
        t = take()
        if t == "(":
            value = expr()
            require(take() == ")", "Closing parenthesis")
            return value
        if t.isdigit():
            return F(int(t))
        require(t in variable_values, f"Unknown symbol {t!r}")
        return variable_values[t]

    def power():
        base = atom()
        if peek() == "^":
            take()
            exponent = atom()
            require(exponent.denominator == 1, "Integer exponent")
            return base ** int(exponent)
        return base

    def unary():
        if peek() == "-":
            take()
            return -unary()
        return power()

    def term():
        value = unary()
        while peek() is not None and (peek() in ("\\cdot", "\\times", "\\div") or peek() == "(" or (peek().isalpha() and peek() not in ("\\cdot",)) or peek().isdigit()):
            t = peek()
            if t in ("\\cdot", "\\times"):
                take()
                value *= unary()
            elif t == "\\div":
                take()
                divisor = unary()
                require(divisor != 0, "Division by zero")
                value /= divisor
            else:
                value *= unary()
        return value

    def expr():
        value = term()
        while peek() in ("+", "-"):
            if take() == "+":
                value += term()
            else:
                value -= term()
        return value

    result = expr()
    require(position[0] == len(tokens), f"Trailing symbols in {text!r}")
    return result


SAMPLES = [F(3), F(-2), F(5), F(7), F(-11), F(1, 2), F(13), F(-1, 3), F(2), F(-5)]


def equivalent(a, b, variable):
    return all(expression_value(a, {variable: s}) == expression_value(b, {variable: s}) for s in SAMPLES)


def equivalent_expressions(public):
    _, blanks = table_rows(public, None)
    m = match(r"equivalent or not equivalent to \$(.+?)\$\.", public["prompt"], "reference expression")
    reference = m[1]
    variable = match(r"[a-z]", re.sub(r"\\[a-z]+", "", reference), "variable")[0]
    picks = {}
    for blank_id, blank in blanks.items():
        picks[blank_id] = pick(blank, T("equivalent" if equivalent(reference, blank["label"], variable) else "not equivalent"))
    return picks


def gross_net(public):
    response, blanks = response_of(public, "inline")
    ids = list(blanks)
    if ids == ["out", "net"]:
        m = match(r"gross pay of (\d[\d,]*) dollars\. Taxes are (\d[\d,]*) dollars and other deductions are (\d[\d,]*) dollars", untex(public["prompt"]), "pay")
        gross, taxes, other = (F(x.replace(",", "")) for x in m.groups())
        return {"out": pick(blanks["out"], N(taxes + other)), "net": pick(blanks["net"], N(gross - taxes - other))}
    require(ids == ["when", "op"], f"Blank ids {ids}")
    text = sentence_of(response)
    require(text == "Gross pay is the money earned {when} taxes and deductions are taken out. Take-home pay is gross pay {op} taxes and deductions.",
            "Definition sentence")
    # Gross pay is counted before anything is taken out; take-home pay is what is left.
    return {"when": pick(blanks["when"], T("before")), "op": pick(blanks["op"], T("minus"))}


GLOSSARY = [
    (r"^The term for the point \(0, 0\) where the two axes cross$", "origin"),
    (r"^The term for the horizontal number line of the plane$", "x-axis"),
    (r"^The term for the vertical number line of the plane$", "y-axis"),
    (r"^The term for the first number of an ordered pair$", "x-coordinate"),
    (r"^The term for the second number of an ordered pair$", "y-coordinate"),
    (r"^The term for two numbers in order that name a point$", "ordered pair"),
]


def coordinate_terms(public):
    _, blanks = response_of(public, "slots")
    picks = {}
    for blank_id, blank in blanks.items():
        label = untex(blank["label"])
        terms = [term for pattern, term in GLOSSARY if re.search(pattern, label)]
        require(len(terms) == 1, f"Unknown description {label!r}")
        picks[blank_id] = pick(blank, T(terms[0]))
    require(len({picks[i] for i in picks}) == len(picks), "Slots need different terms")
    return picks


def point_on_axis(public):
    response, blanks = response_of(public, "inline", ["axis", "which", "units", "dir"])
    m = match(r"point \((-?\d+), (-?\d+)\) in the coordinate plane", untex(public["prompt"]), "point")
    x, y = int(m[1]), int(m[2])
    require((x == 0) != (y == 0), "Exactly one coordinate is 0")
    text = untex(sentence_of(response))
    require(f"The point ({x}, {y}) lies on the" in text, "The sentence names the same point")
    on_y = x == 0
    move = abs(y if on_y else x)
    if on_y:
        direction = "up" if y > 0 else "down"
    else:
        direction = "right" if x > 0 else "left"
    return {
        "axis": pick(blanks["axis"], T("y-axis" if on_y else "x-axis")),
        "which": pick(blanks["which"], T("first" if on_y else "second")),
        "units": pick(blanks["units"], N(move)),
        "dir": pick(blanks["dir"], T(direction)),
    }


def times_as_many(public):
    response, blanks = response_of(public, "inline")
    rows = figure_rows(public)
    names = rows[0][1:]
    counts = [number_of(c)[1] for c in rows[1][1:]]
    require(len(names) == len(counts) >= 3 and len(set(names)) == len(names), "Table of counts")
    ids = list(blanks)
    if ids == ["more", "less"]:
        total = int(match(r"has (\d+) books", untex(public["prompt"]), "total")[1])
        require(total == sum(counts), "The table adds up to the stated total")
        pairs = [(i, j) for i in range(len(counts)) for j in range(len(counts)) if i != j and counts[i] > 2 * counts[j]]
        require(len(pairs) == 1, f"{len(pairs)} pairs are more than twice as likely; exactly one is needed")
        i, j = pairs[0]
        return {"more": pick(blanks["more"], T(names[i])), "less": pick(blanks["less"], T(names[j]))}
    require(ids == ["k", "big", "small"], f"Blank ids {ids}")
    pairs = [(i, j) for i in range(len(counts)) for j in range(len(counts)) if i != j and counts[i] % counts[j] == 0 and counts[i] > counts[j]]
    require(len(pairs) == 1, f"{len(pairs)} whole-number multiples; exactly one is needed")
    i, j = pairs[0]
    return {"k": pick(blanks["k"], N(counts[i] // counts[j])), "big": pick(blanks["big"], T(names[i])), "small": pick(blanks["small"], T(names[j]))}


def compare_fractions(public):
    _, blanks = response_of(public, "inline", ["bigger", "why"])
    (a, b), (c, d) = (re.findall(r"\\frac\{(\d+)\}\{(\d+)\}", untex(public["prompt"]))[i] for i in (0, 1))
    n1, d1, n2, d2 = int(a), int(b), int(c), int(d)
    require(F(n1, d1) != F(n2, d2), "The fractions are equal")
    first_bigger = F(n1, d1) > F(n2, d2)
    bigger = (n1, d1) if first_bigger else (n2, d2)
    if d1 == d2:
        reason = "it has more pieces of the same size"
    else:
        require(n1 == n2, "Fractions share a denominator or a numerator")
        reason = "the pieces are larger when the denominator is smaller"
    return {"bigger": pick(blanks["bigger"], key_of("\\frac{%d}{%d}" % bigger)), "why": pick(blanks["why"], T(reason))}


def inequality_numbers(public):
    response, blanks = response_of(public, "inline", ["less", "more"])
    labels = [o["label"] for o in blanks["less"]["options"]]
    require(labels == [o["label"] for o in blanks["more"]["options"]], "One shared number bank")
    bank = {o["id"]: number_of(o["label"])[1] for o in blanks["less"]["options"]}
    text = sentence_of(response)
    lo = number_of(match(r"\{less\} \$<(.+?)\$", text, "first statement")[1])[1]
    hi = number_of(match(r"\{more\} \$>(.+?)\$", text, "second statement")[1])[1]
    below = [i for i, v in bank.items() if v < lo]
    above = [i for i, v in bank.items() if v > hi]
    require(len(below) == 1 and len(above) == 1, "Each statement has exactly one number that works")
    return {"less": below[0], "more": above[0]}


SOLVERS = {
    "fixed-variable-expense-table": fixed_variable,
    "pythagorean-sort-table": pythagorean,
    "congruence-claims-table": congruence,
    "equivalent-expressions-table": equivalent_expressions,
    "gross-net-sentence": gross_net,
    "coordinate-terms-slots": coordinate_terms,
    "point-on-axis-sentence": point_on_axis,
    "times-as-many-blanks": times_as_many,
    "compare-fractions-reason-blanks": compare_fractions,
    "inequality-number-blanks": inequality_numbers,
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


def table(template, prompt, header, rows, columns, answer, figure=None):
    response = {"kind": "multi-part-choice", "label": "Choose", "layout": "table", "rowHeader": header,
                "blanks": [{"id": f"r{i + 1}", "label": row, "options": opts(*columns)} for i, row in enumerate(rows)]}
    return {"public": {"templateId": template, "prompt": prompt, "response": response},
            "answer": compact({f"r{i + 1}": a for i, a in enumerate(answer)}), "explanation": [], "hint": "Think."}


def inline(template, prompt, sentence, blanks, answer, figure=None, layout="inline"):
    response = {"kind": "multi-part-choice", "label": "Choose", "layout": layout,
                "blanks": [{"id": i, "label": l, "options": opts(*o)} for i, l, o in blanks]}
    if layout == "inline":
        response["sentence"] = [{"text": p} if isinstance(p, str) else {"blank": p[1]} for p in sentence]
    public = {"templateId": template, "prompt": prompt, "response": response}
    if figure:
        public["figure"] = figure
    return {"public": public, "answer": compact(answer), "explanation": [], "hint": "Think."}


def counts_figure(names, counts):
    return {"kind": "scene", "scene": {"v": 1, "title": "t", "elements": [{"type": "lineTable", "rows": [["Type"] + names, ["Books"] + [str(c) for c in counts]], "header": "row"}]}}


def fixtures():
    R = ["Right triangle", "Not a right triangle"]
    V = ["Varies", "Stays the same"]
    C = ["Preserves congruence", "Does not preserve"]
    E = ["Equivalent", "Not equivalent"]
    terms = ["origin", "$y$-coordinate", "$y$-axis", "$x$-axis", "ordered pair"]
    bank = ["$-\\frac{2}{5}$", "$\\frac{5}{4}$", "$-1.5$", "$-1.2$"]
    return {
        "fixed": table("fixed-variable-expense-table", "Mark each expense.", "Expense", ["Eating out", "Phone plan", "Rent", "Water bill"], V, ["a", "b", "b", "a"]),
        "fixed-amounts": table("fixed-variable-expense-table", "A family records. Mark each expense.", "Expense",
                               ["Gasoline: Jan 302, Feb 197, Mar 319", "Internet service: Jan 56, Feb 56, Mar 56", "Rent: Jan 900, Feb 900, Mar 900"], V, ["a", "b", "b"]),
        "pyth": table("pythagorean-sort-table", "Mark each triangle.", "Side lengths", ["3, 4, 6", "21, 72, 77", "9, 40, 41", "5, 12, 13", "8, 15, 17"], R, ["b", "b", "a", "a", "a"]),
        "congruence": table("congruence-claims-table", "Mark each rule.", "Rule",
                            ["$(x, y)\\to (x, 3y)$", "$(x, y)\\to (3x, 3y)$", "$(x, y)\\to (x + 4, y - 4)$", "$(x, y)\\to (-x, y)$", "$(x, y)\\to (x + y, y)$", "$(x, y)\\to (-y, x)$"], C,
                            ["b", "b", "a", "a", "b", "a"]),
        "equivalent": table("equivalent-expressions-table", "Mark each expression as equivalent or not equivalent to $n\\cdot 1$.", "Expression",
                            ["$n+1$", "$2n$", "$n+0$", "$n$"], E, ["b", "b", "a", "a"]),
        "associative": table("equivalent-expressions-table", "Mark each expression as equivalent or not equivalent to $(2\\cdot p)\\cdot 3$.", "Expression",
                             ["$p\\cdot 3$", "$6p$", "$2\\cdot(p\\cdot 3)$", "$2+p$", "$6p+3$"], E, ["b", "a", "a", "b", "b"]),
        "gross": inline("gross-net-sentence", "A worker has gross pay of 1160 dollars. Taxes are 110 dollars and other deductions are 30 dollars. Complete the sentence.",
                        ["Out ", ("b", "out"), " net ", ("b", "net")],
                        [("out", "The total taken out in dollars", ["1,160", "140", "1,020", "30"]), ("net", "The take-home pay in dollars", ["1,300", "1,130", "1,050", "1,020"])],
                        {"out": "b", "net": "d"}),
        "definition": inline("gross-net-sentence", "Complete the statement about gross pay and take-home pay.",
                             ["Gross pay is the money earned ", ("b", "when"), " taxes and deductions are taken out. Take-home pay is gross pay ", ("b", "op"), " taxes and deductions."],
                             [("when", "When gross pay is counted", ["before", "after"]), ("op", "How take-home pay is found", ["minus", "plus"])],
                             {"when": "a", "op": "a"}),
        "terms": inline("coordinate-terms-slots", "Match each description.", None,
                        [("t1", "The term for the point $(0, 0)$ where the two axes cross", terms), ("t2", "The term for the horizontal number line of the plane", terms),
                         ("t3", "The term for two numbers in order that name a point", terms)], {"t1": "a", "t2": "d", "t3": "e"}, layout="slots"),
        "point": inline("point-on-axis-sentence", "Complete the statement about the point $(0, 5)$ in the coordinate plane.",
                        ["The point $(0, 5)$ lies on the ", ("b", "axis"), " because its ", ("b", "which"), " coordinate is 0. To reach it from the origin, move ", ("b", "units"), " units ", ("b", "dir"), "."],
                        [("axis", "The axis the point lies on", ["$x$-axis", "$y$-axis"]), ("which", "The coordinate that is 0", ["first", "second"]),
                         ("units", "The number of units to move", ["6", "4", "5", "0"]), ("dir", "The direction to move", ["right", "up"])],
                        {"axis": "b", "which": "a", "units": "c", "dir": "b"}),
        "more-than-twice": inline("times-as-many-blanks", "A shelf has 65 books, and one book is chosen at random. The table shows how many books there are of each type. Complete the sentence.",
                                  [("b", "more"), " books are more than twice as likely to be chosen as ", ("b", "less"), " books."],
                                  [("more", "The type that is more likely", ["mystery", "science", "poetry"]), ("less", "The type that is less likely", ["mystery", "science", "poetry"])],
                                  {"more": "b", "less": "a"}, counts_figure(["mystery", "science", "poetry"], [12, 30, 23])),
        "count-times": inline("times-as-many-blanks", "The table shows how many of each item a class collected. Complete the sentence.",
                              ["There are ", ("b", "k"), " times as many ", ("b", "big"), " as ", ("b", "small"), "."],
                              [("k", "How many times as many", ["4", "5", "6", "2"]), ("big", "The item there are more of", ["mugs", "cups", "bottles"]),
                               ("small", "The item there are fewer of", ["mugs", "cups", "bottles"])],
                              {"k": "a", "big": "a", "small": "c"}, counts_figure(["mugs", "cups", "bottles"], [24, 11, 6])),
        "fractions": inline("compare-fractions-reason-blanks", "Compare $\\frac{4}{9}$ and $\\frac{4}{6}$. Complete the sentence.",
                            [("b", "bigger"), " is the greater fraction because ", ("b", "why"), "."],
                            [("bigger", "The greater fraction", ["$\\frac{4}{9}$", "$\\frac{4}{6}$"]),
                             ("why", "The reason", ["it has more pieces", "a greater denominator makes a greater fraction", "the pieces are larger when the denominator is smaller", "the numerators are different"])],
                            {"bigger": "b", "why": "c"}),
        "bank": inline("inequality-number-blanks", "Choose a number from the bank to make each inequality true. Each statement has exactly one number that works.",
                       ["First statement: ", ("b", "less"), " $<-1.2$. Second statement: ", ("b", "more"), " $>-\\frac{2}{5}$."],
                       [("less", "The number for the first statement", bank), ("more", "The number for the second statement", bank)], {"less": "c", "more": "b"}),
    }


def self_test():
    cases = fixtures()
    for c in cases.values():
        review_problem(c)
    covered = {c["public"]["templateId"] for c in cases.values()}
    require(covered == SUPPORTED, f"A fixture for every template; missing {sorted(SUPPORTED - covered)}")
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
    # Corrupted givens and tables.
    bad = copy.deepcopy(cases["pyth"])
    bad["public"]["response"]["blanks"][2]["label"] = "9, 40, 42"
    rejected += expect_rejected(review_problem, bad, "not a right triangle but marked right")
    bad = copy.deepcopy(cases["bank"])
    bad["public"]["response"]["sentence"][3] = {"text": " $>-2$."}
    rejected += expect_rejected(review_problem, bad, "no bank number is above the bound")
    bad = copy.deepcopy(cases["more-than-twice"])
    bad["public"]["figure"]["scene"]["elements"][0]["rows"][1][1] = "16"
    rejected += expect_rejected(review_problem, bad, "counts no longer add up")
    bad = copy.deepcopy(cases["fixed-amounts"])
    bad["public"]["response"]["blanks"][1]["label"] = "Internet service: Jan 56, Feb 57, Mar 56"
    rejected += expect_rejected(review_problem, bad, "amounts contradict the answer")
    bad = copy.deepcopy(cases["point"])
    bad["public"]["prompt"] = bad["public"]["prompt"].replace("(0, 5)", "(5, 0)")
    rejected += expect_rejected(review_problem, bad, "prompt and sentence disagree")
    require(expression_value("\\frac{1}{2}".replace("\\frac{1}{2}", "(1)n"), {"n": F(3)}) == 3, "Juxtaposition")
    return {"fixtures": len(cases), "rejectedMutations": rejected}


if __name__ == "__main__":
    print(self_test())
