"""Independent answers for the grade-4 operations family.

Products, quotients, factors, multiples and tile counts are recomputed from
the public wording. The generator's answer is never an input.
"""

import json
import re

from multipart_oracle_support import N, compact, pick, require, response_of

SUPPORTED = frozenset({
    "multiply-two-digit",
    "quotient-remainder-one-digit",
    "factor-pairs-select",
    "multiples-select",
    "facts-to-twelve",
    "growing-shape-pattern",
})
REVIEW_RETURNS_ANSWER = True


def factors_of(n):
    out = []
    i = 1
    while i * i <= n:
        if n % i == 0:
            out.append(i)
            if i * i != n:
                out.append(n // i)
        i += 1
    return sorted(out)


NUM = r"(\d{1,3}(?:,\d{3})*)"


def first_two(prompt):
    found = re.findall(NUM, prompt)
    require(len(found) >= 2, "Two public numbers")
    return whole(found[0]), whole(found[1])


def whole(text):
    require(re.fullmatch(r"\d{1,3}(,\d{3})*", text) is not None, f"Badly written number {text!r}")
    require(len(text) < 4 or "," in text, f"Missing thousands separator in {text!r}")
    return int(text.replace(",", ""))


def solve(public):
    template = public["templateId"]
    require(template in SUPPORTED, "Wrong family")
    prompt = public["prompt"]
    if template == "multiply-two-digit":
        a, b = first_two(prompt)
        # The squares run from 11 squared through 15 squared; every other product
        # has two factors of at least 12.
        require(11 <= a == b <= 15 or (12 <= b <= 999 and 11 <= a <= 999), "Factor size")
        return str(a * b)
    if template == "facts-to-twelve":
        a, b = first_two(prompt)
        if (
            "×" in prompt
            or " in each " in prompt
            or " a week for " in prompt
            or " on each " in prompt
        ):
            require(a in (11, 12) or b in (11, 12), "An 11 or 12 factor")
            return str(a * b)
        require(b in (11, 12) and a % b == 0, "Division by 11 or 12")
        return str(a // b)
    if template == "growing-shape-pattern":
        start = int(re.search(r"starts with (\d+)", prompt).group(1))
        add = int(re.search(r"adds (\d+)", prompt).group(1))
        step = int(re.search(r"step (\d+)\?", prompt).group(1))
        require(step >= 5, "The asked step is not drawn")
        elements = public["figure"]["scene"]["elements"]
        require(not any(e.get("type") == "lineTable" for e in elements), "Tiles, not a count table")
        for shown in (1, 2, 3):
            rows = [e for e in elements if e.get("type") == "array" and str(e.get("id", "")).startswith(f"s{shown}r")]
            require(len(rows) == shown, "One tile row for each drawn step")
            total = 0
            for row in rows:
                require(row["rows"] == 1 and 1 <= row["columns"] <= 20, "Array stays within the renderer cap")
                index = int(str(row["id"])[len(f"s{shown}r"):])
                require(row["columns"] == (start if index == 0 else add), "The row length follows the rule")
                total += row["columns"]
            require(total == start + (shown - 1) * add, "Drawn tiles follow the rule")
        require(not any(str(e.get("id", "")).startswith(f"s{step}") for e in elements), "The asked step is not drawn")
        return str(start + (step - 1) * add)
    if template == "quotient-remainder-one-digit":
        dividend, divisor = first_two(prompt)
        require(100 <= dividend <= 9999 and 2 <= divisor <= 9, "Grade-4 division size")
        quotient, rem = divmod(dividend, divisor)
        require(0 < rem < divisor, "A nonzero remainder smaller than the divisor")
        _, blanks = response_of(public, "inline")
        picks = {"q": pick(blanks["q"], N(quotient))}
        sentence = "".join(part.get("text", "") for part in public["response"]["sentence"])
        if "fraction" in prompt:
            require(f"/{divisor}" in sentence, "The denominator is the divisor")
            picks["num"] = pick(blanks["num"], N(rem))
        else:
            picks["r"] = pick(blanks["r"], N(rem))
        return compact(picks)
    if template == "factor-pairs-select":
        n = int(re.search(r"factors? of (\d+)", prompt).group(1))
        require(2 <= n <= 144, "Factor range")
        factors = set(factors_of(n))
        options = public["response"]["options"]
        require(len({o["label"] for o in options}) == len(options), "Distinct choices")
        keyed = [o["id"] for o in options if int(o["label"].replace(",", "")) in factors]
        require(sorted(int(o["label"].replace(",", "")) for o in options if o["id"] in keyed) == sorted(factors),
                "Every factor is offered")
        return json.dumps(sorted(keyed), separators=(",", ":"))
    d = int(re.search(r"multiples? of (\d+)", prompt).group(1))
    require(2 <= d <= 9, "One-digit divisor")
    options = public["response"]["options"]
    require(len({o["label"] for o in options}) == len(options), "Distinct choices")
    keyed = []
    for option in options:
        value = int(option["label"])
        if value % d == 0:
            keyed.append(option["id"])
        else:
            require(any(abs(int(other["label"]) - value) == 1 and int(other["label"]) % d == 0
                        for other in options), "A miss is one away from a multiple")
    return json.dumps(sorted(keyed), separators=(",", ":"))


def review_problem(problem):
    return solve(problem["public"])


def self_test():
    product = {"templateId": "multiply-two-digit", "prompt": "What is 12 × 13?"}
    require(solve(product) == "156", "12 × 13")
    farm = {"templateId": "multiply-two-digit", "prompt": "The farm plants 40 rows with 24 plants in each row. How many plants is that?"}
    require(solve(farm) == "960", "farm rows")
    novel = {"templateId": "multiply-two-digit", "prompt": "The novel has 120 pages with 28 lines on each page. How many lines is that?"}
    require(solve(novel) == "3360", "novel lines")
    fact = {"templateId": "facts-to-twelve", "prompt": "What is 132 ÷ 12?"}
    require(solve(fact) == "11", "132 ÷ 12")
    grow = {
        "templateId": "growing-shape-pattern",
        "prompt": "Ava is stacking books for the book fair. The pattern starts with 3 books. Each next step adds 2 books. The figure shows steps 1, 2 and 3. How many books are in step 5?",
        "figure": {"scene": {"elements": [
            {"type": "array", "id": "s1r0", "rows": 1, "columns": 3},
            {"type": "array", "id": "s2r0", "rows": 1, "columns": 3},
            {"type": "array", "id": "s2r1", "rows": 1, "columns": 2},
            {"type": "array", "id": "s3r0", "rows": 1, "columns": 3},
            {"type": "array", "id": "s3r1", "rows": 1, "columns": 2},
            {"type": "array", "id": "s3r2", "rows": 1, "columns": 2},
        ]}},
    }
    require(solve(grow) == "11", "step 5")
    factors = {
        "templateId": "factor-pairs-select",
        "prompt": "Select every factor of 9. A factor divides 9 with nothing left over.",
        "response": {"options": [
            {"id": "option-a", "label": "1"},
            {"id": "option-b", "label": "2"},
            {"id": "option-c", "label": "3"},
            {"id": "option-d", "label": "9"},
        ]},
    }
    require(solve(factors) == '["option-a","option-c","option-d"]', "factors of 9")
    multiples = {
        "templateId": "multiples-select",
        "prompt": "Select every multiple of 4. A multiple of 4 is 4 times a whole number.",
        "response": {"options": [
            {"id": "option-a", "label": "8"},
            {"id": "option-b", "label": "9"},
            {"id": "option-c", "label": "12"},
        ]},
    }
    require(solve(multiples) == '["option-a","option-c"]', "multiples of 4")
    return {"fixtures": 7}


if __name__ == "__main__":
    print(self_test())
