"""Independent review of the structured-work sweep (structured-work-v1).

Templates: polynomial-product-steps, line-from-point-steps, similarity-proof-aa
and the MCAS / Regents written-work rows (similar-triangles-work,
scale-drawing-work, scientific-notation-work, recursion-term-steps,
remainder-steps, addition-rule-steps, average-rate-steps, budget-items-steps).

Every expected step is derived from the public payload only: the prompt, the
row labels, the figure and the response shape. The answer key, the private
`workGrading` rule, the hint and the explanation are values under test.

* Steps: an exact single-variable polynomial parser (TeX and input syntax)
  derives each row's expected value from its label; numbers compare as exact
  rationals, expressions as exact polynomials, relations side by side. Given
  fields in fill mode must equal the derived values. Number rules carrying the
  fraction flag must be written p/q.
* Proofs: statements are read from their TeX labels and checked against the
  figure's coordinates; every reason is a rule written here (right angles from
  perpendiculars, reflexive angle, base angles, parallel corresponding angles,
  AA with vertex correspondence, corresponding sides, exchanging the means).
  The closure of the givens decides which bank statements are provable, every
  claim in the private rule must be valid, and the private rule must contain
  every justification derived here.
"""

import itertools
import json
import math
import re
from fractions import Fraction as F

POLY_STEPS = frozenset({"polynomial-product-steps"})
LINE_STEPS = frozenset({"line-from-point-steps"})
PROOFS = frozenset({"similarity-proof-aa"})
MCAS = frozenset({"similar-triangles-work", "scale-drawing-work", "scientific-notation-work"})
REGENTS = frozenset({"recursion-term-steps", "remainder-steps", "addition-rule-steps", "average-rate-steps", "budget-items-steps"})
SUPPORTED = POLY_STEPS | LINE_STEPS | PROOFS | MCAS | REGENTS
REVIEW_RETURNS_ANSWER = True

STATS = {"cases": 0, "fieldsChecked": 0, "claimsChecked": 0}


def require(condition, message):
    # Not assert: python -O must not disable review gates.
    if not condition:
        raise ValueError(message)


# ======================================================================
# Exact one-variable polynomials: {power: Fraction}

def padd(p, q, s=1):
    out = dict(p)
    for k, v in q.items():
        out[k] = out.get(k, F(0)) + s * v
    return {k: v for k, v in out.items() if v != 0}


def pmul(p, q):
    out = {}
    for a, x in p.items():
        for b, y in q.items():
            out[a + b] = out.get(a + b, F(0)) + x * y
    return {k: v for k, v in out.items() if v != 0}


def pconst(c):
    return {0: F(c)} if c != 0 else {}


def pscale(p, c):
    return {k: v * c for k, v in p.items() if v * c != 0}


def pval(p, x):
    return sum(v * F(x) ** k for k, v in p.items())


def pcoef(p, k):
    return p.get(k, F(0))


def _tokens(text):
    s = text.replace("\\left", "").replace("\\right", "")
    s = re.sub(r"\^\{(-?\d+)\}", r"^\1", s)
    s = s.replace("\\cdot", "*").replace("\\times", "*").replace("−", "-").replace(" ", "")
    out, i = [], 0
    while i < len(s):
        c = s[i]
        if c.isdigit() or (c == "." and i + 1 < len(s) and s[i + 1].isdigit()):
            j = i
            while j < len(s) and (s[j].isdigit() or s[j] == "."):
                j += 1
            out.append(("num", F(s[i:j])))
            i = j
        elif c.isalpha():
            out.append(("var", c))
            i += 1
        elif c in "+-*/^()":
            out.append((c, c))
            i += 1
        else:
            raise ValueError(f"Unexpected {c!r} in {text!r}")
    return out


class _Parser:
    """sum := term (('+'|'-') term)*; term := unary (('*'|'/')? unary)*;
    unary := '-' unary | power; power := atom ('^' int)?; atom := num | var |
    '(' sum ')'. Implicit multiplication is a juxtaposed atom."""

    def __init__(self, text, var):
        self.t, self.i, self.var, self.text = _tokens(text), 0, var, text

    def peek(self):
        return self.t[self.i][0] if self.i < len(self.t) else None

    def take(self):
        tok = self.t[self.i]
        self.i += 1
        return tok

    def parse(self):
        value = self.sum()
        require(self.i == len(self.t), f"Trailing input in {self.text!r}")
        return value

    def sum(self):
        value = self.term()
        while self.peek() in ("+", "-"):
            sign = 1 if self.take()[0] == "+" else -1
            value = padd(value, self.term(), sign)
        return value

    def term(self):
        value = self.unary()
        while True:
            k = self.peek()
            if k in ("*", "/"):
                self.take()
                rhs = self.unary()
                if k == "*":
                    value = pmul(value, rhs)
                else:
                    require(set(rhs) <= {0} and rhs, "Division by a non-constant")
                    value = pscale(value, 1 / rhs[0])
            elif k in ("num", "var", "("):
                value = pmul(value, self.unary())
            else:
                return value

    def unary(self):
        if self.peek() == "-":
            self.take()
            return pscale(self.unary(), -1)
        return self.power()

    def power(self):
        base = self.atom()
        if self.peek() == "^":
            self.take()
            kind, n = self.take()
            require(kind == "num" and n.denominator == 1 and n >= 0, "Power must be a whole number")
            out = pconst(1)
            for _ in range(int(n)):
                out = pmul(out, base)
            return out
        return base

    def atom(self):
        require(self.peek() is not None, f"Unfinished {self.text!r}")
        kind, v = self.take()
        if kind == "num":
            return pconst(v)
        if kind == "var":
            require(v == self.var, f"Unknown letter {v!r} in {self.text!r}")
            return {1: F(1)}
        require(kind == "(", f"Unexpected {kind} in {self.text!r}")
        value = self.sum()
        require(self.peek() == ")", "Missing )")
        self.take()
        return value


def parse_poly(text, var="x"):
    return _Parser(text, var).parse()


def tex_body(text):
    """The content of the first $...$ in text, or the text itself."""
    m = re.search(r"\$(.+?)\$", text)
    return m[1] if m else text


def num(text):
    s = text.replace(",", "").replace("−", "-").strip()
    m = re.fullmatch(r"(-?)\\frac\{(\d+)\}\{(\d+)\}", s)
    if m:
        return (-1 if m[1] else 1) * F(int(m[2]), int(m[3]))
    return F(s)


