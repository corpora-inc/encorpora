"""Independent public-data oracle for statistics, vector and trig clause variants.

The selector uses learner-facing task wording, never the private variant or
answer. Numeric answers are recomputed from the displayed observations,
matrices, coordinates and angles. Choice ids are looked up only after solving.
This module is explicitly routed before the original families' legacy oracles.
"""
import copy
import json
import math
import re
from fractions import Fraction


def require(test, message):
    if not test:
        raise ValueError(message)


def plain(s):
    return s.replace('$', '').replace('−', '-').replace('–', '-').replace('\\,', ' ')


def groups(pattern, text):
    found = re.search(pattern, text)
    require(found is not None, f'Cannot parse {pattern!r} from {text[:180]!r}')
    return found.groups()


def numbers(s):
    return [float(v) for v in re.findall(r'-?\d+(?:\.\d+)?', plain(s))]


def close(a, b, eps=1e-8):
    if isinstance(a, (tuple, list)) and isinstance(b, (tuple, list)):
        return len(a) == len(b) and all(close(x, y, eps) for x, y in zip(a, b))
    return isinstance(a, (int, float, Fraction)) and isinstance(b, (int, float, Fraction)) and abs(a-b) <= eps


def json_answer(value):
    return json.dumps(value, separators=(',', ':'), ensure_ascii=False)


def scalar(s):
    from trigonometry_math_oracle import Reader
    class DivisionReader(Reader):
        def __init__(self, text):
            super().__init__(text)
            self.tokens = re.findall(r'\\[A-Za-z]+|\d+\.\d+|\d+|[A-Za-z]|[{}()+\-^/*]', plain(text))

        def term(self):
            result = self.factor()
            while self.peek() in ('/', '*') or self.starts_factor():
                if self.peek() in ('/', '*'):
                    op = self.take()
                    sign = 1
                    if self.peek() in ('-', '+'):
                        sign = -1 if self.take() == '-' else 1
                    factor = sign*self.factor()
                    result = result/factor if op == '/' else result*factor
                else:
                    result *= self.factor()
            return result

    text = plain(s).replace('°', '').strip()
    if re.fullmatch(r'[+-]?\d+(?:\.\d+)?(?:/\d+)?', text):
        return float(Fraction(text))
    return DivisionReader(text).value()


def matrices(s):
    return [[[scalar(x) for x in row.split('&')] for row in body.split('\\\\')]
            for body in re.findall(r'\\begin\{bmatrix\}(.*?)\\end\{bmatrix\}', s)]


def vector(s):
    body, = groups(r'\\langle\s*(.*?)\s*\\rangle', s)
    return [scalar(v) for v in body.split(',')]


def fitted_line(s):
    coefficient,sign,constant = groups(r'\\hat\s+y\s*=\s*([+-]?(?:\d+(?:\.\d+)?)?)x\s*([+-])\s*(\d+(?:\.\d+)?)',plain(s))
    slope = {'':1.0,'+':1.0,'-':-1.0}.get(coefficient)
    return (float(coefficient) if slope is None else slope,float(sign+constant))


def mmul(a, b):
    return [[sum(x*y for x, y in zip(row, col)) for col in zip(*b)] for row in a]


def mscale(a, c):
    return [[c*x for x in row] for row in a]


def transpose(a):
    return [list(col) for col in zip(*a)]


def det3(a):
    return (a[0][0]*(a[1][1]*a[2][2]-a[1][2]*a[2][1])
            - a[0][1]*(a[1][0]*a[2][2]-a[1][2]*a[2][0])
            + a[0][2]*(a[1][0]*a[2][1]-a[1][1]*a[2][0]))


def linear_solve(a, b):
    """Exact Gaussian elimination, independent of the supplied inverse."""
    aug = [[Fraction(x) for x in row]+[Fraction(b[i])] for i, row in enumerate(a)]
    for j in range(len(a)):
        pivot = next((i for i in range(j, len(a)) if aug[i][j]), None)
        require(pivot is not None, 'Singular displayed system')
        aug[j], aug[pivot] = aug[pivot], aug[j]
        d = aug[j][j]
        aug[j] = [v/d for v in aug[j]]
        for i in range(len(a)):
            if i != j:
                factor = aug[i][j]
                aug[i] = [v-factor*w for v, w in zip(aug[i], aug[j])]
    return [row[-1] for row in aug]


def elements(public):
    return public.get('figure', {}).get('scene', {}).get('elements', [])


def table_rows(public):
    return next(e['rows'] for e in elements(public) if e['type'] == 'lineTable')


def paired_data(public):
    """Read a two-column table, including repeated side-by-side blocks."""
    rows = table_rows(public)
    return [[float(row[j]), float(row[j+1])]
            for j in range(0, len(rows[0]), 2) for row in rows[1:]
            if row[j] != '' and row[j+1] != '']


def graph_of(public):
    return next(e for e in elements(public) if e['type'] == 'graph')


def choice(options, predicate):
    hits = [o['id'] for o in options if predicate(o['label'])]
    require(len(hits) == 1, f'Expected exactly one correct choice; got {hits}')
    return hits[0]


def exact_choice(options, text):
    return choice(options, lambda s: plain(s) == plain(text))


def numeric_choice(options, answer, parse=scalar):
    values = []
    for o in options:
        try:
            value = parse(o['label'])
        except (ValueError, TypeError, IndexError, ZeroDivisionError):
            value = None
        if value is not None:
            require(not any(close(value, old) for old in values), f'Mathematically duplicate choices: {options}')
            values.append(value)
    return choice(options, lambda s: _parsed_close(s, answer, parse))


