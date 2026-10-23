"""Public-only exact successive-percent arithmetic and final cent rounding.

The independent calculation uses fractions parsed from the learner's prompt;
no generator helpers, tags, private coefficients or answer flags are inputs.
"""

import copy
import re
from decimal import Decimal, localcontext
from fractions import Fraction

SUPPORTED = frozenset({"successive-percent-change"})
ENDING = (
    "What is the final price, in dollars? Keep the exact price after the first "
    "change; round only the final price to the nearest cent, with halfway amounts rounded up."
)
RATE = r"(\d+(?:\.\d{1,3})?)"
PROMPT = re.compile(
    r"A [A-Za-z][A-Za-z -]* has a starting price of \$(\d+\.\d{2})\. "
    r"First, the price (increases|decreases) by " + RATE + r"%\. "
    r"Then, the price (increases|decreases) by "
    + RATE
    + r"% of the price after the first change\. "
    r"(The second increase is sales tax\. )?" + re.escape(ENDING)
)


def require(condition, message):
    if not condition:
        raise ValueError(message)


def round_cents(value):
    require(value >= 0, "Negative monetary amount outside family")
    shifted = value * 100 + Fraction(1, 2)
    return shifted.numerator // shifted.denominator


def money(cents):
    return f"{cents // 100}.{cents % 100:02d}"


def givens(public):
    require(public["templateId"] in SUPPORTED, "Unexpected family")
    require(
        public["response"]
        == {"kind": "number", "label": "Final price in dollars (nearest cent)"},
        "Unexpected response or units",
    )
    match = PROMPT.fullmatch(public["prompt"])
    require(
        match is not None, "Unrecognized prompt or missing rounding/base convention"
    )
    price, direction1, rate1, direction2, rate2, tax = match.groups()
    start, p, q = map(Fraction, (price, rate1, rate2))
    require(start > 0 and p > 0 and q > 0, "Positive price and nonzero rates required")
    require(not tax or direction2 == "increases", "Tax must increase price")
    signed_p = p if direction1 == "increases" else -p
    signed_q = q if direction2 == "increases" else -q
    require(
        signed_p > -100 and signed_q > -100, "Changes must preserve positive prices"
    )
    first = start * (1 + signed_p / 100)
    final = first * (1 + signed_q / 100)
    return start, signed_p, signed_q, first, final


def solve(public):
    return money(round_cents(givens(public)[-1]))


def review_problem(problem):
    expected = solve(problem["public"])
    require(problem["answer"] == expected, "Incorrect final-only half-up amount")
    require("explanation" in problem, "Missing explanation")
    check_explanation(problem["public"], problem["explanation"])
    return expected


def check_explanation(public, steps):
    start, p, q, first, final = givens(public)
    require(len(steps) == 4, "Four complete explanation steps required")
    number = r"(\d+(?:\.\d+)?)"
    for index, heading, base, rate, result in [
        (0, "First", start, p, first),
        (2, "Second", first, q, final),
    ]:
        pattern = (
            heading
            + r" change: \$"
            + number
            + r" \\times \(1 ([+-]) "
            + number
            + r"/100\) = "
            + number
            + r"\$ dollars\."
        )
        match = re.fullmatch(pattern, steps[index])
        require(match is not None, "Missing exact multiplication equation")
        shown_base, sign, shown_rate, shown_result = match.groups()
        require(
            Fraction(shown_base) == base and Fraction(shown_rate) == abs(rate),
            "Wrong percentage base or rate",
        )
        require(sign == ("+" if rate > 0 else "-"), "Wrong change direction")
        require(
            Fraction(shown_result) == result,
            "Wrong or prematurely rounded intermediate",
        )
    base_statement = re.fullmatch(
        r"The second change uses the exact "
        + number
        + r" dollar price after the first change as its base\.",
        steps[1],
    )
    require(
        base_statement is not None and Fraction(base_statement[1]) == first,
        "Incorrect second-base explanation",
    )
    rounded_statement = re.fullmatch(
        r"Round only the final "
        + number
        + r" dollars to the nearest cent, with halfway amounts rounded up: "
        + number
        + r" dollars\.",
        steps[3],
    )
    require(rounded_statement is not None, "Missing final rounding explanation")
    require(
        Fraction(rounded_statement[1]) == final
        and Fraction(rounded_statement[2]) == Fraction(solve(public)),
        "Incorrect final rounding explanation",
    )


