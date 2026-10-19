"""Independent exact checks of signed-fraction, complex-fraction and fractional-power problems.

Values come from a small TeX arithmetic reader over the public prompt. Roots are
accepted only when an integer nth root of numerator and denominator exists.
"""
import copy
import re
from fractions import Fraction
from math import gcd

RATIONAL_TYPES = frozenset({
    'signed-fraction-sum', 'signed-fraction-product', 'complex-fraction', 'rational-power',
})
SKILLS = {
    'signed-fraction-sum': 'signed-addition',
    'signed-fraction-product': 'signed-multiplication',
    'complex-fraction': 'complex-fractions',
    'rational-power': 'rational-exponents',
}
SUFFIX = ' Give an exact fraction or integer.'
F = r'\\frac\{[1-9][0-9]*\}\{[1-9][0-9]*\}'
P = rf'(?:{F}|[1-3])'


def require(condition, message):
    if not condition:
        raise ValueError(message)


def integer_root(value, n):
    require(type(value) is int and value >= 0 and n >= 2, 'Root needs a nonnegative integer')
    low, high = 0, 1
    while high ** n <= value:
        high *= 2
    while low < high:
        middle = (low + high + 1) // 2
        if middle ** n <= value:
            low = middle
        else:
            high = middle - 1
    require(low ** n == value, 'Root is not an exact integer')
    return low


def exact_root(value, n):
    require(value > 0, 'Roots here require a positive radicand')
    return Fraction(integer_root(value.numerator, n), integer_root(value.denominator, n))


def power(base, exponent):
    """Integer powers by repeated multiplication; m/n powers as (nth root)^m."""
    if exponent.denominator != 1:
        base = exact_root(base, exponent.denominator)
    require(base != 0 or exponent > 0, 'Zero has no negative or zero power here')
    value = Fraction(1)
    for _ in range(abs(exponent.numerator)):
        value *= base
    return 1 / value if exponent < 0 else value


TOKEN = re.compile(r'\\left\(|\\right\)|\\dfrac|\\frac|\\sqrt|\\times|\\div|[0-9]+|[-+(){}\[\]^/]|\s+')


def tokens(source):
    result, position = [], 0
    while position < len(source):
        match = TOKEN.match(source, position)
        require(match is not None, f'Unsupported TeX near {source[position:position + 12]!r}')
        if not match.group().isspace():
            result.append(match.group())
        position = match.end()
    return result


def evaluate(source):
    """Exact value of the restricted TeX grammar; exponentiation binds before unary minus."""
    items = tokens(source)
    position = 0

    def peek():
        return items[position] if position < len(items) else None

    def take(expected=None):
        nonlocal position
        require(position < len(items), 'Incomplete TeX expression')
        token = items[position]
        require(expected is None or token == expected, f'Expected {expected}, found {token}')
        position += 1
        return token

    def group():
        take('{'); value = expression(); take('}')
        return value

    def exponent():
        take('{')
        sign = -1 if peek() == '-' else 1
        if sign < 0:
            take()
        numerator = take(); require(numerator.isdigit(), 'Exponent needs digits')
        value = Fraction(int(numerator))
        if peek() == '/':
            take(); denominator = take()
            require(denominator.isdigit() and int(denominator) > 0, 'Exponent denominator must be positive')
            value /= int(denominator)
        take('}')
        return sign * value

    def atom():
        token = take()
        if token.isdigit():
            require(token == '0' or not token.startswith('0'), 'Leading zero')
            return Fraction(int(token))
        if token in ('\\frac', '\\dfrac'):
            numerator = group(); denominator = group()
            require(denominator != 0, 'Division by zero')
            return numerator / denominator
        if token == '\\left(':
            value = expression(); take('\\right)')
            return value
        if token == '(':
            value = expression(); take(')')
            return value
        if token == '\\sqrt':
            n = 2
            if peek() == '[':
                take(); index = take(); take(']')
                require(index.isdigit() and int(index) >= 2, 'Invalid root index')
                n = int(index)
            return exact_root(group(), n)
        raise ValueError(f'Unexpected TeX token {token}')

    def raised():
        value = atom()
        if peek() == '^':
            take(); value = power(value, exponent())
        return value

    def unary():
        if peek() == '-':
            take(); return -unary()
        return raised()

    def product():
        value = unary()
        while peek() in ('\\times', '\\div'):
            operator = take(); right = unary()
            if operator == '\\div':
                require(right != 0, 'Division by zero')
                value /= right
            else:
                value *= right
        return value

    def expression():
        value = product()
        while peek() in ('+', '-'):
            operator = take(); right = product()
            value = value + right if operator == '+' else value - right
        return value

    value = expression()
    require(position == len(items), 'Trailing TeX tokens')
    return value


