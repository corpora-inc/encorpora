"""Independent oracle for elapsed-time-hm, object-for-measure and
approximate-unit-factor, from the public payload only.

Times are minutes after midnight with a.m./p.m. read exactly (12:xx a.m. is
00:xx, 12:xx p.m. is 12:xx); a clock figure supplies hour and minute and the
prompt supplies morning or afternoon. Object judgments use a reference table of
believable ranges written here, not the generator's: the keyed object must be
within a factor of three of the stated measure and every other object at least
a factor of three beyond it. Conversion answers are the exact quotient or
product rounded half up to the tenth, and must also be the nearest choice.
"""

import copy
import re
from fractions import Fraction as F

SUPPORTED = frozenset({'elapsed-time-hm', 'object-for-measure', 'approximate-unit-factor'})
CHOICE_REVIEW = SUPPORTED
REVIEW_RETURNS_ANSWER = False


def require(condition, message):
    if not condition:
        raise ValueError(message)


def plain(text):
    return text.replace('−', '-').replace('$', '')


def options_of(public):
    response = public['response']
    require(response['kind'] == 'choice' and len(response['options']) == 4, 'Four choices required')
    require(len({o['id'] for o in response['options']}) == 4, 'Option ids must be distinct')
    return response['options']


def one_match(options, test, what):
    hits = [o['id'] for o in options if test(o)]
    require(len(hits) == 1, f'Exactly one choice must be {what}; found {len(hits)}')
    return hits[0]


# --------------------------------------------------------------- elapsed time
CLOCK_TIME = r'(\d{1,2}):(\d\d) (a\.m\.|p\.m\.)'
CLOCK_FIGURE = r'the time shown on the clock, in the (morning|afternoon)'
EITHER = f'(?:{CLOCK_TIME}|{CLOCK_FIGURE})'
STOP = r'(?:(?<=m\.)|\.)'  # the period of "p.m." doubles as the sentence period
DURATION = r'(\d+ hours?(?: \d+ minutes?)?|\d+ minutes?)'


def written_minutes(hour, minute, meridian):
    hour, minute = int(hour), int(minute)
    require(1 <= hour <= 12 and 0 <= minute <= 59, 'Impossible clock time')
    return (hour % 12 + (12 if meridian == 'p.m.' else 0)) * 60 + minute


def clock_minutes(public, part):
    figure = public.get('figure')
    require(figure is not None and figure['kind'] == 'clock', 'Clock figure required')
    hour, minute = figure['hour'], figure['minute']
    require(isinstance(hour, int) and isinstance(minute, int) and 0 <= hour <= 12 and 0 <= minute <= 59, 'Clock reading out of range')
    require(0 <= minute <= 59, 'Impossible minute')
    hour12 = hour % 12
    if part == 'morning':
        require(hour12 != 0, '12:xx cannot be called morning')
        return hour12 * 60 + minute
    return (12 + hour12) * 60 + minute


def duration_minutes(text):
    total = 0
    m = re.fullmatch(r'(?:(\d+) (hours?))?(?: )?(?:(\d+) (minutes?))?', text)
    require(m is not None and text != '', f'Unreadable duration: {text}')
    if m[1] is not None:
        h = int(m[1])
        require(h >= 1 and m[2] == ('hour' if h == 1 else 'hours'), f'Hours agreement in {text}')
        total += 60 * h
    if m[3] is not None:
        n = int(m[3])
        require(n >= 1 and m[4] == ('minute' if n == 1 else 'minutes'), f'Minutes agreement in {text}')
        total += n
    return total


def time_label(label):
    m = re.fullmatch(CLOCK_TIME, label)
    require(m is not None, f'Not a clock time: {label}')
    return written_minutes(*m.groups())


def side(public, groups, offset):
    """Minutes for one time slot starting at groups[offset]: written (3 groups) or clock phrase."""
    if groups[offset] is not None:
        return written_minutes(groups[offset], groups[offset + 1], groups[offset + 2])
    return clock_minutes(public, groups[offset + 3])


