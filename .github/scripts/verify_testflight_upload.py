#!/usr/bin/env python3
"""Assert that THIS RUN's build really reached App Store Connect.

`apple-actions/upload-testflight-build` wraps `xcrun altool`, which returns
success once Apple has *accepted the transfer*. Acceptance is not arrival:
Apple can still reject the package during processing (a duplicate
CFBundleVersion, a missing icon, an entitlement mismatch), and that rejection
arrives by email rather than by exit code. A release run that says "uploaded"
and shipped nothing is exactly the failure mode this repository has already
been bitten by on the Play side.

So we read it back: find the app by bundle id, then poll its builds for the
CFBundleVersion this run produced.

That app-by-bundle-id lookup is also the answer to a question the iOS job used
to ask far too late. There is no app-create operation in the App Store Connect
API, so "the app record has not been created yet" is a founder action, and
until this script ran it was discovered at the UPLOAD step — roughly minute 55
of a 60-minute macOS job. The lookup itself costs about two seconds and needs
nothing the build produces, so it is also exposed on its own:

    --preflight   ONLY the app lookup. Run it before the expensive work.
                  Prints the resolved app id; exits non-zero, naming the
                  founder action, when no app record exists for the bundle id.
    (verify)      the full post-upload read-back described above.

Presence alone is NOT enough. CFBundleVersion is minutes-since-epoch, so two
runs in the same minute produce the same string (RISKS R-12) — and in exactly
that case a build with the wanted version is already on App Store Connect
before this run uploads anything, so "does a build with this version exist?"
passes while Apple rejected our upload as a duplicate. Every candidate build is
therefore checked against ASC_MIN_UPLOADED_DATE, the moment this workflow run
started: a build older than that is a pre-existing collision, not our upload.

Environment (both modes):
  ASC_KEY_ID             App Store Connect API key id
  ASC_ISSUER_ID          App Store Connect issuer id
  ASC_API_KEY_P8         the .p8 private key (the PEM text itself)
  ASC_BUNDLE_ID          e.g. inc.corpora.dynawalla

Environment (verify mode only):
  ASC_BUILD_VERSION      the CFBundleVersion to look for
  ASC_MIN_UPLOADED_DATE  epoch seconds; the run's start. A build uploaded
                         before this is not ours.
  ASC_TIMEOUT_SECONDS    optional, default 900

None of these values is ever printed. Only their presence/absence is.
"""

from __future__ import annotations

import argparse
import datetime as _dt
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, NoReturn

API = "https://api.appstoreconnect.apple.com/v1"

# Apple's ceiling for a team key is 20 minutes and it rejects anything longer
# with a 401 that reads like a bad key. Mint for 19 and re-mint at 15, because
# ASC_TIMEOUT_SECONDS can legitimately exceed the token lifetime: raising the
# timeout past ~19 minutes with a single token would expire it mid-poll and
# report "the API key is not valid for this team" for a perfectly good key.
TOKEN_LIFETIME_SECONDS = 19 * 60
TOKEN_REFRESH_AFTER_SECONDS = 15 * 60
POLL_INTERVAL_SECONDS = 30


def fail(message: str) -> NoReturn:
    print(f"::error::{message}")
    sys.exit(1)


def require(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        fail(f"{name} is not set")
    return value


# ---- pure helpers (unit-tested in test_verify_testflight_upload.py) ---------


def parse_uploaded_date(raw: str | None) -> float | None:
    """ASC returns ISO-8601, sometimes with `Z`, sometimes with an offset."""
    if not raw:
        return None
    text = raw.strip()
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        parsed = _dt.datetime.fromisoformat(text)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=_dt.timezone.utc)
    return parsed.timestamp()


def matching_builds(payload: dict, wanted: str) -> list[dict]:
    return [
        b
        for b in payload.get("data", []) or []
        if (b.get("attributes") or {}).get("version") == wanted
    ]


