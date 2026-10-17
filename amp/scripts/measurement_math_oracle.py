"""Independent measurement oracle: derive answers only from displayed public givens."""
import json
import math
import re
from fractions import Fraction

SUPPORTED = {
    'shifted-ruler-length', 'fractional-ruler-length', 'rectangle-border-length',
    'rectangle-missing-border-side', 'rectangle-missing-area-side', 'border-or-cover-unit',
    'same-area-border-choice', 'same-border-area-choice', 'metric-length-rename',
    'metric-length-reverse', 'mixed-length-total', 'mixed-unit-border',
    'rectangle-two-constraints-choice', 'rectangle-existence-choice', 'whole-pack-ribbon-choice',
}
SCALES = {'mm': Fraction(1, 10), 'cm': Fraction(1), 'm': Fraction(100), 'km': Fraction(100000)}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def match(pattern, text):
    result = re.fullmatch(pattern, text)
    require(result is not None, 'Unrecognized public wording: ' + text)
    return result.groups()


def positive(value):
    require(type(value) is int and value > 0, 'Positive integer dimension required')
    return value


def selected(public, predicate):
    options = public['response']['options']
    require(public['response']['kind'] == 'choice', 'Choice response required')
    require(len({o['id'] for o in options}) == len(options), 'Duplicate choice IDs')
    require(len({o['label'] for o in options}) == len(options), 'Duplicate choice labels')
    good = [o['id'] for o in options if predicate(o['label'])]
    require(len(good) == 1, 'Exactly one correct displayed choice required')
    return good[0]


