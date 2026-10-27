"""Independent deletion-by-deletion function test from public plotted coordinates."""
import copy
import re
from fractions import Fraction as F
SUPPORTED=frozenset({'relation-point-removal'})
def require(ok,message):
    if not ok: raise ValueError(message)
def solve(public):
    require(public['templateId'] in SUPPORTED,'Wrong family')
    m=re.fullmatch(r'The graph shows four points, including two at \$x = (-?\d+)\$\. Which choice lists every point that could be removed, one at a time, so the remaining relation is a function\?',public['prompt'].replace('−','-'))
    require(m is not None,'Unexpected removal prompt')
    figure=public['figure'];require(figure['kind']=='scene','Scene required')
    graphs=[e for e in figure['scene']['elements'] if e['type']=='graph']
    require(len(graphs)==1,'One public graph required')
    graph=graphs[0];points=graph['points']
    require(len(points)==4 and {p['label'] for p in points}==set('ABCD'),'Four distinct labels required')
    coords={p['label']:(F(str(p['x'])),F(str(p['y']))) for p in points}
    require(len(set(coords.values()))==4,'Duplicate coincident points')
    for x,y in coords.values():
        require(graph['x'][0]<=x<=graph['x'][1] and graph['y'][0]<=y<=graph['y'][1],'Point outside graph bounds')
    counts={x:sum(u==x for u,v in coords.values()) for x,y in coords.values()}
    require(sorted(counts.values())==[1,1,2] and counts.get(F(m[1]))==2,'Stem/graph repeated input mismatch')
    # Check the alternative accessible representation against the same givens.
    title=figure['scene']['title'].replace('−','-')
    described=re.findall(r'Point ([ABCD]) is at \((-?\d+), (-?\d+)\)',title)
    require(len(described)==4 and {name:(F(x),F(y)) for name,x,y in described}==coords,'Accessible coordinates disagree')
    valid=set()
    for removed in coords:
        relation={};works=True
        for label,(x,y) in coords.items():
            if label==removed: continue
            if x in relation and relation[x]!=y: works=False
            relation[x]=y
        if works: valid.add(removed)
    options=public['response']['options'];require(public['response']['kind']=='choice' and len(options)==4,'Four choices required')
    require(len({o['id'] for o in options})==4,'Duplicate option IDs')
    pairs=[]
    for o in options:
        match=re.fullmatch(r'\$([ABCD])\$ or \$([ABCD])\$',o['label'])
        require(match is not None and match[1]!=match[2],'Expected two distinct removal labels')
        pairs.append(frozenset([match[1],match[2]]))
    require(len(set(pairs))==4,'Duplicate semantic options')
    answers=[o['id'] for o,pair in zip(options,pairs) if pair==valid]
    require(len(answers)==1,'Missing/ambiguous complete removal set')
    return answers[0]
def review_problem(problem):
    answer=solve(problem['public']);require(answer==problem['answer'],'Incorrect answer');return answer
def self_test():
    rejected=0
    def reject(p):
        nonlocal rejected
        try:review_problem(p)
        except ValueError:rejected+=1;return
        raise AssertionError('Corruption accepted')
    for shared in [-1,0,1]:
        points=[{'label':l,'x':x,'y':y} for l,x,y in [('A',shared,-3),('B',-4,2),('C',shared,4),('D',3,2)]]
        p={'public':{'templateId':next(iter(SUPPORTED)),'prompt':f'The graph shows four points, including two at $x = {shared}$. Which choice lists every point that could be removed, one at a time, so the remaining relation is a function?','response':{'kind':'choice','options':[{'id':str(i),'label':f'${a}$ or ${b}$'} for i,(a,b) in enumerate(['AC','BD','AB','CD'])]},'figure':{'kind':'scene','scene':{'title':'; '.join(f"Point {q['label']} is at ({q['x']}, {q['y']})" for q in points),'elements':[{'type':'graph','x':[-5,5],'y':[-5,5],'points':points}]}}},'answer':'0'}
        review_problem(p)
        bad=copy.deepcopy(p);bad['answer']='1';reject(bad)
        bad=copy.deepcopy(p);bad['public']['response']['options'][1]['label']='$C$ or $A$';reject(bad)
        bad=copy.deepcopy(p);bad['public']['response']['options'][0]['label']='$A$ or $D$';reject(bad)
        bad=copy.deepcopy(p);bad['public']['figure']['scene']['elements'][0]['points'][2]['x']=2;reject(bad)
        bad=copy.deepcopy(p);bad['public']['figure']['scene']['title']=bad['public']['figure']['scene']['title'].replace('Point A','Point B');reject(bad)
        bad=copy.deepcopy(p);bad['public']['response']['options'][0]['label']='$A$ or $A$';reject(bad)
    return {'fixtures':3,'rejectedMutations':rejected}
if __name__=='__main__':print(self_test())


# Read by independent-math-review.py (FamilyOracle).
CHOICE_REVIEW = SUPPORTED
