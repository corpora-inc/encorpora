"""Independent checks of actual radical problems and publication markup."""
import copy
import re
import json
import subprocess
from pathlib import Path
from collections import Counter
from radical_math_oracle import require, square_part, rational, root, divide_by_monomial
from radical_public_oracle import RADICAL_TYPES, public_target, solve_radical, read_choice, tex_value
from inequality_math_oracle import PublicationParser, PublicationNode


def equalities(text):
    """Verify every explicit numeric equality in a generated worked step."""
    results = []
    for source in re.findall(r'\$([^$]+)\$', text):
        if '=' not in source:
            continue
        pieces = source.split('=')
        values = [tex_value(piece.strip()) for piece in pieces]
        require(all(value == values[0] for value in values), 'False radical equality')
        results.append(values[-1])
    return results


def check_problem(problem):
    public = problem['public']
    require(public.get('templateVersion') == 1 and public.get('skillId') == 'rational-exponents',
            'Wrong radical problem version or skill')
    require(not any(key in public for key in ('answer', 'hint', 'explanation', 'choiceFeedback')),
            'Private grading content in public radical payload')
    answer = solve_radical(public)
    target = public_target(public)
    if target:
        signature = lambda value: frozenset((r, c > 0) for r, c in value.items())
        alternatives = [read_choice(o['label']) for o in public['response']['options'] if o['id'] != answer]
        require(any(signature(value) == signature(target) for value in alternatives),
                'Radical support/sign identifies answer without coefficient work')
    require(problem['answer'] == answer, 'Mismatch: incorrect radical answer')
    require(isinstance(problem.get('hint'), str) and problem['hint'].strip(), 'Missing radical hint')
    steps = problem.get('explanation')
    require(isinstance(steps, list) and len(steps) >= 2 and all(isinstance(s, str) and s.strip() for s in steps),
            'Missing explicit radical worked steps')
    checked = [value for step in steps for value in equalities(step)]
    if any('Both simplified terms are whole numbers' in step for step in steps):
        require(not any(c < 0 for value in checked for c in value.values()),
                'Negative integers described as whole numbers')
    stated = [tex_value(source) for step in steps[-2:]
              for source in re.findall(r'\$([^$]+)\$', step) if '=' not in source]
    require(checked and public_target(public) in checked + stated,
            'No checked derivation or verification identifies the requested radical value')
    options = {option['id'] for option in public['response']['options']}
    feedback = problem.get('choiceFeedback', {})
    require(set(feedback) == options - {answer} and all(isinstance(t, str) and t.strip() for t in feedback.values()),
            'Missing or extraneous radical choice feedback')
    for text in feedback.values():
        equalities(text)
    return len(checked)


def exercises(html):
    parser = PublicationParser(); parser.feed(html); parser.close()
    result = []
    for index, section in enumerate((n for n in parser.root.descendants() if n.has_class('exercise')), 1):
        children = [n for n in section.children if isinstance(n, PublicationNode)]
        nodes = list(section.descendants())
        require(not any(n.tag in ('script', 'input') or 'data-answer' in n.attributes or 'data-correct' in n.attributes for n in nodes),
                'Unexpected answer metadata in publication exercise')
        require([n.tag for n in children] in (['h2', 'ol', 'div'], ['h2', 'ol', 'ol', 'p']),
                'Malformed radical exercise structure')
        heading = children[0].text()
        require(heading.startswith(f'{index}. '), 'Incorrect exercise numbering')
        choices = children[1]
        require(choices.has_class('print-choices') and choices.attributes.get('type') == 'A',
                'Missing printed radical choices')
        def items(node):
            values = [n for n in node.children if isinstance(n, PublicationNode)]
            require(values and all(n.tag == 'li' for n in values), 'Malformed printed list')
            return [n.text().strip() for n in values]
        answer, steps = None, []
        if children[2].tag == 'div':
            require(children[2].has_class('writing') and not children[2].children,
                    'Workbook writing space leaks a solution')
        else:
            steps = items(children[2])
            strong = [n for n in children[3].children if isinstance(n, PublicationNode)]
            require(len(strong) == 1 and strong[0].tag == 'strong' and strong[0].text().startswith('Answer: '),
                    'Missing printed radical answer')
            answer = strong[0].text().removeprefix('Answer: ').strip()
        result.append({'prompt': heading[len(f'{index}. '):], 'choices': items(choices),
                       'steps': steps, 'answer': answer})
    require(len(result) == 12, 'Require twelve printed radical exercises')
    return result


