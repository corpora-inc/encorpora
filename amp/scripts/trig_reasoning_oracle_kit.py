"""Shared reading tools for the trigonometric reasoning oracles
(unit_circle_extension, trig_symmetry_reasoning, trig_inverse_restriction).

Not an oracle itself: it holds no template ids and no answers. It reads TeX
values and equations from public text (a small recursive-descent parser, no
eval of generator code), intervals with multiples of pi as endpoints, and
builds canonical answers for choice, multi-part and multi-select responses.
"""
import json
import math
import re


def require(condition, message):
    if not condition:
        raise ValueError(message)


TAU = 2 * math.pi
TOL = 1e-9

# ----------------------------------------------------------------- TeX values

_TOKEN = re.compile(
    r'\s*(?:(?P<num>\d+(?:\.\d+)?)|(?P<cmd>\\[A-Za-z]+)|(?P<sym>[-+*/(){}^=,<>])|(?P<name>[A-Za-z]))'
)
FUNCS = {'sin': math.sin, 'cos': math.cos, 'tan': math.tan}


def _tokens(tex):
    text = (tex.replace('\\left', '').replace('\\right', '').replace('\\,', ' ').replace('\\ ', ' ')
            .replace('−', '-').replace('\\cdot', '*').replace('\\times', '*'))
    out, i = [], 0
    while i < len(text):
        if text[i].isspace():
            i += 1
            continue
        m = _TOKEN.match(text, i)
        require(m is not None and m.end() > i, f'Unreadable TeX at {text[i:i + 12]!r} in {tex!r}')
        i = m.end()
        if m.group('num'):
            out.append(('num', float(m.group('num'))))
        elif m.group('cmd'):
            name = m.group('cmd')[1:]
            if name in ('pi', 'theta'):
                out.append(('name', name))
            elif name in FUNCS:
                out.append(('func', name))
            elif name in ('frac', 'dfrac'):
                out.append(('frac', None))
            elif name == 'sqrt':
                out.append(('sqrt', None))
            elif name == 'circ':
                out.append(('name', 'circ'))
            else:
                raise ValueError(f'Unsupported TeX command \\{name} in {tex!r}')
        elif m.group('sym'):
            out.append(('sym', m.group('sym')))
        else:
            out.append(('name', m.group('name')))
    return out


class _Parser:
    """expr := term (('+'|'-') term)*; term := unary (('*'|'/'|implicit) unary)*;
    unary := '-' unary | power; power := atom ('^' atom)?"""

    def __init__(self, tokens, env):
        self.t, self.i, self.env = tokens, 0, env

    def peek(self):
        return self.t[self.i] if self.i < len(self.t) else (None, None)

    def take(self, kind=None, value=None):
        tok = self.peek()
        require(tok[0] is not None, 'Unexpected end of TeX')
        if kind is not None:
            require(tok[0] == kind and (value is None or tok[1] == value), f'Expected {value or kind}, got {tok}')
        self.i += 1
        return tok

    def starts_atom(self):
        kind, value = self.peek()
        return kind in ('num', 'name', 'frac', 'sqrt', 'func') or (kind == 'sym' and value in ('(', '{'))

    def expr(self):
        value = self.term()
        while self.peek() in (('sym', '+'), ('sym', '-')):
            op = self.take()[1]
            rhs = self.term()
            value = value + rhs if op == '+' else value - rhs
        return value

    def term(self, implicit_only=False):
        value = self.unary()
        while True:
            kind, sym = self.peek()
            if not implicit_only and kind == 'sym' and sym in ('*', '/'):
                self.take()
                rhs = self.unary()
                if sym == '*':
                    value *= rhs
                else:
                    require(abs(rhs) > 1e-15, 'Division by zero')
                    value /= rhs
            elif self.starts_atom():
                value *= self.power()
            else:
                return value

    def unary(self):
        if self.peek() == ('sym', '-'):
            self.take()
            return -self.unary()
        if self.peek() == ('sym', '+'):
            self.take()
            return self.unary()
        return self.power()

    def power(self):
        base = self.atom()
        if self.peek() == ('sym', '^'):
            self.take()
            if self.peek() == ('name', 'circ'):
                self.take()
                return math.radians(base)
            exponent = self.atom()
            return base ** exponent
        return base

    def group(self):
        self.take('sym', '{')
        value = self.expr()
        self.take('sym', '}')
        return value

    def atom(self):
        kind, value = self.take()
        if kind == 'num':
            return value
        if kind == 'name':
            if value == 'pi':
                return math.pi
            require(value in self.env, f'Unknown symbol {value}')
            return self.env[value]
        if kind == 'frac':
            top = self.group()
            bottom = self.group()
            require(abs(bottom) > 1e-15, 'Division by zero')
            return top / bottom
        if kind == 'sqrt':
            inner = self.group()
            require(inner >= 0, 'Square root of a negative number')
            return math.sqrt(inner)
        if kind == 'func':
            if self.peek() == ('sym', '('):
                self.take()
                arg = self.expr()
                self.take('sym', ')')
            else:
                arg = self.term(implicit_only=True)
            return FUNCS[value](arg)
        if (kind, value) == ('sym', '('):
            inner = self.expr()
            self.take('sym', ')')
            return inner
        if (kind, value) == ('sym', '{'):
            inner = self.expr()
            self.take('sym', '}')
            return inner
        raise ValueError(f'Unexpected token {value!r}')


