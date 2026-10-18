"""Independent percent-change review from public wording and exact fractions.

Author answers, private tags, and author rational helpers are never solver inputs.
"""
import copy
import json
import re
import subprocess
from collections import Counter
from fractions import Fraction as Q
from pathlib import Path

PERCENT_CHANGE = frozenset({"percent-change-rate", "percent-change-final", "percent-change-original"})
NUMBER = r"(?:0|[1-9][0-9]*)(?:\.[0-9]{1,2})?"
PERCENT = rf"(?:{NUMBER}%|(?:100|200)/3 percent)"
INSTRUCTION = " Enter the exact percent without the % sign; use a fraction if needed."
RATES = frozenset({Q(i) for i in range(101)} | {Q(i) for i in (125, 150, 175, 200)} |
                  {Q(p) for p in ("0.5", "1.25", "2.5", "6.25", "7.5", "12.5", "37.5", "62.5", "87.5")} |
                  {Q(100, 3), Q(200, 3)})


def require(value, message):
    if not value:
        raise ValueError(message)


def number(source):
    require(isinstance(source, str) and re.fullmatch(NUMBER, source), "Invalid exact decimal quantity")
    return Q(source)


def percent(source):
    require(re.fullmatch(PERCENT, source), "Invalid or ambiguous percentage notation")
    return Q(source.removesuffix(" percent") if source.endswith(" percent") else source[:-1])


def parsed(public):
    """Read the complete frozen prompt, infer missing values, and enforce domain."""
    template = public.get("templateId")
    require(template in PERCENT_CHANGE, "Unknown percent-change template")
    require(public.get("figure") is None, "Unexpected answer-bearing percent figure")
    response = public.get("response", {})
    require(response.get("kind") == "fraction", "Percent change requires exact fraction response")
    require("options" not in response, "Unexpected percent choices")
    for key in ("answer", "correctAnswer", "correctOptionId", "tags", "caseKey"):
        require(key not in public, "Private grading/selection data in public payload")
    prompt = public.get("prompt", "")
    require(isinstance(prompt, str), "Missing public percent prompt")
    for amount, noun in re.findall(r"([0-9]+(?:\.[0-9]+)?) (units?|dollars?)\b", prompt):
        require((Q(amount) == 1) == (noun in ("unit", "dollar")), "Wrong singular/plural quantity unit")
    prompt = re.sub(r"([0-9]+(?:\.[0-9]+)?) (unit|dollar)\b", r"\1 \2s", prompt)
    context = None
    direction = None
    b = f = p = None
    if template == "percent-change-rate":
        require(prompt.endswith(INSTRUCTION), "Missing exact percent answer instruction")
        stem = prompt[:-len(INSTRUCTION)]
        for kind, subject, unit_before, unit_after, question in (
            ("units", "A quantity", "", " units", "By what percent does it {verb}?"),
            ("dollars", "A price", "", " dollars", "By what percent does it {verb}?"),
            ("share", "The share of a group", "", "%", "What is the relative percent {verb}?"),
        ):
            pattern = (rf"{re.escape(subject)} (increases|decreases) from {re.escape(unit_before)}({NUMBER})"
                       rf"{re.escape(unit_after)} to {re.escape(unit_before)}({NUMBER}){re.escape(unit_after)}\. (.+)")
            m = re.fullmatch(pattern, stem)
            if m:
                direction = "increase" if m[1] == "increases" else "decrease"
                require(m[4] == question.format(verb=direction), "Rate question contradicts stated direction")
                b, f, context = number(m[2]), number(m[3]), kind
                break
            zero_question = "What is the relative percent change?" if kind == "share" else "What is the percent change?"
            m = re.fullmatch(rf"{re.escape(subject)} is {re.escape(unit_before)}({NUMBER}){re.escape(unit_after)} before and after a change\. {re.escape(zero_question)}", stem)
            if m:
                b = f = number(m[1])
                context, direction = kind, "unchanged"
                break
        require(context is not None and b > 0, "Malformed rate prompt or zero original base")
        p = 100 * abs(f - b) / b
    else:
        final = template == "percent-change-final"
        for kind, subject, prefix, suffix, noun, unit in (
            ("units", "A quantity", "", " units", "quantity", "units"),
            ("dollars", "A price", "", " dollars", "price", "dollars"),
        ):
            if final:
                pattern = (rf"{re.escape(subject)} of {re.escape(prefix)}({NUMBER}){re.escape(suffix)} "
                           rf"(increases|decreases|changes) by ({PERCENT})\. What is the final {noun}, in {unit}\?")
            else:
                pattern = (rf"{re.escape(subject)} (increases|decreases|changes) by ({PERCENT}) to "
                           rf"{re.escape(prefix)}({NUMBER}){re.escape(suffix)}\. What was the original {noun}, in {unit}\?")
            m = re.fullmatch(pattern, prompt)
            if not m:
                continue
            context = kind
            quantity, word, rate = (m[1], m[2], m[3]) if final else (m[3], m[1], m[2])
            direction = {"increases": "increase", "decreases": "decrease", "changes": "unchanged"}[word]
            p = percent(rate)
            sign = {"increase": 1, "decrease": -1, "unchanged": 0}[direction]
            multiplier = 1 + sign * p / 100
            if final:
                b = number(quantity)
                f = b * multiplier
            else:
                f = number(quantity)
                require(multiplier > 0 and f > 0, "Inverse zero/negative multiplier or nonpositive final quantity")
                b = f / multiplier
            break
        require(context is not None, "Malformed quantity-change prompt")
    require(Q("0.10") <= b <= 500 and 0 <= f <= 1000, "Quantity outside reviewed domain")
    require((100 * b).denominator == (100 * f).denominator == 1, "Quantity is not exact to hundredths")
    require(p in RATES, "Percentage outside reviewed finite pool")
    actual_direction = "increase" if f > b else "decrease" if f < b else "unchanged"
    require(direction == actual_direction and (p == 0) == (direction == "unchanged"), "Direction/zero wording contradicts quantities")
    require(direction != "decrease" or p <= 100, "Decrease exceeds complete removal")
    require(context != "share" or (b <= 100 and f <= 100), "Percentage-valued share outside zero to100")
    require(template != "percent-change-original" or f > 0, "Nonunique inverse complete decrease")
    multiplier = f / b
    require(max(multiplier.numerator, multiplier.denominator, (p/100).numerator, (p/100).denominator) <= 201,
            "Factor exceeds reviewed bounds")
    expected_label = ("Exact percent (without %)" if template == "percent-change-rate" else
                      "Exact price (dollars)" if context == "dollars" else "Exact quantity (units)")
    require(response.get("label") == expected_label, "Response label misstates requested unit")
    return {"template": template, "before": b, "after": f, "percent": p,
            "direction": direction, "context": context, "multiplier": multiplier,
            "answer": p if template == "percent-change-rate" else f if template == "percent-change-final" else b}


