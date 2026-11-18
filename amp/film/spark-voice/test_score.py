"""Choosing the best take of a line (score.py)."""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from score import best, errors, spoken  # noqa: E402


class Spoken(unittest.TestCase):
    def test_reads_whisper_digits_as_words(self):
        self.assertEqual(spoken("48 tiles, 2.5 m, 100%"), ["forty", "eight", "tiles", "two", "point", "five", "m", "one", "hundred", "percent"])
        self.assertEqual(spoken("Let's add 1,200."), ["let's", "add", "one", "thousand", "two", "hundred"])

    def test_counts_word_errors_against_the_script(self):
        want = ["five", "sixths", "and", "that", "makes", "sense"]
        self.assertEqual(errors(want, "Five sixths, and that makes sense."), 0)
        self.assertEqual(errors(want, "5 sixths that makes sense"), 0)
        self.assertEqual(errors(want, "Five sixes. That makes sense, even one"), 3)


class Best(unittest.TestCase):
    def clean(self, **kw):
        return {"errors": 0, "noises": [], "utmos": 3.8, "similarity": 0.9, "wps": 2.8, **kw}

    def test_a_wrong_word_or_a_noise_loses_to_a_clean_take(self):
        self.assertEqual(best([self.clean(errors=1, utmos=4.4), self.clean()]), 1)
        self.assertEqual(best([self.clean(noises=["a sound"], similarity=0.95), self.clean()]), 1)

    def test_among_clean_takes_naturalness_similarity_and_pace_decide(self):
        self.assertEqual(best([self.clean(), self.clean(utmos=4.2)]), 1)
        self.assertEqual(best([self.clean(wps=4.0), self.clean()], pace=2.8), 1)
        self.assertEqual(best([self.clean(), self.clean()]), 0)


if __name__ == "__main__":
    unittest.main()
