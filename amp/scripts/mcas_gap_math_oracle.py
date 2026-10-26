"""Independent exact review of the MCAS select-all and gap templates.

Every statement is evaluated from the public prompt and option labels alone
with exact Fraction arithmetic. No generator helper is imported. Multi-select
answers are the sorted JSON list of option IDs; the stated selection count must
equal the number of true statements, and mathematically equivalent statements
are rejected as duplicates.

Families on the variation-axis layer (equation orientation, true/false pairs,
unknown target, number domain) are decoded by variation_axes_oracle: this file
judges each displayed statement once and the shared helper checks the format.
"""

import copy
import json
import math
import re
from fractions import Fraction

from variation_axes_oracle import (
    is_rational as exact_is_rational,
    oriented_equation,
    statement_set,
    statements as displayed_statements,
    verdict_lines,
)

MULTI = frozenset(
    {
        "mcas-true-fact-equations",
        "mcas-round-hundred-select",
        "mcas-prime-factor-select",
        "mcas-comparison-equations-select",
        "mcas-true-product-equations",
        "mcas-prism-range-select",
        "mcas-ratio-statements-select",
        "mcas-true-quotient-equations",
        "mcas-cube-prism-statements",
        "mcas-statistical-question-select",
        "mcas-fraction-rate-select",
        "mcas-negative-fraction-forms",
        "mcas-markup-price-select",
        "mcas-rational-irrational-select",
        "mcas-sci-notation-select",
        "mcas-table-intercept-select",
        "mcas-quadratic-zeros-select",
        "mcas-congruence-statement-select",
        "mcas-circle-equation-select",
        "mcas-cylinder-scaling-select",
    }
)
CHOICE = frozenset(
    {
        "mcas-circle-radius-distance",
        "mcas-parenthesized-product-statement",
        "mcas-slope-sign-description",
        "mcas-rotational-symmetry",
        "mcas-product-factor-size",
    }
)
SUPPORTED = MULTI | CHOICE


def require(condition, message):
    if not condition:
        raise ValueError(message)


def tex(label):
    m = re.fullmatch(r"\$(.*)\$", label, re.S)
    require(m is not None, f"Unexpected label {label!r}")
    return m.group(1)


def integer(text):
    text = text.replace("{,}", "").replace(",", "").replace("\u2212", "-")
    require(re.fullmatch(r"-?\d+", text) is not None, f"Not an integer: {text!r}")
    return int(text)


def number(text):
    """Integer, decimal, \\frac{a}{b} or mixed number n\\frac{a}{b}."""
    text = text.strip().replace("{,}", "").replace("\u2212", "-")
    m = re.fullmatch(r"(-?)(\d*)\\frac\{(\d+)\}\{(\d+)\}", text)
    if m:
        sign = -1 if m.group(1) else 1
        return sign * (
            Fraction(int(m.group(2) or 0)) + Fraction(int(m.group(3)), int(m.group(4)))
        )
    require(re.fullmatch(r"-?\d+(\.\d+)?", text) is not None, f"Not a number: {text!r}")
    return Fraction(text)


def selection(public, count_in_prompt=True):
    r = public["response"]
    require(r["kind"] == "multi-select", "Expected multi-select")
    opts = r["options"]
    ids = [o["id"] for o in opts]
    require(
        len(set(ids)) == len(ids) and all(re.fullmatch(r"option-[a-f]", i) for i in ids),
        "Duplicate or foreign option id",
    )
    labels = [o["label"] for o in opts]
    require(len(set(labels)) == len(labels), "Duplicate option text")
    if count_in_prompt:
        m = re.search(r"(?:Choose|Which) the (\d+)|Which (\d+)", public["prompt"])
        require(m is not None, "Prompt does not state a selection count")
        stated = int(m.group(1) or m.group(2))
        require(stated == r["selectionCount"], "Prompt count differs from selectionCount")
    return opts, r["selectionCount"]


def finish(public, truths, key=None):
    """truths: list of bool aligned to options. Enforce count and distinctness."""
    opts, count = selection(public)
    require(len(truths) == len(opts), "Truth list misaligned")
    require(sum(truths) == count, f"{sum(truths)} true statements but {count} selected")
    if key is not None:
        require(len(set(key)) == len(key), "Mathematically duplicate statements")
    return json.dumps(sorted(o["id"] for o, t in zip(opts, truths) if t), separators=(",", ":"))


# ---------------------------------------------------------------- templates


def eval_arith(label, ops=None):
    """Truth of "a op b = c" written in either orientation (7 = 63 / 9 too)."""
    operation, result = oriented_equation(tex(label), lambda side: "\\times" in side or "\\div" in side)
    m = re.fullmatch(r"([\d{},]+)\\(times|div)(\d+)", operation)
    require(m is not None and re.fullmatch(r"[\d{},]+", result), f"Bad arithmetic label {label!r}")
    a, op, b = integer(m.group(1)), m.group(2), int(m.group(3))
    rhs = integer(result)
    if op == "times":
        return a * b == rhs, ("t", a, b, rhs)
    require(b != 0, "Division by zero")
    return Fraction(a, b) == rhs, ("d", a, b, rhs)


def arithmetic(public):
    """Any statement-set format: select-all or true/false pairs."""
    return statement_set(public, lambda l: eval_arith(l)[0], lambda l: eval_arith(l)[1])


def round_hundred(public):
    m = re.search(r"round to ([\d,]+) (?:fans|dollars) when rounded to the nearest hundred", public["prompt"])
    require(m is not None, "Round prompt")
    target = integer(m.group(1))
    require(target % 100 == 0, "Target must be a hundred")
    truths, key = [], []
    for o in public["response"]["options"]:
        m = re.fullmatch(r"([\d,]+) (?:fans|dollars)", o["label"])
        require(m is not None, "Round label")
        v = integer(m.group(1))
        rounded = (v + 50) // 100 * 100  # half up
        truths.append(rounded == target)
        key.append(v)
    return finish(public, truths, key)


