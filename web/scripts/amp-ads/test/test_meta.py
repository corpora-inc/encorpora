import copy
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import meta


def specification():
    return {
        "id": "efa-product", "status": "PAUSED", "state": "Arkansas",
        "publisher": "facebook", "placement": "feed", "daily_budget_cents": 100,
        "url": "https://corpora.inc/esa/arkansas-efa/",
        "primary_text": "Explore adaptive math. One license covers one learner.",
        "headline": "Find their next step in math", "description": "Try up to 100 problems free.",
        "image": "image.png",
    }


def configuration(root):
    return {"account_id": "123", "page_id": "456", "pixel_id": "789",
            "allowed_account_ids": ["123"], "max_daily_budget_cents": 100,
            "credentials": str(root / "token.json"), "media_root": str(root)}


class FakeGraph:
    def __init__(self):
        self.calls, self.objects = [], {}
        self.counter = 1000
        self.fail = None
        self.video_ready = True

    def call(self, method, path, params=None, media=None):
        self.calls.append((method, path, copy.deepcopy(params)))
        if self.fail and path.endswith(self.fail):
            raise RuntimeError("Simulated uncertain response")
        if method == "POST":
            self.counter += 1
            key = str(self.counter)
            if path.endswith("/adimages"):
                return {"images": {"image": {"hash": "a" * 32}}}
            value = copy.deepcopy(params)
            if path.endswith("/ads"):
                value["creative"] = {"id": value["creative"]["creative_id"]}
            if path.endswith("/advideos"):
                value["status"] = {"video_status": "ready" if self.video_ready else "processing"}
            self.objects[key] = value
            return {"id": key}
        return copy.deepcopy(self.objects[path])


class MetaTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        (self.root / "image.png").write_bytes(b"\x89PNG\r\n\x1a\nsynthetic fixture")
        (self.root / "video.mp4").write_bytes(b"\x00\x00\x00\x18ftypisomsynthetic fixture")
        self.spec = specification()
        self.config = configuration(self.root)
        self.graph = FakeGraph()

    def tearDown(self):
        self.tmp.cleanup()

    def plan(self):
        return meta.plan(self.spec, self.config, "999", meta.media_files(self.spec, self.root, self.root))

    def test_validation_rejects_activation_extraneous_fields_and_unsafe_destinations(self):
        meta.validate(self.spec)
        for changes in [{"status": "ACTIVE"}, {"state": "Texas"}, {"publisher": "audience_network"}, {"age_min": 13}, {"daily_budget_cents": True}, {"url": "https://corpora.inc@elsewhere.test/"}, {"url": "https://corpora.inc/?email=test"}, {"headline": "x" * 41}]:
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                meta.validate({**self.spec, **changes})

    def test_budget_identity_and_media_changes_change_fingerprint(self):
        p = self.plan()
        self.config["page_id"] = "111"
        self.assertNotEqual(p["fingerprint"], self.plan()["fingerprint"])
        self.config["max_daily_budget_cents"] = 99
        with self.assertRaises(ValueError):
            self.plan()

    def test_publisher_isolated_with_matching_attribution(self):
        self.spec.update(publisher="instagram", placement="vertical")
        with self.assertRaises(ValueError):
            self.plan()
        self.config["instagram_user_id"] = "222"
        p = self.plan()
        target = p["adset"]["targeting"]
        self.assertEqual(target["publisher_platforms"], ["instagram"])
        self.assertEqual(target["instagram_positions"], ["story", "reels"])
        self.assertEqual(target["age_min"], 18)
        self.assertEqual(target["geo_locations"]["regions"], [{"key": "999"}])
        self.assertIn("utm_source=instagram", p["url_tags"])
        self.assertNotIn("facebook_positions", target)

    def test_facebook_vertical_does_not_require_another_publisher_or_feed(self):
        # Meta rejects Facebook Stories without Facebook Feed or Instagram Stories.
        # The vertical proposal must preserve its single-publisher, Reels-only scope.
        self.spec.update(publisher="facebook", placement="vertical")
        target = self.plan()["adset"]["targeting"]
        self.assertEqual(target["publisher_platforms"], ["facebook"])
        self.assertEqual(target["facebook_positions"], ["facebook_reels"])
        self.assertNotIn("instagram_positions", target)

    def test_live_location_readback_is_explicit_and_still_rejects_expansion(self):
        # Sanitized v26 response: home/recent is returned with frequently_in.
        p = self.plan()
        actual = copy.deepcopy(p["adset"])
        geo = actual["targeting"]["geo_locations"]
        geo["location_types"] = ["frequently_in", "home", "recent"]
        geo["regions"][0].update(name="Arkansas", country="US")
        self.graph.objects["1"] = actual
        meta.verify(self.graph, "1", p["adset"])
        self.assertEqual(set(p["adset"]["targeting"]["geo_locations"]["location_types"]),
                         {"home", "recent", "frequently_in"})
        for change in ["traveler", "duplicate", "missing", "country", "region"]:
            with self.subTest(change=change):
                bad = copy.deepcopy(actual)
                locations = bad["targeting"]["geo_locations"]
                if change == "traveler":
                    locations["location_types"].append("travel_in")
                elif change == "duplicate":
                    locations["location_types"] = ["home", "home", "recent"]
                elif change == "missing":
                    locations["location_types"].remove("frequently_in")
                elif change == "country":
                    locations["countries"] = ["US"]
                else:
                    locations["regions"].append({"key": "888"})
                self.graph.objects["1"] = bad
                with self.assertRaises(RuntimeError):
                    meta.verify(self.graph, "1", p["adset"])

    def test_media_cannot_escape_root_or_change_after_plan(self):
        with tempfile.TemporaryDirectory() as other:
            outside = Path(other) / "outside.png"
            outside.write_bytes((self.root / "image.png").read_bytes())
            (self.root / "link.png").symlink_to(outside)
            self.spec["image"] = "link.png"
            with self.assertRaises(ValueError):
                self.plan()
        self.spec["image"] = "image.png"
        p = self.plan()
        (self.root / "image.png").write_bytes(b"different")
        j = meta.Journal(self.root / "journal", p["fingerprint"])
        try:
            with self.assertRaises(ValueError):
                meta.apply(self.graph, self.config, self.spec, p, {"campaigns": []}, j)
            self.assertFalse(any(c[1].endswith("/adimages") for c in self.graph.calls))
        finally:
            j.close()

    def test_creation_and_replay_never_enable_or_duplicate_resources(self):
        p = self.plan()
        j = meta.Journal(self.root / "journal", p["fingerprint"])
        try:
            receipt = meta.apply(self.graph, self.config, self.spec, p, {"campaigns": []}, j)
            writes = [c for c in self.graph.calls if c[0] == "POST"]
            self.assertEqual(len(writes), 5)
            for _, path, params in writes:
                if path.endswith(("/campaigns", "/adsets", "/ads")):
                    self.assertEqual(params["status"], "PAUSED")
            inventory = {"campaigns": [{"id": receipt["campaign_id"], "name": p["campaign"]["name"]}]}
            self.assertEqual(receipt, meta.apply(self.graph, self.config, self.spec, p, inventory, j))
            self.assertEqual(writes, [c for c in self.graph.calls if c[0] == "POST"])
            self.graph.objects[receipt["campaign_id"]]["status"] = "ACTIVE"
            with self.assertRaises(RuntimeError):
                meta.apply(self.graph, self.config, self.spec, p, inventory, j)
        finally:
            j.close()

    def test_unknown_write_blocks_retry_and_alternate_slug_collision(self):
        p = self.plan()
        path = self.root / "journal"
        j = meta.Journal(path, p["fingerprint"])
        self.graph.fail = "/adsets"
        try:
            with self.assertRaises(RuntimeError):
                meta.apply(self.graph, self.config, self.spec, p, {"campaigns": []}, j)
        finally:
            j.close()
        self.assertEqual(json.loads(path.read_text())["pending"], "adset")
        with self.assertRaises(RuntimeError):
            meta.Journal(path, p["fingerprint"])
        j2 = meta.Journal(self.root / "another", p["fingerprint"])
        try:
            with self.assertRaises(RuntimeError):
                meta.apply(self.graph, self.config, self.spec, p, {"campaigns": [{"id": "1", "name": p["campaign"]["name"]}]}, j2)
        finally:
            j2.close()

    def test_video_wait_retains_upload_and_resumes_without_reupload(self):
        self.spec["video"] = "video.mp4"
        p = self.plan()
        self.graph.video_ready = False
        j = meta.Journal(self.root / "journal", p["fingerprint"])
        try:
            with self.assertRaisesRegex(RuntimeError, "processing"):
                meta.apply(self.graph, self.config, self.spec, p, {"campaigns": []}, j)
            self.assertNotIn("pending", j.value)
            video_id = j.value["steps"]["video"]
            self.graph.objects[video_id]["status"]["video_status"] = "ready"
            inventory = {"campaigns": [{"id": j.value["steps"]["campaign"], "name": p["campaign"]["name"]}]}
            receipt = meta.apply(self.graph, self.config, self.spec, p, inventory, j)
            self.assertEqual(len([c for c in self.graph.calls if c[1].endswith("/advideos")]), 1)
            story = self.graph.objects[receipt["creative_id"]]["object_story_spec"]
            self.assertEqual(story["video_data"]["video_id"], video_id)
            self.assertEqual(story["video_data"]["call_to_action"]["value"]["link"], self.spec["url"])
        finally:
            j.close()

    def test_readback_rejects_widened_targeting_and_duplicate_list_elements(self):
        p = self.plan()
        self.graph.objects["1"] = copy.deepcopy(p["adset"])
        self.graph.objects["1"]["targeting"]["geo_locations"]["countries"] = ["US"]
        with self.assertRaises(RuntimeError):
            meta.verify(self.graph, "1", p["adset"])
        self.assertFalse(meta.subset(["story", "story"], ["story", "reels"]))

    def test_journal_excludes_concurrent_writers_and_changed_plan(self):
        path = self.root / "journal"
        j = meta.Journal(path, "first")
        try:
            j.save()
            with self.assertRaises(BlockingIOError):
                meta.Journal(path, "first")
        finally:
            j.close()
        with self.assertRaises(ValueError):
            meta.Journal(path, "second")
        self.assertEqual(path.stat().st_mode & 0o777, 0o600)

    def test_pagination_never_follows_server_url(self):
        graph = object.__new__(meta.Graph)
        calls = []
        def call(method, path, params):
            calls.append((path, dict(params)))
            return {"data": [{"id": "1"}], "paging": {"next": "https://evil.test/?access_token=secret", "cursors": {"after": "next"}}} if len(calls) == 1 else {"data": [{"id": "2"}]}
        graph.call = call
        self.assertEqual(len(graph.all("act_123/campaigns")), 2)
        self.assertEqual([x[0] for x in calls], ["act_123/campaigns"] * 2)

    def test_transport_keeps_token_out_of_query_and_redacts_errors(self):
        token = self.root / "token.json"
        token.write_text(json.dumps({"access_token": "private-test-token"}))
        token.chmod(0o600)
        graph = meta.Graph(self.config)
        with patch.object(graph.session, "request") as request:
            request.return_value.status_code = 400
            request.return_value.json.return_value = {"error": {"code": 190, "message": "private-test-token"}}
            with self.assertRaisesRegex(RuntimeError, "code 190") as caught:
                graph.call("GET", "act_123", {"fields": "id"})
            self.assertNotIn("private-test-token", str(caught.exception))
            self.assertNotIn("access_token", str(request.call_args))
            self.assertFalse(request.call_args.kwargs["allow_redirects"])
            self.assertFalse(graph.session.trust_env)
        token.chmod(0o644)
        with self.assertRaises(ValueError):
            meta.Graph(self.config)

    def test_existing_tilde_output_stops_before_api_access(self):
        (self.root / "existing.json").write_text("{}")
        with patch.dict(os.environ, {"HOME": str(self.root)}), patch.object(sys, "argv", ["meta.py", "inspect", "--config", "unused.json", "--output", "~/existing.json"]), patch.object(meta, "Graph") as graph:
            with self.assertRaisesRegex(ValueError, "Output already exists"):
                meta.main()
            graph.assert_not_called()

    def test_report_scopes_campaigns_and_distinguishes_platform_attribution(self):
        with patch.object(self.graph, "all", create=True, return_value=[{"spend": "1.00"}]) as read:
            result = meta.report(self.graph, self.config, {"account": {"timezone_name": "America/New_York"}, "campaigns": [{"id": "1", "name": "AMP | AR | example"}, {"id": "2", "name": "Another product"}]}, "2026-10-01", "2026-10-21")
            self.assertEqual(result["rows"], [{"spend": "1.00"}])
            self.assertEqual(result["timezone"], "America/New_York")
            self.assertEqual(result["date_range"], {"since": "2026-10-01", "until": "2026-10-21", "inclusive": True})
            self.assertEqual(read.call_args.args[1]["filtering"][0]["value"], ["1"])
            self.assertEqual(read.call_args.args[1]["action_attribution_windows"], ["7d_click"])
            self.assertIn("not verified EFA settlement", result["interpretation"])
            read.reset_mock()
            self.assertEqual(meta.report(self.graph, self.config, {"account": {"timezone_name": "America/New_York"}, "campaigns": []}, "2026-10-01", "2026-10-21")["rows"], [])
            read.assert_not_called()
            for dates in [("2026-01-01", "2026-10-21"), ("2026-10-21", "2026-10-01"), ("20261001", "2026-10-21")]:
                with self.assertRaises(ValueError):
                    meta.report(self.graph, self.config, {"account": {"timezone_name": "America/New_York"}, "campaigns": []}, *dates)

    def test_report_rejects_missing_or_unknown_time_zone_before_insights(self):
        for timezone in [None, "", "Unknown/Timezone"]:
            with patch.object(self.graph, "all", create=True) as read:
                with self.assertRaisesRegex(ValueError, "time zone"):
                    meta.report(self.graph, self.config, {"account": {"timezone_name": timezone}, "campaigns": []}, "2026-10-01", "2026-10-21")
                read.assert_not_called()


if __name__ == "__main__":
    unittest.main()
