"""Independent oracle for line-graph-reader and dot-plot-arithmetic, from the
public payload (prompt, choices and figure data) only.

Line graphs: every value is read from the graph element's plotted points, which
must lie on the drawn grid lines, sit at x = 1..n and be joined by segments.
Extremes and "closest" must have a unique answer; statements are evaluated
against the readings and exactly one may be true. Dot plots: the values are the
dots of the figure (on the drawn ticks); totals, ranges and the missing value
are exact Fraction arithmetic.
"""

import copy
import re
from fractions import Fraction as F

SUPPORTED = frozenset({'line-graph-reader', 'dot-plot-arithmetic'})
CHOICE_REVIEW = SUPPORTED
REVIEW_RETURNS_ANSWER = False


def require(condition, message):
    if not condition:
        raise ValueError(message)


def options_of(public):
    response = public['response']
    require(response['kind'] == 'choice' and len(response['options']) == 4, 'Four choices required')
    require(len({o['id'] for o in response['options']}) == 4, 'Option ids must be distinct')
    return response['options']


def only(options, test, what):
    hits = [o['id'] for o in options if test(o)]
    require(len(hits) == 1, f'Exactly one choice must be {what}; found {len(hits)}')
    return hits[0]


def signed(text):
    return int(text.replace('\u2212', '-'))


# ------------------------------------------------------------------ line graph
WORDS = {'Day': 'days', 'Week': 'weeks', 'Hour': 'hours'}
HEADER = re.compile(r'The graph shows (?:.*? )?each of (\d+) (days|weeks|hours)\. (.*)')


def graph_element(public):
    figure = public['figure']
    require(figure['kind'] == 'scene', 'Scene figure required')
    graphs = [e for e in figure['scene']['elements'] if e['type'] == 'graph']
    require(len(graphs) == 1, 'One graph required')
    return graphs[0]


def check_axes(g, n, noun, series_count):
    require(g['axisNames'][0] == noun, f'Horizontal axis is {g["axisNames"][0]}, expected {noun}')
    require(g['x'][0] == 0 and g['x'][1] == n + 1, 'Horizontal window must be 0 to n + 1')
    gy = g['grid'][1]
    for p in g['points']:
        require(g['y'][0] <= p['y'] <= g['y'][1], 'Point outside the drawn window')
        require(p['y'] % gy == 0, f'Value {p["y"]} lies between horizontal grid lines ({gy} apart) and cannot be read exactly')
    require(len(g['points']) == n * series_count, 'Wrong number of plotted points')


def series_of(g, n):
    """{series key: [y1..yn]} from plotted points grouped by colour, checked against the segments."""
    by_color = {}
    for p in g['points']:
        by_color.setdefault(p.get('color'), []).append(p)
    out = {}
    for color, points in by_color.items():
        require(sorted(p['x'] for p in points) == list(range(1, n + 1)), 'Each series needs one point at every x = 1..n')
        points.sort(key=lambda p: p['x'])
        out[color] = points
        segments = [s for s in g['segments'] if s.get('color') == color]
        require(len(segments) == n - 1, 'A series needs one segment between consecutive points')
        for s, a, b in zip(sorted(segments, key=lambda s: s['from'][0]), points, points[1:]):
            require(s['from'] == [a['x'], a['y']] and s['to'] == [b['x'], b['y']], 'Segment does not join consecutive points')
    return out


def parse_label(text, noun):
    m = re.fullmatch(rf'{noun} (\d+)', text)
    require(m is not None, f'Not a {noun} label: {text}')
    return int(m[1])


def parse_quantity(text):
    m = re.fullmatch(r'(\d+) ([a-z]+)', text)
    require(m is not None, f'Not a quantity: {text}')
    value = int(m[1])
    return value, m[2]


def line_graph_parts(public):
    m = HEADER.fullmatch(public['prompt'])
    require(m is not None, f'Unrecognized wording: {public["prompt"]}')
    n, plural, question = int(m[1]), m[2], m[3]
    noun = {v: k for k, v in WORDS.items()}[plural]
    return n, noun, question


