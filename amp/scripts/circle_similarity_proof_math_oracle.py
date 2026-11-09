"""Independent oracle for circle-similarity-proof (HSG.C.A.1).

Templates: circle-similarity-proof-steps, circle-similarity-justify-flaw,
circle-similarity-general-map.

Only the public payload is read: the prompt (circle names and radii, the
argument's steps), the banks or options and the figure.

* Every transformation is simulated on circles as (center, radius): a
  translation by a vector moves the center and keeps the radius; a dilation
  about Z by k sends center c to Z + k(c - Z) and radius r to |k| r. Symbolic
  radii and centers are tested at several unrelated numeric assignments, so a
  statement "for every choice" is accepted only when it holds at all of them.
* steps (structured-work proof): each bank statement is read and its truth
  decided by simulation; each reason is a rule written here (a translation
  keeps distances; a dilation about the new center multiplies distances along
  rays, with its own arithmetic checked; the definition of similarity by
  rigid motions and dilations; generalization from arbitrary circles, valid
  only when the radii are letters). The closure decides what is provable;
  every claim of the private rule must be a justification derived here and
  every derived justification must be claimed; the key must be a valid proof
  ending in the goal.
* justify-flaw: each argument step is read and judged on its own: does it
  follow from the steps before it? The flawed step is the first that does
  not. A flaw option is valid only when it blames that step and its stated
  reason is true and explains the failure; "no flaw" is valid only for a
  valid argument. Justify and explain options are judged by a rule base of
  which facts prove which step.
* general-map: each sequence is simulated for every test assignment; each
  statement about the proof is decided by simulation or by its rule.
"""

import itertools
import json
import math
import random
import re
from fractions import Fraction as F

SUPPORTED = frozenset({
    "circle-similarity-proof-steps",
    "circle-similarity-justify-flaw",
    "circle-similarity-general-map",
})
REVIEW_RETURNS_ANSWER = True
CHOICE_REVIEW = frozenset({"circle-similarity-justify-flaw"})
STATS = {"cases": 0, "claims": 0, "options": 0}
EPS = 1e-9


def require(condition, message):
    # Not assert: python -O must not disable review gates.
    if not condition:
        raise ValueError(message)


# ---------------------------------------------------------------- TeX values

def _tokens(tex):
    s = tex.replace("\\left", "").replace("\\right", "").replace("\\cdot", "*").replace("\\,", "").replace(" ", "")
    out, i = [], 0
    while i < len(s):
        c = s[i]
        if s.startswith("\\frac", i):
            out.append(("frac", None))
            i += 5
        elif c.isdigit() or c == ".":
            j = i
            while j < len(s) and (s[j].isdigit() or s[j] == "."):
                j += 1
            out.append(("num", s[i:j]))
            i = j
        elif c.isalpha():
            j = i + 1
            if j < len(s) and s[j] == "_":
                if s[j + 1] == "{":
                    k = s.index("}", j)
                    name = c + "_" + s[j + 2:k]
                    j = k + 1
                else:
                    name = c + "_" + s[j + 1]
                    j += 2
            else:
                name = c
            out.append(("var", name))
            i = j
        elif c in "+-*/^(){}":
            out.append((c, c))
            i += 1
        else:
            raise ValueError(f"Unread TeX {c!r} in {tex!r}")
    return out


def tex_value(tex, env):
    """Value of a TeX expression with variables from env."""
    toks, pos = _tokens(tex), [0]

    def peek():
        return toks[pos[0]][0] if pos[0] < len(toks) else None

    def take(kind=None):
        tok = toks[pos[0]]
        require(kind is None or tok[0] == kind, f"Expected {kind} in {tex!r}")
        pos[0] += 1
        return tok

    def group():
        take("{")
        v = expr()
        take("}")
        return v

    def atom():
        k = peek()
        if k == "num":
            return float(take()[1])
        if k == "var":
            name = take()[1]
            require(name in env, f"Unknown variable {name}")
            return env[name]
        if k == "frac":
            take()
            a = group()
            b = group()
            return a / b
        if k == "(":
            take()
            v = expr()
            take(")")
            return v
        if k == "{":
            return group()
        raise ValueError(f"Unexpected {k} in {tex!r}")

    def power():
        v = atom()
        if peek() == "^":
            take()
            v = v ** (group() if peek() == "{" else atom())
        return v

    def unary():
        if peek() == "-":
            take()
            return -unary()
        return power()

    def term():
        v = unary()
        while True:
            k = peek()
            if k in ("*", "/"):
                take()
                w = unary()
                v = v * w if k == "*" else v / w
            elif k in ("num", "var", "frac", "(", "{"):
                v = v * power()
            else:
                return v

    def expr():
        v = term()
        while peek() in ("+", "-"):
            k = take()[0]
            w = term()
            v = v + w if k == "+" else v - w
        return v

    v = expr()
    require(pos[0] == len(toks), f"Trailing TeX in {tex!r}")
    return v


def assignments(names, numeric):
    """Test values: numeric radii stay as given; letters get unrelated values."""
    rng = random.Random(20261109)
    out = []
    for _ in range(6):
        env = {}
        for n in names:
            env[n] = numeric.get(n, round(rng.uniform(0.7, 9.0), 3))
        out.append(env)
    return out


def same(a, b):
    return abs(a - b) < 1e-7 * max(1.0, abs(a), abs(b))


# ---------------------------------------------------------------- the setup

