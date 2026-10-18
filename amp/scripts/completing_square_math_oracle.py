"""Independent exact coefficient checks for the frozen completing-square contract.

Only public prompts and choices enter the solver. No author implementation,
formatter, generator, or grading function is imported. Coefficients are exact
Fractions; identities are compared symbolically, never by sample substitution.
"""
from fractions import Fraction
from math import gcd
import copy
import json
import re

IDS = {'complete-square-term', 'complete-square-monic', 'complete-square-nonmonic'}
NONMONIC = {-6, -5, -4, -3, -2, -1, 2, 3, 4, 5, 6}
RATIONAL = r'(?:[1-9][0-9]*|\\frac\{[1-9][0-9]*\}\{[1-9][0-9]*\})'


def require(condition, message):
    if not condition:
        raise ValueError(message)


def positive_rational(source):
    """Positive, reduced canonical integer or TeX fraction."""
    if re.fullmatch(r'[1-9][0-9]*', source):
        return Fraction(int(source))
    match = re.fullmatch(r'\\frac\{([1-9][0-9]*)\}\{([1-9][0-9]*)\}', source)
    require(match is not None, 'Malformed rational')
    n, d = map(int, match.groups())
    require(d > 1 and gcd(n, d) == 1, 'Fraction must be reduced with denominator greater than one')
    return Fraction(n, d)


def read_polynomial(source):
    """Read descending integer ax²+bx+c; all zero terms are omitted."""
    match = re.fullmatch(
        r'(-?)([1-9][0-9]*)?x\^2'
        r'(?: ([+-]) ([1-9][0-9]*)?x)?'
        r'(?: ([+-]) ([1-9][0-9]*))?', source)
    require(match is not None, 'Malformed expanded quadratic')
    sign, a, bsign, b, csign, c = match.groups()
    require(a != '1' and b != '1', 'Coefficient one must be omitted')
    a = int(a or 1) * (-1 if sign else 1)
    b = (int(b or 1) * (-1 if bsign == '-' else 1)) if bsign else 0
    c = (int(c) * (-1 if csign == '-' else 1)) if csign else 0
    return Fraction(c), Fraction(b), Fraction(a)


def read_completed(source):
    """Expand a(x+h)²+k to its exact coefficient vector (c,b,a)."""
    require(isinstance(source, str) and source.startswith('$') and source.endswith('$'),
            'Choice must be exactly one dollar-delimited TeX expression')
    body = source[1:-1]
    match = re.fullmatch(
        rf'(-?)([1-9][0-9]*)?'
        rf'(x\^2|\(x ([+-]) ({RATIONAL})\)\^2)'
        rf'(?: ([+-]) ({RATIONAL}))?', body)
    require(match is not None, 'Malformed completed-square form')
    sign, coefficient, _, hsign, hsource, ksign, ksource = match.groups()
    require(coefficient != '1', 'Outside coefficient one must be omitted')
    a = Fraction(int(coefficient or 1) * (-1 if sign else 1))
    h = positive_rational(hsource) * (-1 if hsign == '-' else 1) if hsign else Fraction(0)
    k = positive_rational(ksource) * (-1 if ksign == '-' else 1) if ksign else Fraction(0)
    # Expansion, not inverse construction: a*x*x + 2*a*h*x + a*h*h + k.
    return (a*h*h + k, 2*a*h, a), (a, h, k)


def check_domain(template, coefficients):
    c, b, a = coefficients
    require(all(value.denominator == 1 for value in coefficients), 'Expanded coefficients must be integers')
    if template == 'complete-square-monic':
        require(a == 1 and abs(b) <= 16 and abs(c) <= 24, 'Monic coefficient domain violated')
    elif template == 'complete-square-nonmonic':
        require(a in NONMONIC and abs(b) <= 18 and abs(c) <= 24, 'Nonmonic coefficient domain violated')
    else:
        raise ValueError('Unexpected quadratic template')


