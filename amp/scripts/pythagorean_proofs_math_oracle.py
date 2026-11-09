"""Independent review of the Pythagorean proof family (8.G.B.6) from public
payloads only.

Areas are recomputed from the drawn polygons with the shoelace formula; an
equation option is judged true only if it holds at several Pythagorean
triples; a hinge angle is read from the sign of d^2 - (a^2 + b^2) (the law of
cosines); orders and blanks are decided from this module's own statement of
the proofs. The private answer, hint and explanation are values under test.
"""

import copy
import json
import re
import sys
from fractions import Fraction as F

SUPPORTED = frozenset({
    "pythagorean-proof-area",
    "pythagorean-proof-figure",
    "pythagorean-proof-steps",
    "pythagorean-proof-flaw",
    "pythagorean-converse-proof",
    "pythagorean-converse-blanks",
})
REVIEW_RETURNS_ANSWER = True
TRIPLES = ((3, 4, 5), (5, 12, 13), (8, 15, 17), (20, 21, 29))
NON_TRIPLE = (2, 3, 4)
PLACEHOLDER = re.compile(r"\$\{|\bundefined\b|\bNaN\b|\bnull\b|\[object")


def require(condition, message):
    if not condition:
        raise ValueError(message)


def compact(key):
    return json.dumps(key, separators=(",", ":"))


# ---------------------------------------------------------------- exact TeX arithmetic

TOKEN = re.compile(r"\s*(\\[dt]?frac|\\sqrt|\\cdot|\\times|\d+|[a-zA-Z]|[-+()^{}])")


def tokens(text):
    text = text.replace("−", "-").strip()
    out, i = [], 0
    while i < len(text):
        m = TOKEN.match(text, i)
        require(m is not None, f"Cannot read {text!r} at {i}")
        out.append(m.group(1))
        i = m.end()
        while i < len(text) and text[i].isspace():
            i += 1
    return out


def isqrt_exact(v):
    require(v >= 0, "Square root of a negative")
    n, d = v.numerator, v.denominator
    rn, rd = int(n ** 0.5 + 0.5), int(d ** 0.5 + 0.5)
    for x in (rn - 1, rn, rn + 1):
        for y in (rd - 1, rd, rd + 1):
            if x >= 0 and y > 0 and x * x == n and y * y == d:
                return F(x, y)
    raise ValueError(f"Square root of {v} is not rational")


def evaluate(text, env):
    toks = tokens(text)
    pos = [0]

    def peek():
        return toks[pos[0]] if pos[0] < len(toks) else None

    def take(expected=None):
        t = peek()
        require(t is not None, f"Unexpected end of {text!r}")
        require(expected is None or t == expected, f"Expected {expected} in {text!r}")
        pos[0] += 1
        return t

    def group():
        take("{")
        v = expr()
        take("}")
        return v

    def atom():
        t = peek()
        if t == "(":
            take()
            v = expr()
            take(")")
            return v
        if t in ("\\frac", "\\tfrac", "\\dfrac"):
            take()
            num = group()
            den = group()
            return num / den
        if t == "\\sqrt":
            take()
            return isqrt_exact(group())
        if t is not None and t.isdigit():
            take()
            return F(int(t))
        if t is not None and t.isalpha() and len(t) == 1:
            take()
            require(t in env, f"Unknown letter {t} in {text!r}")
            return F(env[t])
        raise ValueError(f"Unexpected {t!r} in {text!r}")

    def power():
        v = atom()
        while peek() == "^":
            take()
            e = group() if peek() == "{" else F(int(take()))
            require(e.denominator == 1 and e >= 0, "Whole exponents only")
            v = v ** int(e)
        return v

    def term():
        v = power()
        while True:
            t = peek()
            if t in ("\\cdot", "\\times"):
                take()
                v *= power()
            elif t is not None and (t == "(" or t.isdigit() or t.isalpha() or t in ("\\frac", "\\tfrac", "\\sqrt")):
                v *= power()
            else:
                return v

    def expr():
        sign = 1
        if peek() == "-":
            take()
            sign = -1
        v = sign * term()
        while peek() in ("+", "-"):
            op = take()
            v = v + term() if op == "+" else v - term()
        return v

    value = expr()
    require(pos[0] == len(toks), f"Trailing tokens in {text!r}")
    return value


