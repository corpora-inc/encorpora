"""Post-generate alignment fixup for one language.

ttsctl pipeline order is: TTS → Align → Validate → Trim → Master.
The Trim phase overwrites the wav AFTER Align has saved alignment data,
so the persisted alignment is stale relative to the wav that ships in
the m4a. On divergent-text segments (text != tts.text) forced alignment
also misplaces the first display word, which makes Master's trim zero
real audio.

This script fixes three failure modes:

1. **Re-align all spoken segments** with stable-ts on the current
   (post-trim) wav files, overwriting alignment_<lang>.json.
2. **Free-form onset patch** for divergent-text first words: where the
   forced alignment puts the first word later than where speech actually
   starts (per Whisper free-form transcription), set the first word's
   start_ms to the actual onset and extend its end_ms to the next word's
   start_ms.
3. **Tail-zero redistribute** for dense-passage last words: when Chatterbox
   speaks a long sentence tightly, Whisper's forced alignment sometimes
   crams the last 2-3 words to `start=end=audio_end` (zero duration each),
   which makes the reader flash them past instantly and the wrapper's
   post-trim gate refuse to publish. When the audio actually contains
   the words (verified by inspection on boreal-forest 2026-06-30 — audio
   has 300-500ms of real speech after Whisper's last non-zero boundary),
   redistribute those zero-duration words evenly across the remaining
   audio tail so the reader highlight tracks reasonably. See
   `feedback_realign_after_trim.md` and the boreal-forest round-3 lesson.

Caller runs `ttsctl master --lang <lang> --all` AFTER this script, so
audio_manifest_<lang>.json picks up the new alignment and master re-trims
with the corrected first_word_start.

Usage:
    python post_generate_fixup.py <pack_dir> <lang>

References:
    ~/projects/ttsctl/changelog/decisions/2026-05-06_stale_alignment_after_trim.md
    ~/.claude/projects/-home-skyl/memory/feedback_realign_after_trim.md
    ~/.claude/projects/-home-skyl/memory/feedback_post_trim_validation_gap.md
"""
from __future__ import annotations

import json
import sys
import warnings
from pathlib import Path

warnings.filterwarnings("ignore")

# How much later than the energy-detected onset can forced alignment be
# before we patch? Whisper word-boundary lag is typically 20-70ms; we
# patch only when forced is much later than where the wav actually has
# speech.
FORCED_VS_ENERGY_PATCH_THRESHOLD_MS = 200

