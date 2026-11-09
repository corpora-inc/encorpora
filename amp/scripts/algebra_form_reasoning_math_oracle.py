"""Independent review of the algebra-form-reasoning family from public payloads.

Percent items (7.EE.A.2): the story sentence is read for its letter, percent
and direction; the new amount, the change and the base are built from that
reading; every option expression is evaluated exactly at two values of the
letter, and every option claim ("X is N% of Y", "X is N dollars") is tested
against those values. Slope items (8.EE.B.6): vertex coordinates are read from
the figure's labeled points, leg lengths and slopes are recomputed, and every
step or option of the argument is judged by its own rule (a true proportion of
rise to run, the angle pairs that give similarity, an equation that holds on
the line and fails off it). The generated answer is only the value under test.
"""

import copy
import json
import re
import sys
from fractions import Fraction as F

SUPPORTED = frozenset({
    "percent-change-multiplier-form",
    "percent-change-multiplier-entry",
    "expression-form-insight",
    "expression-form-two-part",
    "percent-rewrite-reasoning",
    "slope-constant-similar-triangles",
    "slope-argument-order",
    "derive-line-equation",
})
REVIEW_RETURNS_ANSWER = True
MATH = re.compile(r"\$([^$]+)\$")
PLACEHOLDER = re.compile(r"\$\{|\bundefined\b|\bNaN\b|\bnull\b|\[object")


def require(condition, message):
    if not condition:
        raise ValueError(message)


def compact(key):
    return json.dumps(key, separators=(",", ":"))


# ------------------------------------------------------------ exact TeX values
TOKEN = re.compile(r"\s*(\\[dt]?frac|\\cdot|\\times|\d+(?:\.\d+)?|[a-zA-Z]|[-+()^{}/])")


def tokens_of(text):
    text = text.replace("−", "-").strip()
    out, at = [], 0
    while at < len(text):
        match = TOKEN.match(text, at)
        require(match is not None, f"Unreadable math {text!r}")
        out.append(match[1])
        at = match.end()
    return out


def parse(text):
    """A tree: ('num', F) | ('var', name) | (op, a, b) | ('neg', a) | ('group', a)."""
    toks, at = tokens_of(text), [0]

    def peek():
        return toks[at[0]] if at[0] < len(toks) else None

    def take(expected=None):
        token = peek()
        require(token is not None and (expected is None or token == expected), f"Bad math {text!r}")
        at[0] += 1
        return token

    def primary():
        token = take()
        if re.fullmatch(r"\d+(?:\.\d+)?", token):
            return ("num", F(token))
        if re.fullmatch(r"[a-zA-Z]", token):
            return ("var", token)
        if token in ("(", "{"):
            inner = expression()
            take(")" if token == "(" else "}")
            return ("group", inner)
        if token.endswith("frac"):
            take("{")
            top = expression()
            take("}")
            take("{")
            bottom = expression()
            take("}")
            return ("div", top, bottom)
        raise ValueError(f"Unexpected {token} in {text!r}")

    def power():
        node = primary()
        if peek() == "^":
            take()
            node = ("pow", node, primary())
        return node

    def factor():
        if peek() == "-":
            take()
            return ("neg", factor())
        return power()

    def term():
        node = factor()
        while True:
            token = peek()
            if token in ("\\cdot", "\\times"):
                take()
                node = ("mul", node, factor())
            elif token == "/":
                take()
                node = ("div", node, factor())
            elif token is not None and (re.fullmatch(r"\d+(?:\.\d+)?|[a-zA-Z]", token)
                                        or token == "(" or token.endswith("frac")):
                node = ("mul", node, power())
            else:
                return node

    def expression():
        node = ("neg", term()) if peek() == "-" and take() else term()
        while peek() in ("+", "-"):
            op = take()
            node = ("add" if op == "+" else "sub", node, term())
        return node

    tree = expression()
    require(at[0] == len(toks), f"Trailing math in {text!r}")
    return tree


def value(node, env):
    kind = node[0]
    if kind == "num":
        return node[1]
    if kind == "var":
        require(node[1] in env, f"Unknown letter {node[1]}")
        return F(env[node[1]])
    if kind in ("group", "neg"):
        inner = value(node[1], env)
        return -inner if kind == "neg" else inner
    a, b = value(node[1], env), value(node[2], env)
    if kind == "add":
        return a + b
    if kind == "sub":
        return a - b
    if kind == "mul":
        return a * b
    if kind == "div":
        if b == 0:
            raise ZeroDivisionError("division by zero")
        return a / b
    require(b.denominator == 1 and 0 <= b <= 4, "Unsupported power")
    return a ** int(b)


def letters(node):
    if node[0] == "var":
        return {node[1]}
    if node[0] == "num":
        return set()
    return set().union(*(letters(child) for child in node[1:]))


def ev(text, env):
    return value(parse(text), env)


def maths(text):
    return MATH.findall(text)


def dec(x):
    """A terminating Fraction as the shortest decimal string."""
    x = F(x)
    den = x.denominator
    for p in (2, 5):
        while den % p == 0:
            den //= p
    require(den == 1, f"{x} does not terminate")
    places = 0
    while (x * 10 ** places).denominator != 1:
        places += 1
    n = int(x * 10 ** places)
    sign = "-" if n < 0 else ""
    n = abs(n)
    whole, frac = divmod(n, 10 ** places) if places else (n, 0)
    return f"{sign}{whole}" + (f".{str(frac).rjust(places, '0').rstrip('0')}" if places and frac else "")


