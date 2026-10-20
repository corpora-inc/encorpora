"""Independent oracle for whole-number powers (6.EE.A.1, 6.EE.A.2c).

Each prompt is read as written: TeX is translated to an arithmetic expression
over a restricted alphabet and evaluated with Python integers; a missing
exponent is found by search; choice options are evaluated and compared; a
doubling story is checked against its bars and evaluated by repeated
multiplication. Generated answers, hints and explanations never enter
`solve_power`. The review also holds `integer-power` to the no-calculator
bounds the product promises.
"""
import re
from fractions import Fraction

POWER = frozenset({
    'integer-power', 'power-missing-exponent', 'power-repeated-product',
    'power-compare', 'power-order-trap', 'power-doubling-story',
})
POWER_CHOICE = frozenset({'power-repeated-product', 'power-compare'})
# Largest exponent (2 or more) offered for each base without a calculator.
MENTAL_LIMIT = {2: 10, 3: 5, 4: 4, 5: 4, 6: 3, 7: 3, 8: 3, 9: 3, 10: 6}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def value(tex):
    """Evaluate a TeX arithmetic expression: digits, + − · ^{} and ( )."""
    t = tex.replace('{,}', '').replace('\\cdot', '*').replace(' ', '')
    t = re.sub(r'\^\{?(\d+)\}?', r'**\1', t)
    require(re.fullmatch(r'[\d+*()\-]+', t) is not None, f'Unreadable expression {tex!r}')
    return eval(t, {'__builtins__': {}}, {})  # restricted to integer arithmetic


def maths(text):
    return re.findall(r'\$([^$]+)\$', text)


def evaluate_power(prompt):
    m = re.fullmatch(r'(?:What is|Evaluate|Find the value of) \$(\d+)\^\{(\d+)\}\$[?.]', prompt)
    require(m is not None, f'Unrecognized power prompt: {prompt}')
    b, e = int(m[1]), int(m[2])
    require(2 <= b <= 10, 'Base out of range')
    require(e <= 1 or e <= MENTAL_LIMIT[b], f'{b}^{e} is beyond mental arithmetic')
    result = 1
    for _ in range(e):
        result *= b
    return result


def missing_exponent(prompt):
    m = re.fullmatch(r'If \$(\d+)\^n = ([\d{},]+)\$, what is \$n\$\?', prompt) or \
        re.fullmatch(r'How many factors of (\d+) multiply to make ([\d,]+)\?', prompt)
    require(m is not None, f'Unrecognized missing-exponent prompt: {prompt}')
    b, v = int(m[1]), int(m[2].replace('{,}', '').replace(',', ''))
    hits = [n for n in range(0, 40) if b ** n == v]
    require(len(hits) == 1 and hits[0] >= 2, f'No unique exponent: {prompt}')
    return hits[0]


def options(public):
    response = public['response']
    require(response['kind'] == 'choice', 'Choice response expected')
    return response['options']


def repeated_product(public):
    prompt = public['prompt']
    m = re.fullmatch(r'Which (power|product) equals \$([^$]+)\$\?', prompt)
    require(m is not None, f'Unrecognized repeated-product prompt: {prompt}')
    target = value(m[2])
    if m[1] == 'power':
        factors = m[2].split('\\cdot')
        require(len(set(f.strip() for f in factors)) == 1 and len(factors) >= 2, 'Equal factors expected')
        good = [o for o in options(public) if re.fullmatch(r'\$\d+\^\{\d+\}\$', o['label']) and value(maths(o['label'])[0]) == target]
    else:
        require(re.fullmatch(r'\d+\^\{\d+\}', m[2]) is not None, 'A single power expected')
        base = m[2].split('^')[0]
        def is_product(label):
            parts = [p.strip() for p in maths(label)[0].split('\\cdot')]
            return len(parts) >= 2 and all(p == base for p in parts)
        good = [o for o in options(public) if is_product(o['label']) and value(maths(o['label'])[0]) == target]
    same = [o for o in options(public) if value(maths(o['label'])[0]) == target]
    require(len(same) == 1, f'Another option has the same value: {prompt}')
    require(len(good) == 1, f'Not exactly one matching option: {prompt}')
    return good[0]['id']


