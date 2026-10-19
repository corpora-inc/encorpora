"""Exact independent checks of public integer-power problem statements.

Unknown exponents are recovered by evaluating both sides at three nonzero
rational bases, without calling an author helper or applying its exponent rule.
"""
import copy
import json
from pathlib import Path
import re
import subprocess
from fractions import Fraction
from functools import lru_cache
from inequality_math_oracle import PublicationParser, PublicationNode

INTEGER_EXPONENT = frozenset({
    'negative-integer-power', 'product-of-powers-exponent',
    'quotient-of-powers-exponent', 'power-of-power-exponent',
})
INTEGER = r'(?:0|−?[1-9][0-9]*)'
BASE = r'(?:[1-9][0-9]*|\(−[1-9][0-9]*\)|\(−?[1-9][0-9]* / [1-9][0-9]*\))'
EXPONENT = r'(?:0|[1-9][0-9]*|\(−[1-9][0-9]*\))'


def require(condition, message):
    if not condition:
        raise ValueError(message)


@lru_cache(maxsize=4096)
def exact_power(base, exponent):
    """Repeated multiplication with one reciprocal for a negative exponent."""
    require(isinstance(exponent, int), 'Exponent must be an integer')
    require(base != 0, 'Power base must be nonzero')
    value = Fraction(1)
    for _ in range(abs(exponent)):
        value *= base
    return 1 / value if exponent < 0 else value


def arithmetic(source, variables=None):
    """Restricted exact arithmetic, with exponentiation before unary minus."""
    source = source.replace('−', '-')
    tokens = re.findall(r'[0-9]+|[xk()+\-×÷/^]', source)
    require(''.join(tokens) == re.sub(r'\s+', '', source), 'Unsupported power arithmetic')
    variables = variables or {}
    position = 0

    def atom():
        nonlocal position
        require(position < len(tokens), 'Missing power arithmetic operand')
        token = tokens[position]
        position += 1
        if token == '(':
            value = addition()
            require(position < len(tokens) and tokens[position] == ')', 'Unclosed power arithmetic group')
            position += 1
            return value
        if token in ('x', 'k'):
            require(token in variables, 'Unbound power arithmetic variable')
            return Fraction(variables[token])
        require(token.isdigit(), 'Invalid power arithmetic operand')
        require(len(token) <= 12, 'Excessive power arithmetic integer')
        return Fraction(token)

    def power():
        nonlocal position
        value = atom()
        if position < len(tokens) and tokens[position] == '^':
            position += 1
            exponent = unary()
            require(exponent.denominator == 1 and abs(exponent) <= 36, 'Invalid power arithmetic exponent')
            return exact_power(value, int(exponent))
        return value

    def unary():
        nonlocal position
        if position < len(tokens) and tokens[position] in ('+', '-'):
            sign = tokens[position]
            position += 1
            value = unary()
            return value if sign == '+' else -value
        return power()

    def product():
        nonlocal position
        value = unary()
        while position < len(tokens) and tokens[position] in ('×', '÷', '/'):
            op = tokens[position]
            position += 1
            other = unary()
            if op == '×':
                value *= other
            else:
                require(other != 0, 'Division by zero in power arithmetic')
                value /= other
        return value

    def addition():
        nonlocal position
        value = product()
        while position < len(tokens) and tokens[position] in ('+', '-'):
            op = tokens[position]
            position += 1
            other = product()
            value = value + other if op == '+' else value - other
        return value

    require(tokens, 'Empty power arithmetic')
    answer = addition()
    require(position == len(tokens), 'Trailing power arithmetic tokens')
    return answer


def integer(token):
    require(re.fullmatch(INTEGER, token) is not None, 'Noncanonical integer')
    return int(token.replace('−', '-'))


