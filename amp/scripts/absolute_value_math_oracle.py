"""Independent exact solution of c|ax+b|+d=e by sign intervals."""
import copy
import re
from fractions import Fraction as F

ALL_REAL = 'all-real'

def solve_coefficients(a, b, c, d, e):
    a, b, c, d, e = map(F, (a, b, c, d, e))
    if a == 0 or c == 0:
        return ALL_REAL if c * abs(b) + d == e else frozenset()
    roots = set()
    for sign in (-1, 1):
        # On this interval |ax+b| = sign*(ax+b). Solve its linear equation,
        # then retain the candidate only when it lies in that interval.
        candidate = (e - d - c * sign * b) / (c * sign * a)
        if sign * (a * candidate + b) >= 0:
            if c * abs(a * candidate + b) + d != e:
                raise ValueError('Piecewise candidate fails original equation')
            roots.add(candidate)
    return frozenset(roots)

def review_core_fixtures():
    fixtures = [
        ((1, 0, 1, 0, 4), {-4, 4}),
        ((1, 0, 1, 0, 0), {0}),
        ((1, 0, 1, 0, -4), set()),
        ((2, -3, 1, 0, 5), {-1, 4}),
        ((-3, 1, 1, 0, 2), {F(-1, 3), 1}),
        ((2, 1, 3, -4, 2), {F(-3, 2), F(1, 2)}),
        ((2, 1, -3, 4, -2), {F(-3, 2), F(1, 2)}),
        ((2, 1, -3, 4, 5), set()),
        ((2, 1, -3, 4, 4), {F(-1, 2)}),
        ((0, -3, 2, -1, 5), ALL_REAL),
        ((0, -3, 2, -1, 6), set()),
        ((3, 2, 0, 5, 5), ALL_REAL),
        ((3, 2, 0, 5, 6), set()),
        ((F(1, 2), F(-1, 3), F(3, 2), F(1, 4), F(3, 4)), {0, F(4, 3)}),
    ]
    for coefficients, expected in fixtures:
        actual = solve_coefficients(*coefficients)
        if actual != expected:
            raise ValueError((coefficients, actual, expected))
    return len(fixtures)


ABSOLUTE_VALUE = frozenset({
    'absolute-value-direct-equation',
    'absolute-value-affine-equation',
    'absolute-value-transformed-equation',
})
NUMBER = r'(?:0|−?[1-9][0-9]*)(?:/[1-9][0-9]*)?'


def require(condition, message):
    if not condition:
        raise ValueError(message)


def rational(source, numerator=96, denominator=24):
    require(isinstance(source, str) and len(source) <= 16 and
            re.fullmatch(NUMBER, source), 'Malformed rational number')
    value = F(source.replace('−', '-'))
    require(str(value).replace('-', '−') == source, 'Noncanonical rational number')
    require(abs(value.numerator) <= numerator and value.denominator <= denominator,
            'Rational outside declared bounds')
    return value


def coefficient(source):
    if source == '': return 1
    if source == '−': return -1
    require(re.fullmatch(r'−?(?:0|[1-9][0-9]*)', source), 'Malformed coefficient')
    require(len(source) <= 4 and source != '−0', 'Noncanonical coefficient')
    return int(source.replace('−', '-'))


def affine(source):
    found = re.fullmatch(r'(−?[0-9]*)x(?: ([+−]) ([1-9][0-9]*))?', source)
    if found:
        a = coefficient(found[1])
        b = (1 if found[2] == '+' else -1) * int(found[3]) if found[3] else 0
        return a, b
    return 0, rational(source, 12, 1)


def parse_equation(source):
    found = re.fullmatch(r'(−?[0-9]*)\|([^|]+)\|(?: ([+−]) ([1-9][0-9]*))? = (' + NUMBER + ')', source)
    require(found is not None, 'Malformed absolute-value equation')
    c = coefficient(found[1])
    a, b = affine(found[2])
    d = (1 if found[3] == '+' else -1) * int(found[4]) if found[4] else 0
    e = rational(found[5], 96, 4)
    require(abs(a) <= 6 and abs(b) <= 12 and abs(c) <= 4 and abs(d) <= 12,
            'Equation coefficients outside declared bounds')
    return a, b, c, d, e


def read_solution(label):
    if label == 'No real solutions': return frozenset()
    if label == 'All real numbers': return ALL_REAL
    found = re.fullmatch(r'x = (' + NUMBER + r')(?: or x = (' + NUMBER + '))?', label)
    require(found is not None, 'Malformed solution-set choice')
    values = tuple(rational(x, 60, 24) for x in found.groups() if x is not None)
    require(len(set(values)) == len(values), 'Repeated root in a solution set')
    require(tuple(sorted(values)) == values, 'Roots are not in increasing order')
    return frozenset(values)


