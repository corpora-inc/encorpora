"""Independent clock and money oracle: times from the drawn clocks, a.m. or
p.m. from the named activity, and values from the drawn coins and bills. It
reads only the public prompt, figure and option labels."""
import re
from fractions import Fraction

TIME_MONEY_CHOICE = frozenset({
    'read-clock-hour-half', 'match-clock-half-hour', 'read-clock-five-minutes',
    'clock-am-pm', 'match-clock-five-minutes', 'pay-exact-coins',
})
TIME_MONEY = TIME_MONEY_CHOICE | {
    'clock-hour-read', 'minutes-past-hour', 'coin-total', 'money-total-dollars',
    'make-a-dollar', 'money-left-story',
}
VALUE = {'penny': 1, 'nickel': 5, 'dime': 10, 'quarter': 25, 'dollar': 100, 'five': 500}
COINS = {'penny', 'nickel', 'dime', 'quarter'}
MORNING = ('wakes up', 'breakfast', 'walks to school')
LATER = ('after-school', 'after school', 'dinner', 'goes to bed')


def require(condition, message):
    if not condition:
        raise ValueError(message)


def match(pattern, text):
    found = re.fullmatch(pattern, text)
    require(found is not None, f'Unrecognized clock or money wording: {text!r}')
    return found.groups()


def written(hour, minute):
    return f'{hour}:{minute:02d}'


def one_clock(public, minutes):
    figure = public.get('figure')
    require(figure and figure['kind'] == 'analog-clocks' and len(figure['clocks']) == 1, 'One clock')
    clock = figure['clocks'][0]
    require(1 <= clock['hour'] <= 12 and clock['minute'] in minutes, 'Clock time out of range')
    return clock['hour'], clock['minute']


def option(public, label):
    response = public['response']
    require(response['kind'] == 'choice', 'Choice response required')
    labels = [o['label'] for o in response['options']]
    require(len(set(labels)) == len(labels), 'Duplicate option labels')
    found = [o['id'] for o in response['options'] if o['label'] == label]
    require(len(found) == 1, f'Expected exactly one option {label!r}')
    return found[0]


def money(items, coins_only=True):
    require(all(i in VALUE for i in items), 'Unknown money item')
    require(not coins_only or all(i in COINS for i in items), 'Coins only')
    return sum(VALUE[i] for i in items)


def one_set(public, coins_only=True):
    figure = public.get('figure')
    require(figure and figure['kind'] == 'money-sets' and len(figure['sets']) == 1, 'One money set')
    return money(figure['sets'][0]['items'], coins_only)


HALF = {0, 30}
FIVES = set(range(5, 60, 5))