def parsed_exponent(public):
    template = public.get('templateId')
    require(template in INTEGER_EXPONENT, 'Unknown integer-exponent template')
    require(public.get('figure') is None, 'Unexpected integer-exponent figure')
    response = public.get('response', {})
    require(set(response) == {'kind', 'label'} and isinstance(response['label'], str)
            and response['label'].strip(), 'Malformed numeric response')
    require(response['label'] == ('Exact value' if template == 'negative-integer-power' else 'Exponent k'), 'Incorrect exponent response label')
    prompt = public.get('prompt', '')
    if template == 'negative-integer-power':
        require(response['kind'] == 'fraction', 'Negative power needs exact fraction response')
        found = re.fullmatch(rf'Evaluate ({BASE})\^({EXPONENT})\. Give an exact fraction or whole number\.', prompt)
        require(found is not None, 'Unsupported negative-power prompt')
        base = Fraction(found[1].strip('()').replace(' ', '').replace('−', '-'))
        canonical = str(base).replace('-', '−')
        shown = '(' + canonical.replace('/', ' / ') + ')' if base < 0 or base.denominator != 1 else canonical
        require(shown == found[1], 'Base must be reduced with positive denominator')
        exponent = integer(found[2].strip('()'))
        require(1 <= abs(base.numerator) <= 5 and 1 <= base.denominator <= 5
                and abs(base) != 1 and -4 <= exponent <= -1,
                'Negative-power input outside reviewed domain')
        return template, base, exponent
    require(response['kind'] == 'number', 'Missing exponent needs number response')
    if template == 'power-of-power-exponent':
        expression = rf'\(x\^({EXPONENT})\)\^({EXPONENT})'
    else:
        op = '×' if template == 'product-of-powers-exponent' else '÷'
        expression = rf'x\^({EXPONENT}) {op} x\^({EXPONENT})'
    found = re.fullmatch(rf'For every nonzero real x, {expression} = x\^k\. What is k\?', prompt)
    require(found is not None, 'Unsupported exponent identity or missing nonzero domain')
    a, b = (integer(token.strip('()')) for token in found.groups())
    require(-6 <= a <= 6 and -6 <= b <= 6, 'Exponent input outside reviewed domain')
    return template, a, b


def left_value(parsed, base):
    template, a, b = parsed
    if template == 'product-of-powers-exponent':
        return exact_power(base, a) * exact_power(base, b)
    if template == 'quotient-of-powers-exponent':
        return exact_power(base, a) / exact_power(base, b)
    require(template == 'power-of-power-exponent', 'Unexpected exponent identity')
    return exact_power(exact_power(base, a), b)


def solve_integer_exponent(public):
    parsed = parsed_exponent(public)
    if parsed[0] == 'negative-integer-power':
        return exact_power(parsed[1], parsed[2])
    bases = (Fraction(2), Fraction(3), Fraction(-2))
    values = [left_value(parsed, base) for base in bases]
    answers = [k for k in range(-36, 37)
               if all(exact_power(base, k) == value for base, value in zip(bases, values))]
    require(len(answers) == 1, 'Exponent identity must have exactly one bounded integer answer')
    return Fraction(answers[0])


def equalities(text, answer=0):
    chunk = r'[0-9xk() +−\-×÷/^]+'
    chains = re.findall(rf'(?<![A-Za-z])({chunk}(?:={chunk})+)', text)
    for chain in chains:
        parts = [part.strip() for part in chain.split('=')]
        for base in (2, 3, -2):
            values = [arithmetic(part, {'x': base, 'k': answer}) for part in parts]
            require(all(value == values[0] for value in values), f'False worked equality: {chain}')
    return len(chains)