def categories(public):
    target = public_target(public)
    radicands = [int(n) for n in re.findall(r'\\sqrt\{([0-9]+)\}', public['prompt'])]
    tags = set()
    if not target: tags.add('zero')
    elif set(target) == {1}: tags.add('rational')
    else: tags.add('irrational')
    if len(target) > 1: tags.add('unlike-terms')
    if any(c < 0 for c in target.values()): tags.add('negative-coefficient')
    if any(c.denominator > 1 for c in target.values()): tags.add('fractional-coefficient')
    if any(n > 1 and square_part(n)[0] == 1 for n in radicands): tags.add('square-free-given')
    if any(n > 1 and square_part(n)[1] == 1 for n in radicands): tags.add('perfect-square-given')
    if any(square_part(n)[0] > 1 and square_part(n)[1] > 1 for n in radicands): tags.add('reducible-irrational-given')
    return tags


REQUIRED_VARIETY = {
    'simplify-square-root': {'zero', 'rational', 'square-free-given', 'reducible-irrational-given'},
    'combine-square-roots': {'zero', 'rational', 'irrational', 'unlike-terms', 'negative-coefficient'},
    'multiply-square-roots': {'rational', 'irrational', 'negative-coefficient'},
    'rationalize-radical-denominator': {'irrational', 'negative-coefficient', 'fractional-coefficient'},
}


def check_worksheet(record):
    problems = record['problems']
    require(len(problems) == 12 and len({p['public']['prompt'] for p in problems}) == 12,
            'Worksheet requires twelve distinct radical givens')
    require(problems == record['replayed'], 'Radical worksheet does not replay runtime problems')
    workbook, solutions = exercises(record['workbookHtml']), exercises(record['solutionsHtml'])
    tags, chains = set(), 0
    for problem, blank, worked in zip(problems, workbook, solutions):
        public = problem['public']
        require(public['templateId'] == record['templateId'], 'Wrong radical worksheet template')
        chains += check_problem(problem)
        tags.update(categories(public))
        require(blank['prompt'] == worked['prompt'] == public['prompt'], 'Printed radical prompt/order changed')
        labels = [option['label'] for option in public['response']['options']]
        require(blank['choices'] == worked['choices'] == labels, 'Printed radical choices/order changed')
        require(blank['answer'] is None and not blank['steps'], 'Workbook exposes a radical solution')
        require(worked['steps'] == problem['explanation'], 'Printed radical steps differ from app')
        require(read_choice(worked['answer']) == public_target(public), 'Incorrect printed radical answer')
    require(REQUIRED_VARIETY[record['templateId']] <= tags, 'Missing radical worksheet interpretation')
    return chains


