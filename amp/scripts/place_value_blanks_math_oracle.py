"""Independent review of the place-value blank families from public payloads.

Each blank's correct option is computed from the number(s) in the prompt or
sentence with exact arithmetic (digit positions, half-up rounding, expanded
parts, exact comparison). The private answer, hint and explanation are values
under test. Every blank must have distinct options (by value), exactly one
correct, and grading needs every blank (`grade`).
"""

import copy
import json
import re
import sys
from fractions import Fraction as F
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from multi_part_choice_math_oracle import common_response, compact, pick, require  # noqa: E402

SUPPORTED = frozenset({"digit-place-names", "round-place-blanks", "round-decimal-blanks", "round-addends-sum",
                       "expanded-whole-slots", "expanded-decimal-slots", "compare-symbol-blanks", "digit-value-blanks"})
WHOLE = r"\d{1,3}(?:,\d{3})*"
PLACES = ["ones", "tens", "hundreds", "thousands", "ten thousands", "hundred thousands", "millions"]
DECIMAL_PLACES = {"tenth": 1, "hundredth": 2}
ROUND_TO = {"thousand": 1000, "hundred": 100, "ten": 10}
PLACEHOLDER = re.compile(r"\$\{|\bundefined\b|\bNaN\b|\[object")


def whole(text):
    require(re.fullmatch(WHOLE, text) is not None or re.fullmatch(r"\d+", text) is not None and len(text) <= 3, f"Number format {text!r}")
    return int(text.replace(",", ""))


def tex_whole(text):
    """$8{,}991$ style numbers: braces around the grouping commas."""
    require(re.fullmatch(r"\d{1,3}(?:\{,\}\d{3})*", text) is not None, f"TeX number {text!r}")
    return int(text.replace("{,}", ""))


def tex_sum(text):
    return sum(tex_whole(term) for term in text.split("+"))


