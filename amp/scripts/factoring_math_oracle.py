"""Independent exact coefficient arithmetic from public factoring prompts.

No generator functions or private factor metadata enter the solver.
"""
import ast
import copy
import json
from fractions import Fraction
from pathlib import Path
import re
import subprocess
import xml.etree.ElementTree as ET

FACTORING = frozenset({'greatest-monomial-factor', 'monic-quadratic-factorization',
                      'nonmonic-quadratic-factorization'})


def require(condition, message):
    if not condition:
        raise ValueError(message)


def trim(values):
    values = list(values)
    while len(values) > 1 and values[-1] == 0:
        values.pop()
    return tuple(values)


def add(left, right, sign=1):
    return trim((left[i] if i < len(left) else 0) +
                sign * (right[i] if i < len(right) else 0)
                for i in range(max(len(left), len(right))))


def multiply(left, right):
    require(len(left)+len(right)-2 <= 6, 'Excessive polynomial degree')
    result = [Fraction(0)] * (len(left)+len(right)-1)
    for i, a in enumerate(left):
        for j, b in enumerate(right):
            result[i+j] += a*b
    return trim(result)


def expand(expression):
    """Read only integer polynomial arithmetic; never evaluate Python code."""
    require(isinstance(expression, str) and 0 < len(expression) <= 256,
            'Invalid factor expression length')
    source = expression.replace('−', '-').replace('²', '**2').replace('³', '**3')
    require(re.fullmatch(r'[0-9x()+*\-\s]+', source) is not None,
            'Unsupported factor expression character')
    source = re.sub(r'\s+', '', source)
    source = re.sub(r'(?<=[0-9x)])(?=[x(])', '*', source)
    source = re.sub(r'(?<=\))(?=[0-9])', '*', source)

    def visit(node):
        if isinstance(node, ast.Constant) and type(node.value) is int:
            require(abs(node.value) <= 10000, 'Excessive coefficient')
            return (Fraction(node.value),)
        if isinstance(node, ast.Name) and node.id == 'x':
            return (Fraction(0), Fraction(1))
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.USub, ast.UAdd)):
            value = visit(node.operand)
            return tuple(-v for v in value) if isinstance(node.op, ast.USub) else value
        require(isinstance(node, ast.BinOp), 'Unsupported factor expression syntax')
        left, right = visit(node.left), visit(node.right)
        if isinstance(node.op, ast.Add): return add(left, right)
        if isinstance(node.op, ast.Sub): return add(left, right, -1)
        if isinstance(node.op, ast.Mult): return multiply(left, right)
        if isinstance(node.op, ast.Pow):
            require(len(right) == 1 and right[0].denominator == 1 and 0 <= right[0] <= 3,
                    'Unsupported polynomial exponent')
            result = (Fraction(1),)
            for _ in range(int(right[0])):
                result = multiply(result, left)
            return result
        raise ValueError('Unsupported factor expression operation')
    try:
        return visit(ast.parse(source, mode='eval').body)
    except SyntaxError as error:
        raise ValueError('Malformed factor expression') from error


def greatest_monomial(coefficients):
    """Positive common coefficient and largest common power, by divisibility."""
    terms = [(i, value) for i, value in enumerate(coefficients) if value]
    require(terms and all(value.denominator == 1 for _, value in terms),
            'Require a nonzero integer polynomial')
    magnitudes = [abs(int(value)) for _, value in terms]
    bound = min(magnitudes)
    require(bound <= 10000, 'Coefficient outside review bound')
    common = max(k for k in range(1, bound+1) if all(n % k == 0 for n in magnitudes))
    return common, terms[0][0]


def polynomial_label(coefficients):
    result = ''
    for power in range(len(coefficients)-1, -1, -1):
        value = coefficients[power]
        require(value.denominator == 1, 'Require integer polynomial coefficients')
        if not value:
            continue
        magnitude = abs(int(value))
        term = (str(magnitude) if power == 0 or magnitude != 1 else '')
        term += {0: '', 1: 'x', 2: 'x²', 3: 'x³'}[power]
        result += ((' − ' if value < 0 else ' + ') if result else
                   ('−' if value < 0 else '')) + term
    return result or '0'


def read_polynomial(label):
    value = expand(label)
    require(len(value) <= 4 and label == polynomial_label(value),
            'Require canonical descending polynomial terms')
    return value


