"""Independent review of the quantity-pair-blanks family (multi-part-choice-v1).

Each blank's correct option is derived from the displayed prompt, figure and
blank labels with exact arithmetic (Fractions); the generator's answer logic is
never called. A blank is solved only when exactly one option has the computed
meaning, so duplicated, missing or ambiguous correct options fail.
"""

import copy
import json
import re
from fractions import Fraction as F

from multipart_oracle_support import (
    MINUS, N, P, T, expect_rejected, figure_rows, number_of, pick, require,
    response_of, review, sentence_of, untex, key_of, numbers_in, public_text,
)

SUPPORTED = frozenset({
    "quotient-remainder-blanks", "meters-to-kilometers-blanks", "simple-interest-blanks",
    "loan-offer-compare-blanks", "scale-factor-effects-blanks", "expected-count-blanks",
    "unit-rate-pair-blanks", "ratio-pair-blanks", "mean-median-blanks",
    "median-mode-compare-blanks", "rectangle-chain-blanks", "wage-and-cost-blanks",
    "percent-amounts-blanks", "check-register-blanks",
})
REVIEW_RETURNS_ANSWER = True

AMOUNT = r"(\d[\d,]*(?:\.\d+)?)"


def amount(text):
    return F(text.replace(",", ""))


def prose(public):
    return untex(public["prompt"])


def match(pattern, text, what):
    m = re.search(pattern, text)
    require(m is not None, f"Unreadable {what}: {text!r}")
    return m


def median(values):
    s = sorted(values)
    n = len(s)
    return s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2


def mean(values):
    return sum(values, F(0)) / len(values)


def quotient_remainder(public):
    _, blanks = response_of(public, "inline", ["full", "left"])
    m = match(r"^" + AMOUNT + r" \w+ are packed into \w+ that each hold " + AMOUNT + r"\.", prose(public), "packing")
    total, size = amount(m[1]), amount(m[2])
    require(size > 0, "Group size")
    q, r = divmod(int(total), int(size))
    return {"full": pick(blanks["full"], N(q)), "left": pick(blanks["left"], N(r))}


