"""Tests for the TestFlight internal-tester manager.

Same reason `test_verify_testflight_upload.py` exists, one notch worse: this
script's credentials live only in GitHub Actions, so it CANNOT be rehearsed
against the live API before its first real dispatch, and its failure mode is to
mutate the Corpora Inc. App Store Connect account in a way nobody asked for.
These tests are the only thing standing in for that rehearsal.

What each one is guarding:

  * an internal group is chosen by `isInternalGroup is True` and never by
    position — adding an email to an EXTERNAL group looks like success and then
    sits behind Beta App Review forever
  * a tester already in the group is a SUCCESS, and sends nothing
  * an email that is not an App Store Connect user is REFUSED, with nothing
    sent, unless --invite was passed — inviting is a permission grant
  * --invite stops after the invitation: a pending invitation is not an account
  * --dry-run sends no POST at all
  * a truncated paginated read is never answered as "absent"
  * the private key never reaches stdout

Run: python -m pytest .github/scripts -q
"""

import io
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))

import manage_testflight_testers as mt  # noqa: E402

EMAIL = "skylar.saveland+apple@gmail.com"
APP = {"id": "app1", "attributes": {"bundleId": "inc.corpora.dynawalla"}}
INTERNAL = {"id": "grp-int", "attributes": {"name": "Internal Testers", "isInternalGroup": True}}
EXTERNAL = {"id": "grp-ext", "attributes": {"name": "Public", "isInternalGroup": False}}
# A stand-in for the .p8, shaped by `hygiene.yml`'s gitleaks scan of this very
# diff — which flagged two earlier spellings of this line. No PEM armour, because
# the `private-key` rule matches `-----BEGIN ... PRIVATE KEY-----` in a fixture
# as happily as in a real key; no `SECRET`/`KEY` in the name and spaces in the
# value, because `generic-api-key` matches on the assignment target and on a
# `[\w.=-]{10,150}` value.
P8_STAND_IN = "p8 stand-in, must never be logged"


class FakeApi:
    """The HTTP layer. Routes on (method, path); records every mutation.

    Deliberately NOT a mock of `request_json`'s callers: pagination, the
    client-side email matching that defends against an ignored `filter[...]`,
    and the 201-vs-204 body handling all live in the layer above it.
    """

    def __init__(self, *, groups=None, members=(), testers=(), users=(), invitations=()):
        self.groups = [INTERNAL] if groups is None else groups
        self.members = list(members)
        self.testers = list(testers)
        self.users = list(users)
        self.invitations = list(invitations)
        self.writes = []
        self.responses = {}  # (method, path) -> exception to raise

    def __call__(self, method, url, bearer, body=None):
        path = urllib.parse.urlparse(url).path
        key = (method, path)
        if key in self.responses:
            raise self.responses.pop(key)
        if method == "POST":
            self.writes.append((path, body))
            return self._post(path, body)
        return {"data": self._get(path)}

    def _get(self, path):
        if path == "/v1/apps":
            return [APP]
        if path == "/v1/apps/app1/betaGroups":
            return self.groups
        if path.endswith("/betaTesters") and path.startswith("/v1/betaGroups/"):
            return self.members
        if path == "/v1/betaTesters":
            return self.testers
        if path == "/v1/users":
            return self.users
        if path == "/v1/userInvitations":
            return self.invitations
        raise AssertionError(f"unrouted GET {path}")

    def _post(self, path, body):
        if path == "/v1/betaGroups":
            created = {
                "id": "grp-new",
                "attributes": dict(body["data"]["attributes"]),
            }
            self.groups.append(created)
            return {"data": created}
        if path == "/v1/betaTesters":
            return {"data": {"id": "tester-new"}}
        if path.endswith("/relationships/betaTesters"):
            return {}  # a real 204: empty body
        if path == "/v1/userInvitations":
            return {"data": {"id": "inv-new"}}
        raise AssertionError(f"unrouted POST {path}")

    def posted(self, path):
        return [b for p, b in self.writes if p == path]


@pytest.fixture
def env(monkeypatch):
    monkeypatch.setenv("ASC_KEY_ID", "K")
    monkeypatch.setenv("ASC_ISSUER_ID", "I")
    monkeypatch.setenv("ASC_API_KEY_P8", P8_STAND_IN)
    monkeypatch.setenv("ASC_BUNDLE_ID", "inc.corpora.dynawalla")
    monkeypatch.delenv("GITHUB_STEP_SUMMARY", raising=False)
    monkeypatch.setattr(mt.Bearer, "value", lambda self: "tok")


