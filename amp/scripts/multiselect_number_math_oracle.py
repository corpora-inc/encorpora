"""Independent oracle for the select-all number families.

Every statement is evaluated from its own displayed numbers in exact
arithmetic (Fraction, Decimal); generated answers, explanations and hints
never enter `verdicts`. Rounding is half-up, the convention the prompts use.
"""
import re
from decimal import Decimal, ROUND_HALF_UP, getcontext
from fractions import Fraction

import multiselect_oracle_kit as kit
from multiselect_oracle_kit import require, strip_commas, whole_numbers, options_of

getcontext().prec = 60
SUPPORTED = frozenset({
    'place-value-forms-select', 'equivalent-fractions-select', 'fraction-line-names-select',
    'equivalent-ratios-select', 'rounds-to-select', 'compare-to-pi-select',
    'multiplication-fact-grid-select', 'equal-factor-equations-select',
})
REVIEW_RETURNS_ANSWER = True
PI = Decimal('3.14159265358979323846264338327950288419716939937510582097494')

ONES = {w: i for i, w in enumerate('zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split())}
TENS = {w: 10 * i for i, w in enumerate('zero ten twenty thirty forty fifty sixty seventy eighty ninety'.split())}


def words_to_number(text):
    total = current = 0
    for token in re.split(r'[\s,-]+', text.strip().lower()):
        if token in ONES:
            current += ONES[token]
        elif token in TENS:
            current += TENS[token]
        elif token == 'hundred':
            current *= 100
        elif token in ('thousand', 'million'):
            total += current * (1000 if token == 'thousand' else 10**6)
            current = 0
        else:
            raise ValueError(f'Unknown number word: {token}')
    return total + current


def fraction_of(tex):
    m = re.fullmatch(r'\\frac\{(\d+)\}\{(\d+)\}', tex)
    require(m is not None, f'Not a fraction: {tex}')
    return int(m.group(1)), int(m.group(2))


def only_span(label):
    spans = kit.dollars(label)
    require(len(spans) == 1, f'Expected one typeset span: {label}')
    return spans[0]


def place_value(public):
    (n,) = whole_numbers(public['prompt'])[:1]
    out = []
    for o in options_of(public):
        label = o['label']
        m = re.fullmatch(r'\$([\d{},]+)\$ is (less than|greater than|equal to) (.+)', label)
        if m:
            require('true comparisons' in public['prompt'], 'Comparison under an expression prompt')
            require(int(strip_commas(m.group(1))) == n, 'Comparison names another number')
            other = words_to_number(m.group(3))
            out.append({'less than': n < other, 'greater than': n > other, 'equal to': n == other}[m.group(2)])
        else:
            require('expressions that are equal' in public['prompt'], 'Expression under a comparison prompt')
            value = kit.arith(only_span(label))
            out.append(value == n)
    return out


def equivalent_fractions(public):
    a, b = fraction_of(only_span(public['prompt']))
    out, pairs, falsy = [], [], []
    for o in options_of(public):
        c, d = fraction_of(only_span(o['label']))
        require(d > 0, 'Zero denominator')
        pairs.append((c, d))
        out.append(c * b == d * a)
        if not out[-1]:
            falsy.append(Fraction(c, d))
    require(len(set(pairs)) == len(pairs), 'Repeated fraction')
    require(len(set(falsy)) == len(falsy), 'Two non-equivalent options are the same value')
    require((a, b) not in pairs, 'The given fraction is itself an option')
    return out


def fraction_line(public):
    (line,) = [e for e in kit.elements(public) if e['type'] == 'numberLine']
    require(line['min'] == 0 and line['max'] == 1 and len(line['marks']) == 1, 'Expected one point on 0 to 1')
    parts = line['denominator']
    require(f'cut into {parts} equal parts' in public['prompt'], 'Prompt and drawn parts disagree')
    scaled = line['marks'][0]['at'] * parts
    require(abs(scaled - round(scaled)) < 1e-9 and 0 < round(scaled) < parts, 'Point is not on a mark')
    position = Fraction(round(scaled), parts)
    require(f"Point ${line['marks'][0]['label']}$" in public['prompt'], 'Point letter')
    out, pairs = [], []
    for o in options_of(public):
        c, d = fraction_of(only_span(o['label']))
        pairs.append((c, d))
        out.append(Fraction(c, d) == position)
    require(len(set(pairs)) == len(pairs), 'Repeated fraction')
    return out


def equivalent_ratios(public):
    m = re.search(r'\$(\d+)\$ (.+?) for every \$(\d+)\$ (.+?)\. Select', public['prompt'])
    require(m is not None, 'Ratio givens not found')
    a, noun_a, b, noun_b = int(m.group(1)), m.group(2), int(m.group(3)), m.group(4)
    out, seen = [], []
    for o in options_of(public):
        g = re.fullmatch(r'\$(\d+)\$ (.+?) and \$(\d+)\$ (.+)', o['label'])
        require(g is not None, f"Ratio statement: {o['label']}")
        c, d = int(g.group(1)), int(g.group(3))
        require((g.group(2), g.group(4)) == (noun_a, noun_b), 'Statement swaps the quantities')
        seen.append((c, d))
        out.append(c * b == d * a)
    require(len(set(seen)) == len(seen), 'Repeated group')
    return out


def rounds_to(public):
    m = re.fullmatch(r'Select the \d+ numbers that round to \$([\d.]+)\$ at the nearest (whole number|tenth|hundredth)\.', public['prompt'])
    require(m is not None, 'Rounding prompt')
    target = Decimal(m.group(1))
    step = {'whole number': Decimal(1), 'tenth': Decimal('0.1'), 'hundredth': Decimal('0.01')}[m.group(2)]
    require(target == target.quantize(step), 'Target not written to the stated place')
    out, seen = [], []
    for o in options_of(public):
        value = Decimal(only_span(o['label']))
        seen.append(value)
        half = (value / step) % 1 == Decimal('0.5')
        require(not half, f'Value {value} sits exactly on a rounding boundary')
        out.append(value.quantize(step, rounding=ROUND_HALF_UP) == target)
    require(len(set(seen)) == len(seen), 'Repeated number')
    return out


def real_value(tex):
    """Decimal value of $3.14$, $\\frac{22}{7}$, $\\sqrt{12}$ or a whole number."""
    m = re.fullmatch(r'\\sqrt\{(\d+)\}', tex)
    if m:
        return Decimal(int(m.group(1))).sqrt()
    m = re.fullmatch(r'\\frac\{(\d+)\}\{(\d+)\}', tex)
    if m:
        return Decimal(int(m.group(1))) / Decimal(int(m.group(2)))
    require(re.fullmatch(r'\d+(\.\d+)?', tex) is not None, f'Not a number: {tex}')
    return Decimal(tex)


def compare_to_pi(public):
    m = re.fullmatch(r'Select the \d+ numbers that are (less|greater) than \$(.+)\$\.', public['prompt'])
    require(m is not None, 'Comparison prompt')
    target = PI if m.group(2) == '\\pi' else real_value(m.group(2))
    out, seen = [], []
    for o in options_of(public):
        tex = only_span(o['label'])
        v = real_value(tex)
        require(v != target, 'An option equals the comparison number')
        require(abs(v - target) > Decimal('1e-12'), 'Too close to tell apart')
        seen.append(v)
        out.append(v < target if m.group(1) == 'less' else v > target)
    require(len(set(seen)) == len(seen), 'Two options are the same number')
    return out


def multiplication_grid(public):
    m = re.fullmatch(r'Select the \d+ multiplication facts that have a product of \$(\d+)\$\.', public['prompt'])
    require(m is not None, 'Multiplication prompt')
    product, out, pairs = int(m.group(1)), [], []
    for o in options_of(public):
        g = re.fullmatch(r'\$(\d+)\\times(\d+)\$', o['label'])
        require(g is not None, 'Fact statement')
        a, b = int(g.group(1)), int(g.group(2))
        pairs.append(tuple(sorted((a, b))))
        out.append(a * b == product)
    require(len(set(pairs)) == len(pairs), 'The same fact appears twice')
    return out


def equation_holds(tex):
    left, right = tex.split('=')
    return kit.arith(left) == kit.arith(right)


def equal_factor_equations(public):
    """Select-all of true equations, or a true/false verdict for each equation."""
    out, seen = [], []
    for o in options_of(public):
        if kit.pair_count(public):
            m = re.fullmatch(r'\$(.+)\$ is (true|false)\.', o['label'])
            require(m is not None, f"Verdict statement: {o['label']}")
            seen.append((m.group(1), m.group(2)))
            out.append(equation_holds(m.group(1)) == (m.group(2) == 'true'))
        else:
            seen.append(only_span(o['label']))
            out.append(equation_holds(only_span(o['label'])))
    require(len(set(seen)) == len(seen), 'Repeated equation')
    if kit.pair_count(public):
        require(len({e for e, _ in seen}) == len(seen) // 2, 'An equation appears in two pairs')
    return out


VERDICTS = {
    'place-value-forms-select': place_value,
    'equivalent-fractions-select': equivalent_fractions,
    'fraction-line-names-select': fraction_line,
    'equivalent-ratios-select': equivalent_ratios,
    'rounds-to-select': rounds_to,
    'compare-to-pi-select': compare_to_pi,
    'multiplication-fact-grid-select': multiplication_grid,
    'equal-factor-equations-select': equal_factor_equations,
}


def verdicts(public):
    require(public['templateId'] in SUPPORTED, 'Wrong family')
    return VERDICTS[public['templateId']](public)


def solve(public):
    return kit.answer(public, verdicts(public))


def review_problem(problem):
    return kit.review(problem, verdicts)


def _public(template, prompt, labels, count, label, figure=None):
    public = {
        'templateId': template, 'prompt': prompt,
        'response': {'kind': 'multi-select', 'label': label, 'selectionCount': count,
                     'options': [{'id': f'option-{chr(97 + i)}', 'label': t} for i, t in enumerate(labels)]},
    }
    if figure:
        public['figure'] = figure
    return public


def self_test():
    fixtures = [
        ('equivalent-fractions-select', 'Look at the fraction $\\frac{1}{4}$. Select the 2 fractions that are equivalent to it.',
         ['$\\frac{1}{8}$', '$\\frac{3}{6}$', '$\\frac{7}{28}$', '$\\frac{6}{24}$'], 'Choose 2 fractions', '["option-c","option-d"]'),
        ('rounds-to-select', 'Select the 2 numbers that round to $271$ at the nearest whole number.',
         ['$270.23$', '$271.82$', '$270.97$', '$271.95$', '$270.67$'], 'Choose 2 numbers', '["option-c","option-e"]'),
        ('compare-to-pi-select', 'Select the 2 numbers that are less than $\\pi$.',
         ['$3.12$', '$\\frac{63}{20}$', '$3.16$', '$3.141$', '$\\frac{22}{7}$'], 'Choose 2 numbers', '["option-a","option-d"]'),
        ('place-value-forms-select', 'The number is $411{,}094$. Select the 3 true comparisons.',
         ['$411{,}094$ is less than four hundred nineteen thousand, ninety-four',
          '$411{,}094$ is less than four hundred eleven thousand, ninety-two',
          '$411{,}094$ is less than four hundred eleven thousand, five hundred ninety-four',
          '$411{,}094$ is greater than four hundred four thousand, ninety-four',
          '$411{,}094$ is greater than four hundred eleven thousand, five hundred ninety-four'], 'Choose 3 comparisons', '["option-a","option-c","option-d"]'),
        ('equivalent-ratios-select', 'Volunteer groups need $5$ students for every $2$ adults. Select the 3 groups that keep this ratio.',
         ['$10$ students and $4$ adults', '$13$ students and $4$ adults', '$14$ students and $4$ adults', '$30$ students and $12$ adults', '$35$ students and $14$ adults'],
         'Choose 3 groups', '["option-a","option-d","option-e"]'),
        ('equal-factor-equations-select', 'Select the 2 equations that are true.',
         ['$8\\times8=66$', '$18\\div3=5$', '$49\\div7=7$', '$3\\times6=21$', '$49\\div7=8$', '$121\\div11=11$'], 'Choose 2 equations', '["option-c","option-f"]'),
        ('multiplication-fact-grid-select', 'Select the 2 multiplication facts that have a product of $16$.',
         ['$4\\times8$', '$6\\times4$', '$8\\times2$', '$2\\times7$', '$3\\times8$', '$4\\times4$'], 'Choose 2 facts', '["option-c","option-f"]'),
    ]
    for template, prompt, labels, label, expected in fixtures:
        public = _public(template, prompt, labels, int(re.search(r'Select the (\d)', prompt).group(1)), label)
        require(solve(public) == expected, f'Handwritten fixture {template}')
        explanation = [f"{t}: {'true' if o['id'] in expected else 'false'}. Checked." for t, o in zip(labels, public['response']['options'])]
        kit.standard_mutants(public, expected, explanation, 'Compare each one with the given.', verdicts, solve)
    line = {'kind': 'scene', 'scene': {'v': 1, 'elements': [{'type': 'numberLine', 'min': 0, 'max': 1, 'denominator': 9, 'marks': [{'at': 6 / 9, 'label': 'P'}]}]}}
    public = _public('fraction-line-names-select', 'The number line from $0$ to $1$ is cut into 9 equal parts. Point $P$ is marked on it. Select the 3 fractions that name point $P$.',
                     ['$\\frac{3}{9}$', '$\\frac{12}{18}$', '$\\frac{6}{9}$', '$\\frac{6}{10}$', '$\\frac{2}{3}$'], 3, 'Choose 3 fractions', line)
    require(solve(public) == '["option-b","option-c","option-e"]', 'Handwritten number line fixture')
    kit.must_fail(solve, kit.tamper(public, lambda p: p['figure']['scene']['elements'][0]['marks'][0].__setitem__('at', 3 / 9)))
    kit.must_fail(solve, kit.tamper(public, lambda p: p['figure']['scene']['elements'][0]['marks'][0].__setitem__('at', 0.61)))
    boundary = _public('rounds-to-select', 'Select the 1 numbers that round to $363$ at the nearest whole number.', ['$362.5$', '$363.18$', '$362.36$'], 1, 'Choose 1 numbers')
    kit.must_fail(solve, boundary)
    for a, b in [('$411{,}094$ is less than', '$411{,}094$ is more than')]:
        kit.must_fail(solve, kit.tamper(_public('place-value-forms-select', 'The number is $411{,}094$. Select the 1 true comparisons.',
                                                [a + ' four hundred nineteen thousand, ninety-four', b + ' four hundred four thousand'], 1, 'Choose 1 comparisons'), lambda p: None))
    # true/false verdict format: one correct verdict per equation
    pair = _public('equal-factor-equations-select', 'Decide whether each of the 2 statements is true or false, and choose the correct statement for each statement.',
                   ['$64\\div8=8$ is true.', '$64\\div8=8$ is false.', '$180\\div12=14$ is true.', '$180\\div12=14$ is false.'], 2, 'Choose 2 correct statements')
    require(solve(pair) == '["option-a","option-d"]', 'Handwritten verdict-format fixture')
    problem = {'public': pair, 'answer': '["option-a","option-d"]', 'hint': 'Work out each side.',
               'explanation': ['$64\\div8=8$: true. $8\\times8=64$.', '$180\\div12=14$: false. $12\\times14=168$.']}
    require(review_problem(problem) == problem['answer'], 'Verdict-format review')
    for wrong in ['["option-b","option-d"]', '["option-a","option-c"]', '["option-a"]']:
        kit.must_fail(review_problem, dict(problem, answer=wrong))
    kit.must_fail(review_problem, dict(problem, explanation=['$64\\div8=8$: false. No.', problem['explanation'][1]]))
    kit.must_fail(solve, kit.tamper(pair, lambda p: p['response']['options'][3].__setitem__('label', '$180\\div12=15$ is false.')))
