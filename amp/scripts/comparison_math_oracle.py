"""Independent comparison and place-value checks from public givens; no generator imports."""
import re

COMPARISON_CHOICE = frozenset({'compare-groups', 'two-digit-symbol', 'three-digit-symbol'})
COMPARISON = COMPARISON_CHOICE | frozenset({
    'greater-numeral', 'compare-two-digit', 'compare-three-digit',
    'multidigit-digit-value', 'compare-multidigit',
})
PLACES = ['ones', 'tens', 'hundreds', 'thousands', 'ten thousands', 'hundred thousands']


def require(condition, message):
    if not condition:
        raise ValueError(message)


def whole(text):
    """Parse a written whole number, requiring correct thousands grouping."""
    require(re.fullmatch(r'\d{1,3}(,\d{3})*', text) is not None, f'Badly written number {text!r}')
    require(len(text) < 4 or ',' in text, f'Missing thousands separator in {text!r}')
    return int(text.replace(',', ''))


def option_for(public, label):
    matches = [o['id'] for o in public['response']['options'] if o['label'] == label]
    require(len(matches) == 1, f'No unique option {label!r}')
    return matches[0]


def which(prompt):
    m = re.fullmatch(r'Which number is (greater|less): ([\d,]+) or ([\d,]+)\?', prompt)
    require(m is not None, f'Unexpected comparison prompt {prompt!r}')
    a, b = whole(m[2]), whole(m[3])
    require(a != b, 'Comparison needs two different numbers')
    return (max if m[1] == 'greater' else min)(a, b), a, b


def symbol(a, b):
    return '<' if a < b else '>' if a > b else '='


def solve_comparison(public):
    name, prompt, figure = public['templateId'], public['prompt'], public.get('figure')
    if name == 'compare-groups':
        require(figure and figure['kind'] == 'counter-rows', 'Missing counter rows')
        circles, squares = figure['circles'], figure['squares']
        require(1 <= circles <= 10 and 1 <= squares <= 10, 'Counter rows out of range')
        m = re.fullmatch(r'Are there (more|fewer) circles or (more|fewer) squares\?', prompt)
        require(m is not None and m[1] == m[2], f'Unexpected group prompt {prompt!r}')
        word = m[1].capitalize()
        # Pair one circle with one square until a row runs out.
        left = circles - squares
        if left == 0:
            return option_for(public, 'The same number')
        circles_more = left > 0
        return option_for(public, f'{word} circles' if circles_more == (m[1] == 'more') else f'{word} squares')
    if name == 'greater-numeral':
        pick, a, b = which(prompt)
        require(0 <= a <= 10 and 0 <= b <= 10, 'Numerals exceed ten')
        return pick
    if name == 'compare-two-digit':
        pick, a, b = which(prompt)
        require(figure == {'kind': 'base-ten-pair', 'values': [a, b]}, 'Blocks disagree with the prompt')
        require(10 <= a <= 99 and 10 <= b <= 99, 'Not two-digit numbers')
        return pick
    if name == 'compare-three-digit':
        pick, a, b = which(prompt)
        require(100 <= a <= 999 and 100 <= b <= 999, 'Not three-digit numbers')
        require(figure is None, 'Unexpected figure')
        return pick
    if name in ('two-digit-symbol', 'three-digit-symbol'):
        m = re.fullmatch(r'Compare (\d+) and (\d+)\. Which statement is true\?', prompt)
        require(m is not None, f'Unexpected symbol prompt {prompt!r}')
        a, b = int(m[1]), int(m[2])
        low, high = (10, 99) if name == 'two-digit-symbol' else (100, 999)
        require(low <= a <= high and low <= b <= high, 'Digits out of range')
        labels = [o['label'] for o in public['response']['options']]
        require(labels == [f'{a} < {b}', f'{a} = {b}', f'{a} > {b}'], 'Unexpected statements')
        return option_for(public, f'{a} {symbol(a, b)} {b}')
    if name == 'multidigit-digit-value':
        m = re.fullmatch(r'What is the value of the digit (\d) in ([\d,]+)\?', prompt)
        require(m is not None, f'Unexpected digit prompt {prompt!r}')
        digits = str(whole(m[2]))
        require(4 <= len(digits) <= 6 and digits.count(m[1]) == 1 and m[1] != '0', 'Digit must be nonzero and appear once')
        place = len(digits) - 1 - digits.index(m[1])
        return int(m[1]) * 10 ** place
    if name == 'compare-multidigit':
        pick, a, b = which(prompt)
        require(1000 <= a <= 999999 and 1000 <= b <= 999999, 'Outside four to six digits')
        return pick
    raise ValueError(f'No comparison solver for {name}')


