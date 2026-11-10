"""Independent oracle for tangent-construction-reasoning (HSG.C.A.4).

Templates: tangent-construct-steps, tangent-construct-justify.

Only the public payload is read: the prompt, the options and the figure's
coordinates (circle O, point P, and whatever the construction has drawn).

* The construction is the one this oracle knows: find the midpoint M of OP
  (perpendicular bisector), draw the circle with center M through O (diameter
  OP), mark its crossings T and T' with circle O, draw lines PT and PT'. The
  figure's stage is read from what is drawn: a segment through the midpoint
  of OP perpendicular to it, a circle centered there through O and P, points
  on both circles, lines from P through them. Every drawn T is checked to be
  a point of tangency (OT is perpendicular to PT, and T is on circle O).
* next-step: the option naming the stage's next action is the answer; every
  other option is wrong, and each one that claims to find points of tangency
  or a tangent is checked numerically to be false (its points are computed
  and OX . PX != 0, or its line's distance from O differs from the radius).
* which-line: each labeled line is tested for passing through P at distance r
  from O; exactly one may.
* order-steps: each listed step is read as one of the four actions or as a
  step foreign to the construction; the key lists the four in dependency
  order.
* justify: each option is read against a rule base (the angle inscribed in a
  semicircle, the tangent-radius theorem, circular uses of equal tangent
  segments, true-but-insufficient facts) and every numeric or geometric claim
  an option makes is recomputed from the figure (lengths, crossings, whether
  a line meets circle O).
"""

import json
import math
import re

SUPPORTED = frozenset({"tangent-construct-steps", "tangent-construct-justify"})
REVIEW_RETURNS_ANSWER = True
CHOICE_REVIEW = SUPPORTED
STATS = {"cases": 0, "options": 0}
EPS = 1e-6


def require(condition, message):
    # Not assert: python -O must not disable review gates.
    if not condition:
        raise ValueError(message)


def sub(a, b):
    return (a[0] - b[0], a[1] - b[1])


def add(a, b):
    return (a[0] + b[0], a[1] + b[1])


def mul(a, k):
    return (a[0] * k, a[1] * k)


def dot(a, b):
    return a[0] * b[0] + a[1] * b[1]


def cross(a, b):
    return a[0] * b[1] - a[1] * b[0]


def norm(a):
    return math.hypot(*a)


def close(a, b, tol=1e-6):
    return norm(sub(a, b)) < tol * max(1.0, norm(a), norm(b))


def line_distance(o, p, d):
    """Distance from o to the line through p with direction d."""
    return abs(cross(d, sub(o, p))) / norm(d)


def circle_meet(c1, r1, c2, r2):
    d = norm(sub(c2, c1))
    if d < 1e-12 or d > r1 + r2 + 1e-12 or d < abs(r1 - r2) - 1e-12:
        return []
    x = (d * d + r1 * r1 - r2 * r2) / (2 * d)
    h = math.sqrt(max(0.0, r1 * r1 - x * x))
    u = mul(sub(c2, c1), 1 / d)
    base = add(c1, mul(u, x))
    n = (-u[1], u[0])
    pts = [add(base, mul(n, h)), add(base, mul(n, -h))]
    return pts if h > 1e-9 else pts[:1]


def line_circle(p, d, c, r):
    t0 = dot(sub(c, p), d) / dot(d, d)
    f = add(p, mul(d, t0))
    dist = norm(sub(c, f))
    if dist > r + 1e-12:
        return []
    h = math.sqrt(max(0.0, r * r - dist * dist)) / norm(d)
    return [add(f, mul(d, h)), add(f, mul(d, -h))]


def tangent_at(O, r, P, X):
    """Is X a point of tangency of a line from P to circle (O, r)?"""
    return abs(norm(sub(X, O)) - r) < EPS * max(1, r) and abs(dot(sub(X, O), sub(X, P))) < EPS * max(1, r * r)


# ---------------------------------------------------------------- figure

