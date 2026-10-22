"""Arkansas Meta asset uploads and paused Sales campaigns through Marketing API.

No activation, token acquisition, pixels, or conversion export. A private journal
records intent before every write: an ambiguous result stops automatic retries.
"""

import argparse
import base64
import fcntl
import hashlib
import json
import os
import re
import stat
import sys
from datetime import date
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from pathlib import Path
from urllib.parse import urlencode, urlparse

import requests

VERSION = "v26.0"

# Individual v26 controls; standard_enhancements is rejected even with OPT_OUT.
CREATIVE_FEATURES = (
    "advantage_plus_creative", "adapt_to_placement", "add_text_overlay", "audio",
    "description_automation", "dynamic_cta_text", "enhance_cta", "image_animation",
    "image_auto_crop", "image_background_gen", "image_brightness_and_contrast",
    "image_enhancement", "image_templates", "image_touchups", "image_uncrop",
    "inline_comment", "music_generation", "profile_card", "text_generation",
    "text_optimizations", "text_translation", "translate_voiceover", "video_auto_crop",
    "video_filtering", "video_highlights", "video_to_image", "video_uncrop",
    "video_voiceover",
)


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def identifier(value):
    if not isinstance(value, str) or not re.fullmatch(r"[0-9]{1,30}", value):
        raise ValueError("Expected a numeric platform ID")
    return value


def exact_keys(value, required, optional=()):
    if not isinstance(value, dict) or not set(required) <= value.keys() or value.keys() - set(required) - set(optional):
        raise ValueError("Missing or unknown configuration fields")


def validate(spec):
    exact_keys(spec, ["id", "status", "state", "publisher", "placement", "daily_budget_cents", "url", "primary_text", "headline", "description", "image"], ["video"])
    if not re.fullmatch(r"[a-z0-9-]{1,48}", spec["id"]):
        raise ValueError("Use a stable lowercase campaign slug")
    if spec["status"] != "PAUSED" or spec["state"] != "Arkansas":
        raise ValueError("Only paused Arkansas campaigns are supported")
    if spec["publisher"] not in ["facebook", "instagram"] or spec["placement"] not in ["feed", "vertical"]:
        raise ValueError("Select one publisher and feed or vertical placements")
    if type(spec["daily_budget_cents"]) is not int or not 100 <= spec["daily_budget_cents"] <= 100000:
        raise ValueError("Daily budget must be integer USD cents between 100 and 100000")
    u = urlparse(spec["url"])
    if u.scheme != "https" or u.netloc not in ["corpora.inc", "amp.corpora.inc"] or u.query or u.fragment:
        raise ValueError("Use an HTTPS Corpora destination without query or fragment; UTMs are generated")
    for key, limit in [("primary_text", 500), ("headline", 40), ("description", 60)]:
        s = spec[key]
        if not isinstance(s, str) or not s.strip() or len(s) > limit or re.search(r"[\x00-\x08\x0b-\x1f\x7f]", s):
            raise ValueError(f"Invalid {key}; maximum {limit} characters")
    for key in ["image", "video"]:
        if key in spec and (not isinstance(spec[key], str) or not spec[key]):
            raise ValueError("Media must name a local file")
    return spec


def config_load(path):
    c = json.loads(Path(path).read_text())
    exact_keys(c, ["account_id", "allowed_account_ids", "page_id", "pixel_id", "credentials", "media_root", "max_daily_budget_cents"], ["instagram_user_id"])
    for k in ["account_id", "page_id", "pixel_id"]:
        identifier(c[k])
    if not isinstance(c["allowed_account_ids"], list) or c["account_id"] not in c["allowed_account_ids"]:
        raise ValueError("Ad account is not allowlisted")
    if type(c["max_daily_budget_cents"]) is not int or c["max_daily_budget_cents"] < 100:
        raise ValueError("Set an explicit budget ceiling")
    if c.get("instagram_user_id"):
        identifier(c["instagram_user_id"])
    return c


