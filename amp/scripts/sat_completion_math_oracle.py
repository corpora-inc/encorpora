"""Independent SAT-completion oracle using only public prompts, choices and figures.

Arithmetic uses Fractions; rational identities use polynomial cross products.
No seed, generator case model, answer key, or TypeScript author helper is used.
"""
import ast
import copy
import math
import re
from fractions import Fraction as Q

from function_toolkit_math_oracle import python_source
from rational_expression_math_oracle import add, multiply, trim, roots

SUPPORTED = frozenset({
    'sample-mean-estimate', 'probability-missing-count', 'standard-deviation-compare', 'sample-size-margin', 'compound-unit-conversion',
    'degree-radian-conversion', 'unit-circle-coordinate', 'similar-solid-volume',
    'nonlinear-formula-isolate', 'quadratic-context-model', 'exponential-time-scale',
    'symbolic-rational-exponent', 'rational-expression-operation', 'nonlinear-data-model',
    'quadratic-parameter-root', 'rational-function-representation',
})
NUMERIC = frozenset({'sample-mean-estimate', 'probability-missing-count', 'compound-unit-conversion', 'similar-solid-volume', 'quadratic-parameter-root'})
CHOICE = SUPPORTED - NUMERIC
N = r'(-?\d+(?:/\d+|\.\d+)?)'


def require(ok, message):
    if not ok:
        raise ValueError(message)


def plain(s):
    return s.replace('$', '').replace('−', '-').replace(r'\left', '').replace(r'\right', '')


def match(pattern, text):
    m = re.search(pattern, text)
    require(m is not None, 'Unrecognized public wording: ' + text)
    return m


def expr_tree(s):
    # The shared independent TeX reader handles implicit products and fractions.
    # Uppercase formula symbols and pi are converted to single bound names.
    s = plain(s).replace(r'\pi', 'p')
    s = ''.join(c.lower() if c.isupper() else c for c in s)
    return ast.parse(python_source(s), mode='eval').body


def number_expr(s, env=None):
    env = env or {}

    def read(node):
        if isinstance(node, ast.Constant) and type(node.value) in (int, float):
            return Q(str(node.value))
        if isinstance(node, ast.Name):
            require(node.id in env, 'Unbound mathematical symbol ' + node.id)
            return env[node.id]
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub)):
            v = read(node.operand)
            return -v if isinstance(node.op, ast.USub) else v
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == 'sqrt' and len(node.args) == 1:
            v = read(node.args[0]); require(v >= 0, 'Negative square root')
            if isinstance(v, Q):
                n, d = math.isqrt(v.numerator), math.isqrt(v.denominator)
                if n*n == v.numerator and d*d == v.denominator:
                    return Q(n, d)
            return math.sqrt(v)
        if isinstance(node, ast.BinOp):
            a, b = read(node.left), read(node.right)
            if isinstance(node.op, ast.Add): return a+b
            if isinstance(node.op, ast.Sub): return a-b
            if isinstance(node.op, ast.Mult): return a*b
            if isinstance(node.op, ast.Div):
                require(b != 0, 'Division by zero'); return a/b
            if isinstance(node.op, ast.Pow):
                require(-128 <= b <= 128, 'Unsupported power magnitude')
                if b == int(b): return a ** int(b)
                require(a>0 and isinstance(b,Q) and b.denominator<=12,'Fractional powers need a positive base and bounded denominator')
                return float(a) ** float(b)
        raise ValueError('Unsupported expression node ' + ast.dump(node))
    return read(expr_tree(s))


