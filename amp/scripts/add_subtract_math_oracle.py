"""Independent multidigit addition and subtraction checks from public prompts; no generator imports."""
import re

ADD_SUBTRACT = frozenset({
    'add-two-digit-regroup', 'make-hundred', 'subtract-two-digit-regroup',
    'add-three-digit', 'subtract-three-digit', 'add-multidigit', 'subtract-multidigit',
})


def require(condition, message):
    if not condition:
        raise ValueError(message)


def whole(text):
    require(re.fullmatch(r'\d{1,3}(,\d{3})*', text) is not None, f'Badly written number {text!r}')
    require(len(text) < 4 or ',' in text, f'Missing thousands separator in {text!r}')
    return int(text.replace(',', ''))


def operation(prompt):
    m = re.fullmatch(r'What is ([\d,]+) ([+−]) ([\d,]+)\?', prompt)
    require(m is not None, f'Unexpected prompt {prompt!r}')
    return whole(m[1]), m[2], whole(m[3])


def column_carries(a, b):
    """Places (0 = ones) where a column sum reaches ten, by digit strings."""
    sa, sb, carry, out = str(a)[::-1], str(b)[::-1], 0, set()
    for p in range(max(len(sa), len(sb))):
        total = (int(sa[p]) if p < len(sa) else 0) + (int(sb[p]) if p < len(sb) else 0) + carry
        carry = total // 10
        if carry:
            out.add(p)
    return out


def column_borrows(a, b):
    """Places that borrow, and whether a borrow passes through a zero digit."""
    top = [int(d) for d in str(a)[::-1]]
    bottom = [int(d) for d in str(b)[::-1]]
    out, across = set(), False
    for p in range(len(top)):
        if top[p] < (bottom[p] if p < len(bottom) else 0):
            out.add(p)
            q = p + 1
            while top[q] == 0:
                top[q] = 9
                across = True
                q += 1
            top[q] -= 1
            top[p] += 10
    return out, across


BOUNDS = {
    'add-two-digit-regroup': (10, 99, 100),
    'subtract-two-digit-regroup': (10, 100, 100),
    'add-three-digit': (100, 999, 1000),
    'subtract-three-digit': (100, 1000, 1000),
    'add-multidigit': (1000, 999999, 999999),
    'subtract-multidigit': (1000, 999999, 999999),
}


def solve_add_subtract(public):
    name, prompt, figure = public['templateId'], public['prompt'], public.get('figure')
    if name == 'make-hundred':
        m = re.fullmatch(r'(\d{2}) \+ □ = 100\. What number goes in the box\?', prompt)
        require(m is not None and 10 <= int(m[1]) <= 90, f'Unexpected prompt {prompt!r}')
        return 100 - int(m[1])
    a, op, b = operation(prompt)
    low, high, limit = BOUNDS[name]
    require(low <= a <= high and low <= b <= high, f'Operands out of range: {prompt}')
    if name == 'add-two-digit-regroup':
        require(figure == {'kind': 'base-ten-pair', 'values': [a, b]}, 'Blocks disagree with prompt')
    else:
        require(figure is None, 'Unexpected figure')
    if op == '+':
        require(name.startswith('add') and a + b <= limit, 'Sum out of range')
        return a + b
    require(name.startswith('subtract') and b < a, 'Difference must be positive')
    return a - b


def review_add_subtract_fixtures():
    require(column_carries(47, 38) == {0}, 'Ones carry')
    require(column_carries(999, 1) == {0, 1, 2}, 'Carry chain')
    require(column_borrows(503, 268) == ({0}, True) and column_borrows(523, 287) == ({0, 1}, False), 'Borrow across zero')
    require(column_borrows(1000, 387) == ({0}, True), 'Borrow from a thousand')
    require(solve_add_subtract({'templateId': 'subtract-multidigit', 'prompt': 'What is 45,072 − 18,396?'}) == 26676, 'Fixture')
    for bad in ('What is 4507 − 1839?', 'What is 45,072 - 18,396?'):
        try:
            solve_add_subtract({'templateId': 'subtract-multidigit', 'prompt': bad})
        except ValueError:
            continue
        raise ValueError(f'Accepted {bad!r}')


class AddSubtractCorpus:
    """Hard cases must appear: regrouping in each place, zeros in minuends, controls."""

    def __init__(self):
        self.seen = {}

    def record(self, public, solved):
        name, tags = public['templateId'], None
        tags = self.seen.setdefault(name, set())
        if name == 'make-hundred':
            start = 100 - solved
            tags.add('whole-ten' if start % 10 == 0 else 'complete-ten')
            return
        a, op, b = operation(public['prompt'])
        if op == '+':
            c = column_carries(a, b)
            tags.update(f'carry-{p}' for p in c)
            if not c:
                tags.add('no-regroup')
            if len(str(a + b)) > max(len(str(a)), len(str(b))):
                tags.add('new-place')
            if any({p, p + 1, p + 2} <= c for p in c):
                tags.add('carry-chain')
        else:
            places, across = column_borrows(a, b)
            tags.update(f'borrow-{p}' for p in places)
            if not places:
                tags.add('no-regroup')
            if across:
                tags.add('across-zero')
            if '00' in str(a)[1:] and across:
                tags.add('across-zeros')
            if str(a).endswith('0') and 0 in places:
                tags.add('zero-ones')

    def finish(self):
        required = {
            'add-two-digit-regroup': {'carry-0', 'carry-1', 'no-regroup', 'new-place'},
            'make-hundred': {'whole-ten', 'complete-ten'},
            'subtract-two-digit-regroup': {'borrow-0', 'no-regroup', 'zero-ones', 'across-zero'},
            'add-three-digit': {'carry-0', 'carry-1', 'carry-2', 'no-regroup', 'new-place'},
            'subtract-three-digit': {'borrow-0', 'borrow-1', 'no-regroup', 'across-zero', 'across-zeros'},
            'add-multidigit': {f'carry-{p}' for p in range(5)} | {'carry-chain', 'new-place'},
            'subtract-multidigit': {f'borrow-{p}' for p in range(5)} | {'across-zeros'},
        }
        for name, tags in required.items():
            missing = tags - self.seen.get(name, set())
            require(not missing, f'{name} never reaches {sorted(missing)}')
        return {name: len(tags) for name, tags in sorted(self.seen.items())}