def solve_percent_change(public):
    return parsed(public)["answer"]


def worksheet_breadth(publics):
    values = [parsed(public) for public in publics]
    require(len(values) == 12 and len({v["template"] for v in values}) == 1, "Expected twelve questions from one percent task")
    require(len({(v["before"], v["after"]) for v in values}) == 12, "Repeated mathematical givens on worksheet")
    counts = Counter(v["direction"] for v in values)
    require(counts["increase"] >= 4 and counts["decrease"] >= 4 and counts["unchanged"] == 1, "Missing worksheet directions/unchanged quota")
    percentages = [v["percent"] for v in values]
    quantities = [v[k] for v in values for k in ("before", "after")]
    require(any(p.denominator == 1 and p > 0 for p in percentages) and any(p.denominator > 1 for p in percentages), "Missing integer/noninteger percentage")
    require(any(p.denominator == 3 for p in percentages), "Missing repeating exact percentage")
    require(any(q.denominator == 1 for q in quantities) and any(q.denominator > 1 for q in quantities), "Missing whole/nonwhole quantity")
    require(any(0 < q < 1 for q in quantities), "Missing positive below-one quantity")
    require(any(v["direction"] == "increase" and v["percent"] > 100 for v in values), "Missing above100percent growth")
    template = values[0]["template"]
    if template != "percent-change-original":
        require(any(v["after"] == 0 for v in values), "Missing complete decrease")
    context = "share" if template == "percent-change-rate" else "dollars"
    require(any(v["context"] == context for v in values), "Missing meaningful context quota")
    return values


