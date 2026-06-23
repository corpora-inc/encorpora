#!/usr/bin/env python3
"""Statistical transcription audit for the Zheng EN narration pack.

For each segment in segments.json, free-transcribes the corresponding
audio with Whisper (large-v3 cuda) and compares to the expected display
text using:
  - sequence-aware word edit distance (WER)
  - strict first-word match
  - strict last-word match

Allowance table is built from pack/pronunciation_tests/en/results.json
verdicts so that approved respellings (Qing -> Ching) don't show as
defects when the Whisper-heard form matches the verdict.

Output: pack/audits/<lang>/transcription_audit_<date>.json with one
record per segment + a summary block.

Run:
    /home/skyl/tts_venv/bin/python scripts/audit_transcription_en.py
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path

PACK = Path('/home/skyl/encorpora/books/history/pirate-biographies/01-zheng-yi-sao/pack')
LANG = 'en'

PUNCT_RE = re.compile(r"[^a-z0-9]+")


def normalize_word(w: str) -> str:
    return PUNCT_RE.sub("", w.lower())


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
    """Map normalized expected-word -> normalized accepted-replacement.

    Built from pronunciation_tests/<lang>/results.json verdicts of type
    'replace'. Both directions are recorded so that whichever the Whisper
    transcript captures (the original spelling or the respelling), we
    consider it an allowed match.
    """
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


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--limit', type=int, default=None,
                    help='process only the first N segments (debug)')
    ap.add_argument('--out', default=None,
                    help='output path (default: pack/audits/<lang>/transcription_audit_<date>.json)')
    ap.add_argument('--device', default='cuda')
    ap.add_argument('--model', default='large-v3')
    ap.add_argument('--audio-dir', default=None,
                    help='override audio directory (default pack/audio/<lang>/)')
    args = ap.parse_args()

    seg_doc = json.loads((PACK / 'segments.json').read_text())
    segments = seg_doc['segments']
    if args.limit:
        segments = segments[: args.limit]

    allowance = load_allowance()
    print(f'allowance entries: {len(allowance)} (Qing<->Ching expected)', flush=True)

    print(f'loading whisper {args.model} on {args.device}…', flush=True)
    sys.path.insert(0, '/home/skyl/projects/ttsctl')
    from ttsctl.aligner import load_aligner  # noqa: E402

    model = load_aligner(args.model, args.device)
    print('whisper loaded', flush=True)

    audio_dir = Path(args.audio_dir) if args.audio_dir else (PACK / 'audio' / LANG)
    wav_dir = audio_dir / 'wav'

    out_records: list[dict] = []
    summary = {
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

        # Locate audio: prefer wav, fall back to m4a (ffmpeg-decode to tempfile)
        wav_path = wav_dir / f'{sid}.wav'
        m4a_path = audio_dir / f'{sid}.m4a'

        tmp_wav = None
        try:
            if wav_path.exists():
                use_path = str(wav_path)
            elif m4a_path.exists():
                tmp = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
                tmp.close()
                tmp_wav = Path(tmp.name)
                decode_to_wav(m4a_path, tmp_wav)
                use_path = str(tmp_wav)
            else:
                rec = {
                    'seg_id': sid, 'expected': expected_text, 'heard': None,
                    'wer': None, 'first_word_match': None, 'last_word_match': None,
                    'classification': 'NO_AUDIO',
                }
                out_records.append(rec)
                summary['NO_AUDIO'] += 1
                classification_to_ids['NO_AUDIO'].append(sid)
                continue

            # Free transcription
            try:
                result = model.transcribe(use_path, language=LANG, verbose=False)
                heard_text = (result.text or '').strip()
            except Exception as e:  # pragma: no cover
                heard_text = ''
                print(f'  {sid}: transcribe ERR {e}', flush=True)
        finally:
            if tmp_wav is not None:
                try:
                    tmp_wav.unlink()
                except FileNotFoundError:
                    pass

        heard_words = normalize_words(heard_text)
        n_exp = len(expected_words)
        wer = levenshtein_words(expected_words, heard_words) / max(n_exp, 1)

        # First/last word match (with allowance)
        def words_equal(exp: str, heard: str) -> bool:
            if exp == heard:
                return True
            if allowance.get(exp) == heard:
                return True
            return False

        first_match = (
            bool(expected_words) and bool(heard_words)
            and words_equal(expected_words[0], heard_words[0])
        )
        last_match = (
            bool(expected_words) and bool(heard_words)
            and words_equal(expected_words[-1], heard_words[-1])
        )

        # Classify
        if not heard_words:
            classification = 'WER_HIGH'  # treat empty-transcript as defect
        elif not first_match:
            classification = 'FIRST_WORD_MISS'
        elif not last_match:
            classification = 'LAST_WORD_MISS'
        elif wer >= 0.30:
            classification = 'WER_HIGH'
        elif wer >= 0.15:
            classification = 'BORDERLINE'
        elif wer >= 0.05:
            # Mid-range that the existing set-overlap might pass: borderline
            # only if set-overlap also passes (this is a refinement signal).
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

    out_path = (
        Path(args.out) if args.out else
        PACK / 'audits' / LANG / f'transcription_audit_{datetime.now(timezone.utc).strftime("%Y-%m-%d")}.json'
    )
    out_path.parent.mkdir(parents=True, exist_ok=True)

    payload = {
        'pack': str(PACK),
        'lang': LANG,
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'whisper_model': args.model,
        'allowance': allowance,
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
