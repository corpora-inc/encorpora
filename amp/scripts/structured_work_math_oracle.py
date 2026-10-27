"""Independent review of the structured-work families (structured-work-v1).

Templates: solve-and-justify (linear, inequality, formula, quadratic), two-column
proofs (triangle congruence, transversal angles) and show-work word problems.

Everything is derived from the public payload: the prompt, the figure, the
response's rows, banks and given fields. The answer key, the private
`workGrading` rule, the hint and the explanation are only values under test.

* Derivations: an exact parser for the input syntax (and for the TeX of the
  prompt), exact rational-function arithmetic, and an independent move checker
  (each line follows from the one before by exactly the move its reason
  names). The start is solved independently (linear root, inequality boundary
  and direction, rational quadratic roots, formula rearrangement) and the last
  line must state exactly that solution.
* Proofs: statements are read from their TeX labels; the configuration (points,
  segments, numbered angles) from the figure's coordinates. Each reason is a
  rule written here (SSS/SAS/ASA/AAS with vertex correspondence, CPCTC, vertical
  angles, parallel-line angle pairs, midpoint/bisector/perpendicular
  definitions, parallelogram theorems, linear pairs, substitution). The closure
  of the givens decides which bank statements are provable; every provable
  statement must be true in the figure, and the private claims must equal the
  rule set derived here.
* Show-work: each row's value is computed from the prompt numbers and the row
  label; numbers compare exactly, expressions by exact identity, the inequality
  row side by side.
"""

import collections
import copy
import itertools
import json
import math
import re
from fractions import Fraction as F

SOLVE_JUSTIFY = frozenset({"solve-justify-linear", "solve-justify-inequality", "solve-justify-formula", "solve-justify-quadratic"})
PROOFS = frozenset({"two-column-congruence-proof", "two-column-angle-proof"})
SHOW_WORK = frozenset({"show-work-box-cost", "show-work-percent-count", "show-work-rental-plans"})
SUPPORTED = SOLVE_JUSTIFY | PROOFS | SHOW_WORK
REVIEW_RETURNS_ANSWER = True

STATS = {"cases": 0, "orderKeysWithSeveralValidOrders": 0, "claimsCompared": 0, "distractorsRejected": 0, "stepsChecked": 0}


def require(condition, message):
    # Not assert: python -O must not disable review gates.
    if not condition:
        raise ValueError(message)


# ======================================================================
# Exact polynomials and rational functions
# A polynomial is {monomial: Fraction}; a monomial a sorted tuple of
# (letter, exponent). A rational function is a pair (numerator, denominator).

ONE_MONO = ()


def _pclean(p):
    return {m: c for m, c in p.items() if c != 0}


def _padd(p, q, sign=1):
    r = dict(p)
    for m, c in q.items():
        r[m] = r.get(m, 0) + sign * c
    return _pclean(r)


def _mono_mul(a, b):
    counts = dict(a)
    for v, e in b:
        counts[v] = counts.get(v, 0) + e
    return tuple(sorted((v, e) for v, e in counts.items() if e))


def _pmul(p, q):
    r = {}
    for m1, c1 in p.items():
        for m2, c2 in q.items():
            m = _mono_mul(m1, m2)
            r[m] = r.get(m, 0) + c1 * c2
    return _pclean(r)


def _pconst(c):
    return _pclean({ONE_MONO: F(c)})


def _is_const_poly(p):
    return all(m == ONE_MONO for m in p)


def _rf(num, den=None):
    den = {ONE_MONO: F(1)} if den is None else den
    require(den, "Division by zero")
    if _is_const_poly(den):
        c = den[ONE_MONO]
        return ({m: v / c for m, v in num.items()}, {ONE_MONO: F(1)})
    if num and set(num) == set(den):
        # a constant multiple of the denominator
        m0 = next(iter(den))
        c = num[m0] / den[m0]
        if all(num[m] == c * den[m] for m in den):
            return (_pconst(c), {ONE_MONO: F(1)})
    if len(den) == 1:
        (dm, dc), = den.items()
        # cancel a monomial denominator against a numerator divisible by it
        dcount = dict(dm)
        if num and all(all(dict(m).get(v, 0) >= e for v, e in dcount.items()) for m in num):
            out = {}
            for m, c in num.items():
                counts = dict(m)
                for v, e in dcount.items():
                    counts[v] -= e
                out[tuple(sorted((v, e) for v, e in counts.items() if e))] = c / dc
            return (_pclean(out), {ONE_MONO: F(1)})
    return (num, den)


def _radd(a, b, sign=1):
    return _rf(_padd(_pmul(a[0], b[1]), _pmul(b[0], a[1]), sign), _pmul(a[1], b[1]))


def _rmul(a, b):
    return _rf(_pmul(a[0], b[0]), _pmul(a[1], b[1]))


def _rdiv(a, b):
    require(b[0], "Division by zero")
    return _rf(_pmul(a[0], b[1]), _pmul(a[1], b[0]))


def _rneg(a):
    return ({m: -c for m, c in a[0].items()}, a[1])


def _req(a, b):
    return not _padd(_pmul(a[0], b[1]), _pmul(b[0], a[1]), -1)


def _rzero(a):
    return not a[0]


def _rconst(a):
    if _is_const_poly(a[0]) and _is_const_poly(a[1]):
        return a[0].get(ONE_MONO, F(0)) / a[1][ONE_MONO]
    return None


def _rletters(a):
    return {v for p in a for m in p for v, _ in m}


def _rconstval(c):
    return (_pconst(c), {ONE_MONO: F(1)})


def _rvar(v):
    return ({((v, 1),): F(1)}, {ONE_MONO: F(1)})


def _rpow(a, n):
    require(n.denominator == 1 and abs(n) <= 12, "Exponent must be a small integer")
    n = int(n)
    out = _rconstval(1)
    for _ in range(abs(n)):
        out = _rmul(out, a)
    return _rdiv(_rconstval(1), out) if n < 0 else out


# ======================================================================
# The input syntax: numbers, single letters, + - * / ^ ( ), implicit
# multiplication, relations, and " or " between relations. Left to right:
# a/bc is (a/b)c.

TOKEN = re.compile(r"\s*(\d+(?:\.\d+)?|[A-Za-z]|<=|>=|[-+*/^()=<>])")
RELATIONS = ("<=", ">=", "=", "<", ">")
FLIP = {"=": "=", "<": ">", ">": "<", "<=": ">=", ">=": "<="}


def _tokens(text):
    out, at = [], 0
    text = text.rstrip()
    while at < len(text):
        m = TOKEN.match(text, at)
        require(m is not None, f"Unreadable input {text!r}")
        out.append(m[1])
        at = m.end()
    return out


class _Parser:
    def __init__(self, tokens, source):
        self.t, self.i, self.src = tokens, 0, source

    def peek(self):
        return self.t[self.i] if self.i < len(self.t) else None

    def take(self, want=None):
        tok = self.peek()
        require(tok is not None, f"Truncated input {self.src!r}")
        require(want is None or tok == want, f"Expected {want} in {self.src!r}")
        self.i += 1
        return tok

    def expr(self):
        tok = self.peek()
        if tok in ("-", "+"):
            self.take()
            node = self.term()
            if tok == "-":
                node = ("neg", node)
        else:
            node = self.term()
        while self.peek() in ("+", "-"):
            op = self.take()
            node = ("add" if op == "+" else "sub", node, self.term())
        return node

    def term(self):
        node = self.unary()
        while True:
            tok = self.peek()
            if tok == "*":
                self.take()
                node = ("mul", node, self.unary())
            elif tok == "/":
                self.take()
                node = ("div", node, self.unary())
            elif tok is not None and (tok == "(" or re.fullmatch(r"[A-Za-z]", tok)):
                node = ("mul", node, self.power())
            elif tok is not None and tok[0].isdigit():
                raise ValueError(f"A number cannot follow a factor in {self.src!r}")
            else:
                return node

    def unary(self):
        if self.peek() == "-":
            self.take()
            return ("neg", self.unary())
        return self.power()

    def power(self):
        base = self.atom()
        if self.peek() == "^":
            self.take()
            if self.peek() == "-":
                self.take()
                return ("pow", base, ("neg", self.atom()))
            return ("pow", base, self.atom())
        return base

    def atom(self):
        tok = self.take()
        if tok[0].isdigit():
            require(tok == "0" or not re.match(r"0\d", tok), f"Leading zero in {self.src!r}")
            return ("num", F(tok))
        if re.fullmatch(r"[A-Za-z]", tok):
            return ("var", tok)
        require(tok == "(", f"Unexpected {tok!r} in {self.src!r}")
        inner = self.expr()
        self.take(")")
        return ("grp", inner)


def _parse_expression(text):
    p = _Parser(_tokens(text), text)
    node = p.expr()
    require(p.peek() is None, f"Trailing input in {text!r}")
    return node


def _value(node):
    kind = node[0]
    if kind == "num":
        return _rconstval(node[1])
    if kind == "var":
        return _rvar(node[1])
    if kind == "grp":
        return _value(node[1])
    if kind == "neg":
        return _rneg(_value(node[1]))
    if kind == "add":
        return _radd(_value(node[1]), _value(node[2]))
    if kind == "sub":
        return _radd(_value(node[1]), _value(node[2]), -1)
    if kind == "mul":
        return _rmul(_value(node[1]), _value(node[2]))
    if kind == "div":
        return _rdiv(_value(node[1]), _value(node[2]))
    if kind == "pow":
        n = _rconst(_value(node[2]))
        require(n is not None, "Exponent must be a number")
        return _rpow(_value(node[1]), n)
    raise ValueError(f"Unknown node {kind}")


def _strip(node):
    while node[0] == "grp":
        node = node[1]
    return node


def _terms(node):
    node = _strip(node)
    if node[0] == "add":
        return _terms(node[1]) + _terms(node[2])
    if node[0] == "sub":
        return _terms(node[1]) + [("neg", node[2])]
    return [node]


def _is_sum(node):
    return _strip(node)[0] in ("add", "sub")


def _products_of_sums(node):
    kind = node[0]
    if kind in ("num", "var"):
        return 0
    count = sum(_products_of_sums(child) for child in node[1:] if isinstance(child, tuple))
    if kind == "mul" and (_is_sum(node[1]) or _is_sum(node[2])):
        count += 1
    elif kind == "neg" and _is_sum(node[1]):
        count += 1
    elif kind == "div" and _is_sum(node[1]):
        count += 1
    return count


def _factors(node):
    node = _strip(node)
    if node[0] == "mul":
        return _factors(node[1]) + _factors(node[2])
    return [node]


def _letters(node):
    if node[0] == "var":
        return {node[1]}
    return set().union(*[_letters(c) for c in node[1:] if isinstance(c, tuple)]) if node[0] != "num" else set()


def _has_power(node):
    if node[0] == "pow":
        return True
    return any(_has_power(c) for c in node[1:] if isinstance(c, tuple))


class _Part:
    def __init__(self, lhs, rel, rhs, text):
        self.lhs, self.rel, self.rhs, self.text = lhs, rel, rhs, text
        self.lv, self.rv = _value(lhs), _value(rhs)


def _parse_line(text, compound=True):
    """A line: one relation, or relations joined by ' or '."""
    pieces = text.split(" or ")
    require(compound or len(pieces) == 1, f"A compound line is not allowed here: {text!r}")
    parts = []
    for piece in pieces:
        toks = _tokens(piece)
        rels = [i for i, t in enumerate(toks) if t in RELATIONS]
        require(len(rels) == 1, f"Each part needs exactly one relation: {piece!r}")
        i = rels[0]
        require(0 < i < len(toks) - 1, f"Empty side in {piece!r}")
        lp, rp = _Parser(toks[:i], piece), _Parser(toks[i + 1:], piece)
        lhs, rhs = lp.expr(), rp.expr()
        require(lp.peek() is None and rp.peek() is None, f"Trailing input in {piece!r}")
        parts.append(_Part(lhs, toks[i], rhs, piece.replace(" ", "")))
    return parts


def _tex_to_input(tex):
    s = tex.strip()
    require(s.startswith("$") and s.endswith("$") and s.count("$") == 2, f"Expected one math span: {tex!r}")
    s = s[1:-1]
    s = s.replace("\\left", "").replace("\\right", "").replace("−", "-")
    s = re.sub(r"\\ \\text\{or\}\\ ", " or ", s)
    s = re.sub(r"\\text\{ or \}", " or ", s)
    for name, op in (("\\geq", ">="), ("\\leq", "<="), ("\\ge", ">="), ("\\le", "<="), ("\\cdot", "*"), ("\\times", "*")):
        s = s.replace(name, op)
    frac = re.compile(r"\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}")
    while frac.search(s):
        s = frac.sub(r"((\1)/(\2))", s)
    s = re.sub(r"\^\{([^{}]*)\}", r"^(\1)", s)
    require("\\" not in s and "{" not in s, f"Unread TeX in {tex!r}")
    return s


# ======================================================================
# Derivations

MOVE_OF_REASON = {
    "Addition property of equality": "add", "Addition property of inequality": "add",
    "Subtraction property of equality": "subtract", "Subtraction property of inequality": "subtract",
    "Multiplication property of equality": "multiply", "Multiplication property of inequality": "multiply",
    "Division property of equality": "divide", "Division property of inequality": "divide",
    "Distributive property": "distribute", "Combine like terms": "combine", "Commutative property": "commute",
    "Symmetric property of equality": "symmetric", "Factoring": "factor", "Zero-product property": "zero-product",
}


def _coefficient_signs(rf, positive):
    num, den = rf
    signs = {c > 0 for c in num.values()}
    if not _is_const_poly(den):
        if len(den) != 1:
            return {True, False}
        (dm, dc), = den.items()
        if not all(v in positive for v, _ in dm):
            return {True, False}
        if dc < 0:
            signs = {not s for s in signs}
    return signs


def _monomial_factor(rf, ctx):
    """The sign of k when k is an allowed nonzero multiplier, else None."""
    if _rzero(rf):
        return None
    c = _rconst(rf)
    if c is not None:
        return 1 if c > 0 else -1
    if not ctx["formula"]:
        return None
    num, den = rf
    if len(num) != 1 or len(den) != 1:
        return None
    (nm, nc), = num.items()
    (dm, dc), = den.items()
    if not all(v in ctx["positive"] for v, _ in nm + dm):
        return None
    return 1 if nc * dc > 0 else -1


