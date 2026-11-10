"""Independent oracle for the HSN.RN.A.1 families (rational-exponent-meaning).

Every option and line is judged from its own mathematics: each $...$ span
that is an equation (or a chain a=b=c) between numbers is evaluated, with
b^(m/n) read as the positive real power, and must hold exactly (or to 1e-9
for irrational values). The rule base for reasoning:

* the argument for b^(1/n) has four steps that each need the one before
  (the wish to keep the laws, the power of a power law applied to
  (b^(1/n))^n, the exponent 1/n * n simplified to 1, the root read off), so
  only one order is valid;
* line 2 of that argument is justified by the power of a power law and
  line 4 by the definition of the n-th root;
* a proposal for b^(1/n) is right exactly when its value raised to the n-th
  power is b;
* a student's argument fails at its first line that is false;
* a correct and complete explanation has only true equations and reasons
  from the power of a power law.
"""

import json
import re

from tex_value_kit import parse, require, same, sides, value, variables

SUPPORTED = frozenset({
    "rational-exponent-derivation",
    "rational-exponent-definition-test",
    "radical-exponent-notation-reason",
})
REVIEW_RETURNS_ANSWER = True

MATH = re.compile(r"\$([^$]+)\$")
POWER_LAW = "(x^p)^q=x^{pq}"


def evaluable(tex):
    try:
        parts = sides(tex)
    except ValueError:
        return None
    if any(variables(p) for p in parts):
        return None
    return parts


def chain_true(tex):
    parts = evaluable(tex)
    require(parts is not None, f"Not a numeric statement: {tex}")
    values = [value(p) for p in parts]
    return all(same(values[0], v) for v in values[1:])


def equations_true(text):
    """Every numeric equation in the text holds (spans without '=' or with
    letters are names, not claims). 'X is not Y' and ', which is not Y'
    are claims too."""
    for m in re.finditer(r"\$([^$]+)\$ is not \$([^$]+)\$", text):
        a, b = evaluable(m.group(1)), evaluable(m.group(2))
        require(a is not None and b is not None, "Unread 'is not'")
        if same(value(a[-1]), value(b[-1])):
            return False
    for m in re.finditer(r"\$([^$]+)\$, which is not \$([^$]+)\$", text):
        a, b = evaluable(m.group(1)), evaluable(m.group(2))
        if same(value(a[-1]), value(b[-1])):
            return False
    for span in MATH.findall(text):
        if "=" not in span:
            continue
        parts = evaluable(span)
        if parts is None:
            continue
        if not chain_true(span):
            return False
    return True


def option(response, predicate):
    hits = [o["id"] for o in response["options"] if predicate(o["label"])]
    require(len(hits) == 1, f"Expected exactly one valid option, found {len(hits)}")
    return hits[0]


def unit_power(prompt):
    m = re.search(r"\$(\d+)\^\{1/(\d)\}\$", prompt)
    require(m is not None, "No unit fraction power")
    return int(m.group(1)), int(m.group(2))


def role(statement, b, n):
    """Which step of the argument a statement is, after checking it is true."""
    if statement.startswith("We want the laws for integer exponents to keep working"):
        return "wish"
    if re.match(rf"So \$\({b}\^\{{1/{n}\}}\)\^{n}\$ must equal \$", statement):
        right = MATH.findall(statement)[1]
        require(chain_true(f"({b}^{{1/{n}}})^{n}={right}"), "Law line is false")
        require("\\cdot" in right, "The law multiplies the exponents")
        return "law"
    if re.match(rf"\$\\frac\{{1\}}\{{{n}\}}\\cdot{n}=1\$, so", statement):
        require(equations_true(statement), "Simplify line is false")
        return "simplify"
    if statement.startswith("The positive number whose"):
        require(equations_true(statement), "Conclusion is false")
        root = MATH.findall(statement)[1]
        require(same(value(parse(root)) ** n, value(parse(str(b)))), "The named root is wrong")
        return "conclude"
    raise ValueError(f"Unread statement: {statement}")


