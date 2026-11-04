"""Independent checks for grade-4 place-value items.

Answers are recomputed from the prompt and, for the number line, from the
tick spacing and mark positions. The generator's answer is only compared.
"""
import json
import re

SUPPORTED = frozenset({
    "place-shift-value",
    "number-name-numeral",
    "large-number-line-point",
})
REVIEW_RETURNS_ANSWER = True
CHOICE_REVIEW = frozenset({"number-name-numeral", "large-number-line-point"})

PLACES = [
    "ones", "tens", "hundreds", "thousands",
    "ten thousands", "hundred thousands", "millions",
]
SMALL = [
    "zero", "one", "two", "three", "four", "five", "six", "seven", "eight",
    "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen",
    "sixteen", "seventeen", "eighteen", "nineteen",
]
TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]
SHIFT = re.compile(
    r"In ([\d,]+), the digit (\d) is worth ([\d,]+)\. It shifts one place to the (left|right), "
    r"so it is worth (10 times as much|one tenth as much)\. Choose its new place and its new value\."
)
PRODUCT = re.compile(
    r"([\d,]+) × (10|100) shifts every digit to the left\. "
    r"Choose the product and how many places the digits move\."
)
WORDS = re.compile(r"Which numeral matches this number name: (.+)\?")
NUMERAL = re.compile(r"Which number name matches ([\d,]+)\?")
READ = re.compile(r"Which number is at point \$P\$ on the number line\?")
LOCATE = re.compile(r"Which point is at ([\d,]+) on the number line\?")


def require(condition, message):
    if not condition:
        raise ValueError(message)


def whole(text):
    require(re.fullmatch(r"\d{1,3}(?:,\d{3})*|\d{1,3}", text) is not None, f"Number {text!r}")
    return int(text.replace(",", ""))