class Graph:
    def __init__(self, config):
        p = Path(config["credentials"]).expanduser()
        if not p.is_file() or stat.S_IMODE(p.stat().st_mode) & 0o077:
            raise ValueError("Credentials must be an owner-readable private file (mode 600)")
        token = json.loads(p.read_text())["access_token"]
        if not isinstance(token, str) or not token or re.search(r"\s", token):
            raise ValueError("Invalid access token")
        self.session = requests.Session()
        self.session.headers["Authorization"] = "Bearer " + token
        # Environment proxies and netrc must not redirect credential-bearing calls.
        self.session.trust_env = False

    def call(self, method, path, params=None, media=None):
        if not re.fullmatch(r"(?:act_)?[0-9]+(?:/[a-z_]+)?|search", path):
            raise ValueError("Invalid Graph resource path")
        data = {k: json.dumps(v, separators=(",", ":")) if isinstance(v, (dict, list, bool)) else v for k, v in (params or {}).items()}
        host = "graph-video.facebook.com" if media else "graph.facebook.com"
        kwargs = {"params" if method == "GET" else "data": data}
        try:
            if media:
                with open(media, "rb") as f:
                    response = self.session.request(method, f"https://{host}/{VERSION}/{path}", files={"source": ("creative.mp4", f, "video/mp4")}, timeout=(15, 180), allow_redirects=False, **kwargs)
            else:
                response = self.session.request(method, f"https://{host}/{VERSION}/{path}", timeout=(15, 60), allow_redirects=False, **kwargs)
            value = response.json()
        except (requests.RequestException, ValueError):
            raise RuntimeError("Graph request failed or its result is unknown; inspect before retrying a write") from None
        if not isinstance(value, dict):
            raise RuntimeError("Unexpected Graph response; inspect before retrying a write")
        if response.status_code != 200 or "error" in value:
            error = value.get("error", {}) if isinstance(value, dict) else {}
            code = error.get("code")
            safe_code = str(code) if type(code) is int else "unknown"
            raise RuntimeError(f"Graph rejected request (HTTP {response.status_code}, code {safe_code}); no response body logged")
        return value

    def all(self, path, params=None):
        params = {**(params or {}), "limit": 100}
        result, seen = [], set()
        for _ in range(100):
            page = self.call("GET", path, params)
            result.extend(page["data"])
            if not page.get("paging", {}).get("next"):
                return result
            # Never follow paging URLs, which can contain tokens or foreign hosts.
            after = page.get("paging", {}).get("cursors", {}).get("after")
            if not after or after in seen:
                raise RuntimeError("Invalid pagination; inventory is incomplete")
            seen.add(after)
            params["after"] = after
        raise RuntimeError("Inventory exceeds page limit")


def inspect(graph, c):
    account = graph.call("GET", "act_" + c["account_id"], {"fields": "id,account_id,name,account_status,currency,timezone_name"})
    if account.get("account_id") != c["account_id"] or account.get("currency") != "USD":
        raise ValueError("Account identity or currency mismatch")
    page = graph.call("GET", c["page_id"], {"fields": "id,name,instagram_business_account"})
    if page.get("id") != c["page_id"]:
        raise ValueError("Page identity mismatch")
    pixels = graph.all("act_" + c["account_id"] + "/adspixels", {"fields": "id,name"})
    if c["pixel_id"] not in [x["id"] for x in pixels]:
        raise ValueError("Purchase dataset is not available to this account")
    campaigns = graph.all("act_" + c["account_id"] + "/campaigns", {"fields": "id,name,status,effective_status,objective"})
    return {"account": account, "page": page, "pixels": pixels, "campaigns": campaigns}


def arkansas(graph):
    rows = graph.all("search", {"type": "adgeolocation", "location_types": ["region"], "country_code": "US", "q": "Arkansas"})
    matches = [r for r in rows if r.get("name") == "Arkansas" and r.get("country_code") == "US" and r.get("type") == "region"]
    if len(matches) != 1:
        raise ValueError("Could not uniquely resolve Arkansas in Meta's geographic catalog")
    return identifier(str(matches[0]["key"]))


def report(graph, c, inventory, since, until):
    start, end = date.fromisoformat(since), date.fromisoformat(until)
    if start > end or (end - start).days > 92 or start.isoformat() != since or end.isoformat() != until:
        raise ValueError("Use an inclusive ISO date range of at most 93 days")
    timezone = inventory.get("account", {}).get("timezone_name")
    try:
        if not isinstance(timezone, str) or not timezone:
            raise ValueError("Missing account time zone")
        ZoneInfo(timezone)
    except (ValueError, ZoneInfoNotFoundError):
        raise ValueError("Report requires a valid account time zone") from None
    campaigns = [identifier(row["id"]) for row in inventory["campaigns"] if row["name"].startswith("AMP | AR | ")]
    if len(campaigns) > 100:
        raise ValueError("Report campaign limit exceeded; narrow the inventory before reporting")
    query = {
        "fields": "date_start,date_stop,campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,impressions,reach,spend,clicks,inline_link_clicks,actions,action_values,cost_per_action_type",
        "level": "ad", "time_increment": 1,
        "time_range": {"since": since, "until": until},
        "filtering": [{"field": "campaign.id", "operator": "IN", "value": campaigns}],
        "breakdowns": ["publisher_platform", "platform_position"],
        "action_attribution_windows": ["7d_click"], "action_report_time": "conversion",
    }
    return {
        "api_version": VERSION, "account_id": c["account_id"], "currency": "USD",
        "timezone": timezone, "date_range": {"since": since, "until": until, "inclusive": True},
        "query": query, "rows": graph.all("act_" + c["account_id"] + "/insights", query) if campaigns else [],
        "interpretation": "Platform attribution, not verified EFA settlement. Dates use the advertiser time zone; AMP cash evidence uses UTC. Align time boundaries before comparing periods. Reach is not additive across rows. Incomplete recent attribution can change.",
    }


