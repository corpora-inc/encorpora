"""Independent review of the grade-2 ruler and line-plot families
(2.MD.A.4 and 2.MD.D.9) from public payloads only.

Lengths are read from the drawn objects on the drawn scale: each object's
start and end are its bar's left and right edges, in ruler units, checked
against the numbered ticks. Line plots are read from their drawn marks and
tick numbers. The private answer, hint and explanation are only values under
test. Arithmetic is exact (Fractions of the drawn decimals).
"""

import copy
import json
import re
from fractions import Fraction as F

SUPPORTED = frozenset({
    "ruler-length-difference",
    "compare-measured-lengths",
    "ruler-read-nearest-unit",
    "line-plot-choose-for-data",
})
UNITS = {"centimeters": ("centimeter", "cm"), "inches": ("inch", "inches")}
SINGULAR = {"centimeter": "centimeters", "inch": "inches"}
PLACEHOLDER = re.compile(r"\$\{|\bundefined\b|\bNaN\b|\bnull\b|\[object")
ARTICLE = r"(?:A|An|a|an) "


def require(condition, message):
    if not condition:
        raise ValueError(message)


def exact(x):
    """A drawn coordinate as an exact decimal (the figure uses tenths)."""
    value = F(repr(float(x))).limit_denominator(1000)
    require(value.denominator in (1, 2, 5, 10), f"Coordinate {x} is not in tenths")
    return value


def elements(public):
    figure = public.get("figure")
    require(figure and figure.get("kind") == "scene", "A scene figure")
    return {e["id"]: e for e in figure["scene"]["elements"] if "id" in e}


def read_ruler(els, rid, unit_word):
    """Numbers on the scale, the scale length, and each bar as (name, start, end)."""
    numbers = {}
    for key, e in els.items():
        m = re.fullmatch(rf"{rid}-n(\d+)", key)
        if m:
            k = int(m.group(1))
            require(e["type"] == "text" and e["text"] == str(k), f"Tick number {key}")
            require(exact(e["at"][0]) == k, f"Tick number {k} sits at its mark")
            numbers[k] = e
    require(0 in numbers, "The scale starts at 0")
    length = max(numbers)
    step = min(k for k in numbers if k > 0)
    require(sorted(numbers) == list(range(0, length + 1, step)), "Numbers at a steady step")
    unit = els.get(f"{rid}-unit")
    require(unit and unit["text"] == UNITS[unit_word][1], "Scale names the prompt's unit")
    bars = []
    i = 0
    while f"{rid}-bar{i}" in els:
        bar, name = els[f"{rid}-bar{i}"], els[f"{rid}-name{i}"]
        require(bar["type"] == "rect" and name["type"] == "text", "Bar and its name")
        start = exact(bar["at"][0])
        end = start + exact(bar["size"][0])
        require(0 <= start < end <= length, f"The {name['text']} lies on the scale")
        bars.append((name["text"], start, end))
        i += 1
    return length, bars


def unit_amount(label):
    m = re.fullmatch(r"(\d+) (centimeters?|inch|inches)", label)
    require(m is not None, f"Amount option {label!r}")
    word = m.group(2)
    many = SINGULAR.get(word, word)
    require((int(m.group(1)) == 1) == (word in SINGULAR), f"Amount agrees with its count: {label!r}")
    return int(m.group(1)), many


def math_spans(texts):
    return " ".join(re.findall(r"\$([^$]+)\$", " ".join(texts)))


# ---------------------------------------------------------------- 2.MD.A.4