def _parsed_close(s, expected, parse):
    try:
        return close(parse(s), expected)
    except (ValueError, TypeError, IndexError, ZeroDivisionError):
        return False


def matrix_label(s):
    found = matrices(s)
    require(len(found) == 1, 'Expected one matrix choice')
    return found[0]


def parts(public, solvers):
    blanks = public['response']['blanks']
    require(len(blanks) == len(solvers), 'Unexpected number of answer parts')
    return json_answer({b['id']: solver(b['options']) for b, solver in zip(blanks, solvers)})


def work(values):
    def show(v):
        f = Fraction(str(v))
        return str(f.numerator) if f.denominator == 1 else str(float(f))
    return json_answer([[show(v)] for v in values])


def plot(values):
    return json_answer([list(map(lambda x: int(x) if x == int(x) else x, p)) for p in sorted(values)])


MARKERS = {
    'representative-sample-choice': ('Is this conclusion supported by the sampling method?',),
    'sample-proportion-estimate': ('Which conclusion does this sample support?',),
    'sample-estimates-plot': ('A simulation draws ten independent random samples',),
    'scatter-association-choice': ('Select all the patterns shown.', 'Each table row gives one student'),
    'trend-slope-meaning': ('What is the practical meaning of the intercept',),
    'two-way-association-choice': ('Among students with chores,',),
    'two-way-missing': ('Tally these',),
    'study-design-classify': ('Classify the most specific study design',),
    'margin-of-error-interval': ('Find the smallest band centered at',),
    'relative-frequency-percent': ('Complete the table, then find the percent of seniors',),
    'nonlinear-data-model': ('The table gives paired measurements.',),
    'residual-function-fit': ('The table gives observed values.', 'Each graph shows the same machine measurements', "The table records a machine's output"),
    'correlation-choice': ('Technology output for',),
    'matrix-linear-system': ('A calculator supplies',),
    'vector-components': ('The tail is', 'Find the three magnitudes', 'gold arrow goes from', 'Find the opposite vector', 'Use direction angles from 0'),
    'vector-resultant': ('Their smaller angle is',),
    'matrix-laws': ('Which matrix Z satisfies', 'NOT an identity valid for every', 'be the zero matrix, and I the identity', 'Compare the zero and identity matrices', 'which equation is NOT an identity?', 'Compute both orders and distinguish'),
    'matrix-data-reading': ('Each arrow is a one-way road.', 'Two players each choose Heads or Tails', 'Represent the data with stores as rows'),
    'matrix-operations': ('The original matrix is', 'Find $3A-2B$', 'Find $A-B$'),
    'special-angle-exact-value': ('Its diagonal creates two congruent right triangles.', 'Its altitude bisects the base'),
    'trig-identity-value': ('Complete the proof, then divide the identity', 'Both chords subtend angle', 'Use the tangent addition or subtraction formula'),
    'complementary-trig': ('Which ratio at the other acute angle', 'for every such right triangle?'),
    'oblique-triangle-solve': ('Surveying: stations P and Q', 'Two forces of', 'A ship leaves harbor on bearing'),
    'triangle-law-reasoning': ('What does the law of cosines for side c become?', 'What does a/sin A = c/sin C become?', 'Use the law of cosines to find c.'),
}


def matches(public):
    return any(marker in public['prompt'] for marker in MARKERS.get(public['templateId'], ()))