class Figure:
    def __init__(self, figure):
        els = figure["scene"]["elements"]
        self.points, self.circles, self.segments, self.texts = {}, [], [], []
        pts = [e for e in els if e["type"] == "point"]
        for e in els:
            if e["type"] == "text":
                self.texts.append(e)
                for q in pts:
                    if close(tuple(q["at"]), tuple(e["at"])) and len(e["text"]) <= 2 and e["text"][0].isupper():
                        self.points[e["text"]] = tuple(q["at"])
            elif e["type"] == "circle":
                self.circles.append((tuple(e["center"]), e["r"], e.get("dash")))
            elif e["type"] == "segment":
                self.segments.append((tuple(e["from"]), tuple(e["to"]), e.get("dash")))
        self.O = self.points["O"]
        self.P = self.points["P"]
        given = [c for c in self.circles if close(c[0], self.O)]
        require(len(given) == 1, "One circle is centered at O")
        self.r = given[0][1]
        require(norm(sub(self.P, self.O)) > self.r + 1e-9, "P is outside circle O")
        self.M = mul(add(self.O, self.P), 0.5)
        op = sub(self.P, self.O)
        self.has_bisector = any(
            abs(dot(sub(b, a), op)) < EPS * norm(sub(b, a)) * norm(op) and line_distance(self.M, a, sub(b, a)) < EPS
            for a, b, _ in self.segments)
        self.has_helper = any(close(c, self.M) and abs(r - norm(op) / 2) < EPS for c, r, _ in self.circles)
        self.tangent_points = [self.points[k] for k in ("T", "T′") if k in self.points]
        for X in self.tangent_points:
            require(tangent_at(self.O, self.r, self.P, X), "Every marked T is a point of tangency")
        self.has_tangents = any(close(a, self.P) and any(abs(cross(sub(b, a), sub(X, a))) < EPS * norm(sub(b, a)) * max(1, norm(sub(X, a))) for X in self.tangent_points)
                                for a, b, _ in self.segments)
        if "M" in self.points:
            require(close(self.points["M"], self.M), "M is the midpoint of OP")

    def stage(self):
        if self.has_tangents:
            return 4
        if self.tangent_points:
            require(self.has_helper and self.has_bisector, "T is marked only after the circle on OP")
            return 3
        if self.has_helper:
            require(self.has_bisector, "The circle on OP comes after the midpoint")
            return 2
        return 1 if self.has_bisector else 0


ACTIONS = ["bisect", "helper", "mark", "tangents"]


def construction_action(text):
    """The construction step a sentence describes, or None for a foreign one."""
    s = text.replace("$", "")
    if re.fullmatch(r"Construct the perpendicular bisector of \\overline\{OP\} to find (?:the|its) midpoint M(?: of \\overline\{OP\})?\.?", s):
        return "bisect"
    if re.fullmatch(r"Draw the circle with center M through O(?:, the circle with diameter \\overline\{OP\})?\.?", s):
        return "helper"
    if re.fullmatch(r"Mark the points T and T' where (?:the new|that) circle meets circle O\.?", s):
        return "mark"
    if re.fullmatch(r"Draw (?:the line through P and T, and the line through P and T'|line PT and line PT')\.?", s):
        return "tangents"
    return None


def foreign_claim_false(text, fig):
    """A non-construction option: check that any tangency it claims is false.
    Returns True when the option is certainly not the next step."""
    s = text.replace("$", "")
    O, P, r, M = fig.O, fig.P, fig.r, fig.M
    op = sub(P, O)
    perp = (-op[1], op[0])

    def not_tangency(points):
        return all(not tangent_at(O, r, P, X) for X in points)

    claims = [
        (r"Draw the line through O perpendicular to \\overline\{OP\}; it meets circle O at the points of tangency", lambda: not_tangency(line_circle(O, perp, O, r))),
        (r"Draw the circle with center P through O; it meets circle O at the points of tangency", lambda: not_tangency(circle_meet(P, norm(op), O, r))),
        (r"Draw the circle with center P through M; it meets circle O at the points of tangency", lambda: not_tangency(circle_meet(P, norm(op) / 2, O, r))),
        (r"Draw the circle with center M and the radius of circle O; it meets circle O at the points of tangency", lambda: not_tangency(circle_meet(M, r, O, r))),
        (r"Draw the circle with center P and the radius of circle O; it meets circle O at the points of tangency", lambda: not_tangency(circle_meet(P, r, O, r))),
        (r"Draw the line through P perpendicular to \\overline\{OP\}; it is the tangent", lambda: abs(line_distance(O, P, perp) - r) > EPS),
        (r"The perpendicular bisector of \\overline\{OP\}, already drawn, is the tangent from P", lambda: line_distance(P, M, perp) > EPS),
        (r"Mark where the new circle meets line OP; those are the points of tangency", lambda: not_tangency(line_circle(O, op, M, norm(op) / 2))),
        (r"Mark where the perpendicular bisector meets circle O; those are the points of tangency", lambda: not_tangency(line_circle(M, perp, O, r))),
        (r"Mark where the perpendicular bisector meets the new circle; those are the points of tangency", lambda: not_tangency(line_circle(M, perp, M, norm(op) / 2))),
        (r"Draw the line through T and T'", lambda: True),
        (r"Draw the line through M and T", lambda: True),
        (r"Draw the line through O and T", lambda: True),
    ]
    for pattern, check in claims:
        if re.fullmatch(pattern + r"\.?", s):
            # Lines through T other than PT: none of them passes through P.
            if "line through" in pattern and "T" in pattern and fig.tangent_points:
                T = fig.tangent_points[0]
                other = {"T and T'": fig.points.get("T′"), "M and T": M, "O and T": O}
                for k, pnt in other.items():
                    if k in s and pnt is not None:
                        require(line_distance(P, T, sub(pnt, T)) > EPS, f"{k} line misses P")
            return check()
    raise ValueError(f"Unread step: {text!r}")


