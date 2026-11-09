"""Independent answers for the multiplication and division clause templates.

The answer is recomputed from the public prompt and, for a figure, from marks
that are already drawn. problem['answer'] is only the value under test.
"""
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def require(condition, message):
    if not condition:
        raise ValueError(message)


def nums(text):
    return [int(n.replace(",", "")) for n in re.findall(r"\d[\d,]*", text)]


def cells(values):
    rows = []
    i = 0
    # Paired fields, with a final single cell when the count is odd.
    while i < len(values):
        if i == len(values) - 1 or (len(values) % 2 == 1 and i == len(values) - 1):
            rows.append([str(values[i])])
            i += 1
        else:
            # The generators pair every row except a possible last singleton.
            # Callers that need a custom shape pass rows directly.
            rows.append([str(values[i]), str(values[i + 1])])
            i += 2
    return json.dumps(rows)


def bracket_cells(n, d):
    steps = []
    acc = 0
    started = False
    for ch in str(n):
        acc = acc * 10 + int(ch)
        digit = acc // d
        if not started and digit == 0:
            continue
        started = True
        product = digit * d
        diff = acc - product
        require(0 <= diff < d, "difference is not smaller than the divisor")
        steps.append((digit, product, diff))
        acc = diff
    require(len(steps) == 3, "expected a three-digit quotient")
    out = []
    for i, (digit, product, diff) in enumerate(steps):
        out.extend([digit, product, diff])
        if i < len(steps) - 1:
            nxt = steps[i + 1]
            out.append(nxt[1] + nxt[2])
    q = out[0] * 100 + out[4] * 10 + out[8]
    require(d * q + out[10] == n, "cells do not rebuild the dividend")
    return out


def chunks(n, d, places):
    rest = n
    out = []
    for p in range(places - 1, -1, -1):
        unit = 10**p
        digit = rest // (d * unit)
        width = digit * unit
        area = width * d
        out.append((width, area))
        rest -= area
    return out, rest


