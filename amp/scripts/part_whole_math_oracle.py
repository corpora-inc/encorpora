"""Independent part-whole oracle: shares, equal-area parts and fraction
comparison derived only from the public prompt, figure geometry and option
labels. It never reads a generated answer or explanation."""
import re
from fractions import Fraction

PART_WHOLE = frozenset({
    'find-equal-shares', 'name-equal-share', 'larger-share',
    'find-equal-thirds', 'name-share', 'same-share-different-shape',
    'equal-area-fraction', 'equal-area-part-size',
    'compare-like-denominators', 'compare-like-numerators', 'compare-unlike-fractions',
})
WORDS = {'one': 1, 'two': 2, 'three': 3, 'four': 4}
UNITS = {'half': 2, 'halves': 2, 'third': 3, 'thirds': 3, 'quarter': 4, 'quarters': 4}
BOXES = {'rectangle': (170, 110), 'square': (130, 130), 'circle': (140, 140)}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def match(pattern, text):
    found = re.fullmatch(pattern, text)
    require(found is not None, f'Unrecognized part-whole wording: {text!r}')
    return found.groups()


def triangle(a, b, c):
    return abs((b[0]-a[0])*(c[1]-a[1]) - (c[0]-a[0])*(b[1]-a[1])) / 2


def part_areas(shape):
    """Area of each part from the cut geometry, in exact Fractions."""
    kind, cut, sizes = shape['shape'], shape['cut'], shape['sizes']
    require(kind in BOXES, 'Unknown shape')
    require(all(type(s) is int and s > 0 for s in sizes), 'Positive integer weights')
    w, h = BOXES[kind]
    total = sum(sizes)
    if cut == 'sectors':
        require(kind == 'circle', 'Sectors belong to circles')
        r = Fraction(w, 2)
        # Sector area = (angle / full turn) × circle area; keep π symbolic.
        return [Fraction(s, total) * r * r for s in sizes]
    require(kind != 'circle', 'Circles are cut into sectors')
    if cut in ('columns', 'rows'):
        return [Fraction(s, total) * w * h for s in sizes]
    corners = [(0, 0), (w, 0), (w, h), (0, h)]
    centre = (Fraction(w, 2), Fraction(h, 2))
    if cut == 'grid':
        require(len(sizes) == 4, 'Grid makes four parts')
        return [Fraction(w * h, 4)] * 4
    if cut == 'diagonal':
        require(len(sizes) == 2, 'A diagonal makes two parts')
        return [Fraction(triangle(corners[0], corners[1], corners[2])),
                Fraction(triangle(corners[0], corners[2], corners[3]))]
    if cut == 'diagonals':
        require(len(sizes) == 4 and kind == 'square', 'Both diagonals of a square')
        return [Fraction(triangle(corners[i], corners[(i+1) % 4], centre)) for i in range(4)]
    raise ValueError('Unknown cut')


def equal_parts(shape):
    areas = part_areas(shape)
    return len(set(areas)) == 1, len(areas)


def shaded_share(shape):
    areas = part_areas(shape)
    shaded = shape['shaded']
    require(len(set(shaded)) == len(shaded) and all(0 <= i < len(areas) for i in shaded), 'Shaded parts')
    return sum((areas[i] for i in shaded), Fraction(0)) / sum(areas)


def choose(public, predicate):
    response = public['response']
    require(response['kind'] == 'choice', 'Choice response required')
    options = response['options']
    require(len({o['label'] for o in options}) == len(options), 'Duplicate labels')
    good = [o['id'] for o in options if predicate(o['label'])]
    require(len(good) == 1, f'Exactly one correct option required: {public["prompt"]!r}')
    return good[0]


def share_value(label):
    found = re.fullmatch(r'(one|two|three|four) (half|halves|third|thirds|quarter|quarters)', label)
    require(found is not None, f'Share label {label!r}')
    count, unit = found.groups()
    require((WORDS[count] == 1) == (unit in ('half', 'third', 'quarter')), 'Share agreement')
    return Fraction(WORDS[count], UNITS[unit])