class Setup:
    """Circle X (center X, radius r) and circle Y (center Y, radius s)."""

    def __init__(self, prompt):
        m = re.match(r"Circle \$(\S+?)\$ has center \$(\S+?)\$ and radius \$(\S+?)\$[.;] [Cc]ircle \$(\S+?)\$ has center \$(\S+?)\$ and radius \$(\S+?)\$", prompt)
        require(m is not None, "Two circles named in the prompt")
        self.X, cx, self.r, self.Y, cy, self.s = m.groups()
        require(self.X == cx and self.Y == cy, "Each circle is named by its center")
        for radius in (self.r, self.s):
            require(re.fullmatch(r"\d+|[a-z](?:_\d)?", radius) is not None, f"A radius is a whole number or one letter: {radius}")
        require(self.r != self.s, "The two radii are named differently")
        self.numeric = bool(re.fullmatch(r"\d+", self.r)) and bool(re.fullmatch(r"\d+", self.s))
        names = sorted({t[1] for t in _tokens(self.r) + _tokens(self.s) if t[0] == "var"})
        fixed = {}
        if self.numeric:
            self.r_val, self.s_val = F(self.r), F(self.s)
        self.envs = assignments(names, fixed)

    def rv(self, env):
        return float(self.r_val) if self.numeric else tex_value(self.r, env)

    def sv(self, env):
        return float(self.s_val) if self.numeric else tex_value(self.s, env)

    def always(self, fn):
        """fn(env) holds at every test assignment."""
        return all(fn(env) for env in self.envs)

    def factor_is_ratio(self, k_tex):
        return self.always(lambda e: same(tex_value(k_tex, e), self.sv(e) / self.rv(e)))


# ---------------------------------------------------------------- steps

class Proof:
    def __init__(self, public):
        self.setup = st = Setup(public["prompt"])
        response = public["response"]
        banks = {b["id"]: b["options"] for b in response["banks"]}
        self.statements = {o["id"]: o["label"] for o in banks["statements"]}
        self.reasons = {o["id"]: o["label"] for o in banks["reasons"]}
        goal = [sid for sid, lab in self.statements.items() if lab == response["goal"]]
        require(len(goal) == 1, "The goal is a bank statement")
        self.goal = goal[0]
        self.kind = {sid: self.read_statement(lab) for sid, lab in self.statements.items()}
        self.rule = {rid: self.read_reason(lab) for rid, lab in self.reasons.items()}

    def read_statement(self, label):
        st = self.setup
        X, Y, r = re.escape(st.X), re.escape(st.Y), re.escape(st.r)
        m = re.fullmatch(rf"The translation by \$\\overrightarrow\{{(\S+?)\}}\$ maps circle \${X}\$ onto circle \${X}'\$, with center \${Y}\$ and radius \$(.+?)\$", label)
        if m:
            vec = m.group(1)
            ok = vec == st.X + st.Y and st.always(lambda e: same(tex_value(m.group(2), e), st.rv(e)))
            return ("move", ok)
        m = re.fullmatch(rf"The translation by \$\\overrightarrow\{{(\S+?)\}}\$ maps circle \${X}\$ onto circle \${Y}\$", label)
        if m:
            ok = m.group(1) == st.X + st.Y and st.always(lambda e: same(st.rv(e), st.sv(e)))
            return ("slide", ok)
        m = re.fullmatch(rf"The translation by \$\\overrightarrow\{{(\S+?)\}}\$ maps circle \${X}\$ onto a circle with center \${Y}\$", label)
        if m:
            return ("reverse", m.group(1) == st.X + st.Y)
        m = re.fullmatch(rf"The dilation about \$(\S+?)\$ by \$(.+?)\$ maps circle \${X}'\$ onto circle \${Y}\$", label)
        if m:
            k = m.group(2)
            ok = m.group(1) == st.Y and st.always(lambda e: same(tex_value(k, e) * st.rv(e), st.sv(e)))
            return ("onto", ok, k)
        m = re.fullmatch(rf"The dilation about \$(\S+?)\$ by \$(.+?)\$ maps circle \${X}\$ onto circle \${Y}\$", label)
        if m:
            # The center of circle X stays at the dilation's center.
            return ("dilate-in-place", m.group(1) == st.Y and st.X == st.Y)
        if label == f"Circle ${st.X}$ is similar to circle ${st.Y}$":
            return ("similar", True)
        if label == "All circles are similar":
            return ("all", True)
        raise ValueError(f"Unread statement: {label!r}")

    def read_reason(self, label):
        st = self.setup
        X, Y = st.X, st.Y
        if label == f"A translation carries ${X}$ to ${Y}$ and keeps every distance":
            return ("translation",)
        m = re.fullmatch(rf"A dilation about \${re.escape(Y)}\$ by \$(.+?)\$ multiplies each distance from \${re.escape(Y)}\$ along its ray by \$(.+?)\$, and \$(.+?)\\cdot ?(.+?)=(.+?)\$", label)
        if m:
            k, k2, k3, rr, ss = m.groups()
            arithmetic = st.always(lambda e: same(tex_value(k3, e) * tex_value(rr, e), tex_value(ss, e)))
            consistent = k == k2 == k3 and st.always(lambda e: same(tex_value(rr, e), st.rv(e)) and same(tex_value(ss, e), st.sv(e)))
            return ("dilation", k) if arithmetic and consistent else ("false",)
        m = re.fullmatch(rf"A dilation about \${re.escape(Y)}\$ by \$(.+?)\$ multiplies each distance from \${re.escape(Y)}\$ by \$(.+?)\$", label)
        if m:
            k, k2 = m.groups()
            # A dilation by k multiplies distances by k, not by anything else.
            return ("dilation", k) if st.always(lambda e: same(tex_value(k, e), tex_value(k2, e))) else ("false",)
        if label == "A dilation is a rigid motion, so it keeps every distance":
            return ("false",)
        if label == "Figures are similar when a sequence of rigid motions and dilations maps one onto the other":
            return ("similarity-definition",)
        if label == f"Circles ${X}$ and ${Y}$ were any two circles: no fact about their centers or radii was used":
            # True only when the radii are letters: numbers are facts.
            return ("generalize",) if not st.numeric else ("false",)
        if label.startswith("Measuring shows circumference"):
            return ("false",)
        if label == "Both circles have the same shape":
            return ("false",)  # this is what "similar" means: circular
        raise ValueError(f"Unread reason: {label!r}")

    def justifications(self, sid, rid):
        """Minimal premise sets with which reason rid proves statement sid."""
        kind, rule = self.kind[sid], self.rule[rid]
        if not kind[1]:
            return []
        moves = [x for x, k in self.kind.items() if k[0] == "move" and k[1]]
        ontos = [x for x, k in self.kind.items() if k[0] == "onto" and k[1]]
        sims = [x for x, k in self.kind.items() if k[0] == "similar"]
        if rule[0] == "translation" and kind[0] in ("move", "slide"):
            return [frozenset()]
        if rule[0] == "dilation" and kind[0] == "onto" and rule[1] == kind[2]:
            # Circle X' exists once the translation has made it.
            return [frozenset({m}) for m in moves]
        if rule[0] == "similarity-definition" and kind[0] == "similar":
            out = [frozenset({m, o}) for m in moves for o in ontos]
            out += [frozenset({x}) for x, k in self.kind.items() if k[0] == "slide" and k[1]]
            return out
        if rule[0] == "generalize" and kind[0] == "all":
            return [frozenset({x}) for x in sims]
        return []

    def closure(self):
        known, changed = set(), True
        while changed:
            changed = False
            for sid in self.statements:
                if sid in known:
                    continue
                if any(p <= known for rid in self.reasons for p in self.justifications(sid, rid)):
                    known.add(sid)
                    changed = True
        return known

    def valid(self, lines):
        seen = set()
        for sid, rid in lines:
            if not sid or not rid or not any(p <= seen for p in self.justifications(sid, rid)):
                return False
            seen.add(sid)
        return self.goal in seen


