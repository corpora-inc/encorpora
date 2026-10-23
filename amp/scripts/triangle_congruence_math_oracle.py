"""Public givens/topology and drawn-geometry oracle for triangle congruence."""
import copy
import math
import re
from fractions import Fraction as Q

SUPPORTED = frozenset({'triangle-congruence-criteria'})
CORRESPONDENCE = dict(zip('ABC','DEF'))

def require(ok, message):
    if not ok: raise ValueError(message)

def fact(text):
    text = text.replace('$','').strip()
    angle = re.fullmatch(r'm\\angle ([ABC]) = m\\angle ([DEF])(?: = (\d+)\^\\circ)?', text)
    if angle:
        require(CORRESPONDENCE[angle[1]] == angle[2], 'Wrong angle correspondence')
        return ('angle', angle[1]), float(angle[3]) if angle[3] else None
    side = re.fullmatch(r'([ABC]{2}) = ([DEF]{2})(?: = (\d+)(\\sqrt\{2\})?)?(?: cm)?',text)
    require(side is not None, 'Unrecognized corresponding fact')
    require(len(set(side[1])) == 2 and {CORRESPONDENCE[x] for x in side[1]} == set(side[2]), 'Wrong side correspondence')
    return ('side', ''.join(sorted(side[1]))), float(side[3]) * (math.sqrt(2) if side[4] else 1) if side[3] else None

def givens(public):
    require(public['templateId'] in SUPPORTED, 'Unknown congruence family')
    prompt = public['prompt']
    require(prompt.startswith('Triangles $ABC$ and $DEF$ have correspondence $A \\leftrightarrow D$, $B \\leftrightarrow E$, $C \\leftrightarrow F$. Given: '), 'Unexpected vertex correspondence')
    raw, question = prompt.split('Given: ',1)[1].split('. Use only the stated givens and matching marks; unmarked features supply no facts. ')
    parsed = [fact(x) for x in raw.split('; ')]
    require(len({f for f,v in parsed}) == len(parsed), 'Duplicate givens')
    return dict(parsed), question

def criterion(facts):
    sides = [set(s) for kind,s in facts if kind == 'side']
    angles = {a for kind,a in facts if kind == 'angle'}
    if len(sides) == 3 and not angles: return 'SSS'
    if len(sides) == 2 and len(angles) == 1:
        return 'SAS' if sides[0] & sides[1] == angles else 'SSA'
    if len(sides) == 1 and len(angles) == 2:
        return 'ASA' if sides[0] == angles else 'AAS'
    if not sides and len(angles) == 3: return 'AAA'
    return None

def option_rule(label):
    if label.startswith('SSS: three corresponding sides '): return 'SSS'
    if label.startswith('SAS: two corresponding sides and their included angle '): return 'SAS'
    if label.startswith('ASA: two corresponding angles and their included side '): return 'ASA'
    if label.startswith('AAS: two corresponding angles and a non-included side '): return 'AAS'
    if label == 'Not sufficient: these two sides and a non-included angle allow different triangles.': return 'SSA'
    if label == 'Not sufficient: three matching angles allow different sizes.': return 'AAA'
    raise ValueError('Unrecognized theorem choice')

def solve(public):
    facts, question = givens(public)
    response = public['response']
    require(response['kind'] == 'choice', 'Expected choice response')
    options = response['options']
    require(len(options) == 4 and len({o['id'] for o in options}) == 4 and len({o['label'] for o in options}) == 4, 'Duplicate or incomplete options')
    complete = re.fullmatch(r'Which additional fact completes (SSS|SAS|ASA|AAS) using exactly the stated pairs\?',question)
    if complete:
        require(len(facts) == 2, 'Completion needs two given pairs')
        matched = []
        for o in options:
            additional,_ = fact(o['label'])
            if additional not in facts and criterion(set(facts) | {additional}) == complete[1]: matched.append(o['id'])
    else:
        require(question in ['Which criterion or limitation describes these givens?', 'A student claims these givens prove congruence. Which assessment of that claim is justified?'], 'Unknown inference question')
        rule = criterion(facts)
        require(rule is not None, 'Unknown configuration')
        matched = [o['id'] for o in options if option_rule(o['label']) == rule]
    require(len(matched) == 1, 'No unique supported congruence choice')
    return matched[0]