def _single_step(prev, cur, move, ctx, compound):
    same_values = _req(prev.lv, cur.lv) and _req(prev.rv, cur.rv)
    if move in ("add", "subtract"):
        if cur.rel != prev.rel:
            return False
        c = _radd(cur.lv, prev.lv, -1)
        if _rzero(c) or not _req(c, _radd(cur.rv, prev.rv, -1)):
            return False
        if compound:
            return True
        signs = _coefficient_signs(c, ctx["positive"])
        return (True in signs) if move == "add" else (False in signs)
    if move in ("multiply", "divide"):
        if _rzero(prev.lv) and _rzero(prev.rv):
            return False
        k = _rdiv(cur.lv, prev.lv) if not _rzero(prev.lv) else _rdiv(cur.rv, prev.rv)
        sign = _monomial_factor(k, ctx)
        if sign is None or _rconst(k) == 1:
            return False
        if not (_req(cur.lv, _rmul(k, prev.lv)) and _req(cur.rv, _rmul(k, prev.rv))):
            return False
        return cur.rel == (prev.rel if sign > 0 else FLIP[prev.rel])
    if move == "symmetric":
        return cur.rel == FLIP[prev.rel] and _req(cur.lv, prev.rv) and _req(cur.rv, prev.lv) and cur.text != prev.text
    if cur.rel != prev.rel or not same_values:
        return False
    before = _products_of_sums(prev.lhs) + _products_of_sums(prev.rhs)
    after = _products_of_sums(cur.lhs) + _products_of_sums(cur.rhs)
    if move == "distribute":
        return after < before
    if move == "combine":
        return after == before and len(_terms(cur.lhs)) + len(_terms(cur.rhs)) < len(_terms(prev.lhs)) + len(_terms(prev.rhs))
    if move == "commute":
        return (after == before and cur.text != prev.text and len(_terms(cur.lhs)) == len(_terms(prev.lhs))
                and len(_terms(cur.rhs)) == len(_terms(prev.rhs)))
    if move == "factor":
        for old, new in ((prev.lhs, cur.lhs), (prev.rhs, cur.rhs)):
            fs = _factors(new)
            if len(_terms(old)) > 1 and len(fs) > 1 and any(_is_sum(f) for f in fs):
                return True
        return False
    return False


def _line_step(prev, cur, move, ctx):
    """True when line `cur` follows from `prev` by exactly the named move."""
    if move == "zero-product":
        if len(prev) != 1 or len(cur) < 2 or prev[0].rel != "=":
            return False
        p = prev[0]
        product = p.lhs if _rzero(p.rv) else p.rhs if _rzero(p.lv) else None
        if product is None:
            return False
        factors = [f for f in _factors(product) if _rconst(_value(f)) is None]
        if len(factors) != len(cur) or len(factors) < 2:
            return False
        values = [_value(f) for f in factors]
        used = set()
        for part in cur:
            if part.rel != "=":
                return False
            side = part.lv if _rzero(part.rv) else part.rv if _rzero(part.lv) else None
            if side is None:
                return False
            hit = next((i for i, v in enumerate(values) if i not in used and _req(v, side)), None)
            if hit is None:
                return False
            used.add(hit)
        return True
    if len(prev) != len(cur):
        return False
    if len(cur) == 1:
        return _single_step(prev[0], cur[0], move, ctx, False)
    changed = False
    for a, b in zip(prev, cur):
        if a.text == b.text:
            continue
        if not _single_step(a, b, move, ctx, True):
            return False
        changed = True
    return changed


def _solve_start(start, ctx):
    """Independent solution of the start line: ('roots', set) for equations,
    ('inequality', rel, bound) or ('formula', rf)."""
    require(len(start) == 1, "The start is one relation")
    s = start[0]
    v = ctx["variable"]
    d = _radd(s.lv, s.rv, -1)
    num = d[0]
    if ctx["kind"] == "formula":
        require(s.rel == "=", "A formula is an equation")
        a, b = {}, {}
        for m, c in num.items():
            e = dict(m).get(v, 0)
            require(e <= 1, "The formula must be linear in the target letter")
            rest = tuple((x, y) for x, y in m if x != v)
            (a if e == 1 else b)[rest] = (a if e == 1 else b).get(rest, 0) + c
        a, b = _pclean(a), _pclean(b)
        require(a, "The target letter must appear")
        require(v not in _rletters(d[1:]), "Target letter in a denominator")
        return ("formula", _rdiv(_rneg((b, {ONE_MONO: F(1)})), (a, {ONE_MONO: F(1)})))
    require(_is_const_poly(d[1]), "The start must be polynomial")
    require(_rletters(d) <= {v}, "Only the variable may appear")
    coeffs = {}
    for m, c in num.items():
        coeffs[dict(m).get(v, 0)] = c
    degree = max(coeffs) if coeffs else 0
    if ctx["kind"] == "quadratic":
        require(degree == 2 and s.rel == "=", "A quadratic equation is expected")
        a, b, c = coeffs.get(2, F(0)), coeffs.get(1, F(0)), coeffs.get(0, F(0))
        disc = b * b - 4 * a * c
        require(disc > 0, "Two real roots expected")
        rn, rd = math.isqrt(disc.numerator), math.isqrt(disc.denominator)
        require(rn * rn == disc.numerator and rd * rd == disc.denominator, "Roots must be rational to factor")
        root = F(rn, rd)
        return ("roots", frozenset({(-b + root) / (2 * a), (-b - root) / (2 * a)}))
    require(degree == 1, "A linear start is expected")
    a, b = coeffs[1], coeffs.get(0, F(0))
    bound = -b / a
    if ctx["kind"] == "inequality":
        require(s.rel != "=", "An inequality is expected")
        return ("inequality", s.rel if a > 0 else FLIP[s.rel], bound)
    require(s.rel == "=", "An equation is expected")
    return ("roots", frozenset({bound}))


def _final_matches(line, solution, ctx):
    v = ctx["variable"]
    readings = []
    for part in line:
        if _strip(part.lhs) == ("var", v) and v not in _letters(part.rhs):
            readings.append((part.rel, part.rv))
        elif _strip(part.rhs) == ("var", v) and v not in _letters(part.lhs):
            readings.append((FLIP[part.rel], part.lv))
        else:
            return False
    kind = solution[0]
    if kind == "formula":
        return len(readings) == 1 and readings[0][0] == "=" and _req(readings[0][1], solution[1])
    if kind == "inequality":
        if len(readings) != 1:
            return False
        rel, value = readings[0]
        return rel == solution[1] and _rconst(value) == solution[2]
    values = [_rconst(value) for rel, value in readings]
    return all(rel == "=" for rel, _ in readings) and None not in values and len(set(values)) == len(values) and set(values) == solution[1]


def _check_derivation(start, steps, ctx):
    """steps: list of (line parts, move). Raise unless valid and ending at the solution."""
    require(steps, "A derivation needs at least one line")
    prev = start
    for i, (line, move) in enumerate(steps, 1):
        require(move is not None, f"Line {i} has no reason")
        require(_line_step(prev, line, move, ctx), f"Line {i} ({'/'.join(p.text for p in line)}) does not follow by {move}")
        STATS["stepsChecked"] += 1
        prev = line
    require(_final_matches(prev, ctx["solution"], ctx), f"The last line {[p.text for p in prev]} is not the solution")


def _count_valid_orders(start, rows, ctx, cap=2):
    """Number of orders of the given rows that form a valid derivation (capped)."""
    found = [0]

    def walk(prev, remaining):
        if found[0] >= cap:
            return
        if not remaining:
            if _final_matches(prev, ctx["solution"], ctx):
                found[0] += 1
            return
        for i, (line, move) in enumerate(remaining):
            if move is not None and _line_step(prev, line, move, ctx):
                walk(line, remaining[:i] + remaining[i + 1:])

    walk(start, list(rows))
    return found[0]


FORMULA_SIGNED = ("Celsius", "Fahrenheit", "temperature")


def _derivation_context(public):
    template = public["templateId"]
    response = public["response"]
    prompt = public["prompt"]
    kind = template.replace("solve-justify-", "")
    require(response.get("start"), "A derivation shows its start line")
    start = _parse_line(_tex_to_input(response["start"]), compound=False)
    spans = [s for s in re.findall(r"\$[^$]+\$", prompt) if re.search(r"=|<|>|\\[lg]e", s)]
    require(len(spans) == 1, f"The prompt states one relation: {prompt!r}")
    shown = _parse_line(_tex_to_input(spans[0]), compound=False)
    require(shown[0].rel == start[0].rel and _req(shown[0].lv, start[0].lv) and _req(shown[0].rv, start[0].rv),
            "The start line differs from the prompt")
    if kind == "formula":
        m = re.search(r"Solve the formula for \$([A-Za-z])\$\.", prompt)
        require(m, "The formula prompt names its target letter")
        variable = m[1]
        letters = _rletters(start[0].lv) | _rletters(start[0].rv)
        # Measurements (lengths, areas, money, rates, times) are positive; a
        # temperature scale is not.
        positive = set() if any(w in prompt for w in FORMULA_SIGNED) else letters
    else:
        letters = _rletters(start[0].lv) | _rletters(start[0].rv)
        require(len(letters) == 1, "One variable expected")
        variable, positive = next(iter(letters)), set()
        require(prompt.startswith("Solve $"), "Equation prompt")
        if kind == "quadratic":
            require("by factoring" in prompt, "The quadratic prompt asks for factoring")
    ctx = {"kind": kind, "variable": variable, "positive": positive, "formula": kind == "formula"}
    ctx["solution"] = _solve_start(start, ctx)
    reasons = {b["id"]: b for b in response["banks"]}["reasons"]
    word = "inequality" if kind == "inequality" else "equality"
    moves = {}
    for option in reasons["options"]:
        label = option["label"]
        require(label in MOVE_OF_REASON, f"Unknown reason {label!r}")
        require(not label.endswith("equality") or label.endswith(" of " + word), f"Reason {label!r} names the wrong relation")
        moves[option["id"]] = MOVE_OF_REASON[label]
    ctx["moves"] = moves
    return start, ctx


def _solution_text(solution, variable):
    if solution[0] == "roots":
        return " or ".join(f"{variable}={_num_text(r)}" for r in sorted(solution[1]))
    if solution[0] == "inequality":
        return f"{variable}{solution[1]}{_num_text(solution[2])}"
    return f"{variable}=" + _rf_text(solution[1])


def _num_text(x):
    x = F(x)
    return str(x.numerator) if x.denominator == 1 else f"{x.numerator}/{x.denominator}"


def _rf_text(rf):
    def poly(p):
        return "+".join(f"{_num_text(c)}" + "".join(f"{v}^{e}" if e > 1 else v for v, e in m) for m, c in sorted(p.items())) or "0"
    return f"({poly(rf[0])})/({poly(rf[1])})"


# ======================================================================
# Transport (shared)

def _walk_keys(value):
    if isinstance(value, dict):
        for k, v in value.items():
            yield k
            yield from _walk_keys(v)
    elif isinstance(value, list):
        for v in value:
            yield from _walk_keys(v)


def _check_public(problem):
    public = problem["public"]
    require(public["templateId"] in SUPPORTED, "Unsupported template")
    keys = set(_walk_keys(public))
    require(not keys & {"answer", "workGrading", "explanation", "hint", "solution", "claims", "variant"},
            f"Private data in the public payload: {sorted(keys & {'answer', 'workGrading', 'explanation', 'hint', 'solution', 'claims'})}")
    response = public["response"]
    require(response["kind"] == "structured-work", "structured-work response expected")
    require(response["mode"] in ("build", "fill", "order"), "Unknown mode")
    rows = response["rows"]
    require(rows and len({r["id"] for r in rows}) == len(rows), "Row ids are distinct")
    banks = {b["id"]: b for b in response["banks"]}
    for b in response["banks"]:
        require(len({o["id"] for o in b["options"]}) == len(b["options"]), f"Bank {b['id']} ids distinct")
        require(len({o["label"] for o in b["options"]}) == len(b["options"]), f"Bank {b['id']} labels distinct")
    for row in rows:
        for field in row["fields"]:
            require(field["kind"] in ("number", "expression", "choice"), "Unknown field kind")
            if field["kind"] == "choice":
                require(field.get("bank") in banks, "A choice field names its bank")
                if "given" in field:
                    require(field["given"] in {o["id"] for o in banks[field["bank"]]["options"]}, "Given option exists")
            if response["mode"] == "build":
                require("given" not in field, "Build mode shows no values")
            if response["mode"] == "order":
                require("given" in field, "Order mode shows every value")
    if response["mode"] == "order":
        require([r["id"] for r in rows] == [f"r{i}" for i in range(1, len(rows) + 1)], "Order rows are r1..rn")
    if "open" in response:
        require(response["mode"] == "build" and len(rows) == 1, "An open response has one row shape")
    if response["mode"] == "fill":
        require(any("given" in f for r in rows for f in r["fields"]), "Fill mode shows some values")
        require(any("given" not in f for r in rows for f in r["fields"]), "Fill mode leaves some values")
    return public, response, banks


def _key_rows(problem):
    """The complete rows (one value per field) the key describes."""
    public = problem["public"]
    response = public["response"]
    key = problem["answer"]
    require(isinstance(key, str) and " " not in key.replace(" or ", ""), "The key is compact JSON")
    data = json.loads(key)
    require(json.dumps(data, separators=(",", ":"), ensure_ascii=False) == key, "The key is canonical JSON")
    rows = response["rows"]
    if response["mode"] == "order":
        require(isinstance(data, list) and sorted(data) == sorted(r["id"] for r in rows) and len(set(data)) == len(data),
                "An order key is a permutation of the row ids")
        by_id = {r["id"]: r for r in rows}
        return [[f["given"] for f in by_id[i]["fields"]] for i in data]
    require(isinstance(data, list) and all(isinstance(r, list) for r in data), "A key is a list of rows")
    if "open" in response:
        require(1 <= len(data) <= response["open"]["max"], "Open rows within the maximum")
        shapes = [rows[0]] * len(data)
    else:
        require(len(data) == len(rows), "One key row per row")
        shapes = rows
    out = []
    for shape, entered in zip(shapes, data):
        require(len(entered) == len(shape["fields"]), "One key value per field")
        values = []
        for field, value in zip(shape["fields"], entered):
            require(isinstance(value, str), "Key values are strings")
            if "given" in field:
                require(value == "", "A given field's key entry is empty")
                values.append(field["given"])
            else:
                require(value != "", "Every entered field has a value")
                require(value == value.strip() and not re.search(r"[−×≤≥]", value), f"Non-canonical value {value!r}")
                if field["kind"] == "expression":
                    require(len(value) <= field.get("maxLength", 10 ** 6), f"{value!r} exceeds the field length")
                values.append(value)
        out.append(values)
    return out


def _check_line_field(field, text):
    line = _parse_line(text, compound=bool(field.get("compound")))
    letters = set().union(*[_letters(p.lhs) | _letters(p.rhs) for p in line])
    require(letters <= set(field.get("variables", [])), f"Letters outside the field in {text!r}")
    require(field.get("powers") or not any(_has_power(p.lhs) or _has_power(p.rhs) for p in line), f"Powers not allowed in {text!r}")
    require(field.get("relations"), "Line fields take relations")
    return line


# ======================================================================
# solve-and-justify review

