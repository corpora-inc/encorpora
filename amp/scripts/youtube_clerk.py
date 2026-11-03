"""YouTube release clerk: keeps the channel calendar running from a private package queue.

One tick (run by launchd every 30 minutes) does, for every queued package, only the next
step that is due, and records what it did:

  upload private (maintained uploader) -> metadata, playlist, captions -> automated review
  -> native schedule in the next compliant slot -> at release, post the CTA comment once.

A package is a directory in $AMP_YOUTUBE_QUEUE with package.json. A file named VETO in it
stops the release: the clerk never schedules it, and removes a pending schedule. The clerk
writes state.json beside it and a channel status report to $AMP_YOUTUBE_STATE_DIR/<channel>/.

  python3 youtube_clerk.py tick [--dry-run]
  python3 youtube_clerk.py status
  python3 youtube_clerk.py veto <package-id>

Credentials: AMP_YOUTUBE_TOKEN (authorized-user OAuth JSON) and AMP_YOUTUBE_CHANNEL_ID, as for
publish-lesson-youtube.py. Nothing here prints credential values.
"""
import argparse
import fcntl
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parent))
from youtube_policy import calendar_event, release_time, timestamp, validate_plan  # noqa: E402

API = "https://www.googleapis.com/youtube/v3"
UPLOAD = "https://www.googleapis.com/upload/youtube/v3"
PACIFIC = ZoneInfo("America/Los_Angeles")  # the Data API quota day
# Data API units (https://developers.google.com/youtube/v3/determine_quota_cost); videos.insert
# is counted at its historical worst case so the budget errs on the safe side.
COST = {"list": 1, "update": 50, "insert": 50, "captions.insert": 400, "videos.insert": 1600, "delete": 50}
DAILY_BUDGET = int(os.environ.get("AMP_YOUTUBE_CLERK_BUDGET", "6000"))
DEFAULTS_MAX_AGE = timedelta(days=30)
STATUS_KEYS = ("privacyStatus", "selfDeclaredMadeForKids", "embeddable", "license", "publicStatsViewable", "containsSyntheticMedia")


class QuotaExhausted(Exception):
    pass


def log(message):
    print(f"{datetime.now(timezone.utc).isoformat(timespec='seconds')} {message}", file=sys.stderr, flush=True)


class YouTube:
    """Thin Data API client with a per-day unit ledger. Tests replace `send`."""

    def __init__(self, ledger_path, budget=DAILY_BUDGET):
        self.ledger_path = ledger_path
        self.budget = budget
        self._token = None

    def spent(self):
        day = datetime.now(PACIFIC).date().isoformat()
        try:
            ledger = json.loads(self.ledger_path.read_text())
        except (FileNotFoundError, json.JSONDecodeError):
            ledger = {}
        return ledger.get(day, 0), day, ledger

    def charge(self, kind):
        units = COST[kind]
        used, day, ledger = self.spent()
        if kind != "list" and used + units > self.budget:
            raise QuotaExhausted(f"clerk budget {self.budget} units reached ({used} used today)")
        ledger = {day: used + units}  # keep only today
        self.ledger_path.parent.mkdir(parents=True, exist_ok=True)
        self.ledger_path.write_text(json.dumps(ledger))

    def token(self):
        if not self._token:
            auth = json.loads(Path(os.environ["AMP_YOUTUBE_TOKEN"]).read_text())
            body = urllib.parse.urlencode({**{k: auth[k] for k in ("client_id", "client_secret", "refresh_token")}, "grant_type": "refresh_token"}).encode()
            with urllib.request.urlopen(urllib.request.Request("https://oauth2.googleapis.com/token", data=body), timeout=30) as response:
                self._token = json.load(response)["access_token"]
        return self._token

    def send(self, method, url, body=None, headers=None):
        request = urllib.request.Request(url, data=body, method=method, headers={"Authorization": "Bearer " + self.token(), **(headers or {})})
        with urllib.request.urlopen(request, timeout=300) as response:
            raw = response.read()
            return json.loads(raw) if raw else {}

    def call(self, kind, method, path, query=None, data=None):
        self.charge(kind)
        url = f"{API}/{path}" + ("?" + urllib.parse.urlencode(query) if query else "")
        body = None if data is None else json.dumps(data).encode()
        return self.send(method, url, body, {"Content-Type": "application/json"})

    def upload_caption(self, video_id, path):
        self.charge("captions.insert")
        raw = Path(path).read_bytes()
        meta = json.dumps({"snippet": {"videoId": video_id, "language": "en", "name": "English", "isDraft": False}}).encode()
        request = urllib.request.Request(UPLOAD + "/captions?uploadType=resumable&part=snippet", data=meta, method="POST", headers={
            "Authorization": "Bearer " + self.token(), "Content-Type": "application/json",
            "X-Upload-Content-Type": "application/octet-stream", "X-Upload-Content-Length": str(len(raw))})
        with urllib.request.urlopen(request, timeout=60) as response:
            session = response.headers["Location"]
        return self.send("PUT", session, raw, {"Content-Type": "application/octet-stream"})


