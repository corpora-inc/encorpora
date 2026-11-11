"""Independent answers for the equation and system clause templates.

Every value is read from the public prompt or from the sentences and choices
the learner sees. The stored answer is not an input.
"""
import json
import math
import re
from fractions import Fraction

SUPPORTED = frozenset({
    "variable-role-pair",
    "arithmetic-algebra-compare",
    "fee-budget-number-line",
    "fee-budget-meaning",
    "equation-make-example",
    "system-intersection-reason",
    "system-line-points",
    "system-crossing-estimate",
    "assume-solution-check",
    "scaled-elimination",
})
CHOICE_REVIEW = frozenset({
    "fee-budget-number-line",
    "fee-budget-meaning",
    "system-crossing-estimate",
})


def require(condition, message):
    if not condition:
        raise ValueError(message)


def dumps(value):
    return json.dumps(value, separators=(",", ":"))


def pick(options, label):
    hits = [option["id"] for option in options if option["label"] == label]
    require(len(hits) == 1, f"expected one choice {label!r}, found {len(hits)}")
    return hits[0]


def slots(public, expected):
    blanks = public["response"]["blanks"]
    require([blank["id"] for blank in blanks] == list(expected), f"blanks {[b['id'] for b in blanks]}")
    return dumps({blank["id"]: pick(blank["options"], expected[blank["id"]]) for blank in blanks})


def js_round(value):
    """Math.round: half goes toward +infinity."""
    return math.floor(value + Fraction(1, 2))


