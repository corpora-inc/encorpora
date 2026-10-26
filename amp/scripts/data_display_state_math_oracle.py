"""Independent review of stem-and-leaf construction, frequency tables, circle graphs,
display choice and return claims. Reads only the public payload."""
import copy
import re
from fractions import Fraction

SUPPORTED = frozenset({
    'stem-leaf-construct', 'frequency-table-build', 'circle-graph-read',
    'best-display-choice', 'return-claim-check',
})


def require(condition, message):
    if not condition:
        raise ValueError(message)


def plain(text):
    return re.sub(r'\s+', ' ', text.replace('$', '').replace('−', '-').replace('\\mid', ' | '))


def options_of(public):
    response = public['response']
    require(response['kind'] == 'choice', 'Choice response required')
    options = response['options']
    require(len(options) == 4 and len({o['id'] for o in options}) == 4, 'Four distinct choice IDs required')
    return options


def only_correct(options, flags, label):
    correct = [o['id'] for o, flag in zip(options, flags) if flag]
    require(len(correct) == 1, f'{label}: missing or ambiguous correct choice ({len(correct)})')
    return correct[0]


# ---------------------------------------------------------------- stem and leaf
def split_value(text, decimal):
    if decimal:
        whole, tenth = text.split('.')
        return int(whole), int(tenth)
    number = int(text)
    return number // 10, number % 10


def plot_rows(values, decimal):
    pairs = [split_value(v, decimal) for v in values]
    low, high = min(p[0] for p in pairs), max(p[0] for p in pairs)
    return tuple((stem, tuple(sorted(leaf for s, leaf in pairs if s == stem))) for stem in range(low, high + 1))


def parse_plot_text(label):
    rows = []
    for part in label.replace('\u00a0', ' ').split(';'):
        match = re.fullmatch(r'\s*(\d+) \|\s*([\d ]*)', part)
        require(match is not None, f'Unreadable plot row {part!r}')
        rows.append((int(match[1]), tuple(int(x) for x in match[2].split())))
    return tuple(rows)


def key_value(stem, leaf, decimal):
    return Fraction(stem * 10 + leaf, 10) if decimal else Fraction(stem * 10 + leaf)


def solve_stem_leaf(public):
    prompt = plain(public['prompt'])
    options = options_of(public)
    listed = re.search(r'(?:values?[^:]*|values, [^:]*): ([\d., ]+)\. (?:Which|Which)', prompt)
    require(listed is not None, 'Data list must be displayed')
    values = [v.strip() for v in listed[1].split(',')]
    count = int(re.search(r'(\d+) values', prompt)[1])
    require(len(values) == count, 'Stated count must equal listed values')
    decimal = any('.' in v for v in values)
    require(all(('.' in v) == decimal for v in values), 'Mixed decimal and whole data')
    if decimal:
        require(all(re.fullmatch(r'\d+\.\d', v) for v in values), 'Decimal data must have one decimal place')
    expected = plot_rows(values, decimal)
    if 'Which stem-and-leaf plot' in prompt:
        require(public.get('figure') is None, 'Plot-choice problems must not display the plot')
        if decimal:
            require('whole-number part as the stem and the tenths digit as the leaf' in prompt, 'Decimal stem rule must be stated')
        else:
            require('tens digit as the stem and the ones digit as the leaf' in prompt, 'Whole-number stem rule must be stated')
        example = re.search(r'For example, (\d+) \| (\d+) means ([\d.]+) ', prompt)
        require(example is not None, 'Stated key example required')
        require(key_value(int(example[1]), int(example[2]), decimal) == Fraction(example[3]), 'Stated key example is wrong')
        plots = [parse_plot_text(o['label']) for o in options]
        require(len(set(plots)) == 4, 'Mathematically duplicate plots')
        # An empty stem must stay between the extremes: the expected plot has every stem.
        return only_correct(options, [plot == expected for plot in plots], 'stem-leaf plot')
    require('Which key matches the plot' in prompt, 'Unknown stem-leaf prompt')
    figure = public['figure']['scene']['elements']
    require(len(figure) == 1 and figure[0]['type'] == 'table', 'Plot table required')
    shown = tuple((int(r['label']), tuple(int(x) for x in r['cells'][0].split())) for r in figure[0]['rows'])
    require(shown == expected, 'Displayed plot does not match the listed data')
    labels = [plain(o['label']) for o in options]
    parsed = [re.fullmatch(r'(\d+) \| (\d+) means ([\d.]+) .+', label) for label in labels]
    require(all(parsed), 'Unreadable key choices')
    stems = {(int(m[1]), int(m[2])) for m in parsed}
    require(len(stems) == 1, 'Every key choice must show the same stem and leaf')
    stem, leaf = stems.pop()
    require((stem, leaf) in {(s, l) for s, ls in expected for l in ls}, 'Keyed stem and leaf must appear in the plot')
    meanings = [Fraction(m[3]) for m in parsed]
    require(len(set(meanings)) == 4, 'Mathematically duplicate key meanings')
    return only_correct(options, [m == key_value(stem, leaf, decimal) for m in meanings], 'stem-leaf key')


