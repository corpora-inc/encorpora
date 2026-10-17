"""Independent exact answers for equal-group stories, derived only from public givens."""
import re
from oracle_wording import tolerant
from fractions import Fraction

EQUAL_GROUPS = frozenset({
    'full-kits', 'seats-needed', 'kit-leftovers', 'share-whole-items',
    'measure-whole-pieces', 'small-array-total', 'pairing-leftover',
    'equal-tray-total', 'unknown-group-size', 'unknown-dividend',
    'split-array-part', 'nested-bag-total', 'zero-one-groups',
    'comparison-amount', 'comparison-factor', 'delivery-then-use',
    'purchase-change', 'factor-partner', 'tens-contribution',
    'neighbor-product-change',
})


def require(condition, message):
    if not condition:
        raise ValueError(message)


def counts(pattern, prompt):
    match = re.fullmatch(tolerant(pattern), prompt)
    require(match is not None, 'Ambiguous or unsupported equal-groups wording')
    return tuple(int(value) for value in match.groups())


def grouped(figure, total, size, unit):
    require(figure == {'kind': 'grouped-counters', 'total': total,
                       'groupSize': size, 'unit': unit},
            'Visible counter groups contradict the story or its unit')
    require(0 < total <= 64 and 2 <= size <= 8 and (total + size - 1) // size <= 8,
            'Grouped counters exceed visible renderer capacity')


def array(figure):
    require(figure is not None and figure['kind'] == 'unit-array', 'Unit-square array required')
    rows, columns = figure['rows'], figure['columns']
    require(type(rows) is int and type(columns) is int and 1 <= rows <= 10 and 1 <= columns <= 10,
            'Array dimensions must be visible positive integer counts')
    split = figure.get('splitAfterRow')
    require(split is None or type(split) is int and 0 < split < rows,
            'Array split must create two disjoint nonempty row regions')
    require(set(figure) <= {'kind', 'rows', 'columns', 'splitAfterRow'}, 'Unexpected array semantics')
    return rows, columns, split


def whole_division(total, divisor):
    require(total >= 0 and divisor > 0, 'Invalid whole-item division domain')
    result = Fraction(total, divisor)
    require(result.denominator == 1, 'A supposedly exact whole-item share is fractional')
    return result