class PercentChangeReview:
    def __init__(self):
        self.values = {template: [] for template in PERCENT_CHANGE}

    def record(self, public):
        self.values[public["templateId"]].append(parsed(public))

    def finish(self, expected_count):
        report = {}
        for template, values in self.values.items():
            require(len(values) == expected_count, "Incomplete percent runtime corpus")
            directions = Counter(v["direction"] for v in values)
            require(all(directions[k] >= 1 for k in ("increase", "decrease", "unchanged")), "Missing runtime direction stratum")
            require(any(v["percent"].denominator == 3 for v in values), "Missing ordinary repeating-rate generation")
            require(any(v["percent"].denominator in (2, 4) for v in values), "Missing noninteger finite percentage")
            require(any(v["before"] < 1 for v in values) and any(v["before"] > 1 for v in values), "Missing small/large bases")
            require(any(v["percent"] > 100 for v in values), "Missing above100 growth")
            require(any(v["direction"] == "increase" and v["percent"] == 100 for v in values), "Missing doubling boundary")
            if template != "percent-change-original":
                require(any(v["after"] == 0 for v in values), "Missing runtime complete decrease")
            require(len({v["answer"] for v in values}) >= 12, "Collapsed percent answer variation")
            report[template] = {"cases": len(values), "directions": dict(directions), "distinctAnswers": len({v["answer"] for v in values})}
        return report


def arithmetic(source):
    """Independent numeric expression evaluator; no eval and no floating point."""
    text = source.replace("−", "-")
    tokens = re.findall(r"[0-9]+(?:\.[0-9]+)?|[()+*/×÷%\-]", text)
    require("".join(tokens) == re.sub(r"\s+", "", text), "Unsupported worked arithmetic")
    index = 0

    def atom():
        nonlocal index
        require(index < len(tokens), "Missing worked operand")
        token = tokens[index]
        index += 1
        if token in ("+", "-"):
            value = atom()
            return value if token == "+" else -value
        if token == "(":
            value = addition()
            require(index < len(tokens) and tokens[index] == ")", "Unclosed worked grouping")
            index += 1
        else:
            require(re.fullmatch(r"[0-9]+(?:\.[0-9]+)?", token), "Invalid worked operand")
            value = Q(token)
        while index < len(tokens) and tokens[index] == "%":
            value /= 100
            index += 1
        return value

    def product():
        nonlocal index
        value = atom()
        while index < len(tokens) and tokens[index] in ("*", "×", "/", "÷"):
            op = tokens[index]
            index += 1
            other = atom()
            require(op not in ("/", "÷") or other != 0, "Worked division by zero")
            value = value * other if op in ("*", "×") else value / other
        return value

    def addition():
        nonlocal index
        value = product()
        while index < len(tokens) and tokens[index] in ("+", "-"):
            op = tokens[index]
            index += 1
            other = product()
            value = value + other if op == "+" else value - other
        return value

    require(tokens, "Empty worked expression")
    result = addition()
    require(index == len(tokens), "Trailing worked tokens")
    return result


def numeric_equalities(text):
    """Validate all complete numeric equality chains in a prose statement."""
    chains = re.findall(r"(?<![A-Za-z0-9])[-−+()0-9][0-9.\s()+*/×÷%−=\-]*=[0-9.\s()+*/×÷%−=\-]+", text)
    values = []
    for chain in chains:
        chain = chain.strip().rstrip(". ")
        sides = chain.split("=")
        evaluated = [arithmetic(side.strip()) for side in sides]
        require(len(set(evaluated)) == 1, f"False worked equality: {chain}")
        values.append(evaluated[0])
    return values


def fixture(template, prompt, label=None):
    return {"templateId": template, "prompt": prompt, "response": {"kind": "fraction", "label": label or ("Exact percent (without %)" if template.endswith("rate") else "Exact quantity (units)")}}


