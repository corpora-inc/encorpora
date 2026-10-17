"""Exact fraction-practice oracle derived only from the public question and diagram."""
import re
from fractions import Fraction

FRACTION_PRACTICE = frozenset({
    'unit-piece-size', 'fraction-unit-count', 'fraction-line-position',
    'fraction-whole-as-parts', 'equivalent-numerator', 'equivalent-denominator',
    'like-fraction-missing-part', 'like-fraction-difference',
    'mixed-to-improper-numerator', 'improper-whole-part', 'improper-fractional-part',
    'mixed-fraction-difference', 'unlike-fraction-difference', 'fraction-distance-gap',
    'whole-times-fraction', 'whole-sharing-fraction', 'unit-fraction-share',
    'whole-unit-groups', 'fraction-group-count', 'fraction-share-amount', 'fraction-of-quantity',
})

def require(ok, message):
    if not ok:
        raise ValueError(message)

def match(pattern, prompt):
    found = re.fullmatch(pattern, prompt)
    require(found is not None, 'Unrecognized fraction prompt: ' + prompt)
    return tuple(map(int, found.groups()))

def solve_fraction_practice(public):
    name, prompt = public['templateId'], public['prompt']
    require(name in FRACTION_PRACTICE, 'Unknown fraction family')
    diagram = public.get('figure')
    if diagram:
        if diagram['kind'] == 'rational-line':
            d, w = diagram['denominator'], diagram['maxWhole']
            require(type(d) is int and 2 <= d <= 12 and type(w) is int and 1 <= w <= 3, 'Invalid line unit grid')
            require(1 <= len(diagram['points']) <= 2, 'Invalid marker count')
            require(all(type(p['numerator']) is int and 0 <= p['numerator'] <= d*w for p in diagram['points']), 'Marker off grid')
            require(len({p['label'] for p in diagram['points']}) == len(diagram['points']), 'Duplicate point labels')
        elif diagram['kind'] == 'fraction-strips':
            d, w = diagram['parts'], diagram['wholes']
            require(type(d) is int and 2 <= d <= 12 and type(w) is int and 1 <= w <= 3, 'Invalid strip units')
            require(all(type(row['selected']) is int and 0 <= row['selected'] <= d*w for row in diagram['rows']), 'Shading outside strip')
        else:
            raise ValueError('Unexpected fraction representation')
    def strip(n, d, unit):
        require(diagram is not None and diagram['kind'] == 'fraction-strips', 'Expected strip')
        require(diagram['parts'] == d and diagram['rows'][0]['selected'] == n and diagram['unit'] == unit, 'Strip contradicts question')
    if name == 'unit-piece-size':
        d, = match(r'One whole strip is divided into (\d+) equal pieces\. What fraction of the whole is one piece\?', prompt)
        strip(1, d, 'one whole')
        return Fraction(1, d)
    if name == 'fraction-unit-count':
        d, repeated = match(r'Each whole has (\d+) equal pieces\. How many 1/(\d+) pieces are shaded across all the strips\?', prompt)
        require(d == repeated, 'Inconsistent fractional unit')
        require(diagram is not None, 'Missing count diagram')
        count = diagram['rows'][0]['selected']
        strip(count, d, 'one whole')
        return count
    if name == 'fraction-line-position':
        d, = match(r'What number is at P\? Each whole interval has (\d+) equal steps\.', prompt)
        require(diagram['kind'] == 'rational-line' and diagram['denominator'] == d and diagram['unit'] == 'one whole', 'Line contradicts unit')
        require([p['label'] for p in diagram['points']] == ['P'], 'Missing P')
        return Fraction(diagram['points'][0]['numerator'], d)
    if name == 'fraction-whole-as-parts':
        whole, d = match(r'Write (\d+) wholes as \?/(\d+)\. What is the missing numerator\?', prompt)
        strip(whole*d, d, 'one whole')
        return whole*d
    if name == 'equivalent-numerator':
        n, d, target = match(r'Rename (\d+)/(\d+) as \?/(\d+)\. What is the missing numerator\?', prompt)
        result = Fraction(n, d)*target
        require(result.denominator == 1, 'Nonintegral target numerator')
        strip(result.numerator, target, 'one whole')
        return result
    if name == 'equivalent-denominator':
        n, d, target = match(r'Rename (\d+)/(\d+) as (\d+)/\?\. What is the missing denominator\?', prompt)
        return Fraction(target*d, n)
    if name == 'like-fraction-missing-part':
        n, d, total, target_d = match(r'(\d+)/(\d+) \+ \? = (\d+)/(\d+)\. What fraction is missing\?', prompt)
        require(d == target_d, 'Unlike units in like-unit task')
        return Fraction(total, d)-Fraction(n, d)
    if name == 'like-fraction-difference':
        a, d, b, other_d = match(r'A cord is (\d+)/(\d+) meter long\. You remove (\d+)/(\d+) meter\. How many meters remain\?', prompt)
        require(d == other_d and a >= b, 'Invalid like-unit subtraction')
        return Fraction(a-b, d)
    if name == 'mixed-to-improper-numerator':
        whole, n, d, target_d = match(r'Write (\d+) (\d+)/(\d+) as \?/(\d+)\. What is the numerator\?', prompt)
        require(d == target_d and 0 < n < d, 'Invalid mixed notation')
        strip(whole*d+n, d, 'one whole')
        return whole*d+n
    if name in {'improper-whole-part', 'improper-fractional-part'}:
        pattern = (r'How many complete wholes are in (\d+)/(\d+)\?' if name == 'improper-whole-part' else r'Remove all complete wholes from (\d+)/(\d+)\. What fraction of one whole remains\?')
        n, d = match(pattern, prompt)
        strip(n, d, 'one whole')
        return n//d if name == 'improper-whole-part' else Fraction(n % d, d)
    if name == 'mixed-fraction-difference':
        w, n, d, v, a, b = match(r'Find (\d+) (\d+)/(\d+) − (\d+) (\d+)/(\d+)\. Give a fraction or whole number\.', prompt)
        require(d == b and 0 < n < a < d and w > v, 'Expected canonical mixed numbers requiring regrouping')
        return w + Fraction(n, d) - v - Fraction(a, b)
    if name == 'unlike-fraction-difference':
        a, b, c, d = match(r'Find (\d+)/(\d+) − (\d+)/(\d+)\.', prompt)
        require(b != d, 'Expected unlike denominators')
        return Fraction(a, b)-Fraction(c, d)
    if name == 'fraction-distance-gap':
        d, = match(r'How many meters separate A and B\? Each meter has (\d+) equal steps\.', prompt)
        require(diagram['kind'] == 'rational-line' and diagram['unit'] == 'meters' and diagram['denominator'] == d, 'Distance unit mismatch')
        require([p['label'] for p in diagram['points']] == ['A', 'B'], 'Missing distance markers')
        return abs(Fraction(diagram['points'][1]['numerator']-diagram['points'][0]['numerator'], d))
    if name == 'whole-times-fraction':
        count, n, d = match(r'Each of (\d+) containers holds (\d+)/(\d+) liter\. How many liters do they hold altogether\?', prompt)
        strip(n, d, 'one liter')
        return count*Fraction(n, d)
    if name == 'whole-sharing-fraction':
        total, count = match(r'Share (\d+) liters equally among (\d+) people\. How many liters does each person receive\?', prompt)
        return Fraction(total, count)
    if name in {'unit-fraction-share', 'fraction-share-amount'}:
        n, d, count = match(r'Share (\d+)/(\d+) liter equally among (\d+) people\. How many liters does each person receive\?', prompt)
        strip(n, d, 'one liter')
        require((n == 1) if name == 'unit-fraction-share' else (n >= 2), 'Wrong sharing family numerator')
        return Fraction(n, d)/count
    if name == 'whole-unit-groups':
        d, total = match(r'How many 1/(\d+)-liter containers can be filled from (\d+) liters\?', prompt)
        strip(total*d, d, 'one liter')
        return Fraction(total, 1)/Fraction(1, d)
    if name == 'fraction-group-count':
        n, d, total, total_d = match(r'A container holds (\d+)/(\d+) liter\. How many containerfuls are in (\d+)/(\d+) liters\? Count a partial containerful as a fraction\.', prompt)
        require(d == total_d, 'Unexpected common-unit model')
        strip(total, d, 'one liter')
        require(len(diagram['rows']) == 2 and diagram['rows'][1]['selected'] == n, 'Container model disagrees with group size')
        return Fraction(total, total_d)/Fraction(n, d)
    if name == 'fraction-of-quantity':
        total, n, d = match(r'A jug holds (\d+) liters\. You use (\d+)/(\d+) of its water\. How many liters do you use\?', prompt)
        return Fraction(n, d)*total
    raise ValueError('Unimplemented fraction solver: '+name)