def dec_text(x):
    """A finite decimal such as 7.5 (money amounts), else p/q."""
    x = F(x)
    d = x.denominator
    while d % 2 == 0:
        d //= 2
    while d % 5 == 0:
        d //= 5
    if d != 1:
        return frac_text(x)
    text = f"{float(x):.6f}".rstrip("0").rstrip(".")
    return text


def frac_text(x):
    x = F(x)
    return str(x.numerator) if x.denominator == 1 else f"{x.numerator}/{x.denominator}"


# ======================================================================
# Rows

def _relation(text):
    m = re.fullmatch(r"(.+?)(<=|>=|<|>|=)(.+)", text.replace(" ", ""))
    require(m, f"Not a relation: {text!r}")
    return m[1], m[2], m[3]


def _derive_poly(public):
    prompt, rows = public["prompt"], public["response"]["rows"]
    m = re.search(r"Multiply \$(.+?)\$ and write", prompt)
    require(m, "Polynomial prompt")
    factors = re.findall(r"\(([^()]*)\)(\^\{?2\}?)?", m[1])
    if len(factors) == 1:
        require(factors[0][1], "A lone factor must be squared")
        f = g = parse_poly(factors[0][0])
    else:
        require(len(factors) == 2 and not factors[0][1] and not factors[1][1], "Two factors")
        f, g = parse_poly(factors[0][0]), parse_poly(factors[1][0])
    product = pmul(f, g)
    out = []
    for row in rows:
        label = row["label"]
        if label.startswith("Product of the first terms"):
            out.append([pmul({max(f): f[max(f)]}, {max(g): g[max(g)]})])
        elif label.startswith("Product of the outer terms"):
            out.append([pmul({max(f): f[max(f)]}, {0: g[0]} if 0 in g else {})])
        elif label.startswith("Product of the inner terms"):
            out.append([pmul({0: f.get(0, F(0))} if 0 in f else {}, {max(g): g[max(g)]})])
        elif " times each term of the second factor" in label:
            term = parse_poly(tex_body(label))
            require(len(term) == 1 and (term == {k: f[k] for k in term}), f"Label term {label!r} is a term of the first factor")
            out.append([pmul(term, g)])
        else:
            stops = re.findall(r"\$x(?:\^(\d))?\$|constant term", label, re.I)
            degrees = []
            for hit in re.finditer(r"\$x(?:\^(\d))?\$|constant term", label, re.I):
                degrees.append(0 if hit[0].lower() == "constant term" else int(hit[1] or 1))
            require(stops and "oefficient" in label or "Constant term" in label, f"Unknown polynomial row {label!r}")
            out.append([pcoef(product, d) for d in degrees])
            units = [fld.get("unit") for fld in row["fields"]]
            names = {3: "x³", 2: "x²", 1: "x", 0: None}
            require(units == [names[d] for d in degrees], f"Units {units} match powers {degrees}")
    return out


def _poly_text_ok(p):
    return p is not None


def _derive_line(public):
    prompt, rows = public["prompt"], public["response"]["rows"]
    pts = re.findall(r"\((-?\d+),\s*(-?\d+)\)", prompt)
    pts = [(F(a), F(b)) for a, b in pts]
    m = re.search(r"slope \$(.+?)\$", prompt)
    if m:
        slope = num(m[1])
        require(len(pts) == 1, "One point with a slope")
        ref = pts[0]
    else:
        require(len(pts) == 2 and pts[0][0] != pts[1][0], "Two points with different x")
        slope = (pts[1][1] - pts[0][1]) / (pts[1][0] - pts[0][0])
        ref = pts[0]
        require(pts[1][1] - slope * pts[1][0] == ref[1] - slope * ref[0], "Both points on one line")
    out = []
    for row in rows:
        label = row["label"]
        if label.startswith("Slope of the line"):
            out.append([slope])
        elif label.startswith("Slope times the"):
            pm = re.search(r"\((-?\d+),(-?\d+)\)", label)
            require(pm, "Label names a point")
            q = (F(pm[1]), F(pm[2]))
            require(q in pts, "Label point is a given point")
            out.append([slope * q[0]])
        elif "y$-intercept" in label:
            out.append([ref[1] - slope * ref[0]])
        elif label.startswith("Equation of the line"):
            out.append([("line", slope, ref[1] - slope * ref[0])])
        else:
            raise ValueError(f"Unknown line row {label!r}")
    return out


def _round_half_up(x):
    x = F(x)
    return math.floor(x + F(1, 2)) if x >= 0 else -math.floor(-x + F(1, 2))


def _derive_similar(public):
    p = public["prompt"]
    m = re.search(r"Triangle \$(\w{3})\$ is similar to triangle \$(\w{3})\$", p)
    a, b = m[1], m[2]
    require(re.search(r"with " + r", ".join(rf"\${a[i]}\$ corresponding to \${b[i]}\$" for i in range(3)), p), "Correspondence order")
    angs = {k: F(v) for k, v in re.findall(r"\\angle (\w)=(\d+)\^\\circ", p)}
    require(len(angs) == 2 and set(angs) <= set(a), "Two angles of the first triangle")
    missing = [c for c in a if c not in angs][0]
    angs[missing] = 180 - sum(angs.values())
    sides = {frozenset(k): F(v) for k, v in re.findall(r"\$(\w\w)=(\d+)\$", p)}
    pre = {s: v for s, v in sides.items() if s <= set(a)}
    img = {s: v for s, v in sides.items() if s <= set(b)}
    require(len(pre) == 3 and len(img) == 1, "Three sides and one image side")
    to_pre = dict(zip(b, a))
    (is_, iv), = img.items()
    k = iv / pre[frozenset(to_pre[c] for c in is_)]
    out = []
    for row in rows_of(public):
        label = row["label"]
        mm = re.search(r"Measure of \$\\angle (\w)\$", label)
        if mm:
            out.append([angs[to_pre[mm[1]]]])
        elif label.startswith("Scale factor"):
            out.append([k])
        else:
            mm = re.search(r"Length of \$(\w\w)\$", label)
            require(mm, f"Unknown similar row {label!r}")
            out.append([k * pre[frozenset(to_pre[c] for c in mm[1])]])
    return out


def rows_of(public):
    return public["response"]["rows"]


