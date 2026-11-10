"""Independent peg geometry review using rational segment parameters.

The public prompt supplies the task; the submitted key is only a candidate.
No TypeScript grader or private generator recipe is imported.
"""
import copy
import itertools
import json
import re
from fractions import Fraction

SUPPORTED = {"build-shape-sticks-balls", "build-shape-by-count", "copy-peg-shape"}
CHOICE_REVIEW = SUPPORTED
REVIEW_RETURNS_ANSWER = True


def pt(i):
    return i % 5, i // 5


def length(a, b):
    return sum((x-y)**2 for x, y in zip(a, b))


def area(points):
    return sum(a[0]*b[1]-a[1]*b[0] for a, b in zip(points, points[1:]+points[:1]))


def ordered(sticks):
    edges = {tuple(sorted(s)) for s in sticks}
    assert len(edges) == len(sticks) and all(a != b for a, b in edges)
    nodes = set(itertools.chain.from_iterable(edges))
    assert len(nodes) >= 3 and all(sum(v in e for e in edges) == 2 for v in nodes), "Not a cycle"
    result = [min(nodes)]
    while edges:
        edge = next((e for e in edges if result[-1] in e), None)
        assert edge is not None, "Disconnected loops"
        edges.remove(edge)
        result.append(edge[1] if edge[0] == result[-1] else edge[0])
    assert result[0] == result.pop() and len(set(result)) == len(result)
    return result


def crossing(a, b, c, d):
    u = (b[0]-a[0], b[1]-a[1])
    v = (d[0]-c[0], d[1]-c[1])
    w = (c[0]-a[0], c[1]-a[1])
    determinant = u[1]*v[0]-u[0]*v[1]
    if determinant:
        t = Fraction(w[1]*v[0]-w[0]*v[1], determinant)
        s = Fraction(u[0]*w[1]-u[1]*w[0], determinant)
        return 0 <= t <= 1 and 0 <= s <= 1
    if u[0]*w[1] != u[1]*w[0]:
        return False
    axis = 0 if u[0] else 1
    return max(min(a[axis], b[axis]), min(c[axis], d[axis])) <= min(max(a[axis], b[axis]), max(c[axis], d[axis]))


def matches(points, target, rotate):
    for sequence in (points, points[::-1]):
        for i in range(len(sequence)):
            candidate = sequence[i:]+sequence[:i]
            if not rotate:
                if all((a[0]-candidate[0][0], a[1]-candidate[0][1]) == (b[0]-target[0][0], b[1]-target[0][1]) for a, b in zip(candidate, target)):
                    return True
            elif area(candidate)*area(target) > 0 and all(length(candidate[i], candidate[j]) == length(target[i], target[j]) for i in range(len(target)) for j in range(len(target))):
                return True
    return False


def validate(public, sticks):
    r = public["response"]
    assert all(type(v) is int and 0 <= v < 25 for v in itertools.chain.from_iterable(sticks))
    assert all(tuple(sorted(g)) in {tuple(sorted(s)) for s in sticks} for g in r["given"])
    ids = ordered(sticks)
    points = [pt(i) for i in ids]
    n = len(points)
    for i, b in enumerate(points):
        a, c = points[i-1], points[(i+1) % n]
        assert (b[0]-a[0])*(c[1]-b[1]) != (b[1]-a[1])*(c[0]-b[0]), "Straight-through corner"
        for j in range(i+2, n):
            if i == 0 and j == n-1:
                continue
            assert not crossing(b, c, points[j], points[(j+1) % n]), "Crossing sides"
    prompt = public["prompt"]
    name = next((s for s in ("triangle", "square", "rectangle", "hexagon") if re.search(r"\b"+s+r"\b", prompt)), None)
    count = re.search(r"with (\d+) (?:sides|corners)", prompt)
    expected = int(count[1]) if count else {"triangle": 3, "square": 4, "rectangle": 4, "hexagon": 6}.get(name)
    if public["templateId"] == "copy-peg-shape":
        target = [pt(i) for i in r["copy"]["pegs"]]
        expected = len(target)
        assert r["copy"]["allowRotation"] == ("You may turn it." in prompt)
        assert n == expected and matches(points, target, r["copy"]["allowRotation"]), "Copy does not match"
    assert expected == n == r["check"]["sides"], "Wrong count"
    assert bool(r["check"].get("rightCorners")) == (name in ("square", "rectangle"))
    assert bool(r["check"].get("equalSides")) == (name == "square")
    if name in ("square", "rectangle"):
        # At a square corner, Pythagoras holds for the adjacent sides and diagonal.
        for i in range(4):
            a, b, c = points[i-1], points[i], points[(i+1) % 4]
            assert length(a, b)+length(b, c) == length(a, c), "Not a square corner"
    if name == "square":
        assert len({length(points[i], points[(i+1) % 4]) for i in range(4)}) == 1


def encode(ids):
    return json.dumps({"sticks": sorted([sorted([a, b]) for a, b in zip(ids, ids[1:]+ids[:1])])}, separators=(",", ":"))


def solve(public):
    r = public["response"]
    if "copy" in r:
        return encode(r["copy"]["pegs"])
    n = r["check"]["sides"]
    if n in (5, 6):
        return encode([1, 3, 14, 23, 21, 10] if n == 6 else [1, 3, 14, 22, 10])
    # Enumerate triangles; derive the fourth vertex of rectangles from three.
    for first in itertools.permutations(range(25), 3):
        ids = list(first)
        if n == 4:
            a, b, c = map(pt, first)
            x, y = a[0]+c[0]-b[0], a[1]+c[1]-b[1]
            if not (0 <= x < 5 and 0 <= y < 5):
                continue
            ids.append(y*5+x)
        key = encode(ids)
        try:
            validate(public, json.loads(key)["sticks"])
        except AssertionError:
            continue
        return key
    raise AssertionError("No solution")


def review_problem(problem):
    public = problem["public"]
    assert public["response"]["grid"] == {"cols": 5, "rows": 5}
    validate(public, json.loads(problem["answer"])["sticks"])
    assert 0 < public["response"]["guessChance"] < .25
    return problem["answer"]


def self_test():
    assert crossing((0, 0), (4, 4), (0, 4), (4, 0))
    assert not crossing((0, 0), (4, 0), (0, 4), (4, 4))
    assert crossing((0, 0), (4, 0), (2, 0), (3, 0))
    assert matches([(1, 1), (3, 1), (1, 2)], [(0, 0), (2, 0), (0, 1)], False)
    assert not matches([(0, 0), (0, 2), (1, 0)], [(0, 0), (2, 0), (0, 1)], True)
    return 5


if __name__ == "__main__":
    import sys
    self_test()
    problems = [json.loads(line) for line in sys.stdin if line.strip()]
    for p in problems:
        review_problem(p)
        broken = copy.deepcopy(p)
        a = json.loads(broken["answer"])
        a["sticks"].pop()
        broken["answer"] = json.dumps(a)
        try:
            review_problem(broken)
        except AssertionError:
            pass
        else:
            raise AssertionError("Open shape accepted")
    print(f"Verified {len(problems)} builds and {len(problems)} corrupted keys")
