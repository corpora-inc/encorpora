"""Independent exact explanation and named option-cue review; no author imports."""
from collections import Counter, defaultdict
from fractions import Fraction
import copy
import json
import re
import sys
from completing_square_math_oracle import (
    IDS, read_polynomial, read_completed, require, solve_complete_square, validate_generated,
)
from polynomial_math_oracle import CHOICE_SHORTCUTS, shortcut_evidence, unique_extreme


def plus(a, b):
    result = dict(a)
    for power, value in b.items():
        result[power] = result.get(power, 0) + value
    return {power: value for power, value in result.items() if value}


def times(a, b):
    result = {}
    for i, x in a.items():
        for j, y in b.items():
            result[i+j] = result.get(i+j, 0) + x*y
    return {power: value for power, value in result.items() if value}


def constant(value):
    return {0: Fraction(value)} if value else {}


class Expression:
    """Constrained TeX polynomial evaluator using exact rational arithmetic."""
    def __init__(self, source, bindings):
        source = source.replace('\\times', '*').replace('\\left', '').replace('\\right', '').replace('−', '-')
        self.tokens = re.findall(r'\\frac|\d+|[xhck{}()+*/^\-]', source)
        require(''.join(self.tokens) == re.sub(r'\s+', '', source), 'Unsupported explanation expression')
        self.i, self.bindings = 0, bindings

    def peek(self):
        return self.tokens[self.i] if self.i < len(self.tokens) else None

    def take(self, expected=None):
        token = self.peek()
        require(token is not None and (expected is None or token == expected), 'Malformed explanation expression')
        self.i += 1
        return token

    def sum(self):
        value = self.product()
        while self.peek() in ('+', '-'):
            sign = self.take()
            right = self.product()
            value = plus(value, right if sign == '+' else times(constant(-1), right))
        return value

    def product(self):
        value = self.unary()
        while self.peek() in ('*', '/', '(', '\\frac', 'x', 'h', 'c', 'k') or (self.peek() or '').isdigit():
            operator = self.take() if self.peek() in ('*', '/') else '*'
            right = self.unary()
            if operator == '/':
                require(set(right) <= {0} and right.get(0), 'Division must have a nonzero constant denominator')
                right = constant(1/right[0])
            value = times(value, right)
        return value

    def unary(self):
        if self.peek() in ('+', '-'):
            sign = self.take()
            return times(constant(-1 if sign == '-' else 1), self.unary())
        value = self.atom()
        if self.peek() == '^':
            self.take('^')
            if self.peek() == '{':
                self.take('{'); exponent = self.take(); self.take('}')
            else:
                exponent = self.take()
            require(exponent == '2', 'Only a square is allowed in explanations')
            value = times(value, value)
        return value

    def atom(self):
        token = self.take()
        if token in ('(', '{'):
            value = self.sum(); self.take(')' if token == '(' else '}'); return value
        if token == '\\frac':
            self.take('{'); numerator = self.sum(); self.take('}')
            self.take('{'); denominator = self.sum(); self.take('}')
            require(set(denominator) <= {0} and denominator.get(0), 'Invalid TeX denominator')
            return times(numerator, constant(1/denominator[0]))
        if token == 'x':
            return {1: Fraction(1)}
        if token in self.bindings:
            return constant(self.bindings[token])
        require(token.isdigit(), 'Unbound explanation variable')
        return constant(int(token))

    def evaluate(self):
        value = self.sum()
        require(self.peek() is None, 'Trailing explanation expression')
        return value


def evaluate(source, bindings):
    return Expression(source, bindings).evaluate()


def coefficients(public):
    if public['templateId'] == 'complete-square-term':
        return read_polynomial(re.search(r'\$(x\^2[^$]*?)(?: \+ c(?: =[^$]*)?)?\$', public['prompt'])[1])
    return read_polynomial(re.search(r'\$([^$]+)\$', public['prompt'])[1])


