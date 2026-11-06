"""Find a tempo and a downbeat so a music bed can start and end on the beat.

Instagram replays the file from the top. A bed that starts and ends on a
downbeat, with a short edge fade, does not click when that replay arrives.
Narration is not looped. Only the music grid is.
"""
import array
import subprocess


def _envelope(path, start, seconds, rate=8000):
    raw = subprocess.check_output([
        "ffmpeg", "-v", "error", "-ss", f"{start:.3f}", "-t", f"{seconds:.3f}",
        "-i", str(path), "-ac", "1", "-ar", str(rate), "-f", "f32le", "-",
    ])
    samples = array.array("f")
    samples.frombytes(raw[: len(raw) - (len(raw) % 4)])
    hop = 160  # 20 ms
    env = []
    for i in range(0, len(samples) - hop, hop):
        env.append(sum(abs(samples[i + j]) for j in range(hop)) / hop)
    return env, rate / hop


def estimate_bpm(path, start=0.0, seconds=24.0):
    """Return (bpm, seconds_to_first_downbeat) inside the analysed window."""
    env, hop_hz = _envelope(path, start, seconds)
    if len(env) < 32:
        raise ValueError("not enough audio to estimate a tempo")
    mean = sum(env) / len(env)
    centered = [v - mean for v in env]
    def score_at(lag):
        if lag < 1 or lag >= len(centered):
            return -1.0
        return sum(centered[i] * centered[i + lag] for i in range(len(centered) - lag))

    best_lag, best = 0, -1.0
    lo = int(hop_hz * 60 / 180)  # 180 BPM
    hi = int(hop_hz * 60 / 70)   # 70 BPM
    for lag in range(max(1, lo), min(len(centered) // 2, hi) + 1):
        score = score_at(lag)
        if score > best:
            best, best_lag = score, lag
    if best_lag == 0:
        raise ValueError("no tempo found")
    # A slow lag often wins on every other beat. Check the lags around half, not only integer division.
    half_lag, half_score = 0, -1.0
    for lag in range(max(lo, best_lag // 2 - 1), min(hi, best_lag // 2 + 2) + 1):
        score = score_at(lag)
        bpm_candidate = 60.0 * hop_hz / lag
        if score > half_score and 90 <= bpm_candidate <= 170:
            half_lag, half_score = lag, score
    if half_lag and half_score >= 0.8 * best:
        best_lag = half_lag
    period = best_lag / hop_hz
    bpm = 60.0 / period
    # Phase: average energy just after each beat, slide across one period.
    width = max(1, best_lag // 8)
    phase, phase_score = 0, -1.0
    for offset in range(best_lag):
        score = 0.0
        i = offset
        while i + width < len(env):
            score += sum(env[i:i + width])
            i += best_lag
        if score > phase_score:
            phase, phase_score = offset, score
    return round(bpm, 2), phase / hop_hz


def snap_to_bars(bpm, downbeat, offset, duration, beats_per_bar=4):
    """Move the start onto a downbeat and keep a whole number of bars.

    `downbeat` is seconds after `offset` was analysed, so pass the analysis
    start as `offset` and the downbeat returned for that window.
    """
    bar = beats_per_bar * 60.0 / bpm
    start = offset + downbeat
    # Walk back to the downbeat at or before the requested offset, and never before the file.
    while start - bar >= 0 and start > offset + 1e-6:
        start -= bar
    if start < 0:
        start += bar
    bars = max(1, round(duration / bar))
    return {"bpm": bpm, "bar": bar, "offset": start, "duration": bars * bar}