def solve(public):
    require(matches(public), 'Not a clause-variant prompt')
    tid, p, response = public['templateId'], plain(public['prompt']), public['response']
    opts = response.get('options', [])
    if tid == 'representative-sample-choice':
        n, population, count, num, den = map(int, groups(r'surveys (\d+) of the school.*?(\d+) students,.*?asked, (\d+) read.*?about (\d+)/(\d+)', p))
        require(count*den == n*num and n < population, 'Incorrect sample fraction')
        valid = 'chosen at random from the complete school roster' in p
        return choice(opts, lambda s: s.startswith('Yes. Random selection') if valid else s.startswith('No. The sample reaches'))
    if tid == 'sample-proportion-estimate':
        numeric = [int(x.replace(',', '')) for x in re.findall(r'\d[\d,]*', p)]
        require(len(numeric) >= 3, 'Missing sampling givens')
        n, population, count = numeric[:3]
        expected = Fraction(count*population, n)
        return choice(opts, lambda s: s.startswith('The estimated population count is about ') and close(numbers(s)[0], expected))
    if tid == 'sample-estimates-plot':
        n, population = map(int, groups(r'samples of (\d+) students from a model school of (\d+)', p))
        values = public['figure']['values']
        require(len(values) == 10 and all(0 <= x <= n for x in values), 'Invalid sample counts')
        estimates = [Fraction(x*population, n) for x in values]
        lo, hi, mean = min(estimates), max(estimates), sum(estimates)/10
        require(3 <= max(values)-min(values) <= 7, 'Sample count range outside specification')
        if response['kind'] == 'choice':
            stated, = groups(r'class estimate is ([\d.]+)', p)
            require(close(float(stated), mean), 'Incorrect class estimate')
            return choice(opts, lambda s: s.startswith('The simulated estimates range from ') and close(numbers(s)[:2], [lo, hi]) and 'not guaranteed' in s)
        if 'largest distance' in p:
            stated, = groups(r'class estimate is ([\d.]+)', p)
            require(close(float(stated), mean), 'Incorrect class estimate')
            return work([max(abs(x-mean) for x in estimates)])
        return work([hi-lo])
    if tid in ('scatter-association-choice', 'nonlinear-data-model') and 'table' in p:
        data = paired_data(public)
        if response['kind'] == 'point-plot':
            require(len(data) <= 4, 'Point protocol capacity exceeded')
            return plot(data)
        xs, ys = [x for x,y in data], [y for x,y in data]
        xm, ym = sum(xs)/len(xs), sum(ys)/len(ys)
        variance = sum((x-xm)**2 for x in xs)
        require(variance > 0, 'All horizontal measurements are identical')
        slope = sum((x-xm)*(y-ym) for x,y in data)/variance
        intercept = ym-slope*xm
        fits = [('linear',sum((y-slope*x-intercept)**2 for x,y in data))]
        # A quadratic describes the named falling-then-rising family only
        # when the observations turn and its fitted vertex lies inside the
        # observed horizontal range.
        # Without this condition quadratics contain all linear fits, making
        # a raw comparison of their SSEs an invalid shape classifier.
        basis = [[1,x,x*x] for x in xs]
        normal = [[sum(row[i]*row[j] for row in basis) for j in range(3)] for i in range(3)]
        rhs = [sum(row[i]*y for row,y in zip(basis,ys)) for i in range(3)]
        constant,linear,quadratic = map(float,linear_solve(normal,rhs))
        ordered = sorted(data)
        observed_turn = min(ys) < min(ordered[0][1],ordered[-1][1])
        if quadratic > 1e-10 and observed_turn:
            vertex = -linear/(2*quadratic)
            if min(xs) < vertex < max(xs):
                fits.append(('quadratic',sum((y-constant-linear*x-quadratic*x*x)**2 for x,y in data)))
        if tid == 'nonlinear-data-model':
            exponentials = [2**(x-min(xs)) for x in xs]
            factor = sum(v*y for v,y in zip(exponentials,ys))/sum(v*v for v in exponentials)
            if factor > 0:
                fits.append(('exponential',sum((y-factor*v)**2 for v,y in zip(exponentials,ys))))
        kind, error = min(fits,key=lambda pair:pair[1])
        # Each observation may differ by at most one unit from its model;
        # its least-squares error cannot exceed one squared unit per row.
        if error > len(data)+1e-8:
            require(tid == 'scatter-association-choice','None of the named models fits the data')
            prefix = 'No clear'
        elif tid == 'nonlinear-data-model':
            prefix = {'linear':'Linear:','quadratic':'Quadratic:','exponential':'Exponential:'}[kind]
        else:
            prefix = 'Nonlinear' if kind == 'quadratic' else 'Positive linear' if slope > 0 else 'Negative linear'
        return choice(opts, lambda s: s.startswith(prefix))
    if tid == 'scatter-association-choice':
        g = graph_of(public)
        points = g['scatter']['points']
        labeled = {point.get('label'): (point['x'], point['y']) for point in g.get('points', [])}
        cloud = [point for point in points if not close(point, labeled.get('P'))]
        xbar, ybar = sum(x for x,y in cloud)/len(cloud), sum(y for x,y in cloud)/len(cloud)
        slope = sum((x-xbar)*(y-ybar) for x,y in cloud)/sum((x-xbar)**2 for x,y in cloud)
        residual = lambda q: abs(q[1]-ybar-slope*(q[0]-xbar))
        outlier = 'P' in labeled
        if outlier:
            require(residual(labeled['P']) >= 3*max(residual(q) for q in cloud), 'Outlier too close to cloud')
        xs = sorted(set(x for x,y in points))
        clustered = max(b-a for a,b in zip(xs,xs[1:])) >= (max(xs)-min(xs))/3
        flat = max(y for x,y in cloud)-min(y for x,y in cloud) <= 4
        require(residual(labeled['E']) <= 3, 'Extreme-x decoy is off trend')
        expected = []
        for o in opts:
            label = o['label']
            if label == ('No clear association' if flat else 'Positive association' if slope > 0 else 'Negative association') or (clustered and label.startswith('Two clusters')) or (outlier and label.startswith('An outlier at P')):
                expected.append(o['id'])
        require(len(expected) == response['selectionCount'], 'Incorrect selection count')
        return json_answer(sorted(expected))
    if tid == 'trend-slope-meaning':
        intercept, = groups(r'meaning of the intercept (-?\d+)', p)
        absurd = 'adult mass' in p
        if absurd:
            require(all(y > 0 for x,y in graph_of(public)['scatter']['points']), 'Negative observed adult mass')
        return choice(opts, lambda s: s.startswith('The intercept has no practical meaning:') if absurd else s.startswith('At zero practice hours,') and close(numbers(s)[0], float(intercept)))
    if tid == 'two-way-association-choice':
        rows = table_rows(public)
        a, c = map(int, rows[1][1:]); n1, n2 = map(int, rows[3][1:])
        p1, p2 = 100*a/n1, 100*c/n2
        return choice(opts, lambda s: re.match(r'(Yes|No): .*% with chores', s) is not None and s.startswith('Yes' if abs(p1-p2) >= 25 else 'No') and close(numbers(s), [p1, p2]))
    if tid == 'two-way-missing':
        pairs = re.findall(r'\w+: curfew (yes|no), chores (yes|no)', p)
        n, = groups(r'Tally these (\d+)', p)
        require(len(pairs) == int(n), 'Roster count disagrees with prompt')
        cells = [pairs.count(pair) for pair in [('yes','yes'),('yes','no'),('no','yes'),('no','no')]]
        require(min(cells) > 0, 'Empty table cell')
        return work(cells)
    if tid == 'relative-frequency-percent':
        total, junior, a, c = map(int, groups(
            r'surveyed (\d+) students?.*?(?:are|is) (\d+) juniors?.*?juniors?, (\d+) (?:students? )?ha(?:s|ve).*?; (\d+) seniors?',
            p,
        ))
        senior = total-junior
        require(0 < a < junior and 0 < c < senior, 'Invalid survey counts')
        return work([a, junior-a, c, senior-c, Fraction(100*c, senior)])
    if tid == 'study-design-classify':
        kind = 1 if 'randomly assigns 80 volunteers' in p else 2 if 'randomly select 200' in p else 0
        labels = ['Sample survey', 'Randomized experiment', 'Observational study']
        prefixes = ["Random selection supports generalizing to the city's", 'Random assignment supports a causal comparison', 'Random selection supports generalizing; no assignment']
        require(('complete list' in p) if kind == 0 else ('assign' in p), 'Missing design premise')
        return parts(public, [lambda options: exact_choice(options, labels[kind]), lambda options: choice(options, lambda s: s.startswith(prefixes[kind]))])
    if tid == 'margin-of-error-interval':
        center, = groups(r'band centered at (\d+(?:\.\d+)?)', p)
        center = Fraction(center)
        data = [[Fraction(str(x)),int(n)] for x,n in paired_data(public)]
        require(sum(n for x,n in data) == 100, 'Simulation does not have 100 samples')
        distances = sorted(abs(x-center) for x,n in data for _ in range(int(n)))
        margin = distances[94]
        require(sum(n for x,n in data if abs(x-center) < margin) < 95 <= sum(n for x,n in data if abs(x-center) <= margin), 'Not minimal centered 95-result band')
        return work([margin, center-margin, center+margin])
    if tid == 'residual-function-fit':
        if 'The table gives observed values.' in p:
            slope, intercept = fitted_line(p)
            data = paired_data(public)
            residuals = [[x, y-slope*x-intercept] for x,y in data]
            if response['kind'] == 'point-plot':
                return plot(residuals[:4])
            ys = [y for x,y in residuals]
            runs = []
            for y in ys:
                sign = 1 if y > 0 else -1 if y < 0 else 0
                if not runs or sign != runs[-1][0]: runs.append([sign,1])
                else: runs[-1][1] += 1
            curved = [x for x,n in runs] == [-1,1,-1]
            require(curved or max(n for x,n in runs) <= 2, 'Ambiguous residual pattern')
            return choice(opts, lambda s: s.startswith('The residuals bend,') if curved else s.startswith('The residuals have no clear pattern,'))
        if response['kind'] == 'structured-work':
            slope, intercept = fitted_line(p)
            data = paired_data(public)
            xbar, ybar = sum(x for x,y in data)/len(data), sum(y for x,y in data)/len(data)
            lslope = sum((x-xbar)*(y-ybar) for x,y in data)/sum((x-xbar)**2 for x,y in data)
            require(close([slope,intercept], [lslope,ybar-lslope*xbar]), 'Claimed least-squares line is incorrect')
            return work([slope*7+intercept])
        scores = []
        reference = None
        for o in opts:
            g = next(e for e in o['scene']['elements'] if e['type'] == 'graph')
            data, fit = g['scatter']['points'], g['scatter']['fit']
            require(reference is None or close(reference,data), 'Fit candidates use different data')
            reference = data
            scores.append((sum((y-fit['m']*x-fit['b'])**2 for x,y in data), o['id']))
        scores.sort()
        require(scores[0][0]*2 <= scores[1][0], 'Fit candidates insufficiently separated')
        return scores[0][1]
    if tid == 'correlation-choice':
        slope, intercept, squared = map(float, groups(r'a=(-?\d+(?:\.\d+)?), b=(-?\d+(?:\.\d+)?), r\^2=(\d+(?:\.\d+)?)', p))
        data = graph_of(public)['scatter']['points']
        xm, ym = sum(x for x,y in data)/len(data), sum(y for x,y in data)/len(data)
        correlation = sum((x-xm)*(y-ym) for x,y in data)/math.sqrt(sum((x-xm)**2 for x,y in data)*sum((y-ym)**2 for x,y in data))
        expected = math.copysign(math.sqrt(squared), slope)
        require(close(correlation,expected), 'Scatter does not realize the displayed correlation')
        return numeric_choice(opts, expected)
    if tid in ('vector-components', 'vector-resultant'):
        return solve_vectors(public)
    if tid.startswith('matrix-'):
        return solve_matrices(public)
    return solve_trigonometry(public)