def read_factorization(template, label):
    """Validate the requested factored form, not just an equivalent expression."""
    if template == 'greatest-monomial-factor':
        match = re.fullmatch(r'([1-9][0-9]*|(?:[1-9][0-9]*)?x[²]?)[(]([^()]+)[)]', label)
        require(match is not None, 'Require one positive monomial outside parentheses')
        outer, residual = expand(match[1]), read_polynomial(match[2])
        require(1 <= len(residual) <= 4, 'Invalid residual polynomial')
        product = multiply(outer, residual)
        common, power = greatest_monomial(product)
        require(outer == (0,)*power + (common,) and (common, power) != (1, 0),
                'Extracted factor is not the greatest positive common monomial')
        require(1 <= len(product)-1 <= 3 and 2 <= sum(v != 0 for v in product) <= 3
                and max(abs(v) for v in product) <= 72 and common <= 12 and power <= 2,
                'Common-monomial problem outside declared domain')
        require(match[1] == polynomial_label(outer), 'Noncanonical monomial label')
        return product

    linear = r'(?:[1-6])?x [−+] [1-9]'
    match = re.fullmatch(rf'(?P<k>−?[23]|−)?\((?P<left>{linear})\)(?:\((?P<right>{linear})\)|(?P<square>²))', label)
    require(match is not None, 'Require two integer linear factors, or their square')
    k = {'': 1, '−': -1}.get(match['k'] or '')
    if k is None:
        k = int(match['k'].replace('−', '-'))
    left = read_polynomial(match['left'])
    right = read_polynomial(match['right']) if match['right'] else left
    require(len(left) == len(right) == 2 and left[0] != 0 and right[0] != 0,
            'Require linear factors with nonzero constants')
    require((left[1], left[0]) <= (right[1], right[0]), 'Factors are not canonically ordered')
    require(bool(match['square']) == (left == right), 'Repeated factors must use square notation')
    require(greatest_monomial(left) == greatest_monomial(right) == (1, 0),
            'Linear factors must be primitive')
    require(abs(left[0]*right[0]) <= 36 and 1 <= left[1]*right[1] <= 12,
            'Quadratic factors outside declared domain')
    result = tuple(k*v for v in multiply(left, right))
    if template == 'monic-quadratic-factorization':
        require(k == left[1] == right[1] == 1, 'Monic family requires leading coefficient one')
    else:
        require(template == 'nonmonic-quadratic-factorization' and result[2] != 1,
                'Nonmonic family requires leading coefficient other than one')
    return result


# Each template's prompt frames; each states one polynomial.
FRAMES = {
    'greatest-monomial-factor': (
        r'Factor out the greatest common monomial factor with positive coefficient: (.+)\.',
        r'Which expression shows (.+) with its greatest common monomial factor \(positive coefficient\) taken out\?',
        r'Rewrite (.+) as its greatest common monomial factor, with positive coefficient, times a polynomial\.',
    ),
    'quadratic': (
        r'Factor completely over the integers: (.+)\.',
        r'Which product equals (.+)\? Choose the complete factorization over the integers\.',
        r'Write (.+), factored completely, as a product of integer-coefficient factors\.',
    ),
}


def polynomial_of(template, prompt):
    frames = FRAMES['greatest-monomial-factor' if template == 'greatest-monomial-factor' else 'quadratic']
    found = [m[1] for m in (re.fullmatch(f, prompt) for f in frames) if m]
    require(len(found) == 1, 'Unsupported factoring prompt')
    return found[0]


def solve_factoring(public):
    template = public['templateId']
    require(template in FACTORING, 'Unknown factoring template')
    require(public.get('figure') is None, 'Unexpected runtime factoring figure')
    target = read_polynomial(polynomial_of(template, public['prompt']))
    response = public['response']
    require(response.get('kind') == 'choice', 'Factoring requires a choice response')
    options = response.get('options')
    require(isinstance(options, list) and 2 <= len(options) <= 4, 'Require two to four choices')
    require(all(isinstance(option, dict) and set(option) == {'id', 'label'}
                and isinstance(option['id'], str) and 0 < len(option['id']) <= 64
                and isinstance(option['label'], str) for option in options), 'Malformed factoring option')
    require(len({option['id'] for option in options}) == len(options), 'Repeated option ID')
    products = [read_factorization(template, option['label']) for option in options]
    require(len(set(products)) == len(products), 'Equivalent factoring choices')
    if template != 'greatest-monomial-factor':
        require(len({(value[2], value[0]) for value in products}) == 1,
                'Quadratic choices must share leading and constant coefficients')
        require(len({greatest_monomial(value)[0] for value in products}) == 1,
                'Quadratic choices must share numeric content')
    answers = [option['id'] for option, value in zip(options, products) if value == target]
    require(len(answers) == 1, 'Require exactly one complete factorization of the given polynomial')
    return answers[0]


def review_equalities(text):
    """Check every numerical or polynomial equality in these worked steps."""
    # This sentence states a permitted value of x, not an identity x = 0.
    text = text.replace('Multiplication verifies the identity even when x = 0.', '')
    alphabet = r'[0-9x²³()−+×*\-\s]'
    chains = re.findall(rf'(?<![A-Za-z]){alphabet}+(?:={alphabet}+)+', text)
    for chain in chains:
        pieces = chain.split('=')
        values = [expand(piece.strip().replace('×', '*')) for piece in pieces]
        require(all(value == values[0] for value in values), 'False worked equality: '+chain)
    require(text.count('=') == sum(chain.count('=') for chain in chains),
            'Worked equality was not parsed completely')
    return len(chains)


