"""Independent review of the addend-strategies family (turnaround facts,
making ten with three addends, and equal addends on arrays) from public
payloads only.

Every key is recomputed from the numbers in the prompt, the counters and
arrays drawn in the figure, and the displayed options; the private answer,
hint and explanation are only values under test.
"""

import copy
import json
import re

SUPPORTED = frozenset({
    "turn-around-fact", "turn-around-sum", "make-ten-grouping", "make-ten-step",
    "array-add-rows-total", "equal-addends-match", "equal-addends-array", "equal-addends-select",
})
REVIEW_RETURNS_ANSWER = True
PLACEHOLDER = re.compile(r"\$\{|\bundefined\b|\bNaN\b|\bnull\b|\[object")
BOX = "\\square"


def require(condition, message):
    if not condition:
        raise ValueError(message)


# ---------------------------------------------------------------- reading

def math_of(label):
    """The TeX inside a label that is exactly one $…$ span."""
    require(label.startswith("$") and label.endswith("$") and label.count("$") == 2, f"One math span: {label!r}")
    return label[1:-1].strip()


def terms(side):
    """A side such as '4 + 4 - 3' as signed integers; the box is None."""
    tokens = side.replace(BOX, " B ").split()
    require(tokens and len(tokens) % 2 == 1, f"Side {side!r}")
    out, sign = [], 1
    for i, token in enumerate(tokens):
        if i % 2:
            require(token in "+-", f"Operator {token!r}")
            sign = 1 if token == "+" else -1
        elif token == "B":
            require(sign == 1, "A box is added")
            out.append(None)
        else:
            require(re.fullmatch(r"\d+", token) is not None, f"Number {token!r}")
            out.append(sign * int(token))
    return out


def sides(label):
    text = math_of(label)
    require(text.count("=") == 1, f"One equal sign in {label!r}")
    left, right = (part.strip() for part in text.split("="))
    return left, right


def value(side):
    parts = terms(side)
    require(None not in parts, "No box")
    return sum(parts)


def is_true(label):
    left, right = sides(label)
    return value(left) == value(right)


def plain_sum(side):
    """Addends of a side with only plus signs."""
    require("-" not in side, f"Only addition in {side!r}")
    parts = terms(side)
    require(None not in parts and all(p > 0 for p in parts), f"Positive addends in {side!r}")
    return parts


def elements(public):
    figure = public.get("figure")
    require(figure is not None and figure["kind"] == "scene", "A scene figure")
    return figure["scene"]["elements"]


def array_of(scene_elements):
    arrays = [e for e in scene_elements if e["type"] == "array"]
    require(len(arrays) == 1, "One array")
    a = arrays[0]
    require(a.get("shape") == "dot", "A dot array")
    require(1 <= a["rows"] <= 5 and 1 <= a["columns"] <= 5, "At most 5 rows and 5 columns")
    return a["rows"], a["columns"]


def counter_groups(scene_elements, prefix):
    """Counts of circles and squares whose ids start with prefix, by group."""
    groups = {}
    for e in scene_elements:
        match = re.fullmatch(re.escape(prefix) + r"(\d)c\d+", e.get("id", ""))
        if match:
            groups.setdefault(int(match.group(1)), []).append(e["type"])
    return [groups[k] for k in sorted(groups)]


def options(public, kind):
    response = public["response"]
    require(response["kind"] == kind, f"Response kind {kind}")
    labels = [o["label"] for o in response["options"]]
    require(len(set(labels)) == len(labels), "Distinct options")
    return response["options"]


def only(items, message):
    items = list(items)
    require(len(items) == 1, message)
    return items[0]


# ---------------------------------------------------------------- solvers