def solve_vectors(public):
    p, response = plain(public['prompt']), public['response']
    opts = response.get('options', [])
    if 'Their smaller angle is' in p:
        a, first, b, second, theta = map(float, groups(r'first vector has magnitude ([\d.]+).*?direction ([\d.]+)°.*?second has magnitude ([\d.]+).*?direction ([\d.]+)°.*?smaller angle is ([\d.]+)°', p))
        x = a*math.cos(math.radians(first))+b*math.cos(math.radians(second))
        y = a*math.sin(math.radians(first))+b*math.sin(math.radians(second))
        magnitude = math.hypot(x,y)
        angle = round(math.degrees(math.atan2(y,x))%360,1)%360
        require(close(abs((second-first+180)%360-180), theta), 'Incorrect included angle')
        return parts(public, [lambda options: numeric_choice(options,magnitude), lambda options: numeric_choice(options,angle)])
    if 'Use direction angles from 0' in p:
        magnitude, theta, c = map(float, groups(r'magnitude ([\d.]+) and direction ([\d.]+)°.*?direction of (-?[\d.]+)v',p))
        return parts(public,[lambda options:numeric_choice(options,abs(c)*magnitude),lambda options:exact_choice(options,'Along v' if c>0 else 'Against v'),lambda options:numeric_choice(options,(theta+(180 if c<0 else 0))%360)])
    vectors = [vector(s) for s in re.findall(r'\\langle.*?\\rangle',p)]
    if 'Find the three magnitudes' in p:
        u,v = vectors
        lu,lv = math.hypot(*u),math.hypot(*v)
        resultant = [a+b for a,b in zip(u,v)]
        ls = math.hypot(*resultant)
        require(ls <= lu+lv+1e-9,'Triangle inequality violated')
        return parts(public,[lambda o:numeric_choice(o,lu),lambda o:numeric_choice(o,lv),lambda o:numeric_choice(o,ls),lambda o:exact_choice(o,'Equal' if close(ls,lu+lv) else 'Less')])
    if 'gold arrow goes from' in p or 'Find the opposite vector' in p:
        v,w = vectors
        difference = [a-b for a,b in zip(v,w)]
        require(abs(v[0]*w[1]-v[1]*w[0])>0,'Difference vectors must not be parallel')
        if response['kind']=='choice':
            segment = next(s for s in graph_of(public)['segments'] if s.get('color')=='gold')
            require(close(segment['from'],w) and close(segment['to'],v) and segment.get('arrow'),'Subtraction arrow reversed')
            return exact_choice(opts,'$v-w$')
        return parts(public,[lambda o:numeric_choice(o,[-x for x in w],vector),lambda o:exact_choice(o,'The same length and the opposite direction'),lambda o:numeric_choice(o,difference,vector)])
    tail = list(map(float,groups(r'O=\((-?\d+),(-?\d+)\)',p)))
    if 'parallelogram' in p:
        result = [a+b for a,b in zip(*vectors)]
        require(abs(vectors[0][0]*vectors[1][1]-vectors[0][1]*vectors[1][0])>0,'Degenerate parallelogram')
    elif 'Represent' in p:
        c, = groups(r'Represent (-?[\d.]+)v',p)
        result = [float(c)*v for v in vectors[0]]
    else:
        horizontal, eastwest, vertical, northsouth = groups(r'displacement is (\d+) km (east|west) and (\d+) km (north|south)',p)
        result = [int(horizontal)*(1 if eastwest=='east' else -1),int(vertical)*(1 if northsouth=='north' else -1)]
    tip = [a+b for a,b in zip(tail,result)]
    if response['kind']=='point-plot':
        grid=response['grid']
        require(grid['xMin']<=tip[0]<=grid['xMax'] and grid['yMin']<=tip[1]<=grid['yMax'],'Tip outside plot grid')
        return plot([tip])
    hits=[]
    for o in opts:
        segments=next(e for e in o['scene']['elements'] if e['type']=='graph').get('segments',[])
        if len(segments)==1 and segments[0].get('arrow') and close(segments[0]['from'],tail) and close(segments[0]['to'],tip): hits.append(o['id'])
    require(len(hits)==1,'Expected exactly one correct arrow')
    return hits[0]


