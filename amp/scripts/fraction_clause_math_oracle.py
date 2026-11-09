"""Independent answers for Common Core clause variants on fraction families.

Legacy prompts stay with their family solvers. This module reads only the
public prompt, choices, blanks and figure. It returns the answer string the
learner is graded on, or None when the prompt is not one of these variants.
"""
import json
import re
from fractions import Fraction
from math import gcd


def require(ok, message):
    if not ok:
        raise ValueError(message)


def fraction_text(n, d):
    g = gcd(abs(n), d) or 1
    a, b = n // g, d // g
    return str(a) if b == 1 else f"{a}/{b}"


def frac_value(text):
    found = re.fullmatch(r"(\d+)/(\d+)", text.strip())
    if found:
        return Fraction(int(found[1]), int(found[2]))
    return Fraction(int(text))


def choose_label(public, label):
    hits = [option["id"] for option in public["response"]["options"] if option["label"] == label]
    require(len(hits) == 1, f"Expected one choice {label!r}, found {len(hits)}")
    return hits[0]


def choose_where(public, predicate):
    hits = [option["id"] for option in public["response"]["options"] if predicate(option["label"])]
    require(len(hits) == 1, f"Expected one matching choice, found {len(hits)}")
    return hits[0]


def multipart(public, wanted):
    blanks = {blank["id"]: blank for blank in public["response"]["blanks"]}
    key = {}
    for blank_id, expect in wanted:
        blank = blanks[blank_id]
        if callable(expect):
            hits = [option["id"] for option in blank["options"] if expect(option["label"])]
        else:
            hits = [option["id"] for option in blank["options"] if option["label"] == expect]
        require(len(hits) == 1, f"{blank_id} needs one match, found {len(hits)}")
        key[blank_id] = hits[0]
    ordered = {blank["id"]: key[blank["id"]] for blank in public["response"]["blanks"]}
    return json.dumps(ordered, separators=(",", ":"))


def phrase_true(label, shape, n, shaded):
    if not label.endswith(f"the {shape}"):
        return False
    if shaded == 1 and n == 2:
        return label.startswith("half of ")
    if shaded == 1 and n == 3:
        return label.startswith("a third of ")
    if shaded == 2 and n == 3:
        return label.startswith("two thirds of ")
    if shaded == 1 and n == 4:
        return label.startswith("a fourth of ") or label.startswith("a quarter of ")
    if shaded == 3 and n == 4:
        return label.startswith("three fourths of ") or label.startswith("three quarters of ")
    return False


def whole_true(label, shape, n):
    found = re.fullmatch(
        r"(one|two|three|four) (halves|thirds|fourths|quarters), the whole (rectangle|square|circle)",
        label,
    )
    if found is None:
        return False
    count = {"one": 1, "two": 2, "three": 3, "four": 4}[found[1]]
    unit = {"halves": 2, "thirds": 3, "fourths": 4, "quarters": 4}[found[2]]
    return count == n and unit == n and found[3] == shape


def equation_value(side):
    total = Fraction(0)
    for term in side.split("+"):
        times = re.fullmatch(r"(\d+)\\times\\frac\{(\d+)\}\{(\d+)\}", term)
        frac = re.fullmatch(r"\\frac\{(\d+)\}\{(\d+)\}", term)
        if times:
            total += int(times[1]) * Fraction(int(times[2]), int(times[3]))
        elif frac:
            total += Fraction(int(frac[1]), int(frac[2]))
        else:
            require(False, f"Equation term {term!r}")
    return total


