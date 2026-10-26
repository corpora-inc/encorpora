"""Generic independent checks for families on the variation-axis layer.

A family's oracle validates its MODEL once: given one displayed statement (an
equation, a claim about a number), it decides the statement's truth from the
public text alone. These helpers then check each axis adapter's rendering
mechanically, without importing generator code:

- answer format: select-all, true/false pairs and single-choice statement
  sets are decoded from the public response; every distinct statement is
  judged once and the canonical answer is rebuilt from those truths;
- orientation: an equation is split into its operation side and its result
  side whichever way it is written, and both orders must agree;
- number domain: an exact evaluator for rationals, pi, square and cube roots,
  sums, products, quotients and integer powers decides rationality.
"""

import json
import re
from fractions import Fraction

PAIR = re.compile(r"^(.*) is (true|false)\.$", re.S)


def require(condition, message):
    if not condition:
        raise ValueError(message)


# ------------------------------------------------------------ answer format


def is_pair_set(public):
    opts = public["response"].get("options", [])
    if public["response"]["kind"] != "multi-select" or len(opts) % 2:
        return False
    claims = [PAIR.fullmatch(o["label"]) for o in opts]
    if not all(claims):
        return False
    return all(
        claims[i].group(1) == claims[i + 1].group(1)
        and claims[i].group(2) == "true"
        and claims[i + 1].group(2) == "false"
        for i in range(0, len(claims), 2)
    )


def statements(public):
    """The displayed statements, whatever the answer format."""
    opts = public["response"]["options"]
    if is_pair_set(public):
        return [PAIR.fullmatch(opts[i]["label"]).group(1) for i in range(0, len(opts), 2)]
    return [o["label"] for o in opts]


def stated_count(prompt):
    m = re.search(r"(?:Choose|Which) the (\d+)|Which (\d+)|Choose the (\d+)|each of the (\d+)", prompt)
    require(m is not None, "Prompt does not state a selection count")
    return int(next(g for g in m.groups() if g))


def statement_set(public, truth_of, key_of=None):
    """Canonical answer of a statement set. `truth_of(label)` is the family's
    model check; `key_of(label)` names a statement's mathematical identity so
    two equivalent statements are rejected as duplicates."""
    r = public["response"]
    labels = statements(public)
    require(len(set(labels)) == len(labels), "Duplicate statement text")
    if key_of is not None:
        keys = [key_of(l) for l in labels]
        require(len(set(keys)) == len(keys), "Mathematically duplicate statements")
    truths = [bool(truth_of(l)) for l in labels]
    ids = [o["id"] for o in r["options"]]
    require(len(set(ids)) == len(ids), "Duplicate option id")
    if r["kind"] == "choice":
        m = re.search(r"Which \w+ is (true|false)\?$", public["prompt"])
        require(m is not None, "Single-choice statement prompt")
        want = m.group(1) == "true"
        keyed = [i for i, t in zip(ids, truths) if t == want]
        require(len(keyed) == 1, f"{len(keyed)} statements are {m.group(1)}")
        return keyed[0]
    require(r["kind"] == "multi-select", "Expected a statement set")
    if is_pair_set(public):
        n = len(labels)
        require(r["selectionCount"] == n, "A pair set selects one claim per statement")
        require(stated_count(public["prompt"]) == n, "Prompt count differs from pairs")
        require(re.search(r"is true or false, and choose the correct statement for each \w+\.$", public["prompt"]), "Pair instruction")
        chosen = [ids[2 * i + (0 if t else 1)] for i, t in enumerate(truths)]
        return json.dumps(sorted(chosen), separators=(",", ":"))
    require(stated_count(public["prompt"]) == r["selectionCount"], "Prompt count differs from selectionCount")
    require(sum(truths) == r["selectionCount"], f"{sum(truths)} true statements but {r['selectionCount']} selected")
    return json.dumps(sorted(i for i, t in zip(ids, truths) if t), separators=(",", ":"))


def verdict_lines(problem):
    """Each statement's explanation line "<statement>: true|false. …" must
    agree with the keyed answer. Returns the number of lines checked."""
    public = problem["public"]
    opts = public["response"]["options"]
    keyed = set(json.loads(problem["answer"])) if public["response"]["kind"] == "multi-select" else {problem["answer"]}
    found = 0
    for i, label in enumerate(statements(public)):
        hits = [x for x in problem.get("explanation", []) if x.startswith(label.rstrip(".") + ": ")]
        require(len(hits) == 1, f"No unique explanation line for {label!r}")
        verdict = hits[0][len(label.rstrip(".")) + 2 :].split(".")[0].strip().lower()
        require(verdict in ("true", "false"), f"No verdict for {label!r}")
        if is_pair_set(public):
            truth = opts[2 * i]["id"] in keyed
        elif public["response"]["kind"] == "choice":
            continue
        else:
            truth = opts[i]["id"] in keyed
        require((verdict == "true") == truth, f"Explanation misclassifies {label!r}")
        found += 1
    return found


