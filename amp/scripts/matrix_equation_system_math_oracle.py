"""Independent oracle for the HSA.REI.C.8 families (matrix-equation-system).

system-to-matrix-equation: the equations are read from the prompt's TeX and
each is rewritten as (coefficients in the order of X) = constant, keeping the
coefficient of its first written unknown as written (the convention the
rearranged prompts state; aligned equations need no change). The sizes of A,
X and B come from counting the equations and the unknowns of the shown
system.

matrix-equation-reading: the matrix equation is read back as a system (row i
of A times X equals entry i of B). The keyed system or equation is the only
option equivalent to it (up to order and nonzero scaling); the keyed
coefficient is the entry itself; the keyed flaw statement is the only one of
the four whose slip, applied to the correct A and B, gives the student's A
and B exactly; the keyed substitution option is the only one with the right
product AX and the right verdict.

Only the public prompt and options enter `solve`; `review_problem` treats the
answer and the private grading rule as values under test.
"""

import copy
import json
import re
from fractions import Fraction as F

from tex_value_kit import linear, parse, require, sides, tokens_of, value

SUPPORTED = frozenset({"system-to-matrix-equation", "matrix-equation-reading"})
REVIEW_RETURNS_ANSWER = True

MATH = re.compile(r"\$([^$]+)\$")
BMATRIX = re.compile(r"\\begin\{bmatrix\}(.*?)\\end\{bmatrix\}")
CASES = re.compile(r"\\begin\{cases\}(.*?)\\end\{cases\}")
VARS = ("x", "y", "z")


def compact(value_):
    return json.dumps(value_, separators=(",", ":"))


def text_of(q):
    require(q.denominator == 1, f"Not an integer: {q}")
    return str(q.numerator)


def matrix(tex):
    rows = [row for row in tex.split("\\\\")]
    out = []
    for row in rows:
        cells = []
        for cell in row.split("&"):
            cell = cell.strip()
            if re.fullmatch(r"[a-z]", cell):
                cells.append(cell)
            else:
                cells.append(value(parse(cell)))
        out.append(cells)
    return out


def column(tex):
    rows = matrix(tex)
    require(all(len(r) == 1 for r in rows), "Not a column")
    return [r[0] for r in rows]


def unknowns_in(tex):
    return [t for t in tokens_of(tex) if t in VARS]


def equation(tex, names):
    """(coefficients in `names` order, constant) of `left = right`, keeping
    the first written unknown's coefficient as written."""
    parts = sides(tex)
    require(len(parts) == 2, f"Not one equation: {tex}")
    left, right = parts
    coefficients, k0 = linear(("-", left, right), names)
    written = unknowns_in(tex)
    require(written, f"No unknown in {tex}")
    first = written[0]
    left_text = tex.split("=")[0]
    on_left = first in unknowns_in(left_text)
    right_text = tex.split("=", 1)[1]
    require(not (on_left and first in unknowns_in(right_text)), "Unknown on both sides")
    sign = 1 if on_left else -1
    return [sign * c for c in coefficients], sign * -k0


def system(tex, names):
    return [equation(eq, names) for eq in tex.split("\\\\")]


def proportional(p, q):
    if len(p) != len(q):
        return False
    ratio = None
    for a, b in zip(p, q):
        if (a == 0) != (b == 0):
            return False
        if a == 0:
            continue
        if ratio is None:
            ratio = F(b) / F(a)
        elif F(b) / F(a) != ratio:
            return False
    return ratio is not None


def same_system(a, b):
    if len(a) != len(b):
        return False
    left = list(b)
    for eq in a:
        hit = next((i for i, other in enumerate(left) if proportional(eq, other)), None)
        if hit is None:
            return False
        left.pop(hit)
    return True


def flat(eqs):
    return [list(c) + [k] for c, k in eqs]


def option_id(response, predicate):
    hits = [o["id"] for o in response["options"] if predicate(o["label"])]
    require(len(hits) == 1, f"Expected exactly one valid option, found {len(hits)}")
    return hits[0]


# ------------------------------------------------------------- entry type


