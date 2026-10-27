"""Independent oracle for the select-all expression, rule and data families.

Statements are evaluated from their own text with exact arithmetic, an exact
polynomial expander, the displayed line of best fit, and the points, marks
and dots of the drawn graph, number line or dot plot. Generated answers,
explanations and hints never enter `verdicts`.
"""
import re
from collections import Counter
from fractions import Fraction

import multiselect_oracle_kit as kit
from multiselect_oracle_kit import require, options_of

SUPPORTED = frozenset({
    'story-expression-select', 'equal-expression-select', 'customary-equivalent-select',
    'additive-multiplicative-select', 'equivalent-trinomial-select', 'regression-prediction-select',
    'function-pair-select', 'root-approximation-select', 'dot-plot-statement-select',
})
REVIEW_RETURNS_ANSWER = True


def one_span(label):
    spans = kit.dollars(label)
    require(len(spans) == 1, f'Expected one typeset span: {label}')
    return spans[0]


def story(public):
    prompt = public['prompt']
    given = [int(n) for n in re.findall(r'\$(\d+)\$', prompt)]
    out, seen = [], []
    if '\\square' in prompt:
        require(len(given) == 2 and given[0] > given[1], 'Unknown-part givens are a total and a part')
        unknown = given[0] - given[1]
        for o in options_of(public):
            tex = one_span(o['label'])
            seen.append(tex)
            require(tex.count('\\square') == 1 and tex.count('=') == 1, f'Number sentence: {tex}')
            left, right = tex.replace('\\square', f'({unknown})').split('=')
            out.append(kit.arith(left) == kit.arith(right))
    else:
        require(len(given) == 3 and given[0] > given[1] + given[2], 'Two removals from a start')
        left_over = given[0] - given[1] - given[2]
        for o in options_of(public):
            tex = one_span(o['label'])
            seen.append(tex)
            out.append(kit.arith(tex) == left_over)
    require(len(set(seen)) == len(seen), 'Repeated sentence')
    return out


def equal_expression(public):
    m = re.match(r'Look at the expression \$(.+?)\$\. Select', public['prompt'])
    require(m is not None, 'Given expression')
    value = kit.arith(m.group(1))
    out, seen = [], []
    for o in options_of(public):
        tex = one_span(o['label'])
        seen.append(tex)
        require(tex != m.group(1), 'The given expression is an option')
        out.append(kit.arith(tex) == value)
    require(len(set(seen)) == len(seen), 'Repeated expression')
    return out


UNITS = {
    'inch': ('length', 1), 'inches': ('length', 1), 'foot': ('length', 12), 'feet': ('length', 12), 'yard': ('length', 36), 'yards': ('length', 36),
    'cup': ('capacity', 1), 'cups': ('capacity', 1), 'pint': ('capacity', 2), 'pints': ('capacity', 2), 'quart': ('capacity', 4), 'quarts': ('capacity', 4),
    'gallon': ('capacity', 16), 'gallons': ('capacity', 16), 'ounce': ('weight', 1), 'ounces': ('weight', 1), 'pound': ('weight', 16), 'pounds': ('weight', 16),
}


def measure(text):
    """(kind, amount in the smallest unit) of '$3$ gallons $17$ cups'."""
    parts = re.findall(r'\$(\d+)\$ ([a-z]+)', text)
    require(parts and ' '.join(f'${n}$ {u}' for n, u in parts) == text, f'Measure: {text}')
    require(len({UNITS[u][0] for _, u in parts}) == 1 and len({u for _, u in parts}) == len(parts), 'Mixed or repeated units')
    for n, u in parts:
        # singular exactly when the amount is 1
        require((int(n) == 1) == (u in ('inch', 'foot', 'yard', 'cup', 'pint', 'quart', 'gallon', 'ounce', 'pound')), f'Unit number agreement: {n} {u}')
    return UNITS[parts[0][1]][0], sum(int(n) * UNITS[u][1] for n, u in parts)


def customary(public):
    m = re.fullmatch(r'Select the \d+ measurements that are equal to (.+)\.', public['prompt'])
    require(m is not None, 'Measurement prompt')
    kind, target = measure(m.group(1))
    out, seen = [], []
    for o in options_of(public):
        k, amount = measure(o['label'])
        require(k == kind, 'Option measures another quantity')
        seen.append(amount)
        out.append(amount == target)
    return out


def rule_of(tex):
    m = re.fullmatch(r'y=(\d+)x', tex)
    if m:
        return 'multiplicative', int(m.group(1))
    m = re.fullmatch(r'y=x\+(\d+)', tex)
    require(m is not None, f'Rule: {tex}')
    return 'additive', int(m.group(1))