def geometry(public):
    facts, question = givens(public)
    figure = public['figure']
    require(figure['kind'] == 'scene', 'Expected scene')
    triangles = figure['scene']['elements']
    require(len(triangles) == 2 and all(t['type']=='triangle' for t in triangles), 'Expected two triangles')
    records = []
    for names in ['ABC','DEF']:
        matches = [t for t in triangles if ''.join(t['names']) == names]
        require(len(matches)==1, 'Missing named triangle')
        t = matches[0]; points = t['points']
        require(len(points)==3, 'Invalid vertices')
        area = (points[1][0]-points[0][0])*(points[2][1]-points[0][1])-(points[1][1]-points[0][1])*(points[2][0]-points[0][0])
        require(abs(area)>1e-9, 'Degenerate triangle')
        lengths = {}; angles = {}; marks = {}; scales = []
        for i in range(3):
            j=(i+1)%3
            key=('side',''.join(sorted('ABC'[i]+'ABC'[j])))
            length=math.dist(points[i],points[j]);lengths[key]=length
            side = (t.get('sides',[])+[None]*3)[i] or {}
            if side.get('ticks'):
                require(key in facts,'Extra side mark supplies unstated fact')
                marks[key]=side['ticks']
                label=side.get('label','')
                number=re.fullmatch(r'(\d+)(√2)?',label)
                require(number is not None,'Unknown side label')
                labelled=float(number[1])*(math.sqrt(2) if number[2] else 1)
                require(math.isclose(labelled,facts[key],abs_tol=1e-9),'Side label differs from given')
                scales.append(labelled/length)
            u=[points[j][k]-points[i][k] for k in range(2)]
            v=[points[(i+2)%3][k]-points[i][k] for k in range(2)]
            angle=math.degrees(math.acos(max(-1,min(1,sum(a*b for a,b in zip(u,v))/math.hypot(*u)/math.hypot(*v)))))
            key=('angle','ABC'[i]);angles[key]=angle
            mark=(t.get('angles',[])+[None]*3)[i] or {}
            if mark.get('mark'):
                require(key in facts and mark['mark']=='arc','Extra or incorrect angle mark')
                marks[key]=mark.get('arcs',1)
                if facts[key] is not None:
                    require(math.isclose(angle,facts[key],abs_tol=1e-8),'Drawn angle disagrees with numeric given')
                    require(mark.get('label') in (None, f'{int(facts[key])}°'),'Numeric angle label mismatch')
        require(set(marks)==set(facts),'Diagram omits stated marks')
        require(all(math.isclose(s,scales[0],abs_tol=1e-8) for s in scales),'Inconsistent diagram length scale')
        records.append((lengths,angles,marks,scales[0] if scales else None))
    left,right=records
    require(left[2]==right[2],'Corresponding markings do not match')
    for key in facts:
        if key[0]=='angle': require(math.isclose(left[1][key],right[1][key],abs_tol=1e-8),'Marked angles are unequal')
        else: require(math.isclose(left[0][key]*left[3],right[0][key]*right[3],abs_tol=1e-8),'Marked sides are unequal')
    rule=criterion(facts)
    if rule in ('SSA','AAA'):
        require(any(not math.isclose(left[0][k],right[0][k],abs_tol=1e-8) for k in left[0]),'Nonexample must exhibit unequal side lengths')
    if rule=='SSA':
        require(math.isclose(left[3],right[3],abs_tol=1e-8),'SSA counterexample must use common diagram scale')
    return records

def review_problem(problem):
    expected=solve(problem['public'])
    require(expected==problem['answer'],'Wrong congruence answer')
    geometry(problem['public'])
    return expected

