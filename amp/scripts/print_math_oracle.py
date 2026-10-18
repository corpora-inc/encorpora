"""Independent checks of the mathematical meaning and text boundaries in print.

Reference values and groupings are handwritten here. The renderer supplies HTML;
this oracle evaluates its MathML, never its generated TeX or parser's own tree.
"""
from fractions import Fraction
from pathlib import Path
import json
import math
import re
import subprocess
import xml.etree.ElementTree as ET


def require(condition, message):
    if not condition:
        raise ValueError(message)


def tag(element):
    return element.tag.rsplit('}', 1)[-1]


class Infix:
    def __init__(self, tokens):
        self.tokens, self.position = tokens, 0

    def peek(self):
        return self.tokens[self.position] if self.position < len(self.tokens) else None

    def take(self):
        item = self.peek()
        self.position += 1
        return item

    def atom(self):
        item = self.take()
        if isinstance(item, Fraction):
            return item
        if item == '+':
            return self.atom()
        if item == '-':
            return -self.atom()
        if item == '(':
            value = self.sum()
            require(self.take() == ')', 'Unclosed MathML fence')
            return value
        raise ValueError(f'Unexpected MathML operand: {item!r}')

    def product(self):
        value = self.atom()
        while True:
            next_item = self.peek()
            if next_item in ('*', '/'):
                self.take()
                other = self.atom()
                value = value * other if next_item == '*' else value / other
            elif isinstance(next_item, Fraction) or next_item == '(':
                value *= self.atom()
            else:
                return value

    def sum(self):
        value = self.product()
        while self.peek() in ('+', '-'):
            operation = self.take()
            other = self.product()
            value = value + other if operation == '+' else value - other
        return value

    def result(self):
        value = self.sum()
        comparisons = {'=': lambda a, b: a == b, '≠': lambda a, b: a != b,
                       '<': lambda a, b: a < b, '>': lambda a, b: a > b,
                       '≤': lambda a, b: a <= b, '≥': lambda a, b: a >= b}
        truths = []
        while self.peek() in comparisons:
            operation = self.take()
            other = self.sum()
            truths.append(comparisons[operation](value, other))
            value = other
        require(self.position == len(self.tokens), 'Unconsumed MathML tokens')
        return all(truths) if truths else value


def evaluate(element, variables=None, branch=1):
    variables = variables or {}
    name, children = tag(element), list(element)
    if name == 'mn':
        return Fraction(''.join(element.itertext()).replace(',', ''))
    if name == 'mi':
        symbol = ''.join(element.itertext())
        require(symbol in variables, f'Unexpected variable: {symbol!r}')
        return Fraction(variables[symbol])
    if name == 'semantics':
        return evaluate(children[0], variables, branch)
    if name == 'mfrac':
        require(len(children) == 2, 'A fraction needs two operands')
        return evaluate(children[0], variables, branch) / evaluate(children[1], variables, branch)
    if name == 'msup':
        require(len(children) == 2, 'A power needs two operands')
        exponent = evaluate(children[1], variables, branch)
        require(exponent.denominator == 1, 'Review fixture expects an integer exponent')
        return evaluate(children[0], variables, branch) ** int(exponent)
    if name == 'msqrt':
        value = evaluate_row(children, variables, branch)
        require(value >= 0, 'Review fixture expects a real square root')
        n, d = math.isqrt(value.numerator), math.isqrt(value.denominator)
        require(n*n == value.numerator and d*d == value.denominator,
                'Rendered radical differs from the exact review fixture')
        return Fraction(n, d)
    if name in ('math', 'mrow', 'mstyle', 'mpadded'):
        if len(children) == 1:
            return evaluate(children[0], variables, branch)
        return evaluate_row(children, variables, branch)
    raise ValueError(f'Unsupported MathML element in arithmetic fixture: {name}')


def evaluate_row(children, variables, branch):
    tokens = []
    for child in children:
        name = tag(child)
        if name in ('annotation', 'mspace'):
            continue
        if name == 'mo':
            symbol = ''.join(child.itertext())
            if symbol == '\u2061':
                continue
            symbol = {'−': '-', '×': '*', '·': '*', '\u2062': '*',
                      '÷': '/', '±': '+' if branch == 1 else '-'}.get(symbol, symbol)
            tokens.append(symbol)
        else:
            tokens.append(evaluate(child, variables, branch))
    return Infix(tokens).result()