def media_files(spec, root, spec_dir):
    root = Path(root).expanduser().resolve(strict=True)
    result = {}
    for key in ["image", "video"]:
        if key not in spec:
            continue
        p = (Path(spec_dir) / spec[key]).resolve(strict=True)
        if not p.is_relative_to(root) or not p.is_file():
            raise ValueError("Media must be a file inside the configured media root")
        max_size = (20 if key == "image" else 100) * 1024 * 1024
        if not 0 < p.stat().st_size <= max_size:
            raise ValueError("Image exceeds 20 MiB or video exceeds 100 MiB")
        with p.open("rb") as f:
            header = f.read(16)
        if key == "image" and not (header.startswith(b"\x89PNG\r\n\x1a\n") or header.startswith(b"\xff\xd8\xff")):
            raise ValueError("Images must be PNG or JPEG")
        if key == "video" and header[4:8] != b"ftyp":
            raise ValueError("Videos must be MP4")
        result[key] = {"path": str(p), "sha256": hashlib.sha256(p.read_bytes()).hexdigest()}
    return result


def plan(spec, c, region, media):
    if spec["daily_budget_cents"] > c["max_daily_budget_cents"]:
        raise ValueError("Proposed daily budget exceeds the operator ceiling")
    if spec["publisher"] == "instagram" and not c.get("instagram_user_id"):
        raise ValueError("Instagram placements require the connected professional account ID")
    identity = {k: c.get(k) for k in ["account_id", "page_id", "pixel_id", "instagram_user_id"]}
    key = digest({"version": VERSION, "spec": spec, "identity": identity, "region": region, "media": {k: v["sha256"] for k, v in media.items()}})
    name = f"AMP | AR | {spec['id']} | {key[:12]}"
    publisher = spec["publisher"]
    positions = ["feed"] if spec["placement"] == "feed" else (["facebook_reels"] if publisher == "facebook" else ["story", "reels"])
    return {
        "fingerprint": key,
        "campaign": {"name": name, "objective": "OUTCOME_SALES", "buying_type": "AUCTION", "status": "PAUSED", "special_ad_categories": [], "is_adset_budget_sharing_enabled": False},
        "adset": {
            "name": name + " | " + publisher + " | " + spec["placement"],
            "status": "PAUSED", "daily_budget": spec["daily_budget_cents"],
            "billing_event": "IMPRESSIONS", "optimization_goal": "OFFSITE_CONVERSIONS",
            "bid_strategy": "LOWEST_COST_WITHOUT_CAP", "destination_type": "WEBSITE",
            "is_dynamic_creative": False,
            "promoted_object": {"pixel_id": c["pixel_id"], "custom_event_type": "PURCHASE"},
            "attribution_spec": [{"event_type": "CLICK_THROUGH", "window_days": 7}],
            "targeting": {"geo_locations": {"regions": [{"key": region}], "location_types": ["home", "recent", "frequently_in"]}, "age_min": 18, "age_max": 65, "publisher_platforms": [publisher], publisher + "_positions": positions, "targeting_automation": {"advantage_audience": 0}},
        },
        "media": media,
        "url_tags": urlencode({"utm_source": publisher, "utm_medium": "paid-social", "utm_campaign": "ar-efa-launch", "utm_content": spec["id"]}),
    }


def creative(spec, c, p, image_hash, video_id=None):
    story = {"page_id": c["page_id"]}
    if spec["publisher"] == "instagram":
        story["instagram_user_id"] = c["instagram_user_id"]
    cta = {"type": "LEARN_MORE", "value": {"link": spec["url"]}}
    common = {"message": spec["primary_text"], "image_hash": image_hash, "call_to_action": cta}
    if video_id:
        story["video_data"] = {**common, "video_id": video_id, "title": spec["headline"], "link_description": spec["description"]}
    else:
        story["link_data"] = {**common, "link": spec["url"], "name": spec["headline"], "description": spec["description"]}
    return {"name": p["campaign"]["name"] + " | creative", "object_story_spec": story, "url_tags": p["url_tags"], "contextual_multi_ads": {"enroll_status": "OPT_OUT"}, "degrees_of_freedom_spec": {"creative_features_spec": {feature: {"enroll_status": "OPT_OUT"} for feature in CREATIVE_FEATURES}}}


