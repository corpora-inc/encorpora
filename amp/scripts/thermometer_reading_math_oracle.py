"""Independent review of thermometer-reading: the reading is recomputed from
the public thermometer figure (its scale and where the liquid ends), never
from the generator's answer, and the scale is checked for a learner to read:
numbered marks on the label step, the liquid on a mark, the unit the prompt
asks for, and no reading stated in words."""
import copy
import re
from fractions import Fraction as F

SUPPORTED = frozenset({'thermometer-reading'})
PROMPT = re.compile(r'What temperature does the thermometer show, in degrees (Fahrenheit|Celsius)\?')


def require(ok, message):
    if not ok:
        raise ValueError(message)


def whole(value):
    number = F(str(value))
    require(number.denominator == 1, 'Scale values are whole degrees')
    return int(number)


def thermometer(public):
    figure = public.get('figure')
    require(isinstance(figure, dict) and figure.get('kind') == 'scene', 'Scene figure required')
    elements = [e for e in figure['scene']['elements'] if e.get('type') == 'thermometer']
    require(len(elements) == 1 and len(figure['scene']['elements']) == 1, 'Exactly one thermometer')
    return elements[0]


def solve(public):
    require(public['templateId'] in SUPPORTED, 'Wrong family')
    prompt = public['prompt']
    match = PROMPT.fullmatch(prompt)
    require(match is not None, 'Unexpected prompt')
    require(not re.search(r'\d', prompt), 'The prompt states a number')
    t = thermometer(public)
    unit = {'Fahrenheit': 'F', 'Celsius': 'C'}[match[1]]
    require(t['unit'] == unit, 'Figure unit differs from the prompt')
    require(public['response']['kind'] == 'number', 'Numeric entry required')
    require(f'°{unit}' in public['response']['label'], 'Entry label names the unit')
    low, high, minor, major = (whole(t[k]) for k in ('min', 'max', 'minor', 'major'))
    require(low < high, 'Empty scale')
    require(major % minor == 0 and major > minor, 'Numbered marks fall on small marks')
    require(low % major == 0 and high % major == 0, 'Scale ends on numbered marks')
    require(t.get('derived') is True, 'The reading must be masked in the description')
    reading = whole(t['reading'])
    # The liquid must end on a small mark strictly inside the scale: count
    # the small marks from the bottom of the scale to the top of the liquid.
    marks, rest = divmod(reading - low, minor)
    require(rest == 0, 'The liquid ends between marks')
    require(0 < marks < (high - low) // minor, 'The liquid ends outside the scale')
    return F(low + marks * minor)


def review_problem(problem):
    public = problem['public']
    reading = solve(public)
    t = thermometer(public)
    minor, major = int(t['minor']), int(t['major'])
    spaces = major // minor
    hint = problem['hint']
    # The hint teaches the step of this scale and never the reading.
    require(f'each small mark is {minor} degree' in hint, 'Hint must name the small-mark step')
    require(f'go up by {major} degree' in hint and f'{spaces} small spaces' in hint, 'Hint must name the label step')
    numbers = {abs(int(x)) for x in re.findall(r'-?\d+', hint.replace('−', '-'))}
    require(abs(reading) not in numbers, 'Hint states the reading')
    explanation = ' '.join(problem['explanation'])
    base = int(reading // major) * major
    steps = int((reading - base) / minor)
    require(f'{major}\\div{spaces}={minor}' in explanation, 'Explanation derives the step')
    if steps:
        require(f'${base}+{steps}\\times{minor}=' in explanation, 'Explanation counts on from the label below')
    final = problem['explanation'][-1]
    require(f'${int(reading)}$°{t["unit"]}' in final, 'Explanation states the reading with its unit')


def _case(unit='F', low=30, high=70, minor=2, major=10, reading=54):
    name = 'Fahrenheit' if unit == 'F' else 'Celsius'
    spaces = major // minor
    base = (reading // major) * major
    steps = (reading - base) // minor
    shown = f'-{-reading}' if reading < 0 else f'{reading}'
    count = (f'Counting up from ${base}$: ${base}+{steps}\\times{minor}={shown}$.' if base >= 0 else
             f'Counting up from $-{-base}$: $-{-base}+{steps}\\times{minor}={shown}$.')
    return {
        'public': {
            'templateId': 'thermometer-reading',
            'prompt': f'What temperature does the thermometer show, in degrees {name}?',
            'response': {'kind': 'number', 'label': f'Temperature in °{unit}'},
            'figure': {'kind': 'scene', 'scene': {'v': 1, 'elements': [{
                'type': 'thermometer', 'id': 't', 'unit': unit, 'min': low, 'max': high,
                'minor': minor, 'major': major, 'reading': reading, 'derived': True}]}},
        },
        'answer': str(reading),
        'hint': f'The numbers on this thermometer go up by {major} degrees, with {spaces} small spaces between them, so each small mark is {minor} degree{"s" if minor > 1 else ""}. Find the last numbered mark below the top of the liquid, then count the small marks up to the top.',
        'explanation': [
            f'The numbers go up by {major}, and there are {spaces} spaces between numbers, so each small mark is ${major}\\div{spaces}={minor}$ degrees.',
            f'The last numbered mark below the top of the liquid is ${base}$. The liquid ends {steps} small marks above it.',
            count,
            f'The thermometer shows ${shown}$°{unit}.',
        ],
    }


def self_test():
    rejected = 0
    fixtures = [_case(), _case('C', -20, 20, 1, 5, -7), _case('F', 0, 40, 1, 10, 18)]

    def reject(problem):
        nonlocal rejected
        try:
            review_problem(problem)
            require(solve(problem['public']) == F(problem['answer']), 'answer')
        except ValueError:
            rejected += 1
            return
        raise AssertionError('Corruption accepted')

    for p in fixtures:
        review_problem(p)
        require(solve(p['public']) == F(p['answer']), 'Fixture answer')
        t = lambda q: q['public']['figure']['scene']['elements'][0]
        bad = copy.deepcopy(p); t(bad)['reading'] += t(bad)['minor']; reject(bad)
        bad = copy.deepcopy(p); t(bad)['reading'] += 1 if t(bad)['minor'] == 2 else 0.5; reject(bad)
        bad = copy.deepcopy(p); t(bad)['unit'] = 'C' if t(bad)['unit'] == 'F' else 'F'; reject(bad)
        bad = copy.deepcopy(p); t(bad)['reading'] = t(bad)['max']; reject(bad)
        bad = copy.deepcopy(p); t(bad)['min'] += 1; reject(bad)
        bad = copy.deepcopy(p); t(bad)['derived'] = False; reject(bad)
        bad = copy.deepcopy(p); bad['public']['prompt'] += f' It reads {p["answer"]}.'; reject(bad)
        bad = copy.deepcopy(p); bad['hint'] += f' It is {abs(int(p["answer"]))}.'; reject(bad)
        bad = copy.deepcopy(p); bad['answer'] = str(int(p['answer']) + 1); reject(bad)
    return {'fixtures': len(fixtures), 'rejectedMutations': rejected}


if __name__ == '__main__':
    print(self_test())