# ------------------------------------------------------------ percent stories
# Each story: sentence pattern, letter, direction, and the role of each noun.
STORIES = [
    (r"A bike costs \$p\$ dollars\. Its price goes up by (\d+)%\.", "p", 1, "the old price", "the increase", "the new price"),
    (r"A worker earns \$w\$ dollars an hour and gets an? (\d+)% raise\.", "w", 1, "the old wage", "the raise", "the new wage"),
    (r"A nurse earns a salary of \$s\$ dollars a year\. The salary goes up by (\d+)%\.", "s", 1, "the old salary", "the raise", "the new salary"),
    (r"A meal costs \$m\$ dollars, and an? (\d+)% tip is added\.", "m", 1, "the meal cost", "the tip", "the total paid"),
    (r"A concert ticket costs \$t\$ dollars\. The ticket price rises by (\d+)%\.", "t", 1, "the old ticket price", "the increase", "the new ticket price"),
    (r"A store pays \$c\$ dollars for a lamp and marks the price up (\d+)%\.", "c", 1, "the store's cost", "the markup", "the selling price"),
    (r"A jacket costs \$j\$ dollars and is marked down (\d+)%\.", "j", -1, "the original price", "the amount saved", "the sale price"),
    (r"A video game costs \$p\$ dollars\. It goes on sale at (\d+)% off\.", "p", -1, "the original price", "the discount", "the sale price"),
    (r"A train ticket costs \$t\$ dollars, and students get (\d+)% off\.", "t", -1, "the full price", "the discount", "the student price"),
    (r"A phone plan costs \$c\$ dollars a month\. The company cuts the cost by (\d+)%\.", "c", -1, "the old cost", "the cut", "the new cost"),
    (r"A gym's monthly rate is \$r\$ dollars\. The gym lowers the rate by (\d+)%\.", "r", -1, "the old rate", "the cut", "the new rate"),
]
PERCENTS = {4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 75}
ENVS = (2, 7)


class Story:
    """Quantities as functions of the letter values in an environment."""

    def __init__(self, letter, quantities, phrases):
        self.letter = letter
        self.quantities = quantities  # name -> fn(env)
        self.phrases = phrases  # lowercase phrase -> quantity name

    def envs(self):
        return [{name: F(v + i) for i, name in enumerate(sorted(self.letter))} for v in ENVS]

    def of(self, phrase, env):
        key = phrase.strip().rstrip(".").lower()
        require(key in self.phrases, f"Unknown quantity {phrase!r}")
        return self.quantities[self.phrases[key]](env)


def percent_story(prompt):
    for pattern, v, direction, base, change, result in STORIES:
        match = re.match(pattern, prompt)
        if match:
            pct = int(match.group(1))
            require(pct in PERCENTS, f"Percent {pct} outside the grade-7 set")
            c = F(pct, 100)
            story = Story(v, {
                "base": lambda env, v=v: env[v],
                "change": lambda env, v=v, c=c: c * env[v],
                "result": lambda env, v=v, c=c, d=direction: (1 + d * c) * env[v],
            }, {base: "base", change: "change", result: "result"})
            story.pct, story.direction, story.c = pct, direction, c
            story.nouns = (base, change, result)
            story.rest = prompt[match.end():].strip()
            return story
    return None


def form_story(prompt):
    """The expression-form contexts: the percent stories plus three others."""
    story = percent_story(prompt)
    if story:
        return story
    if prompt.startswith("A rectangle is $L$ units long and $W$ units wide."):
        story = Story("LW", {
            "result": lambda e: 2 * e["L"] + 2 * e["W"],
            "twoL": lambda e: 2 * e["L"], "twoW": lambda e: 2 * e["W"],
            "L": lambda e: e["L"], "W": lambda e: e["W"], "area": lambda e: e["L"] * e["W"],
        }, {"the perimeter": "result", "the whole perimeter": "result", "the area of the rectangle": "area",
            "the two sides of length $l$ together": "twoL", "the two sides of length $w$ together": "twoW",
            "one side of length $l$": "L", "one side of length $w$": "W"})
        story.rest = prompt[len("A rectangle is $L$ units long and $W$ units wide."):].strip()
        story.kind = "perimeter"
        return story
    match = re.match(r"Tickets cost (\d+) dollars each, plus a fee of (\d+) dollars on each ticket\. Someone buys \$n\$ tickets\.", prompt)
    if match:
        a, b = int(match.group(1)), int(match.group(2))
        require(8 <= a <= 30 and 2 <= b <= 6, "Ticket price and fee ranges")
        story = Story("n", {
            "result": lambda e: (a + b) * e["n"], "fees": lambda e: b * e["n"], "one": lambda e: F(a + b),
            "count": lambda e: e["n"], "fee": lambda e: F(b),
        }, {"the total cost": "result", "the fees for all $n$ tickets": "fees",
            "the cost of one ticket with its fee": "one", "the number of tickets": "count",
            f"one fee of {b} dollars": "fee"})
        story.rest = prompt[match.end():].strip()
        story.kind, story.a, story.b = "tickets", a, b
        return story
    lead = "A worker's regular rate is $r$ dollars an hour, and overtime pays time and a half."
    if prompt.startswith(lead):
        story = Story("r", {
            "result": lambda e: F(3, 2) * e["r"], "change": lambda e: F(1, 2) * e["r"], "base": lambda e: e["r"],
            "half": lambda e: F(1, 2),
        }, {"the overtime rate": "result", "the extra pay": "change", "the regular rate": "base",
            "the extra pay for each overtime hour": "change", "an extra 0.5 dollars an hour": "half"})
        story.rest = prompt[len(lead):].strip()
        story.kind = "overtime"
        return story
    raise ValueError(f"Unknown story in {prompt[:80]!r}")


def same(story, tex, quantity="result"):
    """True when the TeX expression equals the named quantity at two points."""
    return all(ev(tex, env) == story.quantities[quantity](env) for env in story.envs())