def math_roots(markup):
    return [ET.fromstring(value) for value in re.findall(r'<math\b[^>]*>[\s\S]*?</math>', markup)]


# Each expected value is independent of the TypeScript conversion implementation.
ARITHMETIC = [
    ('√100', {}, Fraction(10)),
    ('√(9 + 16)', {}, Fraction(5)),
    ('c = √100 = 10', {'c': 10}, True),
    ('3/x²', {'x': 2}, Fraction(3, 4)),
    ('−3/x²', {'x': 2}, Fraction(-3, 4)),
    ('3/√100', {}, Fraction(3, 10)),
    ('3/(x + 1)²', {'x': 2}, Fraction(1, 3)),
    ('(x + 1)/(x − 1)', {'x': 3}, Fraction(2)),
    ('−x²', {'x': 3}, Fraction(-9)),
    ('(−x)²', {'x': 3}, Fraction(9)),
    ('x^(m+n)', {'x': 2, 'm': 2, 'n': 3}, Fraction(32)),
    ('x^(-2)', {'x': 2}, Fraction(1, 4)),
    ('2^-(2+3)', {}, Fraction(1, 32)),
    ('1/2 + 1/3 = 5/6', {}, True),
    ('8/4/2', {}, Fraction(1)),
    ('8/(4/2)', {}, Fraction(4)),
    ('3.5 + 1.25', {}, Fraction(19, 4)),
    ('5/10 × 1/3', {}, Fraction(1, 6)),
    ('8 ÷ 4 / 2', {}, Fraction(1)),
    ('(A + B)C = AC + BC', {'A': 2, 'B': 3, 'C': 4}, True),
    ('(x + 3)²', {'x': 2}, Fraction(25)),
    ('(−2x)(−3) = 6x', {'x': 2}, True),
    ('b² − 4ac', {'a': 1, 'b': -3, 'c': 2}, Fraction(1)),
    ('(−b ± √(b² − 4ac))/(2a)', {'a': 1, 'b': -3, 'c': 2}, Fraction(2)),
    ('x² ≥ 0', {'x': -3}, True),
]
STRUCTURAL = ['√(−9)²', 'x_(n+1)', 'log_2(8)', '$x_12$']
DELIMITED = [('$x^10$', {'x': 2}, Fraction(1024)), ('$2^(n+1)$', {'n': 2}, Fraction(8)), ('$x^-2$', {'x': 2}, Fraction(1, 4)), (r'\(x^{10}\)', {'x': 2}, Fraction(1024))]
BOUNDARIES = ['Write □ − 4 = 6.', 'Write □−4 = 6.', '5 + 7 = □ + 8.', '200 cm + 35 cm = 235 cm', '200 cm+35 cm=235 cm', 'Wait 1-2 minutes.', 'grades K-12', 'page 3-4', 'the 2nd term', 'the 1st term', 'the 1990s', 'Term 3 = 1 × 4^2 = 16']
LITERAL = ['x^ = 2', 'x + √', '(x + 1', '1 1/2', '2 3', '2x/3y', '3 cm²', '12:30']
PROSE = [
    '$5 or $10', 'A costs $4 each; B costs $3/m.', '2 × $5 = $10.',
    r'Price $5; compute $x^2$.', r'Use $\frac{1}{2}$ of the $10 total.',
    '(−2x)(−3) = 6x. A constant multiplies every term.',
    'Distribute 2x: (2x)(3x) = 6x².',
    'The variable x has coefficient −1.',
    r'$\notacommand{x}$', '<img src=x onerror=alert(1)> + 2',
]