def solve_steps(public):
    prompt = public["prompt"]
    options = public["response"]["options"]
    fig = Figure(public["figure"])
    if prompt.startswith("These steps"):
        steps = dict((int(n), t) for n, t in re.findall(r"Step (\d): (.*?\.)(?= Step \d:| Which list)", prompt))
        require(len(steps) == 5, "Five steps listed")
        kinds = {n: construction_action(t) for n, t in steps.items()}
        foreign = [n for n, k in kinds.items() if k is None]
        require(len(foreign) == 1, f"Exactly one step does not belong: {kinds}")
        order = [next(n for n, k in kinds.items() if k == a) for a in ACTIONS]
        want = ", ".join(str(n) for n in order)
        hits = [o["id"] for o in options if re.sub(r"\\ |\$", "", o["label"]).replace(",", ", ").replace("  ", " ") == want]
        require(len(hits) == 1, f"Exactly one option lists {want}")
        STATS["options"] += len(options)
        return hits[0]
    if prompt.startswith("The circle with center $M$ through $O$ has been drawn") and "Four lines" in prompt:
        labels = {t["text"]: tuple(t["at"]) for t in fig.texts if t["text"] in ("a", "b", "c", "d")}
        lines = [(a, b) for a, b, dash in fig.segments if dash is None and not (close(a, fig.O) and close(b, fig.P))]
        found = []
        for name, at in labels.items():
            a, b = min(lines, key=lambda s: min(norm(sub(at, s[0])), norm(sub(at, s[1]))))
            d = sub(b, a)
            through_p = line_distance(fig.P, a, d) < EPS
            tangent = abs(line_distance(fig.O, a, d) - fig.r) < EPS
            if through_p and tangent:
                found.append(name)
        require(len(found) == 1, f"Exactly one drawn line is a tangent from P: {found}")
        hit = [o["id"] for o in options if o["label"] == f"Line ${found[0]}$"]
        require(len(hit) == 1, "The tangent line is an option")
        STATS["options"] += len(options)
        return hit[0]
    stage = fig.stage()
    require(stage < 4, "The construction is not finished")
    want = ACTIONS[stage]
    valid = []
    for o in options:
        action = construction_action(o["label"])
        if action == want:
            valid.append(o["id"])
        elif action is None:
            require(foreign_claim_false(o["label"], fig), f"A foreign step's claim holds: {o['label']!r}")
        STATS["options"] += 1
    require(len(valid) == 1, f"Exactly one next step, found {valid}")
    return valid[0]


# ---------------------------------------------------------------- justify

def quoted_lengths(prompt):
    m = re.search(r"Circle \$O\$ has radius \$(\d+)\$, and \$OP=(\d+)\$", prompt)
    return (int(m.group(1)), int(m.group(2))) if m else None


THALES = r"(?:An angle inscribed in a semicircle is a right angle, so )?\$m\\angle OTP=90\^\\circ\$(?: \(angle in a semicircle\)|, because it is inscribed in a semicircle of the circle with diameter \$\\overline\{OP\}\$| where it meets circle \$O\$)"
TANGENT_RULE = r"(?:a line perpendicular to radius \$\\overline\{OT\}\$ at \$T\$ is tangent|A line perpendicular to a radius at its endpoint on the circle is tangent to the circle)"


