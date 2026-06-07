"""sherpa-onnx adapters for Parakeet-TDT-0.6b-v3 and SenseVoice-Small.

Both ride ONE onnxruntime (the masterplan's `asr-sherpa` "two models, one
native lib" mitigation). Non-autoregressive decode → cheap on Android CPU,
which is exactly where Whisper's autoregressive loop hurts (15–25 s for a
short clip). We weight these UP in the Android ranking.

- Parakeet-TDT-0.6b-v3: 25 European languages, CC-BY-4.0. sherpa-onnx model
  id `sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8` (offline transducer).
- SenseVoice-Small: zh/yue/en/ja/ko, beats Whisper on Cantonese/CJK. License
  is "other"/model-license — AMBIGUOUS, a SHIPPING GATE. We benchmark it to
  quantify the win, but the report must flag: do not ship until legal clears.

Model dirs are passed via opts (downloaded by fetch_models.sh into
models/). Each is a directory containing the onnx + tokens files sherpa
expects. We point sherpa at them with the offline recognizer factory helpers.
"""

from __future__ import annotations

import os

from .base import Adapter


class ParakeetAdapter(Adapter):
    engine_id = "parakeet"

    def _load(self, lang_code: str) -> None:
        if getattr(self, "_rec", None) is not None:
            return
        import sherpa_onnx  # lazy

        d = self.opts["model_dir"]  # the parakeet-tdt-v3-int8 dir
        self._rec = sherpa_onnx.OfflineRecognizer.from_transducer(
            encoder=os.path.join(d, "encoder.int8.onnx"),
            decoder=os.path.join(d, "decoder.int8.onnx"),
            joiner=os.path.join(d, "joiner.int8.onnx"),
            tokens=os.path.join(d, "tokens.txt"),
            num_threads=self.opts.get("num_threads", 4),
            model_type="nemo_transducer",
        )

    def _transcribe(self, wav_path: str, lang_code: str) -> str:
        return _decode(self._rec, wav_path)


class SenseVoiceAdapter(Adapter):
    engine_id = "sensevoice"

    def _load(self, lang_code: str) -> None:
        if getattr(self, "_rec", None) is not None:
            return
        import sherpa_onnx  # lazy

        d = self.opts["model_dir"]  # the sensevoice dir
        self._rec = sherpa_onnx.OfflineRecognizer.from_sense_voice(
            model=os.path.join(d, "model.int8.onnx"),
            tokens=os.path.join(d, "tokens.txt"),
            num_threads=self.opts.get("num_threads", 4),
            use_itn=False,
        )

    def _transcribe(self, wav_path: str, lang_code: str) -> str:
        return _decode(self._rec, wav_path)


def _decode(recognizer, wav_path: str) -> str:
    """Shared sherpa-onnx offline decode: read wav → stream → result.text."""
    import sherpa_onnx
    import soundfile as sf

    samples, sample_rate = sf.read(wav_path, dtype="float32", always_2d=False)
    if hasattr(samples, "ndim") and samples.ndim > 1:
        samples = samples[:, 0]  # mono
    stream = recognizer.create_stream()
    stream.accept_waveform(sample_rate, samples)
    recognizer.decode_stream(stream)
    return (stream.result.text or "").strip()