def _derive_scale(public):
    p = public["prompt"]
    m = re.search(r"rectangle ([\d.]+) (\w+) long and ([\d.]+) \w+ wide", p)
    s = re.search(r"\$1\\text\{ (\w+)\}=(\d+)\\text\{ (\w+)\}\$", p)
    n = re.search(r"that is ([\d.]+) (\w+) long", p)
    require(m and s and n, "Scale prompt")
    length, width, k = F(m[1]), F(m[3]), F(s[2])
    real_len, real_wid = length * k, width * k
    scale2 = real_len / F(n[1])
    out = []
    for row in rows_of(public):
        label = row["label"]
        unit = {"feet": "feet", "meters": "meters"}
        if label.startswith("Actual length"):
            out.append([real_len])
        elif label.startswith("Actual area"):
            out.append([real_len * real_wid])
        elif label.startswith("Scale of the new drawing"):
            out.append([scale2])
        elif label.startswith("Width of the new drawing"):
            out.append([real_wid / scale2])
        else:
            raise ValueError(f"Unknown scale row {label!r}")
    require({"cm": "centimeters", "in": "inches"}[s[1]] == m[2], "The scale unit is the drawing unit")
    return out


def _sci(x):
    x = F(x)
    require(x > 0, "Positive")
    e = 0
    while x >= 10:
        x, e = x / 10, e + 1
    while x < 1:
        x, e = x * 10, e - 1
    return [x, F(e)]


def _derive_scientific(public):
    p = public["prompt"]
    bare = re.sub(r"\$[^$]*\$", " ", p)
    count_m = re.search(r"finds ([\d,]+) ", bare)
    plain = [t for t in re.findall(r"\d[\d,]*(?:\.\d+)?", re.sub(r"finds [\d,]+", "", bare))]
    require(len(plain) >= 2, "Two plain numbers")
    big, small = num(plain[0]), num(plain[1])
    sci = [F(c) * F(10) ** int(e) for c, e in re.findall(r"(\d+(?:\.\d+)?)\\times10\^\{(-?\d+)\}", p)]
    nouns = re.findall(r"of an? ([a-z ]+?) is \$", p)
    require(len(sci) == 2 and len(nouns) == 2, "Two averages")
    value = dict(zip(nouns, sci))
    count = num(count_m[1])
    out = []
    for row in rows_of(public):
        label = row["label"]
        if label.startswith("Total"):
            out.append(_sci(count * value[nouns[1]]))
        elif " is as " in label:
            mm = re.search(r"an? (\w+) is as an? (\w+)", label)
            out.append([value[mm[1]] / value[mm[2]]])
        elif "scientific notation" in label:
            if label.split(" in scientific")[0].count("grain") or label.startswith(("Weight of the thread", "Mass of the grain")):
                out.append(_sci(small))
            else:
                out.append(_sci(big))
        else:
            raise ValueError(f"Unknown scientific row {label!r}")
    return out


def _derive_recursion(public):
    p = public["prompt"]
    m = re.search(r"a_1=(-?\d+)\$ and \$a_n=(\d*)(\(a_\{n-1\}\)\^2|a_\{n-1\})([+-]\d+)", p)
    t = re.search(r"Find \$a_(\d)\$", p)
    require(m and t, "Recursion prompt")
    mult = F(m[2]) if m[2] else F(1)
    squares = m[3].endswith("^2")
    term = F(m[1])
    seq = [term]
    for _ in range(int(t[1]) - 1):
        term = mult * (term ** 2 if squares else term) + F(m[4])
        seq.append(term)
    out = []
    for row in rows_of(public):
        k = int(re.search(r"\$a_(\d)\$", row["label"])[1])
        out.append([seq[k - 1]])
    require(len(out) == int(t[1]) - 1, "One step per term after the first")
    return out


def _derive_remainder(public):
    p = public["prompt"]
    m = re.search(r"f\(x\)=(.+?)\$, find the remainder when \$f\(x\)\$ is divided by \$x([+-]\d+)\$", p)
    require(m, "Remainder prompt")
    f = parse_poly(m[1])
    root = -F(m[2])
    out, parts = [], []
    for row in rows_of(public):
        label = row["label"]
        if label.startswith("The value of $x$"):
            out.append([root])
        elif label.startswith("The value of"):
            g = parse_poly(tex_body(label))
            parts.append(g)
            out.append([pval(g, root)])
        elif label == "The remainder":
            out.append([pval(f, root)])
        else:
            raise ValueError(f"Unknown remainder row {label!r}")
    total = {}
    for g in parts:
        total = padd(total, g)
    require(total == f, "The two partial polynomials sum to f(x)")
    return out


def _derive_addition(public):
    p = public["prompt"]
    pct = [F(x) for x in re.findall(r"(\d+)%", p)]
    require(len(pct) == 3 and pct[2] <= min(pct[:2]), "Three percents with a feasible overlap")
    union = pct[0] + pct[1] - pct[2]
    out = []
    for row in rows_of(public):
        label = row["label"]
        if "added" in label:
            out.append([pct[0] + pct[1]])
        elif "neither" in label:
            out.append([100 - union])
        else:
            out.append([union])
    return out


def _derive_average(public):
    p = public["prompt"]
    data = {int(y): num(v) for y, v in re.findall(r"(\d{4}): ([\d,]+)", p)}
    m = re.search(r"between (\d{4}) and (\d{4})", p)
    y1, y2 = int(m[1]), int(m[2])
    change, years = data[y2] - data[y1], y2 - y1
    rate = F(change, 1) / years
    require(abs(rate - rate.__floor__() - F(1, 2)) != 0, "No rounding tie")
    out = []
    for row in rows_of(public):
        label = row["label"]
        if label.startswith("Change"):
            out.append([change])
        elif label.startswith("Number of years"):
            out.append([F(years)])
        else:
            out.append([F(_round_half_up(rate))])
    return out


def _derive_budget(public):
    p = public["prompt"]
    nums = [num(x) for x in re.findall(r"(?<![\w$])(\d+(?:\.\d+)?) dollars", p)]
    least = "least whole number" in p
    if least:
        fixed, goal, price = nums
    else:
        goal, fixed, price = nums
    left = goal - fixed
    n = math.ceil(left / price) if least else math.floor(left / price)
    out = []
    for row in rows_of(public):
        label = row["label"]
        if label.startswith("Inequality"):
            out.append([("ineq", fixed, price, ">=" if least else "<=", goal)])
        elif label.startswith("Dollars"):
            out.append([left])
        else:
            out.append([F(n)])
    return out