def solve_turnaround(public):
    opts = options(public, "choice")
    known = re.fullmatch(r"([A-Z][a-z]+) knows \$(\d+) \+ (\d+) = (\d+)\$\. Which fact does \1 know now, without counting\?", public["prompt"])
    if known:
        a, b, c = (int(known.group(i)) for i in (2, 3, 4))
        require(a != b and a + b == c and 1 <= a <= 9 and 1 <= b <= 9, "A known fact with different addends")
        groups = counter_groups(elements(public), "rowg")
        require(groups == [["circle"] * a, ["rect"] * b], "Counters match the known fact")
        require(len(opts) == 3, "Three options")
        truths = [o for o in opts if is_true(o["label"])]
        chosen = only(truths, "Exactly one true sentence")
        left, right = sides(chosen["label"])
        sums = [s for s in (left, right) if "+" in s]
        whole = right if sums == [left] else left
        require(len(sums) == 1 and plain_sum(sums[0]) == [b, a] and value(whole) == c, "The true sentence is the turnaround")
        return chosen["id"]
    pair = re.fullmatch(r"Which number sentence about (\d+) and (\d+) is true\?", public["prompt"])
    require(pair is not None, f"Prompt {public['prompt']!r}")
    a, b = int(pair.group(1)), int(pair.group(2))
    require(a > b >= 1, "Larger number first")
    require(len(opts) == 3, "Three options")
    chosen = only((o for o in opts if is_true(o["label"])), "Exactly one true sentence")
    left, right = sides(chosen["label"])
    require(plain_sum(left) == [a, b] and plain_sum(right) == [b, a], "The true sentence turns an addition around")
    return chosen["id"]


def solve_turned_sum(public):
    match = re.fullmatch(r"([A-Z][a-z]+) knows \$(\d+) \+ (\d+) = (\d+)\$\. What is \$(\d+) \+ (\d+)\$\?", public["prompt"])
    require(match is not None, f"Prompt {public['prompt']!r}")
    a, b, c, x, y = (int(match.group(i)) for i in range(2, 7))
    require(a + b == c and a != b, "The known fact is true")
    require((x, y) == (b, a), "The question turns the fact around")
    scene_elements = elements(public)
    require(counter_groups(scene_elements, "topg") == [["circle"] * a, ["rect"] * b], "Top row matches the fact")
    require(counter_groups(scene_elements, "bottomg") == [["rect"] * b, ["circle"] * a], "Bottom row is the same counters swapped")
    braces = {e["id"]: e["label"] for e in scene_elements if e["type"] == "brace"}
    require(braces == {"topbrace": str(c), "bottombrace": "?"}, "Only the known whole is labeled")
    return str(x + y)


def pairs_of(addends):
    return [(0, 1), (0, 2), (1, 2)]


def three_groups(public, addends):
    scene_elements = elements(public)
    groups = counter_groups(scene_elements, "g")
    require([len(g) for g in groups] == list(addends), "Counter groups match the addends")
    labels = [e["text"] for e in scene_elements if e["type"] == "text"]
    require(labels == [str(n) for n in addends], "Group labels match the addends")
    slots = [e for e in scene_elements if e["type"] == "rect" and e.get("id", "").startswith("slot")]
    require(len(slots) == 10, "An empty ten frame")


def solve_make_ten(public):
    opts = options(public, "choice")
    add = re.fullmatch(r"Add \$(\d) \+ (\d) \+ (\d)\$\. Which two numbers make ten\?", public["prompt"])
    if add:
        addends = [int(add.group(i)) for i in (1, 2, 3)]
        require(len(set(addends)) == 3, "Three different addends")
        three_groups(public, addends)
        expected = {f"${addends[i]} + {addends[j]}$" for i, j in pairs_of(addends)}
        require({o["label"] for o in opts} == expected, "The options are the three pairs")
        return only((o["id"] for o in opts if value(math_of(o["label"])) == 10), "Exactly one pair makes ten")
    require(public["prompt"] == "Which sum has two numbers that make ten?", f"Prompt {public['prompt']!r}")
    require(len(opts) == 4, "Four sums")
    multisets = set()
    keyed = []
    for o in opts:
        addends = plain_sum(math_of(o["label"]))
        require(len(addends) == 3 and all(1 <= n <= 9 for n in addends) and sum(addends) <= 20, "Three addends 1-9, total at most 20")
        multisets.add(tuple(sorted(addends)))
        if any(addends[i] + addends[j] == 10 for i, j in pairs_of(addends)):
            keyed.append(o["id"])
    require(len(multisets) == 4, "Four different sums")
    return only(keyed, "Exactly one sum has a pair making ten")


