"""Independent prompt-and-figure oracle for Algebra 1 statistics (S-ID).

Every answer is recomputed from what the learner sees: dot-plot values, box-plot
summaries, two-way table counts, scatter points and the stated line. Means,
medians and quartiles are computed here with exact fractions; stated
least-squares lines are refitted from the plotted points by the normal
equations; correlation is recomputed; box-plot shapes are judged from the
whisker and box halves; residual-plot curvature is measured by a quadratic
fit. Reasoning items (causation, study design) are judged against this file's
own reviewed lists of lurking variables and reverse explanations and by the
design the prompt states. Generated answers, hints and explanations never enter
`solve_algebra_statistics`.
"""
import math
import re
from fractions import Fraction

ALGEBRA_STATISTICS = frozenset({
    'outlier-center-shift', 'skewed-box-compare', 'relative-frequency-percent',
    'conditional-frequency-choice', 'regression-coefficient-meaning', 'regression-line-predict',
    'residual-value', 'correlation-choice', 'causal-claim-choice', 'study-design-choice',
})
ALGEBRA_STATISTICS_CHOICE = ALGEBRA_STATISTICS - {
    'relative-frequency-percent', 'regression-line-predict', 'residual-value',
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def num(text):
    return Fraction(text.replace('−', '-'))


def scene_element(public, kind):
    f = public.get('figure')
    require(f is not None and f['kind'] == 'scene', 'A scene figure is required')
    elements = [e for e in f['scene']['elements'] if e['type'] == kind]
    require(len(elements) == 1, f'One {kind} required')
    return elements[0]


def options(public):
    return public['response']['options']


def one(valid, what):
    require(len(valid) == 1, f'Exactly one {what} required, found {len(valid)}')
    return valid[0]


# ---------------------------------------------------------------- center
def median(values):
    v = sorted(values)
    n = len(v)
    return Fraction(v[n // 2]) if n % 2 else Fraction(v[n // 2 - 1] + v[n // 2], 2)


def quartiles(values):
    v = sorted(values)
    n = len(v)
    return median(v[:n // 2]), median(v[(n + 1) // 2:])


def change_text(text):
    m = re.fullmatch(r'(?:[Tt]he (mean|median)) (?:does not change|(increases|decreases) by ([\d.]+))', text)
    require(m is not None, f'Unreadable change {text!r}')
    if m[2] is None:
        return m[1], Fraction(0)
    return m[1], (1 if m[2] == 'increases' else -1) * Fraction(m[3])


def solve_outlier(public):
    values = [Fraction(v).limit_denominator(1000) for v in scene_element(public, 'dotPlot')['groups'][0]['values']]
    prompt = public['prompt']
    m = re.search(r'each of (\d+) ', prompt)
    require(m is not None and int(m[1]) == len(values), 'Stated count must match the plot')
    before = list(values)
    if (m := re.search(r'The value (\d+) is an outlier\. If it is removed', prompt)):
        v = Fraction(m[1])
        require(v in values, 'The outlier must be plotted')
        after = list(values)
        after.remove(v)
        far = v
    elif (m := re.search(r'One more value, (\d+), is added to the data\.', prompt)):
        far = Fraction(m[1])
        after = values + [far]
    elif (m := re.search(r'The value (\d+) was recorded by mistake; the correct value is (\d+)\.', prompt)):
        far, fixed = Fraction(m[1]), Fraction(m[2])
        require(far in values, 'The mistaken value must be plotted')
        after = list(values)
        after[after.index(far)] = fixed
    else:
        raise ValueError(f'Unexpected outlier prompt {prompt}')
    full = after if far not in before else before
    q1, q3 = quartiles(full)
    iqr = q3 - q1
    require(far > q3 + Fraction(3, 2) * iqr or far < q1 - Fraction(3, 2) * iqr, 'The far value must be an outlier by the 1.5 IQR rule')
    dm = sum(after) / len(after) - sum(before) / len(before)
    dmed = median(after) - median(before)
    valid = []
    for o in options(public):
        parts = o['label'].rstrip('.').split(', and ')
        require(len(parts) == 2, f'Unreadable option {o["label"]}')
        (n1, v1), (n2, v2) = change_text(parts[0]), change_text(parts[1])
        require((n1, n2) == ('mean', 'median'), 'Mean first, then median')
        if v1 == dm and v2 == dmed:
            valid.append(o['id'])
    return one(valid, 'description of the change')


# ---------------------------------------------------------------- box plots
def shape(s):
    lo, q1, m, q3, hi = s
    if hi - q3 > q1 - lo and q3 - m > m - q1:
        return 'skewed right'
    if q1 - lo > hi - q3 and m - q1 > q3 - m:
        return 'skewed left'
    require(hi - q3 == q1 - lo and q3 - m == m - q1, f'Ambiguous shape {s}')
    return 'roughly symmetric'


def solve_boxes(public):
    box = scene_element(public, 'boxPlot')
    groups = {g['label']: [Fraction(v).limit_denominator(1000) for v in g['summary']] for g in box['groups']}
    require(len(groups) == 2, 'Two box plots')
    names = list(groups)
    prompt = public['prompt']
    if prompt.endswith('Which statement about their spreads is true?'):
        rng = {k: s[4] - s[0] for k, s in groups.items()}
        iqr = {k: s[3] - s[1] for k, s in groups.items()}
        require(rng[names[0]] != rng[names[1]] and iqr[names[0]] != iqr[names[1]], 'Spreads must differ')
        big_range = max(rng, key=rng.get)
        big_iqr = max(iqr, key=iqr.get)
        valid = []
        for o in options(public):
            label = o['label']
            if (m := re.fullmatch(r'(.+) has the greater range and the greater IQR\.', label)):
                claim = (m[1], m[1])
            elif (m := re.fullmatch(r'(.+) has the greater range, but (.+) has the greater IQR\.', label)):
                claim = (m[1], m[2])
            else:
                raise ValueError(f'Unreadable spread option {label}')
            if claim == (big_range, big_iqr):
                valid.append(o['id'])
        return one(valid, 'spread statement')
    shapes = {k: shape(s) for k, s in groups.items()}
    if prompt.endswith('Which describes the shapes of the two distributions?'):
        valid = []
        for o in options(public):
            label = o['label']
            if label == 'Both are roughly symmetric.':
                claim = {k: 'roughly symmetric' for k in names}
            else:
                m = re.fullmatch(r'(.+) is (skewed right|skewed left|roughly symmetric), and (.+) is (skewed right|skewed left|roughly symmetric)\.', label)
                require(m is not None and {m[1], m[3]} == set(names), f'Unreadable shape option {label}')
                claim = {m[1]: m[2], m[3]: m[4]}
            if claim == shapes:
                valid.append(o['id'])
        return one(valid, 'shape description')
    require(prompt.endswith('Which measures should be used to compare the centers and spreads of the two groups?'), f'Unexpected box prompt {prompt}')
    skewed = [k for k, v in shapes.items() if v != 'roughly symmetric']
    require(len(skewed) == 1, 'Exactly one skewed group')
    valid = []
    for o in options(public):
        label = o['label']
        if (m := re.fullmatch(r'The medians and IQRs, because (.+) is skewed, and these are not pulled by its long tail\.', label)):
            if m[1] == skewed[0]:
                valid.append(o['id'])
        else:
            # Means and standard deviations, or ranges, are pulled by a long tail.
            require(re.match(r'The (means and standard deviations|ranges)\b', label) is not None, f'Unreviewed measure {label}')
    return one(valid, 'choice of measures')


# ---------------------------------------------------------------- two-way tables
TABLES = {
    'Way to school': {
        'who': 'students',
        'rows': {'ninth graders': 'Grade 9', 'twelfth graders': 'Grade 12'},
        'cols': {'ride the bus': 'Bus', 'get to school another way': 'Other'},
    },
    'Sleeps 8 hours or more': {
        'who': 'students',
        'rows': {'athletes': 'Athlete', 'non-athletes': 'Non-athlete'},
        'cols': {'sleep 8 hours or more': 'Yes', 'sleep less than 8 hours': 'No'},
    },
    'Prefers to watch': {
        'who': 'adults',
        'rows': {'adults under 30': 'Under 30', 'adults 30 and over': '30 and over'},
        'cols': {'prefer a theater': 'Theater', 'prefer streaming': 'Streaming'},
    },
    'Owns a pet': {
        'who': 'adults',
        'rows': {'city residents': 'City', 'rural residents': 'Rural'},
        'cols': {'own a pet': 'Yes', 'do not own a pet': 'No'},
    },
}


class TwoWay:
    def __init__(self, public):
        t = scene_element(public, 'table')
        require(t.get('sums') and t['columns'][-1] == 'Total' and t['rows'][-1]['label'] == 'Total', 'Two-way table with totals')
        self.ctx = TABLES[t['title']]
        body = [r for r in t['rows'][:-1]]
        self.rows = [r['label'] for r in body]
        self.cols = t['columns'][:-1]
        self.cell = {(r['label'], c): Fraction(r['cells'][j]) for r in body for j, c in enumerate(self.cols)}
        # Margins are recomputed, then checked against the printed totals.
        self.row_total = {r: sum(self.cell[(r, c)] for c in self.cols) for r in self.rows}
        self.col_total = {c: sum(self.cell[(r, c)] for r in self.rows) for c in self.cols}
        self.n = sum(self.row_total.values())
        for r in body:
            require(Fraction(r['cells'][-1]) == self.row_total[r['label']], 'Row total mismatch')
        total = t['rows'][-1]['cells']
        require([Fraction(v) for v in total] == [self.col_total[c] for c in self.cols] + [self.n], 'Column totals mismatch')

    def row(self, noun):
        require(noun in self.ctx['rows'], f'Unknown group {noun!r}')
        return self.ctx['rows'][noun]

    def col(self, phrase):
        require(phrase in self.ctx['cols'], f'Unknown answer {phrase!r}')
        return self.ctx['cols'][phrase]

    def pct(self, a, b):
        return 100 * a / b


def statement_percent(tw, text):
    """The true percent a statement describes, or None if unreadable."""
    who = tw.ctx['who']
    for noun in tw.ctx['rows']:
        for phrase in tw.ctx['cols']:
            r, c = tw.row(noun), tw.col(phrase)
            if text == f'of everyone surveyed are {noun} who {phrase}.':
                return tw.pct(tw.cell[(r, c)], tw.n)
            if text == f'of the {who} who {phrase} are {noun}.':
                return tw.pct(tw.cell[(r, c)], tw.col_total[c])
            if text == f'of {noun} {phrase}.':
                return tw.pct(tw.cell[(r, c)], tw.row_total[r])
        if text == f'of everyone surveyed are {noun}.':
            return tw.pct(tw.row_total[tw.row(noun)], tw.n)
    return None


def solve_relative_frequency(public):
    tw = TwoWay(public)
    q = public['prompt'].split('. ')[-1]
    who = tw.ctx['who']
    rows, cols = '|'.join(map(re.escape, tw.ctx['rows'])), '|'.join(map(re.escape, tw.ctx['cols']))
    if (m := re.fullmatch(rf'What percent of the (\d+) {who} surveyed are ({rows}) who ({cols})\?', q)):
        require(Fraction(m[1]) == tw.n, 'Stated total mismatch')
        value = tw.pct(tw.cell[(tw.row(m[2]), tw.col(m[3]))], tw.n)
    elif (m := re.fullmatch(rf'What percent of the (\d+) {who} surveyed are ({rows})\?', q)):
        require(Fraction(m[1]) == tw.n, 'Stated total mismatch')
        value = tw.pct(tw.row_total[tw.row(m[2])], tw.n)
    elif (m := re.fullmatch(rf'What percent of the (\d+) {who} surveyed ({cols})\?', q)):
        require(Fraction(m[1]) == tw.n, 'Stated total mismatch')
        value = tw.pct(tw.col_total[tw.col(m[2])], tw.n)
    elif (m := re.fullmatch(rf'What percent of the ({rows}) ({cols})\?', q)):
        r = tw.row(m[1])
        value = tw.pct(tw.cell[(r, tw.col(m[2]))], tw.row_total[r])
    elif (m := re.fullmatch(rf'Of the {who} who ({cols}), what percent are ({rows})\?', q)):
        c = tw.col(m[1])
        value = tw.pct(tw.cell[(tw.row(m[2]), c)], tw.col_total[c])
    else:
        raise ValueError(f'Unexpected table question {q}')
    require(value.denominator == 1, 'Percent must be whole')
    return str(value.numerator)


def solve_conditional_choice(public):
    tw = TwoWay(public)
    prompt = public['prompt']
    q = prompt.split('. ')[-1]
    if (m := re.search(r'One calculation from the table is \$(\d+) \\div (\d+) = (\d+)\\%\$\. What does this percent describe\?$', prompt)):
        a, b, p = Fraction(m[1]), Fraction(m[2]), Fraction(m[3])
        require(100 * a / b == p, 'The stated calculation must be right')
        valid = []
        for o in options(public):
            mm = re.fullmatch(r'(\d+)% (.+)', o['label'])
            require(mm is not None and Fraction(mm[1]) == p, f'Unreadable statement {o["label"]}')
            truth = statement_percent(tw, mm[2])
            require(truth is not None, f'Unreviewed statement {o["label"]}')
            if truth == p:
                valid.append(o['id'])
        return one(valid, 'true reading')
    if q.startswith('Is there an association between the group and whether they '):
        phrase = q.removeprefix('Is there an association between the group and whether they ').removesuffix('?')
        c = tw.col(phrase)
        p = {r: tw.pct(tw.cell[(r, c)], tw.row_total[r]) for r in tw.rows}
        gap = abs(p[tw.rows[0]] - p[tw.rows[1]])
        require(gap >= 20 or gap <= 5, 'Ambiguous association')
        associated = gap >= 20
        nouns = {tw.row(n): n for n in tw.ctx['rows']}
        valid = []
        for o in options(public):
            label = o['label']
            if (mm := re.fullmatch(rf'Yes: (\d+)% of (.+) {re.escape(phrase)}, but only (\d+)% of (.+)\.', label)) and 'everyone surveyed' not in label and not label.startswith('Yes: of'):
                truth = associated and p[tw.row(mm[2])] == Fraction(mm[1]) and p[tw.row(mm[4])] == Fraction(mm[3])
            elif (mm := re.fullmatch(rf'No: (\d+)% of (.+) and (\d+)% of (.+) {re.escape(phrase)}, about the same\.', label)):
                truth = (not associated) and p[tw.row(mm[2])] == Fraction(mm[1]) and p[tw.row(mm[4])] == Fraction(mm[3])
            elif 'of everyone surveyed' in label or label.startswith(('Yes: of the', 'No: of the')):
                truth = False  # joint percents and column splits reflect group sizes
            else:
                raise ValueError(f'Unreviewed association option {label}')
            if truth:
                valid.append(o['id'])
        require(set(nouns) == set(tw.rows), 'Every row must be a known group')
        return one(valid, 'association conclusion')
    rows, cols = '|'.join(map(re.escape, tw.ctx['rows'])), '|'.join(map(re.escape, tw.ctx['cols']))
    if (m := re.fullmatch(rf'What percent of the ({rows}) ({cols})\?', q)):
        r = tw.row(m[1])
        value = tw.pct(tw.cell[(r, tw.col(m[2]))], tw.row_total[r])
    elif (m := re.fullmatch(rf'Of the {tw.ctx["who"]} who ({cols}), what percent are ({rows})\?', q)):
        c = tw.col(m[1])
        value = tw.pct(tw.cell[(tw.row(m[2]), c)], tw.col_total[c])
    else:
        raise ValueError(f'Unexpected conditional prompt {q}')
    valid = [o['id'] for o in options(public) if num(o['label'].rstrip('%')) == value]
    return one(valid, 'percent')


# ---------------------------------------------------------------- least squares
def fraction(v):
    return Fraction(v).limit_denominator(100000)


def least_squares(points):
    n = len(points)
    sx = sum(x for x, _ in points)
    sy = sum(y for _, y in points)
    sxx = sum(x * x for x, _ in points)
    sxy = sum(x * y for x, y in points)
    m = (n * sxy - sx * sy) / (n * sxx - sx * sx)
    return m, (sy - m * sx) / n


def stated_line(prompt):
    m = re.search(r'the least-squares line \$\\hat\{y\} = (-?[\d.]+)x(?: ([+-]) ([\d.]+))?\$', prompt)
    require(m is not None, 'A stated least-squares line is required')
    slope = Fraction(m[1])
    b = Fraction(0) if m[2] is None else (Fraction(m[3]) if m[2] == '+' else -Fraction(m[3]))
    return slope, b


def graph_points(public):
    g = scene_element(public, 'graph')
    points = [(fraction(x), fraction(y)) for x, y in g['scatter']['points']]
    for x, y in points:
        require(g['x'][0] <= x <= g['x'][1] and g['y'][0] <= y <= g['y'][1], 'Point off the grid')
    return g, points


def checked_line(public):
    """The stated line, refitted from the plotted points and the drawn fit."""
    slope, b = stated_line(public['prompt'])
    g, points = graph_points(public)
    m2, b2 = least_squares(points)
    require(abs(m2 - slope) < Fraction(1, 10**6) and abs(b2 - b) < Fraction(1, 10**6), f'Stated line {slope}, {b} is not the least-squares line {float(m2)}, {float(b2)}')
    fit = g['scatter']['fit']
    require(fraction(fit['m']) == slope and fraction(fit['b']) == b, 'The drawn line must be the stated line')
    return slope, b, g, points


# Units of each data axis, by its printed name: x unit (singular), y unit (plural).
AXES = {
    'practice (hours)': ('hour', 'points', 'hour of practice'),
    'age (years)': ('year', 'thousand dollars', 'year of age'),
    'height (cm)': ('centimeter', 'kilograms', 'centimeter of height'),
    'high temperature (°F)': ('degree', 'cups', 'degree'),
}
UP = {'higher', 'more', 'greater', 'warmer'}
DOWN = {'lower', 'fewer', 'less', 'cooler'}


def show(v):
    v = Fraction(v)
    text = str(v.numerator) if v.denominator == 1 else f'{float(v):g}'
    return text.replace('-', '−')


def solve_coefficient(public):
    slope, b, g, points = checked_line(public)
    prompt = public['prompt']
    x_unit, y_units, per = AXES[g['axisNames'][0]]
    if prompt.endswith('In what units is the slope measured?'):
        valid = [o['id'] for o in options(public) if o['label'] == f'{y_units} per {x_unit}']
        return one(valid, 'unit')
    if prompt.endswith('What does the slope mean in this context?'):
        valid = []
        for o in options(public):
            words = set(re.findall(r'[a-z]+', o['label'].lower()))
            if (o['label'].startswith(f'Each additional {per} ')
                    and show(abs(slope)) in re.findall(r'[\d.]+', o['label'])
                    and words & (UP if slope > 0 else DOWN) and not words & (DOWN if slope > 0 else UP)):
                valid.append(o['id'])
        return one(valid, 'slope interpretation')
    m = re.search(r'Does the \$y\$-intercept, (−?[\d.]+), have a meaning in this context\?$', prompt)
    require(m is not None, f'Unexpected coefficient prompt {prompt}')
    require(num(m[1]) == b, 'Stated intercept must match the line')
    xs = [x for x, _ in points]
    meaningful = min(xs) <= 0 <= max(xs) and b >= 0
    require(meaningful or (min(xs) > 0 and min(xs) > (max(xs) - min(xs)) and b < 0), 'Intercept meaning must be clear-cut')
    valid = []
    for o in options(public):
        label = o['label']
        if label.startswith('Yes: ') and 'each additional' not in label.lower():
            truth = meaningful and show(b) in label
        elif label.startswith('No: ') and 'never' not in label:
            truth = not meaningful
        else:
            truth = False  # a slope reading, or "never"
        if truth:
            valid.append(o['id'])
    return one(valid, 'intercept reading')


def solve_predict(public):
    slope, b, g, _ = checked_line(public)
    q = public['prompt']
    if (m := re.search(r'Use the line to predict [^.]*?(?:practices (\d+) hours?|that is (\d+) years? old|who is (\d+) cm tall|a high of (\d+) degrees)\.$', q)):
        x = Fraction(next(v for v in m.groups() if v))
        require(fraction(g['scatter']['predict']) == x, 'The drawn prediction must be at the asked input')
        return str(slope * x + b)
    if (m := re.search(r'(?:practice (\d+) hours? and (\d+) hours?|are (\d+) and (\d+) years old|are (\d+) cm and (\d+) cm tall|a high of (\d+) degrees and another (\d+) degrees)\.', q)):
        a, z = [Fraction(v) for v in m.groups() if v]
        return str(abs(slope * (z - a)))
    if (m := re.search(r'(?:predict a score of|predict a value of|predict a mass of|predict) (−?[\d.]+)(?: thousand dollars| kg| cups sold)?\?$', q)):
        x = (num(m[1]) - b) / slope
        require(x.denominator == 1, 'The input must be whole')
        return str(x)
    raise ValueError(f'Unexpected prediction prompt {q}')


def solve_residual(public):
    prompt = public['prompt']
    slope, b = stated_line(prompt)
    q = prompt.split('. ')[-1]
    f = public['figure']['scene']['elements'][0]
    if f['type'] == 'table':
        m = re.search(r'for the \w+ (?:who practiced (\d+) hours?|that is (\d+) years? old|who is (\d+) cm tall|with a high of (\d+) degrees)\?$', q)
        require(m is not None, f'Unexpected table residual prompt {q}')
        x = Fraction(next(v for v in m.groups() if v))
        missing = []
        for row in f['rows']:
            rx, (y, e) = Fraction(row['label'].replace('−', '-')), row['cells']
            predicted = slope * rx + b
            if e is None:
                missing.append((rx, fraction(y) - predicted))
            else:
                require(fraction(e) == fraction(y) - predicted, 'Every given residual must follow from the line')
        require(len(missing) == 1 and missing[0][0] == x, 'The asked row must be the blank one')
        return str(missing[0][1])
    slope, b, g, points = checked_line(public)
    if (m := re.search(r'(\d+)(?: hours?| years? old| cm tall| degrees), and the residual for this \w+ is (−?[\d.]+)\.', prompt)):
        x, e = Fraction(m[1]), num(m[2])
        return str(slope * x + b + e)
    m = re.search(r'(?:practiced (\d+) hours? and scored|is (\d+) years? old and worth|is (\d+) cm tall and has a mass of|the high was (\d+) degrees and the stand sold) (−?[\d.]+)', prompt)
    require(m is not None, f'Unexpected residual prompt {prompt}')
    x, y = Fraction(next(v for v in m.groups()[:4] if v)), num(m[5])
    require((x, y) in points, 'The asked case must be plotted')
    return str(y - (slope * x + b))


# ---------------------------------------------------------------- correlation
def correlation(points):
    n = len(points)
    mx = sum(x for x, _ in points) / n
    my = sum(y for _, y in points) / n
    sxy = sum((x - mx) * (y - my) for x, y in points)
    sxx = sum((x - mx) ** 2 for x, _ in points)
    syy = sum((y - my) ** 2 for _, y in points)
    return float(sxy) / math.sqrt(float(sxx) * float(syy))


def quadratic_r2(points):
    """R² of the least-squares parabola, by the normal equations in exact arithmetic."""
    s = lambda k: sum(x ** k for x, _ in points)
    t = lambda k: sum(x ** k * y for x, y in points)
    a = [[s(4), s(3), s(2), t(2)], [s(3), s(2), s(1), t(1)], [s(2), s(1), Fraction(len(points)), t(0)]]
    for i in range(3):
        p = next(r for r in range(i, 3) if a[r][i] != 0)
        a[i], a[p] = a[p], a[i]
        for r in range(3):
            if r != i:
                k = a[r][i] / a[i][i]
                a[r] = [u - k * w for u, w in zip(a[r], a[i])]
    c = [a[i][3] / a[i][i] for i in range(3)]
    my = sum(y for _, y in points) / len(points)
    sse = sum((y - (c[0] * x * x + c[1] * x + c[2])) ** 2 for x, y in points)
    sst = sum((y - my) ** 2 for _, y in points)
    return float(1 - sse / sst)


def solve_correlation(public):
    prompt = public['prompt']
    if prompt.startswith('Four data sets have the correlation coefficients below.'):
        values = {}
        for o in options(public):
            m = re.fullmatch(r'\$r = (-?[\d.]+)\$', o['label'])
            require(m is not None, f'Unreadable r {o["label"]}')
            values[o['id']] = Fraction(m[1])
        top = max(abs(v) for v in values.values())
        return one([k for k, v in values.items() if abs(v) == top], 'strongest r')
    g, points = graph_points(public)
    if prompt.endswith('Which value is closest to the correlation coefficient, $r$?'):
        r = correlation(points)
        dist = sorted((abs(r - float(num(o['label']))), o['id']) for o in options(public))
        require(dist[0][0] <= 0.1 + 1e-9 and dist[1][0] - dist[0][0] > 0.15, f'r = {r:.3f} is not clearly closest to one option')
        return dist[0][1]
    if g.get('frame'):
        require('The residual plot shows each residual' in prompt, 'A residual plot prompt')
        fit = g['scatter']['fit']
        require(fit['m'] == 0 and fit['b'] == 0, 'The zero line is drawn')
        q = quadratic_r2(points)
        require(q >= 0.6 or q <= 0.3, f'Ambiguous residual pattern {q:.2f}')
        curved = q >= 0.6
        valid = []
        for o in options(public):
            label = o['label']
            if 'no pattern' in label:
                truth = not curved
            elif 'follow a curve' in label:
                truth = curved
            elif label.startswith(('Some residuals are negative', 'About half the residuals')):
                truth = False
            else:
                raise ValueError(f'Unreviewed residual option {label}')
            if truth:
                valid.append(o['id'])
        return one(valid, 'residual reading')
    m = re.search(r'For these data, \$r = (-?[\d.]+)\$\. Which statement is true\?$', prompt)
    require(m is not None, f'Unexpected correlation prompt {prompt}')
    r = correlation(points)
    require(abs(r - float(m[1])) <= 0.005 + 1e-9, 'Stated r must match the points')
    require(abs(r) <= 0.15 and quadratic_r2(points) >= 0.85, 'A strong curve with r near 0')
    valid = []
    for o in options(public):
        label = o['label']
        if 'clear curve' in label and 'only linear association' in label:
            valid.append(o['id'])
        else:
            require(any(k in label for k in ('no relationship', 'a line fits', 'strong positive linear')), f'Unreviewed curve option {label}')
    return one(valid, 'statement about r')


# ---------------------------------------------------------------- causation
LURKING = {
    'How hot and sunny each day was', 'The size of each fire', "The students' ages",
    'The population of each city',
}
NOT_LURKING = {
    'The flavors of ice cream on sale', 'The color of the ice cream cones',
    'The number of people treated for sunburn', 'The color of the fire trucks',
    'The names of the firefighters', 'The amount of damage', "The colors of the students' shoes",
    'The day the scores were recorded', "The students' reading scores", 'The color of the police cars',
    'The year each city was founded', 'The number of reported crimes',
}
REVERSE = {
    'Cities with more crime hire more police officers.',
    'Students who already have low grades go to tutoring more often.',
    'Adults with less stress have more time and energy to exercise.',
}
NOT_REVERSE = {
    'Police officers cause crime.', 'Bigger cities have both more officers and more crimes.',
    'Going to tutoring lowers grades.', 'Students in harder courses both get lower grades and seek more help.',
    'Exercising lowers stress.', 'Adults with more free time both exercise more and feel less stress.',
    'The association happened by chance, so it means nothing.',
}


def solve_causal(public):
    prompt = public['prompt']
    require('random' not in prompt.lower(), 'These are observational data')
    labels = {o['id']: o['label'] for o in options(public)}
    if prompt.endswith('Which is a lurking variable that could explain this association?'):
        require(all(v in LURKING | NOT_LURKING for v in labels.values()), f'Unreviewed lurking option {labels}')
        return one([k for k, v in labels.items() if v in LURKING], 'lurking variable')
    if prompt.endswith('Which explanation reverses cause and effect?'):
        require(all(v in REVERSE | NOT_REVERSE for v in labels.values()), f'Unreviewed reverse option {labels}')
        return one([k for k, v in labels.items() if v in REVERSE], 'reverse explanation')
    require(prompt.endswith('Which conclusion do the data support?'), f'Unexpected causal prompt {prompt}')
    _, points = graph_points(public)
    r = correlation(points)
    rising = re.search(r'tended to (?:have|report) (?:more|higher)', prompt) is not None
    require((r > 0.3) if rising else (r < -0.3), 'The plotted trend must match the stated association')
    valid = []
    for k, v in labels.items():
        if 'are associated, but these data cannot show a cause' in v:
            valid.append(k)
        else:
            require(v.startswith('The data show that') or ' would ' in v or v.endswith('are not related.'), f'Unreviewed conclusion {v}')
    return one(valid, 'supported conclusion')


def solve_study(public):
    prompt = public['prompt']
    labels = {o['id']: o['label'] for o in options(public)}
    if prompt.endswith('Which study can show this?'):
        return one([k for k, v in labels.items() if v.startswith('Randomly assign') and 'compare' in v], 'randomized design')
    randomized = 'randomly assigned' in prompt
    require(randomized or any(w in prompt for w in ('asked', 'surveyed', 'looked at')), 'The design must be stated')
    if prompt.endswith('Which describes this study?'):
        want = ('It is an experiment, so it can show cause and effect.' if randomized
                else 'It is an observational study, so it can show an association but not cause and effect.')
        return one([k for k, v in labels.items() if v == want], 'study description')
    require(prompt.endswith('Which conclusion is justified?'), f'Unexpected study prompt {prompt}')
    t = scene_element(public, 'table')
    body = t['rows'][:-1]
    pct = [Fraction(100 * r['cells'][0], r['cells'][0] + r['cells'][1]) for r in body]
    require(pct[0] - pct[1] >= 20, 'A clear difference')
    valid = []
    for k, v in labels.items():
        m = re.fullmatch(r'The (.+) did better, (\d+)% to (\d+)%(\. Random assignment makes this evidence of a cause\.|, but without random assignment this does not show a cause\.)', v)
        if m:
            numbers = [Fraction(m[2]), Fraction(m[3])] == pct
            if numbers and (m[4].startswith('. Random') == randomized):
                valid.append(k)
        else:
            require(v.startswith('More ') or 'about equally well' in v, f'Unreviewed study conclusion {v}')
    return one(valid, 'justified conclusion')


def solve_algebra_statistics(public):
    template = public['templateId']
    if template == 'outlier-center-shift':
        return solve_outlier(public)
    if template == 'skewed-box-compare':
        return solve_boxes(public)
    if template == 'relative-frequency-percent':
        return solve_relative_frequency(public)
    if template == 'conditional-frequency-choice':
        return solve_conditional_choice(public)
    if template == 'regression-coefficient-meaning':
        return solve_coefficient(public)
    if template == 'regression-line-predict':
        return solve_predict(public)
    if template == 'residual-value':
        return solve_residual(public)
    if template == 'correlation-choice':
        return solve_correlation(public)
    if template == 'causal-claim-choice':
        return solve_causal(public)
    if template == 'study-design-choice':
        return solve_study(public)
    raise ValueError(f'Not a statistics template {template}')


def review_algebra_statistics_problem(problem, solved):
    """Numeric explanations end on the answer they derive."""
    public = problem['public']
    if public['templateId'] in ALGEBRA_STATISTICS_CHOICE:
        wrong = {o['label'] for o in options(public) if o['id'] != problem['answer']}
        require(not any(line in wrong for line in problem['explanation']), 'An explanation never states a wrong option as its conclusion')
        return
    last = problem['explanation'][-1].replace('−', '-')
    v = Fraction(solved)
    text = show(v).replace('−', '-')
    require(re.search(rf'(?<![\d.]){re.escape(text)}(?![\d])', last) is not None, f'Explanation must conclude with the answer {text}: {last}')


def review_algebra_statistics_fixtures():
    # The median of halves leaves out the middle value of an odd count.
    require(quartiles([1, 2, 3, 4, 5, 6, 7]) == (2, 6), 'Quartile convention')
    require(median([1, 2, 3, 4]) == Fraction(5, 2), 'Median of an even count')
    # A least-squares refit: residuals that sum to zero and are uncorrelated with x.
    pts = [(Fraction(x), Fraction(2 * x + 1) + e) for x, e in zip(range(5), [1, -1, 0, -1, 1])]
    require(least_squares(pts) == (2, 1), 'Least squares by the normal equations')
    require(abs(correlation([(0, 0), (1, 1), (2, 2)]) - 1) < 1e-12, 'Perfect correlation')
    require(quadratic_r2([(Fraction(x), Fraction(x * x)) for x in range(-3, 4)]) > 0.999, 'A parabola fits a parabola')
    require(shape([0, 2, 3, 6, 14]) == 'skewed right' and shape([0, 8, 11, 12, 14]) == 'skewed left', 'Shapes')
    # A mutated outlier option (the median moving as far as the mean) is rejected.
    public = {
        'templateId': 'outlier-center-shift',
        'prompt': 'The dot plot shows the number of books each of 8 students read over the summer. The value 20 is an outlier. If it is removed, how do the mean and the median change?',
        'figure': {'kind': 'scene', 'scene': {'elements': [{'type': 'dotPlot', 'groups': [{'values': [2, 3, 4, 4, 5, 5, 5, 20]}]}]}},
        'response': {'options': [
            {'id': 'a', 'label': 'The mean decreases by 2, and the median decreases by 0.5.'},
            {'id': 'b', 'label': 'The mean decreases by 2, and the median decreases by 2.'},
        ]},
    }
    require(solve_outlier(public) == 'a', 'Outlier fixture')
    public['response']['options'][0]['label'] = 'The mean decreases by 2, and the median decreases by 1.'
    try:
        solve_outlier(public)
    except ValueError:
        pass
    else:
        raise ValueError('A wrong median change must be rejected')
