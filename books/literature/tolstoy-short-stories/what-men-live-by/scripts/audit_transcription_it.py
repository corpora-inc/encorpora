#!/usr/bin/env python3
"""Statistical transcription audit for Tolstoy 'What Men Live By' IT pack.

For each spoken IT segment, free-transcribes the audio with Whisper
large-v3 (cuda) and compares to the expected display text using:
  - sequence-aware word edit distance (WER)
  - strict first-word match (with allowance from pron-test verdicts)
  - strict last-word match
  - audio-duration plausibility metric (sec/char, fitted from PASS controls)

Output: pack/audits/it/transcription_audit_<date>.json with one record
per segment + a summary block. The voice-rate window (5th-95th
percentile of sec/expected-char on PASS controls) is also written
to ~/projects/ttsctl/calibration/tolstoy_what_men_live_by_ian-chill-clear/voice_rate_it.json.

Mirrors zheng_yi_sao/scripts/audit_transcription_en.py with IT-specific
paths and the duration plausibility extension from the
feedback_duration_plausibility_metric memory.

Run:
    /home/skyl/tts_venv/bin/python scripts/audit_transcription_it.py
"""
from __future__ import annotations

import argparse
import json
import os
import re
import statistics
import subprocess
import sys
import tempfile
import time
import unicodedata
import wave
from datetime import datetime, timezone
from pathlib import Path

PACK = Path(
    '/home/skyl/encorpora/books/literature/tolstoy-short-stories/'
    'what-men-live-by/packs/ian-chatterbox-v1'
)
LANG = 'it'
VOICE_ID = 'ian-chill-clear'
BOOK_SLUG = 'tolstoy_what_men_live_by'
CALIB_DIR = Path(
    f'/home/skyl/projects/ttsctl/calibration/{BOOK_SLUG}_{VOICE_ID}'
)

PUNCT_RE = re.compile(r"[^a-z0-9]+")


def normalize_word(w: str) -> str:
    w = unicodedata.normalize('NFKD', w).lower()
    return PUNCT_RE.sub('', w)


def normalize_words(text: str) -> list[str]:
    out = []
    for tok in text.split():
        n = normalize_word(tok)
        if n:
            out.append(n)
    return out


def levenshtein_words(a: list[str], b: list[str]) -> int:
    if not a:
        return len(b)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i] + [0] * len(b)
        for j, cb in enumerate(b, 1):
            cost = 0 if ca == cb else 1
            cur[j] = min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
        prev = cur
    return prev[-1]


def load_allowance() -> dict[str, str]:
    """Map normalized expected-word -> normalized accepted-replacement."""
    p = PACK / 'pronunciation_tests' / LANG / 'results.json'
    allow: dict[str, str] = {}
    if not p.exists():
        return allow
    data = json.loads(p.read_text())
    for entry in data:
        if entry.get('verdict') != 'replace':
            continue
        orig = normalize_word(entry.get('word', ''))
        repl = normalize_word(entry.get('replacement', ''))
        if orig and repl:
            allow[orig] = repl
            allow[repl] = orig
    return allow


def decode_to_wav(audio_path: Path, target: Path) -> None:
    subprocess.run(
        ['ffmpeg', '-y', '-loglevel', 'error', '-i', str(audio_path),
         '-ar', '16000', '-ac', '1', str(target)],
        check=True,
    )


def wav_duration_sec(p: Path) -> float:
    with wave.open(str(p), 'rb') as w:
        return w.getnframes() / float(w.getframerate())


def m4a_duration_sec(p: Path) -> float:
    out = subprocess.check_output(
        ['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
         '-of', 'default=noprint_wrappers=1:nokey=1', str(p)]
    )
    return float(out.strip())


