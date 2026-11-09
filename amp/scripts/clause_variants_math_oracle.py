"""Independent clause checks, derived from learner-visible prompts and figures.

The private answer and grading rules are checked against a second derivation;
they never supply the givens. Arithmetic uses fractions, including recurring
decimals, and the plotted triangle is found by searching the displayed lattice.
"""
import copy
import json
import math
import re
import sys
from fractions import Fraction as F

SUPPORTED = frozenset({"angle-recognize", "triangle-construct-plot", "fraction-to-decimal-long-division"})
REVIEW_RETURNS_ANSWER = True


def require(condition, message):
    if not condition:
        raise ValueError(message)


def compact(value):
    return json.dumps(value, separators=(",", ":"))


def spans(text):
    return re.findall(r"\$([^$]+)\$", text)


def plain(text):
    return text.replace("−", "-").replace("$", "").replace("\\left", "").replace("\\right", "")


TOKEN = re.compile(r"\s*(\\(?:[dt]?frac|sqrt|times|cdot|div|pi)|\d+(?:\.\d+)?|[a-zA-Z]|[-+*/(){}\[\]^])")


def value(text, env=None):
    """Restricted arithmetic reader; never evaluates Python or JavaScript."""
    env = env or {}
    text = plain(text).replace("×", "\\times").replace("÷", "\\div").replace("²", "^2").replace("³", "^3")
    text = text.strip().rstrip("°")
    recurring = re.fullmatch(r"(-?)(\d+)\.(\d*)\\overline\{(\d+)\}", text)
    if recurring:
        sign, whole, prefix, cycle = recurring.groups()
        number = F(whole) + F(int(prefix or "0"), 10 ** len(prefix)) + F(int(cycle), 10 ** len(prefix) * (10 ** len(cycle) - 1))
        return -number if sign else number
    while "|" in text:
        match = re.search(r"\|([^|]+)\|", text)
        require(match is not None, f"Unpaired absolute-value bar: {text}")
        text = text[:match.start()] + f"({abs(value(match[1], env))})" + text[match.end():]
    tokens, at = [], 0
    while at < len(text):
        if not text[at:].strip():
            break
        match = TOKEN.match(text, at)
        require(match is not None, f"Unsupported arithmetic {text!r} at {at}")
        tokens.append(match[1]); at = match.end()
    pos = 0

    def peek():
        return tokens[pos] if pos < len(tokens) else None

    def take(expected=None):
        nonlocal pos
        token = peek()
        require(token is not None and (expected is None or token == expected), f"Expected {expected} in {text}")
        pos += 1
        return token

    def group(left="{", right="}"):
        take(left); result = expression(); take(right)
        return result

    def atom():
        token = peek()
        if token == "(":
            return group("(", ")")
        if token == "{":
            return group()
        if token in ("\\frac", "\\dfrac", "\\tfrac"):
            take(); numerator = group(); denominator = group()
            return numerator / denominator
        if token == "\\sqrt":
            take(); degree = 2
            if peek() == "[":
                take(); degree = int(take()); take("]")
            radicand = group()
            require(radicand >= 0, "Nonnegative root required")
            if isinstance(radicand, F):
                n = round(radicand.numerator ** (1 / degree))
                d = round(radicand.denominator ** (1 / degree))
                if n ** degree == radicand.numerator and d ** degree == radicand.denominator:
                    return F(n, d)
            return float(radicand) ** (1 / degree)
        if token == "\\pi":
            take(); return math.pi
        if token is not None and re.fullmatch(r"\d+(?:\.\d+)?", token):
            return F(take())
        if token in env:
            take(); return F(env[token])
        raise ValueError(f"Unexpected arithmetic token {token} in {text}")

    def power():
        result = atom()
        if peek() == "^":
            take()
            exponent = group() if peek() == "{" else F(take())
            require(exponent.denominator == 1, "Integer exponents only")
            result **= int(exponent)
        return result

    def unary():
        if peek() in ("+", "-"):
            sign = take(); result = unary()
            return -result if sign == "-" else result
        return power()

    def product():
        result = unary()
        while True:
            token = peek()
            if token in ("\\times", "\\cdot", "*", "\\div", "/"):
                take(); operand = unary()
                result = result / operand if token in ("\\div", "/") else result * operand
            elif token is not None and (token in ("(", "\\frac", "\\dfrac", "\\tfrac", "\\sqrt", "\\pi") or token in env):
                result *= unary()
            else:
                return result

    def expression():
        result = product()
        while peek() in ("+", "-"):
            op = take(); operand = product()
            result = result + operand if op == "+" else result - operand
        return result

    result = expression()
    require(pos == len(tokens), f"Trailing arithmetic tokens in {text}")
    return result


def equal(a, b):
    return a == b if isinstance(a, F) and isinstance(b, F) else math.isclose(float(a), float(b), rel_tol=1e-12, abs_tol=1e-12)


def choose(options, predicate):
    ids = [o["id"] for o in options if predicate(o["label"])]
    require(len(ids) == 1, f"Expected exactly one correct option, found {ids}: {options}")
    require(len({o["label"] for o in options}) == len(options), "Duplicate labels")
    return ids[0]


def numeric_choice(public, expected):
    response = public["response"]
    if response["kind"] in ("number", "fraction"):
        return str(expected)
    values = [value(option["label"]) for option in response["options"]]
    require(all(not equal(left, right) for i, left in enumerate(values) for right in values[i+1:]),
            "Numeric distractors must have distinct values")
    return choose(response["options"], lambda text: equal(value(text), expected))


