"""Independent oracle for the grade-4 data templates, from the public payload.

Build-a-plot answers are the JSON of counts read from the listed lengths.
Line-plot matching compares the list with each graph's marks. Mode, median
and range are read from the drawn marks. Frequency tables are rebinned from
the list or from the printed rows. Scaled bar graphs add two bar values and
subtract a third. None of this calls the TypeScript generator.
"""

import json
import re
from collections import Counter

SUPPORTED = frozenset({
    "line-plot-build-slots",
    "line-plot-data-match",
    "line-plot-center-range",
    "frequency-table-grade4",
    "scaled-bar-grade4",
})
CHOICE_REVIEW = frozenset({
    "line-plot-build-slots",
    "line-plot-data-match",
    "line-plot-center-range",
    "frequency-table-grade4",
})
REVIEW_RETURNS_ANSWER = False

DASH = "\u2013"
LENGTH_LIST = re.compile(r"The lengths, in inches, are: ([^.]+)\.")
NUMBER_LIST = re.compile(r"The numbers are: ([0-9, ]+)\.")
TABLE_CELL = re.compile(rf"(\d+){DASH}(\d+): (\d+)")
TABLE_ROW = re.compile(rf"(\d+){DASH}(\d+) has (\d+)")
BAR_MORE = re.compile(
    r"How many more (\w+) are in (\w+) and (\w+) together than in (\w+)\?"
)
BAR_STEP = re.compile(r"Each line on the side counts as (\d+) ")


def require(condition, message):
    if not condition:
        raise ValueError(message)


def only(hits, what):
    require(len(hits) == 1, f"Exactly one {what}; found {len(hits)}")
    return hits[0]


def plot_element(scene):
    elements = [e for e in scene["elements"] if e.get("type") == "dotPlot"]
    require(len(elements) == 1, "One dot plot required")
    return elements[0]


def ticks_of(element):
    d = element["denominator"]
    ticks = []
    for value in element["groups"][0]["values"]:
        scaled = value * d
        nearest = int(round(scaled))
        require(abs(scaled - nearest) < 1e-6, f"Value {value} is off a tick of 1/{d}")
        ticks.append(nearest)
    return d, ticks


def parse_length(token, d):
    token = token.strip()
    mixed = re.fullmatch(r"(\d+) (\d+)/(\d+)", token)
    if mixed:
        require(int(mixed[3]) == d, f"Length {token} is not in {d}ths")
        return int(mixed[1]) * d + int(mixed[2])
    frac = re.fullmatch(r"(\d+)/(\d+)", token)
    if frac:
        require(int(frac[2]) == d, f"Length {token} is not in {d}ths")
        return int(frac[1])
    whole = re.fullmatch(r"(\d+)", token)
    require(whole is not None, f"Not a length: {token}")
    return int(whole[1]) * d


def length_list(prompt):
    match = LENGTH_LIST.search(prompt)
    require(match is not None, "Missing length list")
    parts = [part.strip() for part in match[1].split(", ") if part.strip()]
    require(parts, "Empty length list")
    return parts


def tick_label(tick, d):
    whole, rest = divmod(tick, d)
    if rest == 0:
        return str(whole)
    if whole:
        return f"{whole} {rest}/{d}"
    return f"{rest}/{d}"


def inch_label(tick, d):
    unit = "inch" if tick <= d else "inches"
    return f"{tick_label(tick, d)} {unit}"


def solve_build(public):
    lengths = length_list(public["prompt"])
    response = public["response"]
    require(response["kind"] == "multi-part-choice", "Multi-part response required")
    plot = plot_element(public["figure"]["scene"])
    require(plot.get("blank") is True, "The line plot must be blank")
    require(plot["groups"][0]["values"] == [], "A blank plot has no marks")
    key = {}
    used = 0
    for blank in response["blanks"]:
        count = sum(1 for length in lengths if length == blank["label"])
        used += count
        option = next((o for o in blank["options"] if o["label"] == str(count)), None)
        require(option is not None, f"No option for count {count} at {blank['label']}")
        key[blank["id"]] = option["id"]
    require(used == len(lengths), "A listed length is not on a mark")
    return json.dumps(key, separators=(",", ":"))


