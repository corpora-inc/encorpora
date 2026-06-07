#!/usr/bin/env python3
"""
judge.py — score every conversation in out/transcripts.jsonl on the NPC
dialogue-quality rubric and emit out/scores.jsonl (one row per conversation,
plus per-turn detail).

Two scoring layers:

1. PROGRAMMATIC (always on, no API, deterministic + reproducible). This is the
   rigorous core that quantifies the screenshot's two pathologies:
     - repetition_max / repetition_mean: pairwise similarity ACROSS the NPC's
       turns (hybrid token-Jaccard + char-3gram cosine + 1-edit_ratio). A
       verbatim segue repeat → ~1.0; re-explaining one word ("ferry" three ways)
       → high content-word overlap.
     - segue_repeat_rate: fraction of turns that re-emit a known segue/invite
       phrase ("¿me ayudas con…", "¿quieres jugar…", trailing invite clause).
     - fixation: max share of one content lemma across turns (the "ferry, ferry,
       ferry" tell).
     - brevity_ok: ≤2 sentences per turn.
     - target_lang_ok: spoken prose is in the target language (es), no unwanted
       native (en) leakage beyond an allowed parenthetical gloss.
     - leaked_think / leaked_tool: control text bleeding into spoken prose.
     - lexical_diversity: distinct content words / total across the convo
       (creativity proxy).
     - coherence_floor: not empty / not degenerate.
   Combined DELIGHT score is maximized at the creativity×cohesion balance:
     delight = w_cohesion*cohesion + w_creativity*creativity
               - p_repeat*repetition - p_nonsense*incoherence - penalties
   so BOTH repetition and nonsense are punished → a sweet spot, not an extreme.

2. OPTIONAL STRONG-LLM JUDGE (--llm-judge openai|anthropic, key auto-detected).
   Adds rubric scores (cohesion/creativity/in_character/coherence/non_repetition,
   1-5) per conversation, for triangulation. Skipped cleanly when no key.

The programmatic layer alone is enough to find the winning prompt construction;
the LLM judge is corroboration.
"""
import argparse
import json
import math
import os
import re
import sys
from collections import Counter
from pathlib import Path

# ----------------------------------------------------------- text utilities ----

GLOSS_RE = re.compile(r"\([^)]*\)")           # parenthetical gloss (allowed native)
PUNCT_RE = re.compile(r"[^\wáéíóúñü¿¡\s]", re.UNICODE)
WS_RE = re.compile(r"\s+")

# Common Spanish function words (don't count toward content overlap/diversity).
ES_STOP = set("""el la los las un una unos unas de del a al y o u que se es son está
están con por para en lo le les me te nos su sus mi tu como más muy ya no sí sin
hoy aquí ahí esto eso esta este ese aquel qué cómo cuál cuándo dónde quién bien
tan tu te ti yo él ella ello nosotros ustedes vos hay he has ha hemos han voy vas
va vamos van ser estar tener hacer si pero porque cuando donde quien cual cuanto""".split())

# English function/marker words used to detect unwanted native leakage.
EN_MARKERS = set("""the a an of to and or is are was were you i we they he she it this
that these those with for from have has do does did will would can could should
what when where why how which who hello hi thanks thank please yes no okay ok""".split())

# Known invite/segue tails (target-language). A turn matching one of these is
# emitting a play-invite; repeating it across turns is pathology #1.
SEGUE_PATTERNS = [
    re.compile(r"¿\s*me ayudas con", re.I),
    re.compile(r"¿\s*quieres (jugar|intentarlo|repetir|probar)", re.I),
    re.compile(r"¿\s*jugamos", re.I),
    re.compile(r"¿\s*me lo lees", re.I),
    re.compile(r"¿\s*adivinas", re.I),
    re.compile(r"ordénala conmigo", re.I),
    re.compile(r"¿\s*te gustaría (jugar|repetir|intentar)", re.I),
]


def strip_for_text(s: str) -> str:
    s = GLOSS_RE.sub(" ", s)          # remove allowed parenthetical glosses
    s = PUNCT_RE.sub(" ", s.lower())
    return WS_RE.sub(" ", s).strip()


def tokens(s: str):
    return [t for t in strip_for_text(s).split() if t]


