"""Independent oracle for the HSN.Q.A.3 families (measurement-precision-report).

Every reading, its step (the tool's resolution), the operation and the
calculator display are read from the prompt's words. The window of each
reading is [v - step/2, v + step/2]; windows are carried exactly with
Fractions (sums add half-widths; products and quotients pair the extreme
ends; exact conversion factors scale both ends). The report is the
calculator value rounded half up to the place of the first nonzero digit of
the window's width, the rule every such prompt states. A tool's reading and
a written report each name a half-open window [v - s/2, v + s/2) (a value
exactly halfway shows or rounds to the larger value), and a statement is
justified only when it holds for every value in that window.

Only the public prompt and options enter `solve`; `review_problem` also
checks that each wrong option has feedback.
"""

import json
import re
from fractions import Fraction as F

SUPPORTED = frozenset({
    "justified-report-from-measurements",
    "measurement-report-meaning",
    "precision-report-critique",
})
REVIEW_RETURNS_ANSWER = True

RULE = ("a reading to the nearest step is within half a step of the true value, and a result is reported "
        "to the place value of the first nonzero digit of the width of its range of possible values")
WORDS_ONE = r"(?:centimeter|inch|mile|kilometer|pound|kilogram|gallon|foot|gram|meter|milliliter|millimeter|second|degree)"


def require(condition, message):
    if not condition:
        raise ValueError(message)


def compact(value):
    return json.dumps(value, separators=(",", ":"))


def number(text):
    text = text.replace("{,}", "").replace("−", "-")
    require(re.fullmatch(r"-?\d+(\.\d+)?", text) is not None, f"Not a decimal: {text}")
    return F(text)


def decimals(text):
    return len(text.split(".")[1]) if "." in text else 0


def exponent_of(width):
    """e with 10^e <= width < 10^(e+1), exactly."""
    require(width > 0, "Width must be positive")
    e = 0
    while F(10) ** e > width:
        e -= 1
    while F(10) ** (e + 1) <= width:
        e += 1
    return e


