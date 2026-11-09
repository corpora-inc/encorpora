"""Exact independent checks for the place-value clause surfaces.

Only public wording, displayed options and figures determine an answer. The
generated answer is read only by review_problem, as the value under test.
Existing template IDs are routed by their owning oracle/central dispatcher;
only the newly introduced number-name type is registered here.
"""
import ast
import json
import re
from fractions import Fraction

SUPPORTED = frozenset({'three-digit-number-names'})
CHOICE_REVIEW = 'choice-response'
NUMBER = r'-?\d+(?:\.\d+)?'


def require(ok, message):
    if not ok:
        raise ValueError(message)


def plain(text):
    text = text.replace('{,}', '').replace(',', '').replace('$', '')
    text = text.replace('−', '-').replace('×', '*').replace('÷', '/')
    text = text.replace(r'\times', '*').replace(r'\div', '/')
    text = text.replace(r'\square', '□').replace(r'\lt', '<').replace(r'\gt', '>')
    text = re.sub(r'\\(?:t?frac)\{([^{}]+)\}\{([^{}]+)\}', r'(\1)/(\2)', text)
    text = re.sub(r'\^\{(\d+)\}', r'**\1', text)
    return text.strip()


def value(text):
    return Fraction(plain(str(text)))


def calc(text):
    """A small arithmetic parser, with exact decimal literals and no eval."""
    source = plain(text)
    node = ast.parse(source, mode='eval').body

    def visit(n):
        if isinstance(n, ast.Constant) and isinstance(n.value, (int, float)):
            return Fraction(ast.get_source_segment(source, n))
        if isinstance(n, ast.UnaryOp) and isinstance(n.op, ast.USub):
            return -visit(n.operand)
        if isinstance(n, ast.BinOp):
            left, right = visit(n.left), visit(n.right)
            if isinstance(n.op, ast.Add):
                return left + right
            if isinstance(n.op, ast.Sub):
                return left - right
            if isinstance(n.op, ast.Mult):
                return left * right
            if isinstance(n.op, ast.Div):
                return left / right
            if isinstance(n.op, ast.Pow) and right.denominator == 1 and abs(right) <= 6:
                return left ** int(right)
        raise ValueError('Unsupported arithmetic: ' + source)

    return visit(node)


def one(options, predicate, context):
    found = [o['id'] for o in options if predicate(o)]
    require(len(found) == 1, f'{context}: expected one correct option, found {found}')
    return found[0]


def number_option(options, expected, context):
    numbers = [value(o['label']) for o in options]
    require(len(set(numbers)) == len(numbers), context + ': mathematically duplicate number options')
    return one(options, lambda o: value(o['label']) == expected, context)


def text_option(options, expected, context):
    return one(options, lambda o: plain(o['label']) == plain(expected), context)


def multipart(public, expected):
    response = public['response']
    require(response['kind'] == 'multi-part-choice', 'Expected independent parts')
    require(set(expected) == {b['id'] for b in response['blanks']}, 'All blanks independently solved')
    answer = {}
    for blank in response['blanks']:
        target = expected[blank['id']]
        if callable(target):
            answer[blank['id']] = one(blank['options'], lambda o: target(plain(o['label'])), blank['label'])
        elif isinstance(target, (int, Fraction)):
            answer[blank['id']] = number_option(blank['options'], target, blank['label'])
        else:
            answer[blank['id']] = text_option(blank['options'], target, blank['label'])
    return json.dumps(answer, separators=(',', ':'))


SMALL = dict(zip(
    'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split(),
    range(20)))
TENS = dict(zip('twenty thirty forty fifty sixty seventy eighty ninety'.split(), range(20, 100, 10)))


def read_name(name):
    words = name.replace('-', ' ').split()
    require(words and 'and' not in words, 'Canonical name does not use and')
    result = 0
    if len(words) >= 2 and words[1] == 'hundred':
        require(words[0] in SMALL and 1 <= SMALL[words[0]] <= 9, 'Hundreds word')
        result = 100 * SMALL[words[0]]
        words = words[2:]
    if not words:
        return result
    if len(words) == 1 and words[0] in SMALL:
        return result + SMALL[words[0]]
    if words[0] in TENS and len(words) <= 2:
        if len(words) == 1:
            return result + TENS[words[0]]
        require(words[1] in SMALL and 1 <= SMALL[words[1]] <= 9, 'Ones word after tens')
        require('-' in name, 'Compound tens names use a hyphen')
        return result + TENS[words[0]] + SMALL[words[1]]
    raise ValueError('Invalid number name: ' + name)


