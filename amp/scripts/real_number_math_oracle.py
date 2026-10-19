"""Independent prompt-only checks for rational and irrational numbers, roots and
scientific notation.

Every answer is recomputed from the public prompt and option labels: Fraction
arithmetic for decimals and powers of 10, the geometric series for repeating
decimals, integer roots (math.isqrt and an integer cube-root search) for root
bounds and comparisons, and Decimal square roots for rounding. No generator
code or generated answer enters a solver. Malformed prompts are rejected.
"""
import copy
import json
import math
import re
import subprocess
from decimal import Decimal, ROUND_HALF_UP, localcontext
from fractions import Fraction
from html.parser import HTMLParser
from pathlib import Path

REAL_NUMBER_CHOICE = frozenset({
    'classify-real-number', 'compare-irrational-values', 'solve-square-cube-equation',
    'standard-to-scientific', 'scientific-operations',
})
REAL_NUMBER = REAL_NUMBER_CHOICE | frozenset({
    'repeating-decimal-to-fraction', 'root-between-integers', 'root-nearest-tenth',
    'scientific-to-standard', 'scientific-times-larger',
})
RESPONSES = {
    'classify-real-number': ('choice', 'Number'),
    'repeating-decimal-to-fraction': ('fraction', 'Fraction'),
    'root-between-integers': ('number', 'Whole number'),
    'root-nearest-tenth': ('number', 'Nearest tenth'),
    'compare-irrational-values': ('choice', 'Number'),
    'solve-square-cube-equation': ('choice', 'Solutions'),
    'scientific-to-standard': ('number', 'Standard form'),
    'standard-to-scientific': ('choice', 'Scientific notation'),
    'scientific-times-larger': ('number', 'Times as large'),
    'scientific-operations': ('choice', 'Scientific notation'),
}
DECIMAL = r'\d+(?:\.\d+)?'
SCI = r'(\d+(?:\.\d+)?) \\times 10\^\{(-?\d+)\}'


def require(condition, message):
    if not condition:
        raise ValueError(message)


def icbrt(n):
    """Greatest integer k with k³ ≤ n, for n ≥ 0, by integer bisection."""
    lo, hi = 0, 1
    while hi ** 3 <= n:
        hi *= 2
    while hi - lo > 1:
        mid = (lo + hi) // 2
        lo, hi = (mid, hi) if mid ** 3 <= n else (lo, mid)
    return lo


def is_square(n):
    return n >= 0 and math.isqrt(n) ** 2 == n


def is_cube(n):
    return icbrt(abs(n)) ** 3 == abs(n)


def number(text):
    """A plain or grouped decimal (with optional minus) as an exact Fraction."""
    text = text.replace('−', '-').replace('{,}', ',')
    m = re.fullmatch(r'(-?)(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?', text)
    require(m is not None, f'Not a decimal: {text!r}')
    whole = m[2].replace(',', '')
    require(',' not in m[2] or len(whole) >= 5, 'Grouping separators only from five digits')
    require(',' in m[2] or len(whole) < 5, 'Five or more digits need grouping')
    value = Fraction(int(whole + (m[3] or '')), 10 ** len(m[3] or ''))
    return -value if m[1] else value


def rational(text):
    m = re.fullmatch(r'(-?)\\frac\{(\d+)\}\{(\d+)\}', text)
    if m:
        require(int(m[3]) != 0, 'Zero denominator')
        value = Fraction(int(m[2]), int(m[3]))
        return -value if m[1] else value
    return number(text)


def scientific(text):
    """(value, coefficient) for 'c \\times 10^{n}'; the coefficient string must be canonical."""
    m = re.fullmatch(SCI, text)
    require(m is not None, f'Not scientific notation: {text!r}')
    require(not ('.' in m[1] and m[1].endswith('0')), 'Trailing zero in coefficient')
    coefficient = Fraction(m[1])
    return coefficient * Fraction(10) ** int(m[2]), coefficient


def normalized(coefficient):
    return 1 <= coefficient < 10


def tex_label(label):
    """An option's TeX: one $…$ expression, or a bare decimal written as prose."""
    if re.fullmatch(r'−?\d+(?:\.\d+)?', label):
        return label.replace('−', '-')
    m = re.fullmatch(r'\$([^$]+)\$', label)
    require(m is not None, f'Option is not one TeX expression: {label!r}')
    require(not re.fullmatch(r'-?\d+(?:\.\d+)?', m[1]), 'A bare number is written as prose')
    return m[1]


def single(options, predicate, message):
    hits = [o['id'] for o in options if predicate(o['label'])]
    require(len(hits) == 1, message + f': {[o["label"] for o in options]}')
    return hits[0]


