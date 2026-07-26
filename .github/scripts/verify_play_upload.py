#!/usr/bin/env python3
"""Assert that a versionCode really landed on a Google Play track.

`r0adkll/upload-google-play` reports success when its own HTTP calls returned
2xx. That is not the same as "the build is on the track": an edit can be
committed against the wrong track, a release can be created with the bundle
attached to a different edit, and a duplicate versionCode surfaces as a
committed edit with the *old* bundle still in place. The upload step passing is
therefore evidence about the uploader, not about Play.

This reads the track back and fails if the versionCode we just built is not in
it. It is deliberately read-only apart from creating and immediately deleting a
throwaway edit, which is the only way `androidpublisher` exposes track state.

Environment:
  PLAY_SERVICE_ACCOUNT_JSON  service-account key JSON (the value, not a path)
  PLAY_PACKAGE_NAME          e.g. inc.corpora.dynawalla
  PLAY_TRACK                 e.g. internal
  PLAY_VERSION_CODE          the versionCode this run built

Exits 0 when the versionCode is present in any release on the track (including
a draft release, which is all the API can create for an app that has never been
published — see dynawalla/docs/STORE.md G-10).
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from typing import NoReturn

BASE = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications"
SCOPE = "https://www.googleapis.com/auth/androidpublisher"


def fail(message: str) -> NoReturn:
    print(f"::error::{message}")
    sys.exit(1)


def require(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        fail(f"{name} is not set")
    return value


def access_token(service_account_json: str) -> str:
    # google-auth is installed by the workflow step. Importing it here rather
    # than at module scope keeps the missing-dependency error readable.
    try:
        from google.oauth2 import service_account  # type: ignore[import-untyped]
        from google.auth.transport.requests import Request  # type: ignore[import-untyped]
    except ImportError:
        fail("google-auth is not installed (pip install google-auth)")

    try:
        info = json.loads(service_account_json)
    except json.JSONDecodeError as exc:
        fail(f"PLAY_SERVICE_ACCOUNT_JSON is not valid JSON: {exc}")

    credentials = service_account.Credentials.from_service_account_info(info, scopes=[SCOPE])
    credentials.refresh(Request())
    return str(credentials.token)


def call(method: str, url: str, token: str) -> dict:
    request = urllib.request.Request(url, method=method)
    request.add_header("Authorization", f"Bearer {token}")
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
            fail(
                f"{method} {url} -> 404. The Play app record for this package does not exist. "
                "Creating it is a founder Console action; androidpublisher has no app-create "
                "method (STORE.md)."
            )
        fail(f"{method} {url} -> HTTP {exc.code}: {detail}")
    except urllib.error.URLError as exc:
        fail(f"{method} {url} failed: {exc}")
    return json.loads(body) if body.strip() else {}


def main() -> None:
    package = require("PLAY_PACKAGE_NAME")
    track = require("PLAY_TRACK")
    raw_code = require("PLAY_VERSION_CODE")
    try:
        version_code = int(raw_code)
    except ValueError:
        fail(f"PLAY_VERSION_CODE is not an integer: {raw_code!r}")

    token = access_token(require("PLAY_SERVICE_ACCOUNT_JSON"))

    edit = call("POST", f"{BASE}/{package}/edits", token)
    edit_id = edit.get("id")
    if not edit_id:
        fail(f"androidpublisher returned no edit id: {edit}")

    try:
        state = call("GET", f"{BASE}/{package}/edits/{edit_id}/tracks/{track}", token)
        seen: list[int] = []
        for release in state.get("releases", []):
            for code in release.get("versionCodes", []):
                seen.append(int(code))
            if version_code in [int(c) for c in release.get("versionCodes", [])]:
                status = release.get("status", "?")
                name = release.get("name", "?")
                print(
                    f"versionCode {version_code} is on track '{track}' "
                    f"(release '{name}', status '{status}')."
                )
                return
        fail(
            f"versionCode {version_code} is NOT on track '{track}'. "
            f"Track currently holds: {sorted(set(seen)) or 'nothing'}."
        )
    finally:
        # Best effort: an abandoned edit expires on its own, so a failed delete
        # must never change this script's verdict.
        cleanup = urllib.request.Request(
            f"{BASE}/{package}/edits/{edit_id}", method="DELETE"
        )
        cleanup.add_header("Authorization", f"Bearer {token}")
        try:
            urllib.request.urlopen(cleanup, timeout=30).close()
        except Exception as exc:  # noqa: BLE001 - cleanup must not mask the result
            print(f"::notice::could not delete throwaway edit {edit_id}: {exc}")


if __name__ == "__main__":
    main()
