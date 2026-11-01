"""Independent review of the equation-slot families from public payloads.

Each blank's correct option is derived from the prompt wording, the shown
table or the displayed expression with exact Fractions (a linear rule from two
table points, a unit fraction quotient, an operation chosen by trying all
sixteen or sixty-four operation combinations under real precedence, a dilation
factor from a point and its image, a square-root equation solved by hand).
The private answer, hint and explanation are values under test. Each blank has
distinct options (by value) and exactly one correct one; grading needs every
blank (`grade`).
"""

import copy
import itertools
import json
import re
import sys
from fractions import Fraction as F
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from multi_part_choice_math_oracle import common_response, check_card_use, compact, pick, require  # noqa: E402

SUPPORTED = frozenset({
    "booth-equation-slots", "budget-inequality-slots", "unit-fraction-division-slots", "array-division-slots",
    "story-operations-slots", "delivery-operations-slots", "table-equation-slots", "rule-table-fill-slots",
    "unit-price-sentence-slots", "cylinder-volume-slots", "dilation-rule-slots", "transformation-rule-slots",
    "exponent-quotient-slots", "square-root-solutions-slots", "function-shift-sentence"})
PLACEHOLDER = re.compile(r"\$\{|\bundefined\b|\bNaN\b|\[object")
OPS = {"$+$": lambda a, b: a + b, "$-$": lambda a, b: a - b, "$\\times$": lambda a, b: a * b,
       "$\\div$": lambda a, b: a / b if b != 0 else None}
SYMBOLS = {"$<$": "<", "$\\le$": "<=", "$>$": ">", "$\\ge$": ">="}
MINUS = "−"


def value_of(label):
    """A displayed number: plain (with a true minus), $n$, $-n$, $\\frac{p}{q}$ or $-\\frac{p}{q}$."""
    text = label[1:-1] if label.startswith("$") and label.endswith("$") else label
    text = text.replace(MINUS, "-")
    if re.fullmatch(r"-?\d{1,3}(?:,\d{3})+", text):
        text = text.replace(",", "")
    m = re.fullmatch(r"(-?)(?:(\d+(?:\.\d+)?)|\\frac\{(\d+)\}\{(\d+)\})", text)
    require(m is not None, f"Not a number option: {label!r}")
    sign, plain, top, bottom = m.groups()
    value = F(plain) if plain is not None else F(int(top), int(bottom))
    return -value if sign else value


def sentence_of(response):
    return "".join(part["text"] if "text" in part else "{" + part["blank"] + "}" for part in response.get("sentence", []))


def grade(public, key, submitted):
    try:
        given = json.loads(submitted)
    except (TypeError, ValueError):
        return False
    return isinstance(given, dict) and list(given) == [b["id"] for b in public["response"]["blanks"]] and given == json.loads(key)


def labelled(blanks, ids, labels):
    require([b["id"] for b in blanks] == ids, f"Blank ids {[b['id'] for b in blanks]} != {ids}")
    require([b["label"] for b in blanks] == labels, f"Blank labels {[b['label'] for b in blanks]} != {labels}")


def tex_frac(value):
    value = F(value)
    return str(value.numerator) if value.denominator == 1 else f"\\frac{{{value.numerator}}}{{{value.denominator}}}"


def decimal_text(value):
    return f"{float(value):.2f}"


def solve_ops(numbers, result, expected_ops):
    """The operation list that the story intends must be the only one that makes the displayed equation true."""
    names = list(OPS)
    hits = []
    for combo in itertools.product(names, repeat=len(numbers) - 1):
        # real precedence: x and div bind tighter than + and -
        terms, signs = [F(numbers[0])], []
        ok = True
        for op, n in zip(combo, numbers[1:]):
            if op in ("$\\times$", "$\\div$"):
                r = OPS[op](terms[-1], F(n))
                if r is None:
                    ok = False
                    break
                terms[-1] = r
            else:
                signs.append(op)
                terms.append(F(n))
        if not ok:
            continue
        total = terms[0]
        for s, t in zip(signs, terms[1:]):
            total = OPS[s](total, t)
        if total == result:
            hits.append(combo)
    require(tuple(expected_ops) in hits, "The story's operations do not give the displayed result")
    require(len(hits) == 1, f"The equation {numbers} = {result} is also true for {hits}")