def review_integer_exponent_explanation(public, explanation):
    parsed = parsed_exponent(public)
    answer = solve_integer_exponent(public)
    require(isinstance(explanation, list) and len(explanation) >= 4 and
            all(isinstance(step, str) and step.strip() for step in explanation), 'Incomplete integer-power explanation')
    count = sum(equalities(step, answer) for step in explanation)
    require(count >= 3, 'Missing explicit integer-power equalities')
    if parsed[0] == 'negative-integer-power':
        source = public['prompt'].split('Evaluate ', 1)[1].split('. Give', 1)[0]
        require(source + ' = ' in explanation[1], 'Worked power does not preserve the given base and exponent')
        check = explanation[-1]
        require(check.startswith('Check the reciprocal: ') and check.endswith(' = 1.'), 'Missing explicit reciprocal check')
        factors = check.removeprefix('Check the reciprocal: ').removesuffix(' = 1.').split(' × ')
        require(len(factors) == 2 and arithmetic(factors[0]) == answer and arithmetic(factors[1]) == 1/answer, 'Reciprocal check uses unrelated factors')
    else:
        source = public['prompt'].split(', ', 1)[1].split(' = x^k', 1)[0]
        require('Therefore ' + source + ' = ' in explanation[3], 'Worked identity does not preserve public exponents')
        calculation = explanation[2].removeprefix('Calculate the exponent: ').removesuffix('.')
        a, b = parsed[1:]
        signed = lambda n: str(n).replace('-', '−')
        second = f'({signed(b)})' if b < 0 else signed(b)
        op = {'product-of-powers-exponent': '+', 'quotient-of-powers-exponent': '−', 'power-of-power-exponent': '×'}[parsed[0]]
        require(calculation.startswith(f'{signed(a)} {op} {second} = '), 'Worked exponent calculation changes the givens or operation')


def numeric_exercises(html):
    parser = PublicationParser(); parser.feed(html); parser.close()
    roots = [node for node in parser.root.children if isinstance(node, PublicationNode)]
    require(len(roots) == 1 and roots[0].tag == 'html', 'Expected complete publication HTML')
    exercises = [node for node in parser.root.descendants() if node.has_class('exercise')]
    require(len(exercises) == 12, 'Expected twelve printed exercises')
    result = []
    for index, exercise in enumerate(exercises, 1):
        nodes = list(exercise.descendants())
        children = [node for node in exercise.children if isinstance(node, PublicationNode)]
        require(all(isinstance(node, PublicationNode) or not node.strip() for node in exercise.children), 'Unexpected exercise text')
        tags = [node.tag for node in children]
        require(tags in (['h2', 'div'], ['h2', 'ol', 'p']), 'Malformed numeric exercise structure')
        require(not any(node.has_class('exercise') or node.tag in ('script', 'input') or 'data-answer' in node.attributes or 'data-correct' in node.attributes for node in nodes), 'Unexpected answer leakage or nested exercise')
        heading = children[0].text().strip(); prefix = f'{index}. '
        require(heading.startswith(prefix), 'Incorrect printed exercise order')
        if tags == ['h2', 'div']:
            require(children[1].has_class('writing') and not children[1].children, 'Workbook exposes content in answer space')
            answer, steps = None, []
        else:
            items = [node for node in children[1].children if isinstance(node, PublicationNode)]
            require(items and all(node.tag == 'li' for node in items), 'Malformed solution steps')
            strong = [node for node in children[2].children if isinstance(node, PublicationNode)]
            require(len(strong) == 1 and strong[0].tag == 'strong', 'Malformed printed answer')
            answer = strong[0].text().strip()
            require(answer.startswith('Answer: '), 'Missing printed answer label')
            answer = answer.removeprefix('Answer: ')
            steps = [node.text().strip() for node in items]
        result.append({'prompt': heading[len(prefix):], 'answer': answer, 'steps': steps})
    return result


def check_worksheet(record):
    problems = record['problems']
    require(len(problems) == 12 and len({p['public']['prompt'] for p in problems}) == 12, 'Worksheet needs twelve distinct givens')
    require(problems == record['replayed'], 'Worksheet must replay ordinary runtime problems')
    work, key = numeric_exercises(record['workbookHtml']), numeric_exercises(record['solutionsHtml'])
    values = []
    for problem, blank, solution in zip(problems, work, key):
        public = problem['public']; answer = solve_integer_exponent(public)
        require(public['templateId'] == record['templateId'] and Fraction(problem['answer']) == answer, 'Wrong worksheet template or answer')
        require(blank['prompt'] == solution['prompt'] == public['prompt'], 'Printed prompt/order differs from worksheet')
        require(blank['answer'] is None and not blank['steps'], 'Workbook contains solutions')
        require(Fraction(solution['answer'].replace('−', '-')) == answer and solution['steps'] == problem['explanation'], 'Printed answer or worked steps differ')
        review_integer_exponent_explanation(public, problem['explanation'])
        values.append((*parsed_exponent(public)[1:], answer))
    if record['templateId'] == 'negative-integer-power':
        for predicate in [lambda a,b: a < 0 and b % 2, lambda a,b: a < 0 and b % 2 == 0,
                          lambda a,b: a > 0 and a.denominator == 1, lambda a,b: a > 0 and a.denominator > 1,
                          lambda a,b: a < 0 and a.denominator > 1]:
            require(any(predicate(a,b) for a,b,_ in values), 'Missing negative-power worksheet sign/fraction/parity class')
    else:
        for sign in (-1, 0, 1):
            require(sum((answer > 0) - (answer < 0) == sign for _,_,answer in values) >= 2, 'Missing worksheet answer-sign quota')
        for predicate in [lambda a,b: a == 0 or b == 0, lambda a,b:a < 0 and b < 0, lambda a,b:(a < 0) != (b < 0)]:
            require(sum(bool(predicate(a,b)) for a,b,_ in values) >= 2, 'Missing worksheet exponent-sign/zero quota')