def statement_value(text, noun, y):
    """Truth of one answer statement about a single series y[1..n]."""
    low = noun.lower()
    n = len(y) - 1
    steps = {k: y[k + 1] - y[k] for k in range(1, n)}
    quantity = r'(?:temperature|amount of water|number of boxes sold)'
    m = re.fullmatch(rf'The {quantity} (increased|decreased) each {low} from {noun} (\d+) to {noun} (\d+)\.', text)
    if m:
        a, b = int(m[2]), int(m[3])
        sign = 1 if m[1] == 'increased' else -1
        return all(sign * steps[k] > 0 for k in range(a, b))
    m = re.fullmatch(rf'The greatest (increase|decrease) was from {noun} (\d+) to {noun} (\d+)\.', text)
    if m:
        a, b = int(m[2]), int(m[3])
        require(b == a + 1, 'Statement names non-consecutive times')
        sign = 1 if m[1] == 'increase' else -1
        best = max(sign * v for v in steps.values())
        return sign * steps[a] == best and [k for k, v in steps.items() if sign * v == best] == [a]
    m = re.fullmatch(rf'The {quantity} was greater on {noun} (\d+) than on {noun} (\d+)\.', text)
    if m:
        return y[int(m[1])] > y[int(m[2])]
    m = re.fullmatch(rf'The {quantity} on {noun} (\d+) was (\d+) (more|less) than on {noun} (\d+)\.', text)
    if m:
        a, d, b = int(m[1]), int(m[2]), int(m[4])
        return y[a] - y[b] == (d if m[3] == 'more' else -d)
    m = re.fullmatch(rf'The {quantity} was (greatest|least) on {noun} (\d+)\.', text)
    if m:
        top = (max if m[1] == 'greatest' else min)(y[1:])
        return y[int(m[2])] == top and y[1:].count(top) == 1
    raise ValueError(f'Unrecognized statement: {text}')


def solve_graph(public):
    n, noun, question = line_graph_parts(public)
    g = graph_element(public)
    options = options_of(public)
    low = WORDS[noun]
    qty = r'(?:temperature|amount of water|number of boxes sold)'
    m = re.fullmatch(r'In Week (\d+), which activity had the (greatest|least) percent\?', question)
    if m:
        check_axes(g, n, noun, 4)
        series = series_of(g, n)
        require(len(series) == 4, 'Four activity lines required')
        names = {}
        for color, points in series.items():
            labels = [p['label'] for p in points if 'label' in p]
            require(len(labels) == 1 and 'label' in points[-1], 'Each line carries exactly one name at its last point')
            names[labels[0]] = points
        require(len(names) == 4, 'Line names must differ')
        week = int(m[1])
        require(1 <= week <= n, 'Week outside the graph')
        at = {name: points[week - 1]['y'] for name, points in names.items()}
        target = (max if m[2] == 'greatest' else min)(at.values())
        require(list(at.values()).count(target) == 1, 'Extreme activity must be unique')
        require({o['label'] for o in options} == set(at), 'Choices must be the four activity names')
        return only(options, lambda o: at[o['label']] == target, f'the {m[2]} activity')
    check_axes(g, n, noun, 1)
    (only_series,) = series_of(g, n).values()
    y = [None] + [p['y'] for p in only_series]
    ys = y[1:]
    m = re.fullmatch(rf'What was the {qty} on {noun} (\d+)\?', question)
    if m:
        k = int(m[1])
        require(1 <= k <= n, 'Time outside the graph')
        values = {o['id']: parse_quantity(o['label']) for o in options}
        require(len({v for v, _ in values.values()}) == 4 and len({u for _, u in values.values()}) == 1, 'Distinct values in one unit')
        return only(options, lambda o: values[o['id']][0] == y[k], f'{y[k]}')
    m = re.fullmatch(rf'On which {noun.lower()} was the {qty} (greatest|least)\?', question)
    if m:
        target = max(ys) if m[1] == 'greatest' else min(ys)
        require(ys.count(target) == 1, 'The extreme must be unique')
        labels = {o['id']: parse_label(o['label'], noun) for o in options}
        require(len(set(labels.values())) == 4 and all(1 <= v <= n for v in labels.values()), 'Choices must be four distinct times on the graph')
        return only(options, lambda o: y[labels[o['id']]] == target, f'the {m[1]}')
    m = re.fullmatch(rf'On which {noun.lower()} was the {qty} closest to (\d+) ([a-z]+)\?', question)
    if m:
        target = int(m[1])
        distances = [abs(v - target) for v in ys]
        best = min(distances)
        require(distances.count(best) == 1, 'The nearest time must be unique')
        labels = {o['id']: parse_label(o['label'], noun) for o in options}
        require(len(set(labels.values())) == 4 and all(1 <= v <= n for v in labels.values()), 'Choices must be four distinct times on the graph')
        key = only(options, lambda o: abs(y[labels[o['id']]] - target) == best, 'the nearest')
        # Every other choice must be strictly farther than the key.
        return key
    m = re.fullmatch(rf'Between which two consecutive {low} did the {qty} (increase|decrease) the most\?', question)
    if m:
        sign = 1 if m[1] == 'increase' else -1
        steps = {k: sign * (y[k + 1] - y[k]) for k in range(1, n)}
        best = max(steps.values())
        require(best > 0 and list(steps.values()).count(best) == 1, 'The greatest change must be positive and unique')
        pairs = {}
        for o in options:
            a = re.fullmatch(rf'{noun} (\d+) to {noun} (\d+)', o['label'])
            require(a is not None and int(a[2]) == int(a[1]) + 1 and 1 <= int(a[1]) < n, f'Not consecutive times: {o["label"]}')
            pairs[o['id']] = int(a[1])
        require(len(set(pairs.values())) == 4, 'Choices must be four distinct intervals')
        return only(options, lambda o: steps[pairs[o['id']]] == best, 'the greatest change')
    m = re.fullmatch(rf'How did the {qty} change from {noun} (\d+) to {noun} (\d+)\?', question)
    if m:
        a, b = int(m[1]), int(m[2])
        require(1 <= a < b <= n, 'Change interval outside the graph')
        change = y[b] - y[a]
        require(change != 0, 'Zero change has no direction word')
        parsed = {}
        for o in options:
            d = re.fullmatch(r'(Increased|Decreased) by (\d+)', o['label'])
            require(d is not None, f'Not a change statement: {o["label"]}')
            parsed[o['id']] = int(d[2]) * (1 if d[1] == 'Increased' else -1)
        require(len(set(parsed.values())) == 4 and 0 not in parsed.values(), 'Choices must be four distinct nonzero changes')
        return only(options, lambda o: parsed[o['id']] == change, f'{change:+d}')
    if question == 'Which statement about the graph is true?':
        truth = {o['id']: statement_value(o['label'], noun, y) for o in options}
        require(len({o['label'] for o in options}) == 4, 'Statements must differ')
        for o in options:
            for number in re.findall(rf'{noun} (\d+)', o['label']):
                require(1 <= int(number) <= n, 'Statement names a time outside the graph')
        return only(options, lambda o: truth[o['id']], 'true')
    raise ValueError(f'Unrecognized question: {question}')


