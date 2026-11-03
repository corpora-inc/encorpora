import copy
import json
import tempfile
import unittest
from datetime import timedelta
from pathlib import Path

import youtube_clerk as clerk
from youtube_policy import POLICY_VERSION, timestamp

CHANNEL = "UC-test"
NOW = timestamp("2026-11-03T17:00:00Z")


def plan(synthetic=False):
    return {"policyVersion": POLICY_VERSION, "contentType": "ad", "audience": {"classification": "general", "rationale": "parents"},
            "aiDisclosure": {"required": synthetic, "rationale": "recorded"}, "pinnedComment": "Try Adaptive Math Pathways free: https://amp.corpora.inc",
            "relatedVideoIds": []}


def uploaded_video(video_id, synthetic=False, **status):
    # The real API omits containsSyntheticMedia on read; `synthetic` only seeds the fake's store.
    return {"id": video_id, "snippet": {"title": video_id, "description": "Try it: https://amp.corpora.inc", "publishedAt": "2026-11-03T01:45:00Z", "tags": []},
            "status": {"uploadStatus": "processed", "privacyStatus": "private", "selfDeclaredMadeForKids": False, "embeddable": True, "license": "youtube",
                       "publicStatsViewable": True, "containsSyntheticMedia": synthetic, **status},
            "processingDetails": {"processingStatus": "succeeded"}, "contentDetails": {}}


class FakeYouTube(clerk.YouTube):
    def __init__(self, ledger, videos, budget=6000):
        super().__init__(ledger, budget)
        self.videos = {v["id"]: v for v in videos}
        self.playlists, self.comments, self.writes, self.status_writes = {}, {}, [], []

    def send(self, method, url, body=None, headers=None):
        raise AssertionError("network")

    def upload_caption(self, video_id, path):
        self.charge("captions.insert")
        self.writes.append(("caption", video_id))

    def call(self, kind, method, path, query=None, data=None):
        self.charge(kind)
        query = query or {}
        if method != "GET":
            self.writes.append((path, copy.deepcopy(data)))
        if path == "channels":
            return {"items": [{"contentDetails": {"relatedPlaylists": {"uploads": "UU"}}}]}
        if path == "playlistItems" and method == "GET" and query.get("playlistId") == "UU":
            return {"items": [{"contentDetails": {"videoId": i}} for i in self.videos]}
        if path == "playlistItems" and method == "GET":
            return {"items": [{"id": "x"}] if query["videoId"] in self.playlists.get(query["playlistId"], set()) else []}
        if path == "playlistItems":
            self.playlists.setdefault(data["snippet"]["playlistId"], set()).add(data["snippet"]["resourceId"]["videoId"])
            return {}
        if path == "videos" and method == "GET":
            return {"items": [copy.deepcopy(self.videos[i]) for i in query["id"].split(",") if i in self.videos]}
        if path == "videos" and query.get("part") == "status":
            self.videos[data["id"]]["status"] = {"uploadStatus": "processed", **data["status"]}
            self.status_writes.append(copy.deepcopy(data["status"]))
            return {}
        if path == "videos":
            self.videos[data["id"]]["snippet"].update(data["snippet"])
            return {}
        if path == "captions":
            return {"items": []}
        if path == "commentThreads" and method == "GET":
            return {"items": self.comments.get(query["videoId"], [])}
        if path == "commentThreads":
            thread = {"id": f"c{len(self.writes)}", "snippet": {"topLevelComment": {"snippet": {"authorChannelId": {"value": CHANNEL},
                                                                                                   "textOriginal": data["snippet"]["topLevelComment"]["snippet"]["textOriginal"]}}}}
            self.comments.setdefault(data["snippet"]["videoId"], []).append(thread)
            return thread
        raise AssertionError(f"unexpected {method} {path}")


class ClerkTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        self.queue, self.state = root / "queue", root / "state"
        self.queue.mkdir()
        self.state.mkdir()
        (self.state / "channel-defaults.json").write_text(json.dumps({"checkedAt": (NOW - timedelta(days=1)).isoformat()}))
        self.fetch = lambda url: 200

    def tearDown(self):
        self.tmp.cleanup()

    def add(self, pid, video_id, lane="ad", **extra):
        folder = self.queue / pid
        folder.mkdir()
        (folder / "package.json").write_text(json.dumps({"id": pid, "lane": lane, "videoId": video_id, "uploadedAt": "2026-11-03T01:45:00Z",
                                                         "plan": plan(extra.pop("synthetic", False)), "playlistIds": ["PL"], "tags": ["math"], **extra}))
        return folder

    def run_tick(self, api, now=NOW):
        return {r["id"]: r for r in clerk.tick(api, self.queue, self.state, CHANNEL, now=now, fetch=self.fetch)}

    def test_ads_are_scheduled_a_day_apart_with_status_preserved(self):
        api = FakeYouTube(self.state / "q.json", [uploaded_video("a1", synthetic=True), uploaded_video("a2", synthetic=True)])
        self.add("ad-1", "a1", synthetic=True)
        self.add("ad-2", "a2", synthetic=True)
        report = self.run_tick(api)
        self.assertEqual({r["phase"] for r in report.values()}, {"scheduled"})
        first, second = (timestamp(api.videos[i]["status"]["publishAt"]) for i in ("a1", "a2"))
        self.assertGreaterEqual(abs(second - first), timedelta(hours=24))
        self.assertTrue(api.videos["a1"]["status"]["containsSyntheticMedia"])
        self.assertEqual(api.videos["a1"]["snippet"]["tags"], ["math"])
        self.assertIn("a1", api.playlists["PL"])

    def test_status_writes_always_carry_the_planned_disclosure(self):
        unreadable = uploaded_video("a1")
        del unreadable["status"]["containsSyntheticMedia"]
        api = FakeYouTube(self.state / "q.json", [unreadable])
        folder = self.add("ad-1", "a1", synthetic=True)
        self.run_tick(api)
        (folder / "VETO").write_text("no")
        self.run_tick(api)
        self.assertEqual([w["containsSyntheticMedia"] for w in api.status_writes], [True, True])

    def test_explanations_fill_four_hour_slots(self):
        api = FakeYouTube(self.state / "q.json", [uploaded_video("e1"), uploaded_video("e2")])
        self.add("e-1", "e1", lane="explanation")
        self.add("e-2", "e2", lane="explanation")
        self.run_tick(api)
        first, second = (timestamp(api.videos[i]["status"]["publishAt"]) for i in ("e1", "e2"))
        self.assertGreaterEqual(abs(second - first), timedelta(hours=4))
        self.assertLess(abs(second - first), timedelta(hours=24))

    def test_missing_channel_defaults_or_kids_audience_holds_release(self):
        api = FakeYouTube(self.state / "q.json", [uploaded_video("k1", selfDeclaredMadeForKids=True)])
        self.add("kids", "k1", lane="explanation")
        self.assertIn("audience", self.run_tick(api)["kids"]["phase"])
        (self.state / "channel-defaults.json").unlink()
        api = FakeYouTube(self.state / "q2.json", [uploaded_video("e1")])
        self.add("plain", "e1", lane="explanation")
        self.assertIn("channel-defaults", self.run_tick(api)["plain"]["phase"])
        self.assertNotIn("publishAt", api.videos["e1"]["status"])

    def test_veto_removes_a_pending_schedule(self):
        api = FakeYouTube(self.state / "q.json", [uploaded_video("e1")])
        folder = self.add("e-1", "e1", lane="explanation")
        self.run_tick(api)
        self.assertIn("publishAt", api.videos["e1"]["status"])
        (folder / "VETO").write_text("no")
        self.assertEqual(self.run_tick(api)["e-1"]["phase"], "vetoed")
        self.assertNotIn("publishAt", api.videos["e1"]["status"])
        self.assertEqual(api.videos["e1"]["status"]["privacyStatus"], "private")

    def test_cta_is_posted_once_after_release(self):
        api = FakeYouTube(self.state / "q.json", [uploaded_video("e1", privacyStatus="public")])
        self.add("e-1", "e1", lane="explanation")
        self.run_tick(api)
        (self.queue / "e-1" / "state.json").write_text("{}")  # even with lost local state
        self.run_tick(api)
        self.assertEqual(len(api.comments["e1"]), 1)

    def test_budget_stops_writes_but_reads_continue(self):
        api = FakeYouTube(self.state / "q.json", [uploaded_video("e1")], budget=10)
        self.add("e-1", "e1", lane="explanation")
        self.assertIn("waiting for quota", self.run_tick(api)["e-1"]["phase"])
        self.assertEqual(api.writes, [])

    def test_broken_package_is_reported_and_others_continue(self):
        api = FakeYouTube(self.state / "q.json", [uploaded_video("e1")])
        bad = self.queue / "bad"
        bad.mkdir()
        (bad / "package.json").write_text(json.dumps({"id": "bad", "lane": "vlog"}))
        self.add("e-1", "e1", lane="explanation")
        report = self.run_tick(api)
        self.assertEqual(report["e-1"]["phase"], "scheduled")
        self.assertIn("lane", json.loads((bad / "state.json").read_text())["error"])

    def test_dead_landing_link_holds_release(self):
        self.fetch = lambda url: 404
        api = FakeYouTube(self.state / "q.json", [uploaded_video("e1")])
        self.add("e-1", "e1", lane="explanation")
        self.assertIn("link does not load", self.run_tick(api)["e-1"]["phase"])


if __name__ == "__main__":
    unittest.main()
