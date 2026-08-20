"""Unit tests for the guarded Dynawalla App Review resubmission client."""

import io
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))

import resubmit_app_review as review


def _resource(resource_type, resource_id, attrs=None, relationships=None):
    return {
        "type": resource_type,
        "id": resource_id,
        "attributes": attrs or {},
        "relationships": relationships or {},
    }


def _relationship(resource_type, resource_id):
    return {"data": {"type": resource_type, "id": resource_id}}


def _selection(version_state="REJECTED", review_state="UNRESOLVED_ISSUES"):
    item_state = "REJECTED" if review_state == "UNRESOLVED_ISSUES" else "READY_FOR_REVIEW"
    return review.Selection(
        "app",
        "version",
        version_state,
        "build",
        "VALID",
        "review",
        review_state,
        "2026-08-01T00:00:00Z",
        "item",
        item_state,
    )


def test_exact_one_refuses_ambiguous_resources(capsys):
    with pytest.raises(SystemExit):
        review.exact_one([{}, {}], "build")
    assert "exactly one build" in capsys.readouterr().out


def test_resolve_build_requires_exact_marketing_version(monkeypatch, capsys):
    payload = {
        "data": [
            _resource(
                "builds",
                "build",
                {"version": "0.3.11.29787564", "processingState": "VALID"},
                {"preReleaseVersion": _relationship("preReleaseVersions", "pre")},
            )
        ],
        "included": [
            _resource("preReleaseVersions", "pre", {"version": "0.3.10", "platform": "IOS"})
        ],
    }
    monkeypatch.setattr(review, "request", lambda *args, **kwargs: payload)
    with pytest.raises(SystemExit):
        review.resolve_build("app", "0.3.11", "0.3.11.29787564", object())
    assert "returned 0" in capsys.readouterr().out


def test_resolve_version_uses_the_app_scoped_relationship_endpoint(monkeypatch):
    seen = {}
    version = _resource(
        "appStoreVersions",
        "version",
        {"versionString": "0.3.11", "platform": "IOS", "appStoreState": "REJECTED"},
    )

    def fake_request(method, path, bearer, **kwargs):
        seen["method"] = method
        seen["path"] = path
        seen["params"] = kwargs["params"]
        return {"data": [version]}

    monkeypatch.setattr(review, "request", fake_request)
    assert review.resolve_version("app-id", "0.3.11", object()) == version
    assert seen["method"] == "GET"
    assert seen["path"] == "apps/app-id/appStoreVersions"
    assert seen["params"] == {
        "filter[platform]": "IOS",
        "filter[versionString]": "0.3.11",
        "limit": "200",
    }


def test_resolve_build_requires_valid_processing_state(monkeypatch, capsys):
    payload = {
        "data": [
            _resource(
                "builds",
                "build",
                {"version": "0.3.11.29787564", "processingState": "PROCESSING"},
                {"preReleaseVersion": _relationship("preReleaseVersions", "pre")},
            )
        ],
        "included": [
            _resource("preReleaseVersions", "pre", {"version": "0.3.11", "platform": "IOS"})
        ],
    }
    monkeypatch.setattr(review, "request", lambda *args, **kwargs: payload)
    with pytest.raises(SystemExit):
        review.resolve_build("app", "0.3.11", "0.3.11.29787564", object())
    assert "not VALID" in capsys.readouterr().out


def test_inspection_mode_is_read_only(monkeypatch, capsys):
    monkeypatch.setenv("ASC_BUNDLE_ID", review.BUNDLE_ID)
    monkeypatch.setenv("ASC_APP_VERSION", "0.3.11")
    monkeypatch.setenv("ASC_BUILD_VERSION", "0.3.11.29787564")
    monkeypatch.setattr(review, "bearer_from_env", lambda: object())
    monkeypatch.setattr(review, "inspect_selection", lambda *args: _selection())
    monkeypatch.setattr(review, "attached_build_id", lambda *args: "old-build")
    monkeypatch.setattr(review, "attach_build", lambda *args: pytest.fail("mutation in inspect mode"))
    monkeypatch.setattr(review, "submit_review", lambda *args: pytest.fail("mutation in inspect mode"))
    review.main([])
    assert "Inspection passed" in capsys.readouterr().out


