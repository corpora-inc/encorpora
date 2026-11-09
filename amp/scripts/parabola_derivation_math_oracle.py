"""Independent oracle for the HSG.GPE.A.2 families (parabola-derivation).

The focus and directrix are read from the prompt. The parabola is the set of
points as far from the focus as from the directrix; with p half the signed
gap from the directrix to the focus and the vertex halfway between them, its
points are generated exactly and every printed line (an equation in x and y,
read from its TeX) is tested on them:

* a line of a correct derivation holds at every point of the parabola and at
  no point off it, and has the form its step names (the equal-distance
  equation, no root or absolute value after squaring, no square of the axis
  variable after cancelling, a factored right side);
* a step follows from the line above when both sides' difference is the same
  function (expanding, moving terms, factoring) or the square of the line
  above (squaring both sides);
* a stated mistake is right only when the wrong line really shows that slip
  (the wrong axis, a swapped focus and directrix, a split root, one side
  squared, a lost middle term, a sign kept on a moved term, the whole gap as
  4p, the wrong bracket);
* a point is on the parabola exactly when its two distances are equal, and a
  complete explanation computes both correctly and compares them.

Only the public prompt and options enter `solve`.
"""

import json
import re
from fractions import Fraction as F

from tex_value_kit import parse, require, same, sides, value

SUPPORTED = frozenset({
    "parabola-derive-equation",
    "parabola-derivation-check",
    "parabola-point-equidistance",
})
REVIEW_RETURNS_ANSWER = True

MATH = re.compile(r"\$([^$]+)\$")
NUM = r"-?\d+(?:\.\d+)?"


def compact(value_):
    return json.dumps(value_, separators=(",", ":"))


class Setup:
    """Focus (fx, fy) and directrix u = c, with u the axis variable."""

    def __init__(self, prompt):
        m = re.search(rf"focus \$F\(({NUM}), ({NUM})\)\$ and directrix \$([xy])=({NUM})\$", prompt)
        require(m is not None, "Unread focus and directrix")
        self.fx, self.fy, self.c = F(m.group(1)), F(m.group(2)), F(m.group(4))
        self.u = "y" if m.group(3) == "y" else "x"
        self.w = "x" if self.u == "y" else "y"
        self.F = self.fy if self.u == "y" else self.fx
        self.f = self.fx if self.u == "y" else self.fy
        require(self.F != self.c, "The focus is not on the directrix")
        self.p = (self.F - self.c) / 2
        self.k = (self.F + self.c) / 2

    def point(self, w, u):
        return {self.w: w, self.u: u}

    def on(self):
        return [self.point(self.f + s, self.k + s * s / (4 * self.p)) for s in (F(-3), F(-2), F(-1), F(1), F(2), F(5, 2), F(3))]

    def off(self):
        return [self.point(self.f + s, self.k + s * s / (4 * self.p) + d) for s in (F(-2), F(1), F(3)) for d in (F(1), F(-1, 3))]

    def grid(self):
        return [{"x": F(a, 3), "y": F(b, 7)} for a in (-7, -2, 4, 11) for b in (-9, 3, 13)]

    def vertex(self):
        return (self.f, self.k) if self.u == "y" else (self.k, self.f)

    def focus(self):
        return (self.fx, self.fy)


def eq_sides(tex):
    parts = sides(tex)
    require(len(parts) == 2, f"Not one equation: {tex}")
    return parts


def holds(parts, env):
    try:
        return same(value(parts[0], env), value(parts[1], env))
    except ValueError:
        return False


def correct(tex, s):
    parts = eq_sides(tex)
    return all(holds(parts, e) for e in s.on()) and not any(holds(parts, e) for e in s.off())


def g(parts, env):
    return value(parts[0], env) - value(parts[1], env)


def identical(a, b, s):
    return all(same(g(a, e), g(b, e)) for e in s.grid())