def content_tokens(s: str):
    return [t for t in tokens(s) if t not in ES_STOP and len(t) > 2]


def char_ngrams(s: str, n=3):
    s = strip_for_text(s).replace(" ", "")
    return Counter(s[i:i + n] for i in range(max(0, len(s) - n + 1)))


def cosine(c1: Counter, c2: Counter) -> float:
    if not c1 or not c2:
        return 0.0
    keys = set(c1) | set(c2)
    dot = sum(c1[k] * c2[k] for k in keys)
    n1 = math.sqrt(sum(v * v for v in c1.values()))
    n2 = math.sqrt(sum(v * v for v in c2.values()))
    return dot / (n1 * n2) if n1 and n2 else 0.0


def jaccard(a, b) -> float:
    sa, sb = set(a), set(b)
    if not sa and not sb:
        return 1.0
    if not sa or not sb:
        return 0.0
    return len(sa & sb) / len(sa | sb)


def edit_ratio(a: str, b: str) -> float:
    """1 - normalized Levenshtein (similarity). O(len^2); strings are short."""
    a, b = strip_for_text(a), strip_for_text(b)
    if not a and not b:
        return 1.0
    la, lb = len(a), len(b)
    if la == 0 or lb == 0:
        return 0.0
    prev = list(range(lb + 1))
    for i in range(1, la + 1):
        cur = [i] + [0] * lb
        for j in range(1, lb + 1):
            cost = 0 if a[i - 1] == b[j - 1] else 1
            cur[j] = min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
        prev = cur
    dist = prev[lb]
    return 1.0 - dist / max(la, lb)


def pair_similarity(a: str, b: str) -> float:
    """Hybrid similarity in [0,1]: catches verbatim repeats (edit≈1) AND
    paraphrase/fixation (high content jaccard + char-cosine)."""
    j = jaccard(content_tokens(a), content_tokens(b))
    c = cosine(char_ngrams(a), char_ngrams(b))
    e = edit_ratio(a, b)
    # Max-ish blend: a verbatim repeat lights up edit; a re-explanation lights up
    # jaccard/cosine. Weight toward the strongest signal.
    return max(e, 0.6 * j + 0.4 * c, 0.5 * (j + c))


# ----------------------------------------------------------------- metrics -----

def sentence_count(s: str) -> int:
    s = GLOSS_RE.sub("", s).strip()
    if not s:
        return 0
    parts = re.split(r"[.!?。！？…\n]+", s)
    return len([p for p in parts if p.strip()])


def native_leak_ratio(s: str) -> float:
    """Fraction of EN marker words in the prose OUTSIDE parenthetical glosses."""
    bare = GLOSS_RE.sub(" ", s)
    toks = tokens(bare)
    if not toks:
        return 0.0
    en = sum(1 for t in toks if t in EN_MARKERS)
    return en / len(toks)


def is_segue(s: str) -> bool:
    return any(p.search(s) for p in SEGUE_PATTERNS)


def degenerate(s: str) -> bool:
    t = strip_for_text(s)
    if len(t) < 2:
        return True
    toks = t.split()
    if toks and len(set(toks)) == 1 and len(toks) > 2:
        return True   # "ferry ferry ferry"
    return False


