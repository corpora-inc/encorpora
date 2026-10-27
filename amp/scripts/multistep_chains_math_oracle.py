"""Independent review of the multi-step chain families from public payloads only.

Every answer is derived from the displayed prompt and choices with exact
Fractions. Each chain step must be determined by the stated givens, so the
parsers refuse a prompt whose wording leaves a quantity out.
"""
import ast
import copy
import re
from fractions import Fraction
from math import floor

PERCENT = frozenset({'percent-chain'})
CONVERSION = frozenset({'conversion-chain-story'})
SHARE = frozenset({'share-remainder-fractions', 'share-remainder-percent'})
PURCHASE = frozenset({'wallet-purchase-chain', 'mixed-quantity-discount'})
COUNT = frozenset({'count-relation-chain'})
SOLID = frozenset({'similar-solid-scale-chain'})
FEE_NUMBER = frozenset({'fee-plan-chain'})
FEE_CHOICE = frozenset({'fee-rule-choice', 'fee-budget-inequality'})
LINKED = frozenset({'linked-division-equations', 'linked-time-equations'})
PERIMETER = frozenset({'perimeter-area-chain'})
QUADRATIC = frozenset({'quadratic-model-chain'})
TOTALS = frozenset({'bag-totals-chain', 'fraction-total-minus-parts'})
CHOICE_REVIEW = FEE_CHOICE | LINKED
SUPPORTED = (PERCENT | CONVERSION | SHARE | PURCHASE | COUNT | SOLID | FEE_NUMBER
             | FEE_CHOICE | LINKED | PERIMETER | QUADRATIC | TOTALS)

NUM = (r'(?:\$?\d+\\frac\{\d+\}\{\d+\}\$?|\$\\frac\{\d+\}\{\d+\}\$|\$\d+\$|\d+(?:\.\d+)?)')


def require(condition, message):
    if not condition:
        raise ValueError(message)


def num(text):
    """A displayed quantity: 12, 2.75, $2\\frac{3}{4}$, $\\frac{1}{2}$ or $7$."""
    text = text.replace('$', '').strip()
    mixed = re.fullmatch(r'(\d+)\\frac\{(\d+)\}\{(\d+)\}', text)
    if mixed:
        return Fraction(int(mixed[1])) + Fraction(int(mixed[2]), int(mixed[3]))
    frac = re.fullmatch(r'\\frac\{(\d+)\}\{(\d+)\}', text)
    if frac:
        return Fraction(int(frac[1]), int(frac[2]))
    require(re.fullmatch(r'\d+(?:\.\d+)?', text) is not None, f'Unreadable quantity {text!r}')
    return Fraction(text)


def whole(value, message='Expected a whole number'):
    require(value.denominator == 1, message)
    return int(value)


def exact_root(value, power, message):
    """The rational power-th root of a positive Fraction, or fail."""
    require(value > 0, message)
    def root(n):
        r = round(n ** (1.0 / power))
        for candidate in (r - 1, r, r + 1):
            if candidate > 0 and candidate ** power == n:
                return candidate
        raise ValueError(message)
    return Fraction(root(value.numerator), root(value.denominator))


def match(pattern, text, message):
    found = re.fullmatch(pattern, text)
    require(found is not None, message)
    return found


def choice_options(public):
    response = public['response']
    require(response['kind'] == 'choice', 'Choice response required')
    options = response['options']
    require(len(options) == 4 and all(set(o) == {'id', 'label'} for o in options), 'Four public choices required')
    require(len({o['id'] for o in options}) == 4, 'Duplicate choice IDs')
    require(len({o['label'] for o in options}) == 4, 'Duplicate choice labels')
    return options


def number_response(public):
    require(public['response']['kind'] in ('number', 'fraction'), 'Numeric response required')


def money(text):
    return num(text)


# ---------------------------------------------------------------- percent chain

def solve_percent(prompt):
    p = prompt
    m = re.fullmatch(rf"A club's fee rose ({NUM})% in the first year\. In the second year the new fee rose ({NUM})%\. "
                     r'The fee after two years equals the original fee times one number\. What is that number\? Enter it as a decimal\.', p)
    if m:
        return (1 + num(m[1]) / 100) * (1 + num(m[2]) / 100)
    m = re.fullmatch(rf'The price of an? [\w -]+ was reduced by ({NUM})% for a sale\. Later the sale price was increased by ({NUM})%, '
                     rf'and the [\w -]+ now costs ({NUM}) dollars\. What was the price before the sale\? Enter the number of dollars\.', p)
    if m:
        return num(m[3]) / ((1 - num(m[1]) / 100) * (1 + num(m[2]) / 100))
    m = re.fullmatch(rf"A [\w' -]+ starts at ({NUM})\. In the first month it increases by ({NUM})%\. "
                     rf'In the second month it decreases by ({NUM})% of the new amount\. What is it at the end of the second month\?', p)
    if m:
        return num(m[1]) * (1 + num(m[2]) / 100) * (1 - num(m[3]) / 100)
    m = re.fullmatch(rf'A store marks an? [\w -]+ at ({NUM}) dollars and then lowers the price by ({NUM})%\. '
                     rf'The new price is ({NUM})% more than the price the store paid for the [\w -]+\. What did the store pay\? Enter the number of dollars\.', p)
    if m:
        return num(m[1]) * (1 - num(m[2]) / 100) / (1 + num(m[3]) / 100)
    raise ValueError('Percent chain wording must give every rate and its base')


