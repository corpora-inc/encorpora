"""Independent review of the Regents shown-work families (structured-work-v1).

Templates: density-volume-steps, sas-area-steps, trig-leg-steps,
elevation-depression-steps, isosceles-perimeter-steps, ring-area-steps,
parallelogram-angle-steps, parallel-segment-steps, two-radical-steps,
grouped-both-sides-steps and exponential-time-steps.

Every expected step is derived from the public payload only: the prompt and
the row labels. The answer key, the private `workGrading` rule, the hint and
the explanation are values under test. Geometry and logarithms are computed
here from the givens; roundings are exact (half up on a Fraction of the
double-precision value), and a rounded intermediate must give the same final
answer as the unrounded calculation, so a correct learner path is never
marked wrong. The equation of the radical family is solved by brute force over
the integers and its squared quadratic is derived with polynomial arithmetic.
"""

import json
import math
import re
from fractions import Fraction as F

from structured_sweep_math_oracle import frac_text, pconst, padd, pmul, pscale, parse_poly, pval

SUPPORTED = frozenset({
    "density-volume-steps", "sas-area-steps", "trig-leg-steps", "elevation-depression-steps",
    "isosceles-perimeter-steps", "ring-area-steps", "parallelogram-angle-steps",
    "parallel-segment-steps", "two-radical-steps", "grouped-both-sides-steps",
    "exponential-time-steps",
})
REVIEW_RETURNS_ANSWER = True
STATS = {"cases": 0, "fieldsChecked": 0, "claimsChecked": 0}


def require(condition, message):
    # Not assert: python -O must not disable review gates.
    if not condition:
        raise ValueError(message)


def rnd(x, places):
    """Exact round half up of a float or Fraction to `places` decimals."""
    x = F(x)
    scale = F(10) ** places
    y = x * scale
    n = math.floor(y + F(1, 2)) if y >= 0 else -math.floor(-y + F(1, 2))
    return F(n) / scale


def both_ways(full, rebuilt, places):
    """The rounded step and the full value round to the same number, away from a tie."""
    a, b = rnd(full, places), rnd(rebuilt, places)
    require(a == b, f"Rounding path changes the answer: {a} vs {b}")
    for v in (full, rebuilt):
        s = abs(F(v)) * 10 ** places
        require(abs(s - math.floor(s) - F(1, 2)) > F(1, 100), "Value is too close to a rounding tie")
    return a


def sin_d(d):
    return F(math.sin(math.radians(d)))


def cos_d(d):
    return F(math.cos(math.radians(d)))


def tan_d(d):
    return F(math.tan(math.radians(d)))


PI = F(math.pi)


def nums(text):
    return [F(x) for x in re.findall(r"-?\d+(?:\.\d+)?", text.replace(",", ""))]


def tex_vals(prompt):
    """Numbers written as $12.5$ in the prompt, in order."""
    return [F(x) for x in re.findall(r"\$(-?\d+(?:\.\d+)?)\$", prompt)]


def rows_of(public):
    return public["response"]["rows"]


def by_label(public, table):
    """One list per row; the first table key contained in the label picks the value."""
    out = []
    for row in rows_of(public):
        label = row["label"]
        for key, value in table:
            if key in label:
                out.append([value])
                break
        else:
            raise ValueError(f"Unknown row {label!r}")
    return out


# ----------------------------------------------------------------- derive

def _density(public):
    p = public["prompt"]
    if "cylindrical bucket" in p:
        d, h, rho = tex_vals(p)[:3]
        r = d / 2
        vol = PI * r * r * h
        v3 = rnd(vol, 3)
        w = both_ways(vol * rho, v3 * rho, 0)
        return by_label(public, [("radius", r), ("volume in cubic feet", v3), ("weight", w)])
    if "sculptor" in p:
        kg = F(re.search(r"has (\d+) kilograms", p)[1])
        rho, side, height = tex_vals(p)[:3]
        vol = side * side * height / 3
        each = vol * rho
        grams = kg * 1000
        count = math.floor(grams / each)
        return by_label(public, [("volume of one pyramid", vol), ("mass of one pyramid", each),
                                 ("mass of the clay", grams), ("number of whole pyramids", F(count))])
    if "trophy" in p:
        side, prism_h, pyr_h, rho = tex_vals(p)[:4]
        prism = side * side * prism_h
        pyr = side * side * pyr_h / 3
        total = prism + pyr
        mass = total * rho
        require(mass % 1 != F(1, 2), "Mass is not a rounding tie")
        return by_label(public, [("volume of the prism", prism), ("volume of the pyramid", pyr),
                                 ("volume of the whole trophy", total), ("mass of the trophy", rnd(mass, 0))])
    raise ValueError("Unknown density prompt")


