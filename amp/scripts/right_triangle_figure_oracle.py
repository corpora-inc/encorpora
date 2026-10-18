"""Check actual rendered teaching diagrams with exact geometry, not renderer helpers."""
import copy
import json
import math
import re
import subprocess
import xml.etree.ElementTree as ET
from fractions import Fraction as F
from pathlib import Path
from right_triangle_publication_oracle import review_right_triangle_publications, review_right_triangle_coverage
from right_triangle_math_oracle import (
    require, PATTERNS, CONVERSE, triangle_class, review_converse_explanation,
)


def check_worked_examples(lessons):
    expected_ids = {'pythagorean-theorem', 'right-triangle-missing-leg', 'pythagorean-converse'}
    require(isinstance(lessons, list) and len(lessons) == 3 and
            {lesson['id'] for lesson in lessons} == expected_ids, 'Missing right-triangle worked lesson')
    for lesson in lessons:
        example = lesson['workedExample']
        prompt, answer = example['prompt'], example['answer']
        require(isinstance(example['steps'], list) and example['steps'] and
                all(isinstance(step, str) and step for step in example['steps']), 'Missing worked steps')
        if lesson['id'] == 'pythagorean-theorem':
            found = re.fullmatch(r'A right triangle has legs of ([1-9][0-9]*) cm and ([1-9][0-9]*) cm\. '
                                 r'Find its hypotenuse length\.', prompt)
            require(found is not None, 'Ambiguous hypotenuse worked prompt')
            a, b = map(int, found.groups())
            square = a*a+b*b
        elif lesson['id'] == 'right-triangle-missing-leg':
            found = re.fullmatch(r'A right triangle has a hypotenuse of ([1-9][0-9]*) cm and one leg of '
                                 r'([1-9][0-9]*) cm\. Find the other leg\.', prompt)
            require(found is not None, 'Ambiguous missing-leg worked prompt')
            c, a = map(int, found.groups())
            require(c > a, 'Worked hypotenuse must exceed the known leg')
            square = c*c-a*a
        else:
            found = re.fullmatch(PATTERNS[CONVERSE], prompt)
            require(found is not None, 'Ambiguous converse worked prompt')
            category = triangle_class(tuple(map(int, found.groups())))
            expected = 'Right triangle' if category == 'right' else 'Not a right triangle'
            require(answer == expected and not example.get('answerUnit'), 'Wrong converse worked answer')
            review_converse_explanation({'templateId': CONVERSE, 'prompt': prompt}, example['steps'])
            continue
        root = math.isqrt(square)
        require(root*root == square and F(answer) == root, 'Wrong exact worked length')
        require(example.get('answerUnit') in ('cm', 'centimeters'), 'Worked length must have a separate length unit')


def vertices(polygon):
    points = [tuple(map(F, point.split(','))) for point in polygon.attrib['points'].split()]
    require(len(points) in (3, 4) and all(len(point) == 2 for point in points), 'Invalid polygon vertices')
    return points


def edges(points):
    return list(zip(points, points[1:]+points[:1]))


def area(points):
    return abs(sum(a[0]*b[1]-a[1]*b[0] for a, b in edges(points)))/2


def side_squares(points):
    return sorted((a[0]-b[0])**2+(a[1]-b[1])**2 for a, b in edges(points))


def disjoint_interiors(left, right):
    # Separating-axis theorem for these convex polygons; touching boundaries are allowed.
    for a, b in edges(left)+edges(right):
        normal = (a[1]-b[1], b[0]-a[0])
        lp = [x*normal[0]+y*normal[1] for x, y in left]
        rp = [x*normal[0]+y*normal[1] for x, y in right]
        if max(lp) <= min(rp) or max(rp) <= min(lp):
            return True
    return False


def check_orientation(root):
    both = []
    for name in ('original', 'rotated'):
        svg = root.find(f".//svg[@data-lesson-illustration='right-triangle-orientation-{name}']")
        require(svg is not None and svg.get('role') == 'img' and svg.get('aria-label'),
                'Missing accessible orientation panel')
        group = svg.find(f"g[@data-triangle='{name}']")
        require(group is not None and len(group.findall('polygon')) == 1, 'Missing orientation triangle')
        points = vertices(group.find('polygon'))
        require(side_squares(points) == [14400, 25600, 40000], 'Orientation must depict proportional 6–8–10 lengths')
        labels = [''.join(node.itertext()).strip() for node in group.findall('text')]
        require(all(label in labels for label in ('leg: 8 cm', 'leg', '6 cm', 'hypotenuse', '? cm')),
                'Missing or contradictory orientation side labels')
        marker = group.find('path')
        require(marker is not None, 'Missing right-angle marker')
        found = re.fullmatch(r'M([0-9]+) ([0-9]+) ([HV])([0-9]+) ([HV])([0-9]+)', marker.attrib['d'])
        require(found is not None and found[3] != found[5], 'Unsupported right-angle marker')
        first = [F(found[1]), F(found[2])]
        middle = first.copy()
        middle[0 if found[3] == 'H' else 1] = F(found[4])
        last = middle.copy()
        last[0 if found[5] == 'H' else 1] = F(found[6])
        corner, end_a, end_b = points
        u = [first[i]-corner[i] for i in range(2)]
        v = [last[i]-corner[i] for i in range(2)]
        require(sum(u[i]*v[i] for i in range(2)) == 0
                and sum(x*x for x in u) == sum(x*x for x in v) > 0
                and all(middle[i] == first[i]+last[i]-corner[i] for i in range(2)),
                'Right-angle marker does not mark a square at the triangle corner')
        for endpoint in (first, last):
            require(any((endpoint[0]-corner[0])*(end[1]-corner[1]) ==
                        (endpoint[1]-corner[1])*(end[0]-corner[0]) and
                        0 < sum((endpoint[i]-corner[i])*(end[i]-corner[i]) for i in range(2)) <
                        sum((end[i]-corner[i])**2 for i in range(2)) for end in (end_a, end_b)),
                    'Marker endpoint must lie inside a leg')
        both.append(points)
    sums = {(a[0]+b[0], a[1]+b[1]) for a, b in zip(*both)}
    require(len(sums) == 1, 'The second triangle must be a half-turn of the first')


