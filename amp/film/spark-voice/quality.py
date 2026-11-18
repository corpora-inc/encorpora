"""Where a take's speech really starts and ends, and the sounds that are not speech.

Pure numpy, so it is tested in CI (test_quality.py). `audio` is mono float in
[-1, 1] after mastering (speech at about -18 LUFS); `words` are the forced
alignment's {word, start, end} in seconds.

Why this exists (founder review, 2026-11-18, three house-voiced films):
- "First letter cut off": the CTC aligner places a word's start at its vowel,
  50-150 ms after a leading consonant ("T" of "Take", "B" of "Back"). Trimming
  that silenced everything up to 100 ms before the aligned start and ramped in
  over those 100 ms removed half or more of the consonant. The take's start is
  now found from the audio: the last stretch of measured silence before the
  first word, and the fade sits inside that silence.
- "Hell noise": after its last word, Chatterbox V3 often keeps generating a
  low, sustained voiced drone for one to two seconds (V3 runs without the
  alignment analyzer that stopped V2). The old tail scan followed any sound for
  up to 1.5 s and kept it. The tail now ends where the last word decays, at
  most TAIL_MAX after its aligned end, and sound that runs on past that, or
  sits in a pause between words, is reported so the take is made again.
"""
from __future__ import annotations

import numpy as np

HOP = 0.005
#: Silence after mastering: under -50 dBFS, or three times the take's own floor.
SILENCE_DB = -50.0
#: A word's last sound (a final "s", the decay of a vowel) ends within this of its aligned end.
TAIL_MAX = 0.35
#: The first word's own sound may start this long before its aligned start (a leading consonant).
LEAD_MAX = 0.35
#: Silence the fade-in occupies, just before the onset.
FADE_IN = 0.02
#: Fade at the end, starting where the last sound ends.
FADE_OUT = 0.06
#: Sound in a pause is noise when it is this loud (dBFS, 5 ms RMS) for RUN seconds,
#: and never as loud as speech: louder than SPEECH_DB it is a word the aligner placed
#: badly (a long vowel), which the transcript check judges. Measured on the founder's
#: three films: breaths and drones peaked at -40 to -26 dBFS, misplaced words at -21 to -16.
NOISE_DB = -38.0
SPEECH_DB = -23.0
RUN = 0.08
#: Loud sound this long after the last word's aligned end is not its decay.
DECAY = 0.25
#: Pause sound this close to a word belongs to the word (an onset consonant, a release, a breathy end).
NEAR = 0.12


def envelope(audio: np.ndarray, sr: int) -> np.ndarray:
    h = max(1, int(sr * HOP))
    n = len(audio) // h
    return np.sqrt(np.mean(audio[: n * h].astype(np.float64).reshape(n, h) ** 2, axis=1)) if n else np.zeros(0)


def floor_of(env: np.ndarray) -> float:
    quiet = env[env > 0]
    own = float(np.percentile(quiet, 5)) * 3 if len(quiet) else 0.0
    return max(10 ** (SILENCE_DB / 20), own)


def onset(audio: np.ndarray, sr: int, first_start: float) -> float:
    """The start of the first word's sound: going back from its aligned start
    (at most LEAD_MAX), the end of the last 20 ms of silence."""
    env = envelope(audio, sr)
    floor = floor_of(env)
    i = min(int(first_start / HOP), len(env))
    stop = max(0, int((first_start - LEAD_MAX) / HOP))
    need = int(0.02 / HOP)
    quiet = 0
    for j in range(i - 1, stop - 1, -1):
        quiet = quiet + 1 if env[j] < floor else 0
        if quiet >= need:
            return (j + need) * HOP
    return stop * HOP


def offset(audio: np.ndarray, sr: int, last_end: float) -> float:
    """The end of the last word's sound: the first 20 ms of silence after its
    aligned end, at most TAIL_MAX after it."""
    env = envelope(audio, sr)
    floor = floor_of(env)
    i = int(last_end / HOP)
    stop = min(len(env), int((last_end + TAIL_MAX) / HOP))
    need = int(0.02 / HOP)
    quiet = 0
    for j in range(i, stop):
        quiet = quiet + 1 if env[j] < floor else 0
        if quiet >= need:
            return (j - need + 1) * HOP
    return stop * HOP