def claim_true(story, claim):
    """'X is N% of Y.', 'X is N% more/less than Y.', 'X is N dollars.'"""
    match = re.fullmatch(r"(.+?) is ([\d.]+)% (of|more than|less than) (.+)\.", claim)
    if match:
        n = F(match.group(2)) / 100
        factor = {"of": n, "more than": 1 + n, "less than": 1 - n}[match.group(3)]
        return all(story.of(match.group(1), env) == factor * story.of(match.group(4), env) for env in story.envs())
    match = re.fullmatch(r"(.+?) is ([\d.]+) dollars\.", claim)
    require(match is not None, f"Unreadable claim {claim!r}")
    return all(story.of(match.group(1), env) == F(match.group(2)) for env in story.envs())


def only(options, test, what):
    hits = [o["id"] for o in options if test(o["label"])]
    require(len(hits) == 1, f"{what}: expected one valid option, found {len(hits)}")
    return hits[0]


def options_distinct(options):
    labels = [o["label"] for o in options]
    require(len(set(labels)) == len(labels), "Repeated option")


# ------------------------------------------------------------ percent solvers
def solve_multiplier_form(public):
    story = percent_story(public["prompt"])
    require(story is not None, "Unknown story")
    options = public["response"]["options"]
    options_distinct(options)
    return only(options, lambda label: same(story, maths(label)[0]), "Multiplier form")


def solve_multiplier_entry(public):
    prompt = public["prompt"]
    story = percent_story(prompt)
    if story is not None:
        require(re.fullmatch(r".+ can be written as \$k \\cdot [a-z]\$ for one number \$k\$\. What is \$k\$\?", story.rest),
                "Multiplier question")
        return dec(1 + story.direction * story.c)
    two = re.match(r"A [a-z ]+ costs \$([a-z])\$ dollars\. It is (\d+)% off, and then (\d+)% sales tax is added to the sale price\. "
                   r"The final price is \$k \\cdot \1\$\. What is \$k\$\?$", prompt)
    if two:
        off, tax = int(two.group(2)), int(two.group(3))
        require(off in (10, 20, 25, 30, 40, 50) and tax in (5, 8, 10, 20), "Two-step percents")
        k = (1 - F(off, 100)) * (1 + F(tax, 100))
        require(F(1, 2) < k < F(3, 2) and (k * 1000).denominator == 1, "Two-step multiplier range")
        return dec(k)
    rev = re.fullmatch(r"After a change, the .+ is \$(\d+\.\d+)([a-z])\$, where \$\2\$ is the .+\. "
                       r"By what percent did the .+ (increase|decrease)\?", prompt)
    require(rev is not None, f"Unknown multiplier prompt {prompt!r}")
    k = F(rev.group(1))
    change = (k - 1) * 100 if rev.group(3) == "increase" else (1 - k) * 100
    require(change > 0 and change.denominator == 1 and int(change) in PERCENTS, "Reverse percent")
    return str(int(change))


def solve_form_insight(public):
    prompt = public["prompt"]
    story = form_story(prompt)
    options = public["response"]["options"]
    options_distinct(options)
    which = re.fullmatch(r"Which expression for (.+?) shows most directly that (.+)\?", story.rest)
    if which:
        fact = which.group(2)
        texts = {o["id"]: maths(o["label"])[0] for o in options}
        equal = [i for i, t in texts.items() if same(story, t)]
        require(len(equal) == 2, f"Two forms must equal the quantity, found {len(equal)}")
        pct = re.search(r"is (\d+)% of", fact)
        ticket = re.search(r"each ticket costs (\d+) dollars with its fee", fact)
        product = bool(pct or ticket or "twice the sum" in fact)
        if pct:
            require(all(story.quantities["result"](e) == F(int(pct.group(1)), 100) * story.quantities["base"](e)
                        for e in story.envs()), "The stated percent is true")
        if ticket:
            require(int(ticket.group(1)) == story.a + story.b, "The stated ticket price is true")
        if "twice the sum" in fact:
            require(story.kind == "perimeter", "Twice the sum is a perimeter fact")
        hits = [i for i in equal if (parse(texts[i])[0] not in ("add", "sub")) == product]
        require(len(hits) == 1, "One form has the asked structure")
        return hits[0]
    term = re.fullmatch(r"(.+?) is \$(.+?)\$\. In this expression, what does the term \$(.+?)\$ stand for\?", story.rest)
    if term:
        require(same(story, term.group(2)), "The expanded form equals the quantity")
        tex = term.group(3)
        require(tex in term.group(2), "The term is part of the shown expression")

        def means(label):
            constant = re.fullmatch(r"An? (?:discount|tip|raise|markup|change|extra) of ([\d.]+) dollars(?: an hour)?", label)
            for env in story.envs():
                target = ev(tex, env)
                if constant:
                    if target != F(constant.group(1)):
                        return False
                elif story.of(label, env) != target:
                    return False
            return True
        return only(options, means, "Term meaning")
    coefficient = re.fullmatch(r"(.+?) is \$([\d.]+)([a-z])\$\. What does the ([\d.]+) in \$\2\3\$ tell you\?", story.rest)
    require(coefficient is not None, f"Unknown insight question {story.rest!r}")
    require(coefficient.group(2) == coefficient.group(4), "Asked coefficient")
    require(same(story, coefficient.group(2) + coefficient.group(3)), "The single form equals the quantity")
    return only(options, lambda label: claim_true(story, label), "Coefficient meaning")


def solve_two_part(public):
    story = percent_story(public["prompt"])
    require(story is not None, "Unknown story")
    response = public["response"]
    require(response["layout"] == "slots" and [b["id"] for b in response["blanks"]] == ["single", "meaning"], "Two slots")
    single, meaning = response["blanks"]
    shown = re.fullmatch(r"A single expression equal to \$(.+)\$", single["label"])
    require(shown is not None and same(story, shown.group(1)), "The shown form equals the story")
    options_distinct(single["options"])
    options_distinct(meaning["options"])
    key = {
        "single": only(single["options"], lambda label: same(story, maths(label)[0]) and len(letters(parse(maths(label)[0]))) == 1
                       and parse(maths(label)[0])[0] not in ("add", "sub"), "Single form"),
        "meaning": only(meaning["options"], lambda label: claim_true(story, label), "Meaning of the form"),
    }
    return compact(key)