def conversation_metrics(npc_lines):
    """Programmatic metrics over the NPC's spoken turns (greeting + replies)."""
    lines = [ln for ln in npc_lines if ln is not None]
    n = len(lines)
    # Pairwise across-turn similarity (consecutive AND all-pairs).
    consec = []
    allpairs = []
    for i in range(n):
        for k in range(i + 1, n):
            sim = pair_similarity(lines[i], lines[k])
            allpairs.append(sim)
            if k == i + 1:
                consec.append(sim)
    rep_max = max(allpairs) if allpairs else 0.0
    rep_mean = sum(allpairs) / len(allpairs) if allpairs else 0.0
    rep_consec_mean = sum(consec) / len(consec) if consec else 0.0

    # Verbatim-repeat rate: any line that exactly matches an earlier line.
    seen = set()
    exact_repeats = 0
    for ln in lines:
        key = strip_for_text(ln)
        if key in seen and key:
            exact_repeats += 1
        seen.add(key)
    exact_repeat_rate = exact_repeats / n if n else 0.0

    # Segue-repeat: how many turns emit an invite; >1 across the convo is the bug.
    segue_turns = sum(1 for ln in lines if is_segue(ln))
    segue_repeat = max(0, segue_turns - 1)  # one invite is fine; extras are the bug
    segue_repeat_rate = segue_repeat / n if n else 0.0

    # Fixation: max share of any single content lemma across all turns.
    all_content = []
    for ln in lines:
        all_content.extend(content_tokens(ln))
    fixation = 0.0
    if all_content:
        c = Counter(all_content)
        fixation = c.most_common(1)[0][1] / len(all_content)

    # Lexical diversity (creativity proxy): distinct content words / total.
    diversity = (len(set(all_content)) / len(all_content)) if all_content else 0.0

    # Brevity: fraction of turns ≤2 sentences.
    brevity_ok = sum(1 for ln in lines if sentence_count(ln) <= 2) / n if n else 0.0

    # Language correctness: fraction of turns with low native leakage.
    leak = [native_leak_ratio(ln) for ln in lines]
    lang_ok = sum(1 for x in leak if x <= 0.15) / n if n else 0.0
    native_leak_mean = sum(leak) / len(leak) if leak else 0.0

    # Coherence floor: non-degenerate, non-empty.
    nondegen = sum(1 for ln in lines if not degenerate(ln)) / n if n else 0.0
    empty = sum(1 for ln in lines if not ln.strip()) / n if n else 0.0

    return {
        "n_turns": n,
        "rep_max": rep_max,
        "rep_mean": rep_mean,
        "rep_consec_mean": rep_consec_mean,
        "exact_repeat_rate": exact_repeat_rate,
        "segue_turns": segue_turns,
        "segue_repeat_rate": segue_repeat_rate,
        "fixation": fixation,
        "diversity": diversity,
        "brevity_ok": brevity_ok,
        "lang_ok": lang_ok,
        "native_leak_mean": native_leak_mean,
        "nondegen": nondegen,
        "empty_rate": empty,
    }


# ------------------------------------------------------------- delight model ---

# Weights chosen so Delight peaks at the creativity×cohesion balance. Repetition
# AND incoherence are BOTH penalized, so neither "boring/deterministic" nor
# "nonsense" wins. Documented in NPC_PROMPT_STUDY.md.
W = {
    "cohesion": 0.30,      # on-topic, advances, in-frame (proxied below)
    "creativity": 0.25,    # diversity + non-formulaic
    "p_repeat": 0.55,      # strong penalty on across-turn repetition
    "p_segue": 0.35,       # penalty on segue re-emission
    "p_fixation": 0.30,    # penalty on single-word fixation
    "p_incoherent": 0.50,  # penalty on degeneracy/emptiness (nonsense guard)
    "p_lang": 0.25,        # penalty on native leakage
    "p_brevity": 0.10,     # mild penalty on >2 sentences
}


def delight(m):
    # Cohesion proxy: stays brief, in-language, non-degenerate, and DOESN'T just
    # repeat (advancing). We fold a mild "progression" term = 1 - rep_consec_mean.
    cohesion = (
        0.4 * m["brevity_ok"]
        + 0.3 * m["lang_ok"]
        + 0.3 * (1.0 - m["rep_consec_mean"])
    )
    creativity = 0.6 * m["diversity"] + 0.4 * (1.0 - m["fixation"])
    incoherence = 0.5 * (1.0 - m["nondegen"]) + 0.5 * m["empty_rate"]

    score = (
        W["cohesion"] * cohesion
        + W["creativity"] * creativity
        - W["p_repeat"] * m["rep_mean"]
        - W["p_segue"] * m["segue_repeat_rate"]
        - W["p_fixation"] * max(0.0, m["fixation"] - 0.15)  # tolerance band
        - W["p_incoherent"] * incoherence
        - W["p_lang"] * m["native_leak_mean"]
        - W["p_brevity"] * (1.0 - m["brevity_ok"])
    )
    return {
        "cohesion": round(cohesion, 4),
        "creativity": round(creativity, 4),
        "incoherence": round(incoherence, 4),
        "delight": round(score, 4),
    }


# --------------------------------------------------------- optional LLM judge --

