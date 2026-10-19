"""Independent oracle for data-display families: reads only the public prompt,
the displayed chart data and the option labels, never the generated answer."""
import re

EARLY_DATA = frozenset({
    'sort-shapes-count', 'sort-shapes-most', 'picture-graph-questions',
    'scaled-picture-graph', 'scaled-bar-graph',
})
DATA_DISPLAY = EARLY_DATA
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


def solve_data_display(public):
    template = public['templateId']
    figure = public['figure']
    prompt = public['prompt']
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
