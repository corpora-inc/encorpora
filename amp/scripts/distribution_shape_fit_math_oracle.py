"""Independent review of the distribution and trend-line families from their
public payloads only.

Dot plots: the center (middle value), the smallest and largest values, and
the shape are recomputed from the plotted values, the shape by a classifier
of its own (an empty interior run means two clusters; stacks within a factor
of two of each other mean flat; otherwise the dots left and right of the
tallest stack decide symmetric or the side of the tail). Scatter plots: the
least-squares line, the sum of vertical distances to each drawn line, the
points above and below it, the end-against-middle residual pattern of a
curve and the 75% end split of a tilted line are recomputed from the points.
The private answer, hint and explanation are only values under test.
"""

import copy
import json
import math
import re
from fractions import Fraction as F

SUPPORTED = frozenset({
    "distribution-describe-dot-plot",
    "distribution-match-description",
    "distribution-read-description",
    "statistical-question-distribution-answer",
    "trend-line-best-fit-choice",
    "trend-line-fit-assess",
})
REVIEW_RETURNS_ANSWER = True
PLACEHOLDER = re.compile(r"\$\{|\bundefined\b|\bNaN\b|\bnull\b|\[object|Infinity")
PHRASE = {
    "symmetric": "roughly symmetric: one mound, about even on both sides",
    "tail-high": "piled up at low values, with a tail toward high values",
    "tail-low": "piled up at high values, with a tail toward low values",
    "two-clusters": "in two separate clusters, with an empty gap between them",
    "uniform": "flat, with about the same number of dots at every value",
}
SHORT = {
    "symmetric": "one mound, about even on both sides",
    "tail-high": "piled at low values, tail toward high",
    "tail-low": "piled at high values, tail toward low",
    "two-clusters": "two clusters with a gap between them",
    "uniform": "flat, about the same at every value",
}
STATEMENTS = {
    "good": "The line fits well: the points are close to it, with about as many above it as below.",
    "above": "The line does not fit well: almost all of the points lie above the line, not around it.",
    "below": "The line does not fit well: almost all of the points lie below the line, not around it.",
    "tilt": "The line does not fit well: points at one end lie above it, and at the other end below it.",
    "curve": "No straight line fits well: the points curve, so the points at both ends are far from it.",
    "twoDots": "The line fits well: it passes right through two of the data points, so it must be good.",
    "everyDot": "The line does not fit well: a good line must pass through every one of the points.",
    "sameWay": "The line fits well: it slopes the same way as the points do, so it matches the data.",
    "spacing": "The line does not fit well: the points are not evenly spaced from left to right.",
    "bothSides": "The line fits well: the points are far from it, but there are some on both sides.",
}
FITS_WELL = {"good", "twoDots", "sameWay", "bothSides"}
EPS = 1e-9


def require(condition, message):
    if not condition:
        raise ValueError(message)


def compact(key):
    return json.dumps(key, separators=(",", ":"))


# ---------------------------------------------------------------- dot plots

def dot_plot(scene):
    elements = scene["elements"]
    require(len(elements) == 1 and elements[0]["type"] == "dotPlot", "One dot plot")
    plot = elements[0]
    require(len(plot["groups"]) == 1, "One group")
    values = plot["groups"][0]["values"]
    require(all(isinstance(v, int) and plot["min"] <= v <= plot["max"] for v in values), "Whole values on the scale")
    return plot["min"], plot["max"], values, plot.get("unit")


def classify(values):
    lo, hi = min(values), max(values)
    stacks = [values.count(v) for v in range(lo, hi + 1)]
    runs, inside = 0, False
    for c in stacks:
        if c and not inside:
            runs += 1
        inside = c > 0
    if runs == 2:
        return "two-clusters"
    require(runs == 1, "One or two runs of stacks")
    if max(stacks) <= 2 * min(stacks):
        return "uniform"
    mode = lo + stacks.index(max(stacks))
    left = sum(1 for v in values if v < mode)
    right = sum(1 for v in values if v > mode)
    if abs(left - right) <= 1:
        return "symmetric"
    return "tail-high" if right > left else "tail-low"


