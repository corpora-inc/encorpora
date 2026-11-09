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


def slot_key(public, labels):
    import json
    key = {}
    blanks = public['response']['blanks']
    require(len(blanks) == len(labels), 'Slot count')
    for blank, label in zip(blanks, labels):
        hits = [option['id'] for option in blank['options'] if option['label'] == label]
        require(len(hits) == 1, f'{blank["id"]} missing {label}')
        key[blank['id']] = hits[0]
    return json.dumps(key, separators=(',', ':'))


def nearest_hundred(n):
    return ((n + 50) // 100) * 100


def solve_place_steps(prompt, public):
    nums = [int(n) for n in re.findall(r'\d+', prompt)]
    require(len(nums) >= 2, 'Two amounts')
    if 'Count up from' in prompt:
        minuend, sub = nums[0], nums[1]
        hop1 = 10 - (sub % 10)
        after = sub + hop1
        hundred = ((after + 99) // 100) * 100
        hop2 = hundred - after
        hop3 = minuend - hundred
        answer = minuend - sub
        require(hop1 + hop2 + hop3 == answer, 'Hops miss the difference')
        return slot_key(public, [str(hop1), str(hop2), str(hop3), str(answer)])
    other, near = nums[0], nums[1]
    base = nearest_hundred(near)
    distance = abs(near - base)
    require(1 <= distance <= 3, 'Addend is not within 3 of a hundred')
    rounded = other + base
    final = rounded - distance if near < base else rounded + distance
    return slot_key(public, [str(base), str(rounded), str(distance), str(final)])


def solve_digit_stack(prompt, public):
    import json
    nums = [int(n) for n in re.findall(r'\d+', prompt)]
    require(len(nums) >= 2, 'Two stack amounts')
    a, b = nums[0], nums[1]
    rows = public['response']['rows']
    if rows and rows[0]['fields'][0]['kind'] == 'choice':
        tens = (a // 10) % 10
        label = 'A hundred, into ten tens' if tens == 0 else 'A ten, into ten ones'
        bank = public['response']['banks'][0]
        hits = [option['id'] for option in bank['options'] if option['label'] == label]
        require(len(hits) == 1, 'Opening choice')
        digits = subtract_digits(a, b)
        body = [[hits[0]]] + [[str(d)] for d in digits]
        require(len(body) == len(rows), 'Open-which rows')
        return json.dumps(body, separators=(',', ':'))
    if 'Subtract' in prompt or '−' in prompt and 'Add' not in prompt:
        digits = subtract_digits(a, b)
        body = [[str(d)] for d in digits]
    else:
        body = add_cells(a, b)
    require(len(body) == len(rows), 'Stack rows')
    for row, cells in zip(rows, body):
        require(len(row['fields']) == len(cells), 'Stack fields')
    return json.dumps(body, separators=(',', ':'))


def add_cells(a, b):
    cells, carry = [], 0
    places = max(len(str(a)), len(str(b)))
    for i in range(places):
        total = (a // 10**i) % 10 + (b // 10**i) % 10 + carry
        carry = total // 10
        cells.append((total % 10, carry))
    if carry:
        cells.append((carry, 0))
    out = []
    for i, (digit, carried) in enumerate(cells):
        out.append([str(digit)] if i == len(cells) - 1 else [str(digit), str(carried)])
    return out


def subtract_digits(a, b):
    digits, borrow = [], 0
    for i in range(len(str(a))):
        top = (a // 10**i) % 10 - borrow
        bottom = (b // 10**i) % 10
        borrow = 0
        if top < bottom:
            top += 10
            borrow = 1
        digits.append(top - bottom)
    return digits


def solve_add_subtract(public):
    name, prompt, figure = public['templateId'], public['prompt'], public.get('figure')
    kind = public.get('response', {}).get('kind', 'number')
    if kind == 'multi-part-choice':
        return solve_place_steps(prompt, public)
    if kind == 'structured-work':
        return solve_digit_stack(prompt, public)
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
        if public['response']['kind'] != 'number':
            tags.add('clause')
            return
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