def solve_entry(public):
    prompt, response = public["prompt"], public["response"]
    require(response["kind"] == "structured-work" and response["mode"] == "build", "Entry is built work")
    rows = response["rows"]
    require(len(rows) == 3 and all(len(r["fields"]) == 2 for r in rows), "Three rows of two fields")
    require(all(f["kind"] == "number" for r in rows for f in r["fields"]), "Number fields")
    if rows[0]["label"].startswith("Size of $A$"):
        require(rows[1]["label"].startswith("Size of $X$") and rows[2]["label"].startswith("Size of $B$"), "Size rows")
        cases = CASES.search(prompt)
        require(cases is not None, "Shown system")
        equations = cases.group(1).split("\\\\")
        names = sorted({v for eq in equations for v in unknowns_in(eq)})
        m, n = len(equations), len(names)
        # Each equation must be linear in those unknowns.
        for eq in equations:
            equation(eq, names)
        return compact([[str(m), str(n)], [str(n), "1"], [str(m), "1"]])
    match = re.search(r"Equation 1 is \$([^$]+)\$ and equation 2 is \$([^$]+)\$", prompt)
    require(match is not None, "Two equations")
    require("X=\\begin{bmatrix}x\\\\y\\end{bmatrix}" in prompt, "X is (x, y)")
    for i, r in enumerate(rows[:2]):
        require(r["label"] == f"Row {i + 1} of $A$: coefficient of $x$, then of $y$", "Row label")
    require(rows[2]["label"] == "$B$: entry 1, then entry 2", "B label")
    eqs = [equation(match.group(k), ["x", "y"]) for k in (1, 2)]
    # The prompt's convention makes A unique: without it a rearranged
    # equation could be scaled by -1.
    rearranged = any(
        not re.fullmatch(r"-?\d*x[-+]\d*y=-?\d+|-?\d*x=-?\d+|-?\d*y=-?\d+", match.group(k).replace(" ", ""))
        for k in (1, 2)
    )
    if rearranged:
        require("keep the coefficient of the first unknown in each equation as written" in prompt,
                "A rearranged equation needs the stated convention")
    return compact([[text_of(c) for c in eqs[0][0]], [text_of(c) for c in eqs[1][0]],
                    [text_of(eqs[0][1]), text_of(eqs[1][1])]])


# ----------------------------------------------------------- reading type

FLAWS = {
    "transposed": "down a column",
    "augmented": "as an extra column",
    "moved-sign": "without changing its sign",
    "constant-sign": "gave a constant the wrong sign",
    "order": "in the order the equation lists them",
    "zero": "left out the 0",
}


def flaw_kind(label):
    kinds = [k for k, phrase in FLAWS.items() if phrase in label]
    require(len(kinds) == 1, f"Unrecognized flaw statement: {label}")
    return kinds[0]


def slips(kind, written, names, A, B):
    """Every (A, B) a student makes from the correct ones by this slip."""
    out = []
    n = len(names)
    if kind == "transposed":
        out.append(([[A[i][j] for i in range(len(A))] for j in range(len(A[0]))], B))
    if kind == "augmented":
        out.append(([row + [B[i]] for i, row in enumerate(A)], B))
    for i, tex in enumerate(written):
        left, right = tex.split("=", 1)
        first = unknowns_in(tex)[0]
        first_left = first in unknowns_in(left)
        far_side = right if first_left else left
        if kind == "moved-sign":
            for v in unknowns_in(far_side):
                j = names.index(v)
                row = list(A[i])
                row[j] = -row[j]
                out.append(([r if k != i else row for k, r in enumerate(A)], B))
        if kind == "constant-sign":
            out.append((A, [b if k != i else -b for k, b in enumerate(B)]))
        if kind == "order":
            order = [v for v in unknowns_in(tex)]
            if sorted(order) == sorted(names) and order != list(names):
                row = [A[i][names.index(v)] for v in order]
                out.append(([r if k != i else row for k, r in enumerate(A)], B))
        if kind == "zero":
            present = set(unknowns_in(tex))
            if len(present) < n:
                kept = [A[i][j] for j in range(n) if names[j] in present]
                row = kept + [F(0)] * (n - len(kept))
                out.append(([r if k != i else row for k, r in enumerate(A)], B))
    return out