def lowest(source):
    """Every displayed given fraction must already be in lowest terms."""
    for n, d in re.findall(r'\\frac\{([0-9]+)\}\{([0-9]+)\}', source):
        require(gcd(int(n), int(d)) == 1 and int(d) > 1, 'Given fraction is not in lowest terms')


def braces(source, start):
    require(source[start] == '{', 'Expected a TeX group')
    depth = 0
    for index in range(start, len(source)):
        depth += {'{': 1, '}': -1}.get(source[index], 0)
        if depth == 0:
            return source[start + 1:index], index + 1
    raise ValueError('Unclosed TeX group')


def expression_of(public):
    template = public.get('templateId')
    require(template in RATIONAL_TYPES, 'Unknown rational family')
    require(public.get('templateVersion') == 1 and public.get('skillId') == SKILLS[template],
            'Wrong rational version or skill')
    require(public.get('response') == {'kind': 'fraction', 'label': 'Exact value'}, 'Wrong rational response')
    prompt = public.get('prompt', '')
    verb = {'signed-fraction-sum': 'Calculate', 'signed-fraction-product': 'Calculate',
            'complex-fraction': 'Simplify', 'rational-power': 'Evaluate'}[template]
    match = re.fullmatch(rf'{verb} \$(.+)\$\.' + re.escape(SUFFIX), prompt)
    require(match is not None, 'Malformed rational prompt')
    source = match[1]
    lowest(source)
    second = rf'(?:{F}|\\left\(-{F}\\right\))'
    if template == 'signed-fraction-sum':
        shape = re.fullmatch(rf'-?({F}) ([+-]) ({second})', source)
        require(shape is not None, 'Malformed signed sum')
        denominators = re.findall(r'\\frac\{[0-9]+\}\{([0-9]+)\}', source)
        require(len(denominators) == 2 and denominators[0] != denominators[1], 'Sum needs different denominators')
    elif template == 'signed-fraction-product':
        require(re.fullmatch(rf'-?{F} \\(?:times|div) {second}', source) is not None, 'Malformed signed product')
    elif template == 'complex-fraction':
        require(source.startswith('\\dfrac'), 'Complex fraction needs a main fraction bar')
        top, end = braces(source, len('\\dfrac'))
        bottom, end = braces(source, end)
        require(end == len(source), 'Trailing complex-fraction text')
        part = rf'(?:{F}|{F} [+-] {P}|{P} [+-] {F})'
        require(re.fullmatch(rf'-?{F}|{part}', top) and re.fullmatch(part, bottom), 'Malformed complex-fraction part')
        require(not top.startswith('-') or re.fullmatch(rf'-{F}', top), 'Only a single numerator fraction may be negated')
        require(evaluate(bottom) != 0, 'Complex fraction denominator is zero')
    else:
        shape = re.fullmatch(rf'(\\left\(({F})\\right\)|[1-9][0-9]*)\^\{{(-?[1-9])/([2-5])\}}', source)
        require(shape is not None, 'Malformed fractional power')
        m, n = int(shape[3]), int(shape[4])
        require(gcd(abs(m), n) == 1, 'Exponent is not in lowest terms')
        base = evaluate(shape[1])
        require(base > 0 and base != 1, 'Fractional powers here need a positive base other than 1')
    return source


def solve_rational(public):
    return evaluate(expression_of(public))


def equalities(text):
    """Every explicit equality chain in worked text must hold exactly."""
    results = []
    for source in re.findall(r'\$([^$]+)\$', text):
        if '=' not in source:
            continue
        values = [evaluate(piece.strip()) for piece in source.split('=')]
        require(all(value == values[0] for value in values), f'False rational equality: {source}')
        results.append(values)
    return results


def lowest_tex(value):
    magnitude = abs(value)
    text = str(magnitude.numerator) if magnitude.denominator == 1 else f'\\frac{{{magnitude.numerator}}}{{{magnitude.denominator}}}'
    return ('-' if value < 0 else '') + text