def solve(public):
    template = public["templateId"]
    prompt = public["prompt"]
    if template == "bracket-steps":
        m = re.search(r"([\d,]+) ÷ (\d+)", prompt)
        require(m is not None, "no division")
        n, d = int(m[1].replace(",", "")), int(m[2])
        values = bracket_cells(n, d)
        # 11 cells: five pairs and a final difference.
        rows = [
            [str(values[0]), str(values[1])],
            [str(values[2]), str(values[3])],
            [str(values[4]), str(values[5])],
            [str(values[6]), str(values[7])],
            [str(values[8]), str(values[9])],
            [str(values[10])],
        ]
        return json.dumps(rows)
    if template == "standard-algorithm-rows":
        m = re.search(r"([\d,]+) × (\d+)", prompt)
        require(m is not None, "no product")
        a, b = int(m[1].replace(",", "")), int(m[2])
        ones, tens = b % 10, b // 10 * 10
        return json.dumps([[str(a * ones)], [str(a * tens)], [str(a * b)]])
    if template == "partial-products-by-place":
        m = re.match(
            r"([\d,]+) × (\d+) = \(([\d,]+) × \d+\) \+ \(([\d,]+) × \d+\) \+ \((\d+) × \d+\) \+ \((\d+) × \d+\)",
            prompt,
        )
        require(m is not None, "no partials")
        factor = int(m[2])
        places = [int(m[i].replace(",", "")) for i in range(3, 7)]
        parts = [p * factor for p in places]
        require(sum(places) * factor == sum(parts), "partials disagree")
        return json.dumps(
            [[str(parts[0]), str(parts[1])], [str(parts[2]), str(parts[3])], [str(sum(parts))]]
        )
    if template == "complete-area-model":
        m = re.search(r"(\d+) × (\d+)", prompt)
        require(m is not None, "no area product")
        a, b = int(m[1]), int(m[2])
        at, ao = a // 10 * 10, a % 10
        bt, bo = b // 10 * 10, b % 10
        parts = [at * bt, at * bo, ao * bt, ao * bo]
        require(sum(parts) == a * b, "parts miss the product")
        return json.dumps([[str(parts[0]), str(parts[1])], [str(parts[2]), str(parts[3])], [str(a * b)]])
    if template == "regions-to-whole":
        m = re.search(r"find (\d+) × (\d+)", prompt)
        require(m is not None, "no array")
        rows, cols = int(m[1]), int(m[2])
        found = re.findall(r"(\d+) × (\d+) = __", prompt)
        require(len(found) >= 2, "regions not named")
        a = int(found[0][0]) * int(found[0][1])
        b = int(found[1][0]) * int(found[1][1])
        require(a + b == rows * cols, "regions do not make the product")
        return json.dumps([[str(a), str(b)], [str(a), str(b)], [str(rows * cols)]])
    if template == "split-the-dividend":
        m = re.match(r"(\d+) ÷ (\d+): split \d+ into (\d+) \+ (\d+)", prompt)
        require(m is not None, "no split")
        n, d, left, right = (int(m[i]) for i in range(1, 5))
        require(left + right == n and left % d == 0 and right % d == 0, "split is not exact")
        q1, q2 = left // d, right // d
        return json.dumps([[str(q1), str(q2)], [str(q1 + q2)]])
    if template == "associative-compute":
        m = re.match(r"(\d+) × (\d+) × (\d+)", prompt)
        require(m is not None, "no triple")
        a, b, c = int(m[1]), int(m[2]), int(m[3])
        return json.dumps([[str(a * b), str(a * b * c)], [str(b * c), str(a * b * c)]])
    if template == "partition-from-marks":
        figure = public.get("figure")
        require(figure and figure["kind"] == "scene", "marks required")
        ids = [e.get("id", "") for e in figure["scene"]["elements"]]
        rows = sum(1 for i in ids if i.startswith("left-"))
        cols = sum(1 for i in ids if i.startswith("top-"))
        require(rows >= 2 and cols >= 2, "marks")
        return json.dumps([[str(rows), str(cols)], [str(rows * cols)]])
    if template in ("complete-division-model", "chunk-model"):
        m = re.search(r"([\d,]+) ÷ (\d+)", prompt)
        require(m is not None, "no quotient")
        n, d = int(m[1].replace(",", "")), int(m[2])
        q, rem = divmod(n, d)
        places = 3 if q >= 100 else 2
        parts, left = chunks(n, d, places)
        require(left == rem and sum(w for w, _ in parts) == q, "chunks disagree")
        if template == "chunk-model" and "tens width (0" in prompt:
            h, t, o = parts
            require(t[0] == 0, "tens width is not 0")
            values = [h[0], h[1], 0, o[0], o[1], rem]
            return json.dumps([[str(values[0]), str(values[1])], [str(values[2]), str(values[3])], [str(values[4]), str(values[5])]])
        flat = [x for part in parts for x in part]
        if rem:
            flat.extend([q, rem])
            rows = [flat[i : i + 2] for i in range(0, len(flat) - 2, 2)]
            rows.append(flat[-2:])
        else:
            flat.append(q)
            rows = [flat[i : i + 2] for i in range(0, len(flat) - 1, 2)]
            rows.append([flat[-1]])
        return json.dumps([[str(x) for x in row] for row in rows])
    if template == "list-all-pairs":
        m = re.search(r"factor pair of (\d+)", prompt)
        require(m is not None, "no n")
        n = int(m[1])
        pairs = [[i, n // i] for i in range(1, int(n**0.5) + 1) if n % i == 0]
        return json.dumps([[str(a), str(b)] for a, b in pairs])
    if public["response"]["kind"] == "choice":
        return solve_choice(template, prompt, public["response"]["options"])
    if public["response"]["kind"] == "multi-select":
        return solve_multi(template, prompt, public["response"])
    if public["response"]["kind"] == "figure-choice":
        return solve_figure(prompt, public["response"]["options"])
    raise ValueError("no solver for " + template)


def truth_of_fact(label):
    if "÷" in label:
        left, right = label.split(" = ")
        a, b = [int(x) for x in left.split(" ÷ ")]
        return a // b == int(right) and a % b == 0
    left, right = label.split(" = ")
    a, b = [int(x) for x in left.split(" × ")]
    return a * b == int(right)


def solve_choice(template, prompt, options):
    labels = [(o["id"], o["label"]) for o in options]
    if template == "which-split":
        m = re.search(r"(\d+) × (\d+)", prompt)
        rows, cols = int(m[1]), int(m[2])
        good = []
        for oid, label in labels:
            parts = re.findall(r"(\d+) × (\d+)", label)
            if len(parts) == 2:
                total = sum(int(a) * int(b) for a, b in parts)
                sides = {int(a) for a, b in parts} | {int(b) for a, b in parts}
                if total == rows * cols and rows in {int(a) for a, _ in [(p[0], p[1]) for p in parts]} and all(
                    int(p[0]) == rows for p in parts
                ):
                    good.append(oid)
            elif "then add" in label:
                continue
        return only(good)
    if template == "explain-part":
        m = re.search(r"(\d+) and (\d+) across, and (\d+) and (\d+) down", prompt)
        require(m is not None, "no splits")
        at, bt = int(m[1]), int(m[3])
        want = f"{at} × {bt}"
        return only([oid for oid, label in labels if label == want])
    if template == "first-chunk-choice":
        m = re.search(r"([\d,]+) ÷ (\d+)", prompt)
        n, d = int(m[1].replace(",", "")), int(m[2])
        q = n // d
        width = q // 10 * 10
        require(d * width <= n < d * (width + 10), "width")
        return only([oid for oid, label in labels if label == str(width)])
    if template == "find-the-error":
        if "tens row" in prompt and "ones row" in prompt:
            m = re.search(r"(\d+) × (\d+) as ([\d,]+) on the ones row, ([\d,]+) on the tens row", prompt)
            a, b = int(m[1]), int(m[2])
            unshifted = int(m[4].replace(",", ""))
            shifted = a * (b // 10 * 10)
            return only([oid for oid, label in labels if str(shifted).replace(",", "") in label.replace(",", "") or f"{shifted:,}" in label])
        m = re.search(r"([\d,]+) × (\d+)", prompt)
        n, d = int(m[1].replace(",", "")), int(m[2])
        ones = n % 10
        carry = (ones * d) // 10
        tens = (n // 10) % 10
        needle = f"{tens} × {d} + {carry}"
        return only([oid for oid, label in labels if needle in label])
    if template == "spot-the-error":
        m = re.search(r"([\d,]+) ÷ (\d+) is shown as (\d+) R (\d+)", prompt)
        n, d, shown_q, shown_r = int(m[1].replace(",", "")), int(m[2]), int(m[3]), int(m[4])
        q, rem = divmod(n, d)
        if shown_r >= d:
            needle = f"{q} R {rem}"
            return only([oid for oid, label in labels if needle in label and "bigger" in label])
        needle = f"{q} R {rem}"
        return only([oid for oid, label in labels if needle in label and "needs a 0" in label])
    if template == "complete-list-choice":
        m = re.search(r"factor pairs of (\d+)", prompt)
        n = int(m[1])
        pairs = [f"{i} × {n // i}" for i in range(1, int(n**0.5) + 1) if n % i == 0]
        want = ", ".join(pairs)
        return only([oid for oid, label in labels if label == want])
    if template == "story-for-expression":
        if "Which expression matches" in prompt:
            m = re.search(r"(\d+) .+ (\d+)", prompt)
            # The story's first two numbers are total and divisor, in that order.
            found = nums(prompt)
            require(len(found) >= 2, "story numbers")
            total, div = found[0], found[1]
            want = f"{total} ÷ {div}"
            return only([oid for oid, label in labels if label == want])
        if "×" in prompt.split("?")[0]:
            m = re.search(r"(\d+) × (\d+)", prompt)
            groups, each = int(m[1]), int(m[2])
            return only([oid for oid, label in labels if label.startswith(f"{groups} groups of {each} ")])
        m = re.search(r"(\d+) ÷ (\d+)", prompt)
        total, div = int(m[1]), int(m[2])
        good = []
        for oid, label in labels:
            found = nums(label)
            if found[:2] == [total, div] and ("shared equally" in label or " in " in label and "of" in label) and "given away" not in label and "in each" not in label:
                good.append(oid)
        return only(good)
    if template == "division-area-model":
        m = re.search(r"([\d,]+) ÷ (\d+)", prompt)
        n, d = int(m[1].replace(",", "")), int(m[2])
        width = nums(prompt)[2]
        nxt = nums(prompt)[3]
        require(d * nxt > n >= d * width, "chunk")
        return only([
            oid for oid, label in labels
            if label.startswith(f"{d} × {nxt:,}") or label.startswith(f"{d} × {nxt}")
        ])
    raise ValueError("no choice solver " + template)


def solve_multi(template, prompt, response):
    options = response["options"]
    if template == "facts-from-known":
        ids = [o["id"] for o in options if truth_of_fact(o["label"])]
        require(len(ids) == response["selectionCount"], "selection count")
        return json.dumps(sorted(ids))
    if template == "story-both-interpretations":
        m = re.search(r"(\d+) ÷ (\d+)", prompt)
        total, div = int(m[1]), int(m[2])
        ids = []
        for o in options:
            found = nums(o["label"])
            share = "shared equally" in o["label"] and found[:2] == [total, div]
            group = " in " in o["label"] and "of" in o["label"] and "in each" not in o["label"] and found[:2] == [total, div]
            if share or group:
                ids.append(o["id"])
        require(len(ids) == 2, "both interpretations")
        return json.dumps(sorted(ids))
    raise ValueError(template)


def solve_figure(prompt, options):
    m = re.search(r"(\d+) rows and (\d+) columns", prompt)
    rows, cols = int(m[1]), int(m[2])
    needle = f"{rows} rows and {cols} columns of equal squares filling"
    return only([o["id"] for o in options if o["label"].startswith(needle)])


def only(ids):
    require(len(ids) == 1, f"expected one key, got {ids}")
    return ids[0]


def canon(value):
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return value


def review(problem):
    got = solve(problem["public"])
    require(
        canon(got) == canon(problem["answer"]),
        f"{problem['public']['templateId']}: {got} != {problem['answer']}",
    )
    return got


def self_test():
    require(bracket_cells(15312, 48) == [3, 144, 9, 91, 1, 48, 43, 432, 9, 432, 0], "15312")
    require(bracket_cells(18672, 62) == [3, 186, 0, 7, 0, 0, 7, 72, 1, 62, 10], "18672")
    # A difference at least as large as the divisor is not a cell of the key.
    require(all(cell < 48 for cell in (9, 43, 0)), "15312 differences")
    script = r"""
import { writeFileSync } from "node:fs";
import { generateProblem } from "./src/math/engine.ts";
const ids = ["partition-from-marks","choose-partition","regions-to-whole","which-split","facts-from-known","associative-compute","split-the-dividend","complete-area-model","explain-part","partial-products-by-place","standard-algorithm-rows","find-the-error","complete-division-model","chunk-model","first-chunk-choice","list-all-pairs","complete-list-choice","bracket-steps","spot-the-error","story-for-expression","story-both-interpretations","division-area-model"];
const out = [];
for (const id of ids) {
  for (let i = 0; i < 25; i++) {
    const p = generateProblem(id, "oracle-"+i);
    if (id === "division-area-model" && !p.public.prompt.includes("Why?")) continue;
    out.push({answer: p.answer, public: p.public});
  }
}
writeFileSync("/tmp/multiplication-clause-oracle.json", JSON.stringify(out));
"""
    subprocess.check_call(["node", "--import", "tsx", "-e", script], cwd=ROOT)
    problems = json.loads(Path("/tmp/multiplication-clause-oracle.json").read_text())
    for problem in problems:
        review(problem)
    # 5052 is not the tens row of 842 × 69.
    standard = next(p for p in problems if "842 × 69" in p["public"]["prompt"])
    require(json.loads(standard["answer"])[1] == ["50520"], "tens row")
    return {"checked": len(problems)}


if __name__ == "__main__":
    print(self_test())
