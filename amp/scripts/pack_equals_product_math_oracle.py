"""Layer count equals the product of the three edges. Answers come from the prompt and the figure."""
import json
import re

from geometry_scene_view import figure_view

SUPPORTED = frozenset({
    'pack-equals-product-work',
    'pack-equals-product-select',
    'pack-equals-product-picture',
})
CHOICE_REVIEW = SUPPORTED


def require(condition, message):
    if not condition:
        raise ValueError(message)


def dumps(value):
    return json.dumps(value, separators=(',', ':'))


def prism_edges(public):
    figure = figure_view(public['figure'])
    require(figure['kind'] == 'cube-prism', 'Prism')
    edges = tuple(int(figure[k]) for k in ('length', 'width', 'height'))
    require(all(2 <= n <= 6 for n in edges) and len(set(edges)) == 3, 'Three distinct edges')
    return edges


def prompt_edges(prompt):
    found = re.search(r'(\d+) cubes long, (\d+) cubes wide and (\d+) cubes high', prompt)
    require(found is not None, 'Edge wording')
    return tuple(int(found[i]) for i in (1, 2, 3))


def expr_value(label):
    text = label.replace(' ', '')
    matched = re.fullmatch(r'(\d+)\+(\d+)\+(\d+)', text)
    if matched:
        return int(matched[1]) + int(matched[2]) + int(matched[3])
    matched = re.fullmatch(r'(\d+)×(\d+)\+(\d+)', text)
    if matched:
        return int(matched[1]) * int(matched[2]) + int(matched[3])
    matched = re.fullmatch(r'(\d+)×(\d+)', text)
    if matched:
        return int(matched[1]) * int(matched[2])
    matched = re.fullmatch(r'(\d+)×\((\d+)×(\d+)\)', text)
    if matched:
        return int(matched[1]) * int(matched[2]) * int(matched[3])
    matched = re.fullmatch(r'\((\d+)×(\d+)\)×(\d+)', text)
    if matched:
        return int(matched[1]) * int(matched[2]) * int(matched[3])
    raise ValueError(f'Unreadable expression {label}')


def option_prism(option):
    solid = next(e['solid'] for e in option['scene']['elements'] if e['type'] == 'isoSolid')
    require(solid['form'] == 'cubes' and solid.get('lift', 0) > 0, 'Lifted layers')
    return int(solid['length']), int(solid['width']), int(solid['height'])


def solve(public):
    template = public['templateId']
    require(template in SUPPORTED, 'Unsupported family')
    prompt = public['prompt']
    if template == 'pack-equals-product-picture':
        found = re.fullmatch(r'Which solid is (\d+) layers of (\d+) cubes\?', prompt)
        require(found is not None, 'Picture wording')
        layers, base = int(found[1]), int(found[2])
        options = public['response']['options']
        require(len(options) == 4, 'Four pictures')
        hits = []
        for option in options:
            length, width, height = option_prism(option)
            if height == layers and length * width == base:
                hits.append(option['id'])
            require(not (height * length * width == layers * base and not (height == layers and length * width == base)),
                    'Another picture has the same product')
        require(len(hits) == 1, 'One picture matches the asked layers')
        products = []
        for option in options:
            length, width, height = option_prism(option)
            products.append(height * length * width)
        require(products.count(layers * base) == 1, 'Exactly one picture has the asked product')
        return hits[0]
    length, width, height = prism_edges(public)
    require(prompt_edges(prompt) == (length, width, height), 'Prompt edges differ from the figure')
    volume = length * width * height
    if template == 'pack-equals-product-work':
        response = public['response']
        bank = next(b for b in response['banks'] if any(o['label'] == 'equal' for o in b['options']))
        equal = next(o['id'] for o in bank['options'] if o['label'] == 'equal')
        layer = length * width
        return dumps([[str(layer)], [str(height)], [str(volume)], [str(volume)], [equal]])
    options = public['response']['options']
    require(public['response']['selectionCount'] == 3 and len(options) == 6, 'Choose 3 of 6')
    good = [o['id'] for o in options if expr_value(o['label']) == volume]
    require(len(good) == 3, 'Three products equal the volume')
    require(all(expr_value(o['label']) != volume for o in options if o['id'] not in good), 'Distractor value')
    return dumps(sorted(good))


