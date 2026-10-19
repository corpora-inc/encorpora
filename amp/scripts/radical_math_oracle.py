"""Independent exact square-root arithmetic, prepared before generator authoring.

Values are rational linear combinations of square roots of square-free positive
integers. Public prompt grammar and template-domain checks are not yet attached;
this arithmetic helper alone is not a curriculum certification gate.
"""
from fractions import Fraction
from math import isqrt


def require(condition, message):
    if not condition:
        raise ValueError(message)


def square_part(n):
    """Find the largest square divisor by integer divisibility, not floats."""
    require(type(n) is int and 0 <= n <= 1_000_000, 'Radicand outside exact review bound')
    if n == 0:
        return 0, 1
    for outside in range(isqrt(n), 0, -1):
        if n % (outside*outside) == 0:
            return outside, n//(outside*outside)
    raise ValueError('Missing square divisor one')


def check(value):
    require(isinstance(value, dict), 'Radical value must be a coefficient map')
    for radicand, coefficient in value.items():
        require(type(radicand) is int and radicand > 0
                and isinstance(coefficient, Fraction) and coefficient != 0,
                'Invalid canonical radical term')
        require(square_part(radicand)[0] == 1, 'Radicand is not square-free')


def term(coefficient, radicand):
    coefficient = Fraction(coefficient)
    outside, inside = square_part(radicand)
    result = coefficient*outside
    return {inside: result} if result else {}


def rational(value):
    value = Fraction(value)
    return {1: value} if value else {}


def root(value):
    """Principal real square root of a nonnegative rational number."""
    value = Fraction(value)
    require(value >= 0, 'Negative radicand has no real square root')
    # sqrt(a/b) = sqrt(ab)/b for positive b; no decimal approximation.
    return term(Fraction(1, value.denominator), value.numerator*value.denominator)


def add(left, right):
    check(left); check(right)
    result = dict(left)
    for radicand, coefficient in right.items():
        result[radicand] = result.get(radicand, Fraction(0)) + coefficient
    return dict(sorted((n, c) for n, c in result.items() if c))


def scale(value, factor):
    check(value)
    factor = Fraction(factor)
    return {n: factor*c for n, c in value.items()} if factor else {}


def multiply(left, right):
    check(left); check(right)
    result = {}
    for a, c in left.items():
        for b, d in right.items():
            result = add(result, term(c*d, a*b))
    return result


def divide_by_monomial(numerator, denominator):
    """Divide by one nonzero radical term, rationalizing its denominator."""
    check(numerator); check(denominator)
    require(len(denominator) == 1, 'Require one nonzero radical denominator')
    radicand, coefficient = next(iter(denominator.items()))
    # 1/(c sqrt(d)) = sqrt(d)/(cd), valid for d > 0 and c != 0.
    return multiply(numerator, {radicand: Fraction(1, 1)/(coefficient*radicand)})


def canonical_label(value):
    """Unambiguous plain notation, without assuming the future choice grammar."""
    check(value)
    parts = []
    for radicand, coefficient in sorted(value.items()):
        numerator = abs(coefficient.numerator)
        denominator = coefficient.denominator
        if radicand == 1:
            magnitude = str(numerator)
        else:
            magnitude = (str(numerator) if numerator != 1 else '')+f'√{radicand}'
        if denominator != 1:
            magnitude += f'/{denominator}'
        parts.append((coefficient < 0, magnitude))
    return ''.join((' − ' if negative else ' + ') + text if index else
                   ('−' if negative else '') + text
                   for index, (negative, text) in enumerate(parts)) or '0'


def review_arithmetic_fixtures():
    q = Fraction
    roots = [
        (0, {}), (1, {1:q(1)}), (2, {2:q(1)}), (4, {1:q(2)}),
        (12, {3:q(2)}), (18, {2:q(3)}), (72, {2:q(6)}),
        (81, {1:q(9)}), (180, {5:q(6)}), (441, {1:q(21)}),
        (q(1,8), {2:q(1,4)}), (q(12,25), {3:q(2,5)}),
        (q(8,9), {2:q(2,3)}), (q(49,36), {1:q(7,6)}),
    ]
    for given, expected in roots:
        require(root(given) == expected, 'Handwritten principal-root fixture failed')
    expressions = [
        (add(root(50), scale(root(8), -1)), {2:q(3)}, '3√2'),
        (add(scale(root(12), 2), scale(root(27), 3)), {3:q(13)}, '13√3'),
        (add(root(18), scale(root(8), q(-3,2))), {}, '0'),
        (add(root(2), root(3)), {2:q(1),3:q(1)}, '√2 + √3'),
        (add(root(9), scale(root(2), -1)), {1:q(3),2:q(-1)}, '3 − √2'),
        (multiply(root(12), root(18)), {6:q(6)}, '6√6'),
        (multiply(root(2), root(8)), {1:q(4)}, '4'),
        (multiply(scale(root(3), -2), scale(root(12), 3)), {1:q(-36)}, '−36'),
        (divide_by_monomial(rational(3), root(12)), {3:q(1,2)}, '√3/2'),
        (divide_by_monomial(root(6), root(10)), {15:q(1,5)}, '√15/5'),
        (divide_by_monomial(rational(5), scale(root(3), 2)), {3:q(5,6)}, '5√3/6'),
        (divide_by_monomial(rational(-7), scale(root(7), -2)), {7:q(1,2)}, '√7/2'),
        (divide_by_monomial(rational(0), root(2)), {}, '0'),
    ]
    for actual, expected, label in expressions:
        require(actual == expected, 'Handwritten radical-operation fixture failed')
        require(canonical_label(actual) == label, 'Canonical radical-label fixture failed')

    # Independent integer identities also exercise square-free and sign invariants.
    checked = 0
    for numerator in range(49):
        for denominator in range(1,13):
            given = q(numerator, denominator)
            actual = root(given)
            require(len(actual) <= 1 and all(c > 0 for c in actual.values()),
                    'Principal square root must be nonnegative')
            require(multiply(actual, actual) == rational(given), 'Square-root identity failed')
            if given:
                require(divide_by_monomial(actual, actual) == rational(1), 'Exact cancellation failed')
            checked += 1
    rejected = 0
    for operation in [lambda: root(-1), lambda: square_part(True), lambda: square_part(1_000_001),
                      lambda: check({4:q(1)}), lambda: check({0:q(1)}), lambda: check({2:q(0)}),
                      lambda: check({2:1}), lambda: divide_by_monomial(root(2), {}),
                      lambda: divide_by_monomial(root(2), add(root(2), root(3)))]:
        try:
            operation()
        except ValueError:
            rejected += 1
            continue
        raise ValueError('Invalid radical arithmetic accepted')
    require(root(2) != rational(q(141421,100000)), 'Rounded decimal cannot replace an irrational answer')
    require(add(root(2), root(3)) != root(5), 'False radical-addition rule accepted')
    require(root(9) != rational(-3), 'Principal root cannot be the negative root')
    return {'handwrittenRoots':len(roots), 'handwrittenOperations':len(expressions),
            'exactIdentityCases':checked, 'rejectedInputs':rejected}


if __name__ == '__main__':
    import json
    print(json.dumps(review_arithmetic_fixtures()))