def solve_matrices(public):
    p,response=plain(public['prompt']),public['response']
    opts=response.get('options',[])
    tid=public['templateId']
    if tid=='matrix-linear-system':
        equations=re.findall(r'([+\-\dxyz]+)=(-?\d+)',p)
        require(len(equations)==3,'Expected three equations')
        A=[]; constants=[]
        for left,right in equations:
            row=[]
            for var in 'xyz':
                match=re.search(r'([+-]?\d*)'+var,left)
                coefficient=match.group(1) if match else '0'
                row.append(1 if coefficient in ('','+') else -1 if coefficient=='-' else int(coefficient))
            A.append(row); constants.append(int(right))
        inverse=matrices(p)[0]
        require(close(mmul(A,inverse),[[1,0,0],[0,1,0],[0,0,1]]),'Supplied inverse is incorrect')
        require(abs(det3(A))==1 and all(float(x).is_integer() for row in inverse for x in row),'Not an integer unimodular inverse')
        X=linear_solve(A,constants)
        return parts(public,[lambda o:numeric_choice(o,A,matrix_label),lambda o:numeric_choice(o,X,vector)])
    if tid=='matrix-laws':
        if 'Which matrix Z satisfies' in p:return numeric_choice(opts,[[0,0],[0,0]],matrix_label)
        if 'NOT an identity valid for every' in p:
            return choice(opts,lambda s:plain(s) in ['A+I=A','AO=A','AI=O','A+O=O'])
        if 'which equation is NOT an identity?' in p:
            return choice(opts,lambda s:plain(s) in ['AB=BA','(A+B)(A-B)=A^2-B^2'])
        if 'be the zero matrix, and I the identity' in p:
            A=matrices(p)[0]; operation,=groups(r'Find ([AIO+\-]+)',p)
            expected=A if operation in ('A+O','AI') else [[0,0],[0,0]]
            return numeric_choice(opts,expected,matrix_label)
        if 'Compare the zero and identity matrices' in p:
            return parts(public,[lambda o:numeric_choice(o,1),lambda o:exact_choice(o,'$a\\cdot0=0$')])
        A,B=matrices(p)
        ab,ba=mmul(A,B),mmul(B,A)
        return parts(public,[lambda o:numeric_choice(o,ab,matrix_label),lambda o:numeric_choice(o,ba,matrix_label),lambda o:exact_choice(o,'Yes' if close(ab,ba) else 'No'),lambda o:exact_choice(o,'For some pairs, but not in general')])
    if tid=='matrix-data-reading':
        if 'Each arrow is a one-way road.' in p:
            g=graph_of(public)
            nodes={point['label']:(point['x'],point['y']) for point in g['points']}
            A=[[0]*4 for _ in range(4)]
            for seg in g['segments']:
                require(seg.get('arrow'),'Network road lacks a direction')
                i=next(i for i,c in enumerate('ABCD') if close(nodes[c],seg['from']))
                j=next(j for j,c in enumerate('ABCD') if close(nodes[c],seg['to']))
                require(i!=j and A[i][j]==0,'Network has loop or repeated edge')
                A[i][j]+=1
            if 'roads leave C' in p:return numeric_choice(opts,sum(A[2]))
            if 'most incoming roads' in p:
                totals=list(map(sum,zip(*A))); highest=max(totals)
                return exact_choice(opts,', '.join(c for c,n in zip('ABCD',totals) if n==highest))
            return numeric_choice(opts,A,matrix_label)
        if 'Two players each choose Heads or Tails' in p:
            A=[[float(v) for v in row[1:]] for row in table_rows(public)[1:]]
            if "column player's payoff matrix" in p:return numeric_choice(opts,mscale(A,-1),matrix_label)
            if 'What does the row player win' in p:
                i,j=map(int,groups(r'row (\d+), column (\d+)',p));return numeric_choice(opts,A[i-1][j-1])
            kind,index=groups(r'Find the (row|column) (\d+) total',p)
            return numeric_choice(opts,sum((A if kind=='row' else transpose(A))[int(index)-1]))
        stores_text,items_text=groups(r'order (.*?), and items as columns in order (.*?)\.',p)
        stores=stores_text.split(', ');items=items_text.split(', ')
        A=[]
        for store in stores:
            text,=groups(re.escape(store)+r' has (.*?)(?:;|\. Represent)',p)
            A.append([int(groups(r'(\d+) '+re.escape(item)+r'(?:,|$)',text)[0]) for item in items])
        return numeric_choice(opts,A,matrix_label)
    if 'The original matrix is' in p:
        A=matrices(p)[0]
        if 'Half of every stock' in p:c=0.5
        elif "other player's winnings" in p:c=-1
        else:c=float(groups(r'Multiply every payoff by ([\d.]+)',p)[0])
        return numeric_choice(opts,mscale(A,c),matrix_label)
    A,B=matrices(p)
    if len(A)!=len(B) or len(A[0])!=len(B[0]):return exact_choice(opts,'Not defined: the dimensions differ')
    a,b=(3,2) if '3A-2B' in p else (1,1)
    difference=[[a*x-b*y for x,y in zip(arow,brow)]for arow,brow in zip(A,B)]
    if response['kind']=='structured-work':return work([x for row in difference for x in row])
    return numeric_choice(opts,difference,matrix_label)