def chain_parts(tex):
    return [part.strip() for part in tex.split("=")]


def solve_rewrite(public):
    prompt = public["prompt"]
    options = public["response"]["options"]
    options_distinct(options)
    story = percent_story(prompt)
    if story is not None:
        why = re.fullmatch(r"(.+?) can be written as \$(.+?)\$ or as \$(.+?)\$\. Why are these two expressions equal\?", story.rest)
        if why:
            left, right = why.group(2), why.group(3)
            require(same(story, left) and same(story, right), "Both forms equal the story")

            def complete(label):
                for tex in maths(label):
                    parts = chain_parts(tex)
                    if (len(parts) >= 3 and parts[0] == left and parts[-1] == right
                            and all(same(story, part) for part in parts)
                            and any(re.fullmatch(r"\(1 [-+] [\d.]+\)[a-z]", part) for part in parts[1:-1])):
                        return True
                return False
            return only(options, complete, "Complete reason")
        flaw = re.fullmatch(r"(.+?) writes (.+?) as \$(.+?)\$\. What is wrong\?", story.rest)
        require(flaw is not None, f"Unknown rewrite question {story.rest!r}")
        student = flaw.group(3)
        require(not same(story, student), "The student's expression must be wrong")

        def fixes(label):
            if label == "Nothing is wrong.":
                return same(story, student)
            spans = maths(label)
            if not spans:
                return False
            parts = chain_parts(spans[-1])
            return all(same(story, part) for part in parts)
        return only(options, fixes, "Diagnosis")
    claim = re.fullmatch(r"A store marks a price of \$([a-z])\$ dollars (down|up) (\d+)%\. Later it marks the (?:sale|new) price (up|down) (\d+)%\. "
                         r"\w+ says the final price equals the original price\. Which statement is right\?", prompt)
    require(claim is not None, f"Unknown rewrite prompt {prompt!r}")
    v, first, r1, second, r2 = claim.group(1), claim.group(2), int(claim.group(3)), claim.group(4), int(claim.group(5))
    require(r1 == r2 and r1 in (10, 20, 25, 50) and first != second, "Equal opposite changes")
    sign = {"up": 1, "down": -1}
    final = (1 + sign[first] * F(r1, 100)) * (1 + sign[second] * F(r2, 100))

    def right(label):
        if label.startswith("Right:"):
            return final == 1
        require(label.startswith("Wrong:"), f"Verdict in {label!r}")
        parts = chain_parts(maths(label)[0])
        for env in ({v: F(1)}, {v: F(3)}):
            if any(ev(part, env) != final * env[v] for part in parts):
                return False
        less = re.search(r", ([\d.]+)% less than the original\.$", label)
        return less is not None and F(less.group(1)) == (1 - final) * 100
    return only(options, right, "Successive claim")


# ------------------------------------------------------------ slope triangles
def graph_of(public):
    figure = public.get("figure") or {}
    require(figure.get("kind") == "scene", "A scene figure")
    graphs = [e for e in figure["scene"]["elements"] if e["type"] == "graph"]
    require(len(graphs) == 1, "One graph")
    return graphs[0]


def vertices(public):
    """Letter -> (x, y) from the graph's labeled points ("A" or "C, D")."""
    where = {}
    for point in graph_of(public).get("points", []):
        for name in point["label"].split(", "):
            require(re.fullmatch(r"[A-Z]", name) is not None, f"Vertex label {name!r}")
            require(name not in where, f"Vertex {name} twice")
            where[name] = (F(point["x"]), F(point["y"]))
    return where


def triangles(public, where):
    found = re.match(r"Line \$\\ell\$ has two slope triangles, \$([A-Z]{3})\$ and \$([A-Z]{3})\$\.", public["prompt"])
    require(found is not None, "Two named triangles")
    tris = []
    for name in found.groups():
        a, b, c = (where[letter] for letter in name)
        require(a[1] == b[1] and a[0] != b[0], f"{name}: first leg horizontal")
        require(b[0] == c[0] and b[1] != c[1], f"{name}: second leg vertical")
        tris.append(name)
    (a, _, c), (d, _, f) = ([where[x] for x in tris[0]], [where[x] for x in tris[1]])
    # All four ends of the third sides lie on one line.
    for p in (d, f):
        require((c[0] - a[0]) * (p[1] - a[1]) == (c[1] - a[1]) * (p[0] - a[0]), "Third sides on one line")
    require(abs(where[tris[0][1]][0] - a[0]) != abs(where[tris[1][1]][0] - d[0]), "Different sizes")
    return tris


def sq(where, seg):
    (x1, y1), (x2, y2) = where[seg[0]], where[seg[1]]
    return (x2 - x1) ** 2 + (y2 - y1) ** 2


def kind_of(seg, tris, where):
    """'rise', 'run' or 'side' of the triangle containing both letters."""
    for name in tris:
        if set(seg) <= set(name):
            (x1, y1), (x2, y2) = where[seg[0]], where[seg[1]]
            if x1 == x2:
                return "rise", name
            if y1 == y2:
                return "run", name
            return "side", name
    raise ValueError(f"Segment {seg} is not a side")


FRAC = re.compile(r"\\frac\{([A-Z]{2})\}\{([A-Z]{2})\} = \\frac\{([A-Z]{2})\}\{([A-Z]{2})\}")