def review_explanation(problem):
    public = problem['public']
    source = expression_of(public)
    answer = evaluate(source)
    steps = problem.get('explanation')
    require(isinstance(steps, list) and len(steps) >= 4 and all(isinstance(s, str) and s.strip() for s in steps),
            'Incomplete rational explanation')
    require(isinstance(problem.get('hint'), str) and problem['hint'].strip(), 'Missing rational hint')
    chains = [chain for step in steps for chain in equalities(step)]
    require(len(chains) >= 2, 'Missing explicit rational equalities')
    template = public['templateId']
    final = equalities(steps[-1]) if template == 'rational-power' else equalities(steps[-2])
    require(final and final[-1][-1] == answer, 'Worked steps do not reach the answer')
    require(lowest_tex(answer) in steps[-1] + steps[-2], 'Answer not written in lowest terms')
    if template == 'rational-power':
        require(source + ' = ' in steps[-1], 'Final power step changes the given expression')
    else:
        require(steps[0].startswith(('Subtracting', 'The expression', 'Dividing', 'Multiply', 'The main')) and source in steps[0],
                'First step does not restate the given expression')
        check = steps[-1]
        require(check.startswith('Check'), 'Missing reverse-operation check')
        (values,) = equalities(check)
        if template == 'complex-fraction':
            top, _ = braces(source, len('\\dfrac'))
            expected = evaluate(top)
        else:
            expected = evaluate(re.match(rf'-?{F}', source)[0])
        require(values[-1] == expected, 'Check does not recover a given value')
        require(check.split('$')[1].startswith(lowest_tex(answer) + ' '), 'Check does not start from the answer')
    return len(chains)


def fixture(template, source):
    verb = {'signed-fraction-sum': 'Calculate', 'signed-fraction-product': 'Calculate',
            'complex-fraction': 'Simplify', 'rational-power': 'Evaluate'}[template]
    return {'id': 'fixture', 'templateId': template, 'templateVersion': 1, 'seed': 'fixture',
            'skillId': SKILLS[template], 'prompt': f'{verb} ${source}$.' + SUFFIX,
            'response': {'kind': 'fraction', 'label': 'Exact value'}}


def review_fixtures():
    for source, expected in [
        (r'-2^{2}', -4), (r'\left(-2\right)^{2}', 4), (r'\frac{1}{2} - \frac{1}{3} \times 3', Fraction(-1, 2)),
        (r'\sqrt[3]{\frac{8}{27}}', Fraction(2, 3)), (r'\sqrt{\frac{9}{4}}', Fraction(3, 2)),
        (r'\left(\frac{8}{27}\right)^{-2/3}', Fraction(9, 4)), (r'\dfrac{1}{\frac{4}{9}}', Fraction(9, 4)),
        (r'\frac{-4 + 1}{8}', Fraction(-3, 8)), (r'-\frac{4 \times 3}{9 \times 2}', Fraction(-2, 3)),
    ]:
        require(evaluate(source) == expected, 'Independent TeX arithmetic mismatch')
    cases = [
        ('signed-fraction-sum', r'-\frac{1}{2} - \left(-\frac{1}{8}\right)', Fraction(-3, 8)),
        ('signed-fraction-sum', r'-\frac{5}{9} + \frac{7}{6}', Fraction(11, 18)),
        ('signed-fraction-sum', r'\frac{3}{4} - \frac{5}{6}', Fraction(-1, 12)),
        ('signed-fraction-product', r'\frac{3}{2} \div \left(-\frac{17}{12}\right)', Fraction(-18, 17)),
        ('signed-fraction-product', r'-\frac{4}{9} \times \left(-\frac{3}{2}\right)', Fraction(2, 3)),
        ('complex-fraction', r'\dfrac{\frac{5}{9} - 3}{\frac{1}{9}}', Fraction(-22)),
        ('complex-fraction', r'\dfrac{\frac{3}{2}}{\frac{19}{12} + \frac{1}{8}}', Fraction(36, 41)),
        ('complex-fraction', r'\dfrac{-\frac{2}{3}}{\frac{5}{6}}', Fraction(-4, 5)),
        ('complex-fraction', r'\dfrac{2 - \frac{1}{4}}{\frac{1}{2} - \frac{5}{6}}', Fraction(-21, 4)),
        ('rational-power', r'32^{-2/5}', Fraction(1, 4)),
        ('rational-power', r'\left(\frac{16}{81}\right)^{-3/4}', Fraction(27, 8)),
        ('rational-power', r'\left(\frac{4}{9}\right)^{3/2}', Fraction(8, 27)),
    ]
    for template, source, expected in cases:
        require(solve_rational(fixture(template, source)) == expected, 'Handwritten rational fixture mismatch')
    bad = [
        fixture('signed-fraction-sum', r'\frac{2}{4} + \frac{1}{3}'),
        fixture('signed-fraction-sum', r'\frac{1}{4} + \frac{3}{4}'),
        fixture('signed-fraction-sum', r'\frac{1}{4} + -\frac{1}{3}'),
        fixture('signed-fraction-product', r'\frac{1}{4} \div \frac{0}{3}'),
        fixture('complex-fraction', r'\dfrac{\frac{1}{2}}{\frac{1}{2} - \frac{1}{2}}'),
        fixture('complex-fraction', r'\frac{\frac{1}{2}}{\frac{1}{3}}'),
        fixture('rational-power', r'\left(\frac{8}{27}\right)^{2/6}'),
        fixture('rational-power', r'\left(\frac{2}{3}\right)^{1/2}'),
        fixture('rational-power', r'\left(-\frac{8}{27}\right)^{1/3}'),
        fixture('rational-power', r'1^{1/2}'),
    ]
    wrong = copy.deepcopy(fixture(*cases[0][:2])); wrong['skillId'] = 'rational-stories'; bad.append(wrong)
    wrong = copy.deepcopy(fixture(*cases[0][:2])); wrong['prompt'] = wrong['prompt'].removesuffix(SUFFIX); bad.append(wrong)
    wrong = copy.deepcopy(fixture(*cases[0][:2])); wrong['response'] = {'kind': 'number', 'label': 'Exact value'}; bad.append(wrong)
    for item in bad:
        try:
            solve_rational(item)
        except (ValueError, ZeroDivisionError):
            continue
        raise ValueError('Malformed rational fixture was accepted: ' + item['prompt'])
    for text in [r'$\frac{1}{2} + \frac{1}{3} = \frac{2}{5}$', r'$\sqrt{8} = 2$', r'$\frac{4}{6} = \frac{3}{4}$']:
        try:
            equalities(text)
        except ValueError:
            continue
        raise ValueError('False rational equality was accepted')
    return {'handwritten': len(cases), 'rejectedMalformed': len(bad)}


