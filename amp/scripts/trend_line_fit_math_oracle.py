"""Independent rational-arithmetic checks from public coordinates and lines.

The key is a candidate, never a source of the regression or expected values.
The informal acceptance region has many correct lines, so review validates the
candidate against independently computed sums, rather than one canonical key.
"""
import copy
import json
import math
import re
from fractions import Fraction as F

SUPPORTED = frozenset({'trend-line-fit', 'trend-line-compare', 'trend-line-read'})
REVIEW_RETURNS_ANSWER = True
CHOICE_REVIEW = SUPPORTED

def require(ok, message):
    if not ok:
        raise ValueError(message)

def regression(data):
    n = len(data)
    sx = sum(F(p[0]) for p in data)
    sy = sum(F(p[1]) for p in data)
    sxy = sum(F(x)*F(y) for x, y in data)
    sxx = sum(F(x)**2 for x, _ in data)
    m = (n*sxy-sx*sy)/(n*sxx-sx*sx)
    return m, (sy-m*sx)/n

def through(points):
    (x, y), (u, v) = [[F(str(v)) for v in p] for p in points]
    require(x != u, 'Distinct horizontal coordinates')
    m = (v-y)/(u-x)
    return m, y-m*x

def mse(data, line):
    m, b = line
    return sum((F(y)-m*F(x)-b)**2 for x, y in data)/len(data)

def accepted(data, line):
    best = regression(data)
    return F(65, 100) <= line[0]/best[0] <= F(3, 2) and mse(data, line) <= F(8, 5)*mse(data, best) + F(1, 10**9)

def scene_data(scene):
    graph = next(e for e in scene['elements'] if e['type'] == 'graph')
    return graph['scatter']['points'], through(graph['lines'][0]['line']['through'])

def solve(public):
    r = public['response']
    if r['kind'] == 'trend-line-fit':
        data, g = r['data'], r['grid']
        m, b = regression(data)
        # Round near the ends independently; search a narrow neighborhood
        # if the nearest pair happens to miss the tolerance.
        for x in range(g['xMin'], g['xMin'] + 4*g['xStep'], g['xStep']):
            for u in range(g['xMax'], g['xMax'] - 4*g['xStep'], -g['xStep']):
                for dy in (0, -1, 1):
                    for dv in (0, -1, 1):
                        points = [[x, round(m*x+b)+dy], [u, round(m*u+b)+dv]]
                        if all(g['yMin'] <= p[1] <= g['yMax'] for p in points) and accepted(data, through(points)):
                            return json.dumps(points, separators=(',', ':'))
        raise ValueError('Reachable fit required')
    if public['templateId'] == 'trend-line-compare':
        candidates = [(mse(*scene_data(o['scene'])), o['id']) for o in r['options']]
        candidates.sort()
        require(candidates[1][0] >= F(5, 2)*candidates[0][0] - F(1, 10**6), 'Clearly separated comparison')
        return candidates[0][1]
    data, (m, b) = scene_data(public['figure']['scene'])
    match = re.search(r'[Aa]t (\d+)(?: |°)', public['prompt'])
    require(match, 'Read prompt gives horizontal value')
    x = F(match[1])
    require(min(p[0] for p in data) <= x <= max(p[0] for p in data), 'Interpolation only')
    y = math.floor(m*x+b+F(1, 2))
    matches = [o['id'] for o in r['options'] if F(o['label'].split()[0]) == y]
    require(len(matches) == 1, 'One rounded estimate')
    return matches[0]

def review_problem(problem):
    public = problem['public']
    r = public['response']
    if r['kind'] == 'trend-line-fit':
        key = json.loads(problem['answer'])
        g = r['grid']
        require(len(key) == 2 and all(len(p) == 2 for p in key), 'Two-point key')
        require(all(all(type(v) is int for v in p) and g['xMin'] <= p[0] <= g['xMax'] and g['yMin'] <= p[1] <= g['yMax'] and (p[0]-g['xMin']) % g['xStep'] == 0 and (p[1]-g['yMin']) % g['yStep'] == 0 for p in key), 'Key on lattice')
        require(accepted(r['data'], through(key)), 'Key must fit the public data')
        require(accepted(r['data'], through(json.loads(solve(public)))), 'Independent reachable fit')
        return problem['answer']
    answer = solve(public)
    require(answer == problem['answer'], 'Incorrect comparison or estimate')
    return answer

def self_test():
    data = [[x, 3*x + (1 if x % 2 else -1)] for x in range(1, 11)]
    require(accepted(data, (F(3), F(0))), 'Hand fit accepted')
    require(not accepted(data, (F(-3), F(30))), 'Wrong trend rejected')
    fixture = {'public': {'templateId': 'trend-line-fit', 'response': {'kind': 'trend-line-fit', 'data': data,
      'grid': {'xMin': 0, 'xMax': 11, 'yMin': 0, 'yMax': 40, 'xStep': 1, 'yStep': 1}}}, 'answer': '[[1,3],[10,30]]'}
    review_problem(fixture)
    bad = copy.deepcopy(fixture)
    bad['answer'] = '[[1,30],[10,3]]'
    try:
        review_problem(bad)
    except ValueError:
        return {'fixtures': 3, 'mutations': 1}
    raise AssertionError('Corrupt key accepted')

if __name__ == '__main__':
    import sys
    cases = json.load(sys.stdin) if not sys.stdin.isatty() else []
    self_test()
    print(json.dumps([review_problem(p) for p in cases]))