# -------------------------------------------------------------- orientation


def oriented_equation(body, is_operation):
    """Split "L=R" into (operation side, result side) in either orientation."""
    sides = body.split("=")
    require(len(sides) == 2, f"Not one equation: {body!r}")
    left, right = sides
    ops = [is_operation(left), is_operation(right)]
    require(ops.count(True) == 1, f"Expected exactly one operation side: {body!r}")
    return (left, right) if ops[0] else (right, left)


def orientation_of(body, is_operation):
    left = body.split("=")[0]
    return "operation-first" if is_operation(left) else "result-first"


# ------------------------------------------------------------ number domain


def _reduce(n, k):
    """n = s**k * r with r free of k-th powers."""
    require(n >= 1, "Radicand must be positive")
    outside, inside, p = 1, n, 2
    while p**k <= inside:
        while inside % (p**k) == 0:
            inside //= p**k
            outside *= p
        p += 1
    return outside, inside


def _term(c, pi=0, index=2, radicand=1):
    if radicand == 1:
        index = 2
    return {(pi, index, radicand): Fraction(c)}


def _norm(d):
    return {k: v for k, v in d.items() if v != 0}


def _add(a, b, sign=1):
    out = dict(a)
    for k, v in b.items():
        out[k] = out.get(k, 0) + sign * v
    return _norm(out)


def _mul(a, b):
    out = {}
    for (p1, i1, r1), c1 in a.items():
        for (p2, i2, r2), c2 in b.items():
            if r1 == 1:
                key, c = (p1 + p2, i2, r2), c1 * c2
            elif r2 == 1:
                key, c = (p1 + p2, i1, r1), c1 * c2
            else:
                require(i1 == i2, "Mixed root indexes in a product")
                s, r = _reduce(r1 * r2, i1)
                key, c = (p1 + p2, i1 if r != 1 else 2, r), c1 * c2 * s
            out[key] = out.get(key, 0) + c
    return _norm(out)


def _inverse(a):
    require(len(a) == 1, "Divide only by a single term")
    (p, i, r), c = next(iter(a.items()))
    # 1/(c pi^p root_i(r)) = root_i(r^(i-1)) / (c r pi^p)
    s, rr = _reduce(r ** (i - 1), i) if r != 1 else (1, 1)
    return {(-p, i if rr != 1 else 2, rr): Fraction(s) / (c * r)}


class _Parser:
    def __init__(self, text):
        t = text.replace(" ", "").replace("\\left", "").replace("\\right", "")
        t = t.replace("\\cdot", "*").replace("\\times", "*").replace("−", "-")
        self.t, self.i = t, 0

    def peek(self, s):
        return self.t.startswith(s, self.i)

    def eat(self, s):
        require(self.peek(s), f"Expected {s!r} at {self.t[self.i:]!r}")
        self.i += len(s)

    def group(self):
        self.eat("{")
        depth, start = 1, self.i
        while depth:
            require(self.i < len(self.t), "Unbalanced braces")
            depth += {"{": 1, "}": -1}.get(self.t[self.i], 0)
            self.i += 1
        return self.t[start : self.i - 1]

    def expr(self):
        value = self.product()
        while self.i < len(self.t) and self.t[self.i] in "+-":
            sign = 1 if self.t[self.i] == "+" else -1
            self.i += 1
            value = _add(value, self.product(), sign)
        return value

    def product(self):
        value = self.power()
        while self.i < len(self.t):
            if self.peek("*"):
                self.i += 1
                value = _mul(value, self.power())
            elif self.t[self.i] in "\\(0123456789":
                value = _mul(value, self.power())  # juxtaposition: 3\sqrt{2}
            else:
                break
        return value

    def power(self):
        base = self.atom()
        if self.peek("^"):
            self.i += 1
            k = int(self.group())
            require(abs(k) <= 12, "Power too large")
            out = _term(1)
            for _ in range(abs(k)):
                out = _mul(out, base)
            base = out if k >= 0 else _inverse(out)
        return base

    def atom(self):
        if self.peek("-"):
            self.i += 1
            return _mul(_term(-1), self.power())
        if self.peek("("):
            self.i += 1
            value = self.expr()
            self.eat(")")
            return value
        if self.peek("\\pi"):
            self.i += 3
            return _term(1, pi=1)
        if self.peek("\\sqrt[3]"):
            self.i += len("\\sqrt[3]")
            return self._root(3)
        if self.peek("\\sqrt"):
            self.i += len("\\sqrt")
            return self._root(2)
        if self.peek("\\frac"):
            self.i += len("\\frac")
            num = exact_real(self.group())
            den = exact_real(self.group())
            return _mul(num, _inverse(den))
        m = re.match(r"\d+", self.t[self.i :])
        require(m is not None, f"Unparsed TeX at {self.t[self.i:]!r}")
        self.i += len(m.group(0))
        return _term(int(m.group(0)))

    def _root(self, k):
        inner = exact_real(self.group())
        require(len(inner) == 1 and next(iter(inner)) == (0, 2, 1), "Roots of rationals only")
        value = next(iter(inner.values()))
        require(value > 0, "Roots of positive rationals only")
        # root_k(p/q) = root_k(p * q^(k-1)) / q
        s, r = _reduce(value.numerator * value.denominator ** (k - 1), k)
        return _term(Fraction(s, value.denominator), index=k, radicand=r)


