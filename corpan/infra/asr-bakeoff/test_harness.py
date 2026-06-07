"""Self-contained tests for the bake-off harness logic.

These DON'T touch any ASR model — they prove the parts that decide the
verdict: the WER/CER scoring (incl. the spaced-vs-CJK split), the language
plan, and the report's north-star math. Run with the project venv:

    python -m pytest test_harness.py -q          # if pytest installed
    python test_harness.py                       # plain stdlib runner

The metric tests need `jiwer`; if it's absent they self-skip so the
report/lang tests (pure stdlib) still run.
"""

import json
import os
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import langs as L
import build_report as R


def test_lang_plan_engine_assignment():
    # English: broad generalists + Parakeet (EU) + SenseVoice (its set).
    en = L.by_code("en")
    assert set(en.engines()) == {"qwen3", "whisper", "parakeet", "sensevoice"}
    # Hindi: only the generalists (no Parakeet/SenseVoice coverage).
    hi = L.by_code("hi")
    assert set(hi.engines()) == {"qwen3", "whisper"}
    # Cantonese: generalists + SenseVoice (its CJK star), NOT Parakeet.
    yue = L.by_code("yue-Hant-HK")
    assert "sensevoice" in yue.engines()
    assert "parakeet" not in yue.engines()
    # Polish: Parakeet's turf, no SenseVoice.
    pl = L.by_code("pl")
    assert "parakeet" in pl.engines()
    assert "sensevoice" not in pl.engines()


def test_cjk_langs_score_with_cer():
    for code in ("ja", "ko-polite", "zh-Hans", "yue-Hant-HK"):
        assert L.by_code(code).script == "cjk"
    assert L.by_code("th").script == "thai"
    # RTL scripts stay WER (Arabic IS space-delimited).
    assert L.by_code("ar").script == "rtl"


def test_corpus_tiers_fleurs_first():
    import corpora as C
    # FLEURS is its own tier (the gate); domain expands to the 3 sources.
    assert C.TIERS["fleurs"] == ["fleurs"]
    assert C.TIERS["domain"] == ["corpan_tts", "common_voice", "gold"]
    # The runner's source order is FLEURS-first then domain.
    import run_bakeoff as RB
    import argparse
    a = argparse.Namespace(sources="", tiers=["fleurs", "domain"])
    order = RB._sources_run_order(a)
    assert order[0] == "fleurs"
    assert "corpan_tts" in order and "common_voice" in order and "gold" in order


def test_corpan_phrases_pulls_short_real_phrases():
    # Domain TEXT comes from the REAL dja/release.sqlite3 — short, our shape.
    import os
    from corpora.corpan_phrases import corpan_phrases, _default_db
    db = _default_db()
    if not os.path.exists(db):
        print("  (skip corpan_phrases — release.sqlite3 not present)")
        return
    phrases = corpan_phrases("es", 5, db)
    assert len(phrases) == 5
    # All within the short dictation-shape length window.
    assert all(8 <= len(p) <= 80 for p in phrases)


def test_engine_run_order_puts_qwen_first():
    import argparse
    import run_bakeoff as RB

    # `--engines all` → Qwen3-first default order (the north-star table first).
    a = argparse.Namespace(engines={"qwen3", "whisper", "parakeet", "sensevoice"},
                           engines_ordered=["qwen3", "whisper", "parakeet", "sensevoice"])
    assert RB._engine_run_order(a)[0] == "qwen3"
    # Explicit CLI order is honored (whisper first if the user asks).
    a2 = argparse.Namespace(engines={"qwen3", "whisper"},
                            engines_ordered=["whisper", "qwen3"])
    assert RB._engine_run_order(a2) == ["whisper", "qwen3"]
    # Only-selected engines appear (no parakeet when not requested).
    a3 = argparse.Namespace(engines={"qwen3"}, engines_ordered=["qwen3"])
    assert RB._engine_run_order(a3) == ["qwen3"]


def test_coverage_gap_is_flagged():
    gaps = {x.code for x in L.coverage_gaps()}
    assert "pa-Arab" in gaps  # Shahmukhi Punjabi — no corpus ships it


def test_metrics_wer_cer_if_jiwer():
    try:
        import metrics as M  # imports jiwer
    except Exception:
        print("  (skip metric tests — jiwer not installed)")
        return
    # Perfect match → 0; punctuation/case normalized away.
    assert M.wer("Hello, world.", "hello world") == 0.0
    # One substitution out of two words → 0.5.
    assert abs(M.wer("hello world", "hello earth") - 0.5) < 1e-9
    # CJK CER: one wrong char out of three → ~0.33 (spaces irrelevant).
    name, rate = M.score("你好吗", "你好马", script="cjk")
    assert name == "cer"
    assert 0.3 < rate < 0.4
    # Spaced script routes to WER.
    name, _ = M.score("good morning", "good morning", script="spaced")
    assert name == "wer"