def solve_difference(public):
    prompt = public["prompt"]
    m = re.fullmatch(ARTICLE + r"(.+?) and " + ARTICLE + r"(.+?) lie along a (ruler|measuring tape)\. (.+)", prompt)
    require(m is not None, f"Prompt {prompt!r}")
    names = {m.group(1), m.group(2)}
    ask = m.group(4)
    for pattern, kind in ((r"How much longer is the (.+) than the (.+)\? Answer in (centimeters|inches)\.", "longer"),
                          (r"How much shorter is the (.+) than the (.+)\? Answer in (centimeters|inches)\.", "shorter"),
                          (r"How many more (centimeters|inches) does the (.+) need to be as long as the (.+)\?", "need")):
        q = re.fullmatch(pattern, ask)
        if q:
            break
    else:
        raise ValueError(f"Question {ask!r}")
    if kind == "need":
        unit, x, y = q.group(1), q.group(2), q.group(3)
    else:
        x, y, unit = q.group(1), q.group(2), q.group(3)
    require({x, y} == names, "The question names the two objects")
    require(public["response"] == {"kind": "number", "label": unit}, "Number answer labeled with the unit")
    length, bars = read_ruler(elements(public), "ruler", unit)
    require(len(bars) == 2 and {b[0] for b in bars} == names, "Two named objects on the ruler")
    lengths = {name: end - start for name, start, end in bars}
    for v in lengths.values():
        require(v.denominator == 1, "Whole-unit lengths")
    tape = m.group(3) == "measuring tape"
    if tape:
        require(length == 40 and unit == "centimeters", "A 40 cm tape")
    else:
        require(length in ((15, 30) if unit == "centimeters" else (12,)), "Ruler length")
    if kind == "longer":
        require(lengths[x] > lengths[y], "The named longer object is longer")
    else:
        require(lengths[x] < lengths[y], "The named shorter object is shorter")
    d = abs(lengths[x] - lengths[y])
    starts = {name: start for name, start, _ in bars}
    ends = {name: end for name, _, end in bars}
    if starts[x] != starts[y]:
        require(abs(ends[x] - ends[y]) != d, "End marks alone must not give the difference")
    require(1 <= d <= (25 if tape else 12 if unit == "centimeters" else 8), "Difference in the grade range")
    return str(d), (d, lengths)


def review_difference(problem):
    answer, (d, lengths) = solve_difference(problem["public"])
    spans = math_spans(problem["explanation"])
    longer, shorter = max(lengths.values()), min(lengths.values())
    require(f"{longer} - {shorter} = {d}" in spans, "Worked subtraction")
    require(f"{shorter} + {d} = {longer}" in spans, "Worked check")
    return answer


def solve_compare(public):
    prompt = public["prompt"]
    m = re.fullmatch(ARTICLE + r"(.+?) lies on the top ruler and " + ARTICLE +
                     r"(.+?) lies on the bottom ruler\. Both rulers are marked in (centimeters|inches)\. "
                     r"Measure both objects\. Which is longer, and by how much\?", prompt)
    require(m is not None, f"Prompt {prompt!r}")
    top, bottom, unit = m.group(1), m.group(2), m.group(3)
    els = elements(public)
    found = {}
    for rid, name in (("ruler0", top), ("ruler1", bottom)):
        length, bars = read_ruler(els, rid, unit)
        require(length == (30 if unit == "centimeters" else 12), "Ruler length")
        require(len(bars) == 1 and bars[0][0] == name, f"The {name} is on its ruler")
        _, start, end = bars[0]
        found[name] = (start, end, end - start)
    starts = sorted(v[0] for v in found.values())
    require(starts[0] == 0 and 1 <= starts[1] <= 5, "One object starts at 0, the other at 1 to 5")
    lt, lb = found[top][2], found[bottom][2]
    d = abs(lt - lb)
    if d:
        require(abs(found[top][1] - found[bottom][1]) != d, "End marks alone must not give the difference")
    response = public["response"]
    require(response.get("kind") == "multi-part-choice" and response.get("layout") == "slots", "Slots")
    blanks = response["blanks"]
    require([b["id"] for b in blanks] == ["longer", "by"], "Two parts")
    require(blanks[0]["label"] == "Which is longer?" and blanks[1]["label"] == "By how much?", "Part labels")
    first = [o["label"] for o in blanks[0]["options"]]
    require(sorted(first) == sorted([top, bottom, "They are the same length"]), "Part 1 options")
    winner = top if lt > lb else bottom if lb > lt else "They are the same length"
    key = {"longer": next(o["id"] for o in blanks[0]["options"] if o["label"] == winner)}
    amounts = [unit_amount(o["label"]) for o in blanks[1]["options"]]
    require(len(set(amounts)) == len(amounts) == 4, "Four different amounts")
    right = [o["id"] for o, a in zip(blanks[1]["options"], amounts) if a == (d, unit)]
    require(len(right) == 1, "Exactly one correct amount")
    if d == 0:
        require(sum(1 for n, _ in amounts if n == 0) == 1, "Zero in another unit would also be true")
    for n, _ in amounts:
        require(0 <= n <= (30 if unit == "centimeters" else 12), "Amounts within the ruler")
    key["by"] = right[0]
    return json.dumps(key, separators=(",", ":")), (lt, lb, d)


