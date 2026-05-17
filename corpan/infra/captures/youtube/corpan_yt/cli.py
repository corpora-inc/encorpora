"""`corpan-yt` — programmatic YouTube CLI for the @corpán1 channel.

Quota costs printed per call so you can watch the 10,000/day budget drain.
videos.insert is 1600 units (≈6 uploads/day default); everything else is
1–50 units.

Typical day-of:
    corpan-yt auth                   # one-time browser consent
    corpan-yt whoami                 # confirm channel is @corpán1
    corpan-yt list --n 10            # eyeball recent uploads
    corpan-yt upload <built-dir>     # full upload + thumbnail + playlist
    corpan-yt patch <video_id> ...   # tweak metadata on existing video
    corpan-yt publish <video_id>     # flip unlisted → public
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import click

from . import api as yt_api
from .auth import CLIENT_SECRET_PATH, CONFIG_DIR, TOKEN_PATH, get_credentials


def _yt():
    return yt_api.youtube_client(get_credentials())


def _cost(units: int) -> None:
    click.echo(click.style(f"  (quota: {units} units)", dim=True), err=True)


@click.group(context_settings={"help_option_names": ["-h", "--help"]})
def cli() -> None:
    """Corpán YouTube programmatic CLI."""


# ---------- auth / identity ----------

@cli.command()
@click.option("--force", is_flag=True, help="Discard cached token and re-consent.")
def auth(force: bool) -> None:
    """Run OAuth installed-app flow (browser). Idempotent."""
    if force and TOKEN_PATH.exists():
        TOKEN_PATH.unlink()
    creds = get_credentials(force_reauth=force)
    click.echo(f"OK — token at {TOKEN_PATH}")
    click.echo(f"Scopes: {', '.join(creds.scopes or [])}")


@cli.command()
def whoami() -> None:
    """channels.list(mine=true) — print authorized channel."""
    yt = _yt()
    info = yt_api.get_my_channel(yt)
    _cost(1)
    click.echo(f"channel id       : {info.id}")
    click.echo(f"channel title    : {info.title}")
    click.echo(f"channel handle   : {info.handle or '(none)'}")
    click.echo(f"uploads playlist : {info.uploads_playlist_id}")


# ---------- read ----------

@cli.command(name="list")
@click.option("-n", "--num", default=25, show_default=True, help="How many to list.")
def list_videos(num: int) -> None:
    """List recent uploads on the authorized channel."""
    yt = _yt()
    info = yt_api.get_my_channel(yt)
    items = yt_api.list_recent_uploads(yt, info.uploads_playlist_id, n=num)
    pages = (num + 49) // 50
    _cost(1 + pages)
    if not items:
        click.echo("(no uploads)")
        return
    for it in items:
        sn = it["snippet"]
        vid = it["contentDetails"]["videoId"]
        priv = it.get("status", {}).get("privacyStatus", "?")
        title = sn.get("title", "")
        published = sn.get("publishedAt", "")
        click.echo(f"{vid}  {priv:<8}  {published[:10]}  {title}")


@cli.command()
@click.argument("video_id")
def get(video_id: str) -> None:
    """Pretty-print metadata for one video."""
    yt = _yt()
    v = yt_api.get_video(yt, video_id)
    _cost(1)
    sn = v["snippet"]
    st = v["status"]
    out = {
        "id": v["id"],
        "title": sn.get("title"),
        "description": sn.get("description"),
        "tags": sn.get("tags", []),
        "categoryId": sn.get("categoryId"),
        "defaultLanguage": sn.get("defaultLanguage"),
        "defaultAudioLanguage": sn.get("defaultAudioLanguage"),
        "privacyStatus": st.get("privacyStatus"),
        "madeForKids": st.get("madeForKids"),
        "publishedAt": sn.get("publishedAt"),
        "channelId": sn.get("channelId"),
        "thumbnails": list((sn.get("thumbnails") or {}).keys()),
        "duration": v.get("contentDetails", {}).get("duration"),
        "stats": v.get("statistics", {}),
    }
    click.echo(json.dumps(out, indent=2, ensure_ascii=False))


# ---------- upload ----------

@cli.command()
@click.argument("built_dir", type=click.Path(exists=True, file_okay=False, path_type=Path))
@click.option("--variant", default=None, help="Override sidecar's variant_to_upload (long|shorts|square).")
@click.option("--privacy", default=None, help="Override sidecar's privacy (private|unlisted|public).")
@click.option("--dry-run", is_flag=True, help="Print what would be sent, don't call insert.")
def upload(built_dir: Path, variant: str | None, privacy: str | None, dry_run: bool) -> None:
    """Upload a built capture to YouTube + set thumbnail + add to playlist.

    Reads <built_dir>/meta.json. Tracks each uploaded variant under
    `youtube.uploads.<variant>` so the same built dir can serve multiple
    YouTube videos (e.g. a 3:4 long version AND a 9:16 Shorts version).
    """
    meta_path = built_dir / "meta.json"
    if not meta_path.exists():
        click.echo(f"error: {meta_path} not found (run build-capture.sh first)", err=True)
        sys.exit(2)
    meta = json.loads(meta_path.read_text())
    yt_meta = meta.get("youtube") or {}

    # Migrate the old flat-shape meta.json (single video_id at the top of
    # `youtube`) into the new `uploads.<variant>` shape.
    uploads = yt_meta.get("uploads") or {}
    if "video_id" in yt_meta and "uploaded_variant" in yt_meta:
        legacy_variant = yt_meta["uploaded_variant"]
        uploads.setdefault(legacy_variant, {
            "video_id": yt_meta["video_id"],
            "url": yt_meta.get("url"),
            "uploaded_at": yt_meta.get("uploaded_at"),
            "thumbnail_uploaded": yt_meta.get("thumbnail_uploaded", False),
            "playlist_id": yt_meta.get("playlist_id"),
        })

    variant = variant or yt_meta.get("variant_to_upload") or "long"

    if variant in uploads and uploads[variant].get("video_id"):
        click.echo(
            f"error: variant '{variant}' already uploaded as "
            f"{uploads[variant]['video_id']}; use `corpan-yt patch` to update, "
            f"or pick another --variant.",
            err=True,
        )
        sys.exit(2)

    media_path = built_dir / f"{variant}.mp4"
    thumb_path = built_dir / "thumb.jpg"
    if not media_path.exists():
        click.echo(f"error: {media_path} not found", err=True)
        sys.exit(2)

    title = yt_meta.get("title")
    description = yt_meta.get("description", "")
    tags = yt_meta.get("tags", [])
    category_id = int(yt_meta.get("category_id", 27))
    privacy = privacy or yt_meta.get("privacy", "public")
    daudio = yt_meta.get("default_audio_language")
    dlang = yt_meta.get("default_language")
    made_for_kids = bool(yt_meta.get("made_for_kids", False))
    playlist_name = yt_meta.get("playlist")

    # `shorts` variant: append "#Shorts" hint to title (YouTube hint, not required).
    if variant == "shorts" and "#shorts" not in title.lower():
        title = f"{title} #Shorts"

    if not title:
        click.echo("error: meta.json missing youtube.title", err=True)
        sys.exit(2)

    click.echo(f"=> uploading {media_path.name} ({media_path.stat().st_size/1e6:.1f} MB)")
    click.echo(f"   title    : {title}")
    click.echo(f"   privacy  : {privacy}")
    click.echo(f"   tags     : {', '.join(tags)}")
    click.echo(f"   category : {category_id}")
    if playlist_name:
        click.echo(f"   playlist : {playlist_name}")
    if dry_run:
        click.echo("(dry-run; not calling videos.insert)")
        return

    yt = _yt()
    total_cost = 0

    def progress(pct: int) -> None:
        click.echo(f"   upload   : {pct}%", err=True)

    video_id = yt_api.upload_video(
        yt,
        media_path=media_path,
        title=title,
        description=description,
        tags=tags,
        category_id=category_id,
        privacy=privacy,
        default_audio_language=daudio,
        default_language=dlang,
        made_for_kids=made_for_kids,
        progress_cb=progress,
    )
    total_cost += 1600
    click.echo(f"OK uploaded: https://youtu.be/{video_id}")

    thumb_ok = False
    if thumb_path.exists():
        try:
            yt_api.set_thumbnail(yt, video_id=video_id, jpg_path=thumb_path)
            thumb_ok = True
            total_cost += 50
            click.echo(f"OK thumbnail set ({thumb_path.name})")
        except Exception as e:
            click.echo(f"WARN: thumbnail upload failed: {e}", err=True)

    playlist_id: str | None = None
    if playlist_name:
        try:
            playlist_id = yt_api.ensure_playlist(yt, title=playlist_name, privacy=privacy)
            total_cost += 1
            _, inserted = yt_api.add_to_playlist(yt, playlist_id=playlist_id, video_id=video_id)
            total_cost += 50 if inserted else 1
            click.echo(f"OK {'added to' if inserted else 'already in'} playlist {playlist_id}")
        except Exception as e:
            click.echo(f"WARN: playlist step failed: {e}", err=True)

    uploads[variant] = {
        "video_id": video_id,
        "url": f"https://youtu.be/{video_id}",
        "uploaded_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "thumbnail_uploaded": thumb_ok,
        "playlist_id": playlist_id,
        "title_sent": title,
    }
    # Strip the legacy flat keys; uploads[] is now the source of truth.
    new_yt = {k: v for k, v in yt_meta.items()
              if k not in ("video_id", "url", "uploaded_at", "thumbnail_uploaded",
                           "playlist_id", "uploaded_variant")}
    new_yt["uploads"] = uploads
    meta["youtube"] = new_yt
    meta_path.write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n")
    _cost(total_cost)


# ---------- update / patch ----------

@cli.command()
@click.argument("video_id")
@click.option("--from-meta", type=click.Path(exists=True, dir_okay=False, path_type=Path),
              help="Load all fields from a built/<slug>/meta.json sidecar.")
@click.option("--title")
@click.option("--description")
@click.option("--tags", help="Comma-separated.")
@click.option("--category-id", type=int)
@click.option("--privacy", type=click.Choice(["private", "unlisted", "public"]))
@click.option("--default-language")
@click.option("--default-audio-language")
@click.option("--thumbnail", type=click.Path(exists=True, dir_okay=False, path_type=Path))
@click.option("--playlist", help="Ensure playlist by name and add this video to it.")
def patch(video_id: str, from_meta: Path | None, title: str | None, description: str | None,
          tags: str | None, category_id: int | None, privacy: str | None,
          default_language: str | None, default_audio_language: str | None,
          thumbnail: Path | None, playlist: str | None) -> None:
    """Update metadata on an existing video (yours or one Ian uploaded manually)."""
    if from_meta is not None:
        meta = json.loads(from_meta.read_text())
        ym = meta.get("youtube") or {}
        title = title or ym.get("title")
        description = description or ym.get("description")
        if tags is None and ym.get("tags") is not None:
            tags_list = ym.get("tags")
        else:
            tags_list = [t.strip() for t in tags.split(",")] if tags else None
        category_id = category_id or ym.get("category_id")
        privacy = privacy or ym.get("privacy")
        default_language = default_language or ym.get("default_language")
        default_audio_language = default_audio_language or ym.get("default_audio_language")
        playlist = playlist or ym.get("playlist")
    else:
        tags_list = [t.strip() for t in tags.split(",")] if tags else None

    yt = _yt()
    total_cost = 0

    yt_api.update_video(
        yt,
        video_id=video_id,
        title=title,
        description=description,
        tags=tags_list,
        category_id=category_id,
        privacy=privacy,
        default_audio_language=default_audio_language,
        default_language=default_language,
    )
    total_cost += 51  # 1 read + 50 update
    click.echo(f"OK patched {video_id}")

    if thumbnail is not None:
        yt_api.set_thumbnail(yt, video_id=video_id, jpg_path=thumbnail)
        total_cost += 50
        click.echo(f"OK thumbnail set ({thumbnail.name})")

    if playlist:
        playlist_id = yt_api.ensure_playlist(yt, title=playlist, privacy=privacy or "unlisted")
        total_cost += 1
        _, inserted = yt_api.add_to_playlist(yt, playlist_id=playlist_id, video_id=video_id)
        total_cost += 50 if inserted else 1
        click.echo(f"OK {'added to' if inserted else 'already in'} playlist {playlist_id}")

    _cost(total_cost)


@cli.command()
@click.argument("video_id")
@click.argument("jpg_path", type=click.Path(exists=True, dir_okay=False, path_type=Path))
def set_thumbnail(video_id: str, jpg_path: Path) -> None:
    """thumbnails.set — 50 units."""
    yt = _yt()
    yt_api.set_thumbnail(yt, video_id=video_id, jpg_path=jpg_path)
    _cost(50)
    click.echo("OK")


@cli.command()
@click.argument("video_id")
@click.option("--to", type=click.Choice(["private", "unlisted", "public"]), default="public",
              show_default=True)
def publish(video_id: str, to: str) -> None:
    """Flip a video's privacyStatus (default: unlisted → public). 51 units."""
    yt = _yt()
    yt_api.update_video(yt, video_id=video_id, privacy=to)
    _cost(51)
    click.echo(f"OK {video_id} → {to}")


