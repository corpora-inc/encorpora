#!/usr/bin/env python3
"""
An optional reviewer for lesson film screenplays using a configured vision model.
It reads the storyboard with the script and problem facts against AUTHORING.md.

    python3 -I film/critic.py <out-dir> <template-id> [...]
        frames from lesson-films/<id>/board/ (made by make.ts --dry --board)
    python3 -I film/critic.py <out-dir> --frames-root <dir> --lessons <dir> <id> [...]

Writes <out-dir>/<id>.json and prints one line per lesson.
"""
import argparse, base64, concurrent.futures as cf, json, os, re, subprocess, sys, urllib.request

URL = os.environ.get("FILM_CRITIC_URL", "")
MODEL = os.environ.get("FILM_CRITIC_MODEL", "")
HERE = os.path.dirname(os.path.abspath(__file__))
FILMS = os.environ.get("FILM_OUT", os.path.expanduser("~/.local/share/amp-film/films"))

STANDARD = """You review short math lesson films for AMP, a premium math app for learners from counting to precalculus.
Review mathematical truth, learner understanding and visual clarity:

1. Every example is a different case. Two examples whose answers or methods are the same kind (two negative answers, two "more than ten ones", two bags of counters with nothing new, two subtractions that both need one regroup) are ONE case shown twice: that is a fault, name both examples. Cases that genuinely differ are good: a zero, a sum past one, a special trap, a harder form, a different strategy.
2. Concise and complete: nothing said twice; every kind of problem the app generates is worked once, each on its own screen. One problem per screen: an answer to another problem added at the end of an example is a fault.
3. Show the way to see it first, then the method that always works. A shortcut that only works sometimes is a fault.
4. A picture only when it shows why, and every part of it readable without the voice (labels on bars, rows and colors). Unlabeled bars for place values are a fault. Column arithmetic needs no picture: the stacked numbers are the picture.
5. Pictures fill their card and read on a phone: nothing tiny, no label touching another label, a line, or an axis number; no clutter such as an axis nobody needs.
6. Strike-outs: only the one mistake the lesson warns about, on the line it corrects or inside the warning card. Crossing out answer choices one by one is a fault. A struck number floating alone under the answer is a fault. In grades K to 2 there should be no strike-outs at all.
7. The board shows exactly what the voice says, every step, and the math is right. Recompute it.
8. It ends with an overview and numbered recap steps.

Frames: each image is the screen as one spoken beat ends. The figure card is on the left (or top), the whiteboard on the right. A frame where the figure card is briefly faded or empty right at a shot change is normal; ignore it.

Reply with JSON only:
{"verdict": "pass" | "fix",
 "cases": [{"example": str, "case": str}],
 "repeats": [str],
 "issues": [{"frame": int | null, "kind": "repeat" | "picture" | "strike" | "label" | "math" | "coverage" | "wording" | "other", "problem": str, "fix": str}],
 "summary": str}
"pass" means the lesson is ready for an independent watch-through: no repeats, no faults in 1 to 8. List only real faults, each concrete; do not pad. Small polish with no fault is not a reason to say "fix"."""


def facts(i):
    cache = os.path.join(FILMS, "_critic", "facts", f"{i}.json")
    if os.path.exists(cache):
        return json.load(open(cache))
    out = subprocess.check_output(["npx", "tsx", "film/facts.ts", i], cwd=os.path.dirname(HERE), stderr=subprocess.DEVNULL)
    d = json.loads(out)
    os.makedirs(os.path.dirname(cache), exist_ok=True)
    json.dump(d, open(cache, "w"))
    return d