class RadicalCorpus:
    """Coverage and named choice/prompt cues; not a universal shortcut proof."""
    def __init__(self):
        self.counts = Counter()
        self.variety = {template: set() for template in RADICAL_TYPES}
        self.cues = {template: {} for template in RADICAL_TYPES}

    def record(self, public):
        template = public['templateId']; options = public['response']['options']
        answer = solve_radical(public)
        self.counts[template] += 1
        self.variety[template].update(categories(public))
        values = [read_choice(option['label']) for option in options]
        metrics = {'length': [len(o['label']) for o in options],
                   'terms': [len(v) for v in values],
                   'zero': [int(not v) for v in values],
                   'rational': [int(not v or set(v) == {1}) for v in values],
                   'fraction': [int(any(c.denominator > 1 for c in v.values())) for v in values]}
        guesses = {f'position-{i}': i for i in range(4)}
        # Deliberately discard every coefficient magnitude: a learner should
        # not identify the answer merely by reducing the prompt's radicands.
        target = public_target(public)
        support = lambda value: frozenset(value)
        signed_support = lambda value: frozenset((r, c > 0) for r, c in value.items())
        for name, signature in [('radical-support', support), ('signed-radical-support', signed_support)]:
            matches = [i for i, value in enumerate(values) if signature(value) == signature(target)]
            guesses['prompt-' + name] = matches[0] if target and len(matches) == 1 else None
        for name, metric in metrics.items():
            for label, extreme in [('minimum', min(metric)), ('maximum', max(metric))]:
                winners = [i for i, value in enumerate(metric) if value == extreme]
                guesses[f'{name}-{label}'] = winners[0] if len(winners) == 1 else None
        for name, guess in guesses.items():
            if guess is None: continue
            counter = self.cues[template].setdefault(name, Counter())
            counter['applications'] += 1
            counter['correct'] += options[guess]['id'] == answer

    def finish(self, count):
        require(all(self.counts[t] == count and REQUIRED_VARIETY[t] <= self.variety[t] for t in RADICAL_TYPES),
                'Incomplete radical runtime count or interpretations')
        for template, cues in self.cues.items():
            for name, evidence in cues.items():
                n = evidence['applications']
                if n >= 64:
                    require(evidence['correct']/n <= .40,
                            f'Known radical choice shortcut: {template}/{name}')
        return {template: {'cases': self.counts[template], 'categories': sorted(self.variety[template]),
                           'namedChoiceChecks': self.cues[template]} for template in sorted(RADICAL_TYPES)}


FACETS = dict(zip(['simplify-square-root', 'combine-square-roots', 'multiply-square-roots',
                  'rationalize-radical-denominator'],
                 ['numeric-square-root-simplification', 'numeric-radical-sums',
                  'numeric-radical-products', 'single-radical-denominator']))


def check_manifest(record):
    require(record['kind'] == 'radical-manifest' and record['seeds'] == 1024 and record['editions'] == 16,
            'Wrong radical review manifest')
    templates = record['templates']
    require(len(templates) == 4 and {t['id'] for t in templates} == RADICAL_TYPES,
            'Missing or duplicate radical template')
    require(all(t['version'] == 1 and t['skillId'] == 'rational-exponents' and t['gradeBand'] == '9–12'
                and t['requiredResponseCapability'] == 'single-choice-v1' for t in templates),
            'Wrong radical metadata or response capability')
    skill = record['skill']
    require(skill['id'] == 'rational-exponents' and skill['gradeBand'] == 'algebra-2' and skill['strand'] == 'algebra',
            'Wrong radical curriculum placement')
    require(set(skill['prerequisites']) == {'exponent-laws', 'approximate-roots', 'factors-multiples'},
            'Wrong radical prerequisites')
    expected = {(t, 'rational-exponents.' + suffix) for t, suffix in FACETS.items()}
    require(record['coverageValid'] and len(record['mappings']) == 4 and
            {(m['templateId'], m['facetId']) for m in record['mappings']} == expected,
            'Missing radical facet mappings')
    require(all(m['extent'] == 'partial' and m['rationale'].strip() for m in record['mappings']),
            'Unsupported complete radical coverage claim')
    require(len(record['bindings']) == 4 and
            {(m['templateId'], m['facetId']) for m in record['bindings']} == expected and
            all(m['skillId'] == 'rational-exponents' and not m['independentlyReviewed'] for m in record['bindings']),
            'Incorrect default radical coverage bindings')
    require(len(record['calculator']) == 4 and {c['id'] for c in record['calculator']} == RADICAL_TYPES
            and all(c['allowed'] is False for c in record['calculator']), 'Radical computation needs calculator disabled')
    for template in RADICAL_TYPES:
        method = record['methods'][template]
        require(method['goal'].strip() and method['terms'] and method['method'] and
                record['principles'][template].strip(), 'Missing attached radical teaching method')