def _review_derivation(problem):
    public, response, banks = _check_public(problem)
    start, ctx = _derivation_context(public)
    require(response["layout"] == "steps", "Derivations use the steps layout")
    require(set(banks) == {"reasons"}, "One reason bank")
    shape = response["rows"][0]["fields"]
    require([f["kind"] for f in shape] == ["expression", "choice"], "Rows are [line, reason]")
    for row in response["rows"]:
        require([f["kind"] for f in row["fields"]] == ["expression", "choice"], "Rows are [line, reason]")
        lf = row["fields"][0]
        require(set(lf.get("variables", [])) == (_rletters(start[0].lv) | _rletters(start[0].rv)), "Line variables are the start's letters")
        require(bool(lf.get("compound")) == (ctx["kind"] == "quadratic") and bool(lf.get("powers")) == (ctx["kind"] == "quadratic"),
                "Only quadratic lines take compounds and powers")
    rows = _key_rows(problem)
    steps = []
    for (shape_row, values) in zip(response["rows"] if "open" not in response else [response["rows"][0]] * len(rows), rows):
        line = _check_line_field(shape_row["fields"][0], values[0])
        require(values[1] in ctx["moves"], f"Unknown reason {values[1]!r}")
        steps.append((line, ctx["moves"][values[1]]))
    _check_derivation(start, steps, ctx)
    if response["mode"] == "order":
        rows_given = [(_parse_line(r["fields"][0]["given"]), ctx["moves"][r["fields"][1]["given"]]) for r in response["rows"]]
        if _count_valid_orders(start, rows_given, ctx) > 1:
            STATS["orderKeysWithSeveralValidOrders"] += 1
    _check_derivation_grading(problem, start, ctx)
    _check_derivation_hint_and_explanation(problem, start, ctx)
    return problem["answer"]


def _check_derivation_grading(problem, start, ctx):
    g = problem["workGrading"]
    require(g["mode"] == "derivation", "Derivation grading")
    require(g["variable"] == ctx["variable"], "Grading names the variable")
    gs = _parse_line(g["start"], compound=False)
    require(gs[0].rel == start[0].rel and _req(gs[0].lv, start[0].lv) and _req(gs[0].rv, start[0].rv), "Grading start differs")
    require(g["moves"] == ctx["moves"], f"Grading moves {g['moves']} differ from the reason labels")
    sol = ctx["solution"]
    if sol[0] == "roots":
        require(sorted(F(x) for x in g["solution"]) == sorted(sol[1]) and len(g["solution"]) == len(sol[1]), f"Grading roots {g['solution']} differ")
    elif sol[0] == "inequality":
        require(len(g["solution"]) == 1 and _final_matches(_parse_line(g["solution"][0], compound=False), sol, ctx), "Grading inequality differs")
    else:
        require(len(g["solution"]) == 1 and _req(_value(_parse_expression(g["solution"][0])), sol[1]), "Grading formula differs")
        require(set(g.get("positive", [])) == ctx["positive"], f"Grading positive letters {g.get('positive')} differ from {sorted(ctx['positive'])}")
    if not ctx["formula"]:
        require(not g.get("positive"), "Only formulas assume positive letters")
    line = g["line"]
    field = problem["public"]["response"]["rows"][0]["fields"][0]
    require(line.get("variables") == field.get("variables") and line.get("relations") is True and line.get("requireRelation") is True,
            "Grading line rule matches the field")
    require(bool(line.get("compound")) == bool(field.get("compound")) and bool(line.get("powers")) == bool(field.get("powers")), "Grading line flags")


EXPLANATION_STEP = re.compile(r"^(\$[^$]+\$) \u2014 (.+)\.$")


def _check_derivation_hint_and_explanation(problem, start, ctx):
    labels = {o["label"]: o["id"] for o in problem["public"]["response"]["banks"][0]["options"]}
    lines = problem["explanation"]
    require(lines and lines[0] == f"Start from {problem['public']['response']['start']}.", "The explanation starts from the start line")
    steps = []
    for text in lines[1:]:
        m = EXPLANATION_STEP.match(text)
        if m:
            require(m[2] in labels, f"Explanation reason {m[2]!r} not in the bank")
            steps.append((_parse_line(_tex_to_input(m[1])), ctx["moves"][labels[m[2]]]))
    _check_derivation(start, steps, ctx)
    # The hint suggests a first move; it never states the solution line.
    hint = problem["hint"]
    for span in re.findall(r"\$[^$]+\$", hint):
        try:
            line = _parse_line(_tex_to_input(span))
        except ValueError:
            continue
        require(not _final_matches(line, ctx["solution"], ctx), f"The hint states the solution: {span}")


# ======================================================================
# Two-column proofs: geometry from the figure

def _round(x):
    # Figure coordinates carry about three decimals; keys compare to 1e-4.
    return round(x + 0.0, 4) + 0.0


def _unit(dx, dy):
    n = math.hypot(dx, dy)
    require(n > 1e-9, "Degenerate direction")
    return (_round(dx / n), _round(dy / n))


def _close(a, b, tol=1e-6):
    return abs(a - b) <= tol


class _Scene:
    def __init__(self, figure):
        require(figure and figure.get("kind") == "scene", "A proof needs its figure")
        els = figure["scene"]["elements"]
        self.points = {}
        for e in els:
            if e["type"] == "text" and re.fullmatch(r"[A-Z]", e["text"]):
                require(e["text"] not in self.points, f"Point {e['text']} labeled twice")
                self.points[e["text"]] = tuple(e["at"])
        self.segments = [(tuple(e["from"]), tuple(e["to"])) for e in els if e["type"] == "segment"]
        self.title = figure["scene"].get("title", "")

    def p(self, name):
        require(name in self.points, f"Point {name} is not in the figure")
        return self.points[name]

    def on_drawn(self, a, b):
        """Segment ab lies along a drawn segment."""
        pa, pb = self.p(a), self.p(b)
        for s, t in self.segments:
            if _on_segment(pa, s, t) and _on_segment(pb, s, t):
                return True
        return False

    def dist(self, a, b):
        pa, pb = self.p(a), self.p(b)
        return math.hypot(pa[0] - pb[0], pa[1] - pb[1])

    def ray(self, v, a):
        pv, pa = self.p(v), self.p(a)
        return _unit(pa[0] - pv[0], pa[1] - pv[1])

    def angle(self, a, v, b):
        pv = self.p(v)
        r1, r2 = self.ray(v, a), self.ray(v, b)
        require(r1 != r2, f"Degenerate angle {a}{v}{b}")
        return ((_round(pv[0]), _round(pv[1])), frozenset({r1, r2}))

    def line(self, a, b):
        pa, pb = self.p(a), self.p(b)
        return _line_key(pa, (pb[0] - pa[0], pb[1] - pa[1]))


def _on_segment(p, s, t):
    cross = (t[0] - s[0]) * (p[1] - s[1]) - (t[1] - s[1]) * (p[0] - s[0])
    if abs(cross) > 1e-6:
        return False
    return min(s[0], t[0]) - 1e-9 <= p[0] <= max(s[0], t[0]) + 1e-9 and min(s[1], t[1]) - 1e-9 <= p[1] <= max(s[1], t[1]) + 1e-9


def _line_key(p, d):
    ux, uy = _unit(*d)
    if ux < -1e-9 or (abs(ux) <= 1e-9 and uy < 0):
        ux, uy = -ux, -uy
    return (_round(ux), _round(uy), _round(ux * p[1] - uy * p[0]))


def _angle_measure(angle):
    r1, r2 = tuple(angle[1])
    return math.degrees(math.acos(max(-1.0, min(1.0, r1[0] * r2[0] + r1[1] * r2[1]))))


def _neg(d):
    return (_round(-d[0]), _round(-d[1]))


# ---------------------------------------------------------------- statements

SEG = r"\\overline\{([A-Z])([A-Z])\}"
ANG = r"\\angle ([A-Z])([A-Z])([A-Z])"


def _seg(a, b):
    require(a != b, "Degenerate segment")
    return frozenset({a, b})


def _read_congruence_statement(label, scene):
    """A statement label as a set of facts plus a semantic key."""
    m = re.fullmatch(r"\$(.+)\$", label)
    body = m[1] if m else None
    if body is not None and "$" not in body:
        parts = body.split("\\text{ and }")
        facts = []
        for part in parts:
            sm = re.fullmatch(SEG + r"\\cong" + SEG, part)
            am = re.fullmatch(ANG + r"\\cong" + ANG, part)
            tm = re.fullmatch(r"\\triangle ([A-Z]{3})\\cong\\triangle ([A-Z]{3})", part)
            pm = re.fullmatch(SEG + r"\\parallel" + SEG, part)
            qm = re.fullmatch(SEG + r"\\perp" + SEG, part)
            if sm:
                s1, s2 = _seg(sm[1], sm[2]), _seg(sm[3], sm[4])
                require(scene.on_drawn(sm[1], sm[2]) and scene.on_drawn(sm[3], sm[4]), f"{label}: segment not drawn")
                facts.append(("seg", frozenset({s1, s2}), (s1, s2)))
            elif am:
                a1, a2 = scene.angle(am[1], am[2], am[3]), scene.angle(am[4], am[5], am[6])
                facts.append(("ang", frozenset({a1, a2}), (a1, a2)))
            elif tm:
                t1, t2 = tm[1], tm[2]
                require(len(set(t1)) == 3 and len(set(t2)) == 3, "Triangles name three vertices")
                corr = frozenset(zip(t1, t2))
                facts.append(("tri", frozenset({corr, frozenset((b, a) for a, b in corr)}), (t1, t2)))
            elif pm:
                l1, l2 = scene.line(pm[1], pm[2]), scene.line(pm[3], pm[4])
                facts.append(("par", frozenset({l1, l2}), ((pm[1], pm[2]), (pm[3], pm[4]))))
            elif qm:
                l1, l2 = scene.line(qm[1], qm[2]), scene.line(qm[3], qm[4])
                facts.append(("perp", frozenset({l1, l2}), ((qm[1], qm[2]), (qm[3], qm[4]))))
            else:
                raise ValueError(f"Unread statement {label!r}")
        require(len(facts) == 1 or all(f[0] == "seg" for f in facts), "Only segment congruences are joined")
        return facts
    mm = re.fullmatch(r"\$([A-Z])\$ is the midpoint of \$" + SEG + r"\$", label)
    if mm:
        return [("mid", (mm[1], _seg(mm[2], mm[3])), (mm[1], mm[2], mm[3]))]
    bm = re.fullmatch(r"\$" + SEG + r"\$ bisects \$" + ANG + r"\$", label)
    if bm:
        v = bm[4]
        require(v in (bm[1], bm[2]) and bm[3] != bm[5], "A bisector starts at the angle's vertex")
        other = bm[2] if bm[1] == v else bm[1]
        angle = scene.angle(bm[3], v, bm[5])
        return [("bis", (angle, scene.ray(v, other)), (v, other, bm[3], bm[5]))]
    qm = re.fullmatch(r"\$([A-Z]{4})\$ is a parallelogram", label)
    if qm:
        q = qm[1]
        require(len(set(q)) == 4, "Four vertices")
        return [("pgram", frozenset({frozenset({q[i], q[(i + 1) % 4]}) for i in range(4)}), q)]
    raise ValueError(f"Unread statement {label!r}")


def _key(facts):
    return frozenset((f[0], f[1]) for f in facts)


def _congruence_truth(facts, scene):
    for kind, key, data in facts:
        if kind == "seg":
            (a, b), (c, d) = [tuple(s) for s in data]
            if not _close(scene.dist(a, b), scene.dist(c, d)):
                return False
        elif kind == "ang":
            if not _close(_angle_measure(data[0]), _angle_measure(data[1]), 1e-2):
                return False
        elif kind == "tri":
            t1, t2 = data
            for i, j in ((0, 1), (1, 2), (2, 0)):
                if not _close(scene.dist(t1[i], t1[j]), scene.dist(t2[i], t2[j])):
                    return False
        elif kind == "par":
            l1, l2 = tuple(key) if len(key) == 2 else (next(iter(key)),) * 2
            if (l1[0], l1[1]) != (l2[0], l2[1]) or l1 == l2:
                return False
        elif kind == "perp":
            l1, l2 = tuple(key)
            if abs(l1[0] * l2[0] + l1[1] * l2[1]) > 1e-6:
                return False
        elif kind == "mid":
            m, (x, y) = data[0], (data[1], data[2])
            pm, px, py = scene.p(m), scene.p(x), scene.p(y)
            if not (_close(pm[0], (px[0] + py[0]) / 2) and _close(pm[1], (px[1] + py[1]) / 2)):
                return False
        elif kind == "bis":
            v, o, a, b = data
            if not _close(_angle_measure(scene.angle(a, v, o)), _angle_measure(scene.angle(o, v, b)), 1e-2):
                return False
            if not _close(_angle_measure(scene.angle(a, v, o)) * 2, _angle_measure(scene.angle(a, v, b)), 1e-2):
                return False
        elif kind == "pgram":
            q = data
            pts = [scene.p(c) for c in q]
            def d(i, j):
                return (pts[j][0] - pts[i][0], pts[j][1] - pts[i][1])
            def par(u, w):
                return abs(u[0] * w[1] - u[1] * w[0]) < 1e-6
            if not (par(d(0, 1), d(3, 2)) and par(d(1, 2), d(0, 3))):
                return False
    return True


# ---------------------------------------------------------------- rules

CONGRUENCE_REASONS = {
    "Given": "given",
    "Reflexive property of congruence": "reflexive",
    "Definition of angle bisector": "bisector",
    "Definition of midpoint": "midpoint",
    "Vertical angles are congruent": "vertical",
    "Alternate interior angles of parallel lines are congruent": "alt-interior",
    "Alternate exterior angles of parallel lines are congruent": "alt-exterior",
    "Corresponding angles of parallel lines are congruent": "corresponding",
    "Perpendicular lines form congruent right angles": "perpendicular",
    "One pair of opposite sides parallel and congruent makes a parallelogram": "pgram-test",
    "The diagonals of a parallelogram bisect each other": "diagonals",
    "Opposite sides of a parallelogram are congruent": "opposite-sides",
    "SSS": "SSS", "SAS": "SAS", "ASA": "ASA", "AAS": "AAS",
    "CPCTC (corresponding parts of congruent triangles)": "CPCTC",
}


def _tri_parts(t1, t2, scene):
    """Corresponding sides and angles of △t1 ≅ △t2 (fact keys)."""
    sides, angles = {}, {}
    for i in range(3):
        j, k = (i + 1) % 3, (i + 2) % 3
        sides[frozenset({i, j})] = ("seg", frozenset({_seg(t1[i], t1[j]), _seg(t2[i], t2[j])}))
        angles[i] = ("ang", frozenset({scene.angle(t1[j], t1[i], t1[k]), scene.angle(t2[j], t2[i], t2[k])}))
    return sides, angles