# ------------------------------------------------------------------ conversions

def solve_conversion(prompt):
    m = re.fullmatch(rf'A rod is a unit of length equal to ({NUM}) yards\. How many inches long is ({NUM}) rods\?', prompt)
    if m:
        return num(m[1]) * num(m[2]) * 3 * 12
    m = re.fullmatch(rf'A ribbon is ({NUM}) meters long\. Each bow uses ({NUM}) centimeters of ribbon\. How many whole bows can be made\?', prompt)
    if m:
        return Fraction(floor(num(m[1]) * 100 / num(m[2])))
    m = re.fullmatch(r'Use these equivalents: 1 gallon = (\d+) quarts, 1 quart = (\d+) pints, 1 pint = (\d+) cups\. '
                     rf'A cooler holds ({NUM}) gallons of water\. How many (cups|pints) of water is that\?', prompt)
    if m:
        quarts, pints, cups = int(m[1]), int(m[2]), int(m[3])
        pint_count = num(m[4]) * quarts * pints
        return pint_count * cups if m[5] == 'cups' else pint_count
    raise ValueError('Conversion wording must state every equivalent')


# -------------------------------------------------------------- share remainder

def solve_share(template, prompt):
    if template == 'share-remainder-percent':
        m = match(rf'A survey asked ({NUM}) people how they get to work\. ({NUM})% drive, ({NUM})% take a bus and ({NUM})% walk\. '
                  r'The rest bike\. How many (more people drive than bike|of the \d+ people bike)\?', prompt, 'Survey wording')
        total = num(m[1])
        drive, bike = total * num(m[2]) / 100, total * (100 - num(m[2]) - num(m[3]) - num(m[4])) / 100
        require(bike > 0, 'The rest must be positive')
        if m[5].startswith('more'):
            return drive - bike
        require(num(re.search(r'of the (\d+) people', m[5])[1]) == total, 'Stated total must be repeated exactly')
        return bike
    m = re.fullmatch(rf'A [\w -]+ (?:earns|collects|picks) ({NUM}) [\w ]+ each (?:week|month|day)\. It puts ({NUM}) of each (?:week|month|day)\'s amount '
                     rf'toward the [\w ]+\. How many [\w ]+ go toward the [\w ]+ in ({NUM}) (?:weeks|months|days)\?', prompt)
    if m:
        return num(m[1]) * num(m[2]) * num(m[3])
    m = re.fullmatch(rf'Of the ({NUM}) ([\w ]+?) (?:in|on) the [\w ]+, ({NUM}) (?:were )?[\w ]+ and ({NUM}) (?:were )?[\w ]+\. The rest (?:were )?[\w ]+\. How many \2 (?:were )?[\w ]+\?', prompt)
    if m:
        rest = num(m[1]) * (1 - num(m[3]) - num(m[4]))
        require(rest > 0, 'The rest must be positive')
        return rest
    raise ValueError('Share wording must give every share')


# -------------------------------------------------------------------- purchases

def solve_purchase(prompt):
    m = re.fullmatch(rf"Sam's wallet holds ({NUM}) five-dollar bills, ({NUM}) one-dollar bills, ({NUM}) quarters, ({NUM}) dimes and ({NUM}) nickels\. "
                     rf'Sam buys a [\w -]+ for ({NUM}) dollars\. How much money does Sam have left\? Enter the amount in dollars\.', prompt)
    if m:
        c = [num(m[i]) for i in range(1, 6)]
        left = 5 * c[0] + c[1] + c[2] * Fraction(1, 4) + c[3] * Fraction(1, 10) + c[4] * Fraction(1, 20) - num(m[6])
        require(left >= 0, 'Purchase exceeds the wallet')
        return left
    m = re.fullmatch(rf'Mia buys an? [\w -]+ for ({NUM}) dollars and an? [\w -]+ for ({NUM}) dollars\. She has a coupon for ({NUM}) dollars off her total\. '
                     r'How much does Mia pay\? Enter the amount in dollars\.', prompt)
    if m:
        pay = num(m[1]) + num(m[2]) - num(m[3])
        require(pay > 0, 'Coupon cannot exceed the total')
        return pay
    words = {'one-half': Fraction(1, 2), 'one-third': Fraction(1, 3), 'one-fourth': Fraction(1, 4), 'one-fifth': Fraction(1, 5), 'one-tenth': Fraction(1, 10)}
    m = re.fullmatch(rf'[\w ]+ costs ({NUM}) dollars per yard\. Dara buys ({NUM}) yards of it, and the store takes ({NUM}%|one-[a-z]+) off the total\. '
                     r'How much does Dara pay\? Enter the amount in dollars\.', prompt)
    if m:
        rate = num(m[3][:-1]) / 100 if m[3].endswith('%') else words[m[3]]
        return num(m[1]) * num(m[2]) * (1 - rate)
    raise ValueError('Purchase wording must give every price, quantity and reduction')