# ---------------------------------------------------------------- queue

def load_queue(queue):
    packages = []
    for folder in sorted(p for p in Path(queue).iterdir() if p.is_dir()) if Path(queue).exists() else []:
        spec = folder / "package.json"
        if not spec.exists():
            continue
        try:
            package = json.loads(spec.read_text())
            if package.get("id") != folder.name:
                raise ValueError("package id must equal its folder name")
            if package.get("lane") not in {"explanation", "tutoring", "ad"}:
                raise ValueError("lane must be explanation, tutoring or ad")
            validate_plan(package["plan"])
            if not (package.get("videoId") or package.get("upload")):
                raise ValueError("needs videoId (adopt an upload) or upload (manifest for the uploader)")
        except Exception as error:  # noqa: BLE001 - a bad package must not stop the others
            log(f"ERROR package {folder.name}: {error}")
            write_state(folder, {**read_state(folder), "error": str(error)})
            continue
        package["_dir"] = folder
        package["_vetoed"] = (folder / "VETO").exists()
        packages.append(package)
    return sorted(packages, key=lambda p: (p.get("order", 1000), p["id"]))


def read_state(folder):
    try:
        return json.loads((Path(folder) / "state.json").read_text())
    except FileNotFoundError:
        return {}


def write_state(folder, state):
    path = Path(folder) / "state.json"
    path.write_text(json.dumps(state, indent=2, default=str) + "\n")


def note(state, message):
    state.setdefault("log", []).append(f"{datetime.now(timezone.utc).isoformat(timespec='seconds')} {message}")
    state["log"] = state["log"][-40:]


# ---------------------------------------------------------------- channel reads

def channel_videos(api, channel):
    uploads = api.call("list", "GET", "channels", {"part": "contentDetails", "id": channel})["items"][0]["contentDetails"]["relatedPlaylists"]["uploads"]
    ids, page = [], None
    while True:
        query = {"part": "contentDetails", "maxResults": 50, "playlistId": uploads}
        if page:
            query["pageToken"] = page
        listing = api.call("list", "GET", "playlistItems", query)
        ids += [item["contentDetails"]["videoId"] for item in listing["items"]]
        page = listing.get("nextPageToken")
        if not page:
            break
    videos = {}
    for offset in range(0, len(ids), 50):
        for item in api.call("list", "GET", "videos", {"part": "snippet,status,processingDetails,contentDetails", "id": ",".join(ids[offset:offset + 50])})["items"]:
            videos[item["id"]] = item
    return videos


def video(api, video_id):
    items = api.call("list", "GET", "videos", {"part": "snippet,status,processingDetails,contentDetails", "id": video_id})["items"]
    return items[0] if items else None


