"""Tests for the TestFlight post-upload verifier.

Same reason `test_adversarial_review.py` exists: this script's regression mode
is to PASS WRONGLY, it runs only during a release, and no other job can detect
it.

Every test here fails against the version of the script that was first written:

  * it returned success for ANY build whose `version` matched, with nothing
    correlating the build to this run — so a pre-existing build with the same
    CFBundleVersion satisfied it immediately, which is precisely the
    same-minute collision it was cited as the mitigation for
  * it minted ONE 19-minute JWT and then polled for up to
    ASC_TIMEOUT_SECONDS, so raising that past ~19 minutes expired the token
    mid-poll and reported "the API key is not valid for this team"
  * it had no 403 or 404 branch

Run: python -m pytest .github/scripts -q
"""

import io
import sys
import urllib.error
import urllib.request
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))

import verify_testflight_upload as vt  # noqa: E402


def _http_error(code, body=b"{}"):
    return urllib.error.HTTPError(
        "https://example.invalid", code, "boom", {}, io.BytesIO(body)
    )


def _build(bid, version, uploaded, state="VALID"):
    return {
        "id": bid,
        "attributes": {"version": version, "uploadedDate": uploaded, "processingState": state},
    }


RUN_STARTED = 1_785_000_000.0  # arbitrary fixed epoch for the tests
BEFORE = "2026-07-25T00:00:00Z"  # comfortably before RUN_STARTED
AFTER = "2026-08-01T00:00:00Z"  # comfortably after


# ------------------------------------- B2: a matching build is not OUR build


def test_a_build_uploaded_before_the_run_is_stale():
    """THE finding. A pre-existing build with the same CFBundleVersion used to
    satisfy the check instantly — while Apple was rejecting our upload as a
    duplicate."""
    verdict, _ = vt.classify(_build("b1", "29750720", BEFORE), RUN_STARTED)
    assert verdict == "stale"


def test_a_build_uploaded_after_the_run_started_is_ours():
    verdict, uploaded = vt.classify(_build("b2", "29750720", AFTER), RUN_STARTED)
    assert verdict == "ours"
    assert uploaded > RUN_STARTED


def test_a_build_with_no_uploaded_date_is_never_ours():
    """Unattributable must not mean "assume it's ours"; that is how a green run
    ships nothing."""
    verdict, _ = vt.classify(_build("b3", "29750720", None), RUN_STARTED)
    assert verdict == "undated"


def test_second_resolution_clock_skew_is_tolerated():
    """The gate job and ASC are different clocks; a build uploaded a few
    seconds 'before' the recorded start is still ours."""
    just_before = vt._dt.datetime.fromtimestamp(
        RUN_STARTED - 30, vt._dt.timezone.utc
    ).isoformat()
    verdict, _ = vt.classify(_build("b4", "29750720", just_before), RUN_STARTED)
    assert verdict == "ours"


def test_main_fails_on_a_duplicate(monkeypatch, capsys):
    monkeypatch.setenv("ASC_BUNDLE_ID", "inc.corpora.dynawalla")
    monkeypatch.setenv("ASC_BUILD_VERSION", "29750720")
    monkeypatch.setenv("ASC_MIN_UPLOADED_DATE", str(int(RUN_STARTED)))
    monkeypatch.setenv("ASC_KEY_ID", "K")
    monkeypatch.setenv("ASC_ISSUER_ID", "I")
    monkeypatch.setenv("ASC_API_KEY_P8", "P")
    monkeypatch.setattr(vt.Bearer, "value", lambda self: "tok")

    def fake_get(path, params, bearer):
        if path == "apps":
            return {"data": [{"id": "app1", "attributes": {"bundleId": "inc.corpora.dynawalla"}}]}
        return {"data": [_build("old", "29750720", BEFORE)]}

    monkeypatch.setattr(vt, "get", fake_get)
    with pytest.raises(SystemExit) as exc:
        vt.main()
    assert exc.value.code == 1
    out = capsys.readouterr().out
    assert "already on App Store Connect before this run started" in out