def additive_multiplicative(public):
    m = re.match(r'Two rules relate \$x\$ and \$y\$: \$(.+?)\$ and \$(.+?)\$\.', public['prompt'])
    require(m is not None, 'Two rules')
    rules = {m.group(1): rule_of(m.group(1)), m.group(2): rule_of(m.group(2))}
    require(sorted(k for k, _ in rules.values()) == ['additive', 'multiplicative'], 'One rule of each kind')
    out = []
    for o in options_of(public):
        label = o['label']
        a = re.fullmatch(r'In \$(.+?)\$, when \$x=(\d+)\$, \$y=(\d+)\$', label)
        b = re.fullmatch(r'In \$(.+?)\$, \$y\$ is always \$(\d+)\$ (more than|times) \$x\$', label)
        c = re.fullmatch(r'\$(.+?)\$ is an? (additive|multiplicative) rule', label)
        if a:
            require(a.group(1) in rules, 'Statement names another rule')
            kind, k = rules[a.group(1)]
            x = int(a.group(2))
            out.append((x * k if kind == 'multiplicative' else x + k) == int(a.group(3)))
        elif b:
            require(b.group(1) in rules, 'Statement names another rule')
            kind, k = rules[b.group(1)]
            want = 'additive' if b.group(3) == 'more than' else 'multiplicative'
            out.append(kind == want and k == int(b.group(2)))
        else:
            require(c is not None and c.group(1) in rules, f'Rule statement: {label}')
            out.append(rules[c.group(1)][0] == c.group(2))
    return out


# Exact polynomial expansion ------------------------------------------------

def poly_add(a, b, sign=1):
    r = dict(a)
    for d, c in b.items():
        r[d] = r.get(d, 0) + sign * c
    return {d: c for d, c in r.items() if c != 0}


def poly_mul(a, b):
    r = {}
    for d1, c1 in a.items():
        for d2, c2 in b.items():
            r[d1 + d2] = r.get(d1 + d2, 0) + c1 * c2
    return {d: c for d, c in r.items() if c != 0}


def expand(tex):
    tokens = re.findall(r'\d+|x|\^|[+\-()]', tex.replace('{', '').replace('}', '').replace(' ', ''))
    require(''.join(tokens) == tex.replace('{', '').replace('}', '').replace(' ', ''), f'Polynomial: {tex}')
    pos = 0

    def peek():
        return tokens[pos] if pos < len(tokens) else None

    def take():
        nonlocal pos
        pos += 1
        return tokens[pos - 1]

    def atom():
        t = take()
        if t == 'x':
            base = {1: Fraction(1)}
        elif t.isdigit():
            base = {0: Fraction(int(t))}
        else:
            require(t == '(', 'Parenthesis')
            base = expression()
            require(take() == ')', 'Closing parenthesis')
        if peek() == '^':
            take()
            e = take()
            require(e.isdigit(), 'Exponent')
            result = {0: Fraction(1)}
            for _ in range(int(e)):
                result = poly_mul(result, base)
            return result
        return base

    def term():
        sign = 1
        while peek() in ('+', '-'):
            sign = -sign if take() == '-' else sign
        result = {d: sign * c for d, c in atom().items()}
        while peek() is not None and (peek() in ('x', '(') or peek().isdigit()):
            result = poly_mul(result, atom())
        return result

    def expression():
        result = term()
        while peek() in ('+', '-'):
            op = take()
            pos_before = pos
            result = poly_add(result, term(), 1 if op == '+' else -1)
            require(pos > pos_before, 'Empty term')
        return result

    value = expression()
    require(pos == len(tokens), 'Trailing tokens')
    return value


def trinomial(public):
    m = re.match(r'Look at the (?:trinomial|product) \$(.+?)\$\. Select', public['prompt'])
    require(m is not None, 'Given polynomial')
    target = expand(m.group(1))
    out, seen, wrong = [], [], []
    for o in options_of(public):
        tex = one_span(o['label'])
        seen.append(tex)
        p = expand(tex)
        out.append(p == target)
        if p != target:
            wrong.append(tuple(sorted(p.items())))
        require(tex != m.group(1), 'The given polynomial is an option')
    require(len(set(seen)) == len(seen), 'Repeated expression')
    require(len(set(wrong)) == len(wrong), 'Two wrong options are the same polynomial')
    return out