def test_submit_attaches_exact_build_before_submitting(monkeypatch):
    monkeypatch.setenv("ASC_BUNDLE_ID", review.BUNDLE_ID)
    monkeypatch.setenv("ASC_APP_VERSION", "0.3.11")
    monkeypatch.setenv("ASC_BUILD_VERSION", "0.3.11.29787564")
    monkeypatch.setattr(review, "bearer_from_env", lambda: object())
    monkeypatch.setattr(review, "inspect_selection", lambda *args: _selection())
    monkeypatch.setattr(review, "attached_build_id", lambda *args: "old-build")
    calls = []
    monkeypatch.setattr(review, "attach_build", lambda *args: calls.append("attach"))
    monkeypatch.setattr(review, "resolve_review_item", lambda *args: calls.append("resolve"))
    monkeypatch.setattr(review, "wait_until_review_is_ready", lambda *args: calls.append("ready"))
    monkeypatch.setattr(review, "submit_review", lambda *args: calls.append("submit") or "WAITING_FOR_REVIEW")
    review.main(["--submit"])
    assert calls == ["attach", "resolve", "ready", "submit"]


def test_submit_refuses_a_first_submission(monkeypatch, capsys):
    monkeypatch.setenv("ASC_BUNDLE_ID", review.BUNDLE_ID)
    monkeypatch.setenv("ASC_APP_VERSION", "0.4.0")
    monkeypatch.setenv("ASC_BUILD_VERSION", "0.4.0.29787564")
    monkeypatch.setattr(review, "bearer_from_env", lambda: object())
    selection = _selection("PREPARE_FOR_SUBMISSION", "READY_FOR_REVIEW")
    selection = review.Selection(
        selection.app_id,
        selection.version_id,
        selection.version_state,
        selection.build_id,
        selection.build_state,
        selection.review_id,
        selection.review_state,
        "",
        selection.review_item_id,
        selection.review_item_state,
    )
    monkeypatch.setattr(review, "inspect_selection", lambda *args: selection)
    monkeypatch.setattr(review, "attached_build_id", lambda *args: None)
    with pytest.raises(SystemExit):
        review.main(["--submit"])
    assert "no prior submittedDate" in capsys.readouterr().out


def test_already_submitted_is_idempotent_only_for_the_exact_build(monkeypatch, capsys):
    monkeypatch.setenv("ASC_BUNDLE_ID", review.BUNDLE_ID)
    monkeypatch.setenv("ASC_APP_VERSION", "0.3.11")
    monkeypatch.setenv("ASC_BUILD_VERSION", "0.3.11.29787564")
    monkeypatch.setattr(review, "bearer_from_env", lambda: object())
    monkeypatch.setattr(
        review,
        "inspect_selection",
        lambda *args: _selection("WAITING_FOR_REVIEW", "WAITING_FOR_REVIEW"),
    )
    monkeypatch.setattr(review, "attached_build_id", lambda *args: "build")
    review.main(["--submit"])
    assert "no mutation was necessary" in capsys.readouterr().out


def test_already_submitted_with_different_build_fails(monkeypatch, capsys):
    monkeypatch.setenv("ASC_BUNDLE_ID", review.BUNDLE_ID)
    monkeypatch.setenv("ASC_APP_VERSION", "0.3.11")
    monkeypatch.setenv("ASC_BUILD_VERSION", "0.3.11.29787564")
    monkeypatch.setattr(review, "bearer_from_env", lambda: object())
    monkeypatch.setattr(
        review,
        "inspect_selection",
        lambda *args: _selection("WAITING_FOR_REVIEW", "WAITING_FOR_REVIEW"),
    )
    monkeypatch.setattr(review, "attached_build_id", lambda *args: "other-build")
    with pytest.raises(SystemExit):
        review.main(["--submit"])
    assert "not attached to the requested build" in capsys.readouterr().out


def test_attach_build_uses_apples_relationship_payload_and_reads_it_back(monkeypatch):
    calls = []

    def fake_request(method, path, bearer, **kwargs):
        calls.append((method, path, kwargs.get("payload")))
        if method == "GET":
            return {"data": {"type": "builds", "id": "build"}}
        return {}

    monkeypatch.setattr(review, "request", fake_request)
    review.attach_build(_selection(), object())
    assert calls[0] == (
        "PATCH",
        "appStoreVersions/version/relationships/build",
        {"data": {"type": "builds", "id": "build"}},
    )