def elements(public):
    figure = public.get("figure", {})
    return figure.get("scene", {}).get("elements", [])


def decimal_expansion(n, d):
    sign = "-" if n < 0 else ""
    whole, remainder = divmod(abs(n), d)
    digits, seen, steps = [], {}, []
    while remainder and remainder not in seen:
        seen[remainder] = len(digits)
        digit, remainder = divmod(10 * remainder, d)
        digits.append(str(digit)); steps.append((digit, remainder))
    start = seen.get(remainder, len(digits))
    prefix, cycle = "".join(digits[:start]), "".join(digits[start:])
    text = f"{sign}{whole}." + prefix + (f"\\overline{{{cycle}}}" if cycle else "")
    return text, steps, remainder


def numbers(text):
    return [F(x) for x in re.findall(r"(?<![a-zA-Z])[-−]?\d+(?:\.\d+)?", plain(text))]


def equation_value(text):
    """Value of a displayed equality chain; reject a false intermediate step."""
    sides = plain(text).split("=")
    values = [value(s) for s in sides]
    require(all(equal(v, values[0]) for v in values), f"False displayed equality: {text}")
    return values[0]


def relation(text):
    match = re.fullmatch(r"(.+?)\s*(<|>|=)\s*(.+)", plain(text))
    require(match is not None, f"Expected comparison: {text}")
    a, b = value(match[1]), value(match[3])
    return a < b if match[2] == "<" else a > b if match[2] == ">" else a == b


def line_marks(public):
    lines = [e for e in elements(public) if e["type"] == "numberLine"]
    require(len(lines) == 1, "One public number line expected")
    return lines[0].get("marks", [])


def zero_meaning(public):
    prompt, response = public["prompt"], public["response"]
    references = [
        ("above sea level", "sea level"), ("freezing point", "water's freezing point"),
        ("Positive balances", "no money available and no debt"),
        ("line of scrimmage", "the line of scrimmage"),
        ("ground floor", "the ground floor"), ("after launch", "the instant of launch"),
        ("above par", "a score equal to par"), ("excess positive charge", "equal amounts of positive and negative charge"),
    ]
    matches = [reference for marker, reference in references if marker in prompt]
    require(len(matches) == 1, "Exactly one signed reference convention")
    reference = matches[0]
    if response["kind"] == "choice":
        return choose(response["options"], lambda t: t == reference)
    n = F(re.search(r"recorded value of ([−\d.-]+)", prompt)[1].replace("−", "-"))
    return compact({b["id"]: choose(b["options"], (lambda t: value(t) == n) if b["label"] == "Signed value" else (lambda t: t == reference)) for b in response["blanks"]})


def opposite(public):
    prompt = public["prompt"]
    if public["response"]["kind"] in ("number", "fraction"):
        marks = line_marks(public)
        require(len(marks) == 1 and marks[0]["label"] == "P", "Opposite of the named point")
        return str(-F(str(marks[0]["at"])))
    expected = "0" if "Which number" in prompt else "0 is its own opposite: it is 0 units from 0 on both sides."
    return choose(public["response"]["options"], lambda t: t == expected)


def position(public):
    prompt, options = public["prompt"], public["response"]["options"]
    if "increasing to the right" in prompt:
        expr = spans(prompt)[0]
        a, b = numbers(expr)
        require(relation(expr), "Prompt comparison is true")
        side = "right" if a > b else "left"
        return choose(options, lambda t: f"to the {side} of" in t)
    marks = line_marks(public)
    prompt_values = numbers(prompt)
    require([F(str(m["at"])) for m in marks] == prompt_values, "Figure agrees with endpoints")
    return choose(options, relation)


def distance(public):
    prompt, response = public["prompt"], public["response"]
    if "absolute value" in prompt:
        marks = line_marks(public)
        if response["kind"] in ("number", "fraction"):
            require(len(marks) == 1, "One absolute-value point")
            return str(abs(F(str(marks[0]["at"]))))
        k = numbers(prompt)[0]
        correct_points = {m["label"] for m in marks if abs(F(str(m["at"]))) == k}
        ids = [o["id"] for o in response["options"] if plain(o["label"]).split()[-1] in correct_points]
        require(len(ids) == response["selectionCount"] == 2, "Exactly two points at that distance")
        return compact(sorted(ids))
    a, b = numbers(prompt)
    expected = abs(a - b)
    if response["kind"] == "multi-select":
        require([F(str(m["at"])) for m in line_marks(public)] == [a, b], "Distance figure endpoints")
        ids = [o["id"] for o in response["options"] if value(o["label"]) == expected]
        require(len(ids) == response["selectionCount"] == 2, "Only both subtraction orders give distance")
        return compact(sorted(ids))
    return str(expected)


def context_order(public):
    prompt, options = public["prompt"], public["response"]["options"]
    if "Which inequality" in prompt:
        return choose(options, relation)
    comparison = spans(prompt)[0]
    require(relation(comparison), "Context comparison must be true")
    a, b = numbers(comparison)

    def true_statement(text):
        ns = numbers(text)
        if len(ns) == 2:
            first, second = ns
            if any(w in text for w in ("warmer", "higher", "greater", "later")):
                return first > second
            if any(w in text for w in ("colder", "lower", "smaller", "earlier")):
                return first < second
        if "Both quantities are positive" in text:
            return a > 0 and b > 0
        if "above 0" in text or "positive" in text:
            return a > 0
        if "The first quantity" in text:
            return a < b
        raise ValueError(f"Unreviewed context statement {text}")

    return choose(options, true_statement)


