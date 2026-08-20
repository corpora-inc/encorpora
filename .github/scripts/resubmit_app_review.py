#!/usr/bin/env python3
"""Select one processed iOS build and resubmit its rejected App Review item.

This is intentionally narrower than a general App Store release client.  It
operates on one exact bundle id, marketing version, and CFBundleVersion; it
refuses ambiguous resources or unexpected states; and it is read-only unless
``--submit`` is present.

Environment:
  ASC_KEY_ID, ASC_ISSUER_ID, ASC_API_KEY_P8
  ASC_BUNDLE_ID       expected to be inc.corpora.dynawalla
  ASC_APP_VERSION     marketing version, for example 0.3.11
  ASC_BUILD_VERSION   exact CFBundleVersion, for example 0.3.11.29787564
"""

from __future__ import annotations

import argparse
import json
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any

from verify_testflight_upload import (
    API,
    Bearer,
    bearer_from_env,
    fail,
    require,
    resolve_app_id,
)

BUNDLE_ID = "inc.corpora.dynawalla"
EDITABLE_VERSION_STATES = {"PREPARE_FOR_SUBMISSION", "READY_FOR_REVIEW", "REJECTED"}
OPEN_REVIEW_STATES = {"READY_FOR_REVIEW", "UNRESOLVED_ISSUES"}
SUBMITTED_REVIEW_STATES = {"WAITING_FOR_REVIEW", "IN_REVIEW"}


def request(
    method: str,
    path: str,
    bearer: Bearer,
    *,
    params: dict[str, str] | None = None,
    payload: dict[str, Any] | None = None,
) -> dict[str, Any]:
    query = f"?{urllib.parse.urlencode(params)}" if params else ""
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(f"{API}/{path}{query}", data=body, method=method)
    req.add_header("Authorization", f"Bearer {bearer.value()}")
    if body is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            raw = response.read()
            return json.loads(raw.decode("utf-8")) if raw else {}
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")[:1000]
        if exc.code == 401:
            fail("App Store Connect returned 401 — the API key is not valid for this team.")
        if exc.code == 403:
            fail(
                f"{method} {path} -> 403. The operation or API-key role is not allowed. "
                f"Response: {detail}"
            )
        fail(f"{method} {path} -> HTTP {exc.code}: {detail}")
    except urllib.error.URLError as exc:
        fail(f"{method} {path} failed: {exc}")


def exact_one(resources: list[dict[str, Any]], description: str) -> dict[str, Any]:
    if len(resources) != 1:
        fail(f"Expected exactly one {description}; App Store Connect returned {len(resources)}.")
    return resources[0]


def attributes(resource: dict[str, Any]) -> dict[str, Any]:
    return resource.get("attributes") or {}


def related_id(resource: dict[str, Any], relationship: str) -> str | None:
    data = ((resource.get("relationships") or {}).get(relationship) or {}).get("data")
    return str(data.get("id")) if isinstance(data, dict) and data.get("id") else None


@dataclass(frozen=True)
class Selection:
    app_id: str
    version_id: str
    version_state: str
    build_id: str
    build_state: str
    review_id: str
    review_state: str
    review_submitted_date: str
    review_item_id: str
    review_item_state: str


def resolve_version(app_id: str, app_version: str, bearer: Bearer) -> dict[str, Any]:
    payload = request(
        "GET",
        f"apps/{app_id}/appStoreVersions",
        bearer,
        params={
            "filter[platform]": "IOS",
            "filter[versionString]": app_version,
            "limit": "200",
        },
    )
    matches = [
        item
        for item in payload.get("data", []) or []
        if attributes(item).get("platform") == "IOS"
        and attributes(item).get("versionString") == app_version
    ]
    return exact_one(matches, f"iOS App Store version {app_version}")


def resolve_build(
    app_id: str, app_version: str, build_version: str, bearer: Bearer
) -> dict[str, Any]:
    payload = request(
        "GET",
        "builds",
        bearer,
        params={
            "filter[app]": app_id,
            "filter[version]": build_version,
            "include": "preReleaseVersion",
            "limit": "200",
        },
    )
    prereleases = {
        str(item.get("id")): attributes(item)
        for item in payload.get("included", []) or []
        if item.get("type") == "preReleaseVersions"
    }
    matches = []
    for item in payload.get("data", []) or []:
        prerelease = prereleases.get(related_id(item, "preReleaseVersion") or "", {})
        if (
            attributes(item).get("version") == build_version
            and prerelease.get("version") == app_version
            and prerelease.get("platform") == "IOS"
        ):
            matches.append(item)
    build = exact_one(matches, f"processed iOS build {app_version} ({build_version})")
    state = str(attributes(build).get("processingState") or "")
    if state != "VALID":
        fail(f"Build {build_version} is {state or '<missing state>'}, not VALID.")
    return build


