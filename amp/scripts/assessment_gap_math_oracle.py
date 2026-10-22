"""Exact independent assessment-gap oracle, derived only from public wording."""
import copy
import math
import re
from fractions import Fraction as Q

SUPPORTED = frozenset({'measurement-error-bound', 'margin-of-error-interval', 'radian-arc-ratio'})
CHOICE = frozenset({'margin-of-error-interval'})
N = r'(\d+(?:\.\d+)?)'

def require(condition, message):
    if not condition:
        raise ValueError(message)

def plain(text):
    return text.replace('$', '').replace(r'\%', '%')

def solve(public):
    kind, prompt = public['templateId'], plain(public['prompt'])
    require(kind in SUPPORTED, 'Unknown assessment family')
    if kind == 'measurement-error-bound':
        m = re.fullmatch(r'An instrument reports a mass of ' + N + r' g\. The actual mass differs from the reported mass by at most ' + N + r'(% of the reported mass| g)\. What is the (greatest|smallest) possible actual mass, in grams\?', prompt)
        require(m is not None, 'Unknown measurement wording or relative-error base')
        reading, bound = Q(m[1]), Q(m[2])
        if m[3].startswith('%'): bound *= reading / 100
        require(reading > 0 and 0 <= bound <= reading, 'Invalid physical mass bounds')
        require(public['response']['kind'] in ('number', 'fraction'), 'Expected numeric mass')
        return str(reading + (bound if m[4] == 'greatest' else -bound))
    if kind == 'radian-arc-ratio':
        m = re.fullmatch(r'A circle has radius ' + N + r' cm\. Starting at A, a counterclockwise arc to B has length ' + N + r' cm and makes less than one full turn\. What is the angle swept out at the center, in radians\? Enter an exact fraction if needed\.', prompt)
        require(m is not None, 'Unknown arc wording')
        radius, arc = Q(m[1]), Q(m[2])
        require(radius > 0 and 0 < arc / radius < 2 * math.pi, 'Invalid sub-turn arc')
        require(public['response']['kind'] in ('number', 'fraction'), 'Expected numeric radians')
        return str(arc / radius)
    m = re.fullmatch(r'A random sample of (\d+) (residents|households) estimates (the percentage of residents supporting a proposed park|the mean daily water use per household in liters) as ' + N + r'(%| liters)\. A 95% confidence interval uses a margin of error of ' + N + r' (percentage points?|liters?)\. Which interval is produced by this estimate and margin of error\?', prompt)
    require(m is not None, 'Unknown confidence-interval wording')
    percentage = m[2] == 'residents'
    require((m[3].startswith('the percentage')) == percentage and (m[5] == '%') == percentage and m[7].startswith('percentage point') == percentage, 'Mismatched estimate units')
    estimate, margin = Q(m[4]), Q(m[6])
    require(int(m[1]) > 0 and margin > 0, 'Invalid sample or margin')
    expected = (estimate - margin, estimate + margin)
    require(not percentage or 0 <= expected[0] <= expected[1] <= 100, 'Invalid percentage interval')
    response = public['response']
    require(response['kind'] == 'choice', 'Expected interval choices')
    options = response['options']
    require(len(options) == 4 and len({o['id'] for o in options}) == 4, 'Expected four unique options')
    matches = []
    for option in options:
        label = re.fullmatch(r'From ' + N + re.escape(m[5]) + r' to ' + N + re.escape(m[5]) + r'\.', plain(option['label']))
        require(label is not None, 'Unknown interval choice')
        if (Q(label[1]), Q(label[2])) == expected: matches.append(option['id'])
    require(len(matches) == 1, 'Missing or ambiguous correct interval')
    return matches[0]

def review_problem(problem):
    actual = solve(problem['public'])
    public = problem['public']
    if public['templateId'] == 'radian-arc-ratio' and 'figure' in public:
        figure = public['figure']
        require(figure['kind'] == 'scene', 'Expected circle scene')
        elements = figure['scene']['elements']
        require(len(elements) == 1 and elements[0]['type'] == 'circleDiagram', 'Expected one circle diagram')
        circle = elements[0]
        points = {p['name']: p['at'] for p in circle['points']}
        require(set(points) == {'A', 'B'} and circle.get('center'), 'Expected named arc endpoints and center')
        swept = (points['B'] - points['A']) % 360 * math.pi / 180
        require(math.isclose(swept, float(Q(actual)), abs_tol=1e-10), 'Figure angle disagrees with public lengths')
        radius = re.search(r'has radius ' + N + r' cm', plain(public['prompt']))[1]
        arc = re.search(r'has length ' + N + r' cm', plain(public['prompt']))[1]
        require(circle['arcs'] == [{'from':'A', 'to':'B', 'label':arc + ' cm'}], 'Arc direction or length label mismatch')
        radii = circle['segments']
        require(any(s['from'] == 'O' and s['to'] == 'A' and s.get('label') == radius + ' cm' for s in radii), 'Radius label mismatch')
        require(not circle.get('angles'), 'Minor-angle mark can contradict the swept major arc')
    if problem['public']['templateId'] in CHOICE:
        require(actual == problem['answer'], 'Incorrect interval answer')
    else:
        require(Q(actual) == Q(problem['answer']), 'Incorrect numeric answer')
    return actual

