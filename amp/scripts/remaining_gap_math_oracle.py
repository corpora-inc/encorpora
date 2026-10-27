"""Independent review of the remaining-gap practice templates.

triangle-law-reasoning, model-quantity-roles, stem-leaf-read,
budget-category-balance and gross-net-pay.

Every answer is derived from the public prompt, choices and figure only.
Money is exact integer cents; statistics use Fractions; triangle counts compare
exact squared lengths (sin^2 of the special angles is rational).
"""
import copy
import re
from figure_givens import check_figure_givens
from fractions import Fraction

TRIANGLE = 'triangle-law-reasoning'
MODEL = 'model-quantity-roles'
STEM = 'stem-leaf-read'
BUDGET = 'budget-category-balance'
PAY = 'gross-net-pay'
SUPPORTED = frozenset({TRIANGLE, MODEL, STEM, BUDGET, PAY})
CHOICE = SUPPORTED


def require(condition, message):
    if not condition:
        raise ValueError(message)


def flat(text):
    return re.sub(r'\s+', ' ', text.replace('$', '').replace('\\', '')).strip()


def options_of(public):
    return public['response']['options']


def only(options, predicate, what):
    hits = [o for o in options if predicate(o['label'])]
    require(len(hits) == 1, f'{what}: {len(hits)} choices qualify')
    return hits[0]['id']


# ---------------------------------------------------------------- triangles

# sin^2 of the angles the generator may use, exact.
SIN2 = {30: Fraction(1, 4), 45: Fraction(1, 2), 60: Fraction(3, 4), 90: Fraction(1),
        120: Fraction(3, 4), 135: Fraction(1, 2), 150: Fraction(1, 4)}


def ssa_count(angle, opposite, adjacent):
    """Triangles with angle A, side a opposite it, side b adjacent."""
    require(angle in SIN2, f'Unsupported SSA angle {angle}')
    if angle >= 90:
        return 'one' if opposite > adjacent else 'none'
    if opposite >= adjacent:
        return 'one'
    height2 = adjacent * adjacent * SIN2[angle]
    if opposite * opposite == height2:
        return 'right'
    return 'none' if opposite * opposite < height2 else 'two'


def ssa_category(label):
    text = flat(label)
    if text.startswith('No triangle') and 'shorter than the height' in text:
        return 'none'
    if text.startswith('Two triangles') and 'longer than the height' in text and 'but shorter than' in text:
        return 'two'
    if text.startswith('One triangle') and 'equals the height' in text:
        return 'right'
    if text.startswith('One triangle') and 'at least as long as' in text:
        return 'one'
    raise ValueError(f'Unclassified SSA choice: {label}')