def judge_justify(label, ask, fig, prompt):
    """True when the option is a correct, complete answer for this ask."""
    s = label
    O, P, r = fig.O, fig.P, fig.r
    T = fig.tangent_points[0] if fig.tangent_points else None
    op = norm(sub(P, O))
    if ask == "reason-tangent":
        if re.fullmatch(THALES + r", and " + TANGENT_RULE, s):
            return True
        if s.startswith("$PT=PT'$"):
            return False  # equal tangent segments presuppose tangency
        if s.startswith("$T$ lies on both circles"):
            # Line PT meets the circle on OP at T and again at P.
            require(abs(norm(sub(P, fig.M)) - op / 2) < EPS, "P is on the circle on OP")
            return False
        if s.startswith("$PT$ is shorter than $OP$"):
            return False  # a secant from P can be shorter than OP too
    elif ask == "reason-for-step":
        if re.fullmatch(r"An angle inscribed in a semicircle is a right angle, so \$m\\angle OTP=90\^\\circ\$ where it meets circle \$O\$", s):
            return True
        if s.startswith("$MT=MO=MP$"):
            return False  # true, but stops before the right angle
        if re.fullmatch(r"\$T\$ is as far from \$O\$ as from \$P\$, so it lies on the perpendicular bisector of \$\\overline\{OP\}\$", s):
            # TO is a radius and TP a tangent length; on the drawn figure they
            # differ, so the premise is false (and it would not give the angle).
            require(T is not None, "T is drawn")
            require(abs(norm(sub(T, O)) - norm(sub(T, P))) > EPS, f"TO = TP on the drawn figure: {label!r}")
            return False
        if s.startswith("Both circles pass through $T$, so they are tangent"):
            require(len(circle_meet(O, r, fig.M, op / 2)) == 2, "The circles cross at two points")
            return False
        if s.startswith("$\\overline{OP}$ is a diameter of circle $O$"):
            # O is the center, not a point of circle O, so OP is no diameter
            # of it, whatever its length.
            require(fig.r > EPS, "circle O has a radius")
            return False
    elif ask in ("complete-explanation-tangent-rule", "complete-explanation-right-angle"):
        given_right = "One is: \"$m\\angle OTP" in prompt
        if given_right and re.fullmatch(TANGENT_RULE, s):
            return True
        if not given_right and re.fullmatch(THALES, s):
            return True
        if s.startswith("$PT=PT'$") or s.startswith("$M$ is the same distance") or s.startswith("$\\overline{OP}$ bisects"):
            return False  # circular or not about the angle at T
        if s.startswith("$m\\angle TOP=90^\\circ$"):
            require(T is not None and abs(dot(sub(T, O), sub(P, O))) > EPS, "Angle TOP is not right")
            return False
        if s.startswith("A line through a point outside a circle meets the circle at most once"):
            return False  # false: a secant meets it twice
        if re.fullmatch(TANGENT_RULE, s) or re.fullmatch(THALES, s):
            return False  # the fact already given
    elif ask == "find-flaw-ana":
        A = fig.points["A"]
        require(abs(norm(sub(A, O)) - r) < EPS and abs(norm(sub(A, P)) - op) < EPS, "A is on circle O and on the circle with center P through O")
        if s.startswith("$A$ is not on the circle with diameter $\\overline{OP}$"):
            require(abs(norm(sub(A, fig.M)) - op / 2) > EPS, "A is off the circle on OP")
            require(abs(dot(sub(A, O), sub(A, P))) > EPS, "Angle OAP is not right")
            require(line_distance(O, P, sub(A, P)) < r - EPS, "Line PA crosses circle O")
            return True
        if s.startswith("Line $PA$ is tangent"):
            return False
        if s.startswith("The circle should be centered at $O$ through $P$"):
            require(not circle_meet(O, op, O, r), "That circle misses circle O")
            return False
        if s.startswith("She should have used the radius of circle $O$"):
            for X in circle_meet(P, r, O, r):
                require(not tangent_at(O, r, P, X), "Radius-r circle at P does not find tangency")
            return False
    elif ask == "find-flaw-ben":
        if s.startswith("Line $OT$ contains a radius; the tangent is the line through $P$ and $T$"):
            return True
        if s.startswith("Line $OT$ is the tangent"):
            return False
        if s.startswith("He should draw the line through $T$ and $T'$"):
            return False
        if s.startswith("$T$ is wrong"):
            return False  # the circle on OP meets line OP only at O and P
    elif ask == "find-flaw-cara":
        if s.startswith("A tangent is perpendicular to the radius at the point of contact, not to $\\overline{OP}$; her line misses circle $O$"):
            drawn = [(a, b) for a, b, _ in fig.segments
                     if line_distance(P, a, sub(b, a)) < EPS and abs(dot(sub(b, a), sub(P, O))) < EPS * norm(sub(b, a)) * op]
            require(drawn, "Cara's line, through P perpendicular to OP, is drawn")
            require(op > r + EPS, "Her line, at distance OP from O, misses circle O")
            return True
        if s.startswith("She should draw it perpendicular to $\\overline{OP}$ at $O$"):
            return False  # a line through O is a secant
        if s.startswith("Her line is tangent"):
            return False
    raise ValueError(f"Unread {ask} option: {label!r}")


