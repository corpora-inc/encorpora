"""Shared helpers for the independent multi-part-choice oracles.

Everything here reads only the public payload (prompt, figure, response) and
the problem's answer/hint strings as values under test. Each blank's correct
option is found by comparing exact values (Fractions, or normalized text), so
an option is correct only when its meaning equals the independently computed
value; two options of equal meaning, or none, are rejected.
"""

import json
import re
from fractions import Fraction as F

from multi_part_choice_math_oracle import common_response, check_card_use

OPTION_IDS = "abcdef"
BLANK_ID = re.compile(r"[a-z][a-z0-9]{0,7}")
MINUS = "−"


def require(condition, message):
    if not condition:
        raise ValueError(message)


def compact(key):
    return json.dumps(key, separators=(",", ":"))


def untex(text):
    """Learner text with TeX wrappers and thousands marks read as plain text."""
    plain = (
        text.replace("{,}", ",")
        .replace("\\dfrac", "\\frac")
        .replace("\\,", "")
        .replace("$", "")
        .replace(MINUS, "-")
        .strip()
    )
    # A lone typeset fraction may be read as plain a/b by the harness.
    return re.sub(r"(?<![\d/.])(\d+)/(\d+)(?![\d/])", r"\\frac{\1}{\2}", plain)


NUMBER = re.compile(r"([+-]?)(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?(%?)")


def number_of(text):
    """A plain, TeX fraction or percent label as ('n', Fraction) / ('p', Fraction); else None."""
    s = untex(text).replace(" ", "")
    m = re.fullmatch(r"([+-]?)\\frac\{(\d+)\}\{(\d+)\}", s)
    if m:
        require(int(m[3]) != 0, f"Zero denominator in {text!r}")
        value = F(int(m[2]), int(m[3]))
        return ("n", -value if m[1] == "-" else value)
    m = NUMBER.fullmatch(s)
    if not m:
        return None
    value = F(m[2].replace(",", "") + (m[3] or ""))
    if m[1] == "-":
        value = -value
    return ("p" if m[4] else "n", value)


def key_of(label):
    """Meaning of an option label: its exact number, or its lower-cased words."""
    number = number_of(label)
    return number if number is not None else ("t", " ".join(untex(label).lower().split()))


def N(value):
    return ("n", F(value))


def P(value):
    return ("p", F(value))


def T(text):
    return ("t", " ".join(text.lower().split()))


def check_label_typography(label):
    """Prose numbers use the true minus sign, no trailing .0, no stray TeX digits."""
    require("$" in label or "-" not in label.replace(" - ", ""), f"Hyphen used as a minus sign in {label!r}")
    require(not re.search(r"\d\.0\b", label), f"Trailing .0 in {label!r}")
    require(label == label.strip() and "  " not in label, f"Whitespace in {label!r}")


def response_of(public, layout=None, blank_ids=None):
    response = public["response"]
    require(response.get("kind") == "multi-part-choice", "Response protocol")
    if response.get("layout") == "cards":
        common_response(response, layout or "inline", "Choose")
    elif layout:
        require(response["layout"] == layout, f"Layout {response['layout']} instead of {layout}")
    blanks = response["blanks"]
    require(2 <= len(blanks) <= 6, "Two to six blanks")
    ids = [b["id"] for b in blanks]
    require(len(set(ids)) == len(ids) and all(BLANK_ID.fullmatch(i) for i in ids), "Blank ids")
    if blank_ids is not None:
        require(ids == list(blank_ids), f"Blank ids {ids} instead of {list(blank_ids)}")
    for blank in blanks:
        options = blank["options"]
        require(2 <= len(options) <= 6, f"{blank['id']}: two to six options")
        require([o["id"] for o in options] == list(OPTION_IDS[: len(options)]), f"{blank['id']}: option ids a, b, c...")
        require(all(set(o) == {"id", "label"} for o in options), f"{blank['id']}: option fields")
        keys = [key_of(o["label"]) for o in options]
        require(len(set(keys)) == len(keys), f"{blank['id']}: options with the same meaning {[o['label'] for o in options]}")
        for o in options:
            check_label_typography(o["label"])
    if response["layout"] == "inline":
        order = [p["blank"] for p in response["sentence"] if "blank" in p]
        require(order == ids, "Sentence blanks follow blank order")
    elif response["layout"] == "table":
        first = [(o["id"], o["label"]) for o in blanks[0]["options"]]
        require(all([(o["id"], o["label"]) for o in b["options"]] == first for b in blanks), "Table rows share columns")
    return response, {b["id"]: b for b in blanks}


