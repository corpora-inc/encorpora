"""Inspect actual workbook/solution HTML for distinct cases and matching exact keys."""
import copy
import math
import re
import xml.etree.ElementTree as ET
from fractions import Fraction
from html.parser import HTMLParser
from right_triangle_math_oracle import (
    CONVERSE, MISSING_LEG, givens, require, solve_right_triangle,
)


class HtmlTree(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.root = ET.Element('document')
        self.stack = [self.root]
        self.feed(source)
        self.close()
        require(len(self.stack) == 1, 'Unclosed publication markup')

    def handle_starttag(self, tag, attrs):
        element = ET.SubElement(self.stack[-1], tag, dict(attrs))
        if tag not in {'br', 'hr', 'img', 'input', 'meta', 'link', 'wbr'}:
            self.stack.append(element)

    def handle_endtag(self, tag):
        require(len(self.stack) > 1 and self.stack[-1].tag == tag, 'Unbalanced publication markup')
        self.stack.pop()

    def handle_startendtag(self, tag, attrs):
        ET.SubElement(self.stack[-1], tag, dict(attrs))

    def handle_data(self, data):
        element = self.stack[-1]
        if len(element):
            element[-1].tail = (element[-1].tail or '')+data
        else:
            element.text = (element.text or '')+data


def readable(element):
    if element.get('aria-hidden') == 'true' or element.tag in {'annotation', 'style', 'script'}:
        return ''
    return (element.text or '')+''.join(readable(child)+(child.tail or '') for child in element)


def text(element):
    require(element is not None, 'Missing printed field')
    return ' '.join(readable(element).split())


def parse_publication(document):
    template = 'right-triangle' if document['lessonId'] == 'pythagorean-theorem' else document['lessonId']
    tree = HtmlTree(document['html']).root
    exercises = tree.findall(".//section[@class='exercise']")
    require(len(exercises) == 12, 'Each triangle sheet must have twelve exercises')
    result = []
    for index, exercise in enumerate(exercises, 1):
        heading = text(exercise.find('h2'))
        prefix = f'{index}. '
        require(heading.startswith(prefix), 'Printed exercise numbering is inconsistent')
        prompt = heading[len(prefix):]
        choices = exercise.find("ol[@class='print-choices']")
        labels = [text(option) for option in choices.findall('li')] if choices is not None else []
        if template == 'right-triangle':
            found = re.fullmatch(r'A right triangle has perpendicular legs ([1-9][0-9]*) cm and '
                                 r'([1-9][0-9]*) cm\. What is the hypotenuse length in centimeters\?', prompt)
            require(found is not None and not labels, 'Unexpected printed hypotenuse contract')
            values = tuple(sorted(map(int, found.groups())))
            square = sum(value*value for value in values)
            answer = math.isqrt(square)
            require(answer*answer == square, 'Printed integer hypotenuse is irrational')
        else:
            response = {'kind': 'number'} if template == MISSING_LEG else {
                'kind': 'choice', 'options': [{'id': f'option-{chr(97+i)}', 'label': label}
                                              for i, label in enumerate(labels)]}
            require(template == CONVERSE or not labels, 'Unexpected missing-leg choices')
            public = {'templateId': template, 'prompt': prompt, 'response': response}
            answer = solve_right_triangle(public)
            values = givens(public)
            if template == CONVERSE:
                values = tuple(sorted(values))
                answer = next(option['label'] for option in response['options'] if option['id'] == answer)
        answers = [text(node) for node in exercise.findall('.//strong') if text(node).startswith('Answer:')]
        if document['kind'] == 'solutions':
            require(len(answers) == 1, 'Missing or duplicate printed answer')
            printed = answers[0].removeprefix('Answer:').strip()
            require((printed == answer) if template == CONVERSE else (Fraction(printed) == answer),
                    'Printed solution disagrees with public givens')
        else:
            require(not answers, 'Workbook discloses a solution')
        result.append({'prompt': prompt, 'options': labels, 'identity': values})
    require(len({case['identity'] for case in result}) == 12, 'Printed triangle sheet repeats a mathematical case')
    return result


def check_publication_pairs(documents):
    lesson_ids = {'pythagorean-theorem', MISSING_LEG, CONVERSE}
    require(isinstance(documents, list) and len(documents) == 6, 'Missing triangle publication')
    lookup = {(doc['lessonId'], doc['kind']): doc for doc in documents}
    require(set(lookup) == {(lesson, kind) for lesson in lesson_ids for kind in ('workbook', 'solutions')},
            'Incomplete or duplicate triangle publication inventory')
    for lesson in lesson_ids:
        workbook = parse_publication(lookup[lesson, 'workbook'])
        solutions = parse_publication(lookup[lesson, 'solutions'])
        require(workbook == solutions, 'Workbook and solution questions/options do not match in order')
    return {'pairedSheets': 3, 'distinctExercisesPerSheet': 12, 'independentlySolvedPrintedAnswers': 36}


def review_right_triangle_publications(documents):
    report = check_publication_pairs(documents)
    broken_sets = []
    broken_sets.append(documents[:-1])
    for change in ('duplicate-question', 'wrong-answer', 'missing-question', 'mismatched-pair'):
        broken = copy.deepcopy(documents)
        document = next(doc for doc in broken if doc['lessonId'] == CONVERSE and doc['kind'] == 'solutions')
        chunks = re.findall(r'<section class="exercise">[\s\S]*?</section>', document['html'])
        require(len(chunks) == 12, 'Cannot construct publication mutation')
        replacement = chunks[0]
        if change == 'duplicate-question':
            replacement = re.sub(r'(<h2>)1\.', r'\g<1>2.', replacement, count=1)
            document['html'] = document['html'].replace(chunks[1], replacement, 1)
        elif change == 'wrong-answer':
            document['html'] = document['html'].replace('Answer: ', 'Answer: impossible ', 1)
        elif change == 'missing-question':
            document['html'] = document['html'].replace(chunks[0], '', 1)
        else:
            a = re.sub(r'(<h2>)1\.', r'\g<1>2.', chunks[0], count=1)
            b = re.sub(r'(<h2>)2\.', r'\g<1>1.', chunks[1], count=1)
            document['html'] = document['html'].replace(chunks[0], 'REVIEW_SWAP', 1).replace(chunks[1], a, 1).replace('REVIEW_SWAP', b, 1)
        broken_sets.append(broken)
    for broken in broken_sets:
        try:
            check_publication_pairs(broken)
        except ValueError:
            continue
        raise ValueError('Accepted corrupted printed worksheet/solutions')
    return report | {'rejectedPublicationMutations': len(broken_sets)}


def check_coverage_defaults(coverage):
    expected = {'integer-hypotenuse': 'right-triangle', 'integer-missing-leg': MISSING_LEG,
                'integer-converse': CONVERSE}
    for name in ('defaults', 'explicitEmpty'):
        manifest = coverage[name]
        require(manifest['valid'] and not manifest['errors'], f'Invalid default coverage: {name}')
        require(len(manifest['skills']) == 1 and manifest['skills'][0]['id'] == 'pythagorean-theorem',
                'Missing right-triangle skill coverage')
        skill = manifest['skills'][0]
        require(skill['fullyCovered'] is False and skill['allDeclaredFacetsReviewed'] is False,
                'Facet links cannot certify whole-skill coverage')
        facets = {facet['id']: facet for facet in skill['facets']}
        for suffix, template in expected.items():
            facet = facets.get(f'pythagorean-theorem.{suffix}')
            require(facet is not None and facet['templateIds'] == [template],
                    f'Missing or incorrect default facet mapping: {name}/{suffix}')
            require(facet['independentlyReviewed'] is False, 'A mapping is not independent review evidence')
    duplicate = coverage['duplicateInput']
    require(duplicate['valid'] is False and any('Duplicate facet mapping:' in error for error in duplicate['errors']),
            'Duplicate supplied mappings must remain errors')
    custom = coverage['customEmpty']
    require(custom['valid'] and not custom['errors'] and not custom['skills'],
            'Custom empty catalog must not inherit default facet mappings')


def review_right_triangle_coverage(coverage):
    check_coverage_defaults(coverage)
    broken_sets = []
    broken = copy.deepcopy(coverage)
    broken['explicitEmpty']['skills'] = []
    broken_sets.append(broken)
    broken = copy.deepcopy(coverage)
    for facet in broken['defaults']['skills'][0]['facets']:
        if facet['id'].endswith('.integer-missing-leg'):
            facet['templateIds'] = ['right-triangle']
    broken_sets.append(broken)
    broken = copy.deepcopy(coverage)
    broken['duplicateInput']['valid'] = True
    broken_sets.append(broken)
    broken = copy.deepcopy(coverage)
    broken['customEmpty']['errors'] = ['Unexpected default mapping']
    broken_sets.append(broken)
    broken = copy.deepcopy(coverage)
    broken['defaults']['skills'][0]['fullyCovered'] = True
    broken_sets.append(broken)
    for broken in broken_sets:
        try:
            check_coverage_defaults(broken)
        except ValueError:
            continue
        raise ValueError('Accepted incorrect facet defaults or coverage claims')
    return {'defaultCalls': 2, 'mappedFacetsPerCall': 3, 'rejectedCoverageMutations': len(broken_sets)}