def solve_equal_groups(public):
    """No private answer, explanation, seed reconstruction or generator import is used."""
    template, prompt = public['templateId'], public['prompt']
    require(template in EQUAL_GROUPS and public['response']['kind'] == 'number',
            'Unsupported family or response kind')
    figure = public.get('figure')
    diagram_families = {'full-kits', 'seats-needed', 'kit-leftovers', 'small-array-total',
                        'pairing-leftover', 'equal-tray-total', 'split-array-part',
                        'comparison-factor', 'neighbor-product-change'}
    require(template in diagram_families or figure is None, 'Unexpected diagram for a text-only story')
    if template in {'full-kits', 'kit-leftovers'}:
        question = (r'How many full kits can you make\?' if template == 'full-kits' else
                    r'After making as many full kits as possible, how many beads are left\?')
        total, size = counts(r'You have ([0-9]+) beads\. Each full kit needs exactly ([0-9]+) beads\. ' + question, prompt)
        require(total > 0 and size > 1, 'Invalid kit counts')
        grouped(figure, total, size, 'beads')
        quotient, remainder = divmod(total, size)
        return quotient if template == 'full-kits' else remainder
    if template == 'seats-needed':
        total, seats = counts(r'([0-9]+) visitors need rides\. Each van seats ([0-9]+) visitors\. What is the fewest vans needed\?', prompt)
        require(total > 0 and seats > 1, 'Visitors and van capacity must be positive')
        grouped(figure, total, seats, 'visitors')
        # Count capacity until everyone is seated; validate minimality independently.
        vans = 0
        while vans * seats < total:
            vans += 1
        require((vans - 1) * seats < total <= vans * seats, 'Vehicle count is not minimal')
        return vans
    if template == 'share-whole-items':
        total, trays = counts(r'Share ([0-9]+) counters equally among ([0-9]+) trays\. How many counters belong on each tray\?', prompt)
        require(total > 0 and trays >= 2, 'Sharing needs positive stock and nonzero trays')
        return whole_division(total, trays)
    if template == 'measure-whole-pieces':
        length, size = counts(r'A ribbon is ([0-9]+) cm long\. Cut it into pieces exactly ([0-9]+) cm long\. How many pieces will you have\?', prompt)
        require(length > 0 and size > 0, 'Ribbon lengths must be positive')
        return whole_division(length, size)
    if template == 'small-array-total':
        require(prompt == 'How many unit squares are in the whole array?', 'Wrong array question')
        rows, columns, split = array(figure)
        require(rows <= 5 and columns <= 5 and split is None, 'Small-array scope or partition mismatch')
        return sum(columns for _ in range(rows))
    if template == 'pairing-leftover':
        total, = counts(r'Put ([0-9]+) counters into pairs\. How many counters will be left without a partner\?', prompt)
        require(1 <= total <= 20, 'Pairing scope is one through twenty')
        if figure is not None:
            grouped(figure, total, 2, 'counters')
        while total >= 2:
            total -= 2
        return total
    if template in {'equal-tray-total', 'zero-one-groups'}:
        trays, each = counts(r'There are ([0-9]+) trays with ([0-9]+) counters on each tray\. How many counters are there altogether\?', prompt)
        require(trays >= 0 and each >= 0, 'Negative groups or items are impossible')
        if template == 'equal-tray-total':
            require(trays >= 2 and each >= 2, 'Visible equal trays need nonempty groups')
            grouped(figure, trays * each, each, 'counters')
        else:
            require(0 in (trays, each) or 1 in (trays, each), 'Zero/one family needs a special factor')
        return sum(each for _ in range(trays))
    if template == 'unknown-group-size':
        groups, total = counts(r'([0-9]+) equal bags hold ([0-9]+) marbles altogether\. How many marbles are in each bag\?', prompt)
        require(groups >= 2 and total > 0, 'Invalid marble sharing counts')
        return whole_division(total, groups)
    if template == 'unknown-dividend':
        divisor, quotient = counts(r'\? ÷ ([0-9]+) = ([0-9]+)\. What number belongs in the blank\?', prompt)
        require(divisor > 0 and quotient >= 0, 'Division by zero or negative count')
        return sum(divisor for _ in range(quotient))
    if template == 'split-array-part':
        match = re.fullmatch(r'The array is split into regions A and B\. How many unit squares are in region ([AB])\?', prompt)
        require(match is not None, 'Missing named array region')
        rows, columns, split = array(figure)
        require(split is not None, 'Partial-product question needs a visible split')
        # Public unit-array convention labels the top region A and bottom region B.
        selected_rows = range(0, split) if match[1] == 'A' else range(split, rows)
        return sum(columns for _ in selected_rows)
    if template == 'nested-bag-total':
        crates, bags, balls = counts(r'There are ([0-9]+) crates\. Each crate has ([0-9]+) bags, and each bag holds ([0-9]+) balls\. How many balls are there\?', prompt)
        require(min(crates, bags, balls) > 0, 'Nested groups must be nonempty')
        return sum(sum(balls for _ in range(bags)) for _ in range(crates))
    if template == 'comparison-amount':
        smaller, multiplier = counts(r'Mia has ([0-9]+) tokens\. Sam has ([0-9]+) times as many tokens as Mia\. How many tokens does Sam have\?', prompt)
        require(smaller > 0 and multiplier >= 2, 'Multiplicative comparison scope')
        return sum(smaller for _ in range(multiplier))
    if template == 'comparison-factor':
        smaller, larger = counts(r'Mia has ([0-9]+) tokens\. Sam has ([0-9]+) tokens\. Sam has how many times as many tokens as Mia\?', prompt)
        require(0 < smaller < larger, 'Comparison requires a positive reference quantity')
        require(figure == {'kind': 'bar-chart', 'categories': ['Mia', 'Sam'],
                           'values': [smaller, larger], 'valueLabel': 'Tokens'},
                'Comparison chart contradicts named amounts')
        return whole_division(larger, smaller)
    if template == 'delivery-then-use':
        boxes, each, used = counts(r'A class gets ([0-9]+) boxes with ([0-9]+) pencils in each\. It uses ([0-9]+) pencils\. How many pencils remain\?', prompt)
        stock = sum(each for _ in range(boxes))
        require(boxes > 0 and each > 0 and 0 <= used <= stock, 'Cannot use more pencils than delivered')
        return stock - used
    if template == 'purchase-change':
        items, price, payment = counts(r'Buy ([0-9]+) notebooks at ([0-9]+) dollars each\. Pay ([0-9]+) dollars\. How many dollars of change should you receive\?', prompt)
        cost = sum(price for _ in range(items))
        require(items > 0 and price > 0 and payment >= cost, 'Payment must cover the complete purchase')
        return payment - cost
    if template == 'factor-partner':
        product, factor, repeated_product = counts(r'One factor of ([0-9]+) is ([0-9]+)\. What is its partner in a factor pair with product ([0-9]+)\?', prompt)
        require(product == repeated_product and 1 <= product <= 100 and factor >= 1, 'Inconsistent factor-pair product')
        return whole_division(product, factor)
    if template == 'tens-contribution':
        number, multiplier, repeated_number, tens, ones = counts(r'To find ([0-9]+) × ([0-9]+), split ([0-9]+) into ([0-9]+) \+ ([0-9]+)\. What is the tens partial product\?', prompt)
        require(number == repeated_number and 10 <= number <= 99 and 1 <= multiplier <= 9 and
                tens == number // 10 * 10 and ones == number % 10,
                'Expanded form must preserve the original two-digit number and place values')
        return sum(tens for _ in range(multiplier))
    if template == 'neighbor-product-change':
        before, after, columns = counts(r'An array grows from ([0-9]+) rows to ([0-9]+) rows, with ([0-9]+) squares per row\. How many squares were added\?', prompt)
        rows, visible_columns, split = array(figure)
        require(after == before + 1 and before > 0 and columns > 0 and
                rows == after and visible_columns == columns and split == before,
                'New array must isolate exactly the added final row')
        return sum(columns for _ in range(after)) - sum(columns for _ in range(before))
    raise ValueError('Missing independent equal-groups solver')