def compare(public):
    prompt = public['prompt']
    m = re.fullmatch(r'Which is greater, \$([^$]+)\$ or \$([^$]+)\$\?', prompt)
    require(m is not None, f'Unrecognized compare prompt: {prompt}')
    left, right = value(m[1]), value(m[2])
    by_label = {o['label']: o['id'] for o in options(public)}
    require(set(by_label) == {f'${m[1]}$', f'${m[2]}$', 'They are equal'}, 'Options must be both sides and equality')
    if left == right:
        return by_label['They are equal']
    return by_label[f'${m[1]}$' if left > right else f'${m[2]}$']


def order_trap(prompt):
    m = re.fullmatch(r'(?:What is \$([^$]+)\$\?|Evaluate \$([^$]+)\$\.)', prompt)
    require(m is not None, f'Unrecognized expression prompt: {prompt}')
    tex = m[1] or m[2]
    require('^' in tex, 'An exponent is the point of the item')
    return value(tex)


STORIES = {
    'Folds': (2, r'Folding a sheet of paper in half doubles its layers\. The bars show the layers after 0 to 3 folds\. How many layers are there after (\d+) folds\?'),
    'Hours': (2, r'One cell splits into two every hour, so the number of cells doubles each hour\. The bars show the cells at hours 0 to 3\. How many cells are there after (\d+) hours\?'),
    'Day': (3, r'On day 0, one person learns a secret\. Each day, everyone who learned it the day before tells 3 new people\. The bars show how many new people learn it on days 0 to 3\. How many new people learn it on day (\d+)\?'),
}


def doubling(public):
    figure = public.get('figure')
    require(figure and figure['kind'] == 'scene', 'Doubling story needs its bars')
    bars = [e for e in figure['scene']['elements'] if e['type'] == 'bars']
    require(len(bars) == 1 and len(bars[0]['series']) == 1, 'One bar series')
    axis = bars[0]['axisName']
    require(axis in STORIES, f'Unknown story axis {axis}')
    factor, pattern = STORIES[axis]
    m = re.fullmatch(pattern, public['prompt'])
    require(m is not None, f'Prompt does not match the {axis} story')
    shown = bars[0]['series'][0]['values']
    require(bars[0]['categories'] == ['0', '1', '2', '3'], 'Bars for steps 0 to 3')
    require(shown[0] == 1 and all(shown[i + 1] == shown[i] * factor for i in range(3)), 'Bars must multiply by the stated factor')
    n = int(m[1])
    require(n > 3, 'The asked step is beyond the bars')
    count = shown[-1]
    for _ in range(n - 3):
        count *= factor
    require(count not in shown, 'The figure must not show the answer')
    return count


def solve_power(public):
    template = public['templateId']
    require(template in POWER, f'Unknown template {template}')
    prompt = public['prompt']
    if template == 'integer-power':
        return Fraction(evaluate_power(prompt))
    if template == 'power-missing-exponent':
        return Fraction(missing_exponent(prompt))
    if template == 'power-repeated-product':
        return repeated_product(public)
    if template == 'power-compare':
        return compare(public)
    if template == 'power-order-trap':
        return Fraction(order_trap(prompt))
    return Fraction(doubling(public))


