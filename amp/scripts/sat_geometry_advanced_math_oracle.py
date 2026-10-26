"""Independent review of SAT geometry/advanced-form text setups, from the public prompt only."""
import copy
import re
from fractions import Fraction
from math import isqrt

SUPPORTED = frozenset({
    'corresponding-angle-transfer', 'crossing-segment-similarity', 'angle-chase-chain',
    'angle-claim-reasoning', 'circle-radii-triangle', 'shifted-polynomial-features',
    'radical-side-entry', 'special-triangle-in-figure',
})
CHOICE = frozenset({'corresponding-angle-transfer', 'angle-claim-reasoning'})
NUMBER = SUPPORTED - CHOICE


def require(condition, message):
    if not condition:
        raise ValueError(message)


def num(text):
    return Fraction(text.replace('−', '-'))


def lin(text):
    """Parse a linear expression in x such as 6x+8, -4x+366, x+24, 180 -> (coef, const)."""
    t = re.sub(r'[\s$]', '', text).replace('−', '-')
    terms = re.findall(r'[+-]?\d*x|[+-]?\d+', t)
    require(''.join(terms) == t, f'Bad linear expression {text}')
    a = b = 0
    for term in terms:
        if term.endswith('x'):
            c = term[:-1]
            a += int({'': 1, '+': 1, '-': -1}.get(c, c) if c in ('', '+', '-') else c)
        else:
            b += int(term)
    return (a, b)


def simplify_root(n):
    m = 1
    for k in range(isqrt(n), 1, -1):
        if n % (k * k) == 0:
            m = k
            n //= k * k
            break
    return m, n


def exact_sqrt(q):
    q = Fraction(q)
    require(q >= 0, 'Negative radicand')
    a, b = isqrt(q.numerator), isqrt(q.denominator)
    require(a * a == q.numerator and b * b == q.denominator, 'Irrational answer for a decimal entry')
    return Fraction(a, b)


def solve_corresponding(public):
    p = public['prompt']
    m = re.search(r'\\triangle (\w{3}) \\(sim|cong) \\triangle (\w{3})', p)
    require(m, 'Correspondence statement required')
    first, second = m[1], m[3]
    require(len(set(first)) == 3 and len(set(second)) == 3, 'Triangle vertices repeat')
    given = {}
    for v in first:
        t = re.search(rf'\\angle {v}\$? is a right angle', p)
        if t:
            given[v] = 90
        t = re.search(rf'\\angle {v}\$? (?:measures|is) (\d+)°', p)
        if t:
            given[v] = int(t[1])
    ask = re.search(r'measure of \$\\angle (\w)\$\?', p)[1]
    require(ask in second, 'Asked vertex must be in second triangle')
    source = first[second.index(ask)]
    if len(given) == 2:
        for v in first:
            given.setdefault(v, 180 - sum(given.values()))
    else:
        require(len(given) == 1 and source in given, 'Single given must be the corresponding angle')
        require('times as long' in p or 'cong' in m[2], 'Single angle needs a similarity scale or congruence context')
    require(sum(given.values()) in (180, given[source]) and all(a > 0 for a in given.values()), 'Bad triangle')
    return Fraction(given[source])