def test_main_passes_on_our_own_build(monkeypatch, capsys):
    monkeypatch.setenv("ASC_BUNDLE_ID", "inc.corpora.dynawalla")
    monkeypatch.setenv("ASC_BUILD_VERSION", "29750720")
    monkeypatch.setenv("ASC_MIN_UPLOADED_DATE", str(int(RUN_STARTED)))
    monkeypatch.setenv("ASC_KEY_ID", "K")
    monkeypatch.setenv("ASC_ISSUER_ID", "I")
    monkeypatch.setenv("ASC_API_KEY_P8", "P")
    monkeypatch.setattr(vt.Bearer, "value", lambda self: "tok")

    def fake_get(path, params, bearer):
        if path == "apps":
            return {"data": [{"id": "app1", "attributes": {"bundleId": "inc.corpora.dynawalla"}}]}
        return {"data": [_build("new", "29750720", AFTER, state="PROCESSING")]}

    monkeypatch.setattr(vt, "get", fake_get)
    vt.main()
    assert "was uploaded by this run" in capsys.readouterr().out


def test_main_fails_on_an_invalid_build(monkeypatch, capsys):
    monkeypatch.setenv("ASC_BUNDLE_ID", "inc.corpora.dynawalla")
    monkeypatch.setenv("ASC_BUILD_VERSION", "29750720")
    monkeypatch.setenv("ASC_MIN_UPLOADED_DATE", str(int(RUN_STARTED)))
    monkeypatch.setenv("ASC_KEY_ID", "K")
    monkeypatch.setenv("ASC_ISSUER_ID", "I")
    monkeypatch.setenv("ASC_API_KEY_P8", "P")
    monkeypatch.setattr(vt.Bearer, "value", lambda self: "tok")

    def fake_get(path, params, bearer):
        if path == "apps":
            return {"data": [{"id": "app1", "attributes": {"bundleId": "inc.corpora.dynawalla"}}]}
        return {"data": [_build("new", "29750720", AFTER, state="INVALID")]}

    monkeypatch.setattr(vt, "get", fake_get)
    with pytest.raises(SystemExit):
        vt.main()
    assert "rejected by App Store Connect" in capsys.readouterr().out


def test_missing_min_uploaded_date_is_a_failure(monkeypatch, capsys):
    monkeypatch.setenv("ASC_BUNDLE_ID", "inc.corpora.dynawalla")
    monkeypatch.setenv("ASC_BUILD_VERSION", "29750720")
    monkeypatch.delenv("ASC_MIN_UPLOADED_DATE", raising=False)
    with pytest.raises(SystemExit):
        vt.main()
    assert "ASC_MIN_UPLOADED_DATE is not set" in capsys.readouterr().out


# ---------------------------------------------------------- m12: token expiry


def test_bearer_reuses_a_fresh_token(monkeypatch):
    minted = []
    monkeypatch.setattr(vt, "mint_token", lambda *a: minted.append(1) or f"t{len(minted)}")
    bearer = vt.Bearer("K", "I", "P")
    assert bearer.value() == "t1"
    assert bearer.value() == "t1"
    assert len(minted) == 1


def test_bearer_remints_before_apples_ceiling(monkeypatch):
    """ASC_TIMEOUT_SECONDS can legitimately exceed the token lifetime. A single
    19-minute token would expire mid-poll and report a 401 that reads like a
    bad key."""
    minted = []
    monkeypatch.setattr(vt, "mint_token", lambda *a: minted.append(1) or f"t{len(minted)}")
    clock = [1000.0]
    monkeypatch.setattr(vt.time, "time", lambda: clock[0])
    bearer = vt.Bearer("K", "I", "P")
    assert bearer.value() == "t1"
    clock[0] += vt.TOKEN_REFRESH_AFTER_SECONDS + 1
    assert bearer.value() == "t2"
    assert vt.TOKEN_REFRESH_AFTER_SECONDS < vt.TOKEN_LIFETIME_SECONDS
    assert vt.TOKEN_LIFETIME_SECONDS < 20 * 60  # Apple's hard ceiling


