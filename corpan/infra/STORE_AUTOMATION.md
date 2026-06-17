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

AWS auth for the tools: an AWS identity that can read that secret (region **us-east-2**).
Locally, source the repo-root `.env` (it provides the access key) or use the
`corpan-prod` SSO profile.

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