def story(public):
    prompt, response = public["prompt"], public["response"]
    if "towel bar" in prompt:
        bar, door = [value(s) for s in spans(prompt)]
        estimated = (math.floor(door + F(1, 2)) - math.floor(bar + F(1, 2))) / F(2)
        exact = (door - bar) / 2
        require(door > bar > 0, "The centered bar fits")
        bank = response["banks"][0]["options"]
        selected = choose(bank, lambda t: equation_value(t) == estimated)
        return compact([[selected], [str(exact)]])
    source = re.search(r"temperature was \$(.+?)\$°C\. It rose ([\d.]+)°C, then fell \$(.+?)\$°C each hour for (\d+) hours", prompt)
    require(source is not None, "Read all signed temperature changes")
    start, rise, fall, hours = value(source[1]), F(source[2]), value(source[3]), int(source[4])
    result = start + rise - hours * fall
    if response["kind"] in ("number", "fraction"):
        return str(result)
    estimate = math.floor(start + F(1, 2)) + math.floor(rise + F(1, 2)) - math.floor(hours * fall + F(1, 2))
    candidate_values = [equation_value(o["label"].split(";")[0]) for o in response["options"]]
    require(len(set(candidate_values)) == len(candidate_values), "Distinct estimates")
    return choose(response["options"], lambda t: equation_value(t.split(";")[0]) == estimate and "not reasonable" in t)


def jumps(public):
    prompt = public["prompt"]
    if "temperature" in prompt:
        p, q = numbers(prompt)
        change = q if "rising" in prompt else -q
        endpoint = p + change
    else:
        expr = spans(prompt)[0]
        p = numbers(expr)[0]
        endpoint = value(expr)
    correct = []
    for option in public["response"]["options"]:
        es = option["scene"]["elements"]
        line = next((e for e in es if e["type"] == "numberLine"), None)
        if line is not None:
            hop = line["hops"][0]
            start, end = F(str(hop["from"])), F(str(hop["from"])) + F(str(hop["by"]))
        else:
            arrow = next(e for e in es if e["type"] == "arrow")
            start, end = F(str(arrow["from"][1])), F(str(arrow["to"][1]))
        require(numbers(option["label"]) == [start, end], "Figure-choice description agrees with arrow")
        if start == p and end == endpoint:
            correct.append(option["id"])
    require(len(correct) == 1, "Exactly one correct signed walk")
    return correct[0]


def changes(public):
    prompt, response = public["prompt"], public["response"]
    if "regrouping" in prompt:
        expected = value(spans(prompt)[0])
        values = [equation_value(o["label"]) for o in response["options"]]
        require(len(set(values)) == len(values), "Distinct regrouping values")
        return choose(response["options"], lambda t: equation_value(t) == expected)
    if response["kind"] == "multi-select":
        options = response["options"]
        ns = [numbers(o["label"])[0] for o in options]
        pairs = [(i, j) for i in range(len(ns)) for j in range(i + 1, len(ns)) if ns[i] + ns[j] == 0]
        require(len(pairs) == 1, "Exactly one cancelling pair in the table")
        return compact(sorted(options[i]["id"] for i in pairs[0]))

    def net(text):
        ns = numbers(text)
        if "twice" in text:
            return 2 * ns[0]
        first, second = ns
        return (-first if "descends" in text.split(",")[0] else first) + (second if "then rises" in text else -second)

    return choose(response["options"], lambda text: net(text) == 0)


def inverse_or_rewrite(public):
    prompt, response = public["prompt"], public["response"]
    if prompt == "Which sum equals 0?":
        return choose(response["options"], lambda t: value(t) == 0)
    expr = spans(prompt)[0]
    if "must be added" in prompt:
        return str(-value(expr))
    result = value(expr)
    if response["kind"] == "choice":
        values = [value(o["label"]) for o in response["options"]]
        require(len(set(values)) == len(values), "Distinct rewrite values")
        return choose(response["options"], lambda t: value(t) == result)
    return str(result)


def product_strategy(public):
    expected = value(spans(public["prompt"])[0])
    options = public["response"]["options"]
    values = [equation_value(o["label"]) for o in options]
    require(len(set(values)) == len(values), "Distinct multiplication strategy values")
    return choose(options, lambda t: equation_value(t) == expected)