# -------------------------------------------------------------- frequency table
def parse_table(label):
    rows = []
    for part in label.split(', '):
        match = re.fullmatch(r'(\d+)(?:–(\d+))?: (\d+)', part)
        require(match is not None, f'Unreadable table row {part!r}')
        rows.append((int(match[1]), None if match[2] is None else int(match[2]), int(match[3])))
    return tuple(rows)


def solve_frequency(public):
    prompt = plain(public['prompt'])
    options = options_of(public)
    count = int(re.search(r'for (\d+) \w+(?: \w+)*?[:.,]', prompt)[1])
    figure = public.get('figure')
    stated = re.search(r'one row for each whole number from (\d+) to (\d+)\.', prompt)
    if figure is not None:
        require(figure['kind'] == 'line-plot' and figure['denominator'] == 1, 'Whole-number dot plot required')
        values = list(figure['values'])
        low, high = figure['start'], figure['end']
        require(prompt.startswith('The dot plot shows'), 'Dot plot prompt expected')
    else:
        listed = re.search(r': ([\d, ]+)\. (?:Which|Each interval|The table|How many)', prompt)
        require(listed is not None, 'Data list must be displayed')
        values = [int(v) for v in listed[1].split(',')]
        if stated:
            low, high = int(stated[1]), int(stated[2])
    require(len(values) == count, 'Stated count must equal the data count')
    single = re.search(r'How many (?:are in the interval (\d+)–(\d+)|\w+ have exactly (\d+) )', prompt)
    if single:
        labels = [o['label'] for o in options]
        require(all(re.fullmatch(r'\d+', x) for x in labels) and len(set(map(int, labels))) == 4, 'Distinct counts required')
        if single[1] is not None:
            require('Each interval includes both of its end values' in prompt, 'Interval endpoint convention must be stated')
            expected = sum(1 for v in values if int(single[1]) <= v <= int(single[2]))
        else:
            expected = values.count(int(single[3]))
        return only_correct(options, [int(x) == expected for x in labels], 'single frequency')
    grouped = 'groups them into intervals' in prompt
    if not grouped and figure is None:
        require(stated is not None, 'The table rows must be stated for a list of values')
    if not grouped:
        require(min(values) >= low and max(values) <= high, 'Data outside displayed range')
    tables = [parse_table(o['label']) for o in options]
    require(len({t for t in tables}) == 4, 'Duplicate tables')
    if grouped:
        require('Each interval includes both of its end values' in prompt, 'Interval endpoint convention must be stated')
    flags = []
    for table in tables:
        total = sum(row[2] for row in table)
        if grouped:
            ok = all(row[1] is not None for row in table) and table[0][0] == 0
            if ok:
                width = table[0][1] - table[0][0] + 1
                ok = width > 1 and all(r[1] - r[0] + 1 == width for r in table) and all(
                    table[i + 1][0] == table[i][1] + 1 for i in range(len(table) - 1)
                ) and table[-1][1] >= max(values)
            ok = ok and all(r[2] == sum(1 for v in values if r[0] <= v <= r[1]) for r in table)
            ok = ok and total == count
        else:
            ok = all(row[1] is None for row in table) and [row[0] for row in table] == list(range(low, high + 1))
            ok = ok and all(r[2] == values.count(r[0]) for r in table)
        flags.append(ok)
    return only_correct(options, flags, 'frequency table')


# ----------------------------------------------------------------- circle graph
def parse_cell(cell):
    text = str(cell).replace('%', '').replace('°', '')
    return Fraction(text)