def review_percent_change_fixtures():
    rate, final, original = ("percent-change-" + part for part in ("rate", "final", "original"))
    good = [
        (fixture(rate, "A quantity increases from 80 units to 100 units. By what percent does it increase?" + INSTRUCTION), Q(25)),
        (fixture(rate, "A quantity decreases from 100 units to 80 units. By what percent does it decrease?" + INSTRUCTION), Q(20)),
        (fixture(rate, "A quantity increases from 3 units to 4 units. By what percent does it increase?" + INSTRUCTION), Q(100, 3)),
        (fixture(rate, "A price increases from 0.80 dollars to 0.90 dollars. By what percent does it increase?" + INSTRUCTION), Q(25, 2)),
        (fixture(rate, "The share of a group increases from 20% to 25%. What is the relative percent increase?" + INSTRUCTION), Q(25)),
        (fixture(rate, "A quantity is 80 units before and after a change. What is the percent change?" + INSTRUCTION), Q(0)),
        (fixture(final, "A quantity of 48 units increases by 12.5%. What is the final quantity, in units?"), Q(54)),
        (fixture(final, "A quantity of 12.50 units decreases by 100%. What is the final quantity, in units?"), Q(0)),
        (fixture(final, "A quantity of 3 units increases by 100/3 percent. What is the final quantity, in units?"), Q(4)),
        (fixture(final, "A price of 0.20 dollars increases by 150%. What is the final price, in dollars?", "Exact price (dollars)"), Q(1, 2)),
        (fixture(original, "A quantity decreases by 25% to 60 units. What was the original quantity, in units?"), Q(80)),
        (fixture(original, "A quantity increases by 100/3 percent to 4 units. What was the original quantity, in units?"), Q(3)),
        (fixture(original, "A price increases by 150% to 0.50 dollars. What was the original price, in dollars?", "Exact price (dollars)"), Q(1, 5)),
        (fixture(original, "A quantity changes by 0% to 80 units. What was the original quantity, in units?"), Q(80)),
    ]
    for public, answer in good:
        require(solve_percent_change(public) == answer, "Independent percent fixture mismatch")
    bad = [
        fixture(rate, good[0][0]["prompt"].replace("80 units", "0 units")),
        fixture(rate, good[0][0]["prompt"].replace("increases from", "decreases from")),
        fixture(rate, good[0][0]["prompt"].replace("100 units", "100.001 units")),
        fixture(rate, good[0][0]["prompt"].replace("By what percent", "By how many units")),
        fixture(rate, good[4][0]["prompt"].replace("relative percent", "percentage-point")),
        fixture(rate, good[4][0]["prompt"].replace("25%", "125%")),
        fixture(final, good[8][0]["prompt"].replace("100/3 percent", "100/3%")),
        fixture(final, "A quantity of 0.10 units increases by 0.5%. What is the final quantity, in units?"),
        fixture(original, "A quantity decreases by 100% to 0 units. What was the original quantity, in units?"),
        fixture(original, "A quantity decreases by 125% to 1 units. What was the original quantity, in units?"),
        fixture(final, "A quantity of 80 units increases by 0%. What is the final quantity, in units?"),
        fixture(original, "A quantity changes by 25% to 60 units. What was the original quantity, in units?"),
    ]
    for key, value in (("answer", "25"), ("figure", {"kind": "answer"})):
        mutated = copy.deepcopy(good[0][0]); mutated[key] = value; bad.append(mutated)
    for public in bad:
        rejected = False
        try:
            solve_percent_change(public)
        except (ValueError, ZeroDivisionError):
            rejected = True
        require(rejected, f"Accepted corrupt percent fixture: {public}")
    require(arithmetic("(100/3)%") == Q(1, 3), "Percentage grouping lost")
    require(arithmetic("60 ÷ (3/4)") == 80, "Inverse-factor grouping lost")
    require(numeric_equalities("Forward check: 80 × (1 − 25/100) = 60.") == [Q(60)], "Missing exact worked check")
    for text in ("80 × (1 − 25/100) = 75.", "3 × (1 + (100/3)/100) = 3.999."):
        rejected = False
        try:
            numeric_equalities(text)
        except ValueError:
            rejected = True
        require(rejected, "Accepted false worked arithmetic")
    return {"arithmeticCases": len(good), "rejectedMutations": len(bad)+2}


def publication_tree(html):
    from inequality_math_oracle import PublicationParser
    require(isinstance(html, str) and html.strip(), "Missing actual publication HTML")
    parser = PublicationParser(); parser.feed(html); parser.close()
    return parser.root


