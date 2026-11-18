"""Onsets, tails and non-speech sounds in a take (quality.py), on synthetic takes."""
import os
import sys
import unittest

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import quality as Q  # noqa: E402

SR = 44100
rng = np.random.default_rng(7)


def tone(seconds, db, hz=220.0):
    t = np.arange(int(seconds * SR)) / SR
    return (np.sin(2 * np.pi * hz * t) * np.sqrt(2) * 10 ** (db / 20)).astype(np.float32)


def hiss(seconds, db):
    return (rng.standard_normal(int(seconds * SR)) * 10 ** (db / 20)).astype(np.float32)


def room(seconds):
    return hiss(seconds, -70)


def rms(x):
    return float(np.sqrt(np.mean(x.astype(np.float64) ** 2))) if len(x) else 0.0


class Onset(unittest.TestCase):
    """'Take': a 60 ms aspirated T, then the vowel the aligner calls the word's start."""

    take = np.concatenate([room(0.3), hiss(0.06, -32), tone(0.5, -18), room(0.4)])
    burst, vowel = 0.30, 0.36

    def test_finds_the_consonant_before_a_late_aligned_start(self):
        on = Q.onset(self.take, SR, self.vowel + 0.04)
        self.assertLessEqual(on, self.burst + 0.005)
        self.assertGreaterEqual(on, self.burst - 0.03)

    def test_trim_keeps_the_consonant_and_fades_in_silence(self):
        out, _ = Q.trim(self.take, SR, self.vowel + 0.04, 0.86)
        a, b = int(self.burst * SR), int((self.burst + 0.08) * SR)
        kept = rms(out[a:b]) / rms(self.take[a:b])
        self.assertGreater(kept, 0.97)
        on = Q.onset(self.take, SR, self.vowel + 0.04)
        fade = out[int((on - Q.FADE_IN) * SR):int(on * SR)]
        self.assertLess(rms(fade), 10 ** (Q.SILENCE_DB / 20))


class Tail(unittest.TestCase):
    """A word, its 120 ms decay, then the drone Chatterbox V3 sometimes keeps making."""

    take = np.concatenate([room(0.2), tone(0.6, -18), tone(0.12, -40), room(0.05), tone(1.5, -30, hz=110), room(0.3)])
    last_end = 0.8

    def test_cuts_at_the_end_of_the_word_sound(self):
        off = Q.offset(self.take, SR, self.last_end)
        self.assertLessEqual(off, self.last_end + Q.TAIL_MAX)
        self.assertLess(off, 0.98)
        out, _ = Q.trim(self.take, SR, 0.2, self.last_end)
        self.assertLess(len(out) / SR, 0.98 + Q.FADE_OUT + 0.31)

    def test_reports_the_run_on(self):
        words = [{"word": "word", "start": 0.2, "end": self.last_end}]
        faults = Q.noises(self.take, SR, words)
        self.assertTrue(any("runs on" in f for f in faults), faults)

    def test_a_clean_take_has_no_faults(self):
        clean = np.concatenate([room(0.2), tone(0.6, -18), tone(0.12, -40), room(0.4)])
        self.assertEqual(Q.noises(clean, SR, [{"word": "word", "start": 0.2, "end": self.last_end}]), [])


class Stretched(unittest.TestCase):
    def test_a_last_word_stretched_over_a_drone_is_a_run_on_and_is_cut(self):
        # "sixths" aligned from 0.2 s to 3.9 s: 0.6 s of word, then the drone
        take = np.concatenate([room(0.2), tone(0.6, -18), room(0.05), tone(3.0, -32, hz=110), room(0.3)])
        words = [{"word": "sixths", "start": 0.2, "end": 3.9}]
        self.assertAlmostEqual(Q.speech_end(words), 0.2 + Q.longest(words[0]))
        faults = Q.noises(take, SR, words)
        self.assertTrue(any('"sixths" runs on' in f for f in faults), faults)
        out, _ = Q.trim(take, SR, 0.2, Q.speech_end(words))
        self.assertLess(len(out) / SR, 0.2 + Q.longest(words[0]) + Q.TAIL_MAX + Q.FADE_OUT + 0.31)


class Pause(unittest.TestCase):
    def test_reports_a_sound_in_a_pause_but_not_a_consonant_next_to_a_word(self):
        take = np.concatenate([room(0.2), tone(0.4, -18), room(0.3), tone(0.3, -28, hz=95), room(0.3), hiss(0.05, -30), tone(0.4, -18), room(0.3)])
        words = [{"word": "one", "start": 0.2, "end": 0.6}, {"word": "two", "start": 1.55, "end": 1.95}]
        faults = Q.noises(take, SR, words)
        self.assertEqual(len(faults), 1, faults)
        self.assertIn("in a pause at 0.9", faults[0])


if __name__ == "__main__":
    unittest.main()