def rational_expr(s):
    """Exact numerator/denominator polynomials, coefficients ascending in x."""
    def read(node):
        if isinstance(node, ast.Constant) and type(node.value) in (int, float): return [Q(str(node.value))], [Q(1)]
        if isinstance(node, ast.Name) and node.id == 'x': return [Q(0), Q(1)], [Q(1)]
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub)):
            n,d = read(node.operand)
            return ([v*(-1 if isinstance(node.op, ast.USub) else 1) for v in n],d)
        if isinstance(node, ast.BinOp):
            if isinstance(node.op, ast.Pow):
                require(isinstance(node.right, ast.Constant) and type(node.right.value) is int and 0 <= node.right.value <= 6, 'Unsupported rational power')
                n,d = read(node.left); nn,dd = [Q(1)],[Q(1)]
                for _ in range(node.right.value): nn,dd = multiply(nn,n),multiply(dd,d)
                return nn,dd
            n,d = read(node.left); a,b = read(node.right)
            if isinstance(node.op, ast.Add): return add(multiply(n,b),multiply(a,d)),multiply(d,b)
            if isinstance(node.op, ast.Sub): return add(multiply(n,b),multiply(a,d),-1),multiply(d,b)
            if isinstance(node.op, ast.Mult): return multiply(n,a),multiply(d,b)
            if isinstance(node.op, ast.Div):
                require(a != [0], 'Zero denominator polynomial'); return multiply(n,b),multiply(d,a)
        raise ValueError('Unsupported rational expression')
    return read(expr_tree(s))


def equal_rational(a,b):
    return trim(multiply(a[0],b[1])) == trim(multiply(b[0],a[1]))


def close(a,b):
    return math.isclose(float(a),float(b),rel_tol=1e-10,abs_tol=1e-10)


def same_value(a,b):
    if isinstance(a, tuple): return len(a)==len(b) and all(close(x,y) for x,y in zip(a,b))
    if isinstance(a, (Q,int,float)): return close(a,b)
    return a == b


def only(public, key, target, same=same_value):
    response = public['response']; require(response['kind']=='choice', 'Expected choices')
    options = response['options']
    require(len(options)==4 and len({o['id'] for o in options})==4, 'Expected four unique option identifiers')
    keys = [key(plain(o['label'])) for o in options]
    require(all(not same(a,b) for i,a in enumerate(keys) for b in keys[i+1:]), 'Semantically duplicate choices')
    matches = [o['id'] for o,k in zip(options,keys) if same(k,target)]
    require(len(matches)==1, 'Expected exactly one correct choice')
    return matches[0]


def scene_elements(public, kind):
    figure = public.get('figure'); require(figure and figure['kind']=='scene', 'Expected public scene')
    result = [e for e in figure['scene']['elements'] if e['type']==kind]
    require(len(result)==1, 'Expected one '+kind+' figure')
    return result[0]


def table_rows(public):
    figure = public.get('figure'); require(figure and figure['kind']=='scene','Expected rational table scene')
    tables = [e for e in figure['scene']['elements'] if e['type'] in ('lineTable','table')]
    require(len(tables)==1,'Expected one public function table')
    table=tables[0]
    cell=lambda c: plain(str(c if isinstance(c,(str,int,float)) else c['text']))
    rows=[[cell(c) for c in (row['cells'] if isinstance(row,dict) else row)] for row in table['rows']]
    if table.get('header') == 'row': rows=rows[1:]
    require(len(rows)==4 and all(len(row)==2 for row in rows),'Expected four rational input-output rows')
    return [(number_expr(x),number_expr(y)) for x,y in rows]