def squared(a, b, s):
    """b's difference is the difference of the squares of a's sides."""
    return all(same(value(a[0], e) ** 2 - value(a[1], e) ** 2, g(b, e)) for e in s.grid())


def same_function(x_tex, y_tex, s):
    a, b = parse(x_tex), parse(y_tex)
    return all(same(value(a, e), value(b, e)) for e in s.grid())


def form_of(tex, s):
    """The written shape of a line: which step could produce it."""
    left, right = tex.split("=", 1)
    if "\\sqrt" in left and "|" in right:
        return "distance"
    if "\\sqrt" in tex or "|" in tex:
        return "other"
    if f"{s.u}^2" in tex:
        return "expanded"
    if re.fullmatch(rf"-?(?:\d+(?:\.\d+)?)?\({s.u}[-+]\d+(?:\.\d+)?\)|-?(?:\d+(?:\.\d+)?)?{s.u}", right):
        return "factored"
    return "collected"


# --------------------------------------------------------- derive equation


def solve_derive(public):
    s = Setup(public["prompt"])
    response = public["response"]
    require(response["kind"] == "multi-part-choice", "Multi-part")
    key = {}
    for blank in response["blanks"]:
        label = blank["label"]
        if label.startswith("From Line 3: $p$ and the vertex"):
            def right(text):
                m = re.fullmatch(rf"\$p=({NUM})\$, vertex \$\(({NUM}), ({NUM})\)\$", text)
                require(m is not None, f"Unread p and vertex {text}")
                return F(m.group(1)) == s.p and (F(m.group(2)), F(m.group(3))) == s.vertex()
        else:
            want = {"Line 1": "distance", "Line 2": "squared", "Line 3": "collected", "Line 4": "factored"}[label.split(":")[0]]

            def right(text, want=want):
                tex = MATH.fullmatch(text).group(1)
                if not correct(tex, s):
                    return False
                shape = form_of(tex, s)
                if want == "squared":
                    return shape in ("expanded", "collected", "factored") and "^2" in tex.split("=")[1]
                return shape == want
        hits = [o["id"] for o in blank["options"] if right(o["label"])]
        require(len(hits) == 1, f"{label}: {len(hits)} valid options")
        key[blank["id"]] = hits[0]
    return compact(key)


# ---------------------------------------------------------- check derivation


def lines_of(prompt):
    array = re.search(r"\\begin\{array\}\{rl\}(.*?)\\end\{array\}", prompt)
    require(array is not None, "No derivation shown")
    rows = array.group(1).split("\\\\")
    out = []
    for i, row in enumerate(rows):
        m = re.fullmatch(rf"\\text\{{Line {i + 1}:\}}&(.+)", row)
        require(m is not None, f"Unread line {row}")
        out.append(m.group(1))
    require(len(out) == 5, "Five lines")
    return out


def follows(prev, nxt, s):
    a, b = eq_sides(prev), eq_sides(nxt)
    return identical(a, b, s) or ("\\sqrt" in prev and "\\sqrt" not in nxt and squared(a, b, s))


def first_wrong(lines, s):
    for i, line in enumerate(lines):
        if not correct(line, s):
            return i + 1
    return None