def solve_detail(public):
    t, prompt, response = public["templateId"], public["prompt"], public["response"]
    require(t in SUPPORTED, "Wrong family")
    facts = {}
    if t == "booth-equation-slots":
        m = re.fullmatch(r"A fair charges (\d+) dollars for each (\w+) and (a fixed fee of|gives a discount of) (\d+) dollars\. "
                         r"A group pays (\d+) dollars in all for \$([a-z])\$ (\w+)\. Complete the equation\.", prompt)
        require(m is not None, f"Prompt {prompt!r}")
        rate, item, kind, once, total, var, plural = int(m[1]), m[2], m[3], int(m[4]), int(m[5]), m[6], m[7]
        fee = kind == "a fixed fee of"
        count = F(total - once if fee else total + once, rate)
        require(count.denominator == 1 and count >= 2, "The group size must be a whole number of at least 2")
        blanks = common_response(response, "inline", "Choose the number or symbol for each gap")
        s = sentence_of(response)
        front = s == "{total} $=$ {rate} $" + var + "$ {op} {once}"
        require(front or s == "{rate} $" + var + "$ {op} {once} $=$ {total}", f"Sentence {s!r}")
        ids = ["total", "rate", "op", "once"] if front else ["rate", "op", "once", "total"]
        names = {"total": "The total", "rate": f"The amount for each {item}", "op": "The operation", "once": "The fixed fee" if fee else "The discount"}
        labelled(blanks, ids, [names[i] for i in ids])
        by = {b["id"]: b for b in blanks}
        key = {"total": pick(by["total"], F(total), value_of), "rate": pick(by["rate"], F(rate), value_of),
               "op": pick(by["op"], "$+$" if fee else "$-$", lambda l: l), "once": pick(by["once"], F(once), value_of)}
        key = {i: key[i] for i in ids}
        equation = f"{total}={rate}{var}{'+' if fee else '-'}{once}" if front else f"{rate}{var}{'+' if fee else '-'}{once}={total}"
        facts = {"last": f"The total is {total} dollars, so the equation is ${equation}$."}
    elif t == "budget-inequality-slots":
        phrase = {"more than": ">", "at least": ">=", "less than": "<", "at most": "<="}
        m = re.fullmatch(r"Lena has saved (\d+) dollars toward a bike that costs (\d+) dollars\. She will save \$d\$ dollars more, "
                         r"and she wants to have (more than|at least) (\d+) dollars\. Complete the inequality\.", prompt)
        if m:
            known, limit, word, again, var = int(m[1]), int(m[2]), m[3], int(m[4]), "d"
            require(limit == again and known < limit, "The goal is the bike price, above the savings")
            labels = ["The amount saved", "The inequality symbol", "The goal"]
        else:
            m = re.fullmatch(r"Jo has (\d+) dollars\. A ticket costs (\d+) dollars\. Jo will spend \$s\$ dollars on snacks, and the ticket and the snacks "
                             r"together must cost (at most|less than) the (\d+) dollars Jo has\. Complete the inequality\.", prompt)
            require(m is not None, f"Prompt {prompt!r}")
            limit, known, word, again, var = int(m[1]), int(m[2]), m[3], int(m[4]), "s"
            require(limit == again and known < limit, "The ticket costs less than Jo has")
            labels = ["The ticket price", "The inequality symbol", "The money to spend"]
        blanks = common_response(response, "inline", "Choose the number or symbol for each gap")
        require(sentence_of(response) == f"{{known}} $+ {var}$ {{sym}} {{limit}}", "Sentence")
        labelled(blanks, ["known", "sym", "limit"], labels)
        require({b["label"] for b in blanks[1]["options"]} == set(SYMBOLS), "Symbol options")
        key = {"known": pick(blanks[0], F(known), value_of), "sym": pick(blanks[1], phrase[word], lambda l: SYMBOLS[l]),
               "limit": pick(blanks[2], F(limit), value_of)}
        sym_tex = {">": ">", ">=": "\\ge", "<": "<", "<=": "\\le"}[phrase[word]]
        facts = {"last": f"The inequality is ${known}+{var}{sym_tex}{limit}$."}
    elif t == "unit-fraction-division-slots":
        s = sentence_of(response)
        m = re.fullmatch(r"A baker has \$\\frac\{1\}\{(\d+)\}\$ of an? ([a-z ]+) left and shares it equally among (\d+) people\. "
                         r"Complete the equation that finds each person's share\.", prompt)
        if m:
            n, people = int(m[1]), int(m[3])
            blanks = common_response(response, "inline", "Choose a number for each gap")
            require(s == "{whole} $\\div$ {by} $=$ {each}", "Sentence")
            labelled(blanks, ["whole", "by", "each"], ["The amount shared", "The number of people", "Each person's share"])
            key = {"whole": pick(blanks[0], F(1, n), value_of), "by": pick(blanks[1], F(people), value_of), "each": pick(blanks[2], F(1, n * people), value_of)}
            facts = {"values": [f"\\frac{{1}}{{{n * people}}}"]}
        else:
            m = re.fullmatch(r"A jug holds \$\\frac\{1\}\{(\d+)\}\$ liter of juice\. It is shared equally among (\d+) people\. Complete the sentence\.", prompt)
            if m:
                n, people = int(m[1]), int(m[2])
                blanks = common_response(response, "inline", "Choose a number for each gap")
                require(s == f"Each person gets $\\frac{{1}}{{{n}}}\\div$ {{by}} of a liter, which is the unit fraction with denominator {{den}}.", "Sentence")
                labelled(blanks, ["by", "den"], ["The number of people", "The denominator of each share"])
                key = {"by": pick(blanks[0], F(people), value_of), "den": pick(blanks[1], F(n * people), value_of)}
                facts = {"values": [f"{n}\\times {people}={n * people}", f"\\frac{{1}}{{{n * people}}}"]}
            else:
                m = re.fullmatch(r"A trail is (\d+) miles long, and one lap of a track is \$\\frac\{1\}\{(\d+)\}\$ mile\. "
                                 r"Complete the equation that finds how many laps make \1 miles\.", prompt)
                require(m is not None, f"Prompt {prompt!r}")
                miles, n = int(m[1]), int(m[2])
                blanks = common_response(response, "inline", "Choose a number for each gap")
                require(s == "{whole} $\\div$ {piece} $=$ {count}", "Sentence")
                labelled(blanks, ["whole", "piece", "count"], ["The total distance", "The length of one lap", "The number of laps"])
                key = {"whole": pick(blanks[0], F(miles), value_of), "piece": pick(blanks[1], F(1, n), value_of), "count": pick(blanks[2], F(miles * n), value_of)}
                facts = {"values": [f"{miles}\\times {n}={miles * n}"]}
    elif t == "array-division-slots":
        m = re.fullmatch(r"(?:Counters are arranged in an array of|The array has) (\d+) rows with (\d+) counters in each row\. Complete the division(?: equation)? that uses "
                         r"(the number of rows to find the number in each row|the number in each row to find the number of rows)\.", prompt)
        require(m is not None, f"Prompt {prompt!r}")
        rows, per, by_rows = int(m[1]), int(m[2]), m[3].startswith("the number of rows")
        blanks = common_response(response, "inline", "Choose a number for each gap")
        require(sentence_of(response) == "{total} $\\div$ {by} $=$ {quot}", "Sentence")
        labelled(blanks, ["total", "by", "quot"], ["The number of counters", "The number of rows" if by_rows else "The number in each row",
                                                    "The number in each row" if by_rows else "The number of rows"])
        divisor, quotient = (rows, per) if by_rows else (per, rows)
        key = {"total": pick(blanks[0], F(rows * per), value_of), "by": pick(blanks[1], F(divisor), value_of), "quot": pick(blanks[2], F(quotient), value_of)}
        facts = {"values": [f"{rows}\\times {per}={rows * per}", f"{rows * per}\\div {divisor}={quotient}"]}
    elif t == "story-operations-slots":
        plans = (
            (r"A school has (\d+) boxes of markers with (\d+) markers in each box\. (\d+) markers are given away\. Choose the operations that find how many markers are left\.", ("$\\times$", "$-$")),
            (r"A club has (\d+) courts\. Each court has (\d+) bags, and each bag holds (\d+) balls\. Choose the operations that find the total number of balls\.", ("$\\times$", "$\\times$")),
            (r"A coach buys (\d+) bags of tennis balls with (\d+) balls in each bag, and (\d+) more loose balls\. Choose the operations that find the total number of balls\.", ("$\\times$", "$+$")))
        for pattern, ops in plans:
            m = re.fullmatch(pattern, prompt)
            if m:
                break
        else:
            raise ValueError(f"Prompt {prompt!r}")
        numbers = [int(m[i]) for i in (1, 2, 3)]
        blanks = common_response(response, "inline", "Choose an operation for each gap")
        s = re.fullmatch(r"\$(\d+)\$ \{op1\} \$(\d+)\$ \{op2\} \$(\d+)\$ \$=(\d+)\$", sentence_of(response))
        require(s is not None and [int(s[i]) for i in (1, 2, 3)] == numbers, "Sentence numbers follow the story")
        result = int(s[4])
        solve_ops(numbers, F(result), ops)
        labelled(blanks, ["op1", "op2"], [f"The operation after {numbers[0]}", f"The operation after {numbers[1]}"])
        key = {b["id"]: pick(b, o, lambda l: l) for b, o in zip(blanks, ops)}
        facts = {"last": "The equation is $" + str(numbers[0]) + "".join(o + str(n) for o, n in zip((x.strip("$").replace("\\times", "\\times") for x in ops), numbers[1:])) + f"={result}$."}
    elif t == "delivery-operations-slots":
        plans = (
            (r"A flower shop has (\d+) tulips\. (\d+) wilt and are thrown away, then two deliveries bring (\d+) and (\d+) more\. Choose the operations that find how many tulips the shop has now\.", ("$-$", "$+$", "$+$")),
            (r"A flower shop has (\d+) tulips\. One farm delivers (\d+) more, a second farm delivers (\d+) more, and then (\d+) tulips are sold\. Choose the operations that find how many tulips are left\.", ("$+$", "$+$", "$-$")),
            (r"A flower shop has (\d+) tulips\. A delivery adds (\d+) more, then (\d+) tulips are sold in the morning and (\d+) more in the afternoon\. Choose the operations that find how many tulips are left\.", ("$+$", "$-$", "$-$")))
        for pattern, ops in plans:
            m = re.fullmatch(pattern, prompt)
            if m:
                break
        else:
            raise ValueError(f"Prompt {prompt!r}")
        numbers = [int(m[i]) for i in (1, 2, 3, 4)]
        blanks = common_response(response, "inline", "Choose an operation for each gap")
        s = re.fullmatch(r"\$(\d+)\$ \{op1\} \$(\d+)\$ \{op2\} \$(\d+)\$ \{op3\} \$(\d+)\$ \$=(-?\d+)\$", sentence_of(response))
        require(s is not None and [int(s[i]) for i in (1, 2, 3, 4)] == numbers, "Sentence numbers follow the story")
        result = int(s[5])
        require(result >= 0, "A shop cannot have fewer than none")
        solve_ops(numbers, F(result), ops)
        labelled(blanks, ["op1", "op2", "op3"], [f"The operation after {numbers[i]}" for i in range(3)])
        key = {b["id"]: pick(b, o, lambda l: l) for b, o in zip(blanks, ops)}
        signs = {"$+$": "+", "$-$": "-"}
        facts = {"last": f"The equation is ${numbers[0]}" + "".join(signs[o] + str(n) for o, n in zip(ops, numbers[1:])) + f"={result}$."}
    elif t == "table-equation-slots":
        require(prompt == "The table shows pairs of $x$ and $y$ values that follow one equation. Complete the equation.", f"Prompt {prompt!r}")
        elements = public["figure"]["scene"]["elements"]
        require(len(elements) == 1 and elements[0]["type"] == "lineTable", "A table")
        rows = elements[0]["rows"]
        require(rows[0][0] == "x" and rows[1][0] == "y", "x then y")
        xs, ys = [F(v) for v in rows[0][1:]], [F(v) for v in rows[1][1:]]
        require(len(xs) == len(ys) >= 4 and len(set(xs)) == len(xs), "Distinct x values")
        slope = (ys[1] - ys[0]) / (xs[1] - xs[0])
        constant = ys[0] - slope * xs[0]
        require(slope.denominator == 1 and slope > 1 and constant.denominator == 1 and constant != 0, "Integer rule with a constant")
        require(all(slope * x + constant == y for x, y in zip(xs, ys)), "The table follows no linear rule")
        blanks = common_response(response, "inline", "Choose a number or symbol for each gap")
        require(sentence_of(response) == "$y=$ {mult} $x$ {op} {const}", "Sentence")
        labelled(blanks, ["mult", "op", "const"], ["The number multiplied by $x$", "The operation", "The constant"])
        key = {"mult": pick(blanks[0], slope, value_of), "op": pick(blanks[1], "$+$" if constant > 0 else "$-$", lambda l: l),
               "const": pick(blanks[2], abs(constant), value_of)}
        facts = {"last": f"The equation is $y={int(slope)}x{'+' if constant > 0 else '-'}{int(abs(constant))}$, which fits every pair."}
    elif t == "rule-table-fill-slots":
        m = re.fullmatch(r"Use the rule \$y=([^$]+)\$ to complete the table\. Choose each missing value\.", prompt)
        require(m is not None, f"Prompt {prompt!r}")
        from multi_part_choice_math_oracle import evaluate, tex_tree
        tree = tex_tree(m[1])
        f = lambda x: evaluate(tree, {"x": x})
        slope, intercept = f(F(1)) - f(F(0)), f(F(0))
        require(slope != 0 and all(f(F(x)) == slope * x + intercept for x in range(-3, 4)), "Linear rule")
        blanks = common_response(response, "slots", "Choose each missing value")
        elements = public["figure"]["scene"]["elements"]
        rows = elements[0]["rows"]
        xr, yr = rows[0], rows[1]
        require(xr[0] == "x" and yr[0] == "y" and len(xr) == 5, "Table shape")
        require(xr[3] == "?" and xr[4] == "?" and yr[1] == "?" and yr[2] == "?", "Missing cells")
        x1, x2, y3, y4 = F(xr[1]), F(xr[2]), F(yr[3]), F(yr[4])
        invert = lambda y: (y - intercept) / slope
        expected = [f(x1), f(x2), invert(y3), invert(y4)]
        require(all(v.denominator == 1 for v in expected), "Whole-number table")
        labels = [f"$y$ when $x={xr[1]}$", f"$y$ when $x={xr[2]}$", f"$x$ when $y={yr[3]}$", f"$x$ when $y={yr[4]}$"]
        labelled(blanks, ["y1", "y2", "x1", "x2"], labels)
        key = {b["id"]: pick(b, e, value_of) for b, e in zip(blanks, expected)}
        facts = {"expected": expected}
    elif t == "unit-price-sentence-slots":
        m = re.fullmatch(r"(\d+) pairs of (\w+) cost (\d+(?:\.\d{2})?) dollars in all, and every pair costs the same\. Complete the sentence that finds the price of one pair\.", prompt)
        require(m is not None, f"Prompt {prompt!r}")
        count, total = int(m[1]), F(m[3])
        unit = total / count
        require((unit * 100).denominator == 1, "The unit price must be exact to the cent")
        blanks = common_response(response, "inline", "Choose a number for each gap")
        require(sentence_of(response) == "{total} dollars $\\div$ {count} pairs $=$ {unit} dollars per pair", "Sentence")
        labelled(blanks, ["total", "count", "unit"], ["The total cost in dollars", "The number of pairs", "The price of one pair in dollars"])
        key = {"total": pick(blanks[0], total, value_of), "count": pick(blanks[1], F(count), value_of), "unit": pick(blanks[2], unit, value_of)}
        facts = {"unit": unit, "total": m[3], "count": count}
    elif t == "cylinder-volume-slots":
        m = re.fullmatch(r"A round pool is (\d+) feet across and (\d+) feet deep\. Complete the equation for the volume \$V\$ of the pool in cubic feet\.", prompt)
        if m:
            require(int(m[1]) % 2 == 0, "Even diameter")
            radius, height = F(int(m[1]), 2), int(m[2])
        else:
            m = re.fullmatch(r"A round pool is (\d+) feet from its center to its edge and (\d+) feet deep\. Complete the equation for the volume \$V\$ of the pool in cubic feet\.", prompt)
            require(m is not None, f"Prompt {prompt!r}")
            radius, height = F(int(m[1])), int(m[2])
        blanks = common_response(response, "inline", "Choose a number for each gap")
        require(sentence_of(response) == "$V=\\pi\\times$ {r1} $\\times$ {r2} $\\times$ {h}", "Sentence")
        labelled(blanks, ["r1", "r2", "h"], ["The first radius", "The second radius", "The height"])
        key = {"r1": pick(blanks[0], radius, value_of), "r2": pick(blanks[1], radius, value_of), "h": pick(blanks[2], F(height), value_of)}
        facts = {"radius": radius, "height": height}
    elif t == "dilation-rule-slots":
        m = re.fullmatch(r"A dilation centered at the origin takes the vertex \$A\((-?\d+), (-?\d+)\)\$ to its image \$A'\((-?\d+), (-?\d+)\)\$\. Complete the rule of the dilation\.", prompt)
        require(m is not None, f"Prompt {prompt!r}")
        x, y, xi, yi = (int(v) for v in m.groups())
        require(x != 0 and y != 0 and F(xi, x) == F(yi, y) and xi != 0, "A dilation scales both coordinates by one factor")
        k = F(xi, x)
        blanks = common_response(response, "inline", "Choose the multiplier for each coordinate")
        require(sentence_of(response) == "$(x, y)\\to (${kx} $x,$ {ky} $y)$", "Sentence")
        labelled(blanks, ["kx", "ky"], ["The multiplier of $x$", "The multiplier of $y$"])
        key = {"kx": pick(blanks[0], k, value_of), "ky": pick(blanks[1], k, value_of)}
        facts = {"k": k}
    elif t == "transformation-rule-slots":
        require(prompt == "Each rule below turns a point $(x, y)$ into its image. Match each transformation to its rule.", f"Prompt {prompt!r}")
        blanks = common_response(response, "slots", "Choose the rule for each transformation")
        require(2 <= len(blanks) <= 3, "Two or three transformations")
        turns = {"90° clockwise": lambda p: (p[1], -p[0]), "90° counterclockwise": lambda p: (-p[1], p[0]),
                 "180°": lambda p: (-p[0], -p[1])}
        reflect = {"$x$-axis": lambda p: (p[0], -p[1]), "$y$-axis": lambda p: (-p[0], p[1]),
                   "line $y = x$": lambda p: (p[1], p[0]), "line $y = -x$": lambda p: (-p[1], -p[0])}

        def transform_of(label):
            m = re.fullmatch(r"The rule for a reflection across the (.+)", label)
            if m:
                return reflect[m[1]]
            m = re.fullmatch(r"The rule for a rotation of (.+) about the origin", label)
            return turns[m[1]]

        def rule_image(label):
            m = re.fullmatch(r"\$\((-?)([xy]), (-?)([xy])\)\$", label)
            require(m is not None, f"Rule option {label!r}")
            point = {"x": 2, "y": 5}
            return ((-1 if m[1] else 1) * point[m[2]], (-1 if m[3] else 1) * point[m[4]])

        require(all(b["options"] == blanks[0]["options"] for b in blanks), "Blanks share one rule bank")
        require(len({b["label"] for b in blanks}) == len(blanks), "Repeated transformation")
        key, chosen = {}, []
        for b in blanks:
            f = transform_of(b["label"])
            key[b["id"]] = pick(b, f((2, 5)), rule_image)
            chosen.append(key[b["id"]])
        require(len(set(chosen)) == len(chosen), "Two transformations share one rule")
        require([b["id"] for b in blanks] == [f"m{i + 1}" for i in range(len(blanks))], "Blank ids")
        facts = {}
    elif t == "exponent-quotient-slots":
        m = re.fullmatch(r"Write \$\\dfrac\{(\d+)([a-z])\^\{(\d+)\}\}\{(\d+)\2\^\{(\d+)\}\}\$ in the form \$c\\,\2\^\{p\}\$ with a coefficient \$c\$ and an exponent \$p\$\. Complete the sentence\.", prompt)
        require(m is not None, f"Prompt {prompt!r}")
        a, v, p, b, q = int(m[1]), m[2], int(m[3]), int(m[4]), int(m[5])
        require(a % b == 0, "Whole-number coefficient")
        coefficient, exponent = a // b, p - q
        blanks = common_response(response, "inline", "Choose the coefficient and the exponent")
        require(sentence_of(response) == f"The quotient equals a coefficient of {{coef}} times ${v}$ raised to the exponent {{exp}}.", "Sentence")
        labelled(blanks, ["coef", "exp"], ["The coefficient", f"The exponent of ${v}$"])
        key = {"coef": pick(blanks[0], F(coefficient), value_of), "exp": pick(blanks[1], F(exponent), value_of)}
        facts = {"last": f"So the quotient is ${coefficient}{v}^{{{exponent}}}$."}
    elif t == "square-root-solutions-slots":
        m = re.fullmatch(r"Solve \$\(x ([+-]) (\d+)\)\^2 = (\d+)\$\. (?:Choose the lesser and the greater solution|Put the lesser solution first)\.", prompt)
        require(m is not None, f"Prompt {prompt!r}")
        shift, rhs = int(m[2]) * (1 if m[1] == "+" else -1), int(m[3])
        root = next((r for r in range(1, 40) if r * r == rhs), None)
        require(root is not None, "A perfect square")
        low, high = -root - shift, root - shift
        for x in (low, high):
            require((x + shift) ** 2 == rhs, "Solution check")
        blanks = common_response(response, "inline", "Choose the two solutions")
        require(sentence_of(response) == "$x=$ {low} or $x=$ {high}", "Sentence")
        labelled(blanks, ["low", "high"], ["The lesser solution", "The greater solution"])
        key = {"low": pick(blanks[0], F(low), value_of), "high": pick(blanks[1], F(high), value_of)}
        facts = {"low": low, "high": high, "root": root}
    else:
        m = re.fullmatch(r"The function \$g\$ is defined by \$g\(x\)=f\(x([+-])(\d+)\)([+-])(\d+)\$\. Describe how its graph is related to the graph of \$f\$\.", prompt)
        require(m is not None, f"Prompt {prompt!r}")
        h, k = int(m[2]), int(m[4])
        horizontal = "left" if m[1] == "+" else "right"
        vertical = "up" if m[3] == "+" else "down"
        blanks = common_response(response, "inline", "Choose a direction or a distance for each gap")
        require(sentence_of(response) == "The graph of $g$ is the graph of $f$ shifted {hdir} by {hamt} units and {vdir} by {vamt} units.", "Sentence")
        labelled(blanks, ["hdir", "hamt", "vdir", "vamt"], ["The horizontal direction", "The horizontal distance", "The vertical direction", "The vertical distance"])
        key = {"hdir": pick(blanks[0], horizontal, lambda l: l), "hamt": pick(blanks[1], F(h), value_of),
               "vdir": pick(blanks[2], vertical, lambda l: l), "vamt": pick(blanks[3], F(k), value_of)}
        facts = {"h": h, "k": k, "horizontal": horizontal, "vertical": vertical}
    return compact(key), facts