def _transversal_pair(a1, a2, scene, kind):
    """Lines (keys) l1, l2 such that a1, a2 are an alternate-interior or a
    corresponding pair for parallel lines l1, l2 cut by the line through
    the two vertices; None when they are not such a pair."""
    v1, v2 = a1[0], a2[0]
    if v1 == v2:
        return None
    u = _unit(v2[0] - v1[0], v2[1] - v1[1])
    nu = _neg(u)
    r1, r2 = set(a1[1]), set(a2[1])
    if kind in ("alt-interior", "alt-exterior"):
        # interior: each transversal ray points at the other vertex; exterior: away
        t1, t2 = (u, nu) if kind == "alt-interior" else (nu, u)
        if t1 not in r1 or t2 not in r2:
            return None
        d1, d2 = (r1 - {t1}), (r2 - {t2})
        if len(d1) != 1 or len(d2) != 1:
            return None
        d1, d2 = d1.pop(), d2.pop()
        if d2 != _neg(d1) or d1 in (u, nu):
            return None
    else:
        t1 = r1 & {u, nu}
        if len(t1) != 1:
            return None
        t = t1.pop()
        if t not in r2:
            return None
        d1, d2 = (r1 - {t}).pop(), (r2 - {t}).pop()
        if d1 != d2 or d1 in (u, nu):
            return None
    return frozenset({_line_key(v1, d1), _line_key(v2, d2)})


class _CongruenceRules:
    def __init__(self, scene, givens):
        self.scene, self.givens = scene, givens

    def requirements(self, facts, reason, available):
        """Alternatives, each a list of required fact keys."""
        kinds = {f[0] for f in facts}
        if reason == "given":
            return [[]] if _key(facts) in self.givens else []
        if reason == "pgram-test":
            if kinds != {"pgram"}:
                return []
            q = facts[0][2]
            alts = []
            for i in (0, 1):
                s1, s2 = _seg(q[i], q[i + 1]), _seg(q[i + 2], q[(i + 3) % 4])
                l1, l2 = self.scene.line(q[i], q[i + 1]), self.scene.line(q[i + 2], q[(i + 3) % 4])
                alts.append([("par", frozenset({l1, l2})), ("seg", frozenset({s1, s2}))])
            return alts
        if kinds == {"seg"} and len(facts) > 1:
            if reason != "diagonals":
                return []
            alts = None
            for f in facts:
                found = self._diagonal_reqs(f)
                if not found:
                    return []
                alts = found if alts is None else [a for a in alts if a in found]
            return alts or []
        if len(facts) != 1:
            return []
        kind, key, data = facts[0]
        if reason == "reflexive":
            return [[]] if kind in ("seg", "ang") and len(key) == 1 else []
        if reason == "CPCTC":
            if kind not in ("seg", "ang"):
                return []
            alts = []
            for fk in available:
                if fk[0] != "tri":
                    continue
                corr = next(iter(fk[1]))
                t1 = "".join(a for a, _ in sorted(corr))
                t2 = "".join(dict(corr)[a] for a in t1)
                sides, angles = _tri_parts(t1, t2, self.scene)
                if (kind, key) in set(sides.values()) | set(angles.values()):
                    alts.append([fk])
            return alts
        if reason in ("SSS", "SAS", "ASA", "AAS"):
            if kind != "tri":
                return []
            t1, t2 = data
            if t1 == t2 or len(key) != 2 and len({t1, t2}) == 1:
                return []
            sides, angles = _tri_parts(t1, t2, self.scene)
            S = lambda i, j: sides[frozenset({i, j})]
            if reason == "SSS":
                return [[S(0, 1), S(1, 2), S(2, 0)]]
            alts = []
            for i in range(3):
                j, k = (i + 1) % 3, (i + 2) % 3
                if reason == "SAS":
                    alts.append([S(i, j), angles[i], S(i, k)])
                if reason == "ASA":
                    alts.append([angles[i], S(i, j), angles[j]])
                if reason == "AAS":
                    # angles at i and j, side not between them
                    alts.append([angles[i], angles[j], S(j, k)])
                    alts.append([angles[i], angles[j], S(k, i)])
            return alts
        if kind == "seg" and reason == "midpoint":
            s1, s2 = data
            common = s1 & s2
            if len(common) != 1 or s1 == s2:
                return []
            m = next(iter(common))
            x, y = next(iter(s1 - common)), next(iter(s2 - common))
            return [[("mid", (m, _seg(x, y)))]]
        if kind == "seg" and reason == "opposite-sides":
            s1, s2 = data
            if s1 & s2:
                return []
            return [[("pgram", q)] for q in self._quads(s1, s2)]
        if kind == "seg" and reason == "diagonals":
            return self._diagonal_reqs(facts[0])
        if kind == "ang":
            a1, a2 = data
            if reason == "vertical":
                return [[]] if a1[0] == a2[0] and {_neg(d) for d in a1[1]} == set(a2[1]) else []
            if reason == "bisector":
                if a1[0] != a2[0]:
                    return []
                common = set(a1[1]) & set(a2[1])
                if len(common) != 1:
                    return []
                s = common.pop()
                outer = frozenset((set(a1[1]) | set(a2[1])) - {s})
                if len(outer) != 2:
                    return []
                return [[("bis", ((a1[0], outer), s))]]
            if reason in ("alt-interior", "alt-exterior", "corresponding"):
                lines = _transversal_pair(a1, a2, self.scene, reason)
                return [[("par", lines)]] if lines else []
            if reason == "perpendicular":
                reqs = []
                for a in (a1, a2):
                    d1, d2 = tuple(a[1])
                    reqs.append(("perp", frozenset({_line_key(a[0], d1), _line_key(a[0], d2)})))
                return [sorted(set(reqs), key=repr)]
        return []

    def _quads(self, s1, s2):
        """Parallelogram keys (edge sets) having s1 and s2 as opposite sides."""
        a, b = tuple(s1)
        c, d = tuple(s2)
        out = []
        for x, y in ((c, d), (d, c)):
            edges = frozenset({_seg(a, b), _seg(b, x), _seg(x, y), _seg(y, a)})
            out.append(edges)
        return out

    def _diagonal_reqs(self, fact):
        kind, key, data = fact
        if kind != "seg":
            return []
        s1, s2 = data
        common = s1 & s2
        if len(common) != 1:
            return []
        m = next(iter(common))
        x, z = next(iter(s1 - common)), next(iter(s2 - common))
        # M must be the drawn crossing of the two diagonals.
        pm, px, pz = self.scene.p(m), self.scene.p(x), self.scene.p(z)
        alts = []
        for q in self.parallelograms:
            edges = q
            names = set().union(*edges)
            if x in names and z in names and _seg(x, z) not in edges:
                others = sorted(names - {x, z})
                p0, p1 = self.scene.p(others[0]), self.scene.p(others[1])
                if _crossing(px, pz, p0, p1, pm):
                    alts.append([("pgram", q)])
        return alts


def _crossing(a, b, c, d, m):
    """m lies on both segments ab and cd."""
    return _on_segment(m, a, b) and _on_segment(m, c, d)


ANGLE_REASONS = {
    "Given": "given",
    "Vertical angles are congruent": "vertical",
    "Corresponding angles of parallel lines are congruent": "corresponding",
    "Alternate interior angles of parallel lines are congruent": "alt-interior",
    "Alternate exterior angles of parallel lines are congruent": "alt-exterior",
    "Transitive property of congruence": "transitive",
    "Angles that form a linear pair are supplementary": "linear-pair",
    "Definition of supplementary angles": "def-supplementary",
    "Substitution property of equality": "substitution",
    "If corresponding angles are congruent, then the lines are parallel": "converse-corresponding",
    "If alternate interior angles are congruent, then the lines are parallel": "converse-alt-interior",
}


class _Transversal:
    """Lines ℓ and m cut by t; each numbered angle as (line, line-ray sign,
    t-ray sign) read from where its label sits around the crossing."""

    def __init__(self, figure):
        require(figure and figure.get("kind") == "scene", "A proof needs its figure")
        els = figure["scene"]["elements"]
        segs = {e["id"]: e for e in els if e["type"] == "segment"}
        texts = [e for e in els if e["type"] == "text"]
        named = {}
        for e in texts:
            if e["text"] in ("ℓ", "m", "t"):
                hits = [s for s in segs.values() if tuple(e["at"]) in (tuple(s["from"]), tuple(s["to"]))]
                require(len(hits) == 1, f"Label {e['text']} marks one line")
                named[e["text"]] = hits[0]
        require(set(named) == {"ℓ", "m", "t"}, "Lines ℓ, m and t are labeled")
        def dvec(s):
            return (s["to"][0] - s["from"][0], s["to"][1] - s["from"][1])
        self.u = _unit(*dvec(named["t"]))
        dl = _unit(*dvec(named["ℓ"]))
        dm = _unit(*dvec(named["m"]))
        if dl[0] * dm[0] + dl[1] * dm[1] < 0:
            dm = _neg(dm)
        self.dir = {"ℓ": dl, "m": dm}
        t0 = named["t"]["from"]
        self.cross = {}
        for name in ("ℓ", "m"):
            s = named[name]
            self.cross[name] = _intersect(s["from"], self.dir[name], t0, self.u)
            require(_on_segment(self.cross[name], tuple(s["from"]), tuple(s["to"])), "t crosses the drawn line")
        self.angles = {}
        for e in texts:
            if re.fullmatch(r"[1-8]", e["text"]):
                q = e["at"]
                best = min(("ℓ", "m"), key=lambda n: math.hypot(q[0] - self.cross[n][0], q[1] - self.cross[n][1]))
                p = self.cross[best]
                a, b = _coords(q[0] - p[0], q[1] - p[1], self.dir[best], self.u)
                require(abs(a) > 1e-6 and abs(b) > 1e-6, f"Angle label {e['text']} sits on a line")
                self.angles[int(e["text"])] = (best, 1 if a > 0 else -1, 1 if b > 0 else -1)
        require(sorted(self.angles) == list(range(1, 9)), "Eight numbered angles")
        require(len(set(self.angles.values())) == 8, "Each region numbered once")
        # toward: the t-ray sign at a crossing that points to the other crossing
        pl, pm_ = self.cross["ℓ"], self.cross["m"]
        s = 1 if (pm_[0] - pl[0]) * self.u[0] + (pm_[1] - pl[1]) * self.u[1] > 0 else -1
        self.toward = {"ℓ": s, "m": -s}

    def measure(self, n):
        line, a, b = self.angles[n]
        d = self.dir[line]
        r1 = (a * d[0], a * d[1])
        r2 = (b * self.u[0], b * self.u[1])
        return math.degrees(math.acos(max(-1.0, min(1.0, r1[0] * r2[0] + r1[1] * r2[1]))))

    def relation(self, x, y):
        (l1, a1, b1), (l2, a2, b2) = self.angles[x], self.angles[y]
        if l1 == l2:
            if a1 != a2 and b1 != b2:
                return "vertical"
            if (a1 != a2) != (b1 != b2):
                return "linear-pair"
            return None
        if a1 == a2 and b1 == b2:
            return "corresponding"
        interior1, interior2 = b1 == self.toward[l1], b2 == self.toward[l2]
        if a1 != a2 and b1 != b2 and interior1 and interior2:
            return "alt-interior"
        if a1 != a2 and b1 != b2 and not interior1 and not interior2:
            return "alt-exterior"
        if a1 == a2 and interior1 and interior2:
            return "same-side-interior"
        return None


def _intersect(p, d, q, e):
    den = d[0] * e[1] - d[1] * e[0]
    require(abs(den) > 1e-9, "Parallel lines do not cross")
    s = ((q[0] - p[0]) * e[1] - (q[1] - p[1]) * e[0]) / den
    return (p[0] + s * d[0], p[1] + s * d[1])


def _coords(x, y, d, u):
    den = d[0] * u[1] - d[1] * u[0]
    return ((x * u[1] - y * u[0]) / den, (d[0] * y - d[1] * x) / den)


def _read_angle_statement(label, tr):
    m = re.fullmatch(r"\$\\angle (\d)\\cong\\angle (\d)\$", label)
    if m:
        return [("acong", frozenset({int(m[1]), int(m[2])}), (int(m[1]), int(m[2])))]
    m = re.fullmatch(r"\$m\\angle (\d)=m\\angle (\d)\$", label)
    if m:
        return [("meq", frozenset({int(m[1]), int(m[2])}), (int(m[1]), int(m[2])))]
    m = re.fullmatch(r"\$m\\angle (\d)\+m\\angle (\d)=180\^\\circ\$", label)
    if m:
        return [("msum", frozenset({int(m[1]), int(m[2])}), (int(m[1]), int(m[2])))]
    m = re.fullmatch(r"\$\\angle (\d)\$ and \$\\angle (\d)\$ are supplementary", label)
    if m:
        return [("supp", frozenset({int(m[1]), int(m[2])}), (int(m[1]), int(m[2])))]
    if label == "$\\ell\\parallel m$":
        return [("lpar", frozenset(), ())]
    raise ValueError(f"Unread statement {label!r}")


def _angle_truth(facts, tr):
    kind, key, data = facts[0]
    if kind == "lpar":
        return True  # the figure draws ℓ and m parallel; truth comes from the givens
    x, y = data
    if x == y:
        return kind in ("acong", "meq")
    if kind in ("acong", "meq"):
        return _close(tr.measure(x), tr.measure(y), 1e-2)
    return _close(tr.measure(x) + tr.measure(y), 180, 1e-2)


class _AngleRules:
    def __init__(self, tr, givens):
        self.tr, self.givens = tr, givens

    def requirements(self, facts, reason, available):
        kind, key, data = facts[0]
        if reason == "given":
            return [[]] if _key(facts) in self.givens else []
        if kind == "lpar":
            pair = {"converse-corresponding": "corresponding", "converse-alt-interior": "alt-interior"}.get(reason)
            if not pair:
                return []
            alts = []
            for x, y in itertools.combinations(range(1, 9), 2):
                if self.tr.relation(x, y) == pair:
                    alts.append([("acong", frozenset({x, y}))])
                    alts.append([("meq", frozenset({x, y}))])
            return alts
        x, y = data
        if x == y:
            return []
        rel = self.tr.relation(x, y)
        if kind in ("acong", "meq"):
            if reason == "vertical" and rel == "vertical":
                return [[]]
            if reason in ("corresponding", "alt-interior", "alt-exterior") and rel == reason:
                return [[("lpar", frozenset())]]
            if reason == "transitive" and kind == "acong":
                return [[("acong", frozenset({x, b})), ("acong", frozenset({b, y}))] for b in range(1, 9) if b not in (x, y)]
            return []
        if kind in ("msum", "supp") and reason == "linear-pair":
            return [[]] if rel == "linear-pair" else []
        if reason == "def-supplementary":
            other = {"msum": "supp", "supp": "msum"}.get(kind)
            return [[(other, key)]] if other else []
        if kind == "msum" and reason == "substitution":
            alts = []
            for keep, swap in ((x, y), (y, x)):
                for b in range(1, 9):
                    if b not in (keep, swap):
                        alts.append([("msum", frozenset({keep, b})), ("meq", frozenset({b, swap}))])
            return alts
        return []


# ---------------------------------------------------------------- proof engine