# ---------- channel branding ----------

@cli.group()
def channel() -> None:
    """Inspect / update the authorized channel itself (title, description, keywords)."""


@channel.command(name="info")
def channel_info() -> None:
    """Print authorized channel's full snippet + brandingSettings + statistics."""
    yt = _yt()
    me = yt_api.get_my_channel(yt)
    full = yt_api.get_channel_full(yt, me.id)
    _cost(2)
    sn = full["snippet"]
    bs = (full.get("brandingSettings") or {}).get("channel", {})
    stats = full.get("statistics", {})
    out = {
        "id": full["id"],
        "title": sn.get("title"),
        "handle": sn.get("customUrl"),
        "publishedAt": sn.get("publishedAt"),
        "country": sn.get("country"),
        "description": sn.get("description"),
        "branding": {
            "title": bs.get("title"),
            "description": bs.get("description"),
            "keywords": bs.get("keywords"),
            "country": bs.get("country"),
            "defaultLanguage": bs.get("defaultLanguage"),
            "unsubscribedTrailer": bs.get("unsubscribedTrailer"),
        },
        "statistics": stats,
    }
    click.echo(json.dumps(out, indent=2, ensure_ascii=False))


@channel.command(name="banner")
@click.argument("jpg_path", type=click.Path(exists=True, dir_okay=False, path_type=Path))
def channel_banner(jpg_path: Path) -> None:
    """Upload a 2048×1152 channel banner (≤6 MB JPG/PNG)."""
    yt = _yt()
    me = yt_api.get_my_channel(yt)
    url = yt_api.set_channel_banner(yt, channel_id=me.id, jpg_path=jpg_path)
    _cost(51)  # 1 read + 50 update; banner insert is unmetered
    click.echo(f"OK banner set:\n  {url}")