def _sas(public):
    p = public["prompt"]
    a, b, ang = tex_vals(p)[0], F(re.search(r"and \$([\d.]+)\$ cm", p)[1]), F(re.search(r"measures \$(\d+)\^", p)[1])
    half = a * b / 2
    s = sin_d(ang)
    area = both_ways(half * s, half * rnd(s, 4), 1)
    return by_label(public, [("Half the product", half), ("sin", rnd(s, 4)), ("area", area)])


def _trig_leg(public):
    p = public["prompt"]
    hyp, ang = F(re.search(r"AB=(\d+)", p)[1]), F(re.search(r"m\\angle A=(\d+)", p)[1])
    target = re.search(r"Find \$(\w\w)\$", p)[1]
    require(target in ("BC", "AC"), "Target leg")
    ratio = sin_d(ang) if target == "BC" else cos_d(ang)
    leg = both_ways(hyp * ratio, hyp * rnd(ratio, 4), 1)
    out = []
    for row in rows_of(public):
        label = row["label"]
        if label.startswith("$\\sin") or label.startswith("$\\cos"):
            require(label.startswith("$\\sin" if target == "BC" else "$\\cos"), "Sine for the opposite leg, cosine for the adjacent")
            out.append([rnd(ratio, 4)])
        elif label.startswith("The length of"):
            require(f"${target}$" in label, "Row names the target leg")
            out.append([leg])
        else:
            raise ValueError(f"Unknown row {label!r}")
    return out


def _elevation(public):
    p = public["prompt"]
    d = F(re.search(r"is \$(\d+)\$ feet from", p)[1])
    up = F(re.search(r"elevation to the top of the \w+ is \$(\d+)\^", p)[1])
    down = F(re.search(r"depression to its base is \$(\d+)\^", p)[1])
    upper, lower = d * tan_d(up), d * tan_d(down)
    h = both_ways(upper + lower, rnd(upper, 3) + rnd(lower, 3), 0)
    return by_label(public, [("above the horizontal", rnd(upper, 3)), ("below the horizontal", rnd(lower, 3)), ("The height of the", h)])


def _isosceles(public):
    p = public["prompt"]
    apex = F(re.search(r"apex angle of \$(\d+)\^", p)[1])
    h = F(re.search(r"apex to the base is \$(\d+)\$ cm", p)[1])
    half = apex / 2
    hb, leg = h * tan_d(half), h / cos_d(half)
    per = both_ways(2 * hb + 2 * leg, 2 * rnd(hb, 3) + 2 * rnd(leg, 3), 1)
    return by_label(public, [("Half the apex", half), ("Half the base", rnd(hb, 3)), ("equal sides", rnd(leg, 3)), ("perimeter", per)])


def _ring(public):
    p = public["prompt"]
    v = tex_vals(p)
    value, border = v[0], v[1]
    inner = value / 2 if "diameter" in p else value
    outer = inner + border
    k = outer * outer - inner * inner
    area = rnd(PI * k, 0)
    require(abs(PI * k - math.floor(PI * k) - F(1, 2)) > F(1, 100), "Area is not a tie")
    return by_label(public, [("radius of the circle", outer), ("multiplies", k), ("area of the walkway", area)])


def _parallelogram(public):
    p = public["prompt"]
    m = re.search(r"m\\angle (ABC|ADC)=(\d+)\^", p)
    angle = F(m[2])
    outside = "on line" in p
    adjacent = 180 - angle if outside else angle
    require(adjacent < 90, "The perpendicular triangle has an acute angle at the vertex")
    return [[adjacent], [90 - adjacent]]


