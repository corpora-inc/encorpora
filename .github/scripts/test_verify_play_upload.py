"""Tests for the Play post-upload verifier.

Same reason `test_adversarial_review.py` exists: this script's regression mode
is to PASS WRONGLY, it runs only during a release, and no other job can detect
it. These assertions are the only signal.

Every test here fails against the version of the script that was first written:

  * it imported `google.auth.transport.requests`, which `pip install google-auth`
    does NOT provide (it is the `[requests]` extra), and then reported the
    failure as "google-auth is not installed"
  * it passed when the versionCode was merely PRESENT on the track — which is
    exactly the state the duplicate it exists to catch produces
  * it POSTed with `data=None` and no Content-Length
  * it had no 404 branch that could distinguish "no track yet" from "no app"

Run: python -m pytest .github/scripts -q
"""

import io
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))

import verify_play_upload as vp  # noqa: E402

SOURCE = Path(__file__).resolve().parent / "verify_play_upload.py"


def _http_error(code, body=b"{}"):
    return urllib.error.HTTPError(
        "https://example.invalid", code, "boom", {}, io.BytesIO(body)
    )


class _Response:
    def __init__(self, payload):
        self._payload = json.dumps(payload).encode("utf-8")

    def read(self):
        return self._payload

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False


# --------------------------------------------------- B1: the dependency path


def test_does_not_import_the_google_auth_requests_transport():
    """`pip install google-auth` does not ship `google.auth.transport.requests`.

    It is an extra. Importing it after a bare `google-auth` install raises
    ImportError at the LAST step of a release, after the AAB is already on the
    track. The token is minted with urllib + PyJWT instead.
    """
    text = SOURCE.read_text(encoding="utf-8")
    assert "google.auth.transport.requests" not in text
    assert "from google.oauth2 import" not in text


def test_missing_pyjwt_names_pyjwt(monkeypatch):
    """The error must name the package that is actually missing."""
    monkeypatch.setitem(sys.modules, "jwt", None)
    with pytest.raises(SystemExit):
        vp._jwt_module()


def test_missing_pyjwt_message(monkeypatch, capsys):
    monkeypatch.setitem(sys.modules, "jwt", None)
    with pytest.raises(SystemExit):
        vp._jwt_module()
    out = capsys.readouterr().out
    assert "pyjwt" in out.lower()
    assert "google-auth" not in out


def test_assertion_targets_googles_token_endpoint(monkeypatch):
    captured = {}

    class FakeJwt:
        @staticmethod
        def encode(claims, key, algorithm=None):
            captured.update(claims=claims, key=key, algorithm=algorithm)
            return "signed"

    monkeypatch.setitem(sys.modules, "jwt", FakeJwt)
    info = {"client_email": "sa@example.iam.gserviceaccount.com", "private_key": "KEY"}
    assert vp.build_assertion(info, 1000) == "signed"
    assert captured["claims"]["aud"] == vp.DEFAULT_TOKEN_URI
    assert captured["claims"]["iss"] == info["client_email"]
    assert captured["claims"]["scope"] == vp.SCOPE
    assert captured["claims"]["exp"] - captured["claims"]["iat"] <= 3600
    assert captured["algorithm"] == "RS256"


# ------------------------------------------- B2: presence is not "we put it there"


TRACK_WITH_777 = {
    "releases": [
        {"name": "old", "status": "completed", "versionCodes": ["777"]},
    ]
}


def test_preexisting_version_code_is_a_failure(monkeypatch, capsys):
    """THE finding. The duplicate this script exists to catch is 'a committed
    edit with the OLD bundle still in place' — in which case the versionCode is
    on the track and a presence check passes while nothing shipped."""
    monkeypatch.setenv("PLAY_PACKAGE_NAME", "inc.corpora.dynawalla")
    monkeypatch.setenv("PLAY_TRACK", "internal")
    monkeypatch.setenv("PLAY_VERSION_CODE", "777")
    monkeypatch.setenv("PLAY_PRE_UPLOAD_CODES", "775,777")
    monkeypatch.setenv("PLAY_SERVICE_ACCOUNT_JSON", json.dumps({"client_email": "a", "private_key": "b"}))
    monkeypatch.setattr(vp, "access_token", lambda info: "tok")
    monkeypatch.setattr(
        vp,
        "read_track",
        lambda *a, **k: pytest.fail("must fail on the snapshot, before touching the network"),
    )

    with pytest.raises(SystemExit) as exc:
        vp.main([])
    assert exc.value.code == 1
    assert "ALREADY on track" in capsys.readouterr().out


def test_version_code_added_by_this_run_passes(monkeypatch, capsys):
    monkeypatch.setenv("PLAY_PACKAGE_NAME", "inc.corpora.dynawalla")
    monkeypatch.setenv("PLAY_TRACK", "internal")
    monkeypatch.setenv("PLAY_VERSION_CODE", "777")
    monkeypatch.setenv("PLAY_PRE_UPLOAD_CODES", "775")
    monkeypatch.setenv("PLAY_SERVICE_ACCOUNT_JSON", json.dumps({"client_email": "a", "private_key": "b"}))
    monkeypatch.setattr(vp, "access_token", lambda info: "tok")
    monkeypatch.setattr(vp, "read_track", lambda *a, **k: TRACK_WITH_777)

    vp.main([])
    assert "added to track" in capsys.readouterr().out