def multiplication(public):
    prompt, response = public["prompt"], public["response"]
    if prompt == "Which expression is undefined?":
        def undefined(text):
            try:
                value(text)
                return False
            except ZeroDivisionError:
                return True
        return choose(response["options"], undefined)
    if prompt.startswith("What is"):
        return str(value(spans(prompt)[0]))
    if "Continue the pattern" in prompt:
        return compact({b["id"]: choose(b["options"], lambda text, b=b: value(text) == value(b["label"])) for b in response["blanks"]})
    if "What must" in prompt:
        return str(value(spans(prompt)[-1]))
    if "uses distribution" in prompt:
        def distributed(text):
            if "the second product" not in text:
                return False
            equation_value(spans(text)[0])
            return True
        return choose(response["options"], distributed)
    require("Which situation is described" in prompt, "Known multiplication clause")
    expected = equation_value(spans(prompt)[0])

    def scenario(text):
        ns = numbers(text)
        if "fees" in text:
            a, b = ns
            return a * b * (1 if "cancelled" in text else -1)
        if "tank" in text:
            rate, count = ns
            if "per minute for" in text:
                return rate * count * (-1 if "drains" in text else 1)
            if "then gains" in text:
                return count - rate
            return -rate / count
        if "temperature" in text:
            total, rate = ns
            if "find the hours" in text:
                return total / rate
            if "signed change per hour" in text:
                return rate
            if "each hour" in text:
                return total * rate * (1 if "rises" in text else -1)
            return -total - rate
        a, b = ns
        if "deposited" in text:
            return a - b
        if "each owe" in text:
            return -a * b
        if "debts of" in text:
            return a / b
        if "debt of" in text:
            return -a / b
        if "shared among" in text or "divided among" in text:
            return a / b
        raise ValueError(f"Unreviewed multiplication scenario: {text}")

    values = [scenario(o["label"]) for o in response["options"]]
    require(len(set(values)) == len(values), "Distinct signed scenario values")
    return choose(response["options"], lambda text: equal(scenario(text), expected))


def root_equation(public):
    expr = spans(public["prompt"])[0]
    match = re.fullmatch(r"x\^\{([23])\}=(.+)", expr)
    require(match is not None, "Square/cube equation")
    exponent, radicand = int(match[1]), value(match[2])
    require(radicand > 0, "Default equation has a positive radicand")

    def solutions(text):
        text = plain(text)
        branches = re.split(r"\\text\{ or \}", text)
        roots = [value(branch.split("=")[1]) for branch in branches]
        return len(roots) == (1 if exponent == 3 else 2) and len(set(roots)) == len(roots) and all(equal(x ** exponent, radicand) for x in roots)

    return choose(public["response"]["options"], solutions)


def classify(public):
    if public["prompt"].startswith(("Does the decimal", "Why must the decimal", "Use long division")):
        return decimal_division(public)
    response = public["response"]
    if response["kind"] == "multi-part-choice":
        def kind(text):
            n = value(text)
            if not isinstance(n, F):
                return "goes on forever without repeating"
            den = n.denominator
            for prime in (2, 5):
                while den % prime == 0:
                    den //= prime
            return "terminates" if den == 1 else "repeats forever"
        return compact({b["id"]: choose(b["options"], lambda text, b=b: text == kind(b["label"])) for b in response["blanks"]})
    if "Which statement" in public["prompt"]:
        return choose(response["options"], lambda text: "is irrational" in text and "never ends or repeats" in text)
    return choose(response["options"], lambda text: not isinstance(value(text), F))


def locate_root(public):
    root = value(spans(public["prompt"])[0])
    nearest = F(math.floor(float(root) * 10 + .5), 10)
    ids = []
    for option in public["response"]["options"]:
        line = next(e for e in option["scene"]["elements"] if e["type"] == "numberLine")
        require(len(line["marks"]) == 1, "One root estimate per number line")
        plotted = F(str(line["marks"][0]["at"]))
        require(math.isclose(float(plotted), float(numbers(option["label"])[-1]), abs_tol=1e-12), "Root label agrees with plotted location")
        if equal(plotted, nearest):
            ids.append(option["id"])
    require(len(ids) == 1, "One nearest-tenth location")
    return ids[0]


def narrow_root(public):
    radicand = int(re.search(r"\\sqrt\{(\d+)\}", public["prompt"])[1])
    response = public["response"]
    if response["kind"] == "choice":
        return choose(response["options"], lambda text: "Square neighboring hundredths" in text and "opposite sides" in text)
    def contains(text):
        low, high = numbers(text)
        return low * low < radicand < high * high
    return compact({b["id"]: choose(b["options"], contains) for b in response["blanks"]})


def closure(public):
    prompt, options = public["prompt"], public["response"]["options"]
    if prompt.startswith("Why must the rational factor"):
        return choose(options, lambda t: "Multiplication by 0 gives 0" in t and "dividing by 0" in t)
    if prompt.startswith("Suppose"):
        source = spans(prompt)[0]
        irrational = re.search(r"\\sqrt\{\d+\}|\\pi", source)[0]
        left = source.split("=")[0].replace(irrational, "z")
        for a, b in ((13, 7), (-11, 5)):
            coefficient = value(left, {"z": 1}) - value(left, {"z": 0})
            shift = value(left, {"z": 0})
            expected = (F(a, b) - shift) / coefficient
            def correct(text):
                if "contradicting its irrationality" not in text:
                    return False
                eq = spans(text)[0]
                require(eq.startswith(irrational + "="), "Undo names the irrational term")
                return value(eq.split("=")[1], {"a": a, "b": b}) == expected
            selected = choose(options, correct)
        return selected
    symbolic = prompt.startswith("For integers")
    if symbolic:
        expression = spans(prompt)[-1]
        def correct(text):
            if "numerator and denominator are integers" not in text or "bd\\ne0" not in text:
                return False
            candidate = spans(text)[0]
            return all(value(candidate, env) == value(expression, env) for env in ({"a": 2,"b": 3,"c": 5,"d": 7}, {"a": -3,"b": 2,"c": 4,"d": -5}))
        return choose(options, correct)
    expected = value(spans(prompt)[0])
    return choose(options, lambda text: text.startswith("It equals") and value(spans(text)[0]) == expected)