def solve(public):
    kind = public['templateId']; require(kind in SUPPORTED, 'Unknown SAT family')
    p = plain(public['prompt'])
    if kind == 'sample-mean-estimate':
        m=match(r'A simple random sample of (\d+) plants from a population of (\d+) plants has mean height '+N+r' centimeters',p)
        n,population,mean=int(m[1]),int(m[2]),Q(m[3])
        require(0<n<=population and mean>0,'Valid random sample and positive plant heights required')
        require('sample-based estimate' in p,'Population value must be described as an estimate')
        if 'sum of all plant heights' in p: return str(population*mean)
        require('population mean height' in p,'Unknown population quantity')
        return str(mean)
    if kind == 'probability-missing-count':
        require('only red and blue counters' in p and 'uniformly at random' in p,'Two exhaustive equally likely counter colors required')
        blue=Q(match(r'contains '+N+r' blue counters',p)[1])
        probability=Q(match(r'probability that it is red is '+N+r'\.',p)[1])
        require(blue>0 and 0<probability<1,'Positive complement and nontrivial probability required')
        count=blue*probability/(1-probability)
        require(count.denominator==1,'Counter count must be a whole number')
        return str(count)
    if kind == 'standard-deviation-compare':
        m = match(r'Data set A is ([\d, -]+)\. Data set B is ([\d, -]+)\.',p)
        sets = [[Q(x.strip()) for x in group.split(',')] for group in (m[1],m[2])]
        def variance(xs):
            mean = sum(xs,Q(0))/len(xs)
            return sum(((x-mean)**2 for x in xs),Q(0))/len(xs)
        va,vb = map(variance,sets)
        target = 'The standard deviations are equal.' if va==vb else 'Data set '+('A' if va>vb else 'B')+' has the larger standard deviation.'
        known = {'The standard deviations are equal.','Data set A has the larger standard deviation.','Data set B has the larger standard deviation.','Standard deviation cannot be compared unless the means are equal.'}
        def identity(s): require(s in known,'Unknown spread comparison'); return s
        return only(public,identity,target)
    if kind == 'sample-size-margin':
        m = match(r'Survey A samples (\d+) people; survey B samples (\d+) people',p)
        require(all(w in p for w in ['simple random samples','same large population','confidence level','comparable sample proportions']), 'Missing comparability assumptions')
        a,b = map(int,m.groups()); require(a>0 and b>0 and a!=b,'Unequal positive samples required')
        return only(public,lambda s:s,'Survey '+('A' if a>b else 'B')+' generally has a smaller margin of error.')
    if kind == 'compound-unit-conversion':
        if 'kilometers per hour' in p:
            v = Q(match(N+r' kilometers per hour',p)[1]); return str(v*1000/3600)
        if 'square meters' in p:
            v = Q(match(r'area '+N+r' square meters',p)[1]); return str(v*100**2)
        if 'cubic meters' in p:
            v = Q(match(r'holds '+N+r' cubic meters',p)[1]); return str(v*100**3)
        if 'density' in p:
            v = Q(match(r'density '+N+r' grams per cubic centimeter',p)[1]); return str(v*100**3/1000)
        watts = Q(match(r'power of '+N+r' watts',p)[1]); minutes = Q(match(r'for '+N+r' minutes',p)[1])
        return str(watts/1000*minutes/60)
    if kind == 'degree-radian-conversion':
        if 'radians. What is its measure in degrees' in p:
            rad = match(r'measures (.+) radians\.',p)[1]
            degree = number_expr(rad,{'p':Q(180)})
            return only(public,number_expr,degree)
        degree = Q(match(r'measures '+N+r' degrees',p)[1])
        # Values are compared as multiples of pi, keeping plain numeric distractors distinct.
        def coefficient(s):
            if r'\pi' not in s: return ('constant',number_expr(s))
            return ('pi',number_expr(s,{'p':Q(1)}))
        return only(public,coefficient,('pi',degree/180),same=lambda a,b:a==b)
    if kind == 'unit-circle-coordinate':
        degree = int(match(r'angle of (\d+) degrees',p)[1])
        target = math.sin(math.radians(degree)) if 'the y-coordinate' in p else math.cos(math.radians(degree))
        return only(public,number_expr,target)
    if kind == 'similar-solid-volume':
        if 'The smaller has volume' in p:
            small = Q(match(r'smaller has volume '+N,p)[1]); large = Q(match(r'larger has volume '+N,p)[1]); edge = Q(match(r'edge of '+N+r' cm',p)[1])
            ratio = large/small; scale = round(float(ratio)**(1/3)); require(Q(scale)**3==ratio, 'Expected exact cubed scale')
            return str(edge*scale)
        m = match(r'edges measure '+N+r' cm and '+N+r' cm',p); a,b = Q(m[1]),Q(m[2])
        volume = Q(match(r'has volume '+N+r' cubic centimeters',p)[1]); require(0<a<b,'Increasing corresponding lengths required')
        return str(volume*(b/a)**3)
    if kind == 'nonlinear-formula-isolate':
        # Positive assignments are deliberately varied, including nonunit height/mass.
        envs = [{'a':Q(12),'v':Q(54),'h':Q(3),'e':Q(18),'m':Q(4),'p':math.pi},
                {'a':Q(25),'v':Q(44),'h':Q(7),'e':Q(50),'m':Q(8),'p':math.pi},
                {'a':Q(7),'v':Q(11),'h':Q(2),'e':Q(9),'m':Q(3),'p':math.pi}]
        if 'cylinder' in p:
            require(r'V=\pi r^2h' in p and all(s in p for s in ['V>0','h>0','r>0']), 'Positive cylinder model required')
            target = tuple(math.sqrt(e['v']/(e['p']*e['h'])) for e in envs)
        elif 'circle' in p:
            require(r'A=\pi r^2' in p and all(s in p for s in ['A>0','r>0']), 'Positive circle model required')
            target = tuple(math.sqrt(e['a']/e['p']) for e in envs)
        else:
            require('E=mv^2/2' in p and all(s in p for s in ['E>0','m>0','v>0']), 'Positive kinetic-energy model required')
            target = tuple(math.sqrt(2*e['e']/e['m']) for e in envs)
        return only(public,lambda s:tuple(number_expr(s,e) for e in envs),target)
    if kind == 'quadratic-context-model':
        if 'perimeter' in p:
            perimeter = Q(match(r'perimeter '+N+r' meters',p)[1])
            target = rational_expr(f'x*({perimeter/2}-x)')
            return only(public,rational_expr,target,same=equal_rational)
        if "ball's height" in p:
            factored=re.search(r'h\(t\)='+N+r'\('+N+r'-t\)\(t\+'+N+r'\)',p)
            if factored:
                a,end,offset=map(Q,factored.groups())
                require(a>0 and end>0 and offset>0 and r't\ge0' in p,'Positive coefficients and nonnegative time required')
                if 'first reach the ground' in p: return only(public,number_expr,end)
                require('initial height' in p,'Unknown quadratic context quantity')
                return only(public,number_expr,a*end*offset)
            m = match(r'h\(t\)='+N+r't\('+N+r'-t\)',p); a,end = Q(m[1]),Q(m[2])
            require(a>0 and end>0,'Downward quadratic with positive duration required')
            return only(public,number_expr,a*(end/2)**2)
        m = match(r'x\+'+N+r' meters long\. Its area is '+N,p); offset,area = Q(m[1]),Q(m[2])
        d = offset**2+4*area; root = math.isqrt(d.numerator)
        require(d.denominator==1 and root*root==d,'Expected exact positive area root')
        return only(public,number_expr,(-offset+root)/2)
    if kind == 'exponential-time-scale':
        m = match(r'P\(t\)='+N+r'\('+N+r'\)\^\{t/(\d+)\}',p); start,factor,period = Q(m[1]),Q(m[2]),int(m[3])
        require(start>0 and factor>0 and factor!=1 and period>1,'Nontrivial positive exponential model required')
        if 'Which expression is an equivalent model?' in p:
            times=[Q(0),Q(1),Q(period),Q(2*period)]
            target=tuple(float(start)*float(factor)**float(t/period) for t in times)
            def model_values(s):
                rhs=match(r'^P\(t\)=(.+)$',s)[1]
                return tuple(number_expr(rhs,{'t':t}) for t in times)
            return only(public,model_values,target)

        def statement(s):
            if m2 := re.fullmatch(r'Every (\d+) years, the population is multiplied by '+N+r'\.',s):
                return ('factor',int(m2[1]),Q(m2[2]))
            if m2 := re.fullmatch(r'Every year, the population is multiplied by '+N+r'\.',s): return ('factor',1,Q(m2[1]))
            if m2 := re.fullmatch(r'Every (\d+) years, the population changes by '+N+r' individuals\.',s): return ('addition',int(m2[1]),Q(m2[2]))
            if m2 := re.fullmatch(r'The initial population is '+N+r'\.',s): return ('initial',Q(m2[1]))
            raise ValueError('Unknown exponential interpretation')
        return only(public,statement,('factor',period,factor),same=lambda a,b:a==b)
    if kind == 'symbolic-rational-exponent':
        m = match(r'equivalent to (1/)?\\sqrt\[(\d+)\]\{x\^\{(\d+)\}\}',p)
        exponent = Q(int(m[3]),int(m[2]))*(-1 if m[1] else 1)
        def power(s): return Q(match(r'^x\^\{(-?\d+(?:/\d+)?)\}$',s)[1])
        return only(public,power,exponent)
    if kind == 'rational-expression-operation':
        expression = match(r'equals (.+) for all allowed inputs\?',p)[1]
        excluded = match(r'x\\ne-(\d+)',p)
        require(r'x\ne0' in p,'Original restrictions must be stated')
        original = rational_expr(expression)
        require(roots(original[1]) == {Q(0),-Q(excluded[1])},'Restrictions disagree with original denominator roots')
        return only(public,rational_expr,original,same=equal_rational)
    if kind == 'nonlinear-data-model':
        g = scene_elements(public,'graph')
        points = g.get('scatter',{}).get('points') or [item.get('at',[item.get('x'),item.get('y')]) for item in g.get('points',[])]
        require(len(points)==4 and len({x for x,_ in points})==4,'Expected four distinct observed inputs')
        points = [(Q(str(x)),Q(str(y))) for x,y in points]
        def model(s):
            eq = match(r'^y=(.+)$',s)[1]
            return tuple(number_expr(eq,{'x':x}) for x,_ in points)
        response = public['response']; options = response['options']
        require(response['kind']=='choice' and len(options)==4 and len({o['id'] for o in options})==4,'Expected four model choices')
        values = [model(plain(o['label'])) for o in options]
        require(len(set(values))==4,'Duplicate model predictions')
        errors = [sum(((y-v)**2 for (_,y),v in zip(points,vs)),Q(0)) for vs in values]
        minimum = min(errors); require(errors.count(minimum)==1,'Ambiguous model fit')
        # Figure note is an alternate textual presentation of the same observations.
        note = public['figure']['scene'].get('note','')
        if 'Observed input-output pairs:' in note:
            stated = [(Q(x),Q(y)) for x,y in re.findall(r'\((-?\d+),\s*(-?\d+)\)',note)]
            require(stated==points,'Figure note disagrees with plotted observations')
        return options[errors.index(minimum)]['id']
    if kind == 'quadratic-parameter-root':
        m = match(r'(-?\d+)x\^2([+-]\d+|\+\(-?\d+\))x\+c=0',p)
        a,b = Q(m[1]),Q(m[2].replace('(','').replace(')','').removeprefix('+')); require(a!=0,'Not quadratic')
        return str(b*b/(4*a))
    if kind == 'rational-function-representation':
        if 'graphed function' in p:
            g=scene_elements(public,'graph'); curves=g.get('curves',[])
            require(len(curves)==1 and curves[0]['fn']['f']=='rational','Expected one rational curve')
            fn=curves[0]['fn']; n,d=[Q(str(v)) for v in fn['num']],[Q(str(v)) for v in fn['den']]
            require(d!=[0] and len(d)==2,'Nonzero linear rational denominator required')
            def poly(cs,x): return sum((v*x**i for i,v in enumerate(cs)),Q(0))
            points=[(Q(str(q['x'])),Q(str(q['y']))) for q in g.get('points',[])]
            require(len(points)==2 and len(set(x for x,_ in points))==2,'Two distinct marked points required')
            require(all(poly(d,x)!=0 and poly(n,x)/poly(d,x)==y for x,y in points),'Marked points contradict rational curve')
            note=public['figure']['scene'].get('note','')
            stated=[(Q(x),Q(y)) for x,y in re.findall(r'\((-?\d+),\s*(-?\d+)\)',note)]
            require(stated==points,'Text alternatives disagree with marked graph points')
            if m:=re.search(r'no point at input (-?\d+)',note): require(poly(d,Q(m[1]))==0,'Excluded graph input is not a denominator zero')
            def expression(s): return rational_expr(match(r'^f\(x\)=(.+)$',s)[1])
            return only(public,expression,(n,d),same=equal_rational)
        rows = table_rows(public)
        require(len({x for x,_ in rows})==4,'Repeated function inputs')
        if 'For which input' in p:
            m = match(r'f\(x\)=\\frac\{'+N+r'\}\{x-'+N+r'\}\+'+N,p); a,h,k = map(Q,m.groups())
            output = Q(match(r'f\(x\)='+N+r'\?',p)[1]); require(output!=k,'No finite input produces vertical shift')
            require(all(x!=h and a/(x-h)+k==y for x,y in rows),'Table contradicts stated rational function')
            return only(public,number_expr,h+a/(output-k))
        def signature(s):
            rule = match(r'^f\(x\)=(.+)$',s)[1]
            values=[]
            for x,_ in rows:
                try: values.append(number_expr(rule,{'x':x}))
                except ValueError: values.append(None)
            return tuple(values)
        # Undefined distractor values cannot match a numeric table.
        def equal(a,b): return len(a)==len(b) and all(x==y for x,y in zip(a,b))
        return only(public,signature,tuple(y for _,y in rows),same=equal)
    raise ValueError('Unimplemented SAT family')