@channel.command(name="watermark")
@click.argument("png_path", type=click.Path(exists=True, dir_okay=False, path_type=Path))
@click.option("--mode", type=click.Choice(["offsetFromStart", "offsetFromEnd"]),
              default="offsetFromStart", show_default=True,
              help="When the watermark appears. YouTube REQUIRES timing.")
@click.option("--offset-ms", type=int, default=0, show_default=True,
              help="Offset in ms (with offsetFromStart/End).")
@click.option("--duration-ms", type=int, default=15000, show_default=True,
              help="How long it stays on screen.")
def channel_watermark(png_path: Path, mode: str, offset_ms: int, duration_ms: int) -> None:
    """Set the channel branding watermark (small logo bottom-right of every video).

    JPEG works most reliably; PNG sometimes returns "Invalid Value" from YT.
    """
    yt = _yt()
    me = yt_api.get_my_channel(yt)
    yt_api.set_watermark(
        yt, channel_id=me.id, image_path=png_path,
        timing_type=mode, timing_offset_ms=offset_ms, duration_ms=duration_ms,
    )
    _cost(50)
    click.echo("OK watermark set")


@channel.command(name="localize")
@click.option("--from-json", type=click.Path(exists=True, dir_okay=False, path_type=Path),
              required=True,
              help='JSON file: {"ar": {"title": "...", "description": "..."}, ...}.')