def mistake_fits(text, lines, wrong, s):
    """Whether the stated mistake is the slip the first wrong line shows."""
    line = lines[wrong - 1]
    left, right = line.split("=", 1)
    spans = MATH.findall(text)
    u, w = s.u, s.w
    if text.startswith("The drop to"):
        drop, written, should = spans
        return (wrong == 1 and same_function(written, right, s) and same_function(should, f"|{u}-({s.c})|", s)
                and not same_function(written, should, s))
    if text.startswith("Focus and directrix were swapped"):
        held, true = spans
        m = re.fullmatch(rf"\(({NUM}), ({NUM})\)", held)
        t = re.fullmatch(rf"\(({NUM}), ({NUM})\)", true)
        if wrong != 1 or not m or not t:
            return False
        px, py = F(m.group(1)), F(m.group(2))
        swapped = (s.f, s.c) if u == "y" else (s.c, s.f)
        radicand = re.fullmatch(r"\\sqrt\{(.+)\}", left)
        return ((px, py) == swapped and (F(t.group(1)), F(t.group(2))) == s.focus() and radicand is not None
                and same_function(radicand.group(1), f"(x-({px}))^2+(y-({py}))^2", s))
    if text.startswith("The root was split"):
        return wrong == 2 and "^2" not in line and "\\sqrt" not in line
    if text.startswith("Only the left side was squared"):
        (should,) = spans
        return (wrong == 2 and "|" in right and same_function(right, f"|{u}-({s.c})|", s)
                and same_function(should, right, s))
    if "the middle term" in text:
        square, written, middle = spans
        return (wrong == 3 and same_function(square, f"({u}-({s.c}))^2", s) and same_function(written, right, s)
                and same_function(f"({square})-({written})", middle, s) and not same_function(middle, "0", s))
    if "was moved across without its sign changing" in text:
        moved, should = spans
        good = f"({w}-({s.f}))^2-(2({s.F}-({s.c})){u}+({s.c})^2-({s.F})^2)"
        return (wrong == 4 and same_function(moved, f"-2({s.F}){u}", s) and same_function(should, f"2({s.F}){u}", s)
                and same_function(f"({left})-({right})", f"({good})+2({should})", s))
    if text.startswith("The factor"):
        m = re.fullmatch(rf"The factor \$({NUM})\$ should be \$4p=({NUM})\$: \$\|p\|\$ is half the focus-directrix gap\.", text)
        if wrong != 5 or not m:
            return False
        K, true = F(m.group(1)), F(m.group(2))
        return (true == 4 * s.p and K != true
                and same_function(f"({left})-({right})", f"({w}-({s.f}))^2-({K})({u}-({s.k}))", s))
    if text.startswith("Taking"):
        taken, poly, kept, lost = spans
        if wrong != 5:
            return False
        good_right = f"2({s.F}-({s.c})){u}+({s.c})^2-({s.F})^2"
        return (F(taken) == 4 * s.p and same_function(poly, good_right, s)
                and same_function(kept, f"{u}-({s.k})", s)
                and same_function(f"({left})-({right})", f"({w}-({s.f}))^2-({taken})({lost})", s)
                and not same_function(kept, lost, s))
    raise ValueError(f"Unread mistake: {text}")


STEP_OF_REASON = [
    ("Every point on a parabola is as far from the focus as from the directrix.", "fact"),
    ("Square both sides; both are non-negative, so no points are gained or lost.", "square"),
    ("Expand $", "expand"),
    ("Subtract $", "collect"),
    ("Factor $", "factor"),
    ("Take the square root of both sides.", None),
    ("Divide both sides by $", None),
    ("Substitute the vertex", None),
]


def reason_step(label, s):
    for start, step in STEP_OF_REASON:
        if label.startswith(start):
            if step == "factor":
                m = re.fullmatch(rf"Factor \$({NUM})\$ out of the right side; \$({NUM})\$ is \$4p\$\.", label)
                require(m is not None and F(m.group(1)) == F(m.group(2)), "Factor reason")
                return step if F(m.group(1)) == 4 * s.p else None
            if step == "expand":
                m = re.fullmatch(r"Expand \$(.+)\$ and \$(.+)\$\.", label)
                require(m is not None, "Expand reason")
                named = {m.group(1), m.group(2)}
                ok = (any(same_function(x, f"({s.u}-({s.F}))^2", s) for x in named)
                      and any(same_function(x, f"({s.u}-({s.c}))^2", s) for x in named))
                return step if ok else None
            if step == "collect":
                require(label == f"Subtract ${s.u}^2$ from both sides, then collect the ${s.u}$-terms and numbers.", "Collect reason")
            return step
    raise ValueError(f"Unread reason: {label}")