def run(monkeypatch, api, *argv):
    monkeypatch.setattr(mt, "request_json", api)
    mt.main(["--email", EMAIL, *argv])
    return api


def as_tester(email):
    return {"id": "tester-1", "attributes": {"email": email}}


# ------------------------------------------------- already a tester: SUCCESS


def test_already_a_tester_is_success_and_sends_nothing(env, monkeypatch, capsys):
    api = run(monkeypatch, FakeApi(members=[as_tester(EMAIL)]))
    assert api.writes == []
    assert "already a tester" in capsys.readouterr().out


def test_membership_match_is_case_insensitive(env, monkeypatch, capsys):
    """App Store Connect echoes back whatever case was typed. A case-sensitive
    comparison would re-add — or worse, re-invite — an existing tester."""
    api = run(monkeypatch, FakeApi(members=[as_tester("Skylar.Saveland+Apple@Gmail.com")]))
    assert api.writes == []
    assert "already a tester" in capsys.readouterr().out


def test_a_plus_tag_is_a_different_account(env, monkeypatch):
    """Gmail delivers both to one inbox; App Store Connect treats them as two
    accounts. Folding the tag would report success about the wrong one."""
    assert not mt.same_email("skylar.saveland@gmail.com", EMAIL)
    api = run(monkeypatch, FakeApi(members=[as_tester("skylar.saveland@gmail.com")],
                                   users=[{"id": "u1", "attributes": {"username": EMAIL}}]))
    assert api.posted("/v1/betaTesters")  # not treated as already present


# --------------------------------------------------- is an ASC user: ADD them


def test_an_asc_user_is_added_to_the_internal_group(env, monkeypatch, capsys):
    api = run(monkeypatch, FakeApi(users=[{"id": "u1", "attributes": {"username": EMAIL,
                                                                     "roles": ["DEVELOPER"]}}]))
    (body,) = api.posted("/v1/betaTesters")
    assert body["data"]["attributes"]["email"] == EMAIL
    assert body["data"]["relationships"]["betaGroups"]["data"] == [
        {"type": "betaGroups", "id": "grp-int"}
    ]
    assert api.posted("/v1/userInvitations") == []
    assert "Added" in capsys.readouterr().out


def test_an_existing_tester_record_is_linked_not_recreated(env, monkeypatch):
    """POST /v1/betaTesters on an email that already has a record is a 409. If
    the address tests another app, the linkage route is the only one that
    works."""
    api = run(
        monkeypatch,
        FakeApi(users=[{"id": "u1", "attributes": {"username": EMAIL}}],
                testers=[as_tester(EMAIL)]),
    )
    assert api.posted("/v1/betaTesters") == []
    (body,) = api.posted("/v1/betaGroups/grp-int/relationships/betaTesters")
    assert body == {"data": [{"type": "betaTesters", "id": "tester-1"}]}


def test_apples_refusal_to_add_explains_internal_eligibility(env, monkeypatch, capsys):
    """Apple documents no error for 'not a team member into an internal group'.
    Whatever 4xx arrives must not surface as a raw API error."""
    api = FakeApi(users=[{"id": "u1", "attributes": {"username": EMAIL}}])
    api.responses[("POST", "/v1/betaTesters")] = mt.ApiError(
        "POST", "u", 409, json.dumps({"errors": [{"code": "STATE_ERROR", "detail": "nope"}]})
    )
    monkeypatch.setattr(mt, "request_json", api)
    with pytest.raises(SystemExit):
        mt.main(["--email", EMAIL])
    out = capsys.readouterr().out
    assert "INTERNAL" in out and "STATE_ERROR" in out


# ------------------------------------------- NOT an ASC user: refuse, or invite


def test_not_an_asc_user_without_invite_refuses_and_changes_nothing(env, monkeypatch, capsys):
    api = FakeApi()
    monkeypatch.setattr(mt, "request_json", api)
    with pytest.raises(SystemExit) as exc:
        mt.main(["--email", EMAIL])
    assert exc.value.code == 1
    out = capsys.readouterr().out
    assert api.writes == [], "nothing may be sent on the refusal path"
    assert "not a user on the App Store Connect team" in out
    assert "invite=true" in out  # names the opt-in
    assert "Nothing was changed" in out