def slope_proportion(text, tris, where):
    """True when a ratio equation is numerically true and sets rise over run
    of one triangle equal to rise over run of the other."""
    match = FRAC.search(text)
    require(match is not None, f"No proportion in {text!r}")
    n1, d1, n2, d2 = match.groups()
    true = sq(where, n1) * sq(where, d2) == sq(where, n2) * sq(where, d1)
    shape = [kind_of(s, tris, where) for s in (n1, d1, n2, d2)]
    return (true and shape[0][0] == "rise" and shape[1][0] == "run" and shape[2][0] == "rise"
            and shape[3][0] == "run" and shape[0][1] == shape[1][1] and shape[2][1] == shape[3][1]
            and shape[0][1] != shape[2][1])


def steps_of(prompt):
    parts = re.split(r"Step (\d): ", prompt)
    require(len(parts) >= 3, "Numbered steps")
    steps = {}
    for number, text in zip(parts[1::2], parts[2::2]):
        steps[int(number)] = text.strip()
    last = max(steps)
    steps[last] = re.split(r" (?=Which )", steps[last])[0]
    return steps


def slope_step_valid(text, tris, where):
    small, large = tris
    if "congruent" in text:
        return False
    if "are right angles" in text:
        return (f"$\\angle {small[1]}$" in text and f"$\\angle {large[1]}$" in text)
    if "similar, because both are right triangles" in text:
        return False
    if "corresponding angles" in text and "similar" in text:
        return f"$\\angle {small[0]} = \\angle {large[0]}$" in text
    if text.startswith("The slope of $\\ell$ is"):
        seg = re.search(r"\\frac\{([A-Z]{2})\}\{([A-Z]{2})\}", text)
        return kind_of(seg.group(1), tris, where)[0] == "rise" and kind_of(seg.group(2), tris, where)[0] == "run"
    if "proportional" in text:
        return slope_proportion(text, tris, where)
    if "rise over run" in text:
        return all(kind_of(n, tris, where)[0] == "rise" and kind_of(d, tris, where)[0] == "run"
                   for n, d in re.findall(r"\\frac\{([A-Z]{2})\}\{([A-Z]{2})\}", text))
    raise ValueError(f"Unjudged step {text!r}")


def solve_slope(public):
    where = vertices(public)
    tris = triangles(public, where)
    small, large = tris
    prompt = public["prompt"]
    options = public["response"]["options"]
    options_distinct(options)
    if prompt.endswith("Which reason justifies Step 2?"):
        steps = steps_of(prompt)
        require("similar" in steps[2] and "Why?" in steps[2], "Step 2 asks why")

        def justifies(label):
            return ("right angle" in label and "corresponding" in label and "congruent" not in label
                    and "slope" not in label and f"$\\angle {small[0]} = \\angle {large[0]}$" in label)
        return only(options, justifies, "Similarity reason")
    if "Which equation must be true" in prompt:
        for name in tris:
            for seg in (name[:2], name[1:]):
                stated = re.search(rf"\${seg} = (\d+)\$", prompt)
                require(stated is not None and F(int(stated.group(1))) ** 2 == sq(where, seg), f"Stated leg {seg}")
        return only(options, lambda label: slope_proportion(label, tris, where), "Slope proportion")
    require(prompt.endswith("Which step is wrong?"), "Unknown slope question")
    steps = steps_of(prompt)
    require(sorted(steps) == [1, 2, 3, 4], "Four steps")
    wrong = [n for n, text in steps.items() if not slope_step_valid(text, tris, where)]
    require(len(wrong) == 1 and wrong[0] != 1, f"One wrong step after Step 1, found {wrong}")
    return only(options, lambda label: label == f"Step {wrong[0]}", "Wrong step")


ORDER_KEYS = [
    ("Draw two slope triangles", 1),
    ("Right angles at", 2),
    ("Two pairs of equal angles", 3),
    ("Corresponding sides are proportional", 4),
    ("rise over run", 5),
]


def solve_order(public):
    where = vertices(public)
    small, large = triangles(public, where)
    response = public["response"]
    blanks = response["blanks"]
    require(response["layout"] == "slots" and [b["id"] for b in blanks] == ["s1", "s2", "s3", "s4", "s5"], "Five slots")
    options = blanks[0]["options"]
    require(all(b["options"] == options and b["label"] == f"Step {i + 1}" for i, b in enumerate(blanks)), "Shared statements")
    position = {}
    for option in options:
        hits = [n for key, n in ORDER_KEYS if key in option["label"]]
        require(len(hits) == 1, f"Classify {option['label']!r}")
        position[hits[0]] = option["id"]
        if hits[0] == 2:
            require(f"$\\angle {small[0]} = \\angle {large[0]}$" in option["label"]
                    and f"${small[1]}$" in option["label"] and f"${large[1]}$" in option["label"], "Angle pairs match the figure")
        if hits[0] == 4:
            require(slope_proportion(option["label"], [small, large], where), "The proportion is true rise over run")
    require(sorted(position) == [1, 2, 3, 4, 5], "Each step once")
    require([position[n] for n in range(1, 6)] != ["a", "b", "c", "d", "e"], "Statements are shuffled")
    return compact({f"s{n}": position[n] for n in range(1, 6)})


# ------------------------------------------------------------ deriving a line
def read_line(public):
    g = graph_of(public)
    tri = g["slopeTriangles"][0]
    (x0, y0), (x1, y1) = tri["from"], tri["to"]
    require(x0 == 0, "The triangle starts on the y-axis")
    m, b = F(y1 - y0, x1 - x0), F(y0)
    labels = {p["label"]: (p["x"], p["y"]) for p in g["points"]}
    require("(x, y)" in labels, "A general point")
    px, py = labels["(x, y)"]
    require(F(py) == m * px + b and px != 0, "The general point is on the line")
    stated = re.search(r"slope (?:\$(-?\\frac\{\d+\}\{\d+\})\$|(−?\d+)\b)", public["prompt"])
    if stated:
        require(ev(stated.group(1) or stated.group(2), {}) == m, "Stated slope matches the figure")
    return m, b