def review_explanation(problem):
    public = problem['public']
    key = solve_factoring(public)
    require(problem['answer'] == key, 'Mismatch: incorrect factoring answer')
    target = read_polynomial(polynomial_of(public['templateId'], public['prompt']))
    steps = problem['explanation']
    require(isinstance(steps, list) and len(steps) >= 3
            and all(isinstance(step, str) and step for step in steps), 'Missing worked factoring steps')
    chains = sum(review_equalities(step) for step in steps)
    require(chains >= 2, 'Factoring explanation lacks explicit equality steps')
    labels = {option['id']: option['label'] for option in public['response']['options']}
    require(labels[key] in ' '.join(steps), 'Explanation omits the factored answer')
    feedback = problem.get('choiceFeedback', {})
    require(set(feedback) == set(labels)-{key}, 'Missing or extraneous choice feedback')
    for option, text in feedback.items():
        match = re.fullmatch(r'This product expands to (.+)\. Compare its coefficients with (.+); a factorization must reproduce every term\.', text)
        require(match is not None, 'Unsupported choice feedback')
        require(read_polynomial(match[1]) == expand(labels[option]), 'Feedback expansion is false')
        require(read_polynomial(match[2]) == target, 'Feedback changed the target polynomial')
    if public['templateId'] == 'greatest-monomial-factor':
        common, power = greatest_monomial(target)
        divisors = [d for d in range(1, common+1) if all(v % d == 0 for v in target)]
        expected = 'Common positive coefficient factors: '+', '.join(map(str, divisors))+f'. The greatest is {common}.'
        require(steps[0] == expected, 'Incorrect common coefficient factors')
        expected = (f'The smallest exponent of $x$ among the nonzero terms is {power}. The common variable factor is $'+{1:'x',2:'x²'}[power]+'$.'
                    if power else 'A nonzero constant term has no factor $x$, so no power of $x$ is common to every term.')
        require(steps[1] == expected, 'Incorrect common variable factor')
    else:
        require(len(public['response']['options']) >= 3, 'Quadratic practice must have at least three distinct middle coefficients')
        claim = [step for step in steps if step.startswith('For ')]
        require(len(claim) == 1, 'Missing quadratic coefficient identification')
        found = re.fullmatch(r'For (.+), the leading coefficient is (−?-?[0-9]+), the middle coefficient is (−?-?[0-9]+), and the constant is (−?-?[0-9]+)\.', claim[0])
        require(found is not None, 'Malformed quadratic coefficient identification')
        inner = read_polynomial(found[1])
        require(tuple(int(v.replace('−','-')) for v in found.groups()[1:]) == tuple(reversed(inner)),
                'Stated coefficients contradict the inside quadratic')
        factor = target[2]/inner[2]
        require(tuple(factor*v for v in inner) == target and inner[2] > 0,
                'Inside quadratic is not the original with signed content extracted')
        if public['templateId'] == 'nonmonic-quadratic-factorization':
            common, _ = greatest_monomial(target)
            magnitudes = ', '.join(str(abs(int(value))) for value in reversed(target) if value)
            require(steps[0] == f'The GCF of the nonzero coefficient magnitudes {magnitudes} is {common}.',
                    'Incorrect or missing numerical-content derivation')
            sign_step = 'The leading coefficient is negative. Extract the negative of the coefficient GCF to leave a positive leading coefficient inside.'
            require((sign_step in steps) == (target[2] < 0), 'Wrong explanation for extracting a negative common factor')
    return chains


class FactoringReview:
    """Check case breadth and named choice-only shortcuts against chance."""
    def __init__(self):
        from collections import Counter
        self.counts = {template: Counter() for template in FACTORING}
        self.shortcuts = {}

    def record(self, public, key):
        from polynomial_math_oracle import CHOICE_SHORTCUTS, unique_extreme
        template = public['templateId']; counts = self.counts[template]
        options = public['response']['options']
        polynomials = [expand(option['label']) for option in options]
        answer = next(value for option, value in zip(options, polynomials) if option['id'] == key)
        counts['cases'] += 1
        counts[f'degree-{len(answer)-1}'] += 1
        counts['negative-leading' if answer[-1] < 0 else 'positive-leading'] += 1
        common, power = greatest_monomial(answer)
        if template == 'greatest-monomial-factor':
            counts['coefficient-only' if not power else 'variable-only' if common == 1 else 'combined'] += 1
            counts[f'terms-{sum(v != 0 for v in answer)}'] += 1
        else:
            counts['zero-middle' if not answer[1] else 'negative-middle' if answer[1] < 0 else 'positive-middle'] += 1
            counts['negative-constant' if answer[0] < 0 else 'positive-constant'] += 1
            counts['repeated' if answer[1]**2 == 4*answer[0]*answer[2] else 'distinct'] += 1
            counts['content' if common > 1 else 'primitive'] += 1
            counts['inner-monic' if abs(answer[2]) == common else 'inner-nonmonic'] += 1
        values = [value+(0,)*(4-len(value)) for value in polynomials]
        guesses = {name: predict(values) for name, predict in CHOICE_SHORTCUTS.items()}
        for name, scores in {
            'label-length': [len(option['label']) for option in options],
            'monomial-coefficient': [greatest_monomial(value)[0] for value in polynomials],
            'squared-notation': [int(')²' in option['label']) for option in options],
        }.items():
            for suffix, extreme in [('min', min), ('max', max)]:
                guesses[name+'-'+suffix] = unique_extreme(scores, extreme)
        for index in range(4):
            guesses[f'position-{index}'] = index if index < len(options) else None
        for name, guess in guesses.items():
            evidence = self.shortcuts.setdefault((template, name), {'cases':0,'applications':0,'correct':0,'chanceTwelfths':0})
            evidence['cases'] += 1
            if guess is not None:
                evidence['applications'] += 1
                evidence['correct'] += options[guess]['id'] == key
                evidence['chanceTwelfths'] += 12//len(options)

    def finish(self, expected):
        from polynomial_math_oracle import shortcut_evidence
        require(expected >= 256, 'Factoring breadth requires at least 256 cases per template')
        for template, counts in self.counts.items():
            require(counts['cases'] == expected, 'Incomplete factoring corpus')
            required = ['positive-leading', 'negative-leading'] if template != 'monic-quadratic-factorization' else []
            if template == 'greatest-monomial-factor':
                required += ['coefficient-only','variable-only','combined','degree-1','degree-2','degree-3','terms-2','terms-3']
            else:
                required += ['zero-middle','positive-middle','negative-middle','negative-constant','positive-constant','repeated','distinct']
                if template == 'nonmonic-quadratic-factorization':
                    required += ['content','primitive','inner-monic','inner-nonmonic']
            require(all(counts[feature] > 0 for feature in required), 'Missing factoring case breadth: '+template)
        evidence = {template+'/'+name: shortcut_evidence(counts, template+'/'+name)
                    for (template,name),counts in self.shortcuts.items()}
        return {'breadth': self.counts, 'namedChoiceRules': evidence}


