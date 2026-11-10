"""Read and evaluate the TeX the HS gap families print, independently of the
generators. Used by the matrix-equation, rational-exponent and parabola
oracles.

Supported: integers and decimals (with TeX thousands groups `{,}`), single
letter variables, + and -, \\cdot / \\times / juxtaposition, ^{...} and ^d,
parentheses (also \\left( \\right)), absolute values |...|, \\frac{..}{..},
\\sqrt{..} and \\sqrt[n]{..}. Values are exact Fractions until a root or a
non-integer power needs a float; `same` compares either kind.
"""

import math
import re
from fractions import Fraction as F


def require(condition, message):
    if not condition:
        raise ValueError(message)


TOKEN = re.compile(
    r"\s*(\\[dt]?frac|\\sqrt|\\cdot|\\times|\d+(?:\.\d+)?|[a-zA-Z]|[-+()^{}\[\]|=/])"
)


def clean(text):
    text = text.strip().strip("$")
    for old, new in (
        ("\\left(", "("), ("\\right)", ")"), ("\\left|", "|"), ("\\right|", "|"),
        ("{,}", ""), ("\\,", ""), ("\\ ", " "), ("−", "-"), ("\\!", ""),
    ):
        text = text.replace(old, new)
    return text


def tokens_of(text):
    text = clean(text)
    out, at = [], 0
    while at < len(text):
        if text[at].isspace():
            at += 1
            continue
        match = TOKEN.match(text, at)
        require(match is not None, f"Unreadable math at {text[at:]!r} in {text!r}")
        out.append(match[1])
        at = match.end()
    return out


class Parser:
    """Recursive descent over tokens; `stop` holds tokens that end the
    current expression (a closing bar, brace or bracket)."""

    def __init__(self, tokens):
        self.t = tokens
        self.i = 0

    def peek(self):
        return self.t[self.i] if self.i < len(self.t) else None

    def take(self, want=None):
        token = self.peek()
        require(token is not None, "Unexpected end of math")
        require(want is None or token == want, f"Expected {want}, found {token}")
        self.i += 1
        return token

    def expression(self, in_bars=False):
        node = self.term(in_bars)
        while self.peek() in ("+", "-"):
            op = self.take()
            node = (op, node, self.term(in_bars))
        return node

    def term(self, in_bars):
        node = self.factor(in_bars)
        while True:
            token = self.peek()
            if token in ("\\cdot", "\\times"):
                self.take()
                node = ("*", node, self.factor(in_bars))
            elif token == "/":
                self.take()
                node = ("/", node, self.factor(in_bars))
            elif token is not None and self.starts_primary(token, in_bars):
                node = ("*", node, self.factor(in_bars))
            else:
                return node

    def starts_primary(self, token, in_bars):
        if token == "|":
            return not in_bars
        return (
            token in ("(", "\\frac", "\\dfrac", "\\tfrac", "\\sqrt")
            or token[0].isdigit()
            or token.isalpha()
        )

    def factor(self, in_bars):
        if self.peek() == "-":
            self.take()
            return ("neg", self.factor(in_bars))
        if self.peek() == "+":
            self.take()
            return self.factor(in_bars)
        node = self.primary()
        while self.peek() == "^":
            self.take()
            if self.peek() == "{":
                self.take("{")
                exponent = self.expression()
                self.take("}")
            else:
                token = self.take()
                require(token[0].isdigit() or token.isalpha(), f"Bad exponent {token}")
                exponent = ("num", F(token)) if token[0].isdigit() else ("var", token)
            node = ("^", node, exponent)
        return node

    def primary(self):
        token = self.take()
        if token[0].isdigit():
            return ("num", F(token))
        if token.isalpha():
            return ("var", token)
        if token == "(":
            node = self.expression()
            self.take(")")
            return node
        if token == "{":
            node = self.expression()
            self.take("}")
            return node
        if token == "|":
            node = self.expression(in_bars=True)
            self.take("|")
            return ("abs", node)
        if token in ("\\frac", "\\dfrac", "\\tfrac"):
            self.take("{")
            top = self.expression()
            self.take("}")
            self.take("{")
            bottom = self.expression()
            self.take("}")
            return ("/", top, bottom)
        if token == "\\sqrt":
            index = ("num", F(2))
            if self.peek() == "[":
                self.take("[")
                index = self.expression()
                self.take("]")
            self.take("{")
            inside = self.expression()
            self.take("}")
            return ("root", index, inside)
        raise ValueError(f"Unexpected {token}")


def parse(text):
    p = Parser(tokens_of(text))
    node = p.expression()
    require(p.peek() is None, f"Trailing math {p.t[p.i:]} in {text!r}")
    return node