def check_options(public):
    options = public['response']['options']
    require(len(options) == 4, 'Four options')
    require([o['id'] for o in options] == ['option-a', 'option-b', 'option-c', 'option-d'], 'Option ids')
    require(len({o['label'] for o in options}) == 4, 'Duplicate option labels')
    return options


# ——— Rational or irrational ———
def classify(label):
    """True when the option names a rational number, False when irrational."""
    m = re.fullmatch(r'(.+?)( \(one more 0 each time\))?', label)
    tex, note = tex_label(m[1]), m[2]
    p = re.fullmatch(r'0\.(?P<d>\d)0(?P=d)00(?P=d)000(?P=d)\\ldots', tex)
    require(bool(p) == bool(note), 'The non-repeating pattern must be described')
    if p:
        require(p[1] != '0', 'Pattern digit')
        return False
    if (s := re.fullmatch(r'\\sqrt\{(\d+)\}', tex)):
        return is_square(int(s[1]))
    if (c := re.fullmatch(r'\\sqrt\[3\]\{(\d+)\}', tex)):
        return is_cube(int(c[1]))
    if re.fullmatch(r'\\pi|[2-9]\\pi|\\frac\{\\pi\}\{[2-9]\}', tex):
        return False
    if re.fullmatch(r'0\.\\overline\{\d+\}', tex):
        return True
    rational(tex)  # a fraction, integer or terminating decimal
    return True


def solve_classify(public):
    m = re.fullmatch(r'Which number is (rational|irrational)\?', public['prompt'])
    require(m is not None, 'Classify prompt')
    want = m[1] == 'rational'
    return single(check_options(public), lambda label: classify(label) == want, 'Exactly one option must qualify')