def review_graph(problem):
    public = problem['public']
    result = solve_graph(public)
    require(problem['answer'] == result, 'Answer key differs from the derived choice')
    labels = {o['id']: o['label'] for o in public['response']['options']}
    require(result not in (problem.get('choiceFeedback') or {}), 'Correct choice has wrong-answer feedback')
    hint = problem.get('hint', '')
    require(labels[result] not in hint, 'Hint states the answer')
    return result


# --------------------------------------------------------------------- dot plot
DOT_HEADER = re.compile(r'The dot plot shows (?:the (?:length|weight), in (feet|pounds), of each of (\d+) (?:ribbons|bags of apples)|'
                        r'how many (miles) Maya walked on each of (\d+) days|how many (points) a team scored in each of its first (\d+) games)\. (.*)')
UNITS = {'feet': 'foot', 'pounds': 'pound', 'miles': 'mile', 'points': 'point'}


def parse_amount(text):
    """A number, mixed number or fraction (typeset or plain) as an exact Fraction."""
    t = text.strip('$ ')
    m = re.fullmatch(r'(\d+)\\frac\{(\d+)\}\{(\d+)\}', t)
    if m:
        return int(m[1]) + F(int(m[2]), int(m[3]))
    m = re.fullmatch(r'\\frac\{(\d+)\}\{(\d+)\}', t)
    if m:
        return F(int(m[1]), int(m[2]))
    require(re.fullmatch(r'\d+', t) is not None, f'Not an amount: {text}')
    return F(int(t))


def amount_with_unit(label, unit):
    m = re.fullmatch(r'(\$[^$]+\$|\d+) ([a-z]+)', label)
    require(m is not None, f'Not a measure: {label}')
    value = parse_amount(m[1])
    expected = UNITS[unit] if value <= 1 else unit
    require(m[2] == expected, f'Unit agreement: "{label}" should use "{expected}"')
    return value