def review_steps(problem):
    public = problem["public"]
    response = public["response"]
    proof = Proof(public)
    st = proof.setup
    closure = proof.closure()
    require(proof.goal in closure, "The goal is provable")
    if st.numeric:
        require("all" not in [proof.kind[s][0] for s in closure], "Numeric radii never prove that all circles are similar")
        require("Prove that circle" in public["prompt"], "A numeric proof proves one pair")
    else:
        require(proof.kind[proof.goal][0] == "all", "Letters for the radii prove the general statement")
    # No two statements say the same thing (e.g. a factor s - r equal to s/r).
    onto_true = [s for s, k in proof.kind.items() if k[0] == "onto" and k[1]]
    require(len(onto_true) == 1, f"Exactly one dilation statement is true: {onto_true}")
    g = problem["workGrading"]
    require(g["mode"] == "proof" and g["goal"] == proof.goal, "Grading names the goal")
    for sid, by in g["claims"].items():
        for rid, sets in by.items():
            for prem in sets:
                prem = frozenset(prem)
                require(any(prem >= m for m in proof.justifications(sid, rid)), f"Claim {sid} by {rid} from {sorted(prem)} is not valid")
                require(prem <= closure, "A claim rests on unprovable statements")
                STATS["claims"] += 1
    for sid in proof.statements:
        for rid in proof.reasons:
            for m in proof.justifications(sid, rid):
                if not m <= closure:
                    continue
                claimed = [frozenset(p) for p in g["claims"].get(sid, {}).get(rid, [])]
                require(any(c <= m for c in claimed), f"Derived justification of {sid} by {rid} from {sorted(m)} is not claimed")
    rows = response["rows"]
    answer = json.loads(problem["answer"])
    require(len(answer) == len(rows), "One answer row per proof row")
    if response["mode"] == "order":
        by_id = {row["id"]: (row["fields"][0]["given"], row["fields"][1]["given"]) for row in rows}
        require(sorted(answer) == sorted(by_id), "The key orders every shown line once")
        shown = [by_id[row["id"]] for row in rows]
        require(not proof.valid(shown), "The shown order is not already a valid proof")
        require(proof.valid([by_id[i] for i in answer]), "The key is a valid proof")
        # Every valid order of the shown lines is credited by the claims.
        for perm in itertools.permutations(shown):
            if proof.valid(list(perm)):
                seen = set()
                for sid, rid in perm:
                    claimed = [frozenset(p) for p in g["claims"].get(sid, {}).get(rid, [])]
                    require(any(c <= seen for c in claimed), "A valid order is credited")
                    seen.add(sid)
        require("out of order" in public["prompt"], "The prompt says the lines are out of order")
        return problem["answer"]
    lines = []
    for row, cells in zip(rows, answer):
        fs = row["fields"]
        require([f["bank"] for f in fs] == ["statements", "reasons"], "Rows are [statement, reason]")
        given = [f.get("given") for f in fs]
        if response["mode"] == "fill":
            if given[0] is not None:
                require(cells == ["", ""], "Given rows are blank in the key")
                lines.append((given[0], given[1]))
                continue
        lines.append((cells[0], cells[1]))
    require(proof.valid(lines), "The key is a valid proof")
    if response["mode"] == "fill":
        missing = [i for i, row in enumerate(rows) if row["fields"][0].get("given") is None]
        require(len(missing) == 1, "Exactly one line is missing")
        i = missing[0]
        # Every statement and reason that completes the proof at that line.
        fits = [(s, r) for s in proof.statements for r in proof.reasons
                if proof.valid(lines[:i] + [(s, r)] + lines[i + 1:])]
        require(fits == [lines[i]], f"Exactly one completion of the missing line: {fits}")
        m = re.search(r"Line (\d) of the proof is missing", public["prompt"])
        require(m is not None and int(m.group(1)) == i + 1, "The prompt names the missing line")
    return problem["answer"]