class _Proof:
    def __init__(self, public):
        self.public = public
        response = public["response"]
        banks = {b["id"]: b for b in response["banks"]}
        require(set(banks) == {"statements", "reasons"}, "Statement and reason banks")
        self.template = public["templateId"]
        prompt = public["prompt"]
        m = re.search(r"Given: (.+)\. Prove: (.+)\. (?:Build|The)", prompt)
        require(m, "The prompt states Given and Prove")
        given_texts = re.split(r"\$ and \$", m[1])
        given_texts = [("$" if i else "") + g + ("$" if i < len(given_texts) - 1 else "") for i, g in enumerate(given_texts)]
        prove_text = m[2]
        require(response.get("goal") == prove_text, "The goal is the Prove statement")
        if self.template == "two-column-angle-proof":
            self.model = _Transversal(public["figure"])
            read = lambda label: _read_angle_statement(label, self.model)
            reason_names = ANGLE_REASONS
            self.parallel_drawn = "parallel to m" in public["figure"]["scene"].get("title", "")
        else:
            self.model = _Scene(public["figure"])
            read = lambda label: _read_congruence_statement(label, self.model)
            reason_names = CONGRUENCE_REASONS
        self.facts = {o["id"]: read(o["label"]) for o in banks["statements"]["options"]}
        keys = [_key(f) for f in self.facts.values()]
        require(len(set(keys)) == len(keys), "Two bank statements say the same thing")
        self.givens = {_key(read(g)) for g in given_texts}
        goal_key = _key(read(prove_text))
        goal = [sid for sid, f in self.facts.items() if _key(f) == goal_key]
        require(len(goal) == 1, "The goal is one bank statement")
        self.goal = goal[0]
        for g in self.givens:
            require(g in keys, "Every given is a bank statement")
        self.reasons = {}
        for o in banks["reasons"]["options"]:
            require(o["label"] in reason_names, f"Unknown reason {o['label']!r}")
            self.reasons[o["id"]] = reason_names[o["label"]]
        if self.template == "two-column-angle-proof":
            self.rules = _AngleRules(self.model, self.givens)
            self.truth = lambda f: _angle_truth(f, self.model)
        else:
            self.rules = _CongruenceRules(self.model, self.givens)
            self.rules.parallelograms = [f[0][1] for f in self.facts.values() if f[0][0] == "pgram"]
            self.truth = lambda f: _congruence_truth(f, self.model)
        self.closure = self._closure()

    def justifications(self, sid, rid, available):
        """Minimal prerequisite sets (statement ids within `available`) for sid by rid."""
        facts = self.facts[sid]
        avail_keys = set()
        providers = {}
        for other in available:
            if other == sid:
                continue
            for f in self.facts[other]:
                k = (f[0], f[1])
                avail_keys.add(k)
                providers.setdefault(k, set()).add(other)
        alts = self.rules.requirements(facts, self.reasons[rid], avail_keys)
        sets = set()
        for alt in alts:
            if not all(k in providers for k in alt):
                continue
            for combo in itertools.product(*[sorted(providers[k]) for k in alt]):
                sets.add(frozenset(combo))
        return {s for s in sets if not any(o < s for o in sets)}

    def _closure(self):
        proved = set()
        changed = True
        while changed:
            changed = False
            for sid in self.facts:
                if sid in proved:
                    continue
                if any(self.justifications(sid, rid, proved) for rid in self.reasons):
                    proved.add(sid)
                    changed = True
        return proved

    def check_proof(self, lines):
        require(lines, "A proof has lines")
        seen = []
        for i, (sid, rid) in enumerate(lines, 1):
            require(sid in self.facts and rid in self.reasons, f"Line {i}: unknown option")
            require(sid not in seen, f"Line {i} repeats a statement")
            require(self.justifications(sid, rid, set(seen)), f"Line {i}: {sid} is not justified by {rid} from the lines above")
            seen.append(sid)
        require(seen[-1] == self.goal, "The last line states the goal")

    def valid(self, lines):
        try:
            self.check_proof(lines)
            return True
        except ValueError:
            return False

    def review_bank(self):
        require(self.goal in self.closure, "The goal is not provable from the givens with this bank")
        for sid in self.facts:
            true = self.truth(self.facts[sid])
            if sid in self.closure:
                require(true, f"Provable statement {sid} is false in the figure")
            else:
                # A distractor the givens cannot prove must also be false in
                # the figure; a true one would read as a correct line.
                require(not true, f"Statement {sid} is true in the figure but cannot be proved from the givens")
                STATS["distractorsRejected"] += 1
        for g in self.givens:
            sid = next(s for s, f in self.facts.items() if _key(f) == g)
            require(self.truth(self.facts[sid]), f"Given {sid} is false in the figure")
        _check_marks(self)

def _review_proof(problem):
    public, response, banks = _check_public(problem)
    require(response["layout"] == "proof", "Proofs use the proof layout")
    for row in response["rows"]:
        require([f["kind"] for f in row["fields"]] == ["choice", "choice"], "Proof rows are [statement, reason]")
        require([f["bank"] for f in row["fields"]] == ["statements", "reasons"], "Proof rows draw from the banks")
    require("open" not in response, "A proof has fixed rows")
    proof = _Proof(public)
    proof.review_bank()
    rows = _key_rows(problem)
    lines = [(r[0], r[1]) for r in rows]
    proof.check_proof(lines)
    if response["mode"] == "order":
        given = [(r["fields"][0]["given"], r["fields"][1]["given"]) for r in response["rows"]]
        valid_orders = sum(1 for perm in itertools.permutations(given) if proof.valid(list(perm)))
        if valid_orders > 1:
            STATS["orderKeysWithSeveralValidOrders"] += 1
    _check_proof_grading(problem, proof)
    _check_proof_explanation(problem, proof)
    return problem["answer"]


def _check_proof_grading(problem, proof):
    g = problem["workGrading"]
    require(g["mode"] == "proof" and g["goal"] == proof.goal, "Grading names the goal")
    theirs = {sid: {rid: {frozenset(p) for p in sets} for rid, sets in by_reason.items()} for sid, by_reason in g["claims"].items()}
    for sid, by_reason in theirs.items():
        for rid, sets in by_reason.items():
            for s in sets:
                require(proof.justifications(sid, rid, s), f"Claim {sid} by {rid} from {sorted(s)} is not valid")
                require(s <= proof.closure, f"Claim {sid} by {rid} rests on unprovable {sorted(s - proof.closure)}")
    require(set(theirs) <= proof.closure, f"Claims for unprovable statements {sorted(set(theirs) - proof.closure)}")
    _check_claims_complete(proof, theirs, len(problem["public"]["response"]["rows"]))
    STATS["claimsCompared"] += 1


def _on_line(p, a, b):
    cross = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])
    return abs(cross) <= 1e-6 * max(1.0, math.hypot(b[0] - a[0], b[1] - a[1]))


def _check_marks(proof):
    """Figure marks (ticks, arcs, arrows, right-angle corners) state only what
    the givens state: a mark that shows a fact to be proved leaks it."""
    els = proof.public["figure"]["scene"]["elements"]
    if proof.template == "two-column-angle-proof":
        arrows = [e for e in els if e["type"] == "polyline" and len(e["points"]) == 3]
        parallel_given = _key([("lpar", frozenset(), ())]) in proof.givens
        if arrows:
            require(parallel_given, "Parallel arrows mark a fact that is not given")
        title = proof.public["figure"]["scene"].get("title", "")
        require(("parallel" in title) == parallel_given, "The figure title states parallel lines that are not given")
        return
    scene = proof.model
    names = scene.points

    def piece(q):
        """The smallest segment between labeled points, along a drawn segment, holding q."""
        best = None
        for a, b in itertools.combinations(sorted(names), 2):
            pa, pb = names[a], names[b]
            if not scene.on_drawn(a, b) or not _on_segment(q, pa, pb):
                continue
            if any(_on_segment(names[c], pa, pb) and c not in (a, b) for c in names):
                continue
            best = _seg(a, b)
        return best

    ticks = collections.Counter()
    for e in els:
        if e["type"] == "tick":
            seg = piece(tuple(e["at"]))
            require(seg is not None, f"Tick {e['id']} is not on a labeled segment")
            ticks[seg] += 1
    implied_segs = set()
    implied_angles = set()
    perps = set()
    parallels = set()
    for g in proof.givens:
        for kind, key in g:
            if kind == "seg":
                implied_segs.add(key)
            elif kind == "mid":
                m, xy = key
                x, y = tuple(xy)
                implied_segs.add(frozenset({_seg(x, m), _seg(m, y)}))
            elif kind == "ang":
                implied_angles.add(key)
            elif kind == "bis":
                (vertex, rays), s = key
                r1, r2 = tuple(rays)
                implied_angles.add(frozenset({(vertex, frozenset({r1, s})), (vertex, frozenset({s, r2}))}))
            elif kind == "perp":
                perps.add(key)
            elif kind == "par":
                parallels.add(key)
    classes = collections.defaultdict(list)
    for seg, n in ticks.items():
        classes[n].append(seg)
    for n, segs in classes.items():
        require(len(segs) >= 2, f"A tick class marks a single segment {sorted(segs[0])}")
        for a, b in itertools.combinations(segs, 2):
            require(frozenset({a, b}) in implied_segs, f"Ticks mark {sorted(a)}≅{sorted(b)}, which is not given")
    arcs = collections.Counter()
    for e in els:
        if e["type"] == "arc":
            c = tuple(e["center"])
            v = next((k for k, q in names.items() if _close(q[0], c[0], 1e-6) and _close(q[1], c[1], 1e-6)), None)
            require(v is not None, "An arc centers on a labeled point")
            r1 = _unit(math.cos(math.radians(e["from"])), math.sin(math.radians(e["from"])))
            r2 = _unit(math.cos(math.radians(e["to"])), math.sin(math.radians(e["to"])))
            arcs[((_round(c[0]), _round(c[1])), frozenset({r1, r2}))] += 1
    arc_classes = collections.defaultdict(list)
    for angle, n in arcs.items():
        arc_classes[n].append(angle)
    for n, angles in arc_classes.items():
        require(len(angles) >= 2, "An arc class marks a single angle")
        for a, b in itertools.combinations(angles, 2):
            require(frozenset({a, b}) in implied_angles, "Arcs mark an angle congruence that is not given")
    for e in els:
        if e["type"] != "polyline":
            continue
        pts = [tuple(q) for q in e["points"]]
        require(len(pts) == 3, "Marks are three-point polylines")
        mid = piece(pts[1])
        if mid is not None and piece(pts[0]) is None and piece(pts[2]) is None:
            a, b = tuple(mid)
            line = scene.line(a, b)
            require(any(line in key for key in parallels), f"An arrow marks {a}{b} parallel, which is not given")
            continue
        ends = [piece(pts[0]), piece(pts[2])]
        require(None not in ends, f"Unread mark {e['id']}")
        corner = set(ends[0]) & set(ends[1])
        require(len(corner) == 1, f"Unread corner mark {e['id']}")
        v = corner.pop()
        l1 = scene.line(*tuple(ends[0]))
        l2 = scene.line(*tuple(ends[1]))
        require(frozenset({l1, l2}) in perps, f"A right-angle mark at {v} is not given")


def _check_claims_complete(proof, theirs, n):
    """Every line of every valid proof with exactly n lines (the rows a
    learner fills) is accepted by the claims, and no other line is."""
    table = {(sid, rid): proof.justifications(sid, rid, set(proof.facts)) for sid in proof.facts for rid in proof.reasons}
    table = {k: v for k, v in table.items() if v}

    def mine_ok(sid, rid, above):
        return any(p <= above for p in table.get((sid, rid), ()))

    def theirs_ok(sid, rid, above):
        return any(p <= above for p in theirs.get(sid, {}).get(rid, ()))

    # forward: prefix sets reachable by valid lines (validity depends only on the set above)
    levels = [{frozenset()}]
    for depth in range(n):
        last = depth == n - 1
        nxt = set()
        for above in levels[-1]:
            for (sid, rid) in table:
                if sid in above or (sid == proof.goal) != last:
                    continue
                if mine_ok(sid, rid, above):
                    nxt.add(above | {sid})
        levels.append(nxt)
    require(levels[-1], f"No valid proof has exactly {n} lines")
    # backward: prefixes that complete to a full proof
    alive = [set() for _ in levels]
    alive[-1] = set(levels[-1])
    for depth in range(n - 1, -1, -1):
        for above in levels[depth]:
            if any(above | {sid} in alive[depth + 1] and sid not in above for sid in proof.facts):
                alive[depth].add(above)
    checked = 0
    for depth in range(n):
        for above in alive[depth]:
            for sid in proof.facts:
                if sid in above or above | {sid} not in alive[depth + 1]:
                    continue
                for rid in proof.reasons:
                    a, b = mine_ok(sid, rid, above), theirs_ok(sid, rid, above)
                    require(a == b, f"Line {sid} by {rid} after {sorted(above)}: valid={a} but the grading accepts={b}")
                    checked += 1
    require(checked, "Nothing compared")


def _check_proof_explanation(problem, proof):
    labels = {o["label"]: o["id"] for b in problem["public"]["response"]["banks"] for o in b["options"]}
    lines = []
    for text in problem["explanation"]:
        m = re.match(r"^\d+\. (.+) \u2014 (.+)\.$", text)
        if m:
            require(m[1] in labels and m[2] in labels, f"Explanation line {text!r} uses bank labels")
            lines.append((labels[m[1]], labels[m[2]]))
    proof.check_proof(lines)


# ======================================================================
# Show-work word problems

NUM = r"(\d+(?:\.\d+)?)"


def _number(text):
    m = re.fullmatch(r"-?\d+(?:\.\d+)?", text)
    if m:
        return F(text)
    m = re.fullmatch(r"(-?\d+)/(\d+)", text)
    require(m is not None, f"Not a number: {text!r}")
    require(int(m[2]) > 0, "Zero denominator")
    return F(int(m[1]), int(m[2]))


def _canonical_number(text, fraction):
    if fraction:
        m = re.fullmatch(r"(\d+)/(\d+)", text)
        require(m is not None, f"{text!r} must be written as a fraction a/b")
        a, b = int(m[1]), int(m[2])
        require(b > 1 and math.gcd(a, b) == 1, f"{text!r} must be in lowest terms")
    else:
        require(re.fullmatch(r"-?(0|[1-9]\d*)(\.\d*[1-9])?", text), f"{text!r} is not a plain number")