def solve_make_ten_step(public):
    match = re.fullmatch(r"What goes in the box\? (\$.+\$)", public["prompt"])
    require(match is not None, f"Prompt {public['prompt']!r}")
    left, right = sides(match.group(1))
    addends = plain_sum(left)
    require(len(addends) == 3, "Three addends")
    three_groups(public, addends)
    pieces = terms(right)
    require(len(pieces) == 2 and pieces.count(None) == 1, "One box and one number")
    known = next(p for p in pieces if p is not None)
    box = sum(addends) - known
    rest = [n for n in addends]
    if known == 10:
        # The box is what is left after a pair that makes ten.
        require(any(addends[i] + addends[j] == 10 and addends[3 - i - j] == box for i, j in pairs_of(addends)), "10 is a pair of the addends")
    else:
        require(box == 10 and known in rest, "The written number is an addend and the box is the ten")
    return str(box)


def solve_add_rows(public):
    rows, columns = array_of(elements(public))
    prompt = public["prompt"]
    total = rows * columns
    if prompt.startswith("The card hides some dots."):
        match = re.fullmatch(r"The card hides some dots\. Every row has (\d)\. How many dots in all\?", prompt)
        require(match is not None and int(match.group(1)) == columns, "Row length stated")
        texts = {e["id"]: e["text"] for e in elements(public) if e["type"] == "text"}
        require(texts == {"rowsLabel": f"{rows} rows", "eachLabel": f"{columns} in each row"}, "Card labels")
        card = only((e for e in elements(public) if e["type"] == "rect"), "One card")
        require(card["at"][0] < 1 and card["at"][0] + card["size"][0] >= columns and card["size"][1] >= rows - 1 - 1e-9,
                "The card hides every dot except the first row and column")
        require(rows >= 3, "At least 3 rows under a card")
    elif "Finish the addition" in prompt:
        match = re.fullmatch(r"Each (row|column) has (\d) dots?\. Finish the addition to find how many dots in all: \$([0-9 +]+) = \?\$", prompt)
        require(match is not None, f"Prompt {prompt!r}")
        addends = plain_sum(match.group(3))
        require(len(set(addends)) == 1 and addends[0] == int(match.group(2)), "Equal addends that match the stated row or column")
        if match.group(1) == "row":
            require(addends[0] == columns and len(addends) == rows, "One addend per row")
        else:
            require(addends[0] == rows and len(addends) == columns, "One addend per column")
        require(sum(addends) == total, "The sum counts the array")
    else:
        require(prompt == "Every row has the same number of dots. Add the rows. How many dots in all?", f"Prompt {prompt!r}")
    return str(total)


def equal_addends(label):
    """(addend, count, total) of a true sum of equal addends, else None."""
    left, right = sides(label)
    if "-" in left or "-" in right:
        return None
    addends = terms(left)
    if None in addends or len(set(addends)) != 1 or len(addends) < 2:
        return None
    total = value(right)
    if sum(addends) != total:
        return None
    return addends[0], len(addends), total


def matches_array(label, rows, columns):
    shape = equal_addends(label)
    return shape is not None and shape in {(columns, rows, rows * columns), (rows, columns, rows * columns)}


def solve_match(public):
    require(public["prompt"] == "Which equation shows how many dots are in the array?", "Prompt")
    rows, columns = array_of(elements(public))
    require(rows >= 2 and columns >= 2 and rows * columns >= 6, "Not a 2 by 2 array")
    opts = options(public, "choice")
    require(len(opts) == 4, "Four equations")
    return only((o["id"] for o in opts if matches_array(o["label"], rows, columns)), "Exactly one equation counts the array")