def self_test():
    # Topology: included vertex and included side, not token order or a private rule label.
    assert criterion({('side','AB'),('side','AC'),('angle','A')})=='SAS'
    assert criterion({('side','AB'),('side','AC'),('angle','B')})=='SSA'
    assert criterion({('side','AB'),('angle','A'),('angle','B')})=='ASA'
    assert criterion({('side','BC'),('angle','A'),('angle','B')})=='AAS'
    assert criterion({('side','AB'),('side','BC'),('side','AC')})=='SSS'
    assert criterion({('angle','A'),('angle','B'),('angle','C')})=='AAA'
    public={'templateId':'triangle-congruence-criteria','prompt':'Triangles $ABC$ and $DEF$ have correspondence $A \\leftrightarrow D$, $B \\leftrightarrow E$, $C \\leftrightarrow F$. Given: $AB = DE = 7$ cm; $CA = FD = 5$ cm; $m\\angle B = m\\angle E = 45^\\circ$. Use only the stated givens and matching marks; unmarked features supply no facts. Which criterion or limitation describes these givens?','response':{'kind':'choice','options':[{'id':str(i),'label':label} for i,label in enumerate(['SSS: three corresponding sides fix the triangle.','SAS: two corresponding sides and their included angle fix the triangle.','Not sufficient: these two sides and a non-included angle allow different triangles.','Not sufficient: three matching angles allow different sizes.'])]},'figure':{'kind':'scene','scene':{'elements':[]}}}
    for names,points in [('ABC',[[0,0],[7,0],[3,4]]),('DEF',[[11,0],[18,0],[15,3]])]:
        public['figure']['scene']['elements'].append({'type':'triangle','names':list(names),'points':points,'sides':[{'ticks':1,'label':'7'},None,{'ticks':3,'label':'5'}],'angles':[None,{'mark':'arc','arcs':2,'label':'45°'},None]})
    case={'public':public,'answer':'2'};review_problem(case)
    rejected=0
    def reject(case):
        nonlocal rejected
        try:review_problem(case)
        except ValueError:rejected+=1;return
        raise AssertionError('Accepted corrupt congruence case')
    for change in ['answer','included','correspondence','label','angle','ticks','missing','duplicate','extra']:
        bad=copy.deepcopy(case);p=bad['public'];t=p['figure']['scene']['elements'][1]
        if change=='answer':bad['answer']='1'
        elif change=='included':p['prompt']=p['prompt'].replace('$m\\angle B = m\\angle E = 45^\\circ$','$m\\angle A = m\\angle D$')
        elif change=='correspondence':p['prompt']=p['prompt'].replace('CA = FD','CA = DE')
        elif change=='label':t['sides'][0]['label']='8'
        elif change=='angle':t['points'][2]=[14,5]
        elif change=='ticks':t['sides'][0]['ticks']=2
        elif change=='missing':t['sides'][0]=None
        elif change=='duplicate':p['response']['options'][0]['label']=p['response']['options'][2]['label']
        else:t['angles'][0]={'mark':'arc','arcs':1}
        reject(bad)
    # Both non-included sides complete AAS; offer only one valid option.
    completion=copy.deepcopy(public)
    completion['prompt']=completion['prompt'].split('Given: ')[0] + r'Given: $m\angle A = m\angle D$; $m\angle B = m\angle E = 45^\circ$. Use only the stated givens and matching marks; unmarked features supply no facts. Which additional fact completes AAS using exactly the stated pairs?'
    completion['response']['options']=[{'id':str(i),'label':label} for i,label in enumerate(['$AB = DE$','$BC = EF$',r'$m\angle A = m\angle D$',r'$m\angle C = m\angle F$'])]
    require(solve(completion)=='1','Non-included side must complete AAS')
    completion['response']['options'][0]['label']='$CA = FD$'
    try:solve(completion)
    except ValueError:rejected+=1
    else:raise AssertionError('Accepted two valid AAS completion options')
    return {'topologyFixtures':7,'figureFixtures':1,'rejectedMutations':rejected}

if __name__=='__main__':print(self_test())
