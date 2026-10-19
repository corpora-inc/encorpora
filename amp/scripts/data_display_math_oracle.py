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
DISTRIBUTIONS = frozenset({
    'statistical-question-choice', 'dot-plot-mean', 'mean-missing-value',
    'histogram-read', 'box-plot-read', 'dot-plot-mad', 'dot-plot-iqr',
    'typical-value-choice',
})
DATA_DISPLAY = EARLY_DATA | LINE_PLOTS | DISTRIBUTIONS
DATA_DISPLAY_CHOICE = frozenset({'sort-shapes-most', 'statistical-question-choice', 'typical-value-choice'})

# The reviewer's own classification: each of these asks for many values from a group.
STATISTICAL = {
    'How many hours of sleep do the students in my class get on a school night?',
    'How long are the songs on my favorite album?',
    'How much do the dogs at the animal shelter weigh?',
    'How many pages are in the books on this shelf?',
    'How many minutes do students at our school spend getting to school?',
    'How tall are the sunflowers in our garden?',
    'How many goals did each player on the team score this season?',
    'What were the high temperatures in our town each day last month?',
}
# Each has exactly one answer.
SINGLE_ANSWER = {
    'How many hours did I sleep last night?', 'How many students are in my class?',
    'What time does my school day begin?', 'How long is the first song on my favorite album?',
    'How many songs are on my favorite album?', 'What is the title of my favorite album?',
    'How much does my dog weigh?', 'How many dogs are at the animal shelter today?',
    'What time does the animal shelter open?', 'How many pages are in this book?',
    'How many books are on this shelf?', 'Which book on this shelf did I read first?',
    'How many minutes did it take me to get to school today?', 'How far is our school from the library?',
    'How many buses does our school have?', 'How tall is the sunflower by the gate?',
    'How many sunflowers are in our garden?', 'When did we plant the sunflowers?',
    'How many goals did Maya score this season?', 'How many players are on the team?',
    'What color are the team’s shirts?', 'What was the high temperature in our town yesterday?',
    'How many days were in last month?', 'What is the name of our town?',
}


def _frac(value):
    return str(value.numerator) if value.denominator == 1 else f'{value.numerator}/{value.denominator}'


def _median(xs):
    k = len(xs) // 2
    return Fraction(xs[k]) if len(xs) % 2 else Fraction(xs[k - 1] + xs[k], 2)


def _dot_values(public):
    figure = public['figure']
    require(figure['kind'] == 'line-plot' and figure['mark'] == 'dot' and figure['denominator'] == 1, 'Dot plot required')
    values = figure['values']
    require(all(figure['start'] <= v <= figure['end'] for v in values), 'Dot off the axis')
    require(max(values.count(v) for v in values) <= 7, 'Stack leaves the plot')
    m = re.search(r'in each of its (\d+) games|each of (\d+) students', public['prompt'])
    require(m is not None and int(m[1] or m[2]) == len(values), 'Stated count contradicts the dots')
    return sorted(values)