def solve_trigonometry(public):
    p,response=plain(public['prompt']),public['response']
    opts=response.get('options',[])
    tid=public['templateId']
    if tid=='special-angle-exact-value':
        fn=groups(r'derive \\(sin|cos|tan)',p)[0]
        degrees=float(groups(r'Here (\d+)\^\\circ',p)[0])
        side=float(groups(r'(?:square has side|triangle has side) (\d+)',p)[0])
        expected=side*math.sqrt(2) if 'square' in p else side*math.sqrt(3)/2
        value=getattr(math,fn)(math.radians(degrees))
        triangles=[e for e in elements(public) if e['type']=='triangle']
        require(len(triangles)==1,'Special-triangle derivation missing its triangle')
        triangle=triangles[0]
        points=triangle['points']
        require(close(math.dist(points[2],points[0]),expected),'Drawn cut length is not to scale')
        gold=next(i for i,a in enumerate(triangle['angles']) if a.get('color')=='gold')
        u=[x-y for x,y in zip(points[(gold+1)%3],points[gold])]
        v=[x-y for x,y in zip(points[(gold-1)%3],points[gold])]
        gold_angle=math.degrees(math.acos(sum(x*y for x,y in zip(u,v))/math.hypot(*u)/math.hypot(*v)))
        require(close(gold_angle,degrees),'Gold reference angle disagrees with prompt')
        return parts(public,[lambda o:numeric_choice(o,expected),lambda o:numeric_choice(o,value)])
    if tid=='trig-identity-value' and 'Complete the proof' in p:
        theta=float(groups(r'\\theta=(\d+)\^\\circ',p)[0])
        x,y=map(float,groups(r'approximately \((-?[\d.]+), (-?[\d.]+)\)',p))
        require(abs(x*x+y*y-1)<0.005,'Rounded circle point does not satisfy the radius tolerance')
        require(close([x,y],[round(math.cos(math.radians(theta)),2),round(math.sin(math.radians(theta)),2)]),'Displayed circle coordinates incorrect')
        g=graph_of(public)
        point=next(q for q in g['points'] if q.get('label')=='P')
        require(close([point['x'],point['y']],[math.cos(math.radians(theta)),math.sin(math.radians(theta))]),'Circle point drawn at wrong angle')
        return parts(public,[lambda o:exact_choice(o,'$\\cos^2\\theta+\\sin^2\\theta=1$'),lambda o:exact_choice(o,'Squaring a coordinate gives the same square as its absolute length'),lambda o:exact_choice(o,'$1+\\tan^2\\theta=\\sec^2\\theta$')])
    if tid=='trig-identity-value' and 'Both chords subtend angle' in p:
        alpha,beta=map(float,groups(r'\\alpha=(\d+)\^\\circ, \\beta=(\d+)\^\\circ',p))
        g=graph_of(public); points={q['label']:[q['x'],q['y']] for q in g['points']}
        distance=lambda a,b:math.hypot(*(x-y for x,y in zip(a,b)))
        require(close(distance(points['A'],points['B']),distance(points['C'],points['D'])),'Chords do not have equal lengths')
        if 'Why are the two chords equal?' in p:
            return choice(opts,lambda s:s.startswith('Rotating by'))
        if 'cosine difference formula, replace' in p:
            target=lambda a,b:math.cos(math.radians(a+b))
        elif 'Expand AB' in p:
            target=lambda a,b:math.cos(math.radians(a-b))
        else:
            fn,sign=groups(r'\\(sin|tan)\(\\alpha([+-])\\beta\)',p.rsplit('Both chords subtend angle',1)[1])
            target=lambda a,b:getattr(math,fn)(math.radians(a+(b if sign=='+' else -b)))
        def evaluate(label,a,b):
            expression=plain(label).split('=')[-1]
            expression=expression.replace('\\alpha',f'({math.radians(a)})').replace('\\beta',f'({math.radians(b)})')
            return scalar(expression)
        def identity(label):
            return all(close(evaluate(label,a,b),target(a,b)) for a,b in [(19,31),(77,21),(135,30)])
        answer=choice(opts,identity)
        values=[evaluate(o['label'],alpha,beta) for o in opts]
        truth=target(alpha,beta)
        for o,value in zip(opts,values):
            if o['id']!=answer:require(abs(value-truth)>0.05,'Formula distractor equals or nearly equals the displayed case')
        require(all(abs(a-b)>1e-8 for i,a in enumerate(values) for b in values[i+1:]),'Formula distractors collide numerically')
        return answer
    if tid=='trig-identity-value':
        degrees,a,sign,b=groups(r'Use (\d+)\^\\circ=(\d+)\^\\circ([+-])(\d+)\^\\circ',p)
        degrees,a,b=map(int,[degrees,a,b])
        require(degrees==a+(b if sign=='+' else -b),'Incorrect angle decomposition')
        return numeric_choice(opts,math.tan(math.radians(degrees)))
    if tid in ('complementary-trig','triangle-law-reasoning'):
        a,b=map(float,groups(r'a=(\d+).*?b=(\d+)',p))
        hyp=math.hypot(a,b)
        if tid=='triangle-law-reasoning':
            if response['kind']=='structured-work':
                triangle=next(e for e in elements(public) if e['type']=='triangle')
                require('?' in str(triangle['sides'][0].get('label','')),'Asked-for hypotenuse is exposed in the figure')
                return work([hyp])
            if 'law of cosines' in p:return exact_choice(opts,'$c^2=a^2+b^2$')
            return exact_choice(opts,'$\\sin A=a/c$')
        named,other=groups(r'(?:Why is \\sin |\\sin )([AB])(?:=\\cos ([AB])|=)',p)
        other=other or ('B' if named=='A' else 'A')
        if 'Why is' in p:
            return exact_choice(opts,f'The side opposite {named} touches {other}; both ratios divide it by the hypotenuse.')
        def ratio(label):
            fn,letter=groups(r'\\(sin|cos|tan) ([AB])',plain(label))
            opposite,adjacent=(a,b) if letter=='A' else (b,a)
            return opposite/hyp if fn=='sin' else adjacent/hyp if fn=='cos' else opposite/adjacent
        return numeric_choice(opts,(a if named=='A' else b)/hyp,ratio)
    if tid=='oblique-triangle-solve':
        if p.startswith('Surveying:'):
            d,P,Q=map(float,groups(r'(\d+) m apart.*?P = (\d+)° and Q = (\d+)°',p))
            R=180-P-Q
            require(P>0 and Q>0 and R>0,'Invalid surveying triangle')
            expected=round(d*math.sin(math.radians(Q))/math.sin(math.radians(R)))
            if response['kind']=='structured-work':return work([R,expected])
            return numeric_choice(opts,expected,lambda s:float(numbers(s)[0]))
        if 'Two forces of' in p:
            a,b,theta=map(float,groups(r'forces of (\d+) N and (\d+) N.*?angle (\d+)°',p))
        else:
            first,a,b,second=map(float,groups(r'bearing (\d+)° for (\d+) km, then travels (\d+) km on bearing (\d+)°',p))
            theta=abs((second-first+180)%360-180)
        x=a+b*math.cos(math.radians(theta));y=b*math.sin(math.radians(theta))
        expected=round(math.hypot(x,y),1)
        if response['kind']=='structured-work':return work([180-theta,expected])
        return numeric_choice(opts,expected,lambda s:float(numbers(s)[0]))
    raise ValueError('Unknown clause trigonometry prompt: '+public['prompt'])


