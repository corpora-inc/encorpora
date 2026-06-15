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
| **Regional per-country base-plan prices** (from a pricing matrix) | `play_monetization.py set-prices` — converts USD targets → tax-adjusted local prices and patches `basePlans[].regionalConfigs[].price` |
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

## Regional prices — `set-prices`

Applies **per-country base-plan prices** from a frozen pricing matrix
(`corpan/infra/pricing/pricing-matrix.json`; another team fills the values). For each
country in `countryTier` it resolves the country's tier, reads that tier's
**`android.monthly`** or **`android.annual`** USD target (per `--period`), converts the
USD to a sensible **tax-adjusted local price**, and patches that price onto the base
plan's `regionalConfigs[].price`.

```bash
# Dry-run prints a table (region → target USD → local price) + the exact patch body.
python play_monetization.py set-prices --product corpan.sub.monthly --base-plan corpan-sub-monthly --period monthly --matrix ../pricing/pricing-matrix.json
python play_monetization.py set-prices --product corpan.sub.annual  --base-plan corpan-sub-anual  --period annual  --matrix ../pricing/pricing-matrix.json
# Apply (gated). --only limits to a subset of ISO-2 countries.
python play_monetization.py set-prices --product corpan.sub.monthly --base-plan corpan-sub-monthly --period monthly --matrix ../pricing/pricing-matrix.json --only US,ID,IN --yes
```

**How the price is computed.** Play region codes are already ISO 3166-1 alpha-2, so
`countryTier` keys map 1:1 to regions. The tool groups countries by their USD target and
makes **one** [`monetization.convertRegionPrices`][cvt] call per distinct USD amount —
that endpoint returns Google's exchange-rate + **tax-adjusted** local `Money` for every
region at once (`convertedRegionPrices[<REGION>].price` is tax-inclusive). Each local
`Money` is then **rounded to a clean shelf price**: zero-decimal currencies (JPY, KRW,
IDR, VND…) round to a whole unit and to a tidy step for large amounts (nearest 100 ≥1000,
nearest 10 ≥100, e.g. ¥1500 / Rp149000); 2-decimal currencies round to the cent. (We
deliberately don't do per-currency psychological `.99` pricing — that needs rules we don't
want to own.) Countries the base plan doesn't sell in, or that `convertRegionPrices`
returns no price for (non-billable at `regionsVersion 2022/02`, like MN), are **skipped
and logged** — same dodge as the trial/affiliate tools.

**How it writes.** Read-modify-write: it GETs the whole subscription, sets `price` on
**only** the targeted regions of the target base plan's `regionalConfigs[]` (leaving every
other region, field, and base plan untouched), then [`subscriptions.patch`][patch] with
`updateMask=basePlans` and `regionsVersion.version=2022/02`. `--only` countries not listed
in the matrix fall back to the `DEFAULT` tier.

[cvt]: https://developers.google.com/android-publisher/api-ref/rest/v3/monetization/convertRegionPrices
[patch]: https://developers.google.com/android-publisher/api-ref/rest/v3/monetization.subscriptions/patch

> ⚠️ **Existing subscribers are NOT migrated.** A base-plan price change affects **new
> purchases only**; existing subscribers keep their current price until you run a Play
> **price-change cohort** (Console → Subscriptions → *Change price*, or the dedicated price
> change flow). `set-prices` never silently migrates anyone. **Decreases** are low-risk and
> take effect for new buyers immediately; for **increases**, run the opt-in/notify cohort
> separately so existing subscribers are handled per Play policy.

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