def regression(public):
    prompt = public['prompt']
    m = re.search(r'\$\\hat\{y\}=(-?\d+(?:\.\d+)?)x([+-]\d+(?:\.\d+)?)\$\. The data have \$x\$ between \$(\d+)\$ and \$(\d+)\$\.', prompt)
    require(m is not None, 'Line of best fit')
    slope, intercept, low, high = Fraction(m.group(1)), Fraction(m.group(2)), int(m.group(3)), int(m.group(4))

    def predict(k):
        return slope * k + intercept
    out, outside = [], 0
    for o in options_of(public):
        label = o['label']
        a = re.fullmatch(r'Each added \w+ changes the predicted .+ by \$(-?[\d.]+)\$', label)
        b = re.fullmatch(r'The line predicts \$(-?[\d.]+)\$ .+ for \$(\d+)\$ \w+', label)
        c = re.fullmatch(r'For \$(\d+)\$ \w+, the predicted .+ is \$(-?[\d.]+)\$', label)
        d = re.fullmatch(r'The predicted .+ is (greater|less) for \$(\d+)\$ \w+ than for \$(\d+)\$ \w+', label)
        if a:
            truth = Fraction(a.group(1)) == slope
        elif b or c:
            value, k = (Fraction(b.group(1)), int(b.group(2))) if b else (Fraction(c.group(2)), int(c.group(1)))
            truth = predict(k) == value
            require(not truth or value >= 0, 'A true prediction is a negative quantity')
            if not low <= k <= high:
                outside += 1
                require(not truth, 'A true statement extrapolates outside the data')
        else:
            require(d is not None, f'Regression statement: {label}')
            j, k = int(d.group(2)), int(d.group(3))
            require(low <= j <= high and low <= k <= high and j != k, 'Comparison outside the data')
            truth = (predict(j) > predict(k)) if d.group(1) == 'greater' else (predict(j) < predict(k))
        out.append(truth)
    return out


def function_pair(public):
    (graph,) = [e for e in kit.elements(public) if e['type'] == 'graph']
    points = [(p['x'], p['y']) for p in graph['points']]
    require(len({x for x, _ in points}) == len(points), 'The drawn relation is not a function')
    lo_x, hi_x, lo_y, hi_y = graph['x'][0], graph['x'][1], graph['y'][0], graph['y'][1]
    out, seen = [], []
    for o in options_of(public):
        m = re.fullmatch(r'\$\((\d+),(\d+)\)\$', o['label'])
        require(m is not None, f"Ordered pair: {o['label']}")
        x, y = int(m.group(1)), int(m.group(2))
        require(lo_x <= x <= hi_x and lo_y <= y <= hi_y, 'Pair is off the drawn grid')
        require((x, y) not in points, 'Pair is already drawn')
        seen.append((x, y))
        out.append(all(px != x for px, _ in points))
    require(len(set(seen)) == len(seen), 'Repeated pair')
    return out


def root_approximation(public):
    (line,) = [e for e in kit.elements(public) if e['type'] == 'numberLine']
    marks = {}
    for mark in line['marks']:
        n = round(mark['at'] ** 2)
        require(abs(mark['at'] ** 2 - n) < 1e-9, 'Point is not at a square root of a whole number')
        marks[mark['label']] = n
    require(f"between ${line['min']}$ and ${line['max']}$" in public['prompt'], 'Prompt and drawn interval disagree')
    require(all(line['min'] < n ** 0.5 < line['max'] for n in marks.values()), 'Point off the line')
    out, seen = [], []
    for o in options_of(public):
        m = re.fullmatch(r'Point \$([A-D])\$ is about \$(\d+\.\d)\$', o['label'])
        require(m is not None and m.group(1) in marks, f"Approximation: {o['label']}")
        n, claimed = marks[m.group(1)], Fraction(m.group(2))
        # nearest tenth t/10 of sqrt(n): the largest t with (2t-1)^2 <= 400n
        t = 0
        while (2 * (t + 1) - 1) ** 2 <= 400 * n:
            t += 1
        seen.append((m.group(1), claimed))
        out.append(claimed == Fraction(t, 10))
    require(len(set(seen)) == len(seen), 'Repeated statement')
    return out