def dots_of(public, count):
    figure = public['figure']
    require(figure['kind'] == 'scene', 'Scene figure required')
    (plot,) = [e for e in figure['scene']['elements'] if e['type'] == 'dotPlot']
    require(len(plot['groups']) == 1, 'One dot group required')
    denominator = plot.get('denominator', 1)
    values = [F(str(v)) for v in plot['groups'][0]['values']]
    require(all((v * denominator).denominator == 1 for v in values), 'A dot lies between the drawn ticks')
    require(all(plot['min'] <= v <= plot['max'] for v in values), 'A dot lies outside the drawn axis')
    require(len(values) == count, f'The plot shows {len(values)} dots, the prompt says {count}')
    return values


def solve_dots(public):
    m = DOT_HEADER.fullmatch(public['prompt'])
    require(m is not None, f'Unrecognized wording: {public["prompt"]}')
    g = m.groups()
    unit, count = next((g[i], int(g[i + 1])) for i in (0, 2, 4) if g[i] is not None)
    if unit == 'feet' or unit == 'pounds':
        pass
    question = g[6]
    options = options_of(public)
    total_q = re.fullmatch(r'(?:How many miles did Maya walk in all \d+ days|What is the total (?:length|weight) of all \d+ (?:ribbons|bags), in (?:feet|pounds)|How many points did the team score in all \d+ games)\?', question)
    if total_q:
        value = sum(dots_of(public, count), F(0))
    elif re.fullmatch(r'What is the difference between the greatest and the least value, in [a-z]+\?', question):
        require(question.endswith(f'in {unit}?'), 'Unit in the question')
        values = dots_of(public, count)
        value = max(values) - min(values)
        require(value > 0, 'Range must be positive')
    else:
        m2 = (re.fullmatch(r'All (\d+) (?:ribbons have a total length of|bags weigh) (\$[^$]+\$|\d+) (?:feet|pounds)(?: together)?\. What is the (?:length of ribbon|weight of bag) (\d+), in (?:feet|pounds)\?', question)
              or re.fullmatch(r'Maya walked (\$[^$]+\$|\d+) miles in all (\d+) days\. How many miles did she walk on day (\d+)\?', question)
              or re.fullmatch(r'The team scored (\d+) points in its first (\d+) games\. How many points did it score in game (\d+)\?', question))
        require(m2 is not None, f'Unrecognized question: {question}')
        a, b, c = m2.groups()
        if 'Maya' in question or 'team' in question:
            total, number = parse_amount(a), int(b)
        else:
            number, total = int(a), parse_amount(b)
        require(number == count + 1 and int(c) == number and int(c) == count + 1, 'The missing item must be the one after the plotted ones')
        value = total - sum(dots_of(public, count), F(0))
        require(value > 0, 'The missing value must be positive')
    values = {o['id']: amount_with_unit(o['label'], unit) for o in options}
    require(len(set(values.values())) == 4, 'Choices must be distinct')
    return only(options, lambda o: values[o['id']] == value, f'{value}')


def review_dots(problem):
    public = problem['public']
    result = solve_dots(public)
    require(problem['answer'] == result, 'Answer key differs from the derived choice')
    require(result not in (problem.get('choiceFeedback') or {}), 'Correct choice has wrong-answer feedback')
    return result


def solve(public):
    template = public['templateId']
    require(template in SUPPORTED, 'Unexpected template')
    return solve_graph(public) if template == 'line-graph-reader' else solve_dots(public)


def review_problem(problem):
    return review_graph(problem) if problem['public']['templateId'] == 'line-graph-reader' else review_dots(problem)


