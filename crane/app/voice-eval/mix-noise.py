"""Mix crane-site noise into the clean clips at fixed signal-to-noise ratios.

    python3 -I mix-noise.py IN_DIR OUT_DIR SNR_DB [SNR_DB ...]

Writes OUT_DIR/snr<N>/<clip>.wav for every IN_DIR/*.wav (16 kHz mono int16). The
noise stands in for a running crane: a diesel engine (firing harmonics around
28 Hz with a slow throttle wobble), brown rumble, and a faint hydraulic whine,
with half a second of noise before and after the speech, as a push-to-talk
recording has. SNR is computed over the speech samples only. Deterministic:
each clip's noise is seeded from its file name. Standard library only.
"""

from __future__ import annotations

import array
import hashlib
import math
import random
import sys
import wave
from pathlib import Path

RATE = 16000
PAD = RATE // 2


def read(path: Path) -> array.array:
    with wave.open(str(path)) as w:
        assert w.getframerate() == RATE and w.getnchannels() == 1 and w.getsampwidth() == 2, path
        a = array.array("h")
        a.frombytes(w.readframes(w.getnframes()))
        return a


def write(path: Path, samples: list[float]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    out = array.array("h", (max(-32768, min(32767, int(round(s)))) for s in samples))
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(out.tobytes())


def engine_noise(n: int, seed: str) -> list[float]:
    rng = random.Random(hashlib.sha256(seed.encode()).hexdigest())
    f0 = 26.0 + rng.random() * 6.0  # firing frequency, Hz
    phases = [rng.random() * 2 * math.pi for _ in range(8)]
    brown = 0.0
    out = []
    for i in range(n):
        t = i / RATE
        throttle = 1.0 + 0.15 * math.sin(2 * math.pi * 0.7 * t + phases[0])
        hum = sum((0.9 / k) * math.sin(2 * math.pi * f0 * k * throttle * t + phases[k]) for k in range(1, 7))
        brown = 0.995 * brown + rng.gauss(0, 1) * 0.1
        whine = 0.05 * math.sin(2 * math.pi * 1840 * t + phases[7])
        out.append(hum + 3.0 * brown + whine + 0.08 * rng.gauss(0, 1))
    return out


def rms(xs) -> float:
    return math.sqrt(sum(x * x for x in xs) / max(1, len(xs)))


def main() -> None:
    src, dst, snrs = Path(sys.argv[1]), Path(sys.argv[2]), [float(s) for s in sys.argv[3:]]
    for wav in sorted(src.glob("*.wav")):
        speech = [float(s) for s in read(wav)]
        s_rms = rms(speech)
        noise = engine_noise(len(speech) + 2 * PAD, wav.name)
        n_rms = rms(noise[PAD : PAD + len(speech)])
        padded = [0.0] * PAD + speech + [0.0] * PAD
        for snr in snrs:
            gain = s_rms / (n_rms * 10 ** (snr / 20))
            mixed = [p + gain * q for p, q in zip(padded, noise)]
            peak = max(abs(x) for x in mixed)
            scale = 0.9 * 32767 / peak if peak > 0.9 * 32767 else 1.0
            write(dst / f"snr{int(snr)}" / wav.name, [x * scale for x in mixed])


if __name__ == "__main__":
    main()