def test_invite_sends_a_scoped_team_invitation_and_stops(env, monkeypatch, capsys):
    api = run(monkeypatch, FakeApi(), "--invite")
    (body,) = api.posted("/v1/userInvitations")
    attributes = body["data"]["attributes"]
    assert attributes["email"] == EMAIL
    assert attributes["roles"] == ["DEVELOPER"]
    assert attributes["allAppsVisible"] is False
    assert attributes["provisioningAllowed"] is False
    assert body["data"]["relationships"]["visibleApps"]["data"] == [
        {"type": "apps", "id": "app1"}
    ]
    # A pending invitation is not an account: the tester must NOT be added.
    assert api.posted("/v1/betaTesters") == []
    out = capsys.readouterr().out
    assert "ACTION REQUIRED" in out and "Re-run this workflow" in out


def test_invite_role_is_constrained_to_apples_internal_tester_roles():
    """Apple accepts only Account Holder / Admin / App Manager / Developer /
    Marketing as internal testers. Inviting as SALES would produce a team member
    who still cannot test."""
    with pytest.raises(SystemExit):
        mt.parse_args(["--email", EMAIL, "--role", "SALES"])
    assert "ACCOUNT_HOLDER" not in mt.INTERNAL_TESTER_ROLES


def test_a_pending_invitation_is_not_sent_twice(env, monkeypatch, capsys):
    api = run(
        monkeypatch,
        FakeApi(invitations=[{"id": "i1", "attributes": {"email": EMAIL,
                                                         "expirationDate": "2026-08-03"}}]),
        "--invite",
    )
    assert api.writes == []
    assert "already pending" in capsys.readouterr().out


def test_a_pending_invitation_is_reported_even_without_invite(env, monkeypatch, capsys):
    api = run(
        monkeypatch,
        FakeApi(invitations=[{"id": "i1", "attributes": {"email": EMAIL}}]),
    )
    assert api.writes == []
    assert "pending" in capsys.readouterr().out


def test_an_app_manager_key_still_gets_the_not_a_team_member_report(env, monkeypatch, capsys):
    """Listing user invitations needs Admin; everything before it needs only App
    Manager. A 403 on that ONE read must not replace the actionable report with
    a permissions error about a call the answer did not depend on."""
    api = FakeApi()
    api.responses[("GET", "/v1/userInvitations")] = mt.ApiError("GET", "u", 403, "{}")
    monkeypatch.setattr(mt, "request_json", api)
    with pytest.raises(SystemExit):
        mt.main(["--email", EMAIL])
    out = capsys.readouterr().out
    assert "cannot list pending user invitations" in out
    assert "not on the App Store Connect team" in out
    assert api.writes == []


def test_an_unreadable_roster_is_not_read_as_not_a_member(env, monkeypatch, capsys):
    """`GET /v1/users` needs Admin. If the key cannot see the roster, "absent
    from the roster" is not a fact — and it is the branch that offers to
    invite. Refuse instead, with the role named."""
    api = FakeApi()
    api.responses[("GET", "/v1/users")] = mt.ApiError("GET", "u", 403, "{}")
    monkeypatch.setattr(mt, "request_json", api)
    with pytest.raises(SystemExit):
        mt.main(["--email", EMAIL, "--invite"])
    out = capsys.readouterr().out
    assert "ADMIN role" in out and "Nothing was changed" in out
    assert api.writes == [], "an unreadable roster must not trigger an invitation"


def test_only_tolerated_codes_are_tolerated(env, monkeypatch, capsys):
    def boom(method, url, bearer, body=None):
        raise mt.ApiError(method, url, 403, "{}")

    monkeypatch.setattr(mt, "request_json", boom)
    assert mt.try_get_all("userInvitations", {}, None, (403,)) is None
    with pytest.raises(SystemExit):  # the same 403 through the strict reader
        mt.get_all("users", {}, None)
    with pytest.raises(SystemExit):  # a code that is not on the list
        mt.try_get_all("userInvitations", {}, None, (404,))