def check_records(records):
    sources = [item[0] for item in ARITHMETIC] + STRUCTURAL + LITERAL + PROSE + [item[0] for item in DELIMITED] + BOUNDARIES
    require(len(records) == len(sources), 'Incomplete print review response')
    by_source = {}
    for source, record in zip(sources, records):
        require(record['source'] == source, 'Print review source order changed')
        require(''.join(s['source'] for s in record['segments']) == source,
                f'Lost source punctuation or whitespace: {source!r}')
        require(not re.search(r'<(?:img|script)\b', record['html'], re.I), 'Unescaped source markup')
        by_source[source] = record
    for source, variables, expected in ARITHMETIC:
        record = by_source[source]
        require(record['tex'] is not None, f'Expected supported notation: {source}')
        roots = math_roots(record['html'])
        require(len(roots) == 1, f'Expected one complete mathematical expression: {source}')
        actual = evaluate(roots[0], variables)
        require(type(actual) is type(expected) and actual == expected,
                f'Changed mathematical meaning: {source}, {actual} != {expected}')
        if '±' in source:
            require(evaluate(roots[0], variables, -1) == 1, 'Lost negative quadratic-formula branch')
    def unwrap(element):
        while tag(element) in ('math', 'semantics', 'mrow', 'mstyle', 'mpadded'):
            children = [c for c in element if tag(c) != 'annotation']
            if len(children) != 1:
                break
            element = children[0]
        return element

    structural_roots = {}
    for source in STRUCTURAL:
        roots = math_roots(by_source[source]['html'])
        require(len(roots) == 1, f'Expected complete structured notation: {source}')
        structural_roots[source] = unwrap(roots[0])
    power = structural_roots[STRUCTURAL[0]]
    require(tag(power) == 'msup' and len(power) == 2
            and tag(unwrap(power[0])) == 'msqrt' and evaluate(power[1]) == 2,
            'Closing radicand parentheses must precede the outer exponent')
    require(evaluate_row(list(unwrap(power[0])), {}, 1) == -9,
            'The negative radicand changed')
    subscript = structural_roots[STRUCTURAL[1]]
    require(tag(subscript) == 'msub' and len(subscript) == 2
            and ''.join(subscript[0].itertext()) == 'x'
            and evaluate(subscript[1], {'n': 4}) == 5,
            'Sequence subscript grouping changed')
    logarithm = structural_roots[STRUCTURAL[2]]
    require(len(logarithm) == 2 and tag(logarithm[0]) == 'msub'
            and ''.join(logarithm[0][0].itertext()) == 'log\u2061'
            and evaluate(logarithm[0][1]) == 2 and evaluate(logarithm[1]) == 8,
            'Logarithm base or argument changed')
    legacy_subscript = structural_roots[STRUCTURAL[3]]
    require(tag(legacy_subscript) == 'msub' and len(legacy_subscript) == 2
            and ''.join(legacy_subscript[0].itertext()) == 'x' and evaluate(legacy_subscript[1]) == 12,
            'Legacy dollar subscript must retain its complete index')
    product = unwrap(math_roots(by_source['5/10 × 1/3']['html'])[0])
    require(len(product) == 3 and tag(unwrap(product[0])) == 'mfrac'
            and tag(product[1]) == 'mo' and ''.join(product[1].itertext()) == '×'
            and tag(unwrap(product[2])) == 'mfrac',
            'A product of fractions must show its two fraction factors')
    for source, variables, expected in DELIMITED:
        roots = math_roots(by_source[source]['html'])
        require(len(roots) == 1 and evaluate(roots[0], variables) == expected,
                f'Delimited notation changed meaning: {source}')
    for source in BOUNDARIES:
        record = by_source[source]
        require(not any(s['kind'] == 'math' for s in record['segments']),
                f'Prose or an incomplete equation was typeset as arithmetic: {source}')
    for source in LITERAL:
        require(by_source[source]['tex'] is None, f'Ambiguous or malformed notation was guessed: {source}')
    for source in PROSE[:3]:
        record = by_source[source]
        require(not any(s['kind'] == 'math' for s in record['segments']),
                f'Currency amount or rate consumed as mathematics: {source}')
        require(source.count('$') == record['html'].count('$'), f'Currency markers lost: {source}')
    for source, expected in [(PROSE[3], '$x^2$'), (PROSE[4], r'$\frac{1}{2}$')]:
        math_segments = [s['source'] for s in by_source[source]['segments'] if s['kind'] == 'math']
        require(math_segments == [expected], f'Explicit TeX/currency boundary changed: {source}')
    sentence = by_source[PROSE[5]]['segments']
    require(any(s['kind'] == 'text' and '. A constant' in s['source'] for s in sentence),
            'Sentence punctuation or article swallowed by mathematics')
    colon_segments = by_source[PROSE[6]]['segments']
    require(all(':' not in s['source'] for s in colon_segments if s['kind'] == 'math'),
            'Prose colon swallowed by mathematics')
    require(any(s['kind'] == 'math' and s['source'] == 'x' for s in by_source[PROSE[7]]['segments']),
            'A standalone reference to x should use mathematical type')
    require(PROSE[8] in by_source[PROSE[8]]['html'], 'Failed TeX did not preserve original source')
    return {'arithmetic': len(ARITHMETIC), 'structural': len(STRUCTURAL), 'literal': len(LITERAL), 'prose': len(PROSE), 'delimited': len(DELIMITED), 'boundaries': len(BOUNDARIES)}


