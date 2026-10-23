"""Independent checks of the registered rational content: runtime, lessons, figures and printed sheets."""
import copy
import json
import re
import subprocess
from fractions import Fraction
from pathlib import Path
from inequality_math_oracle import PublicationParser, PublicationNode
from integer_exponent_math_oracle import numeric_exercises
from rational_math_oracle import (RATIONAL_TYPES, SKILLS, RationalCorpus, equalities, evaluate, power,
                                  require, review_explanation, solve_rational, fixture)

FACETS = {
    'signed-fraction-sum': 'signed-addition.signed-fraction-sums',
    'signed-fraction-product': 'signed-multiplication.signed-fraction-products',
    'complex-fraction': 'complex-fractions.numeric-complex-fractions',
    'rational-power': 'rational-exponents.rational-base-fractional-powers',
}
PLACEMENT = {
    'signed-addition': ('7', 'number', {'signed-numbers', 'fraction-addition'}),
    'signed-multiplication': ('7', 'number', {'signed-addition', 'fraction-division'}),
    'complex-fractions': ('7', 'fractions', {'fraction-division', 'signed-multiplication'}),
    'rational-exponents': ('algebra-2', 'algebra', {'exponent-laws', 'approximate-roots', 'factors-multiples'}),
}
FIGURES = {'signed-fraction-sum': 'signed-fraction-number-line', 'complex-fraction': 'complex-fraction-scaling',
           'rational-power': 'rational-power-ladder'}
VOCABULARY = ['numerator', 'denominator', 'equal parts', 'whole', 'integer', 'lowest terms', 'equivalent']


def check_problem(problem):
    public = problem['public']
    require(set(problem) == {'public', 'answer', 'hint', 'explanation'}, 'Unexpected private rational problem shape')
    require(not any(key in public for key in ('answer', 'hint', 'explanation')), 'Private grading content in public payload')
    answer = solve_rational(public)
    require(re.fullmatch(r'-?[1-9][0-9]*(?:/[1-9][0-9]*)?', problem['answer']) is not None, 'Answer is not an exact fraction string')
    given = Fraction(problem['answer'])
    require(given == answer and str(given) == problem['answer'], 'Incorrect or unreduced rational answer')
    return review_explanation(problem)


def check_manifest(record):
    require(record['kind'] == 'rational-manifest' and record['seeds'] == 1024 and record['editions'] == 16,
            'Wrong rational review manifest')
    templates = record['templates']
    require(len(templates) == 4 and {t['id'] for t in templates} == RATIONAL_TYPES, 'Missing or duplicate rational template')
    for t in templates:
        band = '9–12' if t['id'] == 'rational-power' else '6–8'
        require(t['version'] == 1 and t['skillId'] == SKILLS[t['id']] and t['gradeBand'] == band
                and 'requiredResponseCapability' not in t, 'Wrong rational template metadata')
    skills = {s['id']: s for s in record['skills']}
    require(set(skills) == set(PLACEMENT), 'Wrong rational skill inventory')
    for skill_id, (grade, strand, prerequisites) in PLACEMENT.items():
        skill = skills[skill_id]
        require(skill['gradeBand'] == grade and skill['strand'] == strand and set(skill['prerequisites']) == prerequisites,
                f'Wrong curriculum placement for {skill_id}')
    complex_skill = skills['complex-fractions']
    require([a['standardId'] for a in complex_skill['alignments']] == ['7.NS.A.3'], 'Complex fractions must align to 7.NS.A.3')
    expected = set(FACETS.items())
    require(record['coverageValid'] and len(record['mappings']) == 4 and
            {(m['templateId'], m['facetId']) for m in record['mappings']} == expected, 'Missing rational facet mappings')
    require(all(m['extent'] == 'partial' and m['rationale'].strip() for m in record['mappings']),
            'Unsupported complete rational coverage claim')
    require(len(record['bindings']) == 4 and {(m['templateId'], m['facetId']) for m in record['bindings']} == expected
            and all(m['skillId'] == SKILLS[m['templateId']] and not m['independentlyReviewed'] for m in record['bindings']),
            'Incorrect default rational coverage bindings')
    require({c['id'] for c in record['calculator']} == RATIONAL_TYPES and all(c['allowed'] is False for c in record['calculator']),
            'Exact fraction computation needs the calculator disabled')
    for template in RATIONAL_TYPES:
        method = record['methods'][template]
        require(method['goal'].strip() and method['terms'] and 1 <= len(method['method']) <= 4 and
                record['principles'][template].strip(), 'Missing attached rational teaching method')


def svg_root(record):
    parser = PublicationParser(); parser.feed(record['svg']); parser.close()
    found = [n for n in parser.root.descendants() if n.attributes.get('data-lesson-illustration') == record['kind']]
    require(len(found) == 1, 'Missing actual rational illustration')
    return found[0]


