"""Exact public-prompt solver written before the radical generators.

Only the four agreed numeric task grammars are accepted. No private generator
metadata, floating point, Python evaluation, or author answer code is used.
"""
import re
from fractions import Fraction
from radical_math_oracle import (require, root, rational, term, add, scale,
                                 multiply, divide_by_monomial, check, square_part)

RADICAL_TYPES = frozenset({'simplify-square-root', 'combine-square-roots',
                          'multiply-square-roots', 'rationalize-radical-denominator'})


def tex_value(source):
    """Parse restricted literal TeX with exact radical arithmetic."""
    require(isinstance(source, str) and 0 < len(source) <= 512,
            'Invalid radical expression length')
    source = source.replace('−', '-').replace(' ', '')
    tokens = re.findall(r'\\sqrt|\\frac|[0-9]+|[{}()+\-]', source)
    require(''.join(tokens) == source and len(tokens) <= 128,
            'Unsupported radical expression token')
    index = 0

    def peek():
        return tokens[index] if index < len(tokens) else None

    def take(expected=None):
        nonlocal index
        value = peek()
        require(value is not None and (expected is None or value == expected),
                'Malformed radical expression')
        index += 1
        return value

    def group(opening, closing, depth):
        take(opening)
        result = expression(depth + 1)
        take(closing)
        return result

    def atom(depth):
        require(depth <= 12, 'Excessive radical expression nesting')
        token = peek()
        if token and token.isdecimal():
            number = int(take())
            require(number <= 10000, 'Excessive literal coefficient')
            return rational(number)
        if token == '(':
            return group('(', ')', depth)
        if token == r'\sqrt':
            take(); take('{')
            number = take()
            require(number.isdecimal() and int(number) <= 10000,
                    'Require a bounded nonnegative integer radicand')
            take('}')
            return root(int(number))
        if token == r'\frac':
            take()
            numerator = group('{', '}', depth)
            denominator = group('{', '}', depth)
            return divide_by_monomial(numerator, denominator)
        raise ValueError('Missing radical expression atom')

    def product(depth):
        sign = 1
        if peek() in ('+', '-'):
            sign = -1 if take() == '-' else 1
        result = scale(atom(depth), sign)
        while peek() and (peek().isdecimal() or peek() in ('(', r'\sqrt', r'\frac')):
            result = multiply(result, atom(depth))
        return result

    def expression(depth):
        result = product(depth)
        while peek() in ('+', '-'):
            sign = -1 if take() == '-' else 1
            # A second sign is not a substitute for a properly signed term.
            require(peek() not in ('+', '-'), 'Repeated expression sign')
            result = add(result, scale(product(depth), sign))
        return result

    result = expression(0)
    require(index == len(tokens), 'Trailing radical expression tokens')
    check(result)
    return result


def canonical_tex(value):
    check(value)
    parts = []
    for radicand, coefficient in sorted(value.items()):
        numerator, denominator = abs(coefficient.numerator), coefficient.denominator
        magnitude = (str(numerator) if denominator == 1 else
                     rf'\frac{{{numerator}}}{{{denominator}}}')
        if radicand != 1:
            magnitude = ('' if coefficient in (1, -1) else magnitude) + rf'\sqrt{{{radicand}}}'
        prefix = ('-' if coefficient < 0 else '') if not parts else (' - ' if coefficient < 0 else ' + ')
        parts.append(prefix + magnitude)
    return ''.join(parts) or '0'


def read_choice(label):
    require(isinstance(label, str) and label.startswith('$') and label.endswith('$'),
            'Choice must use explicit math delimiters')
    source = label[1:-1]
    value = tex_value(source)
    compact = lambda text: text.replace(' ', '').replace('−', '-')
    require(compact(source) == compact(canonical_tex(value)),
            'Choice is not reduced canonical radical notation')
    return value


def public_target(public):
    template = public['templateId']
    prompt = public['prompt']
    require(template in RADICAL_TYPES, 'Unknown radical template')
    coefficient = r'(-?[0-9]*)(?:\\sqrt\{([0-9]+)\})'
    def bounded_term(c, n, bound):
        a = -1 if c == '-' else 1 if c == '' else int(c)
        n = int(n)
        require(1 <= abs(a) <= 6 and 1 <= n <= bound, 'Radical term outside declared domain')
        return term(a, n)

    if template == 'simplify-square-root':
        match = re.fullmatch(r'Simplify \$\\sqrt\{([0-9]+)\}\$\.', prompt)
        require(match is not None and 0 <= int(match[1]) <= 400,
                'Malformed or out-of-domain square-root prompt')
        return root(int(match[1]))
    if template == 'combine-square-roots':
        match = re.fullmatch(r'Simplify \$' + coefficient + r' ([+−-]) ' + coefficient + r'\$\.', prompt)
        require(match is not None and not match[4].startswith('-'),
                'Malformed radical-sum prompt')
        left = bounded_term(match[1], match[2], 200)
        right = bounded_term(match[4], match[5], 200)
        return add(left, scale(right, 1 if match[3] == '+' else -1))
    if template == 'multiply-square-roots':
        match = re.fullmatch(r'Simplify \$\(' + coefficient + r'\)\(' + coefficient + r'\)\$\.', prompt)
        require(match is not None, 'Malformed radical-product prompt')
        return multiply(bounded_term(match[1], match[2], 100),
                        bounded_term(match[3], match[4], 100))
    match = re.fullmatch(r'Rationalize the denominator and simplify \$\\frac\{(-?[0-9]+)\}\{([0-9]*)\\sqrt\{([0-9]+)\}\}\$\.', prompt)
    require(match is not None, 'Malformed radical-quotient prompt')
    a, b, n = int(match[1]), int(match[2] or '1'), int(match[3])
    require(1 <= abs(a) <= 12 and 1 <= b <= 6 and 2 <= n <= 100
            and square_part(n)[1] != 1, 'Radical quotient outside declared domain')
    return divide_by_monomial(rational(a), term(b, n))