DERIVE = {
    "polynomial-product-steps": _derive_poly,
    "line-from-point-steps": _derive_line,
    "similar-triangles-work": _derive_similar,
    "scale-drawing-work": _derive_scale,
    "scientific-notation-work": _derive_scientific,
    "recursion-term-steps": _derive_recursion,
    "remainder-steps": _derive_remainder,
    "addition-rule-steps": _derive_addition,
    "average-rate-steps": _derive_average,
    "budget-items-steps": _derive_budget,
}


def expected_fields(public):
    """One list of expected values per row, in the response's row order."""
    return DERIVE[public["templateId"]](public)


def field_matches(expected, text, kind):
    """Whether a learner's text equals an expected value exactly."""
    if kind == "number":
        return re.fullmatch(r"-?\d+(\.\d+)?(/\d+)?", text) is not None and F(text) == F(expected)
    if isinstance(expected, dict):
        return parse_poly(text) == expected
    if expected[0] == "line":
        lhs, op, rhs = _relation(text)
        return op == "=" and lhs == "y" and parse_poly(rhs) == padd(pscale({1: F(1)}, expected[1]), pconst(expected[2]))
    if expected[0] == "ineq":
        lhs, op, rhs = _relation(text)
        _, fixed, price, want_op, goal = expected
        return op == want_op and parse_poly(lhs, "n") == padd(pconst(fixed), pscale({1: F(1)}, price)) and parse_poly(rhs, "n") == pconst(goal)
    raise ValueError("Unknown expected value")


def expected_key(public):
    """The expected answer as JSON rows; given cells in fill mode are ''."""
    expected = expected_fields(public)
    rows = rows_of(public)
    require(len(expected) == len(rows), "One expected list per row")
    out = []
    for row, vals in zip(rows, expected):
        require(len(vals) == len(row["fields"]), f"Row {row['label']!r} has {len(vals)} values")
        cells = []
        for fld, v in zip(row["fields"], vals):
            if "given" in fld:
                require(field_matches(v, fld["given"], fld["kind"]), f"Given value {fld['given']!r} is wrong for {row['label']!r}")
                cells.append("")
            else:
                cells.append(render(v, fld))
        out.append(cells)
    return out


def render(v, fld):
    if isinstance(v, dict):
        # canonical input syntax of a polynomial in x
        if not v:
            return "0"
        parts = []
        for k in sorted(v, reverse=True):
            c = v[k]
            body = (frac_text(abs(c)) if (abs(c) != 1 or k == 0) else "") + ("x" if k else "") + (f"^{k}" if k > 1 else "")
            parts.append(("-" if c < 0 else ("+" if parts else "")) + body)
        return "".join(parts)
    if isinstance(v, tuple):
        if v[0] == "line":
            return f"y={render(padd(pscale({1: F(1)}, v[1]), pconst(v[2])), fld)}"
        _, fixed, price, op, goal = v
        return f"{dec_text(fixed)}+{dec_text(price)}n{op}{dec_text(goal)}"
    return frac_text(v)


def solve(public):
    t = public["templateId"]
    require(t in SUPPORTED, f"Unsupported template {t}")
    if t in PROOFS:
        proof = _Proof(public)
        require(proof.goal in proof.closure, "The goal is not provable")
        return "provable:" + ",".join(sorted(proof.closure))
    expected = expected_fields(public)
    return json.dumps([[repr(v) for v in vals] for vals in expected])


# ======================================================================
# Review of steps

def _canonical_equal(problem, key):
    """Semantic comparison of the key with the derived values."""
    answer = json.loads(problem["answer"])
    require(isinstance(answer, list) and len(answer) == len(key), "Answer has one list per row")
    rows = rows_of(problem["public"])
    expected = expected_fields(problem["public"])
    for row, cells, vals, exp_cells in zip(rows, answer, expected, key):
        require(len(cells) == len(row["fields"]), "Answer has one cell per field")
        for fld, cell, v, ec in zip(row["fields"], cells, vals, exp_cells):
            if "given" in fld:
                require(cell == "", "Given cells are blank in the key")
            else:
                require(field_matches(v, cell, fld["kind"]), f"Key cell {cell!r} is not {v!r} for {row['label']!r}")
                STATS["fieldsChecked"] += 1


def _check_rules(problem, key):
    g = problem["workGrading"]
    require(g["mode"] == "fields", "Step families grade per field")
    rows = rows_of(problem["public"])
    expected = expected_fields(problem["public"])
    require(len(g["fields"]) == len(rows), "One rule list per row")
    for row, rules, vals in zip(rows, g["fields"], expected):
        require(len(rules) == len(row["fields"]), "One rule per field")
        for fld, rule, v in zip(row["fields"], rules, vals):
            if "given" in fld:
                require(rule is None, "A given field has no rule")
                continue
            require(rule is not None and rule["kind"] == fld["kind"], "Rule kind matches the field")
            require(field_matches(v, rule["value"], fld["kind"]), f"Rule {rule['value']!r} is not {v!r}")
            if fld["kind"] == "number" and rule.get("fraction"):
                require(re.fullmatch(r"-?\d+/\d+", rule["value"]) is not None, "A fraction rule is p/q")
            if fld["kind"] == "expression" and problem["public"]["templateId"] in POLY_STEPS:
                require(rule.get("expanded") is True, "A partial product must be graded as an expanded sum")
            if fld["kind"] == "expression":
                require(rule.get("match", "identity") == ("sides" if fld.get("relations") else "identity"), "Relations compare side by side")
            STATS["claimsChecked"] += 1


def _review_steps(problem):
    public = problem["public"]
    response = public["response"]
    require(response["kind"] == "structured-work" and response["layout"] == "steps", "Steps layout")
    require(response["mode"] in ("build", "fill"), "Build or fill")
    require("Some steps are filled in" in public["prompt"] if response["mode"] == "fill" else "Enter each step" in public["prompt"], "Prompt names the mode")
    key = expected_key(public)
    _canonical_equal(problem, key)
    _check_rules(problem, key)
    return problem["answer"]


# ======================================================================
# Proofs