def self_test():
    # These are deliberately wrong renderings of known legacy conversion failures.
    bad = [
        ('<math><mrow><msqrt><mn>1</mn></msqrt><mn>00</mn></mrow></math>', {}, Fraction(10)),
        ('<math><msup><mfrac><mn>3</mn><mi>x</mi></mfrac><mn>2</mn></msup></math>', {'x': 2}, Fraction(3, 4)),
        ('<math><mfrac><mn>8</mn><mfrac><mn>4</mn><mn>2</mn></mfrac></mfrac></math>', {}, Fraction(1)),
    ]
    for markup, variables, expected in bad:
        require(evaluate(ET.fromstring(markup), variables) != expected,
                'Independent oracle accepted a known grouping regression')
    require(evaluate(ET.fromstring('<math><mfrac><mn>3</mn><msup><mi>x</mi><mn>2</mn></msup></mfrac></math>'), {'x': 2}) == Fraction(3, 4),
            'Independent fraction/power evaluator is incorrect')


def review_mutations(records):
    from copy import deepcopy
    sources = [s for s, _, _ in ARITHMETIC] + STRUCTURAL + LITERAL + PROSE + [s for s, _, _ in DELIMITED] + BOUNDARIES
    def changed(source, field, value):
        copy = deepcopy(records)
        copy[sources.index(source)][field] = value
        return copy
    mutations = [
        records[:-1],
        changed(BOUNDARIES[0], 'segments', [{'kind': 'math', 'source': BOUNDARIES[0], 'tex': '-4=6'}]),
        changed(DELIMITED[0][0], 'html', '<math><msup><mi>x</mi><mn>1</mn></msup><mn>0</mn></math>'),
        changed('5/10 × 1/3', 'html', '<math><mfrac><mrow><mfrac><mn>5</mn><mn>10</mn></mfrac><mo>×</mo><mn>1</mn></mrow><mn>3</mn></mfrac></math>'),
        changed('2^-(2+3)', 'html', '<math><msup><mn>2</mn><mrow><mo>−</mo><mn>2</mn><mo>+</mo><mn>3</mn></mrow></msup></math>'),
        changed(STRUCTURAL[0], 'html', '<math><msqrt><msup><mrow><mo>−</mo><mn>9</mn></mrow><mn>2</mn></msup></msqrt></math>'),
        changed(STRUCTURAL[1], 'html', '<math><msub><mi>x</mi><mi>n</mi></msub><mo>+</mo><mn>1</mn></math>'),
        changed(STRUCTURAL[2], 'html', '<math><msub><mi>log</mi><mn>8</mn></msub><mn>2</mn></math>'),
        changed('√100', 'html', '<math><mrow><msqrt><mn>1</mn></msqrt><mn>00</mn></mrow></math>'),
        changed('3/x²', 'html', '<math><msup><mfrac><mn>3</mn><mi>x</mi></mfrac><mn>2</mn></msup></math>'),
        changed(PROSE[5], 'segments', [{'kind': 'math', 'source': PROSE[5], 'tex': '6x.A'}]),
        changed(PROSE[0], 'html', '5 or 10'),
        changed(PROSE[1], 'segments', [{'kind': 'math', 'source': PROSE[1], 'tex': '3/m'}]),
        changed(PROSE[8], 'html', 'notacommand'),
        changed(PROSE[9], 'html', '<img src=x onerror=alert(1)> + 2'),
    ]
    for mutated in mutations:
        try:
            check_records(mutated)
        except (ValueError, ET.ParseError):
            continue
        raise ValueError('Print oracle accepted a deliberately corrupt rendering')
    return len(mutations)


def review_print_math():
    self_test()
    root = Path(__file__).resolve().parent.parent
    result = subprocess.run(['node', '--import', 'tsx', str(root/'scripts/export-print-math.ts')],
                            cwd=root, input=json.dumps([s for s, _, _ in ARITHMETIC] + STRUCTURAL + LITERAL + PROSE + [s for s, _, _ in DELIMITED] + BOUNDARIES),
                            text=True, capture_output=True, timeout=60)
    require(result.returncode == 0, f'Print fixture export failed: {result.stderr[:1000]}')
    records = json.loads(result.stdout)
    report = check_records(records)
    report['rejectedMutations'] = review_mutations(records)
    return report


if __name__ == '__main__':
    print(json.dumps(review_print_math()))