class RationalCorpus:
    """Variety checks over public givens only."""

    def __init__(self):
        self.rows = {template: [] for template in RATIONAL_TYPES}

    def record(self, public, solved=None):
        require(set(public) == {'id', 'templateId', 'templateVersion', 'seed', 'skillId', 'prompt', 'response'},
                'Unexpected or missing public rational field')
        answer = solve_rational(public)
        require(solved is None or solved == answer, 'Independent rational result mismatch')
        self.rows[public['templateId']].append((expression_of(public), answer))

    def finish(self, count):
        report = {}
        for template, rows in self.rows.items():
            require(len(rows) == count, 'Incomplete rational corpus')
            sources = {source for source, _ in rows}
            # Exact nth-power bases bound the fractional-power space; the others draw from much larger spaces.
            require(len(sources) >= count * (0.2 if template == 'rational-power' else 0.9), 'Insufficient rational variety')
            answers = [answer for _, answer in rows]
            require(any(a < 0 for a in answers) or template == 'rational-power', 'Missing negative results')
            require(any(a > 0 for a in answers) and all(a != 0 for a in answers), 'Missing positive or unexpected zero results')
            require(any(a.denominator > 1 for a in answers), 'Missing fractional results')
            require(all(a.denominator not in (10, 100, 1000) for a in answers), 'Decimal-display denominator in a fraction answer')
            if template == 'signed-fraction-sum':
                require(any(' - \\left(-' in s for s in sources) and any(' + ' in s for s in sources), 'Missing sum forms')
            if template == 'signed-fraction-product':
                require(any('\\div' in s for s in sources) and any('\\times' in s for s in sources), 'Missing product forms')
                require(any(a.denominator == 1 for a in answers), 'Missing integer quotient')
            if template == 'complex-fraction':
                parts = [braces(s, len('\\dfrac')) for s in sources]
                tops = [p[0] for p in parts]
                bottoms = [braces(s, end)[0] for s, (_, end) in zip(sources, parts)]
                require(any(' ' in t for t in tops) and any(' ' not in t for t in tops), 'Missing numerator forms')
                require(any(' ' in b for b in bottoms) and any(' ' not in b for b in bottoms), 'Missing denominator forms')
                require(any(token in ('1', '2', '3') for part in tops + bottoms for token in part.split(' ')),
                        'Missing whole-number terms')
            if template == 'rational-power':
                indices = {int(re.search(r'/([2-5])\}$', s)[1]) for s in sources}
                require(indices == {2, 3, 4, 5}, 'Missing root indices')
                require(any('^{-' in s for s in sources) and any(s.startswith('\\left(') for s in sources)
                        and any(not s.startswith('\\left(') for s in sources), 'Missing exponent sign or base forms')
            report[template] = {'cases': len(rows), 'distinctInputs': len(sources)}
        return report


if __name__ == '__main__':
    print(review_fixtures())