def is_prime(n):
    return n > 1 and all(n % d for d in range(2, math.isqrt(n) + 1))


def prime_factor(public):
    opts = public["response"]["options"]
    vals = [integer(o["label"]) for o in opts]
    if "are prime" in public["prompt"]:
        require("greater than 1" in public["prompt"], "Prime definition")
        truths = [is_prime(v) for v in vals]
    else:
        m = re.search(r"are factors of (\d+)\?$", public["prompt"])
        m2 = re.match(r"A factor of (\d+) is a whole number that divides (\d+) with no remainder", public["prompt"])
        require(m and m2 and m.group(1) == m2.group(1) == m2.group(2), "Factor prompt")
        n = int(m.group(1))
        truths = [v > 0 and n % v == 0 for v in vals]
    return finish(public, truths, vals)


def comparison(public):
    """Either quantity of the story may be the unknown $n$."""
    m = re.match(
        r"A group has (\d+) (.+?)\. There are (\d+) (times as many|more) (.+?) (?:than|as) (.+?)\. Let \$n\$ be the number of (.+?)\. Which \d+ equations can be used to find \$n\$\?$",
        public["prompt"],
    )
    require(m is not None, "Comparison prompt")
    given, given_noun, b = int(m.group(1)), m.group(2), int(m.group(3))
    times, big, small, asked = m.group(4) == "times as many", m.group(5), m.group(6), m.group(7)
    if given_noun == small and asked == big:
        target = Fraction(given * b) if times else Fraction(given + b)
    else:
        require(given_noun == big and asked == small, "The story names the given and the asked groups")
        target = Fraction(given, b) if times else Fraction(given - b)
        require(target.denominator == 1 and target > 0, "The smaller amount is a whole number")

    def ev(side, n):
        side = side.strip()
        if side == "n":
            return Fraction(n)
        for sym, fn in (
            ("\\times", lambda x, y: x * y),
            ("\\div", None),
            ("+", lambda x, y: x + y),
            ("-", lambda x, y: x - y),
        ):
            if sym in side:
                x, y = side.split(sym)
                x, y = ev(x, n), ev(y, n)
                if sym == "\\div":
                    require(y != 0, "div0")
                    return x / y
                return fn(x, y)
        return Fraction(int(side))

    def truth(label):
        lhs, rhs = tex(label).split("=")
        return ev(lhs, target) == ev(rhs, target)

    return statement_set(public, truth, lambda label: tex(label).replace("\\times", "*").replace(" ", ""))


def product_equations(public):
    require("product of a three-digit number and a one-digit number" in public["prompt"], "Product prompt")
    return arithmetic(public)


def prism_range(public):
    prisms = []
    for o in public["response"]["options"]:
        m = re.fullmatch(r"Prism ([A-E]): \$(\d+)\\times(\d+)\\times(\d+)\$ cm", o["label"])
        require(m is not None, "Prism label")
        prisms.append(int(m.group(2)) * int(m.group(3)) * int(m.group(4)))
    p = public["prompt"]
    m = re.search(r"Choose the 2 prisms whose volumes added together equal (\d+) cubic centimeters\.", p)
    if m:
        lo = hi = int(m.group(1))
    else:
        m = re.search(r"added together are greater than (\d+) and less than (\d+) cubic centimeters\.", p)
        require(m is not None, "Prism prompt")
        lo, hi = int(m.group(1)) + 1, int(m.group(2)) - 1
        require(lo <= hi, "Empty range")
    pairs = [
        (i, j)
        for i in range(len(prisms))
        for j in range(i + 1, len(prisms))
        if lo <= prisms[i] + prisms[j] <= hi
    ]
    require(len(pairs) == 1, f"{len(pairs)} qualifying pairs")
    truths = [k in pairs[0] for k in range(len(prisms))]
    opts, count = selection(public)
    require(count == 2, "Prism pair count")
    return finish(public, truths)


def ratio_statements(public):
    m = re.match(r"A \w+ holds (.+?)\. A ratio is written in the order", public["prompt"]) or re.match(
        r"A \w+ has (.+?)\. A ratio is written in the order", public["prompt"]
    )
    require(m is not None, "Ratio prompt")
    groups = re.findall(r"(\d+) ([a-z]+ [a-z]+)", m.group(1))
    require(len(groups) in (2, 3), "Group count")
    counts = {name: int(n) for n, name in groups}
    noun = groups[0][1].split()[1]
    total = sum(counts.values())

    def amount(phrase):
        if phrase == f"all the {noun}":
            return total
        require(phrase in counts, f"Unknown group {phrase}")
        return counts[phrase]

    truths, key = [], []
    for o in public["response"]["options"]:
        m = re.fullmatch(r"The ratio of (.+) to (.+) is \$(\d+):(\d+)\$\.", o["label"])
        require(m is not None, "Ratio label")
        x, y = amount(m.group(1)), amount(m.group(2))
        a, b = int(m.group(3)), int(m.group(4))
        truths.append(a * y == b * x)
        key.append(o["label"])
    return finish(public, truths, key)


def quotient_equations(public):
    return arithmetic(public)