def array_label(option):
    match = re.fullmatch(r"An array of (\d) rows? with (\d) dots? in each row\.", option["label"])
    require(match is not None, f"Description {option['label']!r}")
    rows, columns = array_of(option["scene"]["elements"])
    require((int(match.group(1)), int(match.group(2))) == (rows, columns), "Description matches the drawn array")
    return rows, columns


def solve_array(public):
    match = re.fullmatch(r"Which array matches the equation (\$.+\$)\?", public["prompt"])
    require(match is not None, f"Prompt {public['prompt']!r}")
    shape = equal_addends(match.group(1))
    require(shape is not None, "A true sum of equal addends")
    addend, count, total = shape
    opts = options(public, "figure-choice")
    require(public["response"]["noun"] == "Picture" and len(opts) == 4, "Four pictures")
    drawn = [array_label(o) for o in opts]
    require(len(set(drawn)) == 4, "Four different arrays")
    fits = [o["id"] for o, (r, c) in zip(opts, drawn) if (r, c) in {(count, addend), (addend, count)}]
    return only(fits, "Exactly one array matches the equation")


def solve_select(public):
    require(public["prompt"] == "Select the 2 equations that show how many dots are in the array.", "Prompt")
    rows, columns = array_of(elements(public))
    require(rows != columns, "Rows and columns differ")
    response = public["response"]
    opts = options(public, "multi-select")
    keyed = sorted(o["id"] for o in opts if matches_array(o["label"], rows, columns))
    require(len(keyed) == 2 and response["selectionCount"] == 2, "Both orientations, and only they, are keyed")
    return json.dumps(keyed, separators=(",", ":"))


SOLVERS = {
    "turn-around-fact": solve_turnaround,
    "turn-around-sum": solve_turned_sum,
    "make-ten-grouping": solve_make_ten,
    "make-ten-step": solve_make_ten_step,
    "array-add-rows-total": solve_add_rows,
    "equal-addends-match": solve_match,
    "equal-addends-array": solve_array,
    "equal-addends-select": solve_select,
}


def solve(public):
    template = public["templateId"]
    require(template in SUPPORTED, "Wrong family")
    return SOLVERS[template](public)


def review_problem(problem):
    public = problem["public"]
    expected = solve(public)
    require(problem["answer"] == expected, f"Answer {problem['answer']} disagrees; expected {expected}")
    kind = public["response"]["kind"]
    if kind in ("choice", "figure-choice"):
        wrong = {o["id"] for o in public["response"]["options"]} - {expected}
        require(set(problem.get("choiceFeedback", {})) == wrong, "Feedback for every wrong option and only those")
    if kind == "number":
        require(expected in " ".join(problem["explanation"]), "The explanation reaches the answer")
    for text in [public["prompt"], problem["hint"], *problem["explanation"], *problem.get("choiceFeedback", {}).values()]:
        require(not PLACEHOLDER.search(text), f"Unrendered placeholder in {text!r}")
    return expected


# ---------------------------------------------------------------- self test

def counters(prefix, groups):
    out = []
    for gi, (n, kind) in enumerate(groups):
        out += [{"type": kind, "id": f"{prefix}g{gi}c{i}"} for i in range(n)]
    return out


def scene(*elements_):
    return {"kind": "scene", "scene": {"v": 1, "elements": list(elements_)}}