def landing_ok(text, fetch=None):
    fetch = fetch or (lambda url: urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 corpora-youtube-clerk"}), timeout=20).status)
    for url in sorted(set(re.findall(r"https?://[^\s)>\]]+", text))):
        try:
            if not 200 <= fetch(url) < 400:
                return False, url
        except Exception:  # noqa: BLE001
            return False, url
    return True, None


def defaults_receipt(state_dir, now):
    """Studio-only settings (comments, moderation, notifications) come from channel defaults,
    verified in the browser and recorded here. A stale or missing receipt blocks releases."""
    try:
        receipt = json.loads((state_dir / "channel-defaults.json").read_text())
    except FileNotFoundError:
        return None
    if now - timestamp(receipt["checkedAt"]) > DEFAULTS_MAX_AGE:
        return None
    return receipt


# ---------------------------------------------------------------- steps

def ensure_uploaded(package, state, run_uploader, dry_run=False):
    if state.get("videoId"):
        return True
    if package.get("videoId"):
        state.update(videoId=package["videoId"], uploadedAt=package.get("uploadedAt"))
        note(state, f"adopted existing upload {package['videoId']}")
        return True
    if dry_run:
        return False
    folder, spec = package["_dir"], package["upload"]
    (folder / "plan.json").write_text(json.dumps(package["plan"], indent=1))
    receipt = folder / "receipt.json"
    run_uploader([str(folder / spec["manifest"]), str(folder / spec.get("deliverables", ".")), str(receipt),
                  "--title", package["title"], "--description-file", str(folder / spec["descriptionFile"]), "--plan", str(folder / "plan.json")])
    data = json.loads(receipt.read_text())
    state.update(videoId=data["videoId"], uploadedAt=data["uploadedAt"])
    note(state, f"uploaded private {data['videoId']}")
    return True


def ensure_metadata(api, package, state, current):
    video_id, snippet = state["videoId"], current["snippet"]
    want_tags = package.get("tags")
    if want_tags is not None and sorted(snippet.get("tags", [])) != sorted(want_tags):
        body = {"id": video_id, "snippet": {"title": snippet["title"], "description": snippet["description"], "categoryId": snippet.get("categoryId", "27"),
                                            "defaultLanguage": snippet.get("defaultLanguage", "en"), "defaultAudioLanguage": snippet.get("defaultAudioLanguage", "en"), "tags": want_tags}}
        api.call("update", "PUT", "videos", {"part": "snippet"}, body)
        note(state, f"set {len(want_tags)} tags")
    for playlist in package.get("playlistIds", []):
        if playlist in state.setdefault("playlists", []):
            continue
        found = api.call("list", "GET", "playlistItems", {"part": "id", "playlistId": playlist, "videoId": video_id})["items"]
        if not found:
            api.call("insert", "POST", "playlistItems", {"part": "snippet"}, {"snippet": {"playlistId": playlist, "resourceId": {"kind": "youtube#video", "videoId": video_id}}})
            note(state, f"added to playlist {playlist}")
        state["playlists"].append(playlist)
    if package.get("captions") and not state.get("captions"):
        tracks = api.call("list", "GET", "captions", {"part": "snippet", "videoId": video_id})["items"]
        if not any(t["snippet"]["language"].startswith("en") and t["snippet"].get("trackKind") != "asr" for t in tracks):
            api.upload_caption(video_id, package["_dir"] / package["captions"])
            note(state, "uploaded English captions")
        state["captions"] = True


def review(package, state, current, defaults, fetch=None):
    """API-verifiable release checks plus the channel-defaults receipt. Returns failing reasons."""
    status, failures = current["status"], []
    if current.get("processingDetails", {}).get("processingStatus") not in ("succeeded", None) or status.get("uploadStatus") != "processed":
        failures.append("processing not finished")
    if status.get("selfDeclaredMadeForKids") is not False:
        failures.append("audience is not the reviewed general-audience setting")
    if not status.get("publicStatsViewable") or not status.get("embeddable") or status.get("license") != "youtube":
        failures.append("likes, embedding or license differ from policy")
    # The API does not return this flag on read; every status write sets it from the plan.
    if "containsSyntheticMedia" in status and status["containsSyntheticMedia"] != package["plan"]["aiDisclosure"]["required"]:
        failures.append("AI disclosure differs from the plan")
    if not package.get("playlistIds") or set(package["playlistIds"]) - set(state.get("playlists", [])):
        failures.append("playlist membership not confirmed")
    if package.get("captions") and not state.get("captions"):
        failures.append("captions not confirmed")
    ok, url = landing_ok(current["snippet"]["description"] + "\n" + package["plan"]["pinnedComment"], fetch)
    if not ok:
        failures.append(f"link does not load: {url}")
    if defaults is None:
        failures.append("channel-defaults receipt missing or older than 30 days")
    return failures


def schedule(api, package, state, current, events, ad_ids, now):
    related = list(package["plan"].get("relatedVideoIds", [])) + state.get("relatedVideoIds", [])
    if package["lane"] == "ad":
        related += [i for i in ad_ids if i != state["videoId"]]  # product offers stay a day apart
    uploaded = timestamp(state.get("uploadedAt") or current["snippet"]["publishedAt"])
    if package.get("notBefore"):
        uploaded = max(uploaded, timestamp(package["notBefore"]) - timedelta(hours=24))
    chosen = release_time(uploaded, now, [e for e in events if e["id"] != state["videoId"]], related)
    status = write_status(package, current)
    status["publishAt"] = chosen.isoformat().replace("+00:00", "Z")
    api.call("update", "PUT", "videos", {"part": "status"}, {"id": state["videoId"], "status": status})
    for attempt in range(4):  # reads right after a write can be stale
        after = video(api, state["videoId"])["status"]
        if after.get("publishAt") and timestamp(after["publishAt"]) == chosen and after["privacyStatus"] == "private":
            break
        time.sleep(4 * (attempt + 1))
    else:
        raise RuntimeError(f"YouTube did not confirm publishAt {chosen.isoformat()} for {state['videoId']}")
    state["publishAt"] = status["publishAt"]
    note(state, f"scheduled {status['publishAt']}")
    return {"id": state["videoId"], "at": chosen}


def write_status(package, current):
    """A status update replaces every writable field, so send them all. The AI-disclosure flag
    is not readable through the API; it always comes from the reviewed plan."""
    status = {k: current["status"][k] for k in STATUS_KEYS if k in current["status"]}
    status.update(privacyStatus="private", containsSyntheticMedia=package["plan"]["aiDisclosure"]["required"])
    return status


def unschedule(api, package, state, current):
    status = write_status(package, current)  # omitting publishAt clears it
    api.call("update", "PUT", "videos", {"part": "status"}, {"id": state["videoId"], "status": status})
    state.pop("publishAt", None)
    note(state, "VETO: schedule removed, video stays private")


def post_cta(api, package, state, channel):
    threads = api.call("list", "GET", "commentThreads", {"part": "snippet", "videoId": state["videoId"], "maxResults": 100})["items"]
    text = package["plan"]["pinnedComment"]
    mine = [t for t in threads if t["snippet"]["topLevelComment"]["snippet"].get("authorChannelId", {}).get("value") == channel
            and t["snippet"]["topLevelComment"]["snippet"].get("textOriginal", "").strip() == text.strip()]
    if mine:
        state["commentId"] = mine[0]["id"]
    else:
        made = api.call("insert", "POST", "commentThreads", {"part": "snippet"},
                        {"snippet": {"channelId": channel, "videoId": state["videoId"], "topLevelComment": {"snippet": {"textOriginal": text}}}})
        state["commentId"] = made["id"]
        note(state, "posted CTA comment")
    state["pin"] = "pending-browser"


# ---------------------------------------------------------------- tick

def tick(api, queue, state_dir, channel, now=None, run_uploader=None, fetch=None, dry_run=False):
    now = now or datetime.now(timezone.utc)
    packages = load_queue(queue)
    videos = channel_videos(api, channel)
    events = [e for e in (calendar_event(v) for v in videos.values()) if e]
    defaults = defaults_receipt(state_dir, now)
    ad_ids = {read_state(p["_dir"]).get("videoId") or p.get("videoId") for p in packages if p["lane"] == "ad"} - {None}
    report = []
    for package in packages:
        folder, state = package["_dir"], read_state(package["_dir"])
        state.pop("error", None)
        try:
            if package["_vetoed"]:
                current = videos.get(state.get("videoId") or package.get("videoId") or "")
                if current and current["status"]["privacyStatus"] == "private" and current["status"].get("publishAt") and not dry_run:
                    state.setdefault("videoId", current["id"])
                    unschedule(api, package, state, current)
                state["phase"] = "vetoed"
                continue
            if not ensure_uploaded(package, state, run_uploader, dry_run):
                state["phase"] = "would upload" if dry_run else "waiting for upload"
                continue
            current = videos.get(state.get("videoId")) or (video(api, state["videoId"]) if state.get("videoId") else None)
            if not current:
                state["phase"] = "waiting for upload"
                continue
            privacy = current["status"]["privacyStatus"]
            if privacy == "public":
                state["phase"] = "public"
                if not state.get("commentId") and not dry_run:
                    post_cta(api, package, state, channel)
                state["phase"] = "public, pin " + state.get("pin", "pending-browser")
                continue
            if privacy != "private":
                state["phase"] = f"{privacy}: the clerk only releases private uploads"
                continue
            if current["status"].get("publishAt"):
                state["publishAt"] = current["status"]["publishAt"]
                state["phase"] = "scheduled"
                continue
            if not dry_run:
                ensure_metadata(api, package, state, current)
            failures = review(package, state, current, defaults, fetch)
            state["review"] = {"checkedAt": now.isoformat(), "failures": failures}
            if failures:
                state["phase"] = "held: " + "; ".join(failures)
                continue
            if dry_run:
                state["phase"] = "would schedule"
                continue
            events.append(schedule(api, package, state, current, events, ad_ids, now))
            state["phase"] = "scheduled"
        except QuotaExhausted as error:
            state["phase"] = f"waiting for quota: {error}"
            log(f"{package['id']}: {error}")
        except Exception as error:  # noqa: BLE001 - noisy, recorded, and the next package still runs
            state["error"] = f"{type(error).__name__}: {error}"
            log(f"ERROR {package['id']}: {state['error']}")
        finally:
            if not dry_run:
                write_state(folder, state)
            report.append({"id": package["id"], "lane": package["lane"], "videoId": state.get("videoId"), "publishAt": state.get("publishAt"),
                           "phase": state.get("phase"), "error": state.get("error")})
    write_report(state_dir, report, events, now, api)
    return report


def write_report(state_dir, report, events, now, api):
    eastern = ZoneInfo("America/New_York")
    upcoming = sorted(e for e in ((e["at"], e["id"]) for e in events) if e[0] > now - timedelta(hours=24))
    used, day, _ = api.spent()
    lines = [f"# YouTube clerk status, {now.astimezone(eastern):%Y-%m-%d %H:%M %Z}", "", f"Quota used by the clerk today ({day} Pacific): {used} of {api.budget}", "",
             "## Calendar (last 24 h and ahead, ET)", ""]
    lines += [f"- {at.astimezone(eastern):%a %m-%d %H:%M}  {vid}" for at, vid in upcoming] or ["- nothing"]
    lines += ["", "## Queue", ""]
    lines += [f"- {r['id']} [{r['lane']}] {r['videoId'] or '-'}: {r['phase']}" + (f"  ERROR {r['error']}" if r["error"] else "") for r in report] or ["- empty"]
    state_dir.mkdir(parents=True, exist_ok=True)
    (state_dir / "clerk-status.md").write_text("\n".join(lines) + "\n")
    (state_dir / "clerk-status.json").write_text(json.dumps({"at": now.isoformat(), "queue": report}, indent=1, default=str) + "\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("command", choices=["tick", "status", "veto"])
    parser.add_argument("package", nargs="?")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    channel = os.environ["AMP_YOUTUBE_CHANNEL_ID"]
    root = Path(os.environ.get("AMP_YOUTUBE_STATE_DIR", Path.home() / ".local/state/corpora/youtube"))
    queue = Path(os.environ.get("AMP_YOUTUBE_QUEUE", root / "queue"))
    state_dir = root / channel
    if args.command == "status":
        print((state_dir / "clerk-status.md").read_text())
        return
    if args.command == "veto":
        if not args.package or not (queue / args.package / "package.json").exists():
            raise SystemExit("veto needs an existing package id")
        (queue / args.package / "VETO").write_text(datetime.now(timezone.utc).isoformat() + "\n")
        print(f"vetoed {args.package}; the next tick removes any pending schedule")
        return
    state_dir.mkdir(parents=True, exist_ok=True)
    uploader = Path(__file__).resolve().with_name("publish-lesson-youtube.py")
    run_uploader = lambda argv: subprocess.run([sys.executable, str(uploader), *argv], check=True)  # noqa: E731
    with (state_dir / "release.lock").open("a") as lock:  # shared with publish-lesson-youtube.py --schedule
        fcntl.flock(lock, fcntl.LOCK_EX)
        report = tick(YouTube(state_dir / "clerk-quota.json"), queue, state_dir, channel, run_uploader=run_uploader, dry_run=args.dry_run)
    for row in report:
        print(f"{row['id']}: {row['phase']}" + (f" ERROR {row['error']}" if row["error"] else ""))
    if any(r["error"] for r in report):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
