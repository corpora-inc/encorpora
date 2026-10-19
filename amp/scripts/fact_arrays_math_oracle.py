"""Independent one-digit multiplication and division checks from public prompts and figures; no generator imports."""
import re

FACT_ARRAYS = frozenset({
    'multiply-facts', 'divide-facts', 'missing-factor-fact', 'share-or-group',
    'times-table-pattern',
})


def require(condition, message):
    if not condition:
        raise ValueError(message)


def times(groups, size):
    """Repeated addition: `groups` groups of `size`."""
    total = 0
    for _ in range(groups):
        total += size
    return total


def unknown_factor(known, total):
    """The one whole number x in 0..10 with known groups of x making total."""
    found = [x for x in range(11) if times(known, x) == total]
    require(len(found) == 1, f'No single whole factor: {known} × ? = {total}')
    return found[0]


def edges(figure, rows, columns):
    require(figure == {'kind': 'dot-array', 'show': 'edges', 'rows': rows, 'columns': columns}, 'Covered array disagrees with the prompt')


def covered(figure, show, known, total):
    key = 'rows' if show == 'first-column' else 'columns'
    require(figure == {'kind': 'dot-array', 'show': show, key: known, 'total': total}, f'{show} array disagrees with the prompt')
    require('columns' not in figure if show == 'first-column' else 'rows' not in figure, 'Figure leaks the unknown side')


ROW_STORY = re.compile(r'A (?:hall|garden|baker|wall) (?:has|fills) (\d+) rows (?:of chairs|of bean plants|on a tray|of tiles), with (\d+) (chairs|plants|rolls|tiles) in each row\. How many [a-z ]+ (?:are|is) (?:in|on) the [a-z]+\?')


def solve_multiply(prompt, figure):
    m = re.fullmatch(r'What is (\d+) × (\d+)\?', prompt)
    if m:
        a, b = int(m[1]), int(m[2])
        edges(figure, a, b)
        return times(a, b), 'equation'
    if prompt == 'A card covers part of this array of dots. How many dots are in the whole array?':
        require(figure['kind'] == 'dot-array' and figure['show'] == 'edges', 'Card frame needs a covered array')
        # Read the visible top row and left column off the figure.
        return times(figure['rows'], figure['columns']), 'card'
    m = re.fullmatch(r'The array shows (\d+) rows of (\d+) dots\. Use it to find (\d+) × (\d+)\.', prompt)
    if m:
        a, b, c, d = map(int, m.groups())
        require((c, d) == (b, a) and a != b, 'Turned fact must swap the factors')
        edges(figure, a, b)
        return times(c, d), 'turn'
    m = ROW_STORY.fullmatch(prompt)
    require(m is not None, f'Unexpected multiplication prompt {prompt!r}')
    a, b = int(m[1]), int(m[2])
    edges(figure, a, b)
    return times(a, b), 'story'


def solve_divide(prompt, figure):
    m = re.fullmatch(r'What is (\d+) ÷ (\d+)\?', prompt) or \
        re.fullmatch(r'This array has (\d+) dots in (\d+) equal rows\. How many dots are in each row\?', prompt) or \
        re.fullmatch(r'A teacher sets out (\d+) chairs in (\d+) equal rows\. How many chairs are in each row\?', prompt)
    if m:
        n, d = int(m[1]), int(m[2])
        covered(figure, 'first-column', d, n)
        return unknown_factor(d, n), 'equation' if prompt.startswith('What') else 'share'
    m = re.fullmatch(r'(\d+) × (\d+) = (\d+)\. Use this fact to find (\d+) ÷ (\d+)\.', prompt)
    if m:
        a, b, n, n2, q = map(int, m.groups())
        require(times(a, b) == n and n2 == n and q == b, 'Given fact is false or unrelated')
        covered(figure, 'first-row', q, n)
        return unknown_factor(q, n), 'fact-family'
    m = re.fullmatch(r'(\d+) chairs are set out in rows of (\d+)\. How many rows are there\?', prompt)
    require(m is not None, f'Unexpected division prompt {prompt!r}')
    n, q = int(m[1]), int(m[2])
    covered(figure, 'first-row', q, n)
    return unknown_factor(q, n), 'measure'