def check_manifest(record):
    require(record['kind'] == 'integer-exponent-manifest' and record['seeds'] == 1024 and record['editions'] == 16, 'Invalid exponent export manifest')
    templates = record['templates']
    require(len(templates) == 4 and {t['id'] for t in templates} == INTEGER_EXPONENT, 'Incomplete exponent template inventory')
    require(all(t['version'] == 1 and t['skillId'] == 'exponent-laws' and t['gradeBand'] == '6–8' for t in templates), 'Wrong exponent template metadata')
    skill = record['skill']
    require(skill['id'] == 'exponent-laws' and skill['gradeBand'] == '8' and skill['strand'] == 'algebra', 'Wrong exponent curriculum placement')
    require(set(skill['prerequisites']) == {'integer-powers', 'signed-multiplication', 'signed-addition', 'fraction-division'}, 'Incorrect exponent prerequisites')
    suffixes = {'negative-integer-power':'negative-rational-powers', 'product-of-powers-exponent':'same-base-product', 'quotient-of-powers-exponent':'same-base-quotient', 'power-of-power-exponent':'nested-integer-powers'}
    expected = {(template, 'exponent-laws.' + suffix) for template,suffix in suffixes.items()}
    require(record['coverageValid'] and len(record['mappings']) == 4 and {(m['templateId'],m['facetId']) for m in record['mappings']} == expected, 'Missing default exponent facet mapping')
    require(all(m['extent'] == 'partial' and m['rationale'].strip() for m in record['mappings']), 'Unsupported complete exponent coverage claim')
    require(len(record['bindings']) == 4 and {(m['templateId'],m['facetId']) for m in record['bindings']} == expected and all(m['skillId'] == 'exponent-laws' and not m['independentlyReviewed'] for m in record['bindings']), 'Incorrect exponent default facet bindings')
    require(record['equivalentInputs'] == [{'input':value,'normalized':'1/8' if index < 3 else '-3'} for index,value in enumerate(['0.125','1/8','2/16','−3','-3'])], 'Equivalent exact numeric input regression')
    parser = PublicationParser(); parser.feed(record['illustration']); parser.close()
    rows = [node for node in parser.root.descendants() if 'data-exponent' in node.attributes]
    require(len(rows) == 6, 'Power diagram needs six rows')
    for index,row in enumerate(rows):
        text_nodes = [node for node in row.children if isinstance(node,PublicationNode) and node.tag == 'text']
        exponent = 3-index; expected_value = exact_power(Fraction(2),exponent)
        require(len(text_nodes) == 2 and integer(row.attributes['data-exponent']) == exponent and Fraction(row.attributes['data-value']) == expected_value, 'Incorrect power diagram row data')
        require(integer(text_nodes[0].text()) == exponent and Fraction(text_nodes[1].text()) == expected_value, 'Displayed power diagram values differ from exact data')
        require([float(node.attributes['x']) for node in text_nodes] == [74,242] and all(float(node.attributes['y']) == 88+index*68 for node in text_nodes), 'Diagram row coordinates misalign labels')
    return len(rows)