def is_tie(v, e):
    scaled = v / F(10) ** e
    return (scaled - (scaled.numerator // scaled.denominator)) == F(1, 2)


def round_text(v, e):
    """v rounded half up to the place 10^e, written with that many decimals."""
    scaled = v / F(10) ** e
    n = (scaled + F(1, 2)).numerator // (scaled + F(1, 2)).denominator
    if e >= 0:
        return str(n * 10 ** e)
    text = str(abs(n)).rjust(-e + 1, "0")
    out = f"{text[:e]}.{text[e:]}"
    return f"-{out}" if n < 0 else out


def display_ok(shown, central):
    """The calculator shows six decimals, or the exact value when shorter."""
    exact = central * 10 ** 6
    if exact.denominator == 1:
        return number(shown) == central
    return decimals(shown) == 6 and abs(number(shown) - central) <= F(1, 2 * 10 ** 6)


# ------------------------------------------------------------- readings

def step_in(words):
    """The step named in a clause such as 'to the nearest tenth of a mile'."""
    patterns = [
        (r"nearest tenth|marked in tenths", F(1, 10)),
        (r"nearest hundredth", F(1, 100)),
        (r"nearest thousandth", F(1, 1000)),
        (r"nearest \$(\d+(?:\.\d+)?)\$", None),
        (r"nearest " + WORDS_ONE + r"\b|marked in (?:millimeters|centimeters)", F(1)),
    ]
    found = []
    for pattern, step in patterns:
        m = re.search(pattern, words)
        if m:
            found.append((m.start(), number(m.group(1)) if step is None else step))
    require(found, f"No step in: {words}")
    # The step that follows the reading most closely belongs to it.
    return min(found)[1]


READING = re.compile(r"\$(\d[\d.]*)\$ (kg|g|mi|km|cm|in|lb|gal|ft|m|mm|s|mL)\b")


def readings(setup):
    """Each reading (value, unit, step) in order, with its own clause."""
    out = []
    for sentence in re.split(r"(?<=\.) ", setup):
        for m in READING.finditer(sentence):
            # A computed total ("gets $7.6$ kg", "Their sum is ...") is not a reading.
            if sentence[: m.start()].endswith(("gets ", "is ", ": ")):
                continue
            out.append((number(m.group(1)), m.group(2), step_in(sentence[m.start():]), m.group(1)))
    return out


SIG = {"convert": "sig", "product": "sig", "combine": "places"}


def sig_figs(text):
    digits = text.replace(".", "").lstrip("0")
    return len(digits)


def report_case(prompt):
    require(RULE in prompt, "The precision rule is stated")
    setup = prompt.split("Use this rule:")[0]
    reads = readings(setup)
    if "multiplies by $" in setup or "divides by $" in setup:
        require(len(reads) == 1, "One reading to convert")
        (m, unit, step, text), = reads
        f = number(re.search(r"(?:multiplies|divides) by \$([\d.]+)\$, the exact number", setup).group(1))
        multiply = "multiplies by $" in setup
        op = (lambda v: v * f) if multiply else (lambda v: v / f)
        central, lo, hi = op(m), op(m - step / 2), op(m + step / 2)
        shown = re.search(r"calculator shows \$([\d.]+)\$", setup).group(1)
        rule_e = exponent_of(abs(central)) - sig_figs(text) + 1
        kind = "convert"
    elif "\\times" in setup or "divided by" in setup:
        require(len(reads) == 2, "Two readings")
        (a, _, sa, ta), (b, _, sb, tb) = reads
        if "\\times" in setup:
            central, lo, hi = a * b, (a - sa / 2) * (b - sb / 2), (a + sa / 2) * (b + sb / 2)
            shown = re.search(r"\\times[\d.]+=([\d.]+)\$", setup).group(1)
        else:
            central, lo, hi = a / b, (a - sa / 2) / (b + sb / 2), (a + sa / 2) / (b - sb / 2)
            shown = re.search(r"calculator shows \$([\d.]+)\$", setup).group(1)
        rule_e = exponent_of(abs(central)) - min(sig_figs(ta), sig_figs(tb)) + 1
        kind = "product"
    else:
        require(len(reads) == 2, "Two readings")
        (a, ua, sa, _), (b, ub, sb, _) = reads
        scale = F(1)
        if "changes the grams to kilograms" in setup or "changes the millimeters to meters" in setup:
            require(ub in ("g", "mm") and ua in ("kg", "m"), "Unit change direction")
            scale = F(1, 1000)
        else:
            require(ua == ub, "Same units added")
        b, sb = b * scale, sb * scale
        subtract = "subtracts" in setup
        if subtract:
            central, lo, hi = a - b, (a - sa / 2) - (b + sb / 2), (a + sa / 2) - (b - sb / 2)
        else:
            require("adds" in setup or "sum" in setup, "A sum")
            central, lo, hi = a + b, (a - sa / 2) + (b - sb / 2), (a + sa / 2) + (b + sb / 2)
        shown = re.search(r"(?:gets|Their sum is|subtracts[^$]*:) \$([\d.]+)\$", setup).group(1)
        rule_e = exponent_of(max(sa, sb))
        kind = "combine"
    e = exponent_of(hi - lo)
    require(not is_tie(central, e), "The calculator value is a rounding tie")
    report = round_text(central, e)
    require(report == round_text((lo + hi) / 2, e), "The midpoint rounds to another report")
    require(e == rule_e, "The significant-figure or decimal-place rule gives another place")
    require(display_ok(shown, central), f"Calculator display {shown} is not the computed value")
    return report, kind


OPTION = re.compile(r"\$(-?[\d.]+)\\ \\text\{([^}]+)\}(\^2)?\$")


def solve_report(public):
    report, _ = report_case(public["prompt"])
    response = public["response"]
    require(response["kind"] == "choice" and len(response["options"]) == 4, "Four choices")
    parsed = []
    for o in response["options"]:
        m = OPTION.fullmatch(o["label"])
        require(m is not None, f"Unread option {o['label']}")
        parsed.append((o["id"], m.group(1), m.group(2) + (m.group(3) or "")))
    require(len({u for _, _, u in parsed}) == 1, "All options share the result's unit")
    hits = [i for i, v, _ in parsed if v == report]
    require(len(hits) == 1, f"Exactly one option reports {report}")
    return hits[0]


# ------------------------------------------------------- report meaning

def window_of(prompt):
    tool = re.search(
        r"reads to the nearest \$([\d.]+)\$ (\S+): it shows the multiple of \$([\d.]+)\$ nearest the true value, "
        r"and a value exactly halfway shows the larger one\. It shows .+? as \$([\d.]+)\$ (\S+)\.", prompt)
    if tool:
        step, unit, again, reading, unit2 = tool.groups()
        require(step == again and unit == unit2, "One step and unit")
        u, R = number(step), number(reading)
        require((R / u).denominator == 1, "The reading is a multiple of the step")
        return R - u / 2, R + u / 2, u, unit, reading
    rep = re.search(
        r"A lab notebook reports .+? as \$([\d.]+)\$ (\S+?)(?:, to the nearest (hundred|ten|thousand) \w+)?\. "
        r"By the usual rule, a report's last digit is the place the measurement was rounded to, and a value "
        r"exactly halfway rounds up\.", prompt)
    require(rep is not None, "Unread meaning context")
    text, unit, word = rep.groups()
    step = {"hundred": F(100), "ten": F(10), "thousand": F(1000)}[word] if word else F(1, 10 ** decimals(text))
    v = number(text)
    return v - step / 2, v + step / 2, step, unit, text


def justified(statement, lo, hi, step, unit):
    u = re.escape(unit)
    num = r"\$([\d.]+)\$"
    s = statement
    m = re.fullmatch(rf"The true value is at least {num} {u} and less than {num} {u}\.", s)
    if m:
        return number(m.group(1)) <= lo and number(m.group(2)) >= hi
    m = re.fullmatch(rf"The true value is at least {num} {u}\.", s)
    if m:
        return number(m.group(1)) <= lo
    m = re.fullmatch(rf"The true value is less than {num} {u}\.", s)
    if m:
        return number(m.group(1)) >= hi
    m = re.fullmatch(rf"The true value could be as high as {num} {u}\.", s)
    if m:
        return lo <= number(m.group(1)) < hi
    m = re.fullmatch(rf"The true value could be {num} {u}\.", s)
    if m:
        return lo <= number(m.group(1)) < hi
    if re.fullmatch(rf"The true value is exactly {num} {u}\.", s):
        return False
    m = re.fullmatch(rf"Writing the reading as {num} {u} would claim more accuracy than the tool has\.", s)
    if m:
        return F(1, 10 ** decimals(m.group(1))) < step
    m = re.fullmatch(rf"Writing the reading as {num} {u} claims the same accuracy as {num} {u}\.", s)
    if m:
        return decimals(m.group(1)) == decimals(m.group(2))
    m = re.fullmatch(rf"The measurement was rounded to the nearest {num} {u}\.", s)
    if m:
        return number(m.group(1)) == step
    m = re.fullmatch(rf"{num} {u} and {num} {u} report the same accuracy\.", s)
    if m:
        return decimals(m.group(1)) == decimals(m.group(2))
    m = re.fullmatch(rf"{num} {u} to the nearest (hundred|ten) and {num} {u} to the nearest (hundred|ten) report the same accuracy\.", s)
    if m:
        return m.group(2) == m.group(4)
    m = re.fullmatch(rf"A display that reads only to the nearest {num} {u} could have produced this report\.", s)
    if m:
        return number(m.group(1)) <= step
    raise ValueError(f"Unread statement: {s}")


def solve_meaning(public):
    lo, hi, step, unit, _ = window_of(public["prompt"])
    response = public["response"]
    require(response["kind"] == "multi-select", "Multi-select")
    picks = [o["id"] for o in response["options"] if justified(o["label"], lo, hi, step, unit)]
    require(len(picks) == response["selectionCount"], f"{len(picks)} justified, {response['selectionCount']} asked")
    require(f"Select the {len(picks)} statements" in public["prompt"], "The prompt asks for that many")
    return compact(picks)


# -------------------------------------------------------------- critique

def critique_case(prompt):
    """(the justified report, the given report, the window, the unit)."""
    m = re.search(r"measures a garden bed as \$([\d.]+)\$ m by \$([\d.]+)\$ m with a tape marked in tenths of a meter, "
                  r"and reports its area as \$([\d.]+)\$ m²\.", prompt)
    if m:
        require(RULE in prompt, "Rule stated")
        a, b, given = number(m.group(1)), number(m.group(2)), m.group(3)
        h = F(1, 20)
        central, lo, hi = a * b, (a - h) * (b - h), (a + h) * (b + h)
        e = exponent_of(hi - lo)
        require(not is_tie(central, e), "Tie")
        require(display_ok(given, central), "The reported area is the calculator product")
        require(e == exponent_of(central) - 1, "Two significant figures agree")
        return round_text(central, e), given, (lo, hi, e), "m²"
    m = re.search(r"A bowl weighs \$(\d+)\$ g on a scale that reads to the nearest \$10\$ g\. A spice packet weighs "
                  r"\$([\d.]+)\$ g on a balance that reads to the nearest \$0\.01\$ g\. Pat reports the total as "
                  r"\$([\d.]+)\$ g\.", prompt)
    if m:
        require(RULE in prompt, "Rule stated")
        big, small, given = number(m.group(1)), number(m.group(2)), m.group(3)
        central, lo, hi = big + small, big - 5 + small - F(1, 200), big + 5 + small + F(1, 200)
        e = exponent_of(hi - lo)
        require(not is_tie(central, e), "Tie")
        require(number(given) == central, "The report is the exact sum")
        return round_text(central, e), given, (lo, hi, e), "g"
    m = re.search(r"A luggage scale reads to the nearest \$0\.1\$ kg and shows \$([\d.]+)\$ kg for a suitcase\. "
                  r"Kim reports the mass as \$([\d.]+)\$ kg\.", prompt)
    if m:
        shown, given = m.group(1), m.group(2)
        require(decimals(shown) == 1, "The scale shows tenths")
        return shown, given, None, "kg"
    m = re.search(r"Using .+? (?:to the nearest \$([\d.]+)\$ (\S+)|to the nearest gram), Theo measures .+? as "
                  r"\$([\d.]+)\$ (\S+) and reports it as \"(about .+?)\.\"", prompt)
    if m:
        step = number(m.group(1)) if m.group(1) else F(1)
        shown = m.group(3)
        require(F(1, 10 ** decimals(shown)) == step, "The reading shows the tool's place")
        return shown, m.group(5), None, m.group(4)
    raise ValueError("Unread critique scenario")


def recommended(label, given):
    """The report an option endorses."""
    for pattern in (r"[Rr]eport \$([\d.]+)\$", r"Keep \$([\d.]+)\$", r"rounded to [a-z ]+: \$([\d.]+)\$"):
        m = re.search(pattern, label)
        if m:
            return m.group(1)
    if re.search(r"is right|is fine|is the better report", label):
        return given
    raise ValueError(f"Unread critique option: {label}")


def interval_ok(label, window, unit, given, justified_report):
    """Any interval an option states must be the carried window (shown to
    one place finer than the report, or 'about' to the ones for a sum)."""
    if window is None:
        # The trailing-zero scenario: the claimed and the guaranteed windows.
        m = re.search(r"claims \$([\d.]+)\$ to \$([\d.]+)\$ kg, but the scale fixes only \$([\d.]+)\$ to \$([\d.]+)\$ kg", label)
        if m:
            z, t = number(given), number(justified_report)
            half_z = F(1, 2 * 10 ** decimals(given))
            return [number(x) for x in m.groups()] == [z - half_z, z + half_z, t - F(1, 20), t + F(1, 20)]
        m = re.search(r"fixes it to within \$([\d.]+)\$", label)
        if m:
            return number(m.group(1)) == F(1, 2 * 10 ** decimals(justified_report))
        return True
    lo, hi, e = window
    m = re.search(r"from \$([\d.]+)\$ to \$([\d.]+)\$", label)
    if m:
        return m.group(1) == round_text(lo, e - 1) and m.group(2) == round_text(hi, e - 1)
    m = re.search(r"to about \$(\d+)\$ to \$(\d+)\$ g", label)
    if m:
        return m.group(1) == round_text(lo, 0) and m.group(2) == round_text(hi, 0)
    return True


def solve_critique(public):
    report, given, window, unit = critique_case(public["prompt"])
    require(given != report, "The critiqued report must be flawed")
    response = public["response"]
    require(response["kind"] == "choice" and len(response["options"]) == 4, "Four choices")
    valid = [o["id"] for o in response["options"]
             if recommended(o["label"], given) == report and interval_ok(o["label"], window, unit, given, report)]
    require(len(valid) == 1, f"Exactly one valid critique, found {len(valid)}")
    return valid[0]


def solve(public):
    template = public["templateId"]
    if template == "justified-report-from-measurements":
        return solve_report(public)
    if template == "measurement-report-meaning":
        return solve_meaning(public)
    require(template == "precision-report-critique", "Unsupported template")
    return solve_critique(public)


def review_problem(problem):
    public = problem["public"]
    expected = solve(public)
    if public["response"]["kind"] == "choice":
        feedback = problem.get("choiceFeedback") or {}
        for o in public["response"]["options"]:
            if o["id"] != expected:
                require(len(feedback.get(o["id"], "")) > 10, "Every wrong option has feedback")
    return expected


def self_test():
    require(round_text(F("54.481"), -1) == "54.5", "round tenths")
    require(round_text(F("408.94"), 0) == "409", "round ones")
    require(round_text(F("425.95"), 1) == "430", "round tens")
    require(exponent_of(F("0.101")) == -1 and exponent_of(F("2.54")) == 0, "width exponent")
    relay = {
        "templateId": "justified-report-from-measurements",
        "prompt": "A hand stopwatch times the first leg of a relay as $12.9$ s, to the nearest tenth of a second. An "
                  "electronic timer times the second leg as $41.581$ s, to the nearest thousandth. Their sum is "
                  "$54.481$ s. Use this rule: " + RULE + ". Which report of the total time is appropriate?",
        "response": {"kind": "choice", "options": [
            {"id": "option-a", "label": "$54.50\\ \\text{s}$"}, {"id": "option-b", "label": "$54.5\\ \\text{s}$"},
            {"id": "option-c", "label": "$54.481\\ \\text{s}$"}, {"id": "option-d", "label": "$54.48\\ \\text{s}$"}]},
    }
    require(solve(relay) == "option-b", "relay")
    bad = json.loads(json.dumps(relay))
    bad["response"]["options"][0]["label"] = "$54.5\\ \\text{s}$"
    bad["response"]["options"][1]["label"] = "$54.4\\ \\text{s}$"
    require(solve(bad) == "option-a", "the report wherever it is")
    wrong = json.loads(json.dumps(relay))
    wrong["prompt"] = wrong["prompt"].replace("$54.481$ s.", "$54.491$ s.")
    try:
        solve(wrong)
    except ValueError:
        pass
    else:
        raise AssertionError("A display that is not the sum was accepted")
    meaning = {
        "templateId": "measurement-report-meaning",
        "prompt": "A thermometer reads to the nearest $0.5$ °C: it shows the multiple of $0.5$ nearest the true value, "
                  "and a value exactly halfway shows the larger one. It shows a bath's temperature as $34.5$ °C. A "
                  "written report's last digit names the place it was rounded to. Select the 2 statements that are justified.",
        "response": {"kind": "multi-select", "selectionCount": 2, "options": [
            {"id": "option-a", "label": "The true value is at least $34.25$ °C and less than $34.75$ °C."},
            {"id": "option-b", "label": "Writing the reading as $34.50$ °C claims the same accuracy as $34.5$ °C."},
            {"id": "option-c", "label": "The true value could be as high as $35.0$ °C."},
            {"id": "option-d", "label": "The true value is exactly $34.5$ °C."},
            {"id": "option-e", "label": "The true value could be $34.26$ °C."}]},
    }
    require(solve(meaning) == '["option-a","option-e"]', "meaning")
    meaning["response"]["options"][4]["label"] = "The true value could be $34.75$ °C."
    try:
        solve(meaning)
    except ValueError:
        pass
    else:
        raise AssertionError("A boundary value was read as possible")