def check_figure(record):
    kind = record['figureKind']
    expected = {'gcf': ([(3,1)], [(2,1),(3,0)]),
                'monic': ([(1,1),(2,0)], [(1,1),(3,0)]),
                'nonmonic': ([(3,1),(1,0)], [(2,1),(3,0)])}
    require(kind in expected, 'Unknown factoring figure')
    rows, columns = expected[kind]
    root = ET.fromstring(record['html']); svg = root.find('svg')
    require(svg is not None and svg.attrib.get('role') == 'img' and svg.attrib.get('aria-label'),
            'Missing accessible factoring product table')
    bottom = 80+80*len(rows)
    require(svg.attrib.get('viewBox') == f'0 0 400 {bottom+65}', 'Changed product-table bounds')
    def elements(attribute):
        return [node for node in svg.iter('text') if attribute in node.attrib]
    def verify(node, term, x, y):
        coefficient, power = term
        require(node.attrib.get('data-coefficient') == str(coefficient)
                and node.attrib.get('data-exponent') == str(power), 'Incorrect product-table metadata')
        require(''.join(node.itertext()) == polynomial_label((0,)*power+(Fraction(coefficient),)),
                'Visible product-table label contradicts its quantity')
        require(Fraction(node.attrib['x']) == x and Fraction(node.attrib['y']) == y
                and node.attrib.get('text-anchor') == 'middle', 'Misplaced product-table label')
        require('26px' in node.attrib.get('style',''), 'Product-table label is too small')
    row_nodes, col_nodes, products = elements('data-row'), elements('data-column'), elements('data-product')
    require(len(row_nodes) == len(rows) and len(col_nodes) == 2 and len(products) == 2*len(rows),
            'Missing or duplicate table entry')
    for index, (node, term) in enumerate(zip(row_nodes, rows)):
        require(node.attrib['data-row'] == str(index), 'Incorrect row ordering')
        verify(node, term, 60, 129+80*index)
    for index, (node, term) in enumerate(zip(col_nodes, columns)):
        require(node.attrib['data-column'] == str(index), 'Incorrect column ordering')
        verify(node, term, 175+130*index, 55)
    total = (Fraction(0),)
    for row_index, (a, p) in enumerate(rows):
        for col_index, (b, q) in enumerate(columns):
            node = products[2*row_index+col_index]
            require(node.attrib['data-product'] == f'{row_index},{col_index}', 'Incorrect product-cell association')
            verify(node, (a*b, p+q), 175+130*col_index, 129+80*row_index)
            total = add(total, (0,)*(p+q)+(a*b,))
    require(total == {'gcf':(0,9,6),'monic':(6,5,1),'nonmonic':(3,11,6)}[kind], 'Table sum contradicts lesson example')
    rectangles = list(svg.iter('rect'))
    require(len(rectangles) == 1 and all(Fraction(rectangles[0].attrib[name]) == value
            for name,value in {'x':110,'y':80,'width':260,'height':bottom-80}.items()), 'Table border does not bound cells')
    lines = list(svg.iter('line'))
    require(len(lines) == len(rows), 'Missing table separators')
    require(all(Fraction(lines[0].attrib[name]) == value for name,value in
                {'x1':240,'x2':240,'y1':80,'y2':bottom}.items()), 'Misplaced column separator')
    if len(rows) == 2:
        require(all(Fraction(lines[1].attrib[name]) == value for name,value in
                    {'x1':110,'x2':370,'y1':160,'y2':160}.items()), 'Misplaced row separator')
    summaries = [node for node in svg.iter('text') if node not in row_nodes+col_nodes+products
                 and ''.join(node.itertext()) != '×']
    require(len(summaries) == 1, 'Missing table product summary')
    summary = ''.join(summaries[0].itertext())
    require(summary == {'gcf':'Sum: 6x² + 9x','monic':'3x + 2x = 5x','nonmonic':'9x + 2x = 11x'}[kind],
            'Incorrect visible table summary')
    review_equalities(summary)