# ---------------------------------------------------------------- justify-flaw

def argument_steps(prompt):
    steps = re.findall(r"Step (\d): (.*?)(?= Step \d:| Which reason| Does a step)", prompt)
    return [(int(n), t.strip()) for n, t in steps]


def judge_step(text, st, before):
    """Does this argument step follow from the facts and the steps before it?"""
    X, Y = st.X, st.Y
    m = re.fullmatch(rf"Translate by \$\\overrightarrow\{{(\S+?)\}}\$\. The image of circle \${re.escape(X)}\$ is circle \${re.escape(X)}'\$, with center \${re.escape(Y)}\$ and radius \$(.+?)\$\.", text)
    if m:
        return m.group(1) == X + Y and st.always(lambda e: same(tex_value(m.group(2), e), st.rv(e))), ("move",)
    m = re.fullmatch(rf"Translate by \$\\overrightarrow\{{(\S+?)\}}\$\. The image of circle \${re.escape(X)}\$ is circle \${re.escape(Y)}\$\.", text)
    if m:
        return m.group(1) == X + Y and st.always(lambda e: same(st.rv(e), st.sv(e))), ("slide",)
    m = re.fullmatch(rf"Dilate about \$(\S+?)\$ by \$(.+?)\$\. The image of circle \${re.escape(X)}'\$ is circle \${re.escape(Y)}\$\.", text)
    if m:
        center_ok = m.group(1) == Y  # circle X' has center Y
        factor_ok = st.always(lambda e: same(tex_value(m.group(2), e) * st.rv(e), st.sv(e)))
        return center_ok and factor_ok, ("onto", m.group(1), m.group(2), center_ok, factor_ok)
    if re.fullmatch(rf"A translation followed by a dilation maps circle \${re.escape(X)}\$ onto circle \${re.escape(Y)}\$, so circle \${re.escape(X)}\$ is similar to circle \${re.escape(Y)}\$\.", text):
        return True, ("similar",)
    if re.fullmatch(rf"A translation is a rigid motion, so circle \${re.escape(X)}\$ is similar to circle \${re.escape(Y)}\$\.", text):
        # Follows from the previous step's claim that the image is circle Y.
        return any(k[0] == "slide" for k in before), ("similar",)
    if re.fullmatch(rf"Circles \${re.escape(X)}\$ and \${re.escape(Y)}\$ were any two circles, so all circles are similar\.", text):
        return not st.numeric, ("all",)
    if text == "Therefore all circles are similar.":
        return False, ("all-from-example",)
    if text == "Every circle's circumference divided by its diameter is $\\pi$.":
        return True, ("pi",)
    if re.fullmatch(rf"So circles \${re.escape(X)}\$ and \${re.escape(Y)}\$ have the same ratio of circumference to diameter, and circle \${re.escape(X)}\$ is similar to circle \${re.escape(Y)}\$\.", text):
        return False, ("ratio",)
    if re.fullmatch(rf"Circle \${re.escape(X)}'\$ and circle \${re.escape(Y)}\$ have the same shape, so a similarity transformation maps circle \${re.escape(X)}'\$ onto circle \${re.escape(Y)}\$\.", text):
        return False, ("circular",)
    if re.fullmatch(rf"A translation followed by that similarity transformation maps circle \${re.escape(X)}\$ onto circle \${re.escape(Y)}\$, so circle \${re.escape(X)}\$ is similar to circle \${re.escape(Y)}\$\.", text):
        return True, ("similar",)
    raise ValueError(f"Unread argument step: {text!r}")