def solve(public):
    return solve_detail(public)[0]


def review_explanation(public, problem, facts):
    t, lines = public["templateId"], problem["explanation"]
    text = " ".join(lines)
    if "last" in facts:
        require(lines[-1] == facts["last"], f"Final explanation line {lines[-1]!r} should be {facts['last']!r}")
    for fragment in facts.get("values", []):
        require(fragment in text, f"Explanation lacks {fragment!r}")
    if t == "rule-table-fill-slots":
        for label_value in facts["expected"]:
            require(re.search(rf"(?:y|x)={label_value}\b", text) is not None, f"Explanation lacks the value {label_value}")
    elif t == "unit-price-sentence-slots":
        require(f"{facts['total']}\\div {facts['count']}=" in lines[1].replace(" ", "") or f"{facts['total']}\\div {facts['count']}=" in lines[1], "Division line")
        require(f"{decimal_text(facts['unit']) if '.' in facts['total'] else int(facts['unit'])}" in lines[1], "Quotient in the division line")
    elif t == "cylinder-volume-slots":
        r, h = facts["radius"], facts["height"]
        require(f"V=\\pi\\times {r}\\times {r}\\times {h}" in text, "Volume expression in the explanation")
    elif t == "dilation-rule-slots":
        k = facts["k"]
        require(f"$k={tex_frac(k)}$" in text, "Scale factor in the explanation")
    elif t == "transformation-rule-slots":
        require(len(lines) == len(public["response"]["blanks"]), "One line per transformation")
    elif t == "square-root-solutions-slots":
        require(f"x={facts['high']}" in text and f"x={facts['low']}" in text, "Both solutions in the explanation")
        require(f"\\pm {facts['root']}" in text, "Square root step")
    elif t == "function-shift-sentence":
        require(f"shifts the graph {facts['horizontal']} by {facts['h']}" in lines[0], "Horizontal line")
        require(f"shifts the graph {facts['vertical']} by {facts['k']}" in lines[1], "Vertical line")
    require(not PLACEHOLDER.search(text + problem["hint"]), "Unrendered placeholder")


