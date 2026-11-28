"""Structural tests for crane/content. Run: python -m unittest discover -s crane/content/verify

Citation and quote checks need the eCFR index (built on first use, network);
they are skipped when HARVEST_OFFLINE=1 and no cached index exists.
"""

from __future__ import annotations

import json
import os
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
CONTENT = HERE.parent
sys.path.insert(0, str(HERE))

import yaml  # noqa: E402

import ecfr  # noqa: E402
import verify  # noqa: E402

BLUEPRINT = yaml.safe_load((CONTENT / "blueprint.yaml").read_text())


def index_available() -> bool:
    return (ecfr.CACHE / "sections.json").exists() or os.environ.get("HARVEST_OFFLINE") != "1"


class Blueprint(unittest.TestCase):
    def skills(self):
        return [s for t in BLUEPRINT["topics"] for s in t["skills"]]

    def test_unique_ids(self):
        tids = [t["topic_id"] for t in BLUEPRINT["topics"]]
        sids = [s["skill_id"] for s in self.skills()]
        self.assertEqual(len(tids), len(set(tids)))
        self.assertEqual(len(sids), len(set(sids)), [s for s in sids if sids.count(s) > 1])

    def test_exam_refs_valid_and_outline_covered(self):
        outline = {}
        for e in BLUEPRINT["exams"]:
            outline.update(e.get("outline", {}))
        used = set()
        for s in self.skills():
            for ref in s.get("exam", []):
                self.assertIn(ref, outline, s["skill_id"])
                used.add(ref)
        self.assertEqual(sorted(set(outline) - used), [], "outline items with no skill")

    def test_exams_json_matches_blueprint_and_handbook(self):
        """The mock exam and the instructor read exams.json; it must say what the handbook says."""
        exams = {e["id"]: e for e in json.loads((CONTENT / "exams.json").read_text())}
        for e in BLUEPRINT["exams"]:
            if not e.get("outline"):
                continue
            j = exams[e["exam_id"]]
            self.assertEqual(j["items"], e["items"], e["exam_id"])
            self.assertEqual(sum(d["count"] for d in j["domains"]), e["items"], e["exam_id"])
            self.assertEqual(j["minutes"], e["minutes"])
            self.assertEqual({d["id"]: d["weight"] for d in j["domains"]}, {d["domain_id"]: d["weight"] for d in e["domains"]})
            self.assertEqual(j["source"]["edition"], BLUEPRINT["exam_source"]["edition"])

    def test_domain_weights_sum_to_one(self):
        for e in BLUEPRINT["exams"]:
            self.assertAlmostEqual(sum(d["weight"] for d in e["domains"]), 1.0, places=6, msg=e["exam_id"])

    def test_flow_mappings_parse_whole(self):
        """An unquoted comma inside a flow mapping silently cuts a title and adds a stray key."""
        allowed = {"skill_id", "title", "kind", "levels", "section_ids", "exam", "equipment"}
        for s in self.skills():
            self.assertEqual(set(s) - allowed, set(), s["skill_id"])
        for e in BLUEPRINT["equipment"]:
            self.assertEqual(set(e) - {"equip_id", "parent_id", "name", "aliases"}, set(), e["equip_id"])

    def test_skill_fields(self):
        equip = {e["equip_id"] for e in BLUEPRINT["equipment"]}
        for s in self.skills():
            self.assertIn(s["kind"], {"knowledge", "calc", "procedure", "judgment"}, s["skill_id"])
            self.assertTrue(set(s["levels"]) <= {"trainee", "operator", "inspector"}, s["skill_id"])
            self.assertTrue(s["section_ids"], s["skill_id"])
            self.assertTrue(set(s.get("equipment", [])) <= equip, s["skill_id"])

    @unittest.skipUnless(index_available(), "no eCFR index")
    def test_all_content_citations_verify(self):
        ix = verify.load_index(None)
        failures = []
        checked = 0
        for f in verify.iter_files([CONTENT]):
            if "data" in f.relative_to(CONTENT).parts:
                continue  # generated data: rows carry their own verdicts (see test below)
            res = verify.check(ix, verify.load_file(f), str(f))
            checked += res[0]["checked"]
            failures += res[1:]
        self.assertGreater(checked, 400)
        self.assertEqual(failures, [])

    @unittest.skipUnless(index_available(), "no eCFR index")
    def test_generated_pass_rows_verify(self):
        """Every generated row marked pass must have verifying quotes and citations."""
        ix = verify.load_index(None)
        data = CONTENT / "data"
        if not data.exists():
            self.skipTest("no generated data yet")
        bad = []
        for f in sorted(data.rglob("*.json*")):
            rows = [json.loads(line) for line in f.read_text().splitlines() if line.strip()] if f.suffix == ".jsonl" else json.loads(f.read_text())
            for r in rows:
                if r.get("prov", {}).get("verdict") != "pass":
                    continue
                r2 = {k: v for k, v in r.items() if k != "prov"}
                res = verify.check(ix, r2, f.name)
                bad += res[1:]
        self.assertEqual(bad[:20], [])