def solve_triangle(public):
    prompt = flat(public['prompt'])
    options = options_of(public)
    # Altitude relations behind the law of sines.
    m = re.search(r'In triangle (\w)(\w)(\w), side (\w) is opposite angle (\w), side (\w) is opposite angle (\w), and side (\w) is opposite angle (\w)\. '
                  r'The altitude from (\w) meets side (\w)(\w) at D, between (\w) and (\w), and has length h\. '
                  r'Which pair of equations gives h in right triangles (\w)D(\w) and (\w)D(\w)\?', prompt)
    if m:
        v = m.groups()
        A, B, C = v[0:3]
        for side, angle in ((v[3], v[4]), (v[5], v[6]), (v[7], v[8])):
            require(side == angle.lower(), 'Side not opposite its angle')
        require(v[9] == C and {v[10], v[11]} == {A, B}, 'Unexpected altitude layout')
        sides = {v[4]: v[3], v[6]: v[5], v[8]: v[7]}
        # Right triangle ADC: hypotenuse AC lies opposite B; h is opposite A there.
        ha = f'h={sides[B]} sin {A}'.replace(' ', '')
        hb = f'h={sides[A]} sin {B}'.replace(' ', '')
        want = {ha, hb}
        return only(options, lambda t: set(re.sub(r'\s', '', flat(t)).split('and')) == want, 'altitude pair')
    # Projection of a side onto the base.
    m = re.search(r'In triangle (\w)(\w)(\w), side (\w) is opposite angle (\w), side (\w) is opposite angle (\w), and side (\w) is opposite angle (\w)\. '
                  r'The altitude from (\w) meets side (\w)(\w) at D, between (\w) and (\w)\. Let u=(\w)D, so (\w)D=(\w)-u\. '
                  r'Which expression gives u from right triangle (\w)D(\w)\?', prompt)
    if m:
        v = m.groups()
        A, B, C = v[0:3]
        sides = {v[4]: v[3], v[6]: v[5], v[8]: v[7]}
        require(v[9] == A and {v[10], v[11]} == {B, C} and v[14] == C and v[15] == B and v[16] == sides[A], 'Unexpected projection layout')
        require({v[17], v[18]} == {A, C}, 'Wrong right triangle')
        # Hypotenuse AC lies opposite B: u = AC cos C.
        hyp = sides[B]
        want = f'u={hyp}cos{C}'
        return only(options, lambda t: re.sub(r'\s', '', flat(t)) == want, 'projection')
    # Law of cosines by algebra from the stated altitude relations.
    m = re.search(r'h\^2=(\w)\^2-u\^2 and triangle \w+D\w+ gives h\^2=(\w)\^2-\((\w)-u\)\^2\. Also u=(\w) ?cos (\w)\.', prompt)
    if m:
        b, c, a, b2, angle = m.groups()
        require(b == b2, 'Projection side differs from the right-triangle hypotenuse')
        require(angle.lower() == c, 'Angle is not opposite the side being found')
        # b^2-u^2 = c^2-(a-u)^2  =>  c^2 = a^2 + b^2 - 2au,  u = b cos(angle)
        want = f'{c}^2={a}^2+{b}^2-2{a}{b}cos{angle}'
        return only(options, lambda t: re.sub(r'\s', '', flat(t)) == want, 'law of cosines')
    # Which law starts the solution.
    m = re.search(r'has (.+?)\. You want (side|angle) (\w)\. Which law starts the solution, and why\?', prompt)
    if m:
        given, kind, target = m.groups()
        sine = lambda t: flat(t).startswith('Law of sines')
        cosine = lambda t: flat(t).startswith('Law of cosines')
        sss = re.fullmatch(r'(\w)=(\d+), (\w)=(\d+) and (\w)=(\d+)', given)
        if sss:
            sides = [int(sss.group(2)), int(sss.group(4)), int(sss.group(6))]
            require(sorted(sides)[0] + sorted(sides)[1] > sorted(sides)[2], 'SSS triangle does not exist')
            require(kind == 'angle', 'SSS asks for an angle')
            return only(options, lambda t: cosine(t) and 'all three sides are known' in flat(t), 'SSS law')
        sas = re.fullmatch(r'(\w)=(\d+), (\w)=(\d+) and the angle between them, (\w)=(\d+)\^circ', given)
        if sas:
            s1, _, s2, _, ang, deg = sas.groups()
            require(0 < int(deg) < 180, 'SAS angle')
            require({s1, s2} | {ang.lower()} == {s1, s2, ang.lower()} and len({s1, s2, ang.lower()}) == 3, 'Angle must lie between the named sides')
            require(kind == 'side' and target == ang.lower(), 'SAS asks for the side opposite the angle')
            return only(options, lambda t: cosine(t) and 'lies between the two known sides' in flat(t), 'SAS law')
        aas = re.fullmatch(r'(\w)=(\d+)\^circ, (\w)=(\d+)\^circ and side (\w)=(\d+) \(opposite (\w)\)', given)
        if aas:
            a1, d1, a2, d2, side, _, opp = aas.groups()
            require(int(d1) + int(d2) < 180, 'Angle sum')
            require(side == opp.lower() and opp in (a1, a2), 'Side must be opposite a given angle')
            return only(options, lambda t: sine(t) and f'side {side} and its opposite angle {opp} are both known' in flat(t), 'AAS law')
        asa = re.fullmatch(r'(\w)=(\d+)\^circ, (\w)=(\d+)\^circ and the side between them, (\w)=(\d+)', given)
        if asa:
            a1, d1, a2, d2, side, _ = asa.groups()
            require(int(d1) + int(d2) < 180, 'Angle sum')
            third = ({'A', 'B', 'C'} if a1 in 'ABC' else {'P', 'Q', 'R'} if a1 in 'PQR' else {'X', 'Y', 'Z'}) - {a1, a2}
            (third,) = third
            require(side == third.lower(), 'Side between two angles lies opposite the third')
            squash = lambda t: re.sub(r'[\^\s]', '', flat(t))
            return only(options, lambda t: squash(t).startswith(f'Lawofsines,becausethethirdangle180circ-{a1}-{a2}givesside{side}aknownoppositeangle'), 'ASA law')
        raise ValueError(f'Unread law-choice givens: {given}')
    # Ambiguous side-side-angle count.
    m = re.search(r'In triangle (\w)(\w)(\w), angle (\w)=(\d+)circ is opposite side (\w)=(\d+), and side (\w)=(\d+) runs from (\w) to (\w)\. How many triangles', prompt.replace('^', ''))
    if m:
        A1, A2, A3, angle, deg, opp, opp_len, adj, adj_len, f, t = m.groups()
        require(opp == angle.lower() and adj != opp and adj.upper() in (A1, A2, A3), 'SSA givens')
        require(f == angle and {f, t, adj.upper()} == {A1, A2, A3}, 'Adjacent side must run from the given angle and lie opposite the third vertex')
        want = ssa_count(int(deg), int(opp_len), int(adj_len))
        cats = [ssa_category(o['label']) for o in options]
        require(len(set(cats)) == len(cats), 'Two SSA choices state the same case')
        for o in options:
            reason = flat(o['label'])
            require(f'{opp} ' in reason, 'Reason names the wrong side')
        return only(options, lambda lab: ssa_category(lab) == want, 'SSA count')
    raise ValueError('Unrecognised triangle-law prompt')


# -------------------------------------------------------------------- model

CONVERSIONS = {('hours', 'minutes'): Fraction(60), ('days', 'weeks'): Fraction(1, 7),
               ('minutes', 'hours'): Fraction(1, 60), ('weeks', 'days'): Fraction(7)}