def script_text(path):
    d = json.load(open(path))
    lines = []
    named = {}
    for si, s in enumerate(d["shots"]):
        lines.append(f"-- shot {si + 1}" + (" (with a figure)" if s.get("figure") else " (board only)"))
        for b in s["beats"]:
            lines.append(f"  SAYS: {b['say']}")
            for a in b.get("do", []):
                if a["do"] == "stack":
                    lines.append(f"     board stack ({a['op']}): " + " over ".join(a["rows"]) + ", worked one column at a time from the right")
                if a["do"] in ("write", "answer", "problem", "term", "watch", "text", "recap"):
                    body = a.get("tex") or a.get("text") or a.get("word")
                    lines.append(f"     board {a['do']}: {body}" + (f"   [margin: {a['note']}]" if a.get("note") else ""))
                    if a.get("id"):
                        named[a["id"]] = body
                if a["do"] == "header":
                    lines.append("     board header off" if a.get("off") else f"     board header (pinned at the top of the board until replaced, removed or the shot ends): " + (f"{a['label']}: " if a.get("label") else "") + str(a.get("tex") or a.get("text")))
                if a["do"] == "strike":
                    lines.append(f"     board strike: the line \"{named.get(a['target'], a['target'])}\" is struck out")
    return d.get("title", ""), "\n".join(lines)


def review(i, frames_dir, lesson_path, n_frames=None):
    if not URL or not MODEL:
        raise ValueError("Set FILM_CRITIC_URL and FILM_CRITIC_MODEL before reviewing")
    f = facts(i)
    title, text = script_text(lesson_path)
    names = sorted(x for x in os.listdir(frames_dir) if x.endswith(".jpg"))
    if n_frames:
        names = names[:n_frames]
    content = [{"type": "text", "text":
        f"# Lesson: {title} ({i}), grade {f.get('grade')}\n\n## What the app teaches\nGoal: {f.get('goal')}\nMethod: {json.dumps(f.get('method'))}\nCommon mistake: {f.get('watch')}\n\n## Variants the app generates\n"
        + "\n".join(f"- {v['prompt']} -> {v['answer']}" for v in f.get("variants", [])[:12])
        + f"\n\n## The screenplay (voice and board)\n{text}\n\n## The storyboard, frame by frame"}]
    for k, name in enumerate(names):
        b64 = base64.b64encode(open(os.path.join(frames_dir, name), "rb").read()).decode()
        content.append({"type": "text", "text": f"Frame {k}"})
        content.append({"type": "image_url", "image_url": {"url": "data:image/jpeg;base64," + b64}})
    body = {"model": MODEL, "temperature": 0.2, "max_tokens": 12000, "chat_template_kwargs": {"enable_thinking": False},
            "messages": [{"role": "system", "content": STANDARD}, {"role": "user", "content": content}]}
    req = urllib.request.Request(URL, json.dumps(body).encode(), {"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=1200) as r:
        txt = json.load(r)["choices"][0]["message"]["content"] or ""
    txt = re.sub(r"<think>.*?</think>", "", txt, flags=re.S)
    m = re.search(r"\{.*\}", txt, re.S)
    try:
        return json.loads(m.group(0)) if m else {"verdict": "error", "raw": txt[:3000]}
    except Exception:
        return {"verdict": "error", "raw": txt[:3000]}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("ids", nargs="+")
    ap.add_argument("--frames-root", help="dir holding <id>/frames or <id>/board")
    ap.add_argument("--lessons", default=os.path.join(HERE, "lessons"))
    ap.add_argument("--workers", type=int, default=3)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)

    def one(i):
        root = a.frames_root or FILMS
        d = next((os.path.join(root, i, s) for s in ("frames", "board") if os.path.isdir(os.path.join(root, i, s))), None)
        if not d:
            return i, {"verdict": "error", "raw": "no frames; run make.ts --dry --board"}
        n = None
        log = os.path.join(root, f"{i}.log")
        if os.path.exists(log):
            m = re.search(r"\((\d+) beats", open(log).read())
            n = int(m.group(1)) if m else None
        res = review(i, d, os.path.join(a.lessons, f"{i}.json"), n)
        json.dump(res, open(os.path.join(a.out, f"{i}.json"), "w"), indent=1)
        return i, res

    with cf.ThreadPoolExecutor(a.workers) as ex:
        for i, r in ex.map(one, a.ids):
            print(f"{i}: {r.get('verdict')} | repeats {len(r.get('repeats', []))} | issues {len(r.get('issues', []))} | {r.get('summary', r.get('raw', ''))[:160]}")


if __name__ == "__main__":
    main()