def channel_localize(from_json: Path) -> None:
    """Add per-language title + description for the channel (BCP-47 locale keys)."""
    locs = json.loads(from_json.read_text())
    if not isinstance(locs, dict) or not all(
        isinstance(v, dict) and "title" in v and "description" in v for v in locs.values()
    ):
        click.echo(
            "error: --from-json must be a {locale: {title, description}} mapping",
            err=True,
        )
        sys.exit(2)
    yt = _yt()
    me = yt_api.get_my_channel(yt)
    yt_api.update_channel_localizations(yt, channel_id=me.id, localizations=locs)
    _cost(50)
    click.echo(f"OK localizations set for: {', '.join(locs.keys())}")


@channel.command(name="update")
@click.option("--title")
@click.option("--description")
@click.option("--keywords", help='Space-separated tag string, e.g. \'"language learning" corpan arabic\'.')
@click.option("--country", help="ISO 3166-1 alpha-2, e.g. US, DZ, FR.")
@click.option("--default-language", help="ISO 639-1, e.g. en, ar.")
@click.option("--unsubscribed-trailer", help="Video ID to show as channel trailer to non-subscribers.")
def channel_update(title: str | None, description: str | None, keywords: str | None,
                   country: str | None, default_language: str | None,
                   unsubscribed_trailer: str | None) -> None:
    """Patch channel brandingSettings (title, description, keywords, country, trailer).

    Note: the @handle (customUrl) is read-only via the API — change it at
    https://studio.youtube.com → Customization → Basic info → Handle.
    """
    if not any([title, description, keywords, country, default_language, unsubscribed_trailer]):
        click.echo("error: pass at least one --field to update", err=True)
        sys.exit(2)
    yt = _yt()
    me = yt_api.get_my_channel(yt)
    yt_api.update_channel_branding(
        yt,
        channel_id=me.id,
        title=title,
        description=description,
        keywords=keywords,
        country=country,
        default_language=default_language,
        unsubscribed_trailer=unsubscribed_trailer,
    )
    _cost(51)  # 1 read + 50 update
    click.echo(f"OK updated channel {me.id}")