def flaw_option(label, st, steps, flawed):
    """Is this option a correct identification of the flaw?"""
    if label == "There is no flaw; the argument is a valid proof.":
        return flawed is None
    m = re.fullmatch(r"Step (\d): (.*)", label)
    require(m is not None, f"Unread flaw option: {label!r}")
    k, why = int(m.group(1)), m.group(2)
    info = dict((n, i) for n, _, i in steps)
    X, Y = st.X, st.Y
    # Is the reason a true statement, and does it explain step k's failure?
    true_and_explains = None
    m2 = re.fullmatch(rf"a dilation about \${re.escape(X)}\$ moves the center \${re.escape(Y)}\$ of circle \${re.escape(X)}'\$ off \${re.escape(Y)}\$", why)
    if m2:
        i = info.get(k)
        true_and_explains = i is not None and i[0] == "onto" and i[1] == X and not i[3]
    m2 = re.fullmatch(r"the scale factor should be \$(.+?)\$", why)
    if m2:
        i = info.get(k)
        right = st.always(lambda e: same(tex_value(m2.group(1), e) * st.rv(e), st.sv(e)))
        true_and_explains = i is not None and i[0] == "onto" and right and not i[4]
    m2 = re.fullmatch(r"the dilation makes the radius \$(.+?)\\cdot ?(.+?)\$, not \$(.+?)\$", why)
    if m2:
        i = info.get(k)
        true_and_explains = (i is not None and i[0] == "onto" and not i[4]
                             and st.always(lambda e: same(tex_value(m2.group(1), e), tex_value(i[2], e)) and same(tex_value(m2.group(2), e), st.rv(e)) and same(tex_value(m2.group(3), e), st.sv(e))))
    m2 = re.fullmatch(rf"a translation keeps radius \$(.+?)\$, so the image is not circle \${re.escape(Y)}\$, whose radius is \$(.+?)\$", why)
    if m2:
        i = info.get(k)
        true_and_explains = (i is not None and i[0] == "slide" and m2.group(1) == st.r and m2.group(2) == st.s
                             and not st.always(lambda e: same(st.rv(e), st.sv(e))))
    if why == "having the same shape is what similar means, so it assumes what is being proved":
        true_and_explains = info.get(k, ("",))[0] == "circular"
    if why == "an equal ratio is a result of similarity; it is not a transformation mapping one circle onto the other":
        true_and_explains = info.get(k, ("",))[0] == "ratio"
    m2 = re.fullmatch(r"the steps used radii \$(.+?)\$ and \$(.+?)\$ only, so they prove only that these two circles are similar", why)
    if m2:
        true_and_explains = info.get(k, ("",))[0] == "all-from-example" and m2.group(1) == st.r and m2.group(2) == st.s
    false_claims = {
        "a translation followed by a dilation is not a similarity transformation",
        "a translation followed by a similarity transformation is not a similarity transformation",
        "circles with different radii are not similar, because they are not congruent",
        "a translation cannot move a circle onto another circle's center",
        "circumference divided by diameter is larger for larger circles",
        "a rigid motion cannot show that two figures are similar",
    }
    if why in false_claims:
        true_and_explains = False
    if re.fullmatch(rf"circle \${re.escape(X)}'\$ and circle \${re.escape(Y)}\$ do not have the same shape", why):
        true_and_explains = False  # all circles do: the flaw is circularity
    if re.fullmatch(rf"the dilation should be about \${re.escape(X)}\$, not \${re.escape(Y)}\$", why):
        true_and_explains = False  # circle X' has center Y
    if re.fullmatch(rf"the translation should be by \$\\overrightarrow\{{{re.escape(Y)}{re.escape(X)}\}}\$", why):
        true_and_explains = False  # that moves X away from Y
    if re.fullmatch(r"circumference divided by diameter is \$2\\pi\$, not \$\\pi\$", why):
        true_and_explains = False
    require(true_and_explains is not None, f"Unread flaw reason: {why!r}")
    return true_and_explains and k == flawed


def justify_option(label, st, kind):
    """Does this option justify a step of the given kind?"""
    X, Y = st.X, st.Y
    if kind == "move":
        if label == f"A translation carries ${X}$ to ${Y}$ and keeps every distance, so each point stays ${st.r}$ from the center":
            return True
        if label in ("A translation multiplies every length by the same factor", f"Circle ${X}$ and circle ${Y}$ have the same center",
                     f"Circles ${X}$ and ${Y}$ have the same shape"):
            return False
    if kind == "onto":
        m = re.fullmatch(rf"Dilating about \${re.escape(Y)}\$ multiplies each distance from \${re.escape(Y)}\$ by \$(.+?)\$, and \$(.+?)\\cdot ?(.+?)=(.+?)\$", label)
        if m:
            k = m.group(1)
            return (k == m.group(2) and st.factor_is_ratio(k)
                    and st.always(lambda e: same(tex_value(m.group(3), e), st.rv(e)) and same(tex_value(m.group(4), e), st.sv(e))))
        m = re.fullmatch(rf"Dilating about \${re.escape(Y)}\$ multiplies each distance from \${re.escape(Y)}\$ by \$(.+?)\$", label)
        if m:
            return False  # wrong factor or incomplete: the radius is not shown to become the other
        if label == "Dilations map circles to circles":
            return False  # true, but says neither center nor radius
        if label.startswith("The circumference becomes"):
            return False  # fixes the size only, not the center
    if kind == "similar":
        if label == "Figures are similar when a sequence of rigid motions and dilations maps one onto the other":
            return True
        if label.startswith("The ratio of their areas") or label == "A dilation is a rigid motion" or label.startswith("Every circle's circumference is"):
            return False
    if kind == "all":
        if label == f"No fact about ${X}$, ${Y}$, ${st.r}$ or ${st.s}$ was used except that they are two circles' centers and radii":
            return not st.numeric
        if label.startswith("Every circle is a dilation of a unit circle, so all circles are congruent") or label.startswith("Every circle's circumference divided by its diameter") or re.fullmatch(r"The same steps work for radii \$\d+\$ and \$\d+\$", label):
            return False
    raise ValueError(f"Unread justification for {kind}: {label!r}")