def solve_missing(prompt, figure):
    m = re.fullmatch(r'(\d+) × □ = (\d+)\. What number belongs in the box\?', prompt)
    if m:
        a, n = int(m[1]), int(m[2])
        covered(figure, 'first-column', a, n)
        return unknown_factor(a, n), 'second'
    m = re.fullmatch(r'(\d+) = (\d+) × □\. What number belongs in the box\?', prompt)
    if m:
        n, a = int(m[1]), int(m[2])
        covered(figure, 'first-column', a, n)
        return unknown_factor(a, n), 'reversed'
    m = re.fullmatch(r'□ × (\d+) = (\d+)\. What number belongs in the box\?', prompt)
    if m:
        b, n = int(m[1]), int(m[2])
        covered(figure, 'first-row', b, n)
        return unknown_factor(b, n), 'first'
    m = re.fullmatch(r'(\d+) ÷ □ = (\d+)\. What number belongs in the box\?', prompt)
    require(m is not None, f'Unexpected missing-factor prompt {prompt!r}')
    n, q = int(m[1]), int(m[2])
    covered(figure, 'first-row', q, n)
    # n ÷ x = q exactly when x groups of q make n.
    found = [x for x in range(1, 11) if times(x, q) == n]
    require(len(found) == 1, 'Divisor is not unique')
    return found[0], 'divisor'


SHARE = [
    r'Share (\d+) counters equally among (\d+) groups\. How many counters are in each group\?',
    r'(\d+) stickers are shared equally by (\d+) friends\. How many stickers does each friend get\?',
    r'(\d+) grapes are shared equally on (\d+) plates\. How many grapes are on each plate\?',
    r'A teacher puts (\d+) books on (\d+) shelves, the same number on each shelf\. How many books are on each shelf\?',
]
MEASURE = [
    r'Put (\d+) counters into groups of (\d+)\. How many groups can you make\?',
    r'(\d+) eggs are packed (\d+) to a box\. How many boxes are filled\?',
    r'A coach puts (\d+) players into teams of (\d+)\. How many teams are there\?',
    r'(\d+) apples are put in bags of (\d+)\. How many bags are filled\?',
]


def solve_share(prompt, figure):
    for mode, patterns in (('share', SHARE), ('measure', MEASURE)):
        for i, pattern in enumerate(patterns):
            m = re.fullmatch(pattern, prompt)
            if not m:
                continue
            n, k = int(m[1]), int(m[2])
            require(figure == {'kind': 'share-model', 'mode': mode, 'total': n, 'count': k}, 'Counters disagree with the story')
            if mode == 'share':
                # Deal one counter to each group per round.
                left, rounds = n, 0
                while left >= k:
                    left -= k
                    rounds += 1
                require(left == 0, 'Sharing leaves counters over')
                return rounds, 'share-' + ('counters' if i == 0 else 'story')
            groups, left = 0, n
            while left > 0:
                left -= k
                groups += 1
            require(left == 0, 'Groups do not fill exactly')
            return groups, 'measure-' + ('counters' if i == 0 else 'story')
    raise ValueError(f'Unexpected sharing prompt {prompt!r}')


