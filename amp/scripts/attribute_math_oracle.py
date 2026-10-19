"""Independent measurement-attribute oracle: lengths, balances, pours, unit
layouts, scales and one-step measurement stories, solved from the public
prompt and figure only."""
import re

ATTRIBUTE_CHOICE = frozenset({
    'compare-lengths', 'compare-weights', 'compare-capacity',
    'correct-unit-measure', 'order-lengths',
})
ATTRIBUTE = ATTRIBUTE_CHOICE | {
    'measure-with-units', 'read-liquid-volume', 'balance-mass', 'mass-volume-story',
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def option(public, predicate):
    response = public['response']
    require(response['kind'] == 'choice', 'Choice response required')
    labels = [o['label'] for o in response['options']]
    require(len(set(labels)) == len(labels), 'Duplicate option labels')
    found = [o['id'] for o in response['options'] if predicate(o['label'])]
    require(len(found) == 1, f'Expected exactly one matching option in {labels}')
    return found[0]


def proper_layout(panel):
    """Units one long, starting at the object's end, touching, never overlapping."""
    return panel['placements'] == list(range(panel['length']))


STORIES = [
    (r'A bucket holds (\d+) liters of water and a tub holds (\d+) liters\. How many liters do they hold together\?', lambda a, b: a + b),
    (r'A melon has a mass of (\d+) grams and a bunch of grapes has a mass of (\d+) grams\. What is their total mass, in grams\?', lambda a, b: a + b),
    (r'A tank holds (\d+) liters of water\. (\d+) liters are used\. How many liters are left\?', lambda a, b: a - b),
    (r'A bag of potatoes has a mass of (\d+) grams and a bag of onions has a mass of (\d+) grams\. How many grams heavier is the bag of potatoes\?', lambda a, b: a - b),
    (r'Each bottle holds (\d+) liters\. How many liters do (\d+) bottles hold\?', lambda a, b: a * b),
    (r'Each bag of rice has a mass of (\d+) kilograms\. What is the mass of (\d+) bags, in kilograms\?', lambda a, b: a * b),
    (r'(\d+) liters of juice are poured equally into (\d+) jugs\. How many liters are in each jug\?', lambda a, b: a // b if a % b == 0 else None),
    (r'(\d+) kilograms of flour are shared equally among (\d+) bags\. What is the mass of each bag, in kilograms\?', lambda a, b: a // b if a % b == 0 else None),
]


def solve_attribute(public):
    template, prompt = public['templateId'], public['prompt']
    figure = public.get('figure')
    if template == 'compare-lengths':
        ask = re.fullmatch(r'Which strip is (longer|shorter)\?', prompt)
        require(ask is not None and figure['kind'] == 'length-rods', 'Length wording')
        lengths = {r['label']: r['length'] for r in figure['rods']}
        require(set(lengths) == {'A', 'B'}, 'Two strips')
        if lengths['A'] == lengths['B']:
            require(figure['rods'][0]['start'] == figure['rods'][1]['start'], 'Equal strips are drawn aligned')
            return option(public, lambda l: l == 'They are the same length.')
        longer = 'A' if lengths['A'] > lengths['B'] else 'B'
        target = longer if ask[1] == 'longer' else ({'A', 'B'} - {longer}).pop()
        return option(public, lambda l: l == f'Strip {target}')
    if template == 'compare-weights':
        ask = re.fullmatch(r'Which is (heavier|lighter)\?', prompt)
        require(ask is not None and figure['kind'] == 'mass-balance', 'Weight wording')
        if figure['tilt'] == 'level':
            return option(public, lambda l: l == 'They weigh the same.')
        low, high = (figure['left'], figure['right']) if figure['tilt'] == 'left' else (figure['right'], figure['left'])
        target = low if ask[1] == 'heavier' else high
        return option(public, lambda l: l == f"{target['label']} (the {target['shape']})")
    if template == 'compare-capacity':
        require(re.fullmatch(r'The \w+ \(A\) was full of water\. All of it was poured into the \w+ \(B\), which was empty\. Which holds more\?', prompt) is not None, 'Capacity wording')
        e = figure['eighths']
        if e == 8:
            return option(public, lambda l: l == 'They hold the same amount.')
        return option(public, lambda l: l.startswith('B, ' if e < 8 else 'A, '))
    if template == 'measure-with-units':
        require(figure['kind'] == 'unit-measure' and len(figure['panels']) == 1, 'One panel')
        panel = figure['panels'][0]
        require(proper_layout(panel), 'Units must be laid correctly to be counted')
        return len(panel['placements'])
    if template == 'correct-unit-measure':
        require(prompt.startswith('Which picture shows how to measure'), 'Layout wording')
        good = [p['label'] for p in figure['panels'] if proper_layout(p)]
        require(len(good) == 1, 'Exactly one correct layout')
        return option(public, lambda l: l == f'Picture {good[0]}')
    if template == 'order-lengths':
        facts = re.findall(r'The (\w+) ribbon is (longer|shorter) than the (\w+) ribbon\.', prompt)
        ask = re.search(r'Which ribbon is the (longest|shortest)\?$', prompt)
        require(len(facts) == 2 and ask is not None, 'Ribbon wording')
        longer = [(a, b) if rel == 'longer' else (b, a) for a, rel, b in facts]
        names = {n for pair in longer for n in pair}
        require(len(names) == 3, 'Three ribbons')
        never_shorter = [n for n in names if all(b != n for _, b in longer)]
        never_longer = [n for n in names if all(a != n for a, _ in longer)]
        require(len(never_shorter) == 1 and len(never_longer) == 1, 'The comparisons must chain')
        target = never_shorter[0] if ask[1] == 'longest' else never_longer[0]
        return option(public, lambda l: l == f'The {target} ribbon')
    if template == 'read-liquid-volume':
        require(figure['kind'] == 'liquid-scale' and figure['unit'] == 'L', 'Liter scale')
        require(figure['level'] % figure['step'] == 0 and 0 < figure['level'] < figure['max'], 'Level on a tick')
        return figure['level']
    if template == 'balance-mass':
        require(figure['kind'] == 'mass-balance' and figure['tilt'] == 'level', 'A level balance')
        require('grams' in figure['right'], 'Standard masses on the right')
        return sum(figure['right']['grams'])
    if template == 'mass-volume-story':
        for pattern, rule in STORIES:
            found = re.fullmatch(pattern, prompt)
            if found:
                value = rule(int(found[1]), int(found[2]))
                require(value is not None and value > 0, 'Positive whole answer')
                return value
        raise ValueError(f'Unrecognized measurement story: {prompt!r}')
    raise ValueError(f'Unknown attribute family {template}')


def review_attribute_fixtures():
    """Hand-built cases with known answers."""
    choice = lambda *labels: {'kind': 'choice', 'options': [{'id': f'o{i}', 'label': l} for i, l in enumerate(labels)]}
    misaligned = {'templateId': 'compare-lengths', 'prompt': 'Which strip is longer?',
                  'figure': {'kind': 'length-rods', 'rods': [{'label': 'A', 'length': 8, 'start': 0}, {'label': 'B', 'length': 6, 'start': 4}]},
                  'response': choice('Strip A', 'Strip B', 'They are the same length.')}
    require(solve_attribute(misaligned) == 'o0', 'A is longer even though B ends further right')
    heavy_small = {'templateId': 'compare-weights', 'prompt': 'Which is heavier?',
                   'figure': {'kind': 'mass-balance', 'tilt': 'left', 'left': {'shape': 'ball', 'size': 1, 'label': 'A'}, 'right': {'shape': 'box', 'size': 3, 'label': 'B'}},
                   'response': choice('A (the ball)', 'B (the box)', 'They weigh the same.')}
    require(solve_attribute(heavy_small) == 'o0', 'The lower pan is heavier')
    ribbons = {'templateId': 'order-lengths',
               'prompt': 'The blue ribbon is shorter than the red ribbon. The blue ribbon is longer than the green ribbon. Which ribbon is the shortest?',
               'response': choice('The red ribbon', 'The blue ribbon', 'The green ribbon')}
    require(solve_attribute(ribbons) == 'o2', 'Green is shortest')
    require(solve_attribute({'templateId': 'mass-volume-story', 'prompt': '24 liters of juice are poured equally into 4 jugs. How many liters are in each jug?'}) == 6, 'Division story')
    require(solve_attribute({'templateId': 'balance-mass', 'prompt': 'The balance is level. What is the mass of the bag, in grams?',
                             'figure': {'kind': 'mass-balance', 'tilt': 'level', 'left': {'shape': 'bag', 'size': 2}, 'right': {'grams': [200, 50, 5]}}}) == 255, 'Balanced grams')
    rejected = [
        {'templateId': 'measure-with-units', 'prompt': 'x', 'figure': {'kind': 'unit-measure', 'unit': 'cube', 'panels': [{'length': 5, 'placements': [0, 1.5, 3]}]}},
        {'templateId': 'balance-mass', 'prompt': 'x', 'figure': {'kind': 'mass-balance', 'tilt': 'left', 'left': {'shape': 'bag', 'size': 2}, 'right': {'grams': [200]}}},
        {'templateId': 'mass-volume-story', 'prompt': '25 liters of juice are poured equally into 4 jugs. How many liters are in each jug?'},
    ]
    for public in rejected:
        try:
            solve_attribute(public)
        except ValueError:
            continue
        raise ValueError(f'Attribute oracle must reject {public["prompt"]!r}')