def test_missing_pyjwt_names_pyjwt(monkeypatch, capsys):
    monkeypatch.setitem(sys.modules, "jwt", None)
    with pytest.raises(SystemExit):
        vt._jwt_module()
    assert "pyjwt" in capsys.readouterr().out.lower()


# --------------------------------------------------------- the HTTP branches


def _bearer(monkeypatch):
    monkeypatch.setattr(vt.Bearer, "value", lambda self: "tok")
    return vt.Bearer("K", "I", "P")


def test_401_says_the_key_is_wrong_for_the_team(monkeypatch, capsys):
    bearer = _bearer(monkeypatch)
    monkeypatch.setattr(
        urllib.request, "urlopen", lambda *a, **k: (_ for _ in ()).throw(_http_error(401))
    )
    with pytest.raises(SystemExit):
        vt.get("builds", {}, bearer)
    assert "401" in capsys.readouterr().out


def test_403_names_the_missing_role(monkeypatch, capsys):
    bearer = _bearer(monkeypatch)
    monkeypatch.setattr(
        urllib.request, "urlopen", lambda *a, **k: (_ for _ in ()).throw(_http_error(403))
    )
    with pytest.raises(SystemExit):
        vt.get("builds", {}, bearer)
    out = capsys.readouterr().out
    assert "403" in out and "role" in out.lower()


def test_404_points_at_the_missing_app_record(monkeypatch, capsys):
    bearer = _bearer(monkeypatch)
    monkeypatch.setattr(
        urllib.request, "urlopen", lambda *a, **k: (_ for _ in ()).throw(_http_error(404))
    )
    with pytest.raises(SystemExit):
        vt.get("builds", {}, bearer)
    out = capsys.readouterr().out
    assert "404" in out and "app record" in out


def test_no_app_record_is_a_founder_action(monkeypatch, capsys):
    monkeypatch.setenv("ASC_BUNDLE_ID", "inc.corpora.dynawalla")
    monkeypatch.setenv("ASC_BUILD_VERSION", "29750720")
    monkeypatch.setenv("ASC_MIN_UPLOADED_DATE", str(int(RUN_STARTED)))
    monkeypatch.setenv("ASC_KEY_ID", "K")
    monkeypatch.setenv("ASC_ISSUER_ID", "I")
    monkeypatch.setenv("ASC_API_KEY_P8", "P")
    monkeypatch.setattr(vt.Bearer, "value", lambda self: "tok")
    monkeypatch.setattr(vt, "get", lambda *a, **k: {"data": []})
    with pytest.raises(SystemExit):
        vt.main()
    assert "founder action" in capsys.readouterr().out


# ------------------------------------------------------------------- parsing


def test_parse_uploaded_date_handles_z_and_offsets():
    assert vt.parse_uploaded_date("2026-07-25T00:00:00Z") == vt.parse_uploaded_date(
        "2026-07-25T00:00:00+00:00"
    )
    assert vt.parse_uploaded_date("2026-07-25T00:00:00-07:00") > vt.parse_uploaded_date(
        "2026-07-25T00:00:00Z"
    )
    assert vt.parse_uploaded_date(None) is None
    assert vt.parse_uploaded_date("") is None
    assert vt.parse_uploaded_date("yesterday") is None


def test_matching_builds_filters_by_version():
    payload = {"data": [_build("a", "1", AFTER), _build("b", "2", AFTER)]}
    assert [b["id"] for b in vt.matching_builds(payload, "2")] == ["b"]
    assert vt.matching_builds({}, "2") == []
