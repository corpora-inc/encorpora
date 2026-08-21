#!/usr/bin/env python3
"""Assert that THIS RUN's versionCode was added to a Google Play track.

`r0adkll/upload-google-play` reports success when its own HTTP calls returned
2xx. That is not the same as "the build is on the track": an edit can be
committed against the wrong track, a release can be created with the bundle
attached to a different edit, and a duplicate versionCode surfaces as a
committed edit with the *old* bundle still in place. The upload step passing is
therefore evidence about the uploader, not about Play.

Presence alone is NOT enough to catch that duplicate. If the versionCode was
already on the track before the upload — which is exactly what "the old bundle
is still in place" means — then a check that asks "is this versionCode on the
track?" passes while nothing shipped. So this script runs twice per release:

    --snapshot   BEFORE the upload. Records the versionCodes already on the
                 track into a step output.
    (verify)     AFTER the upload. Fails unless the versionCode is on the track
                 AND was absent from the snapshot, i.e. unless THIS RUN put it
                 there.

Both modes are deliberately read-only apart from creating and immediately
deleting a throwaway edit, which is the only way `androidpublisher` exposes
track state.

Environment (both modes):
  PLAY_SERVICE_ACCOUNT_JSON  service-account key JSON (the value, not a path)
  PLAY_PACKAGE_NAME          e.g. inc.corpora.dynawalla
  PLAY_TRACK                 e.g. internal

Environment (verify mode only):
  PLAY_VERSION_CODE          the versionCode this run built
  PLAY_PRE_UPLOAD_CODES      the `--snapshot` output. Required — an empty track
                             is spelled `none`, so a snapshot step that silently
                             did not run cannot be mistaken for an empty track.

Dependencies: the standard library plus `pyjwt[crypto]`, which the iOS half of
this workflow already installs. The OAuth token is minted directly against
https://oauth2.googleapis.com/token with the JWT-bearer grant rather than via
`google-auth`: `google-auth`'s `transport.requests` module is an EXTRA
(`google-auth[requests]`), so `pip install google-auth` alone imports fine and
then raises "The requests library is not installed" at call time — after the
AAB has already reached the track. One fewer dependency, one fewer way to fail
at the last step.

No credential value is ever printed.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, NoReturn

BASE = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications"
SCOPE = "https://www.googleapis.com/auth/androidpublisher"
DEFAULT_TOKEN_URI = "https://oauth2.googleapis.com/token"
JWT_BEARER = "urn:ietf:params:oauth:grant-type:jwt-bearer"

# Sentinel for "the track held nothing". Distinguishable from an unset variable,
# which is a broken workflow rather than a first release.
EMPTY = "none"


def fail(message: str) -> NoReturn:
    print(f"::error::{message}")
    sys.exit(1)


def require(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        fail(f"{name} is not set")
    return value


# ---- pure helpers (unit-tested in test_verify_play_upload.py) ---------------


def parse_service_account(raw: str) -> dict:
    try:
        info = json.loads(raw)
    except json.JSONDecodeError as exc:
        fail(f"PLAY_SERVICE_ACCOUNT_JSON is not valid JSON: {exc}")
    if not isinstance(info, dict):
        fail("PLAY_SERVICE_ACCOUNT_JSON is not a JSON object")
    for key in ("client_email", "private_key"):
        if not info.get(key):
            fail(f"PLAY_SERVICE_ACCOUNT_JSON has no '{key}' — is it a service-account key?")
    return info


def codes_on_track(state: dict) -> list[int]:
    """Every versionCode in every release on a tracks.get response."""
    seen: list[int] = []
    for release in state.get("releases", []) or []:
        for code in release.get("versionCodes", []) or []:
            try:
                seen.append(int(code))
            except (TypeError, ValueError):
                continue
    return sorted(set(seen))


def find_release(state: dict, version_code: int) -> dict | None:
    for release in state.get("releases", []) or []:
        codes = [int(c) for c in (release.get("versionCodes", []) or [])]
        if version_code in codes:
            return release
    return None


def parse_snapshot(raw: str) -> set[int]:
    """Parse the `--snapshot` output back into a set.

    `none` is the empty track. An unset/blank value is a workflow bug and is
    rejected by the caller, not silently treated as empty.
    """
    raw = raw.strip()
    if raw == EMPTY:
        return set()
    codes: set[int] = set()
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        try:
            codes.add(int(part))
        except ValueError:
            fail(f"PLAY_PRE_UPLOAD_CODES contains a non-integer entry: {part!r}")
    if not codes:
        fail(
            f"PLAY_PRE_UPLOAD_CODES is {raw!r}, which is neither {EMPTY!r} nor a list of "
            "versionCodes. The pre-upload snapshot step did not produce a usable value; "
            "refusing to verify against an unknown baseline."
        )
    return codes


def render_snapshot(codes: list[int]) -> str:
    return ",".join(str(c) for c in codes) if codes else EMPTY


# ---- network ---------------------------------------------------------------


def _jwt_module() -> Any:
    try:
        import jwt  # type: ignore[import-untyped]
    except ImportError:
        fail("PyJWT is not installed (pip install 'pyjwt[crypto]')")
    return jwt


def build_assertion(info: dict, now: int) -> str:
    """The signed JWT that Google exchanges for an access token."""
    jwt = _jwt_module()
    audience = info.get("token_uri") or DEFAULT_TOKEN_URI
    claims = {
        "iss": info["client_email"],
        "scope": SCOPE,
        "aud": audience,
        "iat": now,
        # Google's ceiling for a service-account assertion is one hour.
        "exp": now + 3600,
    }
    return str(jwt.encode(claims, info["private_key"], algorithm="RS256"))


def access_token(info: dict) -> str:
    audience = info.get("token_uri") or DEFAULT_TOKEN_URI
    body = urllib.parse.urlencode(
        {"grant_type": JWT_BEARER, "assertion": build_assertion(info, int(time.time()))}
    ).encode("utf-8")
    request = urllib.request.Request(audience, data=body, method="POST")
    request.add_header("Content-Type", "application/x-www-form-urlencoded")
    request.add_header("Content-Length", str(len(body)))
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")[:400]
        fail(
            f"Google refused the service-account assertion (HTTP {exc.code}). "
            "The key is malformed, revoked, or the clock is wrong. "
            f"Response: {detail}"
        )
    except urllib.error.URLError as exc:
        fail(f"could not reach {audience}: {exc}")
    token = payload.get("access_token")
    if not token:
        fail("Google returned no access_token for the service account")
    return str(token)


def call(method: str, url: str, token: str, allow_404: bool = False) -> dict:
    # An explicit empty body: urllib omits Content-Length when data is None,
    # and androidpublisher's POST .../edits wants a length even with no body.
    data = b"" if method in ("POST", "PUT", "PATCH") else None
    request = urllib.request.Request(url, data=data, method=method)
    request.add_header("Authorization", f"Bearer {token}")
    if data is not None:
        request.add_header("Content-Type", "application/json")
        request.add_header("Content-Length", "0")
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            body = response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")[:600]
        if exc.code == 403:
            fail(
                f"{method} {url} -> 403. The Play service account has no permission on this "
                "app. Per-app grants do NOT inherit from the developer account (STORE.md "
                "G-09) — grant it in the Play Console, then re-run."
            )
        if exc.code == 404:
            if allow_404:
                return {}
            fail(
                f"{method} {url} -> 404. The Play app record for this package does not exist. "
                "Creating it is a founder Console action; androidpublisher has no app-create "
                "method (STORE.md)."
            )
        fail(f"{method} {url} -> HTTP {exc.code}: {detail}")
    except urllib.error.URLError as exc:
        fail(f"{method} {url} failed: {exc}")
    return json.loads(body) if body.strip() else {}


def read_track(package: str, track: str, token: str, allow_missing: bool) -> dict:
    """Open a throwaway edit, read the track, delete the edit."""
    edit = call("POST", f"{BASE}/{package}/edits", token)
    edit_id = edit.get("id")
    if not edit_id:
        fail(f"androidpublisher returned no edit id: {edit}")
    try:
        # A track that has never had a release 404s. That is the normal state
        # for the pre-upload snapshot of a first release, and an error
        # afterwards.
        return call(
            "GET",
            f"{BASE}/{package}/edits/{edit_id}/tracks/{track}",
            token,
            allow_404=allow_missing,
        )
    finally:
        # Best effort: an abandoned edit expires on its own, so a failed delete
        # must never change this script's verdict.
        cleanup = urllib.request.Request(f"{BASE}/{package}/edits/{edit_id}", method="DELETE")
        cleanup.add_header("Authorization", f"Bearer {token}")
        try:
            urllib.request.urlopen(cleanup, timeout=30).close()
        except Exception as exc:  # noqa: BLE001 - cleanup must not mask the result
            print(f"::notice::could not delete throwaway edit {edit_id}: {exc}")


def emit_output(name: str, value: str) -> None:
    path = os.environ.get("GITHUB_OUTPUT")
    if path:
        with open(path, "a", encoding="utf-8") as handle:
            handle.write(f"{name}={value}\n")
    print(f"{name}={value}")


# ---- entry points ----------------------------------------------------------


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--snapshot",
        action="store_true",
        help="record the versionCodes already on the track (run BEFORE the upload)",
    )
    args = parser.parse_args(argv)

    package = require("PLAY_PACKAGE_NAME")
    track = require("PLAY_TRACK")
    info = parse_service_account(require("PLAY_SERVICE_ACCOUNT_JSON"))
    token = access_token(info)

    if args.snapshot:
        state = read_track(package, track, token, allow_missing=True)
        codes = codes_on_track(state)
        print(f"track '{track}' currently holds: {codes or 'nothing'}")
        emit_output("version_codes", render_snapshot(codes))
        return

    raw_code = require("PLAY_VERSION_CODE")
    try:
        version_code = int(raw_code)
    except ValueError:
        fail(f"PLAY_VERSION_CODE is not an integer: {raw_code!r}")
    before = parse_snapshot(require("PLAY_PRE_UPLOAD_CODES"))

    if version_code in before:
        fail(
            f"versionCode {version_code} was ALREADY on track '{track}' before this run "
            "uploaded anything. Play silently keeps the existing bundle when a duplicate "
            "versionCode is submitted, so this release shipped nothing. The build number "
            "is minutes-since-epoch — two runs in the same minute collide (RISKS R-12). "
            "Wait a minute and re-run."
        )

    state = read_track(package, track, token, allow_missing=False)
    release = find_release(state, version_code)
    if release is None:
        fail(
            f"versionCode {version_code} is NOT on track '{track}'. "
            f"Track currently holds: {codes_on_track(state) or 'nothing'}."
        )
    print(
        f"versionCode {version_code} was added to track '{track}' by this run "
        f"(release '{release.get('name', '?')}', status '{release.get('status', '?')}'; "
        f"before this run the track held {sorted(before) or 'nothing'})."
    )


if __name__ == "__main__":
    main()