def on_line(m, b):
    return [{"x": F(x), "y": m * x + b} for x in (1, 2, 5)]


def off_line(m, b):
    return [{"x": F(x), "y": m * x + b + 1} for x in (1, 3)]


def holds(equation, env):
    left, right = chain_parts(equation)[:2]
    try:
        return ev(left, env) == ev(right, env)
    except ZeroDivisionError:
        return False


def line_equation(equation, m, b):
    return (len(chain_parts(equation)) == 2 and all(holds(equation, e) for e in on_line(m, b))
            and not any(holds(equation, e) for e in off_line(m, b)))


def slope_expression(tex, m, b):
    try:
        return all(ev(tex, e) == m for e in on_line(m, b))
    except ZeroDivisionError:
        return False


def derive_step_valid(number, text, m, b):
    spans = maths(text)
    if number == 3:
        parts = chain_parts(spans[-1])
        return all(slope_expression(part, m, b) for part in parts)
    if number == 4:
        left, right = chain_parts(spans[-1])
        return ev(right, {}) == m and slope_expression(left, m, b)
    return line_equation(spans[-1], m, b)


def solve_derive(public):
    m, b = read_line(public)
    prompt = public["prompt"]
    options = public["response"]["options"]
    options_distinct(options)
    if prompt.endswith("Which statement belongs at Step 4 so that Step 5 follows?"):
        require(b == 0, "Through the origin")

        def reason(label):
            found = re.search(r"\$\\frac\{y\}\{x\} = (.+?)\$", label)
            return (found is not None and ev(found.group(1), {}) == m and "same between any two points" in label
                    and "congruent" not in label)
        return only(options, reason, "Missing reason")
    if prompt.endswith("Which equation is Step 5?"):
        require(b != 0, "Crosses away from the origin")

        def step(label):
            equation = maths(label)[0]
            left = chain_parts(equation)[0]
            # Step 5 multiplies by x: y and a number on the left, m times x on the right.
            return line_equation(equation, m, b) and "x" not in left
        return only(options, step, "Step 5")
    if "Which expression is the slope between" in prompt:
        require(b != 0, "Crosses away from the origin")
        return only(options, lambda label: slope_expression(maths(label)[0], m, b), "Slope expression")
    if "Which explanation shows why every point" in prompt:
        require(b == 0, "Through the origin")

        def complete(label):
            if "mx + b" in label or "The point $(" in label or "x/y" in label:
                return False
            found = re.search(r"\$y/x = (.+?)\$", label)
            return found is not None and ev(found.group(1), {}) == m and "any $(x, y)$" in label
        return only(options, complete, "Complete explanation")
    require(prompt.endswith("Which step is wrong?"), "Unknown derivation question")
    steps = steps_of(prompt)
    require(sorted(steps) == [1, 2, 3, 4, 5, 6], "Six steps")
    wrong = [n for n in (3, 4, 5, 6) if not derive_step_valid(n, steps[n], m, b)]
    require(len(wrong) == 1, f"One wrong step, found {wrong}")
    return only(options, lambda label: label == f"Step {wrong[0]}", "Wrong step")


# ------------------------------------------------------------ entry points
SOLVERS = {
    "percent-change-multiplier-form": solve_multiplier_form,
    "percent-change-multiplier-entry": solve_multiplier_entry,
    "expression-form-insight": solve_form_insight,
    "expression-form-two-part": solve_two_part,
    "percent-rewrite-reasoning": solve_rewrite,
    "slope-constant-similar-triangles": solve_slope,
    "slope-argument-order": solve_order,
    "derive-line-equation": solve_derive,
}


def solve(public):
    template = public["templateId"]
    require(template in SUPPORTED, "Wrong family")
    return SOLVERS[template](public)


def review_problem(problem):
    public = problem["public"]
    expected = solve(public)
    require(isinstance(problem["answer"], str) and problem["answer"] == expected,
            f"Answer {problem['answer']!r} disagrees; expected {expected!r}")
    explanation, hint = problem.get("explanation"), problem.get("hint")
    require(isinstance(explanation, list) and len(explanation) >= 2 and all(isinstance(e, str) and e.strip() for e in explanation),
            "Explanation lines")
    require(isinstance(hint, str) and hint.strip(), "Hint")
    for text in [public["prompt"], hint, *explanation, *(problem.get("choiceFeedback") or {}).values()]:
        require(not PLACEHOLDER.search(text), f"Unrendered placeholder in {text!r}")
    kind = public["response"]["kind"]
    if kind == "choice":
        feedback = problem.get("choiceFeedback") or {}
        ids = {o["id"] for o in public["response"]["options"]}
        require(set(feedback) == ids - {expected}, "Feedback for every wrong option")
    # A worked check "Check with $v = 100$: … $k \cdot 100 = N$" must agree.
    for line in explanation:
        check = re.search(r"\$([\d.]+) \\cdot 100 = ([\d.]+)\$", line)
        if check:
            require(F(check.group(1)) * 100 == F(check.group(2)), f"Worked check {line!r}")
    return expected


# ------------------------------------------------------------ self test
def opts(*labels):
    return [{"id": f"option-{'abcd'[i]}", "label": label} for i, label in enumerate(labels)]


def choice_case(template, prompt, labels, answer, feedback_ids, figure=None, explanation=None):
    public = {"templateId": template, "seed": "fixture", "prompt": prompt,
              "response": {"kind": "choice", "label": "Choose one answer", "options": opts(*labels)}}
    if figure:
        public["figure"] = figure
    return {"public": public, "answer": answer, "hint": "Write the whole plus 5% of it.",
            "explanation": explanation or ["Step one.", "Step two."],
            "choiceFeedback": {f"option-{c}": "Why not." for c in feedback_ids}}