def below100(n):
    if n < 20:
        return SMALL[n]
    unit = n % 10
    return TENS[n // 10] + (f"-{SMALL[unit]}" if unit else "")


def below1000(n):
    hundreds, rest = divmod(n, 100)
    parts = []
    if hundreds:
        parts.append(f"{SMALL[hundreds]} hundred")
    if rest:
        parts.append(below100(rest))
    return " ".join(parts)


def number_name(n):
    if n == 1_000_000:
        return "one million"
    require(1 <= n <= 999_999, "Name out of range")
    thousands, rest = divmod(n, 1000)
    parts = []
    if thousands:
        parts.append(f"{below1000(thousands)} thousand")
    if rest:
        parts.append(below1000(rest))
    return ", ".join(parts)


def parse_below100(text):
    if text == "":
        return 0
    if text in SMALL:
        return SMALL.index(text)
    ten, _, unit = text.partition("-")
    require(ten in TENS and TENS.index(ten) >= 2, f"Tens {text!r}")
    return TENS.index(ten) * 10 + (SMALL.index(unit) if unit else 0)


def parse_below1000(text):
    if text == "":
        return 0
    match = re.fullmatch(r"(\w+) hundred(?: (.*))?", text)
    if match:
        require(match[1] in SMALL, f"Hundreds {text!r}")
        return SMALL.index(match[1]) * 100 + parse_below100(match[2] or "")
    return parse_below100(text)


def parse_name(name):
    if name == "one million":
        return 1_000_000
    if "thousand" in name:
        head, _, tail = name.partition(", ")
        require(head.endswith(" thousand"), f"Name {name!r}")
        return parse_below1000(head[: -len(" thousand")]) * 1000 + (parse_below1000(tail) if tail else 0)
    return parse_below1000(name)


def grouped(n):
    return f"{n:,}"


def option_id(blank, label):
    hits = [option["id"] for option in blank["options"] if option["label"] == label]
    require(len(hits) == 1, f"Option {label!r} in {blank['id']}")
    return hits[0]


def solve_shift(public):
    prompt = public["prompt"]
    blanks = public["response"]["blanks"]
    shift = SHIFT.fullmatch(prompt)
    if shift:
        digit, old, side, phrase = int(shift[2]), whole(shift[3]), shift[4], shift[5]
        require(whole(shift[1]) <= 1_000_000, "Number above 1,000,000")
        require(old % digit == 0 and digit > 0, "Digit value")
        power = old // digit
        require(power in [10 ** p for p in range(7)], "Place value")
        place = len(str(power)) - 1
        nxt = place + (1 if side == "left" else -1)
        require(0 <= nxt <= 6, "Shift stays a whole-number place")
        require(
            (side == "left" and phrase == "10 times as much")
            or (side == "right" and phrase == "one tenth as much"),
            "Shift wording",
        )
        value = digit * 10 ** nxt
        require(value <= 1_000_000, "New value above 1,000,000")
        require([b["id"] for b in blanks] == ["place", "value"], "Shift blanks")
        return json.dumps({
            "place": option_id(blanks[0], PLACES[nxt]),
            "value": option_id(blanks[1], grouped(value) if value >= 1000 else str(value)),
        }, separators=(",", ":"))
    product = PRODUCT.fullmatch(prompt)
    require(product is not None, f"Prompt {prompt!r}")
    n, factor = whole(product[1]), int(product[2])
    require(factor in (10, 100) and n * factor <= 1_000_000, "Product range")
    moved = "one place" if factor == 10 else "two places"
    require([b["id"] for b in blanks] == ["product", "places"], "Product blanks")
    label = grouped(n * factor) if n * factor >= 1000 else str(n * factor)
    return json.dumps({
        "product": option_id(blanks[0], label),
        "places": option_id(blanks[1], moved),
    }, separators=(",", ":"))


def solve_name(public):
    prompt = public["prompt"]
    options = public["response"]["options"]
    words = WORDS.fullmatch(prompt)
    if words:
        value = parse_name(words[1])
        label = grouped(value) if value >= 1000 else str(value)
    else:
        numeral = NUMERAL.fullmatch(prompt)
        require(numeral is not None, f"Prompt {prompt!r}")
        value = whole(numeral[1])
        label = number_name(value)
    require(1 <= value <= 1_000_000, "Out of range")
    hits = [option["id"] for option in options if option["label"] == label]
    require(len(hits) == 1, f"Name key {label!r}")
    return hits[0]


def line_of(public):
    figure = public["figure"]
    require(figure["kind"] == "scene", "Scene")
    lines = [el for el in figure["scene"]["elements"] if el["type"] == "numberLine"]
    require(len(lines) == 1, "One number line")
    line = lines[0]
    require(line["step"] in (1000, 10000, 100000), "Tick spacing")
    return line


def solve_line(public):
    prompt = public["prompt"]
    options = public["response"]["options"]
    line = line_of(public)
    if READ.fullmatch(prompt):
        marks = line["marks"]
        require(len(marks) == 1 and marks[0]["label"] == "P", "Point P")
        value = marks[0]["at"]
        require(value not in line["labels"], "The answer tick is labeled")
        label = grouped(value) if value >= 1000 else str(value)
        hits = [option["id"] for option in options if option["label"] == label]
        require(len(hits) == 1, "Read key")
        return hits[0]
    locate = LOCATE.fullmatch(prompt)
    require(locate is not None, f"Prompt {prompt!r}")
    wanted = whole(locate[1])
    require(wanted not in line["labels"], "The answer tick is labeled")
    marks = [mark for mark in line["marks"] if mark["at"] == wanted]
    require(len(marks) == 1, "One mark at the number")
    hits = [option["id"] for option in options if option["label"].replace("$", "") == marks[0]["label"]]
    require(len(hits) == 1, "Locate key")
    return hits[0]


def solve(public):
    name = public["templateId"]
    require(name in SUPPORTED, name)
    if name == "place-shift-value":
        return solve_shift(public)
    if name == "number-name-numeral":
        return solve_name(public)
    return solve_line(public)


def review_problem(problem):
    expected = solve(problem["public"])
    require(problem["answer"] == expected, f"Answer {problem['answer']} != {expected}")
    return expected


def _blank(blank_id, label, options):
    return {"id": blank_id, "label": label, "options": [{"id": "abcd"[i], "label": text} for i, text in enumerate(options)]}


def _choice(template, prompt, labels, key, figure=None):
    public = {
        "templateId": template,
        "prompt": prompt,
        "response": {"kind": "choice", "options": [{"id": f"option-{letter}", "label": text} for letter, text in zip("abcd", labels)]},
    }
    if figure:
        public["figure"] = figure
    return {"public": public, "answer": f"option-{key}"}


def _multipart(template, prompt, blanks, key):
    return {
        "public": {
            "templateId": template,
            "prompt": prompt,
            "response": {"kind": "multi-part-choice", "blanks": blanks},
        },
        "answer": json.dumps(key, separators=(",", ":")),
    }


def _line(step, labels, marks):
    return {
        "kind": "scene",
        "scene": {
            "elements": [{
                "type": "numberLine",
                "min": labels[0],
                "max": labels[-1],
                "step": step,
                "labels": labels,
                "marks": marks,
            }],
        },
    }


def self_test():
    require(number_name(4020) == "four thousand, twenty", number_name(4020))
    require(parse_name("four thousand, twenty") == 4020, "parse")
    require(parse_name("one million") == 1_000_000, "million")
    good = [
        _multipart(
            "place-shift-value",
            "In 36,450, the digit 6 is worth 6,000. It shifts one place to the left, so it is worth 10 times as much. Choose its new place and its new value.",
            [_blank("place", "place", ["thousands", "ten thousands", "hundreds"]),
             _blank("value", "value", ["6,000", "60,000", "600"])],
            {"place": "b", "value": "b"},
        ),
        _multipart(
            "place-shift-value",
            "In 36,450, the digit 4 is worth 400. It shifts one place to the right, so it is worth one tenth as much. Choose its new place and its new value.",
            [_blank("place", "place", ["hundreds", "tens", "ones"]),
             _blank("value", "value", ["400", "40", "4,000"])],
            {"place": "b", "value": "b"},
        ),
        _multipart(
            "place-shift-value",
            "4,820 × 100 shifts every digit to the left. Choose the product and how many places the digits move.",
            [_blank("product", "product", ["48,200", "482,000", "4,920"]),
             _blank("places", "places", ["one place", "two places", "three places"])],
            {"product": "b", "places": "b"},
        ),
        _choice("number-name-numeral", "Which numeral matches this number name: four thousand, twenty?",
                ["4,200", "4,020", "420", "40,020"], "b"),
        _choice("number-name-numeral", "Which number name matches 1,000,000?",
                ["one hundred thousand", "one million", "ten thousand", "one thousand"], "b"),
        _choice(
            "large-number-line-point",
            "Which number is at point $P$ on the number line?",
            ["6,000", "7,000", "8,000", "4,000"],
            "b",
            _line(1000, [0, 5000, 10000], [{"at": 7000, "label": "P"}]),
        ),
        _choice(
            "large-number-line-point",
            "Which point is at 70,000 on the number line?",
            ["A", "B", "C", "D"],
            "c",
            _line(10000, [0, 50000, 100000], [
                {"at": 20000, "label": "A"},
                {"at": 40000, "label": "B"},
                {"at": 70000, "label": "C"},
                {"at": 90000, "label": "D"},
            ]),
        ),
    ]
    rejected = 0
    for problem in good:
        require(review_problem(problem) == problem["answer"], problem["public"]["templateId"])
        bad = json.loads(json.dumps(problem))
        if bad["answer"].startswith("option-"):
            bad["answer"] = "option-a" if bad["answer"] != "option-a" else "option-b"
        else:
            key = json.loads(bad["answer"])
            first = next(iter(key))
            key[first] = "a" if key[first] != "a" else "b"
            bad["answer"] = json.dumps(key, separators=(",", ":"))
        try:
            review_problem(bad)
        except ValueError:
            rejected += 1
        else:
            raise ValueError(f"Accepted a wrong {problem['public']['templateId']} answer")
    require(rejected == len(good), "Every corrupt fixture was rejected")
    return {"fixtures": len(good), "rejected": rejected}


if __name__ == "__main__":
    print(self_test())
