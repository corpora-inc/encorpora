#!/usr/bin/env python3
"""Independent review of the on-curve point-plot families.

Public payloads only: the prompt equation, grid and required-point wording are
parsed here with an exact-rational LaTeX evaluator that shares nothing with the
generator or point_plot_math_oracle.py. The server grader is exercised as a
black box (tests/point-plot-curves-grade.ts) with candidate responses derived
from this file's own lattice enumeration.

Usage: python3 scripts/point_plot_curves_review.py [--seeds N]
"""
import itertools, json, math, os, random, re, subprocess, sys, tempfile
from fractions import Fraction as F

HERE = os.path.dirname(os.path.abspath(__file__))
AMP = os.path.dirname(HERE)
IDS = ["graph-quadratic-points", "graph-absolute-value-points",
       "graph-exponential-points", "graph-sqrt-points"]

class Undefined(Exception):
    pass

# ---- LaTeX -> exact evaluator -------------------------------------------
TOK = re.compile(r"\\left|\\right|\\cdot|\\frac|\\sqrt|\d+|x|[-+^(){}|]")

def tokens(s):
    s = s.replace(" ", "")
    out, i = [], 0
    while i < len(s):
        m = TOK.match(s, i)
        if not m:
            raise ValueError(f"cannot tokenize {s[i:]!r}")
        if m.group() not in ("\\left", "\\right"):
            out.append(m.group())
        i = m.end()
    return out

def irr_sqrt(v):
    if v < 0:
        raise Undefined
    n, d = v.numerator, v.denominator
    rn, rd = math.isqrt(n), math.isqrt(d)
    if rn * rn != n or rd * rd != d:
        raise Undefined  # irrational: not a lattice value
    return F(rn, rd)

class P:
    def __init__(self, toks):
        self.t, self.i = toks, 0
        self.marks = []
        self.inabs = 0  # inner expressions of | | and sqrt
    def peek(self):
        return self.t[self.i] if self.i < len(self.t) else None
    def eat(self, v=None):
        tok = self.peek()
        if v and tok != v:
            raise ValueError(f"expected {v} got {tok}")
        self.i += 1
        return tok
    def expr(self):
        terms = [self.term()]
        while self.peek() in ("+", "-"):
            op = self.eat()
            t = self.term()
            terms.append((lambda f: lambda x: -f(x))(t) if op == "-" else t)
        return lambda x: sum(t(x) for t in terms)
    def term(self):
        neg = False
        while self.peek() in ("-", "+"):
            neg ^= self.eat() == "-"
        fs = [self.power()]
        while self.peek() not in (None, "+", "-", ")", "}") and not (self.peek() == "|" and self.inabs):
            if self.peek() == "\\cdot":
                self.eat()
            fs.append(self.power())
        def f(x):
            r = F(1)
            for g in fs:
                r *= g(x)
            return -r if neg else r
        return f
    def power(self):
        base = self.atom()
        if self.peek() == "^":
            self.eat()
            if self.peek() == "{":
                self.eat("{"); e = self.expr(); self.eat("}")
            else:
                e = self.atom()
            return lambda x: self.pw(base(x), e(x))
        return base
    @staticmethod
    def pw(b, e):
        if e.denominator != 1 or abs(e) > 60:
            raise Undefined
        return b ** int(e) if b != 0 or e >= 0 else (_ for _ in ()).throw(Undefined())
    def atom(self):
        t = self.eat()
        if t == "x": return lambda x: F(x)
        if t.isdigit(): return lambda x, n=int(t): F(n)
        if t == "\\frac":
            self.eat("{"); a = self.expr(); self.eat("}")
            self.eat("{"); b = self.expr(); self.eat("}")
            return lambda x: a(x) / b(x)
        if t == "\\sqrt":
            self.eat("{"); a = self.expr(); self.eat("}")
            self.marks.append(("sqrt", a))
            return lambda x: irr_sqrt(a(x))
        if t == "(":
            a = self.expr(); self.eat(")"); return a
        if t == "|":
            self.inabs += 1; a = self.expr(); self.inabs -= 1; self.eat("|")
            self.marks.append(("abs", a))
            return lambda x: abs(a(x))
        raise ValueError(f"unexpected {t}")

def parse_prompt(prompt):
    m = re.match(r"Graph \$y = (.+?)\$ by placing (.+)\.$", prompt)
    assert m, prompt
    p = P(tokens(m.group(1)))
    f = p.expr()
    assert p.peek() is None, prompt
    return f, p.marks, m.group(2)

def val(f, x):
    try:
        return f(x)
    except Undefined:
        return None
    except ZeroDivisionError:
        return None

def zero_of_linear(a):
    a0, a1 = a(0), a(1)
    return -a0 / (a1 - a0)

def required_features(tid, f, marks, wording):
    """(required lattice points, number of other points) from wording."""
    m = re.search(r"its (vertex|starting point|\$y\$-intercept) and (\d+) more points", wording)
    if not m:
        m2 = re.fullmatch(r"(\d+) points", wording)
        assert m2, wording
        return None, int(m2.group(1)), []
    kind, others = m.group(1), int(m.group(2))
    if kind == "vertex" and tid == "graph-absolute-value-points":
        x0 = zero_of_linear(marks[0][1])
    elif kind == "starting point":
        x0 = zero_of_linear(marks[0][1])
    elif kind == "vertex":  # quadratic: exact from three values
        y0, y1, ym = f(0), f(1), f(-1)
        a = (y1 + ym) / 2 - y0
        b = (y1 - ym) / 2
        x0 = -b / (2 * a)
    else:
        x0 = F(0)
    return kind, others + 1, [x0]