def test_report_north_star_yes_when_qwen_clears_ratio():
    # 50 tested langs, Qwen passes 48 (96% ≥ 90% AND ≥ 45 floor) → YES.
    rows = []
    for i in range(48):
        rows.append(_row(f"good{i}", "qwen3", "wer", 0.10))
        rows.append(_row(f"good{i}", "whisper", "wer", 0.12))
    for i in range(2):  # 2 langs Qwen flunks
        rows.append(_row(f"bad{i}", "qwen3", "wer", 0.60))
        rows.append(_row(f"bad{i}", "whisper", "wer", 0.15))
    md = R.build(rows)
    # Single tier (FLEURS) → PRELIMINARY pass, prompts for the domain tier.
    assert "Qwen3 passed **48/50**" in md
    assert "PRELIMINARY PASS" in md
    assert "DOMAIN tier" in md


def test_report_north_star_no_below_floor():
    # 50 langs but Qwen passes only 30 (60%) → below the 90%/45 bar.
    rows = []
    for i in range(30):
        rows.append(_row(f"good{i}", "qwen3", "wer", 0.08))
        rows.append(_row(f"good{i}", "whisper", "wer", 0.20))
    for i in range(20):
        rows.append(_row(f"bad{i}", "qwen3", "wer", 0.60))
        rows.append(_row(f"bad{i}", "whisper", "wer", 0.15))
    md = R.build(rows)
    assert "Qwen3 passed **30/50**" in md
    assert "PRELIMINARY FAIL" in md


def test_report_requires_both_tiers_to_pass():
    # Qwen clears FLEURS (48/50) but FAILS the domain tier (20/50) → overall NO.
    rows = []
    for i in range(48):
        rows.append(_row(f"good{i}", "qwen3", "wer", 0.10, tier="fleurs"))
        rows.append(_row(f"good{i}", "whisper", "wer", 0.12, tier="fleurs"))
    for i in range(2):
        rows.append(_row(f"fbad{i}", "qwen3", "wer", 0.60, tier="fleurs"))
        rows.append(_row(f"fbad{i}", "whisper", "wer", 0.15, tier="fleurs"))
    # domain tier: Qwen only passes 20/50 (accent/phrase shape hurts it)
    for i in range(20):
        rows.append(_row(f"dgood{i}", "qwen3", "wer", 0.10, tier="domain",
                         source="common_voice"))
        rows.append(_row(f"dgood{i}", "whisper", "wer", 0.12, tier="domain",
                         source="common_voice"))
    for i in range(30):
        rows.append(_row(f"dbad{i}", "qwen3", "wer", 0.55, tier="domain",
                         source="common_voice"))
        rows.append(_row(f"dbad{i}", "whisper", "wer", 0.18, tier="domain",
                         source="common_voice"))
    md = R.build(rows)
    assert "NOT YET / NO" in md
    assert "domain" in md  # the failing tier is named
    # both tier sections render
    assert "Tier 1 — FLEURS" in md
    assert "Tier 2 — Domain-matched" in md


def test_report_both_tiers_pass_is_yes():
    rows = []
    for tier, source in (("fleurs", "fleurs"), ("domain", "corpan_tts")):
        for i in range(48):
            rows.append(_row(f"{tier}g{i}", "qwen3", "wer", 0.10, tier=tier, source=source))
            rows.append(_row(f"{tier}g{i}", "whisper", "wer", 0.12, tier=tier, source=source))
        for i in range(2):
            rows.append(_row(f"{tier}b{i}", "qwen3", "wer", 0.60, tier=tier, source=source))
            rows.append(_row(f"{tier}b{i}", "whisper", "wer", 0.15, tier=tier, source=source))
    md = R.build(rows)
    assert "**YES**" in md
    assert "BOTH" in md


def test_report_marks_winner_and_handles_missing():
    rows = [
        _row("en", "qwen3", "wer", 0.10),
        _row("en", "whisper", "wer", 0.05),   # whisper wins en
        _row("ja", "qwen3", "cer", 0.07),     # qwen wins ja (only one)
    ]
    md = R.build(rows)
    # whisper is the en winner → its cell carries the '*'
    assert "0.05*" in md
    assert "**whisper**" in md
    assert "**qwen3**" in md


def _row(code, engine, metric, er, *, tier="fleurs", source="fleurs"):
    return {
        "lang": code, "lang_name": code.upper(), "engine": engine,
        "metric": metric, "error_rate": er, "median_latency_s": 1.0,
        "peak_rss_mb": 500.0, "n_samples": 20, "n_failed": 0,
        "script": "cjk" if metric == "cer" else "spaced",
        "tier": tier, "source": source, "note": "",
    }


def _main():
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    passed = 0
    for fn in fns:
        fn()
        print(f"  ok  {fn.__name__}")
        passed += 1
    print(f"\n{passed}/{len(fns)} harness tests passed")


if __name__ == "__main__":
    _main()