def test_a_refused_app_scoped_invitation_retries_wide_and_says_so(env, monkeypatch, capsys):
    """Apple does not document whether every role tolerates
    allAppsVisible=false + visibleApps. The fallback is a WIDER grant, so it
    must be announced, not silent."""
    api = FakeApi()
    api.responses[("POST", "/v1/userInvitations")] = mt.ApiError("POST", "u", 409, "{}")
    monkeypatch.setattr(mt, "request_json", api)
    mt.main(["--email", EMAIL, "--invite"])
    (body,) = api.posted("/v1/userInvitations")
    assert body["data"]["attributes"]["allAppsVisible"] is True
    assert "relationships" not in body["data"]
    assert "::warning::" in capsys.readouterr().out


# -------------------------------------------------------------- group choice


def test_no_internal_group_is_created_as_internal(env, monkeypatch):
    api = run(
        monkeypatch,
        FakeApi(groups=[EXTERNAL], users=[{"id": "u1", "attributes": {"username": EMAIL}}]),
    )
    (body,) = api.posted("/v1/betaGroups")
    assert body["data"]["attributes"]["isInternalGroup"] is True
    assert body["data"]["relationships"]["app"]["data"]["id"] == "app1"
    # ...and the tester lands in the NEW group, not the external one.
    (tester_body,) = api.posted("/v1/betaTesters")
    assert tester_body["data"]["relationships"]["betaGroups"]["data"][0]["id"] == "grp-new"


def test_an_external_group_is_never_mistaken_for_internal():
    assert mt.internal_groups([EXTERNAL], None) == []
    # A payload that simply omits the flag is not internal either.
    assert mt.internal_groups([{"id": "x", "attributes": {"name": "n"}}], None) == []
    assert mt.internal_groups([INTERNAL, EXTERNAL], None) == [INTERNAL]
    assert mt.internal_groups([INTERNAL], "Other") == []


def test_two_internal_groups_refuse_to_guess(env, monkeypatch, capsys):
    other = {"id": "g2", "attributes": {"name": "Second", "isInternalGroup": True}}
    api = FakeApi(groups=[INTERNAL, other])
    monkeypatch.setattr(mt, "request_json", api)
    with pytest.raises(SystemExit):
        mt.main(["--email", EMAIL])
    assert "--group-name" in capsys.readouterr().out
    assert api.writes == []


def test_group_name_selects_among_several(env, monkeypatch):
    other = {"id": "g2", "attributes": {"name": "Second", "isInternalGroup": True}}
    api = run(
        monkeypatch,
        FakeApi(groups=[INTERNAL, other], users=[{"id": "u1", "attributes": {"username": EMAIL}}]),
        "--group-name",
        "Second",
    )
    (body,) = api.posted("/v1/betaTesters")
    assert body["data"]["relationships"]["betaGroups"]["data"][0]["id"] == "g2"


# ------------------------------------------------------------------ dry run


@pytest.mark.parametrize(
    "state,extra",
    [
        ({"users": [{"id": "u1", "attributes": {"username": EMAIL}}]}, []),
        ({}, ["--invite"]),
        ({"groups": []}, ["--invite"]),
    ],
)
def test_dry_run_sends_no_post(env, monkeypatch, capsys, state, extra):
    api = run(monkeypatch, FakeApi(**state), "--dry-run", *extra)
    assert api.writes == []
    assert "WOULD" in capsys.readouterr().out


# -------------------------------------------------------------- app + pages


def test_no_app_record_is_a_founder_action(env, monkeypatch, capsys):
    api = FakeApi()
    api._get = lambda path: []  # type: ignore[method-assign]
    monkeypatch.setattr(mt, "request_json", api)
    with pytest.raises(SystemExit):
        mt.main(["--email", EMAIL])
    assert "founder action" in capsys.readouterr().out


def test_pagination_follows_links_next(env, monkeypatch):
    pages = [
        {"data": [{"id": "u0", "attributes": {"username": "someone@else.com"}}],
         "links": {"next": f"{mt.API}/users?cursor=2"}},
        {"data": [{"id": "u1", "attributes": {"username": EMAIL}}]},
    ]
    calls = []

    def api(method, url, bearer, body=None):
        if method == "GET" and url.startswith(f"{mt.API}/users"):
            calls.append(url)
            return pages[len(calls) - 1]
        return FakeApi()(method, url, bearer, body)

    monkeypatch.setattr(mt, "request_json", api)
    assert mt.find_asc_user(EMAIL, None)["id"] == "u1"
    assert len(calls) == 2 and "cursor=2" in calls[1]