# Energy-based speech onset detection.
# Returns the start_ms of the first ~50ms window whose RMS exceeds the
# (per-segment-calibrated) threshold. More reliable than Whisper for
# short letter-spelled or divergent-text first-words (e.g. "BMW" → "Bay
# Em Vay" — Whisper sometimes compresses these to a late single token).
def detect_speech_onset_ms(wav_path: str) -> int | None:
    import soundfile as sf
    import numpy as np

    audio, sr = sf.read(wav_path, dtype="float32")
    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    if len(audio) == 0:
        return None

    win = max(1, int(0.05 * sr))  # 50ms windows
    # Reference noise floor from first 30ms (typically pre-speech)
    head_n = min(int(0.030 * sr), len(audio))
    noise_rms = float(np.sqrt(np.mean(audio[:head_n] ** 2))) if head_n > 0 else 0.0
    # Mid-segment speech RMS as a high reference
    speech_ref = float(np.sqrt(np.mean(audio ** 2)))
    # Threshold: 4x noise floor, but at least 10% of overall speech RMS,
    # capped at 0.01 absolute so very-quiet recordings still trigger.
    threshold = max(noise_rms * 4.0, speech_ref * 0.10, 0.005)

    for start in range(0, len(audio) - win, win // 2):
        chunk = audio[start : start + win]
        rms = float(np.sqrt(np.mean(chunk ** 2)))
        if rms >= threshold:
            return int(start / sr * 1000)
    return None


def main() -> None:
    if len(sys.argv) != 3:
        print(__doc__, file=sys.stderr)
        sys.exit(2)

    pack = Path(sys.argv[1]).resolve()
    lang = sys.argv[2]

    sys.path.insert(0, "/home/skyl/projects/ttsctl")
    import torch
    from ttsctl.aligner import load_aligner, align_segment

    seg_file = pack / ("segments.json" if lang == "en" else f"segments_{lang}.json")
    align_file = pack / f"alignment_{lang}.json"
    wav_dir = pack / "audio" / lang / "wav"

    if not seg_file.exists():
        sys.exit(f"missing {seg_file}")
    if not wav_dir.exists():
        sys.exit(f"missing {wav_dir}")

    segs = json.loads(seg_file.read_text())
    seg_map = {s["id"]: s for s in segs["segments"]}

    # Backup the existing alignment
    if align_file.exists():
        backup = align_file.with_suffix(".pre_fixup.json")
        backup.write_text(align_file.read_text())
        print(f"  backed up {align_file.name} -> {backup.name}")

    print("loading aligner (forced)...")
    aligner = load_aligner(model_size="medium", device=torch.device("cuda"))

    def audio_end_ms(wav_path: Path) -> int:
        import soundfile as sf
        info = sf.info(str(wav_path))
        return int(info.frames / info.samplerate * 1000)

    def redistribute_tail_zeros(words, wav_path):
        """Return (words, n_fixed_zeros). If the tail has >=2 zero-duration
        words (start==end), redistribute them across the audio tail.

        Chatterbox on dense passages produces audio where Whisper places
        the last N words at a single timestamp (usually audio_end). Audio
        is fine; alignment is not. Spread them across
        [prev_nonzero.end_ms, audio_end - 50ms] so the reader can track.
        """
        if len(words) < 2:
            return words, 0
        zeros = []
        for i, w in enumerate(reversed(words)):
            if w.get("start_ms") == w.get("end_ms"):
                zeros.append(len(words) - 1 - i)
            else:
                break
        if len(zeros) < 2:
            return words, 0
        zeros.reverse()
        first_zero_idx = zeros[0]
        prev_end = words[first_zero_idx - 1]["end_ms"] if first_zero_idx > 0 else 0
        try:
            end_ms = audio_end_ms(Path(wav_path))
        except Exception:
            return words, 0
        target_end = max(prev_end + 100, end_ms - 50)
        n = len(zeros)
        slice_ms = max(80, (target_end - prev_end) // n)
        cur = prev_end
        for zi in zeros:
            words[zi]["start_ms"] = cur
            words[zi]["end_ms"] = min(end_ms, cur + slice_ms)
            cur = words[zi]["end_ms"]
        words[zeros[-1]]["end_ms"] = max(words[zeros[-1]]["end_ms"], target_end)
        return words, n

    new_align: dict[str, list[dict]] = {}
    eligible = 0
    onset_patched = 0
    tail_redistributed = 0

    for sid, s in seg_map.items():
        if s.get("block_type") == "heading" and s.get("heading_level") == 1:
            continue  # display-only chapter title, not spoken
        wav = wav_dir / f"{sid}.wav"
        if not wav.exists():
            continue
        eligible += 1
        text = s.get("text", "")
        tts_text = (s.get("tts") or {}).get("text", text)

        # 1) Forced alignment to display text — produces highlight timestamps.
        words = align_segment(aligner, str(wav), text, lang)
        if not words:
            new_align[sid] = words
            continue

        # 2) Onset patch — applies to BOTH divergent and non-divergent segments.
        #    Forced alignment can place the first word much later than where
        #    speech actually starts (stochastic). When that happens and Master
        #    later runs trim with first_word_start_ms, it zeros real audio.
        #    Detect via energy-based onset (more reliable than Whisper, which
        #    can compress short letter-spelled words like "Bay Em Vay" into
        #    a single late token).
        #
        #    For divergent segments (text != tts.text), also extend end_ms to
        #    cover the full multi-word audio span (e.g. display "BMW" → audio
        #    "Bay Em Vay" gets the full 3-word time range).
        if len(words) > 0:
            forced_first = words[0]["start_ms"]
            if forced_first > FORCED_VS_ENERGY_PATCH_THRESHOLD_MS:
                actual_onset_ms = detect_speech_onset_ms(str(wav))
                if (
                    actual_onset_ms is not None
                    and forced_first - actual_onset_ms
                    >= FORCED_VS_ENERGY_PATCH_THRESHOLD_MS
                ):
                    new_start = max(0, actual_onset_ms)
                    if tts_text != text:
                        # Divergent (text != tts.text): single display word
                        # maps to N audio words. Forced alignment can't anchor
                        # the display word reliably, and a uniform shift would
                        # leave subsequent words misaligned because the
                        # divergent audio span "compresses" against the next
                        # display word. Extend the first word to cover the
                        # divergent audio range; leave the rest as forced gave
                        # them.
                        second_start = (
                            words[1]["start_ms"]
                            if len(words) > 1
                            else words[0]["end_ms"]
                        )
                        words[0]["start_ms"] = new_start
                        words[0]["end_ms"] = max(new_start, second_start)
                        kind = "div"
                    else:
                        # Non-divergent: forced placed the entire alignment
                        # uniformly late by the same offset. Shift ALL words
                        # back by `delta` so word boundaries land where they
                        # actually fall in the audio (better word-level
                        # highlighting and prevents Master's trim from zeroing
                        # real audio).
                        delta = forced_first - new_start
                        for w in words:
                            w["start_ms"] = max(0, w["start_ms"] - delta)
                            w["end_ms"] = max(w["start_ms"], w["end_ms"] - delta)
                        kind = "plain"
                    onset_patched += 1
                    print(
                        f"  onset-patch [{kind}] {sid}: {words[0]['word']!r:<14} "
                        f"forced_first={forced_first}ms -> "
                        f"{words[0]['start_ms']}-{words[0]['end_ms']}ms "
                        f"(energy onset={actual_onset_ms}ms"
                        f"{', whole-seg shifted' if kind == 'plain' else ''})"
                    )

        # 3) Tail-zero redistribute. Dense-passage last words that Whisper
        # crams to start=end=audio_end get spread across the actual audio
        # tail so the reader highlight makes sense and the wrapper's
        # post-trim gate passes.
        words, n_zeros = redistribute_tail_zeros(words, wav)
        if n_zeros > 0:
            tail_redistributed += 1
            print(
                f"  tail-redistribute {sid}: spread {n_zeros} zero-duration "
                f"tail words across audio tail"
            )

        new_align[sid] = words

    align_file.write_text(json.dumps(new_align, indent=2, ensure_ascii=False))
    print(
        f"\n  {lang}: realigned {eligible} segments, "
        f"onset-patched {onset_patched}, tail-redistributed {tail_redistributed}"
    )
    print(f"  wrote {align_file}")
    print(f"\nNEXT: ttsctl master {pack} --lang {lang} --all")


if __name__ == "__main__":
    main()
