"""Independent whole-unit line-plot oracle: read public data, never the key."""
import copy
import json
import math
import re
from collections import Counter

SUPPORTED = {"line-plot-build"}
CHOICE_REVIEW = SUPPORTED
REVIEW_RETURNS_ANSWER = True


def measurements(public):
    elements = public.get("figure", {}).get("scene", {}).get("elements", [])
    tables = [e for e in elements if e["type"] == "lineTable"]
    bars = [e for e in elements if e["type"] == "ruler"]
    if tables:
        return [int(row[1]) for row in tables[0]["rows"][1:]]
    if bars:
        return [math.floor((e["object"]["to"] - e["object"]["from"]) / e["parts"] + 0.5) for e in bars]
    data = re.search(r": ([\d, ]+) (centimeters|inches)\.", public["prompt"])
    assert data, "Missing measurement source"
    return [int(v) for v in data[1].split(", ")]


def solve(public):
    values = measurements(public)
    return json.dumps({"counts": {str(v): c for v, c in sorted(Counter(values).items())}}, separators=(",", ":"))


def review_problem(problem):
    public = problem["public"]
    response = public["response"]
    assert response["kind"] == "line-plot-build"
    values = measurements(public)
    measure = public["prompt"].startswith("Measure these")
    assert (4 if measure else 5) <= len(values) <= (6 if measure else 9)
    assert max(Counter(values).values()) <= 4
    assert max(Counter(values).values()) >= 2
    assert response["maxPerValue"] == 6 and response["marker"] == "x"
    assert response["measurementCount"] == len(values)
    axis = response["axis"]
    assert axis["min"] == max(0, min(values) - 1)
    assert axis["max"] == max(values) + 1
    assert 5 <= axis["max"] - axis["min"] + 1 <= 8
    assert min(values) >= 1 and max(values) <= (20 if axis["unit"] == "centimeters" else 12)
    result = solve(public)
    assert problem["answer"] == result, "Count map differs from public measurements"
    if "same " in public["prompt"]:
        counts = Counter(values)
        center = (min(values) + max(values)) // 2
        assert max(values) - min(values) == 2
        assert counts[center] > max(counts[center - 1], counts[center + 1])
    if measure:
        for e in public["figure"]["scene"]["elements"]:
            if e["type"] == "ruler":
                assert e["object"]["from"] / e["parts"] in (0, 1, 2, 3)
                assert round(e["object"]["to"] / e["parts"] % 1, 1) in (0, .2, .3, .7, .8, 1)
    return result


def self_test():
    fixture = {"public": {"prompt": "5 ribbons were measured: 3, 5, 3, 6, 5 centimeters.",
        "response": {"kind": "line-plot-build", "axis": {"min": 2, "max": 7, "unit": "centimeters"},
                     "marker": "x", "maxPerValue": 6, "measurementCount": 5}},
        "answer": '{"counts":{"3":2,"5":2,"6":1}}'}
    assert review_problem(fixture) == fixture["answer"]
    for field, corrupt in (("answer", '{"counts":{"3":1,"5":2,"6":1}}'),
                           ("prompt", "5 ribbons were measured: 4, 5, 3, 6, 5 centimeters."),
                           ("axis", {"min": 3, "max": 7, "unit": "centimeters"})):
        bad = copy.deepcopy(fixture)
        if field == "answer": bad[field] = corrupt
        elif field == "prompt": bad["public"][field] = corrupt
        else: bad["public"]["response"][field] = corrupt
        try: review_problem(bad)
        except AssertionError: pass
        else: raise AssertionError(f"Accepted corrupted {field}")
    return {"fixtures": 1, "mutations": 3}