def classify(build: dict, min_uploaded: float) -> tuple[str, float | None]:
    """`ours` | `stale` | `undated` for one candidate build.

    `stale` is the duplicate-collision case: a build carrying the wanted
    CFBundleVersion that existed before this run began. `undated` never counts
    as ours — a build we cannot date cannot be attributed to this run, and
    guessing in the permissive direction is how a green run ships nothing.
    """
    uploaded = parse_uploaded_date((build.get("attributes") or {}).get("uploadedDate"))
    if uploaded is None:
        return "undated", None
    # Allow a little slack: ASC timestamps are second-resolution and the gate's
    # clock is a different machine's.
    if uploaded + 120 < min_uploaded:
        return "stale", uploaded
    return "ours", uploaded


def iso(epoch: float) -> str:
    return _dt.datetime.fromtimestamp(epoch, _dt.timezone.utc).isoformat(timespec="seconds")


# ---- network ---------------------------------------------------------------


def _jwt_module() -> Any:
    try:
        import jwt  # type: ignore[import-untyped]
    except ImportError:
        fail("PyJWT is not installed (pip install 'pyjwt[crypto]')")
    return jwt


def mint_token(key_id: str, issuer_id: str, private_key: str) -> str:
    jwt = _jwt_module()
    now = int(time.time())
    return str(
        jwt.encode(
            {
                "iss": issuer_id,
                "iat": now,
                "exp": now + TOKEN_LIFETIME_SECONDS,
                "aud": "appstoreconnect-v1",
            },
            private_key,
            algorithm="ES256",
            headers={"kid": key_id, "typ": "JWT"},
        )
    )


class Bearer:
    """A JWT that re-mints itself before Apple's 20-minute ceiling."""

    def __init__(self, key_id: str, issuer_id: str, private_key: str) -> None:
        self._args = (key_id, issuer_id, private_key)
        self._token = ""
        self._minted_at = 0.0

    def value(self) -> str:
        if not self._token or time.time() - self._minted_at >= TOKEN_REFRESH_AFTER_SECONDS:
            self._token = mint_token(*self._args)
            self._minted_at = time.time()
        return self._token


def get(path: str, params: dict[str, str], bearer: Bearer) -> dict:
    url = f"{API}/{path}?{urllib.parse.urlencode(params)}"
    request = urllib.request.Request(url)
    request.add_header("Authorization", f"Bearer {bearer.value()}")
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")[:600]
        if exc.code == 401:
            fail("App Store Connect returned 401 — the API key is not valid for this team.")
        if exc.code == 403:
            fail(
                f"GET {path} -> 403. The App Store Connect key lacks the role this call "
                f"needs (App Manager or Admin). Response: {detail}"
            )
        if exc.code == 404:
            fail(
                f"GET {path} -> 404. The resource does not exist on App Store Connect. "
                "For a first release this usually means the app record has not been "
                "created — a founder action, there is no app-create API (STORE.md)."
            )
        fail(f"GET {path} -> HTTP {exc.code}: {detail}")
    except urllib.error.URLError as exc:
        fail(f"GET {path} failed: {exc}")


def bearer_from_env() -> Bearer:
    return Bearer(require("ASC_KEY_ID"), require("ASC_ISSUER_ID"), require("ASC_API_KEY_P8"))