def trim(audio: np.ndarray, sr: int, first_start: float, last_end: float) -> tuple[np.ndarray, float]:
    """Silence before the onset with a FADE_IN inside that silence, the take's
    end at its last sound with FADE_OUT, then 300 ms of silence. Returns the
    audio and how far it was shifted (always 0: nothing before the onset is
    removed, so word times stay true)."""
    out = audio.astype(np.float32).copy()
    on = onset(out, sr, first_start)
    a, b = int(max(0.0, on - FADE_IN) * sr), int(on * sr)
    out[:a] = 0.0
    if b > a:
        out[a:b] *= np.linspace(0.0, 1.0, b - a, dtype=np.float32)
    off = offset(out, sr, last_end)
    e = min(len(out), int(off * sr) + int(FADE_OUT * sr))
    s = min(int(off * sr), e)
    out = out[:e]
    if e > s:
        out[s:e] *= np.linspace(1.0, 0.0, e - s, dtype=np.float32)
    return np.concatenate([out, np.zeros(int(0.3 * sr), dtype=np.float32)]), 0.0


def longest(word: dict) -> float:
    """The longest a spoken word plausibly lasts: 0.2 s and 0.11 s a letter
    ("sixths" 0.86 s). The aligner stretches a last word over any drone after it
    (add-fractions--sa at 1:35: "sixths" ran 3.7 s), so a longer word is a run-on."""
    return 0.2 + 0.11 * sum(ch.isalpha() for ch in word["word"])


def speech_end(words: list[dict]) -> float:
    """The last word's aligned end, or where it plausibly ends when the aligner stretched it."""
    last = words[-1]
    return min(last["end"], last["start"] + longest(last))


def _runs(mask: np.ndarray):
    i, n = 0, len(mask)
    while i < n:
        if not mask[i]:
            i += 1
            continue
        j = i
        while j < n and mask[j]:
            j += 1
        yield i, j
        i = j


def noises(audio: np.ndarray, sr: int, words: list[dict]) -> list[str]:
    """Sounds that are no word: loud for RUN or longer in a pause between words
    (NEAR from either word), or after the last word's sound has ended. Each is a
    reason to make the take again."""
    env = envelope(audio, sr)
    loud = env >= 10 ** (NOISE_DB / 20)
    out: list[str] = []
    need = int(RUN / HOP)
    spans = [(w["start"] - NEAR, w["end"] + NEAR) for w in words]
    for i, j in _runs(loud):
        if j - i < need:
            continue
        a = i * HOP
        if a >= words[-1]["end"]:
            continue  # after the last word: measured as a run-on below
        # the part of the run that no word covers
        free = np.ones(j - i, dtype=bool)
        for s, e in spans:
            lo, hi = max(i, int(s / HOP)), min(j, int(e / HOP))
            if hi > lo:
                free[lo - i:hi - i] = False
        best = max((q - p for p, q in _runs(free)), default=0)
        peak = 20 * np.log10(max(float(env[i:j].max()), 1e-9))
        if best >= need and peak < SPEECH_DB:
            out.append(f"a sound that is no word in a pause at {a:.2f} s ({best * HOP * 1000:.0f} ms, peak {peak:.0f} dBFS)")
    for w in words:
        if w["end"] - w["start"] > longest(w):
            out.append(f'the word "{w["word"]}" runs on: {w["end"] - w["start"]:.1f} s from {w["start"]:.2f} s')
    # A last word decays within DECAY; loud sound after that is the model running on.
    rest = loud[int((speech_end(words) + DECAY) / HOP):]
    run_on = sum(q - p for p, q in _runs(rest)) * HOP
    if run_on >= 0.1:
        out.append(f"the voice runs on for {run_on:.2f} s after the last word")
    return out