def solve_crossing(public):
    p = public['prompt']
    m = re.match(r'Segments \$(\w)(\w)\$ and \$(\w)(\w)\$ intersect at point \$(\w)\$\.', p)
    require(m, 'Intersecting segments required')
    p1, p2, q1, q2, e = m.groups()
    if 'is parallel to' in p:
        pm = re.search(r'Segment \$(\w)(\w)\$ is parallel to segment \$(\w)(\w)\$', p)
        require(pm and pm.groups() == (p1, q1, p2, q2), 'Parallel pair must join corresponding endpoints')
    else:
        am = re.search(r'\$\\angle (\w)(\w)(\w)\$ and \$\\angle (\w)(\w)(\w)\$ have equal', p)
        require(am and am.groups() == (q1, p1, e, q2, p2, e), 'Equal angles must be at corresponding endpoints')
    key = lambda x, y: frozenset((x, y))
    L = {key(*k): Fraction(v) for k, v in re.findall(r'\$(\w\w)=(\d+)\$', re.search(r'Given (.*?)\. What', p)[1])}
    ask = re.search(r'length of segment \$(\w\w)\$\?', p)[1]
    require(key(*ask) not in L and len(L) == 3, 'Exactly three given lengths and one asked')
    # triangles P1 E Q1 ~ P2 E Q2 (vertices matched in order): sides pair up as below
    pairs = [(key(p1, e), key(p2, e)), (key(q1, e), key(q2, e)), (key(p1, q1), key(p2, q2))]
    ratio = None
    for s1, s2 in pairs:
        if s1 in L and s2 in L:
            ratio = L[s1] / L[s2]
    require(ratio is not None, 'No complete corresponding side pair given')
    for s1, s2 in pairs:
        if key(*ask) == s2:
            require(s1 in L, 'Matching side not given')
            return L[s1] / ratio
        if key(*ask) == s1:
            require(s2 in L, 'Matching side not given')
            return L[s2] * ratio
    raise ValueError('Asked segment is not in the similar triangles')


def solve_chase(public):
    p = public['prompt']
    m = re.search(r'\\angle A\$ measures (\d+)° and \$\\angle B\$ (?:measures (\d+)°|is a right angle)', p)
    if m:
        require('parallel to $\\overline{AC}$' in p and 'lies on $\\overline{AB}$' in p and 'lies on $\\overline{BC}$' in p,
                'Chain setup incomplete')
        c = 180 - int(m[1]) - (int(m[2]) if m[2] else 90)
        require(0 < c < 90, 'Angle C must be acute so DEC is the unique obtuse angle')
        return Fraction(180 - c)
    m = re.search(r'\(([^)]+)\)\^\\circ\$ and \$\(([^)]+)\)\^\\circ\$', p)
    require(m and 'parallel' in p and 'same side of $t$' in p and 'first angle lies between' in p, 'Parallel setup incomplete')
    (a1, b1), (a2, b2) = lin(m[1]), lin(m[2])
    require(a1 != a2, 'x not determined')
    x = Fraction(b2 - b1, a1 - a2)
    angle = a1 * x + b1
    require(0 < angle < 180, 'Angle out of range')
    return 180 - angle


def solve_claim(public):
    p = public['prompt']
    opts = {o['id']: o['label'] for o in public['response']['options']}
    ids = list(opts)
    if p.startswith('In triangle $ABC$'):
        a = int(re.search(r'measures (\d+)°', p)[1])
        cannot = 'cannot be' in p
        valid = {i: 0 < int(re.fullmatch(r'(\d+)°', opts[i])[1]) < 180 - a for i in ids}
        target = [i for i in ids if valid[i] != cannot]
        require(len(target) == 1, 'Exactly one defensible triangle-angle choice required')
        return target[0]
    y = int(re.search(r'\$\\angle Y\$ measures (\d+)°', p)[1]) if 'angle Y$ measures' in p else None
    if y is not None:
        if 'vertical angles' in p:
            x = y
        else:
            require('adjacent angles that together make a straight line' in p, 'Adjacent setup incomplete')
            x = 180 - y
        want = 'equal measures' if x == y else ('X' if x > y else 'Y')
        found = []
        for i in ids:
            lab = opts[i]
            if want == 'equal measures' and 'equal measures' in lab:
                found.append(i)
            elif want in ('X', 'Y') and lab.startswith(f'$\\angle {want}$ has the greater'):
                found.append(i)
        require(len(found) == 1, 'Exactly one true comparison required')
        require(sum('cannot be determined' in opts[i] for i in ids) == 1, 'Undeterminable choice must be a distractor')
        return found[0]
    m = re.search(r'measures \$\(([^)]+)\)\^\\circ\$', p)
    require(m and 'cannot be the sum' in p, 'Unknown claim prompt')
    a, b = lin(m[1])
    sums = {(2 * a, 2 * b), (0, 180), (-2 * a, 360 - 2 * b)}
    forms = {i: lin(opts[i]) for i in ids}
    require(len(set(forms.values())) == len(ids), 'Duplicate sum expressions')
    target = [i for i in ids if forms[i] not in sums]
    require(len(target) == 1, 'Exactly one non-sum expression required')
    return target[0]