# ------------------------------------------------------------ count relations

def solve_count(prompt):
    m = re.fullmatch(rf'A [\w ]+ sold ([\w ]+?) for ({NUM}) dollars each and ([\w ]+?) for ({NUM}) dollars each\. The equation '
                     rf'\$(\d+)p\+(\d+)q=(\d+)\$ gives the total value of the sales, in dollars, where \$p\$ is the number of ([\w ]+?) sold '
                     rf'and \$q\$ is the number of ([\w ]+?) sold\. ({NUM}) ([\w ]+?) (?:was|were) sold\. How many (.+?) (?:was|were) sold\?', prompt)
    if m:
        a, b = num(m[2]), num(m[4])
        require((a, b, m[1], m[3]) == (Fraction(m[5]), Fraction(m[6]), m[8], m[9]), 'Equation must match the stated prices and items')
        total, known, known_name, asked = Fraction(m[7]), num(m[10]), m[11], m[12]
        if known_name == m[8]:
            other = (total - a * known) / b
            others = (m[9], m[8])
        else:
            require(known_name == m[9], 'Known count must name one of the items')
            other = (total - b * known) / a
            others = (m[8], m[9])
        whole(other, 'The other count must be a whole number')
        require(other >= 0, 'Counts cannot be negative')
        if asked == 'items':
            return known + other
        require(asked == others[0], 'Asked item must be the one not given')
        return other
    # The "together" form ends "were sold in all" in the generator; accept its question wording.
    m = re.fullmatch(rf'A [\w ]+ sold ([\w ]+?) for ({NUM}) dollars each and ([\w ]+?) for ({NUM}) dollars each\. The equation '
                     rf'\$(\d+)p\+(\d+)q=(\d+)\$ gives the total value of the sales, in dollars, where \$p\$ is the number of ([\w ]+?) sold '
                     rf'and \$q\$ is the number of ([\w ]+?) sold\. ({NUM}) ([\w ]+?) (?:was|were) sold\. How many items were sold in all\?', prompt)
    if m:
        a, b = num(m[2]), num(m[4])
        total, known, known_name = Fraction(m[7]), num(m[10]), m[11]
        other = ((total - a * known) / b) if known_name == m[8] else ((total - b * known) / a)
        whole(other)
        require(other >= 0, 'Counts cannot be negative')
        return known + other
    m = re.fullmatch(rf'(\w+) has ({NUM}) times as many ([\w ]+?) as (\w+)\. \1 has ({NUM}) more \3 than \4\. How many \3 '
                     r'(?:does (\w+) have|do they have together)\?', prompt)
    if m:
        k, d = num(m[2]), num(m[5])
        require(k > 1, 'Multiplier must exceed 1')
        small = d / (k - 1)
        whole(small, 'Counts must be whole')
        big = small * k
        if 'together' in prompt:
            return small + big
        require(m[6] in (m[1], m[4]), 'Asked person must be named')
        return big if m[6] == m[1] else small
    raise ValueError('Count relation wording must give both relations')


# ------------------------------------------------------------- similar solids

def solve_solid(prompt):
    m = re.fullmatch(rf'Two similar rectangular prisms have (surface areas|volumes) ({NUM}) (?:square|cubic) centimeters and ({NUM}) (?:square|cubic) centimeters\. '
                     rf'The (larger|smaller) prism has (volume|surface area) ({NUM}) (?:square|cubic) centimeters\. '
                     r'What is the (volume|surface area|total volume) of the (larger|smaller|two) prisms?, in (?:square|cubic) centimeters\?', prompt)
    require(m is not None, 'Solid wording must give the pair, the known prism and the target')
    pair_kind, first, second = m[1], num(m[2]), num(m[3])
    small, large = sorted((first, second))
    require(small < large, 'The two prisms must differ')
    if pair_kind == 'surface areas':
        require(m[5] == 'volume', 'Given and pair must be different measures')
        scale = exact_root(small / large, 2, 'Surface-area ratio must be a rational square')   # small/large lengths
        volume_ratio = scale ** 3
        side_ratio = volume_ratio
    else:
        require(m[5] == 'surface area', 'Given and pair must be different measures')
        scale = exact_root(small / large, 3, 'Volume ratio must be a rational cube')
        side_ratio = scale ** 2
    known = num(m[6])
    unit_small = m[4] == 'smaller'
    small_value = known if unit_small else known * side_ratio
    large_value = known / side_ratio if unit_small else known
    if m[7] == 'total volume':
        require(m[5] == 'volume', 'Total volume needs a volume given')
        return small_value + large_value
    require(m[7] == ('surface area' if pair_kind == 'volumes' else 'volume'), 'Target must be the measure not paired')
    other = 'larger' if unit_small else 'smaller'
    require(m[8] == other, 'Target prism must be the other one')
    return large_value if other == 'larger' else small_value


