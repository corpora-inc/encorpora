"""Journey pack pipeline tests (fixture-driven).

Run:  cd dja/journey_pack && python3 -m unittest discover -s tests -v
"""

from __future__ import annotations

import json
import shutil
import sqlite3
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
PKG = HERE.parent
sys.path.insert(0, str(PKG))

import build_journey_pack as b  # noqa: E402
import validate_journey_pack as v  # noqa: E402
from journey_common import (  # noqa: E402
    ALL_LANGUAGES,
    CORPAN_DIR,
    DJA_DIR,
    ItemRef,
    item_ref_key,
    load_activity_types,
    parse_item_ref,
)

FIXTURE_COURSE = PKG / "fixtures" / "course"
RECIPES = PKG / "recipes.yaml"
CORE_DB = DJA_DIR / "release.sqlite3"
PACKS_DIR = CORPAN_DIR / "tools" / "phrase-packs"


class ItemRefTests(unittest.TestCase):
    def test_round_trip(self) -> None:
        for s in (
            "phrase:base:2210",
            "word:en:water",
            "phoneme:journey_en:iː-ɪ",
            "grammarNode:journey_en:en.gn.be-statements",
            "segment:book_monte_alban:ch01-003",
            "char:hanzipan:好",
            "phrase:base:has:colons:in:id",
        ):
            ref = parse_item_ref(s)
            assert ref is not None
            self.assertEqual(item_ref_key(ref), s)

    def test_parse_splits_on_first_two_colons_only(self) -> None:
        ref = parse_item_ref("phrase:base:a:b:c")
        assert ref is not None
        self.assertEqual(ref.id, "a:b:c")

    def test_malformed(self) -> None:
        self.assertIsNone(parse_item_ref("nocolons"))
        self.assertIsNone(parse_item_ref("one:colon"))


class ActivityTypesTests(unittest.TestCase):
    def test_loaded_from_synced_copy(self) -> None:
        types = load_activity_types()
        # the ten feed-ux renderers (CTO-RESOLUTIONS R4)
        self.assertEqual(len(types), 10)
        for expected in ("choice_pick", "listen_pick", "listen_type", "cloze",
                         "word_order", "match_pairs", "flip_recall",
                         "speak_echo", "intro_echo", "grammar_note"):
            self.assertIn(expected, types)