def solve_circle(public):
    prompt = plain(public['prompt'])
    options = options_of(public)
    elements = public['figure']['scene']['elements']
    require(len(elements) == 1 and elements[0]['type'] == 'table', 'Sector table required')
    table = elements[0]
    require(table['columns'] in (['Number'], ['Percent'], ['Angle']), 'Unknown sector column')
    column = table['columns'][0]
    cells = {r['label']: (None if r['cells'][0] is None else parse_cell(r['cells'][0])) for r in table['rows']}
    require(len(cells) == len(table['rows']), 'Duplicate sector labels')
    whole = {'Number': None, 'Percent': Fraction(100), 'Angle': Fraction(360)}[column]
    people = re.search(r'graph shows (?:the favorite \w+ of|how) (\d+) ', prompt)
    stated_count = Fraction(people[1]) if people else None
    if column == 'Number':
        require(stated_count is not None, 'A count table needs a stated total')
        whole = stated_count
    else:
        full = re.search(r'full circle is (\d+)°|which is (\d+)°', prompt)
        require(full is None or int(full[1] or full[2]) == 360, 'The full circle is 360 degrees')
    leftover = re.search(r'leaves out the last sector, (\w+)\. The sectors fill the whole circle', prompt)
    if leftover:
        require(cells.get(leftover[1], 'x') is None, 'Left-out sector must have a blank cell')
        cells[leftover[1]] = whole - sum(v for v in cells.values() if v is not None)
        require(cells[leftover[1]] > 0, 'Left-out sector must be positive')
    else:
        require(None not in cells.values() and sum(cells.values()) == whole, 'Sectors must add to the whole')
    share = {k: v / whole for k, v in cells.items()}
    unit = Fraction(1)

    def sector(name):
        require(name in share, f'Unknown sector {name}')
        return share[name]

    percent = re.search(r'What percent of the circle is the sector for (\w+)\?$', prompt)
    angle = re.search(r'What is the central angle of the sector for (\w+)\?$', prompt)
    many = re.search(r'How many \w+ are in the sector for (\w+)\?$', prompt)
    more = re.search(r'How many more \w+ are in the sector for (\w+) than in the sector for (\w+)\?$', prompt)
    if percent:
        value, suffix = sector(percent[1]) * 100, '%'
    elif angle:
        value, suffix = sector(angle[1]) * 360, '°'
    elif many or more:
        require(stated_count is not None, 'Counting a sector needs a stated total')
        if many:
            value = sector(many[1]) * stated_count
        else:
            value = (sector(more[1]) - sector(more[2])) * stated_count
            require(value > 0, 'More-than difference must be positive')
        require(value.denominator == 1, 'Sector counts must be whole numbers')
        suffix = ''
    else:
        raise ValueError('Unknown circle-graph question')
    if column == 'Number':
        require(all(v.denominator == 1 for v in cells.values()), 'Counts must be whole numbers')
    labels = [o['label'] for o in options]
    require(all(re.fullmatch(r'\d+(?:\.\d+)?' + re.escape(suffix), x) for x in labels), 'Choices must share the asked unit')
    numbers = [Fraction(x[: len(x) - len(suffix)]) for x in labels]
    require(len(set(numbers)) == 4, 'Mathematically duplicate choices')
    return only_correct(options, [n == value for n in numbers], 'circle graph')


# --------------------------------------------------------------- display choice
KINDS = {
    'scatter': 'Scatterplot', 'circle': 'Circle graph', 'line': 'Line graph', 'bar': 'Bar graph',
    'histogram': 'Histogram', 'dot': 'Dot plot or stem-and-leaf plot',
}


def classify_scenario(prompt):
    text = prompt.lower()
    if re.search(r'relates to|goes with|whether colder|pay more|whether more', text):
        return 'scatter'
    if re.search(r'what part|share|as a part|divides into parts|how the day divides', text):
        return 'circle'
    if re.search(r'rose or fell|changed|changes from|over those years|every hour', text):
        return 'line'
    if re.search(r'compare|which subject has the most', text):
        return 'bar'
    if re.search(r'intervals|how many fall|how many waited', text):
        return 'histogram'
    if re.search(r'each score|every swimmer|exact time|each day|each count|each plant|every day|middle one|most common', text):
        return 'dot'
    raise ValueError('Scenario outside the reviewer classification')