def resolve_app_id(bundle_id: str, bearer: Bearer) -> str:
    """The App Store Connect app id for a bundle id, or a fatal error.

    The response is re-filtered on the exact bundle id, which is not
    redundant: `filter[bundleId]` is Apple's filter and Apple has never
    promised it is an exact-match lookup rather than a match, so a sibling id
    (`inc.corpora.dynawalla.dev`) could come back for a query of
    `inc.corpora.dynawalla`. Taking `data[0]` on trust would resolve the wrong
    app id, and the post-upload read-back would then poll a DIFFERENT app's
    builds until it timed out — reporting the timeout against the right bundle
    id, which is the hardest possible version of this to debug.
    """
    apps = get("apps", {"filter[bundleId]": bundle_id, "limit": "200"}, bearer)
    matches = [
        a for a in apps.get("data", []) if (a.get("attributes") or {}).get("bundleId") == bundle_id
    ]
    if not matches:
        fail(
            f"No App Store Connect app record for bundle id {bundle_id}. "
            "There is no app-create operation in the API — Apple's own docs say to create "
            "the app on the App Store Connect website (STORE.md). This is a founder action: "
            "create the app with this exact bundle id in App Store Connect, then re-run. "
            "Nothing this job builds can succeed until it exists."
        )
    return str(matches[0]["id"])


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Verify a TestFlight upload.")
    parser.add_argument(
        "--preflight",
        action="store_true",
        help="only check that the app record exists (run BEFORE the build)",
    )
    args = parser.parse_args(argv)

    bundle_id = require("ASC_BUNDLE_ID")

    # --preflight asks exactly one question and asks it early. It deliberately
    # requires NONE of the verify-mode variables: at the point it runs there is
    # no IPA, so there is no CFBundleVersion to name, and demanding one would
    # make the check impossible to run at the only time it is worth running.
    if args.preflight:
        app_id = resolve_app_id(bundle_id, bearer_from_env())
        print(f"App Store Connect app {app_id} exists for {bundle_id}. Preflight passed.")
        return

    wanted = require("ASC_BUILD_VERSION")
    raw_min = require("ASC_MIN_UPLOADED_DATE")
    try:
        min_uploaded = float(raw_min)
    except ValueError:
        fail(f"ASC_MIN_UPLOADED_DATE is not epoch seconds: {raw_min!r}")
    deadline = time.time() + int(os.environ.get("ASC_TIMEOUT_SECONDS", "900"))

    bearer = bearer_from_env()

    app_id = resolve_app_id(bundle_id, bearer)
    print(f"App Store Connect app {app_id} for {bundle_id}.")
    print(f"Only builds uploaded at or after {iso(min_uploaded)} count as this run's.")

    attempt = 0
    while True:
        attempt += 1
        builds = get(
            "builds",
            {"filter[app]": app_id, "limit": "50", "sort": "-uploadedDate"},
            bearer,
        )
        versions = [(b.get("attributes") or {}).get("version") for b in builds.get("data", [])]
        for build in matching_builds(builds, wanted):
            verdict, uploaded = classify(build, min_uploaded)
            if verdict == "stale":
                fail(
                    f"CFBundleVersion {wanted} was already on App Store Connect before this "
                    f"run started (build {build['id']}, uploaded {iso(uploaded or 0)}). "
                    "Apple rejects a duplicate CFBundleVersion, so this run's upload did not "
                    "land. The build number is minutes-since-epoch and two runs in the same "
                    "minute collide (RISKS R-12). Wait a minute and re-run."
                )
            if verdict == "undated":
                fail(
                    f"Build {build['id']} carries CFBundleVersion {wanted} but App Store "
                    "Connect reports no uploadedDate, so it cannot be attributed to this "
                    "run. Refusing to report success on an unattributable build."
                )
            attributes = build.get("attributes") or {}
            state = attributes.get("processingState", "?")
            print(
                f"Build {wanted} was uploaded by this run "
                f"(id {build['id']}, uploaded {iso(uploaded or 0)}, processingState {state}, "
                f"expired {attributes.get('expired')})."
            )
            # PROCESSING is the normal state moments after an upload and it is
            # not a failure. INVALID is: Apple rejected the package.
            if state == "INVALID":
                fail(f"Build {wanted} was rejected by App Store Connect (state INVALID).")
            return
        if time.time() >= deadline:
            fail(
                f"Build {wanted} never appeared on App Store Connect within the timeout. "
                f"Most recent builds seen: {versions[:10]}"
            )
        print(f"attempt {attempt}: {wanted} not visible yet; most recent {versions[:5]}")
        time.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