def text_value(text):
    return Fraction(text.strip().replace('−', '-'))


def check_figure(record):
    kind = record['kind']; figure = svg_root(record)
    if kind == 'complex-fraction-scaling':
        require(figure.tag == 'table', 'Scaling model needs an operation table')
        numerator, denominator, multiplier, result = (Fraction(figure.attributes[k]) for k in
                                                      ('data-numerator', 'data-denominator', 'data-multiplier', 'data-result'))
        require(multiplier == 1 / denominator and numerator * multiplier == result and denominator * multiplier == 1,
                'Scaling model arithmetic is wrong')
        rows = [n for n in figure.descendants() if 'data-operation-row' in n.attributes]
        require(len(rows) == 3, 'Missing scaling rows')
        cells = [[evaluate(n.text().strip().strip('$').replace('\\times', '', 1)) for n in row.children
                  if isinstance(n, PublicationNode) and n.tag == 'td'] for row in rows]
        require(cells == [[numerator, denominator], [multiplier, multiplier], [result, Fraction(1)]],
                'Displayed scaling cells contradict the exact model')
        return 3
    require(figure.tag == 'svg' and figure.attributes.get('role') == 'img' and figure.attributes.get('aria-label'),
            'Missing accessible rational SVG')
    view = list(map(float, figure.attributes['viewbox'].split()))
    require(len(view) == 4 and view[2] > 0 and view[3] > 0, 'Invalid rational viewBox')
    texts = [n for n in figure.descendants() if n.tag == 'text']
    for node in texts:
        require(view[0] <= float(node.attributes['x']) <= view[0] + view[2] and
                view[1] <= float(node.attributes['y']) <= view[1] + view[3], 'Rational label outside its viewBox')
    if kind == 'signed-fraction-number-line':
        unit, start, move, end = (int(figure.attributes[k]) for k in ('data-unit', 'data-start', 'data-move', 'data-end'))
        require(Fraction(start, unit) == Fraction(-3, 4) and Fraction(move, unit) == Fraction(5, 6) and start + move == end,
                'Number-line move contradicts -3/4 + 5/6')
        ticks = sorted((int(n.attributes['data-tick']), float(re.match(r'M ([0-9.]+) ', n.attributes['d'])[1]))
                       for n in figure.descendants() if 'data-tick' in n.attributes)
        require([k for k, _ in ticks] == list(range(-unit, unit + 1)), 'Number line needs every twelfth from -1 to 1')
        gaps = {round(b[1] - a[1], 6) for a, b in zip(ticks, ticks[1:])}
        require(len(gaps) == 1 and gaps.pop() > 0, 'Number-line ticks are not equally spaced')
        position = dict(ticks)
        dots = {n.attributes['data-point']: float(n.attributes['cx']) for n in figure.descendants() if 'data-point' in n.attributes}
        require(abs(dots['start'] - position[start]) < 1e-6 and abs(dots['end'] - position[end]) < 1e-6,
                'Number-line points are not at the stated twelfths')
        labels = [n.text().strip() for n in texts]
        require('+10/12' in labels and '−3/4 = −9/12' in labels and '1/12' in labels, 'Number-line labels changed')
        return len(ticks)
    require(kind == 'rational-power-ladder', 'Unknown rational figure')
    base = Fraction(figure.attributes['data-base'])
    rows = [n for n in figure.descendants() if 'data-exponent' in n.attributes]
    require(len(rows) == 6, 'Power ladder needs six rows')
    for index, row in enumerate(rows):
        exponent = text_value(row.attributes['data-exponent'])
        require(exponent == Fraction(3 - index, 3), 'Ladder exponents must fall by 1/3')
        value = power(base, exponent) if exponent else Fraction(1)
        shown = [n.text() for n in row.children if isinstance(n, PublicationNode) and n.tag == 'text']
        require(text_value(row.attributes['data-value']) == value and [text_value(s) for s in shown] == [exponent, value],
                'Displayed ladder values differ from exact powers')
    steps = [n.text().strip() for n in texts if n.text().strip().startswith('÷')]
    require(steps == ['÷ 2/3'] * 5 and power(base, Fraction(1, 3)) == Fraction(2, 3), 'Ladder step is not the cube root')
    return len(rows)