# --------------------------------------------------------------------- fee chain

def solve_fee_number(prompt):
    m = re.fullmatch(rf'(\w+) Bank charges ({NUM}) dollars? a month plus ({NUM}) dollars for each overdraft\. (\w+) Bank charges ({NUM}) dollars? a month plus ({NUM}) '
                     rf'dollars for each overdraft\. Over ({NUM}) months, a customer has ({NUM}) overdrafts at \1 Bank and ({NUM}) overdrafts at \4 Bank\. '
                     r'How many more dollars in fees does the customer pay at \4 Bank than at \1 Bank\?', prompt)
    if m:
        months = num(m[7])
        first = num(m[2]) * months + num(m[3]) * num(m[8])
        second = num(m[5]) * months + num(m[6]) * num(m[9])
        require(second > first, '"More" requires a positive difference')
        return second - first
    m = re.fullmatch(rf'A [\w ]+ (?:melts|drains|burns)(?: down)? ({NUM}) [\w]+ every ({NUM}) [\w]+\. It starts at ({NUM}) [\w]+ and is measured again when it reaches '
                     r'({NUM}) [\w]+\. How many [\w]+ pass\?'.replace('({NUM})', f'({NUM})'), prompt)
    if m:
        drop = num(m[3]) - num(m[4])
        require(drop > 0, 'Quantity must fall')
        return drop / num(m[1]) * num(m[2])
    m = re.fullmatch(rf'A [\w ]+ charges a flat fee of ({NUM}) dollars that covers the first ({NUM}) hours, plus a fixed charge for each hour after that\. '
                     rf'A booking of ({NUM}) hours costs ({NUM}) dollars in all\. How many dollars does a booking of ({NUM}) hours cost\?', prompt)
    if m:
        fee, covered, hours, cost, target = (num(m[i]) for i in range(1, 6))
        require(hours > covered and target >= covered, 'The sample booking must pass the covered hours')
        rate = (cost - fee) / (hours - covered)
        return fee + rate * (target - covered)
    raise ValueError('Fee wording must give the fee, rate or sample and target')


class Linear(ast.NodeVisitor):
    """Evaluate +, -, *, parentheses and one variable exactly."""

    def __init__(self, variable, value):
        self.variable, self.value = variable, value

    def visit_Expression(self, node):
        return self.visit(node.body)

    def visit_Constant(self, node):
        return Fraction(str(node.value))

    def visit_Name(self, node):
        require(node.id == self.variable, f'Unknown name {node.id}')
        return Fraction(self.value)

    def visit_UnaryOp(self, node):
        require(isinstance(node.op, (ast.USub, ast.UAdd)), 'Unsupported unary')
        value = self.visit(node.operand)
        return -value if isinstance(node.op, ast.USub) else value

    def visit_BinOp(self, node):
        left, right = self.visit(node.left), self.visit(node.right)
        if isinstance(node.op, ast.Add):
            return left + right
        if isinstance(node.op, ast.Sub):
            return left - right
        if isinstance(node.op, ast.Mult):
            return left * right
        if isinstance(node.op, ast.Div):
            require(right != 0, 'Division by zero')
            return left / right
        raise ValueError('Unsupported operator')

    def generic_visit(self, node):
        raise ValueError(f'Unsupported syntax {type(node).__name__}')


def tex_value(text, variable, value):
    """Evaluate displayed TeX arithmetic such as 2(h-3)+25 or (64\\div2)\\times4."""
    s = text.replace('\\times', '*').replace('\\div', '/').replace('−', '-').replace('\\cdot', '*').replace('$', '')
    s = re.sub(r'\s+', '', s)
    s = re.sub(r'(\d|\))(?=[a-z(])', r'\1*', s)
    s = re.sub(r'([a-z])(?=\d|\()', r'\1*', s)
    s = re.sub(r'(?<![\w.])(\d+\.?\d*)', r'\1', s)
    require(re.fullmatch(r'[0-9a-z+\-*/().]*', s) is not None, f'Unreadable expression {text!r}')
    return Linear(variable, value).visit(ast.parse(s, mode='eval'))


RELATIONS = {'\\lt': '<', '\\gt': '>', '\\le': '<=', '\\ge': '>=', '\\leq': '<=', '\\geq': '>=', '<': '<', '>': '>'}


def split_inequality(label):
    s = label.replace('$', '')
    m = re.fullmatch(r'(.+?)(\\leq|\\geq|\\lt|\\gt|\\le|\\ge)(.+)', s)
    require(m is not None, f'Unreadable inequality {label!r}')
    return m[1], RELATIONS[m[2]], m[3]


def holds(relation, left, right):
    return {'<': left < right, '>': left > right, '<=': left <= right, '>=': left >= right}[relation]


