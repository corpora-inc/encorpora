"""Independent check that a teaching figure shows only what its prompt states.

Every number written in a figure label (side, angle, segment or expression)
must also appear in the prompt, so a figure can neither contradict the givens
nor carry a derived value such as the answer. The unknown is drawn as "?".
"""
import re


def label_strings(node):
    """Every label or text string in a scene, in document order."""
    out = []
    if isinstance(node, dict):
        for key, value in node.items():
            if key in ('text', 'label') and isinstance(value, str):
                out.append(value)
            elif key not in ('title', 'note'):
                out.extend(label_strings(value))
    elif isinstance(node, list):
        for item in node:
            out.extend(label_strings(item))
    return out


def integers(text):
    return set(re.findall(r'\d+', text.replace('−', '-')))


def check_figure_givens(public, require, key_label=None):
    figure = public.get('figure')
    if figure is None:
        return
    require(figure.get('kind') == 'scene', 'Teaching figures are scenes')
    labels = label_strings(figure['scene'])
    # A label-free figure (a triangle with its circle) states no number to check.
    given = integers(public['prompt'])
    if 'Transversal' in public['prompt']:
        given |= set('12345678')  # angles are named by position
    for text in labels:
        stray = integers(text) - given
        require(not stray, f'Figure label {text!r} shows {sorted(stray)} that the prompt does not state')
    if key_label is not None:
        require(key_label.strip() not in labels, 'A figure label repeats the keyed answer')