def check_leak(public, problem, key):
    """The hint never states the correct option of a blank that the prompt had not already given."""
    # the steps in x and y ("When $x$ goes up by 2, $y$ goes up by 6.") are read off the table; with an x step of 1 the y change IS the multiplier and stays visible to the check
    hint = re.sub(r"When \$x\$ goes up by (?:[02-9]|\d\d+), \$y\$ goes up by \d+\.", "When $x$ steps, $y$ steps.", problem["hint"])
    given = public["prompt"] + " " + json.dumps(public["response"].get("sentence", [])) + json.dumps(public.get("figure"))
    for blank in public["response"]["blanks"]:
        label = blank["options"][ord(key[blank["id"]]) - 97]["label"]
        bare = label.strip("$")
        if len(bare) < 2 and not bare.isdigit() or bare in given:
            continue
        require(re.search(r"(?<![\w\\.])" + re.escape(bare) + r"(?![\w.]*\d)", hint) is None, f"Hint gives away {label!r}")


def review_problem(problem):
    public = problem["public"]
    expected, facts = solve_detail(public)
    require(problem["answer"] == expected, f"Answer {problem['answer']} disagrees with the wording; expected {expected}")
    key = json.loads(expected)
    check_card_use(public["response"], key)
    require(list(key) == [b["id"] for b in public["response"]["blanks"]], "Answer keys follow blank order")
    require(grade(public, expected, expected), "The key must grade correct")
    for blank in public["response"]["blanks"]:
        for option in blank["options"]:
            if option["id"] != key[blank["id"]]:
                wrong = dict(key)
                wrong[blank["id"]] = option["id"]
                require(not grade(public, expected, compact(wrong)), "One wrong blank must fail")
        require(not grade(public, expected, compact({k: v for k, v in key.items() if k != blank["id"]})), "A missing blank must fail")
    review_explanation(public, problem, facts)
    check_leak(public, problem, key)
    return expected