def test_an_endless_page_chain_is_a_failure_not_an_absence(env, monkeypatch, capsys):
    """"Absent from a truncated list" is the branch that sends an invitation.
    It must never be reached by giving up on pagination."""
    monkeypatch.setattr(
        mt,
        "request_json",
        lambda *a, **k: {"data": [], "links": {"next": f"{mt.API}/users?cursor=x"}},
    )
    with pytest.raises(SystemExit):
        mt.find_asc_user(EMAIL, None)
    assert "truncated list" in capsys.readouterr().out


def test_client_side_matching_survives_an_ignored_filter(env, monkeypatch):
    """If Apple ever ignored filter[username], a trusting implementation would
    report the first user on the team as the match."""
    monkeypatch.setattr(
        mt,
        "request_json",
        lambda *a, **k: {"data": [{"id": "u9", "attributes": {"username": "someone@else.com"}}]},
    )
    assert mt.find_asc_user(EMAIL, None) is None


# --------------------------------------------------------- secrets + plumbing


def test_the_private_key_never_reaches_stdout(env, monkeypatch, capsys):
    """This repository is public and these logs are public."""
    api = FakeApi(users=[{"id": "u1", "attributes": {"username": EMAIL}}])
    monkeypatch.setattr(mt, "request_json", api)
    mt.main(["--email", EMAIL])
    captured = capsys.readouterr()
    for stream in (captured.out, captured.err):
        assert P8_STAND_IN not in stream
        assert "stand-in" not in stream
        assert "tok" not in stream.replace("workflow", "")  # the bearer token


def test_a_missing_secret_is_named(monkeypatch, capsys):
    monkeypatch.delenv("ASC_KEY_ID", raising=False)
    monkeypatch.setenv("ASC_ISSUER_ID", "I")
    monkeypatch.setenv("ASC_API_KEY_P8", "P")
    with pytest.raises(SystemExit):
        mt.main(["--email", EMAIL])
    assert "ASC_KEY_ID is not set" in capsys.readouterr().out


def test_a_malformed_email_is_rejected_before_any_call(env, monkeypatch, capsys):
    api = FakeApi()
    monkeypatch.setattr(mt, "request_json", api)
    with pytest.raises(SystemExit):
        mt.main(["--email", "not-an-email"])
    assert api.writes == []
    assert "does not look like an email" in capsys.readouterr().out


def test_derive_names():
    assert mt.derive_names(EMAIL, None, None) == ("Skylar", "Saveland")
    assert mt.derive_names("qa@corpora.inc", None, None) == ("Qa", "TestFlight")
    assert mt.derive_names(EMAIL, "Given", "Chosen") == ("Given", "Chosen")


def test_step_summary_is_appended_when_actions_provides_one(env, monkeypatch, tmp_path):
    summary = tmp_path / "summary.md"
    monkeypatch.setenv("GITHUB_STEP_SUMMARY", str(summary))
    run(monkeypatch, FakeApi(members=[as_tester(EMAIL)]))
    assert "already an internal tester" in summary.read_text()


# ------------------------------------------------------------- HTTP branches


def _http_error(code, body=b"{}"):
    return urllib.error.HTTPError("https://example.invalid", code, "boom", {}, io.BytesIO(body))


def test_request_json_raises_a_structured_api_error(env, monkeypatch):
    monkeypatch.setattr(
        urllib.request,
        "urlopen",
        lambda *a, **k: (_ for _ in ()).throw(
            _http_error(409, b'{"errors":[{"code":"ENTITY_ERROR"}]}')
        ),
    )
    with pytest.raises(mt.ApiError) as exc:
        mt.request_json("POST", f"{mt.API}/betaTesters", mt.Bearer("K", "I", "P"), {"a": 1})
    assert exc.value.code == 409
    assert exc.value.codes == ["ENTITY_ERROR"]


def test_a_204_with_an_empty_body_is_not_a_json_error(env, monkeypatch):
    class Empty:
        def read(self):
            return b""

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    monkeypatch.setattr(urllib.request, "urlopen", lambda *a, **k: Empty())
    assert mt.request_json("POST", f"{mt.API}/x", mt.Bearer("K", "I", "P"), {}) == {}


def test_explain_names_the_missing_role_on_403():
    assert "App Manager or Admin" in mt.explain(mt.ApiError("GET", "u", 403, "{}"))
    assert "not valid for this team" in mt.explain(mt.ApiError("GET", "u", 401, "{}"))
    assert "404" in mt.explain(mt.ApiError("GET", "u", 404, "{}"))