def solve_distribution(public):
    template, prompt = public['templateId'], public['prompt']
    if template == 'statistical-question-choice':
        require(prompt == 'Which is a statistical question?' and 'figure' not in public, 'Unexpected statistical prompt')
        options = public['response']['options']
        require(len(options) == 4 and all(o['label'] in STATISTICAL | SINGLE_ANSWER for o in options), 'Unreviewed question')
        valid = [o['id'] for o in options if o['label'] in STATISTICAL]
        require(len(valid) == 1, 'Exactly one statistical question required')
        return valid[0]
    if template == 'mean-missing-value':
        m = re.fullmatch(r'The mean of (\d+) quiz scores is (\d+)\. (Three|Four|Five) of the scores are ([\d, ]+) and (\d+)\. What is the other score\?', prompt)
        require(m is not None, 'Unexpected mean prompt')
        n, mean = int(m[1]), int(m[2])
        known = [int(x) for x in m[4].split(', ')] + [int(m[5])]
        require(len(known) == n - 1 and {'Three': 3, 'Four': 4, 'Five': 5}[m[3]] == n - 1, 'Count mismatch')
        missing = n * mean - sum(known)
        require(0 <= missing <= 100, 'Impossible quiz score')
        return str(missing)
    if template == 'histogram-read':
        f = public['figure']
        require(f['kind'] == 'histogram', 'Histogram required')
        edges = [f['start'] + i * f['width'] for i in range(len(f['counts']) + 1)]
        question = prompt.split('. ')[-1]
        if 'shown in the histogram' in question:
            return str(sum(f['counts']))
        if (m := re.search(r'from (\d+) to (\d+) ', question)):
            a, b = int(m[1]), int(m[2])
            require(a in edges[:-1] and b == a + f['width'] - 1, 'Interval is not one bin')
            return str(f['counts'][edges.index(a)])
        if (m := re.search(r'at least (\d+) ', question)):
            e = int(m[1]); require(e in edges[1:-1], 'Not a bin edge')
            return str(sum(f['counts'][edges.index(e):]))
        if (m := re.search(r'(?:fewer|less) than (\d+) ', question)):
            e = int(m[1]); require(e in edges[1:-1], 'Not a bin edge')
            return str(sum(f['counts'][:edges.index(e)]))
        raise ValueError(f'Unrecognized histogram question {prompt}')
    if template == 'box-plot-read':
        f = public['figure']
        require(f['kind'] == 'box-plot' and list(f['summary']) == sorted(f['summary']), 'Box plot required')
        lo, q1, med, q3, hi = f['summary']
        question = prompt.split('. ')[-1]
        if question.startswith('What is the median'):
            return str(med)
        if question.startswith('What is the interquartile range'):
            return str(q3 - q1)
        if question.startswith('What is the range'):
            return str(hi - lo)
        m = re.fullmatch(r'About what percent of the [a-z ]+ are (greater than|between|less than) (\d+)(?: and (\d+))?\?', question)
        require(m is not None, f'Unrecognized box question {prompt}')
        a = int(m[2])
        if m[1] == 'between':
            require((a, int(m[3])) == (q1, q3), 'Between must name the quartiles')
            return '50'
        cuts = {q1: 25, med: 50, q3: 75}
        require(a in cuts, 'Comparison must name a quartile')
        return str(cuts[a] if m[1] == 'less than' else 100 - cuts[a])
    xs = _dot_values(public)
    n = len(xs)
    if template == 'dot-plot-mean':
        require(prompt.endswith('What is the mean number of goals per game?') or re.search(r'What is the mean number of \w+ per student\?$', prompt), 'Unexpected mean question')
        return _frac(Fraction(sum(xs), n))
    if template == 'dot-plot-mad':
        mean = Fraction(sum(xs), n)
        return _frac(sum(abs(x - mean) for x in xs) / n)
    if template == 'dot-plot-iqr':
        require('leaving out the overall median when the count is odd' in prompt, 'Quartile convention must be stated')
        lower, upper = xs[:n // 2], xs[(n + 1) // 2:]
        return _frac(_median(upper) - _median(lower))
    if template == 'typical-value-choice':
        mean, med = Fraction(sum(xs), n), _median(xs)
        require(sum(1 for x in xs if x > mean) == 1, 'A single value far from the rest is required')
        options = public['response']['options']
        def number(text):
            return Fraction(text)
        valid = []
        for o in options:
            m = re.fullmatch(r'The (median|mean|maximum|range), ([\d.]+|\d+/\d+)', o['label'])
            require(m is not None, 'Choice must name a summary and its value')
            truth = {'median': med, 'mean': mean, 'maximum': Fraction(xs[-1]), 'range': Fraction(xs[-1] - xs[0])}[m[1]]
            require(number(m[2]) == truth, f'Choice states a wrong value: {o["label"]}')
            if m[1] == 'median':
                valid.append(o['id'])
        require(len(valid) == 1, 'One median choice required')
        return valid[0]
    raise ValueError(f'No distribution solver for {template}')


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
    if template in DISTRIBUTIONS:
        return solve_distribution(public)
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
    dots = {'kind': 'line-plot', 'denominator': 1, 'start': 0, 'end': 8, 'mark': 'dot', 'unit': 'goals',
            'values': [1, 2, 2, 3, 7]}
    dp = lambda t, q: solve_distribution({'templateId': t, 'figure': dots,
        'prompt': 'The dot plot shows how many goals a soccer team scored in each of its 5 games. ' + q})
    require(dp('dot-plot-mean', 'What is the mean number of goals per game?') == '3', 'mean fixture')
    require(dp('dot-plot-mad', 'What is the mean absolute deviation of the data?') == '8/5', 'MAD fixture')
    require(dp('dot-plot-iqr', 'What is the interquartile range? Use the median of each half, leaving out the overall median when the count is odd.') == '7/2', 'IQR fixture')
    box = {'kind': 'box-plot', 'start': 0, 'end': 60, 'step': 5, 'summary': [5, 10, 35, 40, 55], 'unit': 'minutes'}
    bp = lambda q: solve_distribution({'templateId': 'box-plot-read', 'figure': box, 'prompt': 'The box plot summarizes times. ' + q})
    require(bp('About what percent of the travel times are greater than 40?') == '25', 'box percent fixture')
    require(bp('About what percent of the travel times are less than 10?') == '25', 'box lower fixture')
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