def _row_values(public):
    """The exact value of every row, derived from the prompt and row labels:
    [(kind, value, extra)] with kind number/expression/relation."""
    t = public["templateId"]
    prompt = public["prompt"]
    # A typeset single letter ($c$) reads as the letter.
    labels = [re.sub(r"\$([a-z])\$", r"\1", r.get("label", "")) for r in public["response"]["rows"]]
    if t == "show-work-box-cost":
        m = re.match(r"A (.+?) sells (.+?) for " + NUM + r" dollars? each\. A coupon takes " + NUM +
                     r" dollars? off one purchase and can be used only once\. (.+?) spends exactly " + NUM +
                     r" dollars? and uses the coupon\.", prompt)
        require(m, "Unread box-cost prompt")
        items, price, coupon, buyer, spent = m[2], F(m[3]), F(m[4]), m[5], F(m[6])
        require(len(labels) == 5, "Five rows")
        n = re.fullmatch(r"Cost of (\d+) " + re.escape(items) + r", in dollars", labels[0])
        require(n, f"Unread row {labels[0]!r}")
        e = re.fullmatch(r"Expression for the cost of ([a-z]) " + re.escape(items) + r", in dollars", labels[1])
        require(e, f"Unread row {labels[1]!r}")
        v = e[1]
        require(labels[2] == f"Expression for the cost of {v} {items} with the coupon, in dollars", f"Unread row {labels[2]!r}")
        require(labels[3] == f"Cost of the {items} before the coupon comes off, in dollars", f"Unread row {labels[3]!r}")
        require(labels[4] == f"Number of {items} {buyer[0].lower() + buyer[1:] if not buyer.startswith(('A ', 'An ')) else buyer.split(' ', 1)[0].lower() + ' ' + buyer.split(' ', 1)[1]} buys", f"Unread row {labels[4]!r}")
        require(coupon < spent + coupon and price > 0, "Positive prices")
        count = (spent + coupon) / price
        require(count.denominator == 1 and count > 0, "A whole number of boxes")
        cost = _rvar(v)
        return [("number", int(n[1]) * price, False),
                ("expression", _rmul(_rconstval(price), cost), v),
                ("expression", _radd(_rmul(_rconstval(price), cost), _rconstval(coupon), -1), v),
                ("number", spent + coupon, False),
                ("number", count, False)]
    if t == "show-work-percent-count":
        m = re.match(r"([A-Z][a-z]+) has (.+?) (\d+)% of the (\d+) (.+?)\. This year \1 will (.+?) (\d+) more\.", prompt)
        require(m, "Unread percent prompt")
        p, n, k = int(m[3]), int(m[4]), int(m[7])
        require(len(labels) == 6, "Six rows")
        require(labels[0] == f"{p}% written as a fraction", f"Unread row {labels[0]!r}")
        require(re.fullmatch(r"Number of .+ " + re.escape(m[1]) + r" has .+", labels[1]), f"Unread row {labels[1]!r}")
        require(labels[2] == f"Number after {k} more", f"Unread row {labels[2]!r}")
        require(labels[3] == f"Percent of the {n} after {k} more", f"Unread row {labels[3]!r}")
        tm = re.fullmatch(r"Number that is (\d+)% of (\d+)", labels[4])
        require(tm and int(tm[2]) == n, f"Unread row {labels[4]!r}")
        target = int(tm[1])
        require(labels[5] == f"More needed to reach exactly {target}%", f"Unread row {labels[5]!r}")
        have = F(p, 100) * n
        after = have + k
        goal = F(target, 100) * n
        require(have.denominator == 1 and goal.denominator == 1, "Whole counts")
        require(goal > after and goal <= n and after <= n, "The target is ahead and within the total")
        return [("number", F(p, 100), True), ("number", have, False), ("number", after, False),
                ("number", after / n * 100, False), ("number", goal, False), ("number", goal - after, False)]
    if t == "show-work-rental-plans":
        m = re.match(r"A company rents (.+?) on two plans\. Plan A costs " + NUM + r" dollars? plus " + NUM +
                     r" dollars? per (hour|mile)\. Plan B costs " + NUM + r" dollars? plus " + NUM +
                     r" dollars? per \4\. Let \$([a-z])\$ be the number of \4s\.", prompt)
        require(m, "Unread rental prompt")
        fa, ra, unit, fb, rb, v = F(m[2]), F(m[3]), m[4], F(m[5]), F(m[6]), m[7]
        require(labels[0] == f"Cost of plan A for {v} {unit}s, in dollars" and labels[1] == f"Cost of plan B for {v} {unit}s, in dollars",
                "Unread cost rows")
        im = re.fullmatch(r"Inequality that is true when plan A costs (more|less) than plan B", labels[2])
        require(im, f"Unread row {labels[2]!r}")
        require(labels[3] == f"Number of {unit}s at which the plans cost the same", f"Unread row {labels[3]!r}")
        a = _radd(_rconstval(fa), _rmul(_rconstval(ra), _rvar(v)))
        b = _radd(_rconstval(fb), _rmul(_rconstval(rb), _rvar(v)))
        require(ra != rb, "Different rates")
        same = (fb - fa) / (ra - rb)
        require(same > 0, "The plans cross at a positive amount")
        return [("expression", a, v), ("expression", b, v), ("relation", (a, ">" if im[1] == "more" else "<", b), v),
                ("number", same, False)]
    raise ValueError("Unknown show-work template")


def _value_matches(kind, expected, field, text):
    if kind == "number":
        require(field["kind"] == "number", "A number field")
        _canonical_number(text, expected[1])
        return _number(text) == expected[0]
    line_allowed = kind == "relation"
    require(field["kind"] == "expression" and bool(field.get("relations")) == line_allowed, "Expression field shape")
    if kind == "expression":
        node = _parse_expression(text)
        require(_letters(node) <= set(field.get("variables", [])), "Letters outside the field")
        return _req(_value(node), expected[0])
    line = _parse_line(text, compound=False)
    p = line[0]
    a, rel, b = expected[0]
    return ((p.rel == rel and _req(p.lv, a) and _req(p.rv, b)) or (p.rel == FLIP[rel] and _req(p.lv, b) and _req(p.rv, a)))


def _review_show_work(problem):
    public, response, banks = _check_public(problem)
    require(response["layout"] == "steps" and response["mode"] in ("build", "fill") and not banks, "Show-work steps")
    require("open" not in response, "Fixed rows")
    derived = _row_values(public)
    rows = response["rows"]
    require(len(rows) == len(derived), "One value per row")
    for row in rows:
        require(len(row["fields"]) == 1, "One field per row")
    values = _key_rows(problem)
    g = problem["workGrading"]
    require(g["mode"] == "fields" and len(g["fields"]) == len(rows), "Field grading")
    for row, value, (kind, expected, extra), rule in zip(rows, values, derived, g["fields"]):
        field = row["fields"][0]
        fraction = kind == "number" and extra is True
        require(_value_matches(kind, (expected, fraction), field, value[0]), f"Row {row['id']}: {value[0]!r} is not {kind} {expected}")
        if "given" in field:
            require(rule == [None], f"Row {row['id']}: a given row has no rule")
            continue
        require(len(rule) == 1 and rule[0] is not None, f"Row {row['id']} has a rule")
        r = rule[0]
        require(r["kind"] == field["kind"], "Rule kind matches the field")
        if kind == "number":
            require(_number(r["value"]) == expected and bool(r.get("fraction")) == fraction, f"Row {row['id']}: rule {r} differs")
        else:
            require(r.get("match") == ("sides" if kind == "relation" else "identity"), f"Row {row['id']}: match {r.get('match')}")
            require(_value_matches(kind, (expected, False), field, r["value"]), f"Row {row['id']}: rule value {r['value']} differs")
    _check_show_work_text(problem, derived)
    return problem["answer"]


def _numbers_in(text):
    return {F(x) for x in re.findall(r"(?<![\d.])\d+(?:\.\d+)?(?![\d.])", text)}


def _check_show_work_text(problem, derived):
    prose = re.sub(r"\$[^$]*\$", "", problem["public"]["prompt"])
    require(not re.search(r"(?<![\d.])1 dollars\b", prose), "Number agreement: '1 dollars'")
    prompt_numbers = _numbers_in(problem["public"]["prompt"]) | _numbers_in(" ".join(r.get("label", "") for r in problem["public"]["response"]["rows"]))
    hint_numbers = _numbers_in(problem["hint"])
    entered = [d for d, row in zip(derived, problem["public"]["response"]["rows"]) if "given" not in row["fields"][0]]
    for kind, value, _ in entered:
        if kind == "number" and value.denominator == 1:
            require(value in prompt_numbers or value not in hint_numbers, f"The hint reveals {value}")
    explained = _numbers_in(" ".join(problem["explanation"]))
    for kind, value, _ in derived:
        if kind == "number" and value.denominator == 1 and value >= 0:
            require(value in explained, f"The explanation never states {value}")


# ======================================================================
# API

def solve(public):
    t = public["templateId"]
    require(t in SUPPORTED, f"Unsupported template {t}")
    if t in SOLVE_JUSTIFY:
        start, ctx = _derivation_context(public)
        return _solution_text(ctx["solution"], ctx["variable"])
    if t in PROOFS:
        proof = _Proof(public)
        require(proof.goal in proof.closure, "The goal is not provable")
        return "provable:" + ",".join(sorted(proof.closure))
    out = []
    for kind, value, _ in _row_values(public):
        if kind == "number":
            out.append(_num_text(value))
        elif kind == "expression":
            out.append(_rf_text(value))
        else:
            out.append(_rf_text(value[0]) + value[1] + _rf_text(value[2]))
    return json.dumps(out)


def review_problem(problem):
    t = problem["public"]["templateId"]
    require(t in SUPPORTED, f"Unsupported template {t}")
    STATS["cases"] += 1
    if t in SOLVE_JUSTIFY:
        return _review_derivation(problem)
    if t in PROOFS:
        return _review_proof(problem)
    return _review_show_work(problem)


# ======================================================================
# Fixtures and mutations

MUTATIONS = []


def _rejects(problem, why):
    try:
        review_problem(problem)
    except (ValueError, KeyError, TypeError, ZeroDivisionError) as error:
        MUTATIONS.append(why)
        return str(error)
    raise ValueError(f"Self-test mutation accepted: {why}")


def _reasons_bank(word, quadratic=False):
    names = [("ad", f"Addition property of {word}"), ("su", f"Subtraction property of {word}")]
    if not quadratic:
        names.append(("mu", f"Multiplication property of {word}"))
    names.append(("di", f"Division property of {word}"))
    if quadratic:
        names += [("fa", "Factoring"), ("zp", "Zero-product property")]
    names += [("dp", "Distributive property"), ("cl", "Combine like terms")]
    if not quadratic:
        names.append(("co", "Commutative property"))
    if word == "equality":
        names.append(("sy", "Symmetric property of equality"))
    return {"id": "reasons", "label": "Reason", "options": [{"id": i, "label": l} for i, l in names]}


def _derivation_fixture(template, prompt, start_tex, variables, mode, rows, key, solution, explanation, positive=None, quadratic=False):
    word = "inequality" if template.endswith("inequality") else "equality"
    bank = _reasons_bank(word, quadratic)
    line = {"kind": "expression", "label": "Line", "variables": variables, "relations": True, "maxLength": 24}
    if quadratic:
        line.update(compound=True, powers=True)
    response_rows = []
    for i, (given_line, given_reason) in enumerate(rows, 1):
        lf, rf = dict(line), {"kind": "choice", "label": "Reason", "bank": "reasons"}
        if given_line is not None:
            lf["given"] = given_line
        if given_reason is not None:
            rf["given"] = given_reason
        response_rows.append({"id": f"r{i}", "fields": [lf, rf]})
    response = {"kind": "structured-work", "label": "Your solution", "layout": "steps", "mode": mode, "start": start_tex,
                "banks": [bank], "rows": response_rows}
    if mode == "build":
        response["open"] = {"max": 5}
    moves = {o["id"]: MOVE_OF_REASON[o["label"]] for o in bank["options"]}
    grading = {"mode": "derivation", "variable": variables[-1] if template.endswith("formula") else variables[0],
               "start": _tex_to_input(start_tex), "moves": moves, "solution": solution,
               "line": {"variables": variables, "relations": True, "requireRelation": True}}
    if quadratic:
        grading["line"].update(compound=True, powers=True)
    if positive is not None:
        grading["positive"] = positive
    return {"public": {"id": "fixture", "templateId": template, "templateVersion": 1, "seed": "fixture", "skillId": "fixture",
                       "prompt": prompt, "response": response},
            "answer": json.dumps(key, separators=(",", ":")), "hint": "Undo the operations in reverse order.",
            "explanation": explanation, "workGrading": grading, "variant": {"id": "fixture"}}


def _explain(start_tex, steps, bank):
    labels = {o["id"]: o["label"] for o in bank["options"]}
    return [f"Start from {start_tex}."] + [f"${tex}$ \u2014 {labels[r]}." for tex, r in steps]


def _congruence_fixture(mode="build"):
    pts = {"A": [0, 3.6], "B": [-2.4, 0.9], "C": [0, -0.6], "D": [2.4, 0.9]}
    els = [{"id": f"s{a}{b}", "type": "segment", "from": pts[a], "to": pts[b]} for a, b in ("AB", "BC", "CD", "DA", "AC")]
    els += [{"id": f"n{k}", "type": "text", "at": v, "text": k} for k, v in pts.items()]
    statements = [("sa", "$\\overline{AB}\\cong\\overline{CB}$"), ("sb", "$\\overline{AB}\\cong\\overline{AD}$"),
                  ("sc", "$\\overline{AC}\\cong\\overline{AC}$"), ("sd", "$\\angle BAC\\cong\\angle DAC$"),
                  ("se", "$\\triangle ABC\\cong\\triangle CDA$"), ("sf", "$\\triangle ABC\\cong\\triangle ADC$"),
                  ("sg", "$\\overline{CB}\\cong\\overline{CD}$")]
    reasons = [("ra", "Given"), ("rb", "Reflexive property of congruence"), ("rc", "Definition of angle bisector"),
               ("rd", "Definition of midpoint"), ("re", "Vertical angles are congruent"), ("rf", "SSS"), ("rg", "SAS"),
               ("rh", "ASA"), ("ri", "AAS"), ("rj", "CPCTC (corresponding parts of congruent triangles)")]
    rows = [{"id": f"r{i}", "fields": [{"kind": "choice", "label": "Statement", "bank": "statements"},
                                       {"kind": "choice", "label": "Reason", "bank": "reasons"}]} for i in range(1, 5)]
    key = [["sb", "ra"], ["sg", "ra"], ["sc", "rb"], ["sf", "rf"]]
    labels = dict(statements + reasons)
    return {"public": {"id": "fixture", "templateId": "two-column-congruence-proof", "templateVersion": 1, "seed": "fixture",
                       "skillId": "fixture",
                       "prompt": "Use the figure. Given: $\\overline{AB}\\cong\\overline{AD}$ and $\\overline{CB}\\cong\\overline{CD}$. Prove: $\\triangle ABC\\cong\\triangle ADC$. Build the proof: choose a statement and a reason for each line.",
                       "response": {"kind": "structured-work", "label": "Your proof", "layout": "proof", "mode": mode,
                                    "goal": "$\\triangle ABC\\cong\\triangle ADC$",
                                    "banks": [{"id": "statements", "label": "Statement", "options": [{"id": i, "label": l} for i, l in statements]},
                                              {"id": "reasons", "label": "Reason", "options": [{"id": i, "label": l} for i, l in reasons]}],
                                    "rows": rows},
                       "figure": {"kind": "scene", "scene": {"v": 1, "title": "Kite ABCD with diagonal AC", "elements": els}}},
            "answer": json.dumps(key, separators=(",", ":")), "hint": "The triangles share a side.",
            "explanation": [f"{i}. {labels[s]} \u2014 {labels[r]}." for i, (s, r) in enumerate(key, 1)],
            "workGrading": {"mode": "proof", "goal": "sf", "claims": {"sb": {"ra": [[]]}, "sg": {"ra": [[]]}, "sc": {"rb": [[]]},
                                                                       "sf": {"rf": [["sb", "sg", "sc"]]}, "sd": {"rj": [["sf"]]}}},
            "variant": {"id": "fixture"}}