def handles(public):
    ident, prompt, kind = public['templateId'], plain(public['prompt']), public['response']['kind']
    if ident in SUPPORTED:
        return True
    if ident == 'continue-count-to-120':
        return prompt.startswith('Count on:')
    if ident in {'tens-ones-model', 'place-value-digit'}:
        return kind == 'multi-part-choice' or prompt.startswith('What number is ')
    if ident in {'two-digit-symbol', 'three-digit-symbol', 'ten-more-or-less', 'subtract-whole-tens',
                 'multiply-power-of-ten', 'compare-decimals-thousandths', 'decimal-area-model'}:
        return kind == 'multi-part-choice'
    if ident == 'expanded-form-missing':
        return kind == 'multi-part-choice' or prompt.endswith('Write the numeral.')
    if ident == 'mental-ten-hundred':
        return re.fullmatch(r'\d+ [+-] (10|100) = □\.', prompt) is not None
    if ident == 'conversion-chain-story':
        return re.search(r'Use 1 (kg|L|lb|gal|qt) =', prompt) is not None
    if ident == 'measurement-line-fraction-story':
        return kind == 'figure-choice'
    if ident == 'decimal-grid-read':
        return prompt.startswith(('A ribbon is ', 'A board is '))
    if ident == 'compare-decimals-symbol-blanks':
        return 'same whole' in prompt or prompt.startswith('Maya drank ')
    if ident == 'decimal-multiplication':
        return prompt.startswith('Fabric costs ') or ' / ' in prompt or re.match(r'What is [\d.]+/', prompt) is not None
    if ident in {'multidigit-decimal-product', 'multidigit-decimal-quotient', 'multidigit-decimal-sum'}:
        return kind == 'structured-work'
    if ident == 'teen-frame-compose':
        return prompt.startswith(('Which number sentence', 'Complete ')) or 'how many more ones' in prompt
    return False


def base_ten_value(figure):
    require(figure and figure['kind'] == 'base-ten', 'Base-ten picture')
    return figure['hundreds'] * 100 + figure['tens'] * 10 + figure['ones']


def structured(public, expected):
    response = public['response']
    require(response['kind'] == 'structured-work', 'Expected structured work')
    require(len(response['rows']) == len(expected), 'Every algorithm row independently checked')
    rows = []
    for row, targets in zip(response['rows'], expected):
        require(len(row['fields']) == len(targets), 'Algorithm field count')
        rows.append(['' if field.get('given') is not None else str(target)
                     for field, target in zip(row['fields'], targets)])
    return json.dumps(rows, separators=(',', ':'))