def solve_display(public):
    prompt = public['prompt']
    options = options_of(public)
    kind = classify_scenario(prompt)
    labels = [o['label'] for o in options]
    require(len(set(labels)) == 4 and set(labels) <= set(KINDS.values()), 'Unknown display choices')
    # Pairs that would both be defensible for the same scenario must never be offered together.
    clash = {'circle': 'Bar graph', 'bar': 'Circle graph', 'line': 'Scatterplot', 'scatter': 'Line graph'}
    require(clash.get(kind) not in labels, f'{clash.get(kind)} is also defensible for this scenario')
    require(KINDS[kind].split()[0].lower() not in prompt.lower().replace('line graph', '') or kind == 'dot', 'Prompt names the display')
    return only_correct(options, [label == KINDS[kind] for label in labels], 'display')


# ----------------------------------------------------------------- return claims
def money(text):
    return Fraction(text)


def solve_return(public):
    prompt = plain(public['prompt'])
    options = options_of(public)
    labels = [o['label'] for o in options]
    ad = re.fullmatch(
        r'An ad says: "Our fund returns (\d+)% per year\." A fund started with (\d+) dollars and had (\d+) dollars after (\d+) (months|years)\. '
        r'Use simple rates and no compounding\. Which statement is right\?', prompt)
    monthly = re.fullmatch(
        r'One account pays (\d+)% a month\. Another pays (\d+)% a year\. Compare the two by adding the same simple rate for each of (\d+) months\. '
        r'Which statement is right\?', prompt)
    two = re.fullmatch(
        r'Investment A grew from (\d+) dollars to (\d+) dollars in (\d+) years?\. Investment B grew from (\d+) dollars to (\d+) dollars in (\d+) years?\. '
        r'Use simple rates: total gain ÷ starting amount ÷ years\. Which investment earned the higher yearly rate of return\?', prompt)
    if ad:
        claim, start, end, span = (Fraction(ad[i]) for i in (1, 2, 3, 4))
        years = span / 12 if ad[5] == 'months' else span
        rate = (end - start) / start / years * 100
        verdict = 'accurate' if rate == claim else ('too high' if claim > rate else 'too low')
        parsed = [re.fullmatch(r'(\d+(?:\.\d+)?)% per year: the claim is (accurate|too high|too low)', x) for x in labels]
        require(all(parsed), 'Unreadable claim choices')
        require(len({(Fraction(m[1]), m[2]) for m in parsed}) == 4, 'Duplicate verdicts')
        return only_correct(options, [Fraction(m[1]) == rate and m[2] == verdict for m in parsed], 'claim verdict')
    if monthly:
        per_month, per_year, months = (int(monthly[i]) for i in (1, 2, 3))
        require(months == 12, 'A year has 12 months')
        converted = per_month * months
        verdict = 'higher' if converted > per_year else ('lower' if converted < per_year else 'equal')
        flags = []
        for label in labels:
            m = re.fullmatch(r'(\d+)% per month is (\d+)% per year, (higher|lower) than (\d+)% per year', label)
            if m:
                flags.append(int(m[1]) == per_month and int(m[2]) == converted and int(m[4]) == per_year and m[3] == verdict)
            else:
                wrong = re.fullmatch(r'(\d+)% per year is (higher|lower), since (\d+) is greater than (\d+)', label)
                require(wrong is not None, f'Unreadable choice {label!r}')
                # Comparing unlike units cannot be right even when its verdict happens to match.
                require(not (converted < per_year and wrong[2] == 'higher'), 'Unit-blind choice reaches the true conclusion')
                flags.append(False)
        require(verdict != 'equal', 'Equal yearly rates have no matching choice')
        return only_correct(options, flags, 'rate comparison')
    if two:
        (a0, a1, ay, b0, b1, by) = (Fraction(two[i]) for i in range(1, 7))
        ra, rb = (a1 - a0) / a0 / ay * 100, (b1 - b0) / b0 / by * 100
        winner = 'A' if ra > rb else ('B' if rb > ra else 'Equal')
        flags = []
        for label in labels:
            eq = re.fullmatch(r'Equal: both earned (\d+(?:\.\d+)?)% per year', label)
            win = re.fullmatch(r'([AB]): (\d+(?:\.\d+)?)% per year, higher than (\d+(?:\.\d+)?)% per year', label)
            other = re.fullmatch(r'([AB]): (?:gained \d+ dollars, more than \d+ dollars|started with \d+ dollars, more than \d+ dollars|total return \d+(?:\.\d+)?%, more than \d+(?:\.\d+)?%)', label)
            if eq:
                flags.append(winner == 'Equal' and Fraction(eq[1]) == ra)
            elif win:
                high, low = max(ra, rb), min(ra, rb)
                flags.append(winner == win[1] and Fraction(win[2]) == high and Fraction(win[3]) == low)
            else:
                require(other is not None, f'Unreadable choice {label!r}')
                # Naming the true winner with a wrong measure would make a second defensible answer.
                require(other[1] != winner, 'Fallacy choice names the true winner')
                flags.append(False)
        return only_correct(options, flags, 'investment comparison')
    raise ValueError('Unknown return-claim prompt')