def solve_complete_square(public):
    template = public.get('templateId')
    require(template in IDS, 'Unsupported completing-square template')
    prompt = public.get('prompt', '')
    response = public.get('response', {})
    if template == 'complete-square-term':
        match = re.fullmatch(
            r'Find \$c\$ so that \$(.+) \+ c = \(x \+ h\)\^2\$ '
            r'for some real constant \$h\$ and every real \$x\$\.', prompt)
        require(match is not None, 'Malformed missing-constant prompt')
        c, b, a = read_polynomial(match[1])
        require(a == 1 and c == 0 and abs(b) <= 18, 'Missing-constant domain violated')
        require(response.get('kind') == 'fraction', 'Missing constant requires exact fraction response')
        # Coefficient identity 2h=b and c=h², for a single constant h and every x.
        h = b / 2
        return h*h
    match = re.fullmatch(r'Rewrite \$(.+)\$ in completed-square form\.', prompt)
    require(match is not None, 'Malformed completed-square prompt')
    target = read_polynomial(match[1])
    check_domain(template, target)
    require(response.get('kind') == 'choice', 'Rewrite requires a choice response')
    options = response.get('options')
    require(isinstance(options, list) and len(options) == 4, 'Exactly four choices are required')
    require(all(isinstance(o, dict) and isinstance(o.get('id'), str) for o in options), 'Malformed options')
    require({o['id'] for o in options} == {'option-a', 'option-b', 'option-c', 'option-d'}, 'Invalid or repeated option IDs')
    vectors = []
    keys = []
    for option in options:
        vector, _ = read_completed(option.get('label'))
        check_domain(template, vector)
        require(vector[2] == target[2], 'Choice changes the fixed leading coefficient')
        vectors.append(vector)
        if vector == target:
            keys.append(option['id'])
    require(len(set(vectors)) == 4, 'Mathematically duplicate choices')
    require(len(keys) == 1, 'Exactly one complete coefficient identity must match')
    # Public evidence of the fixed two-by-two cohort; target selection order and
    # target uniformity require a separate generator/data audit once authored.
    bs = {v[1] for v in vectors}
    cs = {v[0] for v in vectors}
    require(len(bs) == len(cs) == 2 and {(v[1], v[0]) for v in vectors} == {(b, c) for b in bs for c in cs},
            'Choices must cover the complete two-by-two coefficient cohort')
    require(any(v != target and v[1] == target[1] for v in vectors), 'No distractor shares the target linear coefficient')
    require(any(v != target and v[0] == target[0] for v in vectors), 'No distractor shares the target constant')
    return keys[0]


def validate_generated(problem):
    expected = solve_complete_square(problem['public'])
    actual = problem.get('answer')
    if isinstance(expected, Fraction):
        require(isinstance(actual, (str, int)) and not isinstance(actual, bool), 'Exact answer must use a rational string or integer')
        try:
            actual = Fraction(actual)
        except (ValueError, ZeroDivisionError):
            raise ValueError('Malformed exact answer') from None
    require(actual == expected, 'Mismatch: incorrect completing-square answer')
    return expected


def fixture(template, polynomial, labels):
    return {'templateId': template, 'prompt': f'Rewrite ${polynomial}$ in completed-square form.',
            'response': {'kind': 'choice', 'options': [{'id': 'option-'+chr(97+i), 'label': label} for i, label in enumerate(labels)]}}