def _parallel(public):
    p = public["prompt"]
    ad, db, ae = [F(x) for x in re.search(r"AD=(\d+)\$, \$DB=(\d+)\$ and \$AE=(\d+)", p).groups()]
    scale = ae / ad
    require(scale.denominator == 1, "Whole scale factor")
    ec = db * scale
    whole = "length of $\\overline{AC}$" in p
    out = [[scale], [ec]]
    if whole:
        out.append([ae + ec])
    require(len(out) == len(rows_of(public)), "One row per step")
    return out


def _radical(public):
    p = public["prompt"]
    m = re.search(r"Solve \$\\sqrt\{(.+?)\}(-|=)\\sqrt\{(.+?)\}(?:=|\+)(\d+)\$", p)
    require(m, "Radical prompt")
    first, second, c = parse_poly(m[1]), parse_poly(m[3]), F(m[4])
    if m[2] == "-":
        pass  # sqrt(R1) - sqrt(R2) = c
    # sqrt(R1) = sqrt(R2) + c in both arrangements
    lin = padd(padd(first, second, -1), pconst(c * c), -1)
    quad = padd(pmul(lin, lin), pscale(second, 4 * c * c), -1)
    coeffs = [quad.get(2, F(0)), quad.get(1, F(0)), quad.get(0, F(0))]

    def holds(x):
        r1, r2 = pval(first, x), pval(second, x)
        if r1 < 0 or r2 < 0:
            return False
        return abs(math.sqrt(r1) - math.sqrt(r2) - float(c)) < 1e-9

    roots = [F(x) for x in range(-200, 2001) if pval(quad, x) == 0]
    good = [x for x in roots if holds(x)]
    bad = [x for x in roots if not holds(x)]
    require(len(good) == 1 and len(bad) == 1, "One solution and one extraneous value")
    return by_label(public, [("coefficient of $x^2$", coeffs[0]), ("coefficient of $x$", coeffs[1]), ("constant term", coeffs[2]),
                             ("satisfies", good[0]), ("extraneous", bad[0])])


def _grouped(public):
    p = public["prompt"]
    eq = re.search(r"Solve \$(.+?)\$ for", p)[1]
    left, right = eq.split("=")
    grouped, other = (left, right) if "(" in left else (right, left)
    require("(" in grouped and "(" not in other, "The parentheses are on one side")
    g, o = parse_poly(grouped), parse_poly(other)
    net = g.get(1, F(0)) - o.get(1, F(0))
    const = o.get(0, F(0)) - g.get(0, F(0))
    require(net != 0, "A single solution")
    return by_label(public, [("parentheses removed", g), ("coefficient of $x$", net), ("number on the other side", const), ("solution", const / net)])


def _exponential(public):
    p = public["prompt"]
    target = F(re.search(r"reach (\d+)\?", p)[1])
    natural = re.search(r"N\(t\)=(\d+)e\^\{([\d.]+)t\}", p)
    plain = re.search(r"N\(t\)=(\d+)\\cdot([\d.]+)\^\{t\}", p)
    require(bool(natural) != bool(plain), "One model form")
    start = F((natural or plain)[1])
    ratio = target / start
    ln_r = F(math.log(ratio))
    if natural:
        k = F(natural[2])
        t = both_ways(ln_r / k, rnd(ln_r, 4) / k, 2)
        rows = [("target divided", ratio), ("logarithm of that ratio", rnd(ln_r, 4)), ("The time", t)]
    else:
        b = F(plain[2])
        ln_b = F(math.log(b))
        t = both_ways(ln_r / ln_b, rnd(ln_r, 4) / rnd(ln_b, 4), 2)
        rows = [("target divided", ratio), ("logarithm of that ratio", rnd(ln_r, 4)), ("logarithm of " + plain[2], rnd(ln_b, 4)), ("The time", t)]
    return by_label(public, rows)