def solve_part_whole(public):
    template, prompt = public['templateId'], public['prompt']
    require(template in PART_WHOLE, 'Unknown part-whole family')
    figure = public.get('figure')
    if template in ('find-equal-shares', 'find-equal-thirds'):
        (unit,) = match(r'Which shape is cut into (halves|thirds|quarters)\?', prompt)
        n = UNITS[unit]
        require(n in ((2, 4) if template == 'find-equal-shares' else (2, 3, 4)), 'Target share')
        require(figure['kind'] == 'partitioned-shapes' and len(figure['shapes']) == 3, 'Three shapes')
        fits = [s['label'] for s in figure['shapes'] if equal_parts(s) == (True, n)]
        require(len(fits) == 1, 'Exactly one shape shows the share')
        return choose(public, lambda label: label == f'Shape {fits[0]}')
    if template in ('name-equal-share', 'name-share'):
        noun, again = match(r'The (rectangle|square|circle) is cut into equal parts\. How much of the (rectangle|square|circle) is shaded\?', prompt)
        require(noun == again, 'One shape named')
        require(figure['kind'] == 'partitioned-shapes' and len(figure['shapes']) == 1, 'One shape')
        shape = figure['shapes'][0]
        require(shape['shape'] == noun, 'Prompt names the drawn shape')
        equal, n = equal_parts(shape)
        require(equal and n in ((2, 4) if template == 'name-equal-share' else (2, 3, 4)), 'Equal halves, thirds or quarters')
        value = shaded_share(shape)
        require(value > 0, 'Something is shaded')
        return choose(public, lambda label: share_value(label) == value)
    if template == 'larger-share':
        (ask,) = match(r'Shapes A and B are the same size\. Which shaded piece is (larger|smaller): one half or one quarter\?', prompt)
        shapes = figure['shapes']
        require(len(shapes) == 2 and shapes[0]['shape'] == shapes[1]['shape'], 'Two same-size shapes')
        shares = {}
        for s in shapes:
            equal, n = equal_parts(s)
            require(equal and len(s['shaded']) == 1, 'One shaded equal part')
            shares[n] = shaded_share(s)
        require(set(shares) == {2, 4}, 'One half and one quarter')
        target = max(shares.values()) if ask == 'larger' else min(shares.values())
        names = {Fraction(1, 2): 'one half', Fraction(1, 4): 'one quarter'}
        return choose(public, lambda label: label == names[target])
    if template == 'same-share-different-shape':
        (plural,) = match(r'(Squares|Rectangles) A and B are the same size\. Which is true about their shaded parts\?', prompt)
        shapes = figure['shapes']
        require(len(shapes) == 2 and all(s['shape'] == plural[:-1].lower() for s in shapes), 'Two same-size wholes')
        require(shapes[0]['cut'] != shapes[1]['cut'], 'Different cuts')
        a, b = (shaded_share(s) for s in shapes)
        require(all(equal_parts(s)[0] and len(s['shaded']) == 1 for s in shapes), 'One shaded equal part each')
        truth = {"A's shaded part is larger.": a > b, "B's shaded part is larger.": b > a,
                 'They are the same amount.': a == b}
        return choose(public, lambda label: truth.get(label, False))
    if template in ('equal-area-fraction', 'equal-area-part-size'):
        require(figure['kind'] == 'area-partition', 'Area partition')
        columns, rows, regions = figure['columns'], figure['rows'], figure['regions']
        require(len(regions) == columns * rows, 'Every unit square belongs to a part')
        counts = {}
        for r in regions:
            counts[r] = counts.get(r, 0) + 1
        require(len(set(counts.values())) == 1 and len(counts) >= 2, 'Equal-area parts')
        connected(columns, rows, regions)
        shaded = sum(counts[r] for r in figure['shaded'])
        require(len(figure['shaded']) == 1, 'One shaded part')
        if template == 'equal-area-fraction':
            match(r"The rectangle is split into parts with equal area\. What fraction of the rectangle's area is the shaded part\?", prompt)
            require(figure['units'] is True, 'Unit squares drawn')
            return Fraction(shaded, columns * rows)
        (area,) = match(r"The rectangle's area is ([0-9]+) square units\. It is split into parts with equal area\. What is the area of the shaded part, in square units\?", prompt)
        require(int(area) == columns * rows, 'Stated area matches the unit grid')
        return Fraction(int(area) * shaded, columns * rows)
    ask, a, b, c, d = match(r'Which is (greater|less): ([0-9]+)/([0-9]+) or ([0-9]+)/([0-9]+) of the same whole\? Enter that fraction\.', prompt)
    a, b, c, d = map(int, (a, b, c, d))
    x, y = Fraction(a, b), Fraction(c, d)
    require(x != y and b > 0 and d > 0, 'Two different fractions')
    if template == 'compare-like-denominators':
        require(b == d and a != c, 'Same denominator')
    elif template == 'compare-like-numerators':
        require(a == c and b != d, 'Same numerator')
    else:
        require(a != c and b != d and a < b and c < d, 'Unlike proper fractions')
    require(figure['kind'] == 'fraction-bars' and [bar['parts'] for bar in figure['bars']] == [b, d], 'Bars show both wholes')
    require(all(bar['shaded'] == 0 for bar in figure['bars']), 'The figure does not shade the answer')
    return max(x, y) if ask == 'greater' else min(x, y)