def solve_derivation(public):
    prompt, response = public["prompt"], public["response"]
    b, n = unit_power(prompt)
    if "In which order" in prompt:
        found = re.findall(r"Statement (\d): (.+?)(?= Statement \d: | In which order)", prompt)
        require(len(found) == 4, "Four statements")
        roles = {role(text, b, n): k for k, text in found}
        require(set(roles) == {"wish", "law", "simplify", "conclude"}, "One statement per step")
        want = ", ".join(f"Statement {roles[r]}" for r in ("wish", "law", "simplify", "conclude"))
        return option(response, lambda label: label == want)
    lines = dict(re.findall(r"Line (\d): (.+?)(?= Line \d: | Which )", prompt))
    require(len(lines) == 4, "Four lines")
    blank = re.search(r"fills the \$\\square\$ in line (\d)\?", prompt)
    require(blank is not None, "One blank line")
    k = blank.group(1)
    for key, text in lines.items():
        if key != k:
            role(text, b, n)
    if "Which reason" in prompt:
        if k == "2":
            return option(response, lambda label: POWER_LAW in label and "second time" not in label
                          and label.startswith("the power of a power law"))
        require(k == "4", "Reasons are asked for line 2 or 4")
        return option(response, lambda label: label.startswith("the definition: $")
                      and "is the positive number whose" in label)
    need = {"2": "law", "3": "simplify", "4": "conclude"}[k]

    def fits(label):
        if not equations_true(label):
            return False
        if need == "law":
            return chain_true(MATH.fullmatch(label).group(1)) and "\\cdot" in label
        if need == "simplify":
            return label.startswith(f"$\\frac{{1}}{{{n}}}\\cdot{n}=1$, so")
        tex = MATH.fullmatch(label).group(1)
        left, right = sides(tex)
        return same(value(right) ** n, b)

    return option(response, fits)


def solve_definition(public):
    prompt, response = public["prompt"], public["response"]
    if prompt.startswith("Four students propose"):
        b, n = unit_power(prompt)

        def works(label):
            left, right = sides(MATH.fullmatch(label).group(1))
            return same(value(right) ** n, b)

        return option(response, works)
    lines = re.findall(r"Line (\d): (.+?)\.(?= Line \d: | Which is the first)", prompt)
    require(len(lines) == 3, "Three lines")
    first = next((int(k) for k, text in lines if not equations_true(text)), None)
    want = "No line is false" if first is None else f"Line {first}"
    labels = [o["label"] for o in response["options"]]
    require(labels == ["Line 1", "Line 2", "Line 3", "No line is false"], "Fixed line options")
    return option(response, lambda label: label == want)


def solve_reason(public):
    prompt, response = public["prompt"], public["response"]
    if prompt.startswith("To define"):
        return option(response, lambda label: equations_true(label))

    def complete(label):
        cites_law = POWER_LAW in label or "power of a power law" in label
        return equations_true(label) and cites_law

    return option(response, complete)


def solve(public):
    template = public["templateId"]
    if template == "rational-exponent-derivation":
        return solve_derivation(public)
    if template == "rational-exponent-definition-test":
        return solve_definition(public)
    require(template == "radical-exponent-notation-reason", "Unsupported template")
    return solve_reason(public)


def review_problem(problem):
    public = problem["public"]
    expected = solve(public)
    feedback = problem.get("choiceFeedback") or {}
    for o in public["response"]["options"]:
        if o["id"] != expected:
            require(len(feedback.get(o["id"], "")) > 10, "Every wrong option has feedback")
    return expected


