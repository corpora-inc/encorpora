"""Score whisper.cpp models on the spoken crane test set.

    python3 -I run-eval.py --cli WHISPER_CLI --models DIR --audio DIR --out results.json \
        [--model ggml-base.en.bin ...] [--conditions clean snr10 snr5] [--latency-clips 24]

Decoding matches tauri-plugin-stt: greedy (best_of 1, beam 1), no context carried
between calls (whisper_full_default_params' no_context; do NOT pass --max-context 0,
which also truncates the initial prompt to nothing), 4 threads, English. Each configuration (model x prompt x noise) runs
in ONE whisper-cli call over all its clips, so the model loads once and accuracy is
cheap. Latency is measured separately: one call per clip on a fixed subset, and
latency = whisper's own total time minus its load time (what a warm app pays
after the user stops talking).

Scores:
  key-term accuracy  share of the items' key terms found in the transcript (regexes
                     in items.json, matched on the normalized transcript)
  WER                word error rate against `ref` after normalization
  commands           exact match for the hands-free words (next, pass, deficiency, repeat)
Standard library only.
"""

from __future__ import annotations

import argparse
import json
import re
import statistics
import subprocess
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROMPT = (HERE / "prompt.txt").read_text().strip()
TIMING = re.compile(r"whisper_print_timings:\s+(load|total) time =\s+([\d.]+) ms")


def norm(text: str) -> str:
    t = text.lower().replace("’", "'")
    t = re.sub(r"(?<=\d),(?=\d{3})", "", t)  # 1,000 -> 1000
    t = re.sub(r"[^a-z0-9'.\- ]+", " ", t)
    t = re.sub(r"(?<!\d)\.|\.(?!\d)", " ", t)  # keep only decimal points
    return re.sub(r"\s+", " ", t).strip()


def wer_tokens(text: str) -> list[str]:
    return norm(text).replace("-", " ").split()


def wer(ref: str, hyp: str) -> tuple[int, int]:
    r, h = wer_tokens(ref), wer_tokens(hyp)
    d = list(range(len(h) + 1))
    for i in range(1, len(r) + 1):
        prev, d[0] = d[0], i
        for j in range(1, len(h) + 1):
            cur = min(d[j] + 1, d[j - 1] + 1, prev + (r[i - 1] != h[j - 1]))
            prev, d[j] = d[j], cur
    return d[len(h)], len(r)


def term_hits(item: dict, hyp: str) -> list[bool]:
    t = norm(hyp)
    return [any(re.search(p, t) for p in alts) for alts in item["terms"]]


def run_batch(cli: str, model: Path, clips: list[Path], workdir: Path, prompt: str | None) -> dict[str, str]:
    workdir.mkdir(parents=True, exist_ok=True)
    links = []
    for c in clips:
        link = workdir / c.name
        if not link.exists():
            link.symlink_to(c.resolve())
        links.append(link)
    cmd = [cli, "-m", str(model), "-l", "en", "-t", "4", "-bo", "1", "-bs", "1", "-nt", "-np", "-otxt"]
    if prompt:
        cmd += ["--prompt", prompt]
    for link in links:
        cmd += ["-f", str(link)]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return {l.stem: (workdir / f"{l.name}.txt").read_text().strip() for l in links}