def dot_plot(public):
    (plot,) = [e for e in kit.elements(public) if e['type'] == 'dotPlot']
    (group,) = plot['groups']
    values = group['values']
    total = len(values)
    require(f'each of ${total}$ turns' in public['prompt'], 'Prompt count differs from the dots')
    require(all(plot['min'] <= v <= plot['max'] and v == int(v) for v in values), 'Dots off the scale')
    count = Counter(values)
    out, seen = [], []
    for o in options_of(public):
        label = o['label']
        seen.append(label)
        patterns = [
            (r'Exactly \$(\d+)\$ turns? scored \$(\d+)\$', lambda g: count[int(g[1])] == int(g[0])),
            (r'\$(\d+)\$ turns scored at least \$(\d+)\$', lambda g: sum(1 for v in values if v >= int(g[1])) == int(g[0])),
            (r'More turns scored \$(\d+)\$ than scored \$(\d+)\$', lambda g: count[int(g[0])] > count[int(g[1])]),
            (r'More than half of the turns scored \$(\d+)\$ or less', lambda g: 2 * sum(1 for v in values if v <= int(g[0])) > total),
            (r'The most common score was \$(\d+)\$', lambda g: [v for v, c in count.items() if c == max(count.values())] == [int(g[0])]),
            (r'The greatest score was \$(\d+)\$', lambda g: max(values) == int(g[0])),
            (r'The least score was \$(\d+)\$', lambda g: min(values) == int(g[0])),
        ]
        for pattern, test in patterns:
            m = re.fullmatch(pattern, label)
            if m:
                if 'most common' in label:
                    require(sum(1 for c in count.values() if c == max(count.values())) == 1, 'Tied most common score')
                out.append(test(m.groups()))
                break
        else:
            raise ValueError(f'Dot plot statement: {label}')
    require(len(set(seen)) == len(seen), 'Repeated statement')
    return out


