#!/usr/bin/env python3
"""
run_model.py — drive the SHIPPED Qwen3-4B GGUF through multi-turn NPC
conversations for every cell in out/cells.json, reproducing the on-device
inference path as closely as possible, and write out/transcripts.jsonl.

Faithful-to-device choices (verified against
plugins/tauri-plugin-corpan-llm/src/state.rs):
  - Prompt = hand-built ChatML (format_chatml): <|im_start|>{role}\n{content}<|im_end|>\n
    then <|im_start|>assistant\n . AddBos always (llama-server adds BOS).
  - Sampler chain: penalties(last_n=64, repeat_penalty, 0, 0) → top_k(40)
    → top_p(0.9, min_keep=1) → temp → dist(seed). We pass the matching knobs to
    /completion (repeat_last_n=64, top_k=40, top_p, temp, repeat_penalty).
  - History window: runtime replays last HISTORY_WINDOW*2 = 16 messages after the
    system message. We mirror that.
  - The runtime sends temperature 0.6 / topP 0.9 / repeatPenalty 1.15 / maxTokens
    400 by default; our matrix sweeps temperature and we keep the rest.
  - Streaming splits a <<tool>...</tool>> control block off the spoken prose
    (splitToolBlock). We strip it the same way, and ALSO strip Qwen <think> blocks
    (the plugin streams them; the pack renders them — but for dialogue-quality
    scoring we score the SPOKEN prose, and separately flag leaked think/tool text).

Run:
  .venv/bin/python run_model.py --server http://127.0.0.1:8099 \
      --cells out/cells.json --out out/transcripts.jsonl \
      --reps 3 --max-cells-per-variant 18
"""
import argparse
import json
import re
import sys
import time
from pathlib import Path

import requests

TOOL_OPEN = "<<tool>"
TOOL_CLOSE = "</tool>>"
HISTORY_WINDOW = 8  # runtime HISTORY_WINDOW; *2 messages replayed
MAX_TOKENS = 400


def format_chatml(messages):
    """Exactly the plugin's format_chatml."""
    s = []
    for m in messages:
        s.append("<|im_start|>")
        s.append(m["role"])
        s.append("\n")
        s.append(m["content"])
        s.append("<|im_end|>\n")
    s.append("<|im_start|>assistant\n")
    return "".join(s)


THINK_RE = re.compile(r"<think>.*?</think>", re.DOTALL)


def split_tool_block(accumulated: str):
    """Port of splitToolBlock: prose (block removed) + raw tool JSON if present."""
    open_i = accumulated.find(TOOL_OPEN)
    if open_i == -1:
        return accumulated, None, False
    prose = accumulated[:open_i]
    after = accumulated[open_i + len(TOOL_OPEN):]
    close_i = after.find(TOOL_CLOSE)
    if close_i == -1:
        return prose, None, True
    raw = after[:close_i].strip()
    return prose, raw, True


def clean_prose(full: str):
    """Return (spoken_prose, leaked_think_bool, raw_tool_or_None)."""
    leaked_think = "<think>" in full
    # Strip think blocks (closed). An unclosed <think> means the whole thing is
    # reasoning that never resolved → spoken prose is whatever follows, if any.
    no_think = THINK_RE.sub("", full)
    if "<think>" in no_think:
        # unclosed think: take text after the last </think> if any, else after <think>
        idx = no_think.rfind("<think>")
        no_think = no_think[:idx]
    prose, raw_tool, _ = split_tool_block(no_think)
    return prose.strip(), leaked_think, raw_tool


def turn_messages(system_prompt, history, history_window=HISTORY_WINDOW):
    msgs = [{"role": "system", "content": system_prompt}]
    msgs.extend(history[-history_window * 2:])
    return msgs


def anti_repeat_reminder(npc_lines, last_n, target_name="Spanish"):
    """Build the anti-repetition context the runner injects per the variant policy.
    Quotes the NPC's last N lines and tells it to move on. Kept short + in-frame.

    TARGET-LANGUAGE (Spanish), matching what the runtime now SHIPS
    (RuntimeStrings.antiRepeat) after the NPC-prompt-craft pass — the reminder is
    in the target language so it reads in-frame to the model and never tempts an
    English reply."""
    recent = [ln for ln in npc_lines if ln][-last_n:]
    if not recent:
        return None
    quoted = " / ".join(f'"{ln}"' for ln in recent)
    return (
        f"(Ya dijiste: {quoted}. No te repitas — di algo NUEVO y avanza la "
        f"conversación.)"
    )


def segue_strip(system_prompt):
    """Remove the challenge-segue instruction line from the system prompt. Mirrors
    the shipped 'segue-once' fix (R1) where the invite leaves the system prompt
    after turn 0. Matches the current TEACHER-FRAMED wording ("You can offer the
    traveler a little \"X\" game …") AND the legacy wording ("A little \"X\" game …")
    so the harness stays correct across the prompt-craft reframe."""
    lines = system_prompt.split("\n")
    kept = [
        ln for ln in lines
        if not ln.startswith("A little \"")
        and not ln.startswith("You can offer the traveler a little \"")
    ]
    return "\n".join(kept)