def cube_prism(public):
    m = re.match(
        r"A rectangular prism is \$(.+?)\$ units long, \$(.+?)\$ units wide and \$(.+?)\$ units tall\. It is packed with no gaps or overlaps with small cubes whose edges are \$(.+?)\$ unit long\.",
        public["prompt"],
    )
    require(m is not None, "Cube prompt")
    length, width, height, edge = (number(m.group(i)) for i in range(1, 5))
    volume = length * width * height
    cube = edge**3
    truths, key = [], []
    for o in public["response"]["options"]:
        s = o["label"]
        if (g := re.fullmatch(r"(\d+) cubes fit along the length\.", s)):
            t = length / edge == int(g.group(1))
        elif (g := re.fullmatch(r"Each small cube has a volume of \$(.+?)\$ cubic unit\.", s)):
            t = number(g.group(1)) == cube
        elif (g := re.fullmatch(r"It takes (\d+) cubes to fill the prism\.", s)):
            t = volume / cube == int(g.group(1))
        elif (g := re.fullmatch(r"The volume of the prism is \$?(.+?)\$? cubic units\.", s)):
            t = number(g.group(1)) == volume
        elif s == "Multiplying the three edge lengths gives the volume.":
            t = True
        elif s == "Adding the three edge lengths gives the volume.":
            require(length + width + height != volume, "Sum coincides with volume")
            t = False
        else:
            raise ValueError(f"Unknown cube statement {s!r}")
        truths.append(t)
        key.append(s)
    require(length / edge == int(length / edge) and volume / cube == int(volume / cube), "Cubes must tile")
    return finish(public, truths, key)


STATISTICAL = {
    "How old are the people who come to the Saturday shows?": True,
    "How many laps do swimmers complete in one visit?": True,
    "How old are the members of the swim team?": True,
    "Is the theater open on Sunday?": False,
    "What time does the pool open on Monday?": False,
    "What time does the first movie start today?": False,
    "How many visitors come to the pool each day in July?": True,
    "How long does each swimmer stay at the pool on a Saturday?": True,
    "How many seats are in Theater 3?": False,
    "How many muffins are left unsold at closing each night?": True,
    "How many lanes does the pool have?": False,
    "How many loaves of bread are sold each day?": True,
    "What is the price of one sourdough loaf?": False,
    "How many screens does the theater have?": False,
    "How much money does each customer spend at the snack counter?": True,
    "How many lifeguards are on duty right now?": False,
    "How many minutes does each cake take to decorate?": True,
    "What time does the bakery open on Tuesday?": False,
    "How many ovens does the bakery have?": False,
    "How many minutes do customers wait in line to buy tickets?": True,
    "How deep is the deep end of the pool?": False,
    "How much does each customer spend on a visit?": True,
    "How many cakes were ordered for Sam's party?": False,
    "How tall are the students who visit the library?": True,
    "How many tickets are sold for each showing this week?": True,
    "What time does the library close on Friday?": False,
    "How many pages are in the books on the fiction shelf?": True,
    "How many floors does the library have?": False,
    "How many minutes do students stay in the library at lunch?": True,
    "How many books did Jada check out today?": False,
    "Is the library open on Saturdays?": False,
    "How many books does each student check out in a month?": True,
}


def statistical(public):
    require("expect to have different answers" in public["prompt"], "Definition missing")
    truths = []
    for o in public["response"]["options"]:
        require(o["label"] in STATISTICAL, f"Unclassified question {o['label']!r}")
        truths.append(STATISTICAL[o["label"]])
    return finish(public, truths, [o["label"] for o in public["response"]["options"]])


def fraction_rate(public):
    trips = {}
    for day, d, t in re.findall(
        r"On (Monday|Wednesday|Friday) the hiker walked \$(.+?)\$ miles in \$(.+?)\$ hours\.", public["prompt"]
    ):
        trips[day] = number(d) / number(t)
    require(len(trips) == 3, "Three hiking days")
    truths, key = [], []
    for o in public["response"]["options"]:
        m = re.fullmatch(r"(Monday|Wednesday|Friday): \$(.+?)\$ miles per hour", o["label"])
        require(m is not None, "Rate label")
        truths.append(trips[m.group(1)] == number(m.group(2)))
        key.append((m.group(1), number(m.group(2))))
    return finish(public, truths, key)


def frac_value(text):
    """Value of a signed fraction expression built from \\frac, -, \\cdot and brackets."""
    s = text.replace("\\left(", "(").replace("\\right)", ")").replace(" ", "")

    def parse_term(i):
        sign = 1
        while i < len(s) and s[i] == "-":
            sign, i = -sign, i + 1
        if s.startswith("\\frac{", i):
            j = s.index("}{", i)
            num_text = s[i + 6 : j]
            k = s.index("}", j + 2)
            den_text = s[j + 2 : k]
            return sign * frac_value(num_text) / frac_value(den_text), k + 1
        if s.startswith("(", i):
            depth, j = 0, i
            while True:
                depth += (s[j] == "(") - (s[j] == ")")
                if depth == 0:
                    break
                j += 1
            return sign * frac_value(s[i + 1 : j]), j + 1
        m = re.compile(r"\d+").match(s, i)
        require(m is not None, f"Bad fraction expression {text!r}")
        return sign * Fraction(int(m.group())), m.end()

    value, i = parse_term(0)
    while s.startswith("\\cdot", i):
        nxt, i = parse_term(i + 5)
        value *= nxt
    require(i == len(s), f"Trailing text in {text!r}")
    require(value is not None, "value")
    return value


def negative_fraction(public):
    m = re.fullmatch(r"Which 3 expressions are equal to \$(.+?)\$\?", public["prompt"])
    require(m is not None, "Fraction-form prompt")
    target = frac_value(m.group(1))
    truths, key = [], []
    for o in public["response"]["options"]:
        v = frac_value(tex(o["label"]))
        truths.append(v == target)
        key.append(o["label"])
    return finish(public, truths, key)