def solve_fee_choice(template, public):
    prompt, options = public['prompt'], choice_options(public)
    if template == 'fee-rule-choice':
        m = re.fullmatch(rf'A [\w ]+ charges a flat fee of ({NUM}) dollars that covers the first ({NUM}) hours, plus (?:({NUM}) dollars for each hour after that|'
                         rf'a fixed charge for each hour after that\. A booking of ({NUM}) hours costs ({NUM}) dollars in all)\. '
                         rf'Which equation gives the total charge \$C\$, in dollars, for a booking of \$h\$ hours, where \$h\$ is at least ({NUM})\?', prompt)
        require(m is not None, 'Fee rule wording must give the fee, covered hours and rate or one sample')
        fee, covered = num(m[1]), num(m[2])
        require(num(m[6]) == covered, 'Domain bound must equal the covered hours')
        if m[3]:
            rate = num(m[3])
        else:
            require(num(m[4]) > covered, 'Sample booking must pass the covered hours')
            rate = (num(m[5]) - fee) / (num(m[4]) - covered)
        def truth(h):
            return fee + rate * (h - covered)
        correct = []
        for option in options:
            label = option['label']
            side = re.fullmatch(r'\$C=(.+)\$', label)
            require(side is not None, f'Rule option must be an equation for C: {label}')
            if all(tex_value(side[1], 'h', h) == truth(h) for h in (covered, covered + 1, covered + 7, Fraction(1, 2) + covered)):
                correct.append(option['id'])
        require(len(correct) == 1, 'Exactly one rule must match the stated charges')
        return correct[0]
    m = re.fullmatch(rf'A [\w ]+ charges an? [\w ]+ fee of ({NUM}) dollars plus ({NUM}) dollars per [\w ]+\. The total cost must stay (under|at or under) a budget of ({NUM}) dollars\. '
                     r'Which (?:inequality describes the number of [\w ]+, \$x\$, that fit|describes every number of [\w ]+, \$x\$, that fits) the budget\?', prompt)
    require(m is not None, 'Budget wording must give the fee, rate, bound type and budget')
    fee, rate, budget = num(m[1]), num(m[2]), num(m[4])
    strict = m[3] == 'under'
    def true_set(x):
        cost = fee + rate * x
        return cost < budget if strict else cost <= budget
    sets, correct = {}, []
    for option in options:
        left, relation, right = split_inequality(option['label'])
        profile = tuple(holds(relation, tex_value(left, 'x', x), tex_value(right, 'x', x)) for x in range(0, 400))
        sets[option['id']] = profile
        if profile == tuple(true_set(x) for x in range(0, 400)):
            correct.append(option['id'])
    require(len(set(sets.values())) == 4, 'Two inequalities describe the same counts')
    require(len(correct) == 1, 'Exactly one inequality must match the budget')
    return correct[0]


# --------------------------------------------------------------- linked equations

def equations(label):
    parts = label.replace('$', '').split(' and ')
    out = []
    for part in parts:
        m = re.fullmatch(r'(.+)=([a-z])', part.strip())
        require(m is not None, f'Unreadable equation {part!r}')
        out.append((m[1], m[2]))
    return out


def solve_linked(template, public):
    prompt, options = public['prompt'], choice_options(public)
    pair = 'Which pair of equations' in prompt
    require(pair or 'Which equation finds' in prompt, 'Prompt must say how many equations')
    if template == 'linked-time-equations':
        m = re.fullmatch(rf'A [\w ]+ is ({NUM}) minutes long\. (?:The [\w ]+ (?:talks|warms up) for ({NUM}) minutes and then (?:the [\w ]+ )?(?:work|plays?) for ({NUM}) minutes|'
                         rf'The first part lasts ({NUM}) minutes and the second part lasts ({NUM}) minutes)\. How many minutes of the [\w ]+ are left\? '
                         r'Let \$a\$ be the minutes left after the first part and \$m\$ the answer\. Which (?:pair of equations|equation) finds the answer\?', prompt)
        require(m is not None, 'Time wording must give the whole and both parts')
        total = num(m[1])
        first, second = (num(m[2]), num(m[3])) if m[2] else (num(m[4]), num(m[5]))
        mid, final, variable_mid, variable_final = total - first, total - first - second, 'a', 'm'
    else:
        m = re.fullmatch(rf'A [\w ]+ of ({NUM}) [\w ]+ is split into two equal groups\. Each group is then shared equally among ({NUM}) [\w ]+\. How many [\w ]+ (?:at|on) each [\w ]+\? '
                         r'Let \$a\$ be the number in each group and \$t\$ the answer\. Which (?:pair of equations|equation) finds the answer\?', prompt)
        if m:
            mid = num(m[1]) / 2
            final, variable_mid, variable_final = mid / num(m[2]), 'a', 't'
        else:
            m = re.fullmatch(rf'({NUM}) [\w ]+ are shared equally among ({NUM}) [\w ]+\. How many [\w ]+ are in ({NUM}) of the [\w ]+\? '
                             r'Let \$v\$ be the number in one of the [\w ]+ and \$f\$ the answer\. Which (?:pair of equations|equation) finds the answer\?', prompt)
            require(m is not None, 'Division wording must give the total and both counts')
            mid = num(m[1]) / num(m[2])
            final, variable_mid, variable_final = mid * num(m[3]), 'v', 'f'
        whole(mid, 'Intermediate quantity must be whole')
    whole(final, 'Final quantity must be whole')
    require(final >= 0 and mid >= 0, 'Quantities cannot be negative')
    correct = []
    for option in options:
        eqs = equations(option['label'])
        if pair:
            require(len(eqs) == 2, 'A pair option has two equations')
            (e1, v1), (e2, v2) = eqs
            require((v1, v2) == (variable_mid, variable_final), 'Pair must define the stated variables in order')
            first_value = tex_value(e1, 'z', 0) if 'z' not in e1 else None
            if first_value == mid and tex_value(e2, variable_mid, first_value) == final:
                correct.append(option['id'])
        else:
            require(len(eqs) == 1 and eqs[0][1] == variable_final, 'A single option defines the answer variable')
            if tex_value(eqs[0][0], 'z', 0) == final:
                correct.append(option['id'])
    require(len(correct) == 1, 'Exactly one equation form must give the stated chain')
    return correct[0]