# ——— Repeating decimals ———
def repeating_value(tex):
    m = re.fullmatch(r'(\d+)\.(\d*)\\overline\{(\d+)\}', tex)
    require(m is not None, f'Repeating decimal {tex!r}')
    whole, pre, block = m[1], m[2], m[3]
    p, s = len(block), len(pre)
    require(not all(d == '9' for d in block), 'A block of nines names a terminating decimal')
    require(all(block != block[:d] * (p // d) for d in range(1, p) if p % d == 0), 'Block is not primitive')
    require(not pre or pre[-1] != block[-1], 'Delay could be absorbed into the block')
    # x = whole + pre/10^s + block × (10^-(s+p) + 10^-(s+2p) + …) = … + block / (10^s (10^p − 1)).
    return int(whole) + Fraction(int(pre or '0'), 10 ** s) + Fraction(int(block), 10 ** s * (10 ** p - 1))


def solve_repeating(public):
    m = re.fullmatch(r'Write \$(.+)\$ as a fraction in simplest form\.', public['prompt'])
    require(m is not None, 'Repeating prompt')
    return repeating_value(m[1])


# ——— Roots ———
def root_bounds(index, n):
    k = math.isqrt(n) if index == 2 else icbrt(n)
    require(k ** index < n < (k + 1) ** index, 'The radicand must not be a perfect power')
    return k


def solve_between(public):
    m = re.fullmatch(r'\$\\sqrt(\[3\])?\{(\d+)\}\$ lies between two consecutive whole numbers\. What is the (smaller|larger) one\?', public['prompt'])
    require(m is not None, 'Between prompt')
    k = root_bounds(3 if m[1] else 2, int(m[2]))
    return Fraction(k + (m[3] == 'larger'))


def nearest_tenth(n):
    with localcontext() as context:
        context.prec = 60
        return Fraction(str(Decimal(n).sqrt().quantize(Decimal('0.1'), rounding=ROUND_HALF_UP)))


def solve_tenth(public):
    m = re.fullmatch(r'Find \$\\sqrt\{(\d+)\}\$ to the nearest tenth\.', public['prompt'])
    require(m is not None, 'Tenth prompt')
    n = int(m[1])
    root_bounds(2, n)
    return nearest_tenth(n)


SCALE = 10 ** 30


def interval(tex):
    """Exact value as a closed interval of width at most 10⁻³⁰ (a point when rational)."""
    if (s := re.fullmatch(r'\\sqrt\{(\d+)\}', tex)):
        lo = math.isqrt(int(s[1]) * SCALE ** 2)
    elif (c := re.fullmatch(r'\\sqrt\[3\]\{(\d+)\}', tex)):
        lo = icbrt(int(c[1]) * SCALE ** 3)
    else:
        value = rational(tex)
        return value, value
    return Fraction(lo, SCALE), Fraction(lo + 1, SCALE)


def solve_compare(public):
    m = re.fullmatch(r'Which number is (greatest|least)\?', public['prompt'])
    require(m is not None, 'Compare prompt')
    options = check_options(public)
    spans = {o['id']: interval(tex_label(o['label'])) for o in options}
    ordered = sorted(spans.items(), key=lambda item: item[1][0])
    for (_, a), (_, b) in zip(ordered, ordered[1:]):
        require(a[1] < b[0], 'Values too close to order exactly')
    lows = {math.floor(span[0]) for span in spans.values()}
    require(len(lows) == 1, 'All values lie between the same consecutive whole numbers')
    return ordered[-1][0] if m[1] == 'greatest' else ordered[0][0]


def term(text):
    """A real number named by an option: ('q', Fraction) or ('root', index, n, sign)."""
    m = re.fullmatch(r'(-?)(?:\\sqrt\{(\d+)\}|\\sqrt\[3\]\{(\d+)\})', text)
    if not m:
        return ('q', rational(text))
    sign = -1 if m[1] else 1
    index, n = (2, int(m[2])) if m[2] else (3, int(m[3]))
    if (index == 2 and is_square(n)) or (index == 3 and is_cube(n)):
        return ('q', sign * Fraction(math.isqrt(n) if index == 2 else icbrt(n)))
    return ('root', index, n, sign)


def satisfies(value, power, p):
    if value[0] == 'q':
        return value[1] ** power == p
    _, index, n, sign = value
    # (±ⁱ√n)^power is rational only when power is a multiple of i for non-perfect n.
    if power != index:
        return False
    return sign ** power * n == p


def solve_equation(public):
    m = re.fullmatch(r'Find all real solutions of \$x\^([23]) = ([^$]+)\$\.', public['prompt'])
    require(m is not None, 'Equation prompt')
    power, p = int(m[1]), rational(m[2])
    require(power == 3 or p > 0, 'Square equations need a positive right side')
    count = 2 if power == 2 else 1

    def correct(label):
        o = re.fullmatch(r'\$x = ([^$]+)\$(?: or \$x = ([^$]+)\$)?', label)
        require(o is not None, f'Solution option {label!r}')
        values = [term(t) for t in o.groups() if t is not None]
        return len(set(values)) == len(values) == count and all(satisfies(v, power, p) for v in values)
    return single(check_options(public), correct, 'Exactly one complete solution set')


# ——— Scientific notation ———
def solve_to_standard(public):
    m = re.fullmatch(r'Write \$(.+)\$ in standard form\.', public['prompt'])
    require(m is not None, 'Standard-form prompt')
    value, coefficient = scientific(m[1])
    require(normalized(coefficient), 'The given number must be in scientific notation')
    return value


def solve_to_scientific(public):
    m = re.fullmatch(r'Write ([\d,.]+) in scientific notation\.', public['prompt'])
    require(m is not None, 'Scientific prompt')
    value = number(m[1])
    require(value > 0, 'Positive number')
    options = check_options(public)

    def correct(label):
        v, c = scientific(tex_label(label))
        return v == value and normalized(c)
    return single(options, correct, 'Exactly one option in scientific notation with the same value')


def solve_times(public):
    m = re.fullmatch(r'How many times as large as \$(.+)\$ is \$(.+)\$\?', public['prompt'])
    require(m is not None, 'Times prompt')
    (b, cb), (a, ca) = scientific(m[1]), scientific(m[2])
    require(normalized(ca) and normalized(cb), 'Both numbers in scientific notation')
    require(a > b, 'The first number is the larger')
    return a / b


def solve_operation(public):
    m = re.fullmatch(r'Find \$\((.+)\) (\\times|\\div|\+|-) \((.+)\)\$\. Write the answer in scientific notation\.', public['prompt'])
    require(m is not None, 'Operation prompt')
    (x, cx), (y, cy) = scientific(m[1]), scientific(m[3])
    require(normalized(cx) and normalized(cy), 'Operands in scientific notation')
    value = {'\\times': x * y, '\\div': x / y, '+': x + y, '-': x - y}[m[2]]
    require(value > 0, 'Positive result')
    options = check_options(public)
    for o in options:
        require(normalized(scientific(tex_label(o['label']))[1]), 'Every option must be in scientific notation')
    return single(options, lambda label: scientific(tex_label(label))[0] == value, 'Exactly one option with the exact value')


SOLVERS = {
    'classify-real-number': solve_classify,
    'repeating-decimal-to-fraction': solve_repeating,
    'root-between-integers': solve_between,
    'root-nearest-tenth': solve_tenth,
    'compare-irrational-values': solve_compare,
    'solve-square-cube-equation': solve_equation,
    'scientific-to-standard': solve_to_standard,
    'standard-to-scientific': solve_to_scientific,
    'scientific-times-larger': solve_times,
    'scientific-operations': solve_operation,
}


def solve_real_number(public):
    template = public['templateId']
    require(template in REAL_NUMBER, 'Unknown real-number task')
    require(public.get('figure') is None, 'Unexpected figure')
    kind, label = RESPONSES[template]
    require(public['response']['kind'] == kind and public['response']['label'] == label, 'Response contract')
    return SOLVERS[template](public)


# ——— Stated facts in explanations, feedback and lessons ———
NUM = r'-?\d+(?:\.\d+)?'
# A right-hand side ends the formula or meets the next relation, never another operation.
END = r'(?=\s*(?:$|[<>=,;]|\\approx))'
FACTS = [
    # a^k = b, including (−a)^k and 10^{k}
    (re.compile(r'(?<!\\times )(?<!\\div )(?<![\w.}])\(?(' + NUM + r')\)?\^\{?(\d)\}? = (' + NUM + r')' + END),
     lambda m: Fraction(m[1]) ** int(m[2]) == Fraction(m[3])),
    # c \times 10^{n} = standard form
    (re.compile(r'(?<![\w.}^{(])(\d+(?:\.\d+)?) \\times 10\^\{(-?\d+)\} = (' + NUM + r')' + END),
     lambda m: Fraction(m[1]) * Fraction(10) ** int(m[2]) == Fraction(m[3])),
    # a \times b = c
    (re.compile(r'(?<!\\times )(?<![\w.}^{(])(' + NUM + r') \\times (' + NUM + r') = (' + NUM + r')' + END),
     lambda m: Fraction(m[1]) * Fraction(m[2]) == Fraction(m[3])),
    # \frac{a}{b} = \frac{c}{d} or = c
    (re.compile(r'(-?)\\frac\{(\d+)\}\{(\d+)\} = (-?)(?:\\frac\{(\d+)\}\{(\d+)\}|(\d+(?:\.\d+)?))' + END),
     lambda m: (-1 if m[1] else 1) * Fraction(int(m[2]), int(m[3])) == (-1 if m[4] else 1) * (Fraction(int(m[5]), int(m[6])) if m[5] else Fraction(m[7]))),
    # a < b and a > b between plain numbers; chains overlap
    (re.compile(r'(?<![\w.}^{])(' + NUM + r') ([<>]) (?=(' + NUM + r')' + END + ')'),
     lambda m: (Fraction(m[1]) < Fraction(m[3])) == (m[2] == '<')),
]


def stated_facts(text):
    checks = 0
    for segment in re.findall(r'\$([^$]+)\$', text):
        segment = segment.replace('{,}', '')
        for pattern, holds in FACTS:
            for m in pattern.finditer(segment):
                require(holds(m), f'False statement: {m[0]!r} in {text!r}')
                checks += 1
    return checks


def review_problem(problem):
    public = problem['public']
    checks = sum(stated_facts(t) for t in [*problem['explanation'], problem['hint'], *problem.get('choiceFeedback', {}).values()])
    if public['response']['kind'] == 'choice':
        others = {o['id'] for o in public['response']['options']} - {problem['answer']}
        require(set(problem.get('choiceFeedback', {})) == others, 'Every distractor needs feedback')
    if public['response']['kind'] == 'fraction':
        n, _, d = problem['answer'].partition('/')
        require(math.gcd(int(n), int(d or 1)) == 1, 'Fraction answer must be in simplest form')
    return checks


def review_real_number_fixtures():
    def public(template, prompt, options=None):
        kind, label = RESPONSES[template]
        response = {'kind': kind, 'label': label}
        if options:
            response['options'] = [{'id': f'option-{"abcd"[i]}', 'label': text} for i, text in enumerate(options)]
        return {'templateId': template, 'prompt': prompt, 'response': response}

    cases = [
        (public('classify-real-number', 'Which number is irrational?', [r'$\sqrt{49}$', r'$0.\overline{3}$', r'$\frac{22}{7}$', r'$\sqrt{12}$']), 'option-d'),
        (public('classify-real-number', 'Which number is rational?', [r'$\pi$', r'$\sqrt[3]{27}$', r'$\sqrt{50}$', r'$0.4040040004\ldots$ (one more 0 each time)']), 'option-b'),
        (public('repeating-decimal-to-fraction', r'Write $0.\overline{36}$ as a fraction in simplest form.'), Fraction(4, 11)),
        (public('repeating-decimal-to-fraction', r'Write $0.1\overline{6}$ as a fraction in simplest form.'), Fraction(1, 6)),
        (public('repeating-decimal-to-fraction', r'Write $1.\overline{6}$ as a fraction in simplest form.'), Fraction(5, 3)),
        (public('repeating-decimal-to-fraction', r'Write $0.\overline{142857}$ as a fraction in simplest form.'), Fraction(1, 7)),
        (public('root-between-integers', r'$\sqrt{53}$ lies between two consecutive whole numbers. What is the smaller one?'), 7),
        (public('root-between-integers', r'$\sqrt[3]{100}$ lies between two consecutive whole numbers. What is the larger one?'), 5),
        (public('root-nearest-tenth', r'Find $\sqrt{20}$ to the nearest tenth.'), Fraction(9, 2)),
        (public('root-nearest-tenth', r'Find $\sqrt{2}$ to the nearest tenth.'), Fraction(7, 5)),
        (public('root-nearest-tenth', r'Find $\sqrt{168}$ to the nearest tenth.'), 13),
        (public('root-nearest-tenth', r'Find $\sqrt{99}$ to the nearest tenth.'), Fraction(99, 10)),
        (public('compare-irrational-values', 'Which number is greatest?', [r'$\sqrt{21}$', '4.42', r'$\frac{29}{7}$', r'$\sqrt[3]{116}$']), 'option-d'),
        (public('compare-irrational-values', 'Which number is least?', [r'$\sqrt{30}$', r'$\sqrt[3]{170}$', r'$\frac{16}{3}$', '5.71']), 'option-c'),
        (public('solve-square-cube-equation', r'Find all real solutions of $x^2 = 49$.', [r'$x = 7$', r'$x = 7$ or $x = -7$', r'$x = \frac{49}{2}$', r'$x = \frac{49}{2}$ or $x = -\frac{49}{2}$']), 'option-b'),
        (public('solve-square-cube-equation', r'Find all real solutions of $x^3 = -64$.', [r'$x = 4$', r'$x = 4$ or $x = -4$', r'$x = -4$', r'$x = -\frac{64}{3}$']), 'option-c'),
        (public('solve-square-cube-equation', r'Find all real solutions of $x^2 = 12$.', [r'$x = \sqrt{12}$', r'$x = 6$', r'$x = \sqrt{12}$ or $x = -\sqrt{12}$', r'$x = 6$ or $x = -6$']), 'option-c'),
        (public('scientific-to-standard', r'Write $3.07 \times 10^{-4}$ in standard form.'), Fraction(307, 10 ** 6)),
        (public('scientific-to-standard', r'Write $4.2 \times 10^{5}$ in standard form.'), 420000),
        (public('standard-to-scientific', r'Write 0.000307 in scientific notation.', [r'$3.07 \times 10^{4}$', r'$30.7 \times 10^{-5}$', r'$3.07 \times 10^{-4}$', r'$3.07 \times 10^{-3}$']), 'option-c'),
        (public('scientific-times-larger', r'How many times as large as $2 \times 10^{5}$ is $6 \times 10^{8}$?'), 3000),
        (public('scientific-times-larger', r'How many times as large as $5 \times 10^{3}$ is $2 \times 10^{7}$?'), 4000),
        (public('scientific-operations', r'Find $(3 \times 10^{4}) \times (4 \times 10^{6})$. Write the answer in scientific notation.', [r'$1.2 \times 10^{10}$', r'$1.2 \times 10^{11}$', r'$7 \times 10^{10}$', r'$1.2 \times 10^{25}$']), 'option-b'),
        (public('scientific-operations', r'Find $(3.2 \times 10^{5}) + (4.5 \times 10^{4})$. Write the answer in scientific notation.', [r'$7.7 \times 10^{5}$', r'$7.7 \times 10^{9}$', r'$3.65 \times 10^{5}$', r'$7.7 \times 10^{4}$']), 'option-c'),
    ]
    for case, expected in cases:
        require(solve_real_number(case) == expected, f'Fixture {case["prompt"]!r}')
    rejected = [
        public('repeating-decimal-to-fraction', r'Write $0.\overline{99}$ as a fraction in simplest form.'),
        public('repeating-decimal-to-fraction', r'Write $0.\overline{33}$ as a fraction in simplest form.'),
        public('root-between-integers', r'$\sqrt{49}$ lies between two consecutive whole numbers. What is the smaller one?'),
        public('classify-real-number', 'Which number is irrational?', [r'$\sqrt{2}$', r'$\pi$', '1.5', '−3']),
        public('standard-to-scientific', r'Write 0.000307 in scientific notation.', [r'$3.07 \times 10^{-4}$', r'$30.7 \times 10^{-5}$', r'$3.070 \times 10^{-4}$', r'$3.07 \times 10^{-3}$']),
        public('compare-irrational-values', 'Which number is greatest?', [r'$\frac{9}{2}$', '4.5', r'$\sqrt{20}$', r'$\sqrt[3]{90}$']),
        public('scientific-to-standard', r'Write $30.7 \times 10^{4}$ in standard form.'),
        public('standard-to-scientific', r'Write 4200000 in scientific notation.', [r'$4.2 \times 10^{6}$', r'$4.2 \times 10^{5}$', r'$4.2 \times 10^{-6}$', r'$42 \times 10^{5}$']),
    ]
    for case in rejected:
        try:
            solve_real_number(case)
        except ValueError:
            continue
        raise ValueError(f'Malformed fixture accepted: {case["prompt"]!r}')
    require(stated_facts(r'$4.4^2 = 19.36$, $(-7)^2 = 49$, $10^{2} = 100$, $\frac{27}{99} = \frac{3}{11}$, $16 < 20 < 25$') == 6, 'Fact checker coverage')
    for false in [r'$4.4^2 = 19.37$', r'$\frac{27}{99} = \frac{3}{10}$', r'$20 < 19.8025$', r'$3 \times 7.3 = 21.8$']:
        try:
            stated_facts(false)
        except ValueError:
            continue
        raise ValueError('False fact accepted: ' + false)
    return len(cases) + len(rejected)


# ——— Authored content: worksheets, lessons, figures ———
_EXPORT = None


def content(data=None):
    global _EXPORT
    if data is not None:
        return data
    if _EXPORT is None:
        app = Path(__file__).resolve().parent.parent
        _EXPORT = subprocess.check_output(['node', '--import', 'tsx', 'scripts/real-number-content-oracle.ts'], cwd=app, text=True)
    return json.loads(_EXPORT)


def as_number(answer):
    return Fraction(answer.replace('−', '-'))


WORKSHEET_BREADTH = {
    'classify-real-number': lambda ps: {'Which number is rational?', 'Which number is irrational?'} <= {p['prompt'] for p in ps},
    'repeating-decimal-to-fraction': lambda ps: all(any(re.search(pattern, p['prompt']) for p in ps) for pattern in [r'\{\d\}', r'\{\d\d\}', r'\{\d\d\d\}', r'0\.\d\\overline', r'\$[1-9]\.']),
    'root-between-integers': lambda ps: any('[3]' in p['prompt'] for p in ps) and any('[3]' not in p['prompt'] for p in ps) and any('larger' in p['prompt'] for p in ps) and any('smaller' in p['prompt'] for p in ps),
    'root-nearest-tenth': lambda ps: any(solve_tenth(p) ** 2 > int(re.search(r'\{(\d+)\}', p['prompt'])[1]) for p in ps) and any(solve_tenth(p) ** 2 < int(re.search(r'\{(\d+)\}', p['prompt'])[1]) for p in ps),
    'compare-irrational-values': lambda ps: {'Which number is greatest?', 'Which number is least?'} <= {p['prompt'] for p in ps},
    'solve-square-cube-equation': lambda ps: all(any(re.search(pattern, p['prompt']) for p in ps) for pattern in [r'x\^2 = \d+\$', r'x\^2 = \\frac', r'x\^3 = -', r'x\^3 = \d']),
    'scientific-to-standard': lambda ps: any('{-' in p['prompt'] for p in ps) and any(re.search(r'\{\d', p['prompt']) for p in ps),
    'standard-to-scientific': lambda ps: any('Write 0.' in p['prompt'] for p in ps) and any('Write 0.' not in p['prompt'] for p in ps),
    'scientific-times-larger': lambda ps: any(solve_times(p).denominator > 1 for p in ps),
    'scientific-operations': lambda ps: all(any(f') {op} (' in p['prompt'] for p in ps) for op in ['\\times', '\\div', '+', '-']),
}


def review_real_number_content(data=None):
    data = content(data)
    checks = 0
    templates = set()
    for sheet in data['worksheets']:
        problems = sheet['problems']
        require(len(problems) == 12, 'Worksheet length')
        keys = {(p['public']['prompt'], tuple(sorted(o['label'] for o in p['public']['response'].get('options', [])))) for p in problems}
        require(len(keys) == 12, 'Repeated worksheet problem')
        for p in problems:
            require(p['public']['templateId'] == sheet['templateId'], 'Worksheet template')
            solved = solve_real_number(p['public'])
            actual = p['answer'] if sheet['templateId'] in REAL_NUMBER_CHOICE else as_number(p['answer'])
            require(actual == solved, f'Worksheet answer {p["public"]["prompt"]!r}')
            checks += review_problem(p)
        require(WORKSHEET_BREADTH[sheet['templateId']]([p['public'] for p in problems]), 'Worksheet lacks required breadth: ' + sheet['templateId'])
        templates.add(sheet['templateId'])
    require(templates == REAL_NUMBER, 'Every template has printable worksheets')
    lessons = data['lessons']
    require(sorted(t for lesson in lessons for t in lesson['templateIds']) == sorted(REAL_NUMBER), 'Each template in exactly one lesson')
    for lesson in lessons:
        worked = lesson['workedExample']
        checks += review_worked_example(worked)
        for text in [*worked['steps'], *lesson['pitfalls'], lesson['summary'], *(p for s in lesson['sections'] for p in s['paragraphs'])]:
            checks += stated_facts(text)
    checks += review_figures(data['figures'])
    return {'worksheets': len(data['worksheets']), 'checkedFacts': checks, 'lessons': len(lessons), 'figures': len(data['figures'])}


def review_worked_example(worked):
    prompt, answer = worked['prompt'], worked['answer']
    for template in REAL_NUMBER - REAL_NUMBER_CHOICE:
        kind, label = RESPONSES[template]
        try:
            expected = SOLVERS[template]({'templateId': template, 'prompt': prompt, 'response': {'kind': kind, 'label': label}})
        except ValueError:
            continue
        require(as_number(answer) == expected, 'Worked example answer: ' + prompt)
        return 1
    if prompt.startswith('Find all real solutions'):
        options = [{'id': 'option-a', 'label': answer}]
        m = re.fullmatch(r'Find all real solutions of \$x\^([23]) = ([^$]+)\$\.', prompt)
        require(m is not None, 'Worked equation prompt')
        power, p = int(m[1]), rational(m[2])
        o = re.fullmatch(r'\$x = ([^$]+)\$(?: or \$x = ([^$]+)\$)?', options[0]['label'])
        values = [term(t) for t in o.groups() if t is not None]
        require(len(set(values)) == len(values) == (2 if power == 2 else 1) and all(satisfies(v, power, p) for v in values), 'Worked equation answer')
        return 1
    m = re.fullmatch(r'Find \$\((.+)\) (\\times|\\div|\+|-) \((.+)\)\$\. Write the answer in scientific notation\.', prompt)
    require(m is not None, 'Unrecognized worked example: ' + prompt)
    x, y = scientific(m[1])[0], scientific(m[3])[0]
    value, coefficient = scientific(tex_label(answer))
    require(normalized(coefficient) and value == {'\\times': x * y, '\\div': x / y, '+': x + y, '-': x - y}[m[2]], 'Worked operation answer')
    return 1


class Elements(HTMLParser):
    """Collect every element's attributes in document order."""

    def __init__(self, html):
        super().__init__()
        self.items = []
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        self.items.append((tag, dict(attrs)))

    handle_startendtag = handle_starttag

    def having(self, name):
        return [a for _, a in self.items if name in a]


def review_figures(figures):
    by_kind = {f['kind']: Elements(f['html']) for f in figures}
    require(set(by_kind) == {'repeating-decimal-shift', 'root-zoom', 'root-solutions', 'decimal-point-shift', 'scientific-regroup'}, 'Figure inventory')
    checks = 0
    # Repeating decimal: the shifted copy has the same tail, and the difference is the block.
    shift = by_kind['repeating-decimal-shift']
    table = shift.having('data-block')[0]
    block, multiplier = table['data-block'], int(table['data-multiplier'])
    require(multiplier == 10 ** len(block), 'Multiplier shifts one block')
    rows = {a['data-row']: a['data-value'] for a in shift.having('data-row')}
    x = Fraction(int(block), 10 ** len(block) - 1)
    for name, factor in [('100x', 100), ('x', 1)]:
        whole, tail = rows[name].split('.')
        require(tail == (block * 6)[:len(tail)], 'Tail repeats the block: ' + name)
        require(int(whole) == math.floor(factor * x), 'Whole part: ' + name)
    require(Fraction(rows['100x']) - Fraction(rows['x']) == Fraction(rows['99x']) == (multiplier - 1) * x, 'Subtraction cancels the tails')
    checks += 1
    # Root zoom: positions to scale, squares exact, and the root caught between labeled squares.
    zoom = by_kind['root-zoom']
    lines = {a['data-line']: a for a in zoom.having('data-number-line')}
    require(set(lines) == {'top', 'bottom'}, 'Two number lines')
    for name, line in lines.items():
        lo, hi = map(Fraction, line['data-number-line'].split(','))
        x0, x1 = Fraction(line['data-x0']), Fraction(line['data-x1'])
        ticks = sorted((Fraction(a['data-tick']), a.get('data-square')) for a in zoom.having('data-tick') if a['data-line'] == name)
        for tick, square in ticks:
            require(lo <= tick <= hi, 'Tick on its line')
            if square:
                require(tick ** 2 == Fraction(square), f'Square label {tick}')
        marker = next(a for a in zoom.having('data-root') if a['data-line'] == name)
        n = int(marker['data-root'])
        root = math.sqrt(n)
        position = float(x0) + (root - float(lo)) / float(hi - lo) * float(x1 - x0)
        require(abs(position - float(marker['data-x'])) < 0.01, 'Root drawn to scale')
        below = [t for t, s in ticks if s and t ** 2 < n]
        above = [t for t, s in ticks if s and t ** 2 > n]
        require(below and above, 'Root caught between labeled squares')
        checks += len(ticks) + 1
    # Root solutions: outputs are the powers; solutions are exactly the inputs reaching the target.
    targets = {2: 49, 3: -64}
    for a in by_kind['root-solutions'].having('data-input'):
        value, power, output = int(a['data-input']), int(a['data-power']), int(a['data-output'])
        require(value ** power == output, 'Mapping output')
        require((a['data-solution'] == 'true') == (output == targets[power]), 'Solution marking')
        checks += 1
    # Decimal point shift: digits keep their order and move by the exponent.
    shift = by_kind['decimal-point-shift']
    exponent = int(shift.having('data-exponent')[0]['data-exponent'])
    cells = shift.having('data-place')
    groups, current = [], None
    for tag, attrs in shift.items:
        if 'data-row' in attrs:
            current = []
            groups.append((attrs['data-row'], current))
        elif 'data-place' in attrs and current is not None:
            current.append(attrs)
    require(len(groups) == 2 and len(cells) == sum(len(g) for _, g in groups), 'Two rows of digits')
    values = [sum(Fraction(int(c['data-digit'])) * Fraction(10) ** int(c['data-place']) for c in g) for _, g in groups]
    require(values[1] == values[0] * 10 ** exponent, 'Second row is the first times the power of 10')
    require(number(groups[0][0]) == values[0] and number(groups[1][0].replace(',', '{,}')) == values[1], 'Row labels match their digits')
    moved = [(int(c['data-place']), c['data-digit']) for c in groups[1][1] if c.get('data-fill') != 'true']
    require(moved == [(int(c['data-place']) + exponent, c['data-digit']) for c in groups[0][1]], 'Each digit moves by the exponent')
    require(all(c['data-digit'] == '0' and 0 <= int(c['data-place']) < min(p for p, _ in moved) for c in groups[1][1] if c.get('data-fill') == 'true'), 'Zeros fill only the empty places')
    checks += 1
    # Regrouping: every row names the same product; the last is in scientific notation.
    product = Fraction(3 * 10 ** 4) * Fraction(4 * 10 ** 6)
    rows = by_kind['scientific-regroup'].having('data-step')
    for a in rows:
        require(Fraction(a['data-coefficient']) * Fraction(10) ** int(a['data-exponent']) == product, 'Regrouped value')
    require(normalized(Fraction(rows[-1]['data-coefficient'])), 'Final coefficient')
    checks += len(rows)
    return checks


def review_content_mutations():
    data = content()
    mutants = []
    bad = copy.deepcopy(data); bad['lessons'][0]['workedExample']['answer'] = '4/13'; mutants.append(bad)
    bad = copy.deepcopy(data); bad['worksheets'][0]['problems'][1] = bad['worksheets'][0]['problems'][0]; mutants.append(bad)
    bad = copy.deepcopy(data); bad['worksheets'][3]['problems'][0]['explanation'].append('A false check: $4.4^2 = 19.63$.'); mutants.append(bad)
    bad = copy.deepcopy(data); bad['worksheets'][-1]['problems'][0]['answer'] = 'option-z'; mutants.append(bad)
    bad = copy.deepcopy(data); bad['worksheets'][10]['problems'][2]['answer'] = '999'; mutants.append(bad)
    bad = copy.deepcopy(data); bad['lessons'][1]['sections'][1]['paragraphs'][0] = bad['lessons'][1]['sections'][1]['paragraphs'][0].replace('19.36', '19.46'); mutants.append(bad)
    replacements = {
        'repeating-decimal-shift': ('data-value="0.272727"', 'data-value="0.272772"'),
        'root-zoom': ('data-square="19.8025"', 'data-square="19.8125"'),
        'root-solutions': ('data-output="-64"', 'data-output="64"'),
        'decimal-point-shift': ('data-exponent="5"', 'data-exponent="4"'),
        'scientific-regroup': ('data-exponent="11"', 'data-exponent="10"'),
    }
    for index, figure in enumerate(data['figures']):
        old, new = replacements[figure['kind']]
        require(old in figure['html'], 'Figure mutation did not apply: ' + figure['kind'])
        bad = copy.deepcopy(data)
        bad['figures'][index]['html'] = figure['html'].replace(old, new, 1)
        mutants.append(bad)
    for bad in mutants:
        try:
            review_real_number_content(bad)
        except (ValueError, KeyError, TypeError, StopIteration, AttributeError, IndexError):
            pass
        else:
            raise ValueError('Corrupted content accepted')
    return len(mutants)


if __name__ == '__main__':
    print(review_real_number_fixtures())
    print(review_real_number_content())
    print({'contentMutantsRejected': review_content_mutations()})