def justify_ask(prompt):
    if "Why is line $PT$ tangent" in prompt:
        return "reason-tangent"
    if "Why does the circle with diameter" in prompt:
        return "reason-for-step"
    if "needs two facts" in prompt:
        return "complete-explanation-right-angle" if "One is: \"$m\\angle OTP" in prompt else "complete-explanation-tangent-rule"
    if "Ana draws" in prompt:
        return "find-flaw-ana"
    if "Ben constructs" in prompt:
        return "find-flaw-ben"
    if "Cara draws" in prompt:
        return "find-flaw-cara"
    raise ValueError("Unread question")


def solve_justify(public):
    prompt = public["prompt"]
    fig = Figure(public["figure"])
    lengths = quoted_lengths(prompt)
    if lengths:
        require(abs(fig.r - lengths[0]) < EPS and abs(norm(sub(fig.P, fig.O)) - lengths[1]) < EPS, "Quoted lengths match the figure")
    ask = justify_ask(prompt)
    valid = []
    for o in public["response"]["options"]:
        if judge_justify(o["label"], ask, fig, prompt):
            valid.append(o["id"])
        STATS["options"] += 1
    require(len(valid) == 1, f"Exactly one valid option, found {valid}")
    return valid[0]


def solve(public):
    t = public["templateId"]
    require(t in SUPPORTED, f"Unsupported template {t}")
    return solve_steps(public) if t == "tangent-construct-steps" else solve_justify(public)


def review_problem(problem):
    STATS["cases"] += 1
    public = problem["public"]
    labels = [o["label"] for o in public["response"]["options"]]
    require(len(set(labels)) == len(labels), "Distinct options")
    return solve(public)


# ---------------------------------------------------------------- self test

def _figure(stage, r=3.0, P=(5.0, 0.0)):
    O = (0.0, 0.0)
    M = mul(add(O, P), 0.5)
    els = [{"id": "given", "type": "circle", "center": [0, 0], "r": r},
           {"id": "po", "type": "point", "at": [0, 0]}, {"id": "no", "type": "text", "at": [0, 0], "text": "O"},
           {"id": "pp", "type": "point", "at": list(P)}, {"id": "np", "type": "text", "at": list(P), "text": "P"}]
    if stage >= 1:
        els.append({"id": "bis", "type": "segment", "from": [M[0], 4], "to": [M[0], -4], "dash": "dash"})
        els += [{"id": "pm", "type": "point", "at": list(M)}, {"id": "nm", "type": "text", "at": list(M), "text": "M"}]
    if stage >= 2:
        els.append({"id": "helper", "type": "circle", "center": list(M), "r": norm(sub(P, O)) / 2})
    if stage >= 3:
        Ts = circle_meet(M, norm(sub(P, O)) / 2, O, r)
        for i, T in enumerate(Ts):
            els += [{"id": f"pt{i}", "type": "point", "at": list(T)}, {"id": f"nt{i}", "type": "text", "at": list(T), "text": "T" if i == 0 else "T′"}]
    return {"kind": "scene", "scene": {"v": 1, "elements": els}}


def _rejects(fn, why):
    try:
        fn()
    except (ValueError, KeyError, StopIteration, TypeError, ZeroDivisionError, IndexError):
        return
    raise ValueError(f"Self-test mutation accepted: {why}")