def explain_option(label):
    if label == "Translate one center onto the other, then dilate about it by the ratio of the radii: one circle lands on the other":
        return True
    if label in ("A translation can map any circle onto any other circle", "Dilations map circles to circles",
                 "All circles have the same shape", "For every circle, circumference divided by diameter is $\\pi$"):
        return False
    raise ValueError(f"Unread explanation: {label!r}")


def solve_flaw(public):
    prompt = public["prompt"]
    st = Setup(prompt)
    options = public["response"]["options"]
    valid = []
    if "Why are all circles similar?" in prompt:
        valid = [o["id"] for o in options if explain_option(o["label"])]
    else:
        raw = argument_steps(prompt)
        steps, before, flawed = [], [], None
        for n, text in raw:
            ok, info = judge_step(text, st, before)
            steps.append((n, ok, info))
            before.append(info)
            if not ok and flawed is None:
                flawed = n
        m = re.search(r"Which reason justifies step (\d)\?", prompt)
        if m:
            require(flawed is None, "A proof to justify is valid")
            kind = dict((n, i) for n, _, i in steps)[int(m.group(1))][0]
            valid = [o["id"] for o in options if justify_option(o["label"], st, kind)]
        else:
            valid = [o["id"] for o in options if flaw_option(o["label"], st, steps, flawed)]
    STATS["options"] += len(options)
    require(len(valid) == 1, f"Exactly one valid option, found {valid}")
    return valid[0]


# ---------------------------------------------------------------- general-map

def simulate(label, center, radius, env):
    """Apply 'Translate by <p, q>, then dilate about (u,v) by k' (either order)."""
    s = label.replace("$", "")
    parts = [p.strip() for p in re.split(r", then ", s)]
    require(len(parts) == 2, f"Two transformations: {label!r}")
    c, r = center, radius
    for part in parts:
        m = re.fullmatch(r"(?:T|t)ranslate by \\langle (.+?),\\ (.+?)\\rangle", part)
        if m:
            c = (c[0] + tex_value(m.group(1), env), c[1] + tex_value(m.group(2), env))
            continue
        m = re.fullmatch(r"(?:D|d)ilate about \((.+?),(.+?)\) by (.+)", part)
        if m:
            z = (tex_value(m.group(1), env), tex_value(m.group(2), env))
            k = tex_value(m.group(3), env)
            c = (z[0] + k * (c[0] - z[0]), z[1] + k * (c[1] - z[1]))
            r = abs(k) * r
            continue
        raise ValueError(f"Unread transformation: {part!r}")
    return c, r


def solve_map(public):
    prompt = public["prompt"]
    options = public["response"]["options"]
    valid = []
    m = re.match(r"Circle \$(\w)\$ has center \$\((.+?),(.+?)\)\$ and radius \$(\w)\$\. Circle \$(\w)\$ has center \$\((.+?),(.+?)\)\$ and radius \$(\w)\$\.", prompt)
    if m:
        _, a, b, r, _, c, d, s = m.groups()
        names = sorted({t[1] for x in (a, b, c, d, r, s) for t in _tokens(x) if t[0] == "var"})
        envs = assignments(names, {})
        for o in options:
            ok = True
            for env in envs:
                center, rad = simulate(o["label"], (tex_value(a, env), tex_value(b, env)), tex_value(r, env), env)
                target = (tex_value(c, env), tex_value(d, env))
                if not (same(center[0], target[0]) and same(center[1], target[1]) and same(rad, tex_value(s, env))):
                    ok = False
                    break
            if ok:
                valid.append(o["id"])
    else:
        m = re.match(r"The proof that all circles are similar translates circle \$(\w)\$ \(radius \$(\w)\$\) so that its center lands on the center of circle \$(\w)\$ \(radius \$(\w)\$\), then dilates about that center\.", prompt)
        require(m is not None, "Unread general-map prompt")
        X, r, Y, s = m.groups()
        envs = assignments([r, s], {})
        for o in options:
            if statement_holds(o["label"], X, Y, r, s, envs):
                valid.append(o["id"])
    STATS["options"] += len(options)
    key = json.dumps(sorted(valid), separators=(",", ":"))
    require(len(valid) == public["response"]["selectionCount"], f"The count named matches the true options: {valid}")
    return key