VERDICTS = {
    'story-expression-select': story,
    'equal-expression-select': equal_expression,
    'customary-equivalent-select': customary,
    'additive-multiplicative-select': additive_multiplicative,
    'equivalent-trinomial-select': trinomial,
    'regression-prediction-select': regression,
    'function-pair-select': function_pair,
    'root-approximation-select': root_approximation,
    'dot-plot-statement-select': dot_plot,
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


def _scene(*items):
    return {'kind': 'scene', 'scene': {'v': 1, 'elements': list(items)}}


def self_test():
    graph = _scene({'type': 'graph', 'x': [0, 9], 'y': [0, 9], 'points': [{'x': 7, 'y': 4}, {'x': 3, 'y': 4}, {'x': 4, 'y': 3}, {'x': 1, 'y': 8}, {'x': 0, 'y': 7}]})
    line = _scene({'type': 'numberLine', 'min': 7, 'max': 8, 'marks': [{'at': 52 ** 0.5, 'label': 'A'}, {'at': 55 ** 0.5, 'label': 'B'}, {'at': 58 ** 0.5, 'label': 'C'}, {'at': 61 ** 0.5, 'label': 'D'}]})
    dots = _scene({'type': 'dotPlot', 'min': 0, 'max': 9, 'groups': [{'values': [1, 1, 2, 2, 2, 2, 2, 2, 3, 4, 4, 4, 4, 4, 5, 5, 6, 6, 6, 6, 6, 7, 7, 7, 7, 8, 8, 8, 8, 8]}]})
    cases = [
        ('story-expression-select', 'A trip is $129$ miles long. There are $54$ miles left to drive. Let $\\square$ stand for the miles already driven. Select the 3 number sentences that can find $\\square$.',
         ['$54+\\square=129$', '$\\square+54=129$', '$129-\\square=54$', '$54+129=\\square$', '$54-129=\\square$'], 3, '["option-a","option-b","option-c"]', None),
        ('story-expression-select', 'A school bought $443$ markers. Grade 3 used $85$ markers and grade 4 used $82$ markers. How many markers are left? Select the 2 expressions that find the answer.',
         ['$85+82-443$', '$443-85-82$', '$443-(85-82)$', '$443-85+82$', '$(443-85)-82$'], 2, '["option-b","option-e"]', None),
        ('equal-expression-select', 'Look at the expression $(54-18)\\div6$. Select the 2 expressions that have the same value.',
         ['$54\\div6-18\\div6$', '$54-18\\div6$', '$(54\\div6)-(18\\div6)$', '$54\\div6+18\\div6$', '$(54-18)\\times6$'], 2, '["option-a","option-c"]', None),
        ('customary-equivalent-select', 'Select the 2 measurements that are equal to $4$ yards.',
         ['$145$ inches', '$11$ feet $13$ inches', '$144$ inches', '$2$ yards $6$ feet', '$3$ yards $72$ inches'], 2, '["option-c","option-d"]', None),
        ('additive-multiplicative-select', 'Two rules relate $x$ and $y$: $y=3x$ and $y=x+4$. A rule is multiplicative when $y$ is always the same number times $x$. Select the 2 true statements.',
         ['$y=x+4$ is a multiplicative rule', 'In $y=3x$, $y$ is always $4$ more than $x$', 'In $y=3x$, when $x=5$, $y=20$', 'In $y=3x$, $y$ is always $3$ times $x$', 'In $y=x+4$, when $x=3$, $y=6$', '$y=3x$ is a multiplicative rule'],
         2, '["option-d","option-f"]', None),
        ('equivalent-trinomial-select', 'Look at the trinomial $2x^2-26x+72$. Select the 2 expressions that are equivalent to it.',
         ['$(x-8)(2x-9)$', '$x(2x-8)-9(2x-8)$', '$(-x+9)(-2x+8)$', '$x(2x-24)+72$', '$x(2x+72)-26$'], 2, '["option-b","option-c"]', None),
        ('regression-prediction-select', 'A line of best fit for hours of practice ($x$) and free throws made ($\\hat{y}$) is $\\hat{y}=-4.7x+42.3$. The data have $x$ between $1$ and $10$. Select the 2 true statements.',
         ['Each added hour changes the predicted free throws made by $42.3$', 'Each added hour changes the predicted free throws made by $-4.7$', 'The line predicts $70.5$ free throws for $6$ hours',
          'The predicted free throws made is greater for $6$ hours than for $1$ hour', 'The line predicts $14.1$ free throws for $6$ hours'], 2, '["option-b","option-e"]', None),
        ('function-pair-select', 'The graph shows a relation that is a function. Select the 2 ordered pairs that can be added to the graph so that it is still a function.',
         ['$(2,2)$', '$(4,6)$', '$(5,2)$', '$(3,7)$', '$(4,2)$'], 2, '["option-a","option-c"]', graph),
        ('root-approximation-select', 'The number line shows points $A$, $B$, $C$ and $D$ between $7$ and $8$. Select the 2 statements that give a true approximation to the nearest tenth.',
         ['Point $C$ is about $7.5$', 'Point $A$ is about $7.5$', 'Point $C$ is about $7.4$', 'Point $C$ is about $7.6$', 'Point $B$ is about $7.4$'], 2, '["option-d","option-e"]', line),
        ('dot-plot-statement-select', 'The dot plot shows the points scored in each of $30$ turns of a game. Select the 3 statements that the dot plot supports.',
         ['More turns scored $6$ than scored $8$', '$16$ turns scored at least $5$', '$19$ turns scored at least $4$', '$21$ turns scored at least $4$', '$9$ turns scored at least $7$'], 3, '["option-b","option-d","option-e"]', dots),
    ]
    for template, prompt, labels, count, expected, figure in cases:
        label = 'Choose %d statements' % count
        public = _public(template, prompt, labels, count, label, figure)
        require(solve(public) == expected, f'Handwritten fixture {template}')
        explanation = [f"{t}: {'true' if o['id'] in expected else 'false'}. Checked." for t, o in zip(labels, public['response']['options'])]
        kit.standard_mutants(public, expected, explanation, 'Check each statement against the givens.', verdicts, solve)
    # figure edits that change a verdict must change the answer or fail
    kit.must_fail(solve, kit.tamper(_public('function-pair-select', cases[7][1], cases[7][2], 2, 'Choose 2 ordered pairs', graph),
                                    lambda p: p['figure']['scene']['elements'][0]['points'].append({'x': 4, 'y': 6})))
    kit.must_fail(solve, kit.tamper(_public('root-approximation-select', cases[8][1], cases[8][2], 2, 'Choose 2 statements', line),
                                    lambda p: p['figure']['scene']['elements'][0]['marks'][2].__setitem__('at', 58 ** 0.5 + 0.01)))
    kit.must_fail(solve, kit.tamper(_public('dot-plot-statement-select', cases[9][1], cases[9][2], 3, 'Choose 3 statements', dots),
                                    lambda p: p['figure']['scene']['elements'][0]['groups'][0]['values'].append(9)))
    require(expand('(x-2)(x+7)') == expand('x^2+5x-14') and expand('(x-2)(x+7)') != expand('x^2-14x+5'), 'Polynomial expander')
    require(expand('(-x+9)(-2x+8)') == expand('2x^2-26x+72'), 'Polynomial expander with leading minus')
    for bad in ['10 gallons', '$1$ pints', '$2$ gallon', '$1$ quart $2$ feet']:
        kit.must_fail(measure, bad)