def check_figure(record):
    kind = record['kind']
    parser = PublicationParser(); parser.feed(record['svg']); parser.close()
    nodes = list(parser.root.descendants())
    figures = [n for n in nodes if n.attributes.get('data-lesson-illustration') == kind]
    require(len(figures) == 1, 'Missing actual radical illustration')
    figure = figures[0]
    if kind == 'radical-rationalize':
        require(figure.tag == 'table', 'Rationalizing model needs an operation table')
        rows = [n for n in figure.descendants() if 'data-operation-row' in n.attributes]
        require(len(rows) == 3, 'Missing rationalizing operation rows')
        expected = [['2', r'$\sqrt{3}$'], [r'$\times\sqrt{3}$', r'$\times\sqrt{3}$'],
                    [r'$2\sqrt{3}$', '3']]
        for row, values in zip(rows, expected):
            cells = [n for n in row.children if isinstance(n, PublicationNode) and n.tag == 'td']
            require([n.text().strip() for n in cells] == values, 'Displayed rationalization changes numerator or denominator')
        require(divide_by_monomial(rational(2), root(3)) == divide_by_monomial(tex_value(r'2\sqrt{3}'), rational(3)),
                'Rationalization diagram identity failed')
        return
    require(figure.tag == 'svg' and figure.attributes.get('role') == 'img' and figure.attributes.get('aria-label'),
            'Missing accessible radical SVG')
    view = list(map(float, figure.attributes['viewbox'].split()))
    require(len(view) == 4 and view[2] > 0 and view[3] > 0, 'Invalid radical viewBox')
    if kind == 'radical-like-lengths':
        rows = [n for n in figure.descendants() if 'data-length-row' in n.attributes]
        require(len(rows) == 3, 'Missing radical length rows')
        for row, count in zip(rows, [3, 2, 5]):
            cells = [n for n in row.descendants() if 'data-length-segment' in n.attributes]
            labels = [n.text().strip() for n in row.descendants() if n.tag == 'text']
            require(len(cells) == count and str(count) in labels, 'Length model does not show the stated number of units')
            width = float(cells[0].attributes['width']); start = float(cells[0].attributes['x'])
            require(width > 0 and row.attributes['data-unit-radicand'] == '2', 'Incorrect radical length unit')
            for index, cell in enumerate(cells):
                require(float(cell.attributes['width']) == width and float(cell.attributes['x']) == start + index * width
                        and cell.attributes['y'] == cells[0].attributes['y'], 'Radical segments do not preserve equal contiguous lengths')
    else:
        require(kind in ('radical-square-grid', 'radical-product-grid'), 'Unknown radical figure')
        rows, columns = (3, 3) if kind == 'radical-square-grid' else (4, 3)
        cells = [n for n in figure.descendants() if 'data-area-cell' in n.attributes]
        require(len(cells) == rows * columns, 'Wrong radical area-cell count')
        require({n.attributes['data-area-cell'] for n in cells} == {f'{r},{c}' for r in range(rows) for c in range(columns)},
                'Duplicate or missing radical grid cell')
        width = float(cells[0].attributes['width'])
        left = min(float(n.attributes['x']) for n in cells); top = min(float(n.attributes['y']) for n in cells)
        require(width > 0, 'Zero-area radical grid cell')
        for cell in cells:
            r, c = map(int, cell.attributes['data-area-cell'].split(','))
            require(float(cell.attributes['width']) == float(cell.attributes['height']) == width and
                    float(cell.attributes['x']) == left + c * width and float(cell.attributes['y']) == top + r * width
                    and cell.attributes['data-area'] == '2', 'Radical cells are not congruent squares in the stated grid')
        labels = [n.text().strip() for n in figure.descendants() if n.tag == 'text']
        require(labels.count('2') == rows * columns and f'Total area: {2 * rows * columns} square units' in labels,
                'Visible area labels contradict the exact grid')
    for cell in [n for n in figure.descendants() if n.tag == 'rect']:
        x, y, w, h = [float(cell.attributes[k]) for k in ('x', 'y', 'width', 'height')]
        require(view[0] <= x and view[1] <= y and x + w <= view[0] + view[2] and y + h <= view[1] + view[3],
                'Radical model extends outside its viewBox')