def solve_reading(public):
    prompt, response = public["prompt"], public["response"]
    require(response["kind"] == "choice" and len(response["options"]) == 4, "Four choices")
    labels = [o["label"] for o in response["options"]]
    require(len(set(labels)) == 4, "Distinct options")
    mats = BMATRIX.findall(prompt)
    if prompt.startswith("Which system of equations"):
        A, X, B = matrix(mats[0]), column(mats[1]), column(mats[2])
        names = list(X)
        truth = [row + [B[i]] for i, row in enumerate(A)]

        def is_truth(label):
            cases = CASES.search(label)
            require(cases is not None, "A system option")
            return same_system(flat(system(cases.group(1), names)), truth)

        return option_id(response, is_truth)
    one = re.search(r"which equation does row (\d) of \$A\$ stand for\?", prompt)
    if one:
        A, X, B = matrix(mats[0]), column(mats[1]), column(mats[2])
        k = int(one.group(1)) - 1
        truth = A[k] + [B[k]]
        return option_id(response, lambda label: proportional(
            flat([equation(MATH.fullmatch(label).group(1), list(X))])[0], truth))
    coefficient = re.search(r"what is the coefficient of \$([xyz])\$ in equation (\d)\?", prompt)
    if coefficient:
        A, X = matrix(mats[0]), column(mats[1])
        j, i = list(X).index(coefficient.group(1)), int(coefficient.group(2)) - 1
        want = A[i][j]
        return option_id(response, lambda label: value(parse(MATH.fullmatch(label).group(1))) == want)
    if "The student's matrix equation is wrong" in prompt:
        cases = CASES.search(prompt)
        written = cases.group(1).split("\\\\")
        X = column(mats[0])
        names = list(X)
        student_A, student_B = matrix(mats[1]), column(mats[2])
        eqs = system(cases.group(1), names)
        A = [list(c) for c, _ in eqs]
        B = [k for _, k in eqs]
        require((student_A, student_B) != (A, B), "The student's work must be wrong")
        # The student's matrices are not merely a scaled, correct version.
        if len(student_A[0]) == len(names):
            require(not same_system([r + [student_B[i]] for i, r in enumerate(student_A)],
                                    [r + [B[i]] for i, r in enumerate(A)]), "Student work is a valid form")

        def fits(label):
            return any(sa == student_A and sb == student_B
                       for sa, sb in slips(flaw_kind(label), written, names, A, B))

        return option_id(response, fits)
    if "Substitute $X=" in prompt:
        a = re.search(r"\$A=\\begin\{bmatrix\}(.*?)\\end\{bmatrix\}\$", prompt)
        b = re.search(r"\$B=\\begin\{bmatrix\}(.*?)\\end\{bmatrix\}\$", prompt)
        x = re.search(r"Substitute \$X=\\begin\{bmatrix\}(.*?)\\end\{bmatrix\}\$", prompt)
        A, B, X = matrix(a.group(1)), column(b.group(1)), column(x.group(1))
        product = [sum(A[i][j] * X[j] for j in range(len(X))) for i in range(len(A))]
        solves = product == B

        def right(label):
            m = re.fullmatch(r"\$AX=\\begin\{bmatrix\}(.*?)\\end\{bmatrix\}\$, so this \$X\$ (is|is not) a solution\.", label)
            require(m is not None, f"Unread substitution option {label}")
            return column(m.group(1)) == product and (m.group(2) == "is") == solves

        return option_id(response, right)
    raise ValueError("Unknown matrix-equation-reading prompt")


def solve(public):
    if public["templateId"] == "system-to-matrix-equation":
        return solve_entry(public)
    require(public["templateId"] == "matrix-equation-reading", "Unsupported template")
    return solve_reading(public)


def review_problem(problem):
    public = problem["public"]
    expected = solve(public)
    if public["templateId"] == "system-to-matrix-equation":
        grading = problem.get("workGrading")
        require(grading and grading["mode"] == "fields", "Fields grading")
        values = [[rule["value"] for rule in row] for row in grading["fields"]]
        require(compact(values) == expected, "The grading rule disagrees with the system")
    else:
        feedback = problem.get("choiceFeedback") or {}
        for o in public["response"]["options"]:
            if o["id"] != expected:
                require(len(feedback.get(o["id"], "")) > 10, "Every wrong option has feedback")
    return expected


# ------------------------------------------------------------------ fixtures