def solve_circle(public):
    p = public['prompt']
    m = re.search(r'\\angle AOB\$ measures (\d+)°', p) or re.search(r'Minor arc \$?AB\$? measures (\d+)°', p)
    if m:
        theta = int(m[1])
        require(0 < theta < 180, 'Minor arc/central angle must be under 180')
        require('\\angle OAB' in p, 'Asked angle unclear')
        return Fraction(180 - theta, 2)
    m = re.search(r'chord \$\\overline\{AB\}\$ has length (\d+)\. The perimeter of triangle \$OAB\$ is (\d+)', p)
    if m:
        c, per = int(m[1]), int(m[2])
        r = Fraction(per - c, 2)
        require(0 < c < 2 * r, 'Triangle OAB must exist (chord < diameter)')
        return r
    m = re.search(r'\\angle OAB\$ measures (\d+)°\. What is the measure, in degrees, of \$\\angle AOB', p)
    if m:
        require(0 < int(m[1]) < 90, 'Base angle must be acute')
        return Fraction(180 - 2 * int(m[1]))
    m = re.search(r'radius (\d+)\. The perimeter of triangle \$OAB\$ is (\d+)\. What is the length of chord', p)
    require(m, 'Unknown circle prompt')
    r, per = int(m[1]), int(m[2])
    c = per - 2 * r
    require(0 < c < 2 * r, 'Triangle OAB must exist (chord < diameter)')
    return Fraction(c)


def solve_shifted(public):
    p = public['prompt']
    m = re.match(r'The function \$f\$ is defined by \$f\(x\)=(.+?)\$, and the function \$g\$ is defined by \$g\(x\)=(.+?)\$\. (.*)$', p)
    require(m, 'Shifted-polynomial prompt required')
    fs, gs, q = m.groups()
    gm = re.fullmatch(r'f\(x([+-])(\d+)\)', gs)
    gv = re.fullmatch(r'f\(x\)([+-])(\d+)', gs)
    require(gm or gv, 'Unknown g')
    h = (-1 if gm[1] == '+' else 1) * int(gm[2]) if gm else 0  # g(x)=f(x-h)
    k = (1 if gv[1] == '+' else -1) * int(gv[2]) if gv else 0
    roots = None
    if fs.startswith('(') or fs.startswith('x('):
        toks = re.findall(r'\(x([+-]\d+)\)|(x)', fs)
        require(len(toks) == 3 and ''.join(('(x' + a + ')') if a else 'x' for a, b in toks) == fs,
                'Cubic must be three linear factors')
        roots = [-int(a) if a else 0 for a, b in toks]
        require(len(set(roots)) == 3, 'Repeated roots make the intercept sum ambiguous')
        coeffs = None
    else:
        t = fs.replace('−', '-').replace(' ', '')
        qm = re.fullmatch(r'(-?\d*)x\^2([+-]\d*)x([+-]\d+)', t)
        require(qm, 'Unknown f')
        ca = {'': 1, '-': -1}.get(qm[1], None)
        a = ca if ca is not None else int(qm[1])
        bs = qm[2]
        b = {'+': 1, '-': -1}.get(bs, None)
        b = b if b is not None else int(bs)
        c = int(qm[3])
        coeffs = (a, b, c)
    if 'sum of the $x$-intercepts' in q:
        require(roots is not None and k == 0 and h != 0, 'Intercept sum needs a horizontal shift of a cubic')
        return Fraction(sum(r + h for r in roots))
    if 'value of $g(0)$' in q:
        require(roots is not None and h == 0 and k != 0, 'g(0) uses a vertical shift')
        v = 1
        for r in roots:
            v *= (0 - r)
        return Fraction(v + k)
    em = re.search(r'reach its (minimum|maximum)', q)
    require(em and coeffs and k == 0 and h != 0, 'Unknown shifted question')
    a, b, _ = coeffs
    require((a > 0) == (em[1] == 'minimum'), 'Opening direction must match min/max')
    return Fraction(-b, 2 * a) + h


