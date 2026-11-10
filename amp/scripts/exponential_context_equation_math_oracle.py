"""Independent check for exponential-context-equation.

The start, multiplier and target are read from the prompt. The time is the
exponent that matches those bases. Nothing imports the generator.
"""

import json
import re

SUPPORTED = frozenset({"exponential-context-equation"})
REVIEW_RETURNS_ANSWER = True


def require(condition, message):
    if not condition:
        raise ValueError(message)


def slope_power(power, base):
    steps = 0
    value = 1
    while value < power:
        value *= base
        steps += 1
        require(steps <= 50, "Exponent too large")
    require(value == power, "Target is not an integer power of the base")
    return steps


def solve(public):
    prompt = public["prompt"]
    blanks = {b["id"]: b for b in public["response"]["blanks"]}
    if "half-life" in prompt:
        match = re.search(
            r"starts with (\d+) atoms and has a half-life of (\d+) hours\..*?until (\d+) atoms",
            prompt,
        )
        require(match is not None, "Unrecognized decay prompt")
        start, half, target = (int(n) for n in match.groups())
        require(target and start % target == 0, "Target must divide the start")
        ratio = start // target
        steps = ratio.bit_length() - 1
        require(2 ** steps == ratio and steps >= 2, "Not a whole number of halvings")
        time = steps * half
        equation = f"${start}\\left(\\frac{{1}}{{2}}\\right)^{{t/{half}}}={target}$"
    else:
        match = re.search(
            r"starts with (\d+) bacteria and multiplies by (\d+) every hour\..*?until there are (\d+) bacteria",
            prompt,
        )
        require(match is not None, "Unrecognized growth prompt")
        start, base, target = (int(n) for n in match.groups())
        require(base in (2, 3, 4, 10) and target % start == 0, "Growth data")
        time = slope_power(target // start, base)
        equation = f"${start}\\cdot {base}^{{t}}={target}$"
    require(1 <= time <= 50, "Time out of range")

    def option_id(blank, label):
        hits = [o["id"] for o in blanks[blank]["options"] if o["label"] == label]
        require(len(hits) == 1, f"Missing option {label}")
        return hits[0]

    return json.dumps(
        {"eq": option_id("eq", equation), "n": option_id("n", str(time))},
        separators=(",", ":"),
    )


def review_problem(problem):
    expected = solve(problem["public"])
    require(problem["answer"] == expected, "Answer disagrees with the prompt")
    require("t =" not in problem["hint"] and "t=" not in problem["hint"], "Hint states the time")
    return expected


def self_test():
    public = {
        "templateId": "exponential-context-equation",
        "prompt": "A culture starts with 500 bacteria and multiplies by 2 every hour. Which equation gives the hours $t$ until there are 32000 bacteria? Then choose $t$.",
        "response": {
            "blanks": [
                {"id": "eq", "options": [
                    {"id": "b", "label": "$500\\cdot 2^{t}=32000$"},
                    {"id": "a", "label": "$500+2t=32000$"},
                ]},
                {"id": "n", "options": [
                    {"id": "c", "label": "6"},
                    {"id": "d", "label": "64"},
                ]},
            ]
        },
    }
    require(solve(public) == '{"eq":"b","n":"c"}', "Handwritten growth")
    return "ok"


if __name__ == "__main__":
    print(self_test())