def _sas_fixture():
    """Bisector configuration: SAS needs the included angle."""
    pts = {"F": [0, 3.6], "G": [-2.4, 0.9], "H": [0, -0.6], "K": [2.4, 0.9]}
    els = [{"id": f"s{a}{b}", "type": "segment", "from": pts[a], "to": pts[b]} for a, b in ("FG", "GH", "HK", "KF", "FH")]
    els += [{"id": f"n{k}", "type": "text", "at": v, "text": k} for k, v in pts.items()]
    statements = [("sa", "$\\triangle FGH\\cong\\triangle FKH$"), ("sb", "$\\overline{GH}\\cong\\overline{KH}$"),
                  ("sc", "$\\overline{FH}\\cong\\overline{FH}$"), ("sd", "$\\triangle FGH\\cong\\triangle HKF$"),
                  ("se", "$\\overline{FH}$ bisects $\\angle GFK$"), ("sf", "$\\angle GFH\\cong\\angle KFH$"),
                  ("sg", "$\\overline{FG}\\cong\\overline{GH}$"), ("sh", "$\\overline{FG}\\cong\\overline{FK}$"),
                  ("si", "$\\angle FGH\\cong\\angle FKH$")]
    reasons = [("ra", "Given"), ("rb", "Definition of angle bisector"), ("rc", "Reflexive property of congruence"),
               ("rg", "SSS"), ("rh", "SAS"), ("ri", "ASA"), ("rj", "AAS"),
               ("rk", "CPCTC (corresponding parts of congruent triangles)")]
    rows = [{"id": f"r{i}", "fields": [{"kind": "choice", "label": "Statement", "bank": "statements"},
                                       {"kind": "choice", "label": "Reason", "bank": "reasons"}]} for i in range(1, 6)]
    key = [["sh", "ra"], ["se", "ra"], ["sf", "rb"], ["sc", "rc"], ["sa", "rh"]]
    labels = dict(statements + reasons)
    return {"public": {"id": "fixture", "templateId": "two-column-congruence-proof", "templateVersion": 1, "seed": "fixture",
                       "skillId": "fixture",
                       "prompt": "Use the figure. Given: $\\overline{FG}\\cong\\overline{FK}$ and $\\overline{FH}$ bisects $\\angle GFK$. Prove: $\\triangle FGH\\cong\\triangle FKH$. Build the proof: choose a statement and a reason for each line.",
                       "response": {"kind": "structured-work", "label": "Your proof", "layout": "proof", "mode": "build",
                                    "goal": "$\\triangle FGH\\cong\\triangle FKH$",
                                    "banks": [{"id": "statements", "label": "Statement", "options": [{"id": i, "label": l} for i, l in statements]},
                                              {"id": "reasons", "label": "Reason", "options": [{"id": i, "label": l} for i, l in reasons]}],
                                    "rows": rows},
                       "figure": {"kind": "scene", "scene": {"v": 1, "title": "Quadrilateral FGHK", "elements": els}}},
            "answer": json.dumps(key, separators=(",", ":")), "hint": "The triangles share a side.",
            "explanation": [f"{i}. {labels[s]} \u2014 {labels[r]}." for i, (s, r) in enumerate(key, 1)],
            "workGrading": {"mode": "proof", "goal": "sa", "claims": {
                "sh": {"ra": [[]]}, "se": {"ra": [[]]}, "sf": {"rb": [["se"]]}, "sc": {"rc": [[]]},
                "sa": {"rh": [["sh", "sf", "sc"]]}, "sb": {"rk": [["sa"]]}, "si": {"rk": [["sa"]]}}},
            "variant": {"id": "fixture"}}


def _transversal_fixture():
    els = [{"id": "l", "type": "segment", "from": [-0.6, 2.4], "to": [7.2, 2.4]},
           {"id": "m", "type": "segment", "from": [-0.6, 0], "to": [7.2, 0]},
           {"id": "t", "type": "segment", "from": [2.098, -0.9], "to": [4.702, 3.3]},
           {"id": "ln", "type": "text", "at": [7.2, 2.4], "text": "ℓ"}, {"id": "mn", "type": "text", "at": [7.2, 0], "text": "m"},
           {"id": "tn", "type": "text", "at": [4.702, 3.3], "text": "t"}]
    spots = {1: [3.3365, 2.9225], 2: [4.9515, 2.9225], 3: [3.3365, 1.8775], 4: [4.9515, 1.8775],
             5: [1.8485, 0.5225], 6: [3.4635, 0.5225], 7: [1.8485, -0.5225], 8: [3.4635, -0.5225]}
    els += [{"id": f"a{k}", "type": "text", "at": v, "text": str(k)} for k, v in spots.items()]
    statements = [("sa", "$m\\angle 8=m\\angle 4$"), ("sb", "$m\\angle 6+m\\angle 8=180^\\circ$"),
                  ("sc", "$m\\angle 4+m\\angle 2=180^\\circ$"), ("sd", "$m\\angle 4+m\\angle 6=180^\\circ$"),
                  ("se", "$\\angle 4\\cong\\angle 6$"), ("sf", "$\\angle 4$ and $\\angle 6$ are supplementary"),
                  ("sg", "$\\ell\\parallel m$"), ("sh", "$m\\angle 2=m\\angle 6$")]
    reasons = [("ra", "Given"), ("rb", "Vertical angles are congruent"), ("rc", "Corresponding angles of parallel lines are congruent"),
               ("rd", "Angles that form a linear pair are supplementary"), ("re", "Substitution property of equality"),
               ("rf", "Definition of supplementary angles"), ("rg", "Transitive property of congruence")]
    rows = [{"id": f"r{i}", "fields": [{"kind": "choice", "label": "Statement", "bank": "statements"},
                                       {"kind": "choice", "label": "Reason", "bank": "reasons"}]} for i in range(1, 6)]
    key = [["sg", "ra"], ["sc", "rd"], ["sh", "rc"], ["sd", "re"], ["sf", "rf"]]
    labels = dict(statements + reasons)
    return {"public": {"id": "fixture", "templateId": "two-column-angle-proof", "templateVersion": 1, "seed": "fixture",
                       "skillId": "fixture",
                       "prompt": "In the figure, lines $\\ell$ and $m$ are cut by transversal $t$. Given: $\\ell\\parallel m$. Prove: $\\angle 4$ and $\\angle 6$ are supplementary. Build the proof: choose a statement and a reason for each line.",
                       "response": {"kind": "structured-work", "label": "Your proof", "layout": "proof", "mode": "build",
                                    "goal": "$\\angle 4$ and $\\angle 6$ are supplementary",
                                    "banks": [{"id": "statements", "label": "Statement", "options": [{"id": i, "label": l} for i, l in statements]},
                                              {"id": "reasons", "label": "Reason", "options": [{"id": i, "label": l} for i, l in reasons]}],
                                    "rows": rows},
                       "figure": {"kind": "scene", "scene": {"v": 1, "title": "Lines ℓ and m cut by a transversal t; ℓ is parallel to m", "elements": els}}},
            "answer": json.dumps(key, separators=(",", ":")), "hint": "Use a linear pair.",
            "explanation": [f"{i}. {labels[s]} \u2014 {labels[r]}." for i, (s, r) in enumerate(key, 1)],
            "workGrading": {"mode": "proof", "goal": "sf", "claims": {
                "sg": {"ra": [[]]}, "sc": {"rd": [[]]}, "sh": {"rc": [["sg"]]}, "sb": {"rd": [[]]}, "sa": {"rc": [["sg"]]},
                "sd": {"re": [["sc", "sh"], ["sb", "sa"]]}, "sf": {"rf": [["sd"]]}}},
            "variant": {"id": "fixture"}}


def _show_work_fixture(template):
    if template == "show-work-percent-count":
        prompt = "Leo has read 25% of the 20 books on a reading list. This year Leo will read 2 more. Enter each step."
        labels = ["25% written as a fraction", "Number of books on a reading list Leo has read", "Number after 2 more",
                  "Percent of the 20 after 2 more", "Number that is 50% of 20", "More needed to reach exactly 50%"]
        kinds = ["number"] * 6
        key = [["1/4"], ["5"], ["7"], ["35"], ["10"], ["3"]]
        rules = [{"kind": "number", "value": "1/4", "fraction": True}] + [{"kind": "number", "value": v} for v in ("5", "7", "35", "10", "3")]
        explanation = ["$25\\%=\\frac{1}{4}$.", "$\\frac{1}{4}\\times20=5$.", "$5+2=7$.", "$\\frac{7}{20}=35\\%$.", "$0.5\\times20=10$.", "$10-7=3$ more."]
    elif template == "show-work-box-cost":
        prompt = ("A farm stand sells boxes of strawberries for 4 dollars each. A coupon takes 2.50 dollars off one purchase and can be used only once. "
                  "A chef spends exactly 25.50 dollars and uses the coupon. Enter each step.")
        labels = ["Cost of 4 boxes of strawberries, in dollars", "Expression for the cost of c boxes of strawberries, in dollars",
                  "Expression for the cost of c boxes of strawberries with the coupon, in dollars",
                  "Cost of the boxes of strawberries before the coupon comes off, in dollars", "Number of boxes of strawberries a chef buys"]
        kinds = ["number", "expression", "expression", "number", "number"]
        key = [["16"], ["4c"], ["4c-2.5"], ["28"], ["7"]]
        rules = [{"kind": "number", "value": "16"}, {"kind": "expression", "value": "4c", "match": "identity"},
                 {"kind": "expression", "value": "4c-2.5", "match": "identity"}, {"kind": "number", "value": "28"}, {"kind": "number", "value": "7"}]
        explanation = ["$4\\times4=16$.", "$4c$.", "$4c-2.5$.", "$25.5+2.5=28$.", "$28\\div4=7$."]
    else:
        prompt = ("A company rents kayaks on two plans. Plan A costs 15 dollars plus 0.35 dollars per hour. Plan B costs 22.50 dollars plus 0.30 dollars per hour. "
                  "Let $h$ be the number of hours. Enter each step.")
        labels = ["Cost of plan A for h hours, in dollars", "Cost of plan B for h hours, in dollars",
                  "Inequality that is true when plan A costs more than plan B", "Number of hours at which the plans cost the same"]
        kinds = ["expression", "expression", "relation", "number"]
        key = [["15+0.35h"], ["22.5+0.3h"], ["15+0.35h>22.5+0.3h"], ["150"]]
        rules = [{"kind": "expression", "value": "15+0.35h", "match": "identity"}, {"kind": "expression", "value": "22.5+0.3h", "match": "identity"},
                 {"kind": "expression", "value": "15+0.35h>22.5+0.3h", "match": "sides"}, {"kind": "number", "value": "150"}]
        explanation = ["$15+0.35h$.", "$22.5+0.3h$.", "$15+0.35h>22.5+0.3h$.", "$h=150$."]
    rows = []
    for i, (label, kind) in enumerate(zip(labels, kinds), 1):
        if kind == "number":
            field = {"kind": "number", "label": "Number"}
        else:
            field = {"kind": "expression", "label": "Expression", "variables": ["h" if template.endswith("plans") else "c"], "maxLength": 28}
            if kind == "relation":
                field["relations"] = True
        rows.append({"id": f"r{i}", "label": label, "fields": [field]})
    return {"public": {"id": "fixture", "templateId": template, "templateVersion": 1, "seed": "fixture", "skillId": "fixture", "prompt": prompt,
                       "response": {"kind": "structured-work", "label": "Your work", "layout": "steps", "mode": "build", "banks": [], "rows": rows}},
            "answer": json.dumps(key, separators=(",", ":")), "hint": "Work one step at a time.", "explanation": explanation,
            "workGrading": {"mode": "fields", "fields": [[r] for r in rules]}, "variant": {"id": "fixture"}}


def _with_key(problem, key):
    p = copy.deepcopy(problem)
    p["answer"] = json.dumps(key, separators=(",", ":"))
    return p