def check_lesson(record):
    lesson = record['lesson']; template = record['templateId']
    require(lesson['id'] == template and lesson['templateIds'] == [template], 'Missing standalone radical lesson')
    worked = lesson['workedExample']
    target = public_target({'templateId': template, 'prompt': worked['prompt']})
    require(read_choice(worked['answer']) == target, 'Incorrect radical lesson worked answer')
    chains = [value for step in worked['steps'] for value in equalities(step)]
    require(target in chains, 'Radical lesson lacks an exact derivation of its answer')
    prose = [paragraph for section in lesson['sections'] for paragraph in section['paragraphs']]
    combined = ' '.join(prose).lower()
    for vocabulary in ['radicand', 'coefficient', 'nonnegative', 'principal', 'integer', 'irrational', 'factor', 'square-free']:
        require(vocabulary in combined, 'Missing standalone radical vocabulary: ' + vocabulary)
    for paragraph in prose:
        for source in re.findall(r'\$([^$]+)\$', paragraph):
            if '=' in source and not re.search('[A-Za-z]', re.sub(r'\\[A-Za-z]+', '', source)):
                equalities('$' + source + '$')
    require(len(record['figures']) == 1, 'Each radical lesson needs its exact teaching figure')
    check_figure(record['figures'][0])
    parser = PublicationParser(); parser.feed(record['html']); parser.close()
    examples = [n for n in parser.root.descendants() if n.has_class('example')]
    require(len(examples) == 1, 'Missing printed radical worked example')
    require(worked['prompt'] in examples[0].text() and worked['answer'] in examples[0].text(),
            'Printed lesson loses worked prompt or answer')
    return len(chains)


def review_content_records(records):
    require(records, 'Missing radical review records')
    check_manifest(records[0]); corpus = RadicalCorpus()
    seen, sheets, lessons = set(), set(), set(); chains = 0
    for record in records[1:]:
        template = record['templateId']; kind = record['kind']
        require(template in RADICAL_TYPES, 'Unknown radical export template')
        if kind == 'radical-runtime':
            key = (template, record['index'])
            require(key not in seen and 0 <= record['index'] < 1024, 'Repeated or invalid radical runtime index')
            seen.add(key)
            require(record['problem'] == record['replayed'] and
                    record['problem']['public']['seed'] == f'radical-review-{record["index"]}' and
                    record['problem']['public']['templateId'] == template, 'Radical runtime does not replay')
            chains += check_problem(record['problem']); corpus.record(record['problem']['public'])
        elif kind == 'radical-worksheet':
            key = (template, record['edition'])
            require(key not in sheets and record['edition'] in {str(i) for i in range(1, 17)}, 'Repeated or invalid radical worksheet')
            sheets.add(key); chains += check_worksheet(record)
        elif kind == 'radical-lesson':
            require(template not in lessons, 'Repeated radical lesson')
            lessons.add(template); chains += check_lesson(record)
        else: raise ValueError('Unknown radical content record')
    require(len(seen) == 4096 and len(sheets) == 64 and lessons == RADICAL_TYPES, 'Incomplete radical content inventory')
    return {'runtime': corpus.finish(1024), 'worksheetEditions': len(sheets),
            'lessons': len(lessons), 'figures': len(lessons), 'checkedEqualityChains': chains}


def review_radical_content():
    app = Path(__file__).resolve().parents[1]
    result = subprocess.run(['node', '--import', 'tsx', 'scripts/radical-content-oracle.ts'], cwd=app,
                            text=True, capture_output=True, timeout=120)
    require(result.returncode == 0, 'Radical content exporter failed: ' + result.stderr)
    records = [json.loads(line) for line in result.stdout.splitlines()]
    report = review_content_records(records)
    report['rejectedContentMutations'] = review_content_mutations(records)
    return report


