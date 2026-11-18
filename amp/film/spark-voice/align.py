"""Word timings by forced alignment: the script's words, placed in the take.

Vendored from ttsctl/asr_mms.py `align` (the Corpán narration pipeline's
primary aligner since its 2026-05-16 decision): facebook/mms-1b-all with the
English adapter, CTC log-probabilities, torchaudio.functional.forced_align over
the known words. Changes from ttsctl: the caller passes the words already
spelled as spoken (lower case, letters and apostrophes), audio arrives as an
array, and times are seconds.
"""
from __future__ import annotations

import re

import numpy as np

MODEL_ID = "facebook/mms-1b-all"
SR = 16000


class Aligner:
    def __init__(self, device: str = "cuda"):
        import torch
        from transformers import AutoProcessor, Wav2Vec2ForCTC

        self.torch = torch
        self.proc = AutoProcessor.from_pretrained(MODEL_ID)
        self.model = Wav2Vec2ForCTC.from_pretrained(MODEL_ID, ignore_mismatched_sizes=True).to(device).eval()
        self.proc.tokenizer.set_target_lang("eng")
        self.model.load_adapter("eng")

    def align(self, audio: np.ndarray, sr: int, words: list[str]) -> list[dict]:
        """One {word, start, end} per entry of `words`, in seconds. A word the
        aligner could not place gets zero length at the end of the audio, which
        the kit's checks then report."""
        import torchaudio.functional as F

        torch = self.torch
        clean = [re.sub(r"[^a-z']", "", w.lower()) for w in words]
        if not clean or any(not w for w in clean):
            raise ValueError("every word needs a letter")
        x = torch.from_numpy(audio.astype(np.float32)).unsqueeze(0)
        if sr != SR:
            x = F.resample(x, sr, SR)
        total = x.shape[1] / SR
        device = next(self.model.parameters()).device
        inputs = self.proc(x.squeeze(0).numpy(), sampling_rate=SR, return_tensors="pt").to(device)
        with torch.no_grad():
            logp = torch.log_softmax(self.model(**inputs).logits, dim=-1)
        frames = logp.shape[1]
        sec = total / frames
        tok = self.proc.tokenizer
        blank = tok.pad_token_id
        delim = tok.convert_tokens_to_ids("|")
        ids = tok.encode(" ".join(clean), add_special_tokens=False)
        while ids and ids[0] == delim:
            ids = ids[1:]
        while ids and ids[-1] == delim:
            ids = ids[:-1]
        if len(ids) > frames:
            raise ValueError("the take is too short for its words")
        path, _ = F.forced_align(logp, torch.tensor([ids], dtype=torch.int32, device=device), blank=blank)
        pos, cur, prev = [], -1, blank
        for t in path[0].tolist():
            if t == blank:
                pos.append(-1)
            else:
                if t != prev:
                    cur += 1
                pos.append(cur)
            prev = t
        first: dict[int, int] = {}
        last: dict[int, int] = {}
        for f, p in enumerate(pos):
            if p >= 0:
                first.setdefault(p, f)
                last[p] = f
        spans, start, end = [], None, -1
        for i, t in enumerate(ids):
            if t == delim:
                if start is not None:
                    spans.append((start, end))
                start = None
            else:
                start = i if start is None else start
                end = i
        if start is not None:
            spans.append((start, end))
        out = []
        for i, w in enumerate(words):
            a, b = spans[i] if i < len(spans) else (None, None)
            fa, fb = first.get(a), last.get(b)
            if fa is None or fb is None:
                out.append({"word": w, "start": round(total, 3), "end": round(total, 3)})
            else:
                out.append({"word": w, "start": round(fa * sec, 3), "end": round((fb + 1) * sec, 3)})
        return out