def solve_radical(public):
    target = public_target(public)
    response = public['response']
    require(response.get('kind') == 'choice' and response.get('label') == 'Simplified expression',
            'Wrong radical response contract')
    options = response.get('options')
    require(isinstance(options, list) and len(options) == 4, 'Require four radical choices')
    require({option['id'] for option in options} == {'option-a', 'option-b', 'option-c', 'option-d'},
            'Malformed or duplicate option IDs')
    values = [read_choice(option['label']) for option in options]
    require(len({tuple(sorted(value.items())) for value in values}) == 4,
            'Mathematically duplicate radical choices')
    answers = [option['id'] for option, value in zip(options, values) if value == target]
    require(len(answers) == 1, 'Require exactly one equivalent radical choice')
    return answers[0]


def review_fixtures():
    fixtures = [
        ('simplify-square-root', r'Simplify $\sqrt{72}$.', r'6\sqrt{2}'),
        ('simplify-square-root', r'Simplify $\sqrt{0}$.', '0'),
        ('simplify-square-root', r'Simplify $\sqrt{400}$.', '20'),
        ('combine-square-roots', r'Simplify $2\sqrt{12} + 3\sqrt{27}$.', r'13\sqrt{3}'),
        ('combine-square-roots', r'Simplify $3\sqrt{8} - 2\sqrt{18}$.', '0'),
        ('combine-square-roots', r'Simplify $\sqrt{9} - \sqrt{2}$.', r'3 - \sqrt{2}'),
        ('combine-square-roots', r'Simplify $-\sqrt{2} + 2\sqrt{3}$.', r'-\sqrt{2} + 2\sqrt{3}'),
        ('multiply-square-roots', r'Simplify $(2\sqrt{12})(-3\sqrt{18})$.', r'-36\sqrt{6}'),
        ('multiply-square-roots', r'Simplify $(\sqrt{2})(\sqrt{8})$.', '4'),
        ('rationalize-radical-denominator', r'Rationalize the denominator and simplify $\frac{3}{\sqrt{12}}$.', r'\frac{1}{2}\sqrt{3}'),
        ('rationalize-radical-denominator', r'Rationalize the denominator and simplify $\frac{-5}{2\sqrt{3}}$.', r'-\frac{5}{6}\sqrt{3}'),
    ]
    cases = []
    for template, prompt, expected in fixtures:
        target = tex_value(expected)
        require(public_target({'templateId': template, 'prompt': prompt}) == target,
                'Handwritten public radical fixture failed')
        labels = [f'${expected}$'] + [f'${canonical_tex(add(target, rational(k)))}$' for k in (1, 2, 3)]
        public = {'templateId': template, 'prompt': prompt, 'response': {
            'kind': 'choice', 'label': 'Simplified expression', 'options': [
                {'id': f'option-{letter}', 'label': label} for letter, label in zip('abcd', labels)]}}
        require(solve_radical(public) == 'option-a', 'Incorrect public radical choice')
        cases.append(public)
    malformed = [r'\sqrt{-1}', r'\sqrt{2+3}', r'\frac{1}{0}', r'\frac{1}{\sqrt{2}+\sqrt{3}}',
                 r'\sqrt{2}^2', '__import__(1)', '1.4', '1/2', '2++3', r'\sqrt{2}}',
                 r'\unknown{2}', '(' * 14 + '1' + ')' * 14]
    rejected = 0
    for source in malformed:
        try:
            tex_value(source)
        except ValueError:
            rejected += 1
            continue
        raise ValueError('Malformed TeX accepted')
    noncanonical = [r'$\sqrt{8}$', r'$1\sqrt{2}$', r'$\frac{2}{4}\sqrt{3}$',
                    r'$\sqrt{3} + \sqrt{2}$', r'$\frac{1}{\sqrt{2}}$', '$-0$']
    for label in noncanonical:
        try:
            read_choice(label)
        except ValueError:
            rejected += 1
            continue
        raise ValueError('Noncanonical option accepted')
    import copy
    mutants = []
    for index in range(len(cases)):
        bad = copy.deepcopy(cases[index])
        bad['response']['options'][0]['label'] = bad['response']['options'][1]['label']
        mutants.append(bad)
    for bad in mutants:
        try:
            solve_radical(bad)
        except ValueError:
            rejected += 1
            continue
        raise ValueError('Mutated choice accepted')
    return {'publicFixtures': len(fixtures), 'rejectedExpressionsAndChoices': rejected}


if __name__ == '__main__':
    import json
    print(json.dumps(review_fixtures()))