def review_content_mutations(records):
    runtime = next(r for r in records if r['kind'] == 'radical-runtime')
    sheet = next(r for r in records if r['kind'] == 'radical-worksheet')
    lesson = next(r for r in records if r['kind'] == 'radical-lesson')
    probes = []
    bad = copy.deepcopy(runtime['problem'])
    bad['answer'] = next(o['id'] for o in bad['public']['response']['options'] if o['id'] != bad['answer'])
    probes.append((check_problem, bad))
    bad = copy.deepcopy(runtime['problem']); bad['explanation'].append('$1 = 2$.')
    probes.append((check_problem, bad))
    bad = copy.deepcopy(runtime['problem']); bad['public']['response']['options'][0]['label'] = r'$\sqrt{8}$'
    probes.append((check_problem, bad))
    bad = copy.deepcopy(sheet); bad['problems'] = bad['problems'][:-1]
    probes.append((check_worksheet, bad))
    bad = copy.deepcopy(sheet)
    require('class="writing"' in bad['workbookHtml'], 'Missing mutation target writing space')
    bad['workbookHtml'] = bad['workbookHtml'].replace('class="writing"', 'class="writing" data-answer="secret"', 1)
    probes.append((check_worksheet, bad))
    bad = copy.deepcopy(lesson); bad['lesson']['workedExample']['answer'] = '$999$'
    probes.append((check_lesson, bad))
    bad = copy.deepcopy(lesson['figures'][0])
    bad['svg'], changed = re.subn(r'<rect\b[^>]*data-area-cell="0,0"[^>]*></rect>', '', bad['svg'], count=1)
    require(changed == 1, 'Missing mutation target area cell')
    probes.append((check_figure, bad))
    bad = copy.deepcopy(lesson['figures'][0])
    require('Total area: 18 square units' in bad['svg'], 'Missing visible-area mutation target')
    bad['svg'] = bad['svg'].replace('Total area: 18 square units', 'Total area: 20 square units', 1)
    probes.append((check_figure, bad))
    length = next(r for r in records if r['kind'] == 'radical-lesson' and r['templateId'] == 'combine-square-roots')
    bad = copy.deepcopy(length['figures'][0])
    require('width="44"' in bad['svg'], 'Missing equal-length mutation target')
    bad['svg'] = bad['svg'].replace('width="44"', 'width="43"', 1)
    probes.append((check_figure, bad))
    bad = copy.deepcopy(records[0]); bad['mappings'][0]['extent'] = 'complete'
    probes.append((check_manifest, bad))
    bad = copy.deepcopy(records[0]); bad['skill']['prerequisites'].remove('factors-multiples')
    probes.append((check_manifest, bad))
    bad = copy.deepcopy(records[0]); bad['calculator'][0]['allowed'] = True
    probes.append((check_manifest, bad))
    for checker, bad in probes:
        try: checker(bad)
        except ValueError: continue
        raise ValueError('Radical review accepted a malformed content mutation')
    return len(probes)


def review_handwritten_content():
    public = {'templateId': 'simplify-square-root', 'templateVersion': 1, 'skillId': 'rational-exponents',
              'prompt': r'Simplify $\sqrt{72}$.', 'response': {'kind': 'choice', 'label': 'Simplified expression',
              'options': [{'id': 'option-'+letter, 'label': label} for letter, label in zip('abcd',
                         [r'$6\sqrt{2}$', r'$3\sqrt{2}$', '12', r'$6\sqrt{3}$'])]}}
    problem = {'public': public, 'answer': 'option-a', 'hint': 'Find a square factor of72.',
               'explanation': ['36 is a square factor of72.', r'$\sqrt{72} = \sqrt{36}\sqrt{2} = 6\sqrt{2}$.'],
               'choiceFeedback': {f'option-{letter}': 'Compare the square factor and the remaining factor.' for letter in 'bcd'}}
    require(check_problem(problem) == 1, 'Handwritten radical explanation failed')
    probes = []
    bad = copy.deepcopy(problem); bad['answer'] = 'option-b'; probes.append(bad)
    bad = copy.deepcopy(problem); bad['explanation'][1] = r'$\sqrt{72} = 3\sqrt{2}$.'; probes.append(bad)
    bad = copy.deepcopy(problem); bad['explanation'][1] = '$1 = 1$.'; probes.append(bad)
    bad = copy.deepcopy(problem); bad['public']['answer'] = 'option-a'; probes.append(bad)
    bad = copy.deepcopy(problem); del bad['choiceFeedback']['option-b']; probes.append(bad)
    bad = copy.deepcopy(problem); bad['public']['response']['options'][1]['label'] = r'$3\sqrt{5}$'; probes.append(bad)
    bad = copy.deepcopy(problem); bad['public']['response']['options'][1]['label'] = r'$-3\sqrt{2}$'; probes.append(bad)
    for bad in probes:
        try: check_problem(bad)
        except ValueError: continue
        raise ValueError('Invalid radical explanation accepted')
    return {'handwrittenProblems': 1, 'rejectedContentMutations': len(probes)}


if __name__ == '__main__':
    import json
    print(json.dumps(review_handwritten_content()))