def review_problem(problem):
    public = problem['public']; actual = solve(public)
    if public['templateId'] in NUMERIC:
        require(public['response']['kind'] in ('number','fraction'),'Expected numeric response')
        require(Q(actual)==Q(problem['answer']),'Incorrect numeric SAT answer')
    else:
        require(actual==problem['answer'],'Incorrect SAT choice answer')
    return actual


def self_test():
    def item(kind,prompt,labels=None,answer='a',figure=None):
        public={'templateId':kind,'prompt':prompt,'response':{'kind':'number'} if labels is None else {'kind':'choice','options':[{'id':chr(97+i),'label':label} for i,label in enumerate(labels)]}}
        if figure: public['figure']={'kind':'scene','scene':figure}
        return {'public':public,'answer':answer}
    table={'elements':[{'type':'lineTable','header':'row','rows':[['Input','Output'],['0','0'],['1','-3'],['3','9'],['4','6']]}]}
    cases=[
        item('standard-deviation-compare','Data set A is 1, 2, 3. Data set B is 5, 6, 7. Which statement compares their standard deviations?', ['The standard deviations are equal.','Data set B has the larger standard deviation.','Data set A has the larger standard deviation.','Standard deviation cannot be compared unless the means are equal.']),
        item('sample-size-margin','Two surveys use independent simple random samples from the same large population, the same question and confidence level, and comparable sample proportions. Survey A samples 200 people; survey B samples 800 people. Which statement is justified?', ['Survey B generally has a smaller margin of error.','Survey A generally has a smaller margin of error.','Both margins of error must be identical.','Survey B is guaranteed to have an estimate equal to the population proportion.']),
        item('compound-unit-conversion','A vehicle travels at 72 kilometers per hour. Given 1 kilometer = 1000 meters and 1 hour = 3600 seconds, what is its speed in meters per second?',answer='20'),
        item('compound-unit-conversion','A panel has area 3 square meters. Given 1 meter = 100 centimeters, what is its area in square centimeters?',answer='30000'),
        item('compound-unit-conversion','A container holds 2 cubic meters. Given 1 meter = 100 centimeters, what is this volume in cubic centimeters?',answer='2000000'),
        item('compound-unit-conversion','A material has density 4 grams per cubic centimeter. Given 1 kilogram = 1000 grams and 1 cubic meter = 1000000 cubic centimeters, what is its density in kilograms per cubic meter?',answer='4000'),
        item('compound-unit-conversion','A device uses constant power of 750 watts for 30 minutes. Given 1000 watts = 1 kilowatt and 60 minutes = 1 hour, how many kilowatt-hours of energy does it use?',answer='3/8'),
        item('degree-radian-conversion',r'An angle measures 45 degrees. Which expression gives its measure in radians?', [r'$(1/4)\pi$',r'$(1/8)\pi$',r'$(1/2)\pi$','$45$']),
        item('degree-radian-conversion',r'An angle measures $(3/4)\pi$ radians. What is its measure in degrees?', ['$135$','$270$','$90$','$45$']),
        item('unit-circle-coordinate',r'On the unit circle centered at the origin, an angle of 120 degrees is measured counterclockwise from the positive $x$-axis. What is the $x$-coordinate of its endpoint?', ['$-1/2$','$1/2$',r'$\sqrt{3}/2$',r'$-\sqrt{3}/2$']),
        item('similar-solid-volume','Two solids are similar. Corresponding edges measure 2 cm and 6 cm. The smaller solid has volume 10 cubic centimeters. What is the larger solid\'s volume, in cubic centimeters?',answer='270'),
        item('similar-solid-volume','Two solids are similar. The smaller has volume 10 cubic centimeters and a corresponding edge of 2 cm. The larger has volume 270 cubic centimeters. How long is the corresponding edge of the larger solid, in centimeters?',answer='6'),
        item('nonlinear-formula-isolate',r'A cylinder has volume $V=\pi r^2h$, where $V>0$, $h>0$, and $r>0$. Which expression gives its radius?', [r'$\sqrt{V/(\pi h)}$',r'$V/(\pi h)$',r'$\sqrt{Vh/\pi}$',r'$\sqrt{V/\pi}/h$']),
        item('quadratic-context-model',r'A rectangle has perimeter 40 meters. Its width is $x$ meters. Which expression gives its area in square meters?', ['$x(20-x)$','$x(40-x)$','$2x(20-x)$','$x(20+x)$']),
        item('quadratic-context-model',r"A ball's height in meters after $t$ seconds is $h(t)=2t(10-t)$ for $0\le t\le 10$. What is its maximum height, in meters?", ['$50$','$20$','$200$','$5$']),
        item('quadratic-context-model',r'A rectangle is $x$ meters wide and $x+3$ meters long. Its area is 40 square meters. What is its width, in meters?', ['$5$','$8$','$-8$','$-5$']),
        item('exponential-time-scale',r'A population is modeled by $P(t)=80(1/2)^{t/3}$, where $t$ is in years. Which statement describes the model?', ['Every 3 years, the population is multiplied by 1/2.','Every year, the population is multiplied by 1/2.','Every 3 years, the population changes by 2 individuals.','The initial population is 160.']),
        item('symbolic-rational-exponent',r'For $x>0$, which expression is equivalent to $1/\sqrt[3]{x^{2}}$?', ['$x^{-2/3}$','$x^{3/2}$','$x^{6}$','$x^{2/3}$']),
        item('rational-expression-operation',r'Which expression equals $\frac{2}{x}+\frac{3}{x+1}$ for all allowed inputs? Retain the restrictions $x\ne0$ and $x\ne-1$.', [r'$\frac{5x+2}{x(x+1)}$',r'$\frac{5x+2}{2x+1}$',r'$\frac{5x+2}{x}$',r'$\frac{5}{x(x+1)}$']),
        item('nonlinear-data-model','Four observations are plotted. Which model has the smallest sum of squared residuals for these observations? A residual is observed output minus predicted output.', ['$y=2x^2+3$','$y=2(3)^x$','$y=6x+3$','$y=21$'],figure={'elements':[{'type':'graph','points':[{'at':[0,4]},{'at':[1,4]},{'at':[2,12]},{'at':[3,20]}]}],'note':'Observed input-output pairs: (0, 4), (1, 4), (2, 12), (3, 20).'}),
        item('quadratic-parameter-root',r'For which value of $c$ does $2x^2+(-12)x+c=0$ have exactly one distinct real solution?',answer='18'),
        item('rational-function-representation','The table shows values of one of these functions. Which rule matches every row?', [r'$f(x)=\frac{6}{x-2}+3$',r'$f(x)=\frac{6}{x+2}+3$',r'$f(x)=\frac{6}{x-2}-3$','$f(x)=6(x-2)+3$'],figure=table),
        item('rational-function-representation',r'The function is $f(x)=\frac{6}{x-2}+3$, with $x\ne2$. For which input is $f(x)=5$?', ['$5$','$2$','$7$','$-5$'],figure=table),
    ]
    cases.append(item('exponential-time-scale',r'A population is modeled by $P(t)=80(1/2)^{t/3}$, where $t$ is in years. Which expression is an equivalent model?', [r'$P(t)=80\left((1/2)^{1/3}\right)^t$',r'$P(t)=80(1/2)^t$',r'$P(t)=80(1/2)^{3t}$',r'$P(t)=80+(1/2)^{t/3}$']))
    cases.append(item('probability-missing-count','A bag contains only red and blue counters. It contains 6 blue counters. One counter is selected uniformly at random. The probability that it is red is 2/5. How many red counters are in the bag?',answer='4'))
    cases.append(item('sample-mean-estimate','A simple random sample of 50 plants from a population of 2000 plants has mean height 25 centimeters. What is the sample-based estimate of the population mean height, in centimeters?',answer='25'))
    cases.append(item('sample-mean-estimate','A simple random sample of 50 plants from a population of 2000 plants has mean height 25 centimeters. What is the sample-based estimate of the sum of all plant heights, in centimeters?',answer='50000'))
    cases.append(item('quadratic-context-model',r"A ball's height in meters at time $t$ seconds is $h(t)=2(8-t)(t+10)$ for $t\ge0$. After how many seconds does it first reach the ground?",['$8$','$-10$','$4$','$9$']))
    cases.append(item('quadratic-context-model',r"A ball's height in meters at time $t$ seconds is $h(t)=2(8-t)(t+10)$ for $t\ge0$. What is its initial height, in meters?",['$160$','$8$','$0$','$161$']))
    cases.append(item('rational-function-representation','Which rule matches the graphed function and its marked points?', [r'$f(x)=\frac{4}{x-2}+4$',r'$f(x)=\frac{4}{x+2}+4$',r'$f(x)=\frac{4}{x-2}-4$','$f(x)=4(x-2)+4$'],figure={'elements':[{'type':'graph','curves':[{'fn':{'f':'rational','num':[-4,4],'den':[-2,1]}}],'points':[{'x':1,'y':0},{'x':3,'y':8}]}],'note':'Marked input-output pairs include (1, 0) and (3, 8). The graph has no point at input 2.'}))
    cases.append(item('degree-radian-conversion',r'An angle measures $\frac{3\pi}{4}$ radians. What is its measure in degrees?', ['$135$','$270$','$90$','$45$']))
    cases.append(item('degree-radian-conversion',r'An angle measures 180 degrees. Which expression gives its measure in radians?', [r'$\pi$',r'$\frac{\pi}{2}$',r'$2\pi$','$180$']))
    cases.append(item('quadratic-parameter-root',r'For which value of $c$ does $2x^2-12x+c=0$ have exactly one distinct real solution?',answer='18'))
    cases.append(item('quadratic-parameter-root',r'For which value of $c$ does $2x^2+12x+c=0$ have exactly one distinct real solution?',answer='18'))
    count=0
    def reject(bad):
        nonlocal count
        try: review_problem(bad)
        except (ValueError,ZeroDivisionError): count+=1; return
        raise AssertionError('Corrupted SAT fixture accepted')
    for case in cases:
        review_problem(case)
        bad=copy.deepcopy(case); bad['answer']='999'; reject(bad)
        if case['public']['templateId'] in CHOICE:
            bad=copy.deepcopy(case); bad['public']['response']['options'][1]['label']=bad['public']['response']['options'][0]['label']; reject(bad)
            bad=copy.deepcopy(case); bad['public']['response']['options'][0]['label']=bad['public']['response']['options'][1]['label']; reject(bad)
    bad=copy.deepcopy(cases[22]); bad['public']['figure']['scene']['elements'][0]['rows'][2][1]='999'; reject(bad)
    bad=copy.deepcopy(cases[19]); bad['public']['figure']['scene']['elements'][0]['points'][0]['at'][1]=99; reject(bad)
    bad=copy.deepcopy(cases[12]); bad['public']['prompt']=bad['public']['prompt'].replace('r>0','r<0'); reject(bad)
    bad=copy.deepcopy(cases[18]); bad['public']['prompt']=bad['public']['prompt'].replace(r'x\ne-1',r'x\ne-3'); reject(bad)
    bad=copy.deepcopy(cases[12]); bad['public']['prompt']=bad['public']['prompt'].replace('r^2','r^3'); reject(bad)
    # Numeric grading must accept equivalent rational spellings.
    equivalent=copy.deepcopy(cases[24]); equivalent['answer']='8/2'; review_problem(equivalent)
    bad=copy.deepcopy(cases[29]); bad['public']['figure']['scene']['elements'][0]['curves'][0]['fn']['num'][0]=5; reject(bad)
    bad=copy.deepcopy(cases[29]); bad['public']['figure']['scene']['elements'][0]['points'][0]['y']=2; reject(bad)
    require(set(c['public']['templateId'] for c in cases)==SUPPORTED,'Missing family fixture')
    return {'fixtures':len(cases),'rejectedMutations':count}

# Read by independent-math-review.py (FamilyOracle).
CHOICE_REVIEW = CHOICE



if __name__ == '__main__':
    print(self_test())
