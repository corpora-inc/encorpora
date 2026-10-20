"""Exact evaluation of the algebra written in Algebra 1 prompts and options.

Reads display text ("−3x² + 2x − 1", "2A/b", "(P − 2l)/2", "|x − 3| + 2",
"3 · 2^x", "½(b₁ + b₂)h") into a Python AST with explicit multiplication and
evaluates it with Fractions. Shared by the Algebra 1 oracles; it never imports
the TypeScript generators.
"""
import ast
import re
from fractions import Fraction

SUBSCRIPT = {'₁': '1', '₂': '2'}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def tokens(text):
    """Display text to Python source with explicit operators."""
    s = text.replace('−', '-').replace('·', '*').replace('×', '*').replace('÷', '/')
    s = s.replace('½', '(1/2)').replace('π', 'PI')
    s = s.replace('²', '**2').replace('³', '**3').replace('^', '**')
    for k, v in SUBSCRIPT.items():
        s = s.replace(k, v)
    # Subscripted names such as b1 become single identifiers: b1 → B_1.
    s = re.sub(r'\b([a-z])([12])\b', r'\1_\2', s)
    # Absolute value bars: |…| → abs(…), innermost first.
    while '|' in s:
        m = re.search(r'\|([^|]*)\|', s)
        require(m is not None, 'Unbalanced absolute value: ' + text)
        s = s[:m.start()] + 'abs(' + m[1] + ')' + s[m.end():]
    out = []
    names = re.compile(r'abs|PI|[A-Za-z](?:_[12])?|\d+(?:\.\d+)?|\*\*|[-+*/()]|\s+')
    pos = 0
    prev = None
    while pos < len(s):
        m = names.match(s, pos)
        require(m is not None, f'Unreadable algebra at {s[pos:]!r} in {text!r}')
        tok = m[0]
        pos = m.end()
        if tok.isspace():
            continue
        starts_factor = tok == '(' or tok == 'abs' or tok == 'PI' or re.fullmatch(r'[A-Za-z](?:_[12])?|\d+(?:\.\d+)?', tok)
        ends_factor = prev is not None and (prev == ')' or prev == 'PI' or re.fullmatch(r'[A-Za-z](?:_[12])?|\d+(?:\.\d+)?', prev)) and prev != 'abs'
        if starts_factor and ends_factor:
            out.append('*')
        out.append(tok)
        prev = tok
    return ' '.join(out)


def parse(text):
    return ast.parse(tokens(text), mode='eval').body


def evaluate(node, env):
    if isinstance(node, str):
        node = parse(node)
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
        return Fraction(str(node.value))
    if isinstance(node, ast.Name):
        if node.id == 'PI' and 'PI' not in env:
            # π is a constant symbol; identities that hold for every value of it
            # are checked with an exact stand-in.
            return Fraction(355, 113)
        require(node.id in env, f'Unbound variable {node.id}')
        return Fraction(env[node.id])
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.USub, ast.UAdd)):
        v = evaluate(node.operand, env)
        return -v if isinstance(node.op, ast.USub) else v
    if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == 'abs':
        return abs(evaluate(node.args[0], env))
    if isinstance(node, ast.BinOp):
        a, b = evaluate(node.left, env), evaluate(node.right, env)
        op = type(node.op)
        if op is ast.Add:
            return a + b
        if op is ast.Sub:
            return a - b
        if op is ast.Mult:
            return a * b
        if op is ast.Div:
            require(b != 0, 'Division by zero')
            return a / b
        if op is ast.Pow:
            require(b.denominator == 1 and 0 <= b <= 12, 'Unsupported power')
            return a ** int(b)
    raise ValueError('Unsupported algebra: ' + ast.dump(node))


def variables(text):
    return sorted({n.id for n in ast.walk(parse(text)) if isinstance(n, ast.Name) and n.id not in ('abs', 'PI')})


def equation(text):
    """'lhs = rhs' to a pair of AST nodes."""
    sides = text.split(' = ')
    require(len(sides) == 2, 'Not one equation: ' + text)
    return parse(sides[0]), parse(sides[1])


def holds(text, env):
    left, right = equation(text)
    return evaluate(left, env) == evaluate(right, env)


def solve_linear(text, unknown, env):
    """Solve an equation that is linear in `unknown` exactly from two evaluations."""
    left, right = equation(text)

    def g(v):
        e = dict(env, **{unknown: v})
        return evaluate(left, e) - evaluate(right, e)
    g0, g1, g2 = g(Fraction(0)), g(Fraction(1)), g(Fraction(2))
    require(g2 - g1 == g1 - g0, f'Not linear in {unknown}: {text}')
    require(g1 != g0, f'{unknown} cancels in {text}')
    return -g0 / (g1 - g0)


def number(text):
    return Fraction(text.replace('−', '-'))


def untex(text):
    """Formulas typeset as $…$ read as the plain text the readers here parse:
    \\tfrac{1}{2} as ½, other \\tfrac{a}{b} as a/b, \\le and \\ge as ≤ and ≥."""
    def plain(m):
        tex = m[1].replace('\\tfrac{1}{2}', '½')
        tex = re.sub(r'\\t?frac\{(\d+)\}\{(\d+)\}', r'\1/\2', tex)
        return tex.replace('\\le ', '≤ ').replace('\\ge ', '≥ ').replace('\\times ', '× ')
    return re.sub(r'\$([^$]*)\$', plain, text)