def decimal_division(public):
    fraction = value(spans(public["prompt"])[0])
    require(isinstance(fraction, F), "Long-division source is rational")
    text, steps, repeat = decimal_expansion(fraction.numerator, fraction.denominator)
    response, prompt = public["response"], public["prompt"]
    if response["kind"] == "structured-work":
        expected = [[str(d), str(r)] for d, r in steps]
        bank = response["banks"][0]["options"]
        expected.append([choose(bank, lambda label: value(label) == fraction)])
        require(len(response["rows"]) == len(expected), "One row per division and final decimal")
        return compact(expected)
    if prompt.startswith("Does the decimal"):
        def correct(label):
            if not label.startswith("It repeats:" if repeat else "It terminates:"):
                return False
            require(value(spans(label)[0]) == fraction, "Reason includes the correct expansion")
            if repeat:
                return f"remainder {repeat} returns" in label
            return "remainder reaches 0" in label
        return choose(response["options"], correct)
    if prompt.startswith("Why must the decimal"):
        require(repeat != 0, "A must-repeat question uses a nonterminating fraction")
        return choose(response["options"], lambda label: (f"1 through {fraction.denominator-1}" in label or f"1–{fraction.denominator-1}" in label) and ("remainder must return" in label or "one returns" in label))
    return choose(response["options"], lambda label: value(label) == fraction)