def math_spans(text):
    return re.findall(r"\$([^$]+)\$", text)


def equation_holds(tex, env):
    if "\\ne" in tex:
        left, right = tex.split("\\ne")
        return evaluate(left, env) != evaluate(right, env)
    sides = tex.split("=")
    values = [evaluate(side, env) for side in sides]
    return all(v == values[0] for v in values)


def true_at_triples(tex):
    return all(equation_holds(tex, {"a": a, "b": b, "c": c}) for a, b, c in TRIPLES)


def env_of(a, b, c):
    return {"a": a, "b": b, "c": c}


# ---------------------------------------------------------------- figure reading

def elements(public):
    figure = public.get("figure")
    require(figure and figure.get("kind") == "scene", "A scene figure")
    return {e.get("id"): e for e in figure["scene"]["elements"]}


def shoelace(points):
    total = F(0)
    for i, p in enumerate(points):
        q = points[(i + 1) % len(points)]
        total += F(p[0]).limit_denominator(10 ** 6) * F(q[1]).limit_denominator(10 ** 6)
        total -= F(q[0]).limit_denominator(10 ** 6) * F(p[1]).limit_denominator(10 ** 6)
    return abs(total) / 2


def area_of(elems, ident):
    require(ident in elems and elems[ident]["type"] == "polygon", f"Polygon {ident}")
    return shoelace(elems[ident]["points"])


def choice_options(public):
    response = public["response"]
    require(response.get("kind") == "choice", "Single choice")
    options = response["options"]
    require(2 <= len(options) <= 4, "Two to four options")
    require(len({o["label"] for o in options}) == len(options), "Distinct option labels")
    return options


def one_option(options, predicate, what):
    hits = [o["id"] for o in options if predicate(o["label"])]
    require(len(hits) == 1, f"{what}: expected exactly one correct option, found {len(hits)}")
    return hits[0]


# ---------------------------------------------------------------- pythagorean-proof-area

def solve_area(public):
    prompt = public["prompt"]
    m = re.search(r"legs (\d+) and (\d+)", prompt)
    side = re.search(r"square of side (\d+)", prompt)
    require(m and side, "Legs and side in the prompt")
    a, b, s = int(m.group(1)), int(m.group(2)), int(side.group(1))
    require(2 <= a < b <= 12 and s == a + b and s <= 15, "Legs 2 <= a < b <= 12, side a + b <= 15")
    elems = elements(public)
    big = area_of(elems, "fbox")
    require(big == s * s, "The drawn square has side a + b")
    triangles = [area_of(elems, f"ft{k}") for k in range(1, 5)]
    require(all(t == F(a * b, 2) for t in triangles), "Each drawn triangle has legs a and b")
    if "tilted square" in prompt:
        left = area_of(elems, "fmid")
    else:
        require("two squares left uncovered" in prompt, "Which area is asked")
        left = area_of(elems, "fsa") + area_of(elems, "fsb")
    require(left + sum(triangles) == big, "The pieces tile the square")
    require(left == a * a + b * b, "Leftover equals a^2 + b^2")
    return str(left.numerator), (a, b, s)


# ---------------------------------------------------------------- pythagorean-proof-figure

LEFTOVER_REASON = "The big square is the same and the same four triangles are removed, so what is left has the same area both times."
CORNER_REASON = "The two acute angles add to $90^\\circ$, so the corner on the straight side is $180^\\circ - 90^\\circ = 90^\\circ$."