class _Scene:
    def __init__(self, figure):
        self.pt = {}
        self.segments = []
        for e in figure["scene"]["elements"]:
            if e["type"] == "text":
                self.pt[e["text"]] = (F(e["at"][0]).limit_denominator(10 ** 6), F(e["at"][1]).limit_denominator(10 ** 6))
            elif e["type"] == "segment":
                self.segments.append((tuple(e["from"]), tuple(e["to"])))
        self.xy = {k: (float(x), float(y)) for k, (x, y) in self.pt.items()}

    def vec(self, a, b):
        return (self.xy[b][0] - self.xy[a][0], self.xy[b][1] - self.xy[a][1])

    def length(self, a, b):
        return math.hypot(*self.vec(a, b))

    def angle(self, v, a, b):
        p, q = self.vec(v, a), self.vec(v, b)
        return math.degrees(math.acos(max(-1, min(1, (p[0] * q[0] + p[1] * q[1]) / (math.hypot(*p) * math.hypot(*q))))))

    def cross(self, a, b, c, d):
        p, q = self.vec(a, b), self.vec(c, d)
        return p[0] * q[1] - p[1] * q[0] 

    def dot(self, a, b, c, d):
        p, q = self.vec(a, b), self.vec(c, d)
        return p[0] * q[0] + p[1] * q[1]

    def same_dir(self, a, b, c, d):
        p, q = self.vec(a, b), self.vec(c, d)
        return abs(self.cross(a, b, c, d)) < 1e-9 * math.hypot(*p) * math.hypot(*q) and self.dot(a, b, c, d) > 0

    def collinear(self, a, b, c):
        return abs(self.cross(a, b, a, c)) < 1e-9 * max(1, self.length(a, b) * self.length(a, c))


def _close(a, b):
    return abs(a - b) < 1e-7 * max(1, abs(a), abs(b))


def read_statement(label):
    """A list of atomic facts. Fact shapes: ('perp', ab, cd), ('par', ab, cd),
    ('segcong', ab, cd), ('angcong', (v,a,b), (v2,a2,b2)), ('sim', t1, t2),
    ('prop', ab, cd, ef, gh) for AB/CD=EF/GH."""
    s = label.strip("$ ")
    seg = r"\\overline\{(\w\w)\}"
    ang = r"\\angle (\w)(\w)(\w)"
    atoms = []
    parts = re.split(r",\\ |\\text\{ and \}", s)
    if len(parts) > 1:
        for part in parts:
            atoms += read_statement(part)
        return atoms
    m = re.fullmatch(seg + r"\\(perp|parallel|cong)" + seg, s)
    if m:
        kind = {"perp": "perp", "parallel": "par", "cong": "segcong"}[m[2]]
        return [(kind, m[1], m[3])]
    m = re.fullmatch(ang + r"\\cong" + ang, s)
    if m:
        # \angle ABC is at B
        return [("angcong", (m[2], m[1], m[3]), (m[5], m[4], m[6]))]
    m = re.fullmatch(r"\\triangle (\w{3})\\sim\\triangle (\w{3})", s)
    if m:
        return [("sim", m[1], m[2])]
    m = re.fullmatch(r"\\frac\{(\w\w)\}\{(\w\w)\}=\\frac\{(\w\w)\}\{(\w\w)\}", s)
    if m:
        return [("prop", m[1], m[2], m[3], m[4])]
    raise ValueError(f"Unreadable statement {label!r}")