def review_problem(problem):
    expected=solve(problem['public'])
    actual=problem['answer']
    if expected.startswith(('[','{')):
        require(json.loads(expected)==json.loads(actual),'Clause answer disagrees with independent public-data solution')
    else:
        require(expected==actual,'Clause answer disagrees with independent public-data solution')
    return expected


def self_test():
    def survey(prompt):
        return solve({
            'templateId': 'relative-frequency-percent',
            'prompt': prompt,
            'response': {'kind': 'structured-work'},
        })
    old_survey = 'A school surveyed 100 students. There are 60 juniors. Of the juniors, 21 have a part-time job; 10 seniors have a job. Complete the table, then find the percent of seniors who have a job.'
    new_survey = 'A school surveyed 100 students. There are 60 juniors. Of the juniors, 1 student has a part-time job; 10 seniors have a job. Complete the table, then find the percent of seniors who have a job.'
    require(survey(old_survey) == '[["21"],["39"],["10"],["30"],["25"]]', 'Older junior-count wording')
    require(survey(new_survey) == '[["1"],["59"],["10"],["30"],["25"]]', 'Agreed junior-count wording')
    require(close(linear_solve([[1,2,0],[0,1,-1],[2,3,2]],[5,1,10]),[1,2,1]),'Gaussian elimination fixture')
    require(close(mmul([[1,2],[3,4]],[[0,1],[1,0]]),[[2,1],[4,3]]),'Matrix multiply fixture')
    require(close(fitted_line(r'The fitted line is $\hat y=x+3$.'),[1,3]),'Omitted unit slope fixture')
    require(close(fitted_line(r'The fitted line is $\hat y=-x+3$.'),[-1,3]),'Omitted negative unit slope fixture')
    require(close(fitted_line(r'The fitted line is $\hat y=2x-3$.'),[2,-3]),'Signed intercept fixture')
    require(numeric_choice([{'id':'a','label':'$\\sqrt{9}$'},{'id':'b','label':'4'}],3)=='a','Radical choice fixture')
    try:
        numeric_choice([{'id':'a','label':'3'},{'id':'b','label':'$\\sqrt{9}$'}],3)
    except ValueError:
        pass
    else:
        raise ValueError('Equivalent distractor was accepted')
    sampling={
        'public': {
            'templateId':'sample-estimates-plot',
            'prompt':'A simulation draws ten independent random samples of 20 students from a model school of 1000. How many students apart are the largest and smallest estimates?',
            'response':{'kind':'structured-work'},
            'figure':{'values':[8,9,10,11,12,13,10,11,12,13]},
        },
        'answer':'[["250"]]',
    }
    review_problem(sampling)
    wrong_key=copy.deepcopy(sampling);wrong_key['answer']='[["251"]]'
    wrong_givens=copy.deepcopy(sampling);wrong_givens['public']['figure']['values'][0]=7
    tangent={
        'public': {
            'templateId':'trig-identity-value',
            'prompt':r'Use the tangent addition or subtraction formula to find the exact value of $\tan(75^\circ)$. Use $75^\circ=45^\circ+30^\circ$.',
            'response':{'kind':'choice','options':[
                {'id':'a','label':r'$2+\sqrt{3}$'},
                {'id':'b','label':r'$2-\sqrt{3}$'},
                {'id':'c','label':r'$1+\sqrt{3}/3$'},
                {'id':'d','label':r'$(\sqrt{6}+\sqrt{2})/4$'},
            ]},
        },
        'answer':'a',
    }
    review_problem(tangent)
    wrong_tangent=copy.deepcopy(tangent);wrong_tangent['public']['response']['options'][0]['label']=r'$2-\sqrt{3}$'
    hypotenuse={
        'public':{
            'templateId':'triangle-law-reasoning',
            'prompt':r'In triangle ABC, $C=90^\circ$, $a=6$, and $b=8$. Use the law of cosines to find c.',
            'response':{'kind':'structured-work'},
            'figure':{'kind':'scene','scene':{'v':1,'elements':[
                {'type':'triangle','points':[[8,0],[0,6],[0,0]],'sides':[{'label':'c = ?'},{'label':'a = 6'},{'label':'b = 8'}]},
            ]}},
        },
        'answer':'[["10"]]',
    }
    review_problem(hypotenuse)
    revealed=copy.deepcopy(hypotenuse)
    revealed['public']['figure']['scene']['elements'][0]['sides'][0]['label']='c = 10'
    paired={
        'public':{
            'templateId':'nonlinear-data-model',
            'prompt':'The table gives paired measurements. Which description best matches the relationship?',
            'response':{'kind':'choice','options':[
                {'id':'l','label':'Linear: roughly equal increases for equal steps'},
                {'id':'e','label':'Exponential: roughly doubling each step'},
                {'id':'q','label':'Quadratic: falling, then rising'},
                {'id':'n','label':'No relationship'},
            ]},
            'figure':{'kind':'scene','scene':{'v':1,'elements':[
                {'type':'lineTable','rows':[]},
            ]}},
        },
        'answer':'',
    }
    for values,answer in [([4,6,9,10,13,14],'l'),([1,2,3,9,17,31],'e'),([7,4,3,4,7,12],'q')]:
        paired['public']['figure']['scene']['elements'][0]['rows']=[['x','y']]+[[str(i+1),str(y)] for i,y in enumerate(values)]
        paired['answer']=answer
        review_problem(paired)
    ambiguous=copy.deepcopy(paired)
    ambiguous['public']['figure']['scene']['elements'][0]['rows']=[['x','y']]+[[str(i+1),str(y)] for i,y in enumerate([2,1,3,7,17,33])]
    ambiguous['answer']='e'
    for mutant in [wrong_key,wrong_givens,wrong_tangent,revealed,ambiguous]:
        try:review_problem(mutant)
        except ValueError:pass
        else:raise ValueError('A mutated answer or public given escaped review')


if __name__=='__main__':
    import sys
    self_test()
    count=0
    for line in sys.stdin:
        if line.strip():
            problem=json.loads(line)
            review_problem(problem)
            count+=1
    print(f'Independent clause review: {count} cases passed')
