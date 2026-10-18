"""Independent exact review of public two-variable linear-system tasks.

Only parsed public equations and choices determine answers. No author arithmetic,
private generation tags, seed reconstruction, or floating-point tolerances.
"""
import copy
import math
import re
from collections import Counter
from fractions import Fraction
from itertools import combinations
from functools import lru_cache

PAIR = 'linear-system-pair'
COUNT = 'linear-system-solution-count'
LINEAR_SYSTEM = frozenset({PAIR, COUNT})
COUNT_LABELS = ('Exactly one ordered pair', 'No ordered pairs', 'Infinitely many ordered pairs')
PROMPTS = {
    PAIR: r'Which ordered pair \(x, y\) satisfies both equations for real x and y: (.+); (.+)\?',
    COUNT: r'How many ordered pairs \(x, y\) satisfy both equations for real x and y: (.+); (.+)\?',
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def number_text(value):
    value = Fraction(value)
    return str(value).replace('-', '−')


def rational(source, numerator_limit, denominator_limit):
    require(isinstance(source, str) and re.fullmatch(r'(?:0|−?[1-9][0-9]*)(?:/[1-9][0-9]*)?', source),
            'Malformed canonical rational number')
    # Size guard precedes conversion, including on deliberately malformed input.
    require(len(source) <= 16, 'Rational token too long')
    value = Fraction(source.replace('−', '-'))
    require(number_text(value) == source, 'Rational must be reduced with a positive denominator')
    require(abs(value.numerator) <= numerator_limit and value.denominator <= denominator_limit,
            'Rational number outside the declared domain')
    return value


def linear_text(a, b):
    result = ''
    for coefficient, variable in ((a, 'x'), (b, 'y')):
        if not coefficient:
            continue
        magnitude = (str(abs(coefficient)) if abs(coefficient) != 1 else '') + variable
        result += (' − ' if coefficient < 0 else ' + ') + magnitude if result else (
            ('−' if coefficient < 0 else '') + magnitude)
    return result


def equation(source, coefficient_limit=6, numerator_limit=48, denominator_limit=4):
    require(isinstance(source, str) and source.count(' = ') == 1, 'Malformed linear equation')
    left, right = source.split(' = ')
    compact = left.replace(' ', '').replace('−', '-')
    tokens = re.findall(r'([+-]?)([0-9]*)([xy])', compact)
    require(tokens and ''.join(''.join(token) for token in tokens) == compact,
            'Unsupported linear-equation term')
    coefficients = {'x': 0, 'y': 0}
    seen = set()
    for sign, digits, variable in tokens:
        require(variable not in seen and len(digits) <= 2, 'Repeated or oversized coefficient')
        seen.add(variable)
        coefficients[variable] = (-1 if sign == '-' else 1) * int(digits or '1')
    a, b = coefficients['x'], coefficients['y']
    require((a or b) and max(abs(a), abs(b)) <= coefficient_limit, 'Nonzero row within the coefficient bound required')
    require(left == linear_text(a, b), 'Linear terms must be canonical, ordered, and nonzero')
    return a, b, rational(right, numerator_limit, denominator_limit)


def pair_value(label):
    require(isinstance(label, str), 'Pair choice must be text')
    found = re.fullmatch(r'\(([^,]+), ([^,]+)\)', label)
    require(found is not None, 'Malformed ordered-pair choice')
    pair = tuple(rational(source, 12, 4) for source in found.groups())
    require(all(abs(value) <= 6 for value in pair), 'Pair coordinate magnitude exceeds six')
    return pair


def givens(public):
    template = public['templateId']
    require(template in LINEAR_SYSTEM, 'Unsupported linear-system family')
    require('figure' not in public, 'Equation-only system tasks must not disclose a graph answer')
    found = re.fullmatch(PROMPTS[template], public['prompt'])
    require(found is not None, 'Malformed or ambiguous linear-system prompt')
    return tuple(equation(source) for source in found.groups())


def solution(rows):
    (a, b, e), (c, d, f) = rows
    determinant = a*d-b*c
    if determinant:
        pair = (Fraction(e*d-b*f, determinant), Fraction(a*f-e*c, determinant))
        require(all(u*pair[0]+v*pair[1] == total for u,v,total in rows), 'Exact solution failed substitution')
        return 'one', pair
    # Both coefficient rows are nonzero. A proportional augmented row gives
    # one common line; any nonzero augmented minor gives a contradiction.
    return ('infinite', None) if a*f-c*e == b*f-d*e == 0 else ('none', None)


def small(value, numerator=96, denominator=12):
    value = Fraction(value)
    return abs(value.numerator) <= numerator and value.denominator <= denominator


def elimination_routes(rows):
    routes = []
    for variable in (0, 1):
        left, right = rows[0][variable], rows[1][variable]
        if not left or not right:
            continue
        common = math.gcd(abs(left), abs(right))
        first, second = right//common, -left//common
        scaled = [tuple(multiplier*value for value in row)
                  for multiplier, row in zip((first, second), rows)]
        reduced = tuple(a+b for a,b in zip(*scaled))
        routes.append({'variable': 'xy'[variable], 'multipliers': (first, second),
                       'scaled': scaled, 'reduced': reduced,
                       'bothRowsScaled': abs(first) > 1 and abs(second) > 1,
                       'withinBudget': max(abs(first), abs(second)) <= 6 and
                       all(small(value) for row in (*scaled, reduced) for value in row)})
    return routes


def line_through(first, second):
    a, b = first[1]-second[1], second[0]-first[0]
    scale = math.lcm(a.denominator, b.denominator)
    a, b = int(a*scale), int(b*scale)
    common = math.gcd(abs(a), abs(b))
    require(common, 'Repeated points cannot define a line')
    a, b = a//common, b//common
    if a < 0 or a == 0 and b < 0:
        a, b = -a, -b
    return a, b, a*first[0]+b*first[1]


@lru_cache(maxsize=2048)
def review_cohort(points):
    """Admit all targets before selecting one; extra row scaling is optional."""
    def admissible(maximum_scale):
        for target in range(4):
            others = [i for i in range(4) if i != target]
            for first, second in combinations(others, 2):
                base = [line_through(points[target], points[index]) for index in (first, second)]
                scales = (-2,-1,1,2) if maximum_scale == 2 else (-1,1)
                for first_scale in scales:
                    for second_scale in scales:
                        rows = [tuple(scale*value for value in row)
                                for scale,row in zip((first_scale, second_scale), base)]
                        if not all(max(abs(row[0]), abs(row[1])) <= 6 and small(row[2],48,4) for row in rows):
                            return False
                        if not all(route['withinBudget'] for route in elimination_routes(rows)):
                            return False
                        if not all(small(value) for a,b,c in rows for x,y in points
                                   for value in (a*x,b*y,a*x+b*y,c-a*x,c-b*y)):
                            return False
        return True
    require(admissible(1), 'Cohort fails a different target arithmetic budget')
    return 2 if admissible(2) else 1


def choice_values(public):
    response = public['response']
    require(isinstance(response, dict) and response.get('kind') == 'choice', 'System task requires choices')
    options = response['options']
    size = 4 if public['templateId'] == PAIR else 3
    require(isinstance(options, list) and len(options) == size, 'Incorrect system choice count')
    require(all(isinstance(option, dict) and set(option) == {'id', 'label'} and
                isinstance(option['id'], str) and re.fullmatch(r'option-[a-d]', option['id']) and
                isinstance(option['label'], str) for option in options), 'Invalid system choice shape')
    require(len({option['id'] for option in options}) == size, 'Duplicate system choice ID')
    if public['templateId'] == COUNT:
        require({option['label'] for option in options} == set(COUNT_LABELS), 'Count choices must include all three outcomes')
        return options, [option['label'] for option in options]
    values = [pair_value(option['label']) for option in options]
    require(len(set(values)) == 4, 'Duplicate ordered-pair choice')
    for p, q, r in combinations(values, 3):
        require((q[0]-p[0])*(r[1]-p[1]) != (r[0]-p[0])*(q[1]-p[1]), 'Three collinear pair choices')
    return options, values


def solve_linear_system(public):
    rows = givens(public)
    outcome, pair = solution(rows)
    options, values = choice_values(public)
    if outcome == 'one':
        require(all(small(value, 12, 4) and abs(value) <= 6 for value in pair),
                'Unique solution outside the bounded coordinate domain')
    if public['templateId'] == COUNT:
        label = {'one': COUNT_LABELS[0], 'none': COUNT_LABELS[1], 'infinite': COUNT_LABELS[2]}[outcome]
        return next(option['id'] for option in options if option['label'] == label)
    require(outcome == 'one', 'Pair template requires a unique solution')
    require(pair in values, 'Complete solution pair is missing from choices')
    max_scale = review_cohort(tuple(sorted(values)))
    require(all(math.gcd(abs(a),abs(b)) <= max_scale for a,b,_ in rows),
            'Displayed row scale is not permitted for the full cohort')
    memberships = []
    for a, b, total in rows:
        members = {i for i,(x,y) in enumerate(values) if a*x+b*y == total}
        require(len(members) == 2, 'One equation must leave exactly two candidate pairs')
        memberships.append(members)
        require(all(small(value) for x,y in values for value in
                    (a*x, b*y, a*x+b*y, total-a*x, total-b*y)), 'Candidate substitution exceeds arithmetic budget')
    require(len(memberships[0] & memberships[1]) == 1, 'The equations must select one shared pair')
    routes = elimination_routes(rows)
    require(any(route['withinBudget'] for route in routes) or any(not a or not b for a,b,_ in rows),
            'No bounded elimination or direct-substitution route')
    return options[values.index(pair)]['id']


def system_tags(public):
    rows = givens(public)
    outcome, pair = solution(rows)
    tags = {f'outcome:{outcome}'}
    determinant = rows[0][0]*rows[1][1]-rows[0][1]*rows[1][0]
    if determinant:
        tags.add('determinant:positive' if determinant > 0 else 'determinant:negative')
        x, y = pair
        tags.add(f'fractional-coordinates:{sum(value.denominator != 1 for value in pair)}')
        if x and y:
            tags.add(f'quadrant:{1 if x > 0 else -1},{1 if y > 0 else -1}')
        else:
            tags.add('origin' if x == y == 0 else 'x-zero' if x == 0 else 'y-zero')
    else:
        index = 0 if rows[0][0] else 1
        scale = Fraction(rows[1][index], rows[0][index])
        tags.add('row-scale:negative' if scale < 0 else 'row-scale:positive')
        tags.add('coefficient-rows:equal' if rows[0][:2] == rows[1][:2] else 'coefficient-rows:scaled')
    if any(not a for a,b,_ in rows):
        tags.add('horizontal')
    if any(not b for a,b,_ in rows):
        tags.add('vertical')
    tags.add('axis-aligned' if any(not a or not b for a,b,_ in rows) else 'oblique')
    if outcome == 'infinite':
        tags.add('duplicate-equations' if rows[0] == rows[1] else 'differently-written')
    if any(value < 0 for row in rows for value in row[:2]):
        tags.add('negative-coefficient')
    if any(total.denominator != 1 for _,_,total in rows):
        tags.add('fractional-constant')
    if any(abs(value) == 1 for row in rows for value in row[:2]):
        tags.add('unit-coefficient')
    if any(route['bothRowsScaled'] and route['withinBudget'] for route in elimination_routes(rows)):
        tags.add('both-rows-scaled')
    if all(a and b for a,b,_ in rows):
        route = min(elimination_routes(rows), key=lambda item: (sum(abs(m) for m in item['multipliers']),item['variable']))
        if route['bothRowsScaled']:
            tags.add('chosen-both-rows-scaled')
    return tags


def normalized_system(public):
    """Ignore row order and scalar multiples when checking meaningful variety."""
    normalized = []
    for row in givens(public):
        denominator = math.lcm(*(Fraction(value).denominator for value in row))
        integers = tuple(int(value*denominator) for value in row)
        common = math.gcd(*(abs(value) for value in integers))
        primitive = tuple(value//common for value in integers)
        if next(value for value in primitive if value) < 0:
            primitive = tuple(-value for value in primitive)
        normalized.append(primitive)
    return tuple(sorted(normalized))


def arithmetic(source):
    """Restricted numeric expression parser for exported worked steps."""
    compact = re.sub(r'\s+', '', source.replace('−','-'))
    tokens = re.findall(r'[0-9]+(?:/[0-9]+)?|[()+×÷-]', compact)
    require(''.join(tokens) == compact and tokens, 'Unsupported worked arithmetic')
    position = 0

    def atom():
        nonlocal position
        require(position < len(tokens), 'Missing worked operand')
        token = tokens[position]; position += 1
        if token in ('+','-'):
            return atom() * (-1 if token == '-' else 1)
        if token == '(':
            value = addition()
            require(position < len(tokens) and tokens[position] == ')', 'Unclosed worked operand')
            position += 1
            return value
        require(re.fullmatch(r'[0-9]+(?:/[0-9]+)?',token), 'Invalid worked operand')
        return Fraction(token)

    def multiplication():
        nonlocal position
        value = atom()
        while position < len(tokens) and tokens[position] in ('×','÷'):
            operation = tokens[position]; position += 1
            other = atom()
            value = value*other if operation == '×' else value/other
        return value

    def addition():
        nonlocal position
        value = multiplication()
        while position < len(tokens) and tokens[position] in ('+','-'):
            operation = tokens[position]; position += 1
            other = multiplication()
            value = value+other if operation == '+' else value-other
        return value

    value = addition()
    require(position == len(tokens), 'Unconsumed worked arithmetic')
    return value


def numeric_chain(source):
    values = [arithmetic(part) for part in source.split(' = ')]
    require(values and all(value == values[0] for value in values), 'False worked arithmetic equality')
    return values[0]


def review_checks(text, rows, point):
    checks = re.findall(r'Check the (first|second) equation: (.*?), (matching|not) ([^.]+)\.',text)
    require(len(checks) == 2 and {name for name,_,_,_ in checks} == {'first','second'},
            'Both original equations need an explicit check')
    for name, chain, relation, stated in checks:
        a,b,c = rows[0 if name == 'first' else 1]
        expected_products = [(Fraction(coefficient),value) for coefficient,value in zip((a,b),point) if coefficient]
        products = [part.split(' × ') for part in chain.split(' = ')[0].split(' + ')]
        require(all(len(product) == 2 for product in products) and
                [tuple(arithmetic(value) for value in product) for product in products] == expected_products,
                'Check substituted the wrong coefficient or coordinate')
        value = numeric_chain(chain)
        require(value == a*point[0]+b*point[1] and arithmetic(stated) == c and
                (relation == 'matching') == (value == c), 'Worked check misstates equation satisfaction')


def review_linear_system_explanation(public, steps, feedback=None):
    rows = givens(public)
    outcome, point = solution(rows)
    require(isinstance(steps,list) and steps and all(isinstance(step,str) and step for step in steps),
            'Missing system worked solution')
    scaled = {}
    pending = None
    substitution = None
    cancellation = None
    established = set()
    for step in steps:
        multiplied = re.search(r'Multiply every term in the (first|second) equation by ([^:]+): ([^.]+)\.',step)
        kept = re.search(r'Keep the (first|second) equation: ([^.]+)\.',step)
        if multiplied or kept:
            name = (multiplied or kept)[1]
            multiplier = arithmetic(multiplied[2]) if multiplied else Fraction(1)
            require(multiplier.denominator == 1 and multiplier != 0 and abs(multiplier) <= 6,
                    'Invalid equality-preserving row multiplier')
            row = rows[0 if name == 'first' else 1]
            actual = equation(multiplied[3] if multiplied else kept[2],96,96,12)
            require(actual == tuple(multiplier*value for value in row), 'Scaled equation changed a term incorrectly')
            scaled[name] = actual
        direct = re.search(r'The(?: original)? (first|second) equation contains only ([xy]): ([^.]+)\.',step)
        if direct:
            row = rows[0 if direct[1] == 'first' else 1]
            index = 'xy'.index(direct[2])
            require(equation(direct[3]) == row and row[1-index] == 0, 'Incorrect direct-variable equation')
            pending = (row[index],direct[2],row[2])
            if row[index] == 1:
                established.add(direct[2])
        cancelled = re.search(r'(?:[xy] terms|variable terms) cancel: (.*?)\.',step)
        if cancelled:
            require(set(scaled) == {'first','second'}, 'Cancellation requires both scaled equations')
            combined = tuple(a+b for a,b in zip(scaled['first'],scaled['second']))
            left, chain = cancelled[1].split(' = ',1)
            value = numeric_chain(chain)
            require(value == combined[2], 'Incorrect constant after adding equations')
            if outcome == 'one':
                row = equation(f'{left} = {number_text(value)}',96,96,12)
                require(row == combined and (row[0] == 0) != (row[1] == 0), 'Elimination did not preserve the remaining equation')
                index = 0 if row[0] else 1
                pending = (row[index],'xy'[index],value)
                if row[index] == 1:
                    established.add('xy'[index])
            else:
                require(left == '0' and combined[:2] == (0,0) and (value == 0) == (outcome == 'infinite'),
                        'Incorrect identity or contradiction after cancellation')
                cancellation = value
        substituted = re.search(r'Substitute ([xy]) = (.*?) in the original (first|second) equation, (.*?)\. Its ([xy]) term is (.*?)\.',step)
        if substituted:
            require(outcome == 'one', 'Substitution into a unique pair requires a unique solution')
            variable,value,name,row_text,term_variable,chain = substituted.groups()
            row = rows[0 if name == 'first' else 1]
            index = 'xy'.index(variable)
            require(variable == term_variable and arithmetic(value) == point[index] and equation(row_text) == row,
                    'Substitution does not use the original equation and solved coordinate')
            require(variable in established, 'Substitution uses a coordinate before solving for it')
            product = numeric_chain(chain)
            require(product == row[index]*point[index], 'Incorrect substituted product')
            substitution = row,index,product
        removed = re.match(r'(Add|Subtract) (.*?) (to|from) both sides: (.*?)\.',step)
        if removed:
            require(substitution is not None, 'Coordinate recovery lacks its original substitution')
            row,index,product = substitution
            operation,magnitude,direction,chain = removed.groups()
            require(operation == ('Add' if product < 0 else 'Subtract') and
                    direction == ('to' if product < 0 else 'from') and arithmetic(magnitude) == abs(product),
                    'Incorrect operation when removing the substituted term')
            left, numeric = chain.split(' = ',1)
            value = numeric_chain(numeric)
            actual = equation(f'{left} = {number_text(value)}',96,96,12)
            expected = tuple(0 if i == index else row[i] for i in (0,1)) + (row[2]-product,)
            require(actual == expected, 'Coordinate-recovery equation is incorrect')
            pending = row[1-index],'xy'[1-index],value
            if row[1-index] == 1:
                established.add('xy'[1-index])
        division = re.search(r'Divide both sides by ([^:]+): ([xy]) = (.*?)\.',step)
        if division:
            divisor,variable,chain = division.groups()
            require(pending is not None and arithmetic(divisor) == pending[0] and variable == pending[1],
                    'Division does not isolate the pending variable')
            require(numeric_chain(chain) == pending[2]/pending[0] == point['xy'.index(variable)],
                    'Incorrect coordinate after division')
            established.add(variable)
    joined = ' '.join(steps)
    if outcome == 'one':
        require(established == {'x','y'}, 'Worked solution must derive both coordinates explicitly')
        match = re.search(r'Write x first and y second: (\([^)]*\))\.',joined)
        require(match is not None and pair_value(match[1]) == point, 'Worked answer omits or reverses the complete pair')
        review_checks(joined,rows,point)
    else:
        require(cancellation is not None, 'Solution-count explanation lacks an exact cancellation')
        if outcome == 'none':
            require('no pair can satisfy both original equations' in joined and 'contradiction' in joined,
                    'Inconsistent system needs a no-pair conclusion')
        else:
            require('infinitely many' in joined and 'pairs off that line are not solutions' in joined,
                    'Infinite solution conclusion must identify pairs on one line')
            match = re.search(r'same line, ([^.]+)\.',joined)
            require(match is not None and equation(match[1]) == rows[0], 'Infinite solution line is missing or incorrect')
    if feedback is not None:
        options,values = choice_values(public)
        correct = solve_linear_system(public)
        require(set(feedback) == {option['id'] for option in options if option['id'] != correct},
                'Wrong-choice feedback inventory mismatch')
        for option,value in zip(options,values):
            if option['id'] == correct:
                continue
            text = feedback[option['id']]
            if public['templateId'] == PAIR:
                review_checks(text,rows,value)
            elif outcome == 'none':
                match = re.search(r'0 = ([^,]+), which is false',text)
                require(match is not None and arithmetic(match[1]) == cancellation != 0,
                        'Incorrect contradiction in count feedback')
            elif outcome == 'infinite':
                require('Infinitely many pairs on that line work, but pairs off the line do not' in text,
                        'Infinite count feedback must restrict the solution set to a line')
            else:
                match = re.search(r'x = ([^ ]+) and y = ([^.]+)\.',text)
                require(match is not None and tuple(arithmetic(v) for v in match.groups()) == point,
                        'Unique count feedback has incorrect coordinates')


class LinearSystemReview:
    def __init__(self):
        self.coverage = {template: Counter() for template in LINEAR_SYSTEM}
        self.systems = {template: set() for template in LINEAR_SYSTEM}
        self.attacks = {template: {} for template in LINEAR_SYSTEM}

    def record(self, public, independent_answer):
        template = public['templateId']
        counts = self.coverage[template]
        counts['cases'] += 1
        tags = system_tags(public)
        counts.update(tags)
        self.systems[template].add(normalized_system(public))
        options, values = choice_values(public)
        correct = next(i for i,option in enumerate(options) if option['id'] == independent_answer)
        counts[f'position:{correct}'] += 1
        outcome = next(tag for tag in tags if tag.startswith('outcome:'))
        counts[f'{outcome}/position:{correct}'] += 1
        rules = {f'position:{index}': {index} for index in range(len(options))}
        if template == PAIR:
            measures = {
                'x': [x for x,y in values], 'y': [y for x,y in values],
                'magnitude': [abs(x)+abs(y) for x,y in values],
                'fraction-count': [sum(value.denominator != 1 for value in pair) for pair in values],
                'zero-count': [sum(value == 0 for value in pair) for pair in values],
                'negative-count': [sum(value < 0 for value in pair) for pair in values],
            }
            for name,measure in measures.items():
                for direction,extreme in [('min',min(measure)), ('max',max(measure))]:
                    rules[f'{direction}:{name}'] = {i for i,value in enumerate(measure) if value == extreme}
        for name,selected in rules.items():
            if len(selected) == len(options):
                continue
            evidence = self.attacks[template].setdefault(name,[0,0,Fraction(0)])
            evidence[0] += 1
            evidence[1] += correct in selected
            evidence[2] += Fraction(len(selected),len(options))

    def finish(self, expected_per_family):
        require(type(expected_per_family) is int and expected_per_family >= 256,
                'System review requires at least 256 cases per family')
        report = {}
        for template,counts in self.coverage.items():
            require(counts['cases'] == expected_per_family, f'Incomplete system corpus: {template}')
            required = ['horizontal','vertical','negative-coefficient','fractional-constant']
            required += [f'position:{i}' for i in range(4 if template == PAIR else 3)]
            if template == PAIR:
                required += [f'quadrant:{x},{y}' for x in (-1,1) for y in (-1,1)]
                required += [f'fractional-coordinates:{i}' for i in range(3)]
                required += ['x-zero','y-zero','both-rows-scaled','determinant:positive','determinant:negative']
                # Origin is sparse in uniform four-point sampling. The deep
                # corpus and every representative worksheet must include it.
                if expected_per_family >= 1024:
                    required.append('origin')
            else:
                required += ['row-scale:negative','row-scale:positive','coefficient-rows:equal','coefficient-rows:scaled']
                required += [f'outcome:{outcome}/position:{i}' for outcome in ('one','none','infinite') for i in range(3)]
            require(all(counts[key] > 0 for key in required),
                    f'Missing system strata in {template}: {[key for key in required if not counts[key]]}')
            require(len(self.systems[template]) >= min(64,expected_per_family//4), 'Insufficient distinct system givens')
            checks = {}
            for name,(n,hits,chance_sum) in self.attacks[template].items():
                excess = float(Fraction(hits,n)-chance_sum/n)
                probability = math.exp(-2*n*max(0,excess)**2)
                require(not (n >= 32 and excess > .15 and probability < .001),
                        f'Known system choice shortcut: {template}/{name}: {hits}/{n}')
                checks[name] = {'applications':n, 'hits':hits, 'meanChance':float(chance_sum/n),
                                'hoeffdingUpperBound':probability}
            if template == COUNT:
                for outcome in ('one','none','infinite'):
                    deviation = abs(counts[f'outcome:{outcome}']/expected_per_family-1/3)
                    require(not (deviation > .15 and 2*math.exp(-2*expected_per_family*deviation**2) < .001),
                            f'Unbalanced system solution-count outcomes: {outcome}')
            report[template] = {'coverage':dict(counts), 'distinctSystems':len(self.systems[template]),
                                'namedChoiceOnlyChecks':checks}
        return report


def review_linear_system_fixtures():
    """Handwritten equations/choices; fixtures precede author implementation."""
    def public(template, equations, labels):
        beginning = ('Which ordered pair (x, y) satisfies both equations' if template == PAIR else
                     'How many ordered pairs (x, y) satisfy both equations')
        return {'templateId': template, 'prompt': f'{beginning} for real x and y: {equations}?',
                'response': {'kind': 'choice', 'options': [
                    {'id': f'option-{chr(97+i)}', 'label': label} for i,label in enumerate(labels)]}}

    integer = ['(0, 0)', '(3, −2)', '(2, −3)', '(5, −5)']
    halves = ['(0, 0)', '(3/2, −1)', '(1, −3/2)', '(5/2, −5/2)']
    quadrants = ['(−5/2, 5/2)', '(1/2, 1/2)', '(−1/2, −1/2)', '(5/2, −5/2)']
    axes = ['(0, 0)', '(2, 0)', '(0, 2)', '(2, 2)']
    fixtures = [
        (public(PAIR, '2x + 3y = 0; 3x + 2y = 5', integer), 'option-b'),
        (public(PAIR, '−3x − 2y = −5; 4x + 6y = 0', integer), 'option-b'),
        (public(PAIR, '3x + 2y = 0; 2x + 3y = −5', integer), 'option-c'),
        (public(PAIR, '2x + 3y = −5; 3x + 2y = 5', integer), 'option-d'),
        (public(PAIR, '2x + 3y = 0; 3x + 2y = 0', integer), 'option-a'),
        (public(PAIR, '2x + 3y = 0; 3x + 2y = 5/2', halves), 'option-b'),
        (public(PAIR, 'x + y = 0; 3x + 2y = 5/2', halves), 'option-d'),
        (public(PAIR, '2x + 3y = 5/2; 3x + 2y = −5/2', quadrants), 'option-a'),
        (public(PAIR, '2x + 3y = 5/2; 3x + 2y = 5/2', quadrants), 'option-b'),
        (public(PAIR, '2x + 3y = −5/2; 3x + 2y = −5/2', quadrants), 'option-c'),
        (public(PAIR, 'x = 0; y = 2', axes), 'option-c'),
        (public(PAIR, '−y = 0; −2x = −4', axes), 'option-b'),
        (public(PAIR, 'x = 0; y = 0', axes), 'option-a'),
    ]
    for equations, label in [
        ('2x + 3y = 1; 4x + 6y = 2', COUNT_LABELS[2]),
        ('2x + 3y = 1; −4x − 6y = −2', COUNT_LABELS[2]),
        ('x − y = 1/2; x − y = 1/2', COUNT_LABELS[2]),
        ('x − y = 1/2; 2x − 2y = 2', COUNT_LABELS[1]),
        ('x = 1; −2x = −3', COUNT_LABELS[1]),
        ('y = 1; 3y = 3', COUNT_LABELS[2]),
        ('y = 1; y = −1', COUNT_LABELS[1]),
        ('x + y = 0; x − y = 0', COUNT_LABELS[0]),
        ('x = 1/4; y = −1/3', COUNT_LABELS[0]),
    ]:
        for rotation in range(3):
            labels = COUNT_LABELS[rotation:]+COUNT_LABELS[:rotation]
            fixtures.append((public(COUNT, equations, labels), f'option-{chr(97+labels.index(label))}'))
    for item, expected in fixtures:
        require(solve_linear_system(item) == expected, 'Handwritten system fixture failed')

    invalid = []
    def altered(index=0):
        value = copy.deepcopy(fixtures[index][0]); invalid.append(value); return value
    altered()['response']['options'].pop()
    altered()['response']['options'][1]['id'] = 'option-a'
    altered()['response']['options'][1]['label'] = '(3, -2)'
    altered()['response']['options'][1]['label'] = '(6/2, −2)'
    altered()['response']['options'][1]['label'] = '(3, −2/1)'
    altered()['response']['options'][1]['label'] = '(3, −2/0)'
    altered()['response']['options'][1]['label'] = '(3, −0)'
    altered()['response']['options'][1]['label'] = '(3, 7)'
    altered()['response']['options'][1]['label'] = '(3, −1/5)'
    altered()['response']['options'][1]['label'] = '(3 −2)'
    altered()['response']['options'][1]['label'] = '(−2, 3)'
    altered()['response']['options'][2]['label'] = '(3, −2)'
    altered()['response']['options'][2]['label'] = '(1, −1)'
    altered()['response']['options'][2]['label'] = '(6, −4)'
    altered()['response']['options'][3]['label'] = '(6, 6)'
    altered()['response']['options'][0]['correct'] = True
    altered()['response']['options'][0]['id'] = 'correct-answer'
    altered()['response']['kind'] = 'number'
    altered()['figure'] = {'kind': 'coordinate-plane'}
    altered()['prompt'] += ' Extra text.'
    value = altered()
    value['prompt'] = value['prompt'].replace('for real x and y: ', '')
    altered(13)['response']['options'][0]['label'] = 'All real numbers'
    altered(13)['response']['options'].append({'id': 'option-d', 'label': '(0, 0)'})
    for left in ('0x + 3y', 'x + x', 'y + 2x', '7x + 3y', '1x + y', 'x + 0y',
                 'x² + y', 'x*y', 'x(y)', 'x/2 + y', '1/2x + y', '+x + y', '−0x + y',
                 '__import__("os")', 'x + y + 1', 'x - y'):
        altered()['prompt'] = public(PAIR, f'{left} = 0; 3x + 2y = 5', integer)['prompt']
    for right in ('49', '1/5', '2/4', '0/2', '-1', '1/0', '1.5'):
        altered()['prompt'] = public(PAIR, f'2x + 3y = {right}; 3x + 2y = 5', integer)['prompt']
    altered()['prompt'] = public(PAIR, 'x + y = 1; 2x + 2y = 2', integer)['prompt']
    altered()['prompt'] = public(PAIR, 'x + y = 1; 2x + 2y = 3', integer)['prompt']
    for value in invalid:
        try:
            solve_linear_system(value)
        except (ValueError, KeyError, TypeError, ZeroDivisionError):
            continue
        raise ValueError(f'System oracle accepted an invalid fixture: {value}')
    return {'handwrittenCases': len(fixtures), 'rejectedMutations': len(invalid)}

def review_system_figures(documents):
    from inequality_math_oracle import PublicationParser
    expected = {
        'shared-pair': ([(-1,1,1),(1,1,5)], (2,3), (1,2)),
        'one': ([(1,1,4),(1,-1,0)], (2,2), None),
        'none': ([(1,1,2),(1,1,4)], None, None),
        'infinite': ([(1,1,3),(-2,-2,-6)], None, None),
        'axes': ([(1,0,2),(0,1,1)], (2,1), None),
    }
    seen = set()
    for document in documents:
        parser = PublicationParser(); parser.feed(document['html']); parser.close()
        panels = [node for node in parser.root.descendants() if node.tag == 'svg' and
                  node.attributes.get('data-lesson-illustration','').startswith('linear-system-')]
        for panel in panels:
            key = panel.attributes['data-lesson-illustration'].removeprefix('linear-system-')
            require(key in expected and key not in seen, 'Unexpected or duplicate system diagram')
            seen.add(key)
            rows, shared, near = expected[key]
            attributes = panel.attributes
            origin = tuple(Fraction(value) for value in attributes['data-origin'].split(','))
            scale = Fraction(attributes['data-unit-scale'])
            window = tuple(Fraction(value) for value in attributes['data-coordinate-window'].split(','))
            require(len(origin) == 2 and scale > 0 and window == (-1,5,-1,5), 'Incorrect system graph coordinate frame')
            nodes = list(panel.descendants())
            require(attributes.get('role') == 'img' and attributes.get('aria-label') and
                    any(node.tag == 'title' and node.text().strip() for node in nodes), 'System diagram lacks an accessible description')
            groups = [node for node in nodes if 'data-equation' in node.attributes]
            require(len(groups) == 2, 'System diagram requires both original equation labels')
            for index,(group,expected_row) in enumerate(zip(groups,rows)):
                row = tuple(Fraction(value) for value in group.attributes['data-coefficients'].split(','))
                require(row == expected_row, 'Diagram equation coefficients differ from independent reference')
                label = group.attributes['data-equation']
                parsed_row = (-1,1,Fraction(1)) if label == 'y = x + 1' else equation(label)
                require(parsed_row == row and any(node.tag == 'text' and node.text() == label for node in group.descendants()),
                        'Diagram label does not match its equation')
                drawn = [node for node in group.descendants() if 'data-system-line' in node.attributes]
                require(len(drawn) == (0 if key == 'infinite' and index == 1 else 1),
                        'Incorrect number of drawn lines, including coincidence')
                for line in drawn:
                    ends = tuple(Fraction(value) for value in line.attributes['data-coordinate-ends'].split(','))
                    require(len(ends) == 4 and ends[:2] != ends[2:], 'Degenerate graph segment')
                    for number,(x,y) in enumerate((ends[:2],ends[2:]),1):
                        require(row[0]*x+row[1]*y == row[2] and window[0] <= x <= window[1] and
                                window[2] <= y <= window[3] and (x in window[:2] or y in window[2:]),
                                'Drawn segment does not follow the complete visible equation line')
                        require(Fraction(line.attributes[f'x{number}']) == origin[0]+scale*x and
                                Fraction(line.attributes[f'y{number}']) == origin[1]-scale*y,
                                'SVG equation endpoints do not match logical coordinates')
                    dashed = bool(line.attributes.get('stroke-dasharray'))
                    require(dashed == (index == 1), 'Two distinct lines need distinct solid/dashed keys')
            for variable,axis in (('x',0),('y',1)):
                ticks = [node for node in nodes if f'data-{variable}-tick' in node.attributes]
                require({Fraction(node.attributes[f'data-{variable}-tick']) for node in ticks} == set(range(-1,6)) and len(ticks)==7,
                        'Missing or duplicate graph unit ticks')
                for tick in ticks:
                    value = Fraction(tick.attributes[f'data-{variable}-tick'])
                    position = origin[axis]+scale*value*(1 if axis == 0 else -1)
                    require(Fraction(tick.attributes[f'{variable}1']) == Fraction(tick.attributes[f'{variable}2']) == position,
                            'Graph tick is at the wrong coordinate')
                axes = [node for node in nodes if node.attributes.get('data-axis') == variable]
                require(len(axes) == 1 and any(node.tag=='text' and node.text()==variable for node in nodes),
                        'Missing labelled coordinate axis')
                path = axes[0].attributes['d']
                start = re.match(r'M ([0-9.−-]+) ([0-9.−-]+) ([HV]) ([0-9.−-]+)',path)
                require(start is not None and start[3] == ('H' if axis==0 else 'V') and
                        Fraction(start[2 if axis==0 else 1]) == origin[1-axis], 'Coordinate axis misses the origin')
            for marker,reference in (('shared-point',shared),('near-miss',near)):
                marked = [node for node in nodes if f'data-{marker}' in node.attributes]
                require(len(marked) == (1 if reference is not None else 0), 'Incorrect diagram point inventory')
                for group in marked:
                    point = tuple(Fraction(value) for value in group.attributes[f'data-{marker}'].split(','))
                    require(point == reference, 'Diagram point differs from independent reference')
                    truths = [a*point[0]+b*point[1] == c for a,b,c in rows]
                    require(sum(truths) == (2 if marker == 'shared-point' else 1), 'Diagram point has the wrong solution membership')
                    circles = [node for node in group.descendants() if node.tag == 'circle']
                    require(len(circles)==1 and Fraction(circles[0].attributes['cx'])==origin[0]+scale*point[0] and
                            Fraction(circles[0].attributes['cy'])==origin[1]-scale*point[1], 'SVG point placement is incorrect')
                    require((circles[0].attributes['fill']=='white') == (marker=='near-miss'), 'Shared and near-miss points need distinct fill')
                    require(any(node.tag=='text' and node.text()==f'({point[0]}, {point[1]})' for node in group.descendants()),
                            'Point label does not match its coordinates')
            category,_ = solution(rows)
            require(category == {'none':'none','infinite':'infinite'}.get(key,'one'), 'Incorrect diagram intersection classification')
    require(seen == set(expected), 'Missing standalone system diagram')
    return len(seen)


def check_system_worksheet_coverage(template, problems):
    tags = [system_tags(problem['public']) for problem in problems]
    def has(*required):
        return any(set(required) <= item for item in tags)
    if template == PAIR:
        required = [f'quadrant:{x},{y}' for x in (-1,1) for y in (-1,1)]
        required += ['x-zero','y-zero','origin','axis-aligned','chosen-both-rows-scaled']
        required += [f'fractional-coordinates:{i}' for i in range(3)]
        require(all(has(key) for key in required), f'Missing pair worksheet strata: {[key for key in required if not has(key)]}')
    else:
        for outcome in ('one','none','infinite'):
            require(sum(f'outcome:{outcome}' in item for item in tags)==4, 'Count worksheet needs four of each outcome')
        required = [
            ('outcome:one','axis-aligned'), ('outcome:one','chosen-both-rows-scaled'),
            ('outcome:one','fractional-coordinates:1'), ('outcome:one','fractional-coordinates:2'),
            ('outcome:none','row-scale:negative','vertical'), ('outcome:none','row-scale:negative','horizontal'),
            ('outcome:none','row-scale:negative','oblique'), ('outcome:none','row-scale:positive','oblique'),
            ('outcome:infinite','duplicate-equations'),
            ('outcome:infinite','differently-written','row-scale:negative','oblique'),
            ('outcome:infinite','vertical'), ('outcome:infinite','horizontal'),
        ]
        require(all(has(*keys) for keys in required), f'Missing count worksheet strata: {[keys for keys in required if not has(*keys)]}')
    return tags


def check_linear_system_content(records):
    import hashlib
    import json
    require(records and records[0].get('kind')=='linear-system-content-manifest', 'Missing system content manifest')
    header=records[0]
    expected={PAIR:'linear-systems.ordered-pair-solutions',COUNT:'linear-systems.solution-count'}
    require(header['editions']==16, 'System content review needs sixteen editions')
    templates=header['templates']
    require(len(templates)==2 and {t['id'] for t in templates}==LINEAR_SYSTEM and
            all(t['skillId']=='linear-systems' and t['gradeBand']=='6–8' and t['version']==1 and
                t['requiredResponseCapability']=='single-choice-v1' for t in templates), 'Incorrect system template metadata')
    skill=header['skill']
    require(skill['id']=='linear-systems' and skill['gradeBand']=='8' and
            set(skill['prerequisites'])=={'linear-equations','slope'}, 'Incorrect system prerequisites or grade')
    for name in ('declaredMappings','registeredMappings'):
        mappings=header[name]
        require(len(mappings)==2 and {m['templateId'] for m in mappings}==LINEAR_SYSTEM and
                all(m['facetId']==expected[m['templateId']] and m['extent']=='partial' and m['rationale'].strip() for m in mappings),
                'System coverage must retain two truthful partial mappings')
    bindings=header['bindings']
    require(header['coverageValid'] is True and len(bindings)==2 and {b['templateId'] for b in bindings}==LINEAR_SYSTEM and
            all(b['facetId']==expected[b['templateId']] and b['skillId']=='linear-systems' and b['independentlyReviewed'] is False for b in bindings),
            'Default system registry binding is missing or overclaims review')
    lessons=header['lessons']
    require(len(lessons)==2 and {lesson['id'] for lesson in lessons}==LINEAR_SYSTEM and
            all(lesson['templateIds']==[lesson['id']] for lesson in lessons), 'Incorrect standalone lesson association')
    for lesson in lessons:
        worked=lesson['workedExample']
        if lesson['id']==PAIR:
            found=re.fullmatch(r'Find the ordered pair \(x, y\) satisfying (.+) and (.+)\.',worked['prompt'])
            require(found is not None, 'Unexpected pair worked-example grammar')
            outcome,pair=solution(tuple(equation(value) for value in found.groups()))
            require(outcome=='one' and pair_value(worked['answer'])==pair, 'Incorrect standalone pair example')
        else:
            found=re.fullmatch(r'How many ordered pairs \(x, y\) satisfy (.+) and (.+)\?',worked['prompt'])
            require(found is not None, 'Unexpected count worked-example grammar')
            outcome,_=solution(tuple(equation(value) for value in found.groups()))
            require(outcome=='infinite' and worked['answer']==COUNT_LABELS[2], 'Incorrect standalone count example')
    figures=review_system_figures(header['lessonHtml'])
    seen=set(); patterns={t:set() for t in LINEAR_SYSTEM}; first={t:set() for t in LINEAR_SYSTEM}
    total=0
    for sheet in records[1:]:
        require(sheet.get('kind')=='linear-system-worksheet', 'Unexpected system content record')
        template,edition=sheet['templateId'],sheet['edition']
        require(template in LINEAR_SYSTEM and edition in {str(i) for i in range(1,17)} and sheet['lessonId']==template,
                'Invalid system worksheet identity')
        identity=template,edition
        require(identity not in seen,'Duplicate system worksheet'); seen.add(identity)
        problems=sheet['problems']
        require(len(problems)==12 and problems==sheet['replayed'], 'Worksheet must replay twelve ordinary runtime problems')
        require(len({normalized_system(p['public']) for p in problems})==12, 'Worksheet repeats equivalent systems')
        require(len({p['public']['seed'] for p in problems})==12,'Duplicate system worksheet seed')
        require(len(sheet['workbook'])==len(sheet['solutions'])==12,'System workbook/key count mismatch')
        hashes=[]; classifications=[]
        for index,problem in enumerate(problems):
            require(set(problem)=={'public','answer','hint','explanation','choiceFeedback'},'Unexpected private generated fields')
            public=problem['public']
            require(set(public)=={'id','templateId','templateVersion','seed','skillId','prompt','response'},'Private or unexpected public system fields')
            require(public['templateId']==template and public['templateVersion']==1 and public['skillId']=='linear-systems' and
                    re.fullmatch(r'[a-f0-9]{64}',public['id']) and
                    re.fullmatch(rf'print:{template}:{edition}:(0|[1-9][0-9]*)',public['seed']), 'Invalid printed system identity')
            require(set(public['response'])=={'kind','label','options'},'Unexpected system response fields')
            answer=solve_linear_system(public)
            require(problem['answer']==answer,'Printed system answer differs from independent solution')
            review_linear_system_explanation(public,problem['explanation'],problem['choiceFeedback'])
            labels=[option['label'] for option in public['response']['options']]
            label=next(option['label'] for option in public['response']['options'] if option['id']==answer)
            for kind in ('workbook','solutions'):
                rendered=sheet[kind][index]
                require(rendered['prompt']==public['prompt'] and rendered['choices']==labels,'Workbook/key question or choice mismatch')
                require(rendered['hiddenAnswerMarkers']==0,'Hidden system answer marker')
            require(sheet['workbook'][index]['answer'] is None and not sheet['workbook'][index]['steps'],'Workbook exposes a system answer')
            require(sheet['solutions'][index]['answer']==f'Answer: {label}' and sheet['solutions'][index]['steps']==problem['explanation'],
                    'System answer key does not match the selected runtime solution')
            material=['linear-system-sheet-order',template,sheet['lessonId'],edition,public['seed']]
            hashes.append(hashlib.sha256(json.dumps(material,separators=(',',':')).encode()).hexdigest())
            outcome,pair=solution(givens(public))
            classifications.append((outcome, tuple(sorted(system_tags(public))) if template==PAIR else ()))
            if index==0: first[template].add(pair if template==PAIR else outcome)
            total+=1
        require(hashes==sorted(hashes),'Worksheet order depends on selection requirements rather than its independent hash')
        check_system_worksheet_coverage(template,problems)
        patterns[template].add(tuple(classifications))
    require(len(seen)==32,'Missing system worksheet editions')
    require(all(len(patterns[t])>=4 and len(first[t])>=2 for t in LINEAR_SYSTEM),'System worksheet classification/first-answer order is too repetitive')
    return {'worksheets':len(seen),'problems':total,'figures':figures,'partialFacetBindings':2,'mismatches':0,
            'distinctClassificationOrders':{t:len(patterns[t]) for t in sorted(LINEAR_SYSTEM)}}


def review_linear_system_content():
    import json
    import subprocess
    from pathlib import Path
    from inequality_math_oracle import publication_exercises
    root=Path(__file__).resolve().parent.parent
    result=subprocess.run(['node','--import','tsx','scripts/linear-system-content-oracle.ts'],cwd=root,
                          capture_output=True,text=True,timeout=180)
    require(result.returncode==0,f'System content export failed: {result.stderr[:2000]}')
    records=[json.loads(line) for line in result.stdout.splitlines()]
    for sheet in records[1:]:
        for kind in ('workbook','solutions'):
            require(kind not in sheet,'Exporter must provide actual system publication HTML')
            sheet[kind]=publication_exercises(sheet.pop(f'{kind}Html'))
    return check_linear_system_content(records)


if __name__ == '__main__':
    import json
    print(json.dumps(review_linear_system_fixtures()))