class _Proof:
    def __init__(self, public):
        self.public = public
        response = public["response"]
        require(response["layout"] == "proof", "Proof layout")
        banks = {b["id"]: b for b in response["banks"]}
        require(set(banks) == {"statements", "reasons"}, "Statement and reason banks")
        self.scene = _Scene(public["figure"])
        m = re.search(r"Given: (.+)\. Prove: (.+)\. (?:Build|The)", public["prompt"])
        require(m, "Given and Prove")
        require(response.get("goal") == m[2], "Goal is the Prove statement")
        self.given_atoms = {a for g in re.split(r"\$ and \$", m[1]) for a in read_statement(g)}
        self.facts = {o["id"]: read_statement(o["label"]) for o in banks["statements"]["options"]}
        self.labels = {o["id"]: o["label"] for o in banks["statements"]["options"]}
        seen = {}
        for sid, atoms in self.facts.items():
            key = frozenset(self.norm(a) for a in atoms)
            require(key not in seen, f"Statements {seen.get(key)} and {sid} say the same thing")
            seen[key] = sid
        goal_atoms = frozenset(self.norm(a) for a in read_statement(m[2]))
        goals = [sid for sid, atoms in self.facts.items() if frozenset(self.norm(a) for a in atoms) == goal_atoms]
        require(len(goals) == 1, "The Prove statement is one bank statement")
        self.goal = goals[0]
        self.reasons = {}
        rules = {
            "Given": "given",
            "Perpendicular lines form congruent right angles": "rightangles",
            "Reflexive property of congruence": "reflexive",
            "AA: two pairs of congruent angles make triangles similar": "aa",
            "Corresponding sides of similar triangles are proportional": "cst",
            "Corresponding angles of parallel lines are congruent": "corresponding",
            "Base angles of an isosceles triangle are congruent": "base",
            "Exchanging the means of a proportion gives another true proportion": "means",
            "SAS similarity": "sas",
            "CPCTC (corresponding parts of congruent triangles)": "cpctc",
            "Alternate interior angles of parallel lines are congruent": "alternate",
            "Definition of midpoint": "midpoint",
        }
        for o in banks["reasons"]["options"]:
            require(o["label"] in rules, f"Unknown reason {o['label']!r}")
            self.reasons[o["id"]] = rules[o["label"]]
        self.closure = self._closure()

    # --- facts
    def norm(self, a):
        k = a[0]
        if k in ("perp", "par", "segcong"):
            return (k, frozenset([frozenset(a[1]), frozenset(a[2])]))
        if k == "angcong":
            return (k, frozenset([self._ang(a[1]), self._ang(a[2])]))
        if k == "sim":
            return (k, frozenset(zip(a[1], a[2])))  # the correspondence, vertex pairs
        if k == "prop":
            return (k, frozenset([(frozenset(a[1]), frozenset(a[2])), (frozenset(a[3]), frozenset(a[4]))]))
        raise ValueError(k)

    def _ang(self, a):
        v, x, y = a
        return (v, frozenset([x, y]))

    def true(self, a):
        s = self.scene
        k = a[0]
        if k == "perp":
            return abs(s.dot(a[1][0], a[1][1], a[2][0], a[2][1])) < 1e-7 * s.length(*a[1]) * s.length(*a[2])
        if k == "par":
            return abs(s.cross(a[1][0], a[1][1], a[2][0], a[2][1])) < 1e-7 * s.length(*a[1]) * s.length(*a[2])
        if k == "segcong":
            return _close(s.length(*a[1]), s.length(*a[2]))
        if k == "angcong":
            return _close(s.angle(*a[1]), s.angle(*a[2]))
        if k == "sim":
            t, u = a[1], a[2]
            return all(_close(s.angle(t[i], t[(i + 1) % 3], t[(i + 2) % 3]), s.angle(u[i], u[(i + 1) % 3], u[(i + 2) % 3])) for i in range(3))
        if k == "prop":
            return _close(s.length(*a[1]) * s.length(*a[4]), s.length(*a[2]) * s.length(*a[3]))
        raise ValueError(k)

    # --- rules: each returns the list of alternative premise-atom sets
    def requirements(self, fact, reason, avail):
        """Minimal sets of premise atoms (normalized) from avail that justify fact."""
        s = self.scene
        k = fact[0]
        norm = self.norm
        out = []
        if not self.true(fact):
            return out
        if reason == "given":
            return [frozenset()] if fact in self.given_atoms else []
        if reason == "rightangles" and k == "angcong":
            need = []
            for v, x, y in fact[1:]:
                if not _close(s.angle(v, x, y), 90):
                    return []
                need.append([p for p in avail if p[0] == "perp" and self._perp_of(p, v, x, y)])
            if len(set(self._ang(a) for a in fact[1:])) != 2 and fact[1] == fact[2]:
                return []
            if all(need):
                for combo in itertools.product(*need):
                    out.append(frozenset(norm(c) for c in combo))
            return out
        if reason == "reflexive" and k == "angcong":
            (v, x, y), (v2, x2, y2) = fact[1], fact[2]
            if v == v2 and (s.same_dir(v, x, v2, x2) and s.same_dir(v, y, v2, y2) or s.same_dir(v, x, v2, y2) and s.same_dir(v, y, v2, x2)):
                return [frozenset()]
            return []
        if reason == "base" and k == "angcong":
            for p in avail:
                if p[0] == "segcong":
                    (a, b), (c, d) = p[1], p[2]
                    common = set(a + b) & set(c + d)
                    if len(common) == 1:
                        apex = common.pop()
                        e, f = [x for x in a + b if x != apex][0], [x for x in c + d if x != apex][0]
                        want = {self._ang((e, apex, f)), self._ang((f, apex, e))}
                        # base angles: at e between e-apex and e-f; at f between f-apex and f-e
                        if {self._ang(fact[1]), self._ang(fact[2])} == {(e, frozenset([apex, f])), (f, frozenset([apex, e]))}:
                            out.append(frozenset([norm(p)]))
            return out
        if reason == "corresponding" and k == "angcong":
            (v, x, y), (v2, x2, y2) = fact[1], fact[2]
            for p in avail:
                if p[0] == "par":
                    l1, l2 = p[1], p[2]
                    for (a1, b1, a2, b2) in ((x, y, x2, y2), (y, x, y2, x2), (x, y, y2, x2), (y, x, x2, y2)):
                        # one ray of each angle along the transversal (same direction), the other along the parallels (same direction)
                        if s.same_dir(v, a1, v2, a2) and s.same_dir(v, b1, v2, b2):
                            line_ok = (self._on_line(v, b1, l1) and self._on_line(v2, b2, l2)) or (self._on_line(v, b1, l2) and self._on_line(v2, b2, l1))
                            if line_ok:
                                out.append(frozenset([norm(p)]))
            return out
        if reason == "aa" and k == "sim":
            t, u = fact[1], fact[2]
            pair_angles = {}
            for p in avail:
                if p[0] == "angcong":
                    for i in range(3):
                        mine = (t[i], t[(i + 1) % 3], t[(i + 2) % 3])
                        theirs = (u[i], u[(i + 1) % 3], u[(i + 2) % 3])
                        if (self.same_angle(p[1], mine) and self.same_angle(p[2], theirs)) or (self.same_angle(p[2], mine) and self.same_angle(p[1], theirs)):
                            pair_angles.setdefault(i, set()).add(norm(p))
            for i, j in itertools.combinations(sorted(pair_angles), 2):
                for pi in pair_angles[i]:
                    for pj in pair_angles[j]:
                        out.append(frozenset([pi, pj]))
            return out
        if reason == "cst" and k == "prop":
            a, b, c, d = fact[1:]
            for p in avail:
                if p[0] == "sim":
                    fwd = dict(zip(p[1], p[2]))
                    back = {v: u for u, v in fwd.items()}
                    tri1, tri2 = set(p[1]), set(p[2])
                    # cross ratio a/b = c/d with a, c in one triangle and b, d their images in the other
                    for one, other, corr in ((tri1, tri2, fwd), (tri2, tri1, back)):
                        if set(a) <= one and set(c) <= one and set(b) <= other and set(d) <= other and {corr[ch] for ch in a} == set(b) and {corr[ch] for ch in c} == set(d):
                            out.append(frozenset([norm(p)]))
            return out
        if reason == "means" and k == "prop":
            a, b, c, d = fact[1:]
            for p in avail:
                if p[0] == "prop" and norm(p) == norm(("prop", a, c, b, d)):
                    out.append(frozenset([norm(p)]))
            return out
        # SAS, CPCTC, alternate angles and midpoint never justify a statement of this figure.
        return []

    def same_angle(self, p, q):
        """The same angle: one vertex, and rays that point the same way."""
        (v, x, y), (v2, x2, y2) = p, q
        s = self.scene
        return v == v2 and ((s.same_dir(v, x, v, x2) and s.same_dir(v, y, v, y2)) or (s.same_dir(v, x, v, y2) and s.same_dir(v, y, v, x2)))

    def _on_line(self, a, b, seg):
        s = self.scene
        return s.collinear(seg[0], seg[1], a) and s.collinear(seg[0], seg[1], b)

    def _perp_of(self, p, v, x, y):
        """Whether the perpendicular statement p says the angle xvy is right."""
        s = self.scene
        for l1, l2 in ((p[1], p[2]), (p[2], p[1])):
            if self._on_line(v, x, l1) and self._on_line(v, y, l2):
                return True
        return False

    def justifications(self, sid, rid, available):
        """Minimal premise-statement sets (ids within available) justifying sid by rid."""
        avail_atoms = {}
        for o in available:
            if o == sid:
                continue
            for a in self.facts[o]:
                avail_atoms.setdefault(self.norm(a), set()).add(o)
        atom_by_norm = {self.norm(a): a for o in available if o != sid for a in self.facts[o]}
        avail = list(atom_by_norm.values())
        reason = self.reasons[rid]
        results = set()
        atoms = self.facts[sid]
        # A multi-atom statement is justified when every atom is.
        per_atom = []
        for a in atoms:
            alts = self.requirements(a, reason, avail)
            if reason == "given":
                alts = [frozenset()] if a in self.given_atoms else []
            if not alts:
                return []
            per_atom.append(alts)
        for combo in itertools.product(*per_atom):
            need = frozenset().union(*combo)
            providers = [sorted(avail_atoms[n]) for n in need]
            for pick in itertools.product(*providers) if providers else [()]:
                results.add(frozenset(pick))
        return minimal(results)

    def _closure(self, banned=None):
        known = set()
        changed = True
        while changed:
            changed = False
            for sid in self.facts:
                if sid in known or sid == banned:
                    continue
                for rid in self.reasons:
                    if any(s <= known for s in self.justifications(sid, rid, known | {sid})):
                        known.add(sid)
                        changed = True
                        break
        return known

    def valid(self, lines):
        """lines: [(statement id, reason id)]; every line justified by earlier ones, the goal present."""
        seen = set()
        for sid, rid in lines:
            if sid == "" or rid == "":
                return False
            if not any(s <= seen for s in self.justifications(sid, rid, seen | {sid})):
                return False
            seen.add(sid)
        return self.goal in seen