def publication_exercises(html):
    from inequality_math_oracle import PublicationNode
    from percent_change_math_oracle import publication_tree
    tree = publication_tree(html)
    result = []
    for index, exercise in enumerate((node for node in tree.descendants() if node.has_class('exercise')), 1):
        nodes = list(exercise.descendants())
        headings = [node for node in nodes if node.tag == 'h2']
        require(len(headings) == 1 and headings[0].text().startswith(f'{index}. '), 'Incorrect exercise numbering')
        choices = [node for node in nodes if node.has_class('print-choices')]
        require(len(choices) == 1 and choices[0].attributes.get('type') == 'A', 'Missing printed choices')
        def items(node):
            children = [child for child in node.children if isinstance(child, PublicationNode)]
            require(all(child.tag == 'li' for child in children), 'Malformed printed list')
            return [child.text().strip() for child in children]
        ordered = [node for node in nodes if node.tag == 'ol' and not node.has_class('print-choices')]
        require(len(ordered) <= 1, 'Extra worked step list')
        answers = [node.text().strip() for node in nodes if node.tag == 'strong' and node.text().startswith('Answer: ')]
        require(len(answers) <= 1 and bool(answers) == bool(ordered), 'Missing or leaked printed answer')
        result.append({'prompt': headings[0].text()[len(f'{index}. '):], 'choices': items(choices[0]),
                       'steps': items(ordered[0]) if ordered else [],
                       'answer': answers[0][len('Answer: '):] if answers else None})
    require(len(result) == 12, 'Require twelve printed factoring exercises')
    return result


def check_worksheet(record):
    problems = record['problems']
    require(len(problems) == 12 and record['replayed'] == problems, 'Worksheet cases do not replay')
    require(all(problem['public']['templateId'] == record['templateId'] for problem in problems), 'Wrong worksheet template')
    targets = [read_polynomial(polynomial_of(record['templateId'], problem['public']['prompt'])) for problem in problems]
    require(len(set(targets)) == 12, 'Duplicate worksheet polynomials')
    if record['templateId'] == 'greatest-monomial-factor':
        factors = [greatest_monomial(target) for target in targets]
        require({len(target)-1 for target in targets} == {1,2,3}, 'Worksheet lacks polynomial degrees')
        require(any(power == 0 for _,power in factors) and any(common == 1 for common,_ in factors)
                and any(common > 1 and power > 0 for common,power in factors), 'Worksheet lacks common-factor interpretations')
        require({sum(v != 0 for v in target) for target in targets} == {2,3}, 'Worksheet lacks term-count variety')
        require(any(target[-1] < 0 for target in targets), 'Worksheet lacks negative-leading extraction')
    else:
        require(any(target[1] == 0 for target in targets) and any(target[1] < 0 for target in targets)
                and any(target[1] > 0 for target in targets), 'Worksheet lacks middle-term signs or cancellation')
        require(any(target[0] < 0 for target in targets) and any(target[0] > 0 for target in targets), 'Worksheet lacks signed constants')
        require(any(target[1]**2 == 4*target[0]*target[2] for target in targets), 'Worksheet lacks repeated factors')
        if record['templateId'] == 'nonmonic-quadratic-factorization':
            require(any(target[2] < 0 for target in targets) and any(target[2] > 0 for target in targets), 'Worksheet lacks leading-coefficient signs')
            require(any(greatest_monomial(target)[0] > 1 for target in targets), 'Worksheet lacks numerical content')
            require(any(abs(target[2]) == greatest_monomial(target)[0] for target in targets), 'Worksheet lacks monic-inside reduction')
    workbook = publication_exercises(record['workbookHtml'])
    solutions = publication_exercises(record['solutionsHtml'])
    chains = 0
    for problem, blank, worked in zip(problems, workbook, solutions):
        chains += review_explanation(problem)
        public = problem['public']; options = public['response']['options']
        require(blank['prompt'] == worked['prompt'] == public['prompt'], 'Printed prompt/order changed')
        require(blank['choices'] == worked['choices'] == [option['label'] for option in options], 'Printed choices/order changed')
        require(blank['answer'] is None and not blank['steps'], 'Workbook leaks worked solution')
        require(worked['steps'] == problem['explanation'], 'Printed algebra differs from runtime')
        expected = next(option['label'] for option in options if option['id'] == solve_factoring(public))
        require(worked['answer'] == expected, 'Printed answer is not the independently derived factorization')
    return chains


