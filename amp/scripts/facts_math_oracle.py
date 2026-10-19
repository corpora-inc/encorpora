"""Independent fact, counting and mental place-value checks from public givens; no generator imports."""
import re

FACTS = frozenset({
    'facts-to-five', 'count-on-back', 'counted-steps', 'make-ten-fact',
    'related-subtraction', 'mental-ten-hundred',
})


def require(condition, message):
    if not condition:
        raise ValueError(message)


def apply(a, sign, b):
    require(sign in '+−', f'Unknown operation {sign!r}')
    return a + b if sign == '+' else a - b


def solve_facts(public):
    name, prompt, figure = public['templateId'], public['prompt'], public.get('figure')
    if name == 'facts-to-five':
        m = re.fullmatch(r'What is (\d) ([+−]) (\d)\?', prompt)
        require(m is not None, f'Unexpected fact prompt {prompt!r}')
        a, b = int(m[1]), int(m[3])
        value = apply(a, m[2], b)
        require(max(a, b) <= 5 and 0 <= value <= 5, 'Fact leaves zero to five')
        require(figure is None, 'Unexpected figure')
        return value
    if name == 'count-on-back':
        m = re.fullmatch(r'Start at (\d+)\. Count (on|back) (\d)\. What number do you land on\?', prompt)
        require(m is not None, f'Unexpected count prompt {prompt!r}')
        start, steps = int(m[1]), int(m[3])
        require(figure == {'kind': 'number-line', 'min': 0, 'max': 20, 'points': [start]}, 'Marked start disagrees')
        # Walk one tick at a time rather than adding.
        position = start
        for _ in range(steps):
            position += 1 if m[2] == 'on' else -1
        require(0 <= position <= 20 and 1 <= steps <= 4, 'Count leaves the line')
        return position
    if name == 'counted-steps':
        m = re.fullmatch(r'Count (on|back) from (\d+): ([\d, ]+)\. How many were (added to|subtracted from) (\d+)\?', prompt)
        require(m is not None and m[2] == m[5], f'Unexpected steps prompt {prompt!r}')
        require((m[1] == 'on') == (m[4] == 'added to'), 'Direction and operation disagree')
        start = int(m[2])
        said = [int(n) for n in m[3].split(', ')]
        step = 1 if m[1] == 'on' else -1
        require(said == [start + step * (i + 1) for i in range(len(said))], 'Count is not consecutive')
        require(all(0 <= n <= 20 for n in said), 'Count leaves zero to twenty')
        return len(said)
    if name == 'make-ten-fact':
        m = re.fullmatch(r'What is (\d) \+ (\d)\?', prompt)
        require(m is not None, f'Unexpected sum prompt {prompt!r}')
        a, b = int(m[1]), int(m[2])
        require(figure == {'kind': 'ten-frame-pair', 'first': a, 'second': b}, 'Frames disagree with the sum')
        require(11 <= a + b <= 18, 'Sum does not cross ten')
        return a + b
    if name == 'related-subtraction':
        m = re.fullmatch(r'What is (\d+) − (\d+)\?', prompt)
        require(m is not None, f'Unexpected difference prompt {prompt!r}')
        whole, part = int(m[1]), int(m[2])
        require(11 <= whole <= 20 and 1 <= part <= 9, 'Outside facts within twenty')
        # The missing addend: the number that joins part to make whole.
        return next(x for x in range(21) if part + x == whole)
    if name == 'mental-ten-hundred':
        m = re.fullmatch(r'What is (\d{3}) ([+−]) (10|100)\?', prompt)
        require(m is not None, f'Unexpected mental prompt {prompt!r}')
        n = int(m[1])
        require(100 <= n <= 900, 'Start outside 100 to 900')
        return apply(n, m[2], int(m[3]))
    raise ValueError(f'No facts solver for {name}')


def review_facts_fixtures():
    require(solve_facts({'templateId': 'related-subtraction', 'prompt': 'What is 15 − 8?'}) == 7, 'Related fact fixture')
    require(solve_facts({'templateId': 'mental-ten-hundred', 'prompt': 'What is 503 − 10?'}) == 493, 'Crossing fixture')
    require(solve_facts({'templateId': 'counted-steps', 'prompt': 'Count on from 9: 10, 11, 12. How many were added to 9?'}) == 3, 'Steps fixture')
    try:
        solve_facts({'templateId': 'counted-steps', 'prompt': 'Count on from 9: 10, 12. How many were added to 9?'})
    except ValueError:
        return
    raise ValueError('Accepted a skipped count')


class FactsCorpus:
    """Each family must reach its hard cases, not only easy ones."""

    def __init__(self):
        self.seen = {}

    def record(self, public, solved):
        name, prompt = public['templateId'], public['prompt']
        tags = self.seen.setdefault(name, set())
        n = [int(x) for x in re.findall(r'\d+', prompt)]
        if name == 'facts-to-five':
            tags.add('add' if '+' in prompt else 'subtract')
            if 0 in n[:2]:
                tags.add('zero')
        elif name == 'count-on-back':
            tags.add('on' if ' on ' in prompt else 'back')
            if (n[0] < 10) != (solved < 10):
                tags.add('cross-ten')
        elif name == 'counted-steps':
            tags.add('on' if 'added' in prompt else 'back')
        elif name == 'make-ten-fact':
            tags.add('first-smaller' if n[0] < n[1] else 'first-larger-or-equal')
            if n[0] == n[1]:
                tags.add('double')
        elif name == 'related-subtraction':
            tags.add('across-ten' if n[0] % 10 < n[1] else 'within-ones')
        elif name == 'mental-ten-hundred':
            tags.add(('up-' if '+' in prompt else 'down-') + str(n[1]))
            if n[1] == 10 and n[0] // 100 != solved // 100:
                tags.add('cross-hundred-' + ('up' if '+' in prompt else 'down'))

    def finish(self):
        required = {
            'facts-to-five': {'add', 'subtract', 'zero'},
            'count-on-back': {'on', 'back', 'cross-ten'},
            'counted-steps': {'on', 'back'},
            'make-ten-fact': {'first-smaller', 'first-larger-or-equal', 'double'},
            'related-subtraction': {'across-ten', 'within-ones'},
            'mental-ten-hundred': {'up-10', 'down-10', 'up-100', 'down-100', 'cross-hundred-up', 'cross-hundred-down'},
        }
        for name, tags in required.items():
            missing = tags - self.seen.get(name, set())
            require(not missing, f'{name} never reaches {sorted(missing)}')
        return {name: len(tags) for name, tags in sorted(self.seen.items())}
