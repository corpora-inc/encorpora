#!/usr/bin/env python3
"""
An optional teaching reviewer: Codex CLI reads a screenplay with the app's
facts and returns a structured assessment.
The machine checks in make.ts judge layout, timing and arithmetic; this judges
the teaching. Compare its findings with an independent watch-through.

    python3 -I film/judge.py <out-dir> <template-id>[=<screenplay.json>] [...]

Writes <out-dir>/<id>.json and prints one line per lesson.
"""
import argparse, concurrent.futures as cf, json, os, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from critic import facts, script_text  # noqa: E402

STANDARD = """You judge the screenplay of one short math lesson film for AMP, a premium math app for learners from counting to precalculus. The film is the voice plus a whiteboard plus a figure card that animates; you get the voice and the board text, and you are told which shots have a figure.

Teach the intuition, define prerequisites and work distinct cases completely. Use concise language, valid methods and a recap that summarizes what was taught.

First decide the kind of problem type from the variants the app generates:
- "one-method": every variant is solved the same way. The lesson teaches the way to see it, then the method, on examples that are each a different case.
- "mixed": the variants are different problems under one name (money stories that are sometimes fewest coins, sometimes a total, sometimes change, sometimes equal shares; mixed word problems). There is no shared method. A mixed lesson works one example of each kind from reading the story and picturing what happens.

Faults. Any one of them means "fix":
1. forced-method: a mixed problem type taught as one method, or a recap that lists unrelated recipes as if they were steps of one method.
2. repeated-case: two examples that are the same kind of case (same path to the answer, same trap). Name both.
3. answer-dump: answers to other problems recited without working them, to "cover" variants.
4. every-choice: one multiple-choice problem walked through choice by choice when the checks are the same kind of work.
5. recipe: a procedure with no way to see why, when a simple way to see it exists; or a shortcut that only works sometimes.
6. mixed-list: words or ideas from different categories grouped in one sentence so they sound alike.
7. wrong: any wrong math, misleading wording, or false "always". Recompute every number.
8. mismatch: the voice and the board disagree, or the board shows something never said.
9. padding: anything said twice, filler, or a sentence that teaches nothing.
10. coverage: a kind or trap the app generates that no example covers.
11. recap: the recap does not summarize what was actually taught, or claims something the lesson did not show.
12. other: grades K to 2 with struck-out work; any comparison of peoples, cultures, places or eras.
13. tacked-on: extra examples rushed through at the end of a worked example or on the same screen ("9.14 + 0.60 = 9.74" written under a finished problem with no treatment).
14. not-the-algorithm: when the lesson teaches multi-digit or decimal addition, subtraction or multiplication, or chops one such computation into place-by-place pieces: the work shown as a chain of small horizontal equations ("6-5=1", "10+6=16") instead of the numbers stacked with place values (or decimal points) lined up and the standard algorithm run with carries or borrows. A single horizontal line inside a lesson about something else ("4+6+11=21" to find a mean) is fine.
15. picture: a figure that confuses instead of showing why: parts whose meaning is not obvious from the picture itself (bars standing for wholes, tenths and hundredths with no labels, or not drawn to scale so a tenth is not one tenth of the whole; colors that stand for different things with no key), or a picture where the numbers alone are clearer. Self-evident pictures need no labels (towers whose heights are the values, counters to count). You get a summary of each figure's parts and labels.

Always major: also tacked-on, not-the-algorithm, and a picture that confuses.

Severity. Each fault is "major" or "minor":
- major: the fault prevents correct understanding. Always major: forced-method, answer-dump, every-choice, mixed-list, a wrong number or a false statement a learner would believe, a recap that claims a shared method or misstates what was taught. repeated-case is major only when the examples are interchangeable (same path, same trap, same question, nothing new to notice) or three or more examples share one case.
- minor: worth improving without misleading the learner: two examples that share a method but differ in what is asked, which number is renamed, or which root fails; a short warning card the voice does not read word for word; a recap that leaves out one form; loose wording that does not mislead.

Examples can differ in a meaningful way even when they share a method: comparing 5/8 with 3/4 and then 2/9 with 1/3 (asks for the lesser) and then 4/3 with 3/2; making ten with 8+5 and then 7+9. Do not call those major.

"verdict" is "fix" when there is at least one major fault, otherwise "pass". Do not invent faults; each fault must be concrete and quote the words at fault."""