def connected(columns, rows, regions):
    for region in set(regions):
        cells = {i for i, r in enumerate(regions) if r == region}
        start = next(iter(cells))
        seen, stack = {start}, [start]
        while stack:
            i = stack.pop()
            row, column = divmod(i, columns)
            for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                rr, cc = row + dr, column + dc
                j = rr * columns + cc
                if 0 <= rr < rows and 0 <= cc < columns and j in cells and j not in seen:
                    seen.add(j)
                    stack.append(j)
        require(seen == cells, 'Each part is one connected region')


def review_part_whole_fixtures():
    """Hand-built cases with known answers, including rejected distractor shapes."""
    square_diagonals = {'shape': 'square', 'cut': 'diagonals', 'sizes': [1, 1, 1, 1], 'shaded': [0]}
    require(equal_parts(square_diagonals) == (True, 4), 'Square diagonals make quarters')
    require(shaded_share(square_diagonals) == Fraction(1, 4), 'One diagonal quarter')
    require(equal_parts({'shape': 'rectangle', 'cut': 'columns', 'sizes': [1, 2], 'shaded': []}) == (False, 2), 'Unequal halves rejected')
    require(shaded_share({'shape': 'circle', 'cut': 'sectors', 'sizes': [1, 1, 1], 'shaded': [0, 2]}) == Fraction(2, 3), 'Two thirds of a circle')
    require(share_value('three quarters') == Fraction(3, 4) and share_value('one half') == Fraction(1, 2), 'Share names')
    public = {'templateId': 'compare-unlike-fractions',
              'prompt': 'Which is greater: 3/4 or 2/3 of the same whole? Enter that fraction.',
              'figure': {'kind': 'fraction-bars', 'bars': [{'parts': 4, 'shaded': 0, 'label': '3/4'}, {'parts': 3, 'shaded': 0, 'label': '2/3'}]},
              'response': {'kind': 'fraction', 'label': 'Fraction'}}
    require(solve_part_whole(public) == Fraction(3, 4), '3/4 > 2/3')
    try:
        connected(3, 2, [0, 1, 0, 1, 1, 1])
    except ValueError:
        pass
    else:
        raise ValueError('A split region must be rejected')