def markup(public):
    m = re.fullmatch(
        r"A store sets each selling price (\d+) percent (below|above) the item's cost\. Which 2 items have the correct selling price\?",
        public["prompt"],
    )
    require(m is not None, "Markup prompt")
    p = Fraction(int(m.group(1)), 100)
    factor = 1 - p if m.group(2) == "below" else 1 + p
    truths, key = [], []
    for o in public["response"]["options"]:
        g = re.fullmatch(r"([A-Za-z]+): cost (\d+) dollars, selling price (\d+) dollars", o["label"])
        require(g is not None, "Markup label")
        truths.append(int(g.group(2)) * factor == int(g.group(3)))
        key.append(g.group(1))
    return finish(public, truths, key)


def perfect_power(n, k):
    """True when the positive rational n is a perfect k-th power of a rational."""
    n = Fraction(n)

    def root(m):
        r = round(m ** (1 / k))
        return any((r + d) ** k == m for d in (-1, 0, 1))

    return root(n.numerator) and root(n.denominator)


def rational_expr(text):
    t = text.replace(" ", "")
    if (m := re.fullmatch(r"\\sqrt\{(\d+)\}", t)):
        return perfect_power(int(m.group(1)), 2)
    if (m := re.fullmatch(r"\\sqrt\{\\frac\{(\d+)\}\{(\d+)\}\}", t)):
        return perfect_power(Fraction(int(m.group(1)), int(m.group(2))), 2)
    if (m := re.fullmatch(r"\\sqrt\[3\]\{(\d+)\}", t)):
        return perfect_power(int(m.group(1)), 3)
    if (m := re.fullmatch(r"(\d+)\\sqrt\{(\d+)\}", t)):
        return perfect_power(int(m.group(2)), 2)
    if (m := re.fullmatch(r"\\sqrt\{(\d+)\}\\cdot\\sqrt\{(\d+)\}", t)):
        return perfect_power(int(m.group(1)) * int(m.group(2)), 2)
    if (m := re.fullmatch(r"\\sqrt\{(\d+)\}\+\\sqrt\{(\d+)\}", t)):
        # a sum of two positive square roots is rational only when both are
        return perfect_power(int(m.group(1)), 2) and perfect_power(int(m.group(2)), 2)
    if (m := re.fullmatch(r"\\pi\+\\sqrt\{(\d+)\}", t)):
        return False  # pi plus a real number that is algebraic is transcendental
    if (m := re.fullmatch(r"(\d+)\\pi", t)) or (m := re.fullmatch(r"(\d+)\\cdot\\pi", t)):
        return False
    if (m := re.fullmatch(r"(\d+)\\cdot\\frac\{\\pi\}\{(\d+)\}", t)):
        return int(m.group(1)) == 0
    if (m := re.fullmatch(r"\\frac\{(\d+)\\pi\}\{(\d+)?\\pi\}", t)):
        return True
    if (m := re.fullmatch(r"\\left\(\\sqrt\{(\d+)\}\+(\d+)\\right\)\\left\(\\sqrt\{\1\}-\2\\right\)", t)):
        return True  # difference of squares: a - b^2
    # Powers of pi and of radicals, and other forms: the shared exact evaluator.
    return exact_is_rational(t)


def rational_irrational(public):
    require("A rational number can be written as a ratio of two integers" in public["prompt"], "Definition")
    labels = [tex(o["label"]) for o in public["response"]["options"]]
    return finish(public, [rational_expr(x) for x in labels], labels)


def sci_notation(public):
    require(
        public["prompt"]
        == "Each equation writes a number in scientific notation as a standard numeral. Choose the %d equations that are true."
        % public["response"]["selectionCount"],
        "Sci prompt",
    )
    truths, key = [], []
    for o in public["response"]["options"]:
        m = re.fullmatch(r"\$(\d+)\\times10\^\{(-?\d+)\}=(-?[\d{},.]+)\$", o["label"])
        require(m is not None, f"Sci label {o['label']!r}")
        lhs = Fraction(int(m.group(1))) * Fraction(10) ** int(m.group(2))
        rhs = Fraction(m.group(3).replace("{,}", ""))
        truths.append(lhs == rhs)
        key.append(lhs)
    return finish(public, truths, key)


def table_intercept(public):
    m = re.match(
        r"The linear function \$y=(-?\d*)x([+-]\d+)\$ has a \$y\$-intercept of (-?\d+)\. Each option lists the \$x\$ and \$y\$ values of a table for a linear function\. Choose the (\d+) tables whose \$y\$-intercept is (less|greater) than (-?\d+)\.",
        public["prompt"],
    )
    require(m is not None, "Table prompt")
    require(int(m.group(2)) == int(m.group(3)), "Stated intercept disagrees with equation")
    ref = int(m.group(6))
    require(ref == int(m.group(3)), "Comparison value must be the stated intercept")
    less = m.group(5) == "less"
    truths, key = [], []
    for o in public["response"]["options"]:
        g = re.fullmatch(r"\$x\$: (-?\d+), (-?\d+), (-?\d+) and \$y\$: (.+?), (.+?), (.+)", o["label"])
        require(g is not None, "Table label")
        xs = [int(g.group(i)) for i in (1, 2, 3)]
        ys = [integer(g.group(i)) for i in (4, 5, 6)]
        slope = Fraction(ys[1] - ys[0], xs[1] - xs[0])
        require(Fraction(ys[2] - ys[1], xs[2] - xs[1]) == slope, "Table is not linear")
        b = ys[0] - slope * xs[0]
        truths.append(b < ref if less else b > ref)
        key.append(tuple(zip(xs, ys)))
    return finish(public, truths, key)


