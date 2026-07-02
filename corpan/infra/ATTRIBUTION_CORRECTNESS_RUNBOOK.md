# Subscription attribution — correctness runbook (annual + monthly × Apple + Google)

**Audience:** whoever needs to guarantee that an affiliate gets credited when a
buyer subscribes — for BOTH `corpan.sub.annual` and `corpan.sub.monthly`, on BOTH
Apple and Google, on the first purchase AND on every renewal.

**Read first:** `RENEWAL_ATTRIBUTION_SETUP.md` (store/cloud notification wiring),
`PHASE3_CODES_CONTRACT.md` (data model), `AFFILIATE_CODES_PLAN.md` (design).

---

## 0. The one rule that governs everything

> **Attribution is decided once, at the ORIGINAL purchase, and rides forever on a
> stable identity token baked into that transaction.** You cannot retro-attribute
> a subscription whose first transaction carried no identity.

Two identity channels, both must be present at purchase:

| Platform | Identity carried into the purchase | Where it's read |
|---|---|---|
| Apple   | `appAccountToken` = our `subjectId` (UUID) | propagated by Apple onto every renewal txn **iff set on the original** |
| Google  | `obfuscatedAccountId` = `SHA-256(subjectId)` | reverse-mapped via DynamoDB `GSI1` |

Plus a **store-level discount offer** must exist for the *specific product* the
buyer chooses, or there is no code for them to apply and no offer-id for the
out-of-app attribution path to key on.

Everything below is just making sure those two things are true for monthly as
well as annual, on both stores.

---

## 1. Current state (audited 2026-06-29) — what works, what doesn't

### ✅ Working
- **Annual, both platforms, first purchase.** Partner codes exist
  (`IAN30/AC30/FLO30/MONICA30/AGUS30/AUGUST30/SKY30/DWALKER30`), each bound to the
  **annual** base plan (`googleBasePlanId: "annual"`, Apple `appleOfferIdentifier`
  = the annual offer). Verified real conversion: Android annual via `SKY30`,
  $24 → partner `sky` credited (ledger `LEDGER#sky#2026-06`, payout $6.12).
- **In-app "Subscribe" button** sets `appAccountToken` (iOS) / `obfuscatedAccountId`
  (Android) for **both** SKUs with no product branching
  (`corpan-app/src/contentPacks/purchase.ts:639-646`). This path attributes
  correctly for monthly too — *if a code/offer existed for monthly.*
- **Lambda renewal + clawback logic** is implemented and product-agnostic
  (`verify_purchase.js` §6 Apple `handleAppleNotification`, Google
  `handleGoogleNotification`; `codes.js` `creditRenewal/reverseCredit/attributeFromOffer`).