def run_completion(server, prompt, temperature, seed, n_predict=MAX_TOKENS, timeout=180):
    body = {
        "prompt": prompt,
        "n_predict": n_predict,
        "temperature": temperature,
        "top_p": 0.9,
        "top_k": 40,
        "repeat_penalty": 1.15,
        "repeat_last_n": 64,
        "seed": seed,
        "cache_prompt": True,
        "stop": [TOOL_CLOSE, "<|im_end|>", "<|im_start|>"],
    }
    r = requests.post(f"{server}/completion", json=body, timeout=timeout)
    r.raise_for_status()
    d = r.json()
    content = d.get("content", "")
    stop_word = d.get("stopping_word", "")
    # If we stopped on the tool closer, re-append it so the splitter sees a block.
    if stop_word == TOOL_CLOSE:
        content = content + TOOL_CLOSE
    return content


def run_conversation(server, cell, rep, seed):
    """Run one multi-turn conversation for a cell. Returns a transcript dict."""
    sys_prompt = cell["systemPrompt"]
    policy = cell.get("policy", {})
    temp = policy.get("temperature", cell["temperature"])
    script = cell["scriptLines"]

    # The runtime's kickoff greeting (empty-history greet), then the player lines.
    greet_user = (
        "A traveler walks up to your station. Greet them warmly in Spanish and "
        "invite them to talk."
    )

    history = []
    npc_lines = []
    turns = []

    # System prompt may be modified per turn (segue-once drops the segue after t0).
    def system_for_turn(turn_idx):
        sp = sys_prompt
        if policy.get("segueOnce") and turn_idx > 0:
            sp = segue_strip(sp)
        return sp

    # Turn 0 = the greeting.
    all_user_turns = [greet_user] + script

    for ti, user_line in enumerate(all_user_turns):
        # anti-repeat injection: prepend a reminder to THIS user message.
        eff_user = user_line
        last_n = policy.get("antiRepeatLastN", 0)
        if last_n and ti > 0:
            rem = anti_repeat_reminder(npc_lines, last_n)
            if rem:
                eff_user = rem + "\n" + user_line

        history.append({"role": "user", "content": eff_user})
        msgs = turn_messages(system_for_turn(ti), history)
        prompt = format_chatml(msgs)
        # Per-turn seed: stable but varied across turns/reps so we sample the
        # distribution rather than one fixed draw.
        turn_seed = (seed * 1000003 + ti * 97 + rep * 7) & 0x7FFFFFFF
        t0 = time.time()
        try:
            raw = run_completion(server, prompt, temp, turn_seed)
        except Exception as e:
            print(f"[run] completion failed cell={cell['cellId']} turn={ti}: {e}",
                  file=sys.stderr)
            raw = ""
        elapsed = time.time() - t0
        prose, leaked_think, raw_tool = clean_prose(raw)
        # Record the assistant turn in history as the runtime does: the SPOKEN
        # prose only (think/tool stripped).
        history.append({"role": "assistant", "content": prose})
        if ti > 0:  # turn 0 is the greeting; player turns are 1..N
            npc_lines.append(prose)
        else:
            npc_lines.append(prose)  # include greeting in repetition baseline
        turns.append({
            "turnIndex": ti,
            "isGreeting": ti == 0,
            "userLine": user_line,
            "effectiveUserLine": eff_user,
            "raw": raw,
            "prose": prose,
            "leakedThink": leaked_think,
            "rawTool": raw_tool,
            "elapsedMs": round(elapsed * 1000),
        })

    return {
        "cellId": cell["cellId"],
        "variantId": cell["variantId"],
        "ctx": cell["ctx"],
        "personaSeed": cell["personaSeed"],
        "archetype": cell["archetype"],
        "demeanor": cell["demeanor"],
        "scriptId": cell["scriptId"],
        "temperature": temp,
        "rep": rep,
        "mood": cell["mood"],
        "npcLines": npc_lines,
        "turns": turns,
    }


def run_repeat_visits(server, cell, seed):
    """Run the SAME persona+script across 3 simulated repeat-visits with the
    rotating mood (selectMood(id, visit)), to measure cross-visit repetition —
    the 'same NPC feels identical every time you talk to them' pathology."""
    visits = []
    for v, mood in enumerate(cell["visitMoods"]):
        # Rebuild the system prompt with the visit's mood by string-swapping the
        # mood line (cheap + faithful: only the mood clause changes per visit).
        sp = cell["systemPrompt"]
        sp = re.sub(r"Right now you are [^\n]+", f"Right now you are {mood}.", sp, count=1)
        sub_cell = dict(cell)
        sub_cell["systemPrompt"] = sp
        sub_cell["mood"] = mood
        tr = run_conversation(server, sub_cell, rep=0, seed=seed + v * 131)
        tr["visit"] = v
        visits.append(tr)
    return visits