def sentence_of(response):
    return "".join(p["text"] if "text" in p else "{" + p["blank"] + "}" for p in response.get("sentence", []))


def pick(blank, expected):
    """The id of the one option whose meaning equals the expected value."""
    hits = [o["id"] for o in blank["options"] if key_of(o["label"]) == expected]
    require(len(hits) == 1, f"{blank['id']}: {len(hits)} options mean {expected}; options {[o['label'] for o in blank['options']]}")
    return hits[0]


def figure_rows(public):
    figure = public.get("figure")
    require(figure and figure.get("kind") == "scene", "A scene figure is required")
    elements = figure["scene"]["elements"]
    tables = [e for e in elements if e.get("type") == "lineTable"]
    require(len(tables) == 1, "One table in the figure")
    return tables[0]["rows"]


def grades(key, answer):
    """Credit needs every blank correct; a missing, extra or wrong blank earns none."""
    return isinstance(answer, dict) and list(answer) == list(key) and all(answer[k] == key[k] for k in key)


def finish(problem, picks):
    """Order the picks by blank, compare with the stored key, check grading and leaks."""
    public = problem["public"]
    ids = [b["id"] for b in public["response"]["blanks"]]
    require(sorted(picks) == sorted(ids), "A pick for every blank")
    key = {i: picks[i] for i in ids}
    expected = compact(key)
    answer = problem["answer"]
    require(isinstance(answer, str) and answer == expected, f"Answer {answer} disagrees with the wording; expected {expected}")
    require(grades(key, dict(key)), "Full credit for the key")
    for blank_id in ids:
        for option in next(b for b in public["response"]["blanks"] if b["id"] == blank_id)["options"]:
            if option["id"] != key[blank_id]:
                require(not grades(key, {**key, blank_id: option["id"]}), "One wrong blank must earn no credit")
        partial = {k: v for k, v in key.items() if k != blank_id}
        require(not grades(key, partial), "A missing blank must earn no credit")
    return expected


NUMBER_TOKEN = re.compile(r"(?<![\w.])(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?(?![\w])")


def numbers_in(text):
    return {F(m[1].replace(",", "") + (m[2] or "")) for m in NUMBER_TOKEN.finditer(untex(text).replace("{,}", ","))}


def public_text(public):
    parts = [public["prompt"], sentence_of(public["response"])]
    parts += [b["label"] for b in public["response"]["blanks"]]
    if public.get("figure"):
        parts.append(json.dumps(public["figure"], ensure_ascii=False))
    return " ".join(parts)


def check_no_leak(problem, picks):
    """The hint must not hand over a computed answer: a correct numeric option
    that is not already a given may not appear as a number in the hint."""
    public = problem["public"]
    given = numbers_in(public_text(public))
    hint = re.sub(r"\^\{?\d+\}?", "", problem.get("hint", ""))
    for blank in public["response"]["blanks"]:
        label = next(o["label"] for o in blank["options"] if o["id"] == picks[blank["id"]])
        key = key_of(label)
        if key[0] == "n" and abs(key[1]) not in given and abs(key[1]) not in (0, 1):
            require(abs(key[1]) not in numbers_in(hint), f"The hint gives the answer {label} for {blank['id']}")
    return True


def review(problem, solve_picks):
    public = problem["public"]
    picks = solve_picks(public)
    check_card_use(public["response"], picks)
    expected = finish(problem, picks)
    check_no_leak(problem, picks)
    return expected


def expect_rejected(review_problem, problem, what):
    try:
        review_problem(problem)
    except (ValueError, TypeError, KeyError, AttributeError, StopIteration, IndexError):
        return 1
    raise ValueError(f"Corrupt case was accepted: {what}")