def review_comparison_fixtures():
    require(whole('372,946') == 372946 and whole('6,902') == 6902, 'Grouping parser')
    for bad in ('6902', '37,25', '1,0000'):
        try:
            whole(bad)
        except ValueError:
            continue
        raise ValueError(f'Accepted {bad!r}')
    digit = {'templateId': 'multidigit-digit-value', 'prompt': 'What is the value of the digit 7 in 372,946?'}
    require(solve_comparison(digit) == 70000, 'Digit value fixture')
    pick = {'templateId': 'compare-three-digit', 'prompt': 'Which number is less: 607 or 670?'}
    require(solve_comparison(pick) == 607, 'Zero-place fixture')
    many = {'templateId': 'compare-multidigit', 'prompt': 'Which number is greater: 98,765 or 102,345?'}
    require(solve_comparison(many) == 102345, 'Digit-count fixture')


class ComparisonCorpus:
    """Each family must reach its hard cases, not only easy ones."""

    def __init__(self):
        self.seen = {}

    def record(self, public, solved):
        name, prompt = public['templateId'], public['prompt']
        tags = self.seen.setdefault(name, set())
        numbers = [whole(n) for n in re.findall(r'\d[\d,]*\d|\d', prompt)]
        if name == 'compare-groups':
            f = public['figure']
            tags.add('equal' if f['circles'] == f['squares'] else 'unequal')
            if f['spread'] != 'none' and f['circles'] != f['squares']:
                fewer = 'circles' if f['circles'] < f['squares'] else 'squares'
                tags.add('longer-row-fewer' if f['spread'] == fewer else 'longer-row-more')
        elif name in ('compare-two-digit', 'compare-three-digit', 'two-digit-symbol', 'three-digit-symbol', 'compare-multidigit'):
            a, b = numbers[-2:] if name != 'compare-multidigit' else numbers[:2]
            if a == b:
                tags.add('equal')
            elif len(str(a)) != len(str(b)):
                tags.add('digit-count')
            else:
                sa, sb = str(a), str(b)
                first = next(i for i in range(len(sa)) if sa[i] != sb[i])
                tags.add(f'decided-{len(sa) - 1 - first}')
                lesser, greater = sorted((sa, sb))
                if lesser[first + 1:] > greater[first + 1:]:
                    tags.add('lesser-has-larger-tail')
                if sa == sb[::-1]:
                    tags.add('reversed')
                if '0' in sa + sb:
                    tags.add('zero')
        elif name == 'multidigit-digit-value':
            tags.add(f'place-{len(str(solved)) - 1}')
        elif name == 'greater-numeral':
            tags.add('greater' if 'greater' in prompt else 'less')

    def finish(self):
        required = {
            'compare-groups': {'equal', 'unequal', 'longer-row-fewer', 'longer-row-more'},
            'greater-numeral': {'greater', 'less'},
            'compare-two-digit': {'decided-1', 'decided-0', 'lesser-has-larger-tail', 'reversed'},
            'two-digit-symbol': {'equal', 'decided-1', 'decided-0', 'reversed'},
            'compare-three-digit': {'decided-2', 'decided-1', 'decided-0', 'lesser-has-larger-tail', 'reversed', 'zero'},
            'three-digit-symbol': {'equal', 'decided-2', 'decided-1', 'decided-0', 'zero'},
            'multidigit-digit-value': {f'place-{p}' for p in range(1, 6)},
            'compare-multidigit': {'digit-count', 'decided-5', 'decided-0', 'lesser-has-larger-tail'},
        }
        for name, tags in required.items():
            missing = tags - self.seen.get(name, set())
            require(not missing, f'{name} never reaches {sorted(missing)}')
        return {name: len(tags) for name, tags in sorted(self.seen.items())}