def review_items(review_id: str, bearer: Bearer) -> list[dict[str, Any]]:
    return request(
        "GET",
        f"reviewSubmissions/{review_id}/items",
        bearer,
        params={
            "fields[reviewSubmissionItems]": "state,appStoreVersion",
            "include": "appStoreVersion",
            "limit": "50",
        },
    ).get("data", []) or []


def resolve_review(
    app_id: str, version_id: str, bearer: Bearer
) -> tuple[dict[str, Any], dict[str, Any]]:
    payload = request(
        "GET",
        "reviewSubmissions",
        bearer,
        params={"filter[app]": app_id, "filter[platform]": "IOS", "limit": "200"},
    )
    matches: list[tuple[dict[str, Any], dict[str, Any]]] = []
    observed_states: list[str] = []
    for review in payload.get("data", []) or []:
        state = str(attributes(review).get("state") or "")
        observed_states.append(state or "<missing>")
        if state not in OPEN_REVIEW_STATES | SUBMITTED_REVIEW_STATES:
            continue
        all_items = review_items(str(review["id"]), bearer)
        items = [
            item
            for item in all_items
            if related_id(item, "appStoreVersion") == version_id
        ]
        if len(items) > 1:
            fail("The current review submission contains the App Store version more than once.")
        if items:
            if len(all_items) != 1:
                fail(
                    "The review submission groups the App Store version with additional items; "
                    "refusing to resolve or submit those other products."
                )
            matches.append((review, items[0]))
    if len(matches) != 1:
        fail(
            "Expected exactly one current review submission for the App Store version; "
            f"App Store Connect returned {len(matches)}. Observed review states: "
            f"{', '.join(sorted(observed_states)) or '<none>'}."
        )
    return matches[0]


def inspect_selection(
    bundle_id: str, app_version: str, build_version: str, bearer: Bearer
) -> Selection:
    if bundle_id != BUNDLE_ID:
        fail(f"This operation is locked to {BUNDLE_ID}; received {bundle_id}.")
    app_id = resolve_app_id(bundle_id, bearer)
    version = resolve_version(app_id, app_version, bearer)
    version_state = str(attributes(version).get("appStoreState") or "")
    if version_state not in EDITABLE_VERSION_STATES | SUBMITTED_REVIEW_STATES:
        fail(f"App Store version {app_version} is in unexpected state {version_state!r}.")
    build = resolve_build(app_id, app_version, build_version, bearer)
    review, review_item = resolve_review(app_id, str(version["id"]), bearer)
    review_state = str(attributes(review).get("state") or "")
    item_state = str(attributes(review_item).get("state") or "")
    if review_state == "UNRESOLVED_ISSUES" and item_state not in {
        "REJECTED",
        "READY_FOR_REVIEW",
    }:
        fail(
            f"Review is UNRESOLVED_ISSUES but its App Store version item is {item_state!r}, "
            "not REJECTED or READY_FOR_REVIEW."
        )
    if review_state == "READY_FOR_REVIEW" and item_state != "READY_FOR_REVIEW":
        fail(
            f"Review is READY_FOR_REVIEW but its App Store version item is {item_state!r}."
        )
    return Selection(
        app_id=app_id,
        version_id=str(version["id"]),
        version_state=version_state,
        build_id=str(build["id"]),
        build_state=str(attributes(build)["processingState"]),
        review_id=str(review["id"]),
        review_state=review_state,
        review_submitted_date=str(attributes(review).get("submittedDate") or ""),
        review_item_id=str(review_item["id"]),
        review_item_state=item_state,
    )


def attached_build_id(version_id: str, bearer: Bearer) -> str | None:
    payload = request("GET", f"appStoreVersions/{version_id}/relationships/build", bearer)
    data = payload.get("data")
    return str(data.get("id")) if isinstance(data, dict) and data.get("id") else None