def check_lesson(record):
    from percent_change_math_oracle import publication_tree
    lesson = record['lesson']; template = record['templateId']
    require(lesson['id'] == template and lesson['templateIds'] == [template], 'Wrong lesson binding')
    example = lesson['workedExample']
    target = read_polynomial(polynomial_of(template, example['prompt']))
    require(expand(example['answer']) == target, 'Incorrect standalone worked answer')
    if template == 'greatest-monomial-factor':
        read_factorization(template, example['answer'])
    require(sum(review_equalities(step) for step in example['steps']) >= 2, 'Missing explicit lesson arithmetic')
    require(any('Check' in step or 'Expanding' in step for step in example['steps']), 'Missing standalone expansion check')
    text = publication_tree(record['html']).text()
    require(example['prompt'] in text and example['answer'] in text
            and all(step in text for step in example['steps']), 'Rendered lesson omits reviewed example')
    for section in lesson['sections']:
        require(section['title'] in text and all(paragraph in text for paragraph in section['paragraphs']),
                'Rendered lesson omits explanatory text')


def review_content_mutations(records):
    """Prove local gates reject wrong math, omitted variety, and rendered drift."""
    runtime = next(record for record in records if record['kind'] == 'factoring-runtime')
    worksheet = next(record for record in records if record['kind'] == 'factoring-worksheet')
    lesson = next(record for record in records if record['kind'] == 'factoring-lesson')
    figure = next(record for record in records if record['kind'] == 'factoring-figure')
    rejected = 0
    def reject(check, value):
        nonlocal rejected
        try:
            check(value)
        except ValueError:
            rejected += 1
            return
        raise ValueError('Factoring corruption escaped its independent gate')
    bad = copy.deepcopy(runtime['problem']); bad['answer'] = 'option-invalid'; reject(review_explanation,bad)
    bad = copy.deepcopy(runtime['problem']); bad['explanation'][0] = 'Common positive coefficient factors: 1. The greatest is 1.'
    if bad['explanation'][0] == runtime['problem']['explanation'][0]:
        bad['explanation'][0] = 'Common positive coefficient factors: 1, 2. The greatest is 2.'
    reject(review_explanation,bad)
    bad = copy.deepcopy(runtime['problem']); bad['explanation'].append('Check: x² + 1 = (x − 1)(x + 1).'); reject(review_explanation,bad)
    bad = copy.deepcopy(runtime['problem']); bad['choiceFeedback'] = {}; reject(review_explanation,bad)
    bad = copy.deepcopy(runtime['problem']); option = next(iter(bad['choiceFeedback']))
    bad['choiceFeedback'][option] = bad['choiceFeedback'][option].replace('expands to ', 'expands to x + ')
    reject(review_explanation,bad)
    bad = copy.deepcopy(worksheet); bad['problems'][-1] = bad['problems'][0]; bad['replayed'] = bad['problems']; reject(check_worksheet,bad)
    bad = copy.deepcopy(worksheet); bad['replayed'][0]['answer'] = 'option-invalid'; reject(check_worksheet,bad)
    bad = copy.deepcopy(worksheet); bad['solutionsHtml'] = bad['solutionsHtml'].replace('Answer: ', 'Key: ',1); reject(check_worksheet,bad)
    bad = copy.deepcopy(worksheet); bad['workbookHtml'] = bad['solutionsHtml']; reject(check_worksheet,bad)
    bad = copy.deepcopy(lesson); bad['lesson']['workedExample']['answer'] = '3x(2x + 4)'; reject(check_lesson,bad)
    bad = copy.deepcopy(figure); bad['html'] = bad['html'].replace('>6x²<','>7x²<',1); reject(check_figure,bad)
    bad = copy.deepcopy(figure); bad['html'] = bad['html'].replace('x="175"','x="174"',1); reject(check_figure,bad)
    bad = copy.deepcopy(figure); bad['html'] = bad['html'].replace('width="260"','width="259"',1); reject(check_figure,bad)
    quadratic = next(record['problem'] for record in records if record['kind'] == 'factoring-runtime'
                     and record['templateId'] == 'nonmonic-quadratic-factorization')
    bad = copy.deepcopy(quadratic); bad['explanation'][0] += ' Ignore the GCF.'; reject(review_explanation,bad)
    bad = copy.deepcopy(quadratic)
    options = bad['public']['response']['options']; key = bad['answer']
    bad['public']['response']['options'] = [option for option in options if option['id'] == key] + [next(option for option in options if option['id'] != key)]
    reject(review_explanation,bad)
    return rejected