def percent_exercises(html):
    from inequality_math_oracle import PublicationNode
    tree = publication_tree(html)
    result = []
    for index, exercise in enumerate((n for n in tree.descendants() if n.has_class("exercise")), 1):
        nodes = list(exercise.descendants())
        require(not any(n.has_class("exercise") for n in nodes), "Nested percent exercise")
        headings = [n for n in nodes if n.tag == "h2"]
        require(len(headings) == 1 and headings[0].text().startswith(f"{index}. "), "Incorrect percent exercise numbering")
        require(not any(n.has_class("print-choices") for n in nodes), "Free-response worksheet has choices")
        lists = [n for n in nodes if n.tag == "ol"]
        require(len(lists) <= 1, "Multiple percent solution lists")
        steps = []
        if lists:
            children = [n for n in lists[0].children if isinstance(n, PublicationNode)]
            require(children and all(n.tag == "li" for n in children), "Malformed solution steps")
            steps = [n.text().strip() for n in children]
        answers = [n.text().strip() for n in nodes if n.tag == "strong" and n.text().startswith("Answer: ")]
        require(len(answers) <= 1 and bool(answers) == bool(steps), "Missing or leaked percent answer")
        result.append({"prompt": headings[0].text()[len(f"{index}. "):], "steps": steps,
                       "answer": answers[0][len("Answer: "):] if answers else None})
    require(len(result) == 12, "Missing percent publication exercises")
    return result


def check_publication_pair(record):
    workbook = percent_exercises(record["workbookHtml"])
    solutions = percent_exercises(record["solutionsHtml"])
    problems = record["problems"]
    require(record["replayed"] == problems, "Worksheet does not replay through ordinary runtime generator")
    worksheet_breadth([problem["public"] for problem in problems])
    for problem, blank, worked in zip(problems, workbook, solutions):
        require(blank["prompt"] == worked["prompt"] == problem["public"]["prompt"], "Workbook/key prompts differ from selected public question")
        require(blank["answer"] is None and not blank["steps"], "Workbook leaks solution")
        require(worked["steps"] == problem["explanation"], "Printed explanation differs from reviewed source")
        require(worked["answer"] == problem["answer"], "Printed answer differs from selected case")
        require(Q(problem["answer"]) == solve_percent_change(problem["public"]), "Wrong selected percent answer")
    return [(p["public"]["prompt"], p["answer"]) for p in problems]


def check_percent_registry(record):
    require(record.get("kind") == "percent-content-manifest" and record.get("runtimeSeeds") == 1024 and record.get("editions") == 16,
            "Incomplete percent content review manifest")
    templates = record["templates"]
    require(len(templates) == 3 and {t["id"] for t in templates} == PERCENT_CHANGE, "Missing percent template registration")
    for t in templates:
        require(t["version"] == 1 and t["skillId"] == "percent-change" and t["gradeBand"] == "6–8" and
                "requiredResponseCapability" not in t and "requiredFigureCapability" not in t,
                "Wrong percent metadata/capability")
    skill = record["skill"]
    require(skill["id"] == "percent-change" and skill["gradeBand"] == "7" and skill["strand"] == "ratio", "Wrong percent curriculum placement")
    require(set(skill["prerequisites"]) == {"percentages", "fraction-division", "decimal-arithmetic"}, "Missing explicit percent arithmetic prerequisites")
    require(record["coverageValid"] and record["defaultCoverage"] == record["overrideCoverage"], "Percent coverage lost under empty override")
    normalized = {row["input"]: row["actual"] for row in record["normalized"]}
    require(normalized == {"12.5": "25/2", "25/2": "25/2", ".125": "1/8", "0.125": "1/8", "12.5%": None, "1/0": None},
            "Exact decimal/fraction response normalization changed")
    require({row["input"]: row["accepted"] for row in record["protocol"]} == {
        "100/3": True, "200/6": True, "33.3333": False, "0.333333": False, "100/3%": False, "1/0": False},
        "Rounding/factor/invalid response accepted or equivalent exact response rejected")