def latency(cli: str, model: Path, clip: Path, prompt: str | None, cpus: str | None = None) -> float:
    cmd = (["taskset", "-c", cpus] if cpus else []) + [cli, "-m", str(model), "-l", "en", "-t", "4", "-bo", "1", "-bs", "1", "-nt", "-f", str(clip)]
    if prompt:
        cmd += ["--prompt", prompt]
    p = subprocess.run(cmd, check=True, capture_output=True, text=True)
    t = dict((k, float(v)) for k, v in TIMING.findall(p.stderr))
    return t["total"] - t["load"]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cli", required=True)
    ap.add_argument("--models", required=True, type=Path)
    ap.add_argument("--audio", required=True, type=Path)
    ap.add_argument("--work", type=Path, default=Path("/tmp/crane-voice-work"))
    ap.add_argument("--out", required=True, type=Path)
    ap.add_argument("--model", action="append")
    ap.add_argument("--conditions", nargs="+", default=["clean", "snr10", "snr5"])
    ap.add_argument("--latency-clips", type=int, default=24)
    ap.add_argument("--cpus", help="pin latency runs to these CPUs (taskset list), e.g. mid-range-phone-class cores")
    ap.add_argument("--latency-only", action="store_true", help="only time the models (prompted, snr10), no accuracy batches")
    a = ap.parse_args()

    items = {i["id"]: i for i in json.loads((HERE / "items.json").read_text())["items"]}
    results = json.loads(a.out.read_text()) if a.out.exists() else {"prompt": PROMPT, "runs": []}
    done = {(r["model"], r["prompt"], r["condition"]) for r in results["runs"]}
    models = a.model or sorted(p.name for p in a.models.glob("ggml-*.bin"))
    if a.latency_only:
        clips = sorted((a.audio / "snr10").glob("*.wav"))
        subset = clips[:: max(1, len(clips) // a.latency_clips)][: a.latency_clips]
        lat_runs = results.setdefault("latency", [])
        for model in models:
            if any(r["model"] == model and r["cpus"] == a.cpus for r in lat_runs):
                continue
            lat = sorted(latency(a.cli, a.models / model, c, PROMPT, a.cpus) for c in subset)
            lat_runs.append({"model": model, "cpus": a.cpus, "n": len(lat), "median": round(statistics.median(lat)), "p90": round(lat[int(0.9 * (len(lat) - 1))])})
            a.out.write_text(json.dumps(results, indent=1))
            print(model, lat_runs[-1], flush=True)
        return
    for model in models:
        for use_prompt in (False, True):
            for cond in a.conditions:
                key = (model, use_prompt, cond)
                if key in done:
                    continue
                clips = sorted((a.audio / cond).glob("*.wav"))
                started = time.time()
                hyps = run_batch(a.cli, a.models / model, clips, a.work / model / ("prompt" if use_prompt else "plain") / cond, PROMPT if use_prompt else None)
                errs = words = hits = terms = cmd_ok = cmd_n = 0
                per_item = []
                for clip in clips:
                    item = items[clip.stem.split("-")[0]]
                    hyp = hyps[clip.stem]
                    e, n = wer(item["ref"], hyp)
                    errs, words = errs + e, words + n
                    h = term_hits(item, hyp)
                    hits, terms = hits + sum(h), terms + len(h)
                    if "command" in item:
                        cmd_n += 1
                        cmd_ok += norm(hyp).strip(" .!") == item["command"]
                    per_item.append({"clip": clip.stem, "hyp": hyp, "terms": h, "wer": [e, n]})
                lat = []
                if use_prompt and cond == "snr10":
                    for clip in clips[:: max(1, len(clips) // a.latency_clips)][: a.latency_clips]:
                        lat.append(latency(a.cli, a.models / model, clip, PROMPT))
                run = {
                    "model": model, "prompt": use_prompt, "condition": cond, "clips": len(clips),
                    "key_term_accuracy": round(hits / terms, 4), "wer": round(errs / words, 4),
                    "commands": [cmd_ok, cmd_n], "batch_seconds": round(time.time() - started, 1),
                    "latency_ms": {"n": len(lat), "median": round(statistics.median(lat)), "p90": round(sorted(lat)[int(0.9 * (len(lat) - 1))])} if lat else None,
                    "items": per_item,
                }
                results["runs"].append(run)
                a.out.write_text(json.dumps(results, indent=1))
                print(f"{model:32s} prompt={use_prompt!s:5s} {cond:6s} terms={run['key_term_accuracy']:.3f} wer={run['wer']:.3f} cmds={cmd_ok}/{cmd_n} lat={run['latency_ms']}", flush=True)


if __name__ == "__main__":
    main()