def review_factoring_content(records=None):
    if records is None:
        app = Path(__file__).resolve().parent.parent
        result = subprocess.run(['node','--import','tsx','scripts/factoring-content-oracle.ts'],
                                cwd=app, text=True, capture_output=True, timeout=180)
        require(result.returncode == 0, 'Factoring content export failed: '+result.stderr[-3000:])
        records = [json.loads(line) for line in result.stdout.splitlines()]
    manifest = records[0]
    require(manifest['kind'] == 'factoring-manifest' and manifest['runtimeSeeds'] == 1024
            and manifest['editions'] == 16, 'Incomplete factoring content manifest')
    templates = manifest['templates']
    require(len(templates) == 3 and {template['id'] for template in templates} == FACTORING,
            'Missing factoring runtime registration')
    require(all(template['version'] == 1 and template['skillId'] == 'factor-quadratics'
                and template['requiredResponseCapability'] == 'single-choice-v1' for template in templates),
            'Wrong factoring metadata')
    require(manifest['coverageValid'] and manifest['defaultCoverage'] == manifest['overrideCoverage'],
            'Factoring coverage missing under empty override')
    skill = manifest['skill']
    require(skill['id'] == 'factor-quadratics' and set(skill['prerequisites']) == {'polynomial-arithmetic','gcf-lcm'},
            'Wrong factoring prerequisites')
    require({row['id']:row['allowed'] for row in manifest['calculator']} == {template:False for template in FACTORING},
            'Calculator must be disabled for factoring practice')
    bindings = {'factor-quadratics.monomial-gcf':'greatest-monomial-factor',
                'factor-quadratics.monic-integer-factors':'monic-quadratic-factorization',
                'factor-quadratics.nonmonic-integer-factors':'nonmonic-quadratic-factorization'}
    require({row['facetId']:row['templateId'] for row in manifest['mappings']} == bindings
            and all(row['extent'] == 'partial' for row in manifest['mappings']), 'Incorrect factoring assessment extent')
    facets = manifest['defaultCoverage']['facets']
    own = {row['id']:[t for t in row['templateIds'] if t in FACTORING] for row in facets}
    require({facet:ids for facet,ids in own.items() if ids} == {facet:[template] for facet,template in bindings.items()}
            and not any(row['independentlyReviewed'] for row in facets if own[row['id']])
            and not manifest['defaultCoverage'].get('fullyCovered'), 'Coverage must not overclaim whole-facet review')
    review = FactoringReview(); seen = set(); chains = 0
    for record in records[1:]:
        kind = record['kind']
        if kind == 'factoring-runtime':
            identity = (kind, record['templateId'], record['index'])
            require(0 <= record['index'] < 1024 and record['problem'] == record['replayed'], 'Unreplayable factoring case')
            public = record['problem']['public']
            require(public['templateId'] == record['templateId']
                    and public['seed'] == f'factoring-independent-{record["index"]}', 'Runtime evidence identity changed')
            chains += review_explanation(record['problem'])
            review.record(public, solve_factoring(public))
        elif kind == 'factoring-worksheet':
            identity = (kind, record['templateId'], record['edition'])
            require(record['edition'] in {str(n) for n in range(1,17)}, 'Wrong worksheet edition')
            chains += check_worksheet(record)
        elif kind == 'factoring-lesson':
            identity = (kind, record['templateId']); check_lesson(record)
        elif kind == 'factoring-figure':
            identity = (kind, record['figureKind']); check_figure(record)
        else:
            raise ValueError('Unknown factoring content evidence')
        require(identity not in seen, 'Repeated factoring evidence'); seen.add(identity)
    expected = ({('factoring-runtime', template, index) for template in FACTORING for index in range(1024)}
                | {('factoring-worksheet', template, str(edition)) for template in FACTORING for edition in range(1,17)}
                | {('factoring-lesson', template) for template in FACTORING}
                | {('factoring-figure', kind) for kind in ['gcf','monic','nonmonic']})
    require(seen == expected, 'Incomplete factoring content evidence')
    review.finish(1024)
    return {'runtimeCases':3072, 'worksheets':48, 'lessons':3, 'figures':3, 'exactEqualityChains':chains,
            'rejectedContentMutations':review_content_mutations(records)}