def solve_radical(public):
    p = public['prompt']
    m = re.search(r'legs have lengths (\d+) and (\d+)\..*What is the value of \$(\w)\$\?', p)
    if m:
        a, b = int(m[1]), int(m[2])
        mm, nn = simplify_root(a * a + b * b)
        return Fraction({'m': mm, 'n': nn}[m[3]])
    m = re.search(r'hypotenuse is ([\d.]+) centimeters? and one leg is ([\d.]+) centimeters?\. What is the length of the other leg', p)
    require(m, 'Unknown radical prompt')
    c, a = num(m[1]), num(m[2])
    require(c > a, 'Hypotenuse must exceed the leg')
    return exact_sqrt(c * c - a * a)


def solve_special(public):
    p = public['prompt']
    if 'equilateral triangle with perimeter' in p:
        s = Fraction(int(re.search(r'perimeter (\d+)', p)[1]), 3)
        return s / 3  # R = s/sqrt3 = (s/3) sqrt3
    if 'equilateral triangle has a perimeter' in p:
        s = Fraction(int(re.search(r'perimeter of (\d+)', p)[1]), 3)
        return s / 2  # altitude = s sqrt3 /2
    m = re.search(r'radius \$?(\d+)\\sqrt\{2\}\$? units', p)
    if m and 'square is inscribed' in p:
        return 2 * Fraction(m[1])  # side = R sqrt2 = 2k
    m = re.search(r'diameter \$?(\d+)\\sqrt\{2\}\$? units', p)
    if m and 'square is inscribed' in p:
        return Fraction(m[1])  # side = d/sqrt2 = k
    m = re.search(r'In triangle \$\w{3}\$, \$\\angle (\w)\$ is a right angle, \$(\w\w)=(\d+)\$ and \$(\w\w)=(\d+)\\sqrt\{3\}\$\. .*\\angle (\w)\$', p) or \
        re.search(r'In triangle \$\w{3}\$, \$\\angle (\w)\$ is a right angle, \$(\w\w)=(\d+)\$ and \$(\w\w)=(\d+)\\sqrt\{3\}\$\. .*?\\angle (\w)\$', p)
    if not m:
        m = re.search(r'In triangle \$\w{3}\$, \$\\angle (\w)\$ is a right angle, \$(\w\w)=(\d+)\$ and \$(\w\w)=(\d+)\\sqrt\{3\}\$', p)
    if m and 'sqrt{3}' in p and 'hypotenuse' not in p:
        right, short, a, long_, b = m[1], m[2], int(m[3]), m[4], int(m[5])
        asked = re.search(r'measure, in degrees, of \$\\angle (\w)\$', p)[1]
        require(a == b and short.count(right) == 1 and long_.count(right) == 1 and asked != right, 'Legs must be in 1:sqrt3 ratio at the right angle')
        require(asked in short + long_, 'Asked vertex must be on a leg')
        # The leg touching the asked vertex is adjacent; the other is opposite.
        return Fraction(30) if asked in long_ else Fraction(60)
    m = re.search(r'In triangle \$(\w)(\w)(\w)\$, \$\\angle \2\$ is a right angle and \$\1\2=\2\3=(\d+)\$\. .*\\angle \1', p)
    if m:
        return Fraction(45)
    m = re.search(r'In triangle \$\w{3}\$, \$\\angle (\w)\$ is a right angle, the hypotenuse \$(\w\w)=(\d+)\$ and \$(\w\w)=(\d+)\$\. .*measure, in degrees, of \$\\angle (\w)\$', p)
    require(m, 'Unknown special-triangle prompt')
    right, hyp, h, leg, s_, asked = m[1], m[2], int(m[3]), m[4], int(m[5]), m[6]
    require(right not in hyp and right in leg and asked != right and 2 * s_ == h, 'Leg must be half the hypotenuse')
    return Fraction(60) if asked in leg else Fraction(30)