def attach_build(selection: Selection, bearer: Bearer) -> None:
    request(
        "PATCH",
        f"appStoreVersions/{selection.version_id}/relationships/build",
        bearer,
        payload={"data": {"type": "builds", "id": selection.build_id}},
    )
    actual = attached_build_id(selection.version_id, bearer)
    if actual != selection.build_id:
        fail(
            f"App Store Connect did not attach the requested build: expected "
            f"{selection.build_id}, read back {actual or '<none>'}."
        )


def resolve_review_item(selection: Selection, bearer: Bearer) -> None:
    if selection.review_item_state == "READY_FOR_REVIEW":
        return
    if selection.review_item_state != "REJECTED":
        fail(f"Cannot resolve review item from state {selection.review_item_state!r}.")
    response = request(
        "PATCH",
        f"reviewSubmissionItems/{selection.review_item_id}",
        bearer,
        payload={
            "data": {
                "type": "reviewSubmissionItems",
                "id": selection.review_item_id,
                "attributes": {"resolved": True},
            }
        },
    )
    state = str(attributes(response.get("data") or {}).get("state") or "")
    if state != "READY_FOR_REVIEW":
        fail(f"Resolved review item did not become READY_FOR_REVIEW; state is {state!r}.")


def verify_review_is_resubmittable(review_id: str, bearer: Bearer) -> None:
    response = request("GET", f"reviewSubmissions/{review_id}", bearer)
    state = str(attributes(response.get("data") or {}).get("state") or "")
    # Apple keeps the parent UNRESOLVED_ISSUES while its now-ready item waits
    # for the explicit resubmit action.
    if state not in {"UNRESOLVED_ISSUES", "READY_FOR_REVIEW"}:
        fail(f"Review entered unexpected state {state!r} after resolving its item.")


def submit_review(selection: Selection, bearer: Bearer) -> str:
    response = request(
        "PATCH",
        f"reviewSubmissions/{selection.review_id}",
        bearer,
        payload={
            "data": {
                "type": "reviewSubmissions",
                "id": selection.review_id,
                "attributes": {"submitted": True},
            }
        },
    )
    state = str(attributes(response.get("data") or {}).get("state") or "")
    if not state:
        readback = request("GET", f"reviewSubmissions/{selection.review_id}", bearer)
        state = str(attributes(readback.get("data") or {}).get("state") or "")
    if state not in SUBMITTED_REVIEW_STATES:
        fail(f"Review submission did not enter Apple's queue; read-back state is {state!r}.")
    return state


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Inspect or resubmit Dynawalla App Review.")
    parser.add_argument("--submit", action="store_true", help="perform the guarded mutations")
    args = parser.parse_args(argv)

    bundle_id = require("ASC_BUNDLE_ID")
    app_version = require("ASC_APP_VERSION")
    build_version = require("ASC_BUILD_VERSION")
    bearer = bearer_from_env()
    selection = inspect_selection(bundle_id, app_version, build_version, bearer)

    print(
        f"Resolved {bundle_id} {app_version} build {build_version}: "
        f"build={selection.build_state}, version={selection.version_state}, "
        f"review={selection.review_state}, item={selection.review_item_state}."
    )
    current_build = attached_build_id(selection.version_id, bearer)

    if selection.review_state in SUBMITTED_REVIEW_STATES:
        if current_build != selection.build_id:
            fail("Review is already submitted, but it is not attached to the requested build.")
        print(f"Review is already {selection.review_state}; no mutation was necessary.")
        return

    if not args.submit:
        print("Inspection passed. Re-run with --submit to attach the build and resubmit review.")
        return
    if not selection.review_submitted_date:
        fail(
            "This review submission has no prior submittedDate; refusing to turn a first "
            "submission into a resubmission."
        )
    if selection.version_state not in EDITABLE_VERSION_STATES:
        fail(f"App Store version is not editable from state {selection.version_state!r}.")

    attach_build(selection, bearer)
    resolve_review_item(selection, bearer)
    verify_review_is_resubmittable(selection.review_id, bearer)
    state = submit_review(selection, bearer)
    print(
        f"Submitted {bundle_id} {app_version} build {build_version} for App Review; "
        f"Apple reports {state}."
    )


if __name__ == "__main__":
    main()