def check_explanation(public, steps):
    v = parsed(public)
    b, f, p, m = (v[k] for k in ('before', 'after', 'percent', 'multiplier'))
    r, delta = p/100, abs(f-b)
    require(isinstance(steps, list) and all(isinstance(s, str) for s in steps), 'Missing percent explanation')
    for step in steps:
        numeric_equalities(step)
    token = r'([0-9]+(?:\.[0-9]+)?(?:/[1-9][0-9]*)?)'
    def calculation(index, expected, operation):
        matches = re.findall(token + r'\s*([+−×÷])\s*' + token + r'\s*=\s*' + token, steps[index])
        require(len(matches) == 1, 'Missing or ambiguous worked operation')
        a, op, c, result = matches[0]
        require(op == operation and (Q(a), Q(c), Q(result)) == expected, 'Worked operation uses wrong givens/base/factor')
    sign = '−' if v['direction'] == 'decrease' else '+'
    if v['template'].endswith('rate'):
        require(len(steps) == 7, 'Missing percent-rate reasoning/check')
        base = re.fullmatch(r'The original (quantity|share), '+token+r'(%)?, is the base for this change\.', steps[0])
        require(base and Q(base[2]) == b and (base[1] == 'share') == (v['context'] == 'share') and bool(base[3]) == (v['context'] == 'share'), 'Wrong original base/unit statement')
        calculation(1, (max(b,f), min(b,f), delta), '−')
        calculation(2, (delta,b,r), '÷')
        calculation(3, (r,Q(100),p), '×')
        conclusion = ('The quantity is unchanged, so the percent change is 0%.' if p == 0 else None)
        if conclusion:
            require(steps[4] == conclusion, 'Incorrect zero-change conclusion')
        else:
            found = re.fullmatch(r'The relative (increase|decrease) is ('+PERCENT+r')\.', steps[4])
            require(found and found[1] == v['direction'] and percent(found[2]) == p, 'Wrong percentage conclusion')
        calculation(5, (b,r,delta), '×')
        calculation(6, (b,delta,f), sign)
        require(('percentage point' in steps[1]) == (v['context'] == 'share'), 'Amount/percentage-point unit confusion')
    else:
        require(len(steps) == 5, 'Missing percent quantity reasoning/check')
        calculation(0, (p,Q(100),r), '÷')
        if p:
            calculation(1, (Q(1),r,m), sign)
        else:
            require(steps[1] == 'A 0% change leaves the original quantity unchanged; its multiplier is 1.', 'Wrong zero-change multiplier')
        if v['template'].endswith('final'):
            calculation(2, (b,r,delta), '×')
            calculation(3, (b,delta,f), sign)
            calculation(4, (b,m,f), '×')
        else:
            divisor = re.match(r'Divide the final quantity by '+token+r'\. Multiply by its reciprocal: ', steps[2])
            require(divisor and Q(divisor[1]) == m, 'Wrong inverse divisor')
            calculation(2, (f,1/m,b), '×')
            calculation(3, (b,r,delta), '×')
            calculation(4, (b,delta,f), sign)