class PipelineTests(unittest.TestCase):
    """Build the fixture once, then validate + tamper."""

    tmp: Path

    @classmethod
    def setUpClass(cls) -> None:
        cls.tmp = Path(tempfile.mkdtemp(prefix="journey_pack_test_"))
        cls.zip_path = b.build(
            "en", FIXTURE_COURSE, CORE_DB, PACKS_DIR, RECIPES,
            cls.tmp, skip_validate=True,
        )

    @classmethod
    def tearDownClass(cls) -> None:
        shutil.rmtree(cls.tmp, ignore_errors=True)

    def _validate(self, dist: Path) -> list:
        return v.validate(
            target="en", course_dir=FIXTURE_COURSE, dist_dir=dist,
            core_db=CORE_DB, packs_dir=PACKS_DIR, recipes_path=RECIPES,
        )

    def test_all_gates_run_and_pass(self) -> None:
        report = self._validate(self.tmp)
        self.assertEqual([g.id for g in report], [f"V-{i}" for i in range(1, 25)])
        self.assertFalse(v.has_errors(report),
                         [f"{g.id}: {g.errors}" for g in report if g.errors])

    def test_opener_is_communicative_first_v23(self) -> None:
        # The fixture opener (lowest-index launchpad unit) LEADS with
        # communicative words/phrases; phonemes trail and stay a minority.
        db = sqlite3.connect(self.tmp / "journey_en" / "data" / "course.sqlite3")
        opener = db.execute(
            "SELECT u.id FROM units u JOIN arcs a ON a.id = u.arc_id "
            "WHERE a.arc_index = 0 ORDER BY u.unit_index LIMIT 1"
        ).fetchone()[0]
        kinds = [r[0] for r in db.execute(
            "SELECT kind FROM items WHERE unit_id = ? ORDER BY intro_order", (opener,))]
        db.close()
        self.assertTrue(kinds)
        # the LEADING window the learner meets is communicative (word/phrase)
        self.assertTrue(all(k in ("phrase", "word") for k in kinds[:5]), kinds[:5])
        # phonemes are a minority (<=50%) and at least two real phrases exist
        self.assertLessEqual(kinds.count("phoneme"), 0.5 * len(kinds))
        self.assertGreaterEqual(kinds.count("phrase"), 2)

    def test_phoneme_lead_fails_v23(self) -> None:
        # Force a phoneme to the FRONT of the opener's intro_order — the learner
        # would meet minimal-pair drilling first. V-23 must reject it.
        dist2 = self.tmp / "phoneme_lead"
        shutil.copytree(self.tmp / "journey_en", dist2 / "journey_en")
        shutil.copy(self.zip_path, dist2 / self.zip_path.name)
        db = sqlite3.connect(dist2 / "journey_en" / "data" / "course.sqlite3")
        opener = db.execute(
            "SELECT u.id FROM units u JOIN arcs a ON a.id = u.arc_id "
            "WHERE a.arc_index = 0 ORDER BY u.unit_index LIMIT 1"
        ).fetchone()[0]
        # Give the opener's phoneme items the earliest intro_orders (negative),
        # so the leading window is all phonemes.
        phon = [r[0] for r in db.execute(
            "SELECT id FROM items WHERE unit_id = ? AND kind='phoneme'", (opener,))]
        self.assertTrue(phon, "fixture opener has no phoneme to hoist")
        for i, pid in enumerate(phon):
            db.execute("UPDATE items SET intro_order = ? WHERE id = ?", (-100 + i, pid))
        db.commit()
        db.close()
        report = self._validate(dist2)
        v23 = next(g for g in report if g.id == "V-23")
        self.assertTrue(
            any("non-communicative" in e for e in v23.errors), v23.errors)

    def test_phoneme_dominated_opener_fails_v23(self) -> None:
        # An opener that is >50% phoneme items is backwards even in a
        # single-launchpad course. Delete the opener's communicative items down
        # to a phoneme-dominated remainder and re-validate.
        dist2 = self.tmp / "phoneme_heavy"
        shutil.copytree(self.tmp / "journey_en", dist2 / "journey_en")
        shutil.copy(self.zip_path, dist2 / self.zip_path.name)
        db = sqlite3.connect(dist2 / "journey_en" / "data" / "course.sqlite3")
        opener = db.execute(
            "SELECT u.id FROM units u JOIN arcs a ON a.id = u.arc_id "
            "WHERE a.arc_index = 0 ORDER BY u.unit_index LIMIT 1"
        ).fetchone()[0]
        # Re-home all but one communicative item OUT of the opener (into an
        # arc-1 unit) so phonemes dominate — without deleting rows (which would
        # dangle lesson/probe refs and trip other gates).
        keep = db.execute(
            "SELECT id FROM items WHERE unit_id = ? AND kind IN ('word','phrase') "
            "ORDER BY intro_order LIMIT 1", (opener,)).fetchone()[0]
        db.execute(
            "UPDATE items SET unit_id = 'en.a1.u02' "
            "WHERE unit_id = ? AND kind IN ('word','phrase') AND id != ?",
            (opener, keep))
        db.commit()
        db.close()
        report = self._validate(dist2)
        v23 = next(g for g in report if g.id == "V-23")
        self.assertTrue(any("50%" in e for e in v23.errors), v23.errors)

    def test_degenerate_single_token_phrase_fails_v24(self) -> None:
        # A phrase item whose target text is a single token produces a
        # degenerate cloze/word_order — V-24 must catch it. Point an existing
        # phrase item at a base entry whose en face is one word ("Bye!").
        db = sqlite3.connect(self.tmp / "journey_en" / "data" / "course.sqlite3")
        one_word = db.execute(
            "SELECT ref_id FROM items WHERE kind='phrase' AND source='base' "
            "ORDER BY intro_order LIMIT 1").fetchone()[0]
        db.close()
        # Craft the hole in a throwaway corpus copy: overwrite that entry's en
        # face with a single token, so V-24 sees a one-token phrase target.
        corpus_copy = self.tmp / "corpus_one_token.sqlite3"
        shutil.copy(CORE_DB, corpus_copy)
        cdb = sqlite3.connect(corpus_copy)
        en_id = cdb.execute(
            "SELECT id FROM cor_language WHERE code='en'").fetchone()[0]
        cdb.execute(
            "UPDATE cor_translation SET text = 'Bye' "
            "WHERE entry_id = ? AND language_id = ?", (int(one_word), en_id))
        cdb.commit()
        cdb.close()
        report = v.validate(
            target="en", course_dir=FIXTURE_COURSE, dist_dir=self.tmp,
            core_db=corpus_copy, packs_dir=PACKS_DIR, recipes_path=RECIPES,
        )
        v24 = next(g for g in report if g.id == "V-24")
        self.assertTrue(
            any(f"phrase:base:{one_word}" in e for e in v24.errors), v24.errors)

    def test_word_glosses_present_v21(self) -> None:
        # Every word item carries wg.<word> in en + es (l1_full_support).
        db = sqlite3.connect(self.tmp / "journey_en" / "data" / "course.sqlite3")
        words = [r[0] for r in db.execute(
            "SELECT ref_id FROM items WHERE kind = 'word'")]
        self.assertTrue(words)
        for w in words:
            for lang in ("en", "es"):
                row = db.execute(
                    "SELECT 1 FROM strings WHERE key = ? AND lang = ?",
                    (f"wg.{w}", lang),
                ).fetchone()
                self.assertIsNotNone(row, f"wg.{w} missing in {lang}")
        # l1_full_support rode into pack_meta for the validator to read.
        meta = {r[0]: r[1] for r in db.execute("SELECT * FROM pack_meta")}
        self.assertEqual(meta.get("l1_full_support"), "es")
        db.close()

    def test_missing_word_gloss_fails_v21(self) -> None:
        dist2 = self.tmp / "gloss_hole"
        shutil.copytree(self.tmp / "journey_en", dist2 / "journey_en")
        shutil.copy(self.zip_path, dist2 / self.zip_path.name)
        db = sqlite3.connect(dist2 / "journey_en" / "data" / "course.sqlite3")
        # Drop one word's es gloss — the native-only lookup has no en fallback,
        # so this is a real hole, not a soft degrade.
        w = db.execute("SELECT ref_id FROM items WHERE kind='word' LIMIT 1").fetchone()[0]
        db.execute("DELETE FROM strings WHERE key = ? AND lang = 'es'", (f"wg.{w}",))
        db.commit()
        db.close()
        report = self._validate(dist2)
        v21 = next(g for g in report if g.id == "V-21")
        self.assertTrue(any("es" in e for e in v21.errors), v21.errors)

    def test_missing_phrase_translation_fails_v22(self) -> None:
        # The bundled corpus is es-complete, so craft the hole in a THROWAWAY
        # corpus copy: remove one course phrase's es row, then validate the
        # (unchanged) pack against that copy. The entry still exists (V-1
        # passes) — only its es translation is gone, isolating V-22.
        db = sqlite3.connect(self.tmp / "journey_en" / "data" / "course.sqlite3")
        target_eid = int(db.execute(
            "SELECT ref_id FROM items WHERE kind='phrase' AND source='base' "
            "ORDER BY intro_order LIMIT 1").fetchone()[0])
        db.close()
        corpus_copy = self.tmp / "corpus_no_es.sqlite3"
        shutil.copy(CORE_DB, corpus_copy)
        cdb = sqlite3.connect(corpus_copy)
        es_id = cdb.execute(
            "SELECT id FROM cor_language WHERE code='es'").fetchone()[0]
        cdb.execute(
            "DELETE FROM cor_translation WHERE entry_id = ? AND language_id = ?",
            (target_eid, es_id))
        cdb.commit()
        cdb.close()
        report = v.validate(
            target="en", course_dir=FIXTURE_COURSE, dist_dir=self.tmp,
            core_db=corpus_copy, packs_dir=PACKS_DIR, recipes_path=RECIPES,
        )
        v22 = next(g for g in report if g.id == "V-22")
        self.assertTrue(
            any(f"phrase:base:{target_eid}" in e for e in v22.errors), v22.errors)

    def test_pack_shape(self) -> None:
        db = sqlite3.connect(self.tmp / "journey_en" / "data" / "course.sqlite3")
        n_items = db.execute("SELECT COUNT(*) FROM items").fetchone()[0]
        self.assertGreaterEqual(n_items, 35)  # "~40 items" fixture
        langs = {r[0] for r in db.execute("SELECT DISTINCT lang FROM strings")}
        self.assertEqual(langs, set(ALL_LANGUAGES))
        # intro_order is dense 1..N (keyset pagination + per-arc ranges rely on it)
        orders = [r[0] for r in db.execute(
            "SELECT intro_order FROM items ORDER BY intro_order")]
        self.assertEqual(orders, list(range(1, n_items + 1)))
        # deterministic: every items.id round-trips (V-15 contract test)
        for (iid,) in db.execute("SELECT id FROM items"):
            ref = parse_item_ref(iid)
            assert ref is not None
            self.assertEqual(item_ref_key(ref), iid)
        db.close()

    def test_meta_tamper_fails_v18(self) -> None:
        dist2 = self.tmp / "tampered"
        shutil.copytree(self.tmp / "journey_en", dist2 / "journey_en")
        shutil.copy(self.zip_path, dist2 / self.zip_path.name)
        db = sqlite3.connect(dist2 / "journey_en" / "data" / "course.sqlite3")
        db.execute("UPDATE pack_meta SET value = '999' WHERE key = 'item_count'")
        db.commit()
        db.close()
        report = self._validate(dist2)
        v18 = next(g for g in report if g.id == "V-18")
        self.assertTrue(v18.errors)

    def test_removed_item_requires_major_bump_v17(self) -> None:
        # Craft a "previous" 0.0.0 zip that carries one EXTRA item; validating
        # 0.0.1 must then error (an items.id was removed without a MAJOR bump).
        dist2 = self.tmp / "immutability"
        shutil.copytree(self.tmp / "journey_en", dist2 / "journey_en")
        shutil.copy(self.zip_path, dist2 / self.zip_path.name)
        with tempfile.TemporaryDirectory() as td:
            with zipfile.ZipFile(self.zip_path) as zf:
                zf.extractall(td)
            db = sqlite3.connect(Path(td) / "data" / "course.sqlite3")
            db.execute(
                "INSERT INTO items (id,kind,source,ref_id,unit_id,intro_order,"
                "difficulty_b,importance,is_probe,substitutable,freq_rank,text_len) "
                "VALUES ('phrase:base:999999','phrase','base','999999',"
                "'en.a1.u02',100000,-3.0,2,0,0,NULL,10)"
            )
            db.commit()
            db.close()
            prev_zip = dist2 / "journey_en-0.0.0.zip"
            with zipfile.ZipFile(prev_zip, "w", zipfile.ZIP_DEFLATED) as zf:
                zf.write(Path(td) / "manifest.json", "manifest.json")
                zf.write(Path(td) / "data" / "course.sqlite3", "data/course.sqlite3")
        report = self._validate(dist2)
        v17 = next(g for g in report if g.id == "V-17")
        self.assertTrue(any("removed" in e for e in v17.errors), v17.errors)

    def test_banned_copy_fails_v13(self) -> None:
        dist2 = self.tmp / "copyhygiene"
        shutil.copytree(self.tmp / "journey_en", dist2 / "journey_en")
        shutil.copy(self.zip_path, dist2 / self.zip_path.name)
        db = sqlite3.connect(dist2 / "journey_en" / "data" / "course.sqlite3")
        db.execute(
            "UPDATE strings SET text = 'Works offline forever, guaranteed.' "
            "WHERE key = 'unit.en.a1.u02.theme' AND lang = 'en'"
        )
        db.commit()
        db.close()
        report = self._validate(dist2)
        v13 = next(g for g in report if g.id == "V-13")
        self.assertTrue(v13.errors)


if __name__ == "__main__":
    unittest.main()