def minimal(sets):
    sets = set(sets)
    return [s for s in sets if not any(o < s for o in sets)]


def _review_proof(problem):
    public = problem["public"]
    response = public["response"]
    proof = _Proof(public)
    require(proof.goal in proof.closure, "The goal is provable from the givens")
    rows = response["rows"]
    for row in rows:
        require([f["bank"] for f in row["fields"]] == ["statements", "reasons"], "Proof rows are [statement, reason]")
    g = problem["workGrading"]
    require(g["mode"] == "proof" and g["goal"] == proof.goal, "Grading names the goal")
    # Every claim is valid and rests on provable statements; every justification derived here is claimed.
    claims = {sid: {rid: {frozenset(p) for p in sets} for rid, sets in by.items()} for sid, by in g["claims"].items()}
    for sid, by in claims.items():
        for rid, sets in by.items():
            for prem in sets:
                require(any(prem >= m for m in proof.justifications(sid, rid, set(proof.facts))), f"Claim {sid} by {rid} from {sorted(prem)} is not valid")
                require(prem <= proof.closure, f"Claim {sid} by {rid} rests on unprovable statements")
                STATS["claimsChecked"] += 1
    ordered = _key_lines(problem)
    require(proof.valid(ordered), "The key is a valid proof")
    for sid in proof.facts:
        for rid in proof.reasons:
            without = proof._closure(banned=sid)
            # A premise that itself needs this statement can never support it (circular).
            derived = [m for m in proof.justifications(sid, rid, set(proof.facts)) if m <= without]
            claimed = claims.get(sid, {}).get(rid, set())
            for m in derived:
                require(any(c <= m or m <= c for c in claimed), f"Derived justification of {sid} by {rid} from {sorted(m)} is missing from the claims")
            for c in claimed:
                require(any(m <= c for m in derived) or sid in claims, "Claim without derivation")
    if response["mode"] == "order":
        shown = [(r["fields"][0]["given"], r["fields"][1]["given"]) for r in rows]
        require(not proof.valid(shown), "The shown order is not already a valid proof")
    return problem["answer"]


def _key_lines(problem):
    response = problem["public"]["response"]
    answer = json.loads(problem["answer"])
    rows = response["rows"]
    if response["mode"] == "order":
        by_id = {r["id"]: (r["fields"][0]["given"], r["fields"][1]["given"]) for r in rows}
        return [by_id[i] for i in answer]
    out = []
    for r, cells in zip(rows, answer):
        sid = r["fields"][0].get("given", cells[0])
        rid = r["fields"][1].get("given", cells[1])
        out.append((sid, rid))
    return out


# ======================================================================

def review_problem(problem):
    t = problem["public"]["templateId"]
    require(t in SUPPORTED, f"Unsupported template {t}")
    STATS["cases"] += 1
    if t in PROOFS:
        return _review_proof(problem)
    return _review_steps(problem)


def _fixture(template, prompt, rows, answer, grading, mode="build"):
    return {"public": {"templateId": template, "prompt": prompt, "response": {"kind": "structured-work", "label": "Your work", "layout": "steps", "mode": mode, "banks": [], "rows": rows}},
            "answer": json.dumps(answer, separators=(",", ":")), "workGrading": {"mode": "fields", "fields": grading}}


def _row(label, *fields):
    return {"id": "r", "label": label, "fields": list(fields)}


EXPR = {"kind": "expression", "label": "Expression", "variables": ["x"], "powers": True, "maxLength": 12}
NUMBER = {"kind": "number", "label": "Coefficient"}


def _rejects(problem, why):
    try:
        review_problem(problem)
    except (ValueError, KeyError, TypeError, ZeroDivisionError, AttributeError, IndexError):
        return
    raise ValueError(f"Self-test mutation accepted: {why}")