def summary(values):
    s = sorted(values)
    n = len(s)
    median = F(s[(n - 1) // 2] + s[n // 2], 2)
    require(median.denominator == 1, "Whole-number center")
    return {"n": n, "min": s[0], "max": s[-1], "median": int(median),
            "mean": F(sum(s), n), "family": classify(values),
            "tallest": max(values.count(v) for v in set(values))}


def check_pattern(st):
    require(13 <= st["n"] <= 22, f"13 to 22 dots, got {st['n']}")
    require(st["max"] - st["min"] in (8, 10), "Spread of 8 or 10")
    require(st["tallest"] <= 6, "Stacks of at most 6")


def option_by(blank, predicate, what):
    found = [o["id"] for o in blank["options"] if predicate(o["label"])]
    require(len(found) == 1, f"Exactly one {what}: {found}")
    return found[0]


def blanks_of(public, ids):
    response = public["response"]
    require(response["kind"] == "multi-part-choice" and response["layout"] == "slots", "Slots")
    blanks = response["blanks"]
    require([b["id"] for b in blanks] == list(ids), "Blank ids")
    for b in blanks:
        require([o["id"] for o in b["options"]] == list("abcdef"[: len(b["options"])]), "Option ids by position")
        require(len({o["label"] for o in b["options"]}) == len(b["options"]), "Distinct options")
    return blanks


def solve_describe(public):
    lo, hi, values, _ = dot_plot(public["figure"]["scene"])
    st = summary(values)
    check_pattern(st)
    center, spread, shape = blanks_of(public, ("center", "spread", "shape"))
    ints = [int(o["label"]) for o in center["options"]]
    require(3 <= len(ints) <= 4, "Three or four centers")
    for v in ints:
        if v != st["median"]:
            require(abs(v - st["median"]) >= 3, f"Center distractor {v} too near")
            require(abs(st["mean"] - v) > abs(st["mean"] - st["median"]), "Mean nearest the center")
    key = {"center": option_by(center, lambda l: int(l) == st["median"], "center")}
    span = re.compile(r"The values go from (\d+) to (\d+), so they spread over (\d+) (\w+)\.")

    def right_spread(label):
        m = span.fullmatch(label)
        return bool(m) and (int(m[1]), int(m[2]), int(m[3])) == (st["min"], st["max"], st["max"] - st["min"])
    key["spread"] = option_by(spread, right_spread, "spread")
    claims = []
    for o in spread["options"]:
        m = span.fullmatch(o["label"]) or re.fullmatch(r"The spread is (\d+), .*", o["label"])
        require(m is not None, f"Spread statement {o['label']!r}")
        claims.append(int(m[3] if m.re is span else m[1]))
    require(len(set(claims)) == 4, "Four different spread claims")
    require(sorted(o["label"] for o in shape["options"]) == sorted(f"The data are {p}." for p in PHRASE.values()), "Five shapes")
    key["shape"] = option_by(shape, lambda l: l == f"The data are {PHRASE[st['family']]}.", "shape")
    return compact(key), st


def solve_match(public):
    m = re.search(r"The data collected were centered around (\d+), spread from (\d+) to (\d+), and (.+)\. Which dot plot shows these data\?$", public["prompt"])
    require(m is not None, "Description in the prompt")
    target = (int(m[1]), int(m[2]), int(m[3]), m[4])
    response = public["response"]
    require(response["kind"] == "figure-choice" and response["noun"] == "Graph", "Figure choice")
    scales, matches, stats = set(), [], []
    for option in response["options"]:
        lo, hi, values, _ = dot_plot(option["scene"])
        scales.add((lo, hi))
        st = summary(values)
        stats.append(st)
        counts = ", ".join(f"{values.count(v)} at {v}" for v in sorted(set(values)))
        require(option["label"] == f"A dot plot of {st['n']} dots: {counts}.", "Card description")
        if (st["median"], st["min"], st["max"], PHRASE[st["family"]]) == target:
            matches.append(option["id"])
    require(len(scales) == 1, "One scale for every plot")
    require(len(matches) == 1, f"Exactly one plot matches: {matches}")
    lo, hi = scales.pop()
    require(hi - lo + 1 <= 14, "At most 14 ticks")
    # The shifted plot keeps the shape and spread; the narrow one keeps the center.
    require(any(st["median"] == target[0] + 3 and st["max"] - st["min"] == target[2] - target[1] for st in stats), "A shifted plot")
    require(any(st["median"] == target[0] and st["max"] - st["min"] <= target[2] - target[1] - 3 for st in stats), "A narrower plot")
    return matches[0], target


def solve_read(public):
    lo, hi, values, _ = dot_plot(public["figure"]["scene"])
    st = summary(values)
    check_pattern(st)
    response = public["response"]
    require(response["kind"] == "choice" and len(response["options"]) == 4, "Four choices")
    pattern = re.compile(r"Centered around (\d+), spread from (\d+) to (\d+), and (.+)\.")
    right = []
    for o in response["options"]:
        m = pattern.fullmatch(o["label"])
        require(m is not None, f"Description {o['label']!r}")
        require(m[4] in PHRASE.values(), "Known shape")
        if (int(m[1]), int(m[2]), int(m[3]), m[4]) == (st["median"], st["min"], st["max"], PHRASE[st["family"]]):
            right.append(o["id"])
    require(len(right) == 1, f"Exactly one correct description: {right}")
    lengths = [len(o["label"]) for o in response["options"]]
    require(max(lengths) - min(lengths) <= 12, "Lengths within 12 characters")
    return right[0], st


def statistical(question):
    """A question about every member of a group, whose answers vary."""
    return bool(re.search(r"\beach (student|player|bean plant)\b", question)) and not question.startswith("What is the")


def solve_question(public):
    lo, hi, values, unit = dot_plot(public["figure"]["scene"])
    st = summary(values)
    check_pattern(st)
    question, answer = blanks_of(public, ("question", "answer"))
    key = {"question": option_by(question, statistical, "statistical question")}
    asked = next(o["label"] for o in question["options"] if o["id"] == key["question"])
    words = [w.strip("()").lower() for w in unit.split() if len(w.strip("()")) > 3]
    require(any(w in asked.lower() for w in words), "The question measures what the plot shows")
    require(st["n"] != st["median"], "Count differs from the center")
    pattern = re.compile(r"Centered near (\d+), spread from (\d+) to (\d+), (.+)\.")

    def describes(label):
        m = pattern.fullmatch(label)
        return bool(m) and (int(m[1]), int(m[2]), int(m[3]), m[4]) == (st["median"], st["min"], st["max"], SHORT[st["family"]])
    key["answer"] = option_by(answer, describes, "distribution answer")
    lengths = [len(o["label"]) for o in answer["options"]]
    require(max(lengths) - min(lengths) <= 12, "Answer lengths within 12 characters")
    return compact(key), st


# ---------------------------------------------------------------- scatter plots

def graph_of(scene):
    elements = scene["elements"]
    require(len(elements) == 1 and elements[0]["type"] == "graph", "One graph")
    g = elements[0]
    sc = g["scatter"]
    points = [(F(x), F(y)) for x, y in sc["points"]]
    require(all(p[0].denominator == 1 and p[1].denominator == 1 for p in points), "Lattice points")
    fit = sc["fit"]
    return g, points, (fit["m"], fit["b"])


def least_squares(points):
    n = len(points)
    mx = sum(x for x, _ in points) / n
    my = sum(y for _, y in points) / n
    sxx = sum((x - mx) ** 2 for x, _ in points)
    sxy = sum((x - mx) * (y - my) for x, y in points)
    m = sxy / sxx
    return m, my - m * mx


def correlation(points):
    n = len(points)
    mx = sum(x for x, _ in points) / n
    my = sum(y for _, y in points) / n
    sxx = sum((x - mx) ** 2 for x, _ in points)
    syy = sum((y - my) ** 2 for _, y in points)
    sxy = sum((x - mx) * (y - my) for x, y in points)
    return float(sxy) / math.sqrt(float(sxx * syy))


def residuals(points, line):
    m, b = line
    return [float(y) - (m * float(x) + b) for x, y in points]


def distance_sum(points, line):
    return sum(abs(r) for r in residuals(points, line))


def above_below(points, line):
    res = residuals(points, line)
    return sum(1 for r in res if r > EPS), sum(1 for r in res if r < -EPS)


def curved(points):
    m, b = least_squares(points)
    xs = [float(x) for x, _ in points]
    lo, hi = min(xs), max(xs)
    t = [(x - lo) / (hi - lo) for x in xs]
    res = residuals(points, (float(m), float(b)))
    ends = [r for r, s in zip(res, t) if s <= 0.125 or s >= 0.875]
    middle = [r for r, s in zip(res, t) if 0.35 <= s <= 0.65]
    left, right = any(s <= 0.125 for s in t), any(s >= 0.875 for s in t)
    up = all(r > EPS for r in ends) and all(r < -EPS for r in middle)
    down = all(r < -EPS for r in ends) and all(r > EPS for r in middle)
    return left and right and len(middle) >= 2 and (up or down)


def tilted(points, line):
    xs = [float(x) for x, _ in points]
    mid = (min(xs) + max(xs)) / 2

    def share(side):
        pts = [p for p in points if (float(p[0]) < mid if side == "left" else float(p[0]) > mid)]
        a, b = above_below(pts, line)
        return a / len(pts), b / len(pts)
    lu, ld = share("left")
    ru, rd = share("right")
    return (lu >= 0.75 and rd >= 0.75) or (ld >= 0.75 and ru >= 0.75)


def solve_best_fit(public):
    response = public["response"]
    require(response["kind"] == "figure-choice" and response["noun"] == "Graph" and len(response["options"]) == 4, "Four graphs")
    data, lines = None, []
    for option in response["options"]:
        g, points, line = graph_of(option["scene"])
        if data is None:
            data = (sorted(points), g["x"], g["y"])
        require((sorted(points), g["x"], g["y"]) == data, "Same points and axes in every graph")
        lines.append((option["id"], line))
        a, b = above_below(points, line)
        require(re.search(rf"; {a} points? lies? above it and {b} below\.$", option["label"]) is not None, "Card counts")
    points = data[0]
    n = len(points)
    require(9 <= n <= 12 and abs(correlation(points)) >= 0.85, "A strong linear cloud of 9 to 12 points")
    require(not curved(points), "A straight cloud")
    ls = tuple(float(v) for v in least_squares(points))
    best_sae = distance_sum(points, ls)
    sums = sorted((distance_sum(points, line), oid, line) for oid, line in lines)
    key_sae, key, key_line = sums[0]
    require(key_sae <= 1.2 * best_sae + EPS, "The keyed line is near the least-squares fit")
    a, b = above_below(points, key_line)
    require(abs(a - b) <= 2, "Points on both sides of the keyed line")
    for s, oid, _ in sums[1:]:
        require(s >= 1.8 * key_sae - EPS, f"Distractor {oid} is clearly worse")
    return key, (points, key_line)


def true_statements(points, line):
    n = len(points)
    a, b = above_below(points, line)
    ls = tuple(float(v) for v in least_squares(points))
    is_curved = curved(points)
    good = (not is_curved) and distance_sum(points, line) <= 1.2 * distance_sum(points, ls) + EPS and abs(a - b) <= 2
    truth = {"good": good, "above": a >= n - 1, "below": b >= n - 1,
             "tilt": tilted(points, line), "curve": is_curved}
    for k in ("twoDots", "sameWay", "bothSides"):
        truth[k] = good
    for k in ("everyDot", "spacing"):
        truth[k] = not good
    return truth


def solve_assess(public):
    g, points, line = graph_of(public["figure"]["scene"])
    require(9 <= len(points) <= 12, "9 to 12 points")
    response = public["response"]
    require(response["kind"] == "choice" and len(response["options"]) == 4, "Four statements")
    by_text = {v: k for k, v in STATEMENTS.items()}
    truth = true_statements(points, line)
    right = []
    for o in response["options"]:
        require(o["label"] in by_text, f"Known statement {o['label']!r}")
        if truth[by_text[o["label"]]]:
            right.append(o["id"])
    require(len(right) == 1, f"Exactly one true statement: {right}")
    lengths = [len(o["label"]) for o in response["options"]]
    require(max(lengths) <= 1.25 * min(lengths), "Statement lengths within 25%")
    keyed = by_text[next(o["label"] for o in response["options"] if o["id"] == right[0])]
    if keyed == "curve":
        ls = tuple(float(v) for v in least_squares(points))
        require(all(abs(u - v) < 1e-6 for u, v in zip(line, ls)), "A curved cloud shows its least-squares line")
    return right[0], (points, line, keyed)


# ---------------------------------------------------------------- reviews

SOLVERS = {
    "distribution-describe-dot-plot": solve_describe,
    "distribution-match-description": solve_match,
    "distribution-read-description": solve_read,
    "statistical-question-distribution-answer": solve_question,
    "trend-line-best-fit-choice": solve_best_fit,
    "trend-line-fit-assess": solve_assess,
}


def solve(public):
    template = public["templateId"]
    require(template in SUPPORTED, "Wrong family")
    return SOLVERS[template](public)[0]


def review_explanation(template, problem, model):
    text = " ".join(problem["explanation"])
    if template in ("distribution-describe-dot-plot", "distribution-read-description"):
        st = model
        require(f"the smallest value is {st['min']} and the largest is {st['max']}" in text, "Spread line")
        require(f"${st['max']} - {st['min']} = {st['max'] - st['min']}$" in text, "Spread arithmetic")
        require(f"centered around {st['median']}" in text, "Center line")
        require(f"there are {st['n']} dots" in text, "Dot count")
    elif template == "statistical-question-distribution-answer":
        st = model
        require(f"Counting the dots gives {st['n']}" in text, "Count line")
        require(f"Center: near {st['median']}. Spread: from {st['min']} to {st['max']}." in text, "Description line")
    elif template == "trend-line-fit-assess":
        points, line, _ = model
        a, b = above_below(points, line)
        require(re.search(rf"Check both sides: {a} points? (?:is|are) above the line and {b} (?:is|are) below it", text) is not None, "Side counts")
    elif template == "trend-line-best-fit-choice":
        points, line = model
        a, b = above_below(points, line)
        require(re.search(rf"fits best: {a} points? lies? above it and {b} below", text) is not None, "Best line counts")


def review_problem(problem):
    public = problem["public"]
    template = public["templateId"]
    require(template in SUPPORTED, "Wrong family")
    expected, model = SOLVERS[template](public)
    require(problem["answer"] == expected, f"Answer {problem['answer']} disagrees; expected {expected}")
    review_explanation(template, problem, model)
    for text in [public["prompt"], problem["hint"], *problem["explanation"], *problem.get("choiceFeedback", {}).values()]:
        require(not PLACEHOLDER.search(text), f"Unrendered placeholder in {text!r}")
    return expected


# ---------------------------------------------------------------- self test

def dot_scene(lo, hi, values, unit="Books read"):
    return {"v": 1, "elements": [{"type": "dotPlot", "id": "plot", "min": lo, "max": hi, "mark": "dot",
                                  "groups": [{"values": values}], "unit": unit}]}


def spread_of(pattern, start):
    return [start + i for i, c in enumerate(pattern) for _ in range(c)]


def opts(labels):
    return [{"id": "abcdef"[i], "label": l} for i, l in enumerate(labels)]


def graph_scene(points, line):
    return {"v": 1, "elements": [{"type": "graph", "x": [0, 11], "y": [0, 60], "grid": [1, 10], "tick": [1, 10],
                                  "scatter": {"points": points, "fit": {"m": line[0], "b": line[1]}}}]}


def self_test():
    sym = spread_of([1, 1, 2, 3, 4, 3, 2, 1, 1], 3)  # 18 dots, 3..11, center 7
    describe = {"public": {"templateId": "distribution-describe-dot-plot", "seed": "f", "prompt": "Describe the distribution.",
                           "figure": {"kind": "scene", "scene": dot_scene(1, 13, sym)},
                           "response": {"kind": "multi-part-choice", "label": "Choose", "layout": "slots", "blanks": [
                               {"id": "center", "label": "Center", "options": opts(["11", "7", "3"])},
                               {"id": "spread", "label": "Spread", "options": opts([
                                   "The values go from 1 to 13, so they spread over 12 books.",
                                   "The values go from 3 to 11, so they spread over 8 books.",
                                   "The spread is 18, because there are 18 data values.",
                                   "The spread is 4, the height of the tallest stack."])},
                               {"id": "shape", "label": "Shape", "options": opts([f"The data are {PHRASE[k]}." for k in PHRASE])}]}},
                "answer": '{"center":"b","spread":"b","shape":"a"}', "hint": "There are 18 dots.",
                "explanation": ["Center: there are 18 dots. The data are centered around 7.",
                                "Spread: the smallest value is 3 and the largest is 11. The data spread over $11 - 3 = 8$ books.",
                                "Shape: one mound."]}
    require(review_problem(describe) == describe["answer"], "Describe fixture")
    tail = spread_of([2, 5, 4, 3, 2, 1, 1, 1, 1], 2)
    read = {"public": {"templateId": "distribution-read-description", "seed": "f", "prompt": "Which description?",
                       "figure": {"kind": "scene", "scene": dot_scene(1, 12, tail)},
                       "response": {"kind": "choice", "label": "Choose", "options": [
                           {"id": "option-a", "label": f"Centered around 4, spread from 2 to 10, and {PHRASE['tail-high']}."},
                           {"id": "option-b", "label": f"Centered around 10, spread from 2 to 10, and {PHRASE['tail-high']}."},
                           {"id": "option-c", "label": f"Centered around 4, spread from 1 to 12, and {PHRASE['tail-high']}."},
                           {"id": "option-d", "label": f"Centered around 4, spread from 2 to 10, and {PHRASE['tail-low']}."}]}},
            "answer": "option-a", "hint": "Count.",
            "explanation": ["Center: there are 20 dots. The data are centered around 4.",
                            "Spread: the smallest value is 2 and the largest is 10. The data spread over $10 - 2 = 8$ books."]}
    require(review_problem(read) == "option-a", "Read fixture")
    points = [[1, 12], [2, 13], [3, 19], [4, 18], [5, 24], [6, 23], [7, 29], [8, 28], [9, 34], [10, 33]]
    ls = tuple(float(v) for v in least_squares([(F(x), F(y)) for x, y in points]))
    assess = {"public": {"templateId": "trend-line-fit-assess", "seed": "f", "prompt": "How well?",
                         "figure": {"kind": "scene", "scene": graph_scene(points, ls)},
                         "response": {"kind": "choice", "label": "Choose", "options": [
                             {"id": "option-a", "label": STATEMENTS["above"]},
                             {"id": "option-b", "label": STATEMENTS["good"]},
                             {"id": "option-c", "label": STATEMENTS["tilt"]},
                             {"id": "option-d", "label": STATEMENTS["spacing"]}]}},
              "answer": "option-b", "hint": "Count.",
              "explanation": ["Check both sides: 4 points are above the line and 6 are below it."]}
    require(review_problem(assess) == "option-b", "Assess fixture")
    mutations = 0
    for base, change, what in (
            (describe, lambda p: p.update(answer='{"center":"a","spread":"b","shape":"a"}'), "an end as the center"),
            (describe, lambda p: p["public"]["figure"]["scene"]["elements"][0]["groups"][0]["values"].append(11), "a moved center"),
            (describe, lambda p: p["explanation"].__setitem__(1, "Spread: the smallest value is 3 and the largest is 11. The data spread over $11 - 3 = 9$ books."), "false spread arithmetic"),
            (read, lambda p: p.update(answer="option-d"), "mirrored tail"),
            (read, lambda p: p["public"]["response"]["options"][1].update(label=f"Centered around 4, spread from 2 to 10, and {PHRASE['tail-high']}!"), "unreadable option"),
            (assess, lambda p: p["public"]["figure"]["scene"]["elements"][0]["scatter"]["fit"].update(b=ls[1] + 20), "a shifted line keyed as good"),
            (assess, lambda p: p["explanation"].__setitem__(0, "Check both sides: 5 points are above the line and 5 are below it."), "wrong counts")):
        bad = copy.deepcopy(base)
        change(bad)
        try:
            review_problem(bad)
        except (ValueError, KeyError, TypeError, IndexError, ZeroDivisionError, StopIteration):
            mutations += 1
        else:
            raise AssertionError(f"Accepted corrupt case: {what}")
    require(classify(spread_of([2, 3, 2, 0, 0, 0, 2, 3, 2], 0)) == "two-clusters", "Clusters")
    require(classify(spread_of([1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1], 0)) == "uniform", "Flat")
    require(classify(spread_of([1, 1, 1, 1, 2, 3, 4, 5, 2], 0)) == "tail-low", "Tail toward low")
    return {"fixtures": 3, "mutations": mutations}


if __name__ == "__main__":
    print(self_test())