@unittest.skipUnless(index_available(), "no eCFR index")
class Grounding(unittest.TestCase):
    """The prompts' rule text: present for every skill, and verbatim line by line."""

    @classmethod
    def setUpClass(cls):
        sys.path.insert(0, str(CONTENT / "tasks"))
        import builders
        import common

        cls.builders, cls.common = builders, common
        cls.ix = common.index()

    def test_every_skill_gets_rule_text(self):
        for s in self.builders.skills():
            text = self.builders.skill_text(s)
            self.assertIn("[29cfr", text, s["skill_id"])

    def test_oversized_definitions_are_split_verbatim_and_ranked(self):
        sk = {s["skill_id"]: s for s in self.builders.skills()}
        text, ids = self.common.ground(sk["site.fall-zone"]["section_ids"], cap=20000)
        self.assertIn("29cfr1926.1425", ids)  # the paragraphs are not crowded out by the definitions
        self.assertIn("29cfr1926.1401", ids)
        defs = [ln.split("] ", 1)[1] for ln in text.splitlines() if ln.startswith("[29cfr1926.1401]")]
        self.assertTrue(any(d.startswith("Fall zone means") for d in defs))
        for d in defs:
            d = d.split(") ", 1)[1] if d.startswith("(§") else d
            self.assertTrue(self.ix.has_quote("29cfr1926.1401", d), d[:80])

    def test_table_rows_use_cell_separators(self):
        self.assertTrue(self.ix.has_quote("29cfr1926.1408", "up to 50 | 10"))
        self.assertFalse(self.ix.has_quote("29cfr1926.1408", "up to 50 10"))
        self.assertEqual(self.ix.repair("29cfr1926.1408", "up to 50 10"), "up to 50 | 10")
        self.assertEqual(self.ix.repair("29cfr1926.1411", "over .75 to 50 6"), "over .75 to 50 | 6")
        self.assertIsNone(self.ix.repair("29cfr1926.1408", "over 50 to 200 20"))  # never pairs the wrong cell
        self.assertIsNone(self.ix.repair("29cfr1926.1408", "up to 5 0 | 10"))  # never joins split digits
        self.assertTrue(self.ix.has_quote("29cfr1926.1437", "permanent attachment: | | Any rated capacity | 10 | 10"))
        self.assertEqual(self.ix.repair("29cfr1926.1437", "permanent attachment: Any rated capacity 10 10"),
                         "permanent attachment: | | Any rated capacity | 10 | 10")  # empty cells
        self.assertTrue(self.ix.has_quote("29cfr1926.1404(r)", "localized compression. Note: Requirements for the protection"))
        self.assertEqual(self.ix.repair("29cfr1926.1404(r)", "localized compression. Requirements for the protection"),
                         "localized compression. Note: Requirements for the protection")  # a Note label, as in the stage
        self.assertTrue(self.ix.has_quote("29cfr1910.184", "1⁄4 | 13⁄64"))

    def test_table_quote_cited_to_a_paragraph_is_repointed_to_its_section(self):
        row = {"section_id": "29cfr1926.1408(a)(1)", "quote": "up to 50 10"}
        ok, rep, errs = self.common.repair_quotes(row)
        self.assertEqual(errs, [])
        self.assertEqual(row, {"section_id": "29cfr1926.1408", "quote": "up to 50 | 10"})