def self_test():
    term = lambda p: {'templateId': 'complete-square-term',
        'prompt': f'Find $c$ so that ${p} + c = (x + h)^2$ for some real constant $h$ and every real $x$.',
        'response': {'kind': 'fraction'}}
    terms = [('x^2', Fraction(0)), ('x^2 + x', Fraction(1, 4)),
             ('x^2 - x', Fraction(1, 4)), ('x^2 + 18x', Fraction(81)),
             ('x^2 - 17x', Fraction(289, 4)), ('x^2 - 18x', Fraction(81)),
             ('x^2 - 2x', Fraction(1))]
    for source, expected in terms:
        require(solve_complete_square(term(source)) == expected, 'Handwritten missing-constant fixture failed')
    cases = [
        (fixture('complete-square-monic', 'x^2 + 3x - 5',
            [r'$(x + \frac{3}{2})^2 - \frac{29}{4}$', r'$(x + \frac{3}{2})^2 - \frac{9}{4}$',
             r'$(x - 1)^2 - 6$', r'$(x - 1)^2 - 1$']), 'option-a'),
        (fixture('complete-square-monic', 'x^2',
            [r'$(x + \frac{1}{2})^2 - \frac{5}{4}$', r'$x^2 - 1$',
             r'$(x + \frac{1}{2})^2 - \frac{1}{4}$', r'$x^2$']), 'option-d'),
        (fixture('complete-square-monic', 'x^2 + 2x + 1',
            [r'$x^2$', r'$(x + 1)^2$', r'$x^2 + 1$', r'$(x + 1)^2 - 1$']), 'option-b'),
        (fixture('complete-square-monic', 'x^2 - 16x + 24',
            [r'$x^2$', r'$(x - 8)^2 - 64$', r'$x^2 + 24$', r'$(x - 8)^2 - 40$']), 'option-d'),
        (fixture('complete-square-nonmonic', '2x^2 + 3x - 5',
            [r'$2x^2$', r'$2(x + \frac{3}{4})^2 - \frac{9}{8}$',
             r'$2(x + \frac{3}{4})^2 - \frac{49}{8}$', r'$2x^2 - 5$']), 'option-c'),
        (fixture('complete-square-nonmonic', '-x^2 - x + 1',
            [r'$-x^2$', r'$-(x + \frac{1}{2})^2 + \frac{5}{4}$',
             r'$-x^2 + 1$', r'$-(x + \frac{1}{2})^2 + \frac{1}{4}$']), 'option-b'),
        (fixture('complete-square-nonmonic', '-6x^2 + 18x + 24',
            [r'$-6(x - \frac{3}{2})^2 + \frac{75}{2}$', r'$-6x^2 + 24$',
             r'$-6(x - \frac{3}{2})^2 + \frac{27}{2}$', r'$-6x^2$']), 'option-a'),
        (fixture('complete-square-nonmonic', '6x^2 - 17x - 24',
            [r'$6x^2$', r'$6(x - \frac{17}{12})^2 - \frac{289}{24}$',
             r'$6x^2 - 24$', r'$6(x - \frac{17}{12})^2 - \frac{865}{24}$']), 'option-d'),
    ]
    for public, expected in cases:
        require(solve_complete_square(public) == expected, 'Handwritten coefficient identity fixture failed')
        require(solve_complete_square({**public, 'response': {**public['response'], 'options': list(reversed(public['response']['options']))}}) == expected,
                'Choice ordering changed the mathematical key')
    require(validate_generated({'public': term('x^2 + x'), 'answer': '0.25'}) == Fraction(1,4), 'Exact decimal was not accepted')
    rejected = 0
    def reject(function, value):
        nonlocal rejected
        try: function(value)
        except (ValueError, TypeError): rejected += 1; return
        raise ValueError('Oracle accepted a malformed or corrupted fixture')
    for source in ['x^2 + 19x', '2x^2 + 3x', 'x^2 + 3x + 1', 'x^2 + 0x', 'x^2 + 1x']:
        reject(solve_complete_square, term(source))
    public, _ = cases[0]
    for source in ['x^2 + 17x', 'x^2 - 17x', 'x^2 + 25', 'x^2 - 25', '0x^2', 'x^{3}']:
        bad = copy.deepcopy(public); bad['prompt'] = f'Rewrite ${source}$ in completed-square form.'; reject(solve_complete_square, bad)
    for invalid in [r'$(x + \frac{6}{4})^2 - \frac{29}{4}$', r'$(x + \frac{3}{0})^2$',
                    r'$(x + \frac{3}{-2})^2$', r'$(x + 0)^2$', r'$1(x + 1)^2$',
                    r'$(x + 1)^{3}$', r'$(x + h)^2$', r'$(x + 1)^2 + 0$',
                    r'$(x + 1)^2$ trailing', r'$\sqrt{x}$']:
        reject(read_completed, invalid)
    bad = copy.deepcopy(public); bad['response']['options'].pop(); reject(solve_complete_square, bad)
    bad = copy.deepcopy(public); bad['response']['options'][1]['label'] = bad['response']['options'][0]['label']; reject(solve_complete_square, bad)
    bad = copy.deepcopy(public); bad['response']['options'][0]['label'] = r'$(x + \frac{3}{2})^2 - \frac{25}{4}$'; reject(solve_complete_square, bad)
    bad = copy.deepcopy(public); bad['response']['options'][3]['label'] = r'$(x - 2)^2 - 4$'; reject(solve_complete_square, bad)
    bad = copy.deepcopy(public); bad['response']['options'][0]['id'] = 'option-b'; reject(solve_complete_square, bad)
    bad = term('x^2 + x'); bad['prompt'] = bad['prompt'].replace(' and every real $x$', ''); reject(solve_complete_square, bad)
    reject(validate_generated, {'public': term('x^2 + x'), 'answer': '0.25001'})
    reject(validate_generated, {'public': public, 'answer': 'option-b'})
    return {'handwrittenTerms': len(terms), 'handwrittenRewriteIdentities': len(cases),
            'permutedChoiceFixtures': len(cases), 'rejectedMutations': rejected}


if __name__ == '__main__':
    print(json.dumps(self_test()))