def solve_figure(public):
    prompt = public["prompt"]
    options = choice_options(public)
    elems = elements(public)
    if prompt.startswith("The area of the large square is counted two ways"):
        for option in options:
            require(len(math_spans(option["label"])) == 1, "One equation per option")
        return one_option(options, lambda l: true_at_triples(math_spans(l)[0]), "Equation")
    if "tilted square left in the first picture" in prompt:
        left = area_of(elems, "fmid")
        right = area_of(elems, "gsa") + area_of(elems, "gsb")
        require(left == right, "The drawn leftovers have equal areas")
        require(area_of(elems, "fbox") == area_of(elems, "gbox"), "Same big square")
        return one_option(options, lambda l: l == LEFTOVER_REASON, "Leftover reason")
    require("Why is each corner of the middle shape a right angle?" in prompt, "Recognized prompt")
    mid = elems["fmid"]["points"]
    for i in range(4):
        p, q, r = mid[i - 1], mid[i], mid[(i + 1) % 4]
        dot = (p[0] - q[0]) * (r[0] - q[0]) + (p[1] - q[1]) * (r[1] - q[1])
        require(abs(dot) < 1e-9, "The drawn middle corners are right angles")
    return one_option(options, lambda l: l == CORNER_REASON, "Corner reason")


# ---------------------------------------------------------------- pythagorean-proof-steps

TWO_PICTURES = [
    "Four triangles in a square of side $a + b$ leave a tilted square of side $c$.",
    "The same four, as two $a$ by $b$ rectangles, leave squares of sides $a$ and $b$.",
    "Same square, same four triangles: the leftover areas are equal.",
    "So $c^2 = a^2 + b^2$.",
]
TWO_COUNTS = [
    "Four triangles in a square of side $a + b$ leave a middle square of side $c$.",
    "First count the big square as one square: $(a + b)^2 = a^2 + 2ab + b^2$.",
    "Count it again as parts: $4 \\cdot \\tfrac{1}{2}ab + c^2 = 2ab + c^2$.",
    "The two counts are equal: $a^2 + 2ab + b^2 = 2ab + c^2$.",
    "Subtract $2ab$ from both counts: $a^2 + b^2 = c^2$.",
]
DECOYS = {
    "Measure the hypotenuse and check that it equals $a + b$.",
    "Since $a^2 + b^2 = c^2$, the middle square has side $c$.",
}
CORNER_BLANK = "$180^\\circ - 90^\\circ = 90^\\circ$, as the acute angles add to $90^\\circ$"


def check_count_algebra():
    """The algebra in the two-count steps: identities hold for all a, b; the
    comparison holds exactly at Pythagorean triples."""
    for a, b in ((2, 7), (3, 5), (1, 9)):
        e = {"a": a, "b": b, "c": 0}
        require(equation_holds("(a + b)^2 = a^2 + 2ab + b^2", e), "Square of a sum")
        for c in (0, 4, 11):
            e["c"] = c
            require(equation_holds("4 \\cdot \\tfrac{1}{2}ab + c^2 = 2ab + c^2", e), "Four triangles")
    require(true_at_triples("a^2 + 2ab + b^2 = 2ab + c^2"), "Counts agree at triples")