def statement_holds(label, X, Y, r, s, envs):
    """Is this statement about the proof true for every two circles?"""
    def maps(seq, env, cx, cy):
        # Circle X (center cx, radius r) onto circle Y (center cy, radius s).
        c, rad = cx, env[r]
        for step in seq:
            c, rad = step(c, rad, env)
        return math.hypot(c[0] - cy[0], c[1] - cy[1]) < 1e-9 and same(rad, env[s])

    def dilate_about(z, k_fn):
        return lambda c, rad, env: ((z[0] + k_fn(env) * (c[0] - z[0]), z[1] + k_fn(env) * (c[1] - z[1])), abs(k_fn(env)) * rad)

    centers = [((0.0, 0.0), (0.0, 0.0)), ((-2.0, 1.5), (3.0, -0.5)), ((1.0, 4.0), (-3.5, 2.0))]
    m = re.fullmatch(rf"If the circles are concentric, a dilation alone maps circle \${X}\$ onto circle \${Y}\$", label)
    if m:
        return all(maps([dilate_about((1.3, -0.7), lambda e: e[s] / e[r])], env, (1.3, -0.7), (1.3, -0.7)) for env in envs)
    if re.fullmatch(rf"A translation alone maps circle \${X}\$ onto circle \${Y}\$", label):
        # It keeps the radius, so it fails whenever the radii differ.
        return all(same(env[r], env[s]) for env in envs)
    m = re.fullmatch(r"The dilation's scale factor is \$(.+?)\$, the ratio of the radii", label)
    if m:
        return all(same(tex_value(m.group(1), env), env[s] / env[r]) for env in envs)
    m = re.fullmatch(r"The scale factor is \$(.+?)\$", label)
    if m:
        return all(same(tex_value(m.group(1), env), env[s] / env[r]) for env in envs)
    m = re.fullmatch(r"If \$r=s\$, the scale factor is \$(\d+)\$ and the circles are congruent, a special case of similar", label)
    if m:
        require((r, s) == ("r", "s"), "The equal-radius statement names r and s")
        return int(m.group(1)) == 1  # s/r = 1 and a scale factor 1 is a rigid motion
    if re.fullmatch(rf"Any rigid motion that carries center \${X}\$ to center \${Y}\$ can replace the translation", label):
        # A rotation about Y after the translation still puts circle X on center
        # Y with radius r; then the dilation about Y by s/r finishes.
        for (cx, cy), env in itertools.product(centers, envs):
            rigid = lambda c, rad, env, cx=cx, cy=cy: (_rotate(_add(c, (cy[0] - cx[0], cy[1] - cx[1])), cy, 1.1), rad)
            if not maps([rigid, dilate_about(cy, lambda e: e[s] / e[r])], env, cx, cy):
                return False
        return True
    if label == "The dilation must be centered at the origin":
        # A dilation about the origin moves center Y unless Y is the origin.
        cx, cy = centers[1]
        env = envs[0]
        return maps([lambda c, rad, env: (cy, rad), dilate_about((0.0, 0.0), lambda e: e[s] / e[r])], env, cx, cy)
    if label == "Circles with different radii are not similar because they are not congruent":
        return False  # similar figures need not be congruent
    if label == "The proof works only when $r<s$":
        # It works as well for r > s: the factor s/r is then less than 1.
        env = {r: 5.0, s: 2.0}
        cx, cy = centers[1]
        return not maps([lambda c, rad, env: (cy, rad), dilate_about(cy, lambda e: e[s] / e[r])], env, cx, cy)
    raise ValueError(f"Unread statement: {label!r}")


def _add(a, b):
    return (a[0] + b[0], a[1] + b[1])


def _rotate(p, c, t):
    x, y = p[0] - c[0], p[1] - c[1]
    return (c[0] + x * math.cos(t) - y * math.sin(t), c[1] + x * math.sin(t) + y * math.cos(t))


# ---------------------------------------------------------------- entry points

def solve(public):
    t = public["templateId"]
    require(t in SUPPORTED, f"Unsupported template {t}")
    if t == "circle-similarity-justify-flaw":
        return solve_flaw(public)
    if t == "circle-similarity-general-map":
        return solve_map(public)
    proof = Proof(public)
    require(proof.goal in proof.closure(), "The goal is not provable")
    return "provable:" + ",".join(sorted(proof.closure()))


def review_problem(problem):
    STATS["cases"] += 1
    t = problem["public"]["templateId"]
    require(t in SUPPORTED, f"Unsupported template {t}")
    if t == "circle-similarity-proof-steps":
        return review_steps(problem)
    return solve(problem["public"])


# ---------------------------------------------------------------- self test

def _rejects(fn, why):
    try:
        fn()
    except (ValueError, KeyError, StopIteration, TypeError, ZeroDivisionError, IndexError):
        return
    raise ValueError(f"Self-test mutation accepted: {why}")


def _proof_fixture():
    stmts = [("sa", "The translation by $\\overrightarrow{CD}$ maps circle $C$ onto circle $C'$, with center $D$ and radius $r$"),
             ("sb", "The dilation about $D$ by $\\frac{s}{r}$ maps circle $C'$ onto circle $D$"),
             ("sc", "The dilation about $D$ by $\\frac{r}{s}$ maps circle $C'$ onto circle $D$"),
             ("sd", "Circle $C$ is similar to circle $D$"), ("se", "All circles are similar"),
             ("sf", "The translation by $\\overrightarrow{CD}$ maps circle $C$ onto circle $D$")]
    reasons = [("ra", "A translation carries $C$ to $D$ and keeps every distance"),
               ("rb", "A dilation about $D$ by $\\frac{s}{r}$ multiplies each distance from $D$ along its ray by $\\frac{s}{r}$, and $\\frac{s}{r}\\cdot r=s$"),
               ("rc", "Figures are similar when a sequence of rigid motions and dilations maps one onto the other"),
               ("rd", "Circles $C$ and $D$ were any two circles: no fact about their centers or radii was used"),
               ("re", "Both circles have the same shape")]
    rows = [{"id": f"r{i}", "fields": [{"kind": "choice", "label": "Statement", "bank": "statements"}, {"kind": "choice", "label": "Reason", "bank": "reasons"}]} for i in range(1, 5)]
    public = {"templateId": "circle-similarity-proof-steps",
              "prompt": "Circle $C$ has center $C$ and radius $r$. Circle $D$ has center $D$ and radius $s$. They stand for any two circles. Prove that all circles are similar. Build the proof: choose a statement and a reason for each line.",
              "response": {"kind": "structured-work", "label": "Your proof", "layout": "proof", "goal": "All circles are similar", "mode": "build", "rows": rows,
                           "banks": [{"id": "statements", "label": "Statement", "options": [{"id": i, "label": l} for i, l in stmts]},
                                     {"id": "reasons", "label": "Reason", "options": [{"id": i, "label": l} for i, l in reasons]}]}}
    claims = {"sa": {"ra": [[]]}, "sb": {"rb": [["sa"]]}, "sd": {"rc": [["sa", "sb"]]}, "se": {"rd": [["sd"]]}}
    return {"public": public, "answer": json.dumps([["sa", "ra"], ["sb", "rb"], ["sd", "rc"], ["se", "rd"]], separators=(",", ":")),
            "workGrading": {"mode": "proof", "goal": "se", "claims": claims}}