def meters_to_kilometers(public):
    _, blanks = response_of(public, "inline", ["km", "m"])
    text = prose(public)
    distances = [amount(x) for x in re.findall(AMOUNT + r" meters", text)]
    require(len(distances) == 3, "Three distances")
    total = int(sum(distances))
    return {"km": pick(blanks["km"], N(total // 1000)), "m": pick(blanks["m"], N(total % 1000))}


def simple_interest(public):
    _, blanks = response_of(public, "inline", ["interest", "total"])
    m = match(r"earns " + AMOUNT + r"% simple interest each year\. " + AMOUNT + r" dollars is deposited and left for " + AMOUNT + r" years", prose(public), "deposit")
    rate, principal, years = amount(m[1]), amount(m[2]), amount(m[3])
    interest = principal * rate / 100 * years
    return {"interest": pick(blanks["interest"], N(interest)), "total": pick(blanks["total"], N(principal + interest))}


def loan_offer(public):
    _, blanks = response_of(public, "inline", ["bank", "diff"])
    text = prose(public)
    principal = amount(match(r"borrows " + AMOUNT + r" dollars", text, "loan")[1])
    offers = re.findall(r"([A-Z][a-z]+ Bank) charges " + AMOUNT + r"% simple interest per year for " + AMOUNT + r" years", text)
    require(len(offers) == 2, "Two offers")
    cost = {name: principal * amount(r) / 100 * amount(y) for name, r, y in offers}
    (n1, c1), (n2, c2) = cost.items()
    require(c1 != c2, "The costs tie, so no bank costs less")
    cheaper = n1 if c1 < c2 else n2
    return {"bank": pick(blanks["bank"], T(cheaper)), "diff": pick(blanks["diff"], N(abs(c1 - c2)))}


def tex_number(text):
    key = number_of(text)
    require(key is not None, f"Unreadable scale factor {text!r}")
    return key[1]


def scale_factor(public):
    _, blanks = response_of(public, "inline", ["perim", "area"])
    text = prose(public)
    match(r"A rectangle is " + AMOUNT + r" units long and " + AMOUNT + r" units wide\.", text, "rectangle")
    k = tex_number(match(r"scale factor of (\\frac\{\d+\}\{\d+\}|[\d.]+)\.", text, "scale factor")[1])
    require(k > 0, "Positive scale factor")
    return {"perim": pick(blanks["perim"], N(k)), "area": pick(blanks["area"], N(k * k))}


def expected_count(public):
    _, blanks = response_of(public, "inline", ["prob", "count"])
    text = prose(public)
    m = match(r"A spinner has (\d+) equal sections with these numbers: ([\d, ]+)\. It is spun " + AMOUNT + r" times", text, "spinner")
    sections = [int(x) for x in m[2].split(",")]
    require(len(sections) == int(m[1]), "Section count")
    spins = amount(m[3])
    target = int(match(r"landing on (\d+)", sentence_of(public["response"]), "target")[1])
    require(target in sections, "The target must appear on the spinner")
    probability = F(sections.count(target), len(sections))
    return {"prob": pick(blanks["prob"], N(probability)), "count": pick(blanks["count"], N(probability * spins))}


def unit_rates(public):
    _, blanks = response_of(public, "inline", ["first", "second"])
    m = match(r"(\d+) \w+ in (\d+) minutes .*? and (\d+) \w+ in (\d+) minutes", prose(public), "two rates")
    a, b, c, d = (F(int(x)) for x in m.groups())
    return {"first": pick(blanks["first"], N(a / b)), "second": pick(blanks["second"], N(c / d))}


def ratio_pair(public):
    _, blanks = response_of(public, "inline", ["blue", "all"])
    text = prose(public)
    m = match(r"ratio of (\w+) \w+ to (\w+) \w+ in a jar is (\d+) to (\d+)\. There are (\d+) (\w+) gumballs", text, "ratio")
    parts = {m[1]: int(m[3]), m[2]: int(m[4])}
    require(m[6] in parts, "The given count names a color of the ratio")
    unit = F(int(m[5]), parts[m[6]])
    wanted = match(r"number of (\w+) gumballs", blanks["blue"]["label"], "blank")[1]
    require(wanted in parts, "Blank color")
    return {"blue": pick(blanks["blue"], N(parts[wanted] * unit)), "all": pick(blanks["all"], N(sum(parts.values()) * unit))}


def mean_median(public):
    _, blanks = response_of(public, "inline", ["mean", "median"])
    listed = match(r"seconds: ([\d., ]+)\.", prose(public), "times")[1]
    values = [F(x.strip()) for x in listed.split(",")]
    require(len(values) >= 3, "Data")
    return {"mean": pick(blanks["mean"], N(mean(values))), "median": pick(blanks["median"], N(median(values)))}


def median_mode(public):
    _, blanks = response_of(public, "inline", ["median", "mode"])
    text = prose(public)
    hawks = [int(x) for x in match(r"Hawks: ([\d, ]+)\.", text, "Hawks")[1].split(",")]
    owls = [int(x) for x in match(r"Owls: ([\d, ]+)\.", text, "Owls")[1].split(",")]

    def modes(values):
        top = max(values.count(v) for v in values)
        return {v for v in values if values.count(v) == top}

    mh, mo = modes(hawks), modes(owls)
    require(len(mh) == 1 and len(mo) == 1, "Each list needs exactly one mode")
    a, b = median(hawks), median(owls)
    relation = "less than" if a < b else "equal to" if a == b else "greater than"
    return {"median": pick(blanks["median"], T(relation)), "mode": pick(blanks["mode"], T("match" if mh == mo else "do not match"))}


def rectangle_chain(public):
    _, blanks = response_of(public, "inline", ["length", "perim"])
    m = match(r"area of " + AMOUNT + r" square \w+ and a width of " + AMOUNT + r" ", prose(public), "rectangle")
    area, width = amount(m[1]), amount(m[2])
    length = area / width
    return {"length": pick(blanks["length"], N(length)), "perim": pick(blanks["perim"], N(2 * (length + width)))}


def table_numbers(cells):
    out = []
    for cell in cells:
        key = number_of(cell)
        require(key is not None and key[0] == "n", f"Table cell {cell!r}")
        out.append(key[1])
    return out


def wage_and_cost(public):
    _, blanks = response_of(public, "inline", ["wage", "cost"])
    rows = figure_rows(public)
    require(rows[0][0] == "Hours" and rows[1][0] == "Net pay", "Table rows")
    hours, pay = table_numbers(rows[0][1:]), table_numbers(rows[1][1:])
    require(len(hours) >= 3 and hours == sorted(set(hours)), "Hours increase")
    wage = (pay[1] - pay[0]) / (hours[1] - hours[0])
    require(all((pay[i] - pay[0]) == wage * (hours[i] - hours[0]) for i in range(len(pay))), "Net pay is not linear in the hours")
    cost = wage * hours[0] - pay[0]
    require(wage > 0 and cost > 0, "Positive wage and cost")
    return {"wage": pick(blanks["wage"], N(wage)), "cost": pick(blanks["cost"], N(cost))}


def percent_amounts(public):
    response, blanks = response_of(public, "inline")
    text = prose(public)
    ids = [b["id"] for b in response["blanks"]]
    if ids == ["rent", "rentv", "ins", "insv"]:
        m = match(r"earns " + AMOUNT + r" dollars a month\. Rent is " + AMOUNT + r"% of the income, and the rent limit is " + AMOUNT
                  + r" dollars\. Insurance is " + AMOUNT + r"% of the income, and the insurance limit is " + AMOUNT + r" dollars", text, "budget")
        income, rp, rl, ip, il = (amount(x) for x in m.groups())
        rent, ins = income * rp / 100, income * ip / 100
        return {
            "rent": pick(blanks["rent"], N(rent)),
            "rentv": pick(blanks["rentv"], T("within" if rent <= rl else "over")),
            "ins": pick(blanks["ins"], N(ins)),
            "insv": pick(blanks["insv"], T("within" if ins <= il else "over")),
        }
    require(ids == ["first", "second"], f"Blank ids {ids}")
    m = match(r"holds " + AMOUNT + r" books\. " + AMOUNT + r"% of the books are fiction and " + AMOUNT + r"% are mystery", text, "shelf")
    total = amount(m[1])
    picks = {}
    for blank_id, percent in (("first", amount(m[2])), ("second", amount(m[3]))):
        require(match(r"in the " + AMOUNT + r"% group", blanks[blank_id]["label"], "label")[1] == m[2 if blank_id == "first" else 3], "Blank percent")
        picks[blank_id] = pick(blanks[blank_id], N(total * percent / 100))
    return picks


def check_register(public):
    response, blanks = response_of(public, "slots")
    rows = figure_rows(public)
    require(rows[0] == ["Line", "Amount", "Balance"] and rows[1][0] == "Start", "Register header")
    balance = {0: number_of(rows[1][2])[1]}
    amounts = {}
    for index, (line, amt, bal) in enumerate(rows[2:], 1):
        require(line == str(index), "Line numbers")
        if amt != "?":
            amounts[index] = number_of(amt)[1]
        if bal != "?":
            balance[index] = number_of(bal)[1]
        require((amt == "?") != (bal == "?"), "Exactly one unknown per line")
        if amt == "?":
            amounts[index] = balance[index] - balance[index - 1]
        else:
            balance[index] = balance[index - 1] + amounts[index]
    picks = {}
    for blank_id, blank in blanks.items():
        m = match(r"^The (balance after|amount of) line (\d)$", blank["label"], "slot label")
        line = int(m[2])
        table = balance if m[1] == "balance after" else amounts
        require(line in table, "Slot line")
        # Only the unknown cells are asked.
        require(rows[1 + line][2 if m[1] == "balance after" else 1] == "?", "Asked cell is shown")
        picks[blank_id] = pick(blank, N(table[line]))
    return picks


SOLVERS = {
    "quotient-remainder-blanks": quotient_remainder,
    "meters-to-kilometers-blanks": meters_to_kilometers,
    "simple-interest-blanks": simple_interest,
    "loan-offer-compare-blanks": loan_offer,
    "scale-factor-effects-blanks": scale_factor,
    "expected-count-blanks": expected_count,
    "unit-rate-pair-blanks": unit_rates,
    "ratio-pair-blanks": ratio_pair,
    "mean-median-blanks": mean_median,
    "median-mode-compare-blanks": median_mode,
    "rectangle-chain-blanks": rectangle_chain,
    "wage-and-cost-blanks": wage_and_cost,
    "percent-amounts-blanks": percent_amounts,
    "check-register-blanks": check_register,
}


def solve_picks(public):
    require(public["templateId"] in SUPPORTED, "Wrong family")
    return SOLVERS[public["templateId"]](public)


def solve(public):
    from multipart_oracle_support import compact
    picks = solve_picks(public)
    return compact({b["id"]: picks[b["id"]] for b in public["response"]["blanks"]})


def review_problem(problem):
    return review(problem, solve_picks)


# ---------------------------------------------------------------- self test

def opts(*labels):
    return [{"id": "abcdef"[i], "label": label} for i, label in enumerate(labels)]


def case(template, prompt, sentence, blanks, answer, figure=None, hint="Think it through."):
    """sentence: list of text and ('blank', id); blanks: (id, label, [option labels])."""
    parts = [{"text": p} if isinstance(p, str) else {"blank": p[1]} for p in sentence] if sentence else None
    response = {"kind": "multi-part-choice", "label": "Choose", "layout": "inline" if sentence else "slots",
                "blanks": [{"id": i, "label": l, "options": opts(*o)} for i, l, o in blanks]}
    if parts:
        response["sentence"] = parts
    public = {"templateId": template, "prompt": prompt, "response": response}
    if figure:
        public["figure"] = figure
    return {"public": public, "answer": json.dumps(answer, separators=(",", ":")), "explanation": [], "hint": hint}


def table_figure(rows):
    return {"kind": "scene", "scene": {"v": 1, "title": "t", "elements": [{"type": "lineTable", "rows": rows, "header": "row"}]}}


def fixtures():
    S = lambda *x: list(x)
    return {
        "qr": case("quotient-remainder-blanks", "254 pencils are packed into boxes that each hold 40. As many boxes as possible are filled. Complete the sentence.",
                   S("The pencils fill ", ("b", "full"), " full boxes with ", ("b", "left"), " left over."),
                   [("full", "The number of full boxes", ["14", "26", "7", "6"]), ("left", "The number left over", ["26", "14", "6", "40"])],
                   {"full": "d", "left": "b"}),
        "km": case("meters-to-kilometers-blanks", "A cyclist rides three parts of a route: 984 meters, 767 meters and 532 meters. Complete the sentence.",
                   S("Total ", ("b", "km"), " kilometers and ", ("b", "m"), " meters."),
                   [("km", "The number of whole kilometers", ["1", "3", "2", "22"]), ("m", "The number of meters left over", ["283", "2,283", "383", "717"])],
                   {"km": "c", "m": "a"}),
        "interest": case("simple-interest-blanks", "A savings account earns 2% simple interest each year. 1,200 dollars is deposited and left for 4 years. Complete the sentence.",
                         S("Interest ", ("b", "interest"), " total ", ("b", "total")),
                         [("interest", "The interest in dollars", ["96", "2,400", "4,800", "24"]), ("total", "The total in dollars", ["1,224", "1,200", "1,296", "1,104"])],
                         {"interest": "a", "total": "c"}),
        "loan": case("loan-offer-compare-blanks", "A family borrows 500 dollars. Harbor Bank charges 9% simple interest per year for 4 years. Summit Bank charges 6% simple interest per year for 5 years. Complete.",
                     S(("b", "bank"), " costs less, by ", ("b", "diff"), " dollars."),
                     [("bank", "The bank that costs less", ["Harbor Bank", "Summit Bank"]), ("diff", "How much less in dollars", ["30", "330", "15", "180"])],
                     {"bank": "b", "diff": "a"}),
        "scale": case("scale-factor-effects-blanks", "A rectangle is 10 units long and 6 units wide. It is dilated by a scale factor of $\\frac{1}{2}$. Complete.",
                      S("Perimeter ", ("b", "perim"), " area ", ("b", "area")),
                      [("perim", "The factor for the perimeter", ["$\\frac{1}{2}$", "$\\frac{2}{2}$", "$\\frac{1}{4}$", "$\\frac{1}{8}$"]),
                       ("area", "The factor for the area", ["$\\frac{1}{8}$", "$\\frac{1}{4}$", "$\\frac{1}{2}$", "$\\frac{2}{2}$"])],
                      {"perim": "a", "area": "b"}),
        "spinner": case("expected-count-blanks", "A spinner has 10 equal sections with these numbers: 60, 40, 50, 60, 20, 30, 30, 30, 60, 30. It is spun 200 times. Complete the sentence.",
                        S("The probability of landing on 30 is ", ("b", "prob"), ", so about ", ("b", "count"), " times."),
                        [("prob", "The probability", ["$\\frac{2}{5}$", "$\\frac{1}{2}$", "$\\frac{1}{5}$", "$\\frac{4}{9}$"]), ("count", "The expected number of times", ["50", "20", "120", "80"])],
                        {"prob": "a", "count": "d"}),
        "rates": case("unit-rate-pair-blanks", "A printer prints 43 pages in 10 minutes in black and white and 18 pages in 5 minutes in color. Each rate is constant. Complete.",
                      S("bw ", ("b", "first"), " color ", ("b", "second")),
                      [("first", "The rate in black and white", ["3.6", "4.3", "33", "8.6"]), ("second", "The rate in color", ["13", "4.3", "3.6", "1.8"])],
                      {"first": "b", "second": "c"}),
        "ratio": case("ratio-pair-blanks", "The ratio of blue gumballs to yellow gumballs in a jar is 3 to 2. There are 18 yellow gumballs. Complete the sentence.",
                      S("There are ", ("b", "blue"), " blue gumballs and ", ("b", "all"), " in all."),
                      [("blue", "The number of blue gumballs", ["45", "12", "36", "27"]), ("all", "The number of gumballs in all", ["27", "18", "45", "21"])],
                      {"blue": "d", "all": "c"}),
        "meanmed": case("mean-median-blanks", "Six runners had these sprint times in seconds: 11.2, 11.4, 14.9, 14.6, 12.4, 14.7. Complete the sentence.",
                        S("Mean ", ("b", "mean"), " median ", ("b", "median")),
                        [("mean", "The mean in seconds", ["12.9", "13.5", "14.75", "13.2"]), ("median", "The median in seconds", ["13.6", "13.5", "12.4", "13.2"])],
                        {"mean": "d", "median": "b"}),
        "mode": case("median-mode-compare-blanks", "Two teams scored these points in seven games. Hawks: 5, 2, 5, 3, 6, 9, 7. Owls: 7, 9, 1, 9, 2, 6, 5. Complete.",
                     S("Median ", ("b", "median"), " modes ", ("b", "mode")),
                     [("median", "How the medians compare", ["less than", "equal to", "greater than"]), ("mode", "Whether the modes match", ["match", "do not match"])],
                     {"median": "a", "mode": "b"}),
        "rect": case("rectangle-chain-blanks", "A rectangle has an area of 209 square feet and a width of 11 feet. Complete the sentence.",
                     S("Length ", ("b", "length"), " perimeter ", ("b", "perim")),
                     [("length", "The length", ["19", "8", "198", "30"]), ("perim", "The perimeter", ["30", "60", "49", "38"])],
                     {"length": "a", "perim": "b"}),
        "wage": case("wage-and-cost-blanks", "A worker buys a uniform. Complete the sentence.",
                     S("Wage ", ("b", "wage"), " cost ", ("b", "cost")),
                     [("wage", "The hourly wage in dollars", ["35", "16", "30", "15"]), ("cost", "The amount spent in dollars", ["35", "15", "85", "50"])],
                     {"wage": "d", "cost": "a"},
                     table_figure([["Hours", "2", "4", "6", "8"], ["Net pay", MINUS + "5", "25", "55", "85"]])),
        "percent": case("percent-amounts-blanks", "A family earns 3,900 dollars a month. Rent is 35% of the income, and the rent limit is 1,405 dollars. Insurance is 4% of the income, and the insurance limit is 166 dollars. Complete the sentence.",
                        S("Rent is ", ("b", "rent"), " which is ", ("b", "rentv"), " its limit. Insurance is ", ("b", "ins"), " which is ", ("b", "insv"), " its limit."),
                        [("rent", "The rent in dollars", ["1,365", "1,521", "35", "111"]), ("rentv", "Rent compared with its limit", ["within", "over"]),
                         ("ins", "The insurance in dollars", ["3,744", "4", "1,521", "156"]), ("insv", "Insurance compared with its limit", ["within", "over"])],
                        {"rent": "a", "rentv": "a", "ins": "d", "insv": "a"}),
        "register": case("check-register-blanks", "In this check register, deposits are positive and withdrawals negative, in dollars. Complete it.", None,
                         [("b1", "The balance after line 1", [MINUS + "70", "38", MINUS + "80", "80"]), ("a2", "The amount of line 2", ["+20", "+10", MINUS + "70", MINUS + "10"]),
                          ("b3", "The balance after line 3", [MINUS + "142", MINUS + "72", "2", "142"]), ("a4", "The amount of line 4", [MINUS + "56", MINUS + "16", "+16", "+26"])],
                         {"b1": "c", "a2": "b", "b3": "a", "a4": "c"},
                         table_figure([["Line", "Amount", "Balance"], ["Start", "", MINUS + "21"], ["1", MINUS + "59", "?"], ["2", "?", MINUS + "70"],
                                       ["3", MINUS + "72", "?"], ["4", "?", MINUS + "126"]])),
    }


def self_test():
    cases = fixtures()
    require(set(c["public"]["templateId"] for c in cases.values()) == SUPPORTED, "A fixture for every template")
    for c in cases.values():
        review_problem(c)
    rejected = 0
    for name, c in cases.items():
        def corrupt(what, change):
            nonlocal rejected
            bad = copy.deepcopy(c)
            change(bad)
            require(bad != c, f"No-op mutation {what}")
            rejected += expect_rejected(review_problem, bad, f"{name}: {what}")

        first = c["public"]["response"]["blanks"][0]["id"]
        key = json.loads(c["answer"])
        other = "a" if key[first] != "a" else "b"
        corrupt("wrong answer", lambda p: p.update(answer=p["answer"].replace(f'"{first}":"{key[first]}"', f'"{first}":"{other}"')))
        corrupt("missing blank", lambda p: p.update(answer=json.dumps({k: v for k, v in key.items() if k != first}, separators=(",", ":"))))
        corrupt("keys out of order", lambda p: p.update(answer=json.dumps(dict(reversed(list(key.items()))), separators=(",", ":"))))
        # Duplicate meaning: overwrite a distractor with the correct label.
        blank = c["public"]["response"]["blanks"][0]
        right = next(o["label"] for o in blank["options"] if o["id"] == key[first])
        spare = next(i for i, o in enumerate(blank["options"]) if o["id"] != key[first])
        corrupt("two correct options", lambda p: p["public"]["response"]["blanks"][0]["options"][spare].update(label=right))
        # Give a computed numeric answer away in the hint.
        for b in c["public"]["response"]["blanks"]:
            label = next(o["label"] for o in b["options"] if o["id"] == key[b["id"]])
            k = key_of(label)
            if k[0] == "n" and "\\" not in label and abs(k[1]) not in numbers_in(public_text(c["public"])) and abs(k[1]) not in (0, 1):
                corrupt("leaking hint", lambda p: p.update(hint=f"The answer is {label}."))
                break
    # Specific corrupted givens must change the derived answer and so be rejected.
    base = cases["rect"]
    bad = copy.deepcopy(base)
    bad["public"]["prompt"] = bad["public"]["prompt"].replace("209", "210")
    rejected += expect_rejected(review_problem, bad, "changed given")
    base = cases["register"]
    bad = copy.deepcopy(base)
    bad["public"]["figure"]["scene"]["elements"][0]["rows"][3][2] = MINUS + "71"
    rejected += expect_rejected(review_problem, bad, "changed table")
    base = cases["wage"]
    bad = copy.deepcopy(base)
    bad["public"]["figure"]["scene"]["elements"][0]["rows"][1][3] = "56"
    rejected += expect_rejected(review_problem, bad, "nonlinear table")
    return {"fixtures": len(cases), "rejectedMutations": rejected}


if __name__ == "__main__":
    print(self_test())