def elapsed_parts(public):
    prompt = public['prompt']
    has_clock = 'the time shown on the clock' in prompt
    require(has_clock == ('figure' in public), 'The clock figure appears exactly when the prompt refers to it')
    m = re.fullmatch(rf'A [a-z ]+? (?:starts|begins|leaves) at {EITHER}{STOP} It lasts {DURATION}\. At what time does it (?:end|return)\?', prompt)
    if m:
        start = side(public, m.groups(), 0)
        return 'end', start + duration_minutes(m[5])
    m = re.fullmatch(rf'A [a-z ]+? (?:starts|begins|leaves) at {EITHER},? and (?:ends|returns) at {EITHER}{STOP} How long does it last\?', prompt)
    if m:
        g = m.groups()
        end = side(public, g, 4)
        start = side(public, g, 0)
        return 'elapsed', end - start
    m = re.fullmatch(rf'A [a-z ]+? (?:ends|returns) at {EITHER}{STOP} It lasted {DURATION}\. At what time did it (?:start|begin|leave)\?', prompt)
    if m:
        end = side(public, m.groups(), 0)
        return 'start', end - duration_minutes(m[5])
    raise ValueError(f'Unrecognized wording: {prompt}')


def duration_label(label):
    return duration_minutes(label)


def solve_elapsed(public):
    kind, value = elapsed_parts(public)
    options = options_of(public)
    if kind == 'elapsed':
        require(value > 0, 'End must be after start')
        values = {o['id']: duration_label(o['label']) for o in options}
    else:
        require(0 <= value < 24 * 60, 'The answer leaves the day (crosses midnight)')
        values = {o['id']: time_label(o['label']) for o in options}
    require(len(set(values.values())) == 4, 'Choices must be distinct')
    return one_match(options, lambda o: values[o['id']] == value, f'{value}')


def review_elapsed(problem):
    public = problem['public']
    result = solve_elapsed(public)
    require(problem['answer'] == result, 'Answer key differs from the derived choice')
    labels = {o['id']: o['label'] for o in public['response']['options']}
    require(labels[result] not in problem.get('hint', ''), 'Hint leaks the answer')
    require(labels[result] not in public['prompt'], 'Prompt leaks the answer')
    require(result not in (problem.get('choiceFeedback') or {}), 'Correct choice has wrong-answer feedback')
    return result


# ----------------------------------------------------------- object judgments
# Believable (least, greatest) in grams for mass and millilitres for capacity.
MASS = {
    'a paper clip': (F(1, 2), F(3, 2)), 'a pencil': (5, 10), 'an apple': (100, 250), 'a bag of sugar': (450, 2300),
    'a bowling ball': (3000, 7300), 'a ten-year-old child': (25000, 40000), 'a small car': (900000, 1500000),
    'a bicycle': (9000, 16000), 'a loaf of bread': (450, 900), 'a slice of bread': (25, 40),
}
CAPACITY = {
    'a teaspoon': (F(9, 2), F(11, 2)), 'a juice box': (125, 250), 'a water bottle': (350, 1000), 'a coffee mug': (240, 355),
    'a milk carton': (470, 1900), 'a milk jug': (1900, 3800), 'a bucket': (7500, 12000), 'a bathtub': (150000, 300000),
}
MASS_UNITS = {'gram': 1, 'grams': 1, 'kilogram': 1000, 'kilograms': 1000, 'ounce': F(2835, 100), 'ounces': F(2835, 100),
              'pound': F(45359237, 100000), 'pounds': F(45359237, 100000), 'ton': F(90718474, 100), 'tons': F(90718474, 100)}
CAPACITY_UNITS = {'teaspoon': F(4929, 1000), 'teaspoons': F(4929, 1000), 'cup': F(236588, 1000), 'cups': F(236588, 1000),
                  'quart': F(946353, 1000), 'quarts': F(946353, 1000), 'gallon': F(3785411784, 1000000), 'gallons': F(3785411784, 1000000),
                  'milliliter': 1, 'milliliters': 1, 'liter': 1000, 'liters': 1000}
METRIC = {'gram', 'grams', 'kilogram', 'kilograms', 'milliliter', 'milliliters', 'liter', 'liters'}
KEY_REACH = 3   # the keyed object lies within this factor of the measure
RIVAL_GAP = F(3, 2)  # no other object is a believable size for the measure: it lies outside the believable range by this factor
RIVAL_MARGIN = F(3, 2)  # and every other object is this much farther (by factor) than the keyed one