def self_test():
    entry = {
        "templateId": "system-to-matrix-equation",
        "prompt": "Write this system as one matrix equation $AX=B$ with $X=\\begin{bmatrix}x\\\\y\\end{bmatrix}$. "
                  "Equation 1 is $3=2x-5y$ and equation 2 is $-4y+7x-2=0$. Row 1 of $A$ and entry 1 of $B$ come from "
                  "equation 1; row 2 and entry 2 come from equation 2. Move terms across the equals sign as needed, but "
                  "keep the coefficient of the first unknown in each equation as written.",
        "response": {"kind": "structured-work", "mode": "build", "rows": [
            {"label": "Row 1 of $A$: coefficient of $x$, then of $y$", "fields": [{"kind": "number"}] * 2},
            {"label": "Row 2 of $A$: coefficient of $x$, then of $y$", "fields": [{"kind": "number"}] * 2},
            {"label": "$B$: entry 1, then entry 2", "fields": [{"kind": "number"}] * 2}]},
    }
    require(solve(entry) == '[["2","-5"],["7","-4"],["3","2"]]', "flipped and zero forms")
    unstated = copy.deepcopy(entry)
    unstated["prompt"] = unstated["prompt"].replace(" Move terms across the equals sign as needed, but keep the coefficient of the first unknown in each equation as written.", "")
    try:
        solve(unstated)
    except ValueError:
        pass
    else:
        raise AssertionError("A rearranged system without the convention was accepted")
    reading = {
        "templateId": "matrix-equation-reading",
        "prompt": "Which system of equations does this matrix equation represent? $\\begin{bmatrix}2&3\\\\1&-4\\end{bmatrix}\\begin{bmatrix}x\\\\y\\end{bmatrix}=\\begin{bmatrix}5\\\\6\\end{bmatrix}$",
        "response": {"kind": "choice", "options": [
            {"id": "option-a", "label": "$\\begin{cases}2x+y=5\\\\3x-4y=6\\end{cases}$"},
            {"id": "option-b", "label": "$\\begin{cases}2x+3y=5\\\\x-4y=6\\end{cases}$"},
            {"id": "option-c", "label": "$\\begin{cases}2x+3y=-5\\\\x-4y=-6\\end{cases}$"},
            {"id": "option-d", "label": "$\\begin{cases}3x+2y=5\\\\-4x+y=6\\end{cases}$"}]},
    }
    require(solve(reading) == "option-b", "which system")
    two = copy.deepcopy(reading)
    two["response"]["options"][0]["label"] = "$\\begin{cases}4x+6y=10\\\\x-4y=6\\end{cases}$"
    try:
        solve(two)
    except ValueError:
        pass
    else:
        raise AssertionError("Two equivalent systems accepted")
    flaw = {
        "templateId": "matrix-equation-reading",
        "prompt": "A student wrote the system $\\begin{cases}8x=8-y\\\\-4x+11=-4y\\end{cases}$ as $AX=B$ with $X=\\begin{bmatrix}x\\\\y\\end{bmatrix}$, using $A=\\begin{bmatrix}8&-1\\\\-4&4\\end{bmatrix}$ and $B=\\begin{bmatrix}8\\\\-11\\end{bmatrix}$. The student's matrix equation is wrong. What did the student do?",
        "response": {"kind": "choice", "options": [
            {"id": "option-a", "label": "They wrote each equation's coefficients down a column of $A$ instead of across a row."},
            {"id": "option-b", "label": "They moved an unknown's term across the equals sign without changing its sign."},
            {"id": "option-c", "label": "They gave a constant the wrong sign: it changes sign only when it crosses the equals sign."},
            {"id": "option-d", "label": "They put the constants into $A$ as an extra column."}]},
    }
    require(solve(flaw) == "option-b", "moved sign")
    sub = {
        "templateId": "matrix-equation-reading",
        "prompt": "The system with $A=\\begin{bmatrix}2&6\\\\-6&-9\\end{bmatrix}$ and $B=\\begin{bmatrix}10\\\\-12\\end{bmatrix}$ is $AX=B$ with $X=\\begin{bmatrix}x\\\\y\\end{bmatrix}$. Substitute $X=\\begin{bmatrix}-2\\\\2\\end{bmatrix}$: multiply out $AX$ and decide whether this $X$ is a solution.",
        "response": {"kind": "choice", "options": [
            {"id": "option-a", "label": "$AX=\\begin{bmatrix}-4\\\\-18\\end{bmatrix}$, so this $X$ is not a solution."},
            {"id": "option-b", "label": "$AX=\\begin{bmatrix}8\\\\-6\\end{bmatrix}$, so this $X$ is a solution."},
            {"id": "option-c", "label": "$AX=\\begin{bmatrix}8\\\\-6\\end{bmatrix}$, so this $X$ is not a solution."},
            {"id": "option-d", "label": "$AX=\\begin{bmatrix}-16\\\\-30\\end{bmatrix}$, so this $X$ is not a solution."}]},
    }
    require(solve(sub) == "option-c", "substitution")