def value_of(tex, env=None):
    """The real value of a TeX expression in pi, theta and single-letter
    variables (given in env); \\sin, \\cos, \\tan apply to what follows."""
    tex = tex.strip().strip('$').strip()
    parser = _Parser(_tokens(tex), dict(env or {}))
    value = parser.expr()
    require(parser.i == len(parser.t), f'Trailing TeX in {tex!r}')
    return value


def is_whole(x, tol=1e-7):
    return abs(x - round(x)) < tol


def angle_gap(a, b):
    d = (a - b) % TAU
    return min(d, TAU - d)


def math_spans(text):
    return re.findall(r'\$([^$]*)\$', text)


# ------------------------------------------------------------------ intervals

_INTERVAL = re.compile(r'^\$?\\left([\[(])(.+?),\s*(.+?)\\right([\])])\$?$')


def interval_of(label):
    """(lo, hi, lo_open, hi_open) of '$\\left[-\\frac{\\pi}{2}, \\frac{\\pi}{2}\\right]$' or '$[-1, 1]$'."""
    text = label.strip()
    m = _INTERVAL.match(text)
    if m is None:
        m = re.match(r'^\$?([\[(])(.+?),\s*(.+?)([\])])\$?$', text)
    require(m is not None, f'Not an interval: {label!r}')
    lo_tex, hi_tex = m.group(2), m.group(3)
    lo = -math.inf if lo_tex.strip() in ('-\\infty',) else value_of(lo_tex)
    hi = math.inf if hi_tex.strip() in ('\\infty',) else value_of(hi_tex)
    require(lo < hi, f'Empty interval {label!r}')
    return lo, hi, m.group(1) == '(', m.group(4) == ')'


# ---------------------------------------------------------- answer builders

def choice_options(public, kinds=('choice',)):
    response = public['response']
    require(response['kind'] in kinds, f"Unexpected response kind {response['kind']}")
    options = response['options']
    labels = [o['label'] for o in options]
    require(len(set(labels)) == len(labels), 'Duplicate option text')
    require(len(options) >= 2, 'Too few options')
    return options


def single(public, valid, kinds=('choice',)):
    """The id of the one option whose verdict is valid; any other count is a
    defect (no valid answer, or a defensible distractor)."""
    options = choice_options(public, kinds)
    verdicts = [valid(o) for o in options]
    require(all(isinstance(v, bool) for v in verdicts), 'Every option needs a verdict')
    keys = [o['id'] for o, v in zip(options, verdicts) if v]
    require(len(keys) == 1, f'Expected one valid option, found {len(keys)}: {[o["label"] for o, v in zip(options, verdicts) if v]}')
    return keys[0]


def multi_part(public, verdict_by_blank):
    """Canonical multi-part answer: for each blank exactly one valid option."""
    response = public['response']
    require(response['kind'] == 'multi-part-choice', 'Expected a multi-part response')
    out = {}
    for blank in response['blanks']:
        valid = verdict_by_blank[blank['id']]
        labels = [o['label'] for o in blank['options']]
        require(len(set(labels)) == len(labels), f"Duplicate option in {blank['id']}")
        keys = [o['id'] for o in blank['options'] if valid(o['label'])]
        require(len(keys) == 1, f"Blank {blank['id']}: expected one valid option, found {len(keys)}")
        out[blank['id']] = keys[0]
    require(set(out) == set(verdict_by_blank), 'Unexpected blanks')
    return json.dumps(out, separators=(',', ':'))


def stated_count(public):
    """The count a select-all prompt states ("Which 3 ...", "On which 2 of ...")."""
    found = re.findall(r'\b[Ww]hich (\d+) ', public['prompt'])
    require(len(found) == 1, 'Prompt does not state the selection count once')
    n = int(found[0])
    response = public['response']
    require(response['selectionCount'] == n, 'selectionCount differs from the prompt')
    label = re.match(r'Choose (\d+) ', response['label'])
    require(label is not None and int(label.group(1)) == n, 'Response label states another count')
    return n


def select_all(public, truth):
    response = public['response']
    require(response['kind'] == 'multi-select', 'Expected a multi-select response')
    options = response['options']
    labels = [o['label'] for o in options]
    require(len(set(labels)) == len(labels), 'Duplicate statement')
    require([o['id'] for o in options] == [f'option-{chr(97 + i)}' for i in range(len(options))], 'Option ids')
    truths = [truth(o['label']) for o in options]
    require(all(isinstance(t, bool) for t in truths), 'Every statement needs a verdict')
    n = stated_count(public)
    chosen = sorted(o['id'] for o, t in zip(options, truths) if t)
    require(len(chosen) == n, f'Stated count {n} but {len(chosen)} statements are true')
    require(0 < n < len(options), 'Degenerate select-all')
    return json.dumps(chosen, separators=(',', ':')), truths


def review_select_explanation(problem, truths):
    """The private explanation carries one verdict line per statement, in order."""
    options = problem['public']['response']['options']
    lines = problem['explanation']
    found = []
    for option, truth in zip(options, truths):
        head = f"{option['label'].rstrip('.')}: {'true' if truth else 'false'}."
        matches = [line for line in lines if line.startswith(head)]
        require(len(matches) == 1, f"Explanation misstates {option['label']}")
        found.append(lines.index(matches[0]))
    require(found == sorted(found), 'Explanation verdicts out of order')


def must_fail(function, *args):
    try:
        function(*args)
    except (ValueError, KeyError, StopIteration):
        return
    raise AssertionError('Accepted a corrupted fixture')