def self_test():
    # 3-4-5: tangent length 4 from P(5, 0) to the circle of radius 3.
    fig = Figure(_figure(3))
    require(len(fig.tangent_points) == 2 and abs(norm(sub(fig.P, fig.tangent_points[0])) - 4) < 1e-9, "tangent length 4")
    opts = [{"id": "option-a", "label": "Draw the line through $P$ and $T$, and the line through $P$ and $T'$"},
            {"id": "option-b", "label": "Draw the line through $T$ and $T'$"},
            {"id": "option-c", "label": "Draw the line through $M$ and $T$"},
            {"id": "option-d", "label": "Draw the line through $O$ and $T$"}]
    public = {"templateId": "tangent-construct-steps", "prompt": "A tangent from point $P$ to circle $O$ is being constructed with compass and straightedge. The perpendicular bisector of $\\overline{OP}$, the circle with center $M$ through $O$, and the points $T$ and $T'$ where it meets circle $O$ are drawn. What is the next step?",
              "response": {"kind": "choice", "label": "Choose one answer", "options": opts}, "figure": _figure(3)}
    require(solve(public) == "option-a", "draw the tangents next")
    early = json.loads(json.dumps(public))
    early["figure"] = _figure(1)
    _rejects(lambda: solve(early), "drawing the tangents before T exists")
    claim = json.loads(json.dumps(public))
    claim["figure"] = _figure(0)
    claim["response"]["options"] = [{"id": "option-a", "label": "Construct the perpendicular bisector of $\\overline{OP}$ to find the midpoint $M$ of $\\overline{OP}$"},
                                    {"id": "option-b", "label": "Draw the circle with center $P$ through $O$; it meets circle $O$ at the points of tangency"},
                                    {"id": "option-c", "label": "Draw the line through $P$ perpendicular to $\\overline{OP}$; it is the tangent"},
                                    {"id": "option-d", "label": "Draw the line through $O$ perpendicular to $\\overline{OP}$; it meets circle $O$ at the points of tangency"}]
    require(solve(claim) == "option-a", "first step")
    # Order: the foreign step is left out and the four keep their order.
    order = {"templateId": "tangent-construct-steps", "prompt": "These steps, four of them in the right order, construct the tangents from point $P$ to circle $O$. One step does not belong. Step 1: Mark the points $T$ and $T'$ where that circle meets circle $O$. Step 2: Draw the circle with center $M$ through $O$. Step 3: Draw line $PT$ and line $PT'$. Step 4: Draw the circle with center $P$ through $O$. Step 5: Construct the perpendicular bisector of $\\overline{OP}$ to find its midpoint $M$. Which list gives the construction in order?",
             "response": {"kind": "choice", "label": "x", "options": [{"id": "option-a", "label": "$5,\\ 1,\\ 2,\\ 3$"}, {"id": "option-b", "label": "$5,\\ 2,\\ 1,\\ 3$"}, {"id": "option-c", "label": "$5,\\ 4,\\ 1,\\ 3$"}, {"id": "option-d", "label": "$5,\\ 2,\\ 3,\\ 1$"}]},
             "figure": _figure(3)}
    require(solve(order) == "option-b", "construction order")
    # Justify: the Thales-plus-tangent-rule option and nothing else.
    just = {"templateId": "tangent-construct-justify", "prompt": "Point $P$ is outside circle $O$. The construction drew the circle with center $M$ (the midpoint of $\\overline{OP}$) through $O$ and $P$; it meets circle $O$ at $T$ and $T'$. Why is line $PT$ tangent to circle $O$?",
            "response": {"kind": "choice", "label": "x", "options": [
                {"id": "option-a", "label": "$PT=PT'$, because the two tangent segments from a point are equal"},
                {"id": "option-b", "label": "$T$ lies on both circles, so line $PT$ touches each circle only at $T$"},
                {"id": "option-c", "label": "$PT$ is shorter than $OP$, so line $PT$ cannot cross circle $O$"},
                {"id": "option-d", "label": "$m\\angle OTP=90^\\circ$ (angle in a semicircle), and a line perpendicular to radius $\\overline{OT}$ at $T$ is tangent"}]},
            "figure": _figure(3)}
    require(solve(just) == "option-d", "reason the line is tangent")
    bad = json.loads(json.dumps(just))
    bad["response"]["options"][0]["label"] = just["response"]["options"][3]["label"].replace("(angle in a semicircle)", "(angle in a semicircle) ")
    _rejects(lambda: solve(bad), "an unread option")
    wrong_t = json.loads(json.dumps(just))
    for e in wrong_t["figure"]["scene"]["elements"]:
        if e["id"] == "pt0":
            e["at"] = [3, 0]
    for e in wrong_t["figure"]["scene"]["elements"]:
        if e["id"] == "nt0":
            e["at"] = [3, 0]
    _rejects(lambda: solve(wrong_t), "a marked T that is not a point of tangency")
    return True
