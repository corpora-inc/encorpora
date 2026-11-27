#!/usr/bin/env python3
"""Stand-in for headless `claude -p --output-format json` in tests.

With --json-schema it fills the schema for every "KEY Kn" block in the prompt:
correctness grades (score 2 unless the answer is empty or says it cannot
answer) or support verdicts (supported when the claim shares a word with the
cited text). Without a schema it returns a fixed prose answer.
"""
import json
import re
import sys


def main() -> int:
    args = sys.argv[1:]
    schema = json.loads(args[args.index("--json-schema") + 1]) if "--json-schema" in args else None
    model = args[args.index("--model") + 1] if "--model" in args else "stub"
    prompt = sys.stdin.read()
    if schema is None:
        out = {"result": "Keep 10 feet away, per 29 CFR 1926.1408(a)(2). I cannot answer the rest.",
               "modelUsage": {f"stub-{model}": {}}, "total_cost_usd": 0.0}
        print(json.dumps(out))
        return 0
    blocks = re.split(r"\n\s*---\s*\n", prompt)
    keys = [re.search(r"KEY (K\d+)", b).group(1) for b in blocks]
    props = schema["properties"]
    if "grades" in props:
        grades = []
        for k, b in zip(keys, blocks):
            ans = b.split("SYSTEM ANSWER:", 1)[1].strip().lower()
            declined = ans in ("", "(empty)") or "cannot answer" in ans
            must = "TYPE MUST-DECLINE" in b
            score = (2 if declined else 0) if must else (0 if declined else 2)
            if model == "sonnet" and not must and not declined:
                score = 1  # make the agreement check see a disagreement
            grades.append({"key": k, "declined": declined, "score": score, "why": "stub"})
        out = {"grades": grades}
    else:
        items = []
        for k, b in zip(keys, blocks):
            claims = re.findall(r"^(\d+)\. (.*)$", b.split("CITED TEXT:")[0], re.M)
            cited = b.split("CITED TEXT:", 1)[1].lower()
            ids = re.findall(r"\[([^\]]+)\]", b.split("CITED TEXT:", 1)[1])
            res = []
            for n, c in claims:
                words = set(re.findall(r"[a-z]{4,}", c.lower()))
                ok = any(w in cited for w in words) and ids
                res.append({"n": int(n), "verdict": "supported" if ok else "unsupported",
                            "section_id": ids[0] if ok else None})
            items.append({"key": k, "claims": res})
        out = {"items": items}
    print(json.dumps({"structured_output": out, "modelUsage": {f"stub-{model}": {}}, "total_cost_usd": 0.0}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