def solve(public):
    require(handles(public), 'Not a place-value clause surface')
    ident, prompt, response = public['templateId'], plain(public['prompt']), public['response']
    kind = response['kind']
    if ident == 'three-digit-number-names':
        if prompt.startswith('Write '):
            answer = read_name(re.fullmatch(r'Write (.+) as a numeral\.', prompt)[1])
            require(100 <= answer <= 999, 'Three-digit number-name range')
            return answer
        answer = int(re.fullmatch(r'Which number name means (\d+)\?', prompt)[1])
        require(len(response['options']) == 4, 'Four number-name choices')
        names = [read_name(o['label']) for o in response['options']]
        require(len(set(names)) == len(names), 'Distinct number-name values')
        return one(response['options'], lambda o: read_name(o['label']) == answer, 'Number name')
    if ident == 'continue-count-to-120':
        a, b, c = map(int, re.fullmatch(r'Count on: (\d+) (\d+) (\d+) □\. What comes next\?', prompt).groups())
        require(b == a + 1 and c == b + 1 and 0 <= a <= 117, 'Consecutive counts within 120')
        return c + 1
    if ident in {'tens-ones-model', 'place-value-digit'}:
        if kind == 'number':
            match = re.fullmatch(r'What number is (\d+) (hundreds|ten|tens) (?:0 tens and )?0 ones\?', prompt)
            return int(match[1]) * (100 if match[2] == 'hundreds' else 10)
        numeral = re.match(r'(\d+) (?:has which digits|is)', prompt)
        n = int(numeral[1]) if numeral else base_ten_value(public.get('figure'))
        if public.get('figure'):
            require(base_ten_value(public['figure']) == n, 'Blocks match numeral')
        targets = {'hundreds': n // 100, 'tens': n // 10 % 10, 'ones': n % 10, 'number': n}
        return multipart(public, {b['id']: targets[b['id']] for b in response['blanks']})
    if ident in {'two-digit-symbol', 'three-digit-symbol'}:
        a, right = re.match(r'(\d+) □ (.+?)\. Choose', prompt).groups()
        a = int(a)
        if right.isdigit():
            b = int(right)
        else:
            b = sum(int(n) * {'hundreds': 100, 'tens': 10, 'ones': 1}[unit]
                    for n, unit in re.findall(r'(\d+) (hundreds|tens|ones)', right))
        comparison = '<' if a < b else '>' if a > b else '='
        if a == b:
            reason = 'All corresponding place digits match so the numbers are equal.'
        else:
            place = max(i for i in range(3) if a // 10 ** i % 10 != b // 10 ** i % 10)
            reason = f'The first different place is {("ones", "tens", "hundreds")[place]}: {a // 10 ** place % 10} {comparison} {b // 10 ** place % 10}.'
        return multipart(public, {'symbol': comparison, 'reason': reason})
    if ident == 'ten-more-or-less':
        direction, n = re.match(r'What is 10 (more|less) than (\d+)\?', prompt).groups()
        n, sign = int(n), 1 if direction == 'more' else -1
        require(base_ten_value(public['figure']) == n, 'Ten-more picture')
        reason = f'{"Add" if sign > 0 else "Remove"} one ten; {n // 10} tens becomes {n // 10 + sign}. Keep {n % 10} ones.'
        return multipart(public, {'value': n + 10 * sign, 'reason': reason})
    if ident == 'subtract-whole-tens':
        if prompt.startswith('The model'):
            a, b = map(int, re.match(r'The model shows (\d+) rods of ten\. Take away (\d+) rods\.', prompt).groups())
        else:
            removed, total = map(int, re.match(r'(\d+)\+□=(\d+)\.', prompt).groups())
            require(removed % 10 == total % 10 == 0, 'Whole-ten relation')
            a, b = total // 10, removed // 10
        require(0 <= b <= a <= 9, 'Whole-ten subtraction range')
        elements = public['figure']['scene']['elements']
        rods = [e for e in elements if e['type'] == 'array']
        require(len(rods) == a and all(e['rows'] == 10 and e['columns'] == 1 for e in rods),
                'Each pictured rod contains exactly ten ones')
        crosses = [e for e in elements if e['type'] == 'segment' and e.get('stroke') == 'warm']
        require(len(crosses) == 2*b, 'Exactly the removed rods are crossed out')
        return multipart(public, {
            'equation': f'{10 * a}-{10 * b}={10 * (a-b)}',
            'reason': f'Each rod is ten. Remove {b} tens; {a-b} tens are left.',
        })
    if ident == 'expanded-form-missing':
        if kind == 'number':
            return calc(prompt.split('=□')[0])
        n = int(re.match(r'Write (\d+) in expanded form\.', prompt)[1])
        return multipart(public, {'hundreds': n // 100 * 100, 'tens': n // 10 % 10 * 10, 'ones': n % 10})
    if ident == 'mental-ten-hundred':
        answer = calc(prompt.split('=')[0])
        require(0 <= answer <= 1000, 'Mental change stays within 1000')
        return answer
    if ident == 'conversion-chain-story':
        match = re.search(r'Use 1 (kg|L|lb|gal|qt) = (\d+) (g|mL|oz|qt|cups)\.', prompt)
        large, factor, small = match.groups()
        factor = int(factor)
        require((large, small, factor) in {('kg', 'g', 1000), ('L', 'mL', 1000), ('lb', 'oz', 16), ('gal', 'qt', 4), ('qt', 'cups', 4)}, 'Correct conversion fact')
        mixed = re.findall(r'(\d+) ' + large + r' (\d+) ' + small, prompt)
        quantities = [int(a) * factor + int(b) for a, b in mixed]
        require(quantities and int(mixed[0][0]) > 0, 'Every story needs a larger-unit conversion')
        if prompt.startswith('One '):
            require(len(quantities) == 2, 'Two quantities to add')
            answer = sum(quantities)
        elif prompt.startswith('Each of '):
            count = int(re.match(r'Each of (\d+)', prompt)[1])
            answer = count * quantities[0]
        elif 'is shared equally' in prompt:
            count = int(re.search(r'among (\d+)', prompt)[1])
            answer = Fraction(quantities[0], count)
        else:
            removed = int(re.search(r'\. (\d+) ' + small + r' is removed', prompt)[1])
            answer = quantities[0] - removed
        require(Fraction(answer).denominator == 1 and 0 <= answer <= 20000, 'Exact whole-unit answer within range')
        return answer
    if ident == 'decimal-grid-read':
        length = value(re.match(r'A (?:ribbon|board) is (' + NUMBER + ')', prompt)[1])
        return length * 100 if prompt.startswith('A board') else length / 100
    if ident == 'measurement-line-fraction-story':
        calculation = re.search(r'The calculation is (.+?) (miles|liters|hours|kg)\. Choose the number line', prompt)
        require(calculation is not None, 'Stated measurement calculation')
        expression = calculation[1]
        expected = calc(expression)
        story = prompt[:calculation.start()]
        quantities = [Fraction(int(a), int(b)) for a, b in re.findall(r'(\d+)/(\d+)', story)]
        if ' equal ' in story:
            count = int(re.match(r'(\d+) equal ', story)[1])
            require(len(quantities) == 1, 'One size for equal groups')
            story_answer = count * quantities[0]
        elif 'Find the remaining' in story:
            require(len(quantities) == 2, 'Initial amount and removal')
            story_answer = quantities[0] - quantities[1]
        else:
            require(len(quantities) == 2, 'Two measured addends')
            story_answer = sum(quantities)
        require(story_answer == expected, 'Calculation agrees with the measurement story')
        denom = int(re.search(r'/(\d+)', expression)[1])
        require(0 <= expected <= 3, 'Measurement within the scale')
        marked = []
        for option in response['options']:
            lines = [e for e in option['scene']['elements'] if e['type'] == 'numberLine']
            require(len(lines) == 1, 'One number line in each choice')
            line = lines[0]
            require(line['min'] == 0 and line['max'] == 3 and line['denominator'] == denom, 'Scale matches fraction denominator')
            marks = line.get('marks', [])
            require(len(marks) == 1, 'One marked result')
            marked.append(Fraction(str(marks[0]['at'])).limit_denominator(120))
        require(len(set(marked)) == len(marked), 'Distinct mathematical plots')
        return one(list(zip_options(response['options'], marked)), lambda o: o['value'] == expected, 'Measurement plot')
    if ident == 'compare-decimals-symbol-blanks' and prompt.startswith('Maya'):
        a, b = map(value, re.findall(r'\d+\.\d+', prompt)[:2])
        require(a > b, 'Stated larger decimal')
        expected = 'No. The sizes of the bottle and jug are unknown.' if 'container sizes are unknown' in prompt else 'Yes. Both use liters and Maya drank more.'
        return text_option(response['options'], expected, 'Common whole')
    if ident in {'compare-decimals-symbol-blanks', 'compare-decimals-thousandths'}:
        a_text, b_text = re.match(r'(' + NUMBER + r') □ (' + NUMBER + r')\.', prompt).groups()
        a, b = value(a_text), value(b_text)
        comparison = '<' if a < b else '>' if a > b else '='
        thousand = ident == 'compare-decimals-thousandths'
        units = 1000 if thousand else 100
        require((a * units).denominator == (b * units).denominator == 1, 'Within decimal-place scope')
        na, nb = int(a * units), int(b * units)
        if a == b:
            reason = f'The same value: {na} {"thousandths" if thousand else "squares"} equals {nb}.'
        elif thousand:
            place = next(i for i in range(1, 4) if int(a * 10**i) != int(b * 10**i))
            reason = f'Compare the first different place {("tenths", "hundredths", "thousandths")[place-1]}: {a_text} {comparison} {b_text}.'
        else:
            reason = f'{a_text} shades {na} squares; {b_text} shades {nb}. {na} {comparison} {nb}.'
        if not thousand:
            elements = public['figure']['scene']['elements']
            for x, expected in [(0, na), (13, nb)]:
                fills = [e for e in elements if e['type'] == 'rect' and x <= e['at'][0] < x + 10]
                shaded = sum(Fraction(str(e['size'][0])) * Fraction(str(e['size'][1])) for e in fills)
                require(shaded == expected, 'Grid fill area equals its stated hundredths')
                for fill in fills:
                    px, py = fill['at']
                    width, height = fill['size']
                    require(x <= px < px+width <= x+10 and 0 <= py < py+height <= 10,
                            'Every shaded region stays inside its whole')
                for k in range(11):
                    require(any(e['type'] == 'segment' and e['from'] == [x+k, 0] and e['to'] == [x+k, 10] for e in elements),
                            'Ten equal grid columns')
                    require(any(e['type'] == 'segment' and e['from'] == [x, k] and e['to'] == [x+10, k] for e in elements),
                            'Ten equal grid rows')
        return multipart(public, {'symbol': comparison, 'reason': reason})
    if ident == 'multiply-power-of-ten':
        expression = re.match(r'(.+?)=□\.', prompt)[1]
        base_text, sign, exponent = re.fullmatch(r'(' + NUMBER + r')([*/])10\*\*(\d)', expression).groups()
        exponent, base = int(exponent), value(base_text)
        answer = calc(expression)
        multiply, whole = sign == '*', '.' not in base_text
        reasons = {f'Each digit becomes {10**exponent} times {"as much; move left" if multiply else "smaller; move right"}.'}
        if whole and multiply:
            reasons.add(f'Move digits {exponent} places left; fill empty places with {exponent} zeros.')
        return multipart(public, {'value': answer, 'reason': lambda label: label in reasons})
    if ident == 'decimal-multiplication':
        if prompt.startswith('Fabric costs'):
            b, a = map(value, re.findall(NUMBER, prompt)[:2])
        else:
            a, b = map(value, re.fullmatch(r'What is (' + NUMBER + r')/(' + NUMBER + r')\?', prompt).groups())
        require(0 < a <= Fraction(9999, 100), 'Dividend is at most 99.99')
        answer = a / b
        require((answer * 100).denominator == 1, 'Quotient terminates by hundredths')
        return answer
    if ident.startswith('multidigit-decimal-'):
        if ident.endswith('product'):
            a_text, b_text, a, b = re.search(r'for (' + NUMBER + r')\*(' + NUMBER + r')\. First multiply the digit strings (\d+) and (\d+)\.', prompt).groups()
            a, b = int(a), int(b)
            places = sum(len(s.partition('.')[2]) for s in (a_text, b_text))
            require(int(a_text.replace('.', '')) == a and int(b_text.replace('.', '')) == b, 'Displayed factors have exactly the stated digit strings')
            return structured(public, [[a * (b % 10)], [a * (b // 10) * 10], [a*b], [places], [value(a_text)*value(b_text)]])
        if ident.endswith('quotient'):
            a_text, b_text = re.search(r'for (' + NUMBER + r')/(' + NUMBER + r')\.', prompt).groups()
            a, b = value(a_text), value(b_text)
            scale = 1
            while (b * scale).denominator != 1:
                scale *= 10
            require('smallest power of ten' in prompt, 'A unique scaling factor is requested')
            quotient = a / b
            require(quotient.denominator == 1 and 10 <= quotient < 100, 'Two quotient digits')
            q = int(quotient)
            return structured(public, [[scale], [a*scale, b*scale], [q//10, q%10], [0], [q]])
        a_text, sign, b_text = re.search(r'find (' + NUMBER + r')([+-])(' + NUMBER + r')\.', prompt).groups()
        a, b = value(a_text), value(b_text)
        hundredths = int(a * 100) % 10 + (1 if sign == '+' else -1) * (int(b * 100) % 10)
        regroup = int(hundredths >= 10) if sign == '+' else int(hundredths < 0)
        return structured(public, [[hundredths % 10, regroup], [a+b if sign == '+' else a-b]])
    if ident == 'decimal-area-model':
        expression = re.search(r'model for (.+?)\? Choose', prompt)[1]
        answer = calc(expression)
        method = lambda label: '=' in label and label.split('=')[0] == expression and calc(label.split('=')[1]) == answer
        if '+' in expression or '-' in expression:
            reason = 'Align decimal points so ones tenths and hundredths each meet their own place.'
            first_text, operation, second_text = re.fullmatch(r'(' + NUMBER + r')([+-])(' + NUMBER + r')', expression).groups()
            first, second = value(first_text), value(second_text)
            elements = public['figure']['scene']['elements']
            methods = []
            for x in (0, 10, 20):
                top = sorted((e for e in elements if e['type'] == 'text' and e['at'][1] == 1 and x <= e['at'][0] < x+8), key=lambda e: e['at'][0])
                bottom = sorted((e for e in elements if e['type'] == 'text' and e['at'][1] == -1 and x <= e['at'][0] < x+8), key=lambda e: e['at'][0])
                rendered = [e for e in elements if e['type'] == 'text' and e['at'] == [x+2, -3.5]]
                require(top and bottom and len(rendered) == 1, 'Each written method has two operands and a result')
                top_text, bottom_text = ''.join(e['text'] for e in top), ''.join(e['text'] for e in bottom)
                if '.' not in top_text:
                    require(value(top_text) == first*100 and value(bottom_text) == second*100, 'Whole-number stacking uses the same digit strings')
                    expected_result, method_kind = answer*100, 'whole'
                else:
                    require(top_text == first_text and bottom_text == second_text, 'Both decimal methods display the original digits')
                    top_dot = next(e['at'][0] for e in top if e['text'] == '.')
                    bottom_dot = next(e['at'][0] for e in bottom if e['text'] == '.')
                    if top_dot == bottom_dot:
                        expected_result, method_kind = answer, 'aligned'
                    else:
                        require(top[-1]['at'][0] == bottom[-1]['at'][0], 'The misaligned method lines up last written digits')
                        expected_result = first/10 + (second if operation == '+' else -second)
                        method_kind = 'last-digits'
                require(value(rendered[0]['text']) == expected_result, 'The result displayed under a method matches its column placement')
                methods.append(method_kind)
            require(set(methods) == {'aligned', 'last-digits', 'whole'}, 'Three distinct written methods')
        elif '*' in expression:
            reason = 'Tenths times tenths make hundredths; keep both decimal places.'
        else:
            reason = 'Divide both measurements in tenths to find the missing side.'
        return multipart(public, {'method': method, 'reason': reason})
    if ident == 'teen-frame-compose':
        if kind == 'number':
            return int(re.match(r'(\d+) is 10', prompt)[1]) - 10
        if kind == 'multi-part-choice':
            n = int(re.search(r'Complete (\d+)=', prompt)[1])
            return multipart(public, {'ten': 10, 'ones': n - 10})
        figure = public['figure']
        require(figure['kind'] == 'ten-frame' and figure['first'] == 10, 'Full frame and extra ones')
        extra = figure['second']
        return text_option(response['options'], f'10+{extra}={10+extra}', 'Teen equation')
    raise ValueError('Unsolved clause surface: ' + ident)


def zip_options(options, values):
    for option, expected in zip(options, values):
        yield {**option, 'value': expected}


def equivalent(public, actual, expected):
    kind = public['response']['kind']
    if kind in {'number', 'fraction'}:
        return value(actual) == Fraction(expected)
    if kind == 'multi-part-choice':
        return json.loads(actual) == json.loads(expected)
    if kind == 'structured-work':
        a, b = json.loads(actual), json.loads(expected)
        if len(a) != len(b) or any(len(x) != len(y) for x, y in zip(a, b)):
            return False
        return all((x == y if y == '' else value(x) == value(y)) for ar, br in zip(a, b) for x, y in zip(ar, br))
    return actual == expected


def review_problem(problem):
    answer = solve(problem['public'])
    require(equivalent(problem['public'], problem['answer'], answer), f"{problem['public']['templateId']}: generated answer differs from independent public-givens solution")
    return answer


def self_test():
    require(calc('4.5+7.53') == Fraction(1203, 100), 'Aligned addition fixture')
    require(calc('3/8+7/8') == Fraction(5, 4), 'Measurement fraction fixture')
    require(calc('8.91*10**3') == 8910, 'Power-of-ten fixture')
    require(read_name('seven hundred thirteen') == 713, 'Teen number name fixture')
    require(read_name('four hundred seven') == 407, 'Zero placeholder fixture')
    require(read_name('nine hundred ninety-nine') == 999, 'Hyphenated compound name fixture')
    fixture = {'templateId': 'decimal-grid-read', 'prompt': 'A ribbon is 7 centimeters long. Write its length in meters. Use 1 meter = 100 centimeters.', 'response': {'kind': 'number'}}
    require(solve(fixture) == Fraction(7, 100), 'Dropped-zero fixture')
    bad = {'public': fixture, 'answer': '0.7'}
    try:
        review_problem(bad)
    except ValueError:
        pass
    else:
        raise ValueError('Dropped-zero mutation escaped')
    return 'Place-value clause oracle fixtures passed'


if __name__ == '__main__':
    import sys
    print(self_test())
    cases = json.load(sys.stdin) if not sys.stdin.isatty() else []
    for case in cases:
        review_problem(case)
    print(f'Independently checked {len(cases)} place-value clause cases')