def solve_steps(public):
    response = public["response"]
    require(response.get("kind") == "multi-part-choice", "Multi-part choice")
    blanks = response["blanks"]
    if response["layout"] == "slots":
        prompt = public["prompt"]
        canon = TWO_PICTURES if "uses two pictures" in prompt else TWO_COUNTS
        require(("counts the big square two ways" in prompt) == (canon is TWO_COUNTS), "Proof named")
        require(f"Put the {len(canon)} steps" in prompt, "Step count in the prompt")
        require([b["id"] for b in blanks] == [f"s{i + 1}" for i in range(len(canon))], "One slot per step")
        options = blanks[0]["options"]
        require(all(b["options"] == options for b in blanks), "Every slot shares the pool")
        labels = [o["label"] for o in options]
        require(len(set(labels)) == len(labels) <= 6, "Distinct pool of at most six")
        require(set(canon) <= set(labels), "Every step is in the pool")
        extra = set(labels) - set(canon)
        require(extra and extra <= DECOYS, "Leftover statements are decoys")
        order = [labels.index(step) for step in canon]
        require(order != sorted(order), "Pool not in proof order")
        if canon is TWO_COUNTS:
            check_count_algebra()
        return compact({f"s{i + 1}": options[labels.index(step)]["id"] for i, step in enumerate(canon)})
    require(response["layout"] == "inline" and len(blanks) == 2, "Two inline blanks")
    key = {}
    for blank in blanks:
        bid = blank["id"]
        opts = blank["options"]
        if bid == "corner":
            require(eval_degrees("180 - 90") == 90, "Straight minus right")
            key[bid] = one_option(opts, lambda l: l == CORNER_BLANK, "Corner blank")
        elif bid == "mid":
            key[bid] = one_option(opts, lambda l: all(evaluate(math_spans(l)[0], env_of(*t)) == t[2] ** 2 for t in TRIPLES), "Middle area")
        elif bid == "tri":
            key[bid] = one_option(opts, lambda l: all(evaluate(math_spans(l)[0], env_of(*t)) == 2 * t[0] * t[1] for t in TRIPLES), "Four triangles")
        else:
            require(bid == "end", f"Unknown blank {bid}")
            key[bid] = one_option(opts, lambda l: true_at_triples(math_spans(l)[0]) and not equation_holds(math_spans(l)[0], env_of(*NON_TRIPLE)), "Last step")
    return compact(key)


def eval_degrees(text):
    return evaluate(text, {})


# ---------------------------------------------------------------- pythagorean-proof-flaw

FLAW_KEYS = [
    ("By the Pythagorean theorem, its area is $a^2 + b^2$", "It uses the Pythagorean theorem, the rule it is trying to prove, as a reason."),
    ("The middle shape has four sides of length $c$, so it is a square", "Four equal sides do not make a square. The proof must show each corner is a right angle."),
    ("Each triangle has area $ab$.", "A right triangle with legs $a$ and $b$ is half of an $a$ by $b$ rectangle, so its area is $\\tfrac{1}{2}ab$."),
    ("“$(a + b)^2 = a^2 + b^2$,", "$(a + b)^2$ is $a^2 + 2ab + b^2$: a square of side $a + b$ also holds two $a$ by $b$ rectangles."),
]
EXAMPLE_KEY = "Checking one triangle does not show the rule for every right triangle. A proof must work for any legs $a$ and $b$."


def solve_flaw(public):
    prompt = public["prompt"]
    options = choice_options(public)
    require(len(options) == 4, "Four options")
    require(any(o["label"].startswith("Nothing is wrong.") for o in options), "A nothing-is-wrong option")
    m = re.search(r"legs (\d+) and (\d+)\. The hypotenuse measures (\d+), and \$(\d+)\^2 \+ (\d+)\^2 = (\d+) \+ (\d+) = (\d+) = (\d+)\^2\$", prompt)
    if m:
        a, b, c, a2, b2, sa, sb, total, c2 = map(int, m.groups())
        require((a, b, c) == (a2, b2, c2) and a * a == sa and b * b == sb and sa + sb == total == c * c, "Example arithmetic is right")
        return one_option(options, lambda l: l == EXAMPLE_KEY, "Example flaw")
    hits = [key for marker, key in FLAW_KEYS if marker in prompt]
    require(len(hits) == 1, "One recognized flaw")
    if "Each triangle has area $ab$." in prompt:
        require(not all(evaluate("ab", env_of(*t)) == F(t[0] * t[1], 2) for t in TRIPLES), "ab is not a right triangle's area")
    if "$(a + b)^2 = a^2 + b^2$" in prompt:
        require(not equation_holds("(a + b)^2 = a^2 + b^2", {"a": 2, "b": 3}), "(a + b)^2 differs from a^2 + b^2")
    return one_option(options, lambda l: l == hits[0], "Flaw")