def review_factoring_fixtures():
    def given(template, polynomial, labels):
        prefix = ('Factor out the greatest common monomial factor with positive coefficient: '
                  if template == 'greatest-monomial-factor' else 'Factor completely over the integers: ')
        return {'templateId': template, 'prompt': prefix+polynomial+'.',
                'response': {'kind': 'choice', 'options': [
                    {'id': f'option-{index}', 'label': label} for index, label in enumerate(labels)]}}
    cases = [
        (given('greatest-monomial-factor', '6x² + 9x', ['3x(2x + 3)', '3x(2x − 3)']), 'option-0'),
        (given('greatest-monomial-factor', '−8x³ + 12x²', ['4x²(2x + 3)', '4x²(−2x + 3)']), 'option-1'),
        (given('greatest-monomial-factor', '6x² − 6', ['6(x² + 1)', '6(x² − 1)']), 'option-1'),
        (given('greatest-monomial-factor', 'x² − 7x', ['x(x − 7)', 'x(x + 7)']), 'option-0'),
        (given('monic-quadratic-factorization', 'x² + 5x + 6', ['(x + 2)(x + 3)', '(x + 1)(x + 6)']), 'option-0'),
        (given('monic-quadratic-factorization', 'x² − 8x + 16', ['(x − 8)(x − 2)', '(x − 4)²']), 'option-1'),
        (given('monic-quadratic-factorization', 'x² − 9', ['(x − 9)(x + 1)', '(x − 3)(x + 3)']), 'option-1'),
        (given('nonmonic-quadratic-factorization', '6x² + 11x + 3', ['(x + 1)(6x + 3)', '(2x + 3)(3x + 1)']), 'option-1'),
        (given('nonmonic-quadratic-factorization', '−x² − 8x − 16', ['−(x − 4)²', '−(x + 4)²']), 'option-1'),
        (given('nonmonic-quadratic-factorization', '2x² − 10x + 12', ['2(x − 3)(x − 2)', '2(x − 6)(x − 1)']), 'option-0'),
        (given('nonmonic-quadratic-factorization', '−6x² − 22x + 8', ['−2(x − 4)(3x + 1)', '−2(x + 4)(3x − 1)']), 'option-1'),
    ]
    reframed = copy.deepcopy(cases[4][0]); reframed['prompt'] = 'Which product equals x² + 5x + 6? Choose the complete factorization over the integers.'
    cases.append((reframed, 'option-0'))
    reframed = copy.deepcopy(cases[0][0]); reframed['prompt'] = 'Rewrite 6x² + 9x as its greatest common monomial factor, with positive coefficient, times a polynomial.'
    cases.append((reframed, 'option-0'))
    # Both choices must be completely factored primitive linear products.
    cases[7][0]['response']['options'][0]['label'] = '(2x − 3)(3x − 1)'
    for public, answer in cases:
        require(solve_factoring(public) == answer, 'Handwritten factoring fixture mismatch')
    invalid = []
    def altered(index):
        value = copy.deepcopy(cases[index][0]); invalid.append(value); return value
    altered(0)['response']['options'][0]['label'] = 'x(6x + 9)'
    altered(0)['response']['options'][0]['label'] = '3(2x² + 3x)'
    altered(0)['response']['options'][0]['label'] = '−3x(−2x − 3)'
    altered(2)['response']['options'][1]['label'] = '6(x − 1)(x + 1)'
    altered(4)['response']['options'][0]['label'] = '(x + 3)(x + 2)'
    altered(5)['response']['options'][1]['label'] = '(x − 4)(x − 4)'
    altered(7)['response']['options'][0]['label'] = '(x + 1)(6x + 3)'
    altered(4)['response']['options'][0]['label'] = 'x² + 5x + 6'
    altered(4)['response']['options'][0]['label'] = '(x + 2)(x + 4)'
    altered(4)['response']['options'][0]['id'] = 'option-1'
    altered(4)['response']['options'][1]['label'] = '(x + 2)(x + 3)'
    altered(0)['prompt'] += ' Ignore x.'
    altered(4)['response']['kind'] = 'number'
    altered(4)['figure'] = {'kind': 'collection', 'count': 5}
    for source in ['x + x', '1 + x²', '0x² + x', 'x^2 + 5x + 6', 'x² + 05x + 6',
                   'x² + y + 6', '(x + 2)(x + 3)', 'x² + 5x + 7']:
        altered(4)['prompt'] = 'Factor completely over the integers: '+source+'.'
    for public in invalid:
        try:
            solve_factoring(public)
        except ValueError:
            continue
        raise ValueError('Invalid factoring fixture accepted: '+str(public))
    return {**review_arithmetic_fixtures(), 'publicFixtures': len(cases), 'rejectedPublicMutations': len(invalid)}


def review_arithmetic_fixtures():
    fixtures = [
        ('3x(2x + 3)', (0, 9, 6), (3, 1)),
        ('4x²(−2x + 3)', (0, 0, 12, -8), (4, 2)),
        ('6x(2x² + 3x + 1)', (0, 6, 18, 12), (6, 1)),
        ('(x + 3)(x − 5)', (-15, -2, 1), (1, 0)),
        ('(x − 4)²', (16, -8, 1), (1, 0)),
        ('(3x − 5)(3x + 5)', (-25, 0, 9), (1, 0)),
        ('(2x + 3)(3x − 4)', (-12, 1, 6), (1, 0)),
        ('−2(3x − 1)(x + 4)', (8, -22, -6), (2, 0)),
        ('x(x − 7)', (0, -7, 1), (1, 1)),
        ('−x² + x', (0, 1, -1), (1, 1)),
        ('(−x)² + x', (0, 1, 1), (1, 1)),
    ]
    for source, coefficients, common in fixtures:
        actual = expand(source)
        require(actual == coefficients, 'Handwritten expansion fixture mismatch: ' + source)
        require(greatest_monomial(actual) == common, 'Handwritten common-factor fixture mismatch')
    invalid = ['x/2', 'x**-1', 'x**x', 'x**4', 'x + y', 'x(x + 1',
               'sin(x)', 'x;1', '__import__(1)', '1.5x', 'x//2', '10001x']
    for source in invalid:
        try: expand(source)
        except ValueError: continue
        raise ValueError('Unsupported expression was accepted: ' + source)
    require(expand('(x − 1)(x + 1)') != expand('x² + 1'), 'False identity accepted')
    return {'handwrittenExpansions': len(fixtures), 'rejectedExpressions': len(invalid)}


if __name__ == '__main__':
    print(review_factoring_fixtures())
