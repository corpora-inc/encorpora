"""Named-unit volume choices. The answer is read from the figure and the prompt unit."""
import json
import re
from fractions import Fraction

from geometry_scene_view import figure_view
from volume_coordinate_math_oracle import count_cubes, prompt_unit

SUPPORTED = frozenset({'named-unit-cube-choice'})
CHOICE_REVIEW = SUPPORTED

NAMED = frozenset({
    'cubic centimeters', 'cubic inches', 'cubic feet',
    'blocks', 'sugar cubes', 'dice', 'ice cubes', 'bales',
})


def require(condition, message):
    if not condition:
        raise ValueError(message)


def visible_prism(length, width, height):
    """Cubes on the top, the depth side, or the front face."""
    count = 0
    for x in range(length):
        for y in range(width):
            for z in range(height):
                if z == height - 1 or y == width - 1 or x == length - 1:
                    count += 1
    return count


def solve(public):
    require(public['templateId'] in SUPPORTED, 'Unsupported family')
    prompt = public['prompt']
    unit = prompt_unit(prompt)
    require(unit in NAMED, f'Unit {unit!r}')
    require('cubic units' not in prompt, 'cubic units')
    if unit == 'cubic feet':
        require(any(word in prompt for word in ('crate', 'storage', 'bale')), 'Cubic feet context')
    figure = figure_view(public['figure'])
    total = count_cubes(figure)
    require(figure['kind'] == 'cube-prism', 'Prism')
    length, width, height = (figure[k] for k in ('length', 'width', 'height'))
    require(2 <= length <= 6 and 2 <= width <= 6 and 2 <= height <= 6, 'Edges')
    require(total <= 150, 'Count')
    visible = visible_prism(length, width, height)
    require(visible != total and visible == total - (length - 1) * (width - 1) * (height - 1),
            'Visible count')
    options = public['response']['options']
    require(len(options) == 4, 'Four choices')
    labels = [o['label'] for o in options]
    require(len(set(labels)) == 4, 'Distinct labels')
    wanted = f'{total} {unit}'
    hits = [o for o in options if o['label'] == wanted]
    require(len(hits) == 1, 'One choice names the volume in the prompt unit')
    require(f'{visible} {unit}' in labels, 'Visible-cube distractor')
    require(labels.count(wanted) == 1, 'The volume in this unit is one choice')
    return hits[0]['id']


def review_problem(problem):
    public = problem['public']
    answer = problem['answer']
    label = next(o['label'] for o in public['response']['options'] if o['id'] == answer)
    text = ' '.join(problem['explanation'])
    require(label in text, 'Explanation states the chosen volume')
    require('cubic units' not in public['prompt'] and 'cubic units' not in text, 'cubic units')
    require(label not in problem['hint'], 'Hint names the answer')
    for option_id, note in problem['choiceFeedback'].items():
        wrong = next(o['label'] for o in public['response']['options'] if o['id'] == option_id)
        require(wrong in note, 'Feedback names the chosen option')
        require(label not in note, 'Feedback names the correct volume')


def self_test():
    def options(*labels):
        return {'kind': 'choice', 'options': [
            {'id': f'option-{"abcd"[i]}', 'label': s} for i, s in enumerate(labels)]}
    public = {
        'templateId': 'named-unit-cube-choice',
        'prompt': 'Each small cube has 1-inch edges. Which describes the volume of this rectangular prism, in cubic inches?',
        'response': options('36 square inches', '36 cubic inches', '24 cubic inches', '36 inches'),
        'figure': {'kind': 'cube-prism', 'length': 3, 'width': 3, 'height': 4},
    }
    require(solve(public) == 'option-b', '36 cubic inches, and 24 are visible')
    public['response'] = options('36 cubic inches', '36 cubic inches', '24 cubic inches', '36 inches')
    try:
        solve(public)
    except ValueError:
        pass
    else:
        raise AssertionError('Duplicate labels must be rejected')
    bare = dict(public, prompt='Each small cube has 1-foot edges. Which describes its volume, in cubic feet?',
                response=options('24 cubic feet', '24 square feet', '18 cubic feet', '24 feet'),
                figure={'kind': 'cube-prism', 'length': 2, 'width': 3, 'height': 4})
    try:
        solve(bare)
    except ValueError:
        pass
    else:
        raise AssertionError('Cubic feet need a context')
    return 3


if __name__ == '__main__':
    print(self_test())
