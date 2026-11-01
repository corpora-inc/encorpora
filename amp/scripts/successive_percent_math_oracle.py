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
    answer = Fraction(solve(public))
    require(len(steps) == 6, "Six complete explanation steps required")
    number = r"(\d+(?:\.\d+)?)"
    definition = re.fullmatch(
        r"A change of " + number + r"% (adds|removes) " + number
        + r" hundredths of the price\. Multiplying by \$1 ([+-]) " + number
        + r"/100\$ does that in one step\.",
        steps[0],
    )
    require(
        definition is not None
        and Fraction(definition[1]) == Fraction(definition[3]) == Fraction(definition[5]) == abs(p)
        and definition[2] == ("adds" if p > 0 else "removes")
        and definition[4] == ("+" if p > 0 else "-"),
        "Incorrect percent-multiplier explanation",
    )
    for index, heading, base, rate, result in [
        (1, "First", start, p, first),
        (3, "Second", first, q, final),
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
        r"The " + number + r"% is taken of the new price, " + number
        + r" dollars, not the starting price\. Keep it exact, because rounding early can change the cents\.",
        steps[2],
    )
    require(
        base_statement is not None
        and Fraction(base_statement[1]) == abs(q)
        and Fraction(base_statement[2]) == first,
        "Incorrect second-base explanation",
    )
    exact = re.fullmatch(
        number + r" dollars is already a whole number of cents, so no rounding is needed\.",
        steps[4],
    )
    rounded = re.fullmatch(
        r"A cent is 0\.01 dollar\. Round " + number
        + r" to two decimal places, with halfway amounts rounded up: " + number + r"\.",
        steps[4],
    )
    require(
        (exact is not None and Fraction(exact[1]) == final == answer)
        or (rounded is not None and Fraction(rounded[1]) == final and Fraction(rounded[2]) == answer),
        "Incorrect final rounding explanation",
    )
    conclusion = re.fullmatch(r"The final price is " + number + r" dollars\.", steps[5])
    require(
        conclusion is not None and Fraction(conclusion[1]) == answer,
        "Incorrect final price conclusion",
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
        f"A change of {p}% {'adds' if p_signed > 0 else 'removes'} {p} hundredths of the price. "
        f"Multiplying by $1 {'+' if p_signed > 0 else '-'} {p}/100$ does that in one step.",
        f"First change: ${start} \\times (1 {'+' if p_signed > 0 else '-'} {p}/100) = {a}$ dollars.",
        f"The {q}% is taken of the new price, {a} dollars, not the starting price. "
        "Keep it exact, because rounding early can change the cents.",
        f"Second change: ${a} \\times (1 {'+' if q_signed > 0 else '-'} {q}/100) = {b}$ dollars.",
        f"{b} dollars is already a whole number of cents, so no rounding is needed."
        if Fraction(b) == Fraction(answer)
        else f"A cent is 0.01 dollar. Round {b} to two decimal places, with halfway amounts rounded up: {answer}.",
        f"The final price is {answer} dollars.",
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
        "A change of 12.5% removes 12.5 hundredths of the price. Multiplying by $1 - 12.5/100$ does that in one step.",
        "First change: $1.00 \\times (1 - 12.5/100) = 0.875$ dollars.",
        "The 12.5% is taken of the new price, 0.875 dollars, not the starting price. Keep it exact, because rounding early can change the cents.",
        "Second change: $0.875 \\times (1 + 12.5/100) = 0.984375$ dollars.",
        "A cent is 0.01 dollar. Round 0.984375 to two decimal places, with halfway amounts rounded up: 0.98.",
        "The final price is 0.98 dollars.",
    ]
    review_problem(explained)
    for index, before, after in [
        (0, "removes", "adds"),
        (1, "0.875", "0.88"),
        (2, "0.875", "1.00"),
        (3, "$0.875", "$1.00"),
        (3, " + ", " - "),
        (4, "0.98.", "0.99."),
        (5, "0.98 dollars", "0.99 dollars"),
    ]:
        bad = copy.deepcopy(explained)
        bad["explanation"][index] = bad["explanation"][index].replace(before, after)
        require(bad != explained, "No-op corruption")
        try:
            review_problem(bad)
        except ValueError:
            continue
        raise AssertionError("Accepted corrupted intermediate explanation")
    return {"fixtures": len(cases) + 1, "mutations": len(mutants) + 7}