def select_cells(cells, max_per_variant):
    """Pick a balanced subset per variant, EVENLY stratified across temperature ×
    ctx (the two axes we report on), so every (variant,temp) and (variant,ctx)
    cell is represented. Within a (variant,temp,ctx) stratum we round-robin
    personas/scripts. This avoids the aliasing bug where a flat stride lands on a
    single temperature."""
    from collections import defaultdict
    by_variant = defaultdict(lambda: defaultdict(list))
    temps, ctxs = set(), set()
    for c in cells:
        by_variant[c["variantId"]][(c["temperature"], c["ctx"])].append(c)
        temps.add(c["temperature"]); ctxs.add(c["ctx"])
    out = []
    for vid, strata in by_variant.items():
        if max_per_variant <= 0:
            for lst in strata.values():
                out.extend(lst)
            continue
        n_strata = len(strata)
        per_stratum = max(1, max_per_variant // n_strata)
        for key, lst in strata.items():
            if len(lst) <= per_stratum:
                out.extend(lst)
            else:
                stride = max(1, len(lst) // per_stratum)
                out.extend(lst[::stride][:per_stratum])
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--server", default="http://127.0.0.1:8099")
    ap.add_argument("--cells", default="out/cells.json")
    ap.add_argument("--out", default="out/transcripts.jsonl")
    ap.add_argument("--reps", type=int, default=3,
                    help="independent conversation reps per cell (different seeds)")
    ap.add_argument("--max-cells-per-variant", type=int, default=18)
    ap.add_argument("--repeat-visits", action="store_true",
                    help="also run the 3-visit cross-visit study for a sample")
    ap.add_argument("--repeat-visit-out", default="out/repeat_visits.jsonl")
    ap.add_argument("--limit", type=int, default=0, help="hard cap on cells (debug)")
    ap.add_argument("--workers", type=int, default=1,
                    help="concurrent conversations (match llama-server --parallel)")
    args = ap.parse_args()

    manifest = json.load(open(args.cells))
    cells = manifest["cells"]
    sel = select_cells(cells, args.max_cells_per_variant)
    if args.limit:
        sel = sel[: args.limit]

    # Build the full (cell, rep, seed) job list.
    jobs = []
    for cell in sel:
        for rep in range(args.reps):
            seed = (hash(cell["cellId"]) & 0xFFFF) * 31 + rep + 1
            jobs.append((cell, rep, seed))

    total = len(jobs)
    print(f"[run] {len(sel)} cells × {args.reps} reps = {total} conversations "
          f"({len(cells)} cells total in matrix), workers={args.workers}",
          file=sys.stderr)

    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    done = 0
    import threading
    lock = threading.Lock()

    def work(job):
        cell, rep, seed = job
        return run_conversation(args.server, cell, rep, seed)

    with open(args.out, "w") as f:
        if args.workers <= 1:
            for job in jobs:
                tr = work(job)
                f.write(json.dumps(tr, ensure_ascii=False) + "\n")
                f.flush()
                done += 1
                if done % 10 == 0:
                    print(f"[run] {done}/{total} conversations", file=sys.stderr)
        else:
            from concurrent.futures import ThreadPoolExecutor, as_completed
            with ThreadPoolExecutor(max_workers=args.workers) as ex:
                futs = [ex.submit(work, j) for j in jobs]
                for fut in as_completed(futs):
                    tr = fut.result()
                    with lock:
                        f.write(json.dumps(tr, ensure_ascii=False) + "\n")
                        f.flush()
                        done += 1
                        if done % 10 == 0:
                            print(f"[run] {done}/{total} conversations", file=sys.stderr)

    print(f"[run] wrote {done} conversations → {args.out}", file=sys.stderr)

    if args.repeat_visits:
        # Run the cross-visit study on the baseline + the leading fix variants,
        # one persona/script each, to quantify the 'identical across visits' issue.
        rv_variants = {"baseline", "segue-once+anti-repeat", "mood-strong"}
        rv_cells = [c for c in cells
                    if c["variantId"] in rv_variants
                    and c["ctx"] == "generic-challenge"
                    and c["scriptId"] == "probe-loop"
                    and abs(c["temperature"] - 0.6) < 1e-6]
        print(f"[run] repeat-visit study: {len(rv_cells)} cells", file=sys.stderr)
        with open(args.repeat_visit_out, "w") as f:
            for cell in rv_cells:
                seed = (hash(cell["cellId"]) & 0xFFFF) * 17 + 3
                visits = run_repeat_visits(args.server, cell, seed)
                f.write(json.dumps({
                    "cellId": cell["cellId"],
                    "variantId": cell["variantId"],
                    "personaSeed": cell["personaSeed"],
                    "visits": visits,
                }, ensure_ascii=False) + "\n")
                f.flush()
        print(f"[run] wrote repeat-visit study → {args.repeat_visit_out}", file=sys.stderr)


if __name__ == "__main__":
    main()