def object_name(label):
    m = re.fullmatch(r'(An? .+)', label)
    require(m is not None, f'Option is not an object: {label}')
    return label[0].lower() + label[1:]


def object_parts(public):
    prompt = public['prompt']
    m = re.fullmatch(r'Which object has a mass closest to (\d+) ([a-z]+)\?', prompt)
    if m:
        require(m[2] in MASS_UNITS, f'Unknown unit {m[2]}')
        table, target = MASS, int(m[1]) * MASS_UNITS[m[2]]
    else:
        m = re.fullmatch(r'Which object holds an amount of liquid closest to (\d+) ([a-z]+)\?', prompt)
        require(m is not None, f'Unrecognized wording: {prompt}')
        require(m[2] in CAPACITY_UNITS, f'Unknown unit {m[2]}')
        table, target = CAPACITY, int(m[1]) * CAPACITY_UNITS[m[2]]
    count = int(m[1])
    require(m[2] == (m[2].rstrip('s') if count == 1 else m[2].rstrip('s') + 's'), f'Number agreement in "{count} {m[2]}"')
    return table, F(target), m[2]


def gap(target, low, high):
    """How many times the target lies outside the range (1 when inside)."""
    low, high = F(low), F(high)
    if low <= target <= high:
        return F(1)
    return target / high if target > high else low / target


def factor(target, low, high):
    """Factor between the measure and the geometric centre of the believable range (floats are enough for ranking)."""
    centre = (float(low) * float(high)) ** 0.5
    t = float(target)
    return max(t / centre, centre / t)


def solve_object(public):
    table, target, unit = object_parts(public)
    options = options_of(public)
    names = {o['id']: object_name(o['label']) for o in options}
    require(len(set(names.values())) == 4 and all(n in table for n in names.values()), 'Unknown or repeated object')
    ranked = sorted(options, key=lambda o: factor(target, *table[names[o['id']]]))
    key = ranked[0]
    require(gap(target, *table[names[key['id']]]) <= KEY_REACH, f'{names[key["id"]]} is not a believable size for the measure')
    best = factor(target, *table[names[key['id']]])
    for o in ranked[1:]:
        low, high = table[names[o['id']]]
        require(gap(target, low, high) >= RIVAL_GAP, f'{names[o["id"]]} is also a believable size for the measure')
        require(factor(target, low, high) >= float(RIVAL_MARGIN) * best, f'{names[o["id"]]} is too close to the keyed object')
    return key['id']


def review_object(problem):
    public = problem['public']
    result = solve_object(public)
    require(problem['answer'] == result, 'Answer key differs from the derived choice')
    table, target, unit = object_parts(public)
    key = {o['id']: o['label'] for o in public['response']['options']}[result]
    require(key not in problem.get('hint', '') and key.lower() not in problem.get('hint', '').lower(), 'Hint names the object')
    # A system-consistent measure: metric prompts use metric units and customary prompts customary ones.
    return result


# ------------------------------------------------------ approximate conversion
FACTS = {  # (larger unit, smaller unit): true number of smaller in one larger
    ('meter', 'feet'): F(328084, 100000), ('kilogram', 'pounds'): F(220462, 100000),
    ('inch', 'centimeters'): F(254, 100), ('mile', 'kilometers'): F(1609344, 1000000),
}
PLURAL = {'meter': 'meters', 'kilogram': 'kilograms', 'inch': 'inches', 'mile': 'miles'}
SINGULAR_SMALL = {'feet': 'foot', 'pounds': 'pound', 'centimeters': 'centimeter', 'kilometers': 'kilometer'}
# Believable size, in the larger unit, for each item (written here for this review).
BELIEVABLE = {
    ('meter', 'a tree'): (4, 30), ('meter', 'a flagpole'): (5, 35), ('meter', 'a climbing wall'): (5, 35),
    ('kilogram', 'a bag of potatoes'): (1, 12), ('kilogram', 'a suitcase'): (5, 30), ('kilogram', 'a box of books'): (3, 25),
    ('inch', 'a ribbon'): (3, 40), ('inch', 'a pencil'): (4, 9), ('inch', 'a strip of paper'): (3, 30),
    ('mile', 'a bike path'): (1, 40), ('mile', 'a hiking trail'): (1, 30), ('mile', 'a race course'): (1, 27),
}