# --------------------------------------------------------------- geometry/models

def solve_perimeter(prompt):
    m = re.fullmatch(rf'A square [\w ]+ has a perimeter of ({NUM}) [\w]+\. What is its area, in square [\w]+\?', prompt)
    if m:
        return (num(m[1]) / 4) ** 2
    m = re.fullmatch(rf'A square [\w ]+ has an area of ({NUM}) square [\w]+\. What is its perimeter, in [\w]+\?', prompt)
    if m:
        return 4 * exact_root(num(m[1]), 2, 'Square area must have a rational side')
    m = re.fullmatch(rf'A rectangular [\w ]+ has an area of ({NUM}) square [\w]+ and a width of ({NUM}) [\w]+\. What is its perimeter, in [\w]+\?', prompt)
    if m:
        width = num(m[2])
        length = num(m[1]) / width
        return 2 * (length + width)
    m = re.fullmatch(rf'A rectangular [\w ]+ has a perimeter of ({NUM}) [\w]+ and a width of ({NUM}) [\w]+\. What is its area, in square [\w]+\?', prompt)
    if m:
        width = num(m[2])
        length = num(m[1]) / 2 - width
        require(length > 0, 'Length must be positive')
        return length * width
    raise ValueError('Perimeter and area wording must give the shape and one measure')


def round_tenth(value):
    scaled = value * 10
    require(scaled.denominator != 2, 'Rounding tie to the nearest tenth')
    return Fraction(floor(scaled + Fraction(1, 2)), 10)


def solve_quadratic(prompt):
    m = re.fullmatch(rf'A ball is dropped from a platform ({NUM}) (meters|feet) above the ground\. Its height after \$t\$ seconds is \$h=-({NUM})t\^2\+c\$, '
                     r'where \$c\$ is a constant and \$h\$ is in (meters|feet)\. After how many seconds does the ball reach the ground\?', prompt)
    if m:
        require(m[2] == m[4], 'Units must agree')
        return exact_root(num(m[1]) / num(m[3]), 2, 'Landing time must be rational')
    m = re.fullmatch(rf"A ball's height, in (meters|feet), is a quadratic function of its horizontal distance \$x\$, in (meters|feet), from the thrower\. "
                     rf'Its highest point is ({NUM}) (meters|feet), reached at \$x=({NUM})\$, and it lands at \$x=({NUM})\$\. '
                     rf'How high is the ball at \$x=(-?{NUM})\$\? Round to the nearest tenth\.', prompt)
    if m:
        require(m[1] == m[2] == m[4], 'Units must agree')
        peak, vertex, landing = num(m[3]), num(m[5]), num(m[6])
        x = -num(m[7][1:]) if m[7].startswith('-') else num(m[7])
        require(landing > vertex, 'Landing must be after the vertex')
        require(x >= 0, 'Distance from the thrower cannot be negative')
        a = -peak / (landing - vertex) ** 2
        return round_tenth(peak + a * (x - vertex) ** 2)
    raise ValueError('Model wording must give the constants and the question')


def solve_totals(template, prompt):
    if template == 'bag-totals-chain':
        m = re.fullmatch(rf'A collection has ({NUM}) [\w ]+\. ({NUM}) are [\w ]+ and ({NUM}) are [\w ]+\. The rest are [\w ]+\. How many [\w ]+ are [\w ]+\?', prompt)
        if m:
            rest = num(m[1]) - num(m[2]) - num(m[3])
        else:
            m = re.fullmatch(rf'One of the [\w ]+ holds ({NUM}) [\w ]+ and another holds ({NUM}) [\w ]+\. Nia pours both [\w ]+ out together and sets aside ({NUM}) '
                             r'of the [\w ]+ that are broken\. How many [\w ]+ are not set aside\?', prompt)
            require(m is not None, 'Totals wording must give the whole and both parts')
            rest = num(m[1]) + num(m[2]) - num(m[3])
        require(rest > 0, 'The rest must be positive')
        return rest
    m = re.fullmatch(rf'A [\w ]+ measures ({NUM}) [\w]+ in all\. (?:The first part|One piece|Dev uses|[\w ]+?) (?:measures )?({NUM}) [\w]+ and (?:the second part measures|another piece measures|[\w ]+? uses|Ana uses) '
                     r'({NUM}) [\w]+\. How many [\w]+ remain\? Enter the answer as .+\.'.replace('({NUM})', f'({NUM})'), prompt)
    require(m is not None, 'Totals wording must give the whole and both parts')
    rest = num(m[1]) - num(m[2]) - num(m[3])
    require(rest > 0, 'The rest must be positive')
    return rest


