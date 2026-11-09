"""Independent check for slope-criteria-proof.

Reasons are a fixed table. The perpendicular slope is computed from the run
and rise in the prompt, and the product of the two slopes is checked to be -1.
"""

import json
import re
from fractions import Fraction

SUPPORTED = frozenset({"slope-criteria-proof"})
REVIEW_RETURNS_ANSWER = True

REASONS = {
    "parallel": [
        "Given: both runs are equal.",
        "The rise is vertical and the run is horizontal.",
        "Corresponding angles: parallel lines cut by a transversal.",
        "ASA: two angles and the included side.",
        "Corresponding parts of congruent triangles are equal.",
    ],
    "converse": [
        "Equal slopes and equal runs give equal rises.",
        "SAS: two sides and the included right angle.",
        "Corresponding parts of congruent triangles are equal.",
        "Equal corresponding angles mean the lines are parallel.",
    ],
    "perpendicular": [
        "A rotation preserves length and angle.",
        "A quarter turn sends horizontal to vertical and reverses once.",
        None,
        "Multiply the slopes. Their product is -1.",
    ],
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def slope_tex(num, den):
    sign = "-" if num < 0 else ""
    mag = abs(num)
    if den == 1:
        return f"${sign}{mag}$"
    return f"${sign}\\frac{{{mag}}}{{{den}}}$"


def family_of(prompt):
    if "turned 90" in prompt:
        return "perpendicular"
    if prompt.startswith("Lines l and m are parallel"):
        return "parallel"
    if "lines are parallel" in prompt:
        return "converse"
    raise ValueError("Unrecognized slope proof")


def solve(public):
    prompt = public["prompt"]
    kind = family_of(prompt)
    reasons = list(REASONS[kind])
    if kind == "perpendicular":
        match = re.search(r"run (\d+) and rise (\d+)", prompt)
        require(match is not None, "Missing run and rise")
        run, rise = int(match[1]), int(match[2])
        require(run > 0 and rise > 0 and run != rise, "Legs")
        require(Fraction(rise, run) * Fraction(-run, rise) == -1, "Product is not -1")
        reasons[2] = slope_tex(-run, rise)
    blanks = public["response"]["blanks"]
    require(len(blanks) == len(reasons), "Step count")
    chosen = {}
    for blank, reason in zip(blanks, reasons):
        hits = [o["id"] for o in blank["options"] if o["label"] == reason]
        require(len(hits) == 1, f"Missing reason {reason}")
        others = [o["label"] for o in blank["options"] if o["label"] != reason]
        require(reason not in others, "Key repeated")
        chosen[blank["id"]] = hits[0]
    return json.dumps(chosen, separators=(",", ":"))


def review_problem(problem):
    expected = solve(problem["public"])
    require(problem["answer"] == expected, "Answer disagrees with the proof table")
    require("invent" not in problem["hint"].lower(), "Hint should not discuss inventing")
    return expected


def self_test():
    public = {
        "templateId": "slope-criteria-proof",
        "prompt": "Lines l and m are parallel. Each slope triangle has run 1. Complete the proof that the slopes are equal.",
        "response": {"blanks": [
            {"id": f"s{i + 1}", "options": [{"id": "a", "label": reason}, {"id": "b", "label": "no"}]}
            for i, reason in enumerate(REASONS["parallel"])
        ]},
    }
    require(solve(public).startswith('{"s1":"a"'), "Parallel reasons")
    return "ok"


if __name__ == "__main__":
    print(self_test())
