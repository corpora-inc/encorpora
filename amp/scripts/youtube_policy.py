"""Shared release decisions. Pure functions: no credentials or network writes."""
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

POLICY_VERSION = "2026-10-30"
TIMEZONE = ZoneInfo("America/New_York")
VOICES = {"XescS24CsOySAkKrLAO3", "J3Ei0Lj6fAobhIqY5ySH"}
CHECKS = {
    "audience", "commentsOn", "everyoneCanComment", "basicModeration",
    "likesVisible", "notifySubscribers", "captions", "thumbnail", "playlist",
    "landingPage", "copyrightChecks", "aiDisclosure", "endScreenOrRelatedVideo",
}


def timestamp(value):
    result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if result.tzinfo is None:
        raise ValueError("A release timestamp must include its timezone")
    return result.astimezone(timezone.utc)


def calendar_event(item):
    status = item["status"]
    at = status.get("publishAt") if status["privacyStatus"] == "private" else None
    if status["privacyStatus"] == "public":
        live = item.get("liveStreamingDetails", {})
        at = live.get("actualStartTime") or live.get("scheduledStartTime") or item["snippet"]["publishedAt"]
    return {"id": item["id"], "at": timestamp(at)} if at else None


def validate_plan(plan):
    if plan.get("policyVersion") != POLICY_VERSION:
        raise ValueError("Read the current YouTube publishing policy")
    if plan.get("contentType") not in {"explanation", "tutoring", "ad"}:
        raise ValueError("Unknown content type; add a reviewed preset")
    audience = plan.get("audience", {})
    if audience.get("classification") != "general" or not audience.get("rationale", "").strip():
        raise ValueError("This parent/general-audience preset needs an accurate audience rationale; child-directed content needs a separate reviewed workflow")
    disclosure = plan.get("aiDisclosure", {})
    if type(disclosure.get("required")) is not bool or not disclosure.get("rationale", "").strip():
        raise ValueError("Record the actual AI-disclosure decision and rationale")
    if "https://amp.corpora.inc" not in plan.get("pinnedComment", ""):
        raise ValueError("Prepare the AMP pinned CTA before upload")
    if type(plan.get("relatedVideoIds")) is not list:
        raise ValueError("Record related editions, or an empty list for a new concept")


def validate_review(plan, receipt, current, now):
    if current["status"]["privacyStatus"] != "private":
        raise ValueError("Scheduling never changes a public or unlisted video to private")
    if current.get("processingDetails", {}).get("processingStatus") != "succeeded":
        raise ValueError("Video processing has not finished")
    review = plan.get("studioReview", {})
    if review.get("videoId") != receipt["videoId"]:
        raise ValueError("Studio review must identify this uploaded video")
    reviewed = timestamp(review.get("checkedAt", ""))
    if reviewed > now or now - reviewed > timedelta(hours=24):
        raise ValueError("Studio review must be current (within 24 hours)")
    if reviewed < timestamp(receipt["uploadedAt"]):
        raise ValueError("Review predates the upload")
    missing = sorted(key for key in CHECKS if review.get("checks", {}).get(key) is not True)
    if missing:
        raise ValueError("Incomplete Studio review: " + ", ".join(missing))


def allowed_slot(candidate, uploaded, now, events, related_ids=()):
    if candidate <= now or candidate < uploaded + timedelta(hours=12):
        return False
    if any(abs(candidate - event["at"]) < timedelta(hours=6) for event in events):
        return False
    if any(event["id"] in related_ids and abs(candidate - event["at"]) < timedelta(hours=24) for event in events):
        return False
    # Check all rolling windows containing this release, including scheduled
    # future neighbors. Calendar-day counting would fail across midnight/DST.
    neighbors = [event["at"] for event in events if abs(candidate - event["at"]) < timedelta(hours=24)]
    times = sorted(neighbors + [candidate])
    for i in range(len(times) - 2):
        if times[i] <= candidate <= times[i + 2] and times[i + 2] - times[i] < timedelta(hours=24):
            return False
    return True


def release_time(uploaded, now, events, related_ids=(), requested=None):
    if requested:
        chosen = timestamp(requested)
        if not allowed_slot(chosen, uploaded, now, events, related_ids):
            raise ValueError("Release violates the 12-hour hold, spacing, related-edition separation, or two-per-24-hour cap")
        return chosen
    target = uploaded + timedelta(hours=24)
    start = max(now, target - timedelta(hours=12)).astimezone(TIMEZONE).date()
    slots = [datetime.combine(start + timedelta(days=d), datetime.min.time(), TIMEZONE).replace(hour=hour).astimezone(timezone.utc)
             for d in range(8) for hour in (12, 18)]
    for slot in sorted(slots, key=lambda value: (abs(value - target), value)):
        if allowed_slot(slot, uploaded, now, events, related_ids):
            return slot
    raise ValueError("No compliant slot in the next eight days; retain the private upload")