def review_compare(problem):
    answer, (lt, lb, d) = solve_compare(problem["public"])
    spans = math_spans(problem["explanation"])
    if d:
        require(f"{max(lt, lb)} - {min(lt, lb)} = {d}" in spans, "Worked subtraction")
    else:
        require(f"{lt} - {lb} = 0" in spans, "Worked zero difference")
    return answer


# ---------------------------------------------------------------- 2.MD.D.9

def solve_nearest(public):
    m = re.fullmatch(r"Measure the (.+) to the nearest (centimeter|inch)\. How long is it\?", public["prompt"])
    require(m is not None, f"Prompt {public['prompt']!r}")
    name, one = m.group(1), m.group(2)
    unit = SINGULAR[one]
    require(public["response"] == {"kind": "number", "label": unit}, "Number answer labeled with the unit")
    length, bars = read_ruler(elements(public), "ruler", unit)
    require(length <= (15 if unit == "centimeters" else 12), "Ruler length")
    require(len(bars) == 1 and bars[0][0] == name, "One named object")
    _, start, end = bars[0]
    require(start.denominator == 1 and 0 <= start <= 5, "Starts at a whole mark 0 to 5")
    measured = end - start
    part = measured - (measured.numerator // measured.denominator)
    require(part != F(1, 2), "Never a halfway end")
    require(part in (0, F(2, 10), F(3, 10), F(7, 10), F(8, 10)), "End offsets of 0, .2, .3, .7 or .8")
    nearest = int(measured + F(1, 2))
    require(2 <= nearest <= 14, "Answer in range")
    return str(nearest), (start, end, nearest)


def review_nearest(problem):
    answer, (start, end, nearest) = solve_nearest(problem["public"])
    text = " ".join(problem["explanation"])
    if start:
        require(f"{start + nearest} - {start} = {nearest}" in math_spans(problem["explanation"]), "Counts from the start mark")
    require(re.search(rf"\babout {nearest} (centimeters?|inch(es)?) long\b", text), "States the rounded length")
    return answer


def parse_list(text):
    parts = re.split(r", | and ", text)
    require(all(re.fullmatch(r"\d+", p) for p in parts), f"List {text!r}")
    return [int(p) for p in parts]


def read_plot(scene):
    els = {e["id"]: e for e in scene["elements"] if "id" in e}
    labels = []
    i = 0
    while f"n{i}" in els:
        e = els[f"n{i}"]
        require(exact(e["at"][0]) == i and re.fullmatch(r"\d+", e["text"]), "Scale numbers at their ticks")
        require(f"t{i}" in els and exact(els[f"t{i}"]["at"][0]) == i, "A tick under each number")
        labels.append(int(e["text"]))
        i += 1
    require(len(labels) >= 3 and labels == sorted(set(labels)), "Increasing scale")
    counts = {v: 0 for v in labels}
    ops = els["marks"]["d"] if "marks" in els else []
    require(len(ops) % 4 == 0, "Each mark is two strokes")
    for k in range(0, len(ops), 4):
        m1, l1, m2, l2 = ops[k:k + 4]
        require([m1[0], l1[0], m2[0], l2[0]] == ["M", "L", "M", "L"], "Mark strokes")
        cx = (F(repr(m1[1])) + F(repr(l1[1]))) / 2
        col = round(cx)
        require(abs(cx - col) < F(1, 1000) and 0 <= col < len(labels), "Mark over a tick")
        counts[labels[col]] += 1
    return labels, counts


def solve_plot(public):
    prompt = public["prompt"]
    pats = (
        ("several", r"\w+ measured (\d+) (.+) to the nearest (centimeter|inch)\. The lengths, in (centimeters|inches), were (.+)\. Which line plot shows these measurements\?"),
        ("repeated", r"\w+ measured the same (.+) (\d+) times to the nearest (centimeter|inch)\. The measurements, in (centimeters|inches), were (.+)\. Which line plot shows all of these measurements\?"),
        ("table", r"\w+ measured (\d+) (.+) to the nearest (centimeter|inch)\. The table shows each length\. Which line plot shows these measurements\?"),
    )
    for family, pattern in pats:
        m = re.fullmatch(pattern, prompt)
        if m:
            break
    else:
        raise ValueError(f"Prompt {prompt!r}")
    if family == "several":
        n, values, unit = int(m.group(1)), parse_list(m.group(5)), m.group(4)
        require(SINGULAR[m.group(3)] == unit, "Units agree")
    elif family == "repeated":
        n, values, unit = int(m.group(2)), parse_list(m.group(5)), m.group(4)
        require(SINGULAR[m.group(3)] == unit, "Units agree")
    else:
        n, unit = int(m.group(1)), SINGULAR[m.group(3)]
        figure = public.get("figure")
        require(figure and figure["kind"] == "scene", "A table")
        table = figure["scene"]["elements"]
        require(len(table) == 1 and table[0]["type"] == "lineTable", "One table")
        rows = table[0]["rows"]
        require(rows[0][1] == f"Length ({unit})", "Length column")
        # Row labels are a color ("Blue") under a short header ("Chain"), or the
        # older "blue paper clip chain" wording. Either way the length is column 2.
        values = [int(row[1]) for row in rows[1:]]
        require(len({row[0] for row in rows[1:]}) == len(rows) - 1, "Distinct objects")
    require(len(values) == n and 5 <= n <= 9, "The stated count matches the list")
    top = 20 if unit == "centimeters" else 12
    require(all(1 <= v <= top for v in values), "Lengths in the grade range")
    require(values != sorted(values), "The list is not sorted")
    data = {}
    for v in values:
        data[v] = data.get(v, 0) + 1
    require(max(data.values()) <= 4 and max(data.values()) >= 2, "Stacks of 2 to 4")
    if family == "repeated":
        center = max(data, key=data.get)
        require(sorted(data.values()).count(data[center]) == 1, "A strict mode")
        require(set(data) <= {center - 1, center, center + 1}, "Within one of the center")
    response = public["response"]
    require(response.get("kind") == "figure-choice" and response.get("noun") == "Graph", "Graph choice")
    options = response["options"]
    require(len(options) == 4, "Four plots")
    lo, hi = min(values), max(values)
    hits = []
    seen = set()
    for option in options:
        labels, counts = read_plot(option["scene"])
        seen.add(json.dumps([labels, [counts[v] for v in labels]]))
        require(3 <= len(labels) <= 8, "At most 8 columns")
        consecutive = labels == list(range(labels[0], labels[-1] + 1))
        desc = option["label"]
        marks = ", ".join(f"{counts[v]} {'mark' if counts[v] == 1 else 'marks'} above {v}" for v in labels if counts[v])
        require(desc.endswith(f": {marks}."), f"Description lists the drawn marks: {desc!r}")
        unit_text = f"{unit}: "
        if consecutive:
            require(desc.startswith(f"A line plot numbered {labels[0]} to {labels[-1]} {unit_text}"), "Description names the scale")
        else:
            require(desc.startswith("A line plot numbered only "), "Description names the skipped scale")
        if consecutive and labels[0] <= max(lo - 1, 0) and labels[-1] >= hi + 1 and \
                {v: c for v, c in counts.items() if c} == data:
            hits.append(option["id"])
    require(len(seen) == 4, "Four different plots")
    require(len(hits) == 1, f"Exactly one plot shows the data, found {len(hits)}")
    return hits[0], (family, values)


def review_plot(problem):
    answer, (family, values) = solve_plot(problem["public"])
    require(set(problem.get("choiceFeedback", {})) == {o["id"] for o in problem["public"]["response"]["options"]} - {answer},
            "Feedback for every wrong plot")
    require(re.search(rf"\b{len(values)} measurements\b", problem["hint"]), "Hint names the count")
    return answer


SOLVERS = {
    "ruler-length-difference": (solve_difference, review_difference),
    "compare-measured-lengths": (solve_compare, review_compare),
    "ruler-read-nearest-unit": (solve_nearest, review_nearest),
    "line-plot-choose-for-data": (solve_plot, review_plot),
}


def solve(public):
    template = public["templateId"]
    require(template in SUPPORTED, "Wrong family")
    return SOLVERS[template][0](public)[0]


def review_problem(problem):
    public = problem["public"]
    template = public["templateId"]
    require(template in SUPPORTED, "Wrong family")
    expected = SOLVERS[template][1](problem)
    require(isinstance(problem["answer"], str) and problem["answer"] == expected,
            f"Answer {problem['answer']} disagrees with the figure; expected {expected}")
    for text in [public["prompt"], problem["hint"], *problem["explanation"]]:
        require(not PLACEHOLDER.search(text), f"Unrendered placeholder in {text!r}")
    return expected


REVIEW_RETURNS_ANSWER = True


# ---------------------------------------------------------------- self test

def _ruler(rid, length, every, unit_text, bars, top=0):
    els = [{"type": "rect", "id": f"{rid}-body", "at": [-0.3, top - 1], "size": [length + 0.6, 1]}]
    for k in range(0, length + 1, every):
        els.append({"type": "text", "id": f"{rid}-n{k}", "at": [k, top - 0.5], "text": str(k)})
    els.append({"type": "text", "id": f"{rid}-unit", "at": [length, top - 1], "text": unit_text})
    for i, (name, start, end) in enumerate(bars):
        els.append({"type": "rect", "id": f"{rid}-bar{i}", "at": [start, top + 0.3 + i], "size": [end - start, 0.4]})
        els.append({"type": "text", "id": f"{rid}-name{i}", "at": [(start + end) / 2, top + 0.7 + i], "text": name})
    return els


def _plot(scale, values):
    els = [{"type": "segment", "id": "axis", "from": [-0.5, 0], "to": [len(scale) - 0.5, 0]}]
    ops = []
    for i, v in enumerate(scale):
        els.append({"type": "tick", "id": f"t{i}", "at": [i, 0]})
        els.append({"type": "text", "id": f"n{i}", "at": [i, 0], "text": str(v)})
        for level in range(values.count(v)):
            y = 0.4 + 0.5 * level
            ops += [["M", i - 0.1, y - 0.1], ["L", i + 0.1, y + 0.1], ["M", i - 0.1, y + 0.1], ["L", i + 0.1, y - 0.1]]
    if ops:
        els.append({"type": "path", "id": "marks", "d": ops})
    return {"v": 1, "elements": els}


def _describe(scale, values, unit="centimeters"):
    marks = ", ".join(f"{values.count(v)} {'mark' if values.count(v) == 1 else 'marks'} above {v}" for v in scale if values.count(v))
    if scale == list(range(scale[0], scale[-1] + 1)):
        return f"A line plot numbered {scale[0]} to {scale[-1]} {unit}: {marks}."
    return f"A line plot numbered only {', '.join(map(str, scale[:-1]))} and {scale[-1]} {unit}: {marks}."


def self_test():
    difference = {"public": {"templateId": "ruler-length-difference", "seed": "f",
                             "prompt": "A ribbon and a crayon lie along a ruler. How much longer is the ribbon than the crayon? Answer in centimeters.",
                             "response": {"kind": "number", "label": "centimeters"},
                             "figure": {"kind": "scene", "scene": {"v": 1, "elements": _ruler("ruler", 15, 1, "cm", [("crayon", 2, 11), ("ribbon", 5, 12)])}}},
                  "answer": "2", "hint": "Find the length of the crayon and of the ribbon first.",
                  "explanation": ["The crayon: $11 - 2 = 9$.", "The ribbon: $12 - 5 = 7$.", "Longer minus shorter: $9 - 7 = 2$.", "Check: $7 + 2 = 9$."]}
    # The ribbon is shorter here, so the "longer" question is false: fix it.
    difference["public"]["prompt"] = "A ribbon and a crayon lie along a ruler. How much longer is the crayon than the ribbon? Answer in centimeters."
    require(review_problem(difference) == "2", "Difference fixture")
    compare = {"public": {"templateId": "compare-measured-lengths", "seed": "f",
                          "prompt": "A pencil lies on the top ruler and a straw lies on the bottom ruler. Both rulers are marked in centimeters. Measure both objects. Which is longer, and by how much?",
                          "response": {"kind": "multi-part-choice", "label": "Choose an answer for each part", "layout": "slots",
                                       "blanks": [{"id": "longer", "label": "Which is longer?", "options": [{"id": "a", "label": "straw"}, {"id": "b", "label": "pencil"}, {"id": "c", "label": "They are the same length"}]},
                                                  {"id": "by", "label": "By how much?", "options": [{"id": "a", "label": "1 centimeter"}, {"id": "b", "label": "2 centimeters"}, {"id": "c", "label": "1 inch"}, {"id": "d", "label": "18 centimeters"}]}]},
                          "figure": {"kind": "scene", "scene": {"v": 1, "elements": _ruler("ruler0", 30, 2, "cm", [("pencil", 0, 18)]) + _ruler("ruler1", 30, 2, "cm", [("straw", 4, 21)], top=-5)}}},
               "answer": '{"longer":"b","by":"a"}', "hint": "Measure each one.",
               "explanation": ["The pencil: 18.", "The straw: $21 - 4 = 17$.", "18 is more than 17.", "$18 - 17 = 1$."]}
    require(review_problem(compare) == compare["answer"], "Compare fixture")
    nearest = {"public": {"templateId": "ruler-read-nearest-unit", "seed": "f",
                          "prompt": "Measure the leaf to the nearest centimeter. How long is it?",
                          "response": {"kind": "number", "label": "centimeters"},
                          "figure": {"kind": "scene", "scene": {"v": 1, "elements": _ruler("ruler", 12, 1, "cm", [("leaf", 3, 10.7)])}}},
               "answer": "8", "hint": "The leaf does not start at 0.",
               "explanation": ["The leaf starts at 3, not at 0.", "Its end is past the 10 mark.", "Count the units from 3 to 11: $11 - 3 = 8$.", "The leaf is about 8 centimeters long."]}
    require(review_problem(nearest) == "8", "Nearest fixture")
    values = [7, 8, 10, 7, 10, 8, 10]
    scale = list(range(6, 12))
    plots = [(scale, values), (scale, [v - 1 for v in values]), (scale, [7, 8, 10]), ([7, 8, 10], values)]
    options = [{"id": f"option-{c}", "label": _describe(s, v), "scene": _plot(s, v)} for c, (s, v) in zip("abcd", plots)]
    plot = {"public": {"templateId": "line-plot-choose-for-data", "seed": "f",
                       "prompt": "Noah measured 7 ribbons to the nearest centimeter. The lengths, in centimeters, were 7, 8, 10, 7, 10, 8 and 10. Which line plot shows these measurements?",
                       "response": {"kind": "figure-choice", "label": "Choose the line plot", "noun": "Graph", "options": options}},
            "answer": "option-a", "hint": "There are 7 measurements, so the right plot has 7 marks.",
            "explanation": ["Each measurement gets one mark.", "Graph A has 3 marks above 10."],
            "choiceFeedback": {"option-b": "Shifted.", "option-c": "Dropped.", "option-d": "Skipped."}}
    require(review_problem(plot) == "option-a", "Plot fixture")
    mutations = 0
    for base, change, what in (
            (difference, lambda p: p.update(answer="3"), "wrong difference"),
            (difference, lambda p: p["public"].update(prompt=p["public"]["prompt"].replace("longer is the crayon than the ribbon", "longer is the ribbon than the crayon")), "named the shorter object longer"),
            (difference, lambda p: p["public"]["figure"]["scene"]["elements"][3].update(text="4"), "mislabeled tick"),
            (difference, lambda p: p["explanation"].__setitem__(2, "Longer minus shorter: $9 - 7 = 3$."), "false worked step"),
            (compare, lambda p: p.update(answer='{"longer":"a","by":"a"}'), "wrong object"),
            (compare, lambda p: p["public"]["response"]["blanks"][1]["options"][1].update(label="1 centimeters"), "count and noun disagree"),
            (nearest, lambda p: p.update(answer="11"), "end mark read as the length"),
            (nearest, lambda p: p["public"]["figure"]["scene"]["elements"][-2].update(size=[7.5, 0.4]), "halfway end"),
            (plot, lambda p: p.update(answer="option-d"), "skipped scale accepted"),
            (plot, lambda p: p["public"]["response"]["options"][0].update(label=_describe(scale, [7, 8, 10, 7, 10, 8])), "description disagrees with marks"),
            (plot, lambda p: p["public"].update(prompt=p["public"]["prompt"].replace("7, 8, 10, 7", "7, 8, 9, 7")), "list disagrees with every plot")):
        bad = copy.deepcopy(base)
        change(bad)
        try:
            review_problem(bad)
        except (ValueError, KeyError, TypeError, IndexError, ZeroDivisionError):
            mutations += 1
        else:
            raise AssertionError(f"Accepted corrupt ruler/line-plot case: {what}")
    return {"fixtures": 4, "mutations": mutations}


if __name__ == "__main__":
    print(self_test())