def check_lesson(record):
    lesson = record['lesson']; template = record['templateId']
    require(lesson['id'] == template and lesson['templateIds'] == [template], 'Missing standalone exponent lesson')
    worked = lesson['workedExample']; prompt = worked['prompt']
    if template == 'negative-integer-power': prompt += ' Give an exact fraction or whole number.'
    public = fixture(template,prompt); answer = solve_integer_exponent(public)
    require(Fraction(worked['answer'].replace('−','-')) == answer, 'Incorrect lesson worked answer')
    require(sum(equalities(step,answer) for step in worked['steps']) >= 2, 'Missing checked lesson equality chains')
    prose = ' '.join(p for section in lesson['sections'] for p in section['paragraphs'])
    for term in ['base', 'exponent', 'factor', 'integer', 'nonzero', 'division by zero', 'numerator', 'denominator', 'reciprocal']:
        require(term in prose.lower(), 'Missing standalone exponent definition: ' + term)
    require('signed numbers' in prose and 'x^0 = 1' in prose, 'Missing assumed arithmetic or zero-power explanation')


def check_runtime(record):
    problem = record['problem']; public = problem['public']
    require(set(problem) == {'public','answer','hint','explanation'}, 'Unexpected private exponent problem shape')
    require(problem == record['replayed'] and public['seed'] == f'integer-exponent-review-{record["index"]}' and public['templateId'] == record['templateId'], 'Nonreplaying exponent runtime case')
    require(Fraction(problem['answer']) == solve_integer_exponent(public), 'Incorrect generated integer-power answer')
    review_integer_exponent_explanation(public,problem['explanation'])


def review_content_records(records):
    require(records and records[0]['kind'] == 'integer-exponent-manifest', 'Missing exponent manifest')
    rows = check_manifest(records[0]); review = IntegerExponentReview()
    seen = set(); sheets = set(); lessons = set()
    for record in records[1:]:
        kind = record['kind']; template = record['templateId']
        require(template in INTEGER_EXPONENT, 'Unknown exponent export template')
        if kind == 'integer-exponent-runtime':
            key = (template,record['index']); require(key not in seen and 0 <= record['index'] < 1024, 'Duplicate or out-of-range exponent seed')
            seen.add(key); check_runtime(record); review.record(record['problem']['public'])
        elif kind == 'integer-exponent-worksheet':
            key = (template,record['edition']); require(key not in sheets and record['edition'] in {str(i) for i in range(1,17)}, 'Duplicate or invalid worksheet edition')
            sheets.add(key); check_worksheet(record)
        elif kind == 'integer-exponent-lesson':
            require(template not in lessons, 'Duplicate standalone exponent lesson'); lessons.add(template); check_lesson(record)
        else:
            raise ValueError('Unknown exponent content record')
    require(len(sheets) == 64 and lessons == INTEGER_EXPONENT, 'Incomplete exponent worksheet/lesson inventory')
    return {'runtime':review.finish(1024),'worksheetEditions':len(sheets),'lessons':len(lessons),'diagramRows':rows}


def review_content_mutations(records):
    sheet = next(r for r in records if r['kind'] == 'integer-exponent-worksheet')
    runtime = next(r for r in records if r['kind'] == 'integer-exponent-runtime')
    lesson = next(r for r in records if r['kind'] == 'integer-exponent-lesson')
    probes = []
    def probe(source, checker, change):
        value = copy.deepcopy(source); change(value); probes.append((checker,value))
    probe(runtime,check_runtime,lambda r:r['problem'].__setitem__('answer','999'))
    probe(runtime,check_runtime,lambda r:r['problem']['explanation'].__setitem__(2,'The answer is 1.'))
    probe(runtime,check_runtime,lambda r:r['problem']['public'].__setitem__('answer','1'))
    probe(sheet,check_worksheet,lambda r:r['problems'].__setitem__(1,r['problems'][0]))
    probe(sheet,check_worksheet,lambda r:r.__setitem__('solutionsHtml',r['solutionsHtml'].replace('Answer: ','Answer: 999 ',1)))
    probe(sheet,check_worksheet,lambda r:r.__setitem__('workbookHtml',r['solutionsHtml']))
    probe(sheet,check_worksheet,lambda r:r.__setitem__('workbookHtml',r['workbookHtml'].replace('class="writing"','class="writing" data-answer="1"',1)))
    probe(sheet,check_worksheet,lambda r:r.__setitem__('workbookHtml',r['workbookHtml'].replace('</h2>','</h3>',1)))
    probe(lesson,check_lesson,lambda r:r['lesson']['workedExample'].__setitem__('answer','999'))
    probe(records[0],check_manifest,lambda r:r['mappings'][0].__setitem__('extent','complete'))
    probe(records[0],check_manifest,lambda r:r.__setitem__('illustration',r['illustration'].replace('data-value="8"','data-value="9"')))
    probe(records[0],check_manifest,lambda r:r.__setitem__('illustration',r['illustration'].replace('>8</text>','>9</text>')))
    for checker,value in probes:
        try: checker(value)
        except (ValueError,KeyError,ZeroDivisionError): continue
        raise ValueError('Malformed exponent content mutation accepted')
    return len(probes)