def solve(public):
    t = public['templateId']
    require(t in SUPPORTED, 'Unexpected SAT geometry family')
    require(public.get('figure') is None, 'Text setups carry no figure')
    fn = {
        'corresponding-angle-transfer': solve_corresponding, 'crossing-segment-similarity': solve_crossing,
        'angle-chase-chain': solve_chase, 'angle-claim-reasoning': solve_claim,
        'circle-radii-triangle': solve_circle, 'shifted-polynomial-features': solve_shifted,
        'radical-side-entry': solve_radical, 'special-triangle-in-figure': solve_special,
    }[t]
    value = fn(public)
    if t == 'angle-claim-reasoning':
        return value
    response = public['response']
    if t == 'corresponding-angle-transfer':
        require(response['kind'] == 'choice' and len(response['options']) == 4, 'Four choices required')
        labels = [num(re.sub(r'[°$]', '', o['label'])) for o in response['options']]
        require(len(set(labels)) == 4, 'Mathematically duplicate choices')
        hits = [o['id'] for o, v in zip(response['options'], labels) if v == value]
        require(len(hits) == 1, 'Missing or ambiguous correct angle')
        return hits[0]
    require(response['kind'] == 'number', 'Numeric entry required')
    return value


def check_choices(public):
    options = public['response']['options']
    require(len(options) == 4 and len({o['id'] for o in options}) == 4, 'Four distinct choice ids required')
    require(len({o['label'] for o in options}) == 4, 'Duplicate choice labels')


def review_problem(problem):
    public = problem['public']
    result = solve(public)
    if public['templateId'] in CHOICE:
        check_choices(public)
        require(result == problem['answer'], 'Choice answer key mismatch')
    else:
        answer = problem['answer']
        require(isinstance(answer, str) and re.fullmatch(r'-?\d+(\.\d+)?', answer), 'Numeric answer must be a plain decimal')
        require(Fraction(answer) == result, 'Numeric answer key mismatch')
        # The hint must not state the answer as a standalone number.
        require(not re.search(rf'(?<![\w.]){re.escape(answer)}(?!\d|\.\d)', problem['hint']) or len(answer.lstrip('-')) < 2 or re.search(rf'(?<![\w.]){re.escape(answer)}(?!\d|\.\d)', public['prompt']), 'Hint leaks the answer')
    return result


def self_test():
    base = {
        'public': {
            'templateId': 'circle-radii-triangle',
            'prompt': 'Points $A$ and $B$ lie on a circle with center $O$, and chord $\\overline{AB}$ has length 6. The perimeter of triangle $OAB$ is 26. What is the radius of the circle?',
            'response': {'kind': 'number', 'label': 'Answer'},
        },
        'answer': '10', 'hint': 'Use equal radii.',
    }
    review_problem(base)
    corrupt = {
        'wrong numeric answer': lambda p: p.update(answer='9'),
        'impossible chord': lambda p: p['public'].update(prompt=p['public']['prompt'].replace('length 6', 'length 30').replace('is 26', 'is 46')),
        'hint leak': lambda p: p.update(hint='The radius is 10.'),
    }
    rejected = 0
    for name, mutate in corrupt.items():
        bad = copy.deepcopy(base)
        mutate(bad)
        try:
            review_problem(bad)
        except ValueError:
            rejected += 1
            continue
        raise ValueError(f'Corrupt SAT geometry case accepted: {name}')
    choice = {
        'public': {
            'templateId': 'angle-claim-reasoning',
            'prompt': 'In triangle $ABC$, $\\angle A$ measures 103°. Which of the following cannot be the measure of $\\angle B$?',
            'response': {'kind': 'choice', 'options': [
                {'id': 'option-a', 'label': '26°'}, {'id': 'option-b', 'label': '80°'},
                {'id': 'option-c', 'label': '37°'}, {'id': 'option-d', 'label': '56°'}]},
        },
        'answer': 'option-b', 'hint': 'x',
    }
    review_problem(choice)
    for name, mutate in {
        'wrong key': lambda p: p.update(answer='option-a'),
        'two impossible': lambda p: p['public']['response']['options'][0].update(label='90°'),
        'duplicate label': lambda p: p['public']['response']['options'][2].update(label='56°'),
    }.items():
        bad = copy.deepcopy(choice)
        mutate(bad)
        try:
            review_problem(bad)
        except ValueError:
            rejected += 1
            continue
        raise ValueError(f'Corrupt SAT geometry choice accepted: {name}')
    return {'fixtures': 2, 'rejectedMutations': rejected}


if __name__ == '__main__':
    print(self_test())