def self_test():
    proposals = {
        "templateId": "rational-exponent-definition-test",
        "prompt": "Four students propose what $625^{1/4}$ should mean. Only one proposal makes $(625^{1/4})^4=625$ true, as the power of a power law requires. Which proposal is it?",
        "response": {"kind": "choice", "options": [
            {"id": "option-a", "label": "$625^{1/4}=\\sqrt[4]{625}$"},
            {"id": "option-b", "label": "$625^{1/4}=\\frac{625}{4}$"},
            {"id": "option-c", "label": "$625^{1/4}=\\frac{1}{625^4}$"},
            {"id": "option-d", "label": "$625^{1/4}=4\\sqrt{625}$"}]},
    }
    require(solve(proposals) == "option-a", "proposals")
    collide = json.loads(json.dumps(proposals))
    collide["prompt"] = collide["prompt"].replace("625^{1/4}", "4^{1/2}").replace("(625^{1/4})^4=625", "(4^{1/2})^2=4")
    collide["response"]["options"] = [
        {"id": "option-a", "label": "$4^{1/2}=\\sqrt{4}$"},
        {"id": "option-b", "label": "$4^{1/2}=\\frac{4}{2}$"},
        {"id": "option-c", "label": "$4^{1/2}=\\frac{1}{4^2}$"},
        {"id": "option-d", "label": "$4^{1/2}=4^2$"}]
    try:
        solve(collide)
    except ValueError:
        pass
    else:
        raise AssertionError("b=4, n=2 makes dividing by the index true too")
    script = {
        "templateId": "rational-exponent-definition-test",
        "prompt": "A student writes this argument about $2^{1/4}$. Line 1: $(2^{1/4})^4=2^{\\frac{1}{4}\\cdot4}$. Line 2: $\\frac{1}{4}\\cdot4=1$, so $(2^{1/4})^4=2$. Line 3: so $2^{1/4}=2^4$. Which is the first line that is false?",
        "response": {"kind": "choice", "options": [
            {"id": "option-a", "label": "Line 1"}, {"id": "option-b", "label": "Line 2"},
            {"id": "option-c", "label": "Line 3"}, {"id": "option-d", "label": "No line is false"}]},
    }
    require(solve(script) == "option-c", "first false line")
    script["prompt"] = script["prompt"].replace("so $2^{1/4}=2^4$", "so $2^{1/4}=\\sqrt[4]{2}$")
    require(solve(script) == "option-d", "no false line")
    order = {
        "templateId": "rational-exponent-derivation",
        "prompt": "The four statements of an argument for what $25^{1/2}$ must mean are shown out of order. Statement 1: The positive number whose square is $25$ is $\\sqrt{25}$, so $25^{1/2}=\\sqrt{25}$. Statement 2: We want the laws for integer exponents to keep working for the exponent $\\frac{1}{2}$. Statement 3: So $(25^{1/2})^2$ must equal $25^{\\frac{1}{2}\\cdot2}$. Statement 4: $\\frac{1}{2}\\cdot2=1$, so $(25^{1/2})^2=25$. In which order do the statements make a valid argument?",
        "response": {"kind": "choice", "options": [
            {"id": "option-a", "label": "Statement 2, Statement 3, Statement 4, Statement 1"},
            {"id": "option-b", "label": "Statement 1, Statement 2, Statement 3, Statement 4"},
            {"id": "option-c", "label": "Statement 2, Statement 4, Statement 3, Statement 1"},
            {"id": "option-d", "label": "Statement 2, Statement 3, Statement 1, Statement 4"}]},
    }
    require(solve(order) == "option-a", "order")
    define = {
        "templateId": "radical-exponent-notation-reason",
        "prompt": "To define $9^{3/2}$ so that the laws of exponents keep working, which equation must hold, and what value does it give?",
        "response": {"kind": "choice", "options": [
            {"id": "option-a", "label": "$(9^{3/2})^2=9^{3\\cdot2}$, so $9^{3/2}=9^3$"},
            {"id": "option-b", "label": "$(9^{3/2})^2=9$, so $9^{3/2}=3$"},
            {"id": "option-c", "label": "$(9^{3/2})^2=9^3$, so $9^{3/2}=27$"},
            {"id": "option-d", "label": "$9^{3/2}=9\\cdot\\frac{3}{2}$, so $9^{3/2}=\\frac{27}{2}$"}]},
    }
    require(solve(define) == "option-c", "define value")