def test_submit_review_uses_submitted_attribute(monkeypatch):
    calls = []

    def fake_request(method, path, bearer, **kwargs):
        calls.append((method, path, kwargs.get("payload")))
        return {"data": _resource("reviewSubmissions", "review", {"state": "WAITING_FOR_REVIEW"})}

    monkeypatch.setattr(review, "request", fake_request)
    assert review.submit_review(_selection(), object()) == "WAITING_FOR_REVIEW"
    assert calls == [
        (
            "PATCH",
            "reviewSubmissions/review",
            {
                "data": {
                    "type": "reviewSubmissions",
                    "id": "review",
                    "attributes": {"submitted": True},
                }
            },
        )
    ]


def test_rejected_item_is_marked_resolved(monkeypatch):
    calls = []

    def fake_request(method, path, bearer, **kwargs):
        calls.append((method, path, kwargs.get("payload")))
        return {
            "data": _resource("reviewSubmissionItems", "item", {"state": "READY_FOR_REVIEW"})
        }

    monkeypatch.setattr(review, "request", fake_request)
    review.resolve_review_item(_selection(), object())
    assert calls == [
        (
            "PATCH",
            "reviewSubmissionItems/item",
            {
                "data": {
                    "type": "reviewSubmissionItems",
                    "id": "item",
                    "attributes": {"resolved": True},
                }
            },
        )
    ]


def test_parent_review_must_be_ready_before_submission(monkeypatch):
    states = iter(["UNRESOLVED_ISSUES", "READY_FOR_REVIEW"])
    monkeypatch.setattr(
        review,
        "request",
        lambda *args, **kwargs: {
            "data": _resource("reviewSubmissions", "review", {"state": next(states)})
        },
    )
    sleeps = []
    monkeypatch.setattr(review.time, "sleep", lambda seconds: sleeps.append(seconds))
    review.wait_until_review_is_ready("review", object())
    assert sleeps == [5]


def test_review_with_additional_items_is_refused(monkeypatch, capsys):
    parent = _resource("reviewSubmissions", "review", {"state": "UNRESOLVED_ISSUES"})
    app_item = _resource(
        "reviewSubmissionItems",
        "app-item",
        {"state": "REJECTED"},
        {"appStoreVersion": _relationship("appStoreVersions", "version")},
    )
    iap_item = _resource("reviewSubmissionItems", "iap-item", {"state": "READY_FOR_REVIEW"})

    def fake_request(method, path, bearer, **kwargs):
        if path == "reviewSubmissions":
            return {"data": [parent]}
        return {"data": [app_item, iap_item]}

    monkeypatch.setattr(review, "request", fake_request)
    with pytest.raises(SystemExit):
        review.resolve_review("app", "version", object())
    assert "additional items" in capsys.readouterr().out


def test_workflow_cannot_select_branch_code():
    workflow = (Path(__file__).parents[1] / "workflows/resubmit-dynawalla-review.yml").read_text()
    assert "repository_dispatch:" in workflow
    assert "workflow_dispatch:" not in workflow
    assert "github.ref == 'refs/heads/main'" in workflow


def test_http_mutation_error_does_not_print_credentials(monkeypatch, capsys):
    secret = "TOP-SECRET-PRIVATE-KEY"
    bearer = type("Bearer", (), {"value": lambda self: secret})()
    error = urllib.error.HTTPError(
        "https://example.invalid", 409, "conflict", {}, io.BytesIO(b'{"errors":[{"detail":"bad state"}]}')
    )
    monkeypatch.setattr(urllib.request, "urlopen", lambda *args, **kwargs: (_ for _ in ()).throw(error))
    with pytest.raises(SystemExit):
        review.request("PATCH", "reviewSubmissions/review", bearer, payload={"data": {}})
    output = capsys.readouterr().out
    assert "409" in output
    assert secret not in output


def test_request_serializes_json_api_body(monkeypatch):
    seen = {}

    class Response:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def read(self):
            return json.dumps({"data": {"id": "ok"}}).encode()

    def fake_open(req, timeout):
        seen["method"] = req.method
        seen["body"] = json.loads(req.data)
        seen["content_type"] = req.headers["Content-type"]
        return Response()

    monkeypatch.setattr(urllib.request, "urlopen", fake_open)
    bearer = type("Bearer", (), {"value": lambda self: "token"})()
    result = review.request("PATCH", "x", bearer, payload={"data": {"id": "ok"}})
    assert result["data"]["id"] == "ok"
    assert seen == {
        "method": "PATCH",
        "body": {"data": {"id": "ok"}},
        "content_type": "application/json",
    }