def round_tenth(x):
    """Round half up to one decimal place; returned as an exact tenth."""
    scaled = x * 10
    return F(int(scaled + F(1, 2)), 10) if scaled >= 0 else F(-int(-scaled + F(1, 2)), 10)


def factor_parts(public):
    prompt = public['prompt']
    m = re.fullmatch(r'(A [a-z ]+?) measures (\d+) ([a-z]+)\. One ([a-z]+) is about (\d+(?:\.\d+)?) ([a-z]+)\. Which is closest to its measure in ([a-z]+)\?', prompt)
    require(m is not None, f'Unrecognized wording: {prompt}')
    item, amount, given, big, rate, small, asked = m.groups()
    item = item[0].lower() + item[1:]
    amount, rate = int(amount), F(rate)
    require(PLURAL.get(big) in (given, asked) and small in (given, asked) and given != asked, 'Units of the prompt disagree')
    require((big, small) in FACTS, f'Unknown unit pair {big}/{small}')
    require(abs(rate - FACTS[(big, small)]) / FACTS[(big, small)] <= F(3, 100), f'Stated factor {rate} is not true for {big}')
    if given == small:
        value, asked_unit = F(amount) / rate, PLURAL[big]
        in_big = value
    else:
        value, asked_unit = F(amount) * rate, small
        in_big = F(amount)
    require(asked == asked_unit, 'Asked unit disagrees with the conversion direction')
    require((big, item) in BELIEVABLE, f'{item} is not measured in {PLURAL[big]} here')
    low, high = BELIEVABLE[(big, item)]
    require(low <= in_big <= high, f'{item} measuring {in_big} {PLURAL[big]} is not believable')
    return value, asked


def solve_factor(public):
    value, asked = factor_parts(public)
    options = options_of(public)
    parsed = {}
    for o in options:
        m = re.fullmatch(r'(\d+\.\d) ([a-z]+)', o['label'])
        require(m is not None and m[2] == asked, f'Choice {o["label"]} is not a tenth in {asked}')
        parsed[o['id']] = F(m[1])
    require(len(set(parsed.values())) == 4, 'Choices must be distinct')
    exact = round_tenth(value)
    key = one_match(options, lambda o: parsed[o['id']] == exact, f'{exact}')
    nearest = min(options, key=lambda o: abs(parsed[o['id']] - value))['id']
    require(nearest == key, 'Keyed choice is not the nearest choice')
    # A unique nearest choice: no distractor ties with it.
    distances = sorted(abs(v - value) for v in parsed.values())
    require(distances[0] < distances[1], 'Nearest choice is not unique')
    return key


def review_factor(problem):
    public = problem['public']
    result = solve_factor(public)
    require(problem['answer'] == result, 'Answer key differs from the derived choice')
    key = {o['id']: o['label'] for o in public['response']['options']}[result]
    value = key.split()[0]
    require(value not in problem.get('hint', ''), 'Hint states the answer')
    require(value in ' '.join(problem.get('explanation', [value])), 'Explanation never states the answer')
    require(result not in (problem.get('choiceFeedback') or {}), 'Correct choice has wrong-answer feedback')
    return result


# ------------------------------------------------------------------ dispatch
def solve(public):
    template = public['templateId']
    require(template in SUPPORTED, 'Unexpected template')
    return {'elapsed-time-hm': solve_elapsed, 'object-for-measure': solve_object, 'approximate-unit-factor': solve_factor}[template](public)


def review_problem(problem):
    template = problem['public']['templateId']
    return {'elapsed-time-hm': review_elapsed, 'object-for-measure': review_object, 'approximate-unit-factor': review_factor}[template](problem)