def rate_units(prompt):
    m = re.search(r'(?<![\w-])(\d+) (\w+) (?:for )?each (\w+)', prompt)
    require(m is not None, 'No rate in the situation')
    return m.group(2), m.group(3)


def plural(unit):
    return unit if unit.endswith('s') or unit in ('liters per', ) else unit + 's'


def solve_model(public):
    prompt = flat(public['prompt'])
    options = options_of(public)
    yu, xu = rate_units(prompt)
    xu_plural = xu if xu.endswith('s') else xu + 's'
    m = re.search(r'predicts (.+?) from (.+?)\. Which definition of the variables is clearest\?', prompt)
    if m:
        y, x = m.groups()

        def ok(label):
            parts = re.fullmatch(r'(\w) = (.+?); (\w) = (.+)', flat(label))
            if not parts:
                return False
            _, first, _, second = parts.groups()
            return (first == f'{x}, in {xu_plural}' and second == f'{y}, in {yu if yu.endswith("s") else yu + "s"}')
        return only(options, ok, 'variable definitions')
    m = re.search(r'In a model of (.+?) against (.+?), which quantity, with its units, is the constant rate of change\?', prompt)
    if m:
        return only(options, lambda t: flat(t) == f'{yu} per {xu}', 'rate')
    m = re.search(r'A question asks about (half an|\d+(?:\.\d+)?|an?) (\w+)\. Which definition of (\w) keeps the model in the units of the rate\?', prompt)
    if m:
        amount_text, unit, sym = m.groups()
        amount = Fraction(1, 2) if amount_text == 'half an' else Fraction(1) if amount_text in ('a', 'an') else Fraction(amount_text)
        unit = unit if unit.endswith('s') else unit + 's'
        converted = amount * CONVERSIONS[(unit, xu_plural)]
        number = r'(\d+(?:\.\d+)?)'

        def ok(label):
            text = flat(label)
            hit = re.search(rf'in {xu_plural} \((.+?) (?:is|are) {number} {xu}s?\)$', text)
            return hit is not None and Fraction(hit.group(2)) == converted and f'{sym} = ' in text and 'time' in text
        want = [o for o in options if ok(o['label'])]
        require(len(want) == 1, f'unit match: {len(want)} choices qualify')
        # The unconverted option must be the only other time definition.
        for o in options:
            if 'counting' in o['label']:
                inner = re.search(r'in (\w+) \(counting (.+?) as (\d+(?:\.\d+)?)\)', flat(o['label']))
                require(inner is not None and inner.group(1) != xu_plural, 'Unconverted option must use the given unit')
        return want[0]['id']
    m = re.search(r'When (.+?) changes, which two quantities change\?', prompt)
    if m:
        x = m.group(1)
        quantities = set()
        for o in options:
            parts = flat(o['label']).split(' and ')
            require(len(parts) == 2, 'Choice must name two quantities')
            quantities.update(parts)
        require(len(quantities) == 4, 'Four distinct quantities expected')
        fixed = lambda q: 'starting' in q or q.endswith('fee') or 'base' in q
        rate = lambda q: ' per ' in q
        dependent = [q for q in quantities if q != x and not fixed(q) and not rate(q)]
        require(x in quantities and len(dependent) == 1, 'Cannot identify the dependent quantity')
        want = {x, dependent[0]}
        return only(options, lambda t: set(flat(t).split(' and ')) == want, 'changing quantities')
    raise ValueError('Unrecognised model-quantity prompt')


# ---------------------------------------------------------------- stem-leaf

def decimal_of(text):
    return Fraction(text)


def read_plot(public):
    prompt = public['prompt']
    elements = public['figure']['scene']['elements']
    require(len(elements) == 1 and elements[0]['type'] == 'table', 'Plot must be one table')
    table = elements[0]
    require(table.get('corner') == 'Stem' and table['columns'] == ['Leaf'], 'Plot headers')
    key = re.search(r'Key: \$(\d+)\\mid (\d)\$ means \$([\d.]+)\$', prompt)
    require(key is not None, 'No key')
    ks, kl, kv = key.groups()
    decimal = '.' in kv
    scale = Fraction(1, 10) if decimal else Fraction(1)
    require(Fraction(kv) == (int(ks) * 10 + int(kl)) * scale, 'Key value disagrees with its stem and leaf')
    values = []
    stems = []
    for row in table['rows']:
        stem = int(row['label'])
        stems.append(stem)
        leaves = row['cells'][0].split(' ')
        require(all(re.fullmatch(r'\d', x) for x in leaves), 'Leaves must be single digits')
        require(leaves == sorted(leaves), 'Leaves must be in order')
        values += [(stem * 10 + int(x)) * scale for x in leaves]
    require(stems == sorted(set(stems)) and stems == list(range(stems[0], stems[-1] + 1)), 'Stems must be consecutive and increasing')
    n = re.search(r'shows the .*? (\d+) ', prompt)
    require(n is not None and int(n.group(1)) == len(values), 'Stated count differs from the plot')
    return values, Fraction(kv), decimal