def lattice(f, g):
    pts = []
    for x in range(g["xMin"], g["xMax"] + 1, g["step"]):
        y = val(f, x)
        if y is not None and y.denominator == 1 and g["yMin"] <= y <= g["yMax"] \
                and (int(y) - g["yMin"]) % g["step"] == 0:
            pts.append((x, int(y)))
    return pts

# ---- main ----------------------------------------------------------------
def run_ts(script, *args, stdin=None):
    r = subprocess.run(["npx", "tsx", os.path.join(HERE, script), *args],
                       cwd=AMP, capture_output=True, text=True, input=stdin)
    if r.returncode:
        sys.exit(r.stderr)
    return r.stdout

def main():
    seeds = 300
    if "--seeds" in sys.argv:
        seeds = int(sys.argv[sys.argv.index("--seeds") + 1])
    cases = json.loads(run_ts("../tests/point-plot-curves-export.ts", str(seeds)))
    rng = random.Random(7)
    fails, checks, jobs = [], 0, []
    def fail(c, msg):
        fails.append(f'{c["id"]} {c["seed"]}: {msg}')
    for c in cases:
        pub, g = c["public"], c["public"]["response"]["grid"]
        f, marks, wording = parse_prompt(pub["prompt"])
        _, k, req = required_features(c["id"], f, marks, wording)
        pts = lattice(f, g)
        resp = pub["response"]
        # (1)(2) enumerations and required features
        if resp["pointCount"] != k: fail(c, f"pointCount {resp['pointCount']} != {k}")
        if len(pts) < k: fail(c, f"only {len(pts)} lattice points < {k}")
        reqp = []
        for x0 in req:
            if x0.denominator != 1: fail(c, f"required x {x0} not integer"); continue
            y0 = val(f, int(x0))
            if y0 is None or y0.denominator != 1 or (int(x0), int(y0)) not in pts:
                fail(c, f"required feature ({x0},{y0}) not a lattice point on grid")
            else:
                reqp.append((int(x0), int(y0)))
        if len(pts) - len(reqp) < k - len(reqp): fail(c, "too few non-required points")
        if resp["ordered"] or resp["connect"] != "curve": fail(c, "must be unordered curve")
        if set(pub) & {"grading", "pointGrading", "answer", "curve"} or \
           set(resp) - {"kind","label","grid","pointCount","ordered","connect"}:
            fail(c, f"public payload keys leak: {sorted(pub)} {sorted(resp)}")
        # (4) hint must not list the answer set
        ans = [tuple(p) for p in json.loads(c["answer"])]
        hinted = [p for p in ans if re.search(rf"\(\s*{p[0]}\s*,\s*{p[1]}\s*\)", c["hint"])]
        if hinted: fail(c, f"hint names answer points {hinted}")
        if re.search(r"\\sqrt|x\^2", c["hint"]) is None and False: pass
        # candidates
        onset = set(pts)
        grid_off = [(x, y) for x in range(g["xMin"], g["xMax"] + 1)
                    for y in range(g["yMin"], g["yMax"] + 1) if (x, y) not in onset]
        cand = []
        def add(name, ps, expect):
            cand.append({"name": name, "response": json.dumps([list(p) for p in ps], separators=(",", ":")), "expect": expect})
        others = [p for p in pts if p not in reqp]
        for _ in range(6):
            s = reqp + rng.sample(others, k - len(reqp)); rng.shuffle(s)
            add("valid", s, True)
        base = reqp + others[:k - len(reqp)]
        add("valid-all-first", base, True)
        add("valid-reversed", base[::-1], True)
        i = rng.randrange(k)
        bad = rng.choice([p for p in grid_off if p not in base]) if grid_off else None
        if bad:
            s = base[:]; s[i] = bad; add("one-off-curve", s, False)
            near = (base[i][0], base[i][1] + 1)
            if near not in onset and g["yMin"] <= near[1] <= g["yMax"]:
                s = base[:]; s[i] = near; add("near-miss", s, False)
        add("duplicate", [base[0]] * 2 + base[2:] if k >= 2 else base * 2, False)
        add("too-few", base[:-1], False)
        if len(pts) > k: add("too-many", base + [p for p in pts if p not in base][:1], False)
        if reqp and len(others) >= k:
            add("missing-required", others[:k], False)
        # off-grid but on the curve (extend beyond grid)
        xs = range(g["xMin"] - 6, g["xMax"] + 7)
        offg = [(x, int(y)) for x in xs if (y := val(f, x)) is not None and y.denominator == 1
                and not (g["xMin"] <= x <= g["xMax"] and g["yMin"] <= y <= g["yMax"])]
        if offg:
            s = base[:]; s[-1 if base[-1] not in reqp else 0] = offg[0]
            s = list(dict.fromkeys(s))
            if len(set(s)) == k:
                add("off-grid-on-curve", s, False)
        for cd in cand:
            jobs.append({"id": c["id"], "seed": c["seed"], **cd})
        checks += 1
    verdicts = json.loads(run_ts("../tests/point-plot-curves-grade.ts",
                                 stdin=json.dumps(jobs)))
    stats = {}
    for j, got in zip(jobs, verdicts):
        stats[j["name"]] = stats.get(j["name"], 0) + 1
        if got != j["expect"]:
            fails.append(f'{j["id"]} {j["seed"]}: grader {got} for {j["name"]} {j["response"]}')
    print(f"cases {checks} ({seeds}/family), grader probes {len(jobs)}: {stats}")
    print(f"FAILURES {len(fails)}")
    for x in fails[:40]: print(" ", x)
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