# ---------------------------------------------------------------- pythagorean-converse-proof

def triple_of(a, b, c):
    require(a * a + b * b == c * c, f"{a}, {b}, {c} is not a Pythagorean triple")


def solve_converse(public):
    prompt = public["prompt"]
    options = choice_options(public)
    if prompt.startswith("The Pythagorean theorem says"):
        def converse(label):
            m = re.fullmatch(r"If (.+), then (.+)\.", label)
            require(m is not None, f"An if-then statement: {label!r}")
            hypothesis, conclusion = m.groups()
            return ("= c^2" in hypothesis and "\\ne" not in hypothesis and "right angle" not in hypothesis
                    and "right angle" in conclusion and "no right angle" not in conclusion)
        return one_option(options, converse, "Converse")
    hinge = re.match(r"Two rods of lengths (\d+) and (\d+) are joined at a hinge\. When the hinge is a right angle, the third side is exactly (\d+)\. The third side now measures (\d+)\.", prompt)
    if hinge:
        a, b, c, d = map(int, hinge.groups())
        triple_of(a, b, c)
        require(abs(a - b) < d < a + b and d != c and abs(d - c) <= 3, "A third side that closes a triangle near c")
        wider = d * d > a * a + b * b
        phrase = "greater than" if wider else "less than"
        return one_option(options, lambda l: l == f"The angle is {phrase} $90^\\circ$.", "Hinge angle")
    why = re.match(r"Rods of lengths (\d+) and (\d+) are joined at a hinge\. As the hinge opens from nearly closed to nearly flat, the third side grows from nearly (\d+) to nearly (\d+)\. Why does this show that a triangle with sides (\d+), (\d+) and (\d+) must have a right angle\?", prompt)
    if why:
        a, b, lo, hi, a2, b2, c = map(int, why.groups())
        require((a, b) == (a2, b2) and lo == b - a and hi == a + b, "Hinge range")
        triple_of(a, b, c)
        return one_option(options, lambda l: l.startswith("The third side gets longer the wider the hinge opens") and f"exactly {c}" in l, "Hinge reason")
    wrong = re.search(r"tests a triangle with sides (\d+), (\d+) and (\d+): “\$(\d+)\^2 \+ (\d+)\^2 = (\d+)\$ and \$(\d+)\^2 = (\d+)\$", prompt)
    if wrong:
        x, y, z, p, q, s1, r, s2 = map(int, wrong.groups())
        require((p, q, r) == (x, y, z) and p * p + q * q == s1 and r * r == s2, "Student arithmetic is right")
        sides = sorted((x, y, z))
        triple_of(*sides)
        require(max(p, q) == sides[2], "The longest side was squared with a shorter one")
        a, b, c = sides
        return one_option(options, lambda l: l == f"The longest side must play $c$: ${a}^2 + {b}^2 = {c}^2$, so it is a right triangle.", "Wrong side")
    adding = re.search(r"tests a triangle with sides (\d+), (\d+) and (\d+): “\$(\d+) \+ (\d+) = (\d+)\$, which is not (\d+)", prompt)
    if adding:
        a, b, c, a2, b2, s, c2 = map(int, adding.groups())
        require((a, b, c) == (a2, b2, c2) and a + b == s != c, "Student sum")
        triple_of(a, b, c)
        return one_option(options, lambda l: l == f"The converse compares squares, not sides: ${a * a} + {b * b} = {c * c}$, so it is a right triangle.", "Adding flaw")
    back = re.search(r"wants to show that a triangle with sides (\d+), (\d+) and (\d+) has a right angle: “The triangle is a right triangle, so", prompt)
    require(back is not None, f"Unrecognized prompt {prompt!r}")
    triple_of(*map(int, back.groups()))
    return one_option(options, lambda l: l.startswith("It assumes the right angle at the start."), "Circular converse")