def check_diagram(html, reverse):
    tree = publication_tree(html)
    svgs = [n for n in tree.descendants() if n.tag == 'svg' and n.attributes.get('data-lesson-illustration') == 'percent-change-bars']
    expected = [('recover',60)] if reverse else [('increase',100),('decrease',60)]
    require(len(svgs) == len(expected), 'Missing percent bar panel')
    for svg, (panel, final) in zip(svgs, expected):
        a = svg.attributes
        require(a.get('data-panel') == panel and a.get('viewbox',a.get('viewBox')) == '0 0 420 260', 'Wrong percent panel/window')
        require((Q(a['data-original']),Q(a['data-final']),Q(a['data-origin']),Q(a['data-unit-scale'])) == (80,final,25,Q('3.6')), 'False percent diagram metadata')
        require(a.get('aria-label') and a.get('role') == 'img', 'Missing meaningful diagram alternative')
        nodes = list(svg.descendants())
        for kind, count, y in [('original',4,72),('final',final//20,163)]:
            rects = [n for n in nodes if n.tag == 'rect' and n.attributes.get('data-bar') == kind]
            require(len(rects) == count, 'Wrong number of equal segments')
            for index, rect in enumerate(rects):
                a = rect.attributes
                require(a.get('data-interval') == f'{20*index},{20*(index+1)}', 'Wrong logical bar interval')
                require(tuple(Q(a[k]) for k in ('x','y','width','height')) == (25+72*index,y,72,40), 'Bar width/position does not encode twenty equal units')
        removed = [n for n in nodes if 'data-removed' in n.attributes]
        require(len(removed) == (final == 60), 'Removed amount is missing/extra')
        if removed:
            a = removed[0].attributes
            require(a['data-removed'] == '60,80' and tuple(Q(a[k]) for k in ('x','y','width','height')) == (241,163,72,40) and a.get('stroke-dasharray') and 'url(' in a['fill'], 'Removal lacks exact geometry/noncolor distinction')
    return len(svgs)


def check_lesson(record):
    lesson = record['lesson']; template = record['templateId']
    require(lesson['id'] == template and lesson['templateIds'] == [template], 'Wrong standalone lesson binding')
    worked = lesson['workedExample']
    prompt = worked['prompt'] + (INSTRUCTION if template.endswith('rate') else '')
    label = 'Exact price (dollars)' if template.endswith('original') else None
    require(Q(worked['answer']) == solve_percent_change(fixture(template,prompt,label)), 'Wrong standalone worked answer')
    text = []
    for section in lesson['sections']:
        text.extend(section['paragraphs'])
    text.extend(worked['steps'])
    for paragraph in text:
        numeric_equalities(paragraph)
    required = ['original quantity', 'final quantity', 'denominator', 'numerator', 'Percent means', 'base', 'by zero']
    joined = ' '.join(text)
    require(all(term.lower() in joined.lower() for term in required), 'Missing standalone prerequisite definition')
    if template.endswith('rate'):
        require('percentage point is' in joined and 'relative percent increase' in joined, 'Missing share/percentage-point distinction')
    if template.endswith('original'):
        require('reciprocal' in joined and 'Every positive original becomes zero' in joined and 'different base' in joined, 'Missing inverse nonuniqueness/base explanation')
    return check_diagram(record['html'], template.endswith('original'))


def check_notation(records):
    from print_math_oracle import math_roots, evaluate, tag
    for row in records:
        source, html = row['source'], row['html']
        tree = publication_tree(html)
        require(tree.text() == source, 'Percent notation changed original/currency text')
        roots = math_roots(html)
        if '100/3 percent' in source or '200/3 percent' in source:
            expected = Q(200,3) if '200/3' in source else Q(100,3)
            fractions = [n for root in roots for n in root.iter() if tag(n) == 'mfrac']
            require(any(evaluate(n) == expected for n in fractions), 'Exact recurring percent is not a stacked fraction')
        if '$' in source:
            require(not any('$' in n.attributes.get('data-plain','') for n in tree.descendants()), 'Currency interpreted as math delimiter')
        if source == '(100/3)% = 1/3.':
            require(roots and any(tag(n) in ('mi','mo') and ''.join(n.itertext()) == '%' for root in roots for n in root.iter()), 'Percent operator lost')
            fractions = [n for root in roots for n in root.iter() if tag(n) == 'mfrac']
            require([evaluate(n) for n in fractions] == [Q(100,3),Q(1,3)], 'Fractional percent grouping changed')


def check_content_records(records):
    require(records, 'Missing percent review records')
    manifest = records[0];check_percent_registry(manifest);check_notation(manifest['notation'])
    coverage = manifest['defaultCoverage']
    require(not coverage['fullyCovered'] and not coverage['allDeclaredFacetsReviewed'], 'Narrow family incorrectly certifies full percent skill')
    facets = {f['id']: f for f in coverage['facets']}
    require(facets['percent-change.core']['templateIds'] == [], 'Broad percent core overclaimed')
    for suffix, template in [('relative-change','rate'),('changed-quantity','final'),('original-quantity','original')]:
        require(facets['percent-change.'+suffix]['templateIds'] == ['percent-change-'+template], 'Missing narrow percent facet')
    review = PercentChangeReview(); seen=set(); editions=set(); lessons=set(); panels=0
    for record in records[1:]:
        kind = record.get('kind'); template = record.get('templateId')
        require(template in PERCENT_CHANGE, 'Unknown percent content record')
        if kind == 'percent-runtime':
            p=record['problem']; index=record['index']; identity=(template,index)
            require(type(index) is int and 0<=index<1024 and identity not in seen, 'Duplicate/out-of-range percent seed')
            seen.add(identity)
            require(p == record['replayed'] and p['public']['seed'] == f'percent-review-{index}' and p['public']['templateId'] == template, 'Nondeterministic/wrong percent runtime record')
            require(p['public']['templateVersion'] == 1 and p['public']['skillId'] == 'percent-change', 'Wrong public identity')
            require(Q(p['answer']) == solve_percent_change(p['public']), 'Wrong exact percent answer')
            check_explanation(p['public'],p['explanation']);review.record(p['public'])
        elif kind == 'percent-worksheet':
            identity=(template,record['edition'])
            require(record['edition'] in {str(n) for n in range(1,17)} and identity not in editions, 'Duplicate/invalid worksheet edition')
            editions.add(identity);check_publication_pair(record)
            for p in record['problems']:check_explanation(p['public'],p['explanation'])
        elif kind == 'percent-lesson':
            require(template not in lessons, 'Duplicate standalone lesson');lessons.add(template);panels+=check_lesson(record)
        else:raise ValueError('Unknown percent content record kind')
    require(len(editions)==48 and lessons==PERCENT_CHANGE, 'Missing reviewed editions/lessons')
    mutations = content_mutations(records)
    return {'runtime':review.finish(1024),'worksheetEditions':len(editions),'lessons':len(lessons),'exactBarPanels':panels,'rejectedContentMutations':mutations}


def content_mutations(records):
    """Prove scoped guards fail closed against concrete public/rendered corruptions."""
    count = 0
    def rejected(operation):
        nonlocal count
        try:
            operation()
        except (ValueError, ZeroDivisionError, KeyError):
            count += 1
            return
        raise ValueError('Percent content guard accepted corruption')
    problem = next(r['problem'] for r in records if r['kind']=='percent-runtime')
    steps = problem['explanation']
    rejected(lambda: check_explanation(problem['public'], steps[:-1]))
    bad = steps.copy();bad[2] = 'Change as a fraction of the original: 1 ÷ 1 = 1.'
    rejected(lambda: check_explanation(problem['public'], bad))
    original = next(r['problem'] for r in records if r['kind']=='percent-runtime' and r['templateId'].endswith('original'))
    bad = original['explanation'].copy();bad[2] = re.sub(r'by [0-9./]+\.', 'by 99.', bad[2], count=1)
    rejected(lambda: check_explanation(original['public'], bad))
    worksheet = next(r for r in records if r['kind']=='percent-worksheet')
    publics = [p['public'] for p in worksheet['problems']]
    rejected(lambda: worksheet_breadth(publics[:-1]))
    rejected(lambda: worksheet_breadth([publics[0]]*12))
    zero = next(p for p in publics if parsed(p)['direction']=='unchanged')
    bad = publics.copy();bad[next(i for i,p in enumerate(bad) if parsed(p)['direction']!='unchanged')] = zero
    rejected(lambda: worksheet_breadth(bad))
    lesson = next(r for r in records if r['kind']=='percent-lesson')
    bad = copy.deepcopy(lesson);bad['lesson']['workedExample']['answer']='999'
    rejected(lambda: check_lesson(bad))
    rejected(lambda: check_diagram(lesson['html'].replace('width="72"','width="71"',1),False))
    rejected(lambda: check_diagram(lesson['html'].replace('data-interval="0,20"','data-interval="0,21"',1),False))
    bad = copy.deepcopy(records[0]['notation']);bad[0]['html']=bad[0]['html'].replace('<mn>100</mn>','<mn>10</mn>')
    rejected(lambda: check_notation(bad))
    bad = copy.deepcopy(worksheet);bad['solutionsHtml']=bad['solutionsHtml'].replace('Answer: ', 'Key: ',1)
    rejected(lambda: check_publication_pair(bad))
    return count


def review_percent_change_content():
    root=Path(__file__).resolve().parent.parent
    result=subprocess.run(['node','--import','tsx','scripts/percent-change-content-oracle.ts'],cwd=root,capture_output=True,text=True,timeout=120)
    require(result.returncode == 0, f'Percent evidence exporter failed: {result.stderr}')
    return check_content_records([json.loads(line) for line in result.stdout.splitlines()])


if __name__ == '__main__':
    import sys
    print(json.dumps(review_percent_change_fixtures()))
    if len(sys.argv)>1:
        with open(sys.argv[1]) as stream:
            print(json.dumps(check_content_records([json.loads(line) for line in stream])))