# ---------------------------------------------------------------------- driver

def solve(public):
    template, prompt = public['templateId'], public['prompt']
    require(template in SUPPORTED, 'Unexpected chain template')
    require(public.get('figure') is None, 'Chain tasks carry no figure')
    if template in CHOICE_REVIEW:
        return solve_fee_choice(template, public) if template in FEE_CHOICE else solve_linked(template, public)
    number_response(public)
    if template in PERCENT:
        return solve_percent(prompt)
    if template in CONVERSION:
        return solve_conversion(prompt)
    if template in SHARE:
        return solve_share(template, prompt)
    if template in PURCHASE:
        return solve_purchase(prompt)
    if template in COUNT:
        return solve_count(prompt)
    if template in SOLID:
        return solve_solid(prompt)
    if template in FEE_NUMBER:
        return solve_fee_number(prompt)
    if template in PERIMETER:
        return solve_perimeter(prompt)
    if template in QUADRATIC:
        return solve_quadratic(prompt)
    return solve_totals(template, prompt)


TOKEN = re.compile(r'(?<![\d.])\d+(?:\.\d+)?(?!\.?\d)')


def review_problem(problem):
    """Checks the keyed answer type, leakage and the one-correct-choice rule."""
    public = problem['public']
    expected = solve(public)
    answer = problem['answer']
    if public['response']['kind'] == 'choice':
        require(answer in {o['id'] for o in public['response']['options']}, 'Answer must be an option ID')
        require(answer == expected, 'Choice answer key mismatch')
        correct_label = next(o['label'] for o in public['response']['options'] if o['id'] == answer)
        hint = problem['hint']
        require(correct_label not in hint and correct_label.replace('$', '') not in hint, 'Hint leaks the correct choice')
        feedback = problem.get('choiceFeedback') or {}
        require(answer not in feedback, 'Feedback is for wrong choices only')
        require(set(feedback) == {o['id'] for o in public['response']['options']} - {answer}, 'Every wrong choice needs its own feedback')
        for text in feedback.values():
            require(correct_label not in text, 'Feedback leaks the correct choice')
    else:
        require(Fraction(answer) == expected, 'Chain answer key mismatch')
        # A hint may restate a given, never the final answer.
        given_numbers = {Fraction(t) for t in TOKEN.findall(public['prompt'].replace('\\frac', ' '))}
        value = Fraction(answer)
        if value not in given_numbers and value.denominator == 1 and value > 9:
            # Percent signs are rates, and the first sentence may name a first
            # step whose value happens to equal the answer.
            hint = re.sub(r'\d+(?:\.\d+)?%', '', problem['hint'])
            later = hint.split('. ', 1)[1] if '. ' in hint else ''
            require(str(int(value)) not in TOKEN.findall(later), 'Hint gives the final answer')
    return expected