def solve_stem(public):
    values, key_value, decimal = read_plot(public)
    values = sorted(values)
    n = len(values)
    prompt = flat(public['prompt'])
    question = prompt.split('? ')[0].split('. ')[-1] + '?' if False else prompt[prompt.rindex('. ') + 2:] if prompt.count('. ') else prompt
    question = re.split(r'means [\d.]+ [^.]*?\. ', prompt)[-1] if re.search(r'means [\d.]+ [^.]*?\. ', prompt) else prompt
    options = options_of(public)
    if 'last leaf in the bottom row' in question:
        answer = values[-1]
    elif m := re.fullmatch(r'What is the (least|greatest) value in the plot\?', question):
        answer = values[0] if m.group(1) == 'least' else values[-1]
    elif question == 'What is the range of the data?':
        answer = values[-1] - values[0]
    elif question == 'What is the median of the data?':
        answer = values[n // 2] if n % 2 else (values[n // 2 - 1] + values[n // 2]) / 2
    elif question == 'Which value appears most often?':
        counts = {v: values.count(v) for v in set(values)}
        top = max(counts.values())
        modes = [v for v, k in counts.items() if k == top]
        require(top >= 2 and len(modes) == 1, 'No unique mode, so the question cannot be asked')
        answer = modes[0]
    elif m := re.fullmatch(r'How many values are greater than ([\d.]+)\?', question):
        threshold = Fraction(m.group(1))
        require(threshold in values, 'Threshold must appear in the plot')
        answer = Fraction(sum(1 for v in values if v > threshold))
    elif question == 'What is the greatest value minus the second least value?':
        require(values[1] > values[0], 'Second least value is ambiguous when the least repeats')
        answer = values[-1] - values[1]
    else:
        raise ValueError(f'Unrecognised stem-and-leaf question: {question}')
    labels = [Fraction(o['label']) for o in options]
    require(len(set(labels)) == len(labels), 'Numerically duplicate choices')
    hits = [o['id'] for o, v in zip(options, labels) if v == answer]
    require(len(hits) == 1, f'{len(hits)} choices equal {answer}')
    if not question.startswith('How many'):
        require(key_value != answer, 'The key example states the answer')
    return hits[0]


# --------------------------------------------------------------------- money

def cents(text):
    m = re.fullmatch(r'(\d+)\.(\d\d)', text)
    require(m is not None, f'Bad money amount {text}')
    return int(m.group(1)) * 100 + int(m.group(2))


def money_rows(public):
    elements = public['figure']['scene']['elements']
    require(len(elements) == 1 and elements[0]['type'] == 'table', 'Amounts must be one table')
    table = elements[0]
    require(table['columns'] == ['Dollars'] and table.get('corner') == 'Category', 'Amounts headers')
    rows = {}
    for row in table['rows']:
        require(row['label'] not in rows, 'Repeated category')
        rows[row['label']] = cents(row['cells'][0])
    return rows


def label_cents(label):
    m = re.search(r'(\d+\.\d\d) dollars$', flat(label))
    require(m is not None, f'Choice has no amount: {label}')
    return cents(m.group(1))


def check_row_count(hint, rows):
    for m in re.finditer(r'\b(?:the|all) (\d+) (?:listed )?(?:expenses|deductions)', hint or ''):
        require(int(m.group(1)) == len(rows), 'Hint miscounts the table rows')


def solve_budget(public):
    prompt = flat(public['prompt'])
    options = options_of(public)
    rows = money_rows(public)
    total = sum(rows.values())
    m = re.search(r'income of (\d+\.\d\d) dollars', prompt)
    require(m is not None, 'No income')
    income = cents(m.group(1))
    if m := re.search(r'How much can be planned for (\w+)\?', prompt):
        require(m.group(1) not in rows, 'The open category is listed')
        left = income - total
        require(left > 0, 'Nothing left to plan')
        return only(options, lambda t: label_cents(t) == left, 'missing category')
    if 'What is the result?' in prompt:
        diff = income - total
        require(diff != 0, 'Exactly balanced budget has neither surplus nor deficit')
        name = 'Surplus' if diff > 0 else 'Deficit'
        return only(options, lambda t: flat(t).startswith(name + ' of ') and label_cents(t) == abs(diff), 'surplus or deficit')
    if 'Which change works?' in prompt:
        excess = total - income
        require(excess != 0, 'Budget already balances')

        def ok(label):
            mm = re.fullmatch(r'(Reduce|Increase) (\w+) by (\d+\.\d\d) dollars', flat(label))
            require(mm is not None, f'Unreadable change {label}')
            verb, category, amount = mm.group(1), mm.group(2), cents(mm.group(3))
            require(category in rows, 'Change names an unlisted category')
            if verb == 'Reduce':
                return excess > 0 and amount == excess and amount <= rows[category]
            return excess < 0 and amount == -excess
        return only(options, ok, 'balancing change')
    raise ValueError('Unrecognised budget prompt')


def solve_pay(public):
    prompt = flat(public['prompt'])
    options = options_of(public)
    rows = money_rows(public)
    total = sum(rows.values())
    pick = lambda value: only(options, lambda t: label_cents(t) == value, 'pay amount')
    if m := re.fullmatch(r'A pay stub lists gross pay of (\d+\.\d\d) dollars and the deductions in the table\. What is the net pay\?', prompt):
        net = cents(m.group(1)) - total
        require(net > 0, 'Non-positive net pay')
        return pick(net)
    if m := re.fullmatch(r'A worker earns (\d+\.\d\d) dollars per hour and worked (\d+) hours this week\. The deductions are in the table\. What is the net pay\?', prompt):
        net = cents(m.group(1)) * int(m.group(2)) - total
        require(net > 0, 'Non-positive net pay')
        return pick(net)
    if m := re.fullmatch(r"A worker's gross pay is (\d+\.\d\d) dollars and net pay is (\d+\.\d\d) dollars\. The table shows three of the four deductions\. How much was taken out for (.+?)\?", prompt):
        gross, net, name = cents(m.group(1)), cents(m.group(2)), m.group(3)
        require(len(rows) == 3 and name not in rows, 'The missing deduction must not be listed')
        missing = gross - net - total
        require(missing > 0 and net > 0, 'Missing deduction must be positive')
        return pick(missing)
    if m := re.fullmatch(r"A pay stub shows gross pay of (\d+\.\d\d) dollars and the deductions in the table\. The worker's paycheck is the take-home pay after all deductions\. Which amount is the paycheck\?", prompt):
        net = cents(m.group(1)) - total
        require(net > 0, 'Non-positive take-home pay')
        return pick(net)
    if m := re.fullmatch(r"A worker's net pay is (\d+\.\d\d) dollars after the deductions in the table\. What was the gross pay\?", prompt):
        return pick(cents(m.group(1)) + total)
    raise ValueError('Unrecognised pay prompt')


SOLVERS = {TRIANGLE: solve_triangle, MODEL: solve_model, STEM: solve_stem, BUDGET: solve_budget, PAY: solve_pay}


def solve(public):
    require(public['templateId'] in SUPPORTED, 'Unexpected remaining-gap family')
    if public['templateId'] == TRIANGLE:
        check_figure_givens(public, require)
    return SOLVERS[public['templateId']](public)


def numbers_in(text):
    return set(re.findall(r'\d+(?:\.\d+)?', text))


def review_problem(problem):
    public = problem['public']
    result = solve(public)
    require(result == problem['answer'], 'Remaining-gap answer key mismatch')
    options = options_of(public)
    require(len({o['id'] for o in options}) == len(options) == 4, 'Four distinct choice ids expected')
    require(len({flat(o['label']) for o in options}) == 4, 'Duplicate choice text')
    correct = next(o for o in options if o['id'] == result)
    feedback = problem.get('choiceFeedback') or {}
    require(result not in feedback, 'Feedback attached to the correct choice')
    require(set(feedback) <= {o['id'] for o in options}, 'Feedback for an unknown choice')
    require(set(feedback) == {o['id'] for o in options} - {result}, 'Every wrong choice needs feedback')
    hint = problem.get('hint') or ''
    template = public['templateId']
    if template == TRIANGLE:
        label = flat(correct['label'])
        for text in (flat(public['prompt']), flat(hint)):
            require(label not in text, 'Correct triangle choice appears in the prompt or hint')
    else:
        # A numeric answer must not be stated in the hint. Numbers the prompt or
        # figure already gives are not answers, and "stem s, leaf l" only names
        # a position (a count equal to a stem digit is a coincidence).
        value = flat(correct['label'])
        number = re.search(r'\d+(?:\.\d+)?', value)
        if number:
            given = numbers_in(flat(public['prompt']))
            if 'figure' in public:
                given |= numbers_in(str(public['figure']))
            text = re.sub(r'(stem|leaf) \d+', '', flat(hint))
            if template == MODEL:
                text = flat(hint)
            if number.group(0) not in given:
                require(number.group(0) not in numbers_in(text), 'Correct value appears in the hint')
    if template in (BUDGET, PAY):
        check_row_count(hint, money_rows(public))
    if template == STEM:
        values, _, _ = read_plot(public)
        for m in re.finditer(r'There are (\d+) values', hint):
            require(int(m.group(1)) == len(values), 'Hint miscounts the values')
        # The hint's "stem s, leaf l" must name the value the question asks about.
        for m in re.finditer(r'Find ([\d.]+) in the plot: stem (\d+), leaf (\d)', hint):
            _, key_value, decimal = read_plot(public)
            scale = Fraction(1, 10) if decimal else Fraction(1)
            require(Fraction(m.group(1)) == (int(m.group(2)) * 10 + int(m.group(3))) * scale, 'Hint misreads the threshold')
        if 'greater than' in public['prompt']:
            require('right' not in hint, 'Count hint still counts leaves "to the right", which includes repeats of the value')
    return result


def self_test():
    def make(template, prompt, labels, answer, figure=None, hint='Think.'):
        public = {'templateId': template, 'prompt': prompt,
                  'response': {'kind': 'choice', 'options': [{'id': f'option-{i}', 'label': label} for i, label in enumerate(labels)]}}
        if figure:
            public['figure'] = figure
        return {'public': public, 'answer': f'option-{answer}', 'hint': hint,
                'choiceFeedback': {f'option-{i}': 'No.' for i in range(len(labels)) if i != answer}}

    def table(corner, columns, rows):
        return {'kind': 'scene', 'scene': {'v': 1, 'elements': [
            {'id': 't', 'type': 'table', 'corner': corner, 'columns': columns,
             'rows': [{'label': a, 'cells': [b]} for a, b in rows]}]}}

    plot = lambda rows: table('Stem', ['Leaf'], rows)
    money = lambda rows: table('Category', ['Dollars'], rows)
    sides = 'side $a$ is opposite angle $A$, side $b$ is opposite angle $B$, and side $c$ is opposite angle $C$'
    stem_rows = [('1', '2 6 6 7'), ('2', '1 1 2 7 8'), ('3', '0 0 5 5 9')]
    stem_prompt = 'The stem-and-leaf plot shows the minutes 14 students spent on homework last night. Key: $1\\mid 6$ means $16$ minutes. '
    dec_rows = [('3', '2 5 6 8'), ('4', '0 1 1 6 9'), ('5', '3 4')]
    dec_prompt = 'The stem-and-leaf plot shows the distances 11 students walk to school. Key: $3\\mid 2$ means $3.2$ miles. '
    good = [
        make(TRIANGLE, f'In triangle $ABC$, {sides}. The altitude from $C$ meets side $AB$ at $D$, between $A$ and $B$, and has length $h$. Which pair of equations gives $h$ in right triangles $ADC$ and $BDC$?',
             ['$h=b\\cos A$ and $h=a\\cos B$', '$h=a\\sin A$ and $h=b\\sin B$', '$h=b\\sin A$ and $h=a\\sin B$', '$h=b\\tan A$ and $h=a\\tan B$'], 2),
        make(TRIANGLE, f'In triangle $XYZ$, side $x$ is opposite angle $X$, side $y$ is opposite angle $Y$, and side $z$ is opposite angle $Z$. The altitude from $X$ meets side $YZ$ at $D$, between $Y$ and $Z$. Let $u=ZD$, so $YD=x-u$. Which expression gives $u$ from right triangle $XDZ$?',
             ['$u=y\\sin Z$', '$u=y\\cos Z$', '$u=x\\cos Z$', '$u=\\frac{y}{\\cos Z}$'], 1),
        make(TRIANGLE, 'For the altitude $h$ from $A$ to side $BC$ with $u=CD$, triangle $ADC$ gives $h^2=b^2-u^2$ and triangle $ADB$ gives $h^2=c^2-(a-u)^2$. Also $u=b\\cos C$. Which equation follows from setting the two expressions for $h^2$ equal and simplifying?',
             ['$c^2=a^2+b^2+2ab\\cos C$', '$c^2=a^2+b^2-2ab\\cos C$', '$c^2=a^2+b^2-2ab\\cos A$', '$c^2=a^2+b^2$'], 1),
        make(TRIANGLE, 'A triangle $PQR$ has $p=9$, $q=10$ and $r=8$. You want angle $R$. Which law starts the solution, and why?',
             ['Law of sines, because it connects each side with its opposite angle', 'Law of cosines, because all three sides are known and no angle is', 'Neither law, because three measurements cannot determine a triangle', 'Pythagorean theorem, because every triangle satisfies $x^2+y^2=z^2$'], 1),
        make(TRIANGLE, 'A triangle $ABC$ has $a=8$, $b=6$ and the angle between them, $C=95^\\circ$. You want side $c$. Which law starts the solution, and why?',
             ['Law of sines, because it connects each side with its opposite angle', 'Law of cosines, because the known angle lies between the two known sides', 'Neither law, because three measurements cannot determine a triangle', 'Pythagorean theorem, because every triangle satisfies $x^2+y^2=z^2$'], 1),
        make(TRIANGLE, 'A triangle $ABC$ has $A=77^\\circ$, $B=51^\\circ$ and side $a=12$ (opposite $A$). You want side $b$. Which law starts the solution, and why?',
             ['Law of cosines, because it applies to every triangle', 'Law of sines, because side $a$ and its opposite angle $A$ are both known', 'Neither law, because three measurements cannot determine a triangle', 'Pythagorean theorem, because every triangle satisfies $x^2+y^2=z^2$'], 1),
        make(TRIANGLE, 'A triangle $ABC$ has $A=41^\\circ$, $B=68^\\circ$ and the side between them, $c=9$. You want side $a$. Which law starts the solution, and why?',
             ['Law of sines, because the third angle $180^\\circ-A-B$ gives side $c$ a known opposite angle', 'Law of cosines, because it applies to every triangle', 'Neither law, because three measurements cannot determine a triangle', 'Pythagorean theorem, because every triangle satisfies $x^2+y^2=z^2$'], 0),
        make(TRIANGLE, 'In triangle $ABC$, angle $A=30^\\circ$ is opposite side $a=5$, and side $b=10$ runs from $A$ to $C$. How many triangles have these measurements?',
             ['One triangle, because $a$ equals the height $b\\sin A$ and side $a$ just reaches the base', 'No triangle, because $a$ is shorter than the height $b\\sin A$', 'Two triangles, because $a$ is longer than the height $b\\sin A$ but shorter than $b$', 'One triangle, because $a$ is at least as long as $b$'], 0),
        make(TRIANGLE, 'In triangle $ABC$, angle $A=60^\\circ$ is opposite side $a=9$, and side $b=10$ runs from $A$ to $C$. How many triangles have these measurements?',
             ['One triangle, because $a$ equals the height $b\\sin A$ and side $a$ just reaches the base', 'No triangle, because $a$ is shorter than the height $b\\sin A$', 'Two triangles, because $a$ is longer than the height $b\\sin A$ but shorter than $b$', 'One triangle, because $a$ is at least as long as $b$'], 2),
        make(MODEL, 'A tank holding 50 liters drains at 4 liters each minute. You want a model that predicts the volume left in the tank from the time the tank has been draining. Which definition of the variables is clearest?',
             ['$t$ = the time the tank has been draining, in minutes; $V$ = liters per minute', '$t$ = the time the tank has been draining; $V$ = the volume left in the tank', '$t$ = the time the tank has been draining, in minutes; $V$ = the volume left in the tank, in liters', '$t$ = the volume left in the tank, in liters; $V$ = the time the tank has been draining, in minutes'], 2),
        make(MODEL, 'A taxi charges 3 dollars for each mile driven, plus a 9-dollar pickup fee. In a model of the fare against the distance the taxi drives, which quantity, with its units, is the constant rate of change?',
             ['dollars per mile', 'dollars, as the fare', 'miles per dollar', 'dollars, as the pickup fee'], 0),
        make(MODEL, 'A seedling is 5 centimeters tall and grows 8 centimeters each week. A question asks about 35 days. Which definition of $w$ keeps the model in the units of the rate?',
             ["$w$ = the seedling's height, in centimeters", '$w$ = the time the seedling has been growing, in days (counting 35 days as 35)', '$w$ = the time the seedling has been growing, in weeks (35 days is 5 weeks)', '$w$ = the rate, in centimeters per week'], 2),
        make(MODEL, 'A gym charges a 9-dollar joining fee plus 9 dollars each month. When the number of months a member has belonged changes, which two quantities change?',
             ['dollars per month and the joining fee', 'the number of months a member has belonged and the total paid', 'the number of months a member has belonged and the joining fee', 'the total paid and dollars per month'], 1),
        make(STEM, stem_prompt + 'How many values are greater than 35?', ['0', '3', '1', '11'], 2,
             plot(stem_rows), hint='Find 35 in the plot: stem 3, leaf 5. Count the leaves in that row that are larger than leaf 5 and every leaf in the rows below it.'),
        make(STEM, stem_prompt + 'What is the median of the data?', ['21', '22', '24.5', '16.5'], 2, plot(stem_rows),
             hint='There are 14 values in order.'),
        make(STEM, dec_prompt + 'Which value appears most often?', ['3.5', '4.1', '5.3', '5.4'], 1, plot(dec_rows)),
        make(STEM, dec_prompt + 'What is the greatest value minus the second least value?', ['2.2', '1.9', '2.0', '19'], 1, plot(dec_rows)),
        make(STEM, dec_prompt + 'What is the range of the data?', ['2.2', '2.3', '2.0', '22'], 0, plot(dec_rows)),
        make(BUDGET, 'A monthly budget has income of 900.00 dollars. The planned expenses are in the table, and the whole income is to be spent. How much can be planned for Fun?',
             ['100.00 dollars', '90.00 dollars', '80.00 dollars', '700.00 dollars'], 0,
             money([('Rent', '450.25'), ('Food', '250.00'), ('Phone', '99.75')]), hint='Add the 3 listed expenses first.'),
        make(BUDGET, 'A budget has monthly income of 800.00 dollars and the planned expenses in the table. Compare the income with the total expenses. What is the result?',
             ['Surplus of 20.50 dollars', 'Deficit of 20.50 dollars', 'Deficit of 30.50 dollars', 'Surplus of 800.00 dollars'], 1,
             money([('Rent', '520.25'), ('Fun', '300.25')])),
        make(BUDGET, 'A budget has monthly income of 800.00 dollars and the planned expenses in the table. The budget must balance exactly. Which change works?',
             ['Increase Fun by 20.50 dollars', 'Reduce Fun by 30.50 dollars', 'Reduce Fun by 20.50 dollars', 'Reduce Fun by 2.05 dollars'], 2,
             money([('Rent', '620.25'), ('Fun', '200.25')])),
        make(PAY, 'A pay stub lists gross pay of 500.00 dollars and the deductions in the table. What is the net pay?',
             ['400.00 dollars', '420.00 dollars', '580.00 dollars', '80.00 dollars'], 1, money([('Federal tax', '50.00'), ('State tax', '30.00')])),
        make(PAY, 'A worker earns 14.25 dollars per hour and worked 34 hours this week. The deductions are in the table. What is the net pay?',
             ['374.50 dollars', '484.50 dollars', '394.50 dollars', '359.85 dollars'], 0, money([('Federal tax', '90.00'), ('State tax', '20.00')])),
        make(PAY, "A worker's gross pay is 499.00 dollars and net pay is 357.15 dollars. The table shows three of the four deductions. How much was taken out for State tax?",
             ['141.85 dollars', '40.00 dollars', '78.05 dollars', '397.15 dollars'], 1, money([('Federal tax', '54.95'), ('Health plan', '30.00'), ('Social Security', '16.90')])),
        make(PAY, "A worker's net pay is 253.20 dollars after the deductions in the table. What was the gross pay?",
             ['371.50 dollars', '134.90 dollars', '118.30 dollars', '333.55 dollars'], 0, money([('Federal tax', '60.00'), ('Health plan', '58.30')])),
    ]
    rejected = 0

    def reject(problem, why):
        nonlocal rejected
        try:
            review_problem(problem)
        except ValueError:
            rejected += 1
            return
        raise ValueError(f'Corrupt remaining-gap case was accepted: {why}')

    for case in good:
        review_problem(case)
        wrong = copy.deepcopy(case)
        wrong['answer'] = 'option-0' if case['answer'] != 'option-0' else 'option-1'
        reject(wrong, 'wrong key')
        twin = copy.deepcopy(case)
        index = int(case['answer'][-1])
        other = 0 if index != 0 else 1
        twin['public']['response']['options'][other]['label'] = twin['public']['response']['options'][index]['label']
        reject(twin, 'duplicate correct choice')

    def mutate(index, fn):
        bad = copy.deepcopy(good[index])
        fn(bad['public'])
        reject(bad, f'corrupt givens #{index}')

    sub = lambda a, b: (lambda p: p.update(prompt=p['prompt'].replace(a, b)))
    cell = lambda r, v: (lambda p: p['figure']['scene']['elements'][0]['rows'][r].update(cells=[v]))
    mutate(0, sub('altitude from $C$', 'altitude from $A$'))
    mutate(2, sub('b\\cos C', 'b\\cos A'))
    mutate(3, sub('$r=8$', '$r=80$'))
    mutate(4, sub('$C=95^\\circ$', '$B=95^\\circ$'))
    mutate(5, sub('(opposite $A$)', '(opposite $B$)'))
    mutate(6, sub('side between them, $c=9$', 'side between them, $a=9$'))
    mutate(7, sub('$a=5$', '$a=6$'))
    mutate(8, sub('$a=9$', '$a=7$'))
    mutate(9, sub('predicts the volume left in the tank from the time the tank has been draining', 'predicts the time the tank has been draining from the volume left in the tank'))
    mutate(10, sub('3 dollars for each mile', '3 dollars for each kilometer'))
    mutate(11, sub('35 days', '28 days'))
    mutate(12, lambda p: p['response']['options'][1].update(label='the number of months a member has belonged and dollars per month'))
    mutate(13, cell(0, 'x') if False else (lambda p: p['figure']['scene']['elements'][0]['rows'][2].update(cells=['0 0 5 5 5'])))
    mutate(14, lambda p: p['figure']['scene']['elements'][0]['rows'][1].update(cells=['1 1 2 9 9']))
    mutate(15, lambda p: p['figure']['scene']['elements'][0]['rows'][1].update(cells=['0 6 6 9 9']))
    mutate(16, lambda p: p['figure']['scene']['elements'][0]['rows'][2].update(cells=['3 9']))
    mutate(17, lambda p: p['figure']['scene']['elements'][0]['rows'][0].update(cells=['1 5 6 8']))
    mutate(18, cell(2, '99.75') if False else sub('900.00', '905.00'))
    mutate(19, cell(0, '520.75'))
    mutate(20, sub('800.00', '810.00'))
    mutate(21, cell(0, '60.00'))
    mutate(22, sub('34 hours', '33 hours'))
    mutate(23, sub('357.15', '367.15'))
    mutate(24, cell(0, '61.00'))
    # Derived-rule corruptions that the generator must never produce.
    bad = copy.deepcopy(good[13])
    bad['hint'] = 'Count the leaves to its right in that row and every leaf below.'
    reject(bad, 'repeat-blind count hint')
    bad = copy.deepcopy(good[19])
    bad['hint'] = 'The result is a deficit of 20.50 dollars.'
    reject(bad, 'hint states the answer')
    bad = copy.deepcopy(good[20])
    bad['public']['response']['options'][2]['label'] = 'Reduce Fun by 250.00 dollars'
    reject(bad, 'reduction larger than the category')
    bad = copy.deepcopy(good[15])
    bad['public']['figure']['scene']['elements'][0]['rows'] = [dict(r, cells=[c]) for r, c in zip(bad['public']['figure']['scene']['elements'][0]['rows'], ['2 2 3 4', '1 1 6 9', '3 3 4'])]
    bad['public']['response']['options'][1]['label'] = '3.2'
    reject(bad, 'tied mode asked as unique')
    return {'fixtures': len(good), 'rejectedMutations': rejected}

# Read by independent-math-review.py (FamilyOracle).
CHOICE_REVIEW = SUPPORTED



if __name__ == '__main__':
    print(self_test())