DERIVE = {
    "density-volume-steps": _density,
    "sas-area-steps": _sas,
    "trig-leg-steps": _trig_leg,
    "elevation-depression-steps": _elevation,
    "isosceles-perimeter-steps": _isosceles,
    "ring-area-steps": _ring,
    "parallelogram-angle-steps": _parallelogram,
    "parallel-segment-steps": _parallel,
    "two-radical-steps": _radical,
    "grouped-both-sides-steps": _grouped,
    "exponential-time-steps": _exponential,
}


# ----------------------------------------------------------------- review

def expected_fields(public):
    return DERIVE[public["templateId"]](public)


def field_matches(expected, text, kind):
    if kind == "number":
        return re.fullmatch(r"-?\d+(\.\d+)?(/\d+)?", text) is not None and F(text) == F(expected)
    return parse_poly(text) == expected


def render(v, fld):
    if isinstance(v, dict):
        parts = []
        for k in sorted(v, reverse=True):
            c = v[k]
            body = (frac_text(abs(c)) if (abs(c) != 1 or k == 0) else "") + ("x" if k else "") + (f"^{k}" if k > 1 else "")
            parts.append(("-" if c < 0 else ("+" if parts else "")) + body)
        return "".join(parts) or "0"
    x = F(v)
    if x.denominator == 1:
        return str(x.numerator)
    text = f"{float(x):.9f}".rstrip("0").rstrip(".")
    require(F(text) == x, f"{x} is not a finite decimal")
    return text


def solve(public):
    t = public["templateId"]
    require(t in SUPPORTED, f"Unsupported template {t}")
    return json.dumps([[repr(v) for v in vals] for vals in expected_fields(public)])


def expected_key(public):
    expected = expected_fields(public)
    rows = rows_of(public)
    require(len(expected) == len(rows), "One expected list per row")
    out = []
    for row, vals in zip(rows, expected):
        require(len(vals) == len(row["fields"]), f"Row {row['label']!r} has {len(vals)} values")
        cells = []
        for fld, v in zip(row["fields"], vals):
            if "given" in fld:
                require(field_matches(v, fld["given"], fld["kind"]), f"Given value {fld['given']!r} is wrong for {row['label']!r}")
                cells.append("")
            else:
                cells.append(render(v, fld))
        out.append(cells)
    return out


def review_problem(problem):
    public = problem["public"]
    t = public["templateId"]
    require(t in SUPPORTED, f"Unsupported template {t}")
    STATS["cases"] += 1
    response = public["response"]
    require(response["kind"] == "structured-work" and response["layout"] == "steps", "Steps layout")
    require(response["mode"] in ("build", "fill"), "Build or fill")
    require(("Some steps are filled in" if response["mode"] == "fill" else "Enter each step") in public["prompt"], "Prompt names the mode")
    key = expected_key(public)
    answer = json.loads(problem["answer"])
    rows = rows_of(public)
    expected = expected_fields(public)
    require(isinstance(answer, list) and len(answer) == len(rows), "Answer has one list per row")
    for row, cells, vals in zip(rows, answer, expected):
        require(len(cells) == len(row["fields"]), "Answer has one cell per field")
        for fld, cell, v in zip(row["fields"], cells, vals):
            if "given" in fld:
                require(cell == "", "Given cells are blank in the key")
            else:
                require(field_matches(v, cell, fld["kind"]), f"Key cell {cell!r} is not {v!r} for {row['label']!r}")
                STATS["fieldsChecked"] += 1
    grading = problem["workGrading"]
    require(grading["mode"] == "fields" and len(grading["fields"]) == len(rows), "Per-field rules")
    for row, rules, vals in zip(rows, grading["fields"], expected):
        require(len(rules) == len(row["fields"]), "One rule per field")
        for fld, rule, v in zip(row["fields"], rules, vals):
            if "given" in fld:
                require(rule is None, "A given field has no rule")
                continue
            require(rule is not None and rule["kind"] == fld["kind"], "Rule kind matches the field")
            require(field_matches(v, rule["value"], fld["kind"]), f"Rule {rule['value']!r} is not {v!r}")
            if fld["kind"] == "expression":
                require(rule.get("expanded") is True, "A combined expression is graded as an expanded sum")
                require(rule.get("match", "identity") == "identity", "A one-sided expression compares by identity")
            STATS["claimsChecked"] += 1
    return problem["answer"]