def review_explanation(problem):
    expected = validate_generated(problem)
    public = problem['public']
    c, b, a = coefficients(public)
    h, k = b/(2*a), c-b*b/(4*a)
    bindings = {'h': h, 'k': k, 'c': expected if isinstance(expected, Fraction) else c}
    steps = problem.get('explanation')
    require(isinstance(steps, list) and len(steps) >= 4, 'Missing explicit completing-square steps')
    chains = 0
    for step in steps:
        require(isinstance(step, str), 'Malformed explanation step')
        for expression in re.findall(r'\$([^$]+)\$', step):
            if '=' not in expression:
                continue
            sides = expression.split('=')
            values = [evaluate(side, bindings) for side in sides]
            require(all(value == values[0] for value in values), f'Incorrect worked identity: {expression}')
            chains += 1
    require(chains >= (5 if public['templateId'] == 'complete-square-term' else 7), 'Missing worked equality chains')
    if public['response']['kind'] == 'choice':
        feedback = problem.get('choiceFeedback', {})
        options = public['response']['options']
        require(set(feedback) == {o['id'] for o in options if o['id'] != expected}, 'Incomplete distractor feedback')
        for option in options:
            if option['id'] == expected:
                continue
            text = feedback[option['id']]
            match = re.search(r'Expanding this choice gives \$([^$]+)\$', text)
            require(match is not None, 'Missing distractor expansion')
            vector, _ = read_completed(option['label'])
            require(read_polynomial(match[1]) == vector, 'Wrong distractor expansion')
            claim = re.search(r'Its (coefficient of \$x\$|constant) is (-?\d+); the given (?:coefficient|constant) is (-?\d+)\.', text)
            require(claim is not None, 'Missing precise distractor comparison')
            power = 1 if claim[1].startswith('coefficient') else 0
            require(Fraction(claim[2]) == vector[power] and Fraction(claim[3]) == (c,b,a)[power] and vector[power] != (c,b,a)[power], 'Incorrect distractor diagnosis')
    return chains


class CompletingSquareReview:
    def __init__(self):
        self.counts = Counter()
        self.breadth = defaultdict(Counter)
        self.shortcut_counts = defaultdict(lambda: {'cases': 0, 'applications': 0, 'correct': 0, 'chanceTwelfths': 0})
        self.chains = 0

    def record(self, problem):
        self.chains += review_explanation(problem)
        public = problem['public']; template = public['templateId']
        self.counts[template] += 1
        c,b,a = coefficients(public); h=b/(2*a); k=c-b*b/(4*a)
        breadth = self.breadth[template]
        for name, value in [('b',b),('c',c),('h',h),('k',k)]:
            breadth[f'{name}-sign-{(value>0)-(value<0)}'] += 1
            breadth[f'{name}-denominator-{value.denominator==1}'] += 1
        breadth[f'a-{a}'] += 1
        if public['response']['kind'] != 'choice':
            return
        options=public['response']['options']; expected=solve_complete_square(public)
        parsed=[read_completed(o['label']) for o in options]
        vectors=[(*x[0],Fraction(0)) for x in parsed]; parameters=[(*x[1],Fraction(0)) for x in parsed]
        predictions={f'expanded-{name}': fn(vectors) for name,fn in CHOICE_SHORTCUTS.items()}
        predictions.update({f'completed-{name}':fn(parameters) for name,fn in CHOICE_SHORTCUTS.items()})
        for name, scores in [('label-length',[len(o['label']) for o in options]),('fraction-count',[o['label'].count('\\frac') for o in options])]:
            for direction, fn in [('min',min),('max',max)]:
                predictions[f'{name}-{direction}']=unique_extreme(scores,fn)
        predictions.update({f'position-{i}':i for i in range(4)})
        for name,guess in predictions.items():
            counts=self.shortcut_counts[(template,name)]; counts['cases']+=1
            if guess is not None:
                counts['applications']+=1; counts['correct']+=options[guess]['id']==expected; counts['chanceTwelfths']+=3

    def finish(self, expected_count):
        require(type(expected_count) is int and expected_count>=256, 'Require declared corpus coverage of at least256 per family')
        require(self.counts == Counter({template:expected_count for template in IDS}), 'Missing or extra completing-square corpus cases')
        for template, breadth in self.breadth.items():
            for sign in [-1,0,1]:
                require(breadth[f'b-sign-{sign}']>0, 'Missing linear sign/zero coverage')
            require(breadth['h-denominator-False']>0 and breadth['h-denominator-True']>0, 'Missing integer/fractional shifts')
            if template!='complete-square-term':
                for name in ['c','k']:
                    for sign in [-1,1]:
                        require(breadth[f'{name}-sign-{sign}']>0, 'Missing constant/remainder sign/zero coverage')
            if template=='complete-square-nonmonic':
                require(all(breadth[f'a-{a}'] for a in [-6,-5,-4,-3,-2,-1,2,3,4,5,6]), 'Missing leading coefficients')
        shortcuts={f'{template}/{name}':shortcut_evidence(counts,f'{template}/{name}') for (template,name),counts in sorted(self.shortcut_counts.items())}
        return {'cases':dict(self.counts),'workedEqualityChains':self.chains,'namedChoiceCues':shortcuts}