def poly_value(expr, x):
    e = expr.replace(" ", "")
    if (m := re.fullmatch(r"\(x([+-]\d+)\)\(x([+-]\d+)\)", e)):
        return (x + int(m.group(1))) * (x + int(m.group(2)))
    m = re.fullmatch(r"(-?\d*)x\^\{2\}(?:([+-]\d*)x)?(?:([+-]\d+))?", e)
    require(m is not None, f"Unparsed polynomial {expr!r}")

    def coef(t, default=0):
        if t is None:
            return default
        if t in ("", "+"):
            return 1
        if t == "-":
            return -1
        return int(t)

    a, b, c = coef(m.group(1)), coef(m.group(2)), coef(m.group(3))
    return a * x * x + b * x + c


def quadratic_zeros(public):
    m = re.fullmatch(r"Which 2 values of \$x\$ make the expression \$(.+)\$ equal to 0\?", public["prompt"])
    require(m is not None, "Zero prompt")
    expr = m.group(1)
    truths, key = [], []
    for o in public["response"]["options"]:
        g = re.fullmatch(r"\$x=(-?\d+)\$", o["label"])
        require(g is not None, "Zero label")
        truths.append(poly_value(expr, int(g.group(1))) == 0)
        key.append(int(g.group(1)))
    # the expression must really have two distinct zeros among integers
    zeros = {x for x in range(-60, 61) if poly_value(expr, x) == 0}
    require(len(zeros) == 2, "Expression does not have exactly two integer zeros")
    return finish(public, truths, key)


def congruence(public):
    m = re.match(
        r"The triangles satisfy \$\\triangle ([A-Z]{3})\\cong\\triangle ([A-Z]{3})\$\. Choose the (\d+) statements about corresponding parts that must be true\.",
        public["prompt"],
    )
    require(m is not None, "Congruence prompt")
    t1, t2 = m.group(1), m.group(2)
    require(len(set(t1 + t2)) == 6, "Triangles share vertex names")
    idx = {ch: i for i, ch in enumerate(t1)} | {ch: i for i, ch in enumerate(t2)}
    truths, key = [], []
    for o in public["response"]["options"]:
        s = tex(o["label"])
        if (g := re.fullmatch(r"\\angle ([A-Z])\\cong\\angle ([A-Z])", s)):
            a, b = g.groups()
            truths.append(idx[a] == idx[b] and a != b)
            key.append(("a", frozenset((a, b))))
        elif (g := re.fullmatch(r"\\overline\{([A-Z])([A-Z])\}\\cong\\overline\{([A-Z])([A-Z])\}", s)):
            a, b, c, d = g.groups()
            truths.append(
                {idx[a], idx[b]} == {idx[c], idx[d]} and len({a, b, c, d}) == 4 and len({a, b}) == 2
            )
            key.append(("s", frozenset((frozenset((a, b)), frozenset((c, d))))))
        else:
            raise ValueError(f"Unknown congruence statement {s!r}")
    return finish(public, truths, key)


def circle_equation(public):
    m = re.fullmatch(
        r"A circle in the coordinate plane has the equation \$\(x([+-]\d+)\)\^\{2\}\+\(y([+-]\d+)\)\^\{2\}=(\d+)\$\. Choose the 2 true statements\.",
        public["prompt"],
    )
    require(m is not None, "Circle prompt")
    h, k, r2 = -int(m.group(1)), -int(m.group(2)), int(m.group(3))
    r = math.isqrt(r2)
    require(r * r == r2 and r > 0, "Radius must be a positive integer")
    truths, key = [], []
    for o in public["response"]["options"]:
        s = o["label"]
        if (g := re.fullmatch(r"The radius is (\d+)\.", s)):
            t = int(g.group(1)) == r
        elif (g := re.fullmatch(r"The diameter is (\d+)\.", s)):
            t = int(g.group(1)) == 2 * r
        elif (g := re.fullmatch(r"The center is the point \$\\left\((-?\d+),(-?\d+)\\right\)\$\.", s)):
            t = (int(g.group(1)), int(g.group(2))) == (h, k)
        elif (g := re.fullmatch(r"The point \$\\left\((-?\d+),(-?\d+)\\right\)\$ is on the circle\.", s)):
            t = (int(g.group(1)) - h) ** 2 + (int(g.group(2)) - k) ** 2 == r2
        elif s in ("The origin is inside the circle.", "The origin is outside the circle."):
            d2 = h * h + k * k  # on the circle: neither inside nor outside
            t = d2 < r2 if "inside" in s else d2 > r2
        else:
            raise ValueError(f"Unknown circle statement {s!r}")
        truths.append(t)
        key.append(s)
    return finish(public, truths, key)


def cylinder(public):
    require("$V=\\pi r^{2}h$" in public["prompt"], "Cylinder formula")
    truths, key = [], []
    for o in public["response"]["options"]:
        s = o["label"]
        r_f = h_f = Fraction(1)
        if (g := re.search(r"the radius is multiplied by \$(.+?)\$", s)):
            r_f = number(g.group(1))
        if (g := re.search(r"the height is multiplied by \$(.+?)\$", s)):
            h_f = number(g.group(1))
        g = re.fullmatch(r"If .*, the volume is multiplied by \$(.+?)\$\.", s)
        require(g is not None and (r_f != 1 or h_f != 1), f"Cylinder label {s!r}")
        truths.append(r_f * r_f * h_f == number(g.group(1)))
        key.append(s)
    return finish(public, truths, key)


# ---------------------------------------------------------------- single choice


def single(public, truths):
    r = public["response"]
    require(r["kind"] == "choice", "Expected choice")
    opts = r["options"]
    require(len(opts) == 4, "Four options")
    require(len({o["label"] for o in opts}) == 4, "Duplicate options")
    require(sum(truths) == 1, f"{sum(truths)} defensible answers")
    return next(o["id"] for o, t in zip(opts, truths) if t)