def fixture(start, first, second, answer):
    def change(rate):
        return (
            "increases" if Fraction(rate) > 0 else "decreases",
            str(rate).lstrip("-"),
        )

    d1, p = change(first)
    d2, q = change(second)
    result = {
        "public": {
            "templateId": next(iter(SUPPORTED)),
            "prompt": f"A jacket has a starting price of ${start}. First, the price {d1} by {p}%. Then, the price {d2} by {q}% of the price after the first change. "
            + ENDING,
            "response": {
                "kind": "number",
                "label": "Final price in dollars (nearest cent)",
            },
        },
        "answer": answer,
    }

    price, p_signed, q_signed, intermediate, final = givens(result["public"])

    def decimal(value):
        with localcontext() as context:
            context.prec = 40
            return format(Decimal(value.numerator) / Decimal(value.denominator), "f")

    a, b = decimal(intermediate), decimal(final)
    result["explanation"] = [
        f"First change: ${start} \\times (1 {'+' if p_signed > 0 else '-'} {p}/100) = {a}$ dollars.",
        f"The second change uses the exact {a} dollar price after the first change as its base.",
        f"Second change: ${a} \\times (1 {'+' if q_signed > 0 else '-'} {q}/100) = {b}$ dollars.",
        f"Round only the final {b} dollars to the nearest cent, with halfway amounts rounded up: {answer} dollars.",
    ]
    return result


def self_test():
    cases = [
        fixture("60.00", "-20", "20", "57.60"),
        fixture("100.00", "10", "20", "132.00"),
        fixture("100.00", "-10", "-20", "72.00"),
        fixture("100.00", "10", "-20", "88.00"),
        fixture("1.00", "-12.5", "12.5", "0.98"),
        fixture("100.00", "-20", "8.875", "87.10"),
        fixture("1.00", "25", "-50", "0.63"),
    ]
    for case in cases:
        review_problem(case)
    mutants = []
    # Wrong base and additive-net-percent shortcut both give 60, not 57.60.
    for index, wrong in [(0, "60.00"), (4, "0.99"), (6, "0.62"), (5, "87.09")]:
        bad = copy.deepcopy(cases[index])
        bad["answer"] = wrong
        mutants.append(bad)
    for before, after in [
        ("after the first change", "before the first change"),
        (ENDING, "Round the final price to cents."),
        ("20%", "0%"),
        ("20%", "100%"),
        ("$60.00", "$0.00"),
    ]:
        bad = copy.deepcopy(cases[0])
        bad["public"]["prompt"] = bad["public"]["prompt"].replace(before, after, 1)
        mutants.append(bad)
    for bad in mutants:
        try:
            review_problem(bad)
        except ValueError:
            continue
        raise AssertionError("Accepted corrupted monetary case")
    explained = fixture("1.00", "-12.5", "12.5", "0.98")
    explained["explanation"] = [
        "First change: $1.00 \\times (1 - 12.5/100) = 0.875$ dollars.",
        "The second change uses the exact 0.875 dollar price after the first change as its base.",
        "Second change: $0.875 \\times (1 + 12.5/100) = 0.984375$ dollars.",
        "Round only the final 0.984375 dollars to the nearest cent, with halfway amounts rounded up: 0.98 dollars.",
    ]
    review_problem(explained)
    for index, before, after in [
        (0, "0.875", "0.88"),
        (1, "0.875", "1.00"),
        (2, "$0.875", "$1.00"),
        (2, " + ", " - "),
        (3, "0.98 dollars", "0.99 dollars"),
    ]:
        bad = copy.deepcopy(explained)
        bad["explanation"][index] = bad["explanation"][index].replace(before, after)
        require(bad != explained, "No-op corruption")
        try:
            review_problem(bad)
        except ValueError:
            continue
        raise AssertionError("Accepted corrupted intermediate explanation")
    return {"fixtures": len(cases) + 1, "mutations": len(mutants) + 5}
