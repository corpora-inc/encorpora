"""Read typeset worked arithmetic without dropping operators or grouping."""
import re

from ratio_rate_math_oracle import plain_arithmetic


def plain_worked_math(text):
    # Reuse the ratio/rate reader: fractions become grouped quotients, including
    # nested fractions, and explicit multiplication/division remain operators.
    text = plain_arithmetic(text)

    def span(match):
        formula = re.sub(r'\^\{([0-9]+)\}', r'^\1', match[1])
        if any(char in formula for char in '\\{}'):
            # These checks cover arithmetic claims, not symbolic definitions
            # such as F = \text{rate} × d or notation such as \binom{n}{k}.
            # Leave those unchanged; never partially read an unknown command
            # in a numeric equality (for example \sqrt{4} = 2).
            if '=' in formula and re.search(r'\d', formula):
                raise ValueError('Unsupported typeset worked expression: ' + match[0])
            return match[0]
        return formula.replace('-', '−')

    return re.sub(r'\$([^$]*)\$', span, text)