def self_test():
    def graph(series, names=('Day', '°F'), grid=5, labels=None):
        points, segments = [], []
        for index, (color, ys) in enumerate(series.items()):
            for x, y in enumerate(ys, 1):
                p = {'x': x, 'y': y, 'color': color}
                if labels and x == len(ys):
                    p['label'] = labels[index]
                points.append(p)
            for x in range(1, len(ys)):
                segments.append({'from': [x, ys[x - 1]], 'to': [x + 1, ys[x]], 'color': color})
        n = len(next(iter(series.values())))
        return {'kind': 'scene', 'scene': {'v': 1, 'elements': [{'id': 'g', 'type': 'graph', 'x': [0, n + 1], 'y': [0, 100], 'grid': [1, grid], 'tick': [1, 20],
                                                                  'axisNames': list(names), 'frame': True, 'points': points, 'segments': segments}]}}

    def dots(values, denominator=None, high=10):
        plot = {'id': 'plot', 'type': 'dotPlot', 'min': 0, 'max': high, 'mark': 'dot', 'groups': [{'values': values}], 'unit': 'feet'}
        if denominator:
            plot['denominator'] = denominator
        return {'kind': 'scene', 'scene': {'v': 1, 'elements': [plot]}}

    def mk(template, prompt, labels, answer, figure):
        return {'public': {'templateId': template, 'prompt': prompt, 'figure': figure,
                           'response': {'kind': 'choice', 'options': [{'id': f'option-{c}', 'label': l} for c, l in zip('abcd', labels)]}},
                'answer': answer, 'hint': 'Read the graph.', 'choiceFeedback': {}}
    temps = graph({'accent': [40, 55, 45, 70, 65, 60]})
    head = 'The graph shows the temperature at noon, in degrees Fahrenheit, on each of 6 days. '
    boxes = graph({'accent': [90, 60, 30, 50, 40, 70]}, ('Week', 'Boxes'), 10)
    bhead = 'The graph shows how many boxes of soup a store sold in each of 6 weeks. '
    groups = graph({'accent': [20, 60, 40, 70, 50], 'warm': [90, 50, 80, 40, 20], 'gold': [70, 70, 80, 20, 90], 'ink': [50, 80, 80, 80, 70]},
                   ('Week', 'Percent'), 10, ['Soccer', 'Art', 'Chess', 'Music'])
    good = [
        mk('line-graph-reader', head + 'What was the temperature on Day 2?', ['55 degrees', '70 degrees', '50 degrees', '45 degrees'], 'option-a', temps),
        mk('line-graph-reader', head + 'On which day was the temperature greatest?', ['Day 3', 'Day 4', 'Day 2', 'Day 1'], 'option-b', temps),
        mk('line-graph-reader', head + 'On which day was the temperature least?', ['Day 3', 'Day 4', 'Day 2', 'Day 1'], 'option-d', temps),
        mk('line-graph-reader', head + 'On which day was the temperature closest to 56 degrees?', ['Day 4', 'Day 2', 'Day 3', 'Day 5'], 'option-b', temps),
        mk('line-graph-reader', head + 'Between which two consecutive days did the temperature increase the most?', ['Day 2 to Day 3', 'Day 3 to Day 4', 'Day 4 to Day 5', 'Day 1 to Day 2'], 'option-b', temps),
        mk('line-graph-reader', head + 'Between which two consecutive days did the temperature decrease the most?', ['Day 2 to Day 3', 'Day 3 to Day 4', 'Day 4 to Day 5', 'Day 5 to Day 6'], 'option-a', temps),
        mk('line-graph-reader', head + 'How did the temperature change from Day 1 to Day 3?', ['Increased by 5', 'Increased by 15', 'Decreased by 5', 'Increased by 10'], 'option-a', temps),
        mk('line-graph-reader', head + 'Which statement about the graph is true?', ['The temperature increased each day from Day 3 to Day 4.', 'The greatest increase was from Day 1 to Day 2.',
                                                                              'The greatest decrease was from Day 4 to Day 5.', 'The temperature was greater on Day 2 than on Day 4.'], 'option-a', temps),
        mk('line-graph-reader', bhead + 'Which statement about the graph is true?', ['The number of boxes sold on Week 1 was 40 more than on Week 2.', 'The number of boxes sold was greatest on Week 6.',
                                                                              'The number of boxes sold on Week 3 was 20 less than on Week 4.', 'The number of boxes sold on Week 5 was 10 more than on Week 4.'], 'option-c', boxes),
        mk('line-graph-reader', 'The graph shows the percent of students who chose each of four activities in each of 5 weeks. In Week 1, which activity had the greatest percent?',
           ['Soccer', 'Art', 'Chess', 'Music'], 'option-b', groups),
        mk('line-graph-reader', 'The graph shows the percent of students who chose each of four activities in each of 5 weeks. In Week 4, which activity had the least percent?',
           ['Soccer', 'Art', 'Chess', 'Music'], 'option-c', groups),
        mk('dot-plot-arithmetic', 'The dot plot shows the length, in feet, of each of 7 ribbons. What is the difference between the greatest and the least value, in feet?',
           ['1 foot', '$5\\frac{3}{4}$ feet', '$4\\frac{3}{4}$ feet', '$3\\frac{3}{4}$ feet'], 'option-d', dots([1.25, 3.5, 2.75, 5, 3, 2.5, 4], 4, 6)),
        mk('dot-plot-arithmetic', 'The dot plot shows how many miles Maya walked on each of 7 days. How many miles did Maya walk in all 7 days?',
           ['7 miles', '$16\\frac{1}{2}$ miles', '12 miles', '$17\\frac{1}{2}$ miles'], 'option-d', dots([4, 2, 1.5, 1, 4, 3.5, 1.5], 2, 6)),
        mk('dot-plot-arithmetic', 'The dot plot shows the length, in feet, of each of 7 ribbons. All 8 ribbons have a total length of 22 feet. What is the length of ribbon 8, in feet?',
           ['5 feet', '17 feet', '$5\\frac{1}{2}$ feet', '$4\\frac{1}{2}$ feet'], 'option-a', dots([3, 2, 2, 4, 1, 3, 2], None, 10)),
    ]
    count = 0

    def reject(bad, why):
        nonlocal count
        try:
            review_problem(bad)
        except ValueError:
            count += 1
        else:
            raise AssertionError('Corrupted fixture accepted: ' + why)
    for case in good:
        review_problem(case)
        bad = copy.deepcopy(case)
        bad['answer'] = 'option-a' if case['answer'] != 'option-a' else 'option-b'
        reject(bad, 'wrong key')
        bad = copy.deepcopy(case)
        options = bad['public']['response']['options']
        right = next(i for i, o in enumerate(options) if o['id'] == case['answer'])
        options[(right + 1) % 4]['label'] = options[right]['label']
        reject(bad, 'duplicate of the correct choice')
    # Figure data must carry the answer: change one plotted value and the old key fails.
    for index in (0, 1, 2, 3, 4, 5, 6):
        bad = copy.deepcopy(good[index])
        element = bad['public']['figure']['scene']['elements'][0]
        ys = [p['y'] for p in element['points']][::-1]
        for x, (p, y) in enumerate(zip(element['points'], ys), 1):
            p['y'] = y
        for k, s in enumerate(element['segments']):
            s['from'], s['to'] = [k + 1, ys[k]], [k + 2, ys[k + 1]]
        reject(bad, f'figure data reversed under fixture {index}')
    bad = copy.deepcopy(good[1])
    bad['public']['figure']['scene']['elements'][0]['points'][3]['y'] = 40
    bad['public']['figure']['scene']['elements'][0]['segments'][2]['to'][1] = 40
    bad['public']['figure']['scene']['elements'][0]['segments'][3]['from'][1] = 40
    reject(bad, 'a tie for the greatest')
    bad = copy.deepcopy(good[0])
    bad['public']['figure']['scene']['elements'][0]['points'][1]['y'] = 57
    reject(bad, 'a value between grid lines')
    bad = copy.deepcopy(good[0])
    bad['public']['figure']['scene']['elements'][0]['segments'][0]['to'][1] = 60
    reject(bad, 'segment off its point')
    bad = copy.deepcopy(good[3])
    bad['public']['prompt'] = bad['public']['prompt'].replace('56 degrees', '47 degrees')  # Day 1 (40) vs Day 2 (55) vs Day 3 (50): 50 is nearest; Day 2 is not
    reject(bad, 'closest changed')
    bad = copy.deepcopy(good[3])
    bad['public']['prompt'] = bad['public']['prompt'].replace('56 degrees', '56.5 degrees')
    reject(bad, 'non-integer target')
    bad = copy.deepcopy(good[7])
    bad['public']['response']['options'][2]['label'] = 'The greatest decrease was from Day 1 to Day 3.'
    reject(bad, 'non-consecutive statement')
    bad = copy.deepcopy(good[9])
    bad['public']['figure']['scene']['elements'][0]['points'][5]['y'] = 90
    bad['public']['figure']['scene']['elements'][0]['segments'][4]['to'][1] = 90
    reject(bad, 'tie among activities')
    bad = copy.deepcopy(good[11])
    bad['public']['figure']['scene']['elements'][0]['groups'][0]['values'][0] = 1.5
    reject(bad, 'dot moved')
    bad = copy.deepcopy(good[11])
    bad['public']['figure']['scene']['elements'][0]['groups'][0]['values'][0] = 1.3
    reject(bad, 'dot between ticks')
    bad = copy.deepcopy(good[11])
    bad['public']['response']['options'][0]['label'] = '1 feet'
    reject(bad, 'unit agreement')
    bad = copy.deepcopy(good[13])
    bad['public']['prompt'] = bad['public']['prompt'].replace('22 feet', '12 feet')
    reject(bad, 'total smaller than the dots')
    bad = copy.deepcopy(good[12])
    bad['public']['figure']['scene']['elements'][0]['groups'][0]['values'].pop()
    reject(bad, 'dot count disagrees with prompt')
    return {'fixtures': len(good), 'rejectedMutations': count}


if __name__ == '__main__':
    print(self_test())