def solve_absolute_value(public):
    template = public['templateId']
    require(template in ABSOLUTE_VALUE, 'Unknown absolute-value template')
    require(public.get('figure') is None, 'Unexpected practice diagram')
    found = re.fullmatch(r'Solve (.+)\. Choose the complete set of real solutions\.', public['prompt'])
    require(found is not None, 'Ambiguous absolute-value task')
    a, b, c, d, e = parse_equation(found[1])
    if template.endswith('direct-equation'):
        require((a,b,c,d) == (1,0,1,0), 'Direct equation form changed')
        require(abs(e.numerator) <= 12, 'Direct target outside scope')
    elif template.endswith('affine-equation'):
        require(a != 0 and b != 0 and (c,d) == (1,0), 'Affine equation form changed')
        require(abs(e.numerator) <= 12, 'Affine target outside scope')
    else:
        require(d != 0, 'Transformed equation must include an outside shift')
    expected = solve_coefficients(a,b,c,d,e)
    require(public['response']['kind'] == 'choice', 'Solution-set task must use choices')
    options = public['response']['options']
    require(isinstance(options,list) and 2 <= len(options) <= 6, 'Invalid choice count')
    require(all(isinstance(o,dict) and set(o) == {'id','label'} and
                isinstance(o['id'],str) and 0 < len(o['id']) <= 64 and
                isinstance(o['label'],str) for o in options), 'Malformed choices')
    require(len({o['id'] for o in options}) == len(options), 'Duplicate choice IDs')
    sets = [read_solution(o['label']) for o in options]
    require(len(set(sets)) == len(sets), 'Mathematically duplicate choices')
    correct = [o['id'] for o,s in zip(options,sets) if s == expected]
    require(len(correct) == 1, 'Exactly one choice must state the complete solution set')
    return correct[0]


def review_absolute_value_fixtures():
    count = review_core_fixtures()
    def case(template, equation, labels):
        return {'templateId': template, 'prompt': f'Solve {equation}. Choose the complete set of real solutions.',
                'response': {'kind':'choice','options':[{'id':str(i),'label':x} for i,x in enumerate(labels)]}}
    direct,affine_id,transformed = ('absolute-value-' + x + '-equation' for x in ('direct','affine','transformed'))
    fixtures = [
        (case(direct,'|x| = 3',['x = −3 or x = 3','x = 3','No real solutions']),'0'),
        (case(direct,'|x| = −3',['x = −3 or x = 3','No real solutions']),'1'),
        (case(direct,'|x| = 0',['x = 0','No real solutions']),'0'),
        (case(affine_id,'|−3x + 1| = 2',['x = −1/3 or x = 1','x = 1','No real solutions']),'0'),
        (case(transformed,'−3|2x + 1| + 4 = −2',['x = −3/2 or x = 1/2','No real solutions']),'0'),
        (case(transformed,'2|0x − 3| − 1 = 5',['No real solutions','All real numbers']),'1'),
        (case(transformed,'2|0x − 3| − 1 = 6',['No real solutions','All real numbers']),'0'),
        (case(transformed,'0|3x + 2| + 5 = 6',['No real solutions','All real numbers']),'0'),
        (case(transformed,'0|3x + 2| + 5 = 5',['No real solutions','All real numbers']),'1'),
    ]
    for public,expected in fixtures:
        require(solve_absolute_value(public) == expected, 'Handwritten public fixture failed')
    bad = []
    for equation in ('|x = 3','||x|| = 3','|x| = 1/0','|x| = 2/4','|x| = −0','|x| = 3.0'):
        bad.append(case(direct,equation,['x = −3 or x = 3','No real solutions']))
    for labels in (['x = 3','No real solutions'], ['x = 3 or x = −3','No real solutions'],
                   ['x = −3 or x = 3','x = −3 or x = 3'], ['x = 3 or x = 3','No real solutions']):
        bad.append(case(direct,'|x| = 3',labels))
    mutant = copy.deepcopy(fixtures[0][0]); mutant['response']['options'][1]['id'] = '0'; bad.append(mutant)
    for public in bad:
        try: solve_absolute_value(public)
        except (ValueError,KeyError,TypeError): pass
        else: raise ValueError('Malformed or mathematically invalid task accepted')
    return {'core': count, 'public': len(fixtures), 'mutants': len(bad)}

if __name__ == '__main__':
    print(review_absolute_value_fixtures())