def review_integer_exponent_content():
    root = Path(__file__).resolve().parents[1]
    result = subprocess.run(['node','--import','tsx','scripts/integer-exponent-content-oracle.ts'],cwd=root,text=True,capture_output=True,timeout=120)
    require(result.returncode == 0, 'Exponent content exporter failed: ' + result.stderr)
    records = [json.loads(line) for line in result.stdout.splitlines()]
    report = review_content_records(records)
    report['rejectedContentMutations'] = review_content_mutations(records)
    return report


class IntegerExponentReview:
    def __init__(self):
        self.values = {template: [] for template in INTEGER_EXPONENT}

    def record(self, public, solved=None):
        require(set(public) == {'id', 'templateId', 'templateVersion', 'seed', 'skillId', 'prompt', 'response'}, 'Unexpected or missing public exponent field')
        require(public['templateVersion'] == 1 and public['skillId'] == 'exponent-laws', 'Exponent version or skill changed')
        parsed = parsed_exponent(public)
        answer = solve_integer_exponent(public)
        require(solved is None or answer == solved, 'Independent exponent result mismatch')
        self.values[parsed[0]].append((parsed[1], parsed[2], answer))

    def finish(self, count):
        report = {}
        for template, values in self.values.items():
            require(len(values) == count, 'Incomplete integer-exponent corpus')
            require(len({(a, b) for a, b, _ in values}) >= 12, 'Insufficient exponent variety')
            if template == 'negative-integer-power':
                require({b for _, b, _ in values} == {-4, -3, -2, -1}, 'Missing negative exponent magnitude')
                require(any(a < 0 for a, _, _ in values) and any(a > 0 for a, _, _ in values), 'Missing base sign')
                require(any(a.denominator == 1 for a, _, _ in values) and any(a.denominator > 1 for a, _, _ in values), 'Missing integer or fraction base')
                require(any(abs(a) < 1 for a, _, _ in values) and any(abs(a) > 1 for a, _, _ in values), 'Missing reciprocal magnitude class')
            else:
                for coordinate in (0, 1):
                    require({(row[coordinate] > 0) - (row[coordinate] < 0) for row in values} == {-1, 0, 1}, 'Missing positive, zero or negative exponent')
                require({(answer > 0) - (answer < 0) for _, _, answer in values} == {-1, 0, 1}, 'Missing positive, zero or negative answer')
            report[template] = {'cases': len(values), 'distinctInputs': len({(a, b) for a, b, _ in values})}
        return report


def fixture(template, prompt):
    return {'id': 'fixture', 'templateId': template, 'templateVersion': 1,
            'seed': 'fixture', 'skillId': 'exponent-laws', 'prompt': prompt,
            'response': {'kind': 'fraction' if template == 'negative-integer-power' else 'number',
                         'label': 'Exact value' if template == 'negative-integer-power' else 'Exponent k'}}