def self_test():
    sum_case = {
        "public": {"templateId": "turn-around-sum", "seed": "f", "prompt": "Max knows $6 + 7 = 13$. What is $7 + 6$?",
                   "response": {"kind": "number", "label": "Sum"},
                   "figure": scene(*counters("top", [(6, "circle"), (7, "rect")]), {"type": "brace", "id": "topbrace", "label": "13"},
                                   *counters("bottom", [(7, "rect"), (6, "circle")]), {"type": "brace", "id": "bottombrace", "label": "?"})},
        "answer": "13", "hint": "Same counters.", "explanation": ["6 and 7 make 13.", "$7 + 6 = 13$."]}
    groups = [*counters("", [(7, "circle"), (5, "rect"), (3, "circle")])]
    for g in groups:
        g["id"] = "g" + g["id"][1:]
    step_case = {
        "public": {"templateId": "make-ten-step", "seed": "f", "prompt": "What goes in the box? $7 + 5 + 3 = 10 + \\square$",
                   "response": {"kind": "number", "label": "Number in the box"},
                   "figure": scene(*groups, *({"type": "text", "id": f"g{i}n", "text": t} for i, t in enumerate(["7", "5", "3"])),
                                   *({"type": "rect", "id": f"slot{i}"} for i in range(10)))},
        "answer": "5", "hint": "Which two make ten?", "explanation": ["7 and 3 make ten.", "5 is left."]}
    select_case = {
        "public": {"templateId": "equal-addends-select", "seed": "f",
                   "prompt": "Select the 2 equations that show how many dots are in the array.",
                   "response": {"kind": "multi-select", "label": "Choose 2 equations", "selectionCount": 2,
                                "options": [{"id": "option-a", "label": "$3 + 4 = 7$"}, {"id": "option-b", "label": "$4 + 4 + 4 = 12$"},
                                            {"id": "option-c", "label": "$4 + 4 + 4 + 4 = 16$"}, {"id": "option-d", "label": "$3 + 3 + 3 + 3 = 12$"}]},
                   "figure": scene({"type": "array", "id": "arr", "rows": 3, "columns": 4, "shape": "dot"})},
        "answer": '["option-b","option-d"]', "hint": "Rows or columns.", "explanation": ["Rows.", "Columns."]}
    fact_case = {
        "public": {"templateId": "turn-around-fact", "seed": "f", "prompt": "Which number sentence about 9 and 4 is true?",
                   "response": {"kind": "choice", "label": "Choose the true sentence",
                                "options": [{"id": "option-a", "label": "$9 - 4 = 4 - 9$"}, {"id": "option-b", "label": "$9 + 4 = 4 + 9$"},
                                            {"id": "option-c", "label": "$9 + 4 = 9 - 4$"}]}},
        "answer": "option-b", "hint": "Try 9 and 4.", "explanation": ["Adding turns around."],
        "choiceFeedback": {"option-a": "Taking away does not turn around.", "option-c": "Signs differ."}}
    for case in (sum_case, step_case, select_case, fact_case):
        require(review_problem(case) == case["answer"], f"Fixture {case['public']['templateId']}")
    mutations = 0
    for base, change, what in (
            (sum_case, lambda p: p.update(answer="12"), "wrong sum"),
            (sum_case, lambda p: p["public"]["figure"]["scene"]["elements"][0].update(type="rect"), "counters disagree with the fact"),
            (sum_case, lambda p: p["public"].update(prompt="Max knows $6 + 7 = 14$. What is $7 + 6$?"), "false known fact"),
            (step_case, lambda p: p.update(answer="15"), "total written in the box"),
            (step_case, lambda p: p["public"].update(prompt="What goes in the box? $7 + 5 + 3 = 9 + \\square$"), "no ten on the right"),
            (select_case, lambda p: p.update(answer='["option-b","option-c"]'), "wrong selection"),
            (select_case, lambda p: p["public"]["figure"]["scene"]["elements"][0].update(rows=4), "array disagrees with the equations"),
            (fact_case, lambda p: p.update(answer="option-a"), "subtraction turned around"),
            (fact_case, lambda p: p.update(choiceFeedback={"option-a": "x"}), "missing feedback")):
        bad = copy.deepcopy(base)
        change(bad)
        try:
            review_problem(bad)
        except (ValueError, KeyError, TypeError, IndexError, StopIteration):
            mutations += 1
        else:
            raise AssertionError(f"Accepted corrupt addend-strategies case: {what}")
    return {"fixtures": 4, "mutations": mutations}


if __name__ == "__main__":
    print(self_test())
