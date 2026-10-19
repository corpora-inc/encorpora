"""Independent K–2 part-whole, equality and two-step checks from public prompts and figures; no generator imports."""
import re

EARLY_OPERATIONS = frozenset({
    'number-bond-missing', 'unknown-addend-story', 'balanced-addition',
    'three-addend-story', 'two-step-change',
})


def require(condition, message):
    if not condition:
        raise ValueError(message)


def count_up(start, target):
    """Count on by ones from start until target; the number of counts."""
    require(start <= target, 'Cannot count up to a smaller number')
    steps = 0
    while start + steps < target:
        steps += 1
    return steps


def missing_part(whole, part):
    return count_up(part, whole)


BOND_STORY = re.compile(r'(\d+) (apples|birds|ducks) (?:are in a bowl|sit on a fence|are at the pond)\. (\d+) (?:is|are) (red|big|in the water) and the rest are (green|small|on the grass)\. How many are (green|small|on the grass)\?')


def solve_bond(prompt, figure):
    require(figure['kind'] == 'number-bond', 'Number bond needs its figure')
    whole, parts = figure['whole'], figure['parts']
    m = re.fullmatch(r'(\d+) = (\d+) \+ □\. What number belongs in the box\?', prompt)
    if m:
        w, p = int(m[1]), int(m[2])
        require((whole, parts) == (w, [p, None]), 'Bond disagrees with the equation')
        return missing_part(w, p), 'equation'
    m = re.fullmatch(r'□ \+ (\d+) = (\d+)\. What number belongs in the box\?', prompt)
    if m:
        p, w = int(m[1]), int(m[2])
        require((whole, parts) == (w, [None, p]), 'Bond disagrees with the equation')
        return missing_part(w, p), 'box-first'
    if prompt == 'What number is missing from the number bond?':
        known = [p for p in parts if p is not None]
        require(whole is not None and len(known) == 1, 'Bond must hide one part')
        return missing_part(whole, known[0]), 'bond'
    m = BOND_STORY.fullmatch(prompt)
    require(m is not None and m[5] == m[6], f'Unexpected number-bond prompt {prompt!r}')
    w, p = int(m[1]), int(m[3])
    require((whole, parts) == (w, [p, None]), 'Bond disagrees with the story')
    require(w <= 10, 'Bond whole exceeds ten')
    return missing_part(w, p), 'story'


def solve_addend(prompt, figure):
    require(figure['kind'] == 'bar-model', 'Missing addend needs a bar model')
    m = re.fullmatch(r'There (?:was|were) (\d+) blocks?\. More blocks were added\. There are (\d+) now\. How many were added\?', prompt) or \
        re.fullmatch(r'(\d+) \+ □ = (\d+)\. What number belongs in the box\?', prompt) or \
        re.fullmatch(r'Mia has (\d+) shells?\. How many more shells does she need to have (\d+)\?', prompt)
    if m:
        start, total = int(m[1]), int(m[2])
        require(figure == {'kind': 'bar-model', 'whole': total, 'parts': [start, None]}, 'Bar disagrees with the story')
        tag = 'story' if prompt.startswith('There') else 'equation' if '□' in prompt else 'how-many-more'
    else:
        m = re.fullmatch(r'□ \+ (\d+) = (\d+)\. What number belongs in the box\?', prompt)
        require(m is not None, f'Unexpected missing-addend prompt {prompt!r}')
        start, total = int(m[1]), int(m[2])
        require(figure == {'kind': 'bar-model', 'whole': total, 'parts': [None, start]}, 'Bar disagrees with the equation')
        tag = 'box-first'
    require(total <= 20, 'Missing addend beyond twenty')
    return count_up(start, total), tag


def side(values):
    return sum(v for v in values if v is not None)


def solve_balance(prompt, figure):
    require(figure['kind'] == 'equal-balance', 'Equality needs a balance')
    m = re.fullmatch(r'□ = (\d+) \+ (\d+)\. What number belongs in the box\?', prompt)
    if m:
        a, b = int(m[1]), int(m[2])
        require(figure['left'] == [None] and figure['right'] == [a, b], 'Balance disagrees')
        return a + b, 'box-alone'
    m = re.fullmatch(r'(\d+) \+ (\d+) = (□ \+ (\d+)|(\d+) \+ □)\. What number makes both sides equal\?', prompt)
    if m:
        a, b = int(m[1]), int(m[2])
        c = int(m[4] or m[5])
        boxed = [None, c] if m[4] else [c, None]
        require(figure['left'] == [a, b] and figure['right'] == boxed, 'Balance disagrees')
        tag = 'box-right'
    else:
        m = re.fullmatch(r'□ \+ (\d+) = (\d+) \+ (\d+)\. What number makes both sides equal\?', prompt)
        require(m is not None, f'Unexpected equality prompt {prompt!r}')
        c, a, b = int(m[1]), int(m[2]), int(m[3])
        require(figure['left'] == [None, c] and figure['right'] == [a, b], 'Balance disagrees')
        tag = 'box-left'
    # The box holds what the counted side has beyond c.
    return count_up(c, a + b), tag


THREE = [
    r'A box holds (\d+) red blocks?, (\d+) blue blocks?, and (\d+) green blocks?\. How many blocks\?',
    r'Sam read (\d+) pages? on Monday, (\d+) pages? on Tuesday and (\d+) pages? on Wednesday\. How many pages did he read\?',
    r'A team scored (\d+) points?, then (\d+) points?, then (\d+) points?\. How many points did the team score\?',
    r'What is (\d+) \+ (\d+) \+ (\d+)\?',
]


