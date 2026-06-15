# Play monetization tooling

Script the Google Play subscription setup the Console makes painful. Reuses the
same Google service account the verify lambda uses (AWS Secrets Manager
`corpan/content-packs/verify` → `google.serviceAccountJson`).

## What's API-able vs Console-only

| Task | How |
|---|---|
| **7-day free trial** (lights up the in-app trial UI) | `play_monetization.py trial` — a base-plan *offer*; needs neither backward-compat nor the Console |
| **Per-affiliate-code discount** (IAN30 → 30% off, applied in-app after the typed code is validated) | `play_monetization.py affiliate-offer` — a base-plan *offer* with `relativeDiscount` + **empty targeting** (developer-determined, never auto-shown) |
| **Backward-compatible flag** (Play demands it before promo codes) | `play_monetization.py backcompat` — `legacyCompatible=true` patch |
| **Promo-code generation** | **Console-only** (no API). Click path below. |

## Setup
```
pip install google-api-python-client google-auth boto3
# AWS creds in the environment (same account that holds the verify secret), OR use --key.
```
The service account must be linked in Play Console (Users & permissions) with a role
that can **manage products/monetization**. If `trial`/`backcompat` 401/403, grant it
"Manage store presence / monetization" for `com.corpora.corpan`.

## Run (writes are dry-run until `--yes`)
```bash
# 1. Discover your base-plan ids (read-only, safe)
python play_monetization.py list

# 2. Create + activate a 7-day free trial on each plan (dry-run first, then --yes)
python play_monetization.py trial --product corpan.sub.monthly --base-plan <id> --days 7
python play_monetization.py trial --product corpan.sub.monthly --base-plan <id> --days 7 --activate --yes
python play_monetization.py trial --product corpan.sub.annual  --base-plan <id> --days 7 --activate --yes

# 3. Per-affiliate-code discounts (30% off). One offer per code; dry-run first, then --yes.
#    offerId/offerTag = code-<lowercased>, e.g. IAN30 -> "code-ian30".
python play_monetization.py affiliate-offer --product corpan.sub.monthly --base-plan corpan-sub-monthly --code IAN30
python play_monetization.py affiliate-offer --product corpan.sub.monthly --base-plan corpan-sub-monthly --code IAN30 --activate --yes
#    Annual plan: discount just the first year with --months 1 (recurrenceCount).
python play_monetization.py affiliate-offer --product corpan.sub.annual --base-plan corpan-sub-anual --code IAN30 --months 1 --activate --yes
#    Codes: IAN30 SKY30 AUGUST30 AC30 FLO30 MONICA30 DWALKER30 AGUS30 (run once per code per base plan).

# 4. (Only if you want PROMO CODES) mark a base plan backward compatible
python play_monetization.py backcompat --product corpan.sub.monthly --base-plan <id> --yes
```
Free trials apply automatically for eligible (never-subscribed) users — the in-app
`SubscriptionOffer` UI renders "7 days free, then $X" once these offers are active.

### Affiliate discount codes — app-mediated redemption (NOT auto-eligible)

Affiliate-code offers are **developer-determined**: the body omits `targeting`
entirely (no `acquisitionRule`/`upgradeRule`), so Play will **never** auto-surface
them. The discount uses `relativeDiscount` — the *fraction the user pays* — so 30%
off = `0.70` (range `(0,1)`). It's applied on the anchor region plus the
`otherRegionsConfig` catch-all, recurring for `--months` billing cycles (default 12).

Redemption flow: the user types a code in-app → the backend validates it → the app
selects the matching offer's **`offerToken`** (the one whose
`offerDetails.offerId == code-<lowercased>`) when launching the Play billing flow.
Attribution flows back via `purchases.subscriptionsv2.get` →
`lineItems[].offerDetails.offerId` / `offerTags` (we tag each offer
`code-<lowercased-code>`). Because eligibility is developer-determined, an offer is
only ever charged when the app passes its token — there's no risk of Play showing a
30%-off price to everyone.

## Promo codes (Console-only fallback)
After `backcompat`, the subscription becomes eligible. Then:
1. Play Console → app → **Monetize with Play → Promo codes**.
2. **Create promo code** → **Subscription** → pick the backward-compatible subscription.
3. **One-time** (auto-generated, redeemable in Play Store or in-app) or **Custom**
   (your string, 2,000–99,999 uses, **in-app only**).
4. Free-trial length **3–90 days**, quantity, validity → **Create**.
   ⚠️ Irreversible: quantity/type/product can't be changed after creation.

## Apple (separate, App Store Connect)
Apple free trials are StoreKit **introductory offers** (configured per subscription in
App Store Connect, or via the App Store Connect API). Apple **Offer Codes** are the
promo-code analog (`presentOfferCodeRedeemSheet`, Phase 3). Not covered by this tool.