def half_text(twice):
    twice = int(twice)
    if twice % 2 == 0:
        return str(twice // 2)
    sign = "-" if twice < 0 else ""
    return f"{sign}{abs(twice) // 2}.5"


def slope_text(text):
    found = re.fullmatch(r"(-?\d+)(?:/(\d+))?", text)
    require(found is not None, f"slope {text}")
    numer = int(found[1])
    denom = int(found[2]) if found[2] else 1
    require(denom > 0, "denominator")
    g = math.gcd(abs(numer), denom)
    return numer // g, denom // g


def lines(prompt):
    # A negative intercept is written with a minus, not "+ −".
    found = re.findall(
        r"y = (-?\d+(?:/\d+)?)x (?:− (\d+)|\+ (-?\d+))",
        prompt,
    )
    require(len(found) == 2, "two lines")
    parsed = []
    for slope, minus, plus in found:
        numer, denom = slope_text(slope)
        intercept = -int(minus) if minus else int(plus)
        parsed.append((numer, denom, intercept))
    return parsed


def role_of(sentence):
    fixed = re.fullmatch(
        r".+ has s \w+\. .+ gives away (\d+) and has (\d+) left\.",
        sentence,
    )
    if fixed:
        return f"one unknown number: s = {int(fixed[1]) + int(fixed[2])}"
    if sentence == "A square with side h has perimeter 4h.":
        return "any positive number: h > 0"
    at_least = re.fullmatch(
        r"Riders must be at least (\d+) inches tall\. Let h be the height in inches of any rider allowed on\.",
        sentence,
    )
    if at_least:
        return f"any number in a set: h ≥ {at_least[1]}"
    at_most = re.fullmatch(
        r"A bag holds at most (\d+) books\. Let h be how many books are in an allowed bag\.",
        sentence,
    )
    if at_most:
        return f"any number in a set: h ≤ {at_most[1]}"
    more = re.fullmatch(
        r"The temperature must be more than (\d+) degrees\. Let h be an allowed temperature\.",
        sentence,
    )
    if more:
        return f"any number in a set: h > {more[1]}"
    fewer = re.fullmatch(
        r"Fewer than (\d+) people may enter\. Let h be an allowed number of people\.",
        sentence,
    )
    if fewer:
        return f"any number in a set: h < {fewer[1]}"
    raise ValueError(f"Unknown sentence {sentence!r}")


def variable_role(public):
    blanks = public["response"]["blanks"]
    return dumps({blank["id"]: pick(blank["options"], role_of(blank["label"])) for blank in blanks})


def arithmetic(public):
    prompt = public["prompt"]
    grouped = prompt.startswith("A rectangle has perimeter")
    if grouped:
        found = re.fullmatch(
            r"A rectangle has perimeter (\d+) cm and length (\d+) cm\. The width is w cm, and (\d+)\(w \+ (\d+)\) = (\d+)\.",
            prompt,
        )
        require(found is not None, "grouped story")
        total, length, factor, length_again, total_again = (int(found[i]) for i in range(1, 6))
        require(length == length_again and total == total_again, "story numbers")
        steps = f"Divide {total} by {factor}, then subtract {length}"
        algebra = f"{factor}(w + {length}) = {total}; divide both sides by {factor}"
        compare = f"Both divide by {factor} then subtract {length}, in that order; the algebra steps match"
    else:
        found = re.fullmatch(
            r"A gym charges (\d+) dollars to join and (\d+) dollars each month\. After months m, the total paid is (\d+) dollars: (\d+)m \+ (\d+) = (\d+)\.",
            prompt,
        )
        require(found is not None, "gym story")
        join, rate, total, rate_again, join_again, total_again = (int(found[i]) for i in range(1, 7))
        require(join == join_again and rate == rate_again and total == total_again, "story numbers")
        steps = f"Subtract {join} from {total}, then divide by {rate}"
        algebra = f"{rate}m + {join} = {total}; subtract {join} from both sides"
        compare = f"Both subtract {join} then divide by {rate}, in that order; the algebra steps match"
    return slots(public, {"arith": steps, "alg": algebra, "same": compare})


def fee_parts(prompt):
    found = re.search(r"(\d+) \+ (\d+)x ([≤≥<>]) ([0-9.]+)", prompt)
    require(found is not None, "fee inequality")
    fee, rate = int(found[1]), int(found[2])
    symbol = found[3]
    budget = Fraction(found[4])
    boundary = (budget - fee) / rate
    toward_zero = {
        "≤": fee <= budget,
        "<": fee < budget,
        "≥": fee >= budget,
        ">": fee > budget,
    }[symbol]
    return fee, rate, symbol, budget, boundary, toward_zero


def boundary_text(boundary):
    require(boundary.denominator in (1, 2), "half boundary")
    if boundary.denominator == 1:
        return str(boundary.numerator)
    return half_text(boundary.numerator if boundary.denominator == 2 else js_round(boundary * 2))


def fee_graph(public):
    _fee, _rate, symbol, _budget, boundary, toward_zero = fee_parts(public["prompt"])
    open_circle = symbol in ("<", ">")
    label = (
        f"{'An open' if open_circle else 'A filled'} circle at {boundary_text(boundary)} "
        f"with the ray shaded {'left' if toward_zero else 'right'}."
    )
    return pick(public["response"]["options"], label)


def fee_meaning(public):
    _fee, _rate, symbol, _budget, boundary, _toward = fee_parts(public["prompt"])
    up = symbol in ("≥", ">")
    strict = symbol in ("<", ">")
    whole = boundary.denominator == 1
    named = math.ceil(boundary) if up else math.floor(boundary)
    unit = "guests"
    if strict:
        key = (
            f"Every count above {boundary_text(boundary)} works, so at least {named} {unit}"
            if up
            else f"Every count below {boundary_text(boundary)} works, so at most {named} {unit}"
        )
    elif up:
        key = (
            f"Any whole number of {unit} from {named} up fits; {named} is the least"
            if whole
            else f"Every number of {unit} {boundary_text(boundary)} or more works, so at least {named} {unit}"
        )
    else:
        key = (
            f"Any whole number of {unit} from 0 to {named} fits; {named} is the most"
            if whole
            else f"Every number of {unit} {boundary_text(boundary)} or less works, so at most {named} {unit}"
        )
    return pick(public["response"]["options"], key)


def axb(factor, constant):
    if factor == 0:
        return str(constant)
    if factor == 1:
        term = "x"
    elif factor == -1:
        term = "-x"
    else:
        term = f"{factor}x"
    if constant == 0:
        return term
    if constant > 0:
        return f"{term}+{constant}"
    return f"{term}{constant}"


def parse_axb(text):
    if re.fullmatch(r"-?\d+", text):
        return 0, int(text)
    found = re.fullmatch(r"(-)?(\d*)x(?:([+-])(\d+))?", text)
    require(found is not None, f"expression {text}")
    sign = -1 if found[1] else 1
    magnitude = int(found[2]) if found[2] else 1
    constant = 0 if found[3] is None else int(f"{found[3]}{found[4]}")
    return sign * magnitude, constant


def make_example(public):
    prompt = public["prompt"]
    numeric = re.search(r"\$(\d+)\(x − (\d+)\) = (\d+)x − □\$", prompt)
    if numeric:
        factor, shift, factor_again = (int(numeric[i]) for i in (1, 2, 3))
        require(factor == factor_again, "same factor")
        return dumps([[str(factor * shift)]])
    found = re.search(r"\$([0-9x+-]+) = ____\$", prompt)
    require(found is not None, "right side")
    factor, constant = parse_axb(found[1])
    none_constant = constant - 1 if constant == 12 else constant + 1
    one_factor = factor - 1 if factor == 9 else factor + 1
    return dumps([[axb(factor, none_constant)], [axb(factor, constant)], [axb(one_factor, constant)]])


def intersection(public):
    (n1, d1, b1), (n2, d2, b2) = lines(public["prompt"])
    found = re.search(r"Q is \((-?\d+), (-?\d+)\)", public["prompt"])
    require(found is not None, "Q")
    qx, qy = int(found[1]), int(found[2])
    y1 = b1 + Fraction(n1 * qx, d1)
    y2 = b2 + Fraction(n2 * qx, d2)
    require(y1 == qy and y2 == qy and y1.denominator == 1, "Q is the crossing")
    return slots(public, {
        "who": "Q",
        "why": "Q is on both lines, so it makes both equations true",
        "chk": f"At Q, line 1 gives {qy} and line 2 gives {qy}",
    })


def line_through(p1, p2):
    x1, y1 = p1
    x2, y2 = p2
    a = y2 - y1
    b = x1 - x2
    c = a * x1 + b * y1
    g = math.gcd(math.gcd(abs(a), abs(b)), abs(c)) or 1
    a, b, c = a // g, b // g, c // g
    if a < 0 or (a == 0 and b < 0):
        a, b, c = -a, -b, -c
    return a, b, c


def lattice(a, b, c):
    return [
        [x, y]
        for x in range(-8, 9)
        for y in range(-8, 9)
        if a * x + b * y == c
    ]


def plot_line(public):
    (numer, denom, intercept), _second = lines(public["prompt"])
    start = (0, intercept)
    step = (denom, intercept + numer)
    a, b, c = line_through(start, step)
    points = lattice(a, b, c)
    require(len(points) >= 2, "two lattice points")
    chosen = sorted((points[0], points[-1]))
    return dumps(chosen)


def crossing(public):
    (n1, d1, b1), (n2, d2, b2) = lines(public["prompt"])
    slope1, slope2 = Fraction(n1, d1), Fraction(n2, d2)
    require(slope1 != slope2, "parallel")
    x = (b2 - b1) / (slope1 - slope2)
    y = slope1 * x + b1
    label = f"({half_text(js_round(x * 2))}, {half_text(js_round(y * 2))})"
    return pick(public["response"]["options"], label)


def assume(public):
    prompt = public["prompt"]
    why = "We assume a solution exists; later lines are true for that x"
    none = re.fullmatch(
        r"Suppose x is a number with (\d+)\(x([+-]\d+)\) = (\d+)x([+-]\d+)\. Expanding and subtracting \d+x from both sides leaves (-?\d+) = (-?\d+)\.",
        prompt,
    )
    if none:
        left, right = none[5], none[6]
        return slots(public, {
            "why": why,
            "shown": "The assumption led to a false statement, so no number is a solution",
            "chk": f"{left} = {right} is false, so the supposition is impossible",
        })
    found = re.fullmatch(
        r"Suppose x is a number with (\d+)\(x([+-]\d+)\) = (\d+)x([+-]\d+)\. The chain reaches x = (-?\d+)\.",
        prompt,
    )
    require(found is not None, "assumption")
    factor = int(found[1])
    plus = int(found[2])
    x = int(found[5])
    side = factor * (x + plus)
    return slots(public, {
        "why": why,
        "shown": f"If there is a solution, it must be {x}",
        "chk": f"Substitute {x}: both sides equal {side}",
    })


def coef(value, letter):
    if value == 1:
        return letter
    if value == -1:
        return f"-{letter}"
    return f"{value}{letter}"


def elimination(public):
    found = re.search(
        r"(-?\d+)x([+-]\d+)y = (-?\d+)\b.*?(-?\d+)x([+-]\d+)y = (-?\d+)\b.*?"
        r"The system is replaced by E1 and E2 (?:− (\d+)|\+ (\d+))·E1\.",
        public["prompt"],
        re.S,
    )
    require(found is not None, "elimination")
    a, b = int(found[1]), int(found[2])
    c = int(found[3])
    d, e = int(found[4]), int(found[5])
    f = int(found[6])
    k = -int(found[7]) if found[7] else int(found[8])
    combined = d + k * a
    right = f + k * c
    require(e + k * b == 0 and combined != 0, "y cancels")
    expected = {
        "sum": f"{coef(combined, 'x')} = {right}",
        "why": "Adding k·E1 keeps solutions, and subtracting k·E1 brings E2 back",
    }
    if any(blank["id"] == "gen" for blank in public["response"]["blanks"]):
        expected["gen"] = f"{right}, because it equals f + kc"
    return slots(public, expected)


def solve(public):
    template = public["templateId"]
    require(template in SUPPORTED, "Unsupported family")
    return {
        "variable-role-pair": variable_role,
        "arithmetic-algebra-compare": arithmetic,
        "fee-budget-number-line": fee_graph,
        "fee-budget-meaning": fee_meaning,
        "equation-make-example": make_example,
        "system-intersection-reason": intersection,
        "system-line-points": plot_line,
        "system-crossing-estimate": crossing,
        "assume-solution-check": assume,
        "scaled-elimination": elimination,
    }[template](public)


def review_problem(problem):
    got = solve(problem["public"])
    require(got == problem["answer"], f"{problem['public']['templateId']}: {got} != {problem['answer']}")
    return got


def self_test():
    role = {
        "templateId": "variable-role-pair",
        "prompt": "Each sentence uses a letter. For each sentence, choose the role of the letter.",
        "response": {"blanks": [
            {
                "id": "fix",
                "label": "Tara has s stickers. Tara gives away 7 and has 15 left.",
                "options": [
                    {"id": "a", "label": "one unknown number: s = 22"},
                    {"id": "b", "label": "one unknown number: s = 15"},
                ],
            },
            {
                "id": "set",
                "label": "Riders must be at least 48 inches tall. Let h be the height in inches of any rider allowed on.",
                "options": [
                    {"id": "a", "label": "any number in a set: h ≥ 48"},
                    {"id": "b", "label": "one unknown number: h = 48"},
                ],
            },
        ]},
    }
    require(solve(role) == '{"fix":"a","set":"a"}', "roles")
    example = {
        "templateId": "equation-make-example",
        "prompt": "Fill the box so $3(x − 4) = 3x − □$ has infinitely many solutions.",
        "response": {"kind": "structured-work"},
    }
    require(solve(example) == '[["12"]]', "identity box")
    return 2


if __name__ == "__main__":
    print(self_test())
