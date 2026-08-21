#!/usr/bin/env python3
"""Add a TestFlight beta tester to Dynawalla's INTERNAL group, by API.

The standing rule is that App Store Connect and Play are driven by API, not by
clicking. The App Store Connect credentials exist only as GitHub Actions
secrets, so this script's home is `.github/workflows/testflight-testers.yml`
and its first real execution is a `workflow_dispatch` — it cannot be rehearsed
against the live API from a developer machine. Everything that does not need
the network is unit-tested in `test_manage_testflight_testers.py`; everything
that does is written to fail LOUDLY and specifically rather than to guess.

THE THING THAT BITES. An *internal* TestFlight tester must already be a user on
the App Store Connect team — Apple documents `isInternalGroup` as "Only
existing users of App Store Connect may be added for internal beta testing."
External testers are email-only but need Beta App Review of each build. So an
email that is not on the team cannot simply be added, and Apple's refusal is a
generic 409/422 that reads like a bug. This script therefore checks
`GET /v1/users` FIRST and says exactly which situation it is in:

  * already in the internal group  -> success, nothing sent (idempotent)
  * an App Store Connect user      -> added to the internal group
  * not a user, no --invite        -> FAILS, naming precisely what is required
  * not a user, with --invite      -> sends a team invitation, then stops:
                                      the invitation must be ACCEPTED before
                                      the account exists and can be a tester

--invite is opt-in on purpose. Inviting someone to the App Store Connect team
is a real permission grant on the Corpora Inc. developer account and must never
be a side effect of "add a tester". The invitation is scoped to this one app
(`allAppsVisible: false` + `visibleApps: [dynawalla]`) and to the least
privileged role that Apple's TestFlight documentation accepts as an internal
tester.

Usage:
  manage_testflight_testers.py --email a@b.com [--invite] [--dry-run]
                               [--role DEVELOPER] [--group-name NAME]
                               [--first-name F --last-name L]

Environment:
  ASC_KEY_ID     App Store Connect API key id
  ASC_ISSUER_ID  App Store Connect issuer id
  ASC_API_KEY_P8 the .p8 private key (the PEM text itself)
  ASC_BUNDLE_ID  optional, defaults to inc.corpora.dynawalla

None of those values is ever printed. Only their presence/absence is. This
repository is public.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

# The ES256/JWT auth for App Store Connect already exists in this directory and
# is already covered by tests, including the re-mint-before-Apple's-ceiling
# behaviour. Import it rather than writing a second way to authenticate.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from verify_testflight_upload import API, Bearer, fail, require  # noqa: E402

DEFAULT_BUNDLE_ID = "inc.corpora.dynawalla"
DEFAULT_GROUP_NAME = "Internal Testers"

# Apple's ceiling for `limit` on every endpoint used here.
PAGE_LIMIT = "200"
# A paginated read that never terminates would be answered as "not found", and
# "not found" is the branch that sends an invitation. Refuse instead.
MAX_PAGES = 25

# https://developer.apple.com/testflight/ — "Designate up to 100 members of
# your development team who hold the Account Holder, Admin, App Manager,
# Developer, or Marketing role as beta testers." ACCOUNT_HOLDER is deliberately
# absent: it is the account owner and is not something to invite anyone into.
INTERNAL_TESTER_ROLES = ("DEVELOPER", "APP_MANAGER", "MARKETING", "ADMIN")


class ApiError(Exception):
    """A non-2xx from App Store Connect, kept structured so callers can branch.

    Apple does not document the error it returns when a non-team email is
    pushed at an internal group, so no caller may branch on `detail` text — the
    status code and the `errors[].code` prefix are all that is load-bearing.
    """

    def __init__(self, method: str, url: str, code: int, body: str) -> None:
        super().__init__(f"{method} {url} -> HTTP {code}")
        self.method = method
        self.url = url
        self.code = code
        self.body = body

    @property
    def codes(self) -> list[str]:
        try:
            parsed = json.loads(self.body)
        except (ValueError, TypeError):
            return []
        return [str(e.get("code", "")) for e in (parsed.get("errors") or [])]


# ---- pure helpers (unit-tested) --------------------------------------------


def same_email(left: str | None, right: str | None) -> bool:
    """Email comparison for identity, not for delivery.

    Case-insensitive because App Store Connect echoes back whatever case was
    typed, and a case difference here would re-invite a user who already
    exists. Nothing else is normalised: `a+b@x.com` and `a@x.com` are DIFFERENT
    App Store Connect accounts even though Gmail delivers both to one inbox,
    and folding the `+tag` would make this script report success about the
    wrong account.
    """
    if not left or not right:
        return False
    return left.strip().lower() == right.strip().lower()


def derive_names(email: str, first: str | None, last: str | None) -> tuple[str, str]:
    """First/last name for the tester or invitation record.

    `POST /v1/userInvitations` REQUIRES both, so they cannot be left empty.
    Explicit flags always win; otherwise guess from the local part
    (`skylar.saveland+apple@gmail.com` -> `Skylar Saveland`), which is a label
    on a TestFlight row and not an identity claim. Anything unguessable falls
    back to the local part and `TestFlight`, never to an empty string — Apple
    rejects those with a 400 that reads like a malformed request.
    """
    local = email.split("@", 1)[0].split("+", 1)[0]
    parts = [p for p in local.replace("_", ".").replace("-", ".").split(".") if p]
    guess_first = parts[0].capitalize() if parts else "TestFlight"
    guess_last = parts[-1].capitalize() if len(parts) > 1 else "TestFlight"
    return (first or guess_first).strip(), (last or guess_last).strip()


def internal_groups(groups: list[dict], name: str | None) -> list[dict]:
    """The internal beta groups, optionally narrowed to one by name.

    `isInternalGroup` is compared with `is True`, not truthily: a payload where
    the field is absent (a `fields[betaGroups]` change, a future API version)
    must not be read as internal. Adding an email to a group that is really
    EXTERNAL is the one silent wrong outcome available here — it would appear
    to succeed and then sit behind Beta App Review forever.
    """
    found = [g for g in groups if ((g.get("attributes") or {}).get("isInternalGroup")) is True]
    if name:
        found = [g for g in found if ((g.get("attributes") or {}).get("name")) == name]
    return found


def group_label(group: dict) -> str:
    attributes = group.get("attributes") or {}
    return f"{attributes.get('name')!r} (id {group.get('id')})"


def explain(exc: ApiError) -> str:
    """The standard, actionable rendering of an App Store Connect failure."""
    detail = exc.body[:600]
    if exc.code == 401:
        return "App Store Connect returned 401 — the API key is not valid for this team."
    if exc.code == 403:
        return (
            f"{exc.method} {exc.url} -> 403. The App Store Connect key lacks the role this "
            f"call needs. Managing testers needs App Manager or Admin; sending a user "
            f"invitation needs Admin. Response: {detail}"
        )
    if exc.code == 404:
        return f"{exc.method} {exc.url} -> 404. That resource does not exist. Response: {detail}"
    return f"{exc.method} {exc.url} -> HTTP {exc.code}: {detail}"


# ---- network ---------------------------------------------------------------


def request_json(method: str, url: str, bearer: Bearer, body: dict | None = None) -> dict:
    """One App Store Connect call. Raises ApiError on any non-2xx.

    The bearer token is only ever placed in the Authorization header and is
    never logged, never echoed into a message, and never written to an output.
    """
    data = json.dumps(body).encode("utf-8") if body is not None else None
    request = urllib.request.Request(url, data=data, method=method)
    request.add_header("Authorization", f"Bearer {bearer.value()}")
    if data is not None:
        request.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            raw = response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        raise ApiError(method, url, exc.code, exc.read().decode("utf-8", "replace")) from None
    except urllib.error.URLError as exc:
        fail(f"{method} {url} failed: {exc}")
    # A linkage POST answers 204 with an empty body; json.loads("") would raise.
    return json.loads(raw) if raw.strip() else {}


def _pages(path: str, params: dict[str, str], bearer: Bearer) -> list[dict]:
    """Every page of a collection, following `links.next` verbatim.

    Client-side matching is applied by every caller on top of whatever
    `filter[...]` is passed. That is deliberate: a filter Apple silently
    ignored would otherwise turn "is this email on the team?" into "is ANY
    email on the team?" and answer yes. With client-side matching, an ignored
    filter costs a few extra pages and still gives the right answer.
    """
    url = f"{API}/{path}?{urllib.parse.urlencode(params)}"
    items: list[dict] = []
    seen = 0
    while url:
        payload = request_json("GET", url, bearer)
        items.extend(payload.get("data") or [])
        seen += 1
        if seen >= MAX_PAGES:
            # Never degrade to a partial answer: "absent from a truncated list"
            # is exactly how this script would decide to send an invitation
            # that is not needed.
            fail(
                f"GET {path} still had more pages after {MAX_PAGES} × {PAGE_LIMIT} results. "
                "Refusing to answer from a truncated list."
            )
        url = ((payload.get("links") or {}).get("next")) or ""
    return items


def get_all(path: str, params: dict[str, str], bearer: Bearer) -> list[dict]:
    """`_pages`, aborting on any API error."""
    try:
        return _pages(path, params, bearer)
    except ApiError as exc:
        fail(explain(exc))


def try_get_all(
    path: str, params: dict[str, str], bearer: Bearer, tolerate: tuple[int, ...]
) -> list[dict] | None:
    """`_pages`, but None — "could not read" — for the listed status codes.

    None is NOT an empty list and callers must not collapse the two.
    """
    try:
        return _pages(path, params, bearer)
    except ApiError as exc:
        if exc.code in tolerate:
            return None
        fail(explain(exc))


# ---- reads -----------------------------------------------------------------


def resolve_app(bundle_id: str, bearer: Bearer) -> str:
    apps = get_all("apps", {"filter[bundleId]": bundle_id, "limit": PAGE_LIMIT}, bearer)
    matches = [a for a in apps if (a.get("attributes") or {}).get("bundleId") == bundle_id]
    if not matches:
        fail(
            f"No App Store Connect app record for bundle id {bundle_id}. There is no "
            "app-create operation in the API — the record is created on the App Store "
            "Connect website (dynawalla/docs/STORE.md). This is a founder action."
        )
    app_id = str(matches[0]["id"])
    print(f"App Store Connect app {app_id} for {bundle_id}.")
    return app_id


def find_internal_group(app_id: str, bearer: Bearer, name: str | None) -> dict | None:
    groups = get_all(f"apps/{app_id}/betaGroups", {"limit": PAGE_LIMIT}, bearer)
    for group in groups:
        attributes = group.get("attributes") or {}
        kind = "internal" if attributes.get("isInternalGroup") is True else "external"
        print(f"  beta group {group.get('id')}: {attributes.get('name')!r} [{kind}]")
    candidates = internal_groups(groups, name)
    if len(candidates) > 1:
        fail(
            "This app has more than one internal beta group "
            f"({', '.join(group_label(g) for g in candidates)}). Re-run with "
            "--group-name to say which one, rather than picking for you."
        )
    return candidates[0] if candidates else None


def group_has_tester(group_id: str, email: str, bearer: Bearer) -> bool:
    """Membership read via the group's own sub-resource.

    `GET /v1/betaGroups/{id}/betaTesters` accepts NO filters at all, so nothing
    can be silently ignored — unlike `GET /v1/betaTesters?filter[betaGroups]=`,
    where an ignored filter would report a tester of some other group as a
    member of this one and skip the add. An internal group holds at most 100
    testers, so this is one page.
    """
    testers = get_all(f"betaGroups/{group_id}/betaTesters", {"limit": PAGE_LIMIT}, bearer)
    return any(same_email((t.get("attributes") or {}).get("email"), email) for t in testers)


def find_beta_tester(email: str, bearer: Bearer) -> dict | None:
    testers = get_all(
        "betaTesters", {"filter[email]": email, "limit": PAGE_LIMIT}, bearer
    )
    for tester in testers:
        if same_email((tester.get("attributes") or {}).get("email"), email):
            return tester
    return None


def find_asc_user(email: str, bearer: Bearer) -> dict | None:
    """The App Store Connect team member for this email, if there is one.

    `User` has no `email` attribute; `username` IS the Apple Account address.

    A 403 here is its own diagnosis, not a generic permissions error: reading
    the team roster needs the ADMIN role, while everything else this script
    does needs only App Manager. It is a plausible shape for the CI key to
    have, and "the key cannot see the roster" must not be answered as "the
    address is not on the team" — that is the branch that offers to invite.
    """
    users = try_get_all("users", {"filter[username]": email, "limit": PAGE_LIMIT}, bearer, (403,))
    if users is None:
        fail(
            "This App Store Connect API key cannot list team users (403). That read "
            "needs the ADMIN role — an App Manager key can manage testers but cannot "
            "see who is on the team, and an internal tester that cannot be confirmed "
            "to be a team member will not be added on a guess. Re-issue the key with "
            "the Admin role (App Store Connect > Users and Access > Integrations) and "
            "re-run. Nothing was changed."
        )
    for user in users:
        if same_email((user.get("attributes") or {}).get("username"), email):
            return user
    return None


def find_pending_invitation(email: str, bearer: Bearer) -> dict | None:
    """A team invitation already sent and not yet accepted.

    Listed WITHOUT a filter parameter on purpose: the pending-invitation list
    is tiny, and a filter Apple rejected with a 400 would abort the one read
    that keeps --invite from sending a duplicate.

    A 403 is tolerated. Reading user invitations needs the Admin role, but
    everything up to here needs only App Manager — so an App-Manager key must
    still be able to reach the "this address is not on the team, here is what
    to do" report instead of dying on a permission it does not need for that
    answer. An actual invitation would 403 too, loudly, one call later.
    """
    invitations = try_get_all("userInvitations", {"limit": PAGE_LIMIT}, bearer, (403,))
    if invitations is None:
        print(
            "::warning::this API key cannot list pending user invitations (403 — that "
            "read needs the Admin role). Continuing without knowing whether one is "
            "already pending."
        )
        return None
    for invitation in invitations:
        if same_email((invitation.get("attributes") or {}).get("email"), email):
            return invitation
    return None


# ---- writes ----------------------------------------------------------------


def create_internal_group(app_id: str, name: str, bearer: Bearer) -> dict:
    """`isInternalGroup` is settable at creation, so this needs no clicking."""
    print(f"::notice::creating internal beta group {name!r} for app {app_id}")
    body = {
        "data": {
            "type": "betaGroups",
            "attributes": {
                "name": name,
                "isInternalGroup": True,
                # Internal testers should receive every build automatically;
                # without this each build has to be assigned to the group by
                # hand, which is the clicking this script exists to avoid.
                "hasAccessToAllBuilds": True,
            },
            "relationships": {"app": {"data": {"type": "apps", "id": app_id}}},
        }
    }
    try:
        created = request_json("POST", f"{API}/betaGroups", bearer, body)
    except ApiError as exc:
        fail(
            f"Could not create an internal beta group: {explain(exc)} "
            "Apple's BetaGroupCreateRequest accepts name + isInternalGroup + an app "
            "relationship; if it refused them, create the group in App Store Connect "
            "under TestFlight > Internal Testing and re-run with --group-name."
        )
    group = created.get("data") or {}
    if not group.get("id"):
        fail(f"App Store Connect returned no id for the new beta group: {created}")
    print(f"Created internal beta group {group_label(group)}.")
    return group


def add_tester(group: dict, email: str, first: str, last: str, bearer: Bearer) -> None:
    """Put an existing App Store Connect user into the internal group.

    Two routes, and which one applies depends on whether a BetaTester record
    for this email already exists anywhere on the account:

      * none exists -> POST /v1/betaTesters creates it AND links the group (201)
      * one exists  -> POST /v1/betaGroups/{id}/relationships/betaTesters (204)

    Creating a tester whose email already has a record is a 409, so the lookup
    is not an optimisation.
    """
    group_id = str(group["id"])
    existing = find_beta_tester(email, bearer)
    if existing:
        tester_id = str(existing["id"])
        print(f"Beta tester record {tester_id} already exists; linking it to the group.")
        url = f"{API}/betaGroups/{group_id}/relationships/betaTesters"
        body: dict[str, Any] = {"data": [{"type": "betaTesters", "id": tester_id}]}
    else:
        url = f"{API}/betaTesters"
        body = {
            "data": {
                "type": "betaTesters",
                "attributes": {"email": email, "firstName": first, "lastName": last},
                "relationships": {
                    "betaGroups": {"data": [{"type": "betaGroups", "id": group_id}]}
                },
            }
        }
    try:
        request_json("POST", url, bearer, body)
    except ApiError as exc:
        if exc.code in (400, 409, 422):
            fail(
                f"App Store Connect refused to add {email} to internal group "
                f"{group_label(group)} (HTTP {exc.code}, codes {exc.codes or ['?']}). "
                "The usual cause is that the account is not eligible as an INTERNAL "
                "tester: only App Store Connect users holding Account Holder, Admin, "
                "App Manager, Developer or Marketing may be. Full response: "
                f"{exc.body[:600]}"
            )
        fail(explain(exc))
    print(f"Added {email} to internal beta group {group_label(group)}.")


def send_invitation(
    app_id: str, email: str, first: str, last: str, role: str, bearer: Bearer
) -> None:
    """Invite the address onto the App Store Connect team. A real grant.

    Scoped as tightly as the API allows: one role, and `allAppsVisible: false`
    with `visibleApps` pinned to this app. Apple documents neither the
    per-role constraints on `allAppsVisible` nor whether every role tolerates a
    `visibleApps` list, so a refusal of the scoped form retries ONCE with the
    account-wide form — and says so, loudly, because that is a wider grant than
    the one that was attempted first.
    """
    scoped = {
        "data": {
            "type": "userInvitations",
            "attributes": {
                "email": email,
                "firstName": first,
                "lastName": last,
                "roles": [role],
                "allAppsVisible": False,
                "provisioningAllowed": False,
            },
            "relationships": {"visibleApps": {"data": [{"type": "apps", "id": app_id}]}},
        }
    }
    print(f"::notice::sending an App Store Connect team invitation to {email} as {role}")
    try:
        request_json("POST", f"{API}/userInvitations", bearer, scoped)
    except ApiError as exc:
        if exc.code not in (400, 409, 422):
            fail(explain(exc))
        print(
            f"::warning::App Store Connect refused the app-scoped invitation "
            f"(HTTP {exc.code}, codes {exc.codes or ['?']}). Retrying ONCE with "
            "allAppsVisible=true, which is a WIDER grant: the invitee will see every "
            "app on the Corpora Inc. account, not just Dynawalla."
        )
        wide = json.loads(json.dumps(scoped))
        wide["data"]["attributes"]["allAppsVisible"] = True
        wide["data"].pop("relationships")
        try:
            request_json("POST", f"{API}/userInvitations", bearer, wide)
        except ApiError as retry:
            fail(
                f"Could not invite {email} to the App Store Connect team: {explain(retry)}"
            )


# ---- reporting -------------------------------------------------------------


def summarise(lines: list[str]) -> None:
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if not path:
        return
    with open(path, "a", encoding="utf-8") as handle:
        handle.write("\n".join(lines) + "\n")


# ---- entry point -----------------------------------------------------------


def parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Manage TestFlight internal testers.")
    parser.add_argument("--email", required=True, help="the tester's Apple Account email")
    parser.add_argument(
        "--invite",
        action="store_true",
        help=(
            "if the email is not already on the App Store Connect team, send it a team "
            "invitation. This GRANTS ACCESS to the Corpora Inc. developer account and is "
            "never done implicitly."
        ),
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="read everything, change nothing, and print what would be done",
    )
    parser.add_argument(
        "--role",
        default="DEVELOPER",
        choices=INTERNAL_TESTER_ROLES,
        help="role for --invite (default DEVELOPER; MARKETING is the least privileged "
        "role Apple accepts as an internal tester)",
    )
    parser.add_argument("--group-name", default=None, help="disambiguate the internal group")
    parser.add_argument("--first-name", default=None)
    parser.add_argument("--last-name", default=None)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    args = parse_args(argv)
    email = args.email.strip()
    if "@" not in email or email.startswith("@") or email.endswith("@"):
        fail(f"--email does not look like an email address: {email!r}")
    first, last = derive_names(email, args.first_name, args.last_name)
    bundle_id = os.environ.get("ASC_BUNDLE_ID", "").strip() or DEFAULT_BUNDLE_ID
    if args.dry_run:
        print("::notice::--dry-run: every write below is described, not sent.")

    bearer = Bearer(require("ASC_KEY_ID"), require("ASC_ISSUER_ID"), require("ASC_API_KEY_P8"))
    app_id = resolve_app(bundle_id, bearer)

    group = find_internal_group(app_id, bearer, args.group_name)
    if group is None:
        name = args.group_name or DEFAULT_GROUP_NAME
        if args.dry_run:
            print(f"WOULD create internal beta group {name!r} for app {app_id}.")
            summarise([f"- would create internal beta group `{name}`"])
            return
        group = create_internal_group(app_id, name, bearer)
    print(f"Internal beta group: {group_label(group)}.")

    # Idempotence first, and before the team-membership read: an address that
    # is already testing is a success no matter what the users endpoint says.
    if group_has_tester(str(group["id"]), email, bearer):
        print(f"{email} is already a tester in {group_label(group)}. Nothing to do.")
        summarise([f"- `{email}` was already an internal tester of `{bundle_id}`"])
        return

    user = find_asc_user(email, bearer)
    if user is not None:
        roles = (user.get("attributes") or {}).get("roles") or []
        print(f"{email} is App Store Connect user {user.get('id')} with roles {roles}.")
        if args.dry_run:
            print(f"WOULD add {email} to {group_label(group)}.")
            summarise([f"- would add `{email}` to internal group `{group_label(group)}`"])
            return
        add_tester(group, email, first, last, bearer)
        summarise([f"- added `{email}` to internal group `{group_label(group)}`"])
        return

    # Not on the team. This is THE case that fails obscurely if it is left to
    # Apple to reject, so it is decided here instead.
    print(f"{email} is NOT an App Store Connect user on this team.")
    pending = find_pending_invitation(email, bearer)
    if pending is not None:
        expires = (pending.get("attributes") or {}).get("expirationDate")
        print(
            f"A team invitation for {email} is already pending (expires {expires}). "
            "It must be ACCEPTED from that mailbox before the account exists and can "
            "be an internal tester. Re-run this workflow after accepting."
        )
        summarise(
            [
                f"- `{email}` has a **pending** App Store Connect invitation (expires {expires})",
                "- accept it from that mailbox, then re-run this workflow to add the tester",
            ]
        )
        return

    if not args.invite:
        # Printed, then failed with ONE line: `::error::` is an annotation and
        # only its first line renders as one. The detail belongs in the log.
        print(
            f"\n{email} is not a user on the App Store Connect team, so it cannot be an "
            "INTERNAL TestFlight tester — Apple allows only existing App Store Connect "
            "users in an internal group. Nothing was changed.\n"
            "\nTo proceed, ONE of:\n"
            "  (a) re-run this workflow with invite=true. That sends an App Store "
            f"Connect team invitation to {email}, scoped to {bundle_id}, with the "
            f"{args.role} role. It is a real permission grant on the Corpora Inc. "
            "developer account, which is why it is opt-in and not automatic.\n"
            "      The invitation must then be ACCEPTED from that mailbox; only once "
            "the account exists can this workflow add it as a tester.\n"
            "  (b) use an EXTERNAL beta group instead — email-only, no team membership, "
            "but every build then needs Beta App Review before testers can install it. "
            "This script does not do that.\n"
        )
        summarise(
            [
                f"- `{email}` is **not** an App Store Connect user — nothing was changed",
                "- re-run with `invite: true` to send a team invitation (a permission grant)",
            ]
        )
        fail(
            f"{email} is not on the App Store Connect team; re-run with invite=true to "
            "invite them. Nothing was changed."
        )

    if args.dry_run:
        print(f"WOULD invite {email} to the App Store Connect team as {args.role}.")
        summarise([f"- would invite `{email}` to the team as `{args.role}`"])
        return

    send_invitation(app_id, email, first, last, args.role, bearer)
    print(
        "\n"
        "================ ACTION REQUIRED ================\n"
        f"An App Store Connect team invitation was sent to {email} as {args.role}, "
        f"scoped to {bundle_id}.\n"
        "The tester was NOT added to TestFlight: a PENDING invitation is not an "
        "account, and only existing App Store Connect users may join an internal "
        "beta group.\n"
        f"1. Accept the invitation from {email}.\n"
        "2. Re-run this workflow (invite is not needed the second time).\n"
        "================================================="
    )
    summarise(
        [
            f"- **invited** `{email}` to the App Store Connect team as `{args.role}`",
            f"- scoped to `{bundle_id}` (`allAppsVisible: false`)",
            "- **NOT yet a TestFlight tester** — accept the invitation, then re-run this "
            "workflow",
        ]
    )


if __name__ == "__main__":
    main()