class Writers(unittest.TestCase):
    """Deterministic checks the writers apply to generated rows (no model, no network)."""

    @classmethod
    def setUpClass(cls):
        sys.path.insert(0, str(CONTENT / "tasks"))
        import builders

        cls.b = builders

    def test_intent_similarity_matches_the_engine(self):
        try:
            import intent
        except ImportError:
            self.skipTest("snowballstemmer not installed")
        # scores the engine reported for crane-v1-0048 (right hit), -0097 and -0129 (wrong hits at 0.75)
        q = "how long does the power company have to give us the voltage if we want to go by the table"
        self.assertAlmostEqual(intent.similarity(q, "How long does the power company have to give the voltage?"), 0.8333, places=3)
        self.assertAlmostEqual(intent.similarity("Does a crane sitting on a barge need a crane level indicator?",
                                                 "how out of level can a crane be"), 0.75, places=3)
        self.assertAlmostEqual(intent.similarity(
            "For voice signals over the radio, what's the right order to say things? And if we swap in a new signal guy "
            "after lunch, do we have to go over the voice signals again?",
            "as the signal guy who do I need to go over voice calls with"), 0.75, places=3)
        self.assertAlmostEqual(intent.similarity("clearance for 50 kv", "clearance for 200 kv"), 0.5 * 2 * 2 / 6)  # numbers differ

    def test_intent_check_drops_colliding_aliases_and_duplicate_questions(self):
        try:
            import intent  # noqa: F401
        except ImportError:
            self.skipTest("snowballstemmer not installed")

        def row(aid, sk, q, aliases):
            return {"answer_id": aid, "skill_id": sk, "question": q, "aliases": aliases, "prov": {"verdict": "pass", "notes": None}}

        rows = [row("a1", "devices.level", "Does a barge crane need a crane level indicator?", ["barge crane level indicator required", "level indicator on a barge", "do floating cranes need a level gauge", "barge rig exempt from the level indicator?"]),
                row("a2", "inspections.shift", "Which items go on the walkaround each shift?", ["how out of level can a crane be", "shift walkaround items", "what do I look at every shift", "daily walkaround list"]),
                row("a3", "devices.level", "Does a crane on a barge need a crane level indicator?", ["x", "y", "z"])]
        stats = {"pass": 3, "fail": 0, "fail_reasons": {}}
        self.b._neighbour_stems = lambda: []
        self.b.intent_check(rows, stats)
        self.assertEqual(rows[2]["prov"]["verdict"], "fail")  # same intent as a1
        self.assertIn("duplicate intent of a1", rows[2]["prov"]["notes"])
        self.assertEqual(rows[0]["prov"]["verdict"], "pass")
        self.assertNotIn("how out of level can a crane be", rows[1]["aliases"])  # the barge question's neighbour
        self.assertEqual(rows[1]["prov"]["verdict"], "pass")
        self.assertNotIn("do floating cranes need a level gauge", rows[0]["aliases"])

    def test_direct_answer_first(self):
        f = self.b.direct_answer_first
        self.assertEqual(f("Does a barge crane need a level indicator?", [{"t": "text", "text": "No. It is exempt."}]), [])
        self.assertEqual(f("Do I deduct the block?", [{"t": "text", "text": "Practice: yes. Deduct it."}]), [])
        self.assertTrue(f("Does a barge crane need a level indicator?", [{"t": "text", "text": "The rule exempts it."}]))
        self.assertTrue(f("Is it required?", [{"t": "quote", "section_id": "x", "text": "y"}]))
        self.assertEqual(f("How far from a 50 kV line?", [{"t": "text", "text": "10 feet."}]), [])
        self.assertTrue(f("How far from a 50 kV line?", [{"t": "text", "text": "It depends on the table."}]))
        self.assertEqual(f("Can you show a worked example?", [{"t": "text", "text": "Here is one."}]), [])
        self.assertEqual(f("Does a barge crane need one?", [{"t": "text", "text": "Not on a barge crane."}]), [])
        self.assertTrue(f("How far from a 50 kV line?", [{"t": "text", "text": "It depends on each voltage band."}]))
        self.assertTrue(f("How far from a 50 kV line?", [{"t": "text", "text": "You must not get closer than the table allows."}]))
        self.assertTrue(f("Is it required?", [{"t": "text", "text": None}]))

    def test_duplicate_chains_keep_the_middle_row_out(self):
        try:
            import intent  # noqa: F401
        except ImportError:
            self.skipTest("snowballstemmer not installed")

        def row(aid, q):
            return {"answer_id": aid, "skill_id": "s", "question": q, "aliases": ["p one", "p two", "p three"], "prov": {"verdict": "pass", "notes": None}}

        rows = [row("a1", "crane level indicator barge"), row("a2", "crane level indicator barge deck"), row("a3", "level indicator barge deck")]
        self.b._neighbour_stems = lambda: []
        stats = {"pass": 3, "fail": 0, "fail_reasons": {}}
        self.b.intent_check(rows, stats)
        self.assertIn("duplicate intent of a1", rows[1]["prov"]["notes"] or "")
        self.assertNotIn("duplicate intent of a2", rows[2]["prov"]["notes"] or "")

    def test_meta_language(self):
        m = self.b.meta_language
        self.assertTrue(m("Does the supplied federal rule say to use the next longer radius?"))
        self.assertTrue(m("The next-longer-radius method cannot be established from this paragraph alone."))
        self.assertTrue(m("The rule text used here sets no minimum angle."))
        self.assertEqual(m("The federal rules set no minimum sling angle.", "Use the next longer radius (practice)."), [])
        self.assertEqual(m("The utility must provide the requested voltage information."), [])

    def test_choice_flaws(self):
        f = self.b.choice_flaws
        self.assertEqual(f(["10 feet", "15 feet", "20 feet", "25 feet"], 2), [])
        self.assertIn("options differ in length", f(["No", "Yes", "Only with a dedicated spotter and insulating links", "Never"], 2))
        self.assertEqual(f(["Stop the lift and report it", "Lower the load and re-rig", "Swing clear and keep going", "Call the lift director"], 0), [])
        self.assertIn("combination option (all/none/both)", f(["A thing", "B thing", "All of the above", "C thing"], 0))
        self.assertIn("choices overlap", f(["Stop the lift", "Stop the lift and report it", "Lower the boom", "Swing away"], 0))
        self.assertIn("duplicate choices", f(["Stop", "stop", "Go", "Wait"], 2))
        # near-miss options that differ in one word or number are the point, not an overlap
        self.assertEqual(self.b.key_length_ranks([{"choices": ["aa", "a", "aaa", "aaaa"], "answer": "3"}, {"choices": ["aa", "a", "aaa", "aaaa"], "answer": "1"}])["longest_share"], 0.5)
        self.assertEqual(f(["Above 50 percent at the longest radius", "Above 75 percent at the longest radius",
                            "Above 90 percent at the longest radius", "Above 75 percent at the shortest radius"], 1), [])

    def test_exam_rows_bundle_options_and_shuffle_consistently(self):
        class T:
            version = "5"

            def cached(self, it):
                return {"prompt_version": "5", "model": "m", "backend": "b", "prompt_id": "questions", "prompt_sha256": "p",
                        "input_sha256": "i", "output_sha256": "o", "created_at": "t", "input_id": "s.k",
                        "output": {"items": [{"tier": 2, "point": "p", "stem": "How far?", "basis": "physics", "section_id": None,
                                              "quote": None, "source": None, "difficulty": 0.5,
                                              "beyond": "b", "options": [{"text": f"{n} feet", "key": n == 20, "why": f"why {n}", "misconception": "key" if n == 20 else f"m{n}"}
                                                          for n in (10, 15, 20, 25)]}]}}

        T.cached_all = lambda self, it: [self.cached(it)]
        by_topic, stats = self.b.exam_rows(T(), [{"input_id": "s.k", "meta": {"skill_id": "s.k", "topic_id": "t"}}])
        r = by_topic["t"][0]
        k = int(r["answer"])
        self.assertEqual(r["choices"][k], "20 feet")
        self.assertEqual(r["rationales"][k], "why 20")
        self.assertEqual(r["misconceptions"][k], "key")
        self.assertEqual(r["_errs"], [])