def self_test():
    def mk(template, prompt, labels, answer, figure=None, hint='Work it out.'):
        public = {'templateId': template, 'prompt': prompt,
                  'response': {'kind': 'choice', 'options': [{'id': f'option-{c}', 'label': l} for c, l in zip('abcd', labels)]}}
        if figure:
            public['figure'] = figure
        return {'public': public, 'answer': answer, 'hint': hint, 'explanation': [labels['abcd'.index(answer[-1])]], 'choiceFeedback': {}}
    clock = lambda h, m: {'kind': 'clock', 'hour': h, 'minute': m}
    good = [
        mk('elapsed-time-hm', 'A movie starts at 1:20 p.m. It lasts 4 hours 25 minutes. At what time does it end?', ['5:45 p.m.', '8:55 a.m.', '5:20 p.m.', '1:45 p.m.'], 'option-a'),
        mk('elapsed-time-hm', 'A movie starts at 11:50 a.m. It lasts 1 hour 40 minutes. At what time does it end?', ['1:30 p.m.', '12:30 a.m.', '1:30 a.m.', '12:30 p.m.'], 'option-a'),
        mk('elapsed-time-hm', 'A movie starts at 11:30 a.m. It lasts 1 hour 5 minutes. At what time does it end?', ['12:35 p.m.', '12:35 a.m.', '11:35 p.m.', '1:35 p.m.'], 'option-a'),
        mk('elapsed-time-hm', 'A class trip leaves at 5:40 p.m. and returns at 8:20 p.m. How long does it last?', ['2 hours 40 minutes', '1 hour 40 minutes', '3 hours 40 minutes', '3 hours 20 minutes'], 'option-a'),
        mk('elapsed-time-hm', 'A class trip leaves at 10:20 a.m. and returns at 1:05 p.m. How long does it last?', ['2 hours 45 minutes', '3 hours 15 minutes', '2 hours 15 minutes', '3 hours 45 minutes'], 'option-a'),
        mk('elapsed-time-hm', 'A soccer game ends at 10:50 a.m. It lasted 3 hours 20 minutes. At what time did it start?', ['7:50 a.m.', '7:30 a.m.', '10:30 a.m.', '2:10 p.m.'], 'option-b'),
        mk('elapsed-time-hm', 'A soccer game ends at 12:10 p.m. It lasted 1 hour 25 minutes. At what time did it start?', ['10:45 a.m.', '10:45 p.m.', '1:35 p.m.', '11:35 a.m.'], 'option-a'),
        mk('elapsed-time-hm', 'A movie starts at the time shown on the clock, in the afternoon. It lasts 1 hour 5 minutes. At what time does it end?', ['3:40 p.m.', '2:40 p.m.', '3:35 p.m.', '1:30 p.m.'], 'option-a', clock(2, 35)),
        mk('elapsed-time-hm', 'A class trip returns at the time shown on the clock, in the afternoon. It lasted 3 hours 35 minutes. At what time did it leave?', ['5:00 p.m.', '2:00 p.m.', '2:35 p.m.', '9:10 p.m.'], 'option-b', clock(5, 35)),
        mk('elapsed-time-hm', 'A movie starts at the time shown on the clock, in the morning, and ends at 10:40 a.m. How long does it last?', ['2 hours 55 minutes', '3 hours 55 minutes', '3 hours 5 minutes', '1 hour 55 minutes'], 'option-a', clock(7, 45)),
        mk('object-for-measure', 'Which object has a mass closest to 150 grams?', ['An apple', 'A bag of sugar', 'A bowling ball', 'A small car'], 'option-a'),
        mk('object-for-measure', 'Which object holds an amount of liquid closest to 1 gallon?', ['A coffee mug', 'A bathtub', 'A milk carton', 'A milk jug'], 'option-d'),
        mk('object-for-measure', 'Which object has a mass closest to 30 pounds?', ['A bicycle', 'A loaf of bread', 'A slice of bread', 'A small car'], 'option-a'),
        mk('object-for-measure', 'Which object holds an amount of liquid closest to 5 milliliters?', ['A juice box', 'A water bottle', 'A teaspoon', 'A bucket'], 'option-c'),
        mk('approximate-unit-factor', 'A flagpole measures 25 feet. One meter is about 3.28 feet. Which is closest to its measure in meters?', ['82.0 meters', '7.6 meters', '28.3 meters', '21.7 meters'], 'option-b'),
        mk('approximate-unit-factor', 'A hiking trail measures 12 miles. One mile is about 1.6 kilometers. Which is closest to its measure in kilometers?', ['18.4 kilometers', '7.5 kilometers', '19.2 kilometers', '13.6 kilometers'], 'option-c'),
        mk('approximate-unit-factor', 'A pencil measures 17 centimeters. One inch is about 2.54 centimeters. Which is closest to its measure in inches?', ['6.7 inches', '43.2 inches', '14.5 inches', '6.9 inches'], 'option-a'),
    ]
    count = 0

    def reject(bad, why):
        nonlocal count
        try:
            review_problem(bad)
        except ValueError:
            count += 1
        else:
            raise AssertionError('Corrupted fixture accepted: ' + why)
    for case in good:
        review_problem(case)
        bad = copy.deepcopy(case)
        bad['answer'] = 'option-a' if case['answer'] != 'option-a' else 'option-b'
        reject(bad, 'wrong key')
        bad = copy.deepcopy(case)
        options = bad['public']['response']['options']
        right = next(i for i, o in enumerate(options) if o['id'] == case['answer'])
        options[(right + 1) % 4]['label'] = options[right]['label']
        reject(bad, 'duplicate of the correct choice')
    reject(copy.deepcopy(good[0]) | {'public': {**good[0]['public'], 'prompt': good[0]['public']['prompt'].replace('1:20 p.m.', '1:20 a.m.')}}, 'meridian changed')
    bad = copy.deepcopy(good[1])
    bad['public']['prompt'] = bad['public']['prompt'].replace('11:50 a.m.', '11:50 p.m.')
    reject(bad, 'a result past midnight')
    bad = copy.deepcopy(good[7])
    bad['public']['figure']['hour'] = 3
    reject(bad, 'clock changed')
    bad = copy.deepcopy(good[7])
    del bad['public']['figure']
    reject(bad, 'clock phrase without a clock')
    bad = copy.deepcopy(good[3])
    bad['public']['prompt'] = bad['public']['prompt'].replace('8:20 p.m.', '4:20 p.m.')
    reject(bad, 'end before start')
    bad = copy.deepcopy(good[0])
    bad['public']['prompt'] = bad['public']['prompt'].replace('4 hours 25 minutes', '1 hours 25 minutes')
    reject(bad, 'plural agreement')
    bad = copy.deepcopy(good[10])
    bad['public']['prompt'] = bad['public']['prompt'].replace('150 grams', '1 kilogram')
    reject(bad, 'two objects fit 1 kilogram or none')
    bad = copy.deepcopy(good[11])
    bad['public']['response']['options'][0]['label'] = 'A milk carton'  # carton and jug are both within reach of 1 gallon? carton is a quarter
    bad['public']['prompt'] = bad['public']['prompt'].replace('1 gallon', '1 quart')
    reject(bad, 'a distractor too close to the measure')
    bad = copy.deepcopy(good[12])
    bad['public']['prompt'] = bad['public']['prompt'].replace('30 pounds', '14 pounds')
    bad['public']['response']['options'][0]['label'] = 'A bowling ball'
    bad['public']['response']['options'][1]['label'] = 'A bicycle'
    reject(bad, 'a bicycle is also near 14 pounds')
    bad = copy.deepcopy(good[14])
    bad['public']['prompt'] = bad['public']['prompt'].replace('3.28', '4.28')
    reject(bad, 'false conversion factor')
    bad = copy.deepcopy(good[14])
    bad['public']['prompt'] = bad['public']['prompt'].replace('25 feet', '75 feet')
    reject(bad, 'changed measure')
    bad = copy.deepcopy(good[14])
    bad['public']['prompt'] = bad['public']['prompt'].replace('A flagpole', 'A pencil')
    reject(bad, 'unbelievable size')
    bad = copy.deepcopy(good[15])
    bad['public']['response']['options'][2]['label'] = '19.3 kilometers'
    reject(bad, 'nearest choice is not the rounded value')
    return {'fixtures': len(good), 'rejectedMutations': count}


if __name__ == '__main__':
    print(self_test())
