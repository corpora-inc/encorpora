"""Multi-tier corpus layer for the bake-off.

The owner's methodology point (2026-06-06): FLEURS is native, clean
read-speech, but Corpán's REAL input is a non-native LEARNER saying a SHORT
target-language PHRASE on a phone mic. So we evaluate in TWO tiers and a
winner must clear BOTH:

  TIER 1 — `fleurs`        cross-language RANKING (the decision gate).
  TIER 2 — domain-matched  validate the FLEURS winner on OUR shape:
           `corpan_tts`    Corpán's own ~10k/lang phrases (short, conversational,
                           our vocabulary) — TTS-synthesized. Measures
                           DOMAIN-TEXT fit, not accent (TTS is clean).
           `common_voice`  accent/L2-tagged subsets — measures ACCENT/L2
                           robustness on natural speech.
           `gold`          the owner's real Parlometron learner recordings, if
                           provided (a manifest of wav+ref) — the truest signal.

Every loader yields the SAME `Sample`, tagged with its `tier` + `source`, so
run_bakeoff.py treats them uniformly and build_report.py reports each tier
separately. Adding a corpus = a new loader module + a registry entry here.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Sample:
    wav_path: str
    reference: str
    sample_id: str
    tier: str = "fleurs"      # "fleurs" | "domain"
    source: str = "fleurs"    # "fleurs" | "corpan_tts" | "common_voice" | "gold"


# Registry of corpus sources → loader callables. Each loader has signature:
#   load(lang, *, n, corpus_dir, **opts) -> list[Sample]
# Imported lazily inside the getter so a missing heavy dep (datasets, a TTS
# engine) only fails when that source is actually requested.
def get_loader(source: str):
    if source == "fleurs":
        from .fleurs import load
        return load
    if source == "corpan_tts":
        from .corpan_phrases import load
        return load
    if source == "common_voice":
        from .common_voice import load
        return load
    if source == "gold":
        from .gold_recordings import load
        return load
    raise ValueError(f"unknown corpus source: {source!r}")


# Which sources make up each tier (the runner expands a tier → its sources).
TIERS: dict[str, list[str]] = {
    "fleurs": ["fleurs"],
    "domain": ["corpan_tts", "common_voice", "gold"],
}