def check_lesson(record):
    lesson = record['lesson']; template = record['templateId']
    require(lesson['id'] == template and lesson['templateIds'] == [template], 'Missing standalone rational lesson')
    worked = lesson['workedExample']
    source = re.fullmatch(r'(?:Calculate|Simplify|Evaluate) \$(.+)\$\.', worked['prompt'])
    require(source is not None, 'Malformed worked prompt')
    answer = solve_rational(fixture(template, source[1]))
    require(evaluate(worked['answer'].strip('$')) == answer, 'Incorrect rational lesson worked answer')
    chains = [chain for step in worked['steps'] for chain in equalities(step)]
    require(any(chain[-1] == answer for chain in chains), 'Rational lesson lacks an exact derivation of its answer')
    prose = ' '.join(p for section in [*lesson['sections'], *lesson.get('closingSections', [])] for p in section['paragraphs'])
    for word in VOCABULARY + {'signed-fraction-sum': ['opposite', 'common denominator'],
                              'signed-fraction-product': ['reciprocal', 'sign'],
                              'complex-fraction': ['main fraction bar', 'reciprocal'],
                              'rational-power': ['root', 'exponent', 'reciprocal', 'positive']}[template]:
        require(word in prose.lower(), f'Missing standalone rational vocabulary: {word}')
    for paragraph in [p for section in [*lesson['sections'], *lesson.get('closingSections', [])] for p in section['paragraphs']]:
        for math in re.findall(r'\$([^$]+)\$', paragraph):
            if '=' in math and not re.search('[A-Za-z]', re.sub(r'\\[A-Za-z]+', '', math)):
                equalities('$' + math + '$')
    expected = [FIGURES[template]] if template in FIGURES else []
    require([f['kind'] for f in record['figures']] == expected, 'Rational lesson figures changed')
    for figure in record['figures']:
        check_figure(figure)
    parser = PublicationParser(); parser.feed(record['html']); parser.close()
    examples = [n for n in parser.root.descendants() if n.has_class('example')]
    require(len(examples) == 1 and worked['prompt'] in examples[0].text() and worked['answer'] in examples[0].text(),
            'Printed lesson loses the worked prompt or answer')
    return len(chains)


def check_worksheet(record):
    problems = record['problems']
    require(len(problems) == 12 and len({p['public']['prompt'] for p in problems}) == 12, 'Worksheet needs twelve distinct givens')
    require(problems == record['replayed'], 'Rational worksheet does not replay runtime problems')
    work, key = numeric_exercises(record['workbookHtml']), numeric_exercises(record['solutionsHtml'])
    answers = []
    for problem, blank, solution in zip(problems, work, key):
        public = problem['public']
        require(public['templateId'] == record['templateId'], 'Wrong rational worksheet template')
        check_problem(problem)
        require(blank['prompt'] == solution['prompt'] == public['prompt'], 'Printed prompt or order changed')
        require(blank['answer'] is None and not blank['steps'], 'Workbook exposes a solution')
        require(Fraction(solution['answer'].replace('−', '-')) == solve_rational(public) and solution['steps'] == problem['explanation'],
                'Printed answer or worked steps differ')
        answers.append(solve_rational(public))
    if record['templateId'] != 'rational-power':
        require(sum(a < 0 for a in answers) >= 3 and sum(a > 0 for a in answers) >= 3, 'Worksheet needs both result signs')
    require(sum(a.denominator > 1 for a in answers) >= 6, 'Worksheet needs fractional results')
    return len(problems)


def review_content_records(records):
    require(records and records[0]['kind'] == 'rational-manifest', 'Missing rational manifest')
    check_manifest(records[0]); corpus = RationalCorpus()
    seen, sheets, lessons, chains = set(), set(), set(), 0
    for record in records[1:]:
        template, kind = record['templateId'], record['kind']
        require(template in RATIONAL_TYPES, 'Unknown rational export template')
        if kind == 'rational-runtime':
            key = (template, record['index'])
            require(key not in seen and 0 <= record['index'] < 1024, 'Repeated or invalid rational runtime index')
            seen.add(key)
            require(record['problem'] == record['replayed'] and record['problem']['public']['seed'] == f'rational-review-{record["index"]}'
                    and record['problem']['public']['templateId'] == template, 'Rational runtime does not replay')
            chains += check_problem(record['problem']); corpus.record(record['problem']['public'])
        elif kind == 'rational-worksheet':
            key = (template, record['edition'])
            require(key not in sheets and record['edition'] in {str(i) for i in range(1, 17)}, 'Repeated or invalid worksheet edition')
            sheets.add(key); check_worksheet(record)
        elif kind == 'rational-lesson':
            require(template not in lessons, 'Repeated rational lesson'); lessons.add(template); chains += check_lesson(record)
        else:
            raise ValueError('Unknown rational content record')
    require(len(seen) == 4096 and len(sheets) == 64 and lessons == RATIONAL_TYPES, 'Incomplete rational content inventory')
    return {'runtime': corpus.finish(1024), 'worksheetEditions': len(sheets), 'lessons': len(lessons),
            'figures': len(FIGURES), 'checkedEqualityChains': chains}