def review_power_fixtures():
    def pub(template, prompt, opts=None, figure=None):
        p = {'templateId': template, 'prompt': prompt,
             'response': {'kind': 'choice', 'label': 'Choose one answer', 'options': opts} if opts else {'kind': 'number', 'label': 'Answer'}}
        if figure:
            p['figure'] = figure
        return p

    def rejects(p):
        try:
            solve_power(p)
        except (ValueError, KeyError, IndexError, TypeError):
            return True
        return False
    require(solve_power(pub('integer-power', 'What is $3^{4}$?')) == 81, 'Evaluate')
    require(solve_power(pub('integer-power', 'Evaluate $7^{0}$.')) == 1, 'Zero exponent')
    require(rejects(pub('integer-power', 'What is $9^{5}$?')), '9^5 is beyond mental arithmetic')
    require(rejects(pub('integer-power', 'What is 9 raised to the power 5?')), 'Prose powers rejected')
    require(solve_power(pub('power-missing-exponent', 'If $2^n = 32$, what is $n$?')) == 5, 'Missing exponent')
    require(solve_power(pub('power-missing-exponent', 'How many factors of 10 multiply to make 10,000?')) == 4, 'Count factors')
    require(rejects(pub('power-missing-exponent', 'If $2^n = 48$, what is $n$?')), 'Not a power')
    o = [{'id': 'option-a', 'label': '$4^{5}$'}, {'id': 'option-b', 'label': '$5^{4}$'}, {'id': 'option-c', 'label': '$5 \\cdot 4$'}, {'id': 'option-d', 'label': '$5^{3}$'}]
    require(solve_power(pub('power-repeated-product', 'Which power equals $5 \\cdot 5 \\cdot 5 \\cdot 5$?', o)) == 'option-b', 'Product to power')
    o = [{'id': 'option-a', 'label': '$2^{5}$'}, {'id': 'option-b', 'label': '$5^{2}$'}, {'id': 'option-c', 'label': 'They are equal'}]
    require(solve_power(pub('power-compare', 'Which is greater, $2^{5}$ or $5^{2}$?', o)) == 'option-a', 'Compare')
    o = [{'id': 'option-a', 'label': '$2^{4}$'}, {'id': 'option-b', 'label': '$4^{2}$'}, {'id': 'option-c', 'label': 'They are equal'}]
    require(solve_power(pub('power-compare', 'Which is greater, $2^{4}$ or $4^{2}$?', o)) == 'option-c', 'Equal powers')
    require(solve_power(pub('power-order-trap', 'What is $3 \\cdot 4^{2}$?')) == 48, 'Exponent first')
    require(solve_power(pub('power-order-trap', 'Evaluate $(3 \\cdot 4)^2$.')) == 144, 'Parentheses first')
    require(solve_power(pub('power-order-trap', 'What is $(2 + 3)^2$?')) == 25, 'Square of a sum')
    bars = {'kind': 'scene', 'scene': {'elements': [{'type': 'bars', 'categories': ['0', '1', '2', '3'], 'series': [{'values': [1, 2, 4, 8]}], 'axisName': 'Folds'}]}}
    require(solve_power(pub('power-doubling-story', 'Folding a sheet of paper in half doubles its layers. The bars show the layers after 0 to 3 folds. How many layers are there after 7 folds?', figure=bars)) == 128, 'Folding')
    wrong = {'kind': 'scene', 'scene': {'elements': [{'type': 'bars', 'categories': ['0', '1', '2', '3'], 'series': [{'values': [1, 3, 9, 27]}], 'axisName': 'Folds'}]}}
    require(rejects(pub('power-doubling-story', 'Folding a sheet of paper in half doubles its layers. The bars show the layers after 0 to 3 folds. How many layers are there after 7 folds?', figure=wrong)), 'Bars must double')
    return 14


def review_power_problem(problem, solved):
    public = problem['public']
    last = problem['explanation'][-1]
    if public['templateId'] in POWER_CHOICE:
        label = next(o['label'] for o in public['response']['options'] if o['id'] == solved)
        require(label.strip('$') in last or (label == 'They are equal' and 'equal' in last), f'Explanation must conclude with the answer: {last}')
        return
    v = Fraction(solved)
    text = re.sub(r'\{,\}', ',', last)
    shown = {str(v.numerator), f'{v.numerator:,}'}
    require(any(re.search(rf'(?<![\d,]){re.escape(s)}(?![\d,])', text) for s in shown),
            f'Explanation must conclude with the answer: {last}')