def solve_three(prompt, figure):
    for i, pattern in enumerate(THREE):
        m = re.fullmatch(pattern, prompt)
        if m:
            addends = [int(x) for x in m.groups()]
            require(figure == {'kind': 'addend-groups', 'addends': addends}, 'Groups disagree with the addends')
            total = 0
            for n in addends:
                total += n
            require(total <= 20, 'Three addends exceed twenty')
            pair = any(addends[x] + addends[y] == 10 for x in range(3) for y in range(x + 1, 3))
            return total, ('equation' if i == 3 else 'story') + ('-ten' if pair else '')
    raise ValueError(f'Unexpected three-addend prompt {prompt!r}')


def chain(figure, start, ops, end):
    require(figure == {'kind': 'change-chain', 'start': start, 'steps': [{'op': o, 'value': v} for o, v in ops], 'end': end}, 'Chain disagrees with the story')


def apply(n, op, v):
    return n + v if op == '+' else n - v


def solve_two_step(prompt, figure):
    m = re.fullmatch(r'There are (\d+) books\. Add (\d+) books, then take away (\d+)\. How many books remain\?', prompt)
    if m:
        s, a, t = map(int, m.groups())
        chain(figure, s, [('+', a), ('−', t)], None)
        mid = apply(s, '+', a)
        require(mid <= 100 and t <= mid, 'Story outside one hundred')
        return apply(mid, '−', t), 'add-remove'
    m = re.fullmatch(r'A bus has (\d+) people\. At a stop, (\d+) gets? off and then (\d+) gets? on\. How many people are on the bus now\?', prompt)
    if m:
        s, off, on = map(int, m.groups())
        chain(figure, s, [('−', off), ('+', on)], None)
        require(off < s, 'More got off than were on')
        end = apply(apply(s, '−', off), '+', on)
        require(end <= 100, 'Story outside one hundred')
        return end, 'remove-add'
    m = re.fullmatch(r'There were (\d+) birds in a tree\. (\d+) more came\. Then some flew away, and now there (?:is|are) (\d+)\. How many flew away\?', prompt)
    if m:
        s, came, end = map(int, m.groups())
        chain(figure, s, [('+', came), ('−', None)], end)
        # Search the one change that lands on the end.
        found = [g for g in range(1, 101) if apply(apply(s, '+', came), '−', g) == end]
        require(len(found) == 1, 'No single change')
        return found[0], 'change-unknown'
    m = re.fullmatch(r'Some marbles were in a bag\. (\d+) were put in, then (\d+) (?:was|were) taken out\. Now there are (\d+)\. How many marbles were in the bag at first\?', prompt)
    require(m is not None, f'Unexpected two-step prompt {prompt!r}')
    a, t, end = map(int, m.groups())
    chain(figure, None, [('+', a), ('−', t)], end)
    found = [s for s in range(0, 101) if apply(apply(s, '+', a), '−', t) == end and s + a >= t]
    require(len(found) == 1, 'No single start')
    return found[0], 'start-unknown'


def solve_early_operations(public, tagged=False):
    name, prompt, figure = public['templateId'], public['prompt'], public.get('figure')
    require(figure is not None, 'Every item carries a figure')
    solver = {
        'number-bond-missing': solve_bond, 'unknown-addend-story': solve_addend,
        'balanced-addition': solve_balance, 'three-addend-story': solve_three,
        'two-step-change': solve_two_step,
    }.get(name)
    require(solver is not None, f'No early-operations solver for {name}')
    value, tag = solver(prompt, figure)
    return (value, tag) if tagged else value


def review_early_operations_fixtures():
    bond = {'kind': 'number-bond', 'whole': 9, 'parts': [4, None]}
    require(solve_early_operations({'templateId': 'number-bond-missing', 'prompt': '9 = 4 + □. What number belongs in the box?', 'figure': bond}) == 5, 'Bond fixture')
    scale = {'kind': 'equal-balance', 'left': [None, 8], 'right': [5, 7]}
    require(solve_early_operations({'templateId': 'balanced-addition', 'prompt': '□ + 8 = 5 + 7. What number makes both sides equal?', 'figure': scale}) == 4, 'Balance fixture')
    leak = {'kind': 'equal-balance', 'left': [5, 7], 'right': [4, 8]}
    try:
        solve_early_operations({'templateId': 'balanced-addition', 'prompt': '5 + 7 = □ + 8. What number makes both sides equal?', 'figure': leak})
    except ValueError:
        return
    raise ValueError('Accepted a balance that shows the answer')


class EarlyOperationsCorpus:
    """Each family must reach every frame and its hard cases."""

    def __init__(self):
        self.seen = {}

    def record(self, public, _solved):
        value, tag = solve_early_operations(public, tagged=True)
        tags = self.seen.setdefault(public['templateId'], set())
        tags.add(tag)
        name = public['templateId']
        if name == 'number-bond-missing' and value == 0:
            tags.add('zero-part')
        if name == 'three-addend-story':
            tags.add('ten-pair' if tag.endswith('-ten') else 'no-ten-pair')
        if name == 'unknown-addend-story' and public['figure']['whole'] > 10 and value >= 2:
            tags.add('teen-whole')

    def finish(self):
        required = {
            'number-bond-missing': {'equation', 'box-first', 'bond', 'story', 'zero-part'},
            'unknown-addend-story': {'story', 'equation', 'how-many-more', 'box-first', 'teen-whole'},
            'balanced-addition': {'box-alone', 'box-right', 'box-left'},
            'three-addend-story': {'ten-pair', 'no-ten-pair'},
            'two-step-change': {'add-remove', 'remove-add', 'change-unknown', 'start-unknown'},
        }
        for name, tags in required.items():
            missing = tags - self.seen.get(name, set())
            require(not missing, f'{name} never reaches {sorted(missing)}')
        return {name: len(tags) for name, tags in sorted(self.seen.items())}
