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


def solve(public):
    template = public["templateId"]
    require(template in SUPPORTED, "Wrong family")
    prompt = public["prompt"]
    if template == "multiply-two-digit":
        a, b = (int(v) for v in re.fullmatch(r"What is (\d+) × (\d+)\?", prompt).groups())
        require(12 <= b <= 999 and 11 <= a <= 999, "Factor size")
        return str(a * b)
    if template == "facts-to-twelve":
        if "×" in prompt:
            a, b = (int(v) for v in re.fullmatch(r"What is (\d+) × (\d+)\?", prompt).groups())
            require(a in (11, 12) or b in (11, 12), "An 11 or 12 factor")
            return str(a * b)
        dividend, teen = (int(v) for v in re.fullmatch(r"What is (\d+) ÷ (\d+)\?", prompt).groups())
        require(teen in (11, 12) and dividend % teen == 0, "Division by 11 or 12")
        return str(dividend // teen)
    if template == "growing-shape-pattern":
        start, add, step = (int(v) for v in re.fullmatch(
            r"A tile pattern starts with (\d+) tiles\. Each next step adds (\d+) tiles\. "
            r"The table shows steps 1, 2 and 3\. How many tiles are in step (\d+)\?",
            prompt,
        ).groups())
        require(step >= 5, "The asked step is not drawn")
        rows = public["figure"]["scene"]["elements"][0]["rows"]
        shown = [int(v) for v in rows[1][1:]]
        require(shown == [start + i * add for i in range(3)], "The table matches the rule")
        return str(start + (step - 1) * add)
    if template == "quotient-remainder-one-digit":
        dividend, divisor = (int(v) for v in re.search(
            r"Divide (\d+) by (\d+)", prompt).groups())
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
        n = int(re.search(r"factor of (\d+)", prompt).group(1))
        require(2 <= n <= 144, "Factor range")
        factors = set(factors_of(n))
        options = public["response"]["options"]
        require(len({o["label"] for o in options}) == len(options), "Distinct choices")
        keyed = [o["id"] for o in options if int(o["label"].replace(",", "")) in factors]
        require(sorted(int(o["label"].replace(",", "")) for o in options if o["id"] in keyed) == sorted(factors),
                "Every factor is offered")
        return json.dumps(sorted(keyed), separators=(",", ":"))
    d = int(re.search(r"multiple of (\d+)", prompt).group(1))
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
    fact = {"templateId": "facts-to-twelve", "prompt": "What is 132 ÷ 12?"}
    require(solve(fact) == "11", "132 ÷ 12")
    grow = {
        "templateId": "growing-shape-pattern",
        "prompt": "A tile pattern starts with 3 tiles. Each next step adds 2 tiles. The table shows steps 1, 2 and 3. How many tiles are in step 5?",
        "figure": {"scene": {"elements": [{"rows": [["Step", "1", "2", "3"], ["Tiles", "3", "5", "7"]]}]}},
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
    return {"fixtures": 5}


if __name__ == "__main__":
    print(self_test())
