# Store automation — control Google Play & App Store Connect programmatically

**Principle: drive the stores by API, not by clicking.** Both consoles are slow,
ancient UIs. Almost everything we need — subscriptions, free trials, offers, codes —
is in the platforms' REST APIs. Use the tools below; resort to the browser only for the
handful of things that genuinely have no API (noted as such).

> Security: this repo is **open source**. Credentials live in **AWS Secrets Manager**,
> never in the repo. Never commit a `.p8`, a service-account JSON, a Key ID, an Issuer
> ID, or any private key. The tools read creds from Secrets Manager (or local flags for
> dev). `*.p8` / `AuthKey_*` / `.venv/` are gitignored under `infra/asc/` and `infra/play/`.

## Where credentials live
One AWS Secrets Manager secret (the same one the purchase-verify lambda reads;
its path is defined in `terraform/main.tf`). It holds, as JSON keys:

| Key | Used for |
|---|---|
| `google.serviceAccountJson` | Google Play Developer API (subscriptions, base plans, offers) |
| `apple` (`key_id`/`issuer_id`/`privateKey`) | **App Store Server API** — receipt/transaction verification (the lambda) |
| `appStoreConnect` (`keyId`/`issuerId`/`p8`) | **App Store Connect API** — managing subscriptions, intro offers, offer codes |

Note the two distinct Apple keys: `apple` = App Store **Server** API (verify purchases);
`appStoreConnect` = App Store **Connect** API (manage products/offers). Different keys.

## Signing in to AWS locally

Use the existing **`corpan-prod` CLI profile**, backed by IAM Identity Center
(SSO), to read **`corpan/content-packs/verify`** in **`us-east-2`**. You do not
need to retrieve or copy long-lived AWS access keys for this workflow.

Three names are easy to confuse:

| Name | Meaning | Where to use it |
|---|---|---|
| `corpan-prod` | AWS CLI profile selecting the account, permission set and region | `--profile corpan-prod` or `AWS_PROFILE=corpan-prod` |
| `try` | SSO session name referenced by this machine's profile | `[sso-session try]` in `~/.aws/config`; **not** a username |
| Your SSO username | Your personal portal login | The browser's AWS access portal; **not** a CLI profile name |

The portal URL lives in the profile's SSO session in `~/.aws/config`. Keep the
owner-specific username and password-manager reminder outside this public repo,
at `~/.config/corpora/aws-access.md` (owner read/write only, mode `0600`). That
local note can name the saved browser/password-manager entry; it must not contain
the actual password. Check that note when you forget which login to use.

From the repo root:

```bash
aws sso login --profile corpan-prod
aws sts get-caller-identity --profile corpan-prod
export AWS_PROFILE=corpan-prod
export AWS_REGION=us-east-2
export AWS_DEFAULT_REGION=us-east-2
```

Complete the sign-in in the browser, using your existing saved portal login.
`get-caller-identity` is a read-only check: it reports the account and role, not
access keys or passwords. Verify that identity before running store tooling.
If the browser does not open, open the authorization URL printed by the CLI on
this same machine. A working browser-console login alone does not refresh an
expired CLI token; run the `aws sso login` command too.
[AWS documents this profile/session flow here](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso.html).

The Python store tools currently call `boto3.client("secretsmanager")` without
an explicit profile. They do **not** automatically choose `corpan-prod` merely
because that profile was logged in. Keep the exports above in the shell running
the tools, or prefix an individual command:

```bash
AWS_PROFILE=corpan-prod AWS_REGION=us-east-2 AWS_DEFAULT_REGION=us-east-2 \
  python corpan/infra/asc/asc_monetization.py list
```

`AWS_DEFAULT_REGION` also supplies Boto3's documented region environment setting;
setting both region variables keeps CLI and SDK invocations consistent.
[See Boto3 configuration](https://docs.aws.amazon.com/boto3/latest/guide/configuration.html).
If a shell has old `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, or
`AWS_SESSION_TOKEN` exports, remove those stale overrides from that shell before
using SSO; do not source an unrelated `.env` to repair SSO.

### Recognizing access failures

- **`TokenRetrievalError`, expired SSO token, or refresh failed:** rerun
  `aws sso login --profile corpan-prod`, complete browser sign-in, then repeat
  `get-caller-identity` and the failed command.
- **Profile not found:** inspect `aws configure list-profiles` and `~/.aws/config`.
  On a new machine, use `aws configure sso --profile corpan-prod` with the portal
  and authorized account/permission set from the owner. Do not invent account IDs
  or copy another person's cached tokens.
- **Wrong identity or no credentials in Python:** confirm `AWS_PROFILE` is exported
  in that process's shell and stale access-key environment overrides are absent.
- **`AccessDeniedException` reading the secret:** sign-in succeeded but the selected
  permission set cannot read the secret. Check account, role, secret name and
  region; refreshing the same session does not grant permissions.
- **Secret loads but Apple API rejects it:** use `appStoreConnect` for App Store
  Connect automation. The separate `apple` entry is for App Store Server purchase
  verification and is not interchangeable.

Do not print `SecretString`, private keys, tokens, or downloaded credential JSON
while diagnosing a failure. A safe metadata-only secret check is:

```bash
aws secretsmanager describe-secret --profile corpan-prod --region us-east-2 \
  --secret-id corpan/content-packs/verify --query Name --output text
```

This checks secret metadata access; the actual store command separately verifies
permission to read its value. Successful AWS access does not establish Apple or
Google app-specific permissions or create an app record.

## Tools

### Google Play — `infra/play/play_monetization.py`
`pip install google-api-python-client google-auth boto3` (a `.venv/` is gitignored there).
- `list` — read subscriptions / base plans (+ backward-compatible flag) / offers.
- `trial --product <id> --base-plan <id> --days 7 --activate --yes` — create + activate a
  free-trial **offer** (a base-plan offer; needs neither the Console nor backward-compat).
- `backcompat --product <id> --base-plan <id> --yes` — set `legacyCompatible` (the flag Play
  demands before it will let you create a **promo code**).

**API-able:** subscriptions, base plans, free-trial/discount **offers**, the
backward-compatible flag. **Browser-only (no Google API):** generating **promo codes**
("Promotions") — after `backcompat`, create them in *Play Console → Monetize with Play →
Promo codes*. **Gotcha:** the Play service account needs a Play Console role that can
*manage* monetization (read-only roles 403 on writes).

### App Store Connect — `infra/asc/asc_monetization.py`
`pip install pyjwt cryptography requests boto3`. ES256-JWT auth (Key ID + Issuer ID + .p8
from the `appStoreConnect` secret).
- `list` — read subscriptions / intro offers / offer codes (see what's already configured).
- `trial --product <id> --days 7 --yes` — create a free **Introductory Offer** (7 days =
  `ONE_WEEK`).
- `code-free` — one-time-use **Free** offer codes (CSV).
- `code-discount` — custom **discount** offer codes (per-affiliate string → attribution).

**API-able:** intro offers, offer codes (free + discount), promotional offers — Apple
exposes essentially everything via the App Store Connect API, so Apple should be
fully scriptable (no browser needed once creds are in place).

## Product reference
Subscriptions (same ids both platforms): `corpan.sub.monthly`, `corpan.sub.annual`.
Bundle / package: `com.corpora.corpan`.

## Adding a new credential to the secret
Read the secret JSON, merge in the new key, `put-secret-value`. The verify lambda's other
keys must be preserved (read-modify-write, never overwrite the whole secret blindly).