def self_test():
    require(same(tex_value("\\frac{s}{r}\\cdot r", {"s": 3.0, "r": 2.0}), 3.0), "TeX product")
    require(same(tex_value("c-\\frac{s}{r}a", {"c": 1.0, "s": 4.0, "r": 2.0, "a": 3.0}), -5.0), "implicit product")
    require(same(tex_value("\\frac{r_2}{r_1}", {"r_1": 2.0, "r_2": 5.0}), 2.5), "subscripts")
    proof = _proof_fixture()
    require(review_steps(proof) == proof["answer"], "proof fixture")
    order = json.loads(json.dumps(proof))
    order["answer"] = json.dumps([["sb", "rb"], ["sa", "ra"], ["sd", "rc"], ["se", "rd"]])
    _rejects(lambda: review_steps(order), "the dilation before circle C' exists")
    loose = json.loads(json.dumps(proof))
    loose["workGrading"]["claims"]["sd"]["rc"] = [["sb"]]
    _rejects(lambda: review_steps(loose), "similarity from the dilation alone")
    missing = json.loads(json.dumps(proof))
    del missing["workGrading"]["claims"]["se"]
    _rejects(lambda: review_steps(missing), "a derived justification left unclaimed")
    numeric = json.loads(json.dumps(proof))
    numeric["public"]["prompt"] = numeric["public"]["prompt"].replace("radius $r$", "radius $6$").replace("radius $s$", "radius $8$")
    _rejects(lambda: review_steps(numeric), "letters in the bank with numbers in the prompt")
    # A flaw item: the inverted scale factor.
    flaw = {"templateId": "circle-similarity-justify-flaw",
            "prompt": "Circle $A$ has center $A$ and radius $r$; circle $B$ has center $B$ and radius $s$. Here is an argument that all circles are similar. Step 1: Translate by $\\overrightarrow{AB}$. The image of circle $A$ is circle $A'$, with center $B$ and radius $r$. Step 2: Dilate about $B$ by $\\frac{r}{s}$. The image of circle $A'$ is circle $B$. Step 3: A translation followed by a dilation maps circle $A$ onto circle $B$, so circle $A$ is similar to circle $B$. Step 4: Circles $A$ and $B$ were any two circles, so all circles are similar. Does a step fail to follow from the facts and steps before it? Choose the flawed step and why, or choose that there is no flaw.",
            "response": {"kind": "choice", "label": "x", "options": [
                {"id": "option-a", "label": "There is no flaw; the argument is a valid proof."},
                {"id": "option-b", "label": "Step 2: the dilation makes the radius $\\frac{r}{s}\\cdot r$, not $s$"},
                {"id": "option-c", "label": "Step 2: the dilation should be about $A$, not $B$"},
                {"id": "option-d", "label": "Step 1: a translation cannot move a circle onto another circle's center"}]}}
    require(solve(flaw) == "option-b", "inverted factor flaw")
    fixed = json.loads(json.dumps(flaw))
    fixed["prompt"] = fixed["prompt"].replace("by $\\frac{r}{s}$", "by $\\frac{s}{r}$")
    require(solve(fixed) == "option-a", "a valid argument has no flaw")
    # A sequence item.
    seq = {"templateId": "circle-similarity-general-map",
           "prompt": "Circle $M$ has center $(a,b)$ and radius $r$. Circle $N$ has center $(c,d)$ and radius $s$. Which sequences map circle $M$ onto circle $N$ for every choice of $a$, $b$, $c$, $d$ and positive $r$, $s$? Select the 2 sequences that do.",
           "response": {"kind": "multi-select", "label": "x", "selectionCount": 2, "options": [
               {"id": "option-a", "label": "Translate by $\\langle c-a,\\ d-b\\rangle$, then dilate about $(c,d)$ by $\\frac{s}{r}$"},
               {"id": "option-b", "label": "Dilate about $(0,0)$ by $\\frac{s}{r}$, then translate by $\\langle c-a,\\ d-b\\rangle$"},
               {"id": "option-c", "label": "Dilate about $(a,b)$ by $\\frac{s}{r}$, then translate by $\\langle c-a,\\ d-b\\rangle$"},
               {"id": "option-d", "label": "Translate by $\\langle c-a,\\ d-b\\rangle$, then dilate about $(c,d)$ by $s-r$"}]}}
    require(solve(seq) == '["option-a","option-c"]', "sequences")
    three = json.loads(json.dumps(seq))
    three["response"]["selectionCount"] = 3
    _rejects(lambda: solve(three), "a count that disagrees with the true sequences")
    return True