def round_half_up(value, step):
    return int((F(value) / step + F(1, 2)) // 1) * step


def decimal(text):
    require(re.fullmatch(r"\d+(?:\.\d+)?", text) is not None, f"Decimal {text!r}")
    return F(text)


def text_number(label):
    require(re.fullmatch(r"\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?", label), f"Option number {label!r}")
    return F(label.replace(",", ""))


def place_value_of_tex(label):
    """$d\\times 1{,}000$ or $d\\times \\frac{1}{10}$: (digit, place value)."""
    match = re.fullmatch(r"\$(\d)\\times (?:(\d{1,3}(?:\{,\}\d{3})*)|\\frac\{1\}\{(\d+)\})\$", label)
    require(match is not None, f"Product option {label!r}")
    digit, big, small = match.groups()
    return int(digit), (F(int(big.replace("{,}", ""))) if big else F(1, int(small)))


def digits_with_places(text):
    """[(digit, place value)] for a plain decimal string with optional commas."""
    text = text.replace(",", "")
    whole_part, _, fraction = text.partition(".")
    pairs = [(int(d), F(10) ** (len(whole_part) - 1 - i)) for i, d in enumerate(whole_part)]
    pairs += [(int(d), F(1, 10 ** (i + 1))) for i, d in enumerate(fraction)]
    return pairs


def grade(public, key, submitted):
    try:
        given = json.loads(submitted)
    except (TypeError, ValueError):
        return False
    return isinstance(given, dict) and list(given) == [b["id"] for b in public["response"]["blanks"]] and given == json.loads(key)


def inline_text(sentence):
    return "".join(part["text"] if "text" in part else "{" + part["blank"] + "}" for part in sentence)


def solve_detail(public):
    template, prompt, response = public["templateId"], public["prompt"], public["response"]
    require(template in SUPPORTED, "Wrong family")
    key, facts = {}, {}
    if template == "digit-place-names":
        m = re.fullmatch(rf"Every digit of ({WHOLE}) is different\. Choose the place of each digit\.", prompt)
        require(m is not None, f"Prompt {prompt!r}")
        digits = m[1].replace(",", "")
        require(len(set(digits)) == len(digits) and len(digits) <= 6, "Digits are not all different")
        blanks = common_response(response, "slots", "Choose the place of each digit")
        require(len(blanks) == len(digits), "One blank per digit")
        for i, (blank, d) in enumerate(zip(blanks, digits)):
            require(blank["id"] == f"d{i + 1}" and blank["label"] == f"The place of the digit {d}", "Blank label")
            key[blank["id"]] = pick(blank, PLACES[len(digits) - 1 - i], lambda label: label)
        facts = {"digits": digits}
    elif template == "round-place-blanks":
        sentence = response.get("sentence")
        m = re.fullmatch(r"Round (" + WHOLE + r") three ways\. Choose each rounded number\.", prompt)
        if m is None:
            require(prompt == "Complete the sentence about the rounded values of one number.", f"Prompt {prompt!r}")
            blanks = common_response(response, "inline", "Choose the rounded numbers")
            s = inline_text(sentence)
            m = re.fullmatch(rf"Rounded to the nearest thousand, ({WHOLE}) is \{{u1000\}}; to the nearest hundred it is \{{u100\}}; and to the nearest ten it is \{{u10\}}\.", s)
            require(m is not None, f"Sentence {s!r}")
        else:
            blanks = common_response(response, "slots", "Choose the rounded numbers")
        n = whole(m[1])
        require([b["id"] for b in blanks] == ["u1000", "u100", "u10"], "Blank ids")
        for blank, (word, step) in zip(blanks, ROUND_TO.items()):
            require(blank["label"] == f"The number rounded to the nearest {word}", "Blank label")
            key[blank["id"]] = pick(blank, round_half_up(n, step), lambda label: text_number(label))
        facts = {"n": n}
    elif template == "round-decimal-blanks":
        m = re.fullmatch(r"Round (\d+\.\d{3}) to two different places\. Choose the number for each gap\.", prompt)
        require(m is not None, f"Prompt {prompt!r}")
        x = decimal(m[1])
        blanks = common_response(response, "inline", "Choose the rounded numbers")
        s = inline_text(response["sentence"])
        require(s == f"Rounded to the nearest tenth, {m[1]} is {{tenth}}. Rounded to the nearest hundredth, it is {{hundth}}.", f"Sentence {s!r}")
        require([b["id"] for b in blanks] == ["tenth", "hundth"], "Blank ids")
        for blank, (word, places) in zip(blanks, (("tenth", 1), ("hundredth", 2))):
            require(blank["label"] == f"The number rounded to the nearest {word}", "Blank label")
            step = F(1, 10 ** places)
            key[blank["id"]] = pick(blank, round_half_up(x, step) if False else ((x / step + F(1, 2)) // 1) * step, text_number)
        facts = {"x": x}
    elif template == "round-addends-sum":
        m = re.fullmatch(r"Estimate (\d+) \+ (\d+) by rounding each addend to the nearest (ten|hundred)\. Choose the two rounded numbers and their sum\.", prompt)
        require(m is not None, f"Prompt {prompt!r}")
        a, b, step = int(m[1]), int(m[2]), ROUND_TO[m[3]]
        blanks = common_response(response, "slots", "Choose the rounded numbers and the sum")
        require([x["id"] for x in blanks] == ["a", "b", "sum"], "Blank ids")
        require([x["label"] for x in blanks] == [f"{a} rounded to the nearest {m[3]}", f"{b} rounded to the nearest {m[3]}", "The sum of the rounded numbers"], "Blank labels")
        ra, rb = round_half_up(a, step), round_half_up(b, step)
        key = {"a": pick(blanks[0], ra, text_number), "b": pick(blanks[1], rb, text_number), "sum": pick(blanks[2], ra + rb, text_number)}
        facts = {"a": a, "b": b, "ra": ra, "rb": rb}
    elif template in ("expanded-whole-slots", "expanded-decimal-slots"):
        m = re.fullmatch(r"Write (" + WHOLE + (r"\.\d+" if template == "expanded-decimal-slots" else "") +
                         r") as a sum of the values of its digits\. Choose each part of the sum, from the greatest place to the least\.", prompt)
        require(m is not None, f"Prompt {prompt!r}")
        number = m[1]
        parts = [(d, p) for d, p in digits_with_places(number) if d != 0]
        blanks = common_response(response, "inline", "Choose each part of the sum")
        require(len(blanks) == len(parts), f"{len(parts)} nonzero digits need {len(parts)} blanks")
        shown = number.replace(",", "{,}")
        require(inline_text(response["sentence"]) == f"${shown}=$ " + " $+$ ".join(f"{{t{i + 1}}}" for i in range(len(parts))), "Sentence")
        for i, (blank, (d, p)) in enumerate(zip(blanks, parts)):
            require(blank["id"] == f"t{i + 1}" and blank["label"] == f"Part {i + 1} of the sum", "Blank label")
            product = blank["options"][0]["label"].startswith("$")
            require(all(o["label"].startswith("$") == product for o in blank["options"]), "Mixed option forms")
            if product:
                value_of = lambda label: (lambda dp: dp[0] * dp[1])(place_value_of_tex(label))
            else:
                value_of = text_number
            key[blank["id"]] = pick(blank, d * p, value_of)
            if product:
                # the correct product must use the right digit AND the right place, not just an equal value
                chosen = blank["options"][ord(key[blank["id"]]) - 97]["label"]
                require(place_value_of_tex(chosen) == (d, p), "Correct option's digit and place")
        facts = {"number": number, "parts": parts}
    elif template == "compare-symbol-blanks":
        require(prompt == "Choose the symbol that makes each comparison true: less than, equal to or greater than.", f"Prompt {prompt!r}")
        blanks = common_response(response, "inline", "Choose a symbol for each comparison")
        s = inline_text(response["sentence"])
        m = re.fullmatch(r"First comparison: \$([^$]+)\$ \{c1\} \$([^$]+)\$\.  Second comparison: \$([^$]+)\$ \{c2\} \$([^$]+)\$\.", s)
        require(m is not None, f"Sentence {s!r}")
        require([b["id"] for b in blanks] == ["c1", "c2"], "Blank ids")
        require([b["label"] for b in blanks] == ["The symbol for the first comparison", "The symbol for the second comparison"], "Blank labels")
        symbols = {"$<$": "<", "$=$": "=", "$>$": ">"}
        pairs = [(tex_sum(m[1]), tex_sum(m[2])), (tex_sum(m[3]), tex_sum(m[4]))]
        for blank, (left, right) in zip(blanks, pairs):
            require({o["label"] for o in blank["options"]} == set(symbols), "Symbol options")
            key[blank["id"]] = pick(blank, "<" if left < right else "=" if left == right else ">", lambda label: symbols[label])
        facts = {"pairs": pairs}
    else:
        m = re.fullmatch(rf"The number ({WHOLE}) has an (\d) in two places\. Complete the sentence\.", prompt)
        require(m is not None, f"Prompt {prompt!r}")
        n, digit = m[1], m[2]
        blanks = common_response(response, "inline", "Complete the sentence")
        s = inline_text(response["sentence"])
        m2 = re.fullmatch(rf"In {re.escape(n)}, the {digit} in the \{{place\}} place is worth \{{times\}} times as much as the {digit} in the ([a-z ]+) place\.", s)
        require(m2 is not None, f"Sentence {s!r}")
        plain = n.replace(",", "")
        spots = [len(plain) - 1 - i for i, c in enumerate(plain) if c == digit]
        require(len(spots) == 2, "The digit must appear in exactly two places")
        require(m2[1] in PLACES and PLACES.index(m2[1]) == min(spots), "The named place must be the lesser 8")
        high = max(spots)
        require([b["id"] for b in blanks] == ["place", "times"], "Blank ids")
        require([b["label"] for b in blanks] == [f"The place of the greater {digit}", "How many times as much"], "Blank labels")
        key = {"place": pick(blanks[0], PLACES[high], lambda label: label),
               "times": pick(blanks[1], 10 ** (high - min(spots)), text_number)}
        facts = {"n": plain, "digit": digit, "low": min(spots), "high": high}
    return compact(key), facts


def solve(public):
    return solve_detail(public)[0]


def review_explanation(public, problem, facts):
    template, lines = public["templateId"], problem["explanation"]
    text = " ".join(lines)
    if template == "digit-place-names":
        digits = facts["digits"]
        for i, d in enumerate(digits):
            place = PLACES[len(digits) - 1 - i]
            value = int(d) * 10 ** (len(digits) - 1 - i)
            want = f"The digit {d} of {int(digits):,} is in the {place} place, so it stands for {value:,}."
            require(want in lines, f"Explanation line missing: {want}")
    elif template == "round-place-blanks":
        n = facts["n"]
        for (word, step), line in zip(ROUND_TO.items(), lines):
            require(line.endswith(f"giving {round_half_up(n, step):,}."), f"Rounding line {line!r}")
    elif template == "round-decimal-blanks":
        x = facts["x"]
        for places, line in ((1, lines[0]), (2, lines[1])):
            step = F(1, 10 ** places)
            r = ((x / step + F(1, 2)) // 1) * step
            require(line.endswith(f"The result is {float(r):g}."), f"Rounding line {line!r}")
    elif template == "round-addends-sum":
        require(f"{facts['a']} rounds to {facts['ra']:,} and {facts['b']} rounds to {facts['rb']:,}." == lines[0], "Rounding line")
        total = facts["ra"] + facts["rb"]
        shown = f"{total:,}".replace(",", "{,}")
        ra, rb = (f"{v:,}".replace(",", "{,}") for v in (facts["ra"], facts["rb"]))
        require(f"${ra} + {rb} = {shown}$" in lines[1], "Estimate line")
        require(f"The exact sum, {facts['a'] + facts['b']:,}," in lines[2], "Exact sum line")
    elif template in ("expanded-whole-slots", "expanded-decimal-slots"):
        parts = facts["parts"]
        total = sum(d * p for d, p in parts)
        require(total == F(facts["number"].replace(",", "")), "Parts sum to the number")
        require(len(lines) == len(parts) + 2, "Lead line, one line per part, sum line")
        shown = facts["number"].replace(",", "{,}")
        sum_line = re.fullmatch(r"The sum is \$([^=$]+)=" + re.escape(shown) + r"\$\.", lines[-1])
        require(sum_line is not None, f"Sum line {lines[-1]!r}")
        addends = sum_line[1].split("+")
        require(len(addends) == len(parts), "Sum line addends")
        for addend, (d, p) in zip(addends, parts):
            require(F(addend.replace("{,}", "")) == d * p, f"Sum line addend {addend!r}")
        for line, (d, p) in zip(lines[1:-1], parts):
            require(line.startswith(f"The digit {d} is in the "), f"Part line {line!r}")
            tail = re.search(r"= ([\d,.{}]+)\$\.$", line) or re.search(r"part is \$([\d,.{}]+)\$\.$", line)
            require(tail is not None and F(tail[1].replace("{,}", "").replace(",", "")) == d * p, f"Part value in {line!r}")
    elif template == "compare-symbol-blanks":
        names = {"<": "less than", "=": "equal to", ">": "greater than"}
        for (left, right), line in zip(facts["pairs"], lines):
            verdict = "<" if left < right else "=" if left == right else ">"
            require(line.endswith(f"is {names[verdict]} the second." if verdict != "=" else "so the symbol is equal to."), f"Verdict in {line!r}")
    else:
        n, high, low = facts["n"], facts["high"], facts["low"]
        d = int(facts["digit"])
        require(f"{d * 10 ** low:,}" in lines[0] and f"{d * 10 ** high:,}" in lines[0], "Values in the first line")
        require(f"{high - low} places apart" in lines[1] and f"= {10 ** (high - low)}" in lines[1], "Distance line")
    require(not PLACEHOLDER.search(text + problem["hint"]), "Unrendered placeholder")


def check_leak(public, problem, key):
    """The hint never states the correct option of a blank that the prompt did not already give."""
    hint, prompt = problem["hint"], public["prompt"] + " " + json.dumps(public["response"].get("sentence", ""))
    for blank in public["response"]["blanks"]:
        label = blank["options"][ord(key[blank["id"]]) - 97]["label"]
        if len(label) < 3 or label in prompt:
            continue
        bare = label.strip("$")
        require(re.search(r"(?<![\w,.])" + re.escape(bare) + r"(?![\w,]|\.\d)", hint) is None, f"Hint gives away {label!r}")


def review_problem(problem):
    public = problem["public"]
    expected, facts = solve_detail(public)
    require(problem["answer"] == expected, f"Answer {problem['answer']} disagrees with the wording; expected {expected}")
    key = json.loads(expected)
    require(list(key) == [b["id"] for b in public["response"]["blanks"]], "Answer keys follow blank order")
    require(grade(public, expected, expected), "The key must grade correct")
    require(all(chr(97 + i) == o["id"] for b in public["response"]["blanks"] for i, o in enumerate(b["options"])), "Option ids")
    for blank in public["response"]["blanks"]:
        for option in blank["options"]:
            if option["id"] != key[blank["id"]]:
                wrong = dict(key)
                wrong[blank["id"]] = option["id"]
                require(not grade(public, expected, compact(wrong)), "One wrong blank must fail")
        require(not grade(public, expected, compact({k: v for k, v in key.items() if k != blank["id"]})), "A missing blank must fail")
    review_explanation(public, problem, facts)
    check_leak(public, problem, key)
    return expected


# ---------------------------------------------------------------- self test

def opts(*labels):
    return [{"id": "abcdef"[i], "label": label} for i, label in enumerate(labels)]


def blank(i, label, *options):
    return {"id": i, "label": label, "options": opts(*options)}


def case(template, prompt, label, layout, blanks, answer, explanation, hint, sentence=None):
    response = {"kind": "multi-part-choice", "label": label, "layout": layout, "blanks": blanks}
    if sentence is not None:
        response["sentence"] = sentence
    return {"public": {"templateId": template, "seed": "f", "prompt": prompt, "response": response},
            "answer": answer, "hint": hint, "explanation": explanation}


def self_test():
    places = ["hundred thousands", "ten thousands", "thousands", "hundreds", "tens", "ones"]
    digit_names = case("digit-place-names", "Every digit of 903,471 is different. Choose the place of each digit.", "Choose the place of each digit", "slots",
                       [blank(f"d{i + 1}", f"The place of the digit {d}", *places) for i, d in enumerate("903471")],
                       '{"d1":"a","d2":"b","d3":"c","d4":"d","d5":"e","d6":"f"}',
                       ["Count places from the right: ones, tens, hundreds, thousands, ten thousands, hundred thousands.",
                        "The digit 9 of 903,471 is in the hundred thousands place, so it stands for 900,000.",
                        "The digit 0 of 903,471 is in the ten thousands place, so it stands for 0.",
                        "The digit 3 of 903,471 is in the thousands place, so it stands for 3,000.",
                        "The digit 4 of 903,471 is in the hundreds place, so it stands for 400.",
                        "The digit 7 of 903,471 is in the tens place, so it stands for 70.",
                        "The digit 1 of 903,471 is in the ones place, so it stands for 1."],
                       "Start at the rightmost digit, 1, and move left one place at a time.")
    sentence = [{"text": "Rounded to the nearest thousand, 5,178 is "}, {"blank": "u1000"}, {"text": "; to the nearest hundred it is "},
                {"blank": "u100"}, {"text": "; and to the nearest ten it is "}, {"blank": "u10"}, {"text": "."}]
    rounding = case("round-place-blanks", "Complete the sentence about the rounded values of one number.", "Choose the rounded numbers", "inline",
                    [blank("u1000", "The number rounded to the nearest thousand", "5,178", "5,000", "10,000", "6,000"),
                     blank("u100", "The number rounded to the nearest hundred", "5,200", "5,000", "5,180", "5,178"),
                     blank("u10", "The number rounded to the nearest ten", "5,170", "5,200", "5,180", "5,178")],
                    '{"u1000":"b","u100":"a","u10":"c"}',
                    ["To the nearest thousand, look at the digit to the right of that place, 1: it is less than 5, so round down, giving 5,000.",
                     "To the nearest hundred, look at the digit to the right of that place, 7: it is 5 or more, so round up, giving 5,200.",
                     "To the nearest ten, look at the digit to the right of that place, 8: it is 5 or more, so round up, giving 5,180."],
                    "For 5,178, find the digit one place to the right of the rounding place.", sentence)
    decimal_round = case("round-decimal-blanks", "Round 5.434 to two different places. Choose the number for each gap.", "Choose the rounded numbers", "inline",
                         [blank("tenth", "The number rounded to the nearest tenth", "5.5", "5", "5.4", "5.43"),
                          blank("hundth", "The number rounded to the nearest hundredth", "5.44", "5.434", "5.4", "5.43")],
                         '{"tenth":"c","hundth":"d"}',
                         ["Nearest tenth: the hundredths digit is 3, which is less than 5, so the tenths digit stays. The result is 5.4.",
                          "Nearest hundredth: the thousandths digit is 4, which is less than 5, so the hundredths digit stays. The result is 5.43.",
                          "Each rounding starts from 5.434, not from the other rounded number."],
                         "Look at the digit 3 in the hundredths place.",
                         [{"text": "Rounded to the nearest tenth, 5.434 is "}, {"blank": "tenth"}, {"text": ". Rounded to the nearest hundredth, it is "}, {"blank": "hundth"}, {"text": "."}])
    addends = case("round-addends-sum", "Estimate 57 + 76 by rounding each addend to the nearest ten. Choose the two rounded numbers and their sum.",
                   "Choose the rounded numbers and the sum", "slots",
                   [blank("a", "57 rounded to the nearest ten", "57", "60", "50", "100"), blank("b", "76 rounded to the nearest ten", "80", "70", "76", "100"),
                    blank("sum", "The sum of the rounded numbers", "130", "100", "150", "140")],
                   '{"a":"b","b":"a","sum":"d"}',
                   ["57 rounds to 60 and 76 rounds to 80.", "The estimate is $60 + 80 = 140$.",
                    "The exact sum, 133, is a different number: the question asks for the sum of the rounded addends."],
                   "Round 57 first, then 76.")
    expanded = case("expanded-whole-slots", "Write 63,206 as a sum of the values of its digits. Choose each part of the sum, from the greatest place to the least.",
                    "Choose each part of the sum", "inline",
                    [blank("t1", "Part 1 of the sum", "30,000", "6,000", "60,000", "600,000"), blank("t2", "Part 2 of the sum", "6,000", "30,000", "3,000", "300,000"),
                     blank("t3", "Part 3 of the sum", "300", "20", "200", "20,000"), blank("t4", "Part 4 of the sum", "3", "600", "6", "60")],
                    '{"t1":"c","t2":"c","t3":"c","t4":"c"}',
                    ["Each digit is worth the digit times its place value. A digit 0 adds nothing, so it has no part in the sum.",
                     "The digit 6 is in the ten thousands place, so its part is $60{,}000$.", "The digit 3 is in the thousands place, so its part is $3{,}000$.",
                     "The digit 2 is in the hundreds place, so its part is $200$.", "The digit 6 is in the ones place, so its part is $6$.",
                     "The sum is $60{,}000+3{,}000+200+6=63{,}206$."],
                    "The leftmost digit of 63,206 is 6.",
                    [{"text": "$63{,}206=$ "}, {"blank": "t1"}, {"text": " $+$ "}, {"blank": "t2"}, {"text": " $+$ "}, {"blank": "t3"}, {"text": " $+$ "}, {"blank": "t4"}])
    compare = case("compare-symbol-blanks", "Choose the symbol that makes each comparison true: less than, equal to or greater than.",
                   "Choose a symbol for each comparison", "inline",
                   [blank("c1", "The symbol for the first comparison", "$<$", "$=$", "$>$"), blank("c2", "The symbol for the second comparison", "$<$", "$=$", "$>$")],
                   '{"c1":"a","c2":"b"}',
                   ["Comparison 1: 529 and 530 first differ at the digit in place 2 from the left, so the first is less than the second.",
                    "Comparison 2: 8,000 + 900 + 90 + 1 is 8,991, the same number as 8,991, so the symbol is equal to."],
                   "Compare the digits from the left.",
                   [{"text": "First comparison: $529$ "}, {"blank": "c1"}, {"text": " $530$.  Second comparison: $8{,}991$ "}, {"blank": "c2"}, {"text": " $8{,}000+900+90+1$."}])
    value = case("digit-value-blanks", "The number 835,083 has an 8 in two places. Complete the sentence.", "Complete the sentence", "inline",
                 [blank("place", "The place of the greater 8", "hundreds", "hundred thousands", "ten thousands", "ones"),
                  blank("times", "How many times as much", "10,000", "100", "1,000,000", "100,000")],
                 '{"place":"b","times":"a"}',
                 ["The 8 in the tens place is worth 80, and the 8 in the hundred thousands place is worth 800,000.",
                  "They are 4 places apart, so the greater 8 is worth $10^{4} = 10000$ times as much as the other: $800{,}000\\div 80 = 10000$."],
                 "Count how many places apart the two 8s are.",
                 [{"text": "In 835,083, the 8 in the "}, {"blank": "place"}, {"text": " place is worth "}, {"blank": "times"}, {"text": " times as much as the 8 in the tens place."}])
    fixtures = [digit_names, rounding, decimal_round, addends, expanded, compare, value]
    for base in fixtures:
        require(review_problem(base) == base["answer"], "Fixture must pass")
    mutations = 0

    def swap_option(p, b, k, label):
        p["public"]["response"]["blanks"][b]["options"][k]["label"] = label

    for base, change, what in (
            (digit_names, lambda p: p.update(answer=p["answer"].replace('"d2":"b"', '"d2":"c"')), "wrong place"),
            (rounding, lambda p: p.update(answer=p["answer"].replace('"u100":"a"', '"u100":"c"')), "wrong rounding"),
            (rounding, lambda p: swap_option(p, 1, 1, "5,200"), "repeated option"),
            (rounding, lambda p: p["explanation"].__setitem__(1, p["explanation"][1].replace("5,200", "5,100")), "false explanation"),
            (rounding, lambda p: p.update(hint="For 5,178 the answer to the nearest ten is 5,180."), "hint leak"),
            (decimal_round, lambda p: p.update(answer='{"tenth":"a","hundth":"d"}'), "rounded the wrong way"),
            (decimal_round, lambda p: p["public"].update(prompt=p["public"]["prompt"].replace("5.434", "5.464")), "changed number"),
            (addends, lambda p: p.update(answer='{"a":"b","b":"a","sum":"a"}'), "sum of unrounded addends"),
            (expanded, lambda p: p.update(answer='{"t1":"c","t2":"c","t3":"a","t4":"c"}'), "wrong part"),
            (expanded, lambda p: swap_option(p, 3, 1, "6"), "two options equal"),
            (expanded, lambda p: p["explanation"].__setitem__(-1, "The sum is $60{,}000+3{,}000+200+7=63{,}206$."), "false sum line"),
            (compare, lambda p: p.update(answer='{"c1":"c","c2":"b"}'), "reversed symbol"),
            (compare, lambda p: p["public"]["response"]["sentence"].__setitem__(4, {"text": " $8{,}000+900+90+2$."}), "unequal sum"),
            (value, lambda p: p.update(answer='{"place":"b","times":"d"}'), "wrong factor"),
            (value, lambda p: p["public"].update(prompt=p["public"]["prompt"].replace("835,083", "835,088")), "third eight")):
        bad = copy.deepcopy(base)
        change(bad)
        try:
            review_problem(bad)
        except (ValueError, KeyError, TypeError, IndexError, ZeroDivisionError, AttributeError):
            mutations += 1
        else:
            raise AssertionError(f"Accepted corrupt place-value case: {what}")
    return {"fixtures": len(fixtures), "mutations": mutations}


REVIEW_RETURNS_ANSWER = True

if __name__ == "__main__":
    print(self_test())
