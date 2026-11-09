"""Independent review of the strategy-reasons family (2.NBT.B.9) from public
payloads only.

The student's work is read from the prompt: the notebook lines, or the column
stack with its carry and borrow marks. Every shown equation is evaluated with
exact integers. The oracle decides, by its own rules, which step keeps the same
amount and why, which line breaks it, and what a mark is worth, then finds the
one option that says so. The private answer, hint and explanation are only
values under test.
"""

import copy
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

SUPPORTED = frozenset({
    "strategy-step-reason", "strategy-flaw", "written-method-meaning", "written-method-reason",
})
REVIEW_RETURNS_ANSWER = True
PLACEHOLDER = re.compile(r"\$\{|\bundefined\b|\bNaN\b|\bnull\b|\[object")
FORBIDDEN = re.compile(r"commutative|associative|regroup|algorithm", re.IGNORECASE)
PRO = r"(?:She|He)"
pro = r"(?:she|he)"


def require(condition, message):
    if not condition:
        raise ValueError(message)


def words(label):
    text = re.sub(r"\\[a-zA-Z]+", " ", label.replace("$", " "))
    return len([t for t in text.split() if re.search(r"[^\W_]", t)])


def plural(n, noun):
    return f"{n} {noun}" if n == 1 else f"{n} {noun}s"


# ---------------------------------------------------------------- arithmetic

def value(expr):
    """An integer sum or difference written with + and - only."""
    expr = expr.replace("−", "-").strip()
    require(re.fullmatch(r"\d+(?:\s*[-+]\s*\d+)*", expr), f"Not a sum or difference: {expr!r}")
    tokens = re.findall(r"[-+]|\d+", expr)
    total, sign = int(tokens[0]), 1
    for token in tokens[1:]:
        if token in "+-":
            sign = 1 if token == "+" else -1
        else:
            total += sign * int(token)
    return total


def equations(text):
    """Every $left = right$ span of a line, as (left, right, holds)."""
    out = []
    for span in re.findall(r"\$([^$]+)\$", text):
        if "=" in span:
            left, right = span.split("=")
            out.append((left.strip(), right.strip(), value(left) == value(right)))
    return out


def parse_notebook(prompt):
    lines = prompt.split("\n")
    require(len(lines) >= 4, "A head line, the notebook and a question")
    book = []
    for i, line in enumerate(lines[1:-1]):
        match = re.fullmatch(rf"Line {i + 1}: (.+)", line)
        require(match is not None, f"Notebook line {line!r}")
        book.append(match.group(1))
    return lines[0], book, lines[-1]


def one_option(options, pattern, what):
    hits = [o for o in options if re.fullmatch(pattern, o["label"])]
    require(len(hits) == 1, f"{what}: expected exactly one option matching {pattern!r}, found {len(hits)}")
    return hits[0]["id"]


def check_options(options, limit=12):
    labels = [o["label"] for o in options]
    require(len(set(labels)) == len(labels), "Options repeat")
    counts = [words(label) for label in labels]
    require(max(counts) <= limit and max(counts) - min(counts) <= 3, f"Option lengths {counts}")
    for label in labels:
        require(not FORBIDDEN.search(label), f"Property name in {label!r}")


# ---------------------------------------------------------------- strategy-step-reason