def solve_clause(public):
    template, prompt = public["templateId"], public["prompt"]
    if template in ("name-equal-share", "name-share"):
        phrase = re.fullmatch(
            r"The (rectangle|square|circle) is cut into (\d+) equal parts, and (\d+) parts? (?:is|are) shaded\. Which sentence is true\?",
            prompt,
        )
        if phrase:
            shape, n, shaded = phrase[1], int(phrase[2]), int(phrase[3])
            return choose_where(public, lambda label: phrase_true(label, shape, n, shaded))
        whole = re.fullmatch(
            r"All of the (rectangle|square|circle) is shaded\. It is cut into (\d+) equal parts\. Which sentence names the whole\?",
            prompt,
        )
        if whole:
            return choose_where(public, lambda label: whole_true(label, whole[1], int(whole[2])))
        return None
    if template == "fraction-whole-as-parts":
        found = re.fullmatch(r"Write (\d+) wholes? as \?/1\. What is the missing numerator\?", prompt)
        if found:
            return str(int(found[1]))
        return None
    if template == "fraction-decompositions-select" and prompt.startswith("The strip has"):
        found = re.fullmatch(
            r"The strip has (\d+) equal pieces, some teal and some rust\. Which equations match the strip\? Choose 2\.",
            prompt,
        )
        require(found is not None, "Picture decomposition prompt")
        flags = []
        for option in public["response"]["options"]:
            label = option["label"].strip("$")
            left, right = label.split("=")
            flags.append(equation_value(left) == equation_value(right))
        require(sum(flags) == 2, "Two true equations")
        ids = [option["id"] for option, ok in zip(public["response"]["options"], flags) if ok]
        return json.dumps(sorted(ids), separators=(",", ":"))
    if template == "whole-times-fraction" and prompt.endswith("lies between."):
        n, a, b = map(int, re.fullmatch(r"(\d+) people each eat (\d+)/(\d+) pound\. Choose the pounds needed and the two whole numbers it lies between\.", prompt).groups())
        top = n * a
        floor = top // b
        require(top % b != 0, "Not a whole number of pounds")
        return multipart(public, [("pounds", f"{top}/{b}"), ("bounds", f"{floor} and {floor + 1}")])
    if template == "whole-sharing-fraction" and "pound sack" in prompt:
        b, a = map(int, re.fullmatch(r"(\d+) people share a (\d+)-pound sack equally\. Choose each share, the wholes it lies between, and the check\.", prompt).groups())
        w, rem = divmod(a, b)
        require(rem != 0 and a > b, "Mixed share")
        return multipart(public, [
            ("share", f"{a}/{b} = {w} {rem}/{b}"),
            ("bounds", f"{w} and {w + 1}"),
            ("check", str(a)),
        ])
    if template == "fraction-of-quantity":
        story = re.fullmatch(r"Which story matches (\d+)/(\d+) × (\d+)\?", prompt)
        if story:
            n, d, total = map(int, story.groups())
            return choose_label(public, f"A trail is {total} miles. Lee walked {n}/{d} of it.")
        model = re.fullmatch(r"Which picture shows (\d+)/(\d+) × (\d+)\?", prompt)
        if model:
            n, d, total = map(int, model.groups())
            return choose_label(public, f"{total} bars, each cut into {d}, with {n} pieces shaded.")
        part = re.fullmatch(r"Mia uses (\d+)/(\d+) of a ribbon that is (\d+)/(\d+) m long\. Complete the steps\.", prompt)
        if part:
            a, b, c, d = map(int, part.groups())
            return multipart(public, [
                ("cuts", str(b)),
                ("part", fraction_text(c, d * b)),
                ("take", str(a)),
                ("result", fraction_text(a * c, b * d)),
            ])
        value = re.fullmatch(r"A recipe needs (\d+) (\d+)/(\d+) cups of flour\. Sam makes (\d+)/(\d+) of the recipe\. How many cups of flour is that\?", prompt)
        if value:
            w, rem, b, n, d = map(int, value.groups())
            return fraction_text(n * (w * b + rem), d * b)
        equation = re.fullmatch(r"A recipe needs (\d+) (\d+)/(\d+) cups of flour\. Sam makes (\d+)/(\d+) of the recipe\. Which equation finds the cups\?", prompt)
        if equation:
            w, rem, b, n, d = map(int, equation.groups())
            return choose_label(public, f"{n}/{d} × {w} {rem}/{b}")
        return None
    if template == "whole-unit-groups" and prompt.startswith("Which picture shows how many"):
        d, total = map(int, re.fullmatch(r"Which picture shows how many 1/(\d+)-cup scoops are in (\d+) cups\?", prompt).groups())
        return choose_label(public, f"{total} bars, each cut into {d} equal pieces, all {total * d} pieces counted.")
    if template == "fraction-group-count":
        question = re.fullmatch(r"Which question is answered by (\d+)/(\d+) ÷ (\d+)/(\d+)\?", prompt)
        if question:
            a, b, c, d = map(int, question.groups())
            return choose_label(public, f"How many {c}/{d}-cup servings are in {a}/{b} cup?")
        equation = re.fullmatch(r"A jug holds (\d+)/(\d+) cup\. A serving is (\d+)/(\d+) cup\. Which equation finds how many servings are in the jug\?", prompt)
        if equation:
            a, b, c, d = map(int, equation.groups())
            return choose_label(public, f"{a}/{b} ÷ {c}/{d} = ?")
        picture = re.fullmatch(r"Which picture shows (\d+)/(\d+) ÷ (\d+)/(\d+)\?", prompt)
        if picture:
            a, b, c, d = map(int, picture.groups())
            return choose_label(public, f"A {a}/{b} bar with a {c}/{d} bar laid on it.")
        return None
    if template == "benchmark-fraction-estimate" and prompt.startswith("Rio says"):
        found = re.fullmatch(r"Rio says (\d+)/(\d+) ([+−]) (\d+)/(\d+) = (\d+)/(\d+)\. Choose the statement that is right\.", prompt)
        require(found is not None, "Judge prompt")
        a, b, op, c, d, claim_n, claim_d = int(found[1]), int(found[2]), found[3], int(found[4]), int(found[5]), int(found[6]), int(found[7])
        claim = fraction_text(claim_n, claim_d)
        if op == "+":
            true = Fraction(a, b) + Fraction(c, d)
            if Fraction(claim_n, claim_d) == true:
                label = f"Right: {claim} is more than 1/2, as a sum of {a}/{b} and {c}/{d} must be."
            else:
                label = f"Wrong: the sum must be more than 1/2, and {claim} is less than 1/2."
        else:
            label = f"Wrong: a difference cannot be greater than {a}/{b}, and {claim} is greater."
        return choose_label(public, label)
    if template == "scaling-direction-choice":
        explain = re.fullmatch(r"Without calculating the product, how does (\d+)/(\d+) × (\d+) compare with \3\?", prompt)
        if explain:
            a, b, whole = int(explain[1]), int(explain[2]), int(explain[3])
            if a > b:
                reason = f"greater than 1, so it is {whole} plus {a - b}/{b} of {whole}"
                direction = "greater than"
            else:
                reason = f"less than 1, so it keeps {a}/{b} of {whole}"
                direction = "less than"
            return choose_label(public, f"{a}/{b} × {whole} is {direction} {whole} because {a}/{b} is {reason}")
        times = re.fullmatch(r"How does (\d+)/(\d+) × (\d+)/\3 compare with \1/\2\?", prompt)
        if times:
            a, b, n = int(times[1]), int(times[2]), int(times[3])
            return choose_label(
                public,
                f"{a}/{b} × {n}/{n} = {a * n}/{b * n} is equal to {a}/{b} because {n}/{n} = 1, and multiplying by 1 does not change a number",
            )
        return None
    if template == "reciprocal-division-choice" and prompt.startswith("Which check shows"):
        found = re.fullmatch(r"Which check shows (\d+)/(\d+) ÷ (\d+)/(\d+)\?", prompt)
        require(found is not None, "Check prompt")
        a, b, c, d = map(int, found.groups())
        answer = fraction_text(a * d, b * c)
        dividend = Fraction(a, b)
        divisor = Fraction(c, d)

        def true_check(label):
            parts = re.fullmatch(
                rf"{a}/{b} ÷ {c}/{d} = (\d+/\d+|\d+) because {c}/{d} × (\d+/\d+|\d+) = {a}/{b}",
                label,
            )
            if parts is None:
                return False
            quotient, again = frac_value(parts[1]), frac_value(parts[2])
            return quotient == again == Fraction(a * d, b * c) and divisor * quotient == dividend and fraction_text(a * d, b * c) == answer

        return choose_where(public, true_check)
    if template == "compare-fractions-reason-blanks":
        grade3 = re.fullmatch(
            r"The bars are the same width\. Compare \$\\frac\{(\d+)\}\{(\d+)\}\$ and \$\\frac\{(\d+)\}\{(\d+)\}\$\. Complete the sentence\.",
            prompt,
        )
        unlike = re.fullmatch(
            r"Compare \$\\frac\{(\d+)\}\{(\d+)\}\$ and \$\\frac\{(\d+)\}\{(\d+)\}\$\. Each bar is marked in twelfths or in the common piece\. Complete the sentence\.",
            prompt,
        )
        found = grade3 or unlike
        if found is None:
            return None
        a, b, c, d = map(int, found.groups())
        left, right = Fraction(a, b), Fraction(c, d)
        greater = f"\\frac{{{a}}}{{{b}}}" if left > right else f"\\frac{{{c}}}{{{d}}}"

        def why_true(label):
            if label == "same size pieces, more of them":
                return b == d and a != c
            if label == "same number of pieces, bigger pieces":
                return a == c and b != d
            bench = re.fullmatch(r"(\d+)/(\d+) is more than 1/2 and (\d+)/(\d+) is less than 1/2", label)
            if bench:
                high, high_d, low, low_d = map(int, bench.groups())
                return Fraction(high, high_d) > Fraction(1, 2) > Fraction(low, low_d)
            renamed = re.fullmatch(r"over (\d+) they are (\d+)/\1 and (\d+)/\1", label)
            if renamed:
                common, x, y = map(int, renamed.groups())
                return x != y and {Fraction(x, common), Fraction(y, common)} == {left, right}
            return False

        return multipart(public, [
            ("bigger", lambda label: label.strip("$") == greater),
            ("why", why_true),
        ])
    return None