def factors(area):
    return [(a, area // a) for a in range(1, math.isqrt(area) + 1) if area % a == 0]


def rectangle(figure, missing=False):
    require(figure['kind'] == 'measure-rectangle', 'Rectangle figure required')
    known = []
    for side in ('width', 'height'):
        item = figure[side]
        if item is None:
            known.append(None)
        else:
            require(set(item) == {'value', 'unit'}, 'Only displayed dimension and unit permitted')
            require(item['unit'] in SCALES, 'Unknown length unit')
            known.append(positive(item['value']) * SCALES[item['unit']])
    require(sum(v is None for v in known) == int(missing), 'Unexpected missing dimensions')
    return known


def solve(public):
    family, prompt = public['templateId'], public['prompt']
    require(family in SUPPORTED, 'Unsupported measurement family')
    figure = public.get('figure')
    if family in {'shifted-ruler-length', 'fractional-ruler-length'}:
        require(prompt == 'The strip runs from A to B. What is its length in cm?', 'Ruler wording')
        require(figure['kind'] == 'length-interval' and figure['unit'] == 'cm', 'Ruler model')
        d, a, b, maximum = (figure[k] for k in ('denominator', 'startNumerator', 'endNumerator', 'maxWhole'))
        require(all(type(x) is int for x in (d, a, b, maximum)), 'Integer ruler tick data')
        require(d in (1, 2, 4) and 0 <= a < b <= maximum*d and maximum > 0, 'Invalid ruler bounds')
        require(family != 'shifted-ruler-length' or d == 1, 'Whole-unit ruler expected')
        return Fraction(b-a, d)
    if family in {'rectangle-border-length', 'mixed-unit-border'}:
        expected = {'rectangle-border-length': 'How many cm of ribbon go once around this rectangle?',
                    'mixed-unit-border': 'Ribbon goes once around this rectangle. What is its full perimeter in cm?'}
        require(prompt == expected[family], 'Border wording')
        w, h = rectangle(figure)
        return 2*(w+h)
    if family in {'rectangle-missing-border-side', 'rectangle-missing-area-side'}:
        border = family == 'rectangle-missing-border-side'
        pattern = (r'This rectangle has perimeter (\d+) cm\. Find its missing side in cm\.' if border else
                   r'This rectangle covers (\d+) square cm\. Find its missing side in cm\.')
        amount = positive(int(match(pattern, prompt)[0]))
        sides = rectangle(figure, missing=True)
        known = next(v for v in sides if v is not None)
        result = Fraction(amount, 2)-known if border else Fraction(amount)/known
        require(result > 0, 'No positive missing side')
        return result
    if family == 'border-or-cover-unit':
        meanings = {'Ribbon runs once around a card. Which unit measures the length of ribbon?': 'cm',
                    'Paper covers the flat face of a card. Which unit measures the area covered?': 'square cm'}
        require(prompt in meanings, 'Unknown dimensional question')
        return selected(public, lambda label: label == meanings[prompt])
    if family in {'same-area-border-choice', 'same-border-area-choice'}:
        area_fixed = family == 'same-area-border-choice'
        require(prompt == ('These rectangles have equal areas. Which needs less ribbon around its border?' if area_fixed else
                           'These rectangles have equal perimeters. Which covers more area?'), 'Comparison wording')
        require(figure['kind'] == 'rectangle-comparison' and figure['unit'] == 'cm' and len(figure['rectangles']) == 2, 'Comparison model')
        dims = [(positive(r['width']), positive(r['height'])) for r in figure['rectangles']]
        areas, borders = [w*h for w,h in dims], [2*(w+h) for w,h in dims]
        require((areas if area_fixed else borders)[0] == (areas if area_fixed else borders)[1], 'False equal-quantity premise')
        values = borders if area_fixed else [-a for a in areas]
        answer = 'They are equal' if values[0] == values[1] else ('A' if values[0] < values[1] else 'B')
        return selected(public, lambda label: label == answer)
    if family in {'metric-length-rename', 'metric-length-reverse'}:
        amount, source, target = match(r'Write (\d+) (mm|cm|m|km) in (mm|cm|m|km)\.', prompt)
        require((SCALES[source] > SCALES[target]) == (family == 'metric-length-rename'), 'Conversion direction mismatch')
        require(source != target, 'Identity conversion')
        return int(amount)*SCALES[source]/SCALES[target]
    if family == 'mixed-length-total':
        a,b = match(r'A strip is (\d+) m long, and another is (\d+) cm long\. What is their total length in cm\?', prompt)
        return Fraction(100*int(a)+int(b))
    if family in {'rectangle-two-constraints-choice', 'rectangle-existence-choice'}:
        bounded = family == 'rectangle-two-constraints-choice'
        pattern = (r'Use positive whole-number sides\. Area must be (\d+) square cm; perimeter at most (\d+) cm\. Which rectangle works\?' if bounded else
                   r'Use positive whole-number sides\. Area: (\d+) square cm\. Perimeter: (\d+) cm\. Which statement is true\?')
        area, perimeter = map(int, match(pattern, prompt))
        positive(area); positive(perimeter)
        feasible = {(a,b) for a,b in factors(area) if (2*(a+b) <= perimeter if bounded else 2*(a+b) == perimeter)}
        seen = set()
        def valid(label):
            if label == 'No such rectangle':
                return not feasible
            a,b = map(int, match(r'(\d+) cm by (\d+) cm', label))
            positive(a); positive(b)
            pair = tuple(sorted((a,b)))
            require(pair not in seen, 'Duplicate rectangle modulo rotation')
            seen.add(pair)
            return pair in feasible
        return selected(public, valid)
    if family == 'whole-pack-ribbon-choice':
        need, length, pack_price, rate = map(int, match(r'Need (\d+) m of ribbon; pieces join without loss\. A: whole (\d+) m packs at \$(\d+) each\. B: any length at \$(\d+)/m\. No other charges\. Which costs less\?', prompt))
        for n in (need,length,pack_price,rate): positive(n)
        cost_a = ((need+length-1)//length)*pack_price
        cost_b = need*rate
        answer = 'Same cost' if cost_a == cost_b else ('A' if cost_a < cost_b else 'B')
        return selected(public, lambda label: label == answer)
    raise ValueError('Missing solver')


def self_test():
    """Hand-built domain, full-inventory, unit and choice-ambiguity checks."""
    def choices(family, prompt, labels):
        return {'templateId':family,'prompt':prompt,'response':{'kind':'choice','options':[{'id':str(i),'label':s} for i,s in enumerate(labels)]}}
    p = choices('rectangle-existence-choice', 'Use positive whole-number sides. Area: 12 square cm. Perimeter: 14 cm. Which statement is true?', ['1 cm by 12 cm','No such rectangle','3 cm by 4 cm'])
    require(solve(p)=='2', 'Minimum-perimeter existence')
    p['prompt']=p['prompt'].replace('14 cm','16 cm'); p['response']['options'][2]['label']='2 cm by 6 cm'
    require(solve(p)=='2', 'Nonminimum valid perimeter')
    p['prompt']=p['prompt'].replace('16 cm','18 cm')
    require(solve(p)=='1', 'Full inventory excludes gap perimeter')
    p['prompt']=p['prompt'].replace('18 cm','14 cm')
    try: solve(p)
    except ValueError: pass
    else: raise AssertionError('No-such must not mean absent displayed candidate')
    p=choices('whole-pack-ribbon-choice','Need 7 m of ribbon; pieces join without loss. A: whole 6 m packs at $6 each. B: any length at $1/m. No other charges. Which costs less?', ['A','B','Same cost'])
    require(solve(p)=='1','Whole-pack ceiling, not divisible pack pricing')
    p['prompt']=p['prompt'].replace('7 m','6 m');require(solve(p)=='2','Exact pack boundary tie')
    p={'templateId':'metric-length-reverse','prompt':'Write 1 cm in m.','response':{'kind':'fraction'}}
    require(solve(p)==Fraction(1,100),'Exact fractional reverse conversion')
    p={'templateId':'rectangle-missing-border-side','prompt':'This rectangle has perimeter 10 cm. Find its missing side in cm.','figure':{'kind':'measure-rectangle','width':{'value':6,'unit':'cm'},'height':None}}
    try: solve(p)
    except ValueError: pass
    else: raise AssertionError('Nonpositive side accepted')
    p=choices('rectangle-two-constraints-choice','Use positive whole-number sides. Area must be 12 square cm; perimeter at most 26 cm. Which rectangle works?', ['1 cm by 12 cm','3 cm by 4 cm'])
    try: solve(p)
    except ValueError: pass
    else: raise AssertionError('Multiple valid choices accepted')
    return 9


if __name__ == '__main__':
    import sys
    self_test()
    counts = {}
    for line in sys.stdin:
        public = json.loads(line)
        solve(public)
        family = public['templateId']
        counts[family] = counts.get(family, 0)+1
    print(json.dumps({'solvedPublicCases':sum(counts.values()),'families':counts,'handbuiltChecks':9}, sort_keys=True))