class Journal:
    """One local operator, one manifest; fsync intent before a network mutation."""
    def __init__(self, path, fingerprint):
        self.path = Path(path).expanduser()
        fd = os.open(self.path, os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
        self.file = os.fdopen(fd, "r+")
        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            if stat.S_IMODE(os.fstat(fd).st_mode) & 0o077:
                raise ValueError("Journal must be private (mode 600)")
            content = self.file.read()
            self.value = json.loads(content) if content else {"fingerprint": fingerprint, "steps": {}}
            if self.value["fingerprint"] != fingerprint:
                raise ValueError("Journal belongs to another specification/account/media revision")
            if self.value.get("pending"):
                raise RuntimeError("Journal has an uncertain write; inspect the account and reconcile manually before proceeding")
        except BaseException:
            self.file.close()
            raise

    def save(self):
        self.file.seek(0)
        json.dump(self.value, self.file, indent=2)
        self.file.truncate()
        self.file.flush()
        os.fsync(self.file.fileno())

    def step(self, name, run):
        if name in self.value["steps"]:
            return self.value["steps"][name]
        self.value["pending"] = name
        self.save()
        value = run()
        self.value["steps"][name] = value
        del self.value["pending"]
        self.save()
        return value

    def close(self):
        self.file.close()


def subset(actual, expected):
    if isinstance(expected, dict):
        return isinstance(actual, dict) and all(k in actual and subset(actual[k], v) for k, v in expected.items())
    if isinstance(expected, list):
        if not isinstance(actual, list) or len(actual) != len(expected):
            return False
        remaining = list(actual)
        for e in expected:
            match = next((i for i, a in enumerate(remaining) if subset(a, e)), None)
            if match is None:
                return False
            remaining.pop(match)
        return True
    if type(expected) is int:
        return str(actual) == str(expected)
    return actual == expected


def verify(graph, resource, expected):
    actual = graph.call("GET", identifier(resource), {"fields": ",".join(expected)})
    if not subset(actual, expected):
        raise RuntimeError("Platform readback differs from the paused specification; inspect before continuing")
    if "targeting" in expected:
        # Extra geographic/audience/placement fields could broaden delivery.
        target, wanted = actual["targeting"], expected["targeting"]
        if target.keys() != wanted.keys() or target["geo_locations"].keys() != wanted["geo_locations"].keys():
            raise RuntimeError("Unexpected targeting fields require manual review")
    if "degrees_of_freedom_spec" in expected:
        # Meta returns additional controls. Never accept an unexpected enrollment.
        features = actual["degrees_of_freedom_spec"]["creative_features_spec"]
        if any(not isinstance(value, dict) or value.get("enroll_status") != "OPT_OUT"
               for value in features.values()):
            raise RuntimeError("Creative enhancement enrollment requires manual review")
    return actual


def apply(graph, c, spec, p, inventory, journal):
    prefix = f"AMP | AR | {spec['id']} | "
    existing = [x for x in inventory["campaigns"] if x["name"].startswith(prefix)]
    known = journal.value["steps"].get("campaign")
    if existing and (len(existing) != 1 or existing[0]["id"] != known):
        raise RuntimeError("Campaign slug already exists outside this journal; inspect rather than duplicate")
    if known:
        verify(graph, known, p["campaign"])
    edge = "act_" + c["account_id"]
    campaign_id = journal.step("campaign", lambda: identifier(graph.call("POST", edge + "/campaigns", p["campaign"])["id"]))
    verify(graph, campaign_id, p["campaign"])
    aset = {**p["adset"], "campaign_id": campaign_id}
    adset_id = journal.step("adset", lambda: identifier(graph.call("POST", edge + "/adsets", aset)["id"]))
    verify(graph, adset_id, aset)

    def upload_image():
        image = Path(p["media"]["image"]["path"]).read_bytes()
        if hashlib.sha256(image).hexdigest() != p["media"]["image"]["sha256"]:
            raise ValueError("Image changed after planning")
        response = graph.call("POST", edge + "/adimages", {"bytes": base64.b64encode(image).decode()})
        images = list(response["images"].values())
        if len(images) != 1 or not re.fullmatch(r"[a-fA-F0-9]{32}", images[0]["hash"]):
            raise RuntimeError("Unexpected image upload response")
        return images[0]["hash"]

    image_hash = journal.step("image", upload_image)
    video_id = None
    if "video" in p["media"]:
        def upload_video():
            path = p["media"]["video"]["path"]
            if hashlib.sha256(Path(path).read_bytes()).hexdigest() != p["media"]["video"]["sha256"]:
                raise ValueError("Video changed after planning")
            return identifier(graph.call("POST", edge + "/advideos", {"title": p["campaign"]["name"]}, media=path)["id"])
        video_id = journal.step("video", upload_video)
        status = graph.call("GET", video_id, {"fields": "status"})
        if status.get("status", {}).get("video_status") != "ready":
            raise RuntimeError("Video processing is not ready; rerun with the same journal after processing")
    cre = creative(spec, c, p, image_hash, video_id)
    creative_id = journal.step("creative", lambda: identifier(graph.call("POST", edge + "/adcreatives", cre)["id"]))
    # Creation may append a generated suffix. Check identity/content before the
    # supported name update, journal it, then verify the complete specification.
    verify(graph, creative_id, {k: v for k, v in cre.items() if k != "name"})
    def normalize_creative_name():
        response = graph.call("POST", creative_id, {"name": cre["name"]})
        if response.get("success") is not True:
            raise RuntimeError("Creative name update was not confirmed; reconcile before retrying")
        return {"success": True}
    journal.step("creative_name", normalize_creative_name)
    verify(graph, creative_id, cre)
    ad = {"name": p["campaign"]["name"] + " | ad", "adset_id": adset_id, "creative": {"creative_id": creative_id}, "status": "PAUSED"}
    ad_id = journal.step("ad", lambda: identifier(graph.call("POST", edge + "/ads", ad)["id"]))
    # Creative reads expose id; creation accepts creative_id.
    verify(graph, ad_id, {**ad, "creative": {"id": creative_id}})
    verify(graph, campaign_id, p["campaign"])
    verify(graph, adset_id, aset)
    return {"status": "PAUSED", "campaign_id": campaign_id, "adset_id": adset_id, "creative_id": creative_id, "ad_id": ad_id, "fingerprint": p["fingerprint"]}


def write_private(path, value):
    fd = os.open(Path(path).expanduser(), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w") as f:
        json.dump(value, f, indent=2)
        f.write("\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["validate", "plan", "inspect", "report", "apply-paused"])
    parser.add_argument("--spec")
    parser.add_argument("--config")
    parser.add_argument("--output")
    parser.add_argument("--journal")
    parser.add_argument("--since")
    parser.add_argument("--until")
    args = parser.parse_args()
    spec = validate(json.loads(Path(args.spec).read_text())) if args.spec else None
    if args.command == "validate":
        if spec is None:
            raise ValueError("--spec required")
        print("Valid paused Arkansas Meta specification; platform eligibility has not been checked.")
        return
    if not args.config or not args.output:
        raise ValueError("--config and a new private --output path are required")
    args.output = str(Path(args.output).expanduser())
    if Path(args.output).exists():
        raise ValueError("Output already exists; select a new report path")
    c = config_load(args.config)
    graph = Graph(c)
    inventory = inspect(graph, c)
    if args.command == "inspect":
        write_private(args.output, inventory)
        print("Account inventory written; no mutations made.")
        return
    if args.command == "report":
        if not args.since or not args.until:
            raise ValueError("Reporting requires --since and --until dates")
        write_private(args.output, report(graph, c, inventory, args.since, args.until))
        print("Daily ad and placement report written; no mutations made.")
        return
    if spec is None:
        raise ValueError("--spec required")
    if spec["publisher"] == "instagram" and inventory["page"].get("instagram_business_account", {}).get("id") != c.get("instagram_user_id"):
        raise ValueError("Configured Instagram identity is not connected to this Page")
    p = plan(spec, c, arkansas(graph), media_files(spec, c["media_root"], Path(args.spec).resolve().parent))
    if args.command == "plan":
        write_private(args.output, p)
        print("API inventory and geographic lookup checked; mutation eligibility is not yet validated. No resources created.")
        return
    if not args.journal:
        raise ValueError("--journal required for recoverable writes")
    journal = Journal(args.journal, p["fingerprint"])
    try:
        result = apply(graph, c, spec, p, inventory, journal)
        write_private(args.output, result)
    finally:
        journal.close()
    print("Created or verified paused campaign, ad set, creative and ad. Delivery remains disabled.")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, RuntimeError, OSError, KeyError, TypeError) as error:
        # Parser/filesystem exception text can contain private paths or payloads.
        safe = str(error) if type(error) in [ValueError, RuntimeError] else type(error).__name__
        print("Stopped: " + safe, file=sys.stderr)
        sys.exit(1)