SCHEMA = {
    "type": "object", "additionalProperties": False,
    "required": ["verdict", "kind", "cases", "faults", "summary"],
    "properties": {
        "verdict": {"type": "string", "enum": ["pass", "fix"]},
        "kind": {"type": "string", "enum": ["one-method", "mixed"]},
        "cases": {"type": "array", "items": {"type": "object", "additionalProperties": False, "required": ["example", "case"],
                  "properties": {"example": {"type": "string"}, "case": {"type": "string"}}}},
        "faults": {"type": "array", "items": {"type": "object", "additionalProperties": False, "required": ["shot", "rule", "severity", "quote", "problem", "fix"],
                   "properties": {"shot": {"type": "integer"}, "rule": {"type": "string"}, "severity": {"type": "string", "enum": ["major", "minor"]}, "quote": {"type": "string"},
                                  "problem": {"type": "string"}, "fix": {"type": "string"}}}},
        "summary": {"type": "string"},
    },
}


def figures(path):
    d = json.load(open(path))
    out = []
    for si, s in enumerate(d["shots"]):
        g = s.get("figure")
        if not g:
            continue
        if g.get("example"):
            out.append(f"shot {si + 1}: the app's own figure for this problem type, animated")
            continue
        kinds, labels = {}, []
        for p in g.get("parts", []):
            k = next((x for x in ("grid", "counters", "circle", "poly", "seg", "dot", "label", "axes", "plot", "arc", "angle", "ray", "line", "text") if x in p), "other")
            kinds[k] = kinds.get(k, 0) + 1
            if k in ("label", "text"):
                labels.append(str(p.get("label") or p.get("text") or p.get("tex") or "")[:30])
        out.append(f"shot {si + 1}: parts {kinds}; labels {labels if labels else 'none'}")
    return "\n".join(out)


def judge(i, path):
    f = facts(i)
    title, text = script_text(path)
    text += "\n\n## The figures (parts and labels)\n" + figures(path)
    prompt = (STANDARD + f"\n\n# Lesson: {title} ({i}), grade {f.get('grade')}\n\n## What the app teaches\nGoal: {f.get('goal')}\n"
              f"Method: {json.dumps(f.get('method'))}\nCommon mistake: {f.get('watch')}\n\n## Variants the app generates\n"
              + "\n".join(f"- {v['prompt']} -> {v['answer']}" for v in f.get("variants", [])[:14])
              + f"\n\n## The screenplay (voice and board)\n{text}\n\nReply with the JSON verdict only.")
    with tempfile.TemporaryDirectory() as tmp:
        schema = os.path.join(tmp, "schema.json")
        out = os.path.join(tmp, "out.json")
        json.dump(SCHEMA, open(schema, "w"))
        p = subprocess.run(["codex", "exec", "-s", "read-only", "--skip-git-repo-check", "-c", "mcp_servers={}",
                            "--output-schema", schema, "-o", out, "-"], input=prompt, text=True, capture_output=True, cwd=tmp, timeout=1800)
        try:
            return json.load(open(out))
        except Exception:
            return {"verdict": "error", "summary": (p.stderr or p.stdout)[-600:]}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("ids", nargs="+", help="template id, or id=path/to/screenplay.json")
    ap.add_argument("--workers", type=int, default=4)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)

    def one(spec):
        i, _, path = spec.partition("=")
        res = judge(i, path or os.path.join(HERE, "lessons", f"{i}.json"))
        name = os.path.basename(path)[:-5] if path else i
        json.dump(res, open(os.path.join(a.out, f"{name}.json"), "w"), indent=1)
        return name, res

    with cf.ThreadPoolExecutor(a.workers) as ex:
        for name, r in ex.map(one, a.ids):
            rules = ",".join(sorted({x["rule"] + ("!" if x.get("severity") == "major" else "") for x in r.get("faults", [])}))
            print(f"{name}: {r.get('verdict')} | {r.get('kind', '')} | {rules} | {r.get('summary', '')[:150]}", flush=True)


if __name__ == "__main__":
    main()