def radius_distance(public):
    p = public["prompt"]
    if (m := re.fullmatch(r"Point \$O\$ is the center of a circle with radius (\d+) cm, and point \$P\$ is on the circle\. What is the distance from \$O\$ to \$P\$\?", p)):
        r = Fraction(int(m.group(1)))
    elif (m := re.fullmatch(r"A circle has center \$O\$ and a diameter of (\d+) cm\. Point \$P\$ is on the circle\. What is the distance from \$O\$ to \$P\$\?", p)):
        r = Fraction(int(m.group(1)), 2)
    elif (m := re.fullmatch(r"A circle with center \$O\$ has a circumference of \$(\d+)\\pi\$ cm\. Point \$P\$ is on the circle\. What is the distance from \$O\$ to \$P\$\?", p)):
        r = Fraction(int(m.group(1)), 2)
    else:
        raise ValueError("Radius prompt")
    vals = []
    for o in public["response"]["options"]:
        m = re.fullmatch(r"(\d+) cm", o["label"])
        require(m is not None, "cm label")
        vals.append(Fraction(int(m.group(1))))
    return single(public, [v == r for v in vals])


def parenthesized(public):
    m = re.fullmatch(
        r"Which statement describes the expression \$(.+)\$ without evaluating it\?", public["prompt"]
    )
    require(m is not None, "Parenthesized prompt")
    e = m.group(1)
    if (g := re.fullmatch(r"(\d+)\\times\((\d+)([+-])(\d+)\)", e)) or (
        g := re.fullmatch(r"\((\d+)([+-])(\d+)\)\\times(\d+)", e)
    ):
        if e.startswith("("):
            a, sign, b, k = g.groups()
        else:
            k, a, sign, b = g.groups()
    else:
        raise ValueError("Parenthesized expression")
    word = "sum" if sign == "+" else "difference"
    wanted = f"{k} times as large as the {word} of {a} and {b}"
    return single(public, [o["label"] == wanted for o in public["response"]["options"]])


def slope_sign(public):
    m = re.fullmatch(
        r"(.+?) is a linear function of (.+?)\. As (.+?) (increases|decreases), (.+?) (increases|decreases|stays the same)\. What is the sign of the slope of this function\?",
        public["prompt"].replace("\u00a0", " "),
    )
    # sentence pieces: "...is a linear function of X. As X increases, Y decreases."
    require(m is not None, "Slope prompt")
    x_dir, y_dir = m.group(4), m.group(6)
    if y_dir == "stays the same":
        want = "Zero"
    else:
        want = "Positive" if (x_dir == y_dir) else "Negative"
    return single(public, [o["label"] == want for o in public["response"]["options"]])


ROTATIONAL = {
    "An isosceles triangle that is not equilateral": False,
    "A regular hexagon": True,
    "A scalene triangle": False,
    "A trapezoid with exactly one pair of parallel sides and unequal legs": False,
    "An equilateral triangle": True,
    "A right triangle with unequal legs": False,
    "A kite that is not a rhombus": False,
    "A regular pentagon": True,
    "An isosceles trapezoid": False,
    "A rhombus that is not a square": True,
    "A square": True,
    "A parallelogram with no right angles": True,
    "A rectangle that is not a square": True,
}


def rotational(public):
    p = public["prompt"]
    require(p.startswith("A figure has rotational symmetry if a turn of less than 360"), "Definition")
    has = p.endswith("Which figure has rotational symmetry?")
    require(has or p.endswith("Which figure does not have rotational symmetry?"), "Question")
    labels = [o["label"] for o in public["response"]["options"]]
    for label in labels:
        require(label in ROTATIONAL, f"Unclassified figure {label!r}")
    return single(public, [ROTATIONAL[l] == has for l in labels])


def factor_size(public):
    m = re.fullmatch(
        r"Without multiplying, which product is (less than|equal to|greater than) \$\\frac\{(\d+)\}\{(\d+)\}\$\?",
        public["prompt"],
    )
    require(m is not None, "Product prompt")
    ref = Fraction(int(m.group(2)), int(m.group(3)))
    rel = m.group(1)
    truths = []
    for o in public["response"]["options"]:
        parts = tex(o["label"]).split("\\times")
        require(len(parts) == 2, "Two factors")
        v = frac_value(parts[0]) * frac_value(parts[1])
        truths.append({"less than": v < ref, "equal to": v == ref, "greater than": v > ref}[rel])
    return single(public, truths)


DISPATCH = {
    "mcas-true-fact-equations": arithmetic,
    "mcas-round-hundred-select": round_hundred,
    "mcas-prime-factor-select": prime_factor,
    "mcas-comparison-equations-select": comparison,
    "mcas-true-product-equations": product_equations,
    "mcas-prism-range-select": prism_range,
    "mcas-ratio-statements-select": ratio_statements,
    "mcas-true-quotient-equations": quotient_equations,
    "mcas-cube-prism-statements": cube_prism,
    "mcas-statistical-question-select": statistical,
    "mcas-fraction-rate-select": fraction_rate,
    "mcas-negative-fraction-forms": negative_fraction,
    "mcas-markup-price-select": markup,
    "mcas-rational-irrational-select": rational_irrational,
    "mcas-sci-notation-select": sci_notation,
    "mcas-table-intercept-select": table_intercept,
    "mcas-quadratic-zeros-select": quadratic_zeros,
    "mcas-congruence-statement-select": congruence,
    "mcas-circle-equation-select": circle_equation,
    "mcas-cylinder-scaling-select": cylinder,
    "mcas-circle-radius-distance": radius_distance,
    "mcas-parenthesized-product-statement": parenthesized,
    "mcas-slope-sign-description": slope_sign,
    "mcas-rotational-symmetry": rotational,
    "mcas-product-factor-size": factor_size,
}


def solve(public):
    require(public["templateId"] in SUPPORTED, "Wrong family")
    return DISPATCH[public["templateId"]](public)


