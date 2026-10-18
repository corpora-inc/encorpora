"""Independent prompt-only exact descriptive-statistics checks."""
import re
import ast
import copy
import json
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path
from fractions import Fraction

DESCRIPTIVE_STATISTICS = frozenset({'median-data', 'range-data', 'interquartile-range-data'})
IQR_RULE = (' Order the values; when there is an odd number of values, exclude the overall '
            'median from both halves. Each quartile is the median of its half.')
NAMES = {'median-data': 'median', 'range-data': 'range', 'interquartile-range-data': 'interquartile range'}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def median(ordered):
    size = len(ordered)
    require(size > 0, 'Median of an empty group is undefined')
    return (ordered[(size-1)//2] + ordered[size//2]) / 2


def solve_descriptive_statistics(public):
    template = public['templateId']
    require(template in DESCRIPTIVE_STATISTICS, 'Unknown descriptive-statistics task')
    require(public['response']['kind'] == 'fraction', 'Exact decimal/fraction response required')
    require(public.get('figure') is None, 'Unexpected practice figure')
    prefix = 'Find the ' + NAMES[template] + ' of these data: '
    suffix = '.' + (IQR_RULE if template == 'interquartile-range-data' else '')
    prompt = public['prompt']
    require(prompt.startswith(prefix) and prompt.endswith(suffix), 'Ambiguous statistic or quartile convention')
    source = prompt[len(prefix):-len(suffix)]
    tokens = source.split(', ')
    require(5 <= len(tokens) <= 9, 'Data count outside declared scope')
    require(all(re.fullmatch(r'−?[0-9](?:\.[0-9])?', token) for token in tokens), 'Malformed data value')
    values = [Fraction(token.replace('−', '-')) for token in tokens]
    require(all(abs(value) <= Fraction(99,10) for value in values), 'Value outside declared scope')
    ordered = sorted(values)
    if template == 'median-data':
        return median(ordered)
    if template == 'range-data':
        return ordered[-1] - ordered[0]
    half = len(ordered)//2
    lower, upper = median(ordered[:half]), median(ordered[-half:])
    require(lower <= median(ordered) <= upper, 'Quartile ordering invariant failed')
    return upper-lower


def review_descriptive_statistics_fixtures():
    def case(template, data):
        return {'templateId':template, 'response':{'kind':'fraction'},
                'prompt':'Find the '+NAMES[template]+' of these data: '+data+'.'+
                (IQR_RULE if template == 'interquartile-range-data' else '')}
    fixtures = [
        ('median-data','3, −1, 2, 0, 1',Fraction(1)),
        ('median-data','−1.1, −0.2, 0.3, 0.4, 1.5, 2.6',Fraction(7,20)),
        ('median-data','−2, −2, −2, −2, −2',Fraction(-2)),
        ('range-data','−9.9, 9.9, 0, −1, 1',Fraction(99,5)),
        ('range-data','−2, −2, −2, −2, −2',Fraction(0)),
        ('range-data','−3.2, −1.1, −3, −2, −2.5',Fraction(21,10)),
        ('interquartile-range-data','5, 2, 3, 1, 4',Fraction(3)),
        ('interquartile-range-data','7, 1, 6, 2, 5, 3, 4',Fraction(4)),
        ('interquartile-range-data','9, 1, 8, 2, 7, 3, 6, 4, 5',Fraction(5)),
        ('interquartile-range-data','6, 1, 5, 2, 4, 3',Fraction(3)),
        ('interquartile-range-data','8, 1, 7, 2, 6, 3, 5, 4',Fraction(4)),
        ('interquartile-range-data','−2, −2, −2, −2, −2',Fraction(0)),
        ('interquartile-range-data','−1.1, −0.2, 0.3, 0.4, 1.5, 2.6',Fraction(17,10)),
    ]
    for template, data, expected in fixtures:
        require(solve_descriptive_statistics(case(template,data)) == expected,
                'Independent handwritten statistic mismatch: '+data)
    bad = [case('median-data',data) for data in (
        '1, 2, 3, 4', '0, 1, 2, 3, 4, 5, 6, 7, 8, 9', '1, 2, 3, 4, 10',
        '1, 2, 3, 4, 0.25', '1,2,3,4,5', '1, 2, 3, 4, 1/2', '1, 2, 3, 4, nan')]
    wrong = case('interquartile-range-data','1, 2, 3, 4, 5')
    wrong['prompt'] = wrong['prompt'].replace('exclude','include'); bad.append(wrong)
    for public in bad:
        try: solve_descriptive_statistics(public)
        except (ValueError,KeyError,TypeError): pass
        else: raise ValueError('Malformed or ambiguous statistic accepted')
    return {'handwritten':len(fixtures),'mutants':len(bad)}




def data_values(public):
    source = public['prompt'].split('these data: ',1)[1].split('. Order',1)[0].removesuffix('.')
    return [Fraction(x.replace('−','-')) for x in source.split(', ')]


def numeric_value(source):
    source = source.strip().replace('−','-').replace('×','*').replace('÷','/')
    tree = ast.parse(source,mode='eval')
    def visit(node):
        if isinstance(node,ast.Constant) and type(node.value) in (int,float):
            return Fraction(ast.get_source_segment(source,node))
        if isinstance(node,ast.UnaryOp) and isinstance(node.op,(ast.UAdd,ast.USub)):
            return visit(node.operand) * (-1 if isinstance(node.op,ast.USub) else 1)
        if isinstance(node,ast.BinOp):
            a,b=visit(node.left),visit(node.right)
            if isinstance(node.op,ast.Add):return a+b
            if isinstance(node.op,ast.Sub):return a-b
            if isinstance(node.op,ast.Mult):return a*b
            if isinstance(node.op,ast.Div):return a/b
        raise ValueError('Unsupported numeric claim')
    return visit(tree.body)


def review_explanation(problem):
    public=problem['public']; ordered=sorted(data_values(public)); steps=problem['explanation']
    require(Fraction(problem['answer']) == solve_descriptive_statistics(public),'Mismatch: incorrect exact answer')
    first=steps[0].split(': ',1)[1].removesuffix('.')
    require([Fraction(x.replace('−','-')) for x in first.split(', ')] == ordered,
            'Explanation changed or incorrectly sorted observations')
    if public['templateId']=='interquartile-range-data':
        half=len(ordered)//2
        for prefix,expected in [('Lower half: ',ordered[:half]),('Upper half: ',ordered[-half:])]:
            actual=[x for x in steps if x.startswith(prefix)]
            require(len(actual)==1,'Missing or duplicated data half')
            values=[Fraction(x.replace('−','-')) for x in actual[0][len(prefix):].removesuffix('.').split(', ')]
            require(values==expected,'Quartile explanation uses wrong half')
        for prefix,expected in [('The lower quartile is ',median(ordered[:half])),('The upper quartile is ',median(ordered[-half:]))]:
            actual=[x for x in steps if x.startswith(prefix)]
            require(len(actual)==1 and Fraction(actual[0][len(prefix):].removesuffix('.').replace('−','-'))==expected,'Incorrect stated quartile')
    chains=0
    for step in steps:
        for match in re.finditer(r'[0-9−() .+×÷/−-]+(?: = [0-9−() .+×÷/−-]+)+',step):
            pieces=[x.strip().rstrip('.') for x in match[0].split(' = ')]
            values=[numeric_value(x) for x in pieces]
            require(all(x==values[0] for x in values),'False equality in worked arithmetic')
            chains+=1
    return chains


def review_descriptive_statistics_content(data=None):
    app=Path(__file__).resolve().parent.parent
    if data is None:
        data=json.loads(subprocess.check_output(['node','--import','tsx','scripts/descriptive-statistics-content-oracle.ts'],cwd=app,text=True))
    equations=0
    for sheet in data['worksheets']:
        problems=sheet['problems']; require(len(problems)==12,'Worksheet length')
        values=[data_values(p['public']) for p in problems]
        require(len({tuple(sorted(v)) for v in values})==12,'Repeated dataset in worksheet')
        lengths={len(v) for v in values}; require(lengths==set(range(5,10)),'Missing dataset length')
        require(sum(len(v)%2==0 for v in values)>=4 and sum(len(v)%2==1 for v in values)>=4,'Missing parity breadth')
        require(any(len(set(v))==1 for v in values),'Missing all-equal data')
        require(any(any(x<0 for x in v) for v in values),'Missing signed data')
        require(any(any(x.denominator!=1 for x in v) for v in values),'Missing decimal data')
        require(any(all(x.denominator==1 for x in v) for v in values),'Missing integer data')
        require(any(len(set(v))<len(v) for v in values),'Missing repetition')
        require(any(Fraction(p['answer']).denominator!=1 for p in problems),'Missing fractional answer')
        equations+=sum(review_explanation(p) for p in problems)
    expected_data={'median':[-2,-1,1,3,3,8],'range':[-2,-1,1,3,3,8],'iqr':[-4,-2,-2,0,1,3,4,6,8]}
    for figure in data['figures']:
        kind=figure['kind']; root=ET.fromstring(figure['html']); svg=root.find('svg'); require(svg is not None,'Missing figure')
        low=-4 if kind=='iqr' else -2; scale=26 if kind=='iqr' else Fraction(156,5)
        points=[e for e in svg.iter('circle') if 'data-observation' in e.attrib]
        require([int(e.attrib['data-value']) for e in points]==expected_data[kind],'Dotplot changed dataset')
        seen={}
        for point,value in zip(points,expected_data[kind]):
            level=seen.get(value,0);seen[value]=level+1
            require(abs(Fraction(point.attrib['cx'])-(40+(value-low)*scale))<Fraction(1,10**9),'Dot horizontal coordinate')
            require(Fraction(point.attrib['cy'])==123-26*level,'Repeated observations stack incorrectly')
        ticks=[e for e in svg.iter('line') if 'data-tick' in e.attrib]
        require([int(e.attrib['data-tick']) for e in ticks]==list(range(low,9)),'Incomplete equal-unit scale')
        for e in ticks:
            require(abs(Fraction(e.attrib['x1'])-(40+(int(e.attrib['data-tick'])-low)*scale))<Fraction(1,10**9),'Tick coordinate')
        span=next(e for e in svg.iter('path') if 'data-span' in e.attrib)
        endpoints={'median':(1,3),'range':(-2,8),'iqr':(-2,5)}[kind]
        require(tuple(map(int,span.attrib['data-span'].split(',')))==endpoints,'Incorrect statistic span')
        coords=list(map(Fraction,re.findall(r'[0-9.]+',span.attrib['d'])))
        require(len(coords)==5 and abs(coords[0]-(40+(endpoints[0]-low)*scale))<Fraction(1,10**9) and abs(coords[3]-(40+(endpoints[1]-low)*scale))<Fraction(1,10**9),'Drawn span contradicts endpoint labels')
    require({l['id'] for l in data['lessons']}==DESCRIPTIVE_STATISTICS,'Missing standalone lesson')
    require([Fraction(l['workedExample']['answer']) for l in data['lessons']]==[2,Fraction(11,2),7],'Standalone worked answers')
    return {'worksheets':len(data['worksheets']),'workedArithmeticChains':equations,'figures':len(data['figures']),'lessons':len(data['lessons'])}

def review_content_mutations():
    app=Path(__file__).resolve().parent.parent
    data=json.loads(subprocess.check_output(['node','--import','tsx','scripts/descriptive-statistics-content-oracle.ts'],cwd=app,text=True))
    mutants=[]
    bad=copy.deepcopy(data);bad['figures'][0]['html']=bad['figures'][0]['html'].replace('cx="40"','cx="41"',1);mutants.append(bad)
    bad=copy.deepcopy(data);bad['figures'][0]['html']=bad['figures'][0]['html'].replace('data-span="1,3"','data-span="1,8"',1);mutants.append(bad)
    bad=copy.deepcopy(data);bad['lessons'][0]['workedExample']['answer']='3';mutants.append(bad)
    bad=copy.deepcopy(data);bad['worksheets'][0]['problems'][1]=bad['worksheets'][0]['problems'][0];mutants.append(bad)
    bad=copy.deepcopy(data);bad['worksheets'][0]['problems'][0]['explanation'].append('A false check: 2 + 3 = 6.');mutants.append(bad)
    for bad in mutants:
        try:review_descriptive_statistics_content(bad)
        except (ValueError,KeyError,TypeError):pass
        else:raise ValueError('Corrupted content accepted')
    return len(mutants)

if __name__ == '__main__':
    print(review_descriptive_statistics_fixtures())
    print(review_descriptive_statistics_content())
    print({'contentMutantsRejected':review_content_mutations()})