def solve_match(public):
    options = public["response"]["options"]
    require(public["response"]["kind"] == "figure-choice", "Figure choice required")
    require(len(options) >= 2, "At least two graphs required")
    plots = [plot_element(option["scene"]) for option in options]
    d = plots[0]["denominator"]
    require(all(plot["denominator"] == d for plot in plots), "Graphs use different scales")
    listed = sorted(parse_length(token, d) for token in length_list(public["prompt"]))
    hits = []
    for option, plot in zip(options, plots):
        _d, ticks = ticks_of(plot)
        if sorted(ticks) == listed:
            hits.append(option["id"])
    return only(hits, "graph matches the list")


def mode_label(ticks, d):
    freq = Counter(ticks)
    highest = max(freq.values())
    lowest = min(freq.values())
    modes = sorted(tick for tick, count in freq.items() if count == highest)
    if lowest == highest:
        return "no mode"
    if len(modes) == 1:
        return inch_label(modes[0], d)
    if len(modes) == 2:
        return f"{inch_label(modes[0], d)} and {inch_label(modes[1], d)}"
    raise ValueError("More than two modes")


def solve_center(public):
    prompt = public["prompt"]
    if prompt.endswith("What is the mode?"):
        ask = "mode"
    elif prompt.endswith("What is the median length?"):
        ask = "median"
    elif prompt.endswith("What is the range?"):
        ask = "range"
    else:
        raise ValueError(f"Unrecognized question: {prompt}")
    d, ticks = ticks_of(plot_element(public["figure"]["scene"]))
    require(len(ticks) % 2 == 1, "Median is defined here only for an odd count")
    if ask == "mode":
        label = mode_label(ticks, d)
    elif ask == "median":
        label = inch_label(sorted(ticks)[len(ticks) // 2], d)
    else:
        label = inch_label(max(ticks) - min(ticks), d)
    options = public["response"]["options"]
    return only([o["id"] for o in options if o["label"] == label], "choice has the label")


def table_parts(label):
    parts = TABLE_CELL.findall(label)
    require(len(parts) == 4, f"Need four intervals: {label}")
    return [(int(a), int(b), int(c)) for a, b, c in parts]


def solve_frequency(public):
    prompt = public["prompt"]
    options = public["response"]["options"]
    require(public["response"]["kind"] == "choice", "Choice required")
    if "The numbers are:" in prompt:
        match = NUMBER_LIST.search(prompt)
        require(match is not None, "Missing number list")
        numbers = [int(part) for part in match[1].split(", ") if part.strip()]
        require(numbers, "Empty number list")
        hits = []
        for option in options:
            if all(
                sum(1 for n in numbers if lo <= n <= hi) == stated
                for lo, hi, stated in table_parts(option["label"])
            ):
                hits.append(option["id"])
        return only(hits, "table matches the list")
    if "How many more" in prompt:
        rows = TABLE_ROW.findall(prompt)
        require(len(rows) == 4, "Need four printed intervals")
        counts = [int(c) for _a, _b, c in rows]
        diff = counts[0] + counts[1] - counts[3]
        require(diff > 0, "Difference must be positive")
        hits = []
        for option in options:
            leading = re.match(r"(\d+)", option["label"])
            require(leading is not None, f"Choice has no count: {option['label']}")
            if int(leading[1]) == diff:
                hits.append(option["id"])
        return only(hits, "choice has the difference")
    raise ValueError("Unrecognized frequency question")


def solve_bar(public):
    prompt = public["prompt"]
    more = BAR_MORE.search(prompt)
    step_match = BAR_STEP.search(prompt)
    require(more is not None and step_match is not None, "Unrecognized bar question")
    _unit, a, b, c = more.groups()
    figure = public["figure"]
    require(figure["kind"] == "scaled-bar-graph", "Scaled bar graph required")
    values = {cat["label"]: cat["value"] for cat in figure["categories"]}
    require(a in values and b in values and c in values, "A named category is missing")
    return str(values[a] + values[b] - values[c])


def solve(public):
    template = public["templateId"]
    if template == "line-plot-build-slots":
        return solve_build(public)
    if template == "line-plot-data-match":
        return solve_match(public)
    if template == "line-plot-center-range":
        return solve_center(public)
    if template == "frequency-table-grade4":
        return solve_frequency(public)
    if template == "scaled-bar-grade4":
        return solve_bar(public)
    raise ValueError(f"Unsupported template {template}")


def review_problem(problem):
    public = problem["public"]
    template = public["templateId"]
    solved = solve(public)
    require(solved == problem["answer"], f"Answer {problem['answer']!r} != {solved!r}")
    feedback = problem.get("choiceFeedback") or {}
    if template in ("line-plot-build-slots", "scaled-bar-grade4"):
        require(feedback == {}, "This template has no choice feedback")
    else:
        for text in feedback.values():
            require(solved not in text, "Feedback contains the answer")
    if template == "scaled-bar-grade4":
        figure = public["figure"]
        step = int(BAR_STEP.search(public["prompt"])[1])
        require(figure["step"] == step, "Figure step does not match the prompt")
        grain = step // 2 if step % 2 == 0 else step
        values = [cat["value"] for cat in figure["categories"]]
        require(len(values) == len(set(values)) and all(v > 0 and v % grain == 0 for v in values),
                "Bar values must be distinct positive multiples of the grid")
        require(int(solved) > 0, "Difference must be positive")
        require(figure["max"] % step == 0 and figure["max"] // step <= 10, "Scale is too tall")
    return None


def _options(labels):
    return [{"id": letter, "label": label} for letter, label in zip("abcde", labels)]


def _choice(labels):
    return [{"id": f"option-{letter}", "label": label} for letter, label in zip("abcd", labels)]


def _scene(element):
    return {"kind": "scene", "scene": {"elements": [element]}}


def self_test():
    bank = _options(["0", "1", "2", "3", "4"])
    build = {
        "templateId": "line-plot-build-slots",
        "prompt": (
            "A class measured 3 lengths to the nearest eighth inch. "
            "The number line has no marks yet. "
            "The lengths, in inches, are: 1/8, 1/8, 3/8. "
            "How many lengths belong at each mark?"
        ),
        "response": {
            "kind": "multi-part-choice",
            "blanks": [
                {"id": "t0", "label": "0", "options": bank},
                {"id": "t1", "label": "1/8", "options": bank},
                {"id": "t2", "label": "2/8", "options": bank},
                {"id": "t3", "label": "3/8", "options": bank},
            ],
        },
        "figure": _scene({
            "type": "dotPlot",
            "blank": True,
            "denominator": 8,
            "groups": [{"values": []}],
        }),
    }
    require(
        solve(build) == '{"t0":"a","t1":"c","t2":"a","t3":"b"}',
        "Build counts",
    )

    def graph(option_id, values):
        return {
            "id": option_id,
            "label": option_id,
            "scene": {
                "elements": [{
                    "type": "dotPlot",
                    "denominator": 2,
                    "groups": [{"values": values}],
                }],
            },
        }

    match = {
        "templateId": "line-plot-data-match",
        "prompt": "The lengths, in inches, are: 0, 1/2, 1/2. Which graph shows this list?",
        "response": {
            "kind": "figure-choice",
            "options": [
                graph("option-a", [0, 0, 0.5]),
                graph("option-b", [0, 0.5, 0.5]),
                graph("option-c", [0.5, 0.5, 0.5]),
                graph("option-d", [0, 0.5]),
            ],
        },
    }
    require(solve(match) == "option-b", "Match is option-b")

    center = {
        "templateId": "line-plot-center-range",
        "prompt": "The line plot shows lengths measured to the nearest quarter inch. What is the mode?",
        "response": {
            "kind": "choice",
            "options": _choice(["no mode", "1/2 inch", "1/4 inch", "3/4 inch"]),
        },
        "figure": _scene({
            "type": "dotPlot",
            "denominator": 4,
            "groups": [{"values": [0.25, 0.25, 0.25, 0.5, 0.75]}],
        }),
    }
    require(solve(center) == "option-c", "Mode is 1/4 inch")

    numbers = "0, 1, 4, 5, 9, 10, 14, 15, 19"
    correct_table = f"0{DASH}4: 3 scores; 5{DASH}9: 2 scores; 10{DASH}14: 2 scores; 15{DASH}19: 2 scores"
    wrong_table = f"0{DASH}4: 2 scores; 5{DASH}9: 3 scores; 10{DASH}14: 2 scores; 15{DASH}19: 2 scores"
    built_table = {
        "templateId": "frequency-table-grade4",
        "prompt": f"Sort the numbers into intervals. The numbers are: {numbers}. Which table matches the list?",
        "response": {
            "kind": "choice",
            "options": _choice([wrong_table, correct_table, wrong_table.replace("2 scores", "4 scores", 1), wrong_table]),
        },
    }
    # The third label must differ so the options are readable; the solver only needs one match.
    built_table["response"]["options"][2]["label"] = (
        f"0{DASH}5: 3 scores; 6{DASH}9: 2 scores; 10{DASH}14: 2 scores; 15{DASH}19: 2 scores"
    )
    built_table["response"]["options"][3]["label"] = (
        f"0{DASH}4: 4 scores; 5{DASH}9: 2 scores; 10{DASH}14: 2 scores; 15{DASH}19: 1 score"
    )
    require(solve(built_table) == "option-b", "Bins of width 5")

    interpret = {
        "templateId": "frequency-table-grade4",
        "prompt": (
            f"A frequency table shows scores. "
            f"0{DASH}4 has 8 scores. 5{DASH}9 has 6 scores. "
            f"10{DASH}14 has 5 scores. 15{DASH}19 has 4 scores. "
            "How many more scores are in the first two intervals together than in the last interval?"
        ),
        "response": {
            "kind": "choice",
            "options": _choice(["14 scores", "18 scores", "11 scores", "10 scores"]),
        },
    }
    interpret["response"]["options"].append({"id": "option-extra", "label": "100 scores"})
    require(solve(interpret) == "option-d", "8 + 6 - 4 = 10")

    bar = {
        "templateId": "scaled-bar-grade4",
        "prompt": (
            "The bar graph shows books. How many more books are in Oak and Pine together "
            "than in Maple? Each line on the side counts as 25 on this graph."
        ),
        "figure": {
            "kind": "scaled-bar-graph",
            "categories": [
                {"label": "Oak", "value": 100},
                {"label": "Pine", "value": 75},
                {"label": "Maple", "value": 25},
                {"label": "Birch", "value": 50},
            ],
            "step": 25,
            "max": 100,
            "unit": "books",
        },
    }
    require(solve(bar) == "150", "100 + 75 - 25 = 150")
    review_problem({"public": bar, "answer": "150"})
    review_problem({"public": build, "answer": solve(build)})

    try:
        solve({**build, "prompt": "How many lengths belong at each mark?"})
        raise AssertionError("A missing list must fail")
    except ValueError:
        pass
    try:
        solve({
            **bar,
            "figure": {
                **bar["figure"],
                "categories": [c for c in bar["figure"]["categories"] if c["label"] != "Maple"],
            },
        })
        raise AssertionError("A missing category must fail")
    except ValueError:
        pass
    twin = {
        **match,
        "response": {
            "kind": "figure-choice",
            "options": [
                graph("option-a", [0, 0.5, 0.5]),
                graph("option-b", [0, 0.5, 0.5]),
            ],
        },
    }
    try:
        solve(twin)
        raise AssertionError("Two matching graphs must fail")
    except ValueError:
        pass


if __name__ == "__main__":
    self_test()