def review_integer_exponent_fixtures():
    for expression, expected in [
        ('−2^2', -4), ('(−2)^2', 4), ('(−2 / 3)^(−3)', Fraction(-27, 8)),
        ('2^0', 1), ('(2^(−3))^2', Fraction(1, 64)),
        ('(−3) − (−5)', 2), ('2^3 ÷ 2^5', Fraction(1, 4)),
    ]:
        require(arithmetic(expression) == expected, 'Independent exponent arithmetic precedence mismatch')
    cases = [
        ('negative-integer-power', 'Evaluate (−2 / 3)^(−3). Give an exact fraction or whole number.', Fraction(-27, 8)),
        ('negative-integer-power', 'Evaluate (−5)^(−4). Give an exact fraction or whole number.', Fraction(1, 625)),
        ('negative-integer-power', 'Evaluate (1 / 5)^(−4). Give an exact fraction or whole number.', Fraction(625)),
        ('negative-integer-power', 'Evaluate (3 / 2)^(−1). Give an exact fraction or whole number.', Fraction(2, 3)),
        ('product-of-powers-exponent', 'For every nonzero real x, x^(−3) × x^5 = x^k. What is k?', Fraction(2)),
        ('product-of-powers-exponent', 'For every nonzero real x, x^6 × x^(−6) = x^k. What is k?', Fraction(0)),
        ('product-of-powers-exponent', 'For every nonzero real x, x^0 × x^(−4) = x^k. What is k?', Fraction(-4)),
        ('quotient-of-powers-exponent', 'For every nonzero real x, x^(−3) ÷ x^5 = x^k. What is k?', Fraction(-8)),
        ('quotient-of-powers-exponent', 'For every nonzero real x, x^(−6) ÷ x^(−6) = x^k. What is k?', Fraction(0)),
        ('quotient-of-powers-exponent', 'For every nonzero real x, x^0 ÷ x^(−4) = x^k. What is k?', Fraction(4)),
        ('power-of-power-exponent', 'For every nonzero real x, (x^(−3))^5 = x^k. What is k?', Fraction(-15)),
        ('power-of-power-exponent', 'For every nonzero real x, (x^(−6))^(−6) = x^k. What is k?', Fraction(36)),
        ('power-of-power-exponent', 'For every nonzero real x, (x^0)^(−4) = x^k. What is k?', Fraction(0)),
    ]
    cases.extend([
        ('negative-integer-power', 'Evaluate 2^(−3). Give an exact fraction or whole number.', Fraction(1, 8)),
        ('negative-integer-power', 'Evaluate (−1 / 5)^(−1). Give an exact fraction or whole number.', Fraction(-5)),
        ('power-of-power-exponent', 'For every nonzero real x, (x^(−6))^0 = x^k. What is k?', Fraction(0)),
    ])
    for template, prompt, expected in cases:
        require(solve_integer_exponent(fixture(template, prompt)) == expected, 'Handwritten exponent fixture mismatch')
    bad = []
    base = fixture(cases[0][0], cases[0][1])
    for old, new in [('−2 / 3', '0'), ('−2 / 3', '−1'), ('−2 / 3', '−4 / 6'),
                     ('−2 / 3', '2 / 0'), ('−2 / 3', '2 / −3'), ('−2 / 3', '6 / 5'),
                     ('−3', '0'), ('−3', '−5'), ('−3', '−1/2'),
                     ('−2 / 3', '−2/3'), ('^(−3)', '^−3')]:
        item = copy.deepcopy(base); item['prompt'] = item['prompt'].replace(old, new); bad.append(item)
    identity = fixture(cases[4][0], cases[4][1])
    for old, new in [('nonzero real', 'real'), ('^5', '^7'), ('^5', '^05'),
                     ('^(−3)', '^(−0)'), ('^5', '^(5)'), (' × ', ' + '), ('x^k', 'x + k')]:
        item = copy.deepcopy(identity); item['prompt'] = item['prompt'].replace(old, new); bad.append(item)
    item = copy.deepcopy(identity); item['response']['kind'] = 'choice'; bad.append(item)
    for item in bad:
        try:
            solve_integer_exponent(item)
        except (ValueError, ZeroDivisionError):
            continue
        raise ValueError('Malformed exponent fixture was accepted')
    return {'handwritten': len(cases), 'rejectedMalformed': len(bad)}


if __name__ == '__main__':
    print(review_integer_exponent_fixtures())