def test_absent_version_code_fails(monkeypatch, capsys):
    monkeypatch.setenv("PLAY_PACKAGE_NAME", "inc.corpora.dynawalla")
    monkeypatch.setenv("PLAY_TRACK", "internal")
    monkeypatch.setenv("PLAY_VERSION_CODE", "999")
    monkeypatch.setenv("PLAY_PRE_UPLOAD_CODES", "none")
    monkeypatch.setenv("PLAY_SERVICE_ACCOUNT_JSON", json.dumps({"client_email": "a", "private_key": "b"}))
    monkeypatch.setattr(vp, "access_token", lambda info: "tok")
    monkeypatch.setattr(vp, "read_track", lambda *a, **k: TRACK_WITH_777)

    with pytest.raises(SystemExit):
        vp.main([])
    assert "is NOT on track" in capsys.readouterr().out


def test_missing_snapshot_is_a_failure_not_an_empty_track(monkeypatch, capsys):
    """A snapshot step that silently did not run must not read as 'the track
    was empty', which would restore the exact presence-only check."""
    monkeypatch.setenv("PLAY_PACKAGE_NAME", "inc.corpora.dynawalla")
    monkeypatch.setenv("PLAY_TRACK", "internal")
    monkeypatch.setenv("PLAY_VERSION_CODE", "777")
    monkeypatch.delenv("PLAY_PRE_UPLOAD_CODES", raising=False)
    monkeypatch.setenv("PLAY_SERVICE_ACCOUNT_JSON", json.dumps({"client_email": "a", "private_key": "b"}))
    monkeypatch.setattr(vp, "access_token", lambda info: "tok")

    with pytest.raises(SystemExit):
        vp.main([])
    assert "PLAY_PRE_UPLOAD_CODES is not set" in capsys.readouterr().out


def test_parse_snapshot_round_trips():
    assert vp.parse_snapshot("none") == set()
    assert vp.parse_snapshot("1,2,3") == {1, 2, 3}
    assert vp.render_snapshot([]) == "none"
    assert vp.render_snapshot([3, 1]) == "3,1"
    assert vp.parse_snapshot(vp.render_snapshot([5, 9])) == {5, 9}


def test_parse_snapshot_rejects_garbage(capsys):
    with pytest.raises(SystemExit):
        vp.parse_snapshot("not-a-code")
    assert "non-integer" in capsys.readouterr().out


def test_codes_on_track_is_flat_sorted_and_deduped():
    state = {
        "releases": [
            {"versionCodes": ["3", "1"]},
            {"versionCodes": [1, 2]},
            {"versionCodes": None},
            {},
        ]
    }
    assert vp.codes_on_track(state) == [1, 2, 3]
    assert vp.codes_on_track({}) == []


# ------------------------------------------------------ the 403 / 404 branches


def test_403_names_the_per_app_grant(monkeypatch, capsys):
    monkeypatch.setattr(
        urllib.request, "urlopen", lambda *a, **k: (_ for _ in ()).throw(_http_error(403))
    )
    with pytest.raises(SystemExit):
        vp.call("GET", "https://example.invalid/x", "tok")
    out = capsys.readouterr().out
    assert "403" in out and "per-app" in out.lower()


def test_404_names_the_missing_app_record(monkeypatch, capsys):
    monkeypatch.setattr(
        urllib.request, "urlopen", lambda *a, **k: (_ for _ in ()).throw(_http_error(404))
    )
    with pytest.raises(SystemExit):
        vp.call("GET", "https://example.invalid/x", "tok")
    assert "app record" in capsys.readouterr().out


def test_404_is_an_empty_track_when_allowed(monkeypatch):
    """A track with no release ever 404s. For the PRE-upload snapshot of a
    first release that is the normal state, not an error."""
    monkeypatch.setattr(
        urllib.request, "urlopen", lambda *a, **k: (_ for _ in ()).throw(_http_error(404))
    )
    assert vp.call("GET", "https://example.invalid/x", "tok", allow_404=True) == {}


def test_500_is_reported_verbatim(monkeypatch, capsys):
    monkeypatch.setattr(
        urllib.request,
        "urlopen",
        lambda *a, **k: (_ for _ in ()).throw(_http_error(500, b'{"error":"nope"}')),
    )
    with pytest.raises(SystemExit):
        vp.call("GET", "https://example.invalid/x", "tok")
    assert "HTTP 500" in capsys.readouterr().out


# ------------------------------------------------------------------ m18: POST


def test_post_carries_an_explicit_empty_body(monkeypatch):
    seen = {}

    def fake_urlopen(request, timeout=None):
        seen["data"] = request.data
        seen["length"] = request.get_header("Content-length")
        return _Response({"id": "edit-1"})

    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)
    assert vp.call("POST", "https://example.invalid/edits", "tok") == {"id": "edit-1"}
    assert seen["data"] == b""
    assert seen["length"] == "0"


def test_get_sends_no_body(monkeypatch):
    seen = {}

    def fake_urlopen(request, timeout=None):
        seen["data"] = request.data
        return _Response({})

    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)
    vp.call("GET", "https://example.invalid/x", "tok")
    assert seen["data"] is None


# ------------------------------------------------------------ service account


def test_rejects_non_service_account_json(capsys):
    with pytest.raises(SystemExit):
        vp.parse_service_account('{"hello": "world"}')
    assert "client_email" in capsys.readouterr().out


def test_rejects_unparseable_json(capsys):
    with pytest.raises(SystemExit):
        vp.parse_service_account("{not json")
    assert "not valid JSON" in capsys.readouterr().out