def solve_step(public):
    head, book, question = parse_notebook(public["prompt"])
    options = public["response"]["options"]
    require(public["response"]["kind"] == "choice" and len(options) == 4, "Four reasons")
    check_options(options)
    for line in book:
        for left, right, holds in equations(line):
            require(holds, f"Shown arithmetic {left} = {right} is false")
    eq = [equations(line) for line in book]

    def nums(line):
        return [int(n) for n in re.findall(r"\d+", line)]

    m = re.fullmatch(r"\w+ adds \$(\d+) \+ (\d+)\$ like this\.", head)
    s = re.fullmatch(r"\w+ subtracts \$(\d+) - (\d+)\$ like this\.", head)
    q = re.fullmatch(r"Why can \w+ break (\d+) into (\d+) and (\d+) in line 1\?", question)
    if q:
        require(m is not None and len(book) == 3, "Break by place")
        a, b = int(m.group(1)), int(m.group(2))
        bb, t, o = (int(x) for x in q.groups())
        require(bb == b and t % 10 == 0 and 1 <= o <= 9 and t + o == b, "Split by place")
        require(eq[0][0][:2] == (str(b), f"{t} + {o}"), "Line 1 splits b")
        require(value(eq[2][0][1]) == a + b, "Final sum")
        return one_option(options, rf"{t} and {o} make {b}, so {pro} still adds {b}\.", "V1")
    if re.fullmatch(r"Why can \w+ add the tens and the ones apart in lines 1 and 2\?", question):
        require(m is not None and len(book) == 3, "Tens with tens")
        a, b = int(m.group(1)), int(m.group(2))
        ta, tb = (int(x) for x in re.match(r"(\d+) \+ (\d+)", eq[0][0][0]).groups())
        oa, ob = (int(x) for x in re.match(r"(\d+) \+ (\d+)", eq[1][0][0]).groups())
        require((ta, oa, tb, ob) == (a - a % 10, a % 10, b - b % 10, b % 10), "Parts by place")
        require(value(eq[2][0][1]) == a + b, "Final sum")
        return one_option(options, r"All four parts are still added\. Order does not change the total\.", "V2")
    q = re.fullmatch(r"Why does \w+ take (\d+) away in line 3\?", question)
    if q:
        require(m is not None and len(book) == 3, "Round and give back")
        a, b, k = int(m.group(1)), int(m.group(2)), int(q.group(1))
        r = a + k
        require(r % 10 == 0 and 1 <= k <= 3, "A tens number just above a")
        require(eq[0][0][:2] == (f"{a} + {k}", str(r)) and eq[1][0][0] == f"{r} + {b}", "Lines 1 and 2")
        require(eq[2][0][0] == f"{r + b} - {k}" and value(eq[2][0][1]) == a + b, "Line 3 gives back")
        return one_option(options, rf"{PRO} added {r}, not {a}\. That is {k} too many\.", "V3")
    q = re.fullmatch(r"Why is \$(\d+) \+ (\d+)\$ the same as \$(\d+) \+ (\d+)\$\?", question)
    if q:
        require(m is not None and len(book) == 3, "Give and take")
        r, b2, a, b = (int(x) for x in q.groups())
        k = r - a
        require((a, b) == (int(m.group(1)), int(m.group(2))) and r % 10 == 0 and 1 <= k <= 3 and b2 == b - k, "Moved amount")
        require(eq[0][0][:2] == (f"{a} + {k}", str(r)) and eq[1][0][:2] == (f"{b} - {k}", str(b2)), "Lines 1 and 2")
        require(value(eq[2][0][1]) == a + b, "Same sum")
        return one_option(options, rf"{k} moved from {b} to {a}\. Nothing was added or lost\.", "V4")
    q = re.fullmatch(r"Why does \w+ add (\d+) back in line 3\?", question)
    if q:
        require(s is not None and len(book) == 3, "Subtract a round number")
        a, b, k = int(s.group(1)), int(s.group(2)), int(q.group(1))
        r = b + k
        require(r % 10 == 0 and 1 <= k <= 3, "A tens number just above b")
        require(eq[0][0][:2] == (f"{b} + {k}", str(r)) and eq[1][0][0] == f"{a} - {r}", "Lines 1 and 2")
        require(eq[2][0][0] == f"{a - r} + {k}" and value(eq[2][0][1]) == a - b, "Line 3 adds back")
        return one_option(options, rf"{PRO} took away {r}, not {b}\. That is {k} too many\.", "V5")
    q = re.fullmatch(r"Why is \$(\d+) - (\d+)\$ the same as \$(\d+) - (\d+)\$\?", question)
    if q:
        require(s is not None and len(book) == 3, "Shift both")
        a2, r, a, b = (int(x) for x in q.groups())
        k = r - b
        require((a, b) == (int(s.group(1)), int(s.group(2))) and r % 10 == 0 and 1 <= k <= 3 and a2 == a + k, "Same shift")
        require(value(eq[2][0][1]) == a - b, "Same difference")
        return one_option(options, rf"Both numbers moved up {k}\. The gap between them stayed the same\.", "V6")
    q = re.fullmatch(r"Why can \w+ add up from (\d+) to find \$(\d+) - (\d+)\$\?", question)
    if q:
        require(s is not None and len(book) == 3, "Count up")
        b, a = int(q.group(1)), int(q.group(2))
        require((a, b) == (int(s.group(1)), int(s.group(2))) and int(q.group(3)) == b, "Same numbers")
        h1, rr = int(eq[0][0][0].split(" + ")[1]), value(eq[0][0][1])
        h2 = int(eq[1][0][0].split(" + ")[1])
        require(eq[0][0][0].startswith(f"{b} + ") and rr % 10 == 0 and rr + h2 == a, "Hops reach a")
        require(value(eq[2][1][1]) == a - b == h1 + h2, "Hops make the difference")
        return one_option(options, rf"\${a} - {b}\$ asks what goes with {b} to make {a}\.", "V7")
    q = re.fullmatch(r"Why can \w+ add the (\d) and the (\d) first, out of order\?", question)
    if q:
        n = re.fullmatch(r"\w+ adds \$(\d+) \+ (\d+) \+ (\d+) \+ (\d+)\$ like this\.", head)
        require(n is not None and len(book) == 3, "Four addends")
        values = [int(x) for x in n.groups()]
        ones = [v % 10 for v in values]
        p1, p2 = int(q.group(1)), int(q.group(2))
        require((p1, p2) == (ones[0], ones[2]) and p1 + p2 == 10 and ones[1] + ones[3] == 10, "Pairs out of order")
        require(value(eq[1][0][1]) == sum(v - v % 10 for v in values), "Tens")
        require(value(eq[2][0][1]) == sum(values), "Total")
        return one_option(options, r"The order you add numbers in does not change the total\.", "V8")
    if head.endswith("in her head.") or head.endswith("in his head."):
        require(len(book) == 2, "Two lines of mental work")
        left, right, _ = eq[0][0]
        n = int(left.split(" ")[0])
        if re.fullmatch(r"\w+ adds 100 in (?:her|his) head\.", head):
            require(left == f"{n} + 100" and int(right) == n + 100 and n + 100 <= 999, "Add 100")
            require(book[1] == f"Only the hundreds digit changed: {n // 100} became {n // 100 + 1}.", "Only hundreds")
            require(question == "Why did only the hundreds digit change?", "Question")
            return one_option(options, r"100 is 1 hundred with no tens or ones to add\.", "V9 +100")
        if re.fullmatch(r"\w+ takes away 10 in (?:her|his) head\.", head):
            require(left == f"{n} - 10" and n // 10 % 10 == 0 and n >= 200, "Take 10 across a zero")
            require(book[1] == f"The tens digit 0 became 9, and the hundreds digit {n // 100} became {n // 100 - 1}.", "Digits")
            require(question == "Why did the hundreds digit change too?", "Question")
            return one_option(options, r"There were 0 tens, so 1 hundred became 10 tens\.", "V9 -10")
        require(re.fullmatch(r"\w+ adds 10 in (?:her|his) head\.", head) and left == f"{n} + 10", "Add 10")
        require(n // 10 % 10 == 9 and n + 10 <= 999, "Tens digit 9")
        require(book[1] == f"The tens digit 9 became 0, and the hundreds digit {n // 100} became {n // 100 + 1}.", "Digits")
        require(question == "Why did the hundreds digit change too?", "Question")
        return one_option(options, r"9 tens and 1 more ten make 10 tens: 1 hundred\.", "V9 +10")
    q = re.fullmatch(r"Why does the sum (\d+) have (\d+) (tens|hundreds) when line 1 has (\d+)\?", question)
    require(q is not None and m is not None, f"Unrecognized step question {question!r}")
    a, b = int(m.group(1)), int(m.group(2))
    require(100 <= a <= 999 and 100 <= b <= 999 and int(q.group(1)) == a + b, "Three-digit sum")
    columns = [(a // p % 10) + (b // p % 10) for p in (1, 10, 100)]
    if q.group(3) == "tens":
        require(columns[0] >= 10 and columns[1] + 1 < 10, "Only the ones reach ten")
        require(int(q.group(4)) == columns[1] and int(q.group(2)) == columns[1] + 1 == (a + b) // 10 % 10, "Tens count")
        return one_option(options, rf"{columns[0]} is 1 ten and {plural(columns[0] - 10, 'one')}\. The ten joins the tens\.", "V10 ones")
    require(columns[1] >= 10 and columns[0] < 10, "Only the tens reach ten")
    require(int(q.group(4)) == columns[2] and int(q.group(2)) == columns[2] + 1 == (a + b) // 100, "Hundreds count")
    tv = 10 * columns[1]
    return one_option(options, rf"{tv} is 1 hundred and {plural(columns[1] - 10, 'ten')}\. The hundred joins the hundreds\.", "V10 tens")


# ---------------------------------------------------------------- strategy-flaw

def flaw_key(public):
    prompt = public["prompt"]
    lines = prompt.split("\n")
    require(len(lines) == 5 and lines[-1] == "Find the wrong line and say what went wrong.", "Five prompt lines")
    head = lines[0]
    book = []
    for i, line in enumerate(lines[1:4]):
        match = re.fullmatch(rf"Line {i + 1}: (.+)", line)
        require(match is not None, f"Notebook line {line!r}")
        book.append(match.group(1))
    response = public["response"]
    require(response["kind"] == "multi-part-choice" and response["layout"] == "slots", "Slots")
    blanks = response["blanks"]
    require([b["id"] for b in blanks] == ["line", "why"], "Blank ids")
    require([o["label"] for o in blanks[0]["options"]] == ["Line 1", "Line 2", "Line 3"], "Line options")
    reasons = blanks[1]["options"]
    require(len(reasons) == 4 and len({o["label"] for o in reasons}) == 4, "Four reasons")
    require(all(len(o["label"]) <= 80 for o in reasons), "Reason length")
    eq = [equations(line) for line in book]
    work = re.fullmatch(r"One line of \w+'s work for \$([^$]+)\$ is wrong\.", head)
    require(work is not None, f"Flaw head {head!r}")
    shown = work.group(1)
    hundred = re.fullmatch(r"(\d+) \+ 100", shown)
    four = re.fullmatch(r"(\d+) \+ (\d+) \+ (\d+) \+ (\d+)", shown)
    add = None if hundred else re.fullmatch(r"(\d+) \+ (\d+)", shown)
    sub = re.fullmatch(r"(\d+) - (\d+)", shown)

    def pick(line, pattern, what):
        line_id = blanks[0]["options"][line - 1]["id"]
        return {"line": line_id, "why": one_option(reasons, pattern, what)}, line

    def eq_of(i):
        require(len(eq[i]) >= 1, f"Line {i + 1} has an equation")
        return eq[i][0]

    if hundred:
        n = int(hundred.group(1))
        last = re.fullmatch(rf"So \${n} \+ 100 = (\d+)\$\.", book[2])
        require(last is not None and int(last.group(1)) == n + 10 != n + 100, "The sum moved the tens")
        bad = [i + 1 for i, line in enumerate(book) if "add 1 to the tens digit" in line]
        require(len(bad) == 1, "One line moves the tens")
        if bad[0] == 2:
            require(book[0] == f"The hundreds digit of {n} is {n // 100}.", "A true first line")
        return pick(bad[0], r"100 is 1 hundred, not 1 ten\. The hundreds digit changes\.", "F8")
    if four:
        values = [int(x) for x in four.groups()]
        ones = [v % 10 for v in values]
        require(sum(ones) == 20 and book[0] == f"Ones: ${' + '.join(map(str, ones))} = 20$", "Ones make 20")
        require(book[1] == "Write 0 in the ones and carry 1 ten.", "Carry line")
        tens = [v // 10 for v in values]
        t = re.fullmatch(r"Tens: \$([\d +]+) = (\d+)\$, so the sum is (\d+)\.", book[2])
        require(t is not None and [int(x) for x in t.group(1).split(" + ")] == tens + [1], "Tens with the carry")
        require(int(t.group(3)) == 10 * int(t.group(2)) != sum(values), "Shown sum is wrong")
        return pick(2, rf"20 ones are 2 tens\. {PRO} should carry 2, not 1\.", "F9")
    if add:
        a, b = int(add.group(1)), int(add.group(2))
        e1, e2, e3 = eq_of(0), eq_of(1), eq_of(2)
        if e3[2] is False:
            # Lose the ten: tens line, ones line, and a sum that drops a ten.
            ta, tb = (int(x) for x in e1[0].split(" + "))
            oa, ob = (int(x) for x in e2[0].split(" + "))
            require((ta, oa, tb, ob) == (a - a % 10, a % 10, b - b % 10, b % 10) and e1[2] and e2[2], "True parts")
            os_ = oa + ob
            require(os_ >= 10 and value(e3[1]) == ta + tb + os_ - 10, "The ten was lost")
            return pick(3, rf"{os_} is 1 ten and {plural(os_ - 10, 'one')}\. The ten must join the tens\.", "F5")
        require(e1[2] and e2[2] and e3[2], "Compensation lines have true arithmetic")
        k_line = e1 if value(e1[1]) % 10 == 0 and e1[0].startswith(f"{a} + ") else e2
        k = int(k_line[0].split(" + ")[1])
        r = a + k
        require(r % 10 == 0 and 1 <= k <= 3, "A tens number just above a")
        if e3[0] == f"{r + b} + {k}":
            require(e1[0] == f"{a} + {k}" and e2[0] == f"{r} + {b}", "Lines 1 and 2")
            require(value(e3[1]) != a + b, "Shown sum is wrong")
            return pick(3, rf"{PRO} added {r}, {k} more than {a}\. {PRO} should take {k} away\.", "F1")
        # Add to both: one line rounds a, the other adds the same k to b.
        both = [i for i, e in enumerate((e1, e2)) if e[0] == f"{b} + {k}"]
        require(len(both) == 1 and {e1[0], e2[0]} == {f"{a} + {k}", f"{b} + {k}"}, "Both numbers moved up")
        require(e3[0] == f"{r} + {b + k}" and value(e3[1]) == a + b + 2 * k, "Line 3 adds the moved numbers")
        return pick(both[0] + 1, rf"{PRO} added {k} to both numbers\. {PRO} should take {k} from {b}\.", "F2")
    require(sub is not None, f"Unrecognized flaw head {head!r}")
    a, b = int(sub.group(1)), int(sub.group(2))
    d = a - b
    if book[2].startswith("So "):
        claim = re.fullmatch(rf"So \${a} - {b} = (\d+)\$\.", book[2])
        require(claim is not None and int(claim.group(1)) != d, "A wrong conclusion")
        e1, e2 = eq_of(0), eq_of(1)
        require(e1[2] and e2[2], "True lines before the conclusion")
        if e2[0].startswith(f"{a} - "):
            k = int(e1[0].split(" + ")[1])
            r = b + k
            require(e1[0] == f"{b} + {k}" and e2[0] == f"{a} - {r}" and r % 10 == 0, "Took away a tens number")
            return pick(3, rf"{PRO} took away {r}, {k} more than {b}\. {k} must be added back\.", "F3")
        h1 = int(e1[0].split(" + ")[1])
        r = value(e1[1])
        h2 = int(e2[0].split(" + ")[1])
        require(e1[0] == f"{b} + {h1}" and e2[0] == f"{r} + {h2}" and value(e2[1]) == a, "Hops reach a")
        require(int(claim.group(1)) == h2 and h1 + h2 == d, "One hop kept")
        return pick(3, rf"The hops are {h1} and {h2}\. Both are part of the gap\.", "F6")
    e1, e2, e3 = eq_of(0), eq_of(1), eq_of(2)
    if e1[0].startswith(f"{b} + "):
        k = int(e1[0].split(" + ")[1])
        r = b + k
        require(e1[2] and e2[2] and e3[2] and r % 10 == 0, "True lines")
        require(e2[0] == f"{a} - {r}" and e3[0] == f"{a - r} - {k}", "Took away more")
        require(value(e3[1]) != d, "Shown difference is wrong")
        return pick(3, rf"{r} is {k} more than {b}\. {PRO} took {k} too many, so add {k} back\.", "F4")
    # Smaller from larger: the ones line takes the top ones from the bottom ones.
    ta, oa, tb, ob = a // 10, a % 10, b // 10, b % 10
    require(oa < ob and ta > tb, "A borrow is needed")
    tens_line, ones_line = f"{10 * ta} - {10 * tb}", f"{ob} - {oa}"
    found = [i for i, e in enumerate((e1, e2)) if e[0] == ones_line]
    require(len(found) == 1 and {e1[0], e2[0]} == {tens_line, ones_line} and e1[2] and e2[2], "Tens and flipped ones")
    require(value(e3[1]) == 10 * (ta - tb) + (ob - oa) != d, "Shown difference is wrong")
    return pick(found[0] + 1, rf"The {oa} is on top\. It is \${oa} - {ob}\$, so open a ten first\.", "F7")


def solve_flaw(public):
    key, _ = flaw_key(public)
    return json.dumps(key, separators=(",", ":"))


# ---------------------------------------------------------------- written methods

def parse_stack(prompt):
    match = re.search(r"\$\\begin\{array\}\{r(c+)\} (.+) \\end\{array\}\$", prompt)
    require(match is not None, "A column stack")
    width = len(match.group(1))
    rows = [row.strip() for row in match.group(2).split("\\\\")]
    require(rows[-1].startswith("\\hline"), "A result row under a line")
    rows[-1] = rows[-1][len("\\hline"):].strip()
    table = []
    for row in rows:
        cells = [c.strip() for c in row.split("&")]
        require(len(cells) == width + 1, f"Row width {row!r}")
        table.append(cells)
    return table


def digits_of(cells):
    text = "".join(cells)
    require(re.fullmatch(r"\d+", text), f"Digits {cells!r}")
    return int(text)


def mark(cell):
    m = re.fullmatch(r"\{\\scriptstyle (?:\\cancel\{10\}\\,)?(\d+)\}", cell)
    return int(m.group(1)) if m else None


def blocks_of_option(option):
    elements = option["scene"]["elements"]
    require(len(elements) == 1 and elements[0]["type"] == "baseTen", "One base-ten picture")
    e = elements[0]
    found = (e["hundreds"], e["tens"], e["ones"])
    parts = []
    for n, noun in zip(found, ("hundred flat", "ten rod", "unit cube")):
        if n:
            parts.append(plural(n, noun))
    listed = parts[0] if len(parts) == 1 else ", ".join(parts[:-1]) + " and " + parts[-1]
    require(option["label"] == f"Base-ten blocks: {listed}.", f"Label {option['label']!r} describes the picture")
    return found


def solve_written_meaning(public):
    response = public["response"]
    require(response["kind"] == "figure-choice" and response["noun"] == "Picture" and len(response["options"]) == 4, "Four pictures")
    prompt = public["prompt"]
    table = parse_stack(prompt)
    pictures = [blocks_of_option(o) for o in response["options"]]
    require(len(set(pictures)) == 4, "Pictures differ")
    carry = re.match(r"\w+ added \$(\d+) \+ (\d+)\$ and wrote a small 1 above the (tens|hundreds)\.", prompt)
    if carry:
        a, b = int(carry.group(1)), int(carry.group(2))
        marks, top, bottom, result = table
        require(top[0] == "" and bottom[0] == "+" and digits_of(top[1:]) == a and digits_of(bottom[1:]) == b, "Addends")
        require(digits_of(result[1:]) == a + b, "Sum row")
        width = len(top) - 1
        column = [i for i, c in enumerate(marks[1:]) if c]
        require(len(column) == 1 and marks[1 + column[0]] == "{\\scriptstyle 1}", "One small 1")
        place = 10 ** (width - 1 - column[0])
        require(place == (10 if carry.group(3) == "tens" else 100), "The 1 sits where the prompt says")
        below = (a // (place // 10) % 10) + (b // (place // 10) % 10)
        require(below >= 10, "The column to the right makes a ten")
        expected = (place // 100, place // 10 % 10, 0) if place == 100 else (0, 1, 0)
    else:
        borrow = re.match(r"\w+ subtracted \$(\d+) - (\d+)\$", prompt)
        require(borrow is not None, "A subtraction")
        a, b = int(borrow.group(1)), int(borrow.group(2))
        marks, top, bottom, result = table
        require(bottom[0] == "-" and digits_of([c for c in bottom[1:] if c]) == b, "Subtrahend")
        crossed = [re.fullmatch(r"\\cancel\{(\d)\}", c) for c in top[1:]]
        require(all(crossed), "Every top digit is crossed out")
        require(int("".join(c.group(1) for c in crossed)) == a, "Top number")
        new = [mark(c) for c in marks[1:]]
        require(all(n is not None for n in new), "A new number over every digit")
        places = [10 ** (len(new) - 1 - i) for i in range(len(new))]
        require(sum(n * p for n, p in zip(new, places)) == a, "The marks keep the amount")
        require(a % 10 < b % 10, "The ones needed a ten")
        require(digits_of([c for c in result[1:] if c]) == a - b, "Difference row")
        expected = tuple([0] * (3 - len(new)) + new)
    hits = [o["id"] for o, p in zip(response["options"], pictures) if p == tuple(expected)]
    require(len(hits) == 1, f"Exactly one picture shows {expected}")
    return hits[0]


def solve_written_reason(public):
    response = public["response"]
    require(response["kind"] == "choice" and len(response["options"]) == 4, "Four reasons")
    check_options(response["options"])
    prompt = public["prompt"]
    head = re.match(r"\w+ adds \$(\d+) \+ (\d+)\$ in columns\.", prompt)
    require(head is not None, "Column addition")
    a, b = int(head.group(1)), int(head.group(2))
    top, bottom, result = parse_stack(prompt)
    require(digits_of(top[1:]) == a and bottom[0] == "+" and digits_of(result[1:]) == a + b, "Stack")
    shown_b = bottom[1:]
    require(digits_of([c for c in shown_b if c]) == b, "Second addend")
    # Right-aligned: the last digit of b sits under the ones of a.
    filled = [i for i, c in enumerate(shown_b) if c]
    require(filled == list(range(len(shown_b) - len(str(b)), len(shown_b))), "Lined up on the right")
    question = prompt.split("\n")[-1]
    one = re.fullmatch(r"Why does \w+ write the (\d) under the (\d), not under the (\d)\?", question)
    if one:
        d, under, other = (int(x) for x in one.groups())
        require(b == d < 10 and under == a % 10 and other == a // 10 % 10, "Ones under ones")
        return one_option(response["options"], rf"{d} is {d} ones\. Ones go with ones\.", "W5 ones")
    two = re.fullmatch(r"Why does \w+ write the (\d) of (\d+) under the (\d), not under the (\d)\?", question)
    require(two is not None, f"Unrecognized question {question!r}")
    d, bb, under, other = (int(x) for x in two.groups())
    require(bb == b and d == b // 10 and under == a // 10 % 10 and other == a // 100, "Tens under tens")
    return one_option(response["options"], rf"The {d} in {b} is {plural(d, 'ten')}\. Tens go with tens\.", "W5 tens")


# ---------------------------------------------------------------- entry points

def solve(public):
    template = public["templateId"]
    require(template in SUPPORTED, "Wrong family")
    if template == "strategy-step-reason":
        return solve_step(public)
    if template == "strategy-flaw":
        return solve_flaw(public)
    if template == "written-method-meaning":
        return solve_written_meaning(public)
    return solve_written_reason(public)


def review_problem(problem):
    public = problem["public"]
    expected = solve(public)
    require(problem["answer"] == expected, f"Answer {problem['answer']} disagrees with the work; expected {expected}")
    texts = [public["prompt"], problem["hint"], *problem["explanation"], *(problem.get("choiceFeedback") or {}).values()]
    for text in texts:
        require(not PLACEHOLDER.search(text), f"Unrendered placeholder in {text!r}")
    require(not FORBIDDEN.search(public["prompt"]), "Property name in the prompt")
    # The hint teaches a first step; it never quotes the keyed reason.
    response = public["response"]
    if response["kind"] == "choice":
        keyed = next(o["label"] for o in response["options"] if o["id"] == expected)
        require(keyed not in problem["hint"], "Hint quotes the answer")
        require(set(problem.get("choiceFeedback") or {}) == {o["id"] for o in response["options"]} - {expected}, "Feedback for each wrong reason")
    if public["templateId"] == "strategy-flaw":
        key, line = flaw_key(public)
        require(problem["explanation"][0].startswith(f"Line {line} is wrong"), "Explanation names the wrong line")
    return expected


# ---------------------------------------------------------------- self test

def opts(*labels):
    return [{"id": f"option-{'abcd'[i]}", "label": label} for i, label in enumerate(labels)]


def self_test():
    step = {"public": {"templateId": "strategy-step-reason", "seed": "f",
                       "prompt": "Noor adds $47 + 38$ like this.\nLine 1: $38 = 30 + 8$\nLine 2: $47 + 30 = 77$\nLine 3: $77 + 8 = 85$\nWhy can Noor break 38 into 30 and 8 in line 1?",
                       "response": {"kind": "choice", "label": "Choose the reason", "options": opts(
                           "Because 30 is bigger than 8, so it goes first.",
                           "30 and 8 make 38, so she still adds 38.",
                           "Because you always add the tens first.",
                           "Because adding 30 is easier than adding 38.")}},
            "answer": "option-b", "hint": "Say what 38 is made of.",
            "explanation": ["Line 1 says 38 is 3 tens and 8 ones."],
            "choiceFeedback": {"option-a": "Size.", "option-c": "Rule.", "option-d": "Easier."}}
    require(review_problem(step) == "option-b", "Step fixture")
    flaw = {"public": {"templateId": "strategy-flaw", "seed": "f",
                       "prompt": "One line of Ana's work for $38 + 25$ is wrong.\nLine 1: $38 + 2 = 40$\nLine 2: $40 + 25 = 65$\nLine 3: $65 + 2 = 67$\nFind the wrong line and say what went wrong.",
                       "response": {"kind": "multi-part-choice", "label": "Choose the line and the reason", "layout": "slots",
                                    "blanks": [{"id": "line", "label": "Which line has the mistake?", "options": [
                                        {"id": "a", "label": "Line 1"}, {"id": "b", "label": "Line 2"}, {"id": "c", "label": "Line 3"}]},
                                        {"id": "why", "label": "What went wrong?", "options": [
                                            {"id": "a", "label": "$40 + 25$ is not 65."},
                                            {"id": "b", "label": "She added 40, 2 more than 38. She should take 2 away."},
                                            {"id": "c", "label": "She must not add 2 to 38 at all."},
                                            {"id": "d", "label": "Line 2 should say $25 + 40$, not $40 + 25$."}]}]}},
            "answer": '{"line":"c","why":"b"}', "hint": "Check each line against $38 + 25$.",
            "explanation": ["Line 3 is wrong. Lines 1 and 2 are true."]}
    require(review_problem(flaw) == flaw["answer"], "Flaw fixture")
    stack = "$\\begin{array}{rcc} & {\\scriptstyle 5} & {\\scriptstyle 12} \\\\ & \\cancel{6} & \\cancel{2} \\\\ - & 4 & 8 \\\\ \\hline & 1 & 4 \\end{array}$"

    def picture(i, h, t, o):
        parts = [p for p in (plural(h, "hundred flat") if h else "", plural(t, "ten rod") if t else "", plural(o, "unit cube") if o else "") if p]
        listed = parts[0] if len(parts) == 1 else ", ".join(parts[:-1]) + " and " + parts[-1]
        return {"id": f"option-{'abcd'[i]}", "label": f"Base-ten blocks: {listed}.",
                "scene": {"v": 1, "elements": [{"type": "baseTen", "id": "blocks", "hundreds": h, "tens": t, "ones": o}]}}
    written = {"public": {"templateId": "written-method-meaning", "seed": "f",
                          "prompt": f"Dev subtracted $62 - 48$, crossed out 6 and 2, and wrote 5 and 12.\n{stack}\nWhich blocks show 62 now?",
                          "response": {"kind": "figure-choice", "label": "Choose the blocks", "noun": "Picture", "options": [
                              picture(0, 0, 5, 2), picture(1, 0, 5, 12), picture(2, 0, 6, 12), picture(3, 0, 5, 3)]}},
               "answer": "option-b", "hint": "Dev took 1 ten from the 6 tens of 62.", "explanation": ["The ones need $2 - 8$."],
               "choiceFeedback": {"option-a": "x", "option-c": "y", "option-d": "z"}}
    require(review_problem(written) == "option-b", "Written fixture")
    mutations = 0
    for base, change, what in (
            (step, lambda p: p.update(answer="option-d"), "benefit keyed as the reason"),
            (step, lambda p: p["public"].update(prompt=p["public"]["prompt"].replace("$77 + 8 = 85$", "$77 + 8 = 84$")), "false shown arithmetic"),
            (step, lambda p: p["public"]["response"]["options"][1].update(label="30 and 8 make 38, so she still adds 38 every single time today."), "unbalanced option length"),
            (flaw, lambda p: p.update(answer='{"line":"b","why":"b"}'), "blames the true line"),
            (flaw, lambda p: p["public"].update(prompt=p["public"]["prompt"].replace("$65 + 2 = 67$", "$65 - 2 = 63$")), "no line is wrong"),
            (written, lambda p: p.update(answer="option-c"), "made ones without taking a ten"),
            (written, lambda p: p["public"]["response"]["options"][1].update(label="Base-ten blocks: 5 ten rods and 2 unit cubes."), "label disagrees with the picture"),
            (written, lambda p: p["public"].update(prompt=p["public"]["prompt"].replace("{\\scriptstyle 12}", "{\\scriptstyle 11}")), "marks change the amount")):
        bad = copy.deepcopy(base)
        change(bad)
        try:
            review_problem(bad)
        except (ValueError, KeyError, TypeError, IndexError, AttributeError, StopIteration):
            mutations += 1
        else:
            raise AssertionError(f"Accepted corrupt strategy-reasons case: {what}")
    return {"fixtures": 3, "mutations": mutations}


if __name__ == "__main__":
    print(self_test())