# ---------------------------------------------------------------- pythagorean-converse-blanks

def solve_converse_blanks(public):
    response = public["response"]
    require(response.get("kind") == "multi-part-choice" and response["layout"] == "inline", "Inline blanks")
    first = response["sentence"][0]["text"]
    m = re.match(r"A triangle has sides (\d+), (\d+) and (\d+), and \$(\d+)\^2 \+ (\d+)\^2 = (\d+)\^2\$", first)
    if m:
        a, b, c, a2, b2, c2 = map(int, m.groups())
        require((a, b, c) == (a2, b2, c2), "Sides repeated")
        triple_of(a, b, c)
        envs = [{}]
        lengths = [(a, b, c)]
        names = (str(a), str(b), str(c))
    else:
        require(first.startswith("A triangle has sides $a$, $b$ and $c$, and $a^2 + b^2 = c^2$."), "Letter form")
        envs = [env_of(*t) for t in TRIPLES]
        lengths = list(TRIPLES)
        names = ("$a$", "$b$", "$c$")

    def value(label, env):
        spans = math_spans(label)
        return evaluate(spans[0] if spans else label, env)

    key = {}
    by = {blank["id"]: blank for blank in response["blanks"]}
    require(list(by) == ["hyp", "equals", "same", "where"], "Four blanks in order")
    hyp = lambda l: all(value(l, e) == t[2] for e, t in zip(envs, lengths))
    key["hyp"] = one_option(by["hyp"]["options"], lambda l: "\\sqrt" in l and hyp(l), "Hypotenuse")
    key["equals"] = one_option(by["equals"]["options"], hyp, "Length")
    key["same"] = one_option(by["same"]["options"], lambda l: l == "congruent, the same size and shape", "Congruent")
    key["where"] = one_option(by["where"]["options"], lambda l: l == f"across from the side {names[2]}", "Right angle across from the longest side")
    for option in by["where"]["options"]:
        require(option["label"] != f"between the sides {names[0]} and {names[1]}", "No second correct position")
    return compact(key)


# ---------------------------------------------------------------- dispatch

SOLVERS = {
    "pythagorean-proof-area": lambda p: solve_area(p)[0],
    "pythagorean-proof-figure": solve_figure,
    "pythagorean-proof-steps": solve_steps,
    "pythagorean-proof-flaw": solve_flaw,
    "pythagorean-converse-proof": solve_converse,
    "pythagorean-converse-blanks": solve_converse_blanks,
}


def solve(public):
    template = public["templateId"]
    require(template in SUPPORTED, "Wrong family")
    return SOLVERS[template](public)


def review_problem(problem):
    public = problem["public"]
    expected = solve(public)
    require(problem["answer"] == expected, f"Answer {problem['answer']} disagrees; expected {expected}")
    explanation, hint = problem.get("explanation"), problem.get("hint")
    require(isinstance(explanation, list) and len(explanation) >= 2, "Explanation lines")
    require(isinstance(hint, str) and hint.strip(), "Hint")
    for text in [public["prompt"], hint, *explanation]:
        require(not PLACEHOLDER.search(text), f"Unrendered placeholder in {text!r}")
    if public["templateId"] == "pythagorean-proof-area":
        _, (a, b, s) = solve_area(public)
        joined = " ".join(explanation)
        require(f"${s}^2 = {s * s}$" in joined, "Explanation squares the big side")
        require(str(a * a + b * b) in joined, "Explanation reaches the leftover area")
        require(expected not in hint.split(), "Hint does not state the area")
    if public["response"]["kind"] == "choice":
        feedback = problem.get("choiceFeedback") or {}
        wrong = {o["id"] for o in public["response"]["options"]} - {expected}
        require(set(feedback) == wrong and all(feedback.values()), "Feedback for every distractor")
    return expected