def self_test():
    examples=[('(x-\\frac{3}{2})^2', {0:Fraction(9,4),1:Fraction(-3),2:Fraction(1)}),
              ('-2(x+3)^2+5',{0:Fraction(-13),1:Fraction(-12),2:Fraction(-2)}),
              ('\\frac{-3}{-6}',constant(Fraction(1,2))),('(-\\frac{1}{2})^2',constant(Fraction(1,4)))]
    for source, expected in examples:
        require(evaluate(source,{})==expected,'Independent expression fixture failed')
    for bad in ['x/0','x+y','2^3','(x+1','\\frac{1}{x}','x trailing']:
        try: evaluate(bad,{})
        except ValueError: pass
        else: raise ValueError('Malformed worked expression accepted')
    from completing_square_math_oracle import fixture
    public = fixture('complete-square-monic', 'x^2 + 2x',
                     ['$(x + 1)^2 - 1$', '$(x + 1)^2$', '$(x + 2)^2 - 4$', '$(x + 2)^2 - 3$'])
    problem = {'public': public, 'answer': 'option-a', 'explanation': [
        'Halve: $h = \\frac{2}{2} = 1$.',
        'Square: $h^2 = (1)^2 = 1$. Scale: $1 \\times 1 = 1$.',
        'Subtract: $k = 0 - 1 = -1$.',
        'Group: $x^2 + 2x = (x + 1)^2 - 1$.',
        'Check: $2 \\times 1 \\times 1 = 2$; $1 + (-1) = 0$.'],
        'choiceFeedback': {
            'option-b': 'Expanding this choice gives $x^2 + 2x + 1$. Its constant is 1; the given constant is 0.',
            'option-c': 'Expanding this choice gives $x^2 + 4x$. Its coefficient of $x$ is 4; the given coefficient is 2.',
            'option-d': 'Expanding this choice gives $x^2 + 4x + 1$. Its coefficient of $x$ is 4; the given coefficient is 2.'}}
    require(review_explanation(problem)==7,'Handwritten worked solution failed')
    mutations=[]
    for step,old,new in [(0,'= 1','= 2'),(1,'(1)^2','(-1)'),(2,'0 - 1','0 + 1'),
                          (3,'(x + 1)^2 - 1','(x - 1)^2 - 1'),(4,'= 0','= 1')]:
        bad=copy.deepcopy(problem); bad['explanation'][step]=bad['explanation'][step].replace(old,new); mutations.append(bad)
    bad=copy.deepcopy(problem); bad['explanation']=bad['explanation'][:3]; mutations.append(bad)
    bad=copy.deepcopy(problem); del bad['choiceFeedback']['option-b']; mutations.append(bad)
    bad=copy.deepcopy(problem); bad['choiceFeedback']['option-c']=bad['choiceFeedback']['option-c'].replace('4x','5x'); mutations.append(bad)
    bad=copy.deepcopy(problem); bad['choiceFeedback']['option-c']=bad['choiceFeedback']['option-c'].replace('is 4','is 5'); mutations.append(bad)
    for bad in mutations:
        try: review_explanation(bad)
        except ValueError: pass
        else: raise ValueError('Corrupt worked solution accepted')
    try: CompletingSquareReview().finish(1024)
    except ValueError: pass
    else: raise ValueError('Missing corpus accepted')
    try: shortcut_evidence({'cases':64,'applications':64,'correct':64,'chanceTwelfths':192},'synthetic leak')
    except ValueError: pass
    else: raise ValueError('Known option-only leak accepted')
    null=shortcut_evidence({'cases':64,'applications':64,'correct':16,'chanceTwelfths':192},'uniform null')
    small=shortcut_evidence({'cases':4,'applications':4,'correct':4,'chanceTwelfths':12},'small sample')
    require(null['status']=='threshold-not-exceeded' and small['status']=='insufficient-evidence','Cue evidence misclassified')
    return {'expressionFixtures':len(examples),'malformedExpressions':6,'workedFixture':1,'rejectedContentMutations':len(mutations)+2}