def exact_real(tex):
    """Exact value as {(pi power, root index, reduced radicand): coefficient}."""
    p = _Parser(tex)
    value = p.expr()
    require(p.i == len(p.t), f"Trailing TeX {p.t[p.i:]!r}")
    return value


def is_rational(tex):
    """Rational exactly when only the plain rational term remains (pi is
    transcendental; reduced radicals are linearly independent over Q)."""
    value = exact_real(tex)
    return all(k == (0, 2, 1) for k in value)


# ---------------------------------------------------------------- self test


def self_test():
    def opts(labels):
        return [{"id": f"option-{chr(97 + i)}", "label": l} for i, l in enumerate(labels)]

    truth = {"A": True, "B": False, "C": True, "D": False}.__getitem__
    sel = {"prompt": "Choose the 2 statements that are true.", "response": {"kind": "multi-select", "selectionCount": 2, "options": opts(["A", "B", "C", "D"])}}
    require(statement_set(sel, truth) == '["option-a","option-c"]', "select-all")
    bad = {**sel, "response": {**sel["response"], "selectionCount": 3}}
    try:
        statement_set(bad, truth)
        raise AssertionError("accepted a wrong count")
    except ValueError:
        pass
    pair = {
        "prompt": "Decide whether each of the 2 equations is true or false, and choose the correct statement for each equation.",
        "response": {"kind": "multi-select", "selectionCount": 2, "options": opts(["A is true.", "A is false.", "B is true.", "B is false."])},
    }
    require(is_pair_set(pair) and statements(pair) == ["A", "B"], "pair decode")
    require(statement_set(pair, truth) == '["option-a","option-d"]', "pair answer")
    single = {"prompt": "Which equation is false?", "response": {"kind": "choice", "options": opts(["A", "B", "C"])}}
    require(statement_set(single, truth) == "option-b", "single-false")
    is_op = lambda s: "\\div" in s or "\\times" in s
    require(oriented_equation("7=63\\div9", is_op) == ("63\\div9", "7"), "result-first")
    require(oriented_equation("63\\div9=7", is_op) == ("63\\div9", "7"), "operation-first")
    require(orientation_of("7=63\\div9", is_op) == "result-first", "orientation name")
    cases = {
        "\\left(\\sqrt{5}\\right)^{2}": True,
        "\\left(\\sqrt{2}\\right)^{3}": False,
        "\\left(\\sqrt[3]{4}\\right)^{3}": True,
        "\\left(\\sqrt[3]{4}\\right)^{2}": False,
        "\\pi^{2}": False,
        "\\frac{4\\pi^{2}}{\\pi^{2}}": True,
        "\\frac{\\pi^{3}}{\\pi}": False,
        "\\sqrt{3}\\cdot\\sqrt{12}": True,
        "\\sqrt{2}+\\sqrt{8}": False,
        "\\sqrt{8}-2\\sqrt{2}": True,
        "\\pi+\\left(\\sqrt{5}\\right)^{2}": False,
        "\\left(2\\sqrt{3}\\right)^{2}": True,
        "\\frac{\\left(\\sqrt{7}\\right)^{2}}{3}": True,
        "\\left(\\sqrt{3}+2\\right)\\left(\\sqrt{3}-2\\right)": True,
        "\\sqrt{\\frac{9}{16}}": True,
    }
    for tex, expected in cases.items():
        require(is_rational(tex) == expected, f"rationality of {tex}")
    require(exact_real("\\left(\\sqrt{2}\\right)^{5}") == {(0, 2, 2): Fraction(4)}, "4 root 2")


if __name__ == "__main__":
    self_test()
    print("variation axes oracle self-test passed")
