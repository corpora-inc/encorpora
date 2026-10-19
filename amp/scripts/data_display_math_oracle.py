"""Independent oracle for data-display families: reads only the public prompt,
the displayed chart data and the option labels, never the generated answer."""
import re
from fractions import Fraction

EARLY_DATA = frozenset({
    'sort-shapes-count', 'sort-shapes-most', 'picture-graph-questions',
    'scaled-picture-graph', 'scaled-bar-graph',
})
LINE_PLOTS = frozenset({
    'line-plot-whole', 'fraction-line-plot', 'fraction-plot-difference',
    'fraction-plot-equal-share',
})
DATA_DISPLAY = EARLY_DATA | LINE_PLOTS
DATA_DISPLAY_CHOICE = frozenset({'sort-shapes-most'})

SHAPES = {'circles': 'circle', 'squares': 'square', 'triangles': 'triangle'}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def _rows(figure):
    """Category values a reader gets from the drawn chart."""
    if figure['kind'] == 'picture-graph':
        key = figure['key']
        require(key in (1, 2, 5, 10), 'Unsupported picture key')
        half = key // 2 if key % 2 == 0 else key
        values = {}
        for c in figure['categories']:
            require(c['count'] % half == 0 and c['count'] / key <= 10, 'Undrawable picture row')
            values[c['label']] = c['count']
        return values
    require(figure['kind'] == 'scaled-bar-graph', 'Unexpected chart')
    step, top = figure['step'], figure['max']
    require(top % step == 0 and top // step <= 10, 'Unreadable bar scale')
    half = step // 2 if step % 2 == 0 else step
    values = {}
    for c in figure['categories']:
        require(0 <= c['value'] <= top and c['value'] % half == 0, 'Bar value is not readable on its scale')
        values[c['label']] = c['value']
    return values


def _mentioned(question, labels):
    """Category labels in the order the question names them."""
    found = []
    for label in labels:
        for m in re.finditer(r'(?<![A-Za-z])' + re.escape(label) + r'(?![A-Za-z])', question):
            found.append((m.start(), label))
    found.sort()
    return [label for _, label in found]


NEAREST = {'centimeter': 1, 'inch': 1, 'half inch': 2, 'quarter inch': 4, 'eighth inch': 8}


def _amount(text):
    """A written length: '3', '3/4' or '2 1/4'."""
    m = re.fullmatch(r'(?:(\d+) )?(\d+)/(\d+)|(\d+)', text)
    require(m is not None, f'Unreadable amount {text!r}')
    if m[4] is not None:
        return Fraction(int(m[4]))
    return Fraction(int(m[1] or 0)) + Fraction(int(m[2]), int(m[3]))


def solve_line_plot(public):
    figure, prompt = public['figure'], public['prompt']
    require(figure['kind'] == 'line-plot' and figure['mark'] == 'x', 'Line plot required')
    d = figure['denominator']
    require(figure['start'] < figure['end'] and figure['end'] - figure['start'] <= 12, 'Unreadable axis')
    require(figure['start'] % d == 0 and figure['end'] % d == 0, 'Axis must start and end on whole units')
    data = [Fraction(v, d) for v in figure['values']]
    require(all(Fraction(figure['start'], d) <= x <= Fraction(figure['end'], d) for x in data), 'Mark off the axis')
    require(max(data.count(x) for x in data) <= 7, 'Stack leaves the plot')
    amount = r'(\d+ \d+/\d+|\d+/\d+|\d+)'
    m = re.search(r'measured to the nearest (centimeter|inch|half inch|quarter inch|eighth inch)\.', prompt)
    if m:
        require(NEAREST[m[1]] == d, 'Stated precision contradicts the plot')
    if 'shared equally' in prompt:
        m = re.fullmatch(r'The line plot shows the amount of water in (\d+) identical beakers\. If all the water were shared equally among the beakers, how many liters would each beaker hold\?', prompt)
        require(m is not None and int(m[1]) == len(data), 'Beaker count contradicts the plot')
        return sum(data) / len(data)
    question = prompt.split('. ')[-1]
    if (m := re.fullmatch(r'How many \w+ are ' + amount + r' (?:inch|inches|centimeter|centimeters) long\?', question)):
        return Fraction(data.count(_amount(m[1])))
    if (m := re.fullmatch(r'How many \w+ are longer than ' + amount + r' (?:inch|inches|centimeter|centimeters)\?', question)):
        return Fraction(sum(1 for x in data if x > _amount(m[1])))
    if re.fullmatch(r'How many \w+ were measured\?', question):
        return Fraction(len(data))
    if re.fullmatch(r'How many (?:inches|centimeters) longer is the longest \w+ than the shortest\?', question):
        return max(data) - min(data)
    if re.fullmatch(r'What is the difference in length between the longest and shortest \w+, in inches\?', question):
        return max(data) - min(data)
    if re.fullmatch(r'What is the combined length of the longest and shortest \w+, in inches\?', question):
        return max(data) + min(data)
    if (m := re.fullmatch(r'What is the total length of all the \w+ that are ' + amount + r' (?:inch|inches) long, in inches\?', question)):
        v = _amount(m[1])
        require(v in data, 'Asked length is not plotted')
        return v * data.count(v)
    raise ValueError(f'Unrecognized line-plot question: {prompt}')


def solve_data_display(public):
    template = public['templateId']
    figure = public['figure']
    prompt = public['prompt']
    if template in LINE_PLOTS:
        value = solve_line_plot(public)
        return str(value.numerator) if value.denominator == 1 else f'{value.numerator}/{value.denominator}'
    if template in ('sort-shapes-count', 'sort-shapes-most'):
        require(figure['kind'] == 'sort-shapes', 'Sorting needs shapes')
        counts = {k: figure['shapes'].count(k) for k in ('circle', 'square', 'triangle')}
        require(sum(counts.values()) == len(figure['shapes']), 'Unknown shape')
        if template == 'sort-shapes-count':
            m = re.fullmatch(r'Sort the shapes by kind\. How many (circles|squares|triangles) are there\?', prompt)
            require(m is not None, 'Unexpected sorting question')
            return str(counts[SHAPES[m[1]]])
        m = re.fullmatch(r'Sort the shapes by kind\. Which kind has the (most|fewest) shapes\?', prompt)
        require(m is not None, 'Unexpected comparison question')
        best = (max if m[1] == 'most' else min)(counts.values())
        winners = [k for k, v in counts.items() if v == best]
        require(len(winners) == 1, 'Ambiguous extreme group')
        options = public['response']['options']
        require(len(options) == 3, 'Three kinds expected')
        valid = [o['id'] for o in options if SHAPES.get(o['label'].lower()) == winners[0]]
        require(len(valid) == 1, 'Exactly one correct option required')
        return valid[0]
    values = _rows(figure)
    question = prompt.split('?')[0].split('. ')[-1]
    names = _mentioned(question, list(values))
    if 'in all' in question:
        require(not names, 'A total names no category')
        return str(sum(values.values()))
    if ' or ' in question or 'together' in question:
        require(len(names) == 3, 'Two-step comparison names three categories')
        a, b, c = names
        result = values[a] + values[b] - values[c]
    elif 'more' in question:
        require(len(names) == 2, 'Comparison names two categories')
        result = values[names[0]] - values[names[1]]
    elif 'fewer' in question:
        require(len(names) == 2, 'Comparison names two categories')
        result = values[names[1]] - values[names[0]]
    else:
        require(len(names) == 1, 'A read names one category')
        result = values[names[0]]
    require(result >= 0, f'Comparison has no nonnegative answer: {prompt}')
    return str(result)


def review_data_display_fixtures():
    plot = {'kind': 'line-plot', 'denominator': 4, 'start': 4, 'end': 12, 'mark': 'x', 'unit': 'inches',
            'values': [5, 5, 9, 11, 12]}
    lp = lambda prompt: solve_data_display({'templateId': 'fraction-plot-difference', 'figure': plot, 'prompt': prompt})
    require(lp('Some ribbons, measured to the nearest quarter inch. What is the difference in length between the longest and shortest ribbon, in inches?') == '7/4', 'line-plot difference fixture')
    require(lp('Ribbons. What is the total length of all the ribbons that are 1 1/4 inches long, in inches?') == '5/2', 'line-plot total fixture')
    try:
        lp('Ribbons, measured to the nearest eighth inch. How many ribbons were measured?')
        raise RuntimeError
    except ValueError:
        pass
    except RuntimeError:
        raise ValueError('Contradictory precision was accepted')
    bars = {'kind': 'scaled-bar-graph', 'step': 10, 'max': 60, 'unit': 'cans',
            'categories': [{'label': 'Mon', 'value': 30}, {'label': 'Tue', 'value': 45},
                           {'label': 'Wed', 'value': 15}, {'label': 'Thu', 'value': 50}]}
    case = lambda prompt: {'templateId': 'scaled-bar-graph', 'figure': bars, 'prompt': prompt}
    require(solve_data_display(case('The bar graph shows cans. How many more cans were collected on Tue and Wed together than on Mon?')) == '30', 'two-step fixture')
    require(solve_data_display(case('The bar graph shows cans. How many fewer cans were collected on Wed than on Thu?')) == '35', 'fewer fixture')
    picture = {'kind': 'picture-graph', 'key': 10, 'unit': 'students',
               'categories': [{'label': 'cat', 'count': 30}, {'label': 'dog', 'count': 45}]}
    require(solve_data_display({'templateId': 'scaled-picture-graph', 'figure': picture,
                                'prompt': 'The picture graph shows pets. How many students chose dog?'}) == '45', 'read fixture')
    for bad in (dict(bars, max=65), dict(bars, categories=[{'label': 'Mon', 'value': 33}, {'label': 'Tue', 'value': 10}])):
        try:
            solve_data_display({'templateId': 'scaled-bar-graph', 'figure': bad, 'prompt': 'Cans. How many cans in all?'})
        except ValueError:
            continue
        raise ValueError('Unreadable chart was accepted')