def self_test():
    base = {
        'templateId': 'percent-chain', 'skillId': 'percent-change', 'seed': 'x', 'id': 'x', 'templateVersion': 1,
        'response': {'kind': 'number', 'label': 'Answer'},
    }
    def number_case(template, prompt, answer, hint='Start with the first step.'):
        public = dict(base, templateId=template, prompt=prompt)
        return {'public': public, 'answer': answer, 'hint': hint}
    def choice_case(template, prompt, labels, answer, hint='Start with the first step.'):
        options = [{'id': f'option-{c}', 'label': label} for c, label in zip('abcd', labels)]
        public = dict(base, templateId=template, prompt=prompt, response={'kind': 'choice', 'label': 'Choose one answer', 'options': options})
        feedback = {o['id']: 'Wrong.' for o in options if o['id'] != answer}
        return {'public': public, 'answer': answer, 'hint': hint, 'choiceFeedback': feedback}

    good = [
        number_case('percent-chain', "A club's membership starts at 1150. In the first month it increases by 20%. In the second month it decreases by 50% of the new amount. What is it at the end of the second month?", '690'),
        number_case('conversion-chain-story', 'Use these equivalents: 1 gallon = 4 quarts, 1 quart = 2 pints, 1 pint = 2 cups. A cooler holds 2.5 gallons of water. How many cups of water is that?', '40'),
        number_case('conversion-chain-story', 'A ribbon is $2\\frac{3}{4}$ meters long. Each bow uses 20 centimeters of ribbon. How many whole bows can be made?', '13'),
        number_case('share-remainder-percent', 'A survey asked 120 people how they get to work. 55% drive, 10% take a bus and 25% walk. The rest bike. How many of the 120 people bike?', '12'),
        number_case('wallet-purchase-chain', "Sam's wallet holds 5 five-dollar bills, 4 one-dollar bills, 2 quarters, 5 dimes and 8 nickels. Sam buys a book for 22.85 dollars. How much money does Sam have left? Enter the amount in dollars.", '7.55'),
        number_case('mixed-quantity-discount', 'Canvas costs 19.80 dollars per yard. Dara buys $5\\frac{3}{4}$ yards of it, and the store takes 20% off the total. How much does Dara pay? Enter the amount in dollars.', '91.08'),
        number_case('count-relation-chain', 'Dev has 3 times as many stamps as Lia. Dev has 8 more stamps than Lia. How many stamps do they have together?', '16'),
        number_case('similar-solid-scale-chain', 'Two similar rectangular prisms have surface areas 224 square centimeters and 350 square centimeters. The smaller prism has volume 128 cubic centimeters. What is the volume of the larger prism, in cubic centimeters?', '250'),
        number_case('fee-plan-chain', 'Harbor Bank charges 1.25 dollars a month plus 9.50 dollars for each overdraft. Summit Bank charges 2.50 dollars a month plus 6.75 dollars for each overdraft. Over 8 months, a customer has 4 overdrafts at Harbor Bank and 5 overdrafts at Summit Bank. How many more dollars in fees does the customer pay at Summit Bank than at Harbor Bank?', '5.75'),
        number_case('perimeter-area-chain', 'A rectangular banner has an area of 160 square inches and a width of 10 inches. What is its perimeter, in inches?', '52'),
        number_case('quadratic-model-chain', 'A ball is dropped from a platform 245 meters above the ground. Its height after $t$ seconds is $h=-5t^2+c$, where $c$ is a constant and $h$ is in meters. After how many seconds does the ball reach the ground?', '7'),
        number_case('bag-totals-chain', 'A collection has 909 beads. 338 are red and 333 are blue. The rest are yellow. How many beads are yellow?', '238'),
        choice_case('fee-rule-choice', 'A practice court charges a flat fee of 25 dollars that covers the first 3 hours, plus a fixed charge for each hour after that. A booking of 6 hours costs 31 dollars in all. Which equation gives the total charge $C$, in dollars, for a booking of $h$ hours, where $h$ is at least 3?',
                    ['$C=h+22$', '$C=2h+19$', '$C=2h-6$', '$C=2h+25$'], 'option-b'),
        choice_case('fee-budget-inequality', 'A banquet hall charges a room fee of 60 dollars plus 2 dollars per guest. The total cost must stay under a budget of 90 dollars. Which inequality describes the number of guests, $x$, that fit the budget?',
                    ['$2x\\lt90$', '$60+2x\\gt90$', '$2+60x\\lt90$', '$60+2x\\lt90$'], 'option-d'),
        choice_case('linked-time-equations', 'A movie is 100 minutes long. The first part lasts 16 minutes and the second part lasts 55 minutes. How many minutes of the movie are left? Let $a$ be the minutes left after the first part and $m$ the answer. Which pair of equations finds the answer?',
                    ['$16+55=a$ and $a-100=m$', '$100-16=a$ and $a+55=m$', '$100-16=a$ and $a-55=m$', '$100+16=a$ and $a-55=m$'], 'option-c'),
        choice_case('linked-division-equations', 'A club of 64 members is split into two equal groups. Each group is then shared equally among 4 tables. How many members at each table? Let $a$ be the number in each group and $t$ the answer. Which equation finds the answer?',
                    ['$(64\\div2)\\times4=t$', '$(64\\div2)\\div4=t$', '$(64-2)\\div4=t$', '$(64\\times2)\\div4=t$'], 'option-b'),
    ]
    for case in good:
        review_problem(case)
    rejected = 0
    def reject(case):
        nonlocal rejected
        try:
            review_problem(case)
        except ValueError:
            rejected += 1
            return
        raise ValueError('Corrupted chain case passed review')
    for case in good:
        bad = copy.deepcopy(case)
        if bad['public']['response']['kind'] == 'choice':
            wrong = next(o['id'] for o in bad['public']['response']['options'] if o['id'] != bad['answer'])
            bad['answer'] = wrong
        else:
            bad['answer'] = str(Fraction(bad['answer']) + 1)
        reject(bad)
    # A missing given: the percent chain names no second rate.
    reject(number_case('percent-chain', "A club's membership starts at 1150. In the first month it increases by 20%. What is it at the end of the second month?", '1380'))
    # Two options with the same meaning.
    duplicate = copy.deepcopy(good[13])
    duplicate['public']['response']['options'][0]['label'] = '$60+2x\\lt90$ '
    reject(duplicate)
    # The hint leaks the answer.
    reject(number_case('bag-totals-chain', good[11]['public']['prompt'], '238', 'Add the red and blue beads. The answer is 238.'))
    require(rejected == len(good) + 3, 'Chain oracle self-test did not reject every corrupted case')