# --------------------------------------------------------------- fixtures

NUMBER = {"kind": "number", "label": "Number"}
EXPR = {"kind": "expression", "label": "Expression", "variables": ["x"], "maxLength": 24}


def _fixture(template, prompt, labels, answer, rules, mode="build"):
    rows = [{"id": f"r{i + 1}", "label": label, "fields": [EXPR if isinstance(a[0], str) and not re.fullmatch(r"-?[\d.]+", a[0]) else NUMBER]}
            for i, (label, a) in enumerate(zip(labels, answer))]
    return {"public": {"templateId": template, "prompt": prompt,
                       "response": {"kind": "structured-work", "label": "Your work", "layout": "steps", "mode": mode, "banks": [], "rows": rows}},
            "answer": json.dumps(answer, separators=(",", ":")), "workGrading": {"mode": "fields", "fields": rules}}


def _num(v):
    return [{"kind": "number", "value": v}]


def _rejects(problem, why):
    try:
        review_problem(problem)
    except (ValueError, KeyError, TypeError, ZeroDivisionError, AttributeError, IndexError):
        return
    raise ValueError(f"Self-test mutation accepted: {why}")


def self_test():
    ring = _fixture(
        "ring-area-steps",
        "A circular pool has a radius of $10$ feet. A walkway $4$ feet wide surrounds it. Find the area of the walkway to the nearest square foot. Enter each step.",
        ["The radius of the circle formed by the pool and the walkway", "The number that multiplies $\\pi$ in the walkway's area",
         "The area of the walkway, rounded to the nearest square foot"],
        [["14"], ["96"], ["302"]], [_num("14"), _num("96"), _num("302")])
    require(review_problem(ring) == ring["answer"], "ring fixture")
    _rejects(dict(ring, answer=json.dumps([["14"], ["96"], ["301"]])), "wrong rounded area")
    _rejects(dict(ring, answer=json.dumps([["14"], ["196"], ["302"]])), "squared difference not taken")
    _rejects(dict(ring, workGrading={"mode": "fields", "fields": [_num("14"), _num("96"), _num("301")]}), "rule that credits a wrong area")

    sas = _fixture(
        "sas-area-steps",
        "Two sides of a triangle measure $6.0$ cm and $6.7$ cm, and the angle between them measures $25^\\circ$. Find the area of the triangle to the nearest tenth of a square centimeter. Use a calculator in degree mode. Enter each step.",
        ["Half the product of the two sides", "$\\sin 25^\\circ$, rounded to the nearest ten-thousandth", "The area in square centimeters, rounded to the nearest tenth"],
        [["20.1"], ["0.4226"], ["8.5"]], [_num("20.1"), _num("0.4226"), _num("8.5")])
    require(review_problem(sas) == sas["answer"], "sas fixture")
    _rejects(dict(sas, answer=json.dumps([["20.1"], ["0.9063"], ["8.5"]])), "cosine instead of sine")
    _rejects(dict(sas, answer=json.dumps([["20.1"], ["0.4226"], ["8.4"]])), "area off by a tenth")

    leg = _fixture(
        "trig-leg-steps",
        "In right triangle $ABC$ the right angle is at $C$, $AB=10$ and $m\\angle A=17^\\circ$. Find $AC$ to the nearest tenth. Use a calculator in degree mode. Enter each step.",
        ["$\\cos\\,17^\\circ$, rounded to the nearest ten-thousandth", "The length of $AC$, rounded to the nearest tenth"],
        [["0.9563"], ["9.6"]], [_num("0.9563"), _num("9.6")])
    require(review_problem(leg) == leg["answer"], "leg fixture")
    _rejects(dict(leg, answer=json.dumps([["0.2924"], ["2.9"]])), "sine for the adjacent leg")

    grouped = _fixture(
        "grouped-both-sides-steps",
        "Solve $2x-37=5(x-5)-x$ for $x$. Move the $x$ terms to the side that has the parentheses and the plain numbers to the other side. Enter each step.",
        ["The grouped side with the parentheses removed and like terms combined", "The coefficient of $x$ on the side that had the parentheses, after the $x$ terms are moved there",
         "The number on the other side, after the plain numbers are moved there", "The solution $x$"],
        [["4x-25"], ["2"], ["-12"], ["-6"]],
        [[{"kind": "expression", "value": "4x-25", "match": "identity", "expanded": True}], _num("2"), _num("-12"), _num("-6")])
    require(review_problem(grouped) == grouped["answer"], "grouped fixture")
    _rejects(dict(grouped, answer=json.dumps([["5x-25"], ["2"], ["-12"], ["-6"]])), "forgot the -x term")
    _rejects(dict(grouped, answer=json.dumps([["4x-25"], ["-2"], ["-12"], ["-6"]])), "sign of the coefficient")
    loose = json.loads(json.dumps(grouped["workGrading"]))
    del loose["fields"][0][0]["expanded"]
    _rejects(dict(grouped, workGrading=loose), "an expression rule that accepts an unexpanded sum")

    exp = _fixture(
        "exponential-time-steps",
        "The population of a town is modeled by $N(t)=100\\cdot1.39^{t}$, where $t$ is in years. After how many years does the model reach 500? Round to the nearest hundredth. Enter each step.",
        ["The target divided by the starting amount", "The natural logarithm of that ratio, rounded to the nearest ten-thousandth",
         "The natural logarithm of 1.39, rounded to the nearest ten-thousandth", "The time in years, rounded to the nearest hundredth"],
        [["5"], ["1.6094"], ["0.3293"], ["4.89"]], [_num("5"), _num("1.6094"), _num("0.3293"), _num("4.89")])
    require(review_problem(exp) == exp["answer"], "exponential fixture")
    _rejects(dict(exp, answer=json.dumps([["5"], ["1.6094"], ["0.3293"], ["4.88"]])), "time off by a hundredth")

    rad = _fixture(
        "two-radical-steps",
        "Solve $\\sqrt{2x-4}-\\sqrt{x-3}=3$ for $x$. Square to remove the radicals, collect every term on the left with $x^2$ first and no common factor divided out, and enter the quadratic's coefficients. Then enter the solution that satisfies the equation and the extraneous one. Enter each step.",
        ["The coefficient of $x^2$", "The coefficient of $x$", "The constant term", "The solution that satisfies the original equation", "The extraneous solution"],
        [["1"], ["-56"], ["208"], ["52"], ["4"]], [_num("1"), _num("-56"), _num("208"), _num("52"), _num("4")])
    require(review_problem(rad) == rad["answer"], "radical fixture")
    _rejects(dict(rad, answer=json.dumps([["1"], ["-56"], ["208"], ["4"], ["52"]])), "solutions swapped")

    par = _fixture(
        "parallel-segment-steps",
        "In triangle $ABC$, point $D$ is on $\\overline{AB}$ and point $E$ is on $\\overline{AC}$, with $AD=3$, $DB=4$ and $AE=12$. What must the length of $\\overline{EC}$ be so that $\\overline{DE}\\parallel\\overline{BC}$? Enter each step.",
        ["The ratio $AE\\div AD$, the scale factor", "The length of $\\overline{EC}$"], [["4"], ["16"]], [_num("4"), _num("16")])
    require(review_problem(par) == par["answer"], "parallel fixture")
    _rejects(dict(par, answer=json.dumps([["4"], ["9"]])), "EC from the wrong ratio")

    para = _fixture(
        "parallelogram-angle-steps",
        "In parallelogram $ABCD$, $m\\angle ADC=124^\\circ$. Point $E$ is on line $DC$ so that $D$ is between $E$ and $C$, and $\\overline{AE}\\perp\\overline{DC}$. Find $m\\angle DAE$. Enter each step.",
        ["$m\\angle ADE$ in degrees", "$m\\angle DAE$ in degrees"], [["56"], ["34"]], [_num("56"), _num("34")])
    require(review_problem(para) == para["answer"], "parallelogram fixture")
    _rejects(dict(para, answer=json.dumps([["124"], ["34"]])), "unsupplemented angle")
