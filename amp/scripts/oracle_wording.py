"""Generated text reads correctly for a count of one ("1 tray", "There is 1").
Oracles still parse the givens; this widens their patterns to either form."""
import re

_NUMBER = r'(\((?:\[0-9\]|\\d)\+\) )'


def _singular(word):
    if re.search(r'(ches|shes|xes|sses)$', word):
        return word[:-2]
    return word[:-1]


def tolerant(pattern):
    pattern = re.sub(_NUMBER + r'([a-z]+s)\b(?!\?|\(|\))',
                     lambda m: f'{m.group(1)}(?:{m.group(2)}|{_singular(m.group(2))})', pattern)
    pattern = re.sub(r'\b([Tt])here are (?=\()', r'\1here (?:are|is) ', pattern)
    pattern = re.sub(r'\b([Tt])here were (?=\()', r'\1here (?:were|was) ', pattern)
    return pattern