def degrees(public):
    prompt, response = public["prompt"], public["response"]
    if "shaded angle" in prompt:
        es = elements(public)
        arc = next(e for e in es if e["type"] == "arc")
        expected = F(str(arc["to"])) - F(str(arc["from"]))
        paths = [e for e in es if e["type"] == "path"]
        require(sum(len(e["d"]) // 2 for e in paths) == 360 and sum(len(e["d"]) // 2 for e in paths if e["width"] > 1) == 36, "360 degree ticks, heavier every ten")
    elif "what fraction" in prompt:
        expected = numbers(prompt)[0] / 360
    elif "turns through $" in prompt:
        expected = value(spans(prompt)[0]) * 360
    else:
        expected = numbers(prompt)[0]
    return numeric_choice(public, expected)


def angle_equation(public):
    prompt = public["prompt"]
    measurements = re.findall(r"[Aa]ngle \$([A-Z]{3})\$ measures \$\(([^$]+)\)\$°", prompt)
    if len(measurements) == 2:
        e1, e2 = measurements[0][1], measurements[1][1]
        b, d = value(e1, {"x": 0}), value(e2, {"x": 0})
        a, c = value(e1, {"x": 1}) - b, value(e2, {"x": 1}) - d
        vertical = "cross at" in prompt
        x = (d-b)/(a-c) if vertical else (90-b-d)/(a+c)
        require(x.denominator == 1, "Generated angle equation has an integer x")
        measure = {name: value(expr, {"x": x}) for name, expr in measurements}
        require(all(0 < v < 180 for v in measure.values()), "Positive non-reflex angles")
        if vertical:
            require(len(set(measure.values())) == 1 and next(iter(measure.values())) != 90, "Distinct adjacent and vertical measures")
        else:
            require(sum(measure.values()) == 90, "Complementary parts sum to90")
        if "Find the value of $x$" in prompt:
            expected = x
        else:
            request = re.search(r"(?:Find angle|measure of angle) \$([A-Z]{3})\$", prompt)[1]
            expected = 180 - next(iter(measure.values())) if vertical else (90 + measure["EBD"] if request == "ABD" else measure[request])
    else:
        known = re.search(r"Angle \$ABD\$ is (\d+)°", prompt)
        require(known is not None, "Numeric right-angle split")
        measure = {"ABD": F(known[1])}
        expected, x = 90 - F(known[1]), None
    figure = public["figure"]
    require(figure["kind"] == "angle-rays", "An angle equation has its ray figure")
    labels, rays = figure["points"], figure["rays"]
    for name, size in measure.items():
        first, last = labels.index(name[0]), labels.index(name[2])
        delta = (rays[first] - rays[last]) % 360
        actual = min(delta, 360 - delta)
        require(math.isclose(float(size), actual, abs_tol=1e-10), "Drawn angle matches its named expression")
    return str(expected)


def whole_angle(public):
    a, b = numbers(public["prompt"])
    def correct(text):
        expr = plain(text).split("=")
        return expr[0] == "x" and value(expr[1]) == a+b
    return choose(public["response"]["options"], correct)


def construct_triangle(public):
    response, prompt = public["response"], public["prompt"]
    require(response["kind"] == "point-plot", "Construct by plotting")
    given = {p["label"]: (p["x"], p["y"]) for p in response["given"]["vertices"]}
    ax, ay = given["A"]; bx, by = given["B"]
    require(ay == by == 0 and ax != bx and "above" in prompt, "Horizontal distinct base, above requested")
    stated = re.search(r"A\((\d+),0\).*B\((\d+),0\).*length (\d+)", prompt)
    require(stated is not None and list(map(int, stated.groups())) == [ax, bx, abs(bx-ax)], "Base figure matches named endpoints")
    lengths = {name: int(n) for name, n in re.findall(r"\$(AC|BC)=(\d+)\$", prompt)}
    equal = "each 45°" in prompt
    angles = {"A": 45, "B": 45} if equal else {name: int(n) for name, n in re.findall(r"[Aa]ngle \$([AB])\$ is (45|90)°", prompt)}
    require(len(lengths) + len(angles) == 2, "Exactly two further triangle conditions")
    g = response["grid"]
    candidates = []
    for x in range(g["xMin"], g["xMax"]+1, g["step"]):
        for y in range(max(1, g["yMin"]), g["yMax"]+1, g["step"]):
            distances = {"AC": (x-ax)**2+y*y, "BC": (x-bx)**2+y*y}
            if any(distances[name] != n*n for name, n in lengths.items()):
                continue
            accepted = True
            for name, angle in angles.items():
                ox, tx = (ax, bx) if name == "A" else (bx, ax)
                u, v = (tx-ox, 0), (x-ox, y)
                dot = u[0]*v[0]
                if angle == 90:
                    accepted &= dot == 0
                else:
                    accepted &= dot > 0 and 2*dot*dot == u[0]**2*(v[0]**2+v[1]**2)
            if accepted:
                candidates.append([x,y])
    require(len(candidates) == 1, f"Unique lattice construction, found {candidates}")
    return compact(candidates)


def recognize_angle(public):
    prompt, response = public["prompt"], public["response"]
    if response["kind"] == "figure-choice":
        ids = []
        for option in response["options"]:
            rays = [e for e in option["scene"]["elements"] if e["type"] == "segment" and e.get("arrow") == "end"]
            is_angle = len(rays) == 2 and rays[0]["from"] == rays[1]["from"] and rays[0]["to"] != rays[1]["to"]
            if is_angle != ("does not show" in prompt):
                ids.append(option["id"])
        require(len(ids) == 1, "One shared-endpoint answer")
        return ids[0]
    if response["kind"] in ("number", "fraction"):
        rays = [e for e in elements(public) if e["type"] == "segment" and e.get("arrow") == "end"]
        require(len(rays) == int(re.match(r"(\d+) rays", prompt)[1]), "Counted rays agree with figure")
        require(all(e["from"] == rays[0]["from"] for e in rays), "Shared origin")
        n = len(rays)
        return str(n*(n-1)//2)
    if "formed by rays" in prompt:
        ray1, ray2 = spans(prompt)
        require(ray1[0] == ray2[0] and ray1[1] != ray2[1], "Two rays from common vertex")
        def correct(label):
            name = plain(label).replace("\\angle", "").strip()
            return len(name) == 3 and name[1] == ray1[0] and {name[0],name[2]} == {ray1[1],ray2[1]}
        return choose(response["options"], correct)
    name = spans(prompt)[0].replace("\\angle", "").strip()
    return choose(response["options"], lambda label: plain(label) == name[1])


def triangle_story(public):
    prompt, es = public["prompt"], elements(public)
    labels = [e["text"] for e in es if e["type"] == "text"]
    roles = {}
    for label in labels:
        typeset = re.fullmatch(r"\\text\{([^{}]+)\}", label)
        if typeset:
            label = typeset[1]
        match = re.fullmatch(r"(.+): ([?\d.]+) (ft|in|m)", label)
        if match:
            roles[match[1]] = None if match[2] == "?" else F(match[2])
    slants = {"ladder", "diagonal", "path", "ramp", "wire"} & roles.keys()
    require(len(slants) == 1 and len(roles) == 3, "Scenario names two legs and one hypotenuse")
    slant = next(iter(slants)); hyp = roles[slant]
    legs = [n for name, n in roles.items() if name != slant]
    missing = public["templateId"] == "right-triangle-missing-leg"
    visible = [n for n in roles.values() if n is not None]
    stated = numbers(prompt)
    require(sorted(visible) == sorted(stated), "Story quantities agree with figure labels")
    if missing:
        known = next(n for n in legs if n is not None)
        require(hyp is not None and 0 < known < hyp and legs.count(None) == 1, "Positive missing leg shorter than hypotenuse")
        square = hyp*hyp-known*known
    else:
        require(hyp is None and all(n is not None and n > 0 for n in legs), "Two known positive legs")
        square = sum(n*n for n in legs)
    if "nearest tenth" in prompt:
        root = math.sqrt(float(square))
        expected = F(math.floor(root*10+.5), 10)
    else:
        require(square.denominator == 1, "Whole triple square")
        root = math.isqrt(square.numerator)
        require(root*root == square, "An exact whole-length story uses a triple")
        expected = F(root)
    if "How much shorter" in prompt:
        expected = sum(legs)-expected
    return numeric_choice(public, expected)


def circle_derivation(public):
    prompt = public["prompt"]
    center = re.search(r"C\((-?\d+),(-?\d+)\)", prompt)
    require(center is not None, "Given center")
    h, k = map(int, center.groups())
    radius_text = re.search(r"radius \$(.+?)\$", prompt)[1]
    radius = value(radius_text)
    square = radius*radius
    n = int(round(float(square)))
    require(math.isclose(float(square), n, abs_tol=1e-10), "Integer radius squared")
    dots = [e["at"] for e in elements(public) if e["type"] == "point"]
    require(len(dots) == 2 and dots[0] == [h,k], "Marked center and generic P")
    px, py = dots[1]
    require(px > h and py > k and math.isclose((px-h)**2+(py-k)**2,n,rel_tol=1e-12,abs_tol=1e-10), "Concrete P lies on circle in upper-right")

    def equation(label):
        sides = plain(label).split("=")
        if len(sides) != 2:
            return False
        # Compare the equation's residual polynomial at six points sufficient
        # to determine every coefficient of a quadratic in x and y.
        for x,y in ((0,0),(1,0),(0,1),(2,0),(0,2),(1,1)):
            residual = value(sides[0],{"x":x,"y":y})-value(sides[1])
            if not equal(residual,F((x-h)**2+(y-k)**2-n)):
                return False
        return True

    response = public["response"]
    if response["kind"] == "choice":
        return choose(response["options"], equation)
    answer = {}
    for blank in response["blanks"]:
        if "equation" in blank["label"].lower():
            selected = choose(blank["options"], equation)
        else:
            letter, center_value = ("x",h) if "Horizontal" in blank["label"] else ("y",k)
            selected = choose(blank["options"], lambda label: all(equal(value(label,{letter:t}),F(t-center_value)) for t in (0,1,7)))
        answer[blank["id"]] = selected
    return compact(answer)


SIGNED_SOLVERS = {
    "signed-quantity": zero_meaning, "opposite-on-line": opposite,
    "inequality-number-blanks": position, "number-line-distance": distance,
    "signed-context-order": context_order, "signed-story": story,
    "signed-jumps": jumps, "signed-changes-sum": changes,
    "integer-addition": inverse_or_rewrite, "signed-fraction-sum": inverse_or_rewrite,
    "fl-integer-multiply-divide": multiplication, "signed-fraction-product": product_strategy,
    "solve-square-cube-equation": root_equation,
    "root-between-integers": lambda p: str(value(spans(p["prompt"])[0])),
    "classify-real-number": classify, "root-approximation-select": locate_root,
    "root-nearest-tenth": narrow_root, "number-system-closure-classify": closure,
    "turn-degrees": degrees, "angle-equation": angle_equation,
    "angle-pair-measure": angle_equation, "adjacent-angle-equation": whole_angle,
    "right-triangle": triangle_story, "right-triangle-missing-leg": triangle_story,
    "circle-equation": circle_derivation,
    "triangle-construct-plot": construct_triangle, "angle-recognize": recognize_angle,
    "fraction-to-decimal-long-division": decimal_division,
}


def canonical(answer):
    if isinstance(answer, str):
        try:
            return F(answer)
        except (ValueError, ZeroDivisionError):
            try:
                return canonical(json.loads(answer))
            except (ValueError, TypeError):
                return answer
    if isinstance(answer, list):
        return [canonical(v) for v in answer]
    if isinstance(answer, dict):
        return {k: canonical(v) for k, v in answer.items()}
    return answer


def solve(public):
    solver = SIGNED_SOLVERS.get(public["templateId"])
    require(solver is not None, f"No clause solver for {public['templateId']}")
    return solver(public)


def handles_public(public):
    """Route by the visible task, without looking at its private answer/axes."""
    template, prompt, response = public["templateId"], public["prompt"], public["response"]
    if template in SUPPORTED:
        return True
    markers = {
        "signed-quantity": ("has a recorded value",),
        "opposite-on-line": ("Which number is its own opposite", "Which statement about opposites", "What is the opposite of the number at point $P$"),
        "inequality-number-blanks": ("number line increasing to the right", "Which inequality describes their positions"),
        "number-line-distance": ("absolute value of the number at point", "whose number has absolute value", "Select the two expressions giving their distance", "How far apart are"),
        "signed-context-order": ("express in this situation", "Which inequality expresses this fact"),
        "signed-story": ("At dawn the temperature was", "towel bar is centered"),
        "signed-jumps": ("Which number line represents", "Which vertical number line shows"),
        "signed-changes-sum": ("combine to make 0", "opposite quantities combining", "Which regrouping keeps its value"),
        "integer-addition": ("Which sum equals 0", "must be added", "What is $"),
        "signed-fraction-sum": ("Which sum equals 0", "must be added", "What is $", "Which addition expression", "Which subtraction expression"),
        "fl-integer-multiply-divide": ("Which expression is undefined", "What is $0", "Continue the pattern", "What must", "uses distribution", "Which situation is described"),
        "signed-fraction-product": ("Which expression distributes", "Which regrouping keeps the value"),
        "solve-square-cube-equation": ("Find all real solutions of $x^{",),
        "root-between-integers": ("Evaluate $",),
        "classify-real-number": ("Which statement about $\\sqrt{2}", "Classify the decimal expansion", "Does the decimal", "Why must the decimal", "Use long division"),
        "root-approximation-select": ("Which number line places",),
        "root-nearest-tenth": ("Choose the whole-number", "What should you do next to get a better approximation"),
        "number-system-closure-classify": ("Why must the rational factor", "Which step shows this is impossible", "why is $", "Why is $"),
        "turn-degrees": ("one-degree", "of a full circle", "what fraction of a full circle"),
        "angle-equation": ("Ray $BD$ splits right angle $ABC$", "Point $B$ lies on line $AC$", "Angle $CPD$ measures"),
        "angle-pair-measure": ("Ray $BD$ splits right angle $ABC$",),
        "adjacent-angle-equation": ("A folding fan opens through",),
        "circle-equation": ("A circle has center $C(",),
    }
    if template in ("right-triangle", "right-triangle-missing-leg"):
        return not prompt.startswith("A right triangle")
    if template == "classify-real-number" and prompt == "Which number is irrational?":
        return any(e["type"] == "polygon" for e in elements(public))
    return any(marker in prompt for marker in markers.get(template, ()))


def review_problem(problem):
    public = problem["public"]
    expected = solve(public)
    require(canonical(problem["answer"]) == canonical(expected), f"Wrong answer: got {problem['answer']}, expected {expected}")
    response = public["response"]
    if response["kind"] == "point-plot":
        require(problem["pointGrading"] == {"mode":"exact"}, "Construction accepts exactly the independently found point")
    if response["kind"] == "structured-work":
        fields = problem["workGrading"]["fields"]
        expected_rows = json.loads(expected)
        require(isinstance(expected_rows, list) and len(fields) == len(expected_rows), "Grading rows agree with independent solution")
        for rules, row in zip(fields, expected_rows):
            require(len(rules) == len(row), "Grading fields per row")
            for rule, expected_field in zip(rules, row):
                require(rule is not None, "Every requested field is graded")
                if rule["kind"] == "choice":
                    require(rule["accept"] == [expected_field], "Choice grading agrees with independent work")
                else:
                    require(F(rule["value"]) == F(expected_field), "Number grading agrees with independent work")
    require(problem.get("hint", "").strip(), "Nonempty hint")
    require(problem.get("explanation"), "Nonempty worked explanation")
    return problem["answer"]


def self_test():
    require(decimal_expansion(5, 12) == ("0.41\\overline{6}", [(4,2),(1,8),(6,8)], 8), "5/12 repeats remainder8")
    require(decimal_expansion(1, 7)[0] == "0.\\overline{142857}", "Six-digit recurring block")
    require(decimal_expansion(3, 8)[0] == "0.375", "Terminating decimal")
    require(decimal_expansion(-7, 9)[0] == "-0.\\overline{7}", "Signed recurring decimal")
    require(value(r"-0.41\overline{6}") == F(-5,12), "Recurring decimal exact fraction")
    require(value(r"(-8)(12)+(-8)(0.5)") == -100, "Distributive exact arithmetic")
    require(value(r"\sqrt{\frac{9}{16}}") == F(3,4), "Exact root of a fraction")

    def opts(labels):
        return [{"id": f"option-{chr(97+i)}", "label": label} for i,label in enumerate(labels)]

    def fixture(template, prompt, response, answer, **more):
        return {"public":{"templateId":template,"seed":"fixture","prompt":prompt,"response":response,**more},"answer":answer,"hint":"Use the stated quantities.","explanation":["Apply the definition to the given quantities."]}

    decimal_case = fixture("fraction-to-decimal-long-division", r"Use long division to write $\frac{5}{12}$ as a decimal. Which is exact?", {"kind":"choice","options":opts([r"$0.41\overline{6}$","$0.416$","$-0.41\\overline{6}$",r"$0.\overline{4160}$"])}, "option-a")
    decimal_case["public"]["response"]["options"][2]["label"] = r"$-0.41\overline{6}$"
    root_case = fixture("root-between-integers", r"Evaluate $\sqrt{\frac{9}{16}}$. Give an exact fraction or decimal.", {"kind":"fraction"}, "0.75")
    triangle_case = fixture("triangle-construct-plot", "Segment $AB$ has endpoints $A(0,0)$ and $B(14,0)$ and length 14 units. $AC=13$ units and $BC=15$ units. Plot vertex $C$ above $AB$ to construct the triangle.", {"kind":"point-plot","grid":{"xMin":0,"xMax":16,"yMin":0,"yMax":16,"step":1},"given":{"vertices":[{"x":0,"y":0,"label":"A"},{"x":14,"y":0,"label":"B"}]}}, "[[5,12]]")
    triangle_case["pointGrading"] = {"mode":"exact"}
    closure_case = fixture("number-system-closure-classify", r"For integers $a,b,c,d$ with $b,d\ne0$, why is $a/b + c/d$ rational?", {"kind":"choice","options":opts([r"It equals $(ad+bc)/(bd)$; numerator and denominator are integers and $bd\ne0$.","Because both original numbers must be less than 1.","Because any decimal that continues forever is rational.","It is not rational unless the result is a whole number."])}, "option-a")
    for p in (decimal_case, root_case, triangle_case, closure_case):
        require(handles_public(p["public"]), "Route fixture by visible task")
        review_problem(p)
    mutations = [
        (decimal_case, lambda p:p.update(answer="option-b")),
        (decimal_case, lambda p:p["public"]["response"]["options"][1].update(label=r"$0.416\overline{6}$")),
        (root_case, lambda p:p.update(answer="0.7")),
        (triangle_case, lambda p:p.update(answer="[[9,12]]")),
        (triangle_case, lambda p:p.update(pointGrading={"mode":"polygon"})),
        (triangle_case, lambda p:p["public"].update(prompt=p["public"]["prompt"].replace("BC=15","BC=14"))),
        (closure_case, lambda p:p["public"]["response"]["options"][0].update(label=r"It equals $ad+bc/(bd)$; numerator and denominator are integers and $bd\ne0$.")),
    ]
    for original, mutate in mutations:
        corrupted = copy.deepcopy(original); mutate(corrupted)
        try:
            review_problem(corrupted)
        except (ValueError, KeyError, TypeError):
            pass
        else:
            raise ValueError("Accepted a corrupted clause fixture")
    return {"fixtures":11,"mutations":len(mutations)}


if __name__ == "__main__":
    report = self_test()
    count = 0
    if "--jsonl" in sys.argv:
        for line in sys.stdin:
            item = json.loads(line)
            problem = item.get("problem", item)
            if item.get("kind") == "manifest":
                continue
            try:
                review_problem(problem)
            except Exception as error:
                raise ValueError(f"{problem['public']['templateId']}/{problem['public']['seed']}: {error}") from error
            count += 1
    print(json.dumps({**report,"cases":count}))
