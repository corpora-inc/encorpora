"""Independent exact algebra review from public prompts, figures and choices only."""
import copy
import math
import ast
import re
from oracle_wording import tolerant
from fractions import Fraction as F


def affine(expression, variable="x"):
    """Return exact (coefficient, constant), rejecting nonlinear expressions."""
    if not re.fullmatch(r"[a-zA-Z]", variable):
        raise ValueError("One variable required")
    source = expression.replace("−", "-").replace("×", "*").replace("·", "*")
    if not re.fullmatch(r"[0-9a-zA-Z+*/().\-\s]+", source):
        raise ValueError("Unsupported symbol")
    source = re.sub(r"(?<=[0-9)])(?=[a-zA-Z(])", "*", source)
    source = re.sub(r"(?<=[a-zA-Z])(?=\()", "*", source)
    tree = ast.parse(source.strip(), mode="eval")

    def visit(node):
        if isinstance(node, ast.Constant) and type(node.value) in (int, float):
            token = ast.get_source_segment(source.strip(), node)
            if not re.fullmatch(r"[0-9]+(?:\.[0-9]+)?", token):
                raise ValueError("Unsupported numeric literal")
            return F(0), F(token)
        if isinstance(node, ast.Name) and node.id == variable:
            return F(1), F(0)
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub)):
            a, b = visit(node.operand)
            sign = -1 if isinstance(node.op, ast.USub) else 1
            return sign * a, sign * b
        if isinstance(node, ast.BinOp):
            a, b = visit(node.left)
            c, d = visit(node.right)
            if isinstance(node.op, ast.Add):
                return a + c, b + d
            if isinstance(node.op, ast.Sub):
                return a - c, b - d
            if isinstance(node.op, ast.Mult):
                if a * c:
                    raise ValueError("Nonlinear product")
                return a * d + b * c, b * d
            if isinstance(node.op, ast.Div):
                if c or not d:
                    raise ValueError("Variable or zero denominator")
                return a / d, b / d
        raise ValueError("Unsupported expression structure")

    return visit(tree.body)


def evaluated(expression, value, variable="x"):
    a, b = affine(expression, variable)
    return a * F(value) + b


def equation(expression, variable="x"):
    sides = expression.split("=")
    if len(sides) != 2:
        raise ValueError("Exactly one equality required")
    a, b = affine(sides[0], variable)
    c, d = affine(sides[1], variable)
    if a == c:
        return ("all-real" if b == d else "none"), None
    return "one", (d - b) / (a - c)


def is_function(pairs):
    outputs = {}
    for x, y in pairs:
        x, y = F(x), F(y)
        if x in outputs and outputs[x] != y:
            return False
        outputs[x] = y
    return True