def slope_figure(points, triangles_):
    return {"kind": "scene", "scene": {"v": 1, "elements": [{"type": "graph", "points": [
        {"x": x, "y": y, "label": label} for (x, y, label) in points],
        "slopeTriangles": [{"from": f, "to": t, "labels": "shown"} for f, t in triangles_]}]}}


def fixtures():
    cases = []
    cases.append(choice_case(
        "percent-change-multiplier-form",
        "A bike costs $p$ dollars. Its price goes up by 5%. Which expression gives the new price?",
        ["$0.05p$", "$1.05p$", "$p + 5$", "$1.5p$"], "option-b", "acd",
        explanation=["Write it long.", "Check with $p = 100$: $100 + 5 = 105$, and $1.05 \\cdot 100 = 105$."]))
    cases.append({"public": {"templateId": "percent-change-multiplier-entry", "seed": "f",
                             "prompt": "A board game costs $p$ dollars. It is 25% off, and then 8% sales tax is added to the sale price. The final price is $k \\cdot p$. What is $k$?",
                             "response": {"kind": "number", "label": "k"}},
                  "answer": "0.81", "hint": "First 25% off.", "explanation": ["One.", "Two."]})
    cases.append({"public": {"templateId": "percent-change-multiplier-entry", "seed": "f",
                             "prompt": "After a change, the new wage is $1.08w$, where $w$ is the old wage. By what percent did the wage increase?",
                             "response": {"kind": "number", "label": "percent"}},
                  "answer": "8", "hint": "Split it.", "explanation": ["One.", "Two."]})
    cases.append(choice_case(
        "expression-form-insight",
        "A jacket costs $j$ dollars and is marked down 30%. The sale price is $0.7j$. What does the 0.7 in $0.7j$ tell you?",
        ["The sale price is 70% more than the original price.", "The amount saved is 70% of the original price.",
         "The sale price is 70% of the original price.", "The sale price is 0.7 dollars."], "option-c", "abd"))
    cases.append(choice_case(
        "expression-form-insight",
        "Tickets cost 12 dollars each, plus a fee of 3 dollars on each ticket. Someone buys $n$ tickets. The total cost is $12n + 3n$. In this expression, what does the term $3n$ stand for?",
        ["The cost of one ticket with its fee", "The fees for all $n$ tickets", "The number of tickets", "One fee of 3 dollars"],
        "option-b", "acd"))
    cases.append(choice_case(
        "expression-form-insight",
        "A rectangle is $L$ units long and $W$ units wide. Which expression for the perimeter shows most directly that the perimeter is twice the sum of one length and one width?",
        ["$2L + 2W$", "$2(L + W)$", "$2L + W$", "$2LW$"], "option-b", "acd"))
    cases.append({"public": {"templateId": "expression-form-two-part", "seed": "f",
                             "prompt": "A meal costs $m$ dollars, and a 8% tip is added. The total paid can be written as $m + 0.08m$. Rewrite it as one multiple of $m$, then say what that form tells you.",
                             "response": {"kind": "multi-part-choice", "label": "Choose an answer for each part", "layout": "slots", "blanks": [
                                 {"id": "single", "label": "A single expression equal to $m + 0.08m$",
                                  "options": [{"id": "a", "label": "$0.08m$"}, {"id": "b", "label": "$1.08m$"}, {"id": "c", "label": "$m + 0.08$"}, {"id": "d", "label": "$1.8m$"}]},
                                 {"id": "meaning", "label": "What that single expression says about the total paid",
                                  "options": [{"id": "a", "label": "The tip is 108% of the meal cost."}, {"id": "b", "label": "The total paid is 8% of the meal cost."},
                                              {"id": "c", "label": "The total paid is 108% of the meal cost."}, {"id": "d", "label": "The tip is 1.08 dollars."}]}]}},
                  "answer": '{"single":"b","meaning":"c"}', "hint": "Factor out $m$.", "explanation": ["One.", "Two."]})
    cases.append(choice_case(
        "percent-rewrite-reasoning",
        "A store marks a price of $p$ dollars down 20%. Later it marks the sale price up 20%. Mia says the final price equals the original price. Which statement is right?",
        ["Right: $p - 0.2p + 0.2p = p$.", "Wrong: the final price is $1.2(0.8p) = 0.96p$, 4% less than the original.",
         "Right: the markup adds back $0.2p$, so $0.8p + 0.2p = p$.", "Wrong: the final price is $0.8(0.8p) = 0.64p$."], "option-b", "acd"))
    cases.append(choice_case(
        "percent-rewrite-reasoning",
        "A bike costs $p$ dollars. Its price goes up by 5%. The new price can be written as $p + 0.05p$ or as $1.05p$. Why are these two expressions equal?",
        ["Because $1 + 0.05 = 1.05$.", "Both terms are multiples of $p$: $p + 0.05p = (1 + 0.05)p = 1.05p$, by the distributive property.",
         "Because adding 0.05 to $p$ gives $1.05p$.", "They are not equal: $p + 0.05p = 0.05p^2$."], "option-b", "acd"))
    figure = slope_figure([(0, 0, "A"), (2, 0, "B"), (2, 3, "C, D"), (6, 3, "E"), (6, 9, "F")], [((0, 0), (2, 3)), ((2, 3), (6, 9))])
    head = "Line $\\ell$ has two slope triangles, $ABC$ and $DEF$. A slope triangle is a right triangle with a horizontal leg, a vertical leg and its third side on the line."
    cases.append(choice_case(
        "slope-constant-similar-triangles",
        head + " The right angles are at $B$ and $E$, and the legs are $AB = 2$, $BC = 3$, $DE = 4$ and $EF = 6$. The triangles are similar. Which equation must be true because corresponding sides of similar triangles are proportional, and shows that the two slopes are equal?",
        ["$\\frac{AB}{BC} = \\frac{EF}{DE}$", "$\\frac{BC}{EF} = \\frac{DE}{AB}$", "$\\frac{AC}{DF} = \\frac{AB}{BC}$", "$\\frac{BC}{AB} = \\frac{EF}{DE}$"],
        "option-d", "abc", figure=figure))
    steps = ("Step 1: $AB$ and $DE$ are horizontal, and $BC$ and $EF$ are vertical, so $\\angle B$ and $\\angle E$ are right angles. "
             "Step 2: Triangles $ABC$ and $DEF$ are similar, because both are right triangles. "
             "Step 3: Corresponding sides of similar triangles are proportional, so $\\frac{BC}{AB} = \\frac{EF}{DE}$. "
             "Step 4: $\\frac{BC}{AB}$ and $\\frac{EF}{DE}$ are both rise over run, so the slope of $\\ell$ is the same for both triangles.")
    cases.append(choice_case(
        "slope-constant-similar-triangles",
        head + " One step in this argument that the slope of $\\ell$ is the same for both triangles is wrong. " + steps + " Which step is wrong?",
        ["Step 1", "Step 2", "Step 3", "Step 4"], "option-b", "acd", figure=figure))
    line = {"kind": "scene", "scene": {"v": 1, "elements": [{"type": "graph", "points": [
        {"x": 0, "y": -4, "label": "(0, −4)"}, {"x": 4, "y": 2, "label": "(x, y)"}],
        "slopeTriangles": [{"from": [0, -4], "to": [2, -1], "labels": "shown"}, {"from": [0, -4], "to": [4, 2], "labels": "none"}]}]}}
    cases.append(choice_case(
        "derive-line-equation",
        "A line crosses the $y$-axis at $(0, -4)$, and $(x, y)$ is any other point on the line. Which expression is the slope between $(0, -4)$ and $(x, y)$?",
        ["$\\frac{y}{x}$", "$\\frac{y + 4}{x}$", "$\\frac{x}{y + 4}$", "$\\frac{y + 4}{x + 4}$"], "option-b", "acd", figure=line))
    derivation = ("Step 1: The line crosses the $y$-axis at $(0, -4)$. Step 2: Let $(x, y)$ be any other point on the line. "
                  "Step 3: The slope between $(0, -4)$ and $(x, y)$ is $\\frac{y - (-4)}{x - 0} = \\frac{y + 4}{x}$. "
                  "Step 4: The slope is the same everywhere on the line, so $\\frac{y + 4}{x} = \\frac{3}{2}$. "
                  "Step 5: Multiply both sides by $x$: $y + 4 = \\frac{3}{2} + x$. "
                  "Step 6: Subtract 4 from both sides: $y = \\frac{3}{2}x - 4$.")
    cases.append(choice_case(
        "derive-line-equation",
        "A line has slope $\\frac{3}{2}$ and crosses the $y$-axis at $(0, -4)$. One step of this derivation of its equation is wrong. " + derivation + " Which step is wrong?",
        ["Step 3", "Step 4", "Step 5", "Step 6"], "option-c", "abd", figure=line))
    return cases