def solve(public):
    template = public['templateId']
    require(template in SUPPORTED, 'Unexpected data-display state family')
    return {
        'stem-leaf-construct': solve_stem_leaf,
        'frequency-table-build': solve_frequency,
        'circle-graph-read': solve_circle,
        'best-display-choice': solve_display,
        'return-claim-check': solve_return,
    }[template](public)


def review_problem(problem):
    result = solve(problem['public'])
    require(result == problem['answer'], 'Data-display state answer key mismatch')
    return result


def self_test():
    def public(template, prompt, labels, figure=None):
        value = {
            'templateId': template, 'prompt': prompt,
            'response': {'kind': 'choice', 'options': [{'id': f'o{i}', 'label': x} for i, x in enumerate(labels)]},
        }
        if figure:
            value['figure'] = figure
        return value

    def table(columns, rows):
        return {'kind': 'scene', 'scene': {'v': 1, 'elements': [{
            'id': 'plot', 'type': 'table', 'columns': columns, 'corner': 'x',
            'rows': [{'label': k, 'cells': [v]} for k, v in rows]}]}}

    stem_prompt = ('These 6 values are the floors in the buildings on a city block: 16, 33, 35, 45, 33, 49. '
                   'Which stem-and-leaf plot shows these data? Use the tens digit as the stem and the ones digit as the leaf. '
                   'For example, $1\\mid 0$ means $10$ floors.')
    cases = [
        (public('stem-leaf-construct', stem_prompt, [
            '1 | 6; 2 |; 3 | 3 3 5; 4 | 5 9', '1 | 6; 3 | 3 3 5; 4 | 5 9',
            '1 | 6; 2 |; 3 | 5 3 3; 4 | 5 9', '1 | 6; 2 |; 3 | 3 3 5; 4 | 5 9 9']), 'o0'),
        (public('stem-leaf-construct',
                'This stem-and-leaf plot shows these 4 values, the lengths of pencils, in centimeters: 2.0, 2.6, 3.1, 3.4. Which key matches the plot?',
                ['$2\\mid 0$ means $20$ cm', '$2\\mid 0$ means $0.2$ cm', '$2\\mid 0$ means $2.0$ cm', '$2\\mid 0$ means $0.5$ cm'],
                table(['Leaf'], [('2', '0 6'), ('3', '1 4')])), 'o2'),
        (public('frequency-table-build',
                'These are data about the goals in each game, for 5 games: 0, 2, 2, 5, 5. Which frequency table matches the data? The table has one row for each whole number from 0 to 5. Each choice is written as value: frequency.',
                ['0: 1, 1: 0, 2: 2, 3: 0, 4: 0, 5: 2', '0: 1, 2: 2, 5: 2', '0: 1, 1: 0, 2: 2, 3: 0, 4: 0, 5: 1',
                 '0: 1, 1: 1, 2: 2, 3: 0, 4: 0, 5: 2']), 'o0'),
        (public('frequency-table-build',
                'These are data about the points in each game, for 6 games: 1, 4, 5, 9, 10, 12. Which frequency table groups them into intervals? Each interval includes both of its end values.',
                ['0–4: 2, 5–9: 2, 10–14: 2', '0–4: 3, 5–9: 2, 10–14: 1', '0–4: 2, 5–9: 3, 10–14: 1', '1–5: 3, 6–10: 2, 11–15: 1']), 'o0'),
        (public('circle-graph-read',
                "A circle graph shows the favorite sport of 200 people. The table lists the graph's sectors, one row for each. What percent of the circle is the sector for Running?",
                ['20%', '80%', '40%', '5%'], table(['Number'], [('Soccer', 100), ('Running', 40), ('Other', 60)])), 'o0'),
        (public('circle-graph-read',
                "A circle graph shows the favorite pet of families. The table lists the graph's sectors, one row for each. The table leaves out the last sector, Other. The sectors fill the whole circle, which is 360°. What is the central angle of the sector for Other?",
                ['108°', '72°', '90°', '252°'], table(['Angle'], [('Dog', 180), ('Cat', 72), ('Other', None)])), 'o0'),
        (public('best-display-choice',
                'A store records its monthly sales for one year. You want to show whether sales rose or fell through the year. Which display fits best?',
                ['Line graph', 'Circle graph', 'Histogram', 'Dot plot or stem-and-leaf plot']), 'o0'),
        (public('best-display-choice',
                'A class counts its pets: 9 dogs, 6 cats. You want to compare how many pets there are of each kind. Which display fits best?',
                ['Bar graph', 'Scatterplot', 'Histogram', 'Dot plot or stem-and-leaf plot']), 'o0'),
        (public('return-claim-check',
                'An ad says: "Our fund returns 10% per year." A fund started with 6000 dollars and had 6300 dollars after 6 months. Use simple rates and no compounding. Which statement is right?',
                ['10% per year: the claim is accurate', '5% per year: the claim is too high', '10% per year: the claim is too high', '30% per year: the claim is too low']), 'o0'),
        (public('return-claim-check',
                'One account pays 1% a month. Another pays 9% a year. Compare the two by adding the same simple rate for each of 12 months. Which statement is right?',
                ['1% per month is 12% per year, higher than 9% per year', '9% per year is higher, since 9 is greater than 1',
                 '1% per month is 13% per year, higher than 9% per year', '1% per month is 12% per year, lower than 9% per year']), 'o0'),
        (public('return-claim-check',
                'Investment A grew from 100 dollars to 110 dollars in 1 year. Investment B grew from 500 dollars to 625 dollars in 5 years. Use simple rates: total gain ÷ starting amount ÷ years. Which investment earned the higher yearly rate of return?',
                ['A: 10% per year, higher than 5% per year', 'Equal: both earned 5% per year', 'B: gained 125 dollars, more than 10 dollars', 'B: total return 25%, more than 10%']), 'o0'),
    ]
    for item, answer in cases:
        item['templateId']
    rejected = 0

    def reject(problem):
        nonlocal rejected
        try:
            review_problem(problem)
        except ValueError:
            rejected += 1
            return
        raise ValueError('Corrupt data-display state problem was accepted')

    for item, answer in cases:
        problem = {'public': item, 'answer': answer}
        review_problem(problem)
        bad = copy.deepcopy(problem)
        bad['answer'] = 'o1'
        reject(bad)
        bad = copy.deepcopy(problem)
        bad['public']['response']['options'][1]['label'] = bad['public']['response']['options'][0]['label']
        reject(bad)
    # Specific corruptions: a missing empty stem, a wrong displayed plot, a hidden unit-blind win and an unsorted row.
    bad = copy.deepcopy(cases[0][0])
    bad['response']['options'][1]['label'] = bad['response']['options'][0]['label'].replace('2 |; ', '')
    bad['response']['options'][0]['label'] = bad['response']['options'][2]['label']
    reject({'public': bad, 'answer': 'o1'})
    bad = copy.deepcopy(cases[1][0])
    bad['figure']['scene']['elements'][0]['rows'][0]['cells'][0] = '0 7'
    reject({'public': bad, 'answer': 'o2'})
    bad = copy.deepcopy(cases[1][0])
    bad['response']['options'][0]['label'] = '$2\\mid 0$ means $2$ cm'
    reject({'public': bad, 'answer': 'o2'})
    bad = copy.deepcopy(cases[4][0])
    bad['prompt'] = bad['prompt'].replace('200', '250')
    reject({'public': bad, 'answer': 'o0'})
    bad = copy.deepcopy(cases[6][0])
    bad['response']['options'][1]['label'] = 'Scatterplot'
    bad['prompt'] = 'A store reports its yearly sales for 12 stores. Which display fits best?'
    reject({'public': bad, 'answer': 'o0'})
    bad = copy.deepcopy(cases[6][0])
    bad['response']['options'][1]['label'] = 'Scatterplot'
    reject({'public': bad, 'answer': 'o0'})
    bad = copy.deepcopy(cases[7][0])
    bad['response']['options'][1]['label'] = 'Circle graph'
    reject({'public': bad, 'answer': 'o0'})
    bad = copy.deepcopy(cases[10][0])
    bad['response']['options'][2]['label'] = 'A: gained 10 dollars, more than 125 dollars'
    reject({'public': bad, 'answer': 'o0'})
    return {'fixtures': len(cases), 'rejectedMutations': rejected}


if __name__ == '__main__':
    print(self_test())