def first_strictly_cheaper(fee, low_rate, high_rate, minimum, maximum):
    fee, low_rate, high_rate = map(F, (fee, low_rate, high_rate))
    if fee <= 0 or not high_rate > low_rate or minimum < 0 or minimum > maximum:
        raise ValueError("Invalid stated whole-input domain")
    crossing = fee / (high_rate - low_rate)
    candidate = max(minimum, crossing.numerator // crossing.denominator + 1)
    if candidate > maximum:
        raise ValueError("No strictly cheaper allowed input")
    require(fee + low_rate * candidate < high_rate * candidate, "Candidate is not strictly cheaper")
    if candidate > minimum:
        previous = candidate - 1
        require(fee + low_rate * previous >= high_rate * previous, "Candidate is not first")
    return candidate



ALGEBRA_CHOICE = frozenset({'distributive-expression-choice', 'check-equation-candidate', 'relation-function-choice', 'proportional-rule-choice', 'distance-graph-meaning'})
ALGEBRA = ALGEBRA_CHOICE | frozenset({'substitute-linear-expression', 'combine-like-coefficient', 'grouped-linear-equation', 'negative-coefficient-equation', 'rational-coefficient-equation', 'both-sides-linear-equation', 'unequal-step-rate', 'recover-linear-intercept', 'predict-linear-output', 'shared-plan-input', 'first-cheaper-whole-input'})
NUMBER = r'[-−]?[0-9]+(?:/[0-9]+)?'
PAIR = rf'\(({NUMBER}), ({NUMBER})\)'


def require(condition, message):
    if not condition:
        raise ValueError(message)


def match(pattern, text):
    found = re.fullmatch(tolerant(pattern), text)
    require(found is not None, f'Unsupported or ambiguous public wording: {text}')
    return found.groups()


def fraction(text):
    return F(text.replace('−', '-'))


def pairs(text):
    found = re.findall(PAIR, text)
    require(found, 'No exact public pairs')
    return [(fraction(x), fraction(y)) for x, y in found]


def sole_option(public, evaluate):
    options = public['response']['options']
    require(isinstance(options, list) and len(options) == 3, 'Three choices required')
    require(all(set(o) == {'id', 'label'} and isinstance(o['id'], str) and 0 < len(o['id']) <= 64 and isinstance(o['label'], str) for o in options), 'Invalid public option shape')
    require(len({o['id'] for o in options}) == 3, 'Duplicate option identity')
    identities, correct = [], []
    for option in options:
        identity, valid = evaluate(option['label'])
        identities.append(identity)
        if valid:
            correct.append(option['id'])
    require(len(set(identities)) == 3, 'Mathematically duplicate options')
    require(len(correct) == 1, 'Choice must have exactly one mathematically correct option')
    return correct[0]


def solve_algebra(public):
    template, prompt = public['templateId'], public['prompt']
    require(template in ALGEBRA, 'Unknown algebra family')
    require(public['response']['kind'] == ('choice' if template in ALGEBRA_CHOICE else 'fraction'), 'Incorrect algebra response protocol')
    require(template == 'distance-graph-meaning' or public.get('figure') is None, 'Unexpected unsupported algebra diagram')
    if template == 'substitute-linear-expression':
        expression, value = match(rf'Find the value of (.+) when x = ({NUMBER})\.', prompt)
        return evaluated(expression, fraction(value))
    if template == 'combine-like-coefficient':
        expression, = match(r'Combine like terms in (.+)\. What is the coefficient of x\?', prompt)
        return affine(expression)[0]
    if template in {'grouped-linear-equation','negative-coefficient-equation','rational-coefficient-equation','both-sides-linear-equation'}:
        expression, = match(r'Solve (.+)\.', prompt)
        category, answer = equation(expression)
        require(category == 'one', 'Scalar response requires a unique solution')
        return answer
    if template == 'distributive-expression-choice':
        expression, = match(r'Which expression equals (.+) for every real x\?', prompt)
        target = affine(expression)
        return sole_option(public, lambda label: (affine(label), affine(label) == target))
    if template == 'check-equation-candidate':
        value, expression = match(rf'Does x = ({NUMBER}) satisfy (.+)\? Choose the accurate check\.', prompt)
        sides = expression.split('=')
        require(len(sides) == 2, 'Expected original equality')
        lhs, rhs = (evaluated(side, fraction(value)) for side in sides)
        def check(label):
            left, right, judgment = match(rf'Left = ({NUMBER}); right = ({NUMBER})\. (Yes|No)\.', label)
            stated = (fraction(left), fraction(right), judgment == 'Yes')
            return stated, stated == (lhs, rhs, lhs == rhs)
        return sole_option(public, check)
    if template == 'unequal-step-rate':
        match(rf'A linear rule gives {PAIR}, {PAIR}, and {PAIR}\. What is its output change per input unit\?', prompt)
        first, second, third = pairs(prompt)
        dx1, dx2 = second[0]-first[0], third[0]-second[0]
        require(dx1 > 0 and dx2 > 0 and dx1 != dx2, 'Expected unequal increasing input steps')
        rate = (second[1]-first[1])/dx1
        require((third[1]-second[1])/dx2 == rate, 'Public pairs contradict the linear assumption')
        return rate
    if template == 'recover-linear-intercept':
        rate, x, y = match(rf'A linear rule has rate ({NUMBER}) and passes through {PAIR}\. What is its output when the input is 0\?', prompt)
        require(fraction(x) != 0, 'Recovery family must provide a nonzero input')
        return fraction(y)-fraction(rate)*fraction(x)
    if template == 'predict-linear-output':
        x1, y1, x2, y2, target = match(rf'Assume a linear rule through {PAIR} and {PAIR}\. What is the output at input ({NUMBER})\?', prompt)
        x1,y1,x2,y2,target = map(fraction,(x1,y1,x2,y2,target))
        require(x1 != x2, 'Distinct observations required')
        return y1 + (target-x1)*(y2-y1)/(x2-x1)
    if template == 'relation-function-choice':
        require(prompt == 'Which list of (input, output) pairs represents a function?', 'Missing function question')
        def relation(label):
            match(rf'{PAIR}, {PAIR}, {PAIR}', label)
            relation_pairs = pairs(label)
            return frozenset(relation_pairs), is_function(relation_pairs)
        return sole_option(public, relation)
    if template == 'proportional-rule-choice':
        require(prompt == 'Which rule is proportional for all real inputs x?', 'Proportional domain must be explicit')
        def proportional(label):
            expression, = match(r'y = (.+)', label)
            a,b = affine(expression)
            return (a,b), b == 0
        return sole_option(public, proportional)
    if template in {'shared-plan-input','first-cheaper-whole-input'}:
        domain = 'real' if template == 'shared-plan-input' else 'whole'
        ending = 'at what x do they cost the same' if domain == 'real' else 'what is the first x where A is strictly cheaper'
        left,right,minimum,maximum = match(rf'Plan A costs (.+) dollars; B costs (.+) dollars\. For {domain} inputs x from ([0-9]+) to ([0-9]+), {ending}\?', prompt)
        a,b = affine(left);c,d = affine(right)
        lower,upper = int(minimum),int(maximum)
        require(0 <= lower <= upper and a >= 0 and c > a and b > d and d == 0, 'Invalid public cost or domain')
        if domain == 'whole':
            return first_strictly_cheaper(b-d,a,c,lower,upper)
        crossing = (d-b)/(a-c)
        require(lower <= crossing <= upper, 'Crossing outside allowed real domain')
        require(a*crossing+b == c*crossing+d, 'Crossing check failed')
        return crossing
    if template == 'distance-graph-meaning':
        require(prompt == 'x: minutes; y: meters from home. From A to B, how does y change?', 'Unreviewed time/distance wording')
        figure = public['figure']
        require(figure['kind'] == 'coordinate-plane', 'Invalid qualitative graph')
        require(figure['xMin'] < figure['xMax'] and figure['yMin'] < figure['yMax'], 'Invalid graph axes')
        points = figure['points']; lines = figure['lines']
        require(len(points) == 2 and len(lines) == 1, 'Expected one line and two endpoints')
        first,second = points
        start,end = first['x'],second['x']
        require(first['label'] == 'A' and second['label'] == 'B' and start == 0 and end == 4, 'A and B must bound the stated family time domain 0–4')
        require(all(type(p['x']) is int and type(p['y']) is int and p['y'] >= 0 and figure['xMin'] <= p['x'] <= figure['xMax'] and figure['yMin'] <= p['y'] <= figure['yMax'] for p in points), 'Distance endpoints must be nonnegative and visible')
        rate=F(second['y']-first['y'],end-start)
        intercept=F(first['y'])-rate*start
        line=lines[0]
        require(math.isfinite(line['m']) and math.isfinite(line['b']) and math.isclose(line['m'],float(rate),rel_tol=0,abs_tol=1e-12) and math.isclose(line['b'],float(intercept),rel_tol=0,abs_tol=1e-12), 'Drawn line contradicts its endpoints')
        target='Distance from home stays constant.' if rate==0 else 'Distance from home decreases.' if rate<0 else 'Distance from home increases.'
        permitted={'Distance from home stays constant.','Distance from home decreases.','Distance from home increases.','The traveler must be standing still.'}
        def interpretation(label):
            require(label in permitted, 'Unreviewed interpretation wording')
            return label,label==target
        return sole_option(public,interpretation)
    raise ValueError('Unimplemented algebra family')


def review_algebra_fixtures():
    """Handwritten boundary/ambiguity cases, independent of generated answers."""
    def public(template, prompt, options=None, figure=None):
        response = {'kind': 'fraction'} if options is None else {'kind': 'choice', 'options': [{'id': str(i), 'label': label} for i, label in enumerate(options)]}
        value = {'templateId': template, 'prompt': prompt, 'response': response}
        if figure is not None:
            value['figure'] = figure
        return value
    cases = [
        (public('substitute-linear-expression', 'Find the value of -3x + 1 when x = -1/2.'), F(5,2)),
        (public('combine-like-coefficient', 'Combine like terms in x - x + 3. What is the coefficient of x?'), F(0)),
        (public('grouped-linear-equation', 'Solve -2(x + 3) = 1.'), F(-7,2)),
        (public('negative-coefficient-equation', 'Solve -2x + 3 = 0.'), F(3,2)),
        (public('rational-coefficient-equation', 'Solve (-3/4)x + 1 = 5.'), F(-16,3)),
        (public('both-sides-linear-equation', 'Solve -2x + 5 = x - 1.'), F(2)),
        (public('unequal-step-rate', 'A linear rule gives (0, 1), (2, 2), and (5, 7/2). What is its output change per input unit?'), F(1,2)),
        (public('recover-linear-intercept', 'A linear rule has rate -3/2 and passes through (2, 1). What is its output when the input is 0?'), F(4)),
        (public('predict-linear-output', 'Assume a linear rule through (1, 1/2) and (3, 3/2). What is the output at input 0?'), F(0)),
        (public('shared-plan-input', 'Plan A costs 13 + 2x dollars; B costs 5x dollars. For real inputs x from 0 to 8, at what x do they cost the same?'), F(13,3)),
        (public('first-cheaper-whole-input', 'Plan A costs 12 + 2x dollars; B costs 5x dollars. For whole inputs x from 0 to 8, what is the first x where A is strictly cheaper?'), 5),
        (public('distributive-expression-choice', 'Which expression equals -2(x - 3) for every real x?', ['-2x + 6', '-2x - 6', '-2x + 3']), '0'),
        (public('check-equation-candidate', 'Does x = 0 satisfy x + 4 = 2? Choose the accurate check.', ['Left = 4; right = 2. No.', 'Left = 3; right = 2. No.', 'Left = 4; right = 4. Yes.']), '0'),
        (public('relation-function-choice', 'Which list of (input, output) pairs represents a function?', ['(1, 2), (1, 2), (3, 2)', '(1, 2), (1, 3), (2, 2)', '(1, 2), (2, 2), (2, 3)']), '0'),
        (public('proportional-rule-choice', 'Which rule is proportional for all real inputs x?', ['y = -3x', 'y = -3x + 2', 'y = 3x + 1']), '0'),
        (public('distance-graph-meaning', 'x: minutes; y: meters from home. From A to B, how does y change?', ['The traveler must be standing still.', 'Distance from home stays constant.', 'Distance from home decreases.'], {'kind':'coordinate-plane','xMin':-1,'xMax':5,'yMin':-1,'yMax':10,'points':[{'x':0,'y':4,'label':'A'},{'x':4,'y':4,'label':'B'}],'lines':[{'m':0,'b':4}]}), '1'),
    ]
    for given, expected in cases:
        require(solve_algebra(given) == expected, f'Handwritten oracle fixture failed: {given}')
    for fee, expected in [(13,5),(1,1)]:
        changed = copy.deepcopy(cases[10][0])
        changed['prompt'] = changed['prompt'].replace('12 +', f'{fee} +')
        require(solve_algebra(changed) == expected, 'Strict threshold rounding failed')
    invalid = []
    def altered(index):
        item = copy.deepcopy(cases[index][0]);invalid.append(item);return item
    altered(6)['prompt'] = cases[6][0]['prompt'].replace('(5, 7/2)', '(5, 4)')
    altered(8)['prompt'] = cases[8][0]['prompt'].replace('Assume a linear rule', 'A rule')
    altered(10)['prompt'] = cases[10][0]['prompt'].replace('0 to 8', '0 to 4')
    altered(11)['response']['options'][1]['label'] = '6 - 2x'
    altered(12)['response']['options'][0]['label'] = 'Left = 4; right = 2. Yes.'
    altered(13)['response']['options'][1]['label'] = '(1, 3), (2, 3), (3, 3)'
    altered(14)['response']['options'][0]['label'] = 'y = -3x + 7'
    altered(15)['figure']['lines'][0]['m'] = 1
    altered(15)['figure']['points'][1]['label'] = 'C'
    altered(15)['figure']['yMax'] = 3
    altered(15)['response']['options'][0]['label'] = 'The speed decreases.'
    altered(11)['response']['options'][0]['id'] = '1'
    altered(4)['prompt'] = 'Solve (3/0)x + 1 = 5.'
    for given in invalid:
        try:
            solve_algebra(given)
        except (ValueError, ZeroDivisionError):
            continue
        raise ValueError(f'Oracle accepted ambiguous or contradictory fixture: {given}')
    for expression in ['x*x','1/x','1/0','x+y',"__import__('os')"]:
        try:
            affine(expression)
        except (ValueError,SyntaxError):
            continue
        raise ValueError(f'Unsafe/nonlinear expression accepted: {expression}')
    return {'handwrittenCases':len(cases)+2,'rejectedMutations':len(invalid),'rejectedExpressions':5}


if __name__ == '__main__':
    import json
    print(json.dumps(review_algebra_fixtures()))