def transition(lines, i, s):
    """What turns line i into line i+1 (i = 0: why line 1 holds)."""
    if i == 0:
        require(form_of(lines[0], s) == "distance" and correct(lines[0], s), "Line 1 is the equal-distance equation")
        return "fact"
    prev, nxt = lines[i - 1], lines[i]
    require(follows(prev, nxt, s), f"Line {i + 1} does not follow")
    if "\\sqrt" in prev and "\\sqrt" not in nxt:
        return "square"
    shape_prev, shape_next = form_of(prev, s), form_of(nxt, s)
    if shape_next == "expanded" and shape_prev != "expanded":
        return "expand"
    if shape_prev == "expanded" and shape_next == "collected":
        return "collect"
    if shape_prev == "collected" and shape_next == "factored":
        return "factor"
    raise ValueError(f"Unnamed step into line {i + 1}")


def solve_check(public):
    prompt, response = public["prompt"], public["response"]
    s = Setup(prompt)
    lines = lines_of(prompt)
    if "His work contains one mistake" in prompt:
        wrong = first_wrong(lines, s)
        require(wrong is not None, "A line is wrong")
        for i in range(wrong, 5):
            require(follows(lines[i - 1], lines[i], s), f"Line {i + 1} does not follow from the line above")
        line_blank, mistake_blank = response["blanks"]
        line_id = next(o["id"] for o in line_blank["options"] if o["label"] == f"Line {wrong}")
        fits = [o["id"] for o in mistake_blank["options"] if mistake_fits(o["label"], lines, wrong, s)]
        require(len(fits) == 1, f"{len(fits)} mistakes fit line {wrong}")
        return compact({line_blank["id"]: line_id, mistake_blank["id"]: fits[0]})
    require("Every line is correct" in prompt, "A correct derivation")
    require(all(correct(line, s) for line in lines), "Every line is correct")
    key = {}
    for blank in response["blanks"]:
        m = re.fullmatch(r"From Line (\d) to Line (\d)|Why Line 1 is true", blank["label"])
        require(m is not None, "Unread step label")
        i = int(m.group(1)) if m.group(1) else 0
        if m.group(1):
            require(int(m.group(2)) == i + 1, "Consecutive lines")
        step = transition(lines, i, s)
        hits = [o["id"] for o in blank["options"] if reason_step(o["label"], s) == step]
        require(len(hits) == 1, f"{len(hits)} reasons fit step {i}")
        key[blank["id"]] = hits[0]
    return compact(key)


# --------------------------------------------------------- point on parabola


def solve_point(public):
    prompt, response = public["prompt"], public["response"]
    s = Setup(prompt)
    find = re.search(rf"The point \$P\((.+?), (.+?)\)\$ is on the parabola\. Find \$([xy])\$\.", prompt)
    if find:
        unknown = find.group(3)
        require(unknown == s.u, "The unknown is the axis variable")
        given = F(find.group(2) if s.u == "x" else find.group(1))
        t = given - s.f
        value_ = (t * t + s.F * s.F - s.c * s.c) / (2 * (s.F - s.c))
        # Check: the point is as far from the focus as from the directrix.
        require((t * t + (value_ - s.F) ** 2) == (value_ - s.c) ** 2, "Equal distances")
        hits = [o["id"] for o in response["options"]
                if re.fullmatch(rf"\${unknown}=({NUM})\$", o["label"]) and F(re.fullmatch(rf"\${unknown}=({NUM})\$", o["label"]).group(1)) == value_]
        require(len(hits) == 1, "Exactly one value")
        return hits[0]
    q = re.search(rf"Is \$Q\(({NUM}), ({NUM})\)\$ on the parabola\?", prompt)
    require(q is not None, "Unread point task")
    Q = (F(q.group(1)), F(q.group(2)))
    qf2 = (Q[0] - s.fx) ** 2 + (Q[1] - s.fy) ** 2
    drop = abs((Q[1] if s.u == "y" else Q[0]) - s.c)
    on = qf2 == drop ** 2
    directrix = f"${s.u}={s.c.numerator if s.c.denominator == 1 else float(s.c)}$"

    def complete(label):
        m = re.match(r"(Yes|No): ", label)
        if not m or (m.group(1) == "Yes") != on:
            return False
        if "vertex" in label:
            return False
        qf = re.search(r"\$QF=([^$]+)\$", label)
        far = re.search(r"and \$Q\$ is \$([^$]+)\$ from " + re.escape(directrix), label)
        if not qf or not far:
            return False
        if not all(same(value(part) ** 2, qf2) for part in sides(qf.group(1))):
            return False
        if not all(same(value(part), drop) for part in sides(far.group(1))):
            return False
        return label.endswith("The two are equal." if on else "The two differ.")

    hits = [o["id"] for o in response["options"] if complete(o["label"])]
    require(len(hits) == 1, f"{len(hits)} complete explanations")
    return hits[0]


