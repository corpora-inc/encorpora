#!/usr/bin/env python3
"""Assert that a build really reached App Store Connect after an upload.

`apple-actions/upload-testflight-build` wraps `xcrun altool`, which returns
success once Apple has *accepted the transfer*. Acceptance is not arrival:
Apple can still reject the package during processing (a duplicate
CFBundleVersion, a missing icon, an entitlement mismatch), and that rejection
arrives by email rather than by exit code. A release run that says "uploaded"
and shipped nothing is exactly the failure mode this repository has already
been bitten by on the Play side.

So we read it back: find the app by bundle id, then poll its builds for the
CFBundleVersion this run produced.

Environment:
  ASC_KEY_ID          App Store Connect API key id
  ASC_ISSUER_ID       App Store Connect issuer id
  ASC_API_KEY_P8      the .p8 private key (the PEM text itself)
  ASC_BUNDLE_ID       e.g. inc.corpora.dynawalla
  ASC_BUILD_VERSION   the CFBundleVersion to look for
  ASC_TIMEOUT_SECONDS optional, default 900

None of these values is ever printed. Only their presence/absence is.
"""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import NoReturn

API = "https://api.appstoreconnect.apple.com/v1"


def fail(message: str) -> NoReturn:
    print(f"::error::{message}")
    sys.exit(1)


def require(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        fail(f"{name} is not set")
    return value


def token(key_id: str, issuer_id: str, private_key: str) -> str:
    try:
        import jwt  # type: ignore[import-untyped]
    except ImportError:
        fail("PyJWT is not installed (pip install 'pyjwt[crypto]')")
    now = int(time.time())
    return str(
        jwt.encode(
            # 20 minutes is Apple's maximum for a team key; anything longer is
            # rejected with 401 NOT_AUTHORIZED, which reads like a bad key.
            {"iss": issuer_id, "iat": now, "exp": now + 19 * 60, "aud": "appstoreconnect-v1"},
            private_key,
            algorithm="ES256",
            headers={"kid": key_id, "typ": "JWT"},
        )
    )


def get(path: str, params: dict[str, str], bearer: str) -> dict:
    url = f"{API}/{path}?{urllib.parse.urlencode(params)}"
    request = urllib.request.Request(url)
    request.add_header("Authorization", f"Bearer {bearer}")
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")[:600]
        if exc.code == 401:
            fail("App Store Connect returned 401 — the API key is not valid for this team.")
        fail(f"GET {path} -> HTTP {exc.code}: {detail}")
    except urllib.error.URLError as exc:
        fail(f"GET {path} failed: {exc}")


def main() -> None:
    bundle_id = require("ASC_BUNDLE_ID")
    wanted = require("ASC_BUILD_VERSION")
    deadline = time.time() + int(os.environ.get("ASC_TIMEOUT_SECONDS", "900"))

    bearer = token(require("ASC_KEY_ID"), require("ASC_ISSUER_ID"), require("ASC_API_KEY_P8"))

    apps = get("apps", {"filter[bundleId]": bundle_id, "limit": "200"}, bearer)
    matches = [a for a in apps.get("data", []) if a["attributes"].get("bundleId") == bundle_id]
    if not matches:
        fail(
            f"No App Store Connect app record for bundle id {bundle_id}. "
            "There is no app-create operation in the API — Apple's own docs say to create "
            "the app on the App Store Connect website (STORE.md). This is a founder action."
        )
    app_id = matches[0]["id"]
    print(f"App Store Connect app {app_id} for {bundle_id}.")

    attempt = 0
    while True:
        attempt += 1
        builds = get(
            "builds",
            {"filter[app]": app_id, "limit": "50", "sort": "-uploadedDate"},
            bearer,
        )
        versions = [b["attributes"].get("version") for b in builds.get("data", [])]
        for build in builds.get("data", []):
            if build["attributes"].get("version") == wanted:
                state = build["attributes"].get("processingState", "?")
                expired = build["attributes"].get("expired")
                print(
                    f"Build {wanted} is on App Store Connect "
                    f"(id {build['id']}, processingState {state}, expired {expired})."
                )
                # PROCESSING is the normal state moments after an upload and it
                # is not a failure. INVALID is: Apple rejected the package.
                if state == "INVALID":
                    fail(f"Build {wanted} was rejected by App Store Connect (state INVALID).")
                return
        if time.time() >= deadline:
            fail(
                f"Build {wanted} never appeared on App Store Connect within the timeout. "
                f"Most recent builds seen: {versions[:10]}"
            )
        print(f"attempt {attempt}: {wanted} not visible yet; most recent {versions[:5]}")
        time.sleep(30)


if __name__ == "__main__":
    main()