def review_content(data):
    import xml.etree.ElementTree as ET
    require(data.get('editions')==16,'Content review requires16 editions')
    require({t['id'] for t in data['templates']}==IDS,'Missing template registrations')
    for t in data['templates']:
        require(t['skillId']=='complete-square' and t['version']==1,'Wrong skill/version registration')
        if t['id']!='complete-square-term':
            require(t.get('requiredResponseCapability')=='single-choice-v1','Missing choice capability')
    require(all(not x['allowed'] for x in data['calculators']) and {x['id'] for x in data['calculators']}==IDS,'Calculator policy mismatch')
    require(data['skill']['id']=='complete-square' and 'quadratic-equations' in data['skill']['prerequisites'],'Missing established prerequisite')
    expected_facets={t:'complete-square.'+f for t,f in [('complete-square-term','missing-square-constant'),('complete-square-monic','monic-square-rewrite'),('complete-square-nonmonic','nonmonic-square-rewrite')]}
    require({m['templateId']:m['facetId'] for m in data['mappings']}==expected_facets and all(m['extent']=='partial' for m in data['mappings']),'Missing partial facet mapping')
    for manifest in data['bindings']:
        require(manifest['valid'] and {m['templateId']:m['facetId'] for m in manifest['entries']}==expected_facets,'Default/empty-input facet binding failed')
    seen=set(); chains=0
    for sheet in data['worksheets']:
        identity=(sheet['templateId'],sheet['edition'])
        require(identity not in seen,'Duplicate worksheet'); seen.add(identity)
        problems=sheet['problems']; require(len(problems)==12,'Worksheet must contain12 tasks')
        require(len({p['public']['prompt'] for p in problems})==12,'Repeated worksheet prompts')
        triples=[]
        for problem in problems:
            require(problem['public']['templateId']==sheet['templateId'],'Wrong worksheet family')
            chains+=review_explanation(problem); triples.append(coefficients(problem['public']))
        bs=[v[1] for v in triples]
        require(any(b<0 for b in bs) and any(b>0 for b in bs) and 0 in bs,'Missing worksheet linear sign/zero cases')
        hs=[b/(2*a) for c,b,a in triples]
        require(any(h.denominator==1 for h in hs) and any(h.denominator>1 for h in hs),'Missing integer/fractional shift cases')
        if sheet['templateId']=='complete-square-term':
            require(any(b%2 for b in bs) and any(not b%2 for b in bs),'Missing odd/even coefficients')
        else:
            ks=[c-b*b/(4*a) for c,b,a in triples]
            require(any(c==0 for c,b,a in triples),'Missing zero original constant')
            require(0 in ks and any(k<0 for k in ks) and any(k>0 for k in ks),'Missing remainder signs/zero')
            require(any(k.denominator>1 for k in ks) and any(k.denominator==1 for k in ks),'Missing exact fractional/integer remainders')
            if sheet['templateId']=='complete-square-nonmonic':
                require(any(a<0 for c,b,a in triples) and any(a>0 for c,b,a in triples),'Missing outside signs')
    require(seen=={(t,str(e)) for t in IDS for e in range(1,17)},'Incomplete worksheet editions')
    reference={
        'complete-square-term':({'h':Fraction(-5,2),'c':Fraction(25,4),'k':0},constant(Fraction(25,4))),
        'complete-square-monic':({'h':Fraction(3,2),'c':-5,'k':Fraction(-29,4)},{2:Fraction(1),1:Fraction(3),0:Fraction(-5)}),
        'complete-square-nonmonic':({'h':Fraction(-3,2),'c':1,'k':Fraction(11,2)},{2:Fraction(-2),1:Fraction(6),0:Fraction(1)}),
    }
    require({lesson['id'] for lesson in data['lessons']}==IDS,'Missing standalone lesson')
    for lesson in data['lessons']:
        bindings,answer=reference[lesson['id']]
        require(lesson['templateIds']==[lesson['id']],'Wrong standalone lesson binding')
        worked=lesson['workedExample']
        for step in worked['steps']:
            for expression in re.findall(r'\$([^$]+)\$',step):
                values=[evaluate(side,bindings) for side in expression.split('=')]
                require(all(value==values[0] for value in values),'Incorrect standalone worked identity')
                if len(values)>1: chains+=1
        require(evaluate(worked['answer'].strip('$'),bindings)==answer,'Incorrect standalone worked answer')
        prose=' '.join(p for section in lesson['sections'] for p in section['paragraphs'])
        require(all(term in prose.lower() for term in ['variable','coefficient','constant','binomial','numerator','denominator','identity']),'Missing standalone definitions')
    figures={f['kind']:ET.fromstring(f['html'].replace('<wbr>', '<wbr/>')) for f in data['figures']}
    require(set(figures)=={'complete-square-area','complete-square-balance','complete-square-scaled'},'Missing teaching illustration')
    area=figures['complete-square-area']
    rectangles={r.attrib['data-region']:tuple(Fraction(r.attrib[k]) for k in ['x','y','width','height']) for r in area.iter('rect')}
    require(rectangles=={'square':(60,70,104,104),'right':(164,70,78,104),'bottom':(60,174,104,78),'corner':(164,174,78,78)},'Area model geometry mismatch')
    require(sum(w*h for x,y,w,h in rectangles.values())==49*26*26,'Area partition does not complete49 square units')
    grid=next(area.iter('path')).attrib['d']
    require(grid=='M190 174V252 M216 174V252 M164 200H242 M164 226H242','Corner does not show nine unit squares')
    for label in area.iter('text'):
        match=re.search(r'font-size:(\d+)px',label.attrib.get('style',''))
        require(match is not None and int(match[1])>=22,'Figure label lacks explicit readable authored size')
    for kind,expected in [('complete-square-balance',[5,9,-4]),('complete-square-scaled',[1,2,5,3])]:
        rows=[r for r in figures[kind].iter('tr') if 'data-constant-row' in r.attrib]
        require(len(rows)==len(expected),'Missing constant-table rows')
        for row,answer in zip(rows,expected):
            cells=list(row)
            require(Fraction(''.join(cells[1].itertext()).replace('−','-'))==answer,'Wrong table constant label')
            expressions=[n.attrib['data-plain'].strip('$') for n in cells[0].iter() if 'data-plain' in n.attrib]
            require(len(expressions)==1 and evaluate(expressions[0],{}).get(0,0)==answer,'Table expression constant disagrees with label')
    publications=data['publications']
    require({(p['lessonId'],p['kind']) for p in publications}=={(t,k) for t in IDS for k in ['lesson','workbook','solutions']},'Missing publication consumer')
    for publication in publications:
        html=publication['article']
        require('<math' in html and 'katex-error' not in html,'Missing/invalid publication MathML')
        if publication['kind']!='lesson':
            problems=next(s['problems'] for s in data['worksheets'] if s['templateId']==publication['lessonId'] and s['edition']=='1')
            import html as html_module
            plain=[html_module.unescape(v) for v in re.findall(r'data-plain="([^"]+)"',html)]
            for problem in problems:
                for math in re.findall(r'\$[^$]+\$',problem['public']['prompt']):
                    require(math in plain,'Publication omitted or changed a worksheet prompt expression')
    return {'worksheets':len(seen),'lessons':3,'figures':3,'publicationConsumers':len(publications),'workedEqualityChains':chains}