def fit_voice_rate(records: list[dict]) -> dict | None:
    """Compute 5th/50th/95th percentiles of sec_per_expected_char on PASS.

    Returns None if too few PASS controls.
    """
    pass_d_e = [
        r['sec_per_expected_char'] for r in records
        if r['classification'] == 'PASS'
        and r.get('sec_per_expected_char') is not None
        and r.get('expected_chars', 0) >= 30  # short segments are noisy
    ]
    if len(pass_d_e) < 20:
        return None
    pass_d_e.sort()
    n = len(pass_d_e)
    p5 = pass_d_e[max(0, int(n * 0.05) - 1)]
    p50 = pass_d_e[n // 2]
    p95 = pass_d_e[min(n - 1, int(n * 0.95))]
    return {
        'samples': n,
        'p5': round(p5, 4),
        'p50': round(p50, 4),
        'p95': round(p95, 4),
    }


def classify_plausibility(rec: dict, rate: dict | None) -> str:
    """Apply duration-plausibility metric per
    feedback_duration_plausibility_metric.md.
    """
    if rate is None or rec.get('audio_duration_sec') is None:
        return 'AMBIGUOUS'
    de = rec.get('sec_per_expected_char')
    dh = rec.get('sec_per_heard_char')
    p5, p95 = rate['p5'], rate['p95']
    if de is None:
        return 'AMBIGUOUS'
    # OFF_SCRIPT_OR_TRUNCATED: duration too short for expected text
    if de < p5 * 0.75:
        return 'OFF_SCRIPT_OR_TRUNCATED'
    # HEARD_TEXT_FITS_BETTER: duration matches what was heard, not what was expected
    if de < p5 and dh is not None and p5 <= dh <= p95:
        return 'HEARD_TEXT_FITS_BETTER'
    # CONSISTENT_WITH_EXPECTED: duration fits expected
    if p5 <= de <= p95:
        return 'CONSISTENT_WITH_EXPECTED'
    # LONG_FOR_EXPECTED: too long
    if de > p95:
        return 'LONG_FOR_EXPECTED'
    return 'AMBIGUOUS'


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--limit', type=int, default=None,
                    help='process only the first N segments (debug)')
    ap.add_argument('--out', default=None,
                    help='output path (default: pack/audits/<lang>/transcription_audit_<date>.json)')
    ap.add_argument('--device', default='cuda')
    ap.add_argument('--model', default='large-v3')
    ap.add_argument('--audio-dir', default=None)
    args = ap.parse_args()

    seg_doc = json.loads((PACK / f'segments_{LANG}.json').read_text())
    segments = [s for s in seg_doc['segments'] if s.get('heading_level') != 1]
    if args.limit:
        segments = segments[: args.limit]

    allowance = load_allowance()
    print(f'allowance entries: {len(allowance)} '
          f'(Semën<->Semión + 5 more pairs expected)', flush=True)

    print(f'loading whisper {args.model} on {args.device}…', flush=True)
    sys.path.insert(0, '/home/skyl/projects/ttsctl')
    from ttsctl.aligner import load_aligner

    model = load_aligner(args.model, args.device)
    print('whisper loaded', flush=True)

    audio_dir = Path(args.audio_dir) if args.audio_dir else (PACK / 'audio' / LANG)
    wav_dir = audio_dir / 'wav'

    out_records: list[dict] = []
    summary: dict[str, int] = {
        'PASS': 0, 'FIRST_WORD_MISS': 0, 'LAST_WORD_MISS': 0,
        'WER_HIGH': 0, 'BORDERLINE': 0, 'NO_AUDIO': 0,
    }
    classification_to_ids: dict[str, list[str]] = {k: [] for k in summary}

    t0 = time.time()
    n = len(segments)
    for idx, seg in enumerate(segments):
        sid = seg['id']
        expected_text = seg.get('text', '') or ''
        expected_words = normalize_words(expected_text)
        expected_chars = len(re.sub(r'\s+', '', expected_text))

        wav_path = wav_dir / f'{sid}.wav'
        m4a_path = audio_dir / f'{sid}.m4a'

        tmp_wav = None
        try:
            audio_duration = None
            if wav_path.exists():
                use_path = str(wav_path)
                try:
                    audio_duration = wav_duration_sec(wav_path)
                except Exception:
                    audio_duration = None
            elif m4a_path.exists():
                try:
                    audio_duration = m4a_duration_sec(m4a_path)
                except Exception:
                    audio_duration = None
                tmp = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
                tmp.close()
                tmp_wav = Path(tmp.name)
                decode_to_wav(m4a_path, tmp_wav)
                use_path = str(tmp_wav)
            else:
                rec = {
                    'seg_id': sid, 'expected': expected_text, 'heard': None,
                    'wer': None, 'first_word_match': None, 'last_word_match': None,
                    'audio_duration_sec': None,
                    'expected_chars': expected_chars,
                    'heard_chars': None,
                    'sec_per_expected_char': None,
                    'sec_per_heard_char': None,
                    'plausibility': None,
                    'classification': 'NO_AUDIO',
                }
                out_records.append(rec)
                summary['NO_AUDIO'] += 1
                classification_to_ids['NO_AUDIO'].append(sid)
                continue

            try:
                result = model.transcribe(use_path, language=LANG, verbose=False)
                heard_text = (result.text or '').strip()
            except Exception as e:
                heard_text = ''
                print(f'  {sid}: transcribe ERR {e}', flush=True)
        finally:
            if tmp_wav is not None:
                try:
                    tmp_wav.unlink()
                except FileNotFoundError:
                    pass

        heard_words = normalize_words(heard_text)
        heard_chars = len(re.sub(r'\s+', '', heard_text))
        n_exp = len(expected_words)
        wer = levenshtein_words(expected_words, heard_words) / max(n_exp, 1)

        def words_equal(exp: str, heard: str) -> bool:
            return exp == heard or allowance.get(exp) == heard

        first_match = (
            bool(expected_words) and bool(heard_words)
            and words_equal(expected_words[0], heard_words[0])
        )
        last_match = (
            bool(expected_words) and bool(heard_words)
            and words_equal(expected_words[-1], heard_words[-1])
        )

        d_e = (
            audio_duration / expected_chars
            if audio_duration is not None and expected_chars > 0 else None
        )
        d_h = (
            audio_duration / heard_chars
            if audio_duration is not None and heard_chars > 0 else None
        )

        if not heard_words:
            classification = 'WER_HIGH'
        elif not first_match:
            classification = 'FIRST_WORD_MISS'
        elif not last_match:
            classification = 'LAST_WORD_MISS'
        elif wer >= 0.30:
            classification = 'WER_HIGH'
        elif wer >= 0.05:
            classification = 'BORDERLINE'
        else:
            classification = 'PASS'

        rec = {
            'seg_id': sid,
            'expected': expected_text,
            'heard': heard_text,
            'wer': round(wer, 4),
            'first_word_match': first_match,
            'last_word_match': last_match,
            'audio_duration_sec': round(audio_duration, 3) if audio_duration is not None else None,
            'expected_chars': expected_chars,
            'heard_chars': heard_chars,
            'sec_per_expected_char': round(d_e, 4) if d_e is not None else None,
            'sec_per_heard_char': round(d_h, 4) if d_h is not None else None,
            'plausibility': None,  # filled in after voice-rate fit
            'classification': classification,
            'expected_first': expected_words[0] if expected_words else None,
            'heard_first': heard_words[0] if heard_words else None,
            'expected_last': expected_words[-1] if expected_words else None,
            'heard_last': heard_words[-1] if heard_words else None,
        }
        out_records.append(rec)
        summary[classification] += 1
        classification_to_ids[classification].append(sid)

        if (idx + 1) % 25 == 0 or idx + 1 == n:
            elapsed = time.time() - t0
            rate = (idx + 1) / max(elapsed, 0.001)
            eta = (n - idx - 1) / max(rate, 0.001)
            print(f'  [{idx+1}/{n}] {classification:16s} {sid}  '
                  f'wer={wer:.2f}  rate={rate:.1f}/s  eta={eta:.0f}s',
                  flush=True)

    voice_rate = fit_voice_rate(out_records)
    if voice_rate is not None:
        for r in out_records:
            r['plausibility'] = classify_plausibility(r, voice_rate)
        CALIB_DIR.mkdir(parents=True, exist_ok=True)
        rate_path = CALIB_DIR / f'voice_rate_{LANG}.json'
        rate_path.write_text(json.dumps({
            'book_slug': BOOK_SLUG,
            'voice_id': VOICE_ID,
            'lang': LANG,
            'fitted_at': datetime.now(timezone.utc).isoformat(),
            'metric': 'sec_per_expected_char',
            'percentiles': voice_rate,
            'note': 'window fit from PASS-classified controls (>=30 chars). '
                    'Use p5*0.75 as OFF_SCRIPT_OR_TRUNCATED bound, [p5,p95] '
                    'as CONSISTENT_WITH_EXPECTED.',
        }, indent=2))
        print(f'\nvoice rate fit: p5={voice_rate["p5"]} '
              f'p50={voice_rate["p50"]} p95={voice_rate["p95"]} '
              f'(n={voice_rate["samples"]})')
        print(f'wrote {rate_path}')

    out_path = (
        Path(args.out) if args.out else
        PACK / 'audits' / LANG / f'transcription_audit_'
        f'{datetime.now(timezone.utc).strftime("%Y-%m-%d")}.json'
    )
    out_path.parent.mkdir(parents=True, exist_ok=True)

    payload = {
        'pack': str(PACK),
        'lang': LANG,
        'voice_id': VOICE_ID,
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'whisper_model': args.model,
        'allowance': allowance,
        'voice_rate': voice_rate,
        'summary': summary,
        'classification_to_ids': classification_to_ids,
        'records': out_records,
    }
    out_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False))
    print(f'\nwrote {out_path}', flush=True)
    print(f'summary: {summary}', flush=True)
    return 0


if __name__ == '__main__':
    sys.exit(main())