# ---------------------------------------------------------------- self test

def square_figure(a, b, two):
    s = a + b
    if two:
        polys = {
            "fsa": [[0, 0], [a, 0], [a, a], [0, a]],
            "fsb": [[a, a], [s, a], [s, s], [a, s]],
            "ft1": [[a, 0], [s, 0], [s, a]], "ft2": [[a, 0], [s, a], [a, a]],
            "ft3": [[0, a], [a, a], [a, s]], "ft4": [[0, a], [a, s], [0, s]],
        }
    else:
        polys = {
            "fmid": [[a, 0], [s, a], [b, s], [0, b]],
            "ft1": [[0, 0], [a, 0], [0, b]], "ft2": [[a, 0], [s, 0], [s, a]],
            "ft3": [[s, a], [s, s], [b, s]], "ft4": [[b, s], [0, s], [0, b]],
        }
    polys["fbox"] = [[0, 0], [s, 0], [s, s], [0, s]]
    return {"kind": "scene", "scene": {"v": 1, "elements": [{"type": "polygon", "id": k, "points": v} for k, v in polys.items()]}}


def self_test():
    area = {"public": {"templateId": "pythagorean-proof-area", "seed": "f", "figure": square_figure(3, 8, False),
                       "prompt": "Four copies of a right triangle with legs 3 and 8 sit inside a square of side 11, leaving a tilted square in the middle. What is the area of the tilted square?",
                       "response": {"kind": "number", "label": "Area of the tilted square"}},
            "answer": "73", "hint": "Find the area of the whole square of side 11.",
            "explanation": ["The big square has side $3 + 8 = 11$, so its area is $11^2 = 121$.",
                            "The tilted square is the part the triangles leave uncovered: $121 - 48 = 73$."]}
    require(review_problem(area) == "73", "Area fixture")
    two = copy.deepcopy(area)
    two["public"]["figure"] = square_figure(3, 8, True)
    two["public"]["prompt"] = "Four copies of a right triangle with legs 3 and 8 are slid into two rectangles inside a square of side 11. What is the total area of the two squares left uncovered?"
    require(review_problem(two) == "73", "Two-squares fixture")
    opts = lambda *labels: [{"id": f"option-{'abcd'[i]}", "label": l} for i, l in enumerate(labels)]
    equation = {"public": {"templateId": "pythagorean-proof-figure", "seed": "f", "figure": square_figure(2, 3, False),
                           "prompt": "The area of the large square is counted two ways: as a square of side $a + b$, and as four triangles plus the middle square. Which equation records this?",
                           "response": {"kind": "choice", "label": "Choose one answer", "options": opts(
                               "$(a + b)^2 = 4ab + c^2$", "$(a + b)^2 = 4 \\cdot \\tfrac{1}{2}ab + c^2$",
                               "$a^2 + b^2 = 4 \\cdot \\tfrac{1}{2}ab + c^2$", "$(a + b)^2 = 4 \\cdot \\tfrac{1}{2}ab + c$")}},
                "answer": "option-b", "hint": "Each triangle is half of an $a$ by $b$ rectangle.",
                "choiceFeedback": {"option-a": "x", "option-c": "y", "option-d": "z"},
                "explanation": ["Counted as one square.", "Counted as parts."]}
    require(review_problem(equation) == "option-b", "Equation fixture")
    hinge = {"public": {"templateId": "pythagorean-converse-proof", "seed": "f",
                        "prompt": "Two rods of lengths 5 and 12 are joined at a hinge. When the hinge is a right angle, the third side is exactly 13. The third side now measures 15. What does that tell you about the angle at the hinge?",
                        "response": {"kind": "choice", "label": "Choose one answer", "options": opts(
                            "The angle is less than $90^\\circ$.", "The angle is greater than $90^\\circ$.",
                            "The angle is exactly $90^\\circ$.", "It cannot be determined.")}},
             "answer": "option-b", "hint": "Compare 15 with 13.", "choiceFeedback": {"option-a": "x", "option-c": "y", "option-d": "z"},
             "explanation": ["At a right angle the third side is 13.", "15 is longer than 13."]}
    require(review_problem(hinge) == "option-b", "Hinge fixture")
    blanks = {"public": {"templateId": "pythagorean-converse-blanks", "seed": "f",
                         "prompt": "Complete the proof that a triangle with sides 5, 12 and 13 has a right angle.", "response": {
        "kind": "multi-part-choice", "label": "Choose an answer for each blank", "layout": "inline",
        "sentence": [{"text": "A triangle has sides 5, 12 and 13, and $5^2 + 12^2 = 13^2$. Build a right triangle with legs 5 and 12. By the Pythagorean theorem, its hypotenuse is "},
                     {"blank": "hyp"}, {"text": ", which equals "}, {"blank": "equals"}, {"text": ". So they are "}, {"blank": "same"},
                     {"text": ". So the first triangle has a right angle "}, {"blank": "where"}, {"text": "."}],
        "blanks": [{"id": "hyp", "label": "h", "options": [{"id": "a", "label": "$5 + 12$"}, {"id": "b", "label": "$\\sqrt{5^2 + 12^2}$"}, {"id": "c", "label": "$5^2 + 12^2$"}]},
                   {"id": "equals", "label": "e", "options": [{"id": "a", "label": "169"}, {"id": "b", "label": "17"}, {"id": "c", "label": "13"}]},
                   {"id": "same", "label": "s", "options": [{"id": "a", "label": "both right triangles"}, {"id": "b", "label": "congruent, the same size and shape"}]},
                   {"id": "where", "label": "w", "options": [{"id": "a", "label": "across from the side 5"}, {"id": "b", "label": "across from the side 13"}, {"id": "c", "label": "between the sides 5 and 13"}]}]}},
        "answer": '{"hyp":"b","equals":"c","same":"b","where":"b"}', "hint": "Square 5 and 12.",
        "explanation": ["The hypotenuse is 13.", "Same three sides."]}
    require(review_problem(blanks) == blanks["answer"], "Converse blanks fixture")
    mutations = 0
    for base, change, what in (
            (area, lambda p: p.update(answer="121"), "whole square as the area"),
            (area, lambda p: p["public"].update(prompt=p["public"]["prompt"].replace("side 11", "side 12")), "side not a + b"),
            (area, lambda p: p["public"]["figure"]["scene"]["elements"][1]["points"].__setitem__(1, [9, 0]), "a triangle that is not a copy"),
            (equation, lambda p: p.update(answer="option-a"), "triangle area ab keyed"),
            (equation, lambda p: p["public"]["response"]["options"][0].update(label="$(a + b)^2 = 2ab + c^2$"), "two true equations"),
            (hinge, lambda p: p.update(answer="option-a"), "angle direction reversed"),
            (hinge, lambda p: p["public"].update(prompt=p["public"]["prompt"].replace("exactly 13", "exactly 14")), "not a triple"),
            (blanks, lambda p: p["public"]["response"]["blanks"][3]["options"].append({"id": "d", "label": "between the sides 5 and 12"}), "second true position"),
            (blanks, lambda p: p.update(answer='{"hyp":"a","equals":"c","same":"b","where":"b"}'), "a + b as the hypotenuse")):
        bad = copy.deepcopy(base)
        change(bad)
        try:
            review_problem(bad)
        except (ValueError, KeyError, TypeError, IndexError, ZeroDivisionError):
            mutations += 1
        else:
            raise AssertionError(f"Accepted corrupt Pythagorean proof case: {what}")
    return {"fixtures": 5, "mutations": mutations}


if __name__ == "__main__":
    print(self_test())