def check_rearrangement(root):
    for name, expected_areas in [('hypotenuse', [25]), ('legs', [9, 16])]:
        svg = root.find(f".//svg[@data-lesson-illustration='pythagorean-{name}']")
        require(svg is not None and svg.get('role') == 'img' and svg.get('aria-label'), 'Missing accessible rearrangement')
        triangles = [vertices(node) for node in svg.findall('polygon') if 'data-proof-triangle' in node.attrib]
        squares = [vertices(node) for node in svg.findall('polygon') if 'data-square' in node.attrib]
        require(len(triangles) == 4 and len(squares) == len(expected_areas), 'Wrong proof piece inventory')
        pieces = triangles+squares
        require(all(24 <= x <= 304 and 66 <= y <= 346 for piece in pieces for x, y in piece),
                'Proof piece extends outside the shared 7-by-7 square')
        for points in triangles:
            require(side_squares(points) == [9*1600, 16*1600, 25*1600] and area(points) == 6*1600,
                    'Every proof triangle must be congruent with legs3 and4 and area6')
        require(sorted(area(points)/1600 for points in squares) == expected_areas, 'Uncovered areas contradict labels')
        for points in squares:
            lengths = side_squares(points)
            require(len(set(lengths)) == 1 and area(points) == lengths[0], 'Uncovered quadrilateral must be a square')
        require(sum(map(area, pieces)) == 49*1600, 'Pieces do not fill the outer square')
        require(all(disjoint_interiors(left, right) for i, left in enumerate(pieces) for right in pieces[i+1:]),
                'Proof pieces overlap')
        labels = [''.join(node.itertext()).strip() for node in svg.findall('text')]
        required = ['Outer side: 7 cm (a + b)', 'Uncovered area: 25 cm²']
        required += ['c² = 25', 'Side c = 5'] if name == 'hypotenuse' else ['a² = 9', 'b² = 16', 'Sides a = 3 and b = 4']
        require(all(label in labels for label in required), 'Proof labels contradict exact geometry')


def review_right_triangle_figures():
    amp = Path(__file__).resolve().parent.parent
    result = subprocess.run(['node', '--import', 'tsx', 'scripts/export-right-triangle-review.ts'],
                            cwd=amp, check=True, capture_output=True, text=True)
    data = json.loads(result.stdout)
    require(data['format'] == 1, 'Unsupported diagram export')
    check_worked_examples(data['lessons'])
    publications = review_right_triangle_publications(data['publications'])
    coverage = review_right_triangle_coverage(data['coverage'])
    orientation = ET.fromstring(data['illustrations']['orientation'])
    rearrangement = ET.fromstring(data['illustrations']['rearrangement'])
    check_orientation(orientation)
    check_rearrangement(rearrangement)
    mutations = []
    broken = copy.deepcopy(orientation)
    broken.find(".//g[@data-triangle='original']/polygon").set('points', '90,190 250,190 90,60')
    mutations.append((check_orientation, broken))
    broken = copy.deepcopy(orientation)
    broken.find('.//path').set('d', 'M90 164 H106 V190')
    mutations.append((check_orientation, broken))
    broken = copy.deepcopy(orientation)
    broken.find('.//text').text = 'leg: 10 cm'
    mutations.append((check_orientation, broken))
    for change in ('missing', 'overlap', 'wrong-square', 'wrong-label'):
        broken = copy.deepcopy(rearrangement)
        svg = broken.find('.//svg')
        triangles = svg.findall('polygon[@data-proof-triangle]')
        if change == 'missing':
            svg.remove(triangles[0])
        elif change == 'overlap':
            triangles[0].set('points', triangles[1].get('points'))
        elif change == 'wrong-square':
            svg.find('polygon[@data-square]').set('points', '184,66 304,226 144,346 24,185')
        else:
            svg.findall('text')[2].text = 'c² = 24'
        mutations.append((check_rearrangement, broken))
    for check, broken in mutations:
        try:
            check(broken)
        except ValueError:
            continue
        raise ValueError('Accepted corrupted teaching geometry')
    lesson_mutations = []
    for index in range(3):
        broken = copy.deepcopy(data['lessons'])
        broken[index]['workedExample']['answer'] = '-999'
        lesson_mutations.append(broken)
    lesson_mutations.append(data['lessons'][:-1])
    for broken in lesson_mutations:
        try:
            check_worked_examples(broken)
        except ValueError:
            continue
        raise ValueError('Accepted a missing or incorrect worked lesson')
    return {'orientationTriangles': 2, 'congruentProofTriangles': 8,
            'uncoveredSquares': 3, 'rejectedGeometryMutations': len(mutations),
            'workedExamples': 3, 'rejectedWorkedExampleMutations': len(lesson_mutations),
            'publications': publications, 'coverage': coverage}


if __name__ == '__main__':
    print(json.dumps(review_right_triangle_figures()))