# ---------------------------------------------------------------- self test

def opts(*labels):
    return [{"id": "abcdef"[i], "label": label} for i, label in enumerate(labels)]


def make(template, prompt, label, layout, blanks, answer, explanation, hint, sentence=None, figure=None):
    response = {"kind": "multi-part-choice", "label": label, "layout": layout,
                "blanks": [{"id": i, "label": lab, "options": opts(*o)} for i, lab, o in blanks]}
    if sentence is not None:
        response["sentence"] = sentence
    public = {"templateId": template, "seed": "f", "prompt": prompt, "response": response}
    if figure is not None:
        public["figure"] = figure
    return {"public": public, "answer": answer, "hint": hint, "explanation": explanation}


def self_test():
    table = {"kind": "scene", "scene": {"v": 1, "title": "t", "elements": [{"type": "lineTable", "rows": [["x", "3", "5", "7", "9", "11"], ["y", "22", "40", "58", "76", "94"]], "header": "column"}]}}
    fill = {"kind": "scene", "scene": {"v": 1, "title": "t", "elements": [{"type": "lineTable", "rows": [["x", "3", "1", "?", "?"], ["y", "?", "?", "18", "6"]], "header": "column"}]}}
    S = lambda *parts: [({"blank": p[1:]} if p.startswith("@") else {"text": p}) for p in parts]
    fixtures = [
        make("booth-equation-slots", "A fair charges 13 dollars for each kiosk and a fixed fee of 6 dollars. A group pays 110 dollars in all for $k$ kiosks. Complete the equation.",
             "Choose the number or symbol for each gap",
             "inline", [("total", "The total", ["6", "110", "116", "104"]), ("rate", "The amount for each kiosk", ["110", "6", "8", "13"]),
                        ("op", "The operation", ["$+$", "$-$"]), ("once", "The fixed fee", ["8", "13", "110", "6"])],
             '{"total":"b","rate":"d","op":"a","once":"d"}',
             ["The charge for $k$ kiosks is $13k$, because each kiosk costs 13 dollars.", "The fixed fee of 6 dollars happens once, so it is added to $13k$.",
              "The total is 110 dollars, so the equation is $110=13k+6$."], "Ask whether the fee changes with $k$.",
             S("@total", " $=$ ", "@rate", " $k$ ", "@op", " ", "@once")),
        make("budget-inequality-slots", "Jo has 39 dollars. A ticket costs 19 dollars. Jo will spend $s$ dollars on snacks, and the ticket and the snacks together must cost at most the 39 dollars Jo has. Complete the inequality.",
             "Choose the number or symbol for each gap", "inline",
             [("known", "The ticket price", ["20", "39", "58", "19"]), ("sym", "The inequality symbol", ["$<$", "$\\le$", "$>$", "$\\ge$"]), ("limit", "The money to spend", ["58", "39", "20", "19"])],
             '{"known":"d","sym":"b","limit":"b"}',
             ["The ticket and the snacks cost $19+s$ dollars together.", "\"at most\" means less than or equal to 39, so the symbol is $\\le$.", "The inequality is $19+s\\le39$."],
             "Which words name the symbol?", S("@known", " $+ s$ ", "@sym", " ", "@limit")),
        make("unit-fraction-division-slots", "A baker has $\\frac{1}{3}$ of a pan of cornbread left and shares it equally among 4 people. Complete the equation that finds each person's share.",
             "Choose a number for each gap", "inline",
             [("whole", "The amount shared", ["$\\frac{1}{12}$", "$\\frac{4}{3}$", "3", "$\\frac{1}{3}$"]), ("by", "The number of people", ["4", "3", "$\\frac{1}{7}$", "$\\frac{1}{12}$"]),
              ("each", "Each person's share", ["3", "$\\frac{1}{12}$", "4", "12"])], '{"whole":"d","by":"a","each":"b"}',
             ["Sharing equally is division.", "Cutting each part into 4 smaller parts makes parts of size $\\frac{1}{12}$, so $\\frac{1}{3}\\div 4=\\frac{1}{12}$."],
             "Decide which operation cuts each part.", S("@whole", " $\\div$ ", "@by", " $=$ ", "@each")),
        make("array-division-slots", "Counters are arranged in an array of 10 rows with 9 counters in each row. Complete the division equation that uses the number of rows to find the number in each row.",
             "Choose a number for each gap", "inline",
             [("total", "The number of counters", ["99", "10", "19", "90"]), ("by", "The number of rows", ["90", "10", "19", "9"]), ("quot", "The number in each row", ["99", "19", "10", "9"])],
             '{"total":"d","by":"b","quot":"d"}', ["The array holds $10\\times 9=90$ counters.", "Dividing the total by 10 rows gives 9, so $90\\div 10=9$."],
             "Find the total first.", S("@total", " $\\div$ ", "@by", " $=$ ", "@quot")),
        make("story-operations-slots", "A coach buys 5 bags of tennis balls with 4 balls in each bag, and 6 more loose balls. Choose the operations that find the total number of balls.",
             "Choose an operation for each gap", "inline",
             [("op1", "The operation after 5", ["$+$", "$-$", "$\\times$", "$\\div$"]), ("op2", "The operation after 4", ["$+$", "$-$", "$\\times$", "$\\div$"])],
             '{"op1":"c","op2":"a"}', ["Bags of equal size are multiplied.", "The equation is $5\\times4+6=26$."], "Think about what 5 and 4 stand for.",
             S("$5$ ", "@op1", " $4$ ", "@op2", " $6$ $=26$")),
        make("delivery-operations-slots", "A flower shop has 97 tulips. 28 wilt and are thrown away, then two deliveries bring 27 and 10 more. Choose the operations that find how many tulips the shop has now.",
             "Choose an operation for each gap", "inline",
             [(f"op{i + 1}", f"The operation after {n}", ["$+$", "$-$", "$\\times$", "$\\div$"]) for i, n in enumerate((97, 28, 27))],
             '{"op1":"b","op2":"a","op3":"a"}', ["Read the story in order.", "The equation is $97-28+27+10=106$."], "Start from 97 tulips.",
             S("$97$ ", "@op1", " $28$ ", "@op2", " $27$ ", "@op3", " $10$ $=106$")),
        make("table-equation-slots", "The table shows pairs of $x$ and $y$ values that follow one equation. Complete the equation.", "Choose a number or symbol for each gap", "inline",
             [("mult", "The number multiplied by $x$", ["9", "4", "18", "22"]), ("op", "The operation", ["$+$", "$-$"]), ("const", "The constant", ["5", "9", "13", "22"])],
             '{"mult":"a","op":"b","const":"a"}', ["Each time $x$ increases by 2.", "The equation is $y=9x-5$, which fits every pair."], "Use the first pair.",
             S("$y=$ ", "@mult", " $x$ ", "@op", " ", "@const"), table),
        make("rule-table-fill-slots", "Use the rule $y=3x$ to complete the table. Choose each missing value.", "Choose each missing value", "slots",
             [("y1", "$y$ when $x=3$", ["10", "9", "12", "3"]), ("y2", "$y$ when $x=1$", ["1", "3", "4"]), ("x1", "$x$ when $y=18$", ["6", "15", "7", "54"]), ("x2", "$x$ when $y=6$", ["2", "9", "1", "6"])],
             '{"y1":"b","y2":"b","x1":"a","x2":"a"}', ["For each missing $y$: $x=3$ gives $y=9$, $x=1$ gives $y=3$.", "For each missing $x$: $y=18$ gives $x=6$, $y=6$ gives $x=2$."], "Undo the rule.", None, fill),
        make("unit-price-sentence-slots", "5 pairs of socks cost 35 dollars in all, and every pair costs the same. Complete the sentence that finds the price of one pair.",
             "Choose a number for each gap", "inline",
             [("total", "The total cost in dollars", ["36", "35", "7", "40"]), ("count", "The number of pairs", ["4", "7", "5", "6"]), ("unit", "The price of one pair in dollars", ["18", "8", "7", "6"])],
             '{"total":"b","count":"c","unit":"c"}', ["A unit price is the total cost divided by the number of items: 35 dollars $\\div$ 5 pairs.", "$35\\div 5=7$, so one pair costs 7 dollars."], "Share the total.",
             S("@total", " dollars $\\div$ ", "@count", " pairs $=$ ", "@unit", " dollars per pair")),
        make("cylinder-volume-slots", "A round pool is 16 feet across and 5 feet deep. Complete the equation for the volume $V$ of the pool in cubic feet.", "Choose a number for each gap", "inline",
             [("r1", "The first radius", ["8", "21", "13", "5"]), ("r2", "The second radius", ["13", "8", "16", "10"]), ("h", "The height", ["16", "8", "13", "5"])],
             '{"r1":"a","r2":"b","h":"d"}', ["16 feet is the diameter, so the radius is $16\\div 2=8$ feet.", "The volume is $V=\\pi\\times 8\\times 8\\times 5$."], "Check whether 16 is the radius.",
             S("$V=\\pi\\times$ ", "@r1", " $\\times$ ", "@r2", " $\\times$ ", "@h")),
        make("dilation-rule-slots", "A dilation centered at the origin takes the vertex $A(3, 12)$ to its image $A'(1, 4)$. Complete the rule of the dilation.", "Choose the multiplier for each coordinate", "inline",
             [("kx", "The multiplier of $x$", ["3", "$-\\frac{1}{3}$", "2", "$\\frac{1}{3}$"]), ("ky", "The multiplier of $y$", ["$-\\frac{1}{3}$", "3", "$\\frac{1}{3}$", "1"])],
             '{"kx":"d","ky":"c"}', ["Both coordinates are multiplied by $k$.", "$1\\div 3$ and $4\\div 12$ both equal $\\frac{1}{3}$, so $k=\\frac{1}{3}$."], "Compare the $x$-coordinates.",
             S("$(x, y)\\to ($", "@kx", " $x,$ ", "@ky", " $y)$")),
        make("transformation-rule-slots", "Each rule below turns a point $(x, y)$ into its image. Match each transformation to its rule.", "Choose the rule for each transformation", "slots",
             [("m1", "The rule for a reflection across the $x$-axis", ["$(-y, x)$", "$(x, -y)$", "$(-x, y)$", "$(y, x)$", "$(-x, -y)$"]),
              ("m2", "The rule for a rotation of 180° about the origin", ["$(-y, x)$", "$(x, -y)$", "$(-x, y)$", "$(y, x)$", "$(-x, -y)$"])],
             '{"m1":"b","m2":"e"}', ["A reflection across the $x$-axis gives $(x, y)\\to (x, -y)$.", "A rotation of 180° gives $(x, y)\\to (-x, -y)$."], "Test a point such as $(2, 1)$."),
        make("exponent-quotient-slots", "Write $\\dfrac{16y^{2}}{4y^{1}}$ in the form $c\\,y^{p}$ with a coefficient $c$ and an exponent $p$. Complete the sentence.",
             "Choose the coefficient and the exponent", "inline",
             [("coef", "The coefficient", ["64", "5", "4", "16"]), ("exp", "The exponent of $y$", ["3", "−1", "2", "1"])], '{"coef":"c","exp":"d"}',
             ["Divide the coefficients.", "So the quotient is $4y^{1}$."], "Treat the coefficients and the powers separately.",
             S("The quotient equals a coefficient of ", "@coef", " times $y$ raised to the exponent ", "@exp", ".")),
        make("square-root-solutions-slots", "Solve $(x + 1)^2 = 81$. Choose the lesser and the greater solution.", "Choose the two solutions", "inline",
             [("low", "The lesser solution", ["−8", "−10", "10", "9"]), ("high", "The greater solution", ["−8", "−9", "9", "8"])], '{"low":"b","high":"d"}',
             ["Take the square root of both sides: $x + 1 = \\pm 9$.", "Solve: $x=8$ and $x=-10$."], "Take the square root of both sides.",
             S("$x=$ ", "@low", " or $x=$ ", "@high")),
        make("function-shift-sentence", "The function $g$ is defined by $g(x)=f(x+6)-3$. Describe how its graph is related to the graph of $f$.", "Choose a direction or a distance for each gap", "inline",
             [("hdir", "The horizontal direction", ["left", "right"]), ("hamt", "The horizontal distance", ["3", "9", "6", "7"]), ("vdir", "The vertical direction", ["up", "down"]), ("vamt", "The vertical distance", ["3", "6", "9", "4"])],
             '{"hdir":"a","hamt":"c","vdir":"b","vamt":"a"}',
             ["A change inside the parentheses, $f(x + 6)$, shifts the graph left by 6, opposite to the sign.", "A change outside, $-3$, shifts the graph down by 3."], "Look at the sign of 6.",
             S("The graph of $g$ is the graph of $f$ shifted ", "@hdir", " by ", "@hamt", " units and ", "@vdir", " by ", "@vamt", " units.")),
    ]
    for f in fixtures:
        require(review_problem(f) == f["answer"], f"Fixture {f['public']['templateId']} must pass")
    by = {f["public"]["templateId"]: f for f in fixtures}

    def set_answer(p, **changes):
        p["answer"] = compact({**json.loads(p["answer"]), **changes})

    def set_option(p, blank, index, label):
        p["public"]["response"]["blanks"][blank]["options"][index]["label"] = label

    def set_line(p, index, old, new):
        p["explanation"][index] = p["explanation"][index].replace(old, new)

    mutations = 0
    for template, change, what in (
            ("booth-equation-slots", lambda p: set_answer(p, op="b"), "discount for a fee"),
            ("booth-equation-slots", lambda p: p["public"].update(prompt=p["public"]["prompt"].replace("110 dollars", "111 dollars")), "group size not whole"),
            ("booth-equation-slots", lambda p: set_option(p, 0, 0, "110"), "repeated option"),
            ("booth-equation-slots", lambda p: set_line(p, 2, "110=13k+6", "110=13k-6"), "false equation line"),
            ("budget-inequality-slots", lambda p: set_answer(p, sym="a"), "strict for at most"),
            ("budget-inequality-slots", lambda p: set_answer(p, limit="d"), "ticket price as limit"),
            ("unit-fraction-division-slots", lambda p: set_answer(p, each="a"), "wrong share"),
            ("unit-fraction-division-slots", lambda p: set_option(p, 2, 2, "$\\frac{2}{24}$"), "equal-valued option"),
            ("array-division-slots", lambda p: set_answer(p, total="a"), "rows plus columns"),
            ("story-operations-slots", lambda p: set_answer(p, op2="b"), "wrong operation"),
            ("story-operations-slots", lambda p: p["public"]["response"]["sentence"].__setitem__(4, {"text": " $4$ $=27$"}), "result disagrees"),
            ("delivery-operations-slots", lambda p: set_answer(p, op1="a", op2="b"), "swapped signs"),
            ("table-equation-slots", lambda p: set_answer(p, op="a"), "sign of the constant"),
            ("table-equation-slots", lambda p: p["public"]["figure"]["scene"]["elements"][0]["rows"][1].__setitem__(3, "59"), "table off the line"),
            ("rule-table-fill-slots", lambda p: set_answer(p, x1="b"), "x for y"),
            ("rule-table-fill-slots", lambda p: p["public"]["figure"]["scene"]["elements"][0]["rows"][0].__setitem__(1, "4"), "figure disagrees with the labels"),
            ("unit-price-sentence-slots", lambda p: set_answer(p, unit="d"), "wrong unit price"),
            ("cylinder-volume-slots", lambda p: set_answer(p, r1="c"), "diameter used as radius"),
            ("cylinder-volume-slots", lambda p: p.update(hint="The radius is 8, half of 16."), "hint leak"),
            ("dilation-rule-slots", lambda p: set_answer(p, kx="a"), "inverse factor"),
            ("transformation-rule-slots", lambda p: set_answer(p, m1="d"), "swapped coordinates"),
            ("exponent-quotient-slots", lambda p: set_answer(p, exp="c"), "wrong exponent"),
            ("square-root-solutions-slots", lambda p: set_answer(p, low="c"), "positive root only"),
            ("square-root-solutions-slots", lambda p: set_line(p, 1, "x=-10", "x=-9"), "false explanation"),
            ("function-shift-sentence", lambda p: set_answer(p, hdir="b"), "shift with the sign"),
            ("function-shift-sentence", lambda p: set_answer(p, vamt="b"), "wrong distance")):
        bad = copy.deepcopy(by[template])
        change(bad)
        try:
            review_problem(bad)
        except (ValueError, KeyError, TypeError, IndexError, ZeroDivisionError, AttributeError):
            mutations += 1
        else:
            raise AssertionError(f"Accepted corrupt equation-slot case: {template}: {what}")
    return {"fixtures": len(fixtures), "mutations": mutations}


REVIEW_RETURNS_ANSWER = True

if __name__ == "__main__":
    print(self_test())