def solve(public):
    template = public["templateId"]
    if template == "parabola-derive-equation":
        return solve_derive(public)
    if template == "parabola-derivation-check":
        return solve_check(public)
    require(template == "parabola-point-equidistance", "Unsupported template")
    return solve_point(public)


def review_problem(problem):
    public = problem["public"]
    expected = solve(public)
    if public["response"]["kind"] == "choice":
        feedback = problem.get("choiceFeedback") or {}
        for o in public["response"]["options"]:
            if o["id"] != expected:
                require(len(feedback.get(o["id"], "")) > 10, "Every wrong option has feedback")
    return expected


def self_test():
    s = Setup("focus $F(6, -3)$ and directrix $y=4$")
    require(s.p == F(-7, 2) and s.vertex() == (6, F(1, 2)), "p and vertex")
    require(correct("\\sqrt{(x-6)^2+(y+3)^2}=|y-4|", s), "distance line")
    require(correct("(x-6)^2=-14(y-0.5)", s), "factored line")
    require(not correct("(x-6)^2=-14y-7", s), "wrong constant")
    require(not correct("\\sqrt{(x-6)^2+(y+3)^2}=|x-4|", s), "wrong axis")
    require(follows("\\sqrt{(x-6)^2+(y+3)^2}=|y-4|", "(x-6)^2+(y+3)^2=(y-4)^2", s), "squaring follows")
    require(not follows("(x-6)^2+(y+3)^2=(y-4)^2", "(x-6)^2=-14y-7", s), "a slip does not follow")
    point = {
        "templateId": "parabola-point-equidistance",
        "prompt": "A parabola has focus $F(5, 6)$ and directrix $x=3$. Is $Q(8, 2)$ on the parabola? Choose the explanation that is correct and complete.",
        "response": {"kind": "choice", "options": [
            {"id": "option-a", "label": "No: $QF=\\sqrt{4+3}=\\sqrt{7}$, and $Q$ is $|8-3|=5$ from $x=3$."},
            {"id": "option-b", "label": "Yes: $QF=\\sqrt{4^2+3^2}=5$, and $Q$ is $|8-3|=5$ from $x=3$. The two are equal."},
            {"id": "option-c", "label": "Yes: $QF=\\sqrt{4^2+3^2}=5$."},
            {"id": "option-d", "label": "No: $QF=\\sqrt{4^2+3^2}=5$, and $Q$ is $\\sqrt{32}$ from the vertex $(4, 6)$."}]},
    }
    require(solve(point) == "option-b", "point on parabola")
    point["response"]["options"][1]["label"] = point["response"]["options"][1]["label"].replace("=5$ from", "=6$ from")
    try:
        solve(point)
    except ValueError:
        pass
    else:
        raise AssertionError("A wrong distance was accepted")