LLM_RUBRIC = """You are scoring a single NPC's lines from a language-learning RPG.
The NPC (a townsperson) is teaching Spanish to an English speaker. Good dialogue
is COHESIVE (on-topic, in-world, and it ADVANCES — each turn adds something) AND
CREATIVE (varied, characterful, not formulaic), while staying brief (<=2
sentences), in Spanish, in character, and coherent (not nonsense). The WORST
failure is repeating the same line/idea every turn.

Here are the NPC's turns in order:
{turns}

Score 1-5 (5=best) as strict JSON, no prose:
{{"cohesion":N,"creativity":N,"in_character":N,"coherence":N,"non_repetition":N,"brevity":N,"target_language":N,"one_line_reason":"..."}}"""


def detect_llm_key(provider):
    if provider == "openai":
        return os.environ.get("OPENAI_API_KEY")
    if provider == "anthropic":
        return os.environ.get("ANTHROPIC_API_KEY")
    return None


def llm_judge(provider, key, npc_lines, model=None):
    import requests
    turns = "\n".join(f"{i+1}. {ln}" for i, ln in enumerate(npc_lines))
    prompt = LLM_RUBRIC.format(turns=turns)
    try:
        if provider == "openai":
            model = model or os.environ.get("WP_JUDGE_MODEL", "gpt-4o")
            r = requests.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {key}"},
                json={"model": model, "temperature": 0,
                      "messages": [{"role": "user", "content": prompt}]},
                timeout=60)
            r.raise_for_status()
            txt = r.json()["choices"][0]["message"]["content"]
        else:  # anthropic
            model = model or os.environ.get("WP_JUDGE_MODEL", "claude-3-5-sonnet-latest")
            r = requests.post(
                "https://api.anthropic.com/v1/messages",
                headers={"x-api-key": key, "anthropic-version": "2023-06-01"},
                json={"model": model, "max_tokens": 300, "temperature": 0,
                      "messages": [{"role": "user", "content": prompt}]},
                timeout=60)
            r.raise_for_status()
            txt = r.json()["content"][0]["text"]
        m = re.search(r"\{.*\}", txt, re.DOTALL)
        return json.loads(m.group(0)) if m else None
    except Exception as e:
        print(f"[judge] LLM judge failed: {e}", file=sys.stderr)
        return None


# ------------------------------------------------------------------- main ------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--transcripts", default="out/transcripts.jsonl")
    ap.add_argument("--out", default="out/scores.jsonl")
    ap.add_argument("--llm-judge", choices=["openai", "anthropic", "none"], default="none")
    ap.add_argument("--llm-sample", type=int, default=0,
                    help="if >0, only LLM-judge this many conversations (cost cap)")
    args = ap.parse_args()

    key = None
    if args.llm_judge != "none":
        key = detect_llm_key(args.llm_judge)
        if not key:
            print(f"[judge] no API key for {args.llm_judge}; running programmatic "
                  "layer only (clearly labeled).", file=sys.stderr)

    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    rows = 0
    llm_done = 0
    with open(args.transcripts) as fin, open(args.out, "w") as fout:
        for line in fin:
            tr = json.loads(line)
            npc_lines = tr["npcLines"]
            m = conversation_metrics(npc_lines)
            d = delight(m)
            out = {
                "cellId": tr["cellId"],
                "variantId": tr["variantId"],
                "_group": tr.get("_group", tr.get("variantId")),
                "ctx": tr["ctx"],
                "personaSeed": tr["personaSeed"],
                "archetype": tr["archetype"],
                "demeanor": tr["demeanor"],
                "scriptId": tr["scriptId"],
                "temperature": tr["temperature"],
                "rep": tr.get("rep", 0),
                "metrics": m,
                "scores": d,
            }
            if key and (args.llm_sample == 0 or llm_done < args.llm_sample):
                j = llm_judge(args.llm_judge, key, npc_lines)
                if j:
                    out["llm"] = j
                    llm_done += 1
            fout.write(json.dumps(out, ensure_ascii=False) + "\n")
            rows += 1
    print(f"[judge] scored {rows} conversations → {args.out}"
          + (f" (LLM-judged {llm_done})" if key else " (programmatic only)"),
          file=sys.stderr)


if __name__ == "__main__":
    main()