def review_content_mutations(records):
    runtime = next(r for r in records if r['kind'] == 'rational-runtime')
    sheet = next(r for r in records if r['kind'] == 'rational-worksheet')
    lessons = {r['templateId']: r for r in records if r['kind'] == 'rational-lesson'}
    probes = []

    def probe(source, checker, change):
        checker(source)
        value = copy.deepcopy(source)
        change(value)
        require(value != source, 'Rational mutation did not change its target')
        probes.append((checker, value))

    def unreduced(problem):
        value = Fraction(problem['answer'])
        problem['answer'] = f'{value.numerator * 2}/{value.denominator * 2}'

    probe(runtime['problem'], check_problem, lambda p: p.__setitem__('answer', '999'))
    probe(runtime['problem'], check_problem, unreduced)
    probe(runtime['problem'], check_problem, lambda p: p['explanation'].__setitem__(2, 'Then $\\frac{1}{2} = \\frac{1}{3}$.'))
    probe(runtime['problem'], check_problem, lambda p: p['explanation'].pop())
    probe(runtime['problem'], check_problem, lambda p: p['public'].__setitem__('answer', '1'))
    probe(sheet, check_worksheet, lambda r: r['problems'].__setitem__(1, r['problems'][0]))
    probe(sheet, check_worksheet, lambda r: r.__setitem__('solutionsHtml', r['solutionsHtml'].replace('Answer: ', 'Answer: 999', 1)))
    probe(sheet, check_worksheet, lambda r: r.__setitem__('workbookHtml', r['solutionsHtml']))
    probe(sheet, check_worksheet, lambda r: r.__setitem__('workbookHtml', r['workbookHtml'].replace('class="writing"', 'class="writing" data-answer="1"', 1)))
    probe(lessons['complex-fraction'], check_lesson, lambda r: r['lesson']['workedExample'].__setitem__('answer', '$\\frac{3}{2}$'))
    def remove_equal_parts(record):
        lesson = record['lesson']
        sections = [*lesson['sections'], *lesson.get('closingSections', [])]
        require(any('equal parts' in p for section in sections for p in section['paragraphs']),
                'Missing vocabulary mutation target')
        for section in sections:
            section['paragraphs'] = [p.replace('equal parts', 'pieces') for p in section['paragraphs']]

    probe(lessons['signed-fraction-sum'], check_lesson, remove_equal_parts)
    probe(lessons['signed-fraction-sum'], check_lesson,
          lambda r: r['lesson']['closingSections'][0]['paragraphs'].append('A false check: $1 + 1 = 3$.'))
    line = lessons['signed-fraction-sum']['figures'][0]
    probe(line, check_figure, lambda r: r.__setitem__('svg', r['svg'].replace('data-end="1"', 'data-end="2"', 1)))
    probe(line, check_figure, lambda r: r.__setitem__('svg', re.sub(r'(data-point="end" cx=")([0-9.]+)', lambda m: m[1] + str(float(m[2]) + 20), r['svg'], count=1)))
    ladder = lessons['rational-power']['figures'][0]
    probe(ladder, check_figure, lambda r: r.__setitem__('svg', r['svg'].replace('>4/9<', '>4/3<', 1)))
    scaling = lessons['complex-fraction']['figures'][0]
    probe(scaling, check_figure, lambda r: r.__setitem__('svg', r['svg'].replace('data-result="5/16"', 'data-result="5/12"', 1)))
    probe(records[0], check_manifest, lambda r: r['mappings'][0].__setitem__('extent', 'complete'))
    probe(records[0], check_manifest, lambda r: next(s for s in r['skills'] if s['id'] == 'complex-fractions').__setitem__('strand', 'algebra'))
    probe(records[0], check_manifest, lambda r: r['calculator'][0].__setitem__('allowed', True))
    for checker, value in probes:
        try:
            checker(value)
        except (ValueError, KeyError, ZeroDivisionError, TypeError):
            continue
        raise ValueError('Rational review accepted a malformed content mutation')
    return len(probes)


def review_rational_content():
    app = Path(__file__).resolve().parents[1]
    result = subprocess.run(['node', '--import', 'tsx', 'scripts/rational-content-oracle.ts'], cwd=app,
                            text=True, capture_output=True, timeout=180)
    require(result.returncode == 0, 'Rational content exporter failed: ' + result.stderr)
    records = [json.loads(line) for line in result.stdout.splitlines()]
    report = review_content_records(records)
    report['rejectedContentMutations'] = review_content_mutations(records)
    return report


if __name__ == '__main__':
    print(json.dumps(review_rational_content()))
