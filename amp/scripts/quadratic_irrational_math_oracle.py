"""Exact public-equation oracle; no generator model or private tags are used."""
import copy
import math
import re
from fractions import Fraction as F

SUPPORTED = frozenset({'quadratic-irrational-solutions'})

def require(ok, message):
    if not ok:
        raise ValueError(message)

def clean(text):
    return text.replace('−', '-').replace(' ', '').replace('\\left', '').replace('\\right', '')

def coefficients(prompt):
    match = re.fullmatch(r'Solve \$(.+) = 0\$\. Choose the complete set of real solutions in exact simplified radical form\.', prompt)
    require(match is not None, 'Unexpected quadratic prompt')
    text = clean(match[1])
    tokens = re.findall(r'[+-]?[^+-]+', text)
    require(''.join(tokens) == text, 'Invalid polynomial')
    result = [0, 0, 0]
    powers = set()
    for token in tokens:
        term = re.fullmatch(r'([+-]?)(\d*)(x\^2|x)?', token)
        require(term is not None and (term[2] or term[3]), 'Invalid polynomial term')
        power = 2 if term[3] == 'x^2' else 1 if term[3] else 0
        require(power not in powers, 'Uncombined polynomial terms')
        powers.add(power)
        result[power] = (-1 if term[1] == '-' else 1) * int(term[2] or '1')
    c,b,a = result
    require(a != 0, 'Not a quadratic')
    disc = b*b - 4*a*c
    require(disc > 0 and math.isqrt(disc)**2 != disc, 'Expected two irrational real roots')
    # A root pair is uniquely determined by its center and squared half-distance.
    return F(-b,2*a), F(disc,4*a*a)

def pair(label):
    text = clean(label)
    require(text.startswith('$x=') and text.endswith('$'), 'Unexpected root label')
    text = text[3:-1]
    d = 1
    if text.startswith('\\frac'):
        match = re.fullmatch(r'\\frac\{(.+)\}\{([1-9]\d*)\}', text)
        require(match is not None, 'Invalid positive denominator')
        text,d = match[1],int(match[2])
        require(d != 1, 'Denominator one must be omitted')
    match = re.fullmatch(r'(-?\d+)\\pm(\d*)\\sqrt\{([1-9]\d*)\}', text)
    require(match is not None, 'Expected complete plus/minus root pair')
    p,q,s = int(match[1]),int(match[2] or '1'),int(match[3])
    require(q > 0 and match[2] != '1', 'Radical coefficient must be positive with one omitted')
    require(s > 1 and all(s % (k*k) for k in range(2,math.isqrt(s)+1)), 'Radicand must be squarefree and greater than one')
    require(math.gcd(math.gcd(abs(p),q),d) == 1, 'Root expression not reduced')
    return F(p,d), F(q*q*s,d*d)

def solve(public):
    require(public['templateId'] in SUPPORTED, 'Unknown family')
    target = coefficients(public['prompt'])
    require(public['response']['kind'] == 'choice', 'Expected choices')
    options = public['response']['options']
    require(len(options) == 4 and len({o['id'] for o in options}) == 4, 'Expected four distinct option IDs')
    values = [pair(o['label']) for o in options]
    require(len(set(values)) == len(values), 'Semantically duplicate root pairs')
    correct = [o['id'] for o,value in zip(options,values) if value == target]
    require(len(correct) == 1, 'Expected exactly one correct complete root pair')
    return correct[0]

def review_problem(problem):
    answer = solve(problem['public'])
    require(problem['answer'] == answer, 'Incorrect stored answer')
    return answer

def self_test():
    cases = [
        ('2x^2 + 4x - 3', r'\frac{-2 \pm \sqrt{10}}{2}'),
        ('-2x^2 - 4x + 3', r'\frac{-2 \pm \sqrt{10}}{2}'),
        ('x^2 - 2x - 1', r'1 \pm \sqrt{2}'),
        ('3x^2 - 6x - 3', r'1 \pm \sqrt{2}'),
        ('x^2 + 6x - 3', r'-3 \pm 2\sqrt{3}'),
        ('6x^2 + 6x - 3', r'\frac{-1 \pm \sqrt{3}}{2}'),
        ('2x^2 - 4x + 1', r'\frac{2 \pm \sqrt{2}}{2}'),
    ]
    rejected = 0
    def reject(p):
        nonlocal rejected
        try: review_problem(p)
        except (ValueError,KeyError): rejected += 1; return
        raise AssertionError('Accepted corrupt fixture')
    for polynomial,correct in cases:
        p = {'public': {'templateId':next(iter(SUPPORTED)), 'prompt':f'Solve ${polynomial} = 0$. Choose the complete set of real solutions in exact simplified radical form.', 'response':{'kind':'choice','options':[{'id':str(i),'label':f'$x = {v}$'} for i,v in enumerate([correct,r'17 \pm \sqrt{2}',r'-19 \pm \sqrt{3}',r'23 \pm \sqrt{5}'])]}}, 'answer':'0'}
        review_problem(p)
        bad=copy.deepcopy(p);bad['answer']='1';reject(bad)
        bad=copy.deepcopy(p);bad['public']['response']['options'][1]['label']=bad['public']['response']['options'][0]['label'];reject(bad)
        bad=copy.deepcopy(p);bad['public']['response']['options'][0]['label']=r'$x = 31 \pm \sqrt{7}$';reject(bad)
        bad=copy.deepcopy(p);bad['public']['prompt']=p['public']['prompt'].replace(polynomial,'x^2 + 1');reject(bad)
    base=copy.deepcopy(p)
    for invalid in [r'\frac{2 \pm \sqrt{2}}{-2}',r'\frac{4 \pm 2\sqrt{2}}{4}',r'2 \pm \sqrt{8}',r'2 + \sqrt{2}',r'2 \pm 1\sqrt{2}',r'2 \pm 0\sqrt{2}']:
        bad=copy.deepcopy(base);bad['public']['response']['options'][0]['label']=f'$x = {invalid}$';reject(bad)
    return {'fixtures':len(cases),'rejectedMutations':rejected}

if __name__ == '__main__':
    print(self_test())