def self_test():
    cases = []
    for error, direction, answer in [('0.25 g', 'smallest', '49/4'), ('10% of the reported mass', 'greatest', '55/4'), ('10% of the reported mass', 'smallest', '45/4')]:
        cases.append({'public': {'templateId':'measurement-error-bound', 'prompt':f'An instrument reports a mass of 12.5 g. The actual mass differs from the reported mass by at most {error}. What is the {direction} possible actual mass, in grams?', 'response':{'kind':'fraction'}}, 'answer':answer})
    for radius, arc in [(3, 2), (2, 10), (4, 12)]:
        cases.append({'public':{'templateId':'radian-arc-ratio','prompt':f'A circle has radius {radius} cm. Starting at $A$, a counterclockwise arc to $B$ has length {arc} cm and makes less than one full turn. What is the angle swept out at the center, in radians? Enter an exact fraction if needed.','response':{'kind':'fraction'}},'answer':str(Q(arc,radius))})
    for percent in [True, False]:
        unit = '%' if percent else ' liters'
        people, context = ('residents','the percentage of residents supporting a proposed park') if percent else ('households','the mean daily water use per household in liters')
        for margin in [1, 5]:
            margin_unit = ('percentage point' if percent else 'liter') + ('' if margin == 1 else 's')
            intervals = [(60-margin,60+margin),(60-margin/2,60+margin/2),(60,60+2*margin),(60-2*margin,60)]
            cases.append({'public':{'templateId':'margin-of-error-interval','prompt':f'A random sample of 400 {people} estimates {context} as 60{unit}. A 95% confidence interval uses a margin of error of {margin} {margin_unit}. Which interval is produced by this estimate and margin of error?','response':{'kind':'choice','options':[{'id':str(i),'label':f'From {lo}{unit} to {hi}{unit}.'} for i,(lo,hi) in enumerate(intervals)]}},'answer':'0'})
    cases[4]['public']['figure'] = {'kind':'scene','scene':{'elements':[{'type':'circleDiagram','center':True,'points':[{'name':'A','at':0},{'name':'B','at':5*180/math.pi}],'segments':[{'from':'O','to':'A','label':'2 cm'},{'from':'O','to':'B'}],'arcs':[{'from':'A','to':'B','label':'10 cm'}]}]}}
    rejected = 0
    def reject(case):
        nonlocal rejected
        try: review_problem(case)
        except ValueError: rejected += 1; return
        raise AssertionError('Corrupted fixture accepted')
    for case in cases:
        review_problem(case)
        bad = copy.deepcopy(case); bad['answer'] = '99'; reject(bad)
        if case['public']['templateId'] in CHOICE:
            bad = copy.deepcopy(case); bad['public']['response']['options'][1]['label'] = bad['public']['response']['options'][0]['label']; reject(bad)
            bad = copy.deepcopy(case); bad['public']['response']['options'][0]['label'] = bad['public']['response']['options'][1]['label']; reject(bad)
    bad = copy.deepcopy(cases[1]); bad['public']['prompt'] = bad['public']['prompt'].replace('of the reported mass','of the actual mass'); reject(bad)
    bad = copy.deepcopy(cases[0]); bad['public']['prompt'] = bad['public']['prompt'].replace('at most','less than'); reject(bad)
    for change in ['angle', 'direction', 'label', 'mark']:
        bad = copy.deepcopy(cases[4]); diagram = bad['public']['figure']['scene']['elements'][0]
        if change == 'angle': diagram['points'][1]['at'] = 30
        elif change == 'direction': diagram['arcs'][0]['from'] = 'B'
        elif change == 'label': diagram['segments'][0]['label'] = '3 cm'
        else: diagram['angles'] = [{'at':'O','from':'A','to':'B'}]
        reject(bad)
    return {'fixtures':len(cases),'rejectedMutations':rejected}

if __name__ == '__main__':
    print(self_test())