# ---------- playlists ----------

@cli.group()
def playlist() -> None:
    """Manage playlists."""


@playlist.command(name="ls")
def playlist_ls() -> None:
    """List playlists on the authorized channel."""
    yt = _yt()
    pls = yt_api.list_my_playlists(yt)
    _cost(1)
    for p in pls:
        sn = p["snippet"]
        n = p["contentDetails"]["itemCount"]
        priv = p.get("status", {}).get("privacyStatus", "?")
        click.echo(f"{p['id']}  {priv:<8}  {n:>3} items  {sn['title']}")


@playlist.command(name="create")
@click.argument("title")
@click.option("--privacy", type=click.Choice(["private", "unlisted", "public"]),
              default="unlisted", show_default=True)
@click.option("--description", default="")
def playlist_create(title: str, privacy: str, description: str) -> None:
    """Create a playlist."""
    yt = _yt()
    pl_id = yt_api.ensure_playlist(yt, title=title, description=description, privacy=privacy)
    _cost(51)  # 1 list + 50 insert
    click.echo(pl_id)


@playlist.command(name="add")
@click.argument("playlist_id")
@click.argument("video_id")
def playlist_add(playlist_id: str, video_id: str) -> None:
    """Add a video to a playlist."""
    yt = _yt()
    item_id, inserted = yt_api.add_to_playlist(yt, playlist_id=playlist_id, video_id=video_id)
    _cost(51 if inserted else 1)
    click.echo(f"{item_id} ({'inserted' if inserted else 'already present'})")


# ---------- config / debug ----------

@cli.command(name="config-paths")
def config_paths() -> None:
    """Print where the CLI reads/writes credentials."""
    click.echo(f"config dir    : {CONFIG_DIR}")
    click.echo(f"client secret : {CLIENT_SECRET_PATH}  (exists={CLIENT_SECRET_PATH.exists()})")
    click.echo(f"token         : {TOKEN_PATH}  (exists={TOKEN_PATH.exists()})")


if __name__ == "__main__":
    cli()