def review_completing_square_content():
    import subprocess
    from pathlib import Path
    root=Path(__file__).resolve().parent.parent
    result=subprocess.run(['node','--import','tsx','scripts/completing-square-content-oracle.ts'],cwd=root,capture_output=True,text=True,timeout=120)
    require(result.returncode==0,'Completing-square content export failed: '+result.stderr)
    data=json.loads(result.stdout)
    report=review_content(data)
    mutations=[]
    bad=copy.deepcopy(data); bad['worksheets'][0]['problems'][1]=bad['worksheets'][0]['problems'][0]; mutations.append(bad)
    bad=copy.deepcopy(data); bad['worksheets'].pop(); mutations.append(bad)
    bad=copy.deepcopy(data); bad['lessons'][0]['workedExample']['answer']='$6$'; mutations.append(bad)
    bad=copy.deepcopy(data); bad['figures'][0]['html']=bad['figures'][0]['html'].replace('width="78"','width="79"',1); mutations.append(bad)
    bad=copy.deepcopy(data); bad['bindings'][1]['entries']=[]; mutations.append(bad)
    for bad in mutations:
        try: review_content(bad)
        except ValueError: pass
        else: raise ValueError('Corrupt content accepted')
    return report|{'rejectedContentMutations':len(mutations)}


if __name__=='__main__':
    self_test()
    review=CompletingSquareReview()
    for line in sys.stdin:
        if line.strip(): review.record(json.loads(line))
    print(json.dumps(review.finish(1024),sort_keys=True))