class Budget(unittest.TestCase):
    """The runner's run budget and version fallback (no model calls)."""

    def setUp(self):
        import importlib
        import tempfile

        self.tmp = tempfile.TemporaryDirectory()
        os.environ["HARVEST_CACHE"] = self.tmp.name
        os.environ["HARVEST_USAGE_UNKNOWN_OK"] = "1"
        sys.path.insert(0, str(CONTENT / "tasks"))
        import common

        self.c = importlib.reload(common)

    def tearDown(self):
        import importlib

        os.environ.pop("HARVEST_CACHE")
        os.environ.pop("HARVEST_USAGE_UNKNOWN_OK")
        importlib.reload(self.c)
        self.tmp.cleanup()

    def test_guard_stops_before_the_cap(self):
        self.c.BUDGET_USD, self.c.BUDGET_OUTPUT_TOKENS = 1.25, 10_000
        for _ in range(3):
            self.c.record_spend("t", "i", {"model": "claude-opus", "cost_usd": 0.3, "usage": {"output_tokens": 1000}})
        self.c.USAGE_CEILING = 101
        self.c.guard("opus", 1)  # 0.9 + 1 x 0.3 fits under 1.25
        with self.assertRaises(self.c.UsageCeiling):
            self.c.guard("opus", 2)
        self.c.guard("codex:x", 5)  # Codex costs no dollars; 3000 + 5 x 1000 tokens fit
        self.c.record_spend("t", "i", {"model": "codex:x", "cost_usd": None, "usage": {"output_tokens": 9000, "reasoning_output_tokens": 500}})
        s = self.c.spent()
        self.assertEqual((s["calls"], s["output_tokens"]), (4, 12500))
        self.assertEqual(s["by_model"]["codex:x"]["output_tokens"], 9500)
        with self.assertRaises(self.c.UsageCeiling):
            self.c.guard("codex:x", 1)  # 12500 + 9500 > 10000

    def test_failed_call_is_recorded(self):
        d = Path(self.tmp.name) / "tf"
        d.mkdir()
        (d / "task.yaml").write_text("task_id: tf\nprompt_version: 1\nmodel: codex:x\n")
        (d / "system.md").write_text("s")
        (d / "schema.json").write_text("{}")
        task = self.c.Task(d)
        self.c.record_spend("t", "i", {"model": "codex:x", "cost_usd": None, "usage": {"output_tokens": 800}})

        def boom(*a, **k):
            raise self.c.CallFailed("no output", None)

        self.c.call_model = boom
        with self.assertRaises(self.c.CallFailed):
            task.run_one({"input_id": "k", "prompt": "p"})
        self.assertEqual((self.c.spent()["calls"], self.c.spent()["output_tokens"]), (2, 1600))

    def test_cached_falls_back_to_an_accepted_older_version(self):
        d = Path(self.tmp.name) / "td"
        d.mkdir()
        (d / "task.yaml").write_text("task_id: tq\nprompt_version: 4\naccept_versions: [3]\nmodel: sonnet\n")
        (d / "system.md").write_text("s")
        (d / "schema.json").write_text("{}")
        task = self.c.Task(d)
        item = {"input_id": "k", "prompt": "p"}
        self.assertIsNone(task.cached(item))
        task.cache.mkdir(parents=True)
        (task.cache / "k--old.json").write_text(json.dumps({"input_id": "k", "input_sha256": self.c.sha("p"), "prompt_version": "3", "output": 1}))
        (task.cache / "k--older.json").write_text(json.dumps({"input_id": "k", "input_sha256": self.c.sha("p"), "prompt_version": "2", "output": 2}))
        (task.cache / "k--other.json").write_text(json.dumps({"input_id": "k", "input_sha256": self.c.sha("q"), "prompt_version": "3", "output": 3}))
        self.assertEqual(task.cached(item)["output"], 1)