def solve_table(prompt, figure):
    require(figure['kind'] == 'times-table', 'Pattern needs a table window')
    rows, columns = figure['rows'], figure['columns']
    i, j = figure['ask']
    blank = {tuple(cell) for cell in figure['blank']}
    R, C = rows[i], columns[j]
    if prompt == 'This part of a multiplication table has one empty cell. What product belongs in it?':
        require(not blank and len(rows) == 3 and len(columns) == 4, 'Window shape')
        require(rows == list(range(rows[0], rows[0] + 3)) and columns == list(range(columns[0], columns[0] + 4)), 'Window is not consecutive')
        return times(R, C), 'window'
    m = re.fullmatch(r'In the row for (\d+) in a multiplication table, each product is (\d+) more than the one before it\. (\d+) × (\d+) = (\d+)\. What is (\d+) × (\d+)\?', prompt)
    if m:
        r1, step, r2, c_prev, given, r3, c = map(int, m.groups())
        require(r1 == step == r2 == r3 == R and c == C and c_prev == C - 1, 'Row pattern mismatch')
        require(times(r1, c_prev) == given, 'Given product is false')
        require(rows == [R] and columns[-1] == C and j == len(columns) - 1, 'Asked cell is not the next in the row')
        return given + step, 'next'
    m = re.fullmatch(r'Each product in the row for (\d+) is double the product above it, in the row for (\d+)\. What product belongs in the cell with the question mark\?', prompt)
    if m:
        big, small = int(m[1]), int(m[2])
        require(rows == [small, big] and big == small + small and i == 1, 'Doubling rows mismatch')
        require(blank == {(1, k) for k in range(len(columns)) if k != j}, 'Doubled row must be hidden')
        above = times(small, C)
        return above + above, 'double'
    m = re.fullmatch(r'Each product in the row for (\d+) is the sum of the two products above it\. What product belongs in the cell with the question mark\?', prompt)
    require(m is not None, f'Unexpected pattern prompt {prompt!r}')
    s = int(m[1])
    require(len(rows) == 3 and rows[2] == s == rows[0] + rows[1] and i == 2, 'Sum rows mismatch')
    require(blank == {(2, k) for k in range(len(columns)) if k != j}, 'Sum row must be hidden')
    return times(rows[0], C) + times(rows[1], C), 'sum'


def solve_fact_arrays(public, tagged=False):
    name, prompt, figure = public['templateId'], public['prompt'], public.get('figure')
    require(figure is not None, 'Every fact item carries a figure')
    solver = {
        'multiply-facts': solve_multiply, 'divide-facts': solve_divide,
        'missing-factor-fact': solve_missing, 'share-or-group': solve_share,
        'times-table-pattern': solve_table,
    }.get(name)
    require(solver is not None, f'No fact-array solver for {name}')
    value, tag = solver(prompt, figure)
    return (value, tag) if tagged else value


def review_fact_arrays_fixtures():
    fig = {'kind': 'dot-array', 'show': 'first-row', 'columns': 6, 'total': 42}
    require(solve_fact_arrays({'templateId': 'missing-factor-fact', 'prompt': '42 ÷ □ = 6. What number belongs in the box?', 'figure': fig}) == 7, 'Divisor fixture')
    table = {'kind': 'times-table', 'rows': [3, 6], 'columns': [5, 6, 7, 8], 'ask': [1, 2], 'blank': [[1, 0], [1, 1], [1, 3]]}
    require(solve_fact_arrays({'templateId': 'times-table-pattern', 'prompt': 'Each product in the row for 6 is double the product above it, in the row for 3. What product belongs in the cell with the question mark?', 'figure': table}) == 42, 'Doubling fixture')
    leak = {'kind': 'dot-array', 'show': 'first-column', 'rows': 7, 'columns': 8, 'total': 56}
    try:
        solve_fact_arrays({'templateId': 'divide-facts', 'prompt': 'What is 56 ÷ 7?', 'figure': leak})
    except ValueError:
        return
    raise ValueError('Accepted a figure that leaks the quotient')


class FactArraysCorpus:
    """Each family must reach every frame and the hardest facts."""

    def __init__(self):
        self.seen = {}

    def record(self, public, _solved):
        value, tag = solve_fact_arrays(public, tagged=True)
        tags = self.seen.setdefault(public['templateId'], set())
        tags.add(tag)
        figure = public['figure']
        if figure['kind'] == 'dot-array':
            sides = [figure.get('rows'), figure.get('columns'), value if public['templateId'] != 'multiply-facts' else None]
            if sum(1 for x in sides if x in (6, 7, 8)) >= 2:
                tags.add('hard-fact')

    def finish(self):
        required = {
            'multiply-facts': {'equation', 'card', 'turn', 'story', 'hard-fact'},
            'divide-facts': {'equation', 'share', 'fact-family', 'measure', 'hard-fact'},
            'missing-factor-fact': {'first', 'second', 'reversed', 'divisor', 'hard-fact'},
            'share-or-group': {'share-counters', 'share-story', 'measure-counters', 'measure-story'},
            'times-table-pattern': {'window', 'next', 'double', 'sum'},
        }
        for name, tags in required.items():
            missing = tags - self.seen.get(name, set())
            require(not missing, f'{name} never reaches {sorted(missing)}')
        return {name: len(tags) for name, tags in sorted(self.seen.items())}