def sides(text):
    """The sides of an equation or a chain a=b=c (top-level '=' only)."""
    toks = tokens_of(text)
    parts, current, depth = [], [], 0
    for token in toks:
        if token in ("(", "{", "["):
            depth += 1
        elif token in (")", "}", "]"):
            depth -= 1
        if token == "=" and depth == 0:
            parts.append(current)
            current = []
        else:
            current.append(token)
    parts.append(current)
    out = []
    for part in parts:
        p = Parser(part)
        node = p.expression()
        require(p.peek() is None, f"Trailing math in {text!r}")
        out.append(node)
    return out


def as_float(v):
    return float(v)


def value(node, env=None):
    env = env or {}
    kind = node[0]
    if kind == "num":
        return node[1]
    if kind == "var":
        require(node[1] in env, f"Unknown variable {node[1]}")
        return env[node[1]]
    if kind == "neg":
        return -value(node[1], env)
    if kind == "abs":
        return abs(value(node[1], env))
    if kind in ("+", "-", "*", "/"):
        a, b = value(node[1], env), value(node[2], env)
        if kind == "+":
            return a + b
        if kind == "-":
            return a - b
        if kind == "*":
            return a * b
        require(b != 0, "Division by zero")
        if isinstance(a, F) and isinstance(b, F):
            return a / b
        return as_float(a) / as_float(b)
    if kind == "^":
        base, exponent = value(node[1], env), value(node[2], env)
        if isinstance(exponent, F) and exponent.denominator == 1 and isinstance(base, F):
            if exponent < 0:
                require(base != 0, "Zero to a negative power")
            return base ** int(exponent)
        require(as_float(base) > 0, "Fraction power of a non-positive base")
        return as_float(base) ** as_float(exponent)
    if kind == "root":
        index, inside = value(node[1], env), value(node[2], env)
        require(index == int(index) and index >= 2, "Root index")
        index = int(index)
        if isinstance(inside, F) and inside >= 0:
            exact = exact_root(inside, index)
            if exact is not None:
                return exact
        require(as_float(inside) >= 0, "Root of a negative number")
        return as_float(inside) ** (1.0 / index)
    raise ValueError(f"Unknown node {kind}")


def exact_root(q, n):
    def iroot(k):
        if k < 0:
            return None
        r = round(k ** (1.0 / n)) if k else 0
        for cand in (r - 1, r, r + 1):
            if cand >= 0 and cand ** n == k:
                return cand
        return None

    top, bottom = iroot(q.numerator), iroot(q.denominator)
    return F(top, bottom) if top is not None and bottom is not None else None


def same(a, b, rel=1e-9):
    if isinstance(a, F) and isinstance(b, F):
        return a == b
    a, b = as_float(a), as_float(b)
    return abs(a - b) <= rel * max(1.0, abs(a), abs(b))


def variables(node):
    kind = node[0]
    if kind == "var":
        return {node[1]}
    if kind == "num":
        return set()
    out = set()
    for child in node[1:]:
        if isinstance(child, tuple):
            out |= variables(child)
    return out


def linear(node, names):
    """Coefficients and constant of a linear expression, exactly (by
    evaluating at the origin and at each unit point, then checking a far
    point so a non-linear expression is refused)."""
    zero = {n: F(0) for n in names}
    base = value(node, zero)
    coefficients = []
    for n in names:
        point = dict(zero)
        point[n] = F(1)
        coefficients.append(value(node, point) - base)
    probe = {n: F(3 + 7 * i) for i, n in enumerate(names)}
    expect = base + sum(c * probe[n] for c, n in zip(coefficients, names))
    require(value(node, probe) == expect, "Not a linear expression")
    return coefficients, base


def self_test():
    require(value(parse("\\frac{1}{4}\\cdot4")) == 1, "fraction product")
    require(value(parse("4\\sqrt{625}")) == 100, "implicit product with a root")
    require(value(parse("\\sqrt[3]{64}")) == 4, "cube root")
    require(same(value(parse("(2^{1/4})^4")), F(2)), "unit fraction power")
    require(value(parse("1{,}024")) == 1024, "thousands group")
    a, b = sides("|y-4|=-3x+2")
    require(value(a, {"x": F(0), "y": F(1)}) == 3, "absolute value")
    require(len(sides("a=b=c")) == 3, "chain")
    coefficients, constant = linear(parse("-7x-y-6"), ["x", "y"])
    require(coefficients == [-7, -1] and constant == -6, "linear read")
    try:
        linear(parse("x^2+y"), ["x", "y"])
    except ValueError:
        pass
    else:
        raise AssertionError("A square passed as linear")