def solve_time_money(public):
    template, prompt = public['templateId'], public['prompt']
    if template in ('read-clock-hour-half', 'read-clock-five-minutes'):
        require(prompt == 'What time does the clock show?', 'Clock wording')
        h, m = one_clock(public, HALF if template == 'read-clock-hour-half' else FIVES)
        return option(public, written(h, m))
    if template == 'clock-hour-read':
        h, m = one_clock(public, HALF)
        expected = {0: 'The clock shows a time on the hour. What hour is it?',
                    30: 'The clock shows half past an hour. Half past what hour?'}[m]
        require(prompt == expected, 'The prompt must name the minute hand correctly')
        return h
    if template == 'minutes-past-hour':
        require(prompt == 'How many minutes past the hour does the clock show?', 'Minutes wording')
        return one_clock(public, FIVES)[1]
    if template in ('match-clock-half-hour', 'match-clock-five-minutes'):
        h, m = map(int, match(r'Which clock shows (\d{1,2}):(\d\d)\?', prompt))
        figure = public['figure']
        require(figure['kind'] == 'analog-clocks' and len(figure['clocks']) == 3, 'Three clocks')
        times = [(c['hour'], c['minute']) for c in figure['clocks']]
        require(len(set(times)) == 3, 'Distinct clocks')
        hits = [c['label'] for c in figure['clocks'] if (c['hour'], c['minute']) == (h, m)]
        require(len(hits) == 1, 'Exactly one clock shows the time')
        return option(public, f'Clock {hits[0]}')
    if template == 'clock-am-pm':
        (activity,) = match(r'[A-Z][a-z]+ (.+) at the time on the clock\. Which time is it\?', prompt)
        morning = any(k in activity for k in MORNING)
        later = any(k in activity for k in LATER)
        require(morning != later, f'Activity time of day unknown: {activity!r}')
        h, m = one_clock(public, FIVES | {0})
        return option(public, f"{written(h, m)} {'a.m.' if morning else 'p.m.'}")
    if template == 'coin-total':
        require(prompt == 'How many cents are these coins worth in all?', 'Coin wording')
        return one_set(public)
    if template == 'money-total-dollars':
        require(prompt.startswith('How much money is shown?'), 'Dollar wording')
        return Fraction(one_set(public, coins_only=False), 100)
    if template == 'make-a-dollar':
        require(prompt.startswith('One dollar is 100 cents.'), 'Dollar wording')
        total = one_set(public)
        require(total < 100, 'Coins must be under a dollar')
        return 100 - total
    if template == 'money-left-story':
        _, price = match(r'([A-Z][a-z]+) has these coins and buys an? [a-z ]+ for (\d+)¢\. How many cents does \1 have left\?', prompt)
        total = one_set(public)
        require(int(price) <= total, 'The price must be affordable')
        return total - int(price)
    if template == 'pay-exact-coins':
        price, again = match(r'An? [a-z ]+ costs (\d+)¢\. Which set of coins is worth exactly (\d+)¢\?', prompt)
        require(price == again, 'One price')
        sets = public['figure']['sets']
        hits = [s['label'] for s in sets if money(s['items']) == int(price)]
        require(len(hits) == 1, 'Exactly one set pays the price')
        return option(public, f'Set {hits[0]}')
    raise ValueError(f'Unknown clock or money family {template}')


def review_time_money_fixtures():
    """Hand-built cases with known answers."""
    clock = lambda h, m: {'kind': 'analog-clocks', 'clocks': [{'hour': h, 'minute': m}]}
    choice = lambda *labels: {'kind': 'choice', 'options': [{'id': f'o{i}', 'label': l} for i, l in enumerate(labels)]}
    cases = [
        ({'templateId': 'read-clock-five-minutes', 'prompt': 'What time does the clock show?', 'figure': clock(4, 35),
          'response': choice('5:35', '4:35', '4:07')}, 'o1'),
        ({'templateId': 'clock-hour-read', 'prompt': 'The clock shows half past an hour. Half past what hour?', 'figure': clock(12, 30)}, 12),
        ({'templateId': 'clock-am-pm', 'prompt': 'Omar eats dinner at the time on the clock. Which time is it?', 'figure': clock(6, 15),
          'response': choice('6:15 a.m.', '6:15 p.m.')}, 'o1'),
        ({'templateId': 'coin-total', 'prompt': 'How many cents are these coins worth in all?',
          'figure': {'kind': 'money-sets', 'sets': [{'items': ['quarter', 'quarter', 'dime', 'nickel', 'penny']}]}}, 66),
        ({'templateId': 'money-total-dollars', 'prompt': 'How much money is shown? Enter the amount in dollars, such as 2.35.',
          'figure': {'kind': 'money-sets', 'sets': [{'items': ['dollar', 'dollar', 'quarter', 'dime']}]}}, Fraction(235, 100)),
    ]
    for public, expected in cases:
        require(solve_time_money(public) == expected, f'Clock or money fixture {public["prompt"]!r}')
    rejected = [
        {'templateId': 'clock-hour-read', 'prompt': 'The clock shows a time on the hour. What hour is it?', 'figure': clock(3, 30)},
        {'templateId': 'clock-am-pm', 'prompt': 'Omar reads a book at the time on the clock. Which time is it?', 'figure': clock(6, 15),
         'response': choice('6:15 a.m.', '6:15 p.m.')},
        {'templateId': 'pay-exact-coins', 'prompt': 'A pear costs 30¢. Which set of coins is worth exactly 30¢?',
         'figure': {'kind': 'money-sets', 'sets': [{'items': ['dime'] * 3, 'label': 'A'}, {'items': ['quarter', 'nickel'], 'label': 'B'}]},
         'response': choice('Set A', 'Set B')},
    ]
    for public in rejected:
        try:
            solve_time_money(public)
        except ValueError:
            continue
        raise ValueError(f'Clock or money oracle must reject {public["prompt"]!r}')