@unittest.skipUnless(index_available(), "no eCFR index")
class CourseTree(unittest.TestCase):
    """course/tree.jsonl and course/welcome.json (harvest/CONTRACT.md, course_node and Instructor turns)."""

    def setUp(self):
        p = CONTENT / "course" / "tree.jsonl"
        if not p.exists():
            self.skipTest("no course tree")
        self.rows = [json.loads(x) for x in p.read_text().splitlines() if x.strip()]

    def test_every_node_present_and_passing_text_verifies(self):
        ix = verify.load_index(None)
        ids = {r["node_id"] for r in self.rows}
        self.assertIn("course", ids)
        for s in (s for t in BLUEPRINT["topics"] for s in t["skills"]):
            self.assertIn(f"skill:{s['skill_id']}", ids)
        bad = []
        for r in self.rows:
            if r["prov"]["verdict"] != "pass":
                continue
            for q in r["quotes"]:
                if not ix.has_quote(q["section_id"], q["quote"]):
                    bad.append((r["node_id"], q["section_id"]))
            bad += [(r["node_id"], s) for s in r["section_ids"] if not ix.exists(s)]
        self.assertEqual(bad, [])

    def test_welcome_uses_the_handbook_numbers(self):
        p = CONTENT / "course" / "welcome.json"
        if not p.exists():
            self.skipTest("no welcome")
        w = json.loads(p.read_text())
        self.assertEqual(w["prov"]["verdict"], "pass")
        core = next(e for e in BLUEPRINT["exams"] if e["exam_id"] == "mobile-core")
        text = " ".join(b["text"] for b in w["blocks"] if b["t"] == "text")
        self.assertIn(str(core["items"]), text)
        for d in core["domains"]:
            self.assertIn(f"{round(d['weight'] * 100)}", text)
        self.assertEqual([b for b in w["blocks"] if b["t"] in ("quote", "cite")], [])


if __name__ == "__main__":
    unittest.main()
