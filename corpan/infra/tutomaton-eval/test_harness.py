"""Unit tests for the harness logic that does NOT need the model.

Crucially asserts our ChatML string is byte-identical to the plugin's
format_chatml (state.rs), and that the metric gates behave on hand-built
strings. Run: python3 test_harness.py
"""

import unittest

import metrics
import prompts
from langs import by_code

ACUTE = chr(0x301)  # combining acute accent (a Mark, category Mn)


class TestChatML(unittest.TestCase):
    def test_matches_plugin_format(self):
        # Plugin: <|im_start|>{role}\n{content}<|im_end|>\n ... assistant\n
        msgs = [{"role": "system", "content": "SYS"},
                {"role": "user", "content": "hi"}]
        got = prompts.format_chatml(msgs)
        want = ("<|im_start|>system\nSYS<|im_end|>\n"
                "<|im_start|>user\nhi<|im_end|>\n"
                "<|im_start|>assistant\n")
        self.assertEqual(got, want)

    def test_system_content_adds_native_line(self):
        te = by_code("te")
        sc = prompts.system_content(te, "PROMPT", "English")
        self.assertIn("PROMPT", sc)
        self.assertIn("Learner's native language: English.", sc)


class TestScrub(unittest.TestCase):
    def test_strips_think_and_markdown(self):
        s = "<think>plan</think>**Hola** `code` [t](u)"
        self.assertEqual(metrics.scrub(s), "Hola code t")

    def test_strips_orphan_combining_marks(self):
        # A combining acute after a space (no base) is the dotted-circle
        # artifact and must go; an attached one (decomposed é) must stay.
        orphan = "ok " + ACUTE + "done"
        self.assertNotIn(ACUTE, metrics.scrub(orphan))
        attached = "e" + ACUTE + "cole"
        self.assertIn(ACUTE, metrics.scrub(attached))

    def test_template_leak_detected_in_raw(self):
        sc = metrics.score_reply("hello <|im_start|>", by_code("en"))
        self.assertTrue(sc.template_leak)


class TestScriptCoverage(unittest.TestCase):
    def test_telugu_text_in_script(self):
        te = by_code("te")
        cov, leak, cnt = metrics.script_coverage("నమస్కారం బాగున్నారా", te.scripts)
        self.assertGreater(cov, 0.95)
        self.assertEqual(leak, 0.0)
        self.assertGreaterEqual(cnt, 10)

    def test_english_fails_telugu_script(self):
        te = by_code("te")
        cov, leak, cnt = metrics.script_coverage("Hello how are you", te.scripts)
        self.assertEqual(cov, 0.0)
        self.assertGreater(leak, 0.9)
        self.assertEqual(cnt, 0)

    def test_repetition_loop(self):
        loop = "thank you " * 20
        self.assertGreater(metrics.repetition(loop), 0.8)
        varied = "the quick brown fox jumps over the lazy dog near a river bank"
        self.assertLess(metrics.repetition(varied), 0.2)


class TestScoreGate(unittest.TestCase):
    def test_telugu_good_reply_passes(self):
        te = by_code("te")
        sc = metrics.score_reply("నమస్కారం! ఈరోజు మనం తెలుగు నేర్చుకుందాం.", te)
        self.assertTrue(sc.passed, sc.to_dict())

    def test_telugu_english_reply_fails(self):
        te = by_code("te")
        sc = metrics.score_reply("Good morning! Let's learn Telugu today.", te)
        self.assertFalse(sc.passed)

    def test_refusal_fails(self):
        en = by_code("en")
        sc = metrics.score_reply("I'm sorry, but I cannot help with that.", en)
        self.assertFalse(sc.passed)


if __name__ == "__main__":
    unittest.main(verbosity=2)