def self_test():
    MUTATIONS.clear()
    eq_bank = _reasons_bank("equality")
    # ---- linear
    lin_steps = [("5x-10+7=32", "dp"), ("5x-3=32", "cl"), ("5x=35", "ad"), ("x=7", "di")]
    linear = _derivation_fixture("solve-justify-linear", "Solve $5(x-2)+7=32$. Write each step on its own line and choose the reason for it.",
                                 "$5(x-2)+7=32$", ["x"], "build", [(None, None)], [list(s) for s in lin_steps], ["7"],
                                 _explain("$5(x-2)+7=32$", lin_steps, eq_bank))
    require(review_problem(linear) == linear["answer"], "linear fixture")
    require(solve(linear["public"]) == "x=7", "linear solve")
    # another valid path is accepted by the checker
    alt = _with_key(linear, [["5x-3=32", "dp"], ["5x=35", "ad"], ["x=7", "di"]])
    require(review_problem(alt) == alt["answer"], "another valid path is accepted")
    _rejects(_with_key(linear, [["5x-10+7=32", "dp"], ["5x-3=32", "cl"], ["5x=36", "ad"], ["x=36/5", "di"]]), "wrong arithmetic line")
    _rejects(_with_key(linear, [["5x-10+7=32", "dp"], ["5x-3=32", "cl"], ["5x=35", "su"], ["x=7", "di"]]), "wrong reason (subtract for add)")
    _rejects(_with_key(linear, [["5x-10+7=32", "cl"], ["5x-3=32", "cl"], ["5x=35", "ad"], ["x=7", "di"]]), "combine named for distribute")
    _rejects(_with_key(linear, [["5x-10+7=32", "dp"], ["5x-3=32", "cl"], ["5x=35", "ad"]]), "stops before the variable is alone")
    _rejects(_with_key(linear, [["5x-10+7=32", "dp"], ["5x+4=32", "cl"], ["5x=28", "su"], ["x=28/5", "di"]]), "sign slip when combining")
    _rejects(_with_key(linear, [["5x - 10+7=32", "dp"], ["5x-3=32", "cl"], ["5x=35", "ad"], ["x=7", "di"]]), "non-canonical key")
    bad = copy.deepcopy(linear)
    bad["workGrading"]["solution"] = ["8"]
    _rejects(bad, "grading solution differs")
    bad = copy.deepcopy(linear)
    bad["workGrading"]["moves"]["ad"] = "subtract"
    _rejects(bad, "grading move map differs from the labels")
    bad = copy.deepcopy(linear)
    bad["public"]["response"]["answer"] = linear["answer"]
    _rejects(bad, "answer leaked into public")
    bad = copy.deepcopy(linear)
    bad["hint"] = "The answer is $x=7$."
    _rejects(bad, "hint states the solution")
    # ---- order mode
    order_rows = [("5x=35", "ad"), ("5x-10+7=32", "dp"), ("x=7", "di"), ("5x-3=32", "cl")]
    ordered = _derivation_fixture("solve-justify-linear", "Solve $5(x-2)+7=32$. The lines of a solution are shown out of order. Put them in order.",
                                  "$5(x-2)+7=32$", ["x"], "order", order_rows, ["r2", "r4", "r1", "r3"], ["7"],
                                  _explain("$5(x-2)+7=32$", lin_steps, eq_bank))
    require(review_problem(ordered) == ordered["answer"], "order fixture")
    _rejects(_with_key(ordered, ["r4", "r2", "r1", "r3"]), "invalid order key")
    _rejects(_with_key(ordered, ["r2", "r4", "r1"]), "order key missing a row")
    # ---- fill mode
    filled = _derivation_fixture("solve-justify-linear", "Solve $5(x-2)+7=32$. Some lines of a solution are shown. Write the missing lines and choose their reasons.",
                                 "$5(x-2)+7=32$", ["x"], "fill", [("5x-10+7=32", "dp"), (None, None), ("5x=35", "ad"), (None, None)],
                                 [["", ""], ["5x-3=32", "cl"], ["", ""], ["x=7", "di"]], ["7"], _explain("$5(x-2)+7=32$", lin_steps, eq_bank))
    require(review_problem(filled) == filled["answer"], "fill fixture")
    _rejects(_with_key(filled, [["5x-10+7=32", ""], ["5x-3=32", "cl"], ["", ""], ["x=7", "di"]]), "key re-enters a given field")
    bad = copy.deepcopy(filled)
    bad["public"]["response"]["rows"][2]["fields"][0]["given"] = "5x=36"
    _rejects(bad, "a shown line inconsistent with the derivation")
    # ---- inequality
    ineq_bank = _reasons_bank("inequality")
    ineq_steps = [("-4x+16<8", "dp"), ("-4x<-8", "su"), ("x>2", "di")]
    ineq = _derivation_fixture("solve-justify-inequality", "Solve $-4(x-4)<8$. Write each step on its own line and choose the reason for it.",
                               "$-4(x-4)<8$", ["x"], "build", [(None, None)], [list(s) for s in ineq_steps], ["x>2"],
                               _explain("$-4(x-4)<8$", ineq_steps, ineq_bank))
    require(review_problem(ineq) == ineq["answer"], "inequality fixture")
    require(solve(ineq["public"]) == "x>2", "inequality solve")
    _rejects(_with_key(ineq, [["-4x+16<8", "dp"], ["-4x<-8", "su"], ["x<2", "di"]]), "inequality that forgets to reverse")
    _rejects(_with_key(ineq, [["-4x+16<8", "dp"], ["-4x<-8", "ad"], ["x>2", "di"]]), "add named for subtracting 16")
    require(review_problem(_with_key(ineq, [["-4x+16<8", "dp"], ["16<8+4x", "ad"], ["8<4x", "su"], ["2<x", "di"]])) is not None, "other path")
    bad = copy.deepcopy(ineq)
    bad["workGrading"]["solution"] = ["x<2"]
    _rejects(bad, "grading inequality direction")
    # ---- formula
    formula_steps = [("2A=bh", "mu"), ("2A/b=h", "di"), ("h=2A/b", "sy")]
    formula = _derivation_fixture("solve-justify-formula",
                                  "The area $A$ of a triangle with base $b$ and height $h$ is $A=\\frac{1}{2}bh$. Solve the formula for $h$. Write each step on its own line and choose the reason for it.",
                                  "$A=(\\frac{1}{2})bh$", ["A", "b", "h"], "build", [(None, None)], [list(s) for s in formula_steps], ["2A/b"],
                                  _explain("$A=(\\frac{1}{2})bh$", formula_steps, eq_bank), positive=["A", "b", "h"])
    formula["workGrading"]["variable"] = "h"
    require(review_problem(formula) == formula["answer"], "formula fixture")
    _rejects(_with_key(formula, [["2A=bh", "mu"], ["2A-b=h", "su"], ["h=2A-b", "sy"]]), "wrong expression in a formula")
    _rejects(_with_key(formula, [["2A=bh", "mu"], ["2A/b=h", "di"], ["h=2A/b+1", "sy"]]), "symmetric step that changes a side")
    bad = copy.deepcopy(formula)
    bad["workGrading"]["positive"] = []
    _rejects(bad, "grading forgets the positive measurements")
    # ---- quadratic
    q_bank = _reasons_bank("equality", quadratic=True)
    q_steps = [("x^2+x-6=0", "di"), ("(x+3)(x-2)=0", "fa"), ("x+3=0 or x-2=0", "zp"), ("x=-3 or x=2", "su")]
    quad = _derivation_fixture("solve-justify-quadratic", "Solve $3x^{2}+3x-18=0$ by factoring. Write each step on its own line and choose the reason for it.",
                               "$3x^{2}+3x-18=0$", ["x"], "build", [(None, None)], [list(s) for s in q_steps], ["-3", "2"],
                               ["Start from $3x^{2}+3x-18=0$."] + [f"${_input_tex(t)}$ \u2014 {dict((o['id'], o['label']) for o in q_bank['options'])[r]}." for t, r in q_steps],
                               quadratic=True)
    require(review_problem(quad) == quad["answer"], "quadratic fixture")
    _rejects(_with_key(quad, [["x^2+x-6=0", "di"], ["(x+3)(x+2)=0", "fa"], ["x+3=0 or x+2=0", "zp"], ["x=-3 or x=-2", "su"]]), "wrong factoring")
    _rejects(_with_key(quad, [["x^2+x-6=0", "di"], ["(x+3)(x-2)=0", "fa"], ["x-3=0 or x+2=0", "zp"], ["x=3 or x=-2", "su"]]), "zero-product sign slip")
    _rejects(_with_key(quad, [["x^2+x-6=0", "di"], ["(x+3)(x-2)=0", "dp"], ["x+3=0 or x-2=0", "zp"], ["x=-3 or x=2", "su"]]), "distribute named for factoring")
    _rejects(_with_key(quad, [["x^2+x-6=0", "di"], ["(x+3)(x-2)=0", "fa"], ["x=-3 or x=2", "zp"]]), "zero-product skipping the solve")
    # ---- proofs
    kite = _congruence_fixture()
    require(review_problem(kite) == kite["answer"], "kite fixture")
    _rejects(_with_key(kite, [["sb", "ra"], ["sg", "ra"], ["sd", "rj"], ["sf", "rf"]]), "CPCTC before the congruence")
    _rejects(_with_key(kite, [["sb", "ra"], ["sg", "ra"], ["sc", "rb"], ["se", "rf"]]), "swapped vertex correspondence")
    _rejects(_with_key(kite, [["sb", "ra"], ["sg", "ra"], ["sc", "rb"], ["sf", "rg"]]), "SAS without an angle")
    _rejects(_with_key(kite, [["sb", "ra"], ["sb", "ra"], ["sc", "rb"], ["sf", "rf"]]), "repeated statement")
    _rejects(_with_key(kite, [["sa", "ra"], ["sg", "ra"], ["sc", "rb"], ["sf", "rf"]]), "a distractor called Given")
    bad = copy.deepcopy(kite)
    bad["workGrading"]["claims"]["sa"] = {"ra": [[]]}
    _rejects(bad, "grading claims a false statement")
    bad = copy.deepcopy(kite)
    del bad["workGrading"]["claims"]["sc"]
    _rejects(bad, "grading omits a valid line")
    bad = copy.deepcopy(kite)
    bad["public"]["response"]["banks"][0]["options"][0]["label"] = "$\\overline{AD}\\cong\\overline{AB}$"
    _rejects(bad, "two bank statements say the same thing")
    sas = _sas_fixture()
    require(review_problem(sas) == sas["answer"], "bisector fixture")
    _rejects(_with_key(sas, [["sh", "ra"], ["se", "ra"], ["sf", "rb"], ["sc", "rc"], ["sd", "rh"]]), "SAS with a swapped correspondence")
    _rejects(_with_key(sas, [["sh", "ra"], ["se", "ra"], ["si", "rk"], ["sc", "rc"], ["sa", "rh"]]), "CPCTC before the congruence (bisector)")
    _rejects(_with_key(sas, [["sh", "ra"], ["se", "ra"], ["sf", "rb"], ["sc", "rc"], ["sa", "ri"]]), "ASA named for SAS")
    marked = copy.deepcopy(sas)
    els = marked["public"]["figure"]["scene"]["elements"]
    els += [{"id": "t1", "type": "tick", "at": [-1.2, 2.25]}, {"id": "t2", "type": "tick", "at": [1.2, 2.25]},
            {"id": "a1", "type": "arc", "center": [0, 3.6], "from": -131.6335393365702, "to": -90},
            {"id": "a2", "type": "arc", "center": [0, 3.6], "from": -90, "to": -48.36646066342981}]
    require(review_problem(marked) == marked["answer"], "marks of the givens")
    leak = copy.deepcopy(marked)
    leak["public"]["figure"]["scene"]["elements"] += [{"id": "t3", "type": "tick", "at": [-1.2, 0.15]}, {"id": "t4", "type": "tick", "at": [-1.2, 0.15]},
                                                       {"id": "t5", "type": "tick", "at": [1.2, 0.15]}, {"id": "t6", "type": "tick", "at": [1.2, 0.15]}]
    _rejects(leak, "ticks mark the CPCTC conclusion GH≅KH")
    leak = copy.deepcopy(marked)
    leak["public"]["figure"]["scene"]["elements"] += [{"id": "r1", "type": "polyline", "points": [[-0.254400, -0.441000], [0, -0.282], [0.254400, -0.441000]]}]
    _rejects(leak, "a right-angle corner that is not given")
    angle = _transversal_fixture()
    require(review_problem(angle) == angle["answer"], "transversal fixture")
    tr = _Transversal(angle["public"]["figure"])
    for pair, rel in (((1, 4), "vertical"), ((1, 2), "linear-pair"), ((1, 3), "linear-pair"), ((2, 6), "corresponding"),
                      ((3, 6), "alt-interior"), ((4, 5), "alt-interior"), ((2, 7), "alt-exterior"), ((1, 8), "alt-exterior"),
                      ((4, 6), "same-side-interior"), ((3, 5), "same-side-interior"), ((1, 6), None)):
        require(tr.relation(*pair) == rel and tr.relation(*pair[::-1]) == rel, f"Angles {pair} should be {rel}")
    require(_close(tr.measure(4) + tr.measure(6), 180, 1e-6) and _close(tr.measure(2), tr.measure(7), 1e-6), "transversal measures")
    leak = copy.deepcopy(angle)
    leak["public"]["figure"]["scene"]["title"] = "Lines ℓ and m cut by a transversal t"
    _rejects(leak, "title disagrees with the given parallel lines")
    _rejects(_with_key(angle, [["sc", "rd"], ["sh", "rc"], ["sg", "ra"], ["sd", "re"], ["sf", "rf"]]), "parallel-line angles before the parallel lines")
    _rejects(_with_key(angle, [["sg", "ra"], ["sc", "rd"], ["sh", "rc"], ["se", "rg"], ["sf", "rf"]]), "same-side interior called congruent")
    _rejects(_with_key(angle, [["sg", "ra"], ["sc", "rd"], ["sh", "rb"], ["sd", "re"], ["sf", "rf"]]), "corresponding angles called vertical")
    # ---- show-work
    for template in sorted(SHOW_WORK):
        fixture = _show_work_fixture(template)
        require(review_problem(fixture) == fixture["answer"], f"{template} fixture")
    pc = _show_work_fixture("show-work-percent-count")
    _rejects(_with_key(pc, [["0.25"], ["5"], ["7"], ["35"], ["10"], ["3"]]), "decimal where a fraction is required")
    _rejects(_with_key(pc, [["5/20"], ["5"], ["7"], ["35"], ["10"], ["3"]]), "fraction not in lowest terms")
    _rejects(_with_key(pc, [["1/4"], ["5"], ["7"], ["35"], ["10"], ["5"]]), "wrong count")
    bad = copy.deepcopy(pc)
    bad["workGrading"]["fields"][0][0]["fraction"] = False
    _rejects(bad, "grading drops the fraction form")
    box = _show_work_fixture("show-work-box-cost")
    _rejects(_with_key(box, [["16"], ["4c"], ["4(c-2.5)"], ["28"], ["7"]]), "coupon taken off each box")
    _rejects(_with_key(box, [["16"], ["4c"], ["4c-2.5"], ["23"], ["7"]]), "coupon subtracted instead of added back")
    one = _with_key(box, [["16"], ["4c"], ["4c-1"], ["28"], ["7"]])
    one["public"]["prompt"] = one["public"]["prompt"].replace("2.50 dollars off", "1 dollar off").replace("25.50", "27")
    one["workGrading"]["fields"][2][0]["value"] = "4c-1"
    require(review_problem(one) == one["answer"], "singular dollar")
    one["public"]["prompt"] = one["public"]["prompt"].replace("1 dollar off", "1 dollars off")
    _rejects(one, "'1 dollars' in the prompt")
    bad = copy.deepcopy(box)
    bad["hint"] = "The chef buys 7 boxes."
    _rejects(bad, "hint reveals the final count")
    rent = _show_work_fixture("show-work-rental-plans")
    require(review_problem(_with_key(rent, [["15+0.35h"], ["22.5+0.3h"], ["22.5+0.3h<15+0.35h"], ["150"]])) is not None, "sides swapped")
    _rejects(_with_key(rent, [["15+0.35h"], ["22.5+0.3h"], ["15+0.35h<22.5+0.3h"], ["150"]]), "reversed inequality")
    _rejects(_with_key(rent, [["15+0.35h"], ["22.5+0.3h"], ["15+0.35h>=22.5+0.3h"], ["150"]]), "non-strict inequality")
    _rejects(_with_key(rent, [["15h+0.35"], ["22.5+0.3h"], ["15+0.35h>22.5+0.3h"], ["150"]]), "fee and rate swapped")
    bad = copy.deepcopy(rent)
    bad["workGrading"]["fields"][2][0]["match"] = "identity"
    _rejects(bad, "inequality graded by identity")
    return {"mutationsRejected": len(MUTATIONS)}


def _input_tex(text):
    """Input syntax to the TeX the explanations print (fixtures only)."""
    s = text.replace(" or ", "\\ \\text{or}\\ ")
    return re.sub(r"\^(\d+)", r"^{\1}", s)
