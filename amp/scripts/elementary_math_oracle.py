"""Exact public-givens checks for elementary tasks; no generator or answer imports."""
import re

ELEMENTARY = frozenset({
    'join-within-10', 'take-away-within-10',
    'ten-frame-complement', 'teen-frame-compose',
    'missing-start-story',
    'make-ten-remainder', 'subtract-through-ten', 'tens-ones-model',
    'ten-more-or-less', 'add-ones-regroup', 'subtract-whole-tens',
    'hundreds-model', 'expanded-form-missing', 'exchange-base-ten',
    'add-several-two-digit', 'add-with-regrouping', 'subtract-with-regrouping',
    'skip-count-missing', 'continue-count-to-120',
})


def require(condition, message):
    if not condition:
        raise ValueError(message)


def solve_elementary(public):
    """Recover the answer from public story/equation quantities and visible units."""
    name, prompt = public['templateId'], public['prompt']
    numbers = [int(n) for n in re.findall(r'\d+', prompt)]
    figure = public.get('figure')
    if figure:
        if figure['kind'] == 'ten-frame':
            require(figure['capacity'] in (10, 20), 'Invalid frame capacity')
            require(all(type(figure[k]) is int and figure[k] >= 0 for k in ('first', 'second')), 'Invalid counter count')
            require(figure['first'] + figure['second'] <= figure['capacity'], 'Overflowing frame')
        elif figure['kind'] == 'base-ten':
            require(all(type(figure[k]) is int and 0 <= figure[k] <= high for k, high in [('hundreds', 9), ('tens', 19), ('ones', 19)]), 'Invalid block count')
            require(100 * figure['hundreds'] + 10 * figure['tens'] + figure['ones'] <= 999, 'Oversized model')
        else:
            raise ValueError('Unexpected elementary figure')
    def frame(first, second, capacity):
        require(figure == {'kind': 'ten-frame', 'first': first, 'second': second, 'capacity': capacity}, 'Frame and prompt disagree')
    def block_value():
        require(figure and figure['kind'] == 'base-ten', 'Missing base-ten model')
        return 100 * figure['hundreds'] + 10 * figure['tens'] + figure['ones']
    if name == 'join-within-10':
        a, b = numbers
        frame(a, b, 10)
        require(a + b <= 10, 'Kindergarten sum too large')
        return a + b
    if name == 'take-away-within-10':
        a, b = numbers
        frame(a, 0, 10)
        require(0 <= b <= a <= 10, 'Invalid small subtraction')
        return a - b
    if name == 'ten-frame-complement' and public.get('response', {}).get('kind') == 'choice':
        frame(figure['first'], 0, 10)
        filled = figure['first']
        empty = 10 - filled
        labels = {f'{filled} + {empty} = 10', f'10 = {filled} + {empty}'}
        hits = [option['id'] for option in public['response']['options'] if option['label'] in labels]
        require(len(hits) == 1, 'One sentence names the partner')
        return hits[0]
    if name == 'ten-frame-complement':
        frame(figure['first'], 0, 10)
        return sum(1 for index in range(10) if index >= figure['first'])
    if name == 'teen-frame-compose':
        frame(10, figure['second'], 20)
        require(1 <= figure['second'] <= 9, 'Not a teen composition')
        return 10 + figure['second']
    if name == 'missing-start-story':
        removed, remaining = numbers
        require(removed + remaining <= 20, 'Story exceeds twenty')
        return removed + remaining
    if name == 'make-ten-remainder':
        first, second, moved, source, repeated = numbers
        frame(first, second, 20)
        require(second == source == repeated and first + moved == 10 and second >= moved, 'Invalid make-ten split')
        return second - moved
    if name == 'subtract-through-ten':
        start, total_change, removed = numbers
        require(start - removed == 10 and total_change >= removed, 'Invalid subtraction split')
        return total_change - removed
    if name in ('tens-ones-model', 'hundreds-model'):
        require(figure['tens'] <= 9 and figure['ones'] <= 9, 'Expected canonical digits')
        if name == 'tens-ones-model':
            require(figure['hundreds'] == 0, 'Two-digit model has hundreds')
        return block_value()
    if name == 'ten-more-or-less':
        value, = numbers
        require(block_value() == value, 'Model and starting quantity disagree')
        require(('more' in prompt) != ('less' in prompt), 'Ambiguous direction')
        return value + (10 if 'more' in prompt else -10)
    if name == 'add-ones-regroup' and public.get('response', {}).get('kind', 'number') != 'number':
        import json
        found = re.search(r'blocks show (\d+)\. Add (\d+) ones', prompt)
        require(found is not None, 'Stack wording')
        start, extra = int(found[1]), int(found[2])
        require(block_value() == start, 'Model and starting amount disagree')
        ones = (start % 10) + extra
        carry = 1 if ones >= 10 else 0
        cells = {
            'Ones': str(ones % 10),
            'Carry': str(carry),
            'Tens': str(start // 10 + carry),
        }
        body = []
        for row in public['response']['rows']:
            field = row['fields'][0]
            if field['kind'] == 'choice':
                bank = next(b for b in public['response']['banks'] if b['id'] == field['bank'])
                hits = [o['id'] for o in bank['options'] if o['label'].startswith('Ten of the ones')]
                require(len(hits) == 1, 'Carry reason')
                body.append([hits[0]])
            else:
                key = next(name for name in cells if row['label'].startswith(name))
                body.append([cells[key]])
        return json.dumps(body, separators=(',', ':'))
    if name in ('add-ones-regroup', 'subtract-whole-tens'):
        start, change = numbers[:2]
        require(block_value() == start, 'Model and starting amount disagree')
        if name == 'add-ones-regroup':
            if ' tens' in prompt:
                added = change * 10
                require(20 <= added <= 80 and start + added <= 99, 'Tens addend')
                return start + added
            if change % 10 == 0 and change >= 20:
                require(start + change <= 99, 'Tens addend')
                return start + change
            require(start % 10 + change >= 10 and change < 10, 'Missing required regroup')
            return start + change
        require(start % 10 == change % 10 == 0 and change <= start, 'Not whole-ten subtraction')
        return start - change
    if name == 'expanded-form-missing':
        total, hundreds, ones = numbers
        require(hundreds == (total // 100) * 100 and ones == total % 10, 'Invalid expanded givens')
        return total - hundreds - ones
    if name == 'exchange-base-ten':
        block_value()
        if prompt.startswith('Trade ten ones'):
            require(figure['ones'] >= 10, 'Not enough ones to exchange')
            return figure['tens'] + 1
        require(prompt.startswith('Trade ten tens') and figure['tens'] >= 10, 'Not enough tens to exchange')
        return figure['hundreds'] + 1
    if name == 'add-several-two-digit' and public.get('response', {}).get('kind', 'number') != 'number':
        from add_subtract_math_oracle import slot_key
        require(3 <= len(numbers) <= 4, 'Three or four addends')
        tens = sum(n - n % 10 for n in numbers)
        ones = sum(n % 10 for n in numbers)
        return slot_key(public, [str(tens), str(ones), str(tens + ones)])
    if name == 'add-several-two-digit':
        require(3 <= len(numbers) <= 4 and all(10 <= n <= 59 for n in numbers), 'Invalid addend set')
        return sum(numbers)
    if name == 'add-with-regrouping' and public.get('response', {}).get('kind', 'number') != 'number':
        from add_subtract_math_oracle import solve_digit_stack
        return solve_digit_stack(prompt, public)
    if name == 'add-with-regrouping':
        a, b = numbers
        require(a % 10 + b % 10 >= 10 and a + b < 1000, 'Invalid regrouping sum')
        return a + b
    if name == 'subtract-with-regrouping' and public.get('response', {}).get('kind', 'number') != 'number':
        from add_subtract_math_oracle import solve_digit_stack
        return solve_digit_stack(prompt, public)
    if name == 'subtract-with-regrouping':
        a, b = numbers
        require(a % 10 < b % 10 and 0 <= b <= a < 1000, 'Invalid regrouping difference')
        return a - b
    if name == 'skip-count-missing':
        def hops(values, step):
            require(step in (10, 100) and all(b - a == step for a, b in zip(values, values[1:])), 'Inconsistent skip-count')
            require(values[-1] <= 1000, 'Count exceeds 1000')
        unstated_next = re.fullmatch(r'What comes next\? (\d+), (\d+), (\d+), □\.', prompt)
        if unstated_next:
            a, b, c = (int(part) for part in unstated_next.groups())
            step = b - a
            hops([a, b, c, c + step], step)
            return c + step
        unstated_mid = re.fullmatch(r'What number is missing\? (\d+), (\d+), □, (\d+)\.', prompt)
        if unstated_mid:
            a, b, d = (int(part) for part in unstated_mid.groups())
            step = b - a
            hops([a, b, b + step, d], step)
            require(d - (b + step) == step, 'The term after the blank skips')
            return b + step
        stated_mid = re.fullmatch(r'Count by (\d+): (\d+), (\d+), □, (\d+)\. What number is missing\?', prompt)
        if stated_mid:
            step, a, b, d = (int(part) for part in stated_mid.groups())
            require(b - a == step, 'Stated step disagrees with the terms')
            hops([a, b, b + step, d], step)
            require(d - (b + step) == step, 'The term after the blank skips')
            return b + step
        step, first, second, third = numbers
        require(step in (5, 10, 100) and second - first == third - second == step, 'Inconsistent skip-count')
        require(third + step <= 1000, 'Count exceeds1000')
        return third + step
    if name == 'continue-count-to-120':
        first, second, third = numbers
        require(second == first + 1 and third == second + 1 and third < 120, 'Inconsistent consecutive count')
        return third + 1
    raise ValueError(f'Unsupported elementary family: {name}')
