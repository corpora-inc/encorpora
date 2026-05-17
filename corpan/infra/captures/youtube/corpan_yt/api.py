"""Thin wrappers around googleapiclient.discovery for YouTube Data API v3.

Each function corresponds to one HTTP roundtrip; quota costs (in units, out
of the project's daily 10,000) are documented inline. See
https://developers.google.com/youtube/v3/determine_quota_cost.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterator

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload

API_SERVICE_NAME = "youtube"
API_VERSION = "v3"


@dataclass
class ChannelInfo:
    id: str
    title: str
    handle: str | None
    uploads_playlist_id: str


def youtube_client(creds: Credentials):
    """Build a discovery client. Cache-disabled to avoid file-cache warnings."""
    return build(API_SERVICE_NAME, API_VERSION, credentials=creds, cache_discovery=False)


# ---------- read (1 unit each, mostly) ----------

def get_my_channel(yt) -> ChannelInfo:
    """channels.list(mine=true) — 1 unit."""
    resp = yt.channels().list(
        part="snippet,contentDetails",
        mine=True,
    ).execute()
    items = resp.get("items", [])
    if not items:
        raise RuntimeError("No channel found for authorized account.")
    item = items[0]
    snippet = item["snippet"]
    return ChannelInfo(
        id=item["id"],
        title=snippet["title"],
        handle=snippet.get("customUrl"),
        uploads_playlist_id=item["contentDetails"]["relatedPlaylists"]["uploads"],
    )


def list_recent_uploads(yt, uploads_playlist_id: str, n: int = 25) -> list[dict[str, Any]]:
    """playlistItems.list — 1 unit per page (max 50/page)."""
    out: list[dict[str, Any]] = []
    page_token: str | None = None
    while len(out) < n:
        resp = yt.playlistItems().list(
            part="snippet,contentDetails,status",
            playlistId=uploads_playlist_id,
            maxResults=min(50, n - len(out)),
            pageToken=page_token,
        ).execute()
        out.extend(resp.get("items", []))
        page_token = resp.get("nextPageToken")
        if not page_token:
            break
    return out[:n]


def get_video(yt, video_id: str) -> dict[str, Any]:
    """videos.list(id=...) — 1 unit."""
    resp = yt.videos().list(
        part="snippet,status,contentDetails,statistics",
        id=video_id,
    ).execute()
    items = resp.get("items", [])
    if not items:
        raise RuntimeError(f"Video {video_id} not found (or not visible to this account).")
    return items[0]


def get_channel_full(yt, channel_id: str) -> dict[str, Any]:
    """channels.list(id=...) with brandingSettings — 1 unit."""
    resp = yt.channels().list(
        part="snippet,brandingSettings,status,statistics,contentDetails",
        id=channel_id,
    ).execute()
    items = resp.get("items", [])
    if not items:
        raise RuntimeError(f"Channel {channel_id} not found.")
    return items[0]


def update_channel_branding(
    yt,
    *,
    channel_id: str,
    title: str | None = None,
    description: str | None = None,
    keywords: str | None = None,           # space-separated tags
    country: str | None = None,            # ISO 3166-1 alpha-2
    default_language: str | None = None,
    unsubscribed_trailer: str | None = None,  # video_id for channel trailer
) -> dict[str, Any]:
    """channels.update(part=brandingSettings) — 50 units.

    customUrl (the @handle) is read-only via the API; change it in YT Studio.
    """
    existing = get_channel_full(yt, channel_id)
    bs = existing.get("brandingSettings", {})
    channel = dict(bs.get("channel", {}))

    if title is not None:
        channel["title"] = title
    if description is not None:
        channel["description"] = description
    if keywords is not None:
        channel["keywords"] = keywords
    if country is not None:
        channel["country"] = country
    if default_language is not None:
        channel["defaultLanguage"] = default_language
    if unsubscribed_trailer is not None:
        channel["unsubscribedTrailer"] = unsubscribed_trailer

    body = {
        "id": channel_id,
        "brandingSettings": {"channel": channel},
    }
    return yt.channels().update(part="brandingSettings", body=body).execute()


def set_channel_banner(yt, *, channel_id: str, jpg_path: Path) -> str:
    """Two-step: channelBanners.insert (returns URL) + channels.update brandingSettings.

    channelBanners.insert costs 0 docs-wise; channels.update is 50 units.
    YouTube recommends 2048×1152, ≤6 MB, JPG/PNG/GIF/BMP.
    Returns the bannerExternalUrl (a Google-hosted CDN URL).
    """
    media = MediaFileUpload(str(jpg_path), mimetype="image/jpeg", resumable=False)
    insert_resp = yt.channelBanners().insert(media_body=media).execute()
    banner_url = insert_resp["url"]

    existing = get_channel_full(yt, channel_id)
    bs = existing.get("brandingSettings", {})
    body = {
        "id": channel_id,
        "brandingSettings": {
            "channel": dict(bs.get("channel", {})),
            "image": {**dict(bs.get("image", {})), "bannerExternalUrl": banner_url},
        },
    }
    yt.channels().update(part="brandingSettings", body=body).execute()
    return banner_url


def set_watermark(yt, *, channel_id: str, image_path: Path,
                  timing_type: str = "offsetFromStart",
                  timing_offset_ms: int = 0,
                  duration_ms: int = 15000) -> dict[str, Any]:
    """watermarks.set — 50 units.

    Small logo overlay shown bottom-right of every video on the channel
    (link to subscribe). YouTube's watermark endpoint is finicky:

    - JPEG works reliably; PNG can be rejected with "Invalid Value".
    - `timing` is REQUIRED (omitting it returns "Required").
    - `offsetFromStart` is the safer default; `offsetFromEnd` w/ offsetMs=0
       is paradoxical and sometimes rejected.

    Mimetype is auto-detected from the file extension.
    """
    suffix = image_path.suffix.lower()
    mimetype = "image/jpeg" if suffix in (".jpg", ".jpeg") else "image/png"
    media = MediaFileUpload(str(image_path), mimetype=mimetype, resumable=False)
    body = {
        "timing": {
            "type": timing_type,
            "offsetMs": timing_offset_ms,
            "durationMs": duration_ms,
        },
        "position": {"type": "corner", "cornerPosition": "bottomRight"},
    }
    return yt.watermarks().set(channelId=channel_id, body=body, media_body=media).execute()


def update_channel_localizations(yt, *, channel_id: str,
                                 localizations: dict[str, dict[str, str]]) -> dict[str, Any]:
    """channels.update(part=localizations) — 50 units.

    localizations = {locale_code: {"title": ..., "description": ...}, ...}
    Locale codes: BCP-47 ("ar", "fr", "es", "tr", "zh-Hans", ...).
    """
    body = {
        "id": channel_id,
        "localizations": localizations,
    }
    return yt.channels().update(part="localizations", body=body).execute()


def list_my_playlists(yt) -> list[dict[str, Any]]:
    """playlists.list(mine=true) — 1 unit per page."""
    out: list[dict[str, Any]] = []
    page_token: str | None = None
    while True:
        resp = yt.playlists().list(
            part="snippet,status,contentDetails",
            mine=True,
            maxResults=50,
            pageToken=page_token,
        ).execute()
        out.extend(resp.get("items", []))
        page_token = resp.get("nextPageToken")
        if not page_token:
            break
    return out


# ---------- write (50 units each, except insert=1600) ----------

def upload_video(
    yt,
    *,
    media_path: Path,
    title: str,
    description: str,
    tags: list[str],
    category_id: int,
    privacy: str,
    default_audio_language: str | None,
    default_language: str | None,
    made_for_kids: bool,
    progress_cb=None,
) -> str:
    """videos.insert (resumable) — 1600 units. Returns video_id."""
    body = {
        "snippet": {
            "title": title,
            "description": description,
            "tags": tags,
            "categoryId": str(category_id),
        },
        "status": {
            "privacyStatus": privacy,
            "selfDeclaredMadeForKids": made_for_kids,
            "embeddable": True,
        },
    }
    if default_audio_language:
        body["snippet"]["defaultAudioLanguage"] = default_audio_language
    if default_language:
        body["snippet"]["defaultLanguage"] = default_language

    media = MediaFileUpload(
        str(media_path),
        chunksize=8 * 1024 * 1024,
        resumable=True,
        mimetype="video/mp4",
    )
    req = yt.videos().insert(part="snippet,status", body=body, media_body=media)

    response = None
    last_progress = -1
    while response is None:
        status, response = req.next_chunk()
        if status and progress_cb is not None:
            pct = int(status.progress() * 100)
            if pct != last_progress:
                progress_cb(pct)
                last_progress = pct
    return response["id"]


def update_video(
    yt,
    *,
    video_id: str,
    title: str | None = None,
    description: str | None = None,
    tags: list[str] | None = None,
    category_id: int | None = None,
    privacy: str | None = None,
    default_audio_language: str | None = None,
    default_language: str | None = None,
) -> dict[str, Any]:
    """videos.update — 50 units.

    Must include the whole part being patched, so we read first, mutate,
    then write. This still costs 1 (videos.list) + 50 (videos.update) = 51.
    """
    existing = get_video(yt, video_id)
    snippet = existing["snippet"]
    status = existing["status"]

    parts_to_send: list[str] = []
    snippet_dirty = False
    status_dirty = False

    if title is not None:
        snippet["title"] = title
        snippet_dirty = True
    if description is not None:
        snippet["description"] = description
        snippet_dirty = True
    if tags is not None:
        snippet["tags"] = tags
        snippet_dirty = True
    if category_id is not None:
        snippet["categoryId"] = str(category_id)
        snippet_dirty = True
    if default_audio_language is not None:
        snippet["defaultAudioLanguage"] = default_audio_language
        snippet_dirty = True
    if default_language is not None:
        snippet["defaultLanguage"] = default_language
        snippet_dirty = True
    if privacy is not None:
        status["privacyStatus"] = privacy
        status_dirty = True

    body: dict[str, Any] = {"id": video_id}
    if snippet_dirty:
        body["snippet"] = {
            "title": snippet["title"],
            "description": snippet.get("description", ""),
            "tags": snippet.get("tags", []),
            "categoryId": snippet["categoryId"],
        }
        if "defaultAudioLanguage" in snippet:
            body["snippet"]["defaultAudioLanguage"] = snippet["defaultAudioLanguage"]
        if "defaultLanguage" in snippet:
            body["snippet"]["defaultLanguage"] = snippet["defaultLanguage"]
        parts_to_send.append("snippet")
    if status_dirty:
        body["status"] = {"privacyStatus": status["privacyStatus"]}
        parts_to_send.append("status")

    if not parts_to_send:
        return existing

    return yt.videos().update(part=",".join(parts_to_send), body=body).execute()


def set_thumbnail(yt, *, video_id: str, jpg_path: Path) -> dict[str, Any]:
    """thumbnails.set — 50 units. JPEG ≤ 2 MB, ideally 1280×720."""
    media = MediaFileUpload(str(jpg_path), mimetype="image/jpeg", resumable=False)
    return yt.thumbnails().set(videoId=video_id, media_body=media).execute()


def ensure_playlist(yt, *, title: str, description: str = "", privacy: str = "unlisted") -> str:
    """Find playlist by exact title, else create. Returns playlist_id.

    Cost: 1 (list) + 0 or 50 (insert).
    """
    for pl in list_my_playlists(yt):
        if pl["snippet"]["title"] == title:
            return pl["id"]
    resp = yt.playlists().insert(
        part="snippet,status",
        body={
            "snippet": {"title": title, "description": description},
            "status": {"privacyStatus": privacy},
        },
    ).execute()
    return resp["id"]


def add_to_playlist(yt, *, playlist_id: str, video_id: str) -> tuple[str, bool]:
    """playlistItems.insert with dedupe. Returns (playlist_item_id, was_inserted).

    `playlistItems.insert` doesn't dedupe server-side — calling it twice for
    the same (playlist, video) creates two distinct items. We list first
    (1 unit) and only insert (50 units) if the video isn't already there.
    """
    existing = yt.playlistItems().list(
        part="id", playlistId=playlist_id, videoId=video_id, maxResults=1
    ).execute()
    items = existing.get("items", [])
    if items:
        return items[0]["id"], False
    resp = yt.playlistItems().insert(
        part="snippet",
        body={
            "snippet": {
                "playlistId": playlist_id,
                "resourceId": {"kind": "youtube#video", "videoId": video_id},
            }
        },
    ).execute()
    return resp["id"], True


# ---------- helpers ----------

def retry_on_5xx(fn, *, tries: int = 4, base: float = 1.5):
    """Wrap a callable, retrying on 5xx / quota / network errors with backoff."""
    def wrapped(*a, **kw):
        last: Exception | None = None
        for i in range(tries):
            try:
                return fn(*a, **kw)
            except HttpError as e:
                last = e
                if e.resp.status in (500, 502, 503, 504):
                    time.sleep(base ** i)
                    continue
                raise
        if last is not None:
            raise last
    return wrapped