- **Apple out-of-app offer-code redemptions** attribute even with no
  `appAccountToken`, straight from the offer id (`verify_purchase.js:912-919`,
  `codes.attributeFromOffer`). This is the robust path — but it needs the offer to
  exist (see gap #1).

### ❌ Gaps (these are why "monthly" is not correctly attributed today)

1. **No monthly affiliate offers exist on either store.** Every row in
   `infra/codes/seed.local.json` is annual-only (`googleBasePlanId: "annual"`,
   annual `appleOfferIdentifier`). A buyer who picks **monthly** has no code to
   apply → no discount, no offer-id, and `/code/resolve` for a monthly product
   returns an offer that mismatches (the verify `offerMatches` check then sets
   `offerApplied=false`, `verify_purchase.js:638-640`). **Coded monthly
   attribution is impossible until monthly offers are created.** → Fix in §2.

2. **The one real monthly sale (iOS, `corpan.sub.monthly`, started 2026-04-28,
   $12.99, US) has `appAccountToken=(none)` on every transaction and is not in
   DynamoDB at all.** It was bought organically (no code) through a path that
   didn't set the token (pre-wiring install, or a non-button/async path). It is
   **permanently unattributable** — nothing to fix retroactively; this is the
   cost of gap #3 below before it's closed.

3. **iOS renewals/restores/redeems are tokenless by construction.** Apple only
   carries `appAccountToken` onto a renewal if the original purchase set it; the
   offer-code redeem sheet has no `appAccountToken` API. The client *does* send
   `body.subjectId` on these paths and the Lambda's **first-purchase** path honors
   `body.subjectId` (`verify_purchase.js:603,650`), but the **renewal** path keys
   strictly on the JWS `appAccountToken` (`verify_purchase.js:887,920-921`) — so a
   sub whose original txn had no token can never have its renewals credited.
   Mitigation = ensure the token is set on the original (done for the button path;
   the residual hole is out-of-app Apple redeems, covered by the offer-id path in
   §1 once monthly offers exist).

4. **Renewal notifications must be wired (ASSN V2 + RTDN) or no renewal ever
   credits** — monthly renews ~12×/yr, so this matters far more for monthly than
   annual. Status of the manual store/console steps is **unverified** — confirm
   per §3 before trusting renewal revenue.

---

## 2. Fix gap #1 — create monthly affiliate offers (per partner, per store)

Do this for each active partner who should earn on monthly. Tools already exist;
**both default to dry-run** (print the exact request, change nothing) until `--yes`.

> ⚠️ These are **outward-facing, live-store** changes. Run the dry-run, read the
> JSON, get sign-off, *then* add `--yes`. Don't batch all partners blind.

### Apple (App Store Connect)
```bash
# DRY RUN first — 30% off the first month, monthly product, custom code IAN30M
python infra/asc/asc_monetization.py code-discount \
  --product corpan.sub.monthly \
  --code IAN30M --percent-off 30 --months 1 --periods 1
# inspect output, then re-run with --yes
```
(`--periods 1 --months 1` = one monthly period discounted. Apple realizes a % via
the nearest price-point rung per territory; the tool handles equalization.)

### Google (Play)
```bash
# DRY RUN first
python infra/play/play_monetization.py affiliate-offer \
  --product corpan.sub.monthly --base-plan corpan-sub-monthly --code IAN30M
# then --activate --yes
```

### Register the code in our backend
Add a CODE row whose `googleBasePlanId: "monthly"` and `appleOfferIdentifier` =
the monthly offer ref, to `infra/codes/seed.local.json` (gitignored), then load:
```bash
python infra/codes/load_seed.py            # dry-run / inspect
python infra/codes/load_seed.py --apply    # writes PARTNER#/CODE# rows to corpan-iap
```
**Decision needed before doing any of this:** do we even *want* monthly affiliate
discounts? Monthly churns fast and a 30%-off-first-month coupon is low-value to a
partner. A cleaner policy may be **"affiliate codes are annual-only; monthly is
full-price organic"** — in which case gap #1 is *intentional* and the only work is
documenting it (and making the in-app code UI hide the code field when monthly is
selected so we don't dangle a code that won't apply). **Pick one and write it
down**; today the behavior is accidental, not chosen.

---

## 3. Verify renewal wiring is live (do this before trusting renewal revenue)

These are the manual steps from `RENEWAL_ATTRIBUTION_SETUP.md`. Verify, don't assume.

**Apple ASSN V2:**
- Secret `corpan/content-packs/verify` → `apple` must have `appAppleId`,
  `notificationEnvironment: "Production"`, `rootCerts` (base64-DER Apple roots).
  Check presence (not values):
  `aws secretsmanager get-secret-value --secret-id corpan/content-packs/verify --region us-east-2 --query SecretString --output text | python3 -c "import sys,json;a=json.load(sys.stdin)['apple'];print({k:(k in a) for k in ['appAppleId','notificationEnvironment','rootCerts']})"`
- App Store Connect → App Information → **App Store Server Notifications** →
  Production Server URL (V2) = `…/prod/apple-notifications`. (UI only, no API.)

**Google RTDN:**
- Secret `google` must have `pubsubServiceAccount` + `pubsubAudience` (else the
  Lambda **fail-closes** and rejects every push — `verify_purchase.js:995-998`).
- Pub/Sub topic `projects/corpora1/topics/corpan-rtdn` + push subscription exist
  (§B1 of the setup doc).
- Play Console → Monetization setup → **Real-time developer notifications** → Topic
  = `projects/corpora1/topics/corpan-rtdn` → Send test notification.

**End-to-end proof:** trigger a sandbox renewal (StoreKit sandbox auto-renews in
minutes), then confirm a ledger write:
```bash
python infra/scripts/revenue_report.py --since 1d --include-test
```
You want to see a `renew` event for the partner. No renew row after a sandbox
renewal = wiring is broken.

---

## 4. Reading the data safely (no account-lock risk)

The earlier "key fumbling" was: printing secret fields (blocked), bad JWTs, wrong
creds, repeated live auths. None of that is necessary for routine checks.

**Rules:**
- **Prefer DynamoDB over store APIs.** Our table `corpan-iap` (us-east-2) is the
  system of record for *attributed* revenue. Reading it cannot affect Apple/Google.
  - `python infra/scripts/revenue_report.py --since 90d` — coded revenue + payouts.
  - Raw subscriber rows: scan `SUBJECT#…/PURCHASE#…` (see §5).
- **Store APIs are read-mostly and rate-limited; treat every call as billable
  trust.** Never loop auth attempts. Sign ONE short-lived JWT, reuse it for the
  whole run (Apple caps token life at 20 min). A handful of read calls is fine;
  do NOT poll in a tight loop.
- **Never print** `.p8` / private keys / JWTs / issuer/key ids. Load the secret,
  use it in-process, print only results. (The repo is open source.)
- **Apple read endpoints that are safe & useful** (App Store Server API, uses
  `secrets.apple`): `getNotificationHistory` (enumerate recent SUBSCRIBED/DID_RENEW
  by date range — no transactionId needed), `getTransactionHistory(txnId)`,
  `getAllSubscriptionStatuses(txnId)`. These are reads; they don't mutate the store.
- **Apple Sales & Trends reports** need a **vendor number** (the secret doesn't
  carry one). Get it from App Store Connect → Payments and Financial Reports, or
  Users and Access → keys. Don't guess it into the secret.
- **Any write to a store** (`asc_monetization.py … --yes`, `play_monetization.py …
  --yes/--activate`) is outward-facing and hard to reverse — dry-run + sign-off
  first, always.

---

## 5. Quick reference — am I attributed? (read-only)

```bash
# All real (Production) subscriptions in our system of record:
python3 - <<'PY'
import os,json,boto3
from pathlib import Path; from dotenv import load_dotenv
load_dotenv(Path.home()/".env")
ddb=boto3.Session(aws_access_key_id=os.environ["AWS_ACCESS_KEY"],
  aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],region_name="us-east-2").client("dynamodb")
items=[];kw={"TableName":"corpan-iap"}
while True:
    r=ddb.scan(**kw);items+=r["Items"]
    if "LastEvaluatedKey" in r: kw["ExclusiveStartKey"]=r["LastEvaluatedKey"]
    else: break
g=lambda it,k:(list(it[k].values())[0] if k in it else None)
for it in items:
    if (g(it,"PK") or "").startswith("SUBJECT#") and (g(it,"SK") or "").startswith("PURCHASE#"):
        print(g(it,"environment"), g(it,"productId"), "code="+str(g(it,"code")),
              "partner="+str(g(it,"partnerId")), g(it,"SK"))
PY
```
A subscription that exists on Apple/Google but is **absent here** = not attributed
(and, if it had no `appAccountToken`/`obfuscatedAccountId` on its original txn,
**cannot** be). Confirm the original-txn token via
`getTransactionHistory(originalTransactionId)` before concluding it's fixable.

---

## 6. Definition of done

- [ ] Policy decided & written: are affiliate codes annual-only, or annual+monthly? (§2)
- [ ] If monthly codes wanted: monthly offers created on Apple + Google for each
      active partner; matching `CODE#…` rows with `googleBasePlanId:"monthly"` +
      monthly `appleOfferIdentifier` loaded into `corpan-iap`. (§2)
- [ ] In-app purchase UI sets identity token for both SKUs (already true) and does
      not offer a code on a SKU that has no matching offer. (§2 caveat)
- [ ] ASSN V2 secret fields + Console URL confirmed live. (§3)
- [ ] RTDN secret fields + topic + Console topic confirmed live. (§3)
- [ ] Sandbox renewal produces a ledger `renew` row for each platform. (§3)
</content>
</invoke>