def review_problem(problem):
    public = problem['public']
    text = ' '.join(problem['explanation'])
    template = public['templateId']
    if template == 'pack-equals-product-picture':
        found = re.fullmatch(r'Which solid is (\d+) layers of (\d+) cubes\?', public['prompt'])
        require(found is not None and f'{found[1]}' in text and f'{found[2]}' in text, 'Explanation names the asked layers')
        label = next(o['label'] for o in public['response']['options'] if o['id'] == problem['answer'])
        require(label not in problem['hint'], 'Hint quotes the correct picture')
        return
    length, width, height = prompt_edges(public['prompt'])
    volume = length * width * height
    require(re.search(rf'(?<!\d){volume}(?!\d)', text.replace('$', '')), 'Explanation states the volume')
    if template == 'pack-equals-product-work':
        require('equal' in text, 'Explanation says the counts are equal')
        require(str(volume) not in problem['hint'], 'Hint states the volume')
    else:
        for option in public['response']['options']:
            if option['id'] in json.loads(problem['answer']):
                require(option['label'] not in problem['hint'], 'Hint quotes a correct expression')


def self_test():
    work = {
        'templateId': 'pack-equals-product-work',
        'prompt': 'This prism is 3 cubes long, 4 cubes wide and 5 cubes high. Find the cubes in the bottom layer.',
        'figure': {'kind': 'cube-prism', 'length': 3, 'width': 4, 'height': 5},
        'response': {'banks': [{'id': 'match', 'options': [{'id': 'ne', 'label': 'not equal'}, {'id': 'eq', 'label': 'equal'}]}]},
    }
    require(solve(work) == '[["12"],["5"],["60"],["60"],["eq"]]', '3 by 4 by 5')
    select = {
        'templateId': 'pack-equals-product-select',
        'prompt': 'This prism is 3 cubes long, 4 cubes wide and 5 cubes high. Choose every expression.',
        'figure': {'kind': 'cube-prism', 'length': 3, 'width': 4, 'height': 5},
        'response': {
            'selectionCount': 3,
            'options': [
                {'id': 'option-a', 'label': '5 × (3 × 4)'},
                {'id': 'option-b', 'label': '3 + 4 + 5'},
                {'id': 'option-c', 'label': '3 × (4 × 5)'},
                {'id': 'option-d', 'label': '3 × 4'},
                {'id': 'option-e', 'label': '(3 × 5) × 4'},
                {'id': 'option-f', 'label': '3 × 4 + 5'},
            ],
        },
    }
    require(solve(select) == '["option-a","option-c","option-e"]', 'Three groupings')
    def picture(length, width, height, letter):
        return {
            'id': f'option-{letter}',
            'label': f'{height} layers of cubes. The base is {length} cubes by {width} cubes.',
            'scene': {'v': 1, 'elements': [{
                'type': 'isoSolid',
                'solid': {'form': 'cubes', 'length': length, 'width': width, 'height': height, 'lift': 0.45},
            }]},
        }
    shown = {
        'templateId': 'pack-equals-product-picture',
        'prompt': 'Which solid is 5 layers of 12 cubes?',
        'response': {'options': [
            picture(3, 4, 4, 'a'),
            picture(3, 4, 5, 'b'),
            picture(4, 4, 5, 'c'),
            picture(3, 5, 5, 'd'),
        ]},
    }
    require(solve(shown) == 'option-b', '5 layers on a 3 by 4 base')
    return 3


if __name__ == '__main__':
    print(self_test())