def verdicts(public, problem):
    """Per-statement verdict lines in the explanation must match the independent truth."""
    return verdict_lines({**problem, "public": public, "answer": solve(public)})


def review_problem(problem):
    public = problem["public"]
    expected = solve(public)
    require(problem["answer"] == expected, f"Wrong or noncanonical answer: {problem['answer']!r} vs {expected!r}")
    review_explanations(problem)
    return expected


def review_explanations(problem):
    """Strict verdict-line check, applied where a template writes per-option verdicts."""
    public = problem["public"]
    if public["templateId"] in MULTI:
        try:
            verdicts(public, problem)
        except ValueError as error:
            if "No unique explanation line" not in str(error):
                raise


# ---------------------------------------------------------------- self test


def option_list(labels):
    return [{"id": f"option-{chr(97 + i)}", "label": l} for i, l in enumerate(labels)]


def expect_failure(fn, message):
    try:
        fn()
    except ValueError:
        return
    raise AssertionError(message)


def self_test():
    def multi(template, prompt, labels, count):
        return {
            "templateId": template,
            "prompt": prompt,
            "response": {"kind": "multi-select", "selectionCount": count, "options": option_list(labels)},
        }

    good = multi(
        "mcas-true-fact-equations",
        "Choose the 3 equations that are true.",
        ["$28\\div7=5$", "$27\\div3=9$", "$7\\times3=21$", "$35\\div5=9$", "$4\\times2=6$", "$6\\times5=30$"],
        3,
    )
    require(solve(good) == '["option-b","option-c","option-f"]', "Arithmetic fixture")
    fixtures = {
        "mcas-round-hundred-select": multi(
            "mcas-round-hundred-select",
            "A stadium reports attendance at five games. Which 2 attendance counts round to 5,400 fans when rounded to the nearest hundred?",
            ["5,363 fans", "5,357 fans", "5,461 fans", "5,632 fans", "5,338 fans"],
            2,
        ),
        "mcas-ratio-statements-select": multi(
            "mcas-ratio-statements-select",
            "A jar holds 7 square buttons and 2 round buttons. A ratio is written in the order its words are stated. Choose the 3 true statements.",
            [
                "The ratio of round buttons to all the buttons is $4:18$.",
                "The ratio of square buttons to round buttons is $2:7$.",
                "The ratio of round buttons to square buttons is $2:7$.",
                "The ratio of all the buttons to round buttons is $2:9$.",
                "The ratio of all the buttons to square buttons is $9:7$.",
                "The ratio of square buttons to all the buttons is $16:9$.",
            ],
            3,
        ),
        "mcas-cube-prism-statements": multi(
            "mcas-cube-prism-statements",
            "A rectangular prism is $2$ units long, $3$ units wide and $1\\frac{1}{2}$ units tall. It is packed with no gaps or overlaps with small cubes whose edges are $\\frac{1}{2}$ unit long. Choose the 2 true statements.",
            [
                "4 cubes fit along the length.",
                "Each small cube has a volume of $\\frac{1}{4}$ cubic unit.",
                "It takes 72 cubes to fill the prism.",
                "The volume of the prism is $36$ cubic units.",
                "Adding the three edge lengths gives the volume.",
            ],
            2,
        ),
        "mcas-negative-fraction-forms": multi(
            "mcas-negative-fraction-forms",
            "Which 3 expressions are equal to $-\\frac{17}{5}$?",
            [
                "$\\frac{17}{-5}$",
                "$-\\left(-\\frac{17}{5}\\right)$",
                "$-\\frac{5}{17}$",
                "$(-1)\\cdot\\frac{17}{5}$",
                "$\\frac{-17}{5}$",
                "$\\frac{-17}{-5}$",
            ],
            3,
        ),
        "mcas-congruence-statement-select": multi(
            "mcas-congruence-statement-select",
            "The triangles satisfy $\\triangle WMF\\cong\\triangle ETD$. Choose the 3 statements about corresponding parts that must be true.",
            [
                "$\\angle W\\cong\\angle E$",
                "$\\overline{MF}\\cong\\overline{TE}$",
                "$\\overline{FM}\\cong\\overline{TD}$",
                "$\\angle F\\cong\\angle E$",
                "$\\overline{MW}\\cong\\overline{TE}$",
                "$\\angle M\\cong\\angle E$",
            ],
            3,
        ),
        "mcas-quadratic-zeros-select": multi(
            "mcas-quadratic-zeros-select",
            "Which 2 values of $x$ make the expression $2x^{2}+16x+14$ equal to 0?",
            ["$x=-1$", "$x=-6$", "$x=-2$", "$x=0$", "$x=-7$"],
            2,
        ),
    }
    answers = {
        "mcas-round-hundred-select": '["option-a","option-b"]',
        "mcas-ratio-statements-select": '["option-a","option-c","option-e"]',
        "mcas-cube-prism-statements": '["option-a","option-c"]',
        "mcas-negative-fraction-forms": '["option-a","option-d","option-e"]',
        "mcas-congruence-statement-select": '["option-a","option-c","option-e"]',
        "mcas-quadratic-zeros-select": '["option-a","option-e"]',
    }
    for template, public in fixtures.items():
        require(solve(public) == answers[template], f"Fixture {template}")
        problem = {"public": public, "answer": answers[template]}
        review_problem(problem)
        # wrong set, wrong count and duplicate statements must all fail
        for wrong in ['["option-a"]', '["option-a","option-b","option-c","option-d"]', "[]"]:
            bad = copy.deepcopy(problem)
            bad["answer"] = wrong
            expect_failure(lambda bad=bad: review_problem(bad), f"Accepted corrupt answer for {template}")
        bad = copy.deepcopy(public)
        bad["response"]["selectionCount"] += 1
        expect_failure(lambda bad=bad: solve(bad), f"Accepted wrong stated count for {template}")
        bad = copy.deepcopy(public)
        bad["response"]["options"][-1]["label"] = bad["response"]["options"][0]["label"]
        expect_failure(lambda bad=bad: solve(bad), f"Accepted duplicate option for {template}")
    # a false statement swapped for a true one changes the true count
    bad = copy.deepcopy(good)
    bad["response"]["options"][0]["label"] = "$28\\div7=4$"
    expect_failure(lambda: solve(bad), "Accepted a fourth true equation")
    # choice fixtures
    choice = {
        "templateId": "mcas-product-factor-size",
        "prompt": "Without multiplying, which product is equal to $\\frac{3}{5}$?",
        "response": {
            "kind": "choice",
            "options": option_list(
                [
                    "$\\frac{3}{5}\\times\\frac{3}{4}$",
                    "$\\frac{3}{5}\\times\\frac{2}{2}$",
                    "$\\frac{3}{5}\\times\\frac{2}{3}$",
                    "$\\frac{3}{5}\\times2$",
                ]
            ),
        },
    }
    require(solve(choice) == "option-b", "Product-size fixture")
    bad = copy.deepcopy(choice)
    bad["response"]["options"][0]["label"] = "$\\frac{3}{5}\\times1$"
    expect_failure(lambda: solve(bad), "Accepted two equal products")
    rotation = {
        "templateId": "mcas-rotational-symmetry",
        "prompt": "A figure has rotational symmetry if a turn of less than 360\u00b0 about some center maps it onto itself. Which figure does not have rotational symmetry?",
        "response": {
            "kind": "choice",
            "options": option_list(
                [
                    "A trapezoid with exactly one pair of parallel sides and unequal legs",
                    "An equilateral triangle",
                    "A regular pentagon",
                    "A rhombus that is not a square",
                ]
            ),
        },
    }
    require(solve(rotation) == "option-a", "Rotation fixture")
    bad = copy.deepcopy(rotation)
    bad["response"]["options"][1]["label"] = "A scalene triangle"
    expect_failure(lambda: solve(bad), "Accepted two non-symmetric figures")
    slope = {
        "templateId": "mcas-slope-sign-description",
        "prompt": "The temperature $T$ of the air is a linear function of the distance $d$ climbed. As the distance $d$ climbed decreases, the temperature $T$ of the air decreases. What is the sign of the slope of this function?",
        "response": {
            "kind": "choice",
            "options": option_list(["It depends on the starting value", "Zero", "Negative", "Positive"]),
        },
    }
    require(solve(slope) == "option-d", "Slope fixture")
    bad = copy.deepcopy(slope)
    bad["prompt"] = bad["prompt"].replace("decreases, the temperature", "increases, the temperature")
    require(solve(bad) == "option-c", "Opposite directions give a negative slope")
    bad["response"]["options"][2]["label"] = "Positive"
    expect_failure(lambda: solve(bad), "Accepted two defensible slope signs or none")
    require(rational_expr("(\\sqrt{7}+4)(\\sqrt{7}-4)".replace("(", "\\left(").replace(")", "\\right)")), "Difference of squares")
    require(not rational_expr("\\sqrt{7}+\\sqrt{3}"), "Surd sum")
    # Variation axes: result-first orientation, true/false pairs, the smaller
    # quantity as the unknown and powers of pi and radicals.
    oriented = multi(
        "mcas-true-fact-equations",
        "Choose the 3 equations that are true.",
        ["$7=63\\div9$", "$64=8\\times8$", "$5=36\\div6$", "$4\\times6=25$", "$56=7\\times8$", "$9=45\\div4$"],
        3,
    )
    require(solve(oriented) == '["option-a","option-b","option-e"]', "Result-first fixture")
    pairs = multi(
        "mcas-true-product-equations",
        "Each equation states the product of a three-digit number and a one-digit number. Decide whether each of the 3 equations is true or false, and choose the correct statement for each equation.",
        [
            "$294\\times6=1{,}746$ is true.",
            "$294\\times6=1{,}746$ is false.",
            "$2{,}233=319\\times7$ is true.",
            "$2{,}233=319\\times7$ is false.",
            "$785\\times9=7{,}065$ is true.",
            "$785\\times9=7{,}065$ is false.",
        ],
        3,
    )
    require(solve(pairs) == '["option-b","option-c","option-e"]', "Pair fixture")
    bad = copy.deepcopy(pairs)
    bad["response"]["options"][1]["label"] = "$294\\times6=1{,}764$ is false."
    expect_failure(lambda: solve(bad), "Accepted a pair whose claims name different equations")
    smaller = multi(
        "mcas-comparison-equations-select",
        "A group has 36 students. There are 4 times as many students as chaperones. Let $n$ be the number of chaperones. Which 3 equations can be used to find $n$?",
        ["$n\\times4=36$", "$36\\times4=n$", "$36\\div4=n$", "$36=n+4$", "$36\\div n=4$", "$n\\div36=4$"],
        3,
    )
    require(solve(smaller) == '["option-a","option-c","option-e"]', "Smaller-unknown fixture")
    powers = multi(
        "mcas-rational-irrational-select",
        "A rational number can be written as a ratio of two integers. Which 2 of these expressions have a rational value?",
        [
            "$\\pi^{2}$",
            "$4\\pi$",
            "$\\frac{4\\pi^{2}}{\\pi^{2}}$",
            "$\\left(\\sqrt{10}\\right)^{3}$",
            "$\\left(\\sqrt{2}\\right)^{4}$",
        ],
        2,
    )
    require(solve(powers) == '["option-c","option-e"]', "Powers fixture")