def self_test():
    prompt = "Multiply $(x+5)(2x-1)$ and write the product in standard form. Enter each step."
    rows = [_row("Product of the first terms", EXPR), _row("Product of the outer terms", EXPR), _row("Product of the inner terms", EXPR),
            _row("Coefficients of $x^2$ and $x$ in the product", dict(NUMBER, unit="x²"), dict(NUMBER, unit="x")), _row("Constant term of the product", NUMBER)]
    rules = [[{"kind": "expression", "value": "2x^2", "match": "identity", "expanded": True}], [{"kind": "expression", "value": "-x", "match": "identity", "expanded": True}],
             [{"kind": "expression", "value": "10x", "match": "identity", "expanded": True}], [{"kind": "number", "value": "2"}, {"kind": "number", "value": "9"}],
             [{"kind": "number", "value": "-5"}]]
    good = _fixture("polynomial-product-steps", prompt, rows, [["2x^2"], ["-x"], ["10x"], ["2", "9"], ["-5"]], rules)
    require(review_problem(good) == good["answer"], "polynomial fixture")
    reordered = dict(good, answer=json.dumps([["2x^2"], ["-x"], ["10x"], ["2", "9"], ["-5"]]))
    require(review_problem(reordered) == reordered["answer"], "key spacing does not matter")
    _rejects(dict(good, answer=json.dumps([["2x^2"], ["-x"], ["10x"], ["2", "10"], ["-5"]])), "wrong coefficient")
    _rejects(dict(good, answer=json.dumps([["2x^2"], ["10x"], ["-x"], ["2", "9"], ["-5"]])), "outer and inner swapped is accepted only if equal")
    _rejects(dict(good, answer=json.dumps([["2x^2"], ["-x"], ["10x"], ["2", "9"], ["5"]])), "constant sign")
    loose = json.loads(json.dumps(rules))
    del loose[2][0]["expanded"]
    _rejects(dict(good, workGrading={"mode": "fields", "fields": loose}), "a partial product that accepts an unexpanded product")
    bad_rule = json.loads(json.dumps(rules))
    bad_rule[1][0]["value"] = "x"
    _rejects(dict(good, workGrading={"mode": "fields", "fields": bad_rule}), "rule that credits the wrong expression")
    bad_rule = json.loads(json.dumps(rules))
    bad_rule[3][1]["value"] = "-9"
    _rejects(dict(good, workGrading={"mode": "fields", "fields": bad_rule}), "rule that credits the wrong number")
    line = _fixture("line-from-point-steps", "A line has slope $-\\frac{1}{3}$ and passes through the point $(-6,7)$. Write its equation in slope-intercept form, $y=mx+b$. Enter each step.",
                    [_row("Slope times the $x$-coordinate of $(-6,7)$", NUMBER), _row("The $y$-intercept $b$", NUMBER),
                     _row("Equation of the line in slope-intercept form", {"kind": "expression", "label": "Equation", "variables": ["x", "y"], "relations": True, "powers": False, "maxLength": 24})],
                    [["2"], ["5"], ["y=-x/3+5"]],
                    [[{"kind": "number", "value": "2"}], [{"kind": "number", "value": "5"}], [{"kind": "expression", "value": "y=-x/3+5", "match": "sides"}]])
    require(review_problem(line) == line["answer"], "line fixture")
    _rejects(dict(line, answer=json.dumps([["2"], ["5"], ["y=-x/3+7"]])), "wrong intercept in the equation")
    _rejects(dict(line, answer=json.dumps([["-2"], ["5"], ["y=-x/3+5"]])), "wrong product")
    # A proof fixture: AA with the shared angle, parallel configuration
    proof = _proof_fixture()
    require(review_problem(proof) == proof["answer"], "proof fixture")
    broken = json.loads(json.dumps(proof))
    broken["answer"] = json.dumps([["sa", "ra"], ["sb", "rb"], ["sc", "rb"], ["sd", "rd"], ["se", "ra"]])
    _rejects(broken, "goal justified by Given")
    swapped = json.loads(json.dumps(proof))
    swapped["answer"] = json.dumps([["sb", "rb"], ["sa", "ra"], ["sc", "rb"], ["sd", "rd"], ["se", "re"]])
    _rejects(swapped, "a statement before its premise")
    noprem = json.loads(json.dumps(proof))
    noprem["answer"] = json.dumps([["sa", "ra"], ["sb", "rb"], ["sd", "rd"], ["sc", "rb"], ["se", "re"]])
    _rejects(noprem, "AA before its angle pairs")
    claim = json.loads(json.dumps(proof))
    claim["workGrading"]["claims"]["sd"]["rd"] = [["sb"]]
    _rejects(claim, "AA from one angle pair")


def _proof_fixture():
    def text(label, x, y):
        return {"id": "n" + label, "type": "text", "at": [x, y], "text": label}
    scene = {"v": 1, "title": "t", "elements": [text("A", 2.2, 4.5), text("B", 0, 0), text("C", 6, 0), text("D", 1.1, 2.25), text("E", 4.1, 2.25)]}
    stmts = [("sa", "$\\overline{DE}\\parallel\\overline{BC}$"), ("sb", "$\\angle ADE\\cong\\angle ABC$"), ("sc", "$\\angle AED\\cong\\angle ACB$"),
             ("sd", "$\\triangle ADE\\sim\\triangle ABC$"), ("se", "$\\frac{AD}{AB}=\\frac{AE}{AC}$"), ("sf", "$\\frac{AD}{AB}=\\frac{DE}{BD}$")]
    reasons = [("ra", "Given"), ("rb", "Corresponding angles of parallel lines are congruent"), ("rd", "AA: two pairs of congruent angles make triangles similar"),
               ("re", "Corresponding sides of similar triangles are proportional"), ("rf", "SAS similarity")]
    rows = [{"id": f"r{i}", "fields": [{"kind": "choice", "label": "Statement", "bank": "statements"}, {"kind": "choice", "label": "Reason", "bank": "reasons"}]} for i in range(1, 6)]
    response = {"kind": "structured-work", "label": "Your proof", "layout": "proof", "goal": "$\\frac{AD}{AB}=\\frac{AE}{AC}$", "mode": "build", "rows": rows,
                "banks": [{"id": "statements", "label": "Statement", "options": [{"id": i, "label": l} for i, l in stmts]},
                          {"id": "reasons", "label": "Reason", "options": [{"id": i, "label": l} for i, l in reasons]}]}
    claims = {"sa": {"ra": [[]]}, "sb": {"rb": [["sa"]]}, "sc": {"rb": [["sa"]]}, "sd": {"rd": [["sb", "sc"]]}, "se": {"re": [["sd"]]}}
    return {"public": {"templateId": "similarity-proof-aa", "prompt": "Use the figure. Given: $\\overline{DE}\\parallel\\overline{BC}$. Prove: $\\frac{AD}{AB}=\\frac{AE}{AC}$. Build the proof: choose a statement and a reason for each line.",
                       "response": response, "figure": {"kind": "scene", "scene": scene}},
            "answer": json.dumps([["sa", "ra"], ["sb", "rb"], ["sc", "rb"], ["sd", "rd"], ["se", "re"]], separators=(",", ":")),
            "workGrading": {"mode": "proof", "goal": "se", "claims": claims}}