def self_test():
    cases = fixtures()
    for case in cases:
        require(review_problem(case) == case["answer"], f"Fixture {case['public']['templateId']}")
    mutations = 0

    def reject(case, change, what):
        nonlocal mutations
        bad = copy.deepcopy(case)
        change(bad)
        try:
            review_problem(bad)
        except (ValueError, KeyError, TypeError, IndexError, ZeroDivisionError, AttributeError):
            mutations += 1
        else:
            raise AssertionError(f"Accepted corrupt case: {what}")
    reject(cases[0], lambda p: p.update(answer="option-a"), "increase only keyed")
    reject(cases[0], lambda p: p["public"]["response"]["options"][3].update(label="$1.05p$"), "two correct forms")
    reject(cases[0], lambda p: p["explanation"].__setitem__(1, "Check with $p = 100$: $1.05 \\cdot 100 = 150$."), "false check")
    reject(cases[1], lambda p: p.update(answer="0.83"), "percents added")
    reject(cases[2], lambda p: p.update(answer="108"), "multiplier read as the increase")
    reject(cases[3], lambda p: p["public"]["response"]["options"][1].update(label="The amount saved is 30% of the original price."), "two true claims")
    reject(cases[4], lambda p: p.update(answer="option-d"), "one fee keyed")
    reject(cases[5], lambda p: p.update(answer="option-a"), "the other equal form")
    reject(cases[6], lambda p: p.update(answer='{"single":"b","meaning":"a"}'), "tip read as the whole")
    reject(cases[7], lambda p: p["public"].update(prompt=p["public"]["prompt"].replace("up 20%", "up 25%")), "unequal changes")
    reject(cases[8], lambda p: p.update(answer="option-a"), "incomplete reason keyed")
    reject(cases[9], lambda p: p["public"]["figure"]["scene"]["elements"][0]["points"][4].update(y=10), "off-line vertex")
    reject(cases[9], lambda p: p.update(answer="option-a"), "reciprocal keyed")
    reject(cases[10], lambda p: p.update(answer="option-c"), "true proportion blamed")
    reject(cases[11], lambda p: p.update(answer="option-a"), "origin slope keyed")
    reject(cases[12], lambda p: p.update(answer="option-d"), "correct step blamed")
    return {"fixtures": len(cases), "mutations": mutations}


if __name__ == "__main__":
    print(self_test())
    if len(sys.argv) > 1:
        for raw in open(sys.argv[1]):
            review_problem(json.loads(raw))
